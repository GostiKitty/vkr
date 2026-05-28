import type { BuildingModel, Sp50BuildingCategory, Sp50ConstructionType } from "../../entities/geometry/types";
import type { ScenarioConfig } from "../../entities/workflow/workflow.store";
import type { ThermalSimulationResult } from "../../core/thermal/solver";
import type {
  Sp50CheckStatus,
  Sp50ComplianceReport,
  Sp50ConstructionCheck,
  Sp50EnergyCheck,
} from "../../core/thermal/sp50/types";
import type { ThermalMonteCarloResult } from "../../core/uncertainty/thermalMonteCarlo";
import type { ReportMeta } from "../build/reports/reportMetaPersistence";
import { formatNumber } from "../../shared/utils/format";
import { firstDisplayText, sanitizeDisplayText } from "../../shared/utils/displayText";
import {
  buildCalculationPassportData,
  type CalculationPassportData,
} from "./calculationPassportData";

const NOT_SET = "не задано";
const NO_DATA = "недостаточно данных";
const NEEDS_CLARIFICATION = "требует уточнения";
const CHECK_REQUIRED = "требует проверки";

const REPORT_TITLE =
  "Расчет теплотехнических характеристик ограждающих конструкций и удельного расхода тепловой энергии на отопление и вентиляцию";
const REPORT_SECTION_TITLE =
  "Раздел 5. Сведения об инженерном оборудовании, сетях и системах инженерно-технического обеспечения";
const REPORT_SUBSECTION_TITLE =
  "Отопление, вентиляция и кондиционирование воздуха, тепловые сети";
export interface ThermalProtectionMetricRow {
  key: string;
  label: string;
  symbol?: string;
  unit: string;
  value: string;
  note?: string;
}

export interface ThermalProtectionEnvelopeGroupRow {
  key: string;
  typeLabel: string;
  elementCount: string;
  area: string;
  actualResistance: string;
  requiredResistance: string;
  uValue: string;
  status: string;
}

export interface ThermalProtectionCriticalElementRow {
  key: string;
  elementName: string;
  typeLabel: string;
  area: string;
  actualResistance: string;
  requiredResistance: string;
  status: string;
  note: string;
}

export interface ThermalProtectionAppendixEnvelopeRow {
  key: string;
  elementName: string;
  typeLabel: string;
  area: string;
  actualResistance: string;
  requiredResistance: string;
  uValue: string;
  status: string;
  note: string;
}

export interface ThermalProtectionRcZoneRow {
  key: string;
  zoneName: string;
  temperature: string;
  discomfortHours: string;
  peakSpecificLoad: string;
  specificEnergy: string;
  status: string;
}

export interface ThermalProtectionLossRow {
  key: string;
  label: string;
  value: string;
  note: string;
}

export interface ThermalProtectionReportData {
  metadata: {
    organization: string;
    documentType: string;
    title: string;
    objectName: string;
    sectionTitle: string;
    subsectionTitle: string;
    stage: string;
    year: string;
    generatedAtLabel: string;
    documentCode: string;
    customer: string;
    address: string;
    modelVersion: string;
    developedBy: string;
    checkedBy: string;
    normControl: string;
    chiefEngineer: string;
  };
  toc: Array<{ id: string; label: string }>;
  generalParagraphs: string[];
  sourceDataRows: ThermalProtectionMetricRow[];
  buildingSummaryRows: ThermalProtectionMetricRow[];
  climateRows: ThermalProtectionMetricRow[];
  methodologyLines: string[];
  envelopeGroupRows: ThermalProtectionEnvelopeGroupRow[];
  criticalEnvelopeRows: ThermalProtectionCriticalElementRow[];
  thermalProtectionSummaryRows: ThermalProtectionMetricRow[];
  thermalProtectionConclusion: string;
  energyRows: ThermalProtectionMetricRow[];
  energyAvailable: boolean;
  energyPreliminary: boolean;
  energyNote: string | null;
  dynamicRows: ThermalProtectionMetricRow[];
  dynamicLossRows: ThermalProtectionLossRow[];
  dynamicAvailable: boolean;
  dynamicProblemZones: string[];
  conclusions: {
    normative: string;
    energy: string;
    dynamic: string;
    missing: string;
  };
  warnings: string[];
  missingData: string[];
  appendices: {
    energyPassportRows: ThermalProtectionMetricRow[];
    envelopeRows: ThermalProtectionAppendixEnvelopeRow[];
    rcSummaryRows: ThermalProtectionMetricRow[];
    rcZoneRows: ThermalProtectionRcZoneRow[];
  };
}

interface GroupedConstruction {
  key: string;
  typeLabel: string;
  count: number;
  area: number;
  weightedActualResistance: number | null;
  weightedRequiredResistance: number | null;
  weightedUValue: number | null;
  status: string;
  failures: number;
  insufficient: number;
  conflicts: number;
}

interface ConstructionDiagnostics {
  construction: Sp50ConstructionCheck;
  typeLabel: string;
  classificationConflict: boolean;
  suspiciousSurfaceTemperature: boolean;
  note: string;
  severity: number;
}

