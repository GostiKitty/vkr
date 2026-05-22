import type { ReportBaseData } from "./buildReportBaseData";
import type { ReportExportDocumentMeta } from "../types";
import { formatDynamicMetricValue } from "../helpers";

const NO_DATA = "недостаточно данных";
const DASH = "—";
const SOLAR_GAIN_STATUS =
  "требует уточнения методики расчёта солнечных теплопоступлений";

export interface EnergyPassportRow {
  key: string;
  label: string;
  unit: string;
  normValue: string;
  designValue: string;
  factValue: string;
}

export interface EnergyPassportSection {
  id: string;
  title: string;
  rows: EnergyPassportRow[];
}

export interface EnergyPassportInfoRow {
  label: string;
  value: string;
}

export interface EnergyPassportData {
  meta: ReportExportDocumentMeta;
  expertise: ReportBaseData["expertise"];
  documentInfo: EnergyPassportInfoRow[];
  sourceInfo: EnergyPassportInfoRow[];
  generalInfo: EnergyPassportSection;
  designConditions: EnergyPassportSection;
  geometryIndicators: EnergyPassportSection;
  thermalIndicators: EnergyPassportSection;
  auxIndicators: EnergyPassportSection;
  specificCharacteristics: EnergyPassportSection;
  coefficients: EnergyPassportSection;
  complexIndicators: EnergyPassportSection;
  energyLoads: EnergyPassportSection;
}

