/**
 * Данные для выгрузки "Раздел 5 ОВ/ТС".
 */

import type { ReportBaseData } from "./buildReportBaseData";
import type { ExportEnvelopeElement } from "./buildExportEnvelopeView";
import { humanizeProjectText } from "./exportText";
import {
  formatDynamicMetricValue,
  REPORT_EXPORT_NO_DATA,
} from "../helpers";

export interface MetricRow {
  key: string;
  label: string;
  unit: string;
  value: string;
  note?: string;
}

export interface EnvelopeGroupRow {
  key: string;
  typeLabel: string;
  count: string;
  area: string;
  weightedRequiredResistance: string;
  weightedActualResistance: string;
  weightedUValue: string;
  status: string;
}

export interface EnvelopeAppendixRow {
  key: string;
  designation: string;
  name: string;
  typeLabel: string;
  area: string;
  actualResistance: string;
  requiredResistance: string;
  status: string;
  modelId: string;
  note: string;
}

export interface ProjectOvTsData {
  meta: ReportBaseData["meta"];
  expertise: ReportBaseData["expertise"];
  preflight: ReportBaseData["preflight"];
  sectionTitle: string;
  subsectionTitle: string;
  toc: Array<{ id: string; label: string }>;
  generalProvisions: string[];
  sourceDataRows: MetricRow[];
  climateRows: MetricRow[];
  objectSummaryRows: MetricRow[];
  heatingVentSummaryRows: MetricRow[];
  thermalLoadRows: MetricRow[];
  envelopeGroupRows: EnvelopeGroupRow[];
  energyRows: MetricRow[];
  conclusions: string[];
  missingData: string[];
  appendixEnvelopeRows: EnvelopeAppendixRow[];
  appendixDetailedRows: MetricRow[];
  rcDynamicRows: MetricRow[];
  rcDynamicAvailable: boolean;
}

