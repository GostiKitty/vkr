import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BuildingModel, Room } from "../../../entities/geometry/types";
import type { AdjacencyResult } from "../../../core/graph/adjacency";
import {
  runThermalSimulation,
  type ThermalSimulationOptions,
  type ThermalSimulationResult,
} from "../../../core/thermal/solver";
import { formatThermalSimulationPeriodRu } from "../../../core/thermal/thermalResultsInterpretation";
import { buildBuildingLossSeries, buildZoneSeries } from "../../../core/thermal/thermalResultsChartPayload";
import { DEFAULT_ENGINEERING_OPTIONS } from "../../../core/thermal/engineering/constants";
import { runEngineeringThermalAnalysis } from "../../../core/thermal/engineering/analysis";
import type {
  EngineeringAnalysisResult,
  EngineeringFieldResult,
  EngineeringMetricInsight,
  EngineeringPresentationSummary,
  EngineeringRecommendation,
  EngineeringStatusSummary,
  EngineeringZoneInsight,
} from "../../../core/thermal/engineering/types";
import { getRoomDisplayName } from "../../../core/thermal/engineering/display";
import { formatArea, formatEnergy, formatNumber } from "../../../shared/utils/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import Tooltip from "../../../shared/ui/Tooltip";
import { anchorToOffset } from "../utils/openingMath";
import { demoRunSP50Calculation, exportDemoSp50ReportToJson, type DemoSp50RunResult } from "../../../demo/sampleBuildingSP50";
import { demoVKRScenario } from "../../../demo/demoVKRScenario";
import type { VideoDemoStepId } from "../../../demo/videoDemoScenario";
import {
  buildTransientScenarioPreset,
  getTransientFrame,
  getTransientMonteCarloVisualizationSample,
  getTransientScenarioPresets,
  listTransientConstructionTargets,
  runTransientMonteCarlo,
  runTransientConstructionAnalysis,
  type TransientCalculationResult,
  type TransientConstructionTarget,
  type TransientMonteCarloResult,
  type TransientUncertaintyParameter,
} from "../../../core/thermal/transient/index";
import {
  buildDefaultEconomicScenario,
  runEconomicAssessment,
  type EconomicAssessmentResult,
  type EconomicScenario,
} from "../../../core/economics/index";
import type { Sp50ComplianceReport } from "../../../core/thermal/sp50/types";
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
] as const;
const HEATMAP_COLORS = ["#16344f", "#1f5d7a", "#2d8d8b", "#66b96a", "#f2c04c", "#e97232", "#a9341f"];
const TRANSIENT_SCENARIO_PRESETS = getTransientScenarioPresets();

interface ThermalSimulationPanelProps {
  projectKey: string;
  model: BuildingModel;
  adjacency: AdjacencyResult;
  options: ThermalSimulationOptions;
  onOptionsChange: (next: ThermalSimulationOptions) => void;
  onResult?: (result: ThermalSimulationResult | null) => void;
  onLoadDemoModel?: (model: BuildingModel) => void;
  onVideoDemoStepChange?: (stepId: VideoDemoStepId) => void;
  onDemoStepChange?: (stepId: VideoDemoStepId) => void;
  onTransientResultChange?: (payload: {
    result: TransientCalculationResult | null;
    sourceId: string | null;
    sourceType: "wall" | "roof" | "slab" | null;
    warnings: string[];
    missingData: string[];
  }) => void;
  onTransientTimeIndexChange?: (timeIndex: number) => void;
  onTransientVisualizationEnabledChange?: (enabled: boolean) => void;
  /** Переключить вкладку на 3D и подготовить тепловой overlay (вызывается при «Показать на модели»). */
  onRequestThermalModelView?: () => void;
}

type TemperatureChartDatum = { time: number; outdoor: number } & Record<string, number>;
type TransientSampleViewMode = "base" | "worst" | "median" | "best";
interface PersistedThermalPanelState {
  result: ThermalSimulationResult | null;
  engineeringResult: EngineeringAnalysisResult | null;
  error: string | null;
  demoSp50Result: DemoSp50RunResult | null;
  activeView: (typeof PANEL_VIEWS)[number]["id"];
  lastHash: string | null;
  lastCalculatedAtIso: string | null;
  transientResult: TransientCalculationResult | null;
  transientWarnings: string[];
  transientMissingData: string[];
  transientSelectedTimeIndex: number;
  transientVisualizationEnabled: boolean;
  transientActiveTarget: TransientConstructionTarget | null;
  transientMonteCarloEnabled: boolean;
  transientMonteCarloResult: TransientMonteCarloResult | null;
  transientDisplayedSampleMode: TransientSampleViewMode;
}

type RcLossBreakdownRow = {
  key: import("../../../core/thermal/thermalResultsChartPayload").LossCategoryKey;
  label: string;
  valueW: number | null;
  sharePercent: number | null;
  color: string;
};

type RcZoneDiagnosticsRow = {
  zoneId: string;
  zoneName: string;
  temperatureC: number | null;
  heatingPowerW: number | null;
  lossOpaqueW: number | null;
  lossWindowW: number | null;
  lossDoorW: number | null;
  lossInfiltrationW: number | null;
  lossTotalW: number;
  infiltrationSharePercent: number | null;
  statusNote: string | null;
};

