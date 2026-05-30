import type { BuildingModel } from "../../../entities/geometry/types";
import type { BuildViewerOptions } from "./viewerOptions";
import { buildNetworkConnectivityWarnings } from "../networks/connectivity";

export const ENGINEERING_OVERVIEW_PRESENTATION_MODE = "engineering-overview" as const;

export const ENGINEERING_OVERVIEW_PATCH: Partial<BuildViewerOptions> = {
  showRooms: true,
  showWalls: true,
  showOpenings: true,
  showNetworks: true,
  showEquipment: true,
  transparentWalls: true,
  presentationMode: ENGINEERING_OVERVIEW_PRESENTATION_MODE,
};

export function isEngineeringOverviewPresetActive(viewer: BuildViewerOptions): boolean {
  return (
    viewer.presentationMode === ENGINEERING_OVERVIEW_PRESENTATION_MODE &&
    viewer.showRooms &&
    viewer.showWalls &&
    viewer.showOpenings &&
    viewer.showNetworks &&
    viewer.showEquipment &&
    viewer.transparentWalls
  );
}

export function applyEngineeringOverviewPreset(viewer: BuildViewerOptions): BuildViewerOptions {
  if (isEngineeringOverviewPresetActive(viewer)) {
    return viewer;
  }
  return {
    ...viewer,
    ...ENGINEERING_OVERVIEW_PATCH,
  };
}

export function clearEngineeringOverviewPreset(viewer: BuildViewerOptions): BuildViewerOptions {
  if (viewer.presentationMode !== ENGINEERING_OVERVIEW_PRESENTATION_MODE) {
    return viewer;
  }
  return {
    ...viewer,
    presentationMode: "default",
  };
}

export function shouldEnableEngineeringOverviewForDemoStep(stepId: string): boolean {
  return stepId === "networks";
}

export interface EngineeringOverviewSummary {
  pipeCount: number;
  ductCount: number;
  equipmentCount: number;
  warningCount: number;
  hasNetworks: boolean;
}

export function buildEngineeringOverviewSummary(model: BuildingModel): EngineeringOverviewSummary {
  return {
    pipeCount: model.pipes.length,
    ductCount: model.ducts.length,
    equipmentCount: model.equipment.length + model.sensors.length,
    warningCount: buildNetworkConnectivityWarnings(model).length,
    hasNetworks: model.pipes.length > 0 || model.ducts.length > 0 || model.equipment.length > 0 || model.sensors.length > 0,
  };
}
