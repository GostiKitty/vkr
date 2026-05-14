import type { BuildingModel, FloorSlab, Roof } from "../entities/geometry/types";
import type { Equipment, PipeNetwork } from "../entities/networks/types";
import { buildDemoSp50RunResult, sampleBuildingSP50, type DemoSp50RunResult } from "./sampleBuildingSP50";
import {
  buildTransientScenarioPreset,
  getTransientMonteCarloVisualizationSample,
  listTransientConstructionTargets,
  runTransientConstructionAnalysis,
  runTransientMonteCarlo,
  type TransientConstructionTarget,
  type TransientMonteCarloResult,
  type TransientMonteCarloSample,
  type TransientUncertaintyParameter,
} from "../core/thermal/transient/index";
import {
  buildDefaultEconomicScenario,
  runEconomicAssessment,
  type EconomicAssessmentResult,
  type EconomicScenario,
} from "../core/economics/index";

export type DemoVKRStepId =
  | "geometry"
  | "networks"
  | "sp50"
  | "transient"
  | "uncertainty"
  | "economics"
  | "worstCase"
  | "conclusion";

export interface DemoVKRScenario {
  id: string;
  name: string;
  description: string;
  model: BuildingModel;
  transientScenarioId: string;
  transientTargetId: string;
  transientNodesPerLayer: number;
  transientTimeStep_s: number;
  transientDuration_s: number;
  transientComfortMin_C: number;
  transientCriticalSurfaceTemperature_C: number;
  monteCarloSamplesCount: number;
  monteCarloSeed: number;
  monteCarloParameters: TransientUncertaintyParameter[];
  economicScenario: EconomicScenario;
}

export interface DemoVKRRunResult {
  scenario: DemoVKRScenario;
  model: BuildingModel;
  sp50: DemoSp50RunResult | null;
  transientTarget: TransientConstructionTarget | null;
  transient:
    | {
        result: ReturnType<typeof runTransientConstructionAnalysis>["result"];
        warnings: string[];
        missingData: string[];
      }
    | null;
  monteCarlo: TransientMonteCarloResult | null;
  economic: EconomicAssessmentResult | null;
  worstCaseSample: TransientMonteCarloSample | null;
  bestCaseSample: TransientMonteCarloSample | null;
  medianSample: TransientMonteCarloSample | null;
  engineeringConclusion: string;
  warnings: string[];
}

const DEMO_TRANSIENT_PARAMETERS: TransientUncertaintyParameter[] = [
  {
    id: "outdoor-offset",
    name: "Наружная температура",
    target: "outdoorTemperatureOffset",
    distribution: { kind: "uniform", min: -4, max: 4 },
  },
  {
    id: "heating-power",
    name: "Отопительная мощность",
    target: "heatingPowerMultiplier",
    distribution: { kind: "triangular", min: 0.85, mode: 1, max: 1.15 },
  },
  {
    id: "lambda",
    name: "Теплопроводность материалов",
    target: "lambdaMultiplier",
    distribution: { kind: "uniform", min: 0.92, max: 1.08 },
  },
  {
    id: "initial-temp",
    name: "Начальная температура",
    target: "initialTemperatureOffset",
    distribution: { kind: "normal", mean: 0, std: 1 },
  },
];

