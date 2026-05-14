import type { BuildingModel } from "../../entities/geometry/types";
import type { AdjacencyResult } from "../graph/adjacency";
import { buildAdjacencyGraph } from "../graph/adjacency";
import {
  runThermalSimulation,
  type ThermalSimulationOptions,
  type ThermalSimulationResult,
} from "../thermal/solver";

export type DistributionDefinition =
  | { kind: "normal"; mean: number; stdDev: number }
  | { kind: "lognormal"; logMean: number; logStdDev: number }
  | { kind: "triangular"; min: number; mode: number; max: number }
  | { kind: "beta"; alpha: number; beta: number; min?: number; max?: number };

export interface ThermalUncertaintyDefinition {
  id: keyof ThermalUncertaintySample;
  label: string;
  description: string;
  distribution: DistributionDefinition;
  unit: string;
}

export interface ThermalUncertaintySample {
  outdoorBiasC: number;
  infiltrationMultiplier: number;
  internalGainMultiplier: number;
  setpointOffsetC: number;
}

export const THERMAL_UNCERTAINTY_DEFINITIONS: ThermalUncertaintyDefinition[] = [
  {
    id: "outdoorBiasC",
    label: "Смещение уличной температуры",
    description: "Гауссовское смещение климатического профиля, °C",
    unit: "°C",
    distribution: { kind: "normal", mean: 0, stdDev: 1.8 },
  },
  {
    id: "infiltrationMultiplier",
    label: "Множитель инфильтрации",
    description: "Треугольное распределение для кратности воздухообмена",
    unit: "×",
    distribution: { kind: "triangular", min: 0.4, mode: 1, max: 1.9 },
  },
  {
    id: "internalGainMultiplier",
    label: "Множитель внутренних теплопоступлений",
    description: "Бета-распределение, отражающее графики занятости",
    unit: "×",
    distribution: { kind: "beta", alpha: 2.5, beta: 2, min: 0.6, max: 1.4 },
  },
  {
    id: "setpointOffsetC",
    label: "Смещение уставки",
    description: "Гауссовое отклонение дневной/ночной температуры, °C",
    unit: "°C",
    distribution: { kind: "normal", mean: 0, stdDev: 0.8 },
  },
] as const;

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  mid: number;
  count: number;
  probability: number;
}

export interface CdfPoint {
  value: number;
  probability: number;
}

export interface DistributionSummary {
  mean: number;
  stdDev: number;
  p5: number;
  p50: number;
  p95: number;
  valueAtRisk: number;
  conditionalValueAtRisk: number;
  histogram: HistogramBin[];
  cdf: CdfPoint[];
}

export interface ThermalMonteCarloResult {
  runs: number;
  /** Детерминированный seed воспроизводимости (после ограничения runs). */
  seed: number;
  /** Уровень расчёта: неопределённость входов при повторе RC-модели; не СП 50 и не CFD. */
  engineeringScopeRu: string;
  samples: ThermalUncertaintySample[];
  peakLoad: DistributionSummary;
  /** Среднесуточная энергия за период базового сценария (24 ч или 7 суток), кВт·ч. */
  dailyEnergy: DistributionSummary;
  /** 365× среднесуточная энергия — условный год для сравнения прогонов, не нормативный расход. */
  annualEnergy: DistributionSummary;
  exceedanceProbability?: number;
  varLevel: number;
}

export interface ThermalMonteCarloOptions {
  model: BuildingModel;
  baseOptions: ThermalSimulationOptions;
  runs: number;
  seed?: number;
  adjacency?: AdjacencyResult;
  heatingThresholdKW?: number;
  varLevel?: number;
  correlationMatrix?: number[][];
  onProgress?: (completed: number, total: number) => void;
}

const MONTE_CARLO_THERMAL_SCOPE_RU =
  "Анализ неопределённости: многократный запуск той же зональной RC-модели с вариацией входных параметров (климат, ACH, внутренние тепловыделения, уставки). Результат — распределение показателей RC, а не нормативное заключение по СП 50 и не полевое CFD.";

const DEFAULT_BINS = 24;
const DEFAULT_VAR_LEVEL = 0.95;
const DEFAULT_SEED = 42;

interface MonteCarloCollected {
  samples: ThermalUncertaintySample[];
  peakLoadsKW: number[];
  totalEnergiesKWh: number[];
  exceedCount: number;
  durationDays: number;
  varLevel: number;
}

