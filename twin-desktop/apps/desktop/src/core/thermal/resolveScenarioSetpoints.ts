import type { BuildingModel } from "../../entities/geometry/types";
import {
  createDefaultScenarioConfig,
  type ScenarioConfig,
} from "../../entities/workflow/workflow.store";

/** Типовое ночное снижение уставки относительно дневной, °C. */
export const SETPOINT_NIGHT_SETBACK_C = 3;

const VALUE_EPS = 1e-4;

export type SetpointScalarSource = "scenario" | "sp50" | "fallback";

export interface ResolvedSetpointScalar {
  value: number;
  source: SetpointScalarSource;
}

export function modelIndoorDesignTemperatureC(model: BuildingModel): number | null {
  const value = model.thermalProtection?.climate?.indoorTemperatureC;
  return value != null && Number.isFinite(value) ? value : null;
}

export function suggestedNightSetpointC(dayC: number): number {
  return Math.round((dayC - SETPOINT_NIGHT_SETBACK_C) * 10) / 10;
}

function matches(value: number, target: number): boolean {
  return Math.abs(value - target) <= VALUE_EPS;
}

export function resolveDaySetpointScalar(
  _scenarioConfig: ScenarioConfig | null | undefined,
  resolved: ScenarioConfig,
  model: BuildingModel
): ResolvedSetpointScalar {
  const day = resolved.setpoints.day;
  const modelIndoor = modelIndoorDesignTemperatureC(model);
  if (modelIndoor != null && matches(day, modelIndoor)) {
    return { value: day, source: "sp50" };
  }
  const defaults = createDefaultScenarioConfig();
  if (matches(day, defaults.setpoints.day)) {
    return { value: day, source: "fallback" };
  }
  return { value: day, source: "scenario" };
}

export function resolveNightSetpointScalar(
  _scenarioConfig: ScenarioConfig | null | undefined,
  resolved: ScenarioConfig,
  model: BuildingModel
): ResolvedSetpointScalar {
  const night = resolved.setpoints.night;
  const modelIndoor = modelIndoorDesignTemperatureC(model);
  if (modelIndoor != null) {
    const suggestedNight = suggestedNightSetpointC(modelIndoor);
    if (matches(night, suggestedNight) && matches(resolved.setpoints.day, modelIndoor)) {
      return { value: night, source: "sp50" };
    }
  }
  const defaults = createDefaultScenarioConfig();
  if (matches(night, defaults.setpoints.night)) {
    return { value: night, source: "fallback" };
  }
  return { value: night, source: "scenario" };
}

export function applyModelIndoorSetpointsToConfig(draft: ScenarioConfig, model: BuildingModel): void {
  const indoor = modelIndoorDesignTemperatureC(model);
  if (indoor == null) {
    return;
  }
  draft.setpoints.day = indoor;
  draft.setpoints.night = suggestedNightSetpointC(indoor);
}

export function setpointScalarToOrigin(source: SetpointScalarSource): "scenario" | "sp50" | "fallback" {
  return source;
}
