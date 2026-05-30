import type { BuildingModel, Door, FloorSlab, Level, Roof, Room, Wall, Window } from "../../../entities/geometry/types";
import type { DuctNetwork, Equipment, PipeNetwork, SensorDevice } from "../../../entities/networks/types";
import { EQUIPMENT_TYPE_LABELS, PIPE_TYPE_LABELS, SENSOR_TYPE_LABELS } from "../../../entities/networks/types";
import { ENGINEERING_EQUIPMENT_LABELS, ENGINEERING_MEDIUM_LABELS } from "../engineering2d/catalog";
import { firstDisplayText } from "../../../shared/utils/displayText";
import { getRoomDisplayName as getVisibleRoomName } from "../../../shared/utils/roomNames";
import type { Selection } from "../build.store";

type RoomLikeModel = Pick<BuildingModel, "rooms">;
type LevelLikeModel = Pick<BuildingModel, "levels">;
type WallLikeModel = Pick<BuildingModel, "walls">;

const EQUIPMENT_ID_NAME_MAP: Record<string, string> = {
  "video-boiler": "Котёл резервный",
  "video-pump": "Насос",
  "video-heat-exchanger": "Водоподогреватель",
  "video-elevator": "Элеватор",
  "video-expansion-tank": "Расширительный бак",
  "video-dirt-separator": "Грязевик",
  "video-radiator-living": "Радиатор гостиной",
  "video-radiator-bedroom": "Радиатор спальни",
  "video-radiator-kitchen": "Радиатор кухни",
  "video-radiator-study": "Радиатор кабинета",
  "video-radiator-nursery": "Радиатор детской",
  "video-fancoil-hall": "Фанкойл холла",
  "video-ahu": "Приточная установка",
  "demo-boiler": "Котёл",
  "demo-pump": "Насос",
};

function sanitizeEquipmentToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function looksLikeTechnicalEquipmentId(value: string): boolean {
  return /^(?:video|demo)[-_]/i.test(value) || /(?:radiator|boiler|pump|ahu|diffuser|sensor)[-_a-z0-9]*$/i.test(value);
}

export function getEquipmentDisplayName(idOrName: string | null | undefined, equipment: Equipment[] = []): string {
  const token = sanitizeEquipmentToken(idOrName);
  if (token && EQUIPMENT_ID_NAME_MAP[token]) {
    return EQUIPMENT_ID_NAME_MAP[token];
  }
  if (token.includes("radiator-bedroom")) {
    return "Радиатор спальни";
  }
  if (token.includes("radiator-kitchen")) {
    return "Радиатор кухни";
  }
  if (token.includes("radiator-living")) {
    return "Радиатор гостиной";
  }
  if (token.endsWith("boiler")) {
    return "Котел";
  }
  if (token.endsWith("pump")) {
    return "Насос";
  }

  const item = token ? equipment.find((entry) => entry.id === idOrName) : undefined;
  if (item) {
    const specific = EQUIPMENT_ID_NAME_MAP[item.id];
    if (specific) {
      return specific;
    }
    const base = EQUIPMENT_TYPE_LABELS[item.type] ?? "Оборудование";
    const index = equipment.findIndex((entry) => entry.id === item.id);
    return index >= 0 && !looksLikeTechnicalEquipmentId(item.id) ? `${base} ${index + 1}` : base;
  }

  return "Оборудование";
}

export function getLevelDisplayLabel(model: LevelLikeModel, levelId: string | null): string {
  if (!levelId) {
    return "Без уровня";
  }
  const index = model.levels.findIndex((level) => level.id === levelId);
  const level = index >= 0 ? model.levels[index] : null;
  const levelMatch = levelId.match(/(?:video-)?level[-_]?(\d+)/i) ?? levelId.match(/lvl[-_]?(\d+)/i);
  if (levelMatch) {
    return `Уровень ${levelMatch[1]}`;
  }
  return firstDisplayText([level?.name], index >= 0 ? `Уровень ${index + 1}` : "Уровень", {
    allowInternalId: false,
  });
}

/** Подпись уровня с отметкой, как в переключателе этажей на панели инструментов. */
export function getLevelSummaryLabel(model: LevelLikeModel, levelId: string | null): string {
  const label = getLevelDisplayLabel(model, levelId);
  if (!levelId) {
    return label;
  }
  const level = model.levels.find((entry) => entry.id === levelId);
  if (!level) {
    return label;
  }
  const elevationLabel = `${level.elevation_m >= 0 ? "+" : ""}${level.elevation_m.toFixed(2)} м`;
  return `${label} ${elevationLabel}`;
}

