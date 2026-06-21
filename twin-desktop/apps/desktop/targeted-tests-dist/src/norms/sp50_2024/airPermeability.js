const AIR_PERMEABILITY_LIMITS_KG_M2H = {
    wall: 0.5,
    roof: 0.5,
    atticFloor: 0.5,
    floorOverBasement: 0.5,
    window: 5,
    door: 7,
    gate: 10,
};
const LAYER_AIR_RESISTANCE = {
    concrete: 158,
    brick: 18,
    mineral_wool: 2,
    gypsum: 9,
    glass: 100000,
    xps: 50,
    wood: 12,
    aerated_concrete: 9,
};
export function getNormalizedAirPermeability(constructionType) {
    return AIR_PERMEABILITY_LIMITS_KG_M2H[constructionType] ?? null;
}
export function getLayerAirPermeabilityResistance(materialId) {
    return LAYER_AIR_RESISTANCE[materialId] ?? null;
}
export { AIR_PERMEABILITY_LIMITS_KG_M2H, LAYER_AIR_RESISTANCE };
