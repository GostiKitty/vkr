import { solveTransient1DExplicit } from "./finiteDifference1D";
import type {
  TransientBoundaryCondition,
  TransientBoundaryValue,
  TransientCalculationResult,
  TransientLayer,
  TransientScenario,
} from "./types";

export type TransientUncertaintyTarget =
  | "outdoorTemperatureOffset"
  | "indoorTemperatureOffset"
  | "heatingPowerMultiplier"
  | "internalGainsMultiplier"
  | "lambdaMultiplier"
  | "initialTemperatureOffset";

export type TransientUncertaintyDistribution =
  | { kind: "uniform"; min: number; max: number }
  | { kind: "normal"; mean: number; std: number }
  | { kind: "triangular"; min: number; mode: number; max: number };

export interface TransientUncertaintyParameter {
  id: string;
  name: string;
  target: TransientUncertaintyTarget;
  distribution: TransientUncertaintyDistribution;
}

export interface TransientMonteCarloInput {
  baseScenarioId: string;
  constructionSourceId: string;
  constructionSourceType: "wall" | "roof" | "slab";
  samplesCount: number;
  seed?: number;
  parameters: TransientUncertaintyParameter[];
  comfortMin_C: number;
  criticalSurfaceTemperature_C?: number;
}

export interface TransientMonteCarloSample {
  index: number;
  parameters: Partial<Record<TransientUncertaintyTarget, number>>;
  stable: boolean;
  valid: boolean;
  minInnerSurfaceTemperature_C: number;
  maxInnerSurfaceTemperature_C: number;
  finalInnerSurfaceTemperature_C: number;
  timeBelowComfort_s: number;
  timeBelowCriticalSurface_s: number;
  riskFlags: string[];
  warnings: string[];
  transientResult: TransientCalculationResult;
  selectedTimeIndex: number;
}

export interface TransientMonteCarloSummary {
  samplesCount: number;
  validSamplesCount: number;
  stableSamplesCount: number;
  unstableSamplesCount: number;
  probabilityBelowComfort: number;
  probabilityBelowCriticalSurface: number;
  p05MinTemperature: number;
  p50MinTemperature: number;
  p95MinTemperature: number;
  worstCaseSample: TransientMonteCarloSample | null;
  bestCaseSample: TransientMonteCarloSample | null;
  medianSample: TransientMonteCarloSample | null;
}

export interface TransientMonteCarloSensitivityEntry {
  parameterId: string;
  metric: "minInnerSurfaceTemperature_C";
  correlationApprox: number;
  rank: number;
}

export interface TransientMonteCarloResult {
  samples: TransientMonteCarloSample[];
  summary: TransientMonteCarloSummary;
  sensitivity: TransientMonteCarloSensitivityEntry[];
  warnings: string[];
}

const DEFAULT_SEED = 42;
const DEFAULT_HEATING_ALPHA_MULTIPLIER_WARNING =
  "Множитель отопительной мощности приближенно применен к alpha на внутренней конвективной границе; мощность HVAC явно не моделируется.";
const DEFAULT_INTERNAL_GAINS_WARNING =
  "Множитель внутренних теплопоступлений задан, но в базовом transient-сценарии отсутствует internalHeatSource_W_m3. Параметр не повлиял на расчет.";

