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
import { EmptyState, MetricInfoTooltip, } from "../../shared/ui";
import { formatEnergy, formatNumber, formatPercentage } from "../../shared/utils/format";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { runLocalThermalCalculation } from "../runs/runLocalThermalCalculation";
import { runThermalMonteCarloAnalysis } from "../scenarios/runThermalMonteCarloAnalysis";
import MetricsResultsTab from "./MetricsResultsTab";
import MonteCarloResultsSection from "./MonteCarloResultsSection";
import { ResultsOverviewSummary } from "./ResultsOverviewSummary";
import { ResultsTabBar } from "./ResultsTabBar";
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
// projectId оставлен в props для будущей привязки к ProjectDocumentationPage
// (см. комментарий «Temporarily hidden from UI»). Пока не используется в UI.
export function ResultsPanel({ projectId: _projectId }) {
    const frames = useTwinStore((state) => state.simulationFrames);
    const timeIndex = useTwinStore((state) => state.timeIndex);
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
    const [activeTab, setActiveTab] = useState("overview");
    const [calculationError, setCalculationError] = useState(null);
    const thermalRunInFlightRef = useRef(false);
    const thermalResultState = getResultSyncState(Boolean(lastThermalResult), lastThermalResultBinding, projectKey, modelRevision);
    const monteCarloResultState = getResultSyncState(Boolean(monteCarloResult), monteCarloResultBinding, projectKey, modelRevision);
    const visibleThermalResult = thermalResultState === "current" ? lastThermalResult : null;
    const visibleMonteCarloResult = monteCarloResultState === "current" ? monteCarloResult : null;
    const visibleFrames = thermalResultState === "current" ? frames : [];
    const visibleThermalGraph = thermalResultState === "current" ? thermalGraph : null;
    const currentFrame = visibleFrames[timeIndex] ?? null;
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
        setCalculationError(null);
        window.setTimeout(() => {
            try {
                runLocalThermalCalculation();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Не удалось выполнить расчёт.";
                setCalculationError(message);
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
        setCalculationError(null);
        setActiveTab("overview");
        window.setTimeout(() => {
            try {
                runLocalThermalCalculation();
                runThermalMonteCarloAnalysis();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Не удалось выполнить полный анализ.";
                setCalculationError(message);
            }
            finally {
                thermalRunInFlightRef.current = false;
            }
        }, 0);
    }, []);
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
        overview: (_jsx(OverviewTab, { lastThermalResult: visibleThermalResult, monteCarloResult: visibleMonteCarloResult, onOpenCalculation: handleRunCalculation })),
        thermal: (_jsx(MetricsResultsTab, { onRecalculate: handleRunCalculation })),
        probabilistic: (_jsx(MonteCarloResultsSection, { baseResult: visibleThermalResult, baseOptions: activeOptions, buildingModel: buildModel, climateLabel: climateLabel, monteCarloResult: visibleMonteCarloResult, onRunCalculation: handleRunCalculation })),
        economy: _jsx(ResultsEconomyTab, { report: sp50Report, onOpenBuild: () => navigate("/build") }),
        rooms: (_jsx(RoomsTab, { rows: roomRows, hasRcResults: Boolean(visibleThermalResult), onOpenCalculation: handleRunCalculation, onSelectRoom: selectSpace })),
        map: (_jsx(MapTab, { buildModel: buildModel, currentFrame: currentFrame, frames: visibleFrames, graph: visibleThermalGraph, onSelectRoom: selectSpace, scenarioConfig: scenarioConfig, selectedRoomId: selectedSpaceId, simulationOptions: activeOptions, thermalResult: visibleThermalResult, onOpenCalculation: handleRunCalculation })),
        // Temporarily hidden from UI. Will be restored after project documentation export redesign.
        // documents: <ProjectDocumentationPage projectId={projectId} />,
    };
    const showResultAlerts = calculationError != null || thermalResultState === "stale" || monteCarloResultState === "stale";
    const isOverviewPanel = activeTab === "overview";
    return (_jsxs("div", { className: "flex min-h-0 flex-col gap-4", children: [showResultAlerts ? (_jsxs("div", { className: "space-y-3", children: [calculationError ? (_jsx("div", { className: "rounded-2xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-fg)]", children: calculationError })) : null, thermalResultState === "stale" || monteCarloResultState === "stale" ? (_jsx("div", { className: "rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]", children: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043C\u043E\u0434\u0435\u043B\u0438. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442 \u0437\u0430\u043D\u043E\u0432\u043E \u043F\u0435\u0440\u0435\u0434 \u0430\u043D\u0430\u043B\u0438\u0437\u043E\u043C \u0438 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u043E\u043C." })) : null] })) : null, _jsxs("div", { className: "ui-results-workspace", children: [_jsx(ResultsTabBar, { value: activeTab === "rooms" ? "overview" : activeTab, onChange: (tab) => setActiveTab(tab) }), _jsx("div", { className: "ui-results-workspace__panel ui-results-workspace__panel--flush", children: _jsx("div", { className: `ui-results-workspace__body animate-fade-slide ${isOverviewPanel ? "min-h-0" : "min-h-[20rem]"}`, children: tabContent[activeTab] }, activeTab) })] })] }));
}
function OverviewTab({ lastThermalResult, monteCarloResult, onOpenCalculation, }) {
    if (!lastThermalResult && !monteCarloResult) {
        return _jsx(OverviewEmptyState, { onOpenCalculation: onOpenCalculation });
    }
    return (_jsx(ResultsOverviewSummary, { lastThermalResult: lastThermalResult, monteCarloResult: monteCarloResult }));
}
function OverviewEmptyState({ onOpenCalculation }) {
    return (_jsx("div", { className: "ui-results-overview", children: _jsxs("section", { className: "ui-results-overview-empty", "aria-labelledby": "overview-empty-title", children: [_jsx("div", { className: "ui-results-overview-empty__glow ui-results-overview-empty__glow--a", "aria-hidden": "true" }), _jsx("div", { className: "ui-results-overview-empty__glow ui-results-overview-empty__glow--b", "aria-hidden": "true" }), _jsx("div", { className: "ui-results-overview-empty__glow ui-results-overview-empty__glow--c", "aria-hidden": "true" }), _jsx("div", { className: "ui-results-overview-empty__grid", "aria-hidden": "true" }), _jsxs("div", { className: "ui-results-overview-empty__layout", children: [_jsxs("div", { className: "ui-results-overview-empty__stage", "aria-hidden": "true", children: [_jsx("div", { className: "ui-results-overview-empty__orbit" }), _jsx("div", { className: "ui-results-overview-empty__orbit ui-results-overview-empty__orbit--inner" }), _jsx("article", { className: "ui-results-overview-empty__tile ui-results-overview-empty__tile--chart", children: _jsx("div", { className: "ui-results-overview-empty__bars", children: [0.42, 0.68, 0.52, 0.86, 0.58].map((height, index) => (_jsx("span", { className: "ui-results-overview-empty__bar", style: { "--bar-h": height } }, index))) }) }), _jsx("article", { className: "ui-results-overview-empty__tile ui-results-overview-empty__tile--ring", children: _jsx("div", { className: "ui-results-overview-empty__donut" }) }), _jsx("article", { className: "ui-results-overview-empty__tile ui-results-overview-empty__tile--wave", children: _jsx("svg", { className: "ui-results-overview-empty__wave", viewBox: "0 0 120 48", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 32 C 22 10, 38 44, 56 24 S 92 8, 116 20", stroke: "currentColor", strokeWidth: "3", strokeLinecap: "round" }) }) }), _jsx("span", { className: "ui-results-overview-empty__spark ui-results-overview-empty__spark--1" }), _jsx("span", { className: "ui-results-overview-empty__spark ui-results-overview-empty__spark--2" }), _jsx("span", { className: "ui-results-overview-empty__spark ui-results-overview-empty__spark--3" })] }), _jsxs("div", { className: "ui-results-overview-empty__panel", children: [_jsx("h3", { id: "overview-empty-title", className: "ui-results-overview-empty__title", children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442" }), _jsxs("button", { type: "button", onClick: onOpenCalculation, className: "ui-btn-primary ui-results-overview-empty__cta", children: [_jsx("span", { className: "ui-results-overview-empty__cta-shine", "aria-hidden": "true" }), "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C"] })] })] })] }) }));
}
function RoomsTab({ rows, hasRcResults, onOpenCalculation, onSelectRoom, }) {
    if (!hasRcResults) {
        return (_jsx(TabEmptyState, { title: "\u041D\u0435\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C", message: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u0435\u043D \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043D\u0435\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442.", buttonLabel: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442", onClick: onOpenCalculation }));
    }
    return (_jsxs("div", { className: "grid gap-4 xl:grid-cols-[1.2fr,0.8fr]", children: [_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C" }), _jsx(MetricInfoTooltip, { title: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439", meaning: "\u0421\u0432\u043E\u0434\u0438\u0442 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 RC-\u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u0438 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u043D\u044B\u0439 \u0440\u0438\u0441\u043A \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C \u0438\u0437 Monte Carlo.", formula: "room KPI = f(rooms.timeline, diagnostics, roomRiskSummary)", inputs: ["lastThermalResult.rooms", "diagnostics.zones", "roomRiskSummary"], calculatedIn: "src/features/reports/ResultsPanel.tsx" })] }), _jsx("div", { className: "overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-sm text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041C\u0438\u043D. / \u0441\u0440. t" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0414\u0438\u0441\u043A\u043E\u043C\u0444\u043E\u0440\u0442" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0420\u0438\u0441\u043A \u043D\u0435\u0434\u043E\u0433\u0440\u0435\u0432\u0430" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0421\u0442\u0430\u0442\u0443\u0441" })] }) }), _jsx("tbody", { children: rows.map((row) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "px-4 py-2", children: _jsx("button", { type: "button", onClick: () => onSelectRoom(row.roomId), className: "font-semibold text-[color:var(--text-base)] underline decoration-dotted underline-offset-4", children: row.roomName }) }), _jsx("td", { className: "px-4 py-2", children: formatEnergy(row.energyKWh, "кВт·ч") }), _jsxs("td", { className: "px-4 py-2", children: [row.minTemperatureC == null ? "—" : `${formatNumber(row.minTemperatureC, { maximumFractionDigits: 1 })} °C`, " /", " ", row.avgTemperatureC == null ? "—" : `${formatNumber(row.avgTemperatureC, { maximumFractionDigits: 1 })} °C`] }), _jsxs("td", { className: "px-4 py-2", children: [formatNumber(row.discomfortHours, { maximumFractionDigits: 1 }), " \u0447"] }), _jsx("td", { className: "px-4 py-2", children: formatPercentage(row.underheatingRisk) }), _jsx("td", { className: "px-4 py-2", children: row.status })] }, row.roomId))) })] }) })] }), _jsx(SpaceDetails, {})] }));
}
function MapTab({ buildModel, currentFrame, frames, graph, onOpenCalculation, onSelectRoom, scenarioConfig, selectedRoomId, simulationOptions, thermalResult, }) {
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
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: _jsx(SpaceViewer3D, { heatmap: true, caption: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u043E \u0437\u043E\u043D\u0430\u043C", height: 420, showLegend: true, showFitControl: true }) }), _jsx(GraphPanel, { graph: graph, frame: currentFrame, selectedId: selectedRoomId, onSelect: onSelectRoom }), _jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-start justify-between gap-3", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "2D-\u043A\u0430\u0440\u0442\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440" }), fieldView ? (_jsxs("div", { className: "text-right text-xs text-[color:var(--text-soft)]", children: [_jsxs("div", { children: ["min ", formatNumber(fieldView.minTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] }), _jsxs("div", { children: ["max ", formatNumber(fieldView.maxTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] })] })) : null] }), _jsx(TemperatureHeatmapPanel, { field: fieldView, hover: heatmapHover, onHover: setHeatmapHover, roomLabels: roomLabels, emptyMessage: thermalResult
                            ? "Недостаточно данных для 2D-карты. Проверьте геометрию помещений и параметры инженерного поля."
                            : "Запустите расчёт, чтобы построить 2D-карту температур по помещениям." })] })] }));
}
function TabEmptyState({ title, message, buttonLabel, onClick, }) {
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(EmptyState, { title: title, message: message }), _jsx("button", { type: "button", onClick: onClick, className: "ui-btn-primary px-4 py-2 text-sm", children: buttonLabel })] }));
}
function GraphPanel({ graph, frame, selectedId, onSelect, }) {
    if (!graph || !graph.nodes.length) {
        return (_jsx("div", { className: "rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0433\u0440\u0430\u0444 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043C\u043E\u0434\u0435\u043B\u0438 \u0438 \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F simulation frames." }));
    }
    const W = 640;
    const H = 420;
    const CX = W / 2;
    const CY = H / 2;
    const nodes = graph.nodes;
    const edges = graph.edges;
    const frameTemps = frame
        ? Object.values(frame.temperatures).filter((v) => Number.isFinite(v))
        : [];
    const dynamicMin = frameTemps.length ? Math.min(...frameTemps) : 15;
    const dynamicMax = frameTemps.length ? Math.max(...frameTemps) : 30;
    const legendMin = Math.min(15, dynamicMin);
    const legendMax = Math.max(30, dynamicMax);
    // outdoor at center; space nodes on a circle starting from top (-π/2)
    const spaceNodes = nodes.filter((n) => n.type === "space");
    const circleRadius = Math.min(CX, CY) - 72;
    const positions = new Map();
    positions.set("outdoor", { x: CX, y: CY });
    spaceNodes.forEach((node, i) => {
        const angle = (i / Math.max(spaceNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
        positions.set(node.id, {
            x: CX + circleRadius * Math.cos(angle),
            y: CY + circleRadius * Math.sin(angle),
        });
    });
    // normalize edge widths to 1.5–5 px range
    const conductances = edges.map((e) => e.conductance).filter(Number.isFinite);
    const maxC = conductances.length ? Math.max(...conductances) : 1;
    const minC = conductances.length ? Math.min(...conductances) : 0;
    const rangeC = maxC - minC || 1;
    const edgeStroke = (c) => 1.5 + ((c - minC) / rangeC) * 3.5;
    return (_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex items-center gap-1.5", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0433\u0440\u0430\u0444 \u0437\u043E\u043D" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.rcBalance })] }), _jsx("div", { className: "w-full overflow-x-auto", children: _jsxs("svg", { width: W, height: H, className: "max-w-full", style: { display: "block" }, children: [edges.map((edge, ei) => {
                            const from = positions.get(edge.from);
                            const to = positions.get(edge.to);
                            if (!from || !to)
                                return null;
                            return (_jsx("line", { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: "var(--chart-edge)", strokeWidth: edgeStroke(edge.conductance), strokeOpacity: 0.6, strokeLinecap: "round" }, `e-${ei}`));
                        }), nodes.map((node) => {
                            const pos = positions.get(node.id);
                            if (!pos)
                                return null;
                            const temp = frame?.temperatures[node.id] ?? node.initialTemp;
                            const color = temperatureToColor(temp, legendMin, legendMax);
                            const isOutdoor = node.id === "outdoor";
                            const isSelected = selectedId === node.id;
                            const nodeR = isOutdoor ? 22 : isSelected ? 20 : 16;
                            const displayLabel = isOutdoor ? "Наружный воздух" : node.label;
                            const shortLabel = displayLabel.length > 14 ? `${displayLabel.slice(0, 13)}…` : displayLabel;
                            // radial label: away from center for space nodes, below for outdoor
                            let lx;
                            let ly;
                            if (isOutdoor) {
                                lx = pos.x;
                                ly = pos.y + nodeR + 15;
                            }
                            else {
                                const dx = pos.x - CX;
                                const dy = pos.y - CY;
                                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                                const offset = nodeR + 14;
                                lx = pos.x + (dx / dist) * offset;
                                ly = pos.y + (dy / dist) * offset;
                            }
                            return (_jsxs("g", { onClick: () => node.type === "space" && onSelect(node.id), style: { cursor: node.type === "space" ? "pointer" : "default" }, children: [_jsx("circle", { cx: pos.x, cy: pos.y, r: nodeR, fill: color, stroke: isSelected ? "var(--accent-base)" : isOutdoor ? "var(--text-soft)" : "var(--text-base)", strokeWidth: isSelected ? 2.5 : 1.5, opacity: isOutdoor ? 0.75 : 0.95 }), _jsx("text", { x: pos.x, y: pos.y, textAnchor: "middle", dominantBaseline: "central", fontSize: 9, fontWeight: 500, fill: "var(--text-base)", children: formatTemperature(temp) }), _jsx("text", { x: lx, y: ly, textAnchor: "middle", dominantBaseline: "central", fontSize: 10, fontWeight: isSelected ? 600 : 400, fill: "var(--text-muted)", children: shortLabel })] }, node.id));
                        })] }) })] }));
}
export default ResultsPanel;