export function buildThermalProtectionReportData(input: {
  model: BuildingModel;
  projectId: string | null;
  scenarioConfig: ScenarioConfig | null;
  thermalResult: ThermalSimulationResult | null;
  monteCarloResult: ThermalMonteCarloResult | null;
  reportMeta: ReportMeta;
  generatedAt: Date;
}): ThermalProtectionReportData {
  const base = buildCalculationPassportData({
    model: input.model,
    projectId: input.projectId,
    scenarioConfig: input.scenarioConfig,
    thermalResult: input.thermalResult,
    monteCarloResult: input.monteCarloResult,
  });
  const sp50 = base.sp50Report;
  const generatedAtLabel = formatGeneratedAt(input.generatedAt);
  const stage = resolveStageLabel(input.reportMeta.documentStage);
  const documentCode = resolveDocumentCode(input.model, input.reportMeta, input.projectId);
  const groupedConstructions = groupConstructions(sp50?.constructions ?? []);
  const constructionDiagnostics = buildConstructionDiagnostics(sp50?.constructions ?? [], sp50);
  const classificationConflictCount = constructionDiagnostics.filter((item) => item.classificationConflict).length;
  const suspiciousSurfaceTemperatureCount = constructionDiagnostics.filter(
    (item) => item.suspiciousSurfaceTemperature
  ).length;
  const failedConstructions = (sp50?.constructions ?? []).filter((item) => item.status === "fail");
  const insufficientConstructions = (sp50?.constructions ?? []).filter(
    (item) => item.status === "insufficient_data"
  );
  const dynamicComfort = evaluateDynamicComfort(base);
  const humanMissingData = uniqueHumanMessages([
    ...buildHumanMissingData(base, sp50),
    ...(classificationConflictCount > 0
      ? [
          "Выявлены элементы, требующие проверки классификации: проемы имеют признаки послойной стеновой конструкции или конфликт между типом элемента и расчетным контуром.",
        ]
      : []),
    ...(suspiciousSurfaceTemperatureCount > 0
      ? [
          "Расчет температуры внутренней поверхности для части конструкций не включен в итоговый вывод, так как требует дополнительной валидации.",
        ]
      : []),
  ]);
  const warnings = uniqueHumanMessages([
    ...buildHumanWarnings(base, sp50),
    ...(classificationConflictCount > 0
      ? [
          "Часть оконных или дверных элементов требует проверки классификации. Такие элементы отмечены в приложении Б.",
        ]
      : []),
    ...(suspiciousSurfaceTemperatureCount > 0
      ? [
          "Физически сомнительные значения температуры внутренней поверхности автоматически исключены из итоговой интерпретации.",
        ]
      : []),
  ]);

  const sourceDataRows = buildSourceDataRows(base, sp50, generatedAtLabel);
  const buildingSummaryRows = buildBuildingSummaryRows(base, sp50, groupedConstructions);
  const climateRows = buildClimateRows(base, sp50, input.scenarioConfig);
  const methodologyLines = buildMethodologyLines();
  const envelopeGroupRows = groupedConstructions.map((group) => ({
    key: group.key,
    typeLabel: group.typeLabel,
    elementCount: formatInteger(group.count),
    area: formatMetricNumber(group.area, 2),
    actualResistance: formatMetricNumber(group.weightedActualResistance, 2),
    requiredResistance: formatMetricNumber(group.weightedRequiredResistance, 2),
    uValue: formatMetricNumber(group.weightedUValue, 3),
    status: group.status,
  }));
  const criticalEnvelopeRows = buildCriticalEnvelopeRows(constructionDiagnostics);
  const thermalProtectionSummaryRows = buildThermalProtectionSummaryRows(sp50);
  const thermalProtectionConclusion = buildThermalProtectionConclusion(sp50, failedConstructions.length);
  const energyRows = buildEnergyRows(sp50?.energy ?? null);
  const energyAvailable = energyRows.some((row) => row.value !== NO_DATA);
  const energyPreliminary = Boolean(sp50?.energy.usesPlaceholderInputs);
  const energyNote = buildEnergyNote(sp50?.energy ?? null);
  const dynamicRows = buildDynamicRows(base);
  const dynamicLossRows = buildDynamicLossRows(base);
  const dynamicAvailable = dynamicRows.some((row) => row.value !== NO_DATA);
  const dynamicProblemZones = base.problemZones.slice(0, 5);
  const conclusions = buildConclusions({
    base,
    sp50,
    failedConstructions,
    insufficientConstructions,
    humanMissingData,
    dynamicComfort,
  });
  const appendices = {
    energyPassportRows: buildEnergyPassportRows(sp50?.energy ?? null),
    envelopeRows: buildEnvelopeAppendixRows(constructionDiagnostics),
    rcSummaryRows: buildRcSummaryRows(base),
    rcZoneRows: buildRcZoneRows(input.thermalResult),
  };

  return {
    metadata: {
      organization: textValue(input.reportMeta.developerOrg),
      documentType: "Проектная документация",
      title: REPORT_TITLE,
      objectName: textValue(base.projectName),
      sectionTitle: textValue(input.reportMeta.projectSection || REPORT_SECTION_TITLE),
      subsectionTitle: REPORT_SUBSECTION_TITLE,
      stage,
      year: String(input.generatedAt.getFullYear()),
      generatedAtLabel,
      documentCode,
      customer: textValue(input.reportMeta.customerOrg),
      address: textValue(input.reportMeta.buildingAddress),
      modelVersion: textValue(base.modelVersion),
      developedBy: resolveResponsiblePerson(input.model, ["developedBy", "author", "developer"]),
      checkedBy: resolveResponsiblePerson(input.model, ["checkedBy", "reviewer", "checker"]),
      normControl: resolveResponsiblePerson(input.model, ["normControl", "normokontrol", "normController"]),
      chiefEngineer: resolveResponsiblePerson(input.model, ["gip", "chiefEngineer", "projectEngineer"]),
    },
    toc: buildToc(),
    generalParagraphs: [
      "Настоящий расчетный документ сформирован по данным цифровой модели здания и содержит расчетно-пояснительные материалы по тепловой защите, теплопотерям и энергетическим показателям объекта.",
      "Документ сформирован в структуре текстовой части проектной документации и предназначен для представления расчетно-пояснительных материалов по тепловой защите здания.",
      "Расчет выполнен средствами расчетного модуля программного комплекса.",
    ],
    sourceDataRows,
    buildingSummaryRows,
    climateRows,
    methodologyLines,
    envelopeGroupRows,
    criticalEnvelopeRows,
    thermalProtectionSummaryRows,
    thermalProtectionConclusion,
    energyRows,
    energyAvailable,
    energyPreliminary,
    energyNote,
    dynamicRows,
    dynamicLossRows,
    dynamicAvailable,
    dynamicProblemZones,
    conclusions,
    warnings,
    missingData: humanMissingData,
    appendices,
  };
}

