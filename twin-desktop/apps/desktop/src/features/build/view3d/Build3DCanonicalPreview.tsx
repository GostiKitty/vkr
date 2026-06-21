import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SolarPosition } from "../../../core/solar/solarPosition";
import type { Vec2 } from "../../../entities/geometry/types";
import { polygonArea, polygonContainsPoint } from "../../../entities/geometry/geom";
import {
  buildLevelAdjacencyMap,
  sampleSmoothedThermalFieldForFloorOverlay,
  sampleSmoothedThermalFieldForInterfloorSlab,
  type InterfloorSlabFace,
  type LevelAdjacency,
  type ThermalFieldModel,
} from "../../../core/thermal/field";
import type {
  SurfaceFieldRenderMode,
  SurfaceFieldResult,
} from "../../../core/thermal/surfaceField";
import type { Selection } from "../build.store";
import type { BuildViewerOptions } from "./viewerOptions";
import type { BuildSceneCameraState, BuildSceneHoverInfo } from "./sceneContracts";
import {
  buildCanonical3DModel,
  type Canonical3DModel,
  type CanonicalOpeningModel,
  type CanonicalSlabModel,
  type CanonicalTemperatureSummary,
  type CanonicalTemperatureSurface,
} from "./buildCanonical3DModel";
import { arcPolyline } from "../../../core/geometry/fillets";
import {
  calculateFitCameraForBounds,
  calculateGridLayoutForBounds,
  calculateTopViewCameraForBounds,
  normalizeStablePreviewBounds,
  type StablePreviewBounds,
  type StableFitCameraFrame,
} from "./stablePreviewMath";
import {
  buildSurfaceFieldHoverInfo,
  buildSurfaceFieldOverlayGroup,
} from "./surfaceFieldScene";
import { getRoomDisplayName } from "../../../shared/utils/roomNames";
import { thermalColor, percentileRange, thermalGradientCss } from "./thermalColormap";
import { ThermalFieldLegend } from "../../../shared/ui";
import {
  buildLevelElevationLabelGroup,
  buildRoomFloorLabelGroup,
  createRoomFloorLabelRenderer,
  disposeRoomFloorLabelGroup,
} from "./roomFloorLabels3D";

export const USE_ROOM_FLOOR_TEMPERATURE_COLORING = true;
export const DISABLE_ALL_3D_TEMPERATURE = false;
const DEBUG_3D_OVERLAY_DIAGNOSTICS =
  typeof window !== "undefined" &&
  (window.localStorage?.getItem("debug-3d-overlay") === "1" || window.sessionStorage?.getItem("debug-3d-overlay") === "1");

const MAX_FLOOR_THERMAL_SAMPLES_PER_ROOM = 220;

/**
 * Sample temperature across all room surfaces and compute a P5–P95 display range.
 * This prevents extreme outliers (near windows, radiators) from washing out the colormap.
 */
function buildSmoothedFieldColorSummary(
  thermalField: ThermalFieldModel,
  surfaces: CanonicalTemperatureSurface[],
  interfloorSlabs: CanonicalSlabModel[],
  levelAdjacency: Map<string, LevelAdjacency>
): CanonicalTemperatureSummary | null {
  const roomSurfaces = surfaces.filter((surface) => surface.sourceType === "room" && surface.boundary.length >= 3);
  if (!roomSurfaces.length) {
    return null;
  }
  const values: number[] = [];
  roomSurfaces.forEach((surface) => {
    const absArea = Math.abs(polygonArea(surface.boundary));
    let step = Math.sqrt(Math.max(absArea, 0.4) / 40);
    step = Math.min(0.52, Math.max(0.2, step));
    const minX = Math.min(...surface.boundary.map((p) => p.x));
    const maxX = Math.max(...surface.boundary.map((p) => p.x));
    const minY = Math.min(...surface.boundary.map((p) => p.y));
    const maxY = Math.max(...surface.boundary.map((p) => p.y));
    let roomSamples = 0;
    sampleLoop: for (let x = minX + step * 0.5; x < maxX; x += step) {
      for (let y = minY + step * 0.5; y < maxY; y += step) {
        const point = { x, y };
        if (!polygonContainsPoint(point, surface.boundary)) {
          continue;
        }
        values.push(
          sampleSmoothedThermalFieldForFloorOverlay(thermalField, surface.levelId, point, levelAdjacency)
        );
        roomSamples += 1;
        if (roomSamples >= MAX_FLOOR_THERMAL_SAMPLES_PER_ROOM) {
          break sampleLoop;
        }
      }
    }
  });
  interfloorSlabs.forEach((slab) => {
    if (slab.boundary.length < 3) {
      return;
    }
    const absArea = Math.abs(polygonArea(slab.boundary));
    let step = Math.sqrt(Math.max(absArea, 0.4) / 40);
    step = Math.min(0.52, Math.max(0.2, step));
    const minX = Math.min(...slab.boundary.map((p) => p.x));
    const maxX = Math.max(...slab.boundary.map((p) => p.x));
    const minY = Math.min(...slab.boundary.map((p) => p.y));
    const maxY = Math.max(...slab.boundary.map((p) => p.y));
    let slabSamples = 0;
    slabSampleLoop: for (let x = minX + step * 0.5; x < maxX; x += step) {
      for (let y = minY + step * 0.5; y < maxY; y += step) {
        const point = { x, y };
        if (!polygonContainsPoint(point, slab.boundary)) {
          continue;
        }
        (["bottom", "top"] as const).forEach((face) => {
          const temp = sampleSmoothedThermalFieldForInterfloorSlab(
            thermalField,
            slab.levelId,
            point,
            levelAdjacency,
            face
          );
          if (temp !== null) {
            values.push(temp);
          }
        });
        slabSamples += 1;
        if (slabSamples >= MAX_FLOOR_THERMAL_SAMPLES_PER_ROOM) {
          break slabSampleLoop;
        }
      }
    }
  });
  if (!values.length) {
    return null;
  }
  // P5–P95 normalization: extreme outliers (cold windows, hot radiators) don't
  // collapse the colormap range; minimum 2 °C visual spread.
  const { p5, p95, average } = percentileRange(values, 2.0);
  return {
    min_C: p5,
    max_C: p95,
    average_C: average,
    coloredRoomCount: roomSurfaces.length,
    warnings: [],
  };
}

function extractObjectBounds(object: THREE.Object3D): BuildSurfaceFieldDebugInfo["bounds"] {
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    return null;
  }
  return {
    min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
    max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
  };
}

function countOverlayObjects(object: THREE.Object3D) {
  let meshCount = 0;
  let lineCount = 0;
  object.traverse((entry) => {
    if (entry instanceof THREE.Mesh) {
      meshCount += 1;
    }
    if (entry instanceof THREE.Line || entry instanceof THREE.LineSegments) {
      lineCount += 1;
    }
  });
  return { meshCount, lineCount };
}

export interface Build3DCanonicalPreviewHandle {
  getCanvas: () => HTMLCanvasElement | null;
  focusModel: () => void;
  resetView: () => void;
  topView: () => void;
  zoomToFit: () => void;
  setTopView: () => void;
  focusSelection: () => void;
}

export interface BuildSurfaceFieldDebugInfo {
  overlayEnabled: boolean;
  showSurfaceField: boolean;
  showHeatSources: boolean;
  showThermalBridges: boolean;
  xRay: boolean;
  mode: SurfaceFieldRenderMode;
  surfaces: number;
  patches: number;
  heatSources: number;
  thermalBridges: number;
  groupChildren: number;
  meshCount: number;
  lineCount: number;
  thermalRootChildren: number;
  sceneHasSurfaceFieldGroup: boolean;
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } | null;
  reason?: string;
}

interface Build3DCanonicalPreviewProps {
  model: import("../../../entities/geometry/types").BuildingModel;
  activeLevelId: string | null;
  selection: Selection | null;
  viewer: BuildViewerOptions;
  thermalField?: ThermalFieldModel | null;
  surfaceField?: SurfaceFieldResult | null;
  surfaceFieldMode?: SurfaceFieldRenderMode;
  showSurfaceField?: boolean;
  showHeatSources?: boolean;
  showThermalBridges?: boolean;
  surfaceFieldOpacity?: number;
  showTemperature?: boolean;
  showWallTemperature?: boolean;
  /** When BuildPage already renders ThermalFieldLegend, hide the built-in summary card. */
  suppressTemperatureSummaryOverlay?: boolean;
  solarPosition?: SolarPosition | null;
  onSelect?: (selection: Selection | null) => void;
  onHoverInfo?: (info: BuildSceneHoverInfo | null) => void;
  onCameraStateChange?: (state: BuildSceneCameraState) => void;
  onSurfaceFieldDebug?: (info: BuildSurfaceFieldDebugInfo | null) => void;
}

const ROOM_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  transparent: true,
  opacity: 0.88,
  roughness: 0.92,
  metalness: 0.01,
  side: THREE.DoubleSide,
  depthWrite: true,
});
const WALL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x8fa8c2, roughness: 0.80, metalness: 0.07 });
const WALL_TRANSPARENT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  transparent: true,
  opacity: 0.42,
  roughness: 0.88,
  metalness: 0.03,
});
const OPENING_WINDOW_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xdbeafe,
  transparent: true,
  opacity: 0.92,
  roughness: 0.45,
  metalness: 0.04,
});
const OPENING_DOOR_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x64748b,
  transparent: true,
  opacity: 0.95,
  roughness: 0.6,
  metalness: 0.04,
});
const ROOF_FLAT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xcbd5e1,
  transparent: true,
  opacity: 0.65,
  roughness: 0.9,
  metalness: 0.03,
});
const ROOF_PITCHED_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xb45309,
  transparent: true,
  opacity: 0.82,
  roughness: 0.78,
  metalness: 0.02,
});
// Keep legacy alias for external references
const ROOF_MATERIAL = ROOF_FLAT_MATERIAL;
const SLAB_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  transparent: true,
  opacity: 0.42,
  roughness: 0.95,
  metalness: 0.02,
});
const STAIR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.82, metalness: 0.04 });
const SUPPLY_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.65, metalness: 0.04 });
const RETURN_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.65, metalness: 0.04 });
const DUCT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x64748b,
  transparent: true,
  opacity: 0.4,
  roughness: 0.75,
  metalness: 0.03,
});
const EQUIPMENT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.74, metalness: 0.04 });
const SENSOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.7, metalness: 0.03 });
const HIGHLIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  emissive: 0xf59e0b,
  emissiveIntensity: 0.08,
  roughness: 0.62,
  metalness: 0.04,
});

function buildShape(points: Vec2[]): THREE.Shape | null {
  if (points.length < 3) {
    return null;
  }
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index].x, points[index].y);
  }
  shape.lineTo(points[0].x, points[0].y);
  return shape;
}

/**
 * Строит меш скатной крыши (вальмовый тип).
 * Каждая вершина контура получает высоту, пропорциональную расстоянию до конька,
 * конёк проходит вдоль оси perpendicular to slope.directionDeg.
 */