function collectThermalMonteCarloSamplesSync(
  options: ThermalMonteCarloOptions,
  adjacency: AdjacencyResult
): MonteCarloCollected {
  const rng = new Mulberry32(options.seed ?? DEFAULT_SEED);
  const varLevel = clamp(options.varLevel ?? DEFAULT_VAR_LEVEL, 0.5, 0.999);
  const definitions = THERMAL_UNCERTAINTY_DEFINITIONS;
  const correlator = buildCorrelator(definitions.length, options.correlationMatrix);

  const samples: ThermalUncertaintySample[] = [];
  const peakLoadsKW: number[] = [];
  const totalEnergiesKWh: number[] = [];
  const durationDays = options.baseOptions.duration === "7d" ? 7 : 1;
  let exceedCount = 0;

  for (let run = 0; run < options.runs; run++) {
    const uniforms = correlator(rng);
    const sample = sampleUncertainty(definitions, uniforms);
    samples.push(sample);
    const simOptions = applySampleToOptions(options.baseOptions, sample);
    const result = runThermalSimulation(options.model, simOptions, adjacency);
    const metrics = extractMetrics(result, durationDays);
    peakLoadsKW.push(metrics.peakLoadKW);
    totalEnergiesKWh.push(metrics.totalEnergyKWh);
    if (options.heatingThresholdKW !== undefined && metrics.peakLoadKW > options.heatingThresholdKW) {
      exceedCount += 1;
    }
    options.onProgress?.(run + 1, options.runs);
  }

  return { samples, peakLoadsKW, totalEnergiesKWh, exceedCount, durationDays, varLevel };
}

