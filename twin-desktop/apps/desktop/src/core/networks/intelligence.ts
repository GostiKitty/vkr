import { pointToSegmentDistance, polygonArea, polygonCentroid, polygonContainsPoint, segmentLength } from "../../entities/geometry/geom";
import type { BuildingModel, Room, Vec2 } from "../../entities/geometry/types";
import {
  SENSOR_TYPE_LABELS,
  isHeatingPipeType,
  normalizeFlowDirection,
  resolvePipeColor,
  resolvePipeFlowRole,
  type BuildingEvent,
  type DuctNetwork,
  type Equipment,
  type EquipmentState,
  type OperationalScenario,
  type PipeNetwork,
  type SensorDevice,
} from "../../entities/networks/types";
import { canConnectEquipmentToNetwork, supportsDuctNetwork, supportsPipeNetwork } from "./compatibility";
import type { ThermalSimulationResult } from "../thermal/solver";

const ROOM_ASSIGNMENT_DISTANCE_M = 1.6;
const NETWORK_CONNECTION_DISTANCE_M = 0.75;
const SENSOR_HISTORY_LIMIT = 120;

export interface SmartRoomState {
  roomId: string;
  roomName: string;
  levelId: string;
  area_m2: number;
  volume_m3: number;
  setpointC: number;
  temperatureC: number;
  envelopeLossW: number;
  infiltrationLossW: number;
  equipmentHeatW: number;
  ventilationFlow_m3_s: number;
  netHeatFlowW: number;
  connectedEquipmentIds: string[];
}

export interface SmartEquipmentState {
  equipmentId: string;
  roomId: string | null;
  connectedNetworkIds: string[];
  effectiveState: EquipmentState;
  alerts: string[];
}

export interface SmartSensorState {
  sensorId: string;
  roomId: string | null;
  label: string;
  value: number | null;
  unit: string;
  status: SensorDevice["status"];
  history: SensorDevice["history"];
}

export interface SmartNetworkState {
  networkId: string;
  kind: "pipe" | "duct";
  levelId: string;
  flowLabel: string;
  magnitude: number;
  connectedEquipmentIds: string[];
  color: string;
  path: Vec2[];
}

export interface SmartModelEvent {
  id: string;
  type: BuildingEvent["type"];
  severity: BuildingEvent["severity"];
  title: string;
  message: string;
  timestamp: number;
  relatedId?: string;
  relatedKind?: BuildingEvent["relatedKind"];
  levelId?: string | null;
}

export interface SmartModelSnapshot {
  timestamp: number;
  scenario: OperationalScenario | null;
  roomStates: SmartRoomState[];
  equipmentStates: SmartEquipmentState[];
  sensorStates: SmartSensorState[];
  networkStates: SmartNetworkState[];
  suggestedConnections: Array<{
    equipmentId: string;
    networkId: string;
    networkKind: "pipe" | "duct";
    distance_m: number;
    status: "compatible" | "rejected";
    reason?: string;
  }>;
  events: SmartModelEvent[];
}

