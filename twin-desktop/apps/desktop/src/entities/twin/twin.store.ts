import { create } from "zustand";
import type { ThermalSimulationResult } from "../../core/thermal/solver";
import type { Twin } from "../../shared/api/types";
import type { ModelBinding } from "../../shared/utils/modelSync";
import type { SimulationFrame, SpaceInstance, ThermalGraph } from "./types";

export type SimulationDataSource = "demo" | "computed" | null;

interface TwinStoreState {
  twin: Twin | null;
  selectedSpaceId: string | null;
  loading: boolean;
  error: string | null;
  spaceInstances: SpaceInstance[];
  thermalGraph: ThermalGraph | null;
  simulationFrames: SimulationFrame[];
  timeIndex: number;
  lastThermalResult: ThermalSimulationResult | null;
  lastThermalResultBinding: ModelBinding | null;
  simulationDataSource: SimulationDataSource;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTwin: (nextTwin: Twin | null) => void;
  selectSpace: (spaceId: string | null) => void;
  setSpaceInstances: (instances: SpaceInstance[]) => void;
  setThermalGraph: (graph: ThermalGraph | null) => void;
  setSimulationFrames: (frames: SimulationFrame[]) => void;
  setSimulationResult: (payload: {
    frames: SimulationFrame[];
    graph: ThermalGraph | null;
    result?: ThermalSimulationResult | null;
    source: "demo" | "computed";
    binding?: ModelBinding | null;
  }) => void;
  setTimeIndex: (index: number) => void;
  clearSimulation: () => void;
  reset: () => void;
}

const initialState: Omit<
  TwinStoreState,
  | "setLoading"
  | "setError"
  | "setTwin"
  | "selectSpace"
  | "setSpaceInstances"
  | "setThermalGraph"
  | "setSimulationFrames"
  | "setSimulationResult"
  | "setTimeIndex"
  | "clearSimulation"
  | "reset"
> = {
  twin: null,
  selectedSpaceId: null,
  loading: false,
  error: null,
  spaceInstances: [],
  thermalGraph: null,
  simulationFrames: [],
  timeIndex: 0,
  lastThermalResult: null,
  lastThermalResultBinding: null,
  simulationDataSource: null,
};

export const useTwinStore = create<TwinStoreState>((set, get) => ({
  ...initialState,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setTwin: (nextTwin) =>
    set((state) => {
      const spaces = nextTwin?.spaces ?? [];
      const previousId = state.selectedSpaceId;
      const keepSelection = Boolean(previousId && spaces.some((space) => space.id === previousId));
      return {
        twin: nextTwin,
        selectedSpaceId: keepSelection ? previousId : spaces.length ? spaces[0].id : null,
      };
    }),
  selectSpace: (spaceId) =>
    set((state) => {
      if (!spaceId) {
        return { selectedSpaceId: null };
      }
      const spaces = state.twin?.spaces ?? [];
      const graphSpaceIds =
        state.thermalGraph?.nodes.filter((node) => node.type === "space").map((node) => node.id) ?? [];
      const isKnown =
        spaces.some((space) => space.id === spaceId) || graphSpaceIds.includes(spaceId);
      if (!isKnown) {
        return {};
      }
      return { selectedSpaceId: spaceId };
    }),
  setSpaceInstances: (instances) => set({ spaceInstances: instances }),
  setThermalGraph: (graph) => set({ thermalGraph: graph }),
  setSimulationFrames: (frames) =>
    set({
      simulationFrames: frames,
      timeIndex: frames.length ? Math.min(get().timeIndex, frames.length - 1) : 0,
    }),
  setSimulationResult: ({ frames, graph, result, source, binding }) =>
    set({
      simulationFrames: frames,
      thermalGraph: graph,
      lastThermalResult: result ?? null,
      lastThermalResultBinding: result ? binding ?? null : null,
      simulationDataSource: source,
      timeIndex: frames.length ? 0 : 0,
    }),
  setTimeIndex: (index) =>
    set((state) => {
      if (!state.simulationFrames.length) {
        return { timeIndex: 0 };
      }
      const clamped = Math.max(0, Math.min(index, state.simulationFrames.length - 1));
      return { timeIndex: clamped };
    }),
  clearSimulation: () =>
    set({
      spaceInstances: [],
      thermalGraph: null,
      simulationFrames: [],
      timeIndex: 0,
      lastThermalResult: null,
      lastThermalResultBinding: null,
      simulationDataSource: null,
    }),
  reset: () => set(initialState),
}));
