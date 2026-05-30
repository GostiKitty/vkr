import { buildGeometryRenderModel } from "../../src/core/geometry/bimPipeline.js";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { test } from "../testHarness.js";
test("buildGeometryRenderModel tolerates legacy model without roofs and slabs", () => {
    const legacyModel = {
        levels: [{ id: "lvl-1", name: "Level 1", elevation_m: 0, height_m: 3 }],
        rooms: [],
        walls: [],
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
    const render = buildGeometryRenderModel(legacyModel);
    if (!Array.isArray(render.roofs) || render.roofs.length !== 0) {
        throw new Error("Legacy model should produce an empty roof collection.");
    }
    if (!Array.isArray(render.floorSlabs) || render.floorSlabs.length !== 0) {
        throw new Error("Legacy model should produce an empty floor slab collection.");
    }
});
test("buildGeometryRenderModel keeps flat roofs in render output", () => {
    const model = createEmptyBuildingModel();
    model.levels = [{ id: "lvl-1", name: "Level 1", elevation_m: 0, height_m: 3 }];
    model.roofs = [
        {
            id: "roof-1",
            levelId: "lvl-1",
            name: "Main roof",
            kind: "flat",
            boundary: [
                { x: 0, y: 0 },
                { x: 8, y: 0 },
                { x: 8, y: 6 },
                { x: 0, y: 6 },
            ],
            elevationBase_m: 3,
            thickness_m: 0.24,
            heatedSide: "below",
        },
    ];
    const render = buildGeometryRenderModel(model);
    if (render.roofs.length !== 1) {
        throw new Error(`Expected 1 roof in render model, got ${render.roofs.length}.`);
    }
    if (render.roofs[0]?.kind !== "flat") {
        throw new Error("Expected flat roof kind to be preserved.");
    }
});
test("buildGeometryRenderModel keeps floor slabs in render output", () => {
    const model = createEmptyBuildingModel();
    model.levels = [{ id: "lvl-1", name: "Level 1", elevation_m: 0, height_m: 3 }];
    model.floorSlabs = [
        {
            id: "slab-1",
            levelId: "lvl-1",
            name: "Interfloor slab",
            kind: "interfloor",
            boundary: [
                { x: 0, y: 0 },
                { x: 8, y: 0 },
                { x: 8, y: 6 },
                { x: 0, y: 6 },
            ],
            elevation_m: 3,
            thickness_m: 0.22,
            heatedSide: "below",
        },
    ];
    const render = buildGeometryRenderModel(model);
    if (render.floorSlabs.length !== 1) {
        throw new Error(`Expected 1 floor slab in render model, got ${render.floorSlabs.length}.`);
    }
    if (render.floorSlabs[0]?.kind !== "interfloor") {
        throw new Error("Expected floor slab kind to be preserved.");
    }
});