function buildPitchedRoofMesh(
  boundaryIn: Vec2[],
  elevationBase: number,
  slope: { directionDeg: number; risePerMeter: number },
  material: THREE.Material
): THREE.Mesh {
  if (boundaryIn.length < 3) {
    return new THREE.Mesh(new THREE.BufferGeometry(), material);
  }
  const slopeDirRad = (slope.directionDeg * Math.PI) / 180;
  const sdx = Math.cos(slopeDirRad);
  const sdz = Math.sin(slopeDirRad);
  const cx = boundaryIn.reduce((s, p) => s + p.x, 0) / boundaryIn.length;
  const cz = boundaryIn.reduce((s, p) => s + p.y, 0) / boundaryIn.length;
  const projections = boundaryIn.map((p) => (p.x - cx) * sdx + (p.y - cz) * sdz);
  const maxAbsProj = Math.max(...projections.map((v) => Math.abs(v)), 0.5);
  const rawHeights = boundaryIn.map(
    (_, i) => elevationBase + slope.risePerMeter * (maxAbsProj - Math.abs(projections[i]))
  );
  const contourVecs = boundaryIn.map((p) => new THREE.Vector2(p.x, p.y));
  const isClockWise = THREE.ShapeUtils.isClockWise(contourVecs);
  const boundary = isClockWise ? [...boundaryIn].reverse() : boundaryIn;
  const heights = isClockWise ? [...rawHeights].reverse() : rawHeights;
  const triContour = isClockWise ? [...contourVecs].reverse() : contourVecs;
  let faces: number[][];
  try {
    faces = THREE.ShapeUtils.triangulateShape(triContour, []);
  } catch {
    return new THREE.Mesh(new THREE.BufferGeometry(), material);
  }
  const positions: number[] = [];
  const normals: number[] = [];
  for (const face of faces) {
    const [ai, bi, ci] = face;
    const va = [boundary[ai].x, heights[ai], boundary[ai].y];
    const vb = [boundary[bi].x, heights[bi], boundary[bi].y];
    const vc = [boundary[ci].x, heights[ci], boundary[ci].y];
    const e1 = [vb[0] - va[0], vb[1] - va[1], vb[2] - va[2]];
    const e2 = [vc[0] - va[0], vc[1] - va[1], vc[2] - va[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1];
    const ny = e1[2] * e2[0] - e1[0] * e2[2];
    const nz = e1[0] * e2[1] - e1[1] * e2[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    positions.push(...va, ...vb, ...vc);
    for (let j = 0; j < 3; j++) normals.push(nx / len, ny / len, nz / len);
  }
  for (let i = 0; i < boundary.length; i++) {
    const ai = i;
    const bi = (i + 1) % boundary.length;
    const ha = heights[ai];
    const hb = heights[bi];
    const pa = boundary[ai];
    const pb = boundary[bi];
    if (ha - elevationBase < 0.02 && hb - elevationBase < 0.02) continue;
    const ex = pb.x - pa.x;
    const ez = pb.y - pa.y;
    const elen = Math.hypot(ex, ez) || 1;
    const wnx = -ez / elen;
    const wnz = ex / elen;
    positions.push(pa.x, elevationBase, pa.y, pb.x, elevationBase, pb.y, pb.x, hb, pb.y);
    positions.push(pa.x, elevationBase, pa.y, pb.x, hb, pb.y, pa.x, ha, pa.y);
    for (let j = 0; j < 6; j++) normals.push(wnx, 0, wnz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return new THREE.Mesh(geo, material);
}

function computePlanBounds(points: Vec2[]) {
  return points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
}

function intersectPlanBounds(
  a: ReturnType<typeof computePlanBounds>,
  b: ReturnType<typeof computePlanBounds>
) {
  const width = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const height = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return width * height;
}

function getSurfaceShellIntersectionRatio(surfaceBoundary: Vec2[], shellBoundary: Vec2[]) {
  const surfaceBounds = computePlanBounds(surfaceBoundary);
  const shellBounds = computePlanBounds(shellBoundary);
  const surfaceArea = Math.max((surfaceBounds.maxX - surfaceBounds.minX) * (surfaceBounds.maxY - surfaceBounds.minY), 1e-6);
  return intersectPlanBounds(surfaceBounds, shellBounds) / surfaceArea;
}

function warnShiftedTemperatureSurface(details: Record<string, unknown>) {
  if (DEBUG_3D_OVERLAY_DIAGNOSTICS) {
    console.warn("[canonical-3d] skipped shifted temperature surface", details);
  }
}

function collectCanonicalShellPlanPoints(model: Canonical3DModel): Vec2[] {
  const wallPoints = model.walls.flatMap((wall) => [wall.start, wall.end]);
  const roomPoints = model.rooms.flatMap((room) => room.boundary);
  // Включаем контуры помещений в опорный план: только концы стен дают «коробку»,
  // которая не совпадает с фактическим полом (внутренние контуры, демо-полигоны из модели),
  // из-за чего корректные температурные оверлеи ошибочно отбрасывались как «сдвинутые».
  if (wallPoints.length >= 4) {
    return [...wallPoints, ...roomPoints];
  }
  return [...roomPoints, ...model.roofs.flatMap((roof) => roof.boundary)];
}

function setMeshIdentity(mesh: THREE.Mesh, name: string, userData: Record<string, unknown>) {
  mesh.name = name;
  Object.assign(mesh.userData, userData);
  return mesh;
}

function getSelectionMaterial(
  selection: Selection | null,
  kind: Exclude<NonNullable<Selection>["kind"], "loop">,
  id: string,
  material: THREE.Material
) {
  return selection?.kind === kind && selection.id === id ? HIGHLIGHT_MATERIAL : material;
}

/**
 * Create a MeshStandardMaterial tinted with the ANSYS-like thermal colormap.
 * Used for flat-shaded fallback surfaces (non-room sources).
 */
function createRoomTemperatureMaterial(temperature_C: number, summary: Canonical3DModel["temperatureSummary"]) {
  const min = summary?.min_C ?? temperature_C;
  const max = summary?.max_C ?? temperature_C;
  const span = Math.max(max - min, 1e-6);
  const color = thermalColor((temperature_C - min) / span);
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.76,
    roughness: 0.80,
    metalness: 0.01,
    emissive: color,
    emissiveIntensity: 0.10,
    depthTest: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

function createWallTemperatureMaterial(
  temperature_C: number,
  summary: Canonical3DModel["temperatureSummary"],
  transparent: boolean
) {
  const min = summary?.min_C ?? temperature_C;
  const max = summary?.max_C ?? temperature_C;
  const span = Math.max(max - min, 1e-6);
  const color = thermalColor((temperature_C - min) / span);
  return new THREE.MeshStandardMaterial({
    color,
    transparent: transparent,
    opacity: transparent ? 0.55 : 0.93,
    roughness: 0.76,
    metalness: 0.03,
    emissive: color,
    emissiveIntensity: 0.10,
  });
}

/**
 * Semi-transparent material for window/door thermal coloring.
 * Windows keep glass-like roughness; doors are more opaque.
 */
function createOpeningTemperatureMaterial(
  temperature_C: number,
  summary: Canonical3DModel["temperatureSummary"],
  isWindow: boolean
) {
  const min = summary?.min_C ?? temperature_C;
  const max = summary?.max_C ?? temperature_C;
  const span = Math.max(max - min, 1e-6);
  const color = thermalColor((temperature_C - min) / span);
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: isWindow ? 0.74 : 0.90,
    roughness: isWindow ? 0.18 : 0.60,
    metalness: isWindow ? 0.10 : 0.04,
    emissive: color,
    emissiveIntensity: isWindow ? 0.18 : 0.12,
  });
}

interface WallOpeningInfo {
  /** Normalized position along wall [0..1] at opening centre. */
  uNorm: number;
  /** Normalized vertical centre [0..1]. */
  vCenterNorm: number;
  /** Normalized half-width (opening.width_m / 2 / wallLength). */
  uHalfNorm: number;
  /** Normalized half-height (opening.height_m / 2 / wallHeight). */
  vHalfNorm: number;
}

/**
 * Per-vertex temperature for a wall grid mesh.
 * Combines:
 *  - base surface temperature
 *  - horizontal gradient from adjacent room temperatures at each wall end
 *  - vertical air-stratification gradient
 *  - corner thermal bridges (exponential decay from each wall end)
 *  - window/door frame thermal bridges (cold band around every opening)
 */
function wallVertexTemp(
  uNorm: number,
  vNorm: number,
  baseTemp_C: number,
  wallLength_m: number,
  wallHeight_m: number,
  isExterior: boolean,
  cornerCoolingStart_C: number,
  cornerCoolingEnd_C: number,
  openings: WallOpeningInfo[],
  startRoomTemp_C: number | null,
  endRoomTemp_C: number | null
): number {
  // Horizontal gradient from adjacent room temps at each endpoint.
  // Exterior walls transmit ~18% of room temp difference to interior surface;
  // interior walls transmit ~30% (lower thermal resistance).
  const roomInfluenceFactor = isExterior ? 0.18 : 0.30;
  const startDelta = startRoomTemp_C != null ? (startRoomTemp_C - baseTemp_C) * roomInfluenceFactor : 0;
  const endDelta   = endRoomTemp_C   != null ? (endRoomTemp_C   - baseTemp_C) * roomInfluenceFactor : 0;
  const horizontalGradient = startDelta * (1 - uNorm) + endDelta * uNorm;

  // Vertical stratification
  const stratBot = isExterior ? -2.2 : -1.1;
  const stratTop = isExterior ? 1.0 : 0.5;
  const strat = stratBot + (stratTop - stratBot) * vNorm;

  // Corner thermal bridges — decay in physical metres
  const physU = uNorm * wallLength_m;
  const cornerDecay = 0.55;
  const cornerPenalty =
    cornerCoolingStart_C * Math.exp(-physU / cornerDecay) +
    cornerCoolingEnd_C * Math.exp(-(wallLength_m - physU) / cornerDecay);

  // Frame thermal bridges — cold band around each opening perimeter
  let framePenalty = 0;
  for (const op of openings) {
    const distU_m = Math.max(0, Math.abs(uNorm - op.uNorm) - op.uHalfNorm) * wallLength_m;
    const distV_m = Math.max(0, Math.abs(vNorm - op.vCenterNorm) - op.vHalfNorm) * wallHeight_m;
    const distFrame_m = Math.sqrt(distU_m * distU_m + distV_m * distV_m);
    const framePeak = isExterior ? 4.5 : 2.2;
    const frameDecay = 0.28;
    framePenalty += framePeak * Math.exp(-distFrame_m / frameDecay);
  }

  // Floor-wall junction thermal bridge — cold strip at the base of the wall.
  // In IR thermography this is always the coldest zone: the slab edge bridges heat outward.
  const floorJunctionThreshold = 0.10; // bottom 10% of wall height
  const floorPeak = isExterior ? 2.0 : 0.8;
  const floorJunctionPenalty = vNorm < floorJunctionThreshold
    ? floorPeak * (1 - vNorm / floorJunctionThreshold)
    : 0;

  return baseTemp_C + horizontalGradient + strat - cornerPenalty - framePenalty - floorJunctionPenalty;
}

/**
 * Physics-based wall thermal mesh with vertex colours.
 * Models horizontal room-temp gradient, vertical stratification,
 * corner thermal bridges, window-frame bridges, and floor-wall junction.
 */
function addWallThermalMesh(
  root: THREE.Object3D,
  wall: { id: string; start: Vec2; end: Vec2; elevation_m: number; height_m: number; temperature_C: number },
  openings: WallOpeningInfo[],
  cornerCoolingStart_C: number,
  cornerCoolingEnd_C: number,
  colorScale: NonNullable<Canonical3DModel["temperatureSummary"]>,
  isExterior: boolean,
  startRoomTemp_C: number | null,
  endRoomTemp_C: number | null
): void {
  // Extra params stored in userData so hover handler can recompute accurate temperature
  const { min_C, max_C } = colorScale;
  const span = Math.max(max_C - min_C, 1e-6);

  const a = wall.start;
  const b = wall.end;
  const wallDx = b.x - a.x;
  const wallDz = b.y - a.y;
  const wallLength = Math.sqrt(wallDx * wallDx + wallDz * wallDz);
  const wallHeight = Math.max(wall.height_m, 2.4);
  const y0 = wall.elevation_m;

  if (wallLength < 0.05) return;

  // Higher resolution grid — more detail near corners / openings
  const nu = Math.max(8, Math.ceil(wallLength / 0.25));
  const nv = Math.max(5, Math.ceil(wallHeight / 0.32));
  const vertCount = (nu + 1) * (nv + 1);

  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);

  let vi = 0;
  for (let iv = 0; iv <= nv; iv++) {
    const vNorm = iv / nv;
    const worldY = y0 + vNorm * wallHeight;
    for (let iu = 0; iu <= nu; iu++) {
      const uNorm = iu / nu;
      // World position along wall
      positions[vi * 3] = a.x + uNorm * wallDx;
      positions[vi * 3 + 1] = worldY;
      positions[vi * 3 + 2] = a.y + uNorm * wallDz;

      const T = wallVertexTemp(
        uNorm, vNorm,
        wall.temperature_C, wallLength, wallHeight,
        isExterior,
        cornerCoolingStart_C, cornerCoolingEnd_C,
        openings,
        startRoomTemp_C,
        endRoomTemp_C
      );
      const c = thermalColor((T - min_C) / span);
      colors[vi * 3] = c.r;
      colors[vi * 3 + 1] = c.g;
      colors[vi * 3 + 2] = c.b;
      vi++;
    }
  }

  // Build triangle index buffer
  const triCount = nu * nv * 2;
  const indices = new Uint16Array(triCount * 3);
  let ti = 0;
  for (let iv = 0; iv < nv; iv++) {
    for (let iu = 0; iu < nu; iu++) {
      const i00 = iv * (nu + 1) + iu;
      const i10 = i00 + 1;
      const i01 = i00 + (nu + 1);
      const i11 = i01 + 1;
      indices[ti++] = i00; indices[ti++] = i10; indices[ti++] = i11;
      indices[ti++] = i00; indices[ti++] = i11; indices[ti++] = i01;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true,
    opacity: isExterior ? 0.62 : 0.48,
    side: THREE.DoubleSide, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  setMeshIdentity(mesh, `wall-gradient:${wall.id}`, {
    category: "wall-thermal-gradient",
    // Store wall geometry params so hover handler can recompute T at hit point
    wallStart: wall.start,
    wallEnd: wall.end,
    wallDx, wallDz, wallLength, wallHeight,
    wallElevation_m: wall.elevation_m,
    wallTemp_C: wall.temperature_C,
    isExteriorWall: isExterior,
    cornerCoolingStart_C,
    cornerCoolingEnd_C,
    openings,
    startRoomTemp_C,
    endRoomTemp_C,
    disposeMaterial: true,
  });
  root.add(mesh);
}

/**
 * Minimal polygon-edge distance (metres) from point (px, py) to a 2-D polygon.
 * Used for roof thermal gradient (perimeter is coldest).
 */
function distToPolygonBoundary(px: number, py: number, poly: Vec2[]): number {
  let min = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    min = Math.min(min, Math.sqrt((px - cx) ** 2 + (py - cy) ** 2));
  }
  return min;
}

/** Ray-cast point-in-polygon test for 2-D Vec2 polygons. */
function pointInPolygon2D(px: number, py: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Horizontal vertex-coloured thermal gradient mesh for flat roofs.
 * Simulates the IR-thermography pattern: coolest near perimeter (slab-edge bridge),
 * warmest toward centre (well-insulated field).
 */
function addRoofThermalMesh(
  root: THREE.Object3D,
  roof: { id: string; boundary: Vec2[]; elevation_m: number; thickness_m: number },
  baseTemp_C: number,
  colorScale: NonNullable<Canonical3DModel["temperatureSummary"]>
): void {
  if (roof.boundary.length < 3) return;
  const { min_C, max_C } = colorScale;
  const span = Math.max(max_C - min_C, 1e-6);

  // Bounding box of roof polygon
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const v of roof.boundary) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minZ) minZ = v.y; if (v.y > maxZ) maxZ = v.y;
  }
  const step = 0.40;
  const yWorld = roof.elevation_m + Math.max(roof.thickness_m, 0.05) + 0.022;

  // Collect inside-polygon grid vertices
  const verts: Array<[number, number]> = [];
  for (let z = minZ; z <= maxZ + step * 0.5; z += step) {
    for (let x = minX; x <= maxX + step * 0.5; x += step) {
      if (pointInPolygon2D(x, z, roof.boundary)) verts.push([x, z]);
    }
  }
  if (verts.length < 3) return;

  // Build unindexed triangle fan per interior quad — simple enough for roofs
  const positions: number[] = [];
  const colors: number[] = [];
  const EDGE_PEAK = 2.2;  // perimeter thermal bridge penalty
  const edgeDecay = 1.2;  // decay length in metres

  const addVert = (x: number, z: number) => {
    const dist = distToPolygonBoundary(x, z, roof.boundary);
    const T = baseTemp_C - EDGE_PEAK * Math.exp(-dist / edgeDecay);
    const c = thermalColor((T - min_C) / span);
    positions.push(x, yWorld, z);
    colors.push(c.r, c.g, c.b);
  };

  // Reconstruct quads from the regular grid, emit two triangles per quad
  const cols = Math.round((maxX - minX) / step) + 2;
  const rows = Math.round((maxZ - minZ) / step) + 2;
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const x0 = minX + col * step;
      const z0 = minZ + row * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      const p00 = pointInPolygon2D(x0, z0, roof.boundary);
      const p10 = pointInPolygon2D(x1, z0, roof.boundary);
      const p01 = pointInPolygon2D(x0, z1, roof.boundary);
      const p11 = pointInPolygon2D(x1, z1, roof.boundary);
      if (p00 && p10 && p11) { addVert(x0, z0); addVert(x1, z0); addVert(x1, z1); }
      if (p00 && p11 && p01) { addVert(x0, z0); addVert(x1, z1); addVert(x0, z1); }
    }
  }
  if (positions.length === 0) return;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.68,
    side: THREE.DoubleSide, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  setMeshIdentity(mesh, `roof-gradient:${roof.id}`, {
    category: "roof-thermal-gradient", temperature_C: baseTemp_C, disposeMaterial: true,
  });
  root.add(mesh);
}

