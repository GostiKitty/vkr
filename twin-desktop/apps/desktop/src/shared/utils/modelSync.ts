import type { BuildingModel } from "../../entities/geometry/types";

export const MODEL_REVISION_META_KEY = "revision";
export const MODEL_UPDATED_AT_META_KEY = "updatedAt";

export type ResultSyncState = "missing" | "current" | "stale";

export interface ModelBinding {
  projectKey: string | null;
  modelRevision: number | null;
}

export interface ModelDiagnosticsSummary {
  revision: number;
  levels: number;
  rooms: number;
  walls: number;
  windows: number;
  doors: number;
}

export function getModelRevision(model: BuildingModel | null | undefined): number {
  if (!model) {
    return 0;
  }
  const raw = model.meta?.[MODEL_REVISION_META_KEY];
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.trunc(parsed);
    }
  }
  return 0;
}

export function ensureModelRevision(
  model: BuildingModel,
  preferredRevision?: number | null
): { model: BuildingModel; revision: number } {
  const existingRevision = getModelRevision(model);
  const revision = normalizeRevision(existingRevision || preferredRevision || Date.now());
  const updatedAt = resolveUpdatedAt(model, revision);
  if (
    existingRevision === revision &&
    model.meta?.[MODEL_UPDATED_AT_META_KEY] === updatedAt
  ) {
    return { model, revision };
  }
  return {
    model: {
      ...model,
      meta: {
        ...(model.meta ?? {}),
        [MODEL_REVISION_META_KEY]: revision,
        [MODEL_UPDATED_AT_META_KEY]: updatedAt,
      },
    },
    revision,
  };
}

export function bumpModelRevision(
  model: BuildingModel,
  previousRevision?: number | null
): { model: BuildingModel; revision: number } {
  const currentRevision = Math.max(getModelRevision(model), normalizeRevision(previousRevision ?? 0));
  const revision = nextRevision(currentRevision);
  return {
    model: {
      ...model,
      meta: {
        ...(model.meta ?? {}),
        [MODEL_REVISION_META_KEY]: revision,
        [MODEL_UPDATED_AT_META_KEY]: new Date(revision).toISOString(),
      },
    },
    revision,
  };
}

export function createModelBinding(
  projectKey: string | null | undefined,
  modelRevision: number | null | undefined
): ModelBinding {
  return {
    projectKey: normalizeProjectKey(projectKey),
    modelRevision:
      typeof modelRevision === "number" && Number.isFinite(modelRevision) && modelRevision > 0
        ? Math.trunc(modelRevision)
        : null,
  };
}

export function getResultSyncState(
  hasResult: boolean,
  binding: ModelBinding | null | undefined,
  currentProjectKey: string | null | undefined,
  currentModelRevision: number | null | undefined
): ResultSyncState {
  if (!hasResult) {
    return "missing";
  }
  return isBindingCurrent(binding, currentProjectKey, currentModelRevision) ? "current" : "stale";
}

export function isBindingCurrent(
  binding: ModelBinding | null | undefined,
  currentProjectKey: string | null | undefined,
  currentModelRevision: number | null | undefined
): boolean {
  const revision =
    typeof currentModelRevision === "number" && Number.isFinite(currentModelRevision) && currentModelRevision > 0
      ? Math.trunc(currentModelRevision)
      : null;
  if (!binding || binding.modelRevision == null || revision == null) {
    return false;
  }
  return (
    binding.modelRevision === revision &&
    normalizeProjectKey(binding.projectKey) === normalizeProjectKey(currentProjectKey)
  );
}

export function buildModelDiagnosticsSummary(model: BuildingModel): ModelDiagnosticsSummary {
  return {
    revision: getModelRevision(model),
    levels: model.levels.length,
    rooms: model.rooms.length,
    walls: model.walls.length,
    windows: model.windows.length,
    doors: model.doors.length,
  };
}

function normalizeRevision(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return Date.now();
  }
  return Math.trunc(value);
}

function nextRevision(currentRevision: number): number {
  const now = Date.now();
  return now > currentRevision ? now : currentRevision + 1;
}

function resolveUpdatedAt(model: BuildingModel, revision: number): string {
  const current = model.meta?.[MODEL_UPDATED_AT_META_KEY];
  if (typeof current === "string" && current.trim()) {
    return current;
  }
  return new Date(revision).toISOString();
}

function normalizeProjectKey(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "local-project";
}