async function collectThermalMonteCarloSamplesAsync(
  options: ThermalMonteCarloOptions,
  adjacency: AdjacencyResult,
  yieldEvery: number
): Promise<MonteCarloCollected> {
  const rng = new Mulberry32(options.seed ?? DEFAULT_SEED);
  const varLevel = clamp(options.varLevel ?? DEFAULT_VAR_LEVEL, 0.5, 0.999);
  const definitions = THERMAL_UNCERTAINTY_DEFINITIONS;
  const correlator = buildCorrelator(definitions.length, options.correlationMatrix);

  const samples: ThermalUncertaintySample[] = [];
  const peakLoadsKW: number[] = [];
  const totalEnergiesKWh: number[] = [];
  const durationDays = options.baseOptions.duration === "7d" ? 7 : 1;
  let exceedCount = 0;

  for (let run = 0; run < options.runs; run++) {
    const uniforms = correlator(rng);
    const sample = sampleUncertainty(definitions, uniforms);
    samples.push(sample);
    const simOptions = applySampleToOptions(options.baseOptions, sample);
    const result = runThermalSimulation(options.model, simOptions, adjacency);
    const metrics = extractMetrics(result, durationDays);
    peakLoadsKW.push(metrics.peakLoadKW);
    totalEnergiesKWh.push(metrics.totalEnergyKWh);
    if (options.heatingThresholdKW !== undefined && metrics.peakLoadKW > options.heatingThresholdKW) {
      exceedCount += 1;
    }
    options.onProgress?.(run + 1, options.runs);
    if (yieldEvery > 0 && (run + 1) % yieldEvery === 0 && run + 1 < options.runs) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return { samples, peakLoadsKW, totalEnergiesKWh, exceedCount, durationDays, varLevel };
}

function finalizeThermalMonteCarloResult(
  collected: MonteCarloCollected,
  options: Pick<ThermalMonteCarloOptions, "runs" | "heatingThresholdKW" | "seed">
): ThermalMonteCarloResult {
  const seedUsed = options.seed ?? DEFAULT_SEED;
  /** Среднесуточная энергия за смоделированный период; «год» = 365× это значение (упрощение для сравнения прогонов). */
  const dailyEnergies = collected.totalEnergiesKWh.map((value) => value / collected.durationDays);
  const annualEnergies = dailyEnergies.map((value) => value * 365);
  return {
    runs: options.runs,
    seed: seedUsed,
    engineeringScopeRu: MONTE_CARLO_THERMAL_SCOPE_RU,
    samples: collected.samples,
    peakLoad: summarizeDistribution(collected.peakLoadsKW, DEFAULT_BINS, collected.varLevel),
    dailyEnergy: summarizeDistribution(dailyEnergies, DEFAULT_BINS, collected.varLevel),
    annualEnergy: summarizeDistribution(annualEnergies, DEFAULT_BINS, collected.varLevel),
    exceedanceProbability:
      options.heatingThresholdKW === undefined ? undefined : collected.exceedCount / options.runs,
    varLevel: collected.varLevel,
  };
}

export const THERMAL_MONTE_CARLO_MAX_RUNS = 800;

export function runThermalMonteCarlo(options: ThermalMonteCarloOptions): ThermalMonteCarloResult {
  if (options.runs <= 0) {
    throw new Error("Количество прогонов Monte Carlo должно быть больше нуля");
  }
  const runs = Math.min(options.runs, THERMAL_MONTE_CARLO_MAX_RUNS);
  const adjacency = options.adjacency ?? buildAdjacencyGraph(options.model);
  const collected = collectThermalMonteCarloSamplesSync({ ...options, runs }, adjacency);
  return finalizeThermalMonteCarloResult(collected, { ...options, runs });
}

export async function runThermalMonteCarloAsync(
  options: ThermalMonteCarloOptions & { yieldEvery?: number }
): Promise<ThermalMonteCarloResult> {
  if (options.runs <= 0) {
    throw new Error("Количество прогонов Monte Carlo должно быть больше нуля");
  }
  const runs = Math.min(options.runs, THERMAL_MONTE_CARLO_MAX_RUNS);
  const adjacency = options.adjacency ?? buildAdjacencyGraph(options.model);
  const yieldEvery = Math.max(1, options.yieldEvery ?? 25);
  const collected = await collectThermalMonteCarloSamplesAsync({ ...options, runs }, adjacency, yieldEvery);
  return finalizeThermalMonteCarloResult(collected, { ...options, runs });
}

function extractMetrics(result: ThermalSimulationResult, durationDays: number) {
  return {
    peakLoadKW: result.summary.peakLoadKW,
    totalEnergyKWh: result.summary.totalEnergyKWh,
    dailyEnergyKWh: result.summary.totalEnergyKWh / durationDays,
  };
}

function sampleUncertainty(
  definitions: readonly ThermalUncertaintyDefinition[],
  uniforms: number[]
): ThermalUncertaintySample {
  const sample: Partial<ThermalUncertaintySample> = {};
  definitions.forEach((definition, index) => {
    const u = uniforms[index];
    sample[definition.id] = sampleFrom(definition.distribution, u);
  });
  return sample as ThermalUncertaintySample;
}

function applySampleToOptions(
  baseOptions: ThermalSimulationOptions,
  sample: ThermalUncertaintySample
): ThermalSimulationOptions {
  const infiltration = baseOptions.infiltrationACH ?? 0.5;
  return {
    ...baseOptions,
    outdoor: {
      ...baseOptions.outdoor,
      // Смещение климата один раз (раньше bias дублировался в seasonalOffsetC и завышал разброс).
      baseC: baseOptions.outdoor.baseC + sample.outdoorBiasC,
    },
    setpoints: {
      ...baseOptions.setpoints,
      day: baseOptions.setpoints.day + sample.setpointOffsetC,
      night: baseOptions.setpoints.night + sample.setpointOffsetC,
    },
    internalGains: {
      ...baseOptions.internalGains,
      dayGain_W_m2: Math.max(0, baseOptions.internalGains.dayGain_W_m2 * sample.internalGainMultiplier),
      nightGain_W_m2: Math.max(0, baseOptions.internalGains.nightGain_W_m2 * sample.internalGainMultiplier),
    },
    infiltrationACH: Math.max(0.02, infiltration * sample.infiltrationMultiplier),
  };
}

function summarizeDistribution(values: number[], bins: number, varLevel: number): DistributionSummary {
  if (!values.length) {
    return {
      mean: 0,
      stdDev: 0,
      p5: 0,
      p50: 0,
      p95: 0,
      valueAtRisk: 0,
      conditionalValueAtRisk: 0,
      histogram: [],
      cdf: [],
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = average(values);
  const stdDev = standardDeviation(values, mean);
  const histogram = buildHistogram(values, bins);
  const cdf = buildCdf(sorted, 80);
  const p5 = quantile(sorted, 0.05);
  const p50 = quantile(sorted, 0.5);
  const p95 = quantile(sorted, 0.95);
  const valueAtRisk = quantile(sorted, varLevel);
  const tailValues = sorted.filter((value) => value >= valueAtRisk);
  const conditionalValueAtRisk = tailValues.length
    ? tailValues.reduce((sum, value) => sum + value, 0) / tailValues.length
    : valueAtRisk;
  return {
    mean,
    stdDev,
    p5,
    p50,
    p95,
    valueAtRisk,
    conditionalValueAtRisk,
    histogram,
    cdf,
  };
}

function buildHistogram(values: number[], bins: number): HistogramBin[] {
  if (!values.length) {
    return [];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (Math.abs(max - min) < 1e-9) {
    return [
      {
        binStart: min,
        binEnd: max,
        mid: min,
        count: values.length,
        probability: 1,
      },
    ];
  }
  const width = (max - min) / bins;
  const counts = Array.from({ length: bins }, () => 0);
  values.forEach((value) => {
    const index = Math.min(bins - 1, Math.floor((value - min) / width));
    counts[index] += 1;
  });
  return counts.map((count, index) => {
    const binStart = min + index * width;
    const binEnd = binStart + width;
    return {
      binStart,
      binEnd,
      mid: (binStart + binEnd) / 2,
      count,
      probability: count / values.length,
    };
  });
}

function buildCdf(sortedValues: number[], maxPoints: number): CdfPoint[] {
  if (!sortedValues.length) {
    return [];
  }
  const step = Math.max(1, Math.floor(sortedValues.length / maxPoints));
  const points: CdfPoint[] = [];
  for (let idx = 0; idx < sortedValues.length; idx += step) {
    const value = sortedValues[idx];
    const probability = (idx + 1) / sortedValues.length;
    points.push({ value, probability });
  }
  const lastValue = sortedValues[sortedValues.length - 1];
  if (points[points.length - 1]?.value !== lastValue) {
    points.push({ value: lastValue, probability: 1 });
  }
  return points;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const variance =
    values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function quantile(sortedValues: number[], probability: number): number {
  if (!sortedValues.length) {
    return 0;
  }
  const index = (sortedValues.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sortedValues[lower];
  }
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function sampleFrom(distribution: DistributionDefinition, u: number): number {
  const clamped = clamp(u, 1e-12, 1 - 1e-12);
  switch (distribution.kind) {
    case "normal":
      return distribution.mean + distribution.stdDev * inverseStandardNormal(clamped);
    case "lognormal":
      return Math.exp(distribution.logMean + distribution.logStdDev * inverseStandardNormal(clamped));
    case "triangular":
      return inverseTriangular(clamped, distribution.min, distribution.mode, distribution.max);
    case "beta": {
      const base = inverseRegularizedBeta(clamped, distribution.alpha, distribution.beta);
      const min = distribution.min ?? 0;
      const max = distribution.max ?? 1;
      return min + (max - min) * base;
    }
    default: {
      const exhaustive: never = distribution;
      throw new Error(`Unknown distribution ${(exhaustive as { kind?: string }).kind ?? "unknown"}`);
    }
  }
}

function inverseTriangular(u: number, min: number, mode: number, max: number): number {
  const c = (mode - min) / (max - min);
  if (u < c) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function inverseRegularizedBeta(u: number, alpha: number, beta: number): number {
  if (u <= 0) {
    return 0;
  }
  if (u >= 1) {
    return 1;
  }
  const EPS = 1e-12;
  const MAX_ITER = 50;
  let x = initialBetaGuess(u, alpha, beta);
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const error = regularizedIncompleteBeta(x, alpha, beta) - u;
    const derivative = Math.exp((alpha - 1) * Math.log(x + EPS) + (beta - 1) * Math.log(1 - x + EPS) - logBeta(alpha, beta));
    const step = error / (derivative + EPS);
    x = clamp(x - step, EPS, 1 - EPS);
    if (Math.abs(step) < 1e-9) {
      break;
    }
  }
  return x;
}

function initialBetaGuess(u: number, alpha: number, beta: number): number {
  if (u === 0) {
    return 0;
  }
  if (u === 1) {
    return 1;
  }
  const mean = alpha / (alpha + beta);
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const std = Math.sqrt(variance);
  const normalApprox = mean + std * inverseStandardNormal(u);
  return clamp(normalApprox, 1e-6, 1 - 1e-6);
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(x, a, b)) / a;
  }
  return 1 - (bt * betacf(1 - x, b, a)) / b;
}

function betacf(x: number, a: number, b: number): number {
  const MAX_ITER = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) {
    d = FPMIN;
  }
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) {
      d = FPMIN;
    }
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) {
      c = FPMIN;
    }
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) {
      d = FPMIN;
    }
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) {
      c = FPMIN;
    }
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPS) {
      break;
    }
  }
  return h;
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function logGamma(z: number): number {
  /* eslint-disable no-loss-of-precision -- published gamma/log-gamma coefficients and √(2π) tail constant */
  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.001208650973866179,
    -0.000005395239384953,
  ];
  const x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < cof.length; j++) {
    y += 1;
    ser += cof[j] / y;
  }
  const out = -tmp + Math.log(2.5066282746310005 * ser / x);
  /* eslint-enable no-loss-of-precision */
  return out;
}

