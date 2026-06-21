import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BuildingModel, Door, FloorSlab, Roof, Vec2, Wall, Window } from "../../../entities/geometry/types";
import type { DuctNetwork, Equipment, PipeNetwork, SensorDevice } from "../../../entities/networks/types";
import {
  getPipeVisualStyle,
  normalizeFlowDirection,
  resolvePipeColor,
  SENSOR_TYPE_LABELS,
} from "../../../entities/networks/types";
import { getEquipmentDisplayName, getRoomDisplayLabel } from "../utils/entityLabels";
import { polygonArea, polygonContainsPoint } from "../../../entities/geometry/geom";
import {
  buildGeometryRenderModel,
  type OpeningCutDescriptor,
  type RoomVolumeDescriptor,
} from "../../../core/geometry/bimPipeline";
import { autoJoinWalls } from "../../../core/editor/geometry";
import type { Selection } from "../build.store";
import type { BuildSectionMode, BuildViewerOptions } from "./viewerOptions";
import type { ThermalTimelinePoint } from "../../../core/thermal/solver";
import type { TransientVisualizationFrame } from "../../../core/thermal/transient/index";
import {
  createThermalFieldModel,
  sampleSmoothedThermalFieldAtPoint,
  sampleThermalFieldAtPoint,
  sampleWallSurfaceTemperatures,
  type ThermalFieldBuildOptions,
  type ThermalFieldModel,
} from "../../../core/thermal/field";
import { temperatureToColor } from "../../twin/twin.theme";
import { anchorToOffset, buildAnchorFromOffset, projectPointToWall, resolveWallPoint } from "../utils/openingMath";
import { createId } from "../../../shared/utils/id";
import type { BuildSceneCallbacksRef, BuildSceneCameraState, BuildSceneContext, BuildSceneDebugOptions } from "./sceneContracts";
import { notifyError } from "../../../entities/notifications/notification.store";
import {
  createPipeDefaults,
  defaultEquipmentParams,
  DOOR_DEFAULTS,
  DUCT_DEFAULTS,
  SENSOR_DEFAULTS,
  WINDOW_DEFAULTS,
} from "../defaults";
import {
  createEquipmentVisual,
  createSensorVisual,
  getEquipmentBaseY,
  getEquipmentWorldConnectionPoint,
  getSensorWorldPosition,
} from "./equipmentMeshes";
import { computeWallJoinData, type WallCornerPatchInput, type WallJoinExtension } from "./wallJoins";
import { arcPolyline } from "../../../core/geometry/fillets";

const MIN_WALL_SEGMENT = 0.05;
const OPENING_CLEARANCE_M = 0.1;
const OPENING_SNAP_DISTANCE_M = 0.6;

export interface BuildSceneController {
  update: (
    model: BuildingModel,
    context: BuildSceneContext,
    options: BuildViewerOptions,
    selection: Selection | null,
    frame: ThermalTimelinePoint | null,
    transientFrame: TransientVisualizationFrame | null,
    thermalField: ThermalFieldModel | null,
    sectionHeight: number,
    sectionMode: BuildSectionMode,
    sectionOffset: number
  ) => void;
  zoomToFit: () => void;
  resetView: () => void;
  setTopView: () => void;
  focusSelection: () => void;
  dispose: () => void;
}

interface MeshWithSelection extends THREE.Mesh<unknown, THREE.Material | THREE.Material[]> {
  userData: {
    selection?: Selection;
  };
}

interface LinearDraft3D {
  tool: "wall" | "pipe" | "duct";
  points: Vec2[];
  levelId: string;
}

interface DragState {
  selection: Exclude<Selection, null>;
  object: MeshWithSelection;
  rootStartPosition: { x: number; y: number; z: number };
  startPoint: Vec2;
  levelId: string | null;
  moved: boolean;
}

interface PlacementPreview {
  tool: "equipment" | "sensor";
  point: Vec2;
  levelId: string;
}

interface WallSurfaceTemperatureProfilePoint {
  offsetRatio: number;
  positiveSideC: number;
  negativeSideC: number;
}

interface HeatmapState {
  roomTemperatures: Record<string, number>;
  wallTemperatures: Record<string, number>;
  field: ThermalFieldModel;
  wallSurfaceTemperatures: Record<
    string,
    {
      negativeSideC: number;
      positiveSideC: number;
      averageC: number;
      profile: WallSurfaceTemperatureProfilePoint[];
    }
  >;
  minTemperatureC: number;
  maxTemperatureC: number;
}

interface PreparedHeatmapStateCache {
  field: ThermalFieldModel;
  state: HeatmapState;
}

interface OpeningAttachment {
  startOffset: number;
  center: Vec2;
  direction: Vec2;
  angle: number;
  wallLength: number;
}

