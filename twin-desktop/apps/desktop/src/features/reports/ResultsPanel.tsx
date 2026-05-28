import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationFrame, ThermalGraph } from "../../entities/twin/types";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useBuildStore } from "../build/build.store";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import { buildDefaultEconomicScenario, runEconomicAssessment } from "../../core/economics/analysis";
import { buildZoneSeries } from "../../core/thermal/thermalResultsChartPayload";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { navigate } from "../../app/router";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useWorkspaceStore } from "../../entities/workspace/workspace.store";
import {
  AnimatedTabs,
  EmptyState,
  MetricInfoTooltip,
  SummaryHero,
  SummaryHighlightGrid,
  TemperatureScaleLegend,
} from "../../shared/ui";
import { writeAgentDebugLog } from "../../shared/utils/agentDebugLog";
import { formatEnergy, formatNumber, formatPercentage } from "../../shared/utils/format";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { runLocalThermalCalculation } from "../runs/runLocalThermalCalculation";
import { runThermalMonteCarloAnalysis } from "../scenarios/runThermalMonteCarloAnalysis";
import MetricsResultsTab from "./MetricsResultsTab";
import MonteCarloResultsSection from "./MonteCarloResultsSection";
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
    setActiveTab("probabilistic");

    window.setTimeout(() => {
      try {
        runLocalThermalCalculation();
        runThermalMonteCarloAnalysis();
        setAutoRunState("success");
        setAutoRunMessage("Базовый расчёт и Monte Carlo обновлены. Открыта вкладка вероятностного анализа.");
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

  useEffect(() => {
    // #region agent log
    writeAgentDebugLog({
      sessionId: "c3d591",
      runId: "repro-5",
      hypothesisId: "H9",
      location: "ResultsPanel.tsx:selection-state",
      message: "results panel selection and geometry state",
      data: {
        projectKey,
        modelRevision,
        selectedSpaceId,
        frameCount: visibleFrames.length,
        graphNodes: visibleThermalGraph?.nodes.length ?? 0,
        spaceInstanceCount: useTwinStore.getState().spaceInstances.length,
      },
      timestamp: Date.now(),
    });
    // #endregion
  }, [modelRevision, projectKey, selectedSpaceId, visibleFrames.length, visibleThermalGraph]);

  const tabContent: Record<WorkspaceTab, React.ReactNode> = {
    overview: (
      <OverviewTab
        climateLabel={climateLabel}
        economyAssessment={economyAssessment}
        lastThermalResult={visibleThermalResult}
        monteCarloResult={visibleMonteCarloResult}
        onOpenCalculation={handleRunCalculation}
        onOpenEconomy={() => setActiveTab("economy")}
        onOpenMonteCarlo={() => navigate("/uncertainty")}
        onOpenThermal={() => setActiveTab("thermal")}
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
        currentFrame={currentFrame}
        frames={visibleFrames}
        graph={visibleThermalGraph}
        onSelectRoom={selectSpace}
        onSliderChange={(value) => setTimeIndex(value)}
        onTogglePlay={() => setPlaying((prev) => !prev)}
        playing={playing}
        selectedRoomId={selectedSpaceId}
        timeIndex={timeIndex}
        timeLabel={timeLabel}
        onOpenCalculation={handleRunCalculation}
      />
    ),
    // Temporarily hidden from UI. Will be restored after project documentation export redesign.
    // documents: <ProjectDocumentationPage projectId={projectId} />,
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <SummaryHero
        title="Результаты проекта"
        description="Тепловой расчёт, неопределённость и экономика — в одном рабочем разделе."
      >
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
        {autoRunState === "success" ? (
          <div className="rounded-2xl border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-4 py-3 text-sm text-[color:var(--success-fg)]">
            {autoRunMessage}
          </div>
        ) : null}
        {thermalResultState === "stale" || monteCarloResultState === "stale" ? (
          <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
            Результаты не соответствуют текущей модели. Выполните расчёт заново перед анализом и экспортом.
          </div>
        ) : null}
        <ResultsSummaryBar
          energy={visibleThermalResult?.summary.totalEnergyKWh ?? null}
          peakLoad={visibleThermalResult?.summary.peakLoadKW ?? null}
          discomfortHours={visibleThermalResult?.summary.discomfortHours ?? null}
          monteCarloP50={visibleMonteCarloResult?.totalEnergy.p50 ?? null}
          underheatingRisk={visibleMonteCarloResult?.underheatingBelow20CProbability ?? null}
        />
      </SummaryHero>

      <AnimatedTabs<WorkspaceTab> tabs={tabItems} value={activeTab} onChange={setActiveTab} />

      <div className="ui-panel min-h-0 p-4 sm:p-5 xl:p-6">
        <div key={activeTab} className="animate-fade-slide min-h-[20rem]">
          {tabContent[activeTab]}
        </div>
      </div>
    </div>
  );
}

function ResultsSummaryBar({
  energy,
  peakLoad,
  discomfortHours,
  monteCarloP50,
  underheatingRisk,
}: {
  energy: number | null;
  peakLoad: number | null;
  discomfortHours: number | null;
  monteCarloP50: number | null;
  underheatingRisk: number | null;
}) {
  return (
    <SummaryHighlightGrid
      className="mt-1"
      items={[
        {
          label: "Тепловая энергия",
          value: (
            <span className="inline-flex items-center gap-1.5">
              {formatEnergy(energy, "кВт·ч")}
              <MetricInfoTooltip {...resultsMetricInfo.energy} />
            </span>
          ),
          hint: "нтеграл нагрузки за период базового расчёта.",
        },
        {
          label: "Пиковая нагрузка",
          value: (
            <span className="inline-flex items-center gap-1.5">
              {peakLoad == null ? "—" : `${formatNumber(peakLoad, { maximumFractionDigits: 2 })} кВт`}
              <MetricInfoTooltip {...resultsMetricInfo.peakLoad} />
            </span>
          ),
          hint: "Максимум суммарной мощности отопления.",
        },
        {
          label: "Часы дискомфорта",
          value: (
            <span className="inline-flex items-center gap-1.5">
              {discomfortHours == null ? "—" : `${formatNumber(discomfortHours, { maximumFractionDigits: 1 })} ч`}
              <MetricInfoTooltip {...resultsMetricInfo.discomfort} />
            </span>
          ),
          hint: "Суммарно по зонам при отклонении ниже уставки.",
        },
        {
          label: "Медиана Monte Carlo",
          value: (
            <span className="inline-flex items-center gap-1.5">
              {formatEnergy(monteCarloP50, "кВт·ч")}
              <MetricInfoTooltip {...resultsMetricInfo.monteCarloP50} />
            </span>
          ),
          hint: "P50 по энергии при разбросе параметров.",
          tone: monteCarloP50 != null ? "info" : "neutral",
        },
        {
          label: "Риск недогрева",
          value: (
            <span className="inline-flex items-center gap-1.5">
              {formatPercentage(underheatingRisk)}
              <MetricInfoTooltip {...resultsMetricInfo.underheatingRisk} />
            </span>
          ),
          hint: "Вероятность температуры ниже 20 °C.",
          tone: underheatingRisk != null && underheatingRisk > 0.15 ? "warning" : "neutral",
        },
      ]}
    />
  );
}

function OverviewTab({
  climateLabel,
  economyAssessment,
  lastThermalResult,
  monteCarloResult,
  onOpenCalculation,
  onOpenEconomy,
  onOpenMonteCarlo,
  onOpenThermal,
}: {
  climateLabel: string | null;
  economyAssessment: ReturnType<typeof runEconomicAssessment> | null;
  lastThermalResult: ReturnType<typeof useTwinStore.getState>["lastThermalResult"];
  monteCarloResult: ReturnType<typeof useWorkflowStore.getState>["monteCarloResult"];
  onOpenCalculation: () => void;
  onOpenEconomy: () => void;
  onOpenMonteCarlo: () => void;
  onOpenThermal: () => void;
}) {
  if (!lastThermalResult && !monteCarloResult) {
    return (
      <section className="rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-5">
        <EmptyState
          title="Нет данных в результатах"
          message="Выполните базовый RC-расчёт или запустите Monte Carlo, чтобы появились KPI, графики и сводка."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={onOpenCalculation} className="ui-btn-primary px-4 py-2 text-sm">
            Запустить расчёт
          </button>
          <button type="button" onClick={onOpenMonteCarlo} className="ui-btn-secondary px-4 py-2 text-sm">
            Перейти к анализу
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <p className="text-sm font-semibold text-[color:var(--text-base)]">Тепловой расчёт</p>
            <MetricInfoTooltip {...resultsMetricInfo.rcBalance} />
          </div>
          {lastThermalResult ? (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--text-muted)]">
                Базовый нестационарный RC-расчёт выполнен. Подробная динамика помещения вынесена во вкладку
                «Тепловой расчёт».
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <OverviewMetric
                  label="Энергия за период"
                  value={formatEnergy(lastThermalResult.summary.totalEnergyKWh, "кВт·ч")}
                  info={resultsMetricInfo.energy}
                />
                <OverviewMetric
                  label="Пиковая нагрузка"
                  value={`${formatNumber(lastThermalResult.summary.peakLoadKW, { maximumFractionDigits: 2 })} кВт`}
                  info={resultsMetricInfo.peakLoad}
                />
                <OverviewMetric
                  label="Дискомфорт"
                  value={`${formatNumber(lastThermalResult.summary.discomfortHours, { maximumFractionDigits: 1 })} ч`}
                  info={resultsMetricInfo.discomfort}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onOpenThermal} className="ui-btn-primary px-4 py-2 text-sm">
                  Открыть тепловой расчёт
                </button>
                <button type="button" onClick={onOpenCalculation} className="ui-btn-secondary px-4 py-2 text-sm">
                  Пересчитать
                </button>
              </div>
            </div>
          ) : (
            <TabEmptyState
              title="Нет RC-расчёта"
              message="Сначала выполните базовый расчёт, чтобы появились сводка и динамика помещения."
              buttonLabel="Запустить расчёт"
              onClick={onOpenCalculation}
            />
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[color:var(--text-base)]">Monte Carlo</p>
              <MetricInfoTooltip {...resultsMetricInfo.monteCarloP50} />
            </div>
            {monteCarloResult ? (
              <div className="space-y-2 text-sm text-[color:var(--text-muted)]">
                <p>P10–P90: {formatEnergy(monteCarloResult.totalEnergy.p10, "кВт·ч")} — {formatEnergy(monteCarloResult.totalEnergy.p90, "кВт·ч")}</p>
                <p>P50: {formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч")}</p>
                <p>Риск недогрева: {formatPercentage(monteCarloResult.underheatingBelow20CProbability ?? null)}</p>
                <p>Главный фактор: {monteCarloResult.sensitivity?.slice().sort((a, b) => b.valuePercent - a.valuePercent)[0]?.label ?? "—"}</p>
              </div>
            ) : (
              <TabEmptyState
                title="Monte Carlo не запускался"
                message="Сначала нужен вероятностный анализ поверх RC-расчёта."
                buttonLabel="Перейти к вероятностному анализу"
                onClick={onOpenMonteCarlo}
              />
            )}
          </section>

          <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[color:var(--text-base)]">Экономика</p>
              <MetricInfoTooltip {...resultsMetricInfo.payback} />
            </div>
            {economyAssessment ? (
              <div className="space-y-2 text-sm text-[color:var(--text-muted)]">
                <p>Потенциал экономии: {formatMoney(economyAssessment.summary.packageAnnualSaving_RUB)}/год</p>
                <p>Окупаемость: {economyAssessment.summary.packagePayback_years == null ? "—" : `${formatNumber(economyAssessment.summary.packagePayback_years, { maximumFractionDigits: 1 })} лет`}</p>
                <p>NPV: {formatMoney(economyAssessment.summary.npv_RUB)}</p>
                <p>Климатическая база: {climateLabel ?? "не задана"}</p>
              </div>
            ) : (
              <TabEmptyState
                title="Экономика недоступна"
                message="Для экономической оценки нужен нормативный/инженерный расчёт SP50."
                buttonLabel="Открыть вкладку экономики"
                onClick={onOpenEconomy}
              />
            )}
          </section>
        </div>
      </div>

    </div>
  );
}

function OverviewMetric({
  label,
  value,
  info,
}: {
  label: string;
  value: string;
  info: { title: string; meaning: string; formula?: string; inputs?: string | string[]; calculatedIn?: string; notes?: string | string[] };
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[color:var(--text-muted)]">{label}</p>
        <MetricInfoTooltip {...info} />
      </div>
      <p className="mt-1 text-base font-semibold text-[color:var(--text-base)]">{value}</p>
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
  currentFrame,
  frames,
  graph,
  onOpenCalculation,
  onSelectRoom,
  onSliderChange,
  onTogglePlay,
  playing,
  selectedRoomId,
  timeIndex,
  timeLabel,
}: {
  currentFrame: SimulationFrame | null;
  frames: SimulationFrame[];
  graph: ThermalGraph | null;
  onOpenCalculation: () => void;
  onSelectRoom: (roomId: string | null) => void;
  onSliderChange: (value: number) => void;
  onTogglePlay: () => void;
  playing: boolean;
  selectedRoomId: string | null;
  timeIndex: number;
  timeLabel: string;
}) {
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

      <section className="rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-4">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">2D-карта температур</p>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          Плоская тепловая карта появится в следующем обновлении интерфейса результатов.
        </p>
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

  const width = 600;
  const height = 320;
  const nodes = graph.nodes;
  const edges = graph.edges;
  const frameTemps = frame ? Object.values(frame.temperatures).filter((value): value is number => Number.isFinite(value)) : [];
  const dynamicMin = frameTemps.length ? Math.min(...frameTemps) : 15;
  const dynamicMax = frameTemps.length ? Math.max(...frameTemps) : 30;
  const legendMin = Math.min(15, dynamicMin);
  const legendMax = Math.max(30, dynamicMax);
  const scaleClamped = dynamicMin < 15 || dynamicMax > 30;
  const positions = new Map<string, { x: number; y: number }>();
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

  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Тепловой граф зон</h3>
            <MetricInfoTooltip {...resultsMetricInfo.rcBalance} />
          </div>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Условная зональная сеть. Толщина линии пропорциональна проводимости, цвет узла — текущей температуре. Это не CFD.
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
        <svg width={width} height={height} className="max-w-full">
          {edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) {
              return null;
            }
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--chart-edge)"
                strokeWidth={Math.max(1, edge.conductance * 4)}
                strokeOpacity={0.85}
              />
            );
          })}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) {
              return null;
            }
            const temp = frame?.temperatures[node.id] ?? node.initialTemp;
            const color = temperatureToColor(temp, legendMin, legendMax);
            const displayLabel = node.id === "outdoor" ? "Наружный воздух" : node.label;
            const isSelected = selectedId === node.id;
            return (
              <g
                key={node.id}
                onClick={() => node.type === "space" && onSelect(node.id)}
                cursor={node.type === "space" ? "pointer" : "default"}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 18 : 14}
                  fill={color}
                  stroke={node.type === "space" ? "var(--text-base)" : "var(--text-soft)"}
                  strokeWidth={node.type === "space" ? 2 : 1}
                  opacity={node.type === "space" ? 0.95 : 0.7}
                />
                <text x={pos.x} y={pos.y + 30} textAnchor="middle" className="text-xs font-medium fill-[color:var(--text-muted)]">
                  {displayLabel}
                </text>
                <text x={pos.x} y={pos.y + 44} textAnchor="middle" className="text-[10px] fill-[color:var(--text-soft)]">
                  {formatTemperature(temp)}
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

function formatMoney(value: number | null | undefined): string {
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


