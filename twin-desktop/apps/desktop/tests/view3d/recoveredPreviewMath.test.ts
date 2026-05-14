import { sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import { buildRecovered3DModel } from "../../src/features/build/view3d/buildRecovered3DModel.js";
import {
  calculateRecoveredCameraFrame,
  calculateRecoveredGrid,
} from "../../src/features/build/view3d/recoveredPreviewMath.js";
import { test } from "../testHarness.js";

test("recovered camera fit returns finite frame", () => {
  const recovered = buildRecovered3DModel(sampleBuildingSP50, "level-1");
  const frame = calculateRecoveredCameraFrame(recovered.bounds, "focus");
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
    throw new Error("Recovered camera frame should not contain NaN or Infinity.");
  }
});

test("recovered top view stays centered on model bounds", () => {
  const recovered = buildRecovered3DModel(sampleBuildingSP50, "level-1");
  const frame = calculateRecoveredCameraFrame(recovered.bounds, "top");
  if (Math.abs(frame.target.x - recovered.bounds.center.x) > 1e-6 || Math.abs(frame.target.z - recovered.bounds.center.z) > 1e-6) {
    throw new Error("Recovered top view should use the same model center.");
  }
});

test("recovered grid derives from model bounds", () => {
  const recovered = buildRecovered3DModel(sampleBuildingSP50, "level-1");
  const grid = calculateRecoveredGrid(recovered.bounds);
  if (!(grid.size >= Math.max(recovered.bounds.size.x, recovered.bounds.size.y, recovered.bounds.size.z))) {
    throw new Error("Recovered grid should scale from model bounds.");
  }
});
