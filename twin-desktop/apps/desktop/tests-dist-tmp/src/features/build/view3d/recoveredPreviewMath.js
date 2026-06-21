const MIN_DIMENSION_M = 5;
export function createEmptyRecoveredBounds() {
    return {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
        minZ: Number.POSITIVE_INFINITY,
        maxZ: Number.NEGATIVE_INFINITY,
        center: { x: 0, y: 0, z: 0 },
        size: { x: 0, y: 0, z: 0 },
        empty: true,
    };
}
export function extendRecoveredBounds(bounds, x, y, z) {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxZ = Math.max(bounds.maxZ, z);
    bounds.empty = false;
}
export function extendRecoveredBoundsWithPolygon(bounds, polygon, minY, maxY) {
    polygon.forEach((point) => {
        extendRecoveredBounds(bounds, point.x, minY, point.y);
        extendRecoveredBounds(bounds, point.x, maxY, point.y);
    });
}
export function finalizeRecoveredBounds(bounds) {
    if (bounds.empty) {
        return bounds;
    }
    const rawSize = {
        x: bounds.maxX - bounds.minX,
        y: bounds.maxY - bounds.minY,
        z: bounds.maxZ - bounds.minZ,
    };
    bounds.size = {
        x: Math.max(rawSize.x, MIN_DIMENSION_M),
        y: Math.max(rawSize.y, MIN_DIMENSION_M * 0.6),
        z: Math.max(rawSize.z, MIN_DIMENSION_M),
    };
    bounds.center = {
        x: (bounds.minX + bounds.maxX) * 0.5,
        y: (bounds.minY + bounds.maxY) * 0.5,
        z: (bounds.minZ + bounds.maxZ) * 0.5,
    };
    return bounds;
}
export function calculateRecoveredCameraFrame(bounds, mode = "focus") {
    if (bounds.empty) {
        return {
            position: { x: 12, y: 9, z: 12 },
            target: { x: 0, y: 1, z: 0 },
            distance: 12,
            near: 0.1,
            far: 1000,
        };
    }
    const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, MIN_DIMENSION_M);
    const distance = mode === "top" ? maxDim * 1.5 : maxDim * 1.8;
    const target = { ...bounds.center };
    const position = mode === "top"
        ? { x: target.x, y: target.y + distance, z: target.z + 0.01 }
        : { x: target.x + distance, y: target.y + distance * 0.8, z: target.z + distance };
    return {
        position,
        target,
        distance,
        near: Math.max(distance / 100, 0.01),
        far: Math.max(distance * 100, 1000),
    };
}
export function calculateRecoveredGrid(bounds) {
    const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, MIN_DIMENSION_M);
    return {
        size: maxDim * 2,
        divisions: Math.min(40, Math.max(10, Math.round(maxDim * 2))),
        center: bounds.center,
    };
}