export function buildProjectOvTsData(base: ReportBaseData): ProjectOvTsData {
  const { passport, sp50Report, meta } = base;
  const { expertise, envelopeView, reportMetrics, preflight } = base;
  const energy = sp50Report?.energy ?? null;
  const dynamics = passport.thermalResults;
  const dynamicState = base.source.dynamicResultState;

  const sourceDataRows: MetricRow[] = [
    metric("object", "Объект", "", expertise.fieldMap.projectName.value),
    metric("documentCode", "Шифр проектной документации", "", expertise.fieldMap.projectCipher.value),
    metric("address", "Адрес объекта", "", expertise.fieldMap.objectAddress.value),
    metric("customer", "Заказчик", "", expertise.fieldMap.customerOrg.value),
    metric("developer", "Разработчик", "", expertise.fieldMap.developerOrg.value),
    metric("generatedAt", "Дата выгрузки документа", "", meta.generatedAtLabel),
  ];

  const climateRows: MetricRow[] = [
    metric("city", "Город / климатическая база", "", reportMetrics.climateCity ?? REPORT_EXPORT_NO_DATA),
    metric("outdoorDesign", "Расчётная наружная температура для проектирования отопления", "°C", formatValue(reportMetrics.outdoorDesignTemperatureC, 1)),
    metric("outdoorHeatingAverage", "Средняя температура наружного воздуха отопительного периода", "°C", formatValue(reportMetrics.outdoorHeatingAverageC, 1)),
    metric("heatingDays", "Продолжительность отопительного периода", "сут.", formatValue(reportMetrics.heatingDurationDays, 0)),
    metric("gsop", "Градусо-сутки отопительного периода (ГСОП)", "°C·сут.", formatValue(reportMetrics.gsop, 0)),
    metric("indoor", "Расчётная внутренняя температура", "°C", formatValue(reportMetrics.indoorDesignTemperatureC, 1)),
    metric("humidity", "Относительная влажность внутреннего воздуха", "%", formatValue(reportMetrics.indoorRelativeHumidityPercent, 0)),
    metric("humidityZone", "Зона влажности района строительства", "", reportMetrics.humidityZone ?? REPORT_EXPORT_NO_DATA),
  ];

  const objectSummaryRows: MetricRow[] = [
    metric("purpose", "Назначение здания", "", expertise.fieldMap.buildingPurpose.value),
    metric("storeys", "Этажность", "эт.", expertise.fieldMap.floorsCount.value),
    metric("levels", "Количество уровней", "шт.", formatValue(reportMetrics.levelCount, 0)),
    metric("rooms", "Количество помещений", "шт.", formatValue(reportMetrics.roomCount, 0)),
    metric("area", "Отапливаемая площадь", "м²", formatValue(reportMetrics.heatedAreaM2, 2)),
    metric("volume", "Отапливаемый объём", "м³", formatValue(reportMetrics.heatedVolumeM3, 2)),
    metric("envelopeCount", "Количество элементов наружной тепловой оболочки", "шт.", formatValue(envelopeView.includedElements.length, 0)),
    metric("compactness", "Показатель компактности", "1/м", formatValue(sp50Report?.building.compactness_1_m ?? null, 3)),
  ];

  const heatingVentSummaryRows: MetricRow[] = [
    metric("ventilationACH", "Расчётная кратность вентиляции", "1/ч", formatValue(reportMetrics.ventilationAch, 3), expertise.fieldMap.ventilationAch.sourceLabel),
    metric("infiltrationACH", "Расчётная кратность инфильтрации", "1/ч", formatValue(reportMetrics.infiltrationAch, 3), expertise.fieldMap.infiltrationAch.sourceLabel),
    metric("heatRecovery", "Коэффициент рекуперации", "доля", formatValue(reportMetrics.heatRecoveryFactor, 2), expertise.fieldMap.heatRecoveryEfficiencyPercent.sourceLabel),
    metric("mechVent", "Механическая вентиляция", "", reportMetrics.mechanicalVentilation === null ? REPORT_EXPORT_NO_DATA : reportMetrics.mechanicalVentilation ? "да" : "нет"),
    metric("daySetpoint", "Дневная уставка температуры", "°C", expertise.fieldMap.daySetpointC.value),
    metric("nightSetpoint", "Ночная уставка температуры", "°C", expertise.fieldMap.nightSetpointC.value),
  ];

  const thermalLoadRows: MetricRow[] = [
    metric("peakLoad", "Расчётная пиковая тепловая нагрузка", "кВт", formatDynamicMetricValue(reportMetrics.peakHeatLoadKW, dynamicState, { digits: 2 })),
    metric("specificPeak", "Удельная пиковая нагрузка", "Вт/м²", formatDynamicMetricValue(reportMetrics.specificPeakLoad_W_m2, dynamicState, { digits: 1 })),
    metric("totalEnergy", "Тепловая энергия за расчётный период", "кВт·ч", formatDynamicMetricValue(reportMetrics.totalHeatEnergyKWh, dynamicState, { digits: 1 })),
    metric("specificEnergy", "Удельная тепловая энергия за расчётный период", "кВт·ч/м²", formatDynamicMetricValue(reportMetrics.specificEnergyKWh_m2, dynamicState, { digits: 2 })),
    metric("annualHeating", "Годовой расход тепловой энергии", "кВт·ч", formatValue(reportMetrics.annualHeatingEnergy_kWh, 1)),
    metric("annualLosses", "Годовые теплопотери оболочки", "кВт·ч", formatValue(reportMetrics.annualEnvelopeLosses_kWh, 1)),
  ];

  const envelopeGroupRows: EnvelopeGroupRow[] = envelopeView.groupedElements.map((entry) => ({
    key: entry.key,
    typeLabel: entry.typeLabel,
    count: formatValue(entry.count, 0),
    area: formatValue(entry.areaM2, 2),
    weightedRequiredResistance: formatValue(entry.weightedRequiredResistance, 2),
    weightedActualResistance: formatValue(entry.weightedActualResistance, 2),
    weightedUValue: formatValue(entry.weightedUValue, 3),
    status: entry.status,
  }));

  const energyRows: MetricRow[] = [
    metric("kob", "Удельная теплозащитная характеристика kоб", "Вт/(м³·К)", formatValue(reportMetrics.kobActual_W_m3K, 3)),
    metric("kobNorm", "Нормативное значение kоб", "Вт/(м³·К)", formatValue(reportMetrics.kobNorm_W_m3K, 3)),
    metric("kobStatus", "Статус проверки kоб", "", reportMetrics.kobStatus),
    metric("qHeatingCharacteristic", "Удельная характеристика расхода тепловой энергии qот", "Вт/(м³·К)", formatValue(reportMetrics.qHeatingCharacteristic_W_m3K, 3)),
    metric("qByArea", "Удельный годовой расход по площади", "кВт·ч/м²", formatValue(reportMetrics.qByArea_kWh_m2, 2)),
    metric("qByVolume", "Удельный годовой расход по объёму", "кВт·ч/м³", formatValue(reportMetrics.qByVolume_kWh_m3, 3)),
  ];

  const missingData = uniqueHumanMessages(base.source.model, [
    ...expertise.clarificationLines,
    ...preflight.blockingIssues.map((issue) => issue.message),
    ...buildDoorClarificationLines(envelopeView.includedElements),
    ...(passport.warnings ?? []),
    ...(sp50Report?.missingData ?? []),
    ...(energy?.placeholderWarnings ?? []),
    ...envelopeView.warnings,
  ]);

  const appendixDetailedRows: MetricRow[] = [
    ...sourceDataRows,
    ...climateRows,
    ...objectSummaryRows,
    ...heatingVentSummaryRows,
    ...thermalLoadRows,
    ...energyRows,
  ];

  return {
    meta,
    expertise,
    preflight,
    sectionTitle:
      "Раздел 5. Сведения об инженерном оборудовании, сетях и системах инженерно-технического обеспечения",
    subsectionTitle: "Отопление, вентиляция и кондиционирование воздуха, тепловые сети",
    toc: [
      { id: "ovts-1", label: "1 Общие сведения" },
      { id: "ovts-2", label: "2 Основание для проектирования" },
      { id: "ovts-3", label: "3 Исходные климатические данные" },
      { id: "ovts-4", label: "4 Характеристика объекта" },
      { id: "ovts-5", label: "5 Проектные решения по отоплению и вентиляции" },
      { id: "ovts-6", label: "6 Расчётные тепловые нагрузки" },
      { id: "ovts-7", label: "7 Теплотехнические характеристики оболочки" },
      { id: "ovts-8", label: "8 Энергетические показатели" },
      { id: "ovts-9", label: "9 Вывод" },
      { id: "ovts-10", label: "10 Перечень данных, требующих уточнения" },
      { id: "ovts-app-a", label: "Приложение А. Ведомость ограждающих конструкций" },
      { id: "ovts-app-b", label: "Приложение Б. Подробные расчётные таблицы" },
      { id: "ovts-app-v", label: "Приложение В. Справочная динамическая RC-оценка" },
    ],
    generalProvisions: [
      "Документ сформирован как текстовая часть проектной документации по разделу 5 ОВ/ТС и содержит расчётно-пояснительные материалы по тепловой защите здания и инженерным нагрузкам.",
      "Расчётные теплотехнические показатели приняты по данным цифровой модели здания, расчёта по СП 50.13330 и действующего расчётного сценария.",
      "Нормативные выводы по оболочке и энергетическим показателям представлены по единому набору проектных метрик без локальных пересчётов в шаблонах документа.",
    ],
    sourceDataRows,
    climateRows,
    objectSummaryRows,
    heatingVentSummaryRows,
    thermalLoadRows,
    envelopeGroupRows,
    energyRows,
    conclusions: buildConclusions(base),
    missingData,
    appendixEnvelopeRows: envelopeView.appendixElements.map((entry) =>
      mapEnvelopeAppendixRow(entry, expertise.showTechnicalIdsInAppendix)
    ),
    appendixDetailedRows,
    rcDynamicRows: buildRcDynamicRows(base),
    rcDynamicAvailable: dynamics.available,
  };
}

