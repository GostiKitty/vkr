import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "../testHarness.js";
import { buildVideoDemoProjectModel } from "../../src/features/build/demoVideoProject.js";
import { DEFAULT_REPORT_META } from "../../src/features/build/reports/reportMetaPersistence.js";
import { buildReportBaseData } from "../../src/features/reports/exports/data/buildReportBaseData.js";
import { buildEnergyPassportData } from "../../src/features/reports/exports/data/buildEnergyPassportData.js";
import { buildThermalProtectionData } from "../../src/features/reports/exports/data/buildThermalProtectionData.js";
import { prepareExportReportInput } from "../../src/features/reports/exports/prepareExportReportInput.js";
import {
  DEFAULT_EXPERTISE_REPORT_INPUTS,
  loadExpertiseInputs,
  useExpertiseInputsStore,
} from "../../src/features/reports/exports/store/expertiseInputs.store.js";

function withMockWindow<T>(fn: () => T): T {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
    clear: () => void storage.clear(),
  };
  (globalThis as { window?: unknown }).window = { localStorage };
  try {
    return fn();
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  }
}

function buildDemoBase(overrides: Partial<typeof DEFAULT_EXPERTISE_REPORT_INPUTS> = {}) {
  const prepared = prepareExportReportInput(
    {
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
      generatedAt: new Date("2026-05-22T10:00:00Z"),
      expertiseInputs: {
        ...DEFAULT_EXPERTISE_REPORT_INPUTS,
        ...overrides,
      },
    },
    { applyDemoDefaults: true }
  );

  return buildReportBaseData({
    ...prepared.input,
    appliedAssumptions: prepared.appliedAssumptions,
  });
}

test("expertise inputs store persists entered requisites", () => {
  withMockWindow(() => {
    const projectKey = "report-persist-test";
    useExpertiseInputsStore.getState().resetProject(projectKey);
    useExpertiseInputsStore.getState().setField(projectKey, "projectName", "Тестовый объект");
    useExpertiseInputsStore.getState().setField(projectKey, "projectCipher", "ШИФР-123");

    const loaded = loadExpertiseInputs(projectKey);
    if (loaded.projectName !== "Тестовый объект") {
      throw new Error("Форма должна сохранять наименование объекта.");
    }
    if (loaded.projectCipher !== "ШИФР-123") {
      throw new Error("Форма должна сохранять шифр проекта.");
    }
  });
});

test("user expertise inputs override demo defaults in export base", () => {
  const base = buildDemoBase({
    projectName: "Пользовательский объект",
    projectCipher: "ПОЛЬЗ-001",
    developerOrg: "ООО Пользовательский разработчик",
    climateCity: "Санкт-Петербург",
  });

  if (base.meta.objectName !== "Пользовательский объект") {
    throw new Error(`Ожидалось пользовательское имя объекта, получено: ${base.meta.objectName}`);
  }
  if (base.meta.documentCode !== "ПОЛЬЗ-001") {
    throw new Error(`Ожидался пользовательский шифр, получено: ${base.meta.documentCode}`);
  }
  if (base.meta.organization !== "ООО Пользовательский разработчик") {
    throw new Error(`Ожидалась пользовательская организация, получено: ${base.meta.organization}`);
  }
  if (base.expertise.fieldMap.climateCity.value !== "Санкт-Петербург") {
    throw new Error("Пользовательская климатическая база должна иметь приоритет над demo-defaults.");
  }
});

test("manual qrad is reflected in the energy passport", () => {
  const base = buildDemoBase({
    solarGainsMode: "manual",
    solarGainsManualValue: "0,123",
  });
  const data = buildEnergyPassportData(base);
  const solarRow = data.auxIndicators.rows.find((row) => row.key === "ep-5-solarGain");
  if (!solarRow) {
    throw new Error("Строка qrad должна присутствовать в энергопаспорте.");
  }
  if (!solarRow.designValue.includes("0,123")) {
    throw new Error(`Ручное значение qrad не попало в документ: ${solarRow.designValue}`);
  }
  if (!solarRow.designValue.includes("задано пользователем")) {
    throw new Error("Для ручного qrad должно быть примечание о пользовательском вводе.");
  }
});

