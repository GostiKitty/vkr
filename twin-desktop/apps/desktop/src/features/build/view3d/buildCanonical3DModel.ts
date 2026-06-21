import { polygonContainsPoint, validateRoomPolygon } from "../../../entities/geometry/geom";
import type { BuildingModel, FloorSlab, Stair, Vec2, Wall } from "../../../entities/geometry/types";
import { computeWallJoinData } from "./wallJoins";
import { roundedContourPoints } from "../../../core/geometry/fillets";
import type { Equipment } from "../../../entities/networks/types";
import type { ThermalFieldModel } from "../../../core/thermal/field";
import {
  buildResolvedGeometryRenderModel,
  finalizeRoomVolumesForModel,
  type GeometryRenderModel,
  type OpeningCutDescriptor,
} from "../../../core/geometry/bimPipeline";

export const DEBUG_CANONICAL_3D_ALIGNMENT = false;

/** Нахлёст стены под дугу скругления в 3D — убирает шов/z-fighting между стеной и плитой угла. */
const FILLET_WALL_OVERLAP_M = 0.06;

export interface CanonicalScenePoint {
  x: number;
  y: number;
  z: number;
}

export interface CanonicalRoomModel {
  id: string;
  levelId: string;
  boundary: Vec2[];
  elevation_m: number;
  temperature_C: number | null;
  /** Заполняется, если температура взята из запасного правила (усреднение / наружный воздух). */
  temperatureFillReason?: string;
  geometrySource: "renderGeometry" | "modelRoom";
}

export interface CanonicalTemperatureSurface {
  id: string;
  sourceType: "room" | "shell-fallback";
  roomId: string | null;
  levelId: string;
  boundary: Vec2[];
  elevation_m: number;
  temperature_C: number;
  geometrySource: "renderGeometry" | "modelRoom" | "shell";
  warning?: string;
}

export interface CanonicalWallModel {
  id: string;
  levelId: string;
  start: Vec2;
  end: Vec2;
  elevation_m: number;
  height_m: number;
  thickness_m: number;
  temperature_C: number | null;
  temperatureSource: "thermalField.boundaries" | "room-temperature" | null;
  adjacentRoomId: string | null;
}

export interface CanonicalOpeningModel {
  id: string;
  type: "window" | "door";
  levelId: string;
  center: CanonicalScenePoint;
  wallCenter: CanonicalScenePoint;
  width_m: number;
  height_m: number;
  depth_m: number;
  rotationY_rad: number;
  wallId: string;
  /** Interior surface temperature (°C). Null when thermal field is unavailable. */
  temperature_C: number | null;
  /** True when the opening is in an exterior wall (facing outdoors). */
  isExterior: boolean;
}

export interface CanonicalRoofModel {
  id: string;
  levelId: string;
  boundary: Vec2[];
  elevation_m: number;
  thickness_m: number;
  kind: "flat" | "pitched";
  slope?: { directionDeg: number; risePerMeter: number };
}

export interface CanonicalSlabModel {
  id: string;
  levelId: string;
  kind: FloorSlab["kind"];
  boundary: Vec2[];
  elevation_m: number;
  thickness_m: number;
}

export interface CanonicalStairModel {
  id: string;
  levelId: string;
  /** Прямоугольный контур подошвы лестницы в плане. */
  boundary: Vec2[];
  elevation_m: number;
  stepCount: number;
  totalRise_m: number;
}

export interface CanonicalPipeModel {
  id: string;
  levelId: string;
  path: CanonicalScenePoint[];
  diameter_m: number;
  colorRole: "supply" | "return";
}

export interface CanonicalDuctModel {
  id: string;
  levelId: string;
  path: CanonicalScenePoint[];
  width_m: number;
  height_m: number;
}

export interface CanonicalEquipmentModel {
  id: string;
  levelId: string;
  type: Equipment["type"];
  position: CanonicalScenePoint;
}

export interface CanonicalSensorModel {
  id: string;
  levelId: string;
  position: CanonicalScenePoint;
}

export interface CanonicalRoomTemperatureInfo {
  levelId: string;
  temperature_C: number;
  source: "thermalField.rooms" | "thermalField.roomMap";
}

export interface CanonicalTemperatureSummary {
  min_C: number;
  max_C: number;
  average_C: number;
  coloredRoomCount: number;
  warnings: string[];
}

/** Скруглённый угол стыка стен — кольцевой сектор (дуга) для 3D. */
export interface CanonicalWallFilletModel {
  id: string;
  levelId: string;
  /** Центр дуги в плане. */
  center: Vec2;
  /** Радиус осевой линии скругления, м. */
  radius_m: number;
  thickness_m: number;
  height_m: number;
  elevation_m: number;
  startAngle: number;
  signedSweep: number;
  turnAngle: number;
  /** Температура угла (среднее по двум примыкающим стенам) — для совпадения материала со стенами. */
  temperature_C: number | null;
}

