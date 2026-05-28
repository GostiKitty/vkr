import { test } from "../testHarness.js";
import { buildVideoDemoProjectModel } from "../../src/features/build/demoVideoProject.js";
import { DEFAULT_REPORT_META } from "../../src/features/build/reports/reportMetaPersistence.js";
import {
  buildReportBaseData,
  type BuildReportBaseDataInput,
} from "../../src/features/reports/exports/data/buildReportBaseData.js";
import { buildExportEnvelopeView } from "../../src/features/reports/exports/data/buildExportEnvelopeView.js";
import { buildEnergyPassportData } from "../../src/features/reports/exports/data/buildEnergyPassportData.js";
import { buildOperationPassportData } from "../../src/features/reports/exports/data/buildOperationPassportData.js";
import { buildEngineeringSummaryData } from "../../src/features/reports/exports/data/buildEngineeringSummaryData.js";
import {
  ALL_REPORT_EXPORT_KINDS,
  renderReportHtml,
} from "../../src/features/reports/exports/exportReportDocument.js";
import { prepareExportReportInput } from "../../src/features/reports/exports/prepareExportReportInput.js";

function buildRawDemoInput(): BuildReportBaseDataInput {
  return {
    model: buildVideoDemoProjectModel(),
    projectId: "local:demo-video",
    scenarioConfig: null,
    thermalResult: null,
    monteCarloResult: null,
    reportMeta: {
      ...DEFAULT_REPORT_META,
      projectCipher: "",
      buildingAddress: "",
      developerOrg: "",
      customerOrg: "",
      documentStage: "",
      documentCity: "",
    },
    generatedAt: new Date("2026-05-21T10:00:00Z"),
  };
}

function buildPreparedDemoBase() {
  const prepared = prepareExportReportInput(buildRawDemoInput(), {
    applyDemoDefaults: true,
  });
  return buildReportBaseData({
    ...prepared.input,
    appliedAssumptions: prepared.appliedAssumptions,
  });
}

function assertNotContains(haystack: string, needle: string, label: string): void {
  if (haystack.includes(needle)) {
    throw new Error(`${label}: найдено запрещённое значение '${needle}'.`);
  }
}

