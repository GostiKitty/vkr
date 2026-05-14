import { create } from "zustand";
const STORAGE_KEY = "twinstudio.engine.base";
const ENV_DEFAULT = import.meta.env?.VITE_ENGINE_BASE?.trim() || "http://127.0.0.1:8010";
const sanitize = (value) => value.trim().replace(/\/+$/, "");
const readInitial = () => {
    if (typeof window === "undefined") {
        return sanitize(ENV_DEFAULT);
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
        return sanitize(stored);
    }
    return sanitize(ENV_DEFAULT);
};
const persist = (value) => {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, value);
};
export const useEngineSettingsStore = create((set) => ({
    baseUrl: readInitial(),
    setBaseUrl: (url) => {
        const normalized = sanitize(url);
        persist(normalized);
        set({ baseUrl: normalized });
    },
    resetToDefault: () => {
        const normalized = sanitize(ENV_DEFAULT);
        persist(normalized);
        set({ baseUrl: normalized });
    },
}));
export const getEngineBaseUrl = () => useEngineSettingsStore.getState().baseUrl;