function buildRcDynamicRows(base: ReportBaseData): MetricRow[] {
  const dynamics = base.passport.thermalResults;
  const dynamicState = base.source.dynamicResultState;
  return [
    metric("rcPeakLoad", "Расчётная пиковая нагрузка (RC)", "кВт", formatDynamicMetricValue(dynamics.peakLoadKW, dynamicState, { digits: 2 })),
    metric("rcSpecificPeak", "Удельная пиковая нагрузка (RC)", "Вт/м²", formatDynamicMetricValue(dynamics.specificPeakLoad_W_m2, dynamicState, { digits: 1 })),
    metric("rcEnergy", "Расчётная энергия за период (RC)", "кВт·ч", formatDynamicMetricValue(dynamics.totalEnergyKWh, dynamicState, { digits: 1 })),
    metric("rcSpecificEnergy", "Удельная энергия за период (RC)", "кВт·ч/м²", formatDynamicMetricValue(dynamics.specificEnergyKWh_m2, dynamicState, { digits: 2 })),
    metric("rcAvgT", "Средняя температура помещений", "°C", formatDynamicMetricValue(dynamics.averageRoomTemperatureC, dynamicState, { digits: 1 })),
    metric("rcDiscomfort", "Часы дискомфорта", "ч", formatDynamicMetricValue(dynamics.discomfortHours, dynamicState, { digits: 1 })),
  ];
}