export function buildSmartModelSnapshot(
  model: BuildingModel,
  thermalResult: ThermalSimulationResult | null,
  timestamp = Date.now()
): SmartModelSnapshot {
  const scenario = model.scenarios.find((entry) => entry.id === model.activeScenarioId) ?? null;
  const levelMap = new Map(model.levels.map((level) => [level.id, level]));
  const roomAssignments = new Map<string, string | null>();
  const equipmentStates: SmartEquipmentState[] = [];
  const suggestedConnections: SmartModelSnapshot["suggestedConnections"] = [];

  const equipmentConnections = new Map<string, string[]>();
  const pipeConnections = new Map<string, string[]>();
  const ductConnections = new Map<string, string[]>();
  const equipmentById = new Map(model.equipment.map((item) => [item.id, item]));

  model.pipes.forEach((pipe) =>
    pipeConnections.set(
      pipe.id,
      uniqueIds(
        pipe.connectedEquipmentIds.filter((equipmentId) => {
          const equipment = equipmentById.get(equipmentId);
          return equipment ? canConnectEquipmentToNetwork(equipment, pipe).compatible : false;
        })
      )
    )
  );
  model.ducts.forEach((duct) =>
    ductConnections.set(
      duct.id,
      uniqueIds(
        duct.connectedEquipmentIds.filter((equipmentId) => {
          const equipment = equipmentById.get(equipmentId);
          return equipment ? canConnectEquipmentToNetwork(equipment, duct).compatible : false;
        })
      )
    )
  );

  model.equipment.forEach((item) => {
    const roomId = resolveRoomIdForPoint(item.position, item.levelId, model.rooms);
    roomAssignments.set(item.id, roomId);
    const connectedNetworkIds = inferNetworkConnections(item, model, suggestedConnections);
    equipmentConnections.set(item.id, connectedNetworkIds);
    connectedNetworkIds.forEach((networkId) => {
      if (model.pipes.some((pipe) => pipe.id === networkId)) {
        pipeConnections.set(networkId, uniqueIds([...(pipeConnections.get(networkId) ?? []), item.id]));
      }
      if (model.ducts.some((duct) => duct.id === networkId)) {
        ductConnections.set(networkId, uniqueIds([...(ductConnections.get(networkId) ?? []), item.id]));
      }
    });

    const effectiveState = scenario?.impact.equipmentStateOverrides[item.type] ?? item.state;
    const alerts: string[] = [];
    const connectedPipes = connectedNetworkIds
      .map((id) => model.pipes.find((pipe) => pipe.id === id))
      .filter((pipe): pipe is PipeNetwork => Boolean(pipe));
    const hasHeatingSupply = connectedPipes.some((pipe) => (pipe.flowRole ?? resolvePipeFlowRole(pipe.type)) === "supply");
    const hasHeatingReturn = connectedPipes.some((pipe) => (pipe.flowRole ?? resolvePipeFlowRole(pipe.type)) === "return");
    if ((item.type === "radiator" || item.type === "pump" || item.type === "boiler") && !connectedNetworkIds.some((id) => pipeConnections.has(id))) {
      alerts.push("Нет подключения к трубопроводу.");
    }
    if ((item.type === "radiator" || item.type === "fancoil") && !hasHeatingSupply) {
      alerts.push("Нет подключения к подающей ветви.");
    }
    if ((item.type === "radiator" || item.type === "fancoil") && !hasHeatingReturn) {
      alerts.push("Нет подключения к обратной ветви.");
    }
    if ((item.type === "diffuser" || item.type === "ahu") && !connectedNetworkIds.some((id) => ductConnections.has(id))) {
      alerts.push("Нет подключения к воздуховоду.");
    }
    if (!roomId && item.type !== "pump" && item.type !== "boiler" && item.type !== "ahu") {
      alerts.push("Оборудование не привязано к помещению.");
    }
    equipmentStates.push({
      equipmentId: item.id,
      roomId,
      connectedNetworkIds,
      effectiveState,
      alerts,
    });
  });

  const roomStates = model.rooms.map((room) => {
    const area = Math.abs(polygonArea(room.polygon));
    const level = levelMap.get(room.levelId);
    const height = level?.height_m ?? 3;
    const volume = area * height;
    const roomEquipment = model.equipment.filter((item) => roomAssignments.get(item.id) === room.id);
    const ventilationFlow = roomEquipment.reduce((sum, item) => sum + (item.params.designAirflow_m3_s ?? 0), 0) * (scenario?.impact.networkFlowMultiplier ?? 1);
    const equipmentHeat = roomEquipment.reduce((sum, item) => {
      if (item.type === "radiator" || item.type === "fancoil" || item.type === "boiler") {
        return sum + (item.params.nominalPowerW ?? 0);
      }
      return sum;
    }, 0) * (scenario?.impact.heatLoadMultiplier ?? 1);
    const setpointC = 21 + (scenario?.impact.setpointOffsetC ?? 0);
    const outdoorBiasC = scenario?.kind === "winter" ? -8 : scenario?.kind === "summer" ? 6 : 0;
    const envelopeLossW = Math.max(0, area * (setpointC - (12 + outdoorBiasC)) * 1.8);
    const infiltrationLossW = Math.max(0, volume * (setpointC - (16 + outdoorBiasC)) * 0.18);
    const latestRoom = thermalResult?.timeline[thermalResult.timeline.length - 1]?.rooms[room.id];
    const temperatureC = latestRoom?.temperatureC ?? clampTemperature(setpointC + (equipmentHeat - envelopeLossW - infiltrationLossW) / Math.max(volume * 14, 500), setpointC);
    return {
      roomId: room.id,
      roomName: room.name,
      levelId: room.levelId,
      area_m2: area,
      volume_m3: volume,
      setpointC,
      temperatureC,
      envelopeLossW,
      infiltrationLossW,
      equipmentHeatW: equipmentHeat,
      ventilationFlow_m3_s: ventilationFlow,
      netHeatFlowW: equipmentHeat - envelopeLossW - infiltrationLossW,
      connectedEquipmentIds: roomEquipment.map((item) => item.id),
    };
  });

  const sensorStates = model.sensors.map((sensor) => {
    const roomId = resolveRoomIdForPoint(sensor.position, sensor.levelId, model.rooms);
    const roomState = roomId ? roomStates.find((room) => room.roomId === roomId) ?? null : null;
    const nextReading = evaluateSensor(sensor, roomState, model, timestamp);
    return {
      sensorId: sensor.id,
      roomId,
      label: SENSOR_TYPE_LABELS[sensor.type],
      value: nextReading.value,
      unit: nextReading.unit,
      status: nextReading.status,
      history: buildSensorHistory(sensor.history, nextReading.value, timestamp),
    };
  });

  const networkStates: SmartNetworkState[] = [
    ...model.pipes.map((pipe) => buildPipeState(pipe, pipeConnections.get(pipe.id) ?? [])),
    ...model.ducts.map((duct) => buildDuctState(duct, ductConnections.get(duct.id) ?? [])),
  ];

  const events = buildSmartEvents(roomStates, equipmentStates, sensorStates, networkStates, timestamp);

  return {
    timestamp,
    scenario,
    roomStates,
    equipmentStates,
    sensorStates,
    networkStates,
    suggestedConnections,
    events,
  };
}

