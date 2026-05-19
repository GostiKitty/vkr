import { useEffect, useMemo } from "react";
import { useTwinStore } from "../../entities/twin/twin.store";
import type { ProjectKind } from "../../entities/project/project.store";
import { fetchTwin } from "./twin.api";
import { buildSpaceInstances, buildThermalGraph, simulateThermalGraph } from "./twin.engine";
import type { UseTwinResult } from "./twin.types";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";

const RECONNECT_DELAY_MS = 5000;

export function useTwin(projectId: string | null, projectKind: ProjectKind): UseTwinResult {
  const twin = useTwinStore((state) => state.twin);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const selectSpace = useTwinStore((state) => state.selectSpace);
  const loading = useTwinStore((state) => state.loading);
  const error = useTwinStore((state) => state.error);
  const setTwin = useTwinStore((state) => state.setTwin);
  const setLoading = useTwinStore((state) => state.setLoading);
  const setError = useTwinStore((state) => state.setError);
  const reset = useTwinStore((state) => state.reset);
  const setSpaceInstances = useTwinStore((state) => state.setSpaceInstances);
  const setThermalGraph = useTwinStore((state) => state.setThermalGraph);
  const setSimulationFrames = useTwinStore((state) => state.setSimulationFrames);
  const setSimulationResult = useTwinStore((state) => state.setSimulationResult);
  const clearSimulation = useTwinStore((state) => state.clearSimulation);
  const engineBase = useEngineSettingsStore((state) => state.baseUrl.trim());

  useEffect(() => {
    const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : "";

    if (!normalizedProjectId) {
      reset();
      return;
    }

    if (projectKind === "local" || normalizedProjectId.startsWith("local:")) {
      setLoading(false);
      setError(null);
      return;
    }

    if (!engineBase) {
      setLoading(false);
      setError("Движок не настроен. Укажите URL в разделе «Настройки».");
      return;
    }

    const safeProjectId = normalizedProjectId;
    const controller = new AbortController();
    let isMounted = true;
    let retryTimeoutId = 0;

    const handleConnectionLoss = (message: string) => {
      if (!isMounted) {
        return;
      }
      setLoading(false);
      setError(`${message} Повторяю подключение…`);
      retryTimeoutId = window.setTimeout(() => {
        if (!controller.signal.aborted) {
          void load(true);
        }
      }, RECONNECT_DELAY_MS);
    };

    const handleReconnect = (data: Awaited<ReturnType<typeof fetchTwin>>) => {
      if (!isMounted) {
        return;
      }
      clearSimulation();
      setTwin(data);
      setError(null);
      setLoading(false);
    };

    async function load(isRetry = false) {
      if (!isRetry || !twin) {
        setLoading(true);
      }
      if (!isRetry) {
        setError(null);
      }
      try {
        const data = await fetchTwin(safeProjectId, controller.signal, true);
        handleReconnect(data);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : "Не удалось загрузить двойника";
        handleConnectionLoss(message);
      }
    }

    void load();

    return () => {
      isMounted = false;
      window.clearTimeout(retryTimeoutId);
      controller.abort();
    };
  }, [clearSimulation, engineBase, projectId, projectKind, reset, setError, setLoading, setTwin, twin]);

  useEffect(() => {
    const { simulationDataSource } = useTwinStore.getState();
    if (!twin) {
      if (simulationDataSource !== "computed") {
        setSpaceInstances([]);
        setThermalGraph(null);
        setSimulationFrames([]);
      }
      return;
    }
    if (simulationDataSource === "computed") {
      return;
    }
    const spaces = twin.spaces ?? [];
    const instances = buildSpaceInstances(spaces);
    const graph = buildThermalGraph(spaces, instances);
    const frames = simulateThermalGraph(graph);
    setSpaceInstances(instances);
    setSimulationResult({
      frames,
      graph,
      result: null,
      source: "demo",
    });
  }, [setSimulationFrames, setSimulationResult, setSpaceInstances, setThermalGraph, twin]);

  const spaces = useMemo(() => twin?.spaces ?? [], [twin]);
  const selectedSpace = useMemo(() => {
    if (!selectedSpaceId) {
      return null;
    }
    return spaces.find((space) => space.id === selectedSpaceId) ?? null;
  }, [spaces, selectedSpaceId]);

  return {
    twin,
    spaces,
    selectedSpace,
    selectSpace,
    loading,
    error,
  };
}
