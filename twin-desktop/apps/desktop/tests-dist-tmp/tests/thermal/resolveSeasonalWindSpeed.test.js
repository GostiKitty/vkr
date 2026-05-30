import test from "node:test";
import assert from "node:assert/strict";
import { clampDayOfYear, interpolateSeasonalWindSpeedMps, } from "../../src/core/thermal/climate/resolveSeasonalWindSpeed.js";
test("interpolateSeasonalWindSpeedMps returns winter value in mid-January", () => {
    const value = interpolateSeasonalWindSpeedMps(4.9, 3.0, 15);
    assert.ok(value != null);
    assert.ok(Math.abs(value - 4.9) < 0.05, `Expected ~4.9, got ${value}`);
});
test("interpolateSeasonalWindSpeedMps returns summer value in mid-July", () => {
    const value = interpolateSeasonalWindSpeedMps(4.9, 3.0, 196);
    assert.ok(value != null);
    assert.ok(Math.abs(value - 3.0) < 0.05, `Expected ~3.0, got ${value}`);
});
test("interpolateSeasonalWindSpeedMps falls back to available anchor", () => {
    assert.equal(interpolateSeasonalWindSpeedMps(4.9, null, 100), 4.9);
    assert.equal(interpolateSeasonalWindSpeedMps(null, 3.0, 100), 3.0);
});
test("clampDayOfYear keeps values within [1, 365]", () => {
    assert.equal(clampDayOfYear(null), 15);
    assert.equal(clampDayOfYear(400), 365);
    assert.equal(clampDayOfYear(0), 1);
});