export interface Canonical3DModel {
  levelId: string | null;
  canonicalSource: "renderGeometry";
  rooms: CanonicalRoomModel[];
  temperatureSurfaces: CanonicalTemperatureSurface[];
  walls: CanonicalWallModel[];
  wallFillets: CanonicalWallFilletModel[];
  windows: CanonicalOpeningModel[];
  doors: CanonicalOpeningModel[];
  roofs: CanonicalRoofModel[];
  slabs: CanonicalSlabModel[];
  stairs: CanonicalStairModel[];
  pipes: CanonicalPipeModel[];
  ducts: CanonicalDuctModel[];
  equipment: CanonicalEquipmentModel[];
  sensors: CanonicalSensorModel[];
  temperatureSummary: CanonicalTemperatureSummary | null;
  warnings: string[];
}

export interface BuildCanonical3DOptions {
  thermalField?: ThermalFieldModel | null;
}

function logCanonicalAlignment(message: string, payload: Record<string, unknown>) {
  if (DEBUG_CANONICAL_3D_ALIGNMENT) {
    console.info("[canonical-3d-alignment]", message, payload);
  }
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

function computePolygonArea(points: Vec2[]) {
  if (points.length < 3) {
    return 0;
  }
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area * 0.5);
}

function computePolygonBoundingIntersectionArea(a: Vec2[], b: Vec2[]) {
  const boundsA = computePolygonBounds(a);
  const boundsB = computePolygonBounds(b);
  const overlapX = Math.max(0, Math.min(boundsA.maxX, boundsB.maxX) - Math.max(boundsA.minX, boundsB.minX));
  const overlapY = Math.max(0, Math.min(boundsA.maxY, boundsB.maxY) - Math.max(boundsA.minY, boundsB.minY));
  return overlapX * overlapY;
}

