/**
 * Общие HTML/CSS/форматные хелперы для генераторов выгрузки документов.
 *
 * Все хелперы работают только со строками: НЕ обращаются к BuildingModel,
 * солверу, 3D или Monte Carlo напрямую.
 */

import type { AssumptionEntry } from "./defaults/demoHouseDesignDefaults";
import { DEMO_DEFAULT_FOOTNOTE, ASSUMPTIONS_SECTION_TITLE } from "./defaults/demoHouseDesignDefaults";
import type {
  ReportDynamicResultState,
  ReportPreflightResult,
} from "./data/buildReportBaseData";
import type { ReportExportDocumentMeta } from "./types";

export const REPORT_EXPORT_NOT_SET = "не задано";
export const REPORT_EXPORT_NO_DATA = "недостаточно данных";
export const REPORT_EXPORT_NEEDS_CLARIFICATION = "требует уточнения";
export const REPORT_EXPORT_DASH = "—";
export const REPORT_EXPORT_RC_NOT_RUN = "требует запуска динамического расчёта";
export const REPORT_EXPORT_RC_NOT_DEFINED = "не определялось в составе данного документа";

const DISPLAY_ENUM_MAP: Record<string, string> = {
  normal: "нормальная",
  dry: "сухая",
  wet: "влажная",
  verywet: "очень влажная",
  residential: "жилое",
  public: "общественное",
  medical: "медицинское",
  educational: "образовательное",
  preschool: "дошкольное",
  administrative: "административное",
  industrialdry: "производственное (сухой режим)",
  industrialwet: "производственное (влажный режим)",
  industrialhighheat: "производственное (повышенные тепловыделения)",
  agricultural: "сельскохозяйственное",
  storage: "складское",
  "demo-default": "принято по проектному допущению",
  scenario: "принято по расчётному сценарию",
  calculated: "рассчитано",
  "user-meta": "задано пользователем",
  "not-provided": "не задано",
  a: "А",
  b: "Б",
};

