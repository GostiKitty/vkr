import { detectIntersection } from "../../../core/editor/geometry";
import { createId } from "../../../shared/utils/id";
const JUNCTION_TOLERANCE = 0.2;
const MIN_SEGMENT_LENGTH = 0.1;
function segmentLength(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function isEndpoint(point, endpoint, tolerance = JUNCTION_TOLERANCE) {
    return segmentLength(point, endpoint) <= tolerance;
}
function pointOnInterior(point, start, end) {
    const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
    if (lengthSquared <= 1e-8) {
        return false;
    }
    const t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared;
    if (t <= 1e-4 || t >= 1 - 1e-4) {
        return false;
    }
    const projected = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
    };
    return segmentLength(point, projected) <= JUNCTION_TOLERANCE;
}
function distanceAlong(origin, point) {
    return Math.hypot(point.x - origin.x, point.y - origin.y);
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
function splitWallAtPoints(wall, points) {
    const ordered = uniquePoints(points, JUNCTION_TOLERANCE).sort((left, right) => distanceAlong(wall.a, left) - distanceAlong(wall.a, right));
    if (!ordered.length) {
        return [wall];
    }
    const chain = [wall.a, ...ordered, wall.b];
    const segments = [];
    for (let index = 1; index < chain.length; index += 1) {
        const a = chain[index - 1];
        const b = chain[index];
        if (segmentLength(a, b) < MIN_SEGMENT_LENGTH) {
            continue;
        }
        segments.push({
            ...wall,
            id: index === 1 ? wall.id : createId("wall"),
            a: { ...a },
            b: { ...b },
        });
    }
    return segments.length ? segments : [wall];
}
/**
 * Splits wall segments at T-junctions and crossings so room contour detection can form cells.
 */
export function splitWallsAtJunctions(walls) {
    let result = walls.map((wall) => ({
        ...wall,
        a: { ...wall.a },
        b: { ...wall.b },
    }));
    let changed = true;
    let guard = 0;
    while (changed && guard < walls.length * walls.length + 8) {
        guard += 1;
        changed = false;
        for (let index = 0; index < result.length; index += 1) {
            const wall = result[index];
            const splitPoints = [];
            result.forEach((other, otherIndex) => {
                if (index === otherIndex) {
                    return;
                }
                const intersection = detectIntersection(wall.a, wall.b, other.a, other.b);
                if (intersection &&
                    !isEndpoint(intersection, wall.a) &&
                    !isEndpoint(intersection, wall.b)) {
                    splitPoints.push(intersection);
                }
                [other.a, other.b].forEach((point) => {
                    if (pointOnInterior(point, wall.a, wall.b)) {
                        splitPoints.push(point);
                    }
                });
            });
            const segments = splitWallAtPoints(wall, splitPoints);
            if (segments.length <= 1) {
                continue;
            }
            result = [...result.slice(0, index), ...result.slice(index + 1), ...segments];
            changed = true;
            break;
        }
    }
    return result.filter((wall) => segmentLength(wall.a, wall.b) >= MIN_SEGMENT_LENGTH);
}
