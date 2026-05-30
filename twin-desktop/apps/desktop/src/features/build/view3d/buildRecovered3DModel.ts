import type { BuildingModel, Door, Vec2, Wall, Window } from "../../../entities/geometry/types";
import type { Equipment } from "../../../entities/networks/types";
import type { ThermalFieldModel } from "../../../core/thermal/field";
import { sampleWallSurfaceTemperatures } from "../../../core/thermal/field";
import { pointToSegmentDistance } from "../../../entities/geometry/geom";
import { buildGeometryRenderModel, buildRoomPolygonFromWalls, type GeometryRenderModel } from "../../../core/geometry/bimPipeline";
import {
  createEmptyRecoveredBounds,
  extendRecoveredBounds,
  extendRecoveredBoundsWithPolygon,
  finalizeRecoveredBounds,
  type RecoveredPreviewBounds,
} from "./recoveredPreviewMath";

export const DEBUG_RECOVERED_TEMP_SURFACES = false;
export const DEBUG_RECOVERED_3D_COORDS = false;
export const DEBUG_TEMP_SURFACE_REJECTION = false;
export const DEBUG_RECOVERED_GEOMETRY_ALIGNMENT = false;

export interface RecoveredScenePoint {
  x: number;
  y: number;
  z: number;
}

export interface RecoveredRoomModel {
  id: string;
  levelId: string;
  boundary: Vec2[];
  elevation_m: number;
  temperature_C: number | null;
  geometrySource: "renderGeometry" | "walls" | "room";
  alignedWithWalls: boolean;
}

export interface RecoveredWallModel {
  id: string;
  levelId: string;
  start: Vec2;
  end: Vec2;
  elevation_m: number;
  height_m: number;
  thickness_m: number;
  temperature_C: number | null;
}

export interface RecoveredOpeningModel {
  id: string;
  type: "window" | "door";
  levelId: string;
  center: RecoveredScenePoint;
  wallCenter: RecoveredScenePoint;
  width_m: number;
  height_m: number;
  depth_m: number;
  rotationY_rad: number;
  wallId: string | null;
}

export interface RecoveredRoofModel {
  id: string;
  levelId: string;
  boundary: Vec2[];
  elevation_m: number;
  thickness_m: number;
}

export interface RecoveredSlabModel {
  id: string;
  levelId: string;
  boundary: Vec2[];
  elevation_m: number;
  thickness_m: number;
}

export interface RecoveredPipeModel {
  id: string;
  levelId: string;
  path: RecoveredScenePoint[];
  diameter_m: number;
  colorRole: "supply" | "return";
}

export interface RecoveredDuctModel {
  id: string;
  levelId: string;
  path: RecoveredScenePoint[];
  width_m: number;
  height_m: number;
}

export interface RecoveredEquipmentModel {
  id: string;
  levelId: string;
  type: Equipment["type"];
  position: RecoveredScenePoint;
}

export interface RecoveredSensorModel {
  id: string;
  levelId: string;
  position: RecoveredScenePoint;
}

export type RecoveredTemperatureSourceType = "room" | "wall" | "roof" | "slab";
export type RawRecoveredTemperatureSourceType =
  | RecoveredTemperatureSourceType
  | "floorField"
  | "grid"
  | "bbox"
  | "level"
  | "fallback"
  | "transient";

export interface RawRecoveredTemperatureSurface {
  id: string;
  sourceType: RawRecoveredTemperatureSourceType;
  sourceId?: string | null;
  levelId: string | null;
  boundary?: Vec2[];
  wall?: {
    start: Vec2;
    end: Vec2;
    thickness_m: number;
    height_m: number;
    elevation_m: number;
  };
  temperature_C: number;
}

export interface RecoveredTemperatureSurface {
  id: string;
  sourceType: RecoveredTemperatureSourceType;
  sourceId: string;
  levelId: string;
  boundary?: Vec2[];
  wall?: {
    start: Vec2;
    end: Vec2;
    thickness_m: number;
    height_m: number;
    elevation_m: number;
  };
  temperature_C: number;
}

export interface RecoveredTemperatureSummary {
  min_C: number;
  max_C: number;
  average_C: number;
  rejectedCount: number;
  warnings: string[];
}

export interface RecoveredRoomTemperatureInfo {
  levelId: string;
  temperature_C: number;
  min_C: number | null;
  max_C: number | null;
  average_C: number | null;
  source: "thermalField.rooms" | "thermalField.roomMap";
  warnings: string[];
}

export interface BuildRecovered3DOptions {
  showNetworks?: boolean;
  showEquipment?: boolean;
  showTemperature?: boolean;
  showWallTemperature?: boolean;
  thermalField?: ThermalFieldModel | null;
}

export interface Recovered3DModel {
  levelId: string | null;
  rooms: RecoveredRoomModel[];
  walls: RecoveredWallModel[];
  windows: RecoveredOpeningModel[];
  doors: RecoveredOpeningModel[];
  roofs: RecoveredRoofModel[];
  slabs: RecoveredSlabModel[];
  pipes: RecoveredPipeModel[];
  ducts: RecoveredDuctModel[];
  equipment: RecoveredEquipmentModel[];
  sensors: RecoveredSensorModel[];
  temperatureSurfaces: RecoveredTemperatureSurface[];
  temperatureSummary: RecoveredTemperatureSummary | null;
  bounds: RecoveredPreviewBounds;
  warnings: string[];
}

function logDebug(message: string, payload: Record<string, unknown>) {
  if (DEBUG_RECOVERED_TEMP_SURFACES) {
    console.info("[recovered-3d]", message, payload);
  }
}

function logCoordDebug(message: string, payload: Record<string, unknown>) {
  if (DEBUG_RECOVERED_3D_COORDS) {
    console.info("[recovered-3d-coords]", message, payload);
  }
}

function logSurfaceFilterDebug(message: string, payload: Record<string, unknown>) {
  if (DEBUG_TEMP_SURFACE_REJECTION) {
    console.info("[recovered-3d-surface-filter]", message, payload);
  }
}