function buildCorrelator(dim: number, correlationMatrix?: number[][]) {
  if (!correlationMatrix) {
    return (rng: Mulberry32) => Array.from({ length: dim }, () => standardNormalCdf(rng.nextGaussian()));
  }
  if (correlationMatrix.length !== dim) {
    throw new Error("Размер матрицы корреляций не совпадает с числом переменных.");
  }
  correlationMatrix.forEach((row, index) => {
    if (row.length !== dim) {
      throw new Error("Матрица корреляций должна быть квадратной.");
    }
    if (Math.abs(row[index] - 1) > 1e-6) {
      throw new Error("Диагональные элементы корреляционной матрицы должны быть равны 1.");
    }
  });
  const cholesky = choleskyDecomposition(correlationMatrix);
  return (rng: Mulberry32) => {
    const normals = Array.from({ length: dim }, () => rng.nextGaussian());
    const correlated = multiplyLower(cholesky, normals);
    return correlated.map((value) => standardNormalCdf(value));
  };
}

function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const lower: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += lower[i][k] * lower[j][k];
      }
      if (i === j) {
        const diag = matrix[i][i] - sum;
        if (diag <= 0) {
          throw new Error("Матрица корреляций должна быть положительно определённой.");
        }
        lower[i][j] = Math.sqrt(diag);
      } else {
        lower[i][j] = (matrix[i][j] - sum) / lower[j][j];
      }
    }
  }
  return lower;
}

