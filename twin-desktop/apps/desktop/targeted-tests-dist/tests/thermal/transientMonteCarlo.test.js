import { getTransientMonteCarloVisualizationSample, runTransientMonteCarlo, } from "../../src/core/thermal/transient/index.js";
import { buildTransientScenarioPreset } from "../../src/core/thermal/transient/scenarios.js";
import { test } from "../testHarness.js";
const WALL_LAYERS = [
    {
        id: "brick",
        materialId: "ceramic_brick",
        name: "Brick",
        thickness_m: 0.25,
        lambda_W_mK: 0.81,
        density_kg_m3: 1800,
        heatCapacity_J_kgK: 840,
        nodesCount: 4,
    },
    {
        id: "wool",
        materialId: "mineral_wool",
        name: "Mineral wool",
        thickness_m: 0.12,
        lambda_W_mK: 0.045,
        density_kg_m3: 120,
        heatCapacity_J_kgK: 840,
        nodesCount: 3,
    },
];
const VARIED_PARAMETERS = [
    {
        id: "outdoor-offset",
        name: "Outdoor offset",
        target: "outdoorTemperatureOffset",
        distribution: { kind: "uniform", min: -4, max: 4 },
    },
    {
        id: "lambda",
        name: "Lambda multiplier",
        target: "lambdaMultiplier",
        distribution: { kind: "triangular", min: 0.9, mode: 1, max: 1.1 },
    },
];
test("runTransientMonteCarlo returns the requested number of samples", () => {
    const scenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3 * 3600, timeStep_s: 60 });
    const result = runTransientMonteCarlo({
        baseScenarioId: scenario.id,
        constructionSourceId: "wall-1",
        constructionSourceType: "wall",
        samplesCount: 25,
        seed: 11,
        parameters: VARIED_PARAMETERS,
        comfortMin_C: 18,
        criticalSurfaceTemperature_C: 12,
    }, scenario, WALL_LAYERS);
    if (result.samples.length !== 25) {
        throw new Error("Transient Monte Carlo must return the requested sample count.");
    }
});
test("seed makes transient Monte Carlo reproducible", () => {
    const scenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 2 * 3600, timeStep_s: 60 });
    const left = runTransientMonteCarlo({
        baseScenarioId: scenario.id,
        constructionSourceId: "wall-1",
        constructionSourceType: "wall",
        samplesCount: 12,
        seed: 77,
        parameters: VARIED_PARAMETERS,
        comfortMin_C: 18,
    }, scenario, WALL_LAYERS);
    const right = runTransientMonteCarlo({
        baseScenarioId: scenario.id,
        constructionSourceId: "wall-1",
        constructionSourceType: "wall",
        samplesCount: 12,
        seed: 77,
        parameters: VARIED_PARAMETERS,
        comfortMin_C: 18,
    }, scenario, WALL_LAYERS);
    if (JSON.stringify(left.samples.map((entry) => entry.parameters)) !==
        JSON.stringify(right.samples.map((entry) => entry.parameters)) ||
        left.summary.p50MinTemperature !== right.summary.p50MinTemperature) {
        throw new Error("Transient Monte Carlo with the same seed should be reproducible.");
    }
});
test("probabilityBelowComfort is computed correctly for deterministically cold scenario", () => {
    const scenario = buildTransientScenarioPreset("heating_shutdown_6h", {
        duration_s: 2 * 3600,
        timeStep_s: 60,
        reducedInnerTemperature_C: 12,
        outerTemperature_C: -24,
    });
    const result = runTransientMonteCarlo({
        baseScenarioId: scenario.id,
        constructionSourceId: "wall-1",
        constructionSourceType: "wall",
        samplesCount: 8,
        seed: 5,
        parameters: [],
        comfortMin_C: 18,
        criticalSurfaceTemperature_C: 10,
    }, scenario, WALL_LAYERS);
    if (result.summary.probabilityBelowComfort !== 1) {
        throw new Error("Deterministically cold scenario should always fall below comfort in this test.");
    }
});
test("unstable samples do not break summary", () => {
    const scenario = buildTransientScenarioPreset("cold_snap_24h", {
        duration_s: 3600,
        timeStep_s: 8000,
    });
    const result = runTransientMonteCarlo({
        baseScenarioId: scenario.id,
        constructionSourceId: "wall-1",
        constructionSourceType: "wall",
        samplesCount: 6,
        seed: 2,
        parameters: [],
        comfortMin_C: 18,
    }, scenario, WALL_LAYERS);
    if (result.summary.unstableSamplesCount !== 6 || result.summary.stableSamplesCount !== 0) {
        throw new Error("Unstable transient samples should be counted separately without breaking the summary.");
    }
    if (result.summary.validSamplesCount !== 0) {
        throw new Error("Numerically unstable transient samples must not be counted as valid in Monte Carlo summary.");
    }
    if (Number.isFinite(result.summary.p50MinTemperature) || result.summary.worstCaseSample !== null) {
        throw new Error("When all transient samples are unstable, P05/P50/P95 and worst-case selection must be disabled.");
    }
    if (!result.warnings.some((entry) => entry.includes("устойчив"))) {
        throw new Error("Unstable explicit samples should add a warning to Monte Carlo output.");
    }
});
test("worstCaseSample is determined for transient Monte Carlo", () => {
    const scenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3 * 3600, timeStep_s: 60 });
    const result = runTransientMonteCarlo({
        baseScenarioId: scenario.id,
        constructionSourceId: "wall-1",
        constructionSourceType: "wall",
        samplesCount: 20,
        seed: 9,
        parameters: VARIED_PARAMETERS,
        comfortMin_C: 18,
    }, scenario, WALL_LAYERS);
    const worst = result.summary.worstCaseSample;
    const best = result.summary.bestCaseSample;
    if (!worst || !best) {
        throw new Error("Monte Carlo summary should expose worst and best cases.");
    }
    if (worst.minInnerSurfaceTemperature_C > best.minInnerSurfaceTemperature_C) {
        throw new Error("Worst case should have the lowest minimum inner-surface temperature.");
    }
});
test("sensitivity does not contain NaN values", () => {
    const scenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3 * 3600, timeStep_s: 60 });
    const result = runTransientMonteCarlo({
        baseScenarioId: scenario.id,
        constructionSourceId: "wall-1",
        constructionSourceType: "wall",
        samplesCount: 18,
        seed: 101,
        parameters: [
            ...VARIED_PARAMETERS,
            {
                id: "initial",
                name: "Initial offset",
                target: "initialTemperatureOffset",
                distribution: { kind: "normal", mean: 0, std: 1 },
            },
        ],
        comfortMin_C: 18,
    }, scenario, WALL_LAYERS);
    if (result.sensitivity.some((entry) => !Number.isFinite(entry.correlationApprox))) {
        throw new Error("Transient Monte Carlo sensitivity should not contain NaN correlations.");
    }
});
test("visualization sample helper is safe without data", () => {
    if (getTransientMonteCarloVisualizationSample(null, "worst") !== null) {
        throw new Error("Visualization sample helper should return null when no result is available.");
    }
});
test("visualization sample helper returns best-case sample when requested", () => {
    const scenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3 * 3600, timeStep_s: 60 });
    const result = runTransientMonteCarlo({
        baseScenarioId: scenario.id,
        constructionSourceId: "wall-1",
        constructionSourceType: "wall",
        samplesCount: 14,
        seed: 12,
        parameters: VARIED_PARAMETERS,
        comfortMin_C: 18,
    }, scenario, WALL_LAYERS);
    const best = getTransientMonteCarloVisualizationSample(result, "best");
    if (!best || best.index !== result.summary.bestCaseSample?.index) {
        throw new Error("Visualization sample helper should expose the best-case transient sample.");
    }
});
