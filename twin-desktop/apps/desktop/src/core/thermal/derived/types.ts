import type { HydronicAssessment } from "../engineering/types";

export type DerivedMetricSource =
  | "solver"
  | "engineering-derived"
  | "SP50-derived"
  | "user input"
  | "fallback";

export type DerivedMetricContour =
  | "rc-runtime"
  | "derived-only"
  | "normative-check"
  | "monte-carlo"
  | "transient-1d"
  | "report-only"
  | "heuristic"
  | "legacy";

export type DerivedMetricStatus =
  | "main-runtime"
  | "derived-only"
  | "normative-check"
  | "report-only"
  | "heuristic"
  | "legacy";

export interface DerivedMetricValue<T = number | boolean | string | null> {
  value: T;
  unit: string | null;
  source: DerivedMetricSource;
  contour: DerivedMetricContour;
  affectsMainSolver: boolean;
  assumptions: string[];
  warnings: string[];
  status: DerivedMetricStatus;
}

export interface DerivedBalanceLine {
  id: string;
  label: string;
  valueW: number | null;
  source: DerivedMetricSource;
  contour: DerivedMetricContour;
  affectsMainSolver: boolean;
  warnings: string[];
}

export interface DerivedTimeConstantZone {
  zoneId: string;
  zoneName: string;
  tauHours: DerivedMetricValue<number | null>;
  capacitance_J_K: DerivedMetricValue<number | null>;
  heatLossCoefficient_W_K: DerivedMetricValue<number | null>;
}

export interface DerivedFreeCoolingPoint {
  hours: number;
  temperatureC: DerivedMetricValue<number | null>;
}

export interface DerivedSpecificIndicators {
  qArea_W_m2: DerivedMetricValue<number | null>;
  qVolume_W_m3: DerivedMetricValue<number | null>;
  qVolumeDeltaT_W_m3K: DerivedMetricValue<number | null>;
}

export interface DerivedVentilationRecovery {
  efficiency: DerivedMetricValue<number | null>;
  ventilationLossBeforeRecovery_W: DerivedMetricValue<number | null>;
  ventilationLossAfterRecovery_W: DerivedMetricValue<number | null>;
  savedByRecovery_W: DerivedMetricValue<number | null>;
}

export interface DerivedNormativeVentilationCheck {
  requiredFlowM3H: DerivedMetricValue<number | null>;
  providedFlowM3H: DerivedMetricValue<number | null>;
  deficitFlowM3H: DerivedMetricValue<number | null>;
  affectsSolverNow: boolean;
}

export interface DerivedRcDiagnostics {
  transmissionHeatLossCoefficient_W_K: DerivedMetricValue<number | null>;
  infiltrationHeatLossCoefficient_W_K: DerivedMetricValue<number | null>;
  ventilationHeatLossCoefficient_W_K: DerivedMetricValue<number | null>;
  totalHeatLossCoefficient_W_K: DerivedMetricValue<number | null>;
  buildingTauHours: DerivedMetricValue<number | null>;
  zoneTauHours: DerivedTimeConstantZone[];
  freeCooling: DerivedFreeCoolingPoint[];
  specificIndicators: DerivedSpecificIndicators;
  ventilationRecovery: DerivedVentilationRecovery;
  normativeVentilation: DerivedNormativeVentilationCheck;
  balanceLines: DerivedBalanceLine[];
  hydronic: HydronicAssessment | null;
}

export type SurfaceTemperatureFactorStatus = "normal" | "cold_surface_risk" | "mold_risk_possible";

export type TwinValidationStatus = "no_data" | "insufficient_data" | "valid";

export interface BuildingPerformanceElementInput {
  id: string;
  label?: string;
  U_W_m2K: number | null;
  areaM2: number | null;
  /** Если true — элемент уже учитывает неоднородность (R_red) и не должен дублироваться с ψ/χ. */
  usesReducedResistance?: boolean;
}

export interface TemperatureSeriesPoint {
  timeHours: number;
  temperatureC: number;
}

export interface ValidationSeriesPoint {
  timestamp?: number;
  timeHours?: number;
  value: number;
}

export interface BuildingPerformanceHeatLossBreakdown {
  H_tr: DerivedMetricValue<number | null>;
  H_ve: DerivedMetricValue<number | null>;
  H_psi: DerivedMetricValue<number | null>;
  H_chi: DerivedMetricValue<number | null>;
  H_total: DerivedMetricValue<number | null>;
}

export interface BuildingPerformanceZoneDegreeHours {
  zoneId: string;
  zoneName: string;
  value: DerivedMetricValue<number | null>;
}

export interface BuildingPerformanceOperativeZone {
  zoneId: string;
  zoneName: string;
  T_op: DerivedMetricValue<number | null>;
  T_air: DerivedMetricValue<number | null>;
  T_mrt: DerivedMetricValue<number | null>;
}

