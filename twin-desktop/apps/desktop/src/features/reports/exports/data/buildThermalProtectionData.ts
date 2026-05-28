import type { ReportBaseData } from "./buildReportBaseData";
import type { ExportEnvelopeElement } from "./buildExportEnvelopeView";
import { humanizeProjectText } from "./exportText";
import {
  REPORT_EXPORT_NEEDS_CLARIFICATION,
  REPORT_EXPORT_NO_DATA,
} from "../helpers";

export interface ThermalProtectionMetricRow {
  key: string;
  label: string;
  unit: string;
  value: string;
}

export interface ThermalProtectionResistanceRow {
  key: string;
  designation: string;
  name: string;
  typeLabel: string;
  area: string;
  actualResistance: string;
  reducedResistance: string;
  requiredResistance: string;
  uValue: string;
  nt: string;
  status: string;
  requiredResistanceBasis: string;
  sourceData: string;
}

export interface ThermalProtectionFragmentRow {
  key: string;
  designation: string;
  fragment: string;
  nt: string;
  area: string;
  reducedResistance: string;
  contribution: string;
  share: string;
}

export interface ThermalProtectionAppendixLayerRow {
  key: string;
  designation: string;
  constructionLabel: string;
  layerLabel: string;
  thicknessMm: string;
  conductivity: string;
  resistance: string;
  modelId: string;
}

export interface ThermalProtectionAppendixEnvelopeRow
  extends ThermalProtectionResistanceRow {
  internalSurfaceTemperature: string;
  modelId: string;
  note: string;
}

export interface ThermalProtectionData {
  meta: ReportBaseData["meta"];
  expertise: ReportBaseData["expertise"];
  preflight: ReportBaseData["preflight"];
  toc: Array<{ id: string; label: string }>;
  climateRows: ThermalProtectionMetricRow[];
  geometryRows: ThermalProtectionMetricRow[];
  envelopeCompositionRows: ThermalProtectionMetricRow[];
  envelopeResistanceRows: ThermalProtectionResistanceRow[];
  kobFragmentRows: ThermalProtectionFragmentRow[];
  kobSummary: {
    kobActual: string;
    kobNorm: string;
    status: string;
  };
  energyCharacteristicRows: ThermalProtectionMetricRow[];
  complianceRows: ThermalProtectionMetricRow[];
  conclusions: string[];
  appendixComposition: ThermalProtectionAppendixLayerRow[];
  appendixEnvelopeRows: ThermalProtectionAppendixEnvelopeRow[];
  appendixFragments: ThermalProtectionFragmentRow[];
  notesMissingData: string[];
}

