import { segmentLength } from "../../../entities/geometry/geom";
import { createId } from "../../../shared/utils/id";
export function generateWallsFromRooms(model, options = {}) {
    const thickness = options.defaultThickness ?? 0.3;
    const height = options.defaultHeight ?? estimateDefaultHeight(model);
    const tolerance = options.tolerance ?? 1e-3;
    const levelLookup = new Map(model.levels.map((level) => [level.id, level]));
    const rawEdges = collectRoomEdges(model.rooms, tolerance);
    const atomicEdges = splitRoomEdges(rawEdges, tolerance);
    const adjacency = new Map();
    const walls = atomicEdges.map((edge) => {
        const touchingRooms = Array.from(edge.rooms);
        for (let index = 0; index < touchingRooms.length; index += 1) {
            for (let pairIndex = index + 1; pairIndex < touchingRooms.length; pairIndex += 1) {
                linkRooms(adjacency, touchingRooms[index], touchingRooms[pairIndex]);
            }
        }
        return {
            id: createId("wall"),
            levelId: edge.levelId,
            a: edge.a,
            b: edge.b,
            thickness_m: thickness,
            height_m: heightForLevel(edge.levelId, levelLookup, height),
        };
    });
    return {
        walls,
        adjacency: Object.fromEntries(Array.from(adjacency.entries()).map(([roomId, neighbors]) => [roomId, Array.from(neighbors)])),
    };
}
function collectRoomEdges(rooms, tolerance) {
    const edges = [];
    rooms.forEach((room) => {
        const polygon = normalizePolygon(room);
        if (polygon.length < 2) {
            return;
        }
        for (let index = 0; index < polygon.length; index += 1) {
            const a = polygon[index];
            const b = polygon[(index + 1) % polygon.length];
            if (segmentLength(a, b) < tolerance) {
                continue;
            }
            edges.push({
                roomId: room.id,
                levelId: room.levelId,
                a: { ...a },
                b: { ...b },
            });
        }
    });
    return edges;
}
function splitRoomEdges(edges, tolerance) {
    const groups = new Map();
    edges.forEach((edge) => {
        const oriented = orientEdge(edge, tolerance);
        if (!oriented) {
            return;
        }
        const key = buildLineKey(oriented.direction, oriented.offset, edge.levelId, tolerance);
        const bucket = groups.get(key) ?? [];
        bucket.push(oriented);
        groups.set(key, bucket);
    });
    const atomicEdges = [];
    groups.forEach((group) => {
        const first = group[0];
        const breakpoints = uniqueSortedScalars(group.flatMap((edge) => [edge.start, edge.end]), tolerance);
        for (let index = 1; index < breakpoints.length; index += 1) {
            const start = breakpoints[index - 1];
            const end = breakpoints[index];
            if (end - start <= tolerance) {
                continue;
            }
            const midpoint = (start + end) / 2;
            const rooms = new Set(group
                .filter((edge) => midpoint >= edge.start - tolerance && midpoint <= edge.end + tolerance)
                .map((edge) => edge.roomId));
            if (!rooms.size) {
                continue;
            }
            const lineOrigin = scale(first.normal, first.offset);
            atomicEdges.push({
                a: pointOnLine(lineOrigin, first.direction, start),
                b: pointOnLine(lineOrigin, first.direction, end),
                levelId: first.levelId,
                rooms,
            });
        }
    });
    return atomicEdges.filter((edge) => segmentLength(edge.a, edge.b) > tolerance);
}
function orientEdge(edge, tolerance) {
    const dx = edge.b.x - edge.a.x;
    const dy = edge.b.y - edge.a.y;
    const length = Math.hypot(dx, dy);
    if (length <= tolerance) {
        return null;
    }
    let direction = { x: dx / length, y: dy / length };
    let startPoint = edge.a;
    let endPoint = edge.b;
    if (direction.x < -tolerance || (Math.abs(direction.x) <= tolerance && direction.y < 0)) {
        direction = { x: -direction.x, y: -direction.y };
        startPoint = edge.b;
        endPoint = edge.a;
    }
    const normal = { x: -direction.y, y: direction.x };
    const start = dot(direction, startPoint);
    const end = dot(direction, endPoint);
    return {
        ...edge,
        a: { ...startPoint },
        b: { ...endPoint },
        direction,
        normal,
        offset: dot(normal, startPoint),
        start: Math.min(start, end),
        end: Math.max(start, end),
    };
}
function buildLineKey(direction, offset, levelId, tolerance) {
    return `${levelId}:${formatScalar(direction.x, tolerance)}:${formatScalar(direction.y, tolerance)}:${formatScalar(offset, tolerance)}`;
}
function uniqueSortedScalars(values, tolerance) {
    const sorted = [...values].sort((left, right) => left - right);
    const unique = [];
    sorted.forEach((value) => {
        if (!unique.length || Math.abs(unique[unique.length - 1] - value) > tolerance) {
            unique.push(value);
        }
    });
    return unique;
}
function pointOnLine(origin, direction, distanceAlongLine) {
    return {
        x: origin.x + direction.x * distanceAlongLine,
        y: origin.y + direction.y * distanceAlongLine,
    };
}
function dot(left, right) {
    return left.x * right.x + left.y * right.y;
}
function scale(vector, factor) {
    return {
        x: vector.x * factor,
        y: vector.y * factor,
    };
}
function formatScalar(value, tolerance) {
    const factor = 1 / tolerance;
    return `${Math.round(value * factor) / factor}`;
}
function normalizePolygon(room) {
    const polygon = room.polygon ?? [];
    if (!polygon.length) {
        return [];
    }
    const last = polygon[polygon.length - 1];
    const first = polygon[0];
    const closed = Math.abs(last.x - first.x) < 1e-6 && Math.abs(last.y - first.y) < 1e-6;
    return closed ? polygon.slice(0, -1) : polygon;
}
function linkRooms(graph, a, b) {
    if (!graph.has(a)) {
        graph.set(a, new Set());
    }
    if (!graph.has(b)) {
        graph.set(b, new Set());
    }
    graph.get(a)?.add(b);
    graph.get(b)?.add(a);
}
function estimateDefaultHeight(model) {
    const heights = model.levels.map((level) => level.height_m).filter((value) => Number.isFinite(value));
    return heights.length ? heights[0] : 3;
}
function heightForLevel(levelId, lookup, fallback) {
    const level = lookup.get(levelId);
    return level?.height_m ?? fallback;
}
