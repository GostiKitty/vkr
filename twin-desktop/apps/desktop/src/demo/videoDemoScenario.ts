import type { BuildingModel } from "../entities/geometry/types";
/**
 * Legacy compatibility module.
 * User-facing code should import canonical demo scenario symbols from `demoHouseScenario.ts`.
 */
import { buildDemoSp50RunResult, type DemoSp50RunResult } from "./sampleBuildingSP50";
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
import type { ThermalSimulationResult } from "../core/thermal/solver";
import {
  buildVideoDemoHouseModel,
  buildVideoDemoThermalResult,
  VIDEO_DEMO_ROOM_TEMPERATURES,
  videoDemoHouse,
} from "./videoDemoHouse";

export type VideoDemoStepId =
  | "plan"
  | "view3d"
  | "networks"
  | "temperature"
  | "sp50"
  | "transient"
  | "uncertainty"
  | "conclusion";

export interface VideoDemoScenario {
  id: string;
  name: string;
  description: string;
  model: BuildingModel;
  thermalResult: ThermalSimulationResult;
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
}

export interface VideoDemoRunResult {
  scenario: VideoDemoScenario;
  model: BuildingModel;
  thermalResult: ThermalSimulationResult;
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
  worstCaseSample: TransientMonteCarloSample | null;
  bestCaseSample: TransientMonteCarloSample | null;
  medianSample: TransientMonteCarloSample | null;
  engineeringConclusion: string;
  warnings: string[];
}

export const VIDEO_DEMO_STEPS: Array<{ id: VideoDemoStepId; label: string }> = [
  { id: "plan", label: "План дома" },
  { id: "view3d", label: "3D-модель" },
  { id: "networks", label: "Инженерные сети" },
  { id: "temperature", label: "Температурное поле" },
  { id: "sp50", label: "Проверка по СП" },
  { id: "transient", label: "Нестационарный сценарий" },
  { id: "uncertainty", label: "Неопределенности" },
  { id: "conclusion", label: "Итоговые рекомендации" },
];

const VIDEO_TRANSIENT_PARAMETERS: TransientUncertaintyParameter[] = [
  {
    id: "outdoor-offset",
    name: "Наружная температура",
    target: "outdoorTemperatureOffset",
    distribution: { kind: "uniform", min: -3, max: 3 },
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
    distribution: { kind: "uniform", min: 0.9, max: 1.1 },
  },
];

function cloneDeep<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildVideoDemoModel(): BuildingModel {
  const model = buildVideoDemoHouseModel();
  model.meta = {
    ...(model.meta ?? {}),
    demoScenarioId: "video-demo",
    demoScenarioName: "Демонстрационный дом",
  };
  return model;
}

export const videoDemoScenario: VideoDemoScenario = {
  id: "video-demo",
  name: "Демонстрационный дом",
  description:
    "Двухэтажный демонстрационный дом с кровлей, тепловым пунктом, отоплением, вентиляцией, датчиками и полным инженерным циклом расчёта.",
  model: buildVideoDemoModel(),
  thermalResult: buildVideoDemoThermalResult(videoDemoHouse),
  transientScenarioId: "heating_shutdown_6h",
  transientTargetId: "roof:video-roof-main",
  transientNodesPerLayer: 4,
  transientTimeStep_s: 10,
  transientDuration_s: 6 * 3600,
  transientComfortMin_C: 18,
  transientCriticalSurfaceTemperature_C: 12,
  monteCarloSamplesCount: 100,
  monteCarloSeed: 20240504,
  monteCarloParameters: VIDEO_TRANSIENT_PARAMETERS,
};

function safeRunSp50(model: BuildingModel, scenarioId: string, warnings: Set<string>) {
  try {
    return buildDemoSp50RunResult(model, scenarioId);
  } catch (error) {
    warnings.add(error instanceof Error ? error.message : "Не удалось выполнить СП-проверку для демонстрационного примера.");
    return null;
  }
}

function buildEngineeringConclusion(result: {
  sp50: DemoSp50RunResult | null;
  monteCarlo: TransientMonteCarloResult | null;
  transient: VideoDemoRunResult["transient"];
}) {
  const roomAverage =
    Object.values(VIDEO_DEMO_ROOM_TEMPERATURES).reduce((sum, value) => sum + value, 0) /
    Math.max(Object.keys(VIDEO_DEMO_ROOM_TEMPERATURES).length, 1);
  const parts = [
    `Демонстрационный дом подготовлен для показа: комнатная температура держится около ${roomAverage.toFixed(1)} °C без смещения 3D-заливки.`,
  ];
  if (result.sp50?.report) {
    parts.push(
      `По СП получены конечные показатели R, kоб и Qгод без пропусков; основные теплопотери сосредоточены в наружных стенах, окнах и покрытии.`
    );
  }
  if (result.transient?.result) {
    const transientResult = result.transient.result;
    const lastIndex = Math.max(0, transientResult.innerSurfaceTemperature.length - 1);
    const finalInnerSurface = transientResult.innerSurfaceTemperature[lastIndex] ?? Number.NaN;
    if (transientResult.valid && transientResult.stable && Number.isFinite(finalInnerSurface)) {
      parts.push(
        `Сценарий отключения отопления на 6 часов отрабатывает устойчиво: минимальная внутренняя температура поверхности к концу расчета составляет ${finalInnerSurface.toFixed(1)} °C.`
      );
    } else {
      parts.push(
        "Нестационарный сценарий признан неустойчивым или недостоверным, поэтому количественные температуры не используются в выводе."
      );
    }
  }
  if (result.monteCarlo?.summary?.validSamplesCount) {
    const probabilityBelowComfort = result.monteCarlo.summary.probabilityBelowComfort * 100;
    parts.push(
      `Вероятностная оценка риска на 100 испытаний воспроизводима: риск выхода ниже комфортной температуры оценивается в ${probabilityBelowComfort.toFixed(0)} %, диапазон p05/p50/p95 равен ${result.monteCarlo.summary.p05MinTemperature.toFixed(1)} / ${result.monteCarlo.summary.p50MinTemperature.toFixed(1)} / ${result.monteCarlo.summary.p95MinTemperature.toFixed(1)} °C.`
    );
  } else if (result.monteCarlo?.summary) {
    parts.push("Вероятностная оценка риска не дала достаточного числа устойчивых сценариев, поэтому вероятностные температуры не используются количественно.");
  }
  return parts.join(" ");
}

export function runVideoDemoScenario(scenario: VideoDemoScenario = videoDemoScenario): VideoDemoRunResult {
  const model = cloneDeep(scenario.model);
  const thermalResult = cloneDeep(scenario.thermalResult);
  const warnings = new Set<string>();
  const sp50 = safeRunSp50(model, scenario.id, warnings);
  const transientTarget =
    listTransientConstructionTargets(model).find((entry) => entry.id === scenario.transientTargetId) ?? null;

  let transient: VideoDemoRunResult["transient"] = null;
  let monteCarlo: TransientMonteCarloResult | null = null;
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

  return {
    scenario,
    model,
    thermalResult,
    sp50,
    transientTarget,
    transient,
    monteCarlo,
    worstCaseSample,
    bestCaseSample,
    medianSample,
    engineeringConclusion: buildEngineeringConclusion({ sp50, monteCarlo, transient }),
    warnings: [...warnings],
  };
}
