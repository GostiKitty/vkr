import type { ReportBaseData } from "./buildReportBaseData";
import {
  buildExportEnvelopeView,
  type ExportEnvelopeElement,
} from "./buildExportEnvelopeView";
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
  requiredResistance: string;
  uValue: string;
  status: string;
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

export interface ThermalProtectionAppendixEnvelopeRow {
  key: string;
  designation: string;
  name: string;
  typeLabel: string;
  area: string;
  actualResistance: string;
  requiredResistance: string;
  status: string;
  internalSurfaceTemperature: string;
  modelId: string;
  note: string;
}

export interface ThermalProtectionData {
  meta: ReportBaseData["meta"];
  expertise: ReportBaseData["expertise"];
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
  const { passport, sp50Report, meta, expertise } = base;
  const climate = passport.climate;
  const summary = passport.summary;
  const sp50Source = sp50Report?.sourceData;
  const sp50Energy = sp50Report?.energy ?? null;
  const envelopeView = buildExportEnvelopeView({
    model: base.source.model,
    constructions: sp50Report?.constructions ?? [],
    heatedVolumeM3: summary.totalVolumeM3,
    kobNorm: sp50Report?.building.kobNorm_W_m3K ?? null,
    outdoorDesignTemperatureC: climate.outdoorDesignTemperatureC,
  });

  const climateRows: ThermalProtectionMetricRow[] = [
    metric("city", "Город / климатическая база", "", expertise.fieldMap.climateCity.value),
    metric("outdoorDesign", "Расчётная наружная температура", "°C", formatValue(climate.outdoorDesignTemperatureC, 1)),
    metric(
      "outdoorAverage",
      "Средняя температура отопительного периода",
      "°C",
      expertise.fieldMap.outdoorHeatingAverageC.value
    ),
    metric(
      "heatingDays",
      "Длительность отопительного периода",
      "сут.",
      expertise.fieldMap.heatingDurationDays.value
    ),
    metric("gsop", "ГСОП", "°C·сут.", expertise.fieldMap.gsop.value),
    metric("indoor", "Внутренняя температура", "°C", expertise.fieldMap.indoorDesignTemperatureC.value),
    metric(
      "indoorHumidity",
      "Относительная влажность внутреннего воздуха",
      "%",
      expertise.fieldMap.indoorRelativeHumidityPercent.value
    ),
    metric("humidityZone", "Зона влажности района строительства", "", expertise.fieldMap.humidityZone.value),
  ];

  climateRows[1].value = expertise.fieldMap.outdoorDesignTemperatureC.value;

  const geometryRows: ThermalProtectionMetricRow[] = [
    metric("storeys", "Этажность", "эт.", expertise.fieldMap.floorsCount.value),
    metric("area", "Отапливаемая площадь Aот", "м²", expertise.fieldMap.heatedArea.value),
    metric("volume", "Отапливаемый объём Vот", "м³", expertise.fieldMap.heatedVolume.value),
    metric(
      "envelopeCount",
      "Количество элементов наружной тепловой оболочки",
      "шт.",
      formatValue(envelopeView.includedElements.length, 0)
    ),
  ];

  const envelopeCompositionRows = buildCompositionSummary(envelopeView.includedElements);
  const totalEnvelopeArea = envelopeView.includedElements.reduce(
    (sum, element) => sum + (element.areaM2 ?? 0),
    0
  );

  const envelopeResistanceRows = envelopeView.includedElements.map((entry) => ({
    key: entry.key,
    designation: entry.designation,
    name: entry.name,
    typeLabel: entry.typeLabel,
    area: formatValue(entry.areaM2, 2),
    actualResistance: formatValue(entry.actualResistance, 2),
    requiredResistance: formatRequiredResistance(entry),
    uValue: formatValue(entry.uValue, 3),
    status: entry.status,
  }));

  const kobFragmentRows = buildKobFragmentRows(envelopeView.includedElements, totalEnvelopeArea);
  const kobSummary = {
    kobActual: formatValue(envelopeView.kobActual, 3),
    kobNorm: formatValue(envelopeView.kobNorm, 3),
    status: envelopeView.kobStatus,
  };

