import { create } from "zustand";

export type WorkspaceMode = "plan" | "view3d" | "networks" | "results";

export type WorkspaceProjectCommand =
  | "import-ifc"
  | "new-project"
  | "open-project"
  | "open-demo"
  | "run-thermal-calculation"
  | "run-full-analysis"
  | "save"
  /**
   * Legacy bridge-команда: оставлена только для переключения на вкладку документов
   * внутри нового Results Hub.
   */
  | "export-report"
  | "export-project-ov-ts"
  | "export-thermal-protection"
  | "export-energy-passport"
  | "export-operation-passport"
  | "export-engineering-summary"
  | "download-project-ov-ts"
  | "download-thermal-protection"
  | "download-energy-passport"
  | "download-operation-passport"
  | "download-engineering-summary"
  | "download-all-exports"
  | "apply-demo-defaults"
  | "clear-demo-defaults";

/**
 * Команды "открыть документ для печати / PDF".
 */
export const EXPORT_REPORT_COMMANDS = [
  "export-project-ov-ts",
  "export-thermal-protection",
  "export-energy-passport",
  "export-operation-passport",
  "export-engineering-summary",
] as const satisfies ReadonlyArray<WorkspaceProjectCommand>;

/**
 * Команды "скачать документ как HTML".
 */
export const DOWNLOAD_REPORT_COMMANDS = [
  "download-project-ov-ts",
  "download-thermal-protection",
  "download-energy-passport",
  "download-operation-passport",
  "download-engineering-summary",
] as const satisfies ReadonlyArray<WorkspaceProjectCommand>;

export type ExportReportCommand = (typeof EXPORT_REPORT_COMMANDS)[number];
export type DownloadReportCommand = (typeof DOWNLOAD_REPORT_COMMANDS)[number];

export function isExportReportCommand(
  command: WorkspaceProjectCommand | null
): command is ExportReportCommand {
  return (
    command === "export-project-ov-ts" ||
    command === "export-thermal-protection" ||
    command === "export-energy-passport" ||
    command === "export-operation-passport" ||
    command === "export-engineering-summary"
  );
}

export function isDownloadReportCommand(
  command: WorkspaceProjectCommand | null
): command is DownloadReportCommand {
  return (
    command === "download-project-ov-ts" ||
    command === "download-thermal-protection" ||
    command === "download-energy-passport" ||
    command === "download-operation-passport" ||
    command === "download-engineering-summary"
  );
}

export const WORKSPACE_MODES: Array<{ id: WorkspaceMode; label: string; title: string }> = [
  { id: "plan", label: "План", title: "Планировка и ограждения" },
  { id: "view3d", label: "3D", title: "Объёмная модель" },
  { id: "networks", label: "Сети", title: "Инженерные сети" },
  { id: "results", label: "Сводка", title: "Сводка конструктора" },
];

interface WorkspaceState {
  mode: WorkspaceMode;
  command: WorkspaceProjectCommand | null;
  commandNonce: number;
  /**
   * Если true, слой выгрузки применяет demo/default profile перед построением
   * экспортных документов.
   */
  applyDemoDefaults: boolean;
  setMode: (mode: WorkspaceMode) => void;
  dispatchProjectCommand: (command: WorkspaceProjectCommand) => void;
  consumeProjectCommand: (nonce: number) => void;
  setApplyDemoDefaults: (value: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  mode: "plan",
  command: null,
  commandNonce: 0,
  applyDemoDefaults: false,
  setMode: (mode) => set({ mode }),
  dispatchProjectCommand: (command) =>
    set((state) => ({
      command,
      commandNonce: state.commandNonce + 1,
    })),
  consumeProjectCommand: (nonce) =>
    set((state) => (state.commandNonce === nonce ? { command: null } : state)),
  setApplyDemoDefaults: (value) => set({ applyDemoDefaults: value }),
}));
