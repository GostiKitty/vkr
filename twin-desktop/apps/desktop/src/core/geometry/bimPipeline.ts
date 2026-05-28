import type { BuildingModel, Door, FloorSlab, Roof, Room, Vec2, Wall, Window } from "../../entities/geometry/types";
import { pointToSegmentDistance, polygonArea, polygonCentroid, validateRoomPolygon } from "../../entities/geometry/geom";
import { detectRoomsFromWalls, type RoomLoopCandidate } from "./roomContours";

const WALL_MATCH_TOLERANCE = 0.25;
const WALL_DUPLICATE_TOLERANCE = 0.05;

export interface RoomVolumeDescriptor {
  roomId: string;
  levelId: string;
  polygon: Vec2[];
  source: "walls" | "room";
  insetDistanceM: number;
  centroid: Vec2;
  areaM2: number;
}

export interface OpeningCutDescriptor {
  id: string;
  type: "door" | "window";
  startOffsetM: number;
  widthM: number;
  heightM: number;
  sillM?: number;
  uValue_W_m2K?: number;
}

export interface WallRenderDescriptor {
  wall: Wall;
  openings: OpeningCutDescriptor[];
}

export interface GeometryRenderModel {
  roomVolumes: RoomVolumeDescriptor[];
  walls: WallRenderDescriptor[];
  roofs: Roof[];
  floorSlabs: FloorSlab[];
}

export function buildGeometryRenderModel(model: BuildingModel): GeometryRenderModel {
  const uniqueWalls = dedupeWalls(model.walls);
  const wallsById = new Map(uniqueWalls.map((wall) => [wall.id, wall]));
  const detected = detectRoomsFromWalls({ ...model, walls: uniqueWalls });
  const loops = detected.loops.filter((loop) => loop.valid);
  const roomsById = new Map(model.rooms.map((room) => [room.id, room]));

  const roomVolumes = loops.map((loop) => {
    const sourceRoom = loop.roomId ? roomsById.get(loop.roomId) : undefined;
    const room = sourceRoom ?? {
      id: loop.roomId ?? loop.id,
      name: `Помещение ${roomsById.size + 1}`,
      levelId: loop.levelId,
      polygon: loop.polygon,
      source: "auto" as const,
    };
    const polygon = buildRoomPolygonFromWalls({ ...model, walls: uniqueWalls }, room, loops);
    const polygonSignature = polygon.map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`).join("|");
    const roomSignature = room.polygon.map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`).join("|");
    const derivedFromWalls = polygonSignature !== roomSignature || !sourceRoom;
    const insetDistanceM = estimateRoomInsetDistance(uniqueWalls, room.levelId, polygon);
    const innerPolygon = insetDistanceM > 0 ? insetPolygon(polygon, insetDistanceM) : polygon;
    const validation = validateRoomPolygon(innerPolygon);
    const finalPolygon = validation.valid && (validation.normalized?.length ?? 0) >= 3 ? validation.normalized ?? innerPolygon : polygon;
    return extrudeRoomVolume(room, finalPolygon, insetDistanceM, derivedFromWalls || insetDistanceM > 0 ? "walls" : "room");
  });

  const renderedRoomIds = new Set(roomVolumes.map((room) => room.roomId));
  dedupeRoomsForRender(model.rooms)
    .filter((room) => !renderedRoomIds.has(room.id))
    .forEach((room) => {
      const polygon = buildRoomPolygonFromWalls({ ...model, walls: uniqueWalls }, room, loops);
      const insetDistanceM = estimateRoomInsetDistance(uniqueWalls, room.levelId, polygon);
      const innerPolygon = insetDistanceM > 0 ? insetPolygon(polygon, insetDistanceM) : polygon;
      const validation = validateRoomPolygon(innerPolygon);
      const finalPolygon = validation.valid && (validation.normalized?.length ?? 0) >= 3 ? validation.normalized ?? innerPolygon : polygon;
      roomVolumes.push(extrudeRoomVolume(room, finalPolygon, insetDistanceM, insetDistanceM > 0 ? "walls" : "room"));
    });

  const openingsByWall = new Map<string, OpeningCutDescriptor[]>();
  model.doors.forEach((door) => attachOpeningDescriptor(openingsByWall, wallsById, door, "door"));
  model.windows.forEach((window) => attachOpeningDescriptor(openingsByWall, wallsById, window, "window"));

  return {
    roomVolumes,
    walls: uniqueWalls.map((wall) => ({
      wall,
      openings: cutOpeningInWall(wall, openingsByWall.get(wall.id) ?? []),
    })),
    roofs: (model.roofs ?? []).map(cloneRoofForRender),
    floorSlabs: (model.floorSlabs ?? []).map(cloneFloorSlabForRender),
  };
}

