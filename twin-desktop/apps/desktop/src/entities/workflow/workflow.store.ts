import { create } from "zustand";
import type { InfiltrationMode } from "../../core/thermal/infiltration";
import type { ThermalMonteCarloResult } from "../../core/uncertainty/thermalMonteCarlo";
import type { ModelBinding } from "../../shared/utils/modelSync";

export type WorkflowStep = "geometry" | "envelope" | "scenario" | "solve" | "uncertainty" | "results";
export type WorkflowStepStatus = "ready" | "pending" | "error";

export interface UncertaintyConfig {
  runs: number;
  evaluationMode: "full-physics" | "surrogate";
}

export interface ScenarioRoomGeometryOverride {
  heightM?: number | null;
  heated?: boolean | null;
  floorContactType?: "ground" | "basement" | "outdoor" | "interfloor" | null;
  roofContactType?: "outdoor" | "attic" | "technical" | "interfloor" | null;
  purpose?: string | null;
}

export interface ScenarioClimateManualInputs {
  outdoorDesignTemperatureC?: number | null;
  outdoorHeatingAverageC?: number | null;
  heatingDurationDays?: number | null;
}

export interface ScenarioMaterialsConfig {
  bridgeAccountingMode?: "disabled" | "homogeneityCoefficient" | "explicitPsiChi";
  homogeneityCoefficient?: number | null;
  windowUValue_W_m2K?: number | null;
  doorUValue_W_m2K?: number | null;
  windowGValue?: number | null;
  shadingFactor?: number | null;
}

export interface ScenarioOperationConfig {
  duration?: "24h" | "7d";
  timestepMinutes?: number | null;
}

export interface ScenarioComfortConfig {
  relativeHumidityPercent?: number | null;
  comfortMinC?: number | null;
  comfortMaxC?: number | null;
  comfortCategory?: string | null;
  measuredMrtC?: number | null;
  measuredSurfaceTemperatureC?: number | null;
}

export interface ScenarioEngineeringSystemsConfig {
  heatingEnabled?: boolean;
  heatingMode?: "ideal" | "capacityLimited";
  supplyTemperatureC?: number | null;
  returnTemperatureC?: number | null;
  massFlowKgS?: number | null;
  fluidType?: "water" | "glycol" | "other";
  installedCapacityW?: number | null;
  emitterType?: string | null;
  pipeDiameterMm?: number | null;
  pipeLengthM?: number | null;
  pipeInsulated?: boolean;
  pipeFluidTemperatureC?: number | null;
}

export interface ScenarioEcologyConfig {
  energySource?: string | null;
  emissionFactorKgPerKWh?: number | null;
}

export interface ScenarioEconomyConfig {
  tariffRubPerKWh?: number | null;
  capexRub?: number | null;
  analysisPeriodYears?: number | null;
  discountRatePercent?: number | null;
  annualTariffGrowthPercent?: number | null;
  annualMaintenanceCostRub?: number | null;
  insulationCostRub?: number | null;
  windowsCostRub?: number | null;
  equipmentCostRub?: number | null;
}

export interface ScenarioValidationPoint {
  timestamp: string;
  valueC: number;
}

export interface ScenarioValidationConfig {
  roomId?: string | null;
  measuredSeries?: ScenarioValidationPoint[];
  measuredEnergyKWh?: number | null;
  periodLabel?: string | null;
  availabilityStatus?: "available" | "unavailable" | null;
  dataOrigin?: "measured" | "synthetic" | null;
  note?: string | null;
}

export interface ScenarioEnvelopeLeakageConfig {
  envelopeAirPermeabilityM3sM2At10Pa?: number | null;
  windowAirPermeabilityM3sMAt10Pa?: number | null;
  doorAirPermeabilityM3sMAt10Pa?: number | null;
  pressureExponent?: number | null;
  referencePressurePa?: number | null;
}

export interface ScenarioPressureBasedInfiltrationConfig extends ScenarioEnvelopeLeakageConfig {
  windSpeedMps?: number | null;
  windPressureCoefficient?: number | null;
  stackHeightM?: number | null;
  mechanicalPressurePa?: number | null;
}