export function createBuildScene(
  canvas: HTMLCanvasElement,
  callbacksRef: BuildSceneCallbacksRef
): BuildSceneController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.clippingPlanes = [];
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f6fa);
  scene.fog = new THREE.Fog(0xf3f6fa, 28, 120);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(12, 11, 12);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = true;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.minDistance = 1.5;
  controls.maxDistance = 220;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.target.set(0, 1, 0);
  const tunedControls = controls as OrbitControls & {
    rotateSpeed?: number;
    zoomSpeed?: number;
    panSpeed?: number;
  };
  tunedControls.rotateSpeed = 0.84;
  tunedControls.zoomSpeed = 0.92;
  tunedControls.panSpeed = 0.86;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  const touchModes = THREE as typeof THREE & {
    TOUCH?: {
      ROTATE: number;
      DOLLY_PAN: number;
    };
  };
  if (touchModes.TOUCH) {
    controls.touches = {
      ONE: touchModes.TOUCH.ROTATE,
      TWO: touchModes.TOUCH.DOLLY_PAN,
    };
  }
  let queuedCameraState: BuildSceneCameraState | null = null;
  let cameraStateFrameId = 0;
  let lastCameraState: BuildSceneCameraState | null = null;
  const buildCameraState = (): BuildSceneCameraState => {
    const dx = camera.position.x - controls.target.x;
    const dy = camera.position.y - controls.target.y;
    const dz = camera.position.z - controls.target.z;
    return {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      azimuthRad: controls.getAzimuthalAngle(),
      polarRad: controls.getPolarAngle(),
      distance: Math.hypot(dx, dy, dz),
    };
  };
  const sameCameraState = (left: BuildSceneCameraState | null, right: BuildSceneCameraState | null) =>
    Boolean(
      left &&
        right &&
        Math.abs(left.position.x - right.position.x) < 0.001 &&
        Math.abs(left.position.y - right.position.y) < 0.001 &&
        Math.abs(left.position.z - right.position.z) < 0.001 &&
        Math.abs(left.target.x - right.target.x) < 0.001 &&
        Math.abs(left.target.y - right.target.y) < 0.001 &&
        Math.abs(left.target.z - right.target.z) < 0.001 &&
        Math.abs(left.azimuthRad - right.azimuthRad) < 0.0005 &&
        Math.abs(left.polarRad - right.polarRad) < 0.0005 &&
        Math.abs(left.distance - right.distance) < 0.001
    );
  const flushCameraState = () => {
    cameraStateFrameId = 0;
    if (currentContext.safeMode || !callbacksRef.current.onCameraStateChange) {
      return;
    }
    if (!queuedCameraState || sameCameraState(lastCameraState, queuedCameraState)) {
      return;
    }
    lastCameraState = queuedCameraState;
    callbacksRef.current.onCameraStateChange?.(queuedCameraState);
  };
  const emitCameraState = () => {
    if (currentContext.safeMode || !callbacksRef.current.onCameraStateChange) {
      return;
    }
    queuedCameraState = buildCameraState();
    if (cameraStateFrameId !== 0) {
      return;
    }
    cameraStateFrameId = window.requestAnimationFrame(flushCameraState);
  };
  controls.addEventListener("change", emitCameraState);

  const ambient = new THREE.AmbientLight(0xffffff, 0.72);
  const hemi = new THREE.HemisphereLight(0xfafcff, 0xd8e2ee, 0.9);
  const directional = new THREE.DirectionalLight(0xfffcf7, 1.14);
  directional.position.set(12, 18, 8);
  directional.castShadow = true;
  directional.shadow.mapSize.set(2048, 2048);
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 80;
  const fillLight = new THREE.DirectionalLight(0xf8fbff, 0.34);
  fillLight.position.set(-8, 10, -6);
  const grid = new THREE.GridHelper(120, 120, 0xcbd5e1, 0xe2e8f0);
  const gridMaterials: THREE.Material[] = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((material: THREE.Material) => {
    material.transparent = true;
    material.opacity = 0.34;
  });
  scene.add(ambient, hemi, directional, fillLight, grid);

  const roomGroup = new THREE.Group();
  const wallGroup = new THREE.Group();
  const roofGroup = new THREE.Group();
  const slabGroup = new THREE.Group();
  const openingGroup = new THREE.Group();
  const cornerGroup = new THREE.Group();
  const networkGroup = new THREE.Group();
  const heatmapGroup = new THREE.Group();
  const debugGroup = new THREE.Group();
  const draftGroup = new THREE.Group();
  const interactionPlane = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.02, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
  );
  scene.add(roomGroup, wallGroup, roofGroup, slabGroup, openingGroup, cornerGroup, networkGroup, heatmapGroup, debugGroup, draftGroup, interactionPlane);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown: { x: number; y: number; button: number } | null = null;
  let dragState: DragState | null = null;
  let draft: LinearDraft3D | null = null;
  let draftPreviewPoint: Vec2 | null = null;
  let placementPreview: PlacementPreview | null = null;
  let hoveredObject: MeshWithSelection | null = null;
  let holdDragTimeoutId: number | null = null;
  let pendingHoldDrag:
    | {
        object: MeshWithSelection;
        selection: Exclude<Selection, null>;
        point: Vec2 | null;
      }
    | null = null;
  let animationFrameId = 0;
  let lastPerfAt = performance.now();
  let lastPerfFrame = lastPerfAt;
  let perfFrames = 0;
  let hasInitialFit = false;
  let suppressContextFinish = false;
  let currentHeatmapState: HeatmapState | null = null;
  let heatmapCache: PreparedHeatmapStateCache | null = null;
  let currentSelection: Selection | null = null;
  let currentTransientFrame: TransientVisualizationFrame | null = null;
  let currentContext: BuildSceneContext = {
    tool: "select",
    activeLevelId: null,
    equipmentType: "radiator",
    pipeType: "heating_supply",
    safeMode: false,
    useSimplifiedEquipment: false,
    debugInit: false,
    showHeatmap: true,
    showContours: true,
    showWallSurfaces: true,
    showVolumeTint: false,
    showTooltip: true,
  };
  let currentModel: BuildingModel = {
    levels: [],
    rooms: [],
    walls: [],
    doors: [],
    windows: [],
    pipes: [],
    ducts: [],
    equipment: [],
    sensors: [],
    scenarios: [],
    activeScenarioId: null,
    events: [],
    meta: {},
  };
  let currentVisibleBounds = computeModelBounds(currentModel);
  let previousLevelId: string | null = null;
  const log3DInit = (...args: unknown[]) => {
    if (currentContext.debugInit) {
      console.info("[3d]", ...args);
    }
  };

  const clearPendingHoldDrag = () => {
    if (holdDragTimeoutId !== null) {
      window.clearTimeout(holdDragTimeoutId);
      holdDragTimeoutId = null;
    }
    pendingHoldDrag = null;
  };

  const resize = () => {
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 300;
    const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 200;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  log3DInit("init-scene");

  const animate = () => {
    const now = performance.now();
    const frameMs = now - lastPerfFrame;
    lastPerfFrame = now;
    perfFrames += 1;
    if (!currentContext.safeMode && callbacksRef.current.onPerformanceStateChange && now - lastPerfAt >= 500) {
      const fps = (perfFrames * 1000) / (now - lastPerfAt);
      callbacksRef.current.onPerformanceStateChange?.({
        fps,
        frameMs,
      });
      perfFrames = 0;
      lastPerfAt = now;
    }
    controls.update();
    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(animate);
  };
  animate();

  const dispose = () => {
    log3DInit("dispose-scene");
    clearPendingHoldDrag();
    resizeObserver.disconnect();
    if (cameraStateFrameId !== 0) {
      window.cancelAnimationFrame(cameraStateFrameId);
    }
    controls.removeEventListener("change", emitCameraState);
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("pointerup", handlePointerUp);
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("pointerleave", handlePointerLeave);
    canvas.removeEventListener("dblclick", handleDoubleClick);
    canvas.removeEventListener("contextmenu", handleContextMenu);
    window.removeEventListener("keydown", handleKeyDown);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    renderer.dispose();
    controls.dispose();
    scene.traverse((object) => {
      if ((object as THREE.Mesh).geometry) {
        (object as THREE.Mesh).geometry.dispose();
      }
      if ((object as THREE.Mesh).material) {
        const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) {
          material.forEach((mat) => mat.dispose());
        } else {
          material.dispose();
        }
      }
    });
  };

  const getActiveLevel = (): BuildingModel["levels"][number] | null => {
    if (!currentModel.levels.length) {
      return null;
    }
    if (currentContext.activeLevelId) {
      const level = currentModel.levels.find((entry) => entry.id === currentContext.activeLevelId);
      if (level) {
        return level;
      }
    }
    return currentModel.levels[0];
  };

  const resolveSelectionLevelId = (selection: Selection | null): string | null => {
    if (!selection) {
      return getActiveLevel()?.id ?? null;
    }
    switch (selection.kind) {
      case "room":
        return currentModel.rooms.find((room) => room.id === selection.id)?.levelId ?? null;
      case "wall":
        return currentModel.walls.find((wall) => wall.id === selection.id)?.levelId ?? null;
      case "roof":
        return (currentModel.roofs ?? []).find((roof) => roof.id === selection.id)?.levelId ?? null;
      case "slab":
        return (currentModel.floorSlabs ?? []).find((slab) => slab.id === selection.id)?.levelId ?? null;
      case "door":
        return currentModel.doors.find((door) => door.id === selection.id)?.anchor.wallId
          ? currentModel.walls.find((wall) => wall.id === currentModel.doors.find((door) => door.id === selection.id)?.anchor.wallId)?.levelId ?? null
          : null;
      case "window":
        return currentModel.windows.find((window) => window.id === selection.id)?.anchor.wallId
          ? currentModel.walls.find((wall) => wall.id === currentModel.windows.find((window) => window.id === selection.id)?.anchor.wallId)?.levelId ?? null
          : null;
      case "pipe":
        return currentModel.pipes.find((pipe) => pipe.id === selection.id)?.levelId ?? null;
      case "duct":
        return currentModel.ducts.find((duct) => duct.id === selection.id)?.levelId ?? null;
      case "equipment":
        return currentModel.equipment.find((item) => item.id === selection.id)?.levelId ?? null;
      case "sensor":
        return currentModel.sensors.find((item) => item.id === selection.id)?.levelId ?? null;
      default:
        return getActiveLevel()?.id ?? null;
    }
  };

  const getLevelElevation = (levelId: string | null): number => {
    if (!levelId) {
      return getActiveLevel()?.elevation_m ?? 0;
    }
    return currentModel.levels.find((level) => level.id === levelId)?.elevation_m ?? 0;
  };

  const syncInteractionPlane = () => {
    const bounds = computeModelBounds(currentModel);
    const activeLevel = getActiveLevel();
    const spanX = Math.max(bounds.maxX - bounds.minX + 20, 40);
    const spanZ = Math.max(bounds.maxZ - bounds.minZ + 20, 40);
    interactionPlane.position.set(bounds.centerX, (activeLevel?.elevation_m ?? 0) - 0.01, bounds.centerZ);
    interactionPlane.scale.set(spanX, 1, spanZ);
  };

  const updatePointer = (event: PointerEvent | MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  };

  const getPlanPoint = (levelId: string | null): Vec2 | null => {
    interactionPlane.position.y = getLevelElevation(levelId) - 0.01;
    const hits = raycaster.intersectObjects([interactionPlane], false);
    const point = hits[0]?.point;
    if (!point) {
      return null;
    }
    return { x: point.x, y: point.z };
  };

  const renderDraft = () => {
    clearGroup(draftGroup);
    if (draft && draft.points.length > 0) {
      const activeDraft = draft;
      const previewPoints = draftPreviewPoint ? [...activeDraft.points, draftPreviewPoint] : activeDraft.points;
      if (previewPoints.length < 2) {
        return;
      }
      const levelElevation = getLevelElevation(activeDraft.levelId);
      previewPoints.slice(1).forEach((point, index) => {
        const start = previewPoints[index];
        const end = point;
        const segment =
          activeDraft.tool === "pipe"
            ? buildCylinderBetween(start, end, 0.035, 0xf97316)
            : buildBoxBetween(
                start,
                end,
                activeDraft.tool === "duct" ? 0.3 : 0.18,
                activeDraft.tool === "duct" ? 0.18 : 3,
                0x0f172a
              );
        if (!segment) {
          return;
        }
        segment.position.y =
          levelElevation +
          (activeDraft.tool === "pipe" ? 0.35 : activeDraft.tool === "duct" ? 2.6 : 1.5);
        draftGroup.add(segment);
      });
      return;
    }
    const previewPlacement = placementPreview;
    if (!previewPlacement) {
      return;
    }
    const level = currentModel.levels.find((entry) => entry.id === previewPlacement.levelId);
    if (!level) {
      return;
    }
    const previewObject =
      previewPlacement.tool === "equipment"
        ? buildEquipmentMesh(
            {
              id: "preview-equipment",
              type: currentContext.equipmentType,
              position: { ...previewPlacement.point },
              levelId: previewPlacement.levelId,
              roomId: findRoomIdAtPoint(previewPlacement.levelId, previewPlacement.point),
              state: "on",
              params: {},
              connectedNetworkIds: [],
            },
            level.elevation_m,
            level.height_m,
            null
          )
        : buildSensorMesh(
            {
              id: "preview-sensor",
              type: "temperature",
              position: { ...previewPlacement.point },
              levelId: previewPlacement.levelId,
              roomId: findRoomIdAtPoint(previewPlacement.levelId, previewPlacement.point),
              value: null,
              unit: "\u00B0C",
              status: "normal",
              history: [],
            },
            level.elevation_m,
            level.height_m,
            null
          );
    applyPreviewStyle(previewObject);
    draftGroup.add(previewObject);
  };

  const cancelDraft = () => {
    draft = null;
    draftPreviewPoint = null;
    renderDraft();
  };

  const finishDraft = () => {
    if (!draft || draft.points.length < 2) {
      cancelDraft();
      return;
    }
    const activeDraft = draft;
    if (activeDraft.tool === "wall") {
      let nextWalls = currentModel.walls.map((wall) => ({
        ...wall,
        a: { ...wall.a },
        b: { ...wall.b },
      }));
      let lastInsertedWallId: string | null = null;
      activeDraft.points.slice(1).forEach((point, index) => {
        const previous = activeDraft.points[index];
        const candidate = {
          id: createId("wall"),
          levelId: activeDraft.levelId,
          a: { ...previous },
          b: { ...point },
          thickness_m: 0.2,
          height_m: currentModel.levels.find((level) => level.id === activeDraft.levelId)?.height_m ?? 3,
        };
        const joined = autoJoinWalls(nextWalls, candidate);
        nextWalls = joined.walls;
        lastInsertedWallId = joined.insertedWallIds[joined.insertedWallIds.length - 1] ?? lastInsertedWallId;
      });
      callbacksRef.current.onSetWalls?.(nextWalls);
      if (lastInsertedWallId) {
        callbacksRef.current.onSelect?.({ kind: "wall", id: lastInsertedWallId });
      }
    }
    if (activeDraft.tool === "pipe") {
      const pipeId = createId("pipe");
      const defaults = createPipeDefaults(currentContext.pipeType);
      callbacksRef.current.onAddPipe?.({
        id: pipeId,
        levelId: activeDraft.levelId,
        ...defaults,
        path: activeDraft.points.map((point) => ({ ...point })),
        connectedEquipmentIds: [],
      });
      callbacksRef.current.onSelect?.({ kind: "pipe", id: pipeId });
    }
    if (activeDraft.tool === "duct") {
      const ductId = createId("duct");
      callbacksRef.current.onAddDuct?.({
        id: ductId,
        levelId: activeDraft.levelId,
        path: activeDraft.points.map((point) => ({ ...point })),
        section: { ...DUCT_DEFAULTS.section },
        airflow_m3_s: DUCT_DEFAULTS.airflow_m3_s,
        airVelocity_m_s: DUCT_DEFAULTS.airVelocity_m_s,
        connectedEquipmentIds: [],
      });
      callbacksRef.current.onSelect?.({ kind: "duct", id: ductId });
    }
    cancelDraft();
  };

  const appendDraftPoint = (point: Vec2) => {
    const activeLevel = getActiveLevel();
    if (!activeLevel) {
      return;
    }
    if (!draft || draft.tool !== currentContext.tool || draft.levelId !== activeLevel.id) {
      draft = { tool: currentContext.tool as LinearDraft3D["tool"], points: [{ ...point }], levelId: activeLevel.id };
      draftPreviewPoint = null;
      renderDraft();
      return;
    }
    const previous = draft.points[draft.points.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) <= 1e-3) {
      return;
    }
    draft = { ...draft, points: [...draft.points, { ...point }] };
    draftPreviewPoint = null;
    renderDraft();
  };

  const startDrag = (object: MeshWithSelection, selection: Exclude<Selection, null>, point: Vec2 | null) => {
    if (!point) {
      return;
    }
    controls.enabled = false;
    dragState = {
      selection,
      object,
      rootStartPosition: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
      },
      startPoint: point,
      levelId: resolveSelectionLevelId(selection),
      moved: false,
    };
  };

  const applyDragPreview = (point: Vec2 | null) => {
    if (!dragState || !point) {
      return;
    }
    const dx = point.x - dragState.startPoint.x;
    const dz = point.y - dragState.startPoint.y;
    if (Math.hypot(dx, dz) > 0.015) {
      dragState.moved = true;
    }
    dragState.object.position.set(
      dragState.rootStartPosition.x + dx,
      dragState.rootStartPosition.y,
      dragState.rootStartPosition.z + dz
    );
  };

  const findRoomIdAtPoint = (levelId: string | null, point: Vec2): string | null => {
    if (!levelId) {
      return null;
    }
    return (
      currentModel.rooms.find((room) => room.levelId === levelId && polygonContainsPoint(point, room.polygon))?.id ?? null
    );
  };

  const commitDrag = () => {
    if (!dragState) {
      return;
    }
    const currentPoint = getPlanPoint(dragState.levelId);
    const dx = currentPoint ? currentPoint.x - dragState.startPoint.x : 0;
    const dy = currentPoint ? currentPoint.y - dragState.startPoint.y : 0;
    const moved = dragState.moved && Math.hypot(dx, dy) > 0.015;
    const selection = dragState.selection;
    dragState.object.position.set(
      dragState.rootStartPosition.x,
      dragState.rootStartPosition.y,
      dragState.rootStartPosition.z
    );
    dragState = null;
    controls.enabled = true;
    if (!moved) {
      callbacksRef.current.onSelect?.(selection);
      return;
    }

    switch (selection.kind) {
      case "room": {
        const room = currentModel.rooms.find((entry) => entry.id === selection.id);
        if (!room) {
          return;
        }
        callbacksRef.current.onUpdateRoom?.(room.id, {
          polygon: room.polygon.map((point) => ({ x: point.x + dx, y: point.y + dy })),
        });
        break;
      }
      case "wall": {
        const wall = currentModel.walls.find((entry) => entry.id === selection.id);
        if (!wall) {
          return;
        }
        callbacksRef.current.onUpdateWall?.(wall.id, {
          a: { x: wall.a.x + dx, y: wall.a.y + dy },
          b: { x: wall.b.x + dx, y: wall.b.y + dy },
        });
        break;
      }
      case "door": {
        const door = currentModel.doors.find((entry) => entry.id === selection.id);
        const wall = door?.anchor.wallId ? currentModel.walls.find((entry) => entry.id === door.anchor.wallId) : null;
        if (!door || !wall || !currentPoint) {
          return;
        }
        const projection = projectPointToWall(currentPoint, wall);
        if (!projection) {
          return;
        }
        const placement = resolveOpeningPlacement(wall, projection.center, door.width_m, door.id);
        if (!placement) {
          notifyError("Нельзя переместить дверь: проём выйдет за границы стены или пересечётся с другим.");
          return;
        }
        callbacksRef.current.onUpdateDoor?.(door.id, {
          anchor: buildAnchorFromOffset(wall, placement.startOffsetM),
          lost: false,
        });
        break;
      }
      case "window": {
        const windowItem = currentModel.windows.find((entry) => entry.id === selection.id);
        const wall = windowItem?.anchor.wallId ? currentModel.walls.find((entry) => entry.id === windowItem.anchor.wallId) : null;
        if (!windowItem || !wall || !currentPoint) {
          return;
        }
        const projection = projectPointToWall(currentPoint, wall);
        if (!projection) {
          return;
        }
        const placement = resolveOpeningPlacement(wall, projection.center, windowItem.width_m, windowItem.id);
        if (!placement) {
          notifyError("Нельзя переместить окно: проём выйдет за границы стены или пересечётся с другим.");
          return;
        }
        callbacksRef.current.onUpdateWindow?.(windowItem.id, {
          anchor: buildAnchorFromOffset(wall, placement.startOffsetM),
          lost: false,
        });
        break;
      }
      case "pipe": {
        const pipe = currentModel.pipes.find((entry) => entry.id === selection.id);
        if (!pipe) {
          return;
        }
        callbacksRef.current.onUpdatePipe?.(pipe.id, {
          path: pipe.path.map((point) => ({ x: point.x + dx, y: point.y + dy })),
        });
        break;
      }
      case "duct": {
        const duct = currentModel.ducts.find((entry) => entry.id === selection.id);
        if (!duct) {
          return;
        }
        callbacksRef.current.onUpdateDuct?.(duct.id, {
          path: duct.path.map((point) => ({ x: point.x + dx, y: point.y + dy })),
        });
        break;
      }
      case "equipment": {
        const equipment = currentModel.equipment.find((entry) => entry.id === selection.id);
        if (!equipment) {
          return;
        }
        const position = { x: equipment.position.x + dx, y: equipment.position.y + dy };
        callbacksRef.current.onUpdateEquipment?.(equipment.id, {
          position,
          roomId: findRoomIdAtPoint(equipment.levelId, position),
        });
        break;
      }
      case "sensor": {
        const sensor = currentModel.sensors.find((entry) => entry.id === selection.id);
        if (!sensor) {
          return;
        }
        const position = { x: sensor.position.x + dx, y: sensor.position.y + dy };
        callbacksRef.current.onUpdateSensor?.(sensor.id, {
          position,
          roomId: findRoomIdAtPoint(sensor.levelId, position),
        });
        break;
      }
      default:
        break;
    }
  };

  const placeOpeningOnWall = (kind: "door" | "window", wallId: string, point: Vec2) => {
    const wall = currentModel.walls.find((entry) => entry.id === wallId);
    if (!wall) {
      return;
    }
    const projection = projectPointToWall(point, wall);
    if (!projection || projection.distance > OPENING_SNAP_DISTANCE_M) {
      notifyError("Подведите курсор ближе к стене.");
      return;
    }

    const defaults =
      kind === "door"
        ? { width_m: DOOR_DEFAULTS.width, height_m: DOOR_DEFAULTS.height, sill_m: undefined as number | undefined }
        : { width_m: WINDOW_DEFAULTS.width, height_m: WINDOW_DEFAULTS.height, sill_m: WINDOW_DEFAULTS.sill };
    const placement = resolveOpeningPlacement(wall, projection.center, defaults.width_m);
    if (!placement) {
      notifyError("Проём не помещается в стене или пересекается с другим.");
      return;
    }
    if (kind === "window" && defaults.height_m + (defaults.sill_m ?? 0) > wall.height_m - 0.02) {
      notifyError("Окно не помещается по высоте стены.");
      return;
    }

    if (kind === "door") {
      const doorId = createId("door");
      callbacksRef.current.onAddDoor?.({
        id: doorId,
        anchor: buildAnchorFromOffset(wall, placement.startOffsetM),
        width_m: defaults.width_m,
        height_m: defaults.height_m,
      });
      callbacksRef.current.onSelect?.({ kind: "door", id: doorId });
      return;
    }

    const windowId = createId("window");
    callbacksRef.current.onAddWindow?.({
      id: windowId,
      anchor: buildAnchorFromOffset(wall, placement.startOffsetM),
      width_m: defaults.width_m,
      height_m: defaults.height_m,
      sill_m: defaults.sill_m,
    });
    callbacksRef.current.onSelect?.({ kind: "window", id: windowId });
  };

  const resolveOpeningPlacement = (
    wall: Wall,
    centerOffsetM: number,
    widthM: number,
    ignoreOpeningId?: string
  ): { startOffsetM: number } | null => {
    const wallLength = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const halfWidth = widthM / 2;
    if (wallLength <= widthM + OPENING_CLEARANCE_M * 2) {
      return null;
    }
    const minCenter = OPENING_CLEARANCE_M + halfWidth;
    const maxCenter = wallLength - OPENING_CLEARANCE_M - halfWidth;
    if (minCenter >= maxCenter) {
      return null;
    }
    const clampedCenter = clamp(centerOffsetM, minCenter, maxCenter);
    const startOffsetM = clampedCenter - halfWidth;
    const endOffsetM = clampedCenter + halfWidth;
    const overlaps = [...currentModel.doors, ...currentModel.windows].some((opening) => {
      if (opening.anchor.wallId !== wall.id || opening.id === ignoreOpeningId) {
        return false;
      }
      const existingStart = anchorToOffset(opening.anchor, wall);
      const existingEnd = existingStart + opening.width_m;
      return Math.max(startOffsetM, existingStart) < Math.min(endOffsetM, existingEnd);
    });
    return overlaps ? null : { startOffsetM };
  };

  const placeNetworkObject = (kind: "equipment" | "sensor", point: Vec2) => {
    const activeLevel = getActiveLevel();
    if (!activeLevel) {
      return;
    }
    if (kind === "equipment") {
      const equipmentId = createId("equipment");
      callbacksRef.current.onAddEquipment?.({
        id: equipmentId,
        type: currentContext.equipmentType,
        position: { ...point },
        levelId: activeLevel.id,
        roomId: findRoomIdAtPoint(activeLevel.id, point),
        state: "on",
        params: defaultEquipmentParams(currentContext.equipmentType),
        connectedNetworkIds: [],
      });
      callbacksRef.current.onSelect?.({ kind: "equipment", id: equipmentId });
      return;
    }
    const sensorId = createId("sensor");
    callbacksRef.current.onAddSensor?.({
      id: sensorId,
      type: SENSOR_DEFAULTS.type,
      position: { ...point },
      levelId: activeLevel.id,
      roomId: findRoomIdAtPoint(activeLevel.id, point),
      value: null,
      unit: "°C",
      status: SENSOR_DEFAULTS.status,
      history: [],
    });
    callbacksRef.current.onSelect?.({ kind: "sensor", id: sensorId });
  };

  const handlePointerDown = (event: PointerEvent) => {
    pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
    clearPendingHoldDrag();
    if (event.button === 2) {
      suppressContextFinish = false;
    }
    updatePointer(event);
    if (event.button !== 0 || (currentContext.tool !== "move" && currentContext.tool !== "select")) {
      return;
    }
    const objectHits = raycaster.intersectObjects(scene.children, true);
    const hovered = objectHits
      .map((hit) => findSelectableObject(hit.object as MeshWithSelection | null))
      .find((entry): entry is MeshWithSelection => Boolean(entry));
    if (!hovered) {
      return;
    }
    const selection = hovered ? findSelection(hovered) : null;
    if (!selection || !currentSelection || selection.kind !== currentSelection.kind || selection.id !== currentSelection.id) {
      return;
    }
    const planPoint = getPlanPoint(resolveSelectionLevelId(selection));
    if (currentContext.tool === "move") {
      startDrag(hovered, selection, planPoint);
      return;
    }
    pendingHoldDrag = {
      object: hovered,
      selection,
      point: planPoint,
    };
    holdDragTimeoutId = window.setTimeout(() => {
      const activeHold = pendingHoldDrag;
      holdDragTimeoutId = null;
      pendingHoldDrag = null;
      if (!activeHold || !pointerDown || pointerDown.button !== 0 || dragState) {
        return;
      }
      startDrag(activeHold.object, activeHold.selection, activeHold.point);
    }, 220);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!pointerDown) {
      return;
    }
    const movement = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    clearPendingHoldDrag();
    const releasedButton = event.button;
    pointerDown = null;
    updatePointer(event);
    if (releasedButton === 2) {
      return;
    }
    if (dragState) {
      commitDrag();
      return;
    }
    if (movement > 5) {
      return;
    }
    const intersects = raycaster.intersectObjects(scene.children, true);
    const planPoint = getPlanPoint(getActiveLevel()?.id ?? null);

    if (currentContext.tool === "wall" || currentContext.tool === "pipe" || currentContext.tool === "duct") {
      if (planPoint) {
        appendDraftPoint(planPoint);
      }
      return;
    }

    if ((currentContext.tool === "door" || currentContext.tool === "window") && planPoint) {
      for (const hit of intersects) {
        const selection = findSelection(hit.object as MeshWithSelection);
        if (selection?.kind === "wall") {
          placeOpeningOnWall(currentContext.tool, selection.id, planPoint);
          return;
        }
      }
    }

    if ((currentContext.tool === "equipment" || currentContext.tool === "sensor") && planPoint) {
      placeNetworkObject(currentContext.tool, planPoint);
      return;
    }

    for (const hit of intersects) {
      const selection = findSelection(hit.object as MeshWithSelection);
      if (selection) {
        callbacksRef.current.onSelect?.(selection);
        return;
      }
    }
    callbacksRef.current.onSelect?.(null);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (pointerDown?.button === 2 && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 4) {
      suppressContextFinish = true;
    }
    if (pendingHoldDrag && pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) {
      clearPendingHoldDrag();
    }
    updatePointer(event);
    if (dragState) {
      applyDragPreview(getPlanPoint(dragState.levelId));
      canvas.style.cursor = "grabbing";
      callbacksRef.current.onHoverInfo?.(null);
      return;
    }
    const intersects = raycaster.intersectObjects(scene.children, true);
    const hoveredEntry =
      intersects
        .map((hit) => ({
          object: findSelectableObject(hit.object as MeshWithSelection | null),
          point: { x: hit.point.x, y: hit.point.z },
        }))
        .find((entry): entry is { object: MeshWithSelection; point: Vec2 } => Boolean(entry.object)) ?? null;
    const hoveredHit = hoveredEntry?.object ?? null;

    if (hoveredObject !== hoveredHit) {
      setHoverState(hoveredObject, false);
      hoveredObject = hoveredHit;
      setHoverState(hoveredObject, true);
    }
    if (draft && (currentContext.tool === "wall" || currentContext.tool === "pipe" || currentContext.tool === "duct")) {
      draftPreviewPoint = getPlanPoint(draft.levelId);
      renderDraft();
    }
    if (!dragState && !draft && (currentContext.tool === "equipment" || currentContext.tool === "sensor")) {
      const activeLevel = getActiveLevel();
      const planPoint = getPlanPoint(activeLevel?.id ?? null);
      placementPreview =
        planPoint && activeLevel
          ? {
              tool: currentContext.tool,
              point: planPoint,
              levelId: activeLevel.id,
            }
          : null;
      renderDraft();
    } else if (placementPreview && (dragState || draft || (currentContext.tool !== "equipment" && currentContext.tool !== "sensor"))) {
      placementPreview = null;
      renderDraft();
    }
    const rect = canvas.getBoundingClientRect();
    const hoveredSelection = hoveredHit ? findSelection(hoveredHit) : null;
    callbacksRef.current.onHoverInfo?.(
      currentContext.showTooltip === false || !hoveredSelection
        ? null
        :
      hoveredSelection
        ? buildHoverInfo(
            hoveredSelection,
            event.clientX - rect.left,
            event.clientY - rect.top,
            currentModel,
            currentHeatmapState,
            hoveredEntry?.point ?? null
          )
        : null
    );
    const canMoveHoveredSelection =
      (currentContext.tool === "move" || currentContext.tool === "select") &&
      hoveredSelection &&
      currentSelection &&
      hoveredSelection.kind === currentSelection.kind &&
      hoveredSelection.id === currentSelection.id;
    canvas.style.cursor = canMoveHoveredSelection ? "grab" : hoveredObject ? "pointer" : draft ? "crosshair" : "default";
  };

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    clearPendingHoldDrag();
    if (suppressContextFinish) {
      suppressContextFinish = false;
      return;
    }
    if (!draft) {
      return;
    }
    finishDraft();
  };

  const handlePointerLeave = () => {
    clearPendingHoldDrag();
    setHoverState(hoveredObject, false);
    hoveredObject = null;
    if (dragState) {
      controls.enabled = true;
      dragState = null;
    }
    placementPreview = null;
    renderDraft();
    pointerDown = null;
    suppressContextFinish = false;
    canvas.style.cursor = "default";
    callbacksRef.current.onHoverInfo?.(null);
  };

  const handleDoubleClick = (event: MouseEvent) => {
    updatePointer(event);
    const intersects = raycaster.intersectObjects(scene.children, true);
    for (const hit of intersects) {
      const selection = findSelection(hit.object as MeshWithSelection);
      if (!selection) {
        continue;
      }
      focusSelection(camera, controls, currentModel, selection);
      callbacksRef.current.onSelect?.(selection);
      return;
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      clearPendingHoldDrag();
      cancelDraft();
      return;
    }
    if (event.key === "Enter" && draft) {
      finishDraft();
    }
  };

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerleave", handlePointerLeave);
  canvas.addEventListener("dblclick", handleDoubleClick);
  canvas.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("keydown", handleKeyDown);

  const clearGroup = (group: THREE.Group) => {
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      disposeSceneNode(child);
    }
  };

  const update = (
    model: BuildingModel,
    context: BuildSceneContext,
    options: BuildViewerOptions,
    selection: Selection | null,
    frame: ThermalTimelinePoint | null,
    transientFrame: TransientVisualizationFrame | null,
    thermalField: ThermalFieldModel | null,
    sectionHeight: number,
    sectionMode: BuildSectionMode,
    sectionOffset: number
  ) => {
    resize();
    currentModel = model;
    currentSelection = selection;
    currentTransientFrame = transientFrame;
    currentContext = context;
    log3DInit("update", {
      rooms: model.rooms.length,
      walls: model.walls.length,
      roofs: model.roofs?.length ?? 0,
      slabs: model.floorSlabs?.length ?? 0,
      pipes: model.pipes.length,
      ducts: model.ducts.length,
      equipment: model.equipment.length,
      sensors: model.sensors.length,
    });
    const renderGeometry = buildGeometryRenderModel(model);
    const levelMap = new Map(model.levels.map((level) => [level.id, level]));
    const clampHeight = Math.max(0.2, sectionHeight);
    const renderWalls = renderGeometry.walls.map((entry) => entry.wall);
    const joinData = currentContext.safeMode
      ? { extensions: new Map<string, WallJoinExtension>(), corners: [] as WallCornerPatchInput[] }
      : computeWallJoinData({ ...model, walls: renderWalls });
    const { extensions, corners } = joinData;
    currentHeatmapState = currentContext.safeMode
      ? null
      : buildHeatmapState(model, frame, renderGeometry, context.thermalBuildOptions, thermalField, heatmapCache);
    if (thermalField && currentHeatmapState) {
      heatmapCache = { field: thermalField, state: currentHeatmapState };
    } else if (!thermalField) {
      heatmapCache = null;
    }
    renderer.clippingPlanes =
      sectionMode === "vertical" ? [new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionOffset)] : [];
    syncInteractionPlane();

    if (draft && context.tool !== draft.tool) {
      cancelDraft();
    }
    if (context.tool !== "move" && context.tool !== "select") {
      clearPendingHoldDrag();
    }
    if (context.tool !== "equipment" && context.tool !== "sensor") {
      placementPreview = null;
    }
    renderDraft();

    if (options.showRooms) {
      clearGroup(roomGroup);
      renderGeometry.roomVolumes.forEach((room) => {
        const level = levelMap.get(room.levelId);
        const levelHeight = level?.height_m ?? 3;
        const levelElevation = level?.elevation_m ?? 0;
        const mesh = buildRoomMesh(
          room,
          levelElevation,
          levelHeight,
          clampHeight,
          selection,
          currentHeatmapState,
          currentContext.showVolumeTint ?? false
        );
        if (mesh) {
          roomGroup.add(mesh);
        }
      });
    } else {
      clearGroup(roomGroup);
    }

    if (!currentContext.safeMode && frame && ((currentContext.showHeatmap ?? true) || (currentContext.showContours ?? true))) {
      clearGroup(heatmapGroup);
      const overlays = buildHeatmapOverlay(model, currentHeatmapState, {
        showHeatmap: currentContext.showHeatmap ?? true,
        showContours: currentContext.showContours ?? true,
      });
      overlays.forEach((mesh) => heatmapGroup.add(mesh));
    } else {
      clearGroup(heatmapGroup);
    }

    if (options.showWalls) {
      clearGroup(wallGroup);
      renderGeometry.walls.forEach(({ wall, openings }) => {
        const mesh = buildWallMesh(
          wall,
          getLevelBaseElevation(levelMap, wall.levelId),
          selection,
          clampHeight,
          openings,
          extensions.get(wall.id),
          options.transparentWalls ?? false,
          options.presentationMode ?? "default",
          !currentContext.safeMode && currentContext.showWallSurfaces ? currentHeatmapState : null,
          currentContext.safeMode ? null : currentTransientFrame
        );
        if (mesh) {
          wallGroup.add(mesh);
        }
      });
    } else {
      clearGroup(wallGroup);
    }

    if (options.showWalls) {
      clearGroup(roofGroup);
      renderGeometry.roofs.forEach((roof) => {
        const mesh = buildRoofMesh(
          roof,
          selection,
          options.transparentWalls ?? false,
          options.presentationMode ?? "default",
          currentContext.safeMode ? null : currentTransientFrame
        );
        if (mesh) {
          roofGroup.add(mesh);
        }
      });
      clearGroup(slabGroup);
      renderGeometry.floorSlabs.forEach((slab) => {
        const mesh = buildFloorSlabMesh(
          slab,
          selection,
          options.transparentWalls ?? false,
          options.presentationMode ?? "default",
          currentContext.safeMode ? null : currentTransientFrame
        );
        if (mesh) {
          slabGroup.add(mesh);
        }
      });
    } else {
      clearGroup(roofGroup);
      clearGroup(slabGroup);
    }

    if (options.showWalls && (currentContext.debug?.showWallJoinDebug || currentContext.debug?.showWallDebugCorners)) {
      clearGroup(cornerGroup);
      corners.forEach((corner) => {
        const patch = buildCornerPatch(corner, clampHeight);
        if (patch) {
          cornerGroup.add(patch);
        }
      });
    } else {
      clearGroup(cornerGroup);
    }

    if (options.showOpenings) {
      clearGroup(openingGroup);
      model.doors.forEach((door) => {
        if (!door.anchor.wallId) {
          return;
        }
        const wall = renderGeometry.walls.find((entry) => entry.wall.id === door.anchor.wallId)?.wall;
        if (wall) {
          const mesh = buildOpeningMesh(door, wall, getLevelBaseElevation(levelMap, wall.levelId), selection, "door");
          if (mesh) {
            openingGroup.add(mesh);
          }
        }
      });
      model.windows.forEach((window) => {
        if (!window.anchor.wallId) {
          return;
        }
        const wall = renderGeometry.walls.find((entry) => entry.wall.id === window.anchor.wallId)?.wall;
        if (wall) {
          const mesh = buildOpeningMesh(window, wall, getLevelBaseElevation(levelMap, wall.levelId), selection, "window");
          if (mesh) {
            openingGroup.add(mesh);
          }
        }
      });
    } else {
      clearGroup(openingGroup);
    }

    if (options.showNetworks || options.showEquipment) {
      clearGroup(networkGroup);
      if (options.showNetworks) {
        model.pipes.forEach((pipe) => {
          const mesh = buildPipeMesh(pipe, getLevelBaseElevation(levelMap, pipe.levelId), selection);
          if (mesh) {
            networkGroup.add(mesh);
          }
        });
        model.ducts.forEach((duct) => {
          const mesh = buildDuctMesh(
            duct,
            getLevelBaseElevation(levelMap, duct.levelId),
            getLevelHeight(levelMap, duct.levelId, 3),
            selection
          );
          if (mesh) {
            networkGroup.add(mesh);
          }
        });
      }
      if (options.showEquipment) {
        model.equipment.forEach((item) => {
          const mesh = buildEquipmentMesh(
            item,
            getLevelBaseElevation(levelMap, item.levelId),
            getLevelHeight(levelMap, item.levelId, 3),
            selection,
            currentContext.useSimplifiedEquipment ?? false
          );
          if (mesh) {
            networkGroup.add(mesh);
          }
        });
        buildNetworkConnectionMeshes(model, levelMap).forEach((mesh) => networkGroup.add(mesh));
        model.sensors.forEach((sensor) => {
          const mesh = buildSensorMesh(
            sensor,
            getLevelBaseElevation(levelMap, sensor.levelId),
            getLevelHeight(levelMap, sensor.levelId, 3),
            selection
          );
          if (mesh) {
            networkGroup.add(mesh);
          }
        });
      }
    } else {
      clearGroup(networkGroup);
    }

    clearGroup(debugGroup);
    if (currentContext.debug) {
      buildDebugObjects(model, renderGeometry, levelMap, currentHeatmapState, currentContext.debug).forEach((object) =>
        debugGroup.add(object)
      );
    }

    const bounds = computeModelBounds(model, {
      activeLevelId: currentContext.activeLevelId,
      includeRooms: options.showRooms,
      includeWalls: options.showWalls || options.showOpenings,
      includeOpenings: options.showOpenings,
      includeNetworks: options.showNetworks,
      includeEquipment: options.showEquipment,
    });
    currentVisibleBounds = bounds;
    grid.position.set(bounds.centerX, bounds.minY, bounds.centerZ);
    if (!hasInitialFit && !currentContext.safeMode) {
      fitCameraToModel(camera, controls, currentVisibleBounds);
      hasInitialFit = true;
    } else {
      if (!currentContext.safeMode && previousLevelId !== currentContext.activeLevelId && currentContext.activeLevelId) {
        fitCameraToModel(camera, controls, currentVisibleBounds);
      }
      if (!currentContext.safeMode) {
        emitCameraState();
      }
    }
    previousLevelId = currentContext.activeLevelId;
  };

  const zoomToFit = () => {
    fitCameraToModel(camera, controls, currentVisibleBounds);
  };

  const resetView = () => {
    fitCameraToModel(camera, controls, currentVisibleBounds);
  };

  const setTopView = () => {
    setTopDownView(camera, controls, currentVisibleBounds, currentModel, currentSelection);
  };

  const focusCurrentSelection = () => {
    if (currentSelection) {
      focusSelection(camera, controls, currentModel, currentSelection);
      return;
    }
    fitCameraToModel(camera, controls, currentVisibleBounds);
  };

  emitCameraState();
  return { update, zoomToFit, resetView, setTopView, focusSelection: focusCurrentSelection, dispose };
}

