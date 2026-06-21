const PLACEHOLDER_VALUES = new Set(["", "-", "—", "n/a", "na", "none", "null", "undefined", "nan"]);
const RAW_ID_PATTERN = /^(?:[a-z0-9_-]{10,}|[0-9a-f]{8}-[0-9a-f-]{27,})$/i;
export function normalizeDisplayText(value) {
    return value.replace(/\s+/g, " ").trim();
}
export function looksLikeInternalId(value) {
    const normalized = normalizeDisplayText(value);
    if (!normalized) {
        return false;
    }
    if (RAW_ID_PATTERN.test(normalized)) {
        return true;
    }
    const compact = normalized.replace(/[-_]/g, "");
    return compact.length >= 12 && /[0-9]/.test(compact) && /^[a-z0-9]+$/i.test(compact);
}
export function isBrokenDisplayText(value) {
    const normalized = normalizeDisplayText(value);
    if (!normalized) {
        return true;
    }
    const lowered = normalized.toLowerCase();
    if (PLACEHOLDER_VALUES.has(lowered)) {
        return true;
    }
    if (/\?{3,}/.test(normalized)) {
        return true;
    }
    const visibleLength = normalized.replace(/\s/g, "").length;
    const brokenCount = (normalized.match(/[�?]/g) ?? []).length;
    if (visibleLength > 0 && brokenCount / visibleLength >= 0.35) {
        return true;
    }
    return false;
}
export function sanitizeDisplayText(value, fallback = "Без названия", options) {
    if (typeof value !== "string") {
        return fallback;
    }
    const normalized = normalizeDisplayText(value);
    if (!normalized || isBrokenDisplayText(normalized)) {
        return fallback;
    }
    if (!options?.allowInternalId && looksLikeInternalId(normalized)) {
        return fallback;
    }
    return normalized;
}
export function firstDisplayText(candidates, fallback = "Без названия", options) {
    for (const candidate of candidates) {
        const sanitized = sanitizeDisplayText(candidate, "", options);
        if (sanitized) {
            return sanitized;
        }
    }
    return fallback;
}
