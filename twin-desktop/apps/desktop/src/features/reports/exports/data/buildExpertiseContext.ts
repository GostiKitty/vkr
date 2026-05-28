import type { ScenarioConfig } from "../../../../entities/workflow/workflow.store";
import type { ReportMeta } from "../../../build/reports/reportMetaPersistence";
import type { CalculationPassportData } from "../../calculationPassportData";
import type { AssumptionEntry } from "../defaults/demoHouseDesignDefaults";
import {
  formatDisplayEnum,
  REPORT_EXPORT_DASH,
  REPORT_EXPORT_NOT_SET,
} from "../helpers";
import type { ReportExportDocumentMeta } from "../types";
import {
  DEFAULT_EXPERTISE_REPORT_INPUTS,
  type ExpertiseExportMode,
  type ExpertiseInputKey,
  type ExpertiseReportInputs,
  type MissingDataHandlingMode,
  type SolarGainsMode,
} from "../store/expertiseInputs.store";

export type ExpertiseResolvedSource =
  | "user-input"
  | "model"
  | "scenario"
  | "calculated"
  | "demo-default"
  | "not-provided";

export type ExpertiseFieldImportance = "required" | "recommended" | "optional";
export type ExpertiseFieldContext =
  | "requisite"
  | "building"
  | "climate"
  | "engineering"
  | "operation"
  | "fact"
  | "geometry"
  | "qrad";

export interface ExpertiseResolvedField {
  key: ExpertiseInputKey;
  label: string;
  importance: ExpertiseFieldImportance;
  context: ExpertiseFieldContext;
  value: string;
  rawValue: string | number | boolean | null;
  source: ExpertiseResolvedSource;
  sourceLabel: string;
  statusLabel: string;
  isFilled: boolean;
}

export interface ExpertiseCompletenessReport {
  requiredFilled: number;
  requiredTotal: number;
  recommendedFilled: number;
  recommendedTotal: number;
  filledTotal: number;
  trackedTotal: number;
  percent: number;
  criticalMissing: ExpertiseResolvedField[];
  recommendedMissing: ExpertiseResolvedField[];
}

export interface ExpertiseInputRegisterRow {
  key: ExpertiseInputKey;
  label: string;
  value: string;
  source: string;
  status: string;
}

export interface ExpertiseDocumentMetaOverrides {
  objectName?: string;
  address?: string;
  documentCode?: string;
  documentStage?: string;
  documentCity?: string;
  year?: string;
  customer?: string;
  organization?: string;
  developedBy?: string;
  checkedBy?: string;
  normControl?: string;
  chiefEngineer?: string;
}

export interface ExpertiseContext {
  inputs: ExpertiseReportInputs;
  exportMode: ExpertiseExportMode;
  showAssumptionsBlock: boolean;
  showTechnicalIdsInAppendix: boolean;
  showIncompleteFields: boolean;
  handleMissingDataMode: MissingDataHandlingMode;
  solarGainsMode: SolarGainsMode;
  solarGainsManualValue: string;
  fields: ExpertiseResolvedField[];
  fieldMap: Record<string, ExpertiseResolvedField>;
  readiness: ExpertiseCompletenessReport;
  inputRegisterRows: ExpertiseInputRegisterRow[];
  clarificationLines: string[];
  documentMetaOverrides: ExpertiseDocumentMetaOverrides;
  limitations: string[];
  softwareInfoLines: string[];
  packageRows: Array<{ label: string; value: string }>;
}

interface BuildExpertiseContextInput {
  passport: CalculationPassportData;
  draftMeta: ReportExportDocumentMeta;
  reportMeta: ReportMeta;
  inputs?: ExpertiseReportInputs;
  scenarioConfig: ScenarioConfig | null;
  appliedAssumptions: AssumptionEntry[];
}

interface ResolveFieldConfig {
  key: ExpertiseInputKey;
  label: string;
  importance: ExpertiseFieldImportance;
  context: ExpertiseFieldContext;
  userValue?: string | null;
  modelValue?: string | null;
  scenarioValue?: string | null;
  calculatedValue?: string | null;
  demoValue?: string | null;
  format?: (value: string) => string;
  acceptDash?: boolean;
}

const SIGNATURE_FIELD_KEYS = new Set<ExpertiseInputKey>([
  "checkedBy",
  "normControl",
  "chiefEngineer",
]);

