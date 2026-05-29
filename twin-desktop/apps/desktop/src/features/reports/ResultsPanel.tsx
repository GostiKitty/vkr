import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BuildingModel } from "../../entities/geometry/types";
import type { SimulationFrame, ThermalGraph } from "../../entities/twin/types";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { runEngineeringThermalAnalysis } from "../../core/thermal/engineering/analysis";
import { getRoomDisplayName } from "../../core/thermal/engineering/display";
import type { ThermalSimulationOptions, ThermalSimulationResult } from "../../core/thermal/solver";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useBuildStore } from "../build/build.store";
import { applyScenarioToBuilding } from "../build/thermal/applyScenarioToBuilding";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import { buildDefaultEconomicScenario, runEconomicAssessment } from "../../core/economics/analysis";
import { buildZoneSeries } from "../../core/thermal/thermalResultsChartPayload";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { navigate } from "../../app/router";
import { useWorkflowStore, type ScenarioConfig } from "../../entities/workflow/workflow.store";
import { useWorkspaceStore } from "../../entities/workspace/workspace.store";
import {
  AnimatedTabs,
  EmptyState,
  MetricInfoTooltip,
  SummaryHighlightGrid,
  TemperatureScaleLegend,
} from "../../shared/ui";
import { formatEnergy, formatNumber, formatPercentage } from "../../shared/utils/format";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { runLocalThermalCalculation } from "../runs/runLocalThermalCalculation";
import { runThermalMonteCarloAnalysis } from "../scenarios/runThermalMonteCarloAnalysis";
import MetricsResultsTab from "./MetricsResultsTab";
import MonteCarloResultsSection from "./MonteCarloResultsSection";
import {
  TemperatureHeatmapPanel,
  type TemperatureHeatmapHover,
} from "./charts/TemperatureHeatmapPanel";
// Temporarily hidden from UI. Will be restored after project documentation export redesign.
// import ProjectDocumentationPage from "./ProjectDocumentationPage";
import ResultsEconomyTab from "./ResultsEconomyTab";
import { buildResultsSp50Report } from "./resultsSp50";
import { resultsMetricInfo } from "./resultsMetricInfo";
import SpaceDetails from "../twin/SpaceDetails";
import SpaceViewer3D from "../twin/SpaceViewer3D";
import { formatTemperature, temperatureToColor } from "../twin/twin.theme";

type WorkspaceTab = "overview" | "thermal" | "probabilistic" | "economy" | "rooms" | "map";

interface ResultsPanelProps {
  projectId: string | null;
}

// Temporarily hidden from UI. Will be restored after project documentation export redesign.
// const HIDDEN_DOCUMENTS_TAB = { id: "documents" as const, label: "Документы", hint: "Существующий экспертный контур ProjectDocumentationPage / ПП РФ №87" };

const tabItems = [
  { id: "overview" as const, label: "Обзор", hint: "Краткий инженерный обзор результатов" },
  { id: "thermal" as const, label: "Тепловой расчёт", hint: "Нестационарный RC-расчёт и исходные графики" },
  { id: "probabilistic" as const, label: "Вероятностный анализ", hint: "Monte Carlo: P10/P50/P90, гистограмма и чувствительность" },
  { id: "economy" as const, label: "Экономика", hint: "Экономическая оценка на базе существующего SP50/engineering контура" },
  { id: "map" as const, label: "Карта", hint: "3D-карта, тепловой граф и таймлайн" },
];