function multiplyLower(lower: number[][], vector: number[]): number[] {
  return lower.map((row) => row.reduce((sum, value, j) => sum + value * vector[j], 0));
}

function standardNormalCdf(value: number): number {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function inverseStandardNormal(p: number): number {
  if (p <= 0 || p >= 1) {
    return p === 0 ? -Infinity : Infinity;
  }
  const a = [
    -39.6968302866538,
    220.946098424521,
    -275.928510446969,
    138.357751867269,
    -30.6647980661472,
    2.50662827745924,
  ];
  const b = [
    -54.4760987982241,
    161.585836858041,
    -155.698979859887,
    66.8013118877197,
    -13.2806815528857,
  ];
  const c = [
    -0.00778489400243029,
    -0.322396458041136,
    -2.40075827716184,
    -2.54973253934373,
    4.37466414146497,
    2.93816398269878,
  ];
  const d = [
    0.00778469570904146,
    0.32246712907004,
    2.445134137143,
    3.75440866190742,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  const qMid = p - 0.5;
  const rMid = qMid * qMid;
  return (
    (((((a[0] * rMid + a[1]) * rMid + a[2]) * rMid + a[3]) * rMid + a[4]) * rMid + a[5]) * qMid /
    (((((b[0] * rMid + b[1]) * rMid + b[2]) * rMid + b[3]) * rMid + b[4]) * rMid + 1)
  );
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

class Mulberry32 {
  private state: number;
  private spareGaussian: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextGaussian(): number {
    if (this.spareGaussian !== null) {
      const value = this.spareGaussian;
      this.spareGaussian = null;
      return value;
    }
    const u1 = this.next() || Number.MIN_VALUE;
    const u2 = this.next();
    const mag = Math.sqrt(-2.0 * Math.log(u1));
    const z0 = mag * Math.cos(2 * Math.PI * u2);
    const z1 = mag * Math.sin(2 * Math.PI * u2);
    this.spareGaussian = z1;
    return z0;
  }
}
