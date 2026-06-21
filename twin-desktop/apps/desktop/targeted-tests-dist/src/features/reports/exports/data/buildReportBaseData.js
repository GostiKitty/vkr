/**
 * Общая база данных для всех типов выгрузки.
 *
 * Этот модуль агрегирует уже существующие источники истины
 * (BuildingModel, CalculationPassportData, Sp50ComplianceReport, ScenarioConfig)
 * и формирует унифицированный пакет данных. Он не запускает новых расчётов
 * и не модифицирует BuildingModel.
 */
import { polygonArea } from "../../../../entities/geometry/geom";
import { buildAdjacencyGraph } from "../../../../core/graph/adjacency";
import { firstDisplayText, isBrokenDisplayText, looksLikeInternalId, sanitizeDisplayText, } from "../../../../shared/utils/displayText";
import { buildCalculationPassportData, } from "../../calculationPassportData";
import { SOLAR_GAIN_METHODOLOGY_ASSUMPTION } from "../defaults/demoHouseDesignDefaults";
import { buildExpertiseContext, } from "./buildExpertiseContext";
import { buildExportEnvelopeView, } from "./buildExportEnvelopeView";
const NOT_SET = "не задано";
const ALL_REPORT_DOCUMENTS = [
    "project-ov-ts",
    "thermal-protection",
    "energy-passport",
    "operation-technical-passport",
    "engineering-summary",
];
const PLACEHOLDER_PATTERNS = [
    "не заполнено пользователем",
    "недостаточно данных",
    "placeholder",
    "требует уточнения",
];
const FINAL_FORBIDDEN_VALUE_PATTERNS = [
    "demo",
    "РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅ",
    "С‡РµСЂРЅРѕРІРёРє",
    "placeholder",
];
export function buildReportBaseData(input) {
    const passport = buildCalculationPassportData({
        model: input.model,
        projectId: input.projectId,
        scenarioConfig: input.scenarioConfig,
        thermalResult: input.thermalResult,
        monteCarloResult: input.monteCarloResult,
    });
    const draftMeta = buildReportMeta({
        passport,
        reportMeta: input.reportMeta,
        model: input.model,
        projectId: input.projectId,
        generatedAt: input.generatedAt,
    });
    const appliedAssumptions = mergeAssumptions(input.appliedAssumptions ?? [], detectAutoAssumptions(passport.sp50Report));
    const dynamicResultState = input.dynamicResultState ?? (input.thermalResult ? "provided" : "missing");
    const expertise = buildExpertiseContext({
        passport,
        draftMeta,
        reportMeta: input.reportMeta,
        inputs: input.expertiseInputs,
        scenarioConfig: input.scenarioConfig,
        appliedAssumptions,
    });
    const envelopeView = buildExportEnvelopeView({
        model: input.model,
        constructions: passport.sp50Report?.constructions ?? [],
        heatedVolumeM3: passport.summary.totalVolumeM3,
        kobNorm: passport.sp50Report?.building.kobNorm_W_m3K ?? null,
        outdoorDesignTemperatureC: passport.climate.outdoorDesignTemperatureC,
    });
    const reportMetrics = buildReportMetrics(passport, expertise, envelopeView);
    const preflight = buildReportPreflight({
        model: input.model,
        passport,
        expertise,
        envelopeView,
        reportMetrics,
        appliedAssumptions,
    });
    const meta = {
        ...draftMeta,
        ...expertise.documentMetaOverrides,
        modelVersion: resolveModelVersion(expertise, passport, draftMeta),
    };
    return {
        passport,
        sp50Report: passport.sp50Report,
        meta,
        expertise,
        envelopeView,
        reportMetrics,
        preflight,
        appliedAssumptions,
        source: {
            model: input.model,
            projectId: input.projectId,
            scenarioConfig: input.scenarioConfig,
            thermalResult: input.thermalResult,
            monteCarloResult: input.monteCarloResult,
            reportMeta: input.reportMeta,
            generatedAt: input.generatedAt,
            dynamicResultState,
            expertiseInputs: expertise.inputs,
        },
    };
}
/**
 * Авто-определяемые допущения, которые добавляются без участия профиля demo:
 * например, когда qrad по СП 50 не получается посчитать корректно и поле
 * показывается как «требует уточнения методики».
 */
