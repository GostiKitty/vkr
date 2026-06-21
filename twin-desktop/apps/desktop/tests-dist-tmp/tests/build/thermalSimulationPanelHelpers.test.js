import { buildTransientConclusion, formatHistogramBinLabel, formatSafeNumber, formatSafePercent, formatSafeTemperature, formatTransientSampleViewModeLabel, hasUsableScenarioSummarySeries, hasUsableSensitivitySeries, sanitizeIndoorChartTemperature, selectTransientSampleByMode, shortenScenarioLabel, } from "../../src/features/build/components/ThermalSimulationPanel.js";
import { THERMAL_CALIBRATION_HELP_TEXT } from "../../src/features/build/components/ThermalCalibrationPanel.js";
import { THERMAL_MONTE_CARLO_HELP_TEXT } from "../../src/features/build/components/ThermalMonteCarloPanel.js";
import { test } from "../testHarness.js";
test("safeTemperatureFormat hides NaN, Infinity and unrealistic temperatures", () => {
    if (formatSafeTemperature(Number.NaN) !== "н/д") {
        throw new Error("NaN temperature should not be shown in UI.");
    }
    if (formatSafeTemperature(Number.POSITIVE_INFINITY) !== "н/д") {
        throw new Error("Infinite temperature should not be shown in UI.");
    }
    if (formatSafeTemperature(1e88) !== "расчет неустойчив") {
        throw new Error("Exploded temperature should be marked as unstable.");
    }
});
test("safe number and percent formatting suppress unstable values", () => {
    if (formatSafeNumber(1e12) !== "н/д") {
        throw new Error("Huge numeric values should not stretch KPI cards.");
    }
    if (formatSafePercent(Number.NaN) !== "н/д") {
        throw new Error("Invalid probability should be hidden in UI.");
    }
    if (formatSafePercent(5) !== "за пределами шкалы") {
        throw new Error("Exploded percent values should be clipped in UI.");
    }
});
test("unstable transient conclusion does not contain physically impossible temperatures", () => {
    const result = {
        scenarioId: "unstable",
        stable: false,
        valid: false,
        scheme: "explicit",
        warnings: ["Явная схема неустойчива."],
        nodes: [],
        time: [0],
        temperature: [],
        innerSurfaceTemperature: [],
        outerSurfaceTemperature: [],
        minTemperature: Number.NaN,
        maxTemperature: Number.NaN,
        minInnerSurfaceTemperature: Number.NaN,
        maxInnerSurfaceTemperature: Number.NaN,
        metadata: {
            requestedTimeStep_s: 8000,
            usedTimeStep_s: 8000,
            stabilityLimit_s: 690,
            stabilityRatioMax: 5.211,
            requestedScheme: "explicit",
            invalidReason: "Явная схема неустойчива.",
        },
    };
    const conclusion = buildTransientConclusion(result, null);
    if (!conclusion.includes("неустойчив")) {
        throw new Error("Unstable transient result should be explained explicitly.");
    }
    if (conclusion.includes("285036") || conclusion.includes("e+")) {
        throw new Error("Unstable conclusion must not leak exploded numeric temperatures.");
    }
});
test("scenario labels are shortened for charts", () => {
    const labels = [
        "Базовый сценарий",
        "Наружная температура -5°C",
        "Замена окон и герметизация",
        "Утепление стен 150 мм",
        "Повышенный воздухообмен",
        "Пользовательский сценарий",
    ].map(shortenScenarioLabel);
    const expected = ["Базовый", "Наружная -5°C", "Замена окон", "Утепление стен", "Воздухообмен", "Пользовательский"];
    if (JSON.stringify(labels) !== JSON.stringify(expected)) {
        throw new Error(`Unexpected compact scenario labels: ${JSON.stringify(labels)}`);
    }
});
test("histogram labels are rounded and compact", () => {
    const label = formatHistogramBinLabel(18.81818181818, 19.22222222222);
    if (label !== "18,8–19,2") {
        throw new Error(`Unexpected histogram label: ${label}`);
    }
});
test("transient sample mode labels are user-facing", () => {
    if (formatTransientSampleViewModeLabel("worst") !== "наихудший сценарий") {
        throw new Error("Worst-case label should be localized.");
    }
    if (formatTransientSampleViewModeLabel("best") !== "лучший сценарий") {
        throw new Error("Best-case label should be localized.");
    }
});
test("sample selector returns worst, median and best samples without undefined", () => {
    const result = {
        samples: [],
        summary: {
            samplesCount: 3,
            validSamplesCount: 3,
            stableSamplesCount: 3,
            unstableSamplesCount: 0,
            probabilityBelowComfort: 0,
            probabilityBelowCriticalSurface: 0,
            p05MinTemperature: 18,
            p50MinTemperature: 19,
            p95MinTemperature: 20,
            worstCaseSample: { index: 0 },
            bestCaseSample: { index: 2 },
            medianSample: { index: 1 },
        },
        sensitivity: [],
        warnings: [],
    };
    if (selectTransientSampleByMode(result, "worst")?.index !== 0) {
        throw new Error("Worst-case selection should return the worst sample.");
    }
    if (selectTransientSampleByMode(result, "median")?.index !== 1) {
        throw new Error("Median selection should return the median sample.");
    }
    if (selectTransientSampleByMode(result, "best")?.index !== 2) {
        throw new Error("Best-case selection should return the best sample.");
    }
});
test("indoor chart temperature rejects physically suspicious values", () => {
    if (sanitizeIndoorChartTemperature(24) !== 24) {
        throw new Error("Normal indoor temperature should stay visible on charts.");
    }
    if (sanitizeIndoorChartTemperature(128) !== null) {
        throw new Error("Exploded indoor temperature must not be plotted as a valid room temperature.");
    }
});
test("scenario comparison helper hides empty bars when all values are invalid", () => {
    if (hasUsableScenarioSummarySeries([{ peak: null, energy: null }])) {
        throw new Error("Scenario chart should not render as valid when all bars are empty.");
    }
    if (!hasUsableScenarioSummarySeries([{ peak: 12, energy: null }])) {
        throw new Error("Scenario chart should render when at least one valid bar exists.");
    }
});
test("sensitivity helper treats near-zero or missing impact as empty state", () => {
    if (hasUsableSensitivitySeries([{ value: 0, impact: 0 }])) {
        throw new Error("Sensitivity chart should not render as valid when all impacts are effectively zero.");
    }
    if (!hasUsableSensitivitySeries([{ value: 12, impact: 0.4 }])) {
        throw new Error("Sensitivity chart should render when there is a meaningful impact.");
    }
});
test("Monte Carlo and calibration blocks expose user-facing Russian explanations", () => {
    if (!THERMAL_MONTE_CARLO_HELP_TEXT.includes("Метод Монте-Карло")) {
        throw new Error("Monte Carlo block should explain the method in Russian.");
    }
    if (!THERMAL_CALIBRATION_HELP_TEXT.includes("реальному зданию")) {
        throw new Error("Calibration block should explain why monthly data calibration is needed.");
    }
});
