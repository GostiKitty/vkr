import assert from "node:assert/strict";
import {
  applyOccupancyPresetToConfig,
  inferOccupancyPresetFromValues,
  occupancyPresetFromBuildingCategory,
  resolveOccupancyPresetSelection,
} from "../../src/core/thermal/occupancyPresets";
import { createDefaultScenarioConfig } from "../../src/entities/workflow/workflow.store";

function testPresetFromBuildingCategory() {
  assert.equal(occupancyPresetFromBuildingCategory("residential"), "residential");
  assert.equal(occupancyPresetFromBuildingCategory("administrative"), "office");
  assert.equal(occupancyPresetFromBuildingCategory("educational"), "education");
  assert.equal(occupancyPresetFromBuildingCategory("storage"), "storage");
}

function testApplyAndInferPreset() {
  const config = createDefaultScenarioConfig();
  applyOccupancyPresetToConfig(config, "office");
  assert.equal(config.occupancyPresetId, "office");
  assert.equal(config.occupancy.nightFraction, 0.05);
  assert.equal(inferOccupancyPresetFromValues(config), "office");
  assert.equal(resolveOccupancyPresetSelection(config, config), "office");
}

function testCustomAfterManualDrift() {
  const config = createDefaultScenarioConfig();
  applyOccupancyPresetToConfig(config, "residential");
  config.occupancy.nightFraction = 0.42;
  assert.equal(inferOccupancyPresetFromValues(config), "custom");
}

testPresetFromBuildingCategory();
testApplyAndInferPreset();
testCustomAfterManualDrift();
console.log("occupancyPresets.test.ts: ok");