export interface BuildingPerformanceSurfaceFactor {
  surfaceId: string;
  label: string;
  f_Rsi: DerivedMetricValue<number | null>;
  tau_si_C: DerivedMetricValue<number | null>;
  status: SurfaceTemperatureFactorStatus | null;
}

export interface BuildingPerformancePipeLoss {
  pipeId: string;
  label: string;
  roomId: string | null;
  Q_pipe_loss_W: DerivedMetricValue<number | null>;
  Q_pipe_gain_to_room_W: DerivedMetricValue<number | null>;
}

export interface BuildingPerformanceCo2 {
  CO2_kg: DerivedMetricValue<number | null>;
  CO2_tonnes: DerivedMetricValue<number | null>;
  emissionFactor: DerivedMetricValue<number | null>;
  energySource: DerivedMetricValue<string | null>;
  energyKWh: DerivedMetricValue<number | null>;
}

export interface BuildingPerformanceValidation {
  MBE_percent: DerivedMetricValue<number | null>;
  CVRMSE_percent: DerivedMetricValue<number | null>;
  RMSE_T_C: DerivedMetricValue<number | null>;
  sampleCount: DerivedMetricValue<number | null>;
  validationPeriod: DerivedMetricValue<string | null>;
  status: TwinValidationStatus;
}

export type DataRequirementSourceCategory =
  | "buildingModel"
  | "scenarioConfig"
  | "computedAutomatically"
  | "diagnosticsThermalResult"
  | "thermalProtectionSp50"
  | "fallbackDefault"
  | "missingUserInput";

export type DataCompletenessSectionId =
  | "geometry"
  | "materials"
  | "climate"
  | "operation"
  | "airExchange"
  | "humidity"
  | "engineeringNetworks"
  | "economy"
  | "ecology"
  | "validation";

export interface MetricRequirementInput {
  key: string;
  label: string;
  section: DataCompletenessSectionId;
  sourceCategory: DataRequirementSourceCategory;
  sourcePath: string;
  present: boolean;
  required: boolean;
  warnings: string[];
}

export interface MetricDataRequirementsMap {
  metricId: string;
  formula: string;
  requiredInputs: MetricRequirementInput[];
  optionalInputs: MetricRequirementInput[];
  computedInputs: MetricRequirementInput[];
  sourcePath: string;
  fallbackAllowed: boolean;
  warningIfFallback: string | null;
  canCalculateNow: boolean;
  missingFields: string[];
  affectsMainSolver: boolean;
}

export type DataCompletenessStatus = "complete" | "partial" | "fallback" | "needs_input";

export interface DataCompletenessSectionSummary {
  id: DataCompletenessSectionId;
  label: string;
  status: DataCompletenessStatus;
  requiredCount: number;
  availableCount: number;
  fallbackCount: number;
  missingFields: string[];
  warnings: string[];
  fields: MetricRequirementInput[];
}

export interface InputDataCompletenessAudit {
  metrics: MetricDataRequirementsMap[];
  sections: DataCompletenessSectionSummary[];
  generatedWarnings: string[];
}

export interface BuildingPerformanceDiagnostics {
  compactness: DerivedMetricValue<number | null>;
  windowToWallRatio: DerivedMetricValue<number | null>;
  windowToWallRatioPercent: DerivedMetricValue<number | null>;
  equivalentUValue: DerivedMetricValue<number | null>;
  heatLossBreakdown: BuildingPerformanceHeatLossBreakdown;
  degreeHoursUnderheat: {
    building: DerivedMetricValue<number | null>;
    zones: BuildingPerformanceZoneDegreeHours[];
  };
  degreeHoursOverheat: {
    building: DerivedMetricValue<number | null>;
    zones: BuildingPerformanceZoneDegreeHours[];
  };
  operativeTemperature: {
    zones: BuildingPerformanceOperativeZone[];
  };
  surfaceTemperatureFactor: {
    surfaces: BuildingPerformanceSurfaceFactor[];
  };
  pipeHeatLoss: {
    pipes: BuildingPerformancePipeLoss[];
  };
  co2: BuildingPerformanceCo2;
  validation: BuildingPerformanceValidation;
  dataRequirementsAudit: InputDataCompletenessAudit;
}

export interface BuildBuildingPerformanceDiagnosticsOptions {
  comfortMinC?: number | null;
  comfortMaxC?: number | null;
  emissionFactorKgPerKWh?: number | null;
  annualEnergyKWh?: number | null;
  energySourceLabel?: string | null;
  measuredSeries?: ValidationSeriesPoint[] | null;
  simulatedSeries?: ValidationSeriesPoint[] | null;
  timestepSeconds?: number;
}
