import type { BuildingModel } from "../../../entities/geometry/types";
import type { Orientation } from "../../graph/adjacency";
import { sanitizeDisplayText } from "../../../shared/utils/displayText";
import { getRoomDisplayName as getVisibleRoomName } from "../../../shared/utils/roomNames";

export function getRoomDisplayName(model: BuildingModel, roomId: string | null): string {
  if (!roomId) {
    return "Без привязки к помещению";
  }
  const roomIndex = model.rooms.findIndex((room) => room.id === roomId);
  const room = roomIndex >= 0 ? model.rooms[roomIndex] : null;
  return room ? getVisibleRoomName(room, roomIndex) : roomIndex >= 0 ? `Помещение ${roomIndex + 1}` : "Помещение";
}

export function getLevelDisplayName(model: BuildingModel, levelId: string | null): string {
  if (!levelId) {
    return "Без уровня";
  }
  const levelIndex = model.levels.findIndex((level) => level.id === levelId);
  const level = levelIndex >= 0 ? model.levels[levelIndex] : null;
  return sanitizeDisplayText(level?.name, levelIndex >= 0 ? `Уровень ${levelIndex + 1}` : "Уровень", {
    allowInternalId: false,
  });
}

export function getOrientationWallLabel(orientation: Orientation | null): string {
  switch (orientation) {
    case "N":
      return "северная стена";
    case "E":
      return "восточная стена";
    case "S":
      return "южная стена";
    case "W":
      return "западная стена";
    default:
      return "наружная стена";
  }
}

export function getOrientationWindowLabel(orientation: Orientation | null): string {
  switch (orientation) {
    case "N":
      return "северное окно";
    case "E":
      return "восточное окно";
    case "S":
      return "южное окно";
    case "W":
      return "западное окно";
    default:
      return "оконный проём";
  }
}

export function getOrientationAdjective(orientation: Orientation | null): string | null {
  switch (orientation) {
    case "N":
      return "северная";
    case "E":
      return "восточная";
    case "S":
      return "южная";
    case "W":
      return "западная";
    default:
      return null;
  }
}

export function getEnvelopeElementLabel(
  kind: "wall" | "window" | "door" | "floor" | "roof",
  orientation: Orientation | null,
  roomName: string
): string {
  switch (kind) {
    case "wall":
      return orientation ? `Наружная стена, ${getOrientationAdjective(orientation)}` : `Наружная стена, ${roomName}`;
    case "window":
      return orientation ? `Окно, ${getOrientationAdjective(orientation)}` : `Окно, ${roomName}`;
    case "door":
      return orientation ? `Дверь, ${getOrientationAdjective(orientation)}` : `Дверь, ${roomName}`;
    case "floor":
      return `Пол, ${roomName}`;
    case "roof":
      return `Покрытие, ${roomName}`;
    default:
      return roomName;
  }
}

export function formatConfidenceLabel(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "Высокая";
    case "medium":
      return "Средняя";
    case "low":
      return "Низкая";
    default:
      return sanitizeDisplayText(level, "Оценка");
  }
}

export function formatInputOriginLabel(origin: "measured" | "user" | "default" | "derived"): string {
  switch (origin) {
    case "measured":
      return "измерено";
    case "user":
      return "задано";
    case "default":
      return "по умолчанию";
    case "derived":
      return "вычислено";
    default:
      return sanitizeDisplayText(origin, "источник");
  }
}

export function formatIfcEditabilityLabel(editable: boolean): string {
  return editable ? "IFC: редактируемый" : "IFC: только просмотр";
}
