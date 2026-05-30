const THERMAL_PANEL_STORAGE_PREFIX = "build.thermal-panel";

export function buildThermalPanelStorageKey(projectKey: string | null | undefined): string {
  return `${THERMAL_PANEL_STORAGE_PREFIX}.${projectKey?.trim() || "local-project"}`;
}

export function saveThermalPanelState(projectKey: string | null | undefined, payload: unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(buildThermalPanelStorageKey(projectKey), JSON.stringify(payload));
  } catch {
    // ignore storage quota and private mode failures
  }
}

export function loadThermalPanelState<T>(projectKey: string | null | undefined): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(buildThermalPanelStorageKey(projectKey));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
