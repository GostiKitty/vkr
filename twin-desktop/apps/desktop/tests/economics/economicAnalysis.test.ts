import { buildDemoSp50RunResult, sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import {
  buildDefaultEconomicScenario,
  calculateDiscountedPayback_years,
  calculateNpv_RUB,
  calculateProfitabilityIndex,
  calculateRetrofitCost,
  calculateSimplePayback_years,
  economicDefaults,
  estimateAnnualEnergySaving_kWh,
  runEconomicAssessment,
} from "../../src/core/economics/index.js";
import { test } from "../testHarness.js";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function collectInvalidNumbers(value: unknown, path = "root"): string[] {
  if (typeof value === "number") {
    return Number.isFinite(value) ? [] : [path];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectInvalidNumbers(entry, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => collectInvalidNumbers(entry, `${path}.${key}`));
  }
  return [];
}

test("economics: calculates retrofit cost from editable defaults", () => {
  const scenario = buildDefaultEconomicScenario(buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report);
  const cost = calculateRetrofitCost(100, scenario.measures[0], economicDefaults);
  if (!(cost > 0)) {
    throw new Error("Expected positive retrofit cost.");
  }
});

test("economics: calculates annual energy saving from heat loss reduction", () => {
  const saving = estimateAnnualEnergySaving_kWh({ deltaQ_W: 1000, heatingPeriodHours: 2000 });
  if (saving === null || Math.abs(saving - 2000) > 1e-6) {
    throw new Error(`Unexpected annual energy saving: ${saving}`);
  }
});

test("economics: calculates payback and NPV", () => {
  const payback = calculateSimplePayback_years(1_000_000, 200_000);
  const npv = calculateNpv_RUB({
    cost_RUB: 1_000_000,
    annualSaving_RUB: 200_000,
    discountRate: 0.1,
    analysisPeriod_years: 10,
  });
  if (payback === null || Math.abs(payback - 5) > 1e-6) {
    throw new Error(`Unexpected payback: ${payback}`);
  }
  if (npv === null || !Number.isFinite(npv)) {
    throw new Error("Expected finite NPV.");
  }
});

test("economics: builds zone-based assessment with ranking and recommendations", () => {
  const report = buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report;
  const scenario = buildDefaultEconomicScenario(report);
  const result = runEconomicAssessment(report, scenario);
  if (!result.measureResults.length) {
    throw new Error("Expected at least one economic measure.");
  }
  if (!result.zones.some((zone) => zone.id === "walls")) {
    throw new Error("Expected wall zone in assessment.");
  }
  if (result.summary.bestMeasureId !== result.measureResults[0].measureId) {
    throw new Error("Expected best measure to follow ranking output.");
  }
  if (!result.engineeringConclusion.includes("предварительной технико-экономической оценкой")) {
    throw new Error("Expected engineering conclusion disclaimer.");
  }
  const payload = JSON.stringify(result);
  if (payload.includes("NaN") || payload.includes("undefined")) {
    throw new Error("Economic assessment should not contain NaN or undefined.");
  }
});

test("economics: NPV accounts for tariff growth", () => {
  const base = calculateNpv_RUB({
    cost_RUB: 1_000_000,
    annualSaving_RUB: 120_000,
    discountRate: 0.1,
    analysisPeriod_years: 10,
  });
  const growth = calculateNpv_RUB({
    cost_RUB: 1_000_000,
    annualSaving_RUB: 120_000,
    discountRate: 0.1,
    analysisPeriod_years: 10,
    annualTariffGrowthPercent: 7,
  });
  if (base === null || growth === null || !(growth > base)) {
    throw new Error(`Expected tariff growth to increase NPV. Base=${base}, growth=${growth}`);
  }
});

test("economics: direct payback is null for zero saving", () => {
  const payback = calculateSimplePayback_years(200_000, 0);
  if (payback !== null) {
    throw new Error(`Expected null payback for zero annual saving, got ${payback}`);
  }
});

test("economics: warns on unknown energy source and falls back to heat tariff", () => {
  const report = buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report;
  const scenario = cloneValue(buildDefaultEconomicScenario(report));
  scenario.heatingEnergySource = "unknown";
  const result = runEconomicAssessment(report, scenario);
  if (!result.warnings.some((entry) => entry.includes("Тип энергоносителя не задан"))) {
    throw new Error("Expected warning about unknown energy source.");
  }
  if (!(result.measureResults[0]?.annualSaving_RUB >= 0)) {
    throw new Error("Expected fallback annual saving to remain finite.");
  }
});

test("economics: electric heating uses rub/kWh tariff", () => {
  const report = buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report;
  const baseScenario = cloneValue(buildDefaultEconomicScenario(report));
  const electricScenario = cloneValue(buildDefaultEconomicScenario(report));
  baseScenario.heatingEnergySource = "heat";
  baseScenario.heatTariffRubPerGcal = 0;
  electricScenario.heatingEnergySource = "electricity";
  electricScenario.electricityTariffRubPerKwh = 10;
  const heatResult = runEconomicAssessment(report, baseScenario);
  const electricResult = runEconomicAssessment(report, electricScenario);
  const heatSaving = heatResult.measureResults.find((entry) => entry.status === "calculated")?.annualSaving_RUB ?? 0;
  const electricSaving = electricResult.measureResults.find((entry) => entry.status === "calculated")?.annualSaving_RUB ?? 0;
  if (!(electricSaving > heatSaving)) {
    throw new Error(`Expected electric tariff path to use rub/kWh. Heat=${heatSaving}, electric=${electricSaving}`);
  }
});

test("economics: scenario sorting changes between budget and maximum saving", () => {
  const report = buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report;
  const budgetScenario = cloneValue(buildDefaultEconomicScenario(report));
  budgetScenario.mode = "minimum_budget";
  const savingScenario = cloneValue(buildDefaultEconomicScenario(report));
  savingScenario.mode = "maximum_saving";
  const budgetResult = runEconomicAssessment(report, budgetScenario);
  const savingResult = runEconomicAssessment(report, savingScenario);
  const budgetBest = budgetResult.measureResults[0]?.measureId;
  const savingBest = savingResult.measureResults[0]?.measureId;
  if (!budgetBest || !savingBest || budgetBest === savingBest) {
    throw new Error(`Expected scenario-dependent ranking. Budget=${budgetBest}, Saving=${savingBest}`);
  }
});

test("economics: priority score stays in 0..100 and exposes reasons", () => {
  const report = buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report;
  const result = runEconomicAssessment(report, buildDefaultEconomicScenario(report));
  for (const entry of result.measureResults) {
    if (entry.status !== "calculated") {
      continue;
    }
    if (entry.priorityScore < 0 || entry.priorityScore > 100) {
      throw new Error(`Priority score out of range for ${entry.measureId}: ${entry.priorityScore}`);
    }
    if (!entry.priorityReasons.length) {
      throw new Error(`Expected priority reasons for ${entry.measureId}`);
    }
  }
});

test("economics: invalid tariffs and missing data produce readable warnings", () => {
  const report = buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report;
  const scenario = cloneValue(buildDefaultEconomicScenario(report));
  scenario.heatTariffRubPerGcal = 0;
  const result = runEconomicAssessment(report, scenario);
  if (!result.warnings.some((entry) => entry.includes("Тариф на тепловую энергию"))) {
    throw new Error("Expected warning about zero heat tariff.");
  }
});

test("economics: normalizes negative and empty inputs without NaN or Infinity", () => {
  const report = cloneValue(buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report);
  report.sourceData.heatedAreaM2 = -120;
  report.sourceData.heatedVolumeM3 = null;
  report.energy.annualHeatingEnergy_kWh = -50_000;
  report.energy.averageAirExchange_1_h = Number.NaN;
  report.energy.averageAirDensity_kg_m3 = Number.POSITIVE_INFINITY;
  if (report.constructions[0]) {
    report.constructions[0].areaM2 = -30;
    report.constructions[0].contribution_W_K = -10;
  }
  const scenario = cloneValue(buildDefaultEconomicScenario(report));
  scenario.heatTariffRubPerGcal = -1_000;
  scenario.electricityTariffRubPerKwh = -5;
  scenario.regionalCostFactor = -2;
  const result = runEconomicAssessment(report, scenario);
  const invalidNumbers = collectInvalidNumbers({
    summary: result.summary,
    zones: result.zones,
    measureResults: result.measureResults,
    exportData: result.exportData,
  });
  if (invalidNumbers.length) {
    throw new Error(`Expected finite result values. Invalid: ${invalidNumbers.join(", ")}`);
  }
  if (!result.warnings.length) {
    throw new Error("Expected warnings for suspicious input data.");
  }
});

test("economics: NPV, PI and discounted payback account for maintenance and residual value", () => {
  const npv = calculateNpv_RUB({
    cost_RUB: 300_000,
    annualSaving_RUB: 80_000,
    discountRate: 0.1,
    analysisPeriod_years: 8,
    annualMaintenanceCost_RUB: 5_000,
    residualValuePercent: 10,
  });
  const pi = calculateProfitabilityIndex({ cost_RUB: 300_000, npv_RUB: npv });
  const discountedPayback = calculateDiscountedPayback_years({
    cost_RUB: 300_000,
    annualSaving_RUB: 80_000,
    discountRate: 0.1,
    analysisPeriod_years: 8,
    annualMaintenanceCost_RUB: 5_000,
    residualValuePercent: 10,
  });
  if (npv === null || !Number.isFinite(npv)) {
    throw new Error("Expected finite NPV with maintenance and residual value.");
  }
  if (pi === null || pi <= 0) {
    throw new Error(`Expected positive PI, got ${pi}`);
  }
  if (discountedPayback === null || !(discountedPayback > 0)) {
    throw new Error(`Expected discounted payback to be calculated, got ${discountedPayback}`);
  }
});

test("economics: score breakdown stays in 0..1 and weights react to scenario", () => {
  const report = buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report;
  const budgetScenario = cloneValue(buildDefaultEconomicScenario(report));
  budgetScenario.mode = "minimum_budget";
  const fastScenario = cloneValue(buildDefaultEconomicScenario(report));
  fastScenario.mode = "fast_payback";
  const budgetResult = runEconomicAssessment(report, budgetScenario);
  const fastResult = runEconomicAssessment(report, fastScenario);
  const budgetLeader = budgetResult.measureResults[0];
  const fastLeader = fastResult.measureResults[0];
  if (!budgetLeader || !fastLeader) {
    throw new Error("Expected ranked measures for both scenarios.");
  }
  for (const entry of [...budgetResult.measureResults, ...fastResult.measureResults]) {
    if (entry.status !== "calculated") {
      continue;
    }
    for (const [key, value] of Object.entries(entry.scoreBreakdown)) {
      if (value < 0 || value > 1) {
        throw new Error(`Score breakdown out of range for ${entry.measureId}.${key}: ${value}`);
      }
    }
  }
  if (budgetLeader.measureId === fastLeader.measureId && budgetLeader.priorityScore === fastLeader.priorityScore) {
    throw new Error("Expected scenario weighting to affect the ranking or score.");
  }
});

test("economics: heating measures save energy without reducing envelope heat loss directly", () => {
  const report = cloneValue(buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report);
  report.energy.annualHeatingEnergy_kWh = 120_000;
  const result = runEconomicAssessment(report, buildDefaultEconomicScenario(report));
  const heatingMeasure = result.measureResults.find((entry) => entry.zoneId === "heatingSystem" && entry.status === "calculated");
  if (!heatingMeasure) {
    throw new Error("Expected at least one heating measure.");
  }
  if (heatingMeasure.heatLossReduction_W !== 0) {
    throw new Error(`Heating measure should not reduce envelope heat loss directly, got ${heatingMeasure.heatLossReduction_W}`);
  }
  if (!(heatingMeasure.savedEnergy_kWh_year > 0)) {
    throw new Error("Expected heating measure to reduce annual energy use.");
  }
});

test("economics: absent zone does not become scenario leader only due to low cost", () => {
  const report = cloneValue(buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report);
  report.constructions = report.constructions.map((entry) =>
    entry.constructionType === "window" || entry.constructionType === "lantern"
      ? { ...entry, areaM2: 0, contribution_W_K: 0 }
      : entry
  );
  const result = runEconomicAssessment(report, buildDefaultEconomicScenario(report));
  const leader = result.measureResults[0];
  if (!leader) {
    throw new Error("Expected ranked measures.");
  }
  if (leader.zoneId === "windows" && leader.status === "calculated") {
    throw new Error("Window measures should not lead when the window zone has no valid area.");
  }
});

test("economics: data quality level is assigned for zones, measures and export", () => {
  const report = buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report;
  const result = runEconomicAssessment(report, buildDefaultEconomicScenario(report));
  const heatingZone = result.zones.find((entry) => entry.id === "heatingSystem");
  const wallZone = result.zones.find((entry) => entry.id === "walls");
  if (!heatingZone || heatingZone.dataQualityLevel !== "default") {
    throw new Error("Expected default data quality for heating system zone.");
  }
  if (!wallZone || !["calculated", "estimated"].includes(wallZone.dataQualityLevel)) {
    throw new Error(`Unexpected wall zone data quality: ${wallZone?.dataQualityLevel}`);
  }
  const recommended = result.measureResults.find((entry) => entry.isRecommended);
  if (!recommended || !["calculated", "estimated", "default"].includes(recommended.dataQualityLevel)) {
    throw new Error("Expected recommended measure to expose data quality.");
  }
  if (result.exportData.zones.length !== result.zones.length || result.exportData.measures.length !== result.measureResults.length) {
    throw new Error("Expected export data to include zones and measures.");
  }
});

test("economics: export data contains key report fields", () => {
  const report = buildDemoSp50RunResult(sampleBuildingSP50, "economic-test").report;
  const result = runEconomicAssessment(report, buildDefaultEconomicScenario(report));
  const exportData = result.exportData;
  if (!exportData.calculatedAt || !exportData.region) {
    throw new Error("Expected export metadata.");
  }
  if (!exportData.scenario.mode || exportData.totalHeatLoss_W <= 0) {
    throw new Error("Expected scenario and heat loss data in export.");
  }
  if (!Array.isArray(exportData.warnings) || typeof exportData.engineeringConclusion !== "string") {
    throw new Error("Expected warnings and engineering conclusion in export.");
  }
});
