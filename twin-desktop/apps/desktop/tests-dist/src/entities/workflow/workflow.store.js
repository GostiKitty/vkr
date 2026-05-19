import { create } from "zustand";
const initialState = {
    currentStep: "geometry",
    scenarioConfig: null,
    uncertaintyConfig: null,
    solveCompleted: false,
    monteCarloResult: null,
};
export const workflowOrder = ["geometry", "envelope", "scenario", "solve", "uncertainty", "results"];
export const useWorkflowStore = create((set) => ({
    ...initialState,
    setCurrentStep: (step) => set((state) => ({
        currentStep: step,
        solveCompleted: step === "solve" ? state.solveCompleted : state.solveCompleted,
    })),
    setScenarioConfig: (config) => set({ scenarioConfig: config, solveCompleted: false }),
    setUncertaintyConfig: (config) => set({ uncertaintyConfig: config, solveCompleted: false }),
    markSolveCompleted: (completed) => set({ solveCompleted: completed }),
    setMonteCarloResult: (result) => set({ monteCarloResult: result }),
    resetWorkflow: () => set(initialState),
}));
