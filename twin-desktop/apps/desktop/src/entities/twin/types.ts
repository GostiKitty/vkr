import type { Space, Twin } from "../../shared/api/types";

export interface SpaceInstance {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  area: number;
  volume: number;
  level?: string;
}

export interface ThermalNode {
  id: string;
  label: string;
  type: "space" | "outdoor";
  capacity: number;
  heatGain: number;
  initialTemp: number;
}

export interface ThermalEdge {
  from: string;
  to: string;
  conductance: number;
}

export interface ThermalGraph {
  nodes: ThermalNode[];
  edges: ThermalEdge[];
}

export interface SimulationFrame {
  time: number;
  temperatures: Record<string, number>;
}

export interface TwinDerivedState {
  spaceInstances: SpaceInstance[];
  thermalGraph: ThermalGraph | null;
  simulationFrames: SimulationFrame[];
  timeIndex: number;
}

export type { Twin, Space };
