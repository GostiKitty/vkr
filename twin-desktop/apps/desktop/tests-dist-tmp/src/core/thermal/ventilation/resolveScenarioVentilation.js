import { getSp131CityClimate } from "../../../norms/sp131_2025/climate";
import { resolvePreferredClimateCityId } from "../climate/ensureModelClimate";
import { clampDayOfYear, interpolateSeasonalWindSpeedMps } from "../climate/resolveSeasonalWindSpeed";
import { achFromAirflowM3s } from "../formulas";
import { DEFAULT_WIND_PRESSURE_COEFFICIENT, DEFAULT_WIND_SPEED_M_S, estimateHeatedVolumeM3, summarizeInfiltrationGeometry, } from "../infiltration";
import { resolveVentilationScalar, valuesClose } from "./resolveScenarioEnvelopeLeakage";
/** Типовой КПД рекуперации при механической вентиляции без данных ПВУ в модели. */
const TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT = 0.65;
/** Типовая кратность механической вентиляции (СП 50 / сценарий по умолчанию), если в модели нет расхода. */
const TYPICAL_MECHANICAL_VENTILATION_ACH = 0.18;
function resolveEnergyVentilation(model) {
    return model.thermalProtection?.energyVentilation;
}
export function resolveInfiltrationACH(scenarioConfig, scenario, model) {
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
function sumMechanicalVentilationAirflowM3s(model) {
    let totalM3s = 0;
    model.equipment.forEach((item) => {
        if (item.type === "ahu" || item.type === "diffuser") {
            totalM3s += Math.max(0, item.params.designAirflow_m3_s ?? 0);
        }
    });
    if (totalM3s > 0) {
        return totalM3s;
    }
    return model.ducts.reduce((sum, duct) => sum + Math.max(0, duct.airflow_m3_s ?? 0), 0);
}
function computeVentilationACHFromBuilding(model) {
    const energyVentilation = resolveEnergyVentilation(model);
    if (energyVentilation?.ventilationACH != null && Number.isFinite(energyVentilation.ventilationACH)) {
        return { value: Math.max(0, energyVentilation.ventilationACH), source: "model" };
    }
    const heatedVolumeM3 = estimateHeatedVolumeM3(model);
    if (heatedVolumeM3 > 0 &&
        energyVentilation?.ventilationFlowM3H != null &&
        Number.isFinite(energyVentilation.ventilationFlowM3H) &&
        energyVentilation.ventilationFlowM3H > 0) {
        return { value: energyVentilation.ventilationFlowM3H / heatedVolumeM3, source: "model" };
    }
    const totalAirflowM3s = sumMechanicalVentilationAirflowM3s(model);
    if (heatedVolumeM3 > 0 && totalAirflowM3s > 0) {
        return { value: achFromAirflowM3s(totalAirflowM3s, heatedVolumeM3), source: "calculated" };
    }
    return null;
}
export function resolveVentilationACH(scenarioConfig, scenario, model) {
    const mechanicalVentilation = resolveMechanicalVentilationEnabled(scenarioConfig, scenario, model);
    if (!mechanicalVentilation.value) {
        return resolveVentilationScalar(scenarioConfig?.ventilation?.ventilationACH, { value: 0, source: "calculated" }, 0);
    }
    let computed = computeVentilationACHFromBuilding(model);
    if (computed == null) {
        computed = { value: TYPICAL_MECHANICAL_VENTILATION_ACH, source: "calculated" };
    }
    const rawVentilationAch = scenarioConfig?.ventilation?.ventilationACH === TYPICAL_MECHANICAL_VENTILATION_ACH &&
        computed.source === "calculated" &&
        valuesClose(computed.value, TYPICAL_MECHANICAL_VENTILATION_ACH)
        ? null
        : scenarioConfig?.ventilation?.ventilationACH;
    return resolveVentilationScalar(rawVentilationAch, computed, scenario.ventilation.ventilationACH ?? TYPICAL_MECHANICAL_VENTILATION_ACH);
}
function clampHeatRecoveryFactor(value) {
    return Math.max(0, Math.min(1, value));
}
function computeHeatRecoveryFromBuilding(model, mechanicalVentilationEnabled, ventilationAch) {
    const fromMeta = resolveEnergyVentilation(model)?.heatRecoveryFactor;
    if (fromMeta != null && Number.isFinite(fromMeta)) {
        return { value: clampHeatRecoveryFactor(fromMeta), source: "model" };
    }
    const ahuEfficiencies = model.equipment
        .filter((item) => item.type === "ahu")
        .map((item) => item.params.efficiency)
        .filter((efficiency) => efficiency != null && Number.isFinite(efficiency) && efficiency > 0 && efficiency <= 1);
    if (ahuEfficiencies.length) {
        const average = ahuEfficiencies.reduce((sum, efficiency) => sum + efficiency, 0) / ahuEfficiencies.length;
        return { value: clampHeatRecoveryFactor(average), source: "calculated" };
    }
    if (!mechanicalVentilationEnabled || ventilationAch <= 0) {
        return { value: 0, source: "calculated" };
    }
    return { value: TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT, source: "calculated" };
}
export function resolveHeatRecoveryFactor(scenarioConfig, scenario, model) {
    const mechanicalVentilation = resolveMechanicalVentilationEnabled(scenarioConfig, scenario, model);
    const ventilationAch = resolveVentilationACH(scenarioConfig, scenario, model).value;
    if (!mechanicalVentilation.value || ventilationAch <= 0) {
        return resolveVentilationScalar(scenarioConfig?.ventilation?.heatRecoveryFactor, { value: 0, source: "calculated" }, 0);
    }
    const computed = computeHeatRecoveryFromBuilding(model, true, ventilationAch);
    const fallback = computed?.value ?? TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT;
    let rawHeatRecovery = scenarioConfig?.ventilation?.heatRecoveryFactor;
    if (rawHeatRecovery === 0 && computed != null && computed.value > 0) {
        rawHeatRecovery = null;
    }
    if (rawHeatRecovery != null &&
        computed != null &&
        computed.source === "calculated" &&
        valuesClose(rawHeatRecovery, TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT) &&
        valuesClose(computed.value, TYPICAL_HEAT_RECOVERY_WITH_MECH_VENT)) {
        rawHeatRecovery = null;
    }
    return resolveVentilationScalar(rawHeatRecovery, computed, fallback);
}
function computeMechanicalVentilationEnabledFromBuilding(model) {
    const computedAch = computeVentilationACHFromBuilding(model);
    if (computedAch != null && computedAch.value > 0) {
        return { value: true, source: computedAch.source };
    }
    if (sumMechanicalVentilationAirflowM3s(model) > 0) {
        return { value: true, source: "calculated" };
    }
    return { value: false, source: "calculated" };
}
export function resolveMechanicalVentilationEnabled(scenarioConfig, scenario, model) {
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
    return { value: computed.value, source: computed.source, explicit: false };
}
const LEGACY_STACK_HEIGHT_M = 6;
function clearLegacyDefault(raw, legacyDefault) {
    if (raw != null && Number.isFinite(raw) && valuesClose(raw, legacyDefault)) {
        return null;
    }
    return raw;
}
export function resolveStackHeightM(scenarioConfig, scenario, model) {
    const raw = clearLegacyDefault(scenarioConfig?.ventilation?.pressureBased?.stackHeightM, LEGACY_STACK_HEIGHT_M);
    const fromGeometry = summarizeInfiltrationGeometry(model).stackHeightM;
    const computed = fromGeometry > 0 && Number.isFinite(fromGeometry)
        ? { value: fromGeometry, source: "model" }
        : null;
    const fallback = scenario.ventilation.pressureBased?.stackHeightM ?? LEGACY_STACK_HEIGHT_M;
    return resolveVentilationScalar(raw, computed, fallback);
}
export function resolveWindPressureCoefficient(scenarioConfig, scenario) {
    const raw = clearLegacyDefault(scenarioConfig?.ventilation?.pressureBased?.windPressureCoefficient, DEFAULT_WIND_PRESSURE_COEFFICIENT);
    const computed = { value: DEFAULT_WIND_PRESSURE_COEFFICIENT, source: "model" };
    const fallback = scenario.ventilation.pressureBased?.windPressureCoefficient ?? DEFAULT_WIND_PRESSURE_COEFFICIENT;
    return resolveVentilationScalar(raw, computed, fallback);
}
export function resolveMechanicalPressurePa(scenarioConfig) {
    const raw = scenarioConfig?.ventilation?.pressureBased?.mechanicalPressurePa;
    if (raw != null && Number.isFinite(raw) && raw > 0) {
        return { value: raw, source: "user", explicit: true };
    }
    return { value: 0, source: "calculated", explicit: false };
}
function resolveClimateWindSpeeds(model, scenarioConfig) {
    const cityId = resolvePreferredClimateCityId(model, scenarioConfig);
    const city = getSp131CityClimate(cityId);
    const climate = model.thermalProtection?.climate;
    return {
        winterWindSpeedM_s: climate?.winterWindSpeedM_s ?? city?.winterWindSpeedM_s ?? null,
        summerWindSpeedM_s: climate?.summerWindSpeedM_s ?? city?.summerWindSpeedM_s ?? null,
    };
}
export function resolveWindSpeedMps(scenarioConfig, scenario, model, dayOfYear) {
    const raw = scenarioConfig?.ventilation?.pressureBased?.windSpeedMps;
    if (raw != null && Number.isFinite(raw)) {
        return { value: Math.max(0, raw), source: "user", explicit: true };
    }
    const { winterWindSpeedM_s, summerWindSpeedM_s } = resolveClimateWindSpeeds(model, scenarioConfig);
    const interpolated = interpolateSeasonalWindSpeedMps(winterWindSpeedM_s, summerWindSpeedM_s, clampDayOfYear(dayOfYear));
    if (interpolated != null) {
        return { value: interpolated, source: "calculated", explicit: false };
    }
    const fallback = scenario.ventilation.pressureBased?.windSpeedMps ?? DEFAULT_WIND_SPEED_M_S;
    return { value: fallback, source: "fallback", explicit: false };
}
export function buildResolvedPressureBasedConfig(resolved) {
    return {
        windSpeedMps: resolved.windSpeedMps.value,
        windPressureCoefficient: resolved.windPressureCoefficient.value,
        stackHeightM: resolved.stackHeightM.value,
        mechanicalPressurePa: resolved.mechanicalPressurePa.value,
    };
}
export function resolveScenarioVentilationInputs(scenarioConfig, scenario, model, options) {
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
