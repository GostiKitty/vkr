import { DEMO_PROJECT_ID, DEMO_PROJECT_SOURCE, isCanonicalDemoProjectId, } from "./demoProject";
export const DEFAULT_LOCAL_PROJECT_KEY = "local-project";
const LOCAL_PROJECT_PREFIX = "local:";
const DEMO_PROJECT_IDS = new Set([DEMO_PROJECT_ID, DEMO_PROJECT_SOURCE]);
export function normalizeProjectId(projectId) {
    const trimmed = projectId?.trim();
    return trimmed ? trimmed : null;
}
export function isDemoProjectId(projectId) {
    const normalized = normalizeProjectId(projectId);
    return normalized ? isCanonicalDemoProjectId(normalized) || DEMO_PROJECT_IDS.has(normalized) : false;
}
export function isLocalProjectId(projectId) {
    const normalized = normalizeProjectId(projectId);
    return normalized
        ? normalized.startsWith(LOCAL_PROJECT_PREFIX) || DEMO_PROJECT_IDS.has(normalized)
        : false;
}
export function resolveBuildProjectKey(projectId) {
    return normalizeProjectId(projectId) ?? DEFAULT_LOCAL_PROJECT_KEY;
}
export function getProjectSource(projectId, projectKind) {
    const normalized = normalizeProjectId(projectId);
    if (!normalized) {
        return "none";
    }
    if (isDemoProjectId(normalized)) {
        return "demo";
    }
    if (projectKind === "engine" && !isLocalProjectId(normalized)) {
        return "engine";
    }
    return "local";
}
export function isEngineProjectSource(projectId, projectKind) {
    return getProjectSource(projectId, projectKind) === "engine";
}
