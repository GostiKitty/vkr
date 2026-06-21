import { anchorToOffset, buildAnchorFromOffset, projectPointToWall, resolveWallPoint } from "../utils/openingMath";
const TINY_WALL_THRESHOLD = 0.05;
const WALL_AXIS_TOLERANCE = 1e-3;
const WALL_PROP_TOLERANCE = 0.02;
const WALL_HEIGHT_TOLERANCE = 0.05;
const OPENING_REBIND_TOLERANCE_M = 0.12;
const OPENING_WIDTH_TOLERANCE_M = 0.08;
export function normalizeWallTopology({ previousWalls, nextWalls, doors, windows, }) {
    const normalizedWalls = mergeCollinearWalls(nextWalls
        .map(cloneWall)
        .filter((wall) => segmentLength(wall.a, wall.b) >= TINY_WALL_THRESHOLD), doors, windows);
    return {
        walls: normalizedWalls,
        doors: reconcileOpenings(doors, previousWalls, normalizedWalls),
        windows: reconcileOpenings(windows, previousWalls, normalizedWalls),
    };
}
function reconcileOpenings(openings, previousWalls, nextWalls) {
    return openings.map((opening) => reconcileOpening(opening, previousWalls, nextWalls));
}
function reconcileOpening(opening, previousWalls, nextWalls) {
    if (!opening.anchor.wallId) {
        return opening;
    }
    const previousWall = previousWalls.find((wall) => wall.id === opening.anchor.wallId) ?? null;
    if (!previousWall) {
        return markOpeningLost(opening);
    }
    const bestCandidate = findBestOpeningCandidate(opening, previousWall, nextWalls);
    if (!bestCandidate) {
        return markOpeningLost(opening);
    }
    return {
        ...opening,
        anchor: buildAnchorFromOffset(bestCandidate.wall, bestCandidate.startOffsetM),
        lost: false,
    };
}
function findBestOpeningCandidate(opening, previousWall, nextWalls) {
    const openingStartM = anchorToOffset(opening.anchor, previousWall);
    const openingEndM = openingStartM + opening.width_m;
    const openingCenterM = openingStartM + opening.width_m / 2;
    const openingStartPoint = resolveWallPoint(previousWall, openingStartM);
    const openingEndPoint = resolveWallPoint(previousWall, openingEndM);
    const openingCenterPoint = resolveWallPoint(previousWall, openingCenterM);
    let best = null;
    nextWalls.forEach((wall) => {
        if (wall.levelId !== previousWall.levelId) {
            return;
        }
        const startProjection = projectPointToWall(openingStartPoint, wall);
        const endProjection = projectPointToWall(openingEndPoint, wall);
        if (startProjection && endProjection) {
            const startOffsetM = Math.min(startProjection.center, endProjection.center);
            const endOffsetM = Math.max(startProjection.center, endProjection.center);
            const projectedWidthM = endOffsetM - startOffsetM;
            const maxDistanceM = Math.max(startProjection.distance, endProjection.distance);
            if (maxDistanceM <= OPENING_REBIND_TOLERANCE_M &&
                Math.abs(projectedWidthM - opening.width_m) <= OPENING_WIDTH_TOLERANCE_M) {
                const score = startProjection.distance + endProjection.distance + idBias(opening.anchor.wallId, wall.id);
                if (!best || score < best.score) {
                    best = { wall, startOffsetM, score };
                }
                return;
            }
        }
        const centerProjection = projectPointToWall(openingCenterPoint, wall);
        if (!centerProjection) {
            return;
        }
        const wallLengthM = segmentLength(wall.a, wall.b);
        if (centerProjection.distance > OPENING_REBIND_TOLERANCE_M || wallLengthM + OPENING_WIDTH_TOLERANCE_M < opening.width_m) {
            return;
        }
        const startOffsetM = clamp(centerProjection.center - opening.width_m / 2, 0, Math.max(0, wallLengthM - opening.width_m));
        const score = centerProjection.distance + idBias(opening.anchor.wallId, wall.id) + Math.abs(startOffsetM - openingStartM) * 0.1;
        if (!best || score < best.score) {
            best = { wall, startOffsetM, score };
        }
    });
    return best;
}
function mergeCollinearWalls(walls, doors, windows) {
    const remaining = [...walls];
    const openingWallIds = new Set();
    [...doors, ...windows].forEach((opening) => {
        if (opening.anchor.wallId) {
            openingWallIds.add(opening.anchor.wallId);
        }
    });
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < remaining.length; i += 1) {
            for (let j = i + 1; j < remaining.length; j += 1) {
                const left = remaining[i];
                const right = remaining[j];
                if (!canMergeWalls(left, right, remaining, openingWallIds)) {
                    continue;
                }
                remaining.splice(j, 1);
                remaining.splice(i, 1, mergeWalls(left, right));
                changed = true;
                break;
            }
            if (changed) {
                break;
            }
        }
    }
    return remaining;
}
function canMergeWalls(left, right, allWalls, openingWallIds) {
    if (left.levelId !== right.levelId) {
        return false;
    }
    if (!haveCompatibleWallProps(left, right) || !areCollinear(left, right)) {
        return false;
    }
    if (isSameWallGeometry(left, right)) {
        return true;
    }
    if (openingWallIds.has(left.id) || openingWallIds.has(right.id)) {
        return false;
    }
    const projection = projectWall(left);
    const otherProjection = projectWallOnAxis(right, projection.axis);
    const overlap = intervalOverlapLength(projection.start, projection.end, otherProjection.start, otherProjection.end);
    if (overlap > WALL_AXIS_TOLERANCE) {
        return false;
    }
    const mergePoint = findSharedEndpoint(left, right);
    if (!mergePoint) {
        return false;
    }
    return !isStructuralJunction(mergePoint, left, right, allWalls, projection.axis);
}
function haveCompatibleWallProps(left, right) {
    return (Math.abs(left.thickness_m - right.thickness_m) <= WALL_PROP_TOLERANCE &&
        Math.abs(left.height_m - right.height_m) <= WALL_HEIGHT_TOLERANCE &&
        (left.wallAssemblyId ?? null) === (right.wallAssemblyId ?? null) &&
        JSON.stringify(left.layers ?? []) === JSON.stringify(right.layers ?? []));
}
function areCollinear(left, right) {
    const axis = normalize({ x: left.b.x - left.a.x, y: left.b.y - left.a.y });
    if (!axis) {
        return false;
    }
    const startOffset = Math.abs(cross(axis, { x: right.a.x - left.a.x, y: right.a.y - left.a.y }));
    const endOffset = Math.abs(cross(axis, { x: right.b.x - left.a.x, y: right.b.y - left.a.y }));
    return startOffset <= WALL_AXIS_TOLERANCE && endOffset <= WALL_AXIS_TOLERANCE;
}
function isSameWallGeometry(left, right) {
    return ((pointsClose(left.a, right.a) && pointsClose(left.b, right.b)) ||
        (pointsClose(left.a, right.b) && pointsClose(left.b, right.a)));
}
function findSharedEndpoint(left, right) {
    if (pointsClose(left.a, right.a) || pointsClose(left.a, right.b)) {
        return { ...left.a };
    }
    if (pointsClose(left.b, right.a) || pointsClose(left.b, right.b)) {
        return { ...left.b };
    }
    return null;
}
function isStructuralJunction(point, left, right, walls, axis) {
    return walls.some((wall) => {
        if (wall.id === left.id || wall.id === right.id) {
            return false;
        }
        const touchesEndpoint = pointsClose(point, wall.a) || pointsClose(point, wall.b);
        if (touchesEndpoint) {
            return !wallIsParallelToAxis(wall, axis);
        }
        return pointLiesOnWallInterior(point, wall);
    });
}
function wallIsParallelToAxis(wall, axis) {
    const wallAxis = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
    if (!wallAxis) {
        return false;
    }
    return Math.abs(cross(axis, wallAxis)) <= WALL_AXIS_TOLERANCE;
}
function pointLiesOnWallInterior(point, wall) {
    const projection = projectPointToSegment(point, wall.a, wall.b);
    if (!projection) {
        return false;
    }
    return projection.distance <= WALL_AXIS_TOLERANCE && projection.t > WALL_AXIS_TOLERANCE && projection.t < 1 - WALL_AXIS_TOLERANCE;
}
function mergeWalls(primary, secondary) {
    const projection = projectWall(primary);
    const otherProjection = projectWallOnAxis(secondary, projection.axis);
    const start = Math.min(projection.start, otherProjection.start);
    const end = Math.max(projection.end, otherProjection.end);
    return {
        ...primary,
        a: {
            x: projection.origin.x + projection.axis.x * start,
            y: projection.origin.y + projection.axis.y * start,
        },
        b: {
            x: projection.origin.x + projection.axis.x * end,
            y: projection.origin.y + projection.axis.y * end,
        },
    };
}
function projectWall(wall) {
    const axis = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y }) ?? { x: 1, y: 0 };
    const normal = { x: -axis.y, y: axis.x };
    const start = dot(axis, wall.a);
    const end = dot(axis, wall.b);
    return {
        axis,
        origin: scale(normal, dot(normal, wall.a)),
        start: Math.min(start, end),
        end: Math.max(start, end),
    };
}
function projectWallOnAxis(wall, axis) {
    return {
        start: Math.min(dot(axis, wall.a), dot(axis, wall.b)),
        end: Math.max(dot(axis, wall.a), dot(axis, wall.b)),
    };
}
function cloneWall(wall) {
    return {
        ...wall,
        a: { ...wall.a },
        b: { ...wall.b },
        layers: wall.layers?.map((layer) => ({ ...layer })),
    };
}
function markOpeningLost(opening) {
    return {
        ...opening,
        anchor: { ...opening.anchor, wallId: null },
        lost: true,
    };
}
function projectPointToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= WALL_AXIS_TOLERANCE) {
        return null;
    }
    const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
    const projected = {
        x: start.x + dx * t,
        y: start.y + dy * t,
    };
    return {
        t,
        distance: segmentLength(point, projected),
    };
}
function intervalOverlapLength(aStart, aEnd, bStart, bEnd) {
    return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}
function pointsClose(left, right) {
    return segmentLength(left, right) <= WALL_AXIS_TOLERANCE;
}
function segmentLength(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function normalize(vector) {
    const length = Math.hypot(vector.x, vector.y);
    if (length <= WALL_AXIS_TOLERANCE) {
        return null;
    }
    return { x: vector.x / length, y: vector.y / length };
}
function scale(vector, factor) {
    return { x: vector.x * factor, y: vector.y * factor };
}
function dot(left, right) {
    return left.x * right.x + left.y * right.y;
}
function cross(left, right) {
    return left.x * right.y - left.y * right.x;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function idBias(expectedId, candidateId) {
    return expectedId === candidateId ? -0.01 : 0;
}
