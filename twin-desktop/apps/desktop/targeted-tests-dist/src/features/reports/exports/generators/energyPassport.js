import { escapeHtml, renderAssumptionsBlock, renderDataTable, renderDocumentStatusBlock, renderGostStamp, renderGostTitlePage, renderSignatureBlock, wrapHtmlDocument, DEMO_DEFAULT_VALUE_MARK, } from "../helpers";
import { REPORT_EXPORT_TEMPLATE_MARKER, REPORT_EXPORT_TITLE } from "../types";
const DOCUMENT_LABEL = "Энергетический паспорт проекта здания";
const ROW_KEY_TO_ASSUMPTION = {
    "ep-1-object": "meta.name",
    "ep-1-purpose": "thermalProtection.buildingCategory",
    "ep-2-city": "climate.city",
    "ep-2-indoor": "climate.indoorTemperatureC",
    "ep-2-humidity": "climate.indoorRelativeHumidityPercent",
};
export function generateEnergyPassportHtml(data, options = {}) {
    const titlePage = renderGostTitlePage(data.meta, DOCUMENT_LABEL);
    const appliedKeys = new Set((options.appliedAssumptions ?? [])
        .filter((entry) => entry.source === "demo-default")
        .map((entry) => entry.key));
    const sections = [
        data.generalInfo,
        data.designConditions,
        data.geometryIndicators,
        data.thermalIndicators,
        data.auxIndicators,
        data.specificCharacteristics,
        data.coefficients,
        data.complexIndicators,
        data.energyLoads,
    ]
        .map((section) => renderSection(section, data.showFactColumn, appliedKeys))
        .join("\n");
    const body = `
${titlePage}
${renderDocumentStatusBlock(data.preflight, { includeIssues: true, includeWarnings: true })}
${renderInfoSection("ep-doc", "Сведения о документе", data.documentInfo)}
${renderInfoSection("ep-source", "Источник заполнения данных", data.sourceInfo)}
${renderInfoSection("ep-basis", "Основание заполнения", data.basisInfo)}
${renderInputRegisterSection("ep-registry", "Ведомость исходных данных", data.expertise.inputRegisterRows, data.expertise.showIncompleteFields)}
<section>
  <p>${escapeHtml(data.factColumnNote)}</p>
</section>
${sections}
${renderBulletSection("ep-software", "Сведения о программном расчёте", data.expertise.softwareInfoLines)}
${renderBulletSection("ep-limitations", "Ограничения применения расчёта", data.expertise.limitations)}
${renderAssumptionsBlock(options.appliedAssumptions, { id: "ep-assumptions" })}
${renderSignatureBlock(data.meta)}
${renderGostStamp(data.meta, DOCUMENT_LABEL)}
`;
    return wrapHtmlDocument(REPORT_EXPORT_TEMPLATE_MARKER["energy-passport"], REPORT_EXPORT_TITLE["energy-passport"], body);
}
function renderInfoSection(id, title, rows) {
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${renderDataTable(null, [
        { label: "Показатель", width: "45%" },
        { label: "Значение", width: "55%" },
    ], rows.map((row) => ({ cells: [row.label, row.value] })))}
</section>`.trim();
}
function renderInputRegisterSection(id, title, rows, showIncompleteFields) {
    const visibleRows = rows.filter((row) => showIncompleteFields || row.status !== "не заполнено");
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${renderDataTable(null, [
        { label: "Параметр", width: "36%" },
        { label: "Значение", width: "26%" },
        { label: "Источник", width: "22%" },
        { label: "Статус", width: "16%" },
    ], visibleRows.map((row) => ({
        cells: [row.label, row.value, row.source, row.status],
    })))}
</section>`.trim();
}
function renderBulletSection(id, title, lines) {
    if (!lines.length) {
        return "";
    }
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
</section>`.trim();
}
function markValueIfAssumed(rowKey, value, appliedKeys) {
    const assumptionKey = ROW_KEY_TO_ASSUMPTION[rowKey];
    if (!assumptionKey || !appliedKeys.has(assumptionKey)) {
        return value;
    }
    return `${value}${DEMO_DEFAULT_VALUE_MARK}`;
}
function renderSection(section, showFactColumn, appliedKeys) {
    const columns = [
        { label: "Показатель", width: showFactColumn ? "34%" : "40%" },
        { label: "Ед. изм.", width: "10%", align: "center" },
        { label: "Нормируемое значение", align: "right" },
        { label: "Расчётное проектное значение", align: "right" },
    ];
    if (showFactColumn) {
        columns.push({ label: "Фактическое значение", align: "right" });
    }
    return `
<section id="${escapeHtml(section.id)}">
  <h3 class="rx-section-title">${escapeHtml(section.title)}</h3>
  ${renderDataTable(null, columns, section.rows.map((row) => ({
        cells: showFactColumn
            ? [
                row.label,
                row.unit || "—",
                row.normValue,
                markValueIfAssumed(row.key, row.designValue, appliedKeys),
                row.factValue,
            ]
            : [
                row.label,
                row.unit || "—",
                row.normValue,
                markValueIfAssumed(row.key, row.designValue, appliedKeys),
            ],
    })))}
</section>`.trim();
}
