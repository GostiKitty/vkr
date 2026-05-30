import type { Vec2 } from "../../../entities/geometry/types";
import type { DuctNetwork, Equipment, EquipmentType, PipeNetwork } from "../../../entities/networks/types";

export type ConnectionPointRole =
  | "supplyIn"
  | "supplyOut"
  | "returnIn"
  | "returnOut"
  | "flowIn"
  | "flowOut"
  | "signal"
  | "drain"
  | "airIn"
  | "airOut";

export type ConnectionPointMedium = "pipe" | "duct";

export interface EquipmentConnectionPoint {
  id: string;
  role: ConnectionPointRole;
  medium: ConnectionPointMedium;
  position: Vec2;
  normal: Vec2;
  label: string;
}

type PointTemplate = {
  role: ConnectionPointRole;
  medium: ConnectionPointMedium;
  offset: Vec2;
  normal: Vec2;
  label: string;
};

const PIPE_PORTS_BY_TYPE: Partial<Record<EquipmentType, PointTemplate[]>> = {
  radiator: [
    { role: "supplyIn", medium: "pipe", offset: { x: -0.33, y: -0.08 }, normal: { x: -1, y: 0 }, label: "Подача" },
    { role: "returnOut", medium: "pipe", offset: { x: 0.33, y: 0.08 }, normal: { x: 1, y: 0 }, label: "Обратка" },
  ],
  pump: [
    { role: "flowIn", medium: "pipe", offset: { x: -0.28, y: 0 }, normal: { x: -1, y: 0 }, label: "Вход" },
    { role: "flowOut", medium: "pipe", offset: { x: 0.28, y: 0 }, normal: { x: 1, y: 0 }, label: "Выход" },
  ],
  boiler: [
    { role: "returnIn", medium: "pipe", offset: { x: -0.32, y: 0.16 }, normal: { x: -1, y: 0 }, label: "Обратка" },
    { role: "supplyOut", medium: "pipe", offset: { x: 0.32, y: -0.16 }, normal: { x: 1, y: 0 }, label: "Подача" },
  ],
  heat_exchanger: [
    // Порты строго на контуре символа теплообменника (левый/правый борт).
    { role: "supplyIn", medium: "pipe", offset: { x: -0.5, y: 0 }, normal: { x: -1, y: 0 }, label: "Первичный вход" },
    { role: "supplyOut", medium: "pipe", offset: { x: 0.5, y: 0 }, normal: { x: 1, y: 0 }, label: "Первичный выход" },
    { role: "returnIn", medium: "pipe", offset: { x: -0.5, y: 0 }, normal: { x: -1, y: 0 }, label: "Вторичный вход" },
    { role: "returnOut", medium: "pipe", offset: { x: 0.5, y: 0 }, normal: { x: 1, y: 0 }, label: "Вторичный выход" },
  ],
  elevator: [
    { role: "supplyIn", medium: "pipe", offset: { x: -0.3, y: -0.1 }, normal: { x: -1, y: 0 }, label: "Подача" },
    { role: "returnIn", medium: "pipe", offset: { x: -0.3, y: 0.12 }, normal: { x: -1, y: 0 }, label: "Подмес" },
    { role: "flowOut", medium: "pipe", offset: { x: 0.3, y: 0 }, normal: { x: 1, y: 0 }, label: "Выход" },
  ],
  expansion_tank: [
    { role: "returnIn", medium: "pipe", offset: { x: 0, y: 0.28 }, normal: { x: 0, y: 1 }, label: "Подключение" },
  ],
  dirt_separator: [
    // Крупная подгонка: точки подключения ставим прямо на контур грязевика.
    { role: "flowIn", medium: "pipe", offset: { x: -0.028, y: -0.01 }, normal: { x: -1, y: 0 }, label: "Вход" },
    { role: "flowOut", medium: "pipe", offset: { x: 0.028, y: -0.01 }, normal: { x: 1, y: 0 }, label: "Выход" },
    { role: "drain", medium: "pipe", offset: { x: 0, y: 0.12 }, normal: { x: 0, y: 1 }, label: "Слив" },
  ],
  fancoil: [
    { role: "supplyIn", medium: "pipe", offset: { x: -0.28, y: 0.14 }, normal: { x: -1, y: 0 }, label: "Подача" },
    { role: "returnOut", medium: "pipe", offset: { x: 0.28, y: 0.14 }, normal: { x: 1, y: 0 }, label: "Обратка" },
    { role: "airIn", medium: "duct", offset: { x: -0.3, y: -0.14 }, normal: { x: -1, y: 0 }, label: "Воздух" },
    { role: "airOut", medium: "duct", offset: { x: 0.3, y: -0.14 }, normal: { x: 1, y: 0 }, label: "Подача воздуха" },
  ],
  ahu: [
    { role: "airIn", medium: "duct", offset: { x: -0.38, y: 0 }, normal: { x: -1, y: 0 }, label: "Приток" },
    { role: "airOut", medium: "duct", offset: { x: 0.38, y: 0 }, normal: { x: 1, y: 0 }, label: "Выдача" },
  ],
  diffuser: [
    { role: "airIn", medium: "duct", offset: { x: 0, y: -0.26 }, normal: { x: 0, y: -1 }, label: "Подключение" },
  ],
};

export function getEquipmentConnectionPoints(equipment: Pick<Equipment, "id" | "type" | "position">): EquipmentConnectionPoint[] {
  const templates = PIPE_PORTS_BY_TYPE[equipment.type] ?? [];
  return templates.map((template, index) => ({
    id: `${equipment.id}:${template.role}:${index}`,
    role: template.role,
    medium: template.medium,
    normal: template.normal,
    label: template.label,
    position: {
      x: equipment.position.x + template.offset.x,
      y: equipment.position.y + template.offset.y,
    },
  }));
}

export function connectionPointSupportsPipe(point: EquipmentConnectionPoint): boolean {
  return point.medium === "pipe";
}

export function connectionPointSupportsDuct(point: EquipmentConnectionPoint): boolean {
  return point.medium === "duct";
}

export function getNetworkEndpointConnectionIds(
  network: Pick<PipeNetwork | DuctNetwork, "path" | "id">,
  equipment: Equipment[],
  medium: ConnectionPointMedium,
  tolerance = 0.42
): string[] {
  if (network.path.length < 2) {
    return [];
  }
  const endpoints = [network.path[0], network.path[network.path.length - 1]];
  const connected = new Set<string>();
  equipment.forEach((item) => {
    const points = getEquipmentConnectionPoints(item).filter((point) => point.medium === medium);
    if (!points.length) {
      return;
    }
    if (
      endpoints.some((endpoint) =>
        points.some((point) => Math.hypot(endpoint.x - point.position.x, endpoint.y - point.position.y) <= tolerance)
      )
    ) {
      connected.add(item.id);
    }
  });
  return [...connected];
}
