const SURFACE_TEMPERATURE_STATUS_LABELS: Record<string, string> = {
  normal: "Норма",
  cold_surface_risk: "Холодная поверхность",
  cold_surface: "Холодная поверхность",
  mold_risk_possible: "Риск плесени",
  condensation_risk: "Риск конденсации",
};

function resolveStatusToken(status: unknown): string | null {
  if (typeof status === "string") {
    const trimmed = status.trim();
    return trimmed.length ? trimmed : null;
  }
  if (status && typeof status === "object" && "value" in status) {
    const value = (status as { value?: unknown }).value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }
  }
  return null;
}

export function formatSurfaceTemperatureFactorStatus(
  status: unknown,
  fallback = "не задано"
): string {
  const token = resolveStatusToken(status);
  if (!token) {
    return fallback;
  }
  const normalized = token.toLowerCase();
  return SURFACE_TEMPERATURE_STATUS_LABELS[normalized] ?? token;
}