function meanFiniteTemperature(values: number[]): number | null {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) {
    return null;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function planToCanonicalScene(point: Vec2, elevation_m: number): CanonicalScenePoint {
  return {
    x: point.x,
    y: elevation_m,
    z: point.y,
  };
}

function buildCanonicalOpeningModel(
  wall: Wall,
  opening: OpeningCutDescriptor,
  levelElevation: number
): CanonicalOpeningModel | null {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.y - wall.a.y;
  const wallLength = Math.hypot(dx, dz);
  if (wallLength < 1e-6) {
    return null;
  }
  const direction = { x: dx / wallLength, y: dz / wallLength };
  const centerOffset = opening.startOffsetM + opening.widthM * 0.5;
  const point = {
    x: wall.a.x + direction.x * centerOffset,
    y: wall.a.y + direction.y * centerOffset,
  };
  const sill = opening.type === "window" ? opening.sillM ?? 0.9 : 0;
  const center = planToCanonicalScene(point, levelElevation + sill + opening.heightM * 0.5);
  const wallCenter = planToCanonicalScene(point, levelElevation + opening.heightM * 0.5);
  return {
    id: opening.id,
    type: opening.type,
    levelId: wall.levelId,
    center,
    wallCenter,
    width_m: opening.widthM,
    height_m: opening.heightM,
    depth_m: Math.max(wall.thickness_m * (opening.type === "window" ? 0.4 : 0.55), opening.type === "window" ? 0.06 : 0.08),
    rotationY_rad: -Math.atan2(dz, dx),
    wallId: wall.id,
    temperature_C: null,
    isExterior: false,
  };
}

export function getCanonicalRoomTemperatureMap(
  thermalField: ThermalFieldModel | null | undefined,
  activeLevelId: string | null,
  roomIds: Set<string>
): { roomTemperatures: Map<string, CanonicalRoomTemperatureInfo>; warnings: string[] } {
  const roomTemperatures = new Map<string, CanonicalRoomTemperatureInfo>();
  const warnings: string[] = [];
  if (!thermalField) {
    return { roomTemperatures, warnings };
  }

  const registerRoomTemperature = (
    roomId: string | null | undefined,
    levelId: string,
    temperature_C: number,
    source: CanonicalRoomTemperatureInfo["source"]
  ) => {
    if (!roomId) {
      warnings.push("Температурное значение пропущено: нет roomId.");
      return;
    }
    if (activeLevelId && levelId !== activeLevelId) {
      warnings.push(`Температура помещения ${roomId} пропущена: другой уровень.`);
      return;
    }
    if (!Number.isFinite(temperature_C)) {
      warnings.push(`Температура помещения ${roomId} пропущена: некорректное значение.`);
      return;
    }
    if (!roomIds.has(roomId)) {
      if (import.meta.env?.DEV) {
        console.warn(
          "[canonical-3d] Температура поля не сопоставлена с контуром 3D: roomId отсутствует в acceptedRoomGeometries / модели этажа.",
          { roomId, levelId }
        );
      }
      warnings.push(
        `Температура помещения ${roomId} пропущена: помещение не входит в список комнат активного уровня для визуализации.`
      );
      return;
    }
    if (roomTemperatures.has(roomId) && source === "thermalField.roomMap") {
      return;
    }
    roomTemperatures.set(roomId, {
      levelId,
      temperature_C,
      source,
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

export function summarizeCanonicalRoomTemperatures(
  surfaces: Array<Pick<CanonicalTemperatureSurface, "temperature_C">>,
  warnings: string[]
): CanonicalTemperatureSummary {
  const colored = surfaces.filter((room) => Number.isFinite(room.temperature_C));
  if (!colored.length) {
    return {
      min_C: 0,
      max_C: 0,
      average_C: 0,
      coloredRoomCount: 0,
      warnings: [...new Set([...warnings, "Температурное поле: нет данных по помещениям."])],
    };
  }
  const values = colored.map((room) => room.temperature_C as number);
  return {
    min_C: Math.min(...values),
    max_C: Math.max(...values),
    average_C: values.reduce((sum, value) => sum + value, 0) / values.length,
    coloredRoomCount: colored.length,
    warnings: [...new Set(warnings)],
  };
}

function isPolygonInsideShellBounds(points: Vec2[], shellBounds: ReturnType<typeof collectLevelShellBounds> | null) {
  if (!shellBounds || points.length < 3) {
    return true;
  }
  const roomBounds = computePolygonBounds(points);
  const shellArea = Math.max(shellBounds.size.x * shellBounds.size.y, 1);
  const roomArea = computePolygonArea(points);
  const marginX = Math.max(0.35, shellBounds.size.x * 0.05);
  const marginY = Math.max(0.35, shellBounds.size.y * 0.05);
  const extendsOutside =
    roomBounds.minX < shellBounds.minX - marginX ||
    roomBounds.maxX > shellBounds.maxX + marginX ||
    roomBounds.minY < shellBounds.minY - marginY ||
    roomBounds.maxY > shellBounds.maxY + marginY;
  if (extendsOutside) {
    return false;
  }
  return roomArea <= shellArea * 1.08;
}

function polygonsRoughlyAlign(reference: Vec2[], candidate: Vec2[]) {
  if (reference.length < 3 || candidate.length < 3) {
    return false;
  }
  const referenceArea = Math.max(computePolygonArea(reference), 1e-6);
  const candidateArea = Math.max(computePolygonArea(candidate), 1e-6);
  const areaRatio = Math.max(referenceArea, candidateArea) / Math.min(referenceArea, candidateArea);
  if (areaRatio > 1.7) {
    return false;
  }
  const referenceCenter = computePolygonCenter(reference);
  const candidateCenter = computePolygonCenter(candidate);
  const referenceBounds = computePolygonBounds(reference);
  const diag = Math.hypot(referenceBounds.maxX - referenceBounds.minX, referenceBounds.maxY - referenceBounds.minY);
  if (Math.hypot(referenceCenter.x - candidateCenter.x, referenceCenter.y - candidateCenter.y) > Math.max(0.8, diag * 0.42)) {
    return false;
  }
  const overlap = computePolygonBoundingIntersectionArea(reference, candidate);
  return overlap >= Math.min(referenceArea, candidateArea) * 0.28;
}

function collectLevelShellBounds(renderGeometry: GeometryRenderModel, levelId: string | null) {
  const wallPoints = renderGeometry.walls
    .filter((entry) => !levelId || entry.wall.levelId === levelId)
    .flatMap((entry) => [entry.wall.a, entry.wall.b]);
  const roofPoints = renderGeometry.roofs
    .filter((roof) => !levelId || roof.levelId === levelId)
    .flatMap((roof) => roof.boundary);
  const slabPoints = renderGeometry.floorSlabs
    .filter((slab) => !levelId || slab.levelId === levelId)
    .flatMap((slab) => slab.boundary);
  const allPoints = [...wallPoints, ...roofPoints, ...slabPoints];
  if (!allPoints.length) {
    return null;
  }
  const bounds = computePolygonBounds(allPoints);
  return {
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    center: {
      x: (bounds.minX + bounds.maxX) * 0.5,
      y: (bounds.minY + bounds.maxY) * 0.5,
    },
    size: {
      x: bounds.maxX - bounds.minX,
      y: bounds.maxY - bounds.minY,
    },
  };
}

function collectLevelShellBoundary(
  renderGeometry: GeometryRenderModel,
  model: BuildingModel,
  levelId: string | null
): Vec2[] | null {
  const candidates = [
    ...renderGeometry.floorSlabs.filter((slab) => !levelId || slab.levelId === levelId).map((slab) => slab.boundary),
    ...renderGeometry.roofs.filter((roof) => !levelId || roof.levelId === levelId).map((roof) => roof.boundary),
    ...(model.floorSlabs ?? []).filter((slab) => !levelId || slab.levelId === levelId).map((slab) => slab.boundary),
    ...(model.roofs ?? []).filter((roof) => !levelId || roof.levelId === levelId).map((roof) => roof.boundary),
  ]
    .filter((boundary) => boundary.length >= 3)
    .sort((left, right) => computePolygonArea(right) - computePolygonArea(left));

  return candidates.length ? clonePolygon(candidates[0]!) : null;
}

function boundaryFitsShell(
  boundary: Vec2[],
  shellBounds: ReturnType<typeof collectLevelShellBounds> | null,
  shellBoundary: Vec2[] | null
) {
  if (!isPolygonInsideShellBounds(boundary, shellBounds)) {
    return false;
  }
  if (!shellBoundary?.length) {
    return true;
  }
  const center = computePolygonCenter(boundary);
  return polygonContainsPoint(center, shellBoundary) || polygonsRoughlyAlign(shellBoundary, boundary);
}

/**
 * Допускает помещения, у которых строгая проверка оболочки не прошла из‑за погрешностей контура,
 * но центр и площадь явно лежат внутри габаритов уровня (типичный случай демо‑дома с контурами по осям стен).
 */
function boundaryFitsShellCentroidFallback(
  boundary: Vec2[],
  shellBounds: ReturnType<typeof collectLevelShellBounds> | null,
  shellBoundary: Vec2[] | null
): boolean {
  if (!shellBounds || boundary.length < 3) {
    return false;
  }
  const center = computePolygonCenter(boundary);
  const { minX, maxX, minY, maxY } = computePolygonBounds(boundary);
  const shellArea = Math.max(shellBounds.size.x * shellBounds.size.y, 1e-6);
  const roomArea = computePolygonArea(boundary);
  const centroidInsideAxes =
    center.x >= shellBounds.minX - 1e-3 &&
    center.x <= shellBounds.maxX + 1e-3 &&
    center.y >= shellBounds.minY - 1e-3 &&
    center.y <= shellBounds.maxY + 1e-3;
  const bboxMostlyInside =
    minX >= shellBounds.minX - 0.08 &&
    maxX <= shellBounds.maxX + 0.08 &&
    minY >= shellBounds.minY - 0.08 &&
    maxY <= shellBounds.maxY + 0.08;
  if (!centroidInsideAxes || !bboxMostlyInside || roomArea > shellArea * 1.12) {
    return false;
  }
  if (!shellBoundary?.length) {
    return true;
  }
  return polygonContainsPoint(center, shellBoundary) || polygonsRoughlyAlign(shellBoundary, boundary);
}

function cloneBoundaryIfValid(points: Vec2[] | null | undefined): Vec2[] | null {
  if (!points || points.length < 3) {
    return null;
  }
  return clonePolygon(points);
}

export function buildCanonical3DModel(
  model: BuildingModel,
  activeLevelId: string | null,
  options: BuildCanonical3DOptions = {}
): Canonical3DModel {
  const renderGeometry = buildResolvedGeometryRenderModel(model, activeLevelId);
  const levelMap = new Map(model.levels.map((level) => [level.id, level]));
  const filterLevel = <T extends { levelId: string }>(items: T[]) =>
    activeLevelId ? items.filter((item) => item.levelId === activeLevelId) : items;

  const warnings: string[] = [];
  const levelShellBounds = collectLevelShellBounds(renderGeometry, activeLevelId);
  const levelShellBoundary = collectLevelShellBoundary(renderGeometry, model, activeLevelId);
  const canonicalRoomVolumes = renderGeometry.roomVolumes;
  const roomsById = new Map(model.rooms.map((room) => [room.id, room]));
  const acceptedRoomGeometries = new Map<
    string,
    { boundary: Vec2[]; levelId: string; elevation_m: number; geometrySource: CanonicalRoomModel["geometrySource"] }
  >();

  canonicalRoomVolumes.forEach((roomVolume) => {
    const levelElevation = levelMap.get(roomVolume.levelId)?.elevation_m ?? 0;
    const renderBoundary = cloneBoundaryIfValid(roomVolume.polygon);
    if (renderBoundary && boundaryFitsShell(renderBoundary, levelShellBounds, levelShellBoundary)) {
      acceptedRoomGeometries.set(roomVolume.roomId, {
        boundary: renderBoundary,
        levelId: roomVolume.levelId,
        elevation_m: levelElevation,
        geometrySource: "renderGeometry",
      });
      return;
    }

    if (renderBoundary && boundaryFitsShellCentroidFallback(renderBoundary, levelShellBounds, levelShellBoundary)) {
      acceptedRoomGeometries.set(roomVolume.roomId, {
        boundary: renderBoundary,
        levelId: roomVolume.levelId,
        elevation_m: levelElevation,
        geometrySource: "renderGeometry",
      });
      warnings.push(
        `Помещение ${roomVolume.roomId}: контур пола принят по ослабленной проверке (центр внутри габаритов уровня). Уточните полигон, если геометрия редактировалась вручную.`
      );
      return;
    }

    if (renderBoundary) {
      const levelElevation = levelMap.get(roomVolume.levelId)?.elevation_m ?? 0;
      acceptedRoomGeometries.set(roomVolume.roomId, {
        boundary: renderBoundary,
        levelId: roomVolume.levelId,
        elevation_m: levelElevation,
        geometrySource: "renderGeometry",
      });
      if (!roomsById.has(roomVolume.roomId)) {
        warnings.push(
          `Помещение ${roomVolume.roomId}: 3D-пол построен по автоконтуру стен (без привязки к оболочке уровня).`
        );
      }
    }
  });

  model.rooms.forEach((room) => {
    if (activeLevelId && room.levelId !== activeLevelId) {
      return;
    }
    if (acceptedRoomGeometries.has(room.id)) {
      return;
    }
    const normalized = validateRoomPolygon(room.polygon).normalized ?? room.polygon;
    const fromModel = cloneBoundaryIfValid(normalized);
    if (!fromModel) {
      warnings.push(`Помещение ${room.id}: некорректный полигон в модели, 3D-пол пропущен.`);
      return;
    }
    const levelElevation = levelMap.get(room.levelId)?.elevation_m ?? 0;
    if (boundaryFitsShell(fromModel, levelShellBounds, levelShellBoundary)) {
      acceptedRoomGeometries.set(room.id, {
        boundary: fromModel,
        levelId: room.levelId,
        elevation_m: levelElevation,
        geometrySource: "modelRoom",
      });
      return;
    }
    if (boundaryFitsShellCentroidFallback(fromModel, levelShellBounds, levelShellBoundary)) {
      acceptedRoomGeometries.set(room.id, {
        boundary: fromModel,
        levelId: room.levelId,
        elevation_m: levelElevation,
        geometrySource: "modelRoom",
      });
      warnings.push(
        `Помещение ${room.id}: для 3D использован полигон из модели с ослабленной проверкой габаритов уровня.`
      );
    }
  });

  model.rooms.forEach((room) => {
    if (activeLevelId && room.levelId !== activeLevelId) {
      return;
    }
    if (acceptedRoomGeometries.has(room.id)) {
      return;
    }
    const normalizedForShell = validateRoomPolygon(room.polygon).normalized ?? room.polygon;
    const boundary = cloneBoundaryIfValid(normalizedForShell);
    if (!boundary) {
      warnings.push(`Помещение ${room.id}: некорректный полигон в модели, 3D-пол пропущен.`);
      return;
    }
    const levelElevation = levelMap.get(room.levelId)?.elevation_m ?? 0;
    acceptedRoomGeometries.set(room.id, {
      boundary,
      levelId: room.levelId,
      elevation_m: levelElevation,
      geometrySource: "modelRoom",
    });
    warnings.push(
      `Помещение ${room.id}: 3D-пол построен по контуру плана (без привязки к оболочке уровня).`
    );
  });

  const roomsOnActiveLevelIds = new Set(
    model.rooms.filter((room) => !activeLevelId || room.levelId === activeLevelId).map((room) => room.id)
  );
  const roomIds = new Set([...acceptedRoomGeometries.keys(), ...roomsOnActiveLevelIds]);
  const temperatureMap = getCanonicalRoomTemperatureMap(options.thermalField, activeLevelId, roomIds);

  // Скругляем контур комнаты по тем же стыкам, чтобы пол/объём/температурные поверхности
  // повторяли скруглённые стены, а не торчали квадратным углом за круглую геометрию здания.
  const roundRoomBoundary = (poly: Vec2[], levelId: string): Vec2[] => {
    const levelFillets = (model.wallFillets ?? []).filter((fillet) => fillet.levelId === levelId);
    if (!levelFillets.length) {
      return poly;
    }
    const radiusForIndex = (index: number): number => {
      const vertex = poly[index];
      const match = levelFillets.find(
        (fillet) => Math.hypot(fillet.point.x - vertex.x, fillet.point.y - vertex.y) <= 0.3
      );
      return match?.radius_m ?? 0;
    };
    return roundedContourPoints(poly, radiusForIndex, 8);
  };
  const rooms = [...acceptedRoomGeometries.entries()].map(([roomId, geometry]) => {
    const boundary = roundRoomBoundary(clonePolygon(geometry.boundary), geometry.levelId);
    const center = computePolygonCenter(boundary);
    const mapped = temperatureMap.roomTemperatures.get(roomId)?.temperature_C ?? null;
    let temperature_C: number | null = Number.isFinite(mapped as number) ? (mapped as number) : null;
    let temperatureFillReason: string | undefined;
    if (temperature_C === null && options.thermalField) {
      const levelMean = meanFiniteTemperature(
        options.thermalField.rooms.filter((entry) => entry.levelId === geometry.levelId).map((entry) => entry.baseTemperatureC)
      );
      const globalMean = meanFiniteTemperature(options.thermalField.rooms.map((entry) => entry.baseTemperatureC));
      const filled = levelMean ?? globalMean ?? options.thermalField.outdoorTemperatureC;
      temperature_C = Number.isFinite(filled) ? (filled as number) : 20;
      temperatureFillReason =
        levelMean !== null
          ? "Усреднено по этажу: нет значения в карте поля для этого помещения."
          : "Запасное значение по зданию или наружному воздуху.";
    }
    logCanonicalAlignment("room-floor", {
      roomId,
      levelId: geometry.levelId,
      roomFloorCenter: center,
      roomFloorBounds: computePolygonBounds(boundary),
      shellBounds: levelShellBounds,
      temperature_C: temperatureMap.roomTemperatures.get(roomId)?.temperature_C ?? temperature_C,
    });
    return {
      id: roomId,
      levelId: geometry.levelId,
      boundary,
      elevation_m: geometry.elevation_m,
      temperature_C,
      temperatureFillReason,
      geometrySource: geometry.geometrySource,
    };
  });

  const temperatureSurfaces: CanonicalTemperatureSurface[] = rooms
    .filter((room) => Number.isFinite(room.temperature_C))
    .map((room) => ({
      id: `room:${room.id}`,
      sourceType: "room",
      roomId: room.id,
      levelId: room.levelId,
      boundary: clonePolygon(room.boundary),
      elevation_m: room.elevation_m,
      temperature_C: room.temperature_C as number,
      geometrySource: room.geometrySource,
      warning: room.temperatureFillReason,
    }));

  if (!temperatureSurfaces.length && options.thermalField) {
    const levelsToCover = activeLevelId ? [activeLevelId] : [...new Set(model.levels.map((level) => level.id))];
    let addedShell = false;
    for (const levelId of levelsToCover) {
      const boundary = collectLevelShellBoundary(renderGeometry, model, levelId);
      if (!boundary?.length) {
        continue;
      }
      const levelRooms = options.thermalField.rooms.filter(
        (room) => room.levelId === levelId && Number.isFinite(room.baseTemperatureC)
      );
      if (!levelRooms.length) {
        continue;
      }
      const averageTemperature = levelRooms.reduce((sum, room) => sum + room.baseTemperatureC, 0) / levelRooms.length;
      temperatureSurfaces.push({
        id: `shell:${levelId}`,
        sourceType: "shell-fallback",
        roomId: null,
        levelId,
        boundary: clonePolygon(boundary),
        elevation_m: levelMap.get(levelId)?.elevation_m ?? 0,
        temperature_C: averageTemperature,
        geometrySource: "shell",
        warning: "Температурное поле построено по укрупненной оболочке этажа.",
      });
      addedShell = true;
    }
    if (addedShell) {
      warnings.push(
        activeLevelId
          ? "Температурное поле построено по укрупненной оболочке этажа."
          : "Температурное поле построено по укрупнённой оболочке этажей (режим «все уровни»)."
      );
    }
  }

  // Скругления стыков стен: подрезка концов стен и дуги углов (общий резолвер).
  const filletWalls = renderGeometry.walls
    .filter((entry) => !activeLevelId || entry.wall.levelId === activeLevelId)
    .map((entry) => entry.wall);
  const wallJoinData = computeWallJoinData({
    walls: filletWalls,
    levels: model.levels,
    wallFillets: model.wallFillets,
  });

  const walls = renderGeometry.walls
    .filter((entry) => !activeLevelId || entry.wall.levelId === activeLevelId)
    .map(({ wall }) => {
      const boundary = options.thermalField?.boundaryByWallId.get(wall.id);
      const trim = wallJoinData.filletTrims.get(wall.id);
      const wallLength = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) || 1;
      const ux = (wall.b.x - wall.a.x) / wallLength;
      const uy = (wall.b.y - wall.a.y) / wallLength;
      // Небольшой нахлёст: стена заходит под дугу скругления на FILLET_WALL_OVERLAP_M, чтобы между
      // торцом стены и гранью плиты не было шва / z-fighting (как обычные стены перекрываются в углах).
      const startTrim = trim?.start ? Math.max(0, trim.start - FILLET_WALL_OVERLAP_M) : 0;
      const endTrim = trim?.end ? Math.max(0, trim.end - FILLET_WALL_OVERLAP_M) : 0;
      const start = startTrim > 0 ? { x: wall.a.x + ux * startTrim, y: wall.a.y + uy * startTrim } : { ...wall.a };
      const end = endTrim > 0 ? { x: wall.b.x - ux * endTrim, y: wall.b.y - uy * endTrim } : { ...wall.b };

      const resolveAirC = (roomId: string | null | undefined): number | null => {
        if (roomId == null) {
          return null;
        }
        const fromMap = temperatureMap.roomTemperatures.get(roomId)?.temperature_C;
        if (Number.isFinite(fromMap)) {
          return fromMap as number;
        }
        const fromField = options.thermalField?.roomMap.get(roomId)?.baseTemperatureC;
        return Number.isFinite(fromField) ? (fromField as number) : null;
      };

      const positiveRoomTemperature = resolveAirC(boundary?.positiveRoomId);
      const negativeRoomTemperature = resolveAirC(boundary?.negativeRoomId);
      const adjacentRoomId =
        boundary?.positiveRoomId && roomIds.has(boundary.positiveRoomId)
          ? boundary.positiveRoomId
          : boundary?.negativeRoomId && roomIds.has(boundary.negativeRoomId)
            ? boundary.negativeRoomId
            : boundary?.positiveRoomId ?? boundary?.negativeRoomId ?? null;
      const adjacentRoomTemperature = resolveAirC(adjacentRoomId);

      const wallTemperature = (() => {
        if (boundary?.kind === "internal" && positiveRoomTemperature != null && negativeRoomTemperature != null) {
          return (positiveRoomTemperature + negativeRoomTemperature) / 2;
        }
        if (positiveRoomTemperature != null) {
          return positiveRoomTemperature;
        }
        if (negativeRoomTemperature != null) {
          return negativeRoomTemperature;
        }
        return adjacentRoomTemperature;
      })();

      return {
        id: wall.id,
        levelId: wall.levelId,
        start,
        end,
        elevation_m: levelMap.get(wall.levelId)?.elevation_m ?? 0,
        height_m: wall.height_m,
        thickness_m: wall.thickness_m,
        temperature_C: Number.isFinite(wallTemperature) ? (wallTemperature as number) : null,
        temperatureSource:
          boundary && Number.isFinite(wallTemperature)
            ? ("thermalField.boundaries" as const)
            : adjacentRoomTemperature !== null
              ? ("room-temperature" as const)
              : null,
        adjacentRoomId,
      };
    });

  const wallMap = new Map(walls.map((w) => [w.id, w]));
  const outdoorTemp = options.thermalField?.outdoorTemperatureC ?? null;

  const wallFillets: CanonicalWallFilletModel[] = wallJoinData.corners
    .filter((corner) => corner.rounded)
    .map((corner, index) => {
      const rounded = corner.rounded!;
      // Температура угла — среднее по двум примыкающим стенам (для совпадения материала).
      const armTemps = filletWalls
        .filter(
          (w) =>
            Math.hypot(w.a.x - corner.point.x, w.a.y - corner.point.y) <= 0.3 ||
            Math.hypot(w.b.x - corner.point.x, w.b.y - corner.point.y) <= 0.3
        )
        .map((w) => wallMap.get(w.id)?.temperature_C)
        .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
      const temperature_C = armTemps.length
        ? armTemps.reduce((sum, t) => sum + t, 0) / armTemps.length
        : null;
      return {
        id: `wall-fillet-${index}`,
        levelId: activeLevelId ?? "",
        center: { ...rounded.center },
        radius_m: rounded.radius,
        thickness_m: corner.thickness,
        height_m: corner.maxHeight,
        elevation_m: corner.levelElevation,
        startAngle: rounded.startAngle,
        signedSweep: rounded.signedSweep,
        turnAngle: rounded.turnAngle,
        temperature_C,
      };
    });

  const openings = renderGeometry.walls
    .filter((entry) => !activeLevelId || entry.wall.levelId === activeLevelId)
    .flatMap(({ wall, openings: wallOpenings }) => {
      const levelElevation = levelMap.get(wall.levelId)?.elevation_m ?? 0;
      const wallBoundary = options.thermalField?.boundaryByWallId.get(wall.id);
      const isExterior = !wallBoundary || wallBoundary.kind === "external";
      const wallData = wallMap.get(wall.id);

      return wallOpenings
        .map((opening): CanonicalOpeningModel | null => {
          const base = buildCanonicalOpeningModel(wall, opening, levelElevation);
          if (!base) return null;

          let temperature_C: number | null = null;
          const roomTemp = wallData?.temperature_C ?? null;
          if (roomTemp !== null) {
            if (isExterior && outdoorTemp !== null) {
              // Interior surface temperature: biased toward outdoor for exterior openings.
              // Windows (~U=2.0 W/m²K) lose heat faster than doors (~U=1.5).
              const bias = opening.type === "window" ? 0.65 : 0.50;
              temperature_C = roomTemp - bias * (roomTemp - outdoorTemp);
            } else {
              temperature_C = roomTemp;
            }
          }

          return { ...base, temperature_C, isExterior };
        })
        .filter((opening): opening is CanonicalOpeningModel => Boolean(opening));
    });

  const roofs = filterLevel(renderGeometry.roofs).map((roof) => ({
    id: roof.id,
    levelId: roof.levelId,
    boundary: clonePolygon(roof.boundary),
    elevation_m: roof.elevationBase_m,
    thickness_m: roof.thickness_m,
    kind: (roof.kind ?? "flat") as "flat" | "pitched",
    slope: roof.slope ? { ...roof.slope } : undefined,
  }));

  const slabs = filterLevel(renderGeometry.floorSlabs).map((slab) => ({
    id: slab.id,
    levelId: slab.levelId,
    kind: slab.kind,
    boundary: clonePolygon(slab.boundary),
    elevation_m: slab.elevation_m,
    thickness_m: slab.thickness_m,
  }));

  const stairs = filterLevel(model.stairs ?? []).map((stair: Stair) => ({
    id: stair.id,
    levelId: stair.levelId,
    boundary: clonePolygon(stair.boundary),
    elevation_m: levelMap.get(stair.levelId)?.elevation_m ?? 0,
    stepCount: stair.stepCount,
    totalRise_m: stair.totalRise_m,
  }));

  const pipes = filterLevel(model.pipes).map((pipe) => {
    const levelElevation = levelMap.get(pipe.levelId)?.elevation_m ?? 0;
    return {
      id: pipe.id,
      levelId: pipe.levelId,
      path: pipe.path.map((point) => planToCanonicalScene(point, levelElevation + 0.22)),
      diameter_m: Math.max(pipe.diameter_mm / 1000, 0.03),
      colorRole: pipe.type === "heating_return" ? ("return" as const) : ("supply" as const),
    };
  });

  const ducts = filterLevel(model.ducts).map((duct) => {
    const levelElevation = levelMap.get(duct.levelId)?.elevation_m ?? 0;
    return {
      id: duct.id,
      levelId: duct.levelId,
      path: duct.path.map((point) => planToCanonicalScene(point, levelElevation + 2.3)),
      width_m: Math.max(0.12, (duct.section.width_mm ?? duct.section.diameter_mm ?? 300) / 1000),
      height_m: Math.max(0.08, (duct.section.height_mm ?? duct.section.diameter_mm ?? 220) / 1000),
    };
  });

  const equipment = filterLevel(model.equipment).map((item) => {
    const levelElevation = levelMap.get(item.levelId)?.elevation_m ?? 0;
    const baseY =
      item.type === "radiator"
        ? 0.28
        : item.type === "boiler"
          ? 0.5
          : item.type === "ahu"
            ? 0.38
            : item.type === "diffuser"
              ? 2.72
              : item.type === "sensor"
                ? 1.6
                : 0.22;
    return {
      id: item.id,
      levelId: item.levelId,
      type: item.type,
      position: planToCanonicalScene(item.position, levelElevation + baseY),
    };
  });

  const sensors = filterLevel(model.sensors).map((sensor) => {
    const levelElevation = levelMap.get(sensor.levelId)?.elevation_m ?? 0;
    return {
      id: sensor.id,
      levelId: sensor.levelId,
      position: planToCanonicalScene(sensor.position, levelElevation + 1.6),
    };
  });

  const temperatureSummary = summarizeCanonicalRoomTemperatures(temperatureSurfaces, [...temperatureMap.warnings, ...warnings]);

  return {
    levelId: activeLevelId,
    canonicalSource: "renderGeometry",
    rooms,
    temperatureSurfaces,
    walls,
    wallFillets,
    windows: openings.filter((opening) => opening.type === "window"),
    doors: openings.filter((opening) => opening.type === "door"),
    roofs,
    slabs,
    stairs,
    pipes,
    ducts,
    equipment,
    sensors,
    temperatureSummary,
    warnings: [...new Set([...temperatureMap.warnings, ...warnings])],
  };
}