const DEMO_EQUIPMENT: Equipment[] = [
  {
    id: "demo-boiler",
    type: "boiler",
    position: { x: 2.5, y: 2.5 },
    levelId: "level-1",
    roomId: "room-1",
    state: "on",
    params: {
      nominalPowerW: 24000,
      efficiency: 0.92,
      supplyTemperatureC: 70,
      returnTemperatureC: 50,
      designFlow_kg_s: 0.16,
      assignedSystemId: "heating-demo",
    },
    connectedNetworkIds: ["pipe-supply-main", "pipe-return-main"],
  },
  {
    id: "demo-pump",
    type: "pump",
    position: { x: 4, y: 2.5 },
    levelId: "level-1",
    roomId: "room-1",
    state: "on",
    params: {
      headPa: 25000,
      designFlow_kg_s: 0.16,
      efficiency: 0.72,
      assignedSystemId: "heating-demo",
    },
    connectedNetworkIds: ["pipe-supply-main", "pipe-return-main"],
  },
  {
    id: "demo-rad-1",
    type: "radiator",
    position: { x: 5, y: 1.2 },
    levelId: "level-1",
    roomId: "room-1",
    state: "on",
    params: {
      nominalPowerW: 1800,
      designFlow_kg_s: 0.08,
      supplyTemperatureC: 70,
      returnTemperatureC: 50,
      connectionType: "side",
      assignedSystemId: "heating-demo",
    },
    connectedNetworkIds: ["pipe-supply-main", "pipe-return-main"],
  },
  {
    id: "demo-rad-2",
    type: "radiator",
    position: { x: 15, y: 13.8 },
    levelId: "level-2",
    roomId: "room-2",
    state: "on",
    params: {
      nominalPowerW: 1800,
      designFlow_kg_s: 0.08,
      supplyTemperatureC: 70,
      returnTemperatureC: 50,
      connectionType: "side",
      assignedSystemId: "heating-demo",
    },
    connectedNetworkIds: ["pipe-supply-main", "pipe-return-main"],
  },
];

const DEMO_PIPES: PipeNetwork[] = [
  {
    id: "pipe-supply-main",
    levelId: "level-1",
    path: [
      { x: 2.5, y: 2.5 },
      { x: 4, y: 2.5 },
      { x: 4, y: 1.2 },
      { x: 5, y: 1.2 },
      { x: 10, y: 1.2 },
      { x: 10, y: 13.8 },
      { x: 15, y: 13.8 },
    ],
    type: "heating_supply",
    heatingSystemId: "heating-demo",
    systemType: "heating",
    heatingSystemKind: "two_pipe",
    flowRole: "supply",
    circuitRole: "supply",
    segmentClass: "main",
    flowDirection: "forward",
    markingColor: "gost_supply",
    heatCarrier: "water",
    diameter_mm: 32,
    innerDiameter_mm: 28,
    material: "steel",
    insulationThickness_mm: 20,
    insulationConductivity_W_mK: 0.04,
    roughness_mm: 0.1,
    fluidTemperatureC: 70,
    designIndoorTemperatureC: 21,
    designOutdoorTemperatureC: -26,
    temperatureDropC: 20,
    flowRate_kg_s: 0.16,
    designVelocity_m_s: 0.7,
    pressurePa: 12000,
    pressureDropPa: 450,
    heatLossW: 95,
    connectedEquipmentIds: ["demo-boiler", "demo-pump", "demo-rad-1", "demo-rad-2"],
  },
  {
    id: "pipe-return-main",
    levelId: "level-1",
    path: [
      { x: 15, y: 13.1 },
      { x: 10, y: 13.1 },
      { x: 10, y: 0.8 },
      { x: 5, y: 0.8 },
      { x: 4, y: 0.8 },
      { x: 4, y: 2.5 },
      { x: 2.5, y: 2.5 },
    ],
    type: "heating_return",
    heatingSystemId: "heating-demo",
    systemType: "heating",
    heatingSystemKind: "two_pipe",
    flowRole: "return",
    circuitRole: "return",
    segmentClass: "main",
    flowDirection: "forward",
    markingColor: "gost_return",
    heatCarrier: "water",
    diameter_mm: 32,
    innerDiameter_mm: 28,
    material: "steel",
    insulationThickness_mm: 20,
    insulationConductivity_W_mK: 0.04,
    roughness_mm: 0.1,
    fluidTemperatureC: 50,
    designIndoorTemperatureC: 21,
    designOutdoorTemperatureC: -26,
    temperatureDropC: 20,
    flowRate_kg_s: 0.16,
    designVelocity_m_s: 0.55,
    pressurePa: 9000,
    pressureDropPa: 380,
    heatLossW: 82,
    connectedEquipmentIds: ["demo-boiler", "demo-pump", "demo-rad-1", "demo-rad-2"],
  },
];

function cloneModel<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildDemoModel(): BuildingModel {
  const model = cloneModel(sampleBuildingSP50);
  model.pipes = cloneModel(DEMO_PIPES);
  model.ducts = [];
  model.equipment = cloneModel(DEMO_EQUIPMENT);
  model.sensors = [];
  model.meta = {
    ...(model.meta ?? {}),
    demoScenarioId: "demo-vkr",
    demoScenarioName: "Демонстрационный пример",
  };
  return model;
}

