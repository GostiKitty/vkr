import { segmentLength } from "../../../entities/geometry/geom";
import type { BuildingModel } from "../../../entities/geometry/types";
import type {
  ScenarioConfig,
  ScenarioEngineeringSystemsConfig,
} from "../../../entities/workflow/workflow.store";

type EngineeringFluidType = NonNullable<ScenarioEngineeringSystemsConfig["fluidType"]>;
import type { ThermalSimulationResult } from "../solver";

export type EngineeringInputSource = "user" | "model" | "fallback" | "calculated" | "result";

export interface ResolvedEngineeringScalar {
  value: number;
  source: EngineeringInputSource;
  explicit: boolean;
}

export interface ResolvedEngineeringText {
  value: string;
  source: EngineeringInputSource;
  explicit: boolean;
}

export interface ResolvedEngineeringFlag {
  value: boolean;
  source: EngineeringInputSource;
  explicit: boolean;
}

export interface ModelEngineeringSummary {
  totalPipeLengthM: number;
  representativePipeDiameterMm: number | null;
  anyPipeInsulated: boolean;
  heatCarrier: string | null;
  meanPipeFluidTemperatureC: number | null;
  installedPowerW: number;
  designMassFlowKgS: number;
  supplyTemperatureC: number | null;
  returnTemperatureC: number | null;
  emitterLabel: string | null;
}

const DEFAULT_SUPPLY_TEMPERATURE_C = 70;
const DEFAULT_RETURN_DELTA_K = 20;
const HEATING_EQUIPMENT_TYPES = new Set(["radiator", "fancoil", "boiler", "heat_exchanger", "pump"]);

export function summarizeModelEngineering(model: BuildingModel): ModelEngineeringSummary {
  const totalPipeLengthM = model.pipes.reduce((sum, pipe) => sum + polylineLengthM(pipe.path), 0);
  const diameters = model.pipes
    .map((pipe) => pipe.diameter_mm)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  const representativePipeDiameterMm = diameters.length ? diameters[Math.floor(diameters.length / 2)] : null;
  const anyPipeInsulated = model.pipes.some((pipe) => (pipe.insulationThickness_mm ?? 0) > 0);
  const heatCarrier = model.pipes.find((pipe) => typeof pipe.heatCarrier === "string")?.heatCarrier ?? null;
  const pipeTemps = model.pipes
    .map((pipe) => pipe.fluidTemperatureC)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const meanPipeFluidTemperatureC =
    pipeTemps.length > 0 ? pipeTemps.reduce((sum, value) => sum + value, 0) / pipeTemps.length : null;

  const heatingEquipment = model.equipment.filter((item) => HEATING_EQUIPMENT_TYPES.has(item.type));
  const installedPowerW = heatingEquipment.reduce((sum, item) => sum + Math.max(0, item.params.nominalPowerW ?? 0), 0);
  const designMassFlowKgS = heatingEquipment.reduce(
    (sum, item) => sum + Math.max(0, item.params.designFlow_kg_s ?? 0),
    0
  );
  const supplyValues = heatingEquipment
    .map((item) => item.params.supplyTemperatureC)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const returnValues = heatingEquipment
    .map((item) => item.params.returnTemperatureC)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const emitterTypes = Array.from(new Set(heatingEquipment.map((item) => item.type)));

  return {
    totalPipeLengthM,
    representativePipeDiameterMm,
    anyPipeInsulated,
    heatCarrier,
    meanPipeFluidTemperatureC,
    installedPowerW,
    designMassFlowKgS,
    supplyTemperatureC: supplyValues.length ? Math.max(...supplyValues) : null,
    returnTemperatureC: returnValues.length ? Math.min(...returnValues) : null,
    emitterLabel: emitterTypes.length ? emitterTypes.join(", ") : null,
  };
}

function resolveScalar(
  raw: number | null | undefined,
  fromModel: number | null | undefined,
  fallback: number,
  modelPredicate: (value: number) => boolean = (value) => value > 0
): ResolvedEngineeringScalar {
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  if (fromModel != null && Number.isFinite(fromModel) && modelPredicate(fromModel)) {
    return { value: fromModel, source: "model", explicit: false };
  }
  return { value: fallback, source: "fallback", explicit: false };
}

