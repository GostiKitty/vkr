import { useEffect } from "react";
import { useProjectStore } from "../../entities/project/project.store";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useBuildStore } from "../build/build.store";
import {
  MetricCard,
  ResultSummaryCard,
  StatusStrip,
  WorkspacePageHeader,
} from "../../shared/ui";
import { writeAgentDebugLog } from "../../shared/utils/agentDebugLog";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { useTwin } from "../twin/useTwin";
import ResultsPanel from "./ResultsPanel";

export function ResultsWorkspacePage() {
  const projectId = useProjectStore((state) => state.projectId);
  const projectKind = useProjectStore((state) => state.projectKind);
  const projectKey = useBuildStore((state) => state.projectKey);
  const modelRevision = useBuildStore((state) => state.modelRevision);
  const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
  const lastThermalResult = useTwinStore((state) => state.lastThermalResult);
  const lastThermalResultBinding = useTwinStore((state) => state.lastThermalResultBinding);
  const monteCarloResult = useWorkflowStore((state) => state.monteCarloResult);
  const monteCarloResultBinding = useWorkflowStore((state) => state.monteCarloResultBinding);

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
  const visibleBuildingDiagnostics = visibleThermalResult?.diagnostics?.building ?? null;
  const transmissionLossKW = visibleBuildingDiagnostics
    ? (visibleBuildingDiagnostics.totalOpaqueLossW +
        visibleBuildingDiagnostics.totalWindowLossW +
        visibleBuildingDiagnostics.totalDoorLossW) /
      1000
    : null;
  const airExchangeLossKW = visibleBuildingDiagnostics
    ? (visibleBuildingDiagnostics.totalInfiltrationLossW + visibleBuildingDiagnostics.totalMechanicalVentilationLossW) / 1000
    : null;
  const specificEnergyKWhM2 = visibleBuildingDiagnostics?.specificEnergyKWh_m2 ?? null;

  useTwin(projectId ?? null, projectKind);

  useEffect(() => {
    setCurrentStep("results");
  }, [setCurrentStep]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    console.debug("[analysis-sync] results-page", {
      route: "/results",
      projectKey,
      modelRevision,
      thermalResultState,
      monteCarloResultState,
      rooms: useBuildStore.getState().model.rooms.length,
      walls: useBuildStore.getState().model.walls.length,
    });
    // #region agent log
    writeAgentDebugLog({sessionId:'c3d591',runId:'repro-4',hypothesisId:'H2',location:'ResultsWorkspacePage.tsx:results-state',message:'results page state snapshot',data:{projectKey,modelRevision,thermalResultState,monteCarloResultState,lastThermalResultBinding:lastThermalResultBinding?.modelRevision??null,lastMonteCarloResultBinding:monteCarloResultBinding?.modelRevision??null,rooms:useBuildStore.getState().model.rooms.length,walls:useBuildStore.getState().model.walls.length},timestamp:Date.now()});
    // #endregion
  }, [modelRevision, monteCarloResultState, projectKey, thermalResultState]);

  return (
    <section className="w-full space-y-4 ui-page-enter">
      <WorkspacePageHeader
        kicker="Результаты"
        title="Результаты расчёта"
        description="Метрики, графики и отчёты."
      />

      {thermalResultState === "stale" || monteCarloResultState === "stale" ? (
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          Модель изменилась после последнего расчёта. Запустите расчёт заново, чтобы результаты соответствовали текущему BuildingModel.
        </div>
      ) : null}

      <StatusStrip
        items={[
          {
            label: "Расчёт RC",
            value:
              thermalResultState === "current"
                ? "Актуален"
                : thermalResultState === "stale"
                  ? "Устарел"
                  : "Нет",
            tone: thermalResultState === "current" ? "success" : "warning",
          },
          {
            label: "Monte Carlo",
            value:
              monteCarloResultState === "current"
                ? "Актуален"
                : monteCarloResultState === "stale"
                  ? "Устарел"
                  : "Нет",
            tone: monteCarloResultState === "current" ? "info" : "warning",
          },
          // Temporarily hidden from UI. Will be restored after project documentation export redesign.
          // { label: "Документы", value: "Готово", tone: "success" },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Суммарные теплопотери"
          value={visibleThermalResult?.summary.peakLoadKW ?? null}
          unit="кВт"
          formula="Q"
          precision={2}
          status={visibleThermalResult ? "success" : "warning"}
        />
        <MetricCard
          label="Потери через ограждения"
          value={transmissionLossKW}
          unit="кВт"
          formula="Qогр"
          precision={2}
          status={transmissionLossKW !== null ? "info" : "warning"}
        />
        <MetricCard
          label="Потери на воздухообмен"
          value={airExchangeLossKW}
          unit="кВт"
          formula="Qвозд"
          precision={2}
          status={airExchangeLossKW !== null ? "info" : "warning"}
        />
        <MetricCard
          label="Удельные потери"
          value={specificEnergyKWhM2}
          unit="кВт·ч/м²"
          formula="q"
          precision={2}
          status={specificEnergyKWhM2 !== null ? "success" : "warning"}
        />
        <MetricCard
          label="Проблемная конструкция"
          value={visibleMonteCarloResult?.underheatingBelow20CProbability ?? null}
          unit="%"
          formula="P"
          precision={2}
          status={visibleMonteCarloResult ? "warning" : "neutral"}
          subtitle="Вероятность недогрева"
        />
      </div>

      <ResultSummaryCard
        totalHeatLossKW={visibleThermalResult?.summary.peakLoadKW ?? null}
        specificHeatLoss={specificEnergyKWhM2}
        weakElement={
          visibleMonteCarloResult?.roomRiskSummary?.slice().sort((a, b) => b.underheatingRisk - a.underheatingRisk)[0]
            ?.roomId ?? "Будет определена после расчёта"
        }
        recommendation={
          visibleThermalResult
            ? "Сфокусируйтесь на помещениях с высоким риском недогрева и проверьте теплотехнические свойства ограждений."
            : null
        }
      />

      <ResultsPanel projectId={projectId ?? null} />
    </section>
  );
}

export default ResultsWorkspacePage;
