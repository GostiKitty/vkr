import { computeWallJoinData } from "../../src/features/build/view3d/wallJoins.js";
import { DEFAULT_BUILD_SCENE_DEBUG_OPTIONS } from "../../src/features/build/view3d/sceneContracts.js";
import { test } from "../testHarness.js";

const baseLevel = [{ id: "level-1", name: "Этаж 1", elevation_m: 0, height_m: 3 }];

test("two perpendicular walls get join extensions without gap", () => {
  const model = {
    levels: baseLevel,
    walls: [
      {
        id: "w1",
        levelId: "level-1",
        a: { x: 0, y: 0 },
        b: { x: 4, y: 0 },
        thickness_m: 0.24,
        height_m: 3,
      },
      {
        id: "w2",
        levelId: "level-1",
        a: { x: 4, y: 0 },
        b: { x: 4, y: 4 },
        thickness_m: 0.24,
        height_m: 3,
      },
    ],
  };
  const result = computeWallJoinData(model as never);
  if ((result.extensions.get("w1")?.end ?? 0) <= 0 || (result.extensions.get("w2")?.start ?? 0) <= 0) {
    throw new Error("Joined walls should receive end extensions to close right-angle gaps.");
  }
});

test("shared endpoint produces optional corner debug patch data", () => {
  const model = {
    levels: baseLevel,
    walls: [
      {
        id: "w1",
        levelId: "level-1",
        a: { x: 0, y: 0 },
        b: { x: 3, y: 0 },
        thickness_m: 0.2,
        height_m: 3,
      },
      {
        id: "w2",
        levelId: "level-1",
        a: { x: 3, y: 0 },
        b: { x: 3, y: 3 },
        thickness_m: 0.2,
        height_m: 3,
      },
    ],
  };
  const result = computeWallJoinData(model as never);
  if (!result.corners.length) {
    throw new Error("Join helper should still produce debug corner patch data.");
  }
  if (result.corners.length !== 1) {
    throw new Error("A simple right-angle join should not create duplicate corner patches.");
  }
});

test("corner debug blocks are disabled by default", () => {
  if (DEFAULT_BUILD_SCENE_DEBUG_OPTIONS.showWallDebugCorners !== false) {
    throw new Error("Wall debug corners should be disabled by default.");
  }
});
