import type { BuildingModel } from "../../entities/geometry/types";
import type { AdjacencyResult } from "../graph/adjacency";
import { buildThermalModel, type ThermalModel, type ThermalZone, type ThermalLink } from "./model";
import type { EngineeringOptions } from "./engineering/types";
import { createSinusoidalWeatherProfile, type WeatherProfile, type SinusoidalWeatherParams } from "./weather";
import {
  evaluateInternalGains,
  evaluateSetpoint,
  type GainSchedule,
  type OccupancySchedule,
  type SetpointSchedule,
} from "./schedules";
import { computeSimulationMetrics, type FrameInstant } from "./metrics";
import { buildThermalSimulationDiagnostics, type ThermalSimulationDiagnostics } from "./thermalDiagnostics";

const SECONDS_PER_HOUR = 3600;
const DEFAULT_TIMESTEP_SECONDS = 600;
const ABS_ZERO_OFFSET = 273.15;

export interface ThermalSimulationOptions {
  duration: "24h" | "7d";
  timestepMinutes?: number;
  outdoor: SinusoidalWeatherParams;
  setpoints: {
    day: number;
    night: number;
    dayStartHour: number;
    nightStartHour: number;
  };
  internalGains: {
    dayGain_W_m2: number;
    nightGain_W_m2: number;
    dayStartHour?: number;
    nightStartHour?: number;
  };
  occupancy?: OccupancySchedule;
  infiltrationACH?: number;
  initialTemperatureC?: number;
  engineering?: EngineeringOptions;
}

export interface ThermalTimelinePoint {
  timeHours: number;
  outdoorTemperatureC: number;
  rooms: Record<
    string,
    {
      temperatureC: number;
      heatingPowerW: number;
      setpointC: number;
    }
  >;
}

export interface RoomThermalResult {
  roomId: string;
  timeline: Array<{ timeHours: number; temperatureC: number; heatingPowerW: number }>;
  /**
   * Тепловая энергия отопления за весь смоделированный период (24 ч или 7 суток), кВт·ч.
   * Не «суточная» в календарном смысле при длине сценария 7 d — это интеграл мощности за весь период.
   */
  dailyEnergyKWh: number;
  discomfortHours: number;
}

export interface ThermalSimulationResult {
  timeline: ThermalTimelinePoint[];
  rooms: Record<string, RoomThermalResult>;
  summary: {
    /** Максимум по времени суммы мощностей отопления по зонам, кВт. */
    peakLoadKW: number;
    /** Интеграл суммарной мощности отопления за период сценария, кВт·ч. */
    totalEnergyKWh: number;
    /** Сумма по зонам часов с температурой ниже уставки (>0,05 °C); может превышать длительность периода. */
    discomfortHours: number;
  };
  /** Предупреждения тепловой модели здания (геометрия, запасные допущения). */
  modelWarnings?: string[];
  /** Разрез потерь, удельные показатели и проверка согласованности среза с дискретным балансом RC (не СП 50). */
  diagnostics?: ThermalSimulationDiagnostics;
}

export interface SimulationScenario {
  durationHours: number;
  timestepSeconds: number;
  weather: WeatherProfile;
  setpoints: SetpointSchedule;
  gains: GainSchedule;
  occupancy?: OccupancySchedule;
  initialTemperatureC: number;
}

export interface SimulationRunPayload {
  frames: ThermalTimelinePoint[];
  roomHistories: Map<string, RoomThermalResult>;
  metricFrames: FrameInstant[];
}

