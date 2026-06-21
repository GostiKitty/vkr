import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { buildReportBaseData, } from "../../src/features/reports/exports/data/buildReportBaseData.js";
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
import { REPORT_EXPORT_TEMPLATE_MARKER, } from "../../src/features/reports/exports/types.js";
import { DEFAULT_REPORT_META } from "../../src/features/build/reports/reportMetaPersistence.js";
import { test } from "../testHarness.js";
function renderReportHtml(kind, base) {
    switch (kind) {
        case "project-ov-ts":
            return generateProjectOvTsHtml(buildProjectOvTsData(base));
        case "thermal-protection":
            return generateThermalProtectionHtml(buildThermalProtectionData(base));
        case "energy-passport":
            return generateEnergyPassportHtml(buildEnergyPassportData(base));
        case "operation-technical-passport":
            return generateOperationTechnicalPassportHtml(buildOperationPassportData(base));
        case "engineering-summary":
            return generateEngineeringSummaryHtml(buildEngineeringSummaryData(base));
        default: {
            const exhaustive = kind;
            throw new Error(`Неизвестный тип выгрузки: ${String(exhaustive)}`);
        }
    }
}
/**
 * Запрещённые подстроки в пользовательских отчётах.
 * Источник: требования качества для всех выгрузок.
 *
 * Замечание: каждая строка проверяется на ВХОЖДЕНИЕ в готовый HTML и
 * срабатывает только в основном тексте документа (не в комментариях/маркерах).
 */
