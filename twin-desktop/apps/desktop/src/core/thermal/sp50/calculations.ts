import { assemblyResistance, layerResistance, uValue } from "../formulas";

export function calculateLayerResistance(thicknessM: number, conductivity_W_mK: number): number {
  return layerResistance(thicknessM, conductivity_W_mK);
}

export function calculateConstructionResistance(input: {
  internalHeatTransferCoefficient: number;
  externalHeatTransferCoefficient: number;
  layerResistances: number[];
}): number {
  return assemblyResistance(
    input.layerResistances.map((resistance) => ({
      thicknessM: resistance,
      lambdaWmK: 1,
    })),
    1 / input.internalHeatTransferCoefficient,
    1 / input.externalHeatTransferCoefficient
  );
}

export function calculateHeatTransferCoefficient(resistance_m2K_W: number): number {
  return uValue(resistance_m2K_W);
}

export function calculateSectionTemperature(input: {
  indoorTemperatureC: number;
  outdoorTemperatureC: number;
  resistanceToSection_m2K_W: number;
  totalResistance_m2K_W: number;
}): number {
  return (
    input.indoorTemperatureC -
    ((input.indoorTemperatureC - input.outdoorTemperatureC) * input.resistanceToSection_m2K_W) / input.totalResistance_m2K_W
  );
}

export function checkResistanceCompliance(actualResistance_m2K_W: number, normalizedResistance_m2K_W: number) {
  const margin = actualResistance_m2K_W - normalizedResistance_m2K_W;
  return {
    actualResistance_m2K_W,
    normalizedResistance_m2K_W,
    margin_m2K_W: margin,
    complies: margin >= 0,
  };
}

export function calculateReducedResistance(input: {
  areaFractions: number[];
  planarResistances_m2K_W: number[];
  linear?: Array<{ lengthM: number; psi_W_mK: number }>;
  point?: Array<{ count: number; chi_W_K: number }>;
}): number {
  const planarPart = input.areaFractions.reduce((sum, fraction, index) => sum + fraction * (1 / input.planarResistances_m2K_W[index]), 0);
  const linearPart = (input.linear ?? []).reduce((sum, entry) => sum + entry.lengthM * entry.psi_W_mK, 0);
  const pointPart = (input.point ?? []).reduce((sum, entry) => sum + entry.count * entry.chi_W_K, 0);
  return 1 / (planarPart + linearPart + pointPart);
}

export function calculateKob(input: {
  fragments: Array<{ nt: number; areaM2: number; reducedResistance_m2K_W: number }>;
  heatedVolumeM3: number;
}): number {
  return (
    input.fragments.reduce((sum, fragment) => sum + (fragment.nt * fragment.areaM2) / fragment.reducedResistance_m2K_W, 0) /
    input.heatedVolumeM3
  );
}

export function checkKobCompliance(kob_W_m3K: number, kobNorm_W_m3K: number) {
  return {
    kob_W_m3K,
    kobNorm_W_m3K,
    margin_W_m3K: kobNorm_W_m3K - kob_W_m3K,
    complies: kob_W_m3K <= kobNorm_W_m3K,
  };
}

export function calculateThermalInertia(layerValues: Array<{ resistance_m2K_W: number; heatAbsorption_W_m2K: number }>) {
  const values = layerValues.map((layer) => layer.resistance_m2K_W * layer.heatAbsorption_W_m2K);
  return {
    byLayer: values,
    total: values.reduce((sum, value) => sum + value, 0),
  };
}

export function calculateHeatingEnergyCharacteristic(input: {
  kob_W_m3K: number;
  ventilationCharacteristic_W_m3K: number;
  betaGainUseFactor: number;
  internalGainCharacteristic_W_m3K: number;
  solarGainCharacteristic_W_m3K: number;
}): number {
  return (
    input.kob_W_m3K +
    input.ventilationCharacteristic_W_m3K -
    input.betaGainUseFactor * (input.internalGainCharacteristic_W_m3K + input.solarGainCharacteristic_W_m3K)
  );
}

export function calculateAnnualHeatingEnergy(gsop: number, heatedVolumeM3: number, qHeatingCharacteristic_W_m3K: number): number {
  return 0.024 * gsop * heatedVolumeM3 * qHeatingCharacteristic_W_m3K;
}

export function calculateAirSpecificWeight(temperatureC: number): number {
  return 3463 / (273 + temperatureC);
}

export function calculatePressureDifference(input: {
  heightM: number;
  indoorTemperatureC: number;
  outdoorTemperatureC: number;
  windSpeedM_s: number;
}): number {
  const indoor = calculateAirSpecificWeight(input.indoorTemperatureC);
  const outdoor = calculateAirSpecificWeight(input.outdoorTemperatureC);
  return 0.55 * input.heightM * (outdoor - indoor) + 0.03 * outdoor * input.windSpeedM_s ** 2;
}

export function calculateRequiredAirPermeabilityResistance(pressureDifferencePa: number, normalizedAirPermeability: number): number {
  return pressureDifferencePa / normalizedAirPermeability;
}

export function calculateVaporResistance(layers: Array<{ thicknessM: number; vaporPermeability_mg_mhPa: number }>): number {
  return layers.reduce((sum, layer) => sum + layer.thicknessM / layer.vaporPermeability_mg_mhPa, 0);
}

export function calculateFloorHeatAbsorption(layers: Array<{ resistance_m2K_W: number; heatAbsorption_W_m2K: number }>): number {
  let inertia = 0;
  for (const layer of layers) {
    inertia += layer.resistance_m2K_W * layer.heatAbsorption_W_m2K;
    if (inertia >= 0.5) {
      return 2 * layer.heatAbsorption_W_m2K;
    }
  }
  return 2 * (layers[layers.length - 1]?.heatAbsorption_W_m2K ?? 0);
}
