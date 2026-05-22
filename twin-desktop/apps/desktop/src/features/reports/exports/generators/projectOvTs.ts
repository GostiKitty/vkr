/**
 * HTML-генератор для «Раздел 5. ОВ/ТС».
 */

import {
  escapeHtml,
  renderAssumptionsBlock,
  renderBibliography,
  renderDataTable,
  renderGostStamp,
  renderGostTitlePage,
  renderSignatureBlock,
  renderToc,
  REPORT_EXPORT_RC_DISCLAIMER,
  wrapHtmlDocument,
} from "../helpers";
import { REPORT_EXPORT_TEMPLATE_MARKER, REPORT_EXPORT_TITLE } from "../types";
import type { ProjectOvTsData } from "../data/buildProjectOvTsData";

const DOCUMENT_LABEL = "Расчётно-пояснительные материалы. Раздел 5 ОВ/ТС";

export function generateProjectOvTsHtml(
  data: ProjectOvTsData,
  options: { appliedAssumptions?: import("../defaults/demoHouseDesignDefaults").AssumptionEntry[] } = {}
): string {
  const titlePage = renderGostTitlePage(data.meta, DOCUMENT_LABEL, data.subsectionTitle);
  const toc = [
    { id: "ovts-registry", label: "Ведомость исходных данных" },
    { id: "ovts-1", label: "1 Общие положения" },
    { id: "ovts-2", label: "2 Основания для выполнения расчёта" },
    { id: "ovts-3", label: "3 Исходные климатические условия" },
    { id: "ovts-4", label: "4 Сведения об объекте и цифровой модели" },
    { id: "ovts-5", label: "5 Сведения о системах отопления и вентиляции" },
    { id: "ovts-6", label: "6 Расчётные тепловые нагрузки" },
    { id: "ovts-7", label: "7 Теплотехнические характеристики ограждающих конструкций" },
    { id: "ovts-8", label: "8 Энергетические показатели" },
    { id: "ovts-9", label: "9 Выводы и рекомендации" },
    { id: "ovts-10", label: "10 Перечень данных, требующих уточнения" },
    { id: "ovts-app-a", label: "Приложение А. Ведомость ограждающих конструкций" },
    { id: "ovts-app-b", label: "Приложение Б. Подробные расчётные таблицы" },
    { id: "ovts-app-v", label: "Приложение В. Справочная динамическая RC-оценка" },
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
    {
      key: "modelNote",
      label: "Примечание к цифровой модели",
      unit: "",
      value: data.expertise.fieldMap.modelNote.value,
      note: data.expertise.fieldMap.modelNote.sourceLabel,
    },
  ].filter((row) => data.expertise.showIncompleteFields || row.value !== "не заполнено пользователем");

  const body = `
${titlePage}
${renderToc(toc)}
<section>
  <p class="rx-section-meta"><strong>Раздел:</strong> ${escapeHtml(data.sectionTitle)}</p>
  <p class="rx-section-meta"><strong>Подраздел:</strong> ${escapeHtml(data.subsectionTitle)}</p>
</section>
${renderInputRegisterSection("ovts-registry", "Ведомость исходных данных", data.expertise.inputRegisterRows, data.expertise.showIncompleteFields)}
${renderTextSection("ovts-1", "1 Общие положения", data.generalProvisions)}
${renderMetricSection("ovts-2", "2 Основания для выполнения расчёта", basisRows)}
${renderBulletSection("ovts-software", "Сведения о программном расчёте", data.expertise.softwareInfoLines)}
${renderMetricSection("ovts-3", "3 Исходные климатические условия", data.climateRows)}
${renderMetricSection("ovts-4", "4 Сведения об объекте и цифровой модели", data.objectSummaryRows)}
${renderMetricSection("ovts-5", "5 Сведения о системах отопления и вентиляции", data.heatingVentSummaryRows)}
${renderMetricSection("ovts-6", "6 Расчётные тепловые нагрузки", data.thermalLoadRows)}
${renderEnvelopeGroups("ovts-7", data.envelopeGroupRows)}
${renderMetricSection("ovts-8", "8 Энергетические показатели", data.energyRows)}
<section id="ovts-9">
  <h3 class="rx-section-title">9 Выводы и рекомендации</h3>
  ${data.conclusions.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
  <p class="rx-note">${escapeHtml(REPORT_EXPORT_RC_DISCLAIMER)}</p>
</section>
<section id="ovts-10">
  <h3 class="rx-section-title">10 Перечень данных, требующих уточнения</h3>
  ${
    data.missingData.length
      ? `<ul>${data.missingData.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
      : "<p>Критических пробелов в исходных данных не выявлено.</p>"
  }
</section>
${renderBulletSection("ovts-limitations", "Ограничения применения расчёта", data.expertise.limitations)}
${renderPackageSection("ovts-package", "Состав сформированного комплекта", data.expertise.packageRows)}
${renderEnvelopeAppendix(data.appendixEnvelopeRows)}
${renderDetailedAppendix(data.appendixDetailedRows)}
${renderRcAppendix(data.rcDynamicRows, data.rcDynamicAvailable)}
${renderAssumptionsBlock(options.appliedAssumptions, { id: "ovts-assumptions" })}
${renderBibliography([
  { id: "1", label: "СП 50.13330.2024. Тепловая защита зданий." },
  { id: "2", label: "СП 60.13330.2020. Отопление, вентиляция и кондиционирование воздуха." },
  { id: "3", label: "СП 131.13330.2020. Строительная климатология." },
  { id: "4", label: "Постановление Правительства РФ № 87 от 16.02.2008." },
  { id: "5", label: "ГОСТ Р 21.101. Система проектной документации для строительства." },
])}
${renderSignatureBlock(data.meta)}
${renderGostStamp(data.meta, DOCUMENT_LABEL)}
`;

  return wrapHtmlDocument(
    REPORT_EXPORT_TEMPLATE_MARKER["project-ov-ts"],
    REPORT_EXPORT_TITLE["project-ov-ts"],
    body
  );
}

function renderTextSection(id: string, title: string, lines: string[]): string {
  return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
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

function renderMetricSection(
  id: string,
  title: string,
  rows: Array<{ key: string; label: string; unit: string; value: string; note?: string }>
): string {
  return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  ${renderDataTable(
    null,
    [
      { label: "Показатель", width: "48%" },
      { label: "Ед. изм.", width: "12%", align: "center" },
      { label: "Значение", width: "22%", align: "right" },
      { label: "Примечание", width: "18%" },
    ],
    rows.map((row) => ({
      cells: [row.label, row.unit || "—", row.value, row.note || "—"],
    }))
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
      { label: "Параметр", width: "38%" },
      { label: "Значение", width: "24%" },
      { label: "Источник", width: "22%" },
      { label: "Статус", width: "16%" },
    ],
    visibleRows.map((row) => ({
      cells: [row.label, row.value, row.source, row.status],
    }))
  )}
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

function renderEnvelopeGroups(id: string, rows: ProjectOvTsData["envelopeGroupRows"]): string {
  return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">7 Теплотехнические характеристики ограждающих конструкций</h3>
  ${renderDataTable(
    "Сводная таблица по типам конструкций",
    [
      { label: "Тип конструкции", width: "30%" },
      { label: "Количество", align: "right" },
      { label: "Площадь, м²", align: "right" },
      { label: "Rнорм", align: "right" },
      { label: "Rфакт", align: "right" },
      { label: "U", align: "right" },
      { label: "Статус", width: "14%" },
    ],
    rows.map((row) => ({
      cells: [
        row.typeLabel,
        row.count,
        row.area,
        row.weightedRequiredResistance,
        row.weightedActualResistance,
        row.weightedUValue,
        row.status,
      ],
    })),
    {
      footnote:
        "Полный перечень элементов наружной оболочки приведён в приложении А. В основной части документа показаны сводные группы конструкций.",
    }
  )}
</section>`.trim();
}

