import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import {
  buildReportBaseData,
  type ReportBaseData,
} from "../../src/features/reports/exports/data/buildReportBaseData.js";
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
import {
  REPORT_EXPORT_TEMPLATE_MARKER,
  type ReportExportKind,
} from "../../src/features/reports/exports/types.js";
import { DEFAULT_REPORT_META } from "../../src/features/build/reports/reportMetaPersistence.js";
import { test } from "../testHarness.js";

function renderReportHtml(kind: ReportExportKind, base: ReportBaseData): string {
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
      const exhaustive: never = kind;
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

const KIND_STRUCTURE_KEYWORDS: Record<ReportExportKind, string[]> = {
  "project-ov-ts": [
    "Ведомость исходных данных",
    "1 Общие положения",
    "2 Основания для выполнения расчёта",
    "3 Исходные климатические условия",
    "4 Сведения об объекте и цифровой модели",
    "5 Сведения о системах отопления и вентиляции",
    "6 Расчётные тепловые нагрузки",
    "8 Энергетические показатели",
    "10 Перечень данных, требующих уточнения",
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
    "Расчёт сопротивления теплопередаче",
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
    "Энергетический паспорт здания",
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
    "Фактическое значение",
  ],
  "operation-technical-passport": [
    "1 Общие сведения",
    "2 Сведения о здании и основных конструкциях",
    "3 Сведения об инженерных системах",
    "4 Проектные значения нагрузок",
    "5 Энергетические характеристики здания",
    "5.1 Теплоэнергетические характеристики",
    "5.2 Энергетические показатели",
    "6 Правила эксплуатации и контроля",
    "7 Приложения",
  ],
  "engineering-summary": [
    "1 Объект",
    "2 Ключевые исходные данные",
    "3 Главные расчётные показатели",
    "4 Соответствие требованиям",
    "5 Риски",
    "6 Рекомендации",
  ],
};

function buildEmptyReportBaseData(): ReportBaseData {
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

const ALL_KINDS: ReportExportKind[] = [
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
      throw new Error(
        `HTML типа ${kind} не использует понятные маркеры отсутствия данных при пустых исходных данных`
      );
    }
  });
}

test("generator project-ov-ts: основное содержание не выводит полный перечень конструкций", () => {
  const base = buildEmptyReportBaseData();
  const html = renderReportHtml("project-ov-ts", base);
  if (!html.includes("Полный перечень элементов наружной оболочки приведён в приложении А.")) {
    throw new Error(
      "В разделе 7 ОВ/ТС должна быть сноска про полный перечень в приложении А"
    );
  }
});

test("generator thermal-protection: упоминает справочную природу RC-оценки", () => {
  const base = buildEmptyReportBaseData();
  const html = renderReportHtml("thermal-protection", base);
  if (!html.includes("Справочная динамическая оценка не заменяет нормативную проверку по СП 50.")) {
    throw new Error(
      "Документ \"Расчёт тепловой защиты\" должен пометить RC-модель как справочную."
    );
  }
});

test("generator operation-technical-passport: помечается как черновик при отсутствии эксплуатационных данных", () => {
  const base = buildEmptyReportBaseData();
  const html = renderReportHtml("operation-technical-passport", base);
  if (!html.includes("Справочный документ")) {
    throw new Error(
      "Эксплуатационно-технический паспорт без эксплуатационных данных должен быть помечен как справочный черновик."
    );
  }
});
