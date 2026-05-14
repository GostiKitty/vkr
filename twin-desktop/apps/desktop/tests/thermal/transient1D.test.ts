import { buildTransientLayersFromConstruction, getTransientFrame, runTransientConstructionAnalysis } from "../../src/core/thermal/transient/analysis.js";
import { solveTransient1DExplicit } from "../../src/core/thermal/transient/finiteDifference1D.js";
import { buildTransientScenarioPreset, getTransientScenarioPresets } from "../../src/core/thermal/transient/scenarios.js";
import type { TransientLayer } from "../../src/core/thermal/transient/types.js";
import { test } from "../testHarness.js";

const WALL_LAYERS = [
  {
    id: "brick",
    materialId: "ceramic_brick",
    name: "Кирпич",
    thickness_m: 0.25,
    lambda_W_mK: 0.81,
    density_kg_m3: 1800,
    heatCapacity_J_kgK: 840,
    nodesCount: 4,
  },
  {
    id: "wool",
    materialId: "mineral_wool",
    name: "Минвата",
    thickness_m: 0.15,
    lambda_W_mK: 0.045,
    density_kg_m3: 120,
    heatCapacity_J_kgK: 840,
    nodesCount: 3,
  },
] satisfies TransientLayer[];

test("explicit transient solver returns time and temperature arrays", () => {
  const scenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 2 * 3600, timeStep_s: 60 });
  const result = solveTransient1DExplicit(WALL_LAYERS, scenario);

  if (!result.time.length || result.temperature.length !== result.time.length) {
    throw new Error("Явная схема должна возвращать массив температур для каждого шага времени.");
  }
  if (result.temperature.some((row) => row.length !== result.nodes.length)) {
    throw new Error("Каждый временной слой должен содержать температуру по всем узлам.");
  }
});

test("cold outdoor boundary cools inner surface without heating", () => {
  const scenario = buildTransientScenarioPreset("heating_shutdown_6h", {
    duration_s: 3 * 3600,
    timeStep_s: 60,
    reducedInnerTemperature_C: 12,
    outerTemperature_C: -22,
  });
  const result = solveTransient1DExplicit(WALL_LAYERS, scenario);
  const start = result.innerSurfaceTemperature[0];
  const finish = result.innerSurfaceTemperature[result.innerSurfaceTemperature.length - 1];
  if (!(finish < start)) {
    throw new Error("При холодной наружной среде и снижении внутренней уставки внутренняя поверхность должна остывать.");
  }
});

test("higher indoor boundary warms inner surface", () => {
  const scenario = buildTransientScenarioPreset("heating_recovery", {
    duration_s: 4 * 3600,
    timeStep_s: 60,
    initialTemperature_C: 14,
    restoredInnerTemperature_C: 24,
    outerTemperature_C: -10,
  });
  const result = solveTransient1DExplicit(WALL_LAYERS, scenario);
  const start = result.innerSurfaceTemperature[0];
  const finish = result.innerSurfaceTemperature[result.innerSurfaceTemperature.length - 1];
  if (!(finish > start)) {
    throw new Error("При повышении внутренней температуры внутренняя поверхность должна прогреваться.");
  }
});

test("stability check marks stable and unstable explicit runs", () => {
  const stableScenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3600, timeStep_s: 30 });
  const unstableScenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3600, timeStep_s: 8000 });
  const stable = solveTransient1DExplicit(WALL_LAYERS, stableScenario);
  const unstable = solveTransient1DExplicit(WALL_LAYERS, unstableScenario);

  if (!stable.stable) {
    throw new Error("Для устойчивого шага времени result.stable должен быть true.");
  }
  if (unstable.stable) {
    throw new Error("Для неустойчивого шага времени result.stable должен быть false.");
  }
  if (unstable.valid) {
    throw new Error("Для неустойчивой явной схемы result.valid должен быть false.");
  }
  if (!unstable.warnings.some((entry) => entry.includes("неустойчива"))) {
    throw new Error("Для неустойчивой явной схемы должен появляться warning.");
  }
  const unstableValues = [
    ...unstable.time,
    ...unstable.nodes,
    ...unstable.innerSurfaceTemperature,
    ...unstable.outerSurfaceTemperature,
    ...unstable.temperature.flat(),
  ];
  if (unstableValues.some((value) => Number.isFinite(value) && Math.abs(value) > 200)) {
    throw new Error("Неустойчивый расчет не должен возвращать физически невозможные температуры в UI-результат.");
  }
  if (!(unstable.metadata.stabilityLimit_s !== null && unstable.metadata.stabilityLimit_s < unstableScenario.timeStep_s)) {
    throw new Error("Для неустойчивой схемы должен возвращаться безопасный шаг времени.");
  }
});

test("scenario presets expose valid duration and frame count", () => {
  const presets = getTransientScenarioPresets();
  if (presets.length < 4) {
    throw new Error("Ожидалось четыре готовых transient-сценария.");
  }
  const scenario = buildTransientScenarioPreset("night_setback", { duration_s: 24 * 3600, timeStep_s: 600 });
  const result = solveTransient1DExplicit(WALL_LAYERS, scenario);
  const expectedFrames = Math.round(scenario.duration_s / scenario.timeStep_s) + 1;
  if (result.time.length !== expectedFrames) {
    throw new Error("Число временных точек должно соответствовать duration/timeStep + 1.");
  }
});

test("buildTransientLayersFromConstruction warns on missing density or heat capacity", () => {
  const result = buildTransientLayersFromConstruction({
    layers: [{ materialId: "mystery", thickness_m: 0.2 }],
    nodesPerLayer: 2,
    materialLookup: () => ({
      id: "mystery",
      name: "Неизвестный материал",
      lambda_W_mK: 0.3,
      defaultThickness_m: 0.2,
    }),
  });
  if (!result.warnings.some((entry) => entry.includes("плотность")) || !result.warnings.some((entry) => entry.includes("теплоемкость"))) {
    throw new Error("При отсутствии ρ или c должны возвращаться явные warnings.");
  }
});

test("transient result has no NaN in main numeric arrays", () => {
  const scenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 2 * 3600, timeStep_s: 60 });
  const result = solveTransient1DExplicit(WALL_LAYERS, scenario);
  const numericSeries = [
    ...result.time,
    ...result.nodes,
    ...result.innerSurfaceTemperature,
    ...result.outerSurfaceTemperature,
    ...result.temperature.flat(),
  ];
  if (numericSeries.some((value) => !Number.isFinite(value))) {
    throw new Error("В основных числовых массивах не должно быть NaN или undefined.");
  }

  const frame = getTransientFrame(result, result.time.length - 1);
  if (frame.temperature.length !== result.nodes.length) {
    throw new Error("getTransientFrame должен возвращать профиль по всем узлам.");
  }
});

test("runTransientConstructionAnalysis builds layers from construction and returns result", () => {
  const scenario = buildTransientScenarioPreset("cold_snap_24h", { duration_s: 3600, timeStep_s: 60 });
  const run = runTransientConstructionAnalysis({
    target: {
      id: "wall:test",
      sourceType: "wall",
      sourceId: "wall-1",
      levelId: "level-1",
      label: "Тестовая стена",
      layers: [
        { materialId: "ceramic_brick", thickness_m: 0.25 },
        { materialId: "mineral_wool", thickness_m: 0.12 },
      ],
      fallbackThickness_m: 0.37,
    },
    scenario,
    nodesPerLayer: 3,
  });
  if (!run.result || !run.layers.length) {
    throw new Error("Анализ конструкции должен возвращать transient-результат и подготовленные слои.");
  }
});
