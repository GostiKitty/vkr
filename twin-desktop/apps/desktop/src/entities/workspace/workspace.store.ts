import { create } from "zustand";

export type WorkspaceMode = "plan" | "view3d" | "networks" | "thermal" | "results";

export type WorkspaceProjectCommand =
  | "import-ifc"
  | "new-project"
  | "open-project"
  | "open-demo"
  | "save"
  | "export-report";

export const WORKSPACE_MODES: Array<{ id: WorkspaceMode; label: string; title: string }> = [
  { id: "plan", label: "План", title: "Планировка и ограждения" },
  { id: "view3d", label: "3D", title: "Объёмная модель" },
  { id: "networks", label: "Сети", title: "Инженерные сети" },
  { id: "thermal", label: "Теплокарта", title: "Температурное поле" },
  { id: "results", label: "Результаты", title: "Расчёт и отчёт" },
];

interface WorkspaceState {
  mode: WorkspaceMode;
  command: WorkspaceProjectCommand | null;
  commandNonce: number;
  setMode: (mode: WorkspaceMode) => void;
  dispatchProjectCommand: (command: WorkspaceProjectCommand) => void;
  consumeProjectCommand: (nonce: number) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mode: "plan",
  command: null,
  commandNonce: 0,
  setMode: (mode) => set({ mode }),
  dispatchProjectCommand: (command) =>
    set((state) => ({
      command,
      commandNonce: state.commandNonce + 1,
    })),
  consumeProjectCommand: (nonce) =>
    set((state) => (state.commandNonce === nonce ? { command: null } : state)),
}));
