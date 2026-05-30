import {
  createEmptyEngineeringSystems,
  type EngineeringEquipment,
  type EngineeringEquipmentParameters,
  type EngineeringEquipmentType,
  type EngineeringMedium,
  type EngineeringPipe,
  type EngineeringPipePoint,
  type EngineeringPort,
  type EngineeringPortDirection,
  type EngineeringSystemsModel,
} from "../../../entities/engineering/types";
import { createId } from "../../../shared/utils/id";

type PortTemplate = {
  id: string;
  xNorm: number;
  yNorm: number;
  direction: EngineeringPortDirection;
  medium: EngineeringMedium;
};

type EquipmentPreset = {
  label: string;
  width: number;
  height: number;
  ports: PortTemplate[];
  parameters: EngineeringEquipmentParameters;
};

export const ENGINEERING_EQUIPMENT_LABELS: Record<EngineeringEquipmentType, string> = {
  heatExchanger: "Теплообменник",
  pump: "Насос",
  filter: "Фильтр",
  valve: "Вентиль запорный",
  checkValve: "Обратный клапан",
  controlValve: "Регулирующий клапан",
  expansionTank: "Расширительный бак",
  manifold: "Коллектор",
  heatMeter: "Узел учёта",
  automationCabinet: "Шкаф автоматики",
  sensorTemperature: "Датчик T",
  sensorPressure: "Датчик P",
  // АВОК СТО НП 1.05-2006
  gateValve: "Задвижка",
  ballValve: "Кран шаровой",
  threeWayValve: "Кран трёхходовой",
  balancingValve: "Клапан балансировочный",
  safetyValve: "Клапан предохранительный",
  pressureRegulator: "Регулятор перепада давл.",
  thermostaticValve: "Терморегулятор",
  flowMeter: "Расходомер",
  convector: "Конвектор",
  sensorFlow: "Датчик расхода",
  sensorHumidity: "Датчик влажности",
};

export type EquipmentVariant = { key: string; label: string };

export const EQUIPMENT_VARIANTS: Partial<Record<EngineeringEquipmentType, EquipmentVariant[]>> = {
  valve: [
    { key: "throughput", label: "Проходной" },
    { key: "angular",    label: "Угловой" },
  ],
  checkValve: [
    { key: "throughput", label: "Проходной" },
    { key: "angular",    label: "Угловой" },
  ],
  controlValve: [
    { key: "throughput", label: "Проходной" },
    { key: "angular",    label: "Угловой" },
    { key: "triple",     label: "Тройной" },
  ],
  safetyValve: [
    { key: "throughput", label: "Проходной" },
    { key: "angular",    label: "Угловой" },
  ],
  thermostaticValve: [
    { key: "throughput", label: "Проходной" },
    { key: "mixing",     label: "Смесительный" },
  ],
  pump: [
    { key: "general",      label: "Нерегулируемый" },
    { key: "variable",     label: "Регулируемый" },
    { key: "centrifugal",  label: "Центробежный" },
  ],
  ballValve: [
    { key: "throughput", label: "Проходной" },
    { key: "angular",    label: "Угловой" },
  ],
};

export const EQUIPMENT_VARIANT_DEFAULT: Partial<Record<EngineeringEquipmentType, string>> = {
  valve: "throughput",
  checkValve: "throughput",
  controlValve: "throughput",
  safetyValve: "throughput",
  thermostaticValve: "throughput",
  pump: "general",
  ballValve: "throughput",
};

export const ENGINEERING_MEDIUM_LABELS: Record<EngineeringMedium, string> = {
  supply: "Подача",
  return: "Обратка",
  dhw: "ГВС",
  coldWater: "ХВС",
  drain: "Дренаж",
  electric: "Электропитание",
  signal: "Сигнал",
};

export const ENGINEERING_MEDIUM_STYLES: Record<
  EngineeringMedium,
  { stroke: string; dashArray?: string; outline: string; width: number }
> = {
  supply: { stroke: "#d45a1c", outline: "rgba(212,90,28,0.18)", width: 3.4 },
  return: { stroke: "#2f6fdb", outline: "rgba(47,111,219,0.18)", width: 3.4 },
  dhw: { stroke: "#ef8e1a", outline: "rgba(239,142,26,0.18)", width: 3.2 },
  coldWater: { stroke: "#36a7e7", outline: "rgba(54,167,231,0.18)", width: 3.2 },
  drain: { stroke: "#8f98a3", outline: "rgba(143,152,163,0.14)", dashArray: "9 6", width: 2.8 },
  electric: { stroke: "#9a67ea", outline: "rgba(154,103,234,0.14)", dashArray: "4 5", width: 2.1 },
  signal: { stroke: "#10a37f", outline: "rgba(16,163,127,0.14)", dashArray: "4 5", width: 2.1 },
};