function disposeSceneNode(object: THREE.Object3D) {
  object.traverse((entry) => {
    const mesh = entry as THREE.Mesh<unknown, THREE.Material | THREE.Material[]>;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
      return;
    }
    (mesh.material as THREE.Material | undefined)?.dispose?.();
  });
}

function setHoverState(object: MeshWithSelection | null, hovered: boolean) {
  if (!object) {
    return;
  }
  object.traverse((entry) => {
    const mesh = entry as THREE.Mesh<unknown, THREE.Material | THREE.Material[]>;
    if (!mesh.material) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const shaded = material as THREE.MeshStandardMaterial & { userData?: Record<string, unknown> };
      if (!shaded.userData) {
        shaded.userData = {};
      }
      if (hovered) {
        if (typeof shaded.userData.baseEmissiveIntensity !== "number") {
          shaded.userData.baseEmissiveIntensity = shaded.emissiveIntensity ?? 0;
        }
        if (typeof shaded.userData.baseOpacity !== "number") {
          shaded.userData.baseOpacity = shaded.opacity ?? 1;
        }
        shaded.emissiveIntensity = Number(shaded.userData.baseEmissiveIntensity) + 0.1;
        if (shaded.transparent) {
          shaded.opacity = Math.min(1, Number(shaded.userData.baseOpacity) + 0.08);
        }
      } else if (typeof shaded.userData.baseEmissiveIntensity === "number") {
        shaded.emissiveIntensity = shaded.userData.baseEmissiveIntensity;
        if (typeof shaded.userData.baseOpacity === "number") {
          shaded.opacity = shaded.userData.baseOpacity;
        }
      }
    });
  });
}

