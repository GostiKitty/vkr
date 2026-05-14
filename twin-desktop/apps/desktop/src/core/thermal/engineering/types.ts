import type { Sp50ComplianceReport } from "../sp50/types";

import type { Sp50ConstructionType, WallLayer } from "../../../entities/geometry/types";

export type EngineeringCalculationMode = "quick" | "engineering";
export type EngineeringConfidenceLevel = "high" | "medium" | "low";
export type EngineeringDataOrigin = "measured" | "user" | "default" | "derived";
export type EnvelopeElementKind = "wall" | "window" | "door" | "floor" | "roof";
export type FieldModelKind = "fast" | "detailed";
export type ValidationSeverity = "error" | "warning" | "info";
export type EngineeringUiTone = "neutral" | "good" | "warning" | "critical";

export interface EngineeringSurfaceResistanceProfile {
  label: string;
  internal_m2K_W: number;
  external_m2K_W: number;
  source: string;
}

export interface EngineeringGridOptions {
  cellSizeM: number;
  maxIterations: number;
  toleranceC: number;
  anchorWeight: number;
  smoothingPasses: number;
}

export interface EngineeringScenarioDraft {
  name: string;
  outdoorDeltaC: number;
  insulationResistanceDelta_m2K_W: number;
  windowUScale: number;
  ventilationMultiplier: number;
  radiatorPowerMultiplier: number;
  equipmentGainMultiplier: number;
}

export interface EngineeringOptions {
  mode?: EngineeringCalculationMode;
  analysisTimeHours?: number;
  targetLevelId?: string | null;
  targetTemperatureC?: number;
  ventilationACH?: number;
  supplyAirTemperatureC?: number | null;
  floorU_W_m2K?: number;
  roofU_W_m2K?: number;
  windowU_W_m2K?: number;
  doorU_W_m2K?: number;
  groundTemperatureC?: number;
  solarIrradianceW_m2?: number;
  solarTransmittance?: number;
  solarShadingFactor?: number;
  lightingGain_W_m2?: number;
  occupancyGain_W_m2?: number;
  peopleCount?: number | null;
  peopleSensibleGainW?: number;
  radiatorPowerMultiplier?: number;
  equipmentGainMultiplier?: number;
  effectiveMassFactor?: number;
  surfaceResistances?: EngineeringSurfaceResistanceProfile;
  grid?: Partial<EngineeringGridOptions>;
  scenarioDraft?: Partial<EngineeringScenarioDraft>;
}

export interface ResolvedEngineeringOptions extends Omit<Required<EngineeringOptions>, "surfaceResistances" | "grid" | "scenarioDraft"> {
  surfaceResistances: EngineeringSurfaceResistanceProfile;
  grid: EngineeringGridOptions;
  scenarioDraft: EngineeringScenarioDraft;
}

export interface EngineeringInputSource {
  label: string;
  origin: EngineeringDataOrigin;
  editable: boolean;
  note: string;
}

export interface EngineeringValidationIssue {
  id: string;
  severity: ValidationSeverity;
  scope: string;
  message: string;
  recommendation?: string;
}

export interface EnvelopeFormulaBreakdown {
  formula: string;
  substitution: string;
  units: string;
  applicability: string;
}

export interface EnvelopeElementResult {
  id: string;
  label: string;
  roomId: string;
  roomName: string;
  levelId: string;
  kind: EnvelopeElementKind;
  constructionType?: Sp50ConstructionType | null;
  sourceType?: "wall" | "roof" | "slab" | "window" | "door";
  sourceId?: string;
  layers?: WallLayer[];
  orientation: string | null;
  areaM2: number;
  boundaryTemperatureC: number;
  internalTemperatureC: number;
  deltaTC: number;
  layerResistance_m2K_W: number;
  internalSurfaceResistance_m2K_W: number;
  externalSurfaceResistance_m2K_W: number;
  totalResistance_m2K_W: number;
  uValue_W_m2K: number;
  heatFluxW: number;
  heatFluxDensity_W_m2: number;
  assumed: boolean;
  formulaBreakdown: EnvelopeFormulaBreakdown;
  assumptions: string[];
}

export interface HeatGainResult {
  id: string;
  label: string;
  kind: "heating" | "lighting" | "occupancy" | "equipment" | "pipes" | "solar" | "other";
  roomId: string | null;
  roomName: string;
  powerW: number;
  participationFactor: number;
  effectivePowerW: number;
  scheduleLabel: string;
  assumptions: string[];
}

export interface RoomBalanceResult {
  roomId: string;
  roomName: string;
  levelId: string;
  areaM2: number;
  volumeM3: number;
  airTemperatureC: number;
  setpointC: number;
  heatingDeliveredW: number;
  heatingCapacityW: number;
  lightingGainW: number;
  occupancyGainW: number;
  equipmentGainW: number;
  pipeGainW: number;
  solarGainW: number;
  ventilationLossW: number;
  transmissionLossW: number;
  adjacentExchangeW: number;
  passiveBalanceW: number;
}

export interface EngineeringBalanceSummary {
  transmissionLossW: number;
  floorLossW: number;
  roofLossW: number;
  windowLossW: number;
  wallLossW: number;
  doorLossW: number;
  ventilationLossW: number;
  infiltrationLossW: number;
  totalLossW: number;
  passiveGainsW: number;
  solarGainW: number;
  internalGainsW: number;
  heatingDeliveredW: number;
  installedHeatingCapacityW: number;
  netBalanceW: number;
  requiredHeatingW: number;
  surplusW: number;
  totalUA_W_K: number;
  effectiveCapacitance_J_K: number;
}

