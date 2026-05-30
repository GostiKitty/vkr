import { segmentsIntersect } from "../../entities/geometry/geom";
import { createId } from "../../shared/utils/id";
import { detectRoomsFromWalls } from "../geometry/roomContours";
const EPS = 1e-6;
const MIN_SEGMENT_LENGTH = 0.1;
export function snapToPoint(point, anchors, tolerance) {
    let bestPointX = point.x;
    let bestPointY = point.y;
    let bestDistance = tolerance;
    anchors.forEach((anchor) => {
        const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
        if (distance <= bestDistance) {
            bestDistance = distance;
            bestPointX = anchor.x;
            bestPointY = anchor.y;
        }
    });
    return { x: bestPointX, y: bestPointY };
}
/**
 * Vertex snap first, then independent axis alignment using only anchors that are
 * also close on the perpendicular axis (avoids snapping X to a far-away point).
 */
export function snapAxesToNearbyAnchors(point, anchors, axisTolerance, vertexTolerance = 0.25) {
    const vertexSnap = snapToPoint(point, anchors, vertexTolerance);
    if (Math.hypot(vertexSnap.x - point.x, vertexSnap.y - point.y) > 1e-6) {
        return vertexSnap;
    }
    let snappedX = point.x;
    let snappedY = point.y;
    let bestX = axisTolerance;
    let bestY = axisTolerance;
    anchors.forEach((anchor) => {
        const dx = Math.abs(anchor.x - point.x);
        if (dx < bestX && Math.abs(anchor.y - point.y) <= axisTolerance) {
            bestX = dx;
            snappedX = anchor.x;
        }
        const dy = Math.abs(anchor.y - point.y);
        if (dy < bestY && Math.abs(anchor.x - point.x) <= axisTolerance) {
            bestY = dy;
            snappedY = anchor.y;
        }
    });
    return { x: snappedX, y: snappedY };
}
export function snapToSegment(point, walls, tolerance) {
    let best = null;
    walls.forEach((wall) => {
        const projection = projectPointToSegment(point, wall.a, wall.b);
        if (!projection || projection.distance > tolerance) {
            return;
        }
        if (!best || projection.distance < best.distance) {
            best = {
                point: projection.point,
                distance: projection.distance,
                wallId: wall.id,
                t: projection.t,
            };
        }
    });
    return best;
}
/** Snap to the nearest edge of one or more closed polygons (e.g. room contour on a reference level). */
export function snapToPolygonBoundary(point, polygons, tolerance) {
    let bestDistance = tolerance;
    let bestPoint = null;
    polygons.forEach((polygon) => {
        if (polygon.length < 2) {
            return;
        }
        for (let index = 0; index < polygon.length; index += 1) {
            const start = polygon[index];
            const end = polygon[(index + 1) % polygon.length];
            const projection = projectPointToSegment(point, start, end);
            if (!projection || projection.distance > bestDistance) {
                continue;
            }
            bestDistance = projection.distance;
            bestPoint = projection.point;
        }
    });
    return bestPoint;
}
export function detectIntersection(a1, a2, b1, b2) {
    if (!segmentsIntersect(a1, a2, b1, b2)) {
        return null;
    }
    const denominator = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
    if (Math.abs(denominator) <= EPS) {
        return null;
    }
    const crossA = a1.x * a2.y - a1.y * a2.x;
    const crossB = b1.x * b2.y - b1.y * b2.x;
    const x = (crossA * (b1.x - b2.x) - (a1.x - a2.x) * crossB) / denominator;
    const y = (crossA * (b1.y - b2.y) - (a1.y - a2.y) * crossB) / denominator;
    return { x, y };
}
export function autoJoinWalls(existingWalls, candidateWall, tolerance = 0.2) {
    const anchors = existingWalls.flatMap((wall) => [wall.a, wall.b]);
    const snappedStart = snapToPoint(candidateWall.a, anchors, tolerance);
    const snappedEnd = snapToPoint(candidateWall.b, anchors, tolerance);
    const intersections = [];
    let nextWalls = existingWalls.map((wall) => ({
        ...wall,
        a: { ...wall.a },
        b: { ...wall.b },
    }));
    nextWalls = nextWalls.flatMap((wall) => {
        if (sharesEndpoint(snappedStart, snappedEnd, wall, tolerance)) {
            return [wall];
        }
        const intersection = detectIntersection(snappedStart, snappedEnd, wall.a, wall.b);
        if (!intersection || isEndpoint(intersection, wall.a, tolerance) || isEndpoint(intersection, wall.b, tolerance)) {
            return [wall];
        }
        intersections.push(intersection);
        return splitWallAtPoint(wall, intersection);
    });
    const candidatePoints = uniquePoints([snappedStart, ...intersections, snappedEnd], tolerance).sort((left, right) => distanceAlong(snappedStart, left) - distanceAlong(snappedStart, right));
    const insertedSegments = [];
    for (let index = 1; index < candidatePoints.length; index += 1) {
        const a = candidatePoints[index - 1];
        const b = candidatePoints[index];
        if (segmentLength(a, b) < MIN_SEGMENT_LENGTH) {
            continue;
        }
        insertedSegments.push({
            ...candidateWall,
            id: createId("wall"),
            a: { ...a },
            b: { ...b },
        });
    }
    return {
        walls: dedupeWalls([...nextWalls, ...insertedSegments], tolerance),
        insertedWallIds: insertedSegments.map((wall) => wall.id),
        snappedStart,
        snappedEnd,
        intersections,
    };
}
export function rebuildRoomContours(model) {
    const contours = detectRoomsFromWalls(model);
    return {
        problems: contours.problems,
        loops: contours.loops,
    };
}
function projectPointToSegment(point, start, end) {
    const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
    if (lengthSquared <= EPS) {
        return null;
    }
    const t = clamp(((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared, 0, 1);
    const projected = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
    };
    return {
        point: projected,
        t,
        distance: Math.hypot(point.x - projected.x, point.y - projected.y),
    };
}
function splitWallAtPoint(wall, point) {
    if (segmentLength(wall.a, point) < MIN_SEGMENT_LENGTH || segmentLength(point, wall.b) < MIN_SEGMENT_LENGTH) {
        return [wall];
    }
    return [
        { ...wall, id: createId("wall"), a: { ...wall.a }, b: { ...point } },
        { ...wall, id: createId("wall"), a: { ...point }, b: { ...wall.b } },
    ];
}
function dedupeWalls(walls, tolerance) {
    const unique = [];
    walls.forEach((wall) => {
        if (segmentLength(wall.a, wall.b) < MIN_SEGMENT_LENGTH) {
            return;
        }
        const duplicate = unique.some((candidate) => (isEndpoint(candidate.a, wall.a, tolerance) && isEndpoint(candidate.b, wall.b, tolerance)) ||
            (isEndpoint(candidate.a, wall.b, tolerance) && isEndpoint(candidate.b, wall.a, tolerance)));
        if (!duplicate) {
            unique.push(wall);
        }
    });
    return unique;
}
function uniquePoints(points, tolerance) {
    const unique = [];
    points.forEach((point) => {
        if (!unique.some((candidate) => isEndpoint(candidate, point, tolerance))) {
            unique.push(point);
        }
    });
    return unique;
}
function distanceAlong(origin, point) {
    return Math.hypot(point.x - origin.x, point.y - origin.y);
}
function segmentLength(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function sharesEndpoint(a, b, wall, tolerance) {
    return isEndpoint(a, wall.a, tolerance) || isEndpoint(a, wall.b, tolerance) || isEndpoint(b, wall.a, tolerance) || isEndpoint(b, wall.b, tolerance);
}
function isEndpoint(a, b, tolerance) {
    return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
