import {
  pointToSegmentDistance,
  polygonArea,
  polygonContainsPoint,
  polygonCentroid,
  segmentLength,
} from "../../entities/geometry/geom";
import type { BuildingModel, FloorSlab, Roof, Vec2, Vec3, Wall } from "../../entities/geometry/types";
import { computeWallProperties } from "../../entities/material/types";
import {
  DEFAULT_DOOR_U_W_M2K,
  DEFAULT_WINDOW_U_W_M2K,
} from "./wallFacadeThermal";
import {
  buildGeometryRenderModel,
  type GeometryRenderModel,
  type OpeningCutDescriptor,
  type RoomVolumeDescriptor,
} from "../geometry/bimPipeline";
import { getDefaultSurfaceResistanceProfile } from "../../norms/sp50_2024/heatTransferCoefficients";
import {
  buildThermalPhysicsModel,
  type ThermalPhysicsModel,
  type ThermalPhysicsOptions,
  type ThermalSurfaceEstimate,
} from "./physics";
import type { ThermalFieldModel } from "./field";
import { dewPointMagnusC, internalSurfaceTemperatureC } from "./formulas";

const DEFAULT_PATCH_SIZE_M = 0.42;
const MIN_PATCH_SIZE_M = 0.18;
const MAX_PATCH_SIZE_M = 0.72;
const DEFAULT_OVERLAY_OFFSET_M = 0.012;
const DEFAULT_INDOOR_RH = 0.45;
const DEFAULT_CONVECTIVE_H_W_M2K = 3.1;
const DEFAULT_INTERNAL_SURFACE_RESISTANCE = getDefaultSurfaceResistanceProfile().internal_m2K_W;
const DEFAULT_EXTERNAL_SURFACE_RESISTANCE = getDefaultSurfaceResistanceProfile().external_m2K_W;
const DEFAULT_INTERNAL_COUPLING_SURFACE_RESISTANCE = 0.17;
const DEFAULT_WINDOW_REVEAL_RADIUS_M = 0.42;
const DEFAULT_CORNER_RADIUS_M = 0.28;
const DEFAULT_PERIMETER_RADIUS_M = 0.36;
const DEFAULT_ROOM_MEAN_RADIATIVE_COUPLING = 0.11;
const DEFAULT_NEUTRAL_FLOOR_OFFSET_C = 0.4;
const DEFAULT_NEUTRAL_CEILING_OFFSET_C = 0.25;
const DEFAULT_GROUND_OFFSET_C = 4;

export type SurfaceFieldSurfaceKind =
  | "wall"
  | "floor"
  | "ceiling"
  | "window"
  | "door";

export type SurfaceFieldBoundaryType = "external" | "internal" | "neutral";
export type SurfaceFieldRenderMode = "surfaceTemperature" | "heatFlux" | "heatLoss" | "condensationRisk";
export type SurfaceHeatSourceKind = "radiator" | "pipe" | "floorHeating" | "equipment";
export type SurfaceHeatFalloffType = "exponential" | "gaussian";
export type SurfaceThermalBridgeKind =
  | "windowReveal"
  | "corner"
  | "wallFloorJunction"
  | "perimeter"
  | "thermalBridge";

export interface SurfaceHeatSource {
  id: string;
  kind: SurfaceHeatSourceKind;
  levelId: string;
  roomId: string | null;
  totalPowerW: number;
  convectiveFraction: number;
  radiativeFraction: number;
  position: Vec3;
  orientation?: Vec3;
  influenceRadiusM: number;
  falloffType: SurfaceHeatFalloffType;
  segment?: { start: Vec3; end: Vec3 };
  metadata?: Record<string, unknown>;
}

export interface SurfaceThermalBridgeZone {
  id: string;
  kind: SurfaceThermalBridgeKind;
  levelId: string;
  roomId: string | null;
  influenceRadiusM: number;
  temperaturePenaltyC: number;
  position?: Vec3;
  segment?: { start: Vec3; end: Vec3 };
  metadata?: Record<string, unknown>;
}

export interface SurfaceFieldPatch {
  id: string;
  roomId: string;
  levelId: string;
  surfaceId: string;
  surfaceKind: SurfaceFieldSurfaceKind;
  boundaryType: SurfaceFieldBoundaryType;
  row: number;
  column: number;
  localCenter: Vec2;
  center: Vec3;
  corners: [Vec3, Vec3, Vec3, Vec3];
  cornerTemperaturesC: [number, number, number, number];
  patchTemperatureC: number;
  patchHeatFluxWm2: number;
  patchHeatLossW: number;
  condensationRisk: boolean;
  condensationMarginC: number;
  areaM2: number;
  sourceDeltaC: number;
  coldPenaltyC: number;
  sourceIds: string[];
  bridgeIds: string[];
}

export interface SurfaceFieldSurface {
  id: string;
  roomId: string;
  levelId: string;
  kind: SurfaceFieldSurfaceKind;
  boundaryType: SurfaceFieldBoundaryType;
  sourceId: string | null;
  sourceType: "wall" | "roof" | "slab" | "opening" | "room";
  baseTemperatureC: number;
  airTemperatureC: number;
  boundaryTemperatureC: number;
  widthM: number;
  heightM: number;
  areaM2: number;
  rows: number;
  columns: number;
  patchIds: string[];
  normal: Vec3;
  uAxis: Vec3;
  vAxis: Vec3;
  origin: Vec3;
  centroid: Vec3;
  minTemperatureC: number;
  maxTemperatureC: number;
  avgTemperatureC: number;
}

export interface SurfaceFieldRoomDiagnostic {
  roomId: string;
  levelId: string;
  airTemperatureC: number;
  meanRadiantTemperatureC: number;
  minSurfaceTempC: number;
  maxSurfaceTempC: number;
  avgSurfaceTempC: number;
  dewPointC: number;
  condensationRisk: boolean;
  coldestPatchId: string | null;
  hottestPatchId: string | null;
}

export interface SurfaceFieldResult {
  roomId: string | null;
  surfaces: SurfaceFieldSurface[];
  patches: SurfaceFieldPatch[];
  heatSources: SurfaceHeatSource[];
  thermalBridges: SurfaceThermalBridgeZone[];
  roomDiagnostics: SurfaceFieldRoomDiagnostic[];
  roomDiagnosticsByRoomId: Map<string, SurfaceFieldRoomDiagnostic>;
  surfaceMap: Map<string, SurfaceFieldSurface>;
  patchMap: Map<string, SurfaceFieldPatch>;
  minSurfaceTempC: number;
  maxSurfaceTempC: number;
  avgSurfaceTempC: number;
  assumptions: string[];
  warnings: string[];
}

export interface BuildSurfaceFieldInput {
  model: BuildingModel;
  activeLevelId?: string | null;
  roomIds?: string[] | null;
  outdoorTemperatureC: number;
  indoorRelativeHumidity?: number;
  patchSizeM?: number;
  overlayOffsetM?: number;
  renderGeometry?: GeometryRenderModel;
  thermalField?: ThermalFieldModel | null;
  physics?: ThermalPhysicsModel | null;
  roomAirTemperaturesC?: Record<string, number>;
  heatSources?: SurfaceHeatSource[];
  thermalBridges?: SurfaceThermalBridgeZone[];
}

interface SurfaceDescriptor {
  id: string;
  roomId: string;
  levelId: string;
  kind: SurfaceFieldSurfaceKind;
  boundaryType: SurfaceFieldBoundaryType;
  sourceId: string | null;
  sourceType: "wall" | "roof" | "slab" | "opening" | "room";
  airTemperatureC: number;
  boundaryTemperatureC: number;
  totalResistanceM2K_W: number;
  surfaceResistanceM2K_W: number;
  heatCapacity_J_m2K: number;
  areaM2: number;
  widthM: number;
  heightM: number;
  normal: Vec3;
  uAxis: Vec3;
  vAxis: Vec3;
  origin: Vec3;
  localPolygon: Vec2[];
  centroid: Vec3;
  baseTemperatureC: number;
}

interface SurfaceSample {
  temperatureC: number;
  sourceDeltaC: number;
  coldPenaltyC: number;
  sourceIds: string[];
  bridgeIds: string[];
}

