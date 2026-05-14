import { create } from "zustand";
const initialState = {
    twin: null,
    selectedSpaceId: null,
    loading: false,
    error: null,
    spaceInstances: [],
    thermalGraph: null,
    simulationFrames: [],
    timeIndex: 0,
};
export const useTwinStore = create((set, get) => ({
    ...initialState,
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setTwin: (nextTwin) => set(() => {
        const spaces = nextTwin?.spaces ?? [];
        return {
            twin: nextTwin,
            selectedSpaceId: spaces.length ? spaces[0].id : null,
            simulationFrames: [],
            timeIndex: 0,
        };
    }),
    selectSpace: (spaceId) => set((state) => {
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
    setSimulationFrames: (frames) => set({
        simulationFrames: frames,
        timeIndex: frames.length ? Math.min(get().timeIndex, frames.length - 1) : 0,
    }),
    setTimeIndex: (index) => set((state) => {
        if (!state.simulationFrames.length) {
            return { timeIndex: 0 };
        }
        const clamped = Math.max(0, Math.min(index, state.simulationFrames.length - 1));
        return { timeIndex: clamped };
    }),
    reset: () => set(initialState),
}));
