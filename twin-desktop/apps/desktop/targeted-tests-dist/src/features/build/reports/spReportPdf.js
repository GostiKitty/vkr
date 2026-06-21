import { formatArea, formatNumber, formatVolume } from "../../../shared/utils/format";
import { sanitizeDisplayText } from "../../../shared/utils/displayText";
import { DEFAULT_REPORT_META } from "./reportMetaPersistence";
const SAFE_TEMPERATURE_LIMIT_C = 200;
const SAFE_NUMBER_LIMIT = 1e9;
const NOT_SET_TEXT = "не задано";
const NO_DATA_TEXT = "недостаточно данных";
const NEEDS_CLARIFICATION_TEXT = "требует уточнения";
const NEEDS_MODEL_CHECK_TEXT = "требует проверки расчетной модели";
const NORMATIVE_BASIS = [
    "Постановление Правительства РФ от 16.02.2008 № 87 «О составе разделов проектной документации и требованиях к их содержанию».",
    "ГОСТ Р 21.1101-2013 СПДС. Основные требования к проектной и рабочей документации.",
    "ГОСТ 21.501-2018 СПДС. Правила выполнения рабочей документации (основная надпись).",
    "ГОСТ 2.105-95 ЕСКД. Общие требования к текстовым документам.",
    "Рекомендации ГГЭ по составу и оформлению отчётной документации по результатам расчётов.",
    "СП 50.13330.2024 «Тепловая защита зданий».",
    "СП 131.13330.2025 «Строительная климатология».",
];
const LIMITATIONS = [
    "Настоящий расчётный документ сформирован в структуре текстовой части проектной документации и предназначен для представления расчётно-пояснительных материалов по тепловой защите здания.",
    "Собственноручные подписи исполнителей и ответственных лиц проставляются на бумажном экземпляре или средством электронной подписи в соответствии с законодательством РФ.",
    "Колонка «Фактическое значение» энергопаспорта на стадии «П» не заполняется (обозначено «—»), если отсутствуют данные обследования.",
    "Приложение В с результатами динамической RC-оценки носит справочный характер и не заменяет нормативный расчёт по СП 50.13330.2024.",
];
export function buildExpertiseThermalReportData(input) {
    const generatedAt = input.calculationTimestampIso ?? new Date().toISOString();
    const projectName = sanitizeVisibleText(input.projectName ?? input.model?.meta?.name ?? input.model?.meta?.sourceProjectName, "Текущий проект");
    const meta = {
        ...DEFAULT_REPORT_META,
        ...input.meta,
    };
    const report = input.report;
    const cipher = sanitizeVisibleText(meta.projectCipher, "б/н");
    const filename = `Raschet-teplozashchity_${slugify(cipher)}_${formatFilenameDate(generatedAt)}.pdf`;
    const sections = [
        buildIntroductionSection(projectName, meta),
        buildSourceDataSection(report, projectName, generatedAt, input.scenarioLabel, input.climateBaseLabel),
        buildBuildingSummarySection(report, projectName),
        buildNormativeBasisSection(),
        buildClimateOperationSection(report, input.scenarioLabel, input.climateBaseLabel),
        buildMethodologySection(),
        buildConstructionsSection(report),
        buildResistanceCheckSection(report),
        buildKobSection(report),
        buildEnergySection(report),
        buildDynamicSection(report, input.thermalResult ?? null, input.scenarioLabel),
        buildConclusionsSection(report, input.thermalResult ?? null, input.engineering?.presentation?.summaryLines?.[0] ?? null),
        buildMissingDataSection(report),
    ];
    const appendixSections = [
        buildEnergyPassportAppendix(report, meta, projectName, generatedAt),
        buildEnvelopeAppendixSection(report),
        ...(input.includeRcAppendix !== false && input.thermalResult
            ? [buildRcAppendixSection(input.report, input.thermalResult, input.scenarioLabel)]
            : []),
    ];
    return {
        title: "РАСЧЁТ ТЕПЛОТЕХНИЧЕСКИХ ХАРАКТЕРИСТИК ОГРАЖДАЮЩИХ КОНСТРУКЦИЙ И УДЕЛЬНОГО РАСХОДА ТЕПЛОВОЙ ЭНЕРГИИ НА ОТОПЛЕНИЕ И ВЕНТИЛЯЦИЮ",
        documentSubtitle: "Расчётный документ сформирован в структуре текстовой части проектной документации и предназначен для представления расчётно-пояснительных материалов по тепловой защите здания.",
        filename,
        generatedAt,
        projectName,
        meta,
        statusLabel: resolveOverallStatusLabel(report),
        normativeBasis: NORMATIVE_BASIS,
        sections: sections.filter(hasSectionContent),
        appendixSections: appendixSections.filter(hasSectionContent),
        limitations: LIMITATIONS,
    };
}
/** @deprecated Используйте buildExpertiseThermalReportData */
export function buildSpReportPdfData(input) {
    return buildExpertiseThermalReportData({
        report: input.report,
        model: input.model,
        projectName: input.projectName,
        calculationTimestampIso: input.calculationTimestampIso,
        transientResult: input.transientResult,
        transientWarnings: input.transientWarnings,
        thermalResult: input.thermalResult,
        meta: input.meta,
        includeRcAppendix: false,
    });
}
export function exportSpReportToPdf(data) {
    if (typeof window === "undefined") {
        return false;
    }
    const html = buildSpReportHtml(data);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const reportUrl = URL.createObjectURL(blob);
    const reportWindow = window.open(reportUrl, "_blank", "noopener,noreferrer");
    if (!reportWindow) {
        downloadReportHtml(html, data.filename.replace(/\.pdf$/i, ".html"));
        URL.revokeObjectURL(reportUrl);
        return true;
    }
    window.setTimeout(() => {
        try {
            reportWindow.focus();
        }
        catch {
            // Ignore focus restrictions in embedded browser contexts.
        }
        window.setTimeout(() => URL.revokeObjectURL(reportUrl), 60_000);
    }, 150);
    return true;
}
export function buildSpReportHtml(data) {
    const meta = data.meta;
    const documentDesignation = buildDocumentDesignation(meta);
    const cipher = escapeHtml(documentDesignation);
    const stageShort = escapeHtml(resolveStageShortLabel(meta.documentStage));
    const developer = escapeHtml(sanitizeVisibleText(meta.developerOrg, "________________"));
    const projectSection = escapeHtml(sanitizeVisibleText(meta.projectSection, DEFAULT_REPORT_META.projectSection));
    const allSections = [...data.sections, ...data.appendixSections];
    const tocHtml = buildTableOfContentsHtml(allSections);
    const tableCounter = { value: 0 };
    const bodySectionsHtml = data.sections
        .map((section, index) => renderSectionHtml(section, { index, tableCounter, isAppendix: false }))
        .join("");
    const appendixHtml = data.appendixSections
        .map((section, index) => renderSectionHtml(section, { index: index + data.sections.length, tableCounter, isAppendix: true }))
        .join("");
    const limitationsHtml = data.limitations.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
    const bibliographyHtml = data.normativeBasis.map((entry, index) => `<p class="biblio no-indent">[${index + 1}] ${escapeHtml(entry)}</p>`).join("");
    const year = escapeHtml(formatYear(data.generatedAt));
    const cityLine = escapeHtml(sanitizeVisibleText(meta.documentCity, meta.buildingAddress ? (meta.buildingAddress.split(",")[0] ?? "") : ""));
    const stampHtml = buildGostStampHtml({
        designation: documentDesignation,
        title: data.title,
        projectName: data.projectName,
        stage: stageShort,
        customer: sanitizeVisibleText(meta.customerOrg, "—"),
        date: formatDateOnly(data.generatedAt),
    });
    return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <!-- Project documentation export template v2 -->
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(data.filename)}</title>
    <style>
      /* ГОСТ 2.105-95: поля 30/20/20/10 мм; шрифт 14 pt; интервал 1,5 */
      @page {
        size: A4 portrait;
        margin: 20mm 10mm 20mm 30mm;
      }
      @page :first {
        margin: 0;
      }
      @page toc {
        margin: 20mm 10mm 20mm 30mm;
      }
      @page {
        @bottom-center {
          content: counter(page);
          font: 12pt "Times New Roman", Times, serif;
        }
      }
      @page :first {
        @bottom-center { content: none; }
      }
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 0;
        font: 14pt/1.5 "Times New Roman", Times, serif;
        color: #000;
        background: #fff;
      }
      .report { margin: 0 auto; }
      .title-page {
        min-height: 297mm;
        padding: 20mm 10mm 20mm 30mm;
        page-break-after: always;
        display: flex;
        flex-direction: column;
      }
      .title-page .org {
        font-size: 14pt;
        text-align: left;
        text-indent: 0;
        margin: 0 0 12mm;
      }
      .title-page .center-block {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;
        padding: 0 10mm;
      }
      .title-page h1 {
        font-size: 14pt;
        font-weight: 700;
        text-transform: uppercase;
        margin: 0 0 8mm;
        line-height: 1.5;
        text-indent: 0;
      }
      .title-page .object {
        font-size: 14pt;
        font-weight: 700;
        margin: 0 0 6mm;
        text-indent: 0;
      }
      .title-page .stage {
        font-size: 14pt;
        margin: 0;
        text-indent: 0;
      }
      .title-page .bottom-line {
        text-align: center;
        font-size: 14pt;
        text-indent: 0;
        margin-top: auto;
      }
      .title-page .doc-kind {
        font-size: 14pt;
        text-align: center;
        text-indent: 0;
        margin: 0 0 6mm;
      }
      .title-page .pd-section {
        font-size: 14pt;
        text-align: center;
        text-indent: 0;
        margin: 4mm 0 0;
      }
      .stamp-sheet {
        page-break-after: always;
        padding: 20mm 10mm 20mm 30mm;
      }
      .gost-stamp {
        width: 100%;
        border-collapse: collapse;
        font-size: 10pt;
        table-layout: fixed;
      }
      .gost-stamp th,
      .gost-stamp td {
        border: 1px solid #000;
        padding: 1.5mm 2mm;
        vertical-align: middle;
        text-indent: 0;
        text-align: left;
      }
      .gost-stamp .label {
        font-size: 9pt;
        text-align: center;
        font-weight: 400;
      }
      .gost-stamp .designation {
        font-size: 12pt;
        font-weight: 700;
        text-align: center;
      }
      .gost-stamp .title-cell {
        font-size: 11pt;
        font-weight: 700;
        text-align: center;
        vertical-align: middle;
      }
      .gost-stamp .sig-head {
        font-size: 8pt;
        text-align: center;
        height: 14mm;
      }
      .gost-stamp .sig-cell {
        height: 10mm;
      }
      .running-header {
        font-size: 12pt;
        border-bottom: 0.5pt solid #000;
        padding-bottom: 2mm;
        margin: 0 0 6mm;
        display: flex;
        justify-content: space-between;
        text-indent: 0;
      }
      .toc {
        page: toc;
        page-break-after: always;
        padding: 0;
      }
      .toc h2 {
        font-size: 14pt;
        font-weight: 700;
        text-align: center;
        text-indent: 0;
        margin: 0 0 10mm;
        text-transform: uppercase;
      }
      .toc-entry {
        display: flex;
        align-items: baseline;
        font-size: 14pt;
        margin: 0 0 2mm;
        text-indent: 0;
        text-decoration: none;
        color: #000;
      }
      .toc-entry .toc-num { width: 10mm; flex-shrink: 0; }
      .toc-entry .toc-title { flex-shrink: 0; max-width: 75%; }
      .toc-entry .toc-dots {
        flex: 1;
        border-bottom: 1px dotted #000;
        margin: 0 2mm 1.5mm;
        min-width: 8mm;
      }
      .toc-entry .toc-page::after {
        content: target-counter(attr(href), page);
      }
      .body-content { padding: 0; }
      .section { margin-bottom: 6mm; }
      .section h2 {
        font-size: 14pt;
        font-weight: 700;
        margin: 12pt 0 6pt;
        text-indent: 0;
        text-align: left;
        page-break-after: avoid;
      }
      p {
        margin: 0;
        text-align: justify;
        text-indent: 12.5mm;
      }
      p.no-indent { text-indent: 0; }
      ul {
        margin: 0 0 6pt;
        padding-left: 12.5mm;
        list-style: disc;
      }
      li { margin: 0 0 3pt; text-align: justify; }
      .table-caption {
        font-size: 12pt;
        text-indent: 0;
        text-align: left;
        margin: 6pt 0 3pt;
      }
      table.data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0 0 8pt;
        font-size: 12pt;
        table-layout: fixed;
      }
      table.data-table th,
      table.data-table td {
        border: 1px solid #000;
        padding: 2mm 2.5mm;
        vertical-align: top;
        word-break: break-word;
        text-indent: 0;
      }
      table.data-table th {
        font-weight: 700;
        text-align: center;
      }
      .appendix > .section h2 { margin-top: 14pt; }
      .bibliography { page-break-before: always; }
      .bibliography h2 { font-size: 14pt; font-weight: 700; text-indent: 0; margin: 0 0 8pt; }
      .biblio { font-size: 14pt; line-height: 1.5; }
      .signatures {
        margin-top: 14pt;
        page-break-inside: avoid;
      }
      .signatures h2 {
        font-size: 14pt;
        font-weight: 700;
        text-indent: 0;
        margin: 0 0 8pt;
      }
      .signatures table { width: 100%; border-collapse: collapse; font-size: 14pt; }
      .signatures td {
        padding: 8pt 6pt 0;
        vertical-align: bottom;
        border: none;
        text-indent: 0;
      }
      .sig-line {
        display: inline-block;
        border-bottom: 1px solid #000;
        min-width: 45mm;
        height: 1em;
      }
      .limitations { margin-top: 10pt; }
      .limitations h2 { font-size: 14pt; font-weight: 700; text-indent: 0; }
      .template-version {
        margin-top: 10pt;
        font-size: 10pt;
        text-align: right;
        text-indent: 0;
      }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        a { color: #000; text-decoration: none; }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <section class="title-page">
        <p class="org no-indent">${developer}</p>
        <div class="center-block">
          <p class="doc-kind">Проектная документация</p>
          <h1>${escapeHtml(data.title)}</h1>
          <p class="object">${escapeHtml(data.projectName)}</p>
          <p class="pd-section">${projectSection}</p>
          <p class="stage">Стадия ${stageShort}</p>
          ${meta.buildingAddress ? `<p class="stage">${escapeHtml(meta.buildingAddress)}</p>` : ""}
        </div>
        <p class="bottom-line">${cityLine ? `${cityLine}, ` : ""}${year}</p>
      </section>
      <section class="stamp-sheet">
        ${stampHtml}
        <p class="no-indent" style="margin-top:6mm">${escapeHtml(data.documentSubtitle)}</p>
      </section>
      <section class="toc">
        <h2>Содержание</h2>
        ${tocHtml}
      </section>
      <div class="body-content">
        <div class="running-header">
          <span>Шифр ${cipher}</span>
          <span>${escapeHtml(data.projectName)}</span>
        </div>
      ${bodySectionsHtml}
      ${appendixHtml ? `<div class="appendix">${appendixHtml}</div>` : ""}
        <section class="bibliography">
          <h2>Библиографический список</h2>
          ${bibliographyHtml}
        </section>
        <section class="section limitations">
          <h2>Примечания</h2>
          <ul>${limitationsHtml}</ul>
        </section>
        <section class="signatures">
          <h2>Лист регистрации изменений / подписи</h2>
          <table>
            <tr>
              <td style="width:28%">Исполнитель</td>
              <td><span class="sig-line"></span></td>
              <td style="width:5%">/</td>
              <td><span class="sig-line"></span></td>
            </tr>
            <tr>
              <td>Проверил</td>
              <td><span class="sig-line"></span></td>
              <td>/</td>
              <td><span class="sig-line"></span></td>
            </tr>
            <tr>
              <td>Н. контр.</td>
              <td><span class="sig-line"></span></td>
              <td>/</td>
              <td><span class="sig-line"></span></td>
            </tr>
            <tr>
              <td>Главный инженер проекта</td>
              <td><span class="sig-line"></span></td>
              <td>/</td>
              <td><span class="sig-line"></span></td>
            </tr>
          </table>
        </section>
        <p class="template-version">Версия шаблона выгрузки: v2</p>
      </div>
    </main>
  </body>
</html>`;
}
function buildIntroductionSection(projectName, meta) {
    const designation = buildDocumentDesignation(meta);
    const section = sanitizeVisibleText(meta.projectSection, DEFAULT_REPORT_META.projectSection);
    return {
        number: "1",
        title: "Общие положения",
        paragraphs: [
            `Настоящий расчётный документ сформирован в структуре текстовой части проектной документации и предназначен для представления расчётно-пояснительных материалов по тепловой защите здания «${projectName}» (обозначение ${designation}).`,
            `Документ связан с ${section} и содержит сведения о теплотехнических характеристиках ограждающих конструкций, энергетических показателях и результатах расчётных проверок по данным цифровой модели здания.`,
            "Расчёт выполнен средствами расчётного модуля программного комплекса.",
        ],
    };
}
function buildNormativeBasisSection() {
    return {
        number: "4",
        title: "Нормативные ссылки и программное обеспечение",
        paragraphs: [
            "Расчёт выполнен с применением следующих нормативных документов и методических материалов:",
        ],
        bullets: [
            ...NORMATIVE_BASIS,
            "ПП РФ № 87 учтено при формировании структуры расчётного документа как части проектной документации.",
            "Программный комплекс: Twin Desktop (модуль теплотехнического расчёта по СП 50.13330.2024).",
            "Расчёт выполнен средствами расчётного модуля программного комплекса.",
        ],
    };
}
function buildSourceDataSection(report, projectName, generatedAt, scenarioLabel, climateBaseLabel) {
    const source = report.sourceData;
    const climateBasis = climateBaseLabel
        ? sanitizeParagraph(climateBaseLabel)
        : [safeText(source.city), safeText(source.climateRegion)]
            .filter((value) => value !== NOT_SET_TEXT)
            .join(", ");
    return {
        number: "2",
        title: "Исходные данные",
        paragraphs: [
            "В разделе приведены основные исходные данные цифровой модели здания, использованные при формировании расчётного документа.",
        ].filter(Boolean),
        tables: [
            {
                title: "Основные исходные данные",
                headers: ["Показатель", "Значение", "Примечание"],
                rows: [
                    ["Объект", projectName, "Наименование объекта расчёта"],
                    ["Дата и время расчёта", formatDateTime(generatedAt), "Дата формирования выгрузки"],
                    ["Город / климатическая база", climateBasis || NOT_SET_TEXT, "Исходная климатическая привязка"],
                    ["Сценарий расчёта", scenarioLabel ? sanitizeParagraph(scenarioLabel) : NOT_SET_TEXT, "Эксплуатационный сценарий"],
                    [
                        "Расчётная температура наружного воздуха",
                        safeTemperatureText(source.outdoorDesignTemperatureC, "°C"),
                        "Для проверки теплозащиты",
                    ],
                    [
                        "Расчётная температура внутреннего воздуха",
                        safeTemperatureText(source.indoorTemperatureC, "°C"),
                        "Принятая температура внутренней среды",
                    ],
                ],
            },
        ],
    };
}
function buildBuildingSummarySection(report, projectName) {
    const source = report.sourceData;
    const groupLabels = collectConstructionGroupLabels(report.constructions);
    return {
        number: "3",
        title: "Краткая характеристика здания",
        paragraphs: [
            `Объект расчёта: ${projectName}.`,
            `В расчёте учтены основные группы ограждающих конструкций: ${groupLabels.length ? groupLabels.join(", ") : NOT_SET_TEXT}.`,
        ],
        tables: [
            {
                title: "Сводные характеристики здания",
                headers: ["Показатель", "Значение"],
                rows: [
                    ["Назначение здания", formatBuildingCategory(source.buildingCategory)],
                    ["Этажность", safeInteger(source.storeys)],
                    ["Отапливаемая площадь", safeArea(source.heatedAreaM2)],
                    ["Отапливаемый объём", safeVolume(source.heatedVolumeM3)],
                    ["Количество ограждающих конструкций", safeInteger(report.constructions.length)],
                    ["Показатель компактности", safeNumberText(report.building.compactness_1_m, "1/м")],
                ],
            },
        ],
    };
}
function buildClimateOperationSection(report, scenarioLabel, climateBaseLabel) {
    const source = report.sourceData;
    return {
        number: "5",
        title: "Климатические и эксплуатационные параметры",
        paragraphs: [],
        tables: [
            {
                title: "Расчётные климатические и эксплуатационные параметры",
                headers: ["Показатель", "Обозначение", "Ед. изм.", "Значение", "Источник / примечание"],
                rows: [
                    [
                        "Расчётная температура наружного воздуха",
                        "tн",
                        "°C",
                        safeTemperatureText(source.outdoorDesignTemperatureC),
                        climateBaseLabel ? sanitizeParagraph(climateBaseLabel) : safeText(source.city),
                    ],
                    [
                        "Средняя температура наружного воздуха за отопительный период",
                        "tот",
                        "°C",
                        safeTemperatureText(source.outdoorHeatingPeriodAverageC),
                        "Климатические параметры отопительного периода",
                    ],
                    ["Продолжительность отопительного периода", "Zот", "сут", safeDays(source.heatingPeriodDurationDays), "Исходные климатические данные"],
                    ["ГСОП", "ГСОП", "°C·сут", safeNumberText(source.gsop, ""), "Расчётная климатическая база"],
                    [
                        "Расчётная внутренняя температура",
                        "tв",
                        "°C",
                        safeTemperatureText(source.indoorTemperatureC),
                        "Принятая температура внутреннего воздуха",
                    ],
                    [
                        "Относительная влажность внутреннего воздуха",
                        "φв",
                        "%",
                        safeNumberText(source.indoorRelativeHumidityPercent, ""),
                        "Принятый режим эксплуатации",
                    ],
                    ["Влажностный режим помещений", "—", "—", safeText(source.moistureMode), "По данным модели"],
                    ["Условия эксплуатации ограждений", "—", "—", safeText(source.operationCondition), "По данным модели"],
                    ["Эксплуатационный сценарий", "—", "—", scenarioLabel ? sanitizeParagraph(scenarioLabel) : NOT_SET_TEXT, "Сценарий расчёта"],
                ],
            },
        ],
    };
}
function buildMethodologySection() {
    return {
        number: "6",
        title: "Методика расчёта",
        paragraphs: [
            "В документе приведены результаты расчёта сопротивления теплопередаче ограждающих конструкций, удельной теплозащитной характеристики здания и энергетических показателей тепловой защиты.",
        ],
        bullets: [
            "Проверка сопротивления теплопередаче выполнена по расчётной модели ограждающих конструкций.",
            "Удельная теплозащитная характеристика здания определена по укрупнённым показателям наружной оболочки.",
            "Энергетическая характеристика сформирована по имеющимся исходным данным по теплопотерям, воздухообмену и климатическим параметрам.",
            "Дополнительная динамическая RC-оценка приведена как справочный расчёт и рассматривается отдельно от нормативной проверки по СП 50.",
        ],
    };
}
function buildConstructionsSection(report) {
    const groups = buildConstructionGroupSummary(report);
    return {
        number: "7",
        title: "Теплотехнические характеристики ограждающих конструкций",
        paragraphs: [
            "В основной части документа приведена сводная таблица по типам ограждающих конструкций. Полный перечень элементов и послойный состав вынесены в приложение Б.",
        ],
        tables: [
            {
                title: "Сводная таблица по типам конструкций",
                headers: [
                    "Тип конструкции",
                    "Количество элементов",
                    "Площадь, м²",
                    "Rфакт",
                    "Rнорм",
                    "U, Вт/(м²·К)",
                    "Статус",
                ],
                rows: groups.map((group) => [
                    group.typeLabel,
                    safeInteger(group.count),
                    safeArea(group.area),
                    safeNumberText(group.actualResistance, "м²·°C/Вт"),
                    safeNumberText(group.requiredResistance, "м²·°C/Вт"),
                    safeNumberText(group.uValue, ""),
                    group.status,
                ]),
            },
        ],
    };
}
function buildResistanceCheckSection(report) {
    const diagnostics = buildConstructionDiagnostics(report);
    const criticalRows = diagnostics
        .filter((item) => item.severity < 0)
        .slice(0, 10)
        .map((item) => [
        item.label,
        item.typeLabel,
        safeArea(item.entry.areaM2),
        safeNumberText(item.entry.actualResistance_m2K_W, "м²·°C/Вт"),
        safeNumberText(item.entry.requiredResistance_m2K_W, "м²·°C/Вт"),
        item.status,
        item.note,
    ]);
    return {
        number: "8",
        title: "Сопротивление теплопередаче ограждающих конструкций",
        paragraphs: [buildResistanceConclusionText(report, diagnostics)],
        tables: criticalRows.length
            ? [
                {
                    title: "Наиболее критичные элементы",
                    headers: ["Элемент", "Тип", "Площадь, м²", "Rфакт", "Rнорм", "Статус", "Примечание"],
                    rows: criticalRows,
                },
            ]
            : undefined,
    };
}
function buildKobSection(report) {
    const building = report.building;
    return {
        number: "9",
        title: "Удельная теплозащитная характеристика здания",
        paragraphs: [
            `Заключение по удельной теплозащитной характеристике здания: ${formatSp50StatusText(building.status)}.`,
        ],
        tables: [
            {
                title: "Сводные показатели kоб",
                headers: ["Показатель", "Значение"],
                rows: [
                    ["Расчётное значение kоб", safeNumberText(building.kob_W_m3K, "Вт/(м³·°C)")],
                    ["Нормативное значение kоб,норм", safeNumberText(building.kobNorm_W_m3K, "Вт/(м³·°C)")],
                    ["Общий коэффициент теплопередачи Kобщ", safeNumberText(building.kOverall_W_m2K, "Вт/(м²·°C)")],
                    ["Статус", formatSp50StatusText(building.status)],
                ],
            },
        ],
    };
}
function buildTemperatureSection(report) {
    const temp = report.temperature;
    const constructionRows = report.constructions
        .filter((entry) => entry.internalSurfaceTemperatureC !== null || entry.dewPointTemperatureC !== null)
        .map((entry) => [
        sanitizeVisibleText(entry.label, "Конструкция"),
        safeTemperatureText(entry.internalSurfaceTemperatureC),
        safeTemperatureText(entry.dewPointTemperatureC),
        entry.condensationRisk === true ? "есть риск" : entry.condensationRisk === false ? "риск не выявлен" : "н/д",
        formatSp50StatusText(entry.status),
    ]);
    return {
        number: "8",
        title: "Теплоустойчивость ограждающих конструкций",
        paragraphs: [
            `Минимальная расчётная температура внутренней поверхности: ${safeTemperatureText(temp.minimumSurfaceTemperatureC)}.`,
            `Расчётная температура точки росы: ${safeTemperatureText(temp.dewPointTemperatureC)}.`,
            temp.problematicZones.length
                ? `Проблемные зоны: ${temp.problematicZones.join(", ")}.`
                : "Критические зоны по температуре внутренней поверхности не выявлены.",
        ],
        tables: constructionRows.length
            ? [
                {
                    title: "Таблица 7.1 — Температура внутренней поверхности",
                    headers: ["Конструкция", "t_si, °C", "t_точки росы, °C", "Конденсация", "Статус"],
                    rows: constructionRows,
                },
            ]
            : undefined,
    };
}
function buildAirPermeabilitySection(report) {
    const air = report.airPermeability;
    return {
        number: "11",
        title: "Воздухопроницаемость ограждающих конструкций",
        paragraphs: [`Заключение: ${formatSp50StatusText(air.status)}.`],
        tables: [
            {
                title: "Таблица 8.1",
                headers: ["Показатель", "Обозначение", "Ед. изм.", "Норма", "Расчёт"],
                rows: [
                    [
                        "Сопротивление воздухопроницанию",
                        "Ru",
                        "м²·ч·Па/кг",
                        safeNumberText(air.requiredResistance_m2hPa_kg, ""),
                        safeNumberText(air.actualResistance_m2hPa_kg, ""),
                    ],
                    [
                        "Разность давлений",
                        "Δp",
                        "Па",
                        "—",
                        safeNumberText(air.pressureDifferencePa, ""),
                    ],
                ],
            },
        ],
    };
}
function buildMoistureSection(report) {
    const moisture = report.moistureProtection;
    const statusText = moisture.status === "calculated"
        ? moisture.complies === true
            ? "соответствует"
            : moisture.complies === false
                ? "не соответствует"
                : "недостаточно данных"
        : "недостаточно данных";
    return {
        number: "12",
        title: "Защита ограждающих конструкций от переувлажнения",
        paragraphs: [`Заключение по влагозащите: ${statusText}.`],
        tables: [
            {
                title: "Таблица 9.1",
                headers: ["Показатель", "Обозначение", "Ед. изм.", "Норма", "Расчёт"],
                rows: [
                    [
                        "Приведённое сопротивление паропроницанию",
                        "Rn",
                        "м²·ч·Па/мг",
                        safeNumberText(moisture.governingRequiredResistance_m2hPa_mg, ""),
                        safeNumberText(moisture.actualResistance_m2hPa_mg, ""),
                    ],
                    [
                        "Парциальное давление внутри",
                        "pв",
                        "Па",
                        "—",
                        safeNumberText(moisture.internalPartialPressurePa, ""),
                    ],
                ],
            },
        ],
    };
}
function buildFloorSection(report) {
    const floor = report.floor;
    return {
        number: "12",
        title: "Теплоусвоение поверхности полов",
        paragraphs: [`Заключение: ${formatSp50StatusText(floor.status)}.`],
        tables: [
            {
                title: "Таблица 10.1",
                headers: ["Показатель", "Обозначение", "Ед. изм.", "Норма", "Расчёт"],
                rows: [
                    [
                        "Теплоусвоение поверхности",
                        "Yпол",
                        "Вт/(м²·К)",
                        safeNumberText(floor.requiredHeatAbsorption_W_m2K, ""),
                        safeNumberText(floor.heatAbsorption_W_m2K, ""),
                    ],
                ],
            },
        ],
    };
}
function buildThermalInertiaSection(report, transientResult, transientWarnings) {
    const tr = report.transient;
    const paragraphs = [
        `Тепловая инерция ограждения D = ${safeNumberText(tr.thermalInertia_D, "")}.`,
        `Амплитуда колебаний внутренней поверхности Aτ = ${safeNumberText(tr.internalSurfaceAmplitudeC, "°C")} (норма Aτ,норм = ${safeNumberText(tr.requiredAmplitudeC, "°C")}).`,
        `Заключение по тепловой инерции: ${formatSp50StatusText(tr.status)}.`,
    ];
    if (transientResult?.valid && transientResult.stable) {
        paragraphs.push(`Дополнительно выполнен нестационарный 1D-расчёт конструкции: t_si,min = ${safeTemperatureText(transientResult.minInnerSurfaceTemperature)}, t_si,max = ${safeTemperatureText(transientResult.maxInnerSurfaceTemperature)}.`);
    }
    else if (transientResult) {
        paragraphs.push("Нестационарный 1D-расчёт выполнен, но не включён в заключение (недостоверность или неустойчивость схемы).");
    }
    return {
        number: "12",
        title: "Тепловая инерция ограждающих конструкций",
        paragraphs,
        bullets: transientWarnings?.slice(0, 4),
    };
}
function buildEnergySection(report) {
    const energy = report.energy;
    const warnings = collectHumanizedMessages(report).energyWarnings;
    const hasVentilationPlaceholders = hasVentilationPlaceholderWarnings(energy.placeholderWarnings);
    return {
        number: "10",
        title: "Энергетическая характеристика и расход тепловой энергии",
        paragraphs: [
            energy.usesPlaceholderInputs
                ? hasVentilationPlaceholders
                    ? "Часть исходных данных по вентиляции и инфильтрации не задана. Энергетические показатели требуют уточнения после ввода проектных параметров воздухообмена."
                    : "Расчёт выполнен с неполным набором исходных данных. Результат является предварительным."
                : "Исходные данные для энергетического расчёта заданы в полном объёме модели.",
            `Удельная характеристика расхода тепловой энергии qот = ${safeNumberText(energy.qHeatingCharacteristic_W_m3K, "Вт/(м³·°C)")}.`,
            `Нормируемое значение qот,норм = ${safeNumberText(energy.qHeatingNorm_kWh_m2, "кВт·ч/(м²·год)")} (по площади).`,
            `Расчётный годовой расход на отопление и вентиляцию: ${safeNumberText(energy.annualHeatingEnergy_kWh, "кВт·ч/год")}.`,
            `Общие теплопотери за отопительный период: ${safeNumberText(energy.annualTotalLosses_kWh, "кВт·ч/год")}.`,
            `Заключение по энергетической характеристике: ${formatSp50StatusText(energy.status)}.`,
        ],
        tables: [
            {
                title: "Сводные энергетические показатели",
                headers: ["Показатель", "Обозначение", "Ед. изм.", "Расчёт"],
                rows: [
                    ["Удельная теплозащитная характеристика", "kоб", "Вт/(м³·°C)", safeNumberText(report.building.kob_W_m3K, "")],
                    ["Удельная вентиляционная", "kвент", "Вт/(м³·°C)", safeNumberText(energy.ventilationCharacteristic_W_m3K, "")],
                    ["Удельная от бытовых тепловыделений", "kбыт", "Вт/(м³·°C)", safeNumberText(energy.internalGainCharacteristic_W_m3K, "")],
                    ["Удельная от солнечной радиации", "kрад", "Вт/(м³·°C)", safeNumberText(energy.solarGainCharacteristic_W_m3K, "")],
                    ["Коэффициент использования притоков", "β", "—", safeNumberText(energy.betaGainUseFactor, "")],
                    ["Средняя кратность воздухообмена", "nв", "1/ч", safeNumberText(energy.averageAirExchange_1_h, "")],
                    ["Удельный расход по объёму", "q", "кВт·ч/(м³·год)", safeNumberText(energy.qByVolume_kWh_m3, "")],
                    ["Удельный расход по площади", "q", "кВт·ч/(м²·год)", safeNumberText(energy.qByArea_kWh_m2, "")],
                ],
            },
        ],
        bullets: warnings,
    };
}
function buildDynamicSection(_report, thermalResult, scenarioLabel) {
    const diag = thermalResult?.diagnostics?.building;
    const zoneRows = thermalResult?.diagnostics?.zones
        ?.filter((zone) => zone.status !== "ok")
        .slice(0, 5)
        .map((zone) => [
        sanitizeParagraph(zone.zoneName),
        safeTemperatureText(zone.temperatureC, "°C"),
        safeNumberText(zone.discomfortHours, "ч"),
        mapZoneDiagnosticStatus(zone.status),
    ]);
    return {
        number: "11",
        title: "Дополнительная динамическая оценка теплового режима",
        paragraphs: [
            "Справочный расчёт. Не заменяет нормативную проверку по СП 50.",
            thermalResult
                ? scenarioLabel
                    ? `Динамическая RC-оценка выполнена для сценария «${sanitizeParagraph(scenarioLabel)}».`
                    : "Динамическая RC-оценка выполнена для текущего расчётного сценария."
                : "Динамическая RC-оценка не выполнялась.",
        ],
        tables: thermalResult
            ? [
                {
                    title: "Показатели динамической RC-модели",
                    headers: ["Показатель", "Значение"],
                    rows: [
                        ["Пиковая нагрузка отопления", safeNumberText(thermalResult.summary.peakLoadKW, "кВт")],
                        ["Энергия отопления за период", safeNumberText(thermalResult.summary.totalEnergyKWh, "кВт·ч")],
                        ["Дискомфорт, ч", safeNumberText(thermalResult.summary.discomfortHours, "ч")],
                        ["Удельная пиковая нагрузка", safeNumberText(diag?.specificPeakLoad_W_m2, "Вт/м²")],
                        ["Удельная энергия", safeNumberText(diag?.specificEnergyKWh_m2, "кВт·ч/м²")],
                    ],
                },
                ...(diag
                    ? [
                        {
                            title: "Структура расчётных потерь",
                            headers: ["Категория", "Доля, %"],
                            rows: [
                                ["Ограждения", safeNumberText(diag.lossSharePercent.opaque, "%")],
                                ["Окна", safeNumberText(diag.lossSharePercent.window, "%")],
                                ["Двери", safeNumberText(diag.lossSharePercent.door, "%")],
                                ["Инфильтрация", safeNumberText(diag.lossSharePercent.infiltration, "%")],
                                ["Вентиляция", safeNumberText(diag.lossSharePercent.ventilation, "%")],
                            ],
                        },
                    ]
                    : []),
                ...(zoneRows?.length
                    ? [
                        {
                            title: "Зоны, требующие внимания по RC-оценке",
                            headers: ["Помещение", "Температура", "Дискомфорт", "Статус"],
                            rows: zoneRows,
                        },
                    ]
                    : []),
            ]
            : undefined,
    };
}
function buildConclusionsSection(report, thermalResult, engineeringHeadline) {
    const diagnostics = buildConstructionDiagnostics(report);
    const humanized = collectHumanizedMessages(report);
    return {
        number: "12",
        title: "Выводы",
        paragraphs: [
            `а) По нормативной теплозащите: ${buildResistanceConclusionText(report, diagnostics)}`,
            `б) По энергетическим показателям: ${buildEnergyConclusionText(report)}`,
            `в) По динамической температурной оценке: ${buildDynamicConclusionText(report, thermalResult)}`,
            `г) По недостающим данным: ${buildMissingDataConclusionText(humanized.missingData)}`,
            engineeringHeadline ? `Инженерная оценка модели: ${sanitizeParagraph(engineeringHeadline)}` : "",
        ].filter(Boolean),
        bullets: report.recommendations.length
            ? report.recommendations.map((item) => `${sanitizeParagraph(item.title)}: ${sanitizeParagraph(item.effect)}`)
            : undefined,
    };
}
function buildMissingDataSection(report) {
    const items = collectHumanizedMessages(report).missingData;
    if (!items.length) {
        return {
            number: "13",
            title: "Перечень недостающих исходных данных",
            paragraphs: ["Все обязательные исходные данные для расчёта заданы в модели."],
        };
    }
    return {
        number: "13",
        title: "Перечень недостающих исходных данных",
        paragraphs: ["Для полного соответствия комплекту экспертизы требуется уточнить следующие данные:"],
        bullets: items,
    };
}
function buildEnergyPassportAppendix(report, meta, projectName, generatedAt) {
    const source = report.sourceData;
    const energy = report.energy;
    const fact = "—";
    return {
        number: "Приложение А.",
        title: "Энергетический паспорт",
        paragraphs: [
            `Объект: ${projectName}. Дата заполнения: ${formatDateOnly(generatedAt)}.`,
            "На проектной стадии колонка «Фактическое значение» не заполняется.",
        ],
        tables: [
            {
                title: "1. Общая информация",
                headers: ["№", "Показатель", "Значение"],
                rows: [
                    ["1", "Адрес здания", sanitizeVisibleText(meta.buildingAddress, "—")],
                    ["2", "Разработчик проекта", sanitizeVisibleText(meta.developerOrg, "—")],
                    ["3", "Шифр проекта", sanitizeVisibleText(meta.projectCipher, "б/н")],
                    ["4", "Назначение здания", formatBuildingCategory(source.buildingCategory)],
                    ["5", "Этажность", safeInteger(source.storeys)],
                ],
            },
            {
                title: "2. Расчётные условия",
                headers: ["№", "Показатель", "Обозначение", "Ед. изм.", "Расчётное", "Фактическое"],
                rows: [
                    ["1", "Расчётная tн (теплозащита)", "tн", "°C", safeTemperatureText(source.outdoorDesignTemperatureC), fact],
                    ["2", "Средняя tот", "tот", "°C", safeTemperatureText(source.outdoorHeatingPeriodAverageC), fact],
                    ["3", "Zот", "Zот", "сут/год", safeDays(source.heatingPeriodDurationDays), fact],
                    ["4", "ГСОП", "ГСОП", "(°C·сут)/год", safeNumberText(source.gsop, ""), fact],
                    ["5", "tв", "tв", "°C", safeTemperatureText(source.indoorTemperatureC), fact],
                ],
            },
            {
                title: "3–4. Геометрия и теплотехника (основные показатели)",
                headers: ["№", "Показатель", "Обозначение", "Ед. изм.", "Норма", "Расчётное", "Фактическое"],
                rows: [
                    ["8", "Отапливаемый объём", "Vот", "м³", "—", safeVolume(source.heatedVolumeM3), fact],
                    ["13", "Kкомп", "Kкомп", "1/м", "—", safeNumberText(report.building.compactness_1_m, ""), fact],
                    ["15", "Приведённое R ограждений (сводно)", "Rприв", "(м²·°C)/Вт", "—", "см. раздел 6", fact],
                    ["20", "qот", "qот", "Вт/(м³·°C)", safeNumberText(energy.qHeatingNorm_kWh_m2, ""), safeNumberText(energy.qHeatingCharacteristic_W_m3K, ""), fact],
                    ["21", "kоб", "kоб", "Вт/(м³·°C)", safeNumberText(report.building.kobNorm_W_m3K, ""), safeNumberText(report.building.kob_W_m3K, ""), fact],
                    ["22", "kвент", "kвент", "Вт/(м³·°C)", "—", safeNumberText(energy.ventilationCharacteristic_W_m3K, ""), fact],
                    ["25", "Годовой расход", "Qгод", "кВт·ч/год", "—", safeNumberText(energy.annualHeatingEnergy_kWh, ""), fact],
                    ["28", "Соответствие теплозащите", "—", "—", "—", formatSp50StatusText(report.energy.status), fact],
                ],
            },
        ],
    };
}
function buildEnvelopeAppendixSection(report) {
    const diagnostics = buildConstructionDiagnostics(report);
    const rows = diagnostics.map((item) => [
        item.label,
        item.typeLabel,
        safeArea(item.entry.areaM2),
        safeNumberText(item.entry.actualResistance_m2K_W, "м²·°C/Вт"),
        safeNumberText(item.entry.requiredResistance_m2K_W, "м²·°C/Вт"),
        safeNumberText(item.entry.heatTransferCoefficient_W_m2K, "Вт/(м²·К)"),
        item.status,
        item.note,
    ]);
    return {
        number: "Приложение Б.",
        title: "Ведомость ограждающих конструкций",
        paragraphs: [
            "В приложении приведён полный перечень элементов наружной оболочки, использованных в расчёте.",
        ],
        tables: rows.length
            ? [
                {
                    title: "Полная ведомость ограждающих конструкций",
                    headers: ["Элемент", "Тип", "Площадь, м²", "Rфакт", "Rнорм", "U", "Статус", "Примечание"],
                    rows,
                },
            ]
            : undefined,
    };
}
function buildRcAppendixSection(report, result, scenarioLabel) {
    const diag = result.diagnostics?.building;
    const zoneRows = result.diagnostics?.zones?.map((zone) => [
        sanitizeParagraph(zone.zoneName),
        safeTemperatureText(zone.temperatureC, "°C"),
        safeNumberText(zone.discomfortHours, "ч"),
        safeNumberText(zone.peakSpecificLoad_W_m2, "Вт/м²"),
        safeNumberText(zone.energyKWh_m2, "кВт·ч/м²"),
        mapZoneDiagnosticStatus(zone.status),
    ]);
    return {
        number: "Приложение В.",
        title: "Подробные результаты расчёта",
        paragraphs: [
            "Настоящее приложение содержит подробные результаты динамического зонального расчёта и не заменяет нормативную проверку по СП 50.13330.2024.",
            scenarioLabel ? `Сценарий RC-модели: ${sanitizeParagraph(scenarioLabel)}.` : "",
            buildDynamicConclusionText(report, result),
        ].filter(Boolean),
        tables: [
            {
                title: "Показатели RC-модели",
                headers: ["Показатель", "Значение"],
                rows: [
                    ["Пиковая нагрузка отопления", `${safeNumberText(result.summary.peakLoadKW, "кВт")}`],
                    ["Энергия отопления за период", `${safeNumberText(result.summary.totalEnergyKWh, "кВт·ч")}`],
                    ["Дискомфорт, ч", safeNumberText(result.summary.discomfortHours, "")],
                    ["Удельная пиковая нагрузка", safeNumberText(diag?.specificPeakLoad_W_m2, "Вт/м²")],
                    ["Удельная энергия", safeNumberText(diag?.specificEnergyKWh_m2, "кВт·ч/м²")],
                ],
            },
            ...(diag
                ? [
                    {
                        title: "Структура потерь (пиковый срез)",
                        headers: ["Категория", "Доля, %"],
                        rows: [
                            ["Ограждение", safeNumberText(diag.lossSharePercent.opaque, "%")],
                            ["Окна", safeNumberText(diag.lossSharePercent.window, "%")],
                            ["Двери", safeNumberText(diag.lossSharePercent.door, "%")],
                            ["Инфильтрация", safeNumberText(diag.lossSharePercent.infiltration, "%")],
                            ["Вентиляция", safeNumberText(diag.lossSharePercent.ventilation, "%")],
                        ],
                    },
                ]
                : []),
            ...(zoneRows?.length
                ? [
                    {
                        title: "Показатели по помещениям",
                        headers: ["Помещение", "Температура", "Дискомфорт", "Пик", "Энергия", "Статус"],
                        rows: zoneRows,
                    },
                ]
                : []),
        ],
    };
}
function renderSectionHtml(section, options) {
    const sectionClass = options.isAppendix ? "section appendix" : "section";
    const anchor = sectionAnchorId(options.index);
    const heading = section.number
        ? `${escapeHtml(section.number)} ${escapeHtml(section.title)}`
        : escapeHtml(section.title);
    const paragraphs = section.paragraphs
        .map((entry) => `<p>${escapeHtml(sanitizeParagraph(entry))}</p>`)
        .join("");
    const bullets = section.bullets?.length
        ? `<ul>${section.bullets.map((entry) => `<li>${escapeHtml(sanitizeParagraph(entry))}</li>`).join("")}</ul>`
        : "";
    const tables = section.tables?.length
        ? section.tables.map((table) => renderTableHtml(table, options.tableCounter)).join("")
        : "";
    return `<section class="${sectionClass}" id="${anchor}">
    <h2>${heading}</h2>
    ${paragraphs}${bullets}${tables}
  </section>`;
}
function renderTableHtml(table, tableCounter) {
    tableCounter.value += 1;
    const tableNumber = tableCounter.value;
    const captionTitle = table.title.replace(/^Таблица\s+[\d.]+\s*[—–-]\s*/iu, "").trim() || table.title;
    return `<p class="table-caption">Таблица ${tableNumber} – ${escapeHtml(captionTitle)}</p>
    <table class="data-table">
      <thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}
