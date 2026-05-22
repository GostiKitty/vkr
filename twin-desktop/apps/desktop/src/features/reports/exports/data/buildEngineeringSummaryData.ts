/**
 * Данные для «Краткого инженерного заключения» — 1–3 страницы для демонстрации.
 */

import { sanitizeDisplayText } from "../../../../shared/utils/displayText";
import type { ReportBaseData } from "./buildReportBaseData";
import type { ReportExportDocumentMeta } from "../types";
import { buildExportEnvelopeView } from "./buildExportEnvelopeView";
import { formatDynamicMetricValue } from "../helpers";
import { humanizeProjectText } from "./exportText";

const NO_DATA = "недостаточно данных";

export interface EngineeringSummaryRow {
  key: string;
  label: string;
  value: string;
}

export interface EngineeringSummaryData {
  meta: ReportExportDocumentMeta;
  objectRows: EngineeringSummaryRow[];
  sourceRows: EngineeringSummaryRow[];
  resultRows: EngineeringSummaryRow[];
  complianceLines: string[];
  riskLines: string[];
  recommendationLines: string[];
}

export function buildEngineeringSummaryData(base: ReportBaseData): EngineeringSummaryData {
  const { passport, sp50Report, meta, expertise } = base;
  const climate = passport.climate;
  const summary = passport.summary;
  const dynamics = passport.thermalResults;
  const energy = sp50Report?.energy ?? null;
  const dynamicState = base.source.dynamicResultState;
  const envelopeView = buildExportEnvelopeView({
    model: base.source.model,
    constructions: sp50Report?.constructions ?? [],
    heatedVolumeM3: summary.totalVolumeM3,
    kobNorm: sp50Report?.building.kobNorm_W_m3K ?? null,
    outdoorDesignTemperatureC: climate.outdoorDesignTemperatureC,
  });

  const objectRows: EngineeringSummaryRow[] = [
    row("name", "Объект", passport.projectName),
    row("address", "Адрес", meta.address),
    row("customer", "Заказчик", meta.customer),
    row("developer", "Разработчик", meta.organization),
    row("generated", "Дата формирования", meta.generatedAtLabel),
  ];

  const sourceRows: EngineeringSummaryRow[] = [
    row("city", "Город / климат", textOrNoData(climate.city)),
    row("indoor", "Внутренняя температура, °C", valueOrNoData(climate.indoorTemperatureC, 1)),
    row("outdoor", "Расчётная наружная температура, °C", valueOrNoData(climate.outdoorDesignTemperatureC, 1)),
    row("area", "Отапливаемая площадь, м²", valueOrNoData(summary.totalAreaM2, 2)),
    row("volume", "Отапливаемый объём, м³", valueOrNoData(summary.totalVolumeM3, 2)),
  ];

  objectRows[0].value = expertise.fieldMap.projectName.value;
  sourceRows[0].value = expertise.fieldMap.climateCity.value;
  sourceRows[1].value = expertise.fieldMap.indoorDesignTemperatureC.value;
  sourceRows[2].value = expertise.fieldMap.outdoorDesignTemperatureC.value;
  sourceRows[3].value = expertise.fieldMap.heatedArea.value;
  sourceRows[4].value = expertise.fieldMap.heatedVolume.value;

  const resultRows: EngineeringSummaryRow[] = [
    row("kob", "kоб расчётное, Вт/(м³·К)", valueOrNoData(envelopeView.kobActual, 3)),
    row("kobNorm", "kоб нормативное, Вт/(м³·К)", valueOrNoData(envelopeView.kobNorm, 3)),
    row(
      "qHeating",
      "qот расчётное, Вт/(м³·К)",
      valueOrNoData(energy?.qHeatingCharacteristic_W_m3K, 3)
    ),
    row("peakLoad", "Расчётная пиковая нагрузка, кВт", formatDynamicMetricValue(dynamics.peakLoadKW, dynamicState, { digits: 2 })),
    row("totalEnergy", "Тепловая энергия за период, кВт·ч", formatDynamicMetricValue(dynamics.totalEnergyKWh, dynamicState, { digits: 1 })),
  ];

  const complianceLines: string[] = [];
  if (envelopeView.kobStatus === "соответствует") {
    complianceLines.push("Удельная теплозащитная характеристика kоб не превышает нормативное значение.");
  } else if (envelopeView.kobStatus === "не соответствует") {
    complianceLines.push("Удельная теплозащитная характеристика kоб превышает нормативное значение.");
  } else {
    complianceLines.push("Сводная проверка теплозащиты сформирована частично.");
  }
  if (energy?.status === "pass") {
    complianceLines.push("Удельный расход тепловой энергии qот находится в пределах нормативных требований.");
  } else if (energy?.status === "fail" || energy?.complies === false) {
    complianceLines.push("Удельный расход тепловой энергии qот требует оптимизации.");
  } else {
    complianceLines.push("Окончательная проверка qот требует уточнения исходных данных.");
  }

  const riskLines = buildRiskLines(passport.problemZones, base.source.model);
  if (energy?.usesPlaceholderInputs) {
    riskLines.push("Использованы предварительные параметры воздухообмена; точность результата снижена.");
  }
  if (!dynamics.available) {
    riskLines.push(
      dynamicState === "failed-auto-demo"
        ? "Динамическая RC-оценка не сформирована автоматически; требуется запуск динамического расчёта."
        : "Не выполнена динамическая RC-оценка; интерпретация результатов ограничена."
    );
  }
  if (!riskLines.length) {
    riskLines.push("Критические зоны по результатам расчётного сценария не выявлены.");
  }

  const recommendationLines: string[] = [];
  if (envelopeView.kobStatus === "не соответствует") {
    recommendationLines.push("Усилить теплозащиту наружных ограждающих конструкций для приведения kоб в норматив.");
  }
  if (energy?.usesPlaceholderInputs) {
    recommendationLines.push("Задать проектные параметры вентиляции и инфильтрации для окончательной проверки qот.");
  }
  if (passport.problemZones.length > 0) {
    recommendationLines.push("Проверить тепловой режим в выделенных зонах при пиковых нагрузках.");
  }
  if (!recommendationLines.length) {
    recommendationLines.push(
      "Использовать документ как сводку расчётной модели для демонстрационных или защитных целей."
    );
  }

  return {
    meta,
    objectRows,
    sourceRows,
    resultRows,
    complianceLines,
    riskLines,
    recommendationLines,
  };
}

function row(key: string, label: string, value: string): EngineeringSummaryRow {
  return { key, label, value };
}

function valueOrNoData(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NO_DATA;
  }
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function textOrNoData(value: string | null | undefined): string {
  const sanitized = sanitizeDisplayText(value, "", { allowInternalId: false });
  return sanitized || NO_DATA;
}

function buildRiskLines(
  problemZones: string[],
  model: ReportBaseData["source"]["model"]
): string[] {
  const result: string[] = [];
  for (const problemZone of problemZones.slice(0, 5)) {
    const cleaned = humanizeProjectText(problemZone, model);
    if (!cleaned) {
      continue;
    }
    const fragments = cleaned
      .split(/\s*;\s*/g)
      .map((fragment) => normalizeRiskLine(fragment))
      .filter(Boolean);
    result.push(...fragments);
  }
  return result;
}

function normalizeRiskLine(value: string): string {
  const trimmed = value
    .replace(/\s+:/g, ":")
    .replace(/:\s*:/g, ": ")
    .replace(/\.\.+/g, ".")
    .trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}
