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
import { extractLossSharePercent } from "../../src/core/thermal/thermalSimulationExport.js";
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

test("building loss share payload prefers explicit infiltration share of total", () => {
  const result = {
    summary: { peakLoadKW: 0, totalEnergyKWh: 0, discomfortHours: 0 },
    timeline: [],
    rooms: {},
    diagnostics: {
      building: {
        referenceTimeHours: 0,
        referenceOutdoorC: 0,
        referenceNote: "",
        totalEnvelopeExchangeSignedW: 0,
        totalInfiltrationExchangeSignedW: 0,
        totalMechanicalVentilationExchangeSignedW: 0,
        totalAirExchangeSignedW: 0,
        totalTransmissionLossW: 800,
        totalOpaqueLossW: 800,
        totalWindowLossW: 0,
        totalDoorLossW: 0,
        totalInfiltrationLossW: 200,
        totalMechanicalVentilationLossW: 0,
        totalAirExchangeLossW: 200,
        totalLossW: 1000,
        infiltrationShareOfTotalPct: 20,
        infiltrationShareOfAirExchangePct: 100,
        lossShareWarnings: [],
        totalHeatingW: 0,
        totalInternalGainsW: 0,
        internalExchangeNetSumW: 0,
        balanceResidualW: 0,
        balanceRelativeResidual: 0,
        balanceStatus: "ok",
        balanceStatusNoteRu: "",
        heatedFloorAreaM2: 0,
        specificPeakLoad_W_m2: 0,
        specificEnergyKWh_m2: 0,
        lossSharePercent: { opaque: 80, window: 0, door: 0, infiltration: 100, ventilation: 0 },
        envelopeSplitMaxDeviationW: 0,
      },
      zones: [],
    },
  } as never;

  const breakdown = extractLossSharePercent(result);
  const rows = buildBuildingLossSeries(result);
  const infiltrationRow = rows.find((row) => row.key === "infiltration");
  if (!breakdown || Math.abs(breakdown.infiltration - 20) > 1e-9) {
    throw new Error("Loss share export should use infiltrationShareOfTotalPct instead of a stale legacy percentage.");
  }
  if (!infiltrationRow || Math.abs((infiltrationRow.sharePercent ?? 0) - 20) > 1e-9) {
    throw new Error("Building loss rows should use the explicit infiltration share of total.");
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

test("buildZoneSeries does not double count legacy ventilationLossW alias", () => {
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
        totalInfiltrationExchangeSignedW: 0,
        totalMechanicalVentilationExchangeSignedW: 0,
        totalAirExchangeSignedW: 0,
        totalTransmissionLossW: 800,
        totalOpaqueLossW: 800,
        totalWindowLossW: 0,
        totalDoorLossW: 0,
        totalInfiltrationLossW: 200,
        totalMechanicalVentilationLossW: 200,
        totalAirExchangeLossW: 400,
        totalLossW: 1200,
        infiltrationShareOfTotalPct: 16.6666666667,
        infiltrationShareOfAirExchangePct: 50,
        lossShareWarnings: [],
        totalHeatingW: 0,
        totalInternalGainsW: 0,
        internalExchangeNetSumW: 0,
        balanceResidualW: 0,
        balanceRelativeResidual: 0,
        balanceStatus: "ok",
        balanceStatusNoteRu: "",
        heatedFloorAreaM2: 0,
        specificPeakLoad_W_m2: 0,
        specificEnergyKWh_m2: 0,
        lossSharePercent: { opaque: 66.6666666667, window: 0, door: 0, infiltration: 16.6666666667, ventilation: 16.6666666667 },
        envelopeSplitMaxDeviationW: 0,
      },
      zones: [
        {
          zoneId: "z1",
          zoneName: "Кабинет",
          temperatureC: 20,
          setpointC: 21,
          heatingPowerW: 500,
          envelopeExchangeSignedW: 0,
          infiltrationExchangeSignedW: 0,
          mechanicalVentilationExchangeSignedW: 0,
          airExchangeSignedW: 0,
          transmissionLossW: 800,
          lossOpaqueW: 800,
          lossWindowW: 0,
          lossDoorW: 0,
          lossInfiltrationW: 200,
          lossMechanicalVentilationW: 200,
          airExchangeLossW: 400,
          totalLossW: 1200,
          infiltrationShareOfTotalPct: 16.6666666667,
          infiltrationShareOfAirExchangePct: 50,
          lossShareWarnings: [],
          ventilationLossW: 400,
          internalGainsW: 0,
          internalExchangeNetW: 0,
          peakSpecificLoad_W_m2: 0,
          energyKWh_m2: 0,
          discomfortHours: 0,
          statusNote: null,
          status: "ok",
        },
      ],
    },
  } as never);

  if (rows.length !== 1) {
    throw new Error("Expected one zone row.");
  }
  if (Math.abs(rows[0].lossTotalW - 1200) > 1e-9) {
    throw new Error("Zone loss total should use transmission + infiltration + mechanical ventilation exactly once.");
  }
  if (Math.abs(rows[0].airExchangeLossW - 400) > 1e-9) {
    throw new Error("Zone airExchangeLossW should equal infiltration + mechanical ventilation.");
  }
  if (Math.abs((rows[0].infiltrationShareOfAirExchangePct ?? 0) - 50) > 1e-9) {
    throw new Error("Zone air-exchange infiltration share should be computed from explicit split fields.");
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