function buildToc() {
  return [
    { id: "report-section-1", label: "1 Общие положения" },
    { id: "report-section-2", label: "2 Исходные данные" },
    { id: "report-section-3", label: "3 Краткая характеристика здания" },
    { id: "report-section-4", label: "4 Климатические и эксплуатационные параметры" },
    { id: "report-section-5", label: "5 Методика расчета" },
    { id: "report-section-6", label: "6 Теплотехнические характеристики ограждающих конструкций" },
    { id: "report-section-7", label: "7 Проверка сопротивления теплопередаче" },
    { id: "report-section-8", label: "8 Удельная теплозащитная характеристика здания" },
    { id: "report-section-9", label: "9 Энергетическая характеристика и расход тепловой энергии" },
    { id: "report-section-10", label: "10 Дополнительная динамическая оценка теплового режима" },
    { id: "report-section-11", label: "11 Выводы" },
    { id: "report-section-12", label: "12 Перечень недостающих исходных данных" },
    { id: "appendix-a", label: "Приложение А. Энергетический паспорт" },
    { id: "appendix-b", label: "Приложение Б. Ведомость ограждающих конструкций" },
    { id: "appendix-c", label: "Приложение В. Подробные результаты RC-модели" },
  ];
}

function buildSourceDataRows(
  base: CalculationPassportData,
  sp50: Sp50ComplianceReport | null,
  generatedAtLabel: string
): ThermalProtectionMetricRow[] {
  return [
    row("object", "Объект", "", textValue(base.projectName)),
    row("generatedAt", "Дата расчета", "", generatedAtLabel),
    row("city", "Город / климатическая база", "", textValue(base.climate.city)),
    row("outdoorDesign", "Расчетная наружная температура", "°C", formatMetricNumber(base.climate.outdoorDesignTemperatureC)),
    row(
      "heatingAverage",
      "Средняя температура отопительного периода",
      "°C",
      formatMetricNumber(base.climate.outdoorHeatingAverageC)
    ),
    row(
      "heatingDuration",
      "Продолжительность отопительного периода",
      "сут.",
      formatMetricNumber(base.climate.heatingDurationDays, 0)
    ),
    row("gsop", "ГСОП", "°C·сут.", formatMetricNumber(sp50?.sourceData.gsop)),
    row("indoor", "Расчетная внутренняя температура", "°C", formatMetricNumber(base.climate.indoorTemperatureC)),
    row(
      "humidity",
      "Относительная влажность внутреннего воздуха",
      "%",
      formatMetricNumber(sp50?.sourceData.indoorRelativeHumidityPercent, 0)
    ),
    row(
      "operationMode",
      "Режим эксплуатации",
      "",
      buildOperationModeLabel(base)
    ),
  ];
}

function buildBuildingSummaryRows(
  base: CalculationPassportData,
  sp50: Sp50ComplianceReport | null,
  groups: GroupedConstruction[]
): ThermalProtectionMetricRow[] {
  return [
    row(
      "purpose",
      "Назначение здания",
      "",
      mapBuildingCategory(sp50?.sourceData.buildingCategory ?? null)
    ),
    row(
      "storeys",
      "Этажность",
      "эт.",
      formatMetricNumber(sp50?.sourceData.storeys ?? base.summary.levelCount, 0)
    ),
    row("area", "Отапливаемая площадь", "м²", formatMetricNumber(base.summary.totalAreaM2, 2)),
    row("volume", "Отапливаемый объем", "м³", formatMetricNumber(base.summary.totalVolumeM3, 2)),
    row(
      "groups",
      "Основные группы конструкций",
      "",
      groups.length ? groups.map((group) => group.typeLabel).join(", ") : NO_DATA
    ),
    row(
      "compactness",
      "Показатель компактности",
      "1/м",
      formatMetricNumber(sp50?.building.compactness_1_m, 3)
    ),
  ];
}

function buildClimateRows(
  base: CalculationPassportData,
  sp50: Sp50ComplianceReport | null,
  scenarioConfig: ScenarioConfig | null
): ThermalProtectionMetricRow[] {
  return [
    row(
      "outdoorDesign",
      "Расчетная наружная температура",
      "°C",
      formatMetricNumber(base.climate.outdoorDesignTemperatureC),
      "По климатической базе и данным модели"
    ),
    row(
      "heatingAverage",
      "Средняя температура отопительного периода",
      "°C",
      formatMetricNumber(base.climate.outdoorHeatingAverageC),
      "По климатической базе"
    ),
    row(
      "heatingDuration",
      "Продолжительность отопительного периода",
      "сут.",
      formatMetricNumber(base.climate.heatingDurationDays, 0),
      "По климатической базе"
    ),
    row(
      "gsop",
      "ГСОП",
      "°C·сут.",
      formatMetricNumber(sp50?.sourceData.gsop),
      "Расчет по СП 131"
    ),
    row(
      "indoor",
      "Внутренняя температура",
      "°C",
      formatMetricNumber(base.climate.indoorTemperatureC ?? base.operation.daySetpointC),
      "Сценарий расчета"
    ),
    row(
      "humidity",
      "Относительная влажность",
      "%",
      formatMetricNumber(sp50?.sourceData.indoorRelativeHumidityPercent, 0),
      "Данные модели / допущение"
    ),
    row(
      "ventilation",
      "Кратность вентиляции",
      "1/ч",
      formatMetricNumber(base.operation.ventilationACH, 2),
      scenarioConfig ? "Сценарий расчета" : "Требует уточнения"
    ),
    row(
      "infiltration",
      "Кратность инфильтрации",
      "1/ч",
      formatMetricNumber(base.operation.infiltrationACH, 2),
      scenarioConfig ? "Сценарий расчета" : "Требует уточнения"
    ),
    row(
      "heatRecovery",
      "Коэффициент рекуперации",
      "доля",
      formatMetricNumber(base.operation.heatRecoveryFactor, 2),
      "Сценарий расчета"
    ),
  ];
}

