/** Середина января — опорный зимний месяц (СП 131, табл. Б.2). */
const JANUARY_REFERENCE_DAY = 15;
/** Середина июля — опорный летний месяц (СП 131, табл. Б.2). */
const JULY_REFERENCE_DAY = 196;
/**
 * Интерполирует среднюю скорость ветра между зимним (январь) и летним (июль) значениями
 * по дню года. Используется косинусная интерполяция: минимум у зимнего якоря, максимум у летнего.
 */
export function interpolateSeasonalWindSpeedMps(winterWindSpeedM_s, summerWindSpeedM_s, dayOfYear) {
    const winter = winterWindSpeedM_s != null && Number.isFinite(winterWindSpeedM_s) ? Math.max(0, winterWindSpeedM_s) : null;
    const summer = summerWindSpeedM_s != null && Number.isFinite(summerWindSpeedM_s) ? Math.max(0, summerWindSpeedM_s) : null;
    if (winter == null && summer == null) {
        return null;
    }
    if (winter == null) {
        return summer;
    }
    if (summer == null) {
        return winter;
    }
    if (Math.abs(winter - summer) <= 1e-9) {
        return winter;
    }
    const normalizedDay = ((dayOfYear - JANUARY_REFERENCE_DAY) % 365 + 365) % 365;
    const halfYearDays = (JULY_REFERENCE_DAY - JANUARY_REFERENCE_DAY + 365) % 365 || 182;
    const phase = Math.min(1, Math.max(0, normalizedDay / halfYearDays));
    const blend = (1 - Math.cos(phase * Math.PI)) / 2;
    return winter + (summer - winter) * blend;
}
export function clampDayOfYear(dayOfYear) {
    if (dayOfYear == null || !Number.isFinite(dayOfYear)) {
        return JANUARY_REFERENCE_DAY;
    }
    return Math.min(365, Math.max(1, Math.round(dayOfYear)));
}
