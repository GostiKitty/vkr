import { create } from "zustand";
import { isLocalProjectId, normalizeProjectId } from "../../shared/utils/projectRuntime";

export type ProjectKind = "local" | "engine";

interface ProjectState {
  projectId: string | null;
  projectKind: ProjectKind;
  setProjectId: (projectId: string | null, kind?: ProjectKind) => void;
  clearProjectId: () => void;
}

interface StoredProjectPayload {
  id: string | null;
  kind: ProjectKind;
}

const STORAGE_KEY = "twinstudio.project";

const resolveKind = (projectId: string | null, explicit?: ProjectKind): ProjectKind => {
  const normalizedId = normalizeProjectId(projectId);
  if (!normalizedId) {
    return "local";
  }
  if (isLocalProjectId(normalizedId)) {
    return "local";
  }
  if (explicit) {
    return explicit;
  }
  return "engine";
};

const readStoredProject = (): StoredProjectPayload => {
  if (typeof window === "undefined") {
    return { id: null, kind: "local" };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { id: null, kind: "local" };
  }
  try {
    const parsed = JSON.parse(raw) as StoredProjectPayload;
    if (typeof parsed.id === "string" || parsed.id === null) {
      const normalizedId = normalizeProjectId(parsed.id);
      return {
        id: normalizedId,
        kind: resolveKind(normalizedId, parsed.kind === "engine" ? "engine" : "local"),
      };
    }
  } catch {
    // ignore legacy format
  }
  const fallbackId = normalizeProjectId(raw);
  return {
    id: fallbackId,
    kind: resolveKind(fallbackId),
  };
};

const persistProject = (payload: StoredProjectPayload) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const useProjectStore = create<ProjectState>((set) => {
  const initial = readStoredProject();
  return {
    projectId: initial.id,
    projectKind: initial.kind,
    setProjectId: (projectId, kind) => {
      const normalizedId = normalizeProjectId(projectId);
      const nextKind = resolveKind(normalizedId, kind);
      persistProject({ id: normalizedId, kind: nextKind });
      set({ projectId: normalizedId, projectKind: nextKind });
    },
    clearProjectId: () => {
      persistProject({ id: null, kind: "local" });
      set({ projectId: null, projectKind: "local" });
    },
  };
});