export function runTransientMonteCarlo(
  input: TransientMonteCarloInput,
  baseScenario: TransientScenario,
  constructionLayers: TransientLayer[]
): TransientMonteCarloResult {
  if (input.samplesCount <= 0) {
    throw new Error("Transient Monte Carlo требует положительное число испытаний.");
  }
  if (!constructionLayers.length) {
    throw new Error("Transient Monte Carlo требует подготовленные слои конструкции.");
  }

  const rng = new Mulberry32(input.seed ?? DEFAULT_SEED);
  const warnings = new Set<string>();
  const samples: TransientMonteCarloSample[] = [];

  for (let index = 0; index < input.samplesCount; index += 1) {
    const sampledParameters = sampleParameterValues(input.parameters, rng);
    const localWarnings: string[] = [];
    const scenario = applyParametersToScenario(baseScenario, sampledParameters, localWarnings);
    const layers = applyParametersToLayers(constructionLayers, sampledParameters);
    const result = solveTransient1DExplicit(layers, scenario, {
      scheme: "explicit",
      innerSurfaceLimit_C: input.comfortMin_C,
    });

    const criticalLimit = input.criticalSurfaceTemperature_C;
    const timeBelowCriticalSurface_s =
      typeof criticalLimit === "number"
        ? computeTimeBelowThreshold(result.time, result.innerSurfaceTemperature, criticalLimit)
        : 0;
    const selectedTimeIndex = findIndexOfMinimum(result.innerSurfaceTemperature);
    const riskFlags: string[] = [];
    if (result.minInnerSurfaceTemperature < input.comfortMin_C) {
      riskFlags.push("belowComfort");
    }
    if (typeof criticalLimit === "number" && result.minInnerSurfaceTemperature < criticalLimit) {
      riskFlags.push("belowCriticalSurface");
    }
    if (!result.stable) {
      riskFlags.push("unstable");
    }

    const sampleWarnings = dedupeStrings([...localWarnings, ...result.warnings]);
    sampleWarnings.forEach((entry) => warnings.add(entry));
    samples.push({
      index,
      parameters: sampledParameters,
      stable: result.stable,
      valid: result.valid,
      minInnerSurfaceTemperature_C: result.minInnerSurfaceTemperature,
      maxInnerSurfaceTemperature_C: result.maxInnerSurfaceTemperature,
      finalInnerSurfaceTemperature_C:
        result.innerSurfaceTemperature[result.innerSurfaceTemperature.length - 1] ?? result.minInnerSurfaceTemperature,
      timeBelowComfort_s: result.timeBelowLimit_s ?? computeTimeBelowThreshold(result.time, result.innerSurfaceTemperature, input.comfortMin_C),
      timeBelowCriticalSurface_s,
      riskFlags,
      warnings: sampleWarnings,
      transientResult: result,
      selectedTimeIndex,
    });
  }

  const summary = buildSummary(samples, input.criticalSurfaceTemperature_C);
  if (summary.validSamplesCount === 0) {
    warnings.add(
      "Все сценарии Monte Carlo признаны недостоверными или неустойчивыми. Статистика P05/P50/P95 и вероятности не используются для количественной оценки."
    );
  }
  if (summary.unstableSamplesCount > 0) {
    warnings.add(
      `Из ${summary.samplesCount} испытаний ${summary.unstableSamplesCount} нарушили критерий устойчивости explicit-схемы и учтены отдельно.`
    );
  }

  return {
    samples,
    summary,
    sensitivity: buildSensitivity(input.parameters, samples),
    warnings: Array.from(warnings),
  };
}

export function getTransientMonteCarloVisualizationSample(
  result: TransientMonteCarloResult | null,
  mode: "worst" | "median" | "best"
): TransientMonteCarloSample | null {
  if (!result) {
    return null;
  }
  if (mode === "worst") {
    return result.summary.worstCaseSample;
  }
  if (mode === "best") {
    return result.summary.bestCaseSample;
  }
  return result.summary.medianSample;
}

function sampleParameterValues(
  parameters: TransientUncertaintyParameter[],
  rng: Mulberry32
): Partial<Record<TransientUncertaintyTarget, number>> {
  const values: Partial<Record<TransientUncertaintyTarget, number>> = {};
  parameters.forEach((parameter) => {
    values[parameter.target] = sampleFromDistribution(parameter.distribution, rng);
  });
  return values;
}

function applyParametersToScenario(
  baseScenario: TransientScenario,
  sampled: Partial<Record<TransientUncertaintyTarget, number>>,
  warnings: string[]
): TransientScenario {
  const outdoorOffset = sampled.outdoorTemperatureOffset ?? 0;
  const indoorOffset = sampled.indoorTemperatureOffset ?? 0;
  const heatingPowerMultiplier = Math.max(0, sampled.heatingPowerMultiplier ?? 1);
  const internalGainsMultiplier = Math.max(0, sampled.internalGainsMultiplier ?? 1);
  const initialTemperatureOffset = sampled.initialTemperatureOffset ?? 0;

  const initialCondition =
    baseScenario.initialCondition.kind === "profile"
      ? {
          ...baseScenario.initialCondition,
          profile:
            baseScenario.initialCondition.profile?.map((entry) => ({
              x_m: entry.x_m,
              temperature_C: entry.temperature_C + initialTemperatureOffset,
            })) ?? [],
        }
      : {
          ...baseScenario.initialCondition,
          temperature_C: (baseScenario.initialCondition.temperature_C ?? 20) + initialTemperatureOffset,
        };

  const innerBoundary = applyBoundaryAdjustments(
    baseScenario.innerBoundary,
    indoorOffset,
    heatingPowerMultiplier,
    warnings
  );
  const outerBoundary = applyBoundaryAdjustments(baseScenario.outerBoundary, outdoorOffset, 1, warnings);

  let internalHeatSource_W_m3 = baseScenario.internalHeatSource_W_m3;
  if (sampled.internalGainsMultiplier !== undefined) {
    if (internalHeatSource_W_m3 === undefined) {
      warnings.push(DEFAULT_INTERNAL_GAINS_WARNING);
    } else if (typeof internalHeatSource_W_m3 === "function") {
      const base = internalHeatSource_W_m3;
      internalHeatSource_W_m3 = (x_m, time_s) => base(x_m, time_s) * internalGainsMultiplier;
    } else {
      internalHeatSource_W_m3 *= internalGainsMultiplier;
    }
  }

  return {
    ...baseScenario,
    initialCondition,
    innerBoundary,
    outerBoundary,
    internalHeatSource_W_m3,
  };
}