const FORBIDDEN_STRINGS = [
    "betaV",
    "Lvent",
    "Ginf",
    "nVent",
    "nInf",
    "Space 1",
    "report-actions",
    "ConsultantPlus",
];
const KIND_STRUCTURE_KEYWORDS = {
    "project-ov-ts": [
        "Ведомость исходных данных",
        "Статус документа",
        "1 Общие сведения",
        "2 Основание для проектирования",
        "3 Нормативная база",
        "4 Исходные климатические данные",
        "5 Характеристика объекта",
        "6 Проектные решения по отоплению",
        "7 Проектные решения по вентиляции",
        "8 Расчётные тепловые нагрузки",
        "10 Энергетические показатели",
        "13 Приложения",
        "Ограничения применения расчёта",
        "Состав сформированного комплекта",
        "Приложение А. Ведомость ограждающих конструкций",
        "Приложение Б. Подробные расчётные таблицы",
        "Приложение В. Справочная динамическая RC-оценка",
    ],
    "thermal-protection": [
        "Ведомость исходных данных",
        "Исходные климатические данные",
        "Геометрические показатели здания",
        "Состав наружных ограждающих конструкций",
        "Проверка сопротивления теплопередаче",
        "Проверка приведённого сопротивления теплопередаче",
        "Расчёт удельной теплозащитной характеристики kоб",
        "Расчёт энергетической характеристики qот",
        "Проверка соответствия требованиям",
        "Выводы",
        "Приложение А. Послойный состав конструкций",
        "Приложение Б. Ведомость элементов оболочки",
        "Приложение В. Расчётные фрагменты оболочки здания",
        "nt·A/Rприв",
    ],
    "energy-passport": [
        "Энергетический паспорт проекта здания",
        "1 Общая информация",
        "2 Расчётные условия",
        "3 Геометрические показатели",
        "4 Теплотехнические показатели",
        "5 Вспомогательные показатели",
        "6 Удельные характеристики",
        "7 Коэффициенты",
        "8 Комплексные показатели расхода тепловой энергии",
        "9 Энергетические нагрузки здания",
        "Нормируемое значение",
        "Расчётное проектное значение",
        "Основание заполнения",
    ],
    "operation-technical-passport": [
        "Паспорт проектных теплотехнических характеристик",
        "1 Общие сведения об объекте",
        "2 Геометрические показатели",
        "3 Конструктивные показатели оболочки",
        "4 Инженерные системы",
        "5 Проектные нагрузки",
        "6 Теплотехнические характеристики",
        "7 Энергетические показатели",
        "8 Рекомендации по эксплуатации",
        "Приложение А. Сведения, относимые к эксплуатационной стадии",
    ],
    "engineering-summary": [
        "1 Объект",
        "2 Ключевые исходные данные",
        "3 Главные расчётные показатели",
        "4 Заключение",
        "5 Риски и замечания",
        "6 Рекомендации",
    ],
};
function buildEmptyReportBaseData() {
    return buildReportBaseData({
        model: createEmptyBuildingModel(),
        projectId: "test-project",
        scenarioConfig: null,
        thermalResult: null,
        monteCarloResult: null,
        reportMeta: { ...DEFAULT_REPORT_META },
        generatedAt: new Date("2024-01-15T10:00:00Z"),
    });
}
test("buildReportBaseData accepts an empty BuildingModel without throwing", () => {
    const base = buildEmptyReportBaseData();
    if (!base.meta) {
        throw new Error("Базовые данные отчёта не содержат meta");
    }
});
const ALL_KINDS = [
    "project-ov-ts",
    "thermal-protection",
    "energy-passport",
    "operation-technical-passport",
    "engineering-summary",
];
for (const kind of ALL_KINDS) {
    test(`generator ${kind}: HTML содержит маркер шаблона`, () => {
        const base = buildEmptyReportBaseData();
        const html = renderReportHtml(kind, base);
        const marker = REPORT_EXPORT_TEMPLATE_MARKER[kind];
        if (!html.includes(marker)) {
            throw new Error(`HTML типа ${kind} не содержит маркер шаблона: ${marker}`);
        }
    });
    test(`generator ${kind}: HTML не содержит запрещённые строки`, () => {
        const base = buildEmptyReportBaseData();
        const html = renderReportHtml(kind, base);
        for (const forbidden of FORBIDDEN_STRINGS) {
            if (html.includes(forbidden)) {
                throw new Error(`HTML типа ${kind} содержит запрещённую строку: ${forbidden}`);
            }
        }
    });
    test(`generator ${kind}: HTML содержит ключевые разделы документа`, () => {
        const base = buildEmptyReportBaseData();
        const html = renderReportHtml(kind, base);
        const keywords = KIND_STRUCTURE_KEYWORDS[kind];
        for (const keyword of keywords) {
            if (!html.includes(keyword)) {
                throw new Error(`HTML типа ${kind} не содержит ожидаемый раздел: ${keyword}`);
            }
        }
    });
    test(`generator ${kind}: при отсутствии данных не подставляет сырые нули`, () => {
        const base = buildEmptyReportBaseData();
        const html = renderReportHtml(kind, base);
        const emptyModelMarkers = [
            "недостаточно данных",
            "не заполнено пользователем",
            "требуется задание исходного параметра",
            "не заполняется на проектной стадии",
            "устанавливается эксплуатирующей организацией",
            "требует уточнения",
        ];
        if (!emptyModelMarkers.some((marker) => html.includes(marker))) {
            throw new Error(`HTML типа ${kind} не использует понятные маркеры отсутствия данных при пустых исходных данных`);
        }
    });
}
test("generator project-ov-ts: основное содержание не выводит полный перечень конструкций", () => {
    const base = buildEmptyReportBaseData();
    const html = renderReportHtml("project-ov-ts", base);
    if (!html.includes("Полный перечень элементов наружной оболочки приведён в приложении А.")) {
        throw new Error("В разделе 7 ОВ/ТС должна быть сноска про полный перечень в приложении А");
    }
});
test("generator thermal-protection: упоминает справочную природу RC-оценки", () => {
    const base = buildEmptyReportBaseData();
    const html = renderReportHtml("thermal-protection", base);
    if (!html.includes("Справочная динамическая оценка не заменяет нормативную проверку по СП 50.")) {
        throw new Error("Документ \"Расчёт тепловой защиты\" должен пометить RC-модель как справочную.");
    }
});
test("generator operation-technical-passport: использует проектное наименование документа", () => {
    const base = buildEmptyReportBaseData();
    const html = renderReportHtml("operation-technical-passport", base);
    if (!html.includes("Паспорт проектных теплотехнических характеристик")) {
        throw new Error("Проектный паспорт должен использовать новое формальное наименование.");
    }
});
