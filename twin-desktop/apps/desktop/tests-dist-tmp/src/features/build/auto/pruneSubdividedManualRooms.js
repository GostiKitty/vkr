import { polygonArea, polygonCentroid, polygonContainsPoint, validateRoomPolygon } from "../../../entities/geometry/geom";
const MIN_CHILD_AREA_M2 = 1;
function normalizeRoomPolygon(polygon) {
    return validateRoomPolygon(polygon).normalized ?? polygon;
}
/** Child loops share wall centerlines with the parent boundary — use centroid, not every vertex. */
function isProperSubRegion(inner, outer, outerArea) {
    const innerPolygon = normalizeRoomPolygon(inner);
    const outerPolygon = normalizeRoomPolygon(outer);
    const innerArea = Math.abs(polygonArea(innerPolygon));
    if (innerArea < MIN_CHILD_AREA_M2 || innerArea >= outerArea * 0.995) {
        return false;
    }
    const centroid = polygonCentroid(innerPolygon);
    return polygonContainsPoint(centroid, outerPolygon);
}
function collectChildRegions(manual, parentPolygon, parentArea, manualRooms, loops, autoRooms) {
    const areas = [];
    const seen = new Set();
    const register = (key, polygon, areaHint) => {
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
export function pruneSubdividedManualRooms(manualRooms, loops, autoRooms = []) {
    const removedIds = new Set();
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
export function resolveReplacementRoomId(position, levelId, rooms) {
    const candidates = rooms.filter((room) => (!levelId || room.levelId === levelId) &&
        polygonContainsPoint(position, normalizeRoomPolygon(room.polygon)));
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
export function reassignEntitiesFromRemovedRooms(model, removedRoomIds, rooms) {
    if (!removedRoomIds.size) {
        return model;
    }
    const remapRoomId = (roomId, position, levelId) => {
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
