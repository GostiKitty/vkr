/**
 * Единый вход в систему выгрузки документов.
 *
 *   exportReportDocument(kind)
 *
 * Функция:
 *  - забирает актуальное состояние из хранилищ build/twin/workflow/project;
 *  - формирует общие базовые данные (buildReportBaseData);
 *  - вызывает специализированный builder + генератор;
 *  - открывает HTML в новом окне для просмотра/печати/сохранения PDF;
 *  - НЕ модифицирует BuildingModel, расчётный солвер, 3D и Monte Carlo.
 */

import { useBuildStore } from "../../build/build.store";
import { useTwinStore } from "../../../entities/twin/twin.store";
import { useWorkflowStore } from "../../../entities/workflow/workflow.store";
import { useProjectStore } from "../../../entities/project/project.store";
import { useWorkspaceStore } from "../../../entities/workspace/workspace.store";
import { loadReportMeta } from "../../build/reports/reportMetaPersistence";
import { buildReportBaseData, type ReportBaseData } from "./data/buildReportBaseData";
import { buildProjectOvTsData } from "./data/buildProjectOvTsData";
import { buildThermalProtectionData } from "./data/buildThermalProtectionData";
import { buildEnergyPassportData } from "./data/buildEnergyPassportData";
import { buildOperationPassportData } from "./data/buildOperationPassportData";
import { buildEngineeringSummaryData } from "./data/buildEngineeringSummaryData";
import { generateProjectOvTsHtml } from "./generators/projectOvTs";
import { generateThermalProtectionHtml } from "./generators/thermalProtection";
import { generateEnergyPassportHtml } from "./generators/energyPassport";
import { generateOperationTechnicalPassportHtml } from "./generators/operationTechnicalPassport";
import { generateEngineeringSummaryHtml } from "./generators/engineeringSummary";
import { prepareExportReportInput } from "./prepareExportReportInput";
import { loadExpertiseInputs } from "./store/expertiseInputs.store";
import {
  REPORT_EXPORT_FILE_PREFIX,
  REPORT_EXPORT_TITLE,
  type ReportExportKind,
} from "./types";

export interface ExportReportOptions {
  /** Открыть HTML в новом окне (по умолчанию true в браузере). */
  openInWindow?: boolean;
  /** Скачать как .html файл (по умолчанию false). */
  download?: boolean;
}

export interface ExportReportResult {
  kind: ReportExportKind;
  html: string;
  filename: string;
  title: string;
  /** Окно, в котором открыли документ, если openInWindow=true. */
  printableWindow: Window | null;
}

/**
 * Чистая функция: по типу и подготовленным данным возвращает HTML-строку.
 * Не имеет побочных эффектов — может использоваться в тестах.
 */
export function renderReportHtml(kind: ReportExportKind, base: ReportBaseData): string {
  const opts = {
    appliedAssumptions: base.expertise.showAssumptionsBlock
      ? base.appliedAssumptions
      : [],
  };
  switch (kind) {
    case "project-ov-ts":
      return generateProjectOvTsHtml(buildProjectOvTsData(base), opts);
    case "thermal-protection":
      return generateThermalProtectionHtml(buildThermalProtectionData(base), opts);
    case "energy-passport":
      return generateEnergyPassportHtml(buildEnergyPassportData(base), opts);
    case "operation-technical-passport":
      return generateOperationTechnicalPassportHtml(buildOperationPassportData(base), opts);
    case "engineering-summary":
      return generateEngineeringSummaryHtml(buildEngineeringSummaryData(base), opts);
    default: {
      const exhaustive: never = kind;
      throw new Error(`Неизвестный тип выгрузки: ${String(exhaustive)}`);
    }
  }
}

function buildBaseFromStores(): ReportBaseData {
  const buildState = useBuildStore.getState();
  const twinState = useTwinStore.getState();
  const workflowState = useWorkflowStore.getState();
  const projectState = useProjectStore.getState();
  const workspaceState = useWorkspaceStore.getState();

  const projectId = projectState.projectId ?? null;
  const projectKey = buildState.projectKey || projectId || "local-project";

  const rawInput = {
    model: buildState.model,
    projectId,
    scenarioConfig: workflowState.scenarioConfig ?? null,
    thermalResult: twinState.lastThermalResult ?? null,
    monteCarloResult: workflowState.monteCarloResult ?? null,
    reportMeta: loadReportMeta(projectKey),
    generatedAt: new Date(),
    expertiseInputs: loadExpertiseInputs(projectKey),
  };

  const prepared = prepareExportReportInput(rawInput, {
    applyDemoDefaults: workspaceState.applyDemoDefaults,
  });
  return buildReportBaseData({
    ...prepared.input,
    appliedAssumptions: prepared.appliedAssumptions,
  });
}