/** Подпись этажа для инженерных карточек и hover (без raw levelId). */
export function getFloorDisplayLabel(model: LevelLikeModel, levelId: string | null): string {
  if (!levelId) {
    return "Не назначен";
  }
  return getLevelDisplayLabel(model, levelId).replace(/^Уровень\b/, "Этаж");
}

export function getRoomDisplayLabel(model: RoomLikeModel, roomId: string | null): string {
  if (!roomId) {
    return "Не привязано";
  }
  const index = model.rooms.findIndex((room) => room.id === roomId);
  const room = index >= 0 ? model.rooms[index] : null;
  return room ? getVisibleRoomName(room, index) : index >= 0 ? `Помещение ${index + 1}` : "Помещение";
}

const TECHNICAL_SEGMENT_LABELS: Record<string, string> = {
  north: "север",
  south: "юг",
  east: "восток",
  west: "запад",
  center: "центр",
  vert: "вертикаль",
  horiz: "горизонталь",
  lower: "низ",
  upper: "верх",
  living: "гостиная",
  bedroom: "спальня",
  kitchen: "кухня",
  utility: "техпомещение",
  study: "кабинет",
  nursery: "детская",
  hall: "холл",
  bathroom: "санузел",
  entry: "вход",
  main: "основная",
  ground: "по грунту",
  interfloor: "межэтажное",
  attic: "чердачное",
  roof: "кровля",
  slab: "перекрытие",
};

function humanizeTechnicalSegments(rawId: string): string[] {
  const stripped = rawId.trim().replace(/^(?:video|demo)[-_]/i, "");
  const labels: string[] = [];

  stripped.split(/[-_]+/).filter(Boolean).forEach((part) => {
    const lower = part.toLowerCase();
    if (lower === "win" || lower === "window" || lower === "door") {
      return;
    }
    const levelMatch = lower.match(/^l(\d+)$/);
    if (levelMatch) {
      labels.push(`${levelMatch[1]} этаж`);
      return;
    }
    const mapped = TECHNICAL_SEGMENT_LABELS[lower];
    if (mapped) {
      labels.push(mapped);
    }
  });

  return labels;
}

function resolveLevelLabel(model: LevelLikeModel, levelId: string | null, rawId?: string): string | null {
  if (levelId) {
    const fromModel = getLevelDisplayLabel(model, levelId);
    if (fromModel !== "Без уровня") {
      return fromModel.replace(/^Уровень\b/, "Этаж");
    }
  }
  const levelMatch = rawId?.match(/(?:video-)?l(\d+)/i);
  return levelMatch ? `${levelMatch[1]} этаж` : null;
}

function joinEnvelopeLabelParts(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(" · ");
}

function getWallTypeLabel(wall: Wall): string {
  if (wall.wallAssemblyId === "video-exterior-wall" || wall.envelopePresetId?.includes("exterior")) {
    return "Наружная стена";
  }
  if (
    wall.wallAssemblyId === "video-interior-wall" ||
    wall.envelopePresetId?.includes("interior") ||
    wall.envelopePresetId?.includes("partition")
  ) {
    return "Перегородка";
  }
  return "Стена";
}

export function getWallEnvelopeLabel(model: WallLikeModel & LevelLikeModel, wall: Wall): string {
  const segments = humanizeTechnicalSegments(wall.id);
  const levelLabel = resolveLevelLabel(model, wall.levelId, wall.id);
  const locationSegments = segments.filter((segment) => !segment.endsWith(" этаж"));
  const index = model.walls.findIndex((entry) => entry.id === wall.id);

  return joinEnvelopeLabelParts([
    getWallTypeLabel(wall),
    levelLabel && !segments.some((segment) => segment.endsWith(" этаж")) ? levelLabel : segments.find((segment) => segment.endsWith(" этаж")),
    locationSegments.length ? locationSegments.join(" · ") : index >= 0 ? `№${index + 1}` : null,
  ]);
}

function resolveOpeningLevelId(model: WallLikeModel, opening: Window | Door): string | null {
  const wallId = opening.anchor.wallId;
  if (!wallId) {
    return null;
  }
  return model.walls.find((wall) => wall.id === wallId)?.levelId ?? null;
}

