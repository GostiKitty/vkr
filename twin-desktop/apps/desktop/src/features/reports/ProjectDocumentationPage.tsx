import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { useBuildStore } from "../build/build.store";
import { loadReportMeta } from "../build/reports/reportMetaPersistence";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useWorkspaceStore } from "../../entities/workspace/workspace.store";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { buildThermalProtectionReportData } from "./buildThermalProtectionReportData";
import NormativeDocumentPage from "./NormativeDocumentPage";
import ProjectDocumentToolbar, {
  type ProjectDocumentViewMode,
} from "./ProjectDocumentToolbar";
import ThermalProtectionReport from "./ThermalProtectionReport";
import { buildReportBaseData } from "./exports/data/buildReportBaseData";
import { prepareExportReportInput } from "./exports/prepareExportReportInput";
import {
  REPORT_DOWNLOAD_WORKSPACE_COMMAND,
  REPORT_EXPORT_TITLE,
  REPORT_EXPORT_WORKSPACE_COMMAND,
  type ReportExportKind,
} from "./exports/types";
import { buildFinalReleaseAudit } from "./exports/exportReportDocument";
import {
  useExpertiseInputsStore,
} from "./exports/store/expertiseInputs.store";
import ExpertReportSettingsForm from "./exports/components/ExpertReportSettingsForm";

interface ProjectDocumentationPageProps {
  projectId: string | null;
}

/**
 * Temporarily hidden from UI. Will be restored after project documentation export redesign.
 *
 * Видимый компонент рендерит нейтральную заглушку (см. экспорт по умолчанию ниже),
 * а вся прежняя логика сохранена в `LegacyProjectDocumentationPage` и доступна
 * для восстановления — здесь не удалены ни импорты, ни вычисления, ни обработчики.
 */
