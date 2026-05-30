export interface TemperatureLegendRange {
  min: number;
  max: number;
  synthetic: boolean;
}

export function buildTemperatureLegendRange(
  minTemperatureC: number,
  maxTemperatureC: number,
  synthetic: boolean
): TemperatureLegendRange {
  const lower = Number.isFinite(minTemperatureC) ? minTemperatureC : 0;
  const upper = Number.isFinite(maxTemperatureC) ? maxTemperatureC : lower;
  const clampedMin = Math.min(lower, upper);
  const clampedMax = Math.max(lower, upper);
  const spread = clampedMax - clampedMin;

  if (spread <= 0.25) {
    const center = (clampedMin + clampedMax) / 2;
    return {
      min: center - 0.5,
      max: center + 0.5,
      synthetic,
    };
  }

  const step = Math.max(0.5, spread / 12);
  return {
    min: Math.floor(clampedMin / step) * step,
    max: Math.ceil(clampedMax / step) * step,
    synthetic,
  };
}