interface MutablePatch {
  id: string;
  roomId: string;
  levelId: string;
  surfaceId: string;
  surfaceKind: SurfaceFieldSurfaceKind;
  boundaryType: SurfaceFieldBoundaryType;
  row: number;
  column: number;
  localCenter: Vec2;
  center: Vec3;
  corners: [Vec3, Vec3, Vec3, Vec3];
  cornerTemperaturesC: [number, number, number, number];
  patchTemperatureC: number;
  patchHeatFluxWm2: number;
  patchHeatLossW: number;
  condensationRisk: boolean;
  condensationMarginC: number;
  areaM2: number;
  sourceDeltaC: number;
  coldPenaltyC: number;
  sourceIds: string[];
  bridgeIds: string[];
}

export const SURFACE_FIELD_MODE_LABELS: Record<SurfaceFieldRenderMode, string> = {
  surfaceTemperature: "Температура поверхности",
  heatFlux: "Тепловой поток",
  heatLoss: "Потери тепла",
  condensationRisk: "Риск конденсации",
};

export const SURFACE_FIELD_MODE_UNITS: Record<SurfaceFieldRenderMode, string> = {
  surfaceTemperature: "°C",
  heatFlux: "Вт/м²",
  heatLoss: "Вт",
  condensationRisk: "%",
};

export function buildSurfaceFieldResult(input: BuildSurfaceFieldInput): SurfaceFieldResult {
  const warnings: string[] = [];
  const assumptions = [
    "Steady-state surface patch balance above the existing RC air-temperature solver.",
    "Room air temperature is inherited from the current thermal field / room balance, not recomputed by the surface layer.",
    "Radiative exchange is approximated by local source influence plus a room-mean radiant coupling term.",
    "Cold corners, reveals, and perimeter effects are modeled as correction masks rather than CFD.",
  ];

  const patchSizeM = clamp(input.patchSizeM ?? DEFAULT_PATCH_SIZE_M, MIN_PATCH_SIZE_M, MAX_PATCH_SIZE_M);
  const overlayOffsetM = Math.max(0.002, input.overlayOffsetM ?? DEFAULT_OVERLAY_OFFSET_M);
  const indoorRelativeHumidity = clamp(input.indoorRelativeHumidity ?? DEFAULT_INDOOR_RH, 0.15, 0.85);
  const renderGeometry = input.renderGeometry ?? input.thermalField?.renderGeometry ?? buildGeometryRenderModel(input.model);
  const roomAirTemperatures = buildRoomAirTemperatureMap(input, renderGeometry);
  const physics =
    input.physics ??
    input.thermalField?.physics ??
    buildThermalPhysicsModel(
      input.model,
      {
        outdoorTemperatureC: input.outdoorTemperatureC,
        fixedRoomTemperaturesC: Object.fromEntries(roomAirTemperatures),
      } satisfies ThermalPhysicsOptions,
      renderGeometry
    );

  warnings.push(...(physics.warnings ?? []));

  const levelElevationById = new Map(input.model.levels.map((level) => [level.id, level.elevation_m]));
  const levelHeightById = new Map(input.model.levels.map((level) => [level.id, level.height_m]));
  const roomVolumes = renderGeometry.roomVolumes.filter((room) => {
    if (input.activeLevelId && room.levelId !== input.activeLevelId) {
      return false;
    }
    if (input.roomIds?.length && !input.roomIds.includes(room.roomId)) {
      return false;
    }
    return true;
  });
  const roomVolumesById = new Map(roomVolumes.map((room) => [room.roomId, room]));
  const wallOpeningsByWallId = new Map(renderGeometry.walls.map((entry) => [entry.wall.id, entry.openings]));

  // Build heat sources using all room volumes (across all levels) so that pipe
  // room-ID resolution is correct even when activeLevelId filters surfaces to one level.
  const allHeatSources = [
    ...buildModelHeatSources(input.model, renderGeometry.roomVolumes, levelElevationById),
    ...(input.heatSources ?? []),
  ];

  // Level/room-filtered list for result metadata, legend, display markers, etc.
  const heatSources = allHeatSources.filter((source) => {
    if (input.activeLevelId && source.levelId !== input.activeLevelId) {
      return false;
    }
    if (input.roomIds?.length && source.roomId && !input.roomIds.includes(source.roomId)) {
      return false;
    }
    return true;
  });

  const thermalBridges = [
    ...buildBridgeZones({
      model: input.model,
      renderGeometry,
      physics,
      roomVolumes,
      wallOpeningsByWallId,
      levelElevationById,
      overlayOffsetM,
    }),
    ...(input.thermalBridges ?? []),
  ].filter((bridge) => {
    if (input.activeLevelId && bridge.levelId !== input.activeLevelId) {
      return false;
    }
    if (input.roomIds?.length && bridge.roomId && !input.roomIds.includes(bridge.roomId)) {
      return false;
    }
    return true;
  });

  const surfaceDescriptors = buildSurfaceDescriptors({
    model: input.model,
    renderGeometry,
    physics,
    roomVolumes,
    roomVolumesById,
    roomAirTemperatures,
    levelElevationById,
    levelHeightById,
    wallOpeningsByWallId,
    outdoorTemperatureC: input.outdoorTemperatureC,
    overlayOffsetM,
    warnings,
  });

  // Pass allHeatSources so sampleSurfaceAtPoint can apply inter-level effects on floor/ceiling.
  const mutablePatches = surfaceDescriptors.flatMap((surface) =>
    buildSurfacePatches(surface, patchSizeM, allHeatSources, thermalBridges, indoorRelativeHumidity)
  );

  const roomMeanSurfaceByRoomId = new Map<string, number>();
  roomVolumes.forEach((room) => {
    const roomPatches = mutablePatches.filter((patch) => patch.roomId === room.roomId);
    if (!roomPatches.length) {
      return;
    }
    const weighted = roomPatches.reduce(
      (acc, patch) => {
        acc.sum += patch.patchTemperatureC * patch.areaM2;
        acc.area += patch.areaM2;
        return acc;
      },
      { sum: 0, area: 0 }
    );
    if (weighted.area > 0) {
      roomMeanSurfaceByRoomId.set(room.roomId, weighted.sum / weighted.area);
    }
  });

  mutablePatches.forEach((patch) => {
    const roomMean = roomMeanSurfaceByRoomId.get(patch.roomId);
    if (!Number.isFinite(roomMean)) {
      return;
    }
    const couplingC = ((roomMean as number) - patch.patchTemperatureC) * DEFAULT_ROOM_MEAN_RADIATIVE_COUPLING;
    patch.patchTemperatureC += couplingC;
    patch.cornerTemperaturesC = patch.cornerTemperaturesC.map(
      (value) => value + couplingC
    ) as [number, number, number, number];
  });

  const surfaceById = new Map(surfaceDescriptors.map((surface) => [surface.id, surface]));
  const patchMap = new Map<string, SurfaceFieldPatch>();
  mutablePatches.forEach((patch) => {
    const surface = surfaceById.get(patch.surfaceId);
    if (!surface) {
      return;
    }
    const dewPointC = dewPointMagnusC(surface.airTemperatureC, indoorRelativeHumidity);
    patch.condensationMarginC = patch.patchTemperatureC - dewPointC;
    patch.condensationRisk = patch.condensationMarginC <= 0;
    patch.patchHeatFluxWm2 = computePatchHeatFluxWm2(surface, patch.patchTemperatureC);
    patch.patchHeatLossW = Math.max(patch.patchHeatFluxWm2, 0) * patch.areaM2;
    patchMap.set(patch.id, { ...patch });
  });

  const surfaces = surfaceDescriptors.map<SurfaceFieldSurface>((surface) => {
    const patches = [...patchMap.values()].filter((patch) => patch.surfaceId === surface.id);
    const temperatures = patches.map((patch) => patch.patchTemperatureC);
    return {
      id: surface.id,
      roomId: surface.roomId,
      levelId: surface.levelId,
      kind: surface.kind,
      boundaryType: surface.boundaryType,
      sourceId: surface.sourceId,
      sourceType: surface.sourceType,
      baseTemperatureC: surface.baseTemperatureC,
      airTemperatureC: surface.airTemperatureC,
      boundaryTemperatureC: surface.boundaryTemperatureC,
      widthM: surface.widthM,
      heightM: surface.heightM,
      areaM2: surface.areaM2,
      rows: Math.max(1, Math.round(surface.heightM / patchSizeM)),
      columns: Math.max(1, Math.round(surface.widthM / patchSizeM)),
      patchIds: patches.map((patch) => patch.id),
      normal: { ...surface.normal },
      uAxis: { ...surface.uAxis },
      vAxis: { ...surface.vAxis },
      origin: { ...surface.origin },
      centroid: { ...surface.centroid },
      minTemperatureC: temperatures.length ? Math.min(...temperatures) : surface.baseTemperatureC,
      maxTemperatureC: temperatures.length ? Math.max(...temperatures) : surface.baseTemperatureC,
      avgTemperatureC: temperatures.length
        ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
        : surface.baseTemperatureC,
    };
  });

  const roomDiagnostics = roomVolumes.map<SurfaceFieldRoomDiagnostic>((room) => {
    const roomPatches = [...patchMap.values()].filter((patch) => patch.roomId === room.roomId);
    const airTemperatureC = roomAirTemperatures.get(room.roomId) ?? 21;
    const dewPointC = dewPointMagnusC(airTemperatureC, indoorRelativeHumidity);
    if (!roomPatches.length) {
      return {
        roomId: room.roomId,
        levelId: room.levelId,
        airTemperatureC,
        meanRadiantTemperatureC: airTemperatureC,
        minSurfaceTempC: airTemperatureC,
        maxSurfaceTempC: airTemperatureC,
        avgSurfaceTempC: airTemperatureC,
        dewPointC,
        condensationRisk: false,
        coldestPatchId: null,
        hottestPatchId: null,
      };
    }
    const weighted = roomPatches.reduce(
      (acc, patch) => {
        acc.area += patch.areaM2;
        acc.weightedTemp += patch.patchTemperatureC * patch.areaM2;
        return acc;
      },
      { area: 0, weightedTemp: 0 }
    );
    const coldest = roomPatches.reduce((best, patch) => (patch.patchTemperatureC < best.patchTemperatureC ? patch : best), roomPatches[0]!);
    const hottest = roomPatches.reduce((best, patch) => (patch.patchTemperatureC > best.patchTemperatureC ? patch : best), roomPatches[0]!);
    const avgSurfaceTempC = weighted.area > 0 ? weighted.weightedTemp / weighted.area : airTemperatureC;
    return {
      roomId: room.roomId,
      levelId: room.levelId,
      airTemperatureC,
      meanRadiantTemperatureC: avgSurfaceTempC,
      minSurfaceTempC: coldest.patchTemperatureC,
      maxSurfaceTempC: hottest.patchTemperatureC,
      avgSurfaceTempC,
      dewPointC,
      condensationRisk: roomPatches.some((patch) => patch.condensationRisk),
      coldestPatchId: coldest.id,
      hottestPatchId: hottest.id,
    };
  });

  const roomDiagnosticsByRoomId = new Map(roomDiagnostics.map((entry) => [entry.roomId, entry]));
  const patches = [...patchMap.values()];
  const allTemperatures = patches.map((patch) => patch.patchTemperatureC);
  const avgSurfaceTempC = allTemperatures.length
    ? allTemperatures.reduce((sum, value) => sum + value, 0) / allTemperatures.length
    : 0;

  if (!surfaces.length) {
    warnings.push("Surface thermal field could not be generated because no room-bound surfaces were resolved.");
  }

  if (!heatSources.length) {
    assumptions.push("No active radiators / pipes / local equipment were mapped; only envelope-driven gradients are shown.");
  }

  // --- Flat-field diagnostics ---
  // Emit one summary warning when most surfaces are thermally flat (range < 0.2 °C).
  // Individual data rows are debug-logged in dev mode.
  const flatSurfaces = surfaces.filter(
    (s) => s.patchIds.length > 2 && (s.maxTemperatureC - s.minTemperatureC) < 0.2
  );
  if (flatSurfaces.length > 0 && flatSurfaces.length >= surfaces.length * 0.5) {
    warnings.push(
      `Thermal field appears flat on ${flatSurfaces.length}/${surfaces.length} surfaces (range < 0.2 °C). ` +
        "Verify that heat sources have correct levelId/roomId and that indoor temperature differs from outdoor."
    );
  }
  if (import.meta.env?.DEV) {
    // Debug table: kind | patches | min | max | avg | range | id
    surfaces.forEach((s) => {
      const range = s.maxTemperatureC - s.minTemperatureC;
      // eslint-disable-next-line no-console
      console.debug(
        `[SurfaceField] ${s.kind.padEnd(8)} patches=${String(s.patchIds.length).padStart(3)} ` +
          `min=${s.minTemperatureC.toFixed(2)} max=${s.maxTemperatureC.toFixed(2)} ` +
          `avg=${s.avgTemperatureC.toFixed(2)} range=${range.toFixed(3)}°C ` +
          `${range < 0.2 ? "⚠ FLAT" : ""}  id=${s.id}`
      );
    });
  }

  return {
    roomId: roomDiagnostics.length === 1 ? roomDiagnostics[0]?.roomId ?? null : null,
    surfaces,
    patches,
    heatSources,
    thermalBridges,
    roomDiagnostics,
    roomDiagnosticsByRoomId,
    surfaceMap: new Map(surfaces.map((surface) => [surface.id, surface])),
    patchMap,
    minSurfaceTempC: allTemperatures.length ? Math.min(...allTemperatures) : 0,
    maxSurfaceTempC: allTemperatures.length ? Math.max(...allTemperatures) : 0,
    avgSurfaceTempC,
    assumptions,
    warnings,
  };
}