export function runThermalSimulation(
  building: BuildingModel,
  options: ThermalSimulationOptions,
  adjacency?: AdjacencyResult
): ThermalSimulationResult {
  const durationHours = options.duration === "7d" ? 24 * 7 : 24;
  const timestepSeconds = Math.max(60, Math.round((options.timestepMinutes ?? 10) * 60));
  const { model: thermalModel, warnings: thermalModelWarnings } = buildThermalModel(building, {
    adjacency,
    infiltrationACH: options.infiltrationACH,
    effectiveMassFactor: options.engineering?.effectiveMassFactor ?? 1,
  });
  const scenario: SimulationScenario = {
    durationHours,
    timestepSeconds,
    weather: createSinusoidalWeatherProfile(options.outdoor),
    setpoints: {
      dayC: options.setpoints.day,
      nightC: options.setpoints.night,
      dayStartHour: options.setpoints.dayStartHour,
      nightStartHour: options.setpoints.nightStartHour,
    },
    gains: {
      dayGain_W_m2: options.internalGains.dayGain_W_m2,
      nightGain_W_m2: options.internalGains.nightGain_W_m2,
      dayStartHour: options.internalGains.dayStartHour ?? options.setpoints.dayStartHour,
      nightStartHour: options.internalGains.nightStartHour ?? options.setpoints.nightStartHour,
    },
    occupancy:
      options.occupancy ?? {
        dayFraction: 1,
        nightFraction: 0.2,
        dayStartHour: options.setpoints.dayStartHour,
        nightStartHour: options.setpoints.nightStartHour,
      },
    initialTemperatureC: options.initialTemperatureC ?? options.setpoints.night,
  };

  const run = simulateThermalNetwork(thermalModel, scenario);
  const metrics = computeSimulationMetrics(run.metricFrames);
  const diagnostics = buildThermalSimulationDiagnostics({
    building,
    model: thermalModel,
    frames: run.frames,
    metricFrames: run.metricFrames,
    setpoints: scenario.setpoints,
    gains: scenario.gains,
    occupancy: scenario.occupancy,
    timestepSeconds: scenario.timestepSeconds,
    zoneSummary: metrics.zones,
    totalEnergyKWh: metrics.totalEnergyJ / 3_600_000,
    peakLoadKW: metrics.peakHeatingW / 1000,
  });

  const rooms: Record<string, RoomThermalResult> = {};
  run.roomHistories.forEach((history, roomId) => {
    const zoneMetrics = metrics.zones[roomId];
    rooms[roomId] = {
      roomId,
      timeline: history.timeline,
      dailyEnergyKWh: zoneMetrics ? zoneMetrics.energyJ / 3_600_000 : 0,
      discomfortHours: zoneMetrics ? zoneMetrics.discomfortSeconds / 3600 : 0,
    };
  });

  return {
    timeline: run.frames,
    rooms,
    summary: {
      peakLoadKW: metrics.peakHeatingW / 1000,
      totalEnergyKWh: metrics.totalEnergyJ / 3_600_000,
      discomfortHours: metrics.discomfortSeconds / 3600,
    },
    modelWarnings: thermalModelWarnings.length ? thermalModelWarnings : undefined,
    diagnostics,
  };
}

/**
 * Явная зональная RC-схема (одна температура воздуха на зону), дискретизация по времени:
 * C_i (T_i^{n+1}−T_i^n)/Δt = Σ_j G_ij(T_j^n−T_i^n) + G_inf,i(T_n−T_i^n) + Σ_k G_k,ext(T_n−T_i^n) + Q̇_int + Q̇_ot .
 * Температуры в К в потоках; Q̇_ot ≥ 0 поднимает T до уставки (см. тело цикла). Норматив СП 50 здесь не вычисляется.
 */