export interface ScenarioConfig {
  climate: {
    baseC: number;
    amplitudeC: number;
    seasonalOffsetC: number;
    manual?: ScenarioClimateManualInputs;
  };
  setpoints: {
    day: number;
    night: number;
    dayStartHour: number;
    nightStartHour: number;
    /** Плавный разгон уставки при переключении день/ночь, мин. 0 = ступень. */
    setpointRampMinutes?: number | null;
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
    infiltrationMode?: InfiltrationMode;
    infiltrationACH: number;
    ventilationACH: number;
    heatRecoveryFactor: number;
    mechanicalVentilationEnabled: boolean;
    envelopeLeakage?: ScenarioEnvelopeLeakageConfig;
    pressureBased?: ScenarioPressureBasedInfiltrationConfig;
  };
  climateCityId?: string | null;
  geometry?: {
    roomOverrides?: Record<string, ScenarioRoomGeometryOverride>;
  };
  materials?: ScenarioMaterialsConfig;
  operation?: ScenarioOperationConfig;
  comfort?: ScenarioComfortConfig;
  engineeringSystems?: ScenarioEngineeringSystemsConfig;
  ecology?: ScenarioEcologyConfig;
  economy?: ScenarioEconomyConfig;
  validation?: ScenarioValidationConfig;
}

export function createDefaultScenarioConfig(): ScenarioConfig {
  return {
    climate: {
      baseC: -5,
      amplitudeC: 8,
      seasonalOffsetC: 0,
      manual: {
        outdoorDesignTemperatureC: null,
        outdoorHeatingAverageC: null,
        heatingDurationDays: null,
      },
    },
    setpoints: {
      day: 21,
      night: 18,
      dayStartHour: 6,
      nightStartHour: 22,
      setpointRampMinutes: 60,
    },
    internalGains: {
      dayGain_W_m2: 6,
      nightGain_W_m2: 1,
    },
    occupancy: {
      dayFraction: 1,
      nightFraction: 0.2,
    },
    ventilation: {
      infiltrationMode: "manualAch",
      infiltrationACH: 0.5,
      ventilationACH: 0.18,
      heatRecoveryFactor: 0,
      mechanicalVentilationEnabled: true,
      envelopeLeakage: {
        envelopeAirPermeabilityM3sM2At10Pa: 0.00005,
        windowAirPermeabilityM3sMAt10Pa: 0.0008,
        doorAirPermeabilityM3sMAt10Pa: 0.0012,
        pressureExponent: 0.67,
        referencePressurePa: 10,
      },
      pressureBased: {
        windSpeedMps: 4,
        windPressureCoefficient: 0.6,
        stackHeightM: 6,
        mechanicalPressurePa: 0,
      },
    },
    climateCityId: "moscow",
    geometry: {
      roomOverrides: {},
    },
    materials: {
      homogeneityCoefficient: null,
      windowUValue_W_m2K: null,
      doorUValue_W_m2K: null,
      windowGValue: null,
      shadingFactor: null,
    },
    operation: {
      duration: "24h",
      timestepMinutes: 10,
    },
    comfort: {
      relativeHumidityPercent: null,
      comfortMinC: 20,
      comfortMaxC: 26,
      comfortCategory: null,
      measuredMrtC: null,
      measuredSurfaceTemperatureC: null,
    },
    engineeringSystems: {
      heatingEnabled: true,
      heatingMode: "ideal",
      supplyTemperatureC: null,
      returnTemperatureC: null,
      massFlowKgS: null,
      fluidType: "water",
      installedCapacityW: null,
      emitterType: null,
      pipeDiameterMm: null,
      pipeLengthM: null,
      pipeInsulated: false,
      pipeFluidTemperatureC: null,
    },
    ecology: {
      energySource: null,
      emissionFactorKgPerKWh: null,
    },
    economy: {
      tariffRubPerKWh: null,
      capexRub: null,
      analysisPeriodYears: 15,
      discountRatePercent: 10,
      annualTariffGrowthPercent: 5,
      annualMaintenanceCostRub: null,
      insulationCostRub: null,
      windowsCostRub: null,
      equipmentCostRub: null,
    },
    validation: {
      roomId: null,
      measuredSeries: [],
      measuredEnergyKWh: null,
      periodLabel: null,
      availabilityStatus: null,
      dataOrigin: null,
      note: null,
    },
  };
}