export function getSurfaceFieldPatchValue(
  patch: Pick<SurfaceFieldPatch, "patchTemperatureC" | "patchHeatFluxWm2" | "patchHeatLossW" | "condensationMarginC">,
  mode: SurfaceFieldRenderMode
): number {
  switch (mode) {
    case "surfaceTemperature":
      return patch.patchTemperatureC;
    case "heatFlux":
      return patch.patchHeatFluxWm2;
    case "heatLoss":
      return patch.patchHeatLossW;
    case "condensationRisk":
      return clamp((-patch.condensationMarginC + 1.5) / 4, 0, 1);
    default:
      return patch.patchTemperatureC;
  }
}

export interface SurfaceFieldValueRange {
  /** Display minimum (P5 percentile for temperature modes, 0 for condensation). */
  min: number;
  /** Display maximum (P95 percentile for temperature modes, 1 for condensation). */
  max: number;
  /** Mean of all patch values (raw, not clamped). */
  average: number;
}

/**
 * Compute a stable display range using P5–P95 percentiles to prevent outliers
 * from washing out the colormap. Returns null when no patches exist.
 */
export function getSurfaceFieldValueRange(
  result: SurfaceFieldResult,
  mode: SurfaceFieldRenderMode,
): SurfaceFieldValueRange | null {
  if (!result.patches.length) {
    return null;
  }
  const values = result.patches.map((patch) => getSurfaceFieldPatchValue(patch, mode));
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;

  if (mode === "condensationRisk") {
    return { min: 0, max: 1, average };
  }

  // P5–P95 percentile range for stable colormap normalization
  const sorted = [...values].sort((a, b) => a - b);
  const p5 = sorted[Math.max(0, Math.floor(sorted.length * 0.05))];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];

  const MIN_VISUAL_RANGE = mode === "surfaceTemperature" ? 2.0 : Math.max(0.5, Math.abs(average) * 0.1);
  const spread = p95 - p5;

  if (spread < MIN_VISUAL_RANGE) {
    const center = (p5 + p95) * 0.5;
    return {
      min: center - MIN_VISUAL_RANGE * 0.5,
      max: center + MIN_VISUAL_RANGE * 0.5,
      average,
    };
  }
  return { min: p5, max: p95, average };
}