function cloneRoofForRender(roof: Roof): Roof {
  return {
    ...roof,
    boundary: roof.boundary.map((point) => ({ ...point })),
    slope: roof.slope ? { ...roof.slope } : undefined,
    layers: roof.layers?.map((layer) => ({ ...layer })),
  };
}

function cloneFloorSlabForRender(slab: FloorSlab): FloorSlab {
  return {
    ...slab,
    boundary: slab.boundary.map((point) => ({ ...point })),
    layers: slab.layers?.map((layer) => ({ ...layer })),
  };
}

export function buildRoomPolygonFromWalls(
  model: BuildingModel,
  room: Room,
  loops = detectRoomsFromWalls(model).loops
): Vec2[] {
  const roomCentroid = polygonCentroid(room.polygon);
  const sameLevelLoops: RoomLoopCandidate[] = loops.filter((loop) => loop.valid && loop.levelId === room.levelId);
  const directMatch = sameLevelLoops.find((loop) => loop.roomId === room.id);
  if (directMatch) {
    return directMatch.polygon.map((point) => ({ ...point }));
  }

  let bestLoopIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  sameLevelLoops.forEach((loop, index) => {
    const loopCentroid = polygonCentroid(loop.polygon);
    const areaDelta = Math.abs(Math.abs(polygonArea(loop.polygon)) - Math.abs(polygonArea(room.polygon)));
    const centroidDistance = Math.hypot(loopCentroid.x - roomCentroid.x, loopCentroid.y - roomCentroid.y);
    const score = centroidDistance * 4 + areaDelta;
    if (score < bestScore) {
      bestLoopIndex = index;
      bestScore = score;
    }
  });

  if (bestLoopIndex >= 0) {
    return sameLevelLoops[bestLoopIndex].polygon.map((point: Vec2) => ({ ...point }));
  }
  return room.polygon.map((point) => ({ ...point }));
}

export function extrudeRoomVolume(
  room: Room,
  polygon: Vec2[],
  insetDistanceM: number,
  source: "walls" | "room"
): RoomVolumeDescriptor {
  const normalized = validateRoomPolygon(polygon).normalized ?? polygon;
  return {
    roomId: room.id,
    levelId: room.levelId,
    polygon: normalized.map((point) => ({ ...point })),
    source,
    insetDistanceM,
    centroid: polygonCentroid(normalized),
    areaM2: Math.abs(polygonArea(normalized)),
  };
}

