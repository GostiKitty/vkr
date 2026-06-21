export const MIN_WALL_LENGTH = 1e-3;
export function wallVector(wall) {
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const length = Math.hypot(dx, dy);
    return { x: dx, y: dy, length };
}
export function resolveWallPoint(wall, distance) {
    const { x, y, length } = wallVector(wall);
    if (length < MIN_WALL_LENGTH) {
        return { ...wall.a };
    }
    const ratio = distance / length;
    return {
        x: wall.a.x + x * ratio,
        y: wall.a.y + y * ratio,
    };
}
export function projectPointToWall(point, wall) {
    const vec = wallVector(wall);
    if (vec.length < MIN_WALL_LENGTH) {
        return null;
    }
    const wx = point.x - wall.a.x;
    const wy = point.y - wall.a.y;
    const dot = (wx * vec.x + wy * vec.y) / vec.length;
    const center = clamp(dot, 0, vec.length);
    const closest = resolveWallPoint(wall, center);
    const distance = Math.hypot(point.x - closest.x, point.y - closest.y);
    return {
        length: vec.length,
        distance,
        center,
        point: closest,
    };
}
export function buildAnchorFromOffset(wall, offset) {
    const length = Math.max(MIN_WALL_LENGTH, wallVector(wall).length);
    const clamped = clamp(offset, 0, length);
    return {
        wallId: wall.id,
        t: length > MIN_WALL_LENGTH ? clamped / length : 0,
        offset_m: clamped,
    };
}
export function anchorToOffset(anchor, wall) {
    if (!wall || anchor.wallId !== wall.id) {
        return anchor.offset_m;
    }
    const length = wallVector(wall).length;
    if (length < MIN_WALL_LENGTH) {
        return 0;
    }
    const normalized = clamp(anchor.t, 0, 1);
    const derived = normalized * length;
    // усредняем с сохранённым offset, чтобы избежать накопления ошибок
    return clamp((derived + clamp(anchor.offset_m, 0, length)) / 2, 0, length);
}
export function reprojectAnchor(anchor, prevWall, nextWall) {
    const currentOffset = anchorToOffset(anchor, prevWall);
    const pointOnPrev = resolveWallPoint(prevWall, currentOffset);
    const projection = projectPointToWall(pointOnPrev, nextWall);
    if (!projection) {
        return {
            wallId: nextWall.id,
            t: 0,
            offset_m: 0,
        };
    }
    return {
        wallId: nextWall.id,
        t: projection.length > MIN_WALL_LENGTH ? projection.center / projection.length : 0,
        offset_m: projection.center,
    };
}
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function isOpeningLost(opening) {
    return !opening.anchor.wallId || opening.lost === true;
}
export function reviveOpening(opening) {
    return {
        ...opening,
        lost: false,
    };
}