function buildPipeState(pipe: PipeNetwork, connectedEquipmentIds: string[]): SmartNetworkState {
  const directedPath = normalizeFlowDirection(pipe.flowDirection) === "backward" ? [...pipe.path].reverse() : pipe.path;
  return {
    networkId: pipe.id,
    kind: "pipe",
    levelId: pipe.levelId,
    flowLabel: `${pipe.flowRate_kg_s.toFixed(2)} кг/с`,
    magnitude: Math.max(pipe.flowRate_kg_s, 0),
    connectedEquipmentIds,
    color: resolvePipeColor(pipe),
    path: directedPath,
  };
}

function buildDuctState(duct: DuctNetwork, connectedEquipmentIds: string[]): SmartNetworkState {
  return {
    networkId: duct.id,
    kind: "duct",
    levelId: duct.levelId,
    flowLabel: `${duct.airflow_m3_s.toFixed(2)} м³/с`,
    magnitude: Math.max(duct.airflow_m3_s, 0),
    connectedEquipmentIds,
    color: "#475569",
    path: duct.path,
  };
}

function buildSmartEvents(
  roomStates: SmartRoomState[],
  equipmentStates: SmartEquipmentState[],
  sensorStates: SmartSensorState[],
  networkStates: SmartNetworkState[],
  timestamp: number
): SmartModelEvent[] {
  const events: SmartModelEvent[] = [];

  roomStates.forEach((room) => {
    if (room.temperatureC > room.setpointC + 1.5) {
      events.push({
        id: `smart:overheat:${room.roomId}`,
        type: "overheat",
        severity: "warning",
        title: `Перегрев: ${room.roomName}`,
        message: `Температура ${room.temperatureC.toFixed(1)} °C выше уставки ${room.setpointC.toFixed(1)} °C.`,
        timestamp,
        relatedId: room.roomId,
        relatedKind: "room",
        levelId: room.levelId,
      });
    }
  });

  equipmentStates.forEach((item) => {
    if (item.effectiveState === "alarm" || item.alerts.length > 0) {
      events.push({
        id: `smart:equipment:${item.equipmentId}`,
        type: "equipment_fault",
        severity: item.effectiveState === "alarm" ? "critical" : "warning",
        title: "Проблема оборудования",
        message: item.alerts[0] ?? "Оборудование находится в аварийном состоянии.",
        timestamp,
        relatedId: item.equipmentId,
        relatedKind: "equipment",
      });
    }
  });

  sensorStates.forEach((sensor) => {
    if (sensor.status === "alarm" && sensor.value !== null) {
      events.push({
        id: `smart:sensor:${sensor.sensorId}`,
        type: sensor.label === "CO2" ? "co2_high" : sensor.label === "Протечка" ? "leak" : "equipment_fault",
        severity: "critical",
        title: `Авария датчика: ${sensor.label}`,
        message: `Показание ${sensor.value.toFixed(1)} ${sensor.unit}.`,
        timestamp,
        relatedId: sensor.sensorId,
        relatedKind: "sensor",
      });
    }
  });

  networkStates.forEach((network) => {
    if (!network.connectedEquipmentIds.length) {
      events.push({
        id: `smart:network:${network.networkId}`,
        type: "network_break",
        severity: "warning",
        title: network.kind === "pipe" ? "Трубопровод без оборудования" : "Воздуховод без оборудования",
        message: "Сеть построена, но не связана с оборудованием.",
        timestamp,
        relatedId: network.networkId,
        relatedKind: network.kind,
        levelId: network.levelId,
      });
    }
  });

  return events;
}

