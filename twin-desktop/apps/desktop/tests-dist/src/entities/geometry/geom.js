const EPS = 1e-6;
export function polygonArea(points) {
    if (points.length < 3) {
        return 0;
    }
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }
    return area / 2;
}
export function polygonCentroid(points) {
    const area = polygonArea(points);
    if (Math.abs(area) < EPS) {
        const avg = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
        const count = points.length || 1;
        return { x: avg.x / count, y: avg.y / count };
    }
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < points.length; i++) {
        const p0 = points[i];
        const p1 = points[(i + 1) % points.length];
        const factor = p0.x * p1.y - p1.x * p0.y;
        cx += (p0.x + p1.x) * factor;
        cy += (p0.y + p1.y) * factor;
    }
    const scale = 1 / (6 * area);
    return { x: cx * scale, y: cy * scale };
}
export function snapToGrid(vec, gridStep) {
    if (gridStep <= 0) {
        return { ...vec };
    }
    return {
        x: Math.round(vec.x / gridStep) * gridStep,
        y: Math.round(vec.y / gridStep) * gridStep,
    };
}
export function segmentLength(a, b) {
    return Math.sqrt(distanceSquared(a, b));
}
export function pointToSegmentDistance(point, a, b) {
    const lengthSquared = distanceSquared(a, b);
    if (lengthSquared === 0) {
        return segmentLength(point, a);
    }
    let t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const projection = {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
    };
    return segmentLength(point, projection);
}
function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}
export function polygonContainsPoint(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersect = yi > point.y !== yj > point.y &&
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + EPS) + xi;
        if (intersect) {
            inside = !inside;
        }
    }
    return inside;
}
export function simplifyPolygon(points, tolerance = 1e-3) {
    if (points.length <= 3) {
        return points.slice();
    }
    const simplified = [];
    for (let i = 0; i < points.length; i++) {
        const prev = points[(i - 1 + points.length) % points.length];
        const current = points[i];
        const next = points[(i + 1) % points.length];
        const area = Math.abs(prev.x * (current.y - next.y) +
            current.x * (next.y - prev.y) +
            next.x * (prev.y - current.y));
        if (area / 2 > tolerance) {
            simplified.push(current);
        }
    }
    return simplified.length >= 3 ? simplified : points.slice();
}
export function validateRoomPolygon(points) {
    if (points.length < 3) {
        return { valid: false, reason: "Нужно минимум три точки" };
    }
    const simplified = simplifyPolygon(points);
    const area = Math.abs(polygonArea(simplified));
    if (area < 0.1) {
        return { valid: false, reason: "Полигон слишком маленький" };
    }
    if (isPolygonSelfIntersecting(simplified)) {
        return { valid: false, reason: "Полигон самопересекается" };
    }
    if (!isClockwiseConsistent(simplified)) {
        simplified.reverse();
    }
    return { valid: true, normalized: simplified };
}
function isClockwiseConsistent(points) {
    return polygonArea(points) < 0;
}
export function isPolygonSelfIntersecting(points) {
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
}
export function segmentsIntersect(a1, a2, b1, b2, tolerance = EPS) {
    const det = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const onSegment = (p, q, r) => Math.min(p.x, r.x) - tolerance <= q.x &&
        q.x <= Math.max(p.x, r.x) + tolerance &&
        Math.min(p.y, r.y) - tolerance <= q.y &&
        q.y <= Math.max(p.y, r.y) + tolerance;
    const d1 = det(a1, a2, b1);
    const d2 = det(a1, a2, b2);
    const d3 = det(b1, b2, a1);
    const d4 = det(b1, b2, a2);
    if (((d1 > tolerance && d2 < -tolerance) || (d1 < -tolerance && d2 > tolerance)) &&
        ((d3 > tolerance && d4 < -tolerance) || (d3 < -tolerance && d4 > tolerance))) {
        return true;
    }
    if (Math.abs(d1) <= tolerance && onSegment(a1, b1, a2))
        return true;
    if (Math.abs(d2) <= tolerance && onSegment(a1, b2, a2))
        return true;
    if (Math.abs(d3) <= tolerance && onSegment(b1, a1, b2))
        return true;
    if (Math.abs(d4) <= tolerance && onSegment(b1, a2, b2))
        return true;
    return false;
}
export function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
export function orthogonalSnap(target, origin) {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    if (Math.abs(dx) > Math.abs(dy)) {
        return { x: target.x, y: origin.y };
    }
    return { x: origin.x, y: target.y };
}
export function angleBetween(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
}
