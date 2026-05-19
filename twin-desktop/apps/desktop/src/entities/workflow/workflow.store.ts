import { create } from "zustand";
import type { ThermalMonteCarloResult } from "../../core/uncertainty/thermalMonteCarlo";

export type WorkflowStep = "geometry" | "envelope" | "scenario" | "solve" | "uncertainty" | "results";
export type WorkflowStepStatus = "ready" | "pending" | "error";

export interface UncertaintyConfig {
  runs: number;
  evaluationMode: "full-physics" | "surrogate";
}

export interface ScenarioConfig {
  climate: {
    baseC: number;
    amplitudeC: number;
    seasonalOffsetC: number;
  };
  setpoints: {
    day: number;
    night: number;
    dayStartHour: number;
    nightStartHour: number;
  };
  internalGains: {
    dayGain_W_m2: number;
    nightGain_W_m2: number;
  };
  occupancy: {
    dayFraction: number;
    nightFraction: number;
  };
  ventilation: {
    infiltrationACH: number;
  };
}

interface WorkflowStoreState {
  currentStep: WorkflowStep;
  scenarioConfig: ScenarioConfig | null;
  uncertaintyConfig: UncertaintyConfig | null;
  solveCompleted: boolean;
  monteCarloResult: ThermalMonteCarloResult | null;
  setCurrentStep: (step: WorkflowStep) => void;
  setScenarioConfig: (config: ScenarioConfig) => void;
  setUncertaintyConfig: (config: UncertaintyConfig | null) => void;
  markSolveCompleted: (completed: boolean) => void;
  setMonteCarloResult: (result: ThermalMonteCarloResult | null) => void;
  resetWorkflow: () => void;
}

const initialState: Pick<
  WorkflowStoreState,
  "currentStep" | "scenarioConfig" | "uncertaintyConfig" | "solveCompleted" | "monteCarloResult"
> = {
  currentStep: "geometry",
  scenarioConfig: null,
  uncertaintyConfig: null,
  solveCompleted: false,
  monteCarloResult: null,
};

export const workflowOrder: WorkflowStep[] = ["geometry", "envelope", "scenario", "solve", "uncertainty", "results"];

export const useWorkflowStore = create<WorkflowStoreState>((set) => ({
  ...initialState,
  setCurrentStep: (step) =>
    set((state) => ({
      currentStep: step,
      solveCompleted: step === "solve" ? state.solveCompleted : state.solveCompleted,
    })),
  setScenarioConfig: (config) => set({ scenarioConfig: config, solveCompleted: false }),
  setUncertaintyConfig: (config) => set({ uncertaintyConfig: config, solveCompleted: false }),
  markSolveCompleted: (completed) => set({ solveCompleted: completed }),
  setMonteCarloResult: (result) => set({ monteCarloResult: result }),
  resetWorkflow: () => set(initialState),
}));
