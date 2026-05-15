export interface PlanPoint {
  x: number;
  y: number;
}

export type NetworkSystemType = "heating" | "water" | "ventilation" | "custom";
export type PipeSystemType = "heating_supply" | "heating_return" | "dhw" | "chw";
export type PipeMaterial = "steel" | "pex" | "copper" | "polypropylene";
export type PipeMarkingColor = "gost_supply" | "gost_return" | "gost_dhw" | "gost_chw" | "neutral";
export type HeatCarrierType = "water" | "glycol";
export type HeatingSystemKind = "two_pipe" | "single_pipe" | "collector";
export type PipeFlowRole = "supply" | "return" | "distribution";
export type PipeCircuitRole = "supply" | "return" | "mixed" | "unknown";
export type PipeSegmentClass = "main" | "branch" | "riser" | "collector" | "connection";
export type FlowDirection = "forward" | "backward" | "unknown";
export type HeatingConnectionType = "side" | "bottom" | "diagonal" | "collector";
export type DuctSectionShape = "rectangular" | "round";
export type EquipmentType =
  | "radiator"
  | "fancoil"
  | "ahu"
  | "pump"
  | "boiler"
  | "heat_exchanger"
  | "elevator"
  | "expansion_tank"
  | "dirt_separator"
  | "diffuser"
  | "sensor";
export type EquipmentState = "on" | "off" | "alarm";
export type SensorType = "temperature" | "humidity" | "co2" | "pressure" | "flow" | "leak";
export type SensorStatus = "normal" | "warning" | "alarm";
export type OperationalScenarioKind = "workday" | "night" | "winter" | "summer" | "emergency" | "economy";
export type BuildingEventType = "leak" | "equipment_fault" | "overheat" | "network_break" | "co2_high";
export type BuildingEventSeverity = "info" | "warning" | "critical";
export type NetworkKind = "pipe" | "duct";

export interface PolylineEntity {
  id: string;
  levelId: string;
  path: PlanPoint[];
}

export interface PipeNetwork extends PolylineEntity {
  type: PipeSystemType;
  heatingSystemId?: string | null;
  systemType?: NetworkSystemType;
  heatingSystemKind?: HeatingSystemKind;
  flowRole?: PipeFlowRole;
  circuitRole?: PipeCircuitRole;
  segmentClass?: PipeSegmentClass;
  flowDirection?: FlowDirection;
  markingColor?: PipeMarkingColor;
  heatCarrier?: HeatCarrierType;
  diameter_mm: number;
  innerDiameter_mm?: number;
  material: PipeMaterial;
  insulationThickness_mm?: number;
  insulationConductivity_W_mK?: number;
  roughness_mm?: number;
  fluidTemperatureC: number;
  designIndoorTemperatureC?: number;
  designOutdoorTemperatureC?: number;
  temperatureDropC?: number;
  flowRate_kg_s: number;
  designVelocity_m_s?: number;
  pressurePa: number;
  pressureDropPa?: number;
  heatLossW?: number;
  connectedEquipmentIds: string[];
}

export interface DuctNetwork extends PolylineEntity {
  section: {
    shape: DuctSectionShape;
    width_mm?: number;
    height_mm?: number;
    diameter_mm?: number;
  };
  airflow_m3_s: number;
  airVelocity_m_s: number;
  connectedEquipmentIds: string[];
}

export interface EquipmentParameters {
  nominalPowerW?: number;
  designFlow_kg_s?: number;
  designAirflow_m3_s?: number;
  headPa?: number;
  supplyTemperatureC?: number;
  returnTemperatureC?: number;
  designIndoorTemperatureC?: number;
  designOutdoorTemperatureC?: number;
  connectionType?: HeatingConnectionType;
  assignedSystemId?: string | null;
  pressureDropPa?: number;
  efficiency?: number;
  note?: string;
}

export interface Equipment {
  id: string;
  type: EquipmentType;
  position: PlanPoint;
  levelId: string;
  roomId: string | null;
  state: EquipmentState;
  params: EquipmentParameters;
  connectedNetworkIds: string[];
}

export interface SensorReading {
  timestamp: number;
  value: number;
}

export interface SensorDevice {
  id: string;
  type: SensorType;
  position: PlanPoint;
  levelId: string;
  roomId: string | null;
  value: number | null;
  unit: string;
  status: SensorStatus;
  history: SensorReading[];
}

export interface ScenarioImpact {
  setpointOffsetC: number;
  equipmentStateOverrides: Partial<Record<EquipmentType, EquipmentState>>;
  networkFlowMultiplier: number;
  heatLoadMultiplier: number;
}

export interface OperationalScenario {
  id: string;
  kind: OperationalScenarioKind;
  name: string;
  description: string;
  impact: ScenarioImpact;
}

export interface BuildingEvent {
  id: string;
  type: BuildingEventType;
  severity: BuildingEventSeverity;
  title: string;
  message: string;
  timestamp: number;
  relatedId?: string;
  relatedKind?: "room" | "wall" | "door" | "window" | "pipe" | "duct" | "equipment" | "sensor";
  levelId?: string | null;
  acknowledged: boolean;
}