// projectId оставлен в props для будущей привязки к ProjectDocumentationPage
// (см. комментарий «Temporarily hidden from UI»). Пока не используется в UI.
export function ResultsPanel({ projectId: _projectId }: ResultsPanelProps) {
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [autoRunState, setAutoRunState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [autoRunError, setAutoRunError] = useState<string | null>(null);
  const [autoRunMessage, setAutoRunMessage] = useState<string | null>(null);
  const thermalRunInFlightRef = useRef(false);

  const thermalResultState = getResultSyncState(
    Boolean(lastThermalResult),
    lastThermalResultBinding,
    projectKey,
    modelRevision
  );
  const monteCarloResultState = getResultSyncState(
    Boolean(monteCarloResult),
    monteCarloResultBinding,
    projectKey,
    modelRevision
  );
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
    const roomRiskById = new Map(
      (visibleMonteCarloResult?.roomRiskSummary ?? []).map((room) => [room.roomId, room])
    );

    return Object.values(visibleThermalResult.rooms).map((room, index) => {
      const temperatures = room.timeline.map((point) => point.temperatureC).filter((value) => Number.isFinite(value));
      const avgTemperature =
        temperatures.length > 0 ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length : null;
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось выполнить расчёт.";
        setAutoRunError(message);
        setAutoRunState("error");
        setAutoRunMessage(null);
      } finally {
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
    setActiveTab("overview");

    window.setTimeout(() => {
      try {
        runLocalThermalCalculation();
        runThermalMonteCarloAnalysis();
        setAutoRunState("success");
        setAutoRunMessage(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось выполнить полный анализ.";
        setAutoRunError(message);
        setAutoRunState("error");
        setAutoRunMessage(null);
      } finally {
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

  const tabContent: Record<WorkspaceTab, React.ReactNode> = {
    overview: (
      <OverviewTab
        lastThermalResult={visibleThermalResult}
        monteCarloResult={visibleMonteCarloResult}
        onOpenCalculation={handleRunCalculation}
        onOpenMonteCarlo={() => navigate("/uncertainty")}
      />
    ),
    thermal: (
      <MetricsResultsTab
        onRecalculate={handleRunCalculation}
        onEditUncertainty={() => navigate("/uncertainty")}
      />
    ),
    probabilistic: (
      <MonteCarloResultsSection
        baseResult={visibleThermalResult}
        baseOptions={activeOptions}
        buildingModel={buildModel}
        climateLabel={climateLabel}
        monteCarloResult={visibleMonteCarloResult}
        onEditUncertainty={() => navigate("/uncertainty")}
        onRunCalculation={handleRunCalculation}
      />
    ),
    economy: <ResultsEconomyTab report={sp50Report} onOpenBuild={() => navigate("/build")} />,
    rooms: (
      <RoomsTab
        rows={roomRows}
        hasRcResults={Boolean(visibleThermalResult)}
        onOpenCalculation={handleRunCalculation}
        onSelectRoom={selectSpace}
      />
    ),
    map: (
      <MapTab
        buildModel={buildModel}
        currentFrame={currentFrame}
        frames={visibleFrames}
        graph={visibleThermalGraph}
        onSelectRoom={selectSpace}
        onSliderChange={(value) => setTimeIndex(value)}
        onTogglePlay={() => setPlaying((prev) => !prev)}
        playing={playing}
        scenarioConfig={scenarioConfig}
        selectedRoomId={selectedSpaceId}
        simulationOptions={activeOptions}
        thermalResult={visibleThermalResult}
        timeIndex={timeIndex}
        timeLabel={timeLabel}
        onOpenCalculation={handleRunCalculation}
      />
    ),
    // Temporarily hidden from UI. Will be restored after project documentation export redesign.
    // documents: <ProjectDocumentationPage projectId={projectId} />,
  };

  const showResultAlerts =
    autoRunState === "running" ||
    (autoRunState === "error" && autoRunError != null) ||
    thermalResultState === "stale" ||
    monteCarloResultState === "stale";

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {showResultAlerts ? (
        <div className="space-y-3">
          {autoRunState === "running" ? (
            <div className="rounded-2xl border border-[color:var(--accent-base)]/20 bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-base)]">
              {autoRunMessage}
            </div>
          ) : null}
          {autoRunState === "error" && autoRunError ? (
            <div className="rounded-2xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-3 text-sm text-[color:var(--danger-fg)]">
              {autoRunError}
            </div>
          ) : null}
          {thermalResultState === "stale" || monteCarloResultState === "stale" ? (
            <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
              Результаты не соответствуют текущей модели. Выполните расчёт заново перед анализом и экспортом.
            </div>
          ) : null}
        </div>
      ) : null}

      <AnimatedTabs<WorkspaceTab> tabs={tabItems} value={activeTab} onChange={setActiveTab} />

      <div className="ui-panel min-h-0 p-4 sm:p-5 xl:p-6">
        <div key={activeTab} className={`animate-fade-slide ${activeTab === "overview" ? "min-h-0" : "min-h-[20rem]"}`}>
          {tabContent[activeTab]}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  lastThermalResult,
  monteCarloResult,
  onOpenCalculation,
  onOpenMonteCarlo,
}: {
  lastThermalResult: ReturnType<typeof useTwinStore.getState>["lastThermalResult"];
  monteCarloResult: ReturnType<typeof useWorkflowStore.getState>["monteCarloResult"];
  onOpenCalculation: () => void;
  onOpenMonteCarlo: () => void;
}) {
  const highlightItems = useMemo(() => {
    const items: Array<{
      label: string;
      value: string;
      metricInfo: (typeof resultsMetricInfo)[keyof typeof resultsMetricInfo];
      tone?: "info" | "warning" | "neutral";
      calculated?: boolean;
    }> = [];

    if (lastThermalResult) {
      const buildingDiagnostics = lastThermalResult.diagnostics?.building ?? null;
      const totalHeatLossKW = buildingDiagnostics ? buildingDiagnostics.totalLossW / 1000 : null;
      const requiredPowerKW = buildingDiagnostics
        ? Math.max(0, buildingDiagnostics.totalLossW - buildingDiagnostics.totalInternalGainsW) / 1000
        : null;

      items.push({
        label: "Энергия за период",
        value: formatEnergy(lastThermalResult.summary.totalEnergyKWh, "кВт·ч"),
        metricInfo: resultsMetricInfo.energy,
        calculated: true,
      });

      if (totalHeatLossKW != null) {
        items.push({
          label: "Суммарные теплопотери",
          value: `${formatNumber(totalHeatLossKW, { maximumFractionDigits: 2 })} кВт`,
          metricInfo: resultsMetricInfo.buildingTotalHeatLossKW,
          calculated: true,
        });
      }

      if (requiredPowerKW != null) {
        items.push({
          label: "Требуемая мощность",
          value: `${formatNumber(requiredPowerKW, { maximumFractionDigits: 2 })} кВт`,
          metricInfo: resultsMetricInfo.requiredHeatingPowerKW,
          calculated: true,
        });
      }

      items.push(
        {
          label: "Пиковая нагрузка",
          value: `${formatNumber(lastThermalResult.summary.peakLoadKW, { maximumFractionDigits: 2 })} кВт`,
          metricInfo: resultsMetricInfo.peakLoad,
          calculated: true,
        },
        {
          label: "Дискомфорт",
          value: `${formatNumber(lastThermalResult.summary.discomfortHours, { maximumFractionDigits: 1 })} ч`,
          metricInfo: resultsMetricInfo.discomfort,
          calculated: true,
        }
      );
    }

    if (monteCarloResult) {
      items.push({
        label: "P50 (Monte Carlo)",
        value: formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч"),
        metricInfo: resultsMetricInfo.monteCarloP50,
        tone: "info",
        calculated: true,
      });
    }

    return items;
  }, [lastThermalResult, monteCarloResult]);

  if (!lastThermalResult && !monteCarloResult) {
    return (
      <section className="rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-5">
        <EmptyState
          title="Нет данных в результатах"
          message="Запустите базовый RC-расчёт — на этой вкладке появятся ключевые показатели. Детальные графики и Monte Carlo — на соседних вкладках."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={onOpenCalculation} className="ui-btn-primary px-4 py-2 text-sm">
            Запустить расчёт
          </button>
          <button type="button" onClick={onOpenMonteCarlo} className="ui-btn-secondary px-4 py-2 text-sm">
            Настроить Monte Carlo
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <SummaryHighlightGrid items={highlightItems} />

      {!lastThermalResult ? (
        <p className="text-xs text-[color:var(--text-soft)]">
          Базовый RC-расчёт не выполнен — показаны только результаты Monte Carlo. Запустите тепловой расчёт для полной сводки.
        </p>
      ) : null}
      {lastThermalResult && !monteCarloResult ? (
        <p className="text-xs text-[color:var(--text-soft)]">
          Вероятностный анализ не запускался. P10–P90, чувствительность и VaR — на вкладке «Вероятностный анализ».
        </p>
      ) : null}
    </div>
  );
}

function RoomsTab({
  rows,
  hasRcResults,
  onOpenCalculation,
  onSelectRoom,
}: {
  rows: Array<{
    roomId: string;
    roomName: string;
    energyKWh: number;
    avgTemperatureC: number | null;
    minTemperatureC: number | null;
    discomfortHours: number;
    underheatingRisk: number | null;
    status: string;
  }>;
  hasRcResults: boolean;
  onOpenCalculation: () => void;
  onSelectRoom: (roomId: string | null) => void;
}) {
  if (!hasRcResults) {
    return (
      <TabEmptyState
        title="Нет результатов по помещениям"
        message="Сначала нужен базовый нестационарный расчёт."
        buttonLabel="Запустить расчёт"
        onClick={onOpenCalculation}
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Результаты по помещениям</p>
          <MetricInfoTooltip
            title="Таблица помещений"
            meaning="Сводит показатели RC-расчёта и вероятностный риск по помещениям из Monte Carlo."
            formula="room KPI = f(rooms.timeline, diagnostics, roomRiskSummary)"
            inputs={["lastThermalResult.rooms", "diagnostics.zones", "roomRiskSummary"]}
            calculatedIn="src/features/reports/ResultsPanel.tsx"
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-sm text-[color:var(--text-soft)]">
                <th className="px-4 py-2 font-semibold">Помещение</th>
                <th className="px-4 py-2 font-semibold">Энергия</th>
                <th className="px-4 py-2 font-semibold">Мин. / ср. t</th>
                <th className="px-4 py-2 font-semibold">Дискомфорт</th>
                <th className="px-4 py-2 font-semibold">Риск недогрева</th>
                <th className="px-4 py-2 font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.roomId} className="border-t border-[color:var(--border-soft)]">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => onSelectRoom(row.roomId)}
                      className="font-semibold text-[color:var(--text-base)] underline decoration-dotted underline-offset-4"
                    >
                      {row.roomName}
                    </button>
                  </td>
                  <td className="px-4 py-2">{formatEnergy(row.energyKWh, "кВт·ч")}</td>
                  <td className="px-4 py-2">
                    {row.minTemperatureC == null ? "—" : `${formatNumber(row.minTemperatureC, { maximumFractionDigits: 1 })} °C`} /{" "}
                    {row.avgTemperatureC == null ? "—" : `${formatNumber(row.avgTemperatureC, { maximumFractionDigits: 1 })} °C`}
                  </td>
                  <td className="px-4 py-2">{formatNumber(row.discomfortHours, { maximumFractionDigits: 1 })} ч</td>
                  <td className="px-4 py-2">{formatPercentage(row.underheatingRisk)}</td>
                  <td className="px-4 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SpaceDetails />
    </div>
  );
}

function MapTab({
  buildModel,
  currentFrame,
  frames,
  graph,
  onOpenCalculation,
  onSelectRoom,
  onSliderChange,
  onTogglePlay,
  playing,
  scenarioConfig,
  selectedRoomId,
  simulationOptions,
  thermalResult,
  timeIndex,
  timeLabel,
}: {
  buildModel: BuildingModel;
  currentFrame: SimulationFrame | null;
  frames: SimulationFrame[];
  graph: ThermalGraph | null;
  onOpenCalculation: () => void;
  onSelectRoom: (roomId: string | null) => void;
  onSliderChange: (value: number) => void;
  onTogglePlay: () => void;
  playing: boolean;
  scenarioConfig: ScenarioConfig | null;
  selectedRoomId: string | null;
  simulationOptions: ThermalSimulationOptions;
  thermalResult: ThermalSimulationResult | null;
  timeIndex: number;
  timeLabel: string;
}) {
  const [heatmapHover, setHeatmapHover] = useState<TemperatureHeatmapHover | null>(null);
  const modelForAnalysis = useMemo(
    () => applyScenarioToBuilding(buildModel, scenarioConfig),
    [buildModel, scenarioConfig]
  );
  const adjacency = useMemo(() => buildAdjacencyGraph(modelForAnalysis), [modelForAnalysis]);
  const fieldView = useMemo(() => {
    if (!thermalResult || !modelForAnalysis.rooms.length) {
      return null;
    }
    try {
      const engineeringResult = runEngineeringThermalAnalysis(
        modelForAnalysis,
        adjacency,
        simulationOptions,
        thermalResult
      );
      return engineeringResult.detailedField ?? engineeringResult.fastField ?? null;
    } catch {
      return null;
    }
  }, [adjacency, modelForAnalysis, simulationOptions, thermalResult]);
  const roomLabels = useMemo(
    () =>
      Object.fromEntries(
        modelForAnalysis.rooms.map((room) => [room.id, getRoomDisplayName(modelForAnalysis, room.id)])
      ),
    [modelForAnalysis]
  );
  if (!frames.length && !graph) {
    return (
      <TabEmptyState
        title="Карта пока недоступна"
        message="Нужны simulation frames или thermal graph после расчёта."
        buttonLabel="Запустить расчёт"
        onClick={onOpenCalculation}
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-base)]">3D температурная карта</p>
            <p className="text-sm text-[color:var(--text-muted)]">Сохраняется текущая 3D температурная карта по временным кадрам расчёта.</p>
          </div>
          <TimelineControls
            frames={frames}
            onSliderChange={onSliderChange}
            onTogglePlay={onTogglePlay}
            playing={playing}
            timeIndex={timeIndex}
            timeLabel={timeLabel}
          />
        </div>
        <SpaceViewer3D heatmap caption="Температурная визуализация по зонам" height={420} showLegend showFitControl />
      </section>

      <GraphPanel graph={graph} frame={currentFrame} selectedId={selectedRoomId} onSelect={onSelectRoom} />

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-base)]">2D-карта температур</p>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Поле строится из зональных температур и локальных поправок (ограждения, притоки) — наглядная интерполяция,
              не CFD.
            </p>
          </div>
          {fieldView ? (
            <div className="text-right text-xs text-[color:var(--text-soft)]">
              <div>min {formatNumber(fieldView.minTemperatureC, { maximumFractionDigits: 1 })} °C</div>
              <div>max {formatNumber(fieldView.maxTemperatureC, { maximumFractionDigits: 1 })} °C</div>
            </div>
          ) : null}
        </div>
        <TemperatureHeatmapPanel
          field={fieldView}
          hover={heatmapHover}
          onHover={setHeatmapHover}
          roomLabels={roomLabels}
          emptyMessage={
            thermalResult
              ? "Недостаточно данных для 2D-карты. Проверьте геометрию помещений и параметры инженерного поля."
              : "Запустите расчёт, чтобы построить 2D-карту температур по помещениям."
          }
        />
      </section>
    </div>
  );
}

function TimelineControls({
  frames,
  onSliderChange,
  onTogglePlay,
  playing,
  timeIndex,
  timeLabel,
}: {
  frames: SimulationFrame[];
  onSliderChange: (value: number) => void;
  onTogglePlay: () => void;
  playing: boolean;
  timeIndex: number;
  timeLabel: string;
}) {
  return (
    <div className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 lg:max-w-md">
      <div className="flex items-center justify-between text-sm font-medium text-[color:var(--text-muted)]">
        <span>Момент времени</span>
        <span className="tabular-nums text-[color:var(--text-base)]">{timeLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(frames.length - 1, 0)}
        value={timeIndex}
        onChange={(event) => onSliderChange(Number(event.target.value))}
        className="mt-3 w-full accent-[color:var(--accent-base)]"
        disabled={!frames.length}
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!frames.length}
          className={playing ? "ui-btn-secondary px-4 py-2 text-sm" : "ui-btn-primary px-4 py-2 text-sm"}
        >
          {playing ? "Пауза" : "Пуск"}
        </button>
        <span className="text-sm text-[color:var(--text-soft)]">
          {frames.length ? `${frames.length} шагов` : "Нет временных кадров"}
        </span>
      </div>
    </div>
  );
}

function TabEmptyState({
  title,
  message,
  buttonLabel,
  onClick,
}: {
  title: string;
  message: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="space-y-3">
      <EmptyState title={title} message={message} />
      <button type="button" onClick={onClick} className="ui-btn-primary px-4 py-2 text-sm">
        {buttonLabel}
      </button>
    </div>
  );
}

function GraphPanel({
  graph,
  frame,
  selectedId,
  onSelect,
}: {
  graph: ThermalGraph | null;
  frame: SimulationFrame | null;
  selectedId: string | null;
  onSelect: (spaceId: string | null) => void;
}) {
  if (!graph || !graph.nodes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]">
        Тепловой граф появится после загрузки модели и появления simulation frames.
      </div>
    );
  }

  const W = 640;
  const H = 420;
  const CX = W / 2;
  const CY = H / 2;

  const nodes = graph.nodes;
  const edges = graph.edges;
  const frameTemps = frame
    ? Object.values(frame.temperatures).filter((v): v is number => Number.isFinite(v))
    : [];
  const dynamicMin = frameTemps.length ? Math.min(...frameTemps) : 15;
  const dynamicMax = frameTemps.length ? Math.max(...frameTemps) : 30;
  const legendMin = Math.min(15, dynamicMin);
  const legendMax = Math.max(30, dynamicMax);
  const scaleClamped = dynamicMin < 15 || dynamicMax > 30;

  // outdoor at center; space nodes on a circle starting from top (-π/2)
  const spaceNodes = nodes.filter((n) => n.type === "space");
  const circleRadius = Math.min(CX, CY) - 72;
  const positions = new Map<string, { x: number; y: number }>();
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
  const edgeStroke = (c: number) => 1.5 + ((c - minC) / rangeC) * 3.5;

  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Тепловой граф зон</h3>
            <MetricInfoTooltip {...resultsMetricInfo.rcBalance} />
          </div>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Условная зональная сеть. Толщина линии — относительная теплопроводность, цвет узла — температура кадра.
          </p>
        </div>
        <TemperatureScaleLegend
          caption={
            scaleClamped
              ? `Шкала ${legendMin.toFixed(0)}…${legendMax.toFixed(0)} °C (кадр: ${dynamicMin.toFixed(1)}…${dynamicMax.toFixed(1)} °C).`
              : `Шкала ${legendMin.toFixed(0)}…${legendMax.toFixed(0)} °C для узлов кадра.`
          }
        />
      </div>
      <div className="w-full overflow-x-auto">
        <svg width={W} height={H} className="max-w-full" style={{ display: "block" }}>
          {edges.map((edge, ei) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={`e-${ei}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--chart-edge)"
                strokeWidth={edgeStroke(edge.conductance)}
                strokeOpacity={0.6}
                strokeLinecap="round"
              />
            );
          })}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const temp = frame?.temperatures[node.id] ?? node.initialTemp;
            const color = temperatureToColor(temp, legendMin, legendMax);
            const isOutdoor = node.id === "outdoor";
            const isSelected = selectedId === node.id;
            const nodeR = isOutdoor ? 22 : isSelected ? 20 : 16;
            const displayLabel = isOutdoor ? "Наружный воздух" : node.label;
            const shortLabel = displayLabel.length > 14 ? `${displayLabel.slice(0, 13)}…` : displayLabel;

            // radial label: away from center for space nodes, below for outdoor
            let lx: number;
            let ly: number;
            if (isOutdoor) {
              lx = pos.x;
              ly = pos.y + nodeR + 15;
            } else {
              const dx = pos.x - CX;
              const dy = pos.y - CY;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const offset = nodeR + 14;
              lx = pos.x + (dx / dist) * offset;
              ly = pos.y + (dy / dist) * offset;
            }

            return (
              <g
                key={node.id}
                onClick={() => node.type === "space" && onSelect(node.id)}
                style={{ cursor: node.type === "space" ? "pointer" : "default" }}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={nodeR}
                  fill={color}
                  stroke={isSelected ? "var(--accent-base)" : isOutdoor ? "var(--text-soft)" : "var(--text-base)"}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  opacity={isOutdoor ? 0.75 : 0.95}
                />
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fontWeight={500}
                  fill="var(--text-base)"
                >
                  {formatTemperature(temp)}
                </text>
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={isSelected ? 600 : 400}
                  fill="var(--text-muted)"
                >
                  {shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function formatFrameTime(timeHours: number) {
  if (!Number.isFinite(timeHours)) {
    return "—";
  }
  const totalMinutes = Math.round(timeHours * 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return days > 0 ? `день ${days + 1}, ${hours}:${String(minutes).padStart(2, "0")}` : `${hours}:${String(minutes).padStart(2, "0")}`;
}

export default ResultsPanel;