function buildConclusions(base: ReportBaseData): string[] {
  const metrics = base.reportMetrics;
  const lines: string[] = [];

  const integralPass =
    metrics.kobStatus === "соответствует" && metrics.qHeatingStatus === "соответствует";

  if (integralPass && metrics.envelopeElementFailures.length > 0) {
    lines.push(
      `Соответствует по интегральным показателям. Требуется устранить несоответствие поэлементной проверки: ${metrics.envelopeElementFailures
        .map((entry) => `${entry.designation} (${entry.typeLabel})`)
        .join(", ")}.`
    );
  } else if (metrics.kobStatus === "соответствует" && metrics.qHeatingStatus === "соответствует") {
    lines.push("Интегральные показатели тепловой защиты и энергетической эффективности соответствуют расчётным нормативным требованиям.");
  } else if (metrics.kobStatus === "не соответствует" || metrics.qHeatingStatus === "не соответствует") {
    lines.push("Требуется корректировка проектных решений по оболочке и/или инженерным параметрам для достижения нормативных интегральных показателей.");
  } else {
    lines.push("Окончательный нормативный вывод не может быть представлен без устранения замечаний по исходным данным и поэлементной проверке.");
  }

  if (metrics.usesPlaceholderInputs) {
    lines.push("Энергетические показатели сформированы с учётом placeholder-данных и подлежат уточнению после задания проектных параметров вентиляции и инфильтрации.");
  }

  if (base.preflight.status === "not-ready") {
    lines.push("Финальный выпуск комплекта заблокирован до устранения критических замечаний preflight-проверки.");
  } else if (base.preflight.status === "ready") {
    lines.push("Комплект может быть выпущен как итоговый расчётно-пояснительный материал после печатной проверки оформления.");
  } else {
    lines.push("Документ сформирован как черновой / проверочный экземпляр и должен использоваться только после проверки полноты исходных данных.");
  }

  return lines;
}

function mapEnvelopeAppendixRow(
  entry: ExportEnvelopeElement,
  showTechnicalIdsInAppendix: boolean
): EnvelopeAppendixRow {
  return {
    key: entry.key,
    designation: entry.designation,
    name: entry.name,
    typeLabel: entry.typeLabel,
    area: formatValue(entry.areaM2, 2),
    actualResistance: formatValue(entry.actualResistance, 2),
    requiredResistance: formatRequiredResistance(entry),
    status: entry.status,
    modelId: showTechnicalIdsInAppendix ? entry.modelId : "—",
    note: entry.classificationNote,
  };
}

function formatRequiredResistance(entry: ExportEnvelopeElement): string {
  if (entry.category === "external-door" && entry.normalizedResistance === null) {
    return "требуется задание нормативного значения";
  }
  return formatValue(entry.normalizedResistance, 2);
}

function formatValue(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return REPORT_EXPORT_NO_DATA;
  }
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function metric(key: string, label: string, unit: string, value: string, note?: string): MetricRow {
  return { key, label, unit, value, note };
}

function buildDoorClarificationLines(
  elements: Array<{
    category: string;
    designation: string;
    name: string;
    includeInEnvelope: boolean;
    normalizedResistance: number | null;
  }>
): string[] {
  return elements
    .filter(
      (entry) =>
        entry.category === "external-door" &&
        entry.includeInEnvelope &&
        entry.normalizedResistance === null
    )
    .map(
      (entry) =>
        `Для наружной двери ${entry.designation || entry.name} требуется задать нормативное сопротивление теплопередаче или подтвердить проектное значение.`
    );
}

function uniqueHumanMessages(
  model: ReportBaseData["source"]["model"],
  values: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) {
      continue;
    }
    const cleaned = humanizeMessage(value, model);
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function humanizeMessage(
  message: string,
  model: ReportBaseData["source"]["model"]
): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("monte carlo")) {
    return "";
  }
  return humanizeProjectText(message, model);
}