function buildRoomAirTemperatureMap(
  input: BuildSurfaceFieldInput,
  renderGeometry: GeometryRenderModel
): Map<string, number> {
  const map = new Map<string, number>();
  if (input.roomAirTemperaturesC) {
    Object.entries(input.roomAirTemperaturesC).forEach(([roomId, temperatureC]) => {
      if (Number.isFinite(temperatureC)) {
        map.set(roomId, temperatureC);
      }
    });
  }
  input.thermalField?.roomMap.forEach((room) => {
    if (Number.isFinite(room.baseTemperatureC)) {
      map.set(room.roomId, room.baseTemperatureC);
    }
  });
  input.physics?.roomBalances.forEach((balance) => {
    if (Number.isFinite(balance.airTemperatureC)) {
      map.set(balance.roomId, balance.airTemperatureC);
    }
  });
  renderGeometry.roomVolumes.forEach((room) => {
    if (!map.has(room.roomId)) {
      map.set(room.roomId, 21);
    }
  });
  return map;
}

function buildSurfaceDescriptors(args: {
  model: BuildingModel;
  renderGeometry: GeometryRenderModel;
  physics: ThermalPhysicsModel;
  roomVolumes: RoomVolumeDescriptor[];
  roomVolumesById: Map<string, RoomVolumeDescriptor>;
  roomAirTemperatures: Map<string, number>;
  levelElevationById: Map<string, number>;
  levelHeightById: Map<string, number>;
  wallOpeningsByWallId: Map<string, OpeningCutDescriptor[]>;
  outdoorTemperatureC: number;
  overlayOffsetM: number;
  warnings: string[];
}): SurfaceDescriptor[] {
  const descriptors: SurfaceDescriptor[] = [];
  const roomIds = new Set(args.roomVolumes.map((room) => room.roomId));

  args.physics.surfaces.forEach((surface) => {
    const openings = args.wallOpeningsByWallId.get(surface.wallId) ?? [];
    const wallDescriptors = buildWallSurfaceDescriptors({
      surface,
      openings,
      roomIds,
      roomAirTemperatures: args.roomAirTemperatures,
      levelElevationById: args.levelElevationById,
      overlayOffsetM: args.overlayOffsetM,
      warnings: args.warnings,
      outdoorTemperatureC: args.outdoorTemperatureC,
    });
    descriptors.push(...wallDescriptors);
  });

  args.roomVolumes.forEach((room) => {
    const floorDescriptor = buildHorizontalSurfaceDescriptor({
      room,
      roomAirTemperatures: args.roomAirTemperatures,
      levelElevationById: args.levelElevationById,
      levelHeightById: args.levelHeightById,
      slabs: args.renderGeometry.floorSlabs,
      roofs: args.renderGeometry.roofs,
      kind: "floor",
      outdoorTemperatureC: args.outdoorTemperatureC,
    });
    const ceilingDescriptor = buildHorizontalSurfaceDescriptor({
      room,
      roomAirTemperatures: args.roomAirTemperatures,
      levelElevationById: args.levelElevationById,
      levelHeightById: args.levelHeightById,
      slabs: args.renderGeometry.floorSlabs,
      roofs: args.renderGeometry.roofs,
      kind: "ceiling",
      outdoorTemperatureC: args.outdoorTemperatureC,
    });
    descriptors.push(floorDescriptor, ceilingDescriptor);
  });

  return descriptors;
}

function buildWallSurfaceDescriptors(args: {
  surface: ThermalSurfaceEstimate;
  openings: OpeningCutDescriptor[];
  roomIds: Set<string>;
  roomAirTemperatures: Map<string, number>;
  levelElevationById: Map<string, number>;
  overlayOffsetM: number;
  warnings: string[];
  outdoorTemperatureC: number;
}): SurfaceDescriptor[] {
  const descriptors: SurfaceDescriptor[] = [];
  const wall = args.surface.wall;
  const wallLengthM = segmentLength(wall.a, wall.b);
  if (wallLengthM <= 1e-6) {
    return descriptors;
  }
  const levelElevationM = args.levelElevationById.get(wall.levelId) ?? 0;
  const directionPlan = normalize2({
    x: wall.b.x - wall.a.x,
    y: wall.b.y - wall.a.y,
  });
  const normalPlan = { x: -directionPlan.y, y: directionPlan.x };
  const uAxis = normalize3({ x: directionPlan.x, y: 0, z: directionPlan.y });
  const vAxis = { x: 0, y: 1, z: 0 } satisfies Vec3;
  const baseWallStart = { x: wall.a.x, y: levelElevationM, z: wall.a.y } satisfies Vec3;
  const halfThickness = Math.max(wall.thickness_m * 0.5, 0.04);
  const totalResistance = Math.max(args.surface.effectiveR_m2K_W, DEFAULT_INTERNAL_SURFACE_RESISTANCE + DEFAULT_EXTERNAL_SURFACE_RESISTANCE + 0.12);

  const createDescriptorForRoom = (
    roomId: string | null,
    sideSign: 1 | -1,
    boundaryType: SurfaceFieldBoundaryType,
    boundaryTemperatureC: number
  ) => {
    if (!roomId || !args.roomIds.has(roomId)) {
      return;
    }
    const airTemperatureC = args.roomAirTemperatures.get(roomId) ?? 21;
    const roomOffset = {
      x: normalPlan.x * (halfThickness + args.overlayOffsetM) * sideSign,
      y: 0,
      z: normalPlan.y * (halfThickness + args.overlayOffsetM) * sideSign,
    } satisfies Vec3;
    const origin = addVec3(baseWallStart, roomOffset);
    const surfaceResistanceM2K_W =
      boundaryType === "internal" ? DEFAULT_INTERNAL_COUPLING_SURFACE_RESISTANCE : DEFAULT_INTERNAL_SURFACE_RESISTANCE;
    const effectiveResistance =
      boundaryType === "internal"
        ? Math.max(args.surface.effectiveR_m2K_W + DEFAULT_INTERNAL_COUPLING_SURFACE_RESISTANCE * 2, 0.24)
        : totalResistance;
    const baseTemperatureC =
      boundaryType === "internal"
        ? airTemperatureC -
          ((airTemperatureC - boundaryTemperatureC) * surfaceResistanceM2K_W) /
            Math.max(effectiveResistance, surfaceResistanceM2K_W + 0.01)
        : internalSurfaceTemperatureC(
            airTemperatureC,
            boundaryTemperatureC,
            surfaceResistanceM2K_W,
            Math.max(effectiveResistance, surfaceResistanceM2K_W + 0.01)
          );
    const centroid = localToWorld(
      origin,
      uAxis,
      vAxis,
      wallLengthM * 0.5,
      Math.max(wall.height_m * 0.5, 0.1)
    );
    descriptors.push({
      id: `surface:wall:${wall.id}:${roomId}`,
      roomId,
      levelId: wall.levelId,
      kind: "wall",
      boundaryType,
      sourceId: wall.id,
      sourceType: "wall",
      airTemperatureC,
      boundaryTemperatureC,
      totalResistanceM2K_W: Math.max(effectiveResistance, surfaceResistanceM2K_W + 0.02),
      surfaceResistanceM2K_W,
      heatCapacity_J_m2K: 95000,
      areaM2: Math.max(0.1, wallLengthM * Math.max(wall.height_m, 0.4)),
      widthM: wallLengthM,
      heightM: Math.max(wall.height_m, 0.4),
      normal: normalize3({
        x: normalPlan.x * sideSign,
        y: 0,
        z: normalPlan.y * sideSign,
      }),
      uAxis,
      vAxis,
      origin,
      localPolygon: [
        { x: 0, y: 0 },
        { x: wallLengthM, y: 0 },
        { x: wallLengthM, y: Math.max(wall.height_m, 0.4) },
        { x: 0, y: Math.max(wall.height_m, 0.4) },
      ],
      centroid,
      baseTemperatureC,
    });

    args.openings.forEach((opening) => {
      const openingOrigin = localToWorld(
        origin,
        uAxis,
        vAxis,
        opening.startOffsetM,
        opening.sillM ?? 0
      );
      const openingU = Math.max(
        0.5,
        opening.uValue_W_m2K ??
          (opening.type === "window" ? DEFAULT_WINDOW_U_W_M2K : DEFAULT_DOOR_U_W_M2K)
      );
      const openingResistance = Math.max(1 / openingU, surfaceResistanceM2K_W + DEFAULT_EXTERNAL_SURFACE_RESISTANCE + 0.05);
      const openingBaseTemperatureC =
        boundaryType === "internal"
          ? airTemperatureC -
            ((airTemperatureC - boundaryTemperatureC) * surfaceResistanceM2K_W) /
              Math.max(openingResistance, surfaceResistanceM2K_W + 0.01)
          : internalSurfaceTemperatureC(
              airTemperatureC,
              boundaryTemperatureC,
              surfaceResistanceM2K_W,
              openingResistance
            );
      descriptors.push({
        id: `surface:opening:${opening.id}:${roomId}`,
        roomId,
        levelId: wall.levelId,
        kind: opening.type === "window" ? "window" : "door",
        boundaryType,
        sourceId: opening.id,
        sourceType: "opening",
        airTemperatureC,
        boundaryTemperatureC,
        totalResistanceM2K_W: openingResistance,
        surfaceResistanceM2K_W,
        heatCapacity_J_m2K: opening.type === "window" ? 14000 : 26000,
        areaM2: Math.max(0.02, opening.widthM * opening.heightM),
        widthM: Math.max(0.12, opening.widthM),
        heightM: Math.max(0.12, opening.heightM),
        normal: normalize3({
          x: normalPlan.x * sideSign,
          y: 0,
          z: normalPlan.y * sideSign,
        }),
        uAxis,
        vAxis,
        origin: openingOrigin,
        localPolygon: [
          { x: 0, y: 0 },
          { x: Math.max(0.12, opening.widthM), y: 0 },
          { x: Math.max(0.12, opening.widthM), y: Math.max(0.12, opening.heightM) },
          { x: 0, y: Math.max(0.12, opening.heightM) },
        ],
        centroid: localToWorld(
          openingOrigin,
          uAxis,
          vAxis,
          Math.max(0.12, opening.widthM) * 0.5,
          Math.max(0.12, opening.heightM) * 0.5
        ),
        baseTemperatureC: openingBaseTemperatureC,
      });
    });
  };

  const positiveBoundaryTemperatureC =
    args.surface.kind === "internal"
      ? args.surface.negativeRoomId
        ? args.roomAirTemperatures.get(args.surface.negativeRoomId) ?? 21
        : args.outdoorTemperatureC
      : args.outdoorTemperatureC;
  const negativeBoundaryTemperatureC =
    args.surface.kind === "internal"
      ? args.surface.positiveRoomId
        ? args.roomAirTemperatures.get(args.surface.positiveRoomId) ?? 21
        : args.outdoorTemperatureC
      : args.outdoorTemperatureC;

  createDescriptorForRoom(
    args.surface.positiveRoomId,
    1,
    args.surface.kind === "internal" ? "internal" : "external",
    positiveBoundaryTemperatureC
  );
  createDescriptorForRoom(
    args.surface.negativeRoomId,
    -1,
    args.surface.kind === "internal" ? "internal" : "external",
    negativeBoundaryTemperatureC
  );

  return descriptors;
}

