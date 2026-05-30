const FLOOR_HEAT_ABSORPTION_LIMITS = {
    residential: 12,
    public: 13,
    educational: 12,
    preschool: 11,
    medical: 12,
    administrative: 13,
};
export function getFloorHeatAbsorptionLimit(category) {
    if (!category) {
        return null;
    }
    return FLOOR_HEAT_ABSORPTION_LIMITS[category] ?? null;
}
export { FLOOR_HEAT_ABSORPTION_LIMITS };
