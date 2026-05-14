import type {
  BuildingEvent,
  DuctNetwork,
  Equipment,
  NetworkKind,
  OperationalScenario,
  PipeNetwork,
  SensorDevice,
} from "../../entities/networks/types";

export interface NetworkLengthSummary {
  totalLength_m: number;
  branchCount: number;
}

export interface PipeNetworkSummary extends NetworkLengthSummary {
  totalFlow_kg_s: number;
  averageFluidTemperatureC: number;
  estimatedPressureDropPa: number;
  simplified: boolean;
}

export interface DuctNetworkSummary extends NetworkLengthSummary {
  totalAirflow_m3_s: number;
  averageAirVelocity_m_s: number;
  estimatedPressureDropPa: number;
  simplified: boolean;
}

export interface RoomEquipmentImpact {
  roomId: string;
  heatEmissionW: number;
  supplyAir_m3_s: number;
}

export interface SensorSnapshot {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  status: SensorDevice["status"];
}

export interface NetworkScenarioSnapshot {
  scenario: OperationalScenario;
  activeEquipment: number;
  alarmEquipment: number;
}

export interface BuildingSystemsSnapshot {
  pipes: PipeNetwork[];
  ducts: DuctNetwork[];
  equipment: Equipment[];
  sensors: SensorDevice[];
  events: BuildingEvent[];
  activeScenario: OperationalScenario | null;
}

export interface ConnectedComponent {
  id: string;
  kind: NetworkKind;
  nodeIds: string[];
}
