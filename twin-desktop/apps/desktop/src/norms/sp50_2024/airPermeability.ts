import type { Sp50ConstructionType } from "../../entities/geometry/types";

const AIR_PERMEABILITY_LIMITS_KG_M2H: Partial<Record<Sp50ConstructionType, number>> = {
  wall: 0.5,
  roof: 0.5,
  atticFloor: 0.5,
  floorOverBasement: 0.5,
  window: 5,
  door: 7,
  gate: 10,
};

const LAYER_AIR_RESISTANCE: Record<string, number> = {
  concrete: 158,
  brick: 18,
  mineral_wool: 2,
  gypsum: 9,
  glass: 100000,
  xps: 50,
  wood: 12,
  aerated_concrete: 9,
};

export function getNormalizedAirPermeability(constructionType: Sp50ConstructionType): number | null {
  return AIR_PERMEABILITY_LIMITS_KG_M2H[constructionType] ?? null;
}

export function getLayerAirPermeabilityResistance(materialId: string): number | null {
  return LAYER_AIR_RESISTANCE[materialId] ?? null;
}

export { AIR_PERMEABILITY_LIMITS_KG_M2H, LAYER_AIR_RESISTANCE };
