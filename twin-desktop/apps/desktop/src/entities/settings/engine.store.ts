import { create } from "zustand";
import { isLocalEngineUrl, isWebProductionRuntime } from "../../shared/runtime/webProduction";

const STORAGE_KEY = "twinstudio.engine.base";
/** Совпадает с примером в Settings и портом dev:engine. */
export const DEFAULT_ENGINE_BASE_URL = "http://127.0.0.1:8010";
const ENV_DEFAULT = (
  (import.meta.env?.VITE_ENGINE_BASE as string | undefined) ?? DEFAULT_ENGINE_BASE_URL
).trim();

const sanitize = (value: string): string => value.trim().replace(/\/+$/, "");

const readInitial = (): string => {
  const envValue = sanitize(ENV_DEFAULT);
  if (typeof window === "undefined") {
    return envValue;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    const normalizedStored = sanitize(stored);
    if (isWebProductionRuntime() && isLocalEngineUrl(normalizedStored)) {
      return envValue;
    }
    return normalizedStored;
  }
  return envValue;
};

const persist = (value: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, value);
};

interface EngineSettingsState {
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  resetToDefault: () => void;
}

export const useEngineSettingsStore = create<EngineSettingsState>((set) => ({
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

export const getEngineBaseUrl = (): string => useEngineSettingsStore.getState().baseUrl;