const STRICT_REQUIRED_KEYS = new Set<ExpertiseInputKey>([
  "ventilationAch",
  "infiltrationAch",
  "checkedBy",
  "normControl",
  "chiefEngineer",
  "contractNumber",
]);

const SOURCE_LABEL: Record<ExpertiseResolvedSource, string> = {
  "user-input": "задано пользователем",
  model: "получено из модели",
  scenario: "принято по расчётному сценарию",
  calculated: "рассчитано",
  "demo-default": "принято по демо-допущению",
  "not-provided": "не заполнено",
};

const TRACKED_FIELD_ORDER: Array<{
  key: ExpertiseInputKey;
  label: string;
  importance: ExpertiseFieldImportance;
}> = [
  { key: "projectName", label: "Наименование объекта", importance: "required" },
  { key: "objectAddress", label: "Адрес объекта", importance: "required" },
  { key: "projectCipher", label: "Шифр проекта", importance: "required" },
  { key: "documentStage", label: "Стадия проектирования", importance: "required" },
  { key: "issueCity", label: "Город выпуска", importance: "recommended" },
  { key: "issueYear", label: "Год выпуска", importance: "required" },
  { key: "customerOrg", label: "Заказчик", importance: "required" },
  { key: "developerOrg", label: "Проектная организация / разработчик", importance: "required" },
  { key: "developedBy", label: "Разработал", importance: "required" },
  { key: "checkedBy", label: "Проверил", importance: "recommended" },
  { key: "normControl", label: "Нормоконтроль", importance: "recommended" },
  { key: "chiefEngineer", label: "ГИП", importance: "recommended" },
  { key: "designBasis", label: "Основание для проектирования", importance: "required" },
  { key: "buildingPurpose", label: "Назначение здания", importance: "required" },
  { key: "floorsCount", label: "Этажность", importance: "required" },
  { key: "heatedArea", label: "Отапливаемая площадь", importance: "required" },
  { key: "heatedVolume", label: "Отапливаемый объём", importance: "required" },
  { key: "climateCity", label: "Город / климатическая база", importance: "required" },
  { key: "outdoorDesignTemperatureC", label: "Расчётная наружная температура", importance: "required" },
  { key: "outdoorHeatingAverageC", label: "Средняя температура отопительного периода", importance: "required" },
  { key: "heatingDurationDays", label: "Продолжительность отопительного периода", importance: "required" },
  { key: "gsop", label: "ГСОП", importance: "required" },
  { key: "humidityZone", label: "Зона влажности", importance: "required" },
  { key: "operationCondition", label: "Условия эксплуатации по СП 50", importance: "required" },
  { key: "indoorDesignTemperatureC", label: "Внутренняя температура", importance: "required" },
  { key: "indoorRelativeHumidityPercent", label: "Относительная влажность", importance: "required" },
  { key: "ventilationAch", label: "Кратность вентиляции", importance: "recommended" },
  { key: "infiltrationAch", label: "Кратность инфильтрации", importance: "recommended" },
  { key: "mechanicalVentilation", label: "Механическая вентиляция", importance: "recommended" },
  { key: "heatRecoveryEfficiencyPercent", label: "Коэффициент рекуперации", importance: "recommended" },
  { key: "daySetpointC", label: "Дневная уставка", importance: "recommended" },
  { key: "nightSetpointC", label: "Ночная уставка", importance: "recommended" },
  { key: "calculationScenario", label: "Расчётный сценарий", importance: "recommended" },
  { key: "operationOrg", label: "Эксплуатирующая организация", importance: "optional" },
  { key: "inspectionFrequency", label: "Периодичность осмотров", importance: "optional" },
];
void TRACKED_FIELD_ORDER;

