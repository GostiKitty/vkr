/**
 * Тесты профиля проектных допущений для демо-дома и связанной с ним
 * системы скачивания документов (часть 7 ТЗ).
 *
 *  1. demo-defaults не перезаписывают пользовательские значения.
 *  2. demo-defaults заполняют только пустые поля.
 *  3. В HTML есть блок «Принятые проектные допущения».
 *  4. Значения из demo-default помечены сноской «*».
 *  5. Фактические значения энергопаспорта остаются «—».
 *  6. qrad не подменяется фейковым числом.
 *  7. Все 5 документов можно сгенерировать и скачать как HTML.
 *  8. «Скачать все документы» формирует 5 файлов.
 *  9. Все первые 4 документа содержат ГОСТ-штамп.
 * 10. Краткое инженерное заключение без тяжёлого штампа, но в стиле A4/ГОСТ.
 * 11. В экспортируемом HTML нет запрещённых строк.
 */

import { test } from "../testHarness.js";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { buildVideoDemoProjectModel } from "../../src/features/build/demoVideoProject.js";
import { DEFAULT_REPORT_META } from "../../src/features/build/reports/reportMetaPersistence.js";
import {
  buildReportBaseData,
  type BuildReportBaseDataInput,
} from "../../src/features/reports/exports/data/buildReportBaseData.js";
import { buildEnergyPassportData } from "../../src/features/reports/exports/data/buildEnergyPassportData.js";
import { buildProjectOvTsData } from "../../src/features/reports/exports/data/buildProjectOvTsData.js";
import { buildThermalProtectionData } from "../../src/features/reports/exports/data/buildThermalProtectionData.js";
import { buildOperationPassportData } from "../../src/features/reports/exports/data/buildOperationPassportData.js";
import { buildEngineeringSummaryData } from "../../src/features/reports/exports/data/buildEngineeringSummaryData.js";
import { generateEnergyPassportHtml } from "../../src/features/reports/exports/generators/energyPassport.js";
import { generateProjectOvTsHtml } from "../../src/features/reports/exports/generators/projectOvTs.js";
import { generateThermalProtectionHtml } from "../../src/features/reports/exports/generators/thermalProtection.js";
import { generateOperationTechnicalPassportHtml } from "../../src/features/reports/exports/generators/operationTechnicalPassport.js";
import { generateEngineeringSummaryHtml } from "../../src/features/reports/exports/generators/engineeringSummary.js";
import {
  applyDemoDesignDefaults,
  DEMO_DEFAULT_FOOTNOTE,
  DEMO_HOUSE_DESIGN_DEFAULTS,
  ASSUMPTIONS_SECTION_TITLE,
} from "../../src/features/reports/exports/defaults/demoHouseDesignDefaults.js";
import { renderReportHtml } from "../../src/features/reports/exports/exportReportDocument.js";
import {
  ALL_REPORT_EXPORT_KINDS,
  REPORT_EXPORT_BUNDLE_FILENAME,
} from "../../src/features/reports/exports/exportReportDocument.js";

const FORBIDDEN_STRINGS = [
  "betaV",
  "Lvent",
  "Ginf",
  "nVent",
  "nInf",
  "констант",
  "Space 1",
  "report-actions",
  "сертификаты",
  "ConsultantPlus",
];

function emptyInput(): BuildReportBaseDataInput {
  return {
    model: createEmptyBuildingModel(),
    projectId: "local:demo-video",
    scenarioConfig: null,
    thermalResult: null,
    monteCarloResult: null,
    reportMeta: {
      ...DEFAULT_REPORT_META,
      // Сбрасываем поля, которые в DEFAULT_REPORT_META уже непустые,
      // чтобы профиль defaults действительно сработал на «пустом» входе.
      documentStage: "",
      projectSection: "",
    },
    generatedAt: new Date("2026-05-21T10:00:00Z"),
  };
}

