import { useEffect, useMemo } from "react";
import { useTwinStore } from "../../entities/twin/twin.store";
import { fetchTwin } from "./twin.api";
import { buildSpaceInstances, buildThermalGraph, simulateThermalGraph } from "./twin.engine";
export function useTwin(projectId, projectKind) {
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
        const safeProjectId = normalizedProjectId;
        const controller = new AbortController();
        let isMounted = true;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchTwin(safeProjectId, controller.signal);
                if (!isMounted) {
                    return;
                }
                setTwin(data);
            }
            catch (err) {
                if (!isMounted) {
                    return;
                }
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }
                const message = err instanceof Error ? err.message : "�� ������� ��������� ��������";
                setError(message);
                setTwin(null);
            }
            finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }
        load();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [projectId, projectKind, reset, setError, setLoading, setTwin]);
    useEffect(() => {
        if (!twin) {
            setSpaceInstances([]);
            setThermalGraph(null);
            setSimulationFrames([]);
            return;
        }
        const spaces = twin.spaces ?? [];
        const instances = buildSpaceInstances(spaces);
        setSpaceInstances(instances);
        const graph = buildThermalGraph(spaces, instances);
        setThermalGraph(graph);
        setSimulationFrames(simulateThermalGraph(graph));
    }, [setSpaceInstances, setThermalGraph, setSimulationFrames, twin]);
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
