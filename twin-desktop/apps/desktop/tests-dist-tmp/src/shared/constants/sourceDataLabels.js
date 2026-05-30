export const AUTO_CALCULATED_SOURCE_LABEL = "рассчитано автоматически";
export const MODEL_SOURCE_LABEL = "из модели";
export const DEMO_FALLBACK_SOURCE_LABEL = "демо-значение, можно заменить";
export function isAutoCalculatedDataSource(origin) {
    return origin === "calculated" || origin === "result";
}
export function isModelDataSource(origin) {
    return origin === "model";
}
export function isDemoFallbackDataSource(origin) {
    return origin === "fallback";
}