export function buildExpertiseContext(
  input: BuildExpertiseContextInput
): ExpertiseContext {
  const inputs = { ...DEFAULT_EXPERTISE_REPORT_INPUTS, ...(input.inputs ?? {}) };
  const assumptionMap = new Map(input.appliedAssumptions.map((entry) => [entry.key, entry]));
  const passport = input.passport;
  const energy = passport.sp50Report?.energy ?? null;
  const sp50Source = passport.sp50Report?.sourceData ?? null;

  const fields = [
    resolveField({
      key: "projectName",
      label: "Наименование объекта",
      importance: "required",
      context: "requisite",
      userValue: inputs.projectName,
      modelValue: passport.projectName,
      demoValue: assumptionMap.get("meta.name")?.value ?? null,
    }),
    resolveField({
      key: "objectAddress",
      label: "Адрес объекта",
      importance: "required",
      context: "requisite",
      userValue: inputs.objectAddress,
      modelValue: input.draftMeta.address,
      demoValue: assumptionMap.get("reportMeta.buildingAddress")?.value ?? null,
    }),
    resolveField({
      key: "projectCipher",
      label: "Шифр проекта",
      importance: "required",
      context: "requisite",
      userValue: inputs.projectCipher,
      modelValue: input.draftMeta.documentCode === "б/н" ? "" : input.draftMeta.documentCode,
      demoValue: assumptionMap.get("reportMeta.projectCipher")?.value ?? null,
    }),
    resolveField({
      key: "documentStage",
      label: "Стадия проектирования",
      importance: "required",
      context: "requisite",
      userValue: inputs.documentStage,
      modelValue: input.draftMeta.documentStage,
      demoValue: assumptionMap.get("reportMeta.documentStage")?.value ?? null,
    }),
    resolveField({
      key: "issueCity",
      label: "Город выпуска",
      importance: "recommended",
      context: "requisite",
      userValue: inputs.issueCity,
      modelValue: input.draftMeta.documentCity,
      demoValue: assumptionMap.get("reportMeta.documentCity")?.value ?? null,
    }),
    resolveField({
      key: "issueYear",
      label: "Год выпуска",
      importance: "required",
      context: "requisite",
      userValue: inputs.issueYear,
      modelValue: input.draftMeta.year,
    }),
    resolveField({
      key: "customerOrg",
      label: "Заказчик",
      importance: "required",
      context: "requisite",
      userValue: inputs.customerOrg,
      modelValue: input.draftMeta.customer,
      demoValue: assumptionMap.get("reportMeta.customerOrg")?.value ?? null,
    }),
    resolveField({
      key: "developerOrg",
      label: "Проектная организация / разработчик",
      importance: "required",
      context: "requisite",
      userValue: inputs.developerOrg,
      modelValue: input.draftMeta.organization,
      demoValue: assumptionMap.get("reportMeta.developerOrg")?.value ?? null,
    }),
    resolveField({
      key: "developedBy",
      label: "Разработал",
      importance: "required",
      context: "requisite",
      userValue: inputs.developedBy,
      modelValue: input.draftMeta.developedBy,
    }),
    resolveField({
      key: "checkedBy",
      label: "Проверил",
      importance: "recommended",
      context: "requisite",
      userValue: inputs.checkedBy,
      modelValue: input.draftMeta.checkedBy,
      acceptDash: true,
    }),
    resolveField({
      key: "normControl",
      label: "Нормоконтроль",
      importance: "recommended",
      context: "requisite",
      userValue: inputs.normControl,
      modelValue: input.draftMeta.normControl,
      acceptDash: true,
    }),
    resolveField({
      key: "chiefEngineer",
      label: "ГИП",
      importance: "recommended",
      context: "requisite",
      userValue: inputs.chiefEngineer,
      modelValue: input.draftMeta.chiefEngineer,
      acceptDash: true,
    }),
    resolveField({
      key: "designBasis",
      label: "Основание для проектирования",
      importance: "required",
      context: "requisite",
      userValue: inputs.designBasis,
    }),
    resolveField({
      key: "contractNumber",
      label: "Номер договора / задания",
      importance: "optional",
      context: "requisite",
      userValue: inputs.contractNumber,
    }),
    resolveField({
      key: "buildingPurpose",
      label: "Назначение здания",
      importance: "required",
      context: "building",
      userValue: inputs.buildingPurpose,
      modelValue: formatDisplayEnum(sp50Source?.buildingCategory, ""),
      demoValue: assumptionMap.get("thermalProtection.buildingCategory")?.value ?? null,
    }),
    resolveField({
      key: "functionalClass",
      label: "Класс функциональной пожарной опасности",
      importance: "optional",
      context: "building",
      userValue: inputs.functionalClass,
    }),
    resolveField({
      key: "floorsCount",
      label: "Этажность",
      importance: "required",
      context: "building",
      userValue: inputs.floorsCount,
      modelValue: numericText(sp50Source?.storeys ?? passport.summary.levelCount, 0),
    }),
    resolveField({
      key: "heatedArea",
      label: "Отапливаемая площадь",
      importance: "required",
      context: "building",
      userValue: inputs.heatedArea,
      modelValue: numericText(passport.summary.totalAreaM2, 2),
    }),
    resolveField({
      key: "heatedVolume",
      label: "Отапливаемый объём",
      importance: "required",
      context: "building",
      userValue: inputs.heatedVolume,
      modelValue: numericText(passport.summary.totalVolumeM3, 2),
    }),
    resolveField({
      key: "operationMode",
      label: "Режим эксплуатации",
      importance: "recommended",
      context: "building",
      userValue: inputs.operationMode,
      scenarioValue: inputs.exportMode === "demo" ? "проектный демонстрационный сценарий" : "",
    }),
    resolveField({
      key: "roomsCount",
      label: "Количество помещений",
      importance: "recommended",
      context: "building",
      userValue: inputs.roomsCount,
      modelValue: numericText(passport.summary.roomCount, 0),
    }),
    resolveField({
      key: "modelNote",
      label: "Примечание к цифровой модели",
      importance: "optional",
      context: "building",
      userValue: inputs.modelNote,
    }),
    resolveField({
      key: "modelVersion",
      label: "Версия расчётной модели",
      importance: "optional",
      context: "building",
      userValue: inputs.modelVersion,
      modelValue: passport.modelVersion ?? null,
    }),
    resolveField({
      key: "climateCity",
      label: "Город / климатическая база",
      importance: "required",
      context: "climate",
      userValue: inputs.climateCity,
      modelValue: passport.climate.city,
      demoValue: assumptionMap.get("climate.city")?.value ?? null,
    }),
    resolveField({
      key: "outdoorDesignTemperatureC",
      label: "Расчётная наружная температура для отопления",
      importance: "required",
      context: "climate",
      userValue: inputs.outdoorDesignTemperatureC,
      calculatedValue: numericText(passport.climate.outdoorDesignTemperatureC, 1),
    }),
    resolveField({
      key: "outdoorHeatingAverageC",
      label: "Средняя температура отопительного периода",
      importance: "required",
      context: "climate",
      userValue: inputs.outdoorHeatingAverageC,
      calculatedValue: numericText(passport.climate.outdoorHeatingAverageC, 1),
    }),
    resolveField({
      key: "heatingDurationDays",
      label: "Продолжительность отопительного периода",
      importance: "required",
      context: "climate",
      userValue: inputs.heatingDurationDays,
      calculatedValue: numericText(passport.climate.heatingDurationDays, 0),
    }),
    resolveField({
      key: "gsop",
      label: "ГСОП",
      importance: "required",
      context: "climate",
      userValue: inputs.gsop,
      calculatedValue: numericText(sp50Source?.gsop ?? null, 0),
    }),
    resolveField({
      key: "humidityZone",
      label: "Зона влажности",
      importance: "required",
      context: "climate",
      userValue: inputs.humidityZone,
      modelValue: formatDisplayEnum(passport.climate.humidityZone, ""),
      demoValue: assumptionMap.get("climate.humidityZone")?.value ?? null,
    }),
    resolveField({
      key: "operationCondition",
      label: "Условия эксплуатации по СП 50",
      importance: "required",
      context: "climate",
      userValue: inputs.operationCondition,
      modelValue: formatDisplayEnum(input.reportMeta.documentStage.includes("Рабоч") ? "B" : "B", ""),
      demoValue: assumptionMap.get("thermalProtection.operationCondition")?.value ?? null,
    }),
    resolveField({
      key: "indoorDesignTemperatureC",
      label: "Внутренняя температура",
      importance: "required",
      context: "climate",
      userValue: inputs.indoorDesignTemperatureC,
      calculatedValue: numericText(passport.climate.indoorTemperatureC, 1),
      demoValue: assumptionMap.get("climate.indoorTemperatureC")?.value ?? null,
    }),
    resolveField({
      key: "indoorRelativeHumidityPercent",
      label: "Относительная влажность",
      importance: "required",
      context: "climate",
      userValue: inputs.indoorRelativeHumidityPercent,
      calculatedValue: numericText(passport.sp50Report?.sourceData.indoorRelativeHumidityPercent ?? null, 0),
      demoValue: assumptionMap.get("climate.indoorRelativeHumidityPercent")?.value ?? null,
    }),
    resolveField({
      key: "ventilationAch",
      label: "Расчётная кратность вентиляции",
      importance: "recommended",
      context: "engineering",
      userValue: inputs.ventilationAch,
      scenarioValue: numericText(passport.operation.ventilationACH, 2),
      demoValue: assumptionMap.get("scenario.ventilation.ventilationAch")?.value ?? null,
    }),
    resolveField({
      key: "infiltrationAch",
      label: "Расчётная кратность инфильтрации",
      importance: "recommended",
      context: "engineering",
      userValue: inputs.infiltrationAch,
      scenarioValue: numericText(passport.operation.infiltrationACH, 2),
      demoValue: assumptionMap.get("scenario.ventilation.infiltrationAch")?.value ?? null,
    }),
    resolveField({
      key: "mechanicalVentilation",
      label: "Наличие механической вентиляции",
      importance: "recommended",
      context: "engineering",
      userValue: yesNoToText(inputs.mechanicalVentilation),
      scenarioValue:
        passport.operation.mechanicalVentilationEnabled === null
          ? ""
          : passport.operation.mechanicalVentilationEnabled
            ? "да"
            : "нет",
    }),
    resolveField({
      key: "heatRecoveryEfficiencyPercent",
      label: "Коэффициент рекуперации",
      importance: "recommended",
      context: "engineering",
      userValue: inputs.heatRecoveryEfficiencyPercent,
      scenarioValue:
        passport.operation.heatRecoveryFactor === null
          ? ""
          : numericText(passport.operation.heatRecoveryFactor * 100, 0),
      demoValue: assumptionMap.get("scenario.ventilation.heatRecovery")?.value ?? null,
    }),
    resolveField({
      key: "daySetpointC",
      label: "Дневная уставка температуры",
      importance: "recommended",
      context: "engineering",
      userValue: inputs.daySetpointC,
      scenarioValue: numericText(passport.operation.daySetpointC, 1),
      demoValue: assumptionMap.get("scenario.setpoints")?.value?.split("/")[0]?.trim() ?? null,
    }),
    resolveField({
      key: "nightSetpointC",
      label: "Ночная уставка температуры",
      importance: "recommended",
      context: "engineering",
      userValue: inputs.nightSetpointC,
      scenarioValue: numericText(passport.operation.nightSetpointC, 1),
    }),
    resolveField({
      key: "calculationScenario",
      label: "Расчётный сценарий",
      importance: "recommended",
      context: "engineering",
      userValue: inputs.calculationScenario,
      scenarioValue:
        input.scenarioConfig ? "сценарий расчёта проекта" : "",
      demoValue: assumptionMap.get("scenario.duration")?.value ?? null,
    }),
    resolveField({
      key: "internalGains",
      label: "Внутренние теплопоступления",
      importance: "optional",
      context: "engineering",
      userValue: inputs.internalGains,
      scenarioValue:
        passport.operation.internalGainDay_W_m2 !== null
          ? `${numericText(passport.operation.internalGainDay_W_m2, 1)} Вт/м²`
          : "",
    }),
    resolveField({
      key: "solarGainsMode",
      label: "Солнечные теплопоступления",
      importance: "optional",
      context: "qrad",
      userValue: solarModeText(inputs.solarGainsMode),
      calculatedValue:
        energy?.solarGainCharacteristic_W_m3K !== null &&
        energy?.solarGainCharacteristic_W_m3K !== undefined
          ? "расчётное значение доступно"
          : "",
    }),
    resolveField({
      key: "solarGainsManualValue",
      label: "qrad вручную",
      importance: "optional",
      context: "qrad",
      userValue: inputs.solarGainsManualValue,
    }),
    resolveField({
      key: "operationOrg",
      label: "Эксплуатирующая организация",
      importance: "optional",
      context: "operation",
      userValue: inputs.operationOrg,
      modelValue: input.draftMeta.customer,
    }),
    resolveField({
      key: "journalName",
      label: "Журнал эксплуатации",
      importance: "optional",
      context: "operation",
      userValue: inputs.journalName,
    }),
    resolveField({
      key: "inspectionFrequency",
      label: "Периодичность осмотров",
      importance: "optional",
      context: "operation",
      userValue: inputs.inspectionFrequency,
      modelValue: "устанавливается эксплуатирующей организацией",
    }),
    resolveField({
      key: "temperatureControlRule",
      label: "Контроль температурного режима",
      importance: "optional",
      context: "operation",
      userValue: inputs.temperatureControlRule,
      modelValue: passport.thermalResults.available
        ? "контроль выполняется по результатам расчётного сценария и сезонных проверок"
        : "",
    }),
    resolveField({
      key: "operationResponsible",
      label: "Ответственный за эксплуатацию",
      importance: "optional",
      context: "operation",
      userValue: inputs.operationResponsible,
    }),
    resolveField({
      key: "operationNotes",
      label: "Примечания по эксплуатации",
      importance: "optional",
      context: "operation",
      userValue: inputs.operationNotes,
    }),
    resolveField({
      key: "exportMode",
      label: "Режим комплекта",
      importance: "optional",
      context: "requisite",
      userValue: exportModeLabel(inputs.exportMode),
    }),
    resolveField({
      key: "showAssumptionsBlock",
      label: "Показывать блок проектных допущений",
      importance: "optional",
      context: "requisite",
      userValue: inputs.showAssumptionsBlock ? "да" : "нет",
    }),
    resolveField({
      key: "showTechnicalIdsInAppendix",
      label: "Показывать технические ID в приложениях",
      importance: "optional",
      context: "requisite",
      userValue: inputs.showTechnicalIdsInAppendix ? "да" : "нет",
    }),
    resolveField({
      key: "showIncompleteFields",
      label: "Показывать неполные поля",
      importance: "optional",
      context: "requisite",
      userValue: inputs.showIncompleteFields ? "да" : "нет",
    }),
    resolveField({
      key: "handleMissingDataMode",
      label: "Режим обработки неполных данных",
      importance: "optional",
      context: "requisite",
      userValue: missingModeLabel(inputs.handleMissingDataMode),
    }),
  ];

  const normalizedFields = fields.map((field) =>
    finalizeField(field, inputs.exportMode)
  );

  const fieldMap: Record<string, ExpertiseResolvedField> = Object.fromEntries(
    normalizedFields.map((field) => [field.key, field])
  );
  const readiness = buildCompletenessReport(normalizedFields);
  const inputRegisterRows = normalizedFields
    .filter((field) => field.importance !== "optional")
    .filter((field) => inputs.showIncompleteFields || field.isFilled)
    .map((field) => buildInputRegisterRow(field, inputs.exportMode));

  const clarificationLines = buildClarificationLines(
    normalizedFields,
    inputs.handleMissingDataMode
  );
  const documentMetaOverrides = {
    objectName: fieldMap.projectName.value,
    address: fieldMap.objectAddress.value,
    documentCode: fieldMap.projectCipher.value,
    documentStage: expandStageLabel(fieldMap.documentStage.value),
    documentCity: fieldMap.issueCity.value,
    year: fieldMap.issueYear.value,
    customer: fieldMap.customerOrg.value,
    organization: fieldMap.developerOrg.value,
    developedBy: fieldMap.developedBy.value,
    checkedBy: formatDocumentSignature(fieldMap.checkedBy),
    normControl: formatDocumentSignature(fieldMap.normControl),
    chiefEngineer: formatDocumentSignature(fieldMap.chiefEngineer),
  };

  return {
    inputs,
    exportMode: inputs.exportMode,
    showAssumptionsBlock: inputs.showAssumptionsBlock,
    showTechnicalIdsInAppendix: inputs.showTechnicalIdsInAppendix,
    showIncompleteFields: inputs.showIncompleteFields,
    handleMissingDataMode: inputs.handleMissingDataMode,
    solarGainsMode: inputs.solarGainsMode,
    solarGainsManualValue: inputs.solarGainsManualValue.trim(),
    fields: normalizedFields,
    fieldMap,
    readiness,
    inputRegisterRows,
    clarificationLines,
    documentMetaOverrides,
    limitations: buildLimitations(inputs),
    softwareInfoLines: [
      "Расчёт выполнен средствами расчётного модуля программного комплекса.",
      "Документ сформирован в структуре текстовой части проектной документации и предназначен для представления расчётно-пояснительных материалов.",
      "Оформление выполнено в ГОСТ/СПДС-ориентированном стиле.",
    ],
    packageRows: [
      { label: "01", value: "Раздел 5 ОВ/ТС" },
      { label: "02", value: "Расчёт тепловой защиты здания" },
      { label: "03", value: "Энергетический паспорт проекта здания" },
      { label: "04", value: "Паспорт проектных теплотехнических характеристик" },
      { label: "05", value: "Инженерное заключение" },
    ],
  };
}