function buildPolygonSignatureForVolumeDedupe(points: Vec2[]): string {
  return points.map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`).join("|");
}

/**
 * Сводит дубликаты объёмов с одинаковым контуром к одному `roomId` из модели (как в `buildCanonical3DModel`).
 * Без этого `ThermalFieldModel` и 3D-геометрия расходятся по ключам, и температурное поле «пропадает».
 */
export function dedupeRoomVolumesForModel(
  roomVolumes: RoomVolumeDescriptor[],
  modelRooms: Room[],
  activeLevelId: string | null
): RoomVolumeDescriptor[] {
  const grouped = new Map<string, RoomVolumeDescriptor[]>();
  roomVolumes
    .filter((room) => !activeLevelId || room.levelId === activeLevelId)
    .forEach((room) => {
      const key = `${room.levelId}:${buildPolygonSignatureForVolumeDedupe(room.polygon)}`;
      const list = grouped.get(key) ?? [];
      list.push(room);
      grouped.set(key, list);
    });

  const roomsById = new Map(modelRooms.map((room) => [room.id, room]));
  const usedRoomIds = new Set<string>();

  return [...grouped.values()].map((variants) => {
    const manualVariant = variants.find((variant) => roomsById.has(variant.roomId) && !usedRoomIds.has(variant.roomId));
    if (manualVariant) {
      usedRoomIds.add(manualVariant.roomId);
      return manualVariant;
    }

    const fallback = variants[0]!;
    const center = polygonCentroid(fallback.polygon);
    const area = Math.abs(polygonArea(fallback.polygon));
    const matchedRoom = modelRooms
      .filter((room) => room.levelId === fallback.levelId && !usedRoomIds.has(room.id))
      .map((room) => {
        const roomCenter = polygonCentroid(room.polygon);
        const roomArea = Math.abs(polygonArea(room.polygon));
        const score = Math.hypot(roomCenter.x - center.x, roomCenter.y - center.y) * 4 + Math.abs(roomArea - area);
        return { room, score };
      })
      .sort((left, right) => left.score - right.score)[0]?.room;

    if (matchedRoom) {
      usedRoomIds.add(matchedRoom.id);
      return {
        ...fallback,
        roomId: matchedRoom.id,
      };
    }

    return fallback;
  });
}

export function cutOpeningInWall(
  wall: Wall,
  openings: OpeningCutDescriptor[]
): OpeningCutDescriptor[] {
  const wallLength = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  return openings
    .map((opening) => ({
      ...opening,
      startOffsetM: clamp(opening.startOffsetM, 0, Math.max(0, wallLength - opening.widthM)),
      widthM: clamp(opening.widthM, 0.1, wallLength),
    }))
    .filter((opening) => opening.startOffsetM + opening.widthM <= wallLength + 1e-6)
    .sort((left, right) => left.startOffsetM - right.startOffsetM);
}

export function dedupeWalls(walls: Wall[]): Wall[] {
  const unique: Wall[] = [];
  walls.forEach((candidate) => {
    const duplicate = unique.some((existing) => areWallsEquivalent(existing, candidate));
    if (!duplicate) {
      unique.push({
        ...candidate,
        a: { ...candidate.a },
        b: { ...candidate.b },
      });
    }
  });
  return unique;
}

function dedupeRoomsForRender(rooms: Room[]): Room[] {
  const seen = new Set<string>();
  const unique: Room[] = [];
  rooms.forEach((room) => {
    const normalized = validateRoomPolygon(room.polygon).normalized ?? room.polygon;
    const signature = `${room.levelId}:${normalized.map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`).join("|")}`;
    if (seen.has(signature)) {
      return;
    }
    seen.add(signature);
    unique.push(room);
  });
  return unique;
}

function attachOpeningDescriptor(
  openingsByWall: Map<string, OpeningCutDescriptor[]>,
  wallsById: Map<string, Wall>,
  opening: Door | Window,
  type: "door" | "window"
) {
  if (!opening.anchor.wallId) {
    return;
  }
  const wall = wallsById.get(opening.anchor.wallId);
  if (!wall) {
    return;
  }
  const wallLength = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const startOffsetM = clamp(resolveOpeningOffset(opening, wall), 0, Math.max(0, wallLength - opening.width_m));
  const list = openingsByWall.get(wall.id) ?? [];
  list.push({
    id: opening.id,
    type,
    startOffsetM,
    widthM: opening.width_m,
    heightM: opening.height_m,
    sillM: type === "window" ? (opening as Window).sill_m : undefined,
    uValue_W_m2K: opening.runtimeU_W_m2K,
  });
  openingsByWall.set(wall.id, list);
}