export const demoVKRScenario: DemoVKRScenario = {
  id: "demo-vkr",
  name: "Демонстрационный пример",
  description:
    "Демонстрационный поток: оболочка, отопительная сеть, проверка по СП, нестационарный сценарий, вероятностная оценка риска и экономическая оценка.",
  model: buildDemoModel(),
  transientScenarioId: "heating_shutdown_6h",
  transientTargetId: "roof:roof-1",
  transientNodesPerLayer: 4,
  transientTimeStep_s: 10,
  transientDuration_s: 6 * 3600,
  transientComfortMin_C: 18,
  transientCriticalSurfaceTemperature_C: 12,
  monteCarloSamplesCount: 100,
  monteCarloSeed: 42,
  monteCarloParameters: DEMO_TRANSIENT_PARAMETERS,
  economicScenario: buildDefaultEconomicScenario(buildDemoSp50RunResult(buildDemoModel(), "demo-vkr").report),
};

export const DEMO_VKR_STEPS: Array<{ id: DemoVKRStepId; label: string }> = [
  { id: "geometry", label: "Геометрия и оболочка" },
  { id: "networks", label: "Инженерные сети" },
  { id: "sp50", label: "Проверка по СП" },
  { id: "transient", label: "Нестационарный расчёт" },
  { id: "uncertainty", label: "Неопределенности" },
  { id: "economics", label: "Экономическая оценка" },
  { id: "worstCase", label: "Худший сценарий" },
  { id: "conclusion", label: "Вывод" },
];

export function runDemoVKRScenario(scenario: DemoVKRScenario = demoVKRScenario): DemoVKRRunResult {
  const model = cloneModel(scenario.model);
  const warnings = new Set<string>();
  const sp50 = safeRunSp50(model, scenario.id, warnings);
  const transientTarget =
    listTransientConstructionTargets(model).find((entry) => entry.id === scenario.transientTargetId) ?? null;

  let transient: DemoVKRRunResult["transient"] = null;
  let monteCarlo: TransientMonteCarloResult | null = null;
  let economic: EconomicAssessmentResult | null = null;
  let worstCaseSample: TransientMonteCarloSample | null = null;
  let bestCaseSample: TransientMonteCarloSample | null = null;
  let medianSample: TransientMonteCarloSample | null = null;

  if (!transientTarget) {
    warnings.add("Для демонстрационного примера не найдена конструкция для нестационарного расчета.");
  } else {
    const baseScenario = buildTransientScenarioPreset(scenario.transientScenarioId, {
      duration_s: scenario.transientDuration_s,
      timeStep_s: scenario.transientTimeStep_s,
      initialTemperature_C: 20,
      innerTemperature_C: 20,
      reducedInnerTemperature_C: 15,
      outerTemperature_C: -18,
    });
    const transientRun = runTransientConstructionAnalysis({
      target: transientTarget,
      scenario: baseScenario,
      nodesPerLayer: scenario.transientNodesPerLayer,
      options: {
        scheme: "explicit",
        innerSurfaceLimit_C: scenario.transientComfortMin_C,
      },
    });
    transient = {
      result: transientRun.result,
      warnings: transientRun.warnings,
      missingData: transientRun.missingData,
    };
    transientRun.warnings.forEach((entry) => warnings.add(entry));
    transientRun.missingData.forEach((entry) => warnings.add(entry));
    if (transientRun.result && transientRun.layers.length) {
      monteCarlo = runTransientMonteCarlo(
        {
          baseScenarioId: baseScenario.id,
          constructionSourceId: transientTarget.sourceId,
          constructionSourceType: transientTarget.sourceType,
          samplesCount: scenario.monteCarloSamplesCount,
          seed: scenario.monteCarloSeed,
          parameters: scenario.monteCarloParameters,
          comfortMin_C: scenario.transientComfortMin_C,
          criticalSurfaceTemperature_C: scenario.transientCriticalSurfaceTemperature_C,
        },
        baseScenario,
        transientRun.layers
      );
      monteCarlo.warnings.forEach((entry) => warnings.add(entry));
      worstCaseSample = getTransientMonteCarloVisualizationSample(monteCarlo, "worst");
      bestCaseSample = getTransientMonteCarloVisualizationSample(monteCarlo, "best");
      medianSample = getTransientMonteCarloVisualizationSample(monteCarlo, "median");
    }
  }

  if (sp50?.report) {
    economic = runEconomicAssessment(sp50.report, scenario.economicScenario);
    economic.warnings.forEach((entry) => warnings.add(entry));
  }

  return {
    scenario,
    model,
    sp50,
    transientTarget,
    transient,
    monteCarlo,
    economic,
    worstCaseSample,
    bestCaseSample,
    medianSample,
    engineeringConclusion: buildDemoEngineeringConclusion({
      sp50,
      transient,
      monteCarlo,
      economic,
    }),
    warnings: Array.from(warnings),
  };
}