export function LegacyProjectDocumentationPage({ projectId }: ProjectDocumentationPageProps) {
  const model = useBuildStore((state) => state.model);
  const projectKey = useBuildStore((state) => state.projectKey);
  const modelRevision = useBuildStore((state) => state.modelRevision);
  const thermalResult = useTwinStore((state) => state.lastThermalResult);
  const thermalResultBinding = useTwinStore((state) => state.lastThermalResultBinding);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const monteCarloResult = useWorkflowStore((state) => state.monteCarloResult);
  const monteCarloResultBinding = useWorkflowStore((state) => state.monteCarloResultBinding);
  const applyDemoDefaults = useWorkspaceStore((state) => state.applyDemoDefaults);
  const dispatchProjectCommand = useWorkspaceStore((state) => state.dispatchProjectCommand);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNote, setPdfNote] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ProjectDocumentViewMode>("report");
  const [selectedExportKind, setSelectedExportKind] = useState<ReportExportKind>("thermal-protection");
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const hydrateProject = useExpertiseInputsStore((state) => state.hydrateProject);
  const isInputsPanelOpen = useExpertiseInputsStore((state) => state.isPanelOpen);
  const openInputsPanel = useExpertiseInputsStore((state) => state.openPanel);
  const closeInputsPanel = useExpertiseInputsStore((state) => state.closePanel);
  const completenessSummaryOpen = useExpertiseInputsStore((state) => state.completenessSummaryOpen);
  const openCompletenessSummary = useExpertiseInputsStore((state) => state.openCompletenessSummary);
  const closeCompletenessSummary = useExpertiseInputsStore((state) => state.closeCompletenessSummary);
  const getInputs = useExpertiseInputsStore((state) => state.getInputs);
  const resolvedProjectKey = projectKey || projectId || "local-project";
  const thermalResultState = getResultSyncState(
    Boolean(thermalResult),
    thermalResultBinding,
    projectKey,
    modelRevision
  );
  const monteCarloResultState = getResultSyncState(
    Boolean(monteCarloResult),
    monteCarloResultBinding,
    projectKey,
    modelRevision
  );
  const visibleThermalResult = thermalResultState === "current" ? thermalResult : null;
  const visibleMonteCarloResult = monteCarloResultState === "current" ? monteCarloResult : null;

  const reportMeta = useMemo(
    () => loadReportMeta(resolvedProjectKey),
    [resolvedProjectKey]
  );
  const expertiseInputs = useMemo(() => getInputs(resolvedProjectKey), [getInputs, resolvedProjectKey]);

  const reportBuild = useMemo(() => {
    try {
      const data = buildThermalProtectionReportData({
        model,
        projectId,
        scenarioConfig,
        thermalResult: visibleThermalResult,
        monteCarloResult: visibleMonteCarloResult,
        reportMeta,
        generatedAt,
      });
      const prepared = prepareExportReportInput(
        {
          model,
          projectId,
          scenarioConfig,
          thermalResult: visibleThermalResult,
          monteCarloResult: visibleMonteCarloResult,
          reportMeta,
          generatedAt,
          expertiseInputs,
        },
        { applyDemoDefaults }
      );
      const exportBase = buildReportBaseData({
        ...prepared.input,
        appliedAssumptions: prepared.appliedAssumptions,
      });
      return { data, exportBase, error: null as string | null };
    } catch (error) {
      console.error("ProjectDocumentationPage build failed", error);
      return {
        data: null,
        exportBase: null,
        error: error instanceof Error ? error.message : "Не удалось подготовить данные документов.",
      };
    }
  }, [
    applyDemoDefaults,
    expertiseInputs,
    generatedAt,
    model,
    projectId,
    reportMeta,
    scenarioConfig,
    visibleMonteCarloResult,
    visibleThermalResult,
  ]);
  const { data, exportBase, error: reportBuildError } = reportBuild;
  const preflight = useMemo(
    () => (exportBase ? buildFinalReleaseAudit(exportBase) : null),
    [exportBase]
  );

  useEffect(() => {
    hydrateProject(resolvedProjectKey);
  }, [hydrateProject, resolvedProjectKey]);

  const handleGenerate = () => {
    setGeneratedAt(new Date());
    setPdfNote(null);
  };

  const handleViewModeChange = (mode: ProjectDocumentViewMode) => {
    startTransition(() => {
      setViewMode(mode);
      setPdfNote(null);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenExpertiseInputs = () => {
    openInputsPanel();
    closeCompletenessSummary();
  };

  const handleCheckCompleteness = () => {
    openCompletenessSummary();
    if (!isInputsPanelOpen) {
      openInputsPanel();
    }
  };

  const handleExportCommand = (kind: ReportExportKind, mode: "download" | "print") => {
    if (!exportBase) {
      setPdfNote("Ошибка подготовки данных документов. Проверьте исходные данные проекта.");
      return;
    }
    if (!canProceedWithExport(exportBase, handleOpenExpertiseInputs)) {
      return;
    }
    dispatchProjectCommand(
      mode === "download"
        ? REPORT_DOWNLOAD_WORKSPACE_COMMAND[kind]
        : REPORT_EXPORT_WORKSPACE_COMMAND[kind]
    );
  };

  const handleDownloadAll = () => {
    if (!exportBase) {
      setPdfNote("Ошибка подготовки данных документов. Проверьте исходные данные проекта.");
      return;
    }
    if (!canProceedWithExport(exportBase, handleOpenExpertiseInputs)) {
      return;
    }
    dispatchProjectCommand("download-all-exports");
  };

  const handleExportPdf = async () => {
    if (!sheetRef.current || pdfBusy) {
      return;
    }

    setPdfBusy(true);
    setPdfNote("Подготовка PDF...");

    try {
      const filename = buildPdfFilename(generatedAt);
      const pdf = new jsPDF({
        unit: "pt",
        format: "a4",
        compress: true,
      });

      await new Promise<void>((resolve, reject) => {
        pdf.html(sheetRef.current!, {
          margin: [24, 24, 24, 24],
          autoPaging: "text",
          width: 547,
          windowWidth: Math.max(sheetRef.current?.scrollWidth ?? 794, 794),
          html2canvas: {
            backgroundColor: "#ffffff",
            scale: 0.78,
          },
          callback: (doc) => {
            try {
              doc.save(filename);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
        });
      });

      setPdfNote("PDF сформирован.");
    } catch (error) {
      console.error("PDF export failed, falling back to print dialog.", error);
      setPdfNote(
        "Экспорт в PDF выполнен через системный диалог печати из-за ограничений браузерного рендеринга."
      );
      window.print();
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {reportBuildError ? (
        <div className="rounded-2xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-fg)]">
          Не удалось подготовить данные раздела «Документы». {reportBuildError}
        </div>
      ) : null}
      {thermalResultState === "stale" || monteCarloResultState === "stale" ? (
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          Модель изменилась после последнего расчёта. Документы строятся по текущей модели, но расчётные показатели нужно обновить повторным запуском расчёта.
        </div>
      ) : null}
      <section className="ui-panel document-print-hidden space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Комплект документации
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[color:var(--text-base)]">
              Реквизиты и условия для выгрузки
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]">
              Перед формированием комплекта можно вручную задать реквизиты проекта,
              климатические и эксплуатационные условия, а затем проверить комплектность
              полей для экспертной выгрузки.
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Статус комплекта
            </p>
            <p className="mt-1 text-lg font-semibold">
              {preflight?.statusLabel ?? "Черновик"}
            </p>
            <p className="text-sm text-[color:var(--text-muted)]">
              {preflight?.summary ??
                "Проверка статуса станет доступна после подготовки данных документов."}
            </p>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Заполнено: {exportBase?.expertise.readiness.filledTotal ?? 0} из{" "}
              {exportBase?.expertise.readiness.trackedTotal ?? 0} обязательных и рекомендуемых полей
            </p>
          </div>
        </div>

        {preflight ? (
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--text-base)]">
                  Preflight финальной выгрузки
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{preflight.summary}</p>
              </div>
              <div className="text-sm text-[color:var(--text-muted)]">
                Ошибки: {preflight.blockingIssues.length} · Предупреждения: {preflight.warningIssues.length}
              </div>
            </div>
            {preflight.blockingIssues.length ? (
              <ul className="mt-3 space-y-1 text-sm text-[color:var(--text-muted)]">
                {preflight.blockingIssues.map((issue) => (
                  <li key={issue.code}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-[color:var(--text-base)]">
              Выбранный документ
              <select
                value={selectedExportKind}
                onChange={(event) => setSelectedExportKind(event.target.value as ReportExportKind)}
                className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm"
              >
                {(Object.keys(REPORT_EXPORT_TITLE) as ReportExportKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {REPORT_EXPORT_TITLE[kind]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenExpertiseInputs}
              className="ui-btn-secondary px-4 py-2 text-sm"
              data-testid="open-expertise-inputs-button"
            >
              Исходные данные для экспертизы
            </button>
            <button
              type="button"
              onClick={handleCheckCompleteness}
              className="ui-btn-secondary px-4 py-2 text-sm"
              data-testid="check-export-completeness-button"
            >
              Проверить комплектность
            </button>
            <button
              type="button"
              onClick={() => handleExportCommand(selectedExportKind, "download")}
              className="ui-btn-secondary px-4 py-2 text-sm"
            >
              Скачать выбранный документ
            </button>
            <button
              type="button"
              onClick={handleDownloadAll}
              className="ui-btn-primary px-4 py-2 text-sm"
            >
              Скачать комплект документов
            </button>
            <button
              type="button"
              onClick={() => handleExportCommand(selectedExportKind, "print")}
              className="ui-btn-secondary px-4 py-2 text-sm"
            >
              Печать / PDF
            </button>
          </div>
        </div>

        {completenessSummaryOpen ? (
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--text-base)]">
                  Проверка комплектности
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Обязательные поля: {exportBase?.expertise.readiness.requiredFilled ?? 0}/
                  {exportBase?.expertise.readiness.requiredTotal ?? 0}. Рекомендуемые поля:{" "}
                  {exportBase?.expertise.readiness.recommendedFilled ?? 0}/
                  {exportBase?.expertise.readiness.recommendedTotal ?? 0}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCompletenessSummary}
                className="ui-btn-secondary px-3 py-1.5 text-xs"
              >
                Скрыть
              </button>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-[color:var(--text-base)]">
                  Критичные замечания preflight
                </p>
                {preflight && preflight.blockingIssues.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-muted)]">
                    {preflight.blockingIssues.map((issue) => (
                      <li key={issue.code}>{issue.message}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                    Критичных пропусков не выявлено.
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[color:var(--text-base)]">
                  Данные, требующие уточнения
                </p>
                <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-muted)]">
                  {(exportBase?.expertise.clarificationLines ?? []).map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <ProjectDocumentToolbar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onGenerate={handleGenerate}
        onPrint={handlePrint}
        onExportPdf={handleExportPdf}
        pdfBusy={pdfBusy}
        pdfNote={pdfNote}
      />

      {viewMode === "reference" ? (
        <NormativeDocumentPage />
      ) : data ? (
        <ThermalProtectionReport data={data} sheetRef={sheetRef} />
      ) : (
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          Просмотр документа временно недоступен: не удалось собрать данные отчёта.
        </div>
      )}

      {isInputsPanelOpen && exportBase ? (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]"
            onClick={closeInputsPanel}
          />
          <ExpertReportSettingsForm
            projectKey={resolvedProjectKey}
            expertise={exportBase.expertise}
            onClose={closeInputsPanel}
          />
        </>
      ) : null}
    </div>
  );
}

function buildPdfFilename(generatedAt: Date) {
  const year = generatedAt.getFullYear();
  const month = String(generatedAt.getMonth() + 1).padStart(2, "0");
  const day = String(generatedAt.getDate()).padStart(2, "0");
  return `thermal-protection-report-${year}${month}${day}.pdf`;
}

// Temporarily hidden from UI. Will be restored after project documentation export redesign.
// Видимый компонент-заглушка. Старый полный экран остаётся в `LegacyProjectDocumentationPage`
// в этом же файле и при восстановлении нужно вернуть строку:
//   `export default ProjectDocumentationPage;`
// на вариант, который маршрутизирует на legacy-реализацию.
export function ProjectDocumentationPage(_props: ProjectDocumentationPageProps) {
  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-6 text-sm text-[color:var(--text-muted)]">
      <p className="text-base font-semibold text-[color:var(--text-base)]">Раздел временно скрыт</p>
      <p className="mt-2 max-w-2xl">
        Выгрузка проектной документации будет доступна после доработки. Расчётные отчёты, тепловая карта,
        графики и таблицы по-прежнему доступны на других вкладках.
      </p>
    </section>
  );
}

export default ProjectDocumentationPage;

function canProceedWithExport(
  base: ReturnType<typeof buildReportBaseData>,
  openInputsPanel: () => void
): boolean {
  if (base.preflight.generationMode !== "final" || base.preflight.blockingIssues.length === 0) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  const fields = base.preflight.blockingIssues
    .map((issue) => `• ${issue.message}`)
    .join("\n");
  window.alert(
    `Финальная выгрузка заблокирована. Устраните следующие замечания:\n\n${fields}`
  );
  openInputsPanel();
  return false;
}
