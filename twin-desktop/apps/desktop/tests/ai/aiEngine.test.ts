import { createAIEngine } from "../../src/core/ai/index.js";
import type { BuildingModel } from "../../src/entities/geometry/types.js";
import { test } from "../testHarness.js";

function createTestModel(): BuildingModel {
  return {
    levels: [
      {
        id: "lvl-1",
        name: "Level 1",
        elevation_m: 0,
        height_m: 3,
      },
    ],
    rooms: [
      {
        id: "room-1",
        name: "Office",
        levelId: "lvl-1",
        polygon: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 4 },
          { x: 0, y: 4 },
        ],
      },
    ],
    walls: [],
    doors: [],
    windows: [],
    pipes: [
      {
        id: "pipe-1",
        levelId: "lvl-1",
        path: [
          { x: 0, y: 1 },
          { x: 8, y: 1 },
        ],
        type: "heating_supply",
        diameter_mm: 12,
        material: "steel",
        fluidTemperatureC: 65,
        flowRate_kg_s: 0.45,
        pressurePa: 5000,
        connectedEquipmentIds: [],
      },
    ],
    ducts: [
      {
        id: "duct-1",
        levelId: "lvl-1",
        path: [
          { x: 1, y: 2 },
          { x: 4, y: 2 },
        ],
        section: {
          shape: "round",
          diameter_mm: 160,
        },
        airflow_m3_s: 0.08,
        airVelocity_m_s: 4.2,
        connectedEquipmentIds: ["eq-1"],
      },
    ],
    equipment: [
      {
        id: "eq-1",
        type: "diffuser",
        position: { x: 2.5, y: 2 },
        levelId: "lvl-1",
        roomId: "room-1",
        state: "on",
        params: {
          designAirflow_m3_s: 0.01,
        },
        connectedNetworkIds: ["duct-1"],
      },
    ],
    sensors: [
      {
        id: "sensor-pressure-1",
        type: "pressure",
        position: { x: 2, y: 1 },
        levelId: "lvl-1",
        roomId: "room-1",
        value: 5,
        unit: "Pa",
        status: "warning",
        history: [],
      },
      {
        id: "sensor-temp-1",
        type: "temperature",
        position: { x: 2.5, y: 2.5 },
        levelId: "lvl-1",
        roomId: "room-1",
        value: 22,
        unit: "C",
        status: "normal",
        history: [],
      },
    ],
    scenarios: [],
    activeScenarioId: null,
    events: [],
    meta: {},
  };
}

test("AIEngine analyzeModel returns structured engineering warnings", () => {
  const engine = createAIEngine();
  const result = engine.analyzeModel(createTestModel());

  if (result.module !== "modelAnalyzer") {
    throw new Error("Expected modelAnalyzer module result.");
  }
  if (result.warnings.length < 3) {
    throw new Error(`Expected at least 3 warnings, received ${result.warnings.length}.`);
  }
  if (!result.warnings.some((warning) => warning.code === "insufficient_ventilation")) {
    throw new Error("Expected insufficient ventilation warning.");
  }
  if (!result.warnings.some((warning) => warning.code === "incorrect_pipe_diameter")) {
    throw new Error("Expected incorrect pipe diameter warning.");
  }
  if (!result.warnings.some((warning) => warning.code === "abnormal_pressure")) {
    throw new Error("Expected abnormal pressure warning.");
  }
});

test("AIEngine runEnergySimulation returns structured zone and total loads", () => {
  const engine = createAIEngine();
  const result = engine.runEnergySimulation({
    roomArea_m2: 42,
    insulationCoefficient_W_m2K: 0.68,
    temperatureDifference_C: 24,
    ventilationAirflow_m3_s: 0.18,
  });

  if (result.module !== "energySimulation") {
    throw new Error("Expected energySimulation module result.");
  }
  if (result.totals.heatingDemand_W <= 0 || result.totals.ventilationEnergy_W <= 0) {
    throw new Error("Energy simulation should return positive engineering loads.");
  }
  if (result.zones.length !== 1) {
    throw new Error("Expected a single simulated zone.");
  }
});

test("AIEngine getDigitalTwinState returns cached structured twin data", () => {
  const engine = createAIEngine({ digitalTwinRefreshIntervalMs: 5000 });
  const model = createTestModel();
  const first = engine.getDigitalTwinState(model);
  const second = engine.getDigitalTwinState(model);

  if (first.module !== "digitalTwin") {
    throw new Error("Expected digitalTwin module result.");
  }
  if (!first.rooms.length || !first.sensors.length) {
    throw new Error("Digital twin should expose room and sensor states.");
  }
  if (first.timestamp !== second.timestamp) {
    throw new Error("Digital twin should reuse cached state within refresh interval.");
  }
});

test("AIEngine askAssistant explains current engineering warnings", () => {
  const engine = createAIEngine();
  engine.analyzeModel(createTestModel());
  const answer = engine.askAssistant("Explain the ventilation problem");

  if (answer.module !== "assistant") {
    throw new Error("Expected assistant module result.");
  }
  if (!answer.relatedWarningIds.length) {
    throw new Error("Assistant should reference the active warnings.");
  }
  if (!answer.answer.toLowerCase().includes("airflow")) {
    throw new Error("Assistant response should explain the ventilation issue.");
  }
});
