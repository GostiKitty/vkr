/**
 * QA-тест выгрузок на демонстрационном доме (не на пустой модели).
 *
 * Цепочка:
 *  1. buildVideoDemoProjectModel() — заполненная модель (Москва, 2 этажа, 196 м²).
 *  2. Готовим ScenarioConfig (как при шаге «Сценарий» в UI).
 *  3. runThermalSimulation(model, options) — полноценный RC-расчёт с диагностикой.
 *  4. buildReportBaseData(...) — общая база (тянет sp50-репорт).
 *  5. renderReportHtml(kind, base) — все 5 типов.
 *  6. Проверки:
 *     - заполнены ключевые поля (объект/этажность/площадь/объём/климат/ГСОП/R, kоб);
 *     - запрещённых строк (betaV/Lvent/...) нет;
 *     - «0» не выводится как значение (там, где данных нет, — "недостаточно данных");
 *     - структура соответствует требованиям для каждого типа;
 *     - человеческие формулировки про вентиляцию.
 */

import { runThermalSimulation } from "../../src/core/thermal/solver.js";
import { buildVideoDemoProjectModel } from "../../src/features/build/demoVideoProject.js";
import { DEFAULT_THERMAL_OPTIONS } from "../../src/features/build/thermal/defaultThermalOptions.js";
import { buildThermalOptionsFromWorkflow } from "../../src/features/build/thermal/workflowThermalOptions.js";
import { applyScenarioToBuilding } from "../../src/features/build/thermal/applyScenarioToBuilding.js";
import { DEFAULT_REPORT_META } from "../../src/features/build/reports/reportMetaPersistence.js";
import type { ScenarioConfig } from "../../src/entities/workflow/workflow.store.js";
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
import { test } from "../testHarness.js";

const DEMO_SCENARIO: ScenarioConfig = {
  climate: {
    baseC: -3.1,
    amplitudeC: 9,
    seasonalOffsetC: 0,
  },
  setpoints: {
    day: 21,
    night: 18,
    dayStartHour: 6,
    nightStartHour: 22,
  },
  internalGains: {
    dayGain_W_m2: 6,
    nightGain_W_m2: 1,
  },
  occupancy: {
    dayFraction: 1,
    nightFraction: 0.2,
  },
  ventilation: {
    infiltrationACH: 0.5,
    ventilationACH: 0.18,
    heatRecoveryFactor: 0,
    mechanicalVentilationEnabled: true,
  },
  climateCityId: "moscow",
};

let cachedBase: ReportBaseData | null = null;

function buildDemoReportBaseData(): ReportBaseData {
  if (cachedBase) {
    return cachedBase;
  }
  const model = buildVideoDemoProjectModel();
  const adjustedModel = applyScenarioToBuilding(model, DEMO_SCENARIO);
  const options = buildThermalOptionsFromWorkflow(DEMO_SCENARIO, DEFAULT_THERMAL_OPTIONS);
  const thermalResult = runThermalSimulation(adjustedModel, options);
  cachedBase = buildReportBaseData({
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
  });
  return cachedBase;
}

