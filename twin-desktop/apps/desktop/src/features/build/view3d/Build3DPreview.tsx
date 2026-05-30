import React, { useEffect, useRef } from "react";
import type { BuildingModel } from "../../../entities/geometry/types";
import type { BuildTool, Selection } from "../build.store";
import { createBuildScene } from "./threeScene";
import type { ThermalFieldBuildOptions, ThermalFieldModel } from "../../../core/thermal/field";
import type { ThermalTimelinePoint } from "../../../core/thermal/solver";
import type { TransientVisualizationFrame } from "../../../core/thermal/transient/index";
import type { EquipmentType, PipeSystemType } from "../../../entities/networks/types";
import type { BuildSectionMode, BuildViewerOptions } from "./viewerOptions";
import type {
  BuildSceneCallbacksRef,
  BuildSceneCameraState,
  BuildSceneDebugOptions,
  BuildSceneHoverInfo,
  BuildScenePerformanceState,
} from "./sceneContracts";

export interface Build3DPreviewHandle {
  getCanvas: () => HTMLCanvasElement | null;
  zoomToFit: () => void;
  resetView: () => void;
  setTopView: () => void;
  focusSelection: () => void;
}

interface Build3DPreviewProps {
  model: BuildingModel;
  tool: BuildTool;
  activeLevelId: string | null;
  equipmentType: EquipmentType;
  pipeType: PipeSystemType;
  debug?: BuildSceneDebugOptions;
  selection: Selection | null;
  viewer: BuildViewerOptions;
  showHeatmap: boolean;
  showContours: boolean;
  showWallSurfaces: boolean;
  showVolumeTint: boolean;
  showTooltip: boolean;
  thermalBuildOptions: Omit<ThermalFieldBuildOptions, "roomTemperaturesC">;
  thermalField: ThermalFieldModel | null;
  transientFrame?: TransientVisualizationFrame | null;
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
  thermalFrame: ThermalTimelinePoint | null;
  sectionHeight: number;
  sectionMode: BuildSectionMode;
  sectionOffset: number;
  safeMode?: boolean;
  debugInit?: boolean;
}

export const Build3DPreview = React.forwardRef<Build3DPreviewHandle, Build3DPreviewProps>(
  (
    {
      model,
      tool,
      activeLevelId,
      equipmentType,
      pipeType,
      debug,
      selection,
      viewer,
      showHeatmap,
      showContours,
      showWallSurfaces,
      showVolumeTint,
      showTooltip,
      thermalBuildOptions,
      thermalField,
      transientFrame = null,
      onSelect,
      onHoverInfo,
      onCameraStateChange,
      onPerformanceStateChange,
      onSetWalls,
      onAddDoor,
      onAddWindow,
      onAddPipe,
      onAddDuct,
      onAddEquipment,
      onAddSensor,
      onUpdateRoom,
      onUpdateWall,
      onUpdateDoor,
      onUpdateWindow,
      onUpdatePipe,
      onUpdateDuct,
      onUpdateEquipment,
      onUpdateSensor,
      thermalFrame,
      sectionHeight,
      sectionMode,
      sectionOffset,
      safeMode = false,
      debugInit = false,
    }: Build3DPreviewProps,
    forwardedRef
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sceneRef = useRef<ReturnType<typeof createBuildScene> | null>(null);
    const callbacksRef = useRef<BuildSceneCallbacksRef["current"]>({
      onSelect,
      onHoverInfo,
      onCameraStateChange,
      onPerformanceStateChange,
      onSetWalls,
      onAddDoor,
      onAddWindow,
      onAddPipe,
      onAddDuct,
      onAddEquipment,
      onAddSensor,
      onUpdateRoom,
      onUpdateWall,
      onUpdateDoor,
      onUpdateWindow,
      onUpdatePipe,
      onUpdateDuct,
      onUpdateEquipment,
      onUpdateSensor,
    });

    useEffect(() => {
      callbacksRef.current = {
        onSelect,
        onHoverInfo,
        onCameraStateChange,
        onPerformanceStateChange,
        onSetWalls,
        onAddDoor,
        onAddWindow,
        onAddPipe,
        onAddDuct,
        onAddEquipment,
        onAddSensor,
        onUpdateRoom,
        onUpdateWall,
        onUpdateDoor,
        onUpdateWindow,
        onUpdatePipe,
        onUpdateDuct,
        onUpdateEquipment,
        onUpdateSensor,
      };
    }, [
      onSelect,
      onHoverInfo,
      onCameraStateChange,
      onPerformanceStateChange,
      onSetWalls,
      onAddDoor,
      onAddWindow,
      onAddPipe,
      onAddDuct,
      onAddEquipment,
      onAddSensor,
      onUpdateRoom,
      onUpdateWall,
      onUpdateDoor,
      onUpdateWindow,
      onUpdatePipe,
      onUpdateDuct,
      onUpdateEquipment,
      onUpdateSensor,
    ]);

    useEffect(() => {
      if (!canvasRef.current) {
        return;
      }
      sceneRef.current = createBuildScene(canvasRef.current, callbacksRef);
      return () => {
        sceneRef.current?.dispose();
        sceneRef.current = null;
      };
    }, []);

    useEffect(() => {
      sceneRef.current?.update(
        model,
        {
          tool,
          activeLevelId,
          equipmentType,
          pipeType,
          safeMode,
          useSimplifiedEquipment: safeMode,
          debugInit,
          debug,
          showHeatmap,
          showContours,
          showWallSurfaces,
          showVolumeTint,
          showTooltip,
          thermalBuildOptions,
        },
        viewer,
        selection ?? null,
        thermalFrame ?? null,
        transientFrame ?? null,
        thermalField,
        sectionHeight,
        sectionMode,
        sectionOffset
      );
    }, [
      model,
      tool,
      activeLevelId,
      equipmentType,
      pipeType,
      debug,
      selection,
      viewer,
      showHeatmap,
      showContours,
      showWallSurfaces,
      showVolumeTint,
      showTooltip,
      thermalBuildOptions,
      thermalField,
      thermalFrame,
      transientFrame,
      sectionHeight,
      sectionMode,
      sectionOffset,
      safeMode,
      debugInit,
    ]);

    React.useImperativeHandle(
      forwardedRef,
      () => ({
        getCanvas: () => canvasRef.current,
        zoomToFit: () => {
          sceneRef.current?.zoomToFit();
        },
        resetView: () => {
          sceneRef.current?.resetView();
        },
        setTopView: () => {
          sceneRef.current?.setTopView();
        },
        focusSelection: () => {
          sceneRef.current?.focusSelection();
        },
      }),
      []
    );

    return <canvas ref={canvasRef} className="block h-full w-full touch-none" />;
  }
);

export default Build3DPreview;