export function buildThermalProtectionData(base: ReportBaseData): ThermalProtectionData {
  const { meta, expertise, preflight, reportMetrics, envelopeView, sp50Report } = base;
  const totalEnvelopeArea = envelopeView.includedElements.reduce(
    (sum, element) => sum + (element.areaM2 ?? 0),
    0
  );

  const climateRows: ThermalProtectionMetricRow[] = [
    metric("city", "Город / климатическая база", "", reportMetrics.climateCity ?? REPORT_EXPORT_NO_DATA),
    metric("outdoorDesign", "Расчётная наружная температура", "°C", formatValue(reportMetrics.outdoorDesignTemperatureC, 1)),
    metric("outdoorAverage", "Средняя температура отопительного периода", "°C", formatValue(reportMetrics.outdoorHeatingAverageC, 1)),
    metric("heatingDays", "Продолжительность отопительного периода", "сут.", formatValue(reportMetrics.heatingDurationDays, 0)),
    metric("gsop", "ГСОП", "°C·сут.", formatValue(reportMetrics.gsop, 0)),
    metric("indoor", "Внутренняя расчётная температура", "°C", formatValue(reportMetrics.indoorDesignTemperatureC, 1)),
    metric("humidity", "Относительная влажность внутреннего воздуха", "%", formatValue(reportMetrics.indoorRelativeHumidityPercent, 0)),
    metric("humidityZone", "Зона влажности района строительства", "", reportMetrics.humidityZone ?? REPORT_EXPORT_NO_DATA),
    metric("operationCondition", "Условия эксплуатации по СП 50", "", expertise.fieldMap.operationCondition.value),
  ];

  const geometryRows: ThermalProtectionMetricRow[] = [
    metric("storeys", "Этажность", "эт.", expertise.fieldMap.floorsCount.value),
    metric("levels", "Количество уровней", "шт.", formatValue(reportMetrics.levelCount, 0)),
    metric("rooms", "Количество помещений", "шт.", formatValue(reportMetrics.roomCount, 0)),
    metric("area", "Отапливаемая площадь Aот", "м²", formatValue(reportMetrics.heatedAreaM2, 2)),
    metric("volume", "Отапливаемый объём Vот", "м³", formatValue(reportMetrics.heatedVolumeM3, 2)),
    metric("envelopeCount", "Количество элементов наружной оболочки", "шт.", formatValue(envelopeView.includedElements.length, 0)),
  ];

  const envelopeCompositionRows = buildCompositionSummary(envelopeView.includedElements);
  const envelopeResistanceRows = envelopeView.includedElements.map((entry) =>
    mapResistanceRow(entry)
  );
  const kobFragmentRows = buildKobFragmentRows(envelopeView.includedElements, totalEnvelopeArea);
  const kobSummary = {
    kobActual: formatValue(reportMetrics.kobActual_W_m3K, 3),
    kobNorm: formatValue(reportMetrics.kobNorm_W_m3K, 3),
    status: reportMetrics.kobStatus,
  };

  const energyCharacteristicRows: ThermalProtectionMetricRow[] = [
    metric(
      "qHeating",
      "Удельная характеристика расхода тепловой энергии qот",
      "Вт/(м³·К)",
      formatValue(reportMetrics.qHeatingCharacteristic_W_m3K, 3)
    ),
    metric(
      "qNorm",
      "Нормируемое значение qот",
      "кВт·ч/м²",
      formatValue(reportMetrics.qHeatingNorm_kWh_m2, 2)
    ),
    metric(
      "annualHeating",
      "Годовой расход тепловой энергии",
      "кВт·ч",
      formatValue(reportMetrics.annualHeatingEnergy_kWh, 1)
    ),
    metric(
      "annualLosses",
      "Годовые теплопотери оболочки",
      "кВт·ч",
      formatValue(reportMetrics.annualEnvelopeLosses_kWh, 1)
    ),
    metric(
      "qByArea",
      "Удельный расход по площади",
      "кВт·ч/м²",
      formatValue(reportMetrics.qByArea_kWh_m2, 2)
    ),
    metric(
      "qByVolume",
      "Удельный расход по объёму",
      "кВт·ч/м³",
      formatValue(reportMetrics.qByVolume_kWh_m3, 3)
    ),
  ];

  const complianceRows: ThermalProtectionMetricRow[] = [
    metric("kobStatus", "Проверка удельной теплозащитной характеристики kоб", "", reportMetrics.kobStatus),
    metric("qHeatingStatus", "Проверка удельного расхода тепловой энергии qот", "", reportMetrics.qHeatingStatus),
    metric(
      "elementStatus",
      "Поэлементная проверка оболочки",
      "",
      summarizeEnvelopeStatus(base)
    ),
    metric("releaseStatus", "Статус выпуска комплекта", "", preflight.statusLabel),
  ];

  return {
    meta,
    expertise,
    preflight,
    toc: [
      { id: "tp-registry", label: "Ведомость исходных данных" },
      { id: "tp-1", label: "1 Исходные климатические данные" },
      { id: "tp-2", label: "2 Геометрические показатели здания" },
      { id: "tp-3", label: "3 Состав наружных ограждающих конструкций" },
      { id: "tp-4", label: "4 Проверка сопротивления теплопередаче" },
      { id: "tp-5", label: "5 Проверка приведённого сопротивления теплопередаче" },
      { id: "tp-6", label: "6 Расчёт удельной теплозащитной характеристики kоб" },
      { id: "tp-7", label: "7 Расчёт энергетической характеристики qот" },
      { id: "tp-8", label: "8 Проверка соответствия требованиям" },
      { id: "tp-9", label: "9 Выводы" },
      { id: "tp-10", label: "10 Перечень данных, требующих уточнения" },
      { id: "tp-app-a", label: "Приложение А. Послойный состав конструкций" },
      { id: "tp-app-b", label: "Приложение Б. Ведомость элементов оболочки" },
      { id: "tp-app-v", label: "Приложение В. Расчётные фрагменты оболочки" },
    ],
    climateRows,
    geometryRows,
    envelopeCompositionRows,
    envelopeResistanceRows,
    kobFragmentRows,
    kobSummary,
    energyCharacteristicRows,
    complianceRows,
    conclusions: buildConclusions(base),
    appendixComposition: buildCompositionAppendix(
      sp50Report?.constructions ?? [],
      envelopeView.includedElements,
      expertise.showTechnicalIdsInAppendix
    ),
    appendixEnvelopeRows: envelopeView.appendixElements.map((entry) => ({
      ...mapResistanceRow(entry),
      internalSurfaceTemperature: entry.internalSurfaceTemperature,
      modelId: expertise.showTechnicalIdsInAppendix ? entry.modelId : "—",
      note: entry.classificationNote,
    })),
    appendixFragments: kobFragmentRows,
    notesMissingData: uniqueMessages(base.source.model, [
      ...expertise.clarificationLines,
      ...preflight.issues.map((issue) => issue.message),
      ...(sp50Report?.missingData ?? []),
      ...(sp50Report?.energy?.placeholderWarnings ?? []),
      ...envelopeView.warnings,
    ]),
  };
}

