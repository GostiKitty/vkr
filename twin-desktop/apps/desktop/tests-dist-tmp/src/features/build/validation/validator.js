import { polygonArea, polygonCentroid, polygonContainsPoint, segmentsIntersect } from "../../../entities/geometry/geom";
import { createId } from "../../../shared/utils/id";
import { getRoomDisplayName } from "../../../shared/utils/roomNames";
import { anchorToOffset } from "../utils/openingMath";
const MIN_WALL_LENGTH = 0.15;
export function validateModel(model) {
    const issues = [];
    model.rooms.forEach((room) => {
        const roomIndex = model.rooms.findIndex((entry) => entry.id === room.id);
        const roomLabel = getRoomDisplayName(room, roomIndex);
        if (room.polygon.length < 3) {
            issues.push({
                id: createId("issue"),
                severity: "error",
                message: `Помещение «${roomLabel}» не замкнуто.`,
                target: { kind: "room", id: room.id },
                fix: { label: "Автозамыкание", action: "auto-close-room" },
            });
            return;
        }
        if (isSelfIntersecting(room.polygon)) {
            issues.push({
                id: createId("issue"),
                severity: "error",
                message: `Грани помещения «${roomLabel}» пересекаются.`,
                target: { kind: "room", id: room.id },
            });
        }
        if (Math.abs(polygonArea(room.polygon)) < 0.5) {
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: `Площадь помещения «${roomLabel}» слишком мала.`,
                target: { kind: "room", id: room.id },
                fix: { label: "Удалить мелкие сегменты", action: "remove-tiny-segments" },
            });
        }
    });
    model.walls.forEach((wall) => {
        const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
        if (length < MIN_WALL_LENGTH) {
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: "Стеновой сегмент слишком короткий.",
                target: { kind: "wall", id: wall.id },
                fix: { label: "Удалить мелкие сегменты", action: "remove-tiny-segments" },
            });
        }
    });
    model.walls.forEach((wall, index) => {
        for (let j = index + 1; j < model.walls.length; j++) {
            const other = model.walls[j];
            if (wall.levelId !== other.levelId) {
                continue;
            }
            if (wallSegmentsOverlap(wall, other)) {
                issues.push({
                    id: createId("issue"),
                    severity: "warning",
                    message: "Стены дублируют или перекрывают друг друга на одной оси.",
                    target: { kind: "wall", id: wall.id },
                    fix: { label: "Объединить стены", action: "merge-colinear-walls" },
                });
                break;
            }
            if (segmentsShareEndpoint(wall, other)) {
                continue;
            }
            if (segmentsIntersect(wall.a, wall.b, other.a, other.b)) {
                issues.push({
                    id: createId("issue"),
                    severity: "error",
                    message: "Стены пересекаются без узла соединения.",
                    target: { kind: "wall", id: wall.id },
                    fix: { label: "Объединить стены", action: "merge-colinear-walls" },
                });
                break;
            }
        }
    });
    const openingsByWall = new Map();
    [...model.doors, ...model.windows].forEach((opening) => {
        const targetKind = model.windows.some((entry) => entry.id === opening.id) ? "window" : "door";
        if (!opening.anchor.wallId) {
            issues.push({
                id: createId("issue"),
                severity: "error",
                message: "Проём потерял привязку к стене.",
                target: { kind: targetKind, id: opening.id },
            });
            return;
        }
        const wall = model.walls.find((entry) => entry.id === opening.anchor.wallId);
        if (!wall) {
            issues.push({
                id: createId("issue"),
                severity: "error",
                message: "Проём привязан к удалённой стене.",
                target: { kind: targetKind, id: opening.id },
            });
            return;
        }
        const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
        const start = anchorToOffset(opening.anchor, wall);
        const end = start + opening.width_m;
        if (start < 0 || end > length) {
            issues.push({
                id: createId("issue"),
                severity: "error",
                message: "Проём выходит за габариты стены.",
                target: { kind: targetKind, id: opening.id },
            });
        }
        if (!openingsByWall.has(wall.id)) {
            openingsByWall.set(wall.id, []);
        }
        openingsByWall.get(wall.id)?.push({ start, end, id: opening.id });
    });
    openingsByWall.forEach((list) => {
        list.sort((a, b) => a.start - b.start);
        for (let i = 0; i < list.length - 1; i++) {
            const current = list[i];
            const next = list[i + 1];
            if (current.end > next.start) {
                issues.push({
                    id: createId("issue"),
                    severity: "warning",
                    message: "Проёмы на одной стене пересекаются.",
                    target: { kind: "door", id: current.id },
                });
                break;
            }
        }
    });
    detectOverlappingRooms(model.rooms, issues);
    return issues;
}
const detectOverlappingRooms = (rooms, issues) => {
    rooms.forEach((room, index) => {
        for (let j = index + 1; j < rooms.length; j++) {
            const other = rooms[j];
            if (room.levelId !== other.levelId) {
                continue;
            }
            const centroid = polygonCentroid(room.polygon);
            if (polygonContainsPoint(centroid, other.polygon)) {
                const roomLabel = getRoomDisplayName(room, index);
                const otherLabel = getRoomDisplayName(other, j);
                issues.push({
                    id: createId("issue"),
                    severity: "warning",
                    message: `Помещения «${roomLabel}» и «${otherLabel}» перекрываются.`,
                    target: { kind: "room", id: room.id },
                });
                break;
            }
        }
    });
};
const segmentsShareEndpoint = (a, b) => {
    const equals = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3;
    return equals(a.a, b.a) || equals(a.a, b.b) || equals(a.b, b.a) || equals(a.b, b.b);
};
const wallSegmentsOverlap = (a, b) => {
    if (!areColinearWalls(a, b)) {
        return false;
    }
    const axis = normalize({ x: a.b.x - a.a.x, y: a.b.y - a.a.y });
    if (!axis) {
        return false;
    }
    const aStart = dot(axis, a.a);
    const aEnd = dot(axis, a.b);
    const bStart = dot(axis, b.a);
    const bEnd = dot(axis, b.b);
    const overlap = Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd)) - Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd));
    return overlap > 0.05;
};
const areColinearWalls = (a, b) => {
    const axis = normalize({ x: a.b.x - a.a.x, y: a.b.y - a.a.y });
    if (!axis) {
        return false;
    }
    const startOffset = Math.abs(cross(axis, { x: b.a.x - a.a.x, y: b.a.y - a.a.y }));
    const endOffset = Math.abs(cross(axis, { x: b.b.x - a.a.x, y: b.b.y - a.a.y }));
    return startOffset <= 1e-3 && endOffset <= 1e-3;
};
const normalize = (vector) => {
    const length = Math.hypot(vector.x, vector.y);
    if (length <= 1e-6) {
        return null;
    }
    return { x: vector.x / length, y: vector.y / length };
};
const dot = (left, right) => left.x * right.x + left.y * right.y;
const cross = (left, right) => left.x * right.y - left.y * right.x;
const isSelfIntersecting = (points) => {
    if (points.length < 4) {
        return false;
    }
    for (let i = 0; i < points.length; i++) {
        const a1 = points[i];
        const a2 = points[(i + 1) % points.length];
        for (let j = i + 1; j < points.length; j++) {
            if (Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 1)) {
                continue;
            }
            const b1 = points[j];
            const b2 = points[(j + 1) % points.length];
            if (segmentsIntersect(a1, a2, b1, b2)) {
                return true;
            }
        }
    }
    return false;
};
