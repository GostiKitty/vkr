import { buildSourceDataWorkspaceReport } from "../../src/core/thermal/derived/sourceDataWorkspace.js";
import { buildPreparedVideoDemoProject } from "../../src/features/build/demoVideoProject.js";
import { test } from "../testHarness.js";

function averageCompletenessPercent(report: ReturnType<typeof buildSourceDataWorkspaceReport>) {
  if (!report.summaryCards.length) {
    return 0;
  }
  return Math.round(
    report.summaryCards.reduce((sum, card) => sum + card.completionPercent, 0) / report.summaryCards.length
  );
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
  const windowRow = report.constructions.find((row) => row.id === "video-windows");
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
  const wallRow = homogeneityReport.constructions.find((row) => row.kind === "wall");
  if (
    !wallRow ||
    typeof wallRow.resistanceR0_m2K_W.value !== "number" ||
    typeof wallRow.reducedResistance_m2K_W.value !== "number"
  ) {
    throw new Error("Wall row should expose R0 and Rred.");
  }
  const expectedReduced = wallRow.resistanceR0_m2K_W.value * 0.92;
  if (Math.abs(wallRow.reducedResistance_m2K_W.value - expectedReduced) > 1e-6) {
    throw new Error("Rred should equal r * R0 when homogeneity coefficient is provided.");
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
  const fallbackWallRow = fallbackReport.constructions.find((row) => row.kind === "wall");
  if (!fallbackWallRow?.warnings.some((warning) => warning.includes("принято r = 1"))) {
    throw new Error("Fallback r = 1 should produce an explicit warning.");
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
  if (
    typeof hPsiField?.value !== "number" ||
    !(hPsiField.value > 0) ||
    typeof hChiField?.value !== "number" ||
    !(hChiField.value > 0)
  ) {
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
  const requiredMassFlow = report.sections.engineeringNetworks.computedFields.find(
    (field) => field.key === "engineering.required-mass-flow"
  );
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
