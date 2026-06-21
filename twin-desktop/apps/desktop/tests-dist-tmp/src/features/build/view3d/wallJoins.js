const ENDPOINT_TOLERANCE = 0.2;
const MIN_WALL_SEGMENT = 0.05;
export function computeWallJoinData(model) {
    const extensions = new Map();
    const corners = [];
    const endpointMap = new Map();
    model.walls.forEach((wall) => {
        const entries = [
            { point: wall.a, dir: normalize(subtract(wall.b, wall.a)), isStart: true },
            { point: wall.b, dir: normalize(subtract(wall.a, wall.b)), isStart: false },
        ];
        entries.forEach((entry) => {
            const key = resolveEndpointKey(entry.point, endpointMap);
            const existing = endpointMap.get(key);
            if (existing) {
                existing.entries.push({ wall, dir: entry.dir, isStart: entry.isStart });
            }
            else {
                endpointMap.set(key, { point: entry.point, entries: [{ wall, dir: entry.dir, isStart: entry.isStart }] });
            }
        });
    });
    endpointMap.forEach(({ point, entries }) => {
        if (entries.length < 2) {
            return;
        }
        for (let i = 0; i < entries.length; i += 1) {
            for (let j = i + 1; j < entries.length; j += 1) {
                const first = entries[i];
                const second = entries[j];
                const angleDot = dot(first.dir, second.dir);
                if (Math.abs(angleDot) > 0.3) {
                    continue;
                }
                const lengthA = wallLength(first.wall);
                const lengthB = wallLength(second.wall);
                const trimA = Math.min(first.wall.thickness_m / 2, Math.max(MIN_WALL_SEGMENT, lengthA / 6));
                const trimB = Math.min(second.wall.thickness_m / 2, Math.max(MIN_WALL_SEGMENT, lengthB / 6));
                applyExtension(extensions, first.wall.id, first.isStart, trimA);
                applyExtension(extensions, second.wall.id, second.isStart, trimB);
                corners.push({
                    point,
                    dirA: first.dir,
                    dirB: second.dir,
                    trimA,
                    trimB,
                    thickness: (first.wall.thickness_m + second.wall.thickness_m) / 2,
                    maxHeight: Math.min(first.wall.height_m, second.wall.height_m),
                    levelElevation: Math.max(getModelLevelElevation(model, first.wall.levelId), getModelLevelElevation(model, second.wall.levelId)),
                });
            }
        }
    });
    return { extensions, corners };
}
function applyExtension(map, wallId, isStart, value) {
    if (!Number.isFinite(value) || value <= 0) {
        return;
    }
    const entry = map.get(wallId) ?? { start: 0, end: 0 };
    if (isStart) {
        entry.start = Math.max(entry.start, value);
    }
    else {
        entry.end = Math.max(entry.end, value);
    }
    map.set(wallId, entry);
}
function resolveEndpointKey(point, map) {
    for (const [key, bucket] of map.entries()) {
        if (Math.hypot(bucket.point.x - point.x, bucket.point.y - point.y) <= ENDPOINT_TOLERANCE) {
            return key;
        }
    }
    return `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
}
function normalize(point) {
    const length = Math.hypot(point.x, point.y);
    if (length <= 1e-9) {
        return { x: 0, y: 0 };
    }
    return { x: point.x / length, y: point.y / length };
}
function subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}
function wallLength(wall) {
    return Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
}
function getModelLevelElevation(model, levelId) {
    return model.levels.find((level) => level.id === levelId)?.elevation_m ?? 0;
}
