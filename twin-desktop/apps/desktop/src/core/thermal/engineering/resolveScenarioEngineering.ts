import { segmentLength } from "../../../entities/geometry/geom";
import type { BuildingModel } from "../../../entities/geometry/types";
import type {
  EngineeringEquipmentParameters,
  EngineeringSystemsModel,
} from "../../../entities/engineering/types";
import type {
  ScenarioConfig,
  ScenarioEngineeringSystemsConfig,
} from "../../../entities/workflow/workflow.store";
import { buildHeatingModelSnapshot } from "../../networks/heatingModel";

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
const ENGINEERING_EMITTER_TYPES = new Set(["convector"]);
const ENGINEERING_ADDITIVE_POWER_TYPES = new Set(["convector"]);
const ENGINEERING_AIR_MEDIA = new Set(["airSupply", "airExhaust"]);
const ENGINEERING_AIR_EQUIPMENT_TYPES = new Set([
  "airHandlingUnit",
  "ductFan",
  "roofFan",
  "airDamper",
  "airCheckValve",
  "fireDamper",
  "airFilter",
  "airFlowRegulatorConst",
  "airFlowRegulatorVar",
  "silencer",
  "airHeater",
  "airCooler",
  "airHumidifier",
  "airDehumidifier",
  "supplyDiffuser",
  "exhaustGrille",
]);
const WATER_DENSITY_KG_M3 = 1000;
const VOLUME_FLOW_M3H_TO_MASS_FLOW_KGS = WATER_DENSITY_KG_M3 / 3600;

function readParamNumber(params: EngineeringEquipmentParameters, key: string): number | null {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function volumeFlowM3HToMassFlowKgS(flowM3H: number): number {
  return Math.max(0, flowM3H) * VOLUME_FLOW_M3H_TO_MASS_FLOW_KGS;
}

function representativeDiameterMm(diameters: number[]): number | null {
  const sorted = diameters
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
}

type ModelEngineeringSummaryPatch = Partial<ModelEngineeringSummary> & {
  emitterLabels?: string[];
};

function mergeModelEngineeringSummary(
  base: ModelEngineeringSummary,
  patch: ModelEngineeringSummaryPatch
): ModelEngineeringSummary {
  const emitterLabels = [
    ...(base.emitterLabel ? base.emitterLabel.split(", ") : []),
    ...(patch.emitterLabels ?? []),
  ].filter(Boolean);
  const diameters = [
    base.representativePipeDiameterMm,
    patch.representativePipeDiameterMm,
  ].filter((value): value is number => value != null && value > 0);

  return {
    totalPipeLengthM: Math.max(base.totalPipeLengthM, patch.totalPipeLengthM ?? 0),
    representativePipeDiameterMm: representativeDiameterMm(diameters),
    anyPipeInsulated: base.anyPipeInsulated || (patch.anyPipeInsulated ?? false),
    heatCarrier: patch.heatCarrier ?? base.heatCarrier,
    meanPipeFluidTemperatureC: patch.meanPipeFluidTemperatureC ?? base.meanPipeFluidTemperatureC,
    installedPowerW: Math.max(base.installedPowerW, patch.installedPowerW ?? 0),
    designMassFlowKgS: Math.max(base.designMassFlowKgS, patch.designMassFlowKgS ?? 0),
    supplyTemperatureC:
      base.supplyTemperatureC == null
        ? (patch.supplyTemperatureC ?? null)
        : patch.supplyTemperatureC == null
          ? base.supplyTemperatureC
          : Math.max(base.supplyTemperatureC, patch.supplyTemperatureC),
    returnTemperatureC:
      base.returnTemperatureC == null
        ? (patch.returnTemperatureC ?? null)
        : patch.returnTemperatureC == null
          ? base.returnTemperatureC
          : Math.min(base.returnTemperatureC, patch.returnTemperatureC),
    emitterLabel: emitterLabels.length ? Array.from(new Set(emitterLabels)).join(", ") : null,
  };
}

function summarizeHeatingNetworkModel(model: BuildingModel): ModelEngineeringSummaryPatch {
  const snapshot = buildHeatingModelSnapshot(model);
  const system = snapshot.systems[0];
  if (!system) {
    const unassignedEquipment = model.equipment.filter((item) =>
      snapshot.unassignedHeatingEquipmentIds.includes(item.id)
    );
    const installedPowerW = Math.max(snapshot.totalLoadW, ...unassignedEquipment.map((item) => item.params.nominalPowerW ?? 0));
    const designMassFlowKgS = unassignedEquipment.reduce(
      (sum, item) => sum + Math.max(0, item.params.designFlow_kg_s ?? 0),
      0
    );
    const supplyValues = unassignedEquipment
      .map((item) => item.params.supplyTemperatureC)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const returnValues = unassignedEquipment
      .map((item) => item.params.returnTemperatureC)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!installedPowerW && !designMassFlowKgS && !supplyValues.length && !returnValues.length) {
      return {};
    }
    return {
      installedPowerW,
      designMassFlowKgS,
      supplyTemperatureC: supplyValues.length ? Math.max(...supplyValues) : null,
      returnTemperatureC: returnValues.length ? Math.min(...returnValues) : null,
      emitterLabels: unassignedEquipment.map((item) => item.type),
    };
  }

  const segmentDiameters = system.segments
    .map((segment) => segment.diameter_mm)
    .filter((value) => Number.isFinite(value) && value > 0);
  const pipeTemps = system.segments
    .map((segment) => segment.fluidTemperatureC)
    .filter((value) => Number.isFinite(value));

  return {
    totalPipeLengthM: Math.max(snapshot.totalLength_m, system.totalLength_m),
    representativePipeDiameterMm: representativeDiameterMm(segmentDiameters),
    heatCarrier: system.heatCarrier,
    meanPipeFluidTemperatureC:
      pipeTemps.length > 0 ? pipeTemps.reduce((sum, value) => sum + value, 0) / pipeTemps.length : null,
    installedPowerW: Math.max(snapshot.totalLoadW, system.totalLoadW),
    designMassFlowKgS: system.estimatedFlow_kg_s,
    supplyTemperatureC: system.supplyTemperatureC,
    returnTemperatureC: system.returnTemperatureC,
    emitterLabels: system.equipmentConnections.map((connection) => connection.equipmentType),
  };
}

