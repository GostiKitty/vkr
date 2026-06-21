import { createTypicalCtpEngineeringSystems } from "../../src/features/build/engineering2d/catalog.js";
import { useBuildStore } from "../../src/features/build/build.store.js";
import { test } from "../testHarness.js";
function installMemoryStorage() {
    const previousWindow = globalThis.window;
    const memory = new Map();
    const localStorage = {
        getItem: (key) => (memory.has(key) ? memory.get(key) : null),
        setItem: (key, value) => {
            memory.set(key, value);
        },
        removeItem: (key) => {
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
function buildLegacyModel() {
    return {
        levels: [{ id: "level-1", name: "Level 1", elevation_m: 0, height_m: 3 }],
        rooms: [
            {
                id: "room-1",
                name: "Room 1",
                levelId: "level-1",
                polygon: [
                    { x: 0, y: 0 },
                    { x: 5, y: 0 },
                    { x: 5, y: 4 },
                    { x: 0, y: 4 },
                ],
            },
        ],
        walls: [
            { id: "wall-1", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, thickness_m: 0.3, height_m: 3 },
            { id: "wall-2", levelId: "level-1", a: { x: 5, y: 0 }, b: { x: 5, y: 4 }, thickness_m: 0.3, height_m: 3 },
            { id: "wall-3", levelId: "level-1", a: { x: 5, y: 4 }, b: { x: 0, y: 4 }, thickness_m: 0.3, height_m: 3 },
            { id: "wall-4", levelId: "level-1", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3 },
        ],
        doors: [],
        windows: [],
        pipes: [],
        ducts: [],
        equipment: [],
        sensors: [],
        scenarios: [],
        activeScenarioId: null,
        events: [],
        meta: {},
    };
}
test("legacy build projects load without engineeringSystems", () => {
    const restoreWindow = installMemoryStorage();
    try {
        const store = useBuildStore.getState();
        store.setProjectKey("local:legacy-no-engineering");
        store.loadModelSnapshot(buildLegacyModel());
        const restored = useBuildStore.getState().model.engineeringSystems;
        if (!restored) {
            throw new Error("Legacy project should receive an empty engineeringSystems section during normalization.");
        }
        if (restored.equipment.length !== 0 || restored.pipes.length !== 0) {
            throw new Error("Legacy project should not invent engineering equipment or pipes.");
        }
    }
    finally {
        restoreWindow();
    }
});
test("engineeringSystems persist typical CTP templates by project key", () => {
    const restoreWindow = installMemoryStorage();
    try {
        const store = useBuildStore.getState();
        const model = buildLegacyModel();
        const engineeringSystems = createTypicalCtpEngineeringSystems("level-1", { x: 2, y: 2 });
        store.setProjectKey("local:engineering-template");
        store.loadModelSnapshot({
            ...model,
            engineeringSystems,
        });
        store.setProjectKey("local:other-project");
        store.setProjectKey("local:engineering-template");
        const restored = useBuildStore.getState().model.engineeringSystems;
        if (!restored || restored.equipment.length < 5 || restored.pipes.length < 5) {
            throw new Error("Typical CTP engineering scheme should survive persistence and restore with multiple blocks and pipes.");
        }
        const equipmentIds = new Set(restored.equipment.map((item) => item.id));
        restored.pipes.forEach((pipe) => {
            if (!equipmentIds.has(pipe.fromEquipmentId) || !equipmentIds.has(pipe.toEquipmentId)) {
                throw new Error("Restored engineering pipes must keep valid equipment references.");
            }
            if (pipe.points.length < 2) {
                throw new Error("Restored engineering pipes should keep their routed polyline geometry.");
            }
        });
    }
    finally {
        restoreWindow();
    }
});