function applyPreviewStyle(object: THREE.Object3D) {
  object.traverse((entry) => {
    const mesh = entry as THREE.Mesh<unknown, THREE.Material | THREE.Material[]>;
    if (!mesh.material) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = Math.min(material.opacity ?? 1, 0.45);
      if ("depthWrite" in material) {
        material.depthWrite = false;
      }
    });
  });
}

function findSelectableObject(object: MeshWithSelection | null): MeshWithSelection | null {
  let current: MeshWithSelection | null = object;
  while (current) {
    if (current.userData?.selection) {
      return current;
    }
    current = current.parent as MeshWithSelection | null;
  }
  return null;
}

const buildRoomMesh = (
  room: RoomVolumeDescriptor,
  levelElevation: number,
  roomHeight: number,
  sectionHeight: number,
  selection: Selection | null,
  heatmapState: HeatmapState | null,
  showVolumeTint: boolean
): THREE.Mesh | null => {
  if (room.polygon.length < 3) {
    return null;
  }
  const visibleHeight = Math.max(0.05, Math.min(roomHeight, sectionHeight));
  if (visibleHeight < 0.05) {
    return null;
  }
  const shape = new THREE.Shape(room.polygon.map((point) => new THREE.Vector2(point.x, -point.y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: visibleHeight, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  const isSelected = selection?.kind === "room" && selection.id === room.roomId;
  const temp = heatmapState?.roomTemperatures[room.roomId] ?? null;
  const tintedColor =
    showVolumeTint && temp !== null ? new THREE.Color(temperatureToColor(temp, heatmapState?.minTemperatureC ?? 16, heatmapState?.maxTemperatureC ?? 26)).getHex() : 0xe2e8f0;
  const baseColor = isSelected ? 0x3b82f6 : tintedColor;
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    transparent: true,
    opacity: isSelected ? 0.2 : showVolumeTint && temp !== null ? 0.1 : temp === null ? 0.035 : 0.05,
    roughness: 0.28,
    metalness: 0.02,
    emissive: isSelected ? 0x1d4ed8 : 0x000000,
    emissiveIntensity: isSelected ? 0.16 : 0.01,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material) as MeshWithSelection;
  mesh.position.y = levelElevation;
  mesh.userData.selection = { kind: "room", id: room.roomId };
  decorateSolidMesh(mesh, isSelected ? 0xffffff : 0xe2e8f0, isSelected ? 0.24 : 0.1);
  return mesh;
};

const buildWallMesh = (
  wall: Wall,
  levelElevation: number,
  selection: Selection | null,
  sectionHeight: number,
  openings: OpeningCutDescriptor[],
  extension?: WallJoinExtension,
  transparent = false,
  presentationMode: BuildViewerOptions["presentationMode"] = "default",
  heatmapState?: HeatmapState | null,
  transientFrame?: TransientVisualizationFrame | null
): MeshWithSelection | null => {
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const visibleHeight = Math.max(0.2, Math.min(wall.height_m, sectionHeight));
  if (visibleHeight <= 0 || length <= MIN_WALL_SEGMENT) {
    return null;
  }
  const startExtend = Math.min(extension?.start ?? 0, Math.max(0, length / 2 - 0.05));
  const endExtend = Math.min(extension?.end ?? 0, Math.max(0, length / 2 - 0.05));
  const usableStart = -startExtend;
  const usableEnd = length + endExtend;
  if (usableEnd - usableStart <= MIN_WALL_SEGMENT) {
    return null;
  }
  const sortedOpenings = [...openings]
    .map((opening) => ({
      id: opening.id,
      type: opening.type,
      offset: opening.startOffsetM,
      width: opening.widthM,
      height: opening.heightM,
      sill: opening.sillM,
    }))
    .sort((a, b) => a.offset - b.offset);
  const dir = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
  const angle = Math.atan2(dir.y, dir.x);
  const isSelected = selection?.kind === "wall" && selection.id === wall.id;
  const wallSurface = heatmapState?.wallSurfaceTemperatures[wall.id] ?? null;
  const minTemperatureC = heatmapState?.minTemperatureC ?? 15;
  const maxTemperatureC = heatmapState?.maxTemperatureC ?? 30;
  const transientMatch = transientFrame?.sourceType === "wall" && transientFrame.sourceId === wall.id;
  const engineeringOverview = presentationMode === "engineering-overview";
  const transientColor = transientMatch
    ? new THREE.Color(
        temperatureToColor(
          transientFrame.innerSurfaceTemperature_C,
          transientFrame.minTemperature_C,
          transientFrame.maxTemperature_C
        )
      ).getHex()
    : null;
  const wallColor = transientColor ?? (isSelected ? 0x64748b : resolveWallBaseColor(angle, transparent));
  const localLength = usableEnd - usableStart;
  if (localLength <= MIN_WALL_SEGMENT) {
    return null;
  }
  const shape = buildWallProfileShape(localLength, visibleHeight, sortedOpenings, usableStart, usableEnd);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: wall.thickness_m, bevelEnabled: false });
  geometry.translate(0, 0, -wall.thickness_m / 2);
  const wallMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: wallColor,
      transparent,
      opacity: transparent ? (engineeringOverview ? 0.16 : 0.24) : engineeringOverview ? 0.84 : 0.98,
      roughness: transparent ? 0.82 : engineeringOverview ? 0.78 : 0.72,
      metalness: transparent ? 0.02 : 0.05,
      emissive: transientMatch ? 0xffffff : isSelected ? 0xfbbf24 : 0x0f172a,
      emissiveIntensity: transientMatch ? (transientFrame?.stable ? 0.16 : 0.24) : isSelected ? 0.18 : 0.025,
      depthWrite: !transparent,
    })
  );
  decorateSolidMesh(wallMesh, isSelected ? 0xfffbeb : 0x94a3b8, isSelected ? 0.44 : transparent ? 0.09 : 0.14);
  if (isSelected || transientMatch) {
    addSoftSelectionHalo(wallMesh, isSelected ? 0xfbbf24 : 0x60a5fa, isSelected ? 0.12 : 0.08, 1.016);
  }

  const group = new THREE.Group() as MeshWithSelection;
  group.userData.selection = { kind: "wall", id: wall.id };
  const startPoint = {
    x: wall.a.x - dir.x * startExtend,
    y: wall.a.y - dir.y * startExtend,
  };
  wallMesh.position.set(startPoint.x, levelElevation, startPoint.y);
  wallMesh.rotation.y = -angle;
  group.add(wallMesh);

  if (wallSurface !== null) {
    const overlays = buildWallTemperatureSurfaces(shape, wall.thickness_m, wallSurface, minTemperatureC, maxTemperatureC);
    overlays.forEach((overlay) => {
      overlay.position.set(startPoint.x, levelElevation, startPoint.y);
      overlay.rotation.y = -angle;
      group.add(overlay);
    });
  }

  return group;
};

const buildRoofMesh = (
  roof: Roof,
  selection: Selection | null,
  transparent = false,
  presentationMode: BuildViewerOptions["presentationMode"] = "default",
  transientFrame?: TransientVisualizationFrame | null
): MeshWithSelection | null => {
  if (roof.boundary.length < 3) {
    return null;
  }
  const isSelected = selection?.kind === "roof" && selection.id === roof.id;
  const transientMatch = transientFrame?.sourceType === "roof" && transientFrame.sourceId === roof.id;
  const transientColor = transientMatch
    ? new THREE.Color(
        temperatureToColor(
          transientFrame.innerSurfaceTemperature_C,
          transientFrame.minTemperature_C,
          transientFrame.maxTemperature_C
        )
      ).getHex()
    : null;
  const color = roof.kind === "pitched" ? 0x9a6230 : 0xb88746;
  const engineeringOverview = presentationMode === "engineering-overview";
  const mesh = buildPolygonPrismMesh(
    roof.boundary,
    (point) => {
      const base = roof.elevationBase_m;
      if (roof.kind !== "pitched" || !roof.slope) {
        return { bottom: base, top: base + roof.thickness_m };
      }
      const directionRad = THREE.MathUtils.degToRad(roof.slope.directionDeg);
      const alongSlope = point.x * Math.cos(directionRad) + point.y * Math.sin(directionRad);
      const rise = alongSlope * roof.slope.risePerMeter;
      return {
        bottom: base + rise,
        top: base + rise + roof.thickness_m,
      };
    },
    {
      color: transientColor ?? (isSelected ? 0xf59e0b : color),
      selection: { kind: "roof", id: roof.id },
      transparent,
      opacity: transparent ? (engineeringOverview ? 0.22 : 0.34) : engineeringOverview ? 0.82 : 0.94,
      emissiveIntensity: transientMatch ? (transientFrame?.stable ? 0.16 : 0.24) : isSelected ? 0.14 : 0.04,
    }
  );
  if (mesh && (isSelected || transientMatch)) {
    addSoftSelectionHalo(mesh, isSelected ? 0xfbbf24 : 0x60a5fa, isSelected ? 0.14 : 0.08, 1.018);
  }
  return mesh;
};

const buildFloorSlabMesh = (
  slab: FloorSlab,
  selection: Selection | null,
  transparent = false,
  presentationMode: BuildViewerOptions["presentationMode"] = "default",
  transientFrame?: TransientVisualizationFrame | null
): MeshWithSelection | null => {
  if (slab.boundary.length < 3) {
    return null;
  }
  const isSelected = selection?.kind === "slab" && selection.id === slab.id;
  const transientMatch = transientFrame?.sourceType === "slab" && transientFrame.sourceId === slab.id;
  const transientColor = transientMatch
    ? new THREE.Color(
        temperatureToColor(
          transientFrame.innerSurfaceTemperature_C,
          transientFrame.minTemperature_C,
          transientFrame.maxTemperature_C
        )
      ).getHex()
    : null;
  const engineeringOverview = presentationMode === "engineering-overview";
  const mesh = buildPolygonPrismMesh(
    slab.boundary,
    () => ({
      bottom: slab.elevation_m - slab.thickness_m,
      top: slab.elevation_m,
    }),
    {
      color: transientColor ?? (isSelected ? 0x38bdf8 : slab.kind === "ground" ? 0x64748b : 0xb6c2cf),
      selection: { kind: "slab", id: slab.id },
      transparent,
      opacity: transparent ? (engineeringOverview ? 0.18 : 0.26) : engineeringOverview ? 0.8 : 0.92,
      emissiveIntensity: transientMatch ? (transientFrame?.stable ? 0.16 : 0.24) : isSelected ? 0.12 : 0.04,
    }
  );
  if (mesh && (isSelected || transientMatch)) {
    addSoftSelectionHalo(mesh, isSelected ? 0x7dd3fc : 0x60a5fa, isSelected ? 0.12 : 0.08, 1.016);
  }
  return mesh;
};

function buildPolygonPrismMesh(
  boundary: Vec2[],
  heightResolver: (point: Vec2) => { bottom: number; top: number },
  options: {
    color: number;
    selection: Selection;
    transparent: boolean;
    opacity: number;
    emissiveIntensity?: number;
  }
): MeshWithSelection | null {
  const contour = boundary.map((point) => new THREE.Vector2(point.x, point.y));
  const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
  if (!triangles.length) {
    return null;
  }

  const bottomVertices = boundary.map((point) => {
    const heights = heightResolver(point);
    return new THREE.Vector3(point.x, heights.bottom, point.y);
  });
  const topVertices = boundary.map((point) => {
    const heights = heightResolver(point);
    return new THREE.Vector3(point.x, heights.top, point.y);
  });

  const positions: number[] = [];
  const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  triangles.forEach(([a, b, c]) => {
    pushTriangle(topVertices[a], topVertices[b], topVertices[c]);
    pushTriangle(bottomVertices[c], bottomVertices[b], bottomVertices[a]);
  });

  for (let index = 0; index < boundary.length; index += 1) {
    const nextIndex = (index + 1) % boundary.length;
    const bottomA = bottomVertices[index];
    const bottomB = bottomVertices[nextIndex];
    const topA = topVertices[index];
    const topB = topVertices[nextIndex];
    pushTriangle(bottomA, bottomB, topB);
    pushTriangle(bottomA, topB, topA);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: options.color,
    transparent: options.transparent,
    opacity: options.opacity,
    roughness: 0.76,
    metalness: 0.04,
    emissive: 0xffffff,
    emissiveIntensity: options.emissiveIntensity ?? 0.04,
    side: THREE.DoubleSide,
    depthWrite: !options.transparent,
  });
  const mesh = new THREE.Mesh(geometry, material) as MeshWithSelection;
  mesh.userData.selection = options.selection;
  decorateSolidMesh(mesh, 0xf8fafc, 0.16);
  return mesh;
}

