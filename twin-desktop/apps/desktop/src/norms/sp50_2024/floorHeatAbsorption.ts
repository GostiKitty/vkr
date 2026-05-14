import type { Sp50BuildingCategory } from "../../entities/geometry/types";

const FLOOR_HEAT_ABSORPTION_LIMITS: Partial<Record<Sp50BuildingCategory, number>> = {
  residential: 12,
  public: 13,
  educational: 12,
  preschool: 11,
  medical: 12,
  administrative: 13,
};

export function getFloorHeatAbsorptionLimit(category: Sp50BuildingCategory | undefined): number | null {
  if (!category) {
    return null;
  }
  return FLOOR_HEAT_ABSORPTION_LIMITS[category] ?? null;
}

export { FLOOR_HEAT_ABSORPTION_LIMITS };
