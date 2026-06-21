import { useProjectStore } from "../../entities/project/project.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { syncBuildSimulationToStudio } from "../../core/thermal/thermalSimulationExport";
import { runThermalSimulation } from "../../core/thermal/solver";
import { useBuildStore } from "../build/build.store";
import { applyScenarioToBuilding } from "../build/thermal/applyScenarioToBuilding";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
export const MISSING_BUILD_GEOMETRY_MESSAGE = "Добавьте помещения и стены в режиме конструирования, чтобы запустить расчёт.";
export function runLocalThermalCalculation() {
    const { model: buildModel, projectKey, modelRevision } = useBuildStore.getState();
    const { projectId } = useProjectStore.getState();
    const workflowState = useWorkflowStore.getState();
    if (!buildModel.rooms.length) {
        throw new Error(MISSING_BUILD_GEOMETRY_MESSAGE);
    }
    const adjacency = buildAdjacencyGraph(buildModel);
    const modelForSim = applyScenarioToBuilding(buildModel, workflowState.scenarioConfig);
    const simulationOptions = buildThermalOptionsFromWorkflow(workflowState.scenarioConfig, undefined, modelForSim, { dayOfYear: useBuildStore.getState().solarTime?.dayOfYear });
    const simulation = runThermalSimulation(modelForSim, simulationOptions, adjacency);
    syncBuildSimulationToStudio(modelForSim, simulation, adjacency, {
        projectKey,
        modelRevision,
        projectId,
    });
    if (import.meta.env.DEV) {
        console.debug("[analysis-sync] local-rc-run", {
            projectKey,
            modelRevision,
            rooms: buildModel.rooms.length,
            walls: buildModel.walls.length,
        });
    }
    const runNumber = workflowState.scenarioRunHistory.length + 1;
    const cityId = workflowState.scenarioConfig?.climateCityId ?? null;
    workflowState.pushScenarioRunSnapshot({
        label: `Прогон ${runNumber}${cityId ? ` · ${cityId}` : ""}`,
        peakLoadKW: simulation.summary.peakLoadKW,
        totalEnergyKWh: simulation.summary.totalEnergyKWh,
        discomfortHours: simulation.summary.discomfortHours,
        infiltrationACH: simulation.diagnostics?.building.infiltration?.calculatedACH ??
            simulationOptions.infiltrationACH ??
            null,
        ventilationACH: simulationOptions.ventilationACH ?? null,
        setpointDayC: simulationOptions.setpoints?.day ?? null,
        climateCityId: cityId,
    });
    workflowState.markSolveCompleted(true);
    return simulation;
}
