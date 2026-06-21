const SURFACE_TEMPERATURE_STATUS_LABELS = {
    normal: "Норма",
    cold_surface_risk: "Холодная поверхность",
    cold_surface: "Холодная поверхность",
    mold_risk_possible: "Риск плесени",
    condensation_risk: "Риск конденсации",
};
function resolveStatusToken(status) {
    if (typeof status === "string") {
        const trimmed = status.trim();
        return trimmed.length ? trimmed : null;
    }
    if (status && typeof status === "object" && "value" in status) {
        const value = status.value;
        if (typeof value === "string") {
            const trimmed = value.trim();
            return trimmed.length ? trimmed : null;
        }
    }
    return null;
}
export function formatSurfaceTemperatureFactorStatus(status, fallback = "не задано") {
    const token = resolveStatusToken(status);
    if (!token) {
        return fallback;
    }
    const normalized = token.toLowerCase();
    return SURFACE_TEMPERATURE_STATUS_LABELS[normalized] ?? token;
}
