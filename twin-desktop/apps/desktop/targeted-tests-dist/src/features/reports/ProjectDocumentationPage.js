import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
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
import ProjectDocumentToolbar from "./ProjectDocumentToolbar";
import ThermalProtectionReport from "./ThermalProtectionReport";
import { buildReportBaseData } from "./exports/data/buildReportBaseData";
import { prepareExportReportInput } from "./exports/prepareExportReportInput";
import { REPORT_DOWNLOAD_WORKSPACE_COMMAND, REPORT_EXPORT_TITLE, REPORT_EXPORT_WORKSPACE_COMMAND, } from "./exports/types";
import { buildFinalReleaseAudit } from "./exports/exportReportDocument";
import { useExpertiseInputsStore, } from "./exports/store/expertiseInputs.store";
import ExpertReportSettingsForm from "./exports/components/ExpertReportSettingsForm";
/**
 * Temporarily hidden from UI. Will be restored after project documentation export redesign.
 *
 * Видимый компонент рендерит нейтральную заглушку (см. экспорт по умолчанию ниже),
 * а вся прежняя логика сохранена в `LegacyProjectDocumentationPage` и доступна
 * для восстановления — здесь не удалены ни импорты, ни вычисления, ни обработчики.
 */
export function LegacyProjectDocumentationPage({ projectId }) {
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
    const [pdfNote, setPdfNote] = useState(null);
    const [viewMode, setViewMode] = useState("report");
    const [selectedExportKind, setSelectedExportKind] = useState("thermal-protection");
    const sheetRef = useRef(null);
    const hydrateProject = useExpertiseInputsStore((state) => state.hydrateProject);
    const isInputsPanelOpen = useExpertiseInputsStore((state) => state.isPanelOpen);
    const openInputsPanel = useExpertiseInputsStore((state) => state.openPanel);
    const closeInputsPanel = useExpertiseInputsStore((state) => state.closePanel);
    const completenessSummaryOpen = useExpertiseInputsStore((state) => state.completenessSummaryOpen);
    const openCompletenessSummary = useExpertiseInputsStore((state) => state.openCompletenessSummary);
    const closeCompletenessSummary = useExpertiseInputsStore((state) => state.closeCompletenessSummary);
    const getInputs = useExpertiseInputsStore((state) => state.getInputs);
    const resolvedProjectKey = projectKey || projectId || "local-project";
    const thermalResultState = getResultSyncState(Boolean(thermalResult), thermalResultBinding, projectKey, modelRevision);
    const monteCarloResultState = getResultSyncState(Boolean(monteCarloResult), monteCarloResultBinding, projectKey, modelRevision);
    const visibleThermalResult = thermalResultState === "current" ? thermalResult : null;
    const visibleMonteCarloResult = monteCarloResultState === "current" ? monteCarloResult : null;
    const reportMeta = useMemo(() => loadReportMeta(resolvedProjectKey), [resolvedProjectKey]);
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
            const prepared = prepareExportReportInput({
                model,
                projectId,
                scenarioConfig,
                thermalResult: visibleThermalResult,
                monteCarloResult: visibleMonteCarloResult,
                reportMeta,
                generatedAt,
                expertiseInputs,
            }, { applyDemoDefaults });
            const exportBase = buildReportBaseData({
                ...prepared.input,
                appliedAssumptions: prepared.appliedAssumptions,
            });
            return { data, exportBase, error: null };
        }
        catch (error) {
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
    const preflight = useMemo(() => (exportBase ? buildFinalReleaseAudit(exportBase) : null), [exportBase]);
    useEffect(() => {
        hydrateProject(resolvedProjectKey);
    }, [hydrateProject, resolvedProjectKey]);
    const handleGenerate = () => {
        setGeneratedAt(new Date());
        setPdfNote(null);
    };
    const handleViewModeChange = (mode) => {
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
    const handleExportCommand = (kind, mode) => {
        if (!exportBase) {
            setPdfNote("Ошибка подготовки данных документов. Проверьте исходные данные проекта.");
            return;
        }
        if (!canProceedWithExport(exportBase, handleOpenExpertiseInputs)) {
            return;
        }
        dispatchProjectCommand(mode === "download"
            ? REPORT_DOWNLOAD_WORKSPACE_COMMAND[kind]
            : REPORT_EXPORT_WORKSPACE_COMMAND[kind]);
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
            await new Promise((resolve, reject) => {
                pdf.html(sheetRef.current, {
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
                        }
                        catch (error) {
                            reject(error);
                        }
                    },
                });
            });
            setPdfNote("PDF сформирован.");
        }
        catch (error) {
            console.error("PDF export failed, falling back to print dialog.", error);
            setPdfNote("Экспорт в PDF выполнен через системный диалог печати из-за ограничений браузерного рендеринга.");
            window.print();
        }
        finally {
            setPdfBusy(false);
        }
    };
    return (_jsxs("div", { className: "space-y-4", children: [reportBuildError ? (_jsxs("div", { className: "rounded-2xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-fg)]", children: ["\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u0430 \u00AB\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B\u00BB. ", reportBuildError] })) : null, thermalResultState === "stale" || monteCarloResultState === "stale" ? (_jsx("div", { className: "rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]", children: "\u041C\u043E\u0434\u0435\u043B\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0433\u043E \u0440\u0430\u0441\u0447\u0451\u0442\u0430. \u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u0441\u0442\u0440\u043E\u044F\u0442\u0441\u044F \u043F\u043E \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043C\u043E\u0434\u0435\u043B\u0438, \u043D\u043E \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u043D\u0443\u0436\u043D\u043E \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u043C \u0437\u0430\u043F\u0443\u0441\u043A\u043E\u043C \u0440\u0430\u0441\u0447\u0451\u0442\u0430." })) : null, _jsxs("section", { className: "ui-panel document-print-hidden space-y-4 p-4 sm:p-5", children: [_jsxs("div", { className: "flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]", children: "\u041A\u043E\u043C\u043F\u043B\u0435\u043A\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438" }), _jsx("h2", { className: "mt-1 text-lg font-semibold text-[color:var(--text-base)]", children: "\u0420\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u044B \u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0434\u043B\u044F \u0432\u044B\u0433\u0440\u0443\u0437\u043A\u0438" }), _jsx("p", { className: "mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]", children: "\u041F\u0435\u0440\u0435\u0434 \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435\u043C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0430 \u043C\u043E\u0436\u043D\u043E \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u0437\u0430\u0434\u0430\u0442\u044C \u0440\u0435\u043A\u0432\u0438\u0437\u0438\u0442\u044B \u043F\u0440\u043E\u0435\u043A\u0442\u0430, \u043A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0438 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F, \u0430 \u0437\u0430\u0442\u0435\u043C \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u043B\u0435\u0439 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u043D\u043E\u0439 \u0432\u044B\u0433\u0440\u0443\u0437\u043A\u0438." })] }), _jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.08em] text-[color:var(--text-soft)]", children: "\u0421\u0442\u0430\u0442\u0443\u0441 \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u0430" }), _jsx("p", { className: "mt-1 text-lg font-semibold", children: preflight?.statusLabel ?? "Черновик" }), _jsx("p", { className: "text-sm text-[color:var(--text-muted)]", children: preflight?.summary ??
                                            "Проверка статуса станет доступна после подготовки данных документов." }), _jsxs("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: ["\u0417\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E: ", exportBase?.expertise.readiness.filledTotal ?? 0, " \u0438\u0437", " ", exportBase?.expertise.readiness.trackedTotal ?? 0, " \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0438 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u043C\u044B\u0445 \u043F\u043E\u043B\u0435\u0439"] })] })] }), preflight ? (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "Preflight \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u043E\u0439 \u0432\u044B\u0433\u0440\u0443\u0437\u043A\u0438" }), _jsx("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: preflight.summary })] }), _jsxs("div", { className: "text-sm text-[color:var(--text-muted)]", children: ["\u041E\u0448\u0438\u0431\u043A\u0438: ", preflight.blockingIssues.length, " \u00B7 \u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u044F: ", preflight.warningIssues.length] })] }), preflight.blockingIssues.length ? (_jsx("ul", { className: "mt-3 space-y-1 text-sm text-[color:var(--text-muted)]", children: preflight.blockingIssues.map((issue) => (_jsx("li", { children: issue.message }, issue.code))) })) : null] })) : null, _jsxs("div", { className: "grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]", children: [_jsx("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3", children: _jsxs("label", { className: "flex flex-col gap-2 text-sm font-medium text-[color:var(--text-base)]", children: ["\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442", _jsx("select", { value: selectedExportKind, onChange: (event) => setSelectedExportKind(event.target.value), className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm", children: Object.keys(REPORT_EXPORT_TITLE).map((kind) => (_jsx("option", { value: kind, children: REPORT_EXPORT_TITLE[kind] }, kind))) })] }) }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { type: "button", onClick: handleOpenExpertiseInputs, className: "ui-btn-secondary px-4 py-2 text-sm", "data-testid": "open-expertise-inputs-button", children: "\u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u044B" }), _jsx("button", { type: "button", onClick: handleCheckCompleteness, className: "ui-btn-secondary px-4 py-2 text-sm", "data-testid": "check-export-completeness-button", children: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C" }), _jsx("button", { type: "button", onClick: () => handleExportCommand(selectedExportKind, "download"), className: "ui-btn-secondary px-4 py-2 text-sm", children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442" }), _jsx("button", { type: "button", onClick: handleDownloadAll, className: "ui-btn-primary px-4 py-2 text-sm", children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u043E\u0432" }), _jsx("button", { type: "button", onClick: () => handleExportCommand(selectedExportKind, "print"), className: "ui-btn-secondary px-4 py-2 text-sm", children: "\u041F\u0435\u0447\u0430\u0442\u044C / PDF" })] })] }), completenessSummaryOpen ? (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u0438" }), _jsxs("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: ["\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u043E\u043B\u044F: ", exportBase?.expertise.readiness.requiredFilled ?? 0, "/", exportBase?.expertise.readiness.requiredTotal ?? 0, ". \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u043C\u044B\u0435 \u043F\u043E\u043B\u044F:", " ", exportBase?.expertise.readiness.recommendedFilled ?? 0, "/", exportBase?.expertise.readiness.recommendedTotal ?? 0, "."] })] }), _jsx("button", { type: "button", onClick: closeCompletenessSummary, className: "ui-btn-secondary px-3 py-1.5 text-xs", children: "\u0421\u043A\u0440\u044B\u0442\u044C" })] }), _jsxs("div", { className: "mt-3 grid gap-3 lg:grid-cols-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041A\u0440\u0438\u0442\u0438\u0447\u043D\u044B\u0435 \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u044F preflight" }), preflight && preflight.blockingIssues.length ? (_jsx("ul", { className: "mt-2 space-y-1 text-sm text-[color:var(--text-muted)]", children: preflight.blockingIssues.map((issue) => (_jsx("li", { children: issue.message }, issue.code))) })) : (_jsx("p", { className: "mt-2 text-sm text-[color:var(--text-muted)]", children: "\u041A\u0440\u0438\u0442\u0438\u0447\u043D\u044B\u0445 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u043E\u0432 \u043D\u0435 \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u043E." }))] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0414\u0430\u043D\u043D\u044B\u0435, \u0442\u0440\u0435\u0431\u0443\u044E\u0449\u0438\u0435 \u0443\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u044F" }), _jsx("ul", { className: "mt-2 space-y-1 text-sm text-[color:var(--text-muted)]", children: (exportBase?.expertise.clarificationLines ?? []).map((line, index) => (_jsx("li", { children: line }, `${index}-${line}`))) })] })] })] })) : null] }), _jsx(ProjectDocumentToolbar, { viewMode: viewMode, onViewModeChange: handleViewModeChange, onGenerate: handleGenerate, onPrint: handlePrint, onExportPdf: handleExportPdf, pdfBusy: pdfBusy, pdfNote: pdfNote }), viewMode === "reference" ? (_jsx(NormativeDocumentPage, {})) : data ? (_jsx(ThermalProtectionReport, { data: data, sheetRef: sheetRef })) : (_jsx("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3 text-sm text-[color:var(--text-muted)]", children: "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D: \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u043E\u0442\u0447\u0451\u0442\u0430." })), isInputsPanelOpen && exportBase ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]", onClick: closeInputsPanel }), _jsx(ExpertReportSettingsForm, { projectKey: resolvedProjectKey, expertise: exportBase.expertise, onClose: closeInputsPanel })] })) : null] }));
}
function buildPdfFilename(generatedAt) {
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
export function ProjectDocumentationPage(_props) {
    return (_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-6 text-sm text-[color:var(--text-muted)]", children: [_jsx("p", { className: "text-base font-semibold text-[color:var(--text-base)]", children: "\u0420\u0430\u0437\u0434\u0435\u043B \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0441\u043A\u0440\u044B\u0442" }), _jsx("p", { className: "mt-2 max-w-2xl", children: "\u0412\u044B\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438 \u0431\u0443\u0434\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u043F\u043E\u0441\u043B\u0435 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0438. \u0420\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0435 \u043E\u0442\u0447\u0451\u0442\u044B, \u0442\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043A\u0430\u0440\u0442\u0430, \u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u0438 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u043F\u043E-\u043F\u0440\u0435\u0436\u043D\u0435\u043C\u0443 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u043D\u0430 \u0434\u0440\u0443\u0433\u0438\u0445 \u0432\u043A\u043B\u0430\u0434\u043A\u0430\u0445." })] }));
}
export default ProjectDocumentationPage;
function canProceedWithExport(base, openInputsPanel) {
    if (base.preflight.generationMode !== "final" || base.preflight.blockingIssues.length === 0) {
        return true;
    }
    if (typeof window === "undefined") {
        return false;
    }
    const fields = base.preflight.blockingIssues
        .map((issue) => `• ${issue.message}`)
        .join("\n");
    window.alert(`Финальная выгрузка заблокирована. Устраните следующие замечания:\n\n${fields}`);
    openInputsPanel();
    return false;
}