const buildOpeningMesh = (
  opening: Door | Window,
  wall: Wall,
  levelElevation: number,
  selection: Selection | null,
  kind: "door" | "window"
): MeshWithSelection | null => {
  const attachment = attachOpeningToWall(opening, wall);
  if (!attachment) {
    return null;
  }
  const group = new THREE.Group() as MeshWithSelection;
  const isSelected = selection?.id === opening.id && selection.kind === kind;
  group.userData.selection = { kind, id: opening.id };
  group.position.set(attachment.center.x, levelElevation, attachment.center.y);
  group.rotation.y = -attachment.angle;

  if (kind === "door") {
    const depth = Math.max(0.08, wall.thickness_m * 0.94);
    const jambWidth = 0.06;
    const topHeight = 0.08;
    const jambMaterial = new THREE.MeshStandardMaterial({
      color: isSelected ? 0xfbbf24 : 0xd7dde5,
      metalness: 0.08,
      roughness: 0.58,
    });
    const leftJamb = new THREE.Mesh(
      new THREE.BoxGeometry(jambWidth, opening.height_m + topHeight, depth),
      jambMaterial.clone()
    );
    leftJamb.position.set(-opening.width_m / 2 + jambWidth / 2, (opening.height_m + topHeight) / 2, 0);
    decorateSolidMesh(leftJamb, 0xffffff, 0.22);
    const rightJamb = new THREE.Mesh(
      new THREE.BoxGeometry(jambWidth, opening.height_m + topHeight, depth),
      jambMaterial.clone()
    );
    rightJamb.position.set(opening.width_m / 2 - jambWidth / 2, (opening.height_m + topHeight) / 2, 0);
    decorateSolidMesh(rightJamb, 0xffffff, 0.22);
    const topJamb = new THREE.Mesh(
      new THREE.BoxGeometry(opening.width_m, topHeight, depth),
      jambMaterial.clone()
    );
    topJamb.position.set(0, opening.height_m + topHeight / 2, 0);
    decorateSolidMesh(topJamb, 0xffffff, 0.22);

    const panelDepth = Math.max(0.04, depth * 0.14);
    const leafGeometry = new THREE.BoxGeometry(
      Math.max(0.12, opening.width_m - jambWidth * 2),
      Math.max(0.12, opening.height_m - 0.08),
      panelDepth
    );
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: isSelected ? 0xf59e0b : 0x8b6a4e,
      metalness: 0.06,
      roughness: 0.62,
    });
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.set(
      -opening.width_m * 0.08,
      opening.height_m / 2,
      depth / 2 - panelDepth / 2 - 0.01
    );
    leaf.rotation.y = THREE.MathUtils.degToRad(-12);
    decorateSolidMesh(leaf, 0xf8fafc, 0.16);

    group.add(leftJamb, rightJamb, topJamb, leaf);
  } else {
    const sill = (opening as Window).sill_m ?? 0.9;
    const depth = Math.max(0.08, wall.thickness_m * 0.92);
    const jambWidth = 0.055;
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: isSelected ? 0x7dd3fc : 0xe3e8ef,
      metalness: 0.1,
      roughness: 0.48,
    });
    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(jambWidth, opening.height_m, depth),
      frameMaterial.clone()
    );
    leftFrame.position.set(-opening.width_m / 2 + jambWidth / 2, sill + opening.height_m / 2, 0);
    decorateSolidMesh(leftFrame, 0xffffff, 0.2);
    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(jambWidth, opening.height_m, depth),
      frameMaterial.clone()
    );
    rightFrame.position.set(opening.width_m / 2 - jambWidth / 2, sill + opening.height_m / 2, 0);
    decorateSolidMesh(rightFrame, 0xffffff, 0.2);
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(opening.width_m, jambWidth, depth),
      frameMaterial.clone()
    );
    topFrame.position.set(0, sill + opening.height_m - jambWidth / 2, 0);
    decorateSolidMesh(topFrame, 0xffffff, 0.2);
    const bottomFrame = new THREE.Mesh(
      new THREE.BoxGeometry(opening.width_m, jambWidth, depth),
      frameMaterial.clone()
    );
    bottomFrame.position.set(0, sill + jambWidth / 2, 0);
    decorateSolidMesh(bottomFrame, 0xffffff, 0.2);

    const glassGeometry = new THREE.BoxGeometry(
      Math.max(0.08, opening.width_m - jambWidth * 2.8),
      Math.max(0.08, opening.height_m - jambWidth * 2.8),
      Math.max(0.03, depth * 0.08)
    );
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8efff,
      transparent: true,
      opacity: 0.22,
      emissive: isSelected ? 0x7dd3fc : 0x38bdf8,
      emissiveIntensity: isSelected ? 0.12 : 0.05,
      roughness: 0.06,
      metalness: 0.12,
      depthWrite: false,
    });
    const glass = new THREE.Mesh(glassGeometry, glassMaterial);
    glass.position.y = sill + opening.height_m / 2;
    decorateSolidMesh(glass, 0xe0f2fe, 0.14);

    const sillGeometry = new THREE.BoxGeometry(opening.width_m + 0.2, 0.06, wall.thickness_m * 0.4);
    const sillMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.7,
      metalness: 0.1,
    });
    const sillBlock = new THREE.Mesh(sillGeometry, sillMaterial);
    sillBlock.position.y = sill;
    decorateSolidMesh(sillBlock, 0xffffff, 0.18);

    group.add(leftFrame, rightFrame, topFrame, bottomFrame, glass, sillBlock);
  }

  if (isSelected) {
    group.traverse((entry) => {
      const mesh = entry as THREE.Mesh;
      if (mesh.geometry && mesh.material) {
        addSoftSelectionHalo(mesh, kind === "window" ? 0x7dd3fc : 0xfbbf24, 0.1, 1.028);
      }
    });
  }
  return group;
};

function resolveWallBaseColor(angle: number, transparent: boolean) {
  const neutralPalette = transparent
    ? [0xd8e1ea, 0xdfe6ee, 0xd3dce6]
    : [0xe2e8ef, 0xd9e1e9, 0xd2dbe5];
  const normalized = Math.abs(Math.sin(angle));
  if (normalized > 0.66) {
    return neutralPalette[0];
  }
  if (normalized > 0.33) {
    return neutralPalette[1];
  }
  return neutralPalette[2];
}

const buildCornerPatch = (corner: WallCornerPatchInput, sectionHeight: number): MeshWithSelection | null => {
  const height = Math.min(sectionHeight, corner.maxHeight);
  if (height <= 0.05) {
    return null;
  }
  // Скруглённый стык — криволинейная плита (кольцевой сектор), а не квадратная заплатка.
  if (corner.rounded) {
    const rounded = corner.rounded;
    const half = corner.thickness / 2;
    const outerRadius = rounded.radius + half;
    const innerRadius = Math.max(0.001, rounded.radius - half);
    const segments = Math.max(4, Math.ceil((rounded.turnAngle / Math.PI) * 24));
    const outer = arcPolyline(rounded.center, outerRadius, rounded.startAngle, rounded.signedSweep, segments);
    const inner = arcPolyline(rounded.center, innerRadius, rounded.startAngle, rounded.signedSweep, segments).reverse();
    const shape = new THREE.Shape();
    [...outer, ...inner].forEach((point, index) => {
      // План (x, y) → footprint Shape; ось Y инвертируется, т.к. ниже rotateX(-90°)
      // переводит план-Y в мировой Z.
      const sx = point.x - rounded.center.x;
      const sy = -(point.y - rounded.center.y);
      if (index === 0) {
        shape.moveTo(sx, sy);
      } else {
        shape.lineTo(sx, sy);
      }
    });
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0xb3becb,
      metalness: 0.06,
      roughness: 0.72,
    });
    const mesh = new THREE.Mesh(geometry, material) as MeshWithSelection;
    mesh.position.set(rounded.center.x, corner.levelElevation, rounded.center.y);
    return mesh;
  }
  const diagLength = Math.sqrt(corner.trimA * corner.trimA + corner.trimB * corner.trimB);
  if (diagLength <= MIN_WALL_SEGMENT) {
    return null;
  }
  const geometry = new THREE.BoxGeometry(diagLength, height, corner.thickness);
  const material = new THREE.MeshStandardMaterial({
    color: 0xb3becb,
    metalness: 0.06,
    roughness: 0.72,
  });
  const mesh = new THREE.Mesh(geometry, material) as MeshWithSelection;
  const bisector = normalize({ x: corner.dirA.x + corner.dirB.x, y: corner.dirA.y + corner.dirB.y });
  if (!bisector.x && !bisector.y) {
    return null;
  }
  const offset = {
    x: (corner.dirA.x * corner.trimA + corner.dirB.x * corner.trimB) / 2,
    y: (corner.dirA.y * corner.trimA + corner.dirB.y * corner.trimB) / 2,
  };
  mesh.position.set(corner.point.x + offset.x, corner.levelElevation + height / 2, corner.point.y + offset.y);
  mesh.rotation.y = -Math.atan2(bisector.y, bisector.x);
  return mesh;
};

const buildPipeMesh = (pipe: PipeNetwork, levelElevation: number, selection: Selection | null): MeshWithSelection | null => {
  if (pipe.path.length < 2) {
    return null;
  }
  const selected = selection?.kind === "pipe" && selection.id === pipe.id;
  const group = new THREE.Group() as MeshWithSelection;
  group.userData.selection = { kind: "pipe", id: pipe.id };
  const style = getPipeVisualStyle(pipe, { selected });
  const radius = clamp(style.radius_m, 0.028, 0.072);
  const color = new THREE.Color(style.stroke).getHex();
  const displayPath = normalizeFlowDirection(pipe.flowDirection) === "backward" ? [...pipe.path].reverse() : pipe.path;
  displayPath.slice(1).forEach((point, index) => {
    const start = displayPath[index];
    const end = point;
    const sleeve = buildCylinderBetween(start, end, radius * 1.22, 0xf8fafc);
    if (sleeve) {
      sleeve.position.y = levelElevation + 0.24;
      const sleeveMaterial = sleeve.material as THREE.MeshStandardMaterial;
      sleeveMaterial.transparent = true;
      sleeveMaterial.opacity = selected ? 0.3 : 0.18;
      sleeveMaterial.roughness = 0.74;
      sleeveMaterial.metalness = 0.02;
      sleeveMaterial.depthWrite = false;
      group.add(sleeve);
    }
    const segment = buildCylinderBetween(start, end, radius, selected ? 0xfacc15 : color);
    if (segment) {
      segment.position.y = levelElevation + 0.24;
      const material = segment.material as THREE.MeshStandardMaterial;
      material.transparent = true;
      material.opacity = selected ? 0.96 : 0.8;
      material.roughness = 0.4;
      material.metalness = 0.16;
      material.emissive = new THREE.Color(selected ? 0xfbbf24 : color);
      material.emissiveIntensity = selected ? 0.18 : 0.04;
      material.depthWrite = false;
      decorateSolidMesh(segment, selected ? 0xfffbeb : 0xe2e8f0, selected ? 0.16 : 0.06);
      if (selected) {
        addSoftSelectionHalo(segment, 0xfbbf24, 0.14, 1.12);
      }
      group.add(segment);
    }
  });
  displayPath.forEach((point) => {
    const joint = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(radius * 1.16, 0.035), 14, 14),
      new THREE.MeshStandardMaterial({
        color: selected ? 0xfbbf24 : color,
        roughness: 0.28,
        metalness: 0.18,
        transparent: true,
        opacity: selected ? 0.98 : 0.82,
        emissive: new THREE.Color(selected ? 0xfbbf24 : color),
        emissiveIntensity: selected ? 0.15 : 0.04,
        depthWrite: false,
      })
    );
    joint.position.set(point.x, levelElevation + 0.24, point.y);
    group.add(joint);
  });
  return group.children.length ? group : null;
};

const buildDuctMesh = (
  duct: DuctNetwork,
  levelElevation: number,
  levelHeight: number,
  selection: Selection | null
): MeshWithSelection | null => {
  if (duct.path.length < 2) {
    return null;
  }
  const group = new THREE.Group() as MeshWithSelection;
  group.userData.selection = { kind: "duct", id: duct.id };
  const width = Math.max(0.12, (duct.section.width_mm ?? duct.section.diameter_mm ?? 300) / 1000);
  const height = Math.max(0.08, (duct.section.height_mm ?? duct.section.diameter_mm ?? 220) / 1000);
  duct.path.slice(1).forEach((point, index) => {
    const start = duct.path[index];
    const end = point;
    const segment = buildBoxBetween(
      start,
      end,
      width,
      height,
      selection?.kind === "duct" && selection.id === duct.id ? 0xfacc15 : 0x64748b
    );
    if (segment) {
      segment.position.y = levelElevation + Math.max(2.18, levelHeight - 0.48);
      const material = segment.material as THREE.MeshStandardMaterial;
      material.transparent = true;
      material.opacity = selection?.kind === "duct" && selection.id === duct.id ? 0.9 : 0.6;
      material.color.setHex(selection?.kind === "duct" && selection.id === duct.id ? 0xfacc15 : 0x7b8a9a);
      material.roughness = 0.52;
      material.metalness = 0.1;
      material.depthWrite = false;
      decorateSolidMesh(segment, 0xf8fafc, 0.08);
      if (selection?.kind === "duct" && selection.id === duct.id) {
        addSoftSelectionHalo(segment, 0xfbbf24, 0.12, 1.05);
      }
      group.add(segment);
    }
  });
  return group.children.length ? group : null;
};

const buildEquipmentMesh = (
  item: Equipment,
  levelElevation: number,
  levelHeight: number,
  selection: Selection | null,
  simplified = false
): MeshWithSelection => {
  const selected = selection?.kind === "equipment" && selection.id === item.id;
  const group = new THREE.Group() as MeshWithSelection;
  group.userData.selection = { kind: "equipment", id: item.id };
  group.position.set(item.position.x, levelElevation, item.position.y);
  const visual = createEquipmentVisual(item, { selected, levelHeight, simplified });
  visual.traverse((entry) => {
    const mesh = entry as THREE.Mesh;
    if (mesh.geometry && mesh.material) {
      decorateSolidMesh(mesh, 0xffffff, mesh.position.y > 1.6 ? 0.08 : 0.12);
    }
  });
  group.add(visual);
  if (selected) {
    group.traverse((entry) => {
      const mesh = entry as THREE.Mesh;
      if (mesh.geometry && mesh.material) {
        addSoftSelectionHalo(mesh, item.type === "diffuser" ? 0x7dd3fc : 0xfbbf24, 0.1, 1.04);
      }
    });
  }
  return group;
};

const buildSensorMesh = (
  sensor: SensorDevice,
  levelElevation: number,
  levelHeight: number,
  selection: Selection | null
): MeshWithSelection => {
  const selected = selection?.kind === "sensor" && selection.id === sensor.id;
  const group = new THREE.Group() as MeshWithSelection;
  group.userData.selection = { kind: "sensor", id: sensor.id };
  group.position.copy(getSensorWorldPosition(sensor, levelElevation, levelHeight));
  const visual = createSensorVisual(sensor, { selected, levelHeight });
  visual.traverse((entry) => {
    const mesh = entry as THREE.Mesh;
    if (mesh.geometry && mesh.material) {
      decorateSolidMesh(mesh, 0xffffff, 0.14);
    }
  });
  group.add(visual);
  if (selected) {
    visual.traverse((entry) => {
      const mesh = entry as THREE.Mesh;
      if (mesh.geometry && mesh.material) {
        addSoftSelectionHalo(mesh, 0x7dd3fc, 0.12, 1.12);
      }
    });
  }
  return group;
};

function buildNetworkConnectionMeshes(
  model: BuildingModel,
  levelMap: Map<string, BuildingModel["levels"][number]>
): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];
  const equipmentById = new Map(model.equipment.map((item) => [item.id, item]));

  model.pipes.forEach((pipe) => {
    const levelElevation = getLevelBaseElevation(levelMap, pipe.levelId);
    pipe.connectedEquipmentIds.forEach((equipmentId) => {
      const equipment = equipmentById.get(equipmentId);
      if (!equipment || equipment.levelId !== pipe.levelId) {
        return;
      }
      const anchor = closestPointOnPolyline(equipment.position, pipe.path);
      if (!anchor) {
        return;
      }
      const equipmentAnchor = getEquipmentWorldConnectionPoint(equipment, "pipe", levelElevation, getLevelHeight(levelMap, pipe.levelId, 3), anchor);
      const points = [
        equipmentAnchor,
        new THREE.Vector3(anchor.x, levelElevation + 0.24, anchor.y),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: new THREE.Color(resolvePipeColor(pipe)).getHex(), transparent: true, opacity: 0.28, depthWrite: false })
      );
      objects.push(line);
    });
  });

  model.ducts.forEach((duct) => {
    const levelElevation = getLevelBaseElevation(levelMap, duct.levelId);
    const levelHeight = getLevelHeight(levelMap, duct.levelId, 3);
    duct.connectedEquipmentIds.forEach((equipmentId) => {
      const equipment = equipmentById.get(equipmentId);
      if (!equipment || equipment.levelId !== duct.levelId) {
        return;
      }
      const anchor = closestPointOnPolyline(equipment.position, duct.path);
      if (!anchor) {
        return;
      }
      const equipmentAnchor = getEquipmentWorldConnectionPoint(equipment, "duct", levelElevation, levelHeight, anchor);
      const points = [
        equipmentAnchor,
        new THREE.Vector3(anchor.x, levelElevation + Math.max(2.2, levelHeight - 0.35), anchor.y),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        geometry,
        new THREE.LineDashedMaterial({ color: 0x7b8a9a, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.24, depthWrite: false })
      );
      line.computeLineDistances();
      objects.push(line);
    });
  });

  return objects;
}

