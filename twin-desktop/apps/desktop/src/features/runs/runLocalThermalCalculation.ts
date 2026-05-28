import { useProjectStore } from "../../entities/project/project.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { syncBuildSimulationToStudio } from "../../core/thermal/thermalSimulationExport";
import { runThermalSimulation, type ThermalSimulationResult } from "../../core/thermal/solver";
import { writeAgentDebugLog } from "../../shared/utils/agentDebugLog";
import { useBuildStore } from "../build/build.store";
import { applyScenarioToBuilding } from "../build/thermal/applyScenarioToBuilding";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";

export function runLocalThermalCalculation(): ThermalSimulationResult {
  const { model: buildModel, projectKey, modelRevision } = useBuildStore.getState();
  const { projectId, projectKind } = useProjectStore.getState();
  const workflowState = useWorkflowStore.getState();
  const simulationOptions = buildThermalOptionsFromWorkflow(workflowState.scenarioConfig);

  if (!buildModel.rooms.length) {
    throw new Error("Добавьте помещения и стены в режиме конструирования, чтобы запустить расчёт.");
  }

  writeAgentDebugLog({
    sessionId: "c3d591",
    runId: "repro-4",
    hypothesisId: "H2",
    location: "runLocalThermalCalculation.ts:before",
    message: "local simulation run start",
    data: {
      projectId,
      projectKind,
      projectKey,
      modelRevision,
      rooms: buildModel.rooms.length,
      walls: buildModel.walls.length,
      levels: buildModel.levels.length,
      sourceProjectId: typeof buildModel.meta?.sourceProjectId === "string" ? buildModel.meta.sourceProjectId : null,
    },
    timestamp: Date.now(),
  });

  const adjacency = buildAdjacencyGraph(buildModel);
  const modelForSim = applyScenarioToBuilding(buildModel, workflowState.scenarioConfig);
  const simulation = runThermalSimulation(modelForSim, simulationOptions, adjacency);

  syncBuildSimulationToStudio(modelForSim, simulation, adjacency, {
    projectKey,
    modelRevision,
  });

  writeAgentDebugLog({
    sessionId: "c3d591",
    runId: "repro-4",
    hypothesisId: "H2",
    location: "runLocalThermalCalculation.ts:after",
    message: "local simulation run complete",
    data: {
      projectKey,
      modelRevision,
      resultRooms: Object.keys(simulation.rooms).length,
      timeline: simulation.timeline.length,
      peakLoadKW: simulation.summary.peakLoadKW,
      totalEnergyKWh: simulation.summary.totalEnergyKWh,
    },
    timestamp: Date.now(),
  });

  if (import.meta.env.DEV) {
    console.debug("[analysis-sync] local-rc-run", {
      projectKey,
      modelRevision,
      rooms: buildModel.rooms.length,
      walls: buildModel.walls.length,
    });
  }

  workflowState.pushScenarioRunSnapshot({
    label: workflowState.scenarioConfig?.climateCityId ?? "Прогон",
    peakLoadKW: simulation.summary.peakLoadKW,
    totalEnergyKWh: simulation.summary.totalEnergyKWh,
    discomfortHours: simulation.summary.discomfortHours,
  });
  workflowState.markSolveCompleted(true);

  return simulation;
}