export function buildEnergyPassportData(base: ReportBaseData): EnergyPassportData {
  const { passport, sp50Report, meta, expertise } = base;
  const energy = sp50Report?.energy ?? null;
  const building = sp50Report?.building ?? null;
  const climate = passport.climate;
  const summary = passport.summary;
  const operation = passport.operation;
  const dynamicState = base.source.dynamicResultState;

  const documentInfo: EnergyPassportInfoRow[] = [
    { label: "Наименование документа", value: "Энергетический паспорт здания" },
    { label: "Шифр документа", value: expertise.fieldMap.projectCipher.value },
    { label: "Дата формирования", value: meta.generatedAtLabel },
    { label: "Версия расчётной модели", value: meta.modelVersion },
  ];

  const sourceInfo: EnergyPassportInfoRow[] = [
    {
      label: "Режим комплекта",
      value:
        expertise.exportMode === "strict-expertise"
          ? "строгий комплект для экспертизы"
          : expertise.exportMode === "vkr-brief"
            ? "краткий комплект для ВКР"
            : "демонстрационный комплект",
    },
    {
      label: "Источник заполнения данных",
      value: "пользовательские реквизиты, данные модели, расчётного сценария и расчётные показатели",
    },
    {
      label: "Фактические значения",
      value: "не заполняются на проектной стадии",
    },
    {
      label: "Солнечные теплопоступления",
      value:
        expertise.solarGainsMode === "manual"
          ? "задано пользователем в исходных данных для экспертизы"
          : expertise.solarGainsMode === "omit"
            ? SOLAR_GAIN_STATUS
            : "автоматически, если расчёт доступен",
    },
  ];

  const generalInfo: EnergyPassportSection = {
    id: "ep-1",
    title: "1 Общая информация",
    rows: [
      row("ep-1-object", "Наименование объекта", "", DASH, expertise.fieldMap.projectName.value, DASH),
      row("ep-1-address", "Адрес объекта", "", DASH, expertise.fieldMap.objectAddress.value, DASH),
      row("ep-1-purpose", "Назначение здания", "", DASH, expertise.fieldMap.buildingPurpose.value, DASH),
      row("ep-1-developer", "Разработчик документации", "", DASH, expertise.fieldMap.developerOrg.value, DASH),
      row("ep-1-customer", "Заказчик", "", DASH, expertise.fieldMap.customerOrg.value, DASH),
      row("ep-1-stage", "Стадия документации", "", DASH, expertise.fieldMap.documentStage.value, DASH),
    ],
  };

  const designConditions: EnergyPassportSection = {
    id: "ep-2",
    title: "2 Расчётные условия",
    rows: [
      row("ep-2-city", "Город / климатическая база", "", DASH, expertise.fieldMap.climateCity.value, DASH),
      row(
        "ep-2-outdoorDesign",
        "Расчётная температура наружного воздуха для проектирования отопления",
        "°C",
        DASH,
        expertise.fieldMap.outdoorDesignTemperatureC.value,
        DASH
      ),
      row(
        "ep-2-outdoorAverage",
        "Средняя температура наружного воздуха отопительного периода",
        "°C",
        DASH,
        expertise.fieldMap.outdoorHeatingAverageC.value,
        DASH
      ),
      row(
        "ep-2-heatingDays",
        "Продолжительность отопительного периода",
        "сут.",
        DASH,
        expertise.fieldMap.heatingDurationDays.value,
        DASH
      ),
      row("ep-2-gsop", "ГСОП", "°C·сут.", DASH, expertise.fieldMap.gsop.value, DASH),
      row(
        "ep-2-indoor",
        "Расчётная внутренняя температура",
        "°C",
        DASH,
        expertise.fieldMap.indoorDesignTemperatureC.value,
        DASH
      ),
      row(
        "ep-2-humidity",
        "Расчётная относительная влажность",
        "%",
        DASH,
        expertise.fieldMap.indoorRelativeHumidityPercent.value,
        DASH
      ),
    ],
  };

  const geometryIndicators: EnergyPassportSection = {
    id: "ep-3",
    title: "3 Геометрические показатели",
    rows: [
      row("ep-3-storeys", "Этажность", "эт.", DASH, expertise.fieldMap.floorsCount.value, DASH),
      row("ep-3-area", "Отапливаемая площадь", "м²", DASH, expertise.fieldMap.heatedArea.value, DASH),
      row("ep-3-volume", "Отапливаемый объём", "м³", DASH, expertise.fieldMap.heatedVolume.value, DASH),
      row(
        "ep-3-compactness",
        "Показатель компактности",
        "1/м",
        DASH,
        valueOrNoData(building?.compactness_1_m, 3),
        DASH
      ),
      row("ep-3-rooms", "Количество помещений", "шт.", DASH, expertise.fieldMap.roomsCount.value, DASH),
    ],
  };

  const thermalIndicators: EnergyPassportSection = {
    id: "ep-4",
    title: "4 Теплотехнические показатели",
    rows: [
      row(
        "ep-4-kob",
        "Удельная теплозащитная характеристика kоб",
        "Вт/(м³·К)",
        valueOrNoData(building?.kobNorm_W_m3K, 3),
        valueOrNoData(building?.kob_W_m3K, 3),
        DASH
      ),
      row(
        "ep-4-kOverall",
        "Удельная теплозащитная характеристика наружных ограждений",
        "Вт/(м²·К)",
        DASH,
        valueOrNoData(building?.kOverall_W_m2K, 3),
        DASH
      ),
      row(
        "ep-4-airExchange",
        "Средняя кратность воздухообмена",
        "1/ч",
        DASH,
        valueOrNoData(energy?.averageAirExchange_1_h, 3, { treatZeroAsNoData: true }),
        DASH
      ),
    ],
  };

  const auxIndicators: EnergyPassportSection = {
    id: "ep-5",
    title: "5 Вспомогательные показатели",
    rows: [
      row(
        "ep-5-density",
        "Средняя плотность воздуха в отопительный период",
        "кг/м³",
        DASH,
        valueOrNoData(energy?.averageAirDensity_kg_m3, 3, { treatZeroAsNoData: true }),
        DASH
      ),
      row(
        "ep-5-internalGain",
        "Удельная характеристика теплопоступлений",
        "Вт/(м³·К)",
        DASH,
        expertise.fieldMap.internalGains.isFilled
          ? expertise.fieldMap.internalGains.value
          : valueOrNoData(energy?.internalGainCharacteristic_W_m3K, 3, {
              treatZeroAsNoData: true,
            }),
        DASH
      ),
      row(
        "ep-5-solarGain",
        "Удельная характеристика солнечных теплопоступлений",
        "Вт/(м³·К)",
        DASH,
        resolveSolarGainValue(base),
        DASH
      ),
    ],
  };

  const specificCharacteristics: EnergyPassportSection = {
    id: "ep-6",
    title: "6 Удельные характеристики",
    rows: [
      row(
        "ep-6-qHeating",
        "Удельная характеристика расхода тепловой энергии на отопление и вентиляцию",
        "Вт/(м³·К)",
        DASH,
        valueOrNoData(energy?.qHeatingCharacteristic_W_m3K, 3),
        DASH
      ),
      row(
        "ep-6-qNorm",
        "Нормативное значение qот",
        "кВт·ч/м²",
        valueOrNoData(energy?.qHeatingNorm_kWh_m2, 2),
        DASH,
        DASH
      ),
      row(
        "ep-6-qByArea",
        "Удельный расход тепловой энергии по площади",
        "кВт·ч/м²",
        DASH,
        valueOrNoData(energy?.qByArea_kWh_m2, 2),
        DASH
      ),
      row(
        "ep-6-qByVolume",
        "Удельный расход тепловой энергии по объёму",
        "кВт·ч/м³",
        DASH,
        valueOrNoData(energy?.qByVolume_kWh_m3, 3),
        DASH
      ),
    ],
  };

  const coefficients: EnergyPassportSection = {
    id: "ep-7",
    title: "7 Коэффициенты",
    rows: [
      row(
        "ep-7-beta",
        "Коэффициент использования теплопоступлений",
        "доля",
        DASH,
        valueOrNoData(energy?.betaGainUseFactor, 2),
        DASH
      ),
      row(
        "ep-7-heatRecovery",
        "Коэффициент рекуперации тепла вентиляции",
        "доля",
        DASH,
        operation.heatRecoveryFactor === null
          ? expertise.fieldMap.heatRecoveryEfficiencyPercent.value
          : valueOrNoData(operation.heatRecoveryFactor, 2),
        DASH
      ),
    ],
  };

  const complexIndicators: EnergyPassportSection = {
    id: "ep-8",
    title: "8 Комплексные показатели расхода тепловой энергии",
    rows: [
      row(
        "ep-8-annualHeating",
        "Годовой расход тепловой энергии на отопление и вентиляцию",
        "кВт·ч",
        DASH,
        valueOrNoData(energy?.annualHeatingEnergy_kWh, 1),
        DASH
      ),
      row(
        "ep-8-annualLosses",
        "Годовые теплопотери оболочки",
        "кВт·ч",
        DASH,
        valueOrNoData(energy?.annualTotalLosses_kWh, 1),
        DASH
      ),
    ],
  };

  const energyLoads: EnergyPassportSection = {
    id: "ep-9",
    title: "9 Энергетические нагрузки здания",
    rows: [
      row(
        "ep-9-peakLoad",
        "Расчётная пиковая тепловая нагрузка",
        "кВт",
        DASH,
        formatDynamicMetricValue(passport.thermalResults.peakLoadKW, dynamicState, { digits: 2 }),
        DASH
      ),
      row(
        "ep-9-specificPeak",
        "Удельная пиковая нагрузка",
        "Вт/м²",
        DASH,
        formatDynamicMetricValue(passport.thermalResults.specificPeakLoad_W_m2, dynamicState, { digits: 1 }),
        DASH
      ),
      row(
        "ep-9-totalEnergy",
        "Тепловая энергия за расчётный период",
        "кВт·ч",
        DASH,
        formatDynamicMetricValue(passport.thermalResults.totalEnergyKWh, dynamicState, { digits: 1 }),
        DASH
      ),
      row(
        "ep-9-specificEnergy",
        "Удельная тепловая энергия за расчётный период",
        "кВт·ч/м²",
        DASH,
        formatDynamicMetricValue(passport.thermalResults.specificEnergyKWh_m2, dynamicState, { digits: 2 }),
        DASH
      ),
    ],
  };

  void climate;
  void summary;

  return {
    meta,
    expertise,
    documentInfo,
    sourceInfo,
    generalInfo,
    designConditions,
    geometryIndicators,
    thermalIndicators,
    auxIndicators,
    specificCharacteristics,
    coefficients,
    complexIndicators,
    energyLoads,
  };
}

