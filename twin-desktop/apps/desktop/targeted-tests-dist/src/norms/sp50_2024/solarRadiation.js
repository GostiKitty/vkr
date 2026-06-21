const SOLAR_ABSORPTION = {
    lightFacade: 0.55,
    mediumFacade: 0.65,
    darkFacade: 0.75,
    metalRoof: 0.65,
    bitumenRoof: 0.8,
    glass: 0.3,
};
const SOLAR_RADIATION_REFERENCE = {
    central: { Imax_W_m2: 680, Iavg_W_m2: 340 },
    south: { Imax_W_m2: 760, Iavg_W_m2: 380 },
    north: { Imax_W_m2: 540, Iavg_W_m2: 260 },
};
export function getSolarAbsorptionCoefficient(surfaceId) {
    return SOLAR_ABSORPTION[surfaceId] ?? null;
}
export function getSolarRadiation(zoneId) {
    return SOLAR_RADIATION_REFERENCE[zoneId] ?? null;
}
export { SOLAR_ABSORPTION, SOLAR_RADIATION_REFERENCE };
