export type EngineeringEquipmentType =
  | "heatExchanger"
  | "pump"
  | "filter"
  | "valve"
  | "controlValve"
  | "expansionTank"
  | "manifold"
  | "heatMeter"
  | "automationCabinet"
  | "sensorTemperature"
  | "sensorPressure";

export type EngineeringPortDirection = "left" | "right" | "top" | "bottom";

export type EngineeringMedium = "supply" | "return" | "dhw" | "coldWater" | "drain" | "electric" | "signal";

export interface EngineeringPipePoint {
  x: number;
  y: number;
}

export interface EngineeringPort {
  id: string;
  x: number;
  y: number;
  direction: EngineeringPortDirection;
  medium: EngineeringMedium;
}

export type EngineeringParameterValue = string | number | boolean | null;
export type EngineeringEquipmentParameters = Record<string, EngineeringParameterValue>;

export interface EngineeringEquipment {
  id: string;
  type: EngineeringEquipmentType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  ports: EngineeringPort[];
  parameters: EngineeringEquipmentParameters;
  metadata: Record<string, unknown>;
  levelId?: string | null;
}

export interface EngineeringPipe {
  id: string;
  fromEquipmentId: string;
  fromPortId: string;
  toEquipmentId: string;
  toPortId: string;
  points: EngineeringPipePoint[];
  medium: EngineeringMedium;
  diameter: number;
  insulation: number;
  temperature: number | null;
  flowRate: number | null;
  metadata?: Record<string, unknown>;
  levelId?: string | null;
}

export interface EngineeringSystemsModel {
  equipment: EngineeringEquipment[];
  pipes: EngineeringPipe[];
}

export const createEmptyEngineeringSystems = (): EngineeringSystemsModel => ({
  equipment: [],
  pipes: [],
});