function buildHorizontalSurfaceDescriptor(args: {
  room: RoomVolumeDescriptor;
  roomAirTemperatures: Map<string, number>;
  levelElevationById: Map<string, number>;
  levelHeightById: Map<string, number>;
  slabs: FloorSlab[];
  roofs: Roof[];
  kind: "floor" | "ceiling";
  outdoorTemperatureC: number;
}): SurfaceDescriptor {
  const roomAirTemperatureC = args.roomAirTemperatures.get(args.room.roomId) ?? 21;
  const levelElevationM = args.levelElevationById.get(args.room.levelId) ?? 0;
  const levelHeightM = Math.max(args.levelHeightById.get(args.room.levelId) ?? 3, 2.2);
  const polygon = args.room.polygon.map((point) => ({ ...point }));
  const centroid2D = polygonCentroid(polygon);
  const matchingRoof = args.roofs.find(
    (roof) => roof.levelId === args.room.levelId && polygonContainsPoint(centroid2D, roof.boundary)
  );
  const matchingSlab = args.slabs.find(
    (slab) => slab.levelId === args.room.levelId && polygonContainsPoint(centroid2D, slab.boundary)
  );

  // Если у крыши heatedSide = "above" — значит тёплое помещение НАД крышей
  // (холодный чердак снизу), крыша не является внешним ограждением этой комнаты
  const roofHeatedBelow = !matchingRoof || (matchingRoof.heatedSide ?? "below") === "below";

  const totalResistance = (() => {
    if (args.kind === "ceiling" && matchingRoof && roofHeatedBelow) {
      return resolveConstructionResistance(matchingRoof.layers, 2.7);
    }
    if (args.kind === "floor" && matchingSlab) {
      return resolveConstructionResistance(matchingSlab.layers, matchingSlab.kind === "ground" ? 3.4 : 2.2);
    }
    return args.kind === "ceiling" ? 2 : 2.4;
  })();

  const boundaryType = (() => {
    if (args.kind === "ceiling" && matchingRoof && roofHeatedBelow) {
      return "external" as const;
    }
    if (args.kind === "floor" && matchingSlab?.kind === "ground") {
      return "external" as const;
    }
    if (args.kind === "floor" && matchingSlab?.kind === "basement") {
      return "neutral" as const;
    }
    return "neutral" as const;
  })();

  const boundaryTemperatureC = (() => {
    if (args.kind === "ceiling" && matchingRoof && roofHeatedBelow) {
      return args.outdoorTemperatureC;
    }
    if (args.kind === "floor" && matchingSlab?.kind === "ground") {
      return args.outdoorTemperatureC + DEFAULT_GROUND_OFFSET_C;
    }
    if (args.kind === "floor") {
      return roomAirTemperatureC - DEFAULT_NEUTRAL_FLOOR_OFFSET_C;
    }
    return roomAirTemperatureC - DEFAULT_NEUTRAL_CEILING_OFFSET_C;
  })();

  const surfaceResistanceM2K_W = DEFAULT_INTERNAL_SURFACE_RESISTANCE;
  const effectiveResistance =
    boundaryType === "neutral"
      ? Math.max(totalResistance, surfaceResistanceM2K_W + 0.22)
      : Math.max(totalResistance, surfaceResistanceM2K_W + DEFAULT_EXTERNAL_SURFACE_RESISTANCE + 0.2);
  const baseTemperatureC =
    boundaryType === "neutral"
      ? roomAirTemperatureC -
        ((roomAirTemperatureC - boundaryTemperatureC) * surfaceResistanceM2K_W) /
          Math.max(effectiveResistance, surfaceResistanceM2K_W + 0.01)
      : internalSurfaceTemperatureC(
          roomAirTemperatureC,
          boundaryTemperatureC,
          surfaceResistanceM2K_W,
          effectiveResistance
        );

  const minX = Math.min(...polygon.map((point) => point.x));
  const minY = Math.min(...polygon.map((point) => point.y));
  const maxX = Math.max(...polygon.map((point) => point.x));
  const maxY = Math.max(...polygon.map((point) => point.y));
  const elevationM =
    args.kind === "floor"
      ? levelElevationM + DEFAULT_OVERLAY_OFFSET_M
      : levelElevationM + levelHeightM - DEFAULT_OVERLAY_OFFSET_M;
  const normal =
    args.kind === "floor"
      ? ({ x: 0, y: 1, z: 0 } satisfies Vec3)
      : ({ x: 0, y: -1, z: 0 } satisfies Vec3);

  return {
    id: `surface:${args.kind}:${args.room.roomId}`,
    roomId: args.room.roomId,
    levelId: args.room.levelId,
    kind: args.kind,
    boundaryType,
    sourceId: args.room.roomId,
    sourceType: "room",
    airTemperatureC: roomAirTemperatureC,
    boundaryTemperatureC,
    totalResistanceM2K_W: effectiveResistance,
    surfaceResistanceM2K_W,
    heatCapacity_J_m2K: 120000,
    areaM2: Math.max(Math.abs(polygonArea(polygon)), 0.4),
    widthM: Math.max(maxX - minX, 0.4),
    heightM: Math.max(maxY - minY, 0.4),
    normal,
    uAxis: { x: 1, y: 0, z: 0 },
    vAxis: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y: elevationM, z: 0 },
    localPolygon: polygon.map((point) => ({ x: point.x, y: point.y })),
    centroid: { x: centroid2D.x, y: elevationM, z: centroid2D.y },
    baseTemperatureC: baseTemperatureC,
  };
}