export function simulateThermalNetwork(model: ThermalModel, scenario: SimulationScenario): SimulationRunPayload {
  if (!model.zones.length) {
    throw new Error("Модель не содержит зон для расчёта.");
  }
  if (scenario.durationHours <= 0) {
    throw new Error("durationHours должен быть больше нуля.");
  }
  const timestepSeconds = scenario.timestepSeconds || DEFAULT_TIMESTEP_SECONDS;
  if (timestepSeconds <= 0) {
    throw new Error("timestepSeconds должен быть положительным.");
  }
  const totalSteps = Math.round((scenario.durationHours * SECONDS_PER_HOUR) / timestepSeconds);

  const adjacency = buildZoneAdjacency(model);
  const zoneState = initializeZoneState(model.zones, scenario.initialTemperatureC);
  const roomHistories = new Map<string, RoomThermalResult>(
    model.zones.map((zone) => [
      zone.id,
      {
        roomId: zone.id,
        timeline: [],
        dailyEnergyKWh: 0,
        discomfortHours: 0,
      },
    ])
  );

  const frames: ThermalTimelinePoint[] = [];
  const metricFrames: FrameInstant[] = [];

  for (let step = 0; step <= totalSteps; step++) {
    const timeSeconds = step * timestepSeconds;
    const timeHours = timeSeconds / SECONDS_PER_HOUR;
    const outdoorC = scenario.weather.temperatureC(timeSeconds);
    const outdoorK = outdoorC + ABS_ZERO_OFFSET;

    const frame: ThermalTimelinePoint = {
      timeHours,
      outdoorTemperatureC: outdoorC,
      rooms: {},
    };
    const metricFrame: FrameInstant = {
      timeSeconds,
      outdoorTemperatureC: outdoorC,
      timestepSeconds,
      zones: [],
    };

    const updates: Array<{ zoneId: string; nextTempK: number }> = [];

    model.zones.forEach((zone) => {
      const currentTempK = zoneState.get(zone.id) ?? (scenario.initialTemperatureC + ABS_ZERO_OFFSET);
      const currentTempC = currentTempK - ABS_ZERO_OFFSET;
      const setpointC = evaluateSetpoint(scenario.setpoints, timeSeconds);
      const setpointK = setpointC + ABS_ZERO_OFFSET;

      const connections = adjacency.get(zone.id);
      let netPowerW = 0;

      connections?.internal.forEach((link) => {
        const neighborId = link.fromZoneId === zone.id ? link.toZoneId : link.fromZoneId;
        const neighborTempK = zoneState.get(neighborId);
        if (neighborTempK !== undefined) {
          netPowerW += link.conductance_W_K * (neighborTempK - currentTempK);
        }
      });

      connections?.external.forEach((link) => {
        netPowerW += link.conductance_W_K * (outdoorK - currentTempK);
      });

      netPowerW += zone.infiltrationConductance_W_K * (outdoorK - currentTempK);

      const { gainW } = evaluateInternalGains(scenario.gains, scenario.occupancy, timeSeconds, zone.area_m2);
      netPowerW += gainW;

      const predictedK = currentTempK + (netPowerW / zone.capacitance_J_K) * timestepSeconds;
      let heatingPowerW = 0;
      let nextTempK = predictedK;
      if (predictedK < setpointK) {
        const deltaK = setpointK - predictedK;
        heatingPowerW = (deltaK * zone.capacitance_J_K) / timestepSeconds;
        nextTempK = setpointK;
      }
      if (!Number.isFinite(heatingPowerW) || heatingPowerW < 0) {
        heatingPowerW = 0;
      }
      if (!Number.isFinite(nextTempK)) {
        nextTempK = currentTempK;
      }

      frame.rooms[zone.id] = {
        temperatureC: currentTempC,
        heatingPowerW,
        setpointC,
      };
      metricFrame.zones.push({
        zoneId: zone.id,
        temperatureC: currentTempC,
        setpointC,
        heatingPowerW,
      });

      const history = roomHistories.get(zone.id);
      if (history) {
        history.timeline.push({
          timeHours,
          temperatureC: currentTempC,
          heatingPowerW,
        });
      }

      updates.push({ zoneId: zone.id, nextTempK });
    });

    frames.push(frame);
    // Интеграл мощности: один интервал на шаг; последняя итерация (t = T) — только снимок состояния, без лишнего Δt.
    if (step < totalSteps) {
      metricFrames.push(metricFrame);
    }
    updates.forEach(({ zoneId, nextTempK }) => zoneState.set(zoneId, nextTempK));
  }

  return {
    frames,
    roomHistories,
    metricFrames,
  };
}

function buildZoneAdjacency(
  model: ThermalModel
): Map<
  string,
  {
    internal: ThermalLink[];
    external: ThermalLink[];
  }
> {
  const adjacency = new Map<
    string,
    {
      internal: ThermalLink[];
      external: ThermalLink[];
    }
  >();

  model.zones.forEach((zone) => {
    adjacency.set(zone.id, { internal: [], external: [] });
  });

  model.internalLinks.forEach((link) => {
    const from = adjacency.get(link.fromZoneId);
    const to = adjacency.get(link.toZoneId);
    if (from) {
      from.internal.push(link);
    }
    if (to) {
      to.internal.push(link);
    }
  });

  model.outdoorLinks.forEach((link) => {
    const entry = adjacency.get(link.fromZoneId);
    if (entry) {
      entry.external.push(link);
    }
  });

  return adjacency;
}

function initializeZoneState(zones: ThermalZone[], initialTempC: number): Map<string, number> {
  const initialK = initialTempC + ABS_ZERO_OFFSET;
  const map = new Map<string, number>();
  zones.forEach((zone) => map.set(zone.id, initialK));
  return map;
}
