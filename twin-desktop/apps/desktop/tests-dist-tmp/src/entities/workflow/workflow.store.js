import { create } from "zustand";
export function createDefaultScenarioConfig() {
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
            dayGain_W_m2: 17,
            nightGain_W_m2: 3.7,
        },
        occupancyPresetId: "residential",
        occupancy: {
            dayFraction: 1,
            nightFraction: 0.25,
        },
        ventilation: {
            infiltrationMode: "envelopeLeakage",
            infiltrationACH: 0.5,
            ventilationACH: 0.18,
            heatRecoveryFactor: null,
            mechanicalVentilationEnabled: true,
            envelopeLeakage: {
                envelopeAirPermeabilityM3sM2At10Pa: null,
                windowAirPermeabilityM3sMAt10Pa: null,
                doorAirPermeabilityM3sMAt10Pa: null,
                pressureExponent: null,
                referencePressurePa: null,
            },
            pressureBased: {
                windSpeedMps: null,
                windPressureCoefficient: null,
                stackHeightM: null,
                mechanicalPressurePa: null,
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
export function resolveScenarioConfig(config) {
    const defaults = createDefaultScenarioConfig();
    const resolved = {
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
    if (config?.ventilation?.infiltrationMode == null) {
        resolved.ventilation = {
            ...resolved.ventilation,
            infiltrationMode: defaults.ventilation.infiltrationMode,
        };
    }
    return resolved;
}
const initialState = {
    currentStep: "geometry",
    scenarioConfig: null,
    uncertaintyConfig: null,
    solveCompleted: false,
    monteCarloResult: null,
    monteCarloResultBinding: null,
    scenarioRunHistory: [],
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
    setMonteCarloResult: (result, binding) => set({
        monteCarloResult: result,
        monteCarloResultBinding: result ? binding ?? null : null,
    }),
    pushScenarioRunSnapshot: (snapshot) => set((state) => ({
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