function buildMethodologyLines() {
  return [
    "Сопротивление теплопередаче ограждающих конструкций определено по расчетному послойному составу и нормативным допущениям теплотехнического модуля.",
    "Удельная теплозащитная характеристика здания определена по сводной площади наружной оболочки и приведенным сопротивлениям теплопередаче.",
    "Расчет теплопотерь и энергетических показателей выполнен по доступным данным о конструкции, климате и параметрах воздухообмена.",
    "Дополнительная динамическая оценка выполнена на основе зональной RC-модели теплового режима и приводится отдельно от нормативной проверки.",
  ];
}

function buildThermalProtectionSummaryRows(
  sp50: Sp50ComplianceReport | null
): ThermalProtectionMetricRow[] {
  return [
    row(
      "kobActual",
      "kоб расчетное",
      "Вт/(м³·К)",
      formatMetricNumber(sp50?.building.kob_W_m3K, 3)
    ),
    row(
      "kobNorm",
      "kоб нормативное",
      "Вт/(м³·К)",
      formatMetricNumber(sp50?.building.kobNorm_W_m3K, 3)
    ),
    row(
      "kobStatus",
      "Статус",
      "",
      sp50 ? mapBuildingCompliance(sp50.building.complies, sp50.building.status) : NO_DATA
    ),
  ];
}

function buildThermalProtectionConclusion(
  sp50: Sp50ComplianceReport | null,
  failedCount: number
) {
  if (!sp50) {
    return "Нормативная проверка теплозащиты не выполнена из-за недостатка исходных данных.";
  }
  if (failedCount > 0 || sp50.building.complies === false) {
    return "Нормативная проверка теплозащиты выявила конструкции и/или сводные показатели, требующие корректировки проектных решений.";
  }
  if (sp50.building.status === "insufficient_data") {
    return "Нормативная проверка теплозащиты выполнена частично. Для окончательного вывода необходимо дополнить исходные данные.";
  }
  return "По сводным нормативным показателям теплозащита наружной оболочки соответствует расчетным требованиям.";
}

function buildEnergyRows(energy: Sp50EnergyCheck | null): ThermalProtectionMetricRow[] {
  if (!energy) {
    return [
      row("energyStatus", "Статус расчета", "", NO_DATA),
    ];
  }

  return [
    row(
      "qHeatingCharacteristic",
      "Удельная характеристика расхода тепловой энергии",
      "Вт/(м³·К)",
      formatMetricNumber(energy.qHeatingCharacteristic_W_m3K, 3)
    ),
    row(
      "qNorm",
      "Нормативный удельный расход",
      "кВт·ч/м²",
      formatMetricNumber(energy.qHeatingNorm_kWh_m2, 2)
    ),
    row(
      "annualHeatingEnergy",
      "Годовой расход тепловой энергии",
      "кВт·ч",
      formatMetricNumber(energy.annualHeatingEnergy_kWh, 1)
    ),
    row(
      "annualLosses",
      "Годовые теплопотери",
      "кВт·ч",
      formatMetricNumber(energy.annualTotalLosses_kWh, 1)
    ),
    row(
      "qByArea",
      "Удельный расход по площади",
      "кВт·ч/м²",
      formatMetricNumber(energy.qByArea_kWh_m2, 2)
    ),
    row(
      "energyStatus",
      "Статус",
      "",
      mapBuildingCompliance(energy.complies, energy.status)
    ),
  ];
}

function buildEnergyNote(energy: Sp50EnergyCheck | null) {
  if (!energy) {
    return "Энергетическая характеристика не рассчитана.";
  }
  if (energy.usesPlaceholderInputs) {
    return "Расчет выполнен с неполным набором исходных данных. Результат является предварительным.";
  }
  if (energy.status === "insufficient_data") {
    return "Для расчета энергетической характеристики требуется дополнить климатические и эксплуатационные данные.";
  }
  return null;
}

function buildDynamicRows(base: CalculationPassportData): ThermalProtectionMetricRow[] {
  return [
    row(
      "peakLoad",
      "Пиковая тепловая нагрузка",
      "кВт",
      formatMetricNumber(base.thermalResults.peakLoadKW, 2)
    ),
    row(
      "energy",
      "Тепловая энергия за период",
      "кВт·ч",
      formatMetricNumber(base.thermalResults.totalEnergyKWh, 1)
    ),
    row(
      "avgTemp",
      "Средняя температура воздуха по зонам",
      "°C",
      formatMetricNumber(base.thermalResults.averageRoomTemperatureC, 1)
    ),
    row(
      "minTemp",
      "Минимальная температура",
      "°C",
      formatMetricNumber(base.thermalResults.minRoomTemperatureC, 1)
    ),
    row(
      "maxTemp",
      "Максимальная температура",
      "°C",
      formatMetricNumber(base.thermalResults.maxRoomTemperatureC, 1)
    ),
    row(
      "discomfort",
      "Часы дискомфорта",
      "ч",
      formatMetricNumber(base.thermalResults.discomfortHours, 1)
    ),
  ];
}

function buildDynamicLossRows(base: CalculationPassportData): ThermalProtectionLossRow[] {
  const diagnostics = base.thermalResults.available ? base.thermalResults : null;
  const building = base.sp50Report?.building ?? null;
  void building;

  return [
    lossRow(
      "opaque",
      "Непрозрачные конструкции",
      formatMetricNumber(diagnostics?.totalOpaqueLossW, 0),
      "Суммарные расчетные потери через непрозрачные ограждения"
    ),
    lossRow(
      "window",
      "Окна",
      formatMetricNumber(diagnostics?.totalWindowLossW, 0),
      "Суммарные расчетные потери через оконные заполнения"
    ),
    lossRow(
      "door",
      "Наружные двери",
      formatMetricNumber(diagnostics?.totalDoorLossW, 0),
      "Суммарные расчетные потери через наружные двери"
    ),
    lossRow(
      "infiltration",
      "Инфильтрация",
      formatMetricNumber(diagnostics?.totalInfiltrationLossW, 0),
      "Потери, обусловленные неорганизованным воздухообменом"
    ),
    lossRow(
      "ventilation",
      "Вентиляция",
      formatMetricNumber(diagnostics?.totalVentilationLossW, 0),
      "Потери, обусловленные механической вентиляцией"
    ),
  ];
}