test("strict expertise mode reports critical missing fields", () => {
  const base = buildDemoBase({
    exportMode: "strict-expertise",
    designBasis: "",
    projectName: "",
  });
  if (base.expertise.readiness.criticalMissing.length === 0) {
    throw new Error("Строгий режим должен выявлять критические незаполненные поля.");
  }
  const missingKeys = new Set(base.expertise.readiness.criticalMissing.map((field) => field.key));
  if (!missingKeys.has("designBasis")) {
    throw new Error("В строгом режиме должно требоваться основание для проектирования.");
  }
});

test("demo export allows completeness with project assumptions", () => {
  const base = buildDemoBase({ exportMode: "demo" });
  if (base.expertise.readiness.criticalMissing.some((field) => field.key === "checkedBy")) {
    throw new Error("Демо-режим не должен считать подписантов критически незаполненными.");
  }
});

test("demo signatures use dash instead of not-provided wording", () => {
  const base = buildDemoBase();
  if (base.meta.checkedBy !== "—" || base.meta.normControl !== "—" || base.meta.chiefEngineer !== "—") {
    throw new Error("В демо-комплекте подписанты должны выводиться как «—».");
  }
  const register = base.expertise.inputRegisterRows.filter((row) =>
    ["checkedBy", "normControl", "chiefEngineer"].includes(row.key)
  );
  register.forEach((row) => {
    if (row.value !== "—") {
      throw new Error(`В ведомости демо-комплекта ожидался «—», получено: ${row.label} = ${row.value}`);
    }
    if (row.source !== "принято по проектному допущению") {
      throw new Error(`Неверный источник для ${row.label}: ${row.source}`);
    }
    if (row.status !== "заполнено условно") {
      throw new Error(`Неверный статус для ${row.label}: ${row.status}`);
    }
  });
});

test("modelVersion defaults to auto-generated label in demo export", () => {
  const base = buildDemoBase();
  if (base.meta.modelVersion !== "сформирована автоматически") {
    throw new Error(`Ожидалась автоматическая версия модели, получено: ${base.meta.modelVersion}`);
  }
});

test("user modelVersion overrides demo export meta", () => {
  const base = buildDemoBase({ modelVersion: "Модель v2.1" });
  if (base.meta.modelVersion !== "Модель v2.1") {
    throw new Error(`Пользовательская версия модели не попала в meta: ${base.meta.modelVersion}`);
  }
});

test("external door without normative resistance requires clarification", () => {
  const base = buildDemoBase();
  const data = buildThermalProtectionData(base);
  const doorRow = data.envelopeResistanceRows.find((row) =>
    row.typeLabel.toLowerCase().includes("двер")
  );
  if (!doorRow) {
    return;
  }
  if (doorRow.requiredResistance === "недостаточно данных") {
    throw new Error("Для наружной двери без Rнорм нельзя выводить «недостаточно данных».");
  }
  if (doorRow.status === "соответствует" && doorRow.requiredResistance.includes("задание")) {
    throw new Error("Нельзя показывать «соответствует», если Rнорм неизвестен.");
  }
});

test("export source uses correct grammar and no obsolete phrases", () => {
  const pageSource = readFileSync(
    resolve(process.cwd(), "src/features/reports/ProjectDocumentationPage.tsx"),
    "utf8"
  );
  if (!pageSource.includes("open-expertise-inputs-button")) {
    throw new Error("Вкладка документации должна содержать кнопку исходных данных для экспертизы.");
  }
  if (!pageSource.includes("check-export-completeness-button")) {
    throw new Error("Вкладка документации должна содержать кнопку проверки комплектности.");
  }

  const exportsSource = readFileSync(
    resolve(process.cwd(), "src/features/reports/exports/data/exportText.ts"),
    "utf8"
  );
  if (exportsSource.includes("Для помещение")) {
    throw new Error("В пользовательских формулировках не должно быть строки 'Для помещение'.");
  }

  const htmlSource = readFileSync(
    resolve(process.cwd(), "src/features/reports/exports/generators/thermalProtection.ts"),
    "utf8"
  );
  if (htmlSource.includes("Перекрытие Межэтажное перекрытие")) {
    throw new Error("В документах не должно быть сырой фразы 'Перекрытие Межэтажное перекрытие'.");
  }
});
