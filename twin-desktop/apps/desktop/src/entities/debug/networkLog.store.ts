import { create } from "zustand";

export interface NetworkLogEntry {
  id: string;
  method: string;
  url: string;
  startedAt: number;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  error?: string;
  responseSnippet?: string;
}

interface NetworkLogState {
  logs: NetworkLogEntry[];
  startLog: (entry: Omit<NetworkLogEntry, "id" | "status" | "ok" | "durationMs" | "error" | "responseSnippet">) => string;
  finishLog: (id: string, patch: Partial<NetworkLogEntry>) => void;
  clear: () => void;
}

const MAX_LOGS = 200;

export const useNetworkLogStore = create<NetworkLogState>((set) => ({
  logs: [],
  startLog: (entry) => {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const newEntry: NetworkLogEntry = { id, ...entry };
    set((state) => {
      const next = [newEntry, ...state.logs];
      return { logs: next.slice(0, MAX_LOGS) };
    });
    return id;
  },
  finishLog: (id, patch) =>
    set((state) => ({
      logs: state.logs.map((log) => (log.id === id ? { ...log, ...patch } : log)),
    })),
  clear: () => set({ logs: [] }),
}));

export function logRequestStart(method: string, url: string): string {
  return useNetworkLogStore.getState().startLog({ method, url, startedAt: Date.now() });
}

export function logRequestEnd(
  id: string,
  info: Pick<NetworkLogEntry, "status" | "ok" | "durationMs" | "error" | "responseSnippet">
) {
  useNetworkLogStore.getState().finishLog(id, info);
}
