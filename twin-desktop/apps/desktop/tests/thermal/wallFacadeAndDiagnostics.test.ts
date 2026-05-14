import { computeWallProperties } from "../../src/entities/material/types.js";
import { computeWallFacadeConductances } from "../../src/core/thermal/wallFacadeThermal.js";
import { runThermalSimulation } from "../../src/core/thermal/solver.js";
import { runThermalMonteCarlo } from "../../src/core/uncertainty/thermalMonteCarlo.js";
import { buildAdjacencyGraph } from "../../src/core/graph/adjacency.js";
import { test, expectApproximatelyEqual } from "../testHarness.js";
import type { BuildingModel } from "../../src/entities/geometry/types.js";
import type { Wall } from "../../src/entities/geometry/types.js";

test("R_total > R_layers and U_total < U_layers when SP50 surface resistances included", () => {
  const p = computeWallProperties(undefined, "masonry", { includeSp50AirFilms: true });
  if (!p) {
    throw new Error("expected wall properties");
  }
  if (!(p.rTotal_m2K_W > p.rMaterialLayers_m2K_W + 1e-6)) {
    throw new Error("R_total should exceed material layers only resistance");
  }
  if (!(p.uTotal_W_m2K < p.uMaterialLayers_W_m2K - 1e-9)) {
    throw new Error("U_total should be less than U_layers-only");
  }
});

test("thicker insulation layer reduces U_total", () => {
  const thin = computeWallProperties(
    [
      { materialId: "ceramic_brick", thickness_m: 0.25 },
      { materialId: "mineral_wool", thickness_m: 0.05 },
    ],
    undefined,
    { includeSp50AirFilms: true }
  );
  const thick = computeWallProperties(
    [
      { materialId: "ceramic_brick", thickness_m: 0.25 },
      { materialId: "mineral_wool", thickness_m: 0.25 },
    ],
    undefined,
    { includeSp50AirFilms: true }
  );
  if (!thin || !thick) {
    throw new Error("expected both");
  }
  if (!(thick.uTotal_W_m2K < thin.uTotal_W_m2K)) {
    throw new Error("more insulation should lower U_total");
  }
});

test("openings larger than wall area yield warning and finite conductances", () => {
  const wall: Wall = {
    id: "w",
    levelId: "l",
    a: { x: 0, y: 0 },
    b: { x: 1, y: 0 },
    height_m: 3,
    thickness_m: 0.2,
    layers: [],
    wallAssemblyId: "masonry",
  };
  const f = computeWallFacadeConductances(
    wall,
    [
      { type: "window", widthM: 10, heightM: 10 },
      { type: "door", widthM: 2, heightM: 2 },
    ],
    "masonry",
    1
  );
  if (!f.warnings.length) {
    throw new Error("expected geometry warning");
  }
  if (!Number.isFinite(f.conductanceTotal_W_K) || f.conductanceTotal_W_K <= 0) {
    throw new Error("conductance should be finite positive");
  }
});

