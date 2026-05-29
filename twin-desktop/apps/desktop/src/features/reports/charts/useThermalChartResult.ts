import { useMemo } from "react";
import { buildAdjacencyGraph } from "../../../core/graph/adjacency";
import {
  runThermalSimulation,
  type ThermalSimulationOptions,
  type ThermalSimulationResult,
} from "../../../core/thermal/solver";
import { useTwinStore } from "../../../entities/twin/twin.store";
import { useWorkflowStore } from "../../../entities/workflow/workflow.store";
import { useBuildStore } from "../../build/build.store";
import { applyScenarioToBuilding } from "../../build/thermal/applyScenarioToBuilding";
import { buildThermalOptionsFromWorkflow } from "../../build/thermal/workflowThermalOptions";
import { getResultSyncState, type ResultSyncState } from "../../../shared/utils/modelSync";

export interface ThermalChartRoomOption {
  id: string;
  label: string;
}

export interface ThermalChartModel {
  chartResult: ThermalSimulationResult | null;
  chartRoomOptions: ThermalChartRoomOption[];
  chartRoomId: string | null;
  resultState: ResultSyncState;
  /** Нет сохранённого прогона, но есть предпросмотр по текущей модели и сценарию. */
  chartPreview: boolean;
  simulationSource: "demo" | "computed" | null;
  activeOptions: ThermalSimulationOptions;
}

/** RC-ряд по текущей модели конструктора и сценарию (не кэш демо-twin). */
export function useThermalChartResult(): ThermalChartModel {
  const result = useTwinStore((state) => state.lastThermalResult);
  const resultBinding = useTwinStore((state) => state.lastThermalResultBinding);
  const simulationSource = useTwinStore((state) => state.simulationDataSource);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const buildModel = useBuildStore((state) => state.model);
  const projectKey = useBuildStore((state) => state.projectKey);
  const modelRevision = useBuildStore((state) => state.modelRevision);
  const activeOptions = useMemo(() => buildThermalOptionsFromWorkflow(scenarioConfig), [scenarioConfig]);

  const resultState = getResultSyncState(Boolean(result), resultBinding, projectKey, modelRevision);
  const visibleResult = resultState === "current" ? result : null;

  const chartResult = useMemo(() => {
    if (resultState === "stale" || !buildModel.rooms.length) {
      return null;
    }
    try {
      const adjacency = buildAdjacencyGraph(buildModel);
      const modelForSim = applyScenarioToBuilding(buildModel, scenarioConfig);
      return runThermalSimulation(modelForSim, activeOptions, adjacency);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[useThermalChartResult] live RC run failed, using stored result", error);
      }
      return visibleResult;
    }
  }, [activeOptions, buildModel, modelRevision, resultState, scenarioConfig, visibleResult]);

  const chartPreview = resultState === "missing" && chartResult != null;

  const chartRoomOptions = useMemo<ThermalChartRoomOption[]>(() => {
    if (!chartResult) {
      return [];
    }
    return buildModel.rooms
      .filter((room) => chartResult.rooms[room.id])
      .map((room) => ({
        id: room.id,
        label: room.name?.trim() || room.id,
      }));
  }, [buildModel.rooms, chartResult]);

  const chartRoomId = useMemo(() => {
    if (!chartResult) {
      return null;
    }
    if (selectedSpaceId && chartResult.rooms[selectedSpaceId]) {
      return selectedSpaceId;
    }
    const firstWithData = chartRoomOptions.find((opt) => {
      const room = chartResult.rooms[opt.id];
      return room && room.timeline.length > 0 && room.timeline.some((pt) => Number.isFinite(pt.temperatureC));
    });
    return firstWithData?.id ?? chartRoomOptions[0]?.id ?? null;
  }, [chartResult, selectedSpaceId, chartRoomOptions]);

  return {
    chartResult,
    chartRoomOptions,
    chartRoomId,
    resultState,
    chartPreview,
    simulationSource,
    activeOptions,
  };
}
