import { buildDemoSp50RunResult, sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import { buildExpertiseThermalReportData, buildSpReportHtml } from "../../src/features/build/reports/spReportPdf.js";
import { test } from "../testHarness.js";
test("expertise report includes mandatory SP50 sections and energy passport", () => {
    const demo = buildDemoSp50RunResult(sampleBuildingSP50, "test-sp-report");
    const data = buildExpertiseThermalReportData({
        report: demo.report,
        model: demo.model,
        meta: { projectCipher: "ТП-01", buildingAddress: "г. Москва", developerOrg: "ООО Проект", customerOrg: "Заказчик" },
        calculationTimestampIso: "2026-05-19T12:00:00.000Z",
        climateBaseLabel: "СП 131.13330.2025, Москва",
    });
    const sectionTitles = data.sections.map((entry) => entry.title);
    const appendixTitles = data.appendixSections.map((entry) => entry.title);
    const required = [
        "Общие положения",
        "Исходные данные",
        "Нормативные ссылки и программное обеспечение",
        "Сопротивление теплопередаче ограждающих конструкций",
        "Удельная теплозащитная характеристика здания",
        "Энергетическая характеристика и расход тепловой энергии",
        "Выводы",
    ];
    for (const title of required) {
        if (!sectionTitles.includes(title)) {
            throw new Error(`Отсутствует раздел: ${title}`);
        }
    }
    if (!appendixTitles.some((title) => title.includes("Энергетический паспорт"))) {
        throw new Error("Отсутствует приложение с энергопаспортом");
    }
    if (!data.filename.startsWith("Raschet-teplozashchity_")) {
        throw new Error(`Неожиданное имя файла: ${data.filename}`);
    }
});
test("expertise report HTML escapes unsafe markup", () => {
    const demo = buildDemoSp50RunResult(sampleBuildingSP50, "test-sp-report-xss");
    const data = buildExpertiseThermalReportData({
        report: demo.report,
        model: demo.model,
        projectName: "<script>alert(1)</script>",
        meta: { projectCipher: "ТП-<b>1</b>" },
    });
    const html = buildSpReportHtml(data);
    if (html.includes("<script>alert(1)</script>")) {
        throw new Error("HTML не экранирует название проекта");
    }
    if (html.includes("<b>1</b>")) {
        throw new Error("HTML не экранирует шифр проекта");
    }
    if (!html.includes("Times New Roman")) {
        throw new Error("HTML не содержит экспертный шрифт");
    }
    if (!html.includes("ГОСТ 2.105")) {
        throw new Error("HTML не содержит ссылку на ГОСТ 2.105");
    }
    if (!html.includes("gost-stamp")) {
        throw new Error("HTML не содержит основную надпись по ГОСТ 21.501");
    }
    if (!html.includes("Проектная документация")) {
        throw new Error("HTML не содержит вид документа по ПП РФ № 87");
    }
    if (!html.includes("ПП РФ")) {
        throw new Error("HTML не содержит ссылку на ПП РФ № 87");
    }
    if (!html.includes("toc-entry")) {
        throw new Error("HTML не содержит оглавление с якорями");
    }
    if (!html.includes("Энергетический паспорт")) {
        throw new Error("HTML не содержит энергопаспорт");
    }
});
