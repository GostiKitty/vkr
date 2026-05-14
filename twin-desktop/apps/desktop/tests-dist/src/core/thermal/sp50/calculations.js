export function calculateLayerResistance(thicknessM, conductivity_W_mK) {
    return thicknessM / conductivity_W_mK;
}
export function calculateConstructionResistance(input) {
    return 1 / input.internalHeatTransferCoefficient + input.layerResistances.reduce((sum, value) => sum + value, 0) + 1 / input.externalHeatTransferCoefficient;
}
export function calculateHeatTransferCoefficient(resistance_m2K_W) {
    return 1 / resistance_m2K_W;
}
export function calculateSectionTemperature(input) {
    return (input.indoorTemperatureC -
        ((input.indoorTemperatureC - input.outdoorTemperatureC) * input.resistanceToSection_m2K_W) / input.totalResistance_m2K_W);
}
export function checkResistanceCompliance(actualResistance_m2K_W, normalizedResistance_m2K_W) {
    const margin = actualResistance_m2K_W - normalizedResistance_m2K_W;
    return {
        actualResistance_m2K_W,
        normalizedResistance_m2K_W,
        margin_m2K_W: margin,
        complies: margin >= 0,
    };
}
export function calculateReducedResistance(input) {
    const planarPart = input.areaFractions.reduce((sum, fraction, index) => sum + fraction * (1 / input.planarResistances_m2K_W[index]), 0);
    const linearPart = (input.linear ?? []).reduce((sum, entry) => sum + entry.lengthM * entry.psi_W_mK, 0);
    const pointPart = (input.point ?? []).reduce((sum, entry) => sum + entry.count * entry.chi_W_K, 0);
    return 1 / (planarPart + linearPart + pointPart);
}
export function calculateKob(input) {
    return (input.fragments.reduce((sum, fragment) => sum + (fragment.nt * fragment.areaM2) / fragment.reducedResistance_m2K_W, 0) /
        input.heatedVolumeM3);
}
export function checkKobCompliance(kob_W_m3K, kobNorm_W_m3K) {
    return {
        kob_W_m3K,
        kobNorm_W_m3K,
        margin_W_m3K: kobNorm_W_m3K - kob_W_m3K,
        complies: kob_W_m3K <= kobNorm_W_m3K,
    };
}
export function calculateThermalInertia(layerValues) {
    const values = layerValues.map((layer) => layer.resistance_m2K_W * layer.heatAbsorption_W_m2K);
    return {
        byLayer: values,
        total: values.reduce((sum, value) => sum + value, 0),
    };
}
export function calculateHeatingEnergyCharacteristic(input) {
    return (input.kob_W_m3K +
        input.ventilationCharacteristic_W_m3K -
        input.betaGainUseFactor * (input.internalGainCharacteristic_W_m3K + input.solarGainCharacteristic_W_m3K));
}
export function calculateAnnualHeatingEnergy(gsop, heatedVolumeM3, qHeatingCharacteristic_W_m3K) {
    return 0.024 * gsop * heatedVolumeM3 * qHeatingCharacteristic_W_m3K;
}
export function calculateAirSpecificWeight(temperatureC) {
    return 3463 / (273 + temperatureC);
}
export function calculatePressureDifference(input) {
    const indoor = calculateAirSpecificWeight(input.indoorTemperatureC);
    const outdoor = calculateAirSpecificWeight(input.outdoorTemperatureC);
    return 0.55 * input.heightM * (outdoor - indoor) + 0.03 * outdoor * input.windSpeedM_s ** 2;
}
export function calculateRequiredAirPermeabilityResistance(pressureDifferencePa, normalizedAirPermeability) {
    return pressureDifferencePa / normalizedAirPermeability;
}
export function calculateVaporResistance(layers) {
    return layers.reduce((sum, layer) => sum + layer.thicknessM / layer.vaporPermeability_mg_mhPa, 0);
}
export function calculateFloorHeatAbsorption(layers) {
    let inertia = 0;
    for (const layer of layers) {
        inertia += layer.resistance_m2K_W * layer.heatAbsorption_W_m2K;
        if (inertia >= 0.5) {
            return 2 * layer.heatAbsorption_W_m2K;
        }
    }
    return 2 * (layers[layers.length - 1]?.heatAbsorption_W_m2K ?? 0);
}
