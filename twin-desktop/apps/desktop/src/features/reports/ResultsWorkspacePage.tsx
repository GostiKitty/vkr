import { useEffect } from "react";
import { useProjectStore } from "../../entities/project/project.store";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useBuildStore } from "../build/build.store";
import { WorkspacePageHeader } from "../../shared/ui";
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

      <ResultsPanel projectId={projectId ?? null} />
    </section>
  );
}

export default ResultsWorkspacePage;