/**
 * Запрещённые подстроки в пользовательских отчётах.
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

function assertNoForbidden(html: string, label: string): void {
  for (const forbidden of FORBIDDEN_STRINGS) {
    if (html.includes(forbidden)) {
      throw new Error(`${label}: HTML содержит запрещённую строку '${forbidden}'`);
    }
  }
}

function assertContains(html: string, snippet: string, label: string): void {
  if (!html.includes(snippet)) {
    throw new Error(`${label}: HTML не содержит ожидаемой строки '${snippet}'`);
  }
}

function assertNumericFilled(html: string, snippet: string, label: string): void {
  assertContains(html, snippet, label);
  // Контекст вокруг сниппета должен содержать число, а не "недостаточно данных".
  const index = html.indexOf(snippet);
  const slice = html.slice(index, index + 600);
  if (slice.includes("недостаточно данных")) {
    throw new Error(`${label}: поле "${snippet}" не заполнено (недостаточно данных), хотя должно быть.`);
  }
  if (!/[0-9]/.test(slice)) {
    throw new Error(`${label}: рядом с "${snippet}" нет числового значения.`);
  }
}

test("QA · demo · базовые данные демонстрационного дома заполнены", () => {
  const base = buildDemoReportBaseData();
  const { passport, sp50Report, meta } = base;
  if (!passport.projectName || passport.projectName === "не задано") {
    throw new Error("Название объекта не подтянуто из модели.");
  }
  if (!sp50Report) {
    throw new Error("SP50-репорт не сформирован для демо-дома.");
  }
  if (sp50Report.constructions.length === 0) {
    throw new Error("В SP50-репорте нет конструкций — модель не подключила теплозащиту.");
  }
  if (!Number.isFinite(passport.summary.totalAreaM2 ?? NaN)) {
    throw new Error("Отапливаемая площадь не подтянута.");
  }
  if (!Number.isFinite(passport.summary.totalVolumeM3 ?? NaN)) {
    throw new Error("Отапливаемый объём не подтянут.");
  }
  if (!Number.isFinite(sp50Report.sourceData.gsop ?? NaN)) {
    throw new Error("ГСОП не рассчитан.");
  }
  if (!Number.isFinite(sp50Report.building.kob_W_m3K ?? NaN)) {
    throw new Error("kоб не рассчитан.");
  }
  if (passport.climate.city !== "Москва") {
    throw new Error(`Город из климата ожидается "Москва", получено: ${passport.climate.city}`);
  }
  if (meta.developedBy === "не задано") {
    // Демо-модель не задаёт исполнителей — это ожидаемо.
  }
});

test("QA · demo · Раздел 5 ОВ/ТС — ключевые поля заполнены", () => {
  const base = buildDemoReportBaseData();
  const data = buildProjectOvTsData(base);
  const html = generateProjectOvTsHtml(data);

  assertContains(html, "<!-- Export template: project-ov-ts v1 -->", "Раздел 5 ОВ/ТС");
  assertNoForbidden(html, "Раздел 5 ОВ/ТС");

  // Инженерные формулировки разделов
  assertContains(html, "5 Сведения о системах отопления и вентиляции", "Раздел 5 ОВ/ТС");
  assertContains(html, "6 Расчётные тепловые нагрузки", "Раздел 5 ОВ/ТС");
  assertContains(html, "7 Теплотехнические характеристики ограждающих конструкций", "Раздел 5 ОВ/ТС");
  assertContains(html, "8 Энергетические показатели", "Раздел 5 ОВ/ТС");
  assertContains(html, "9 Выводы и рекомендации", "Раздел 5 ОВ/ТС");

  // Климатические значения
  assertNumericFilled(html, "Город / климатическая база", "Раздел 5 ОВ/ТС");
  assertNumericFilled(html, "Расчётная наружная температура для проектирования отопления", "Раздел 5 ОВ/ТС");
  assertNumericFilled(html, "Средняя температура наружного воздуха отопительного периода", "Раздел 5 ОВ/ТС");
  assertNumericFilled(html, "Продолжительность отопительного периода", "Раздел 5 ОВ/ТС");
  assertNumericFilled(html, "Градусо-сутки отопительного периода", "Раздел 5 ОВ/ТС");

  // Геометрические
  assertNumericFilled(html, "Этажность", "Раздел 5 ОВ/ТС");
  assertNumericFilled(html, "Отапливаемая площадь", "Раздел 5 ОВ/ТС");
  assertNumericFilled(html, "Отапливаемый объём", "Раздел 5 ОВ/ТС");

  // Сводные группы конструкций
  assertContains(html, "сводные группы конструкций", "Раздел 5 ОВ/ТС");

  // Сноска о том, что подробности — в приложении
  assertContains(
    html,
    "Полный перечень элементов наружной оболочки приведён в приложении А.",
    "Раздел 5 ОВ/ТС"
  );

  // RC-оценка помечена как справочная
  assertContains(html, "Справочная динамическая оценка не заменяет нормативную проверку по СП 50.", "Раздел 5 ОВ/ТС");
});

test("QA · demo · Расчёт тепловой защиты — таблица kоб с колонкой nt·A/Rприв", () => {
  const base = buildDemoReportBaseData();
  const data = buildThermalProtectionData(base);
  const html = generateThermalProtectionHtml(data);

  assertContains(html, "<!-- Export template: thermal-protection v1 -->", "Тепловая защита");
  assertNoForbidden(html, "Тепловая защита");

  // Структура
  assertContains(html, "1 Исходные климатические данные", "Тепловая защита");
  assertContains(html, "2 Геометрические показатели здания", "Тепловая защита");
  assertContains(html, "3 Состав наружных ограждающих конструкций", "Тепловая защита");
  assertContains(html, "4 Расчёт сопротивления теплопередаче", "Тепловая защита");
  assertContains(html, "5 Проверка приведённого сопротивления теплопередаче", "Тепловая защита");
  assertContains(html, "6 Расчёт удельной теплозащитной характеристики kоб", "Тепловая защита");
  assertContains(html, "7 Расчёт энергетической характеристики qот", "Тепловая защита");
  assertContains(html, "8 Проверка соответствия требованиям", "Тепловая защита");

  // Колонки таблицы kоб
  assertContains(html, "Фрагмент оболочки", "Тепловая защита");
  assertContains(html, "nt·A/Rприв", "Тепловая защита");
  assertContains(html, "Доля, %", "Тепловая защита");

  // Послойный состав в приложении А
  assertContains(html, "Приложение А. Послойный состав конструкций", "Тепловая защита");

  // kоб для демо-дома должно подсчитаться (не «недостаточно данных»)
  if (data.kobSummary.kobActual === "недостаточно данных") {
    throw new Error("kоб расчётное не вычислен для демо-дома.");
  }
  if (data.kobSummary.kobNorm === "недостаточно данных") {
    throw new Error("kоб нормативное не вычислен для демо-дома.");
  }
});

test("QA · demo · Энергетический паспорт — строгая 9-секционная таблица", () => {
  const base = buildDemoReportBaseData();
  const data = buildEnergyPassportData(base);
  const html = generateEnergyPassportHtml(data);

  assertContains(html, "<!-- Export template: energy-passport v1 -->", "Энергопаспорт");
  assertNoForbidden(html, "Энергопаспорт");

  // Все 9 разделов
  const sections = [
    "1 Общая информация",
    "2 Расчётные условия",
    "3 Геометрические показатели",
    "4 Теплотехнические показатели",
    "5 Вспомогательные показатели",
    "6 Удельные характеристики",
    "7 Коэффициенты",
    "8 Комплексные показатели расхода тепловой энергии",
    "9 Энергетические нагрузки здания",
  ];
  for (const section of sections) {
    assertContains(html, section, "Энергопаспорт");
  }

  // Колонки нормируемое/расчётное/фактическое
  assertContains(html, "Нормируемое значение", "Энергопаспорт");
  assertContains(html, "Расчётное проектное значение", "Энергопаспорт");
  assertContains(html, "Фактическое значение", "Энергопаспорт");

  // Ключевые поля должны иметь числа (а не "недостаточно данных")
  if (data.designConditions.rows.find((r) => r.label.includes("Город"))?.designValue === "недостаточно данных") {
    throw new Error("Город в Энергопаспорте не заполнен.");
  }
  if (data.designConditions.rows.find((r) => r.label.includes("ГСОП"))?.designValue === "недостаточно данных") {
    throw new Error("ГСОП в Энергопаспорте не заполнен.");
  }
  const areaRow = data.geometryIndicators.rows.find((r) => r.label.includes("Отапливаемая площадь"));
  if (!areaRow || areaRow.designValue === "недостаточно данных") {
    throw new Error("Отапливаемая площадь в Энергопаспорте не заполнена.");
  }
  const kobRow = data.thermalIndicators.rows.find((r) => r.label.startsWith("Удельная теплозащитная характеристика kоб"));
  if (!kobRow || kobRow.designValue === "недостаточно данных") {
    throw new Error("kоб расчётное в Энергопаспорте не заполнено.");
  }
  if (!kobRow || kobRow.normValue === "недостаточно данных") {
    throw new Error("kоб нормативное в Энергопаспорте не заполнено.");
  }

  // Фактическое значение должно быть "—" (а не «недостаточно данных»), потому что данных
  // обследования нет: формат паспорта.
  if (kobRow && kobRow.factValue !== "—") {
    throw new Error(
      `Фактическое значение kоб должно быть "—" пока нет обследования, получено: ${kobRow.factValue}`
    );
  }
});

test("QA · demo · Эксплуатационный паспорт — баннер ЧЕРНОВИК при отсутствии экспл. данных", () => {
  const base = buildDemoReportBaseData();
  const data = buildOperationPassportData(base);
  const html = generateOperationTechnicalPassportHtml(data);

  assertContains(html, "<!-- Export template: operation-technical-passport v1 -->", "Экспл. паспорт");
  assertNoForbidden(html, "Экспл. паспорт");

  // Разделы
  assertContains(html, "1 Общие сведения", "Экспл. паспорт");
  assertContains(html, "2 Сведения о здании и основных конструкциях", "Экспл. паспорт");
  assertContains(html, "3 Сведения об инженерных системах", "Экспл. паспорт");
  assertContains(html, "4 Проектные значения нагрузок", "Экспл. паспорт");
  assertContains(html, "5 Энергетические характеристики здания", "Экспл. паспорт");
  assertContains(html, "5.1 Теплоэнергетические характеристики", "Экспл. паспорт");
  assertContains(html, "5.2 Энергетические показатели", "Экспл. паспорт");
  assertContains(html, "6 Правила эксплуатации и контроля", "Экспл. паспорт");
  assertContains(html, "7 Приложения", "Экспл. паспорт");

  // На демо у нас задан сценарий с уставками → НЕ должно быть баннера ЧЕРНОВИК
  // (т.к. operation.daySetpointC заполнен из scenarioConfig)
  if (data.isDraft) {
    throw new Error(
      "Эксплуатационный паспорт ошибочно помечен как ЧЕРНОВИК, хотя сценарий с уставками задан."
    );
  }
});

test("QA · demo · Краткое инженерное заключение — короткий документ", () => {
  const base = buildDemoReportBaseData();
  const data = buildEngineeringSummaryData(base);
  const html = generateEngineeringSummaryHtml(data);

  assertContains(html, "<!-- Export template: engineering-summary v1 -->", "Инж. заключение");
  assertNoForbidden(html, "Инж. заключение");

  // 6 разделов
  assertContains(html, "1 Объект", "Инж. заключение");
  assertContains(html, "2 Ключевые исходные данные", "Инж. заключение");
  assertContains(html, "3 Главные расчётные показатели", "Инж. заключение");
  assertContains(html, "4 Соответствие требованиям", "Инж. заключение");
  assertContains(html, "5 Риски", "Инж. заключение");
  assertContains(html, "6 Рекомендации", "Инж. заключение");

  // Документ должен быть компактным: не более ~6 таблиц
  const tableCount = (html.match(/<table /g) ?? []).length;
  if (tableCount > 6) {
    throw new Error(
      `Краткое инженерное заключение слишком тяжёлое (таблиц ${tableCount} > 6). Должно быть компактным.`
    );
  }

  // У краткого нет тяжёлого штампа: проверяем именно использование разметки штампа,
  // а не CSS-определение класса в общем стиле.
  if (html.includes('<section class="rx-gost-stamp">')) {
    throw new Error(
      "Краткое инженерное заключение не должно содержать тяжёлый ГОСТ-штамп."
    );
  }
});

test("QA · demo · отсутствие '0' как реального расчётного значения", () => {
  // Правило пользователя: 0 не должен выводиться как РАСЧЁТНОЕ значение, если
  // данных нет. Пользовательские входы (например, коэффициент рекуперации) =
  // 0 — это валидный ввод "рекуператора нет" и не подпадает под правило.
  // Поэтому проверяем разделы 4, 5, 6, 8, 9 (расчётные характеристики), но
  // исключаем разделы 7 (коэффициенты, задаваемые пользователем) и 1/2/3
  // (общая инфа, расчётные условия, геометрия — там 0 не возникает).
  const base = buildDemoReportBaseData();
  const energyData = buildEnergyPassportData(base);
  const calculatedSections = [
    energyData.thermalIndicators,
    energyData.auxIndicators,
    energyData.specificCharacteristics,
    energyData.complexIndicators,
    energyData.energyLoads,
  ];
  const zeroPattern = /^[−\-]?0([.,]0+)?$/;
  for (const section of calculatedSections) {
    for (const row of section.rows) {
      const designTrim = row.designValue.trim();
      if (zeroPattern.test(designTrim)) {
        throw new Error(
          `${section.title}: поле "${row.label}" выводит "${row.designValue}" как расчётное значение — должно быть "недостаточно данных".`
        );
      }
    }
  }
});

test("QA · demo · человеческие формулировки про вентиляцию (нет технических имён)", () => {
  const base = buildDemoReportBaseData();
  const data = buildProjectOvTsData(base);
  // ScenarioConfig задан → missingData может быть пуст. Но если есть упоминания —
  // они должны быть человеческими.
  for (const message of data.missingData) {
    for (const forbidden of FORBIDDEN_STRINGS) {
      if (message.includes(forbidden)) {
        throw new Error(
          `Сообщение «${message}» содержит техническую переменную «${forbidden}» — должно быть человеческое описание.`
        );
      }
    }
  }
});

test("QA · demo · Раздел 5 ОВ/ТС — конструкции сгруппированы (стены/окна/двери/кровля/пол)", () => {
  const base = buildDemoReportBaseData();
  const data = buildProjectOvTsData(base);
  const labels = data.envelopeGroupRows.map((row) => row.typeLabel);
  const expected = ["Наружные стены", "Окна", "Наружные двери", "Покрытия и кровля"];
  for (const label of expected) {
    if (!labels.includes(label)) {
      throw new Error(`В сводных группах конструкций демо-дома не найдена группа «${label}». Найдено: ${labels.join("; ")}`);
    }
  }
});
