import { simulateThermalNetwork, type SimulationScenario } from "../../src/core/thermal/solver.js";
import type { ThermalModel } from "../../src/core/thermal/model.js";
import { createSinusoidalWeatherProfile } from "../../src/core/thermal/weather.js";
import { runThermalMonteCarlo } from "../../src/core/uncertainty/thermalMonteCarlo.js";
import { buildAdjacencyGraph } from "../../src/core/graph/adjacency.js";
import { test, expectApproximatelyEqual } from "../testHarness.js";
import type { BuildingModel } from "../../src/entities/geometry/types.js";

test("metric frames cover exactly the simulated duration for energy integration", () => {
  const heatCapacity = 40_000;
  const conductance = 60;
  const model: ThermalModel = {
    zones: [
      {
        id: "z",
        name: "Зона",
        area_m2: 20,
        volume_m3: 60,
        capacitance_J_K: heatCapacity,
        infiltrationACH: 0,
        infiltrationConductance_W_K: 0,
        ventilationACH: 0,
        ventilationConductance_W_K: 0,
      },
    ],
    internalLinks: [],
    outdoorLinks: [
      {
        id: "out",
        fromZoneId: "z",
        toZoneId: "outdoor",
        conductance_W_K: conductance,
        area_m2: 10,
        kind: "external",
      },
    ],
  };

  const durationHours = 3;
  const timestepSeconds = 600;
  const scenario: SimulationScenario = {
    durationHours,
    timestepSeconds,
    weather: createSinusoidalWeatherProfile({ baseC: 0, amplitudeC: 0 }),
    setpoints: { dayC: 20, nightC: 20, dayStartHour: 0, nightStartHour: 24 },
    gains: { dayGain_W_m2: 0, nightGain_W_m2: 0, dayStartHour: 0, nightStartHour: 24 },
    occupancy: { dayFraction: 0, nightFraction: 0, dayStartHour: 0, nightStartHour: 24 },
    initialTemperatureC: 20,
  };

  const run = simulateThermalNetwork(model, scenario);
  const expectedSteps = Math.round((durationHours * 3600) / timestepSeconds);
  expectApproximatelyEqual(run.metricFrames.length, expectedSteps, 0, "Число кадров метрик должно совпадать с числом шагов");

  const coveredSeconds = run.metricFrames.reduce((sum, frame) => sum + frame.timestepSeconds, 0);
  expectApproximatelyEqual(coveredSeconds, durationHours * 3600, 1e-6, "Интеграл Δt по метрикам должен равняться длительности");
});

test("thermal Monte Carlo is reproducible for identical seed and run count", () => {
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
  const baseOptions = {
    duration: "24h" as const,
    timestepMinutes: 60,
    outdoor: { baseC: -5, amplitudeC: 2, seasonalOffsetC: 0, phaseShiftHours: 0 },
    setpoints: { day: 21, night: 19, dayStartHour: 7, nightStartHour: 23 },
    internalGains: { dayGain_W_m2: 3, nightGain_W_m2: 0.5 },
    infiltrationACH: 0.4,
  };

  const a = runThermalMonteCarlo({
    model,
    adjacency,
    baseOptions,
    runs: 24,
    seed: 9001,
    heatingThresholdKW: 50,
    varLevel: 0.9,
  });
  const b = runThermalMonteCarlo({
    model,
    adjacency,
    baseOptions,
    runs: 24,
    seed: 9001,
    heatingThresholdKW: 50,
    varLevel: 0.9,
  });

  expectApproximatelyEqual(a.peakLoad.mean, b.peakLoad.mean, 1e-9, "Среднее пиковой нагрузки должно совпадать при том же seed");
  expectApproximatelyEqual(a.peakLoad.p95, b.peakLoad.p95, 1e-9, "P95 должно совпадать при том же seed");
  expectApproximatelyEqual(a.exceedanceProbability ?? 0, b.exceedanceProbability ?? 0, 1e-9, "Вероятность превышения должна совпадать");
});
