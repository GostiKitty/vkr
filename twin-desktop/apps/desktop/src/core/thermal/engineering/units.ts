import { AIR_DENSITY_KG_M3, AIR_HEAT_CAPACITY_J_KG_K } from "./constants";

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function roundNumber(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function airflowFromAch(volumeM3: number, ach: number): number {
  return Math.max(0, ach) * Math.max(0, volumeM3) / 3600;
}

export function ventilationHeatLossW(volumeM3: number, ach: number, deltaTC: number): number {
  const airflowM3s = airflowFromAch(volumeM3, ach);
  return AIR_DENSITY_KG_M3 * AIR_HEAT_CAPACITY_J_KG_K * airflowM3s * Math.max(0, deltaTC);
}

export function effectiveAirCapacitance(volumeM3: number, factor: number): number {
  return AIR_DENSITY_KG_M3 * AIR_HEAT_CAPACITY_J_KG_K * Math.max(0, volumeM3) * Math.max(1, factor);
}

export function weightedAverage(values: Array<{ value: number; weight: number }>, fallback = 0): number {
  let numerator = 0;
  let denominator = 0;
  values.forEach(({ value, weight }) => {
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) {
      return;
    }
    numerator += value * weight;
    denominator += weight;
  });
  return denominator > 0 ? numerator / denominator : fallback;
}

export function standardDeviation(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function formatFormulaSubstitution(
  uValue: number,
  areaM2: number,
  deltaTC: number,
  resultW: number
): string {
  return `Q = ${roundNumber(uValue, 3)} · ${roundNumber(areaM2, 2)} · ${roundNumber(deltaTC, 2)} = ${roundNumber(resultW, 2)}`;
}
