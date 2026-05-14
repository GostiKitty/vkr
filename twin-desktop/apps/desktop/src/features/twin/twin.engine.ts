import type { Space } from "../../shared/api/types";
import { getSpaceDisplayName } from "../../shared/utils/roomNames";
import type {
  SimulationFrame,
  SpaceInstance,
  ThermalEdge,
  ThermalGraph,
  ThermalNode,
} from "../../entities/twin/types";

interface SimulationOptions {
  durationHours?: number;
  timestepMinutes?: number;
}

const DEFAULT_OUTDOOR_TEMPS = Array.from({ length: 24 }, (_, hour) => 5 + 10 * Math.sin((Math.PI * (hour - 6)) / 12));

export function buildSpaceInstances(spaces: Space[]): SpaceInstance[] {
  if (!spaces.length) {
    return [];
  }

  const gridSize = Math.ceil(Math.sqrt(spaces.length));
  const spacing = 4;
  const offset = (gridSize - 1) * spacing * 0.5;

  return spaces.map((space, index) => {
    const col = index % gridSize;
    const row = Math.floor(index / gridSize);
    const area = Math.max(space.area_m2 ?? 50, 20);
    const volume = Math.max(space.volume_m3 ?? area * 3, area * 2);
    const width = clamp(Math.sqrt(area) * 0.4, 1.5, 4.5);
    const depth = clamp(Math.sqrt(area) * 0.4, 1.5, 4.5);
    const height = clamp(volume / area, 2.5, 4.5);

    const x = col * spacing - offset;
    const z = row * spacing - offset;

    return {
      id: space.id,
      name: getSpaceDisplayName(space, index),
      position: [x, height / 2, z],
      size: [width, height, depth],
      area,
      volume,
    } satisfies SpaceInstance;
  });
}

export function buildThermalGraph(spaces: Space[], instances: SpaceInstance[]): ThermalGraph {
  const nodes: ThermalNode[] = spaces.map((space, idx) => {
    const instance = instances[idx];
    const area = instance?.area ?? space.area_m2 ?? 50;
    return {
      id: space.id,
      label: getSpaceDisplayName(space, idx),
      type: "space",
      capacity: 120 + area * 0.3,
      heatGain: 0.15 * area,
      initialTemp: 20 + Math.random() * 2,
    };
  });

  const outdoorNode: ThermalNode = {
    id: "outdoor",
    label: "Outdoor",
    type: "outdoor",
    capacity: Infinity,
    heatGain: 0,
    initialTemp: DEFAULT_OUTDOOR_TEMPS[0],
  };

  const edges: ThermalEdge[] = [];
  const distanceThreshold = 5;

  nodes.forEach((node, idx) => {
    const area = instances[idx]?.area ?? 50;
    edges.push({ from: node.id, to: outdoorNode.id, conductance: clamp(area / 600, 0.04, 0.25) });
  });

  for (let i = 0; i < instances.length; i++) {
    for (let j = i + 1; j < instances.length; j++) {
      const a = instances[i];
      const b = instances[j];
      const distance = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
      if (distance <= distanceThreshold) {
        const conductance = clamp(0.35 - distance * 0.04, 0.05, 0.35);
        edges.push({ from: a.id, to: b.id, conductance });
      }
    }
  }

  return { nodes: [...nodes, outdoorNode], edges };
}

export function simulateThermalGraph(graph: ThermalGraph, options: SimulationOptions = {}): SimulationFrame[] {
  if (!graph.nodes.length) {
    return [];
  }

  const durationHours = options.durationHours ?? 24;
  const timestepMinutes = options.timestepMinutes ?? 30;
  const dt = timestepMinutes / 60;
  const steps = Math.ceil(durationHours / dt);

  const tempMap = new Map<string, number>();
  graph.nodes.forEach((node) => {
    tempMap.set(node.id, node.initialTemp);
  });

  const adjacency = new Map<string, ThermalEdge[]>();
  graph.edges.forEach((edge) => {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge]);
  });

  const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node]));

  const frames: SimulationFrame[] = [];

  for (let step = 0; step <= steps; step++) {
    const time = step * dt;
    frames.push({ time, temperatures: Object.fromEntries(tempMap) });

    const deltas = new Map<string, number>();
    for (const node of graph.nodes) {
      if (node.type === "outdoor") {
        const outdoorTemp = outdoorTemperatureAt(time);
        tempMap.set(node.id, outdoorTemp);
        continue;
      }

      const currentTemp = tempMap.get(node.id) ?? 20;
      const neighbors = adjacency.get(node.id) ?? [];
      let flow = 0;
      for (const edge of neighbors) {
        const otherId = edge.from === node.id ? edge.to : edge.from;
        const otherNode = nodeLookup.get(otherId);
        const otherTemp =
          otherNode?.type === "outdoor" ? outdoorTemperatureAt(time) : tempMap.get(otherId) ?? currentTemp;
        flow += edge.conductance * (otherTemp - currentTemp);
      }

      const delta = ((flow + node.heatGain) / Math.max(node.capacity, 1)) * dt;
      deltas.set(node.id, currentTemp + delta);
    }

    deltas.forEach((value, key) => tempMap.set(key, value));
  }

  return frames;
}

export function outdoorTemperatureAt(timeHours: number): number {
  const wrapped = timeHours % 24;
  const lower = Math.floor(wrapped);
  const upper = Math.ceil(wrapped);
  const frac = wrapped - lower;
  const tLower = DEFAULT_OUTDOOR_TEMPS[lower % 24];
  const tUpper = DEFAULT_OUTDOOR_TEMPS[upper % 24];
  return lerp(tLower, tUpper, frac);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
