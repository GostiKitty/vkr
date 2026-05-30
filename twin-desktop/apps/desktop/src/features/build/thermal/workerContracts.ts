import type { BuildingModel } from "../../../entities/geometry/types";
import type { ThermalFieldBuildOptions, ThermalFieldModel } from "../../../core/thermal/field";
import type { ThermalTimelinePoint } from "../../../core/thermal/solver";

export interface PreparedThermalAnalysis {
  previewFrame: ThermalTimelinePoint;
  effectiveFrame: ThermalTimelinePoint;
  field: ThermalFieldModel;
  stats: {
    computeMs: number;
    sampleCount: number;
    sourceCount: number;
    boundaryCount: number;
  };
}

export interface ThermalWorkerRequest {
  requestId: number;
  model: BuildingModel;
  fieldOptions: Omit<ThermalFieldBuildOptions, "roomTemperaturesC">;
  frame: ThermalTimelinePoint | null;
}

export interface ThermalWorkerSuccess {
  requestId: number;
  ok: true;
  result: PreparedThermalAnalysis;
}

export interface ThermalWorkerFailure {
  requestId: number;
  ok: false;
  error: string;
}

export type ThermalWorkerResponse = ThermalWorkerSuccess | ThermalWorkerFailure;
