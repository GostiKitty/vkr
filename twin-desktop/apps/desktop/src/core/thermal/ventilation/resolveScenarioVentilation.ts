import type { BuildingModel } from "../../../entities/geometry/types";
import type { ScenarioConfig, ScenarioPressureBasedInfiltrationConfig } from "../../../entities/workflow/workflow.store";
import { getSp131CityClimate } from "../../../norms/sp131_2025/climate";
import { resolvePreferredClimateCityId } from "../climate/ensureModelClimate";
import { clampDayOfYear, interpolateSeasonalWindSpeedMps } from "../climate/resolveSeasonalWindSpeed";
import { achFromAirflowM3s } from "../formulas";
import {
  DEFAULT_WIND_PRESSURE_COEFFICIENT,
  DEFAULT_WIND_SPEED_M_S,
  estimateHeatedVolumeM3,
  summarizeInfiltrationGeometry,
} from "../infiltration";
import { resolveVentilationScalar, valuesClose } from "./resolveScenarioEnvelopeLeakage";

/** Типовой КПД рекуперации при механической вентиляции без данных ПВУ в модели. */
const TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT = 0.65;
/** Типовая кратность механической вентиляции (СП 50 / сценарий по умолчанию), если в модели нет расхода. */
const TYPICAL_MECHANICAL_VENTILATION_ACH = 0.18;

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
  windSpeedMps: ResolvedVentilationScalar;
  windPressureCoefficient: ResolvedVentilationScalar;
  mechanicalPressurePa: ResolvedVentilationScalar;
}

function resolveEnergyVentilation(model: BuildingModel) {
  return model.thermalProtection?.energyVentilation;
}

