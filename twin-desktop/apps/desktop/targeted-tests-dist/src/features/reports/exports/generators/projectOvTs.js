import { escapeHtml, renderAssumptionsBlock, renderBibliography, renderDataTable, renderDocumentStatusBlock, renderGostStamp, renderGostTitlePage, renderSignatureBlock, renderToc, REPORT_EXPORT_RC_DISCLAIMER, wrapHtmlDocument, } from "../helpers";
import { REPORT_EXPORT_TEMPLATE_MARKER, REPORT_EXPORT_TITLE } from "../types";
const DOCUMENT_LABEL = "Раздел 5. Отопление, вентиляция и тепловые сети";
export function generateProjectOvTsHtml(data, options = {}) {
    const titlePage = renderGostTitlePage(data.meta, DOCUMENT_LABEL, data.subsectionTitle);
    const showRcDisclaimer = data.preflight.generationMode !== "final";
    const toc = [
        { id: "ovts-registry", label: "Ведомость исходных данных" },
        { id: "ovts-status", label: "Статус документа" },
        { id: "ovts-1", label: "1 Общие сведения" },
        { id: "ovts-2", label: "2 Основание для проектирования" },
        { id: "ovts-3", label: "3 Нормативная база" },
        { id: "ovts-4", label: "4 Исходные климатические данные" },
        { id: "ovts-5", label: "5 Характеристика объекта" },
        { id: "ovts-6", label: "6 Проектные решения по отоплению" },
        { id: "ovts-7", label: "7 Проектные решения по вентиляции" },
        { id: "ovts-8", label: "8 Расчётные тепловые нагрузки" },
        { id: "ovts-9", label: "9 Теплотехнические характеристики оболочки" },
        { id: "ovts-10", label: "10 Энергетические показатели" },
        { id: "ovts-11", label: "11 Мероприятия по энергоэффективности" },
        { id: "ovts-12", label: "12 Вывод" },
        { id: "ovts-13", label: "13 Приложения" },
    ];
    const basisRows = [
        {
            key: "basis",
            label: "Основание для проектирования",
            unit: "",
            value: data.expertise.fieldMap.designBasis.value,
            note: data.expertise.fieldMap.designBasis.sourceLabel,
        },
        {
            key: "contract",
            label: "Номер договора / задания",
            unit: "",
            value: data.expertise.fieldMap.contractNumber.value,
            note: data.expertise.fieldMap.contractNumber.sourceLabel,
        },
        {
            key: "scenario",
            label: "Расчётный сценарий",
            unit: "",
            value: data.expertise.fieldMap.calculationScenario.value,
            note: data.expertise.fieldMap.calculationScenario.sourceLabel,
        },
    ];
    const heatingRows = data.heatingVentSummaryRows.filter((row) => ["daySetpoint", "nightSetpoint", "mechVent"].includes(row.key));
    const ventilationRows = data.heatingVentSummaryRows.filter((row) => ["ventilationACH", "infiltrationACH", "heatRecovery", "mechVent"].includes(row.key));
    const body = `
${titlePage}
${renderToc(toc)}
<section>
  <p class="rx-section-meta"><strong>Раздел:</strong> ${escapeHtml(data.sectionTitle)}</p>
  <p class="rx-section-meta"><strong>Подраздел:</strong> ${escapeHtml(data.subsectionTitle)}</p>
</section>
${renderInputRegisterSection("ovts-registry", "Ведомость исходных данных", data.expertise.inputRegisterRows, data.expertise.showIncompleteFields)}
<section id="ovts-status">
  ${renderDocumentStatusBlock(data.preflight, { includeIssues: true, includeWarnings: true })}
</section>
${renderTextSection("ovts-1", "1 Общие сведения", data.generalProvisions)}
${renderMetricSection("ovts-2", "2 Основание для проектирования", basisRows)}
${renderNormativeBaseSection("ovts-3")}
${renderMetricSection("ovts-4", "4 Исходные климатические данные", data.climateRows)}
${renderMetricSection("ovts-5", "5 Характеристика объекта", data.objectSummaryRows)}
${renderHeatingSection("ovts-6", heatingRows)}
${renderMetricSection("ovts-7", "7 Проектные решения по вентиляции", ventilationRows)}
${renderMetricSection("ovts-8", "8 Расчётные тепловые нагрузки", data.thermalLoadRows)}
${renderEnvelopeGroups("ovts-9", data.envelopeGroupRows)}
${renderMetricSection("ovts-10", "10 Энергетические показатели", data.energyRows)}
${renderEfficiencyMeasuresSection("ovts-11")}
<section id="ovts-12">
  <h3 class="rx-section-title">12 Вывод</h3>
  ${data.conclusions.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
  ${showRcDisclaimer ? `<p class="rx-note">${escapeHtml(REPORT_EXPORT_RC_DISCLAIMER)}</p>` : ""}
</section>
<section id="ovts-13">
  <h3 class="rx-section-title">13 Приложения</h3>
  <p>В составе настоящего документа приведены приложения с перечнем ограждающих конструкций, подробными расчётными таблицами и справочной динамической RC-оценкой.</p>
</section>
${renderClarificationSection(data)}
${renderBulletSection("ovts-software", "Сведения о программном расчёте", data.expertise.softwareInfoLines)}
${renderBulletSection("ovts-limitations", "Ограничения применения расчёта", data.expertise.limitations)}
${renderPackageSection("ovts-package", "Состав сформированного комплекта", data.expertise.packageRows)}
${renderEnvelopeAppendix(data.appendixEnvelopeRows)}
${renderDetailedAppendix(data.appendixDetailedRows)}
${renderRcAppendix(data.rcDynamicRows, data.rcDynamicAvailable, showRcDisclaimer)}
${renderAssumptionsBlock(options.appliedAssumptions, { id: "ovts-assumptions" })}
${renderBibliography([
        { id: "1", label: "Постановление Правительства РФ № 87 от 16.02.2008." },
        { id: "2", label: "Градостроительный кодекс Российской Федерации, статья 49." },
        { id: "3", label: "СП 50.13330.2024. Тепловая защита зданий." },
        { id: "4", label: "СП 60.13330. Отопление, вентиляция и кондиционирование воздуха." },
        { id: "5", label: "ГОСТ Р 21.101. Система проектной документации для строительства." },
    ])}
${renderSignatureBlock(data.meta)}
${renderGostStamp(data.meta, DOCUMENT_LABEL)}
`;
    return wrapHtmlDocument(REPORT_EXPORT_TEMPLATE_MARKER["project-ov-ts"], REPORT_EXPORT_TITLE["project-ov-ts"], body);
}
function renderTextSection(id, title, lines) {
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
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
function renderMetricSection(id, title, rows) {
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${renderDataTable(null, [
        { label: "Показатель", width: "48%" },
        { label: "Ед. изм.", width: "12%", align: "center" },
        { label: "Значение", width: "22%", align: "right" },
        { label: "Примечание", width: "18%" },
    ], rows.map((row) => ({
        cells: [row.label, row.unit || "—", row.value, row.note || "—"],
    })))}
</section>`.trim();
}
function renderNormativeBaseSection(id) {
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">3 Нормативная база</h3>
  ${renderDataTable(null, [
        { label: "№", width: "8%", align: "center" },
        { label: "Нормативный документ", width: "56%" },
        { label: "Применение в документе", width: "36%" },
    ], [
        { cells: ["1", "Постановление Правительства РФ № 87", "Состав текстовой части проектной документации"] },
        { cells: ["2", "Градостроительный кодекс РФ, статья 49", "Подготовка материалов для государственной экспертизы"] },
        { cells: ["3", "СП 50.13330.2024", "Теплотехнический расчёт и проверка оболочки"] },
        { cells: ["4", "СП 60.13330", "Проектные решения по отоплению и вентиляции"] },
        { cells: ["5", "ГОСТ / СПДС", "Оформление текстовой части, приложений и подписных листов"] },
    ])}
</section>`.trim();
}
function renderHeatingSection(id, rows) {
    const intro = [
        "Проектные решения по отоплению приняты на основании расчётных тепловых нагрузок, параметров тепловой оболочки и расчётных температурных условий.",
        "Температурные уставки и режим эксплуатации учитываются в составе единого набора проектных метрик.",
    ];
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">6 Проектные решения по отоплению</h3>
  ${intro.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
  ${renderDataTable(null, [
        { label: "Показатель", width: "48%" },
        { label: "Ед. изм.", width: "12%", align: "center" },
        { label: "Значение", width: "22%", align: "right" },
        { label: "Примечание", width: "18%" },
    ], rows.map((row) => ({
        cells: [row.label, row.unit || "—", row.value, row.note || "—"],
    })))}
</section>`.trim();
}
function renderInputRegisterSection(id, title, rows, showIncompleteFields) {
    const visibleRows = rows.filter((row) => showIncompleteFields || row.status !== "не заполнено");
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${renderDataTable(null, [
        { label: "Параметр", width: "38%" },
        { label: "Значение", width: "24%" },
        { label: "Источник", width: "22%" },
        { label: "Статус", width: "16%" },
    ], visibleRows.map((row) => ({
        cells: [row.label, row.value, row.source, row.status],
    })))}
</section>`.trim();
}
function renderPackageSection(id, title, rows) {
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${renderDataTable(null, [
        { label: "№", width: "12%", align: "center" },
        { label: "Наименование документа", width: "88%" },
    ], rows.map((row) => ({ cells: [row.label, row.value] })))}
</section>`.trim();
}
function renderEnvelopeGroups(id, rows) {
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">9 Теплотехнические характеристики оболочки</h3>
  ${renderDataTable("Сводная таблица по типам конструкций", [
        { label: "Тип конструкции", width: "30%" },
        { label: "Количество", align: "right" },
        { label: "Площадь, м²", align: "right" },
        { label: "Rнорм", align: "right" },
        { label: "Rфакт", align: "right" },
        { label: "U", align: "right" },
        { label: "Статус", width: "14%" },
    ], rows.map((row) => ({
        cells: [
            row.typeLabel,
            row.count,
            row.area,
            row.weightedRequiredResistance,
            row.weightedActualResistance,
            row.weightedUValue,
            row.status,
        ],
    })), {
        footnote: "Полный перечень элементов наружной оболочки приведён в приложении А. В основной части документа показаны сводные группы конструкций.",
    })}
</section>`.trim();
}
function renderEfficiencyMeasuresSection(id) {
    return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">11 Мероприятия по энергоэффективности</h3>
  <ul>
    <li>Поддержание требуемых сопротивлений теплопередаче ограждающих конструкций.</li>
    <li>Назначение проектных параметров воздухообмена и инфильтрации без placeholder-допущений в финальной версии.</li>
    <li>Контроль согласованности расчётных нагрузок, показателей kоб и qот во всех документах комплекта.</li>
  </ul>
</section>`.trim();
}
function renderClarificationSection(data) {
    return `
<section id="ovts-clarifications">
  <h3 class="rx-section-title">Перечень данных, требующих уточнения</h3>
  ${data.missingData.length
        ? `<ul>${data.missingData.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
        : "<p>Критических пробелов в исходных данных не выявлено.</p>"}
</section>`.trim();
}
function renderEnvelopeAppendix(rows) {
    return `
<section id="ovts-app-a">
  <h3 class="rx-section-title">Приложение А. Ведомость ограждающих конструкций</h3>
  ${renderDataTable(null, [
        { label: "Обозначение", width: "10%" },
        { label: "Наименование", width: "20%" },
        { label: "Тип", width: "16%" },
        { label: "Площадь, м²", align: "right" },
        { label: "Rнорм", align: "right" },
        { label: "Rфакт", align: "right" },
        { label: "Статус", width: "14%" },
        { label: "ID модели", width: "12%" },
        { label: "Примечание", width: "18%" },
    ], rows.map((row) => ({
        cells: [
            row.designation,
            row.name,
            row.typeLabel,
            row.area,
            row.requiredResistance,
            row.actualResistance,
            row.status,
            row.modelId,
            row.note,
        ],
    })))}
</section>`.trim();
}
function renderDetailedAppendix(rows) {
    return `
<section id="ovts-app-b">
  <h3 class="rx-section-title">Приложение Б. Подробные расчётные таблицы</h3>
  ${renderDataTable(null, [
        { label: "Показатель", width: "55%" },
        { label: "Ед. изм.", width: "15%", align: "center" },
        { label: "Значение", align: "right" },
    ], rows.map((row) => ({ cells: [row.label, row.unit || "—", row.value] })))}
</section>`.trim();
}
function renderRcAppendix(rows, available, showRcDisclaimer) {
    const note = showRcDisclaimer
        ? `<p class="rx-note">${escapeHtml(REPORT_EXPORT_RC_DISCLAIMER)}</p>`
        : "";
    if (!available) {
        return `
<section id="ovts-app-v">
  <h3 class="rx-section-title">Приложение В. Справочная динамическая RC-оценка</h3>
  ${note}
  <p>Динамическая RC-оценка не выполнена. Для формирования данного приложения требуется запуск расчёта зональной RC-модели.</p>
</section>`.trim();
    }
    return `
<section id="ovts-app-v">
  <h3 class="rx-section-title">Приложение В. Справочная динамическая RC-оценка</h3>
  ${note}
  ${renderDataTable(null, [
        { label: "Показатель", width: "55%" },
        { label: "Ед. изм.", width: "15%", align: "center" },
        { label: "Значение", align: "right" },
    ], rows.map((row) => ({ cells: [row.label, row.unit || "—", row.value] })))}
</section>`.trim();
}