function buildWallProfileShape(
  localLength: number,
  visibleHeight: number,
  openings: Array<{
    type: "door" | "window";
    offset: number;
    width: number;
    height: number;
    sill?: number;
  }>,
  usableStart: number,
  usableEnd: number
): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(localLength, 0);
  shape.lineTo(localLength, visibleHeight);
  shape.lineTo(0, visibleHeight);
  shape.closePath();

  openings.forEach((opening) => {
    const openingStart = clamp(opening.offset, usableStart, usableEnd);
    const openingEnd = clamp(opening.offset + opening.width, usableStart, usableEnd);
    const openingBottom =
      opening.type === "window" ? clamp(opening.sill ?? 0, 0, visibleHeight - 0.05) : 0;
    const openingTop = clamp(openingBottom + opening.height, 0.05, visibleHeight - 0.02);
    if (openingEnd - openingStart <= MIN_WALL_SEGMENT || openingTop - openingBottom <= 0.05) {
      return;
    }
    const hole = new THREE.Path();
    const localStart = openingStart - usableStart;
    const localEnd = openingEnd - usableStart;
    hole.moveTo(localStart, openingBottom);
    hole.lineTo(localEnd, openingBottom);
    hole.lineTo(localEnd, openingTop);
    hole.lineTo(localStart, openingTop);
    hole.closePath();
    shape.holes.push(hole);
  });

  return shape;
}

const attachOpeningToWall = (opening: Door | Window, wall: Wall): OpeningAttachment | null => {
  const wallLength = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  if (wallLength <= MIN_WALL_SEGMENT) {
    return null;
  }
  const direction = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
  const rawStart = anchorToOffset(opening.anchor, wall);
  const startOffset = clamp(rawStart, 0, Math.max(0, wallLength - opening.width_m));
  const center = resolveWallPoint(wall, startOffset + opening.width_m / 2);
  return {
    startOffset,
    center,
    direction,
    angle: Math.atan2(direction.y, direction.x),
    wallLength,
  };
};

function buildWallSurfaceProfile(
  field: ThermalFieldModel,
  wall: Wall,
  openings: OpeningCutDescriptor[],
  surfaceTemperatures: Omit<HeatmapState["wallSurfaceTemperatures"][string], "profile">
): WallSurfaceTemperatureProfilePoint[] {
  const boundary = field.boundaryByWallId.get(wall.id);
  const length = wallLength(wall);
  if (!boundary || length <= MIN_WALL_SEGMENT) {
    return [
      {
        offsetRatio: 0.5,
        positiveSideC: surfaceTemperatures.positiveSideC,
        negativeSideC: surfaceTemperatures.negativeSideC,
      },
    ];
  }

  const direction = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
  const normal = { x: -direction.y, y: direction.x };
  const offsetDistance = clamp(Math.max(0.08, wall.thickness_m * 0.65), 0.08, 0.26);
  const positiveRoom = boundary.positiveRoomId ? field.roomMap.get(boundary.positiveRoomId) ?? null : null;
  const negativeRoom = boundary.negativeRoomId ? field.roomMap.get(boundary.negativeRoomId) ?? null : null;
  const midpoint = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const midpointPositive = { x: midpoint.x + normal.x * offsetDistance, y: midpoint.y + normal.y * offsetDistance };
  const midpointNegative = { x: midpoint.x - normal.x * offsetDistance, y: midpoint.y - normal.y * offsetDistance };
  const positiveSign = positiveRoom
    ? polygonContainsPoint(midpointPositive, positiveRoom.polygon)
      ? 1
      : polygonContainsPoint(midpointNegative, positiveRoom.polygon)
        ? -1
        : 1
    : negativeRoom
      ? polygonContainsPoint(midpointPositive, negativeRoom.polygon)
        ? -1
        : 1
      : 1;
  const sampleCount = Math.max(5, Math.min(9, 5 + openings.length * 2));
  const openingSpread = Math.max(0.06, 0.22 / Math.max(sampleCount, 5));
  const bridgeFactor = clamp(boundary.bridgeFactor * 0.22, 0.05, 0.9);

  return Array.from({ length: sampleCount }, (_, index) => {
    const offsetRatio = sampleCount === 1 ? 0.5 : index / (sampleCount - 1);
    const edgeFactor = Math.pow(Math.abs(offsetRatio - 0.5) / 0.5, 1.45);
    const basePoint = {
      x: wall.a.x + direction.x * length * offsetRatio,
      y: wall.a.y + direction.y * length * offsetRatio,
    };
    const sampleRoomSurface = (
      roomId: string | null,
      sign: number,
      averageSurfaceC: number,
      fallbackTemperatureC: number
    ) => {
      if (!roomId) {
        return fallbackTemperatureC;
      }
      const room = field.roomMap.get(roomId);
      if (!room) {
        return fallbackTemperatureC;
      }
      const candidateA = {
        x: basePoint.x + normal.x * sign * offsetDistance,
        y: basePoint.y + normal.y * sign * offsetDistance,
      };
      const candidateB = {
        x: basePoint.x - normal.x * sign * offsetDistance,
        y: basePoint.y - normal.y * sign * offsetDistance,
      };
      const resolvedPoint = polygonContainsPoint(candidateA, room.polygon)
        ? candidateA
        : polygonContainsPoint(candidateB, room.polygon)
          ? candidateB
          : candidateA;
      const sampledAirC = sampleSmoothedThermalFieldAtPoint(field, wall.levelId, resolvedPoint, 0.06);
      const localSourceBoostC = (field.sourcesByLevel.get(wall.levelId) ?? []).reduce((sum, source) => {
        if (source.roomId !== roomId) {
          return sum;
        }
        const distanceToSource = Math.hypot(source.position.x - basePoint.x, source.position.y - basePoint.y);
        const sourceFactor =
          source.kind === "radiator" ? 0.36 : source.kind === "pipe" ? 0.16 : source.kind === "equipment" ? 0.12 : 0.06;
        const proximity = Math.exp(-(distanceToSource * distanceToSource) / Math.max(0.2, source.spreadM * source.spreadM * 0.8));
        return sum + source.amplitudeC * sourceFactor * proximity;
      }, 0);
      return sampledAirC + (averageSurfaceC - room.baseTemperatureC) + clamp(localSourceBoostC, 0, 2.8);
    };
    const openingModifier = openings.reduce(
      (sum, opening) => {
        const openingCenterRatio = clamp((opening.startOffsetM + opening.widthM / 2) / length, 0, 1);
        const widthFactor = clamp(opening.widthM / Math.max(0.6, length), 0.08, 0.42);
        const distanceRatio = Math.abs(offsetRatio - openingCenterRatio);
        const influence = Math.exp(-((distanceRatio * distanceRatio) / openingSpread));
        const openingPenalty = opening.type === "door" ? 0.55 : 0.34;
        const solarBoost = opening.type === "window" ? boundary.solarGainC * 0.18 : 0;
        return sum + influence * widthFactor * (solarBoost - openingPenalty);
      },
      0
    );
    const bridgePenalty = bridgeFactor * edgeFactor;
    const positiveBase = sampleRoomSurface(
      boundary.positiveRoomId,
      positiveSign,
      surfaceTemperatures.positiveSideC,
      surfaceTemperatures.positiveSideC
    );
    const negativeBase = sampleRoomSurface(
      boundary.negativeRoomId,
      -positiveSign,
      surfaceTemperatures.negativeSideC,
      surfaceTemperatures.negativeSideC
    );
    const positiveSideC = clamp(
      positiveBase + openingModifier - bridgePenalty,
      field.minTemperatureC - 1,
      field.maxTemperatureC + 1
    );
    const negativeSideC = clamp(
      negativeBase + openingModifier * 0.72 - bridgePenalty * 0.55,
      field.minTemperatureC - 1,
      field.maxTemperatureC + 1
    );

    return {
      offsetRatio,
      positiveSideC,
      negativeSideC,
    };
  });
}

function buildWallTemperatureSurfaces(
  shape: THREE.Shape,
  thickness: number,
  surfaceTemperatures: HeatmapState["wallSurfaceTemperatures"][string],
  minTemperatureC: number,
  maxTemperatureC: number
): THREE.Mesh[] {
  const overlayDepth = Math.max(0.0015, Math.min(0.003, thickness * 0.01));
  const surfaces: Array<{
    fallbackTemperatureC: number;
    translateZ: number;
    profile: Array<{ offsetRatio: number; temperatureC: number }>;
  }> = [
    {
      fallbackTemperatureC: surfaceTemperatures.negativeSideC,
      translateZ: -thickness / 2 - overlayDepth,
      profile: surfaceTemperatures.profile.map((point) => ({
        offsetRatio: point.offsetRatio,
        temperatureC: point.negativeSideC,
      })),
    },
    {
      fallbackTemperatureC: surfaceTemperatures.positiveSideC,
      translateZ: thickness / 2,
      profile: surfaceTemperatures.profile.map((point) => ({
        offsetRatio: point.offsetRatio,
        temperatureC: point.positiveSideC,
      })),
    },
  ];

  return surfaces.map(({ fallbackTemperatureC, translateZ, profile }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- three ExtrudeGeometry typings omit BufferGeometry helpers used below
    const geometry: any = new THREE.ExtrudeGeometry(shape, { depth: overlayDepth, bevelEnabled: false });
    geometry.translate(0, 0, translateZ);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    const minX = bounds?.min.x ?? 0;
    const spanX = Math.max(0.001, (bounds?.max.x ?? 1) - minX);
    const position = geometry.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const ratio = clamp((x - minX) / spanX, 0, 1);
      const temperatureC = interpolateWallProfileTemperature(profile, ratio, fallbackTemperatureC);
      const tint = new THREE.Color(temperatureToColor(temperatureC, minTemperatureC, maxTemperatureC));
      colors[index * 3] = tint.r;
      colors[index * 3 + 1] = tint.g;
      colors[index * 3 + 2] = tint.b;
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.84,
      roughness: 0.12,
      metalness: 0.02,
      emissive: 0xffffff,
      emissiveIntensity: 0.05,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 6;
    return mesh;
  });
}

function interpolateWallProfileTemperature(
  profile: Array<{ offsetRatio: number; temperatureC: number }>,
  offsetRatio: number,
  fallbackTemperatureC: number
): number {
  if (!profile.length) {
    return fallbackTemperatureC;
  }
  if (profile.length === 1 || offsetRatio <= profile[0].offsetRatio) {
    return profile[0]?.temperatureC ?? fallbackTemperatureC;
  }
  for (let index = 1; index < profile.length; index += 1) {
    const previous = profile[index - 1];
    const current = profile[index];
    if (offsetRatio <= current.offsetRatio) {
      const span = Math.max(1e-4, current.offsetRatio - previous.offsetRatio);
      const mix = clamp((offsetRatio - previous.offsetRatio) / span, 0, 1);
      return previous.temperatureC + (current.temperatureC - previous.temperatureC) * mix;
    }
  }
  return profile[profile.length - 1]?.temperatureC ?? fallbackTemperatureC;
}

const decorateSolidMesh = (mesh: THREE.Mesh, edgeColor: number, edgeOpacity: number) => {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: edgeOpacity,
      depthWrite: false,
    })
  );
  edgeLines.renderOrder = 3;
  mesh.add(edgeLines);
};

const addSoftSelectionHalo = (mesh: THREE.Mesh, color: number, opacity: number, scale: number) => {
  const halo = new THREE.Mesh(
    mesh.geometry.clone(),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  halo.scale.multiplyScalar(scale);
  halo.renderOrder = 1;
  mesh.add(halo);
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalize = (vec: Vec2): Vec2 => {
  const len = Math.hypot(vec.x, vec.y);
  if (!len) {
    return { x: 0, y: 0 };
  }
  return { x: vec.x / len, y: vec.y / len };
};

const computePolygonCentroid = (points: Vec2[]): Vec2 => {
  if (!points.length) {
    return { x: 0, y: 0 };
  }
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 }
  );
  return { x: total.x / points.length, y: total.y / points.length };
};

const wallLength = (wall: Wall): number => Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);

const getLevelBaseElevation = (levelMap: Map<string, BuildingModel["levels"][number]>, levelId: string): number =>
  levelMap.get(levelId)?.elevation_m ?? 0;

const formatFloorSlabKind = (kind: "interfloor" | "attic" | "basement" | "ground"): string => {
  switch (kind) {
    case "interfloor":
      return "межэтажное перекрытие";
    case "attic":
      return "чердачное перекрытие";
    case "basement":
      return "перекрытие над подвалом";
    case "ground":
      return "пол по грунту";
    default:
      return kind;
  }
};

const getLevelHeight = (
  levelMap: Map<string, BuildingModel["levels"][number]>,
  levelId: string,
  fallback: number
): number => levelMap.get(levelId)?.height_m ?? fallback;

const getModelLevelElevation = (model: BuildingModel, levelId: string): number =>
  model.levels.find((level) => level.id === levelId)?.elevation_m ?? 0;

type BuildBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerY: number;
  centerZ: number;
};

const computeModelBounds = (
  model: BuildingModel,
  options?: {
    activeLevelId?: string | null;
    includeRooms?: boolean;
    includeWalls?: boolean;
    includeOpenings?: boolean;
    includeNetworks?: boolean;
    includeEquipment?: boolean;
  }
): BuildBounds => {
  const min = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY };
  const max = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY };
  const renderGeometry = buildGeometryRenderModel(model);
  const levelMap = new Map(model.levels.map((level) => [level.id, level]));
  const activeLevelId = options?.activeLevelId ?? null;
  const matchesLevel = (levelId: string) => !activeLevelId || levelId === activeLevelId;
  const includeRooms = options?.includeRooms ?? true;
  const includeWalls = options?.includeWalls ?? true;
  const includeOpenings = options?.includeOpenings ?? true;
  const includeNetworks = options?.includeNetworks ?? true;
  const includeEquipment = options?.includeEquipment ?? true;
  const includePoint = (x: number, y: number, z: number) => {
    min.x = Math.min(min.x, x);
    min.y = Math.min(min.y, y);
    min.z = Math.min(min.z, z);
    max.x = Math.max(max.x, x);
    max.y = Math.max(max.y, y);
    max.z = Math.max(max.z, z);
  };

  if (includeRooms) {
    renderGeometry.roomVolumes.forEach((room) => {
      if (!matchesLevel(room.levelId)) {
        return;
      }
      const base = getModelLevelElevation(model, room.levelId);
      const height = levelMap.get(room.levelId)?.height_m ?? 3;
      room.polygon.forEach((point) => {
        includePoint(point.x, base, point.y);
        includePoint(point.x, base + height, point.y);
      });
    });
  }
  if (includeWalls) {
    model.walls.forEach((wall) => {
      if (!matchesLevel(wall.levelId)) {
        return;
      }
      const base = getModelLevelElevation(model, wall.levelId);
      includePoint(wall.a.x, base, wall.a.y);
      includePoint(wall.b.x, base + wall.height_m, wall.b.y);
      includePoint(wall.b.x, base, wall.b.y);
      includePoint(wall.a.x, base + wall.height_m, wall.a.y);
    });
    (model.roofs ?? []).forEach((roof) => {
      if (!matchesLevel(roof.levelId)) {
        return;
      }
      roof.boundary.forEach((point) => {
        const rise =
          roof.kind === "pitched" && roof.slope
            ? (point.x * Math.cos(THREE.MathUtils.degToRad(roof.slope.directionDeg)) +
                point.y * Math.sin(THREE.MathUtils.degToRad(roof.slope.directionDeg))) *
              roof.slope.risePerMeter
            : 0;
        includePoint(point.x, roof.elevationBase_m + rise, point.y);
        includePoint(point.x, roof.elevationBase_m + rise + roof.thickness_m, point.y);
      });
    });
    (model.floorSlabs ?? []).forEach((slab) => {
      if (!matchesLevel(slab.levelId)) {
        return;
      }
      slab.boundary.forEach((point) => {
        includePoint(point.x, slab.elevation_m - slab.thickness_m, point.y);
        includePoint(point.x, slab.elevation_m, point.y);
      });
    });
  }
  if (includeOpenings) {
    model.doors.forEach((door) => {
      const wall = door.anchor.wallId ? model.walls.find((entry) => entry.id === door.anchor.wallId) : null;
      if (!wall || !matchesLevel(wall.levelId)) {
        return;
      }
      const offset = anchorToOffset(door.anchor, wall);
      const point = resolveWallPoint(wall, offset + door.width_m / 2);
      const base = getModelLevelElevation(model, wall.levelId);
      includePoint(point.x, base + door.height_m * 0.5, point.y);
    });
    model.windows.forEach((windowItem) => {
      const wall = windowItem.anchor.wallId ? model.walls.find((entry) => entry.id === windowItem.anchor.wallId) : null;
      if (!wall || !matchesLevel(wall.levelId)) {
        return;
      }
      const offset = anchorToOffset(windowItem.anchor, wall);
      const point = resolveWallPoint(wall, offset + windowItem.width_m / 2);
      const base = getModelLevelElevation(model, wall.levelId);
      includePoint(point.x, base + (windowItem.sill_m ?? 0.9) + windowItem.height_m * 0.5, point.y);
    });
  }
  if (includeNetworks) {
    model.pipes.forEach((pipe) => {
      if (!matchesLevel(pipe.levelId)) {
        return;
      }
      const y = getModelLevelElevation(model, pipe.levelId) + 0.35;
      pipe.path.forEach((point) => includePoint(point.x, y, point.y));
    });
    model.ducts.forEach((duct) => {
      if (!matchesLevel(duct.levelId)) {
        return;
      }
      const levelHeight = model.levels.find((level) => level.id === duct.levelId)?.height_m ?? 3;
      const y = getModelLevelElevation(model, duct.levelId) + Math.max(2.2, levelHeight - 0.35);
      duct.path.forEach((point) => includePoint(point.x, y, point.y));
    });
  }
  if (includeEquipment) {
      model.equipment.forEach((item) => {
        if (!matchesLevel(item.levelId)) {
          return;
        }
        const levelHeight = model.levels.find((level) => level.id === item.levelId)?.height_m ?? 3;
        const y = getModelLevelElevation(model, item.levelId) + getEquipmentBaseY(item.type, levelHeight);
        includePoint(item.position.x, y, item.position.y);
      });
      model.sensors.forEach((item) => {
        if (!matchesLevel(item.levelId)) {
          return;
        }
        const levelHeight = model.levels.find((level) => level.id === item.levelId)?.height_m ?? 3;
        const y = getSensorWorldPosition(item, getModelLevelElevation(model, item.levelId), levelHeight).y;
        includePoint(item.position.x, y, item.position.y);
      });
  }

  if (!Number.isFinite(min.x)) {
    return {
      minX: -2,
      maxX: 2,
      minY: 0,
      maxY: 3,
      minZ: -2,
      maxZ: 2,
      centerX: 0,
      centerY: 1.5,
      centerZ: 0,
    };
  }

  return {
    minX: min.x,
    maxX: max.x,
    minY: min.y,
    maxY: max.y,
    minZ: min.z,
    maxZ: max.z,
    centerX: (min.x + max.x) / 2,
    centerY: (min.y + max.y) / 2,
    centerZ: (min.z + max.z) / 2,
  };
};