function buildCompletenessReport(fields: ExpertiseResolvedField[]): ExpertiseCompletenessReport {
  const required = fields.filter((field) => field.importance === "required");
  const recommended = fields.filter((field) => field.importance === "recommended");
  const tracked = fields.filter((field) => field.importance !== "optional");
  const requiredFilled = required.filter((field) => field.isFilled).length;
  const recommendedFilled = recommended.filter((field) => field.isFilled).length;
  const filledTotal = tracked.filter((field) => field.isFilled).length;
  return {
    requiredFilled,
    requiredTotal: required.length,
    recommendedFilled,
    recommendedTotal: recommended.length,
    filledTotal,
    trackedTotal: tracked.length,
    percent:
      tracked.length > 0 ? Math.round((filledTotal / tracked.length) * 100) : 100,
    criticalMissing: required.filter((field) => !field.isFilled),
    recommendedMissing: recommended.filter((field) => !field.isFilled),
  };
}

function buildClarificationLines(
  fields: ExpertiseResolvedField[],
  mode: MissingDataHandlingMode
): string[] {
  const missing = fields.filter(
    (field) => !field.isFilled && field.importance !== "optional"
  );
  if (!missing.length) {
    return ["Критичных пробелов в исходных данных не выявлено."];
  }
  return missing.map((field) => {
    switch (field.context) {
      case "requisite":
        return `${field.label}: не заполнено пользователем.`;
      case "operation":
        return `${field.label}: устанавливается эксплуатирующей организацией.`;
      case "fact":
        return `${field.label}: не заполняется на проектной стадии.`;
      case "qrad":
        return `${field.label}: требует уточнения методики расчёта солнечных теплопоступлений.`;
      case "geometry":
        return `${field.label}: требуется проверка геометрической связности модели.`;
      default:
        return mode === "hide"
          ? `${field.label}: строка может быть скрыта в сокращённом режиме комплекта.`
          : `${field.label}: требуется задание исходного параметра.`;
    }
  });
}