  const energyCharacteristicRows: ThermalProtectionMetricRow[] = [
    metric(
      "qHeating",
      "Удельная характеристика расхода тепловой энергии qот",
      "Вт/(м³·К)",
      formatValue(sp50Energy?.qHeatingCharacteristic_W_m3K, 3)
    ),
    metric(
      "qNorm",
      "Нормативное значение qот",
      "кВт·ч/м²",
      formatValue(sp50Energy?.qHeatingNorm_kWh_m2, 2)
    ),
    metric(
      "annualHeating",
      "Годовой расход тепловой энергии на отопление",
      "кВт·ч",
      formatValue(sp50Energy?.annualHeatingEnergy_kWh, 1)
    ),
    metric(
      "annualLosses",
      "Годовые теплопотери оболочки",
      "кВт·ч",
      formatValue(sp50Energy?.annualTotalLosses_kWh, 1)
    ),
    metric("qByArea", "Удельный расход по площади", "кВт·ч/м²", formatValue(sp50Energy?.qByArea_kWh_m2, 2)),
    metric("qByVolume", "Удельный расход по объёму", "кВт·ч/м³", formatValue(sp50Energy?.qByVolume_kWh_m3, 3)),
  ];

  const complianceRows: ThermalProtectionMetricRow[] = [
    metric("kobStatus", "Удельная теплозащитная характеристика kоб", "", kobSummary.status),
    metric(
      "energyStatus",
      "Удельный расход тепловой энергии qот",
      "",
      mapEnergyStatus(sp50Energy?.status, sp50Energy?.complies)
    ),
    metric(
      "constructionsStatus",
      "Конструкции по сопротивлению теплопередаче",
      "",
      summarizeConstructionsStatus(envelopeView.includedElements)
    ),
  ];

  return {
    meta,
    expertise,
    toc: [
      { id: "tp-registry", label: "Ведомость исходных данных" },
      { id: "tp-1", label: "1 Исходные климатические данные" },
      { id: "tp-2", label: "2 Геометрические показатели здания" },
      { id: "tp-3", label: "3 Состав наружных ограждающих конструкций" },
      { id: "tp-4", label: "4 Расчёт сопротивления теплопередаче" },
      { id: "tp-5", label: "5 Проверка приведённого сопротивления теплопередаче" },
      { id: "tp-6", label: "6 Расчёт удельной теплозащитной характеристики kоб" },
      { id: "tp-7", label: "7 Расчёт энергетической характеристики qот" },
      { id: "tp-8", label: "8 Проверка соответствия требованиям" },
      { id: "tp-9", label: "9 Выводы" },
      { id: "tp-10", label: "10 Перечень данных, требующих уточнения" },
      { id: "tp-app-a", label: "Приложение А. Послойный состав конструкций" },
      { id: "tp-app-b", label: "Приложение Б. Ведомость элементов оболочки" },
      { id: "tp-app-v", label: "Приложение В. Расчётные фрагменты оболочки здания" },
    ],
    climateRows,
    geometryRows,
    envelopeCompositionRows,
    envelopeResistanceRows,
    kobFragmentRows,
    kobSummary,
    energyCharacteristicRows,
    complianceRows,
    conclusions: buildConclusions(base, kobSummary.status),
    appendixComposition: buildCompositionAppendix(
      sp50Report?.constructions ?? [],
      envelopeView.includedElements,
      expertise.showTechnicalIdsInAppendix
    ),
    appendixEnvelopeRows: envelopeView.appendixElements.map((entry) => ({
      key: entry.key,
      designation: entry.designation,
      name: entry.name,
      typeLabel: entry.typeLabel,
      area: formatValue(entry.areaM2, 2),
      actualResistance: formatValue(entry.actualResistance, 2),
      requiredResistance: formatRequiredResistance(entry),
      status: entry.status,
      internalSurfaceTemperature: entry.internalSurfaceTemperature,
      modelId: expertise.showTechnicalIdsInAppendix ? entry.modelId : "—",
      note: entry.classificationNote,
    })),
    appendixFragments: kobFragmentRows,
    notesMissingData: uniqueMessages(base.source.model, [
      ...expertise.clarificationLines,
      ...buildDoorClarificationLines(envelopeView.includedElements),
      ...(sp50Report?.missingData ?? []),
      ...(sp50Energy?.placeholderWarnings ?? []),
      ...envelopeView.warnings,
    ]),
  };
}