export function resolveScenarioConfig(config: ScenarioConfig | null | undefined): ScenarioConfig {
  const defaults = createDefaultScenarioConfig();
  return {
    ...defaults,
    ...config,
    climate: {
      ...defaults.climate,
      ...(config?.climate ?? {}),
      manual: {
        ...defaults.climate.manual,
        ...(config?.climate.manual ?? {}),
      },
    },
    setpoints: {
      ...defaults.setpoints,
      ...(config?.setpoints ?? {}),
    },
    internalGains: {
      ...defaults.internalGains,
      ...(config?.internalGains ?? {}),
    },
    occupancy: {
      ...defaults.occupancy,
      ...(config?.occupancy ?? {}),
    },
    ventilation: {
      ...defaults.ventilation,
      ...(config?.ventilation ?? {}),
      envelopeLeakage: {
        ...(defaults.ventilation.envelopeLeakage ?? {}),
        ...(config?.ventilation?.envelopeLeakage ?? {}),
      },
      pressureBased: {
        ...(defaults.ventilation.pressureBased ?? {}),
        ...(config?.ventilation?.pressureBased ?? {}),
      },
    },
    geometry: {
      ...defaults.geometry,
      ...(config?.geometry ?? {}),
      roomOverrides: {
        ...(defaults.geometry?.roomOverrides ?? {}),
        ...(config?.geometry?.roomOverrides ?? {}),
      },
    },
    materials: {
      ...defaults.materials,
      ...(config?.materials ?? {}),
    },
    operation: {
      ...defaults.operation,
      ...(config?.operation ?? {}),
    },
    comfort: {
      ...defaults.comfort,
      ...(config?.comfort ?? {}),
    },
    engineeringSystems: {
      ...defaults.engineeringSystems,
      ...(config?.engineeringSystems ?? {}),
    },
    ecology: {
      ...defaults.ecology,
      ...(config?.ecology ?? {}),
    },
    economy: {
      ...defaults.economy,
      ...(config?.economy ?? {}),
    },
    validation: {
      ...defaults.validation,
      ...(config?.validation ?? {}),
      measuredSeries: [...(config?.validation?.measuredSeries ?? defaults.validation?.measuredSeries ?? [])],
    },
  };
}

export type ScenarioRunSnapshot = {
  id: string;
  label: string;
  savedAt: string;
  peakLoadKW: number;
  totalEnergyKWh: number;
  discomfortHours: number;
  infiltrationACH?: number | null;
  ventilationACH?: number | null;
  setpointDayC?: number | null;
  climateCityId?: string | null;
};

interface WorkflowStoreState {
  currentStep: WorkflowStep;
  scenarioConfig: ScenarioConfig | null;
  uncertaintyConfig: UncertaintyConfig | null;
  solveCompleted: boolean;
  monteCarloResult: ThermalMonteCarloResult | null;
  monteCarloResultBinding: ModelBinding | null;
  scenarioRunHistory: ScenarioRunSnapshot[];
  setCurrentStep: (step: WorkflowStep) => void;
  setScenarioConfig: (config: ScenarioConfig) => void;
  setUncertaintyConfig: (config: UncertaintyConfig | null) => void;
  markSolveCompleted: (completed: boolean) => void;
  setMonteCarloResult: (result: ThermalMonteCarloResult | null, binding?: ModelBinding | null) => void;
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
  | "monteCarloResultBinding"
  | "scenarioRunHistory"
> = {
  currentStep: "geometry",
  scenarioConfig: null,
  uncertaintyConfig: null,
  solveCompleted: false,
  monteCarloResult: null,
  monteCarloResultBinding: null,
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
  setMonteCarloResult: (result, binding) =>
    set({
      monteCarloResult: result,
      monteCarloResultBinding: result ? binding ?? null : null,
    }),
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
