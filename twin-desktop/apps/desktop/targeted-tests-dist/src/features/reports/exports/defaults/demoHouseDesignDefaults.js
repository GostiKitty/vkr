/**
 * Профиль проектных допущений для демонстрационного жилого дома.
 *
 * Идея: если в модели/форме выгрузки какие-то поля пусты, пользователь
 * может явно применить этот профиль, чтобы документы выгружались как
 * завершённый проект. Каждое подставленное значение помечается как
 * «принято по проектному допущению» — defaults никогда не подменяют
 * введённые пользователем данные молча.
 *
 * Что НЕ заполняется этим профилем:
 *  - колонка «Фактическое значение» в Энергопаспорте (требует обследования);
 *  - сертификаты, подписи и реальные ФИО;
 *  - расчётный qrad (солнечные теплопоступления) — методика требует
 *    уточнения, поле остаётся как «требует уточнения».
 *
 * Изменения тут НЕ касаются BuildingModel, расчётного ядра, 3D, Monte Carlo
 * и физики. Это только слой подготовки данных для выгрузки.
 */
/**
 * Профиль по умолчанию (значения из ТЗ).
 */
export const DEMO_HOUSE_DESIGN_DEFAULTS = {
    buildingPurpose: "Жилое",
    city: "Москва",
    stage: "П",
    indoorDesignTemperatureC: 20,
    daySetpointC: 21,
    nightSetpointC: 18,
    indoorRelativeHumidityPercent: 50,
    humidityZone: "нормальная",
    humidityMode: "нормальный",
    operationCondition: "Б",
    infiltrationAch: 0.5,
    mechanicalVentilationAch: 0.18,
    heatRecoveryEfficiencyPercent: 0,
    calculationScenario: "24 ч",
    designOccupancyMode: "проектный демонстрационный сценарий",
    ventilationNote: "Параметры воздухообмена приняты по демонстрационному проектному сценарию и требуют уточнения на стадии проектирования.",
    solarGainStatus: "требует уточнения методики расчёта солнечных теплопоступлений",
    actualValuesStatus: "не заполняется на проектной стадии",
    projectCode: "ДЕМО-ОВ-ТР",
    objectName: "Демонстрационный жилой дом",
    organization: "Учебный демонстрационный проект",
    customerOrg: "Демонстрационный заказчик",
    buildingAddress: "г. Москва, демонстрационный объект",
    developedBy: "Автор ВКР",
    checkedBy: "—",
    chiefEngineer: "—",
    normControl: "—",
};
/**
 * Сноска под значениями, заполненными по проектному допущению.
 */
export const DEMO_DEFAULT_FOOTNOTE = "* Значение принято по проектному допущению для демонстрационного расчёта и требует уточнения.";
/**
 * Заголовок раздела с применёнными допущениями.
 */
export const ASSUMPTIONS_SECTION_TITLE = "Принятые проектные допущения";
/**
 * Признак: содержит ли строка осмысленное значение.
 */
function isMeaningfulText(value) {
    if (typeof value !== "string") {
        return false;
    }
    return value.trim().length > 0;
}
/**
 * Признак: задано ли числовое значение (не null/undefined/NaN/Infinity).
 */
function isMeaningfulNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
/**
 * Возвращает новый ReportBaseData-input, в котором пустые поля заполнены
 * значениями из defaults; собирает список применённых допущений.
 *
 * Гарантии:
 *  - входной объект не мутируется (везде shallow-копии);
 *  - если поле уже задано, default НЕ перезаписывает его;
 *  - не трогает BuildingModel.envelope, walls, levels, geometry, networks;
 *  - не подменяет колонку «Фактическое значение» в энергопаспорте;
 *  - не трогает расчётные результаты (thermalResult/monteCarloResult).
 */
