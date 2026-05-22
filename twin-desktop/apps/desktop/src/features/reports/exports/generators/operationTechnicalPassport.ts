/**
 * HTML-генератор для «Эксплуатационно-технического паспорта».
 */

import {
  escapeHtml,
  renderAssumptionsBlock,
  renderDataTable,
  renderGostStamp,
  renderGostTitlePage,
  renderSignatureBlock,
  wrapHtmlDocument,
} from "../helpers";
import { REPORT_EXPORT_TEMPLATE_MARKER, REPORT_EXPORT_TITLE } from "../types";
import type {
  OperationPassportData,
  OperationPassportSection,
} from "../data/buildOperationPassportData";
import type { AssumptionEntry } from "../defaults/demoHouseDesignDefaults";

const DOCUMENT_LABEL = "Эксплуатационно-технический паспорт";

export function generateOperationTechnicalPassportHtml(
  data: OperationPassportData,
  options: { appliedAssumptions?: AssumptionEntry[] } = {}
): string {
  const titlePage = renderGostTitlePage(
    data.meta,
    DOCUMENT_LABEL,
    data.isDraft ? "Справочный проектный экземпляр" : undefined
  );
  const draftBanner = data.isDraft
    ? `<section><span class="rx-draft-banner">Справочный документ</span><p class="rx-note">${escapeHtml(data.draftReason)}</p></section>`
    : "";

  const sections = [
    renderSection(data.documentInfo),
    renderInputRegisterSection(
      "op-registry",
      "Ведомость исходных данных",
      data.sourceRegisterRows,
      data.expertise.showIncompleteFields
    ),
    renderSection(data.generalInfo),
    renderSection(data.buildingInfo),
    renderSection(data.engineeringSystems),
    renderSection(data.designLoads),
    renderCombinedThermalSection(data),
    renderSection(data.operationRules),
    renderClarificationSection(data),
    renderBulletSection("op-software", "Сведения о программном расчёте", data.expertise.softwareInfoLines),
    renderBulletSection("op-limitations", "Ограничения применения расчёта", data.expertise.limitations),
    renderPackageSection("op-package", "Состав сформированного комплекта", data.expertise.packageRows),
  ]
    .filter(Boolean)
    .join("\n");

  const appendices = data.appendices
    .map(
      (appendix) =>
        `<section id="${escapeHtml(appendix.id)}"><h3 class="rx-section-title">${escapeHtml(appendix.title)}</h3>${renderDataTable(
          null,
          [
            { label: "Показатель", width: "55%" },
            { label: "Значение", align: "right" },
          ],
          appendix.rows.map((row) => ({ cells: [row.label, row.value] }))
        )}</section>`
    )
    .join("\n");

  const body = `
${titlePage}
${draftBanner}
${sections}
${appendices}
${renderAssumptionsBlock(options.appliedAssumptions, { id: "op-assumptions" })}
${renderSignatureBlock(data.meta)}
${renderGostStamp(data.meta, DOCUMENT_LABEL)}
`;

  return wrapHtmlDocument(
    REPORT_EXPORT_TEMPLATE_MARKER["operation-technical-passport"],
    REPORT_EXPORT_TITLE["operation-technical-passport"],
    body
  );
}

function renderSection(section: OperationPassportSection): string {
  return `
<section id="${escapeHtml(section.id)}">
  <h3 class="rx-section-title">${escapeHtml(section.title)}</h3>
  ${section.intro ? `<p>${escapeHtml(section.intro)}</p>` : ""}
  ${renderDataTable(
    null,
    [
      { label: "Показатель", width: "55%" },
      { label: "Значение", align: "right" },
    ],
    section.rows.map((row) => ({ cells: [row.label, row.value] }))
  )}
</section>`.trim();
}

function renderInputRegisterSection(
  id: string,
  title: string,
  rows: Array<{ key: string; label: string; value: string; source: string; status: string }>,
  showIncompleteFields: boolean
): string {
  const visibleRows = rows.filter(
    (row) => showIncompleteFields || row.status !== "не заполнено"
  );
  return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${renderDataTable(
    null,
    [
      { label: "Параметр", width: "36%" },
      { label: "Значение", width: "26%" },
      { label: "Источник", width: "22%" },
      { label: "Статус", width: "16%" },
    ],
    visibleRows.map((row) => ({
      cells: [row.label, row.value, row.source, row.status],
    }))
  )}
</section>`.trim();
}

function renderClarificationSection(data: OperationPassportData): string {
  return `
<section id="op-clarifications">
  <h3 class="rx-section-title">Перечень данных, требующих уточнения</h3>
  ${
    data.clarificationLines.length
      ? `<ul>${data.clarificationLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
      : "<p>Критических пробелов в исходных данных не выявлено.</p>"
  }
</section>`.trim();
}

function renderBulletSection(id: string, title: string, lines: string[]): string {
  if (!lines.length) {
    return "";
  }
  return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  <ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
</section>`.trim();
}

function renderPackageSection(
  id: string,
  title: string,
  rows: Array<{ label: string; value: string }>
): string {
  return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${renderDataTable(
    null,
    [
      { label: "№", width: "12%", align: "center" },
      { label: "Наименование документа", width: "88%" },
    ],
    rows.map((row) => ({ cells: [row.label, row.value] }))
  )}
</section>`.trim();
}

function renderCombinedThermalSection(data: OperationPassportData): string {
  return `
<section id="op-5">
  <h3 class="rx-section-title">5 Энергетические характеристики здания</h3>
  ${renderSection(data.thermalEnergyChars)}
  ${renderSection(data.energyIndicators)}
</section>`.trim();
}