export function ThermalSimulationPanel({
  projectKey,
  model,
  adjacency,
  options,
  onOptionsChange,
  onResult,
  onTransientResultChange,
  onTransientTimeIndexChange,
  onTransientVisualizationEnabledChange,
  onRequestThermalModelView,
}: ThermalSimulationPanelProps) {
  const [result, setResult] = useState<ThermalSimulationResult | null>(null);
  const [engineeringResult, setEngineeringResult] = useState<EngineeringAnalysisResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoSp50Result, setDemoSp50Result] = useState<DemoSp50RunResult | null>(null);
  const [activeView, setActiveView] = useState<(typeof PANEL_VIEWS)[number]["id"]>("brief");
  const [heatmapHover, setHeatmapHover] = useState<{ x: number; y: number; temperatureC: number; roomId: string; roomLabel: string } | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [lastCalculatedAtIso, setLastCalculatedAtIso] = useState<string | null>(null);
  const [transientResult, setTransientResult] = useState<TransientCalculationResult | null>(null);
  const [transientWarnings, setTransientWarnings] = useState<string[]>([]);
  const [transientMissingData, setTransientMissingData] = useState<string[]>([]);
  const [selectedTransientScenarioId, setSelectedTransientScenarioId] = useState("cold_snap_24h");
  const [selectedTransientConstructionId, setSelectedTransientConstructionId] = useState<string | null>(null);
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
  const [transientActiveTarget, setTransientActiveTarget] = useState<TransientConstructionTarget | null>(null);
  const [transientMonteCarloEnabled, setTransientMonteCarloEnabled] = useState(false);
  const [transientMonteCarloRunning, setTransientMonteCarloRunning] = useState(false);
  const [transientMonteCarloResult, setTransientMonteCarloResult] = useState<TransientMonteCarloResult | null>(null);
  const [transientDisplayedSampleMode, setTransientDisplayedSampleMode] = useState<TransientSampleViewMode>("base");
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
  const selectedTransientTarget = useMemo(
    () => transientTargets.find((entry) => entry.id === selectedTransientConstructionId) ?? transientTargets[0] ?? null,
    [selectedTransientConstructionId, transientTargets]
  );

  const highlightedRooms = useMemo<Room[]>(() => model.rooms.slice(0, MAX_ROOMS_ON_CHART), [model.rooms]);
  const roomLabels = useMemo(
    () => Object.fromEntries(model.rooms.map((room) => [room.id, getRoomDisplayName(model, room.id)])),
    [model]
  );

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
    const restored = loadThermalPanelState<PersistedThermalPanelState>(projectKey);
    // #region agent log
    writeAgentDebugLog({sessionId:'c3d591',runId:'repro-4',hypothesisId:'H3',location:'ThermalSimulationPanel.tsx:restore',message:'thermal panel restore snapshot',data:{projectKey,modelHash,restoredHash:restored?.lastHash??null,hasStoredResult:Boolean(restored?.result),hasStoredEngineering:Boolean(restored?.engineeringResult),hasStoredTransient:Boolean(restored?.transientResult)},timestamp:Date.now()});
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
    writeAgentDebugLog({sessionId:'c3d591',runId:'repro-4',hypothesisId:'H3',location:'ThermalSimulationPanel.tsx:clear-stale',message:'thermal panel cleared stale snapshot',data:{projectKey,lastHash,modelHash},timestamp:Date.now()});
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
    } satisfies PersistedThermalPanelState);
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

  const temperatureSeries = useMemo<TemperatureChartDatum[]>(() => {
    if (!result) {
      return [];
    }
    return result.timeline.map((frame) => {
      const entry: TemperatureChartDatum = {
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
  const rcLossBreakdownRows = useMemo<RcLossBreakdownRow[]>(() => {
    if (!result) {
      return [];
    }
    const RC_LOSS_COLORS: Record<RcLossBreakdownRow["key"], string> = {
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
  const rcZoneDiagnosticsRows = useMemo<RcZoneDiagnosticsRow[]>(() => {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось запустить термический расчёт.";
      setError(message);
    } finally {
      setRunning(false);
    }
  }, [adjacency, canRun, model, modelHash, onResult, options]);

  const updateOptions = useCallback(
    (patch: Partial<ThermalSimulationOptions>) => {
      onOptionsChange({ ...options, ...patch });
    },
    [onOptionsChange, options]
  );

  const updateOutdoor = useCallback(
    (patch: Partial<ThermalSimulationOptions["outdoor"]>) => {
      onOptionsChange({ ...options, outdoor: { ...options.outdoor, ...patch } });
    },
    [onOptionsChange, options]
  );

  const updateSetpoints = useCallback(
    (patch: Partial<ThermalSimulationOptions["setpoints"]>) => {
      onOptionsChange({ ...options, setpoints: { ...options.setpoints, ...patch } });
    },
    [onOptionsChange, options]
  );

  const updateGains = useCallback(
    (patch: Partial<ThermalSimulationOptions["internalGains"]>) => {
      onOptionsChange({ ...options, internalGains: { ...options.internalGains, ...patch } });
    },
    [onOptionsChange, options]
  );

  const updateEngineering = useCallback(
    (patch: Partial<NonNullable<ThermalSimulationOptions["engineering"]>>) => {
      onOptionsChange({
        ...options,
        engineering: {
          ...DEFAULT_ENGINEERING_OPTIONS,
          ...(options.engineering ?? {}),
          ...patch,
        },
      });
    },
    [onOptionsChange, options]
  );

  const legendFormatter = useCallback(
    (value: string) => {
      if (value === "outdoor") {
        return "Улица";
      }
      if (value === "total") {
        return "Суммарно";
      }
      return roomLabels[value] ?? "Помещение";
    },
    [roomLabels]
  );

  const engineeringOptions = useMemo(
    () => ({
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
    }),
    [options.engineering]
  );
  const fieldView = engineeringResult?.detailedField ?? engineeringResult?.fastField ?? null;
  const zoneInsights = engineeringResult?.zoneInsights ?? [];
  const presentation = engineeringResult?.presentation ?? null;
  const heatLossSeries = useMemo(
    () =>
      engineeringResult
        ? [
            { name: "Стены", value: engineeringResult.balance.wallLossW },
            { name: "Окна", value: engineeringResult.balance.windowLossW },
            { name: "Двери", value: engineeringResult.balance.doorLossW },
            { name: "Пол", value: engineeringResult.balance.floorLossW },
            { name: "Покрытие", value: engineeringResult.balance.roofLossW },
            { name: "Инфильтрация", value: engineeringResult.balance.infiltrationLossW },
            { name: "Вентиляция", value: engineeringResult.balance.ventilationLossW },
          ]
        : [],
    [engineeringResult]
  );
  const gainSeries = useMemo(() => {
    if (!engineeringResult) {
      return [];
    }
    const byKind = new Map<string, number>();
    engineeringResult.gains.forEach((entry) => {
      byKind.set(entry.label, (byKind.get(entry.label) ?? 0) + entry.effectivePowerW);
    });
    return Array.from(byKind.entries()).map(([name, value]) => ({ name, value }));
  }, [engineeringResult]);
  const scenarioSummarySeries = useMemo(
    () =>
      engineeringResult?.scenarios
        .map((scenario) => ({
          name: shortenScenarioLabel(scenario.label),
          peak: sanitizeChartMagnitude(scenario.summary.peakHeatingKW),
          energy: sanitizeChartMagnitude(scenario.summary.totalHeatingKWh),
          finalTemperatureC: sanitizeIndoorChartTemperature(scenario.summary.finalTemperatureC),
        }))
        .filter((entry) => entry.peak !== null || entry.energy !== null) ?? [],
    [engineeringResult]
  );
  const scenarioTemperatureSeries = useMemo(() => {
    if (!engineeringResult?.scenarios.length) {
      return [];
    }
    const baseline = engineeringResult.scenarios[0];
    return baseline.points.map((point, index) => {
      const row: Record<string, number | string | null> = {
        time: formatTimeLabel(point.timeHours),
        outdoor: sanitizeChartTemperature(point.outdoorTemperatureC),
      };
      engineeringResult.scenarios.slice(0, 4).forEach((scenario) => {
        row[shortenScenarioLabel(scenario.label)] = sanitizeIndoorChartTemperature(scenario.points[index]?.indoorTemperatureC ?? NaN);
      });
      return row;
    }).filter((row) => hasUsableTemperatureSeries([row]));
  }, [engineeringResult]);
  const sensitivitySeries = useMemo(
    () =>
      engineeringResult?.sensitivity
        .map((entry) => ({
          name: shortenSensitivityLabel(entry.parameter),
          value: clampSensitivityPercent(entry.deltaHeatingPercent),
          impact: entry.normalizedImpact,
          isClipped: Math.abs(entry.deltaHeatingPercent) > MAX_SENSITIVITY_PERCENT,
        }))
        .filter((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.impact)) ?? [],
    [engineeringResult]
  );
  const hasUsableRoomTemperatureSeries = useMemo(
    () =>
      temperatureSeries.some((entry) =>
        Object.entries(entry).some(([key, value]) => key !== "time" && Number.isFinite(value))
      ),
    [temperatureSeries]
  );
  const hasUsableScenarioTemperatureSeries = useMemo(
    () => hasUsableTemperatureSeries(scenarioTemperatureSeries),
    [scenarioTemperatureSeries]
  );
  const hasUsableScenarioSummary = useMemo(
    () => hasUsableScenarioSummarySeries(scenarioSummarySeries),
    [scenarioSummarySeries]
  );
  const hasUsableSensitivity = useMemo(
    () => hasUsableSensitivitySeries(sensitivitySeries),
    [sensitivitySeries]
  );
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
  const transientFrame = useMemo(
    () => (transientResult && transientResultUsable ? getTransientFrame(transientResult, transientSelectedTimeIndex) : null),
    [transientResult, transientResultUsable, transientSelectedTimeIndex]
  );
  const transientInnerSurfaceTemperature = transientFrame?.innerSurfaceTemperature_C ?? null;
  const transientOuterSurfaceTemperature = transientFrame?.outerSurfaceTemperature_C ?? null;
  const transientInnerSurfaceValue = formatSafeTemperature(transientInnerSurfaceTemperature);
  const transientOuterSurfaceValue = formatSafeTemperature(transientOuterSurfaceTemperature);
  const transientSurfaceStabilityLabel = transientResult?.stable ? "устойчивая схема" : "неустойчивая схема";
  const transientStatus = useMemo(() => {
    if (transientMissingData.length) {
      return {
        label: "Недостаточно данных",
        tone: "warning" as const,
      };
    }
    if (!transientResult) {
      return {
        label: "Расчет не запускался",
        tone: "neutral" as const,
      };
    }
    if (!transientResult.valid) {
      return {
        label: "Расчет недостоверен",
        tone: "critical" as const,
      };
    }
    if (!transientResult.stable) {
      return {
        label: "Схема неустойчива",
        tone: "critical" as const,
      };
    }
    return {
      label: "Расчет выполнен",
      tone: "good" as const,
    };
  }, [transientMissingData.length, transientResult]);
  const transientUncertaintyParameters = useMemo<TransientUncertaintyParameter[]>(() => {
    const parameters: TransientUncertaintyParameter[] = [];
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
    const values =
      transientMonteCarloResult?.samples
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
  const displayedTransientScenarioLabel = useMemo(
    () => formatTransientSampleViewModeLabel(transientDisplayedSampleMode),
    [transientDisplayedSampleMode]
  );
  const runDemoSp50 = useCallback(() => {
    try {
      const demoResult = demoRunSP50Calculation();
      startTransition(() => {
        setDemoSp50Result(demoResult);
        setActiveView("engineering");
        setResultsVisible(true);
      });
    } catch (err) {
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
      setTransientWarnings((current) =>
        current.length
          ? current
          : ["Добавьте стену, крышу или перекрытие со слоями, чтобы запустить вероятностный transient-расчет."]
      );
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
      const next = runTransientMonteCarlo(
        {
          baseScenarioId: scenario.id,
          constructionSourceId: selectedTransientTarget.sourceId,
          constructionSourceType: selectedTransientTarget.sourceType,
          samplesCount: Math.max(10, Math.round(transientMonteCarloSamplesCount)),
          seed: Math.round(transientMonteCarloSeed),
          parameters: transientUncertaintyParameters,
          comfortMin_C: transientComfortMinC,
          criticalSurfaceTemperature_C: transientCriticalSurfaceTemperatureC,
        },
        scenario,
        prepared.layers
      );
      setTransientMonteCarloResult(next);
      setTransientDisplayedSampleMode("base");
      setTransientWarnings((current) => dedupeWarningList([...current, ...prepared.warnings, ...next.warnings]));
      setTransientMissingData(prepared.missingData);
      setLastCalculatedAtIso(new Date().toISOString());
    } finally {
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
  const handleVisualizeTransientMonteCarloSample = useCallback(
    (mode: "worst" | "median" | "best") => {
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
    },
    [onRequestThermalModelView, selectedTransientTarget, transientMonteCarloResult]
  );
  return (
    <section data-testid="thermal-results-panel" className="ui-panel min-w-0 space-y-4 overflow-x-hidden overflow-y-visible p-4">
      {!resultsVisible ? (
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div
            data-testid="thermal-results-empty-state"
            className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-4 text-sm text-[color:var(--warning-fg)]"
          >
            <p className="font-semibold text-[color:var(--text-base)]">Тепловой расчёт ещё не запускался</p>
            <p className="mt-1 leading-6">
              Вкладка результатов открыта, но для этой модели пока нет сохранённого теплотехнического результата. Ниже доступны параметры расчёта и
              кнопка «Выполнить расчёт».
            </p>
          </div>
          <div className="ui-panel-muted min-w-0 p-4 sm:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Параметры расчёта</h3>
            <p className="mt-1 text-xs text-[color:var(--text-soft)]">Климат, уставки, теплопоступления и инженерные допущения.</p>
            <div className="mt-3 rounded-2xl border border-[color:var(--accent-base)]/20 bg-[color:var(--accent-muted)]/10 px-4 py-3 text-xs leading-6 text-[color:var(--text-muted)]">
              <p className="font-semibold text-[color:var(--text-base)]">Изменения влияют на следующий расчёт</p>
              <p className="mt-1">
                Изменение ACH, уставок, климатического сценария и инженерных коэффициентов меняет входы следующего прогона. Сохранённые результаты не
                пересчитываются автоматически: после правки параметров запустите расчёт заново.
              </p>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="ui-panel-muted min-w-0 rounded-2xl border border-[color:var(--border-soft)] p-3 md:col-span-2">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Длительность расчёта</p>
                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]">
                      Текущее значение: {formatThermalSimulationPeriodRu(options.duration)}. Используется в основном RC-контуре и Monte Carlo по зональной модели.
                      Допустимые значения: 24 часа или 7 суток. По умолчанию: {formatThermalSimulationPeriodRu(DEFAULT_THERMAL_OPTIONS.duration)}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateOptions({ duration: DEFAULT_THERMAL_OPTIONS.duration })}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]"
                  >
                    Сбросить
                  </button>
                </div>
                <div className="mt-3 inline-flex overflow-hidden rounded-full border border-[color:var(--border-soft)]">
                  {(["24h", "7d"] as const).map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => updateOptions({ duration })}
                      className={`px-3 py-1 text-[11px] font-semibold ${
                        options.duration === duration ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "text-[color:var(--text-muted)]"
                      }`}
                    >
                      {duration === "24h" ? "24 часа" : "7 дней"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="ui-panel-muted min-w-0 rounded-2xl border border-[color:var(--border-soft)] p-3 text-xs font-semibold text-[color:var(--text-muted)] md:col-span-2">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block min-w-0 whitespace-normal break-words leading-snug">Шаг по времени, мин</span>
                    <span className="mt-1 block text-[11px] font-normal leading-5 text-[color:var(--text-soft)]">
                      Текущее значение: {formatNumber(options.timestepMinutes ?? DEFAULT_THERMAL_OPTIONS.timestepMinutes ?? 10, { maximumFractionDigits: 0 })} мин.
                      Используется в явном шаге RC-интегратора. Допустимый набор: {TIMESTEP_CHOICES.join(", ")} мин. По умолчанию: {DEFAULT_THERMAL_OPTIONS.timestepMinutes ?? 10} мин.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateOptions({ timestepMinutes: DEFAULT_THERMAL_OPTIONS.timestepMinutes ?? 10 })}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]"
                  >
                    Сбросить
                  </button>
                </div>
                <select
                  value={options.timestepMinutes ?? 10}
                  onChange={(event) => updateOptions({ timestepMinutes: Number(event.target.value) })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
                >
                  {TIMESTEP_CHOICES.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice} мин
                    </option>
                  ))}
                </select>
              </label>

              <div className="ui-panel-muted min-w-0 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Уличный климат</p>
                <p className="mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]">
                  Синусоидальный сценарий наружной температуры для RC-модели. Это рабочий климатический профиль сценария, а не нормативная климатология СП 131.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <NumberInput
                    label="Базовая температура, °C"
                    value={options.outdoor.baseC}
                    step={0.5}
                    description="Средний уровень наружной температуры в сценарии."
                    usedIn="RC-модель, временные графики и Monte Carlo по зональной модели."
                    rangeHint="инженерно осмысленный климатический сценарий"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.outdoor.baseC} °C`}
                    onReset={() => updateOutdoor({ baseC: DEFAULT_THERMAL_OPTIONS.outdoor.baseC })}
                    onChange={(value) => updateOutdoor({ baseC: value })}
                  />
                  <NumberInput
                    label="Амплитуда, °C"
                    value={options.outdoor.amplitudeC}
                    step={0.5}
                    min={0}
                    description="Размах колебаний наружной температуры."
                    usedIn="RC-модель и климатическая вариативность."
                    rangeHint="не меньше 0"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.outdoor.amplitudeC} °C`}
                    onReset={() => updateOutdoor({ amplitudeC: DEFAULT_THERMAL_OPTIONS.outdoor.amplitudeC })}
                    onChange={(value) => updateOutdoor({ amplitudeC: value })}
                  />
                  <NumberInput
                    label="Сезонный сдвиг, °C"
                    value={options.outdoor.seasonalOffsetC ?? 0}
                    step={0.5}
                    description="Дополнительное смещение всего температурного профиля."
                    usedIn="RC-модель и чувствительность к выбранному климатическому сценарию."
                    rangeHint="допускается положительное и отрицательное смещение"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.outdoor.seasonalOffsetC ?? 0} °C`}
                    onReset={() => updateOutdoor({ seasonalOffsetC: DEFAULT_THERMAL_OPTIONS.outdoor.seasonalOffsetC ?? 0 })}
                    onChange={(value) => updateOutdoor({ seasonalOffsetC: value })}
                  />
                  <NumberInput
                    label="Фаза волны, ч"
                    value={options.outdoor.phaseShiftHours ?? 0}
                    step={1}
                    description="Сдвиг суточной температурной волны по времени."
                    usedIn="RC-модель при синусоидальном климатическом профиле."
                    rangeHint="значение в часах"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.outdoor.phaseShiftHours ?? 0} ч`}
                    onReset={() => updateOutdoor({ phaseShiftHours: DEFAULT_THERMAL_OPTIONS.outdoor.phaseShiftHours ?? 0 })}
                    onChange={(value) => updateOutdoor({ phaseShiftHours: value })}
                  />
                </div>
              </div>

              <div className="ui-panel-muted min-w-0 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Уставки</p>
                <p className="mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]">
                  Дневная и ночная температуры управляют идеальным догревом до уставки в основном RC-контуре. Это сценарная модель, а не гидравлический расчёт прибора по подаче и обратке.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <NumberInput
                    label="Дневная уставка, °C"
                    value={options.setpoints.day}
                    step={0.5}
                    description="Целевая температура в часы дневного режима."
                    usedIn="RC-модель и Monte Carlo по уставкам."
                    rangeHint="комфортная уставка для зоны"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.setpoints.day} °C`}
                    onReset={() => updateSetpoints({ day: DEFAULT_THERMAL_OPTIONS.setpoints.day })}
                    onChange={(value) => updateSetpoints({ day: value })}
                  />
                  <NumberInput
                    label="Ночная уставка, °C"
                    value={options.setpoints.night}
                    step={0.5}
                    description="Целевая температура в часы ночного режима."
                    usedIn="RC-модель и Monte Carlo по уставкам."
                    rangeHint="допустимо ночное понижение"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.setpoints.night} °C`}
                    onReset={() => updateSetpoints({ night: DEFAULT_THERMAL_OPTIONS.setpoints.night })}
                    onChange={(value) => updateSetpoints({ night: value })}
                  />
                  <NumberInput
                    label="Начало дня, ч"
                    value={options.setpoints.dayStartHour}
                    min={0}
                    max={23}
                    step={1}
                    description="Час перехода к дневной уставке."
                    usedIn="Расписание setpoint в RC-модели."
                    rangeHint="от 0 до 23 ч"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.setpoints.dayStartHour} ч`}
                    onReset={() => updateSetpoints({ dayStartHour: DEFAULT_THERMAL_OPTIONS.setpoints.dayStartHour })}
                    onChange={(value) => updateSetpoints({ dayStartHour: clampHour(value) })}
                  />
                  <NumberInput
                    label="Начало ночи, ч"
                    value={options.setpoints.nightStartHour}
                    min={0}
                    max={23}
                    step={1}
                    description="Час перехода к ночной уставке."
                    usedIn="Расписание setpoint в RC-модели."
                    rangeHint="от 0 до 23 ч"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.setpoints.nightStartHour} ч`}
                    onReset={() => updateSetpoints({ nightStartHour: DEFAULT_THERMAL_OPTIONS.setpoints.nightStartHour })}
                    onChange={(value) => updateSetpoints({ nightStartHour: clampHour(value) })}
                  />
                </div>
              </div>

              <div className="ui-panel-muted min-w-0 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Внутренние теплопоступления</p>
                <p className="mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]">
                  Удельные внутренние притоки подаются в RC-модель как сценарный фон. Они не заменяют более детальный разбор по людям, освещению и оборудованию в инженерном балансе.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <NumberInput
                    label="День, Вт/м²"
                    value={options.internalGains.dayGain_W_m2}
                    step={0.5}
                    description="Удельные дневные внутренние теплопоступления."
                    usedIn="RC-модель и Monte Carlo через множитель internal gains."
                    rangeHint="не меньше 0"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.internalGains.dayGain_W_m2} Вт/м²`}
                    onReset={() => updateGains({ dayGain_W_m2: DEFAULT_THERMAL_OPTIONS.internalGains.dayGain_W_m2 })}
                    onChange={(value) => updateGains({ dayGain_W_m2: Math.max(0, value) })}
                  />
                  <NumberInput
                    label="Ночь, Вт/м²"
                    value={options.internalGains.nightGain_W_m2}
                    step={0.5}
                    description="Удельные ночные внутренние теплопоступления."
                    usedIn="RC-модель и Monte Carlo через множитель internal gains."
                    rangeHint="не меньше 0"
                    defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.internalGains.nightGain_W_m2} Вт/м²`}
                    onReset={() => updateGains({ nightGain_W_m2: DEFAULT_THERMAL_OPTIONS.internalGains.nightGain_W_m2 })}
                    onChange={(value) => updateGains({ nightGain_W_m2: Math.max(0, value) })}
                  />
                </div>
              </div>

              <NumberInput
                label="Инфильтрация, ACH"
                value={options.infiltrationACH ?? 0.5}
                step={0.1}
                min={0}
                description="Эквивалентная кратность воздухообмена через инфильтрацию."
                usedIn="RC-модель и Monte Carlo через Ginf = ρ c ACH V / 3600."
                rangeHint="ACH не меньше 0"
                defaultValueLabel={`${DEFAULT_THERMAL_OPTIONS.infiltrationACH ?? 0.5} 1/ч`}
                onReset={() => updateOptions({ infiltrationACH: DEFAULT_THERMAL_OPTIONS.infiltrationACH ?? 0.5 })}
                onChange={(value) => updateOptions({ infiltrationACH: Math.max(0, value) })}
              />
              <div className="ui-panel-muted min-w-0 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Инженерная модель</p>
                <p className="mt-1 text-[11px] leading-5 text-[color:var(--text-soft)]">
                  Эти параметры питают инженерный квазистационарный баланс и аналитическое разложение потерь. Они не переписывают физику RC-ядра и применяются только при следующем расчёте.
                </p>
                <div className="mt-2 grid gap-2">
                  <label className="text-xs font-semibold text-[color:var(--text-muted)]">
                    Режим расчета
                    <select
                      value={engineeringOptions.mode}
                      onChange={(event) => updateEngineering({ mode: event.target.value as typeof engineeringOptions.mode })}
                      className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
                    >
                      <option value="quick">Быстрый расчет</option>
                      <option value="engineering">Детализированный расчет</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[color:var(--text-muted)]">
                    Анализируемый уровень
                    <select
                      value={engineeringOptions.targetLevelId ?? ""}
                      onChange={(event) => updateEngineering({ targetLevelId: event.target.value || null })}
                      className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
                    >
                      <option value="">Авто</option>
                      {model.levels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {getLevelDisplayLabel(model, level.id)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <NumberInput
                      label="Целевая температура, °C"
                      value={engineeringOptions.targetTemperatureC}
                      step={0.5}
                      description="Целевая внутренняя температура для инженерного баланса."
                      usedIn="Инженерный квазистационарный контур."
                      rangeHint="комфортная температура расчётного уровня"
                      defaultValueLabel={`${DEFAULT_ENGINEERING_OPTIONS.targetTemperatureC} °C`}
                      onReset={() => updateEngineering({ targetTemperatureC: DEFAULT_ENGINEERING_OPTIONS.targetTemperatureC })}
                      onChange={(value) => updateEngineering({ targetTemperatureC: value })}
                    />
                    <NumberInput
                      label="Вентиляция, ACH"
                      value={engineeringOptions.ventilationACH}
                      step={0.05}
                      min={0}
                      description="Кратность воздухообмена для инженерного баланса."
                      usedIn="Инженерный квазистационарный контур."
                      rangeHint="ACH не меньше 0"
                      defaultValueLabel={`${DEFAULT_ENGINEERING_OPTIONS.ventilationACH} 1/ч`}
                      onReset={() => updateEngineering({ ventilationACH: DEFAULT_ENGINEERING_OPTIONS.ventilationACH })}
                      onChange={(value) => updateEngineering({ ventilationACH: Math.max(0, value) })}
                    />
                    <NumberInput
                      label="Коэф. тепловой массы"
                      value={engineeringOptions.effectiveMassFactor}
                      step={0.1}
                      min={0.1}
                      description="Множитель эффективной теплоёмкости зоны."
                      usedIn="RC-модель и инженерное разложение по зонам."
                      rangeHint="больше 0"
                      defaultValueLabel={formatNumber(DEFAULT_ENGINEERING_OPTIONS.effectiveMassFactor, { maximumFractionDigits: 1 })}
                      onReset={() => updateEngineering({ effectiveMassFactor: DEFAULT_ENGINEERING_OPTIONS.effectiveMassFactor })}
                      onChange={(value) => updateEngineering({ effectiveMassFactor: Math.max(0.1, value) })}
                    />
                    <NumberInput
                      label="Освещение, Вт/м²"
                      value={engineeringOptions.lightingGain_W_m2}
                      step={0.1}
                      min={0}
                      description="Удельные теплопоступления от освещения."
                      usedIn="Инженерный квазистационарный баланс."
                      rangeHint="не меньше 0"
                      defaultValueLabel={`${DEFAULT_ENGINEERING_OPTIONS.lightingGain_W_m2} Вт/м²`}
                      onReset={() => updateEngineering({ lightingGain_W_m2: DEFAULT_ENGINEERING_OPTIONS.lightingGain_W_m2 })}
                      onChange={(value) => updateEngineering({ lightingGain_W_m2: Math.max(0, value) })}
                    />
                    <NumberInput
                      label="Занятость, Вт/м²"
                      value={engineeringOptions.occupancyGain_W_m2}
                      step={0.1}
                      min={0}
                      description="Удельное тепловыделение от людей."
                      usedIn="Инженерный квазистационарный баланс."
                      rangeHint="не меньше 0"
                      defaultValueLabel={`${DEFAULT_ENGINEERING_OPTIONS.occupancyGain_W_m2} Вт/м²`}
                      onReset={() => updateEngineering({ occupancyGain_W_m2: DEFAULT_ENGINEERING_OPTIONS.occupancyGain_W_m2 })}
                      onChange={(value) => updateEngineering({ occupancyGain_W_m2: Math.max(0, value) })}
                    />
                    <NumberInput
                      label="Множитель оборудования"
                      value={engineeringOptions.equipmentGainMultiplier}
                      step={0.05}
                      min={0}
                      description="Множитель пассивных теплопоступлений от оборудования."
                      usedIn="Инженерный квазистационарный баланс."
                      rangeHint="не меньше 0"
                      defaultValueLabel={formatNumber(DEFAULT_ENGINEERING_OPTIONS.equipmentGainMultiplier, { maximumFractionDigits: 2 })}
                      onReset={() => updateEngineering({ equipmentGainMultiplier: DEFAULT_ENGINEERING_OPTIONS.equipmentGainMultiplier })}
                      onChange={(value) => updateEngineering({ equipmentGainMultiplier: Math.max(0, value) })}
                    />
                    <NumberInput
                      label="Шаг сетки, м"
                      value={engineeringOptions.grid.cellSizeM}
                      step={0.05}
                      min={0.12}
                      description="Разрешение инженерной температурной карты."
                      usedIn="Инженерная визуализация, не основное ядро RC."
                      rangeHint="не меньше 0.12 м"
                      defaultValueLabel={`${formatNumber(DEFAULT_ENGINEERING_OPTIONS.grid.cellSizeM, { maximumFractionDigits: 2 })} м`}
                      onReset={() => updateEngineering({ grid: { ...engineeringOptions.grid, cellSizeM: DEFAULT_ENGINEERING_OPTIONS.grid.cellSizeM } })}
                      onChange={(value) => updateEngineering({ grid: { ...engineeringOptions.grid, cellSizeM: Math.max(0.12, value) } })}
                    />
                  </div>
                </div>
              </div>
              <div className="ui-panel-muted min-w-0 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Сценарий сравнения</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <NumberInput
                    label="ΔT наружного воздуха, °C"
                    value={engineeringOptions.scenarioDraft.outdoorDeltaC}
                    step={1}
                    onChange={(value) =>
                      updateEngineering({
                        scenarioDraft: { ...engineeringOptions.scenarioDraft, outdoorDeltaC: value },
                      })
                    }
                  />
                  <NumberInput
                    label="Scale U окна"
                    value={engineeringOptions.scenarioDraft.windowUScale}
                    step={0.05}
                    min={0.2}
                    onChange={(value) =>
                      updateEngineering({
                        scenarioDraft: { ...engineeringOptions.scenarioDraft, windowUScale: Math.max(0.2, value) },
                      })
                    }
                  />
                  <NumberInput
                    label="ΔR утепления, м²·К/Вт"
                    value={engineeringOptions.scenarioDraft.insulationResistanceDelta_m2K_W}
                    step={0.1}
                    min={0}
                    onChange={(value) =>
                      updateEngineering({
                        scenarioDraft: {
                          ...engineeringOptions.scenarioDraft,
                          insulationResistanceDelta_m2K_W: Math.max(0, value),
                        },
                      })
                    }
                  />
                  <NumberInput
                    label="Множитель вентиляции"
                    value={engineeringOptions.scenarioDraft.ventilationMultiplier}
                    step={0.05}
                    min={0.2}
                    onChange={(value) =>
                      updateEngineering({
                        scenarioDraft: { ...engineeringOptions.scenarioDraft, ventilationMultiplier: Math.max(0.2, value) },
                      })
                    }
                  />
                  <NumberInput
                    label="Множитель радиаторов"
                    value={engineeringOptions.scenarioDraft.radiatorPowerMultiplier}
                    step={0.05}
                    min={0.2}
                    onChange={(value) =>
                      updateEngineering({
                        scenarioDraft: { ...engineeringOptions.scenarioDraft, radiatorPowerMultiplier: Math.max(0.2, value) },
                      })
                    }
                  />
                  <NumberInput
                    label="Множитель оборудования"
                    value={engineeringOptions.scenarioDraft.equipmentGainMultiplier}
                    step={0.05}
                    min={0.2}
                    onChange={(value) =>
                      updateEngineering({
                        scenarioDraft: { ...engineeringOptions.scenarioDraft, equipmentGainMultiplier: Math.max(0.2, value) },
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <Tooltip
              className="mt-4 w-full"
              title="Детерминированный расчёт"
              description="Запускает многозонный RC-решатель с выбранными сетпоинтами, климатом и теплопритоками."
              details={[
                "Вход: RC граф (комнаты, стены), Δt (мин)",
                "Выход: T(t) °C, Q_hvac(t) кВт, KPI (энергия, комфорт)",
              ]}
              linkedFormulaIds={["thermal_balance", "envelope_heat_loss", "envelope_infiltration"]}
            >
              <button
                type="button"
                disabled={!canRun || running}
                onClick={handleRun}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-muted)] ${
                  !canRun || running ? "cursor-not-allowed bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]" : "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)] hover:brightness-110"
                }`}
              >
                {running ? "Считаю..." : "Выполнить расчёт"}
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={runDemoSp50}
              className="mt-2 w-full rounded-2xl border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]"
            >
              Проверка по СП
            </button>
            {demoSp50Result ? (
              <div className="mt-2 rounded-xl border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-3 py-2 text-xs text-[color:var(--success-fg)]">
                Загружен демонстрационный сценарий СП 50.13330.2024. Откройте инженерный режим для просмотра отчета.
              </div>
            ) : null}

            {!canRun && (
              <p className="mt-2 text-xs text-[color:var(--warning-fg)]">
                Добавьте хотя бы одно помещение, чтобы сформировать тепловую модель.
              </p>
            )}
            {error && (
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}
            {lastCalculatedAtIso ? (
              <p className="mt-2 text-xs text-[color:var(--text-soft)]">
                Последний расчет: {new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastCalculatedAtIso))}
              </p>
            ) : null}
          </div>

          <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Нестационарный расчет</h4>
                <p className="text-xs text-[color:var(--text-soft)]">1D теплопроводность через толщину стены, крыши или перекрытия.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneSurface(transientStatus.tone)}`}>
                {transientStatus.label}
              </span>
            </div>
            <div className="mt-3 grid gap-3">
              <label className="text-xs font-semibold text-[color:var(--text-muted)]">
                Сценарий
                <select
                  value={selectedTransientScenarioId}
                  onChange={(event) => setSelectedTransientScenarioId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
                >
                  {TRANSIENT_SCENARIO_PRESETS.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-[color:var(--text-muted)]">
                Конструкция
                <select
                  value={selectedTransientTarget?.id ?? ""}
                  onChange={(event) => setSelectedTransientConstructionId(event.target.value || null)}
                  className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
                >
                  {transientTargets.length ? (
                    transientTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))
                  ) : (
                    <option value="">Нет конструкций со слоями</option>
                  )}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <NumberInput label="Длительность, ч" value={transientDurationHours} step={1} min={1} onChange={setTransientDurationHours} />
                <NumberInput label="Шаг времени, с" value={transientTimeStepSeconds} step={1} min={1} onChange={setTransientTimeStepSeconds} />
                <NumberInput
                  label="Узлов на слой"
                  value={transientNodesPerLayer}
                  step={1}
                  min={1}
                  max={12}
                  onChange={(value) => setTransientNodesPerLayer(Math.max(1, Math.round(value)))}
                />
                <NumberInput label="Начальная t, °C" value={transientInitialTemperatureC} step={0.5} onChange={setTransientInitialTemperatureC} />
                <NumberInput label="Внутренняя t, °C" value={transientIndoorTemperatureC} step={0.5} onChange={setTransientIndoorTemperatureC} />
                <NumberInput label="Наружная t, °C" value={transientOutdoorTemperatureC} step={0.5} onChange={setTransientOutdoorTemperatureC} />
                <NumberInput
                  label="Наружная t финал, °C"
                  value={transientOutdoorEndTemperatureC}
                  step={0.5}
                  onChange={setTransientOutdoorEndTemperatureC}
                />
                <NumberInput
                  label="Пониженная внутренняя t, °C"
                  value={transientReducedIndoorTemperatureC}
                  step={0.5}
                  onChange={setTransientReducedIndoorTemperatureC}
                />
                <NumberInput
                  label="Температура восстановления, °C"
                  value={transientRestoredIndoorTemperatureC}
                  step={0.5}
                  onChange={setTransientRestoredIndoorTemperatureC}
                />
              </div>
              <button
                type="button"
                onClick={handleRunTransient}
                className="w-full rounded-2xl bg-[color:var(--accent-base)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:brightness-110"
              >
                Запустить сценарий
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h5 className="text-sm font-semibold text-[color:var(--text-base)]">Вероятностная оценка риска</h5>
                  <p className="text-xs text-[color:var(--text-soft)]">
                    Метод Монте-Карло многократно пересчитывает сценарий при изменении наружной температуры, теплопроводности,
                    внутренних теплопоступлений и начальной температуры в заданных пределах.
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                    Это помогает оценить не одно число, а диапазон возможных результатов и риск выхода ниже комфортного порога.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={transientMonteCarloEnabled}
                    onChange={(event) => setTransientMonteCarloEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-[color:var(--border-base)] text-[color:var(--text-base)]"
                  />
                  Включить анализ
                </label>
              </div>
              {transientMonteCarloEnabled ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
                    <NumberInput
                      label="Испытаний"
                      value={transientMonteCarloSamplesCount}
                      step={10}
                      min={10}
                      max={500}
                      onChange={(value) => setTransientMonteCarloSamplesCount(Math.max(10, Math.round(value)))}
                    />
                    <NumberInput
                      label="Seed"
                      value={transientMonteCarloSeed}
                      step={1}
                      onChange={(value) => setTransientMonteCarloSeed(Math.round(value))}
                    />
                    <NumberInput
                      label="Комфортный минимум, °C"
                      value={transientComfortMinC}
                      step={0.5}
                      onChange={setTransientComfortMinC}
                    />
                    <NumberInput
                      label="Критическая t поверхности, °C"
                      value={transientCriticalSurfaceTemperatureC}
                      step={0.5}
                      onChange={setTransientCriticalSurfaceTemperatureC}
                    />
                    <NumberInput
                      label="Наружная температура ±°C"
                      value={transientOutdoorOffsetC}
                      step={0.5}
                      min={0}
                      onChange={setTransientOutdoorOffsetC}
                    />
                    <NumberInput
                      label="Отопительная мощность ±%"
                      value={transientHeatingPowerVariationPercent}
                      step={1}
                      min={0}
                      onChange={setTransientHeatingPowerVariationPercent}
                    />
                    <NumberInput
                      label="Внутренние теплопоступления ±%"
                      value={transientInternalGainsVariationPercent}
                      step={1}
                      min={0}
                      onChange={setTransientInternalGainsVariationPercent}
                    />
                    <NumberInput
                      label="Теплопроводность ±%"
                      value={transientLambdaVariationPercent}
                      step={1}
                      min={0}
                      onChange={setTransientLambdaVariationPercent}
                    />
                    <NumberInput
                      label="Начальная температура ±°C"
                      value={transientInitialTemperatureOffsetC}
                      step={0.5}
                      min={0}
                      onChange={setTransientInitialTemperatureOffsetC}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRunTransientMonteCarlo}
                    disabled={transientMonteCarloRunning || !transientUncertaintyParameters.length}
                    className="w-full rounded-2xl bg-[color:var(--accent-base)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-contrast)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[color:var(--surface-strong)]"
                  >
                    {transientMonteCarloRunning ? "Расчет..." : "Запустить вероятностный расчет"}
                  </button>
                </div>
              ) : null}
            </div>
            {transientMissingData.length ? (
              <div className="mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)]">
                {transientMissingData.join(" ")}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Результаты расчёта</p>
              <h3 className="text-lg font-semibold text-[color:var(--text-base)]">Сводка и визуализации</h3>
            </div>
            <button
              type="button"
              onClick={() => setResultsVisible(false)}
              className="rounded-xl border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]"
            >
              Изменить параметры
            </button>
          </div>

          <div className="ui-panel-muted min-w-0 p-4 sm:p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Главные показатели</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Пик отопления (сумма по зонам), кВт"
                value={result ? formatNumber(result.summary.peakLoadKW, { maximumFractionDigits: 2 }) : "—"}
              />
              <KpiCard
                label="Энергия отопления за период, кВт·ч"
                value={result ? formatNumber(result.summary.totalEnergyKWh, { maximumFractionDigits: 1 }) : "—"}
              />
              <KpiCard
                label="Дискомфорт (сумма по зонам), ч"
                value={result ? formatNumber(result.summary.discomfortHours, { maximumFractionDigits: 1 }) : "—"}
              />
              <KpiCard
                label="Рабочая зона, °C"
                value={
                  engineeringResult
                    ? formatNumber(engineeringResult.comfort.occupiedMeanTemperatureC, { maximumFractionDigits: 1 })
                    : "—"
                }
              />
            </div>
          </div>

          {hasRcDiagnostics ? (
            <>
              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                <ChartCard
                  title="Теплопотери по компонентам"
                  subtitle="Разложение по категориям из result.diagnostics.building."
                  contentClassName="min-h-[320px]"
                >
                  <RcBuildingLossChart rows={rcLossBreakdownRows} />
                </ChartCard>
                <div className="ui-panel-muted min-w-0 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-[color:var(--text-base)] sm:text-base">Структура потерь</h3>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text-soft)] sm:text-sm">
                    Проценты показаны рядом с абсолютными значениями и не заменяют их.
                  </p>
                  <div className="mt-4 grid gap-3">
                    {rcLossBreakdownRows.map((row) => (
                      <div key={row.key} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-[color:var(--text-base)]">{row.label}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[color:var(--text-base)]">{formatRcPower(row.valueW)}</p>
                            <p className="text-xs text-[color:var(--text-soft)]">{formatRcPercent(row.sharePercent)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <ChartCard
                title="Диагностика по помещениям"
                subtitle="Требуемая тепловая мощность и разложение потерь по помещениям."
                contentClassName="min-h-[420px]"
              >
                <RcZoneLossChart rows={rcZoneDiagnosticsRows} />
              </ChartCard>

              <div className="ui-panel-muted min-w-0 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-[color:var(--text-base)] sm:text-base">Температурная матрица помещений</h3>
                <p className="mt-1 text-xs leading-5 text-[color:var(--text-soft)] sm:text-sm">
                  Для температуры, нагрузки и потерь используются отдельные колонки, чтобы не смешивать °C и Вт в одной оси.
                </p>
                <div className="mt-4">
                  <RcZoneHeatmapTable rows={rcZoneDiagnosticsRows} />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-4 text-sm text-[color:var(--text-muted)]">
              RC-диагностика по building и rooms в текущем result отсутствует. Доступны только базовые KPI и временные графики.
            </div>
          )}

          <div className="ui-panel-muted min-w-0 overflow-hidden p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Нестационарный расчёт — результаты</h4>
                <p className="text-xs text-[color:var(--text-soft)]">Графики и показатели по выбранной конструкции.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneSurface(transientStatus.tone)}`}>
                {transientStatus.label}
              </span>
            </div>
            {transientResult ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  title="Переключает отображение расчёта на 3D-модели."
                  onClick={() =>
                    setTransientVisualizationEnabled((prev) => {
                      const next = !prev;
                      if (next) onRequestThermalModelView?.();
                      return next;
                    })
                  }
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    transientVisualizationEnabled
                      ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
                      : "border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"
                  }`}
                >
                  {transientVisualizationEnabled ? "Скрыть на модели" : "Показать на модели"}
                </button>
                <button
                  type="button"
                  onClick={() => setTransientVisualizationEnabled(false)}
                  className="rounded-2xl border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  Сбросить визуализацию сценария
                </button>
              </div>
            ) : null}
            {transientMonteCarloResult ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <KpiCard
                          label="P(ниже комфорта)"
                          value={formatSafePercent(transientMonteCarloResult.summary.probabilityBelowComfort)}
                        />
                        <KpiCard
                          label="P(критическое охлаждение)"
                          value={formatSafePercent(transientMonteCarloResult.summary.probabilityBelowCriticalSurface)}
                        />
                        <KpiCard
                          label="Неустойчивые расчеты"
                          value={`${transientMonteCarloResult.summary.unstableSamplesCount} / ${transientMonteCarloResult.summary.samplesCount}`}
                          hint={`Валидные сценарии: ${transientMonteCarloResult.summary.validSamplesCount}`}
                        />
                        <KpiCard
                          label="P05 min τв"
                          value={formatSafeTemperature(transientMonteCarloResult.summary.p05MinTemperature)}
                          tone={Number.isFinite(transientMonteCarloResult.summary.p05MinTemperature) ? "neutral" : "warning"}
                        />
                        <KpiCard
                          label="P50 min τв"
                          value={formatSafeTemperature(transientMonteCarloResult.summary.p50MinTemperature)}
                          tone={Number.isFinite(transientMonteCarloResult.summary.p50MinTemperature) ? "neutral" : "warning"}
                        />
                        <KpiCard
                          label="P95 min τв"
                          value={formatSafeTemperature(transientMonteCarloResult.summary.p95MinTemperature)}
                          tone={Number.isFinite(transientMonteCarloResult.summary.p95MinTemperature) ? "neutral" : "warning"}
                        />
                      </div>
                      <div className="rounded-xl bg-[color:var(--surface-muted)] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm text-[color:var(--text-muted)]">
                            <div>
                              Худший сценарий: {formatSafeTemperature(transientMonteCarloResult.summary.worstCaseSample?.minInnerSurfaceTemperature_C ?? NaN)}
                            </div>
                            <div>
                              Сейчас отображается: <span className="font-semibold text-[color:var(--text-base)]">{displayedTransientScenarioLabel}</span>
                            </div>
                            <div>
                              Наиболее влияющий параметр: {formatSensitivityLabel(dominantTransientSensitivity?.parameterId)}
                              {dominantTransientSensitivity
                                ? ` (${formatSafeSignedNumber(dominantTransientSensitivity.correlationApprox, 2)})`
                                : ""}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleVisualizeTransientMonteCarloSample("worst")}
                              disabled={!transientMonteCarloResult.summary.worstCaseSample?.valid}
                              title={transientMonteCarloResult.summary.worstCaseSample?.valid ? "Открыть вкладку 3D, включить визуализацию и показать худший вероятностный сценарий на модели и в карточках." : "Худший вероятностный сценарий недоступен."}
                              className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                transientDisplayedSampleMode === "worst"
                                  ? "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]"
                                  : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)] hover:bg-[color:var(--danger-bg)]"
                              }`}
                            >
                              Показать худший сценарий на модели
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVisualizeTransientMonteCarloSample("median")}
                              disabled={!transientMonteCarloResult.summary.medianSample?.valid}
                              title={transientMonteCarloResult.summary.medianSample?.valid ? "Открыть вкладку 3D, включить визуализацию и показать медианный вероятностный сценарий на модели и в карточках." : "Медианный вероятностный сценарий недоступен."}
                              className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                transientDisplayedSampleMode === "median"
                                  ? "border-[color:var(--accent-base)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                                  : "border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"
                              }`}
                            >
                              Показать медианный сценарий на модели
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVisualizeTransientMonteCarloSample("best")}
                              disabled={!transientMonteCarloResult.summary.bestCaseSample?.valid}
                              title={transientMonteCarloResult.summary.bestCaseSample?.valid ? "Открыть вкладку 3D, включить визуализацию и показать лучший вероятностный сценарий на модели и в карточках." : "Лучший вероятностный сценарий недоступен."}
                              className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                transientDisplayedSampleMode === "best"
                                  ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
                                  : "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)] hover:brightness-95"
                              }`}
                            >
                              Показать лучший сценарий на модели
                            </button>
                          </div>
                        </div>
                        {transientMonteCarloHistogram.length ? (
                          <div className="mt-3 space-y-2">
                            <details className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
                              <summary className="cursor-pointer font-semibold text-[color:var(--text-muted)]">Зачем гистограмма</summary>
                              <p className="mt-2 leading-relaxed">
                                Числа P05 / P50 / P95 уже отражают хвост и середину выборки. Гистограмма дополнительно показывает форму
                                распределения минимальной температуры внутренней поверхности по устойчивым прогонам — удобно для пояснения
                                в ВКР. На сам расчёт конструкции она не влияет; если достаточно перцентилей, блок можно свернуть.
                                Кумулятивное распределение (CDF) для пиковой нагрузки здания выводится в отдельной панели «Вероятностная
                                оценка риска» (Monte Carlo по зональной модели).
                              </p>
                            </details>
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={transientMonteCarloHistogram} margin={{ left: 0, right: 12, top: 8, bottom: 28 }}>
                                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                                <XAxis
                                  dataKey="shortLabel"
                                  tick={{ fontSize: 11, fill: "#475569" }}
                                  interval={transientMonteCarloHistogramInterval}
                                  minTickGap={24}
                                  angle={-28}
                                  textAnchor="end"
                                  height={62}
                                />
                                <YAxis tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} tick={{ fontSize: 12, fill: "#475569" }} />
                                <RechartsTooltip
                                  formatter={(value: number) => formatSafePercent(Number(value))}
                                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullLabel ?? "Диапазон"}
                                />
                                <Bar dataKey="probability" name="Распределение min τв" fill="#2563eb" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-4 text-xs text-[color:var(--text-soft)]">
                            Распределение не построено: устойчивых и достоверных сценариев недостаточно для статистики P05/P50/P95.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
            {transientResult ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <KpiCard
                  label="Мин. t внутренней поверхности"
                  value={formatSafeTemperature(transientResult.minInnerSurfaceTemperature)}
                  tone={transientResultUsable ? "neutral" : "warning"}
                />
                <KpiCard
                  label="Макс. t внутренней поверхности"
                  value={formatSafeTemperature(transientResult.maxInnerSurfaceTemperature)}
                  tone={transientResultUsable ? "neutral" : "warning"}
                />
                <KpiCard
                  label="Текущее время, ч"
                  value={transientFrame ? formatSafeNumber(transientFrame.time_s / 3600, 2) : "н/д"}
                />
                <KpiCard
                  label="Устойчивость"
                  value={transientSurfaceStabilityLabel}
                  tone={transientResult.stable ? "good" : "warning"}
                />
                <KpiCard
                  label="τв, °C"
                  value={transientInnerSurfaceValue}
                />
                <KpiCard
                  label="τн, °C"
                  value={transientOuterSurfaceValue}
                />
              </div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-4">
          <ChartCard
            title="Нестационарная температура поверхности"
            subtitle="Внутренняя поверхность и наружное воздействие по времени для выбранной конструкции."
          >
            {transientSurfaceSeries.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={transientSurfaceSeries} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="time" tickFormatter={formatTimeLabel} tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis unit="°C" tick={{ fontSize: 12, fill: "#475569" }} domain={TRANSIENT_CHART_TEMPERATURE_DOMAIN} />
                  <RechartsTooltip content={<TemperatureTooltip />} />
                  <Legend />
                  <ReferenceLine y={transientIndoorTemperatureC} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="innerSurface" name="Внутренняя поверхность" stroke="#dc2626" strokeWidth={2.4} dot={false} />
                  <Line type="monotone" dataKey="outerSurface" name="Наружная поверхность" stroke="#0f766e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartPlaceholder message={buildTransientEmptyStateMessage(transientResult)} />
            )}
          </ChartCard>

          <ChartCard title="Наружная температура" subtitle="Граничное условие наружной стороны во времени.">
            {transientSurfaceSeries.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={transientSurfaceSeries} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="time" tickFormatter={formatTimeLabel} tick={{ fontSize: 12, fill: "#475569" }} />
                  <YAxis unit="°C" tick={{ fontSize: 12, fill: "#475569" }} domain={TRANSIENT_CHART_TEMPERATURE_DOMAIN} />
                  <RechartsTooltip content={<TemperatureTooltip />} />
                  <Line type="monotone" dataKey="outdoor" name="Наружный воздух" stroke="#2563eb" strokeWidth={2.2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartPlaceholder message={buildTransientEmptyStateMessage(transientResult)} />
            )}
          </ChartCard>

          <ChartCard
            title="Профиль температуры по толщине"
            subtitle={transientFrame ? `Срез на ${formatNumber(transientFrame.time_s / 3600, { maximumFractionDigits: 2 })} ч.` : "Температурное поле по узлам конструкции."}
            contentClassName="min-h-[320px]"
          >
            {transientResult && transientFrame && transientResultUsable ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-[color:var(--text-muted)]">
                  Временной индекс: {transientSelectedTimeIndex + 1} / {transientResult.time.length}
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, transientResult.time.length - 1)}
                    step={1}
                    value={Math.min(transientSelectedTimeIndex, Math.max(0, transientResult.time.length - 1))}
                    onChange={(event) => setTransientSelectedTimeIndex(Number(event.target.value))}
                    className="mt-2 w-full"
                  />
                </label>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={transientProfileSeries} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis dataKey="x_m" unit=" м" tick={{ fontSize: 12, fill: "#475569" }} />
                    <YAxis unit="°C" tick={{ fontSize: 12, fill: "#475569" }} domain={TRANSIENT_CHART_TEMPERATURE_DOMAIN} />
                    <RechartsTooltip content={<ProfileTooltip />} />
                    <Line type="monotone" dataKey="temperature_C" name="Температура" stroke="#7c3aed" strokeWidth={2.4} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-sm text-[color:var(--text-muted)]">{buildTransientConclusion(transientResult, transientFrame)}</p>
              </div>
            ) : (
              <ChartPlaceholder message={buildTransientEmptyStateMessage(transientResult)} />
            )}
          </ChartCard>

          {activeView !== "brief" ? (
            <>
              <ChartCard title="Температура по времени" subtitle="Показывает, как меняется температура в помещениях по сравнению с улицей">
                {hasUsableRoomTemperatureSeries ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={temperatureSeries} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                      <XAxis
                        dataKey="time"
                        tickFormatter={formatTimeLabel}
                        tick={{ fontSize: 12, fill: "#475569" }}
                      />
                      <YAxis
                        unit="°C"
                        tick={{ fontSize: 12, fill: "#475569" }}
                        domain={INDOOR_CHART_TEMPERATURE_DOMAIN}
                      />
                      <RechartsTooltip content={<TemperatureTooltip />} />
                      <Legend formatter={legendFormatter} />
                      <ReferenceLine y={options.setpoints.day} stroke="#f59e0b" strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        dataKey="outdoor"
                        stroke="#94a3b8"
                        strokeDasharray="6 6"
                        strokeWidth={2}
                        dot={false}
                        name="Улица"
                      />
                      {highlightedRooms.map((room, index) => (
                        <Line
                          key={room.id}
                          type="monotone"
                          dataKey={room.id}
                          stroke={ROOM_LINE_COLORS[index % ROOM_LINE_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          name={roomLabels[room.id] || `Помещение ${index + 1}`}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartPlaceholder message="Температурный график не построен: расчет не дал достоверных комнатных температур." />
                )}
              </ChartCard>

              <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
                <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Показатели по помещениям</h4>
                <p className="text-xs text-[color:var(--text-soft)]">
                  Энергия отопления за период {formatThermalSimulationPeriodRu(options.duration)}; «часы дискомфорта» по
                  зоне — время ниже уставки более чем на 0,05 °C (не календарные «часы здания»).
                </p>
                {roomSummaries.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full table-auto text-left text-sm text-[color:var(--text-muted)]">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                          <th className="py-2 pr-2 font-semibold">Помещение</th>
                          <th className="py-2 pr-2 font-semibold">Энергия, кВт·ч</th>
                          <th className="py-2 pr-2 font-semibold">Часы дискомфорта</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomSummaries.map((room) => (
                          <tr key={room.roomId} className="border-t border-[color:var(--border-soft)]">
                            <td className="max-w-[220px] break-words py-2 pr-2 font-medium text-[color:var(--text-base)]">
                              {getRoomDisplayName(model, room.roomId)}
                            </td>
                            <td className="py-2 pr-2">{formatEnergy(room.dailyEnergyKWh, "кВт·ч")}</td>
                            <td className="py-2 pr-2">{formatNumber(room.discomfortHours, { maximumFractionDigits: 1 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[color:var(--text-soft)]">Запустите расчёт, чтобы увидеть показатели помещений.</p>
                )}
              </div>
            </>
          ) : null}

          <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="inline-flex flex-wrap gap-2">
                {PANEL_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setActiveView(view.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeView === view.id ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)]"
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>

            {engineeringResult ? (
              <div className="mt-4 space-y-4">
                {presentation ? (
                  <>
                    <MetricInsightGrid metrics={presentation.metrics} />
                    <StatusStrip statuses={presentation.statuses} />
                  </>
                ) : null}

                {activeView === "brief" && (
                  <>
                    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                      <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Тепловая карта помещения</h4>
                            <p className="text-xs text-[color:var(--text-soft)]">
                              Поле строится из зональных температур и локальных поправок (ограждения, притоки) — наглядная
                              интерполяция, не CFD и не полевая CFD‑модель.
                            </p>
                          </div>
                          <div className="text-right text-xs text-[color:var(--text-soft)]">
                            <div>min {formatNumber(fieldView?.minTemperatureC, { maximumFractionDigits: 1 })} °C</div>
                            <div>max {formatNumber(fieldView?.maxTemperatureC, { maximumFractionDigits: 1 })} °C</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <HeatmapPanel field={fieldView} hover={heatmapHover} onHover={setHeatmapHover} roomLabels={roomLabels} />
                        </div>
                      </div>

                      <div className="min-w-0 space-y-4">
                        <TopLossesPanel data={heatLossSeries} />
                        <RecommendationPanel recommendations={presentation?.recommendations ?? []} />
                      </div>
                    </div>
                  </>
                )}

                {activeView === "detailed" && (
                  <>
                    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                      <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Тепловая карта помещения</h4>
                            <p className="text-xs text-[color:var(--text-soft)]">Показывает, где в помещении холоднее, теплее и где находятся проблемные зоны</p>
                          </div>
                          <div className="text-right text-xs text-[color:var(--text-soft)]">
                            <div>min {formatNumber(fieldView?.minTemperatureC, { maximumFractionDigits: 1 })} °C</div>
                            <div>max {formatNumber(fieldView?.maxTemperatureC, { maximumFractionDigits: 1 })} °C</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <HeatmapPanel field={fieldView} hover={heatmapHover} onHover={setHeatmapHover} roomLabels={roomLabels} />
                        </div>
                      </div>

                      <div className="min-w-0 space-y-4">
                        <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
                          <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Что это значит?</h4>
                          <p className="mt-2 text-sm text-[color:var(--text-muted)]">{engineeringResult.comfort.explanation}</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <MetricTile label="Рабочая зона" value={formatNumber(engineeringResult.comfort.occupiedMeanTemperatureC, { maximumFractionDigits: 1 })} unit="°C" compact />
                            <MetricTile label="Перепад температуры" value={formatNumber(engineeringResult.comfort.occupiedBandSpreadC, { maximumFractionDigits: 1 })} unit="°C" compact />
                            <MetricTile label="Температура цели" value={formatNumber(engineeringResult.comfort.targetTemperatureC, { maximumFractionDigits: 1 })} unit="°C" compact />
                            <MetricTile label="Комфортность" value={presentation?.statuses.comfort.status ?? formatComfortRating(engineeringResult.comfort.rating)} unit="" compact />
                          </div>
                        </div>
                        <RecommendationPanel recommendations={presentation?.recommendations ?? []} />
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                      <ChartCard title="Основные теплопотери" subtitle="Показывает, через какие элементы уходит основная часть тепла">
                        {heatLossSeries.length ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={heatLossSeries} margin={{ left: 0, right: 12, top: 8, bottom: 16 }}>
                              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} interval={0} angle={-18} textAnchor="end" height={60} />
                              <YAxis tick={{ fontSize: 12, fill: "#475569" }} />
                              <RechartsTooltip content={<BarTooltip unit="Вт" />} />
                              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {heatLossSeries.map((entry, index) => (
                                  <Cell key={`${entry.name}-${index}`} fill={ROOM_LINE_COLORS[index % ROOM_LINE_COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <ChartPlaceholder />
                        )}
                      </ChartCard>

                      <ChartCard title="Источники тепла" subtitle="Показывает, какие притоки участвуют в тепловом балансе помещения">
                        {gainSeries.length ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={gainSeries} margin={{ left: 0, right: 12, top: 8, bottom: 16 }}>
                              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} interval={0} angle={-18} textAnchor="end" height={60} />
                              <YAxis tick={{ fontSize: 12, fill: "#475569" }} />
                              <RechartsTooltip content={<BarTooltip unit="Вт" />} />
                              <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <ChartPlaceholder />
                        )}
                      </ChartCard>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
                      <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
                        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Ключевые зоны</h4>
                        <p className="text-xs text-[color:var(--text-soft)]">Показывает зоны охлаждения, перегрева и рабочую зону с объяснением причин</p>
                        <ZoneInsightPanel insights={zoneInsights} />
                      </div>

                      <ChartCard title="Прогноз температуры" subtitle="Показывает, как будет меняться температура при текущих условиях и мощности отопления">
                        {hasUsableScenarioTemperatureSeries ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={scenarioTemperatureSeries} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                              <XAxis dataKey="time" tick={{ fontSize: 12, fill: "#475569" }} />
                              <YAxis unit="°C" tick={{ fontSize: 12, fill: "#475569" }} domain={INDOOR_CHART_TEMPERATURE_DOMAIN} />
                              <RechartsTooltip content={<TemperatureTooltip />} />
                              <Legend wrapperStyle={{ fontSize: 11, maxHeight: 48, overflow: "hidden" }} />
                              {engineeringResult.scenarios.slice(0, 4).map((scenario, index) => (
                                <Line
                                  key={scenario.id}
                                  type="monotone"
                                  dataKey={shortenScenarioLabel(scenario.label)}
                                  stroke={ROOM_LINE_COLORS[index % ROOM_LINE_COLORS.length]}
                                  strokeWidth={2}
                                  dot={false}
                                  name={shortenScenarioLabel(scenario.label)}
                                />
                              ))}
                              <Line
                                type="monotone"
                                dataKey="outdoor"
                                stroke="#94a3b8"
                                strokeDasharray="6 6"
                                strokeWidth={2}
                                dot={false}
                                name="Температура наружного воздуха"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <ChartPlaceholder message="Прогноз температуры не показан: в сценариях нет достоверных комнатных температур в физически разумном диапазоне." />
                        )}
                      </ChartCard>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1fr,1fr]">
                      <ChartCard title="Сравнение сценариев" subtitle="Показывает, как изменится результат после изменения конструкции или режима работы">
                        {hasUsableScenarioSummary ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={scenarioSummarySeries} margin={{ left: 0, right: 12, top: 8, bottom: 16 }}>
                              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} interval={0} angle={-25} textAnchor="end" height={64} />
                              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#475569" }} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#475569" }} />
                              <RechartsTooltip content={<ScenarioSummaryTooltip />} />
                              <Legend wrapperStyle={{ fontSize: 11, maxHeight: 48, overflow: "hidden" }} />
                              <Bar yAxisId="left" dataKey="peak" name="Пиковая мощность, кВт" fill="#2563eb" radius={[8, 8, 0, 0]} minPointSize={6} />
                              <Bar yAxisId="right" dataKey="energy" name="Энергия, кВт·ч" fill="#ea580c" radius={[8, 8, 0, 0]} minPointSize={6} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <ChartPlaceholder message="Сценарии еще не рассчитаны или итоговые показатели недостоверны. Запустите расчет или выберите демонстрационный сценарий." />
                        )}
                      </ChartCard>

                      <ChartCard title="Чувствительность результата" subtitle="Локальная чувствительность по формуле S_x = (ΔY / Y) / (ΔX / X), рассчитанная конечным возмущением каждого параметра с полным пересчетом модели">
                        {hasUsableSensitivity ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={sensitivitySeries} layout="vertical" margin={{ left: 24, right: 12, top: 8, bottom: 4 }}>
                              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                              <XAxis type="number" tick={{ fontSize: 12, fill: "#475569" }} unit="%" domain={[-MAX_SENSITIVITY_PERCENT, MAX_SENSITIVITY_PERCENT]} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} width={130} />
                              <ReferenceLine x={0} stroke="#94a3b8" />
                              <RechartsTooltip content={<BarTooltip unit="%" />} />
                              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                {sensitivitySeries.map((entry, index) => (
                                  <Cell key={`${entry.name}-${index}`} fill={entry.value >= 0 ? "#b45309" : "#2563eb"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <ChartPlaceholder message="Чувствительность не показана: влияние параметров близко к нулю или базовый результат недостаточно устойчив для сравнения." />
                        )}
                      </ChartCard>
                    </div>
                  </>
                )}

                {activeView === "engineering" && (
                  <>
                    <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]"> 
                      <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
                        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Баланс тепла</h4>
                        <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
                          <BalanceRow label="Суммарные теплопотери" value={engineeringResult.balance.totalLossW} unit="Вт" />
                          <BalanceRow label="Пассивные притоки" value={engineeringResult.balance.passiveGainsW} unit="Вт" />
                          <BalanceRow label="Требуемая мощность отопления" value={engineeringResult.balance.requiredHeatingW} unit="Вт" emphasize />
                          <BalanceRow label="UA здания" value={engineeringResult.balance.totalUA_W_K} unit="Вт/К" />
                          <BalanceRow label="Эквивалентная теплоемкость" value={engineeringResult.balance.effectiveCapacitance_J_K} unit="Дж/К" />
                          <BalanceRow label="Пол" value={engineeringResult.balance.floorLossW} unit="Вт" />
                          <BalanceRow label="Покрытие" value={engineeringResult.balance.roofLossW} unit="Вт" />
                          <BalanceRow label="Окна" value={engineeringResult.balance.windowLossW} unit="Вт" />
                          <BalanceRow label="Стены" value={engineeringResult.balance.wallLossW} unit="Вт" />
                          <BalanceRow label="Инфильтрация" value={engineeringResult.balance.infiltrationLossW} unit="Вт" />
                          <BalanceRow label="Вентиляция" value={engineeringResult.balance.ventilationLossW} unit="Вт" />
                        </div>
                        {engineeringResult.balance.passiveGainsW > engineeringResult.balance.totalLossW ? (
                          <div className="mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)]">
                            Пассивные притоки превышают расчетные теплопотери, поэтому требуемая мощность отопления по текущему
                            балансу равна 0 Вт. Проверьте внутренние теплопоступления и режим эксплуатации.
                          </div>
                        ) : null}
                      </div>

                      <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
                        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Расчет ограждений</h4>
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-[520px] w-full table-fixed text-left text-sm text-[color:var(--text-muted)]">
                            <thead>
                              <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                                <th className="py-2 pr-2 font-semibold">Элемент</th>
                                <th className="py-2 pr-2 font-semibold">A, м²</th>
                                <th className="py-2 pr-2 font-semibold">U, Вт/(м²·К)</th>
                                <th className="py-2 pr-2 font-semibold">Q, Вт</th>
                              </tr>
                            </thead>
                            <tbody>
                              {engineeringResult.envelope.slice(0, 16).map((entry) => (
                                <tr key={entry.id} className="border-t border-[color:var(--border-soft)] align-top">
                                  <td className="py-2 pr-2">
                                    <div className="font-medium text-[color:var(--text-base)]">{entry.label}</div>
                                    <div className="text-xs text-[color:var(--text-soft)]">{entry.formulaBreakdown.substitution}</div>
                                  </td>
                                  <td className="py-2 pr-2">{formatArea(entry.areaM2)}</td>
                                  <td className="py-2 pr-2">{formatNumber(entry.uValue_W_m2K, { maximumFractionDigits: 2 })}</td>
                                  <td className="py-2 pr-2">{formatNumber(entry.heatFluxW, { maximumFractionDigits: 0 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {engineeringResult.sp50 ? (
                      <div className="space-y-4">
                        <ExpertiseReportExport
                          projectKey={projectKey}
                          model={model}
                          sp50Report={engineeringResult.sp50}
                          engineeringResult={engineeringResult}
                          thermalResult={result}
                          transientResult={transientResult}
                          transientWarnings={transientWarnings}
                          calculationTimestampIso={lastCalculatedAtIso}
                          scenarioLabel={options.duration === "7d" ? "7 суток" : "24 ч"}
                          climateBaseLabel={
                            model.thermalProtection?.climate?.city
                              ? `СП 131.13330.2025, ${model.thermalProtection.climate.city}`
                              : null
                          }
                        />
                        <Sp50Panel report={engineeringResult.sp50} />
                        <EconomicAssessmentPanelV2 report={engineeringResult.sp50} />
                      </div>
                    ) : null}
                    {demoSp50Result && !engineeringResult.sp50 ? (
                      <div className="space-y-3">
                        <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Проверка по СП 50.13330.2024</h4>
                              <p className="mt-1 text-sm text-[color:var(--text-muted)]">{demoSp50Result.engineeringConclusion}</p>
                            </div>
                          </div>
                        </div>
                        <ExpertiseReportExport
                          projectKey={projectKey}
                          model={model}
                          sp50Report={demoSp50Result.report}
                          thermalResult={result}
                          calculationTimestampIso={lastCalculatedAtIso}
                          scenarioLabel="Демонстрационный сценарий СП 50"
                          climateBaseLabel="СП 131.13330.2025 (демо)"
                        />
                        <Sp50Panel report={demoSp50Result.report} />
                        <EconomicAssessmentPanelV2
                          report={demoSp50Result.report}
                          initialScenario={demoVKRScenario.economicScenario}
                        />
                      </div>
                    ) : null}

                  </>
                )}

              </div>
            ) : demoSp50Result ? (
              <div className="mt-4 space-y-4">
                <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Демонстрационный сценарий</p>
                      <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Проверка по СП 50.13330.2024</h4>
                      <p className="mt-1 text-sm text-[color:var(--text-muted)]">{demoSp50Result.engineeringConclusion}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={exportDemoSp50Json}
                        className="rounded-xl border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
                      >
                        Экспорт JSON
                      </button>
                    </div>
                  </div>
                </div>
                <ExpertiseReportExport
                  projectKey={projectKey}
                  model={model}
                  sp50Report={demoSp50Result.report}
                  thermalResult={result}
                  calculationTimestampIso={lastCalculatedAtIso}
                  scenarioLabel="Демонстрационный сценарий СП 50"
                  climateBaseLabel="СП 131.13330.2025 (демо)"
                />
                <Sp50Panel report={demoSp50Result.report} />
                <EconomicAssessmentPanelV2
                  report={demoSp50Result.report}
                  initialScenario={demoVKRScenario.economicScenario}
                />
              </div>
            ) : (
              <EmptyStateCard
                title="Недостаточно данных для расчета"
                description="Запустите расчет, чтобы увидеть тепловую карту, потери тепла, сценарии и инженерные пояснения."
              />
            )}
          </div>
        </div>
        </div>
      )}
    </section>
  );
}

const NumberInput = ({
  label,
  value,
  step,
  min,
  max,
  description,
  usedIn,
  rangeHint,
  defaultValueLabel,
  onReset,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  description?: string;
  usedIn?: string;
  rangeHint?: string;
  defaultValueLabel?: string;
  onReset?: () => void;
  onChange: (value: number) => void;
}) => (
  <label className="min-w-0 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3 text-xs font-semibold text-[color:var(--text-muted)]">
    <span className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <span className="block min-w-0 flex-1 whitespace-normal break-words leading-snug">{label}</span>
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-[color:var(--border-soft)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]"
        >
          Сбросить
        </button>
      ) : null}
    </span>
    {description ? <span className="mt-1 block text-[11px] font-normal leading-5 text-[color:var(--text-soft)]">{description}</span> : null}
    {usedIn || rangeHint || defaultValueLabel ? (
      <span className="mt-1 block text-[10px] font-normal leading-5 text-[color:var(--text-soft)]">
        {[
          usedIn ? `Где используется: ${usedIn}` : null,
          rangeHint ? `Диапазон: ${rangeHint}` : null,
          defaultValueLabel ? `По умолчанию: ${defaultValueLabel}` : null,
        ]
          .filter(Boolean)
          .join(" • ")}
      </span>
    ) : null}
    <input
      type="number"
      value={value}
      onChange={(event) => {
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
      }}
      step={step ?? 0.1}
      min={min}
      max={max}
      className="mt-2 w-full min-w-0 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
    />
  </label>
);

const KpiCard = ({
  label,
  value,
  tone = "neutral",
  align = "center",
  hint,
}: {
  label: React.ReactNode;
  value: string;
  tone?: "neutral" | "good" | "warning" | "critical" | "info";
  align?: "center" | "left";
  hint?: string;
}) => (
  <div className={`min-w-0 max-w-full rounded-2xl border px-3 py-3 shadow-sm ${resolveKpiToneClass(tone)} ${align === "left" ? "text-left" : "text-center"}`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)] whitespace-normal break-words">{label}</p>
    <p className="mt-1 text-xl font-semibold text-[color:var(--text-base)] whitespace-normal break-words">{value}</p>
    {hint ? <p className="mt-1 text-xs text-[color:var(--text-soft)] whitespace-normal break-words">{hint}</p> : null}
  </div>
);

const RcBuildingLossChart = ({ rows }: { rows: RcLossBreakdownRow[] }) => {
  const data = rows.filter((row) => row.valueW !== null);
  if (!data.length) {
    return <ChartPlaceholder message="Теплопотери по компонентам не заданы." />;
  }

  return (
    <figure aria-labelledby="rc-building-loss-title" aria-describedby="rc-building-loss-desc">
      <figcaption id="rc-building-loss-title" className="sr-only">
        Теплопотери по компонентам
      </figcaption>
      <p id="rc-building-loss-desc" className="sr-only">
        Горизонтальная диаграмма показывает теплопотери через ограждения, окна, двери и инфильтрацию в ваттах.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 24, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#475569" }} tickFormatter={(value) => formatRcPowerAxis(Number(value))} />
          <YAxis dataKey="label" type="category" width={180} tick={{ fontSize: 11, fill: "#475569" }} />
          <RechartsTooltip content={<RcLossTooltip />} />
          <Bar dataKey="valueW" radius={[0, 8, 8, 0]}>
            {data.map((row) => (
              <Cell key={row.key} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
};

const RcZoneLossChart = ({ rows }: { rows: RcZoneDiagnosticsRow[] }) => {
  const data = rows.slice(0, 12).map((row) => ({
    ...row,
    lossOpaqueW: row.lossOpaqueW ?? 0,
    lossWindowW: row.lossWindowW ?? 0,
    lossDoorW: row.lossDoorW ?? 0,
    lossInfiltrationW: row.lossInfiltrationW ?? 0,
  }));
  if (!data.length) {
    return <ChartPlaceholder message="Нет помещений с доступным разложением потерь." />;
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 24, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#475569" }} tickFormatter={(value) => formatRcPowerAxis(Number(value))} />
          <YAxis dataKey="zoneName" type="category" width={180} tick={{ fontSize: 11, fill: "#475569" }} />
          <RechartsTooltip content={<RcZoneLossTooltip />} />
          <Legend />
          <Bar dataKey="lossOpaqueW" name="Ограждения" stackId="loss" fill="#0f766e" />
          <Bar dataKey="lossWindowW" name="Окна" stackId="loss" fill="#2563eb" />
          <Bar dataKey="lossDoorW" name="Двери" stackId="loss" fill="#f97316" />
          <Bar dataKey="lossInfiltrationW" name="Инфильтрация" stackId="loss" fill="#dc2626" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const RcZoneHeatmapTable = ({ rows }: { rows: RcZoneDiagnosticsRow[] }) => {
  if (!rows.length) {
    return <ChartPlaceholder message="Температурная матрица недоступна: нет room-level diagnostics." />;
  }
  const limitedRows = rows.slice(0, 18);
  const temperatureDomain = resolveRcDomain(limitedRows.map((row) => row.temperatureC));
  const loadDomain = resolveRcDomain(limitedRows.map((row) => row.heatingPowerW));
  const lossDomain = resolveRcDomain(limitedRows.map((row) => row.lossTotalW));

  return (
    <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]">
      <table className="w-full text-left text-sm text-[color:var(--text-muted)]">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
            <th className="px-4 py-3 font-semibold">Помещение</th>
            <th className="px-4 py-3 font-semibold">Температура, °C</th>
            <th className="px-4 py-3 font-semibold">Нагрузка, Вт</th>
            <th className="px-4 py-3 font-semibold">Потери, Вт</th>
            <th className="px-4 py-3 font-semibold">Статус</th>
          </tr>
        </thead>
        <tbody>
          {limitedRows.map((row) => (
            <tr key={row.zoneId} className="border-t border-[color:var(--border-soft)] align-top">
              <td className="px-4 py-3 font-semibold text-[color:var(--text-base)]">{row.zoneName}</td>
              <RcHeatCell value={row.temperatureC} domain={temperatureDomain} formatter={formatRcTemperature} />
              <RcHeatCell value={row.heatingPowerW} domain={loadDomain} formatter={formatRcPower} />
              <RcHeatCell value={row.lossTotalW} domain={lossDomain} formatter={(value) => formatRcPower(value)} />
              <td className="px-4 py-3 text-xs text-[color:var(--text-soft)]">{row.statusNote ?? "не задано"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RcHeatCell = ({
  value,
  domain,
  formatter,
}: {
  value: number | null;
  domain: [number, number] | null;
  formatter: (value: number | null) => string;
}) => {
  if (!Number.isFinite(value) || !domain) {
    return <td className="px-4 py-3 text-[color:var(--text-soft)]">не задано</td>;
  }
  return (
    <td className="px-4 py-3" style={{ backgroundColor: buildRcHeatColor(value as number, domain) }}>
      <span className="font-medium text-slate-900">{formatter(value)}</span>
    </td>
  );
};

const RcLossTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="ui-overlay max-w-[320px] px-3 py-2 text-xs text-[color:var(--text-muted)]">
      <p className="font-semibold text-[color:var(--text-base)]">{String(payload[0]?.payload?.label ?? "")}</p>
      <p className="mt-2">{formatRcPower(Number(payload[0]?.value ?? NaN))}</p>
      <p className="mt-1 text-[color:var(--text-soft)]">{formatRcPercent(Number(payload[0]?.payload?.sharePercent ?? NaN))}</p>
    </div>
  );
};

const RcZoneLossTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload?.length) {
    return null;
  }
  const zone = payload[0]?.payload as RcZoneDiagnosticsRow | undefined;
  return (
    <div className="ui-overlay max-w-[320px] px-3 py-2 text-xs text-[color:var(--text-muted)]">
      <p className="font-semibold text-[color:var(--text-base)]">{zone?.zoneName ?? ""}</p>
      <ul className="mt-2 space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-6">
            <span>{typeof entry.name === "string" ? entry.name : "Потери"}</span>
            <span>{formatRcPower(Number(entry.value ?? NaN))}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-[color:var(--border-soft)] pt-2 text-[color:var(--text-soft)]">
        <div>Температура: {formatRcTemperature(zone?.temperatureC ?? null)}</div>
        <div>Требуемая мощность: {formatRcPower(zone?.heatingPowerW ?? null)}</div>
        <div>Статус: {zone?.statusNote ?? "не задано"}</div>
      </div>
    </div>
  );
};

const MetricTile = ({
  label,
  value,
  unit,
  compact = false,
}: {
  label: string;
  value: string;
  unit: string;
  compact?: boolean;
}) => (
  <div className={`rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-3 shadow-sm ${compact ? "" : "min-h-[92px]"}`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">{label}</p>
    <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-2">
      <span className={`${compact ? "text-lg" : "text-2xl"} font-semibold text-[color:var(--text-base)]`}>{value}</span>
      {unit ? <span className="text-xs text-[color:var(--text-soft)]">{unit}</span> : null}
    </div>
  </div>
);

const MetricInsightGrid = ({ metrics }: { metrics: EngineeringMetricInsight[] }) => (
  <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
    {metrics.map((metric) => (
      <MetricInsightCard key={metric.id} metric={metric} />
    ))}
  </div>
);

const MetricInsightCard = ({ metric }: { metric: EngineeringMetricInsight }) => (
  <div className={`min-w-0 overflow-hidden rounded-2xl border px-4 py-4 shadow-sm ${toneSurface(metric.tone)}`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">{metric.label}</p>
    <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-2">
      <span className="break-words text-2xl font-semibold text-[color:var(--text-base)]">{metric.value}</span>
      {metric.unit ? <span className="text-xs text-[color:var(--text-soft)]">{metric.unit}</span> : null}
    </div>
    <p className="mt-2 text-sm text-[color:var(--text-muted)]">{metric.explanation}</p>
    {metric.target ? <p className="mt-2 text-xs text-[color:var(--text-soft)]">{metric.target}</p> : null}
  </div>
);

const StatusStrip = ({ statuses }: { statuses: EngineeringPresentationSummary["statuses"] }) => (
  <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
    <StatusCard status={statuses.comfort} />
    <StatusCard status={statuses.heating} />
    <StatusCard status={statuses.heatLoss} />
    <StatusCard status={statuses.uniformity} />
    <StatusCard status={statuses.reliability} />
  </div>
);

const StatusCard = ({ status }: { status?: EngineeringStatusSummary }) => {
  if (!status) {
    return null;
  }
  return (
    <div className={`min-w-0 overflow-hidden rounded-2xl border px-4 py-3 shadow-sm ${toneSurface(status.tone)}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">{status.label}</p>
      <div className="mt-2 text-lg font-semibold text-[color:var(--text-base)]">{status.status}</div>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">{status.explanation}</p>
    </div>
  );
};