function applyParametersToLayers(
  layers: TransientLayer[],
  sampled: Partial<Record<TransientUncertaintyTarget, number>>
): TransientLayer[] {
  const lambdaMultiplier = Math.max(1e-6, sampled.lambdaMultiplier ?? 1);
  return layers.map((layer) => ({
    ...layer,
    lambda_W_mK: Math.max(1e-6, layer.lambda_W_mK * lambdaMultiplier),
  }));
}

function applyBoundaryAdjustments(
  boundary: TransientBoundaryCondition,
  temperatureOffset_C: number,
  heatingPowerMultiplier: number,
  warnings: string[]
): TransientBoundaryCondition {
  const nextBoundary: TransientBoundaryCondition = { ...boundary };
  if (boundary.kind === "temperature") {
    nextBoundary.temperature_C = offsetBoundaryValue(boundary.temperature_C, temperatureOffset_C);
    if (heatingPowerMultiplier !== 1) {
      warnings.push(
        "Множитель отопительной мощности не применен к границе temperature: там задается идеальная температура, а не ограниченная мощность."
      );
    }
    return nextBoundary;
  }
  if (boundary.kind === "convection") {
    nextBoundary.ambientTemperature_C = offsetBoundaryValue(boundary.ambientTemperature_C, temperatureOffset_C);
    if (heatingPowerMultiplier !== 1) {
      nextBoundary.alpha_W_m2K = Math.max(0.1, (boundary.alpha_W_m2K ?? 8.7) * heatingPowerMultiplier);
      warnings.push(DEFAULT_HEATING_ALPHA_MULTIPLIER_WARNING);
    }
    return nextBoundary;
  }
  return nextBoundary;
}

function offsetBoundaryValue(value: TransientBoundaryValue | undefined, offset_C: number): TransientBoundaryValue | undefined {
  if (!offset_C) {
    return value;
  }
  if (typeof value === "function") {
    return (time_s: number) => value(time_s) + offset_C;
  }
  if (typeof value === "number") {
    return value + offset_C;
  }
  return offset_C;
}

function buildSummary(
  samples: TransientMonteCarloSample[],
  criticalSurfaceTemperature_C: number | undefined
): TransientMonteCarloSummary {
  const validSamples = samples.filter((entry) => entry.valid && entry.stable && Number.isFinite(entry.minInnerSurfaceTemperature_C));
  const sortedByMinimum = [...validSamples].sort(
    (left, right) => left.minInnerSurfaceTemperature_C - right.minInnerSurfaceTemperature_C
  );
  const minima = sortedByMinimum.map((entry) => entry.minInnerSurfaceTemperature_C);
  const validSamplesCount = validSamples.length;
  const stableSamplesCount = samples.filter((entry) => entry.stable).length;
  const unstableSamplesCount = samples.length - stableSamplesCount;
  const p05MinTemperature = validSamplesCount ? quantile(minima, 0.05) : Number.NaN;
  const p50MinTemperature = validSamplesCount ? quantile(minima, 0.5) : Number.NaN;
  const p95MinTemperature = validSamplesCount ? quantile(minima, 0.95) : Number.NaN;
  const medianSample = validSamplesCount ? pickClosestSample(sortedByMinimum, p50MinTemperature) : null;
  return {
    samplesCount: samples.length,
    validSamplesCount,
    stableSamplesCount,
    unstableSamplesCount,
    probabilityBelowComfort:
      validSamplesCount > 0 ? validSamples.filter((entry) => entry.timeBelowComfort_s > 0).length / validSamplesCount : Number.NaN,
    probabilityBelowCriticalSurface:
      validSamplesCount > 0 && typeof criticalSurfaceTemperature_C === "number"
        ? validSamples.filter((entry) => entry.timeBelowCriticalSurface_s > 0).length / validSamplesCount
        : Number.NaN,
    p05MinTemperature,
    p50MinTemperature,
    p95MinTemperature,
    worstCaseSample: sortedByMinimum[0] ?? null,
    bestCaseSample: sortedByMinimum[sortedByMinimum.length - 1] ?? null,
    medianSample,
  };
}

