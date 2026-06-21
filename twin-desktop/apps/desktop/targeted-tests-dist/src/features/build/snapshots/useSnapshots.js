import { useCallback, useEffect, useMemo, useState } from "react";
const STORAGE_PREFIX = "twinstudio.snapshots";
export function useSnapshots(projectKey) {
    const storageKey = `${STORAGE_PREFIX}.${projectKey || "local"}`;
    const [viewSnapshots, setViewSnapshots] = useState([]);
    const [projectSnapshots, setProjectSnapshots] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    useEffect(() => {
        setIsLoaded(false);
        if (typeof window === "undefined") {
            setViewSnapshots([]);
            setProjectSnapshots([]);
            setIsLoaded(true);
            return;
        }
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
                setViewSnapshots([]);
                setProjectSnapshots([]);
            }
            else {
                const parsed = JSON.parse(raw);
                setViewSnapshots(parsed.view ?? []);
                setProjectSnapshots(parsed.project ?? []);
            }
        }
        catch {
            setViewSnapshots([]);
            setProjectSnapshots([]);
        }
        finally {
            setIsLoaded(true);
        }
    }, [storageKey]);
    useEffect(() => {
        if (!isLoaded || typeof window === "undefined") {
            return;
        }
        try {
            const payload = JSON.stringify({ view: viewSnapshots, project: projectSnapshots });
            window.localStorage.setItem(storageKey, payload);
        }
        catch {
            // ignore quota errors
        }
    }, [isLoaded, projectSnapshots, storageKey, viewSnapshots]);
    const addViewSnapshot = useCallback((snapshot) => {
        setViewSnapshots((prev) => [snapshot, ...prev]);
    }, []);
    const removeViewSnapshot = useCallback((id) => {
        setViewSnapshots((prev) => prev.filter((entry) => entry.id !== id));
    }, []);
    const addProjectSnapshot = useCallback((snapshot) => {
        setProjectSnapshots((prev) => [snapshot, ...prev]);
    }, []);
    const removeProjectSnapshot = useCallback((id) => {
        setProjectSnapshots((prev) => prev.filter((entry) => entry.id !== id));
    }, []);
    const getProjectSnapshot = useCallback((id) => projectSnapshots.find((entry) => entry.id === id) ?? null, [projectSnapshots]);
    return useMemo(() => ({
        viewSnapshots,
        projectSnapshots,
        addViewSnapshot,
        removeViewSnapshot,
        addProjectSnapshot,
        removeProjectSnapshot,
        getProjectSnapshot,
    }), [
        addProjectSnapshot,
        addViewSnapshot,
        getProjectSnapshot,
        projectSnapshots,
        removeProjectSnapshot,
        removeViewSnapshot,
        viewSnapshots,
    ]);
}
