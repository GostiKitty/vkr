import { buildDemoSp50RunResult } from "./sampleBuildingSP50";
import { buildTransientScenarioPreset, getTransientMonteCarloVisualizationSample, listTransientConstructionTargets, runTransientConstructionAnalysis, runTransientMonteCarlo, } from "../core/thermal/transient/index";
import { buildVideoDemoHouseModel, buildVideoDemoThermalResult, VIDEO_DEMO_ROOM_TEMPERATURES, videoDemoHouse, } from "./videoDemoHouse";
export const VIDEO_DEMO_STEPS = [
    { id: "plan", label: "План дома" },
    { id: "view3d", label: "3D-модель" },
    { id: "networks", label: "Инженерные сети" },
    { id: "temperature", label: "Температурное поле" },
    { id: "sp50", label: "Проверка по СП" },
    { id: "transient", label: "Нестационарный сценарий" },
    { id: "uncertainty", label: "Неопределенности" },
    { id: "conclusion", label: "Итоговые рекомендации" },
];
const VIDEO_TRANSIENT_PARAMETERS = [
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
function cloneDeep(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
function buildVideoDemoModel() {
    const model = buildVideoDemoHouseModel();
    model.meta = {
        ...(model.meta ?? {}),
        demoScenarioId: "video-demo",
        demoScenarioName: "Демонстрационный дом",
    };
    return model;
}
export const videoDemoScenario = {
    id: "video-demo",
    name: "Демонстрационный дом",
    description: "Автоматически открывает подготовленный пример и последовательно показывает геометрию, инженерные сети, проверку по СП, нестационарный расчет, вероятностную оценку риска и экономику энергосбережения.",
    model: buildVideoDemoModel(),
    thermalResult: buildVideoDemoThermalResult(videoDemoHouse),
    transientScenarioId: "heating_shutdown_6h",
    transientTargetId: "roof:video-roof-1",
    transientNodesPerLayer: 4,
    transientTimeStep_s: 10,
    transientDuration_s: 6 * 3600,
    transientComfortMin_C: 18,
    transientCriticalSurfaceTemperature_C: 12,
    monteCarloSamplesCount: 100,
    monteCarloSeed: 20240504,
    monteCarloParameters: VIDEO_TRANSIENT_PARAMETERS,
};
function safeRunSp50(model, scenarioId, warnings) {
    try {
        return buildDemoSp50RunResult(model, scenarioId);
    }
    catch (error) {
        warnings.add(error instanceof Error ? error.message : "Не удалось выполнить СП-проверку для демонстрационного примера.");
        return null;
    }
}
function buildEngineeringConclusion(result) {
    const roomAverage = Object.values(VIDEO_DEMO_ROOM_TEMPERATURES).reduce((sum, value) => sum + value, 0) /
        Math.max(Object.keys(VIDEO_DEMO_ROOM_TEMPERATURES).length, 1);
    const parts = [
        `Демонстрационный дом подготовлен для показа: комнатная температура держится около ${roomAverage.toFixed(1)} °C без смещения 3D-заливки.`,
    ];
    if (result.sp50?.report) {
        parts.push(`По СП получены конечные показатели R, kоб и Qгод без пропусков; основные теплопотери сосредоточены в наружных стенах, окнах и покрытии.`);
    }
    if (result.transient?.result) {
        const transientResult = result.transient.result;
        const lastIndex = Math.max(0, transientResult.innerSurfaceTemperature.length - 1);
        const finalInnerSurface = transientResult.innerSurfaceTemperature[lastIndex] ?? Number.NaN;
        if (transientResult.valid && transientResult.stable && Number.isFinite(finalInnerSurface)) {
            parts.push(`Сценарий отключения отопления на 6 часов отрабатывает устойчиво: минимальная внутренняя температура поверхности к концу расчета составляет ${finalInnerSurface.toFixed(1)} °C.`);
        }
        else {
            parts.push("Нестационарный сценарий признан неустойчивым или недостоверным, поэтому количественные температуры не используются в выводе.");
        }
    }
    if (result.monteCarlo?.summary?.validSamplesCount) {
        const probabilityBelowComfort = result.monteCarlo.summary.probabilityBelowComfort * 100;
        parts.push(`Вероятностная оценка риска на 100 испытаний воспроизводима: риск выхода ниже комфортной температуры оценивается в ${probabilityBelowComfort.toFixed(0)} %, диапазон p05/p50/p95 равен ${result.monteCarlo.summary.p05MinTemperature.toFixed(1)} / ${result.monteCarlo.summary.p50MinTemperature.toFixed(1)} / ${result.monteCarlo.summary.p95MinTemperature.toFixed(1)} °C.`);
    }
    else if (result.monteCarlo?.summary) {
        parts.push("Вероятностная оценка риска не дала достаточного числа устойчивых сценариев, поэтому вероятностные температуры не используются количественно.");
    }
    return parts.join(" ");
}
export function runVideoDemoScenario(scenario = videoDemoScenario) {
    const model = cloneDeep(scenario.model);
    const thermalResult = cloneDeep(scenario.thermalResult);
    const warnings = new Set();
    const sp50 = safeRunSp50(model, scenario.id, warnings);
    const transientTarget = listTransientConstructionTargets(model).find((entry) => entry.id === scenario.transientTargetId) ?? null;
    let transient = null;
    let monteCarlo = null;
    let worstCaseSample = null;
    let bestCaseSample = null;
    let medianSample = null;
    if (!transientTarget) {
        warnings.add("Для демонстрационного примера не найдена конструкция для нестационарного расчета.");
    }
    else {
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
            monteCarlo = runTransientMonteCarlo({
                baseScenarioId: baseScenario.id,
                constructionSourceId: transientTarget.sourceId,
                constructionSourceType: transientTarget.sourceType,
                samplesCount: scenario.monteCarloSamplesCount,
                seed: scenario.monteCarloSeed,
                parameters: scenario.monteCarloParameters,
                comfortMin_C: scenario.transientComfortMin_C,
                criticalSurfaceTemperature_C: scenario.transientCriticalSurfaceTemperature_C,
            }, baseScenario, transientRun.layers);
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
