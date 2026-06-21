import { useBuildStore } from "../../src/features/build/build.store.js";
import {
  buildVideoDemoProjectModel,
  isVideoDemoProjectModel,
  VIDEO_DEMO_PROJECT_ID,
  VIDEO_DEMO_PROJECT_SOURCE,
} from "../../src/features/build/demoVideoProject.js";
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
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      location: { pathname: "/" },
      history: { pushState: () => undefined },
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

test("demo-video preset is tagged as a dedicated demo project", () => {
  const model = buildVideoDemoProjectModel();
  if (!isVideoDemoProjectModel(model)) {
    throw new Error("Video demo model should be recognized by its metadata.");
  }
  if (model.meta?.projectSource !== VIDEO_DEMO_PROJECT_SOURCE) {
    throw new Error("Video demo model should store its project source in metadata.");
  }
});

test("demo-video preset can be saved and restored via persisted build project", () => {
  const restoreWindow = installMemoryStorage();
  try {
    const store = useBuildStore.getState();
    const demoModel = buildVideoDemoProjectModel();
    store.setProjectKey(VIDEO_DEMO_PROJECT_ID);
    useBuildStore.getState().loadModelSnapshot(demoModel);
    store.setProjectKey("local:other-project");
    store.setProjectKey(VIDEO_DEMO_PROJECT_ID);
    const restored = useBuildStore.getState().model;
    if (!isVideoDemoProjectModel(restored)) {
      throw new Error("Persisted demo-video preset should be restored after switching projects.");
    }
    if (!restored.rooms.length || !restored.walls.length || !restored.roofs?.length || !restored.floorSlabs?.length) {
      throw new Error("Restored demo-video project should preserve the main shell geometry.");
    }
  } finally {
    restoreWindow();
  }
});
