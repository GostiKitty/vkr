import { useEffect } from "react";
import { useProjectStore } from "../../entities/project/project.store";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useBuildStore } from "../build/build.store";
import {
  MetricCard,
  ResultSummaryCard,
  WorkspacePageHeader,
} from "../../shared/ui";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { useTwin } from "../twin/useTwin";
import ResultsPanel from "./ResultsPanel";
import { resultsMetricInfo } from "./resultsMetricInfo";

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
  const totalHeatLossKW =
    transmissionLossKW !== null && airExchangeLossKW !== null
      ? transmissionLossKW + airExchangeLossKW
      : null;
  const specificEnergyKWhM2 = visibleBuildingDiagnostics?.specificEnergyKWh_m2 ?? null;
  const specificPeakLoadWM2 = visibleBuildingDiagnostics?.specificPeakLoad_W_m2 ?? null;

  const rooms = useBuildStore((state) => state.model.rooms);
  const weakestRoom =
    visibleMonteCarloResult?.roomRiskSummary
      ?.slice()
      .sort((a, b) => b.underheatingRisk - a.underheatingRisk)[0] ?? null;
  const weakestRoomLabel = weakestRoom
    ? rooms.find((room) => room.id === weakestRoom.roomId)?.name?.trim() || weakestRoom.roomId
    : null;

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
  }, [modelRevision, monteCarloResultState, projectKey, thermalResultState]);

  return (
    <section className="w-full space-y-4 ui-page-enter">
      <WorkspacePageHeader title="Результаты расчёта" />

      {thermalResultState === "stale" || monteCarloResultState === "stale" ? (
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          Модель изменилась после последнего расчёта. Запустите расчёт заново, чтобы результаты соответствовали текущему BuildingModel.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Суммарные теплопотери"
          value={totalHeatLossKW}
          unit="кВт"
          precision={2}
          status={totalHeatLossKW !== null ? "success" : "warning"}
          metricInfo={resultsMetricInfo.buildingTotalHeatLossKW}
        />
        <MetricCard
          label="Потери через ограждения"
          value={transmissionLossKW}
          unit="кВт"
          precision={2}
          status={transmissionLossKW !== null ? "info" : "warning"}
          metricInfo={resultsMetricInfo.buildingTransmissionLossKW}
        />
        <MetricCard
          label="Потери на воздухообмен"
          value={airExchangeLossKW}
          unit="кВт"
          precision={2}
          status={airExchangeLossKW !== null ? "info" : "warning"}
          metricInfo={resultsMetricInfo.buildingAirExchangeLossKW}
        />
        <MetricCard
          label="Удельные потери"
          value={specificEnergyKWhM2}
          unit="кВт·ч/м²"
          precision={2}
          status={specificEnergyKWhM2 !== null ? "success" : "warning"}
          metricInfo={resultsMetricInfo.buildingSpecificEnergyKWhM2}
        />
      </div>

      <ResultSummaryCard
        totalHeatLossKW={totalHeatLossKW}
        specificHeatLoss={specificPeakLoadWM2}
        totalHeatLossMetricInfo={resultsMetricInfo.buildingTotalHeatLossKW}
        specificHeatLossMetricInfo={resultsMetricInfo.peakLoad}
        weakElementLabel="Наиболее уязвимое помещение"
        weakElement={weakestRoomLabel ?? "Будет определено после расчёта"}
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
