import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectSnapshot, ViewSnapshot } from "./types";

const STORAGE_PREFIX = "twinstudio.snapshots";

export function useSnapshots(projectKey: string) {
  const storageKey = `${STORAGE_PREFIX}.${projectKey || "local"}`;
  const [viewSnapshots, setViewSnapshots] = useState<ViewSnapshot[]>([]);
  const [projectSnapshots, setProjectSnapshots] = useState<ProjectSnapshot[]>([]);
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
      } else {
        const parsed = JSON.parse(raw) as { view?: ViewSnapshot[]; project?: ProjectSnapshot[] };
        setViewSnapshots(parsed.view ?? []);
        setProjectSnapshots(parsed.project ?? []);
      }
    } catch {
      setViewSnapshots([]);
      setProjectSnapshots([]);
    } finally {
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
    } catch {
      // ignore quota errors
    }
  }, [isLoaded, projectSnapshots, storageKey, viewSnapshots]);

  const addViewSnapshot = useCallback((snapshot: ViewSnapshot) => {
    setViewSnapshots((prev) => [snapshot, ...prev]);
  }, []);

  const removeViewSnapshot = useCallback((id: string) => {
    setViewSnapshots((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const addProjectSnapshot = useCallback((snapshot: ProjectSnapshot) => {
    setProjectSnapshots((prev) => [snapshot, ...prev]);
  }, []);

  const removeProjectSnapshot = useCallback((id: string) => {
    setProjectSnapshots((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const getProjectSnapshot = useCallback(
    (id: string) => projectSnapshots.find((entry) => entry.id === id) ?? null,
    [projectSnapshots]
  );

  return useMemo(
    () => ({
      viewSnapshots,
      projectSnapshots,
      addViewSnapshot,
      removeViewSnapshot,
      addProjectSnapshot,
      removeProjectSnapshot,
      getProjectSnapshot,
    }),
    [
      addProjectSnapshot,
      addViewSnapshot,
      getProjectSnapshot,
      projectSnapshots,
      removeProjectSnapshot,
      removeViewSnapshot,
      viewSnapshots,
    ]
  );
}