function summarizeEngineeringSystemsModel(systems: EngineeringSystemsModel | undefined): ModelEngineeringSummaryPatch {
  if (!systems) {
    return {};
  }

  const diameters: number[] = [];
  const pipeTemps: number[] = [];
  let totalPipeLengthM = 0;
  let anyPipeInsulated = false;
  let designMassFlowKgS = 0;
  let installedPowerW = 0;
  const supplyValues: number[] = [];
  const returnValues: number[] = [];
  const emitterLabels: string[] = [];

  for (const pipe of systems.pipes) {
    if (ENGINEERING_AIR_MEDIA.has(pipe.medium)) {
      continue;
    }
    totalPipeLengthM += polylineLengthM(pipe.points);
    if (pipe.diameter > 0) {
      diameters.push(pipe.diameter);
    }
    if ((pipe.insulation ?? 0) > 0) {
      anyPipeInsulated = true;
    }
    if (pipe.temperature != null && Number.isFinite(pipe.temperature)) {
      pipeTemps.push(pipe.temperature);
    }
    if (pipe.flowRate != null && pipe.flowRate > 0) {
      designMassFlowKgS = Math.max(designMassFlowKgS, volumeFlowM3HToMassFlowKgS(pipe.flowRate));
    }
    if (pipe.medium === "supply" && pipe.temperature != null) {
      supplyValues.push(pipe.temperature);
    }
    if (pipe.medium === "return" && pipe.temperature != null) {
      returnValues.push(pipe.temperature);
    }
  }

  for (const item of systems.equipment) {
    if (ENGINEERING_AIR_EQUIPMENT_TYPES.has(item.type)) {
      continue;
    }
    if (ENGINEERING_EMITTER_TYPES.has(item.type)) {
      emitterLabels.push(item.type);
    }
    const params = item.parameters;
    const supplyTemperatureC =
      readParamNumber(params, "supplyTemperatureC") ??
      readParamNumber(params, "primaryTemperatureC") ??
      readParamNumber(params, "secondaryTemperatureC") ??
      readParamNumber(params, "designTemperatureC");
    const returnTemperatureC = readParamNumber(params, "returnTemperatureC");
    if (supplyTemperatureC != null) {
      supplyValues.push(supplyTemperatureC);
    }
    if (returnTemperatureC != null) {
      returnValues.push(returnTemperatureC);
    }
    const powerKW =
      readParamNumber(params, "powerKW") ??
      readParamNumber(params, "heatPowerKW");
    const nominalPowerW = readParamNumber(params, "nominalPowerW");
    const resolvedPowerW =
      powerKW != null
        ? powerKW * 1000
        : nominalPowerW;
    if (resolvedPowerW != null) {
      installedPowerW = ENGINEERING_ADDITIVE_POWER_TYPES.has(item.type)
        ? installedPowerW + Math.max(0, resolvedPowerW)
        : Math.max(installedPowerW, Math.max(0, resolvedPowerW));
    }
    const flowRateM3H = readParamNumber(params, "flowRateM3H");
    if (flowRateM3H != null) {
      designMassFlowKgS = Math.max(designMassFlowKgS, volumeFlowM3HToMassFlowKgS(flowRateM3H));
    }
  }

  if (
    !totalPipeLengthM &&
    !diameters.length &&
    !anyPipeInsulated &&
    !designMassFlowKgS &&
    !installedPowerW &&
    !supplyValues.length &&
    !returnValues.length &&
    !pipeTemps.length
  ) {
    return { emitterLabels: [] };
  }

  return {
    totalPipeLengthM,
    representativePipeDiameterMm: representativeDiameterMm(diameters),
    anyPipeInsulated,
    meanPipeFluidTemperatureC:
      pipeTemps.length > 0 ? pipeTemps.reduce((sum, value) => sum + value, 0) / pipeTemps.length : null,
    installedPowerW,
    designMassFlowKgS,
    supplyTemperatureC: supplyValues.length ? Math.max(...supplyValues) : null,
    returnTemperatureC: returnValues.length ? Math.min(...returnValues) : null,
    emitterLabels,
  };
}