function buildLimitations(inputs: ExpertiseReportInputs): string[] {
  if (inputs.exportMode === "strict-expertise") {
    return [];
  }
  const lines = [
    "Расчётная часть сформирована по логике СП 50 и предназначена для предварительного расчётно-пояснительного анализа.",
    "Справочная динамическая RC-оценка не заменяет нормативную проверку по СП 50.",
    "Фактические значения энергопаспорта не заполняются без обследования объекта.",
  ];
  if (inputs.solarGainsMode !== "manual") {
    lines.push(
      "Солнечные теплопоступления требуют уточнения методики расчёта; значение qrad не подменяется фиктивным числом."
    );
  }
  return lines;
}

function resolveField(config: ResolveFieldConfig): ExpertiseResolvedField {
  const resolved = firstMeaningful(
    [
      { source: "user-input" as const, value: normalizeText(config.userValue) },
      { source: "model" as const, value: normalizeText(config.modelValue) },
      { source: "scenario" as const, value: normalizeText(config.scenarioValue) },
      { source: "calculated" as const, value: normalizeText(config.calculatedValue) },
      { source: "demo-default" as const, value: normalizeText(config.demoValue) },
    ],
    { acceptDash: config.acceptDash }
  );

  const source = resolved?.source ?? "not-provided";
  const value =
    resolved?.value ??
    missingValueForContext(config.context);
  const formatted = config.format ? config.format(value) : value;
  return {
    key: config.key,
    label: config.label,
    importance: config.importance,
    context: config.context,
    value: formatted,
    rawValue: resolved?.value ?? null,
    source,
    sourceLabel: SOURCE_LABEL[source],
    statusLabel: buildStatusLabel(source),
    isFilled: source !== "not-provided",
  };
}