export function getWindowEnvelopeLabel(model: WallLikeModel & LevelLikeModel, windowItem: Window, index: number): string {
  const segments = humanizeTechnicalSegments(windowItem.id);
  const levelLabel = resolveLevelLabel(model, resolveOpeningLevelId(model, windowItem), windowItem.id);
  const locationSegments = segments.filter((segment) => !segment.endsWith(" этаж"));

  return joinEnvelopeLabelParts([
    "Окно",
    levelLabel && !segments.some((segment) => segment.endsWith(" этаж")) ? levelLabel : segments.find((segment) => segment.endsWith(" этаж")),
    locationSegments.length ? locationSegments.join(" · ") : `№${index + 1}`,
  ]);
}

export function getDoorEnvelopeLabel(model: WallLikeModel & LevelLikeModel, door: Door, index: number): string {
  const segments = humanizeTechnicalSegments(door.id);
  const levelLabel = resolveLevelLabel(model, resolveOpeningLevelId(model, door), door.id);
  const locationSegments = segments.filter((segment) => !segment.endsWith(" этаж"));

  return joinEnvelopeLabelParts([
    "Дверь",
    levelLabel && !segments.some((segment) => segment.endsWith(" этаж")) ? levelLabel : segments.find((segment) => segment.endsWith(" этаж")),
    locationSegments.length ? locationSegments.join(" · ") : `№${index + 1}`,
  ]);
}

export function getRoofEnvelopeLabel(model: LevelLikeModel, roof: Roof, index: number): string {
  const cleanedName = roof.name?.trim();
  if (cleanedName && !/^(?:video|demo)[-_]/i.test(cleanedName)) {
    return cleanedName;
  }
  const segments = humanizeTechnicalSegments(roof.id);
  const levelLabel = resolveLevelLabel(model, roof.levelId ?? null, roof.id);
  const locationSegments = segments.filter((segment) => !segment.endsWith(" этаж") && segment !== "кровля");

  return joinEnvelopeLabelParts([
    "Кровля",
    levelLabel && !segments.some((segment) => segment.endsWith(" этаж")) ? levelLabel : segments.find((segment) => segment.endsWith(" этаж")),
    locationSegments.length ? locationSegments.join(" · ") : `№${index + 1}`,
  ]);
}

export function getSlabEnvelopeLabel(model: LevelLikeModel, slab: FloorSlab, index: number): string {
  const cleanedName = slab.name?.trim();
  if (cleanedName && !/^(?:video|demo)[-_]/i.test(cleanedName)) {
    return cleanedName;
  }
  const segments = humanizeTechnicalSegments(slab.id);
  const levelLabel = resolveLevelLabel(model, slab.levelId ?? null, slab.id);
  const locationSegments = segments.filter((segment) => !segment.endsWith(" этаж") && segment !== "перекрытие");

  return joinEnvelopeLabelParts([
    "Перекрытие",
    levelLabel && !segments.some((segment) => segment.endsWith(" этаж")) ? levelLabel : segments.find((segment) => segment.endsWith(" этаж")),
    locationSegments.length ? locationSegments.join(" · ") : `№${index + 1}`,
  ]);
}

export function getWallDisplayLabel(model: WallLikeModel & LevelLikeModel, wallId: string | null): string {
  if (!wallId) {
    return "Стена";
  }
  const wall = model.walls.find((entry) => entry.id === wallId);
  if (wall) {
    return getWallEnvelopeLabel(model, wall);
  }
  return "Стена";
}

export function getDoorDisplayLabel(doors: Door[], doorId: string | null): string {
  if (!doorId) {
    return "Дверь";
  }
  const index = doors.findIndex((door) => door.id === doorId);
  const doorMatch = doorId.match(/door[-_]?(\d+)/i);
  if (doorMatch) {
    return `Дверь ${doorMatch[1]}`;
  }
  return index >= 0 ? `Дверь ${index + 1}` : "Дверь";
}

export function getWindowDisplayLabel(windows: Window[], windowId: string | null): string {
  if (!windowId) {
    return "Окно";
  }
  const index = windows.findIndex((window) => window.id === windowId);
  const windowMatch = windowId.match(/win(?:dow)?[-_]?(\d+)/i);
  if (windowMatch) {
    return `Окно ${windowMatch[1]}`;
  }
  return index >= 0 ? `Окно ${index + 1}` : "Окно";
}

export function getPipeDisplayLabel(pipes: PipeNetwork[], pipeId: string | null): string {
  if (!pipeId) {
    return "Труба";
  }
  const index = pipes.findIndex((pipe) => pipe.id === pipeId);
  const pipe = index >= 0 ? pipes[index] : null;
  const base = pipe ? PIPE_TYPE_LABELS[pipe.type] : "Труба";
  return index >= 0 ? `${base} ${index + 1}` : base;
}

