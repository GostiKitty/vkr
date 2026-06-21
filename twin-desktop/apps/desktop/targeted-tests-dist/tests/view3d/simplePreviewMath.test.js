import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import Build3DSimplePreview from "../../src/features/build/view3d/Build3DSimplePreview.js";
import { buildSimplePreviewBounds, calculateSimplePreviewCamera, calculateSimplePreviewGrid, resolveSimplePreviewLevelId, } from "../../src/features/build/view3d/simplePreviewMath.js";
import { test } from "../testHarness.js";
test("simple preview imports safely", () => {
    if (typeof Build3DSimplePreview !== "object" && typeof Build3DSimplePreview !== "function") {
        throw new Error("Build3DSimplePreview should export a React component.");
    }
});
test("simple preview builds shell bounds for demo model", () => {
    const bounds = buildSimplePreviewBounds(sampleBuildingSP50, "level-1");
    if (bounds.empty) {
        throw new Error("Expected non-empty bounds for demo shell.");
    }
    if (!(bounds.size.x > 0) || !(bounds.size.z > 0)) {
        throw new Error("Shell bounds should have positive plan dimensions.");
    }
});
test("simple preview camera fit returns finite position and target", () => {
    const bounds = buildSimplePreviewBounds(sampleBuildingSP50, "level-1");
    const frame = calculateSimplePreviewCamera(bounds);
    const values = [
        frame.position.x,
        frame.position.y,
        frame.position.z,
        frame.target.x,
        frame.target.y,
        frame.target.z,
        frame.distance,
        frame.near,
        frame.far,
    ];
    if (values.some((value) => !Number.isFinite(value))) {
        throw new Error("Simple preview camera should not contain NaN or Infinity.");
    }
});
test("simple preview grid derives from shell bounds", () => {
    const bounds = buildSimplePreviewBounds(sampleBuildingSP50, "level-1");
    const grid = calculateSimplePreviewGrid(bounds);
    if (!(grid.size >= Math.max(bounds.size.x, bounds.size.y, bounds.size.z))) {
        throw new Error("Grid should scale from shell bounds.");
    }
});
test("simple preview empty model stays empty", () => {
    const bounds = buildSimplePreviewBounds(createEmptyBuildingModel(), null);
    if (!bounds.empty) {
        throw new Error("Empty building model should produce empty preview bounds.");
    }
});
test("simple preview tolerates legacy model without roof and slabs", () => {
    const legacyModel = {
        ...sampleBuildingSP50,
        roofs: [],
        floorSlabs: [],
    };
    const resolved = resolveSimplePreviewLevelId(legacyModel, "level-1");
    const bounds = buildSimplePreviewBounds(legacyModel, resolved);
    if (bounds.empty) {
        throw new Error("Legacy model should still render walls and rooms in simple preview.");
    }
});
test("simple preview shell does not depend on networks", () => {
    const shellOnlyModel = {
        ...sampleBuildingSP50,
        pipes: [],
        ducts: [],
        equipment: [],
        sensors: [],
    };
    const bounds = buildSimplePreviewBounds(shellOnlyModel, "level-1");
    if (bounds.empty) {
        throw new Error("Shell preview should remain available without networks.");
    }
});