/**
 * Coloured edge frame around a thermally-highlighted window.
 * Makes cold thermal bridges at window perimeters immediately visible.
 */
function addWindowThermalEdges(
  root: THREE.Object3D,
  opening: CanonicalOpeningModel,
  colorScale: NonNullable<Canonical3DModel["temperatureSummary"]>
): void {
  const { min_C, max_C } = colorScale;
  const span = Math.max(max_C - min_C, 1e-6);
  const c = thermalColor(((opening.temperature_C as number) - min_C) / span);

  const margin = 0.045;
  const boxGeo = new THREE.BoxGeometry(
    opening.width_m + margin,
    opening.height_m + margin,
    opening.depth_m + margin * 2
  );
  const edgesGeo = new THREE.EdgesGeometry(boxGeo, 12);
  boxGeo.dispose();

  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(c.r, c.g, c.b),
    transparent: true, opacity: 0.88,
  });
  const lines = new THREE.LineSegments(edgesGeo, mat);
  lines.rotation.y = opening.rotationY_rad;
  lines.position.set(opening.center.x, opening.center.y, opening.center.z);
  lines.renderOrder = 4;
  lines.name = `window-edges:${opening.id}`;
  lines.userData = { category: "window-thermal-edges", disposeMaterial: true };
  root.add(lines);
}

/**
 * Vertex-coloured face mesh layered on a window or door.
 * Models the glass-centre warm zone and the cold frame thermal bridge.
 * Placed on the inner (room-facing) face of the opening.
 */