function buildCompositionSummary(elements: ExportEnvelopeElement[]): ThermalProtectionMetricRow[] {
  if (!elements.length) {
    return [metric("composition-empty", "Состав наружной оболочки", "", REPORT_EXPORT_NO_DATA)];
  }
  const groups = new Map<string, { count: number; area: number }>();
  elements.forEach((element) => {
    const group = groups.get(element.typeLabel) ?? { count: 0, area: 0 };
    group.count += 1;
    group.area += element.areaM2 ?? 0;
    groups.set(element.typeLabel, group);
  });
  return Array.from(groups.entries()).map(([label, group], index) =>
    metric(`composition-${index}`, label, "шт. / м²", `${group.count} / ${formatValue(group.area, 2)}`)
  );
}

function buildCompositionAppendix(
  constructions: NonNullable<ReportBaseData["sp50Report"]>["constructions"],
  includedElements: ExportEnvelopeElement[],
  showTechnicalIdsInAppendix: boolean
): ThermalProtectionAppendixLayerRow[] {
  const byId = new Map(includedElements.map((element) => [element.key, element]));
  const rows: ThermalProtectionAppendixLayerRow[] = [];
  constructions.forEach((construction) => {
    const matched = byId.get(construction.id);
    if (!matched) {
      return;
    }
    if (!construction.layers.length) {
      rows.push({
        key: `${construction.id}-no-layers`,
        designation: matched.designation,
        constructionLabel: matched.name,
        layerLabel: REPORT_EXPORT_NO_DATA,
        thicknessMm: REPORT_EXPORT_NO_DATA,
        conductivity: REPORT_EXPORT_NO_DATA,
        resistance: formatValue(construction.actualResistance_m2K_W, 2),
        modelId: showTechnicalIdsInAppendix ? matched.modelId : "—",
      });
      return;
    }
    construction.layers.forEach((layer, index) => {
      rows.push({
        key: `${construction.id}-${index}`,
        designation: matched.designation,
        constructionLabel: matched.name,
        layerLabel: layer.materialLabel,
        thicknessMm:
          Number.isFinite(layer.thicknessM) && layer.thicknessM > 0
            ? formatValue(layer.thicknessM * 1000, 1)
            : REPORT_EXPORT_NO_DATA,
        conductivity: formatValue(layer.conductivity_W_mK, 3),
        resistance: formatValue(layer.resistance_m2K_W, 3),
        modelId: showTechnicalIdsInAppendix ? matched.modelId : "—",
      });
    });
  });
  return rows;
}

function mapResistanceRow(entry: ExportEnvelopeElement): ThermalProtectionResistanceRow {
  return {
    key: entry.key,
    designation: entry.designation,
    name: entry.name,
    typeLabel: entry.typeLabel,
    area: formatValue(entry.areaM2, 2),
    actualResistance: formatValue(entry.actualResistance, 2),
    reducedResistance: formatValue(entry.reducedResistance, 2),
    requiredResistance: formatRequiredResistance(entry),
    uValue: formatValue(entry.uValue, 3),
    nt: formatValue(entry.nt, 2),
    status: entry.status,
    requiredResistanceBasis: buildRequiredResistanceBasis(entry),
    sourceData: buildSourceDataLabel(entry),
  };
}