export function resolveSupplyTemperatureC(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  modelSummary: ModelEngineeringSummary
): ResolvedEngineeringScalar {
  return resolveScalar(
    scenarioConfig?.engineeringSystems?.supplyTemperatureC,
    modelSummary.supplyTemperatureC ?? modelSummary.meanPipeFluidTemperatureC,
    scenario.engineeringSystems?.supplyTemperatureC ?? DEFAULT_SUPPLY_TEMPERATURE_C
  );
}

export function resolveReturnTemperatureC(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  supply: ResolvedEngineeringScalar,
  modelSummary: ModelEngineeringSummary
): ResolvedEngineeringScalar {
  const raw = scenarioConfig?.engineeringSystems?.returnTemperatureC;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  if (modelSummary.returnTemperatureC != null && Number.isFinite(modelSummary.returnTemperatureC)) {
    return { value: modelSummary.returnTemperatureC, source: "model", explicit: false };
  }
  return {
    value: supply.value - DEFAULT_RETURN_DELTA_K,
    source: "calculated",
    explicit: false,
  };
}

export function resolveInstalledCapacityW(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  modelSummary: ModelEngineeringSummary,
  thermalResult: ThermalSimulationResult | null | undefined
): ResolvedEngineeringScalar {
  const raw = scenarioConfig?.engineeringSystems?.installedCapacityW;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  if (modelSummary.installedPowerW > 0) {
    return { value: modelSummary.installedPowerW, source: "model", explicit: false };
  }
  const peakW = thermalResult?.summary.peakLoadKW != null ? thermalResult.summary.peakLoadKW * 1000 : null;
  if (peakW != null && peakW > 0) {
    return { value: peakW, source: "result", explicit: false };
  }
  return { value: scenario.engineeringSystems?.installedCapacityW ?? 0, source: "fallback", explicit: false };
}

export function resolveMassFlowKgS(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  modelSummary: ModelEngineeringSummary,
  requiredMassFlowKgS: number | null
): ResolvedEngineeringScalar {
  const raw = scenarioConfig?.engineeringSystems?.massFlowKgS;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  if (modelSummary.designMassFlowKgS > 0) {
    return { value: modelSummary.designMassFlowKgS, source: "model", explicit: false };
  }
  if (requiredMassFlowKgS != null && requiredMassFlowKgS > 0) {
    return { value: requiredMassFlowKgS, source: "calculated", explicit: false };
  }
  return { value: scenario.engineeringSystems?.massFlowKgS ?? 0, source: "fallback", explicit: false };
}

export function resolvePipeDiameterMm(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  modelSummary: ModelEngineeringSummary
): ResolvedEngineeringScalar | null {
  const raw = scenarioConfig?.engineeringSystems?.pipeDiameterMm;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  if (modelSummary.representativePipeDiameterMm != null) {
    return { value: modelSummary.representativePipeDiameterMm, source: "model", explicit: false };
  }
  const fallback = scenario.engineeringSystems?.pipeDiameterMm;
  return fallback != null && Number.isFinite(fallback) ? { value: fallback, source: "fallback", explicit: false } : null;
}

export function resolvePipeLengthM(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  modelSummary: ModelEngineeringSummary
): ResolvedEngineeringScalar | null {
  const raw = scenarioConfig?.engineeringSystems?.pipeLengthM;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  if (modelSummary.totalPipeLengthM > 0) {
    return { value: modelSummary.totalPipeLengthM, source: "model", explicit: false };
  }
  const fallback = scenario.engineeringSystems?.pipeLengthM;
  return fallback != null && Number.isFinite(fallback) ? { value: fallback, source: "fallback", explicit: false } : null;
}

export function resolveEmitterType(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  modelSummary: ModelEngineeringSummary
): ResolvedEngineeringText {
  const raw = scenarioConfig?.engineeringSystems?.emitterType?.trim();
  if (raw) {
    return { value: raw, source: "user", explicit: true };
  }
  if (modelSummary.emitterLabel) {
    return { value: modelSummary.emitterLabel, source: "model", explicit: false };
  }
  return { value: scenario.engineeringSystems?.emitterType ?? "", source: "fallback", explicit: false };
}

