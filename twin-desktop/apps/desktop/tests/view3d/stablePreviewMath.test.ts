import {
  calculateFitCameraForBounds,
  calculateGridLayoutForBounds,
  calculateTopViewCameraForBounds,
  normalizeStablePreviewBounds,
} from "../../src/features/build/view3d/stablePreviewMath.js";
import { test } from "../testHarness.js";

test("stable fit camera keeps target at bounds center", () => {
  const bounds = normalizeStablePreviewBounds({ x: 10, y: 3, z: 8 }, { x: 20, y: 6, z: 16 });
  const frame = calculateFitCameraForBounds(bounds, 16 / 9, 45);
  if (frame.target.x !== 10 || frame.target.y !== 3 || frame.target.z !== 8) {
    throw new Error("Fit target should stay at the bounds center.");
  }
});

test("stable fit camera distance is finite for normal bounds", () => {
  const bounds = normalizeStablePreviewBounds({ x: 0, y: 1.5, z: 0 }, { x: 12, y: 3, z: 9 });
  const frame = calculateFitCameraForBounds(bounds, 1.6, 45);
  if (!Number.isFinite(frame.distance) || !Number.isFinite(frame.position.x) || !Number.isFinite(frame.near) || !Number.isFinite(frame.far)) {
    throw new Error("Fit camera frame should not contain NaN or Infinity.");
  }
});

test("degenerate bounds receive fallback size for stable preview", () => {
  const bounds = normalizeStablePreviewBounds({ x: 2, y: 0, z: 2 }, { x: 0, y: 0, z: 0 });
  if (!bounds.usedFallbackSize || bounds.size.x < 6 || bounds.size.z < 6) {
    throw new Error("Stable preview should widen degenerate bounds before fitting.");
  }
});

test("stable grid layout scales from bounds instead of fixed huge size", () => {
  const smallBounds = normalizeStablePreviewBounds({ x: 0, y: 1, z: 0 }, { x: 10, y: 3, z: 8 });
  const largeBounds = normalizeStablePreviewBounds({ x: 0, y: 6, z: 0 }, { x: 40, y: 12, z: 30 });
  const smallGrid = calculateGridLayoutForBounds(smallBounds);
  const largeGrid = calculateGridLayoutForBounds(largeBounds);
  if (!(largeGrid.size > smallGrid.size)) {
    throw new Error("Grid size should grow with model bounds.");
  }
});

test("top view uses bounds center and finite distance", () => {
  const bounds = normalizeStablePreviewBounds({ x: 4, y: 2, z: -3 }, { x: 18, y: 6, z: 12 });
  const frame = calculateTopViewCameraForBounds(bounds, 16 / 9, 45);
  if (frame.target.x !== 4 || frame.target.z !== -3 || !Number.isFinite(frame.distance) || frame.position.y <= frame.target.y) {
    throw new Error("Top view should look down onto the bounds center from above.");
  }
});
