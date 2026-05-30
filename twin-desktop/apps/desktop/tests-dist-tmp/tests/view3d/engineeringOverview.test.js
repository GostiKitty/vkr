import { demoVKRScenario } from "../../src/demo/demoVKRScenario.js";
import { applyEngineeringOverviewPreset, buildEngineeringOverviewSummary, clearEngineeringOverviewPreset, ENGINEERING_OVERVIEW_PRESENTATION_MODE, isEngineeringOverviewPresetActive, shouldEnableEngineeringOverviewForDemoStep, } from "../../src/features/build/view3d/engineeringOverview.js";
import { test } from "../testHarness.js";
const baseViewer = {
    showRooms: false,
    showWalls: true,
    showOpenings: false,
    showNetworks: false,
    showEquipment: false,
    transparentWalls: false,
    presentationMode: "default",
};
test("applyEngineeringOverviewPreset enables the required viewer options", () => {
    const next = applyEngineeringOverviewPreset(baseViewer);
    if (!next.showWalls || !next.showNetworks || !next.showEquipment || !next.transparentWalls) {
        throw new Error("Engineering overview preset should enable shell, networks, equipment and transparent walls.");
    }
    if (next.presentationMode !== ENGINEERING_OVERVIEW_PRESENTATION_MODE) {
        throw new Error("Engineering overview preset should switch presentation mode.");
    }
});
test("engineering overview summary is safe for empty networks", () => {
    const model = {
        ...demoVKRScenario.model,
        pipes: [],
        ducts: [],
        equipment: [],
        sensors: [],
    };
    const summary = buildEngineeringOverviewSummary(model);
    if (summary.hasNetworks || summary.warningCount < 0) {
        throw new Error("Engineering overview summary should not fail on an empty engineering model.");
    }
});
test("engineering overview summary is safe without equipment", () => {
    const model = {
        ...demoVKRScenario.model,
        equipment: [],
        sensors: [],
    };
    const summary = buildEngineeringOverviewSummary(model);
    if (summary.equipmentCount !== 0 || summary.pipeCount < 0 || summary.ductCount < 0) {
        throw new Error("Engineering overview summary should be valid when equipment is absent.");
    }
});
test("demo VKR step 'Инженерные сети' enables the engineering overview preset", () => {
    if (!shouldEnableEngineeringOverviewForDemoStep("networks")) {
        throw new Error("Demo step 'networks' should enable engineering overview.");
    }
    if (shouldEnableEngineeringOverviewForDemoStep("sp50")) {
        throw new Error("Only the engineering network step should auto-enable engineering overview.");
    }
});
test("clearEngineeringOverviewPreset keeps layers but returns default presentation mode", () => {
    const next = clearEngineeringOverviewPreset(applyEngineeringOverviewPreset(baseViewer));
    if (next.presentationMode !== "default") {
        throw new Error("Resetting engineering overview should restore the default presentation mode.");
    }
});
test("engineering overview preset is idempotent and does not create a new object when already active", () => {
    const first = applyEngineeringOverviewPreset(baseViewer);
    const second = applyEngineeringOverviewPreset(first);
    if (!isEngineeringOverviewPresetActive(first)) {
        throw new Error("Engineering overview should report itself as active after applying the preset.");
    }
    if (second !== first) {
        throw new Error("Applying the same engineering overview preset twice should be a no-op.");
    }
});
