import { sanitizeDisplayText } from "../../../../shared/utils/displayText";
import { humanizeProjectText } from "./exportText";
const NO_DATA = "недостаточно данных";
export function buildEngineeringSummaryData(base) {
    const { meta, passport, reportMetrics, preflight, expertise } = base;
    const failedElements = reportMetrics.envelopeElementFailures;
    const integralPass = reportMetrics.kobStatus === "соответствует" &&
        reportMetrics.qHeatingStatus === "соответствует";
    const objectRows = [
        row("name", "Объект", expertise.fieldMap.projectName.value),
        row("address", "Адрес", expertise.fieldMap.objectAddress.value),
        row("customer", "Заказчик", expertise.fieldMap.customerOrg.value),
        row("developer", "Проектная организация", expertise.fieldMap.developerOrg.value),
        row("generated", "Дата формирования", meta.generatedAtLabel),
        row("status", "Статус документа", preflight.statusLabel),
    ];
    const sourceRows = [
        row("city", "Город / климатическая база", reportMetrics.climateCity ?? NO_DATA),
        row("indoor", "Внутренняя температура, °C", valueOrNoData(reportMetrics.indoorDesignTemperatureC, 1)),
        row("outdoor", "Наружная температура, °C", valueOrNoData(reportMetrics.outdoorDesignTemperatureC, 1)),
        row("area", "Отапливаемая площадь, м²", valueOrNoData(reportMetrics.heatedAreaM2, 2)),
        row("volume", "Отапливаемый объём, м³", valueOrNoData(reportMetrics.heatedVolumeM3, 2)),
        row("ventilation", "Кратность вентиляции, 1/ч", valueOrNoData(reportMetrics.ventilationAch, 3)),
        row("infiltration", "Кратность инфильтрации, 1/ч", valueOrNoData(reportMetrics.infiltrationAch, 3)),
    ];
    const resultRows = [
        row("kob", "kоб расчётное, Вт/(м³·К)", valueOrNoData(reportMetrics.kobActual_W_m3K, 3)),
        row("kobNorm", "kоб нормативное, Вт/(м³·К)", valueOrNoData(reportMetrics.kobNorm_W_m3K, 3)),
        row("qHeating", "qот расчётное, Вт/(м³·К)", valueOrNoData(reportMetrics.qHeatingCharacteristic_W_m3K, 3)),
        row("peakLoad", "Расчётная пиковая нагрузка, кВт", valueOrNoData(reportMetrics.peakHeatLoadKW, 2)),
        row("annualHeating", "Годовой расход тепловой энергии, кВт·ч", valueOrNoData(reportMetrics.annualHeatingEnergy_kWh, 1)),
    ];
    let variant = "auditSummary";
    let title = "Инженерное заключение";
    const conclusionLines = [];
    const recommendationLines = [];
    if (preflight.readyForFinalRelease) {
        variant = "finalConclusion";
        if (integralPass && failedElements.length === 0) {
            conclusionLines.push("Проектные решения по тепловой защите здания и расчётные энергетические показатели соответствуют установленным нормативным требованиям.");
        }
        else if (integralPass && failedElements.length > 0) {
            conclusionLines.push(`Соответствует по интегральным показателям. Требуется устранить несоответствие поэлементной проверки: ${failedElements
                .map((entry) => `${entry.designation} (${entry.typeLabel})`)
                .join(", ")}.`);
        }
        else {
            conclusionLines.push("До корректировки проектных решений по оболочке и инженерным параметрам нормативное соответствие не подтверждено.");
        }
        conclusionLines.push("Документ может быть использован как итоговое инженерное заключение в составе расчётно-пояснительных материалов.");
    }
    else if (preflight.blockingIssues.length > 0) {
        variant = "incompleteDataConclusion";
        title = "Заключение о неполноте исходных данных";
        conclusionLines.push("Финальное инженерное заключение не может быть выдано, поскольку обязательные исходные данные и проверки не завершены.");
        conclusionLines.push(`Выявлены критические замечания: ${preflight.blockingIssues
            .map((issue) => issue.message)
            .join(" ")}`);
    }
    else {
        conclusionLines.push("Документ сформирован как audit summary и предназначен для проверки полноты исходных данных и промежуточной оценки проектных решений.");
    }
    const riskLines = buildRiskLines(passport.problemZones, base.source.model);
    if (reportMetrics.usesPlaceholderInputs) {
        riskLines.push("Энергетические показатели опираются на placeholder-данные по воздухообмену и требуют актуализации.");
    }
    if (!passport.thermalResults.available) {
        riskLines.push("Динамический расчёт теплового режима отсутствует.");
        riskLines.push("Инженерная оценка выполнена без RC-диагностики.");
    }
    if (preflight.blockingIssues.length > 0) {
        riskLines.push(...preflight.blockingIssues.map((issue) => issue.message));
    }
    if (!riskLines.length) {
        riskLines.push("Критические риски по исходным данным и расчётным показателям не выявлены.");
    }
    if (failedElements.length > 0) {
        recommendationLines.push(`Устранить несоответствия по оболочке: ${failedElements
            .map((entry) => entry.designation)
            .join(", ")}.`);
    }
    if (reportMetrics.usesPlaceholderInputs) {
        recommendationLines.push("Задать подтверждённые проектные параметры вентиляции и инфильтрации для окончательной энергетической оценки.");
    }
    if (preflight.blockingIssues.length > 0) {
        recommendationLines.push("Устранить критические замечания preflight-проверки перед финальной выгрузкой комплекта.");
    }
    if (!recommendationLines.length) {
        recommendationLines.push("Поддерживать согласованность цифровой модели, расчётных параметров и реквизитов проекта при выпуске итогового комплекта.");
    }
    return {
        meta,
        preflight,
        variant,
        title,
        objectRows,
        sourceRows,
        resultRows,
        conclusionLines,
        riskLines,
        recommendationLines,
    };
}
function row(key, label, value) {
    return { key, label, value };
}
function valueOrNoData(value, digits) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return NO_DATA;
    }
    return new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    }).format(value);
}
function buildRiskLines(problemZones, model) {
    const result = [];
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
function normalizeRiskLine(value) {
    const trimmed = sanitizeDisplayText(value.replace(/\s+:/g, ":").replace(/:\s*:/g, ": ").replace(/\.\.+/g, "."), "", { allowInternalId: false }).trim();
    if (!trimmed) {
        return "";
    }
    return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}
