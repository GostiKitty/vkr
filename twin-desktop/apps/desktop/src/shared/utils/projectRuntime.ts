export type ProjectKindLike = "local" | "engine";
export type ProjectSource = "none" | "local" | "demo" | "engine";

import {
  DEMO_PROJECT_ID,
  DEMO_PROJECT_SOURCE,
  isCanonicalDemoProjectId,
} from "./demoProject";

export const DEFAULT_LOCAL_PROJECT_KEY = "local-project";

const LOCAL_PROJECT_PREFIX = "local:";
const DEMO_PROJECT_IDS = new Set([DEMO_PROJECT_ID, DEMO_PROJECT_SOURCE]);

export function normalizeProjectId(projectId: string | null | undefined): string | null {
  const trimmed = projectId?.trim();
  return trimmed ? trimmed : null;
}

export function isDemoProjectId(projectId: string | null | undefined): boolean {
  const normalized = normalizeProjectId(projectId);
  return normalized ? isCanonicalDemoProjectId(normalized) || DEMO_PROJECT_IDS.has(normalized) : false;
}

export function isLocalProjectId(projectId: string | null | undefined): boolean {
  const normalized = normalizeProjectId(projectId);
  return normalized
    ? normalized.startsWith(LOCAL_PROJECT_PREFIX) || DEMO_PROJECT_IDS.has(normalized)
    : false;
}

export function resolveBuildProjectKey(projectId: string | null | undefined): string {
  return normalizeProjectId(projectId) ?? DEFAULT_LOCAL_PROJECT_KEY;
}

export function getProjectSource(
  projectId: string | null | undefined,
  projectKind: ProjectKindLike
): ProjectSource {
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

export function isEngineProjectSource(
  projectId: string | null | undefined,
  projectKind: ProjectKindLike
): boolean {
  return getProjectSource(projectId, projectKind) === "engine";
}