function safeRunSp50(model: BuildingModel, scenarioId: string, warnings: Set<string>): DemoSp50RunResult | null {
  try {
    return buildDemoSp50RunResult(model, scenarioId);
  } catch (error) {
    warnings.add(error instanceof Error ? error.message : "СП-проверка завершилась с ошибкой.");
    return null;
  }
}

function buildDemoEngineeringConclusion(input: {
  sp50: DemoSp50RunResult | null;
  transient: DemoVKRRunResult["transient"];
  monteCarlo: TransientMonteCarloResult | null;
  economic: EconomicAssessmentResult | null;
}): string {
  const failedConstructions =
    input.sp50?.report.constructions.filter((entry) => entry.status === "fail").map((entry) => entry.label) ?? [];
  const mainContributor = input.sp50?.topHeatLossContributors[0]?.label ?? "недостаточно данных";
  const transientIsUsable = Boolean(input.transient?.result?.valid && input.transient.result.stable);
  const minSurface = transientIsUsable && input.transient?.result
    ? formatMetric(input.transient.result.minInnerSurfaceTemperature)
    : "недостаточно данных";
  const monteCarloIsUsable = Boolean(input.monteCarlo && input.monteCarlo.summary.validSamplesCount > 0);
  const comfortRisk = monteCarloIsUsable && input.monteCarlo
    ? `${formatMetric(input.monteCarlo.summary.probabilityBelowComfort * 100)}%`
    : "недостаточно данных";
  const dominantParameter = monteCarloIsUsable ? input.monteCarlo?.sensitivity[0]?.parameterId ?? "недостаточно данных" : "недостаточно данных";
  const bestEconomicMeasure = input.economic?.measureResults[0] ?? null;
  const recommendation =
    input.sp50?.report.recommendations[0]?.title ??
    (failedConstructions.length ? `Усилить ${failedConstructions[0].toLowerCase()}.` : "Уточнить свойства ограждений и режим эксплуатации.");
  return [
    `СП: ${failedConstructions.length ? `не проходят ${failedConstructions.join(", ")}` : "критичных несоответствий по СП не выявлено"}.`,
    `Максимальный вклад в теплопотери: ${mainContributor}.`,
    transientIsUsable
      ? `Минимальная температура внутренней поверхности в нестационарном сценарии: ${minSurface} °C.`
      : `Нестационарный расчет признан неустойчивым или недостоверным. Количественные температуры по сценарию не используются до уменьшения шага времени или перехода на устойчивую схему.`,
    monteCarloIsUsable
      ? `Вероятность выхода ниже комфортного порога: ${comfortRisk}.`
      : "Вероятностная оценка риска не используется количественно, так как устойчивых сценариев недостаточно.",
    `Наиболее влияющий параметр риска: ${dominantParameter}.`,
    bestEconomicMeasure
      ? `Экономически приоритетное мероприятие: ${bestEconomicMeasure.measureName}, окупаемость около ${formatMetric(bestEconomicMeasure.payback_years ?? 0)} года.`
      : "Экономическая оценка: недостаточно данных.",
    `Рекомендация: ${sanitizeSentence(recommendation)}`,
  ].join(" ");
}

function sanitizeSentence(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "недостаточно данных.";
  }
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) {
    return "недостаточно данных";
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

export function getDemoHighlightEntity(model: BuildingModel): { roof: Roof | null; slab: FloorSlab | null } {
  return {
    roof: (model.roofs ?? [])[0] ?? null,
    slab: (model.floorSlabs ?? [])[0] ?? null,
  };
}
