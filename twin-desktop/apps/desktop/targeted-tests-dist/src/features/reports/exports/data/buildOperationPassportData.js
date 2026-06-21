import { REPORT_EXPORT_NO_DATA, } from "../helpers";
export function buildOperationPassportData(base) {
    const { meta, expertise, preflight, reportMetrics, envelopeView } = base;
    const isDraft = !(expertise.fieldMap.daySetpointC.isFilled ||
        expertise.fieldMap.nightSetpointC.isFilled ||
        reportMetrics.peakHeatLoadKW !== null);
    const draftReason = isDraft
        ? "Проектный паспорт сформирован без подтверждённого эксплуатационного сценария и требует уточнения эксплуатационных сведений."
        : "";
    const documentInfo = {
        id: "op-doc",
        title: "Сведения о документе",
        rows: [
            row("op-doc-title", "Наименование документа", "Паспорт проектных теплотехнических характеристик"),
            row("op-doc-object", "Объект", expertise.fieldMap.projectName.value),
            row("op-doc-code", "Шифр документации", expertise.fieldMap.projectCipher.value),
            row("op-doc-stage", "Стадия", expertise.fieldMap.documentStage.value),
            row("op-doc-generated", "Дата формирования", meta.generatedAtLabel),
            row("op-doc-status", "Статус документа", preflight.statusLabel),
        ],
    };
    const sourceRegisterRows = expertise.inputRegisterRows.filter((rowEntry) => [
        "projectName",
        "objectAddress",
        "projectCipher",
        "documentStage",
        "buildingPurpose",
        "heatedArea",
        "heatedVolume",
        "ventilationAch",
        "infiltrationAch",
        "mechanicalVentilation",
        "heatRecoveryEfficiencyPercent",
    ].includes(rowEntry.key) &&
        (expertise.showIncompleteFields || rowEntry.status !== "не заполнено"));
    const objectInfo = {
        id: "op-1",
        title: "1 Общие сведения об объекте",
        rows: [
            row("op-1-object", "Наименование объекта", expertise.fieldMap.projectName.value),
            row("op-1-address", "Адрес", expertise.fieldMap.objectAddress.value),
            row("op-1-purpose", "Назначение здания", expertise.fieldMap.buildingPurpose.value),
            row("op-1-customer", "Заказчик", expertise.fieldMap.customerOrg.value),
            row("op-1-developer", "Проектная организация", expertise.fieldMap.developerOrg.value),
        ],
    };
    const geometryInfo = {
        id: "op-2",
        title: "2 Геометрические показатели",
        rows: [
            row("op-2-storeys", "Этажность", expertise.fieldMap.floorsCount.value),
            row("op-2-levels", "Количество уровней", formatValue(reportMetrics.levelCount, 0)),
            row("op-2-rooms", "Количество помещений", formatValue(reportMetrics.roomCount, 0)),
            row("op-2-area", "Отапливаемая площадь, м²", formatValue(reportMetrics.heatedAreaM2, 2)),
            row("op-2-volume", "Отапливаемый объём, м³", formatValue(reportMetrics.heatedVolumeM3, 2)),
        ],
    };
    const constructionInfo = {
        id: "op-3",
        title: "3 Конструктивные показатели оболочки",
        rows: [
            row("op-3-elements", "Количество элементов наружной оболочки", formatValue(envelopeView.includedElements.length, 0)),
            row("op-3-kob", "kоб расчётное, Вт/(м³·К)", formatValue(reportMetrics.kobActual_W_m3K, 3)),
            row("op-3-kobNorm", "kоб нормативное, Вт/(м³·К)", formatValue(reportMetrics.kobNorm_W_m3K, 3)),
            row("op-3-kobStatus", "Статус проверки kоб", reportMetrics.kobStatus),
            row("op-3-elementStatus", "Поэлементная проверка оболочки", reportMetrics.envelopeElementFailures.length
                ? `есть замечания: ${reportMetrics.envelopeElementFailures
                    .map((entry) => entry.designation)
                    .join(", ")}`
                : "замечаний не выявлено"),
        ],
    };
    const engineeringSystems = {
        id: "op-4",
        title: "4 Инженерные системы",
        rows: [
            row("op-4-heating", "Отопление", "Проектные тепловые нагрузки сформированы по цифровой модели и расчётному сценарию."),
            row("op-4-ventilation", "Механическая вентиляция", reportMetrics.mechanicalVentilation === null ? REPORT_EXPORT_NO_DATA : reportMetrics.mechanicalVentilation ? "да" : "нет"),
            row("op-4-ventilationAch", "Кратность вентиляции, 1/ч", formatValue(reportMetrics.ventilationAch, 3)),
            row("op-4-infiltrationAch", "Кратность инфильтрации, 1/ч", formatValue(reportMetrics.infiltrationAch, 3)),
            row("op-4-heatRecovery", "Коэффициент рекуперации", formatValue(reportMetrics.heatRecoveryFactor, 2)),
        ],
    };
    const designLoads = {
        id: "op-5",
        title: "5 Проектные нагрузки",
        rows: [
            row("op-5-peak", "Расчётная пиковая тепловая нагрузка, кВт", formatValue(reportMetrics.peakHeatLoadKW, 2)),
            row("op-5-specificPeak", "Удельная пиковая нагрузка, Вт/м²", formatValue(reportMetrics.specificPeakLoad_W_m2, 1)),
            row("op-5-totalEnergy", "Тепловая энергия за расчётный период, кВт·ч", formatValue(reportMetrics.totalHeatEnergyKWh, 1)),
            row("op-5-specificEnergy", "Удельная энергия за расчётный период, кВт·ч/м²", formatValue(reportMetrics.specificEnergyKWh_m2, 2)),
        ],
    };
    const thermalIndicators = {
        id: "op-6",
        title: "6 Теплотехнические характеристики",
        rows: [
            row("op-6-qHeating", "qот расчётное, Вт/(м³·К)", formatValue(reportMetrics.qHeatingCharacteristic_W_m3K, 3)),
            row("op-6-qNorm", "qот нормативное, кВт·ч/м²", formatValue(reportMetrics.qHeatingNorm_kWh_m2, 2)),
            row("op-6-qStatus", "Статус проверки qот", reportMetrics.qHeatingStatus),
        ],
    };
    const energyIndicators = {
        id: "op-7",
        title: "7 Энергетические показатели",
        rows: [
            row("op-7-annualHeating", "Годовой расход тепловой энергии, кВт·ч", formatValue(reportMetrics.annualHeatingEnergy_kWh, 1)),
            row("op-7-annualLosses", "Годовые теплопотери оболочки, кВт·ч", formatValue(reportMetrics.annualEnvelopeLosses_kWh, 1)),
            row("op-7-qByArea", "Удельный расход по площади, кВт·ч/м²", formatValue(reportMetrics.qByArea_kWh_m2, 2)),
            row("op-7-qByVolume", "Удельный расход по объёму, кВт·ч/м³", formatValue(reportMetrics.qByVolume_kWh_m3, 3)),
        ],
    };
    const recommendations = {
        id: "op-8",
        title: "8 Рекомендации по эксплуатации",
        intro: "Раздел носит проектный характер и используется как ориентир для дальнейшей эксплуатации после ввода объекта в работу.",
        rows: [
            row("op-8-rule-1", "Поддержание расчётного режима", "Поддерживать проектные параметры воздухообмена и температурные уставки, принятые в расчёте."),
            row("op-8-rule-2", "Контроль оболочки", "Контролировать сохранность ограждающих конструкций, светопрозрачных заполнений и дверных узлов."),
            row("op-8-rule-3", "Актуализация паспорта", "После обследования и ввода в эксплуатацию паспорт может быть дополнен фактическими показателями."),
        ],
    };
    const operationRules = {
        id: "op-legacy-operation",
        title: "Сведения эксплуатационной стадии",
        intro: "На проектной стадии эксплуатационные реквизиты показываются справочно и не определяют статус нормативной проверки.",
        rows: [
            row("op-6-records", "Журнал эксплуатации", expertise.fieldMap.journalName.value),
            row("op-6-monitoring", "Контроль температурного режима", expertise.fieldMap.temperatureControlRule.value),
            row("op-6-inspection", "Периодичность осмотров", expertise.fieldMap.inspectionFrequency.value),
            row("op-6-responsible", "Ответственный за эксплуатацию", expertise.fieldMap.operationResponsible.value),
            row("op-6-notes", "Примечания по эксплуатации", expertise.fieldMap.operationNotes.value),
        ],
    };
    const appendicesRows = [
        row("op-app-operationOrg", "Эксплуатирующая организация", expertise.fieldMap.operationOrg.value, "Показывается в приложении на проектной стадии."),
        row("op-app-journalName", "Журнал эксплуатации", expertise.fieldMap.journalName.value, "Показывается в приложении на проектной стадии."),
        row("op-app-inspectionFrequency", "Периодичность осмотров", expertise.fieldMap.inspectionFrequency.value, "Показывается в приложении на проектной стадии."),
        row("op-app-temperatureControl", "Контроль температурного режима", expertise.fieldMap.temperatureControlRule.value, "Показывается в приложении на проектной стадии."),
        row("op-app-operationResponsible", "Ответственный за эксплуатацию", expertise.fieldMap.operationResponsible.value, "Показывается в приложении на проектной стадии."),
        row("op-app-operationNotes", "Примечания по эксплуатации", expertise.fieldMap.operationNotes.value, "Показывается в приложении на проектной стадии."),
    ].filter((entry) => expertise.showIncompleteFields || entry.value !== "не заполнено пользователем");
    return {
        meta,
        expertise,
        preflight,
        isDraft,
        draftReason,
        documentInfo,
        sourceRegisterRows,
        objectInfo,
        geometryInfo,
        constructionInfo,
        engineeringSystems,
        designLoads,
        thermalIndicators,
        energyIndicators,
        recommendations,
        operationRules,
        clarificationLines: [
            ...expertise.clarificationLines,
            ...preflight.issues.map((issue) => issue.message),
        ],
        appendices: [
            {
                id: "op-app-a",
                title: "Приложение А. Сведения, относимые к эксплуатационной стадии",
                rows: appendicesRows,
            },
        ],
    };
}
function row(key, label, value, note) {
    return { key, label, value, note };
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
