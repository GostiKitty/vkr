import assert from "node:assert/strict";
import {
  twinInternalConductanceWPerK,
  twinNodeCapacitanceJPerK,
  twinOutdoorConductanceWPerK,
} from "../../src/core/thermal/twinGraphHeuristics";

assert.equal(twinNodeCapacitanceJPerK(100), 150);
assert.equal(twinInternalConductanceWPerK(30), 0.05);
assert.equal(twinInternalConductanceWPerK(300), 0.35);
assert.equal(twinInternalConductanceWPerK(300), twinInternalConductanceWPerK(500));
assert.equal(twinOutdoorConductanceWPerK(10), 0.05);
assert.equal(twinOutdoorConductanceWPerK(200), 0.3);

console.log("twinGraphHeuristics.test.ts: ok");
