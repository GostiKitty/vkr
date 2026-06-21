import assert from "node:assert/strict";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { createDefaultScenarioConfig } from "../../src/entities/workflow/workflow.store.js";
import {
  resolveHeatRecoveryFactor,
  resolveInfiltrationACH,
  resolveMechanicalVentilationEnabled,
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
  assert.equal(ventilation.explicit, false);

  const recovery = resolveHeatRecoveryFactor(null, scenario, model);
  assert.equal(recovery.value, 0.75);
  assert.equal(recovery.source, "model");
  assert.equal(recovery.explicit, false);
}

function testTypicalVentilationAndRecoveryWithoutModelData() {
  const scenario = createDefaultScenarioConfig();
  const model = createEmptyBuildingModel();
  model.rooms = [
    {
      id: "r1",
      levelId: "l1",
      name: "Комната",
      polygon: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ],
    },
  ];
  model.levels = [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }];

  const ventilation = resolveVentilationACH(null, scenario, model);
  assert.equal(ventilation.value, 0.18);
  assert.equal(ventilation.source, "calculated");
  assert.equal(ventilation.explicit, false);

  const recovery = resolveHeatRecoveryFactor(null, scenario, model);
  assert.equal(recovery.value, 0.65);
  assert.equal(recovery.source, "calculated");
  assert.equal(recovery.explicit, false);
}

function testVentilationAchFromEquipmentAirflow() {
  const scenario = createDefaultScenarioConfig();
  const model = createEmptyBuildingModel();
  model.rooms = [
    {
      id: "r1",
      levelId: "l1",
      name: "Комната",
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    },
  ];
  model.levels = [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }];
  model.equipment = [
    {
      id: "ahu-1",
      type: "ahu",
      roomId: "r1",
      levelId: "l1",
      position: { x: 1, y: 1 },
      params: { designAirflow_m3_s: 0.1, efficiency: 0.72 },
    },
  ];

  const ventilation = resolveVentilationACH(null, scenario, model);
  // V = 10×10×3 м³, Q = 0,1 м³/с → n = Q×3600/V = 1,2 1/ч
  assert.ok(ventilation.value > 1.19 && ventilation.value < 1.21, `expected ~1.2 1/ч, got ${ventilation.value}`);
  assert.equal(ventilation.source, "calculated");

  const recovery = resolveHeatRecoveryFactor(null, scenario, model);
  assert.equal(recovery.value, 0.72);
  assert.equal(recovery.source, "calculated");
}

function testDisabledMechanicalVentilationZerosEffectiveValues() {
  const scenario = createDefaultScenarioConfig();
  scenario.ventilation.mechanicalVentilationEnabled = false;
  const model = createEmptyBuildingModel();

  const ventilation = resolveVentilationACH(null, scenario, model);
  assert.equal(ventilation.value, 0);
  assert.equal(ventilation.source, "calculated");
  assert.equal(ventilation.explicit, false);

  const recovery = resolveHeatRecoveryFactor(null, scenario, model);
  assert.equal(recovery.value, 0);
  assert.equal(recovery.source, "calculated");

  const mech = resolveMechanicalVentilationEnabled(null, scenario, model);
  assert.equal(mech.value, false);
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

function testVentilationAchFromEngineeringAirSystems() {
  const scenario = createDefaultScenarioConfig();
  const model = createEmptyBuildingModel();
  model.rooms = [
    {
      id: "r1",
      levelId: "l1",
      name: "Комната",
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    },
  ];
  model.levels = [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }];
  model.engineeringSystems = {
    equipment: [
      {
        id: "ahu-1",
        type: "airHandlingUnit",
        name: "ПВУ-1",
        x: 0,
        y: 0,
        width: 2.8,
        height: 1.4,
        rotation: 0,
        ports: [],
        parameters: { airflowM3H: 900, heatRecoveryEfficiency: 0.78 },
        metadata: {},
        levelId: "l1",
      },
      {
        id: "sd-1",
        type: "supplyDiffuser",
        name: "Приток-1",
        x: 1,
        y: 1,
        width: 0.8,
        height: 0.8,
        rotation: 0,
        ports: [],
        parameters: { airflowM3H: 900 },
        metadata: {},
        levelId: "l1",
      },
      {
        id: "eg-1",
        type: "exhaustGrille",
        name: "Вытяжка-1",
        x: 2,
        y: 1,
        width: 0.95,
        height: 0.7,
        rotation: 0,
        ports: [],
        parameters: { airflowM3H: 900 },
        metadata: {},
        levelId: "l1",
      },
    ],
    pipes: [],
  };

  const ventilation = resolveVentilationACH(null, scenario, model);
  assert.ok(ventilation.value > 2.99 && ventilation.value < 3.01, `expected ~3.0 1/ч, got ${ventilation.value}`);
  assert.equal(ventilation.source, "calculated");

  const recovery = resolveHeatRecoveryFactor(null, scenario, model);
  assert.equal(recovery.value, 0.78);
  assert.equal(recovery.source, "calculated");
}

export function runResolveScenarioVentilationTests() {
  testVentilationFromModel();
  testTypicalVentilationAndRecoveryWithoutModelData();
  testVentilationAchFromEquipmentAirflow();
  testVentilationAchFromEngineeringAirSystems();
  testDisabledMechanicalVentilationZerosEffectiveValues();
  testStackHeightFromGeometry();
  console.log("resolveScenarioVentilation tests passed");
}