function resolveSolarGainValue(base: ReportBaseData): string {
  const energy = base.sp50Report?.energy ?? null;
  const expertise = base.expertise;
  if (
    expertise.solarGainsMode === "manual" &&
    expertise.solarGainsManualValue.trim()
  ) {
    return `${expertise.solarGainsManualValue.trim()} (задано пользователем в исходных данных для экспертизы)`;
  }
  if (expertise.solarGainsMode === "omit") {
    return SOLAR_GAIN_STATUS;
  }
  if (energy?.solarGainCharacteristic_W_m3K === null || energy?.solarGainCharacteristic_W_m3K === undefined) {
    return SOLAR_GAIN_STATUS;
  }
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(energy.solarGainCharacteristic_W_m3K);
  if (/^[−\-]?0([.,]0+)?$/.test(formatted.trim())) {
    return SOLAR_GAIN_STATUS;
  }
  return formatted;
}

function row(
  key: string,
  label: string,
  unit: string,
  normValue: string,
  designValue: string,
  factValue: string
): EnergyPassportRow {
  return { key, label, unit, normValue, designValue, factValue };
}

function valueOrNoData(
  value: number | null | undefined,
  digits: number,
  options: { treatZeroAsNoData?: boolean } = {}
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NO_DATA;
  }
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
  if (options.treatZeroAsNoData && /^[−\-]?0([.,]0+)?$/.test(formatted.trim())) {
    return NO_DATA;
  }
  return formatted;
}
