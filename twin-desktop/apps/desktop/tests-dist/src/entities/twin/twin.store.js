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
    lastThermalResult: null,
    simulationDataSource: null,
};
export const useTwinStore = create((set, get) => ({
    ...initialState,
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setTwin: (nextTwin) => set((state) => {
        const spaces = nextTwin?.spaces ?? [];
        const previousId = state.selectedSpaceId;
        const keepSelection = Boolean(previousId && spaces.some((space) => space.id === previousId));
        return {
            twin: nextTwin,
            selectedSpaceId: keepSelection ? previousId : spaces.length ? spaces[0].id : null,
        };
    }),
    selectSpace: (spaceId) => set((state) => {
        if (!spaceId) {
            return { selectedSpaceId: null };
        }
        const spaces = state.twin?.spaces ?? [];
        const graphSpaceIds = state.thermalGraph?.nodes.filter((node) => node.type === "space").map((node) => node.id) ?? [];
        const isKnown = spaces.some((space) => space.id === spaceId) || graphSpaceIds.includes(spaceId);
        if (!isKnown) {
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
    setSimulationResult: ({ frames, graph, result, source }) => set({
        simulationFrames: frames,
        thermalGraph: graph,
        lastThermalResult: result ?? null,
        simulationDataSource: source,
        timeIndex: frames.length ? 0 : 0,
    }),
    setTimeIndex: (index) => set((state) => {
        if (!state.simulationFrames.length) {
            return { timeIndex: 0 };
        }
        const clamped = Math.max(0, Math.min(index, state.simulationFrames.length - 1));
        return { timeIndex: clamped };
    }),
    clearSimulation: () => set({
        spaceInstances: [],
        thermalGraph: null,
        simulationFrames: [],
        timeIndex: 0,
        lastThermalResult: null,
        simulationDataSource: null,
    }),
    reset: () => set(initialState),
}));