function buildSensitivity(
  parameters: TransientUncertaintyParameter[],
  samples: TransientMonteCarloSample[]
): TransientMonteCarloSensitivityEntry[] {
  const validSamples = samples.filter((entry) => entry.valid && entry.stable && Number.isFinite(entry.minInnerSurfaceTemperature_C));
  const metricValues = validSamples.map((entry) => entry.minInnerSurfaceTemperature_C);
  const entries = parameters.map((parameter) => {
    const parameterValues = validSamples.map((sample) => sample.parameters[parameter.target] ?? 0);
    const correlationApprox = validSamples.length >= 2 ? spearmanCorrelation(parameterValues, metricValues) : 0;
    return {
      parameterId: parameter.id,
      metric: "minInnerSurfaceTemperature_C" as const,
      correlationApprox,
      rank: 0,
    };
  });
  const sorted = [...entries].sort(
    (left, right) => Math.abs(right.correlationApprox) - Math.abs(left.correlationApprox)
  );
  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    correlationApprox: Number.isFinite(entry.correlationApprox) ? entry.correlationApprox : 0,
  }));
}

function computeTimeBelowThreshold(time: number[], values: number[], threshold_C: number): number {
  let total = 0;
  for (let index = 1; index < time.length; index += 1) {
    if ((values[index] ?? Number.POSITIVE_INFINITY) < threshold_C) {
      total += Math.max(0, (time[index] ?? 0) - (time[index - 1] ?? 0));
    }
  }
  return total;
}

function findIndexOfMinimum(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  let bestIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[bestIndex]) {
      bestIndex = index;
    }
  }
  return bestIndex;
}

function pickClosestSample(samples: TransientMonteCarloSample[], targetValue: number): TransientMonteCarloSample | null {
  if (!samples.length) {
    return null;
  }
  let best = samples[0];
  let bestDelta = Math.abs(samples[0].minInnerSurfaceTemperature_C - targetValue);
  for (let index = 1; index < samples.length; index += 1) {
    const delta = Math.abs(samples[index].minInnerSurfaceTemperature_C - targetValue);
    if (delta < bestDelta) {
      best = samples[index];
      bestDelta = delta;
    }
  }
  return best;
}

function quantile(sortedValues: number[], probability: number): number {
  if (!sortedValues.length) {
    return 0;
  }
  const index = (sortedValues.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sortedValues[lower] ?? 0;
  }
  const weight = index - lower;
  return (sortedValues[lower] ?? 0) * (1 - weight) + (sortedValues[upper] ?? 0) * weight;
}

function spearmanCorrelation(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length < 2) {
    return 0;
  }
  return pearsonCorrelation(buildRanks(left), buildRanks(right));
}

function buildRanks(values: number[]): number[] {
  const entries = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length).fill(0);
  let cursor = 0;
  while (cursor < entries.length) {
    let next = cursor + 1;
    while (next < entries.length && entries[next].value === entries[cursor].value) {
      next += 1;
    }
    const averageRank = (cursor + next - 1) / 2 + 1;
    for (let index = cursor; index < next; index += 1) {
      ranks[entries[index].index] = averageRank;
    }
    cursor = next;
  }
  return ranks;
}

function pearsonCorrelation(left: number[], right: number[]): number {
  const meanLeft = average(left);
  const meanRight = average(right);
  let numerator = 0;
  let leftSpread = 0;
  let rightSpread = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - meanLeft;
    const rightDelta = right[index] - meanRight;
    numerator += leftDelta * rightDelta;
    leftSpread += leftDelta * leftDelta;
    rightSpread += rightDelta * rightDelta;
  }
  const denominator = Math.sqrt(leftSpread * rightSpread);
  if (!Number.isFinite(denominator) || denominator <= 1e-12) {
    return 0;
  }
  return numerator / denominator;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleFromDistribution(distribution: TransientUncertaintyDistribution, rng: Mulberry32): number {
  switch (distribution.kind) {
    case "uniform":
      return distribution.min + rng.next() * (distribution.max - distribution.min);
    case "normal":
      return distribution.mean + distribution.std * rng.nextGaussian();
    case "triangular":
      return sampleTriangular(distribution.min, distribution.mode, distribution.max, rng.next());
  }
}

function sampleTriangular(min: number, mode: number, max: number, u: number): number {
  const pivot = (mode - min) / Math.max(max - min, 1e-9);
  if (u < pivot) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
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
