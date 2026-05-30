import { buildTransientVisualizationFrame } from "../../src/features/build/thermal/transientVisualization.js";
import { demoVKRScenario, runDemoVKRScenario } from "../../src/demo/demoVKRScenario.js";
import { test } from "../testHarness.js";
test("demoVKRScenario is created with model, transient and Monte Carlo settings", () => {
    if (!demoVKRScenario.model.walls.length || !demoVKRScenario.model.pipes.length || !demoVKRScenario.model.equipment.length) {
        throw new Error("Demo VKR scenario should include geometry and heating network.");
    }
    if (!demoVKRScenario.transientScenarioId || demoVKRScenario.monteCarloSamplesCount <= 0 || !demoVKRScenario.economicScenario.measures.length) {
        throw new Error("Demo VKR scenario should include transient, Monte Carlo and economic configuration.");
    }
});
test("demo VKR runs SP50, transient and Monte Carlo together", () => {
    const result = runDemoVKRScenario();
    if (!result.sp50?.report) {
        throw new Error("Demo VKR should run SP50 compliance.");
    }
    if (!result.transient?.result) {
        throw new Error("Demo VKR should run transient scenario.");
    }
    if (!result.monteCarlo?.summary) {
        throw new Error("Demo VKR should run transient Monte Carlo and return summary.");
    }
    if (!result.economic?.summary) {
        throw new Error("Demo VKR should run economic assessment and return summary.");
    }
});
test("worst sample from demo VKR can be sent to transient visualization", () => {
    const result = runDemoVKRScenario();
    if (!result.worstCaseSample || !result.transientTarget) {
        throw new Error("Demo VKR should expose worst-case sample and transient target.");
    }
    const frame = buildTransientVisualizationFrame({
        result: result.worstCaseSample.transientResult,
        timeIndex: result.worstCaseSample.selectedTimeIndex,
        sourceId: result.transientTarget.sourceId,
        sourceType: result.transientTarget.sourceType,
    });
    if (!frame || frame.sourceId !== result.transientTarget.sourceId) {
        throw new Error("Worst-case sample should be mappable into 2D/3D transient visualization.");
    }
});
test("demo VKR engineering conclusion is clean and finite", () => {
    const result = runDemoVKRScenario();
    if (!result.engineeringConclusion.trim()) {
        throw new Error("Demo VKR should generate a short engineering conclusion.");
    }
    const invalidFragments = ["undefined", "null", "NaN", "e+", "E+"];
    if (invalidFragments.some((fragment) => result.engineeringConclusion.includes(fragment))) {
        throw new Error("Demo VKR conclusion should not contain undefined/null/NaN.");
    }
});
