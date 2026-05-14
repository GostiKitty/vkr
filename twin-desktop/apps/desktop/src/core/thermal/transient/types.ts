import type { ConstructionLayer } from "../../../entities/geometry/types";

export interface TransientLayer {
  id: string;
  materialId: string;
  name: string;
  thickness_m: number;
  lambda_W_mK: number;
  density_kg_m3: number;
  heatCapacity_J_kgK: number;
  nodesCount?: number;
}

export type TransientBoundaryValue = number | ((time_s: number) => number);

export interface TransientBoundaryCondition {
  kind: "temperature" | "heatFlux" | "convection";
  temperature_C?: TransientBoundaryValue;
  heatFlux_W_m2?: TransientBoundaryValue;
  ambientTemperature_C?: TransientBoundaryValue;
  alpha_W_m2K?: number;
}

export interface TransientInitialCondition {
  kind: "uniform" | "profile";
  temperature_C?: number;
  profile?: Array<{ x_m: number; temperature_C: number }>;
}

export interface TransientScenario {
  id: string;
  name: string;
  description: string;
  duration_s: number;
  timeStep_s: number;
  initialCondition: TransientInitialCondition;
  innerBoundary: TransientBoundaryCondition;
  outerBoundary: TransientBoundaryCondition;
  internalHeatSource_W_m3?: number | ((x_m: number, time_s: number) => number);
}

export interface TransientCalculationMetadata {
  requestedTimeStep_s: number;
  usedTimeStep_s: number;
  stabilityLimit_s: number | null;
  stabilityRatioMax?: number | null;
  requestedScheme?: "explicit" | "implicit";
  selectedTimeIndex?: number;
  invalidReason?: string | null;
  implementationWarnings?: string[];
  innerBoundaryTemperature_C?: number[];
  outerBoundaryTemperature_C?: number[];
}

export interface TransientCalculationResult {
  scenarioId: string;
  stable: boolean;
  valid: boolean;
  scheme: "explicit" | "implicit";
  warnings: string[];
  nodes: number[];
  time: number[];
  temperature: number[][];
  innerSurfaceTemperature: number[];
  outerSurfaceTemperature: number[];
  minTemperature: number;
  maxTemperature: number;
  minInnerSurfaceTemperature: number;
  maxInnerSurfaceTemperature: number;
  timeBelowLimit_s?: number;
  metadata: TransientCalculationMetadata;
}

export interface TransientFrame {
  time_s: number;
  nodes: number[];
  temperature: number[];
  innerSurfaceTemperature_C: number;
  outerSurfaceTemperature_C: number;
}

export interface TransientVisualizationFrame {
  sourceId: string;
  sourceType: "wall" | "roof" | "slab";
  time_s: number;
  innerSurfaceTemperature_C: number;
  outerSurfaceTemperature_C: number;
  profile: Array<{ x_m: number; temperature_C: number }>;
  minTemperature_C: number;
  maxTemperature_C: number;
  stable: boolean;
  warnings: string[];
}

export interface BuildTransientLayersResult {
  layers: TransientLayer[];
  warnings: string[];
  missingData: string[];
}

export interface TransientConstructionTarget {
  id: string;
  sourceType: "wall" | "roof" | "slab";
  sourceId: string;
  levelId: string;
  label: string;
  assemblyId?: string | null;
  layers?: ConstructionLayer[];
  fallbackThickness_m?: number;
  heatedSide?: "below" | "above";
}