function buildConclusions(input: {
  base: CalculationPassportData;
  sp50: Sp50ComplianceReport | null;
  failedConstructions: Sp50ConstructionCheck[];
  insufficientConstructions: Sp50ConstructionCheck[];
  humanMissingData: string[];
  dynamicComfort: { available: boolean; comfortable: boolean };
}) {
  const { base, sp50, failedConstructions, insufficientConstructions, humanMissingData, dynamicComfort } = input;

  const normative =
    !sp50
      ? "Нормативная проверка теплозащиты не сформирована."
      : failedConstructions.length > 0 || sp50.building.complies === false
        ? `Нормативная проверка теплозащиты выявила ${formatInteger(
            failedConstructions.length
          )} конструкций(ю), не соответствующих расчетным требованиям, и требует корректировки решений по оболочке здания.`
        : insufficientConstructions.length > 0
          ? "Нормативная проверка теплозащиты выполнена частично. Для окончательного вывода необходимо уточнить отдельные конструкции."
          : "По результатам нормативной проверки теплозащиты существенных несоответствий не выявлено.";

  const energy =
    !sp50
      ? "Энергетическая характеристика не сформирована."
      : sp50.energy.usesPlaceholderInputs
        ? "Энергетическая характеристика рассчитана предварительно. Для окончательного значения требуется уточнить параметры вентиляции и инфильтрации."
        : sp50.energy.complies === false
          ? "Расчетные энергетические показатели требуют дополнительной оптимизации проектных решений."
          : sp50.energy.status === "insufficient_data"
            ? "Энергетические показатели требуют дополнительного набора исходных данных."
            : "Энергетические показатели сформированы по расчетным данным и могут использоваться как предварительное инженерное обоснование.";

  const dynamic =
    !base.thermalResults.available
      ? "Дополнительная динамическая оценка теплового режима не выполнялась."
      : failedConstructions.length > 0 && dynamicComfort.available && dynamicComfort.comfortable
        ? "По результатам динамической RC-оценки температура воздуха в расчетном сценарии находится в комфортном диапазоне. При этом нормативная проверка теплозащиты выявила несоответствие отдельных ограждающих конструкций требованиям по сопротивлению теплопередаче."
        : dynamicComfort.available && dynamicComfort.comfortable
          ? "По результатам динамической RC-оценки температурный режим в расчетном сценарии находится в допустимом диапазоне."
          : "Дополнительная динамическая оценка показывает необходимость уточнения сценария эксплуатации и параметров наружной оболочки.";

  const missing =
    humanMissingData.length > 0
      ? `Для завершения расчетного обоснования требуется уточнить следующие исходные данные: ${humanMissingData
          .slice(0, 3)
          .map((item) => item.replace(/\.$/, ""))
          .join("; ")}.`
      : "Критических пробелов в исходных данных, препятствующих формированию сводного отчета, не выявлено.";

  return { normative, energy, dynamic, missing };
}

function buildEnergyPassportRows(energy: Sp50EnergyCheck | null): ThermalProtectionMetricRow[] {
  if (!energy) {
    return [];
  }
  return [
    row(
      "qHeatingCharacteristic",
      "Удельная характеристика расхода тепловой энергии",
      "Вт/(м³·К)",
      formatMetricNumber(energy.qHeatingCharacteristic_W_m3K, 3)
    ),
    row("qNorm", "Нормативный удельный расход", "кВт·ч/м²", formatMetricNumber(energy.qHeatingNorm_kWh_m2, 2)),
    row("annualHeating", "Годовой расход тепловой энергии", "кВт·ч", formatMetricNumber(energy.annualHeatingEnergy_kWh, 1)),
    row("annualLosses", "Годовые теплопотери", "кВт·ч", formatMetricNumber(energy.annualTotalLosses_kWh, 1)),
    row("qByArea", "Удельный расход по площади", "кВт·ч/м²", formatMetricNumber(energy.qByArea_kWh_m2, 2)),
    row("qByVolume", "Удельный расход по объему", "кВт·ч/м³", formatMetricNumber(energy.qByVolume_kWh_m3, 3)),
    row(
      "ventilationCharacteristic",
      "Вентиляционная составляющая",
      "Вт/(м³·К)",
      formatMetricNumber(energy.ventilationCharacteristic_W_m3K, 3)
    ),
    row(
      "internalGainCharacteristic",
      "Внутренние теплопоступления",
      "Вт/(м³·К)",
      formatMetricNumber(energy.internalGainCharacteristic_W_m3K, 3)
    ),
    row(
      "solarGainCharacteristic",
      "Солнечные теплопоступления",
      "Вт/(м³·К)",
      formatMetricNumber(energy.solarGainCharacteristic_W_m3K, 3)
    ),
    row(
      "beta",
      "Коэффициент использования теплопоступлений",
      "доля",
      formatMetricNumber(energy.betaGainUseFactor, 2)
    ),
    row("airExchange", "Средняя кратность воздухообмена", "1/ч", formatMetricNumber(energy.averageAirExchange_1_h, 3)),
    row("status", "Статус", "", mapBuildingCompliance(energy.complies, energy.status)),
  ];
}

function buildEnvelopeAppendixRows(
  diagnostics: ConstructionDiagnostics[]
): ThermalProtectionAppendixEnvelopeRow[] {
  return diagnostics.map((item) => ({
    key: item.construction.id,
    elementName: sanitizeDisplayText(item.construction.label, item.construction.id, { allowInternalId: true }),
    typeLabel: item.typeLabel,
    area: formatMetricNumber(item.construction.areaM2, 2),
    actualResistance: formatMetricNumber(item.construction.actualResistance_m2K_W, 2),
    requiredResistance: formatMetricNumber(item.construction.normalizedResistance_m2K_W, 2),
    uValue: formatMetricNumber(item.construction.heatTransferCoefficient_W_m2K, 3),
    status: resolveConstructionStatusLabel(item),
    note: item.note,
  }));
}