function buildTableOfContentsHtml(sections) {
    return sections
        .map((section, index) => {
        const anchor = sectionAnchorId(index);
        const label = section.number ? `${section.number} ` : "";
        return `<a class="toc-entry" href="#${anchor}">
        <span class="toc-num">${escapeHtml(label)}</span>
        <span class="toc-title">${escapeHtml(section.title)}</span>
        <span class="toc-dots"></span>
        <span class="toc-page"></span>
      </a>`;
    })
        .join("");
}
function sectionAnchorId(index) {
    return `section-${index}`;
}
function formatYear(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(new Date().getFullYear());
    }
    return String(date.getFullYear());
}
function buildDocumentDesignation(meta) {
    const cipher = sanitizeVisibleText(meta.projectCipher, "").trim();
    if (!cipher) {
        return "б/н-ИОС.ОВ-ТР";
    }
    if (/[-.]/.test(cipher) && cipher.length >= 6) {
        return cipher;
    }
    return `${cipher}-ИОС.ОВ-ТР`;
}
function resolveStageShortLabel(stage) {
    const normalized = stage.trim().toLowerCase();
    if (normalized.includes("рабоч")) {
        return "Р";
    }
    if (normalized === "р" || normalized === "r") {
        return "Р";
    }
    if (normalized.includes("проект") || normalized === "п" || normalized === "p") {
        return "П";
    }
    return "П";
}
function buildGostStampHtml(input) {
    const designation = escapeHtml(input.designation);
    const title = escapeHtml(input.title);
    const projectName = escapeHtml(input.projectName);
    const stage = escapeHtml(input.stage);
    const customer = escapeHtml(input.customer);
    const date = escapeHtml(input.date);
    return `<table class="gost-stamp">
    <colgroup>
      <col style="width:12%" />
      <col style="width:10%" />
      <col style="width:10%" />
      <col style="width:10%" />
      <col style="width:10%" />
      <col style="width:10%" />
      <col style="width:10%" />
      <col style="width:28%" />
    </colgroup>
    <tr>
      <td colspan="2" class="label">Обозначение документа</td>
      <td colspan="6" class="designation">${designation}</td>
    </tr>
    <tr>
      <td colspan="2" class="label">Наименование</td>
      <td colspan="6" class="title-cell">${title}</td>
    </tr>
    <tr>
      <td colspan="2" class="label">Наименование объекта</td>
      <td colspan="6">${projectName}</td>
    </tr>
    <tr>
      <td colspan="2" class="label">Стадия</td>
      <td colspan="2">${stage}</td>
      <td colspan="2" class="label">Лист</td>
      <td colspan="2"></td>
    </tr>
    <tr>
      <td colspan="2" class="label">Заказчик</td>
      <td colspan="6">${customer}</td>
    </tr>
    <tr>
      <td class="sig-head">Изм.</td>
      <td class="sig-head">Лист</td>
      <td class="sig-head">№ докум.</td>
      <td class="sig-head">Подп.</td>
      <td class="sig-head">Дата</td>
      <td class="sig-head" colspan="2">Разраб.</td>
      <td class="sig-head">Подп. / Дата</td>
    </tr>
    <tr>
      <td class="sig-cell"></td>
      <td class="sig-cell"></td>
      <td class="sig-cell"></td>
      <td class="sig-cell"></td>
      <td class="sig-cell">${date}</td>
      <td class="sig-cell" colspan="2"></td>
      <td class="sig-cell"></td>
    </tr>
    <tr>
      <td class="sig-head" colspan="5"></td>
      <td class="sig-head" colspan="2">Пров.</td>
      <td class="sig-head">Подп. / Дата</td>
    </tr>
    <tr>
      <td class="sig-cell" colspan="5"></td>
      <td class="sig-cell" colspan="2"></td>
      <td class="sig-cell"></td>
    </tr>
    <tr>
      <td class="sig-head" colspan="5"></td>
      <td class="sig-head" colspan="2">Н. контр.</td>
      <td class="sig-head">Подп. / Дата</td>
    </tr>
    <tr>
      <td class="sig-cell" colspan="5"></td>
      <td class="sig-cell" colspan="2"></td>
      <td class="sig-cell"></td>
    </tr>
    <tr>
      <td class="sig-head" colspan="5"></td>
      <td class="sig-head" colspan="2">ГИП</td>
      <td class="sig-head">Подп. / Дата</td>
    </tr>
    <tr>
      <td class="sig-cell" colspan="5"></td>
      <td class="sig-cell" colspan="2"></td>
      <td class="sig-cell"></td>
    </tr>
  </table>`;
}
function downloadReportHtml(html, filename) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function hasSectionContent(section) {
    return Boolean(section.paragraphs.length || section.bullets?.length || section.tables?.length);
}
function resolveOverallStatusLabel(report) {
    const statuses = [
        report.building.status,
        report.energy.status,
        aggregateConstructionStatus(report),
    ];
    if (statuses.every((entry) => entry === "pass")) {
        return "соответствует нормативным требованиям (по расчётной модели)";
    }
    if (statuses.some((entry) => entry === "fail")) {
        return "выявлены отклонения от нормативных требований";
    }
    return "требуется уточнение исходных данных";
}
function aggregateConstructionStatus(report) {
    if (report.constructions.some((entry) => entry.status === "fail")) {
        return "fail";
    }
    if (report.constructions.some((entry) => entry.status === "insufficient_data")) {
        return "insufficient_data";
    }
    return report.constructions.length ? "pass" : "insufficient_data";
}
function resolveMargin(entry) {
    if (Number.isFinite(entry.margin_m2K_W)) {
        return entry.margin_m2K_W;
    }
    if (Number.isFinite(entry.actualResistance_m2K_W) && Number.isFinite(entry.requiredResistance_m2K_W)) {
        return entry.actualResistance_m2K_W - entry.requiredResistance_m2K_W;
    }
    return null;
}
function collectConstructionGroupLabels(constructions) {
    return Array.from(new Set(constructions
        .map((entry) => resolveConstructionTypeLabel(entry.constructionType))
        .filter((value) => Boolean(value))));
}
function buildConstructionDiagnostics(report) {
    const source = report.sourceData;
    return [...report.constructions]
        .map((entry) => {
        const classificationConflict = hasClassificationConflict(entry);
        const suspiciousSurfaceTemperature = hasSuspiciousSurfaceTemperature(entry, source.indoorTemperatureC, source.outdoorDesignTemperatureC);
        const margin = resolveMargin(entry);
        const severity = entry.status === "fail"
            ? -3
            : classificationConflict
                ? -2
                : entry.status === "insufficient_data"
                    ? -1
                    : 0;
        return {
            entry,
            label: sanitizeVisibleText(entry.label, "Конструкция"),
            typeLabel: resolveConstructionTypeLabel(entry.constructionType),
            classificationConflict,
            suspiciousSurfaceTemperature,
            status: classificationConflict
                ? "требует проверки классификации"
                : mapConstructionStatus(entry.status),
            note: buildConstructionNote(entry, classificationConflict, suspiciousSurfaceTemperature),
            severity,
            margin,
        };
    })
        .sort((left, right) => {
        if (left.severity !== right.severity) {
            return left.severity - right.severity;
        }
        const leftMargin = left.margin ?? Number.POSITIVE_INFINITY;
        const rightMargin = right.margin ?? Number.POSITIVE_INFINITY;
        if (leftMargin !== rightMargin) {
            return leftMargin - rightMargin;
        }
        return safeNumber(right.entry.areaM2) - safeNumber(left.entry.areaM2);
    });
}
function buildConstructionGroupSummary(report) {
    const diagnostics = buildConstructionDiagnostics(report);
    const groups = new Map();
    diagnostics.forEach((item) => {
        const key = resolveConstructionGroupKey(item.entry.constructionType);
        const bucket = groups.get(key) ??
            {
                typeLabel: item.typeLabel,
                count: 0,
                area: 0,
                areaForActual: 0,
                areaForRequired: 0,
                areaForU: 0,
                actualResistance: 0,
                requiredResistance: 0,
                uValue: 0,
                hasFail: false,
                hasInsufficient: false,
                hasConflict: false,
            };
        const area = safeNumber(item.entry.areaM2);
        bucket.count += 1;
        bucket.area += area;
        if (Number.isFinite(item.entry.actualResistance_m2K_W)) {
            bucket.actualResistance += item.entry.actualResistance_m2K_W * area;
            bucket.areaForActual += area;
        }
        if (Number.isFinite(item.entry.requiredResistance_m2K_W)) {
            bucket.requiredResistance += item.entry.requiredResistance_m2K_W * area;
            bucket.areaForRequired += area;
        }
        if (Number.isFinite(item.entry.heatTransferCoefficient_W_m2K)) {
            bucket.uValue += item.entry.heatTransferCoefficient_W_m2K * area;
            bucket.areaForU += area;
        }
        bucket.hasFail ||= item.entry.status === "fail";
        bucket.hasInsufficient ||= item.entry.status === "insufficient_data";
        bucket.hasConflict ||= item.classificationConflict;
        groups.set(key, bucket);
    });
    return [...groups.values()].map((group) => ({
        typeLabel: group.typeLabel,
        count: group.count,
        area: group.area,
        actualResistance: group.areaForActual > 0 ? group.actualResistance / group.areaForActual : null,
        requiredResistance: group.areaForRequired > 0 ? group.requiredResistance / group.areaForRequired : null,
        uValue: group.areaForU > 0 ? group.uValue / group.areaForU : null,
        status: group.hasConflict
            ? "требует проверки"
            : group.hasFail
                ? "не соответствует"
                : group.hasInsufficient
                    ? NEEDS_CLARIFICATION_TEXT
                    : "соответствует",
    }));
}
function buildResistanceConclusionText(report, diagnostics) {
    const failed = diagnostics.filter((item) => item.entry.status === "fail").length;
    const insufficient = diagnostics.filter((item) => item.entry.status === "insufficient_data").length;
    const conflicts = diagnostics.filter((item) => item.classificationConflict).length;
    if (failed > 0) {
        return `Нормативная проверка теплозащиты выявила несоответствие ${failed} ограждающих конструкций требованиям по сопротивлению теплопередаче.`;
    }
    if (conflicts > 0) {
        return `Часть ограждающих конструкций требует проверки классификации и уточнения расчетной модели (${conflicts} элементов).`;
    }
    if (insufficient > 0) {
        return `Для части ограждающих конструкций недостаточно исходных данных для окончательной нормативной проверки (${insufficient} элементов).`;
    }
    return report.constructions.length
        ? "По результатам нормативной проверки сопротивление теплопередаче ограждающих конструкций соответствует принятым требованиям."
        : "Ограждающие конструкции для нормативной проверки не заданы.";
}
function buildEnergyConclusionText(report) {
    if (report.energy.status === "fail") {
        return "Энергетическая характеристика здания требует корректировки проектных решений и уточнения исходных данных.";
    }
    if (report.energy.usesPlaceholderInputs) {
        return "Энергетические показатели являются предварительными и требуют уточнения после ввода полного набора проектных параметров.";
    }
    if (report.energy.status === "pass") {
        return "Энергетическая характеристика здания соответствует расчётным требованиям при полноте исходных данных.";
    }
    return "Энергетическая характеристика здания требует уточнения.";
}
function buildDynamicConclusionText(report, thermalResult) {
    if (!thermalResult) {
        return "Динамическая RC-оценка не выполнялась.";
    }
    const dynamicComfortOk = isDynamicComfortAcceptable(thermalResult);
    if (dynamicComfortOk && aggregateConstructionStatus(report) === "fail") {
        return "По результатам динамической RC-оценки температура воздуха в расчетном сценарии находится в комфортном диапазоне. При этом нормативная проверка теплозащиты выявила несоответствие отдельных ограждающих конструкций требованиям по сопротивлению теплопередаче.";
    }
    if (dynamicComfortOk) {
        return "По результатам динамической RC-оценки температура воздуха в расчетном сценарии находится в комфортном диапазоне.";
    }
    return "Динамическая RC-оценка выявила зоны, требующие дополнительной проверки теплового режима и исходных параметров модели.";
}
function buildMissingDataConclusionText(missingData) {
    return missingData.length
        ? `Требуется уточнение исходных данных: ${missingData.slice(0, 3).join("; ")}.`
        : "Критически недостающие исходные данные для формирования сводного отчёта не выявлены.";
}
function collectHumanizedMessages(report) {
    const missingData = uniqueMessages([
        ...report.missingData.map(humanizeReportMessage),
        ...report.energy.placeholderWarnings.map(humanizeReportMessage),
    ]);
    const energyWarnings = uniqueMessages(report.energy.placeholderWarnings.map(humanizeReportMessage));
    return { missingData, energyWarnings };
}
function hasVentilationPlaceholderWarnings(warnings) {
    const text = warnings.join(" ").toLowerCase();
    return (text.includes("l_vent") ||
        text.includes("lvent") ||
        text.includes("g_inf") ||
        text.includes("ginf") ||
        text.includes("ventilationach") ||
        text.includes("infiltrationach") ||
        text.includes("nvent") ||
        text.includes("ninf"));
}
function humanizeReportMessage(message) {
    const sanitized = sanitizeParagraph(message);
    if (!sanitized) {
        return null;
    }
    const normalized = sanitized.toLowerCase();
    if (normalized.includes("l_vent") ||
        normalized.includes("lvent") ||
        normalized.includes("ventilationach") ||
        normalized.includes("g_inf") ||
        normalized.includes("ginf") ||
        normalized.includes("infiltrationach") ||
        normalized.includes("nvent") ||
        normalized.includes("ninf")) {
        return "Часть исходных данных по вентиляции и инфильтрации не задана. Энергетические показатели требуют уточнения после ввода проектных параметров воздухообмена.";
    }
    if (normalized.includes("betav")) {
        return "Часть исходных данных для расчёта энергетических показателей не задана. Результат требует уточнения.";
    }
    if (normalized.includes("отапливаемый объём") || normalized.includes(" объём v")) {
        return "Не задан или не подтвержден отапливаемый объем здания.";
    }
    if (normalized.includes("gsop")) {
        return "Не задан или не определен ГСОП для выбранной климатической базы.";
    }
    if (normalized.includes("t_ot") || normalized.includes("средняя tот")) {
        return "Не задана средняя температура наружного воздуха за отопительный период.";
    }
    if (normalized.includes("k_ob")) {
        return "Не рассчитана удельная теплозащитная характеристика здания из-за неполных исходных данных.";
    }
    return sanitized;
}
function uniqueMessages(values) {
    const seen = new Set();
    return values.filter((value) => {
        if (!value) {
            return false;
        }
        const normalized = value.trim();
        if (!normalized || seen.has(normalized)) {
            return false;
        }
        seen.add(normalized);
        return true;
    });
}
function resolveConstructionGroupKey(type) {
    switch (type) {
        case "covering":
        case "roof":
            return "roof";
        case "gate":
            return "door";
        default:
            return type;
    }
}
function resolveConstructionTypeLabel(type) {
    switch (type) {
        case "wall":
            return "Наружные стены";
        case "covering":
        case "roof":
            return "Покрытия и кровля";
        case "floorOnGround":
        case "floorOverBasement":
        case "atticFloor":
            return "Полы";
        case "window":
        case "lantern":
            return "Окна";
        case "door":
        case "gate":
            return "Наружные двери";
        default:
            return sanitizeVisibleText(type, "Конструкция");
    }
}
function hasClassificationConflict(entry) {
    const openingType = entry.constructionType === "window" ||
        entry.constructionType === "door" ||
        entry.constructionType === "gate" ||
        entry.constructionType === "lantern";
    const hasLayeredAssembly = entry.layers.length > 0;
    return openingType && hasLayeredAssembly;
}
function hasSuspiciousSurfaceTemperature(entry, indoorTemperature, outdoorTemperature) {
    if (!Number.isFinite(entry.internalSurfaceTemperatureC) ||
        !Number.isFinite(indoorTemperature) ||
        !Number.isFinite(outdoorTemperature)) {
        return false;
    }
    const tSi = entry.internalSurfaceTemperatureC;
    const indoor = indoorTemperature;
    const outdoor = outdoorTemperature;
    if (tSi < outdoor - 0.5 || tSi > indoor + 0.5) {
        return true;
    }
    return Math.abs(tSi - outdoor) < Math.max(1, Math.abs(indoor - outdoor) * 0.15);
}
function buildConstructionNote(entry, classificationConflict, suspiciousSurfaceTemperature) {
    if (classificationConflict) {
        return "Требует проверки классификации.";
    }
    if (suspiciousSurfaceTemperature) {
        return NEEDS_MODEL_CHECK_TEXT;
    }
    if (entry.status === "fail") {
        return "Фактическое сопротивление теплопередаче ниже требуемого.";
    }
    if (entry.status === "insufficient_data") {
        return NO_DATA_TEXT;
    }
    return "Без замечаний.";
}
function mapConstructionStatus(status) {
    switch (status) {
        case "pass":
            return "соответствует";
        case "fail":
            return "не соответствует";
        default:
            return NO_DATA_TEXT;
    }
}
function mapZoneDiagnosticStatus(status) {
    switch (status) {
        case "risk":
            return "риск";
        case "attention":
            return "требует внимания";
        default:
            return "в пределах расчёта";
    }
}
function isDynamicComfortAcceptable(result) {
    if (result.summary.discomfortHours <= 12) {
        return true;
    }
    const zones = result.diagnostics?.zones ?? [];
    return zones.length > 0 && zones.every((zone) => zone.status === "ok" || zone.status === "attention");
}
function buildSpConclusion(report) {
    if (report.building.status === "pass" && report.constructions.every((entry) => entry.status !== "fail")) {
        return "По результатам расчёта принятые ограждающие конструкции и энергетические показатели в целом соответствуют требованиям СП 50.13330.2024 (при полноте исходных данных модели).";
    }
    return "По результатам расчёта отдельные ограждающие конструкции или энергетические показатели не обеспечивают требуемый уровень тепловой защиты; необходима корректировка проектных решений.";
}
function sumAreaByType(constructions, types) {
    return constructions
        .filter((entry) => types.includes(entry.constructionType))
        .reduce((sum, entry) => sum + safeNumber(entry.areaM2), 0);
}
void buildNormativeBasisSection;
void buildTemperatureSection;
void buildAirPermeabilitySection;
void buildMoistureSection;
void buildFloorSection;
void buildThermalInertiaSection;
void buildSpConclusion;
void sumAreaByType;
function formatBuildingCategory(value) {
    switch (value) {
        case "residential":
            return "Жилое";
        case "public":
            return "Общественное";
        case "industrial":
            return "Производственное";
        default:
            return safeText(value);
    }
}
function slugify(value) {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "proekt";
}
function formatFilenameDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "date";
    }
    return date.toISOString().slice(0, 10);
}
function formatDateOnly(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return NO_DATA_TEXT;
    }
    return new Intl.DateTimeFormat("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function safeNumber(value) {
    if (!Number.isFinite(value) || Math.abs(value) > SAFE_NUMBER_LIMIT) {
        return 0;
    }
    return value;
}
function isSafeTemperature(value) {
    return Number.isFinite(value) && Math.abs(value) <= SAFE_TEMPERATURE_LIMIT_C;
}
function safeText(value) {
    return sanitizeVisibleText(value, NOT_SET_TEXT);
}
function safeArea(value) {
    return Number.isFinite(value) ? formatArea(value) : NO_DATA_TEXT;
}
function safeVolume(value) {
    return Number.isFinite(value) ? formatVolume(value) : NO_DATA_TEXT;
}
function safeInteger(value) {
    return Number.isFinite(value) ? String(Math.round(value)) : NO_DATA_TEXT;
}
function safeDays(value) {
    return Number.isFinite(value) ? `${Math.round(value)}` : NO_DATA_TEXT;
}
function safeTemperatureText(value, unit = "") {
    if (!isSafeTemperature(value)) {
        return NO_DATA_TEXT;
    }
    const formatted = formatNumber(value, { maximumFractionDigits: 1 });
    return unit ? `${formatted} ${unit}` : formatted;
}
function safeNumberText(value, unit) {
    if (!Number.isFinite(value) || Math.abs(value) > SAFE_NUMBER_LIMIT) {
        return NO_DATA_TEXT;
    }
    const formatted = formatNumber(value, { maximumFractionDigits: 2 });
    return unit ? `${formatted} ${unit}` : formatted;
}
function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return NO_DATA_TEXT;
    }
    return new Intl.DateTimeFormat("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}
function formatSp50StatusText(value) {
    switch (value) {
        case "pass":
            return "соответствует";
        case "fail":
            return "не соответствует";
        default:
            return "недостаточно данных";
    }
}
function sanitizeParagraph(value) {
    return sanitizeDisplayText(value, "", { allowInternalId: false })
        .replace(/\bvideo[-\w]*\b/gi, "демонстрационный элемент")
        .replace(/\bwin[-_]?(\d+)\b/gi, "окно $1")
        .replace(/\bdoor[-_]?(\d+)\b/gi, "дверь $1")
        .replace(/\b(?:NaN|Infinity|undefined|null)\b/gi, "н/д")
        .replace(/\s+/g, " ")
        .trim();
}
function sanitizeVisibleText(value, fallback) {
    return sanitizeParagraph(value) || fallback;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
