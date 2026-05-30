import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { createDefaultScenarioConfig } from "../../src/entities/workflow/workflow.store.js";
import { applySp131ClimateToModel } from "../../src/core/thermal/climate/ensureModelClimate.js";
import { buildSourceDataWorkspaceReport, prepareModelForSourceData, } from "../../src/core/thermal/derived/sourceDataWorkspace.js";
import { aggregateEnvelopeBridgeConductances } from "../../src/demo/deriveExteriorWallThermalBridges.js";
import { buildPreparedVideoDemoProject } from "../../src/features/build/demoVideoProject.js";
import { test } from "../testHarness.js";
function buildSimpleInsulatedHouse() {
    const model = createEmptyBuildingModel();
    const levelId = "lvl-1";
    const wallLayers = [
        { materialId: "aerated_concrete", thickness_m: 0.3 },
        { materialId: "mineral_wool", thickness_m: 0.12 },
        { materialId: "gypsum_plaster", thickness_m: 0.015 },
    ];
    model.levels = [{ id: levelId, name: "Этаж 1", elevation_m: 0, height_m: 3 }];
    model.rooms = [
        {
            id: "room-1",
            levelId,
            name: "Помещение",
            polygon: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 8 },
                { x: 0, y: 8 },
            ],
            source: "manual",
        },
    ];
    model.walls = [
        { id: "w-n", levelId, a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, height_m: 3, thickness_m: 0.3, layers: wallLayers, envelopePresetId: "wall-exterior-aerated-insulated" },
        { id: "w-e", levelId, a: { x: 10, y: 0 }, b: { x: 10, y: 8 }, height_m: 3, thickness_m: 0.3, layers: wallLayers, envelopePresetId: "wall-exterior-aerated-insulated" },
        { id: "w-s", levelId, a: { x: 10, y: 8 }, b: { x: 0, y: 8 }, height_m: 3, thickness_m: 0.3, layers: wallLayers, envelopePresetId: "wall-exterior-aerated-insulated" },
        { id: "w-w", levelId, a: { x: 0, y: 8 }, b: { x: 0, y: 0 }, height_m: 3, thickness_m: 0.3, layers: wallLayers, envelopePresetId: "wall-exterior-aerated-insulated" },
    ];
    model.windows = [
        {
            id: "win-1",
            anchor: { wallId: "w-n", t: 0.5, offset_m: 0 },
            width_m: 1.5,
            height_m: 1.4,
            sill_m: 0.9,
            envelopePresetId: "window-pvc-double",
        },
    ];
    return model;
}
function averageCompletenessPercent(report) {
    if (!report.summaryCards.length) {
        return 0;
    }
    return Math.round(report.summaryCards.reduce((sum, card) => sum + card.completionPercent, 0) / report.summaryCards.length);
}
function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}
test("demo source-data workspace is populated for presentation, climate, and CO2", () => {
    const demo = buildPreparedVideoDemoProject();
    const report = buildSourceDataWorkspaceReport({
        model: demo.model,
        scenarioConfig: demo.scenarioConfig,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const uEqField = report.sections.materials.computedFields.find((field) => field.key === "materials.u-eq");
    if (!uEqField || typeof uEqField.value !== "number" || !(uEqField.value > 0)) {
        throw new Error("Demo report should expose an automatically calculated U_eq.");
    }
    if (uEqField.source !== "calculated") {
        throw new Error("U_eq should be marked as automatically calculated.");
    }
    const completeness = averageCompletenessPercent(report);
    if (completeness < 90) {
        throw new Error(`Demo source data completeness should stay above 90%, got ${completeness}%.`);
    }
    const validationStatus = report.sections.validation.computedFields.find((field) => field.key === "validation.status");
    if (!validationStatus || validationStatus.value !== "unavailable") {
        throw new Error("Demo report should explicitly mark validation as unavailable.");
    }
    const validationOrigin = report.sections.validation.computedFields.find((field) => field.key === "validation.origin");
    if (!validationOrigin || validationOrigin.value !== "synthetic") {
        throw new Error("Demo validation should explicitly identify synthetic/demo sensors.");
    }
    const climateDesign = report.sections.climate.computedFields.find((field) => field.key === "climate.design-outdoor");
    const climateDuration = report.sections.climate.computedFields.find((field) => field.key === "climate.heating-duration");
    const climateGsop = report.sections.climate.computedFields.find((field) => field.key === "climate.gsop");
    if (climateDesign?.value !== -26 || climateDuration?.value !== 214) {
        throw new Error("Demo climate should preload Moscow design temperature and heating duration from SP 131.");
    }
    if (typeof climateGsop?.value !== "number" || climateGsop.value < 4700 || climateGsop.value > 4800) {
        throw new Error("Demo climate should calculate GSOP for Moscow automatically.");
    }
    const emissionFactorField = report.sections.ecology.computedFields.find((field) => field.key === "ecology.ef");
    const co2Field = report.sections.ecology.computedFields.find((field) => field.key === "ecology.co2-kg");
    if (!emissionFactorField || emissionFactorField.value !== 0.23) {
        throw new Error("Demo ecology should preload a curated emission factor.");
    }
    if (!co2Field || typeof co2Field.value !== "number" || !(co2Field.value > 0)) {
        throw new Error("CO2 should be calculated for the demo project once EF and energy are available.");
    }
    const reportName = report.sections.reports.computedFields.find((field) => field.key === "reports.project-name");
    if (!reportName || reportName.value !== "Демонстрационный дом · 2 этажа") {
        throw new Error("Demo report metadata should preload the project name.");
    }
});
test("demo model envelope is fully assigned and climate provenance is explicit", () => {
    const demo = buildPreparedVideoDemoProject();
    const envelope = demo.model.thermalProtection?.envelope ?? [];
    if (envelope.length < 5) {
        throw new Error("Demo thermalProtection envelope should include the main external constructions.");
    }
    if (envelope.some((fragment) => !fragment.layers?.length)) {
        throw new Error("Every main demo envelope fragment should keep assigned layers.");
    }
    if (demo.model.meta?.climateSource !== "src/norms/sp131_2025/climate.ts#moscow") {
        throw new Error("Demo model should keep an explicit climate source reference.");
    }
});
test("CO2 remains unavailable without emission factor", () => {
    const demo = buildPreparedVideoDemoProject();
    const scenario = cloneValue(demo.scenarioConfig);
    scenario.ecology = {
        ...(scenario.ecology ?? {}),
        emissionFactorKgPerKWh: null,
    };
    const report = buildSourceDataWorkspaceReport({
        model: demo.model,
        scenarioConfig: scenario,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const co2Field = report.sections.ecology.computedFields.find((field) => field.key === "ecology.co2-kg");
    if (!co2Field || co2Field.value !== null || co2Field.source !== "missing") {
        throw new Error("CO2 should stay unavailable when EF is not provided.");
    }
});
test("demo windows use explicit project U instead of single-glass equivalent layers", () => {
    const demo = buildPreparedVideoDemoProject();
    const report = buildSourceDataWorkspaceReport({
        model: demo.model,
        scenarioConfig: demo.scenarioConfig,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const windowRow = report.constructions.find((row) => row.kind === "window");
    const targetU = demo.scenarioConfig.materials?.windowUValue_W_m2K ?? null;
    if (!windowRow || typeof windowRow.uValue_W_m2K.value !== "number" || targetU == null) {
        throw new Error("Window construction row should expose explicit U.");
    }
    if (Math.abs(windowRow.uValue_W_m2K.value - targetU) > 1e-9) {
        throw new Error("Window U should come from project input, not from a single-glass layer approximation.");
    }
    if (!windowRow.warnings.some((warning) => warning.includes("заданный проектный U окна"))) {
        throw new Error("Window row should explain that project U overrides the layer approximation.");
    }
});
test("model psi/chi auto-selects explicit bridge mode when scenario mode is unset", () => {
    const demo = buildPreparedVideoDemoProject();
    const scenario = cloneValue(demo.scenarioConfig);
    if (scenario.materials) {
        delete scenario.materials.bridgeAccountingMode;
    }
    const model = cloneValue(demo.model);
    const wall = model.thermalProtection?.envelope?.find((fragment) => fragment.id === "video-ext-walls");
    if (!wall) {
        throw new Error("Expected main exterior wall fragment.");
    }
    wall.heterogeneity = {
        linear: [{ lengthM: 8, psi_W_mK: 0.12, label: "угол" }],
        point: [{ count: 2, chi_W_K: 0.08, label: "анкеры" }],
    };
    const report = buildSourceDataWorkspaceReport({
        model,
        scenarioConfig: scenario,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const bridgeModeField = report.sections.materials.computedFields.find((field) => field.key === "materials.bridge-mode");
    const hPsiField = report.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
    if (bridgeModeField?.value !== "explicitPsiChi") {
        throw new Error("Auto bridge mode should select explicit psi/chi when model has heterogeneity.");
    }
    if (bridgeModeField.source !== "calculated") {
        throw new Error("Auto-selected bridge mode should be marked as calculated.");
    }
    if (typeof hPsiField?.value !== "number" || !(hPsiField.value > 0)) {
        throw new Error("Auto explicit mode should expose positive H_psi from model bridges.");
    }
});
test("homogeneity coefficient reduces Rred, fallback r=1 warns, and explicit psi/chi does not double-count with Rred", () => {
    const demo = buildPreparedVideoDemoProject();
    const homogeneityScenario = cloneValue(demo.scenarioConfig);
    homogeneityScenario.materials = {
        ...(homogeneityScenario.materials ?? {}),
        bridgeAccountingMode: "homogeneityCoefficient",
        homogeneityCoefficient: 0.92,
    };
    const homogeneityReport = buildSourceDataWorkspaceReport({
        model: demo.model,
        scenarioConfig: homogeneityScenario,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const bridgeModeField = homogeneityReport.sections.materials.computedFields.find((field) => field.key === "materials.bridge-mode");
    const wallRow = homogeneityReport.constructions
        .filter((row) => row.kind === "wall")
        .sort((left, right) => (right.areaM2 ?? 0) - (left.areaM2 ?? 0))[0];
    if (!wallRow ||
        typeof wallRow.resistanceR0_m2K_W.value !== "number" ||
        typeof wallRow.reducedResistance_m2K_W.value !== "number") {
        throw new Error("Wall row should expose R0 and Rred.");
    }
    if (bridgeModeField?.value === "explicitPsiChi") {
        if (Math.abs(wallRow.reducedResistance_m2K_W.value - wallRow.resistanceR0_m2K_W.value) > 1e-6) {
            throw new Error("In explicit ψ/χ mode Rred should stay equal to R0 on the same construction row.");
        }
    }
    else {
        const expectedReduced = wallRow.resistanceR0_m2K_W.value * 0.92;
        if (Math.abs(wallRow.reducedResistance_m2K_W.value - expectedReduced) > 1e-6) {
            throw new Error("Rred should equal r * R0 when homogeneity coefficient mode is active.");
        }
    }
    const fallbackScenario = cloneValue(demo.scenarioConfig);
    fallbackScenario.materials = {
        ...(fallbackScenario.materials ?? {}),
        bridgeAccountingMode: "homogeneityCoefficient",
        homogeneityCoefficient: null,
    };
    const fallbackReport = buildSourceDataWorkspaceReport({
        model: demo.model,
        scenarioConfig: fallbackScenario,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const fallbackWallRow = fallbackReport.constructions
        .filter((row) => row.kind === "wall")
        .sort((left, right) => (right.areaM2 ?? 0) - (left.areaM2 ?? 0))[0];
    const fallbackBridgeMode = fallbackReport.sections.materials.computedFields.find((field) => field.key === "materials.bridge-mode");
    const hasR1FallbackWarning = fallbackWallRow?.warnings.some((warning) => warning.includes("принято r = 1") || warning.includes("принято r = 1."));
    const hasModelDerivedRWarning = fallbackWallRow?.warnings.some((warning) => warning.includes("рассчитан из модели"));
    if (fallbackBridgeMode?.value === "explicitPsiChi") {
        const fallbackHPsi = fallbackReport.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
        if (typeof fallbackHPsi?.value !== "number" || !(fallbackHPsi.value > 0)) {
            throw new Error("Explicit bridge fallback should still expose H_psi from model bridges.");
        }
    }
    else if (!hasR1FallbackWarning && !hasModelDerivedRWarning) {
        throw new Error("Without scenario r, wall row should warn about r = 1 or model-derived r.");
    }
    const explicitScenario = cloneValue(demo.scenarioConfig);
    explicitScenario.materials = {
        ...(explicitScenario.materials ?? {}),
        bridgeAccountingMode: "explicitPsiChi",
        homogeneityCoefficient: 0.85,
    };
    const explicitModel = cloneValue(demo.model);
    const firstEnvelope = explicitModel.thermalProtection?.envelope?.find((fragment) => fragment.id === "video-ext-walls");
    if (!firstEnvelope) {
        throw new Error("Expected main exterior wall fragment.");
    }
    firstEnvelope.heterogeneity = {
        linear: [{ lengthM: 8, psi_W_mK: 0.12, label: "угол" }],
        point: [{ count: 2, chi_W_K: 0.08, label: "анкеры" }],
    };
    const explicitReport = buildSourceDataWorkspaceReport({
        model: explicitModel,
        scenarioConfig: explicitScenario,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const explicitWallRow = explicitReport.constructions.find((row) => row.kind === "wall");
    const hPsiField = explicitReport.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
    const hChiField = explicitReport.sections.materials.computedFields.find((field) => field.key === "materials.h-chi");
    if (!explicitWallRow || explicitWallRow.reducedResistance_m2K_W.value !== explicitWallRow.resistanceR0_m2K_W.value) {
        throw new Error("Rred should stay equal to R0 when explicit psi/chi mode is selected.");
    }
    if (typeof hPsiField?.value !== "number" ||
        !(hPsiField.value > 0) ||
        typeof hChiField?.value !== "number" ||
        !(hChiField.value > 0)) {
        throw new Error("Explicit psi/chi mode should expose bridge conductances from heterogeneity fragments.");
    }
});
test("required hydronic mass flow is derived from required power and validation metrics stay disabled without room/timestamps", () => {
    const demo = buildPreparedVideoDemoProject();
    const scenario = cloneValue(demo.scenarioConfig);
    scenario.engineeringSystems = {
        ...(scenario.engineeringSystems ?? {}),
        massFlowKgS: null,
    };
    scenario.validation = {
        ...(scenario.validation ?? {}),
        availabilityStatus: null,
        dataOrigin: null,
        note: null,
        roomId: null,
        measuredSeries: [{ timestamp: "invalid", valueC: 21.5 }],
    };
    const model = cloneValue(demo.model);
    model.meta = {
        ...(model.meta ?? {}),
        validationStatus: null,
        validationSource: null,
    };
    const report = buildSourceDataWorkspaceReport({
        model,
        scenarioConfig: scenario,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const requiredMassFlow = report.sections.engineeringNetworks.computedFields.find((field) => field.key === "engineering.required-mass-flow");
    if (typeof requiredMassFlow?.value !== "number" || !(requiredMassFlow.value > 0)) {
        throw new Error("Required hydronic mass flow should be derived automatically when power demand and ΔT are known.");
    }
    const mbeField = report.sections.validation.computedFields.find((field) => field.key === "validation.mbe");
    if (!mbeField || mbeField.value !== null || mbeField.source !== "missing") {
        throw new Error("Validation metrics must stay unavailable without a valid roomId/timestamp series.");
    }
    if (!report.sections.validation.warnings.some((warning) => warning.includes("roomId"))) {
        throw new Error("Validation section should explain that roomId is required.");
    }
});
test("brick and polystyrene wall stack yields H_psi from material catalog", () => {
    const model = createEmptyBuildingModel();
    const levelId = "lvl-1";
    model.levels = [{ id: levelId, name: "Этаж 1", elevation_m: 0, height_m: 3 }];
    model.rooms = [
        {
            id: "room-1",
            levelId,
            name: "Помещение",
            polygon: [
                { x: 0, y: 0 },
                { x: 8, y: 0 },
                { x: 8, y: 6 },
                { x: 0, y: 6 },
            ],
            source: "manual",
        },
    ];
    const layers = [
        { materialId: "brick", thickness_m: 0.38 },
        { materialId: "polystyrene", thickness_m: 0.1 },
        { materialId: "gypsum", thickness_m: 0.015 },
    ];
    model.walls = [
        { id: "w1", levelId, a: { x: 0, y: 0 }, b: { x: 8, y: 0 }, height_m: 3, thickness_m: 0.38, layers },
        { id: "w2", levelId, a: { x: 8, y: 0 }, b: { x: 8, y: 6 }, height_m: 3, thickness_m: 0.38, layers },
        { id: "w3", levelId, a: { x: 8, y: 6 }, b: { x: 0, y: 6 }, height_m: 3, thickness_m: 0.38, layers },
        { id: "w4", levelId, a: { x: 0, y: 6 }, b: { x: 0, y: 0 }, height_m: 3, thickness_m: 0.38, layers },
    ];
    const report = buildSourceDataWorkspaceReport({
        model,
        scenarioConfig: createDefaultScenarioConfig(),
        thermalResult: null,
        reportInputs: null,
    });
    const hPsiField = report.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
    if (typeof hPsiField?.value !== "number" || !(hPsiField.value > 0)) {
        throw new Error("Brick + polystyrene wall should produce H_psi via generic material-based bridge derivation.");
    }
});
test("walls without rooms still expose H_psi when all walls are treated as exterior", () => {
    const model = buildSimpleInsulatedHouse();
    model.rooms = [];
    const report = buildSourceDataWorkspaceReport({
        model,
        scenarioConfig: createDefaultScenarioConfig(),
        thermalResult: null,
        reportInputs: null,
    });
    const hPsiField = report.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
    if (typeof hPsiField?.value !== "number" || !(hPsiField.value > 0)) {
        throw new Error("Without rooms, all walls should still contribute ψ/χ for source data.");
    }
});
test("walls without envelopePresetId still get H_psi from default wall preset layers", () => {
    const model = buildSimpleInsulatedHouse();
    model.walls = model.walls.map((wall) => ({
        ...wall,
        layers: undefined,
        envelopePresetId: undefined,
    }));
    const report = buildSourceDataWorkspaceReport({
        model,
        scenarioConfig: createDefaultScenarioConfig(),
    });
    const hPsi = report.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
    if (typeof hPsi?.value !== "number" || !(hPsi.value > 0)) {
        throw new Error(`Expected H_psi from default preset layers, got ${hPsi?.value}.`);
    }
});
test("planar heterogeneity alone does not block automatic psi/chi enrichment", () => {
    const model = buildSimpleInsulatedHouse();
    const scenarioConfig = createDefaultScenarioConfig();
    const synced = prepareModelForSourceData(model, scenarioConfig);
    const envelope = synced.thermalProtection?.envelope ?? [];
    const withPlanarOnly = envelope.map((fragment) => fragment.constructionType === "wall"
        ? {
            ...fragment,
            heterogeneity: {
                planar: [{ areaM2: Math.max(1, fragment.areaM2 * 0.2), resistance_m2K_W: 2.5, label: "зона" }],
            },
        }
        : fragment);
    const prepared = prepareModelForSourceData({
        ...synced,
        thermalProtection: {
            ...(synced.thermalProtection ?? {}),
            envelope: withPlanarOnly,
        },
    }, scenarioConfig);
    const bridges = aggregateEnvelopeBridgeConductances(prepared);
    if (typeof bridges.H_psi !== "number" || !(bridges.H_psi > 0)) {
        throw new Error(`Expected H_psi > 0 when only planar heterogeneity was preset, got ${bridges.H_psi}.`);
    }
});
test("switching SP131 city overwrites outdoor temperatures in the model", () => {
    const model = buildSimpleInsulatedHouse();
    const moscowModel = applySp131ClimateToModel(model, "moscow");
    const novosibirskModel = applySp131ClimateToModel(moscowModel, "novosibirsk");
    const climate = novosibirskModel.thermalProtection?.climate;
    if (climate?.outdoorDesignTemperatureC !== -37) {
        throw new Error(`Expected Novosibirsk design temperature -37 °C, got ${climate?.outdoorDesignTemperatureC}.`);
    }
    if (climate?.outdoorHeatingPeriodAverageC !== -7.9) {
        throw new Error(`Expected Novosibirsk heating average -7.9 °C, got ${climate?.outdoorHeatingPeriodAverageC}.`);
    }
    if (climate?.heatingPeriodDurationDays !== 222) {
        throw new Error(`Expected Novosibirsk heating duration 222 days, got ${climate?.heatingPeriodDurationDays}.`);
    }
});
test("model without thermalProtection.climate gets outdoor climate from SP 131 in report", () => {
    const model = buildSimpleInsulatedHouse();
    const report = buildSourceDataWorkspaceReport({
        model,
        scenarioConfig: { ...createDefaultScenarioConfig(), climateCityId: null },
        thermalResult: null,
        reportInputs: null,
    });
    const designOutdoor = report.sections.climate.computedFields.find((field) => field.key === "climate.design-outdoor");
    const cityField = report.sections.climate.computedFields.find((field) => field.key === "climate.city");
    if (typeof designOutdoor?.value !== "number" || designOutdoor.value !== -26) {
        throw new Error("Expected Moscow design outdoor temperature -26 °C when climate is derived for the model.");
    }
    if (designOutdoor.source !== "model" && designOutdoor.source !== "sp131" && designOutdoor.source !== "fallback") {
        throw new Error(`Expected climate source from model or SP 131, got ${designOutdoor.source}.`);
    }
    if (cityField?.value !== "Москва") {
        throw new Error("Expected Moscow climate profile label on the model.");
    }
});
test("non-demo rectangular house exposes H_psi and H_chi from wall geometry", () => {
    const report = buildSourceDataWorkspaceReport({
        model: buildSimpleInsulatedHouse(),
        scenarioConfig: createDefaultScenarioConfig(),
        thermalResult: null,
        reportInputs: null,
    });
    const hPsiField = report.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
    const hChiField = report.sections.materials.computedFields.find((field) => field.key === "materials.h-chi");
    if (typeof hPsiField?.value !== "number" || !(hPsiField.value > 0)) {
        throw new Error("Generic house should expose positive H_psi from exterior wall ψ/χ.");
    }
    if (typeof hChiField?.value !== "number" || !(hChiField.value > 0)) {
        throw new Error("Generic house should expose positive H_chi from exterior wall anchors.");
    }
});
test("local build model without thermalProtection still exposes H_psi and H_chi from geometry", () => {
    const demo = buildPreparedVideoDemoProject();
    const stripped = cloneValue(demo.model);
    stripped.thermalProtection = undefined;
    const report = buildSourceDataWorkspaceReport({
        model: stripped,
        scenarioConfig: demo.scenarioConfig,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const hPsiField = report.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
    const hChiField = report.sections.materials.computedFields.find((field) => field.key === "materials.h-chi");
    if (typeof hPsiField?.value !== "number" || !(hPsiField.value > 0)) {
        throw new Error("H_psi should be rebuilt from demo envelope ψ/χ when thermalProtection was stripped.");
    }
    if (typeof hChiField?.value !== "number" || !(hChiField.value > 0)) {
        throw new Error("H_chi should be rebuilt from demo envelope ψ/χ when thermalProtection was stripped.");
    }
});
test("geometry opening areas follow model.windows and sync drops stale envelope windows", () => {
    const demo = buildPreparedVideoDemoProject();
    const reportWithOpenings = buildSourceDataWorkspaceReport({
        model: demo.model,
        scenarioConfig: demo.scenarioConfig,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const windowAreaLive = reportWithOpenings.sections.geometry.computedFields.find((field) => field.key === "geometry.window-area");
    if (!windowAreaLive || typeof windowAreaLive.value !== "number" || !(windowAreaLive.value > 0)) {
        throw new Error("Window area should be taken from model.windows when openings exist.");
    }
    const stripped = cloneValue(demo.model);
    stripped.windows = [];
    stripped.doors = [];
    const reportStripped = buildSourceDataWorkspaceReport({
        model: stripped,
        scenarioConfig: demo.scenarioConfig,
        thermalResult: demo.thermalResult,
        reportInputs: demo.reportInputs,
    });
    const windowAreaStale = reportStripped.sections.geometry.computedFields.find((field) => field.key === "geometry.window-area");
    if (windowAreaStale?.value != null && typeof windowAreaStale.value === "number" && windowAreaStale.value > 0) {
        throw new Error("After sync, empty model.windows should not keep stale window areas in envelope.");
    }
});
