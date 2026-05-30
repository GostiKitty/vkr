import { useEffect, useMemo, useState } from "react";
import type { BuildingModel } from "../../../entities/geometry/types";
import type { BuildingEvent, SensorDevice } from "../../../entities/networks/types";
import { buildSmartModelSnapshot, type SmartModelSnapshot } from "../../../core/networks/index";
import type { ThermalSimulationResult } from "../../../core/thermal/solver";
import type { BuildMutationOptions } from "../build.store";

const LIVE_SYNC_OPTIONS: BuildMutationOptions = {
  trackHistory: false,
  persist: false,
};

interface UseSmartBuildingParams {
  model: BuildingModel;
  thermalResult: ThermalSimulationResult | null;
  updateEquipment: (equipmentId: string, patch: { roomId?: string | null; connectedNetworkIds?: string[] }, options?: BuildMutationOptions) => void;
  updatePipe: (pipeId: string, patch: { connectedEquipmentIds?: string[] }, options?: BuildMutationOptions) => void;
  updateDuct: (ductId: string, patch: { connectedEquipmentIds?: string[] }, options?: BuildMutationOptions) => void;
  updateSensor: (sensorId: string, patch: Partial<SensorDevice>, options?: BuildMutationOptions) => void;
  addEvent: (event: BuildingEvent, options?: BuildMutationOptions) => void;
  updateEvent: (eventId: string, patch: Partial<BuildingEvent>, options?: BuildMutationOptions) => void;
  removeEvent: (eventId: string, options?: BuildMutationOptions) => void;
}

export function useSmartBuilding({
  model,
  thermalResult,
  updateEquipment,
  updatePipe,
  updateDuct,
  updateSensor,
  addEvent,
  updateEvent,
  removeEvent,
}: UseSmartBuildingParams): SmartModelSnapshot {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 4000);
    return () => window.clearInterval(id);
  }, []);

  const snapshot = useMemo(() => buildSmartModelSnapshot(model, thermalResult, tick), [model, thermalResult, tick]);

  useEffect(() => {
    snapshot.equipmentStates.forEach((state) => {
      const current = model.equipment.find((item) => item.id === state.equipmentId);
      if (!current) {
        return;
      }
      const shouldUpdateRoom = current.roomId !== state.roomId;
      const currentNetworks = normalizeIds(current.connectedNetworkIds);
      const nextNetworks = normalizeIds(state.connectedNetworkIds);
      const shouldUpdateNetworks = currentNetworks !== nextNetworks;
      if (shouldUpdateRoom || shouldUpdateNetworks) {
        updateEquipment(state.equipmentId, {
          roomId: state.roomId,
          connectedNetworkIds: state.connectedNetworkIds,
        }, LIVE_SYNC_OPTIONS);
      }
    });

    snapshot.networkStates.forEach((network) => {
      if (network.kind === "pipe") {
        const current = model.pipes.find((item) => item.id === network.networkId);
        const next = normalizeIds(network.connectedEquipmentIds);
        if (current && normalizeIds(current.connectedEquipmentIds) !== next) {
          updatePipe(network.networkId, { connectedEquipmentIds: network.connectedEquipmentIds }, LIVE_SYNC_OPTIONS);
        }
        return;
      }
      const current = model.ducts.find((item) => item.id === network.networkId);
      const next = normalizeIds(network.connectedEquipmentIds);
      if (current && normalizeIds(current.connectedEquipmentIds) !== next) {
        updateDuct(network.networkId, { connectedEquipmentIds: network.connectedEquipmentIds }, LIVE_SYNC_OPTIONS);
      }
    });
  }, [model.ducts, model.equipment, model.pipes, snapshot.equipmentStates, snapshot.networkStates, updateDuct, updateEquipment, updatePipe]);

  useEffect(() => {
    const currentEventIds = new Set(model.events.filter((event) => event.id.startsWith("smart:")).map((event) => event.id));
    const nextEventIds = new Set(snapshot.events.map((event) => event.id));

    snapshot.events.forEach((event) => {
      const existing = model.events.find((item) => item.id === event.id);
      if (!existing) {
        addEvent({
          ...event,
          acknowledged: false,
        }, LIVE_SYNC_OPTIONS);
        return;
      }
      if (
        existing.message !== event.message ||
        existing.severity !== event.severity ||
        existing.timestamp !== event.timestamp ||
        existing.title !== event.title
      ) {
        updateEvent(event.id, {
          severity: event.severity,
          title: event.title,
          message: event.message,
          timestamp: event.timestamp,
          relatedId: event.relatedId,
          relatedKind: event.relatedKind,
          levelId: event.levelId,
        }, LIVE_SYNC_OPTIONS);
      }
    });

    currentEventIds.forEach((eventId) => {
      if (!nextEventIds.has(eventId)) {
        removeEvent(eventId, LIVE_SYNC_OPTIONS);
      }
    });
  }, [addEvent, model.events, removeEvent, snapshot.events, updateEvent]);

  useEffect(() => {
    snapshot.sensorStates.forEach((state) => {
      const current = model.sensors.find((item) => item.id === state.sensorId);
      if (!current) {
        return;
      }
      const currentHistory = current.history[current.history.length - 1];
      const nextHistory = state.history[state.history.length - 1];
      const sameValue = current.value === state.value && current.status === state.status && current.unit === state.unit && current.roomId === state.roomId;
      const sameHistory =
        (!currentHistory && !nextHistory) ||
        (currentHistory && nextHistory && currentHistory.timestamp === nextHistory.timestamp && currentHistory.value === nextHistory.value);
      if (!sameValue || !sameHistory) {
        updateSensor(state.sensorId, {
          roomId: state.roomId,
          value: state.value,
          unit: state.unit,
          status: state.status,
          history: state.history,
        }, LIVE_SYNC_OPTIONS);
      }
    });
  }, [model.sensors, snapshot.sensorStates, updateSensor]);

  return snapshot;
}

function normalizeIds(values: string[]): string {
  return [...values].sort().join("|");
}
