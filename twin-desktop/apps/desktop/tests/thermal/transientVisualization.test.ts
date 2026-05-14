import { buildTransientScenarioPreset } from "../../src/core/thermal/transient/scenarios.js";
import { solveTransient1DExplicit } from "../../src/core/thermal/transient/finiteDifference1D.js";
import { buildTransientVisualizationFrame, clampTransientTimeIndex, transientSourceMatches } from "../../src/features/build/thermal/transientVisualization.js";
import type { TransientLayer } from "../../src/core/thermal/transient/types.js";
import { test } from "../testHarness.js";

const LAYERS: TransientLayer[] = [
  {
    id: "brick",
    materialId: "ceramic_brick",
    name: "Кирпич",
    thickness_m: 0.25,
    lambda_W_mK: 0.81,
    density_kg_m3: 1800,
    heatCapacity_J_kgK: 840,
    nodesCount: 3,
  },
];

test("transient visualization frame returns correct frame for time index", () => {
  const result = solveTransient1DExplicit(LAYERS, buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3600, timeStep_s: 60 }));
  const frame = buildTransientVisualizationFrame({
    result,
    timeIndex: result.time.length - 1,
    sourceId: "wall-1",
    sourceType: "wall",
  });
  if (!frame) {
    throw new Error("Visualization frame should be created when result and source are provided.");
  }
  if (frame.profile.length !== result.nodes.length) {
    throw new Error("Visualization frame should expose a full temperature profile.");
  }
});

test("transient time index is clamped into result range", () => {
  const result = solveTransient1DExplicit(LAYERS, buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3600, timeStep_s: 60 }));
  if (clampTransientTimeIndex(result, -5) !== 0) {
    throw new Error("Negative time index should clamp to zero.");
  }
  if (clampTransientTimeIndex(result, 9999) !== result.time.length - 1) {
    throw new Error("Overflow time index should clamp to the last frame.");
  }
});

test("missing transient result returns null visualization frame", () => {
  const frame = buildTransientVisualizationFrame({
    result: null,
    timeIndex: 0,
    sourceId: null,
    sourceType: null,
  });
  if (frame !== null) {
    throw new Error("Missing transient result should not break visualization helpers.");
  }
});

test("unstable transient result is not converted into visualization frame", () => {
  const result = solveTransient1DExplicit(LAYERS, buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3600, timeStep_s: 8000 }));
  const frame = buildTransientVisualizationFrame({
    result,
    timeIndex: 0,
    sourceId: "wall-1",
    sourceType: "wall",
  });
  if (frame !== null) {
    throw new Error("Unstable or invalid transient result should not be visualized as a normal temperature frame.");
  }
});

test("transient source matches only intended element", () => {
  const result = solveTransient1DExplicit(LAYERS, buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3600, timeStep_s: 60 }));
  const frame = buildTransientVisualizationFrame({
    result,
    timeIndex: 0,
    sourceId: "roof-1",
    sourceType: "roof",
  });
  if (!transientSourceMatches(frame, "roof", "roof-1")) {
    throw new Error("The active transient source should match its own element.");
  }
  if (transientSourceMatches(frame, "wall", "roof-1") || transientSourceMatches(frame, "roof", "roof-2")) {
    throw new Error("Transient highlighting should not leak to other elements.");
  }
});
