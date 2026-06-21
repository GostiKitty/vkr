import { buildPerformanceOptionsFromScenario } from "../../../core/thermal/comfort/resolveScenarioComfort";
import { buildResolvedEnvelopeLeakageConfig, resolveScenarioEnvelopeLeakageInputs, } from "../../../core/thermal/ventilation/resolveScenarioEnvelopeLeakage";
import { buildResolvedPressureBasedConfig, resolveScenarioVentilationInputs, } from "../../../core/thermal/ventilation/resolveScenarioVentilation";
import { resolveScenarioConfig } from "../../../entities/workflow/workflow.store";
import { DEFAULT_THERMAL_OPTIONS } from "./defaultThermalOptions";
export function cloneThermalOptions(options) {
    return {
        ...options,
        heatingCapacityByRoomW: options.heatingCapacityByRoomW ? { ...options.heatingCapacityByRoomW } : undefined,
        outdoor: { ...options.outdoor },
        setpoints: { ...options.setpoints },
        internalGains: { ...options.internalGains },
        infiltration: options.infiltration
            ? {
                ...options.infiltration,
                envelopeLeakage: options.infiltration.envelopeLeakage ? { ...options.infiltration.envelopeLeakage } : undefined,
                pressureBased: options.infiltration.pressureBased ? { ...options.infiltration.pressureBased } : undefined,
            }
            : undefined,
        engineering: options.engineering ? { ...options.engineering } : undefined,
        performanceOptions: options.performanceOptions ? { ...options.performanceOptions } : undefined,
    };
}
export function buildThermalOptionsFromWorkflow(scenario, base = DEFAULT_THERMAL_OPTIONS, model = null, options) {
    const next = cloneThermalOptions(base);
    if (!scenario) {
        return next;
    }
    const resolved = resolveScenarioConfig(scenario);
    const resolvedLeakage = model != null ? resolveScenarioEnvelopeLeakageInputs(scenario, resolved, model) : null;
    const resolvedVentilation = model != null ? resolveScenarioVentilationInputs(scenario, resolved, model, options) : null;
    next.outdoor = {
        ...next.outdoor,
        baseC: resolved.climate.baseC,
        amplitudeC: resolved.climate.amplitudeC,
        seasonalOffsetC: resolved.climate.seasonalOffsetC,
    };
    next.setpoints = {
        ...next.setpoints,
        day: resolved.setpoints.day,
        night: resolved.setpoints.night,
        dayStartHour: resolved.setpoints.dayStartHour,
        nightStartHour: resolved.setpoints.nightStartHour,
        setpointRampMinutes: resolved.setpoints.setpointRampMinutes ?? next.setpoints.setpointRampMinutes ?? 60,
    };
    next.internalGains = {
        ...next.internalGains,
        dayGain_W_m2: resolved.internalGains.dayGain_W_m2,
        nightGain_W_m2: resolved.internalGains.nightGain_W_m2,
    };
    next.occupancy = {
        dayFraction: resolved.occupancy.dayFraction,
        nightFraction: resolved.occupancy.nightFraction,
    };
    next.duration = resolved.operation?.duration ?? next.duration;
    next.timestepMinutes = resolved.operation?.timestepMinutes ?? next.timestepMinutes;
    next.heatingMode = resolved.engineeringSystems?.heatingMode ?? next.heatingMode;
    next.heatingCapacityW =
        resolved.engineeringSystems?.installedCapacityW ?? next.heatingCapacityW ?? null;
    next.infiltration = {
        infiltrationMode: resolved.ventilation.infiltrationMode,
        infiltrationACH: resolved.ventilation.infiltrationACH,
        envelopeLeakage: resolvedLeakage
            ? buildResolvedEnvelopeLeakageConfig(resolvedLeakage)
            : resolved.ventilation.envelopeLeakage
                ? { ...resolved.ventilation.envelopeLeakage }
                : undefined,
        pressureBased: resolvedVentilation
            ? buildResolvedPressureBasedConfig(resolvedVentilation)
            : resolved.ventilation.pressureBased
                ? { ...resolved.ventilation.pressureBased }
                : undefined,
    };
    next.infiltrationACH = resolvedVentilation?.infiltrationACH.value ?? resolved.ventilation.infiltrationACH;
    next.ventilationACH = resolvedVentilation
        ? resolvedVentilation.mechanicalVentilationEnabled.value
            ? resolvedVentilation.ventilationACH.value
            : 0
        : resolved.ventilation.mechanicalVentilationEnabled
            ? resolved.ventilation.ventilationACH
            : 0;
    next.mechanicalVentilationEnabled =
        resolvedVentilation?.mechanicalVentilationEnabled.value ?? resolved.ventilation.mechanicalVentilationEnabled;
    next.heatRecoveryFactor = resolvedVentilation?.heatRecoveryFactor.value ?? resolved.ventilation.heatRecoveryFactor;
    next.performanceOptions = buildPerformanceOptionsFromScenario(scenario, resolved);
    return next;
}
