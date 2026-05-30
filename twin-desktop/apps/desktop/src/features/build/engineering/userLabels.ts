import type { BuildingModel } from "../../../entities/geometry/types";
import type {
  Equipment,
  EquipmentState,
  PipeMaterial,
  PipeNetwork,
  SensorDevice,
  SensorStatus,
} from "../../../entities/networks/types";
import {
  EQUIPMENT_TYPE_LABELS,
  NETWORK_SYSTEM_TYPE_LABELS,
  PIPE_CIRCUIT_ROLE_LABELS,
  PIPE_FLOW_ROLE_LABELS,
  PIPE_TYPE_LABELS,
  resolveNetworkSystemType,
  resolvePipeCircuitRole,
  SENSOR_TYPE_LABELS,
} from "../../../entities/networks/types";
import {
  getEquipmentDisplayName,
  getFloorDisplayLabel,
  getRoomDisplayLabel,
} from "../utils/entityLabels";

const PIPE_MATERIAL_LABELS: Record<PipeMaterial, string> = {
  steel: "Сталь",
  pex: "PEX",
  copper: "Медь",
  polypropylene: "Полипропилен",
};

const SENSOR_STATUS_LABELS: Record<SensorStatus, string> = {
  normal: "Норма",
  warning: "Предупреждение",
  alarm: "Авария",
};

const EQUIPMENT_STATE_LABELS: Record<EquipmentState, string> = {
  on: "Включено",
  off: "Выключено",
  alarm: "Авария",
};

const EQUIPMENT_PURPOSE_LABELS: Partial<Record<Equipment["type"], string>> = {
  radiator: "Отопление помещения",
  boiler: "Теплогенерация",
  heat_exchanger: "Тепловой пункт",
  pump: "Циркуляция теплоносителя",
  elevator: "Регулирование подачи",
  expansion_tank: "Компенсация объёма",
  dirt_separator: "Очистка теплоносителя",
  fancoil: "Отопление / охлаждение",
  ahu: "Приточная вентиляция",
  diffuser: "Раздача воздуха",
};

