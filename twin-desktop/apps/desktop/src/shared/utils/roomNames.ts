import type { BuildingModel, Room } from "../../entities/geometry/types";
import type { Space } from "../api/types";
import { sanitizeDisplayText } from "./displayText";

const ROOM_USAGE_LABELS: Record<string, string> = {
  kitchen: "Кухня",
  living: "Гостиная",
  bedroom: "Спальня",
  bathroom: "Санузел",
  technical: "Техпомещение",
  corridor: "Коридор",
  hall: "Холл",
  room: "Помещение",
};

const TECHNICAL_ROOM_NAME_PATTERN =
  /^(?:space|room|room-\w+|space-\w+|помещение|room[_-]?\d+|space[_-]?\d+|video-room[-\w]*|demo[-\w]*|space\d+)\s*[-_#]?\s*\d*$/i;
const TECHNICAL_ROOM_TOKEN_PATTERN =
  /\b(?:space|room|video|demo|space\d+|room\d+|помещение)\b(?:[-_#]?\d+|[-_][a-z0-9]+)?/gi;

type RoomDisplaySource = Pick<Room, "id" | "name"> & {
  long_name?: string | null;
  usage?: string | null;
  type?: string | null;
  roomType?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeRoomUsage(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized ? ROOM_USAGE_LABELS[normalized] ?? null : null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeTechnicalRoomId(value: string): boolean {
  return TECHNICAL_ROOM_NAME_PATTERN.test(value.trim()) || /^[a-z]+(?:[-_][a-z0-9]+)+$/i.test(value.trim());
}

function stripTechnicalTokens(value: string): string {
  return normalizeWhitespace(
    value
      .replace(TECHNICAL_ROOM_TOKEN_PATTERN, " ")
      .replace(/\b(?:id|roomid|spaceid)\b[:#-]?\s*[a-z0-9_-]+/gi, " ")
      .replace(/\bпомещение\s+\d+\b/gi, " ")
      .replace(/\bсанузел\s+и\s+техпомещение\b/gi, "Санузел и техпомещение")
  );
}

function extractUsageLabels(room: RoomDisplaySource, visibleName: string | null): string[] {
  const candidates = [
    visibleName,
    room.usage,
    room.type,
    room.roomType,
    room.metadata?.usage,
    room.metadata?.type,
    room.metadata?.roomType,
  ];
  const labels = new Set<string>();

  candidates.forEach((candidate) => {
    const normalized = normalizeRoomUsage(candidate);
    if (normalized) {
      labels.add(normalized);
    }
  });

  const name = (visibleName ?? "").toLowerCase();
  if (name.includes("сануз")) {
    labels.add("Санузел");
  }
  if (name.includes("тех")) {
    labels.add("Техпомещение");
  }
  if (name.includes("кух")) {
    labels.add("Кухня");
  }
  if (name.includes("гостин")) {
    labels.add("Гостиная");
  }
  if (name.includes("спаль")) {
    labels.add("Спальня");
  }
  if (name.includes("корид")) {
    labels.add("Коридор");
  }
  if (name.includes("хол")) {
    labels.add("Холл");
  }

  return [...labels];
}

function getCandidateRoomName(room: RoomDisplaySource): string | null {
  const candidates = [room.name, room.long_name];
  for (const candidate of candidates) {
    const sanitized = sanitizeDisplayText(candidate, "");
    if (!sanitized || looksLikeTechnicalRoomId(sanitized)) {
      continue;
    }
    const cleaned = stripTechnicalTokens(sanitized);
    if (cleaned && !looksLikeTechnicalRoomId(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

/** Заменяет технические имена вроде Space 2 на локализованное «Помещение N». */
export function normalizeStoredRoomName(room: RoomDisplaySource, index = 0): string | null {
  const raw = typeof room.name === "string" ? room.name.trim() : "";
  if (!raw || !looksLikeTechnicalRoomId(raw)) {
    return null;
  }
  const display = getRoomDisplayName(room, index);
  return display !== raw ? display : null;
}

export function normalizeModelRoomNames(model: BuildingModel): BuildingModel {
  let changed = false;
  const rooms = model.rooms.map((room, index) => {
    const normalized = normalizeStoredRoomName(room, index);
    if (!normalized) {
      return room;
    }
    changed = true;
    return { ...room, name: normalized };
  });
  return changed ? { ...model, rooms } : model;
}

export function getRoomDisplayName(room: RoomDisplaySource, index = 0): string {
  const visibleName = getCandidateRoomName(room);
  const usageLabels = extractUsageLabels(room, visibleName);

  if (visibleName) {
    if (usageLabels.includes("Санузел") && usageLabels.includes("Техпомещение")) {
      return "Санузел и техпомещение";
    }
    return visibleName;
  }

  if (usageLabels.includes("Санузел") && usageLabels.includes("Техпомещение")) {
    return "Санузел и техпомещение";
  }
  if (usageLabels.length > 0) {
    return usageLabels[0];
  }

  return `Помещение ${Math.max(1, index + 1)}`;
}

export function getSpaceDisplayName(space: Pick<Space, "name" | "long_name">, index = 0): string {
  return getRoomDisplayName({ id: `space-${index + 1}`, ...space }, index);
}
