import type { SurrogateModel } from "../surrogate/train";
import { simulateThermalModel } from "../thermal/thermalModel";
import type {
  StepObserver,
  ThermalConnection,
  ThermalNode,
  OutdoorBoundary,
  SimulationOptions,
} from "../thermal/thermalModel";
import { runMorrisAnalysis } from "../sensitivity/morris";
import type { MorrisParameterDefinition, MorrisResult } from "../sensitivity/morris";

export type DistributionDefinition =
  | { kind: "uniform"; min: number; max: number }
  | { kind: "normal"; mean: number; stdDev: number };

export interface UncertainParameter {
  name: string;
  distribution: DistributionDefinition;
}

export interface ThermalScenario {
  nodes: ThermalNode[];
  connections: ThermalConnection[];
  boundary: OutdoorBoundary;
  options: SimulationOptions;
}

export interface MonteCarloRunMetrics {
  peakHeatingLoad: number; // Watts
  annualEnergy: number; // kWh over simulation horizon
}

export interface MonteCarloRunSummary extends MonteCarloRunMetrics {
  samples: Record<string, number>;
}

export interface MonteCarloMorrisConfig {
  levels: number;
  trajectories: number;
  seed?: number;
  targetMetric: "peakHeatingLoad" | "annualEnergy";
  parameterBounds?: Record<string, { min: number; max: number }>;
}

export interface MonteCarloOptions {
  runs: number;
  seed: number;
  parameters: UncertainParameter[];
  scenarioBuilder: (samples: Record<string, number>) => ThermalScenario;
  heatingLoadThreshold?: number;
  morris?: MonteCarloMorrisConfig;
  evaluationMode?: "full-physics" | "surrogate";
  surrogate?: {
    peakModel?: SurrogateModel;
    energyModel?: SurrogateModel;
  };
}

export interface SummaryStats {
  mean: number;
  stdDev: number;
  p5: number;
  p50: number;
  p95: number;
}

export interface MonteCarloResult {
  runs: number;
  runSummaries: MonteCarloRunSummary[];
  peakHeatingLoad: SummaryStats;
  annualEnergy: SummaryStats;
  exceedanceProbability?: number;
  sensitivity?: MorrisResult;
}

export function runMonteCarlo(options: MonteCarloOptions): MonteCarloResult {
  if (options.runs <= 0) {
    throw new Error("Monte Carlo run count must be positive");
  }
  if (!options.parameters.length) {
    throw new Error("At least one uncertain parameter is required");
  }

  const rng = new Mulberry32(options.seed);
  const peakLoads: number[] = [];
  const energies: number[] = [];
  const summaries: MonteCarloRunSummary[] = [];
  let exceedCount = 0;
  const threshold = options.heatingLoadThreshold;

  for (let run = 0; run < options.runs; run++) {
    const samples = sampleParameters(options.parameters, rng);
    const metrics = evaluateFromSamples(samples, options);

    peakLoads.push(metrics.peakHeatingLoad);
    energies.push(metrics.annualEnergy);
    summaries.push({ ...metrics, samples });

    if (threshold !== undefined && metrics.peakHeatingLoad > threshold) {
      exceedCount += 1;
    }
  }

  const peakStats = computeStats(peakLoads);
  const energyStats = computeStats(energies);

  let sensitivity: MorrisResult | undefined;
  if (options.morris) {
    sensitivity = runMorris(options, options.morris);
  }

  return {
    runs: options.runs,
    runSummaries: summaries,
    peakHeatingLoad: peakStats,
    annualEnergy: energyStats,
    exceedanceProbability: threshold === undefined ? undefined : exceedCount / options.runs,
    sensitivity,
  };
}

function evaluateScenario(scenario: ThermalScenario): MonteCarloRunMetrics {
  const timestepMinutes = scenario.options.timestepMinutes ?? 10;
  const dtHours = timestepMinutes / 60;
  const tracker = createLoadTracker(dtHours);
  simulateThermalModel(scenario.nodes, scenario.connections, scenario.boundary, scenario.options, tracker.observer);
  return tracker.finalize();
}