function readEngineeringParameterNumber(parameters: Record<string, unknown>, key: string): number | null {
  const value = parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readEngineeringAirflowM3s(parameters: Record<string, unknown>): number {
  const airflowM3H =
    readEngineeringParameterNumber(parameters, "airflowM3H") ?? readEngineeringParameterNumber(parameters, "flowRateM3H");
  return airflowM3H != null ? Math.max(0, airflowM3H) / 3600 : 0;
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

function sumMechanicalVentilationAirflowM3s(model: BuildingModel): number {
  const simpleDiffuserFlowM3s = model.equipment.reduce(
    (sum, item) => sum + (item.type === "diffuser" ? Math.max(0, item.params.designAirflow_m3_s ?? 0) : 0),
    0
  );
  const simpleAhuFlowM3s = model.equipment.reduce(
    (sum, item) => sum + (item.type === "ahu" ? Math.max(0, item.params.designAirflow_m3_s ?? 0) : 0),
    0
  );
  const simpleDuctFlowM3s = model.ducts.reduce((sum, duct) => sum + Math.max(0, duct.airflow_m3_s ?? 0), 0);
  const simpleFlowM3s = Math.max(simpleDiffuserFlowM3s, simpleAhuFlowM3s, simpleDuctFlowM3s);

  const engineeringEquipment = model.engineeringSystems?.equipment ?? [];
  const engineeringPipes = model.engineeringSystems?.pipes ?? [];
  const engineeringSupplyTerminalFlowM3s = engineeringEquipment.reduce(
    (sum, item) => sum + (item.type === "supplyDiffuser" ? readEngineeringAirflowM3s(item.parameters) : 0),
    0
  );
  const engineeringExhaustTerminalFlowM3s = engineeringEquipment.reduce(
    (sum, item) => sum + (item.type === "exhaustGrille" ? readEngineeringAirflowM3s(item.parameters) : 0),
    0
  );
  const engineeringAhuFlowM3s = engineeringEquipment.reduce(
    (sum, item) => sum + (item.type === "airHandlingUnit" ? readEngineeringAirflowM3s(item.parameters) : 0),
    0
  );
  const engineeringSupplyPipeFlowM3s = engineeringPipes.reduce(
    (sum, pipe) => sum + (pipe.medium === "airSupply" && pipe.flowRate != null ? Math.max(0, pipe.flowRate) / 3600 : 0),
    0
  );
  const engineeringExhaustPipeFlowM3s = engineeringPipes.reduce(
    (sum, pipe) => sum + (pipe.medium === "airExhaust" && pipe.flowRate != null ? Math.max(0, pipe.flowRate) / 3600 : 0),
    0
  );
  const engineeringFlowM3s = Math.max(
    engineeringSupplyTerminalFlowM3s,
    engineeringExhaustTerminalFlowM3s,
    engineeringAhuFlowM3s,
    engineeringSupplyPipeFlowM3s,
    engineeringExhaustPipeFlowM3s
  );

  return simpleFlowM3s + engineeringFlowM3s;
}

function computeVentilationACHFromBuilding(model: BuildingModel): { value: number; source: VentilationInputSource } | null {
  const energyVentilation = resolveEnergyVentilation(model);
  if (energyVentilation?.ventilationACH != null && Number.isFinite(energyVentilation.ventilationACH)) {
    return { value: Math.max(0, energyVentilation.ventilationACH), source: "model" };
  }

  const heatedVolumeM3 = estimateHeatedVolumeM3(model);
  if (
    heatedVolumeM3 > 0 &&
    energyVentilation?.ventilationFlowM3H != null &&
    Number.isFinite(energyVentilation.ventilationFlowM3H) &&
    energyVentilation.ventilationFlowM3H > 0
  ) {
    return { value: energyVentilation.ventilationFlowM3H / heatedVolumeM3, source: "model" };
  }

  const totalAirflowM3s = sumMechanicalVentilationAirflowM3s(model);
  if (heatedVolumeM3 > 0 && totalAirflowM3s > 0) {
    return { value: achFromAirflowM3s(totalAirflowM3s, heatedVolumeM3), source: "calculated" };
  }

  return null;
}

export function resolveVentilationACH(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedVentilationScalar {
  const mechanicalVentilation = resolveMechanicalVentilationEnabled(scenarioConfig, scenario, model);
  if (!mechanicalVentilation.value) {
    return resolveVentilationScalar(
      scenarioConfig?.ventilation?.ventilationACH,
      { value: 0, source: "calculated" },
      0
    );
  }

  let computed = computeVentilationACHFromBuilding(model);
  if (computed == null) {
    computed = { value: TYPICAL_MECHANICAL_VENTILATION_ACH, source: "calculated" };
  }
  const rawVentilationAch =
    scenarioConfig?.ventilation?.ventilationACH === TYPICAL_MECHANICAL_VENTILATION_ACH &&
    computed.source === "calculated" &&
    valuesClose(computed.value, TYPICAL_MECHANICAL_VENTILATION_ACH)
      ? null
      : scenarioConfig?.ventilation?.ventilationACH;
  return resolveVentilationScalar(
    rawVentilationAch,
    computed,
    scenario.ventilation.ventilationACH ?? TYPICAL_MECHANICAL_VENTILATION_ACH
  );
}

function clampHeatRecoveryFactor(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function computeHeatRecoveryFromBuilding(
  model: BuildingModel,
  mechanicalVentilationEnabled: boolean,
  ventilationAch: number
): { value: number; source: VentilationInputSource } | null {
  const fromMeta = resolveEnergyVentilation(model)?.heatRecoveryFactor;
  if (fromMeta != null && Number.isFinite(fromMeta)) {
    return { value: clampHeatRecoveryFactor(fromMeta), source: "model" };
  }

  const ahuEfficiencies = model.equipment
    .filter((item) => item.type === "ahu")
    .map((item) => item.params.efficiency)
    .filter((efficiency): efficiency is number => efficiency != null && Number.isFinite(efficiency) && efficiency > 0 && efficiency <= 1);
  const engineeringAhuEfficiencies = (model.engineeringSystems?.equipment ?? [])
    .filter((item) => item.type === "airHandlingUnit")
    .map(
      (item) =>
        readEngineeringParameterNumber(item.parameters, "heatRecoveryEfficiency") ??
        readEngineeringParameterNumber(item.parameters, "efficiency")
    )
    .filter((efficiency): efficiency is number => efficiency != null && Number.isFinite(efficiency) && efficiency > 0 && efficiency <= 1);
  const allEfficiencies = [...ahuEfficiencies, ...engineeringAhuEfficiencies];
  if (allEfficiencies.length) {
    const average = allEfficiencies.reduce((sum, efficiency) => sum + efficiency, 0) / allEfficiencies.length;
    return { value: clampHeatRecoveryFactor(average), source: "calculated" };
  }

  if (!mechanicalVentilationEnabled || ventilationAch <= 0) {
    return { value: 0, source: "calculated" };
  }

  return { value: TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT, source: "calculated" };
}

export function resolveHeatRecoveryFactor(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedVentilationScalar {
  const mechanicalVentilation = resolveMechanicalVentilationEnabled(scenarioConfig, scenario, model);
  const ventilationAch = resolveVentilationACH(scenarioConfig, scenario, model).value;
  if (!mechanicalVentilation.value || ventilationAch <= 0) {
    return resolveVentilationScalar(
      scenarioConfig?.ventilation?.heatRecoveryFactor,
      { value: 0, source: "calculated" },
      0
    );
  }

  const computed = computeHeatRecoveryFromBuilding(model, true, ventilationAch);
  const fallback = computed?.value ?? TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT;
  let rawHeatRecovery = scenarioConfig?.ventilation?.heatRecoveryFactor;
  if (rawHeatRecovery === 0 && computed != null && computed.value > 0) {
    rawHeatRecovery = null;
  }
  if (
    rawHeatRecovery != null &&
    computed != null &&
    computed.source === "calculated" &&
    valuesClose(rawHeatRecovery, TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT) &&
    valuesClose(computed.value, TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT)
  ) {
    rawHeatRecovery = null;
  }
  return resolveVentilationScalar(rawHeatRecovery, computed, fallback);
}

function computeMechanicalVentilationEnabledFromBuilding(model: BuildingModel): { value: boolean; source: VentilationInputSource } {
  const computedAch = computeVentilationACHFromBuilding(model);
  if (computedAch != null && computedAch.value > 0) {
    return { value: true, source: computedAch.source };
  }
  if (sumMechanicalVentilationAirflowM3s(model) > 0) {
    return { value: true, source: "calculated" };
  }
  return { value: false, source: "calculated" };
}

export function resolveMechanicalVentilationEnabled(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedVentilationFlag {
  const raw = scenarioConfig?.ventilation?.mechanicalVentilationEnabled;
  const computed = computeMechanicalVentilationEnabledFromBuilding(model);
  const fallback = scenario.ventilation.mechanicalVentilationEnabled;

  if (typeof raw === "boolean") {
    if (raw !== computed.value && raw !== fallback) {
      return { value: raw, source: "user", explicit: true };
    }
    if (computed.value) {
      return { value: true, source: computed.source, explicit: false };
    }
    return { value: fallback, source: "fallback", explicit: false };
  }

  if (computed.value) {
    return { value: true, source: computed.source, explicit: false };
  }
  return { value: fallback, source: "fallback", explicit: false };
}

const LEGACY_STACK_HEIGHT_M = 6;

function clearLegacyDefault(raw: number | null | undefined, legacyDefault: number): number | null | undefined {
  if (raw != null && Number.isFinite(raw) && valuesClose(raw, legacyDefault)) {
    return null;
  }
  return raw;
}

export function resolveStackHeightM(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): ResolvedVentilationScalar {
  const raw = clearLegacyDefault(scenarioConfig?.ventilation?.pressureBased?.stackHeightM, LEGACY_STACK_HEIGHT_M);
  const fromGeometry = summarizeInfiltrationGeometry(model).stackHeightM;
  const computed =
    fromGeometry > 0 && Number.isFinite(fromGeometry)
      ? { value: fromGeometry, source: "model" as VentilationInputSource }
      : null;
  const fallback = scenario.ventilation.pressureBased?.stackHeightM ?? LEGACY_STACK_HEIGHT_M;
  return resolveVentilationScalar(raw, computed, fallback);
}

export function resolveWindPressureCoefficient(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig
): ResolvedVentilationScalar {
  const raw = clearLegacyDefault(
    scenarioConfig?.ventilation?.pressureBased?.windPressureCoefficient,
    DEFAULT_WIND_PRESSURE_COEFFICIENT
  );
  const computed = { value: DEFAULT_WIND_PRESSURE_COEFFICIENT, source: "model" as VentilationInputSource };
  const fallback = scenario.ventilation.pressureBased?.windPressureCoefficient ?? DEFAULT_WIND_PRESSURE_COEFFICIENT;
  return resolveVentilationScalar(raw, computed, fallback);
}

export function resolveMechanicalPressurePa(
  scenarioConfig: ScenarioConfig | null | undefined
): ResolvedVentilationScalar {
  const raw = scenarioConfig?.ventilation?.pressureBased?.mechanicalPressurePa;
  if (raw != null && Number.isFinite(raw) && raw > 0) {
    return { value: raw, source: "user", explicit: true };
  }
  return { value: 0, source: "calculated", explicit: false };
}

function resolveClimateWindSpeeds(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null | undefined
): { winterWindSpeedM_s: number | null; summerWindSpeedM_s: number | null } {
  const cityId = resolvePreferredClimateCityId(model, scenarioConfig);
  const city = getSp131CityClimate(cityId);
  const climate = model.thermalProtection?.climate;
  return {
    winterWindSpeedM_s: climate?.winterWindSpeedM_s ?? city?.winterWindSpeedM_s ?? null,
    summerWindSpeedM_s: climate?.summerWindSpeedM_s ?? city?.summerWindSpeedM_s ?? null,
  };
}

export function resolveWindSpeedMps(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel,
  dayOfYear?: number | null
): ResolvedVentilationScalar {
  const raw = scenarioConfig?.ventilation?.pressureBased?.windSpeedMps;
  if (raw != null && Number.isFinite(raw)) {
    return { value: Math.max(0, raw), source: "user", explicit: true };
  }

  const { winterWindSpeedM_s, summerWindSpeedM_s } = resolveClimateWindSpeeds(model, scenarioConfig);
  const interpolated = interpolateSeasonalWindSpeedMps(
    winterWindSpeedM_s,
    summerWindSpeedM_s,
    clampDayOfYear(dayOfYear)
  );
  if (interpolated != null) {
    return { value: interpolated, source: "calculated", explicit: false };
  }

  const fallback = scenario.ventilation.pressureBased?.windSpeedMps ?? DEFAULT_WIND_SPEED_M_S;
  return { value: fallback, source: "fallback", explicit: false };
}

export function buildResolvedPressureBasedConfig(resolved: ResolvedVentilationInputs): ScenarioPressureBasedInfiltrationConfig {
  return {
    windSpeedMps: resolved.windSpeedMps.value,
    windPressureCoefficient: resolved.windPressureCoefficient.value,
    stackHeightM: resolved.stackHeightM.value,
    mechanicalPressurePa: resolved.mechanicalPressurePa.value,
  };
}

export function resolveScenarioVentilationInputs(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel,
  options?: { dayOfYear?: number | null }
): ResolvedVentilationInputs {
  return {
    infiltrationACH: resolveInfiltrationACH(scenarioConfig, scenario, model),
    ventilationACH: resolveVentilationACH(scenarioConfig, scenario, model),
    heatRecoveryFactor: resolveHeatRecoveryFactor(scenarioConfig, scenario, model),
    mechanicalVentilationEnabled: resolveMechanicalVentilationEnabled(scenarioConfig, scenario, model),
    stackHeightM: resolveStackHeightM(scenarioConfig, scenario, model),
    windSpeedMps: resolveWindSpeedMps(scenarioConfig, scenario, model, options?.dayOfYear),
    windPressureCoefficient: resolveWindPressureCoefficient(scenarioConfig, scenario),
    mechanicalPressurePa: resolveMechanicalPressurePa(scenarioConfig),
  };
}
