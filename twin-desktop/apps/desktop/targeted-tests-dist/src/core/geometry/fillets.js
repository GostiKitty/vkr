/**
 * Единый источник формул скругления угла (fillet). Используется в 2D-плане, 3D-сцене
 * и в расчёте площадей — чтобы геометрия скругления нигде не дублировалась.
 */
const EPS = 1e-9;
/** Почти прямой/почти вырожденный угол не скругляем. */
const ANGLE_EPS = 1e-3;
function length(v) {
    return Math.hypot(v.x, v.y);
}
function unit(v) {
    const l = length(v);
    if (l <= EPS) {
        return { x: 0, y: 0 };
    }
    return { x: v.x / l, y: v.y / l };
}
/**
 * Скругление угла, заданного вершиной `corner` и двумя направлениями рёбер `dirA`, `dirB`,
 * выходящими ИЗ вершины. `maxTrim` ограничивает вынос точки касания (обычно половина длины
 * смежного ребра); при превышении радиус уменьшается под доступную длину.
 */
export function filletFromDirections(corner, dirA, dirB, radius, maxTrim = Number.POSITIVE_INFINITY) {
    if (!(radius > 0)) {
        return null;
    }
    const a = unit(dirA);
    const b = unit(dirB);
    if ((!a.x && !a.y) || (!b.x && !b.y)) {
        return null;
    }
    // Внутренний угол вершины.
    const cosTheta = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
    const theta = Math.acos(cosTheta);
    if (theta <= ANGLE_EPS || theta >= Math.PI - ANGLE_EPS) {
        return null;
    }
    const half = theta / 2;
    const tanHalf = Math.tan(half);
    if (tanHalf <= EPS) {
        return null;
    }
    let trim = radius / tanHalf;
    let effectiveRadius = radius;
    if (maxTrim > 0 && trim > maxTrim) {
        trim = maxTrim;
        effectiveRadius = trim * tanHalf;
    }
    if (!(effectiveRadius > 0) || !(trim > 0)) {
        return null;
    }
    const tangentA = { x: corner.x + a.x * trim, y: corner.y + a.y * trim };
    const tangentB = { x: corner.x + b.x * trim, y: corner.y + b.y * trim };
    const bisector = unit({ x: a.x + b.x, y: a.y + b.y });
    if (!bisector.x && !bisector.y) {
        return null;
    }
    const distToCenter = effectiveRadius / Math.sin(half);
    const center = {
        x: corner.x + bisector.x * distToCenter,
        y: corner.y + bisector.y * distToCenter,
    };
    const startAngle = Math.atan2(tangentA.y - center.y, tangentA.x - center.x);
    const endAngle = Math.atan2(tangentB.y - center.y, tangentB.x - center.x);
    // Размах между радиусами в центре равен внешнему углу (π − θ); берём кратчайшую дугу.
    let signedSweep = endAngle - startAngle;
    while (signedSweep > Math.PI) {
        signedSweep -= 2 * Math.PI;
    }
    while (signedSweep <= -Math.PI) {
        signedSweep += 2 * Math.PI;
    }
    return {
        radius: effectiveRadius,
        trim,
        tangentA,
        tangentB,
        center,
        turnAngle: Math.abs(signedSweep),
        startAngle,
        signedSweep,
    };
}
/**
 * Скругление угла полигона по трём вершинам. `trimFraction` ограничивает вынос точки
 * касания долей длины смежного ребра (по умолчанию половина), чтобы скругление помещалось.
 */
export function filletCorner(prev, corner, next, radius, trimFraction = 0.5) {
    const edgeA = { x: prev.x - corner.x, y: prev.y - corner.y };
    const edgeB = { x: next.x - corner.x, y: next.y - corner.y };
    const maxTrim = Math.min(length(edgeA), length(edgeB)) * trimFraction;
    if (maxTrim <= EPS) {
        return null;
    }
    return filletFromDirections(corner, edgeA, edgeB, radius, maxTrim);
}
/**
 * Точки дуги от startAngle с знаковым размахом signedSweep. Включает обе крайние точки
 * (i = 0 и i = segments), поэтому длина массива segments + 1.
 */
export function arcPolyline(center, radius, startAngle, signedSweep, segments) {
    const steps = Math.max(1, Math.floor(segments));
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
        const angle = startAngle + (signedSweep * i) / steps;
        points.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
    }
    return points;
}
/**
 * Контур полигона со скруглёнными вершинами в виде набора точек (дуги аппроксимированы
 * короткими отрезками). Подходит для расчёта площади и как fallback-геометрия.
 */
export function roundedContourPoints(polygon, radiusForIndex, segmentsPerArc = 10) {
    const n = polygon.length;
    if (n < 3) {
        return polygon.map((point) => ({ ...point }));
    }
    const out = [];
    for (let i = 0; i < n; i += 1) {
        const prev = polygon[(i - 1 + n) % n];
        const corner = polygon[i];
        const next = polygon[(i + 1) % n];
        const radius = radiusForIndex(i);
        const fillet = radius > 0 ? filletCorner(prev, corner, next, radius) : null;
        if (!fillet) {
            out.push({ ...corner });
            continue;
        }
        const arc = arcPolyline(fillet.center, fillet.radius, fillet.startAngle, fillet.signedSweep, Math.max(2, segmentsPerArc));
        arc.forEach((point) => out.push(point));
    }
    return out;
}