function buildCompositionSummary(elements: ExportEnvelopeElement[]): ThermalProtectionMetricRow[] {
  if (!elements.length) {
    return [
      metric(
        "composition",
        "Состав наружных ограждающих конструкций",
        "",
        REPORT_EXPORT_NO_DATA
      ),
    ];
  }
  const grouped = new Map<string, { label: string; count: number; area: number }>();
  for (const element of elements) {
    const entry = grouped.get(element.typeLabel) ?? {
      label: element.typeLabel,
      count: 0,
      area: 0,
    };
    entry.count += 1;
    entry.area += element.areaM2 ?? 0;
    grouped.set(element.typeLabel, entry);
  }
  return Array.from(grouped.values()).map((entry, index) => ({
    key: `comp-${index}`,
    label: entry.label,
    unit: "шт. / м²",
    value: `${entry.count} / ${formatValue(entry.area, 2)}`,
  }));
}

function buildCompositionAppendix(
  constructions: NonNullable<ReportBaseData["sp50Report"]>["constructions"],
  includedElements: ExportEnvelopeElement[],
  showTechnicalIdsInAppendix: boolean
): ThermalProtectionAppendixLayerRow[] {
  const designationById = new Map(includedElements.map((entry) => [entry.key, entry]));
  const rows: ThermalProtectionAppendixLayerRow[] = [];
  constructions.forEach((construction) => {
    const exportEntry = designationById.get(construction.id);
    if (!exportEntry) {
      return;
    }
    if (!construction.layers.length) {
      rows.push({
        key: `${construction.id}-no-layers`,
        designation: exportEntry.designation,
        constructionLabel: exportEntry.name,
        layerLabel: REPORT_EXPORT_NO_DATA,
        thicknessMm: REPORT_EXPORT_NO_DATA,
        conductivity: REPORT_EXPORT_NO_DATA,
        resistance: formatValue(construction.actualResistance_m2K_W, 2),
        modelId: showTechnicalIdsInAppendix ? exportEntry.modelId : "—",
      });
      return;
    }
    construction.layers.forEach((layer, index) => {
      rows.push({
        key: `${construction.id}-${index}`,
        designation: exportEntry.designation,
        constructionLabel: exportEntry.name,
        layerLabel: layer.materialLabel,
        thicknessMm:
          Number.isFinite(layer.thicknessM) && layer.thicknessM > 0
            ? formatValue(layer.thicknessM * 1000, 1)
            : REPORT_EXPORT_NO_DATA,
        conductivity: formatValue(layer.conductivity_W_mK, 3),
        resistance: formatValue(layer.resistance_m2K_W, 3),
        modelId: showTechnicalIdsInAppendix ? exportEntry.modelId : "—",
      });
    });
  });
  return rows;
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

function buildConclusions(base: ReportBaseData, kobStatus: string): string[] {
  const lines: string[] = [];
  const energy = base.sp50Report?.energy ?? null;
  const dynamics = base.passport.thermalResults;
  const dynamicComfort =
    dynamics.available &&
    dynamics.averageRoomTemperatureC !== null &&
    dynamics.averageRoomTemperatureC >= 20 &&
    dynamics.averageRoomTemperatureC <= 24;

  if (dynamicComfort && kobStatus === "не соответствует") {
    lines.push(
      "По результатам динамической RC-оценки температура воздуха в расчётном сценарии находится в комфортном диапазоне. При этом нормативная проверка теплозащиты выявила несоответствие отдельных ограждающих конструкций требованиям по сопротивлению теплопередаче."
    );
  } else if (kobStatus === "соответствует") {
    lines.push(
      "Удельная теплозащитная характеристика kоб не превышает нормативное значение."
    );
  } else if (kobStatus === "не соответствует") {
    lines.push(
      "Удельная теплозащитная характеристика kоб превышает нормативное значение; требуется усиление теплозащиты отдельных ограждающих конструкций."
    );
  } else {
    lines.push(
      "Сводная проверка kоб не завершена из-за неполноты исходных данных либо неоднозначной классификации части элементов."
    );
  }

  if (energy?.status === "pass") {
    lines.push(
      "Удельный расход тепловой энергии на отопление и вентиляцию находится в пределах нормативных требований."
    );
  } else if (energy?.status === "fail" || energy?.complies === false) {
    lines.push(
      "Удельный расход тепловой энергии требует оптимизации проектных решений."
    );
  } else {
    lines.push(
      "Часть исходных данных по вентиляции и инфильтрации не задана. Энергетические показатели требуют уточнения после ввода проектных параметров воздухообмена."
    );
  }

  lines.push(
    "Расчёт выполнен средствами расчётного модуля программного комплекса и используется в качестве расчётно-пояснительного материала."
  );
  return lines;
}

function mapEnergyStatus(
  status: "pass" | "fail" | "insufficient_data" | null | undefined,
  complies: boolean | null | undefined
): string {
  if (complies === true || status === "pass") {
    return "соответствует";
  }
  if (complies === false || status === "fail") {
    return "не соответствует";
  }
  if (status === "insufficient_data") {
    return REPORT_EXPORT_NO_DATA;
  }
  return REPORT_EXPORT_NEEDS_CLARIFICATION;
}

function summarizeConstructionsStatus(elements: ExportEnvelopeElement[]): string {
  if (!elements.length) {
    return REPORT_EXPORT_NO_DATA;
  }
  const failed = elements.filter((entry) => entry.status === "не соответствует").length;
  const unclear = elements.filter((entry) => entry.status === "требует проверки классификации").length;
  const needsClarification = elements.filter((entry) => entry.status === "требует уточнения").length;
  if (failed > 0) {
    return `несоответствие выявлено по ${failed} элементам`;
  }
  if (needsClarification > 0) {
    return `${needsClarification} элементов требуют уточнения`;
  }
  if (unclear > 0) {
    return `${unclear} элементов требуют проверки классификации`;
  }
  return "соответствуют";
}

function formatRequiredResistance(entry: ExportEnvelopeElement): string {
  if (entry.category === "external-door" && entry.normalizedResistance === null) {
    return "требуется задание нормативного значения";
  }
  return formatValue(entry.normalizedResistance, 2);
}

function buildDoorClarificationLines(elements: ExportEnvelopeElement[]): string[] {
  return elements
    .filter(
      (entry) =>
        entry.category === "external-door" &&
        entry.includeInEnvelope &&
        entry.normalizedResistance === null
    )
    .map(
      (entry) =>
        `Для наружной двери ${entry.designation || entry.name} требуется задание нормативного сопротивления теплопередаче или подтверждение принятого значения.`
    );
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

function metric(key: string, label: string, unit: string, value: string): ThermalProtectionMetricRow {
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
  if (
    normalized.includes("lvent") ||
    normalized.includes("nvent") ||
    normalized.includes("ventilationach")
  ) {
    return "Часть исходных данных по вентиляции не задана. Энергетические показатели требуют уточнения после ввода проектных параметров воздухообмена.";
  }
  if (
    normalized.includes("ginf") ||
    normalized.includes("ninf") ||
    normalized.includes("infiltrationach")
  ) {
    return "Не заданы или не проверены данные по инфильтрации. Энергетические показатели требуют уточнения.";
  }
  if (normalized.includes("beta")) {
    return "Не задан коэффициент использования теплопоступлений. Энергетические показатели требуют уточнения.";
  }
  if (
    normalized.includes("межэтаж") &&
    (normalized.includes("перекрыт") || normalized.includes("плита"))
  ) {
    return "Межэтажное перекрытие не включено в наружную тепловую оболочку, так как относится к внутренним конструкциям.";
  }
  if (/^перекрытие\s+межэтажное\s+перекрытие/i.test(message.trim())) {
    return "Межэтажное перекрытие не включено в наружную тепловую оболочку, так как относится к внутренним конструкциям.";
  }
  return humanizeProjectText(message, model);
}
