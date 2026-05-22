/**
 * HTML-генератор документа «Расчёт тепловой защиты здания».
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
import type { ThermalProtectionData } from "../data/buildThermalProtectionData";

const DOCUMENT_LABEL = "Расчёт тепловой защиты здания (СП 50.13330)";

export function generateThermalProtectionHtml(
  data: ThermalProtectionData,
  options: { appliedAssumptions?: import("../defaults/demoHouseDesignDefaults").AssumptionEntry[] } = {}
): string {
  const titlePage = renderGostTitlePage(data.meta, DOCUMENT_LABEL);

  const body = `
${titlePage}
${renderToc(data.toc)}
${renderInputRegisterSection("tp-registry", "Ведомость исходных данных", data.expertise.inputRegisterRows, data.expertise.showIncompleteFields)}
${renderMetricSection("tp-1", "1 Исходные климатические данные", data.climateRows)}
${renderMetricSection("tp-2", "2 Геометрические показатели здания", data.geometryRows)}
${renderMetricSection("tp-3", "3 Состав наружных ограждающих конструкций", data.envelopeCompositionRows)}
${renderResistanceSection(data)}
${renderReducedResistanceSection(data)}
${renderKobSection(data)}
${renderEnergyCharacteristicSection(data)}
${renderComplianceSection(data)}
${renderConclusionsSection(data)}
${renderClarificationSection(data)}
${renderBulletSection("tp-software", "Сведения о программном расчёте", data.expertise.softwareInfoLines)}
${renderBulletSection("tp-limitations", "Ограничения применения расчёта", data.expertise.limitations)}
${renderPackageSection("tp-package", "Состав сформированного комплекта", data.expertise.packageRows)}
${renderCompositionAppendix(data)}
${renderEnvelopeAppendix(data)}
${renderKobAppendix(data)}
<section><p class="rx-note">${escapeHtml(REPORT_EXPORT_RC_DISCLAIMER)}</p></section>
${renderAssumptionsBlock(options.appliedAssumptions, { id: "tp-assumptions" })}
${renderBibliography([
  { id: "1", label: "СП 50.13330.2024. Тепловая защита зданий." },
  { id: "2", label: "СП 131.13330.2020. Строительная климатология." },
  { id: "3", label: "СП 23-101-2004. Проектирование тепловой защиты зданий." },
])}
${renderSignatureBlock(data.meta)}
${renderGostStamp(data.meta, DOCUMENT_LABEL)}
`;

  return wrapHtmlDocument(
    REPORT_EXPORT_TEMPLATE_MARKER["thermal-protection"],
    REPORT_EXPORT_TITLE["thermal-protection"],
    body
  );
}

function renderMetricSection(
  id: string,
  title: string,
  rows: Array<{ key: string; label: string; unit: string; value: string }>
): string {
  return `
<section id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
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

function renderResistanceSection(data: ThermalProtectionData): string {
  return `
<section id="tp-4">
  <h3 class="rx-section-title">4 Расчёт сопротивления теплопередаче</h3>
  ${renderDataTable(
    null,
    [
      { label: "Обозначение", width: "11%" },
      { label: "Наименование", width: "24%" },
      { label: "Тип", width: "16%" },
      { label: "Площадь, м²", align: "right" },
      { label: "Rфакт", align: "right" },
      { label: "Rнорм", align: "right" },
      { label: "U", align: "right" },
      { label: "Статус", width: "14%" },
    ],
    data.envelopeResistanceRows.map((row) => ({
      cells: [
        row.designation,
        row.name,
        row.typeLabel,
        row.area,
        row.actualResistance,
        row.requiredResistance,
        row.uValue,
        row.status,
      ],
    }))
  )}
</section>`.trim();
}

function renderReducedResistanceSection(data: ThermalProtectionData): string {
  return `
<section id="tp-5">
  <h3 class="rx-section-title">5 Проверка приведённого сопротивления теплопередаче</h3>
  <p>Проверка приведённого сопротивления теплопередаче выполняется по фрагментам оболочки здания. Детализированные результаты приведены в таблице раздела 4 и в приложениях.</p>
  ${renderDataTable(
    "Сводная проверка по группам конструкций",
    [
      { label: "Показатель", width: "60%" },
      { label: "Значение", align: "right" },
    ],
    data.complianceRows.map((row) => ({ cells: [row.label, row.value] }))
  )}
</section>`.trim();
}

function renderKobSection(data: ThermalProtectionData): string {
  return `
<section id="tp-6">
  <h3 class="rx-section-title">6 Расчёт удельной теплозащитной характеристики kоб</h3>
  ${renderDataTable(
    "Фрагменты оболочки и их вклад в kоб",
    [
      { label: "Обозначение", width: "11%" },
      { label: "Фрагмент оболочки", width: "27%" },
      { label: "nt", width: "8%", align: "right" },
      { label: "A, м²", align: "right" },
      { label: "Rприв", align: "right" },
      { label: "nt·A/Rприв", align: "right" },
      { label: "Доля, %", align: "right" },
    ],
    data.kobFragmentRows.map((row) => ({
      cells: [
        row.designation,
        row.fragment,
        row.nt,
        row.area,
        row.reducedResistance,
        row.contribution,
        row.share,
      ],
    }))
  )}
  <p><strong>kоб расчётное:</strong> ${escapeHtml(data.kobSummary.kobActual)} Вт/(м³·К);
  <strong>kоб нормативное:</strong> ${escapeHtml(data.kobSummary.kobNorm)} Вт/(м³·К);
  <strong>статус:</strong> ${escapeHtml(data.kobSummary.status)}.</p>
</section>`.trim();
}

function renderEnergyCharacteristicSection(data: ThermalProtectionData): string {
  return `
<section id="tp-7">
  <h3 class="rx-section-title">7 Расчёт энергетической характеристики qот</h3>
  ${renderDataTable(
    null,
    [
      { label: "Показатель", width: "55%" },
      { label: "Ед. изм.", width: "15%", align: "center" },
      { label: "Значение", align: "right" },
    ],
    data.energyCharacteristicRows.map((row) => ({
      cells: [row.label, row.unit || "—", row.value],
    }))
  )}
</section>`.trim();
}

function renderComplianceSection(data: ThermalProtectionData): string {
  return `
<section id="tp-8">
  <h3 class="rx-section-title">8 Проверка соответствия требованиям</h3>
  ${renderDataTable(
    null,
    [
      { label: "Показатель", width: "60%" },
      { label: "Статус", align: "right" },
    ],
    data.complianceRows.map((row) => ({ cells: [row.label, row.value] }))
  )}
</section>`.trim();
}

function renderConclusionsSection(data: ThermalProtectionData): string {
  return `
<section id="tp-9">
  <h3 class="rx-section-title">9 Выводы</h3>
  ${data.conclusions.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
</section>`.trim();
}

function renderClarificationSection(data: ThermalProtectionData): string {
  return `
<section id="tp-10">
  <h3 class="rx-section-title">10 Перечень данных, требующих уточнения</h3>
  ${
    data.notesMissingData.length
      ? `<ul>${data.notesMissingData.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
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

function renderCompositionAppendix(data: ThermalProtectionData): string {
  return `
<section id="tp-app-a">
  <h3 class="rx-section-title">Приложение А. Послойный состав конструкций</h3>
  ${renderDataTable(
    null,
    [
      { label: "Обозначение", width: "10%" },
      { label: "Конструкция", width: "28%" },
      { label: "Слой", width: "24%" },
      { label: "Толщина, мм", align: "right" },
      { label: "λ", align: "right" },
      { label: "R", align: "right" },
      { label: "ID модели", width: "14%" },
    ],
    data.appendixComposition.map((row) => ({
      cells: [
        row.designation,
        row.constructionLabel,
        row.layerLabel,
        row.thicknessMm,
        row.conductivity,
        row.resistance,
        row.modelId,
      ],
    }))
  )}
</section>`.trim();
}

function renderEnvelopeAppendix(data: ThermalProtectionData): string {
  return `
<section id="tp-app-b">
  <h3 class="rx-section-title">Приложение Б. Ведомость элементов оболочки</h3>
  ${renderDataTable(
    null,
    [
      { label: "Обозначение", width: "10%" },
      { label: "Наименование", width: "20%" },
      { label: "Тип", width: "14%" },
      { label: "A, м²", align: "right" },
      { label: "Rфакт", align: "right" },
      { label: "Rнорм", align: "right" },
      { label: "tвн.пов.", align: "right" },
      { label: "Статус", width: "12%" },
      { label: "ID модели", width: "12%" },
      { label: "Примечание", width: "16%" },
    ],
    data.appendixEnvelopeRows.map((row) => ({
      cells: [
        row.designation,
        row.name,
        row.typeLabel,
        row.area,
        row.actualResistance,
        row.requiredResistance,
        row.internalSurfaceTemperature,
        row.status,
        row.modelId,
        row.note,
      ],
    }))
  )}
</section>`.trim();
}

function renderKobAppendix(data: ThermalProtectionData): string {
  return `
<section id="tp-app-v">
  <h3 class="rx-section-title">Приложение В. Расчётные фрагменты оболочки здания</h3>
  ${renderDataTable(
    null,
    [
      { label: "Обозначение", width: "10%" },
      { label: "Фрагмент", width: "26%" },
      { label: "nt", align: "right" },
      { label: "A, м²", align: "right" },
      { label: "Rприв", align: "right" },
      { label: "nt·A/Rприв", align: "right" },
      { label: "Доля, %", align: "right" },
    ],
    data.appendixFragments.map((row) => ({
      cells: [
        row.designation,
        row.fragment,
        row.nt,
        row.area,
        row.reducedResistance,
        row.contribution,
        row.share,
      ],
    }))
  )}
</section>`.trim();
}