export const PIPE_TYPE_LABELS: Record<PipeSystemType, string> = {
  heating_supply: "Подача отопления",
  heating_return: "Обратка отопления",
  dhw: "ГВС",
  chw: "ХВС",
};

export const NETWORK_SYSTEM_TYPE_LABELS: Record<NetworkSystemType, string> = {
  heating: "Отопление",
  water: "Водоснабжение",
  ventilation: "Вентиляция",
  custom: "Спецсистема",
};

export const PIPE_TYPE_COLORS: Record<PipeSystemType, string> = {
  heating_supply: "#c2410c",
  heating_return: "#2563eb",
  dhw: "#f97316",
  chw: "#38bdf8",
};

export const PIPE_MARKING_COLORS: Record<PipeMarkingColor, string> = {
  gost_supply: "#c2410c",
  gost_return: "#2563eb",
  gost_dhw: "#f97316",
  gost_chw: "#0284c7",
  neutral: "#64748b",
};

export const PIPE_MARKING_COLOR_LABELS: Record<PipeMarkingColor, string> = {
  gost_supply: "Отопление, подача",
  gost_return: "Отопление, обратка",
  gost_dhw: "ГВС",
  gost_chw: "ХВС",
  neutral: "Нейтральная маркировка",
};

export const HEATING_SYSTEM_KIND_LABELS: Record<HeatingSystemKind, string> = {
  two_pipe: "Двухтрубная",
  single_pipe: "Однотрубная",
  collector: "Коллекторная",
};

export const PIPE_FLOW_ROLE_LABELS: Record<PipeFlowRole, string> = {
  supply: "Подача",
  return: "Обратка",
  distribution: "Распределение",
};

export const PIPE_CIRCUIT_ROLE_LABELS: Record<PipeCircuitRole, string> = {
  supply: "Подача",
  return: "Обратка",
  mixed: "Смешанная",
  unknown: "Не определена",
};

export const PIPE_SEGMENT_CLASS_LABELS: Record<PipeSegmentClass, string> = {
  main: "Магистраль",
  branch: "Ветвь",
  riser: "Стояк",
  collector: "Коллектор",
  connection: "Подключение",
};

export const HEAT_CARRIER_LABELS: Record<HeatCarrierType, string> = {
  water: "Вода",
  glycol: "Водно-гликолевая смесь",
};

export const HEATING_CONNECTION_TYPE_LABELS: Record<HeatingConnectionType, string> = {
  side: "Боковое",
  bottom: "Нижнее",
  diagonal: "Диагональное",
  collector: "Коллекторная",
};

export const HEATING_PIPE_TYPES: PipeSystemType[] = ["heating_supply", "heating_return"];

export const FLOW_DIRECTION_LABELS: Record<FlowDirection, string> = {
  forward: "По трассе",
  backward: "Против трассы",
  unknown: "Не задано",
};

export function isHeatingPipeType(type: PipeSystemType): boolean {
  return type === "heating_supply" || type === "heating_return";
}

export function resolveNetworkSystemType(type: PipeSystemType): NetworkSystemType {
  if (type === "heating_supply" || type === "heating_return") {
    return "heating";
  }
  if (type === "dhw" || type === "chw") {
    return "water";
  }
  return "custom";
}

export function resolvePipeFlowRole(type: PipeSystemType): PipeFlowRole | null {
  if (type === "heating_supply") {
    return "supply";
  }
  if (type === "heating_return") {
    return "return";
  }
  return null;
}

export function resolvePipeCircuitRole(type: PipeSystemType): PipeCircuitRole {
  if (type === "heating_supply") {
    return "supply";
  }
  if (type === "heating_return") {
    return "return";
  }
  return "mixed";
}

export function normalizeFlowDirection(direction: FlowDirection | "reverse" | null | undefined): FlowDirection {
  if (direction === "forward" || direction === "backward" || direction === "unknown") {
    return direction;
  }
  if (direction === "reverse") {
    return "backward";
  }
  return "unknown";
}

export function resolvePipeColor(
  pipe: Pick<PipeNetwork, "type" | "markingColor" | "circuitRole" | "flowRole" | "systemType">
): string {
  if (pipe.markingColor) {
    return PIPE_MARKING_COLORS[pipe.markingColor];
  }
  const role = pipe.circuitRole ?? (pipe.flowRole === "supply" || pipe.flowRole === "return" ? pipe.flowRole : null);
  if (role === "supply") {
    return "#c2410c";
  }
  if (role === "return") {
    return "#2563eb";
  }
  if (pipe.systemType === "ventilation") {
    return "#475569";
  }
  return PIPE_TYPE_COLORS[pipe.type];
}