export function applyDemoDesignDefaults(input, defaults = DEMO_HOUSE_DESIGN_DEFAULTS) {
    const appliedAssumptions = [];
    const nextModel = applyDefaultsToModel(input.model, defaults, appliedAssumptions);
    const nextScenario = applyDefaultsToScenario(input.scenarioConfig, defaults, appliedAssumptions);
    const nextReportMeta = applyDefaultsToReportMeta(input.reportMeta, defaults, appliedAssumptions);
    return {
        input: {
            ...input,
            model: nextModel,
            scenarioConfig: nextScenario,
            reportMeta: nextReportMeta,
        },
        appliedAssumptions,
    };
}
function applyDefaultsToModel(model, defaults, applied) {
    const tp = model.thermalProtection ?? {};
    const climate = tp.climate ?? {};
    const nextClimate = { ...climate };
    const nextTp = { ...tp, climate: nextClimate };
    if (!isMeaningfulText(climate.city)) {
        nextClimate.city = defaults.city;
        applied.push({
            key: "climate.city",
            label: "Город / климатическая база",
            value: defaults.city,
            source: "demo-default",
        });
    }
    if (!isMeaningfulNumber(climate.indoorTemperatureC)) {
        nextClimate.indoorTemperatureC = defaults.indoorDesignTemperatureC;
        applied.push({
            key: "climate.indoorTemperatureC",
            label: "Расчётная внутренняя температура",
            value: `${defaults.indoorDesignTemperatureC} °C`,
            source: "demo-default",
        });
    }
    if (!isMeaningfulNumber(climate.indoorRelativeHumidityPercent)) {
        nextClimate.indoorRelativeHumidityPercent = defaults.indoorRelativeHumidityPercent;
        applied.push({
            key: "climate.indoorRelativeHumidityPercent",
            label: "Расчётная относительная влажность",
            value: `${defaults.indoorRelativeHumidityPercent} %`,
            source: "demo-default",
        });
    }
    if (!isMeaningfulText(climate.humidityZone)) {
        nextClimate.humidityZone = mapHumidityZone(defaults.humidityZone);
        applied.push({
            key: "climate.humidityZone",
            label: "Зона влажности",
            value: defaults.humidityZone,
            source: "demo-default",
        });
    }
    if (!isMeaningfulText(tp.moistureMode)) {
        nextTp.moistureMode = mapMoistureMode(defaults.humidityMode);
        applied.push({
            key: "thermalProtection.moistureMode",
            label: "Влажностный режим помещений",
            value: defaults.humidityMode,
            source: "demo-default",
        });
    }
    if (!isMeaningfulText(tp.operationCondition)) {
        nextTp.operationCondition = mapOperationCondition(defaults.operationCondition);
        applied.push({
            key: "thermalProtection.operationCondition",
            label: "Условия эксплуатации ограждающих конструкций",
            value: defaults.operationCondition,
            source: "demo-default",
        });
    }
    if (!isMeaningfulText(tp.buildingCategory) && defaults.buildingPurpose === "Жилое") {
        nextTp.buildingCategory = "residential";
        applied.push({
            key: "thermalProtection.buildingCategory",
            label: "Назначение здания",
            value: defaults.buildingPurpose,
            source: "demo-default",
        });
    }
    const nextMeta = { ...(model.meta ?? {}) };
    const metaName = typeof nextMeta["name"] === "string" ? nextMeta["name"] : null;
    const metaSourceName = typeof nextMeta["sourceProjectName"] === "string"
        ? nextMeta["sourceProjectName"]
        : null;
    if (!isMeaningfulText(metaName) && !isMeaningfulText(metaSourceName)) {
        nextMeta["name"] = defaults.objectName;
        applied.push({
            key: "meta.name",
            label: "Наименование объекта",
            value: defaults.objectName,
            source: "demo-default",
        });
    }
    const signatoryDefaults = [
        { key: "developedBy", value: defaults.developedBy },
        { key: "checkedBy", value: defaults.checkedBy },
        { key: "normControl", value: defaults.normControl },
        { key: "chiefEngineer", value: defaults.chiefEngineer },
    ];
    const appliedSignatories = [];
    for (const item of signatoryDefaults) {
        if (!isMeaningfulText(nextMeta[item.key])) {
            nextMeta[item.key] = item.value;
            appliedSignatories.push(item.value);
        }
    }
    if (appliedSignatories.length > 0) {
        applied.push({
            key: "meta.signatories",
            label: "Подписанты",
            value: `Разработал — ${defaults.developedBy}; Проверил — ${defaults.checkedBy}; Нормоконтроль — ${defaults.normControl}; ГИП — ${defaults.chiefEngineer}`,
            source: "demo-default",
        });
    }
    return {
        ...model,
        meta: nextMeta,
        thermalProtection: nextTp,
    };
}
function applyDefaultsToScenario(scenario, defaults, applied) {
    const base = scenario ?? {
        climate: { baseC: -5, amplitudeC: 8, seasonalOffsetC: 0 },
        setpoints: { day: defaults.daySetpointC, night: defaults.nightSetpointC, dayStartHour: 6, nightStartHour: 22 },
        internalGains: { dayGain_W_m2: 6, nightGain_W_m2: 1 },
        occupancy: { dayFraction: 1, nightFraction: 0.2 },
        ventilation: {
            infiltrationACH: defaults.infiltrationAch,
            ventilationACH: defaults.mechanicalVentilationAch,
            heatRecoveryFactor: defaults.heatRecoveryEfficiencyPercent / 100,
            mechanicalVentilationEnabled: defaults.mechanicalVentilationAch > 0,
        },
        climateCityId: defaults.city.toLowerCase(),
    };
    // Если сценария не было совсем — он полностью «по допущению».
    if (!scenario) {
        applied.push({
            key: "scenario.setpoints",
            label: "Уставки отопления (день / ночь)",
            value: `${defaults.daySetpointC} / ${defaults.nightSetpointC} °C`,
            source: "demo-default",
        });
        applied.push({
            key: "scenario.ventilation.infiltrationAch",
            label: "Инфильтрация",
            value: `${defaults.infiltrationAch} 1/ч`,
            source: "demo-default",
        });
        applied.push({
            key: "scenario.ventilation.ventilationAch",
            label: "Механическая вентиляция",
            value: `${defaults.mechanicalVentilationAch} 1/ч`,
            source: "demo-default",
        });
        applied.push({
            key: "scenario.ventilation.heatRecovery",
            label: "Коэффициент рекуперации",
            value: `${defaults.heatRecoveryEfficiencyPercent} %`,
            source: "demo-default",
        });
        applied.push({
            key: "scenario.duration",
            label: "Расчётный сценарий",
            value: defaults.calculationScenario,
            source: "demo-default",
        });
        applied.push({
            key: "scenario.occupancy",
            label: "Режим занятости / эксплуатации",
            value: defaults.designOccupancyMode,
            source: "demo-default",
        });
    }
    return base;
}
function applyDefaultsToReportMeta(reportMeta, defaults, applied) {
    const next = { ...reportMeta };
    if (!isMeaningfulText(next.projectCipher)) {
        next.projectCipher = defaults.projectCode;
        applied.push({
            key: "reportMeta.projectCipher",
            label: "Шифр документа",
            value: defaults.projectCode,
            source: "demo-default",
        });
    }
    if (!isMeaningfulText(next.documentStage)) {
        next.documentStage = defaults.stage;
        applied.push({
            key: "reportMeta.documentStage",
            label: "Стадия документации",
            value: defaults.stage,
            source: "demo-default",
        });
    }
    if (!isMeaningfulText(next.documentCity)) {
        next.documentCity = defaults.city;
        applied.push({
            key: "reportMeta.documentCity",
            label: "Город документа",
            value: defaults.city,
            source: "demo-default",
        });
    }
    if (!isMeaningfulText(next.developerOrg)) {
        next.developerOrg = defaults.organization;
        applied.push({
            key: "reportMeta.developerOrg",
            label: "Организация",
            value: defaults.organization,
            source: "demo-default",
        });
    }
    if (!isMeaningfulText(next.customerOrg)) {
        next.customerOrg = defaults.customerOrg;
        applied.push({
            key: "reportMeta.customerOrg",
            label: "Заказчик",
            value: defaults.customerOrg,
            source: "demo-default",
        });
    }
    if (!isMeaningfulText(next.buildingAddress)) {
        next.buildingAddress = defaults.buildingAddress;
        applied.push({
            key: "reportMeta.buildingAddress",
            label: "Адрес",
            value: defaults.buildingAddress,
            source: "demo-default",
        });
    }
    return next;
}
function mapHumidityZone(label) {
    const v = label.trim().toLowerCase();
    if (v.startsWith("сух"))
        return "dry";
    if (v.startsWith("влаж"))
        return "wet";
    return "normal";
}
function mapMoistureMode(label) {
    const v = label.trim().toLowerCase();
    if (v.startsWith("сух"))
        return "dry";
    if (v.startsWith("влаж"))
        return "wet";
    return "normal";
}
function mapOperationCondition(label) {
    const v = label.trim().toUpperCase();
    if (v.startsWith("А") || v.startsWith("A"))
        return "A";
    return "B";
}
/**
 * Универсальное допущение про методику qrad, которое всегда добавляется в
 * блок проектных допущений, когда qrad нельзя предъявить как расчётное.
 */
export const SOLAR_GAIN_METHODOLOGY_ASSUMPTION = {
    key: "energy.solarGain.methodology",
    label: "Солнечные теплопоступления",
    value: "методика требует уточнения; значение не использовано как расчётное.",
    source: "demo-default",
};
