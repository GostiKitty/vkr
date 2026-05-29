import assert from "node:assert/strict";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { createDefaultScenarioConfig } from "../../src/entities/workflow/workflow.store.js";
import {
  resolveInfiltrationACH,
  resolveStackHeightM,
  resolveVentilationACH,
} from "../../src/core/thermal/ventilation/resolveScenarioVentilation.js";

function testVentilationFromModel() {
  const scenario = createDefaultScenarioConfig();
  const model = createEmptyBuildingModel();
  model.thermalProtection = {
    energyVentilation: {
      infiltrationACH: 0.2,
      ventilationACH: 0.35,
      heatRecoveryFactor: 0.75,
    },
  };
  const infiltration = resolveInfiltrationACH(null, scenario, model);
  const ventilation = resolveVentilationACH(null, scenario, model);
  assert.equal(infiltration.value, 0.2);
  assert.equal(infiltration.source, "model");
  assert.equal(ventilation.value, 0.35);
  assert.equal(ventilation.source, "model");
}

function testStackHeightFromGeometry() {
  const scenario = createDefaultScenarioConfig();
  const model = createEmptyBuildingModel();
  model.levels = [
    { id: "l1", name: "1", elevation_m: 0, height_m: 3 },
    { id: "l2", name: "2", elevation_m: 3, height_m: 3 },
  ];
  model.rooms = [
    {
      id: "r1",
      levelId: "l1",
      name: "Room",
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    },
  ];
  const stack = resolveStackHeightM(null, scenario, model);
  assert.equal(stack.source, "model");
  assert.ok(stack.value >= 5.9 && stack.value <= 6.1);
}

export function runResolveScenarioVentilationTests() {
  testVentilationFromModel();
  testStackHeightFromGeometry();
  console.log("resolveScenarioVentilation tests passed");
}
