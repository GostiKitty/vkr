export function evaluateSetpoint(schedule, timeSeconds) {
    const hour = secondsToHour(timeSeconds);
    return isDay(hour, schedule.dayStartHour, schedule.nightStartHour) ? schedule.dayC : schedule.nightC;
}
export function evaluateInternalGains(gainSchedule, occupancySchedule, timeSeconds, area_m2) {
    const hour = secondsToHour(timeSeconds);
    const gainDayStart = gainSchedule.dayStartHour ?? 8;
    const gainNightStart = gainSchedule.nightStartHour ?? 20;
    const occupancyDayStart = occupancySchedule?.dayStartHour ?? gainDayStart;
    const occupancyNightStart = occupancySchedule?.nightStartHour ?? gainNightStart;
    const isDaytime = isDay(hour, gainDayStart, gainNightStart);
    const gainDensity = isDaytime ? gainSchedule.dayGain_W_m2 : gainSchedule.nightGain_W_m2;
    const baseGain = gainDensity * area_m2;
    const occupied = isDay(hour, occupancyDayStart, occupancyNightStart)
        ? occupancySchedule?.dayFraction ?? 1
        : occupancySchedule?.nightFraction ?? 0.2;
    return {
        gainW: baseGain * occupied,
        occupancy: occupied,
    };
}
function secondsToHour(seconds) {
    if (!Number.isFinite(seconds)) {
        return 0;
    }
    const hours = seconds / 3600;
    const wrapped = hours % 24;
    return wrapped < 0 ? wrapped + 24 : wrapped;
}
function isDay(hour, dayStart, nightStart) {
    if (dayStart === nightStart) {
        return true;
    }
    if (dayStart < nightStart) {
        return hour >= dayStart && hour < nightStart;
    }
    return hour >= dayStart || hour < nightStart;
}