function buildSurfacePatches(
  surface: SurfaceDescriptor,
  patchSizeM: number,
  heatSources: SurfaceHeatSource[],
  thermalBridges: SurfaceThermalBridgeZone[],
  indoorRelativeHumidity: number
): MutablePatch[] {
  const bounds = getPolygonBounds(surface.localPolygon);
  const columns = Math.max(1, Math.ceil(Math.max(bounds.maxX - bounds.minX, 0.1) / patchSizeM));
  const rows = Math.max(1, Math.ceil(Math.max(bounds.maxY - bounds.minY, 0.1) / patchSizeM));
  const stepX = Math.max((bounds.maxX - bounds.minX) / columns, 0.08);
  const stepY = Math.max((bounds.maxY - bounds.minY) / rows, 0.08);
  const patches: MutablePatch[] = [];
  const dewPointC = dewPointMagnusC(surface.airTemperatureC, indoorRelativeHumidity);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const minX = bounds.minX + column * stepX;
      const maxX = bounds.minX + (column + 1) * stepX;
      const minY = bounds.minY + row * stepY;
      const maxY = bounds.minY + (row + 1) * stepY;
      const centerLocal = { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 };
      if (!polygonContainsPoint(centerLocal, surface.localPolygon)) {
        continue;
      }

      const cornersLocal = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ] as const;
      const centerWorld = localToWorld(surface.origin, surface.uAxis, surface.vAxis, centerLocal.x, centerLocal.y);
      const cornersWorld = cornersLocal.map((corner) =>
        localToWorld(surface.origin, surface.uAxis, surface.vAxis, corner.x, corner.y)
      ) as [Vec3, Vec3, Vec3, Vec3];
      const centerSample = sampleSurfaceAtPoint(surface, centerLocal, centerWorld, heatSources, thermalBridges);
      const cornerSamples = cornersLocal.map((corner, index) =>
        polygonContainsPoint(corner, surface.localPolygon)
          ? sampleSurfaceAtPoint(surface, corner, cornersWorld[index], heatSources, thermalBridges)
          : centerSample
      );
      const cornerTemperaturesC = cornerSamples.map((sample) => sample.temperatureC) as [number, number, number, number];
      const areaM2 = stepX * stepY;
      const patchTemperatureC = average(cornerTemperaturesC);
      patches.push({
        id: `${surface.id}:r${row}:c${column}`,
        roomId: surface.roomId,
        levelId: surface.levelId,
        surfaceId: surface.id,
        surfaceKind: surface.kind,
        boundaryType: surface.boundaryType,
        row,
        column,
        localCenter: centerLocal,
        center: centerWorld,
        corners: cornersWorld,
        cornerTemperaturesC,
        patchTemperatureC,
        patchHeatFluxWm2: computePatchHeatFluxWm2(surface, patchTemperatureC),
        patchHeatLossW: 0,
        condensationRisk: patchTemperatureC <= dewPointC,
        condensationMarginC: patchTemperatureC - dewPointC,
        areaM2,
        sourceDeltaC: centerSample.sourceDeltaC,
        coldPenaltyC: centerSample.coldPenaltyC,
        sourceIds: centerSample.sourceIds,
        bridgeIds: centerSample.bridgeIds,
      });
    }
  }

  // --- 2-iteration neighbour smoothing within this surface ---
  // Spreads heat-source warm spots and cold-corner penalties across adjacent
  // patches so the colormap shows a genuine gradient instead of sharp steps.
  smoothSurfacePatches(patches);

  return patches;
}

/**
 * Two passes of area-weighted neighbour smoothing.
 * Edge-preserving: patches near active heat sources (sourceDeltaC > 0.5 °C)
 * use selfWeight=0.80 to keep warm peaks sharp; other patches use 0.60.
 * Applied to cornerTemperaturesC so per-vertex gradients benefit.
 */
function smoothSurfacePatches(patches: MutablePatch[]): void {
  if (patches.length <= 1) {
    return;
  }
  const ITERATIONS = 2;

  // Build lookup: "row:col" → array index
  const byRC = new Map<string, number>();
  patches.forEach((patch, idx) => {
    byRC.set(`${patch.row}:${patch.column}`, idx);
  });

  for (let iter = 0; iter < ITERATIONS; iter += 1) {
    // Collect updates before writing to avoid order-dependency
    const newCorners: Array<[number, number, number, number]> = new Array(patches.length);
    patches.forEach((patch, i) => {
      const neighborIdxs: number[] = [];
      const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
      offsets.forEach(([dr, dc]) => {
        const idx = byRC.get(`${patch.row + dr}:${patch.column + dc}`);
        if (idx !== undefined) {
          neighborIdxs.push(idx);
        }
      });
      if (!neighborIdxs.length) {
        newCorners[i] = [...patch.cornerTemperaturesC] as [number, number, number, number];
        return;
      }
      // Near heat sources: reduce blending to preserve warm peaks.
      const isNearSource = patch.sourceDeltaC > 0.5;
      const SELF_W = isNearSource ? 0.80 : 0.60;
      const NEIGHBOR_W = 1 - SELF_W;
      const nCount = neighborIdxs.length;
      const smoothed = patch.cornerTemperaturesC.map((selfT, ci) => {
        const neighborAvg =
          neighborIdxs.reduce((sum, idx) => sum + patches[idx]!.cornerTemperaturesC[ci], 0) / nCount;
        return SELF_W * selfT + NEIGHBOR_W * neighborAvg;
      }) as [number, number, number, number];
      newCorners[i] = smoothed;
    });

    // Write back
    patches.forEach((patch, i) => {
      patch.cornerTemperaturesC = newCorners[i]!;
      patch.patchTemperatureC = average(patch.cornerTemperaturesC);
    });
  }
}

