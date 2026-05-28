import { summarizeBuilding } from "../../entities/building";
import { polygonArea } from "../../entities/geometry/geom";
import type { BuildingModel } from "../../entities/geometry/types";
import type { ProjectKind } from "../../entities/project/project.store";
import type { Twin } from "../../shared/api/types";
import {
  DEMO_PROJECT_ID,
  DEMO_PROJECT_NAME,
  isDemoProjectModel,
} from "../build/demoProject";

export type ProjectSourceStatus = "none" | "local" | "engine" | "demo";

export interface ProjectSummary {
  name: string;
  spaces: number;
  totalArea: number | null;
  totalVolume: number | null;
  source: "twin" | "build";
}

export function hasBuildGeometry(model: BuildingModel): boolean {
  return (
    model.rooms.length > 0 ||
    model.walls.length > 0 ||
    (model.roofs?.length ?? 0) > 0 ||
    (model.floorSlabs?.length ?? 0) > 0
  );
}

export function getProjectStatus(
  projectId: string | null,
  projectKind: ProjectKind,
  model: BuildingModel
): ProjectSourceStatus {
  if (projectId === DEMO_PROJECT_ID || isDemoProjectModel(model)) {
    return "demo";
  }
  if (projectKind === "engine" && projectId) {
    return "engine";
  }
  if (hasBuildGeometry(model) || projectId?.startsWith("local:")) {
    return "local";
  }
  return "none";
}

export function doesBuildModelMatchProject(
  model: BuildingModel,
  projectId: string | null,
  projectKind: ProjectKind
): boolean {
  if (projectKind === "local") {
    return true;
  }
  if (!projectId) {
    return true;
  }
  const sourceProjectId =
    typeof model.meta?.sourceProjectId === "string" ? model.meta.sourceProjectId : null;
  return sourceProjectId === projectId;
}

export function buildProjectSummary(input: {
  projectId: string | null;
  projectKind: ProjectKind;
  twin: Twin | null;
  buildModel: BuildingModel;
}): ProjectSummary | null {
  const twinSummary =
    input.projectKind === "engine" ? summarizeBuilding(input.twin) : null;
  if (twinSummary) {
    return {
      name: twinSummary.name,
      spaces: twinSummary.spaces,
      totalArea: twinSummary.totalArea,
      totalVolume: twinSummary.totalVolume,
      source: "twin",
    };
  }

  if (!doesBuildModelMatchProject(input.buildModel, input.projectId, input.projectKind)) {
    return null;
  }
  if (!hasBuildGeometry(input.buildModel)) {
    return null;
  }

  const name = resolveModelName(input.buildModel);
  const levelHeights = new Map(
    input.buildModel.levels.map((level) => [level.id, level.height_m])
  );
  const totalAreaFromRooms = input.buildModel.rooms.reduce(
    (sum, room) => sum + Math.abs(polygonArea(room.polygon)),
    0
  );
  const totalVolumeFromRooms = input.buildModel.rooms.reduce((sum, room) => {
    const area = Math.abs(polygonArea(room.polygon));
    const levelHeight = levelHeights.get(room.levelId) ?? 3;
    return sum + area * levelHeight;
  }, 0);

  return {
    name,
    spaces: input.buildModel.rooms.length,
    totalArea: input.buildModel.thermalProtection?.heatedAreaM2 ?? totalAreaFromRooms,
    totalVolume:
      input.buildModel.thermalProtection?.heatedVolumeM3 ?? totalVolumeFromRooms,
    source: "build",
  };
}

function resolveModelName(model: BuildingModel): string {
  if (typeof model.meta?.name === "string" && model.meta.name.trim()) {
    return model.meta.name.trim();
  }
  if (isDemoProjectModel(model)) {
    return DEMO_PROJECT_NAME;
  }
  return "Локальная модель";
}
