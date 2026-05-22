import { runThermalSimulation, simulateThermalNetwork, type SimulationScenario } from "../../src/core/thermal/solver.js";
import type { ThermalModel } from "../../src/core/thermal/model.js";
import { createSinusoidalWeatherProfile } from "../../src/core/thermal/weather.js";
import type { BuildingModel } from "../../src/entities/geometry/types.js";
import { test, expectApproximatelyEqual } from "../testHarness.js";

test("one-zone RC model follows analytical solution without отопление", () => {
  const heatCapacity = 50_000; // J/K
  const conductance = 80; // W/K
  const initialTempC = 20;
  const outdoorTempC = 5;
  const durationHours = 2;

  const model: ThermalModel = {
    zones: [
      {
        id: "zone",
        name: "Тест",
        area_m2: 40,
        volume_m3: 120,
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
        id: "ext",
        fromZoneId: "zone",
        toZoneId: "outdoor",
        conductance_W_K: conductance,
        area_m2: 20,
        kind: "external",
      },
    ],
  };

  const scenario: SimulationScenario = {
    durationHours,
    timestepSeconds: 60,
    weather: createSinusoidalWeatherProfile({ baseC: outdoorTempC, amplitudeC: 0 }),
    setpoints: {
      dayC: -50,
      nightC: -50,
      dayStartHour: 0,
      nightStartHour: 12,
    },
    gains: {
      dayGain_W_m2: 0,
      nightGain_W_m2: 0,
      dayStartHour: 0,
      nightStartHour: 12,
    },
    occupancy: {
      dayFraction: 0,
      nightFraction: 0,
      dayStartHour: 0,
      nightStartHour: 12,
    },
    initialTemperatureC: initialTempC,
  };

  const run = simulateThermalNetwork(model, scenario);
  const frames = run.frames;
  const lastFrame = frames[frames.length - 1];
  const lastTempC = lastFrame.rooms.zone.temperatureC;

  const totalSeconds = durationHours * 3600;
  const expected =
    outdoorTempC + (initialTempC - outdoorTempC) * Math.exp((-conductance / heatCapacity) * totalSeconds);

  expectApproximatelyEqual(lastTempC, expected, 0.15, "Температура зоны должна совпадать с аналитическим решением");
});

test("runThermalSimulation keeps old ideal mode behaviour by default", () => {
  const building: BuildingModel = {
    levels: [{ id: "l1", name: "Этаж", elevation_m: 0, height_m: 3 }],
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
      { id: "w1", levelId: "l1", a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
      { id: "w2", levelId: "l1", a: { x: 5, y: 0 }, b: { x: 5, y: 4 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
      { id: "w3", levelId: "l1", a: { x: 5, y: 4 }, b: { x: 0, y: 4 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
      { id: "w4", levelId: "l1", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
    ],
    doors: [],
    windows: [],
    pipes: [],
    ducts: [],
    equipment: [],
    sensors: [],
    scenarios: [],
    activeScenarioId: null,
    events: [],
    meta: {},
  };

  const baseOptions = {
    duration: "24h" as const,
    timestepMinutes: 10,
    outdoor: { baseC: -10, amplitudeC: 0, seasonalOffsetC: 0, phaseShiftHours: 0 },
    setpoints: { day: 21, night: 19, dayStartHour: 6, nightStartHour: 22 },
    internalGains: { dayGain_W_m2: 2, nightGain_W_m2: 1 },
    infiltrationACH: 0.4,
  };

  const withoutMode = runThermalSimulation(building, baseOptions);
  const withIdealMode = runThermalSimulation(building, { ...baseOptions, heatingMode: "ideal" });

  expectApproximatelyEqual(
    withoutMode.summary.peakLoadKW,
    withIdealMode.summary.peakLoadKW,
    1e-9,
    "Поведение solver по умолчанию должно совпадать с явным ideal mode."
  );
  expectApproximatelyEqual(
    withoutMode.summary.totalEnergyKWh,
    withIdealMode.summary.totalEnergyKWh,
    1e-9,
    "Энергия solver по умолчанию не должна меняться после добавления heatingMode."
  );
});