export function formatHeatingCircuitLabel(systemId: string | null | undefined): string {
  const token = (systemId ?? "").trim();
  if (!token) {
    return "Не задан";
  }
  if (/^video-heating$/i.test(token) || /отоплен/i.test(token)) {
    return "Отопление";
  }
  if (/^video-vent/i.test(token) || /вентил/i.test(token)) {
    return "Вентиляция";
  }
  return token.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatPipeMaterialLabel(material: PipeMaterial | undefined): string {
  if (!material) {
    return "Не задан";
  }
  return PIPE_MATERIAL_LABELS[material] ?? "Не задан";
}

export function formatSensorStatusLabel(status: SensorStatus | undefined): string {
  if (!status) {
    return "Нет данных";
  }
  return SENSOR_STATUS_LABELS[status] ?? "Нет данных";
}

export function formatEquipmentStateLabel(state: EquipmentState | undefined): string {
  if (!state) {
    return "Не задано";
  }
  return EQUIPMENT_STATE_LABELS[state] ?? "Не задано";
}

export function describeSupplyReturnRole(pipe: PipeNetwork | undefined): string {
  if (!pipe) {
    return "Не задано";
  }
  if (pipe.type === "heating_supply" || pipe.flowRole === "supply" || pipe.circuitRole === "supply") {
    return "Подача";
  }
  if (pipe.type === "heating_return" || pipe.flowRole === "return" || pipe.circuitRole === "return") {
    return "Обратка";
  }
  const circuitRole = pipe.circuitRole ?? resolvePipeCircuitRole(pipe.type);
  if (circuitRole === "supply" || circuitRole === "return" || circuitRole === "mixed") {
    return PIPE_CIRCUIT_ROLE_LABELS[circuitRole];
  }
  const flowRole = pipe.flowRole;
  if (flowRole && flowRole in PIPE_FLOW_ROLE_LABELS) {
    return PIPE_FLOW_ROLE_LABELS[flowRole];
  }
  return "Не задано";
}

export function describeEquipmentConnectionStatus(equipment: Equipment, pipes: PipeNetwork[]): string {
  const linked = pipes.filter((pipe) => equipment.connectedNetworkIds.includes(pipe.id));
  if (!linked.length) {
    return "Требуется проверка";
  }
  const hasSupply = linked.some((pipe) => pipe.type === "heating_supply" || pipe.flowRole === "supply");
  const hasReturn = linked.some((pipe) => pipe.type === "heating_return" || pipe.flowRole === "return");
  if (hasSupply && hasReturn) {
    return "Подключено";
  }
  if (linked.length > 0) {
    return "Частично подключено";
  }
  return "Требуется проверка";
}

export function getEquipmentPurposeLabel(type: Equipment["type"]): string {
  return EQUIPMENT_PURPOSE_LABELS[type] ?? EQUIPMENT_TYPE_LABELS[type] ?? "Инженерное оборудование";
}

export function buildEquipmentHoverDetails(model: BuildingModel, equipment: Equipment): string[] {
  const linkedPipes = model.pipes.filter((pipe) => equipment.connectedNetworkIds.includes(pipe.id));
  const primaryPipe = linkedPipes[0];
  const power =
    typeof equipment.params.nominalPowerW === "number" && Number.isFinite(equipment.params.nominalPowerW)
      ? `${equipment.params.nominalPowerW.toFixed(0)} Вт`
      : "Не задана";

  return [
    `Этаж: ${getFloorDisplayLabel(model, equipment.levelId)}`,
    `Помещение: ${equipment.roomId ? getRoomDisplayLabel(model, equipment.roomId) : "Не назначено"}`,
    `Контур: ${formatHeatingCircuitLabel(equipment.params.assignedSystemId)}`,
    `Тип: ${EQUIPMENT_TYPE_LABELS[equipment.type]}`,
    `Подключение: ${describeSupplyReturnRole(primaryPipe)} · ${describeEquipmentConnectionStatus(equipment, model.pipes)}`,
    `Мощность: ${power}`,
    `Состояние: ${formatEquipmentStateLabel(equipment.state)}`,
  ];
}

export function buildPipeHoverDetails(pipe: PipeNetwork): string[] {
  return [
    `Контур: ${formatHeatingCircuitLabel(pipe.heatingSystemId)}`,
    `Система: ${NETWORK_SYSTEM_TYPE_LABELS[pipe.systemType ?? resolveNetworkSystemType(pipe.type)]}`,
    `Назначение: ${PIPE_TYPE_LABELS[pipe.type]}`,
    `Роль: ${describeSupplyReturnRole(pipe)}`,
    `Диаметр: ${Math.round(pipe.diameter_mm)} мм`,
    `Материал: ${formatPipeMaterialLabel(pipe.material)}`,
  ];
}

export function buildDuctHoverDetails(duct: { airflow_m3_s: number; connectedEquipmentIds: string[]; section: { shape: string; width_mm?: number; height_mm?: number } }): string[] {
  const width = duct.section.width_mm ?? 300;
  const height = duct.section.height_mm ?? 220;
  return [
    `Контур: Вентиляция`,
    `Сечение: ${duct.section.shape === "round" ? "круглое" : "прямоугольное"}`,
    `Размер: ${Math.round(width)}×${Math.round(height)} мм`,
    `Расход: ${duct.airflow_m3_s.toFixed(2)} м³/с`,
    `Подключений: ${duct.connectedEquipmentIds.length || "нет"}`,
  ];
}

export function buildSensorHoverDetails(model: BuildingModel, sensor: SensorDevice): string[] {
  const value =
    sensor.value != null && Number.isFinite(sensor.value)
      ? `${sensor.value.toFixed(1)} ${sensor.unit}`
      : "Нет данных";
  return [
    `Этаж: ${getFloorDisplayLabel(model, sensor.levelId)}`,
    `Помещение: ${sensor.roomId ? getRoomDisplayLabel(model, sensor.roomId) : "Не назначено"}`,
    `Тип: ${SENSOR_TYPE_LABELS[sensor.type]}`,
    `Показание: ${value}`,
    `Состояние: ${formatSensorStatusLabel(sensor.status)}`,
  ];
}

export function getEquipmentInspectorTitle(equipment: Equipment, allEquipment: Equipment[]): string {
  return getEquipmentDisplayName(equipment.id, allEquipment);
}
