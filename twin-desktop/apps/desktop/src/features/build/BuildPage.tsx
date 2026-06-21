import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { useBuildStore, type BuildTool, type Selection } from "./build.store";
import { isDeleteShortcut } from "./keyboardShortcuts";
import { useProjectStore } from "../../entities/project/project.store";
import { useTwinStore } from "../../entities/twin/twin.store";
import { notifyError, notifyInfo } from "../../entities/notifications/notification.store";
import { probeEngineHealth } from "../../entities/settings/engine.health";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { deriveProjectName } from "../model/model.utils";
import { describeImportError, useModelImport } from "../model/useModelImport";
import { useTwin } from "../twin/useTwin";
import { type BuildViewportMode } from "./components/LeftToolbar";
import ProjectBrowser from "./components/ProjectBrowser";
import LevelsPanel from "./components/LevelsPanel";
import RightInspector from "./components/RightInspector";
import ValidationPanel from "./components/ValidationPanel";
import EnvelopeDashboard from "./components/EnvelopeDashboard";
import NetworkSystemsPanel from "./components/NetworkSystemsPanel";
import Canvas2D, { type CanvasHandle } from "./components/Canvas2D";
import RoomProblemsPanel from "./components/RoomProblemsPanel";
import { generateWallsFromRooms } from "./auto/generateWallsFromRooms";
import { autoCloseRooms, mergeColinearWalls, removeTinySegments } from "./auto/fixes";
import { buildModelToTwin } from "./export/toTwin";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import type { ThermalSimulationOptions, ThermalSimulationResult } from "../../core/thermal/solver";
import { computeEnvelopeMetrics } from "./metrics/envelope";
import type { RoomEnvelopeMetrics } from "./metrics/envelope";
import { validateModel } from "./validation/validator";
import Build3DCanonicalPreview, {
  type Build3DCanonicalPreviewHandle,
  type BuildSurfaceFieldDebugInfo,
} from "./view3d/Build3DCanonicalPreview";
import { DEFAULT_STABLE_VIEWER_OPTIONS, type BuildViewerOptions } from "./view3d/viewerOptions";
import { createId } from "../../shared/utils/id";
import { navigate, usePathname } from "../../app/router";
import ThermalSimulationPanel from "./components/ThermalSimulationPanel";
import { DEFAULT_THERMAL_OPTIONS } from "./thermal/defaultThermalOptions";
import { buildThermalOptionsFromWorkflow } from "./thermal/workflowThermalOptions";
import ThermalMonteCarloPanel from "./components/ThermalMonteCarloPanel";
import ThermalCalibrationPanel from "./components/ThermalCalibrationPanel";
import { Badge } from "../../shared/ui/Badge";
import { ToolbarTooltip } from "../../shared/ui/ToolbarTooltip";
import {
  ThermalFieldLegend,
} from "../../shared/ui/EngineeringUi";
import SnapshotsPanel from "./components/SnapshotsPanel";
import BuildToolPalette from "./components/BuildToolPalette";
import EngineeringLibraryPanel from "./components/EngineeringLibraryPanel";
import { useBuildUiStore } from "../../entities/build/buildUi.store";
import { BuildToolIcon, type BuildToolIconName } from "./components/buildToolIcons";
import OrientationHelper3D from "./components/OrientationHelper3D";
import ModelSummaryPanel from "./components/ModelSummaryPanel";
import EngineeringLegendPanel from "./engineering/EngineeringLegendPanel";
import { useSnapshots } from "./snapshots/useSnapshots";
import type { ViewSnapshotKind } from "./snapshots/types";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import type { EquipmentType, PipeSystemType } from "../../entities/networks/types";
import type { EngineeringEquipmentType, EngineeringSystemsModel } from "../../entities/engineering/types";
import { useSmartBuilding } from "./live/useSmartBuilding";
import { validateEngineeringModel } from "./validation/engineeringValidator";
import { buildModelFromTwin } from "./import/fromTwin";
import {
  buildLevelName,
  getLevelDisplayLabel,
  getSelectionDisplayLabel,
} from "./utils/entityLabels";
import { getRoomDisplayName as getVisibleRoomName } from "../../shared/utils/roomNames";
import { modeFromViewport, normalizeToolForMode } from "../../core/editor/modes";
import {
  buildThermalFieldOptions,
  DEFAULT_THERMAL_DISPLAY_OPTIONS,
  type ThermalDisplayOptions,
} from "./thermal/displayOptions";
import {
  buildSurfaceFieldResult,
  getSurfaceFieldValueRange,
  SURFACE_FIELD_MODE_LABELS,
  SURFACE_FIELD_MODE_UNITS,
} from "../../core/thermal/surfaceField";
import { buildTemperatureLegendRange } from "./thermal/temperatureLegend";
import { usePreparedThermalAnalysis } from "./thermal/usePreparedThermalAnalysis";
import { type HeatingNetworkDisplayMode } from "./networks/displayModes";
import {
  engineeringModeUsesHeatmap,
  engineeringModeUsesOverlay,
  type EngineeringSchematicStyle,
  type EngineeringVisualizationMode,
} from "./engineering/viewMode";
import type { TransientCalculationResult } from "../../core/thermal/transient/index";
import { buildTransientVisualizationFrame } from "./thermal/transientVisualization";
import {
  applyEngineeringOverviewPreset,
  clearEngineeringOverviewPreset,
  isEngineeringOverviewPresetActive,
  shouldEnableEngineeringOverviewForDemoStep,
} from "./view3d/engineeringOverview";
import { DEFAULT_BUILD_SCENE_DEBUG_OPTIONS } from "./view3d/sceneContracts";
import type {
  BuildSceneCameraState,
  BuildSceneDebugOptions,
  BuildSceneHoverInfo,
} from "./view3d/sceneContracts";
import type { VideoDemoStepId } from "../../demo/videoDemoScenario";
import { useWorkspaceStore } from "../../entities/workspace/workspace.store";
import {
  buildVideoDemoProjectModel,
  VIDEO_DEMO_PROJECT_ID,
} from "./demoVideoProject";
import { writeAgentDebugLog } from "../../shared/utils/agentDebugLog";
import { getProjectSource, resolveBuildProjectKey } from "../../shared/utils/projectRuntime";
import {
  createTypicalCtpEngineeringSystems,
  createItpParallelDhwDependentHeating,
  ENGINEERING_EQUIPMENT_LABELS,
} from "./engineering2d/catalog";
import { DEFAULT_ENVELOPE_PRESET_IDS } from "../../entities/envelope/envelopePresets";
import { computeSolarPosition, type SolarPosition } from "../../core/solar/solarPosition";
import SolarTimeOverlay, { type SolarTimeState } from "./components/SolarTimeOverlay";
import { WorkspaceSidebarResizeHandle } from "./components/WorkspaceSidebarResizeHandle";

const DEFAULT_GRID_STEP = 0.5;
// Safe mode используется как облегченный recovered UI-режим для основного 3D:
// тяжелые overlays и старые update-loops остаются отключенными.
const THREE_D_SAFE_MODE = true;
const DEBUG_3D_INIT = false;
const DRAWING_TOOLS = new Set<BuildTool>([
  "roomRect",
  "room",
  "wall",
  "roof",
  "slab",
  "door",
  "window",
  "pipe",
  "duct",
  "equipment",
  "sensor",
  "engineeringEquipment",
  "engineeringPipe",
]);
type WorkspaceSidebarTab = "project" | "browser" | "properties";

const WORKSPACE_SIDEBAR_TAB_META: Record<WorkspaceSidebarTab, { title: string; icon: BuildToolIconName }> = {
  browser: { title: "Проводник", icon: "levels" },
  properties: { title: "Свойства", icon: "sliders" },
  project: { title: "Проект", icon: "cube" },
};

function QuickToolButton({
  icon,
  label,
  title,
  active,
  disabled,
  compact,
  onClick,
}: {
  icon: BuildToolIconName;
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const tooltipLabel = compact ? label : title || label;

  return (
    <ToolbarTooltip label={tooltipLabel}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={`ui-control inline-flex h-9 items-center gap-1.5 rounded-full border transition ${
          compact ? "w-9 justify-center px-0" : "px-3"
        } text-xs font-semibold ${
          disabled
            ? "cursor-not-allowed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-disabled)]"
            : active
              ? "ui-control-active border-[color:var(--accent-muted)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)] shadow-[var(--shadow-control)]"
              : "border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-base)]"
        }`}
      >
        <BuildToolIcon name={icon} className="h-4 w-4 shrink-0" />
        {!compact ? <span className="hidden xl:inline">{label}</span> : null}
      </button>
    </ToolbarTooltip>
  );
}

function BuildToolbarDivider() {
  return <div className="mx-0.5 hidden h-7 w-px shrink-0 bg-[color:var(--border-soft)] md:block" aria-hidden="true" />;
}

function BuildToolbarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5" role="group" aria-label={label}>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

function ViewModeTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: BuildToolIconName;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <ToolbarTooltip label={label}>
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={label}
        onClick={onClick}
        className={`ui-segmented-control__item inline-flex items-center gap-1.5 px-2.5 sm:px-3 ${active ? "ui-segmented-control__item--active" : ""}`}
      >
        <BuildToolIcon name={icon} className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </ToolbarTooltip>
  );
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
}

