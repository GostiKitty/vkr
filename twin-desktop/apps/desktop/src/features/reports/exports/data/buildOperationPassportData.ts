/**
 * Данные для «Эксплуатационно-технического паспорта здания».
 *
 * Документ использует уже имеющиеся расчётные данные и пользовательские
 * реквизиты из формы «Исходные данные для экспертизы». Новых расчётов не запускает.
 */

import type { ReportBaseData } from "./buildReportBaseData";
import type { ReportExportDocumentMeta } from "../types";
import { buildExportEnvelopeView } from "./buildExportEnvelopeView";
import { formatDynamicMetricValue } from "../helpers";

const NEEDS_PARAMETER = "требуется задание исходного параметра";
const SET_BY_OPERATOR = "устанавливается эксплуатирующей организацией";
const NOT_FILLED_BY_USER = "не заполнено пользователем";

export interface OperationPassportRow {
  key: string;
  label: string;
  value: string;
  note?: string;
}

export interface OperationPassportSection {
  id: string;
  title: string;
  intro?: string;
  rows: OperationPassportRow[];
}

export interface OperationPassportRegisterRow {
  key: string;
  label: string;
  value: string;
  source: string;
  status: string;
}

export interface OperationPassportData {
  meta: ReportExportDocumentMeta;
  expertise: ReportBaseData["expertise"];
  isDraft: boolean;
  draftReason: string;
  documentInfo: OperationPassportSection;
  sourceRegisterRows: OperationPassportRegisterRow[];
  generalInfo: OperationPassportSection;
  buildingInfo: OperationPassportSection;
  engineeringSystems: OperationPassportSection;
  designLoads: OperationPassportSection;
  thermalEnergyChars: OperationPassportSection;
  energyIndicators: OperationPassportSection;
  operationRules: OperationPassportSection;
  clarificationLines: string[];
  appendices: Array<{ id: string; title: string; rows: OperationPassportRow[] }>;
}

