import { getTransientFrame } from "../../../core/thermal/transient/index";
export function clampTransientTimeIndex(result, timeIndex) {
    if (!result?.time.length) {
        return 0;
    }
    return Math.min(Math.max(0, Math.round(timeIndex)), result.time.length - 1);
}
export function buildTransientVisualizationFrame(params) {
    const { result, sourceId, sourceType } = params;
    if (!result || !result.valid || !result.stable || !sourceId || !sourceType) {
        return null;
    }
    const safeIndex = clampTransientTimeIndex(result, params.timeIndex);
    const frame = getTransientFrame(result, safeIndex);
    const profile = frame.nodes.map((x_m, index) => ({
        x_m,
        temperature_C: frame.temperature[index] ?? NaN,
    }));
    const temperatures = profile.map((entry) => entry.temperature_C).filter((value) => Number.isFinite(value));
    return {
        sourceId,
        sourceType,
        time_s: frame.time_s,
        innerSurfaceTemperature_C: frame.innerSurfaceTemperature_C,
        outerSurfaceTemperature_C: frame.outerSurfaceTemperature_C,
        profile,
        minTemperature_C: temperatures.length ? Math.min(...temperatures) : result.minTemperature,
        maxTemperature_C: temperatures.length ? Math.max(...temperatures) : result.maxTemperature,
        stable: result.stable,
        warnings: result.warnings,
    };
}
export function transientSourceMatches(frame, sourceType, sourceId) {
    return Boolean(frame && frame.sourceType === sourceType && frame.sourceId === sourceId);
}
