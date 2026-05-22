/**
 * Данные для выгрузки "Раздел 5. Сведения об инженерном оборудовании,
 * сетях и системах инженерно-технического обеспечения. Подраздел Отопление,
 * вентиляция и кондиционирование воздуха, тепловые сети".
 */

import type { ReportBaseData } from "./buildReportBaseData";
import {
  buildExportEnvelopeView,
  type ExportEnvelopeElement,
} from "./buildExportEnvelopeView";
import { humanizeProjectText } from "./exportText";
import {
  formatDisplayEnum,
  formatDynamicMetricValue,
  REPORT_EXPORT_NEEDS_CLARIFICATION,
  REPORT_EXPORT_NO_DATA,
  REPORT_EXPORT_NOT_SET,
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
  const expertise = base.expertise;
  const climate = passport.climate;
  const operation = passport.operation;
  const summary = passport.summary;
  const sp50Source = sp50Report?.sourceData;
  const sp50Energy = sp50Report?.energy ?? null;
  const dynamics = passport.thermalResults;
  const dynamicState = base.source.dynamicResultState;
  const envelopeView = buildExportEnvelopeView({
    model: base.source.model,
    constructions: sp50Report?.constructions ?? [],
    heatedVolumeM3: summary.totalVolumeM3,
    kobNorm: sp50Report?.building.kobNorm_W_m3K ?? null,
    outdoorDesignTemperatureC: climate.outdoorDesignTemperatureC,
  });

  const sourceDataRows: MetricRow[] = [
    metric("object", "Объект", "", expertise.fieldMap.projectName.value),
    metric("documentCode", "Шифр проектной документации", "", expertise.fieldMap.projectCipher.value),
    metric("address", "Адрес объекта", "", expertise.fieldMap.objectAddress.value),
    metric("customer", "Заказчик", "", expertise.fieldMap.customerOrg.value),
    metric("developer", "Разработчик", "", expertise.fieldMap.developerOrg.value),
    metric("generatedAt", "Дата выгрузки документа", "", meta.generatedAtLabel),
  ];

  const climateRows: MetricRow[] = [
    metric("city", "Город / климатическая база", "", expertise.fieldMap.climateCity.value),
    metric(
      "outdoorDesign",
      "Расчётная наружная температура для проектирования отопления",
      "°C",
      expertise.fieldMap.outdoorDesignTemperatureC.value
    ),
    metric(
      "outdoorHeatingAverage",
      "Средняя температура наружного воздуха отопительного периода",
      "°C",
      expertise.fieldMap.outdoorHeatingAverageC.value
    ),
    metric(
      "heatingDays",
      "Продолжительность отопительного периода",
      "сут.",
      expertise.fieldMap.heatingDurationDays.value
    ),
    metric(
      "gsop",
      "Градусо-сутки отопительного периода (ГСОП)",
      "°C·сут.",
      expertise.fieldMap.gsop.value
    ),
    metric("indoor", "Расчётная внутренняя температура", "°C", expertise.fieldMap.indoorDesignTemperatureC.value),
    metric(
      "humidity",
      "Относительная влажность внутреннего воздуха",
      "%",
      expertise.fieldMap.indoorRelativeHumidityPercent.value
    ),
    metric(
      "humidityZone",
      "Зона влажности района строительства",
      "",
      expertise.fieldMap.humidityZone.value
    ),
  ];

  climateRows[1].value = expertise.fieldMap.outdoorDesignTemperatureC.value;
  climateRows[2].value = expertise.fieldMap.outdoorHeatingAverageC.value;
  climateRows[3].value = expertise.fieldMap.heatingDurationDays.value;

  const objectSummaryRows: MetricRow[] = [
    metric(
      "purpose",
      "Назначение здания",
      "",
      expertise.fieldMap.buildingPurpose.value
    ),
    metric("storeys", "Этажность", "эт.", expertise.fieldMap.floorsCount.value),
    metric("levels", "Количество уровней", "шт.", formatValue(summary.levelCount, 0)),
    metric("rooms", "Количество помещений", "шт.", expertise.fieldMap.roomsCount.value),
    metric("area", "Отапливаемая площадь", "м²", expertise.fieldMap.heatedArea.value),
    metric("volume", "Отапливаемый объём", "м³", expertise.fieldMap.heatedVolume.value),
    metric(
      "envelopeCount",
      "Количество элементов наружной тепловой оболочки",
      "шт.",
      formatValue(envelopeView.includedElements.length, 0)
    ),
    metric(
      "compactness",
      "Показатель компактности",
      "1/м",
      formatValue(sp50Report?.building.compactness_1_m ?? null, 3)
    ),
  ];

  const heatingVentSummaryRows: MetricRow[] = [
    metric(
      "ventilationACH",
      "Расчётная кратность вентиляции",
      "1/ч",
      expertise.fieldMap.ventilationAch.value,
      "Параметр расчётного сценария"
    ),
    metric(
      "infiltrationACH",
      "Расчётная кратность инфильтрации",
      "1/ч",
      expertise.fieldMap.infiltrationAch.value,
      "Параметр расчётного сценария"
    ),
    metric(
      "heatRecovery",
      "Коэффициент рекуперации",
      "доля",
      expertise.fieldMap.heatRecoveryEfficiencyPercent.value
    ),
    metric(
      "mechVent",
      "Механическая вентиляция",
      "",
      expertise.fieldMap.mechanicalVentilation.value
    ),
    metric("daySetpoint", "Дневная уставка температуры", "°C", expertise.fieldMap.daySetpointC.value),
    metric("nightSetpoint", "Ночная уставка температуры", "°C", expertise.fieldMap.nightSetpointC.value),
  ];

  const thermalLoadRows: MetricRow[] = [
    metric(
      "peakLoad",
      "Расчётная пиковая тепловая нагрузка",
      "кВт",
      formatDynamicMetricValue(dynamics.peakLoadKW, dynamicState, { digits: 2 })
    ),
    metric(
      "specificPeak",
      "Удельная пиковая нагрузка",
      "Вт/м²",
      formatDynamicMetricValue(dynamics.specificPeakLoad_W_m2, dynamicState, { digits: 1 })
    ),
    metric(
      "totalEnergy",
      "Расчётная тепловая энергия за период",
      "кВт·ч",
      formatDynamicMetricValue(dynamics.totalEnergyKWh, dynamicState, { digits: 1 })
    ),
    metric(
      "specificEnergy",
      "Удельная тепловая энергия за период",
      "кВт·ч/м²",
      formatDynamicMetricValue(dynamics.specificEnergyKWh_m2, dynamicState, { digits: 2 })
    ),
    metric(
      "annualHeating",
      "Годовой расход тепловой энергии",
      "кВт·ч",
      formatValue(sp50Energy?.annualHeatingEnergy_kWh, 1)
    ),
    metric(
      "annualLosses",
      "Годовые теплопотери оболочки",
      "кВт·ч",
      formatValue(sp50Energy?.annualTotalLosses_kWh, 1)
    ),
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
    metric("kob", "Удельная теплозащитная характеристика kоб", "Вт/(м³·К)", formatValue(envelopeView.kobActual, 3)),
    metric(
      "kobNorm",
      "Нормативное значение kоб",
      "Вт/(м³·К)",
      formatValue(envelopeView.kobNorm, 3)
    ),
    metric("kobStatus", "Статус проверки kоб", "", envelopeView.kobStatus),
    metric(
      "qHeatingCharacteristic",
      "Удельная характеристика расхода тепловой энергии",
      "Вт/(м³·К)",
      formatValue(sp50Energy?.qHeatingCharacteristic_W_m3K, 3)
    ),
    metric("qByArea", "Удельный расход по площади", "кВт·ч/м²", formatValue(sp50Energy?.qByArea_kWh_m2, 2)),
    metric("qByVolume", "Удельный расход по объёму", "кВт·ч/м³", formatValue(sp50Energy?.qByVolume_kWh_m3, 3)),
  ];

  const conclusions = buildConclusions(base, envelopeView.kobStatus);
  const missingData = uniqueHumanMessages(base.source.model, [
    ...expertise.clarificationLines,
    ...buildDoorClarificationLines(envelopeView.includedElements),
    ...(passport.warnings ?? []),
    ...(sp50Report?.missingData ?? []),
    ...(sp50Energy?.placeholderWarnings ?? []),
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
    sectionTitle:
      "Раздел 5. Сведения об инженерном оборудовании, сетях и системах инженерно-технического обеспечения",
    subsectionTitle: "Отопление, вентиляция и кондиционирование воздуха, тепловые сети",
    toc: [
      { id: "ovts-1", label: "1 Общие положения" },
      { id: "ovts-2", label: "2 Исходные данные" },
      { id: "ovts-3", label: "3 Климатические и метеорологические условия" },
      { id: "ovts-4", label: "4 Сведения об объекте и расчётной модели" },
      { id: "ovts-5", label: "5 Сведения об отоплении, вентиляции и тепловом режиме" },
      { id: "ovts-6", label: "6 Тепловые нагрузки" },
      { id: "ovts-7", label: "7 Теплотехнические характеристики ограждающих конструкций" },
      { id: "ovts-8", label: "8 Энергетические показатели" },
      { id: "ovts-9", label: "9 Выводы и рекомендации" },
      { id: "ovts-10", label: "10 Перечень недостающих исходных данных" },
      { id: "ovts-app-a", label: "Приложение А. Ведомость ограждающих конструкций" },
      { id: "ovts-app-b", label: "Приложение Б. Подробные расчётные таблицы" },
      { id: "ovts-app-v", label: "Приложение В. Справочная динамическая RC-оценка" },
    ],
    generalProvisions: [
      "Настоящий расчётный документ сформирован в структуре текстовой части проектной документации и предназначен для представления расчётно-пояснительных материалов по тепловой защите здания.",
      "Расчёт выполнен средствами расчётного модуля программного комплекса.",
      "Основная часть документа содержит сводные показатели по типам конструкций; детальная ведомость элементов вынесена в приложение.",
    ],
    sourceDataRows,
    climateRows,
    objectSummaryRows,
    heatingVentSummaryRows,
    thermalLoadRows,
    envelopeGroupRows,
    energyRows,
    conclusions,
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
      "По сводным теплотехническим характеристикам наружная оболочка здания соответствует расчётным нормативным требованиям."
    );
  } else if (kobStatus === "не соответствует") {
    lines.push(
      "По сводным теплотехническим характеристикам выявлены конструкции и/или показатели, требующие корректировки проектных решений."
    );
  } else {
    lines.push(
      "Окончательная нормативная проверка теплозащиты сформирована частично из-за неполноты исходных данных либо неоднозначной классификации отдельных элементов."
    );
  }

  if (energy?.usesPlaceholderInputs) {
    lines.push(
      "Энергетические показатели рассчитаны предварительно; часть исходных данных по вентиляции и инфильтрации требует уточнения."
    );
  } else if (energy?.status === "pass") {
    lines.push(
      "Удельный расход тепловой энергии на отопление и вентиляцию находится в пределах нормативных требований."
    );
  } else if (energy?.status === "fail" || energy?.complies === false) {
    lines.push("Энергетические показатели здания требуют дополнительной оптимизации.");
  } else {
    lines.push("Энергетические показатели требуют дополнительного набора исходных данных.");
  }

  if (base.passport.thermalResults.available) {
    lines.push(
      "Динамическая RC-оценка теплового режима использовалась как справочный инженерный материал и не заменяет нормативную проверку по СП 50."
    );
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
    requiredResistance: formatValue(entry.normalizedResistance, 2),
    status: entry.status,
    modelId: showTechnicalIdsInAppendix ? entry.modelId : "—",
    note: entry.classificationNote,
  };
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

function textOrNoData(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value : REPORT_EXPORT_NO_DATA;
}

function metric(key: string, label: string, unit: string, value: string, note?: string): MetricRow {
  return { key, label, unit, value, note };
}

function buildDoorClarificationLines(
  elements: Array<{ category: string; designation: string; name: string; includeInEnvelope: boolean; normalizedResistance: number | null }>
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
        `Для наружной двери ${entry.designation || entry.name} требуется задание нормативного сопротивления теплопередаче или подтверждение принятого значения.`
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
  if (
    normalized.includes("l_vent") ||
    normalized.includes("lvent") ||
    normalized.includes("ventilationach") ||
    normalized.includes("nvent")
  ) {
    return "Часть исходных данных по вентиляции не задана. Энергетические показатели требуют уточнения после ввода проектных параметров воздухообмена.";
  }
  if (
    normalized.includes("g_inf") ||
    normalized.includes("ginf") ||
    normalized.includes("infiltrationach") ||
    normalized.includes("ninf")
  ) {
    return "Часть исходных данных по инфильтрации не задана. Энергетические показатели требуют уточнения после ввода проектных параметров воздухообмена.";
  }
  if (normalized.includes("beta") || normalized.includes("betav")) {
    return "Не задан коэффициент использования теплопоступлений. Энергетические показатели требуют уточнения.";
  }
  if (normalized.includes("констант")) {
    return "Часть параметров принята по умолчанию; рекомендуется уточнить исходные данные.";
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
