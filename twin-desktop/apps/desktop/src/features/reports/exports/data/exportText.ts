import type { BuildingModel, Room } from "../../../../entities/geometry/types";
import { sanitizeDisplayText } from "../../../../shared/utils/displayText";
import { getRoomDisplayName } from "../../../../shared/utils/roomNames";

const UNNAMED_ROOM_PREFIX = "Помещение без наименования №";
const GENERATED_ROOM_NAME_PATTERN = /^(?:space|room|помещение)\s*[-_#]?\s*(\d+)$/i;
const UNNAMED_ROOM_PATTERN = /^помещение\s+без\s+наименования\s*№?\s*(\d+)$/i;
const AUTO_ROOM_PATTERN = /\bauto-room-[a-z0-9_-]+\b/gi;
const RAW_MODEL_ID_PATTERN = /\bvideo-[a-z0-9_-]+\b/gi;

interface RoomDisplayInfo {
  id: string;
  label: string;
  sentenceLabel: string;
  rawName: string;
}

export function formatRoomDisplayName(
  room: Pick<Room, "id" | "name">,
  index = 0
): string {
  const sourceName = typeof room.name === "string" ? room.name.trim() : "";
  const sharedLabel = getRoomDisplayName(room, index);
  const generatedIndex =
    extractGeneratedRoomNumber(sourceName) ??
    extractGeneratedRoomNumber(sharedLabel) ??
    index + 1;

  if (
    isGeneratedRoomName(sourceName) ||
    /^Помещение\s+\d+$/i.test(sharedLabel) ||
    UNNAMED_ROOM_PATTERN.test(sharedLabel)
  ) {
    return `${UNNAMED_ROOM_PREFIX}${generatedIndex}`;
  }

  const sanitized = sanitizeDisplayText(sharedLabel, "", { allowInternalId: false });
  return sanitized || `${UNNAMED_ROOM_PREFIX}${generatedIndex}`;
}

export function humanizeProjectText(message: string, model: BuildingModel): string {
  const source = normalizeSentence(message);
  if (!source) {
    return "";
  }

  const lookup = buildRoomLookup(model);
  const zoneWithIdMatch = source.match(/(?:зона|помещение)\s+[«"]([^"»]+)[»"]\s*\(([^)]+)\)/i);
  const zoneNameMatch = source.match(/(?:зона|помещение)\s+[«"]([^"»]+)[»"]/i);
  const contourIssue =
    /в графе смежности нет наружных стен/i.test(source) ||
    /запасной наружный контур/i.test(source);

  if (contourIssue) {
    const roomInfo = resolveRoomInfo(
      lookup,
      zoneWithIdMatch?.[2] ?? null,
      zoneWithIdMatch?.[1] ?? zoneNameMatch?.[1] ?? null
    );
    if (roomInfo) {
      return `Для ${roomInfo.sentenceLabel} требуется уточнение привязки к ограждающим конструкциям. Геометрическая связность помещения требует проверки перед выпуском проектной документации.`;
    }
    return "Геометрическая связность помещения требует проверки перед выпуском проектной документации.";
  }

  let result = replaceRoomTokens(source, lookup);
  result = result.replace(/\s*\((?:auto-room|video-room|room)[^)]+\)/gi, "");
  result = result.replace(AUTO_ROOM_PATTERN, "");
  result = result.replace(RAW_MODEL_ID_PATTERN, "");
  result = result.replace(/добавлен запасной наружный контур[^.]*\.?/gi, "");
  result = result.replace(/в графе смежности нет наружных стен[^.]*\.?/gi, "");
  result = result.replace(/\(\s*\)/g, "");

  return normalizeSentence(result);
}

function buildRoomLookup(model: BuildingModel): RoomDisplayInfo[] {
  return model.rooms.map((room, index) => {
    const label = formatRoomDisplayName(room, index);
    return {
      id: room.id,
      label,
      sentenceLabel: label.startsWith(UNNAMED_ROOM_PREFIX)
        ? label.replace(/^Помещение/, "помещения")
        : `помещения «${label}»`,
      rawName: typeof room.name === "string" ? room.name.trim() : "",
    };
  });
}

function resolveRoomInfo(
  lookup: RoomDisplayInfo[],
  roomId: string | null,
  roomName: string | null
): RoomDisplayInfo | null {
  if (roomId) {
    const byId = lookup.find((room) => room.id === roomId.trim());
    if (byId) {
      return byId;
    }
  }

  if (roomName) {
    const normalizedName = normalizeSentence(roomName);
    const byName = lookup.find((room) => normalizeSentence(room.rawName) === normalizedName);
    if (byName) {
      return byName;
    }
  }

  return null;
}

function replaceRoomTokens(source: string, lookup: RoomDisplayInfo[]): string {
  let result = source
    .replace(/\bSpace\s+(\d+)\b/gi, (_match, index) => `${UNNAMED_ROOM_PREFIX}${index}`)
    .replace(/\bRoom\s+(\d+)\b/gi, (_match, index) => `${UNNAMED_ROOM_PREFIX}${index}`)
    .replace(/\bПомещение\s+(\d+)\b/gi, (_match, index) => `${UNNAMED_ROOM_PREFIX}${index}`);

  const tokens = lookup
    .flatMap((room) => {
      const replacements: Array<{ token: string; label: string }> = [];
      if (room.id) {
        replacements.push({ token: room.id, label: room.label });
      }
      if (room.rawName && room.rawName !== room.label) {
        replacements.push({ token: room.rawName, label: room.label });
      }
      return replacements;
    })
    .sort((left, right) => right.token.length - left.token.length);

  for (const { token, label } of tokens) {
    if (!token) {
      continue;
    }
    result = result.replace(new RegExp(escapeRegExp(token), "g"), label);
  }

  return result;
}

function isGeneratedRoomName(value: string): boolean {
  if (!value) {
    return true;
  }
  return GENERATED_ROOM_NAME_PATTERN.test(value.trim()) || /^auto-room-/i.test(value.trim());
}

function extractGeneratedRoomNumber(value: string): number | null {
  const unnamedMatch = value.match(UNNAMED_ROOM_PATTERN);
  if (unnamedMatch) {
    return Number.parseInt(unnamedMatch[1], 10);
  }
  const generatedMatch = value.match(GENERATED_ROOM_NAME_PATTERN);
  if (generatedMatch) {
    return Number.parseInt(generatedMatch[1], 10);
  }
  return null;
}

function normalizeSentence(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([:;])\s*[:;]+/g, "$1 ")
    .replace(/\.\.+/g, ".")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
