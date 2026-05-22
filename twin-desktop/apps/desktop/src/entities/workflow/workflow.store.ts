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
    ventilationACH: number;
    heatRecoveryFactor: number;
    mechanicalVentilationEnabled: boolean;
  };
  /** Идентификатор города из СП 131.13330.2025 (norms/sp131_2025). */
  climateCityId?: string | null;
}

export type ScenarioRunSnapshot = {
  id: string;
  label: string;
  savedAt: string;
  peakLoadKW: number;
  totalEnergyKWh: number;
  discomfortHours: number;
};

interface WorkflowStoreState {
  currentStep: WorkflowStep;
  scenarioConfig: ScenarioConfig | null;
  uncertaintyConfig: UncertaintyConfig | null;
  solveCompleted: boolean;
  monteCarloResult: ThermalMonteCarloResult | null;
  scenarioRunHistory: ScenarioRunSnapshot[];
  setCurrentStep: (step: WorkflowStep) => void;
  setScenarioConfig: (config: ScenarioConfig) => void;
  setUncertaintyConfig: (config: UncertaintyConfig | null) => void;
  markSolveCompleted: (completed: boolean) => void;
  setMonteCarloResult: (result: ThermalMonteCarloResult | null) => void;
  pushScenarioRunSnapshot: (snapshot: Omit<ScenarioRunSnapshot, "id" | "savedAt">) => void;
  resetWorkflow: () => void;
}

const initialState: Pick<
  WorkflowStoreState,
  | "currentStep"
  | "scenarioConfig"
  | "uncertaintyConfig"
  | "solveCompleted"
  | "monteCarloResult"
  | "scenarioRunHistory"
> = {
  currentStep: "geometry",
  scenarioConfig: null,
  uncertaintyConfig: null,
  solveCompleted: false,
  monteCarloResult: null,
  scenarioRunHistory: [],
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
  pushScenarioRunSnapshot: (snapshot) =>
    set((state) => ({
      scenarioRunHistory: [
        ...state.scenarioRunHistory.slice(-9),
        {
          ...snapshot,
          id: `run_${Date.now()}`,
          savedAt: new Date().toISOString(),
        },
      ],
    })),
  resetWorkflow: () => set(initialState),
}));