function BuildPageContent() {
  const log3DInit = (...args: unknown[]) => {
    if (DEBUG_3D_INIT) {
      console.info("[3d-page]", ...args);
    }
  };
  const canvasRef = useRef<CanvasHandle | null>(null);
  const ifcInputRef = useRef<HTMLInputElement | null>(null);
  const pathname = usePathname();
  const view3dCanvasRef = useRef<Build3DCanonicalPreviewHandle | null>(null);
  const view3dViewportRef = useRef<HTMLDivElement | null>(null);
  const projectValidationSectionRef = useRef<HTMLDivElement | null>(null);
  const engineeringOverviewSnapshotRef = useRef<{
    viewer: BuildViewerOptions;
    thermalDisplay: ThermalDisplayOptions;
    activeViewport: BuildViewportMode;
  } | null>(null);
  const engineeringOverviewZoomRafRef = useRef<number | null>(null);
  const canvasWorkspaceFitRafRef = useRef<number | null>(null);
  const hasFittedOnThis3DEntryRef = useRef(false);
  const [showHelp, setShowHelp] = useState(false);
  const [equipmentPreset, setEquipmentPreset] = useState<EquipmentType>("radiator");
  const [engineeringEquipmentPreset, setEngineeringEquipmentPreset] = useState<EngineeringEquipmentType>("heatExchanger");
  const [engineeringEquipmentVariant, setEngineeringEquipmentVariant] = useState<string | undefined>(undefined);
  const [pipePreset, setPipePreset] = useState<PipeSystemType>("heating_supply");
  const [wallPreset, setWallPreset] = useState(DEFAULT_ENVELOPE_PRESET_IDS.wall);
  const [windowPreset, setWindowPreset] = useState(DEFAULT_ENVELOPE_PRESET_IDS.window);
  const [doorPreset, setDoorPreset] = useState(DEFAULT_ENVELOPE_PRESET_IDS.door);
  const [roofPreset, setRoofPreset] = useState(DEFAULT_ENVELOPE_PRESET_IDS.roof);
  const [slabPreset, setSlabPreset] = useState(DEFAULT_ENVELOPE_PRESET_IDS.slab);
  const [heatingDisplayMode, setHeatingDisplayMode] = useState<HeatingNetworkDisplayMode>("lineRole");
  const [showNetworkFlowArrows, setShowNetworkFlowArrows] = useState(true);
  const [visualizationMode, setVisualizationMode] = useState<EngineeringVisualizationMode>("plan");
  const [schematicStyle, setSchematicStyle] = useState<EngineeringSchematicStyle>("gost");
  const [viewer, setViewer] = useState<BuildViewerOptions>(DEFAULT_STABLE_VIEWER_OPTIONS);
  const [showSolarSim, setShowSolarSim] = useState(false);
  const solarTimeState = useBuildStore((state) => state.solarTime);
  const setSolarTimeState = useBuildStore((state) => state.setSolarTime);
  const [engineeringOverviewActive, setEngineeringOverviewActive] = useState(false);
  const [isWorkspaceSidebarOpen, setIsWorkspaceSidebarOpen] = useState(false);
  const [isWorkspaceSidebarContentVisible, setIsWorkspaceSidebarContentVisible] = useState(false);
  const [canvasLayoutFitEpoch, setCanvasLayoutFitEpoch] = useState(0);
  const [workspaceSidebarTab, setWorkspaceSidebarTab] = useState<WorkspaceSidebarTab>("browser");
  const panelSide = useBuildUiStore((state) => state.panelSide);
  const toolsPlacement = useBuildUiStore((state) => state.toolsPlacement);
  const workspaceSidebarWidth = useBuildUiStore((state) => state.workspaceSidebarWidth);
  const setWorkspaceSidebarWidth = useBuildUiStore((state) => state.setWorkspaceSidebarWidth);
  const activeViewport = useWorkspaceStore((state) => state.mode);
  const setWorkspaceMode = useWorkspaceStore((state) => state.setMode);
  const workspaceCommand = useWorkspaceStore((state) => state.command);
  const workspaceCommandNonce = useWorkspaceStore((state) => state.commandNonce);
  const consumeWorkspaceCommand = useWorkspaceStore((state) => state.consumeProjectCommand);
  const dispatchProjectCommand = useWorkspaceStore((state) => state.dispatchProjectCommand);
  const setActiveViewport = useCallback(
    (mode: BuildViewportMode) => {
      setWorkspaceMode(mode);
    },
    [setWorkspaceMode]
  );
  const resolvedViewport: BuildViewportMode = activeViewport === "results" ? "plan" : activeViewport;
  const [thermalOptions, setThermalOptions] = useState<ThermalSimulationOptions>(() => ({
    ...DEFAULT_THERMAL_OPTIONS,
    outdoor: { ...DEFAULT_THERMAL_OPTIONS.outdoor },
    setpoints: { ...DEFAULT_THERMAL_OPTIONS.setpoints },
    internalGains: { ...DEFAULT_THERMAL_OPTIONS.internalGains },
  }));
  const [thermalResult, setThermalResult] = useState<ThermalSimulationResult | null>(null);
  const [thermalTimeIndex, setThermalTimeIndex] = useState(0);
  const [activeTransientResult, setActiveTransientResult] = useState<TransientCalculationResult | null>(null);
  const [selectedTransientTimeIndex, setSelectedTransientTimeIndex] = useState(0);
  const [activeTransientSourceId, setActiveTransientSourceId] = useState<string | null>(null);
  const [activeTransientSourceType, setActiveTransientSourceType] = useState<"wall" | "roof" | "slab" | null>(null);
  const [transientVisualizationEnabled, setTransientVisualizationEnabled] = useState(false);
  const [thermalPlaying, setThermalPlaying] = useState(false);
  const [thermalDisplay, setThermalDisplay] = useState<ThermalDisplayOptions>(() => ({
    ...DEFAULT_THERMAL_DISPLAY_OPTIONS,
    outdoorTemperatureC: DEFAULT_THERMAL_OPTIONS.outdoor.baseC,
    lightingGain_W_m2: DEFAULT_THERMAL_OPTIONS.internalGains.dayGain_W_m2 * 0.4,
    occupancyGain_W_m2: 1.6,
    infiltrationACH: DEFAULT_THERMAL_OPTIONS.infiltrationACH ?? 0.5,
  }));
  const [threeDHoverInfo, setThreeDHoverInfo] = useState<BuildSceneHoverInfo | null>(null);
  const [view3dCameraState, setView3dCameraState] = useState<BuildSceneCameraState | null>(null);
  const [surfaceFieldOverlayDebug, setSurfaceFieldOverlayDebug] = useState<BuildSurfaceFieldDebugInfo | null>(null);
  const [sceneDebug, setSceneDebug] = useState<BuildSceneDebugOptions>(DEFAULT_BUILD_SCENE_DEBUG_OPTIONS);
  const [planExportMode, setPlanExportMode] = useState(false);
  const [clipboard, setClipboard] = useState<NonNullable<import("./build.store").Selection> | null>(null);
  const showDevDebug = Boolean(import.meta.env.DEV);
  const cloneDeep = <T,>(value: T): T => {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  };
  const lastGridStepRef = useRef(DEFAULT_GRID_STEP);
  const downloadBlob = useCallback((file: Blob, filename: string) => {
    const link = document.createElement("a");
    const blobUrl = URL.createObjectURL(file);
    link.href = blobUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }, []);
  const scheduleEngineeringOverviewFit = useCallback((action: "fit" | "reset") => {
    log3DInit("camera-fit", action);
    if (engineeringOverviewZoomRafRef.current !== null) {
      window.cancelAnimationFrame(engineeringOverviewZoomRafRef.current);
    }
    engineeringOverviewZoomRafRef.current = window.requestAnimationFrame(() => {
      engineeringOverviewZoomRafRef.current = null;
      if (action === "fit") {
        view3dCanvasRef.current?.zoomToFit();
        return;
      }
      view3dCanvasRef.current?.resetView();
    });
  }, []);

  const scheduleCanvasWorkspaceFit = useCallback(() => {
    if (canvasWorkspaceFitRafRef.current !== null) {
      window.cancelAnimationFrame(canvasWorkspaceFitRafRef.current);
    }
    const runFit = () => {
      // Plan/networks refit via layoutFitEpoch passed to Canvas2D (avoids fighting wheel zoom).
      if (activeViewport === "view3d") {
        view3dCanvasRef.current?.zoomToFit();
      }
    };
    canvasWorkspaceFitRafRef.current = window.requestAnimationFrame(() => {
      canvasWorkspaceFitRafRef.current = window.requestAnimationFrame(() => {
        canvasWorkspaceFitRafRef.current = null;
        runFit();
      });
    });
  }, [activeViewport]);

  const model = useBuildStore((state) => state.model);
  const tool = useBuildStore((state) => state.tool);
  const selection = useBuildStore((state) => state.selection);
  const [multiSelection, setMultiSelection] = useState<import("./build.store").Selection[]>([]);
  const gridStep = useBuildStore((state) => state.gridStep);
  const orthogonalMode = useBuildStore((state) => state.orthogonalMode);
  const adjacencyOverlay = useBuildStore((state) => state.adjacencyOverlay);
  const activeLevelId = useBuildStore((state) => state.activeLevelId);
  const [showAllLevels3D, setShowAllLevels3D] = useState(false);
  const effective3DLevelId = showAllLevels3D ? null : activeLevelId;
  const projectKey = useBuildStore((state) => state.projectKey);
  const modelRevision = useBuildStore((state) => state.modelRevision);
  const lastLocalThermalRevisionRef = useRef(modelRevision);
  const setTool = useBuildStore((state) => state.setTool);
  const setSelection = useBuildStore((state) => state.setSelection);
  const setGridStep = useBuildStore((state) => state.setGridStep);
  const setOrthogonalMode = useBuildStore((state) => state.setOrthogonalMode);
  const addLevel = useBuildStore((state) => state.addLevel);
  const updateLevel = useBuildStore((state) => state.updateLevel);
  const setActiveLevel = useBuildStore((state) => state.setActiveLevel);
  const addRoom = useBuildStore((state) => state.addRoom);
  const updateRoom = useBuildStore((state) => state.updateRoom);
  const removeRoom = useBuildStore((state) => state.removeRoom);
  const addWall = useBuildStore((state) => state.addWall);
  const setWalls = useBuildStore((state) => state.setWalls);
  const updateWall = useBuildStore((state) => state.updateWall);
  const removeWall = useBuildStore((state) => state.removeWall);
  const setWallFilletAtPoint = useBuildStore((state) => state.setWallFilletAtPoint);
  const addRoof = useBuildStore((state) => state.addRoof);
  const updateRoof = useBuildStore((state) => state.updateRoof);
  const removeRoof = useBuildStore((state) => state.removeRoof);
  const addFloorSlab = useBuildStore((state) => state.addFloorSlab);
  const updateFloorSlab = useBuildStore((state) => state.updateFloorSlab);
  const removeFloorSlab = useBuildStore((state) => state.removeFloorSlab);
  const addStair = useBuildStore((state) => state.addStair);
  const updateStair = useBuildStore((state) => state.updateStair);
  const removeStair = useBuildStore((state) => state.removeStair);
  const addDoor = useBuildStore((state) => state.addDoor);
  const updateDoor = useBuildStore((state) => state.updateDoor);
  const removeDoor = useBuildStore((state) => state.removeDoor);
  const addWindow = useBuildStore((state) => state.addWindow);
  const updateWindow = useBuildStore((state) => state.updateWindow);
  const removeWindow = useBuildStore((state) => state.removeWindow);
  const addPipe = useBuildStore((state) => state.addPipe);
  const updatePipe = useBuildStore((state) => state.updatePipe);
  const removePipe = useBuildStore((state) => state.removePipe);
  const addDuct = useBuildStore((state) => state.addDuct);
  const updateDuct = useBuildStore((state) => state.updateDuct);
  const removeDuct = useBuildStore((state) => state.removeDuct);
  const addEquipment = useBuildStore((state) => state.addEquipment);
  const updateEquipment = useBuildStore((state) => state.updateEquipment);
  const removeEquipment = useBuildStore((state) => state.removeEquipment);
  const addSensor = useBuildStore((state) => state.addSensor);
  const updateSensor = useBuildStore((state) => state.updateSensor);
  const removeSensor = useBuildStore((state) => state.removeSensor);
  const addEngineeringEquipment = useBuildStore((state) => state.addEngineeringEquipment);
  const updateEngineeringEquipment = useBuildStore((state) => state.updateEngineeringEquipment);
  const removeEngineeringEquipment = useBuildStore((state) => state.removeEngineeringEquipment);
  const addEngineeringPipe = useBuildStore((state) => state.addEngineeringPipe);
  const updateEngineeringPipe = useBuildStore((state) => state.updateEngineeringPipe);
  const removeEngineeringPipe = useBuildStore((state) => state.removeEngineeringPipe);
  const setEngineeringSystems = useBuildStore((state) => state.setEngineeringSystems);
  const setActiveScenario = useBuildStore((state) => state.setActiveScenario);
  const addEvent = useBuildStore((state) => state.addEvent);
  const updateEvent = useBuildStore((state) => state.updateEvent);
  const removeEvent = useBuildStore((state) => state.removeEvent);
  const undo = useBuildStore((state) => state.undo);
  const redo = useBuildStore((state) => state.redo);
  const resetModel = useBuildStore((state) => state.resetModel);
  const setProjectKey = useBuildStore((state) => state.setProjectKey);
  const saveSnapshot = useBuildStore((state) => state.saveSnapshot);
  const restoreSnapshot = useBuildStore((state) => state.restoreSnapshot);
  const loadModelSnapshot = useBuildStore((state) => state.loadModelSnapshot);
  const hasSnapshot = useBuildStore((state) => state.hasSnapshot);
  const roomProblems = useBuildStore((state) => state.roomProblems);
  const roomLoops = useBuildStore((state) => state.roomLoops);
  const loopDebugOverlay = useBuildStore((state) => state.loopDebugOverlay);
  const createRoomFromLoop = useBuildStore((state) => state.createRoomFromLoop);
  const projectId = useProjectStore((state) => state.projectId);
  const projectKind = useProjectStore((state) => state.projectKind);
  const setProjectId = useProjectStore((state) => state.setProjectId);
  const setTwin = useTwinStore((state) => state.setTwin);
  const twin = useTwinStore((state) => state.twin);
  const engineBase = useEngineSettingsStore((state) => state.baseUrl);
  const normalizedEngineBase = engineBase.trim();
  const engineConfigured = normalizedEngineBase.length > 0;
  const { importModel, isLoading: isImportingIfc, progress: importProgress } = useModelImport();
  useTwin(projectId ?? null, projectKind);
  useEffect(() => {
    if (!showDevDebug) {
      return;
    }
    console.debug("[analysis-sync] build-page", {
      route: pathname,
      projectKey,
      modelRevision,
      rooms: model.rooms.length,
      walls: model.walls.length,
      levels: model.levels.length,
      activeViewport,
    });
    // #region agent log
    writeAgentDebugLog({sessionId:'c3d591',runId:'repro-4',hypothesisId:'H5',location:'BuildPage.tsx:build-model-snapshot',message:'build page model snapshot',data:{route:pathname,projectId,projectKind,projectKey,modelRevision,rooms:model.rooms.length,walls:model.walls.length,levels:model.levels.length,sourceProjectId:typeof model.meta?.sourceProjectId==='string'?model.meta.sourceProjectId:null,sourceTag:typeof model.meta?.sourceTag==='string'?model.meta.sourceTag:null,activeViewport},timestamp:Date.now()});
    // #endregion
  }, [
    activeViewport,
    model.levels.length,
    model.meta,
    model.rooms.length,
    model.walls.length,
    modelRevision,
    pathname,
    projectId,
    projectKey,
    projectKind,
    showDevDebug,
  ]);
  const {
    viewSnapshots,
    projectSnapshots,
    addViewSnapshot,
    removeViewSnapshot,
    addProjectSnapshot,
    removeProjectSnapshot,
    getProjectSnapshot,
  } = useSnapshots(projectKey);
  const workflowUncertainty = useWorkflowStore((state) => state.uncertaintyConfig);
  const workflowScenario = useWorkflowStore((state) => state.scenarioConfig);
  const setWorkflowUncertainty = useWorkflowStore((state) => state.setUncertaintyConfig);
  const setWorkflowStep = useWorkflowStore((state) => state.setCurrentStep);

  useEffect(() => {
    setThermalOptions(buildThermalOptionsFromWorkflow(workflowScenario));
  }, [workflowScenario]);

  const smartSnapshot = useSmartBuilding({
    model,
    thermalResult,
    updateEquipment,
    updatePipe,
    updateDuct,
    updateSensor,
    addEvent,
    updateEvent,
    removeEvent,
  });

  useEffect(() => {
    if (projectKind !== "engine" || !projectId || !twin) {
      return;
    }
    if (importedTwinLoadedRef.current === projectId) {
      return;
    }
    const meta = model.meta ?? {};
    const modelSourceProjectId = typeof meta.sourceProjectId === "string" ? meta.sourceProjectId : null;
    const hasEditableGeometry = model.rooms.length > 0 || model.walls.length > 0;
    if (hasEditableGeometry && modelSourceProjectId === projectId) {
      importedTwinLoadedRef.current = projectId;
      return;
    }
    const importedModel = buildModelFromTwin(twin, projectId);
    loadModelSnapshot(importedModel);
    importedTwinLoadedRef.current = projectId;
    notifyInfo("Импортированная модель открыта в конструкторе. Геометрия подготовлена для редактирования.");
  }, [loadModelSnapshot, model.meta, model.rooms.length, model.walls.length, notifyInfo, projectId, projectKind, twin]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    const normalizedProjectKey = resolveBuildProjectKey(projectKey);
    const persistedStateKey = `twinstudio.build.${normalizedProjectKey}`;
    console.groupCollapsed("Project/build state debug");
    console.log({
      route: pathname,
      projectId,
      projectKind,
      projectSource: getProjectSource(projectId, projectKind),
      buildProjectKey: projectKey,
      roomsCount: model.rooms.length,
      wallsCount: model.walls.length,
      levelsCount: model.levels.length,
      hasSnapshot,
      localStorageKey: persistedStateKey,
      snapshotStorageKey: `${persistedStateKey}.snapshot`,
    });
    console.groupEnd();
  }, [
    hasSnapshot,
    model.levels.length,
    model.rooms.length,
    model.walls.length,
    pathname,
    projectId,
    projectKey,
    projectKind,
  ]);

  const snapEnabled = gridStep > 0;

  const adjacency = useMemo(() => buildAdjacencyGraph(model), [model]);
  const envelopeMetrics = useMemo(() => computeEnvelopeMetrics(model, adjacency), [model, adjacency]);

  // Читаем широту из мета-данных модели или используем умолчание (Москва)
  const modelLatitude = useMemo(() => {
    const lat = (model.meta as Record<string, unknown> | undefined)?.latitude;
    return typeof lat === "number" && lat >= -90 && lat <= 90 ? lat : 55.75;
  }, [model.meta]);

  // Синхронизируем широту из модели в состояние солнца
  useEffect(() => {
    setSolarTimeState({ latitudeDeg: modelLatitude });
  }, [modelLatitude, setSolarTimeState]);

  const solarPosition: SolarPosition | null = useMemo(
    () =>
      computeSolarPosition({
        latitudeDeg: solarTimeState.latitudeDeg,
        dayOfYear: solarTimeState.dayOfYear,
        hourDecimal: solarTimeState.hour,
      }),
    [solarTimeState]
  );
  const roomEnvelopeMap = useMemo(() => {
    const record: Record<string, RoomEnvelopeMetrics> = {};
    envelopeMetrics.rooms.forEach((room) => {
      record[room.roomId] = room;
    });
    return record;
  }, [envelopeMetrics.rooms]);
  const validationIssues = useMemo(
    () => [...validateModel(model), ...validateEngineeringModel(model, smartSnapshot)],
    [adjacency, model, smartSnapshot]
  );
  const roomNames = useMemo(
    () =>
      Object.fromEntries(
        model.rooms.map((room, index) => [
          room.id,
          getVisibleRoomName(room, index),
        ])
      ),
    [model.rooms]
  );
  const loopMap = useMemo(
    () => Object.fromEntries(roomLoops.map((loop) => [loop.id, loop])),
    [roomLoops]
  );
  const importedTwinLoadedRef = useRef<string | null>(null);
  const centeredProjectRef = useRef<string | null>(null);
  const centeredNetworksRef = useRef<string | null>(null);
  const isWorkspaceSidebarOpenRef = useRef(isWorkspaceSidebarOpen);
  useEffect(() => {
    isWorkspaceSidebarOpenRef.current = isWorkspaceSidebarOpen;
  }, [isWorkspaceSidebarOpen]);

  const isWorkspaceSidebarMobileViewport = useCallback(
    () => typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches,
    []
  );

  const openWorkspaceSidebar = useCallback(
    (tab: WorkspaceSidebarTab) => {
      const wasOpen = isWorkspaceSidebarOpenRef.current;
      setWorkspaceSidebarTab(tab);
      setIsWorkspaceSidebarOpen(true);
      setIsWorkspaceSidebarContentVisible(isWorkspaceSidebarMobileViewport() || wasOpen);
    },
    [isWorkspaceSidebarMobileViewport]
  );

  const handleWorkspaceSidebarToggle = useCallback(
    (tab: WorkspaceSidebarTab) => {
      if (isWorkspaceSidebarOpen && workspaceSidebarTab === tab) {
        setIsWorkspaceSidebarContentVisible(false);
        setIsWorkspaceSidebarOpen(false);
        return;
      }
      openWorkspaceSidebar(tab);
    },
    [isWorkspaceSidebarOpen, openWorkspaceSidebar, workspaceSidebarTab]
  );

  const closeAllTransientPanels = useCallback(
    (options?: { clearSelection?: boolean; keepPanels?: boolean }) => {
      if (!options?.keepPanels) {
        setIsWorkspaceSidebarContentVisible(false);
        setIsWorkspaceSidebarOpen(false);
      }
      setShowHelp(false);
      setThreeDHoverInfo(null);
      if (options?.clearSelection) {
        setSelection(null);
      }
    },
    [setSelection]
  );

  const toggleSnap = useCallback(() => {
    if (snapEnabled) {
      lastGridStepRef.current = gridStep || DEFAULT_GRID_STEP;
      setGridStep(0);
    } else {
      setGridStep(lastGridStepRef.current || DEFAULT_GRID_STEP);
    }
  }, [gridStep, snapEnabled, setGridStep]);

  const toggleOrthogonalMode = useCallback(() => {
    setOrthogonalMode(!orthogonalMode);
  }, [orthogonalMode, setOrthogonalMode]);

  const handleToolChange = useCallback(
    (nextTool: BuildTool) => {
      if (DRAWING_TOOLS.has(nextTool)) {
        setSelection(null);
        setThreeDHoverInfo(null);
        openWorkspaceSidebar("properties");
      }
      if (
        nextTool === "pipe" ||
        nextTool === "duct" ||
        nextTool === "equipment" ||
        nextTool === "sensor" ||
        nextTool === "engineeringEquipment" ||
        nextTool === "engineeringPipe"
      ) {
        setViewer((prev) => ({ ...prev, showNetworks: true, showEquipment: true }));
      }
      setTool(nextTool);
    },
    [openWorkspaceSidebar, setSelection, setTool]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (isTextEditingTarget(event.target)) {
        return;
      }
      if (tool === "select") {
        return;
      }
      event.preventDefault();
      handleToolChange("select");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToolChange, tool]);

  function syncWallsFromRooms(rooms: typeof model.rooms) {
    const result = generateWallsFromRooms(
      {
        ...model,
        rooms,
      },
      { defaultThickness: 0.3 }
    );
    setWalls(result.walls);
  }

  const handleGenerateWallsFromRooms = useCallback(() => {
    const result = generateWallsFromRooms(model, { defaultThickness: 0.3 });
    setWalls(result.walls);
    notifyInfo("Стены обновлены по контурам помещений.");
  }, [model, setWalls]);

  const handleAddTypicalCtp = useCallback(() => {
    if (!activeLevelId) {
      notifyError("Выберите уровень, чтобы разместить типовой ЦТП.");
      return;
    }
    const current = model.engineeringSystems ?? ({ equipment: [], pipes: [] } satisfies EngineeringSystemsModel);
    const templateIndex = Math.floor(current.equipment.length / 10);
    const template = createTypicalCtpEngineeringSystems(activeLevelId, {
      x: 2 + templateIndex * 2,
      y: 2 + templateIndex * 9,
    });
    setEngineeringSystems(
      {
        equipment: [...current.equipment, ...template.equipment],
        pipes: [...current.pipes, ...template.pipes],
      },
      { resetSelection: false }
    );
    setActiveViewport("networks");
    setViewer((prev) => ({ ...prev, showNetworks: true, showEquipment: true }));
    setTool("select");
    if (template.equipment[0]) {
      setSelection({ kind: "engineeringEquipment", id: template.equipment[0].id });
    }
    notifyInfo("Типовой ЦТП добавлен в отдельный инженерный 2D-слой.");
  }, [activeLevelId, model.engineeringSystems, setActiveViewport, setEngineeringSystems, setSelection, setTool, setViewer]);

  const handleAddItpParallelDhw = useCallback(() => {
    if (!activeLevelId) {
      notifyError("Выберите уровень, чтобы разместить ИТП.");
      return;
    }
    const current = model.engineeringSystems ?? ({ equipment: [], pipes: [] } satisfies EngineeringSystemsModel);
    const templateIndex = Math.floor(current.equipment.length / 12);
    const template = createItpParallelDhwDependentHeating(activeLevelId, {
      x: 2 + templateIndex * 2,
      y: 2 + templateIndex * 10,
    });
    setEngineeringSystems(
      {
        equipment: [...current.equipment, ...template.equipment],
        pipes: [...current.pipes, ...template.pipes],
      },
      { resetSelection: false }
    );
    setActiveViewport("networks");
    setViewer((prev) => ({ ...prev, showNetworks: true, showEquipment: true }));
    setTool("select");
    if (template.equipment[0]) {
      setSelection({ kind: "engineeringEquipment", id: template.equipment[0].id });
    }
    notifyInfo("ИТП (параллельная схема ГВС, зависимое отопление) добавлен.");
  }, [activeLevelId, model.engineeringSystems, setActiveViewport, setEngineeringSystems, setSelection, setTool, setViewer]);

  function handleRemoveRoom(roomId: string) {
    removeRoom(roomId);
    syncWallsFromRooms(model.rooms.filter((room) => room.id !== roomId));
  }

  const removeSelection = useCallback(
    (target: Selection | null) => {
      const current = target ?? selection;
      if (!current) {
        return;
      }
      switch (current.kind) {
        case "loop":
          setSelection(null);
          return;
        case "room":
          {
            const room = model.rooms.find((entry) => entry.id === current.id);
            if (room?.source === "auto") {
              notifyInfo("Это помещение создаётся из стен. Измените контур стен, чтобы его убрать.");
              break;
            }
            handleRemoveRoom(current.id);
          }
          break;
        case "wall":
          removeWall(current.id);
          break;
        case "roof":
          removeRoof(current.id);
          break;
        case "slab":
          removeFloorSlab(current.id);
          break;
        case "stair":
          removeStair(current.id);
          break;

        case "door":
          removeDoor(current.id);
          break;
        case "window":
          removeWindow(current.id);
          break;
        case "pipe":
          removePipe(current.id);
          break;
        case "duct":
          removeDuct(current.id);
          break;
        case "equipment":
          removeEquipment(current.id);
          break;
        case "sensor":
          removeSensor(current.id);
          break;
        case "engineeringEquipment":
          removeEngineeringEquipment(current.id);
          break;
        case "engineeringPipe":
          removeEngineeringPipe(current.id);
          break;
        default:
          break;
      }
      setSelection(null);
    },
    [
      model.rooms,
      removeDoor,
      handleRemoveRoom,
      removeWall,
      removeRoof,
      removeFloorSlab,
      removeStair,
      removeWindow,
      removePipe,
      removeDuct,
      removeEquipment,
      removeSensor,
      removeEngineeringEquipment,
      removeEngineeringPipe,
      selection,
      setSelection,
    ]
  );

  const removeAllSelected = useCallback(() => {
    if (multiSelection.length > 0) {
      multiSelection.forEach((item) => removeSelection(item));
      setMultiSelection([]);
      return;
    }
    removeSelection(null);
  }, [multiSelection, removeSelection, setMultiSelection]);

  const COPY_OFFSET = 1.0;

  const duplicateEntity = useCallback(
    (source: NonNullable<import("./build.store").Selection>) => {
      switch (source.kind) {
        case "room": {
          const room = model.rooms.find((r) => r.id === source.id);
          if (!room) return;
          const copy = { ...room, id: createId("room"), polygon: room.polygon.map((p) => ({ x: p.x + COPY_OFFSET, y: p.y + COPY_OFFSET })) };
          addRoom(copy);
          setSelection({ kind: "room", id: copy.id });
          break;
        }
        case "wall": {
          const wall = model.walls.find((w) => w.id === source.id);
          if (!wall) return;
          const copy = { ...wall, id: createId("wall"), a: { x: wall.a.x + COPY_OFFSET, y: wall.a.y + COPY_OFFSET }, b: { x: wall.b.x + COPY_OFFSET, y: wall.b.y + COPY_OFFSET } };
          addWall(copy);
          setSelection({ kind: "wall", id: copy.id });
          break;
        }
        case "roof": {
          const roof = (model.roofs ?? []).find((r) => r.id === source.id);
          if (!roof) return;
          const copy = { ...roof, id: createId("roof"), boundary: roof.boundary.map((p) => ({ x: p.x + COPY_OFFSET, y: p.y + COPY_OFFSET })) };
          addRoof(copy);
          setSelection({ kind: "roof", id: copy.id });
          break;
        }
        case "slab": {
          const slab = (model.floorSlabs ?? []).find((s) => s.id === source.id);
          if (!slab) return;
          const copy = { ...slab, id: createId("slab"), boundary: slab.boundary.map((p) => ({ x: p.x + COPY_OFFSET, y: p.y + COPY_OFFSET })) };
          addFloorSlab(copy);
          setSelection({ kind: "slab", id: copy.id });
          break;
        }
        case "door": {
          const door = model.doors.find((d) => d.id === source.id);
          if (!door) return;
          const copy = { ...door, id: createId("door"), anchor: { ...door.anchor, t: Math.min(door.anchor.t + 0.1, 0.9), offset_m: door.anchor.offset_m + 0.5 }, lost: false };
          addDoor(copy);
          setSelection({ kind: "door", id: copy.id });
          break;
        }
        case "window": {
          const win = model.windows.find((w) => w.id === source.id);
          if (!win) return;
          const copy = { ...win, id: createId("window"), anchor: { ...win.anchor, t: Math.min(win.anchor.t + 0.1, 0.9), offset_m: win.anchor.offset_m + 0.5 }, lost: false };
          addWindow(copy);
          setSelection({ kind: "window", id: copy.id });
          break;
        }
        case "equipment": {
          const eq = model.equipment.find((e) => e.id === source.id);
          if (!eq) return;
          const copy = { ...eq, id: createId("equip"), position: { x: eq.position.x + COPY_OFFSET, y: eq.position.y + COPY_OFFSET }, connectedNetworkIds: [] };
          addEquipment(copy);
          setSelection({ kind: "equipment", id: copy.id });
          break;
        }
        case "sensor": {
          const sensor = model.sensors.find((s) => s.id === source.id);
          if (!sensor) return;
          const copy = { ...sensor, id: createId("sensor"), position: { x: sensor.position.x + COPY_OFFSET, y: sensor.position.y + COPY_OFFSET } };
          addSensor(copy);
          setSelection({ kind: "sensor", id: copy.id });
          break;
        }
        case "pipe": {
          const pipe = model.pipes.find((p) => p.id === source.id);
          if (!pipe) return;
          const copy = { ...pipe, id: createId("pipe"), path: pipe.path.map((p) => ({ x: p.x + COPY_OFFSET, y: p.y + COPY_OFFSET })), connectedEquipmentIds: [] };
          addPipe(copy);
          setSelection({ kind: "pipe", id: copy.id });
          break;
        }
        case "duct": {
          const duct = model.ducts.find((d) => d.id === source.id);
          if (!duct) return;
          const copy = { ...duct, id: createId("duct"), path: duct.path.map((p) => ({ x: p.x + COPY_OFFSET, y: p.y + COPY_OFFSET })), connectedEquipmentIds: [] };
          addDuct(copy);
          setSelection({ kind: "duct", id: copy.id });
          break;
        }
        case "engineeringEquipment": {
          const ee = model.engineeringSystems?.equipment.find((e) => e.id === source.id);
          if (!ee) return;
          const copy = { ...ee, id: createId("ee"), x: ee.x + COPY_OFFSET, y: ee.y + COPY_OFFSET, ports: ee.ports.map((port) => ({ ...port })) };
          addEngineeringEquipment(copy);
          setSelection({ kind: "engineeringEquipment", id: copy.id });
          break;
        }
        case "engineeringPipe": {
          const ep = model.engineeringSystems?.pipes.find((p) => p.id === source.id);
          if (!ep) return;
          const copy = { ...ep, id: createId("ep"), points: ep.points.map((p) => ({ x: p.x + COPY_OFFSET, y: p.y + COPY_OFFSET })), fromEquipmentId: "", toEquipmentId: "", fromPortId: "", toPortId: "" };
          addEngineeringPipe(copy);
          setSelection({ kind: "engineeringPipe", id: copy.id });
          break;
        }
        default:
          break;
      }
    },
    [
      model, addRoom, addWall, addRoof, addFloorSlab, addDoor, addWindow,
      addPipe, addDuct, addEquipment, addSensor, addEngineeringEquipment, addEngineeringPipe, setSelection,
    ]
  );

  const handleCopyLevelModel = useCallback(
    (targetLevelId: string) => {
      if (!activeLevelId || activeLevelId === targetLevelId) return;

      const wallIdMap = new Map<string, string>();
      const sourceWalls = model.walls.filter((w) => w.levelId === activeLevelId);
      const newWalls = sourceWalls.map((w) => {
        const newId = createId("wall");
        wallIdMap.set(w.id, newId);
        return { ...w, id: newId, levelId: targetLevelId };
      });

      const newRooms = model.rooms
        .filter((r) => r.levelId === activeLevelId)
        .map((r) => ({ ...r, id: createId("room"), levelId: targetLevelId }));

      const newRoofs = (model.roofs ?? [])
        .filter((r) => r.levelId === activeLevelId)
        .map((r) => ({ ...r, id: createId("roof"), levelId: targetLevelId }));

      const newSlabs = (model.floorSlabs ?? [])
        .filter((s) => s.levelId === activeLevelId)
        .map((s) => ({ ...s, id: createId("slab"), levelId: targetLevelId }));

      const sourceWallIds = new Set(sourceWalls.map((w) => w.id));
      const newDoors = model.doors
        .filter((d) => d.anchor.wallId != null && sourceWallIds.has(d.anchor.wallId))
        .map((d) => ({
          ...d,
          id: createId("door"),
          anchor: { ...d.anchor, wallId: wallIdMap.get(d.anchor.wallId!) ?? d.anchor.wallId },
          lost: false,
        }));

      const newWindows = model.windows
        .filter((w) => w.anchor.wallId != null && sourceWallIds.has(w.anchor.wallId))
        .map((w) => ({
          ...w,
          id: createId("window"),
          anchor: { ...w.anchor, wallId: wallIdMap.get(w.anchor.wallId!) ?? w.anchor.wallId },
          lost: false,
        }));

      if (newWalls.length > 0) {
        setWalls([...model.walls, ...newWalls]);
      }
      newRooms.forEach((r) => addRoom(r));
      newRoofs.forEach((r) => addRoof(r));
      newSlabs.forEach((s) => addFloorSlab(s));
      newDoors.forEach((d) => addDoor(d));
      newWindows.forEach((w) => addWindow(w));

      const count = newRooms.length + newWalls.length + newRoofs.length + newSlabs.length;
      notifyInfo(`Скопировано ${count} объектов на уровень`);
    },
    [activeLevelId, model, setWalls, addRoom, addRoof, addFloorSlab, addDoor, addWindow]
  );

  function handleAddRoom(room: Parameters<typeof addRoom>[0]) {
    const normalizedRoom = { ...room, source: room.source ?? "manual" };
    addRoom(normalizedRoom);
    syncWallsFromRooms([...model.rooms.filter((entry) => entry.id !== normalizedRoom.id), normalizedRoom]);
  }

  function handleUpdateRoom(roomId: string, patch: Parameters<typeof updateRoom>[1]) {
    const nextPatch = "name" in patch ? { ...patch, source: "manual" as const } : patch;
    updateRoom(roomId, nextPatch);
    if (!("polygon" in patch) && !("levelId" in patch)) {
      return;
    }
    syncWallsFromRooms(model.rooms.map((room) => (room.id === roomId ? { ...room, ...nextPatch } : room)));
  }

  const handleExport = useCallback(() => {
    const twin = buildModelToTwin(model, { projectName: model.meta?.name as string | undefined });
    const blob = new Blob([JSON.stringify(twin, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectId ?? "build-mode"}.twin.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [model, projectId]);

  const handleUseAsTwin = useCallback(() => {
    if (!model.rooms.length) {
      notifyError("Добавьте хотя бы одно помещение.");
      return;
    }
    const twin = buildModelToTwin(model, { projectName: model.meta?.name as string | undefined });
    const localId = `local:${Date.now()}`;
    setTwin(twin);
    setProjectId(localId, "local");
    notifyInfo("Модель сохранена и выбрана. Переходим к Twin Studio.");
    navigate("/");
  }, [model, setProjectId, setTwin]);

  const handleNewModel = useCallback(() => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Очистить текущую модель? Действие нельзя отменить.");
      if (!confirmed) {
        return;
      }
    }
    centeredProjectRef.current = null;
    centeredNetworksRef.current = null;
    resetModel();
    notifyInfo("Создан новый пустой проект.");
  }, [resetModel]);

  const handleSaveProject = useCallback(() => {
    dispatchProjectCommand("save");
    notifyInfo("Сохранение проекта запущено.");
  }, [dispatchProjectCommand]);

  const handleOpenReportExport = useCallback(() => {
    dispatchProjectCommand("export-report");
    navigate("/results");
  }, [dispatchProjectCommand]);

  const handleSaveSnapshot = useCallback(() => {
    saveSnapshot();
    notifyInfo("Снимок сохранён.");
  }, [saveSnapshot]);

  const handleRestoreSnapshot = useCallback(() => {
    const restored = restoreSnapshot();
    if (!restored) {
      notifyError("Снимок не найден. Сначала сохраните текущую модель.");
      return;
    }
    notifyInfo("Снимок восстановлен.");
  }, [restoreSnapshot]);
  const handlePlanExport = useCallback(
    async (format: "png" | "pdf") => {
      setPlanExportMode(true);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const svg = canvasRef.current?.getSvgElement() ?? null;
      if (!svg) {
        setPlanExportMode(false);
        notifyError("План ещё не готов для экспорта.");
        return;
      }
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svg);
      if (!source.includes("xmlns=\"http://www.w3.org/2000/svg\"")) {
        source = source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const viewBox = svg.viewBox?.baseVal;
        const width = viewBox?.width || Number(svg.getAttribute("width")) || svg.clientWidth || 1200;
        const height = viewBox?.height || Number(svg.getAttribute("height")) || svg.clientHeight || 800;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setPlanExportMode(false);
          notifyError("Не удалось подготовить холст для экспорта.");
          URL.revokeObjectURL(url);
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        if (format === "png") {
          canvas.toBlob((pngBlob) => {
            if (!pngBlob) {
              setPlanExportMode(false);
              notifyError("Ошибка экспорта PNG.");
              URL.revokeObjectURL(url);
              return;
            }
            downloadBlob(pngBlob, `${projectId ?? "plan"}-plan.png`);
            setPlanExportMode(false);
            URL.revokeObjectURL(url);
          }, "image/png");
        } else {
          const dataUrl = canvas.toDataURL("image/png");
          const pdf = new jsPDF({
            orientation: width >= height ? "landscape" : "portrait",
            unit: "pt",
            format: [width, height],
          });
          pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
          pdf.save("plan-demonstracionnogo-doma.pdf");
          setPlanExportMode(false);
          URL.revokeObjectURL(url);
        }
      };
      image.onerror = () => {
        setPlanExportMode(false);
        notifyError("Не удалось загрузить SVG для экспорта.");
        URL.revokeObjectURL(url);
      };
      image.src = url;
    },
    [projectId, downloadBlob]
  );

  const handleAddLevel = useCallback(
    (payload: { name: string; elevation_m: number; height_m: number }) => {
      addLevel({
        ...payload,
        name: payload.name.trim() || buildLevelName(model.levels.length + 1),
        id: createId("lvl"),
      });
    },
    [addLevel, model.levels.length]
  );

  useEffect(() => {
    if (model.rooms.length || model.walls.length || (model.roofs?.length ?? 0) || (model.floorSlabs?.length ?? 0) || model.pipes.length || model.ducts.length) {
      return;
    }
    centeredProjectRef.current = null;
    centeredNetworksRef.current = null;
  }, [model.ducts.length, model.pipes.length, model.rooms.length, model.walls.length, model.roofs?.length, model.floorSlabs?.length]);

  useEffect(() => {
    const key = projectId ?? "local-project";
    if (centeredProjectRef.current === key) {
      return;
    }
    if (!model.rooms.length && !model.walls.length && !(model.roofs?.length ?? 0) && !(model.floorSlabs?.length ?? 0)) {
      return;
    }
    centeredProjectRef.current = key;
    requestAnimationFrame(() => {
      canvasRef.current?.zoomToFit();
    });
  }, [model.rooms.length, model.walls.length, model.roofs?.length, model.floorSlabs?.length, projectId]);

  useEffect(() => {
    if (activeViewport !== "networks") {
      return;
    }
    const key = `${projectId ?? "local-project"}:${activeLevelId ?? "all-levels"}`;
    if (centeredNetworksRef.current === key) {
      return;
    }
    if (!model.rooms.length && !model.walls.length && !(model.roofs?.length ?? 0) && !(model.floorSlabs?.length ?? 0) && !model.pipes.length && !model.ducts.length) {
      return;
    }
    centeredNetworksRef.current = key;
    requestAnimationFrame(() => {
      canvasRef.current?.zoomToFit();
    });
  }, [activeLevelId, activeViewport, model.ducts.length, model.pipes.length, model.rooms.length, model.walls.length, model.roofs?.length, model.floorSlabs?.length, projectId]);

  useEffect(() => {
    if (activeViewport !== "plan" && activeViewport !== "networks" && activeViewport !== "view3d") {
      return;
    }
    setCanvasLayoutFitEpoch((epoch) => epoch + 1);
    scheduleCanvasWorkspaceFit();
  }, [activeViewport, panelSide, scheduleCanvasWorkspaceFit]);

  const handleKeyShortcuts = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const editingViewport =
        activeViewport === "plan" || activeViewport === "networks" || activeViewport === "view3d";
      if (key === "escape" && editingViewport && isWorkspaceSidebarOpen) {
        event.preventDefault();
        setIsWorkspaceSidebarContentVisible(false);
        setIsWorkspaceSidebarOpen(false);
        return;
      }
      if (isTextEditingTarget(event.target)) {
        return;
      }
      if (
        isDeleteShortcut(event) &&
        !event.defaultPrevented &&
        (selection || multiSelection.length > 0)
      ) {
        event.preventDefault();
        removeAllSelected();
        return;
      }
      const hasModifier = event.ctrlKey || event.metaKey;
      const isUndoShortcut = hasModifier && (event.key.toLowerCase() === "z" || event.code === "KeyZ");
      const isRedoShortcut = hasModifier && (event.key.toLowerCase() === "y" || event.code === "KeyY");
      if (isUndoShortcut) {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (isRedoShortcut) {
        event.preventDefault();
        redo();
        return;
      }
      if (hasModifier && event.code === "KeyC" && selection && selection.kind !== "loop") {
        setClipboard(selection);
        event.preventDefault();
        return;
      }
      if (hasModifier && event.code === "KeyV" && clipboard) {
        duplicateEntity(clipboard);
        event.preventDefault();
        return;
      }
      const hasDismissibleOverlay = showHelp;
      if (key === "escape" && editingViewport && isWorkspaceSidebarOpen) {
        event.preventDefault();
        setIsWorkspaceSidebarContentVisible(false);
        setIsWorkspaceSidebarOpen(false);
        return;
      }
      if (
        key === "escape" &&
        ((activeViewport === "plan" || activeViewport === "networks") && !DRAWING_TOOLS.has(tool) && hasDismissibleOverlay)
      ) {
        closeAllTransientPanels({ keepPanels: true });
        return;
      }
        if (key === "escape" && activeViewport === "view3d") {
          closeAllTransientPanels({ clearSelection: true, keepPanels: true });
          if (tool !== "select") {
            handleToolChange("select");
          }
          return;
        }
      if (key === "escape" && (selection || multiSelection.length > 0)) {
        setMultiSelection([]);
        setSelection(null);
        setThreeDHoverInfo(null);
        return;
      }
      // Quick numeric/letter tool switching shortcuts disabled by user request.
      },
      [
        activeViewport,
        clipboard,
        closeAllTransientPanels,
        duplicateEntity,
        isWorkspaceSidebarOpen,
        redo,
        removeAllSelected,
        selection,
        multiSelection,
        setClipboard,
        setSelection,
        showHelp,
        tool,
        undo,
      ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyShortcuts);
    return () => window.removeEventListener("keydown", handleKeyShortcuts);
  }, [handleKeyShortcuts]);

  useEffect(() => {
    setThermalTimeIndex(0);
    setThermalPlaying(false);
  }, [thermalResult]);

  useEffect(() => {
    if (lastLocalThermalRevisionRef.current === modelRevision) {
      return;
    }
    lastLocalThermalRevisionRef.current = modelRevision;
    setThermalResult(null);
    setThermalTimeIndex(0);
    setThermalPlaying(false);
    setActiveTransientResult(null);
    setSelectedTransientTimeIndex(0);
    setActiveTransientSourceId(null);
    setActiveTransientSourceType(null);
    setTransientVisualizationEnabled(false);
  }, [modelRevision]);

  useEffect(() => {
    if (!thermalPlaying || !thermalResult?.timeline.length) {
      return;
    }
    const id = window.setInterval(() => {
      setThermalTimeIndex((prev) => {
        const total = thermalResult.timeline.length;
        if (!total) {
          return 0;
        }
        return prev + 1 >= total ? 0 : prev + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [thermalPlaying, thermalResult]);

  useEffect(() => {
    const frames = thermalResult?.timeline ?? [];
    if (!frames.length && thermalTimeIndex !== 0) {
      setThermalTimeIndex(0);
      return;
    }
    if (frames.length && thermalTimeIndex >= frames.length) {
      setThermalTimeIndex(0);
    }
  }, [thermalResult, thermalTimeIndex]);

  useEffect(() => {
    const frames = activeTransientResult?.time ?? [];
    if (!frames.length && selectedTransientTimeIndex !== 0) {
      setSelectedTransientTimeIndex(0);
      return;
    }
    if (frames.length && selectedTransientTimeIndex >= frames.length) {
      setSelectedTransientTimeIndex(frames.length - 1);
    }
  }, [activeTransientResult, selectedTransientTimeIndex]);

  const handleValidationFix = useCallback(
    (action: "auto-close-room" | "merge-colinear-walls" | "remove-tiny-segments") => {
      let changes = 0;
      if (action === "auto-close-room") {
        changes = autoCloseRooms(model.rooms, updateRoom);
      } else if (action === "merge-colinear-walls") {
        changes = mergeColinearWalls(model.walls, setWalls);
      } else if (action === "remove-tiny-segments") {
        changes = removeTinySegments(model, updateRoom, removeWall);
      }
      if (changes) {
        notifyInfo(`Исправлено элементов: ${changes}`);
      } else {
        notifyInfo("Изменений не требуется.");
      }
    },
    [model, removeWall, setWalls, updateRoom]
  );

  const helpContent = (
    <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Горячие клавиши</p>
      <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-muted)]">
        <li>`1` — выбор, `2` — прямоугольная комната, `3` — комната по контуру, `4` — стена</li>
        <li>`5` — крыша, `6` — перекрытие, `7` — трубопровод, `8` — воздуховод, `9` — оборудование, `A` — датчик</li>
        <li>`Del` / `Backspace` — удалить выбранные объекты</li>
        <li>`Ctrl+Z / Ctrl+Y` — отмена и повтор</li>
        <li>`Esc` — отмена текущей операции и возврат к базовому режиму курсора</li>
        <li>Колесо + модификаторы для масштабирования, правая кнопка для панорамирования</li>
      </ul>
    </div>
  );
  const handleRemove = useCallback(
    (target: Selection | null) => {
      removeSelection(target);
    },
    [removeSelection]
  );

  const thermalTimeline = thermalResult?.timeline ?? [];
  const thermalFrame = thermalTimeline[thermalTimeIndex] ?? null;
  const threeDThermalSourceFrame = thermalDisplay.mode === "transient" ? thermalFrame : null;
  const transientVisualizationFrame = useMemo(
    () =>
      transientVisualizationEnabled
        ? buildTransientVisualizationFrame({
            result: activeTransientResult,
            timeIndex: selectedTransientTimeIndex,
            sourceId: activeTransientSourceId,
            sourceType: activeTransientSourceType,
          })
        : null,
    [
      activeTransientResult,
      activeTransientSourceId,
      activeTransientSourceType,
      selectedTransientTimeIndex,
      transientVisualizationEnabled,
    ]
  );
  const thermalFieldBuildOptions = useMemo(
    () => buildThermalFieldOptions(thermalDisplay, thermalOptions, threeDThermalSourceFrame),
    [thermalDisplay, thermalOptions, threeDThermalSourceFrame]
  );
  const legacy3DThermalVisualizationActive =
    thermalDisplay.showFloorField || thermalDisplay.showWallSurfaces || thermalDisplay.showContours;
  const surfaceThermalVisualizationActive =
    thermalDisplay.showSurfaceField || thermalDisplay.showHeatSources || thermalDisplay.showThermalBridges;
  const thermalVisualizationActive =
    legacy3DThermalVisualizationActive ||
    surfaceThermalVisualizationActive ||
    thermalDisplay.showVolumeTint ||
    thermalDisplay.showTooltip;
  const thermalAnalysis = usePreparedThermalAnalysis(
    model,
    thermalFieldBuildOptions,
    threeDThermalSourceFrame,
    thermalVisualizationActive
  );
  const previewThermalFrame = thermalAnalysis.result?.previewFrame ?? null;
  const effective3DThermalFrame = thermalVisualizationActive
    ? (thermalAnalysis.result?.effectiveFrame ?? threeDThermalSourceFrame ?? previewThermalFrame)
    : null;
  const threeDThermalField = thermalAnalysis.result?.field ?? null;
  const planHeatmapIsPreview = !thermalFrame && Boolean(previewThermalFrame);
  const threeDTemperatureRange = useMemo(() => {
    if (!effective3DThermalFrame || !threeDThermalField) {
      return null;
    }
    return buildTemperatureLegendRange(
      threeDThermalField.minTemperatureC,
      threeDThermalField.maxTemperatureC,
      !thermalFrame
    );
  }, [effective3DThermalFrame, thermalFrame, threeDThermalField]);
  const planThermalFrame = thermalFrame ?? previewThermalFrame;
  const planHeatmapActive =
    thermalDisplay.showFloorField && engineeringModeUsesHeatmap(visualizationMode) && Boolean(planThermalFrame);
  const surfaceFieldResult = useMemo(() => {
    if (!threeDThermalField) {
      return null;
    }
    if (!surfaceThermalVisualizationActive && !thermalDisplay.showTooltip) {
      return null;
    }
    return buildSurfaceFieldResult({
      model,
      activeLevelId: effective3DLevelId,
      thermalField: threeDThermalField,
      outdoorTemperatureC: effective3DThermalFrame?.outdoorTemperatureC ?? thermalDisplay.outdoorTemperatureC,
    });
  }, [
    effective3DLevelId,
    effective3DThermalFrame,
    model,
    surfaceThermalVisualizationActive,
    thermalDisplay.outdoorTemperatureC,
    thermalDisplay.showTooltip,
    threeDThermalField,
  ]);
  const threeDSurfaceLegend = useMemo(() => {
    if (!surfaceFieldResult || !thermalDisplay.showSurfaceField) {
      return null;
    }
    const range = getSurfaceFieldValueRange(surfaceFieldResult, thermalDisplay.surfaceFieldMode);
    if (!range) {
      return null;
    }
    return {
      ...range,
      title: SURFACE_FIELD_MODE_LABELS[thermalDisplay.surfaceFieldMode],
      unit: SURFACE_FIELD_MODE_UNITS[thermalDisplay.surfaceFieldMode],
    };
  }, [surfaceFieldResult, thermalDisplay.showSurfaceField, thermalDisplay.surfaceFieldMode]);
  const show3DThermalLegend =
    thermalDisplay.showLegend &&
    !engineeringOverviewActive &&
    ((thermalDisplay.showSurfaceField && threeDSurfaceLegend) ||
      (!THREE_D_SAFE_MODE && !thermalDisplay.showSurfaceField && threeDTemperatureRange));
  const previewUsesLegacy3DThermal = legacy3DThermalVisualizationActive && !thermalDisplay.showSurfaceField;
  const show3DFloorThermalField = previewUsesLegacy3DThermal || thermalDisplay.showFloorField;
  const showAny3DThermalLayer = legacy3DThermalVisualizationActive || surfaceThermalVisualizationActive;
  const surfaceFieldUiState = useMemo(() => {
    const active = surfaceThermalVisualizationActive || thermalDisplay.showTooltip;
    if (!active) {
      return {
        enabled: false,
        reason: "surface field toggles disabled",
      };
    }
    if (!threeDThermalField) {
      return {
        enabled: true,
        reason: "no thermal result",
      };
    }
    if (!model.rooms.length) {
      return {
        enabled: true,
        reason: "no room geometry",
      };
    }
    if (!surfaceFieldResult) {
      return {
        enabled: true,
        reason: "surface field build skipped",
      };
    }
    if (!surfaceFieldResult.surfaces.length) {
      return {
        enabled: true,
        reason: "no resolved room surfaces",
      };
    }
    if (!surfaceFieldResult.patches.length) {
      return {
        enabled: true,
        reason: "no surface patches",
      };
    }
    return {
      enabled: true,
      reason: "ready",
    };
  }, [model.rooms.length, surfaceFieldResult, surfaceThermalVisualizationActive, thermalDisplay.showTooltip, threeDThermalField]);

  const getPlanImageDataUrl = useCallback(async (): Promise<string | null> => {
    const svg = canvasRef.current?.getSvgElement() ?? null;
    if (!svg) {
      notifyError("План ещё не готов для снимка.");
      return null;
    }
    return new Promise<string>((resolve, reject) => {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svg);
      if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
        source = source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const viewBox = svg.viewBox?.baseVal;
        const width = viewBox?.width || Number(svg.getAttribute("width")) || svg.clientWidth || 1200;
        const height = viewBox?.height || Number(svg.getAttribute("height")) || svg.clientHeight || 800;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Не удалось подготовить холст SVG."));
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/png");
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Не удалось загрузить SVG."));
      };
      image.src = url;
    })
      .then((dataUrl) => dataUrl)
      .catch((error) => {
        notifyError(error instanceof Error ? error.message : "Не удалось создать снимок плана.");
        return null;
      });
  }, [notifyError]);

  const getView3DImageDataUrl = useCallback((): string | null => {
    const canvas = view3dCanvasRef.current?.getCanvas();
    if (!canvas) {
      notifyError("3D вид ещё не готов для снимка.");
      return null;
    }
    try {
      return canvas.toDataURL("image/png");
    } catch {
      notifyError("Не удалось получить изображение 3D вида.");
      return null;
    }
  }, [notifyError]);

  const handleCaptureViewSnapshot = useCallback(
    async (kind: ViewSnapshotKind) => {
      const imageData =
        kind === "plan" ? await getPlanImageDataUrl() : getView3DImageDataUrl();
      if (!imageData) {
        return;
      }
      const defaultTitle =
        kind === "plan" ? `План ${new Date().toLocaleTimeString()}` : `3D ${new Date().toLocaleTimeString()}`;
      const titleInput = typeof window !== "undefined" ? window.prompt("Подпись для снимка вида", defaultTitle) : defaultTitle;
      if (titleInput === null) {
        return;
      }
      const title = (titleInput.trim() || defaultTitle).slice(0, 80);
      addViewSnapshot({
        id: createId("viewshot"),
        createdAt: Date.now(),
        title,
        kind,
        overlays: {
          adjacency: adjacencyOverlay,
          heatmap: kind === "plan" ? planHeatmapActive : Boolean(effective3DThermalFrame),
        },
        imageDataUrl: imageData,
      });
      notifyInfo("Снимок вида сохранён.");
    },
    [addViewSnapshot, adjacencyOverlay, effective3DThermalFrame, getPlanImageDataUrl, getView3DImageDataUrl, notifyInfo, planHeatmapActive]
  );

  const handleSaveProjectSnapshot = useCallback(() => {
    if (!model.rooms.length) {
      notifyError("Нет помещений — снимок проекта будет пустым.");
      return;
    }
    const defaultTitle = `Снимок ${new Date().toLocaleString()}`;
    const titleInput = typeof window !== "undefined" ? window.prompt("Название снимка проекта", defaultTitle) : defaultTitle;
    if (titleInput === null) {
      return;
    }
    const commentInput = typeof window !== "undefined" ? window.prompt("Комментарий", "") : "";
    addProjectSnapshot({
      id: createId("projshot"),
      createdAt: Date.now(),
      title: (titleInput.trim() || defaultTitle).slice(0, 80),
      comment: commentInput?.trim() ? commentInput.trim().slice(0, 140) : undefined,
      payload: {
        model: cloneDeep(model),
        thermalOptions: cloneDeep(thermalOptions),
        uncertaintyConfig: workflowUncertainty ? cloneDeep(workflowUncertainty) : null,
      },
    });
    notifyInfo("Проект сохранён.");
  }, [addProjectSnapshot, cloneDeep, model, notifyError, notifyInfo, thermalOptions, workflowUncertainty]);

  const handleRestoreProjectSnapshot = useCallback(
    (id: string) => {
      const snapshot = getProjectSnapshot(id);
      if (!snapshot) {
        notifyError("Снимок не найден.");
        return;
      }
      loadModelSnapshot(cloneDeep(snapshot.payload.model));
      setThermalOptions(cloneDeep(snapshot.payload.thermalOptions));
      if (snapshot.payload.uncertaintyConfig) {
        setWorkflowUncertainty(cloneDeep(snapshot.payload.uncertaintyConfig));
      } else {
        setWorkflowUncertainty(null);
      }
      notifyInfo("Снимок проекта восстановлен.");
    },
    [cloneDeep, getProjectSnapshot, loadModelSnapshot, notifyError, notifyInfo, setThermalOptions, setWorkflowUncertainty]
  );

  const handleDeleteViewSnapshot = useCallback(
    (id: string) => {
      removeViewSnapshot(id);
    },
    [removeViewSnapshot]
  );

  const handleDeleteProjectSnapshot = useCallback(
    (id: string) => {
      removeProjectSnapshot(id);
    },
    [removeProjectSnapshot]
  );

  const handleCreateRoomFromLoop = useCallback(
    (loopId: string) => {
      const loop = roomLoops.find((entry) => entry.id === loopId);
      if (!loop) {
        notifyError("Петля не найдена.");
        return;
      }
      if (!loop.valid) {
        notifyError(loop.reason ?? "Петля некорректна.");
        return;
      }
      const occupant = loop.roomId ? model.rooms.find((room) => room.id === loop.roomId) : null;
      if (occupant && occupant.source !== "auto") {
        notifyInfo("Для этой петли уже существует помещение.");
        return;
      }
      const createdId = createRoomFromLoop(loopId);
      if (createdId) {
        syncWallsFromRooms([
          ...model.rooms.filter((room) => room.id !== createdId),
          {
            id: createdId,
            name: occupant?.name ?? `Помещение ${model.rooms.length + 1}`,
            levelId: loop.levelId,
            polygon: loop.polygon,
            source: "manual",
          },
        ]);
        notifyInfo("Помещение создано по выбранной петле.");
      } else {
        notifyError("Не удалось создать помещение из петли.");
      }
    },
    [roomLoops, model.rooms, createRoomFromLoop, syncWallsFromRooms]
  );
  const handleSetWalls = useCallback(
    (walls: Parameters<typeof setWalls>[0]) => {
      const previousLoops = new Map(roomLoops.map((loop) => [loop.id, { valid: loop.valid, roomId: loop.roomId }]));
      setWalls(walls);
      const { roomLoops: nextLoops } = useBuildStore.getState();
      nextLoops.forEach((loop) => {
        if (!loop.valid || loop.roomId) {
          return;
        }
        const previous = previousLoops.get(loop.id);
        const becameCreatable = !previous || !previous.valid || Boolean(previous.roomId);
        if (!becameCreatable) {
          return;
        }
        createRoomFromLoop(loop.id);
      });
    },
    [createRoomFromLoop, roomLoops, setWalls]
  );

  const handleImportIfc = useCallback(() => {
    if (!engineConfigured) {
      notifyError("Укажите URL движка в разделе «Настройки», чтобы импортировать IFC.");
      return;
    }
    if (isImportingIfc) {
      return;
    }
    setWorkflowStep("geometry");
    ifcInputRef.current?.click();
  }, [engineConfigured, isImportingIfc, setWorkflowStep]);

  const handleIfcFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (ifcInputRef.current) {
        ifcInputRef.current.value = "";
      }
      if (!file) {
        return;
      }
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (extension !== "ifc") {
        notifyError("Поддерживаются только файлы с расширением .ifc");
        return;
      }
      if (!engineConfigured) {
        notifyError("Укажите URL движка в разделе «Настройки», чтобы импортировать IFC.");
        return;
      }
      const engineOnline = await probeEngineHealth();
      if (!engineOnline) {
        const base = normalizedEngineBase || "http://127.0.0.1:8010";
        notifyError(
          `Движок недоступен. Убедитесь, что сервис по адресу ${base} запущен и эндпоинт /health отвечает.`
        );
        return;
      }
      try {
        importedTwinLoadedRef.current = null;
        setTwin(null);
        const data = await importModel(file, { projectName: deriveProjectName(file.name) });
        setProjectId(data.project_id, "engine");
        setWorkflowStep("geometry");
        setActiveViewport("plan");
        notifyInfo(
          `IFC импортирован: проект ${data.project_id}, помещений ${data.spaces_count}. Загружаю геометрию…`
        );
      } catch (error) {
        notifyError(describeImportError(error));
      }
    },
    [
      engineConfigured,
      importModel,
      normalizedEngineBase,
      setActiveViewport,
      setProjectId,
      setTwin,
      setWorkflowStep,
    ]
  );

  const handleCreateNewProject = useCallback(() => {
    const hasGeometry =
      model.rooms.length > 0 ||
      model.walls.length > 0 ||
      (model.roofs?.length ?? 0) > 0 ||
      (model.floorSlabs?.length ?? 0) > 0;
    if (typeof window !== "undefined" && hasGeometry) {
      const confirmed = window.confirm("Создать новый проект? Текущая редактируемая модель будет очищена.");
      if (!confirmed) {
        return;
      }
    }
    const nextProjectId = `local:${Date.now()}`;
    resetModel();
    setTwin(null);
    setProjectId(nextProjectId, "local");
    setProjectKey(nextProjectId);
    setWorkflowStep("geometry");
    setActiveViewport("plan");
    notifyInfo("Создан новый локальный проект.");
  }, [model.floorSlabs?.length, model.rooms.length, model.roofs?.length, model.walls.length, notifyInfo, resetModel, setActiveViewport, setProjectId, setProjectKey, setTwin, setWorkflowStep]);

  const handleOpenDemoProject = useCallback(() => {
    const hasGeometry =
      model.rooms.length > 0 ||
      model.walls.length > 0 ||
      (model.roofs?.length ?? 0) > 0 ||
      (model.floorSlabs?.length ?? 0) > 0;
    if (typeof window !== "undefined" && hasGeometry && projectId !== VIDEO_DEMO_PROJECT_ID) {
      const confirmed = window.confirm("Открыть демонстрационный проект? Текущая редактируемая модель будет заменена.");
      if (!confirmed) {
        return;
      }
    }
    const demoModel = buildVideoDemoProjectModel();
    setTwin(null);
    setProjectId(VIDEO_DEMO_PROJECT_ID, "local");
    setProjectKey(VIDEO_DEMO_PROJECT_ID);
    loadModelSnapshot(demoModel);
    setWorkflowStep("geometry");
    setActiveViewport("plan");
    notifyInfo("Демонстрационный проект открыт в рабочей среде.");
  }, [loadModelSnapshot, model.floorSlabs?.length, model.rooms.length, model.roofs?.length, model.walls.length, notifyInfo, projectId, setActiveViewport, setProjectId, setProjectKey, setTwin, setWorkflowStep]);

  const handleViewportChange = useCallback(
    (mode: BuildViewportMode) => {
      if (mode === "results") {
        navigate("/results");
        return;
      }
      if (mode !== "view3d") {
        hasFittedOnThis3DEntryRef.current = false;
      }
      setActiveViewport(mode);
      const nextMode = modeFromViewport(mode);
      const nextTool = normalizeToolForMode(tool, nextMode);
      if (nextTool !== tool) {
        handleToolChange(nextTool);
      }
      if (mode === "networks") {
        setViewer((prev) => ({ ...prev, showNetworks: true, showEquipment: true }));
      }
    },
    [handleToolChange, navigate, setActiveViewport, setThermalDisplay, setViewer, setVisualizationMode, tool]
  );

  useEffect(() => {
    if (!workspaceCommand || workspaceCommandNonce === 0) {
      return;
    }
    consumeWorkspaceCommand(workspaceCommandNonce);
    switch (workspaceCommand) {
      case "import-ifc":
      case "open-project":
        handleImportIfc();
        break;
      case "new-project":
        handleCreateNewProject();
        break;
      case "open-demo":
        handleOpenDemoProject();
        break;
      case "save":
        handleSaveProjectSnapshot();
        break;
      case "export-report":
        handleViewportChange("results");
        notifyInfo("Откройте блок отчёта в результатах для экспорта PDF.");
        break;
    }
  }, [
    consumeWorkspaceCommand,
    handleCreateNewProject,
    handleImportIfc,
    handleOpenDemoProject,
    handleSaveProjectSnapshot,
    handleViewportChange,
    notifyInfo,
    workspaceCommand,
    workspaceCommandNonce,
  ]);

  useEffect(() => {
    if (pathname === "/results" || activeViewport !== "results") {
      return;
    }
    setActiveViewport("plan");
  }, [activeViewport, pathname, setActiveViewport]);

  const handleOpenThermalModelView = useCallback(() => {
    handleViewportChange("view3d");
    setThermalDisplay((prev) => ({
      ...prev,
      mode: "transient",
      showSurfaceField: true,
      showHeatSources: false,
      showThermalBridges: false,
      showFloorField: true,
      showWallSurfaces: true,
      showLegend: true,
      showTooltip: true,
    }));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        view3dCanvasRef.current?.zoomToFit();
      });
    });
  }, [handleViewportChange]);

  const handleToggleFullscreen = useCallback(() => {
    const element = view3dViewportRef.current;
    if (!element || typeof element.requestFullscreen !== "function") {
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void element.requestFullscreen();
  }, []);

  const handleViewerPatch = useCallback((patch: Partial<BuildViewerOptions>) => {
    log3DInit("viewer-patch", patch);
    const nextViewer = { ...viewer, ...patch };
    const changed = Object.keys(nextViewer).some((key) => {
      const typedKey = key as keyof BuildViewerOptions;
      return nextViewer[typedKey] !== viewer[typedKey];
    });
    if (!changed) {
      return;
    }
    engineeringOverviewSnapshotRef.current = null;
    if (engineeringOverviewActive) {
      setEngineeringOverviewActive(false);
    }
    setViewer(nextViewer);
  }, [engineeringOverviewActive, viewer]);

  const handleVideoDemoStepChange = useCallback((stepId: VideoDemoStepId) => {
    const focusPlan = () => {
      window.requestAnimationFrame(() => {
        canvasRef.current?.zoomToFit();
      });
    };
    const focus3D = (mode: "fit" | "top" = "fit") => {
      window.requestAnimationFrame(() => {
        if (mode === "top") {
          view3dCanvasRef.current?.setTopView();
          return;
        }
        view3dCanvasRef.current?.zoomToFit();
      });
    };

    setThermalPlaying(false);
    setThreeDHoverInfo(null);

    switch (stepId) {
      case "plan":
        setViewer({
          ...DEFAULT_STABLE_VIEWER_OPTIONS,
          showNetworks: false,
          showEquipment: false,
          transparentWalls: false,
        });
        setThermalDisplay((prev) => ({
          ...prev,
          mode: "steady",
          showSurfaceField: false,
          showFloorField: false,
          showContours: false,
          showWallSurfaces: false,
          showLegend: true,
          showTooltip: true,
        }));
        setActiveViewport("plan");
        focusPlan();
        break;
      case "view3d":
        setViewer({
          ...DEFAULT_STABLE_VIEWER_OPTIONS,
          showNetworks: false,
          showEquipment: false,
          transparentWalls: false,
        });
        setThermalDisplay((prev) => ({
          ...prev,
          mode: "steady",
          showSurfaceField: false,
          showFloorField: false,
          showContours: false,
          showWallSurfaces: false,
          showLegend: true,
          showTooltip: true,
        }));
        setActiveViewport("view3d");
        focus3D("fit");
        break;
      case "networks":
        setViewer({
          ...DEFAULT_STABLE_VIEWER_OPTIONS,
          showNetworks: true,
          showEquipment: true,
          transparentWalls: false,
        });
        setThermalDisplay((prev) => ({
          ...prev,
          mode: "steady",
          showSurfaceField: false,
          showFloorField: false,
          showContours: false,
          showWallSurfaces: false,
          showLegend: true,
          showTooltip: true,
        }));
        setActiveViewport("view3d");
        focus3D("fit");
        break;
      case "temperature":
        setThermalTimeIndex(0);
        setViewer({
          ...DEFAULT_STABLE_VIEWER_OPTIONS,
          showNetworks: false,
          showEquipment: false,
          transparentWalls: false,
        });
        setThermalDisplay((prev) => ({
          ...prev,
          mode: "transient",
          showSurfaceField: true,
          showFloorField: true,
          showContours: true,
          showWallSurfaces: false,
          showLegend: true,
          showTooltip: true,
        }));
        setActiveViewport("view3d");
        focus3D("fit");
        break;
      case "sp50":
      case "transient":
      case "uncertainty":
      case "conclusion":
        navigate("/results");
        break;
    }
  }, [navigate]);

  const applyEngineeringOverview = useCallback(() => {
    if (THREE_D_SAFE_MODE) {
      log3DInit("overview-skipped-safe-mode");
      setActiveViewport("view3d");
      return;
    }
    const alreadyApplied =
      activeViewport === "view3d" &&
      engineeringOverviewActive &&
      isEngineeringOverviewPresetActive(viewer) &&
      !thermalDisplay.showSurfaceField &&
      !thermalDisplay.showFloorField &&
      !thermalDisplay.showContours &&
      !thermalDisplay.showWallSurfaces;
    if (alreadyApplied) {
      return;
    }
    if (!engineeringOverviewSnapshotRef.current) {
      engineeringOverviewSnapshotRef.current = {
        viewer,
        thermalDisplay,
        activeViewport,
      };
    }
    setActiveViewport("view3d");
    setViewer((prev) => applyEngineeringOverviewPreset(prev));
    setThermalDisplay((prev) => {
      if (!prev.showSurfaceField && !prev.showFloorField && !prev.showContours && !prev.showWallSurfaces) {
        return prev;
      }
      return {
        ...prev,
        showSurfaceField: false,
        showFloorField: false,
        showContours: false,
        showWallSurfaces: false,
      };
    });
    if (!engineeringOverviewActive) {
      setEngineeringOverviewActive(true);
    }
    scheduleEngineeringOverviewFit("fit");
  }, [activeViewport, engineeringOverviewActive, scheduleEngineeringOverviewFit, thermalDisplay, viewer]);

  const resetEngineeringOverview = useCallback(() => {
    if (THREE_D_SAFE_MODE) {
      engineeringOverviewSnapshotRef.current = null;
      setEngineeringOverviewActive(false);
      return;
    }
    const snapshot = engineeringOverviewSnapshotRef.current;
    if (snapshot) {
      setViewer(clearEngineeringOverviewPreset(snapshot.viewer));
      setThermalDisplay(snapshot.thermalDisplay);
      setActiveViewport(snapshot.activeViewport);
    } else {
      setViewer((prev) => clearEngineeringOverviewPreset(prev));
    }
    engineeringOverviewSnapshotRef.current = null;
    setEngineeringOverviewActive(false);
    scheduleEngineeringOverviewFit("reset");
  }, [scheduleEngineeringOverviewFit]);

  const handleSceneDebugPatch = useCallback((patch: Partial<BuildSceneDebugOptions>) => {
    setSceneDebug((prev) => ({ ...prev, ...patch }));
  }, []);

  const focusViewportTarget = useCallback(
    (target?: Selection | null) => {
      const desiredViewport =
        target?.kind === "pipe" || target?.kind === "duct" || target?.kind === "equipment" || target?.kind === "sensor"
          ? "networks"
          : "plan";
      setActiveViewport(desiredViewport);
      window.requestAnimationFrame(() => {
        if (target) {
          canvasRef.current?.focusSelection(target);
        } else {
          canvasRef.current?.zoomToFit();
        }
      });
    },
    []
  );

  const planWorkspaceActive = resolvedViewport === "plan" || resolvedViewport === "networks";
  const networksViewportActive = resolvedViewport === "networks";
  const planViewportActive = resolvedViewport === "plan";
  const buildEditingActive =
    resolvedViewport === "plan" || resolvedViewport === "networks" || resolvedViewport === "view3d";
  const showBuildToolsPanel = buildEditingActive;
  const showHeaderQuickTools =
    buildEditingActive && toolsPlacement !== "left" && resolvedViewport !== "view3d";
  const showSidebarToolPalette = showBuildToolsPanel && toolsPlacement === "left";
  const compactHeaderTools = toolsPlacement === "compact";
  const editorMode = modeFromViewport(resolvedViewport);
  const showWorkspaceSidebar = buildEditingActive && isWorkspaceSidebarOpen;
  const sidebarColumnWidth = showWorkspaceSidebar ? `${workspaceSidebarWidth}px` : "0px";
  const workspaceGridColumns =
    panelSide === "left"
      ? showWorkspaceSidebar
        ? `${sidebarColumnWidth} minmax(0,1fr)`
        : "0px minmax(0,1fr)"
      : showWorkspaceSidebar
        ? `minmax(0,1fr) ${sidebarColumnWidth}`
        : "minmax(0,1fr) 0px";
  const showPlanHeatmap = planWorkspaceActive && planHeatmapActive;
  const showEngineeringOverlay = planWorkspaceActive && engineeringModeUsesOverlay(visualizationMode);
  const activeLevelName = getLevelDisplayLabel(model, activeLevelId);
  const selectedElementLabel = useMemo(() => getSelectionDisplayLabel(model, selection), [model, selection]);
  useEffect(() => {
    if (!isWorkspaceSidebarOpen) {
      setIsWorkspaceSidebarContentVisible(false);
      return;
    }
    if (isWorkspaceSidebarMobileViewport()) {
      setIsWorkspaceSidebarContentVisible(true);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setIsWorkspaceSidebarContentVisible((visible) => visible || true);
    }, 360);
    return () => window.clearTimeout(timeoutId);
  }, [isWorkspaceSidebarMobileViewport, isWorkspaceSidebarOpen, workspaceSidebarTab]);
  const has3DGeometry =
    model.rooms.length > 0 ||
    model.walls.length > 0 ||
    (model.roofs?.length ?? 0) > 0 ||
    (model.floorSlabs?.length ?? 0) > 0 ||
    model.windows.length > 0 ||
    model.doors.length > 0;
  const has3DThermalData = Boolean(surfaceFieldResult || threeDThermalField || thermalTimeline.length || effective3DThermalFrame);
  const hasVisibleSurfaceFieldData = Boolean(surfaceFieldResult?.surfaces.length && surfaceFieldResult?.patches.length);
  const orderedLevels = useMemo(
    () =>
      [...model.levels].sort(
        (left, right) =>
          left.elevation_m - right.elevation_m ||
          left.height_m - right.height_m ||
          left.id.localeCompare(right.id)
      ),
    [model.levels]
  );
  const activeLevelIndex = useMemo(
    () => orderedLevels.findIndex((level) => level.id === activeLevelId),
    [activeLevelId, orderedLevels]
  );
  const levelQuickNav = useMemo(() => {
    if (!orderedLevels.length) {
      return [];
    }
    const indices = new Set<number>();
    if (activeLevelIndex >= 0) {
      indices.add(activeLevelIndex);
      if (activeLevelIndex > 0) {
        indices.add(activeLevelIndex - 1);
      }
      if (activeLevelIndex < orderedLevels.length - 1) {
        indices.add(activeLevelIndex + 1);
      }
    } else {
      indices.add(0);
    }
    return [...indices]
      .sort((left, right) => left - right)
      .map((index) => {
        const level = orderedLevels[index];
        return {
          id: level.id,
          label: getLevelDisplayLabel({ levels: orderedLevels }, level.id),
          elevationLabel: `${level.elevation_m >= 0 ? "+" : ""}${level.elevation_m.toFixed(2)} м`,
          active: level.id === activeLevelId,
        };
      });
  }, [activeLevelId, activeLevelIndex, orderedLevels]);

  const threeDTimelineActive = thermalDisplay.mode === "transient" && thermalTimeline.length > 0;
  const current3DOutdoorTemperatureC = threeDTimelineActive
    ? (thermalFrame?.outdoorTemperatureC ?? thermalDisplay.outdoorTemperatureC)
    : thermalDisplay.outdoorTemperatureC;
  const threeDThermalStatus = threeDTimelineActive
    ? "3D использует текущий кадр расчётного таймлайна. Наружная температура и распределение температур берутся из результатов моделирования."
    : thermalAnalysis.pending
      ? "Пересчитываю температурное поле для текущих условий среды."
      : thermalAnalysis.error
        ? `Не удалось обновить тепловое поле: ${thermalAnalysis.error}`
        : "Тепловой слой синхронизирован с текущими параметрами сцены.";

  const threeDTooltipStyle = useMemo(() => {
    if (!threeDHoverInfo) {
      return null;
    }
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 960;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720;
    const tooltipWidth = 280;
    const estimatedTooltipHeight = threeDHoverInfo.details?.length ? 190 : 110;
    return {
      left: Math.max(16, Math.min(threeDHoverInfo.screenX + 12, viewportWidth - tooltipWidth - 16)),
      top: Math.max(16, Math.min(threeDHoverInfo.screenY - 12, viewportHeight - estimatedTooltipHeight - 16)),
    };
  }, [threeDHoverInfo]);

  useEffect(() => {
    if (activeViewport !== "view3d") {
      hasFittedOnThis3DEntryRef.current = false;
      return;
    }
    if (THREE_D_SAFE_MODE || hasFittedOnThis3DEntryRef.current) {
      return;
    }
    hasFittedOnThis3DEntryRef.current = true;
    window.requestAnimationFrame(() => {
      if (selection) {
        view3dCanvasRef.current?.focusSelection();
        return;
      }
      view3dCanvasRef.current?.zoomToFit();
    });
  }, [activeLevelId, activeViewport, projectKey, selection]);

  useEffect(
    () => () => {
      if (engineeringOverviewZoomRafRef.current !== null) {
        window.cancelAnimationFrame(engineeringOverviewZoomRafRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (activeViewport !== "view3d" || !thermalDisplay.showTooltip) {
      setThreeDHoverInfo(null);
    }
  }, [activeViewport, thermalDisplay.showTooltip]);
  useEffect(() => {
    if (activeViewport !== "view3d") {
      setSurfaceFieldOverlayDebug(null);
    }
  }, [activeViewport]);

  const handleCanvasWorkspacePointerDown = useCallback(() => {
    if (!buildEditingActive) {
      return;
    }
    if (!showHelp) {
      return;
    }
    closeAllTransientPanels({ keepPanels: true });
  }, [buildEditingActive, closeAllTransientPanels, showHelp]);

  const handleWorkspaceContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!buildEditingActive || !isWorkspaceSidebarOpen) {
        return;
      }
      if ((event.target as HTMLElement | null)?.closest("aside")) {
        return;
      }
      event.preventDefault();
      setIsWorkspaceSidebarContentVisible(false);
      setIsWorkspaceSidebarOpen(false);
    },
    [buildEditingActive, isWorkspaceSidebarOpen]
  );

  const handleWorkspaceLayoutTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.propertyName !== "grid-template-columns" && event.propertyName !== "gap") {
        return;
      }
      if (isWorkspaceSidebarOpen) {
        setIsWorkspaceSidebarContentVisible(true);
      }
    },
    [isWorkspaceSidebarOpen]
  );

  useEffect(() => {
    if (!buildEditingActive || !selection) {
      return;
    }
    openWorkspaceSidebar("properties");
  }, [buildEditingActive, openWorkspaceSidebar, selection]);

  const handlePaletteZoomToFit = useCallback(() => {
    if (resolvedViewport === "view3d") {
      view3dCanvasRef.current?.zoomToFit();
      return;
    }
    canvasRef.current?.zoomToFit();
  }, [resolvedViewport]);

  const handleThermalResult = useCallback((nextResult: ThermalSimulationResult | null) => {
    setThermalResult(nextResult);
  }, []);

  const toolPaletteProps = useMemo(
    () => ({
      currentTool: tool,
      activeViewport: resolvedViewport,
      equipmentPreset,
      engineeringEquipmentPreset,
      pipePreset,
      wallPreset,
      windowPreset,
      doorPreset,
      roofPreset,
      slabPreset,
      heatingDisplayMode,
      showNetworkFlowArrows,
      visualizationMode,
      schematicStyle,
      onToolChange: handleToolChange,
      onViewportChange: handleViewportChange,
      onEquipmentPresetChange: setEquipmentPreset,
      onEngineeringEquipmentPresetChange: setEngineeringEquipmentPreset,
      onPipePresetChange: setPipePreset,
      onWallPresetChange: setWallPreset,
      onWindowPresetChange: setWindowPreset,
      onDoorPresetChange: setDoorPreset,
      onRoofPresetChange: setRoofPreset,
      onSlabPresetChange: setSlabPreset,
      onHeatingDisplayModeChange: setHeatingDisplayMode,
      onShowNetworkFlowArrowsChange: setShowNetworkFlowArrows,
      onVisualizationModeChange: setVisualizationMode,
      onSchematicStyleChange: setSchematicStyle,
      onZoomToFit: handlePaletteZoomToFit,
      onGenerateWallsFromRooms: handleGenerateWallsFromRooms,
      onAddTypicalCtp: handleAddTypicalCtp,
    }),
    [
      equipmentPreset,
      engineeringEquipmentPreset,
      handleAddTypicalCtp,
      handleGenerateWallsFromRooms,
      handlePaletteZoomToFit,
      handleToolChange,
      handleViewportChange,
      heatingDisplayMode,
      pipePreset,
      wallPreset,
      windowPreset,
      doorPreset,
      roofPreset,
      slabPreset,
      resolvedViewport,
      schematicStyle,
      showNetworkFlowArrows,
      tool,
      visualizationMode,
    ]
  );

  const workspaceSidebarContent = buildEditingActive ? (
    <>
      {showSidebarToolPalette ? (
        <div className="ui-build-sidebar-block">
          <BuildToolPalette variant="sidebar" {...toolPaletteProps} />
        </div>
      ) : null}
      {activeViewport === "networks" ? (
        <div className="ui-build-sidebar-block">
          <EngineeringLibraryPanel
            currentTool={tool}
            selectedType={engineeringEquipmentPreset}
            selectedVariant={engineeringEquipmentVariant}
            onPickPipe={() => {
              handleViewportChange("networks");
              handleToolChange("engineeringPipe");
            }}
            onPickEquipment={(type, variant) => {
              handleViewportChange("networks");
              setEngineeringEquipmentPreset(type);
              setEngineeringEquipmentVariant(variant);
              handleToolChange("engineeringEquipment");
            }}
            onAddItpParallelDhw={handleAddItpParallelDhw}
          />
        </div>
      ) : null}
      {workspaceSidebarTab === "browser" ? (
      <>
        <div className="ui-build-sidebar-block">
          <ProjectBrowser
            embedded
            model={model}
            activeLevelId={activeLevelId}
            selection={selection}
            onSelect={(nextSelection) => {
              setSelection(nextSelection);
              if (nextSelection) {
                openWorkspaceSidebar("properties");
              }
            }}
            onLevelSelect={setActiveLevel}
            onFocusViewport={focusViewportTarget}
          />
        </div>
        <div className="ui-build-sidebar-block">
          <LevelsPanel
            levels={model.levels}
            activeLevelId={activeLevelId}
            onSelectLevel={(levelId) => {
              setActiveLevel(levelId);
              handleViewportChange("plan");
            }}
            onAddLevel={handleAddLevel}
            onUpdateLevel={updateLevel}
            onCopyLevelModel={handleCopyLevelModel}
          />
          {engineeringModeUsesOverlay(visualizationMode) ? (
            <EngineeringLegendPanel styleMode={schematicStyle} compact />
          ) : null}
        </div>
      </>
      ) : workspaceSidebarTab === "properties" ? (
      <RightInspector
        model={model}
        selection={selection}
        tool={tool}
        equipmentPreset={equipmentPreset}
        engineeringEquipmentPreset={engineeringEquipmentPreset}
        pipePreset={pipePreset}
        wallPreset={wallPreset}
        windowPreset={windowPreset}
        doorPreset={doorPreset}
        roofPreset={roofPreset}
        slabPreset={slabPreset}
        activeLevelLabel={activeLevelName}
        neighbors={adjacency.neighbors}
        roomNames={roomNames}
        loops={loopMap}
        roomEnvelopes={roomEnvelopeMap}
        onUpdateRoom={handleUpdateRoom}
        onUpdateWall={updateWall}
        onUpdateRoof={updateRoof}
        onAddFloorSlab={addFloorSlab}
        onUpdateFloorSlab={updateFloorSlab}
        onUpdateDoor={updateDoor}
        onUpdateWindow={updateWindow}
        onUpdatePipe={updatePipe}
        onUpdateDuct={updateDuct}
        onUpdateEquipment={updateEquipment}
        onUpdateSensor={updateSensor}
        onUpdateEngineeringEquipment={updateEngineeringEquipment}
        onUpdateEngineeringPipe={updateEngineeringPipe}
        onRemoveSelection={removeAllSelected}
        onDuplicateSelection={selection && selection.kind !== "loop" ? () => duplicateEntity(selection) : undefined}
        onUpdateStair={updateStair}
        onCreateRoomFromLoop={handleCreateRoomFromLoop}
      />
    ) : (
      <>
        <section className="ui-panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Проект</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">Файл проекта, снимки и инженерная сводка без отдельного всплывающего слоя.</p>
            </div>
            <button
              type="button"
              onClick={handleNewModel}
              className="ui-control rounded-[12px] border border-rose-200/80 bg-rose-50/85 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300"
            >
              Новый
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleSaveSnapshot}
              className="ui-control rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-left text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)]"
            >
              Сохранить снимок
            </button>
            <button
              type="button"
              onClick={handleRestoreSnapshot}
              disabled={!hasSnapshot}
              className="ui-control rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-left text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Восстановить снимок
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="ui-control rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-left text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)]"
            >
              Экспорт Twin JSON
            </button>
            <button
              type="button"
              onClick={handleUseAsTwin}
              className="ui-control rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-left text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)]"
            >
              Использовать как Twin
            </button>
            <button
              type="button"
              onClick={() => handlePlanExport("png")}
              className="ui-control rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-left text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)]"
            >
              Экспорт PNG
            </button>
            <button
              type="button"
              onClick={() => handlePlanExport("pdf")}
              className="ui-control rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-left text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)]"
            >
              Скачать план PDF
            </button>
          </div>
        </section>

        <section className="ui-panel p-4 sm:p-5">
          <div className="mb-3">
            <p className="ui-build-section-title">Версии и кадры</p>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Снимки вида и проекта теперь находятся в стабильной боковой области, а не в плавающем dropdown.</p>
          </div>
          <SnapshotsPanel
            viewSnapshots={viewSnapshots}
            projectSnapshots={projectSnapshots}
            onCapturePlan={() => handleCaptureViewSnapshot("plan")}
            onCapture3d={() => handleCaptureViewSnapshot("view3d")}
            onCreateProjectSnapshot={handleSaveProjectSnapshot}
            onDeleteViewSnapshot={handleDeleteViewSnapshot}
            onDeleteProjectSnapshot={handleDeleteProjectSnapshot}
            onRestoreProjectSnapshot={handleRestoreProjectSnapshot}
          />
        </section>

        {showHelp ? helpContent : null}

        <section className="ui-panel p-4 sm:p-5">
          <div className="mb-3">
            <p className="ui-build-section-title">{editorMode === "networks" ? "Сети и оборудование" : "Сводка модели"}</p>
          </div>
          {editorMode === "networks" ? (
            <NetworkSystemsPanel model={model} snapshot={smartSnapshot} onSetActiveScenario={setActiveScenario} />
          ) : (
            <ModelSummaryPanel
              model={model}
              snapshot={smartSnapshot}
              issuesCount={validationIssues.length}
              compact
            />
          )}
        </section>

        {editorMode === "architecture" ? (
          <div ref={projectValidationSectionRef} className="space-y-3">
            <ValidationPanel
              issues={validationIssues}
              onFocus={(target) => {
                if (target) {
                  setSelection(target);
                  focusViewportTarget(target);
                }
              }}
              onFix={handleValidationFix}
            />
            <RoomProblemsPanel problems={roomProblems} levels={model.levels} />
          </div>
        ) : null}
      </>
      )}
    </>
  ) : null;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden bg-transparent px-2 pb-3 pt-2 text-[color:var(--text-base)]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[color:var(--text-base)]">
            Модель здания
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={ifcInputRef}
            type="file"
            accept=".ifc"
            className="hidden"
            onChange={handleIfcFileChange}
          />
          <button type="button" onClick={handleNewModel} className="ui-btn-secondary px-4 py-2 text-sm">
            Новый
          </button>
          <button
            type="button"
            onClick={handleImportIfc}
            disabled={isImportingIfc || !engineConfigured}
            className={`ui-btn-secondary px-4 py-2 text-sm${isImportingIfc ? " cursor-wait opacity-70" : ""}`}
            title={engineConfigured ? undefined : "Движок не настроен"}
          >
            {isImportingIfc ? `Импорт… ${Math.round(importProgress * 100)}%` : "Импорт IFC"}
          </button>
          <button type="button" onClick={handleSaveProject} className="ui-btn-secondary px-4 py-2 text-sm">
            Сохранить
          </button>
          <button type="button" onClick={handleOpenReportExport} className="ui-btn-primary px-4 py-2 text-sm">
            Экспорт
          </button>
        </div>
      </div>
      <header className="ui-toolbar sticky top-0 z-30 flex min-h-[48px] shrink-0 flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-2.5">
          <BuildToolbarGroup label="Вид">
            <div className="ui-segmented-control" role="tablist" aria-label="Режим просмотра">
              <ViewModeTab
                icon="plan2d"
                label="План"
                active={resolvedViewport === "plan"}
                onClick={() => handleViewportChange("plan")}
              />
              <ViewModeTab
                icon="networks"
                label="Сети"
                active={resolvedViewport === "networks"}
                onClick={() => handleViewportChange("networks")}
              />
              <ViewModeTab
                icon="view3d"
                label="3D"
                active={resolvedViewport === "view3d"}
                onClick={() => handleViewportChange("view3d")}
              />
            </div>
          </BuildToolbarGroup>

          {showHeaderQuickTools ? (
            <>
              <BuildToolbarDivider />
              {networksViewportActive ? (
                <>
                  <BuildToolbarGroup label="Сети">
                    <QuickToolButton
                      icon="cursor"
                      label="Выбор"
                      title="Выделение и редактирование"
                      active={tool === "select"}
                      compact
                      onClick={() => handleToolChange("select")}
                    />
                    <QuickToolButton
                      icon="engineeringPipe"
                      label="Труба"
                      title="Соединить оборудование трубой"
                      active={tool === "engineeringPipe"}
                      compact
                      onClick={() => {
                        handleViewportChange("networks");
                        handleToolChange("engineeringPipe");
                      }}
                    />
                  </BuildToolbarGroup>

                  <BuildToolbarDivider />

                  <BuildToolbarGroup label="Экран">
                    <QuickToolButton
                      icon="fit"
                      label="Вписать"
                      title="Вписать модель в экран"
                      compact
                      onClick={handlePaletteZoomToFit}
                    />
                    <QuickToolButton
                      icon="grid"
                      label="Сетка"
                      title="Привязка к сетке и шаг построения"
                      active={snapEnabled}
                      compact
                      onClick={toggleSnap}
                    />
                    <QuickToolButton
                      icon="orthogonal"
                      label="90°"
                      title="Ортогональные углы 90°"
                      active={orthogonalMode}
                      compact
                      onClick={toggleOrthogonalMode}
                    />
                  </BuildToolbarGroup>
                </>
              ) : (
                <>
                  <BuildToolbarGroup label="Рисование">
                    <QuickToolButton
                      icon="cursor"
                      label="Выбор"
                      title="Выделение и редактирование"
                      active={tool === "select"}
                      compact
                      onClick={() => handleToolChange("select")}
                    />
                    <QuickToolButton
                      icon="move"
                      label="Перемещение"
                      title="Перемещение объектов"
                      active={tool === "move"}
                      compact
                      onClick={() => handleToolChange("move")}
                    />
                    <QuickToolButton
                      icon="wall"
                      label="Стены"
                      title="Нарисовать стены и ограждения"
                      active={tool === "wall"}
                      compact
                      onClick={() => {
                        handleViewportChange("plan");
                        handleToolChange("wall");
                      }}
                    />
                    <QuickToolButton
                      icon="fillet"
                      label="Скругление"
                      title="Скругление углов: клик по стыку стен"
                      active={tool === "fillet"}
                      compact
                      onClick={() => {
                        handleViewportChange("plan");
                        handleToolChange("fillet");
                      }}
                    />
                    <QuickToolButton
                      icon="roomRect"
                      label="Помещения"
                      title="Прямоугольное помещение"
                      active={tool === "roomRect" || tool === "room"}
                      compact
                      onClick={() => {
                        handleViewportChange("plan");
                        handleToolChange("roomRect");
                      }}
                    />
                    <QuickToolButton
                      icon="window"
                      label="Окна"
                      title="Добавить окна в выбранные стены"
                      active={tool === "window"}
                      compact
                      onClick={() => {
                        handleViewportChange("plan");
                        handleToolChange("window");
                      }}
                    />
                    <QuickToolButton
                      icon="door"
                      label="Двери"
                      title="Добавить двери в выбранные стены"
                      active={tool === "door"}
                      compact
                      onClick={() => {
                        handleViewportChange("plan");
                        handleToolChange("door");
                      }}
                    />
                    <QuickToolButton
                      icon="roof"
                      label="Крыша"
                      title="Нарисовать кровлю"
                      active={tool === "roof"}
                      compact
                      onClick={() => {
                        handleViewportChange("plan");
                        handleToolChange("roof");
                      }}
                    />
                    <QuickToolButton
                      icon="stair"
                      label="Лестница"
                      title="Нарисовать лестничный марш"
                      active={tool === "stair"}
                      compact
                      onClick={() => {
                        handleViewportChange("plan");
                        handleToolChange("stair");
                      }}
                    />
                  </BuildToolbarGroup>

                  <BuildToolbarDivider />

                  <BuildToolbarGroup label="Экран">
                    <QuickToolButton
                      icon="fit"
                      label="Вписать"
                      title="Вписать модель в экран"
                      compact
                      onClick={handlePaletteZoomToFit}
                    />
                    <QuickToolButton
                      icon="grid"
                      label="Сетка"
                      title="Привязка к сетке и шаг построения"
                      active={snapEnabled}
                      compact
                      onClick={toggleSnap}
                    />
                    <QuickToolButton
                      icon="orthogonal"
                      label="90°"
                      title="Ортогональные углы 90°"
                      active={orthogonalMode}
                      compact
                      onClick={toggleOrthogonalMode}
                    />
                  </BuildToolbarGroup>

                  {!planViewportActive ? (
                    <>
                      <BuildToolbarDivider />

                      <BuildToolbarGroup label="Инженерия">
                        <QuickToolButton
                          icon="pipeSupply"
                          label="Трассы"
                          title="Рисовать инженерные трассы"
                          active={tool === "pipe" || tool === "duct" || tool === "engineeringPipe"}
                          compact
                          onClick={() => {
                            handleViewportChange("networks");
                            handleToolChange("pipe");
                          }}
                        />
                        <QuickToolButton
                          icon="radiator"
                          label="Оборудование"
                          title="Радиаторы и инженерное оборудование"
                          active={tool === "equipment" || tool === "engineeringEquipment"}
                          compact
                          onClick={() => {
                            handleViewportChange("networks");
                            handleToolChange("equipment");
                          }}
                        />
                      </BuildToolbarGroup>
                    </>
                  ) : null}

                  <BuildToolbarDivider />

                  <BuildToolbarGroup label="Уровни">
                    <QuickToolButton
                      icon="levels"
                      label="Уровни"
                      title="Уровни и проводник"
                      active={isWorkspaceSidebarOpen && workspaceSidebarTab === "browser"}
                      compact={compactHeaderTools}
                      onClick={() => handleWorkspaceSidebarToggle("browser")}
                    />
                  </BuildToolbarGroup>
                </>
              )}
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          {levelQuickNav.length ? (
            <div className="ui-tabs-track flex items-center gap-1.5 p-1">
              {resolvedViewport === "view3d" && orderedLevels.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllLevels3D((prev) => !prev)}
                  className={`rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
                    showAllLevels3D
                      ? "ui-control-active border border-[color:var(--accent-muted)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)] shadow-[var(--shadow-control)]"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--text-base)]"
                  }`}
                >
                  <span className="block leading-tight">Все</span>
                  <span className={`block text-[10px] ${showAllLevels3D ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-soft)]"}`}>
                    уровни
                  </span>
                </button>
              )}
              {levelQuickNav.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => {
                    setActiveLevel(level.id);
                    setShowAllLevels3D(false);
                  }}
                  className={`rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
                    level.active && !showAllLevels3D
                      ? "ui-control-active border border-[color:var(--accent-muted)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)] shadow-[var(--shadow-control)]"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--text-base)]"
                  }`}
                >
                  <span className="block leading-tight">{level.label}</span>
                  <span className={`block text-[10px] ${level.active && !showAllLevels3D ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-soft)]"}`}>
                    {level.elevationLabel}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {buildEditingActive && resolvedViewport !== "view3d" ? (
            <>
              <button
                type="button"
                onClick={() => handleWorkspaceSidebarToggle("properties")}
                className={`ui-control rounded-[12px] border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-out active:scale-95 ${
                  showWorkspaceSidebar && workspaceSidebarTab === "properties"
                    ? "ui-control-active border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-base)]"
                    : "border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]"
                }`}
              >
                Свойства
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={handleSaveSnapshot}
            className="ui-control hidden rounded-[12px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text-muted)] transition-all duration-200 hover:border-[color:var(--border-strong)]"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={handleRestoreSnapshot}
            disabled={!hasSnapshot}
            className="ui-control hidden rounded-[12px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text-muted)] transition-all duration-200 hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Восстановить
          </button>
        </div>
      </header>

      <div
        onContextMenu={handleWorkspaceContextMenu}
        onTransitionEnd={handleWorkspaceLayoutTransitionEnd}
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:transition-[grid-template-columns,gap] md:duration-300 md:ease-[cubic-bezier(0.22,1,0.36,1)] ${
          showBuildToolsPanel
            ? panelSide === "left"
              ? `md:grid md:h-full md:max-h-full md:grid-rows-[minmax(0,1fr)] md:items-stretch ${showWorkspaceSidebar ? "md:gap-3" : "md:gap-0"}`
              : `md:grid md:h-full md:max-h-full md:grid-rows-[minmax(0,1fr)] md:items-stretch ${showWorkspaceSidebar ? "md:gap-3" : "md:gap-0"}`
            : ""
        }`}
        style={showBuildToolsPanel ? { gridTemplateColumns: workspaceGridColumns } : undefined}
      >
        {showBuildToolsPanel ? (
          <aside
            style={{ ["--build-sidebar-width" as string]: `${workspaceSidebarWidth}px` }}
            className={`ui-panel max-md:absolute max-md:inset-y-0 max-md:z-20 relative flex h-full max-h-full min-h-0 min-w-0 max-md:w-[min(92vw,var(--build-sidebar-width))] max-md:max-w-[560px] flex-col overflow-hidden rounded-[var(--radius-panel)] border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]/30 shadow-[inset_-1px_0_0_var(--border-soft)] transition-[opacity,transform,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:relative md:inset-auto md:z-0 md:w-full md:max-w-none ${
              panelSide === "left" ? "max-md:left-0 md:col-start-1" : "max-md:right-0 max-md:left-auto md:col-start-2 md:shadow-[inset_1px_0_0_var(--border-soft)]"
            } ${showWorkspaceSidebar ? "opacity-100 md:pointer-events-auto" : "pointer-events-none opacity-0 md:border-transparent"}`}
          >
            <WorkspaceSidebarResizeHandle panelSide={panelSide} enabled={showWorkspaceSidebar} />
            {isWorkspaceSidebarContentVisible ? (
              <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden">
                <div className="ui-build-sidebar-head">
                  <div className="ui-build-sidebar-head__main">
                    <span className="ui-build-sidebar-head__icon" aria-hidden="true">
                      <BuildToolIcon name={WORKSPACE_SIDEBAR_TAB_META[workspaceSidebarTab].icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="ui-build-sidebar-head__title truncate">
                        {WORKSPACE_SIDEBAR_TAB_META[workspaceSidebarTab].title}
                      </p>
                    </div>
                  </div>
                  <div className="ui-build-sidebar-head__actions">
                    <button
                      type="button"
                      onClick={() => {
                        setIsWorkspaceSidebarContentVisible(false);
                        setIsWorkspaceSidebarOpen(false);
                      }}
                      className="ui-build-sidebar-head__action"
                      title="Скрыть панель (Esc)"
                      aria-label="Скрыть панель"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 6l-6 6 6 6"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="ui-build-sidebar-scroll ui-scroll flex min-h-0 min-w-0 flex-1 basis-0 flex-col gap-3 overflow-x-hidden overflow-y-auto">
                  {workspaceSidebarContent}
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}

        <main
          className={`ui-panel relative z-10 grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-[var(--radius-panel)] ${
            showBuildToolsPanel && panelSide === "right" ? "md:col-start-1 md:row-start-1" : ""
          }`}
        >
          <div
            className={`min-h-0 min-w-0 max-w-full overflow-hidden ${resolvedViewport === "view3d" ? "bg-[color:var(--surface-muted)]" : "bg-[color:var(--surface-base)]"}`}
          >
            {(resolvedViewport === "plan" || resolvedViewport === "networks") && (
              <div className="relative h-full min-h-0 min-w-0 max-w-full">
                {resolvedViewport === "networks" && (
                  <div className="hidden rounded-2xl border border-[color:var(--info-border)] bg-[color:var(--info-bg)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                    <p className="font-semibold text-[color:var(--text-base)]">Режим инженерных сетей</p>
                    <p className="mt-1">
                      Рисуйте трубы, воздуховоды, оборудование и датчики. Все элементы видны на плане и в 3D.
                    </p>
                  </div>
                )}
                <Canvas2D
                  ref={canvasRef}
                  layoutFitEpoch={canvasLayoutFitEpoch}
                  model={model}
                  activeLevelId={activeLevelId}
                  tool={tool}
                  selection={selection}
                  multiSelection={multiSelection}
                  gridStep={gridStep || DEFAULT_GRID_STEP}
                  snapEnabled={snapEnabled}
                  orthogonalMode={orthogonalMode}
                  adjacencyOverlay={adjacencyOverlay}
                  neighborEdges={adjacency.edges}
                  centroids={adjacency.centroids}
                  loops={roomLoops}
                  loopDebug={loopDebugOverlay}
                  smartSnapshot={smartSnapshot}
                  showSmartOverlay={resolvedViewport === "networks"}
                  showNetworkFlowArrows={showNetworkFlowArrows}
                  thermalFrame={planThermalFrame}
                  transientFrame={transientVisualizationFrame}
                  preparedThermalField={threeDThermalField}
                  showHeatmap={showPlanHeatmap}
                  heatmapIsPreview={planHeatmapIsPreview}
                  engineeringVisualizationMode={visualizationMode}
                  engineeringSchematicStyle={schematicStyle}
                  showEngineeringOverlay={showEngineeringOverlay}
                  exportMode={planExportMode}
                  thermalBuildOptions={thermalFieldBuildOptions}
                  onViewportPointerDown={handleCanvasWorkspacePointerDown}
                  onToolChange={handleToolChange}
                  onMultiSelectionChange={setMultiSelection}
                  onSelectionChange={(sel) => {
                    setMultiSelection([]);
                    setSelection(sel);
                    if (!sel) {
                      closeAllTransientPanels({ keepPanels: true });
                      return;
                    }
                    openWorkspaceSidebar("properties");
                    if (sel) {
                      handleViewportChange(
                        sel.kind === "pipe" ||
                          sel.kind === "duct" ||
                          sel.kind === "equipment" ||
                          sel.kind === "sensor" ||
                          sel.kind === "engineeringEquipment" ||
                          sel.kind === "engineeringPipe"
                          ? "networks"
                          : "plan"
                      );
                    }
                  }}
                  onAddRoom={handleAddRoom}
                  onUpdateRoom={handleUpdateRoom}
                  onSetWalls={handleSetWalls}
                  onUpdateWall={updateWall}
                  onSetWallFillet={setWallFilletAtPoint}
                  onAddRoof={addRoof}
                  onUpdateRoof={updateRoof}
                  onAddFloorSlab={addFloorSlab}
                  onUpdateFloorSlab={updateFloorSlab}
                  onAddStair={addStair}
                  onUpdateStair={updateStair}
                  onAddDoor={addDoor}
                  onUpdateDoor={updateDoor}
                  onAddWindow={addWindow}
                  onUpdateWindow={updateWindow}
                  onAddPipe={addPipe}
                  onUpdatePipe={updatePipe}
                  onAddDuct={addDuct}
                  onUpdateDuct={updateDuct}
                  pipeType={pipePreset}
                  heatingDisplayMode={heatingDisplayMode}
                  equipmentType={equipmentPreset}
                  engineeringEquipmentType={engineeringEquipmentPreset}
                  engineeringEquipmentVariant={engineeringEquipmentVariant}
                  wallPreset={wallPreset}
                  windowPreset={windowPreset}
                  doorPreset={doorPreset}
                  roofPreset={roofPreset}
                  slabPreset={slabPreset}
                  onAddEquipment={addEquipment}
                  onAddSensor={addSensor}
                  onUpdateEquipment={updateEquipment}
                  onUpdateSensor={updateSensor}
                  onAddEngineeringEquipment={addEngineeringEquipment}
                  onUpdateEngineeringEquipment={updateEngineeringEquipment}
                  onAddEngineeringPipe={addEngineeringPipe}
                  onUpdateEngineeringPipe={updateEngineeringPipe}
                  onRemoveSelection={handleRemove}
                />
                {/* Кнопка солнца на 2D плане и схеме сетей */}
                <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
                  {showSolarSim ? (
                    <div className="pointer-events-auto">
                      <SolarTimeOverlay
                        state={solarTimeState}
                        onChange={(patch) => setSolarTimeState(patch)}
                        onClose={() => setShowSolarSim(false)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSolarSim(true)}
                      title="Показать положение солнца"
                      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-base text-slate-500 shadow-sm hover:bg-slate-50"
                    >
                      ☀️
                    </button>
                  )}
                </div>
              </div>
            )}

            {resolvedViewport === "view3d" && (
              <div
                ref={view3dViewportRef}
                onContextMenu={(event) => event.preventDefault()}
                className="relative h-full min-h-0 min-w-0 max-w-full overflow-hidden overscroll-contain touch-none"
              >
                <Build3DCanonicalPreview
                          ref={view3dCanvasRef}
                          model={model}
                          activeLevelId={effective3DLevelId}
                          selection={selection}
                          viewer={viewer}
                          thermalField={threeDThermalField}
                          surfaceField={surfaceFieldResult}
                          surfaceFieldMode={thermalDisplay.surfaceFieldMode}
                          showSurfaceField={thermalDisplay.showSurfaceField}
                          showHeatSources={thermalDisplay.showHeatSources}
                          showThermalBridges={thermalDisplay.showThermalBridges}
                          surfaceFieldOpacity={thermalDisplay.surfaceFieldOpacity}
                          showTemperature={show3DFloorThermalField}
                          showWallTemperature={show3DFloorThermalField}
                          suppressTemperatureSummaryOverlay={show3DThermalLegend}
                          solarPosition={solarPosition}
                          onSelect={(sel) => {
                            setSelection(sel);
                            setThreeDHoverInfo(null);
                            if (!sel) {
                              return;
                            }
                            openWorkspaceSidebar("properties");
                          }}
                          onHoverInfo={setThreeDHoverInfo}
                          onCameraStateChange={setView3dCameraState}
                          onSurfaceFieldDebug={setSurfaceFieldOverlayDebug}
                />
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between gap-3 p-3">
                      {has3DGeometry || (thermalVisualizationActive && !threeDTimelineActive) ? (
                        <div className="absolute left-3 top-3 z-10 flex max-w-[min(calc(100%-6rem),40rem)] items-start gap-2">
                          {has3DGeometry ? (
                            <OrientationHelper3D
                              cameraState={view3dCameraState}
                              levelName={showAllLevels3D ? "Все уровни" : (activeLevelName || "Все уровни")}
                            />
                          ) : null}
                          {thermalVisualizationActive && !threeDTimelineActive ? (
                            <div className="ui-overlay pointer-events-auto animate-fade-scale rounded-xl px-3 py-2">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setThermalDisplay((prev) => ({
                                        ...prev,
                                        outdoorTemperatureC: Math.max(prev.outdoorTemperatureC - 1, -50),
                                      }))
                                    }
                                    className="ui-control flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-sm font-bold text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-base)]"
                                    title="−1°C"
                                  >
                                    −
                                  </button>
                                  <div className="min-w-[3.25rem] text-center">
                                    <span className="text-lg font-bold tabular-nums text-[color:var(--text-base)]">
                                      {thermalDisplay.outdoorTemperatureC > 0 ? "+" : ""}
                                      {thermalDisplay.outdoorTemperatureC.toFixed(0)}
                                    </span>
                                    <span className="ml-0.5 text-xs text-[color:var(--text-muted)]">°C</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setThermalDisplay((prev) => ({
                                        ...prev,
                                        outdoorTemperatureC: Math.min(prev.outdoorTemperatureC + 1, 50),
                                      }))
                                    }
                                    className="ui-control flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-sm font-bold text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-base)]"
                                    title="+1°C"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1">
                                  {([-25, -15, -5, 0, 5] as const).map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() =>
                                        setThermalDisplay((prev) => ({ ...prev, outdoorTemperatureC: preset }))
                                      }
                                      className={`ui-control rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition ${
                                        thermalDisplay.outdoorTemperatureC === preset
                                          ? "border-[color:var(--accent-muted)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)]"
                                          : "border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:border-[color:var(--border-base)] hover:text-[color:var(--text-base)]"
                                      }`}
                                    >
                                      {preset > 0 ? "+" : ""}
                                      {preset}°
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {/* Кнопка включения солнечной симуляции */}
                      <div className="pointer-events-auto absolute right-3 top-3 z-10">
                        <button
                          type="button"
                          onClick={() => setShowSolarSim((v) => !v)}
                          title={showSolarSim ? "Отключить симуляцию солнца" : "Показать положение солнца"}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-base shadow-sm transition-colors ${
                            showSolarSim
                              ? "border-amber-400 bg-amber-50 text-amber-600"
                              : "border-slate-200 bg-white/90 text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          ☀️
                        </button>
                      </div>
                      {/* Панель управления солнцем */}
                      {showSolarSim && (
                        <div className="pointer-events-auto absolute bottom-4 right-4 z-10">
                          <SolarTimeOverlay
                            state={solarTimeState}
                            onChange={(patch) => setSolarTimeState(patch)}
                            onClose={() => setShowSolarSim(false)}
                          />
                        </div>
                      )}
                      {show3DThermalLegend ? (
                        <div className="ui-overlay pointer-events-none absolute bottom-4 left-4 z-10 w-72 animate-fade-scale">
                          <ThermalFieldLegend
                            minC={thermalDisplay.showSurfaceField ? (threeDSurfaceLegend?.min ?? 0) : (threeDTemperatureRange?.min ?? 15)}
                            maxC={thermalDisplay.showSurfaceField ? (threeDSurfaceLegend?.max ?? 1) : (threeDTemperatureRange?.max ?? 30)}
                            avgC={thermalDisplay.showSurfaceField ? threeDSurfaceLegend?.average : undefined}
                            title={thermalDisplay.showSurfaceField ? (threeDSurfaceLegend?.title ?? "Thermal Field") : "Temperature Scale"}
                            unitLabel={thermalDisplay.showSurfaceField ? (threeDSurfaceLegend?.unit ?? "°C") : "°C"}
                            condensationMode={thermalDisplay.showSurfaceField && thermalDisplay.surfaceFieldMode === "condensationRisk"}
                            source={
                              thermalDisplay.showSurfaceField
                                ? hasVisibleSurfaceFieldData
                                  ? undefined
                                  : `Поле недоступно: ${surfaceFieldUiState.reason}`
                                : threeDTemperatureRange?.synthetic
                                  ? "Предварительная оценка"
                                  : "Расчётное поле"
                            }
                            warnings={
                              thermalDisplay.showSurfaceField && surfaceFieldResult?.warnings.length
                                ? surfaceFieldResult.warnings
                                : undefined
                            }
                          />
                        </div>
                      ) : null}
                      </div>
                      {thermalDisplay.showTooltip && threeDHoverInfo ? (
                        <div
                          className="ui-overlay pointer-events-none absolute z-20 max-w-[280px] px-3 py-2 animate-fade-scale"
                          style={threeDTooltipStyle ?? undefined}
                        >
                          <p className="text-sm font-semibold text-[color:var(--text-base)]">{threeDHoverInfo?.title ?? ""}</p>
                          {threeDHoverInfo?.subtitle ? <p className="mt-0.5 text-xs text-[color:var(--text-soft)]">{threeDHoverInfo?.subtitle}</p> : null}
                          {typeof threeDHoverInfo?.temperatureC === "number" ? (
                            <p className="mt-2 text-xs font-semibold text-[color:var(--text-muted)]">{(threeDHoverInfo?.temperatureC ?? 0).toFixed(1)} °C</p>
                          ) : null}
                          {threeDHoverInfo?.details?.length ? (
                            <div className="mt-2 space-y-1 border-t border-[color:var(--border-soft)] pt-2 text-[11px] text-[color:var(--text-muted)]">
                              {(threeDHoverInfo?.details ?? []).map((detail) => (
                                <div key={detail.label} className="flex items-center justify-between gap-3">
                                  <span>{detail.label}</span>
                                  <span className="font-semibold text-[color:var(--text-muted)]">{detail.value}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
              </div>
            )}

            {activeViewport === "results" && pathname === "/results" && (
              <div
                data-testid="workspace-results-viewport"
                className="ui-scroll h-full max-h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain p-3 pb-6 xl:p-4 xl:pb-6"
              >
                <div className="mx-auto w-full max-w-[1840px] min-w-0 space-y-[var(--space-section)]">
                  <section id="thermal-results-section" className="space-y-4">
                    <ThermalSimulationPanel
                      projectKey={projectKey}
                      model={model}
                      adjacency={adjacency}
                      options={thermalOptions}
                      onOptionsChange={setThermalOptions}
                      onResult={handleThermalResult}
                      onLoadDemoModel={loadModelSnapshot}
                      onVideoDemoStepChange={handleVideoDemoStepChange}
                      onDemoStepChange={(stepId) => {
                        if (THREE_D_SAFE_MODE) {
                          return;
                        }
                        if (shouldEnableEngineeringOverviewForDemoStep(stepId)) {
                          applyEngineeringOverview();
                        } else if (engineeringOverviewActive && engineeringOverviewSnapshotRef.current) {
                          resetEngineeringOverview();
                        }
                      }}
                      onTransientResultChange={({ result: nextResult, sourceId, sourceType }) => {
                        setActiveTransientResult(nextResult);
                        setActiveTransientSourceId(sourceId);
                        setActiveTransientSourceType(sourceType);
                      }}
                      onTransientTimeIndexChange={setSelectedTransientTimeIndex}
                      onTransientVisualizationEnabledChange={setTransientVisualizationEnabled}
                      onRequestThermalModelView={handleOpenThermalModelView}
                    />
                  </section>
                  <ModelSummaryPanel model={model} snapshot={smartSnapshot} issuesCount={validationIssues.length} />
                  <section className="space-y-4">
                    <p className="ui-build-section-title">Оболочка</p>
                    <EnvelopeDashboard metrics={envelopeMetrics} />
                  </section>
                  <section className="space-y-4">
                    <p className="ui-build-section-title">Инженерные сети</p>
                    <NetworkSystemsPanel model={model} snapshot={smartSnapshot} onSetActiveScenario={setActiveScenario} />
                  </section>
                  <section className="space-y-4">
                    <p className="ui-build-section-title">Вероятность и калибровка</p>
                    <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <ThermalMonteCarloPanel model={model} adjacency={adjacency} options={thermalOptions} />
                      <ThermalCalibrationPanel model={model} adjacency={adjacency} options={thermalOptions} />
                    </div>
                  </section>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </section>
  );
}

export function BuildPage() {
  return <BuildPageContent />;
}

function formatTimeLabel(timeHours: number): string {
  if (!Number.isFinite(timeHours)) {
    return "—";
  }
  const totalMinutes = Math.round(timeHours * 60);
  const day = Math.floor(totalMinutes / (24 * 60));
  const remainder = totalMinutes - day * 24 * 60;
  const hours = Math.floor(remainder / 60);
  const minutes = remainder % 60;
  const prefix = day > 0 ? `Д${day} ` : "";
  return `${prefix}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export default BuildPage;