export function formatDisplayEnum(
  value: string | null | undefined,
  fallback = REPORT_EXPORT_NOT_SET
): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  const normalized = trimmed
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");
  return DISPLAY_ENUM_MAP[normalized] ?? DISPLAY_ENUM_MAP[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Строгое экранирование HTML. Используется ВСЕГДА для пользовательских значений.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Форматирование числа в RU-локали.
 *
 * Принципиальное поведение для выгрузок:
 * - null/undefined/NaN/Infinity → "недостаточно данных" (а не 0)
 * - 0 → отдельный случай: если treatZeroAsNoData=true, тоже считается "недостаточно данных"
 */
export function formatNumber(
  value: number | null | undefined,
  options: {
    digits?: number;
    fallback?: string;
    treatZeroAsNoData?: boolean;
  } = {}
): string {
  const digits = options.digits ?? 1;
  const fallback = options.fallback ?? REPORT_EXPORT_NO_DATA;

  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  if (options.treatZeroAsNoData && value === 0) {
    return fallback;
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDynamicMetricValue(
  value: number | null | undefined,
  dynamicResultState: ReportDynamicResultState,
  options: {
    digits?: number;
    fallback?: string;
    treatZeroAsNoData?: boolean;
  } = {}
): string {
  if (value !== null && value !== undefined && Number.isFinite(value)) {
    return formatNumber(value, options);
  }
  if (dynamicResultState === "provided" || dynamicResultState === "auto-demo") {
    return options.fallback ?? REPORT_EXPORT_RC_NOT_DEFINED;
  }
  return options.fallback ?? REPORT_EXPORT_RC_NOT_RUN;
}

export function formatArea(value: number | null | undefined): string {
  const formatted = formatNumber(value, { digits: 2 });
  return formatted === REPORT_EXPORT_NO_DATA ? REPORT_EXPORT_NO_DATA : `${formatted} м²`;
}

export function formatVolume(value: number | null | undefined): string {
  const formatted = formatNumber(value, { digits: 2 });
  return formatted === REPORT_EXPORT_NO_DATA ? REPORT_EXPORT_NO_DATA : `${formatted} м³`;
}

/**
 * Форматирование статуса соответствия. Возвращает "недостаточно данных" если данных нет.
 */
export function formatStatus(
  complies: boolean | null | undefined,
  hasData: boolean = true
): string {
  if (!hasData) {
    return REPORT_EXPORT_NO_DATA;
  }
  if (complies === true) {
    return "соответствует";
  }
  if (complies === false) {
    return "не соответствует";
  }
  return REPORT_EXPORT_NEEDS_CLARIFICATION;
}

/**
 * Возвращает значение, если оно непустое, иначе "не задано".
 */
export function textOrNotSet(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return REPORT_EXPORT_NOT_SET;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : REPORT_EXPORT_NOT_SET;
}

/**
 * Возвращает значение, если оно непустое, иначе "недостаточно данных".
 */
export function textOrNoData(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return REPORT_EXPORT_NO_DATA;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : REPORT_EXPORT_NO_DATA;
}

/**
 * Колонка таблицы.
 */
export interface ReportTableColumn {
  label: string;
  width?: string;
  align?: "left" | "right" | "center";
}

export interface ReportTableRow {
  cells: Array<string | number | null | undefined>;
  isTotal?: boolean;
}

/**
 * Рендер таблицы данных в HTML с поддержкой колонок, выравнивания и итоговой строки.
 *
 * ВНИМАНИЕ: все значения экранируются через escapeHtml.
 */
export function renderDataTable(
  title: string | null,
  columns: ReportTableColumn[],
  rows: ReportTableRow[],
  options: { footnote?: string } = {}
): string {
  const colgroup = columns
    .map((c) => `<col${c.width ? ` style="width:${escapeHtml(c.width)}"` : ""}/>`)
    .join("");
  const head = columns
    .map((c) => `<th class="rx-th rx-align-${c.align ?? "left"}">${escapeHtml(c.label)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = row.cells
        .map((cell, index) => {
          const align = columns[index]?.align ?? "left";
          const raw = cell === null || cell === undefined || cell === "" ? REPORT_EXPORT_DASH : cell;
          return `<td class="rx-td rx-align-${align}">${escapeHtml(raw)}</td>`;
        })
        .join("");
      return `<tr class="${row.isTotal ? "rx-row-total" : ""}">${cells}</tr>`;
    })
    .join("");

  return `
<section class="rx-table-block">
  ${title ? `<p class="rx-table-title">${escapeHtml(title)}</p>` : ""}
  <table class="rx-table">
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  ${options.footnote ? `<p class="rx-table-note">${escapeHtml(options.footnote)}</p>` : ""}
</section>`.trim();
}

/**
 * Титульный лист в стилистике ГОСТ Р 21.101 / СПДС.
 */
export function renderGostTitlePage(
  meta: ReportExportDocumentMeta,
  documentLabel: string,
  documentSubtitle?: string
): string {
  return `
<section class="rx-title-page">
  <div class="rx-title-header">
    <p class="rx-title-organization">${escapeHtml(meta.organization)}</p>
    <p class="rx-title-customer">Заказчик: ${escapeHtml(meta.customer)}</p>
  </div>
  <div class="rx-title-body">
    <p class="rx-title-stage">${escapeHtml(meta.documentStage)}</p>
    <h1 class="rx-title-object">${escapeHtml(meta.objectName)}</h1>
    <p class="rx-title-address">${escapeHtml(meta.address)}</p>
    <p class="rx-title-document-code">Шифр: ${escapeHtml(meta.documentCode)}</p>
    <h2 class="rx-title-document">${escapeHtml(documentLabel)}</h2>
    ${documentSubtitle ? `<p class="rx-title-subtitle">${escapeHtml(documentSubtitle)}</p>` : ""}
  </div>
  <div class="rx-title-footer">
    <p>${escapeHtml(meta.documentCity)} · ${escapeHtml(meta.year)}</p>
    <p class="rx-title-generated">Сформировано: ${escapeHtml(meta.generatedAtLabel)}</p>
  </div>
</section>`.trim();
}

/**
 * Основная надпись (штамп) в нижней части документа.
 */
export function renderGostStamp(meta: ReportExportDocumentMeta, documentLabel: string): string {
  return `
<section class="rx-gost-stamp">
  <table class="rx-stamp-table">
    <tr>
      <td class="rx-stamp-cell rx-stamp-cipher">${escapeHtml(meta.documentCode)}</td>
      <td class="rx-stamp-cell rx-stamp-doc">${escapeHtml(documentLabel)}</td>
    </tr>
    <tr>
      <td class="rx-stamp-cell">Разработал: ${escapeHtml(meta.developedBy)}</td>
      <td class="rx-stamp-cell">Проверил: ${escapeHtml(meta.checkedBy)}</td>
    </tr>
    <tr>
      <td class="rx-stamp-cell">Нормоконтроль: ${escapeHtml(meta.normControl)}</td>
      <td class="rx-stamp-cell">ГИП: ${escapeHtml(meta.chiefEngineer)}</td>
    </tr>
  </table>
</section>`.trim();
}

/**
 * Содержание документа.
 */
export interface ReportTocItem {
  id: string;
  label: string;
}

export function renderToc(items: ReportTocItem[]): string {
  if (!items.length) {
    return "";
  }
  const li = items
    .map(
      (item) =>
        `<li class="rx-toc-item"><a href="#${escapeHtml(item.id)}" class="rx-toc-link">${escapeHtml(item.label)}</a></li>`
    )
    .join("");
  return `
<section class="rx-toc-block">
  <h3 class="rx-section-title">Содержание</h3>
  <ol class="rx-toc-list">${li}</ol>
</section>`.trim();
}

export function renderDocumentStatusBlock(
  preflight: ReportPreflightResult,
  options: {
    title?: string;
    includeIssues?: boolean;
    includeWarnings?: boolean;
  } = {}
): string {
  const title = options.title ?? "Статус документа";
  const issueRows: string[] = [];
  if (options.includeIssues !== false) {
    issueRows.push(
      ...preflight.blockingIssues.map(
        (issue) => `<li>${escapeHtml(issue.message)}</li>`
      )
    );
  }
  if (options.includeWarnings) {
    issueRows.push(
      ...preflight.warningIssues.map(
        (issue) => `<li>${escapeHtml(issue.message)}</li>`
      )
    );
  }

  return `
<section class="rx-status-block rx-status-${escapeHtml(preflight.status)}">
  <h3 class="rx-section-title">${escapeHtml(title)}</h3>
  <p><strong>Статус документа:</strong> ${escapeHtml(preflight.statusLabel)}</p>
  <p>${escapeHtml(preflight.summary)}</p>
  ${
    issueRows.length
      ? `<ul class="rx-status-list">${issueRows.join("")}</ul>`
      : ""
  }
</section>`.trim();
}

/**
 * Блок подписей в конце документа.
 */
export function renderSignatureBlock(meta: ReportExportDocumentMeta): string {
  return `
<section class="rx-signature-block">
  <div class="rx-signature">
    <span class="rx-signature-role">Разработал</span>
    <span class="rx-signature-line">__________________________</span>
    <span class="rx-signature-name">${escapeHtml(meta.developedBy)}</span>
  </div>
  <div class="rx-signature">
    <span class="rx-signature-role">Проверил</span>
    <span class="rx-signature-line">__________________________</span>
    <span class="rx-signature-name">${escapeHtml(meta.checkedBy)}</span>
  </div>
  <div class="rx-signature">
    <span class="rx-signature-role">Нормоконтроль</span>
    <span class="rx-signature-line">__________________________</span>
    <span class="rx-signature-name">${escapeHtml(meta.normControl)}</span>
  </div>
  <div class="rx-signature">
    <span class="rx-signature-role">ГИП</span>
    <span class="rx-signature-line">__________________________</span>
    <span class="rx-signature-name">${escapeHtml(meta.chiefEngineer)}</span>
  </div>
</section>`.trim();
}

/**
 * Библиография (только нормативные документы; ссылки на справочно-правовые системы
 * не включаем по требованию проверки качества).
 */
export interface ReportBibliographyEntry {
  id: string;
  label: string;
}

export function renderBibliography(entries: ReportBibliographyEntry[]): string {
  if (!entries.length) {
    return "";
  }
  const items = entries
    .map((entry) => `<li class="rx-bib-item"><strong>${escapeHtml(entry.id)}.</strong> ${escapeHtml(entry.label)}</li>`)
    .join("");
  return `
<section class="rx-bibliography">
  <h3 class="rx-section-title">Перечень используемых нормативных документов</h3>
  <ol class="rx-bib-list">${items}</ol>
</section>`.trim();
}

/**
 * Маркер "справочной" RC-оценки — обязательная пометка при любом упоминании
 * динамической RC-модели в нормативных документах.
 */
export const REPORT_EXPORT_RC_DISCLAIMER =
  "Справочная динамическая оценка не заменяет нормативную проверку по СП 50.";

/**
 * Сноска «*», которая выводится после значения, принятого по проектному
 * допущению. Используется в основных таблицах документов вместе с
 * блоком «Принятые проектные допущения».
 */
export const DEMO_DEFAULT_VALUE_MARK = " *";

/**
 * Блок «Принятые проектные допущения». Если допущений нет, возвращает пустую
 * строку — раздел в документ не подмешивается. Это гарантирует, что блок
 * присутствует ТОЛЬКО когда defaults реально были подставлены.
 */
export function renderAssumptionsBlock(
  entries: AssumptionEntry[] | undefined | null,
  options: { id?: string; intro?: string } = {}
): string {
  const list = Array.isArray(entries)
    ? entries.filter((entry) => entry && entry.source === "demo-default")
    : [];
  if (list.length === 0) {
    return "";
  }
  const id = options.id ?? "rx-assumptions";
  const intro =
    options.intro ??
    "Значения ниже подставлены автоматически из профиля проектных допущений для демонстрационного расчёта. Каждая строка отмечена сноской «*» в основных таблицах документа.";
  const rows = list
    .map(
      (entry) =>
        `<tr><td class="rx-td rx-align-left">${escapeHtml(entry.label)}</td><td class="rx-td rx-align-left">${escapeHtml(
          entry.value
        )}</td></tr>`
    )
    .join("");
  return `
<section class="rx-assumptions-block" id="${escapeHtml(id)}">
  <h3 class="rx-section-title">${escapeHtml(ASSUMPTIONS_SECTION_TITLE)}</h3>
  <p>${escapeHtml(intro)}</p>
  <table class="rx-table rx-assumptions-table">
    <colgroup><col style="width:55%"/><col/></colgroup>
    <thead>
      <tr>
        <th class="rx-th rx-align-left">Параметр</th>
        <th class="rx-th rx-align-left">Принятое значение</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="rx-table-note">${escapeHtml(DEMO_DEFAULT_FOOTNOTE)}</p>
</section>`.trim();
}

/**
 * Общая «скелетная» обёртка HTML-документа: <html>, <head>, базовые стили.
 */
export function wrapHtmlDocument(
  templateMarker: string,
  documentTitle: string,
  body: string
): string {
  return `<!DOCTYPE html>
${templateMarker}
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(documentTitle)}</title>
<style>${BASE_GOST_REPORT_CSS}</style>
</head>
<body class="rx-document">
${body}
<div class="rx-page-counter" aria-hidden="true">Лист </div>
</body>
</html>`;
}

/**
 * Базовый ГОСТ/СПДС-стиль для выгружаемых документов.
 *
 *  - A4 с полями для подшивки (18 / 18 / 18 / 22 мм);
 *  - Times New Roman 11–14 pt;
 *  - чёрно-белая палитра, без градиентов, теней, цветных карточек;
 *  - таблицы с тонкими черными границами (0.5 pt);
 *  - никакие интерфейсные элементы (.rx-export-actions, кнопки) не печатаются.
 */
export const BASE_GOST_REPORT_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
@page {
  size: A4;
  margin: 20mm 10mm 20mm 30mm;
}
body.rx-document {
  font-family: "Times New Roman", "Liberation Serif", Times, serif;
  font-size: 12pt;
  line-height: 1.4;
  color: #000;
  background: #fff;
  margin: 0;
  padding: 20mm 10mm 20mm 30mm;
}
.rx-document h1, .rx-document h2, .rx-document h3, .rx-document h4 {
  font-family: inherit;
  font-weight: bold;
  margin: 0 0 8pt;
  color: #000;
}
.rx-document h1 { font-size: 16pt; text-align: center; }
.rx-document h2 { font-size: 14pt; }
.rx-document h3 { font-size: 12pt; text-transform: uppercase; letter-spacing: 0.02em; }
.rx-document p { margin: 0 0 6pt; text-align: justify; }
.rx-document section { margin-bottom: 12pt; }
.rx-section-title { font-size: 12pt; font-weight: bold; margin: 0 0 8pt; text-transform: uppercase; }
.rx-section-meta { font-size: 11pt; margin: 0 0 4pt; }
.rx-title-page {
  page-break-after: always;
  min-height: 240mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14mm 0 10mm;
}
.rx-title-header { text-align: center; }
.rx-title-organization { font-weight: bold; }
.rx-title-body { text-align: center; margin: 24pt 0; }
.rx-title-stage { text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 18pt; }
.rx-title-object { font-size: 18pt; margin-bottom: 8pt; }
.rx-title-document { font-size: 14pt; margin-top: 16pt; }
.rx-title-subtitle { font-style: italic; margin-top: 4pt; }
.rx-title-footer { text-align: center; }
.rx-title-document-code { font-weight: bold; margin-top: 8pt; }
.rx-toc-list { padding-left: 0; list-style: decimal inside; counter-reset: rx-toc; }
.rx-toc-item { padding: 2pt 0; }
.rx-toc-link { color: #000; text-decoration: none; }
.rx-table-block {
  page-break-inside: avoid;
  break-inside: avoid-page;
}
.rx-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 6pt;
  page-break-inside: auto;
  break-inside: auto;
}
.rx-table thead { display: table-header-group; }
.rx-table tfoot { display: table-footer-group; }
.rx-table tr,
.rx-table thead,
.rx-table tbody,
.rx-table colgroup,
.rx-stamp-table,
.rx-signature-block {
  page-break-inside: avoid;
  break-inside: avoid-page;
}
.rx-table-title { font-style: italic; margin-bottom: 4pt; }
.rx-th, .rx-td {
  border: 0.5pt solid #000;
  padding: 3pt 6pt;
  vertical-align: top;
}
.rx-th { background: #ededed; font-weight: bold; }
.rx-align-left { text-align: left; }
.rx-align-right { text-align: right; }
.rx-align-center { text-align: center; }
.rx-row-total td { font-weight: bold; background: #f3f3f3; }
.rx-table-note { font-size: 10pt; font-style: italic; color: #000; margin-top: 4pt; }
.rx-signature-block {
  margin-top: 16pt;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14pt;
  page-break-inside: avoid;
}
.rx-signature { display: flex; flex-direction: column; }
.rx-signature-role { font-weight: bold; }
.rx-signature-line { letter-spacing: 0.4em; }
.rx-gost-stamp {
  margin-top: 8pt;
  border-top: 1pt solid #000;
  padding-top: 4pt;
  page-break-inside: avoid;
  break-inside: avoid-page;
}
.rx-stamp-table { width: 100%; border-collapse: collapse; }
.rx-stamp-cell { border: 0.5pt solid #000; padding: 3pt 6pt; font-size: 10.5pt; }
.rx-bib-list { padding-left: 18pt; }
.rx-bib-item { margin-bottom: 4pt; }
.rx-note {
  border-left: 1pt solid #000;
  padding: 4pt 10pt;
  margin: 8pt 0;
  font-style: italic;
}
.rx-status-block {
  border: 0.8pt solid #000;
  padding: 6pt 10pt;
  margin-bottom: 10pt;
}
.rx-status-ready {
  background: #f6fbf6;
}
.rx-status-not-ready {
  background: #fff2f2;
}
.rx-status-for-review {
  background: #fff8ec;
}
.rx-status-draft {
  background: #f7f7f7;
}
.rx-status-list {
  margin: 6pt 0 0;
  padding-left: 16pt;
}
.rx-draft-banner {
  display: inline-block;
  padding: 3pt 10pt;
  border: 1pt solid #000;
  font-weight: bold;
  letter-spacing: 0.08em;
  margin-bottom: 8pt;
  text-transform: uppercase;
}
.rx-assumptions-block { page-break-inside: avoid; border: 0.5pt solid #000; padding: 6pt 10pt; }
.rx-assumptions-table th, .rx-assumptions-table td { font-size: 11pt; }
.rx-export-actions { display: none !important; }
.rx-page-counter { display: none; }
@media print {
  body.rx-document { padding: 0; }
  .rx-export-actions { display: none !important; }
  .rx-page-counter {
    display: block;
    position: fixed;
    right: 0;
    bottom: 0;
    font-size: 9pt;
  }
  .rx-page-counter::after {
    content: counter(page);
  }
}
`;

/** Сохранён для совместимости с уже существующими импортами. */
export const BASE_REPORT_EXPORT_CSS = BASE_GOST_REPORT_CSS;
