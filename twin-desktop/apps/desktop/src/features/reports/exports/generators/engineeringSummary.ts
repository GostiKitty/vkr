/**
 * HTML-генератор для «Краткого инженерного заключения».
 *
 * 1–3 страницы, без тяжёлого штампа.
 */

import {
  escapeHtml,
  renderAssumptionsBlock,
  renderDataTable,
  REPORT_EXPORT_RC_DISCLAIMER,
  wrapHtmlDocument,
} from "../helpers";
import { REPORT_EXPORT_TEMPLATE_MARKER, REPORT_EXPORT_TITLE } from "../types";
import type { EngineeringSummaryData } from "../data/buildEngineeringSummaryData";
import type { AssumptionEntry } from "../defaults/demoHouseDesignDefaults";

const DOCUMENT_LABEL = "Краткое инженерное заключение";

export function generateEngineeringSummaryHtml(
  data: EngineeringSummaryData,
  options: { appliedAssumptions?: AssumptionEntry[] } = {}
): string {
  const body = `
<section>
  <h1>${escapeHtml(DOCUMENT_LABEL)}</h1>
  <p>${escapeHtml(data.meta.documentStage)} · Дата формирования: ${escapeHtml(data.meta.generatedAtLabel)}</p>
</section>
<section id="es-1">
  <h3 class="rx-section-title">1 Объект</h3>
  ${renderDataTable(
    null,
    [
      { label: "Показатель", width: "30%" },
      { label: "Значение", width: "70%" },
    ],
    data.objectRows.map((r) => ({ cells: [r.label, r.value] }))
  )}
</section>
<section id="es-2">
  <h3 class="rx-section-title">2 Ключевые исходные данные</h3>
  ${renderDataTable(
    null,
    [
      { label: "Показатель", width: "55%" },
      { label: "Значение", align: "right" },
    ],
    data.sourceRows.map((r) => ({ cells: [r.label, r.value] }))
  )}
</section>
<section id="es-3">
  <h3 class="rx-section-title">3 Главные расчётные показатели</h3>
  ${renderDataTable(
    null,
    [
      { label: "Показатель", width: "55%" },
      { label: "Значение", align: "right" },
    ],
    data.resultRows.map((r) => ({ cells: [r.label, r.value] }))
  )}
</section>
<section id="es-4">
  <h3 class="rx-section-title">4 Соответствие требованиям</h3>
  ${data.complianceLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
</section>
<section id="es-5">
  <h3 class="rx-section-title">5 Риски</h3>
  <ul>${data.riskLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
</section>
<section id="es-6">
  <h3 class="rx-section-title">6 Рекомендации</h3>
  <ul>${data.recommendationLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
</section>
<section>
  <p class="rx-note">${escapeHtml(REPORT_EXPORT_RC_DISCLAIMER)}</p>
  <p>Разработал: ${escapeHtml(data.meta.developedBy)} · Проверил: ${escapeHtml(data.meta.checkedBy)}</p>
</section>
${renderAssumptionsBlock(options.appliedAssumptions, { id: "es-assumptions" })}
`;
  return wrapHtmlDocument(
    REPORT_EXPORT_TEMPLATE_MARKER["engineering-summary"],
    REPORT_EXPORT_TITLE["engineering-summary"],
    body
  );
}
