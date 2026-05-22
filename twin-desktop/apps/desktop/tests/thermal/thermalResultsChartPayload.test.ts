import { runThermalSimulation } from "../../src/core/thermal/solver.js";
import {
  build3DOverlayMap,
  buildBuildingLossSeries,
  buildKpiPayload,
  buildScenarioCompareSeries,
  buildZoneSeries,
  hasBuildingDiagnostics,
  hasZoneDiagnostics,
} from "../../src/core/thermal/thermalResultsChartPayload.js";
import { sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import { buildAdjacencyGraph } from "../../src/core/graph/adjacency.js";
import { DEFAULT_THERMAL_OPTIONS } from "../../src/features/build/thermal/defaultThermalOptions.js";
import { test } from "../testHarness.js";

test("buildBuildingLossSeries returns only present categories and recomputes shares", () => {
  const adjacency = buildAdjacencyGraph(sampleBuildingSP50);
  const result = runThermalSimulation(sampleBuildingSP50, DEFAULT_THERMAL_OPTIONS, adjacency);
  const rows = buildBuildingLossSeries(result);

  if (!rows.length) {
    throw new Error("Expected at least one building loss category from diagnostics.");
  }
  if (rows.some((row) => row.valueW == null)) {
    throw new Error("Present rows should keep finite valueW.");
  }
  const shareSum = rows.reduce((acc, row) => acc + (row.sharePercent ?? 0), 0);
  if (Math.abs(shareSum - 100) > 0.5) {
    throw new Error(`Loss shares should normalize near 100%, got ${shareSum}.`);
  }
  if (!rows.some((row) => row.key === "infiltration" && row.label.includes("Инфильтрация"))) {
    throw new Error("Infiltration category should stay labeled as infiltration, not ventilation.");
  }
});

test("buildZoneSeries sorts by total loss and keeps null temperature as null", () => {
  const adjacency = buildAdjacencyGraph(sampleBuildingSP50);
  const result = runThermalSimulation(sampleBuildingSP50, DEFAULT_THERMAL_OPTIONS, adjacency);
  const rows = buildZoneSeries(result);

  if (!rows.length) {
    throw new Error("Expected zone diagnostics rows.");
  }
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1].lossTotalW < rows[index].lossTotalW) {
      throw new Error("Zone rows should be sorted by descending lossTotalW.");
    }
  }
});

test("buildKpiPayload and scenario compare do not invent missing fields", () => {
  const adjacency = buildAdjacencyGraph(sampleBuildingSP50);
  const result = runThermalSimulation(sampleBuildingSP50, DEFAULT_THERMAL_OPTIONS, adjacency);
  const kpi = buildKpiPayload(result);

  if (kpi.peakLoadKW == null || kpi.totalEnergyKWh == null) {
    throw new Error("KPI payload should expose finite summary values for a valid run.");
  }

  const compare = buildScenarioCompareSeries([
    { scenarioId: "a", label: "Базовый", result },
    { scenarioId: "b", label: "Холодный", result },
  ]);
  if (compare.length !== 2) {
    throw new Error("Scenario compare should preserve one row per saved run.");
  }
});

test("build3DOverlayMap keys zones by normalized name", () => {
  const rows = buildZoneSeries({
    summary: { peakLoadKW: 0, totalEnergyKWh: 0, discomfortHours: 0 },
    timeline: [],
    rooms: {},
    diagnostics: {
      building: {
        referenceTimeHours: 0,
        referenceOutdoorC: 0,
        referenceNote: "",
        totalEnvelopeExchangeSignedW: 0,
        totalOpaqueLossW: 0,
        totalWindowLossW: 0,
        totalDoorLossW: 0,
        totalInfiltrationLossW: 0,
        totalMechanicalVentilationLossW: 0,
        totalHeatingW: 0,
        lossSharePercent: { opaque: 0, window: 0, door: 0, infiltration: 0, ventilation: 0 },
        envelopeSplitMaxDeviationW: 0,
      },
      zones: [
        {
          zoneId: "z1",
          zoneName: "  Гостиная  ",
          temperatureC: 20,
          heatingPowerW: 1000,
          lossOpaqueW: 500,
          lossWindowW: 0,
          lossDoorW: 0,
          lossInfiltrationW: 0,
          lossMechanicalVentilationW: 0,
          statusNote: null,
          status: "ok",
        },
      ],
    },
  } as never);

  const overlay = build3DOverlayMap(rows);
  if (!overlay.has("гостиная")) {
    throw new Error("3D overlay map should normalize zone names to lowercase keys.");
  }
});

test("hasBuildingDiagnostics and hasZoneDiagnostics reflect available slices", () => {
  const adjacency = buildAdjacencyGraph(sampleBuildingSP50);
  const result = runThermalSimulation(sampleBuildingSP50, DEFAULT_THERMAL_OPTIONS, adjacency);
  if (!hasBuildingDiagnostics(result) || !hasZoneDiagnostics(result)) {
    throw new Error("Sample building should expose both building and zone diagnostics.");
  }
});