function assertContains(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}: не найдено ожидаемое значение '${needle}'.`);
  }
}

test("demo export quality: defaults закрывают титул без скрытого автозапуска RC", () => {
  const base = buildPreparedDemoBase();
  if (base.source.dynamicResultState !== "missing" && base.source.dynamicResultState !== "provided") {
    throw new Error(`Ожидалось отсутствие скрытого RC-результата или готовый результат, получено: ${base.source.dynamicResultState}`);
  }
  if (base.meta.organization === "не задано") {
    throw new Error("Организация не подставлена demo defaults.");
  }
  if (base.meta.customer === "не задано") {
    throw new Error("Заказчик не подставлен demo defaults.");
  }
  if (base.meta.address === "не задано") {
    throw new Error("Адрес не подставлен demo defaults.");
  }
  if (base.meta.developedBy === "не задано") {
    throw new Error("Подписант «Разработал» не подставлен demo defaults.");
  }
  if (base.meta.documentCode === "б/н") {
    throw new Error("Шифр документа не должен оставаться «б/н» при включённых demo defaults.");
  }
  if (base.source.dynamicResultState === "provided") {
    if (!Number.isFinite(base.passport.thermalResults.peakLoadKW ?? NaN)) {
      throw new Error("Готовый RC-результат не заполнил пиковую нагрузку.");
    }
    if (!Number.isFinite(base.passport.thermalResults.totalEnergyKWh ?? NaN)) {
      throw new Error("Готовый RC-результат не заполнил тепловую энергию за период.");
    }
  } else {
    if (Number.isFinite(base.passport.thermalResults.peakLoadKW ?? NaN)) {
      throw new Error("При отсутствии RC-результата пиковая нагрузка не должна подставляться скрыто.");
    }
    if (Number.isFinite(base.passport.thermalResults.totalEnergyKWh ?? NaN)) {
      throw new Error("При отсутствии RC-результата тепловая энергия не должна подставляться скрыто.");
    }
  }
  if (base.source.dynamicResultState === "provided") {
    if (!Number.isFinite(base.passport.thermalResults.averageRoomTemperatureC ?? NaN)) {
      throw new Error("Готовый RC-результат не заполнил среднюю температуру помещений.");
    }
  } else if (Number.isFinite(base.passport.thermalResults.averageRoomTemperatureC ?? NaN)) {
    throw new Error("При отсутствии RC-результата средняя температура помещений не должна подставляться скрыто.");
  }
});

test("demo export quality: в 5 документах нет raw enum/source значений", () => {
  const base = buildPreparedDemoBase();
  const forbidden = ["normal", "residential", "demo-default", "scenario", "calculated", "user-meta"];
  for (const kind of ALL_REPORT_EXPORT_KINDS) {
    const html = renderReportHtml(kind, base);
    for (const needle of forbidden) {
      assertNotContains(html, needle, kind);
    }
  }
});

test("demo export quality: технические ID не попадают в основную часть документов", () => {
  const base = buildPreparedDemoBase();
  for (const kind of ALL_REPORT_EXPORT_KINDS) {
    const html = renderReportHtml(kind, base);
    const mainPart = html.split("Приложение")[0] ?? html;
    if (/video-l1|video-l2/i.test(mainPart)) {
      throw new Error(`${kind}: технические ID попали в основную часть документа.`);
    }
    if (/video-l1|video-l2/i.test(html) && !html.includes("ID модели")) {
      throw new Error(`${kind}: технические ID допустимы только рядом с колонкой «ID модели».`);
    }
  }
});

test("demo export quality: в пользовательских разделах нет Space, auto-room и сырых model ids", () => {
  const base = buildPreparedDemoBase();
  const forbiddenEverywhere = ["Space 1", "Space 2", "Space 3", "auto-room"];
  for (const kind of ALL_REPORT_EXPORT_KINDS) {
    const html = renderReportHtml(kind, base);
    forbiddenEverywhere.forEach((needle) => assertNotContains(html, needle, kind));

    const mainPart = html.split("Приложение")[0] ?? html;
    ["video-l1", "video-l2"].forEach((needle) => assertNotContains(mainPart, needle, kind));
  }
});

test("demo export quality: внутренние двери и перегородки исключаются из наружной оболочки", () => {
  const base = buildPreparedDemoBase();
  const envelopeView = buildExportEnvelopeView({
    model: base.source.model,
    constructions: base.sp50Report?.constructions ?? [],
    heatedVolumeM3: base.passport.summary.totalVolumeM3,
    kobNorm: base.sp50Report?.building.kobNorm_W_m3K ?? null,
    outdoorDesignTemperatureC: base.passport.climate.outdoorDesignTemperatureC,
  });

  const forbiddenIncluded = [
    "video-l1-door-living-bedroom",
    "video-l1-door-kitchen-utility",
    "video-l2-door-stair",
    "video-l1-center-vert-lower",
    "video-l1-center-horiz-left",
  ];

  forbiddenIncluded.forEach((modelId) => {
    if (envelopeView.includedElements.some((entry) => entry.modelId === modelId)) {
      throw new Error(`Элемент ${modelId} ошибочно включён в наружную оболочку.`);
    }
    const appendixEntry = envelopeView.appendixElements.find((entry) => entry.modelId === modelId);
    if (!appendixEntry) {
      throw new Error(`Элемент ${modelId} должен оставаться в приложении для проверки классификации.`);
    }
    if (appendixEntry.classification === "included") {
      throw new Error(`Элемент ${modelId} не был исключён из наружной оболочки.`);
    }
    if (appendixEntry.status !== "не участвует в проверке наружной оболочки") {
      throw new Error(
        `Элемент ${modelId} должен иметь спокойный статус исключения, получено: ${appendixEntry.status}`
      );
    }
    if (!appendixEntry.classificationNote.includes("внутренним конструкциям")) {
      throw new Error(`Элемент ${modelId} должен содержать понятную пометку о внутренних конструкциях.`);
    }
    if (envelopeView.criticalElements.some((entry) => entry.modelId === modelId)) {
      throw new Error(`Элемент ${modelId} не должен попадать в критичные элементы наружной оболочки.`);
    }
  });
});

test("demo export quality: блок проектных допущений содержит реквизиты демо-дома", () => {
  const base = buildPreparedDemoBase();
  const html = renderReportHtml("project-ov-ts", base);
  const expected = [
    "Организация",
    "Заказчик",
    "Адрес",
    "Подписанты",
    "Учебный демонстрационный проект",
    "Демонстрационный заказчик",
    "г. Москва, демонстрационный объект",
    "Автор ВКР",
  ];
  for (const snippet of expected) {
    if (!html.includes(snippet)) {
      throw new Error(`Блок проектных допущений не содержит '${snippet}'.`);
    }
  }
});

test("demo export quality: demo-defaults заполняют титул, штамп и подписи без пустых реквизитов", () => {
  const base = buildPreparedDemoBase();
  const expectedMeta = [
    base.meta.organization,
    base.meta.customer,
    base.meta.address,
    base.meta.developedBy,
  ];
  expectedMeta.forEach((value) => {
    if (value === "не задано") {
      throw new Error(`Демо-реквизит не должен оставаться пустым: ${value}`);
    }
  });
  if (base.meta.checkedBy !== "—" || base.meta.normControl !== "—" || base.meta.chiefEngineer !== "—") {
    throw new Error("Демо-подписанты по умолчанию должны заполняться символом «—».");
  }
  for (const kind of ALL_REPORT_EXPORT_KINDS) {
    const html = renderReportHtml(kind, base);
    assertNotContains(html, "б/н", kind);
    assertContains(html, "Автор ВКР", kind);
    if (kind !== "engineering-summary") {
      assertContains(html, "ДЕМО-ОВ-ТР", kind);
    }
  }
});

test("demo export quality: engineering summary signatures do not expose not-provided wording", () => {
  const base = buildPreparedDemoBase();
  const html = renderReportHtml("engineering-summary", base);
  assertNotContains(html, "не заполнено пользователем", "engineering-summary");
  assertContains(html, "Проверил: —", "engineering-summary");
});

test("demo export quality: energy passport uses auto-generated model version label", () => {
  const base = buildPreparedDemoBase();
  const data = buildEnergyPassportData(base);
  const versionRow = data.documentInfo.find((row) => row.label.includes("Версия расчётной модели"));
  if (!versionRow || versionRow.value !== "сформирована автоматически") {
    throw new Error(`Ожидалась автоматическая версия модели, получено: ${versionRow?.value ?? "нет строки"}`);
  }
});

test("demo export quality: риски в инженерном заключении выводятся отдельными пунктами списка", () => {
  const base = buildPreparedDemoBase();
  const data = buildEngineeringSummaryData(base);
  const html = renderReportHtml("engineering-summary", base);

  if (data.riskLines.length === 0) {
    throw new Error("Для инженерного заключения должен формироваться хотя бы один пункт рисков.");
  }
  if (data.riskLines.some((line) => line.includes(";"))) {
    throw new Error(`Риски не должны склеиваться через ';': ${data.riskLines.join(" | ")}`);
  }

  const liCount = (html.match(/<li>/g) ?? []).length;
  if (liCount < data.riskLines.length) {
    throw new Error(`HTML инженерного заключения содержит слишком мало <li>: ${liCount} < ${data.riskLines.length}`);
  }
});

test("demo export quality: энергопаспорт оставляет фактические значения пустыми и не подменяет qrad", () => {
  const base = buildPreparedDemoBase();
  const data = buildEnergyPassportData(base);
  const sections = [
    data.generalInfo,
    data.designConditions,
    data.geometryIndicators,
    data.thermalIndicators,
    data.auxIndicators,
    data.specificCharacteristics,
    data.coefficients,
    data.complexIndicators,
    data.energyLoads,
  ];

  sections.forEach((section) => {
    section.rows.forEach((row) => {
      if (row.factValue !== "—") {
        throw new Error(`${section.title}: фактическое значение '${row.label}' должно оставаться «—».`);
      }
    });
  });

  const solarRow = data.auxIndicators.rows.find((row) => row.key === "ep-5-solarGain");
  if (!solarRow) {
    throw new Error("Не найдена строка qrad в энергетическом паспорте.");
  }
  if (
    solarRow.designValue !==
    "требует уточнения методики расчёта солнечных теплопоступлений"
  ) {
    throw new Error(`qrad не должен подменяться числом, получено: ${solarRow.designValue}`);
  }
});

test("demo export quality: эксплуатационный паспорт использует проектную формулировку по осмотрам", () => {
  const base = buildPreparedDemoBase();
  const data = buildOperationPassportData(base);
  const inspectionRow = data.operationRules.rows.find((row) => row.key === "op-6-inspection");
  if (!inspectionRow) {
    throw new Error("Не найдена строка периодичности осмотров.");
  }
  if (inspectionRow.value !== "устанавливается эксплуатирующей организацией") {
    throw new Error(`Некорректная формулировка по осмотрам: ${inspectionRow.value}`);
  }

  const html = renderReportHtml("operation-technical-passport", base);
  assertContains(html, "устанавливается эксплуатирующей организацией", "operation-technical-passport");
});

test("demo export quality: в HTML нет запрещённых строк проектного отчёта", () => {
  const base = buildPreparedDemoBase();
  const forbidden = [
    "betaV",
    "Lvent",
    "Ginf",
    "nVent",
    "nInf",
    "констант",
    "сертификаты",
    "ConsultantPlus",
    "report-actions",
  ];
  for (const kind of ALL_REPORT_EXPORT_KINDS) {
    const html = renderReportHtml(kind, base);
    forbidden.forEach((needle) => assertNotContains(html, needle, kind));
  }
});
