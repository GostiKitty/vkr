import { buildGeometryRenderModel } from "../../src/core/geometry/bimPipeline.js";
import { sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import {
  getStablePreviewVisibilityStats,
  resolveStablePreviewLevelId,
} from "../../src/features/build/view3d/Build3DStablePreview.js";
import { DEFAULT_STABLE_VIEWER_OPTIONS } from "../../src/features/build/view3d/viewerOptions.js";
import { test } from "../testHarness.js";

test("stable render model keeps shell geometry for demo building", () => {
  const renderModel = buildGeometryRenderModel(sampleBuildingSP50);
  if (!renderModel.roomVolumes.length || !renderModel.walls.length) {
    throw new Error("Stable 3D preview should receive non-empty room and wall geometry.");
  }
});

test("default stable viewer options keep shell visible", () => {
  if (!DEFAULT_STABLE_VIEWER_OPTIONS.showRooms || !DEFAULT_STABLE_VIEWER_OPTIONS.showWalls || !DEFAULT_STABLE_VIEWER_OPTIONS.showOpenings) {
    throw new Error("Stable preview defaults should keep rooms, walls and openings visible.");
  }
});

test("stable preview visibility stats preserve shell without networks", () => {
  const shellOnlyModel = {
    ...sampleBuildingSP50,
    pipes: [],
    ducts: [],
    equipment: [],
    sensors: [],
  };
  const stats = getStablePreviewVisibilityStats(shellOnlyModel, "level-1");
  if (stats.wallCount <= 0 || stats.roomCount <= 0) {
    throw new Error("Stable preview should still report shell geometry when networks are absent.");
  }
});

test("stable preview level fallback keeps valid level and tolerates missing roof and slabs", () => {
  const legacyModel = {
    ...sampleBuildingSP50,
    roofs: [],
    floorSlabs: [],
  };
  const resolved = resolveStablePreviewLevelId(legacyModel, "level-1");
  if (resolved !== "level-1") {
    throw new Error(`Expected level-1 fallback, got ${resolved ?? "null"}.`);
  }
});
