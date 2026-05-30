import type { BuildingModel } from "../../../entities/geometry/types";
import { computeWallProperties } from "../../../entities/material/types";
import type { ScenarioConfig } from "../../../entities/workflow/workflow.store";
import { defaultCo2EmissionFactorKgPerKWh } from "../../economics/defaultCo2EmissionFactors";
import { resolveHeatingEnergySource } from "../../economics/scenarioEnergyTariff";
import { resolveScenarioEcologyEmissionFactor } from "../../economics/resolveScenarioEcologyEmission";
import type { BuildBuildingPerformanceDiagnosticsOptions } from "../derived/types";
import { internalSurfaceTemperatureC } from "../formulas";
import type { ThermalSimulationResult } from "../solver";

export const DEFAULT_INDOOR_RELATIVE_HUMIDITY_PERCENT = 50;
export const DEFAULT_COMFORT_MAX_C = 26;

export type ComfortInputSource = "user" | "model" | "setpoints" | "fallback" | "result";

export interface ResolvedComfortScalar {
  value: number;
  source: ComfortInputSource;
  explicit: boolean;
}

export function resolveRelativeHumidityPercent(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedComfortScalar {
  const raw = scenarioConfig?.comfort?.relativeHumidityPercent;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  const fromModel = model.thermalProtection?.climate?.indoorRelativeHumidityPercent;
  if (fromModel != null && Number.isFinite(fromModel)) {
    return { value: fromModel, source: "model", explicit: false };
  }
  const resolvedDefault = scenario.comfort?.relativeHumidityPercent;
  if (resolvedDefault != null && Number.isFinite(resolvedDefault)) {
    return { value: resolvedDefault, source: "fallback", explicit: false };
  }
  return { value: DEFAULT_INDOOR_RELATIVE_HUMIDITY_PERCENT, source: "fallback", explicit: false };
}

export function resolveComfortMinC(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig
): ResolvedComfortScalar {
  const raw = scenarioConfig?.comfort?.comfortMinC;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  return {
    value: Math.min(scenario.setpoints.day, scenario.setpoints.night),
    source: "setpoints",
    explicit: false,
  };
}

export function resolveComfortMaxC(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig
): ResolvedComfortScalar {
  const raw = scenarioConfig?.comfort?.comfortMaxC;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  return { value: DEFAULT_COMFORT_MAX_C, source: "fallback", explicit: false };
}

/** Площадно-взвешенная MRT по τ_si фрагментов ограждения при расчётном ΔT (без RC-прогона). */
export function estimateMrtFromEnvelope(
  model: BuildingModel,
  indoorTemperatureC: number,
  outdoorDesignC: number
): number | null {
  const fragments = model.thermalProtection?.envelope ?? [];
  const surfaces: Array<{ tau_si: number; areaM2: number }> = [];
  fragments.forEach((fragment) => {
    if (!fragment.layers?.length || !(fragment.areaM2 > 0)) {
      return;
    }
    const props = computeWallProperties(fragment.layers, undefined, { includeSp50AirFilms: true });
    const totalResistance = props.rValue;
    if (!totalResistance || totalResistance <= 0) {
      return;
    }
    const tau_si = internalSurfaceTemperatureC(
      indoorTemperatureC,
      outdoorDesignC,
      props.rSi_m2K_W || 0.13,
      totalResistance
    );
    surfaces.push({ tau_si, areaM2: fragment.areaM2 });
  });
  if (!surfaces.length) {
    return null;
  }
  const totalArea = surfaces.reduce((sum, surface) => sum + surface.areaM2, 0);
  if (totalArea <= 0) {
    return null;
  }
  return surfaces.reduce((sum, surface) => sum + surface.tau_si * surface.areaM2, 0) / totalArea;
}

/** Площадно-взвешенная оценка MRT по зонам после RC-прогона. */
export function estimateBuildingMeanMrtC(
  thermalResult: ThermalSimulationResult | null | undefined
): number | null {
  const zones = thermalResult?.diagnostics?.buildingPerformance?.operativeTemperature?.zones;
  if (!zones?.length) {
    return null;
  }
  const values = zones
    .map((zone) => zone.T_mrt?.value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildPerformanceOptionsFromScenario(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model?: BuildingModel | null
): BuildBuildingPerformanceDiagnosticsOptions {
  const resolvedEmission = resolveScenarioEcologyEmissionFactor(scenarioConfig);
  let emissionFactorKgPerKWh = resolvedEmission.value;
  let energySourceLabel = scenarioConfig?.ecology?.energySource ?? scenario.ecology?.energySource ?? null;

  if (emissionFactorKgPerKWh == null && model) {
    const heatingSource = resolveHeatingEnergySource(scenario, model);
    if (heatingSource !== "unknown") {
      emissionFactorKgPerKWh = defaultCo2EmissionFactorKgPerKWh(heatingSource);
      if (!energySourceLabel) {
        energySourceLabel =
          heatingSource === "electricity"
            ? "electricity"
            : heatingSource === "gas"
              ? "natural_gas"
              : "централизованное теплоснабжение";
      }
    }
  }

  return {
    comfortMinC: resolveComfortMinC(scenarioConfig, scenario).value,
    comfortMaxC: resolveComfortMaxC(scenarioConfig, scenario).value,
    emissionFactorKgPerKWh,
    energySourceLabel,
  };
}