export function buildOperationPassportData(base: ReportBaseData): OperationPassportData {
  const { passport, sp50Report, meta, expertise } = base;
  const summary = passport.summary;
  const energy = sp50Report?.energy ?? null;
  const dynamicState = base.source.dynamicResultState;
  const envelopeView = buildExportEnvelopeView({
    model: base.source.model,
    constructions: sp50Report?.constructions ?? [],
    heatedVolumeM3: summary.totalVolumeM3,
    kobNorm: sp50Report?.building.kobNorm_W_m3K ?? null,
    outdoorDesignTemperatureC: passport.climate.outdoorDesignTemperatureC,
  });

  const hasExplicitOperationData = [
    expertise.fieldMap.operationOrg,
    expertise.fieldMap.journalName,
    expertise.fieldMap.inspectionFrequency,
    expertise.fieldMap.temperatureControlRule,
    expertise.fieldMap.operationResponsible,
    expertise.fieldMap.operationNotes,
  ].some((field) => field?.source === "user-input");

  const hasScenarioOperationContext =
    base.source.scenarioConfig !== null &&
    [expertise.fieldMap.daySetpointC, expertise.fieldMap.nightSetpointC].some(
      (field) => field?.source === "scenario" || field?.source === "calculated"
    );

  const isDraft = !hasExplicitOperationData && !hasScenarioOperationContext;
  const draftReason = isDraft
    ? "Эксплуатационные сведения заполнены частично. Документ сформирован как справочный паспорт для проектной стадии и требует уточнения эксплуатирующей организацией."
    : "";

  const documentInfo: OperationPassportSection = {
    id: "op-doc",
    title: "Сведения о документе",
    rows: [
      row("op-doc-title", "Наименование документа", "Эксплуатационно-технический паспорт здания"),
      row("op-doc-object", "Объект", expertise.fieldMap.projectName.value),
      row("op-doc-code", "Шифр документации", expertise.fieldMap.projectCipher.value),
      row("op-doc-stage", "Стадия", expertise.fieldMap.documentStage.value),
      row("op-doc-generated", "Дата формирования", meta.generatedAtLabel),
    ],
  };

  const sourceRegisterRows: OperationPassportRegisterRow[] = expertise.inputRegisterRows.filter(
    (rowEntry) =>
      [
        "projectName",
        "objectAddress",
        "projectCipher",
        "documentStage",
        "operationOrg",
        "journalName",
        "inspectionFrequency",
        "temperatureControlRule",
        "operationResponsible",
        "operationNotes",
        "mechanicalVentilation",
        "heatRecoveryEfficiencyPercent",
        "daySetpointC",
        "nightSetpointC",
      ].includes(rowEntry.key) &&
      (expertise.showIncompleteFields || rowEntry.status !== "не заполнено")
  );

  const generalInfo: OperationPassportSection = {
    id: "op-1",
    title: "1 Общие сведения",
    rows: [
      row("op-1-object", "Наименование объекта", expertise.fieldMap.projectName.value),
      row("op-1-address", "Адрес", expertise.fieldMap.objectAddress.value),
      row("op-1-cipher", "Шифр документации", expertise.fieldMap.projectCipher.value),
      row(
        "op-1-owner",
        "Заказчик / эксплуатирующая организация",
        expertise.fieldMap.operationOrg.isFilled
          ? expertise.fieldMap.operationOrg.value
          : expertise.fieldMap.customerOrg.value
      ),
      row("op-1-developer", "Разработчик", expertise.fieldMap.developerOrg.value),
      row("op-1-date", "Дата формирования", meta.generatedAtLabel),
    ],
  };

  const buildingInfo: OperationPassportSection = {
    id: "op-2",
    title: "2 Сведения о здании и основных конструкциях",
    rows: [
      row("op-2-purpose", "Назначение здания", expertise.fieldMap.buildingPurpose.value),
      row("op-2-storeys", "Этажность", expertise.fieldMap.floorsCount.value),
      row("op-2-rooms", "Количество помещений", expertise.fieldMap.roomsCount.value),
      row("op-2-area", "Отапливаемая площадь, м²", expertise.fieldMap.heatedArea.value),
      row("op-2-volume", "Отапливаемый объём, м³", expertise.fieldMap.heatedVolume.value),
      row(
        "op-2-envelope",
        "Элементы наружной тепловой оболочки",
        String(envelopeView.includedElements.length)
      ),
    ],
  };

  const engineeringSystems: OperationPassportSection = {
    id: "op-3",
    title: "3 Сведения об инженерных системах",
    rows: [
      row(
        "op-3-heating",
        "Система отопления",
        passport.thermalResults.available
          ? "Расчётные нагрузки и температурный режим определены по цифровой модели здания."
          : "Требует запуска динамического расчёта."
      ),
      row(
        "op-3-ventilation",
        "Механическая вентиляция",
        expertise.fieldMap.mechanicalVentilation.value
      ),
      row(
        "op-3-infiltration",
        "Кратность инфильтрации, 1/ч",
        expertise.fieldMap.infiltrationAch.value
      ),
      row(
        "op-3-ventilationAch",
        "Кратность вентиляции, 1/ч",
        expertise.fieldMap.ventilationAch.value
      ),
      row(
        "op-3-heatRecovery",
        "Коэффициент рекуперации",
        expertise.fieldMap.heatRecoveryEfficiencyPercent.value
      ),
    ],
  };

  const designLoads: OperationPassportSection = {
    id: "op-4",
    title: "4 Проектные значения нагрузок",
    rows: [
      row(
        "op-4-peak",
        "Расчётная пиковая тепловая нагрузка, кВт",
        formatDynamicMetricValue(passport.thermalResults.peakLoadKW, dynamicState, { digits: 2 })
      ),
      row(
        "op-4-specificPeak",
        "Удельная пиковая нагрузка, Вт/м²",
        formatDynamicMetricValue(passport.thermalResults.specificPeakLoad_W_m2, dynamicState, {
          digits: 1,
        })
      ),
      row(
        "op-4-totalEnergy",
        "Тепловая энергия за расчётный период, кВт·ч",
        formatDynamicMetricValue(passport.thermalResults.totalEnergyKWh, dynamicState, {
          digits: 1,
        })
      ),
    ],
  };

  const thermalEnergyChars: OperationPassportSection = {
    id: "op-5-1",
    title: "5.1 Теплоэнергетические характеристики",
    rows: [
      row("op-5-1-kob", "kоб расчётное, Вт/(м³·К)", valueOrFallback(envelopeView.kobActual, 3)),
      row("op-5-1-kobNorm", "kоб нормативное, Вт/(м³·К)", valueOrFallback(envelopeView.kobNorm, 3)),
      row(
        "op-5-1-qHeating",
        "qот расчётное, Вт/(м³·К)",
        valueOrFallback(energy?.qHeatingCharacteristic_W_m3K, 3)
      ),
      row(
        "op-5-1-qNorm",
        "qот нормативное, кВт·ч/м²",
        valueOrFallback(energy?.qHeatingNorm_kWh_m2, 2)
      ),
    ],
  };

  const energyIndicators: OperationPassportSection = {
    id: "op-5-2",
    title: "5.2 Энергетические показатели",
    rows: [
      row(
        "op-5-2-annualHeating",
        "Годовой расход тепловой энергии, кВт·ч",
        valueOrFallback(energy?.annualHeatingEnergy_kWh, 1)
      ),
      row(
        "op-5-2-qByArea",
        "Удельный расход по площади, кВт·ч/м²",
        valueOrFallback(energy?.qByArea_kWh_m2, 2)
      ),
      row(
        "op-5-2-qByVolume",
        "Удельный расход по объёму, кВт·ч/м³",
        valueOrFallback(energy?.qByVolume_kWh_m3, 3)
      ),
    ],
  };

  const operationRulesRows: OperationPassportRow[] = [
    row(
      "op-6-records",
      "Журнал эксплуатации",
      expertise.fieldMap.journalName.isFilled
        ? expertise.fieldMap.journalName.value
        : "ведётся эксплуатирующей организацией"
    ),
    row(
      "op-6-monitoring",
      "Контроль температурного режима",
      expertise.fieldMap.temperatureControlRule.isFilled
        ? expertise.fieldMap.temperatureControlRule.value
        : SET_BY_OPERATOR
    ),
    row(
      "op-6-inspection",
      "Периодичность осмотров",
      expertise.fieldMap.inspectionFrequency.isFilled
        ? expertise.fieldMap.inspectionFrequency.value
        : SET_BY_OPERATOR
    ),
    row(
      "op-6-responsible",
      "Ответственный за эксплуатацию",
      expertise.fieldMap.operationResponsible.isFilled
        ? expertise.fieldMap.operationResponsible.value
        : SET_BY_OPERATOR
    ),
  ];

  if (expertise.showIncompleteFields || expertise.fieldMap.operationNotes.isFilled) {
    operationRulesRows.push(
      row(
        "op-6-notes",
        "Примечания по эксплуатации",
        expertise.fieldMap.operationNotes.isFilled
          ? expertise.fieldMap.operationNotes.value
          : NOT_FILLED_BY_USER
      )
    );
  }

  const operationRules: OperationPassportSection = {
    id: "op-6",
    title: "6 Правила эксплуатации и контроля",
    intro:
      "Раздел заполняется эксплуатирующей организацией. Документ сформирован автоматически из данных цифровой модели и расчётного сценария и не заменяет внутренние регламенты эксплуатации объекта.",
    rows: operationRulesRows,
  };

  return {
    meta,
    expertise,
    isDraft,
    draftReason,
    documentInfo,
    sourceRegisterRows,
    generalInfo,
    buildingInfo,
    engineeringSystems,
    designLoads,
    thermalEnergyChars,
    energyIndicators,
    operationRules,
    clarificationLines: expertise.clarificationLines,
    appendices: [
      {
        id: "op-7",
        title: "7 Приложения",
        rows: [
          row(
            "op-7-thermal",
            "Расчёт тепловой защиты по СП 50",
            "Выгружается отдельным документом комплекта."
          ),
          row(
            "op-7-energy",
            "Энергетический паспорт здания",
            "Выгружается отдельным документом комплекта."
          ),
          row(
            "op-7-summary",
            "Краткое инженерное заключение",
            "Используется как сжатая итоговая справка по расчётной модели."
          ),
        ],
      },
    ],
  };
}

function row(key: string, label: string, value: string, note?: string): OperationPassportRow {
  return { key, label, value, note };
}

function valueOrFallback(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NEEDS_PARAMETER;
  }
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}
