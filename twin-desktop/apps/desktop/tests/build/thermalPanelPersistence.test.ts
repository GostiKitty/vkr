import {
  buildThermalPanelStorageKey,
  loadThermalPanelState,
  saveThermalPanelState,
} from "../../src/features/build/thermal/thermalPanelPersistence.js";
import { test } from "../testHarness.js";

function installMemoryStorage() {
  const previousWindow = globalThis.window;
  const memory = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => {
      memory.clear();
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage,
    },
  });
  return () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: previousWindow,
    });
  };
}

test("thermal panel results are saved and restored by project key", () => {
  const restoreWindow = installMemoryStorage();
  try {
    const projectKey = "local:test-project";
    const payload = {
      result: { summary: { totalEnergyKWh: 42 } },
      lastHash: "geometry-hash",
      lastCalculatedAtIso: "2026-05-11T12:00:00.000Z",
    };
    saveThermalPanelState(projectKey, payload);
    const restored = loadThermalPanelState<typeof payload>(projectKey);
    if (!restored || restored.lastHash !== payload.lastHash || restored.result.summary.totalEnergyKWh !== 42) {
      throw new Error("Thermal panel state should be restored from localStorage by project key.");
    }
    if (!buildThermalPanelStorageKey(projectKey).includes(projectKey)) {
      throw new Error("Storage key should include the project key to isolate persisted results.");
    }
  } finally {
    restoreWindow();
  }
});
