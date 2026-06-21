export type EngineeringEquipmentType =
  | "heatExchanger"
  | "pump"
  | "filter"
  | "valve"
  | "checkValve"
  | "controlValve"
  | "expansionTank"
  | "manifold"
  | "heatMeter"
  | "automationCabinet"
  | "sensorTemperature"
  | "sensorPressure"
  // АВОК СТО НП 1.05-2006
  | "gateValve"         // Задвижка 2.8.03
  | "ballValve"         // Кран шаровой 2.8.05
  | "threeWayValve"     // Кран трёхходовой 2.8.08
  | "balancingValve"    // Клапан балансировочный ручной 2.8.13
  | "safetyValve"       // Клапан предохранительный 2.8.23
  | "pressureRegulator" // Регулятор перепада давления 2.8.20
  | "thermostaticValve" // Терморегулятор радиаторный 2.8.19
  | "flowMeter"         // Расходомер 2.9.04
  | "convector"         // Конвектор 3.1.04
  | "sensorFlow"        // Датчик расхода 5.1.07
  | "sensorHumidity"    // Датчик влажности 5.1.09
  // Воздушные сети
  | "airHandlingUnit"
  | "ductFan"
  | "roofFan"
  | "airDamper"
  | "airCheckValve"
  | "fireDamper"
  | "airFilter"
  | "airFlowRegulatorConst"
  | "airFlowRegulatorVar"
  | "silencer"
  | "airHeater"
  | "airCooler"
  | "airHumidifier"
  | "airDehumidifier"
  | "supplyDiffuser"
  | "exhaustGrille";

export type EngineeringPortDirection = "left" | "right" | "top" | "bottom";

export type EngineeringMedium =
  | "supply"
  | "return"
  | "dhw"
  | "coldWater"
  | "drain"
  | "electric"
  | "signal"
  | "airSupply"
  | "airExhaust";

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