function detectAutoAssumptions(sp50Report) {
    const result = [];
    const hasConstructions = (sp50Report?.constructions?.length ?? 0) > 0;
    if (hasConstructions && sp50Report?.energy) {
        const solar = sp50Report.energy.solarGainCharacteristic_W_m3K ?? null;
        const formatted = solar !== null && Number.isFinite(solar)
            ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(solar)
            : null;
        const isZeroOrMissing = solar === null ||
            !Number.isFinite(solar) ||
            (formatted !== null && /^[−\-]?0([.,]0+)?$/.test(formatted.trim()));
        if (isZeroOrMissing) {
            result.push(SOLAR_GAIN_METHODOLOGY_ASSUMPTION);
        }
    }
    return result;
}
function mergeAssumptions(base, extras) {
    const seen = new Set(base.map((entry) => entry.key));
    const result = [...base];
    for (const entry of extras) {
        if (!seen.has(entry.key)) {
            seen.add(entry.key);
            result.push(entry);
        }
    }
    return result;
}
function buildReportMeta(input) {
    const { passport, reportMeta, model, generatedAt } = input;
    const cityFromMeta = sanitizeDisplayText(reportMeta.documentCity, "", { allowInternalId: false });
    const cityFromClimate = passport.climate.city ?? "";
    const fallbackCity = cityFromMeta || cityFromClimate || "—";
    return {
        organization: textOrNotSet(reportMeta.developerOrg),
        customer: textOrNotSet(reportMeta.customerOrg),
        objectName: textOrNotSet(passport.projectName),
        address: textOrNotSet(reportMeta.buildingAddress),
        documentCode: resolveDocumentCode(model, reportMeta),
        documentStage: resolveStageLabel(reportMeta.documentStage),
        documentCity: fallbackCity,
        year: String(generatedAt.getFullYear()),
        generatedAtLabel: formatGeneratedAt(generatedAt),
        developedBy: resolveResponsiblePerson(model, ["developedBy", "author", "developer"]),
        checkedBy: resolveResponsiblePerson(model, ["checkedBy", "reviewer", "checker"]),
        normControl: resolveResponsiblePerson(model, ["normControl", "normokontrol", "normController"]),
        chiefEngineer: resolveResponsiblePerson(model, ["gip", "chiefEngineer", "projectEngineer"]),
        modelVersion: passport.modelVersion ?? NOT_SET,
    };
}
function textOrNotSet(value) {
    const sanitized = sanitizeDisplayText(value, "", { allowInternalId: false });
    return sanitized || NOT_SET;
}
function resolveDocumentCode(model, reportMeta) {
    const meta = model.meta ?? {};
    const fromModel = firstDisplayText([meta["documentCode"], meta["designation"], meta["cipher"], meta["projectCipher"]], "", { allowInternalId: true });
    const sanitized = sanitizeDisplayText(fromModel || reportMeta.projectCipher, "", {
        allowInternalId: true,
    });
    return sanitized || "б/н";
}
function resolveStageLabel(stageValue) {
    const normalized = sanitizeDisplayText(stageValue, "", { allowInternalId: true }).toLowerCase();
    if (!normalized) {
        return "Проектная документация";
    }
    if (normalized === "п" || normalized.includes("проект")) {
        return "Проектная документация";
    }
    if (normalized === "р" || normalized.includes("рабоч")) {
        return "Рабочая документация";
    }
    return sanitizeDisplayText(stageValue, "Проектная документация", { allowInternalId: true });
}
function resolveResponsiblePerson(model, keys) {
    const meta = model.meta ?? {};
    const values = keys.map((key) => meta[key]);
    for (const value of values) {
        if (typeof value !== "string") {
            continue;
        }
        const trimmed = value.trim();
        if (trimmed === "—" || trimmed === "-") {
            return "—";
        }
        const resolved = sanitizeDisplayText(trimmed, "", { allowInternalId: false });
        if (resolved) {
            return resolved;
        }
    }
    return NOT_SET;
}
function formatGeneratedAt(value) {
    return new Intl.DateTimeFormat("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(value);
}
function resolveModelVersion(expertise, passport, draftMeta) {
    const field = expertise.fieldMap.modelVersion;
    if (field?.source === "user-input" && field.rawValue) {
        return field.value;
    }
    if (passport.modelVersion) {
        return passport.modelVersion;
    }
    if (expertise.exportMode === "strict-expertise") {
        return draftMeta.modelVersion;
    }
    return "сформирована автоматически";
}
function buildReportMetrics(passport, expertise, envelopeView) {
    const energy = passport.sp50Report?.energy ?? null;
    return {
        heatedAreaM2: preferFieldNumber(expertise.fieldMap.heatedArea.rawValue, passport.summary.totalAreaM2),
        heatedVolumeM3: preferFieldNumber(expertise.fieldMap.heatedVolume.rawValue, passport.summary.totalVolumeM3),
        roomCount: passport.summary.roomCount,
        levelCount: passport.summary.levelCount,
        climateCity: preferFieldText(expertise.fieldMap.climateCity.rawValue, passport.climate.city),
        outdoorDesignTemperatureC: preferFieldNumber(expertise.fieldMap.outdoorDesignTemperatureC.rawValue, passport.climate.outdoorDesignTemperatureC),
        outdoorHeatingAverageC: preferFieldNumber(expertise.fieldMap.outdoorHeatingAverageC.rawValue, passport.climate.outdoorHeatingAverageC),
        heatingDurationDays: preferFieldNumber(expertise.fieldMap.heatingDurationDays.rawValue, passport.climate.heatingDurationDays),
        gsop: preferFieldNumber(expertise.fieldMap.gsop.rawValue, passport.sp50Report?.sourceData.gsop ?? null),
        humidityZone: preferFieldText(expertise.fieldMap.humidityZone.rawValue, passport.climate.humidityZone),
        indoorDesignTemperatureC: preferFieldNumber(expertise.fieldMap.indoorDesignTemperatureC.rawValue, passport.climate.indoorTemperatureC),
        indoorRelativeHumidityPercent: preferFieldNumber(expertise.fieldMap.indoorRelativeHumidityPercent.rawValue, passport.sp50Report?.sourceData.indoorRelativeHumidityPercent ?? null),
        ventilationAch: preferFieldNumber(expertise.fieldMap.ventilationAch.rawValue, passport.operation.ventilationACH),
        infiltrationAch: preferFieldNumber(expertise.fieldMap.infiltrationAch.rawValue, passport.operation.infiltrationACH),
        mechanicalVentilation: preferYesNoBoolean(expertise.fieldMap.mechanicalVentilation.rawValue, passport.operation.mechanicalVentilationEnabled),
        heatRecoveryFactor: preferFieldNumber(expertise.fieldMap.heatRecoveryEfficiencyPercent.rawValue, passport.operation.heatRecoveryFactor),
        peakHeatLoadKW: passport.thermalResults.peakLoadKW,
        specificPeakLoad_W_m2: passport.thermalResults.specificPeakLoad_W_m2,
        totalHeatEnergyKWh: passport.thermalResults.totalEnergyKWh,
        specificEnergyKWh_m2: passport.thermalResults.specificEnergyKWh_m2,
        kobActual_W_m3K: envelopeView.kobActual,
        kobNorm_W_m3K: envelopeView.kobNorm,
        kobStatus: envelopeView.kobStatus,
        qHeatingCharacteristic_W_m3K: energy?.qHeatingCharacteristic_W_m3K ?? null,
        qHeatingNorm_kWh_m2: energy?.qHeatingNorm_kWh_m2 ?? null,
        annualHeatingEnergy_kWh: energy?.annualHeatingEnergy_kWh ?? null,
        annualEnvelopeLosses_kWh: energy?.annualTotalLosses_kWh ?? null,
        qByArea_kWh_m2: energy?.qByArea_kWh_m2 ?? null,
        qByVolume_kWh_m3: energy?.qByVolume_kWh_m3 ?? null,
        qHeatingStatus: mapEnergyStatus(energy?.status, energy?.complies),
        usesPlaceholderInputs: Boolean(energy?.usesPlaceholderInputs),
        envelopeElementFailures: envelopeView.criticalElements.map((entry) => ({
            designation: entry.designation,
            name: entry.name,
            typeLabel: entry.typeLabel,
        })),
        envelopeElementsNeedingClarification: envelopeView.includedElements
            .filter((entry) => entry.status === "требует уточнения" ||
            entry.status === "требует проверки классификации")
            .map((entry) => ({
            designation: entry.designation,
            name: entry.name,
            typeLabel: entry.typeLabel,
        })),
    };
}
function buildReportPreflight(input) {
    const generationMode = input.expertise.exportMode === "strict-expertise" ? "final" : "draft";
    const issues = [];
    const requiredFields = new Set();
    const addIssue = (severity, code, message, affectedDocuments = ALL_REPORT_DOCUMENTS) => {
        issues.push({ severity, code, message, affectedDocuments });
    };
    input.expertise.readiness.criticalMissing.forEach((field) => {
        requiredFields.add(field.label);
    });
    if (generationMode === "final") {
        [
            "Проверил",
            "Нормоконтроль",
            "ГИП",
            "Основание для проектирования",
            "Номер договора / задания",
        ].forEach((label) => requiredFields.add(label));
    }
    if (generationMode === "final" && input.expertise.readiness.criticalMissing.length) {
        addIssue("error", "required-fields-missing", `Не заполнены обязательные поля: ${input.expertise.readiness.criticalMissing
            .map((field) => field.label)
            .join(", ")}.`);
    }
    const signatureFields = [
        input.expertise.fieldMap.checkedBy,
        input.expertise.fieldMap.normControl,
        input.expertise.fieldMap.chiefEngineer,
    ];
    if (generationMode === "final" &&
        signatureFields.some((field) => !field.isFilled || field.value === "—")) {
        addIssue("error", "signature-missing", "Не заполнены обязательные подписанты: Проверил, Нормоконтроль, ГИП.");
    }
    if (generationMode === "final" && looksLikePlaceholder(input.expertise.fieldMap.designBasis.value)) {
        addIssue("error", "design-basis-missing", "Не указано корректное основание для проектирования.");
    }
    if (generationMode === "final" && looksLikePlaceholder(input.expertise.fieldMap.contractNumber.value)) {
        addIssue("error", "contract-number-missing", "Не указан номер договора / задания.");
    }
    if (generationMode === "final" &&
        (input.appliedAssumptions.length > 0 ||
            input.expertise.fields.some((field) => field.source === "demo-default" && field.importance !== "optional"))) {
        addIssue("error", "demo-assumptions", "Финальная выгрузка недопустима при наличии demo-допущений или автозаполненных placeholder-значений.");
    }
    if (generationMode === "final" &&
        (input.expertise.fieldMap.ventilationAch.source === "demo-default" ||
            input.expertise.fieldMap.infiltrationAch.source === "demo-default")) {
        addIssue("error", "ventilation-demo-assumptions", "Вентиляция и/или инфильтрация приняты как demo-допущение, а не как проектные данные.");
    }
    if (generationMode === "final" && input.reportMetrics.usesPlaceholderInputs) {
        addIssue("error", "placeholder-energy-inputs", "qот, kоб и годовые энергетические показатели рассчитаны на основе placeholder-данных.");
    }
    const openingsWithoutThermalData = input.envelopeView.includedElements.filter((entry) => (entry.category === "window" || entry.category === "external-door") &&
        (entry.uValue === null ||
            (entry.actualResistance === null && entry.reducedResistance === null) ||
            !entry.typeLabel.trim()));
    if (generationMode === "final" && openingsWithoutThermalData.length) {
        addIssue("error", "opening-thermal-data-missing", `Не заданы Rфакт/U для проёмов: ${openingsWithoutThermalData
            .map((entry) => entry.designation || entry.name)
            .join(", ")}.`);
    }
    const doorsWithoutNorm = input.envelopeView.includedElements.filter((entry) => entry.category === "external-door" && entry.normalizedResistance === null);
    if (generationMode === "final" && doorsWithoutNorm.length) {
        addIssue("error", "door-rnorm-missing", `Не указано Rнорм для наружных дверей: ${doorsWithoutNorm
            .map((entry) => entry.designation || entry.name)
            .join(", ")}.`);
    }
    if (generationMode === "final" && input.reportMetrics.envelopeElementFailures.length) {
        addIssue("error", "envelope-element-fail", `Поэлементная проверка оболочки не соответствует: ${input.reportMetrics.envelopeElementFailures
            .map((entry) => `${entry.designation} (${entry.typeLabel})`)
            .join(", ")}.`);
    }
    const unnamedRooms = input.model.rooms.filter((room) => {
        const name = typeof room.name === "string" ? room.name.trim() : "";
        return !name || isBrokenDisplayText(name) || looksLikeInternalId(name);
    });
    if (generationMode === "final" && unnamedRooms.length) {
        addIssue("error", "room-name-missing", `В модели есть помещения без корректного наименования: ${unnamedRooms
            .map((room) => room.id)
            .join(", ")}.`);
    }
    const adjacency = buildAdjacencyGraph(input.model);
    const geometryIssues = input.model.rooms.filter((room) => {
        const area = Math.abs(polygonArea(room.polygon));
        const hasNeighbor = (adjacency.neighbors[room.id]?.length ?? 0) > 0;
        const hasExternal = adjacency.external.some((edge) => edge.roomId === room.id);
        return !Number.isFinite(area) || area <= 0 || (!hasNeighbor && !hasExternal);
    });
    if (generationMode === "final" && geometryIssues.length) {
        addIssue("error", "geometry-connectivity-unverified", `Геометрическая связность помещений не подтверждена для: ${geometryIssues
            .map((room) => room.name || room.id)
            .join(", ")}.`);
    }
    const placeholderFields = input.expertise.fields.filter((field) => field.importance !== "optional" && looksLikePlaceholder(field.value));
    if (generationMode === "final" && placeholderFields.length) {
        addIssue("error", "placeholder-fields", `В обязательных полях остались незавершённые значения: ${placeholderFields
            .map((field) => field.label)
            .join(", ")}.`);
    }
    const forbiddenFinalFields = input.expertise.fields.filter((field) => field.importance !== "optional" && containsForbiddenFinalValue(field.value));
    if (generationMode === "final" && forbiddenFinalFields.length) {
        addIssue("error", "final-forbidden-field-values", `Р’ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… РїРѕР»СЏС… РѕСЃС‚Р°Р»РёСЃСЊ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Рµ РёР»Рё СЃР»СѓР¶РµР±РЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ: ${forbiddenFinalFields
            .map((field) => field.label)
            .join(", ")}.`);
    }
    if (generationMode === "final" && input.reportMetrics.envelopeElementsNeedingClarification.length) {
        addIssue("error", "envelope-clarification-needed", `Часть оболочки требует уточнения: ${input.reportMetrics.envelopeElementsNeedingClarification
            .map((entry) => `${entry.designation} (${entry.typeLabel})`)
            .join(", ")}.`);
    }
    if (generationMode === "final" && input.passport.thermalResults.available === false) {
        addIssue("warning", "dynamic-result-missing", "Динамический RC-результат не получен; инженерная часть комплекта будет сформирована без динамической диагностики.");
    }
    const blockingIssues = issues.filter((issue) => issue.severity === "error");
    const warningIssues = issues.filter((issue) => issue.severity === "warning");
    const readyForFinalRelease = generationMode === "final" ? blockingIssues.length === 0 : false;
    const status = resolveReleaseStatus({
        exportMode: input.expertise.exportMode,
        hasBlockingIssues: blockingIssues.length > 0,
    });
    return {
        generationMode,
        status,
        statusLabel: formatReleaseStatus(status),
        summary: buildPreflightSummary({
            status,
            readyForFinalRelease,
            blockingIssues,
            warningIssues,
        }),
        readyForFinalRelease,
        issues,
        blockingIssues,
        warningIssues,
        blockedDocuments: generationMode === "final" && blockingIssues.length > 0 ? ALL_REPORT_DOCUMENTS : [],
        requiredFields: Array.from(requiredFields).sort((left, right) => left.localeCompare(right, "ru")),
    };
}
function resolveReleaseStatus(input) {
    if (input.exportMode === "strict-expertise") {
        return input.hasBlockingIssues ? "not-ready" : "ready";
    }
    if (input.exportMode === "vkr-brief") {
        return "for-review";
    }
    return "draft";
}
function buildPreflightSummary(input) {
    if (input.status === "ready" && input.readyForFinalRelease) {
        return "Комплект готов к финальной выгрузке.";
    }
    if (input.status === "not-ready") {
        return `Финальная выгрузка заблокирована: ${input.blockingIssues.length} критич. замечаний.`;
    }
    if (input.status === "for-review") {
        return "Комплект сформирован для проверки; перед выпуском нужен final preflight.";
    }
    if (input.warningIssues.length > 0) {
        return `Сформирован черновик: ${input.warningIssues.length} позиций требуют проверки.`;
    }
    return "Сформирован черновой комплект.";
}
function formatReleaseStatus(status) {
    switch (status) {
        case "ready":
            return "Готово к выпуску";
        case "not-ready":
            return "Не готово к выпуску";
        case "for-review":
            return "Для проверки";
        default:
            return "Черновик";
    }
}
function mapEnergyStatus(status, complies) {
    if (complies === true || status === "pass") {
        return "соответствует";
    }
    if (complies === false || status === "fail") {
        return "не соответствует";
    }
    return "требует уточнения";
}
function preferFieldNumber(rawValue, fallback) {
    const parsed = parseNumericValue(rawValue);
    return parsed ?? finiteOrNull(fallback);
}
function preferFieldText(rawValue, fallback) {
    if (typeof rawValue === "string") {
        const sanitized = sanitizeDisplayText(rawValue, "", { allowInternalId: false });
        if (sanitized) {
            return sanitized;
        }
    }
    return sanitizeDisplayText(fallback, "", { allowInternalId: false }) || null;
}
function preferYesNoBoolean(rawValue, fallback) {
    if (rawValue === true || rawValue === false) {
        return rawValue;
    }
    if (typeof rawValue === "string") {
        const normalized = rawValue.trim().toLowerCase();
        if (normalized === "yes" || normalized === "да") {
            return true;
        }
        if (normalized === "no" || normalized === "нет") {
            return false;
        }
    }
    return typeof fallback === "boolean" ? fallback : null;
}
function parseNumericValue(rawValue) {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        return rawValue;
    }
    if (typeof rawValue !== "string") {
        return null;
    }
    const normalized = rawValue
        .replace(/\s+/g, "")
        .replace(/,/g, ".")
        .replace(/−/g, "-");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
}
function finiteOrNull(value) {
    return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}
function looksLikePlaceholder(value) {
    if (!value) {
        return true;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === "—" || normalized === "-" || normalized === NOT_SET) {
        return true;
    }
    return PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}
function containsForbiddenFinalValue(value) {
    if (!value) {
        return false;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    return FINAL_FORBIDDEN_VALUE_PATTERNS.some((pattern) => normalized.includes(pattern));
}
