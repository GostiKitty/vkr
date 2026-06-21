import { CO2_EMISSION_FACTOR_NORM_NOTES, defaultCo2EmissionFactorFromEcologyEnergySource, defaultCo2EmissionFactorKgPerKWh, ecologyEnergySourceToHeatingSource, } from "./defaultCo2EmissionFactors";
export function ecologyEmissionFactorIsExplicit(ecology) {
    const value = ecology?.emissionFactorKgPerKWh;
    return value != null && Number.isFinite(value);
}
export function resolveScenarioEcologyEmissionFactor(scenarioConfig) {
    const ecology = scenarioConfig?.ecology;
    if (ecologyEmissionFactorIsExplicit(ecology)) {
        return {
            value: ecology.emissionFactorKgPerKWh,
            source: "user",
            explicit: true,
            heatingSource: ecologyEnergySourceToHeatingSource(ecology?.energySource),
            normNote: null,
        };
    }
    const heatingSource = ecologyEnergySourceToHeatingSource(ecology?.energySource);
    if (!heatingSource) {
        return {
            value: null,
            source: "missing",
            explicit: false,
            heatingSource: null,
            normNote: null,
        };
    }
    return {
        value: defaultCo2EmissionFactorKgPerKWh(heatingSource),
        source: "norm",
        explicit: false,
        heatingSource,
        normNote: CO2_EMISSION_FACTOR_NORM_NOTES[heatingSource],
    };
}
export function syncEcologyEmissionFactorOnEnergySourceChange(ecology, previousEnergySource, nextEnergySource) {
    const current = ecology.emissionFactorKgPerKWh ?? null;
    const isExplicit = ecologyEmissionFactorIsExplicit(ecology);
    const previousNorm = defaultCo2EmissionFactorFromEcologyEnergySource(previousEnergySource);
    const keepUserOverride = isExplicit && (previousNorm == null || current == null || current !== previousNorm);
    if (keepUserOverride) {
        return;
    }
    ecology.emissionFactorKgPerKWh = defaultCo2EmissionFactorFromEcologyEnergySource(nextEnergySource);
}
