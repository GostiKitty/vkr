import type { BuildingModel } from "../../../entities/geometry/types";
import type { EquipmentType, PipeSystemType } from "../../../entities/networks/types";
import type { ThermalFieldBuildOptions } from "../../../core/thermal/field";
import type { BuildTool, Selection } from "../build.store";

export interface BuildSceneCallbacks {
  onSelect?: (selection: Selection | null) => void;
  onHoverInfo?: (info: BuildSceneHoverInfo | null) => void;
  onCameraStateChange?: (state: BuildSceneCameraState) => void;
  onPerformanceStateChange?: (state: BuildScenePerformanceState) => void;
  onSetWalls?: (walls: BuildingModel["walls"]) => void;
  onAddDoor?: (door: BuildingModel["doors"][number]) => void;
  onAddWindow?: (window: BuildingModel["windows"][number]) => void;
  onAddPipe?: (pipe: BuildingModel["pipes"][number]) => void;
  onAddDuct?: (duct: BuildingModel["ducts"][number]) => void;
  onAddEquipment?: (equipment: BuildingModel["equipment"][number]) => void;
  onAddSensor?: (sensor: BuildingModel["sensors"][number]) => void;
  onUpdateRoom?: (roomId: string, patch: { polygon: BuildingModel["rooms"][number]["polygon"] }) => void;
  onUpdateWall?: (wallId: string, patch: Partial<BuildingModel["walls"][number]>) => void;
  onUpdateDoor?: (doorId: string, patch: Partial<BuildingModel["doors"][number]>) => void;
  onUpdateWindow?: (windowId: string, patch: Partial<BuildingModel["windows"][number]>) => void;
  onUpdatePipe?: (pipeId: string, patch: Partial<BuildingModel["pipes"][number]>) => void;
  onUpdateDuct?: (ductId: string, patch: Partial<BuildingModel["ducts"][number]>) => void;
  onUpdateEquipment?: (equipmentId: string, patch: Partial<BuildingModel["equipment"][number]>) => void;
  onUpdateSensor?: (sensorId: string, patch: Partial<BuildingModel["sensors"][number]>) => void;
}

export interface BuildSceneContext {
  tool: BuildTool;
  activeLevelId: string | null;
  equipmentType: EquipmentType;
  pipeType: PipeSystemType;
  safeMode?: boolean;
  useSimplifiedEquipment?: boolean;
  debugInit?: boolean;
  debug?: BuildSceneDebugOptions;
  showHeatmap?: boolean;
  showContours?: boolean;
  showWallSurfaces?: boolean;
  showVolumeTint?: boolean;
  showTooltip?: boolean;
  thermalBuildOptions?: Omit<ThermalFieldBuildOptions, "roomTemperaturesC">;
}

export interface BuildSceneDebugOptions {
  showWallNormals: boolean;
  showWallJoinDebug: boolean;
  showWallDebugCorners: boolean;
  showRoomContours: boolean;
  showThermalGrid: boolean;
  showRadiatorInfluence: boolean;
  showCoolingZones: boolean;
  showOpeningHosts: boolean;
}

export const DEFAULT_BUILD_SCENE_DEBUG_OPTIONS: BuildSceneDebugOptions = {
  showWallNormals: false,
  showWallJoinDebug: false,
  showWallDebugCorners: false,
  showRoomContours: false,
  showThermalGrid: false,
  showRadiatorInfluence: false,
  showCoolingZones: false,
  showOpeningHosts: false,
};

export interface BuildSceneHoverInfo {
  title: string;
  subtitle?: string;
  temperatureC?: number | null;
  details?: Array<{ label: string; value: string }>;
  screenX: number;
  screenY: number;
}

export interface BuildSceneCameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  azimuthRad: number;
  polarRad: number;
  distance: number;
}

export interface BuildScenePerformanceState {
  fps: number;
  frameMs: number;
}

export type BuildSceneCallbacksRef = { current: BuildSceneCallbacks };
