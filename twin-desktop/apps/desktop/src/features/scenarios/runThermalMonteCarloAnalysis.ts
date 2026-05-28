import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { runThermalMonteCarlo, THERMAL_MONTE_CARLO_MAX_RUNS } from "../../core/uncertainty/thermalMonteCarlo";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { createModelBinding } from "../../shared/utils/modelSync";
import { useBuildStore } from "../build/build.store";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";

const DEFAULT_MONTE_CARLO_RUNS = 200;
const DEFAULT_MONTE_CARLO_MODE = "full-physics" as const;

function clampMonteCarloRuns(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MONTE_CARLO_RUNS;
  }

  return Math.min(THERMAL_MONTE_CARLO_MAX_RUNS, Math.max(1, Math.round(value)));
}

export function runThermalMonteCarloAnalysis() {
  const buildModel = useBuildStore.getState().model;
  const projectKey = useBuildStore.getState().projectKey;
  const modelRevision = useBuildStore.getState().modelRevision;
  const workflowState = useWorkflowStore.getState();

  if (!buildModel.rooms.length) {
    throw new Error("Добавьте помещения в конструкторе перед анализом рисков.");
  }

  const nextRuns = clampMonteCarloRuns(workflowState.uncertaintyConfig?.runs ?? DEFAULT_MONTE_CARLO_RUNS);
  const evaluationMode = workflowState.uncertaintyConfig?.evaluationMode ?? DEFAULT_MONTE_CARLO_MODE;
  const adjacency = buildAdjacencyGraph(buildModel);
  const result = runThermalMonteCarlo({
    model: buildModel,
    baseOptions: buildThermalOptionsFromWorkflow(workflowState.scenarioConfig),
    runs: nextRuns,
    adjacency,
  });

  workflowState.setMonteCarloResult(result, createModelBinding(projectKey, modelRevision));
  workflowState.setUncertaintyConfig({ runs: nextRuns, evaluationMode });

  return result;
}

export { DEFAULT_MONTE_CARLO_MODE, DEFAULT_MONTE_CARLO_RUNS, clampMonteCarloRuns };
