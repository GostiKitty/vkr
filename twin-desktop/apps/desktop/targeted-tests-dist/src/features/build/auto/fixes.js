import { segmentLength } from "../../../entities/geometry/geom";
const TINY_THRESHOLD = 0.05;
const WALL_MERGE_TOLERANCE = 1e-3;
export function autoCloseRooms(rooms, updateRoom) {
    let patched = 0;
    rooms.forEach((room) => {
        if (room.polygon.length < 3) {
            return;
        }
        const first = room.polygon[0];
        const last = room.polygon[room.polygon.length - 1];
        if (distance(first, last) > 1e-3) {
            updateRoom(room.id, { polygon: [...room.polygon, { ...first }] });
            patched += 1;
        }
    });
    return patched;
}
export function mergeColinearWalls(walls, setWalls) {
    let changes = 0;
    const remaining = walls.map((wall) => ({
        ...wall,
        a: { ...wall.a },
        b: { ...wall.b },
    }));
    let merged = true;
    while (merged) {
        merged = false;
        for (let i = 0; i < remaining.length; i++) {
            for (let j = i + 1; j < remaining.length; j++) {
                const a = remaining[i];
                const b = remaining[j];
                if (!canMergeWalls(a, b)) {
                    continue;
                }
                remaining.splice(j, 1);
                remaining.splice(i, 1, mergeWalls(a, b));
                changes += 1;
                merged = true;
                break;
            }
            if (merged) {
                break;
            }
        }
    }
    if (changes) {
        setWalls(remaining);
    }
    return changes;
}
export function removeTinySegments(model, updateRoom, removeWall) {
    let removed = 0;
    model.rooms.forEach((room) => {
        const filtered = room.polygon.filter((point, index, arr) => {
            const next = arr[(index + 1) % arr.length];
            return segmentLength(point, next) >= TINY_THRESHOLD;
        });
        if (filtered.length !== room.polygon.length && filtered.length >= 3) {
            updateRoom(room.id, { polygon: filtered });
            removed += 1;
        }
    });
    model.walls.forEach((wall) => {
        if (segmentLength(wall.a, wall.b) < TINY_THRESHOLD) {
            removeWall(wall.id);
            removed += 1;
        }
    });
    return removed;
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const canMergeWalls = (a, b) => {
    if (a.levelId !== b.levelId) {
        return false;
    }
    if (!haveCompatibleWallProps(a, b)) {
        return false;
    }
    if (!areColinear(a, b)) {
        return false;
    }
    const projection = projectWall(a);
    const otherProjection = projectWallOnAxis(b, projection.axis);
    if (!otherProjection) {
        return false;
    }
    return intervalsTouchOrOverlap(projection.start, projection.end, otherProjection.start, otherProjection.end, WALL_MERGE_TOLERANCE);
};
const haveCompatibleWallProps = (a, b) => Math.abs(a.thickness_m - b.thickness_m) <= 0.02 &&
    Math.abs(a.height_m - b.height_m) <= 0.05 &&
    (a.wallAssemblyId ?? null) === (b.wallAssemblyId ?? null) &&
    JSON.stringify(a.layers ?? []) === JSON.stringify(b.layers ?? []);
const areColinear = (a, b) => {
    const axis = normalize({ x: a.b.x - a.a.x, y: a.b.y - a.a.y });
    if (!axis) {
        return false;
    }
    const crossStart = Math.abs(cross(axis, { x: b.a.x - a.a.x, y: b.a.y - a.a.y }));
    const crossEnd = Math.abs(cross(axis, { x: b.b.x - a.a.x, y: b.b.y - a.a.y }));
    return crossStart <= WALL_MERGE_TOLERANCE && crossEnd <= WALL_MERGE_TOLERANCE;
};
const mergeWalls = (a, b) => {
    const projection = projectWall(a);
    const otherProjection = projectWallOnAxis(b, projection.axis);
    const start = Math.min(projection.start, otherProjection?.start ?? projection.start);
    const end = Math.max(projection.end, otherProjection?.end ?? projection.end);
    const p1 = {
        x: projection.origin.x + projection.axis.x * start,
        y: projection.origin.y + projection.axis.y * start,
    };
    const p2 = {
        x: projection.origin.x + projection.axis.x * end,
        y: projection.origin.y + projection.axis.y * end,
    };
    return {
        ...a,
        id: a.id,
        a: p1,
        b: p2,
    };
};
const projectWall = (wall) => {
    const axis = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
    if (!axis) {
        return { origin: { ...wall.a }, axis: { x: 1, y: 0 }, start: 0, end: 0 };
    }
    const start = dot(axis, wall.a);
    const end = dot(axis, wall.b);
    return {
        origin: scale({ x: -axis.y, y: axis.x }, dot({ x: -axis.y, y: axis.x }, wall.a)),
        axis,
        start: Math.min(start, end),
        end: Math.max(start, end),
    };
};
const projectWallOnAxis = (wall, axis) => ({
    start: Math.min(dot(axis, wall.a), dot(axis, wall.b)),
    end: Math.max(dot(axis, wall.a), dot(axis, wall.b)),
});
const intervalsTouchOrOverlap = (aStart, aEnd, bStart, bEnd, tolerance) => Math.min(aEnd, bEnd) >= Math.max(aStart, bStart) - tolerance;
const normalize = (vector) => {
    const length = Math.hypot(vector.x, vector.y);
    if (length <= WALL_MERGE_TOLERANCE) {
        return null;
    }
    return { x: vector.x / length, y: vector.y / length };
};
const scale = (vector, factor) => ({ x: vector.x * factor, y: vector.y * factor });
const dot = (left, right) => left.x * right.x + left.y * right.y;
const cross = (left, right) => left.x * right.y - left.y * right.x;