function logGeometryAlignmentDebug(message: string, payload: Record<string, unknown>) {
  if (DEBUG_RECOVERED_GEOMETRY_ALIGNMENT) {
    console.info("[recovered-3d-geometry-alignment]", message, payload);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function planToRecoveredScene(point: Vec2, elevation_m: number): RecoveredScenePoint {
  return {
    x: point.x,
    y: elevation_m,
    z: point.y,
  };
}

function clonePolygon(points: Vec2[]): Vec2[] {
  return points.map((point) => ({ ...point }));
}

function computePolygonBounds(points: Vec2[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  return { minX, minY, maxX, maxY };
}

function computePolygonCenter(points: Vec2[]) {
  const bounds = computePolygonBounds(points);
  return {
    x: (bounds.minX + bounds.maxX) * 0.5,
    y: (bounds.minY + bounds.maxY) * 0.5,
  };
}

function containsXZ(bounds: RecoveredPreviewBounds, point: { x: number; z: number }) {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.z >= bounds.minZ && point.z <= bounds.maxZ;
}

function describeRecoveredSurfaceDebugBounds(surface: RawRecoveredTemperatureSurface) {
  if (surface.boundary && surface.boundary.length >= 3) {
    const bounds = computePolygonBounds(surface.boundary);
    return {
      center: {
        x: (bounds.minX + bounds.maxX) * 0.5,
        z: (bounds.minY + bounds.maxY) * 0.5,
      },
      size: {
        x: bounds.maxX - bounds.minX,
        z: bounds.maxY - bounds.minY,
      },
    };
  }
  if (surface.wall) {
    const minX = Math.min(surface.wall.start.x, surface.wall.end.x);
    const maxX = Math.max(surface.wall.start.x, surface.wall.end.x);
    const minZ = Math.min(surface.wall.start.y, surface.wall.end.y);
    const maxZ = Math.max(surface.wall.start.y, surface.wall.end.y);
    return {
      center: {
        x: (minX + maxX) * 0.5,
        z: (minZ + maxZ) * 0.5,
      },
      size: {
        x: maxX - minX,
        z: maxZ - minZ,
      },
    };
  }
  return null;
}

export function getRoomPolygonFor3D(room: Pick<BuildingModel["rooms"][number], "id" | "polygon">): Vec2[] {
  return clonePolygon(room.polygon);
}

function getThermalRoomPolygon(roomId: string, thermalField?: ThermalFieldModel | null): Vec2[] | null {
  const thermalPolygon = thermalField?.roomMap.get(roomId)?.polygon;
  return thermalPolygon?.length ? clonePolygon(thermalPolygon) : null;
}

export function getRoomTemperatureValue(roomId: string, thermalField?: ThermalFieldModel | null): number | null {
  return thermalField?.roomMap.get(roomId)?.baseTemperatureC ?? null;
}

export function getRoomTemperatureMap(
  thermalField: ThermalFieldModel | null | undefined,
  activeLevelId: string | null
): { roomTemperatures: Map<string, RecoveredRoomTemperatureInfo>; warnings: string[] } {
  const roomTemperatures = new Map<string, RecoveredRoomTemperatureInfo>();
  const warnings: string[] = [];
  if (!thermalField) {
    return { roomTemperatures, warnings };
  }

  const registerRoomTemperature = (
    roomId: string | null | undefined,
    levelId: string,
    temperature_C: number,
    source: RecoveredRoomTemperatureInfo["source"]
  ) => {
    if (!roomId) {
      warnings.push("Температурное значение пропущено: нет roomId.");
      return;
    }
    if (activeLevelId && levelId !== activeLevelId) {
      warnings.push(`Температурное значение помещения ${roomId} пропущено: другой уровень.`);
      return;
    }
    if (!Number.isFinite(temperature_C)) {
      warnings.push(`Температурное значение помещения ${roomId} пропущено: некорректное значение.`);
      return;
    }
    if (roomTemperatures.has(roomId) && source === "thermalField.roomMap") {
      return;
    }
    roomTemperatures.set(roomId, {
      levelId,
      temperature_C,
      min_C: null,
      max_C: null,
      average_C: temperature_C,
      source,
      warnings: [],
    });
  };

  thermalField.rooms.forEach((room) => {
    registerRoomTemperature(room.roomId, room.levelId, room.baseTemperatureC, "thermalField.rooms");
  });
  thermalField.roomMap.forEach((room, roomId) => {
    registerRoomTemperature(roomId, room.levelId, room.baseTemperatureC, "thermalField.roomMap");
  });

  return {
    roomTemperatures,
    warnings: [...new Set(warnings)],
  };
}

function getRoomWallBounds(
  model: BuildingModel,
  thermalField: ThermalFieldModel | null,
  roomId: string,
  levelId: string,
  polygonOverride?: Vec2[]
) {
  const room = model.rooms.find((item) => item.id === roomId && item.levelId === levelId);
  const roomPolygon = polygonOverride?.length ? polygonOverride : room?.polygon ?? [];
  const levelWalls = model.walls.filter((wall) => wall.levelId === levelId);
  const matchedWalls = new Map<string, Wall>();
  if (roomPolygon.length >= 2) {
    for (let index = 0; index < roomPolygon.length; index += 1) {
      const start = roomPolygon[index];
      const end = roomPolygon[(index + 1) % roomPolygon.length];
      const midpoint = { x: (start.x + end.x) * 0.5, y: (start.y + end.y) * 0.5 };
      let closestWall: Wall | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;
      levelWalls.forEach((wall) => {
        const distance = pointToSegmentDistance(midpoint, wall.a, wall.b);
        if (distance < 0.35 && distance < closestDistance) {
          closestDistance = distance;
          closestWall = wall;
        }
      });
      if (closestWall) {
        const wallMatch = closestWall as Wall;
        matchedWalls.set(wallMatch.id, wallMatch);
      }
    }
  }
  if (!matchedWalls.size && thermalField) {
    const related = thermalField.boundaries.filter(
      (boundary) =>
        boundary.levelId === levelId &&
        (boundary.positiveRoomId === roomId || boundary.negativeRoomId === roomId)
    );
    related.forEach((boundary) => {
      const wall = model.walls.find((item) => item.id === boundary.wallId);
      matchedWalls.set(boundary.wallId, wall ?? boundary.wall);
    });
  }
  if (!matchedWalls.size) {
    return null;
  }
  const bounds = createEmptyRecoveredBounds();
  [...matchedWalls.values()].forEach((sourceWall) => {
    const halfThickness = Math.max(sourceWall.thickness_m * 0.5, 0.06);
    extendRecoveredBounds(bounds, sourceWall.a.x - halfThickness, 0, sourceWall.a.y - halfThickness);
    extendRecoveredBounds(bounds, sourceWall.a.x + halfThickness, 0, sourceWall.a.y + halfThickness);
    extendRecoveredBounds(bounds, sourceWall.b.x - halfThickness, 0, sourceWall.b.y - halfThickness);
    extendRecoveredBounds(bounds, sourceWall.b.x + halfThickness, 0, sourceWall.b.y + halfThickness);
  });
  return bounds.empty ? null : finalizeRecoveredBounds(bounds);
}

function boxesOverlap2D(
  left: { minX: number; minY: number; maxX: number; maxY: number },
  right: { minX: number; minY: number; maxX: number; maxY: number }
) {
  return left.maxX >= right.minX && left.minX <= right.maxX && left.maxY >= right.minY && left.minY <= right.maxY;
}

function getRoomVolumePolygon(renderGeometry: GeometryRenderModel | null, roomId: string, levelId: string): Vec2[] | null {
  const volume = renderGeometry?.roomVolumes.find((room) => room.roomId === roomId && room.levelId === levelId);
  return volume ? clonePolygon(volume.polygon) : null;
}

function evaluateRecoveredRoomFloorAlignment(
  roomId: string,
  roomName: string,
  levelId: string,
  activeLevelId: string | null,
  polygon: Vec2[],
  source: "renderGeometry" | "walls" | "room",
  model: BuildingModel,
  thermalField: ThermalFieldModel | null
) {
  const polygonBounds = computePolygonBounds(polygon);
  const polygonCenter = computePolygonCenter(polygon);
  const wallBounds = getRoomWallBounds(model, thermalField, roomId, levelId, polygon);
  const levelWallBounds = getRoomWallBounds(model, thermalField, roomId, levelId);
  const levelShellBounds = buildRecoveredShellBounds(model, activeLevelId);

  if (!wallBounds) {
    const payload = {
      roomId,
      roomName,
      roomLevelId: levelId,
      activeLevelId,
      source,
      roomFloorPolygon: polygon,
      roomFloorBounds: polygonBounds,
      roomFloorCenter: polygonCenter,
      wallBounds: null,
      levelShellBounds,
      deltaRoomFloorToWallsCenter: null,
      isRoomFloorInsideWallShell: false,
    };
    logGeometryAlignmentDebug("room-floor-missing-wall-bounds", payload);
    console.error("[recovered-3d] Room floor geometry is not aligned with wall shell.", payload);
    return {
      aligned: false,
      warning: `Пол помещения ${roomId} не отображен в 3D: геометрия помещения не совпадает со стенами.`,
    };
  }

  const wallCenter = {
    x: (wallBounds.minX + wallBounds.maxX) * 0.5,
    z: (wallBounds.minZ + wallBounds.maxZ) * 0.5,
  };
  const wallBox2D = { minX: wallBounds.minX, minY: wallBounds.minZ, maxX: wallBounds.maxX, maxY: wallBounds.maxZ };
  const insideWallShell =
    polygonBounds.minX >= wallBox2D.minX - 0.22 &&
    polygonBounds.maxX <= wallBox2D.maxX + 0.22 &&
    polygonBounds.minY >= wallBox2D.minY - 0.22 &&
    polygonBounds.maxY <= wallBox2D.maxY + 0.22;
  const overlapsWallShell = boxesOverlap2D(polygonBounds, wallBox2D);
  const centerInsideWallShell =
    polygonCenter.x >= wallBox2D.minX &&
    polygonCenter.x <= wallBox2D.maxX &&
    polygonCenter.y >= wallBox2D.minY &&
    polygonCenter.y <= wallBox2D.maxY;
  const deltaX = Math.abs(polygonCenter.x - wallCenter.x);
  const deltaZ = Math.abs(polygonCenter.y - wallCenter.z);
  const payload = {
    roomId,
    roomName,
    roomLevelId: levelId,
    activeLevelId,
    source,
    roomFloorPolygon: polygon,
    roomFloorBounds: polygonBounds,
    roomFloorCenter: polygonCenter,
    wallBounds: wallBox2D,
    wallCenter,
    levelShellBounds,
    levelRoomBounds: levelWallBounds
      ? { minX: levelWallBounds.minX, minY: levelWallBounds.minZ, maxX: levelWallBounds.maxX, maxY: levelWallBounds.maxZ }
      : null,
    deltaRoomFloorToWallsCenter: { dx: deltaX, dz: deltaZ },
    isRoomFloorInsideWallShell: insideWallShell,
  };
  logGeometryAlignmentDebug("room-floor-alignment", payload);

  if (!insideWallShell || !overlapsWallShell || !centerInsideWallShell) {
    console.error("[recovered-3d] Room floor geometry is not aligned with wall shell.", payload);
    return {
      aligned: false,
      warning: `Пол помещения ${roomId} не отображен в 3D: геометрия помещения не совпадает со стенами.`,
    };
  }

  return {
    aligned: true,
    warning: null,
  };
}

export function getRecoveredRoomFloorPolygon(
  room: Pick<BuildingModel["rooms"][number], "id" | "name" | "levelId" | "polygon">,
  model: BuildingModel,
  renderGeometry: GeometryRenderModel | null,
  thermalField: ThermalFieldModel | null,
  activeLevelId: string | null
): { boundary: Vec2[]; source: "renderGeometry" | "walls" | "room"; warning: string | null } | null {
  const roomName = room.name ?? room.id;
  const candidates: Array<{ source: "renderGeometry" | "walls" | "room"; polygon: Vec2[] }> = [];
  const renderPolygon = getRoomVolumePolygon(renderGeometry, room.id, room.levelId);
  if (renderPolygon?.length) {
    candidates.push({ source: "renderGeometry", polygon: renderPolygon });
  }
  const wallPolygon = buildRoomPolygonFromWalls(model, room as BuildingModel["rooms"][number]);
  if (wallPolygon.length) {
    candidates.push({ source: "walls", polygon: clonePolygon(wallPolygon) });
  }
  if (room.polygon.length) {
    candidates.push({ source: "room", polygon: clonePolygon(room.polygon) });
  }

  const seen = new Set<string>();
  const warnings: string[] = [];
  for (const candidate of candidates) {
    const signature = `${candidate.source}:${candidate.polygon.map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`).join("|")}`;
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    if (candidate.polygon.length < 3) {
      continue;
    }
    const alignment = evaluateRecoveredRoomFloorAlignment(
      room.id,
      roomName,
      room.levelId,
      activeLevelId,
      candidate.polygon,
      candidate.source,
      model,
      thermalField
    );
    if (alignment.aligned) {
      return {
        boundary: clonePolygon(candidate.polygon),
        source: candidate.source,
        warning: warnings[0] ?? null,
      };
    }
    if (alignment.warning) {
      warnings.push(alignment.warning);
    }
  }

  return null;
}

function collectRecoveredCoordinateWarnings(
  model: BuildingModel,
  thermalField: ThermalFieldModel | null,
  rooms: RecoveredRoomModel[]
): string[] {
  if (!thermalField) {
    return [];
  }
  const warnings: string[] = [];
  rooms.forEach((room) => {
    const sourceRoom = model.rooms.find((item) => item.id === room.id);
    if (!sourceRoom) {
      return;
    }
    const geometryCenter = computePolygonCenter(room.boundary);
    const sourceRoomCenter = computePolygonCenter(sourceRoom.polygon);
    if (Math.abs(sourceRoomCenter.x - geometryCenter.x) > 0.01 || Math.abs(sourceRoomCenter.y - geometryCenter.y) > 0.01) {
      warnings.push(`Геометрия помещения ${room.id} и оболочка стен используют разные координатные источники.`);
    }
    const thermalPolygon = getThermalRoomPolygon(room.id, thermalField);
    if (thermalPolygon) {
      const thermalCenter = computePolygonCenter(thermalPolygon);
      if (Math.abs(geometryCenter.x - thermalCenter.x) > 0.01 || Math.abs(geometryCenter.y - thermalCenter.y) > 0.01) {
        warnings.push(`Геометрия температуры помещения ${room.id} не совпадает с геометрией помещения, используется геометрия оболочки.`);
      }
    }
    const wallDerivedPolygon = buildRoomPolygonFromWalls(model, sourceRoom);
    const wallDerivedCenter = computePolygonCenter(wallDerivedPolygon);
    if (Math.abs(geometryCenter.x - wallDerivedCenter.x) > 0.01 || Math.abs(geometryCenter.y - wallDerivedCenter.y) > 0.01) {
      warnings.push(`Геометрия помещения ${room.id} и оболочка стен используют разные координатные источники.`);
    }
  });
  return [...new Set(warnings)];
}

export function resolveRecoveredLevelId(model: BuildingModel, activeLevelId: string | null): string | null {
  if (!activeLevelId) {
    return null;
  }
  const hasShell =
    model.rooms.some((room) => room.levelId === activeLevelId) ||
    model.walls.some((wall) => wall.levelId === activeLevelId) ||
    (model.roofs ?? []).some((roof) => roof.levelId === activeLevelId) ||
    (model.floorSlabs ?? []).some((slab) => slab.levelId === activeLevelId);
  return hasShell ? activeLevelId : null;
}

function getLevelElevation(model: BuildingModel, levelId: string) {
  return model.levels.find((level) => level.id === levelId)?.elevation_m ?? 0;
}

function buildRecoveredShellBounds(model: BuildingModel, levelId: string | null): RecoveredPreviewBounds {
  const bounds = createEmptyRecoveredBounds();
  model.rooms
    .filter((room) => !levelId || room.levelId === levelId)
    .forEach((room) => extendRecoveredBoundsWithPolygon(bounds, room.polygon, getLevelElevation(model, room.levelId), getLevelElevation(model, room.levelId) + 0.02));
  model.walls
    .filter((wall) => !levelId || wall.levelId === levelId)
    .forEach((wall) => {
      const halfThickness = Math.max(wall.thickness_m * 0.5, 0.06);
      extendRecoveredBounds(bounds, wall.a.x - halfThickness, getLevelElevation(model, wall.levelId), wall.a.y - halfThickness);
      extendRecoveredBounds(bounds, wall.a.x + halfThickness, getLevelElevation(model, wall.levelId) + wall.height_m, wall.a.y + halfThickness);
      extendRecoveredBounds(bounds, wall.b.x - halfThickness, getLevelElevation(model, wall.levelId), wall.b.y - halfThickness);
      extendRecoveredBounds(bounds, wall.b.x + halfThickness, getLevelElevation(model, wall.levelId) + wall.height_m, wall.b.y + halfThickness);
    });
  (model.roofs ?? [])
    .filter((roof) => !levelId || roof.levelId === levelId)
    .forEach((roof) => extendRecoveredBoundsWithPolygon(bounds, roof.boundary, roof.elevationBase_m, roof.elevationBase_m + Math.max(roof.thickness_m, 0.04)));
  (model.floorSlabs ?? [])
    .filter((slab) => !levelId || slab.levelId === levelId)
    .forEach((slab) => extendRecoveredBoundsWithPolygon(bounds, slab.boundary, slab.elevation_m, slab.elevation_m + Math.max(slab.thickness_m, 0.04)));
  return finalizeRecoveredBounds(bounds);
}

function buildRecoveredBounds(result: Omit<Recovered3DModel, "bounds" | "warnings">): RecoveredPreviewBounds {
  const bounds = createEmptyRecoveredBounds();

  result.rooms.forEach((room) => extendRecoveredBoundsWithPolygon(bounds, room.boundary, room.elevation_m, room.elevation_m + 0.02));
  result.walls.forEach((wall) => {
    const halfThickness = Math.max(wall.thickness_m * 0.5, 0.06);
    extendRecoveredBounds(bounds, wall.start.x - halfThickness, wall.elevation_m, wall.start.y - halfThickness);
    extendRecoveredBounds(bounds, wall.start.x + halfThickness, wall.elevation_m + wall.height_m, wall.start.y + halfThickness);
    extendRecoveredBounds(bounds, wall.end.x - halfThickness, wall.elevation_m, wall.end.y - halfThickness);
    extendRecoveredBounds(bounds, wall.end.x + halfThickness, wall.elevation_m + wall.height_m, wall.end.y + halfThickness);
  });
  result.roofs.forEach((roof) =>
    extendRecoveredBoundsWithPolygon(bounds, roof.boundary, roof.elevation_m, roof.elevation_m + Math.max(roof.thickness_m, 0.04))
  );
  result.slabs.forEach((slab) =>
    extendRecoveredBoundsWithPolygon(bounds, slab.boundary, slab.elevation_m, slab.elevation_m + Math.max(slab.thickness_m, 0.04))
  );

  if (bounds.empty) {
    const allPoints = [
      ...result.pipes.flatMap((pipe) => pipe.path),
      ...result.ducts.flatMap((duct) => duct.path),
      ...result.equipment.map((item) => item.position),
      ...result.sensors.map((item) => item.position),
    ];
    allPoints.forEach((point) => extendRecoveredBounds(bounds, point.x, point.y, point.z));
  }

  return finalizeRecoveredBounds(bounds);
}

function resolveOpeningPlacement(
  wall: Wall | null,
  opening: Door | Window,
  levelElevation_m: number,
  type: "window" | "door"
): RecoveredOpeningModel | null {
  if (!wall) {
    return null;
  }
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.y - wall.a.y;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) {
    return null;
  }
  const dirX = dx / length;
  const dirZ = dz / length;
  const anchorT = Number.isFinite(opening.anchor.t) ? opening.anchor.t : 0;
  const offsetRatio = Number.isFinite(opening.anchor.offset_m) ? opening.anchor.offset_m / length : anchorT;
  const t = clamp(anchorT > 0 && anchorT < 1 ? anchorT : offsetRatio, 0, 1);
  const baseX = wall.a.x + dx * t;
  const baseZ = wall.a.y + dz * t;
  const normalX = -dirZ;
  const normalZ = dirX;
  const depth_m = Math.max(Math.min(wall.thickness_m * 0.22, 0.12), 0.05);
  const surfaceOffset_m = wall.thickness_m * 0.5 + depth_m * 0.55 + 0.012;
  const centerX = baseX + normalX * surfaceOffset_m;
  const centerZ = baseZ + normalZ * surfaceOffset_m;
  const height_m = Math.max(opening.height_m || (type === "door" ? 2.1 : 1.4), type === "door" ? 2 : 1.1);
  const sill_m = type === "door" ? 0 : Math.max(opening.sill_m ?? 0.9, 0.1);
  const centerY = levelElevation_m + sill_m + height_m * 0.5;

  return {
    id: opening.id,
    type,
    levelId: wall.levelId,
    center: { x: centerX, y: centerY, z: centerZ },
    wallCenter: { x: baseX, y: centerY, z: baseZ },
    width_m: Math.max(opening.width_m || 0.9, type === "door" ? 0.8 : 0.6),
    height_m,
    depth_m,
    rotationY_rad: -Math.atan2(dz, dx),
    wallId: wall.id,
  };
}

function buildRecoveredOpenings(model: BuildingModel, levelId: string | null, type: "window" | "door"): RecoveredOpeningModel[] {
  const wallsById = new Map(model.walls.map((wall) => [wall.id, wall]));
  const source = type === "window" ? model.windows : model.doors;
  return source
    .map((opening) => {
      const wall = opening.anchor.wallId ? wallsById.get(opening.anchor.wallId) ?? null : null;
      if (!wall) {
        return null;
      }
      if (levelId && wall.levelId !== levelId) {
        return null;
      }
      return resolveOpeningPlacement(wall, opening, getLevelElevation(model, wall.levelId), type);
    })
    .filter((item): item is RecoveredOpeningModel => Boolean(item));
}

export function filterAnchoredTemperatureSurfaces(
  surfaces: RawRecoveredTemperatureSurface[],
  model: BuildingModel,
  activeLevelId: string | null,
  geometryContext?: {
    renderGeometry?: GeometryRenderModel | null;
    thermalField?: ThermalFieldModel | null;
  }
): { surfaces: RecoveredTemperatureSurface[]; warnings: string[]; rejectedCount: number } {
  const levelId = resolveRecoveredLevelId(model, activeLevelId);
  const accepted: RecoveredTemperatureSurface[] = [];
  const warnings: string[] = [];
  let rejectedCount = 0;
  const shellBounds = buildRecoveredShellBounds(model, levelId);

  const reject = (surface: RawRecoveredTemperatureSurface, reason: string) => {
    rejectedCount += 1;
    warnings.push(reason);
    const debugBounds = describeRecoveredSurfaceDebugBounds(surface);
    logSurfaceFilterDebug("rejected", {
      id: surface.id,
      sourceType: surface.sourceType,
      sourceId: surface.sourceId ?? null,
      levelId: surface.levelId,
      temperature_C: surface.temperature_C,
      bboxCenter: debugBounds?.center ?? null,
      bboxSize: debugBounds?.size ?? null,
      accepted: false,
      reason,
    });
  };

  surfaces.forEach((surface) => {
    if (!surface.sourceId) {
      reject(surface, "Температурная поверхность пропущена: нет привязки к геометрии.");
      return;
    }
    if (levelId && surface.levelId && surface.levelId !== levelId) {
      reject(surface, `Температурная поверхность ${surface.sourceId} пропущена: другой уровень.`);
      return;
    }

    if (surface.sourceType === "room") {
      const room = model.rooms.find((item) => item.id === surface.sourceId);
      if (!room) {
        reject(surface, `Температурная поверхность помещения ${surface.sourceId} пропущена: помещение не найдено.`);
        return;
      }
      if (levelId && room.levelId !== levelId) {
        reject(surface, `Температурная поверхность помещения ${surface.sourceId} пропущена: помещение на другом уровне.`);
        return;
      }
      const geometry = getRecoveredRoomFloorPolygon(
        room,
        model,
        geometryContext?.renderGeometry ?? null,
        geometryContext?.thermalField ?? null,
        levelId
      );
      const boundary = geometry?.boundary ?? [];
      if (boundary.length < 3) {
        reject(surface, `Температурная поверхность помещения ${surface.sourceId} пропущена: недостаточная геометрия.`);
        return;
      }
      const center = computePolygonCenter(boundary);
      if (!shellBounds.empty && !containsXZ(shellBounds, { x: center.x, z: center.y })) {
        console.error("[recovered-3d-surface-filter] Accepted room surface left shell bounds.", {
          id: surface.id,
          sourceId: surface.sourceId,
          center,
          shellBounds,
        });
      }
      accepted.push({
        id: surface.id,
        sourceType: "room",
        sourceId: room.id,
        levelId: room.levelId,
        boundary,
        temperature_C: surface.temperature_C,
      });
      logSurfaceFilterDebug("accepted", {
        id: surface.id,
        sourceType: surface.sourceType,
        sourceId: room.id,
        levelId: room.levelId,
        center,
        accepted: true,
      });
      return;
    }

    if (surface.sourceType === "wall") {
      const wall = model.walls.find((item) => item.id === surface.sourceId);
      if (!wall) {
        reject(surface, `Температурная поверхность стены ${surface.sourceId} пропущена: стена не найдена.`);
        return;
      }
      if (levelId && wall.levelId !== levelId) {
        reject(surface, `Температурная поверхность стены ${surface.sourceId} пропущена: стена на другом уровне.`);
        return;
      }
      const center = {
        x: (wall.a.x + wall.b.x) * 0.5,
        z: (wall.a.y + wall.b.y) * 0.5,
      };
      if (!shellBounds.empty && !containsXZ(shellBounds, center)) {
        console.error("[recovered-3d-surface-filter] Accepted wall surface left shell bounds.", {
          id: surface.id,
          sourceId: surface.sourceId,
          center,
          shellBounds,
        });
      }
      accepted.push({
        id: surface.id,
        sourceType: "wall",
        sourceId: wall.id,
        levelId: wall.levelId,
        wall: {
          start: { ...wall.a },
          end: { ...wall.b },
          thickness_m: wall.thickness_m,
          height_m: wall.height_m,
          elevation_m: getLevelElevation(model, wall.levelId),
        },
        temperature_C: surface.temperature_C,
      });
      logSurfaceFilterDebug("accepted", {
        id: surface.id,
        sourceType: surface.sourceType,
        sourceId: wall.id,
        levelId: wall.levelId,
        center,
        accepted: true,
      });
      return;
    }

    if (surface.sourceType === "roof") {
      const roof = (model.roofs ?? []).find((item) => item.id === surface.sourceId);
      if (!roof) {
        reject(surface, `Температурная поверхность крыши ${surface.sourceId} пропущена: крыша не найдена.`);
        return;
      }
      if (levelId && roof.levelId !== levelId) {
        reject(surface, `Температурная поверхность крыши ${surface.sourceId} пропущена: крыша на другом уровне.`);
        return;
      }
      const boundary = clonePolygon(roof.boundary);
      if (boundary.length < 3) {
        reject(surface, `Температурная поверхность крыши ${surface.sourceId} пропущена: недостаточная геометрия.`);
        return;
      }
      accepted.push({
        id: surface.id,
        sourceType: "roof",
        sourceId: roof.id,
        levelId: roof.levelId,
        boundary,
        temperature_C: surface.temperature_C,
      });
      logSurfaceFilterDebug("accepted", {
        id: surface.id,
        sourceType: surface.sourceType,
        sourceId: roof.id,
        levelId: roof.levelId,
        center: computePolygonCenter(boundary),
        accepted: true,
      });
      return;
    }

    if (surface.sourceType === "slab") {
      const slab = (model.floorSlabs ?? []).find((item) => item.id === surface.sourceId);
      if (!slab) {
        reject(surface, `Температурная поверхность плиты ${surface.sourceId} пропущена: плита не найдена.`);
        return;
      }
      if (levelId && slab.levelId !== levelId) {
        reject(surface, `Температурная поверхность плиты ${surface.sourceId} пропущена: плита на другом уровне.`);
        return;
      }
      const boundary = clonePolygon(slab.boundary);
      if (boundary.length < 3) {
        reject(surface, `Температурная поверхность плиты ${surface.sourceId} пропущена: недостаточная геометрия.`);
        return;
      }
      accepted.push({
        id: surface.id,
        sourceType: "slab",
        sourceId: slab.id,
        levelId: slab.levelId,
        boundary,
        temperature_C: surface.temperature_C,
      });
      logSurfaceFilterDebug("accepted", {
        id: surface.id,
        sourceType: surface.sourceType,
        sourceId: slab.id,
        levelId: slab.levelId,
        center: computePolygonCenter(boundary),
        accepted: true,
      });
      return;
    }

    reject(surface, "Температурная поверхность пропущена: нет привязки к геометрии.");
  });

  return {
    surfaces: accepted,
    warnings: [...new Set(warnings)],
    rejectedCount,
  };
}

function calculatePolygonArea(points: Vec2[]) {
  if (points.length < 3) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) * 0.5;
}

export function filterDisplayedRecoveredTemperatureSurfaces(
  surfaces: RecoveredTemperatureSurface[],
  rooms: Pick<RecoveredRoomModel, "id" | "levelId" | "boundary">[]
): { surfaces: RecoveredTemperatureSurface[]; warnings: string[]; rejectedCount: number } {
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const accepted: RecoveredTemperatureSurface[] = [];
  const warnings: string[] = [];
  let rejectedCount = 0;

  surfaces.forEach((surface) => {
    if (surface.sourceType !== "room") {
      rejectedCount += 1;
      warnings.push(`Температурная поверхность ${surface.sourceId} пропущена: в 3D отображается только заливка помещений.`);
      return;
    }

    const room = roomMap.get(surface.sourceId);
    if (!room || !surface.boundary || surface.levelId !== room.levelId) {
      rejectedCount += 1;
      warnings.push(`Температурная поверхность помещения ${surface.sourceId} отклонена: не найдена геометрия помещения.`);
      return;
    }

    const roomBounds = computePolygonBounds(room.boundary);
    const surfaceBounds = computePolygonBounds(surface.boundary);
    const roomCenter = computePolygonCenter(room.boundary);
    const surfaceCenter = computePolygonCenter(surface.boundary);
    const roomSizeX = roomBounds.maxX - roomBounds.minX;
    const roomSizeZ = roomBounds.maxY - roomBounds.minY;
    const surfaceSizeX = surfaceBounds.maxX - surfaceBounds.minX;
    const surfaceSizeZ = surfaceBounds.maxY - surfaceBounds.minY;
    const roomArea = calculatePolygonArea(room.boundary);
    const surfaceArea = calculatePolygonArea(surface.boundary);
    const centerDeltaX = Math.abs(roomCenter.x - surfaceCenter.x);
    const centerDeltaZ = Math.abs(roomCenter.y - surfaceCenter.y);
    const sizeDeltaX = Math.abs(roomSizeX - surfaceSizeX);
    const sizeDeltaZ = Math.abs(roomSizeZ - surfaceSizeZ);
    const areaDelta = Math.abs(roomArea - surfaceArea);

    if (centerDeltaX > 0.01 || centerDeltaZ > 0.01 || sizeDeltaX > 0.01 || sizeDeltaZ > 0.01 || areaDelta > 0.01) {
      rejectedCount += 1;
      warnings.push(`Температурная поверхность помещения ${surface.sourceId} отклонена: не совпадает с геометрией помещения.`);
      return;
    }

    accepted.push({
      ...surface,
      boundary: clonePolygon(room.boundary),
    });
  });

  return {
    surfaces: accepted,
    warnings: [...new Set(warnings)],
    rejectedCount,
  };
}

export function summarizeRecoveredTemperatureSurfaces(
  surfaces: RecoveredTemperatureSurface[],
  warnings: string[],
  rejectedCount: number
): RecoveredTemperatureSummary | null {
  if (!surfaces.length) {
    const summaryWarnings = [...warnings];
    if (!summaryWarnings.some((warning) => warning.includes("нет привязанных данных для 3D"))) {
      summaryWarnings.unshift("Температурное поле: нет привязанных данных для 3D.");
    }
    return {
      min_C: 0,
      max_C: 0,
      average_C: 0,
      rejectedCount,
      warnings: summaryWarnings,
    };
  }
  const temperatures = surfaces.map((surface) => surface.temperature_C).filter(Number.isFinite);
  let min_C = Math.min(...temperatures);
  let max_C = Math.max(...temperatures);
  if (Math.abs(max_C - min_C) < 0.001) {
    min_C -= 1;
    max_C += 1;
  }
  return {
    min_C,
    max_C,
    average_C: temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length,
    rejectedCount,
    warnings,
  };
}

export function buildRecoveredTemperatureSurfaces(
  model: BuildingModel,
  thermalField: ThermalFieldModel | null,
  activeLevelId: string | null,
  options: { showTemperature: boolean; showWallTemperature: boolean }
): { surfaces: RecoveredTemperatureSurface[]; summary: RecoveredTemperatureSummary | null } {
  const rawSurfaces: RawRecoveredTemperatureSurface[] = [];
  const warnings: string[] = [];
  const levelId = resolveRecoveredLevelId(model, activeLevelId);
  const renderGeometry = thermalField?.renderGeometry ?? buildGeometryRenderModel(model);

  if (!options.showTemperature && !options.showWallTemperature) {
    return { surfaces: [], summary: null };
  }
  if (!thermalField) {
    const summary = summarizeRecoveredTemperatureSurfaces([], ["Нет температурных данных."], 0);
    return {
      surfaces: [],
      summary,
    };
  }

  if (options.showTemperature) {
    thermalField.rooms.forEach((room, index) => {
      const existingRoom = room.roomId ? model.rooms.find((item) => item.id === room.roomId) : null;
      if (DEBUG_RECOVERED_TEMP_SURFACES || DEBUG_RECOVERED_3D_COORDS) {
        const roomPolygon = existingRoom ? getRoomPolygonFor3D(existingRoom) : [];
        if (roomPolygon.length >= 3) {
          const thermalPolygon = room.roomId ? getThermalRoomPolygon(room.roomId, thermalField) : null;
          const roomCenter = computePolygonCenter(roomPolygon);
          const wallBounds =
            room.roomId && existingRoom ? getRoomWallBounds(model, thermalField, existingRoom.id, existingRoom.levelId) : null;
          const wallCenter = wallBounds
            ? {
                x: (wallBounds.minX + wallBounds.maxX) * 0.5,
                z: (wallBounds.minZ + wallBounds.maxZ) * 0.5,
              }
            : null;
          const thermalCenter = thermalPolygon?.length ? computePolygonCenter(thermalPolygon) : null;
          const debugPayload = {
            roomId: room.roomId ?? null,
            roomName: (existingRoom as { name?: string } | null)?.name ?? room.roomId ?? `room-${index}`,
            levelId: room.levelId,
            activeLevelId: levelId,
            roomPolygonRaw: roomPolygon,
            roomBounds: computePolygonBounds(roomPolygon),
            roomCenter,
            thermalPolygon,
            thermalBounds: thermalPolygon ? computePolygonBounds(thermalPolygon) : null,
            thermalCenter,
            recoveredFloorPolygon: roomPolygon,
            recoveredTempPolygon: roomPolygon,
            recoveredFloorBounds: computePolygonBounds(roomPolygon),
            recoveredTempBounds: computePolygonBounds(roomPolygon),
            recoveredFloorCenter: roomCenter,
            recoveredTempCenter: roomCenter,
            deltaCenterX: 0,
            deltaCenterZ: 0,
            wallBounds: wallBounds
              ? {
                  minX: wallBounds.minX,
                  maxX: wallBounds.maxX,
                  minZ: wallBounds.minZ,
                  maxZ: wallBounds.maxZ,
                }
              : null,
            wallCenter,
            temperature_C: room.baseTemperatureC,
          };
          logCoordDebug("room-temperature-surface-coords", debugPayload);
          if (DEBUG_RECOVERED_TEMP_SURFACES) {
            logDebug("room-temperature-surface", debugPayload);
          }
          if (
            thermalCenter &&
            (Math.abs(thermalCenter.x - roomCenter.x) > 0.01 || Math.abs(thermalCenter.y - roomCenter.y) > 0.01)
          ) {
            console.error("[recovered-3d-coords] Thermal room polygon diverged from room shell geometry.", debugPayload);
          }
          if (
            wallCenter &&
            (Math.abs(wallCenter.x - roomCenter.x) > 0.01 || Math.abs(wallCenter.z - roomCenter.y) > 0.01)
          ) {
            console.warn("[recovered-3d-coords] Room floor and wall shell use different coordinate source.", debugPayload);
          }
        }
      }

      rawSurfaces.push({
        id: room.roomId ? `room:${room.roomId}` : `room:unanchored:${index}`,
        sourceType: "room",
        sourceId: room.roomId || null,
        levelId: room.levelId,
        temperature_C: room.baseTemperatureC,
      });
    });
  }

  if (options.showWallTemperature) {
    thermalField.boundaries.forEach((boundary) => {
      if (levelId && boundary.levelId !== levelId) {
        return;
      }
      const sample = sampleWallSurfaceTemperatures(thermalField, boundary.wallId);
      if (!sample) {
        return;
      }
      rawSurfaces.push({
        id: `wall:${boundary.wallId}`,
        sourceType: "wall",
        sourceId: boundary.wallId,
        levelId: boundary.levelId,
        temperature_C: sample.averageC,
      });
    });
  }

  const filtered = filterAnchoredTemperatureSurfaces(rawSurfaces, model, levelId, {
    renderGeometry,
    thermalField,
  });
  const roomDisplayFilter = filterDisplayedRecoveredTemperatureSurfaces(
    filtered.surfaces,
    model.rooms
      .filter((room) => !levelId || room.levelId === levelId)
      .flatMap((room) => {
        const geometry = getRecoveredRoomFloorPolygon(room, model, renderGeometry, thermalField, levelId);
        return geometry
          ? [
              {
                id: room.id,
                levelId: room.levelId,
                boundary: geometry.boundary,
              },
            ]
          : [];
      })
  );
  const summary = summarizeRecoveredTemperatureSurfaces(
    roomDisplayFilter.surfaces,
    [...new Set([...warnings, ...filtered.warnings, ...roomDisplayFilter.warnings])],
    filtered.rejectedCount + roomDisplayFilter.rejectedCount
  );

  return {
    surfaces: roomDisplayFilter.surfaces,
    summary,
  };
}

export function summarizeRecoveredRoomTemperatures(
  rooms: Pick<RecoveredRoomModel, "boundary" | "temperature_C">[],
  warnings: string[]
): RecoveredTemperatureSummary {
  const coloredRooms = rooms.filter((room) => room.boundary.length >= 3 && Number.isFinite(room.temperature_C));
  if (!coloredRooms.length) {
    const summaryWarnings = [...warnings];
    if (!summaryWarnings.some((warning) => warning.includes("нет привязанных данных для 3D"))) {
      summaryWarnings.unshift("Температурное поле: нет привязанных данных для 3D.");
    }
    return {
      min_C: 0,
      max_C: 0,
      average_C: 0,
      rejectedCount: 0,
      warnings: [...new Set(summaryWarnings)],
    };
  }

  const temperatures = coloredRooms.map((room) => room.temperature_C as number);
  let min_C = Math.min(...temperatures);
  let max_C = Math.max(...temperatures);
  if (Math.abs(max_C - min_C) < 0.001) {
    min_C -= 1;
    max_C += 1;
  }
  return {
    min_C,
    max_C,
    average_C: temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length,
    rejectedCount: 0,
    warnings: [...new Set(warnings)],
  };
}

export function buildRecovered3DModel(
  model: BuildingModel,
  activeLevelId: string | null,
  options: BuildRecovered3DOptions = {}
): Recovered3DModel {
  const levelId = resolveRecoveredLevelId(model, activeLevelId);
  const showNetworks = options.showNetworks ?? true;
  const showEquipment = options.showEquipment ?? true;
  const showTemperature = options.showTemperature ?? false;
  const showWallTemperature = options.showWallTemperature ?? false;
  const renderGeometry = options.thermalField?.renderGeometry ?? buildGeometryRenderModel(model);
  const sourceRoomsById = new Map(model.rooms.map((room) => [room.id, room]));
  const rawRoomTemperatureState = showTemperature ? getRoomTemperatureMap(options.thermalField ?? null, levelId) : { roomTemperatures: new Map<string, RecoveredRoomTemperatureInfo>(), warnings: [] as string[] };
  const roomTemperatureWarnings = [...rawRoomTemperatureState.warnings];
  const roomTemperatures = new Map<string, RecoveredRoomTemperatureInfo>();

  rawRoomTemperatureState.roomTemperatures.forEach((info, roomId) => {
    const room = sourceRoomsById.get(roomId);
    if (!room) {
      roomTemperatureWarnings.push(`Температурное значение помещения ${roomId} пропущено: помещение не найдено.`);
      return;
    }
    if (levelId && room.levelId !== levelId) {
      roomTemperatureWarnings.push(`Температурное значение помещения ${roomId} пропущено: помещение на другом уровне.`);
      return;
    }
    roomTemperatures.set(roomId, info);
  });

  const rooms: RecoveredRoomModel[] = model.rooms
    .filter((room) => !levelId || room.levelId === levelId)
    .flatMap((room) => {
      const geometry = getRecoveredRoomFloorPolygon(room, model, renderGeometry, options.thermalField ?? null, levelId);
      const rawPolygon = getRoomPolygonFor3D(room);
      const rawBounds = rawPolygon.length >= 3 ? computePolygonBounds(rawPolygon) : null;
      const rawCenter = rawPolygon.length >= 3 ? computePolygonCenter(rawPolygon) : null;
      const recoveredBounds = geometry?.boundary.length ? computePolygonBounds(geometry.boundary) : null;
      const recoveredCenter = geometry?.boundary.length ? computePolygonCenter(geometry.boundary) : null;
      const wallBounds = rawPolygon.length >= 3 ? getRoomWallBounds(model, options.thermalField ?? null, room.id, room.levelId, geometry?.boundary ?? rawPolygon) : null;
      logGeometryAlignmentDebug("room-floor-source-audit", {
        roomId: room.id,
        roomName: room.name ?? room.id,
        roomLevelId: room.levelId,
        activeLevelId: levelId,
        roomPolygonRaw: rawPolygon,
        roomPolygonBounds: rawBounds,
        roomPolygonCenter: rawCenter,
        wallBounds: wallBounds
          ? { minX: wallBounds.minX, minY: wallBounds.minZ, maxX: wallBounds.maxX, maxY: wallBounds.maxZ }
          : null,
        wallCenter: wallBounds
          ? { x: (wallBounds.minX + wallBounds.maxX) * 0.5, z: (wallBounds.minZ + wallBounds.maxZ) * 0.5 }
          : null,
        recoveredRoomFloorPolygon: geometry?.boundary ?? null,
        recoveredRoomFloorBounds: recoveredBounds,
        recoveredRoomFloorCenter: recoveredCenter,
        deltaRoomFloorToWallsCenter:
          wallBounds && recoveredCenter
            ? {
                dx: Math.abs(recoveredCenter.x - (wallBounds.minX + wallBounds.maxX) * 0.5),
                dz: Math.abs(recoveredCenter.y - (wallBounds.minZ + wallBounds.maxZ) * 0.5),
              }
            : null,
      });
      if (!geometry) {
        roomTemperatureWarnings.push(`Пол помещения ${room.id} не отображен в 3D: геометрия помещения не совпадает со стенами.`);
        return [];
      }
      const roomTemperature = showTemperature ? roomTemperatures.get(room.id)?.temperature_C ?? null : null;
      const temperature_C = roomTemperature;
      if (showTemperature && roomTemperature === null) {
        roomTemperatureWarnings.push(`Температура помещения ${room.id} не отображена в 3D: нет данных по помещению.`);
      }
      return [
        {
          id: room.id,
          levelId: room.levelId,
          boundary: geometry.boundary,
          elevation_m: getLevelElevation(model, room.levelId),
          temperature_C,
          geometrySource: geometry.source,
          alignedWithWalls: true,
        } satisfies RecoveredRoomModel,
      ];
    });

  const walls: RecoveredWallModel[] = model.walls
    .filter((wall) => !levelId || wall.levelId === levelId)
    .map((wall) => ({
      id: wall.id,
      levelId: wall.levelId,
      start: { ...wall.a },
      end: { ...wall.b },
      elevation_m: getLevelElevation(model, wall.levelId),
      height_m: wall.height_m,
      thickness_m: wall.thickness_m,
      temperature_C: options.thermalField ? sampleWallSurfaceTemperatures(options.thermalField, wall.id)?.averageC ?? null : null,
    }));

  const windows = buildRecoveredOpenings(model, levelId, "window");
  const doors = buildRecoveredOpenings(model, levelId, "door");

  const roofs: RecoveredRoofModel[] = (model.roofs ?? [])
    .filter((roof) => !levelId || roof.levelId === levelId)
    .map((roof) => ({
      id: roof.id,
      levelId: roof.levelId,
      boundary: roof.boundary.map((point) => ({ ...point })),
      elevation_m: roof.elevationBase_m,
      thickness_m: roof.thickness_m,
    }));

  const slabs: RecoveredSlabModel[] = (model.floorSlabs ?? [])
    .filter((slab) => !levelId || slab.levelId === levelId)
    .map((slab) => ({
      id: slab.id,
      levelId: slab.levelId,
      boundary: slab.boundary.map((point) => ({ ...point })),
      elevation_m: slab.elevation_m,
      thickness_m: slab.thickness_m,
    }));

  const pipes: RecoveredPipeModel[] = showNetworks
    ? model.pipes
        .filter((pipe) => !levelId || pipe.levelId === levelId)
        .map((pipe) => {
          const elevation_m = getLevelElevation(model, pipe.levelId) + 0.24;
          return {
            id: pipe.id,
            levelId: pipe.levelId,
            path: pipe.path.map((point) => planToRecoveredScene(point, elevation_m)),
            diameter_m: Math.max(pipe.diameter_mm / 1000, 0.025),
            colorRole: pipe.type === "heating_return" ? "return" : "supply",
          };
        })
    : [];

  const ducts: RecoveredDuctModel[] = showNetworks
    ? model.ducts
        .filter((duct) => !levelId || duct.levelId === levelId)
        .map((duct) => {
          const elevation_m = getLevelElevation(model, duct.levelId) + 2.3;
          return {
            id: duct.id,
            levelId: duct.levelId,
            path: duct.path.map((point) => planToRecoveredScene(point, elevation_m)),
            width_m: Math.max(0.12, (duct.section.width_mm ?? duct.section.diameter_mm ?? 300) / 1000),
            height_m: Math.max(0.08, (duct.section.height_mm ?? duct.section.diameter_mm ?? 240) / 1000),
          };
        })
    : [];

  const equipment: RecoveredEquipmentModel[] = showEquipment
    ? model.equipment
        .filter((item) => !levelId || item.levelId === levelId)
        .map((item) => ({
          id: item.id,
          levelId: item.levelId,
          type: item.type,
          position: planToRecoveredScene(
            item.position,
            getLevelElevation(model, item.levelId) +
              (item.type === "diffuser" ? 2.7 : item.type === "radiator" ? 0.28 : item.type === "boiler" ? 0.5 : 0.24)
          ),
        }))
    : [];

  const sensors: RecoveredSensorModel[] = showEquipment
    ? model.sensors
        .filter((sensor) => !levelId || sensor.levelId === levelId)
        .map((sensor) => ({
          id: sensor.id,
          levelId: sensor.levelId,
          position: planToRecoveredScene(sensor.position, getLevelElevation(model, sensor.levelId) + 1.6),
        }))
    : [];

  const coordinateWarnings = collectRecoveredCoordinateWarnings(model, options.thermalField ?? null, rooms);
  const temperatureSummary = showTemperature
    ? summarizeRecoveredRoomTemperatures(
        rooms,
        [
          ...roomTemperatureWarnings,
          ...(showWallTemperature ? ["Температура в 3D отображается только по помещениям."] : []),
        ]
      )
    : null;

  const withoutBounds = {
    levelId,
    rooms,
    walls,
    windows,
    doors,
    roofs,
    slabs,
    pipes,
    ducts,
    equipment,
    sensors,
    temperatureSurfaces: [],
    temperatureSummary,
  };
  const bounds = buildRecoveredBounds(withoutBounds);
  const warnings = [...(temperatureSummary?.warnings ?? []), ...coordinateWarnings];

  logDebug("counts", {
    rooms: rooms.length,
    walls: walls.length,
    windows: windows.length,
    doors: doors.length,
    roofs: roofs.length,
    slabs: slabs.length,
    pipes: pipes.length,
    ducts: ducts.length,
    equipment: equipment.length,
    thermalSurfaces: 0,
  });

  return {
    ...withoutBounds,
    bounds,
    warnings,
  };
}
