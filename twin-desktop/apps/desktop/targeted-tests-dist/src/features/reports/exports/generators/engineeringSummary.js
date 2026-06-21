import { escapeHtml, renderAssumptionsBlock, renderDataTable, renderDocumentStatusBlock, renderGostStamp, renderGostTitlePage, renderSignatureBlock, wrapHtmlDocument, } from "../helpers";
import { REPORT_EXPORT_TEMPLATE_MARKER, REPORT_EXPORT_TITLE } from "../types";
export function generateEngineeringSummaryHtml(data, options = {}) {
    const titlePage = renderGostTitlePage(data.meta, data.title);
    const body = `
${titlePage}
${renderDocumentStatusBlock(data.preflight, { includeIssues: true, includeWarnings: true })}
<section id="es-1">
  <h3 class="rx-section-title">1 Объект</h3>
  ${renderDataTable(null, [
        { label: "Показатель", width: "36%" },
        { label: "Значение", width: "64%" },
    ], data.objectRows.map((row) => ({ cells: [row.label, row.value] })))}
</section>
<section id="es-2">
  <h3 class="rx-section-title">2 Ключевые исходные данные</h3>
  ${renderDataTable(null, [
        { label: "Показатель", width: "55%" },
        { label: "Значение", align: "right" },
    ], data.sourceRows.map((row) => ({ cells: [row.label, row.value] })))}
</section>
<section id="es-3">
  <h3 class="rx-section-title">3 Главные расчётные показатели</h3>
  ${renderDataTable(null, [
        { label: "Показатель", width: "55%" },
        { label: "Значение", align: "right" },
    ], data.resultRows.map((row) => ({ cells: [row.label, row.value] })))}
</section>
<section id="es-4">
  <h3 class="rx-section-title">4 Заключение</h3>
  ${data.conclusionLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
</section>
<section id="es-5">
  <h3 class="rx-section-title">5 Риски и замечания</h3>
  <ul>${data.riskLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
</section>
<section id="es-6">
  <h3 class="rx-section-title">6 Рекомендации</h3>
  <ul>${data.recommendationLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
</section>
${renderAssumptionsBlock(options.appliedAssumptions, { id: "es-assumptions" })}
${renderSignatureBlock(data.meta)}
${renderGostStamp(data.meta, data.title)}
`;
    return wrapHtmlDocument(REPORT_EXPORT_TEMPLATE_MARKER["engineering-summary"], REPORT_EXPORT_TITLE["engineering-summary"], body);
}