const RecommendationPanel = ({ recommendations }: { recommendations: EngineeringRecommendation[] }) => (
  <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
    <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Что рекомендуется сделать</h4>
    <p className="text-xs text-[color:var(--text-soft)]">Только те действия, которые напрямую связаны с найденными проблемами</p>
    {recommendations.length ? (
      <div className="mt-3 space-y-2">
        {recommendations.map((item) => (
          <div key={item.id} className={`rounded-xl border px-3 py-3 ${toneSurface(item.tone)}`}>
            <div className="font-semibold text-[color:var(--text-base)]">{item.title}</div>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{item.explanation}</p>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-3 text-sm text-[color:var(--text-soft)]">Явных проблем, требующих корректирующих действий, не обнаружено.</p>
    )}
  </div>
);

const TopLossesPanel = ({ data }: { data: Array<{ name: string; value: number }> }) => (
  <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
    <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Основные теплопотери</h4>
    <p className="text-xs text-[color:var(--text-soft)]">Показывает, через какие элементы помещение теряет больше всего тепла</p>
    {data.length ? (
      <div className="mt-3 space-y-2">
        {data
          .slice()
          .sort((left, right) => right.value - left.value)
          .slice(0, 4)
          .map((entry) => (
            <div key={entry.name} className="flex items-center justify-between rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-muted)]">
              <span>{entry.name}</span>
              <span className="font-semibold text-[color:var(--text-base)]">{formatNumber(entry.value, { maximumFractionDigits: 0 })} Вт</span>
            </div>
          ))}
      </div>
    ) : (
      <p className="mt-3 text-sm text-[color:var(--text-soft)]">Недостаточно данных, чтобы оценить структуру теплопотерь.</p>
    )}
  </div>
);

const EmptyStateCard = ({ title, description }: { title: string; description: string }) => (
  <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-5">
    <div className="text-sm font-semibold text-[color:var(--text-base)]">{title}</div>
    <p className="mt-2 text-sm text-[color:var(--text-soft)]">{description}</p>
  </div>
);

const toneSurface = (tone: EngineeringStatusSummary["tone"] | EngineeringRecommendation["tone"] | EngineeringMetricInsight["tone"]) => {
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

const resolveKpiToneClass = (tone: "neutral" | "good" | "warning" | "critical" | "info") => {
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

const BalanceRow = ({
  label,
  value,
  unit,
  emphasize = false,
  maximumFractionDigits = 0,
}: {
  label: string;
  value: number | string | null | undefined;
  unit: string;
  emphasize?: boolean;
  maximumFractionDigits?: number;
}) => (
  <div className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2 ${emphasize ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "bg-[color:var(--surface-muted)]"}`}>
    <span className="min-w-0 whitespace-normal break-words">{label}</span>
    <span className="min-w-0 break-words text-right font-semibold">
      {typeof value === "string" ? value : formatNumber(value, { maximumFractionDigits })} {unit}
    </span>
  </div>
);

const ChartCard = ({
  title,
  subtitle,
  contentClassName,
  children,
}: {
  title: string;
  subtitle: string;
  contentClassName?: string;
  children: React.ReactNode;
}) => (
  <div className="ui-panel-muted min-w-0 max-w-full p-4 sm:p-5">
    <h3 className="text-sm font-semibold text-[color:var(--text-base)] sm:text-base">{title}</h3>
    <p className="mt-1 text-xs leading-5 text-[color:var(--text-soft)] sm:text-sm">{subtitle}</p>
    <div className={`mt-4 w-full min-w-0 max-w-full overflow-x-auto overflow-y-visible ${contentClassName ?? "min-h-[280px]"}`}>{children}</div>
  </div>
);

const ChartPlaceholder = ({
  message = "Недостаточно данных для визуализации. Запустите расчёт или уточните входные параметры.",
}: {
  message?: string;
}) => (
  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-sm text-[color:var(--text-soft)]">
    <span className="max-w-xl whitespace-normal break-words px-4 text-center">{message}</span>
  </div>
);

const TemperatureTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload || !payload.length) {
    return null;
  }
  const title = typeof label === "number" ? formatTimeLabel(Number(label)) : String(label ?? "—");
  return (
    <div className="ui-overlay max-w-[280px] px-3 py-2 text-xs text-[color:var(--text-muted)] shadow-lg">
      <p className="font-semibold text-[color:var(--text-base)]">{title}</p>
      <ul className="mt-2 space-y-1">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center justify-between gap-6 rounded-lg bg-[color:var(--surface-muted)] px-2 py-1">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? "#0f172a" }} />
              {entry.name}
            </span>
            <span>{formatSafeTemperature(Number(entry.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ProfileTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="ui-overlay max-w-[280px] px-3 py-2 text-xs text-[color:var(--text-muted)]">
      <p className="font-semibold">{formatNumber(Number(label), { maximumFractionDigits: 3 })} м</p>
      <ul className="mt-2 space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-6">
            <span>{getChartMetricLabel(entry, "Значение")}</span>
            <span>{formatSafeTemperature(Number(entry.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CHART_METRIC_LABELS: Record<string, string> = {
  value: "Значение",
  heatLoss: "Теплопотери",
  loss: "Теплопотери",
  energy: "Энергия",
  payback: "Срок окупаемости",
  cost: "Стоимость",
  saving: "Экономия",
  peak: "Пиковая мощность",
};

const getChartMetricLabel = (entry: { name?: unknown; dataKey?: unknown }, fallback: string) => {
  const rawName = typeof entry.name === "string" ? entry.name.trim() : "";
  if (rawName && rawName.toLowerCase() !== "value") {
    return rawName;
  }
  const dataKey = typeof entry.dataKey === "string" ? entry.dataKey : "";
  return CHART_METRIC_LABELS[dataKey] ?? fallback;
};

const BarTooltip = ({ active, payload, label, unit }: TooltipProps<ValueType, NameType> & { unit: string }) => {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="ui-overlay max-w-[280px] px-3 py-2 text-xs text-[color:var(--text-muted)]">
      {label ? <p className="font-semibold">{String(label)}</p> : null}
      <ul className="mt-2 space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-6">
            <span>{getChartMetricLabel(entry, "Значение")}</span>
            <span>
              {unit === "%" ? formatSafePercent(Number(entry.value) / 100) : formatSafeNumber(Number(entry.value), 2)} {unit === "%" ? "" : unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ScenarioSummaryTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="ui-overlay max-w-[280px] px-3 py-2 text-xs text-[color:var(--text-muted)]">
      <p className="font-semibold">{String(label)}</p>
      <ul className="mt-2 space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-6">
            <span>{getChartMetricLabel(entry, entry.dataKey === "peak" ? "Пиковая мощность" : "Энергия")}</span>
            <span>
              {formatSafeNumber(Number(entry.value), 2)} {entry.dataKey === "peak" ? "кВт" : "кВт·ч"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const HeatmapPanel = ({
  field,
  hover,
  onHover,
  roomLabels,
}: {
  field: EngineeringFieldResult | null;
  hover: { x: number; y: number; temperatureC: number; roomId: string; roomLabel: string } | null;
  onHover: (value: { x: number; y: number; temperatureC: number; roomId: string; roomLabel: string } | null) => void;
  roomLabels: Record<string, string>;
}) => {
  if (!field?.cells.length) {
    return <ChartPlaceholder />;
  }
  const cellSize = field.kind === "detailed" ? 18 : 24;
  const width = Math.max((field.cols || 1) * cellSize, 320);
  const height = Math.max((field.rows || 1) * cellSize, 180);
  return (
    <div className="space-y-3">
      <div className="ui-scroll max-w-full overflow-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2">
        <svg width={width} height={height} className="block max-w-none">
          {field.cells.map((cell) => (
            <rect
              key={`${cell.row}-${cell.col}-${cell.roomId}`}
              x={cell.col * cellSize}
              y={cell.row * cellSize}
              width={cellSize}
              height={cellSize}
              rx={3}
              fill={getHeatmapColor(cell.temperatureC, field.minTemperatureC, field.maxTemperatureC)}
              stroke="rgba(255,255,255,0.22)"
              onMouseEnter={() =>
                onHover({
                  x: cell.x,
                  y: cell.y,
                  temperatureC: cell.temperatureC,
                  roomId: cell.roomId,
                  roomLabel: roomLabels[cell.roomId] ?? "Помещение",
                })
              }
              onMouseLeave={() => onHover(null)}
            />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--text-soft)]">
        <div className="flex items-center gap-2">
          {HEATMAP_COLORS.map((color) => (
            <span key={color} className="h-2.5 w-8 rounded-full" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span>
          {formatNumber(field.minTemperatureC, { maximumFractionDigits: 1 })} °C .. {formatNumber(field.maxTemperatureC, { maximumFractionDigits: 1 })} °C
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Сетка
          <div className="font-semibold text-[color:var(--text-base)]">
            {field.rows} × {field.cols}
          </div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Шаг сетки
          <div className="font-semibold text-[color:var(--text-base)]">{formatNumber(field.cellSizeM, { maximumFractionDigits: 2 })} м</div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Итерации
          <div className="font-semibold text-[color:var(--text-base)]">{field.iterations}</div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Сходимость
          <div className="font-semibold text-[color:var(--text-base)]">{field.converged ? "достигнута" : "ограничена"}</div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Невязка
          <div className="font-semibold text-[color:var(--text-base)]">{formatNumber(field.residualC, { maximumFractionDigits: 4 })} °C</div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Критерий
          <div className="font-semibold text-[color:var(--text-base)]">max |ΔT| ≤ {formatNumber(field.toleranceC, { maximumFractionDigits: 3 })} °C</div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Метод
          <div className="font-semibold text-[color:var(--text-base)]">Итерационный Gauss–Seidel</div>
        </div>
      </div>
      {hover ? (
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          {hover.roomLabel} · ({formatNumber(hover.x, { maximumFractionDigits: 2 })}; {formatNumber(hover.y, { maximumFractionDigits: 2 })}) м:{" "}
          <span className="font-semibold text-[color:var(--text-base)]">{formatNumber(hover.temperatureC, { maximumFractionDigits: 1 })} °C</span>
        </div>
      ) : null}
    </div>
  );
};

const clampHour = (value: number): number => {
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

const formatTimeLabel = (timeHours: number): string => {
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

const formatComfortRating = (rating: EngineeringAnalysisResult["comfort"]["rating"]): string => {
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

const ZONE_GROUPS: Array<{ key: EngineeringZoneInsight["category"]; label: string }> = [
  { key: "cold", label: "Холодные зоны" },
  { key: "hot", label: "Перегретые зоны" },
  { key: "occupied", label: "Рабочая зона" },
  { key: "wall", label: "У наружных стен" },
  { key: "window", label: "У окон" },
  { key: "heating", label: "У приборов отопления" },
];

const ZoneInsightPanel = ({ insights }: { insights: EngineeringZoneInsight[] }) => {
  if (!insights.length) {
    return <div className="mt-3 text-sm text-[color:var(--text-soft)]">Запустите расчёт, чтобы выделить инженерно значимые зоны.</div>;
  }

  return (
    <div className="mt-3 space-y-3">
      {ZONE_GROUPS.map((group) => {
        const groupItems = insights.filter((entry) => entry.category === group.key);
        if (!groupItems.length) {
          return null;
        }
        return (
          <div key={group.key} className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">{group.label}</div>
            <div className="mt-2 space-y-2">
              {groupItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[color:var(--text-base)]">{item.title}</div>
                      <div className="text-xs text-[color:var(--text-soft)]">{item.roomName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[color:var(--text-base)]">{formatNumber(item.temperatureC, { maximumFractionDigits: 1 })} °C</div>
                      <div className={`text-xs ${item.deltaFromAverageC >= 0 ? "text-[color:var(--warning-fg)]" : "text-[color:var(--info-fg)]"}`}>
                        {item.deltaFromAverageC >= 0 ? "+" : ""}
                        {formatNumber(item.deltaFromAverageC, { maximumFractionDigits: 1 })} °C
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-[color:var(--text-soft)]">
                    <div>
                      Координата центра: ({formatNumber(item.x, { maximumFractionDigits: 1 })}; {formatNumber(item.y, { maximumFractionDigits: 1 })}) м
                    </div>
                    <div>Причина: {item.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const getHeatmapColor = (value: number, min: number, max: number): string => {
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

const interpolateColor = (from: string, to: string, mix: number): string => {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const red = Math.round(start.r + (end.r - start.r) * mix);
  const green = Math.round(start.g + (end.g - start.g) * mix);
  const blue = Math.round(start.b + (end.b - start.b) * mix);
  return `rgb(${red}, ${green}, ${blue})`;
};

const formatRcPower = (valueW: number | null | undefined): string => {
  if (!Number.isFinite(valueW)) {
    return "не задано";
  }
  const value = valueW as number;
  if (Math.abs(value) >= 1000) {
    return `${formatNumber(value / 1000, { maximumFractionDigits: 1 })} кВт`;
  }
  return `${formatNumber(value, { maximumFractionDigits: 0 })} Вт`;
};

const formatRcPowerAxis = (valueW: number): string => {
  if (!Number.isFinite(valueW)) {
    return "—";
  }
  if (Math.abs(valueW) >= 1000) {
    return `${formatNumber(valueW / 1000, { maximumFractionDigits: 1 })} кВт`;
  }
  return formatNumber(valueW, { maximumFractionDigits: 0 });
};

const formatRcPercent = (value: number | null | undefined): string => {
  if (!Number.isFinite(value)) {
    return "не задано";
  }
  return `${formatNumber(value, { maximumFractionDigits: 1 })} %`;
};

const formatRcTemperature = (value: number | null | undefined): string => {
  if (!Number.isFinite(value)) {
    return "не задано";
  }
  return `${formatNumber(value, { maximumFractionDigits: 1 })} °C`;
};

const resolveRcDomain = (values: Array<number | null | undefined>): [number, number] | null => {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (!finite.length) {
    return null;
  }
  return [Math.min(...finite), Math.max(...finite)];
};

const buildRcHeatColor = (value: number, domain: [number, number]): string => {
  const [min, max] = domain;
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return "rgba(203, 213, 225, 0.2)";
  }
  return `${getHeatmapColor(value, min, Math.max(max, min + 1e-6))}99`;
};

const hexToRgb = (hex: string) => {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
};

const hashThermalOptions = (options: ThermalSimulationOptions): string =>
  JSON.stringify({
    duration: options.duration,
    timestepMinutes: options.timestepMinutes,
    outdoor: options.outdoor,
    setpoints: options.setpoints,
    internalGains: options.internalGains,
    infiltrationACH: options.infiltrationACH,
    engineering: options.engineering,
  });

const dedupeWarningList = (warnings: string[]): string[] => Array.from(new Set(warnings.filter(Boolean)));

const downloadTextFile = (content: string, filename: string, mime: string) => {
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

const hashModelGeometry = (model: BuildingModel): string => {
  const encodeRooms = model.rooms
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((room) => `${room.id}:${room.levelId}:${room.polygon.map((point) => `${point.x.toFixed(2)}_${point.y.toFixed(2)}`).join(",")}`)
    .join("|");
  const encodeWalls = model.walls
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (wall) =>
        `${wall.id}:${wall.levelId}:${wall.a.x.toFixed(2)}_${wall.a.y.toFixed(2)}:${wall.b.x.toFixed(2)}_${wall.b.y.toFixed(2)}:${wall.thickness_m.toFixed(2)}:${wall.height_m.toFixed(2)}:${
          wall.wallAssemblyId ?? "na"
        }`
    )
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

const TRANSIENT_CHART_TEMPERATURE_DOMAIN: [number, number] = [-60, 80];
const INDOOR_CHART_TEMPERATURE_DOMAIN: [number, number] = [-20, 40];
const MAX_SENSITIVITY_PERCENT = 300;

export function isTrustworthyTemperatureValue(value: number | null | undefined): boolean {
  return Number.isFinite(value) && Math.abs(value as number) <= 200;
}

function sanitizeChartTemperature(value: number | null | undefined): number | null {
  return isTrustworthyTemperatureValue(value) ? Number(value) : null;
}

export function sanitizeIndoorChartTemperature(value: number | null | undefined): number | null {
  return Number.isFinite(value) && Number(value) >= -20 && Number(value) <= 60 ? Number(value) : null;
}

function sanitizeChartMagnitude(value: number | null | undefined): number | null {
  return Number.isFinite(value) && Math.abs(value as number) <= 1e6 ? Number(value) : null;
}

export function formatSafeTemperature(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "н/д";
  }
  if (Math.abs(value as number) > 200) {
    return "расчет неустойчив";
  }
  return `${formatNumber(value, { maximumFractionDigits: 1 })} °C`;
}

export function formatSafeNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) {
    return "н/д";
  }
  if (Math.abs(value as number) > 1e6) {
    return "н/д";
  }
  return formatNumber(value, { maximumFractionDigits });
}

function formatSafeSignedNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) {
    return "н/д";
  }
  const sign = (value as number) > 0 ? "+" : "";
  return `${sign}${formatSafeNumber(value, maximumFractionDigits)}`;
}

export function formatSafePercent(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "н/д";
  }
  const percentValue = Number(value) * 100;
  if (Math.abs(percentValue) > 300) {
    return "за пределами шкалы";
  }
  return `${formatNumber(percentValue, { maximumFractionDigits: 1 })}%`;
}

function clampSensitivityPercent(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-MAX_SENSITIVITY_PERCENT, Math.min(MAX_SENSITIVITY_PERCENT, Number(value)));
}

export function hasUsableScenarioSummarySeries(
  data: Array<{ peak: number | null; energy: number | null }>
): boolean {
  return data.some((entry) => entry.peak !== null || entry.energy !== null);
}

export function hasUsableTemperatureSeries(data: Array<Record<string, string | number | null>>): boolean {
  return data.some((entry) => Object.entries(entry).some(([key, value]) => key !== "time" && value !== null));
}

export function hasUsableSensitivitySeries(
  data: Array<{ value: number; impact: number; isClipped?: boolean }>
): boolean {
  return data.some((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.impact) && entry.impact > 0.001);
}

export function shortenScenarioLabel(label: string): string {
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

export function formatTransientSampleViewModeLabel(mode: TransientSampleViewMode): string {
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

export function formatHistogramBinLabel(start: number, end: number): string {
  const left = formatNumber(start, { maximumFractionDigits: 1 });
  const right = formatNumber(end, { maximumFractionDigits: 1 });
  return start === end ? left : `${left}–${right}`;
}

export function selectTransientSampleByMode(
  result: TransientMonteCarloResult | null,
  mode: "worst" | "median" | "best"
) {
  return getTransientMonteCarloVisualizationSample(result, mode);
}

function shortenSensitivityLabel(label: string): string {
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

function formatSensitivityLabel(value: string | null | undefined): string {
  if (!value) {
    return "н/д";
  }
  return shortenSensitivityLabel(value);
}

function buildTransientEmptyStateMessage(result: TransientCalculationResult | null): string {
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

export const buildTransientConclusion = (
  result: TransientCalculationResult,
  frame: ReturnType<typeof getTransientFrame> | null
): string => {
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
  const trend =
    result.innerSurfaceTemperature[result.innerSurfaceTemperature.length - 1] >= result.innerSurfaceTemperature[0]
      ? "восстанавливается"
      : "остывает";
  return `Внутренняя поверхность ${trend}: ${formatSafeTemperature(inner)} на выбранном шаге, наружная поверхность ${formatSafeTemperature(
    outer
  )}. Минимум по внутренней стороне за сценарий ${formatSafeTemperature(result.minInnerSurfaceTemperature)}.`;
};

const EconomicAssessmentPanel = ({
  report,
  initialScenario,
}: {
  report: Sp50ComplianceReport;
  initialScenario?: EconomicScenario;
}) => {
  const baseScenario = useMemo(() => initialScenario ?? buildDefaultEconomicScenario(report), [initialScenario, report]);
  const [heatPrice, setHeatPrice] = useState(baseScenario.tariff.heatPrice_RUB_kWh);
  const [discountRatePercent, setDiscountRatePercent] = useState((baseScenario.discountRate ?? 0.1) * 100);
  const [analysisPeriodYears, setAnalysisPeriodYears] = useState(baseScenario.analysisPeriod_years);

  useEffect(() => {
    setHeatPrice(baseScenario.tariff.heatPrice_RUB_kWh);
    setDiscountRatePercent((baseScenario.discountRate ?? 0.1) * 100);
    setAnalysisPeriodYears(baseScenario.analysisPeriod_years);
  }, [baseScenario]);

  const scenario = useMemo<EconomicScenario>(
    () => ({
      ...baseScenario,
      tariff: {
        ...baseScenario.tariff,
        heatPrice_RUB_kWh: heatPrice,
      },
      discountRate: discountRatePercent / 100,
      analysisPeriod_years: analysisPeriodYears,
    }),
    [analysisPeriodYears, baseScenario, discountRatePercent, heatPrice]
  );

  const assessment = useMemo<EconomicAssessmentResult>(() => runEconomicAssessment(report, scenario), [report, scenario]);

  return (
    <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Экономическая оценка</h4>
          <p className="mt-1 text-xs text-[color:var(--text-soft)]">
            Стоимость мероприятий, оценка годовой экономии тепловой энергии и простая NPV-модель без изменения нормативного расчета.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs text-[color:var(--text-soft)]">
            Тариф, ₽/кВт·ч
            <input
              type="number"
              min={0}
              step="0.1"
              value={heatPrice}
              onChange={(event) => setHeatPrice(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
          <label className="text-xs text-[color:var(--text-soft)]">
            Ставка, %
            <input
              type="number"
              min={0}
              step="0.5"
              value={discountRatePercent}
              onChange={(event) => setDiscountRatePercent(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
          <label className="text-xs text-[color:var(--text-soft)]">
            Период, лет
            <input
              type="number"
              min={1}
              step="1"
              value={analysisPeriodYears}
              onChange={(event) => setAnalysisPeriodYears(Math.max(1, Math.round(Number(event.target.value) || 1)))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Стоимость" value={formatCurrency(assessment.summary.totalCost_RUB)} tone="warning" align="left" />
        <KpiCard
          label="Экономия"
          value={formatNumber(assessment.summary.totalSavedEnergy_kWh_year, { maximumFractionDigits: 0 })}
          hint="кВт·ч/год"
          tone="good"
          align="left"
        />
        <KpiCard label="Экономия, ₽/год" value={formatCurrency(assessment.summary.totalAnnualSaving_RUB)} tone="info" align="left" />
        <KpiCard
          label="Окупаемость"
          value={assessment.summary.simplePayback_years === null ? "—" : `${formatNumber(assessment.summary.simplePayback_years, { maximumFractionDigits: 1 })} г`}
          tone={assessment.summary.simplePayback_years !== null && assessment.summary.simplePayback_years <= 8 ? "good" : "warning"}
          align="left"
        />
        <KpiCard label="NPV" value={formatCurrency(assessment.summary.npv_RUB)} tone="info" align="left" />
      </div>

      <div className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Мероприятия</div>
          <div className="text-xs text-[color:var(--text-soft)]">
            База {formatNumber(assessment.summary.baseAnnualHeatingEnergy_kWh, { maximumFractionDigits: 0 })} кВт·ч/год
            {assessment.summary.estimatedAnnualHeatingEnergyAfter_kWh !== null
              ? ` → ${formatNumber(assessment.summary.estimatedAnnualHeatingEnergyAfter_kWh, { maximumFractionDigits: 0 })} кВт·ч/год`
              : ""}
          </div>
        </div>
        <div className="mt-3 overflow-visible">
          <table className="w-full table-auto text-left text-sm text-[color:var(--text-muted)]">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                <th className="py-2 pr-2 font-semibold">Мероприятие</th>
                <th className="py-2 pr-2 font-semibold">A</th>
                <th className="py-2 pr-2 font-semibold">Стоимость</th>
                <th className="py-2 pr-2 font-semibold">Экономия</th>
                <th className="py-2 pr-2 font-semibold">₽/год</th>
                <th className="py-2 pr-2 font-semibold">Окупаемость</th>
                <th className="py-2 pr-2 font-semibold">NPV</th>
              </tr>
            </thead>
            <tbody>
              {assessment.measureResults.map((entry) => (
                <tr key={entry.measureId} className="border-t border-[color:var(--border-soft)] align-top">
                  <td className="py-2 pr-2">
                    <div className="font-medium text-[color:var(--text-base)]">{entry.measureName}</div>
                    <div className="text-xs text-[color:var(--text-soft)]">{entry.recommendation}</div>
                  </td>
                  <td className="py-2 pr-2">{formatArea(entry.area_m2)}</td>
                  <td className="py-2 pr-2">{formatCurrency(entry.cost_RUB)}</td>
                  <td className="py-2 pr-2">{formatNumber(entry.savedEnergy_kWh_year, { maximumFractionDigits: 0 })}</td>
                  <td className="py-2 pr-2">{formatCurrency(entry.annualSaving_RUB)}</td>
                  <td className="py-2 pr-2">
                    {entry.payback_years === null ? "—" : `${formatNumber(entry.payback_years, { maximumFractionDigits: 1 })} г`}
                  </td>
                  <td className="py-2 pr-2">{formatCurrency(entry.npv_RUB)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {assessment.recommendations.length ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Рекомендации</div>
          <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
            {assessment.recommendations.map((entry) => (
              <div key={entry} className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
                {entry}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {assessment.warnings.length ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          {assessment.warnings.join(" ")}
        </div>
      ) : null}
    </div>
  );
};

void EconomicAssessmentPanel;

const shortenEconomicLabel = (value: string): string => {
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

const EconomicAssessmentPanelV2 = ({
  report,
  initialScenario,
}: {
  report: Sp50ComplianceReport;
  initialScenario?: EconomicScenario;
}) => {
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

  const scenario = useMemo<EconomicScenario>(
    () => ({
      ...baseScenario,
      mode: scenarioMode,
      name:
        scenarioMode === "minimum_budget"
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
    }),
    [analysisPeriodYears, annualMaintenanceCost, annualTariffGrowthPercent, baseScenario, discountRatePercent, electricityTariff, heatTariff, heatingSource, regionalFactor, scenarioMode]
  );

  const assessment = useMemo<EconomicAssessmentResult>(() => runEconomicAssessment(report, scenario), [report, scenario]);
  const bestMeasure = assessment.measureResults[0] ?? null;
  const fastestMeasure =
    assessment.measureResults
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
  const scenarioButtons: Array<{ id: EconomicScenario["mode"]; label: string }> = [
    { id: "minimum_budget", label: "Минимальный бюджет" },
    { id: "maximum_saving", label: "Максимальная экономия" },
    { id: "fast_payback", label: "Быстрый срок окупаемости" },
    { id: "comprehensive", label: "Комплексная модернизация" },
  ];
  const hasMeasures = assessment.measureResults.length > 0;
  const hasNoPaybackMeasures = assessment.summary.allMeasuresNonPayback;
  const qualityCounts = assessment.zones.reduce(
    (accumulator, zone) => {
      accumulator[zone.dataQualityLevel] += 1;
      return accumulator;
    },
    { calculated: 0, estimated: 0, default: 0 }
  );
  const scoreTooltipLabel = (
    <Tooltip
      title="Приоритет мероприятия"
      description="Интегральный рейтинг мероприятия от 0 до 100."
      details={[
        "Учитывает долю теплопотерь, экономию энергии и денег, окупаемость, NPV, комфорт, риски и сложность.",
        "Сценарий пользователя смещает веса в пользу бюджета, экономии, окупаемости или комплексного эффекта.",
      ]}
    >
      <span className="cursor-help">Приоритет</span>
    </Tooltip>
  );
  const npvTooltipLabel = (
    <Tooltip
      title="NPV"
      description="Чистый дисконтированный доход за выбранный горизонт расчета."
      details={[
        "Учитывает ставку дисконтирования, ежегодный рост тарифа и ежегодное обслуживание.",
        "Отрицательный NPV не означает бесполезность мероприятия: оно может быть важно для комфорта и надежности.",
      ]}
    >
      <span className="cursor-help">NPV</span>
    </Tooltip>
  );
  const paybackTooltipLabel = (
    <Tooltip
      title="Окупаемость"
      description="Простой срок окупаемости в годах."
      details={[
        "До 3 лет — быстрая.",
        "3-7 лет — средняя.",
        "7-15 лет — длительная.",
        "Более 15 лет — низкая экономическая привлекательность.",
      ]}
    >
      <span className="cursor-help">Окупаемость</span>
    </Tooltip>
  );

  return (
    <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Экономика</h4>
        <div className="grid gap-2 sm:grid-cols-7">
          <label className="text-xs text-[color:var(--text-soft)]">
            Тепло, ₽/Гкал
            <input
              type="number"
              min={0}
              step="50"
              value={heatTariff}
              onChange={(event) => setHeatTariff(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
          <label className="text-xs text-[color:var(--text-soft)]">
            Электроэнергия, ₽/кВт·ч
            <input
              type="number"
              min={0}
              step="0.1"
              value={electricityTariff}
              onChange={(event) => setElectricityTariff(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
          <label className="text-xs text-[color:var(--text-soft)]">
            Коэф. региона
            <input
              type="number"
              min={0.1}
              step="0.05"
              value={regionalFactor}
              onChange={(event) => setRegionalFactor(Math.max(0.1, Number(event.target.value) || 1))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
          <label className="text-xs text-[color:var(--text-soft)]">
            Ставка, %
            <input
              type="number"
              min={0}
              step="0.5"
              value={discountRatePercent}
              onChange={(event) => setDiscountRatePercent(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
          <label className="text-xs text-[color:var(--text-soft)]">
            Рост тарифа, %/год
            <input
              type="number"
              min={0}
              step="0.5"
              value={annualTariffGrowthPercent}
              onChange={(event) => setAnnualTariffGrowthPercent(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
          <label className="text-xs text-[color:var(--text-soft)]">
            Обслуживание, ₽/год
            <input
              type="number"
              min={0}
              step="1000"
              value={annualMaintenanceCost}
              onChange={(event) => setAnnualMaintenanceCost(Math.max(0, Number(event.target.value) || 0))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
          <label className="text-xs text-[color:var(--text-soft)]">
            Период, лет
            <input
              type="number"
              min={1}
              step="1"
              value={analysisPeriodYears}
              onChange={(event) => setAnalysisPeriodYears(Math.max(1, Math.round(Number(event.target.value) || 1)))}
              className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {scenarioButtons.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScenarioMode(item.id)}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
              scenarioMode === item.id ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:border-[color:var(--border-base)]"
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setHeatingSource((prev) => (prev === "heat" ? "electricity" : prev === "electricity" ? "unknown" : "heat"))}
          className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-base)]"
        >
          Источник: {heatingSource === "heat" ? "тепло" : heatingSource === "electricity" ? "электроотопление" : "не задан"}
        </button>
      </div>

      {!hasMeasures ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-4 py-6 text-sm text-[color:var(--text-soft)]">
          Недостаточно расчетных данных для экономической оценки. Проверьте теплопотери по конструкциям, температуры и продолжительность отопительного периода.
        </div>
      ) : null}

      {hasMeasures ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Общие теплопотери"
          value={formatNumber(assessment.summary.totalHeatLoss_kW, { maximumFractionDigits: 1 })}
          hint="кВт"
          tone="warning"
          align="left"
        />
        <KpiCard
          label="Потенциал экономии"
          value={formatCurrency(assessment.summary.packageAnnualSaving_RUB)}
          hint={`${formatNumber(assessment.summary.packageSavedEnergy_Gcal_year, { maximumFractionDigits: 1 })} Гкал/год`}
          tone="good"
          align="left"
        />
        <KpiCard
          label="Самое выгодное мероприятие"
          value={bestMeasure ? bestMeasure.measureName : "—"}
          hint={bestMeasure ? `${bestMeasure.priorityLevel}, ${formatCurrency(bestMeasure.annualSaving_RUB)}/год` : undefined}
          tone="info"
          align="left"
        />
        <KpiCard
          label="Самое быстрое по окупаемости"
          value={fastestMeasure ? fastestMeasure.measureName : "—"}
          hint={fastestMeasure ? formatPayback(fastestMeasure.payback_years) : undefined}
          tone="good"
          align="left"
        />
        <KpiCard
          label="Готовность экономического анализа"
          value={`${qualityCounts.calculated}/${assessment.zones.length}`}
          hint={`Расчетные: ${qualityCounts.calculated}, оценочные: ${qualityCounts.estimated}, справочные: ${qualityCounts.default}`}
          tone={qualityCounts.calculated >= Math.max(1, assessment.zones.length - qualityCounts.default) ? "good" : qualityCounts.calculated > 0 ? "warning" : "info"}
          align="left"
        />
      </div> : null}

      {hasMeasures ? <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Сводка по зданию</div>
            <div className="text-xs text-[color:var(--text-soft)]">
              База {formatNumber(assessment.summary.estimatedAnnualHeatingEnergyBefore_kWh, { maximumFractionDigits: 0 })} кВт·ч/год
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-[color:var(--text-muted)]">
            <div>Основная зона потерь: {assessment.summary.mainLossZone ?? "—"}</div>
            <div>
              Наибольшая доля потерь:{" "}
              {assessment.summary.mainLossShare === null ? "—" : `${formatNumber(assessment.summary.mainLossShare * 100, { maximumFractionDigits: 1 })}%`}
            </div>
            <div>Потенциальная экономия: {formatCurrency(assessment.summary.packageAnnualSaving_RUB)}/год</div>
            <div>Пакетная окупаемость: {formatPayback(assessment.summary.packagePayback_years)}</div>
            <div>Класс окупаемости пакета: {assessment.summary.packagePaybackClass}</div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneChartData} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                <RechartsTooltip formatter={(value: ValueType, _name, item) => [`${value} Вт`, item?.payload?.fullName ?? item?.payload?.name]} />
                <Bar dataKey="loss" name="Теплопотери, Вт" fill="#f59e0b" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Сравнение срока окупаемости</div>
            <div className="text-xs text-[color:var(--text-soft)]">
              После пакета {formatNumber(assessment.summary.estimatedAnnualHeatingEnergyAfter_kWh, { maximumFractionDigits: 0 })} кВт·ч/год
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paybackChartData} margin={{ top: 8, right: 12, left: 12, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={88} tick={{ fontSize: 11 }} />
                <YAxis />
                <RechartsTooltip formatter={(value: ValueType, _name, item) => [`${value} лет`, item?.payload?.fullName ?? "Окупаемость"]} />
                <Bar dataKey="payback" name="Окупаемость, лет" radius={[8, 8, 0, 0]}>
                  {paybackChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.payback <= 8 ? "#22c55e" : entry.payback <= 15 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div> : null}

      {hasMeasures ? <div className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Мероприятия</div>
          <div className="text-xs text-[color:var(--text-soft)]">Рейтинг учитывает экономию, окупаемость, долю теплопотерь, комфорт и риски.</div>
        </div>
        {hasNoPaybackMeasures ? (
          <div className="mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
            По прямой экономии мероприятия не окупаются в выбранных условиях. При этом часть из них может быть целесообразна для повышения комфорта и снижения риска промерзания.
          </div>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[980px] table-auto text-left text-sm text-[color:var(--text-muted)]">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                <th className="py-2 pr-3 font-semibold">Мероприятие</th>
                <th className="py-2 pr-3 font-semibold">Зона</th>
                <th className="py-2 pr-3 font-semibold">Площадь</th>
                <th className="py-2 pr-3 font-semibold">Стоимость</th>
                <th className="py-2 pr-3 font-semibold">Гкал/год</th>
                <th className="py-2 pr-3 font-semibold">₽/год</th>
                <th className="py-2 pr-3 font-semibold">{paybackTooltipLabel}</th>
                <th className="py-2 pr-3 font-semibold">{npvTooltipLabel}</th>
                <th className="py-2 pr-3 font-semibold">Сложность</th>
                <th className="py-2 pr-3 font-semibold">{scoreTooltipLabel}</th>
              </tr>
            </thead>
            <tbody>
              {assessment.measureResults.map((entry) => (
                <tr
                  key={entry.measureId}
                  className={`border-t border-[color:var(--border-soft)] align-top ${entry.isRecommended ? "bg-[color:var(--success-bg)]" : ""}`}
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2 font-medium text-[color:var(--text-base)]">
                      <span>{entry.measureName}</span>
                      {entry.isRecommended ? <span className="rounded-full bg-[color:var(--success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--success-fg)]">Рекомендовано</span> : null}
                      <span className={formatDataQualityBadgeClass(entry.dataQualityLevel)}>{formatDataQualityLabel(entry.dataQualityLevel)}</span>
                    </div>
                    <div className="text-xs text-[color:var(--text-soft)]">{entry.implementationScope}</div>
                    <div className="text-xs text-[color:var(--text-soft)]">
                      Комфорт: {entry.comfortEffect}. Риск: {entry.riskReduction}.
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-soft)] whitespace-normal break-words">{entry.scenarioExplanation}</div>
                  </td>
                  <td className="py-3 pr-3">{entry.zoneLabel}</td>
                  <td className="py-3 pr-3">{entry.area_m2 > 0 ? formatArea(entry.area_m2) : "комплекс"}</td>
                  <td className="py-3 pr-3">{formatCurrency(entry.totalCost_RUB)}</td>
                  <td className="py-3 pr-3">{formatNumber(entry.savedEnergy_Gcal_year, { maximumFractionDigits: 2 })}</td>
                  <td className="py-3 pr-3">{formatCurrency(entry.annualSaving_RUB)}</td>
                  <td className="py-3 pr-3">
                    <div>{formatPayback(entry.payback_years)}</div>
                    <div className="text-xs text-[color:var(--text-soft)]">{entry.paybackClass}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <div>{formatCurrency(entry.npv_RUB)}</div>
                    <div className="text-xs text-[color:var(--text-soft)]">PI: {formatIndex(entry.profitabilityIndex)}</div>
                    <div className="text-xs text-[color:var(--text-soft)]">Дисконт. окуп.: {formatPayback(entry.discountedPayback_years)}</div>
                  </td>
                  <td className="py-3 pr-3">{entry.complexity}</td>
                  <td className="py-3 pr-3">
                    <div className="font-medium text-[color:var(--text-base)]">{entry.priorityLevel}</div>
                    <div className="text-xs text-[color:var(--text-soft)]">{formatNumber(entry.priorityScorePercent, { maximumFractionDigits: 1 })} / 100</div>
                    <div className="mt-1 text-xs text-[color:var(--text-soft)]">{entry.priorityReasons.join(", ")}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> : null}

    </div>
  );
};

const Sp50Panel = ({ report }: { report: NonNullable<EngineeringAnalysisResult["sp50"]> }) => (
  <div className="ui-panel-muted min-w-0 overflow-hidden p-4">
    <h4 className="text-sm font-semibold text-[color:var(--text-base)]">СП 50.13330.2024</h4>
    <p className="mt-1 text-xs text-[color:var(--text-soft)]">Нормативный отчет подключен отдельным слоем и не ломает текущую инженерную визуализацию.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="kоб"
        value={formatNumber(report.building.kob_W_m3K, { maximumFractionDigits: 2 })}
        tone={report.building.status === "pass" ? "good" : report.building.status === "fail" ? "critical" : "warning"}
        hint={`норм: ${formatNumber(report.building.kobNorm_W_m3K, { maximumFractionDigits: 2 })}`}
        align="left"
      />
      <KpiCard
        label="Qгод"
        value={formatNumber(report.energy.annualHeatingEnergy_kWh, { maximumFractionDigits: 0 })}
        tone="info"
        hint="кВт·ч"
        align="left"
      />
      <KpiCard
        label="Статус"
        value={formatSp50Status(report.building.status)}
        tone={report.building.status === "pass" ? "good" : report.building.status === "fail" ? "critical" : "warning"}
        align="left"
      />
      <KpiCard
        label="Отклонения"
        value={String(report.constructions.filter((entry) => entry.status === "fail").length)}
        tone={report.constructions.some((entry) => entry.status === "fail") ? "warning" : "good"}
        hint={`из ${report.constructions.length} конструкций`}
        align="left"
      />
    </div>
    <details className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4" open={false}>
      <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--text-base)]">Исходные данные и показатели здания</summary>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Исходные данные</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
          <BalanceRow label="Город / климат" value={report.sourceData.city ?? report.sourceData.climateRegion ?? "—"} unit="" />
          <BalanceRow label="tв" value={report.sourceData.indoorTemperatureC} unit="°C" />
          <BalanceRow label="tот" value={report.sourceData.outdoorHeatingPeriodAverageC} unit="°C" />
          <BalanceRow label="zот" value={report.sourceData.heatingPeriodDurationDays} unit="сут" />
          <BalanceRow label="ГСОП" value={report.sourceData.gsop} unit="°C·сут" />
          <BalanceRow label="Vот" value={report.sourceData.heatedVolumeM3} unit="м³" />
          <BalanceRow label="Aот" value={report.sourceData.heatedAreaM2} unit="м²" />
          <BalanceRow label="Тип здания" value={formatBuildingCategory(report.sourceData.buildingCategory)} unit="" />
          <BalanceRow label="Этажность" value={report.sourceData.storeys} unit="" />
        </div>
      </div>
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Здание</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
          <BalanceRow label="kоб факт" value={report.building.kob_W_m3K} unit="Вт/(м³·К)" />
          <BalanceRow label="kоб норм" value={report.building.kobNorm_W_m3K} unit="Вт/(м³·К)" />
          <BalanceRow label="Kобщ" value={report.building.kOverall_W_m2K} unit="Вт/(м²·К)" />
          <BalanceRow label="Kкомп" value={report.building.compactness_1_m} unit="1/м" />
          <BalanceRow label="Статус" value={formatSp50Status(report.building.status)} unit="" />
        </div>
      </div>
      </div>
    </details>
    <div className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Конструкции</div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[760px] w-full table-auto text-left text-sm text-[color:var(--text-muted)]">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
              <th className="py-2 pr-2 font-semibold">Элемент</th>
              <th className="py-2 pr-2 font-semibold">A</th>
              <th className="py-2 pr-2 font-semibold">Ro факт</th>
              <th className="py-2 pr-2 font-semibold">Ro норм</th>
              <th className="py-2 pr-2 font-semibold">Rопр</th>
              <th className="py-2 pr-2 font-semibold">Δ</th>
              <th className="py-2 pr-2 font-semibold">Статус</th>
            </tr>
          </thead>
          <tbody>
            {report.constructions.map((entry) => (
              <tr key={entry.id} className="border-t border-[color:var(--border-soft)] align-top">
                <td className="py-2 pr-2">
                  <div className="font-medium text-[color:var(--text-base)]">{entry.label}</div>
                  <div className="text-xs text-[color:var(--text-soft)]">
                    {entry.layers.map((layer) => `${layer.materialLabel} ${formatNumber(layer.thicknessM, { maximumFractionDigits: 3 })} м`).join(" · ") || "Без послойных данных"}
                  </div>
                </td>
                <td className="py-2 pr-2">{formatArea(entry.areaM2)}</td>
                <td className="py-2 pr-2">{formatNumber(entry.actualResistance_m2K_W, { maximumFractionDigits: 2 })}</td>
                <td className="py-2 pr-2">{formatNumber(entry.normalizedResistance_m2K_W, { maximumFractionDigits: 2 })}</td>
                <td className="py-2 pr-2">{formatNumber(entry.reducedResistance_m2K_W, { maximumFractionDigits: 2 })}</td>
                <td className="py-2 pr-2">{formatNumber(entry.margin_m2K_W, { maximumFractionDigits: 2 })}</td>
                <td className="py-2 pr-2">{formatSp50Status(entry.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 rounded-xl bg-[color:var(--surface-muted)] p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Ключевой вклад в теплопотери</div>
        <div className="mt-2 space-y-2 text-sm text-[color:var(--text-muted)]">
          {report.constructions
            .filter((entry) => (entry.contribution_W_K ?? 0) > 0)
            .sort((left, right) => (right.contribution_W_K ?? 0) - (left.contribution_W_K ?? 0))
            .slice(0, 3)
            .map((entry) => (
              <div key={`${entry.id}-loss`} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-[color:var(--text-base)]">{entry.label}</div>
                  <div className="text-xs text-[color:var(--text-soft)]">
                    {formatArea(entry.areaM2)} · Ro {formatNumber(entry.reducedResistance_m2K_W, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="shrink-0 font-medium text-[color:var(--text-base)]">
                  {formatNumber(entry.contribution_W_K, { maximumFractionDigits: 2 })} Вт/К
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
    <details className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--text-base)]">Температурная проверка и энергетические показатели</summary>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Температурная проверка</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
          <BalanceRow label="Мин. t поверхности" value={report.temperature.minimumSurfaceTemperatureC} unit="°C" />
          <BalanceRow label="Точка росы" value={report.temperature.dewPointTemperatureC} unit="°C" />
          <BalanceRow label="Риск" value={report.temperature.riskCount} unit="зон" />
        </div>
        {report.temperature.problematicZones.length ? (
          <div className="mt-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)] whitespace-normal break-words">
            {report.temperature.problematicZones.slice(0, 6).join("; ")}
          </div>
        ) : null}
      </div>
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Энергия и нестационарность</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
          <BalanceRow label="qот_p" value={report.energy.qHeatingCharacteristic_W_m3K} unit="Вт/(м³·К)" />
          <BalanceRow label="qот норм" value={report.energy.qHeatingNorm_kWh_m2} unit="кВт·ч/м²" />
          <BalanceRow label="Qот_год" value={report.energy.annualHeatingEnergy_kWh} unit="кВт·ч" />
          <BalanceRow label="Qобщ_год" value={report.energy.annualTotalLosses_kWh} unit="кВт·ч" />
          <BalanceRow label="D" value={report.transient.thermalInertia_D} unit="" />
          <BalanceRow label="Aτ" value={report.transient.internalSurfaceAmplitudeC} unit="°C" />
          <BalanceRow label="Aτ норм" value={report.transient.requiredAmplitudeC} unit="°C" />
          <BalanceRow label="Статус qот" value={formatSp50Status(report.energy.status)} unit="" />
          <BalanceRow label="Статус нестац." value={formatSp50Status(report.transient.status)} unit="" />
        </div>
      </div>
      </div>
    </details>
    <details className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--text-base)]">Специальные проверки: воздух, влага и полы</summary>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Воздухопроницаемость</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
          <BalanceRow label="Ru" value={report.airPermeability.actualResistance_m2hPa_kg} unit="" />
          <BalanceRow label="Ru норм" value={report.airPermeability.requiredResistance_m2hPa_kg} unit="" />
          <BalanceRow label="Статус" value={formatSp50Status(report.airPermeability.status)} unit="" />
        </div>
      </div>
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Влажностная защита</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
          <BalanceRow label="Rn" value={report.moistureProtection.actualResistance_m2hPa_mg} unit="" />
          <BalanceRow label="Rn норм" value={report.moistureProtection.governingRequiredResistance_m2hPa_mg} unit="" />
          <BalanceRow label="Статус" value={report.moistureProtection.status === "calculated" ? formatCompliance(report.moistureProtection.complies) : "Недостаточно данных"} unit="" />
        </div>
      </div>
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Полы</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
          <BalanceRow label="Yпол" value={report.floor.heatAbsorption_W_m2K} unit="Вт/(м²·К)" />
          <BalanceRow label="Yпол норм" value={report.floor.requiredHeatAbsorption_W_m2K} unit="Вт/(м²·К)" />
          <BalanceRow label="Статус" value={formatSp50Status(report.floor.status)} unit="" />
        </div>
      </div>
      </div>
    </details>
    {report.recommendations.length ? (
      <div className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Рекомендации</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
          {report.recommendations.map((item) => (
            <div key={item.id} className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
              <div className="font-medium text-[color:var(--text-base)]">{item.title}</div>
              <div>{item.effect}</div>
            </div>
          ))}
        </div>
      </div>
    ) : null}
    {report.missingData.length ? (
      <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
        {report.missingData.join(" ")}
      </div>
    ) : null}
  </div>
);

const formatCompliance = (value: boolean | null): string => {
  if (value === null) {
    return "недостаточно данных";
  }
  return value ? "соответствует" : "не соответствует";
};

const formatSp50Status = (status: "pass" | "fail" | "insufficient_data"): string => {
  if (status === "pass") {
    return "соответствует";
  }
  if (status === "fail") {
    return "не соответствует";
  }
  return "недостаточно данных";
};

const formatBuildingCategory = (value: string | null | undefined): string => {
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

const formatCurrency = (value: number | null | undefined): string => {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
};

const formatPayback = (value: number | null | undefined): string => {
  if (!Number.isFinite(value)) {
    return "не рассчитывается";
  }
  return `${formatNumber(value, { maximumFractionDigits: 1 })} лет`;
};

const formatIndex = (value: number | null | undefined): string => {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDataQualityLabel = (value: "calculated" | "estimated" | "default"): string => {
  switch (value) {
    case "calculated":
      return "расчетные";
    case "estimated":
      return "оценочные";
    default:
      return "справочные";
  }
};

const formatDataQualityBadgeClass = (value: "calculated" | "estimated" | "default"): string => {
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