export function getPipeVisualStyle(
  pipe: Pick<PipeNetwork, "type" | "systemType" | "flowRole" | "circuitRole" | "diameter_mm" | "material" | "flowDirection" | "markingColor">,
  options: { selected?: boolean; showFlowArrows?: boolean } = {}
) {
  const diameter = Number.isFinite(pipe.diameter_mm) ? Math.max(10, pipe.diameter_mm) : 25;
  const role = pipe.circuitRole ?? resolvePipeCircuitRole(pipe.type);
  const direction = normalizeFlowDirection(pipe.flowDirection);
  const strokeWidth = Math.max(2.25, Math.min(7.5, 2 + diameter / 18));
  return {
    stroke: resolvePipeColor(pipe),
    strokeWidth: options.selected ? strokeWidth + 1.4 : strokeWidth,
    outlineWidth: options.selected ? strokeWidth + 4 : strokeWidth + 1.4,
    dashArray:
      pipe.systemType === "ventilation" || role === "mixed"
        ? "10 6"
        : role === "unknown"
          ? "4 5"
          : undefined,
    arrowEnabled: options.showFlowArrows !== false && direction !== "unknown",
    arrowDirection: direction,
    radius_m: Math.max(0.03, diameter / 2000),
    info: `${NETWORK_SYSTEM_TYPE_LABELS[pipe.systemType ?? resolveNetworkSystemType(pipe.type)]} · ${PIPE_CIRCUIT_ROLE_LABELS[role]} · ${diameter.toFixed(0)} мм · ${pipe.material}`,
  };
}

export function isPipeVisuallyDistinctByRole(
  left: Pick<PipeNetwork, "type" | "markingColor" | "circuitRole" | "flowRole" | "systemType">,
  right: Pick<PipeNetwork, "type" | "markingColor" | "circuitRole" | "flowRole" | "systemType">
): boolean {
  return resolvePipeColor(left) !== resolvePipeColor(right);
}

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  radiator: "Радиатор",
  fancoil: "Фанкойл",
  ahu: "Вентустановка",
  pump: "Насос",
  boiler: "Котёл",
  heat_exchanger: "Водоподогреватель",
  elevator: "Элеватор",
  expansion_tank: "Расширительный бак",
  dirt_separator: "Грязевик",
  diffuser: "Диффузор",
  sensor: "Датчик",
};

export const SENSOR_TYPE_LABELS: Record<SensorType, string> = {
  temperature: "Температура",
  humidity: "Влажность",
  co2: "CO2",
  pressure: "Давление",
  flow: "Расход",
  leak: "Протечка",
};

export const DEFAULT_OPERATIONAL_SCENARIOS: OperationalScenario[] = [
  {
    id: "scenario-workday",
    kind: "workday",
    name: "Рабочий день",
    description: "Нормальная дневная эксплуатация здания.",
    impact: {
      setpointOffsetC: 0,
      equipmentStateOverrides: { radiator: "on", ahu: "on", diffuser: "on" },
      networkFlowMultiplier: 1,
      heatLoadMultiplier: 1,
    },
  },
  {
    id: "scenario-night",
    kind: "night",
    name: "Ночной режим",
    description: "Сниженные уставки и минимальные расходы.",
    impact: {
      setpointOffsetC: -2,
      equipmentStateOverrides: { radiator: "on", ahu: "off", diffuser: "off" },
      networkFlowMultiplier: 0.55,
      heatLoadMultiplier: 0.6,
    },
  },
  {
    id: "scenario-winter",
    kind: "winter",
    name: "Зима",
    description: "Повышенная нагрузка и активная система отопления.",
    impact: {
      setpointOffsetC: 1,
      equipmentStateOverrides: { radiator: "on", boiler: "on", pump: "on" },
      networkFlowMultiplier: 1.2,
      heatLoadMultiplier: 1.3,
    },
  },
  {
    id: "scenario-summer",
    kind: "summer",
    name: "Лето",
    description: "Приоритет вентиляции и охлаждения.",
    impact: {
      setpointOffsetC: -1,
      equipmentStateOverrides: { radiator: "off", fancoil: "on", ahu: "on" },
      networkFlowMultiplier: 0.7,
      heatLoadMultiplier: 0.5,
    },
  },
  {
    id: "scenario-emergency",
    kind: "emergency",
    name: "Авария",
    description: "Аварийный режим с отключением части оборудования.",
    impact: {
      setpointOffsetC: -4,
      equipmentStateOverrides: { radiator: "alarm", fancoil: "alarm", ahu: "alarm", pump: "alarm" },
      networkFlowMultiplier: 0.2,
      heatLoadMultiplier: 0.4,
    },
  },
  {
    id: "scenario-economy",
    kind: "economy",
    name: "Экономичный режим",
    description: "Пониженное энергопотребление при сохранении базового комфорта.",
    impact: {
      setpointOffsetC: -1,
      equipmentStateOverrides: { radiator: "on", ahu: "off", diffuser: "off" },
      networkFlowMultiplier: 0.65,
      heatLoadMultiplier: 0.75,
    },
  },
];