function renderEnvelopeAppendix(rows: ProjectOvTsData["appendixEnvelopeRows"]): string {
  return `
<section id="ovts-app-a">
  <h3 class="rx-section-title">Приложение А. Ведомость ограждающих конструкций</h3>
  ${renderDataTable(
    null,
    [
      { label: "Обозначение", width: "10%" },
      { label: "Наименование", width: "20%" },
      { label: "Тип", width: "16%" },
      { label: "Площадь, м²", align: "right" },
      { label: "Rнорм", align: "right" },
      { label: "Rфакт", align: "right" },
      { label: "Статус", width: "14%" },
      { label: "ID модели", width: "12%" },
      { label: "Примечание", width: "18%" },
    ],
    rows.map((row) => ({
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
    }))
  )}
</section>`.trim();
}

function renderDetailedAppendix(rows: ProjectOvTsData["appendixDetailedRows"]): string {
  return `
<section id="ovts-app-b">
  <h3 class="rx-section-title">Приложение Б. Подробные расчётные таблицы</h3>
  ${renderDataTable(
    null,
    [
      { label: "Показатель", width: "55%" },
      { label: "Ед. изм.", width: "15%", align: "center" },
      { label: "Значение", align: "right" },
    ],
    rows.map((row) => ({ cells: [row.label, row.unit || "—", row.value] }))
  )}
</section>`.trim();
}

function renderRcAppendix(rows: ProjectOvTsData["rcDynamicRows"], available: boolean): string {
  const note = `<p class="rx-note">${escapeHtml(REPORT_EXPORT_RC_DISCLAIMER)}</p>`;
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
  ${renderDataTable(
    null,
    [
      { label: "Показатель", width: "55%" },
      { label: "Ед. изм.", width: "15%", align: "center" },
      { label: "Значение", align: "right" },
    ],
    rows.map((row) => ({ cells: [row.label, row.unit || "—", row.value] }))
  )}
</section>`.trim();
}
