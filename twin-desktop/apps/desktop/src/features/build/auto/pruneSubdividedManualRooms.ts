import { polygonArea, polygonCentroid, polygonContainsPoint, validateRoomPolygon } from "../../../entities/geometry/geom";
import type { Room } from "../../../entities/geometry/types";
import type { RoomLoopCandidate } from "./detectRoomsFromWalls";

const MIN_CHILD_AREA_M2 = 1;

function normalizeRoomPolygon(polygon: Room["polygon"]): Room["polygon"] {
  return validateRoomPolygon(polygon).normalized ?? polygon;
}

/** Child loops share wall centerlines with the parent boundary — use centroid, not every vertex. */
function isProperSubRegion(inner: Room["polygon"], outer: Room["polygon"], outerArea: number): boolean {
  const innerPolygon = normalizeRoomPolygon(inner);
  const outerPolygon = normalizeRoomPolygon(outer);
  const innerArea = Math.abs(polygonArea(innerPolygon));
  if (innerArea < MIN_CHILD_AREA_M2 || innerArea >= outerArea * 0.995) {
    return false;
  }
  const centroid = polygonCentroid(innerPolygon);
  return polygonContainsPoint(centroid, outerPolygon);
}

function collectChildRegions(
  manual: Room,
  parentPolygon: Room["polygon"],
  parentArea: number,
  manualRooms: Room[],
  loops: RoomLoopCandidate[],
  autoRooms: Room[]
): number[] {
  const areas: number[] = [];
  const seen = new Set<string>();

  const register = (key: string, polygon: Room["polygon"], areaHint?: number) => {
    if (seen.has(key) || !isProperSubRegion(polygon, parentPolygon, parentArea)) {
      return;
    }
    seen.add(key);
    const area = areaHint ?? Math.abs(polygonArea(normalizeRoomPolygon(polygon)));
    if (area >= MIN_CHILD_AREA_M2) {
      areas.push(area);
    }
  };

  manualRooms.forEach((room) => {
    if (room.id === manual.id || room.levelId !== manual.levelId) {
      return;
    }
    register(room.id, room.polygon);
  });

  autoRooms.forEach((room) => {
    if (room.levelId !== manual.levelId) {
      return;
    }
    register(room.id, room.polygon);
  });

  loops.forEach((loop) => {
    if (!loop.valid || loop.levelId !== manual.levelId) {
      return;
    }
    if (loop.roomId === manual.id) {
      return;
    }
    if (loop.roomSource !== "auto" && loop.roomSource !== "manual") {
      return;
    }
    register(loop.roomId ?? loop.id, loop.polygon, loop.area);
  });

  return areas;
}

/**
 * Drops manual rooms that were split into multiple wall-bounded spaces.
 * Keeps the parent when fewer than two valid child loops lie fully inside it.
 */
export function pruneSubdividedManualRooms(
  manualRooms: Room[],
  loops: RoomLoopCandidate[],
  autoRooms: Room[] = []
): { kept: Room[]; removedIds: Set<string> } {
  const removedIds = new Set<string>();

  const kept = manualRooms.filter((manual) => {
    const parentPolygon = normalizeRoomPolygon(manual.polygon);
    const parentArea = Math.abs(polygonArea(parentPolygon));
    if (parentArea <= 0) {
      return true;
    }

    const childAreas = collectChildRegions(manual, parentPolygon, parentArea, manualRooms, loops, autoRooms);
    if (childAreas.length < 2) {
      return true;
    }

    const childArea = childAreas.reduce((sum, area) => sum + area, 0);
    if (childArea < parentArea * 0.45) {
      return true;
    }

    removedIds.add(manual.id);
    return false;
  });

  return { kept, removedIds };
}

export function resolveReplacementRoomId(
  position: { x: number; y: number },
  levelId: string | null | undefined,
  rooms: Room[]
): string | null {
  const candidates = rooms.filter(
    (room) =>
      (!levelId || room.levelId === levelId) &&
      polygonContainsPoint(position, normalizeRoomPolygon(room.polygon))
  );
  if (!candidates.length) {
    return null;
  }
  return candidates.reduce((best, room) => {
    const area = Math.abs(polygonArea(normalizeRoomPolygon(room.polygon)));
    if (!best) {
      return room;
    }
    const bestArea = Math.abs(polygonArea(normalizeRoomPolygon(best.polygon)));
    return area < bestArea ? room : best;
  }).id;
}

export function reassignEntitiesFromRemovedRooms<T extends { equipment: { roomId: string | null; position: { x: number; y: number }; levelId?: string }[]; sensors: { roomId: string | null; position: { x: number; y: number }; levelId?: string }[] }>(
  model: T,
  removedRoomIds: Set<string>,
  rooms: Room[]
): T {
  if (!removedRoomIds.size) {
    return model;
  }

  const remapRoomId = (roomId: string | null, position: { x: number; y: number }, levelId?: string) => {
    if (!roomId || !removedRoomIds.has(roomId)) {
      return roomId;
    }
    return resolveReplacementRoomId(position, levelId, rooms) ?? null;
  };

  return {
    ...model,
    equipment: model.equipment.map((entry) => ({
      ...entry,
      roomId: remapRoomId(entry.roomId, entry.position, entry.levelId),
    })),
    sensors: model.sensors.map((entry) => ({
      ...entry,
      roomId: remapRoomId(entry.roomId, entry.position, entry.levelId),
    })),
  };
}