function evaluateSensor(
  sensor: SensorDevice,
  roomState: SmartRoomState | null,
  model: BuildingModel,
  timestamp: number
): Pick<SmartSensorState, "value" | "unit" | "status"> {
  const minuteFactor = ((timestamp / 1000 / 60) % 60) / 60;
  switch (sensor.type) {
    case "temperature": {
      const value = roomState ? roomState.temperatureC : 20 + Math.sin(minuteFactor * Math.PI * 2) * 0.5;
      return { value, unit: "°C", status: value > 28 || value < 16 ? "warning" : "normal" };
    }
    case "humidity": {
      const value = roomState ? clamp(44 - roomState.ventilationFlow_m3_s * 4 + Math.sin(minuteFactor * Math.PI * 2) * 3, 25, 70) : 45;
      return { value, unit: "%", status: value > 65 ? "warning" : "normal" };
    }
    case "co2": {
      const value = roomState ? clamp(520 + roomState.area_m2 * 6 - roomState.ventilationFlow_m3_s * 900, 420, 1800) : 520;
      return { value, unit: "ppm", status: value > 1100 ? "alarm" : value > 850 ? "warning" : "normal" };
    }
    case "pressure": {
      const nearestPipe = findNearestPipePressure(sensor.position, sensor.levelId, model.pipes);
      const nearestDuct = findNearestDuctPressure(sensor.position, sensor.levelId, model.ducts);
      const value = nearestPipe ?? nearestDuct ?? 40;
      return { value, unit: "Па", status: value < 10 ? "warning" : "normal" };
    }
    case "flow": {
      const value = findNearestFlow(sensor.position, sensor.levelId, model);
      return { value, unit: "л/с", status: value <= 0 ? "warning" : "normal" };
    }
    case "leak": {
      const leakNearPipe = model.pipes.some((pipe) => pipe.levelId === sensor.levelId && distanceToPolyline(sensor.position, pipe.path) < 0.5 && pipe.flowRate_kg_s > 0.12);
      const value = leakNearPipe ? 1 : 0;
      return { value, unit: "сигнал", status: value > 0 ? "alarm" : "normal" };
    }
    default:
      return { value: null, unit: sensor.unit, status: sensor.status };
  }
}

function findNearestPipePressure(position: Vec2, levelId: string, pipes: PipeNetwork[]): number | null {
  let nearest: { distance: number; pressure: number } | null = null;
  for (const pipe of pipes) {
    if (pipe.levelId !== levelId) {
      continue;
    }
    const distance = distanceToPolyline(position, pipe.path);
    if (!nearest || distance < nearest.distance) {
      nearest = { distance, pressure: pipe.pressurePa };
    }
  }
  if (!nearest || nearest.distance > NETWORK_CONNECTION_DISTANCE_M) {
    return null;
  }
  return nearest.pressure;
}

