export interface SetpointSchedule {
  dayC: number;
  nightC: number;
  dayStartHour: number;
  nightStartHour: number;
  /**
   * Продолжительность линейного разгона уставки при переходе ночь→день и день→ночь, мин.
   * 0 = ступенчатый переход (по умолчанию, идеальный режим).
   * 60 = плавный разгон за 1 ч — устраняет пик мощности при утреннем прогреве.
   */
  rampMinutes?: number;
}

export interface GainSchedule {
  dayGain_W_m2: number;
  nightGain_W_m2: number;
  dayStartHour?: number;
  nightStartHour?: number;
}

export interface OccupancySchedule {
  dayFraction: number;
  nightFraction: number;
  dayStartHour?: number;
  nightStartHour?: number;
}

export function evaluateSetpoint(schedule: SetpointSchedule, timeSeconds: number): number {
  const hour = secondsToHour(timeSeconds);
  const rampH = (schedule.rampMinutes ?? 0) / 60;

  if (rampH > 0) {
    // Morning ramp: dayStartHour … dayStartHour + rampH  (nightC → dayC)
    const morningFrac = rampFraction(hour, schedule.dayStartHour, rampH);
    if (morningFrac !== null) {
      return schedule.nightC + morningFrac * (schedule.dayC - schedule.nightC);
    }
    // Evening ramp: nightStartHour … nightStartHour + rampH  (dayC → nightC)
    const eveningFrac = rampFraction(hour, schedule.nightStartHour, rampH);
    if (eveningFrac !== null) {
      return schedule.dayC + eveningFrac * (schedule.nightC - schedule.dayC);
    }
  }

  return isDay(hour, schedule.dayStartHour + rampH, schedule.nightStartHour + rampH) ? schedule.dayC : schedule.nightC;
}

/**
 * Returns a 0–1 linear fraction if `hour` falls inside the ramp window
 * [rampStart, rampStart + rampH) with 24-hour wrap-around.
 * Returns null when `hour` is outside that window.
 */
function rampFraction(hour: number, rampStart: number, rampH: number): number | null {
  let rel = hour - rampStart;
  if (rel < 0) rel += 24;
  if (rel >= 24) rel -= 24;
  if (rel < 0 || rel >= rampH) return null;
  return rel / rampH;
}

export function evaluateInternalGains(
  gainSchedule: GainSchedule,
  occupancySchedule: OccupancySchedule | undefined,
  timeSeconds: number,
  area_m2: number
): { gainW: number; occupancy: number } {
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

function secondsToHour(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return 0;
  }
  const hours = seconds / 3600;
  const wrapped = hours % 24;
  return wrapped < 0 ? wrapped + 24 : wrapped;
}

function isDay(hour: number, dayStart: number, nightStart: number): boolean {
  if (dayStart === nightStart) {
    return true;
  }
  if (dayStart < nightStart) {
    return hour >= dayStart && hour < nightStart;
  }
  return hour >= dayStart || hour < nightStart;
}