function estimateRoomInsetDistance(walls: Wall[], levelId: string, polygon: Vec2[]): number {
  const thicknesses: number[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    let bestMatchThickness: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    walls.forEach((wall) => {
      if (wall.levelId !== levelId) {
        return;
      }
      const distance = pointToSegmentDistance(midpoint, wall.a, wall.b);
      if (distance > WALL_MATCH_TOLERANCE || distance >= bestDistance) {
        return;
      }
      bestDistance = distance;
      bestMatchThickness = wall.thickness_m;
    });
    if (bestMatchThickness !== null) {
      thicknesses.push(bestMatchThickness);
    }
  }
  if (!thicknesses.length) {
    return 0;
  }
  const averageThickness = thicknesses.reduce((sum, value) => sum + value, 0) / thicknesses.length;
  return clamp(averageThickness * 0.46, 0, 0.24);
}

function insetPolygon(polygon: Vec2[], insetDistanceM: number): Vec2[] {
  if (insetDistanceM <= 1e-6 || polygon.length < 3) {
    return polygon.map((point) => ({ ...point }));
  }
  const orientation = polygonArea(polygon) < 0 ? -1 : 1;
  return polygon.map((point, index) => {
    const prev = polygon[(index - 1 + polygon.length) % polygon.length];
    const next = polygon[(index + 1) % polygon.length];
    const prevDir = normalize({ x: point.x - prev.x, y: point.y - prev.y });
    const nextDir = normalize({ x: next.x - point.x, y: next.y - point.y });
    const prevNormal = inwardNormal(prevDir, orientation);
    const nextNormal = inwardNormal(nextDir, orientation);
    const prevA = add(prev, scale(prevNormal, insetDistanceM));
    const prevB = add(point, scale(prevNormal, insetDistanceM));
    const nextA = add(point, scale(nextNormal, insetDistanceM));
    const nextB = add(next, scale(nextNormal, insetDistanceM));
    return lineIntersection(prevA, prevB, nextA, nextB) ?? add(point, scale(normalize(add(prevNormal, nextNormal)), insetDistanceM));
  });
}

function inwardNormal(direction: Vec2, orientation: number): Vec2 {
  return orientation < 0 ? { x: direction.y, y: -direction.x } : { x: -direction.y, y: direction.x };
}

function lineIntersection(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const denominator = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(denominator) <= 1e-8) {
    return null;
  }
  const determinantA = a1.x * a2.y - a1.y * a2.x;
  const determinantB = b1.x * b2.y - b1.y * b2.x;
  return {
    x: (determinantA * (b1.x - b2.x) - (a1.x - a2.x) * determinantB) / denominator,
    y: (determinantA * (b1.y - b2.y) - (a1.y - a2.y) * determinantB) / denominator,
  };
}

function areWallsEquivalent(left: Wall, right: Wall): boolean {
  if (left.levelId !== right.levelId) {
    return false;
  }
  const directMatch =
    pointDistance(left.a, right.a) <= WALL_DUPLICATE_TOLERANCE && pointDistance(left.b, right.b) <= WALL_DUPLICATE_TOLERANCE;
  const reverseMatch =
    pointDistance(left.a, right.b) <= WALL_DUPLICATE_TOLERANCE && pointDistance(left.b, right.a) <= WALL_DUPLICATE_TOLERANCE;
  return (directMatch || reverseMatch) && Math.abs(left.thickness_m - right.thickness_m) <= 0.02;
}

function resolveOpeningOffset(opening: Door | Window, wall: Wall): number {
  const wallLength = Math.max(1e-6, Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y));
  const normalized = clamp(opening.anchor.t, 0, 1) * wallLength;
  return clamp((normalized + clamp(opening.anchor.offset_m, 0, wallLength)) / 2, 0, wallLength);
}

function add(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y };
}

function scale(vector: Vec2, factor: number): Vec2 {
  return { x: vector.x * factor, y: vector.y * factor };
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 1e-8) {
    return { x: 0, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
}

function pointDistance(left: Vec2, right: Vec2): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
