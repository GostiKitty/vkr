import type { BuildingModel, Sp50ClimateData } from "../../../entities/geometry/types";
import type { ScenarioConfig } from "../../../entities/workflow/workflow.store";
import { getSp131CityClimate, type Sp131CityClimate } from "../../../norms/sp131_2025/climate";

const DEFAULT_CLIMATE_CITY_ID = "moscow";

function hasOutdoorClimateData(climate: Sp50ClimateData | undefined): boolean {
  if (!climate) {
    return false;
  }
  return (
    climate.outdoorDesignTemperatureC != null ||
    climate.outdoorHeatingPeriodAverageC != null ||
    climate.heatingPeriodDurationDays != null
  );
}

export function inferSp131CityIdFromClimate(climate: Sp50ClimateData | undefined): string | null {
  if (!climate?.city) {
    return null;
  }
  const matched = getSp131CityClimate(climate.city);
  return matched?.id ?? null;
}

export function resolvePreferredClimateCityId(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null | undefined
): string {
  const scenarioCityId = scenarioConfig?.climateCityId?.trim();
  if (scenarioCityId) {
    return scenarioCityId;
  }
  const modelCityId = inferSp131CityIdFromClimate(model.thermalProtection?.climate);
  if (modelCityId) {
    return modelCityId;
  }
  const metaCity =
    typeof model.meta?.climateCityId === "string"
      ? model.meta.climateCityId.trim()
      : typeof model.meta?.climateSource === "string"
        ? model.meta.climateSource.match(/#(\w+)/)?.[1] ?? null
        : null;
  if (metaCity && getSp131CityClimate(metaCity)) {
    return metaCity;
  }
  return DEFAULT_CLIMATE_CITY_ID;
}

export function buildSp50ClimateFromSp131City(
  city: Sp131CityClimate,
  base: Sp50ClimateData | undefined,
  indoorTemperatureC: number,
  indoorRelativeHumidityPercent: number,
  options?: { overwriteOutdoor?: boolean }
): Sp50ClimateData {
  const overwriteOutdoor = options?.overwriteOutdoor ?? false;
  return {
    ...base,
    city: city.label,
    outdoorDesignTemperatureC:
      overwriteOutdoor || base?.outdoorDesignTemperatureC == null
        ? city.outdoorDesignTemperatureC
        : base.outdoorDesignTemperatureC,
    outdoorHeatingPeriodAverageC:
      overwriteOutdoor || base?.outdoorHeatingPeriodAverageC == null
        ? city.outdoorHeatingPeriodAverageC
        : base.outdoorHeatingPeriodAverageC,
    heatingPeriodDurationDays:
      overwriteOutdoor || base?.heatingPeriodDurationDays == null
        ? city.heatingPeriodDurationDays
        : base.heatingPeriodDurationDays,
    indoorTemperatureC: base?.indoorTemperatureC ?? indoorTemperatureC,
    indoorRelativeHumidityPercent: base?.indoorRelativeHumidityPercent ?? indoorRelativeHumidityPercent,
    humidityZone: base?.humidityZone ?? "normal",
  };
}

export function applySp131ClimateToModel(
  model: BuildingModel,
  cityId: string,
  options?: { indoorTemperatureC?: number; indoorRelativeHumidityPercent?: number }
): BuildingModel {
  const city = getSp131CityClimate(cityId);
  if (!city) {
    return model;
  }
  const base = model.thermalProtection?.climate;
  const indoorTemperatureC = options?.indoorTemperatureC ?? base?.indoorTemperatureC ?? 20;
  const indoorRelativeHumidityPercent =
    options?.indoorRelativeHumidityPercent ?? base?.indoorRelativeHumidityPercent ?? 50;

  return {
    ...model,
    thermalProtection: {
      ...(model.thermalProtection ?? {}),
      climate: buildSp50ClimateFromSp131City(city, base, indoorTemperatureC, indoorRelativeHumidityPercent, {
        overwriteOutdoor: true,
      }),
    },
  };
}

/** Заполняет `thermalProtection.climate` из СП 131, если в модели ещё нет наружного климата. */
export function ensureModelClimate(
  model: BuildingModel,
  scenarioConfig?: ScenarioConfig | null | undefined
): BuildingModel {
  const existing = model.thermalProtection?.climate;
  const cityId = resolvePreferredClimateCityId(model, scenarioConfig);
  const existingCityId = inferSp131CityIdFromClimate(existing);
  if (hasOutdoorClimateData(existing) && existingCityId === cityId) {
    return model;
  }

  return applySp131ClimateToModel(model, cityId, {
    indoorTemperatureC: existing?.indoorTemperatureC ?? scenarioConfig?.setpoints?.day ?? 20,
    indoorRelativeHumidityPercent:
      existing?.indoorRelativeHumidityPercent ?? scenarioConfig?.comfort?.relativeHumidityPercent ?? 50,
  });
}