export function getDuctDisplayLabel(ducts: DuctNetwork[], ductId: string | null): string {
  if (!ductId) {
    return "Воздуховод";
  }
  const index = ducts.findIndex((duct) => duct.id === ductId);
  return index >= 0 ? `Воздуховод ${index + 1}` : "Воздуховод";
}

export function getEquipmentDisplayLabel(equipment: Equipment[], equipmentId: string | null): string {
  if (!equipmentId) {
    return "Оборудование";
  }
  const specific = getEquipmentDisplayName(equipmentId, equipment);
  if (specific !== "Оборудование") {
    return specific;
  }
  const index = equipment.findIndex((item) => item.id === equipmentId);
  const item = index >= 0 ? equipment[index] : null;
  const base = item ? EQUIPMENT_TYPE_LABELS[item.type] : "Оборудование";
  return index >= 0 ? `${base} ${index + 1}` : base;
}

export function getSensorDisplayLabel(sensors: SensorDevice[], sensorId: string | null): string {
  if (!sensorId) {
    return "Датчик";
  }
  const index = sensors.findIndex((sensor) => sensor.id === sensorId);
  const sensor = index >= 0 ? sensors[index] : null;
  const base = sensor ? SENSOR_TYPE_LABELS[sensor.type] : "Датчик";
  return index >= 0 ? `${base} ${index + 1}` : base;
}

export function getEngineeringEquipmentDisplayLabel(model: BuildingModel, equipmentId: string | null): string {
  if (!equipmentId) {
    return "Инженерное оборудование";
  }
  const equipment = model.engineeringSystems?.equipment ?? [];
  const index = equipment.findIndex((item) => item.id === equipmentId);
  const item = index >= 0 ? equipment[index] : null;
  const base = item ? ENGINEERING_EQUIPMENT_LABELS[item.type] : "Инженерное оборудование";
  return item?.name?.trim() || (index >= 0 ? `${base} ${index + 1}` : base);
}

export function getEngineeringPipeDisplayLabel(model: BuildingModel, pipeId: string | null): string {
  if (!pipeId) {
    return "Инженерный трубопровод";
  }
  const pipes = model.engineeringSystems?.pipes ?? [];
  const index = pipes.findIndex((pipe) => pipe.id === pipeId);
  const pipe = index >= 0 ? pipes[index] : null;
  const medium = pipe ? ENGINEERING_MEDIUM_LABELS[pipe.medium] : "Трубопровод";
  return index >= 0 ? `${medium} ${index + 1}` : medium;
}

export function getSelectionDisplayLabel(model: BuildingModel, selection: Selection): string | null {
  if (!selection) {
    return null;
  }
  if (selection.kind === "engineeringEquipment") {
    return getEngineeringEquipmentDisplayLabel(model, selection.id);
  }
  if (selection.kind === "engineeringPipe") {
    return getEngineeringPipeDisplayLabel(model, selection.id);
  }
  switch (selection.kind) {
    case "room":
      return getRoomDisplayLabel(model, selection.id);
    case "wall":
      return getWallDisplayLabel(model, selection.id);
    case "door":
      return getDoorDisplayLabel(model.doors, selection.id);
    case "window":
      return getWindowDisplayLabel(model.windows, selection.id);
    case "pipe":
      return getPipeDisplayLabel(model.pipes, selection.id);
    case "duct":
      return getDuctDisplayLabel(model.ducts, selection.id);
    case "equipment":
      return getEquipmentDisplayLabel(model.equipment, selection.id);
    case "sensor":
      return getSensorDisplayLabel(model.sensors, selection.id);
    case "loop":
      return "Замкнутый контур";
    default:
      return null;
  }
}

export function buildLevelName(index: number): string {
  return `Уровень ${Math.max(1, index)}`;
}

export function buildRoomName(index: number): string {
  return `Помещение ${Math.max(1, index)}`;
}

export function describeLevel(level: Level, index: number): string {
  return firstDisplayText([level.name], buildLevelName(index + 1), { allowInternalId: false });
}

export function describeRoom(room: Room, index: number): string {
  return getVisibleRoomName(room, index);
}

export function compactRoomLabel(room: Pick<Room, "id" | "name">, index = 0, maxLength = 20): string {
  let cleaned = getVisibleRoomName(room, index)
    .replace(/помещение/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.toLowerCase() === "санузел и техпомещение" && maxLength <= 22) {
    cleaned = "Санузел";
  }
  if (!cleaned) {
    cleaned = `Помещение ${Math.max(1, index + 1)}`;
  }
  return cleaned.length > maxLength ? `${cleaned.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…` : cleaned;
}
