import { buildSmartModelSnapshot, type SmartModelSnapshot } from "../networks/intelligence";
import type { DigitalTwinInput, DigitalTwinRoomState, DigitalTwinState } from "./types";

export class DigitalTwinModule {
  private readonly refreshIntervalMs: number;
  private cache: {
    model: DigitalTwinInput["model"] | null;
    result: DigitalTwinState | null;
  } = { model: null, result: null };

  constructor(refreshIntervalMs = 4000) {
    this.refreshIntervalMs = refreshIntervalMs;
  }

  getState(input: DigitalTwinInput): DigitalTwinState {
    const timestamp = input.timestamp ?? Date.now();
    const shouldReuseCache =
      !input.forceRefresh &&
      this.cache.model === input.model &&
      this.cache.result !== null &&
      timestamp - this.cache.result.timestamp < this.refreshIntervalMs;

    if (shouldReuseCache && this.cache.result) {
      return this.cache.result;
    }

    const snapshot = buildSmartModelSnapshot(input.model, input.thermalResult ?? null, timestamp);
    const result: DigitalTwinState = {
      module: "digitalTwin",
      timestamp,
      refreshIntervalMs: this.refreshIntervalMs,
      rooms: buildRoomStates(snapshot),
      sensors: snapshot.sensorStates,
      networks: snapshot.networkStates,
      events: snapshot.events,
    };

    this.cache = {
      model: input.model,
      result,
    };

    return result;
  }
}

function buildRoomStates(snapshot: SmartModelSnapshot): DigitalTwinRoomState[] {
  const pressureByRoom = new Map<string, number | null>();

  snapshot.sensorStates
    .filter((sensor) => sensor.label.toLowerCase().includes("pressure"))
    .forEach((sensor) => {
      if (sensor.roomId) {
        pressureByRoom.set(sensor.roomId, sensor.value);
      }
    });

  return snapshot.roomStates.map((room) => ({
    roomId: room.roomId,
    roomName: room.roomName,
    temperature_C: roundValue(room.temperatureC),
    airflow_m3_s: roundValue(room.ventilationFlow_m3_s),
    pressure_Pa: pressureByRoom.get(room.roomId) ?? null,
  }));
}

function roundValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}