export function resolvePipeInsulated(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  modelSummary: ModelEngineeringSummary
): ResolvedEngineeringFlag {
  const raw = scenarioConfig?.engineeringSystems?.pipeInsulated;
  if (raw != null) {
    return { value: raw, source: "user", explicit: true };
  }
  if (modelSummary.anyPipeInsulated) {
    return { value: true, source: "model", explicit: false };
  }
  return { value: scenario.engineeringSystems?.pipeInsulated ?? false, source: "fallback", explicit: false };
}

export function resolvePipeFluidTemperatureC(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  supply: ResolvedEngineeringScalar,
  modelSummary: ModelEngineeringSummary
): ResolvedEngineeringScalar {
  const raw = scenarioConfig?.engineeringSystems?.pipeFluidTemperatureC;
  if (raw != null && Number.isFinite(raw)) {
    return { value: raw, source: "user", explicit: true };
  }
  if (modelSummary.meanPipeFluidTemperatureC != null) {
    return { value: modelSummary.meanPipeFluidTemperatureC, source: "model", explicit: false };
  }
  return { value: supply.value, source: "calculated", explicit: false };
}

export function mapHeatCarrierToFluidType(
  heatCarrier: string | null,
  scenarioFluid: EngineeringFluidType | undefined,
  explicitFluid: boolean
): EngineeringFluidType {
  if (explicitFluid && scenarioFluid) {
    return scenarioFluid;
  }
  const normalized = (heatCarrier ?? "").toLowerCase();
  if (normalized.includes("glycol") || normalized.includes("гликоль")) {
    return "glycol";
  }
  if (scenarioFluid) {
    return scenarioFluid;
  }
  return "water";
}

export interface ResolvedEngineeringInputs {
  modelSummary: ModelEngineeringSummary;
  supplyTemperatureC: ResolvedEngineeringScalar;
  returnTemperatureC: ResolvedEngineeringScalar;
  massFlowKgS: ResolvedEngineeringScalar;
  installedCapacityW: ResolvedEngineeringScalar;
  pipeDiameterMm: ResolvedEngineeringScalar | null;
  pipeLengthM: ResolvedEngineeringScalar | null;
  pipeInsulated: ResolvedEngineeringFlag;
  pipeFluidTemperatureC: ResolvedEngineeringScalar;
  emitterType: ResolvedEngineeringText;
  fluidType: EngineeringFluidType;
  fluidTypeSource: EngineeringInputSource;
}

export function resolveScenarioEngineeringInputs(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel,
  thermalResult: ThermalSimulationResult | null | undefined,
  requiredMassFlowKgS: number | null = null
): ResolvedEngineeringInputs {
  const modelSummary = summarizeModelEngineering(model);
  const supplyTemperatureC = resolveSupplyTemperatureC(scenarioConfig, scenario, modelSummary);
  const returnTemperatureC = resolveReturnTemperatureC(scenarioConfig, scenario, supplyTemperatureC, modelSummary);
  const installedCapacityW = resolveInstalledCapacityW(scenarioConfig, scenario, modelSummary, thermalResult);
  const massFlowKgS = resolveMassFlowKgS(scenarioConfig, scenario, modelSummary, requiredMassFlowKgS);
  const explicitFluid = scenarioConfig?.engineeringSystems?.fluidType != null;
  const fluidType = mapHeatCarrierToFluidType(
    modelSummary.heatCarrier,
    scenario.engineeringSystems?.fluidType,
    explicitFluid
  );
  const fluidTypeSource: EngineeringInputSource = explicitFluid
    ? "user"
    : modelSummary.heatCarrier
      ? "model"
      : "fallback";

  return {
    modelSummary,
    supplyTemperatureC,
    returnTemperatureC,
    massFlowKgS,
    installedCapacityW,
    pipeDiameterMm: resolvePipeDiameterMm(scenarioConfig, scenario, modelSummary),
    pipeLengthM: resolvePipeLengthM(scenarioConfig, scenario, modelSummary),
    pipeInsulated: resolvePipeInsulated(scenarioConfig, scenario, modelSummary),
    pipeFluidTemperatureC: resolvePipeFluidTemperatureC(scenarioConfig, scenario, supplyTemperatureC, modelSummary),
    emitterType: resolveEmitterType(scenarioConfig, scenario, modelSummary),
    fluidType,
    fluidTypeSource,
  };
}

function polylineLengthM(path: { x: number; y: number }[]): number {
  if (path.length < 2) {
    return 0;
  }
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    length += segmentLength(path[index - 1], path[index]);
  }
  return length;
}
