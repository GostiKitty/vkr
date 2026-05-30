/**
 * Коэффициент β_V — отношение отапливаемого объёма к геометрическому (СП 50.13330.2024, приложение В).
 * Значения для типовых жилых и общественных зданий без неотапливаемых чердаков.
 */
const BETA_V_BY_CATEGORY = {
    residential: 0.85,
    medical: 0.9,
    preschool: 0.9,
    educational: 0.9,
    public: 0.92,
    administrative: 0.92,
    industrialDry: 0.95,
    industrialWet: 0.95,
    industrialHighHeat: 0.98,
    agricultural: 0.95,
    storage: 0.98,
};
/** Нормативный коэффициент β_V по категории здания; при отсутствии — 0,85 (жилые). */
export function getVolumeCoefficientBetaV(category) {
    if (!category) {
        return 0.85;
    }
    return BETA_V_BY_CATEGORY[category] ?? 0.85;
}