function assertContains(html: string, snippet: string, label: string): void {
  if (!html.includes(snippet)) {
    throw new Error(`${label}: HTML не содержит ожидаемой строки '${snippet}'.`);
  }
}

function assertNotContains(html: string, snippet: string, label: string): void {
  if (html.includes(snippet)) {
    throw new Error(`${label}: HTML неожиданно содержит '${snippet}'.`);
  }
}

function assertNoForbiddenStrings(html: string, label: string): void {
  for (const forbidden of FORBIDDEN_STRINGS) {
    if (html.includes(forbidden)) {
      throw new Error(`${label}: запрещённая строка '${forbidden}' найдена в HTML.`);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Defaults не перезаписывают введённые пользователем значения.
// ──────────────────────────────────────────────────────────────────────────

test("demo-defaults: пользовательские значения не перезаписываются", () => {
  const userInput = emptyInput();
  userInput.model.thermalProtection = {
    buildingCategory: "public",
    climate: {
      city: "Санкт-Петербург",
      indoorTemperatureC: 18,
      indoorRelativeHumidityPercent: 45,
      humidityZone: "wet",
    },
    moistureMode: "wet",
    operationCondition: "A",
  };
  userInput.reportMeta = {
    ...userInput.reportMeta,
    projectCipher: "ОВ-2024-007",
    documentStage: "Р",
    documentCity: "Санкт-Петербург",
  };

  const { input, appliedAssumptions } = applyDemoDesignDefaults(userInput);

  if (input.model.thermalProtection?.climate?.city !== "Санкт-Петербург") {
    throw new Error("Город пользователя был перезаписан defaults.");
  }
  if (input.model.thermalProtection?.climate?.indoorTemperatureC !== 18) {
    throw new Error("Внутренняя температура пользователя была перезаписана defaults.");
  }
  if (input.model.thermalProtection?.buildingCategory !== "public") {
    throw new Error("Назначение здания пользователя было перезаписано defaults.");
  }
  if (input.reportMeta.projectCipher !== "ОВ-2024-007") {
    throw new Error("Шифр документа пользователя был перезаписан defaults.");
  }
  if (input.reportMeta.documentStage !== "Р") {
    throw new Error("Стадия документа пользователя была перезаписана defaults.");
  }
  // Если пользовательских пробелов не было, реестр допущений должен быть пуст.
  const overwrittenKeys = appliedAssumptions
    .filter((entry) =>
      [
        "climate.city",
        "climate.indoorTemperatureC",
        "climate.indoorRelativeHumidityPercent",
        "climate.humidityZone",
        "thermalProtection.buildingCategory",
        "thermalProtection.moistureMode",
        "thermalProtection.operationCondition",
        "reportMeta.projectCipher",
        "reportMeta.documentStage",
        "reportMeta.documentCity",
      ].includes(entry.key)
    )
    .map((entry) => entry.key);
  if (overwrittenKeys.length > 0) {
    throw new Error(
      `Defaults записали в уже заполненные поля: ${overwrittenKeys.join(", ")}`
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 2. Defaults заполняют только пустые поля.
// ──────────────────────────────────────────────────────────────────────────

test("demo-defaults: заполняют только пустые поля и регистрируют допущения", () => {
  const empty = emptyInput();
  const { input, appliedAssumptions } = applyDemoDesignDefaults(empty);

  const climate = input.model.thermalProtection?.climate ?? {};
  if (climate.city !== DEMO_HOUSE_DESIGN_DEFAULTS.city) {
    throw new Error("Город не подставлен из defaults.");
  }
  if (climate.indoorTemperatureC !== DEMO_HOUSE_DESIGN_DEFAULTS.indoorDesignTemperatureC) {
    throw new Error("Внутренняя температура не подставлена.");
  }
  if (
    input.reportMeta.projectCipher !== DEMO_HOUSE_DESIGN_DEFAULTS.projectCode ||
    input.reportMeta.documentStage !== DEMO_HOUSE_DESIGN_DEFAULTS.stage
  ) {
    throw new Error("Шифр / стадия документа не подставлены из defaults.");
  }
  const requiredKeys = [
    "climate.city",
    "climate.indoorTemperatureC",
    "climate.indoorRelativeHumidityPercent",
    "reportMeta.projectCipher",
    "reportMeta.documentStage",
  ];
  for (const key of requiredKeys) {
    if (!appliedAssumptions.some((entry) => entry.key === key)) {
      throw new Error(`Не зарегистрировано допущение для пустого поля: ${key}`);
    }
  }
  for (const entry of appliedAssumptions) {
    if (entry.source !== "demo-default") {
      throw new Error(`Источник допущения должен быть demo-default, получено: ${entry.source}`);
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 3. Блок «Принятые проектные допущения» появляется в HTML.
// 4. Значения из demo-default помечены сноской «*».
// ──────────────────────────────────────────────────────────────────────────

test("demo-defaults: блок «Принятые проектные допущения» и сноска * присутствуют", () => {
  const { input, appliedAssumptions } = applyDemoDesignDefaults(emptyInput());
  const base = buildReportBaseData({ ...input, appliedAssumptions });

  // Энергопаспорт: и блок, и сноска
  const energyHtml = generateEnergyPassportHtml(buildEnergyPassportData(base), {
    appliedAssumptions: base.appliedAssumptions,
  });
  assertContains(energyHtml, ASSUMPTIONS_SECTION_TITLE, "Энергопаспорт.assumptions");
  assertContains(energyHtml, DEMO_DEFAULT_FOOTNOTE, "Энергопаспорт.footnote");
  if (!energyHtml.includes("Москва *")) {
    throw new Error(
      "Город в энергопаспорте должен быть помечен сноской «*», когда подставлен из defaults."
    );
  }

  // Раздел 5 ОВ/ТС
  const ovtsHtml = generateProjectOvTsHtml(buildProjectOvTsData(base), {
    appliedAssumptions: base.appliedAssumptions,
  });
  assertContains(ovtsHtml, ASSUMPTIONS_SECTION_TITLE, "ОВ/ТС.assumptions");

  // Расчёт тепловой защиты
  const tpHtml = generateThermalProtectionHtml(buildThermalProtectionData(base), {
    appliedAssumptions: base.appliedAssumptions,
  });
  assertContains(tpHtml, ASSUMPTIONS_SECTION_TITLE, "Тепловая защита.assumptions");

  // Экспл. паспорт
  const opHtml = generateOperationTechnicalPassportHtml(buildOperationPassportData(base), {
    appliedAssumptions: base.appliedAssumptions,
  });
  assertContains(opHtml, ASSUMPTIONS_SECTION_TITLE, "Экспл. паспорт.assumptions");

  // Краткое заключение
  const esHtml = generateEngineeringSummaryHtml(buildEngineeringSummaryData(base), {
    appliedAssumptions: base.appliedAssumptions,
  });
  assertContains(esHtml, ASSUMPTIONS_SECTION_TITLE, "Инж. заключение.assumptions");
});

test("demo-defaults: блок «Принятые проектные допущения» НЕ выводится, если допущений нет", () => {
  // Без applyDemoDesignDefaults: passport energy всё ещё может добавить
  // SOLAR_GAIN_METHODOLOGY_ASSUMPTION, и тогда блок появится. Проверим именно
  // случай, когда нет НИКАКИХ допущений: модель пустая → нет sp50Report → нет
  // авто-допущений → блок отсутствует.
  const base = buildReportBaseData(emptyInput());
  if (base.appliedAssumptions.length !== 0) {
    throw new Error(
      `На пустой модели не должно быть авто-допущений, получено: ${base.appliedAssumptions
        .map((e) => e.key)
        .join(", ")}`
    );
  }
  const ovtsHtml = generateProjectOvTsHtml(buildProjectOvTsData(base), {
    appliedAssumptions: base.appliedAssumptions,
  });
  assertNotContains(ovtsHtml, ASSUMPTIONS_SECTION_TITLE, "ОВ/ТС: без допущений блок не должен выводиться");
});

// ──────────────────────────────────────────────────────────────────────────
// 5. Фактические значения энергопаспорта остаются «—», даже после defaults.
// ──────────────────────────────────────────────────────────────────────────

test("demo-defaults: фактические значения энергопаспорта остаются «—» после применения", () => {
  const { input, appliedAssumptions } = applyDemoDesignDefaults(emptyInput());
  const base = buildReportBaseData({ ...input, appliedAssumptions });
  const energy = buildEnergyPassportData(base);
  const sections = [
    energy.generalInfo,
    energy.designConditions,
    energy.geometryIndicators,
    energy.thermalIndicators,
    energy.auxIndicators,
    energy.specificCharacteristics,
    energy.coefficients,
    energy.complexIndicators,
    energy.energyLoads,
  ];
  for (const section of sections) {
    for (const row of section.rows) {
      if (row.factValue !== "—") {
        throw new Error(
          `${section.title}: фактическое значение «${row.label}» = «${row.factValue}» — должно быть «—».`
        );
      }
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 6. qrad не подменяется фейковым числом.
// ──────────────────────────────────────────────────────────────────────────

test("qrad: не подменяется фейковым числом — выводится текстовый статус (демо-дом)", () => {
  // На реальном демонстрационном доме (с заполненной оболочкой) qrad движка
  // очень маленький и округляется в 0 → должна вернуться формулировка
  // «требует уточнения методики расчёта солнечных теплопоступлений».
  const demoInput: BuildReportBaseDataInput = {
    model: buildVideoDemoProjectModel(),
    projectId: "local:demo-video",
    scenarioConfig: null,
    thermalResult: null,
    monteCarloResult: null,
    reportMeta: { ...DEFAULT_REPORT_META },
    generatedAt: new Date("2026-05-21T10:00:00Z"),
  };
  const base = buildReportBaseData(demoInput);
  const energy = buildEnergyPassportData(base);
  const solarRow = energy.auxIndicators.rows.find((r) => r.key === "ep-5-solarGain");
  if (!solarRow) {
    throw new Error("Не найдена строка qrad в энергопаспорте.");
  }
  if (!solarRow.designValue.includes("требует уточнения")) {
    throw new Error(
      `qrad должен выводить текстовый статус «требует уточнения...», получено: ${solarRow.designValue}`
    );
  }
  // Авто-допущение «методика qrad требует уточнения» должно попадать в реестр.
  const auto = base.appliedAssumptions.some(
    (entry) => entry.key === "energy.solarGain.methodology"
  );
  if (!auto) {
    throw new Error(
      "Авто-допущение про методику qrad должно автоматически попадать в реестр."
    );
  }
  // В блоке «Принятые проектные допущения» в энергопаспорте должна быть
  // строка про солнечные теплопоступления.
  const html = generateEnergyPassportHtml(buildEnergyPassportData(base), {
    appliedAssumptions: base.appliedAssumptions,
  });
  if (!html.includes("Солнечные теплопоступления")) {
    throw new Error("Блок «Принятые проектные допущения» должен упоминать «Солнечные теплопоступления».");
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 7. Все 5 документов можно сгенерировать.
// ──────────────────────────────────────────────────────────────────────────

test("экспорт: все 5 документов формируются (renderReportHtml) на пустой модели", () => {
  const base = buildReportBaseData(emptyInput());
  for (const kind of ALL_REPORT_EXPORT_KINDS) {
    const html = renderReportHtml(kind, base);
    if (typeof html !== "string" || html.length < 200) {
      throw new Error(`HTML для типа ${kind} слишком короткий: ${html.length} символов.`);
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 8. «Скачать все документы» формирует 5 файлов с понятными именами.
// ──────────────────────────────────────────────────────────────────────────

test("download-all: формирует 5 файлов с корректными именами 01-…, 02-…, …", () => {
  if (Object.keys(REPORT_EXPORT_BUNDLE_FILENAME).length !== 5) {
    throw new Error("Ожидается ровно 5 имён файлов для пакета.");
  }
  const expected = [
    "01-razdel-5-ov-ts.html",
    "02-raschet-teplovoy-zashchity.html",
    "03-energeticheskiy-pasport.html",
    "04-ekspluatacionno-tehnicheskiy-pasport.html",
    "05-inzhenernoe-zaklyuchenie.html",
  ];
  const actual = ALL_REPORT_EXPORT_KINDS.map((kind) => REPORT_EXPORT_BUNDLE_FILENAME[kind]);
  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) {
      throw new Error(
        `Имя файла ${i + 1} не совпало: ожидалось ${expected[i]}, получено ${actual[i]}.`
      );
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 9. Все первые 4 документа содержат ГОСТ-штамп.
// ──────────────────────────────────────────────────────────────────────────

test("ГОСТ: первые 4 документа содержат штамп rx-gost-stamp", () => {
  const base = buildReportBaseData(emptyInput());
  const checks: Array<{ name: string; html: string }> = [
    { name: "ОВ/ТС", html: renderReportHtml("project-ov-ts", base) },
    { name: "Тепловая защита", html: renderReportHtml("thermal-protection", base) },
    { name: "Энергопаспорт", html: renderReportHtml("energy-passport", base) },
    { name: "Экспл. паспорт", html: renderReportHtml("operation-technical-passport", base) },
  ];
  for (const c of checks) {
    if (!c.html.includes('<section class="rx-gost-stamp">')) {
      throw new Error(`${c.name}: не содержит ГОСТ-штамп.`);
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 10. Краткое заключение без тяжёлого штампа, но в стиле A4/ГОСТ.
// ──────────────────────────────────────────────────────────────────────────

test("ГОСТ: краткое заключение без тяжёлого штампа, но с A4/Times New Roman", () => {
  const base = buildReportBaseData(emptyInput());
  const html = renderReportHtml("engineering-summary", base);
  if (html.includes('<section class="rx-gost-stamp">')) {
    throw new Error("Краткое заключение не должно содержать тяжёлый ГОСТ-штамп.");
  }
  if (!html.includes("Times New Roman")) {
    throw new Error("Краткое заключение должно использовать Times New Roman в стиле.");
  }
  if (!html.includes("size: A4")) {
    throw new Error("Краткое заключение должно объявлять размер A4 в стиле.");
  }
});

// ──────────────────────────────────────────────────────────────────────────
// 11. В экспортируемом HTML нет запрещённых строк.
// ──────────────────────────────────────────────────────────────────────────

test("запрещённые строки: ни один из 5 типов не содержит betaV/Lvent/Ginf/…/ConsultantPlus", () => {
  const { input, appliedAssumptions } = applyDemoDesignDefaults(emptyInput());
  const base = buildReportBaseData({ ...input, appliedAssumptions });
  for (const kind of ALL_REPORT_EXPORT_KINDS) {
    const html = renderReportHtml(kind, base);
    assertNoForbiddenStrings(html, `Тип ${kind}`);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Дополнительно: ГОСТ-стиль не содержит Tailwind, градиентов и теней.
// ──────────────────────────────────────────────────────────────────────────

test("ГОСТ-стиль: нет Tailwind/градиентов/теней/report-actions внутри документа", () => {
  const base = buildReportBaseData(emptyInput());
  const html = renderReportHtml("project-ov-ts", base);
  const blacklist = [
    "linear-gradient",
    "radial-gradient",
    "box-shadow:",
    "ui-panel",
    "ui-control",
    "report-actions", // запрещённая строка (часть 11), но также проверяем стиль
  ];
  for (const item of blacklist) {
    if (html.includes(item)) {
      throw new Error(`ГОСТ-стиль: документ неожиданно содержит '${item}'.`);
    }
  }
});
