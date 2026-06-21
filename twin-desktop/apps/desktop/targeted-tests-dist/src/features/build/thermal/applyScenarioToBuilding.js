import { getSp131CityClimate } from "../../../norms/sp131_2025/climate";
import { setModelOpticalFactors } from "../../../shared/utils/openingThermalData";
/** Пробрасывает сценарий в thermalProtection для СП 50 и RC. */
export function applyScenarioToBuilding(model, scenario) {
    if (!scenario) {
        return model;
    }
    const sp131 = scenario.climateCityId ? getSp131CityClimate(scenario.climateCityId) : null;
    const existing = model.thermalProtection ?? {};
    const climate = {
        ...(existing.climate ?? {}),
        city: sp131?.label ?? existing.climate?.city,
        outdoorHeatingPeriodAverageC: sp131?.outdoorHeatingPeriodAverageC ?? existing.climate?.outdoorHeatingPeriodAverageC,
        heatingPeriodDurationDays: sp131?.heatingPeriodDurationDays ?? existing.climate?.heatingPeriodDurationDays,
        outdoorDesignTemperatureC: sp131?.outdoorDesignTemperatureC ?? existing.climate?.outdoorDesignTemperatureC,
    };
    const withOptical = scenario.materials?.windowGValue != null || scenario.materials?.shadingFactor != null
        ? setModelOpticalFactors(model, {
            windowGValue: scenario.materials?.windowGValue ?? null,
            shadingFactor: scenario.materials?.shadingFactor ?? null,
        })
        : model;
    return {
        ...withOptical,
        thermalProtection: {
            ...(withOptical.thermalProtection ?? existing),
            climate,
            energyVentilation: {
                ...(existing.energyVentilation ?? {}),
                infiltrationACH: scenario.ventilation.infiltrationACH,
                ventilationACH: scenario.ventilation.mechanicalVentilationEnabled
                    ? scenario.ventilation.ventilationACH
                    : 0,
                heatRecoveryFactor: scenario.ventilation.heatRecoveryFactor ?? undefined,
            },
        },
    };
}