const findSelection = (object: MeshWithSelection | null): Selection | null => {
  let current: MeshWithSelection | null = object;
  while (current) {
    if (current.userData?.selection) {
      return current.userData.selection;
    }
    current = current.parent as MeshWithSelection | null;
  }
  return null;
};

function buildHeatmapState(
  model: BuildingModel,
  frame: ThermalTimelinePoint | null,
  renderGeometry = buildGeometryRenderModel(model),
  thermalBuildOptions?: Omit<ThermalFieldBuildOptions, "roomTemperaturesC">,
  precomputedField?: ThermalFieldModel | null,
  cache?: PreparedHeatmapStateCache | null
): HeatmapState | null {
  if (!frame) {
    return null;
  }
  if (precomputedField && cache?.field === precomputedField) {
    return cache.state;
  }
  const roomTemperatures: Record<string, number> = {};
  Object.entries(frame.rooms).forEach(([roomId, payload]) => {
    roomTemperatures[roomId] = payload.temperatureC;
  });
  const roomIds = Object.keys(roomTemperatures);
  if (!roomIds.length) {
    return null;
  }
  const field =
    precomputedField ??
    createThermalFieldModel(
      model,
      {
        ...thermalBuildOptions,
        outdoorTemperatureC: thermalBuildOptions?.outdoorTemperatureC ?? frame.outdoorTemperatureC,
        roomTemperaturesC: roomTemperatures,
      },
      renderGeometry
    );
  const wallTemperatures: Record<string, number> = {};
  const wallSurfaceTemperatures: HeatmapState["wallSurfaceTemperatures"] = {};
  renderGeometry.walls.forEach(({ wall, openings }) => {
    const baseSurface = sampleWallSurfaceTemperatures(field, wall.id) ?? {
      positiveSideC: frame.outdoorTemperatureC,
      negativeSideC: frame.outdoorTemperatureC,
      averageC: frame.outdoorTemperatureC,
    };
    wallTemperatures[wall.id] = baseSurface.averageC;
    wallSurfaceTemperatures[wall.id] = {
      ...baseSurface,
      profile: buildWallSurfaceProfile(field, wall, openings, baseSurface),
    };
  });

  return {
    field,
    roomTemperatures,
    wallTemperatures,
    wallSurfaceTemperatures,
    minTemperatureC: field.minTemperatureC,
    maxTemperatureC: field.maxTemperatureC,
  };
}

function buildHoverInfo(
  selection: Exclude<Selection, null>,
  screenX: number,
  screenY: number,
  model: BuildingModel,
  heatmapState: HeatmapState | null,
  worldPoint: Vec2 | null
) {
  const formatHoverTemperature = (value: number | null | undefined) =>
    typeof value === "number" ? `${value.toFixed(1)} °C` : "—";
  switch (selection.kind) {
    case "room": {
      const room = model.rooms.find((entry) => entry.id === selection.id);
      const derivedRoom = buildGeometryRenderModel(model).roomVolumes.find((entry) => entry.roomId === selection.id);
      return room
        ? {
            title: getRoomDisplayLabel(model, room.id),
            subtitle: "Объём помещения",
            temperatureC:
              heatmapState && worldPoint
                ? sampleSmoothedThermalFieldAtPoint(heatmapState.field, room.levelId, worldPoint)
                : heatmapState?.roomTemperatures[room.id] ?? null,
            screenX,
            screenY,
          }
        : derivedRoom
          ? {
              title: "Помещение",
              subtitle: derivedRoom.source === "walls" ? "Контур из стен" : "Объём помещения",
              temperatureC:
                heatmapState && worldPoint
                  ? sampleSmoothedThermalFieldAtPoint(heatmapState.field, derivedRoom.levelId, worldPoint)
                  : heatmapState?.roomTemperatures[derivedRoom.roomId] ?? null,
              screenX,
              screenY,
            }
          : null;
    }
    case "wall":
      {
        const surface = heatmapState?.wallSurfaceTemperatures[selection.id];
        const boundary = heatmapState?.field.boundaryByWallId.get(selection.id);
        const details =
          surface && boundary
            ? boundary.kind === "external"
              ? boundary.positiveRoomId !== null
                ? [
                    { label: "Внутренняя грань", value: formatHoverTemperature(surface.positiveSideC) },
                    { label: "Наружная грань", value: formatHoverTemperature(surface.negativeSideC) },
                    { label: "Средняя температура", value: formatHoverTemperature(surface.averageC) },
                    { label: "Тип", value: "Наружная стена" },
                    { label: "U", value: `${boundary.effectiveU_W_m2K.toFixed(2)} Вт/м²·К` },
                  ]
                : [
                    { label: "Внутренняя грань", value: formatHoverTemperature(surface.negativeSideC) },
                    { label: "Наружная грань", value: formatHoverTemperature(surface.positiveSideC) },
                    { label: "Средняя температура", value: formatHoverTemperature(surface.averageC) },
                    { label: "Тип", value: "Наружная стена" },
                    { label: "U", value: `${boundary.effectiveU_W_m2K.toFixed(2)} Вт/м²·К` },
                  ]
              : [
                  { label: "Сторона A", value: formatHoverTemperature(surface.positiveSideC) },
                  { label: "Сторона B", value: formatHoverTemperature(surface.negativeSideC) },
                  { label: "Средняя температура", value: formatHoverTemperature(surface.averageC) },
                  { label: "Тип", value: "Внутренняя стена" },
                  { label: "U", value: `${boundary.effectiveU_W_m2K.toFixed(2)} Вт/м²·К` },
                ]
            : undefined;
      return {
          title: "Стена",
          subtitle: details?.find((entry) => entry.label === "Тип")?.value ?? "Ограждающая конструкция",
          temperatureC: heatmapState?.wallTemperatures[selection.id] ?? null,
          details,
          screenX,
          screenY,
        };
      }
    case "roof": {
      const roof = (model.roofs ?? []).find((entry) => entry.id === selection.id);
      return roof
        ? {
            title: roof.name || "Крыша",
            subtitle: roof.kind === "pitched" ? "Скатная крыша" : "Плоская крыша",
            temperatureC: null,
            screenX,
            screenY,
          }
        : null;
    }
    case "slab": {
      const slab = (model.floorSlabs ?? []).find((entry) => entry.id === selection.id);
      return slab
        ? {
            title: slab.name || "Перекрытие",
            subtitle: formatFloorSlabKind(slab.kind),
            temperatureC: null,
            screenX,
            screenY,
          }
        : null;
    }
    case "door":
      {
        const door = model.doors.find((entry) => entry.id === selection.id);
        return {
          title: "Дверь",
          subtitle: door ? `Проём ${door.width_m.toFixed(2)} × ${door.height_m.toFixed(2)} м` : "Дверной проём",
          temperatureC: null,
          screenX,
          screenY,
        };
      }
    case "window":
      {
        const windowItem = model.windows.find((entry) => entry.id === selection.id);
        return {
          title: "Окно",
          subtitle: windowItem ? `Проём ${windowItem.width_m.toFixed(2)} × ${windowItem.height_m.toFixed(2)} м` : "Оконный проём",
          temperatureC: null,
          screenX,
          screenY,
        };
      }
    case "pipe": {
      const pipe = model.pipes.find((entry) => entry.id === selection.id);
      return {
        title: "Труба",
        subtitle: pipe ? `${pipe.diameter_mm} мм` : "Трубопровод",
        temperatureC: pipe?.fluidTemperatureC ?? null,
        screenX,
        screenY,
      };
    }
    case "duct": {
      const duct = model.ducts.find((entry) => entry.id === selection.id);
      const sectionLabel =
        duct?.section.shape === "round"
          ? duct.section.diameter_mm
            ? `Круглый, ${duct.section.diameter_mm} мм`
            : "Круглый воздуховод"
          : duct?.section.width_mm && duct.section.height_mm
            ? `${duct.section.width_mm} × ${duct.section.height_mm} мм`
            : "Прямоугольный воздуховод";
      return { title: "Воздуховод", subtitle: sectionLabel, temperatureC: null, screenX, screenY };
    }
    case "equipment": {
      const equipment = model.equipment.find((entry) => entry.id === selection.id);
      return {
        title: equipment ? getEquipmentDisplayName(equipment.id, model.equipment) : "Оборудование",
        subtitle: equipment?.roomId ? "Привязано к помещению" : "Инженерное оборудование",
        temperatureC: null,
        screenX,
        screenY,
      };
    }
    case "sensor": {
      const sensor = model.sensors.find((entry) => entry.id === selection.id);
      return {
        title: sensor ? SENSOR_TYPE_LABELS[sensor.type] : "Датчик",
        subtitle:
          sensor?.value !== null && sensor?.value !== undefined
            ? `${sensor.value.toFixed(1)} ${sensor.unit}`
            : sensor
              ? "Измерительное устройство"
              : "Датчик",
        temperatureC: sensor?.type === "temperature" ? sensor.value : null,
        screenX,
        screenY,
      };
    }
    default:
      return null;
  }
}

function buildHeatmapOverlay(
  model: BuildingModel,
  heatmapState: HeatmapState | null,
  options: { showHeatmap: boolean; showContours: boolean }
): THREE.Object3D[] {
  if (!heatmapState || (!options.showHeatmap && !options.showContours)) {
    return [];
  }
  const overlays: THREE.Object3D[] = [];
  const renderGeometry = buildGeometryRenderModel(model);
  const levelMap = new Map(model.levels.map((level) => [level.id, level]));
  const roomSamples = renderGeometry.roomVolumes
    .filter((room) => heatmapState.roomTemperatures[room.roomId] !== undefined)
    .map((room) => ({
      roomId: room.roomId,
      levelId: room.levelId,
      centroid: room.centroid,
      polygon: room.polygon,
      temperatureC: heatmapState.roomTemperatures[room.roomId],
      elevation: levelMap.get(room.levelId)?.elevation_m ?? 0,
    }));
  const isoValues = buildIsoValues(heatmapState.minTemperatureC, heatmapState.maxTemperatureC, 10);

  roomSamples.forEach((sample) => {
    const bounds = computePolygonBounds(sample.polygon);
    const roomArea = Math.max(1, Math.abs(polygonArea(sample.polygon)));
    const step = clamp(Math.sqrt(roomArea) / 24, 0.12, 0.22);
    for (let x = bounds.minX; x <= bounds.maxX; x += step) {
      for (let y = bounds.minY; y <= bounds.maxY; y += step) {
        const p00 = { x, y };
        const p10 = { x: x + step, y };
        const p11 = { x: x + step, y: y + step };
        const p01 = { x, y: y + step };
        const center = { x: x + step / 2, y: y + step / 2 };
        const insideCount = [p00, p10, p11, p01].filter((point) => polygonContainsPoint(point, sample.polygon)).length;
        if (!polygonContainsPoint(center, sample.polygon) && insideCount < 3) {
          continue;
        }
        const cellSamples = [
          { point: p00, value: sampleSmoothedThermalFieldAtPoint(heatmapState.field, sample.levelId, p00, step * 0.55) },
          { point: p10, value: sampleSmoothedThermalFieldAtPoint(heatmapState.field, sample.levelId, p10, step * 0.55) },
          { point: p11, value: sampleSmoothedThermalFieldAtPoint(heatmapState.field, sample.levelId, p11, step * 0.55) },
          { point: p01, value: sampleSmoothedThermalFieldAtPoint(heatmapState.field, sample.levelId, p01, step * 0.55) },
        ] as const;
        if (options.showHeatmap) {
          overlays.push(
            buildHeatmapCell(
              cellSamples,
              sample.elevation + 0.03,
              heatmapState.minTemperatureC,
              heatmapState.maxTemperatureC
            )
          );
        }
        if (options.showContours) {
          buildCellContours(cellSamples, isoValues, sample.elevation + 0.045).forEach((line) => overlays.push(line));
        }
      }
    }
  });

  return overlays;
}

