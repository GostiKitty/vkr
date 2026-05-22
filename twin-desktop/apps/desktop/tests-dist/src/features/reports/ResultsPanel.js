import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useTwinStore } from "../../entities/twin/twin.store";
import { EngineeringCallout, EngineeringMetricTile, EngineeringSectionHeader, TemperatureScaleLegend } from "../../shared/ui";
import { Tabs } from "../../shared/ui";
import SpaceDetails from "../twin/SpaceDetails";
import SpaceList from "../twin/SpaceList";
import SpaceViewer3D from "../twin/SpaceViewer3D";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useWorkspaceStore } from "../../entities/workspace/workspace.store";
import ReportGenerator from "./ReportGenerator";
import MetricsResultsTab from "./MetricsResultsTab";
import ProjectDocumentationPage from "./ProjectDocumentationPage";
import { formatTemperature, temperatureToColor } from "../twin/twin.theme";
const tabItems = [
    {
        id: "overview",
        label: "Помещения",
        hint: "Список зон и карточка выбранного помещения",
    },
    {
        id: "metrics",
        label: "Показатели",
        hint: "KPI, графики T(t) и доли потерь после зонального расчёта",
    },
    {
        id: "view3d",
        label: "Карта и связи",
        hint: "3D-окраска и граф тепловых связей зон (не CFD)",
    },
    {
        id: "passport",
        label: "Справка по ПП РФ №87",
        hint: "Справочный материал по составу проектной документации РФ. Готовые выгрузки документов теперь доступны в меню «Выгрузка документов» в верхней панели.",
    },
];
const calculationContours = [
    {
        id: "rc",
        title: "RC-модель помещения",
        description: "Основной зональный расчёт во времени: температуры, энергия, пиковая нагрузка и сценарный Monte Carlo поверх RC.",
    },
    {
        id: "engineering",
        title: "Инженерный квазистационарный баланс",
        description: "Разложение потерь по ограждениям, окнам, дверям, вентиляции и инфильтрации для инженерной интерпретации результата.",
    },
    {
        id: "sp50",
        title: "Проверка по СП 50",
        description: "Отдельный нормативный контур по ограждающим конструкциям. Не равен RC-результатам и не заменяется ими.",
    },
    {
        id: "transient1d",
        title: "1D transient расчёт конструкции",
        description: "Отдельный послойный нестационарный анализ конструкции. Используется как самостоятельный контур, а не как часть основного RC solver.",
    },
    {
        id: "legacy",
        title: "Legacy report / legacy Monte Carlo path",
        description: "Устаревший отчётный контур по данным Twin API. Требует синхронизации с основным расчётом конструктора и помечается отдельно.",
    },
];
export function ResultsPanel(props) {
    const frames = useTwinStore((state) => state.simulationFrames);
    const timeIndex = useTwinStore((state) => state.timeIndex);
    const setTimeIndex = useTwinStore((state) => state.setTimeIndex);
    const thermalGraph = useTwinStore((state) => state.thermalGraph);
    const simulationDataSource = useTwinStore((state) => state.simulationDataSource);
    const selectSpace = useTwinStore((state) => state.selectSpace);
    const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
    const setWorkflowStep = useWorkflowStore((state) => state.setCurrentStep);
    const workspaceCommand = useWorkspaceStore((state) => state.command);
    const workspaceCommandNonce = useWorkspaceStore((state) => state.commandNonce);
    const consumeProjectCommand = useWorkspaceStore((state) => state.consumeProjectCommand);
    const [playing, setPlaying] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const currentFrame = frames[timeIndex] ?? null;
    const timeLabel = currentFrame ? formatTime(currentFrame.time) : "—";
    const frameTempRange = useMemo(() => {
        const t = currentFrame?.temperatures;
        if (!t) {
            return { min: null, max: null };
        }
        const vals = Object.values(t).filter((v) => Number.isFinite(v));
        if (!vals.length) {
            return { min: null, max: null };
        }
        return { min: Math.min(...vals), max: Math.max(...vals) };
    }, [currentFrame]);
    useEffect(() => {
        if (!playing || frames.length < 2) {
            return;
        }
        const interval = setInterval(() => {
            const { setTimeIndex: update, timeIndex: current } = useTwinStore.getState();
            const next = current + 1 >= frames.length ? 0 : current + 1;
            update(next);
        }, 800);
        return () => clearInterval(interval);
    }, [playing, frames.length]);
    useEffect(() => {
        if (!frames.length) {
            setPlaying(false);
        }
    }, [frames.length]);
    useEffect(() => {
        if (workspaceCommand !== "export-report") {
            return;
        }
        setActiveTab("passport");
        consumeProjectCommand(workspaceCommandNonce);
    }, [consumeProjectCommand, workspaceCommand, workspaceCommandNonce]);
    const handleSliderChange = (event) => {
        setTimeIndex(Number(event.target.value));
    };
    const handlePlayToggle = () => {
        if (!frames.length) {
            return;
        }
        setPlaying((prev) => !prev);
    };
    const tabContent = {
        overview: (_jsxs("div", { className: "grid gap-4 lg:grid-cols-[1fr,0.7fr]", children: [_jsx(SpaceList, {}), _jsx(SpaceDetails, {})] })),
        metrics: (_jsx(MetricsResultsTab, { onRecalculate: () => setWorkflowStep("solve"), onEditUncertainty: () => setWorkflowStep("uncertainty") })),
        view3d: (_jsxs("div", { className: "space-y-4", children: [_jsx(SpaceViewer3D, { heatmap: true, caption: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u043E \u0437\u043E\u043D\u0430\u043C", height: 420, showLegend: true, showFitControl: true }), _jsx(GraphPanel, { graph: thermalGraph, frame: currentFrame, selectedId: selectedSpaceId, onSelect: selectSpace })] })),
        passport: _jsx(ProjectDocumentationPage, { projectId: props.projectId }),
    };
    return (_jsxs("div", { className: "flex min-h-0 flex-col gap-6", children: [_jsx("div", { className: "ui-panel shrink-0 p-5 ring-1 ring-[color:var(--accent-muted)]/30 sm:p-6", children: _jsxs("div", { className: "flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between", children: [_jsx(EngineeringSectionHeader, { kicker: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B", title: "\u041E\u0431\u0437\u043E\u0440 \u043F\u043E\u0441\u043B\u0435 \u0440\u0430\u0441\u0447\u0451\u0442\u0430", subtitle: "\u0421\u0434\u0432\u0438\u0433\u0430\u0439\u0442\u0435 \u043C\u043E\u043C\u0435\u043D\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C, \u043A\u0430\u043A \u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B. \u0412\u043A\u043B\u0430\u0434\u043A\u0438: \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F, \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u0440\u0430\u0441\u0447\u0451\u0442\u0430, 3D \u0438 \u0433\u0440\u0430\u0444 \u0441\u0432\u044F\u0437\u0435\u0439." }), simulationDataSource === "demo" && frames.length > 0 ? (_jsx("span", { className: "mt-2 inline-flex rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--warning-fg)]", children: "\u0414\u0435\u043C\u043E-\u043A\u0430\u0434\u0440\u044B twin" })) : simulationDataSource === "computed" ? (_jsx("span", { className: "mt-2 inline-flex rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--success-fg)]", children: "\u041F\u043E\u0441\u043B\u0435 \u0440\u0430\u0441\u0447\u0451\u0442\u0430 RC" })) : null, frames.length > 0 ? (_jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(EngineeringMetricTile, { label: "\u041A\u0430\u0434\u0440\u044B \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438", value: frames.length, hint: "\u0414\u0438\u0441\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u0448\u0430\u0433\u0438 \u043F\u043E\u0441\u043B\u0435 \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0430\u0441\u0447\u0451\u0442\u0430", tone: "neutral" }), _jsx(EngineeringMetricTile, { label: "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043A\u0430\u0434\u0440", value: timeIndex + 1, unit: ` / ${frames.length}`, hint: "\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u043D\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u043E\u0441\u0438", tone: "neutral" }), _jsx(EngineeringMetricTile, { label: "\u041C\u0438\u043D. T \u043F\u043E \u0437\u043E\u043D\u0430\u043C (\u043A\u0430\u0434\u0440)", value: frameTempRange.min == null ? "—" : formatTemperature(frameTempRange.min), hint: "\u041C\u0438\u043D\u0438\u043C\u0443\u043C \u043F\u043E \u0432\u0441\u0435\u043C \u0437\u043E\u043D\u0430\u043C \u0432 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043C\u0435\u043D\u0442", tone: "neutral" }), _jsx(EngineeringMetricTile, { label: "\u041C\u0430\u043A\u0441. T \u043F\u043E \u0437\u043E\u043D\u0430\u043C (\u043A\u0430\u0434\u0440)", value: frameTempRange.max == null ? "—" : formatTemperature(frameTempRange.max), hint: "\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u043F\u043E \u0432\u0441\u0435\u043C \u0437\u043E\u043D\u0430\u043C \u0432 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043C\u0435\u043D\u0442", tone: "neutral" })] })) : null, _jsxs("div", { className: "mt-5 flex w-full flex-col gap-3 xl:max-w-md", children: [_jsxs("div", { className: "flex items-center justify-between text-sm font-medium text-[color:var(--text-muted)]", children: [_jsx("span", { children: "\u041C\u043E\u043C\u0435\u043D\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438" }), _jsx("span", { className: "tabular-nums text-[color:var(--text-base)]", children: timeLabel })] }), _jsx("input", { type: "range", min: 0, max: Math.max(frames.length - 1, 0), value: timeIndex, onChange: handleSliderChange, className: "w-full accent-[color:var(--accent-base)]", disabled: !frames.length }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("button", { type: "button", onClick: handlePlayToggle, disabled: !frames.length, className: !frames.length
                                                ? "cursor-not-allowed rounded-full px-4 py-2 text-sm font-semibold opacity-45 ui-btn-secondary"
                                                : playing
                                                    ? "ui-btn-secondary rounded-full px-4 py-2 text-sm"
                                                    : "ui-btn-primary rounded-full px-4 py-2 text-sm", children: playing ? "Пауза" : "Пуск по шагам" }), _jsx("span", { className: "text-xs text-[color:var(--text-soft)]", children: frames.length ? `${frames.length} шагов` : "Сначала выполните расчёт на шаге «Расчёт» студии" }), _jsx("button", { type: "button", onClick: () => setActiveTab("view3d"), className: "ui-btn-secondary ml-auto px-3 py-1.5 text-xs", children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043D\u0430 \u043C\u043E\u0434\u0435\u043B\u0438" })] }), frameTempRange.min != null && frameTempRange.max != null && (_jsxs("p", { className: "text-xs text-[color:var(--text-muted)]", children: ["\u0412 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 \u043F\u043E \u0437\u043E\u043D\u0430\u043C:", " ", _jsxs("span", { className: "font-semibold tabular-nums text-[color:var(--text-base)]", children: [formatTemperature(frameTempRange.min), " \u2026 ", formatTemperature(frameTempRange.max)] })] }))] })] }) }), _jsxs("div", { className: "shrink-0", children: [_jsxs("div", { className: "ui-panel-muted mb-4 space-y-3 rounded-2xl p-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0420\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0435 \u043A\u043E\u043D\u0442\u0443\u0440\u044B" }), _jsx("p", { className: "text-sm text-[color:var(--text-muted)]", children: "\u0412 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430\u0445 \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043F\u0440\u0438\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u044B\u0445 \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0445 \u043A\u043E\u043D\u0442\u0443\u0440\u043E\u0432. \u0418\u0445 \u043D\u0443\u0436\u043D\u043E \u0447\u0438\u0442\u0430\u0442\u044C \u0440\u0430\u0437\u0434\u0435\u043B\u044C\u043D\u043E, \u0430 \u043D\u0435 \u043A\u0430\u043A \u043E\u0434\u0438\u043D \u043E\u0431\u0449\u0438\u0439 solver." })] }), _jsx("div", { className: "grid gap-3 xl:grid-cols-2", children: calculationContours.map((contour) => (_jsxs("article", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: contour.title }), _jsx("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: contour.description })] }, contour.id))) })] }), _jsx(Tabs, { tabs: tabItems, value: activeTab, onChange: setActiveTab }), _jsx("p", { className: "mt-2 text-xs text-[color:var(--text-soft)]", children: "\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430: \u043D\u0430\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430 \u0432\u043A\u043B\u0430\u0434\u043A\u0443 \u2014 \u043A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435. \u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0438 \u0438 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u043D\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u043E\u0441\u0442\u0438 \u043D\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0432 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0435 \u043F\u0440\u043E\u0435\u043A\u0442\u0430." })] }), _jsx(EngineeringCallout, { variant: "info", title: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u0438 3D", children: _jsx("p", { children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u0430 \u043F\u043E \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0439 \u043C\u043E\u0434\u0435\u043B\u0438 \u0438 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F CFD. \u041E\u043A\u0440\u0430\u0441\u043A\u0430 \u043E\u0442\u0440\u0430\u0436\u0430\u0435\u0442 \u0443\u0441\u0440\u0435\u0434\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u043E \u043E\u0431\u044A\u0451\u043C\u0443 \u0437\u043E\u043D\u044B \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B RC-\u043C\u043E\u0434\u0435\u043B\u0438. \u041A\u043E\u043B\u0451\u0441\u0438\u043A\u043E \u043C\u044B\u0448\u0438 \u2014 \u043C\u0430\u0441\u0448\u0442\u0430\u0431, \u043F\u0435\u0440\u0435\u0442\u0430\u0441\u043A\u0438\u0432\u0430\u043D\u0438\u0435 \u2014 \u043E\u0431\u0437\u043E\u0440." }) }), _jsx("div", { className: "ui-panel min-h-0 p-4 sm:p-5 xl:p-6", children: tabContent[activeTab] }), _jsx("div", { id: "report-generator-anchor", className: "shrink-0 scroll-mt-28", children: _jsx(ReportGenerator, {}) })] }));
}
function GraphPanel({ graph, frame, selectedId, onSelect, }) {
    if (!graph || !graph.nodes.length) {
        return (_jsx("div", { className: "rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0433\u0440\u0430\u0444 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043C\u043E\u0434\u0435\u043B\u0438 \u0438 \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u043A\u0430\u0434\u0440\u043E\u0432 \u0441\u0438\u043C\u0443\u043B\u044F\u0446\u0438\u0438 \u0432 \u0441\u0442\u0443\u0434\u0438\u0438." }));
    }
    const width = 600;
    const height = 320;
    const nodes = graph.nodes;
    const edges = graph.edges;
    const frameTemps = frame
        ? Object.values(frame.temperatures).filter((value) => Number.isFinite(value))
        : [];
    const dynamicMin = frameTemps.length ? Math.min(...frameTemps) : 15;
    const dynamicMax = frameTemps.length ? Math.max(...frameTemps) : 30;
    const legendMin = Math.min(15, dynamicMin);
    const legendMax = Math.max(30, dynamicMax);
    const scaleClamped = dynamicMin < 15 || dynamicMax > 30;
    const positions = new Map();
    const spaceNodes = nodes.filter((node) => node.type === "space");
    const radius = Math.min(width, height) / 2 - 40;
    spaceNodes.forEach((node, index) => {
        const angle = (index / Math.max(spaceNodes.length, 1)) * Math.PI * 2;
        positions.set(node.id, {
            x: width / 2 + radius * Math.cos(angle),
            y: height / 2 + radius * Math.sin(angle),
        });
    });
    positions.set("outdoor", { x: width / 2, y: 40 });
    return (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 shadow-sm", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0433\u0440\u0430\u0444 \u0437\u043E\u043D" }), _jsx("p", { className: "mt-1 text-xs text-[color:var(--text-muted)]", children: "\u0423\u0441\u043B\u043E\u0432\u043D\u0430\u044F \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u0430\u044F \u043C\u043E\u0434\u0435\u043B\u044C. \u0422\u043E\u043B\u0449\u0438\u043D\u0430 \u043B\u0438\u043D\u0438\u0438 \u221D \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u044C (\u0412\u0442/\u041A). \u041D\u0435 CFD." })] }), _jsx(TemperatureScaleLegend, { caption: scaleClamped
                            ? `Шкала ${legendMin.toFixed(0)}…${legendMax.toFixed(0)} °C (кадр: ${dynamicMin.toFixed(1)}…${dynamicMax.toFixed(1)} °C).`
                            : `Шкала ${legendMin.toFixed(0)}…${legendMax.toFixed(0)} °C для узлов кадра.` })] }), _jsx("div", { className: "w-full overflow-x-auto", children: _jsxs("svg", { width: width, height: height, className: "max-w-full", children: [edges.map((edge) => {
                            const from = positions.get(edge.from);
                            const to = positions.get(edge.to);
                            if (!from || !to) {
                                return null;
                            }
                            return (_jsx("line", { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: "var(--chart-edge)", strokeWidth: Math.max(1, edge.conductance * 4), strokeOpacity: 0.85 }, `${edge.from}-${edge.to}`));
                        }), nodes.map((node) => {
                            const pos = positions.get(node.id);
                            if (!pos) {
                                return null;
                            }
                            const temp = frame?.temperatures[node.id] ?? node.initialTemp;
                            const color = temperatureToColor(temp, legendMin, legendMax);
                            const displayLabel = node.id === "outdoor" ? "Наружный воздух" : node.label;
                            const isSelected = selectedId === node.id;
                            return (_jsxs("g", { onClick: () => node.type === "space" && onSelect(node.id), cursor: node.type === "space" ? "pointer" : "default", children: [_jsx("circle", { cx: pos.x, cy: pos.y, r: isSelected ? 18 : 14, fill: color, stroke: node.type === "space" ? "var(--text-base)" : "var(--text-soft)", strokeWidth: node.type === "space" ? 2 : 1, opacity: node.type === "space" ? 0.95 : 0.7 }), _jsx("text", { x: pos.x, y: pos.y + 30, textAnchor: "middle", className: "text-xs font-medium fill-[color:var(--text-muted)]", children: displayLabel }), _jsx("text", { x: pos.x, y: pos.y + 44, textAnchor: "middle", className: "text-[10px] fill-[color:var(--text-soft)]", children: formatTemperature(temp) })] }, node.id));
                        })] }) })] }));
}
function formatTime(timeHours) {
    const hours = Math.floor(timeHours);
    const minutes = Math.round((timeHours - hours) * 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
export default ResultsPanel;