function addWindowFaceThermalMesh(
  root: THREE.Object3D,
  opening: CanonicalOpeningModel,
  colorScale: NonNullable<Canonical3DModel["temperatureSummary"]>
): void {
  const { min_C, max_C } = colorScale;
  const span = Math.max(max_C - min_C, 1e-6);
  const baseTemp = opening.temperature_C as number;
  const isWin = opening.type === "window";
  const W = opening.width_m;
  const H = opening.height_m;

  // Frame bridge: exterior glazing has strong frame cooling; doors less so
  const framePeak = opening.isExterior ? (isWin ? 3.5 : 2.0) : (isWin ? 1.5 : 0.7);
  const frameDecay = opening.isExterior ? 0.09 : 0.06;
  // Centre of double/triple glazing is slightly warmer than base (argon fill)
  const centerBonus = isWin ? 0.55 : 0.20;

  const nu = Math.max(5, Math.ceil(W / 0.14));
  const nv = Math.max(6, Math.ceil(H / 0.14));
  const vertCount = (nu + 1) * (nv + 1);

  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const zFace = -opening.depth_m * 0.5 - 0.006; // inner room-facing surface

  let vi = 0;
  for (let iv = 0; iv <= nv; iv++) {
    const vNorm = iv / nv;
    for (let iu = 0; iu <= nu; iu++) {
      const uNorm = iu / nu;
      positions[vi * 3]     = (uNorm - 0.5) * W;
      positions[vi * 3 + 1] = (vNorm - 0.5) * H;
      positions[vi * 3 + 2] = zFace;

      // Distance from nearest frame edge (metres)
      const distEdge = Math.min(uNorm * W, (1 - uNorm) * W, vNorm * H, (1 - vNorm) * H);
      // Smooth bump: 0 at edges, 1 at centre
      const bump = uNorm * (1 - uNorm) * 4 * (vNorm * (1 - vNorm) * 4);
      const T = baseTemp + centerBonus * bump - framePeak * Math.exp(-distEdge / frameDecay);
      const c = thermalColor((T - min_C) / span);
      colors[vi * 3] = c.r; colors[vi * 3 + 1] = c.g; colors[vi * 3 + 2] = c.b;
      vi++;
    }
  }

  const indices = new Uint16Array(nu * nv * 6);
  let ti = 0;
  for (let iv = 0; iv < nv; iv++) {
    for (let iu = 0; iu < nu; iu++) {
      const i00 = iv * (nu + 1) + iu;
      const i10 = i00 + 1;
      const i01 = i00 + (nu + 1);
      const i11 = i01 + 1;
      indices[ti++] = i00; indices[ti++] = i10; indices[ti++] = i11;
      indices[ti++] = i00; indices[ti++] = i11; indices[ti++] = i01;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true,
    opacity: isWin ? 0.70 : 0.82,
    side: THREE.DoubleSide, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = opening.rotationY_rad;
  mesh.position.set(opening.center.x, opening.center.y, opening.center.z);
  mesh.renderOrder = 5;
  mesh.name = `window-face:${opening.id}`;
  mesh.userData = {
    category: "window-face-gradient",
    sourceType: opening.type,
    temperature_C: baseTemp,
    isExterior: opening.isExterior,
    disposeMaterial: true,
  };
  root.add(mesh);
}

/**
 * Convert a thermal color (Three.Color sRGB) to a CSS rgb() string,
 * darkened for text legibility on white backgrounds.
 */
function thermalColorToCss(color: THREE.Color, darken = 0.72): string {
  const r = Math.round(Math.min(color.r * darken, 1) * 255);
  const g = Math.round(Math.min(color.g * darken, 1) * 255);
  const b = Math.round(Math.min(color.b * darken, 1) * 255);
  return `rgb(${r},${g},${b})`;
}

/**
 * Build a smooth thermal field mesh using vertex colors on a horizontal plan patch.
 */
function addPlanarThermalColorMesh(
  shellRoot: THREE.Object3D,
  boundary: Vec2[],
  baseY: number,
  colorScale: NonNullable<Canonical3DModel["temperatureSummary"]>,
  sampleTemperatureC: (point: Vec2) => number | null,
  meshName: string,
  identity: Record<string, unknown>,
  renderOrder: number,
  opacity = 0.82
): void {
  if (boundary.length < 3) {
    return;
  }

  const absArea = Math.abs(polygonArea(boundary));
  const step = Math.min(0.45, Math.max(0.20, Math.sqrt(Math.max(absArea, 0.5) / 60)));

  const minX = Math.min(...boundary.map((p) => p.x));
  const maxX = Math.max(...boundary.map((p) => p.x));
  const minY = Math.min(...boundary.map((p) => p.y));
  const maxY = Math.max(...boundary.map((p) => p.y));

  const cols = Math.ceil((maxX - minX) / step) + 2;
  const rows = Math.ceil((maxY - minY) / step) + 2;

  interface Node { x: number; y: number; inside: boolean; tempC: number | null; }
  const nodes: Node[][] = [];

  for (let row = 0; row < rows; row++) {
    nodes[row] = [];
    for (let col = 0; col < cols; col++) {
      const x = minX + (col - 0.5) * step;
      const y = minY + (row - 0.5) * step;
      const inside = polygonContainsPoint({ x, y }, boundary);
      const tempC = inside ? sampleTemperatureC({ x, y }) : null;
      nodes[row][col] = { x, y, inside, tempC };
    }
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const { min_C, max_C } = colorScale;
  const span = Math.max(max_C - min_C, 1e-6);

  function pushVertex(n: Node) {
    if (n.tempC === null) {
      return;
    }
    positions.push(n.x, baseY, n.y);
    const c = thermalColor((n.tempC - min_C) / span);
    colors.push(c.r, c.g, c.b);
  }

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const v00 = nodes[row][col];
      const v10 = nodes[row][col + 1];
      const v01 = nodes[row + 1][col];
      const v11 = nodes[row + 1][col + 1];

      if (v00.inside && v10.inside && v11.inside && v00.tempC !== null && v10.tempC !== null && v11.tempC !== null) {
        pushVertex(v00); pushVertex(v10); pushVertex(v11);
      }
      if (v00.inside && v11.inside && v01.inside && v00.tempC !== null && v11.tempC !== null && v01.tempC !== null) {
        pushVertex(v00); pushVertex(v11); pushVertex(v01);
      }
    }
  }

  if (positions.length === 0) {
    return;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = renderOrder;
  setMeshIdentity(mesh, meshName, { ...identity, disposeMaterial: true });
  shellRoot.add(mesh);
}

function addRoomFloorThermalMesh(
  shellRoot: THREE.Object3D,
  surface: CanonicalTemperatureSurface,
  thermalField: ThermalFieldModel,
  colorScale: NonNullable<Canonical3DModel["temperatureSummary"]>,
  levelAdjacency: Map<string, LevelAdjacency>
): void {
  addPlanarThermalColorMesh(
    shellRoot,
    surface.boundary,
    surface.elevation_m + 0.022,
    colorScale,
    (point) => sampleSmoothedThermalFieldForFloorOverlay(thermalField, surface.levelId, point, levelAdjacency),
    `temperature:floor:${surface.id}`,
    {
      category: "temperature-floor",
      sourceType: surface.sourceType,
      sourceId: surface.roomId ?? surface.id,
      levelId: surface.levelId,
      geometrySource: surface.geometrySource,
      warning: surface.warning,
    },
    3
  );
}

function addInterfloorSlabThermalMeshes(
  shellRoot: THREE.Object3D,
  slab: CanonicalSlabModel,
  thermalField: ThermalFieldModel,
  colorScale: NonNullable<Canonical3DModel["temperatureSummary"]>,
  levelAdjacency: Map<string, LevelAdjacency>
): void {
  const slabDepth = Math.max(slab.thickness_m, 0.05);
  const sampleForFace = (face: InterfloorSlabFace) => (point: Vec2) =>
    sampleSmoothedThermalFieldForInterfloorSlab(thermalField, slab.levelId, point, levelAdjacency, face);

  // Bottom face — ceiling of the level below the slab (visible when looking up).
  addPlanarThermalColorMesh(
    shellRoot,
    slab.boundary,
    slab.elevation_m + 0.014,
    colorScale,
    sampleForFace("bottom"),
    `temperature:slab-bottom:${slab.id}`,
    {
      category: "temperature-slab",
      sourceType: "slab",
      sourceId: slab.id,
      levelId: slab.levelId,
      slabKind: slab.kind,
      slabFace: "bottom",
    },
    2.6,
    0.88
  );

  // Top face — underside of the floor above; sits just under the room-floor overlay.
  addPlanarThermalColorMesh(
    shellRoot,
    slab.boundary,
    slab.elevation_m + slabDepth - 0.014,
    colorScale,
    sampleForFace("top"),
    `temperature:slab-top:${slab.id}`,
    {
      category: "temperature-slab",
      sourceType: "slab",
      sourceId: slab.id,
      levelId: slab.levelId,
      slabKind: slab.kind,
      slabFace: "top",
    },
    2.85,
    0.72
  );
}

function addBoxBetween(
  root: THREE.Object3D,
  a: Vec2,
  b: Vec2,
  width: number,
  height: number,
  centerY: number,
  material: THREE.Material,
  options?: { name?: string; userData?: Record<string, unknown> }
) {
  const dx = b.x - a.x;
  const dz = b.y - a.y;
  const length = Math.hypot(dx, dz);
  if (length < 1e-4) {
    return null;
  }
  const geometry = new THREE.BoxGeometry(length, height, width);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((a.x + b.x) * 0.5, centerY, (a.y + b.y) * 0.5);
  mesh.rotation.y = -Math.atan2(dz, dx);
  if (options?.name || options?.userData) {
    setMeshIdentity(mesh, options?.name ?? mesh.name, options?.userData ?? {});
  }
  root.add(mesh);
  return mesh;
}

/** Криволинейная плита скруглённого угла стыка стен (кольцевой сектор). */
function addWallFillet(
  root: THREE.Object3D,
  fillet: Canonical3DModel["wallFillets"][number],
  material: THREE.Material,
  options?: { name?: string; userData?: Record<string, unknown> }
) {
  const half = fillet.thickness_m / 2;
  const outerRadius = fillet.radius_m + half;
  const innerRadius = Math.max(0.001, fillet.radius_m - half);
  const height = Math.max(fillet.height_m, 2.4);
  const segments = Math.max(4, Math.ceil((fillet.turnAngle / Math.PI) * 24));
  const outer = arcPolyline(fillet.center, outerRadius, fillet.startAngle, fillet.signedSweep, segments);
  const inner = arcPolyline(fillet.center, innerRadius, fillet.startAngle, fillet.signedSweep, segments).reverse();
  const shape = new THREE.Shape();
  [...outer, ...inner].forEach((point, index) => {
    // План (x, y) → footprint Shape; ось Y инвертируется, т.к. rotateX(-90°) переводит план-Y в мировой Z.
    const sx = point.x - fillet.center.x;
    const sy = -(point.y - fillet.center.y);
    if (index === 0) {
      shape.moveTo(sx, sy);
    } else {
      shape.lineTo(sx, sy);
    }
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(fillet.center.x, fillet.elevation_m, fillet.center.y);
  if (options?.name || options?.userData) {
    setMeshIdentity(mesh, options?.name ?? mesh.name, options?.userData ?? {});
  }
  root.add(mesh);
  return mesh;
}

function addCylinderBetween(
  root: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  options?: { name?: string; userData?: Record<string, unknown> }
) {
  const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
  const length = direction.length();
  if (length < 1e-4) {
    return null;
  }
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  if (options?.name || options?.userData) {
    setMeshIdentity(mesh, options?.name ?? mesh.name, options?.userData ?? {});
  }
  root.add(mesh);
  return mesh;
}

function createOpeningMesh(
  opening: CanonicalOpeningModel,
  selection: Selection | null,
  temperatureEnabled: boolean,
  colorScale: Canonical3DModel["temperatureSummary"]
) {
  const isWindow = opening.type === "window";
  const hasTemperature =
    temperatureEnabled && Number.isFinite(opening.temperature_C) && colorScale !== null;

  let baseMaterial: THREE.Material;
  let disposeThermalMaterial = false;
  if (hasTemperature) {
    baseMaterial = createOpeningTemperatureMaterial(
      opening.temperature_C as number,
      colorScale!,
      isWindow
    );
    disposeThermalMaterial = true;
  } else {
    baseMaterial = isWindow ? OPENING_WINDOW_MATERIAL : OPENING_DOOR_MATERIAL;
  }

  const kind = isWindow ? ("window" as const) : ("door" as const);
  const finalMaterial = getSelectionMaterial(selection, kind, opening.id, baseMaterial);
  if (finalMaterial !== baseMaterial && disposeThermalMaterial) {
    (baseMaterial as THREE.Material).dispose();
    disposeThermalMaterial = false;
  }

  const geometry = new THREE.BoxGeometry(opening.width_m, opening.height_m, opening.depth_m);
  const mesh = new THREE.Mesh(geometry, finalMaterial);
  mesh.rotation.y = opening.rotationY_rad;
  mesh.position.set(opening.center.x, opening.center.y, opening.center.z);
  return setMeshIdentity(mesh, `${opening.type}:${opening.id}`, {
    sourceType: opening.type,
    sourceId: opening.id,
    wallId: opening.wallId,
    category: "opening",
    temperature_C: opening.temperature_C,
    isExterior: opening.isExterior,
    disposeMaterial: disposeThermalMaterial,
    selection: { kind: opening.type, id: opening.id } satisfies Selection,
  });
}

function buildSimpleEquipmentMesh(item: Canonical3DModel["equipment"][number], selection: Selection | null) {
  const material = getSelectionMaterial(selection, "equipment", item.id, EQUIPMENT_MATERIAL);
  const geometry =
    item.type === "pump"
      ? new THREE.CylinderGeometry(0.08, 0.08, 0.22, 8)
      : item.type === "radiator"
        ? new THREE.BoxGeometry(0.8, 0.48, 0.08)
        : item.type === "boiler"
          ? new THREE.BoxGeometry(0.55, 0.95, 0.42)
          : item.type === "ahu"
            ? new THREE.BoxGeometry(1.1, 0.55, 0.55)
            : item.type === "diffuser"
              ? new THREE.BoxGeometry(0.24, 0.03, 0.24)
              : new THREE.BoxGeometry(0.28, 0.28, 0.28);
  const mesh = new THREE.Mesh(geometry, material);
  if (item.type === "pump") {
    mesh.rotation.z = Math.PI / 2;
  }
  mesh.position.set(item.position.x, item.position.y, item.position.z);
  return setMeshIdentity(mesh, `equipment:${item.id}`, {
    sourceType: "equipment",
    sourceId: item.id,
    category: "equipment",
    equipmentType: item.type,
    selection: { kind: "equipment", id: item.id } satisfies Selection,
  });
}

function disposeNode(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose?.();
    if (mesh.userData?.disposeMaterial === true) {
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose?.());
      } else {
        material?.dispose?.();
      }
    }
  });
}

function extractBoundsFromObject(root: THREE.Object3D): StablePreviewBounds | null {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) {
    return null;
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return normalizeStablePreviewBounds(center, size);
}

function getFitRoot(shellRoot: THREE.Group | null, contentRoot: THREE.Group | null): THREE.Object3D | null {
  if (shellRoot && shellRoot.children.length > 0) {
    return shellRoot;
  }
  return contentRoot;
}

function readCameraFov(camera: THREE.PerspectiveCamera): number {
  return (camera as THREE.PerspectiveCamera & { fov: number }).fov;
}

function writeCameraPlanes(camera: THREE.PerspectiveCamera, near: number, far: number) {
  const mutableCamera = camera as THREE.PerspectiveCamera & { near: number; far: number };
  mutableCamera.near = near;
  mutableCamera.far = far;
  camera.updateProjectionMatrix();
}