function buildRcSummaryRows(base: CalculationPassportData): ThermalProtectionMetricRow[] {
  return [
    row("peakLoad", "Пиковая тепловая нагрузка", "кВт", formatMetricNumber(base.thermalResults.peakLoadKW, 2)),
    row("energy", "Тепловая энергия за период", "кВт·ч", formatMetricNumber(base.thermalResults.totalEnergyKWh, 1)),
    row("specificPeak", "Удельная пиковая нагрузка", "Вт/м²", formatMetricNumber(base.thermalResults.specificPeakLoad_W_m2, 1)),
    row("specificEnergy", "Удельная энергия за период", "кВт·ч/м²", formatMetricNumber(base.thermalResults.specificEnergyKWh_m2, 2)),
    row("avgTemp", "Средняя температура", "°C", formatMetricNumber(base.thermalResults.averageRoomTemperatureC, 1)),
    row("referenceOutdoor", "Расчетная наружная температура в срезе", "°C", formatMetricNumber(base.thermalResults.referenceOutdoorTemperatureC, 1)),
    row("discomfort", "Часы дискомфорта", "ч", formatMetricNumber(base.thermalResults.discomfortHours, 1)),
  ];
}

function buildRcZoneRows(thermalResult: ThermalSimulationResult | null): ThermalProtectionRcZoneRow[] {
  const zones = thermalResult?.diagnostics?.zones ?? [];
  return zones.map((zone) => ({
    key: zone.zoneId,
    zoneName: sanitizeDisplayText(zone.zoneName, zone.zoneId, { allowInternalId: true }),
    temperature: formatMetricNumber(zone.temperatureC, 1),
    discomfortHours: formatMetricNumber(zone.discomfortHours, 1),
    peakSpecificLoad: formatMetricNumber(zone.peakSpecificLoad_W_m2, 1),
    specificEnergy: formatMetricNumber(zone.energyKWh_m2, 2),
    status: mapZoneStatus(zone.status),
  }));
}

function groupConstructions(constructions: Sp50ConstructionCheck[]): GroupedConstruction[] {
  const map = new Map<string, GroupedConstruction>();

  constructions.forEach((construction) => {
    const key = resolveConstructionGroupKey(construction.constructionType);
    const typeLabel = resolveConstructionGroupLabel(construction.constructionType);
    const current = map.get(key) ?? {
      key,
      typeLabel,
      count: 0,
      area: 0,
      weightedActualResistance: null,
      weightedRequiredResistance: null,
      weightedUValue: null,
      status: NO_DATA,
      failures: 0,
      insufficient: 0,
      conflicts: 0,
    };

    current.count += 1;
    current.area += construction.areaM2;
    current.weightedActualResistance = mergeWeightedAverage(
      current.weightedActualResistance,
      current.area - construction.areaM2,
      construction.actualResistance_m2K_W,
      construction.areaM2
    );
    current.weightedRequiredResistance = mergeWeightedAverage(
      current.weightedRequiredResistance,
      current.area - construction.areaM2,
      construction.normalizedResistance_m2K_W,
      construction.areaM2
    );
    current.weightedUValue = mergeWeightedAverage(
      current.weightedUValue,
      current.area - construction.areaM2,
      construction.heatTransferCoefficient_W_m2K,
      construction.areaM2
    );
    if (construction.status === "fail") {
      current.failures += 1;
    }
    if (construction.status === "insufficient_data") {
      current.insufficient += 1;
    }
    if (hasClassificationConflict(construction)) {
      current.conflicts += 1;
    }
    current.status = resolveGroupStatus(current);
    map.set(key, current);
  });

  return [...map.values()].sort((left, right) => left.key.localeCompare(right.key, "ru"));
}

function buildConstructionDiagnostics(
  constructions: Sp50ConstructionCheck[],
  sp50: Sp50ComplianceReport | null
): ConstructionDiagnostics[] {
  const outdoorTemperature = sp50?.sourceData.outdoorDesignTemperatureC ?? null;
  const indoorTemperature = sp50?.sourceData.indoorTemperatureC ?? null;

  return constructions
    .map((construction) => {
      const classificationConflict = hasClassificationConflict(construction);
      const suspiciousSurfaceTemperature = hasSuspiciousSurfaceTemperature(
        construction,
        indoorTemperature,
        outdoorTemperature
      );
      const note = buildConstructionNote(construction, classificationConflict, suspiciousSurfaceTemperature);
      return {
        construction,
        typeLabel: resolveConstructionGroupLabel(construction.constructionType),
        classificationConflict,
        suspiciousSurfaceTemperature,
        note,
        severity: resolveConstructionSeverity(construction, classificationConflict),
      };
    })
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity - right.severity;
      }
      const leftMargin = left.construction.margin_m2K_W ?? Number.POSITIVE_INFINITY;
      const rightMargin = right.construction.margin_m2K_W ?? Number.POSITIVE_INFINITY;
      if (leftMargin !== rightMargin) {
        return leftMargin - rightMargin;
      }
      return right.construction.areaM2 - left.construction.areaM2;
    });
}

function buildCriticalEnvelopeRows(
  diagnostics: ConstructionDiagnostics[]
): ThermalProtectionCriticalElementRow[] {
  return diagnostics
    .filter((item) => item.severity < 0)
    .slice(0, 10)
    .map((item) => ({
      key: item.construction.id,
      elementName: sanitizeDisplayText(item.construction.label, item.construction.id, {
        allowInternalId: true,
      }),
      typeLabel: item.typeLabel,
      area: formatMetricNumber(item.construction.areaM2, 2),
      actualResistance: formatMetricNumber(item.construction.actualResistance_m2K_W, 2),
      requiredResistance: formatMetricNumber(item.construction.normalizedResistance_m2K_W, 2),
      status: resolveConstructionStatusLabel(item),
      note: item.note,
    }));
}

function buildHumanMissingData(base: CalculationPassportData, sp50: Sp50ComplianceReport | null) {
  return uniqueHumanMessages([
    ...base.warnings.map(humanizeMessage),
    ...(sp50?.missingData ?? []).map(humanizeMessage),
    ...(sp50?.energy.placeholderWarnings ?? []).map(humanizeMessage),
  ]);
}

