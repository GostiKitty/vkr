import { create } from "zustand";

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
      return {
        id: parsed.id,
        kind: parsed.kind === "engine" ? "engine" : "local",
      };
    }
  } catch {
    // ignore legacy format
  }
  const fallbackId = raw;
  return {
    id: fallbackId,
    kind: fallbackId?.startsWith("local:") ? "local" : "engine",
  };
};

const persistProject = (payload: StoredProjectPayload) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const resolveKind = (projectId: string | null, explicit?: ProjectKind): ProjectKind => {
  if (!projectId) {
    return "local";
  }
  if (explicit) {
    return explicit;
  }
  return projectId.startsWith("local:") ? "local" : "engine";
};

export const useProjectStore = create<ProjectState>((set) => {
  const initial = readStoredProject();
  return {
    projectId: initial.id,
    projectKind: initial.kind,
    setProjectId: (projectId, kind) => {
      const nextKind = resolveKind(projectId, kind);
      persistProject({ id: projectId, kind: nextKind });
      set({ projectId, projectKind: nextKind });
    },
    clearProjectId: () => {
      persistProject({ id: null, kind: "local" });
      set({ projectId: null, projectKind: "local" });
    },
  };
});