function finalizeField(
  field: ExpertiseResolvedField,
  exportMode: ExpertiseExportMode
): ExpertiseResolvedField {
  const importance =
    exportMode === "strict-expertise" && STRICT_REQUIRED_KEYS.has(field.key)
      ? "required"
      : field.importance;
  const isFilled = computeFieldFilled(field, exportMode);
  const statusLabel = buildFieldStatusLabel(field, exportMode, isFilled);
  const sourceLabel =
    SIGNATURE_FIELD_KEYS.has(field.key) &&
    field.rawValue === REPORT_EXPORT_DASH &&
    exportMode === "demo"
      ? "принято по проектному допущению"
      : field.sourceLabel;
  return {
    ...field,
    importance,
    isFilled,
    statusLabel,
    sourceLabel,
  };
}

function computeFieldFilled(
  field: ExpertiseResolvedField,
  exportMode: ExpertiseExportMode
): boolean {
  if (field.source === "not-provided") {
    return false;
  }
  if (
    SIGNATURE_FIELD_KEYS.has(field.key) &&
    field.rawValue === REPORT_EXPORT_DASH
  ) {
    return exportMode === "demo" || exportMode === "vkr-brief";
  }
  return true;
}

function buildFieldStatusLabel(
  field: ExpertiseResolvedField,
  exportMode: ExpertiseExportMode,
  isFilled: boolean
): string {
  if (
    SIGNATURE_FIELD_KEYS.has(field.key) &&
    field.rawValue === REPORT_EXPORT_DASH &&
    exportMode === "demo"
  ) {
    return "заполнено условно";
  }
  if (!isFilled) {
    return "не заполнено";
  }
  return buildStatusLabel(field.source);
}