function buildHumanWarnings(base: CalculationPassportData, sp50: Sp50ComplianceReport | null) {
  return uniqueHumanMessages([
    ...base.recommendations.map((item) => sanitizeDisplayText(item, "", { allowInternalId: true })),
    ...(sp50?.recommendations.map((item) => `${item.title}. ${item.effect}`) ?? []),
  ]);
}

function evaluateDynamicComfort(base: CalculationPassportData) {
  if (!base.thermalResults.available) {
    return { available: false, comfortable: false };
  }
  const discomfort = base.thermalResults.discomfortHours;
  const average = base.thermalResults.averageRoomTemperatureC;
  const setpoint = base.operation.daySetpointC;
  const discomfortOk = typeof discomfort === "number" && discomfort <= 12;
  const averageOk =
    typeof average === "number" && typeof setpoint === "number"
      ? Math.abs(average - setpoint) <= 1.5
      : false;
  return {
    available: true,
    comfortable: discomfortOk || averageOk || base.problemZones.length === 0,
  };
}

function buildOperationModeLabel(base: CalculationPassportData) {
  const day = formatMetricNumber(base.operation.daySetpointC, 1);
  const night = formatMetricNumber(base.operation.nightSetpointC, 1);
  const vent = textValue(base.operation.mechanicalVentilationEnabled === null ? null : base.operation.mechanicalVentilationEnabled ? "механическая вентиляция предусмотрена" : "механическая вентиляция не задана");
  return `Дневная уставка ${day} °C, ночная уставка ${night} °C; ${vent}.`;
}

function resolveDocumentCode(model: BuildingModel, reportMeta: ReportMeta, projectId: string | null) {
  const meta = model.meta ?? {};
  const fromModel = firstDisplayText(
    [meta["documentCode"], meta["designation"], meta["cipher"], meta["projectCipher"]],
    "",
    { allowInternalId: true }
  );
  const sanitized = sanitizeDisplayText(fromModel || reportMeta.projectCipher || projectId, "", {
    allowInternalId: true,
  });
  return sanitized || "б/н";
}

function resolveStageLabel(stageValue: string | null | undefined) {
  const normalized = sanitizeDisplayText(stageValue, "", { allowInternalId: true }).toLowerCase();
  if (!normalized) {
    return "П";
  }
  if (normalized === "п" || normalized.includes("проект")) {
    return "П";
  }
  if (normalized === "р" || normalized.includes("рабоч")) {
    return "Р";
  }
  return sanitizeDisplayText(stageValue, "П", { allowInternalId: true });
}

function resolveResponsiblePerson(model: BuildingModel, keys: string[]) {
  const meta = model.meta ?? {};
  const values = keys.map((key) => meta[key]);
  const resolved = firstDisplayText(values, "", { allowInternalId: false });
  return resolved || NOT_SET;
}

function row(
  key: string,
  label: string,
  unit: string,
  value: string,
  note?: string
): ThermalProtectionMetricRow {
  return { key, label, unit, value, note };
}

function lossRow(key: string, label: string, value: string, note: string): ThermalProtectionLossRow {
  return { key, label, value, note };
}

function textValue(value: string | null | undefined) {
  const sanitized = sanitizeDisplayText(value, "", { allowInternalId: true });
  return sanitized || NOT_SET;
}

function formatMetricNumber(value: number | null | undefined, digits = 2) {
  return Number.isFinite(value)
    ? formatNumber(value, {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
        fallback: NO_DATA,
      })
    : NO_DATA;
}

function formatInteger(value: number) {
  return formatNumber(value, { maximumFractionDigits: 0, fallback: NO_DATA });
}