function sampleSurfaceAtPoint(
  surface: SurfaceDescriptor,
  localPoint: Vec2,
  worldPoint: Vec3,
  heatSources: SurfaceHeatSource[],
  thermalBridges: SurfaceThermalBridgeZone[]
): SurfaceSample {
  const isHorizontalSurface = surface.kind === "floor" || surface.kind === "ceiling";

  const sourceContributions = heatSources
    .map((source): { id: string; deltaC: number } | null => {
      const isSameLevel = source.levelId === surface.levelId;

      if (!isSameLevel) {
        // Inter-level effect: only meaningful for floor/ceiling surfaces.
        if (!isHorizontalSurface) return null;
        // Use horizontal XZ distance so the effect is driven by room position,
        // not by the elevation gap between levels.
        const horizDistM = horizontalDistanceToSource(worldPoint, source);
        const INTER_LEVEL_RADIUS_M = 1.8;
        if (horizDistM > INTER_LEVEL_RADIUS_M * 3.0) return null;
        const VERTICAL_TRANSFER_FACTOR = 0.25;
        const MAX_INTER_LEVEL_DELTA_C = 2.5;
        const deltaTMaxC = resolveSourceDeltaTMaxC(source);
        const falloff = Math.exp((-1.4 * horizDistM) / INTER_LEVEL_RADIUS_M);
        return {
          id: source.id,
          deltaC: Math.min(deltaTMaxC * falloff * VERTICAL_TRANSFER_FACTOR, MAX_INTER_LEVEL_DELTA_C),
        };
      }

      // Same level: pipes and floor-heating are distributed linearly and can
      // influence wall surfaces of adjacent rooms (e.g. a pipe running along a
      // partition wall shows up on both sides).
      if (source.kind !== "pipe" && source.kind !== "floorHeating") {
        if (source.roomId && source.roomId !== surface.roomId) return null;
      }

      const distanceM = distanceToSource(worldPoint, source);
      const influenceRadiusM = Math.max(source.influenceRadiusM, 0.15);
      if (distanceM > influenceRadiusM * 3.5) {
        return null;
      }
      const deltaTMaxC = resolveSourceDeltaTMaxC(source);
      const falloff =
        source.falloffType === "gaussian"
          ? Math.exp(-Math.pow(distanceM / influenceRadiusM, 2))
          : Math.exp((-1.3 * distanceM) / influenceRadiusM);
      return {
        id: source.id,
        deltaC: deltaTMaxC * falloff,
      };
    })
    .filter((entry): entry is { id: string; deltaC: number } => entry !== null && entry.deltaC > 0.01);

  const sourceDeltaC = clamp(
    sourceContributions.reduce((sum, entry) => sum + entry.deltaC, 0),
    0,
    10.5
  );

  const thermalBridgeContributions = thermalBridges
    .filter((bridge) => bridge.levelId === surface.levelId && (!bridge.roomId || bridge.roomId === surface.roomId))
    .map((bridge) => {
      const distanceM = distanceToBridge(worldPoint, bridge);
      const influenceRadiusM = Math.max(bridge.influenceRadiusM, 0.08);
      if (distanceM > influenceRadiusM * 3) {
        return null;
      }
      return {
        id: bridge.id,
        penaltyC: bridge.temperaturePenaltyC * Math.exp((-2.4 * distanceM) / influenceRadiusM),
      };
    })
    .filter((entry): entry is { id: string; penaltyC: number } => Boolean(entry));

  const edgeDistanceM = distanceToPolygonEdges(localPoint, surface.localPolygon);
  const edgePenaltyC = (() => {
    if (surface.kind === "wall") {
      const verticalEdgeDistanceM = Math.min(
        localPoint.x,
        Math.max(surface.widthM - localPoint.x, 0)
      );
      // Floor-wall junction: cold stripe along bottom edge (wider + stronger)
      const floorJunctionPenalty = 0.72 * Math.exp((-2.1 * localPoint.y) / DEFAULT_CORNER_RADIUS_M);
      // Ceiling-wall junction: mild cold stripe along top edge
      const ceilingJunctionPenalty =
        0.38 * Math.exp((-2.1 * Math.max(surface.heightM - localPoint.y, 0)) / DEFAULT_CORNER_RADIUS_M);
      // Vertical edge (corner) penalty: cold along side edges
      const cornerPenalty = 0.82 * Math.exp((-1.7 * verticalEdgeDistanceM) / DEFAULT_CORNER_RADIUS_M);
      return floorJunctionPenalty + ceilingJunctionPenalty + cornerPenalty;
    }
    // Floor / ceiling perimeter penalty
    return 0.55 * Math.exp((-1.4 * edgeDistanceM) / DEFAULT_PERIMETER_RADIUS_M);
  })();
  const bridgePenaltyC = thermalBridgeContributions.reduce((sum, entry) => sum + entry.penaltyC, 0) + edgePenaltyC;
  const rawTemperatureC = surface.baseTemperatureC + sourceDeltaC - bridgePenaltyC;
  // Reduced convective blend so radiator warm spots and cold corners are not
  // washed out toward the uniform air temperature.
  const convectiveBlend = clamp(
    (DEFAULT_CONVECTIVE_H_W_M2K * surface.surfaceResistanceM2K_W) /
      (1 + DEFAULT_CONVECTIVE_H_W_M2K * surface.surfaceResistanceM2K_W),
    0.05,
    0.16
  );
  const convectiveTemperatureC = rawTemperatureC + (surface.airTemperatureC - rawTemperatureC) * convectiveBlend;
  const lowerBound = Math.min(surface.airTemperatureC, surface.boundaryTemperatureC) - 2;
  const upperBound = Math.max(surface.airTemperatureC, surface.boundaryTemperatureC) + 7.5;
  return {
    temperatureC: clamp(convectiveTemperatureC, lowerBound, upperBound),
    sourceDeltaC,
    coldPenaltyC: bridgePenaltyC,
    sourceIds: sourceContributions.map((entry) => entry.id),
    bridgeIds: thermalBridgeContributions.map((entry) => entry.id),
  };
}

function computePatchHeatFluxWm2(surface: SurfaceDescriptor, patchTemperatureC: number): number {
  const conductiveResistanceM2K_W = Math.max(surface.totalResistanceM2K_W - surface.surfaceResistanceM2K_W, 0.02);
  return (patchTemperatureC - surface.boundaryTemperatureC) / conductiveResistanceM2K_W;
}

function buildModelHeatSources(
  model: BuildingModel,
  roomVolumes: RoomVolumeDescriptor[],
  levelElevationById: Map<string, number>
): SurfaceHeatSource[] {
  const sources: SurfaceHeatSource[] = [];
  const roomById = new Map(roomVolumes.map((room) => [room.roomId, room]));

  model.equipment.forEach((equipment) => {
    const roomId =
      equipment.roomId ??
      resolveRoomIdForPoint(roomVolumes, equipment.levelId, equipment.position) ??
      null;
    const levelElevationM = levelElevationById.get(equipment.levelId) ?? 0;
    const totalPowerW = Math.max(
      equipment.params.nominalPowerW ??
        (equipment.type === "radiator" ? 1600 : equipment.type === "fancoil" ? 950 : 220),
      0
    );
    if (totalPowerW <= 0) {
      return;
    }
    const room = roomId ? roomById.get(roomId) : null;
    const position = {
      x: equipment.position.x,
      y:
        levelElevationM +
        (equipment.type === "radiator" ? 0.34 : equipment.type === "pump" ? 0.45 : room ? 0.9 : 0.4),
      z: equipment.position.y,
    } satisfies Vec3;
    sources.push({
      id: `source:equipment:${equipment.id}`,
      kind: equipment.type === "radiator" ? "radiator" : "equipment",
      levelId: equipment.levelId,
      roomId,
      totalPowerW,
      convectiveFraction: equipment.type === "radiator" ? 0.45 : 0.65,
      radiativeFraction: equipment.type === "radiator" ? 0.55 : 0.35,
      position,
      influenceRadiusM: equipment.type === "radiator" ? 2.5 : 1.6,
      falloffType: "exponential",
      metadata: {
        equipmentId: equipment.id,
        equipmentType: equipment.type,
      },
    });
  });

  model.pipes.forEach((pipe) => {
    const totalLengthM = polylineLength(pipe.path);
    if (totalLengthM <= 0) {
      return;
    }
    const totalPowerW = Math.max(pipe.heatLossW ?? totalLengthM * (pipe.type === "heating_supply" ? 16 : 10), 0);
    if (totalPowerW <= 0) {
      return;
    }
    const levelElevationM = levelElevationById.get(pipe.levelId) ?? 0;
    pipe.path.slice(1).forEach((point, index) => {
      const start = pipe.path[index];
      const segmentLengthM = Math.hypot(point.x - start.x, point.y - start.y);
      if (segmentLengthM <= 1e-6) {
        return;
      }
      const share = segmentLengthM / totalLengthM;
      const midpoint = { x: (start.x + point.x) * 0.5, y: (start.y + point.y) * 0.5 };
      const roomId = resolveRoomIdForPoint(roomVolumes, pipe.levelId, midpoint) ?? null;
      sources.push({
        id: `source:pipe:${pipe.id}:${index}`,
        kind: "pipe",
        levelId: pipe.levelId,
        roomId,
        totalPowerW: totalPowerW * share,
        convectiveFraction: 0.62,
        radiativeFraction: 0.38,
        position: { x: midpoint.x, y: levelElevationM + 0.22, z: midpoint.y },
        orientation: normalize3({ x: point.x - start.x, y: 0, z: point.y - start.y }),
        influenceRadiusM: 1.5,
        falloffType: "exponential",
        segment: {
          start: { x: start.x, y: levelElevationM + 0.22, z: start.y },
          end: { x: point.x, y: levelElevationM + 0.22, z: point.y },
        },
        metadata: {
          pipeId: pipe.id,
          pipeType: pipe.type,
          fluidTemperatureC: pipe.fluidTemperatureC,
        },
      });
    });
  });

  return sources;
}

