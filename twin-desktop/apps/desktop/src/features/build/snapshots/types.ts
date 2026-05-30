import type { BuildingModel } from "../../../entities/geometry/types";
import type { ThermalSimulationOptions } from "../../../core/thermal/solver";
import type { UncertaintyConfig } from "../../../entities/workflow/workflow.store";

export type ViewSnapshotKind = "plan" | "view3d";

export interface ViewSnapshot {
  id: string;
  createdAt: number;
  title: string;
  kind: ViewSnapshotKind;
  overlays: {
    adjacency: boolean;
    heatmap: boolean;
  };
  imageDataUrl: string;
}

export interface ProjectSnapshotPayload {
  model: BuildingModel;
  thermalOptions: ThermalSimulationOptions;
  uncertaintyConfig: UncertaintyConfig | null;
}

export interface ProjectSnapshot {
  id: string;
  createdAt: number;
  title: string;
  comment?: string;
  payload: ProjectSnapshotPayload;
}