function summarizeBimEngineering(model: BuildingModel): ModelEngineeringSummary {
  const totalPipeLengthM = model.pipes.reduce((sum, pipe) => sum + polylineLengthM(pipe.path), 0);
  const diameters = model.pipes
    .map((pipe) => pipe.diameter_mm)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const representativePipeDiameterMm = representativeDiameterMm(diameters);
  const anyPipeInsulated = model.pipes.some((pipe) => (pipe.insulationThickness_mm ?? 0) > 0);
  const heatCarrier = model.pipes.find((pipe) => typeof pipe.heatCarrier === "string")?.heatCarrier ?? null;
  const pipeTemps = model.pipes
    .map((pipe) => pipe.fluidTemperatureC)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const meanPipeFluidTemperatureC =
    pipeTemps.length > 0 ? pipeTemps.reduce((sum, value) => sum + value, 0) / pipeTemps.length : null;

  const heatingEquipment = model.equipment.filter((item) => HEATING_EQUIPMENT_TYPES.has(item.type));
  const installedPowerW = heatingEquipment.reduce((sum, item) => sum + Math.max(0, item.params.nominalPowerW ?? 0), 0);
  const designMassFlowKgS = Math.max(
    heatingEquipment.reduce((sum, item) => sum + Math.max(0, item.params.designFlow_kg_s ?? 0), 0),
    model.pipes.reduce((sum, pipe) => sum + Math.max(0, pipe.flowRate_kg_s ?? 0), 0)
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

export function summarizeModelEngineering(model: BuildingModel): ModelEngineeringSummary {
  let summary = summarizeBimEngineering(model);
  summary = mergeModelEngineeringSummary(summary, summarizeHeatingNetworkModel(model));
  summary = mergeModelEngineeringSummary(summary, summarizeEngineeringSystemsModel(model.engineeringSystems));
  return summary;
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
