import type { BuildingModel } from "../../entities/geometry/types";
import type { SmartModelSnapshot } from "../networks/intelligence";
import type { ThermalSimulationResult } from "../thermal/solver";

export type AIWarningCode = "insufficient_ventilation" | "incorrect_pipe_diameter" | "abnormal_pressure";
export type AISeverity = "info" | "warning" | "critical";
export type AIRecommendationPriority = "low" | "medium" | "high";

export interface AIWarning {
  id: string;
  code: AIWarningCode;
  severity: AISeverity;
  title: string;
  message: string;
  entityId?: string;
  entityType?: "room" | "pipe" | "duct" | "sensor";
  metrics: Record<string, number>;
}

export interface AIRecommendation {
  id: string;
  priority: AIRecommendationPriority;
  title: string;
  action: string;
  rationale: string;
  relatedWarningIds: string[];
}

export interface ModelAnalysisSummary {
  roomCount: number;
  totalArea_m2: number;
  totalPipeLength_m: number;
  totalDuctLength_m: number;
  averagePipePressurePa: number;
  warningCount: number;
}

export interface ModelAnalysisResult {
  module: "modelAnalyzer";
  timestamp: number;
  warnings: AIWarning[];
  recommendations: AIRecommendation[];
  summary: ModelAnalysisSummary;
}

export interface ModelAnalyzerOptions {
  minVentilationFlowPerArea_m3_s_m2?: number;
  minPipeVelocity_m_s?: number;
  maxPipeVelocity_m_s?: number;
  minPipePressurePa?: number;
  maxPipePressurePa?: number;
  minSensorPressurePa?: number;
  maxSensorPressurePa?: number;
}

export interface EnergySimulationInput {
  roomArea_m2: number;
  insulationCoefficient_W_m2K: number;
  temperatureDifference_C: number;
  ventilationAirflow_m3_s: number;
}

export interface EnergyZoneSimulation extends EnergySimulationInput {
  zoneId: string;
  zoneName?: string;
  heatingDemand_W: number;
  coolingDemand_W: number;
  ventilationEnergy_W: number;
  totalLoad_W: number;
}

export interface EnergySimulationResult {
  module: "energySimulation";
  timestamp: number;
  inputs: {
    zoneCount: number;
    totalArea_m2: number;
    averageInsulationCoefficient_W_m2K: number;
    designTemperatureDifference_C: number;
    totalVentilationAirflow_m3_s: number;
  };
  zones: EnergyZoneSimulation[];
  totals: {
    heatingDemand_W: number;
    coolingDemand_W: number;
    ventilationEnergy_W: number;
    peakDemand_W: number;
  };
}

export interface DigitalTwinRoomState {
  roomId: string;
  roomName: string;
  temperature_C: number;
  airflow_m3_s: number;
  pressure_Pa: number | null;
}

export interface DigitalTwinState {
  module: "digitalTwin";
  timestamp: number;
  refreshIntervalMs: number;
  rooms: DigitalTwinRoomState[];
  sensors: SmartModelSnapshot["sensorStates"];
  networks: SmartModelSnapshot["networkStates"];
  events: SmartModelSnapshot["events"];
}

export interface DigitalTwinInput {
  model: BuildingModel;
  thermalResult?: ThermalSimulationResult | null;
  timestamp?: number;
  forceRefresh?: boolean;
}

export interface AIAssistantResult {
  module: "assistant";
  timestamp: number;
  question: string;
  answer: string;
  recommendations: string[];
  relatedWarningIds: string[];
}

export interface AIEngineSnapshot {
  warnings: AIWarning[];
  recommendations: AIRecommendation[];
  energySimulation: EnergySimulationResult | null;
  digitalTwin: DigitalTwinState | null;
}

export interface AIAssistantContext {
  model?: BuildingModel | null;
  analysis?: ModelAnalysisResult | null;
  energySimulation?: EnergySimulationResult | null;
  digitalTwin?: DigitalTwinState | null;
}