function findNearestDuctPressure(position: Vec2, levelId: string, ducts: DuctNetwork[]): number | null {
  let nearest: { distance: number; pressure: number } | null = null;
  for (const duct of ducts) {
    if (duct.levelId !== levelId) {
      continue;
    }
    const distance = distanceToPolyline(position, duct.path);
    const pressure = duct.airVelocity_m_s * 9;
    if (!nearest || distance < nearest.distance) {
      nearest = { distance, pressure };
    }
  }
  if (!nearest || nearest.distance > NETWORK_CONNECTION_DISTANCE_M) {
    return null;
  }
  return nearest.pressure;
}

function findNearestFlow(
  position: Vec2,
  levelId: string,
  model: BuildingModel
): number {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let flow = 0;
  model.pipes.forEach((pipe) => {
    if (pipe.levelId !== levelId) {
      return;
    }
    const distance = distanceToPolyline(position, pipe.path);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      flow = pipe.flowRate_kg_s * 1000;
    }
  });
  model.ducts.forEach((duct) => {
    if (duct.levelId !== levelId) {
      return;
    }
    const distance = distanceToPolyline(position, duct.path);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      flow = duct.airflow_m3_s * 1000;
    }
  });
  if (nearestDistance > NETWORK_CONNECTION_DISTANCE_M) {
    return 0;
  }
  return flow;
}

function buildSensorHistory(history: SensorDevice["history"], value: number | null, timestamp: number): SensorDevice["history"] {
  if (value === null) {
    return history;
  }
  const next = [...history];
  const last = next[next.length - 1];
  if (!last || Math.abs(last.value - value) > 0.05 || timestamp - last.timestamp >= 3500) {
    next.push({ timestamp, value });
  }
  return next.slice(-SENSOR_HISTORY_LIMIT);
}

function inferNetworkConnections(
  equipment: Equipment,
  model: BuildingModel,
  suggestions: SmartModelSnapshot["suggestedConnections"]
): string[] {
  const acceptedByKind: Partial<Record<"pipe" | "duct", Array<{ id: string; distance_m: number }>>> = {};
  const rejectedByKind: Partial<Record<"pipe" | "duct", Array<{ id: string; distance_m: number; reason?: string }>>> = {};
  const pipeCandidates: Array<{ id: string; distance_m: number; pipe: PipeNetwork }> = [];
  if (supportsPipeNetwork(equipment.type)) {
    model.pipes.forEach((pipe) => {
      if (pipe.levelId !== equipment.levelId) {
        return;
      }
      const distance = distanceToPolyline(equipment.position, pipe.path);
      if (distance <= NETWORK_CONNECTION_DISTANCE_M) {
        const compatibility = canConnectEquipmentToNetwork(equipment, pipe);
        if (compatibility.compatible) {
          pipeCandidates.push({ id: pipe.id, distance_m: distance, pipe });
        } else {
          rejectedByKind.pipe = [
            ...(rejectedByKind.pipe ?? []),
            { id: pipe.id, distance_m: distance, reason: compatibility.reason ?? undefined },
          ];
        }
      }
    });
  }

  const acceptedPipeIds = selectPipeConnections(equipment, pipeCandidates);
  acceptedByKind.pipe = acceptedPipeIds
    .map((pipeId) => {
      const candidate = pipeCandidates.find((entry) => entry.id === pipeId);
      return candidate ? { id: candidate.id, distance_m: candidate.distance_m } : null;
    })
    .filter((entry): entry is { id: string; distance_m: number } => Boolean(entry));

  if (supportsDuctNetwork(equipment.type)) {
    model.ducts.forEach((duct) => {
      if (duct.levelId !== equipment.levelId) {
        return;
      }
      const distance = distanceToPolyline(equipment.position, duct.path);
      if (distance <= NETWORK_CONNECTION_DISTANCE_M) {
        const compatibility = canConnectEquipmentToNetwork(equipment, duct);
        if (compatibility.compatible) {
          acceptedByKind.duct = [...(acceptedByKind.duct ?? []), { id: duct.id, distance_m: distance }];
        } else {
          rejectedByKind.duct = [
            ...(rejectedByKind.duct ?? []),
            { id: duct.id, distance_m: distance, reason: compatibility.reason ?? undefined },
          ];
        }
      }
    });
  }

  const accepted = [
    ...((acceptedByKind.pipe ?? []).sort((left, right) => left.distance_m - right.distance_m).slice(0, 1).map((entry) => ({
      ...entry,
      kind: "pipe" as const,
    }))),
    ...((acceptedByKind.duct ?? []).sort((left, right) => left.distance_m - right.distance_m).slice(0, 1).map((entry) => ({
      ...entry,
      kind: "duct" as const,
    }))),
  ];
  accepted.forEach((entry) => {
    suggestions.push({
      equipmentId: equipment.id,
      networkId: entry.id,
      networkKind: entry.kind,
      distance_m: entry.distance_m,
      status: "compatible",
    });
  });
  (["pipe", "duct"] as const).forEach((kind) => {
    const nearestRejected = (rejectedByKind[kind] ?? []).sort((left, right) => left.distance_m - right.distance_m)[0];
    if (!nearestRejected) {
      return;
    }
    suggestions.push({
      equipmentId: equipment.id,
      networkId: nearestRejected.id,
      networkKind: kind,
      distance_m: nearestRejected.distance_m,
      status: "rejected",
      reason: nearestRejected.reason,
    });
  });

  const preservedCompatible = equipment.connectedNetworkIds.filter((networkId) => {
    const pipe = model.pipes.find((entry) => entry.id === networkId);
    if (pipe) {
      return pipe.levelId === equipment.levelId && canConnectEquipmentToNetwork(equipment, pipe).compatible;
    }
    const duct = model.ducts.find((entry) => entry.id === networkId);
    if (duct) {
      return duct.levelId === equipment.levelId && canConnectEquipmentToNetwork(equipment, duct).compatible;
    }
    return false;
  });

  return uniqueIds([...preservedCompatible, ...accepted.map((entry) => entry.id)]);
}