function buildBridgeZones(args: {
  model: BuildingModel;
  renderGeometry: GeometryRenderModel;
  physics: ThermalPhysicsModel;
  roomVolumes: RoomVolumeDescriptor[];
  wallOpeningsByWallId: Map<string, OpeningCutDescriptor[]>;
  levelElevationById: Map<string, number>;
  overlayOffsetM: number;
}): SurfaceThermalBridgeZone[] {
  const bridges: SurfaceThermalBridgeZone[] = [];

  args.roomVolumes.forEach((room) => {
    const levelElevationM = args.levelElevationById.get(room.levelId) ?? 0;
    room.polygon.forEach((corner, index) => {
      bridges.push({
        id: `bridge:corner:${room.roomId}:${index}`,
        kind: "corner",
        levelId: room.levelId,
        roomId: room.roomId,
        influenceRadiusM: DEFAULT_CORNER_RADIUS_M,
        temperaturePenaltyC: 0.42,
        position: { x: corner.x, y: levelElevationM + 1.25, z: corner.y },
      });
    });
    const edges = room.polygon.map((point, index) => ({
      start: point,
      end: room.polygon[(index + 1) % room.polygon.length],
    }));
    edges.forEach((edge, index) => {
      bridges.push({
        id: `bridge:perimeter:${room.roomId}:${index}`,
        kind: "perimeter",
        levelId: room.levelId,
        roomId: room.roomId,
        influenceRadiusM: DEFAULT_PERIMETER_RADIUS_M,
        temperaturePenaltyC: 0.18,
        segment: {
          start: { x: edge.start.x, y: levelElevationM + args.overlayOffsetM, z: edge.start.y },
          end: { x: edge.end.x, y: levelElevationM + args.overlayOffsetM, z: edge.end.y },
        },
      });
    });
  });

  args.physics.surfaces
    .filter((surface) => surface.kind === "external")
    .forEach((surface) => {
      const wall = surface.wall;
      const levelElevationM = args.levelElevationById.get(wall.levelId) ?? 0;
      const openings = args.wallOpeningsByWallId.get(wall.id) ?? [];
      const directionPlan = normalize2({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
      openings.forEach((opening, index) => {
        const centerOffset = opening.startOffsetM + opening.widthM * 0.5;
        const centerPoint = {
          x: wall.a.x + directionPlan.x * centerOffset,
          y: wall.a.y + directionPlan.y * centerOffset,
        };
        bridges.push({
          id: `bridge:opening:${opening.id}:${index}`,
          kind: "windowReveal",
          levelId: wall.levelId,
          roomId: surface.positiveRoomId ?? surface.negativeRoomId ?? null,
          influenceRadiusM: DEFAULT_WINDOW_REVEAL_RADIUS_M,
          temperaturePenaltyC: opening.type === "window" ? 1.1 : 0.65,
          position: {
            x: centerPoint.x,
            y: levelElevationM + (opening.sillM ?? 0.7) + opening.heightM * 0.5,
            z: centerPoint.y,
          },
          metadata: {
            wallId: wall.id,
            openingId: opening.id,
            openingType: opening.type,
          },
        });
      });
      bridges.push({
        id: `bridge:wall-floor:${wall.id}`,
        kind: "wallFloorJunction",
        levelId: wall.levelId,
        roomId: surface.positiveRoomId ?? surface.negativeRoomId ?? null,
        influenceRadiusM: 0.18,
        temperaturePenaltyC: 0.28,
        segment: {
          start: { x: wall.a.x, y: levelElevationM + args.overlayOffsetM, z: wall.a.y },
          end: { x: wall.b.x, y: levelElevationM + args.overlayOffsetM, z: wall.b.y },
        },
      });
    });

  return bridges;
}

function resolveSourceDeltaTMaxC(source: SurfaceHeatSource): number {
  const radiativePowerW = Math.max(source.totalPowerW, 0) * clamp(source.radiativeFraction, 0, 1);
  switch (source.kind) {
    // Radiator: 1600 W → radiative ≈ 880 W → 880/145 ≈ 6.1 °C warm spot
    case "radiator":
      return clamp(radiativePowerW / 145, 1.4, 10.5);
    // Pipe: temperature-difference-based delta gives consistent stripe width
    // regardless of segment length. Falls back to power formula when no fluid
    // temperature is stored.
    case "pipe": {
      const fluidTempC = source.metadata?.fluidTemperatureC as number | undefined;
      const isSupply = source.metadata?.pipeType === "heating_supply";
      const effectiveTempC =
        typeof fluidTempC === "number" && fluidTempC > 25
          ? fluidTempC
          : isSupply ? 65 : 55;
      // (T_fluid − T_room) × conductance scaling: 65°C → 5.2°C, 55°C → 4.1°C
      return clamp((effectiveTempC - 18) * 0.11, 2.5, 9.0);
    }
    // In-floor heating: distributed, lower peak per patch
    case "floorHeating":
      return clamp(radiativePowerW / 260, 0.6, 7.5);
    case "equipment":
    default:
      return clamp(radiativePowerW / 190, 0.4, 6.5);
  }
}

function resolveConstructionResistance(
  layers: FloorSlab["layers"] | Roof["layers"] | undefined,
  fallbackResistanceM2K_W: number
): number {
  const properties = computeWallProperties(layers, undefined, { includeSp50AirFilms: true });
  if (properties?.rTotal_m2K_W && Number.isFinite(properties.rTotal_m2K_W)) {
    return Math.max(properties.rTotal_m2K_W, 0.4);
  }
  return fallbackResistanceM2K_W;
}

function resolveRoomIdForPoint(roomVolumes: RoomVolumeDescriptor[], levelId: string, point: Vec2): string | null {
  const match = roomVolumes.find((room) => room.levelId === levelId && polygonContainsPoint(point, room.polygon));
  return match?.roomId ?? null;
}

function distanceToSource(point: Vec3, source: SurfaceHeatSource): number {
  if (source.segment) {
    return distancePointToSegment3(point, source.segment.start, source.segment.end);
  }
  return distance3(point, source.position);
}

/**
 * Horizontal-only (XZ plane) distance from a 3D point to a heat source.
 * Used for inter-level heat transfer so the effect is driven by floor-plan
 * proximity rather than by the height gap between levels.
 */
function horizontalDistanceToSource(point: Vec3, source: SurfaceHeatSource): number {
  const flatPoint: Vec3 = { x: point.x, y: 0, z: point.z };
  if (source.segment) {
    const flatStart: Vec3 = { x: source.segment.start.x, y: 0, z: source.segment.start.z };
    const flatEnd: Vec3 = { x: source.segment.end.x, y: 0, z: source.segment.end.z };
    return distancePointToSegment3(flatPoint, flatStart, flatEnd);
  }
  const flatPos: Vec3 = { x: source.position.x, y: 0, z: source.position.z };
  return distance3(flatPoint, flatPos);
}

function distanceToBridge(point: Vec3, bridge: SurfaceThermalBridgeZone): number {
  if (bridge.segment) {
    return distancePointToSegment3(point, bridge.segment.start, bridge.segment.end);
  }
  if (bridge.position) {
    return distance3(point, bridge.position);
  }
  return Number.POSITIVE_INFINITY;
}

function getPolygonBounds(points: Vec2[]) {
  return points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxX: Math.max(acc.maxX, point.x),
      maxY: Math.max(acc.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
}

function distanceToPolygonEdges(point: Vec2, polygon: Vec2[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    best = Math.min(best, pointToSegmentDistance(point, start, end));
  }
  return best;
}

function polylineLength(points: Vec2[]): number {
  return points.slice(1).reduce((sum, point, index) => {
    const start = points[index]!;
    return sum + Math.hypot(point.x - start.x, point.y - start.y);
  }, 0);
}

function localToWorld(origin: Vec3, uAxis: Vec3, vAxis: Vec3, u: number, v: number): Vec3 {
  return {
    x: origin.x + uAxis.x * u + vAxis.x * v,
    y: origin.y + uAxis.y * u + vAxis.y * v,
    z: origin.z + uAxis.z * u + vAxis.z * v,
  };
}

function average(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function normalize2(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 1e-9) {
    return { x: 1, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
}

function normalize3(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length <= 1e-9) {
    return { x: 0, y: 1, z: 0 };
  }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function distancePointToSegment3(point: Vec3, start: Vec3, end: Vec3): number {
  const ab = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z,
  };
  const ap = {
    x: point.x - start.x,
    y: point.y - start.y,
    z: point.z - start.z,
  };
  const abLengthSq = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  if (abLengthSq <= 1e-9) {
    return distance3(point, start);
  }
  const t = clamp((ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / abLengthSq, 0, 1);
  const closest = {
    x: start.x + ab.x * t,
    y: start.y + ab.y * t,
    z: start.z + ab.z * t,
  };
  return distance3(point, closest);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