function evaluateFromSamples(samples: Record<string, number>, options: MonteCarloOptions): MonteCarloRunMetrics {
  if (options.evaluationMode === "surrogate") {
    if (!options.surrogate) {
      throw new Error("Surrogate mode selected but no surrogate models provided");
    }
    const peak = options.surrogate.peakModel?.predict(samples);
    const energy = options.surrogate.energyModel?.predict(samples);
    if (peak === undefined || energy === undefined) {
      throw new Error("Surrogate models for both peak load and energy are required");
    }
    return {
      peakHeatingLoad: peak,
      annualEnergy: energy,
    };
  }

  const scenario = options.scenarioBuilder(samples);
  return evaluateScenario(scenario);
}

function createLoadTracker(dtHours: number): { observer: StepObserver; finalize: () => MonteCarloRunMetrics } {
  let peakHeatingLoad = 0;
  let energyWh = 0;

  const observer: StepObserver = ({ nodes }) => {
    let stepHeating = 0;
    for (const snapshot of nodes) {
      const heating = Math.max(0, -snapshot.netPower);
      stepHeating += heating;
    }
    if (stepHeating > peakHeatingLoad) {
      peakHeatingLoad = stepHeating;
    }
    energyWh += stepHeating * dtHours;
  };

  return {
    observer,
    finalize: () => ({
      peakHeatingLoad,
      annualEnergy: energyWh / 1000,
    }),
  };
}

function sampleParameters(parameters: UncertainParameter[], rng: Mulberry32): Record<string, number> {
  const samples: Record<string, number> = {};
  for (const param of parameters) {
    samples[param.name] = sampleFromDistribution(param.distribution, rng);
  }
  return samples;
}

function computeStats(values: number[]): SummaryStats {
  if (!values.length) {
    return { mean: 0, stdDev: 0, p5: 0, p50: 0, p95: 0 };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.length > 1
      ? values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (values.length - 1)
      : 0;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean,
    stdDev: Math.sqrt(variance),
    p5: quantile(sorted, 0.05),
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
  };
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

function sampleFromDistribution(distribution: DistributionDefinition, rng: Mulberry32): number {
  switch (distribution.kind) {
    case "uniform":
      return distribution.min + rng.next() * (distribution.max - distribution.min);
    case "normal":
      return distribution.mean + distribution.stdDev * rng.nextGaussian();
    default: {
      const exhaustive: never = distribution;
      throw new Error(`Unsupported distribution kind: ${(exhaustive as { kind?: string }).kind ?? "unknown"}`);
    }
  }
}

function distributionBounds(
  distribution: DistributionDefinition,
  override?: { min: number; max: number }
): { min: number; max: number } {
  if (override) {
    return override;
  }
  switch (distribution.kind) {
    case "uniform":
      return { min: distribution.min, max: distribution.max };
    case "normal":
      return { min: distribution.mean - 3 * distribution.stdDev, max: distribution.mean + 3 * distribution.stdDev };
    default: {
      const exhaustive: never = distribution;
      throw new Error(`Unsupported distribution kind: ${(exhaustive as { kind?: string }).kind ?? "unknown"}`);
    }
  }
}

function runMorris(options: MonteCarloOptions, config: MonteCarloMorrisConfig): MorrisResult {
  const parameterDefs: MorrisParameterDefinition[] = options.parameters.map((param) => {
    const bounds = distributionBounds(param.distribution, config.parameterBounds?.[param.name]);
    return { name: param.name, min: bounds.min, max: bounds.max };
  });

  const evaluator = (inputs: Record<string, number>): number => {
    const metrics = evaluateFromSamples(inputs, options);
    return config.targetMetric === "peakHeatingLoad" ? metrics.peakHeatingLoad : metrics.annualEnergy;
  };

  return runMorrisAnalysis({
    parameters: parameterDefs,
    levels: config.levels,
    trajectories: config.trajectories,
    seed: config.seed,
    evaluator,
  });
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