function selectPipeConnections(
  equipment: Equipment,
  candidates: Array<{ id: string; distance_m: number; pipe: PipeNetwork }>
): string[] {
  if (!candidates.length) {
    return [];
  }

  const sorted = [...candidates].sort((left, right) => left.distance_m - right.distance_m);
  const roleGroups = {
    supply: sorted.filter((entry) => (entry.pipe.flowRole ?? resolvePipeFlowRole(entry.pipe.type)) === "supply"),
    return: sorted.filter((entry) => (entry.pipe.flowRole ?? resolvePipeFlowRole(entry.pipe.type)) === "return"),
    distribution: sorted.filter((entry) => !isHeatingPipeType(entry.pipe.type)),
  };

  switch (equipment.type) {
    case "radiator":
    case "fancoil":
      return uniqueIds([
        roleGroups.supply[0]?.id ?? "",
        roleGroups.return[0]?.id ?? "",
      ]);
    case "boiler":
    case "pump":
      return uniqueIds([
        roleGroups.supply[0]?.id ?? "",
        roleGroups.return[0]?.id ?? "",
      ]);
    default:
      return [sorted[0]?.id].filter((value): value is string => Boolean(value));
  }
}

function resolveRoomIdForPoint(point: Vec2, levelId: string, rooms: Room[]): string | null {
  const sameLevelRooms = rooms.filter((room) => room.levelId === levelId);
  const containingRoom = sameLevelRooms.find((room) => polygonContainsPoint(point, room.polygon));
  if (containingRoom) {
    return containingRoom.id;
  }
  let nearestRoom: { id: string; distance: number } | null = null;
  for (const room of sameLevelRooms) {
    const centroid = polygonCentroid(room.polygon);
    const distance = segmentLength(point, centroid);
    if (!nearestRoom || distance < nearestRoom.distance) {
      nearestRoom = { id: room.id, distance };
    }
  }
  if (!nearestRoom || nearestRoom.distance > ROOM_ASSIGNMENT_DISTANCE_M) {
    return null;
  }
  return nearestRoom.id;
}

function distanceToPolyline(point: Vec2, path: Vec2[]): number {
  if (path.length < 2) {
    return Number.POSITIVE_INFINITY;
  }
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    best = Math.min(best, pointToSegmentDistance(point, path[index - 1], path[index]));
  }
  return best;
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampTemperature(value: number, setpointC: number): number {
  return clamp(value, setpointC - 6, setpointC + 6);
}