test("runThermalSimulation exposes diagnostics with building loss shares", () => {
  const model: BuildingModel = {
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
    rooms: [
      {
        id: "r1",
        name: "Комната",
        levelId: "l1",
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
        id: "w1",
        levelId: "l1",
        a: { x: 0, y: 0 },
        b: { x: 5, y: 0 },
        height_m: 3,
        thickness_m: 0.3,
        layers: [],
      },
      {
        id: "w2",
        levelId: "l1",
        a: { x: 5, y: 0 },
        b: { x: 5, y: 4 },
        height_m: 3,
        thickness_m: 0.3,
        layers: [],
      },
      {
        id: "w3",
        levelId: "l1",
        a: { x: 5, y: 4 },
        b: { x: 0, y: 4 },
        height_m: 3,
        thickness_m: 0.3,
        layers: [],
      },
      {
        id: "w4",
        levelId: "l1",
        a: { x: 0, y: 4 },
        b: { x: 0, y: 0 },
        height_m: 3,
        thickness_m: 0.3,
        layers: [],
      },
    ],
    roofs: [],
    floorSlabs: [],
    doors: [],
    windows: [],
    pipes: [],
    ducts: [],
    equipment: [],
    sensors: [],
    scenarios: [],
    activeScenarioId: null,
    events: [],
  };
  const res = runThermalSimulation(model, {
    duration: "24h",
    timestepMinutes: 60,
    outdoor: { baseC: -8, amplitudeC: 3, seasonalOffsetC: 0, phaseShiftHours: 0 },
    setpoints: { day: 21, night: 19, dayStartHour: 7, nightStartHour: 23 },
    internalGains: { dayGain_W_m2: 2, nightGain_W_m2: 0.5 },
    infiltrationACH: 0.35,
  });
  if (!res.diagnostics) {
    throw new Error("diagnostics expected");
  }
  if (!res.diagnostics.engineering.discreteBalanceEquation.includes("G_inf")) {
    throw new Error("methodology should cite infiltration conductance in discrete balance");
  }
  if (!res.diagnostics.metricCards.length) {
    throw new Error("metric cards expected");
  }
  if (res.diagnostics.building.envelopeSplitMaxDeviationW > 1) {
    throw new Error("envelope split should match total G on edges for this model");
  }
  const { building, zones } = res.diagnostics;
  if (!zones.length) {
    throw new Error("zone diagnostics");
  }
  const sumPct =
    building.lossSharePercent.opaque +
    building.lossSharePercent.window +
    building.lossSharePercent.door +
    building.lossSharePercent.infiltration;
  expectApproximatelyEqual(sumPct, 100, 0.5, "доли потерь должны суммироваться около 100%");
});

test("Monte Carlo VaR >= P50 and CVaR >= VaR for peak load", () => {
  const model: BuildingModel = {
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
    rooms: [
      {
        id: "r1",
        name: "Комната",
        levelId: "l1",
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
        id: "w1",
        levelId: "l1",
        a: { x: 0, y: 0 },
        b: { x: 5, y: 0 },
        height_m: 3,
        thickness_m: 0.3,
        layers: [],
      },
      {
        id: "w2",
        levelId: "l1",
        a: { x: 5, y: 0 },
        b: { x: 5, y: 4 },
        height_m: 3,
        thickness_m: 0.3,
        layers: [],
      },
      {
        id: "w3",
        levelId: "l1",
        a: { x: 5, y: 4 },
        b: { x: 0, y: 4 },
        height_m: 3,
        thickness_m: 0.3,
        layers: [],
      },
      {
        id: "w4",
        levelId: "l1",
        a: { x: 0, y: 4 },
        b: { x: 0, y: 0 },
        height_m: 3,
        thickness_m: 0.3,
        layers: [],
      },
    ],
    roofs: [],
    floorSlabs: [],
    doors: [],
    windows: [],
    pipes: [],
    ducts: [],
    equipment: [],
    sensors: [],
    scenarios: [],
    activeScenarioId: null,
    events: [],
  };
  const adjacency = buildAdjacencyGraph(model);
  const r = runThermalMonteCarlo({
    model,
    adjacency,
    baseOptions: {
      duration: "24h",
      timestepMinutes: 120,
      outdoor: { baseC: -5, amplitudeC: 4, seasonalOffsetC: 0, phaseShiftHours: 0 },
      setpoints: { day: 22, night: 18, dayStartHour: 8, nightStartHour: 22 },
      internalGains: { dayGain_W_m2: 4, nightGain_W_m2: 1 },
      infiltrationACH: 0.5,
    },
    runs: 40,
    seed: 12345,
    varLevel: 0.95,
  });
  if (r.peakLoad.valueAtRisk + 1e-9 < r.peakLoad.p50) {
    throw new Error("VaR should not be below median for nonnegative heating-like loads");
  }
  if (r.peakLoad.conditionalValueAtRisk + 1e-9 < r.peakLoad.valueAtRisk) {
    throw new Error("CVaR tail mean should be >= VaR threshold");
  }
  if (r.seed !== 12345) {
    throw new Error("seed should echo input");
  }
});
