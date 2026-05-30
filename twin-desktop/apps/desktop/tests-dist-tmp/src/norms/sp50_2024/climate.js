export function calculateGsop(input) {
    return (input.indoorTemperatureC - input.outdoorHeatingPeriodAverageC) * input.heatingPeriodDurationDays;
}
export function calculateNt(input) {
    const adjustedIndoor = input.adjustedIndoorTemperatureC ?? input.indoorTemperatureC;
    const adjustedOutdoor = input.adjustedOutdoorTemperatureC ?? input.outdoorHeatingPeriodAverageC;
    const denominator = input.indoorTemperatureC - input.outdoorHeatingPeriodAverageC;
    if (Math.abs(denominator) < 1e-9) {
        return 1;
    }
    return (adjustedIndoor - adjustedOutdoor) / denominator;
}