function buildKobFragmentRows(
  elements: ExportEnvelopeElement[],
  totalEnvelopeArea: number
): ThermalProtectionFragmentRow[] {
  const totalContribution = elements.reduce(
    (sum, element) => sum + (element.contribution ?? 0),
    0
  );
  return elements.map((entry) => ({
    key: entry.key,
    designation: entry.designation,
    fragment: entry.name,
    nt: formatValue(entry.nt, 2),
    area: formatValue(entry.areaM2, 2),
    reducedResistance: formatValue(entry.reducedResistance, 2),
    contribution: formatValue(entry.contribution, 2),
    share:
      totalContribution > 0 && totalEnvelopeArea > 0
        ? formatValue(((entry.contribution ?? 0) / totalContribution) * 100, 1)
        : REPORT_EXPORT_NO_DATA,
  }));
}

function buildConclusions(base: ReportBaseData): string[] {
  const lines: string[] = [];
  const metrics = base.reportMetrics;
  const failedElements = metrics.envelopeElementFailures;
  const integralPass =
    metrics.kobStatus === "соответствует" &&
    metrics.qHeatingStatus === "соответствует";

  if (integralPass && failedElements.length > 0) {
    lines.push(
      `Соответствует по интегральным показателям. Требуется устранить несоответствие поэлементной проверки: ${failedElements
        .map((entry) => `${entry.designation} (${entry.typeLabel})`)
        .join(", ")}.`
    );
  } else if (integralPass) {
    lines.push(
      "Расчётные интегральные показатели тепловой защиты и энергоэффективности соответствуют нормативным требованиям."
    );
  } else if (
    metrics.kobStatus === "не соответствует" ||
    metrics.qHeatingStatus === "не соответствует"
  ) {
    lines.push(
      "Требуется корректировка проектных решений по тепловой оболочке и/или инженерным параметрам для достижения нормативных показателей."
    );
  } else {
    lines.push(
      "Окончательный нормативный вывод не может быть сделан до устранения замечаний по исходным данным и поэлементной проверке."
    );
  }

  if (metrics.usesPlaceholderInputs) {
    lines.push(
      "Энергетические показатели сформированы на неполной исходной базе и подлежат уточнению после задания проектных параметров вентиляции и инфильтрации."
    );
  }

  if (base.preflight.status === "not-ready") {
    lines.push(
      "Финальный статус комплекта: НЕ ГОТОВО К ВЫПУСКУ ДО УСТРАНЕНИЯ ЗАМЕЧАНИЙ."
    );
  } else if (base.preflight.status === "ready") {
    lines.push("Комплект расчётно-пояснительных материалов готов к выпуску.");
  } else {
    lines.push("Документ сформирован как черновой / проверочный экземпляр.");
  }

  return lines;
}

function summarizeEnvelopeStatus(base: ReportBaseData): string {
  const failed = base.reportMetrics.envelopeElementFailures;
  if (failed.length > 0) {
    return `не соответствует: ${failed
      .map((entry) => entry.designation)
      .join(", ")}`;
  }
  if (base.reportMetrics.envelopeElementsNeedingClarification.length > 0) {
    return REPORT_EXPORT_NEEDS_CLARIFICATION;
  }
  return "соответствует";
}

function buildRequiredResistanceBasis(entry: ExportEnvelopeElement): string {
  switch (entry.category) {
    case "external-wall":
    case "roof":
    case "ground-floor":
    case "floor-over-unheated":
      return "СП 50.13330.2024 по ГСОП и типу ограждающей конструкции";
    case "window":
      return "СП 50.13330.2024 для светопрозрачных ограждений";
    case "external-door":
      return entry.normalizedResistance === null
        ? "Нормативное значение для двери не задано в исходных данных"
        : "СП 50.13330.2024 для наружных дверей";
    default:
      return REPORT_EXPORT_NEEDS_CLARIFICATION;
  }
}

function buildSourceDataLabel(entry: ExportEnvelopeElement): string {
  switch (entry.category) {
    case "window":
    case "external-door":
      return "Карточка проёма и параметры теплотехнического элемента";
    case "roof":
    case "ground-floor":
    case "floor-over-unheated":
    case "external-wall":
      return "Цифровая модель и состав ограждающей конструкции";
    default:
      return "Цифровая модель";
  }
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

function metric(
  key: string,
  label: string,
  unit: string,
  value: string
): ThermalProtectionMetricRow {
  return { key, label, unit, value };
}

function uniqueMessages(
  model: ReportBaseData["source"]["model"],
  values: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) {
      continue;
    }
    const cleaned = humanizeProjectText(value, model);
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}
