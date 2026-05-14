import type { Sp50BuildingCategory } from "../../entities/geometry/types";

export interface BuildingCategoryDefinition {
  id: Sp50BuildingCategory;
  label: string;
  temperatureCategory: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export const BUILDING_CATEGORIES: Record<Sp50BuildingCategory, BuildingCategoryDefinition> = {
  residential: { id: "residential", label: "Жилые здания", temperatureCategory: 1 },
  medical: { id: "medical", label: "Медицинские здания", temperatureCategory: 1 },
  preschool: { id: "preschool", label: "Дошкольные организации", temperatureCategory: 1 },
  educational: { id: "educational", label: "Образовательные организации", temperatureCategory: 1 },
  public: { id: "public", label: "Общественные здания", temperatureCategory: 2 },
  administrative: { id: "administrative", label: "Административные и бытовые здания", temperatureCategory: 2 },
  industrialDry: { id: "industrialDry", label: "Производственные, сухой/нормальный режим", temperatureCategory: 3 },
  industrialWet: { id: "industrialWet", label: "Производственные, влажный/мокрый режим", temperatureCategory: 4 },
  industrialHighHeat: {
    id: "industrialHighHeat",
    label: "Производственные со значительными избытками явной теплоты",
    temperatureCategory: 5,
  },
  agricultural: { id: "agricultural", label: "Сельскохозяйственные здания", temperatureCategory: 3 },
  storage: { id: "storage", label: "Складские здания", temperatureCategory: 3 },
};

export interface HeatingEnergyNormRow {
  minStoreys: number;
  maxStoreys: number;
  qotNorm_kWh_m2: number;
}

export const HEATING_ENERGY_NORMS: Partial<Record<Sp50BuildingCategory, HeatingEnergyNormRow[]>> = {
  residential: [
    { minStoreys: 1, maxStoreys: 3, qotNorm_kWh_m2: 95 },
    { minStoreys: 4, maxStoreys: 8, qotNorm_kWh_m2: 75 },
    { minStoreys: 9, maxStoreys: 25, qotNorm_kWh_m2: 60 },
  ],
  public: [
    { minStoreys: 1, maxStoreys: 2, qotNorm_kWh_m2: 110 },
    { minStoreys: 3, maxStoreys: 8, qotNorm_kWh_m2: 85 },
    { minStoreys: 9, maxStoreys: 25, qotNorm_kWh_m2: 70 },
  ],
  administrative: [
    { minStoreys: 1, maxStoreys: 2, qotNorm_kWh_m2: 105 },
    { minStoreys: 3, maxStoreys: 8, qotNorm_kWh_m2: 82 },
    { minStoreys: 9, maxStoreys: 25, qotNorm_kWh_m2: 68 },
  ],
};

export function getBuildingCategoryDefinition(category: Sp50BuildingCategory): BuildingCategoryDefinition {
  return BUILDING_CATEGORIES[category];
}

export function getHeatingEnergyNorm(
  category: Sp50BuildingCategory | undefined,
  storeys: number | undefined
): number | null {
  if (!category || !storeys) {
    return null;
  }
  const rows = HEATING_ENERGY_NORMS[category];
  if (!rows) {
    return null;
  }
  const row = rows.find((candidate) => storeys >= candidate.minStoreys && storeys <= candidate.maxStoreys);
  return row?.qotNorm_kWh_m2 ?? null;
}
