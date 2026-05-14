import { create } from "zustand";
import type { Twin } from "../../shared/api/types";
import type { SimulationFrame, SpaceInstance, ThermalGraph } from "./types";

interface TwinStoreState {
  twin: Twin | null;
  selectedSpaceId: string | null;
  loading: boolean;
  error: string | null;
  spaceInstances: SpaceInstance[];
  thermalGraph: ThermalGraph | null;
  simulationFrames: SimulationFrame[];
  timeIndex: number;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTwin: (nextTwin: Twin | null) => void;
  selectSpace: (spaceId: string | null) => void;
  setSpaceInstances: (instances: SpaceInstance[]) => void;
  setThermalGraph: (graph: ThermalGraph | null) => void;
  setSimulationFrames: (frames: SimulationFrame[]) => void;
  setTimeIndex: (index: number) => void;
  reset: () => void;
}

const initialState: Omit<TwinStoreState, "setLoading" | "setError" | "setTwin" | "selectSpace" | "setSpaceInstances" | "setThermalGraph" | "setSimulationFrames" | "setTimeIndex" | "reset"> = {
  twin: null,
  selectedSpaceId: null,
  loading: false,
  error: null,
  spaceInstances: [],
  thermalGraph: null,
  simulationFrames: [],
  timeIndex: 0,
};

export const useTwinStore = create<TwinStoreState>((set, get) => ({
  ...initialState,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setTwin: (nextTwin) =>
    set(() => {
      const spaces = nextTwin?.spaces ?? [];
      return {
        twin: nextTwin,
        selectedSpaceId: spaces.length ? spaces[0].id : null,
        simulationFrames: [],
        timeIndex: 0,
      };
    }),
  selectSpace: (spaceId) =>
    set((state) => {
      if (!spaceId) {
        return { selectedSpaceId: null };
      }
      const spaces = state.twin?.spaces ?? [];
      if (!spaces.some((space) => space.id === spaceId)) {
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
  setTimeIndex: (index) =>
    set((state) => {
      if (!state.simulationFrames.length) {
        return { timeIndex: 0 };
      }
      const clamped = Math.max(0, Math.min(index, state.simulationFrames.length - 1));
      return { timeIndex: clamped };
    }),
  reset: () => set(initialState),
}));
