import { REPORT_EXPORT_DASH, REPORT_EXPORT_NO_DATA } from "../helpers";
export function buildEnergyPassportData(base) {
    const { meta, expertise, preflight, reportMetrics } = base;
    const showFactColumn = false;
    const documentInfo = [
        { label: "Наименование документа", value: "Энергетический паспорт проекта здания" },
        { label: "Шифр документа", value: expertise.fieldMap.projectCipher.value },
        { label: "Стадия", value: expertise.fieldMap.documentStage.value },
        { label: "Дата формирования", value: meta.generatedAtLabel },
        { label: "Версия расчётной модели", value: meta.modelVersion },
        { label: "Статус документа", value: preflight.statusLabel },
    ];
    const sourceInfo = [
        { label: "Режим комплекта", value: expertise.fieldMap.exportMode.value },
        {
            label: "Источник данных",
            value: "Исходные реквизиты проекта, цифровая модель здания, расчёт тепловой защиты и результаты расчётного сценария",
        },
        {
            label: "Климатическая база",
            value: reportMetrics.climateCity ?? REPORT_EXPORT_NO_DATA,
        },
    ];
    const basisInfo = [
        { label: "Основание заполнения", value: "СП 50.13330.2024" },
        { label: "Расчётная основа", value: "Расчёт тепловой защиты здания" },
        { label: "Источник геометрии и состава", value: "Данные цифровой модели" },
    ];
    const generalInfo = {
        id: "ep-1",
        title: "1 Общая информация",
        rows: [
            row("ep-1-object", "Наименование объекта", "", REPORT_EXPORT_DASH, expertise.fieldMap.projectName.value, REPORT_EXPORT_DASH),
            row("ep-1-address", "Адрес объекта", "", REPORT_EXPORT_DASH, expertise.fieldMap.objectAddress.value, REPORT_EXPORT_DASH),
            row("ep-1-purpose", "Назначение здания", "", REPORT_EXPORT_DASH, expertise.fieldMap.buildingPurpose.value, REPORT_EXPORT_DASH),
            row("ep-1-customer", "Заказчик", "", REPORT_EXPORT_DASH, expertise.fieldMap.customerOrg.value, REPORT_EXPORT_DASH),
            row("ep-1-developer", "Проектная организация", "", REPORT_EXPORT_DASH, expertise.fieldMap.developerOrg.value, REPORT_EXPORT_DASH),
            row("ep-1-stage", "Стадия проектирования", "", REPORT_EXPORT_DASH, expertise.fieldMap.documentStage.value, REPORT_EXPORT_DASH),
        ],
    };
    const designConditions = {
        id: "ep-2",
        title: "2 Расчётные условия",
        rows: [
            row("ep-2-city", "Город / климатическая база", "", REPORT_EXPORT_DASH, reportMetrics.climateCity ?? REPORT_EXPORT_NO_DATA, REPORT_EXPORT_DASH),
            row("ep-2-outdoorDesign", "Расчётная наружная температура", "°C", REPORT_EXPORT_DASH, formatValue(reportMetrics.outdoorDesignTemperatureC, 1), REPORT_EXPORT_DASH),
            row("ep-2-outdoorAverage", "Средняя температура отопительного периода", "°C", REPORT_EXPORT_DASH, formatValue(reportMetrics.outdoorHeatingAverageC, 1), REPORT_EXPORT_DASH),
            row("ep-2-heatingDays", "Продолжительность отопительного периода", "сут.", REPORT_EXPORT_DASH, formatValue(reportMetrics.heatingDurationDays, 0), REPORT_EXPORT_DASH),
            row("ep-2-gsop", "ГСОП", "°C·сут.", REPORT_EXPORT_DASH, formatValue(reportMetrics.gsop, 0), REPORT_EXPORT_DASH),
            row("ep-2-indoor", "Внутренняя расчётная температура", "°C", REPORT_EXPORT_DASH, formatValue(reportMetrics.indoorDesignTemperatureC, 1), REPORT_EXPORT_DASH),
            row("ep-2-humidity", "Относительная влажность", "%", REPORT_EXPORT_DASH, formatValue(reportMetrics.indoorRelativeHumidityPercent, 0), REPORT_EXPORT_DASH),
        ],
    };
    const geometryIndicators = {
        id: "ep-3",
        title: "3 Геометрические показатели",
        rows: [
            row("ep-3-storeys", "Этажность", "эт.", REPORT_EXPORT_DASH, expertise.fieldMap.floorsCount.value, REPORT_EXPORT_DASH),
            row("ep-3-area", "Отапливаемая площадь", "м²", REPORT_EXPORT_DASH, formatValue(reportMetrics.heatedAreaM2, 2), REPORT_EXPORT_DASH),
            row("ep-3-volume", "Отапливаемый объём", "м³", REPORT_EXPORT_DASH, formatValue(reportMetrics.heatedVolumeM3, 2), REPORT_EXPORT_DASH),
            row("ep-3-rooms", "Количество помещений", "шт.", REPORT_EXPORT_DASH, formatValue(reportMetrics.roomCount, 0), REPORT_EXPORT_DASH),
            row("ep-3-levels", "Количество уровней", "шт.", REPORT_EXPORT_DASH, formatValue(reportMetrics.levelCount, 0), REPORT_EXPORT_DASH),
        ],
    };
    const thermalIndicators = {
        id: "ep-4",
        title: "4 Теплотехнические показатели",
        rows: [
            row("ep-4-kob", "Удельная теплозащитная характеристика kоб", "Вт/(м³·К)", formatValue(reportMetrics.kobNorm_W_m3K, 3), formatValue(reportMetrics.kobActual_W_m3K, 3), REPORT_EXPORT_DASH),
            row("ep-4-kobStatus", "Статус проверки kоб", "", REPORT_EXPORT_DASH, reportMetrics.kobStatus, REPORT_EXPORT_DASH),
            row("ep-4-qHeating", "Удельная характеристика расхода тепловой энергии qот", "Вт/(м³·К)", REPORT_EXPORT_DASH, formatValue(reportMetrics.qHeatingCharacteristic_W_m3K, 3), REPORT_EXPORT_DASH),
            row("ep-4-qHeatingStatus", "Статус проверки qот", "", REPORT_EXPORT_DASH, reportMetrics.qHeatingStatus, REPORT_EXPORT_DASH),
        ],
    };
    const auxIndicators = {
        id: "ep-5",
        title: "5 Вспомогательные показатели",
        rows: [
            row("ep-5-ventilation", "Кратность вентиляции", "1/ч", REPORT_EXPORT_DASH, formatValue(reportMetrics.ventilationAch, 3), REPORT_EXPORT_DASH),
            row("ep-5-infiltration", "Кратность инфильтрации", "1/ч", REPORT_EXPORT_DASH, formatValue(reportMetrics.infiltrationAch, 3), REPORT_EXPORT_DASH),
            row("ep-5-mechanicalVentilation", "Механическая вентиляция", "", REPORT_EXPORT_DASH, reportMetrics.mechanicalVentilation === null ? REPORT_EXPORT_NO_DATA : reportMetrics.mechanicalVentilation ? "да" : "нет", REPORT_EXPORT_DASH),
            row("ep-5-heatRecovery", "Коэффициент рекуперации", "доля", REPORT_EXPORT_DASH, formatValue(reportMetrics.heatRecoveryFactor, 2), REPORT_EXPORT_DASH),
            row("ep-5-solarGain", "Солнечные теплопоступления", "", REPORT_EXPORT_DASH, resolveSolarGainValue(base), REPORT_EXPORT_DASH),
        ],
    };
    const specificCharacteristics = {
        id: "ep-6",
        title: "6 Удельные характеристики",
        rows: [
            row("ep-6-qNorm", "Нормируемое значение qот", "кВт·ч/м²", formatValue(reportMetrics.qHeatingNorm_kWh_m2, 2), REPORT_EXPORT_DASH, REPORT_EXPORT_DASH),
            row("ep-6-qByArea", "Удельный расход по площади", "кВт·ч/м²", REPORT_EXPORT_DASH, formatValue(reportMetrics.qByArea_kWh_m2, 2), REPORT_EXPORT_DASH),
            row("ep-6-qByVolume", "Удельный расход по объёму", "кВт·ч/м³", REPORT_EXPORT_DASH, formatValue(reportMetrics.qByVolume_kWh_m3, 3), REPORT_EXPORT_DASH),
            row("ep-6-specificPeak", "Удельная пиковая нагрузка", "Вт/м²", REPORT_EXPORT_DASH, formatValue(reportMetrics.specificPeakLoad_W_m2, 1), REPORT_EXPORT_DASH),
            row("ep-6-specificEnergy", "Удельная энергия за расчётный период", "кВт·ч/м²", REPORT_EXPORT_DASH, formatValue(reportMetrics.specificEnergyKWh_m2, 2), REPORT_EXPORT_DASH),
        ],
    };
    const coefficients = {
        id: "ep-7",
        title: "7 Коэффициенты",
        rows: [
            row("ep-7-operationCondition", "Условия эксплуатации по СП 50", "", REPORT_EXPORT_DASH, expertise.fieldMap.operationCondition.value, REPORT_EXPORT_DASH),
            row("ep-7-status", "Статус выпуска комплекта", "", REPORT_EXPORT_DASH, preflight.statusLabel, REPORT_EXPORT_DASH),
        ],
    };
    const complexIndicators = {
        id: "ep-8",
        title: "8 Комплексные показатели расхода тепловой энергии",
        rows: [
            row("ep-8-annualHeating", "Годовой расход тепловой энергии", "кВт·ч", REPORT_EXPORT_DASH, formatValue(reportMetrics.annualHeatingEnergy_kWh, 1), REPORT_EXPORT_DASH),
            row("ep-8-annualLosses", "Годовые теплопотери оболочки", "кВт·ч", REPORT_EXPORT_DASH, formatValue(reportMetrics.annualEnvelopeLosses_kWh, 1), REPORT_EXPORT_DASH),
        ],
    };
    const energyLoads = {
        id: "ep-9",
        title: "9 Энергетические нагрузки здания",
        rows: [
            row("ep-9-peakLoad", "Расчётная пиковая тепловая нагрузка", "кВт", REPORT_EXPORT_DASH, formatValue(reportMetrics.peakHeatLoadKW, 2), REPORT_EXPORT_DASH),
            row("ep-9-totalEnergy", "Тепловая энергия за расчётный период", "кВт·ч", REPORT_EXPORT_DASH, formatValue(reportMetrics.totalHeatEnergyKWh, 1), REPORT_EXPORT_DASH),
        ],
    };
    return {
        meta,
        expertise,
        preflight,
        showFactColumn,
        factColumnNote: "Колонка «Фактическое значение» не применяется на стадии проектной документации и заполняется только при наличии обследования объекта.",
        documentInfo,
        sourceInfo,
        basisInfo,
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
function resolveSolarGainValue(base) {
    const energy = base.sp50Report?.energy ?? null;
    if (base.expertise.solarGainsMode === "manual" &&
        base.expertise.solarGainsManualValue.trim()) {
        return `${base.expertise.solarGainsManualValue.trim()} (задано пользователем)`;
    }
    if (base.expertise.solarGainsMode === "omit") {
        return "не применяется без подтверждённой методики расчёта";
    }
    if (energy?.solarGainCharacteristic_W_m3K === null ||
        energy?.solarGainCharacteristic_W_m3K === undefined) {
        return "требует уточнения методики расчёта солнечных теплопоступлений";
    }
    const formatted = formatValue(energy.solarGainCharacteristic_W_m3K, 3);
    if (/^[−\-]?0([.,]0+)?$/.test(formatted.trim())) {
        return "требует уточнения методики расчёта солнечных теплопоступлений";
    }
    return formatted;
}
function row(key, label, unit, normValue, designValue, factValue) {
    return { key, label, unit, normValue, designValue, factValue };
}
function formatValue(value, digits) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return REPORT_EXPORT_NO_DATA;
    }
    return new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    }).format(value);
}
