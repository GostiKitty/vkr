import type { BuildingModel, Sp50ClimateData } from "../../entities/geometry/types";
import type { ScenarioConfig } from "../../entities/workflow/workflow.store";
import { runSP50Compliance, type Sp50ComplianceReport } from "../../core/thermal/sp50";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { firstDisplayText } from "../../shared/utils/displayText";

export function buildResultsClimateInput(
  climateMeta: Sp50ClimateData | undefined,
  scenarioConfig: ScenarioConfig | null
): Partial<Sp50ClimateData> | undefined {
  const cityClimate = getSp131CityClimate(scenarioConfig?.climateCityId ?? climateMeta?.city ?? null);
  const cityLabel = firstDisplayText([climateMeta?.city, cityClimate?.label], "", { allowInternalId: false });

  return {
    city: cityLabel || undefined,
    climateRegion: valueOrUndefined(climateMeta?.climateRegion),
    indoorTemperatureC: numberOrUndefined(climateMeta?.indoorTemperatureC ?? scenarioConfig?.setpoints.day),
    outdoorHeatingPeriodAverageC:
      numberOrUndefined(climateMeta?.outdoorHeatingPeriodAverageC ?? cityClimate?.outdoorHeatingPeriodAverageC),
    heatingPeriodDurationDays:
      numberOrUndefined(climateMeta?.heatingPeriodDurationDays ?? cityClimate?.heatingPeriodDurationDays),
    outdoorDesignTemperatureC:
      numberOrUndefined(climateMeta?.outdoorDesignTemperatureC ?? cityClimate?.outdoorDesignTemperatureC),
    indoorRelativeHumidityPercent: numberOrUndefined(climateMeta?.indoorRelativeHumidityPercent),
    humidityZone: climateMeta?.humidityZone,
    solarRadiationZone: valueOrUndefined(climateMeta?.solarRadiationZone),
    solarRadiationIavg_W_m2: numberOrUndefined(climateMeta?.solarRadiationIavg_W_m2),
    solarRadiationImax_W_m2: numberOrUndefined(climateMeta?.solarRadiationImax_W_m2),
  };
}

export function hasResultsBuildingGeometry(model: BuildingModel): boolean {
  return model.rooms.length > 0;
}

export function buildResultsSp50Report(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null
): Sp50ComplianceReport | null {
  if (!hasResultsBuildingGeometry(model)) {
    return null;
  }
  const climateInput = buildResultsClimateInput(model.thermalProtection?.climate, scenarioConfig);
  try {
    return runSP50Compliance(model, climateInput, {
      defaultIndoorTemperatureC: scenarioConfig?.setpoints.day ?? 20,
      defaultOutdoorTemperatureC: climateInput?.outdoorDesignTemperatureC ?? scenarioConfig?.climate.baseC ?? -20,
    });
  } catch {
    return null;
  }
}

function numberOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function valueOrUndefined(value: string | null | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
