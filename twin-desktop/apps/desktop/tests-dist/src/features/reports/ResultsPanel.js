import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { runEngineeringThermalAnalysis } from "../../core/thermal/engineering/analysis";
import { getRoomDisplayName } from "../../core/thermal/engineering/display";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useBuildStore } from "../build/build.store";
import { applyScenarioToBuilding } from "../build/thermal/applyScenarioToBuilding";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import { buildDefaultEconomicScenario, runEconomicAssessment } from "../../core/economics/analysis";
import { buildZoneSeries } from "../../core/thermal/thermalResultsChartPayload";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { navigate } from "../../app/router";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useWorkspaceStore } from "../../entities/workspace/workspace.store";
import { AnimatedTabs, EmptyState, MetricInfoTooltip, SummaryHero, SummaryHighlightGrid, TemperatureScaleLegend, } from "../../shared/ui";
import { formatEnergy, formatNumber, formatPercentage } from "../../shared/utils/format";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { runLocalThermalCalculation } from "../runs/runLocalThermalCalculation";
import { runThermalMonteCarloAnalysis } from "../scenarios/runThermalMonteCarloAnalysis";
import MetricsResultsTab from "./MetricsResultsTab";
import MonteCarloResultsSection from "./MonteCarloResultsSection";
import { TemperatureHeatmapPanel, } from "./charts/TemperatureHeatmapPanel";
// Temporarily hidden from UI. Will be restored after project documentation export redesign.
// import ProjectDocumentationPage from "./ProjectDocumentationPage";
import ResultsEconomyTab from "./ResultsEconomyTab";
import { buildResultsSp50Report } from "./resultsSp50";
import { resultsMetricInfo } from "./resultsMetricInfo";
import SpaceDetails from "../twin/SpaceDetails";
import SpaceViewer3D from "../twin/SpaceViewer3D";
import { formatTemperature, temperatureToColor } from "../twin/twin.theme";
// Temporarily hidden from UI. Will be restored after project documentation export redesign.
// const HIDDEN_DOCUMENTS_TAB = { id: "documents" as const, label: "Документы", hint: "Существующий экспертный контур ProjectDocumentationPage / ПП РФ №87" };
const tabItems = [
    { id: "overview", label: "Обзор", hint: "Краткий инженерный обзор результатов" },
    { id: "thermal", label: "Тепловой расчёт", hint: "Нестационарный RC-расчёт и исходные графики" },
    { id: "probabilistic", label: "Вероятностный анализ", hint: "Monte Carlo: P10/P50/P90, гистограмма и чувствительность" },
    { id: "economy", label: "Экономика", hint: "Экономическая оценка на базе существующего SP50/engineering контура" },
    { id: "map", label: "Карта", hint: "3D-карта, тепловой граф и таймлайн" },
];
// projectId оставлен в props для будущей привязки к ProjectDocumentationPage
// (см. комментарий «Temporarily hidden from UI»). Пока не используется в UI.
export function ResultsPanel({ projectId: _projectId }) {
    const frames = useTwinStore((state) => state.simulationFrames);
    const timeIndex = useTwinStore((state) => state.timeIndex);
    const setTimeIndex = useTwinStore((state) => state.setTimeIndex);
    const thermalGraph = useTwinStore((state) => state.thermalGraph);
    const lastThermalResult = useTwinStore((state) => state.lastThermalResult);
    const lastThermalResultBinding = useTwinStore((state) => state.lastThermalResultBinding);
    const selectSpace = useTwinStore((state) => state.selectSpace);
    const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
    const buildModel = useBuildStore((state) => state.model);
    const projectKey = useBuildStore((state) => state.projectKey);
    const modelRevision = useBuildStore((state) => state.modelRevision);
    const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
    const monteCarloResult = useWorkflowStore((state) => state.monteCarloResult);
    const monteCarloResultBinding = useWorkflowStore((state) => state.monteCarloResultBinding);
    const workspaceCommand = useWorkspaceStore((state) => state.command);
    const workspaceCommandNonce = useWorkspaceStore((state) => state.commandNonce);
    const consumeProjectCommand = useWorkspaceStore((state) => state.consumeProjectCommand);
    const [playing, setPlaying] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [autoRunState, setAutoRunState] = useState("idle");
    const [autoRunError, setAutoRunError] = useState(null);
    const [autoRunMessage, setAutoRunMessage] = useState(null);
    const thermalRunInFlightRef = useRef(false);
    const thermalResultState = getResultSyncState(Boolean(lastThermalResult), lastThermalResultBinding, projectKey, modelRevision);
    const monteCarloResultState = getResultSyncState(Boolean(monteCarloResult), monteCarloResultBinding, projectKey, modelRevision);
    const visibleThermalResult = thermalResultState === "current" ? lastThermalResult : null;
    const visibleMonteCarloResult = monteCarloResultState === "current" ? monteCarloResult : null;
    const visibleFrames = thermalResultState === "current" ? frames : [];
    const visibleThermalGraph = thermalResultState === "current" ? thermalGraph : null;
    const currentFrame = visibleFrames[timeIndex] ?? null;
    const timeLabel = currentFrame ? formatFrameTime(currentFrame.time) : "—";
    const activeOptions = useMemo(() => buildThermalOptionsFromWorkflow(scenarioConfig), [scenarioConfig]);
    const climateLabel = scenarioConfig?.climateCityId
        ? getSp131CityClimate(scenarioConfig.climateCityId)?.label ?? scenarioConfig.climateCityId
        : null;
    const zoneRows = useMemo(() => (visibleThermalResult ? buildZoneSeries(visibleThermalResult) : []), [visibleThermalResult]);
    const sp50Report = useMemo(() => buildResultsSp50Report(buildModel, scenarioConfig), [buildModel, scenarioConfig]);
    const economyAssessment = useMemo(() => {
        if (!sp50Report) {
            return null;
        }
        return runEconomicAssessment(sp50Report, buildDefaultEconomicScenario(sp50Report));
    }, [sp50Report]);
    const roomRows = useMemo(() => {
        if (!visibleThermalResult) {
            return [];
        }
        const zoneById = new Map(zoneRows.map((row) => [row.zoneId, row]));
        const roomRiskById = new Map((visibleMonteCarloResult?.roomRiskSummary ?? []).map((room) => [room.roomId, room]));
        return Object.values(visibleThermalResult.rooms).map((room, index) => {
            const temperatures = room.timeline.map((point) => point.temperatureC).filter((value) => Number.isFinite(value));
            const avgTemperature = temperatures.length > 0 ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length : null;
            const minTemperature = temperatures.length > 0 ? Math.min(...temperatures) : null;
            const risk = roomRiskById.get(room.roomId);
            const zone = zoneById.get(room.roomId);
            return {
                roomId: room.roomId,
                roomName: zone?.zoneName ?? buildModel.rooms[index]?.name ?? room.roomId,
                energyKWh: room.dailyEnergyKWh,
                avgTemperatureC: avgTemperature,
                minTemperatureC: minTemperature,
                discomfortHours: room.discomfortHours,
                underheatingRisk: risk?.underheatingRisk ?? null,
                status: zone?.statusNote ?? (risk && risk.underheatingRisk >= 0.3 ? "Повышенный риск" : "Норма"),
            };
        });
    }, [buildModel.rooms, visibleMonteCarloResult?.roomRiskSummary, visibleThermalResult, zoneRows]);
    const handleRunCalculation = useCallback(() => {
        if (thermalRunInFlightRef.current) {
            return;
        }
        thermalRunInFlightRef.current = true;
        setAutoRunState("running");
        setAutoRunError(null);
        setAutoRunMessage("Выполняется базовый RC-расчёт. После завершения метрики и графики обновятся автоматически.");
        window.setTimeout(() => {
            try {
                runLocalThermalCalculation();
                setAutoRunState("success");
                setAutoRunMessage("Базовый расчёт обновлён. Отчёты и графики синхронизированы с текущей моделью.");
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Не удалось выполнить расчёт.";
                setAutoRunError(message);
                setAutoRunState("error");
                setAutoRunMessage(null);
            }
            finally {
                thermalRunInFlightRef.current = false;
            }
        }, 0);
    }, []);
    const handleRunFullAnalysis = useCallback(() => {
        if (thermalRunInFlightRef.current) {
            return;
        }
        thermalRunInFlightRef.current = true;
        setAutoRunState("running");
        setAutoRunError(null);
        setAutoRunMessage("Выполняются базовый RC-расчёт и вероятностный анализ Monte Carlo. Результаты обновятся автоматически.");
        setActiveTab("probabilistic");
        window.setTimeout(() => {
            try {
                runLocalThermalCalculation();
                runThermalMonteCarloAnalysis();
                setAutoRunState("success");
                setAutoRunMessage(null);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Не удалось выполнить полный анализ.";
                setAutoRunError(message);
                setAutoRunState("error");
                setAutoRunMessage(null);
            }
            finally {
                thermalRunInFlightRef.current = false;
            }
        }, 0);
    }, []);
    useEffect(() => {
        if (!playing || visibleFrames.length < 2) {
            return;
        }
        const interval = setInterval(() => {
            const { setTimeIndex: update, timeIndex: current } = useTwinStore.getState();
            const next = current + 1 >= visibleFrames.length ? 0 : current + 1;
            update(next);
        }, 800);
        return () => clearInterval(interval);
    }, [playing, visibleFrames.length]);
    useEffect(() => {
        if (!visibleFrames.length) {
            setPlaying(false);
        }
    }, [visibleFrames.length]);
    useEffect(() => {
        if (workspaceCommand !== "export-report") {
            return;
        }
        // Temporarily hidden from UI. Will be restored after project documentation export redesign.
        // Раньше команда переключала вкладку «Документы». Сейчас просто гасим её,
        // чтобы фоновые dispatch не сбивали активную вкладку.
        consumeProjectCommand(workspaceCommandNonce);
    }, [consumeProjectCommand, workspaceCommand, workspaceCommandNonce]);
    useEffect(() => {
        if (workspaceCommand !== "run-thermal-calculation") {
            return;
        }
        consumeProjectCommand(workspaceCommandNonce);
        handleRunCalculation();
    }, [consumeProjectCommand, handleRunCalculation, workspaceCommand, workspaceCommandNonce]);
    useEffect(() => {
        if (workspaceCommand !== "run-full-analysis") {
            return;
        }
        consumeProjectCommand(workspaceCommandNonce);
        handleRunFullAnalysis();
    }, [consumeProjectCommand, handleRunFullAnalysis, workspaceCommand, workspaceCommandNonce]);
    const tabContent = {
        overview: (_jsx(OverviewTab, { climateLabel: climateLabel, economyAssessment: economyAssessment, lastThermalResult: visibleThermalResult, monteCarloResult: visibleMonteCarloResult, onOpenCalculation: handleRunCalculation, onOpenEconomy: () => setActiveTab("economy"), onOpenMonteCarlo: () => navigate("/uncertainty"), onOpenThermal: () => setActiveTab("thermal") })),
        thermal: (_jsx(MetricsResultsTab, { onRecalculate: handleRunCalculation, onEditUncertainty: () => navigate("/uncertainty") })),
        probabilistic: (_jsx(MonteCarloResultsSection, { baseResult: visibleThermalResult, baseOptions: activeOptions, buildingModel: buildModel, climateLabel: climateLabel, monteCarloResult: visibleMonteCarloResult, onEditUncertainty: () => navigate("/uncertainty"), onRunCalculation: handleRunCalculation })),
        economy: _jsx(ResultsEconomyTab, { report: sp50Report, onOpenBuild: () => navigate("/build") }),
        rooms: (_jsx(RoomsTab, { rows: roomRows, hasRcResults: Boolean(visibleThermalResult), onOpenCalculation: handleRunCalculation, onSelectRoom: selectSpace })),
        map: (_jsx(MapTab, { buildModel: buildModel, currentFrame: currentFrame, frames: visibleFrames, graph: visibleThermalGraph, onSelectRoom: selectSpace, onSliderChange: (value) => setTimeIndex(value), onTogglePlay: () => setPlaying((prev) => !prev), playing: playing, scenarioConfig: scenarioConfig, selectedRoomId: selectedSpaceId, simulationOptions: activeOptions, thermalResult: visibleThermalResult, timeIndex: timeIndex, timeLabel: timeLabel, onOpenCalculation: handleRunCalculation })),
        // Temporarily hidden from UI. Will be restored after project documentation export redesign.
        // documents: <ProjectDocumentationPage projectId={projectId} />,
    };
    return (_jsxs("div", { className: "flex min-h-0 flex-col gap-4", children: [_jsxs(SummaryHero, { title: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043F\u0440\u043E\u0435\u043A\u0442\u0430", children: [autoRunState === "running" ? (_jsx("div", { className: "rounded-2xl border border-[color:var(--accent-base)]/20 bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-base)]", children: autoRunMessage })) : null, autoRunState === "error" && autoRunError ? (_jsx("div", { className: "rounded-2xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-fg)]", children: autoRunError })) : null, thermalResultState === "stale" || monteCarloResultState === "stale" ? (_jsx("div", { className: "rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]", children: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043C\u043E\u0434\u0435\u043B\u0438. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442 \u0437\u0430\u043D\u043E\u0432\u043E \u043F\u0435\u0440\u0435\u0434 \u0430\u043D\u0430\u043B\u0438\u0437\u043E\u043C \u0438 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u043E\u043C." })) : null, _jsx(ResultsSummaryBar, { energy: visibleThermalResult?.summary.totalEnergyKWh ?? null, peakLoad: visibleThermalResult?.summary.peakLoadKW ?? null, discomfortHours: visibleThermalResult?.summary.discomfortHours ?? null, monteCarloP50: visibleMonteCarloResult?.totalEnergy.p50 ?? null, underheatingRisk: visibleMonteCarloResult?.underheatingBelow20CProbability ?? null })] }), _jsx(AnimatedTabs, { tabs: tabItems, value: activeTab, onChange: setActiveTab }), _jsx("div", { className: "ui-panel min-h-0 p-4 sm:p-5 xl:p-6", children: _jsx("div", { className: "animate-fade-slide min-h-[20rem]", children: tabContent[activeTab] }, activeTab) })] }));
}
function ResultsSummaryBar({ energy, peakLoad, discomfortHours, monteCarloP50, underheatingRisk, }) {
    return (_jsx(SummaryHighlightGrid, { className: "mt-1", items: [
            {
                label: "Тепловая энергия",
                value: formatEnergy(energy, "кВт·ч"),
                metricInfo: resultsMetricInfo.energy,
                calculated: energy != null,
            },
            {
                label: "Пиковая нагрузка",
                value: peakLoad == null ? "—" : `${formatNumber(peakLoad, { maximumFractionDigits: 2 })} кВт`,
                metricInfo: resultsMetricInfo.peakLoad,
                calculated: peakLoad != null,
            },
            {
                label: "Часы дискомфорта",
                value: discomfortHours == null
                    ? "—"
                    : `${formatNumber(discomfortHours, { maximumFractionDigits: 1 })} ч`,
                metricInfo: resultsMetricInfo.discomfort,
                calculated: discomfortHours != null,
            },
            {
                label: "Медиана Monte Carlo",
                value: formatEnergy(monteCarloP50, "кВт·ч"),
                tone: monteCarloP50 != null ? "info" : "neutral",
                metricInfo: resultsMetricInfo.monteCarloP50,
                calculated: monteCarloP50 != null,
            },
            {
                label: "Риск недогрева",
                value: formatPercentage(underheatingRisk),
                tone: underheatingRisk != null && underheatingRisk > 0.15 ? "warning" : "neutral",
                metricInfo: resultsMetricInfo.underheatingRisk,
                calculated: underheatingRisk != null,
            },
        ] }));
}
function OverviewTab({ climateLabel, economyAssessment, lastThermalResult, monteCarloResult, onOpenCalculation, onOpenEconomy, onOpenMonteCarlo, onOpenThermal, }) {
    if (!lastThermalResult && !monteCarloResult) {
        return (_jsxs("section", { className: "rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-5", children: [_jsx(EmptyState, { title: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u0432 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430\u0445", message: "\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 RC-\u0440\u0430\u0441\u0447\u0451\u0442 \u0438\u043B\u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 Monte Carlo, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u044F\u0432\u0438\u043B\u0438\u0441\u044C KPI, \u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u0438 \u0441\u0432\u043E\u0434\u043A\u0430." }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2", children: [_jsx("button", { type: "button", onClick: onOpenCalculation, className: "ui-btn-primary px-4 py-2 text-sm", children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442" }), _jsx("button", { type: "button", onClick: onOpenMonteCarlo, className: "ui-btn-secondary px-4 py-2 text-sm", children: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u0430\u043D\u0430\u043B\u0438\u0437\u0443" })] })] }));
    }
    return (_jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "grid gap-4 xl:grid-cols-[1.15fr,0.85fr]", children: [_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0440\u0430\u0441\u0447\u0451\u0442" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.rcBalance })] }), lastThermalResult ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsx(OverviewMetric, { label: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434", value: formatEnergy(lastThermalResult.summary.totalEnergyKWh, "кВт·ч"), info: resultsMetricInfo.energy }), _jsx(OverviewMetric, { label: "\u041F\u0438\u043A\u043E\u0432\u0430\u044F \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0430", value: `${formatNumber(lastThermalResult.summary.peakLoadKW, { maximumFractionDigits: 2 })} кВт`, info: resultsMetricInfo.peakLoad }), _jsx(OverviewMetric, { label: "\u0414\u0438\u0441\u043A\u043E\u043C\u0444\u043E\u0440\u0442", value: `${formatNumber(lastThermalResult.summary.discomfortHours, { maximumFractionDigits: 1 })} ч`, info: resultsMetricInfo.discomfort })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { type: "button", onClick: onOpenThermal, className: "ui-btn-primary px-4 py-2 text-sm", children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0440\u0430\u0441\u0447\u0451\u0442" }), _jsx("button", { type: "button", onClick: onOpenCalculation, className: "ui-btn-secondary px-4 py-2 text-sm", children: "\u041F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u0442\u044C" })] })] })) : (_jsx(TabEmptyState, { title: "\u041D\u0435\u0442 RC-\u0440\u0430\u0441\u0447\u0451\u0442\u0430", message: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u044F\u0432\u0438\u043B\u0438\u0441\u044C \u0441\u0432\u043E\u0434\u043A\u0430 \u0438 \u0434\u0438\u043D\u0430\u043C\u0438\u043A\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F.", buttonLabel: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442", onClick: onOpenCalculation }))] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-2 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "Monte Carlo" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.monteCarloP50 })] }), monteCarloResult ? (_jsxs("div", { className: "space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsxs("p", { children: ["P10\u2013P90: ", formatEnergy(monteCarloResult.totalEnergy.p10, "кВт·ч"), " \u2014 ", formatEnergy(monteCarloResult.totalEnergy.p90, "кВт·ч")] }), _jsxs("p", { children: ["P50: ", formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч")] }), _jsxs("p", { children: ["\u0420\u0438\u0441\u043A \u043D\u0435\u0434\u043E\u0433\u0440\u0435\u0432\u0430: ", formatPercentage(monteCarloResult.underheatingBelow20CProbability ?? null)] }), _jsxs("p", { children: ["\u0413\u043B\u0430\u0432\u043D\u044B\u0439 \u0444\u0430\u043A\u0442\u043E\u0440: ", monteCarloResult.sensitivity?.slice().sort((a, b) => b.valuePercent - a.valuePercent)[0]?.label ?? "—"] })] })) : (_jsx(TabEmptyState, { title: "Monte Carlo \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0441\u044F", message: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u0435\u043D \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u043D\u044B\u0439 \u0430\u043D\u0430\u043B\u0438\u0437 \u043F\u043E\u0432\u0435\u0440\u0445 RC-\u0440\u0430\u0441\u0447\u0451\u0442\u0430.", buttonLabel: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u043D\u043E\u043C\u0443 \u0430\u043D\u0430\u043B\u0438\u0437\u0443", onClick: onOpenMonteCarlo }))] }), _jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-2 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u043A\u0430" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.payback })] }), economyAssessment ? (_jsxs("div", { className: "space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsxs("p", { children: ["\u041F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0438: ", formatMoney(economyAssessment.summary.packageAnnualSaving_RUB), "/\u0433\u043E\u0434"] }), _jsxs("p", { children: ["\u041E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C: ", economyAssessment.summary.packagePayback_years == null ? "—" : `${formatNumber(economyAssessment.summary.packagePayback_years, { maximumFractionDigits: 1 })} лет`] }), _jsxs("p", { children: ["NPV: ", formatMoney(economyAssessment.summary.npv_RUB)] }), _jsxs("p", { children: ["\u041A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0431\u0430\u0437\u0430: ", climateLabel ?? "не задана"] })] })) : (_jsx(TabEmptyState, { title: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430", message: "\u0414\u043B\u044F \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043E\u0446\u0435\u043D\u043A\u0438 \u043D\u0443\u0436\u0435\u043D \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u044B\u0439/\u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442 SP50.", buttonLabel: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432\u043A\u043B\u0430\u0434\u043A\u0443 \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u043A\u0438", onClick: onOpenEconomy }))] })] })] }) }));
}
function OverviewMetric({ label, value, info, }) {
    return (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: label }), _jsx(MetricInfoTooltip, { ...info })] }), _jsx("p", { className: "mt-1 text-base font-semibold text-[color:var(--text-base)]", children: value })] }));
}
function RoomsTab({ rows, hasRcResults, onOpenCalculation, onSelectRoom, }) {
    if (!hasRcResults) {
        return (_jsx(TabEmptyState, { title: "\u041D\u0435\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C", message: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u0435\u043D \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043D\u0435\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442.", buttonLabel: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442", onClick: onOpenCalculation }));
    }
    return (_jsxs("div", { className: "grid gap-4 xl:grid-cols-[1.2fr,0.8fr]", children: [_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C" }), _jsx(MetricInfoTooltip, { title: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439", meaning: "\u0421\u0432\u043E\u0434\u0438\u0442 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 RC-\u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u0438 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u043D\u044B\u0439 \u0440\u0438\u0441\u043A \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C \u0438\u0437 Monte Carlo.", formula: "room KPI = f(rooms.timeline, diagnostics, roomRiskSummary)", inputs: ["lastThermalResult.rooms", "diagnostics.zones", "roomRiskSummary"], calculatedIn: "src/features/reports/ResultsPanel.tsx" })] }), _jsx("div", { className: "overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-sm text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041C\u0438\u043D. / \u0441\u0440. t" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0414\u0438\u0441\u043A\u043E\u043C\u0444\u043E\u0440\u0442" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0420\u0438\u0441\u043A \u043D\u0435\u0434\u043E\u0433\u0440\u0435\u0432\u0430" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0421\u0442\u0430\u0442\u0443\u0441" })] }) }), _jsx("tbody", { children: rows.map((row) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "px-4 py-2", children: _jsx("button", { type: "button", onClick: () => onSelectRoom(row.roomId), className: "font-semibold text-[color:var(--text-base)] underline decoration-dotted underline-offset-4", children: row.roomName }) }), _jsx("td", { className: "px-4 py-2", children: formatEnergy(row.energyKWh, "кВт·ч") }), _jsxs("td", { className: "px-4 py-2", children: [row.minTemperatureC == null ? "—" : `${formatNumber(row.minTemperatureC, { maximumFractionDigits: 1 })} °C`, " /", " ", row.avgTemperatureC == null ? "—" : `${formatNumber(row.avgTemperatureC, { maximumFractionDigits: 1 })} °C`] }), _jsxs("td", { className: "px-4 py-2", children: [formatNumber(row.discomfortHours, { maximumFractionDigits: 1 }), " \u0447"] }), _jsx("td", { className: "px-4 py-2", children: formatPercentage(row.underheatingRisk) }), _jsx("td", { className: "px-4 py-2", children: row.status })] }, row.roomId))) })] }) })] }), _jsx(SpaceDetails, {})] }));
}
function MapTab({ buildModel, currentFrame, frames, graph, onOpenCalculation, onSelectRoom, onSliderChange, onTogglePlay, playing, scenarioConfig, selectedRoomId, simulationOptions, thermalResult, timeIndex, timeLabel, }) {
    const [heatmapHover, setHeatmapHover] = useState(null);
    const modelForAnalysis = useMemo(() => applyScenarioToBuilding(buildModel, scenarioConfig), [buildModel, scenarioConfig]);
    const adjacency = useMemo(() => buildAdjacencyGraph(modelForAnalysis), [modelForAnalysis]);
    const fieldView = useMemo(() => {
        if (!thermalResult || !modelForAnalysis.rooms.length) {
            return null;
        }
        try {
            const engineeringResult = runEngineeringThermalAnalysis(modelForAnalysis, adjacency, simulationOptions, thermalResult);
            return engineeringResult.detailedField ?? engineeringResult.fastField ?? null;
        }
        catch {
            return null;
        }
    }, [adjacency, modelForAnalysis, simulationOptions, thermalResult]);
    const roomLabels = useMemo(() => Object.fromEntries(modelForAnalysis.rooms.map((room) => [room.id, getRoomDisplayName(modelForAnalysis, room.id)])), [modelForAnalysis]);
    if (!frames.length && !graph) {
        return (_jsx(TabEmptyState, { title: "\u041A\u0430\u0440\u0442\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430", message: "\u041D\u0443\u0436\u043D\u044B simulation frames \u0438\u043B\u0438 thermal graph \u043F\u043E\u0441\u043B\u0435 \u0440\u0430\u0441\u0447\u0451\u0442\u0430.", buttonLabel: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442", onClick: onOpenCalculation }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "3D \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430" }), _jsx("p", { className: "text-sm text-[color:var(--text-muted)]", children: "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u0435\u043A\u0443\u0449\u0430\u044F 3D \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u043C \u043A\u0430\u0434\u0440\u0430\u043C \u0440\u0430\u0441\u0447\u0451\u0442\u0430." })] }), _jsx(TimelineControls, { frames: frames, onSliderChange: onSliderChange, onTogglePlay: onTogglePlay, playing: playing, timeIndex: timeIndex, timeLabel: timeLabel })] }), _jsx(SpaceViewer3D, { heatmap: true, caption: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u043E \u0437\u043E\u043D\u0430\u043C", height: 420, showLegend: true, showFitControl: true })] }), _jsx(GraphPanel, { graph: graph, frame: currentFrame, selectedId: selectedRoomId, onSelect: onSelectRoom }), _jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "2D-\u043A\u0430\u0440\u0442\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440" }), _jsx("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: "\u041F\u043E\u043B\u0435 \u0441\u0442\u0440\u043E\u0438\u0442\u0441\u044F \u0438\u0437 \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440 \u0438 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u043F\u043E\u043F\u0440\u0430\u0432\u043E\u043A (\u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F, \u043F\u0440\u0438\u0442\u043E\u043A\u0438) \u2014 \u043D\u0430\u0433\u043B\u044F\u0434\u043D\u0430\u044F \u0438\u043D\u0442\u0435\u0440\u043F\u043E\u043B\u044F\u0446\u0438\u044F, \u043D\u0435 CFD." })] }), fieldView ? (_jsxs("div", { className: "text-right text-xs text-[color:var(--text-soft)]", children: [_jsxs("div", { children: ["min ", formatNumber(fieldView.minTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] }), _jsxs("div", { children: ["max ", formatNumber(fieldView.maxTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] })] })) : null] }), _jsx(TemperatureHeatmapPanel, { field: fieldView, hover: heatmapHover, onHover: setHeatmapHover, roomLabels: roomLabels, emptyMessage: thermalResult
                            ? "Недостаточно данных для 2D-карты. Проверьте геометрию помещений и параметры инженерного поля."
                            : "Запустите расчёт, чтобы построить 2D-карту температур по помещениям." })] })] }));
}
function TimelineControls({ frames, onSliderChange, onTogglePlay, playing, timeIndex, timeLabel, }) {
    return (_jsxs("div", { className: "w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 lg:max-w-md", children: [_jsxs("div", { className: "flex items-center justify-between text-sm font-medium text-[color:var(--text-muted)]", children: [_jsx("span", { children: "\u041C\u043E\u043C\u0435\u043D\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438" }), _jsx("span", { className: "tabular-nums text-[color:var(--text-base)]", children: timeLabel })] }), _jsx("input", { type: "range", min: 0, max: Math.max(frames.length - 1, 0), value: timeIndex, onChange: (event) => onSliderChange(Number(event.target.value)), className: "mt-3 w-full accent-[color:var(--accent-base)]", disabled: !frames.length }), _jsxs("div", { className: "mt-3 flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: onTogglePlay, disabled: !frames.length, className: playing ? "ui-btn-secondary px-4 py-2 text-sm" : "ui-btn-primary px-4 py-2 text-sm", children: playing ? "Пауза" : "Пуск" }), _jsx("span", { className: "text-sm text-[color:var(--text-soft)]", children: frames.length ? `${frames.length} шагов` : "Нет временных кадров" })] })] }));
}
function TabEmptyState({ title, message, buttonLabel, onClick, }) {
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(EmptyState, { title: title, message: message }), _jsx("button", { type: "button", onClick: onClick, className: "ui-btn-primary px-4 py-2 text-sm", children: buttonLabel })] }));
}
function GraphPanel({ graph, frame, selectedId, onSelect, }) {
    if (!graph || !graph.nodes.length) {
        return (_jsx("div", { className: "rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0433\u0440\u0430\u0444 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043C\u043E\u0434\u0435\u043B\u0438 \u0438 \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F simulation frames." }));
    }
    const width = 600;
    const height = 320;
    const nodes = graph.nodes;
    const edges = graph.edges;
    const frameTemps = frame ? Object.values(frame.temperatures).filter((value) => Number.isFinite(value)) : [];
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
    return (_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-end justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0433\u0440\u0430\u0444 \u0437\u043E\u043D" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.rcBalance })] }), _jsx("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: "\u0423\u0441\u043B\u043E\u0432\u043D\u0430\u044F \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0435\u0442\u044C. \u0422\u043E\u043B\u0449\u0438\u043D\u0430 \u043B\u0438\u043D\u0438\u0438 \u043F\u0440\u043E\u043F\u043E\u0440\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u0430 \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438, \u0446\u0432\u0435\u0442 \u0443\u0437\u043B\u0430 \u2014 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0435. \u042D\u0442\u043E \u043D\u0435 CFD." })] }), _jsx(TemperatureScaleLegend, { caption: scaleClamped
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
function formatFrameTime(timeHours) {
    if (!Number.isFinite(timeHours)) {
        return "—";
    }
    const totalMinutes = Math.round(timeHours * 60);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    return days > 0 ? `день ${days + 1}, ${hours}:${String(minutes).padStart(2, "0")}` : `${hours}:${String(minutes).padStart(2, "0")}`;
}
function formatMoney(value) {
    if (value == null || !Number.isFinite(value)) {
        return "—";
    }
    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0,
    }).format(value);
}
export default ResultsPanel;
