export interface GsopInput {
  indoorTemperatureC: number;
  outdoorHeatingPeriodAverageC: number;
  heatingPeriodDurationDays: number;
}

export interface NtInput {
  indoorTemperatureC: number;
  outdoorHeatingPeriodAverageC: number;
  adjustedIndoorTemperatureC?: number;
  adjustedOutdoorTemperatureC?: number;
}

export function calculateGsop(input: GsopInput): number {
  return (input.indoorTemperatureC - input.outdoorHeatingPeriodAverageC) * input.heatingPeriodDurationDays;
}

export function calculateNt(input: NtInput): number {
  const adjustedIndoor = input.adjustedIndoorTemperatureC ?? input.indoorTemperatureC;
  const adjustedOutdoor = input.adjustedOutdoorTemperatureC ?? input.outdoorHeatingPeriodAverageC;
  const denominator = input.indoorTemperatureC - input.outdoorHeatingPeriodAverageC;
  if (Math.abs(denominator) < 1e-9) {
    return 1;
  }
  return (adjustedIndoor - adjustedOutdoor) / denominator;
}
