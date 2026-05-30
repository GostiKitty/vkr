import type { HeatingEnergySource } from "./types";

/** Удельные выбросы CO₂ по источнику тепла, кг CO₂/кВт·ч тепловой энергии */
export const DEFAULT_CO2_EMISSION_FACTORS_KG_PER_KWH: Record<HeatingEnergySource, number> = {
  gas: 0.22,
  heat: 0.2,
  electricity: 0.35,
  unknown: 0.22,
};

export const CO2_EMISSION_FACTOR_NORM_NOTES: Record<HeatingEnergySource, string> = {
  gas: "ГОСТ Р 56277 · природный газ 55,9 г CO₂/МДж, η≈0,92",
  heat: "ЦТ от ТЭЦ на газе (когенерация)",
  electricity: "среднее по ОЭС РФ (приказ Минэнерго №1069-2021)",
  unknown: "типовое значение",
};

export function defaultCo2EmissionFactorKgPerKWh(heatingSource: HeatingEnergySource): number {
  return DEFAULT_CO2_EMISSION_FACTORS_KG_PER_KWH[heatingSource];
}

/** Сопоставление значения поля «Источник энергии» в сценарии с типом тепла. */
export function ecologyEnergySourceToHeatingSource(
  energySource: string | null | undefined
): HeatingEnergySource | null {
  const normalized = energySource?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }
  if (normalized === "electricity") {
    return "electricity";
  }
  if (normalized === "gas" || normalized === "natural_gas" || normalized.includes("газ")) {
    return "gas";
  }
  if (
    normalized === "централизованное теплоснабжение" ||
    normalized.includes("теплоснабж") ||
    normalized.includes("цт")
  ) {
    return "heat";
  }
  return null;
}

export function defaultCo2EmissionFactorFromEcologyEnergySource(
  energySource: string | null | undefined
): number | null {
  const heatingSource = ecologyEnergySourceToHeatingSource(energySource);
  if (!heatingSource) {
    return null;
  }
  return defaultCo2EmissionFactorKgPerKWh(heatingSource);
}
