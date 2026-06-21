const THERMAL_PANEL_STORAGE_PREFIX = "build.thermal-panel";
export function buildThermalPanelStorageKey(projectKey) {
    return `${THERMAL_PANEL_STORAGE_PREFIX}.${projectKey?.trim() || "local-project"}`;
}
export function saveThermalPanelState(projectKey, payload) {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(buildThermalPanelStorageKey(projectKey), JSON.stringify(payload));
    }
    catch {
        // ignore storage quota and private mode failures
    }
}
export function loadThermalPanelState(projectKey) {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(buildThermalPanelStorageKey(projectKey));
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