function buildFilename(kind: ReportExportKind, generatedAt: Date): string {
  const year = generatedAt.getFullYear();
  const month = String(generatedAt.getMonth() + 1).padStart(2, "0");
  const day = String(generatedAt.getDate()).padStart(2, "0");
  const prefix = REPORT_EXPORT_FILE_PREFIX[kind];
  return `${prefix}-${year}${month}${day}.html`;
}

/**
 * Имена файлов «01-…», «02-…», …, как в ТЗ для пакета «Скачать все».
 * Используются и при отдельном «Скачать HTML», чтобы имя совпадало.
 */
export const REPORT_EXPORT_BUNDLE_FILENAME: Record<ReportExportKind, string> = {
  "project-ov-ts": "01-razdel-5-ov-ts.html",
  "thermal-protection": "02-raschet-teplovoy-zashchity.html",
  "energy-passport": "03-energeticheskiy-pasport.html",
  "operation-technical-passport": "04-ekspluatacionno-tehnicheskiy-pasport.html",
  "engineering-summary": "05-inzhenernoe-zaklyuchenie.html",
};

/**
 * Все 5 типов выгрузки в порядке нумерации пакета.
 */
export const ALL_REPORT_EXPORT_KINDS: ReadonlyArray<ReportExportKind> = [
  "project-ov-ts",
  "thermal-protection",
  "energy-passport",
  "operation-technical-passport",
  "engineering-summary",
];

/**
 * Главный вход. Готовит данные, рендерит HTML и (по умолчанию) открывает в новом окне.
 */
export function exportReportDocument(
  kind: ReportExportKind,
  options: ExportReportOptions = {}
): ExportReportResult {
  const base = buildBaseFromStores();
  const html = renderReportHtml(kind, base);
  const filename = buildFilename(kind, base.source.generatedAt);
  const title = REPORT_EXPORT_TITLE[kind];

  const openInWindow = options.openInWindow ?? true;
  const shouldDownload = options.download ?? false;
  let printableWindow: Window | null = null;

  if (typeof window !== "undefined" && openInWindow) {
    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      printableWindow = window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error("Не удалось открыть документ в новом окне", error);
    }
  }

  if (typeof window !== "undefined" && shouldDownload) {
    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (error) {
      console.error("Не удалось скачать документ", error);
    }
  }

  return { kind, html, filename, title, printableWindow };
}

/**
 * Последовательное скачивание всех 5 типов выгрузки одним пакетом.
 *
 * Каждый файл получает имя из `REPORT_EXPORT_BUNDLE_FILENAME` (01-…, 02-…).
 * Архивы намеренно не используем, чтобы не тащить новую зависимость; вместо
 * этого браузер последовательно сохраняет 5 HTML-файлов.
 *
 * Возвращает массив подготовленных выгрузок (включая HTML и имя файла),
 * пригодный и для тестов: тесту не нужен реальный браузерный download.
 */
export function downloadAllReportDocuments(
  options: { trigger?: boolean } = {}
): Array<{ kind: ReportExportKind; html: string; filename: string; title: string }> {
  const base = buildBaseFromStores();
  const items = ALL_REPORT_EXPORT_KINDS.map((kind) => {
    const html = renderReportHtml(kind, base);
    return {
      kind,
      html,
      filename: REPORT_EXPORT_BUNDLE_FILENAME[kind],
      title: REPORT_EXPORT_TITLE[kind],
    };
  });

  const shouldTrigger = options.trigger ?? true;
  if (shouldTrigger && typeof window !== "undefined") {
    items.forEach((item, index) => {
      try {
        const blob = new Blob([item.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = item.filename;
        document.body.appendChild(anchor);
        // Небольшая задержка между скачиваниями, чтобы браузер
        // не схлопнул их в один pop-up.
        window.setTimeout(() => {
          anchor.click();
          document.body.removeChild(anchor);
          window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
        }, index * 250);
      } catch (error) {
        console.error(`Не удалось скачать ${item.filename}`, error);
      }
    });
  }
  return items;
}
