import type { BuildingModel } from "../../../entities/geometry/types";
import type { ScenarioConfig } from "../../../entities/workflow/workflow.store";
import { summarizeInfiltrationGeometry } from "../infiltration";

export type VentilationInputSource = "user" | "model" | "fallback" | "calculated";

export interface ResolvedVentilationScalar {
  value: number;
  source: VentilationInputSource;
  explicit: boolean;
}

export interface ResolvedVentilationFlag {
  value: boolean;
  source: VentilationInputSource;
  explicit: boolean;
}

export interface ResolvedVentilationInputs {
  infiltrationACH: ResolvedVentilationScalar;
  ventilationACH: ResolvedVentilationScalar;
  heatRecoveryFactor: ResolvedVentilationScalar;
  mechanicalVentilationEnabled: ResolvedVentilationFlag;
  stackHeightM: ResolvedVentilationScalar;
}

function resolveEnergyVentilation(model: BuildingModel) {
  return model.thermalProtection?.energyVentilation;
}

export function resolveInfiltrationACH(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedVentilationScalar {
  const raw = scenarioConfig?.ventilation?.infiltrationACH;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  const fromModel = resolveEnergyVentilation(model)?.infiltrationACH;
  if (fromModel != null && Number.isFinite(fromModel)) {
    return { value: fromModel, source: "model", explicit: false };
  }
  return { value: scenario.ventilation.infiltrationACH, source: "fallback", explicit: false };
}

export function resolveVentilationACH(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedVentilationScalar {
  const raw = scenarioConfig?.ventilation?.ventilationACH;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  const fromModel = resolveEnergyVentilation(model)?.ventilationACH;
  if (fromModel != null && Number.isFinite(fromModel)) {
    return { value: fromModel, source: "model", explicit: false };
  }
  return { value: scenario.ventilation.ventilationACH, source: "fallback", explicit: false };
}

export function resolveHeatRecoveryFactor(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedVentilationScalar {
  const raw = scenarioConfig?.ventilation?.heatRecoveryFactor;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  const fromModel = resolveEnergyVentilation(model)?.heatRecoveryFactor;
  if (fromModel != null && Number.isFinite(fromModel)) {
    return { value: fromModel, source: "model", explicit: false };
  }
  return { value: scenario.ventilation.heatRecoveryFactor, source: "fallback", explicit: false };
}

export function resolveMechanicalVentilationEnabled(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig
): ResolvedVentilationFlag {
  const raw = scenarioConfig?.ventilation?.mechanicalVentilationEnabled;
  if (typeof raw === "boolean") {
    return { value: raw, source: "user", explicit: true };
  }
  return { value: scenario.ventilation.mechanicalVentilationEnabled, source: "fallback", explicit: false };
}

export function resolveStackHeightM(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedVentilationScalar {
  const raw = scenarioConfig?.ventilation?.pressureBased?.stackHeightM;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  const fromGeometry = summarizeInfiltrationGeometry(model).stackHeightM;
  if (fromGeometry > 0 && Number.isFinite(fromGeometry)) {
    return { value: fromGeometry, source: "model", explicit: false };
  }
  const fallback = scenario.ventilation.pressureBased?.stackHeightM ?? 6;
  return { value: fallback, source: "fallback", explicit: false };
}

export function resolveScenarioVentilationInputs(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedVentilationInputs {
  return {
    infiltrationACH: resolveInfiltrationACH(scenarioConfig, scenario, model),
    ventilationACH: resolveVentilationACH(scenarioConfig, scenario, model),
    heatRecoveryFactor: resolveHeatRecoveryFactor(scenarioConfig, scenario, model),
    mechanicalVentilationEnabled: resolveMechanicalVentilationEnabled(scenarioConfig, scenario),
    stackHeightM: resolveStackHeightM(scenarioConfig, scenario, model),
  };
}