function formatGeneratedAt(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function mergeWeightedAverage(
  currentAverage: number | null,
  currentWeight: number,
  nextValue: number | null,
  nextWeight: number
) {
  if (!Number.isFinite(nextValue)) {
    return currentAverage;
  }
  if (!Number.isFinite(currentAverage) || currentAverage === null || currentWeight <= 0) {
    return nextValue;
  }
  return (currentAverage * currentWeight + (nextValue ?? 0) * nextWeight) / (currentWeight + nextWeight);
}

function resolveConstructionGroupKey(type: Sp50ConstructionType) {
  switch (type) {
    case "gate":
      return "door";
    case "covering":
    case "roof":
      return "roof";
    default:
      return type;
  }
}

function resolveConstructionGroupLabel(type: Sp50ConstructionType) {
  switch (type) {
    case "wall":
      return "Наружные стены";
    case "roof":
    case "covering":
      return "Покрытия и кровля";
    case "atticFloor":
      return "Чердачные перекрытия";
    case "floorOverBasement":
      return "Полы над подвалом";
    case "floorOnGround":
      return "Полы по грунту";
    case "window":
    case "lantern":
      return "Окна";
    case "door":
    case "gate":
      return "Наружные двери";
    default:
      return sanitizeDisplayText(type, CHECK_REQUIRED, { allowInternalId: true });
  }
}

function resolveGroupStatus(group: GroupedConstruction) {
  if (group.conflicts > 0) {
    return CHECK_REQUIRED;
  }
  if (group.failures > 0) {
    return "не соответствует";
  }
  if (group.insufficient > 0 && group.count === group.insufficient) {
    return NO_DATA;
  }
  if (group.insufficient > 0) {
    return NEEDS_CLARIFICATION;
  }
  return "соответствует";
}

function hasClassificationConflict(construction: Sp50ConstructionCheck) {
  const openingType =
    construction.constructionType === "window" ||
    construction.constructionType === "door" ||
    construction.constructionType === "gate" ||
    construction.constructionType === "lantern";
  const hasLayeredAssembly = construction.layers.length > 0;
  const id = construction.id.toLowerCase();
  const sourcePrefixMismatch =
    (id.startsWith("window-") && construction.constructionType !== "window") ||
    (id.startsWith("door-") && construction.constructionType !== "door" && construction.constructionType !== "gate");
  return openingType ? hasLayeredAssembly || sourcePrefixMismatch : sourcePrefixMismatch;
}

function hasSuspiciousSurfaceTemperature(
  construction: Sp50ConstructionCheck,
  indoorTemperature: number | null,
  outdoorTemperature: number | null
) {
  if (
    !Number.isFinite(construction.internalSurfaceTemperatureC) ||
    !Number.isFinite(indoorTemperature) ||
    !Number.isFinite(outdoorTemperature)
  ) {
    return false;
  }
  const tSi = construction.internalSurfaceTemperatureC ?? 0;
  const indoor = indoorTemperature ?? 0;
  const outdoor = outdoorTemperature ?? 0;
  if (tSi < outdoor - 0.5 || tSi > indoor + 0.5) {
    return true;
  }
  return Math.abs(tSi - outdoor) < Math.max(1, Math.abs(indoor - outdoor) * 0.15);
}

function buildConstructionNote(
  construction: Sp50ConstructionCheck,
  classificationConflict: boolean,
  suspiciousSurfaceTemperature: boolean
) {
  if (classificationConflict) {
    return "Требует проверки классификации.";
  }
  if (construction.status === "fail") {
    return "Фактическое сопротивление теплопередаче ниже требуемого.";
  }
  if (construction.status === "insufficient_data") {
    return "Недостаточно данных по составу или нормативным параметрам конструкции.";
  }
  if (suspiciousSurfaceTemperature) {
    return "Температура внутренней поверхности исключена из итоговой интерпретации и требует отдельной проверки.";
  }
  return "Без замечаний по сводной проверке.";
}

function resolveConstructionSeverity(
  construction: Sp50ConstructionCheck,
  classificationConflict: boolean
) {
  if (construction.status === "fail") {
    return -3;
  }
  if (classificationConflict) {
    return -2;
  }
  if (construction.status === "insufficient_data") {
    return -1;
  }
  return 0;
}

function resolveConstructionStatusLabel(item: ConstructionDiagnostics) {
  if (item.classificationConflict) {
    return "требует проверки классификации";
  }
  return mapConstructionStatus(item.construction.status);
}

function mapConstructionStatus(status: Sp50CheckStatus) {
  switch (status) {
    case "pass":
      return "соответствует";
    case "fail":
      return "не соответствует";
    case "insufficient_data":
      return NO_DATA;
    default:
      return NEEDS_CLARIFICATION;
  }
}

function mapBuildingCompliance(
  complies: boolean | null,
  status: Sp50CheckStatus | null | undefined
) {
  if (complies === true) {
    return "соответствует";
  }
  if (complies === false) {
    return "не соответствует";
  }
  if (status === "insufficient_data") {
    return NO_DATA;
  }
  return NEEDS_CLARIFICATION;
}

function mapBuildingCategory(category: Sp50BuildingCategory | null) {
  switch (category) {
    case "residential":
      return "жилое";
    case "public":
      return "общественное";
    case "medical":
      return "медицинское";
    case "educational":
      return "образовательное";
    case "preschool":
      return "дошкольное";
    case "administrative":
      return "административное";
    case "industrialDry":
      return "производственное (сухой режим)";
    case "industrialWet":
      return "производственное (влажный режим)";
    case "industrialHighHeat":
      return "производственное (повышенные тепловыделения)";
    case "agricultural":
      return "сельскохозяйственное";
    case "storage":
      return "складское";
    default:
      return NOT_SET;
  }
}

function mapZoneStatus(status: "ok" | "attention" | "risk") {
  switch (status) {
    case "ok":
      return "в пределах расчета";
    case "attention":
      return "требует внимания";
    case "risk":
      return "риск";
    default:
      return NEEDS_CLARIFICATION;
  }
}

function humanizeMessage(message: string) {
  const sanitized = sanitizeDisplayText(message, "", { allowInternalId: true });
  const normalized = sanitized.toLowerCase();

  if (!sanitized) {
    return null;
  }
  if (normalized.includes("monte carlo")) {
    return null;
  }
  if (normalized.includes("l_vent") || normalized.includes("ventilationach")) {
    return "Не заданы проектные параметры вентиляции. Энергетические показатели требуют уточнения после ввода расчетных параметров воздухообмена.";
  }
  if (normalized.includes("g_inf") || normalized.includes("infiltrationach")) {
    return "Не заданы или не проверены данные по инфильтрации. Энергетические показатели требуют уточнения.";
  }
  if (normalized.includes("отапливаемый объём") || normalized.includes("объём v")) {
    return "Не задан или не подтвержден отапливаемый объем здания.";
  }
  if (normalized.includes("gsop")) {
    return "Не задан или не определен ГСОП для выбранной климатической базы.";
  }
  if (normalized.includes("средняя t_ot") || normalized.includes("средняя температура наружного воздуха отопительного периода")) {
    return "Не задана средняя температура наружного воздуха отопительного периода.";
  }
  if (normalized.includes("k_ob")) {
    return "Не рассчитана удельная теплозащитная характеристика здания из-за неполных исходных данных.";
  }
  if (normalized.includes("категория здания")) {
    return "Не задано назначение здания для нормативной проверки по СП 50.";
  }
  if (normalized.includes("зона влажности")) {
    return "Не задана зона влажности района строительства.";
  }
  if (normalized.includes("сценарий расчета не задан")) {
    return "Не заданы проектные эксплуатационные параметры сценария расчета.";
  }
  if (normalized.includes("теплотехнический расчет не выполнен")) {
    return "Не выполнен основной теплотехнический расчет.";
  }
  if (normalized.includes("площадь проекции")) {
    return "Для части кровли использована площадь проекции. Геометрические параметры покрытия требуют уточнения.";
  }
  if (normalized.includes("межэтажная плита считается внутренним элементом")) {
    return null;
  }
  if (normalized.includes("тип не сопоставлен")) {
    return "Часть перекрытий требует проверки типа конструкции для корректной нормативной классификации.";
  }
  return sanitized;
}

function uniqueHumanMessages(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values
    .map((value) => sanitizeDisplayText(value, "", { allowInternalId: true }))
    .filter((value) => {
      if (!value) {
        return false;
      }
      const normalized = value.trim();
      if (!normalized || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
}
