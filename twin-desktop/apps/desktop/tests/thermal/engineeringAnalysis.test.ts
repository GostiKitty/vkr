import { buildAdjacencyGraph } from "../../src/core/graph/adjacency.js";
import { runEngineeringThermalAnalysis } from "../../src/core/thermal/engineering/analysis.js";
import type { BuildingModel } from "../../src/entities/geometry/types.js";
import { test, expectApproximatelyEqual } from "../testHarness.js";

const buildSimpleModel = (): BuildingModel => ({
  levels: [{ id: "level-1", name: "Этаж 1", elevation_m: 0, height_m: 3 }],
  rooms: [
    {
      id: "room-1",
      name: "Комната 1",
      levelId: "level-1",
      polygon: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ],
    },
  ],
  walls: [
    {
      id: "wall-n",
      levelId: "level-1",
      a: { x: 0, y: 0 },
      b: { x: 5, y: 0 },
      thickness_m: 0.3,
      height_m: 3,
      wallAssemblyId: "masonry",
    },
    {
      id: "wall-e",
      levelId: "level-1",
      a: { x: 5, y: 0 },
      b: { x: 5, y: 4 },
      thickness_m: 0.3,
      height_m: 3,
      wallAssemblyId: "masonry",
    },
    {
      id: "wall-s",
      levelId: "level-1",
      a: { x: 5, y: 4 },
      b: { x: 0, y: 4 },
      thickness_m: 0.3,
      height_m: 3,
      wallAssemblyId: "masonry",
    },
    {
      id: "wall-w",
      levelId: "level-1",
      a: { x: 0, y: 4 },
      b: { x: 0, y: 0 },
      thickness_m: 0.3,
      height_m: 3,
      wallAssemblyId: "masonry",
    },
  ],
  doors: [],
  windows: [
    {
      id: "window-1",
      anchor: { wallId: "wall-s", t: 0.5, offset_m: 2 },
      width_m: 1.5,
      height_m: 1.4,
      sill_m: 0.9,
    },
  ],
  pipes: [],
  ducts: [],
  equipment: [],
  sensors: [],
  scenarios: [],
  activeScenarioId: null,
  events: [],
  meta: {},
});

test("engineering analysis builds envelope, balance and confidence summary", () => {
  const model = buildSimpleModel();
  const adjacency = buildAdjacencyGraph(model);
  const result = runEngineeringThermalAnalysis(
    model,
    adjacency,
    {
      duration: "24h",
      timestepMinutes: 10,
      outdoor: {
        baseC: -8,
        amplitudeC: 0,
        seasonalOffsetC: 0,
        phaseShiftHours: 0,
      },
      setpoints: {
        day: 21,
        night: 18,
        dayStartHour: 6,
        nightStartHour: 22,
      },
      internalGains: {
        dayGain_W_m2: 3,
        nightGain_W_m2: 1,
      },
      infiltrationACH: 0.4,
    },
    null
  );

  const room = result.rooms[0];
  if (!room) {
    throw new Error("Ожидалась хотя бы одна зона в результате.");
  }

  expectApproximatelyEqual(room.areaM2, 17.6, 0.2, "Площадь расчетного объема должна учитывать внутренний контур помещения");

  const wallLoss = result.envelope.find((entry) => entry.kind === "wall");
  if (!wallLoss) {
    throw new Error("Ожидался расчет хотя бы одного наружного ограждения.");
  }

  if (result.balance.totalLossW <= 0) {
    throw new Error("Суммарные теплопотери должны быть положительными для холодного наружного воздуха.");
  }

  if (!result.scenarios.length) {
    throw new Error("Должны быть построены сценарии сравнения.");
  }

  if (result.confidence.level === "low") {
    throw new Error("Для контролируемого примера confidence не должен быть low.");
  }
});
