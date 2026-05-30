import { test } from "../testHarness.js";
import { resolveScenarioEconomy, resolveRegionalTariffGrowthPercent } from "../../src/core/economics/resolveScenarioEconomy.js";
import { createDefaultScenarioConfig } from "../../src/entities/workflow/workflow.store.js";
import type { BuildingModel } from "../../src/entities/geometry/types.js";

function minimalModel(overrides: Partial<BuildingModel> = {}): BuildingModel {
  return {
    meta: { name: "test" },
    levels: [{ id: "l1", name: "1", elevation_m: 0 }],
    rooms: [
      {
        id: "r1",
        name: "Room",
        levelId: "l1",
        polygon: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        height_m: 3,
        heated: true,
      },
    ],
    walls: [
      {
        id: "w1",
        roomIds: ["r1"],
        polyline: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        height_m: 3,
        thickness_m: 0.4,
        assemblyId: null,
      },
    ],
    windows: [{ id: "win1", wallId: "w1", width_m: 1.5, height_m: 1.5, assemblyId: null }],
    doors: [],
    roofs: [],
    floorSlabs: [],
    pipes: [],
    equipment: [],
    openings: [],
    ...overrides,
  } as BuildingModel;
}

test("resolveScenarioEconomy: regional tariff growth by city", () => {
  const moscow = resolveRegionalTariffGrowthPercent("moscow");
  if (moscow.value !== 10) {
    throw new Error(`Expected Moscow tariff growth 10 %, got ${moscow.value}`);
  }
  const fallback = resolveRegionalTariffGrowthPercent(null);
  if (fallback.value !== 8) {
    throw new Error(`Expected fallback tariff growth 8 %, got ${fallback.value}`);
  }
});

test("resolveScenarioEconomy: norm defaults when economy fields are empty", () => {
  const resolved = resolveScenarioEconomy(
    { ...createDefaultScenarioConfig(), climateCityId: "moscow", economy: {} },
    minimalModel()
  );
  if (resolved.discountRatePercent.value !== 10 || resolved.discountRatePercent.source !== "norm") {
    throw new Error(`Expected norm discount 10 %, got ${resolved.discountRatePercent.value}`);
  }
  if (resolved.annualTariffGrowthPercent.value !== 10) {
    throw new Error(`Expected Moscow tariff growth 10 %, got ${resolved.annualTariffGrowthPercent.value}`);
  }
  if (resolved.analysisPeriodYears.value !== 15) {
    throw new Error(`Expected analysis period 15 years, got ${resolved.analysisPeriodYears.value}`);
  }
});

test("resolveScenarioEconomy: estimates capex from model areas", () => {
  const resolved = resolveScenarioEconomy(
    { ...createDefaultScenarioConfig(), climateCityId: "moscow", economy: {} },
    minimalModel()
  );
  if (resolved.insulationCostRub.value == null || resolved.insulationCostRub.value <= 0) {
    throw new Error("Expected positive insulation cost estimate from model.");
  }
  if (resolved.windowsCostRub.value == null || resolved.windowsCostRub.value <= 0) {
    throw new Error("Expected positive windows cost estimate from model.");
  }
  if (resolved.equipmentCostRub.value == null || resolved.equipmentCostRub.value <= 0) {
    throw new Error("Expected positive equipment cost estimate.");
  }
  if (resolved.capexRub.value == null || resolved.capexRub.value <= resolved.equipmentCostRub.value!) {
    throw new Error("Expected CAPEX to include component costs.");
  }
  if (resolved.annualMaintenanceCostRub.value == null || resolved.annualMaintenanceCostRub.value <= 0) {
    throw new Error("Expected maintenance cost derived from CAPEX.");
  }
});

test("resolveScenarioEconomy: explicit user values override estimates", () => {
  const resolved = resolveScenarioEconomy(
    {
      ...createDefaultScenarioConfig(),
      climateCityId: "moscow",
      economy: { capexRub: 1_000_000, discountRatePercent: 12 },
    },
    minimalModel()
  );
  if (!resolved.capexRub.explicit || resolved.capexRub.value !== 1_000_000) {
    throw new Error("Explicit CAPEX should override estimate.");
  }
  if (!resolved.discountRatePercent.explicit || resolved.discountRatePercent.value !== 12) {
    throw new Error("Explicit discount rate should override norm.");
  }
});
