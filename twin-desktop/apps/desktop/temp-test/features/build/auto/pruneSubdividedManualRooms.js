import { polygonArea, polygonContainsPoint, validateRoomPolygon } from "../../../entities/geometry/geom";
function polygonInsidePolygon(inner, outer) {
    if (inner.length < 3 || outer.length < 3) {
        return false;
    }
    return inner.every((point) => polygonContainsPoint(point, outer));
}
function normalizeRoomPolygon(polygon) {
    return validateRoomPolygon(polygon).normalized ?? polygon;
}
/**
 * Drops manual rooms that were split into multiple wall-bounded spaces.
 * Keeps the parent when fewer than two valid child loops lie fully inside it.
 */
export function pruneSubdividedManualRooms(manualRooms, loops) {
    const removedIds = new Set();
    const autoChildLoops = loops.filter((loop) => loop.valid && loop.roomSource === "auto");
    const kept = manualRooms.filter((manual) => {
        const parentPolygon = normalizeRoomPolygon(manual.polygon);
        const parentArea = Math.abs(polygonArea(parentPolygon));
        if (parentArea <= 0) {
            return true;
        }
        const childLoops = autoChildLoops.filter((loop) => loop.levelId === manual.levelId &&
            loop.area > 0 &&
            polygonInsidePolygon(normalizeRoomPolygon(loop.polygon), parentPolygon));
        if (childLoops.length < 2) {
            return true;
        }
        const childArea = childLoops.reduce((sum, loop) => sum + loop.area, 0);
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