function buildDebugObjects(
  model: BuildingModel,
  renderGeometry: ReturnType<typeof buildGeometryRenderModel>,
  levelMap: Map<string, BuildingModel["levels"][number]>,
  heatmapState: HeatmapState | null,
  debug: BuildSceneDebugOptions
): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];

  if (debug.showRoomContours) {
    renderGeometry.roomVolumes.forEach((room) => {
      const points = [...room.polygon, room.polygon[0]].map(
        (point) => new THREE.Vector3(point.x, (levelMap.get(room.levelId)?.elevation_m ?? 0) + 0.06, point.y)
      );
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.92 })
      );
      objects.push(line);
    });
  }

  if (debug.showWallNormals) {
    model.walls.forEach((wall) => {
      const direction = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
      const normal = { x: -direction.y, y: direction.x };
      const midpoint = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
      const elevation = (levelMap.get(wall.levelId)?.elevation_m ?? 0) + Math.min(wall.height_m * 0.45, 1.6);
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(midpoint.x, elevation, midpoint.y),
        new THREE.Vector3(midpoint.x + normal.x * 0.55, elevation, midpoint.y + normal.y * 0.55),
      ]);
      objects.push(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x0f766e })));
    });
  }

  if (debug.showThermalGrid && heatmapState) {
    const positions: number[] = [];
    const colors: number[] = [];
    heatmapState.field.rooms.forEach((room) => {
      const elevation = (levelMap.get(room.levelId)?.elevation_m ?? 0) + 0.08;
      room.samplePoints.forEach((point) => {
        const temp = sampleThermalFieldAtPoint(heatmapState.field, room.levelId, point);
        const color = new THREE.Color(temperatureToColor(temp, heatmapState.minTemperatureC, heatmapState.maxTemperatureC));
        positions.push(point.x, elevation, point.y);
        colors.push(color.r, color.g, color.b);
      });
    });
    if (positions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      objects.push(new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.08, vertexColors: true })));
    }
  }

  if (debug.showRadiatorInfluence && heatmapState) {
    heatmapState.field.sources.forEach((source) => {
      const ring = new THREE.EllipseCurve(0, 0, source.decayM, source.decayM, 0, Math.PI * 2, false, 0)
        .getPoints(64)
        .map(
          (point: THREE.Vector2) =>
            new THREE.Vector3(point.x + source.position.x, (levelMap.get(source.levelId)?.elevation_m ?? 0) + 0.12, point.y + source.position.y)
        );
      const geometry = new THREE.BufferGeometry().setFromPoints([...ring, ring[0]]);
      objects.push(
        new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.78 })
        )
      );
    });
  }

  if (debug.showCoolingZones && heatmapState) {
    heatmapState.field.boundaries.forEach((boundary) => {
      if (boundary.kind !== "external") {
        return;
      }
      const direction = normalize({ x: boundary.wall.b.x - boundary.wall.a.x, y: boundary.wall.b.y - boundary.wall.a.y });
      const normal = { x: -direction.y, y: direction.x };
      const roomOnPositiveSide = boundary.positiveRoomId !== null;
      const sign = roomOnPositiveSide ? 1 : -1;
      const offset = Math.max(0.35, Math.min(1.25, boundary.wall.thickness_m * 2.2));
      const y = (levelMap.get(boundary.wall.levelId)?.elevation_m ?? 0) + 0.09;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(boundary.wall.a.x + normal.x * offset * sign, y, boundary.wall.a.y + normal.y * offset * sign),
        new THREE.Vector3(boundary.wall.b.x + normal.x * offset * sign, y, boundary.wall.b.y + normal.y * offset * sign),
      ]);
      objects.push(
        new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.72 })
        )
      );
    });
  }

  if (debug.showOpeningHosts) {
    const wallsById = new Map(model.walls.map((wall) => [wall.id, wall]));
    [...model.doors, ...model.windows].forEach((opening) => {
      if (!opening.anchor.wallId) {
        return;
      }
      const wall = wallsById.get(opening.anchor.wallId);
      if (!wall) {
        return;
      }
      const attachment = attachOpeningToWall(opening, wall);
      if (!attachment) {
        return;
      }
      const wallMidpoint = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
      const y =
        (levelMap.get(wall.levelId)?.elevation_m ?? 0) +
        ("sill_m" in opening ? (opening.sill_m ?? 0.9) + opening.height_m * 0.5 : opening.height_m * 0.5);
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(attachment.center.x, y, attachment.center.y),
        new THREE.Vector3(wallMidpoint.x, y, wallMidpoint.y),
      ]);
      objects.push(
        new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({ color: opening.id.startsWith("win") ? 0x0ea5e9 : 0xf59e0b, transparent: true, opacity: 0.7 })
        )
      );
    });
  }

  return objects;
}

function buildIsoValues(minTemperatureC: number, maxTemperatureC: number, count: number) {
  if (count <= 1 || maxTemperatureC <= minTemperatureC) {
    return [minTemperatureC];
  }
  const rawStep = (maxTemperatureC - minTemperatureC) / (count - 1);
  const normalizedStep = Math.max(0.25, Math.round(rawStep / 0.25) * 0.25);
  const roundedMin = Math.floor(minTemperatureC / normalizedStep) * normalizedStep;
  return Array.from({ length: count }, (_, index) => roundedMin + normalizedStep * index).filter(
    (value) => value >= minTemperatureC - normalizedStep * 0.5 && value <= maxTemperatureC + normalizedStep * 0.5
  );
}

function buildHeatmapCell(
  cellSamples: readonly [
    { point: Vec2; value: number },
    { point: Vec2; value: number },
    { point: Vec2; value: number },
    { point: Vec2; value: number },
  ],
  elevation: number,
  minTemperatureC: number,
  maxTemperatureC: number
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      cellSamples.flatMap(({ point }) => [point.x, elevation, point.y]),
      3
    )
  );
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      cellSamples.flatMap(({ value }) => {
        const color = new THREE.Color(temperatureToColor(value, minTemperatureC, maxTemperatureC));
        return [color.r, color.g, color.b];
      }),
      3
    )
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.78,
        roughness: 0.18,
        metalness: 0.03,
        side: THREE.DoubleSide,
        depthWrite: false,
    })
  );
  mesh.receiveShadow = true;
  return mesh;
}

function buildCellContours(
  cellSamples: readonly [
    { point: Vec2; value: number },
    { point: Vec2; value: number },
    { point: Vec2; value: number },
    { point: Vec2; value: number },
  ],
  isoValues: number[],
  elevation: number
) {
  const contours: THREE.LineSegments[] = [];
  const edges: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ];

  isoValues.forEach((iso) => {
    const intersections = edges
      .map(([fromIndex, toIndex]) => {
        const from = cellSamples[fromIndex];
        const to = cellSamples[toIndex];
        const span = to.value - from.value;
        if (Math.abs(span) <= 1e-6) {
          return null;
        }
        const normalized = (iso - from.value) / span;
        if (normalized <= 0 || normalized >= 1) {
          return null;
        }
        return new THREE.Vector3(
          THREE.MathUtils.lerp(from.point.x, to.point.x, normalized),
          elevation,
          THREE.MathUtils.lerp(from.point.y, to.point.y, normalized)
        );
      })
      .filter((point): point is THREE.Vector3 => Boolean(point));

    if (intersections.length < 2) {
      return;
    }

    const segmentPairs =
      intersections.length === 4
        ? [
            [intersections[0], intersections[1]],
            [intersections[2], intersections[3]],
          ]
        : [[intersections[0], intersections[1]]];

    segmentPairs.forEach(([from, to]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({
          color: 0x1e293b,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        })
      );
      contours.push(line);
    });
  });

  return contours;
}

function computePolygonBounds(points: Vec2[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
}

function fitCameraToModel(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  bounds: BuildBounds
) {
  const spanX = Math.max(bounds.maxX - bounds.minX, 4);
  const spanY = Math.max(bounds.maxY - bounds.minY, 3);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 4);
  const perspectiveCamera = camera as THREE.PerspectiveCamera & { near: number; far: number; fov: number };
  const halfFov = THREE.MathUtils.degToRad(perspectiveCamera.fov * 0.5);
  const horizontalHalfFov = Math.atan(Math.tan(halfFov) * camera.aspect);
  const distanceForHeight = spanY / (2 * Math.tan(halfFov));
  const distanceForWidth = spanX / (2 * Math.tan(horizontalHalfFov || halfFov));
  const baseDistance = Math.max(distanceForHeight, distanceForWidth, spanZ * 0.85);
  const distance = Math.max(6, baseDistance * 1.38);
  const span = Math.max(spanX, spanY, spanZ);

  camera.up.set(0, 1, 0);
  controls.target.set(bounds.centerX, bounds.centerY, bounds.centerZ);
  camera.position.set(bounds.centerX + distance * 0.88, bounds.centerY + distance * 0.72, bounds.centerZ + distance * 0.88);
  perspectiveCamera.near = Math.max(0.1, span / 200);
  perspectiveCamera.far = Math.max(500, span * 12);
  camera.updateProjectionMatrix();
  camera.lookAt(bounds.centerX, bounds.centerY, bounds.centerZ);
  controls.update();
}

function setTopDownView(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  bounds: BuildBounds,
  model: BuildingModel,
  selection: Selection | null
) {
  const focus =
    selection && selection.kind !== "loop" ? resolveSelectionFocus(model, selection) : null;
  const target = focus
    ? { x: focus.x, y: focus.y, z: focus.z, radius: focus.radius }
    : {
        x: bounds.centerX,
        y: bounds.centerY,
        z: bounds.centerZ,
        radius: Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 4) * 0.5,
      };
  const distance = Math.max(8, target.radius * 5.5);
  const perspectiveCamera = camera as THREE.PerspectiveCamera & { near: number; far: number };
  controls.target.set(target.x, target.y, target.z);
  camera.position.set(target.x, target.y + distance, target.z + 0.001);
  perspectiveCamera.near = Math.max(0.1, distance / 200);
  perspectiveCamera.far = Math.max(500, distance * 20);
  camera.up.set(0, 0, -1);
  camera.lookAt(target.x, target.y, target.z);
  camera.updateProjectionMatrix();
  controls.update();
}

function focusSelection(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  model: BuildingModel,
  selection: Exclude<Selection, null>
) {
  const focus = resolveSelectionFocus(model, selection);
  if (!focus) {
    fitCameraToModel(camera, controls, computeModelBounds(model));
    return;
  }
  const offset = {
    x: camera.position.x - controls.target.x,
    y: camera.position.y - controls.target.y,
    z: camera.position.z - controls.target.z,
  };
  const offsetLength = Math.max(1, Math.hypot(offset.x, offset.y, offset.z));
  const desiredDistance = Math.max(focus.radius * 4.5, 4);
  const scale = desiredDistance / offsetLength;
  camera.up.set(0, 1, 0);
  controls.target.set(focus.x, focus.y, focus.z);
  camera.position.set(focus.x + offset.x * scale, focus.y + offset.y * scale, focus.z + offset.z * scale);
  camera.lookAt(focus.x, focus.y, focus.z);
  controls.update();
}

function resolveSelectionFocus(model: BuildingModel, selection: Exclude<Selection, null>) {
  switch (selection.kind) {
    case "room": {
      const room = model.rooms.find((entry) => entry.id === selection.id);
      if (!room) {
        return null;
      }
      const centroid = computePolygonCentroid(room.polygon);
      const level = model.levels.find((entry) => entry.id === room.levelId);
      const radius = Math.max(1.5, Math.sqrt(Math.abs(polygonArea(room.polygon))));
      return { x: centroid.x, y: (level?.elevation_m ?? 0) + (level?.height_m ?? 3) * 0.45, z: centroid.y, radius };
    }
    case "wall": {
      const wall = model.walls.find((entry) => entry.id === selection.id);
      if (!wall) {
        return null;
      }
      const level = model.levels.find((entry) => entry.id === wall.levelId);
      return {
        x: (wall.a.x + wall.b.x) / 2,
        y: (level?.elevation_m ?? 0) + wall.height_m * 0.5,
        z: (wall.a.y + wall.b.y) / 2,
        radius: Math.max(1.2, wallLength(wall) * 0.45),
      };
    }
    case "roof": {
      const roof = (model.roofs ?? []).find((entry) => entry.id === selection.id);
      if (!roof) {
        return null;
      }
      const centroid = computePolygonCentroid(roof.boundary);
      return {
        x: centroid.x,
        y: roof.elevationBase_m + roof.thickness_m * 0.5,
        z: centroid.y,
        radius: Math.max(1.6, Math.sqrt(Math.abs(polygonArea(roof.boundary)))),
      };
    }
    case "slab": {
      const slab = (model.floorSlabs ?? []).find((entry) => entry.id === selection.id);
      if (!slab) {
        return null;
      }
      const centroid = computePolygonCentroid(slab.boundary);
      return {
        x: centroid.x,
        y: slab.elevation_m - slab.thickness_m * 0.5,
        z: centroid.y,
        radius: Math.max(1.6, Math.sqrt(Math.abs(polygonArea(slab.boundary)))),
      };
    }
    case "door": {
      const door = model.doors.find((entry) => entry.id === selection.id);
      const wall = door?.anchor.wallId ? model.walls.find((entry) => entry.id === door.anchor.wallId) : null;
      if (!door || !wall) {
        return null;
      }
      const offset = anchorToOffset(door.anchor, wall);
      const point = resolveWallPoint(wall, offset + door.width_m / 2);
      const level = model.levels.find((entry) => entry.id === wall.levelId);
      return { x: point.x, y: (level?.elevation_m ?? 0) + door.height_m * 0.5, z: point.y, radius: 1.5 };
    }
    case "window": {
      const windowItem = model.windows.find((entry) => entry.id === selection.id);
      const wall = windowItem?.anchor.wallId ? model.walls.find((entry) => entry.id === windowItem.anchor.wallId) : null;
      if (!windowItem || !wall) {
        return null;
      }
      const offset = anchorToOffset(windowItem.anchor, wall);
      const point = resolveWallPoint(wall, offset + windowItem.width_m / 2);
      const level = model.levels.find((entry) => entry.id === wall.levelId);
      return {
        x: point.x,
        y: (level?.elevation_m ?? 0) + (windowItem.sill_m ?? 0.9) + windowItem.height_m * 0.5,
        z: point.y,
        radius: 1.5,
      };
    }
    case "pipe": {
      const pipe = model.pipes.find((entry) => entry.id === selection.id);
      if (!pipe || !pipe.path.length) {
        return null;
      }
      const mid = pipe.path[Math.floor(pipe.path.length / 2)];
      return { x: mid.x, y: getModelLevelElevation(model, pipe.levelId) + 0.35, z: mid.y, radius: 2 };
    }
    case "duct": {
      const duct = model.ducts.find((entry) => entry.id === selection.id);
      if (!duct || !duct.path.length) {
        return null;
      }
      const mid = duct.path[Math.floor(duct.path.length / 2)];
      return {
        x: mid.x,
        y: getModelLevelElevation(model, duct.levelId) + Math.max(2.2, getLevelHeight(new Map(model.levels.map((level) => [level.id, level])), duct.levelId, 3) - 0.35),
        z: mid.y,
        radius: 2.5,
      };
    }
    case "equipment": {
      const equipment = model.equipment.find((entry) => entry.id === selection.id);
      if (!equipment) {
        return null;
      }
      const levelHeight = model.levels.find((level) => level.id === equipment.levelId)?.height_m ?? 3;
      return { x: equipment.position.x, y: getModelLevelElevation(model, equipment.levelId) + getEquipmentBaseY(equipment.type, levelHeight) + 0.24, z: equipment.position.y, radius: 1.8 };
    }
    case "sensor": {
      const sensor = model.sensors.find((entry) => entry.id === selection.id);
      if (!sensor) {
        return null;
      }
      const levelHeight = model.levels.find((level) => level.id === sensor.levelId)?.height_m ?? 3;
      return {
        x: sensor.position.x,
        y: getSensorWorldPosition(sensor, getModelLevelElevation(model, sensor.levelId), levelHeight).y,
        z: sensor.position.y,
        radius: 1.5,
      };
    }
    default:
      return null;
  }
}

function closestPointOnPolyline(point: Vec2, path: Vec2[]): Vec2 | null {
  if (path.length < 2) {
    return null;
  }
  let bestPoint: Vec2 | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 1e-6) {
      continue;
    }
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
    const candidate = { x: start.x + dx * t, y: start.y + dy * t };
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = candidate;
    }
  }
  return bestPoint;
}

const buildCylinderBetween = (start: Vec2, end: Vec2, radius: number, color: number): THREE.Mesh | null => {
  const vector = new THREE.Vector3(end.x - start.x, 0, end.y - start.y);
  const length = vector.length();
  if (length <= MIN_WALL_SEGMENT) {
    return null;
  }
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 18);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 });
  const mesh = new THREE.Mesh(geometry, material);
  const midpoint = new THREE.Vector3((start.x + end.x) / 2, 0, (start.y + end.y) / 2);
  mesh.position.set(midpoint.x, midpoint.y, midpoint.z);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.clone().normalize());
  return mesh;
};

const buildBoxBetween = (start: Vec2, end: Vec2, width: number, height: number, color: number): THREE.Mesh | null => {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const length = Math.hypot(dx, dz);
  if (length <= MIN_WALL_SEGMENT) {
    return null;
  }
  const geometry = new THREE.BoxGeometry(length, height, width);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((start.x + end.x) / 2, 0, (start.y + end.y) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  return mesh;
};
