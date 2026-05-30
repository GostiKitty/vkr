import { create } from "zustand";
/**
 * Команды "открыть документ для печати / PDF".
 */
export const EXPORT_REPORT_COMMANDS = [
    "export-project-ov-ts",
    "export-thermal-protection",
    "export-energy-passport",
    "export-operation-passport",
    "export-engineering-summary",
];
/**
 * Команды "скачать документ как HTML".
 */
export const DOWNLOAD_REPORT_COMMANDS = [
    "download-project-ov-ts",
    "download-thermal-protection",
    "download-energy-passport",
    "download-operation-passport",
    "download-engineering-summary",
];
export function isExportReportCommand(command) {
    return (command === "export-project-ov-ts" ||
        command === "export-thermal-protection" ||
        command === "export-energy-passport" ||
        command === "export-operation-passport" ||
        command === "export-engineering-summary");
}
export function isDownloadReportCommand(command) {
    return (command === "download-project-ov-ts" ||
        command === "download-thermal-protection" ||
        command === "download-energy-passport" ||
        command === "download-operation-passport" ||
        command === "download-engineering-summary");
}
export const WORKSPACE_MODES = [
    { id: "plan", label: "План", title: "Планировка и ограждения" },
    { id: "view3d", label: "3D", title: "Объёмная модель" },
    { id: "networks", label: "Сети", title: "Инженерные сети" },
    { id: "results", label: "Сводка", title: "Сводка конструктора" },
];
export const useWorkspaceStore = create((set) => ({
    mode: "plan",
    command: null,
    commandNonce: 0,
    applyDemoDefaults: false,
    setMode: (mode) => set({ mode }),
    dispatchProjectCommand: (command) => set((state) => ({
        command,
        commandNonce: state.commandNonce + 1,
    })),
    consumeProjectCommand: (nonce) => set((state) => (state.commandNonce === nonce ? { command: null } : state)),
    setApplyDemoDefaults: (value) => set({ applyDemoDefaults: value }),
}));
