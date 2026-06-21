/**
 * Утилита: формирует все 5 выгрузок на демонстрационном доме и сохраняет HTML
 * на диск (для ручной визуальной проверки и печати в PDF).
 *
 * Выход: tests-dist/tmp/demo-exports/<kind>.html
 *
 * Дополнительно: печатает таблицу «какие поля Энергопаспорта заполнены /
 *                                       какие — недостаточно данных» (для отчёта).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runThermalSimulation } from "../../src/core/thermal/solver.js";
import { buildVideoDemoProjectModel } from "../../src/features/build/demoVideoProject.js";
import { DEFAULT_THERMAL_OPTIONS } from "../../src/features/build/thermal/defaultThermalOptions.js";
import { buildThermalOptionsFromWorkflow } from "../../src/features/build/thermal/workflowThermalOptions.js";
import { applyScenarioToBuilding } from "../../src/features/build/thermal/applyScenarioToBuilding.js";
import { DEFAULT_REPORT_META } from "../../src/features/build/reports/reportMetaPersistence.js";
import { buildReportBaseData } from "../../src/features/reports/exports/data/buildReportBaseData.js";
import { applyDemoDesignDefaults } from "../../src/features/reports/exports/defaults/demoHouseDesignDefaults.js";
import { buildProjectOvTsData } from "../../src/features/reports/exports/data/buildProjectOvTsData.js";
import { buildThermalProtectionData } from "../../src/features/reports/exports/data/buildThermalProtectionData.js";
import { buildEnergyPassportData } from "../../src/features/reports/exports/data/buildEnergyPassportData.js";
import { buildOperationPassportData } from "../../src/features/reports/exports/data/buildOperationPassportData.js";
import { buildEngineeringSummaryData } from "../../src/features/reports/exports/data/buildEngineeringSummaryData.js";
import { generateProjectOvTsHtml } from "../../src/features/reports/exports/generators/projectOvTs.js";
import { generateThermalProtectionHtml } from "../../src/features/reports/exports/generators/thermalProtection.js";
import { generateEnergyPassportHtml } from "../../src/features/reports/exports/generators/energyPassport.js";
import { generateOperationTechnicalPassportHtml } from "../../src/features/reports/exports/generators/operationTechnicalPassport.js";
import { generateEngineeringSummaryHtml } from "../../src/features/reports/exports/generators/engineeringSummary.js";
const DEMO_SCENARIO = {
    climate: { baseC: -3.1, amplitudeC: 9, seasonalOffsetC: 0 },
    setpoints: { day: 21, night: 18, dayStartHour: 6, nightStartHour: 22 },
    internalGains: { dayGain_W_m2: 6, nightGain_W_m2: 1 },
    occupancy: { dayFraction: 1, nightFraction: 0.2 },
    ventilation: {
        infiltrationACH: 0.5,
        ventilationACH: 0.18,
        heatRecoveryFactor: 0,
        mechanicalVentilationEnabled: true,
    },
    climateCityId: "moscow",
};
function main() {
    const model = buildVideoDemoProjectModel();
    const adjustedModel = applyScenarioToBuilding(model, DEMO_SCENARIO);
    const options = buildThermalOptionsFromWorkflow(DEMO_SCENARIO, DEFAULT_THERMAL_OPTIONS);
    const thermalResult = runThermalSimulation(adjustedModel, options);
    const rawInput = {
        model: adjustedModel,
        projectId: "local:demo-video",
        scenarioConfig: DEMO_SCENARIO,
        thermalResult,
        monteCarloResult: null,
        reportMeta: {
            ...DEFAULT_REPORT_META,
            developerOrg: "ООО «Гнёздышко»",
            customerOrg: "Демонстрационный заказчик",
            buildingAddress: "г. Москва, ул. Демонстрационная, 1",
            projectCipher: "ДЕМО-2026",
            documentCity: "Москва",
        },
        generatedAt: new Date("2026-05-21T10:00:00Z"),
    };
    // На демо-доме применяем профиль проектных допущений; для документа это
    // отразится сноской «*» рядом со значениями и блоком «Принятые
    // проектные допущения».
    const { input, appliedAssumptions } = applyDemoDesignDefaults(rawInput);
    const base = buildReportBaseData({ ...input, appliedAssumptions });
    const outDir = join(process.cwd(), "tests-dist", "tmp", "demo-exports");
    mkdirSync(outDir, { recursive: true });
    const opts = { appliedAssumptions: base.appliedAssumptions };
    const projectOvTs = generateProjectOvTsHtml(buildProjectOvTsData(base), opts);
    const thermal = generateThermalProtectionHtml(buildThermalProtectionData(base), opts);
    const energyData = buildEnergyPassportData(base);
    const energy = generateEnergyPassportHtml(energyData, opts);
    const opData = buildOperationPassportData(base);
    const operation = generateOperationTechnicalPassportHtml(opData, opts);
    const summary = generateEngineeringSummaryHtml(buildEngineeringSummaryData(base), opts);
    writeFileSync(join(outDir, "01-project-ov-ts.html"), projectOvTs, "utf8");
    writeFileSync(join(outDir, "02-thermal-protection.html"), thermal, "utf8");
    writeFileSync(join(outDir, "03-energy-passport.html"), energy, "utf8");
    writeFileSync(join(outDir, "04-operation-technical-passport.html"), operation, "utf8");
    writeFileSync(join(outDir, "05-engineering-summary.html"), summary, "utf8");
    console.log("HTML экспорты записаны в:", outDir);
    console.log("");
    console.log("=== Энергопаспорт: заполненность ключевых полей ===");
    const energySections = [
        energyData.generalInfo,
        energyData.designConditions,
        energyData.geometryIndicators,
        energyData.thermalIndicators,
        energyData.auxIndicators,
        energyData.specificCharacteristics,
        energyData.coefficients,
        energyData.complexIndicators,
        energyData.energyLoads,
    ];
    let filled = 0;
    let missing = 0;
    for (const section of energySections) {
        console.log(`\n${section.title}`);
        for (const row of section.rows) {
            const tag = row.designValue === "недостаточно данных" ? "✗" : "✓";
            if (tag === "✓")
                filled += 1;
            else
                missing += 1;
            console.log(`  ${tag} ${row.label.padEnd(64)} | ${row.designValue}`);
        }
    }
    console.log("");
    console.log(`Итого: заполнено ${filled}, недостаточно данных ${missing} (всего ${filled + missing}).`);
    console.log("");
    console.log("=== Экспл. паспорт: статус ===");
    console.log(`  isDraft = ${opData.isDraft}`);
    if (opData.draftReason) {
        console.log(`  причина черновика: ${opData.draftReason}`);
    }
}
main();