export interface EngineeringFieldCell {
  row: number;
  col: number;
  x: number;
  y: number;
  temperatureC: number;
  roomId: string;
}

export interface EngineeringFieldZone {
  label: string;
  roomId: string | null;
  x: number;
  y: number;
  temperatureC: number;
  category: "cold" | "hot" | "wall" | "window" | "corner" | "occupied";
}

export interface EngineeringZoneInsight {
  id: string;
  category: "cold" | "hot" | "occupied" | "wall" | "window" | "heating";
  title: string;
  roomId: string | null;
  roomName: string;
  x: number;
  y: number;
  temperatureC: number;
  deltaFromAverageC: number;
  reason: string;
  severity: "info" | "warning" | "critical";
  pointCount: number;
}

export interface EngineeringStatusSummary {
  id: string;
  label: string;
  status: string;
  explanation: string;
  tone: EngineeringUiTone;
}

export interface EngineeringMetricInsight {
  id: string;
  label: string;
  value: string;
  unit: string;
  explanation: string;
  target?: string;
  tone: EngineeringUiTone;
}

export interface EngineeringRecommendation {
  id: string;
  title: string;
  explanation: string;
  tone: EngineeringUiTone;
}

export interface EngineeringPresentationSummary {
  summaryLines: string[];
  metrics: EngineeringMetricInsight[];
  statuses: {
    comfort: EngineeringStatusSummary;
    reliability: EngineeringStatusSummary;
    heating: EngineeringStatusSummary;
    heatLoss: EngineeringStatusSummary;
    uniformity: EngineeringStatusSummary;
  };
  recommendations: EngineeringRecommendation[];
  dominantLossLabel: string;
}

export interface EngineeringFieldResult {
  kind: FieldModelKind;
  levelId: string | null;
  rows: number;
  cols: number;
  cellSizeM: number;
  toleranceC: number;
  maxIterations: number;
  minTemperatureC: number;
  maxTemperatureC: number;
  averageTemperatureC: number;
  converged: boolean;
  iterations: number;
  residualC: number;
  sourceCount: number;
  cells: EngineeringFieldCell[];
  hotspots: EngineeringFieldZone[];
  coldspots: EngineeringFieldZone[];
  occupiedZone: EngineeringFieldZone[];
  wallBand: EngineeringFieldZone[];
  windowBand: EngineeringFieldZone[];
  cornerPoints: EngineeringFieldZone[];
}

export interface EngineeringComfortSummary {
  targetTemperatureC: number;
  meanAirTemperatureC: number;
  occupiedMeanTemperatureC: number;
  deviationFromTargetC: number;
  occupiedBandSpreadC: number;
  fieldSpreadC: number;
  standardDeviationC: number;
  localColdRisk: boolean;
  localOverheatRisk: boolean;
  rating: "comfortable" | "attention" | "critical";
  explanation: string;
}

export interface EngineeringForecastPoint {
  timeHours: number;
  outdoorTemperatureC: number;
  setpointTemperatureC: number;
  indoorTemperatureC: number;
  heatingPowerW: number;
  lossPowerW: number;
  passiveGainsW: number;
}

export interface EngineeringScenarioResult {
  id: string;
  label: string;
  description: string;
  assumptions: string[];
  points: EngineeringForecastPoint[];
  summary: {
    peakHeatingKW: number;
    totalHeatingKWh: number;
    minTemperatureC: number;
    maxTemperatureC: number;
    finalTemperatureC: number;
    warmupHoursToTarget: number | null;
  };
  delta: {
    peakHeatingKW: number;
    totalHeatingKWh: number;
    finalTemperatureC: number;
  };
}

export interface EngineeringSensitivityEntry {
  id: string;
  parameter: string;
  unit: string;
  baseValue: number;
  perturbedValue: number;
  deltaInputPercent: number;
  deltaHeatingW: number;
  deltaHeatingPercent: number;
  sensitivityIndex: number;
  methodName: string;
  formula: string;
  normalizedImpact: number;
  explanation: string;
}

export interface EngineeringMethodEntry {
  id: string;
  title: string;
  classification: "physical model" | "engineering approximation";
  formula: string;
  variables: Array<{ symbol: string; description: string; unit: string }>;
  explanation: string;
  physicalMeaning: string;
  resultMeaning: string;
  assumptions: string[];
  applicability: string;
  limitations: string;
}

export interface EngineeringConfidenceSummary {
  level: EngineeringConfidenceLevel;
  defaultsUsed: number;
  userInputs: number;
  derivedInputs: number;
  measuredInputs: number;
  rationale: string[];
}

export interface EngineeringAnalysisResult {
  timestampIso: string;
  options: ResolvedEngineeringOptions;
  inputs: EngineeringInputSource[];
  validation: EngineeringValidationIssue[];
  envelope: EnvelopeElementResult[];
  gains: HeatGainResult[];
  rooms: RoomBalanceResult[];
  balance: EngineeringBalanceSummary;
  fastField: EngineeringFieldResult | null;
  detailedField: EngineeringFieldResult | null;
  zoneInsights: EngineeringZoneInsight[];
  presentation: EngineeringPresentationSummary;
  comfort: EngineeringComfortSummary;
  scenarios: EngineeringScenarioResult[];
  sensitivity: EngineeringSensitivityEntry[];
  methodology: EngineeringMethodEntry[];
  confidence: EngineeringConfidenceSummary;
  sp50: Sp50ComplianceReport | null;
  performanceMs: number;
}