export const Build3DCanonicalPreview = React.forwardRef<Build3DCanonicalPreviewHandle, Build3DCanonicalPreviewProps>(
  (
    {
      model,
      activeLevelId,
      selection,
      viewer,
      thermalField = null,
      surfaceField = null,
      surfaceFieldMode = "surfaceTemperature",
      showSurfaceField = false,
      showHeatSources = false,
      showThermalBridges = false,
      showTemperature = false,
      showWallTemperature = false,
      suppressTemperatureSummaryOverlay = false,
      surfaceFieldOpacity = 0.52,
      solarPosition = null,
      onSelect,
      onHoverInfo,
      onCameraStateChange,
      onSurfaceFieldDebug,
    },
    forwardedRef
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const contentRef = useRef<THREE.Group | null>(null);
    const shellRootRef = useRef<THREE.Group | null>(null);
    const systemsRootRef = useRef<THREE.Group | null>(null);
    const thermalRootRef = useRef<THREE.Group | null>(null);
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const labelsRootRef = useRef<THREE.Group | null>(null);
    const labelRendererRef = useRef<ReturnType<typeof createRoomFloorLabelRenderer> | null>(null);
    const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
    const animationFrameRef = useRef<number>(0);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const fitRafRef = useRef<number | null>(null);
    const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
    const containerSizeRef = useRef({ width: 0, height: 0 });
    const homeViewRef = useRef<StableFitCameraFrame | null>(null);
    const hasInitialFitRef = useRef(false);
    const lastModelKeyRef = useRef("");
    const onSelectRef = useRef<typeof onSelect>(onSelect);
    const onHoverInfoRef = useRef<typeof onHoverInfo>(onHoverInfo);
    const onCameraStateChangeRef = useRef<typeof onCameraStateChange>(onCameraStateChange);
    const emitCameraStateRef = useRef<(() => void) | null>(null);
    const onSurfaceFieldDebugRef = useRef<typeof onSurfaceFieldDebug>(onSurfaceFieldDebug);
    const surfaceFieldRef = useRef<SurfaceFieldResult | null>(surfaceField);
    const surfaceFieldModeRef = useRef<SurfaceFieldRenderMode>(surfaceFieldMode);
    const roomLabelByIdRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
      onSelectRef.current = onSelect;
    }, [onSelect]);

    useEffect(() => {
      onHoverInfoRef.current = onHoverInfo;
    }, [onHoverInfo]);

    useEffect(() => {
      onCameraStateChangeRef.current = onCameraStateChange;
    }, [onCameraStateChange]);

    useEffect(() => {
      onSurfaceFieldDebugRef.current = onSurfaceFieldDebug;
    }, [onSurfaceFieldDebug]);

    useEffect(() => {
      surfaceFieldRef.current = surfaceField;
    }, [surfaceField]);

    useEffect(() => {
      surfaceFieldModeRef.current = surfaceFieldMode;
    }, [surfaceFieldMode]);

    const temperatureEnabled = showTemperature && USE_ROOM_FLOOR_TEMPERATURE_COLORING && !DISABLE_ALL_3D_TEMPERATURE;
    const wallTemperatureEnabled = temperatureEnabled && showWallTemperature;

    const canonicalModel = useMemo(
      () =>
        buildCanonical3DModel(model, activeLevelId, {
          thermalField,
        }),
      [activeLevelId, model, thermalField]
    );

    const levelAdjacency = useMemo(() => buildLevelAdjacencyMap(model.levels), [model.levels]);

    const interfloorSlabs = useMemo(
      () => canonicalModel.slabs.filter((slab) => slab.kind === "interfloor"),
      [canonicalModel.slabs]
    );

    const smoothedFieldColorSummary = useMemo(
      () =>
        thermalField
          ? buildSmoothedFieldColorSummary(
              thermalField,
              canonicalModel.temperatureSurfaces,
              interfloorSlabs,
              levelAdjacency
            )
          : null,
      [thermalField, canonicalModel.temperatureSurfaces, interfloorSlabs, levelAdjacency]
    );

    const temperatureColorScale = useMemo(
      () => smoothedFieldColorSummary ?? canonicalModel.temperatureSummary,
      [canonicalModel.temperatureSummary, smoothedFieldColorSummary]
    );
    const roomLabelById = useMemo(
      () => new Map(model.rooms.map((room, index) => [room.id, getRoomDisplayName(room, index)])),
      [model.rooms]
    );
    const levelElevationLabels = useMemo(() => {
      if (activeLevelId !== null) {
        return [];
      }
      const pointsByLevel = new Map<string, Vec2[]>();
      const appendPoints = (levelId: string | null | undefined, points: Vec2[]) => {
        if (!levelId || points.length === 0) {
          return;
        }
        const bucket = pointsByLevel.get(levelId) ?? [];
        bucket.push(...points);
        pointsByLevel.set(levelId, bucket);
      };

      canonicalModel.rooms.forEach((room) => appendPoints(room.levelId, room.boundary));
      canonicalModel.walls.forEach((wall) => appendPoints(wall.levelId, [wall.start, wall.end]));
      canonicalModel.roofs.forEach((roof) => appendPoints(roof.levelId, roof.boundary));
      canonicalModel.slabs.forEach((slab) => appendPoints(slab.levelId, slab.boundary));
      canonicalModel.stairs.forEach((stair) => appendPoints(stair.levelId, stair.boundary));

      return model.levels
        .filter((level) => (pointsByLevel.get(level.id)?.length ?? 0) > 0)
        .map((level) => ({
          id: level.id,
          text: `${level.elevation_m >= 0 ? "+" : ""}${level.elevation_m.toFixed(2)} м`,
          points: pointsByLevel.get(level.id) ?? [],
          elevation_m: level.elevation_m,
        }));
    }, [
      activeLevelId,
      canonicalModel.rooms,
      canonicalModel.roofs,
      canonicalModel.slabs,
      canonicalModel.stairs,
      canonicalModel.walls,
      model.levels,
    ]);

    useEffect(() => {
      roomLabelByIdRef.current = roomLabelById;
    }, [roomLabelById]);

    const coloredRoomFloorCount = useMemo(
      () => (temperatureEnabled ? canonicalModel.temperatureSurfaces.length : 0),
      [canonicalModel.temperatureSurfaces.length, temperatureEnabled]
    );
    const coloredWallCount = useMemo(
      () =>
        wallTemperatureEnabled
          ? canonicalModel.walls.filter((wall) => Number.isFinite(wall.temperature_C)).length
          : 0,
      [canonicalModel.walls, wallTemperatureEnabled]
    );
    const coloredInterfloorSlabCount = useMemo(
      () => (temperatureEnabled && thermalField ? interfloorSlabs.length : 0),
      [interfloorSlabs.length, temperatureEnabled, thermalField]
    );
    const coloredWindowCount = useMemo(
      () =>
        temperatureEnabled && viewer.showOpenings
          ? canonicalModel.windows.filter((w) => Number.isFinite(w.temperature_C)).length
          : 0,
      [canonicalModel.windows, temperatureEnabled, viewer.showOpenings]
    );
    const coloredDoorCount = useMemo(
      () =>
        temperatureEnabled && viewer.showOpenings
          ? canonicalModel.doors.filter((d) => Number.isFinite(d.temperature_C)).length
          : 0,
      [canonicalModel.doors, temperatureEnabled, viewer.showOpenings]
    );

    // Реактивное обновление положения солнца → позиция ключевого света
    useEffect(() => {
      const light = sunLightRef.current;
      if (!light) {
        return;
      }
      if (solarPosition && solarPosition.isAboveHorizon) {
        const DIST = 50;
        light.position.set(
          solarPosition.lightX * DIST,
          solarPosition.lightY * DIST,
          solarPosition.lightZ * DIST
        );
        light.intensity = 0.88;
      } else {
        // Ночь / солнце за горизонтом — возвращаем стандартную позицию
        light.position.set(18, 22, 14);
        light.intensity = solarPosition ? 0.12 : 0.88;
      }
    }, [solarPosition]);

    const renderCurrentScene = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    const applyCameraFrame = (frame: StableFitCameraFrame, updateHome: boolean) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) {
        return;
      }
      camera.position.set(frame.position.x, frame.position.y, frame.position.z);
      writeCameraPlanes(camera, frame.near, frame.far);
      controls.target.set(frame.target.x, frame.target.y, frame.target.z);
      controls.update();
      emitCameraStateRef.current?.();
      renderCurrentScene();
      if (updateHome) {
        homeViewRef.current = {
          ...frame,
          position: { ...frame.position },
          target: { ...frame.target },
        };
      }
      hasInitialFitRef.current = true;
    };

    const fitToModel = (mode: "focus" | "top", updateHome: boolean) => {
      const camera = cameraRef.current;
      const fitRoot = getFitRoot(shellRootRef.current, contentRef.current);
      if (!camera || !fitRoot) {
        return;
      }
      const bounds = extractBoundsFromObject(fitRoot);
      if (!bounds) {
        const fallback: StableFitCameraFrame =
          mode === "top"
            ? {
                position: { x: 0, y: 14, z: 0.01 },
                target: { x: 0, y: 0, z: 0 },
                distance: 14,
                near: 0.1,
                far: 1000,
              }
            : {
                position: { x: 12, y: 10, z: 12 },
                target: { x: 0, y: 1, z: 0 },
                distance: 12,
                near: 0.1,
                far: 1000,
              };
        applyCameraFrame(fallback, updateHome);
        return;
      }
      const frame =
        mode === "top"
          ? calculateTopViewCameraForBounds(bounds, camera.aspect, readCameraFov(camera))
          : calculateFitCameraForBounds(bounds, camera.aspect, readCameraFov(camera));
      applyCameraFrame(frame, updateHome);
    };

    const scheduleInitialFit = () => {
      if (fitRafRef.current !== null) {
        window.cancelAnimationFrame(fitRafRef.current);
      }
      fitRafRef.current = window.requestAnimationFrame(() => {
        fitRafRef.current = null;
        if (!containerSizeRef.current.width || !containerSizeRef.current.height || hasInitialFitRef.current) {
          return;
        }
        fitToModel("focus", true);
      });
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 220, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xc8dff0);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      camera.position.set(12, 10, 12);

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.enablePan = true;
      controls.enableRotate = true;
      controls.enableZoom = true;
      controls.target.set(0, 1, 0);
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
      };

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
        if (!onCameraStateChangeRef.current) {
          return;
        }
        if (!queuedCameraState || sameCameraState(lastCameraState, queuedCameraState)) {
          return;
        }
        lastCameraState = queuedCameraState;
        onCameraStateChangeRef.current(queuedCameraState);
      };
      const emitCameraState = () => {
        if (!onCameraStateChangeRef.current) {
          return;
        }
        queuedCameraState = buildCameraState();
        if (cameraStateFrameId !== 0) {
          return;
        }
        cameraStateFrameId = window.requestAnimationFrame(flushCameraState);
      };
      emitCameraStateRef.current = emitCameraState;
      controls.addEventListener("change", emitCameraState);
      emitCameraState();

      // Hemisphere light: sky (cool blue) / ground (warm beige) for realistic shading
      const hemiLight = new THREE.HemisphereLight(0xb2d4f0, 0xcec8b4, 0.75);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.15);
      keyLight.position.set(18, 22, 14);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 300;
      keyLight.shadow.camera.left = -60;
      keyLight.shadow.camera.right = 60;
      keyLight.shadow.camera.top = 60;
      keyLight.shadow.camera.bottom = -60;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.radius = 3;
      scene.add(keyLight);
      sunLightRef.current = keyLight;

      const fillLight = new THREE.DirectionalLight(0xc2ddf5, 0.42);
      fillLight.position.set(-10, 8, -6);
      scene.add(fillLight);

      // Invisible ground plane that receives soft shadows from the building
      const groundMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(120, 120),
        new THREE.ShadowMaterial({ opacity: 0.18 })
      );
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.y = -0.02;
      groundMesh.receiveShadow = true;
      groundMesh.name = "ground:shadow";
      scene.add(groundMesh);

      const grid = new THREE.GridHelper(20, 20, 0xb0c8e0, 0xd0dfe8);
      grid.name = "grid:canonical";
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMaterials.forEach((material) => {
        material.transparent = true;
        material.opacity = 0.28;
      });
      scene.add(grid);

      const content = new THREE.Group();
      content.name = "group:content";
      const shellRoot = new THREE.Group();
      shellRoot.name = "group:shell";
      const systemsRoot = new THREE.Group();
      systemsRoot.name = "group:systems";
      const thermalRoot = new THREE.Group();
      thermalRoot.name = "group:thermal";
      const labelsRoot = new THREE.Group();
      labelsRoot.name = "group:room-labels";
      content.add(shellRoot);
      content.add(systemsRoot);
      content.add(thermalRoot);
      content.add(labelsRoot);
      scene.add(content);

      const labelHost = canvas.parentElement ?? canvas;
      const labelRenderer = createRoomFloorLabelRenderer(labelHost);

      const resize = () => {
        const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
        const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 220;
        containerSizeRef.current = { width, height };
        renderer.setSize(width, height, false);
        labelRenderer.setSize(width, height);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        if (!hasInitialFitRef.current) {
          scheduleInitialFit();
        }
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const resolveSelection = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(content.children, true);
        const hit = hits.find((entry) => entry.object.userData?.selection);
        if (!hit) {
          onSelectRef.current?.(null);
          return;
        }
        onSelectRef.current?.(hit.object.userData.selection as Selection);
      };

      const handlePointerMove = (event: PointerEvent) => {
        if (!onHoverInfoRef.current) {
          return;
        }
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(content.children, true);
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        // Priority 1: surface-field overlay (patch-level tooltip)
        const surfaceHit = hits.find((entry) => {
          const category = entry.object.userData?.category;
          return (
            category === "surface-field" ||
            category === "surface-heat-source" ||
            category === "surface-thermal-bridge"
          );
        });
        const currentSurfaceField = surfaceFieldRef.current;
        if (surfaceHit && currentSurfaceField) {
          onHoverInfoRef.current?.(
            buildSurfaceFieldHoverInfo({
              intersection: surfaceHit,
              result: currentSurfaceField,
              mode: surfaceFieldModeRef.current,
              roomLabelById: roomLabelByIdRef.current,
              screenX,
              screenY,
            })
          );
          return;
        }

        // Priority 2: thermally-coloured shell (wall / opening / floor overlay / gradient / edges)
        const thermalHit = hits.find((entry) => {
          const cat = entry.object.userData?.category as string | undefined;
          return (
            cat === "shell" ||
            cat === "opening" ||
            cat === "temperature-floor" ||
            cat === "temperature-slab" ||
            cat === "wall-thermal-gradient" ||
            cat === "window-thermal-edges" ||
            cat === "window-face-gradient" ||
            cat === "roof-thermal-gradient"
          );
        });
        if (thermalHit) {
          const ud = thermalHit.object.userData;
          const rawCat = ud.category as string | undefined;

          // For wall-thermal-gradient: compute accurate temperature at the exact hit point
          // using stored wall geometry params rather than the base temperature.
          let accurateWallTemp: number | null = null;
          if (rawCat === "wall-thermal-gradient") {
            const wd = ud as {
              wallDx: number; wallDz: number; wallLength: number; wallHeight: number;
              wallStart: Vec2; wallElevation_m: number; wallTemp_C: number;
              isExteriorWall: boolean; cornerCoolingStart_C: number; cornerCoolingEnd_C: number;
              openings: WallOpeningInfo[]; startRoomTemp_C: number | null; endRoomTemp_C: number | null;
            };
            const pt = thermalHit.point;
            const uNorm = Math.max(0, Math.min(1,
              ((pt.x - wd.wallStart.x) * wd.wallDx + (pt.z - wd.wallStart.y) * wd.wallDz) /
              (wd.wallLength * wd.wallLength)
            ));
            const vNorm = Math.max(0, Math.min(1,
              (pt.y - wd.wallElevation_m) / wd.wallHeight
            ));
            accurateWallTemp = wallVertexTemp(
              uNorm, vNorm,
              wd.wallTemp_C, wd.wallLength, wd.wallHeight,
              wd.isExteriorWall,
              wd.cornerCoolingStart_C, wd.cornerCoolingEnd_C,
              wd.openings,
              wd.startRoomTemp_C, wd.endRoomTemp_C
            );
          }

          // gradient/edge overlays: fall through to parent mesh data for selection info
          let resolvedUd = ud;
          if (
            rawCat === "wall-thermal-gradient" ||
            rawCat === "window-thermal-edges" ||
            rawCat === "window-face-gradient"
          ) {
            const parts = (thermalHit.object.name ?? "").split(":");
            const parentId = parts.slice(1).join(":");
            const parentName =
              rawCat === "wall-thermal-gradient" ? `wall:${parentId}` : `window:${parentId}`;
            let parentObj: THREE.Object3D | undefined;
            thermalHit.object.parent?.traverse((o) => {
              if (o.name === parentName) parentObj = o;
            });
            if (parentObj?.userData) resolvedUd = parentObj.userData;
          }

          const baseTempC = resolvedUd.temperature_C as number | null | undefined;
          const tempC = accurateWallTemp ?? baseTempC;
          const hasTempC = typeof tempC === "number" && Number.isFinite(tempC);
          const cat = resolvedUd.category as string;
          const srcType = resolvedUd.sourceType as string | undefined;

          let title = "Поверхность";
          let subtitle: string | undefined;
          const details: Array<{ label: string; value: string }> = [];

          if (cat === "opening") {
            title = srcType === "window" ? "Окно" : "Дверь";
            if (hasTempC) {
              subtitle = resolvedUd.isExterior
                ? `Внутр. пов. (наружный контур): ${(tempC as number).toFixed(1)} °C`
                : `Внутренний проём: ${(tempC as number).toFixed(1)} °C`;
            }
          } else if (cat === "shell" && srcType === "wall") {
            title = resolvedUd.isExteriorWall ? "Наружная стена" : "Внутренняя стена";
            if (hasTempC) {
              subtitle = `Температура поверхности: ${(tempC as number).toFixed(1)} °C`;
              // SP50.13330 Δt_n check: normative inner-surface drop ≤ 4°C (residential exterior)
              const roomT = resolvedUd.adjacentRoomTemp_C as number | null | undefined;
              if (typeof roomT === "number" && Number.isFinite(roomT)) {
                const deltaT = roomT - (tempC as number);
                const norm = resolvedUd.isExteriorWall ? 4.0 : 8.0;
                details.push({ label: "Комната", value: `${roomT.toFixed(1)} °C` });
                details.push({ label: "ΔT поверхности", value: `${deltaT.toFixed(1)} °C` });
                details.push({
                  label: "СП 50 норма ΔT",
                  value: deltaT <= norm ? `≤ ${norm} °C ✓` : `> ${norm} °C ⚠`,
                });
              }
            }
          } else if (cat === "temperature-floor") {
            title = "Пол";
            if (hasTempC) {
              subtitle = `Температура: ${(tempC as number).toFixed(1)} °C`;
            }
          } else if (cat === "temperature-slab") {
            title = "Межэтажное перекрытие";
            if (hasTempC) {
              subtitle = `Температура: ${(tempC as number).toFixed(1)} °C`;
            }
          } else if (rawCat === "roof-thermal-gradient") {
            title = "Крыша";
            if (hasTempC) {
              subtitle = `Температура поверхности: ${(tempC as number).toFixed(1)} °C`;
            }
          }

          onHoverInfoRef.current?.({
            title,
            subtitle: subtitle ?? (hasTempC ? `${(tempC as number).toFixed(1)} °C` : "Нет данных"),
            temperatureC: hasTempC ? (tempC as number) : null,
            details: details.length > 0 ? details : undefined,
            screenX,
            screenY,
          });
          return;
        }

        onHoverInfoRef.current?.(null);
      };

      const handlePointerLeave = () => {
        onHoverInfoRef.current?.(null);
      };

      const handlePointerDown = (event: PointerEvent) => {
        pointerDownRef.current = { x: event.clientX, y: event.clientY };
      };

      const handlePointerUp = (event: PointerEvent) => {
        const pointerDown = pointerDownRef.current;
        pointerDownRef.current = null;
        if (!pointerDown || event.button !== 0) {
          return;
        }
        if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) <= 4) {
          resolveSelection(event);
        }
      };

      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      const preventViewportScroll = (event: WheelEvent) => {
        event.preventDefault();
      };
      const preventContextMenu = (event: MouseEvent) => {
        event.preventDefault();
      };
      canvas.addEventListener("wheel", preventViewportScroll, { passive: false });
      canvas.addEventListener("contextmenu", preventContextMenu);
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointerup", handlePointerUp);
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("pointerleave", handlePointerLeave);

      const animate = () => {
        controls.update();
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
        animationFrameRef.current = window.requestAnimationFrame(animate);
      };
      animate();

      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      controlsRef.current = controls;
      contentRef.current = content;
      shellRootRef.current = shellRoot;
      systemsRootRef.current = systemsRoot;
      thermalRootRef.current = thermalRoot;
      labelsRootRef.current = labelsRoot;
      labelRendererRef.current = labelRenderer;
      gridRef.current = grid;
      resizeObserverRef.current = resizeObserver;

      return () => {
        emitCameraStateRef.current = null;
        if (cameraStateFrameId !== 0) {
          window.cancelAnimationFrame(cameraStateFrameId);
        }
        controls.removeEventListener("change", emitCameraState);
        if (animationFrameRef.current) {
          window.cancelAnimationFrame(animationFrameRef.current);
        }
        if (fitRafRef.current !== null) {
          window.cancelAnimationFrame(fitRafRef.current);
        }
        resizeObserver.disconnect();
        canvas.removeEventListener("wheel", preventViewportScroll);
        canvas.removeEventListener("contextmenu", preventContextMenu);
        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("pointerup", handlePointerUp);
        canvas.removeEventListener("pointermove", handlePointerMove);
        canvas.removeEventListener("pointerleave", handlePointerLeave);
        disposeRoomFloorLabelGroup(labelsRootRef.current);
        labelsRootRef.current = null;
        labelRendererRef.current?.domElement.remove();
        labelRendererRef.current = null;
        controls.dispose();
        renderer.dispose();
        scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(material)) {
            material.forEach((entry) => entry.dispose?.());
          } else {
            material?.dispose?.();
          }
        });
      };
    }, []);

    useEffect(() => {
      const content = contentRef.current;
      const shellRoot = shellRootRef.current;
      const systemsRoot = systemsRootRef.current;
      const thermalRoot = thermalRootRef.current;
      const labelsRoot = labelsRootRef.current;
      const grid = gridRef.current;
      if (!content || !shellRoot || !systemsRoot || !thermalRoot || !labelsRoot || !grid) {
        return;
      }

      shellRoot.children.slice().forEach((child) => {
        shellRoot.remove(child);
        disposeNode(child);
      });
      systemsRoot.children.slice().forEach((child) => {
        systemsRoot.remove(child);
        disposeNode(child);
      });
      thermalRoot.children.slice().forEach((child) => {
        thermalRoot.remove(child);
        disposeNode(child);
      });
      disposeRoomFloorLabelGroup(labelsRoot);
      labelsRoot.clear();

      const wallMaterial = viewer.transparentWalls ? WALL_TRANSPARENT_MATERIAL : WALL_MATERIAL;
      const shellPlanBoundary = collectCanonicalShellPlanPoints(canonicalModel);
      const colorScale = temperatureColorScale;

      canonicalModel.rooms.forEach((room) => {
        if (!viewer.showRooms) {
          return;
        }
        const shape = buildShape(room.boundary);
        if (!shape) {
          return;
        }
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
        const baseMaterial = ROOM_MATERIAL;
        const roomMaterial = getSelectionMaterial(selection, "room", room.id, baseMaterial);
        const mesh = new THREE.Mesh(geometry, roomMaterial);
        // План (x, y) → мир (x, Y, z): как у стен и planToCanonicalScene — z = y_плана.
        // Rx(-π/2) давал z = -y_плана и «уносил» пол/температуру/плиты от корпуса.
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = room.elevation_m + 0.02 + 0.03;
        mesh.renderOrder = 1;
        setMeshIdentity(mesh, `roomFloor:${room.id}`, {
          category: "room-floor",
          sourceType: "room",
          sourceId: room.id,
          levelId: room.levelId,
          temperature_C: room.temperature_C,
          geometrySource: room.geometrySource,
          disposeMaterial: roomMaterial === baseMaterial && baseMaterial !== ROOM_MATERIAL,
          selection: { kind: "room", id: room.id } satisfies Selection,
        });
        shellRoot.add(mesh);
      });

      if (viewer.showRooms && canonicalModel.rooms.length > 0) {
        const roomsForLabels = colorScale
          ? canonicalModel.rooms.map((room) => {
              if (!Number.isFinite(room.temperature_C)) return room;
              const { min_C, max_C } = colorScale;
              const span = Math.max(max_C - min_C, 1e-6);
              const c = thermalColor(((room.temperature_C as number) - min_C) / span);
              return { ...room, temperatureColorCss: thermalColorToCss(c) };
            })
          : canonicalModel.rooms;
        labelsRoot.add(buildRoomFloorLabelGroup(roomsForLabels, model.rooms, roomLabelById));
      }
      if (levelElevationLabels.length > 0) {
        labelsRoot.add(buildLevelElevationLabelGroup(levelElevationLabels));
      }

      const roomTempById = new Map(
        canonicalModel.rooms
          .filter((r) => Number.isFinite(r.temperature_C))
          .map((r) => [r.id, r.temperature_C as number])
      );

      canonicalModel.walls.forEach((wall) => {
        if (!viewer.showWalls) {
          return;
        }
        const baseWallMaterial =
          wallTemperatureEnabled && Number.isFinite(wall.temperature_C) && colorScale
            ? createWallTemperatureMaterial(wall.temperature_C as number, colorScale, viewer.transparentWalls)
            : wallMaterial;
        const wallMeshMaterial = getSelectionMaterial(selection, "wall", wall.id, baseWallMaterial);
        const wallH = Math.max(wall.height_m, 2.4);
        const isExteriorWall =
          wall.adjacentRoomId === null || wall.temperatureSource === "thermalField.boundaries";
        const adjacentRoomTemp_C =
          wall.adjacentRoomId != null ? (roomTempById.get(wall.adjacentRoomId) ?? null) : null;
        addBoxBetween(
          shellRoot,
          wall.start,
          wall.end,
          Math.max(wall.thickness_m, 0.08),
          wallH,
          wall.elevation_m + wallH * 0.5,
          wallMeshMaterial,
          {
            name: `wall:${wall.id}`,
            userData: {
              category: "shell",
              sourceType: "wall",
              sourceId: wall.id,
              levelId: wall.levelId,
              temperature_C: wall.temperature_C,
              adjacentRoomId: wall.adjacentRoomId,
              adjacentRoomTemp_C,
              isExteriorWall,
              disposeMaterial: baseWallMaterial !== wallMaterial,
              selection: { kind: "wall", id: wall.id } satisfies Selection,
            },
          }
        );
        if (wallMeshMaterial !== baseWallMaterial && baseWallMaterial !== wallMaterial) {
          baseWallMaterial.dispose();
        }
      });

      if (viewer.showWalls) {
        canonicalModel.wallFillets.forEach((fillet) => {
          const filletMaterial =
            wallTemperatureEnabled && Number.isFinite(fillet.temperature_C) && colorScale
              ? createWallTemperatureMaterial(fillet.temperature_C as number, colorScale, viewer.transparentWalls)
              : wallMaterial;
          addWallFillet(shellRoot, fillet, filletMaterial, {
            name: `wall-fillet:${fillet.id}`,
            userData: {
              category: "shell",
              sourceType: "wall",
              levelId: fillet.levelId,
              disposeMaterial: filletMaterial !== wallMaterial,
            },
          });
        });
      }

      if (viewer.showOpenings) {
        canonicalModel.doors.forEach((door) =>
          shellRoot.add(createOpeningMesh(door, selection, temperatureEnabled, colorScale))
        );
        canonicalModel.windows.forEach((windowItem) =>
          shellRoot.add(createOpeningMesh(windowItem, selection, temperatureEnabled, colorScale))
        );
      }

      // Thermal coloring for roofs: exterior surface temperature per level
      const roofLevelAvgRoomTemp = new Map<string, number>();
      if (temperatureEnabled && colorScale) {
        const tempsByLevel = new Map<string, number[]>();
        canonicalModel.rooms.forEach((room) => {
          if (!Number.isFinite(room.temperature_C)) return;
          const arr = tempsByLevel.get(room.levelId) ?? [];
          arr.push(room.temperature_C as number);
          tempsByLevel.set(room.levelId, arr);
        });
        tempsByLevel.forEach((temps, levelId) => {
          roofLevelAvgRoomTemp.set(levelId, temps.reduce((s, t) => s + t, 0) / temps.length);
        });
      }
      const sceneOutdoorTempC = thermalField?.outdoorTemperatureC ?? null;

      canonicalModel.roofs.forEach((roof) => {
        if (shellPlanBoundary.length >= 3 && getSurfaceShellIntersectionRatio(roof.boundary, shellPlanBoundary) < 0.7) {
          warnShiftedTemperatureSurface({ id: roof.id, levelId: roof.levelId, sourceType: "roof" });
          if (DEBUG_3D_OVERLAY_DIAGNOSTICS) {
            console.warn("[canonical-3d] skipped shifted roof surface", { id: roof.id, levelId: roof.levelId });
          }
          return;
        }

        // Compute roof exterior surface temperature (heavily outdoor-biased for well-insulated roof)
        let roofThermalMat: THREE.MeshStandardMaterial | null = null;
        let roofSurfaceTemp: number | null = null;
        if (temperatureEnabled && colorScale) {
          const roomTemp = roofLevelAvgRoomTemp.get(roof.levelId) ?? null;
          if (roomTemp !== null) {
            roofSurfaceTemp = sceneOutdoorTempC !== null
              ? sceneOutdoorTempC + 0.08 * (roomTemp - sceneOutdoorTempC)
              : roomTemp;
            roofThermalMat = createWallTemperatureMaterial(roofSurfaceTemp, colorScale, false);
          }
        }

        const defaultMat = roof.kind === "pitched" ? ROOF_PITCHED_MATERIAL : ROOF_FLAT_MATERIAL;
        const baseMat = roofThermalMat ?? defaultMat;
        const finalRoofMat = getSelectionMaterial(selection, "roof", roof.id, baseMat);
        if (finalRoofMat !== baseMat && roofThermalMat) {
          roofThermalMat.dispose();
          roofThermalMat = null;
        }
        const disposeRoofMat = roofThermalMat !== null && finalRoofMat === roofThermalMat;

        const identity = {
          category: "roof" as const,
          sourceType: "roof" as const,
          sourceId: roof.id,
          levelId: roof.levelId,
          temperature_C: roofSurfaceTemp,
          disposeMaterial: disposeRoofMat,
          selection: { kind: "roof", id: roof.id } satisfies Selection,
        };

        if (roof.kind === "pitched" && roof.slope) {
          // Скатная крыша — вальмовая геометрия
          const mesh = buildPitchedRoofMesh(roof.boundary, roof.elevation_m, roof.slope, finalRoofMat);
          setMeshIdentity(mesh, `roof:${roof.id}`, identity);
          shellRoot.add(mesh);
        } else {
          // Плоская крыша — экструзия-плита
          const shape = buildShape(roof.boundary);
          if (!shape) {
            if (disposeRoofMat && roofThermalMat) roofThermalMat.dispose();
            return;
          }
          const roofDepth = Math.max(roof.thickness_m, 0.05);
          const geometry = new THREE.ExtrudeGeometry(shape, { depth: roofDepth, bevelEnabled: false });
          const mesh = new THREE.Mesh(geometry, finalRoofMat);
          mesh.rotation.x = Math.PI / 2;
          mesh.position.y = roof.elevation_m + roofDepth;
          setMeshIdentity(mesh, `roof:${roof.id}`, identity);
          shellRoot.add(mesh);
        }
      });

      canonicalModel.slabs.forEach((slab) => {
        if (shellPlanBoundary.length >= 3 && getSurfaceShellIntersectionRatio(slab.boundary, shellPlanBoundary) < 0.7) {
          warnShiftedTemperatureSurface({ id: slab.id, levelId: slab.levelId, sourceType: "slab" });
          if (DEBUG_3D_OVERLAY_DIAGNOSTICS) {
            console.warn("[canonical-3d] skipped shifted slab surface", { id: slab.id, levelId: slab.levelId });
          }
          return;
        }
        const shape = buildShape(slab.boundary);
        if (!shape) {
          return;
        }
        const slabDepth = Math.max(slab.thickness_m, 0.05);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: slabDepth, bevelEnabled: false });
        const mesh = new THREE.Mesh(geometry, getSelectionMaterial(selection, "slab", slab.id, SLAB_MATERIAL));
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = slab.elevation_m + slabDepth;
        setMeshIdentity(mesh, `slab:${slab.id}`, {
          category: "slab",
          sourceType: "slab",
          sourceId: slab.id,
          levelId: slab.levelId,
          selection: { kind: "slab", id: slab.id } satisfies Selection,
        });
        shellRoot.add(mesh);
      });

      canonicalModel.stairs.forEach((stair) => {
        if (stair.boundary.length < 4 || stair.stepCount < 1) return;
        const xs = stair.boundary.map((p) => p.x);
        const ys = stair.boundary.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const footW = maxX - minX;
        const footD = maxY - minY;
        const n = Math.max(1, stair.stepCount);
        const stepH = stair.totalRise_m / n;
        const stepD = footD / n;
        for (let i = 0; i < n; i++) {
          const geo = new THREE.BoxGeometry(footW, stepH * (i + 1), stepD);
          const stepMesh = new THREE.Mesh(geo, getSelectionMaterial(selection, "stair", stair.id, STAIR_MATERIAL));
          stepMesh.position.set(
            (minX + maxX) / 2,
            stair.elevation_m + stepH * (i + 1) / 2,
            minY + stepD * i + stepD / 2
          );
          setMeshIdentity(stepMesh, `stair:${stair.id}:step:${i}`, {
            category: "stair",
            sourceType: "stair",
            sourceId: stair.id,
            levelId: stair.levelId,
            selection: { kind: "stair", id: stair.id } satisfies Selection,
          });
          shellRoot.add(stepMesh);
        }
      });

      if (viewer.showNetworks) {
        canonicalModel.pipes.forEach((pipe) => {
          pipe.path.slice(1).forEach((point, index) => {
            const start = pipe.path[index];
            addCylinderBetween(
              systemsRoot,
              new THREE.Vector3(start.x, start.y, start.z),
              new THREE.Vector3(point.x, point.y, point.z),
              Math.max(pipe.diameter_m * 0.5, 0.014),
              pipe.colorRole === "return" ? RETURN_MATERIAL : SUPPLY_MATERIAL,
              {
                name: `pipe:${pipe.id}:segment:${index}`,
                userData: {
                  category: "network",
                  sourceType: "pipe",
                  sourceId: pipe.id,
                  colorRole: pipe.colorRole,
                },
              }
            );
          });
        });
        canonicalModel.ducts.forEach((duct) => {
          duct.path.slice(1).forEach((point, index) => {
            const start = duct.path[index];
            addBoxBetween(
              systemsRoot,
              { x: start.x, y: start.z },
              { x: point.x, y: point.z },
              duct.width_m,
              duct.height_m,
              start.y,
              DUCT_MATERIAL,
              {
                name: `duct:${duct.id}:segment:${index}`,
                userData: {
                  category: "network",
                  sourceType: "duct",
                  sourceId: duct.id,
                },
              }
            );
          });
        });
      }

      if (viewer.showEquipment) {
        canonicalModel.equipment.forEach((item) => {
          systemsRoot.add(buildSimpleEquipmentMesh(item, selection));
        });
        canonicalModel.sensors.forEach((sensor) => {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.08, 0.05),
            getSelectionMaterial(selection, "sensor", sensor.id, SENSOR_MATERIAL)
          );
          mesh.position.set(sensor.position.x, sensor.position.y, sensor.position.z);
          setMeshIdentity(mesh, `sensor:${sensor.id}`, {
            category: "sensor",
            sourceType: "sensor",
            sourceId: sensor.id,
            levelId: sensor.levelId,
            selection: { kind: "sensor", id: sensor.id } satisfies Selection,
          });
          systemsRoot.add(mesh);
        });
      }

      const surfaceFieldOverlayActive = showSurfaceField || showHeatSources || showThermalBridges;
      const surfaceFieldXRay = surfaceFieldOverlayActive && !viewer.transparentWalls;
      let surfaceFieldDebugInfo: BuildSurfaceFieldDebugInfo | null = null;
      if (surfaceField && surfaceFieldOverlayActive) {
        const overlayGroup = buildSurfaceFieldOverlayGroup(surfaceField, {
          mode: surfaceFieldMode,
          showSurfaceField,
          showHeatSources,
          showThermalBridges,
          roomLabelById,
          xRay: surfaceFieldXRay,
          overlayOpacity: surfaceFieldOpacity,
        });
        thermalRoot.add(overlayGroup);
        const stats = countOverlayObjects(overlayGroup);
        surfaceFieldDebugInfo = {
          overlayEnabled: true,
          showSurfaceField,
          showHeatSources,
          showThermalBridges,
          xRay: surfaceFieldXRay,
          mode: surfaceFieldMode,
          surfaces: surfaceField.surfaces.length,
          patches: surfaceField.patches.length,
          heatSources: surfaceField.heatSources.length,
          thermalBridges: surfaceField.thermalBridges.length,
          groupChildren: overlayGroup.children.length,
          meshCount: stats.meshCount,
          lineCount: stats.lineCount,
          thermalRootChildren: thermalRoot.children.length,
          sceneHasSurfaceFieldGroup: thermalRoot.children.includes(overlayGroup),
          bounds: extractObjectBounds(overlayGroup),
        };
      } else {
        surfaceFieldDebugInfo = {
          overlayEnabled: false,
          showSurfaceField,
          showHeatSources,
          showThermalBridges,
          xRay: false,
          mode: surfaceFieldMode,
          surfaces: surfaceField?.surfaces.length ?? 0,
          patches: surfaceField?.patches.length ?? 0,
          heatSources: surfaceField?.heatSources.length ?? 0,
          thermalBridges: surfaceField?.thermalBridges.length ?? 0,
          groupChildren: 0,
          meshCount: 0,
          lineCount: 0,
          thermalRootChildren: thermalRoot.children.length,
          sceneHasSurfaceFieldGroup: false,
          bounds: null,
          reason: !surfaceField
            ? "no surfaceFieldResult"
            : surfaceFieldOverlayActive
              ? "overlay group produced no meshes"
              : "surface field toggles disabled",
        };
      }
      onSurfaceFieldDebugRef.current?.(surfaceFieldDebugInfo);
      if (surfaceFieldDebugInfo && DEBUG_3D_OVERLAY_DIAGNOSTICS) {
        console.debug("[surface-field-overlay]", surfaceFieldDebugInfo);
      }

      const fitRoot = getFitRoot(shellRoot, content);
      const bounds = fitRoot ? extractBoundsFromObject(fitRoot) : null;
      if (bounds) {
        const gridLayout = calculateGridLayoutForBounds(bounds);
        grid.position.set(gridLayout.position.x, gridLayout.position.y, gridLayout.position.z);
        grid.scale.set(Math.max(gridLayout.size / 20, 1), 1, Math.max(gridLayout.size / 20, 1));

        // Подгоняем фрустум теневой камеры под реальные размеры модели
        const sunLight = sunLightRef.current;
        if (sunLight) {
          const half = Math.max(bounds.maxDim * 0.7, 25);
          sunLight.shadow.camera.left = -half;
          sunLight.shadow.camera.right = half;
          sunLight.shadow.camera.top = half;
          sunLight.shadow.camera.bottom = -half;
          sunLight.shadow.camera.far = half * 4 + 30;
          sunLight.shadow.camera.updateProjectionMatrix();
        }
      }

      const modelKey = [
        canonicalModel.levelId ?? "all-levels",
        canonicalModel.rooms.length,
        canonicalModel.walls.length,
        canonicalModel.windows.length,
        canonicalModel.doors.length,
        canonicalModel.roofs.length,
        canonicalModel.slabs.length,
        canonicalModel.pipes.length,
        canonicalModel.ducts.length,
        canonicalModel.equipment.length,
        canonicalModel.sensors.length,
        viewer.showRooms ? 1 : 0,
        viewer.showWalls ? 1 : 0,
        viewer.showOpenings ? 1 : 0,
        viewer.showNetworks ? 1 : 0,
        viewer.showEquipment ? 1 : 0,
      ].join(":");
      if (lastModelKeyRef.current !== modelKey) {
        lastModelKeyRef.current = modelKey;
        hasInitialFitRef.current = false;
      }
      if (!hasInitialFitRef.current && bounds) {
        scheduleInitialFit();
      }

      // Тени + архитектурные контурные рёбра на всей оболочке
      shellRoot.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const cat = mesh.userData?.category as string | undefined;
        const isShellSolid = cat === "shell" || cat === "roof" || cat === "slab";
        if (!isShellSolid || !mesh.geometry) return;
        // Не дублируем рёбра для уже обработанных мешей
        if (mesh.children.some((c) => c.name.startsWith("edges:"))) return;

        const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 18);
        const linesMat = new THREE.LineBasicMaterial({
          color: 0x334155,
          transparent: true,
          opacity: 0.22,
        });
        const lines = new THREE.LineSegments(edgesGeo, linesMat);
        lines.name = `edges:${mesh.name}`;
        lines.renderOrder = mesh.renderOrder + 1;
        mesh.add(lines);
      });

      renderCurrentScene();
    }, [
      canonicalModel,
      model.rooms,
      levelElevationLabels,
      roomLabelById,
      selection,
      showHeatSources,
      showSurfaceField,
      showThermalBridges,
      surfaceField,
      surfaceFieldMode,
      surfaceFieldOpacity,
      viewer,
      temperatureEnabled,
      temperatureColorScale,
      wallTemperatureEnabled,
    ]);

    useEffect(() => {
      const shellRoot = shellRootRef.current;
      if (!shellRoot) {
        return;
      }
      const removeTemperatureMeshes = () => {
        shellRoot.children
          .filter((child) => {
            const name = child.name ?? "";
            const cat = child.userData?.category as string | undefined;
            return (
              name.startsWith("temperature:") ||
              cat === "temperature-floor" ||
              cat === "temperature-slab" ||
              cat === "wall-thermal-gradient" ||
              cat === "window-thermal-edges" ||
              cat === "window-face-gradient" ||
              cat === "roof-thermal-gradient"
            );
          })
          .forEach((child) => {
            shellRoot.remove(child);
            disposeNode(child);
          });
      };
      removeTemperatureMeshes();
      if (!viewer.showRooms || !temperatureEnabled || !temperatureColorScale) {
        renderCurrentScene();
        return;
      }
      const shellPlanBoundary = collectCanonicalShellPlanPoints(canonicalModel);
      canonicalModel.temperatureSurfaces.forEach((surface) => {
        const shellGuardApplies =
          surface.sourceType === "shell-fallback" &&
          shellPlanBoundary.length >= 3 &&
          getSurfaceShellIntersectionRatio(surface.boundary, shellPlanBoundary) < 0.7;
        if (shellGuardApplies) {
          return;
        }
        if (thermalField && surface.sourceType === "room") {
          addRoomFloorThermalMesh(shellRoot, surface, thermalField, temperatureColorScale, levelAdjacency);
          return;
        }
        const shape = buildShape(surface.boundary);
        if (!shape) {
          return;
        }
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: false });
        const baseMaterial = createRoomTemperatureMaterial(surface.temperature_C, temperatureColorScale);
        const mesh = new THREE.Mesh(geometry, baseMaterial);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = surface.elevation_m + 0.028 + 0.018;
        mesh.renderOrder = 2;
        setMeshIdentity(mesh, `temperature:room:${surface.id}`, {
          category: "temperature-floor",
          sourceType: surface.sourceType,
          sourceId: surface.roomId ?? surface.id,
          levelId: surface.levelId,
          temperature_C: surface.temperature_C,
          geometrySource: surface.geometrySource,
          warning: surface.warning,
          disposeMaterial: true,
        });
        shellRoot.add(mesh);
      });
      if (thermalField) {
        interfloorSlabs.forEach((slab) => {
          if (shellPlanBoundary.length >= 3 && getSurfaceShellIntersectionRatio(slab.boundary, shellPlanBoundary) < 0.7) {
            return;
          }
          addInterfloorSlabThermalMeshes(shellRoot, slab, thermalField, temperatureColorScale, levelAdjacency);
        });
      }

      // Physics-based wall thermal meshes (stratification + corner bridges + frame bridges)
      if (wallTemperatureEnabled && viewer.showWalls) {
        // Build endpoint → wallId[] map for corner adjacency (5cm tolerance grid)
        const ptKey = (v: Vec2) => `${Math.round(v.x * 20)}_${Math.round(v.y * 20)}`;
        const endpointWalls = new Map<string, string[]>();
        const wallById = new Map(canonicalModel.walls.map((w) => [w.id, w]));
        canonicalModel.walls.forEach((w) => {
          const sk = ptKey(w.start);
          const ek = ptKey(w.end);
          endpointWalls.set(sk, [...(endpointWalls.get(sk) ?? []), w.id]);
          endpointWalls.set(ek, [...(endpointWalls.get(ek) ?? []), w.id]);
        });
        const isWallExterior = (w: (typeof canonicalModel.walls)[number]) =>
          w.adjacentRoomId === null || w.temperatureSource === "thermalField.boundaries";

        const getCornerCooling = (wallId: string, pt: Vec2): number => {
          const wall = wallById.get(wallId);
          if (!wall) return 0;
          const thisExt = isWallExterior(wall);
          const neighbors = (endpointWalls.get(ptKey(pt)) ?? []).filter((id) => id !== wallId);
          let cooling = neighbors.length === 0 ? 0.3 : 0;
          for (const nId of neighbors) {
            const nb = wallById.get(nId);
            if (!nb) continue;
            const nbExt = isWallExterior(nb);
            const c = thisExt && nbExt ? 3.2 : thisExt || nbExt ? 1.6 : 0.5;
            cooling = Math.max(cooling, c);
          }
          return cooling;
        };

        // Adjacent room temperature at each wall endpoint — drives horizontal gradient.
        // Collects room temps from all walls meeting at that corner, returns their average.
        const roomTempByIdOverlay = new Map(
          canonicalModel.rooms
            .filter((r) => Number.isFinite(r.temperature_C))
            .map((r) => [r.id, r.temperature_C as number])
        );
        const getCornerRoomTemp = (pt: Vec2, excludeWallId: string): number | null => {
          const neighbors = (endpointWalls.get(ptKey(pt)) ?? []).filter((id) => id !== excludeWallId);
          const temps: number[] = [];
          for (const nId of neighbors) {
            const nb = wallById.get(nId);
            if (!nb?.adjacentRoomId) continue;
            const t = roomTempByIdOverlay.get(nb.adjacentRoomId);
            if (typeof t === "number") temps.push(t);
          }
          // Also check this wall's own adjacent room
          const ownWall = wallById.get(excludeWallId);
          if (ownWall?.adjacentRoomId) {
            const t = roomTempByIdOverlay.get(ownWall.adjacentRoomId);
            if (typeof t === "number") temps.push(t);
          }
          if (temps.length === 0) return null;
          return temps.reduce((a, b) => a + b, 0) / temps.length;
        };

        // Build openings-per-wall lookup
        const openingsByWallId = new Map<string, CanonicalOpeningModel[]>();
        [...canonicalModel.windows, ...canonicalModel.doors].forEach((op) => {
          const arr = openingsByWallId.get(op.wallId) ?? [];
          arr.push(op);
          openingsByWallId.set(op.wallId, arr);
        });

        canonicalModel.walls.forEach((wall) => {
          if (!Number.isFinite(wall.temperature_C)) return;
          const wallDx = wall.end.x - wall.start.x;
          const wallDz = wall.end.y - wall.start.y;
          const wallLen = Math.sqrt(wallDx * wallDx + wallDz * wallDz);
          const wallHeight = Math.max(wall.height_m, 2.4);
          if (wallLen < 0.05) return;

          // Project each opening centre onto this wall's u-axis
          const openingInfos: WallOpeningInfo[] = (openingsByWallId.get(wall.id) ?? [])
            .filter((op) => Number.isFinite(op.temperature_C))
            .map((op): WallOpeningInfo => {
              const dx = op.center.x - wall.start.x;
              const dz = op.center.z - wall.start.y;
              const projLen = (dx * wallDx + dz * wallDz) / wallLen;
              return {
                uNorm: projLen / wallLen,
                vCenterNorm: (op.center.y - wall.elevation_m) / wallHeight,
                uHalfNorm: op.width_m / 2 / wallLen,
                vHalfNorm: op.height_m / 2 / wallHeight,
              };
            });

          addWallThermalMesh(
            shellRoot,
            {
              id: wall.id,
              start: wall.start,
              end: wall.end,
              elevation_m: wall.elevation_m,
              height_m: wall.height_m,
              temperature_C: wall.temperature_C as number,
            },
            openingInfos,
            getCornerCooling(wall.id, wall.start),
            getCornerCooling(wall.id, wall.end),
            temperatureColorScale,
            isWallExterior(wall),
            getCornerRoomTemp(wall.start, wall.id),
            getCornerRoomTemp(wall.end, wall.id)
          );
        });
      }

      // Coloured edge frames + inner face gradients for thermally-highlighted openings
      if (viewer.showOpenings) {
        [...canonicalModel.windows, ...canonicalModel.doors].forEach((opening) => {
          if (!Number.isFinite(opening.temperature_C)) return;
          addWindowThermalEdges(shellRoot, opening, temperatureColorScale);
          addWindowFaceThermalMesh(shellRoot, opening, temperatureColorScale);
        });
      }

      // Flat-roof thermal gradient overlays
      if (thermalField) {
        const roofTempsByLevel = new Map<string, number[]>();
        canonicalModel.rooms.forEach((room) => {
          if (!Number.isFinite(room.temperature_C)) return;
          const arr = roofTempsByLevel.get(room.levelId) ?? [];
          arr.push(room.temperature_C as number);
          roofTempsByLevel.set(room.levelId, arr);
        });
        const outdoorC = thermalField.outdoorTemperatureC;
        canonicalModel.roofs
          .filter((r) => r.kind === "flat")
          .forEach((roof) => {
            const roomTemps = roofTempsByLevel.get(roof.levelId) ?? [];
            if (roomTemps.length === 0) return;
            const roomAvg = roomTemps.reduce((s, t) => s + t, 0) / roomTemps.length;
            const baseTemp = outdoorC != null
              ? outdoorC + 0.08 * (roomAvg - outdoorC)
              : roomAvg;
            addRoofThermalMesh(shellRoot, roof, baseTemp, temperatureColorScale);
          });
      }

      renderCurrentScene();
    }, [
      canonicalModel,
      interfloorSlabs,
      levelAdjacency,
      temperatureColorScale,
      temperatureEnabled,
      thermalField,
      viewer.showRooms,
      viewer.showWalls,
      viewer.showOpenings,
      wallTemperatureEnabled,
    ]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        getCanvas: () => canvasRef.current,
        focusModel: () => fitToModel("focus", true),
        resetView: () => {
          const homeView = homeViewRef.current;
          if (homeView) {
            applyCameraFrame(homeView, false);
            return;
          }
          fitToModel("focus", true);
        },
        topView: () => fitToModel("top", false),
        zoomToFit: () => fitToModel("focus", true),
        setTopView: () => fitToModel("top", false),
        focusSelection: () => fitToModel("focus", false),
      }),
      [canonicalModel.levelId]
    );

    const partialTemperatureWarning =
      temperatureEnabled &&
      canonicalModel.temperatureSummary?.warnings.find((warning) =>
        /оболочк|построен по плану|отключен/i.test(warning)
      );

    return (
      <div className="relative h-full w-full overflow-hidden touch-none">
        <canvas ref={canvasRef} className="block h-full w-full touch-none overscroll-contain" />
        {!suppressTemperatureSummaryOverlay &&
        temperatureEnabled &&
        temperatureColorScale &&
        (coloredRoomFloorCount > 0 ||
          coloredWallCount > 0 ||
          coloredInterfloorSlabCount > 0 ||
          coloredWindowCount > 0 ||
          coloredDoorCount > 0) ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[15rem]">
            <ThermalFieldLegend
              title="Температурное поле"
              minC={temperatureColorScale.min_C}
              maxC={temperatureColorScale.max_C}
              avgC={temperatureColorScale.average_C}
              gradientCss={thermalGradientCss()}
              source={[
                coloredRoomFloorCount > 0 ? `пол ${coloredRoomFloorCount}` : "",
                coloredInterfloorSlabCount > 0 ? `плиты ${coloredInterfloorSlabCount}` : "",
                coloredWallCount > 0 ? `стены ${coloredWallCount}` : "",
                coloredWindowCount > 0 ? `окна ${coloredWindowCount}` : "",
                coloredDoorCount > 0 ? `двери ${coloredDoorCount}` : "",
                thermalField?.outdoorTemperatureC != null
                  ? `наружн. ${thermalField.outdoorTemperatureC.toFixed(1)} °C`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              warnings={partialTemperatureWarning ? [partialTemperatureWarning] : undefined}
              thresholds={
                temperatureColorScale.min_C < 0 && temperatureColorScale.max_C > 0
                  ? [{ value_C: 0, label: "0 °C — граница замерзания", color: "rgba(255,255,255,0.90)" }]
                  : undefined
              }
            />
          </div>
        ) : null}
      </div>
    );
  }
);

Build3DCanonicalPreview.displayName = "Build3DCanonicalPreview";

export default Build3DCanonicalPreview;