function buildInputRegisterRow(
  field: ExpertiseResolvedField,
  exportMode: ExpertiseExportMode
): ExpertiseInputRegisterRow {
  if (
    SIGNATURE_FIELD_KEYS.has(field.key) &&
    field.rawValue === REPORT_EXPORT_DASH &&
    exportMode === "demo"
  ) {
    return {
      key: field.key,
      label: field.label,
      value: REPORT_EXPORT_DASH,
      source: "принято по проектному допущению",
      status: "заполнено условно",
    };
  }
  return {
    key: field.key,
    label: field.label,
    value: field.value,
    source: field.sourceLabel,
    status: field.statusLabel,
  };
}

function formatDocumentSignature(field: ExpertiseResolvedField | undefined): string {
  if (!field) {
    return REPORT_EXPORT_DASH;
  }
  if (field.source !== "not-provided") {
    return field.value;
  }
  return REPORT_EXPORT_DASH;
}

function buildStatusLabel(source: ExpertiseResolvedSource): string {
  switch (source) {
    case "demo-default":
      return "принято по демо-допущению";
    case "calculated":
      return "рассчитано";
    case "not-provided":
      return "не заполнено";
    default:
      return "заполнено";
  }
}

function firstMeaningful(
  values: Array<{ source: ExpertiseResolvedSource; value: string | null }>,
  options: { acceptDash?: boolean } = {}
): { source: ExpertiseResolvedSource; value: string } | null {
  for (const item of values) {
    if (item.value === null) {
      continue;
    }
    const trimmed = item.value.trim();
    if (!trimmed) {
      continue;
    }
    if (!options.acceptDash && trimmed === REPORT_EXPORT_DASH) {
      continue;
    }
    return { source: item.source, value: trimmed };
  }
  return null;
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numericText(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function yesNoToText(value: string): string {
  if (value === "yes") {
    return "да";
  }
  if (value === "no") {
    return "нет";
  }
  return "";
}

function solarModeText(value: SolarGainsMode): string {
  switch (value) {
    case "manual":
      return "задано вручную";
    case "omit":
      return "не учитывать, требуется уточнение";
    default:
      return "автоматически, если расчёт доступен";
  }
}

function exportModeLabel(value: ExpertiseExportMode): string {
  switch (value) {
    case "strict-expertise":
      return "финальный / expert";
    case "vkr-brief":
      return "для проверки / ВКР";
    default:
      return "черновой / demo";
  }
}

function missingModeLabel(value: MissingDataHandlingMode): string {
  switch (value) {
    case "hide":
      return "скрывать строку";
    case "require":
      return "требовать заполнения перед выгрузкой";
    default:
      return "показывать «требует уточнения»";
  }
}

function missingValueForContext(context: ExpertiseFieldContext): string {
  switch (context) {
    case "requisite":
      return "не заполнено пользователем";
    case "operation":
      return "устанавливается эксплуатирующей организацией";
    case "fact":
      return "не заполняется на проектной стадии";
    case "geometry":
      return "требуется проверка геометрической связности модели";
    case "qrad":
      return "требует уточнения методики расчёта солнечных теплопоступлений";
    default:
      return "требуется задание исходного параметра";
  }
}

function expandStageLabel(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (normalized === "П") {
    return "Проектная документация";
  }
  if (normalized === "Р") {
    return "Рабочая документация";
  }
  if (!normalized) {
    return REPORT_EXPORT_NOT_SET;
  }
  return value;
}
