import { create } from "zustand";
const MAX_LOGS = 200;
export const useNetworkLogStore = create((set) => ({
    logs: [],
    startLog: (entry) => {
        const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
        const newEntry = { id, ...entry };
        set((state) => {
            const next = [newEntry, ...state.logs];
            return { logs: next.slice(0, MAX_LOGS) };
        });
        return id;
    },
    finishLog: (id, patch) => set((state) => ({
        logs: state.logs.map((log) => (log.id === id ? { ...log, ...patch } : log)),
    })),
    clear: () => set({ logs: [] }),
}));
export function logRequestStart(method, url) {
    return useNetworkLogStore.getState().startLog({ method, url, startedAt: Date.now() });
}
export function logRequestEnd(id, info) {
    useNetworkLogStore.getState().finishLog(id, info);
}
