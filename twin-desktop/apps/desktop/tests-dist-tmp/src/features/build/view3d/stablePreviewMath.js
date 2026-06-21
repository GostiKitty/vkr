const DEFAULT_MIN_PLAN_DIM_M = 8;
const DEFAULT_MIN_HEIGHT_M = 3;
const FIT_DIRECTION = (() => {
    const length = Math.hypot(1, 0.8, 1);
    return { x: 1 / length, y: 0.8 / length, z: 1 / length };
})();
export function normalizeStablePreviewBounds(center, size, options) {
    const minPlanDimM = options?.minPlanDimM ?? DEFAULT_MIN_PLAN_DIM_M;
    const minHeightM = options?.minHeightM ?? DEFAULT_MIN_HEIGHT_M;
    const safeSize = {
        x: Number.isFinite(size.x) ? Math.max(size.x, minPlanDimM) : minPlanDimM,
        y: Number.isFinite(size.y) ? Math.max(size.y, minHeightM) : minHeightM,
        z: Number.isFinite(size.z) ? Math.max(size.z, minPlanDimM) : minPlanDimM,
    };
    return {
        center: {
            x: Number.isFinite(center.x) ? center.x : 0,
            y: Number.isFinite(center.y) ? center.y : 0,
            z: Number.isFinite(center.z) ? center.z : 0,
        },
        size: safeSize,
        maxDim: Math.max(safeSize.x, safeSize.y, safeSize.z),
        usedFallbackSize: safeSize.x !== size.x || safeSize.y !== size.y || safeSize.z !== size.z,
    };
}
export function calculateFitCameraForBounds(bounds, aspectRatio, fovDeg, fitPadding = 1.55) {
    const safeAspect = Number.isFinite(aspectRatio) ? Math.max(aspectRatio, 0.5) : 1;
    const halfFovRad = (Math.max(fovDeg, 10) * Math.PI) / 360;
    const fitHeightDistance = bounds.size.y / Math.max(2 * Math.tan(halfFovRad), 0.1);
    const fitWidthDistance = bounds.size.x / Math.max(2 * Math.tan(halfFovRad) * safeAspect, 0.1);
    const fitDepthDistance = bounds.size.z / Math.max(2 * Math.tan(halfFovRad) * safeAspect, 0.1);
    const distance = Math.max(fitHeightDistance, fitWidthDistance, fitDepthDistance, bounds.maxDim * 0.55) * fitPadding;
    return {
        target: bounds.center,
        position: {
            x: bounds.center.x + FIT_DIRECTION.x * distance,
            y: bounds.center.y + FIT_DIRECTION.y * distance,
            z: bounds.center.z + FIT_DIRECTION.z * distance,
        },
        distance,
        near: Math.max(distance / 100, 0.01),
        far: Math.max(distance * 100, 1000),
    };
}
export function calculateTopViewCameraForBounds(bounds, aspectRatio, fovDeg, fitPadding = 1.45) {
    const safeAspect = Number.isFinite(aspectRatio) ? Math.max(aspectRatio, 0.5) : 1;
    const halfFovRad = (Math.max(fovDeg, 10) * Math.PI) / 360;
    const planDistance = Math.max(bounds.size.x / Math.max(2 * Math.tan(halfFovRad) * safeAspect, 0.1), bounds.size.z / Math.max(2 * Math.tan(halfFovRad), 0.1), bounds.maxDim * 0.6) * fitPadding;
    return {
        target: bounds.center,
        position: {
            x: bounds.center.x,
            y: bounds.center.y + planDistance,
            z: bounds.center.z + 0.01,
        },
        distance: planDistance,
        near: Math.max(planDistance / 100, 0.01),
        far: Math.max(planDistance * 100, 1000),
    };
}
export function calculateGridLayoutForBounds(bounds) {
    const size = Math.max(bounds.maxDim * 2.4, 18);
    return {
        size,
        divisions: Math.max(12, Math.min(96, Math.round(size))),
        position: {
            x: bounds.center.x,
            y: bounds.center.y - bounds.size.y * 0.5,
            z: bounds.center.z,
        },
    };
}