const EQUIPMENT_PRESETS: Record<EngineeringEquipmentType, EquipmentPreset> = {
  heatExchanger: {
    label: ENGINEERING_EQUIPMENT_LABELS.heatExchanger,
    width: 1.4,
    height: 2.2,
    ports: [
      { id: "primary-in", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
      { id: "primary-out", xNorm: -0.5, yNorm: 0, direction: "left", medium: "return" },
      { id: "secondary-out", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
      { id: "secondary-in", xNorm: 0.5, yNorm: 0, direction: "right", medium: "return" },
    ],
    parameters: {
      heatExchangerVariant: "fixedStraight",
      powerKW: 350,
      primaryTemperatureC: 95,
      secondaryTemperatureC: 70,
      flowRateM3H: 12,
      pressureDropKPa: 35,
    },
  },
  pump: {
    label: ENGINEERING_EQUIPMENT_LABELS.pump,
    width: 1.2,
    height: 1.2,
    ports: [
      // Контур насоса в рендере: r = 0.42 * min(width,height) -> порты ставим на эту окружность.
      { id: "inlet", xNorm: -0.42, yNorm: 0, direction: "left", medium: "supply" },
      { id: "outlet", xNorm: 0.42, yNorm: 0, direction: "right", medium: "supply" },
    ],
    parameters: { flowRateM3H: 8, headM: 18, powerKW: 2.2, efficiency: 0.75 },
  },
  filter: {
    label: ENGINEERING_EQUIPMENT_LABELS.filter,
    width: 1.5,
    height: 0.95,
    ports: [
      // Порты ставим в точки входа/выхода на боковых "плечиках" контура.
      { id: "inlet", xNorm: -0.17, yNorm: -0.03, direction: "left", medium: "supply" },
      { id: "outlet", xNorm: 0.17, yNorm: -0.03, direction: "right", medium: "supply" },
      { id: "drain", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "drain" },
    ],
    parameters: { diameterMm: 80, pressureDropKPa: 8, contaminationPercent: 12 },
  },
  valve: {
    label: ENGINEERING_EQUIPMENT_LABELS.valve,
    width: 1.1,
    height: 0.8,
    ports: [
      { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
      { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
    ],
    parameters: { diameterMm: 65, kv: 40, state: "open" },
  },
  checkValve: {
    label: ENGINEERING_EQUIPMENT_LABELS.checkValve,
    width: 1.0,
    height: 0.75,
    ports: [
      { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
      { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
    ],
    parameters: { diameterMm: 50, state: "open" },
  },
  controlValve: {
    label: ENGINEERING_EQUIPMENT_LABELS.controlValve,
    width: 1.25,
    height: 1.2,
    ports: [
      { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
      { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
      { id: "signal", xNorm: 0, yNorm: -0.5, direction: "top", medium: "signal" },
    ],
    parameters: { diameterMm: 65, kv: 25, state: "regulating" },
  },
  expansionTank: {
    label: ENGINEERING_EQUIPMENT_LABELS.expansionTank,
    width: 1.35,
    height: 1,
    ports: [{ id: "connection", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "return" }],
    parameters: { volumeL: 300, pressureBar: 3 },
  },
  manifold: {
    label: ENGINEERING_EQUIPMENT_LABELS.manifold,
    width: 2.6,
    height: 0.75,
    ports: [
      { id: "main-in", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
      { id: "main-out", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
      { id: "branch-1", xNorm: -0.2, yNorm: -0.5, direction: "top", medium: "supply" },
      { id: "branch-2", xNorm: 0, yNorm: -0.5, direction: "top", medium: "supply" },
      { id: "branch-3", xNorm: 0.2, yNorm: -0.5, direction: "top", medium: "supply" },
    ],
    parameters: { diameterMm: 100, branchCount: 3 },
  },
  heatMeter: {
    label: ENGINEERING_EQUIPMENT_LABELS.heatMeter,
    width: 1.65,
    height: 0.95,
    ports: [
      { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
      { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
      { id: "signal", xNorm: 0, yNorm: -0.5, direction: "top", medium: "signal" },
    ],
    parameters: { flowRateM3H: 10, supplyTemperatureC: 95, returnTemperatureC: 70, heatPowerKW: 320 },
  },
  automationCabinet: {
    label: ENGINEERING_EQUIPMENT_LABELS.automationCabinet,
    width: 1.4,
    height: 1.8,
    ports: [
      { id: "power", xNorm: -0.5, yNorm: 0.2, direction: "left", medium: "electric" },
      { id: "signal-1", xNorm: 0.5, yNorm: -0.2, direction: "right", medium: "signal" },
      { id: "signal-2", xNorm: 0.5, yNorm: 0.2, direction: "right", medium: "signal" },
    ],
    parameters: { voltageV: 380, signalChannels: 8 },
  },
  sensorTemperature: {
    label: ENGINEERING_EQUIPMENT_LABELS.sensorTemperature,
    width: 0.65,
    height: 0.65,
    ports: [{ id: "signal", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "signal" }],
    parameters: { measuredValueC: 70 },
  },
  sensorPressure: {
    label: ENGINEERING_EQUIPMENT_LABELS.sensorPressure,
    width: 0.65,
    height: 0.65,
    ports: [{ id: "signal", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "signal" }],
    parameters: { measuredValueBar: 3.2 },
  },
  // ── АВОК СТО НП 1.05-2006 ──────────────────────────────────────────────────
  gateValve: {
    label: ENGINEERING_EQUIPMENT_LABELS.gateValve,
    width: 1.0,
    height: 1.05,
    ports: [
      { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
      { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
    ],
    parameters: { diameterMm: 65, state: "open" },
  },
  ballValve: {
    label: ENGINEERING_EQUIPMENT_LABELS.ballValve,
    width: 0.9,
    height: 0.9,
    ports: [
      { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
      { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
    ],
    parameters: { diameterMm: 50, state: "open" },
  },
  threeWayValve: {
    label: ENGINEERING_EQUIPMENT_LABELS.threeWayValve,
    width: 1.1,
    height: 1.2,
    ports: [
      { id: "inlet",  xNorm: -0.5, yNorm: 0,    direction: "left",  medium: "supply" },
      { id: "outlet", xNorm:  0.5, yNorm: 0,    direction: "right", medium: "supply" },
      { id: "branch", xNorm:  0,   yNorm: -0.5, direction: "top",   medium: "supply" },
    ],
    parameters: { diameterMm: 50, state: "open" },
  },
  balancingValve: {
    label: ENGINEERING_EQUIPMENT_LABELS.balancingValve,
    width: 1.0,
    height: 1.05,
    ports: [
      { id: "inlet",  xNorm: -0.5, yNorm: 0, direction: "left",  medium: "supply" },
      { id: "outlet", xNorm:  0.5, yNorm: 0, direction: "right", medium: "supply" },
    ],
    parameters: { diameterMm: 65, kv: 15, state: "open" },
  },
  safetyValve: {
    label: ENGINEERING_EQUIPMENT_LABELS.safetyValve,
    width: 1.0,
    height: 1.2,
    ports: [
      { id: "inlet",  xNorm: -0.5, yNorm: 0, direction: "left",  medium: "supply" },
      { id: "outlet", xNorm:  0.5, yNorm: 0, direction: "right", medium: "supply" },
    ],
    parameters: { diameterMm: 32, setpressureBar: 6 },
  },
  pressureRegulator: {
    label: ENGINEERING_EQUIPMENT_LABELS.pressureRegulator,
    width: 1.25,
    height: 1.5,
    ports: [
      { id: "inlet",  xNorm: -0.5, yNorm: 0,    direction: "left",  medium: "supply" },
      { id: "outlet", xNorm:  0.5, yNorm: 0,    direction: "right", medium: "supply" },
      { id: "signal", xNorm:  0,   yNorm: -0.5, direction: "top",   medium: "signal" },
    ],
    parameters: { diameterMm: 65, setpointKPa: 20 },
  },
  thermostaticValve: {
    label: ENGINEERING_EQUIPMENT_LABELS.thermostaticValve,
    width: 1.0,
    height: 1.35,
    ports: [
      { id: "inlet",  xNorm: -0.5, yNorm: 0, direction: "left",  medium: "supply" },
      { id: "outlet", xNorm:  0.5, yNorm: 0, direction: "right", medium: "supply" },
    ],
    parameters: { diameterMm: 15, setpointC: 20 },
  },
  flowMeter: {
    label: ENGINEERING_EQUIPMENT_LABELS.flowMeter,
    width: 1.5,
    height: 0.9,
    ports: [
      { id: "inlet",  xNorm: -0.5, yNorm: 0,    direction: "left",  medium: "supply" },
      { id: "outlet", xNorm:  0.5, yNorm: 0,    direction: "right", medium: "supply" },
      { id: "signal", xNorm:  0,   yNorm: -0.5, direction: "top",   medium: "signal" },
    ],
    parameters: { diameterMm: 50, flowRateM3H: 5, variant: "electromagnetic" },
  },
  convector: {
    label: ENGINEERING_EQUIPMENT_LABELS.convector,
    width: 1.4,
    height: 0.85,
    ports: [
      { id: "inlet",  xNorm: -0.5, yNorm: 0, direction: "left",  medium: "supply" },
      { id: "outlet", xNorm:  0.5, yNorm: 0, direction: "right", medium: "return" },
    ],
    parameters: { nominalPowerW: 1000, designTemperatureC: 70 },
  },
  sensorFlow: {
    label: ENGINEERING_EQUIPMENT_LABELS.sensorFlow,
    width: 0.65,
    height: 0.65,
    ports: [{ id: "signal", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "signal" }],
    parameters: { flowRateM3H: 5 },
  },
  sensorHumidity: {
    label: ENGINEERING_EQUIPMENT_LABELS.sensorHumidity,
    width: 0.65,
    height: 0.65,
    ports: [{ id: "signal", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "signal" }],
    parameters: { relativeHumidityPercent: 50 },
  },
};

export function getEngineeringEquipmentPreset(type: EngineeringEquipmentType): EquipmentPreset {
  return EQUIPMENT_PRESETS[type];
}

export function buildEngineeringPorts(
  type: EngineeringEquipmentType,
  width: number,
  height: number
): EngineeringPort[] {
  return getEngineeringEquipmentPreset(type).ports.map((port) => ({
    id: port.id,
    x: port.xNorm * width,
    y: port.yNorm * height,
    direction: port.direction,
    medium: port.medium,
  }));
}

export function normalizeEngineeringRotation(rotation: number | null | undefined): number {
  const numeric = typeof rotation === "number" && Number.isFinite(rotation) ? rotation : 0;
  const normalized = ((Math.round(numeric / 90) * 90) % 360 + 360) % 360;
  return normalized;
}

export function createEngineeringEquipmentInstance(
  type: EngineeringEquipmentType,
  center: { x: number; y: number },
  options: {
    id?: string;
    name?: string;
    levelId?: string | null;
    rotation?: number;
    parameters?: EngineeringEquipmentParameters;
    metadata?: Record<string, unknown>;
  } = {}
): EngineeringEquipment {
  const preset = getEngineeringEquipmentPreset(type);
  return {
    id: options.id ?? createId("eng-eqp"),
    type,
    name: options.name?.trim() || preset.label,
    x: center.x,
    y: center.y,
    width: preset.width,
    height: preset.height,
    rotation: normalizeEngineeringRotation(options.rotation),
    ports: buildEngineeringPorts(type, preset.width, preset.height),
    parameters: { ...preset.parameters, ...(options.parameters ?? {}) },
    metadata: { ...(options.metadata ?? {}) },
    levelId: options.levelId ?? null,
  };
}

export function overrideEquipmentPortMedium(
  equipment: EngineeringEquipment,
  medium: EngineeringMedium
): EngineeringEquipment {
  return {
    ...equipment,
    ports: equipment.ports.map((port) => ({ ...port, medium })),
  };
}

export function normalizeEngineeringEquipment(
  equipment: Partial<EngineeringEquipment> & Pick<EngineeringEquipment, "id" | "type">
): EngineeringEquipment {
  const preset = getEngineeringEquipmentPreset(equipment.type);
  const width = typeof equipment.width === "number" && Number.isFinite(equipment.width) ? Math.max(0.4, equipment.width) : preset.width;
  const height =
    typeof equipment.height === "number" && Number.isFinite(equipment.height) ? Math.max(0.4, equipment.height) : preset.height;
  const basePorts = buildEngineeringPorts(equipment.type, width, height);
  const providedPorts = Array.isArray(equipment.ports) ? equipment.ports : [];
  const providedPortMap = new Map(providedPorts.map((port) => [port.id, port] as const));
  const extraPorts = providedPorts.filter((port) => !basePorts.some((basePort) => basePort.id === port.id));
  return {
    id: equipment.id,
    type: equipment.type,
    name: typeof equipment.name === "string" && equipment.name.trim() ? equipment.name.trim() : preset.label,
    x: typeof equipment.x === "number" && Number.isFinite(equipment.x) ? equipment.x : 0,
    y: typeof equipment.y === "number" && Number.isFinite(equipment.y) ? equipment.y : 0,
    width,
    height,
    rotation: normalizeEngineeringRotation(equipment.rotation),
    ports: [
      ...basePorts.map((port) => {
        const override = providedPortMap.get(port.id);
        return {
          ...port,
          direction: override?.direction ?? port.direction,
          medium: override?.medium ?? port.medium,
        };
      }),
      ...extraPorts.map((port) => ({
        id: port.id,
        x: typeof port.x === "number" && Number.isFinite(port.x) ? port.x : 0,
        y: typeof port.y === "number" && Number.isFinite(port.y) ? port.y : 0,
        direction: port.direction,
        medium: port.medium,
      })),
    ],
    parameters: { ...preset.parameters, ...(equipment.parameters ?? {}) },
    metadata: { ...(equipment.metadata ?? {}) },
    levelId: equipment.levelId ?? null,
  };
}

export function getEngineeringPort(
  equipment: EngineeringEquipment,
  portId: string
): EngineeringPort | null {
  return equipment.ports.find((port) => port.id === portId) ?? null;
}

export function getEngineeringPortWorldPosition(
  equipment: Pick<EngineeringEquipment, "x" | "y" | "rotation">,
  port: Pick<EngineeringPort, "x" | "y">
): EngineeringPipePoint {
  const radians = (normalizeEngineeringRotation(equipment.rotation) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: equipment.x + port.x * cos - port.y * sin,
    y: equipment.y + port.x * sin + port.y * cos,
  };
}

export function rotateEngineeringDirection(
  direction: EngineeringPortDirection,
  rotation: number
): EngineeringPortDirection {
  const order: EngineeringPortDirection[] = ["top", "right", "bottom", "left"];
  const index = order.indexOf(direction);
  const turns = normalizeEngineeringRotation(rotation) / 90;
  return order[(index + turns) % order.length] ?? direction;
}

function directionVector(direction: EngineeringPortDirection): EngineeringPipePoint {
  switch (direction) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
    default:
      return { x: 0, y: 1 };
  }
}

function advancePoint(
  point: EngineeringPipePoint,
  direction: EngineeringPortDirection,
  distance: number
): EngineeringPipePoint {
  const vector = directionVector(direction);
  return {
    x: point.x + vector.x * distance,
    y: point.y + vector.y * distance,
  };
}

function dedupePolylinePoints(points: EngineeringPipePoint[]): EngineeringPipePoint[] {
  const deduped: EngineeringPipePoint[] = [];
  points.forEach((point) => {
    const previous = deduped[deduped.length - 1];
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 1e-6) {
      return;
    }
    deduped.push(point);
  });
  return deduped;
}

export function buildEngineeringPipeRoute(
  start: EngineeringPipePoint,
  startDirection: EngineeringPortDirection,
  end: EngineeringPipePoint,
  endDirection: EngineeringPortDirection
): EngineeringPipePoint[] {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const lead = Math.max(0.28, Math.min(0.9, distance * 0.22));
  const startLead = advancePoint(start, startDirection, lead);
  const endLead = advancePoint(end, endDirection, lead);
  const startHorizontal = startDirection === "left" || startDirection === "right";
  const endHorizontal = endDirection === "left" || endDirection === "right";

  const midPoints: EngineeringPipePoint[] = [];
  if (startHorizontal && endHorizontal) {
    const midX = (startLead.x + endLead.x) / 2;
    midPoints.push({ x: midX, y: startLead.y }, { x: midX, y: endLead.y });
  } else if (!startHorizontal && !endHorizontal) {
    const midY = (startLead.y + endLead.y) / 2;
    midPoints.push({ x: startLead.x, y: midY }, { x: endLead.x, y: midY });
  } else {
    midPoints.push({ x: startLead.x, y: endLead.y });
  }

  return dedupePolylinePoints([start, startLead, ...midPoints, endLead, end]);
}

function defaultPipeValuesForMedium(medium: EngineeringMedium) {
  switch (medium) {
    case "supply":
      return { diameter: 80, insulation: 40, temperature: 95, flowRate: 12 };
    case "return":
      return { diameter: 80, insulation: 40, temperature: 70, flowRate: 12 };
    case "dhw":
      return { diameter: 50, insulation: 30, temperature: 60, flowRate: 5 };
    case "coldWater":
      return { diameter: 40, insulation: 13, temperature: 10, flowRate: 4 };
    case "drain":
      return { diameter: 32, insulation: 0, temperature: null, flowRate: 2 };
    case "electric":
      return { diameter: 10, insulation: 0, temperature: null, flowRate: null };
    case "signal":
    default:
      return { diameter: 8, insulation: 0, temperature: null, flowRate: null };
  }
}

export function areEngineeringPortsCompatible(left: EngineeringPort, right: EngineeringPort): boolean {
  return left.medium === right.medium;
}

export function createEngineeringPipeConnection(input: {
  id?: string;
  levelId?: string | null;
  fromEquipment: EngineeringEquipment;
  fromPortId: string;
  toEquipment: EngineeringEquipment;
  toPortId: string;
  metadata?: Record<string, unknown>;
}): EngineeringPipe | null {
  const fromPort = getEngineeringPort(input.fromEquipment, input.fromPortId);
  const toPort = getEngineeringPort(input.toEquipment, input.toPortId);
  if (!fromPort || !toPort || !areEngineeringPortsCompatible(fromPort, toPort)) {
    return null;
  }
  const medium = fromPort.medium;
  const startDirection = rotateEngineeringDirection(fromPort.direction, input.fromEquipment.rotation);
  const endDirection = rotateEngineeringDirection(toPort.direction, input.toEquipment.rotation);
  const start = getEngineeringPortWorldPosition(input.fromEquipment, fromPort);
  const end = getEngineeringPortWorldPosition(input.toEquipment, toPort);
  const defaults = defaultPipeValuesForMedium(medium);
  return {
    id: input.id ?? createId("eng-pipe"),
    fromEquipmentId: input.fromEquipment.id,
    fromPortId: fromPort.id,
    toEquipmentId: input.toEquipment.id,
    toPortId: toPort.id,
    points: buildEngineeringPipeRoute(start, startDirection, end, endDirection),
    medium,
    diameter: defaults.diameter,
    insulation: defaults.insulation,
    temperature: defaults.temperature,
    flowRate: defaults.flowRate,
    metadata: { ...(input.metadata ?? {}) },
    levelId: input.levelId ?? input.fromEquipment.levelId ?? input.toEquipment.levelId ?? null,
  };
}

export function normalizeEngineeringPipe(
  pipe: Partial<EngineeringPipe> &
    Pick<EngineeringPipe, "id" | "fromEquipmentId" | "fromPortId" | "toEquipmentId" | "toPortId" | "medium">
): EngineeringPipe {
  const defaults = defaultPipeValuesForMedium(pipe.medium);
  return {
    id: pipe.id,
    fromEquipmentId: pipe.fromEquipmentId,
    fromPortId: pipe.fromPortId,
    toEquipmentId: pipe.toEquipmentId,
    toPortId: pipe.toPortId,
    points: Array.isArray(pipe.points) ? pipe.points.map((point) => ({ x: point?.x ?? 0, y: point?.y ?? 0 })) : [],
    medium: pipe.medium,
    diameter: typeof pipe.diameter === "number" && Number.isFinite(pipe.diameter) ? Math.max(1, pipe.diameter) : defaults.diameter,
    insulation:
      typeof pipe.insulation === "number" && Number.isFinite(pipe.insulation) ? Math.max(0, pipe.insulation) : defaults.insulation,
    temperature: typeof pipe.temperature === "number" && Number.isFinite(pipe.temperature) ? pipe.temperature : defaults.temperature,
    flowRate: typeof pipe.flowRate === "number" && Number.isFinite(pipe.flowRate) ? pipe.flowRate : defaults.flowRate,
    metadata: { ...(pipe.metadata ?? {}) },
    levelId: pipe.levelId ?? null,
  };
}

export function rebuildEngineeringPipeGeometry(
  pipe: EngineeringPipe,
  systems: EngineeringSystemsModel
): EngineeringPipe {
  const fromEquipment = systems.equipment.find((equipment) => equipment.id === pipe.fromEquipmentId);
  const toEquipment = systems.equipment.find((equipment) => equipment.id === pipe.toEquipmentId);
  if (!fromEquipment || !toEquipment) {
    return pipe;
  }
  const next = createEngineeringPipeConnection({
    id: pipe.id,
    levelId: pipe.levelId ?? fromEquipment.levelId ?? toEquipment.levelId ?? null,
    fromEquipment,
    fromPortId: pipe.fromPortId,
    toEquipment,
    toPortId: pipe.toPortId,
    metadata: pipe.metadata,
  });
  if (!next) {
    return pipe;
  }
  return {
    ...next,
    diameter: pipe.diameter,
    insulation: pipe.insulation,
    temperature: pipe.temperature,
    flowRate: pipe.flowRate,
  };
}

export function normalizeEngineeringSystems(
  systems: EngineeringSystemsModel | null | undefined
): EngineeringSystemsModel {
  const base = systems ?? createEmptyEngineeringSystems();
  const equipment = Array.isArray(base.equipment) ? base.equipment.map((item) => normalizeEngineeringEquipment(item)) : [];
  const rawPipes = Array.isArray(base.pipes) ? base.pipes.map((pipe) => normalizeEngineeringPipe(pipe)) : [];
  const normalized: EngineeringSystemsModel = { equipment, pipes: rawPipes };
  return {
    equipment,
    pipes: rawPipes.map((pipe) => rebuildEngineeringPipeGeometry(pipe, normalized)),
  };
}

export function rebuildEngineeringSystemsForEquipment(
  systems: EngineeringSystemsModel,
  equipmentId: string
): EngineeringSystemsModel {
  return {
    equipment: systems.equipment,
    pipes: systems.pipes.map((pipe) => {
      if (pipe.fromEquipmentId !== equipmentId && pipe.toEquipmentId !== equipmentId) {
        return pipe;
      }
      return rebuildEngineeringPipeGeometry(pipe, systems);
    }),
  };
}

export function getEngineeringEquipmentAtPoint(
  point: EngineeringPipePoint,
  equipment: EngineeringEquipment,
  padding = 0
): boolean {
  const radians = (-normalizeEngineeringRotation(equipment.rotation) * Math.PI) / 180;
  const dx = point.x - equipment.x;
  const dy = point.y - equipment.y;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(localX) <= equipment.width / 2 + padding && Math.abs(localY) <= equipment.height / 2 + padding;
}

export function findEngineeringPortAtPoint(
  point: EngineeringPipePoint,
  equipment: EngineeringEquipment[],
  tolerance = 0.22
): { equipment: EngineeringEquipment; port: EngineeringPort; position: EngineeringPipePoint } | null {
  for (const item of equipment) {
    for (const port of item.ports) {
      const position = getEngineeringPortWorldPosition(item, port);
      if (Math.hypot(position.x - point.x, position.y - point.y) <= tolerance) {
        return { equipment: item, port, position };
      }
    }
  }
  return null;
}

/**
 * Точечное переопределение медиа-среды отдельных портов оборудования.
 * Используется для настройки портов теплообменника ГВС, водомера ХВС и т.п.
 */
function overridePortMediums(
  equipment: EngineeringEquipment,
  overrides: Record<string, EngineeringMedium>
): EngineeringEquipment {
  return {
    ...equipment,
    ports: equipment.ports.map((port) => ({
      ...port,
      medium: (overrides[port.id] as EngineeringMedium | undefined) ?? port.medium,
    })),
  };
}

export function createTypicalCtpEngineeringSystems(
  levelId: string | null,
  origin: EngineeringPipePoint = { x: 0, y: 0 }
): EngineeringSystemsModel {
  const supplyHeader = createEngineeringEquipmentInstance("manifold", { x: origin.x + 0.8, y: origin.y + 0.2 }, {
    levelId,
    name: "Ввод теплосети",
    metadata: { template: "typical-ctp" },
  });
  const filter = createEngineeringEquipmentInstance("filter", { x: origin.x + 3.4, y: origin.y + 0.2 }, {
    levelId,
    name: "Грязевик",
    metadata: { template: "typical-ctp" },
  });
  const heatMeter = createEngineeringEquipmentInstance("heatMeter", { x: origin.x + 5.8, y: origin.y + 0.2 }, {
    levelId,
    name: "Узел учета тепла",
    metadata: { template: "typical-ctp" },
  });
  const controlValve = createEngineeringEquipmentInstance("controlValve", { x: origin.x + 8.2, y: origin.y + 0.2 }, {
    levelId,
    name: "Регулирующий клапан",
    metadata: { template: "typical-ctp" },
  });
  const heatingHx = createEngineeringEquipmentInstance("heatExchanger", { x: origin.x + 11.5, y: origin.y - 1.2 }, {
    levelId,
    name: "Теплообменник отопления",
    metadata: { template: "typical-ctp" },
  });
  const heatingPump = createEngineeringEquipmentInstance("pump", { x: origin.x + 14.7, y: origin.y - 1.2 }, {
    levelId,
    name: "Насос отопления",
    metadata: { template: "typical-ctp" },
  });
  const heatingHeader = createEngineeringEquipmentInstance("manifold", { x: origin.x + 17.7, y: origin.y - 1.2 }, {
    levelId,
    name: "Подача отопления",
    metadata: { template: "typical-ctp" },
  });
  const heatingReturn = overrideEquipmentPortMedium(
    createEngineeringEquipmentInstance("manifold", { x: origin.x + 17.7, y: origin.y + 2.8 }, {
      levelId,
      name: "Обратка отопления",
      rotation: 180,
      metadata: { template: "typical-ctp" },
    }),
    "return"
  );
  const dhwHx = createEngineeringEquipmentInstance("heatExchanger", { x: origin.x + 11.5, y: origin.y + 2.4 }, {
    levelId,
    name: "Теплообменник ГВС",
    metadata: { template: "typical-ctp" },
  });
  const dhwPump = createEngineeringEquipmentInstance("pump", { x: origin.x + 14.7, y: origin.y + 2.4 }, {
    levelId,
    name: "Насос ГВС",
    metadata: { template: "typical-ctp" },
  });
  const expansionTank = createEngineeringEquipmentInstance("expansionTank", { x: origin.x + 14.7, y: origin.y + 5.4 }, {
    levelId,
    name: "Расширительный бак",
    metadata: { template: "typical-ctp" },
  });
  const automationCabinet = createEngineeringEquipmentInstance(
    "automationCabinet",
    { x: origin.x + 20.8, y: origin.y + 0.8 },
    {
      levelId,
      name: "Шкаф автоматики",
      metadata: { template: "typical-ctp" },
    }
  );
  const returnHeader = overrideEquipmentPortMedium(
    createEngineeringEquipmentInstance("manifold", { x: origin.x + 3.4, y: origin.y + 6.2 }, {
      levelId,
      name: "Обратка теплосети",
      rotation: 180,
      metadata: { template: "typical-ctp" },
    }),
    "return"
  );

  const equipment = [
    supplyHeader,
    filter,
    heatMeter,
    controlValve,
    heatingHx,
    heatingPump,
    heatingHeader,
    heatingReturn,
    dhwHx,
    dhwPump,
    expansionTank,
    automationCabinet,
    returnHeader,
  ];

  const pipeInputs = [
    [supplyHeader, "main-out", filter, "inlet"],
    [filter, "outlet", heatMeter, "inlet"],
    [heatMeter, "outlet", controlValve, "inlet"],
    [controlValve, "outlet", heatingHx, "primary-in"],
    [controlValve, "outlet", dhwHx, "primary-in"],
    [heatingHx, "primary-out", returnHeader, "main-in"],
    [dhwHx, "primary-out", returnHeader, "branch-1"],
    [heatingHx, "secondary-out", heatingPump, "inlet"],
    [heatingPump, "outlet", heatingHeader, "main-in"],
    [heatingReturn, "main-out", heatingHx, "secondary-in"],
    [heatingReturn, "branch-2", expansionTank, "connection"],
    [dhwHx, "secondary-out", dhwPump, "inlet"],
    [heatMeter, "signal", automationCabinet, "signal-1"],
    [controlValve, "signal", automationCabinet, "signal-2"],
  ] as const;

  const pipes = pipeInputs
    .map(([fromEquipment, fromPortId, toEquipment, toPortId]) =>
      createEngineeringPipeConnection({
        fromEquipment,
        fromPortId,
        toEquipment,
        toPortId,
        levelId,
        metadata: { template: "typical-ctp" },
      })
    )
    .filter((pipe): pipe is EngineeringPipe => Boolean(pipe));

  return { equipment, pipes };
}

/**
 * Одноступенчатая параллельная схема присоединения водоподогревателей ГВС
 * с зависимым присоединением систем отопления (по схеме из СП 41-101-95).
 *
 * Особенности схемы:
 *  - Зависимое присоединение отопления: теплоноситель из теплосети поступает
 *    в систему отопления напрямую через корректирующий подмешивающий насос
 *    (без теплообменника на контуре отопления).
 *  - Водоподогреватель ГВС присоединён параллельно контуру отопления к вводу
 *    теплосети (одноступенчатая параллельная схема).
 *  - Оборудование: теплосчётчик (9), грязевик, регулятор перепада давлений (4),
 *    регулирующий клапан отопления (6), корректирующий насос (8), обратные
 *    клапаны (7), водоподогреватель ГВС (1), насос ГВС (2), регулирующий
 *    клапан ГВС с электроприводом (3), водомер ХВС (5), датчики T/P (10/13),
 *    шкаф автоматики.
 */
export function createItpParallelDhwDependentHeating(
  levelId: string | null,
  origin: EngineeringPipePoint = { x: 0, y: 0 }
): EngineeringSystemsModel {
  const template = "itp-parallel-dhw-dependent";

  // ── Ввод теплосети (подача) ──────────────────────────────────────────────
  const supplyHeader = createEngineeringEquipmentInstance(
    "manifold",
    { x: origin.x + 0.8, y: origin.y },
    { levelId, name: "Ввод теплосети (подача)", metadata: { template } }
  );

  // Грязевик на подаче
  const filterSupply = createEngineeringEquipmentInstance(
    "filter",
    { x: origin.x + 3.4, y: origin.y },
    { levelId, name: "Грязевик", metadata: { template } }
  );

  // Теплосчётчик (поз. 9)
  const heatMeter = createEngineeringEquipmentInstance(
    "heatMeter",
    { x: origin.x + 6.0, y: origin.y },
    { levelId, name: "Теплосчётчик", metadata: { template } }
  );

  // Регулятор перепада давлений (поз. 4) — смоделирован как управляющий клапан
  const dpRegulator = createEngineeringEquipmentInstance(
    "controlValve",
    { x: origin.x + 8.6, y: origin.y },
    { levelId, name: "Рег. перепада давл.", metadata: { template } }
  );

  // ── Контур отопления (зависимое присоединение) ───────────────────────────
  // Регулятор подачи теплоты на отопление (поз. 6)
  const heatingControlValve = createEngineeringEquipmentInstance(
    "controlValve",
    { x: origin.x + 12.0, y: origin.y - 2.4 },
    { levelId, name: "Рег. подачи теплоты (отопление)", metadata: { template } }
  );

  // Подача в систему отопления
  const heatingSupplyHeader = createEngineeringEquipmentInstance(
    "manifold",
    { x: origin.x + 17.8, y: origin.y - 2.4 },
    { levelId, name: "Подача отопления", metadata: { template } }
  );

  // Обратка из системы отопления
  const heatingReturnHeader = overrideEquipmentPortMedium(
    createEngineeringEquipmentInstance(
      "manifold",
      { x: origin.x + 17.8, y: origin.y + 1.4 },
      { levelId, name: "Обратка отопления", rotation: 180, metadata: { template } }
    ),
    "return"
  );

  // Корректирующий подмешивающий насос (поз. 8)
  const correctingPump = overridePortMediums(
    createEngineeringEquipmentInstance(
      "pump",
      { x: origin.x + 14.5, y: origin.y + 1.4 },
      { levelId, name: "Корректирующий насос", metadata: { template } }
    ),
    { inlet: "return", outlet: "return" }
  );

  // Обратный клапан на обратке отопления (поз. 7)
  const heatingCheckValve = overridePortMediums(
    createEngineeringEquipmentInstance(
      "checkValve",
      { x: origin.x + 11.5, y: origin.y + 1.4 },
      { levelId, name: "Обр. клапан (отопление)", metadata: { template } }
    ),
    { inlet: "return", outlet: "return" }
  );

  // ── Контур ГВС (одноступенчатая параллельная схема) ─────────────────────
  // Регулирующий клапан ГВС с электроприводом (поз. 3)
  const dhwControlValve = createEngineeringEquipmentInstance(
    "controlValve",
    { x: origin.x + 12.0, y: origin.y + 3.2 },
    { levelId, name: "Рег. клапан ГВС (с эл. приводом)", metadata: { template } }
  );

  // Водоподогреватель ГВС (поз. 1) — первичная сторона от теплосети,
  // вторичная — от ХВС (холодная вода → ГВС)
  const dhwHeatExchanger = overridePortMediums(
    createEngineeringEquipmentInstance(
      "heatExchanger",
      { x: origin.x + 15.0, y: origin.y + 3.2 },
      { levelId, name: "Водоподогреватель ГВС", metadata: { template } }
    ),
    { "secondary-out": "dhw", "secondary-in": "coldWater" }
  );

  // Водомер холодной воды (поз. 5) — на вводе ХВС к водоподогревателю
  const coldWaterMeter = overridePortMediums(
    createEngineeringEquipmentInstance(
      "heatMeter",
      { x: origin.x + 15.0, y: origin.y + 6.0 },
      { levelId, name: "Водомер ХВС", metadata: { template }, parameters: { flowRateM3H: 4 } }
    ),
    { inlet: "coldWater", outlet: "coldWater" }
  );

  // Циркуляционный насос ГВС (поз. 2)
  const dhwPump = overridePortMediums(
    createEngineeringEquipmentInstance(
      "pump",
      { x: origin.x + 18.2, y: origin.y + 3.2 },
      { levelId, name: "Насос ГВС (циркуляционный)", metadata: { template } }
    ),
    { inlet: "dhw", outlet: "dhw" }
  );

  // Обратный клапан на выходе ГВС (поз. 7)
  const dhwCheckValve = overridePortMediums(
    createEngineeringEquipmentInstance(
      "checkValve",
      { x: origin.x + 20.2, y: origin.y + 3.2 },
      { levelId, name: "Обр. клапан ГВС", metadata: { template } }
    ),
    { inlet: "dhw", outlet: "dhw" }
  );

  // Выход в систему ГВС
  const dhwSupplyHeader = overridePortMediums(
    createEngineeringEquipmentInstance(
      "manifold",
      { x: origin.x + 22.2, y: origin.y + 3.2 },
      { levelId, name: "В систему ГВС", metadata: { template } }
    ),
    { "main-in": "dhw", "main-out": "dhw", "branch-1": "dhw", "branch-2": "dhw", "branch-3": "dhw" }
  );

  // ── Обратка теплосети ────────────────────────────────────────────────────
  // Сборный коллектор обраток (из отопления + первичной стороны ГВС)
  const returnJunction = overrideEquipmentPortMedium(
    createEngineeringEquipmentInstance(
      "manifold",
      { x: origin.x + 8.6, y: origin.y + 6.0 },
      { levelId, name: "Сбор обраток", rotation: 180, metadata: { template } }
    ),
    "return"
  );

  // Обратка теплосети
  const returnOutlet = overrideEquipmentPortMedium(
    createEngineeringEquipmentInstance(
      "manifold",
      { x: origin.x + 0.8, y: origin.y + 6.0 },
      { levelId, name: "Обратка теплосети", rotation: 180, metadata: { template } }
    ),
    "return"
  );

  // ── Автоматика и датчики ─────────────────────────────────────────────────
  const automationCabinet = createEngineeringEquipmentInstance(
    "automationCabinet",
    { x: origin.x + 22.2, y: origin.y + 0.8 },
    { levelId, name: "Шкаф автоматики", metadata: { template } }
  );

  // Датчик температуры на вводе подачи (поз. 10)
  const sensorTempSupply = createEngineeringEquipmentInstance(
    "sensorTemperature",
    { x: origin.x + 0.8, y: origin.y - 1.5 },
    { levelId, name: "Датчик T подачи", metadata: { template } }
  );

  // Датчик давления на вводе (поз. 13)
  const sensorPressureSupply = createEngineeringEquipmentInstance(
    "sensorPressure",
    { x: origin.x + 3.4, y: origin.y - 1.5 },
    { levelId, name: "Датчик P подачи", metadata: { template } }
  );

  const equipment = [
    supplyHeader,
    filterSupply,
    heatMeter,
    dpRegulator,
    heatingControlValve,
    heatingSupplyHeader,
    heatingReturnHeader,
    correctingPump,
    heatingCheckValve,
    dhwControlValve,
    dhwHeatExchanger,
    coldWaterMeter,
    dhwPump,
    dhwCheckValve,
    dhwSupplyHeader,
    returnJunction,
    returnOutlet,
    automationCabinet,
    sensorTempSupply,
    sensorPressureSupply,
  ];

  const pipeInputs = [
    // Цепочка подачи теплосети
    [supplyHeader, "main-out", filterSupply, "inlet"],
    [filterSupply, "outlet", heatMeter, "inlet"],
    [heatMeter, "outlet", dpRegulator, "inlet"],
    // Параллельные ветви от регулятора перепада давлений
    [dpRegulator, "outlet", heatingControlValve, "inlet"],   // ветвь отопления
    [dpRegulator, "outlet", dhwControlValve, "inlet"],        // ветвь ГВС (параллельно)
    // Контур отопления (зависимое присоединение)
    [heatingControlValve, "outlet", heatingSupplyHeader, "main-in"],
    [heatingReturnHeader, "main-out", correctingPump, "inlet"],
    [correctingPump, "outlet", heatingCheckValve, "inlet"],
    [heatingCheckValve, "outlet", returnJunction, "main-in"],
    // Контур ГВС (водоподогреватель, первичная сторона — от теплосети)
    [dhwControlValve, "outlet", dhwHeatExchanger, "primary-in"],
    [dhwHeatExchanger, "primary-out", returnJunction, "branch-1"],
    // Контур ГВС (вторичная сторона — ХВС → ГВС)
    [coldWaterMeter, "outlet", dhwHeatExchanger, "secondary-in"],
    [dhwHeatExchanger, "secondary-out", dhwPump, "inlet"],
    [dhwPump, "outlet", dhwCheckValve, "inlet"],
    [dhwCheckValve, "outlet", dhwSupplyHeader, "main-in"],
    // Обратка теплосети
    [returnJunction, "main-out", returnOutlet, "main-in"],
    // Сигнальные связи с шкафом автоматики
    [heatMeter, "signal", automationCabinet, "signal-1"],
    [dpRegulator, "signal", automationCabinet, "signal-2"],
  ] as const;

  const pipes = pipeInputs
    .map(([fromEquipment, fromPortId, toEquipment, toPortId]) =>
      createEngineeringPipeConnection({
        fromEquipment,
        fromPortId,
        toEquipment,
        toPortId,
        levelId,
        metadata: { template },
      })
    )
    .filter((pipe): pipe is EngineeringPipe => Boolean(pipe));

  return { equipment, pipes };
}
