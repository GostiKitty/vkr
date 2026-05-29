import assert from "node:assert/strict";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { createDefaultScenarioConfig } from "../../src/entities/workflow/workflow.store.js";
import {
  resolveReturnTemperatureC,
  resolveScenarioEngineeringInputs,
  resolveSupplyTemperatureC,
  summarizeModelEngineering,
} from "../../src/core/thermal/engineering/resolveScenarioEngineering.js";
import { test } from "../testHarness.js";

test("engineering: supply temperature from equipment", () => {
  const scenario = createDefaultScenarioConfig();
  const model = createEmptyBuildingModel();
  model.equipment.push({
    id: "rad-1",
    type: "radiator",
    levelId: "l1",
    roomId: null,
    position: { x: 0, y: 0 },
    params: {
      nominalPowerW: 12000,
      supplyTemperatureC: 75,
      returnTemperatureC: 55,
      designFlow_kg_s: 0.12,
    },
    state: "on",
    connectedNetworkIds: [],
  });
  const summary = summarizeModelEngineering(model);
  assert.equal(summary.supplyTemperatureC, 75);
  assert.equal(summary.returnTemperatureC, 55);
  assert.equal(summary.installedPowerW, 12000);
  const supply = resolveSupplyTemperatureC(null, scenario, summary);
  assert.equal(supply.value, 75);
  assert.equal(supply.source, "model");
});

test("engineering: return temperature from supply delta", () => {
  const scenario = createDefaultScenarioConfig();
  const summary = summarizeModelEngineering(createEmptyBuildingModel());
  const supply = resolveSupplyTemperatureC(null, scenario, summary);
  const returnTemp = resolveReturnTemperatureC(null, scenario, supply, summary);
  assert.equal(returnTemp.source, "calculated");
  assert.equal(returnTemp.value, supply.value - 20);
});

test("engineering: pipe length and diameter from model", () => {
  const scenario = createDefaultScenarioConfig();
  const model = createEmptyBuildingModel();
  model.pipes.push({
    id: "p1",
    levelId: "l1",
    type: "heating_supply",
    path: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    diameter_mm: 25,
    material: "steel",
    fluidTemperatureC: 70,
    flowRate_kg_s: 0.1,
    pressurePa: 0,
    connectedEquipmentIds: [],
  });
  const resolved = resolveScenarioEngineeringInputs(null, scenario, model, null, null);
  assert.equal(resolved.pipeLengthM?.value, 10);
  assert.equal(resolved.pipeLengthM?.source, "model");
  assert.equal(resolved.pipeDiameterMm?.value, 25);
});
