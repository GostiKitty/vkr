import type { BuildingModel } from "../../entities/geometry/types";

export const DEMO_PROJECT_ID = "local:demo-video";
export const DEMO_PROJECT_SOURCE = "demo-video";
export const DEMO_PROJECT_NAME = "Демонстрационный дом · 2 этажа";

const CANONICAL_DEMO_SCENARIO_IDS = new Set(["video-demo", "video-demo-house", "demo-house"]);
const LEGACY_DEMO_SCENARIO_IDS = new Set(["demo-vkr", "sampleBuildingSP50"]);

function normalizeToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function isCanonicalDemoProjectId(projectId: string | null | undefined): boolean {
  const normalized = normalizeToken(projectId);
  return normalized === DEMO_PROJECT_ID || normalized === DEMO_PROJECT_SOURCE;
}

export function isCanonicalDemoProjectModel(model: BuildingModel | null | undefined): boolean {
  if (!model) {
    return false;
  }
  const meta = model.meta ?? {};
  const projectSource = normalizeToken(typeof meta.projectSource === "string" ? meta.projectSource : null);
  const sourceProjectId = normalizeToken(typeof meta.sourceProjectId === "string" ? meta.sourceProjectId : null);
  const demoScenarioId = normalizeToken(typeof meta.demoScenarioId === "string" ? meta.demoScenarioId : null);
  return (
    projectSource === DEMO_PROJECT_SOURCE ||
    sourceProjectId === DEMO_PROJECT_ID ||
    (demoScenarioId != null && CANONICAL_DEMO_SCENARIO_IDS.has(demoScenarioId))
  );
}

export function isLegacyDemoModel(model: BuildingModel | null | undefined): boolean {
  if (!model) {
    return false;
  }
  const demoScenarioId = normalizeToken(
    typeof model.meta?.demoScenarioId === "string" ? model.meta.demoScenarioId : null
  );
  return demoScenarioId != null && LEGACY_DEMO_SCENARIO_IDS.has(demoScenarioId);
}
