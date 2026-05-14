export interface ZoneInstant {
  zoneId: string;
  temperatureC: number;
  setpointC: number;
  heatingPowerW: number;
}

export interface FrameInstant {
  timeSeconds: number;
  outdoorTemperatureC: number;
  timestepSeconds: number;
  zones: ZoneInstant[];
}

export interface ZoneSummaryMetrics {
  zoneId: string;
  energyJ: number;
  discomfortSeconds: number;
  /** Максимум мощности отопления этой зоны по шагам симуляции, Вт. */
  peakHeatingW: number;
}

export interface SimulationSummaryMetrics {
  /**
   * Максимум по времени **суммы** мощностей отопления по всем зонам в одном шаге, Вт
   * (одновременная нагрузка на систему отопления).
   */
  peakHeatingW: number;
  totalEnergyJ: number;
  /**
   * Сумма по зонам секунд, в которые температура зоны ниже уставки более чем на 0,05 °C
   * (не «часы здания», а интеграл по зонам; при N зонах одновременного дискомфорта вклад до N×Δt).
   */
  discomfortSeconds: number;
  zones: Record<string, ZoneSummaryMetrics>;
}

export function computeSimulationMetrics(frames: FrameInstant[]): SimulationSummaryMetrics {
  const zones = new Map<string, ZoneSummaryMetrics>();
  let globalPeak = 0;
  let totalEnergy = 0;
  let discomfort = 0;

  frames.forEach((frame) => {
    const timestepSeconds = frame.timestepSeconds;
    let frameHeating = 0;
    frame.zones.forEach((zone) => {
      const entry = getOrCreateZoneSummary(zones, zone.zoneId);
      entry.energyJ += zone.heatingPowerW * timestepSeconds;
      totalEnergy += zone.heatingPowerW * timestepSeconds;
      frameHeating += zone.heatingPowerW;
      if (zone.heatingPowerW > entry.peakHeatingW) {
        entry.peakHeatingW = zone.heatingPowerW;
      }
      if (zone.temperatureC + 0.05 < zone.setpointC) {
        entry.discomfortSeconds += timestepSeconds;
        discomfort += timestepSeconds;
      }
    });
    if (frameHeating > globalPeak) {
      globalPeak = frameHeating;
    }
  });

  return {
    peakHeatingW: globalPeak,
    totalEnergyJ: totalEnergy,
    discomfortSeconds: discomfort,
    zones: Object.fromEntries(Array.from(zones.entries())),
  };
}

function getOrCreateZoneSummary(
  container: Map<string, ZoneSummaryMetrics>,
  zoneId: string
): ZoneSummaryMetrics {
  const existing = container.get(zoneId);
  if (existing) {
    return existing;
  }
  const created: ZoneSummaryMetrics = {
    zoneId,
    energyJ: 0,
    discomfortSeconds: 0,
    peakHeatingW: 0,
  };
  container.set(zoneId, created);
  return created;
}
