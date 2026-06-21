import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runThermalSimulation, } from "../../../core/thermal/solver";
import { formatThermalSimulationPeriodRu } from "../../../core/thermal/thermalResultsInterpretation";
import { buildBuildingLossSeries, buildZoneSeries } from "../../../core/thermal/thermalResultsChartPayload";
import { DEFAULT_ENGINEERING_OPTIONS } from "../../../core/thermal/engineering/constants";
import { runEngineeringThermalAnalysis } from "../../../core/thermal/engineering/analysis";
import { getRoomDisplayName } from "../../../core/thermal/engineering/display";
import { formatArea, formatEnergy, formatNumber } from "../../../shared/utils/format";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, } from "recharts";
import Tooltip from "../../../shared/ui/Tooltip";
import { anchorToOffset } from "../utils/openingMath";
import { demoRunSP50Calculation, exportDemoSp50ReportToJson } from "../../../demo/sampleBuildingSP50";
import { demoVKRScenario } from "../../../demo/demoVKRScenario";
import { buildTransientScenarioPreset, getTransientFrame, getTransientMonteCarloVisualizationSample, getTransientScenarioPresets, listTransientConstructionTargets, runTransientMonteCarlo, runTransientConstructionAnalysis, } from "../../../core/thermal/transient/index";
import { buildDefaultEconomicScenario, runEconomicAssessment, } from "../../../core/economics/index";
import { writeAgentDebugLog } from "../../../shared/utils/agentDebugLog";
import { loadThermalPanelState, saveThermalPanelState } from "../thermal/thermalPanelPersistence";
import { DEFAULT_THERMAL_OPTIONS } from "../thermal/defaultThermalOptions";
import { ExpertiseReportExport } from "../reports/ExpertiseReportExport";
import { getLevelDisplayLabel } from "../utils/entityLabels";
const TIMESTEP_CHOICES = [5, 10, 15, 30, 60];
const ROOM_LINE_COLORS = ["#ef4444", "#0ea5e9", "#f97316", "#22c55e", "#a855f7", "#facc15"];
const MAX_ROOMS_ON_CHART = 5;
const PANEL_VIEWS = [
    { id: "brief", label: "Кратко" },
    { id: "detailed", label: "Подробно" },
    { id: "engineering", label: "Инженерный режим" },
];
const HEATMAP_COLORS = ["#16344f", "#1f5d7a", "#2d8d8b", "#66b96a", "#f2c04c", "#e97232", "#a9341f"];
const TRANSIENT_SCENARIO_PRESETS = getTransientScenarioPresets();
export function ThermalSimulationPanel({ projectKey, model, adjacency, options, onOptionsChange, onResult, onTransientResultChange, onTransientTimeIndexChange, onTransientVisualizationEnabledChange, onRequestThermalModelView, }) {
    const [result, setResult] = useState(null);
    const [engineeringResult, setEngineeringResult] = useState(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);
    const [demoSp50Result, setDemoSp50Result] = useState(null);
    const [activeView, setActiveView] = useState("brief");
    const [heatmapHover, setHeatmapHover] = useState(null);
    const [lastHash, setLastHash] = useState(null);
    const [lastCalculatedAtIso, setLastCalculatedAtIso] = useState(null);
    const [transientResult, setTransientResult] = useState(null);
    const [transientWarnings, setTransientWarnings] = useState([]);
    const [transientMissingData, setTransientMissingData] = useState([]);
    const [selectedTransientScenarioId, setSelectedTransientScenarioId] = useState("cold_snap_24h");
    const [selectedTransientConstructionId, setSelectedTransientConstructionId] = useState(null);
    const [transientDurationHours, setTransientDurationHours] = useState(24);
    const [transientTimeStepSeconds, setTransientTimeStepSeconds] = useState(10);
    const [transientNodesPerLayer, setTransientNodesPerLayer] = useState(3);
    const [transientInitialTemperatureC, setTransientInitialTemperatureC] = useState(20);
    const [transientIndoorTemperatureC, setTransientIndoorTemperatureC] = useState(20);
    const [transientOutdoorTemperatureC, setTransientOutdoorTemperatureC] = useState(-10);
    const [transientOutdoorEndTemperatureC, setTransientOutdoorEndTemperatureC] = useState(-25);
    const [transientReducedIndoorTemperatureC, setTransientReducedIndoorTemperatureC] = useState(18);
    const [transientRestoredIndoorTemperatureC, setTransientRestoredIndoorTemperatureC] = useState(22);
    const [transientSelectedTimeIndex, setTransientSelectedTimeIndex] = useState(0);
    const [transientVisualizationEnabled, setTransientVisualizationEnabled] = useState(false);
    const [transientActiveTarget, setTransientActiveTarget] = useState(null);
    const [transientMonteCarloEnabled, setTransientMonteCarloEnabled] = useState(false);
    const [transientMonteCarloRunning, setTransientMonteCarloRunning] = useState(false);
    const [transientMonteCarloResult, setTransientMonteCarloResult] = useState(null);
    const [transientDisplayedSampleMode, setTransientDisplayedSampleMode] = useState("base");
    const [transientMonteCarloSamplesCount, setTransientMonteCarloSamplesCount] = useState(100);
    const [transientMonteCarloSeed, setTransientMonteCarloSeed] = useState(42);
    const [transientComfortMinC, setTransientComfortMinC] = useState(18);
    const [transientCriticalSurfaceTemperatureC, setTransientCriticalSurfaceTemperatureC] = useState(12);
    const [transientOutdoorOffsetC, setTransientOutdoorOffsetC] = useState(4);
    const [transientHeatingPowerVariationPercent, setTransientHeatingPowerVariationPercent] = useState(15);
    const [transientInternalGainsVariationPercent, setTransientInternalGainsVariationPercent] = useState(10);
    const [transientLambdaVariationPercent, setTransientLambdaVariationPercent] = useState(10);
    const [transientInitialTemperatureOffsetC, setTransientInitialTemperatureOffsetC] = useState(2);
    const skipNextPersistRef = useRef(true);
    const [resultsVisible, setResultsVisible] = useState(false);
    const modelHash = useMemo(() => `${hashModelGeometry(model)}#${hashThermalOptions(options)}`, [model, options]);
    const canRun = model.rooms.length > 0;
    const transientTargets = useMemo(() => listTransientConstructionTargets(model), [model]);
    const selectedTransientTarget = useMemo(() => transientTargets.find((entry) => entry.id === selectedTransientConstructionId) ?? transientTargets[0] ?? null, [selectedTransientConstructionId, transientTargets]);
    const highlightedRooms = useMemo(() => model.rooms.slice(0, MAX_ROOMS_ON_CHART), [model.rooms]);
    const roomLabels = useMemo(() => Object.fromEntries(model.rooms.map((room) => [room.id, getRoomDisplayName(model, room.id)])), [model]);
    useEffect(() => {
        if (!transientTargets.length) {
            if (selectedTransientConstructionId !== null) {
                setSelectedTransientConstructionId(null);
            }
            return;
        }
        if (!selectedTransientConstructionId || !transientTargets.some((entry) => entry.id === selectedTransientConstructionId)) {
            setSelectedTransientConstructionId(transientTargets[0].id);
        }
    }, [selectedTransientConstructionId, transientTargets]);
    useEffect(() => {
        const clampedIndex = transientResult ? Math.min(Math.max(0, transientSelectedTimeIndex), Math.max(0, transientResult.time.length - 1)) : 0;
        if (clampedIndex !== transientSelectedTimeIndex) {
            setTransientSelectedTimeIndex(clampedIndex);
            return;
        }
        onTransientTimeIndexChange?.(clampedIndex);
    }, [onTransientTimeIndexChange, transientResult, transientSelectedTimeIndex]);
    useEffect(() => {
        onTransientVisualizationEnabledChange?.(transientVisualizationEnabled);
    }, [onTransientVisualizationEnabledChange, transientVisualizationEnabled]);
    useEffect(() => {
        onResult?.(result);
    }, [onResult, result]);
    useEffect(() => {
        onTransientResultChange?.({
            result: transientResult,
            sourceId: transientActiveTarget?.sourceId ?? null,
            sourceType: transientActiveTarget?.sourceType ?? null,
            warnings: transientWarnings,
            missingData: transientMissingData,
        });
    }, [onTransientResultChange, transientActiveTarget, transientMissingData, transientResult, transientWarnings]);
    useEffect(() => {
        skipNextPersistRef.current = true;
        const restored = loadThermalPanelState(projectKey);
        // #region agent log
        writeAgentDebugLog({ sessionId: 'c3d591', runId: 'repro-4', hypothesisId: 'H3', location: 'ThermalSimulationPanel.tsx:restore', message: 'thermal panel restore snapshot', data: { projectKey, modelHash, restoredHash: restored?.lastHash ?? null, hasStoredResult: Boolean(restored?.result), hasStoredEngineering: Boolean(restored?.engineeringResult), hasStoredTransient: Boolean(restored?.transientResult) }, timestamp: Date.now() });
        // #endregion
        if (!restored) {
            setResult(null);
            setEngineeringResult(null);
            setError(null);
            setDemoSp50Result(null);
            setActiveView("brief");
            setLastHash(null);
            setLastCalculatedAtIso(null);
            setTransientResult(null);
            setTransientWarnings([]);
            setTransientMissingData([]);
            setTransientSelectedTimeIndex(0);
            setTransientVisualizationEnabled(false);
            setTransientActiveTarget(null);
            setTransientMonteCarloEnabled(false);
            setTransientMonteCarloResult(null);
            setTransientDisplayedSampleMode("base");
            setResultsVisible(false);
            return;
        }
        setResult(restored.result ?? null);
        setEngineeringResult(restored.engineeringResult ?? null);
        setError(restored.error ?? null);
        setDemoSp50Result(restored.demoSp50Result ?? null);
        setActiveView(restored.activeView ?? "brief");
        setLastHash(restored.lastHash ?? null);
        setLastCalculatedAtIso(restored.lastCalculatedAtIso ?? null);
        setTransientResult(restored.transientResult ?? null);
        setTransientWarnings(Array.isArray(restored.transientWarnings) ? restored.transientWarnings : []);
        setTransientMissingData(Array.isArray(restored.transientMissingData) ? restored.transientMissingData : []);
        setTransientSelectedTimeIndex(typeof restored.transientSelectedTimeIndex === "number" ? restored.transientSelectedTimeIndex : 0);
        setTransientVisualizationEnabled(Boolean(restored.transientVisualizationEnabled));
        setTransientActiveTarget(restored.transientActiveTarget ?? null);
        setTransientMonteCarloEnabled(Boolean(restored.transientMonteCarloEnabled));
        setTransientMonteCarloResult(restored.transientMonteCarloResult ?? null);
        setTransientDisplayedSampleMode(restored.transientDisplayedSampleMode ?? "base");
        setResultsVisible(Boolean(restored.result ?? restored.engineeringResult ?? restored.demoSp50Result));
    }, [modelHash, projectKey]);
    useEffect(() => {
        if (!lastHash || lastHash === modelHash) {
            return;
        }
        // #region agent log
        writeAgentDebugLog({ sessionId: 'c3d591', runId: 'repro-4', hypothesisId: 'H3', location: 'ThermalSimulationPanel.tsx:clear-stale', message: 'thermal panel cleared stale snapshot', data: { projectKey, lastHash, modelHash }, timestamp: Date.now() });
        // #endregion
        setResult(null);
        setEngineeringResult(null);
        setDemoSp50Result(null);
        setError(null);
        setLastHash(null);
        setLastCalculatedAtIso(null);
        setTransientResult(null);
        setTransientWarnings([]);
        setTransientMissingData([]);
        setTransientSelectedTimeIndex(0);
        setTransientVisualizationEnabled(false);
        setTransientActiveTarget(null);
        setTransientMonteCarloEnabled(false);
        setTransientMonteCarloResult(null);
        setTransientDisplayedSampleMode("base");
        setResultsVisible(false);
    }, [lastHash, modelHash, projectKey]);
    useEffect(() => {
        if (skipNextPersistRef.current) {
            skipNextPersistRef.current = false;
            return;
        }
        saveThermalPanelState(projectKey, {
            result,
            engineeringResult,
            error,
            demoSp50Result,
            activeView,
            lastHash,
            lastCalculatedAtIso,
            transientResult,
            transientWarnings,
            transientMissingData,
            transientSelectedTimeIndex,
            transientVisualizationEnabled,
            transientActiveTarget,
            transientMonteCarloEnabled,
            transientMonteCarloResult,
            transientDisplayedSampleMode,
        });
    }, [
        activeView,
        demoSp50Result,
        engineeringResult,
        error,
        lastCalculatedAtIso,
        lastHash,
        projectKey,
        result,
        transientActiveTarget,
        transientDisplayedSampleMode,
        transientMissingData,
        transientMonteCarloEnabled,
        transientMonteCarloResult,
        transientResult,
        transientSelectedTimeIndex,
        transientVisualizationEnabled,
        transientWarnings,
    ]);
    const temperatureSeries = useMemo(() => {
        if (!result) {
            return [];
        }
        return result.timeline.map((frame) => {
            const entry = {
                time: frame.timeHours,
                outdoor: sanitizeChartTemperature(frame.outdoorTemperatureC) ?? Number.NaN,
            };
            highlightedRooms.forEach((room) => {
                entry[room.id] = sanitizeIndoorChartTemperature(frame.rooms[room.id]?.temperatureC ?? NaN) ?? Number.NaN;
            });
            return entry;
        });
    }, [highlightedRooms, result]);
    const roomSummaries = useMemo(() => {
        if (!result) {
            return [];
        }
        return Object.values(result.rooms)
            .map((entry) => {
            const roomMeta = model.rooms.find((room) => room.id === entry.roomId);
            return {
                roomId: entry.roomId,
                name: roomMeta ? getRoomDisplayName(model, roomMeta.id) : getRoomDisplayName(model, entry.roomId),
                dailyEnergyKWh: entry.dailyEnergyKWh,
                discomfortHours: entry.discomfortHours,
            };
        })
            .sort((a, b) => b.dailyEnergyKWh - a.dailyEnergyKWh);
    }, [model, result]);
    const rcLossBreakdownRows = useMemo(() => {
        if (!result) {
            return [];
        }
        const RC_LOSS_COLORS = {
            opaque: "#0f766e",
            window: "#2563eb",
            door: "#f97316",
            infiltration: "#dc2626",
            ventilation: "#7c3aed",
        };
        return buildBuildingLossSeries(result).map((row) => ({
            key: row.key,
            label: row.label,
            valueW: row.valueW,
            sharePercent: row.sharePercent,
            color: RC_LOSS_COLORS[row.key],
        }));
    }, [result]);
    const rcZoneDiagnosticsRows = useMemo(() => {
        if (!result) {
            return [];
        }
        return buildZoneSeries(result).map((zone) => ({
            zoneId: zone.zoneId,
            zoneName: zone.zoneName,
            temperatureC: zone.temperatureC,
            heatingPowerW: zone.heatingPowerW,
            lossOpaqueW: zone.lossOpaqueW,
            lossWindowW: zone.lossWindowW,
            lossDoorW: zone.lossDoorW,
            lossInfiltrationW: zone.lossInfiltrationW,
            lossTotalW: zone.lossTotalW,
            infiltrationSharePercent: zone.infiltrationShareOfTotalPct,
            statusNote: zone.statusNote,
        }));
    }, [result]);
    const hasRcDiagnostics = rcLossBreakdownRows.some((row) => row.valueW !== null) || rcZoneDiagnosticsRows.length > 0;
    const handleRun = useCallback(() => {
        if (!canRun) {
            setError("Добавьте помещения и стены, чтобы выполнить расчёт.");
            return;
        }
        setRunning(true);
        setError(null);
        onResult?.(null);
        setEngineeringResult(null);
        try {
            const next = runThermalSimulation(model, options, adjacency);
            const nextEngineering = runEngineeringThermalAnalysis(model, adjacency, options, next);
            startTransition(() => {
                setResult(next);
                setEngineeringResult(nextEngineering);
                setLastHash(modelHash);
                setLastCalculatedAtIso(new Date().toISOString());
                setResultsVisible(true);
            });
            onResult?.(next);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось запустить термический расчёт.";
            setError(message);
        }
        finally {
            setRunning(false);
        }
    }, [adjacency, canRun, model, modelHash, onResult, options]);
    const updateOptions = useCallback((patch) => {
        onOptionsChange({ ...options, ...patch });
    }, [onOptionsChange, options]);
    const updateOutdoor = useCallback((patch) => {
        onOptionsChange({ ...options, outdoor: { ...options.outdoor, ...patch } });
    }, [onOptionsChange, options]);
    const updateSetpoints = useCallback((patch) => {
        onOptionsChange({ ...options, setpoints: { ...options.setpoints, ...patch } });
    }, [onOptionsChange, options]);
    const updateGains = useCallback((patch) => {
        onOptionsChange({ ...options, internalGains: { ...options.internalGains, ...patch } });
    }, [onOptionsChange, options]);
    const updateEngineering = useCallback((patch) => {
        onOptionsChange({
            ...options,
            engineering: {
                ...DEFAULT_ENGINEERING_OPTIONS,
                ...(options.engineering ?? {}),
                ...patch,
            },
        });
    }, [onOptionsChange, options]);
    const legendFormatter = useCallback((value) => {
        if (value === "outdoor") {
            return "Улица";
        }
        if (value === "total") {
            return "Суммарно";
        }
        return roomLabels[value] ?? "Помещение";
    }, [roomLabels]);
    const engineeringOptions = useMemo(() => ({
        ...DEFAULT_ENGINEERING_OPTIONS,
        ...(options.engineering ?? {}),
        surfaceResistances: {
            ...DEFAULT_ENGINEERING_OPTIONS.surfaceResistances,
            ...(options.engineering?.surfaceResistances ?? {}),
        },
        grid: {
            ...DEFAULT_ENGINEERING_OPTIONS.grid,
            ...(options.engineering?.grid ?? {}),
        },
        scenarioDraft: {
            ...DEFAULT_ENGINEERING_OPTIONS.scenarioDraft,
            ...(options.engineering?.scenarioDraft ?? {}),
        },
    }), [options.engineering]);
    const fieldView = engineeringResult?.detailedField ?? engineeringResult?.fastField ?? null;
    const zoneInsights = engineeringResult?.zoneInsights ?? [];
    const presentation = engineeringResult?.presentation ?? null;
    const heatLossSeries = useMemo(() => engineeringResult
        ? [
            { name: "Стены", value: engineeringResult.balance.wallLossW },
            { name: "Окна", value: engineeringResult.balance.windowLossW },
            { name: "Двери", value: engineeringResult.balance.doorLossW },
            { name: "Пол", value: engineeringResult.balance.floorLossW },
            { name: "Покрытие", value: engineeringResult.balance.roofLossW },
            { name: "Инфильтрация", value: engineeringResult.balance.infiltrationLossW },
            { name: "Вентиляция", value: engineeringResult.balance.ventilationLossW },
        ]
        : [], [engineeringResult]);
    const gainSeries = useMemo(() => {
        if (!engineeringResult) {
            return [];
        }
        const byKind = new Map();
        engineeringResult.gains.forEach((entry) => {
            byKind.set(entry.label, (byKind.get(entry.label) ?? 0) + entry.effectivePowerW);
        });
        return Array.from(byKind.entries()).map(([name, value]) => ({ name, value }));
    }, [engineeringResult]);
    const scenarioSummarySeries = useMemo(() => engineeringResult?.scenarios
        .map((scenario) => ({
        name: shortenScenarioLabel(scenario.label),
        peak: sanitizeChartMagnitude(scenario.summary.peakHeatingKW),
        energy: sanitizeChartMagnitude(scenario.summary.totalHeatingKWh),
        finalTemperatureC: sanitizeIndoorChartTemperature(scenario.summary.finalTemperatureC),
    }))
        .filter((entry) => entry.peak !== null || entry.energy !== null) ?? [], [engineeringResult]);
    const scenarioTemperatureSeries = useMemo(() => {
        if (!engineeringResult?.scenarios.length) {
            return [];
        }
        const baseline = engineeringResult.scenarios[0];
        return baseline.points.map((point, index) => {
            const row = {
                time: formatTimeLabel(point.timeHours),
                outdoor: sanitizeChartTemperature(point.outdoorTemperatureC),
            };
            engineeringResult.scenarios.slice(0, 4).forEach((scenario) => {
                row[shortenScenarioLabel(scenario.label)] = sanitizeIndoorChartTemperature(scenario.points[index]?.indoorTemperatureC ?? NaN);
            });
            return row;
        }).filter((row) => hasUsableTemperatureSeries([row]));
    }, [engineeringResult]);
    const sensitivitySeries = useMemo(() => engineeringResult?.sensitivity
        .map((entry) => ({
        name: shortenSensitivityLabel(entry.parameter),
        value: clampSensitivityPercent(entry.deltaHeatingPercent),
        impact: entry.normalizedImpact,
        isClipped: Math.abs(entry.deltaHeatingPercent) > MAX_SENSITIVITY_PERCENT,
    }))
        .filter((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.impact)) ?? [], [engineeringResult]);
    const hasUsableRoomTemperatureSeries = useMemo(() => temperatureSeries.some((entry) => Object.entries(entry).some(([key, value]) => key !== "time" && Number.isFinite(value))), [temperatureSeries]);
    const hasUsableScenarioTemperatureSeries = useMemo(() => hasUsableTemperatureSeries(scenarioTemperatureSeries), [scenarioTemperatureSeries]);
    const hasUsableScenarioSummary = useMemo(() => hasUsableScenarioSummarySeries(scenarioSummarySeries), [scenarioSummarySeries]);
    const hasUsableSensitivity = useMemo(() => hasUsableSensitivitySeries(sensitivitySeries), [sensitivitySeries]);
    const transientResultUsable = Boolean(transientResult?.valid && transientResult.stable);
    const transientSurfaceSeries = useMemo(() => {
        if (!transientResult || !transientResultUsable) {
            return [];
        }
        const outerBoundarySeries = transientResult.metadata.outerBoundaryTemperature_C ?? [];
        return transientResult.time.map((time_s, index) => ({
            time: time_s / 3600,
            innerSurface: sanitizeChartTemperature(transientResult.innerSurfaceTemperature[index] ?? NaN),
            outerSurface: sanitizeChartTemperature(transientResult.outerSurfaceTemperature[index] ?? NaN),
            outdoor: sanitizeChartTemperature(outerBoundarySeries[index] ?? NaN),
        }));
    }, [transientResult, transientResultUsable]);
    const transientProfileSeries = useMemo(() => {
        if (!transientResult || !transientResultUsable) {
            return [];
        }
        const frame = getTransientFrame(transientResult, transientSelectedTimeIndex);
        return frame.nodes.map((x_m, index) => ({
            x_m,
            temperature_C: sanitizeChartTemperature(frame.temperature[index] ?? NaN),
        }));
    }, [transientResult, transientResultUsable, transientSelectedTimeIndex]);
    const transientFrame = useMemo(() => (transientResult && transientResultUsable ? getTransientFrame(transientResult, transientSelectedTimeIndex) : null), [transientResult, transientResultUsable, transientSelectedTimeIndex]);
    const transientInnerSurfaceTemperature = transientFrame?.innerSurfaceTemperature_C ?? null;
    const transientOuterSurfaceTemperature = transientFrame?.outerSurfaceTemperature_C ?? null;
    const transientInnerSurfaceValue = formatSafeTemperature(transientInnerSurfaceTemperature);
    const transientOuterSurfaceValue = formatSafeTemperature(transientOuterSurfaceTemperature);
    const transientSurfaceStabilityLabel = transientResult?.stable ? "устойчивая схема" : "неустойчивая схема";
    const transientStatus = useMemo(() => {
        if (transientMissingData.length) {
            return {
                label: "Недостаточно данных",
                tone: "warning",
            };
        }
        if (!transientResult) {
            return {
                label: "Расчет не запускался",
                tone: "neutral",
            };
        }
        if (!transientResult.valid) {
            return {
                label: "Расчет недостоверен",
                tone: "critical",
            };
        }
        if (!transientResult.stable) {
            return {
                label: "Схема неустойчива",
                tone: "critical",
            };
        }
        return {
            label: "Расчет выполнен",
            tone: "good",
        };
    }, [transientMissingData.length, transientResult]);
    const transientUncertaintyParameters = useMemo(() => {
        const parameters = [];
        if (transientOutdoorOffsetC > 0) {
            parameters.push({
                id: "outdoor-offset",
                name: "Смещение наружной температуры",
                target: "outdoorTemperatureOffset",
                distribution: { kind: "uniform", min: -transientOutdoorOffsetC, max: transientOutdoorOffsetC },
            });
        }
        if (transientHeatingPowerVariationPercent > 0) {
            const spread = transientHeatingPowerVariationPercent / 100;
            parameters.push({
                id: "heating-power",
                name: "Множитель отопительной мощности",
                target: "heatingPowerMultiplier",
                distribution: { kind: "triangular", min: Math.max(0.1, 1 - spread), mode: 1, max: 1 + spread },
            });
        }
        if (transientInternalGainsVariationPercent > 0) {
            const spread = transientInternalGainsVariationPercent / 100;
            parameters.push({
                id: "internal-gains",
                name: "Множитель внутренних теплопоступлений",
                target: "internalGainsMultiplier",
                distribution: { kind: "triangular", min: Math.max(0, 1 - spread), mode: 1, max: 1 + spread },
            });
        }
        if (transientLambdaVariationPercent > 0) {
            const spread = transientLambdaVariationPercent / 100;
            parameters.push({
                id: "lambda",
                name: "Множитель теплопроводности",
                target: "lambdaMultiplier",
                distribution: { kind: "uniform", min: Math.max(0.1, 1 - spread), max: 1 + spread },
            });
        }
        if (transientInitialTemperatureOffsetC > 0) {
            parameters.push({
                id: "initial-temperature",
                name: "Смещение начальной температуры",
                target: "initialTemperatureOffset",
                distribution: { kind: "normal", mean: 0, std: transientInitialTemperatureOffsetC / 2 },
            });
        }
        return parameters;
    }, [
        transientHeatingPowerVariationPercent,
        transientInitialTemperatureOffsetC,
        transientInternalGainsVariationPercent,
        transientLambdaVariationPercent,
        transientOutdoorOffsetC,
    ]);
    const transientMonteCarloHistogram = useMemo(() => {
        const values = transientMonteCarloResult?.samples
            .filter((entry) => entry.valid && entry.stable)
            .map((entry) => entry.minInnerSurfaceTemperature_C)
            .filter((value) => isTrustworthyTemperatureValue(value)) ?? [];
        if (!values.length) {
            return [];
        }
        const binsCount = Math.min(12, Math.max(4, Math.round(Math.sqrt(values.length))));
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (Math.abs(max - min) < 1e-9) {
            const label = formatHistogramBinLabel(min, min);
            return [{ mid: min, probability: 1, label, shortLabel: label, fullLabel: label }];
        }
        const width = (max - min) / binsCount;
        const counts = Array.from({ length: binsCount }, () => 0);
        values.forEach((value) => {
            const index = Math.min(binsCount - 1, Math.floor((value - min) / width));
            counts[index] += 1;
        });
        return counts.map((count, index) => {
            const binStart = min + index * width;
            const binEnd = binStart + width;
            return {
                mid: (binStart + binEnd) / 2,
                probability: count / values.length,
                label: formatHistogramBinLabel(binStart, binEnd),
                shortLabel: formatHistogramBinLabel(binStart, binEnd),
                fullLabel: formatHistogramBinLabel(binStart, binEnd),
            };
        });
    }, [transientMonteCarloResult]);
    const transientMonteCarloHistogramInterval = transientMonteCarloHistogram.length > 8 ? 1 : 0;
    const dominantTransientSensitivity = transientMonteCarloResult?.sensitivity[0] ?? null;
    const displayedTransientScenarioLabel = useMemo(() => formatTransientSampleViewModeLabel(transientDisplayedSampleMode), [transientDisplayedSampleMode]);
    const runDemoSp50 = useCallback(() => {
        try {
            const demoResult = demoRunSP50Calculation();
            startTransition(() => {
                setDemoSp50Result(demoResult);
                setActiveView("engineering");
                setResultsVisible(true);
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось выполнить демонстрационный расчет по СП 50.13330.2024.";
            setError(message);
        }
    }, []);
    const exportDemoSp50Json = useCallback(() => {
        if (!demoSp50Result) {
            return;
        }
        downloadTextFile(exportDemoSp50ReportToJson(demoSp50Result), "sp50-report.json", "application/json");
    }, [demoSp50Result]);
    const handleRunTransient = useCallback(() => {
        if (!selectedTransientTarget) {
            setTransientResult(null);
            setTransientActiveTarget(null);
            setTransientWarnings([]);
            setTransientMissingData(["Добавьте стену, крышу или перекрытие со слоями, чтобы запустить нестационарный расчет."]);
            setTransientVisualizationEnabled(false);
            return;
        }
        const scenario = buildTransientScenarioPreset(selectedTransientScenarioId, {
            duration_s: Math.max(1, Math.round(transientDurationHours * 3600)),
            timeStep_s: Math.max(1, Math.round(transientTimeStepSeconds)),
            initialTemperature_C: transientInitialTemperatureC,
            innerTemperature_C: transientIndoorTemperatureC,
            outerTemperature_C: transientOutdoorTemperatureC,
            outerTemperatureEnd_C: transientOutdoorEndTemperatureC,
            reducedInnerTemperature_C: transientReducedIndoorTemperatureC,
            restoredInnerTemperature_C: transientRestoredIndoorTemperatureC,
        });
        const run = runTransientConstructionAnalysis({
            target: selectedTransientTarget,
            scenario,
            nodesPerLayer: transientNodesPerLayer,
            options: {
                scheme: "explicit",
                innerSurfaceLimit_C: transientReducedIndoorTemperatureC,
            },
        });
        setTransientResult(run.result);
        setTransientActiveTarget(run.result ? selectedTransientTarget : null);
        setTransientWarnings(run.warnings);
        setTransientMissingData(run.missingData);
        setTransientMonteCarloResult(null);
        setTransientDisplayedSampleMode("base");
        setTransientSelectedTimeIndex(Math.max(0, (run.result?.time.length ?? 1) - 1));
        setTransientVisualizationEnabled(false);
        if (run.result) {
            setResultsVisible(true);
        }
    }, [
        selectedTransientScenarioId,
        selectedTransientTarget,
        transientDurationHours,
        transientInitialTemperatureC,
        transientIndoorTemperatureC,
        transientNodesPerLayer,
        transientOutdoorEndTemperatureC,
        transientOutdoorTemperatureC,
        transientReducedIndoorTemperatureC,
        transientRestoredIndoorTemperatureC,
        transientTimeStepSeconds,
    ]);
    const handleRunTransientMonteCarlo = useCallback(() => {
        if (!selectedTransientTarget) {
            setTransientMonteCarloResult(null);
            setTransientWarnings((current) => current.length
                ? current
                : ["Добавьте стену, крышу или перекрытие со слоями, чтобы запустить вероятностный transient-расчет."]);
            return;
        }
        const scenario = buildTransientScenarioPreset(selectedTransientScenarioId, {
            duration_s: Math.max(1, Math.round(transientDurationHours * 3600)),
            timeStep_s: Math.max(1, Math.round(transientTimeStepSeconds)),
            initialTemperature_C: transientInitialTemperatureC,
            innerTemperature_C: transientIndoorTemperatureC,
            outerTemperature_C: transientOutdoorTemperatureC,
            outerTemperatureEnd_C: transientOutdoorEndTemperatureC,
            reducedInnerTemperature_C: transientReducedIndoorTemperatureC,
            restoredInnerTemperature_C: transientRestoredIndoorTemperatureC,
        });
        const prepared = runTransientConstructionAnalysis({
            target: selectedTransientTarget,
            scenario,
            nodesPerLayer: transientNodesPerLayer,
            options: {
                scheme: "explicit",
                innerSurfaceLimit_C: transientComfortMinC,
            },
        });
        if (!prepared.layers.length || prepared.missingData.length) {
            setTransientMonteCarloResult(null);
            setTransientWarnings(prepared.warnings);
            setTransientMissingData(prepared.missingData);
            return;
        }
        setTransientMonteCarloRunning(true);
        try {
            const next = runTransientMonteCarlo({
                baseScenarioId: scenario.id,
                constructionSourceId: selectedTransientTarget.sourceId,
                constructionSourceType: selectedTransientTarget.sourceType,
                samplesCount: Math.max(10, Math.round(transientMonteCarloSamplesCount)),
                seed: Math.round(transientMonteCarloSeed),
                parameters: transientUncertaintyParameters,
                comfortMin_C: transientComfortMinC,
                criticalSurfaceTemperature_C: transientCriticalSurfaceTemperatureC,
            }, scenario, prepared.layers);
            setTransientMonteCarloResult(next);
            setTransientDisplayedSampleMode("base");
            setTransientWarnings((current) => dedupeWarningList([...current, ...prepared.warnings, ...next.warnings]));
            setTransientMissingData(prepared.missingData);
            setLastCalculatedAtIso(new Date().toISOString());
        }
        finally {
            setTransientMonteCarloRunning(false);
        }
    }, [
        selectedTransientScenarioId,
        selectedTransientTarget,
        transientComfortMinC,
        transientCriticalSurfaceTemperatureC,
        transientDurationHours,
        transientInitialTemperatureC,
        transientIndoorTemperatureC,
        transientMonteCarloSamplesCount,
        transientMonteCarloSeed,
        transientNodesPerLayer,
        transientOutdoorEndTemperatureC,
        transientOutdoorTemperatureC,
        transientReducedIndoorTemperatureC,
        transientRestoredIndoorTemperatureC,
        transientTimeStepSeconds,
        transientUncertaintyParameters,
    ]);
    const handleVisualizeTransientMonteCarloSample = useCallback((mode) => {
        const sample = getTransientMonteCarloVisualizationSample(transientMonteCarloResult, mode);
        if (!sample || !selectedTransientTarget) {
            return;
        }
        setTransientResult(sample.transientResult);
        setTransientActiveTarget(selectedTransientTarget);
        setTransientWarnings(dedupeWarningList(sample.warnings));
        setTransientMissingData([]);
        setTransientSelectedTimeIndex(sample.selectedTimeIndex);
        setTransientDisplayedSampleMode(mode);
        setTransientVisualizationEnabled(true);
        onRequestThermalModelView?.();
    }, [onRequestThermalModelView, selectedTransientTarget, transientMonteCarloResult]);
    return (_jsx("section", { "data-testid": "thermal-results-panel", className: "ui-panel min-w-0 space-y-4 overflow-x-hidden overflow-y-visible p-4", children: !resultsVisible ? (_jsxs("div", { className: "mx-auto w-full max-w-4xl space-y-6", children: [_jsxs("div", { "data-testid": "thermal-results-empty-state", className: "rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-4 text-sm text-[color:var(--warning-fg)]", children: [_jsx("p", { className: "font-semibold text-[color:var(--text-base)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0440\u0430\u0441\u0447\u0451\u0442 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0441\u044F" }), _jsx("p", { className: "mt-1 leading-6", children: "\u0412\u043A\u043B\u0430\u0434\u043A\u0430 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 \u043E\u0442\u043A\u0440\u044B\u0442\u0430, \u043D\u043E \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u043C\u043E\u0434\u0435\u043B\u0438 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u043E\u0433\u043E \u0442\u0435\u043F\u043B\u043E\u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430. \u041D\u0438\u0436\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u0438 \u043A\u043D\u043E\u043F\u043A\u0430 \u00AB\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442\u00BB." })] }), _jsxs("div", { className: "ui-panel-muted min-w-0 p-4 sm:p-5", children: [_jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0440\u0430\u0441\u0447\u0451\u0442\u0430" }), _jsx("p", { className: "mt-1 text-xs text-[color:var(--text-soft)]", children: "\u041A\u043B\u0438\u043C\u0430\u0442, \u0443\u0441\u0442\u0430\u0432\u043A\u0438, \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F \u0438 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0435 \u0434\u043E\u043F\u0443\u0449\u0435\u043D\u0438\u044F." }), _jsxs("div", { className: "mt-3 rounded-2xl border border-[color:var(--accent-base)]/20 bg-[color:var(--accent-muted)]/10 px-4 py-3 text-xs leading-6 text-[color:var(--text-muted)]", children: [_jsx("p", { className: "font-semibold text-[color:var(--text-base)]", children: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0432\u043B\u0438\u044F\u044E\u0442 \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0440\u0430\u0441\u0447\u0451\u0442" }), _jsx("p", { className: "mt-1", children: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 ACH, \u0443\u0441\u0442\u0430\u0432\u043E\u043A, \u043A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F \u0438 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0445 \u043A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442\u043E\u0432 \u043C\u0435\u043D\u044F\u0435\u0442 \u0432\u0445\u043E\u0434\u044B \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E \u043F\u0440\u043E\u0433\u043E\u043D\u0430. \u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0435 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043D\u0435 \u043F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438: \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0430\u0432\u043A\u0438 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442 \u0437\u0430\u043D\u043E\u0432\u043E." })] }), _jsxs("div", { className: "mt-3 grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "ui-panel-muted min-w-0 rounded-2xl border border-[color:var(--border-soft)] p-3 md:col-span-2", children: [_jsxs("div", { className: "flex min-w-0 flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]", children: "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442\u0430" }), _jsxs("p", { className: "mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]", children: ["\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: ", formatThermalSimulationPeriodRu(options.duration), ". \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0432 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u043C RC-\u043A\u043E\u043D\u0442\u0443\u0440\u0435 \u0438 Monte Carlo \u043F\u043E \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0439 \u043C\u043E\u0434\u0435\u043B\u0438. \u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F: 24 \u0447\u0430\u0441\u0430 \u0438\u043B\u0438 7 \u0441\u0443\u0442\u043E\u043A. \u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E: ", formatThermalSimulationPeriodRu(DEFAULT_THERMAL_OPTIONS.duration), "."] })] }), _jsx("button", { type: "button", onClick: () => updateOptions({ duration: DEFAULT_THERMAL_OPTIONS.duration }), className: "rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]", children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C" })] }), _jsx("div", { className: "mt-3 inline-flex overflow-hidden rounded-full border border-[color:var(--border-soft)]", children: ["24h", "7d"].map((duration) => (_jsx("button", { type: "button", onClick: () => updateOptions({ duration }), className: `px-3 py-1 text-[11px] font-semibold ${options.duration === duration ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "text-[color:var(--text-muted)]"}`, children: duration === "24h" ? "24 часа" : "7 дней" }, duration))) })] }), _jsxs("label", { className: "ui-panel-muted min-w-0 rounded-2xl border border-[color:var(--border-soft)] p-3 text-xs font-semibold text-[color:var(--text-muted)] md:col-span-2", children: [_jsxs("div", { className: "flex min-w-0 flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("span", { className: "block min-w-0 whitespace-normal break-words leading-snug", children: "\u0428\u0430\u0433 \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438, \u043C\u0438\u043D" }), _jsxs("span", { className: "mt-1 block text-[11px] font-normal leading-5 text-[color:var(--text-soft)]", children: ["\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: ", formatNumber(options.timestepMinutes ?? DEFAULT_THERMAL_OPTIONS.timestepMinutes ?? 10, { maximumFractionDigits: 0 }), " \u043C\u0438\u043D. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0432 \u044F\u0432\u043D\u043E\u043C \u0448\u0430\u0433\u0435 RC-\u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0442\u043E\u0440\u0430. \u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u043D\u0430\u0431\u043E\u0440: ", TIMESTEP_CHOICES.join(", "), " \u043C\u0438\u043D. \u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E: ", DEFAULT_THERMAL_OPTIONS.timestepMinutes ?? 10, " \u043C\u0438\u043D."] })] }), _jsx("button", { type: "button", onClick: () => updateOptions({ timestepMinutes: DEFAULT_THERMAL_OPTIONS.timestepMinutes ?? 10 }), className: "rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]", children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C" })] }), _jsx("select", { value: options.timestepMinutes ?? 10, onChange: (event) => updateOptions({ timestepMinutes: Number(event.target.value) }), className: "mt-2 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]", children: TIMESTEP_CHOICES.map((choice) => (_jsxs("option", { value: choice, children: [choice, " \u043C\u0438\u043D"] }, choice))) })] }), _jsxs("div", { className: "ui-panel-muted min-w-0 p-3", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0423\u043B\u0438\u0447\u043D\u044B\u0439 \u043A\u043B\u0438\u043C\u0430\u0442" }), _jsx("p", { className: "mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]", children: "\u0421\u0438\u043D\u0443\u0441\u043E\u0438\u0434\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0434\u043B\u044F RC-\u043C\u043E\u0434\u0435\u043B\u0438. \u042D\u0442\u043E \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u043A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F, \u0430 \u043D\u0435 \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u0430\u044F \u043A\u043B\u0438\u043C\u0430\u0442\u043E\u043B\u043E\u0433\u0438\u044F \u0421\u041F 131." }), _jsxs("div", { className: "mt-2 grid gap-2 sm:grid-cols-2", children: [_jsx(NumberInput, { label: "\u0411\u0430\u0437\u043E\u0432\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u00B0C", value: options.outdoor.baseC, step: 0.5, description: "\u0421\u0440\u0435\u0434\u043D\u0438\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0438.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C, \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0435 \u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u0438 Monte Carlo \u043F\u043E \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0439 \u043C\u043E\u0434\u0435\u043B\u0438.", rangeHint: "\u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E \u043E\u0441\u043C\u044B\u0441\u043B\u0435\u043D\u043D\u044B\u0439 \u043A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.outdoor.baseC} °C`, onReset: () => updateOutdoor({ baseC: DEFAULT_THERMAL_OPTIONS.outdoor.baseC }), onChange: (value) => updateOutdoor({ baseC: value }) }), _jsx(NumberInput, { label: "\u0410\u043C\u043F\u043B\u0438\u0442\u0443\u0434\u0430, \u00B0C", value: options.outdoor.amplitudeC, step: 0.5, min: 0, description: "\u0420\u0430\u0437\u043C\u0430\u0445 \u043A\u043E\u043B\u0435\u0431\u0430\u043D\u0438\u0439 \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C \u0438 \u043A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0432\u0430\u0440\u0438\u0430\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C.", rangeHint: "\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 0", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.outdoor.amplitudeC} °C`, onReset: () => updateOutdoor({ amplitudeC: DEFAULT_THERMAL_OPTIONS.outdoor.amplitudeC }), onChange: (value) => updateOutdoor({ amplitudeC: value }) }), _jsx(NumberInput, { label: "\u0421\u0435\u0437\u043E\u043D\u043D\u044B\u0439 \u0441\u0434\u0432\u0438\u0433, \u00B0C", value: options.outdoor.seasonalOffsetC ?? 0, step: 0.5, description: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0441\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0432\u0441\u0435\u0433\u043E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0444\u0438\u043B\u044F.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C \u0438 \u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043A \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C\u0443 \u043A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C\u0443 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044E.", rangeHint: "\u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0438 \u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0441\u043C\u0435\u0449\u0435\u043D\u0438\u0435", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.outdoor.seasonalOffsetC ?? 0} °C`, onReset: () => updateOutdoor({ seasonalOffsetC: DEFAULT_THERMAL_OPTIONS.outdoor.seasonalOffsetC ?? 0 }), onChange: (value) => updateOutdoor({ seasonalOffsetC: value }) }), _jsx(NumberInput, { label: "\u0424\u0430\u0437\u0430 \u0432\u043E\u043B\u043D\u044B, \u0447", value: options.outdoor.phaseShiftHours ?? 0, step: 1, description: "\u0421\u0434\u0432\u0438\u0433 \u0441\u0443\u0442\u043E\u0447\u043D\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0439 \u0432\u043E\u043B\u043D\u044B \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C \u043F\u0440\u0438 \u0441\u0438\u043D\u0443\u0441\u043E\u0438\u0434\u0430\u043B\u044C\u043D\u043E\u043C \u043A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u043F\u0440\u043E\u0444\u0438\u043B\u0435.", rangeHint: "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432 \u0447\u0430\u0441\u0430\u0445", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.outdoor.phaseShiftHours ?? 0} ч`, onReset: () => updateOutdoor({ phaseShiftHours: DEFAULT_THERMAL_OPTIONS.outdoor.phaseShiftHours ?? 0 }), onChange: (value) => updateOutdoor({ phaseShiftHours: value }) })] })] }), _jsxs("div", { className: "ui-panel-muted min-w-0 p-3", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0423\u0441\u0442\u0430\u0432\u043A\u0438" }), _jsx("p", { className: "mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]", children: "\u0414\u043D\u0435\u0432\u043D\u0430\u044F \u0438 \u043D\u043E\u0447\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0442 \u0438\u0434\u0435\u0430\u043B\u044C\u043D\u044B\u043C \u0434\u043E\u0433\u0440\u0435\u0432\u043E\u043C \u0434\u043E \u0443\u0441\u0442\u0430\u0432\u043A\u0438 \u0432 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u043C RC-\u043A\u043E\u043D\u0442\u0443\u0440\u0435. \u042D\u0442\u043E \u0441\u0446\u0435\u043D\u0430\u0440\u043D\u0430\u044F \u043C\u043E\u0434\u0435\u043B\u044C, \u0430 \u043D\u0435 \u0433\u0438\u0434\u0440\u0430\u0432\u043B\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0440\u0430\u0441\u0447\u0451\u0442 \u043F\u0440\u0438\u0431\u043E\u0440\u0430 \u043F\u043E \u043F\u043E\u0434\u0430\u0447\u0435 \u0438 \u043E\u0431\u0440\u0430\u0442\u043A\u0435." }), _jsxs("div", { className: "mt-2 grid gap-2 sm:grid-cols-2", children: [_jsx(NumberInput, { label: "\u0414\u043D\u0435\u0432\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u0432\u043A\u0430, \u00B0C", value: options.setpoints.day, step: 0.5, description: "\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432 \u0447\u0430\u0441\u044B \u0434\u043D\u0435\u0432\u043D\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C \u0438 Monte Carlo \u043F\u043E \u0443\u0441\u0442\u0430\u0432\u043A\u0430\u043C.", rangeHint: "\u043A\u043E\u043C\u0444\u043E\u0440\u0442\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u0432\u043A\u0430 \u0434\u043B\u044F \u0437\u043E\u043D\u044B", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.setpoints.day} °C`, onReset: () => updateSetpoints({ day: DEFAULT_THERMAL_OPTIONS.setpoints.day }), onChange: (value) => updateSetpoints({ day: value }) }), _jsx(NumberInput, { label: "\u041D\u043E\u0447\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u0432\u043A\u0430, \u00B0C", value: options.setpoints.night, step: 0.5, description: "\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432 \u0447\u0430\u0441\u044B \u043D\u043E\u0447\u043D\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C \u0438 Monte Carlo \u043F\u043E \u0443\u0441\u0442\u0430\u0432\u043A\u0430\u043C.", rangeHint: "\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E \u043D\u043E\u0447\u043D\u043E\u0435 \u043F\u043E\u043D\u0438\u0436\u0435\u043D\u0438\u0435", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.setpoints.night} °C`, onReset: () => updateSetpoints({ night: DEFAULT_THERMAL_OPTIONS.setpoints.night }), onChange: (value) => updateSetpoints({ night: value }) }), _jsx(NumberInput, { label: "\u041D\u0430\u0447\u0430\u043B\u043E \u0434\u043D\u044F, \u0447", value: options.setpoints.dayStartHour, min: 0, max: 23, step: 1, description: "\u0427\u0430\u0441 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 \u043A \u0434\u043D\u0435\u0432\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u0432\u043A\u0435.", usedIn: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 setpoint \u0432 RC-\u043C\u043E\u0434\u0435\u043B\u0438.", rangeHint: "\u043E\u0442 0 \u0434\u043E 23 \u0447", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.setpoints.dayStartHour} ч`, onReset: () => updateSetpoints({ dayStartHour: DEFAULT_THERMAL_OPTIONS.setpoints.dayStartHour }), onChange: (value) => updateSetpoints({ dayStartHour: clampHour(value) }) }), _jsx(NumberInput, { label: "\u041D\u0430\u0447\u0430\u043B\u043E \u043D\u043E\u0447\u0438, \u0447", value: options.setpoints.nightStartHour, min: 0, max: 23, step: 1, description: "\u0427\u0430\u0441 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0430 \u043A \u043D\u043E\u0447\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u0432\u043A\u0435.", usedIn: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 setpoint \u0432 RC-\u043C\u043E\u0434\u0435\u043B\u0438.", rangeHint: "\u043E\u0442 0 \u0434\u043E 23 \u0447", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.setpoints.nightStartHour} ч`, onReset: () => updateSetpoints({ nightStartHour: DEFAULT_THERMAL_OPTIONS.setpoints.nightStartHour }), onChange: (value) => updateSetpoints({ nightStartHour: clampHour(value) }) })] })] }), _jsxs("div", { className: "ui-panel-muted min-w-0 p-3", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F" }), _jsx("p", { className: "mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]", children: "\u0423\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u043F\u0440\u0438\u0442\u043E\u043A\u0438 \u043F\u043E\u0434\u0430\u044E\u0442\u0441\u044F \u0432 RC-\u043C\u043E\u0434\u0435\u043B\u044C \u043A\u0430\u043A \u0441\u0446\u0435\u043D\u0430\u0440\u043D\u044B\u0439 \u0444\u043E\u043D. \u041E\u043D\u0438 \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u044E\u0442 \u0431\u043E\u043B\u0435\u0435 \u0434\u0435\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0430\u0437\u0431\u043E\u0440 \u043F\u043E \u043B\u044E\u0434\u044F\u043C, \u043E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u044E \u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044E \u0432 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E\u043C \u0431\u0430\u043B\u0430\u043D\u0441\u0435." }), _jsxs("div", { className: "mt-2 grid gap-2 sm:grid-cols-2", children: [_jsx(NumberInput, { label: "\u0414\u0435\u043D\u044C, \u0412\u0442/\u043C\u00B2", value: options.internalGains.dayGain_W_m2, step: 0.5, description: "\u0423\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0434\u043D\u0435\u0432\u043D\u044B\u0435 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C \u0438 Monte Carlo \u0447\u0435\u0440\u0435\u0437 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C internal gains.", rangeHint: "\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 0", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.internalGains.dayGain_W_m2} Вт/м²`, onReset: () => updateGains({ dayGain_W_m2: DEFAULT_THERMAL_OPTIONS.internalGains.dayGain_W_m2 }), onChange: (value) => updateGains({ dayGain_W_m2: Math.max(0, value) }) }), _jsx(NumberInput, { label: "\u041D\u043E\u0447\u044C, \u0412\u0442/\u043C\u00B2", value: options.internalGains.nightGain_W_m2, step: 0.5, description: "\u0423\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u043D\u043E\u0447\u043D\u044B\u0435 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C \u0438 Monte Carlo \u0447\u0435\u0440\u0435\u0437 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C internal gains.", rangeHint: "\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 0", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.internalGains.nightGain_W_m2} Вт/м²`, onReset: () => updateGains({ nightGain_W_m2: DEFAULT_THERMAL_OPTIONS.internalGains.nightGain_W_m2 }), onChange: (value) => updateGains({ nightGain_W_m2: Math.max(0, value) }) })] })] }), _jsx(NumberInput, { label: "\u0418\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044F, ACH", value: options.infiltrationACH ?? 0.5, step: 0.1, min: 0, description: "\u042D\u043A\u0432\u0438\u0432\u0430\u043B\u0435\u043D\u0442\u043D\u0430\u044F \u043A\u0440\u0430\u0442\u043D\u043E\u0441\u0442\u044C \u0432\u043E\u0437\u0434\u0443\u0445\u043E\u043E\u0431\u043C\u0435\u043D\u0430 \u0447\u0435\u0440\u0435\u0437 \u0438\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044E.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C \u0438 Monte Carlo \u0447\u0435\u0440\u0435\u0437 Ginf = \u03C1 c ACH V / 3600.", rangeHint: "ACH \u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 0", defaultValueLabel: `${DEFAULT_THERMAL_OPTIONS.infiltrationACH ?? 0.5} 1/ч`, onReset: () => updateOptions({ infiltrationACH: DEFAULT_THERMAL_OPTIONS.infiltrationACH ?? 0.5 }), onChange: (value) => updateOptions({ infiltrationACH: Math.max(0, value) }) }), _jsxs("div", { className: "ui-panel-muted min-w-0 p-3", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u0430\u044F \u043C\u043E\u0434\u0435\u043B\u044C" }), _jsx("p", { className: "mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]", children: "\u042D\u0442\u0438 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u043F\u0438\u0442\u0430\u044E\u0442 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u043A\u0432\u0430\u0437\u0438\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u0431\u0430\u043B\u0430\u043D\u0441 \u0438 \u0430\u043D\u0430\u043B\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u0440\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043F\u043E\u0442\u0435\u0440\u044C. \u041E\u043D\u0438 \u043D\u0435 \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u044B\u0432\u0430\u044E\u0442 \u0444\u0438\u0437\u0438\u043A\u0443 RC-\u044F\u0434\u0440\u0430 \u0438 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u043C \u0440\u0430\u0441\u0447\u0451\u0442\u0435." }), _jsxs("div", { className: "mt-2 grid gap-2", children: [_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-muted)]", children: ["\u0420\u0435\u0436\u0438\u043C \u0440\u0430\u0441\u0447\u0435\u0442\u0430", _jsxs("select", { value: engineeringOptions.mode, onChange: (event) => updateEngineering({ mode: event.target.value }), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]", children: [_jsx("option", { value: "quick", children: "\u0411\u044B\u0441\u0442\u0440\u044B\u0439 \u0440\u0430\u0441\u0447\u0435\u0442" }), _jsx("option", { value: "engineering", children: "\u0414\u0435\u0442\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0435\u0442" })] })] }), _jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-muted)]", children: ["\u0410\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u0443\u0435\u043C\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C", _jsxs("select", { value: engineeringOptions.targetLevelId ?? "", onChange: (event) => updateEngineering({ targetLevelId: event.target.value || null }), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]", children: [_jsx("option", { value: "", children: "\u0410\u0432\u0442\u043E" }), model.levels.map((level) => (_jsx("option", { value: level.id, children: getLevelDisplayLabel(model, level.id) }, level.id)))] })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsx(NumberInput, { label: "\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u00B0C", value: engineeringOptions.targetTemperatureC, step: 0.5, description: "\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0434\u043B\u044F \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E\u0433\u043E \u0431\u0430\u043B\u0430\u043D\u0441\u0430.", usedIn: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u043A\u0432\u0430\u0437\u0438\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0443\u0440.", rangeHint: "\u043A\u043E\u043C\u0444\u043E\u0440\u0442\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u043E\u0433\u043E \u0443\u0440\u043E\u0432\u043D\u044F", defaultValueLabel: `${DEFAULT_ENGINEERING_OPTIONS.targetTemperatureC} °C`, onReset: () => updateEngineering({ targetTemperatureC: DEFAULT_ENGINEERING_OPTIONS.targetTemperatureC }), onChange: (value) => updateEngineering({ targetTemperatureC: value }) }), _jsx(NumberInput, { label: "\u0412\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u044F, ACH", value: engineeringOptions.ventilationACH, step: 0.05, min: 0, description: "\u041A\u0440\u0430\u0442\u043D\u043E\u0441\u0442\u044C \u0432\u043E\u0437\u0434\u0443\u0445\u043E\u043E\u0431\u043C\u0435\u043D\u0430 \u0434\u043B\u044F \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E\u0433\u043E \u0431\u0430\u043B\u0430\u043D\u0441\u0430.", usedIn: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u043A\u0432\u0430\u0437\u0438\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0443\u0440.", rangeHint: "ACH \u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 0", defaultValueLabel: `${DEFAULT_ENGINEERING_OPTIONS.ventilationACH} 1/ч`, onReset: () => updateEngineering({ ventilationACH: DEFAULT_ENGINEERING_OPTIONS.ventilationACH }), onChange: (value) => updateEngineering({ ventilationACH: Math.max(0, value) }) }), _jsx(NumberInput, { label: "\u041A\u043E\u044D\u0444. \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u043C\u0430\u0441\u0441\u044B", value: engineeringOptions.effectiveMassFactor, step: 0.1, min: 0.1, description: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0439 \u0442\u0435\u043F\u043B\u043E\u0451\u043C\u043A\u043E\u0441\u0442\u0438 \u0437\u043E\u043D\u044B.", usedIn: "RC-\u043C\u043E\u0434\u0435\u043B\u044C \u0438 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E\u0435 \u0440\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043F\u043E \u0437\u043E\u043D\u0430\u043C.", rangeHint: "\u0431\u043E\u043B\u044C\u0448\u0435 0", defaultValueLabel: formatNumber(DEFAULT_ENGINEERING_OPTIONS.effectiveMassFactor, { maximumFractionDigits: 1 }), onReset: () => updateEngineering({ effectiveMassFactor: DEFAULT_ENGINEERING_OPTIONS.effectiveMassFactor }), onChange: (value) => updateEngineering({ effectiveMassFactor: Math.max(0.1, value) }) }), _jsx(NumberInput, { label: "\u041E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u0435, \u0412\u0442/\u043C\u00B2", value: engineeringOptions.lightingGain_W_m2, step: 0.1, min: 0, description: "\u0423\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F \u043E\u0442 \u043E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u044F.", usedIn: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u043A\u0432\u0430\u0437\u0438\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u0431\u0430\u043B\u0430\u043D\u0441.", rangeHint: "\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 0", defaultValueLabel: `${DEFAULT_ENGINEERING_OPTIONS.lightingGain_W_m2} Вт/м²`, onReset: () => updateEngineering({ lightingGain_W_m2: DEFAULT_ENGINEERING_OPTIONS.lightingGain_W_m2 }), onChange: (value) => updateEngineering({ lightingGain_W_m2: Math.max(0, value) }) }), _jsx(NumberInput, { label: "\u0417\u0430\u043D\u044F\u0442\u043E\u0441\u0442\u044C, \u0412\u0442/\u043C\u00B2", value: engineeringOptions.occupancyGain_W_m2, step: 0.1, min: 0, description: "\u0423\u0434\u0435\u043B\u044C\u043D\u043E\u0435 \u0442\u0435\u043F\u043B\u043E\u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043E\u0442 \u043B\u044E\u0434\u0435\u0439.", usedIn: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u043A\u0432\u0430\u0437\u0438\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u0431\u0430\u043B\u0430\u043D\u0441.", rangeHint: "\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 0", defaultValueLabel: `${DEFAULT_ENGINEERING_OPTIONS.occupancyGain_W_m2} Вт/м²`, onReset: () => updateEngineering({ occupancyGain_W_m2: DEFAULT_ENGINEERING_OPTIONS.occupancyGain_W_m2 }), onChange: (value) => updateEngineering({ occupancyGain_W_m2: Math.max(0, value) }) }), _jsx(NumberInput, { label: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F", value: engineeringOptions.equipmentGainMultiplier, step: 0.05, min: 0, description: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u043F\u0430\u0441\u0441\u0438\u0432\u043D\u044B\u0445 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0439 \u043E\u0442 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F.", usedIn: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u043A\u0432\u0430\u0437\u0438\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u0431\u0430\u043B\u0430\u043D\u0441.", rangeHint: "\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 0", defaultValueLabel: formatNumber(DEFAULT_ENGINEERING_OPTIONS.equipmentGainMultiplier, { maximumFractionDigits: 2 }), onReset: () => updateEngineering({ equipmentGainMultiplier: DEFAULT_ENGINEERING_OPTIONS.equipmentGainMultiplier }), onChange: (value) => updateEngineering({ equipmentGainMultiplier: Math.max(0, value) }) }), _jsx(NumberInput, { label: "\u0428\u0430\u0433 \u0441\u0435\u0442\u043A\u0438, \u043C", value: engineeringOptions.grid.cellSizeM, step: 0.05, min: 0.12, description: "\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u044B.", usedIn: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u0430\u044F \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F, \u043D\u0435 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0435 \u044F\u0434\u0440\u043E RC.", rangeHint: "\u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 0.12 \u043C", defaultValueLabel: `${formatNumber(DEFAULT_ENGINEERING_OPTIONS.grid.cellSizeM, { maximumFractionDigits: 2 })} м`, onReset: () => updateEngineering({ grid: { ...engineeringOptions.grid, cellSizeM: DEFAULT_ENGINEERING_OPTIONS.grid.cellSizeM } }), onChange: (value) => updateEngineering({ grid: { ...engineeringOptions.grid, cellSizeM: Math.max(0.12, value) } }) })] })] })] }), _jsxs("div", { className: "ui-panel-muted min-w-0 p-3", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F" }), _jsxs("div", { className: "mt-2 grid gap-2 sm:grid-cols-2", children: [_jsx(NumberInput, { label: "\u0394T \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0433\u043E \u0432\u043E\u0437\u0434\u0443\u0445\u0430, \u00B0C", value: engineeringOptions.scenarioDraft.outdoorDeltaC, step: 1, onChange: (value) => updateEngineering({
                                                        scenarioDraft: { ...engineeringOptions.scenarioDraft, outdoorDeltaC: value },
                                                    }) }), _jsx(NumberInput, { label: "Scale U \u043E\u043A\u043D\u0430", value: engineeringOptions.scenarioDraft.windowUScale, step: 0.05, min: 0.2, onChange: (value) => updateEngineering({
                                                        scenarioDraft: { ...engineeringOptions.scenarioDraft, windowUScale: Math.max(0.2, value) },
                                                    }) }), _jsx(NumberInput, { label: "\u0394R \u0443\u0442\u0435\u043F\u043B\u0435\u043D\u0438\u044F, \u043C\u00B2\u00B7\u041A/\u0412\u0442", value: engineeringOptions.scenarioDraft.insulationResistanceDelta_m2K_W, step: 0.1, min: 0, onChange: (value) => updateEngineering({
                                                        scenarioDraft: {
                                                            ...engineeringOptions.scenarioDraft,
                                                            insulationResistanceDelta_m2K_W: Math.max(0, value),
                                                        },
                                                    }) }), _jsx(NumberInput, { label: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u0438", value: engineeringOptions.scenarioDraft.ventilationMultiplier, step: 0.05, min: 0.2, onChange: (value) => updateEngineering({
                                                        scenarioDraft: { ...engineeringOptions.scenarioDraft, ventilationMultiplier: Math.max(0.2, value) },
                                                    }) }), _jsx(NumberInput, { label: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0440\u0430\u0434\u0438\u0430\u0442\u043E\u0440\u043E\u0432", value: engineeringOptions.scenarioDraft.radiatorPowerMultiplier, step: 0.05, min: 0.2, onChange: (value) => updateEngineering({
                                                        scenarioDraft: { ...engineeringOptions.scenarioDraft, radiatorPowerMultiplier: Math.max(0.2, value) },
                                                    }) }), _jsx(NumberInput, { label: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F", value: engineeringOptions.scenarioDraft.equipmentGainMultiplier, step: 0.05, min: 0.2, onChange: (value) => updateEngineering({
                                                        scenarioDraft: { ...engineeringOptions.scenarioDraft, equipmentGainMultiplier: Math.max(0.2, value) },
                                                    }) })] })] })] }), _jsx(Tooltip, { className: "mt-4 w-full", title: "\u0414\u0435\u0442\u0435\u0440\u043C\u0438\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442", description: "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043C\u043D\u043E\u0433\u043E\u0437\u043E\u043D\u043D\u044B\u0439 RC-\u0440\u0435\u0448\u0430\u0442\u0435\u043B\u044C \u0441 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u043C\u0438 \u0441\u0435\u0442\u043F\u043E\u0438\u043D\u0442\u0430\u043C\u0438, \u043A\u043B\u0438\u043C\u0430\u0442\u043E\u043C \u0438 \u0442\u0435\u043F\u043B\u043E\u043F\u0440\u0438\u0442\u043E\u043A\u0430\u043C\u0438.", details: [
                                "Вход: RC граф (комнаты, стены), Δt (мин)",
                                "Выход: T(t) °C, Q_hvac(t) кВт, KPI (энергия, комфорт)",
                            ], linkedFormulaIds: ["thermal_balance", "envelope_heat_loss", "envelope_infiltration"], children: _jsx("button", { type: "button", disabled: !canRun || running, onClick: handleRun, className: `w-full rounded-2xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-muted)] ${!canRun || running ? "cursor-not-allowed bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]" : "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)] hover:brightness-110"}`, children: running ? "Считаю..." : "Выполнить расчёт" }) }), _jsx("button", { type: "button", onClick: runDemoSp50, className: "mt-2 w-full rounded-2xl border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]", children: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u043E \u0421\u041F" }), demoSp50Result ? (_jsx("div", { className: "mt-2 rounded-xl border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-3 py-2 text-xs text-[color:var(--success-fg)]", children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043D \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0421\u041F 50.13330.2024. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0434\u043B\u044F \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u043E\u0442\u0447\u0435\u0442\u0430." })) : null, !canRun && (_jsx("p", { className: "mt-2 text-xs text-[color:var(--warning-fg)]", children: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435, \u0447\u0442\u043E\u0431\u044B \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0442\u0435\u043F\u043B\u043E\u0432\u0443\u044E \u043C\u043E\u0434\u0435\u043B\u044C." })), error && (_jsx("p", { className: "mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600", children: error })), lastCalculatedAtIso ? (_jsxs("p", { className: "mt-2 text-xs text-[color:var(--text-soft)]", children: ["\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0440\u0430\u0441\u0447\u0435\u0442: ", new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastCalculatedAtIso))] })) : null] }), _jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041D\u0435\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0435\u0442" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "1D \u0442\u0435\u043F\u043B\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u043D\u043E\u0441\u0442\u044C \u0447\u0435\u0440\u0435\u0437 \u0442\u043E\u043B\u0449\u0438\u043D\u0443 \u0441\u0442\u0435\u043D\u044B, \u043A\u0440\u044B\u0448\u0438 \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u043A\u0440\u044B\u0442\u0438\u044F." })] }), _jsx("span", { className: `rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneSurface(transientStatus.tone)}`, children: transientStatus.label })] }), _jsxs("div", { className: "mt-3 grid gap-3", children: [_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-muted)]", children: ["\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439", _jsx("select", { value: selectedTransientScenarioId, onChange: (event) => setSelectedTransientScenarioId(event.target.value), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]", children: TRANSIENT_SCENARIO_PRESETS.map((scenario) => (_jsx("option", { value: scenario.id, children: scenario.name }, scenario.id))) })] }), _jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-muted)]", children: ["\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F", _jsx("select", { value: selectedTransientTarget?.id ?? "", onChange: (event) => setSelectedTransientConstructionId(event.target.value || null), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]", children: transientTargets.length ? (transientTargets.map((target) => (_jsx("option", { value: target.id, children: target.label }, target.id)))) : (_jsx("option", { value: "", children: "\u041D\u0435\u0442 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0439 \u0441\u043E \u0441\u043B\u043E\u044F\u043C\u0438" })) })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3", children: [_jsx(NumberInput, { label: "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C, \u0447", value: transientDurationHours, step: 1, min: 1, onChange: setTransientDurationHours }), _jsx(NumberInput, { label: "\u0428\u0430\u0433 \u0432\u0440\u0435\u043C\u0435\u043D\u0438, \u0441", value: transientTimeStepSeconds, step: 1, min: 1, onChange: setTransientTimeStepSeconds }), _jsx(NumberInput, { label: "\u0423\u0437\u043B\u043E\u0432 \u043D\u0430 \u0441\u043B\u043E\u0439", value: transientNodesPerLayer, step: 1, min: 1, max: 12, onChange: (value) => setTransientNodesPerLayer(Math.max(1, Math.round(value))) }), _jsx(NumberInput, { label: "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u0430\u044F t, \u00B0C", value: transientInitialTemperatureC, step: 0.5, onChange: setTransientInitialTemperatureC }), _jsx(NumberInput, { label: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F t, \u00B0C", value: transientIndoorTemperatureC, step: 0.5, onChange: setTransientIndoorTemperatureC }), _jsx(NumberInput, { label: "\u041D\u0430\u0440\u0443\u0436\u043D\u0430\u044F t, \u00B0C", value: transientOutdoorTemperatureC, step: 0.5, onChange: setTransientOutdoorTemperatureC }), _jsx(NumberInput, { label: "\u041D\u0430\u0440\u0443\u0436\u043D\u0430\u044F t \u0444\u0438\u043D\u0430\u043B, \u00B0C", value: transientOutdoorEndTemperatureC, step: 0.5, onChange: setTransientOutdoorEndTemperatureC }), _jsx(NumberInput, { label: "\u041F\u043E\u043D\u0438\u0436\u0435\u043D\u043D\u0430\u044F \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F t, \u00B0C", value: transientReducedIndoorTemperatureC, step: 0.5, onChange: setTransientReducedIndoorTemperatureC }), _jsx(NumberInput, { label: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F, \u00B0C", value: transientRestoredIndoorTemperatureC, step: 0.5, onChange: setTransientRestoredIndoorTemperatureC })] }), _jsx("button", { type: "button", onClick: handleRunTransient, className: "w-full rounded-2xl bg-[color:var(--accent-base)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:brightness-110", children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439" })] }), _jsxs("div", { className: "mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h5", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u043D\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0440\u0438\u0441\u043A\u0430" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u041C\u0435\u0442\u043E\u0434 \u041C\u043E\u043D\u0442\u0435-\u041A\u0430\u0440\u043B\u043E \u043C\u043D\u043E\u0433\u043E\u043A\u0440\u0430\u0442\u043D\u043E \u043F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043F\u0440\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0438 \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B, \u0442\u0435\u043F\u043B\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u043D\u043E\u0441\u0442\u0438, \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0439 \u0438 \u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445." }), _jsx("p", { className: "mt-1 text-xs text-[color:var(--text-soft)]", children: "\u042D\u0442\u043E \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 \u043E\u0446\u0435\u043D\u0438\u0442\u044C \u043D\u0435 \u043E\u0434\u043D\u043E \u0447\u0438\u0441\u043B\u043E, \u0430 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u044B\u0445 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 \u0438 \u0440\u0438\u0441\u043A \u0432\u044B\u0445\u043E\u0434\u0430 \u043D\u0438\u0436\u0435 \u043A\u043E\u043C\u0444\u043E\u0440\u0442\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u043E\u0433\u0430." })] }), _jsxs("label", { className: "inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)]", children: [_jsx("input", { type: "checkbox", checked: transientMonteCarloEnabled, onChange: (event) => setTransientMonteCarloEnabled(event.target.checked), className: "h-4 w-4 rounded border-[color:var(--border-base)] text-[color:var(--text-base)]" }), "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0430\u043D\u0430\u043B\u0438\u0437"] })] }), transientMonteCarloEnabled ? (_jsxs("div", { className: "mt-3 space-y-3", children: [_jsxs("div", { className: "grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-3", children: [_jsx(NumberInput, { label: "\u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439", value: transientMonteCarloSamplesCount, step: 10, min: 10, max: 500, onChange: (value) => setTransientMonteCarloSamplesCount(Math.max(10, Math.round(value))) }), _jsx(NumberInput, { label: "Seed", value: transientMonteCarloSeed, step: 1, onChange: (value) => setTransientMonteCarloSeed(Math.round(value)) }), _jsx(NumberInput, { label: "\u041A\u043E\u043C\u0444\u043E\u0440\u0442\u043D\u044B\u0439 \u043C\u0438\u043D\u0438\u043C\u0443\u043C, \u00B0C", value: transientComfortMinC, step: 0.5, onChange: setTransientComfortMinC }), _jsx(NumberInput, { label: "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F t \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u0438, \u00B0C", value: transientCriticalSurfaceTemperatureC, step: 0.5, onChange: setTransientCriticalSurfaceTemperatureC }), _jsx(NumberInput, { label: "\u041D\u0430\u0440\u0443\u0436\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u00B1\u00B0C", value: transientOutdoorOffsetC, step: 0.5, min: 0, onChange: setTransientOutdoorOffsetC }), _jsx(NumberInput, { label: "\u041E\u0442\u043E\u043F\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C \u00B1%", value: transientHeatingPowerVariationPercent, step: 1, min: 0, onChange: setTransientHeatingPowerVariationPercent }), _jsx(NumberInput, { label: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F \u00B1%", value: transientInternalGainsVariationPercent, step: 1, min: 0, onChange: setTransientInternalGainsVariationPercent }), _jsx(NumberInput, { label: "\u0422\u0435\u043F\u043B\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u043D\u043E\u0441\u0442\u044C \u00B1%", value: transientLambdaVariationPercent, step: 1, min: 0, onChange: setTransientLambdaVariationPercent }), _jsx(NumberInput, { label: "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u00B1\u00B0C", value: transientInitialTemperatureOffsetC, step: 0.5, min: 0, onChange: setTransientInitialTemperatureOffsetC })] }), _jsx("button", { type: "button", onClick: handleRunTransientMonteCarlo, disabled: transientMonteCarloRunning || !transientUncertaintyParameters.length, className: "w-full rounded-2xl bg-[color:var(--accent-base)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[color:var(--surface-strong)]", children: transientMonteCarloRunning ? "Расчет..." : "Запустить вероятностный расчет" })] })) : null] }), transientMissingData.length ? (_jsx("div", { className: "mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)]", children: transientMissingData.join(" ") })) : null] })] })) : (_jsxs("div", { className: "mx-auto w-full max-w-6xl space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0440\u0430\u0441\u0447\u0451\u0442\u0430" }), _jsx("h3", { className: "text-lg font-semibold text-[color:var(--text-base)]", children: "\u0421\u0432\u043E\u0434\u043A\u0430 \u0438 \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0438" })] }), _jsx("button", { type: "button", onClick: () => setResultsVisible(false), className: "rounded-xl border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]", children: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B" })] }), _jsxs("div", { className: "ui-panel-muted min-w-0 p-4 sm:p-5", children: [_jsx("h4", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0413\u043B\u0430\u0432\u043D\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438" }), _jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(KpiCard, { label: "\u041F\u0438\u043A \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F (\u0441\u0443\u043C\u043C\u0430 \u043F\u043E \u0437\u043E\u043D\u0430\u043C), \u043A\u0412\u0442", value: result ? formatNumber(result.summary.peakLoadKW, { maximumFractionDigits: 2 }) : "—" }), _jsx(KpiCard, { label: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434, \u043A\u0412\u0442\u00B7\u0447", value: result ? formatNumber(result.summary.totalEnergyKWh, { maximumFractionDigits: 1 }) : "—" }), _jsx(KpiCard, { label: "\u0414\u0438\u0441\u043A\u043E\u043C\u0444\u043E\u0440\u0442 (\u0441\u0443\u043C\u043C\u0430 \u043F\u043E \u0437\u043E\u043D\u0430\u043C), \u0447", value: result ? formatNumber(result.summary.discomfortHours, { maximumFractionDigits: 1 }) : "—" }), _jsx(KpiCard, { label: "\u0420\u0430\u0431\u043E\u0447\u0430\u044F \u0437\u043E\u043D\u0430, \u00B0C", value: engineeringResult
                                        ? formatNumber(engineeringResult.comfort.occupiedMeanTemperatureC, { maximumFractionDigits: 1 })
                                        : "—" })] })] }), hasRcDiagnostics ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid min-w-0 gap-4 xl:grid-cols-2", children: [_jsx(ChartCard, { title: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438 \u043F\u043E \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430\u043C", subtitle: "\u0420\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043F\u043E \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F\u043C \u0438\u0437 result.diagnostics.building.", contentClassName: "min-h-[320px]", children: _jsx(RcBuildingLossChart, { rows: rcLossBreakdownRows }) }), _jsxs("div", { className: "ui-panel-muted min-w-0 p-4 sm:p-5", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)] sm:text-base", children: "\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u043F\u043E\u0442\u0435\u0440\u044C" }), _jsx("p", { className: "mt-1 text-xs leading-5 text-[color:var(--text-soft)] sm:text-sm", children: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442\u044B \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u0440\u044F\u0434\u043E\u043C \u0441 \u0430\u0431\u0441\u043E\u043B\u044E\u0442\u043D\u044B\u043C\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F\u043C\u0438 \u0438 \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u044E\u0442 \u0438\u0445." }), _jsx("div", { className: "mt-4 grid gap-3", children: rcLossBreakdownRows.map((row) => (_jsx("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3 shadow-sm", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx("div", { className: "min-w-0", children: _jsx("p", { className: "font-semibold text-[color:var(--text-base)]", children: row.label }) }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: formatRcPower(row.valueW) }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: formatRcPercent(row.sharePercent) })] })] }) }, row.key))) })] })] }), _jsx(ChartCard, { title: "\u0414\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430 \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C", subtitle: "\u0422\u0440\u0435\u0431\u0443\u0435\u043C\u0430\u044F \u0442\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C \u0438 \u0440\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043F\u043E\u0442\u0435\u0440\u044C \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C.", contentClassName: "min-h-[420px]", children: _jsx(RcZoneLossChart, { rows: rcZoneDiagnosticsRows }) }), _jsxs("div", { className: "ui-panel-muted min-w-0 p-4 sm:p-5", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)] sm:text-base", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u043C\u0430\u0442\u0440\u0438\u0446\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439" }), _jsx("p", { className: "mt-1 text-xs leading-5 text-[color:var(--text-soft)] sm:text-sm", children: "\u0414\u043B\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B, \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0438 \u043F\u043E\u0442\u0435\u0440\u044C \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u043A\u043E\u043B\u043E\u043D\u043A\u0438, \u0447\u0442\u043E\u0431\u044B \u043D\u0435 \u0441\u043C\u0435\u0448\u0438\u0432\u0430\u0442\u044C \u00B0C \u0438 \u0412\u0442 \u0432 \u043E\u0434\u043D\u043E\u0439 \u043E\u0441\u0438." }), _jsx("div", { className: "mt-4", children: _jsx(RcZoneHeatmapTable, { rows: rcZoneDiagnosticsRows }) })] })] })) : (_jsx("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-4 text-sm text-[color:var(--text-muted)]", children: "RC-\u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430 \u043F\u043E building \u0438 rooms \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C result \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442. \u0414\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u0431\u0430\u0437\u043E\u0432\u044B\u0435 KPI \u0438 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0435 \u0433\u0440\u0430\u0444\u0438\u043A\u0438." })), _jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4 sm:p-5", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041D\u0435\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442 \u2014 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u0413\u0440\u0430\u0444\u0438\u043A\u0438 \u0438 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u043F\u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438." })] }), _jsx("span", { className: `rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneSurface(transientStatus.tone)}`, children: transientStatus.label })] }), transientResult ? (_jsxs("div", { className: "mt-4 grid gap-2 sm:grid-cols-2", children: [_jsx("button", { type: "button", title: "\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u043D\u0430 3D-\u043C\u043E\u0434\u0435\u043B\u0438.", onClick: () => setTransientVisualizationEnabled((prev) => {
                                        const next = !prev;
                                        if (next)
                                            onRequestThermalModelView?.();
                                        return next;
                                    }), className: `rounded-2xl border px-4 py-3 text-sm font-semibold transition ${transientVisualizationEnabled
                                        ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
                                        : "border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"}`, children: transientVisualizationEnabled ? "Скрыть на модели" : "Показать на модели" }), _jsx("button", { type: "button", onClick: () => setTransientVisualizationEnabled(false), className: "rounded-2xl border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]", children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044E \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F" })] })) : null, transientMonteCarloResult ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: [_jsx(KpiCard, { label: "P(\u043D\u0438\u0436\u0435 \u043A\u043E\u043C\u0444\u043E\u0440\u0442\u0430)", value: formatSafePercent(transientMonteCarloResult.summary.probabilityBelowComfort) }), _jsx(KpiCard, { label: "P(\u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043E\u0445\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u0435)", value: formatSafePercent(transientMonteCarloResult.summary.probabilityBelowCriticalSurface) }), _jsx(KpiCard, { label: "\u041D\u0435\u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u044B\u0435 \u0440\u0430\u0441\u0447\u0435\u0442\u044B", value: `${transientMonteCarloResult.summary.unstableSamplesCount} / ${transientMonteCarloResult.summary.samplesCount}`, hint: `Валидные сценарии: ${transientMonteCarloResult.summary.validSamplesCount}` }), _jsx(KpiCard, { label: "P05 min \u03C4\u0432", value: formatSafeTemperature(transientMonteCarloResult.summary.p05MinTemperature), tone: Number.isFinite(transientMonteCarloResult.summary.p05MinTemperature) ? "neutral" : "warning" }), _jsx(KpiCard, { label: "P50 min \u03C4\u0432", value: formatSafeTemperature(transientMonteCarloResult.summary.p50MinTemperature), tone: Number.isFinite(transientMonteCarloResult.summary.p50MinTemperature) ? "neutral" : "warning" }), _jsx(KpiCard, { label: "P95 min \u03C4\u0432", value: formatSafeTemperature(transientMonteCarloResult.summary.p95MinTemperature), tone: Number.isFinite(transientMonteCarloResult.summary.p95MinTemperature) ? "neutral" : "warning" })] }), _jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] p-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "text-sm text-[color:var(--text-muted)]", children: [_jsxs("div", { children: ["\u0425\u0443\u0434\u0448\u0438\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439: ", formatSafeTemperature(transientMonteCarloResult.summary.worstCaseSample?.minInnerSurfaceTemperature_C ?? NaN)] }), _jsxs("div", { children: ["\u0421\u0435\u0439\u0447\u0430\u0441 \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u0442\u0441\u044F: ", _jsx("span", { className: "font-semibold text-[color:var(--text-base)]", children: displayedTransientScenarioLabel })] }), _jsxs("div", { children: ["\u041D\u0430\u0438\u0431\u043E\u043B\u0435\u0435 \u0432\u043B\u0438\u044F\u044E\u0449\u0438\u0439 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440: ", formatSensitivityLabel(dominantTransientSensitivity?.parameterId), dominantTransientSensitivity
                                                                    ? ` (${formatSafeSignedNumber(dominantTransientSensitivity.correlationApprox, 2)})`
                                                                    : ""] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { type: "button", onClick: () => handleVisualizeTransientMonteCarloSample("worst"), disabled: !transientMonteCarloResult.summary.worstCaseSample?.valid, title: transientMonteCarloResult.summary.worstCaseSample?.valid ? "Открыть вкладку 3D, включить визуализацию и показать худший вероятностный сценарий на модели и в карточках." : "Худший вероятностный сценарий недоступен.", className: `rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${transientDisplayedSampleMode === "worst"
                                                                ? "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]"
                                                                : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)] hover:bg-[color:var(--danger-bg)]"}`, children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0445\u0443\u0434\u0448\u0438\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043D\u0430 \u043C\u043E\u0434\u0435\u043B\u0438" }), _jsx("button", { type: "button", onClick: () => handleVisualizeTransientMonteCarloSample("median"), disabled: !transientMonteCarloResult.summary.medianSample?.valid, title: transientMonteCarloResult.summary.medianSample?.valid ? "Открыть вкладку 3D, включить визуализацию и показать медианный вероятностный сценарий на модели и в карточках." : "Медианный вероятностный сценарий недоступен.", className: `rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${transientDisplayedSampleMode === "median"
                                                                ? "border-[color:var(--accent-base)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                                                                : "border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"}`, children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043C\u0435\u0434\u0438\u0430\u043D\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043D\u0430 \u043C\u043E\u0434\u0435\u043B\u0438" }), _jsx("button", { type: "button", onClick: () => handleVisualizeTransientMonteCarloSample("best"), disabled: !transientMonteCarloResult.summary.bestCaseSample?.valid, title: transientMonteCarloResult.summary.bestCaseSample?.valid ? "Открыть вкладку 3D, включить визуализацию и показать лучший вероятностный сценарий на модели и в карточках." : "Лучший вероятностный сценарий недоступен.", className: `rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${transientDisplayedSampleMode === "best"
                                                                ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
                                                                : "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)] hover:brightness-95"}`, children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043B\u0443\u0447\u0448\u0438\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043D\u0430 \u043C\u043E\u0434\u0435\u043B\u0438" })] })] }), transientMonteCarloHistogram.length ? (_jsxs("div", { className: "mt-3 space-y-2", children: [_jsxs("details", { className: "rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: [_jsx("summary", { className: "cursor-pointer font-semibold text-[color:var(--text-muted)]", children: "\u0417\u0430\u0447\u0435\u043C \u0433\u0438\u0441\u0442\u043E\u0433\u0440\u0430\u043C\u043C\u0430" }), _jsx("p", { className: "mt-2 leading-relaxed", children: "\u0427\u0438\u0441\u043B\u0430 P05 / P50 / P95 \u0443\u0436\u0435 \u043E\u0442\u0440\u0430\u0436\u0430\u044E\u0442 \u0445\u0432\u043E\u0441\u0442 \u0438 \u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0443 \u0432\u044B\u0431\u043E\u0440\u043A\u0438. \u0413\u0438\u0441\u0442\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0444\u043E\u0440\u043C\u0443 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0439 \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u0438 \u043F\u043E \u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u044B\u043C \u043F\u0440\u043E\u0433\u043E\u043D\u0430\u043C \u2014 \u0443\u0434\u043E\u0431\u043D\u043E \u0434\u043B\u044F \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u044F \u0432 \u0412\u041A\u0420. \u041D\u0430 \u0441\u0430\u043C \u0440\u0430\u0441\u0447\u0451\u0442 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438 \u043E\u043D\u0430 \u043D\u0435 \u0432\u043B\u0438\u044F\u0435\u0442; \u0435\u0441\u043B\u0438 \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043F\u0435\u0440\u0446\u0435\u043D\u0442\u0438\u043B\u0435\u0439, \u0431\u043B\u043E\u043A \u043C\u043E\u0436\u043D\u043E \u0441\u0432\u0435\u0440\u043D\u0443\u0442\u044C. \u041A\u0443\u043C\u0443\u043B\u044F\u0442\u0438\u0432\u043D\u043E\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 (CDF) \u0434\u043B\u044F \u043F\u0438\u043A\u043E\u0432\u043E\u0439 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0437\u0434\u0430\u043D\u0438\u044F \u0432\u044B\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u0432 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438 \u00AB\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u043D\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0440\u0438\u0441\u043A\u0430\u00BB (Monte Carlo \u043F\u043E \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0439 \u043C\u043E\u0434\u0435\u043B\u0438)." })] }), _jsx(ResponsiveContainer, { width: "100%", height: 180, children: _jsxs(BarChart, { data: transientMonteCarloHistogram, margin: { left: 0, right: 12, top: 8, bottom: 28 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "shortLabel", tick: { fontSize: 11, fill: "#475569" }, interval: transientMonteCarloHistogramInterval, minTickGap: 24, angle: -28, textAnchor: "end", height: 62 }), _jsx(YAxis, { tickFormatter: (value) => `${Math.round(Number(value) * 100)}%`, tick: { fontSize: 12, fill: "#475569" } }), _jsx(RechartsTooltip, { formatter: (value) => formatSafePercent(Number(value)), labelFormatter: (_label, payload) => payload?.[0]?.payload?.fullLabel ?? "Диапазон" }), _jsx(Bar, { dataKey: "probability", name: "\u0420\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 min \u03C4\u0432", fill: "#2563eb", radius: [6, 6, 0, 0] })] }) })] })) : (_jsx("div", { className: "mt-3 rounded-xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-4 text-xs text-[color:var(--text-soft)]", children: "\u0420\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u043E: \u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u044B\u0445 \u0438 \u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u044B\u0445 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0434\u043B\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0438 P05/P50/P95." }))] })] })) : null, transientResult ? (_jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: [_jsx(KpiCard, { label: "\u041C\u0438\u043D. t \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0439 \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u0438", value: formatSafeTemperature(transientResult.minInnerSurfaceTemperature), tone: transientResultUsable ? "neutral" : "warning" }), _jsx(KpiCard, { label: "\u041C\u0430\u043A\u0441. t \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0439 \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u0438", value: formatSafeTemperature(transientResult.maxInnerSurfaceTemperature), tone: transientResultUsable ? "neutral" : "warning" }), _jsx(KpiCard, { label: "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0432\u0440\u0435\u043C\u044F, \u0447", value: transientFrame ? formatSafeNumber(transientFrame.time_s / 3600, 2) : "н/д" }), _jsx(KpiCard, { label: "\u0423\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u043E\u0441\u0442\u044C", value: transientSurfaceStabilityLabel, tone: transientResult.stable ? "good" : "warning" }), _jsx(KpiCard, { label: "\u03C4\u0432, \u00B0C", value: transientInnerSurfaceValue }), _jsx(KpiCard, { label: "\u03C4\u043D, \u00B0C", value: transientOuterSurfaceValue })] })) : null] }), _jsxs("div", { className: "min-w-0 space-y-4", children: [_jsx(ChartCard, { title: "\u041D\u0435\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u0438", subtitle: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u044C \u0438 \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0435 \u0432\u043E\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438.", children: transientSurfaceSeries.length ? (_jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(LineChart, { data: transientSurfaceSeries, margin: { left: 0, right: 12, top: 8, bottom: 4 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "time", tickFormatter: formatTimeLabel, tick: { fontSize: 12, fill: "#475569" } }), _jsx(YAxis, { unit: "\u00B0C", tick: { fontSize: 12, fill: "#475569" }, domain: TRANSIENT_CHART_TEMPERATURE_DOMAIN }), _jsx(RechartsTooltip, { content: _jsx(TemperatureTooltip, {}) }), _jsx(Legend, {}), _jsx(ReferenceLine, { y: transientIndoorTemperatureC, stroke: "#f59e0b", strokeDasharray: "4 4" }), _jsx(Line, { type: "monotone", dataKey: "innerSurface", name: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u044C", stroke: "#dc2626", strokeWidth: 2.4, dot: false }), _jsx(Line, { type: "monotone", dataKey: "outerSurface", name: "\u041D\u0430\u0440\u0443\u0436\u043D\u0430\u044F \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u044C", stroke: "#0f766e", strokeWidth: 2, dot: false })] }) })) : (_jsx(ChartPlaceholder, { message: buildTransientEmptyStateMessage(transientResult) })) }), _jsx(ChartCard, { title: "\u041D\u0430\u0440\u0443\u0436\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430", subtitle: "\u0413\u0440\u0430\u043D\u0438\u0447\u043D\u043E\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u044B \u0432\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438.", children: transientSurfaceSeries.length ? (_jsx(ResponsiveContainer, { width: "100%", height: 200, children: _jsxs(LineChart, { data: transientSurfaceSeries, margin: { left: 0, right: 12, top: 8, bottom: 4 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "time", tickFormatter: formatTimeLabel, tick: { fontSize: 12, fill: "#475569" } }), _jsx(YAxis, { unit: "\u00B0C", tick: { fontSize: 12, fill: "#475569" }, domain: TRANSIENT_CHART_TEMPERATURE_DOMAIN }), _jsx(RechartsTooltip, { content: _jsx(TemperatureTooltip, {}) }), _jsx(Line, { type: "monotone", dataKey: "outdoor", name: "\u041D\u0430\u0440\u0443\u0436\u043D\u044B\u0439 \u0432\u043E\u0437\u0434\u0443\u0445", stroke: "#2563eb", strokeWidth: 2.2, dot: false })] }) })) : (_jsx(ChartPlaceholder, { message: buildTransientEmptyStateMessage(transientResult) })) }), _jsx(ChartCard, { title: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u043F\u043E \u0442\u043E\u043B\u0449\u0438\u043D\u0435", subtitle: transientFrame ? `Срез на ${formatNumber(transientFrame.time_s / 3600, { maximumFractionDigits: 2 })} ч.` : "Температурное поле по узлам конструкции.", contentClassName: "min-h-[320px]", children: transientResult && transientFrame && transientResultUsable ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "block text-xs font-semibold text-[color:var(--text-muted)]", children: ["\u0412\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u0438\u043D\u0434\u0435\u043A\u0441: ", transientSelectedTimeIndex + 1, " / ", transientResult.time.length, _jsx("input", { type: "range", min: 0, max: Math.max(0, transientResult.time.length - 1), step: 1, value: Math.min(transientSelectedTimeIndex, Math.max(0, transientResult.time.length - 1)), onChange: (event) => setTransientSelectedTimeIndex(Number(event.target.value)), className: "mt-2 w-full" })] }), _jsx(ResponsiveContainer, { width: "100%", height: 220, children: _jsxs(LineChart, { data: transientProfileSeries, margin: { left: 0, right: 12, top: 8, bottom: 4 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "x_m", unit: " \u043C", tick: { fontSize: 12, fill: "#475569" } }), _jsx(YAxis, { unit: "\u00B0C", tick: { fontSize: 12, fill: "#475569" }, domain: TRANSIENT_CHART_TEMPERATURE_DOMAIN }), _jsx(RechartsTooltip, { content: _jsx(ProfileTooltip, {}) }), _jsx(Line, { type: "monotone", dataKey: "temperature_C", name: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430", stroke: "#7c3aed", strokeWidth: 2.4, dot: false })] }) }), _jsx("p", { className: "text-sm text-[color:var(--text-muted)]", children: buildTransientConclusion(transientResult, transientFrame) })] })) : (_jsx(ChartPlaceholder, { message: buildTransientEmptyStateMessage(transientResult) })) }), activeView !== "brief" ? (_jsxs(_Fragment, { children: [_jsx(ChartCard, { title: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438", subtitle: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442, \u043A\u0430\u043A \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u0445 \u043F\u043E \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044E \u0441 \u0443\u043B\u0438\u0446\u0435\u0439", children: hasUsableRoomTemperatureSeries ? (_jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(LineChart, { data: temperatureSeries, margin: { left: 0, right: 12, top: 8, bottom: 4 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "time", tickFormatter: formatTimeLabel, tick: { fontSize: 12, fill: "#475569" } }), _jsx(YAxis, { unit: "\u00B0C", tick: { fontSize: 12, fill: "#475569" }, domain: INDOOR_CHART_TEMPERATURE_DOMAIN }), _jsx(RechartsTooltip, { content: _jsx(TemperatureTooltip, {}) }), _jsx(Legend, { formatter: legendFormatter }), _jsx(ReferenceLine, { y: options.setpoints.day, stroke: "#f59e0b", strokeDasharray: "4 4" }), _jsx(Line, { type: "monotone", dataKey: "outdoor", stroke: "#94a3b8", strokeDasharray: "6 6", strokeWidth: 2, dot: false, name: "\u0423\u043B\u0438\u0446\u0430" }), highlightedRooms.map((room, index) => (_jsx(Line, { type: "monotone", dataKey: room.id, stroke: ROOM_LINE_COLORS[index % ROOM_LINE_COLORS.length], strokeWidth: 2, dot: false, name: roomLabels[room.id] || `Помещение ${index + 1}` }, room.id)))] }) })) : (_jsx(ChartPlaceholder, { message: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0433\u0440\u0430\u0444\u0438\u043A \u043D\u0435 \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D: \u0440\u0430\u0441\u0447\u0435\u0442 \u043D\u0435 \u0434\u0430\u043B \u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u044B\u0445 \u043A\u043E\u043C\u043D\u0430\u0442\u043D\u044B\u0445 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440." })) }), _jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C" }), _jsxs("p", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u042D\u043D\u0435\u0440\u0433\u0438\u044F \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 ", formatThermalSimulationPeriodRu(options.duration), "; \u00AB\u0447\u0430\u0441\u044B \u0434\u0438\u0441\u043A\u043E\u043C\u0444\u043E\u0440\u0442\u0430\u00BB \u043F\u043E \u0437\u043E\u043D\u0435 \u2014 \u0432\u0440\u0435\u043C\u044F \u043D\u0438\u0436\u0435 \u0443\u0441\u0442\u0430\u0432\u043A\u0438 \u0431\u043E\u043B\u0435\u0435 \u0447\u0435\u043C \u043D\u0430 0,05 \u00B0C (\u043D\u0435 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0435 \u00AB\u0447\u0430\u0441\u044B \u0437\u0434\u0430\u043D\u0438\u044F\u00BB)."] }), roomSummaries.length ? (_jsx("div", { className: "mt-3 overflow-x-auto", children: _jsxs("table", { className: "w-full table-auto text-left text-sm text-[color:var(--text-muted)]", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: [_jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F, \u043A\u0412\u0442\u00B7\u0447" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u0427\u0430\u0441\u044B \u0434\u0438\u0441\u043A\u043E\u043C\u0444\u043E\u0440\u0442\u0430" })] }) }), _jsx("tbody", { children: roomSummaries.map((room) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "max-w-[220px] break-words py-2 pr-2 font-medium text-[color:var(--text-base)]", children: getRoomDisplayName(model, room.roomId) }), _jsx("td", { className: "py-2 pr-2", children: formatEnergy(room.dailyEnergyKWh, "кВт·ч") }), _jsx("td", { className: "py-2 pr-2", children: formatNumber(room.discomfortHours, { maximumFractionDigits: 1 }) })] }, room.roomId))) })] }) })) : (_jsx("p", { className: "mt-3 text-sm text-[color:var(--text-soft)]", children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439." }))] })] })) : null, _jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsx("div", { className: "flex flex-wrap items-center justify-end gap-3", children: _jsx("div", { className: "inline-flex flex-wrap gap-2", children: PANEL_VIEWS.map((view) => (_jsx("button", { type: "button", onClick: () => setActiveView(view.id), className: `rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeView === view.id ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)]"}`, children: view.label }, view.id))) }) }), engineeringResult ? (_jsxs("div", { className: "mt-4 space-y-4", children: [presentation ? (_jsxs(_Fragment, { children: [_jsx(MetricInsightGrid, { metrics: presentation.metrics }), _jsx(StatusStrip, { statuses: presentation.statuses })] })) : null, activeView === "brief" && (_jsx(_Fragment, { children: _jsxs("div", { className: "grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]", children: [_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u041F\u043E\u043B\u0435 \u0441\u0442\u0440\u043E\u0438\u0442\u0441\u044F \u0438\u0437 \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440 \u0438 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u043F\u043E\u043F\u0440\u0430\u0432\u043E\u043A (\u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F, \u043F\u0440\u0438\u0442\u043E\u043A\u0438) \u2014 \u043D\u0430\u0433\u043B\u044F\u0434\u043D\u0430\u044F \u0438\u043D\u0442\u0435\u0440\u043F\u043E\u043B\u044F\u0446\u0438\u044F, \u043D\u0435 CFD \u0438 \u043D\u0435 \u043F\u043E\u043B\u0435\u0432\u0430\u044F CFD\u2011\u043C\u043E\u0434\u0435\u043B\u044C." })] }), _jsxs("div", { className: "text-right text-xs text-[color:var(--text-soft)]", children: [_jsxs("div", { children: ["min ", formatNumber(fieldView?.minTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] }), _jsxs("div", { children: ["max ", formatNumber(fieldView?.maxTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] })] })] }), _jsx("div", { className: "mt-3", children: _jsx(HeatmapPanel, { field: fieldView, hover: heatmapHover, onHover: setHeatmapHover, roomLabels: roomLabels }) })] }), _jsxs("div", { className: "min-w-0 space-y-4", children: [_jsx(TopLossesPanel, { data: heatLossSeries }), _jsx(RecommendationPanel, { recommendations: presentation?.recommendations ?? [] })] })] }) })), activeView === "detailed" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]", children: [_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0422\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442, \u0433\u0434\u0435 \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438 \u0445\u043E\u043B\u043E\u0434\u043D\u0435\u0435, \u0442\u0435\u043F\u043B\u0435\u0435 \u0438 \u0433\u0434\u0435 \u043D\u0430\u0445\u043E\u0434\u044F\u0442\u0441\u044F \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u043D\u044B\u0435 \u0437\u043E\u043D\u044B" })] }), _jsxs("div", { className: "text-right text-xs text-[color:var(--text-soft)]", children: [_jsxs("div", { children: ["min ", formatNumber(fieldView?.minTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] }), _jsxs("div", { children: ["max ", formatNumber(fieldView?.maxTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] })] })] }), _jsx("div", { className: "mt-3", children: _jsx(HeatmapPanel, { field: fieldView, hover: heatmapHover, onHover: setHeatmapHover, roomLabels: roomLabels }) })] }), _jsxs("div", { className: "min-w-0 space-y-4", children: [_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0427\u0442\u043E \u044D\u0442\u043E \u0437\u043D\u0430\u0447\u0438\u0442?" }), _jsx("p", { className: "mt-2 text-sm text-[color:var(--text-muted)]", children: engineeringResult.comfort.explanation }), _jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: [_jsx(MetricTile, { label: "\u0420\u0430\u0431\u043E\u0447\u0430\u044F \u0437\u043E\u043D\u0430", value: formatNumber(engineeringResult.comfort.occupiedMeanTemperatureC, { maximumFractionDigits: 1 }), unit: "\u00B0C", compact: true }), _jsx(MetricTile, { label: "\u041F\u0435\u0440\u0435\u043F\u0430\u0434 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B", value: formatNumber(engineeringResult.comfort.occupiedBandSpreadC, { maximumFractionDigits: 1 }), unit: "\u00B0C", compact: true }), _jsx(MetricTile, { label: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0446\u0435\u043B\u0438", value: formatNumber(engineeringResult.comfort.targetTemperatureC, { maximumFractionDigits: 1 }), unit: "\u00B0C", compact: true }), _jsx(MetricTile, { label: "\u041A\u043E\u043C\u0444\u043E\u0440\u0442\u043D\u043E\u0441\u0442\u044C", value: presentation?.statuses.comfort.status ?? formatComfortRating(engineeringResult.comfort.rating), unit: "", compact: true })] })] }), _jsx(RecommendationPanel, { recommendations: presentation?.recommendations ?? [] })] })] }), _jsxs("div", { className: "grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]", children: [_jsx(ChartCard, { title: "\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438", subtitle: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442, \u0447\u0435\u0440\u0435\u0437 \u043A\u0430\u043A\u0438\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u0443\u0445\u043E\u0434\u0438\u0442 \u043E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u0447\u0430\u0441\u0442\u044C \u0442\u0435\u043F\u043B\u0430", children: heatLossSeries.length ? (_jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(BarChart, { data: heatLossSeries, margin: { left: 0, right: 12, top: 8, bottom: 16 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11, fill: "#475569" }, interval: 0, angle: -18, textAnchor: "end", height: 60 }), _jsx(YAxis, { tick: { fontSize: 12, fill: "#475569" } }), _jsx(RechartsTooltip, { content: _jsx(BarTooltip, { unit: "\u0412\u0442" }) }), _jsx(Bar, { dataKey: "value", radius: [8, 8, 0, 0], children: heatLossSeries.map((entry, index) => (_jsx(Cell, { fill: ROOM_LINE_COLORS[index % ROOM_LINE_COLORS.length] }, `${entry.name}-${index}`))) })] }) })) : (_jsx(ChartPlaceholder, {})) }), _jsx(ChartCard, { title: "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u0442\u0435\u043F\u043B\u0430", subtitle: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442, \u043A\u0430\u043A\u0438\u0435 \u043F\u0440\u0438\u0442\u043E\u043A\u0438 \u0443\u0447\u0430\u0441\u0442\u0432\u0443\u044E\u0442 \u0432 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u043C \u0431\u0430\u043B\u0430\u043D\u0441\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F", children: gainSeries.length ? (_jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(BarChart, { data: gainSeries, margin: { left: 0, right: 12, top: 8, bottom: 16 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11, fill: "#475569" }, interval: 0, angle: -18, textAnchor: "end", height: 60 }), _jsx(YAxis, { tick: { fontSize: 12, fill: "#475569" } }), _jsx(RechartsTooltip, { content: _jsx(BarTooltip, { unit: "\u0412\u0442" }) }), _jsx(Bar, { dataKey: "value", fill: "#0f766e", radius: [8, 8, 0, 0] })] }) })) : (_jsx(ChartPlaceholder, {})) })] }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[1fr,1fr]", children: [_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0437\u043E\u043D\u044B" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0437\u043E\u043D\u044B \u043E\u0445\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u044F, \u043F\u0435\u0440\u0435\u0433\u0440\u0435\u0432\u0430 \u0438 \u0440\u0430\u0431\u043E\u0447\u0443\u044E \u0437\u043E\u043D\u0443 \u0441 \u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435\u043C \u043F\u0440\u0438\u0447\u0438\u043D" }), _jsx(ZoneInsightPanel, { insights: zoneInsights })] }), _jsx(ChartCard, { title: "\u041F\u0440\u043E\u0433\u043D\u043E\u0437 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B", subtitle: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442, \u043A\u0430\u043A \u0431\u0443\u0434\u0435\u0442 \u043C\u0435\u043D\u044F\u0442\u044C\u0441\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u043F\u0440\u0438 \u0442\u0435\u043A\u0443\u0449\u0438\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445 \u0438 \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u0438 \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F", children: hasUsableScenarioTemperatureSeries ? (_jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(LineChart, { data: scenarioTemperatureSeries, margin: { left: 0, right: 12, top: 8, bottom: 4 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "time", tick: { fontSize: 12, fill: "#475569" } }), _jsx(YAxis, { unit: "\u00B0C", tick: { fontSize: 12, fill: "#475569" }, domain: INDOOR_CHART_TEMPERATURE_DOMAIN }), _jsx(RechartsTooltip, { content: _jsx(TemperatureTooltip, {}) }), _jsx(Legend, { wrapperStyle: { fontSize: 11, maxHeight: 48, overflow: "hidden" } }), engineeringResult.scenarios.slice(0, 4).map((scenario, index) => (_jsx(Line, { type: "monotone", dataKey: shortenScenarioLabel(scenario.label), stroke: ROOM_LINE_COLORS[index % ROOM_LINE_COLORS.length], strokeWidth: 2, dot: false, name: shortenScenarioLabel(scenario.label) }, scenario.id))), _jsx(Line, { type: "monotone", dataKey: "outdoor", stroke: "#94a3b8", strokeDasharray: "6 6", strokeWidth: 2, dot: false, name: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0433\u043E \u0432\u043E\u0437\u0434\u0443\u0445\u0430" })] }) })) : (_jsx(ChartPlaceholder, { message: "\u041F\u0440\u043E\u0433\u043D\u043E\u0437 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D: \u0432 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F\u0445 \u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u044B\u0445 \u043A\u043E\u043C\u043D\u0430\u0442\u043D\u044B\u0445 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440 \u0432 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438 \u0440\u0430\u0437\u0443\u043C\u043D\u043E\u043C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0435." })) })] }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[1fr,1fr]", children: [_jsx(ChartCard, { title: "\u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432", subtitle: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442, \u043A\u0430\u043A \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u0441\u044F \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u043E\u0441\u043B\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438 \u0438\u043B\u0438 \u0440\u0435\u0436\u0438\u043C\u0430 \u0440\u0430\u0431\u043E\u0442\u044B", children: hasUsableScenarioSummary ? (_jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(BarChart, { data: scenarioSummarySeries, margin: { left: 0, right: 12, top: 8, bottom: 16 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11, fill: "#475569" }, interval: 0, angle: -25, textAnchor: "end", height: 64 }), _jsx(YAxis, { yAxisId: "left", tick: { fontSize: 12, fill: "#475569" } }), _jsx(YAxis, { yAxisId: "right", orientation: "right", tick: { fontSize: 12, fill: "#475569" } }), _jsx(RechartsTooltip, { content: _jsx(ScenarioSummaryTooltip, {}) }), _jsx(Legend, { wrapperStyle: { fontSize: 11, maxHeight: 48, overflow: "hidden" } }), _jsx(Bar, { yAxisId: "left", dataKey: "peak", name: "\u041F\u0438\u043A\u043E\u0432\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C, \u043A\u0412\u0442", fill: "#2563eb", radius: [8, 8, 0, 0], minPointSize: 6 }), _jsx(Bar, { yAxisId: "right", dataKey: "energy", name: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F, \u043A\u0412\u0442\u00B7\u0447", fill: "#ea580c", radius: [8, 8, 0, 0], minPointSize: 6 })] }) })) : (_jsx(ChartPlaceholder, { message: "\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0438 \u0435\u0449\u0435 \u043D\u0435 \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u044B \u0438\u043B\u0438 \u0438\u0442\u043E\u0433\u043E\u0432\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u043D\u044B. \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0435\u0442 \u0438\u043B\u0438 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439." })) }), _jsx(ChartCard, { title: "\u0427\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430", subtitle: "\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043F\u043E \u0444\u043E\u0440\u043C\u0443\u043B\u0435 S_x = (\u0394Y / Y) / (\u0394X / X), \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u043D\u0430\u044F \u043A\u043E\u043D\u0435\u0447\u043D\u044B\u043C \u0432\u043E\u0437\u043C\u0443\u0449\u0435\u043D\u0438\u0435\u043C \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0430 \u0441 \u043F\u043E\u043B\u043D\u044B\u043C \u043F\u0435\u0440\u0435\u0441\u0447\u0435\u0442\u043E\u043C \u043C\u043E\u0434\u0435\u043B\u0438", children: hasUsableSensitivity ? (_jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(BarChart, { data: sensitivitySeries, layout: "vertical", margin: { left: 24, right: 12, top: 8, bottom: 4 }, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { type: "number", tick: { fontSize: 12, fill: "#475569" }, unit: "%", domain: [-MAX_SENSITIVITY_PERCENT, MAX_SENSITIVITY_PERCENT] }), _jsx(YAxis, { type: "category", dataKey: "name", tick: { fontSize: 11, fill: "#475569" }, width: 130 }), _jsx(ReferenceLine, { x: 0, stroke: "#94a3b8" }), _jsx(RechartsTooltip, { content: _jsx(BarTooltip, { unit: "%" }) }), _jsx(Bar, { dataKey: "value", radius: [0, 8, 8, 0], children: sensitivitySeries.map((entry, index) => (_jsx(Cell, { fill: entry.value >= 0 ? "#b45309" : "#2563eb" }, `${entry.name}-${index}`))) })] }) })) : (_jsx(ChartPlaceholder, { message: "\u0427\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0430: \u0432\u043B\u0438\u044F\u043D\u0438\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 \u0431\u043B\u0438\u0437\u043A\u043E \u043A \u043D\u0443\u043B\u044E \u0438\u043B\u0438 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432 \u0434\u043B\u044F \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F." })) })] })] })), activeView === "engineering" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 xl:grid-cols-[0.9fr,1.1fr]", children: [_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0411\u0430\u043B\u0430\u043D\u0441 \u0442\u0435\u043F\u043B\u0430" }), _jsxs("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsx(BalanceRow, { label: "\u0421\u0443\u043C\u043C\u0430\u0440\u043D\u044B\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438", value: engineeringResult.balance.totalLossW, unit: "\u0412\u0442" }), _jsx(BalanceRow, { label: "\u041F\u0430\u0441\u0441\u0438\u0432\u043D\u044B\u0435 \u043F\u0440\u0438\u0442\u043E\u043A\u0438", value: engineeringResult.balance.passiveGainsW, unit: "\u0412\u0442" }), _jsx(BalanceRow, { label: "\u0422\u0440\u0435\u0431\u0443\u0435\u043C\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F", value: engineeringResult.balance.requiredHeatingW, unit: "\u0412\u0442", emphasize: true }), _jsx(BalanceRow, { label: "UA \u0437\u0434\u0430\u043D\u0438\u044F", value: engineeringResult.balance.totalUA_W_K, unit: "\u0412\u0442/\u041A" }), _jsx(BalanceRow, { label: "\u042D\u043A\u0432\u0438\u0432\u0430\u043B\u0435\u043D\u0442\u043D\u0430\u044F \u0442\u0435\u043F\u043B\u043E\u0435\u043C\u043A\u043E\u0441\u0442\u044C", value: engineeringResult.balance.effectiveCapacitance_J_K, unit: "\u0414\u0436/\u041A" }), _jsx(BalanceRow, { label: "\u041F\u043E\u043B", value: engineeringResult.balance.floorLossW, unit: "\u0412\u0442" }), _jsx(BalanceRow, { label: "\u041F\u043E\u043A\u0440\u044B\u0442\u0438\u0435", value: engineeringResult.balance.roofLossW, unit: "\u0412\u0442" }), _jsx(BalanceRow, { label: "\u041E\u043A\u043D\u0430", value: engineeringResult.balance.windowLossW, unit: "\u0412\u0442" }), _jsx(BalanceRow, { label: "\u0421\u0442\u0435\u043D\u044B", value: engineeringResult.balance.wallLossW, unit: "\u0412\u0442" }), _jsx(BalanceRow, { label: "\u0418\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044F", value: engineeringResult.balance.infiltrationLossW, unit: "\u0412\u0442" }), _jsx(BalanceRow, { label: "\u0412\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u044F", value: engineeringResult.balance.ventilationLossW, unit: "\u0412\u0442" })] }), engineeringResult.balance.passiveGainsW > engineeringResult.balance.totalLossW ? (_jsx("div", { className: "mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)]", children: "\u041F\u0430\u0441\u0441\u0438\u0432\u043D\u044B\u0435 \u043F\u0440\u0438\u0442\u043E\u043A\u0438 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u044E\u0442 \u0440\u0430\u0441\u0447\u0435\u0442\u043D\u044B\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0442\u0440\u0435\u0431\u0443\u0435\u043C\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F \u043F\u043E \u0442\u0435\u043A\u0443\u0449\u0435\u043C\u0443 \u0431\u0430\u043B\u0430\u043D\u0441\u0443 \u0440\u0430\u0432\u043D\u0430 0 \u0412\u0442. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F \u0438 \u0440\u0435\u0436\u0438\u043C \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438." })) : null] }), _jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0420\u0430\u0441\u0447\u0435\u0442 \u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u0439" }), _jsx("div", { className: "mt-3 overflow-x-auto", children: _jsxs("table", { className: "min-w-[520px] w-full table-fixed text-left text-sm text-[color:var(--text-muted)]", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: [_jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u042D\u043B\u0435\u043C\u0435\u043D\u0442" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "A, \u043C\u00B2" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "U, \u0412\u0442/(\u043C\u00B2\u00B7\u041A)" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "Q, \u0412\u0442" })] }) }), _jsx("tbody", { children: engineeringResult.envelope.slice(0, 16).map((entry) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)] align-top", children: [_jsxs("td", { className: "py-2 pr-2", children: [_jsx("div", { className: "font-medium text-[color:var(--text-base)]", children: entry.label }), _jsx("div", { className: "text-xs text-[color:var(--text-soft)]", children: entry.formulaBreakdown.substitution })] }), _jsx("td", { className: "py-2 pr-2", children: formatArea(entry.areaM2) }), _jsx("td", { className: "py-2 pr-2", children: formatNumber(entry.uValue_W_m2K, { maximumFractionDigits: 2 }) }), _jsx("td", { className: "py-2 pr-2", children: formatNumber(entry.heatFluxW, { maximumFractionDigits: 0 }) })] }, entry.id))) })] }) })] })] }), engineeringResult.sp50 ? (_jsxs("div", { className: "space-y-4", children: [_jsx(ExpertiseReportExport, { projectKey: projectKey, model: model, sp50Report: engineeringResult.sp50, engineeringResult: engineeringResult, thermalResult: result, transientResult: transientResult, transientWarnings: transientWarnings, calculationTimestampIso: lastCalculatedAtIso, scenarioLabel: options.duration === "7d" ? "7 суток" : "24 ч", climateBaseLabel: model.thermalProtection?.climate?.city
                                                                ? `СП 131.13330.2025, ${model.thermalProtection.climate.city}`
                                                                : null }), _jsx(Sp50Panel, { report: engineeringResult.sp50 }), _jsx(EconomicAssessmentPanelV2, { report: engineeringResult.sp50 })] })) : null, demoSp50Result && !engineeringResult.sp50 ? (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: _jsx("div", { className: "flex flex-wrap items-start justify-between gap-3", children: _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u043E \u0421\u041F 50.13330.2024" }), _jsx("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: demoSp50Result.engineeringConclusion })] }) }) }), _jsx(ExpertiseReportExport, { projectKey: projectKey, model: model, sp50Report: demoSp50Result.report, thermalResult: result, calculationTimestampIso: lastCalculatedAtIso, scenarioLabel: "\u0414\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0421\u041F 50", climateBaseLabel: "\u0421\u041F 131.13330.2025 (\u0434\u0435\u043C\u043E)" }), _jsx(Sp50Panel, { report: demoSp50Result.report }), _jsx(EconomicAssessmentPanelV2, { report: demoSp50Result.report, initialScenario: demoVKRScenario.economicScenario })] })) : null] }))] })) : demoSp50Result ? (_jsxs("div", { className: "mt-4 space-y-4", children: [_jsx("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0414\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439" }), _jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u043E \u0421\u041F 50.13330.2024" }), _jsx("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: demoSp50Result.engineeringConclusion })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: _jsx("button", { type: "button", onClick: exportDemoSp50Json, className: "rounded-xl border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]", children: "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 JSON" }) })] }) }), _jsx(ExpertiseReportExport, { projectKey: projectKey, model: model, sp50Report: demoSp50Result.report, thermalResult: result, calculationTimestampIso: lastCalculatedAtIso, scenarioLabel: "\u0414\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0421\u041F 50", climateBaseLabel: "\u0421\u041F 131.13330.2025 (\u0434\u0435\u043C\u043E)" }), _jsx(Sp50Panel, { report: demoSp50Result.report }), _jsx(EconomicAssessmentPanelV2, { report: demoSp50Result.report, initialScenario: demoVKRScenario.economicScenario })] })) : (_jsx(EmptyStateCard, { title: "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0434\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F \u0440\u0430\u0441\u0447\u0435\u0442\u0430", description: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0435\u0442, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0442\u0435\u043F\u043B\u043E\u0432\u0443\u044E \u043A\u0430\u0440\u0442\u0443, \u043F\u043E\u0442\u0435\u0440\u0438 \u0442\u0435\u043F\u043B\u0430, \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0438 \u0438 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0435 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u044F." }))] })] })] })) }));
}
const NumberInput = ({ label, value, step, min, max, description, usedIn, rangeHint, defaultValueLabel, onReset, onChange, }) => (_jsxs("label", { className: "min-w-0 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3 text-xs font-semibold text-[color:var(--text-muted)]", children: [_jsxs("span", { className: "flex min-w-0 flex-wrap items-start justify-between gap-2", children: [_jsx("span", { className: "block min-w-0 flex-1 whitespace-normal break-words leading-snug", children: label }), onReset ? (_jsx("button", { type: "button", onClick: onReset, className: "rounded-full border border-[color:var(--border-soft)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]", children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C" })) : null] }), description ? _jsx("span", { className: "mt-1 block text-[11px] font-normal leading-5 text-[color:var(--text-soft)]", children: description }) : null, usedIn || rangeHint || defaultValueLabel ? (_jsx("span", { className: "mt-1 block text-[10px] font-normal leading-5 text-[color:var(--text-soft)]", children: [
                usedIn ? `Где используется: ${usedIn}` : null,
                rangeHint ? `Диапазон: ${rangeHint}` : null,
                defaultValueLabel ? `По умолчанию: ${defaultValueLabel}` : null,
            ]
                .filter(Boolean)
                .join(" • ") })) : null, _jsx("input", { type: "number", value: value, onChange: (event) => {
                const next = Number(event.target.value);
                if (Number.isNaN(next)) {
                    return;
                }
                if (typeof min === "number" && next < min) {
                    onChange(min);
                    return;
                }
                if (typeof max === "number" && next > max) {
                    onChange(max);
                    return;
                }
                onChange(next);
            }, step: step ?? 0.1, min: min, max: max, className: "mt-2 w-full min-w-0 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]" })] }));
const KpiCard = ({ label, value, tone = "neutral", align = "center", hint, }) => (_jsxs("div", { className: `min-w-0 max-w-full rounded-2xl border px-3 py-3 shadow-sm ${resolveKpiToneClass(tone)} ${align === "left" ? "text-left" : "text-center"}`, children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)] whitespace-normal break-words", children: label }), _jsx("p", { className: "mt-1 text-xl font-semibold text-[color:var(--text-base)] whitespace-normal break-words", children: value }), hint ? _jsx("p", { className: "mt-1 text-xs text-[color:var(--text-soft)] whitespace-normal break-words", children: hint }) : null] }));
const RcBuildingLossChart = ({ rows }) => {
    const data = rows.filter((row) => row.valueW !== null);
    if (!data.length) {
        return _jsx(ChartPlaceholder, { message: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438 \u043F\u043E \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430\u043C \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B." });
    }
    return (_jsxs("figure", { "aria-labelledby": "rc-building-loss-title", "aria-describedby": "rc-building-loss-desc", children: [_jsx("figcaption", { id: "rc-building-loss-title", className: "sr-only", children: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438 \u043F\u043E \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430\u043C" }), _jsx("p", { id: "rc-building-loss-desc", className: "sr-only", children: "\u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438 \u0447\u0435\u0440\u0435\u0437 \u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F, \u043E\u043A\u043D\u0430, \u0434\u0432\u0435\u0440\u0438 \u0438 \u0438\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044E \u0432 \u0432\u0430\u0442\u0442\u0430\u0445." }), _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(BarChart, { data: data, layout: "vertical", margin: { top: 8, right: 20, left: 24, bottom: 4 }, accessibilityLayer: true, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4", horizontal: false }), _jsx(XAxis, { type: "number", tick: { fontSize: 12, fill: "#475569" }, tickFormatter: (value) => formatRcPowerAxis(Number(value)) }), _jsx(YAxis, { dataKey: "label", type: "category", width: 180, tick: { fontSize: 11, fill: "#475569" } }), _jsx(RechartsTooltip, { content: _jsx(RcLossTooltip, {}) }), _jsx(Bar, { dataKey: "valueW", radius: [0, 8, 8, 0], children: data.map((row) => (_jsx(Cell, { fill: row.color }, row.key))) })] }) })] }));
};
const RcZoneLossChart = ({ rows }) => {
    const data = rows.slice(0, 12).map((row) => ({
        ...row,
        lossOpaqueW: row.lossOpaqueW ?? 0,
        lossWindowW: row.lossWindowW ?? 0,
        lossDoorW: row.lossDoorW ?? 0,
        lossInfiltrationW: row.lossInfiltrationW ?? 0,
    }));
    if (!data.length) {
        return _jsx(ChartPlaceholder, { message: "\u041D\u0435\u0442 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439 \u0441 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u043C \u0440\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u0438\u0435\u043C \u043F\u043E\u0442\u0435\u0440\u044C." });
    }
    return (_jsx("div", { className: "space-y-3", children: _jsx(ResponsiveContainer, { width: "100%", height: 360, children: _jsxs(BarChart, { data: data, layout: "vertical", margin: { top: 8, right: 20, left: 24, bottom: 4 }, accessibilityLayer: true, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4", horizontal: false }), _jsx(XAxis, { type: "number", tick: { fontSize: 12, fill: "#475569" }, tickFormatter: (value) => formatRcPowerAxis(Number(value)) }), _jsx(YAxis, { dataKey: "zoneName", type: "category", width: 180, tick: { fontSize: 11, fill: "#475569" } }), _jsx(RechartsTooltip, { content: _jsx(RcZoneLossTooltip, {}) }), _jsx(Legend, {}), _jsx(Bar, { dataKey: "lossOpaqueW", name: "\u041E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F", stackId: "loss", fill: "#0f766e" }), _jsx(Bar, { dataKey: "lossWindowW", name: "\u041E\u043A\u043D\u0430", stackId: "loss", fill: "#2563eb" }), _jsx(Bar, { dataKey: "lossDoorW", name: "\u0414\u0432\u0435\u0440\u0438", stackId: "loss", fill: "#f97316" }), _jsx(Bar, { dataKey: "lossInfiltrationW", name: "\u0418\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044F", stackId: "loss", fill: "#dc2626" })] }) }) }));
};
const RcZoneHeatmapTable = ({ rows }) => {
    if (!rows.length) {
        return _jsx(ChartPlaceholder, { message: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u043C\u0430\u0442\u0440\u0438\u0446\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430: \u043D\u0435\u0442 room-level diagnostics." });
    }
    const limitedRows = rows.slice(0, 18);
    const temperatureDomain = resolveRcDomain(limitedRows.map((row) => row.temperatureC));
    const loadDomain = resolveRcDomain(limitedRows.map((row) => row.heatingPowerW));
    const lossDomain = resolveRcDomain(limitedRows.map((row) => row.lossTotalW));
    return (_jsx("div", { className: "overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]", children: _jsxs("table", { className: "w-full text-left text-sm text-[color:var(--text-muted)]", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-3 font-semibold", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("th", { className: "px-4 py-3 font-semibold", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u00B0C" }), _jsx("th", { className: "px-4 py-3 font-semibold", children: "\u041D\u0430\u0433\u0440\u0443\u0437\u043A\u0430, \u0412\u0442" }), _jsx("th", { className: "px-4 py-3 font-semibold", children: "\u041F\u043E\u0442\u0435\u0440\u0438, \u0412\u0442" }), _jsx("th", { className: "px-4 py-3 font-semibold", children: "\u0421\u0442\u0430\u0442\u0443\u0441" })] }) }), _jsx("tbody", { children: limitedRows.map((row) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)] align-top", children: [_jsx("td", { className: "px-4 py-3 font-semibold text-[color:var(--text-base)]", children: row.zoneName }), _jsx(RcHeatCell, { value: row.temperatureC, domain: temperatureDomain, formatter: formatRcTemperature }), _jsx(RcHeatCell, { value: row.heatingPowerW, domain: loadDomain, formatter: formatRcPower }), _jsx(RcHeatCell, { value: row.lossTotalW, domain: lossDomain, formatter: (value) => formatRcPower(value) }), _jsx("td", { className: "px-4 py-3 text-xs text-[color:var(--text-soft)]", children: row.statusNote ?? "не задано" })] }, row.zoneId))) })] }) }));
};
const RcHeatCell = ({ value, domain, formatter, }) => {
    if (!Number.isFinite(value) || !domain) {
        return _jsx("td", { className: "px-4 py-3 text-[color:var(--text-soft)]", children: "\u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u043E" });
    }
    return (_jsx("td", { className: "px-4 py-3", style: { backgroundColor: buildRcHeatColor(value, domain) }, children: _jsx("span", { className: "font-medium text-slate-900", children: formatter(value) }) }));
};
const RcLossTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
        return null;
    }
    return (_jsxs("div", { className: "ui-overlay max-w-[320px] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: [_jsx("p", { className: "font-semibold text-[color:var(--text-base)]", children: String(payload[0]?.payload?.label ?? "") }), _jsx("p", { className: "mt-2", children: formatRcPower(Number(payload[0]?.value ?? NaN)) }), _jsx("p", { className: "mt-1 text-[color:var(--text-soft)]", children: formatRcPercent(Number(payload[0]?.payload?.sharePercent ?? NaN)) })] }));
};
const RcZoneLossTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
        return null;
    }
    const zone = payload[0]?.payload;
    return (_jsxs("div", { className: "ui-overlay max-w-[320px] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: [_jsx("p", { className: "font-semibold text-[color:var(--text-base)]", children: zone?.zoneName ?? "" }), _jsx("ul", { className: "mt-2 space-y-1", children: payload.map((entry) => (_jsxs("li", { className: "flex items-center justify-between gap-6", children: [_jsx("span", { children: typeof entry.name === "string" ? entry.name : "Потери" }), _jsx("span", { children: formatRcPower(Number(entry.value ?? NaN)) })] }, String(entry.dataKey)))) }), _jsxs("div", { className: "mt-2 border-t border-[color:var(--border-soft)] pt-2 text-[color:var(--text-soft)]", children: [_jsxs("div", { children: ["\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430: ", formatRcTemperature(zone?.temperatureC ?? null)] }), _jsxs("div", { children: ["\u0422\u0440\u0435\u0431\u0443\u0435\u043C\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C: ", formatRcPower(zone?.heatingPowerW ?? null)] }), _jsxs("div", { children: ["\u0421\u0442\u0430\u0442\u0443\u0441: ", zone?.statusNote ?? "не задано"] })] })] }));
};
const MetricTile = ({ label, value, unit, compact = false, }) => (_jsxs("div", { className: `rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-3 shadow-sm ${compact ? "" : "min-h-[92px]"}`, children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: label }), _jsxs("div", { className: "mt-2 flex min-w-0 flex-wrap items-baseline gap-2", children: [_jsx("span", { className: `${compact ? "text-lg" : "text-2xl"} font-semibold text-[color:var(--text-base)]`, children: value }), unit ? _jsx("span", { className: "text-xs text-[color:var(--text-soft)]", children: unit }) : null] })] }));
const MetricInsightGrid = ({ metrics }) => (_jsx("div", { className: "grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5", children: metrics.map((metric) => (_jsx(MetricInsightCard, { metric: metric }, metric.id))) }));
const MetricInsightCard = ({ metric }) => (_jsxs("div", { className: `min-w-0 overflow-hidden rounded-2xl border px-4 py-4 shadow-sm ${toneSurface(metric.tone)}`, children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: metric.label }), _jsxs("div", { className: "mt-2 flex min-w-0 flex-wrap items-baseline gap-2", children: [_jsx("span", { className: "break-words text-2xl font-semibold text-[color:var(--text-base)]", children: metric.value }), metric.unit ? _jsx("span", { className: "text-xs text-[color:var(--text-soft)]", children: metric.unit }) : null] }), _jsx("p", { className: "mt-2 text-sm text-[color:var(--text-muted)]", children: metric.explanation }), metric.target ? _jsx("p", { className: "mt-2 text-xs text-[color:var(--text-soft)]", children: metric.target }) : null] }));
const StatusStrip = ({ statuses }) => (_jsxs("div", { className: "grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5", children: [_jsx(StatusCard, { status: statuses.comfort }), _jsx(StatusCard, { status: statuses.heating }), _jsx(StatusCard, { status: statuses.heatLoss }), _jsx(StatusCard, { status: statuses.uniformity }), _jsx(StatusCard, { status: statuses.reliability })] }));
const StatusCard = ({ status }) => {
    if (!status) {
        return null;
    }
    return (_jsxs("div", { className: `min-w-0 overflow-hidden rounded-2xl border px-4 py-3 shadow-sm ${toneSurface(status.tone)}`, children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: status.label }), _jsx("div", { className: "mt-2 text-lg font-semibold text-[color:var(--text-base)]", children: status.status }), _jsx("p", { className: "mt-2 text-sm text-[color:var(--text-muted)]", children: status.explanation })] }));
};
const RecommendationPanel = ({ recommendations }) => (_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0427\u0442\u043E \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F \u0441\u0434\u0435\u043B\u0430\u0442\u044C" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u0422\u043E\u043B\u044C\u043A\u043E \u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0430\u043F\u0440\u044F\u043C\u0443\u044E \u0441\u0432\u044F\u0437\u0430\u043D\u044B \u0441 \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u043C\u0438 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430\u043C\u0438" }), recommendations.length ? (_jsx("div", { className: "mt-3 space-y-2", children: recommendations.map((item) => (_jsxs("div", { className: `rounded-xl border px-3 py-3 ${toneSurface(item.tone)}`, children: [_jsx("div", { className: "font-semibold text-[color:var(--text-base)]", children: item.title }), _jsx("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: item.explanation })] }, item.id))) })) : (_jsx("p", { className: "mt-3 text-sm text-[color:var(--text-soft)]", children: "\u042F\u0432\u043D\u044B\u0445 \u043F\u0440\u043E\u0431\u043B\u0435\u043C, \u0442\u0440\u0435\u0431\u0443\u044E\u0449\u0438\u0445 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u0438\u0440\u0443\u044E\u0449\u0438\u0445 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439, \u043D\u0435 \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E." }))] }));
const TopLossesPanel = ({ data }) => (_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442, \u0447\u0435\u0440\u0435\u0437 \u043A\u0430\u043A\u0438\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0442\u0435\u0440\u044F\u0435\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u0432\u0441\u0435\u0433\u043E \u0442\u0435\u043F\u043B\u0430" }), data.length ? (_jsx("div", { className: "mt-3 space-y-2", children: data
                .slice()
                .sort((left, right) => right.value - left.value)
                .slice(0, 4)
                .map((entry) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-muted)]", children: [_jsx("span", { children: entry.name }), _jsxs("span", { className: "font-semibold text-[color:var(--text-base)]", children: [formatNumber(entry.value, { maximumFractionDigits: 0 }), " \u0412\u0442"] })] }, entry.name))) })) : (_jsx("p", { className: "mt-3 text-sm text-[color:var(--text-soft)]", children: "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0434\u0430\u043D\u043D\u044B\u0445, \u0447\u0442\u043E\u0431\u044B \u043E\u0446\u0435\u043D\u0438\u0442\u044C \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0443 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u044C." }))] }));
const EmptyStateCard = ({ title, description }) => (_jsxs("div", { className: "mt-4 rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-5", children: [_jsx("div", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: title }), _jsx("p", { className: "mt-2 text-sm text-[color:var(--text-soft)]", children: description })] }));
const toneSurface = (tone) => {
    switch (tone) {
        case "good":
            return "border-[color:var(--success-border)] bg-[color:var(--success-bg)]";
        case "warning":
            return "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]";
        case "critical":
            return "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]";
        default:
            return "border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]";
    }
};
const resolveKpiToneClass = (tone) => {
    switch (tone) {
        case "good":
            return "border-[color:var(--success-border)] bg-[color:var(--success-bg)]";
        case "warning":
            return "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]";
        case "critical":
            return "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]";
        case "info":
            return "border-[color:var(--info-border)] bg-[color:var(--info-bg)]";
        default:
            return "border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]";
    }
};
const BalanceRow = ({ label, value, unit, emphasize = false, maximumFractionDigits = 0, }) => (_jsxs("div", { className: `flex items-start justify-between gap-3 rounded-xl px-3 py-2 ${emphasize ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "bg-[color:var(--surface-muted)]"}`, children: [_jsx("span", { className: "min-w-0 whitespace-normal break-words", children: label }), _jsxs("span", { className: "min-w-0 break-words text-right font-semibold", children: [typeof value === "string" ? value : formatNumber(value, { maximumFractionDigits }), " ", unit] })] }));
const ChartCard = ({ title, subtitle, contentClassName, children, }) => (_jsxs("div", { className: "ui-panel-muted min-w-0 max-w-full p-4 sm:p-5", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)] sm:text-base", children: title }), _jsx("p", { className: "mt-1 text-xs leading-5 text-[color:var(--text-soft)] sm:text-sm", children: subtitle }), _jsx("div", { className: `mt-4 w-full min-w-0 max-w-full overflow-x-auto overflow-y-visible ${contentClassName ?? "min-h-[280px]"}`, children: children })] }));
const ChartPlaceholder = ({ message = "Недостаточно данных для визуализации. Запустите расчёт или уточните входные параметры.", }) => (_jsx("div", { className: "flex h-full items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-sm text-[color:var(--text-soft)]", children: _jsx("span", { className: "max-w-xl whitespace-normal break-words px-4 text-center", children: message }) }));
const TemperatureTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) {
        return null;
    }
    const title = typeof label === "number" ? formatTimeLabel(Number(label)) : String(label ?? "—");
    return (_jsxs("div", { className: "ui-overlay max-w-[280px] px-3 py-2 text-xs text-[color:var(--text-muted)] shadow-lg", children: [_jsx("p", { className: "font-semibold text-[color:var(--text-base)]", children: title }), _jsx("ul", { className: "mt-2 space-y-1", children: payload.map((entry) => (_jsxs("li", { className: "flex items-center justify-between gap-6 rounded-lg bg-[color:var(--surface-muted)] px-2 py-1", children: [_jsxs("span", { className: "flex items-center gap-2", children: [_jsx("span", { className: "h-2 w-2 rounded-full", style: { backgroundColor: entry.color ?? "#0f172a" } }), entry.name] }), _jsx("span", { children: formatSafeTemperature(Number(entry.value)) })] }, entry.dataKey))) })] }));
};
const ProfileTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) {
        return null;
    }
    return (_jsxs("div", { className: "ui-overlay max-w-[280px] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: [_jsxs("p", { className: "font-semibold", children: [formatNumber(Number(label), { maximumFractionDigits: 3 }), " \u043C"] }), _jsx("ul", { className: "mt-2 space-y-1", children: payload.map((entry) => (_jsxs("li", { className: "flex items-center justify-between gap-6", children: [_jsx("span", { children: getChartMetricLabel(entry, "Значение") }), _jsx("span", { children: formatSafeTemperature(Number(entry.value)) })] }, String(entry.dataKey)))) })] }));
};
const CHART_METRIC_LABELS = {
    value: "Значение",
    heatLoss: "Теплопотери",
    loss: "Теплопотери",
    energy: "Энергия",
    payback: "Срок окупаемости",
    cost: "Стоимость",
    saving: "Экономия",
    peak: "Пиковая мощность",
};
const getChartMetricLabel = (entry, fallback) => {
    const rawName = typeof entry.name === "string" ? entry.name.trim() : "";
    if (rawName && rawName.toLowerCase() !== "value") {
        return rawName;
    }
    const dataKey = typeof entry.dataKey === "string" ? entry.dataKey : "";
    return CHART_METRIC_LABELS[dataKey] ?? fallback;
};
const BarTooltip = ({ active, payload, label, unit }) => {
    if (!active || !payload?.length) {
        return null;
    }
    return (_jsxs("div", { className: "ui-overlay max-w-[280px] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: [label ? _jsx("p", { className: "font-semibold", children: String(label) }) : null, _jsx("ul", { className: "mt-2 space-y-1", children: payload.map((entry) => (_jsxs("li", { className: "flex items-center justify-between gap-6", children: [_jsx("span", { children: getChartMetricLabel(entry, "Значение") }), _jsxs("span", { children: [unit === "%" ? formatSafePercent(Number(entry.value) / 100) : formatSafeNumber(Number(entry.value), 2), " ", unit === "%" ? "" : unit] })] }, String(entry.dataKey)))) })] }));
};
const ScenarioSummaryTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) {
        return null;
    }
    return (_jsxs("div", { className: "ui-overlay max-w-[280px] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: [_jsx("p", { className: "font-semibold", children: String(label) }), _jsx("ul", { className: "mt-2 space-y-1", children: payload.map((entry) => (_jsxs("li", { className: "flex items-center justify-between gap-6", children: [_jsx("span", { children: getChartMetricLabel(entry, entry.dataKey === "peak" ? "Пиковая мощность" : "Энергия") }), _jsxs("span", { children: [formatSafeNumber(Number(entry.value), 2), " ", entry.dataKey === "peak" ? "кВт" : "кВт·ч"] })] }, String(entry.dataKey)))) })] }));
};
const HeatmapPanel = ({ field, hover, onHover, roomLabels, }) => {
    if (!field?.cells.length) {
        return _jsx(ChartPlaceholder, {});
    }
    const cellSize = field.kind === "detailed" ? 18 : 24;
    const width = Math.max((field.cols || 1) * cellSize, 320);
    const height = Math.max((field.rows || 1) * cellSize, 180);
    return (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "ui-scroll max-w-full overflow-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2", children: _jsx("svg", { width: width, height: height, className: "block max-w-none", children: field.cells.map((cell) => (_jsx("rect", { x: cell.col * cellSize, y: cell.row * cellSize, width: cellSize, height: cellSize, rx: 3, fill: getHeatmapColor(cell.temperatureC, field.minTemperatureC, field.maxTemperatureC), stroke: "rgba(255,255,255,0.22)", onMouseEnter: () => onHover({
                            x: cell.x,
                            y: cell.y,
                            temperatureC: cell.temperatureC,
                            roomId: cell.roomId,
                            roomLabel: roomLabels[cell.roomId] ?? "Помещение",
                        }), onMouseLeave: () => onHover(null) }, `${cell.row}-${cell.col}-${cell.roomId}`))) }) }), _jsxs("div", { className: "flex items-center justify-between gap-3 text-xs text-[color:var(--text-soft)]", children: [_jsx("div", { className: "flex items-center gap-2", children: HEATMAP_COLORS.map((color) => (_jsx("span", { className: "h-2.5 w-8 rounded-full", style: { backgroundColor: color } }, color))) }), _jsxs("span", { children: [formatNumber(field.minTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C .. ", formatNumber(field.maxTemperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-3", children: [_jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: ["\u0421\u0435\u0442\u043A\u0430", _jsxs("div", { className: "font-semibold text-[color:var(--text-base)]", children: [field.rows, " \u00D7 ", field.cols] })] }), _jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: ["\u0428\u0430\u0433 \u0441\u0435\u0442\u043A\u0438", _jsxs("div", { className: "font-semibold text-[color:var(--text-base)]", children: [formatNumber(field.cellSizeM, { maximumFractionDigits: 2 }), " \u043C"] })] }), _jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: ["\u0418\u0442\u0435\u0440\u0430\u0446\u0438\u0438", _jsx("div", { className: "font-semibold text-[color:var(--text-base)]", children: field.iterations })] })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-3", children: [_jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: ["\u0421\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u044C", _jsx("div", { className: "font-semibold text-[color:var(--text-base)]", children: field.converged ? "достигнута" : "ограничена" })] }), _jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: ["\u041D\u0435\u0432\u044F\u0437\u043A\u0430", _jsxs("div", { className: "font-semibold text-[color:var(--text-base)]", children: [formatNumber(field.residualC, { maximumFractionDigits: 4 }), " \u00B0C"] })] }), _jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: ["\u041A\u0440\u0438\u0442\u0435\u0440\u0438\u0439", _jsxs("div", { className: "font-semibold text-[color:var(--text-base)]", children: ["max |\u0394T| \u2264 ", formatNumber(field.toleranceC, { maximumFractionDigits: 3 }), " \u00B0C"] })] }), _jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: ["\u041C\u0435\u0442\u043E\u0434", _jsx("div", { className: "font-semibold text-[color:var(--text-base)]", children: "\u0418\u0442\u0435\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 Gauss\u2013Seidel" })] })] }), hover ? (_jsxs("div", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: [hover.roomLabel, " \u00B7 (", formatNumber(hover.x, { maximumFractionDigits: 2 }), "; ", formatNumber(hover.y, { maximumFractionDigits: 2 }), ") \u043C:", " ", _jsxs("span", { className: "font-semibold text-[color:var(--text-base)]", children: [formatNumber(hover.temperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] })] })) : null] }));
};
const clampHour = (value) => {
    if (Number.isNaN(value)) {
        return 0;
    }
    if (value < 0) {
        return 0;
    }
    if (value > 23) {
        return 23;
    }
    return Math.round(value);
};
const formatTimeLabel = (timeHours) => {
    if (!Number.isFinite(timeHours)) {
        return "—";
    }
    const totalMinutes = Math.round(timeHours * 60);
    const day = Math.floor(totalMinutes / (24 * 60));
    const remainder = totalMinutes - day * 24 * 60;
    const hours = Math.floor(remainder / 60);
    const minutes = remainder % 60;
    const prefix = day > 0 ? `Д${day} ` : "";
    return `${prefix}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
const formatComfortRating = (rating) => {
    switch (rating) {
        case "comfortable":
            return "Комфортно";
        case "attention":
            return "Требует внимания";
        case "critical":
            return "Критично";
        default:
            return rating;
    }
};
const ZONE_GROUPS = [
    { key: "cold", label: "Холодные зоны" },
    { key: "hot", label: "Перегретые зоны" },
    { key: "occupied", label: "Рабочая зона" },
    { key: "wall", label: "У наружных стен" },
    { key: "window", label: "У окон" },
    { key: "heating", label: "У приборов отопления" },
];
const ZoneInsightPanel = ({ insights }) => {
    if (!insights.length) {
        return _jsx("div", { className: "mt-3 text-sm text-[color:var(--text-soft)]", children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442, \u0447\u0442\u043E\u0431\u044B \u0432\u044B\u0434\u0435\u043B\u0438\u0442\u044C \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E \u0437\u043D\u0430\u0447\u0438\u043C\u044B\u0435 \u0437\u043E\u043D\u044B." });
    }
    return (_jsx("div", { className: "mt-3 space-y-3", children: ZONE_GROUPS.map((group) => {
            const groupItems = insights.filter((entry) => entry.category === group.key);
            if (!groupItems.length) {
                return null;
            }
            return (_jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-3", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: group.label }), _jsx("div", { className: "mt-2 space-y-2", children: groupItems.map((item) => (_jsxs("div", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-3", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-semibold text-[color:var(--text-base)]", children: item.title }), _jsx("div", { className: "text-xs text-[color:var(--text-soft)]", children: item.roomName })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-semibold text-[color:var(--text-base)]", children: [formatNumber(item.temperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] }), _jsxs("div", { className: `text-xs ${item.deltaFromAverageC >= 0 ? "text-[color:var(--warning-fg)]" : "text-[color:var(--info-fg)]"}`, children: [item.deltaFromAverageC >= 0 ? "+" : "", formatNumber(item.deltaFromAverageC, { maximumFractionDigits: 1 }), " \u00B0C"] })] })] }), _jsxs("div", { className: "mt-2 grid gap-1 text-xs text-[color:var(--text-soft)]", children: [_jsxs("div", { children: ["\u041A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430 \u0446\u0435\u043D\u0442\u0440\u0430: (", formatNumber(item.x, { maximumFractionDigits: 1 }), "; ", formatNumber(item.y, { maximumFractionDigits: 1 }), ") \u043C"] }), _jsxs("div", { children: ["\u041F\u0440\u0438\u0447\u0438\u043D\u0430: ", item.reason] })] })] }, item.id))) })] }, group.key));
        }) }));
};
const getHeatmapColor = (value, min, max) => {
    if (!Number.isFinite(value)) {
        return "#cbd5e1";
    }
    const normalized = Math.max(0, Math.min(1, (value - min) / Math.max(max - min, 1e-6)));
    const scaled = normalized * (HEATMAP_COLORS.length - 1);
    const index = Math.floor(scaled);
    const nextIndex = Math.min(HEATMAP_COLORS.length - 1, index + 1);
    const mix = scaled - index;
    return interpolateColor(HEATMAP_COLORS[index], HEATMAP_COLORS[nextIndex], mix);
};
const interpolateColor = (from, to, mix) => {
    const start = hexToRgb(from);
    const end = hexToRgb(to);
    const red = Math.round(start.r + (end.r - start.r) * mix);
    const green = Math.round(start.g + (end.g - start.g) * mix);
    const blue = Math.round(start.b + (end.b - start.b) * mix);
    return `rgb(${red}, ${green}, ${blue})`;
};
const formatRcPower = (valueW) => {
    if (!Number.isFinite(valueW)) {
        return "не задано";
    }
    const value = valueW;
    if (Math.abs(value) >= 1000) {
        return `${formatNumber(value / 1000, { maximumFractionDigits: 1 })} кВт`;
    }
    return `${formatNumber(value, { maximumFractionDigits: 0 })} Вт`;
};
const formatRcPowerAxis = (valueW) => {
    if (!Number.isFinite(valueW)) {
        return "—";
    }
    if (Math.abs(valueW) >= 1000) {
        return `${formatNumber(valueW / 1000, { maximumFractionDigits: 1 })} кВт`;
    }
    return formatNumber(valueW, { maximumFractionDigits: 0 });
};
const formatRcPercent = (value) => {
    if (!Number.isFinite(value)) {
        return "не задано";
    }
    return `${formatNumber(value, { maximumFractionDigits: 1 })} %`;
};
const formatRcTemperature = (value) => {
    if (!Number.isFinite(value)) {
        return "не задано";
    }
    return `${formatNumber(value, { maximumFractionDigits: 1 })} °C`;
};
const resolveRcDomain = (values) => {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) {
        return null;
    }
    return [Math.min(...finite), Math.max(...finite)];
};
const buildRcHeatColor = (value, domain) => {
    const [min, max] = domain;
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
        return "rgba(203, 213, 225, 0.2)";
    }
    return `${getHeatmapColor(value, min, Math.max(max, min + 1e-6))}99`;
};
const hexToRgb = (hex) => {
    const value = hex.replace("#", "");
    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    };
};
const hashThermalOptions = (options) => JSON.stringify({
    duration: options.duration,
    timestepMinutes: options.timestepMinutes,
    outdoor: options.outdoor,
    setpoints: options.setpoints,
    internalGains: options.internalGains,
    infiltrationACH: options.infiltrationACH,
    engineering: options.engineering,
});
const dedupeWarningList = (warnings) => Array.from(new Set(warnings.filter(Boolean)));
const downloadTextFile = (content, filename, mime) => {
    if (typeof window === "undefined") {
        return;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
const hashModelGeometry = (model) => {
    const encodeRooms = model.rooms
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((room) => `${room.id}:${room.levelId}:${room.polygon.map((point) => `${point.x.toFixed(2)}_${point.y.toFixed(2)}`).join(",")}`)
        .join("|");
    const encodeWalls = model.walls
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((wall) => `${wall.id}:${wall.levelId}:${wall.a.x.toFixed(2)}_${wall.a.y.toFixed(2)}:${wall.b.x.toFixed(2)}_${wall.b.y.toFixed(2)}:${wall.thickness_m.toFixed(2)}:${wall.height_m.toFixed(2)}:${wall.wallAssemblyId ?? "na"}`)
        .join("|");
    const encodeDoors = model.doors
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((door) => {
        const wallId = door.anchor.wallId ?? "lost";
        const wall = model.walls.find((w) => w.id === wallId);
        const offset = wall ? anchorToOffset(door.anchor, wall) : door.anchor.offset_m;
        return `${door.id}:${wallId}:${offset.toFixed(2)}:${door.width_m.toFixed(2)}:${door.height_m.toFixed(2)}`;
    })
        .join("|");
    const encodeWindows = model.windows
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((window) => {
        const wallId = window.anchor.wallId ?? "lost";
        const wall = model.walls.find((w) => w.id === wallId);
        const offset = wall ? anchorToOffset(window.anchor, wall) : window.anchor.offset_m;
        return `${window.id}:${wallId}:${offset.toFixed(2)}:${window.width_m.toFixed(2)}:${window.height_m.toFixed(2)}`;
    })
        .join("|");
    return [encodeRooms, encodeWalls, encodeDoors, encodeWindows].join("#");
};
const TRANSIENT_CHART_TEMPERATURE_DOMAIN = [-60, 80];
const INDOOR_CHART_TEMPERATURE_DOMAIN = [-20, 40];
const MAX_SENSITIVITY_PERCENT = 300;
export function isTrustworthyTemperatureValue(value) {
    return Number.isFinite(value) && Math.abs(value) <= 200;
}
function sanitizeChartTemperature(value) {
    return isTrustworthyTemperatureValue(value) ? Number(value) : null;
}
export function sanitizeIndoorChartTemperature(value) {
    return Number.isFinite(value) && Number(value) >= -20 && Number(value) <= 60 ? Number(value) : null;
}
function sanitizeChartMagnitude(value) {
    return Number.isFinite(value) && Math.abs(value) <= 1e6 ? Number(value) : null;
}
export function formatSafeTemperature(value) {
    if (!Number.isFinite(value)) {
        return "н/д";
    }
    if (Math.abs(value) > 200) {
        return "расчет неустойчив";
    }
    return `${formatNumber(value, { maximumFractionDigits: 1 })} °C`;
}
export function formatSafeNumber(value, maximumFractionDigits = 1) {
    if (!Number.isFinite(value)) {
        return "н/д";
    }
    if (Math.abs(value) > 1e6) {
        return "н/д";
    }
    return formatNumber(value, { maximumFractionDigits });
}
function formatSafeSignedNumber(value, maximumFractionDigits = 2) {
    if (!Number.isFinite(value)) {
        return "н/д";
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatSafeNumber(value, maximumFractionDigits)}`;
}
export function formatSafePercent(value) {
    if (!Number.isFinite(value)) {
        return "н/д";
    }
    const percentValue = Number(value) * 100;
    if (Math.abs(percentValue) > 300) {
        return "за пределами шкалы";
    }
    return `${formatNumber(percentValue, { maximumFractionDigits: 1 })}%`;
}
function clampSensitivityPercent(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(-MAX_SENSITIVITY_PERCENT, Math.min(MAX_SENSITIVITY_PERCENT, Number(value)));
}
export function hasUsableScenarioSummarySeries(data) {
    return data.some((entry) => entry.peak !== null || entry.energy !== null);
}
export function hasUsableTemperatureSeries(data) {
    return data.some((entry) => Object.entries(entry).some(([key, value]) => key !== "time" && value !== null));
}
export function hasUsableSensitivitySeries(data) {
    return data.some((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.impact) && entry.impact > 0.001);
}
export function shortenScenarioLabel(label) {
    const normalized = label.trim().toLowerCase();
    if (/баз|base/.test(normalized)) {
        return "Базовый";
    }
    if (/окн|window/.test(normalized) || /гермет/i.test(label)) {
        return "Замена окон";
    }
    if ((/утеп|insulat/.test(normalized) && /стен|wall/.test(normalized)) || /фасад/.test(normalized)) {
        return "Утепление стен";
    }
    if (/воздухо|вент|air/.test(normalized)) {
        return "Воздухообмен";
    }
    if ((/наруж|outdoor/.test(normalized) || normalized.includes("-5")) && normalized.includes("-5")) {
        return "Наружная -5°C";
    }
    if (/польз|custom|user/.test(normalized)) {
        return "Пользовательский";
    }
    return label.length > 24 ? `${label.slice(0, 21)}…` : label;
}
export function formatTransientSampleViewModeLabel(mode) {
    switch (mode) {
        case "worst":
            return "наихудший сценарий";
        case "median":
            return "медианный сценарий";
        case "best":
            return "лучший сценарий";
        default:
            return "базовый расчет";
    }
}
export function formatHistogramBinLabel(start, end) {
    const left = formatNumber(start, { maximumFractionDigits: 1 });
    const right = formatNumber(end, { maximumFractionDigits: 1 });
    return start === end ? left : `${left}–${right}`;
}
export function selectTransientSampleByMode(result, mode) {
    return getTransientMonteCarloVisualizationSample(result, mode);
}
function shortenSensitivityLabel(label) {
    const normalized = label.trim().toLowerCase();
    if (normalized.includes("outdoor")) {
        return "Наружная t";
    }
    if (normalized.includes("window")) {
        return "Окна";
    }
    if (normalized.includes("insulation")) {
        return "Утепление";
    }
    if (normalized.includes("vent")) {
        return "Воздухообмен";
    }
    if (normalized.includes("radiator") || normalized.includes("heating")) {
        return "Отопление";
    }
    if (normalized.includes("equipment")) {
        return "Внутренние теплопоступления";
    }
    return label.length > 24 ? `${label.slice(0, 21)}…` : label;
}
function formatSensitivityLabel(value) {
    if (!value) {
        return "н/д";
    }
    return shortenSensitivityLabel(value);
}
function buildTransientEmptyStateMessage(result) {
    if (!result) {
        return "Недостаточно данных для визуализации. Запустите расчёт или уточните входные параметры.";
    }
    const suggested = result.metadata.stabilityLimit_s;
    if (!result.valid || !result.stable) {
        const suggestion = Number.isFinite(suggested) ? ` Уменьшите шаг времени до ${formatNumber(suggested, { maximumFractionDigits: 1 })} с или меньше.` : "";
        return `График не построен: нестационарный расчет признан неустойчивым или недостоверным.${suggestion}`;
    }
    return "Недостаточно данных для визуализации. Запустите расчёт или уточните входные параметры.";
}
export const buildTransientConclusion = (result, frame) => {
    if (!result.valid || !result.stable) {
        const suggested = result.metadata.stabilityLimit_s;
        const suggestion = Number.isFinite(suggested)
            ? ` Необходимо уменьшить шаг времени до ${formatNumber(suggested, { maximumFractionDigits: 1 })} с или использовать устойчивую неявную схему.`
            : " Необходимо уменьшить шаг времени или использовать устойчивую неявную схему.";
        return `Нестационарный расчет признан неустойчивым или недостоверным. Полученные температурные значения не используются для инженерного вывода.${suggestion}`;
    }
    if (!frame) {
        return "Расчет выполнен, но временной срез не выбран.";
    }
    const inner = frame.innerSurfaceTemperature_C;
    const outer = frame.outerSurfaceTemperature_C;
    const trend = result.innerSurfaceTemperature[result.innerSurfaceTemperature.length - 1] >= result.innerSurfaceTemperature[0]
        ? "восстанавливается"
        : "остывает";
    return `Внутренняя поверхность ${trend}: ${formatSafeTemperature(inner)} на выбранном шаге, наружная поверхность ${formatSafeTemperature(outer)}. Минимум по внутренней стороне за сценарий ${formatSafeTemperature(result.minInnerSurfaceTemperature)}.`;
};
const EconomicAssessmentPanel = ({ report, initialScenario, }) => {
    const baseScenario = useMemo(() => initialScenario ?? buildDefaultEconomicScenario(report), [initialScenario, report]);
    const [heatPrice, setHeatPrice] = useState(baseScenario.tariff.heatPrice_RUB_kWh);
    const [discountRatePercent, setDiscountRatePercent] = useState((baseScenario.discountRate ?? 0.1) * 100);
    const [analysisPeriodYears, setAnalysisPeriodYears] = useState(baseScenario.analysisPeriod_years);
    useEffect(() => {
        setHeatPrice(baseScenario.tariff.heatPrice_RUB_kWh);
        setDiscountRatePercent((baseScenario.discountRate ?? 0.1) * 100);
        setAnalysisPeriodYears(baseScenario.analysisPeriod_years);
    }, [baseScenario]);
    const scenario = useMemo(() => ({
        ...baseScenario,
        tariff: {
            ...baseScenario.tariff,
            heatPrice_RUB_kWh: heatPrice,
        },
        discountRate: discountRatePercent / 100,
        analysisPeriod_years: analysisPeriodYears,
    }), [analysisPeriodYears, baseScenario, discountRatePercent, heatPrice]);
    const assessment = useMemo(() => runEconomicAssessment(report, scenario), [report, scenario]);
    return (_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430" }), _jsx("p", { className: "mt-1 text-xs text-[color:var(--text-soft)]", children: "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0439, \u043E\u0446\u0435\u043D\u043A\u0430 \u0433\u043E\u0434\u043E\u0432\u043E\u0439 \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0438 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u0438 \u043F\u0440\u043E\u0441\u0442\u0430\u044F NPV-\u043C\u043E\u0434\u0435\u043B\u044C \u0431\u0435\u0437 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0440\u0430\u0441\u0447\u0435\u0442\u0430." })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-3", children: [_jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u0422\u0430\u0440\u0438\u0444, \u20BD/\u043A\u0412\u0442\u00B7\u0447", _jsx("input", { type: "number", min: 0, step: "0.1", value: heatPrice, onChange: (event) => setHeatPrice(Math.max(0, Number(event.target.value) || 0)), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] }), _jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u0421\u0442\u0430\u0432\u043A\u0430, %", _jsx("input", { type: "number", min: 0, step: "0.5", value: discountRatePercent, onChange: (event) => setDiscountRatePercent(Math.max(0, Number(event.target.value) || 0)), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] }), _jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u041F\u0435\u0440\u0438\u043E\u0434, \u043B\u0435\u0442", _jsx("input", { type: "number", min: 1, step: "1", value: analysisPeriodYears, onChange: (event) => setAnalysisPeriodYears(Math.max(1, Math.round(Number(event.target.value) || 1))), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] })] })] }), _jsxs("div", { className: "mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5", children: [_jsx(KpiCard, { label: "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C", value: formatCurrency(assessment.summary.totalCost_RUB), tone: "warning", align: "left" }), _jsx(KpiCard, { label: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F", value: formatNumber(assessment.summary.totalSavedEnergy_kWh_year, { maximumFractionDigits: 0 }), hint: "\u043A\u0412\u0442\u00B7\u0447/\u0433\u043E\u0434", tone: "good", align: "left" }), _jsx(KpiCard, { label: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F, \u20BD/\u0433\u043E\u0434", value: formatCurrency(assessment.summary.totalAnnualSaving_RUB), tone: "info", align: "left" }), _jsx(KpiCard, { label: "\u041E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C", value: assessment.summary.simplePayback_years === null ? "—" : `${formatNumber(assessment.summary.simplePayback_years, { maximumFractionDigits: 1 })} г`, tone: assessment.summary.simplePayback_years !== null && assessment.summary.simplePayback_years <= 8 ? "good" : "warning", align: "left" }), _jsx(KpiCard, { label: "NPV", value: formatCurrency(assessment.summary.npv_RUB), tone: "info", align: "left" })] }), _jsxs("div", { className: "mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F" }), _jsxs("div", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u0411\u0430\u0437\u0430 ", formatNumber(assessment.summary.baseAnnualHeatingEnergy_kWh, { maximumFractionDigits: 0 }), " \u043A\u0412\u0442\u00B7\u0447/\u0433\u043E\u0434", assessment.summary.estimatedAnnualHeatingEnergyAfter_kWh !== null
                                        ? ` → ${formatNumber(assessment.summary.estimatedAnnualHeatingEnergyAfter_kWh, { maximumFractionDigits: 0 })} кВт·ч/год`
                                        : ""] })] }), _jsx("div", { className: "mt-3 overflow-visible", children: _jsxs("table", { className: "w-full table-auto text-left text-sm text-[color:var(--text-muted)]", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: [_jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u041C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "A" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u20BD/\u0433\u043E\u0434" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u041E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "NPV" })] }) }), _jsx("tbody", { children: assessment.measureResults.map((entry) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)] align-top", children: [_jsxs("td", { className: "py-2 pr-2", children: [_jsx("div", { className: "font-medium text-[color:var(--text-base)]", children: entry.measureName }), _jsx("div", { className: "text-xs text-[color:var(--text-soft)]", children: entry.recommendation })] }), _jsx("td", { className: "py-2 pr-2", children: formatArea(entry.area_m2) }), _jsx("td", { className: "py-2 pr-2", children: formatCurrency(entry.cost_RUB) }), _jsx("td", { className: "py-2 pr-2", children: formatNumber(entry.savedEnergy_kWh_year, { maximumFractionDigits: 0 }) }), _jsx("td", { className: "py-2 pr-2", children: formatCurrency(entry.annualSaving_RUB) }), _jsx("td", { className: "py-2 pr-2", children: entry.payback_years === null ? "—" : `${formatNumber(entry.payback_years, { maximumFractionDigits: 1 })} г` }), _jsx("td", { className: "py-2 pr-2", children: formatCurrency(entry.npv_RUB) })] }, entry.measureId))) })] }) })] }), assessment.recommendations.length ? (_jsxs("div", { className: "mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438" }), _jsx("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: assessment.recommendations.map((entry) => (_jsx("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: entry }, entry))) })] })) : null, assessment.warnings.length ? (_jsx("div", { className: "mt-4 rounded-2xl border border-dashed border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]", children: assessment.warnings.join(" ") })) : null] }));
};
void EconomicAssessmentPanel;
const shortenEconomicLabel = (value) => {
    const normalized = value.toLowerCase();
    if (normalized.includes("кров")) {
        return "Кровля";
    }
    if (normalized.includes("фасад") || normalized.includes("стен")) {
        return "Фасад";
    }
    if (normalized.includes("пол")) {
        return "Пол";
    }
    if (normalized.includes("окн")) {
        return "Окна";
    }
    if (normalized.includes("инфильтр") || normalized.includes("вентиля")) {
        return "Инфильтрация";
    }
    if (normalized.includes("отопл")) {
        return "Отопление";
    }
    return value.length > 18 ? `${value.slice(0, 18).trimEnd()}…` : value;
};
const EconomicAssessmentPanelV2 = ({ report, initialScenario, }) => {
    const baseScenario = useMemo(() => initialScenario ?? buildDefaultEconomicScenario(report), [initialScenario, report]);
    const [scenarioMode, setScenarioMode] = useState(baseScenario.mode);
    const [heatTariff, setHeatTariff] = useState(baseScenario.heatTariffRubPerGcal);
    const [electricityTariff, setElectricityTariff] = useState(baseScenario.electricityTariffRubPerKwh);
    const [heatingSource, setHeatingSource] = useState(baseScenario.heatingEnergySource);
    const [regionalFactor, setRegionalFactor] = useState(baseScenario.regionalCostFactor);
    const [discountRatePercent, setDiscountRatePercent] = useState((baseScenario.discountRate ?? 0.1) * 100);
    const [annualTariffGrowthPercent, setAnnualTariffGrowthPercent] = useState(baseScenario.annualTariffGrowthPercent ?? 5);
    const [annualMaintenanceCost, setAnnualMaintenanceCost] = useState(baseScenario.annualMaintenanceCost_RUB ?? 0);
    const [analysisPeriodYears, setAnalysisPeriodYears] = useState(baseScenario.analysisPeriod_years);
    useEffect(() => {
        setScenarioMode(baseScenario.mode);
        setHeatTariff(baseScenario.heatTariffRubPerGcal);
        setElectricityTariff(baseScenario.electricityTariffRubPerKwh);
        setHeatingSource(baseScenario.heatingEnergySource);
        setRegionalFactor(baseScenario.regionalCostFactor);
        setDiscountRatePercent((baseScenario.discountRate ?? 0.1) * 100);
        setAnnualTariffGrowthPercent(baseScenario.annualTariffGrowthPercent ?? 5);
        setAnnualMaintenanceCost(baseScenario.annualMaintenanceCost_RUB ?? 0);
        setAnalysisPeriodYears(baseScenario.analysisPeriod_years);
    }, [baseScenario]);
    const scenario = useMemo(() => ({
        ...baseScenario,
        mode: scenarioMode,
        name: scenarioMode === "minimum_budget"
            ? "Минимальный бюджет"
            : scenarioMode === "maximum_saving"
                ? "Максимальная экономия"
                : scenarioMode === "fast_payback"
                    ? "Быстрый срок окупаемости"
                    : "Комплексная модернизация",
        heatTariffRubPerGcal: heatTariff,
        electricityTariffRubPerKwh: electricityTariff,
        heatingEnergySource: heatingSource,
        regionalCostFactor: regionalFactor,
        discountRate: discountRatePercent / 100,
        annualTariffGrowthPercent,
        annualMaintenanceCost_RUB: annualMaintenanceCost,
        analysisPeriod_years: analysisPeriodYears,
    }), [analysisPeriodYears, annualMaintenanceCost, annualTariffGrowthPercent, baseScenario, discountRatePercent, electricityTariff, heatTariff, heatingSource, regionalFactor, scenarioMode]);
    const assessment = useMemo(() => runEconomicAssessment(report, scenario), [report, scenario]);
    const bestMeasure = assessment.measureResults[0] ?? null;
    const fastestMeasure = assessment.measureResults
        .filter((entry) => entry.status === "calculated" && entry.payback_years !== null)
        .sort((left, right) => (left.payback_years ?? Number.POSITIVE_INFINITY) - (right.payback_years ?? Number.POSITIVE_INFINITY))[0] ?? null;
    const zoneChartData = assessment.zones
        .filter((entry) => entry.id !== "heatingSystem" && entry.heatLoss_W > 0)
        .map((entry) => ({
        name: shortenEconomicLabel(entry.label),
        fullName: entry.label,
        loss: Number(entry.heatLoss_W.toFixed(0)),
        share: Number((entry.heatLossShare * 100).toFixed(1)),
    }));
    const paybackChartData = assessment.measureResults
        .filter((entry) => entry.status === "calculated")
        .slice(0, 8)
        .map((entry) => ({
        name: shortenEconomicLabel(entry.measureName),
        fullName: entry.measureName,
        payback: entry.payback_years === null ? 0 : Number(entry.payback_years.toFixed(1)),
    }));
    const scenarioButtons = [
        { id: "minimum_budget", label: "Минимальный бюджет" },
        { id: "maximum_saving", label: "Максимальная экономия" },
        { id: "fast_payback", label: "Быстрый срок окупаемости" },
        { id: "comprehensive", label: "Комплексная модернизация" },
    ];
    const hasMeasures = assessment.measureResults.length > 0;
    const hasNoPaybackMeasures = assessment.summary.allMeasuresNonPayback;
    const qualityCounts = assessment.zones.reduce((accumulator, zone) => {
        accumulator[zone.dataQualityLevel] += 1;
        return accumulator;
    }, { calculated: 0, estimated: 0, default: 0 });
    const scoreTooltipLabel = (_jsx(Tooltip, { title: "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F", description: "\u0418\u043D\u0442\u0435\u0433\u0440\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0435\u0439\u0442\u0438\u043D\u0433 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F \u043E\u0442 0 \u0434\u043E 100.", details: [
            "Учитывает долю теплопотерь, экономию энергии и денег, окупаемость, NPV, комфорт, риски и сложность.",
            "Сценарий пользователя смещает веса в пользу бюджета, экономии, окупаемости или комплексного эффекта.",
        ], children: _jsx("span", { className: "cursor-help", children: "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442" }) }));
    const npvTooltipLabel = (_jsx(Tooltip, { title: "NPV", description: "\u0427\u0438\u0441\u0442\u044B\u0439 \u0434\u0438\u0441\u043A\u043E\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0434\u043E\u0445\u043E\u0434 \u0437\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442 \u0440\u0430\u0441\u0447\u0435\u0442\u0430.", details: [
            "Учитывает ставку дисконтирования, ежегодный рост тарифа и ежегодное обслуживание.",
            "Отрицательный NPV не означает бесполезность мероприятия: оно может быть важно для комфорта и надежности.",
        ], children: _jsx("span", { className: "cursor-help", children: "NPV" }) }));
    const paybackTooltipLabel = (_jsx(Tooltip, { title: "\u041E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C", description: "\u041F\u0440\u043E\u0441\u0442\u043E\u0439 \u0441\u0440\u043E\u043A \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438 \u0432 \u0433\u043E\u0434\u0430\u0445.", details: [
            "До 3 лет — быстрая.",
            "3-7 лет — средняя.",
            "7-15 лет — длительная.",
            "Более 15 лет — низкая экономическая привлекательность.",
        ], children: _jsx("span", { className: "cursor-help", children: "\u041E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C" }) }));
    return (_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u043A\u0430" }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-7", children: [_jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u0422\u0435\u043F\u043B\u043E, \u20BD/\u0413\u043A\u0430\u043B", _jsx("input", { type: "number", min: 0, step: "50", value: heatTariff, onChange: (event) => setHeatTariff(Math.max(0, Number(event.target.value) || 0)), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] }), _jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u042D\u043B\u0435\u043A\u0442\u0440\u043E\u044D\u043D\u0435\u0440\u0433\u0438\u044F, \u20BD/\u043A\u0412\u0442\u00B7\u0447", _jsx("input", { type: "number", min: 0, step: "0.1", value: electricityTariff, onChange: (event) => setElectricityTariff(Math.max(0, Number(event.target.value) || 0)), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] }), _jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u041A\u043E\u044D\u0444. \u0440\u0435\u0433\u0438\u043E\u043D\u0430", _jsx("input", { type: "number", min: 0.1, step: "0.05", value: regionalFactor, onChange: (event) => setRegionalFactor(Math.max(0.1, Number(event.target.value) || 1)), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] }), _jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u0421\u0442\u0430\u0432\u043A\u0430, %", _jsx("input", { type: "number", min: 0, step: "0.5", value: discountRatePercent, onChange: (event) => setDiscountRatePercent(Math.max(0, Number(event.target.value) || 0)), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] }), _jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u0420\u043E\u0441\u0442 \u0442\u0430\u0440\u0438\u0444\u0430, %/\u0433\u043E\u0434", _jsx("input", { type: "number", min: 0, step: "0.5", value: annualTariffGrowthPercent, onChange: (event) => setAnnualTariffGrowthPercent(Math.max(0, Number(event.target.value) || 0)), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] }), _jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u041E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435, \u20BD/\u0433\u043E\u0434", _jsx("input", { type: "number", min: 0, step: "1000", value: annualMaintenanceCost, onChange: (event) => setAnnualMaintenanceCost(Math.max(0, Number(event.target.value) || 0)), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] }), _jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u041F\u0435\u0440\u0438\u043E\u0434, \u043B\u0435\u0442", _jsx("input", { type: "number", min: 1, step: "1", value: analysisPeriodYears, onChange: (event) => setAnalysisPeriodYears(Math.max(1, Math.round(Number(event.target.value) || 1))), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]" })] })] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2", children: [scenarioButtons.map((item) => (_jsx("button", { type: "button", onClick: () => setScenarioMode(item.id), className: `rounded-full px-3 py-2 text-xs font-semibold transition ${scenarioMode === item.id ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:border-[color:var(--border-base)]"}`, children: item.label }, item.id))), _jsxs("button", { type: "button", onClick: () => setHeatingSource((prev) => (prev === "heat" ? "electricity" : prev === "electricity" ? "unknown" : "heat")), className: "rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-base)]", children: ["\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A: ", heatingSource === "heat" ? "тепло" : heatingSource === "electricity" ? "электроотопление" : "не задан"] })] }), !hasMeasures ? (_jsx("div", { className: "mt-4 rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-6 text-sm text-[color:var(--text-soft)]", children: "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0440\u0430\u0441\u0447\u0435\u0442\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043E\u0446\u0435\u043D\u043A\u0438. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438 \u043F\u043E \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F\u043C, \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0438 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043E\u0442\u043E\u043F\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430." })) : null, hasMeasures ? _jsxs("div", { className: "mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5", children: [_jsx(KpiCard, { label: "\u041E\u0431\u0449\u0438\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438", value: formatNumber(assessment.summary.totalHeatLoss_kW, { maximumFractionDigits: 1 }), hint: "\u043A\u0412\u0442", tone: "warning", align: "left" }), _jsx(KpiCard, { label: "\u041F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0438", value: formatCurrency(assessment.summary.packageAnnualSaving_RUB), hint: `${formatNumber(assessment.summary.packageSavedEnergy_Gcal_year, { maximumFractionDigits: 1 })} Гкал/год`, tone: "good", align: "left" }), _jsx(KpiCard, { label: "\u0421\u0430\u043C\u043E\u0435 \u0432\u044B\u0433\u043E\u0434\u043D\u043E\u0435 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435", value: bestMeasure ? bestMeasure.measureName : "—", hint: bestMeasure ? `${bestMeasure.priorityLevel}, ${formatCurrency(bestMeasure.annualSaving_RUB)}/год` : undefined, tone: "info", align: "left" }), _jsx(KpiCard, { label: "\u0421\u0430\u043C\u043E\u0435 \u0431\u044B\u0441\u0442\u0440\u043E\u0435 \u043F\u043E \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438", value: fastestMeasure ? fastestMeasure.measureName : "—", hint: fastestMeasure ? formatPayback(fastestMeasure.payback_years) : undefined, tone: "good", align: "left" }), _jsx(KpiCard, { label: "\u0413\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u044C \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0430\u043D\u0430\u043B\u0438\u0437\u0430", value: `${qualityCounts.calculated}/${assessment.zones.length}`, hint: `Расчетные: ${qualityCounts.calculated}, оценочные: ${qualityCounts.estimated}, справочные: ${qualityCounts.default}`, tone: qualityCounts.calculated >= Math.max(1, assessment.zones.length - qualityCounts.default) ? "good" : qualityCounts.calculated > 0 ? "warning" : "info", align: "left" })] }) : null, hasMeasures ? _jsxs("div", { className: "mt-4 grid gap-4 xl:grid-cols-2", children: [_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0421\u0432\u043E\u0434\u043A\u0430 \u043F\u043E \u0437\u0434\u0430\u043D\u0438\u044E" }), _jsxs("div", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u0411\u0430\u0437\u0430 ", formatNumber(assessment.summary.estimatedAnnualHeatingEnergyBefore_kWh, { maximumFractionDigits: 0 }), " \u043A\u0412\u0442\u00B7\u0447/\u0433\u043E\u0434"] })] }), _jsxs("div", { className: "mt-3 grid gap-2 text-sm text-[color:var(--text-muted)]", children: [_jsxs("div", { children: ["\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u0437\u043E\u043D\u0430 \u043F\u043E\u0442\u0435\u0440\u044C: ", assessment.summary.mainLossZone ?? "—"] }), _jsxs("div", { children: ["\u041D\u0430\u0438\u0431\u043E\u043B\u044C\u0448\u0430\u044F \u0434\u043E\u043B\u044F \u043F\u043E\u0442\u0435\u0440\u044C:", " ", assessment.summary.mainLossShare === null ? "—" : `${formatNumber(assessment.summary.mainLossShare * 100, { maximumFractionDigits: 1 })}%`] }), _jsxs("div", { children: ["\u041F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u044F: ", formatCurrency(assessment.summary.packageAnnualSaving_RUB), "/\u0433\u043E\u0434"] }), _jsxs("div", { children: ["\u041F\u0430\u043A\u0435\u0442\u043D\u0430\u044F \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C: ", formatPayback(assessment.summary.packagePayback_years)] }), _jsxs("div", { children: ["\u041A\u043B\u0430\u0441\u0441 \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438 \u043F\u0430\u043A\u0435\u0442\u0430: ", assessment.summary.packagePaybackClass] })] }), _jsx("div", { className: "mt-4 h-72", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: zoneChartData, layout: "vertical", margin: { top: 8, right: 12, left: 12, bottom: 8 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { type: "number" }), _jsx(YAxis, { type: "category", dataKey: "name", width: 160, tick: { fontSize: 11 } }), _jsx(RechartsTooltip, { formatter: (value, _name, item) => [`${value} Вт`, item?.payload?.fullName ?? item?.payload?.name] }), _jsx(Bar, { dataKey: "loss", name: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438, \u0412\u0442", fill: "#f59e0b", radius: [0, 8, 8, 0] })] }) }) })] }), _jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \u0441\u0440\u043E\u043A\u0430 \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438" }), _jsxs("div", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u041F\u043E\u0441\u043B\u0435 \u043F\u0430\u043A\u0435\u0442\u0430 ", formatNumber(assessment.summary.estimatedAnnualHeatingEnergyAfter_kWh, { maximumFractionDigits: 0 }), " \u043A\u0412\u0442\u00B7\u0447/\u0433\u043E\u0434"] })] }), _jsx("div", { className: "mt-4 h-72", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: paybackChartData, margin: { top: 8, right: 12, left: 12, bottom: 56 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "name", angle: -30, textAnchor: "end", interval: 0, height: 88, tick: { fontSize: 11 } }), _jsx(YAxis, {}), _jsx(RechartsTooltip, { formatter: (value, _name, item) => [`${value} лет`, item?.payload?.fullName ?? "Окупаемость"] }), _jsx(Bar, { dataKey: "payback", name: "\u041E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C, \u043B\u0435\u0442", radius: [8, 8, 0, 0], children: paybackChartData.map((entry) => (_jsx(Cell, { fill: entry.payback <= 8 ? "#22c55e" : entry.payback <= 15 ? "#f59e0b" : "#ef4444" }, entry.name))) })] }) }) })] })] }) : null, hasMeasures ? _jsxs("div", { className: "mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F" }), _jsx("div", { className: "text-xs text-[color:var(--text-soft)]", children: "\u0420\u0435\u0439\u0442\u0438\u043D\u0433 \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442 \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u044E, \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C, \u0434\u043E\u043B\u044E \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u044C, \u043A\u043E\u043C\u0444\u043E\u0440\u0442 \u0438 \u0440\u0438\u0441\u043A\u0438." })] }), hasNoPaybackMeasures ? (_jsx("div", { className: "mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]", children: "\u041F\u043E \u043F\u0440\u044F\u043C\u043E\u0439 \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0438 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F \u043D\u0435 \u043E\u043A\u0443\u043F\u0430\u044E\u0442\u0441\u044F \u0432 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445. \u041F\u0440\u0438 \u044D\u0442\u043E\u043C \u0447\u0430\u0441\u0442\u044C \u0438\u0437 \u043D\u0438\u0445 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0446\u0435\u043B\u0435\u0441\u043E\u043E\u0431\u0440\u0430\u0437\u043D\u0430 \u0434\u043B\u044F \u043F\u043E\u0432\u044B\u0448\u0435\u043D\u0438\u044F \u043A\u043E\u043C\u0444\u043E\u0440\u0442\u0430 \u0438 \u0441\u043D\u0438\u0436\u0435\u043D\u0438\u044F \u0440\u0438\u0441\u043A\u0430 \u043F\u0440\u043E\u043C\u0435\u0440\u0437\u0430\u043D\u0438\u044F." })) : null, _jsx("div", { className: "mt-3 overflow-x-auto", children: _jsxs("table", { className: "min-w-[980px] table-auto text-left text-sm text-[color:var(--text-muted)]", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: [_jsx("th", { className: "py-2 pr-3 font-semibold", children: "\u041C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435" }), _jsx("th", { className: "py-2 pr-3 font-semibold", children: "\u0417\u043E\u043D\u0430" }), _jsx("th", { className: "py-2 pr-3 font-semibold", children: "\u041F\u043B\u043E\u0449\u0430\u0434\u044C" }), _jsx("th", { className: "py-2 pr-3 font-semibold", children: "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C" }), _jsx("th", { className: "py-2 pr-3 font-semibold", children: "\u0413\u043A\u0430\u043B/\u0433\u043E\u0434" }), _jsx("th", { className: "py-2 pr-3 font-semibold", children: "\u20BD/\u0433\u043E\u0434" }), _jsx("th", { className: "py-2 pr-3 font-semibold", children: paybackTooltipLabel }), _jsx("th", { className: "py-2 pr-3 font-semibold", children: npvTooltipLabel }), _jsx("th", { className: "py-2 pr-3 font-semibold", children: "\u0421\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C" }), _jsx("th", { className: "py-2 pr-3 font-semibold", children: scoreTooltipLabel })] }) }), _jsx("tbody", { children: assessment.measureResults.map((entry) => (_jsxs("tr", { className: `border-t border-[color:var(--border-soft)] align-top ${entry.isRecommended ? "bg-[color:var(--success-bg)]" : ""}`, children: [_jsxs("td", { className: "py-3 pr-3", children: [_jsxs("div", { className: "flex items-center gap-2 font-medium text-[color:var(--text-base)]", children: [_jsx("span", { children: entry.measureName }), entry.isRecommended ? _jsx("span", { className: "rounded-full bg-[color:var(--success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--success-fg)]", children: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D\u043E" }) : null, _jsx("span", { className: formatDataQualityBadgeClass(entry.dataQualityLevel), children: formatDataQualityLabel(entry.dataQualityLevel) })] }), _jsx("div", { className: "text-xs text-[color:var(--text-soft)]", children: entry.implementationScope }), _jsxs("div", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u041A\u043E\u043C\u0444\u043E\u0440\u0442: ", entry.comfortEffect, ". \u0420\u0438\u0441\u043A: ", entry.riskReduction, "."] }), _jsx("div", { className: "mt-1 text-xs text-[color:var(--text-soft)] whitespace-normal break-words", children: entry.scenarioExplanation })] }), _jsx("td", { className: "py-3 pr-3", children: entry.zoneLabel }), _jsx("td", { className: "py-3 pr-3", children: entry.area_m2 > 0 ? formatArea(entry.area_m2) : "комплекс" }), _jsx("td", { className: "py-3 pr-3", children: formatCurrency(entry.totalCost_RUB) }), _jsx("td", { className: "py-3 pr-3", children: formatNumber(entry.savedEnergy_Gcal_year, { maximumFractionDigits: 2 }) }), _jsx("td", { className: "py-3 pr-3", children: formatCurrency(entry.annualSaving_RUB) }), _jsxs("td", { className: "py-3 pr-3", children: [_jsx("div", { children: formatPayback(entry.payback_years) }), _jsx("div", { className: "text-xs text-[color:var(--text-soft)]", children: entry.paybackClass })] }), _jsxs("td", { className: "py-3 pr-3", children: [_jsx("div", { children: formatCurrency(entry.npv_RUB) }), _jsxs("div", { className: "text-xs text-[color:var(--text-soft)]", children: ["PI: ", formatIndex(entry.profitabilityIndex)] }), _jsxs("div", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u0414\u0438\u0441\u043A\u043E\u043D\u0442. \u043E\u043A\u0443\u043F.: ", formatPayback(entry.discountedPayback_years)] })] }), _jsx("td", { className: "py-3 pr-3", children: entry.complexity }), _jsxs("td", { className: "py-3 pr-3", children: [_jsx("div", { className: "font-medium text-[color:var(--text-base)]", children: entry.priorityLevel }), _jsxs("div", { className: "text-xs text-[color:var(--text-soft)]", children: [formatNumber(entry.priorityScorePercent, { maximumFractionDigits: 1 }), " / 100"] }), _jsx("div", { className: "mt-1 text-xs text-[color:var(--text-soft)]", children: entry.priorityReasons.join(", ") })] })] }, entry.measureId))) })] }) })] }) : null] }));
};
const Sp50Panel = ({ report }) => (_jsxs("div", { className: "ui-panel-muted min-w-0 overflow-hidden p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0421\u041F 50.13330.2024" }), _jsx("p", { className: "mt-1 text-xs text-[color:var(--text-soft)]", children: "\u041D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u043E\u0442\u0447\u0435\u0442 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u0441\u043B\u043E\u0435\u043C \u0438 \u043D\u0435 \u043B\u043E\u043C\u0430\u0435\u0442 \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u0443\u044E \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044E." }), _jsxs("div", { className: "mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4", children: [_jsx(KpiCard, { label: "k\u043E\u0431", value: formatNumber(report.building.kob_W_m3K, { maximumFractionDigits: 2 }), tone: report.building.status === "pass" ? "good" : report.building.status === "fail" ? "critical" : "warning", hint: `норм: ${formatNumber(report.building.kobNorm_W_m3K, { maximumFractionDigits: 2 })}`, align: "left" }), _jsx(KpiCard, { label: "Q\u0433\u043E\u0434", value: formatNumber(report.energy.annualHeatingEnergy_kWh, { maximumFractionDigits: 0 }), tone: "info", hint: "\u043A\u0412\u0442\u00B7\u0447", align: "left" }), _jsx(KpiCard, { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: formatSp50Status(report.building.status), tone: report.building.status === "pass" ? "good" : report.building.status === "fail" ? "critical" : "warning", align: "left" }), _jsx(KpiCard, { label: "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F", value: String(report.constructions.filter((entry) => entry.status === "fail").length), tone: report.constructions.some((entry) => entry.status === "fail") ? "warning" : "good", hint: `из ${report.constructions.length} конструкций`, align: "left" })] }), _jsxs("details", { className: "mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", open: false, children: [_jsx("summary", { className: "cursor-pointer list-none text-sm font-semibold text-[color:var(--text-base)]", children: "\u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u0437\u0434\u0430\u043D\u0438\u044F" }), _jsxs("div", { className: "mt-4 grid gap-4 xl:grid-cols-2", children: [_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435" }), _jsxs("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsx(BalanceRow, { label: "\u0413\u043E\u0440\u043E\u0434 / \u043A\u043B\u0438\u043C\u0430\u0442", value: report.sourceData.city ?? report.sourceData.climateRegion ?? "—", unit: "" }), _jsx(BalanceRow, { label: "t\u0432", value: report.sourceData.indoorTemperatureC, unit: "\u00B0C" }), _jsx(BalanceRow, { label: "t\u043E\u0442", value: report.sourceData.outdoorHeatingPeriodAverageC, unit: "\u00B0C" }), _jsx(BalanceRow, { label: "z\u043E\u0442", value: report.sourceData.heatingPeriodDurationDays, unit: "\u0441\u0443\u0442" }), _jsx(BalanceRow, { label: "\u0413\u0421\u041E\u041F", value: report.sourceData.gsop, unit: "\u00B0C\u00B7\u0441\u0443\u0442" }), _jsx(BalanceRow, { label: "V\u043E\u0442", value: report.sourceData.heatedVolumeM3, unit: "\u043C\u00B3" }), _jsx(BalanceRow, { label: "A\u043E\u0442", value: report.sourceData.heatedAreaM2, unit: "\u043C\u00B2" }), _jsx(BalanceRow, { label: "\u0422\u0438\u043F \u0437\u0434\u0430\u043D\u0438\u044F", value: formatBuildingCategory(report.sourceData.buildingCategory), unit: "" }), _jsx(BalanceRow, { label: "\u042D\u0442\u0430\u0436\u043D\u043E\u0441\u0442\u044C", value: report.sourceData.storeys, unit: "" })] })] }), _jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0417\u0434\u0430\u043D\u0438\u0435" }), _jsxs("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsx(BalanceRow, { label: "k\u043E\u0431 \u0444\u0430\u043A\u0442", value: report.building.kob_W_m3K, unit: "\u0412\u0442/(\u043C\u00B3\u00B7\u041A)" }), _jsx(BalanceRow, { label: "k\u043E\u0431 \u043D\u043E\u0440\u043C", value: report.building.kobNorm_W_m3K, unit: "\u0412\u0442/(\u043C\u00B3\u00B7\u041A)" }), _jsx(BalanceRow, { label: "K\u043E\u0431\u0449", value: report.building.kOverall_W_m2K, unit: "\u0412\u0442/(\u043C\u00B2\u00B7\u041A)" }), _jsx(BalanceRow, { label: "K\u043A\u043E\u043C\u043F", value: report.building.compactness_1_m, unit: "1/\u043C" }), _jsx(BalanceRow, { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: formatSp50Status(report.building.status), unit: "" })] })] })] })] }), _jsxs("div", { className: "mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 shadow-sm", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438" }), _jsx("div", { className: "mt-3 overflow-x-auto", children: _jsxs("table", { className: "min-w-[760px] w-full table-auto text-left text-sm text-[color:var(--text-muted)]", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: [_jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u042D\u043B\u0435\u043C\u0435\u043D\u0442" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "A" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "Ro \u0444\u0430\u043A\u0442" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "Ro \u043D\u043E\u0440\u043C" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "R\u043E\u043F\u0440" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u0394" }), _jsx("th", { className: "py-2 pr-2 font-semibold", children: "\u0421\u0442\u0430\u0442\u0443\u0441" })] }) }), _jsx("tbody", { children: report.constructions.map((entry) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)] align-top", children: [_jsxs("td", { className: "py-2 pr-2", children: [_jsx("div", { className: "font-medium text-[color:var(--text-base)]", children: entry.label }), _jsx("div", { className: "text-xs text-[color:var(--text-soft)]", children: entry.layers.map((layer) => `${layer.materialLabel} ${formatNumber(layer.thicknessM, { maximumFractionDigits: 3 })} м`).join(" · ") || "Без послойных данных" })] }), _jsx("td", { className: "py-2 pr-2", children: formatArea(entry.areaM2) }), _jsx("td", { className: "py-2 pr-2", children: formatNumber(entry.actualResistance_m2K_W, { maximumFractionDigits: 2 }) }), _jsx("td", { className: "py-2 pr-2", children: formatNumber(entry.normalizedResistance_m2K_W, { maximumFractionDigits: 2 }) }), _jsx("td", { className: "py-2 pr-2", children: formatNumber(entry.reducedResistance_m2K_W, { maximumFractionDigits: 2 }) }), _jsx("td", { className: "py-2 pr-2", children: formatNumber(entry.margin_m2K_W, { maximumFractionDigits: 2 }) }), _jsx("td", { className: "py-2 pr-2", children: formatSp50Status(entry.status) })] }, entry.id))) })] }) }), _jsxs("div", { className: "mt-4 rounded-xl bg-[color:var(--surface-muted)] p-3", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041A\u043B\u044E\u0447\u0435\u0432\u043E\u0439 \u0432\u043A\u043B\u0430\u0434 \u0432 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438" }), _jsx("div", { className: "mt-2 space-y-2 text-sm text-[color:var(--text-muted)]", children: report.constructions
                                .filter((entry) => (entry.contribution_W_K ?? 0) > 0)
                                .sort((left, right) => (right.contribution_W_K ?? 0) - (left.contribution_W_K ?? 0))
                                .slice(0, 3)
                                .map((entry) => (_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate font-medium text-[color:var(--text-base)]", children: entry.label }), _jsxs("div", { className: "text-xs text-[color:var(--text-soft)]", children: [formatArea(entry.areaM2), " \u00B7 Ro ", formatNumber(entry.reducedResistance_m2K_W, { maximumFractionDigits: 2 })] })] }), _jsxs("div", { className: "shrink-0 font-medium text-[color:var(--text-base)]", children: [formatNumber(entry.contribution_W_K, { maximumFractionDigits: 2 }), " \u0412\u0442/\u041A"] })] }, `${entry.id}-loss`))) })] })] }), _jsxs("details", { className: "mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsx("summary", { className: "cursor-pointer list-none text-sm font-semibold text-[color:var(--text-base)]", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0438 \u044D\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438" }), _jsxs("div", { className: "mt-4 grid gap-4 xl:grid-cols-2", children: [_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430" }), _jsxs("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsx(BalanceRow, { label: "\u041C\u0438\u043D. t \u043F\u043E\u0432\u0435\u0440\u0445\u043D\u043E\u0441\u0442\u0438", value: report.temperature.minimumSurfaceTemperatureC, unit: "\u00B0C" }), _jsx(BalanceRow, { label: "\u0422\u043E\u0447\u043A\u0430 \u0440\u043E\u0441\u044B", value: report.temperature.dewPointTemperatureC, unit: "\u00B0C" }), _jsx(BalanceRow, { label: "\u0420\u0438\u0441\u043A", value: report.temperature.riskCount, unit: "\u0437\u043E\u043D" })] }), report.temperature.problematicZones.length ? (_jsx("div", { className: "mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)] whitespace-normal break-words", children: report.temperature.problematicZones.slice(0, 6).join("; ") })) : null] }), _jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F \u0438 \u043D\u0435\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u043E\u0441\u0442\u044C" }), _jsxs("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsx(BalanceRow, { label: "q\u043E\u0442_p", value: report.energy.qHeatingCharacteristic_W_m3K, unit: "\u0412\u0442/(\u043C\u00B3\u00B7\u041A)" }), _jsx(BalanceRow, { label: "q\u043E\u0442 \u043D\u043E\u0440\u043C", value: report.energy.qHeatingNorm_kWh_m2, unit: "\u043A\u0412\u0442\u00B7\u0447/\u043C\u00B2" }), _jsx(BalanceRow, { label: "Q\u043E\u0442_\u0433\u043E\u0434", value: report.energy.annualHeatingEnergy_kWh, unit: "\u043A\u0412\u0442\u00B7\u0447" }), _jsx(BalanceRow, { label: "Q\u043E\u0431\u0449_\u0433\u043E\u0434", value: report.energy.annualTotalLosses_kWh, unit: "\u043A\u0412\u0442\u00B7\u0447" }), _jsx(BalanceRow, { label: "D", value: report.transient.thermalInertia_D, unit: "" }), _jsx(BalanceRow, { label: "A\u03C4", value: report.transient.internalSurfaceAmplitudeC, unit: "\u00B0C" }), _jsx(BalanceRow, { label: "A\u03C4 \u043D\u043E\u0440\u043C", value: report.transient.requiredAmplitudeC, unit: "\u00B0C" }), _jsx(BalanceRow, { label: "\u0421\u0442\u0430\u0442\u0443\u0441 q\u043E\u0442", value: formatSp50Status(report.energy.status), unit: "" }), _jsx(BalanceRow, { label: "\u0421\u0442\u0430\u0442\u0443\u0441 \u043D\u0435\u0441\u0442\u0430\u0446.", value: formatSp50Status(report.transient.status), unit: "" })] })] })] })] }), _jsxs("details", { className: "mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsx("summary", { className: "cursor-pointer list-none text-sm font-semibold text-[color:var(--text-base)]", children: "\u0421\u043F\u0435\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438: \u0432\u043E\u0437\u0434\u0443\u0445, \u0432\u043B\u0430\u0433\u0430 \u0438 \u043F\u043E\u043B\u044B" }), _jsxs("div", { className: "mt-4 grid gap-4 xl:grid-cols-3", children: [_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0412\u043E\u0437\u0434\u0443\u0445\u043E\u043F\u0440\u043E\u043D\u0438\u0446\u0430\u0435\u043C\u043E\u0441\u0442\u044C" }), _jsxs("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsx(BalanceRow, { label: "Ru", value: report.airPermeability.actualResistance_m2hPa_kg, unit: "" }), _jsx(BalanceRow, { label: "Ru \u043D\u043E\u0440\u043C", value: report.airPermeability.requiredResistance_m2hPa_kg, unit: "" }), _jsx(BalanceRow, { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: formatSp50Status(report.airPermeability.status), unit: "" })] })] }), _jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0412\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u043D\u0430\u044F \u0437\u0430\u0449\u0438\u0442\u0430" }), _jsxs("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsx(BalanceRow, { label: "Rn", value: report.moistureProtection.actualResistance_m2hPa_mg, unit: "" }), _jsx(BalanceRow, { label: "Rn \u043D\u043E\u0440\u043C", value: report.moistureProtection.governingRequiredResistance_m2hPa_mg, unit: "" }), _jsx(BalanceRow, { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: report.moistureProtection.status === "calculated" ? formatCompliance(report.moistureProtection.complies) : "Недостаточно данных", unit: "" })] })] }), _jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041F\u043E\u043B\u044B" }), _jsxs("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: [_jsx(BalanceRow, { label: "Y\u043F\u043E\u043B", value: report.floor.heatAbsorption_W_m2K, unit: "\u0412\u0442/(\u043C\u00B2\u00B7\u041A)" }), _jsx(BalanceRow, { label: "Y\u043F\u043E\u043B \u043D\u043E\u0440\u043C", value: report.floor.requiredHeatAbsorption_W_m2K, unit: "\u0412\u0442/(\u043C\u00B2\u00B7\u041A)" }), _jsx(BalanceRow, { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: formatSp50Status(report.floor.status), unit: "" })] })] })] })] }), report.recommendations.length ? (_jsxs("div", { className: "mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438" }), _jsx("div", { className: "mt-3 space-y-2 text-sm text-[color:var(--text-muted)]", children: report.recommendations.map((item) => (_jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("div", { className: "font-medium text-[color:var(--text-base)]", children: item.title }), _jsx("div", { children: item.effect })] }, item.id))) })] })) : null, report.missingData.length ? (_jsx("div", { className: "mt-4 rounded-2xl border border-dashed border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]", children: report.missingData.join(" ") })) : null] }));
const formatCompliance = (value) => {
    if (value === null) {
        return "недостаточно данных";
    }
    return value ? "соответствует" : "не соответствует";
};
const formatSp50Status = (status) => {
    if (status === "pass") {
        return "соответствует";
    }
    if (status === "fail") {
        return "не соответствует";
    }
    return "недостаточно данных";
};
const formatBuildingCategory = (value) => {
    switch (value) {
        case "residential":
            return "жилое здание";
        case "educational":
            return "учебное здание";
        case "preschool":
            return "дошкольное здание";
        case "administrative":
            return "административное здание";
        default:
            return value ?? "—";
    }
};
const formatCurrency = (value) => {
    if (!Number.isFinite(value)) {
        return "—";
    }
    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0,
    }).format(value ?? 0);
};
const formatPayback = (value) => {
    if (!Number.isFinite(value)) {
        return "не рассчитывается";
    }
    return `${formatNumber(value, { maximumFractionDigits: 1 })} лет`;
};
const formatIndex = (value) => {
    if (!Number.isFinite(value)) {
        return "—";
    }
    return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const formatDataQualityLabel = (value) => {
    switch (value) {
        case "calculated":
            return "расчетные";
        case "estimated":
            return "оценочные";
        default:
            return "справочные";
    }
};
const formatDataQualityBadgeClass = (value) => {
    switch (value) {
        case "calculated":
            return "rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--success-fg)]";
        case "estimated":
            return "rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--warning-fg)]";
        default:
            return "rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--text-muted)]";
    }
};
export default ThermalSimulationPanel;
