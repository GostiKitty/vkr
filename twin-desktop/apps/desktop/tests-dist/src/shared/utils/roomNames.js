import { sanitizeDisplayText } from "./displayText";
const ROOM_USAGE_LABELS = {
    kitchen: "Кухня",
    living: "Гостиная",
    bedroom: "Спальня",
    bathroom: "Санузел",
    technical: "Техпомещение",
    corridor: "Коридор",
    hall: "Холл",
    room: "Помещение",
};
const TECHNICAL_ROOM_NAME_PATTERN = /^(?:space|room|room-\w+|space-\w+|помещение|room[_-]?\d+|space[_-]?\d+|video-room[-\w]*|demo[-\w]*|space\d+)\s*[-_#]?\s*\d*$/i;
const TECHNICAL_ROOM_TOKEN_PATTERN = /\b(?:space|room|video|demo|space\d+|room\d+|помещение)\b(?:[-_#]?\d+|[-_][a-z0-9]+)?/gi;
function normalizeRoomUsage(value) {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    return normalized ? ROOM_USAGE_LABELS[normalized] ?? null : null;
}
function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
function looksLikeTechnicalRoomId(value) {
    return TECHNICAL_ROOM_NAME_PATTERN.test(value.trim()) || /^[a-z]+(?:[-_][a-z0-9]+)+$/i.test(value.trim());
}
function stripTechnicalTokens(value) {
    return normalizeWhitespace(value
        .replace(TECHNICAL_ROOM_TOKEN_PATTERN, " ")
        .replace(/\b(?:id|roomid|spaceid)\b[:#-]?\s*[a-z0-9_-]+/gi, " ")
        .replace(/\bпомещение\s+\d+\b/gi, " ")
        .replace(/\bсанузел\s+и\s+техпомещение\b/gi, "Санузел и техпомещение"));
}
function extractUsageLabels(room, visibleName) {
    const candidates = [
        visibleName,
        room.usage,
        room.type,
        room.roomType,
        room.metadata?.usage,
        room.metadata?.type,
        room.metadata?.roomType,
    ];
    const labels = new Set();
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
function getCandidateRoomName(room) {
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
export function getRoomDisplayName(room, index = 0) {
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
export function getSpaceDisplayName(space, index = 0) {
    return getRoomDisplayName({ id: `space-${index + 1}`, ...space }, index);
}
