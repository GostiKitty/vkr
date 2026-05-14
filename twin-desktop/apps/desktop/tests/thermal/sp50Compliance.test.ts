import {
  calculateGsop,
  getExternalHeatTransferCoefficient,
  getInternalHeatTransferCoefficient,
  getMaterialThermalProperties,
  getRequiredResistance,
  getRequiredResistanceTableCategory,
  getSpecificThermalProtectionNorm,
} from "../../src/norms/sp50_2024/index.js";
import {
  calculateAirSpecificWeight,
  calculateAnnualHeatingEnergy,
  calculateConstructionResistance,
  calculateFloorHeatAbsorption,
  calculateHeatTransferCoefficient,
  calculateHeatingEnergyCharacteristic,
  calculateKob,
  calculateLayerResistance,
  calculatePressureDifference,
  calculateRequiredAirPermeabilityResistance,
  calculateSectionTemperature,
  calculateThermalInertia,
  calculateVaporResistance,
  checkKobCompliance,
  checkResistanceCompliance,
} from "../../src/core/thermal/sp50/calculations.js";
import { runSP50Compliance } from "../../src/core/thermal/sp50/index.js";
import { createEmptyBuildingModel, type BuildingModel } from "../../src/entities/geometry/types.js";
import { demoRunSP50Calculation, exportDemoSp50ReportToJson } from "../../src/demo/sampleBuildingSP50.js";
import { test, expectApproximatelyEqual } from "../testHarness.js";

const SP50_TEST_LAYERS = [
  { materialId: "reinforced_concrete", thickness_m: 0.2 },
  { materialId: "mineral_wool", thickness_m: 0.18 },
] as const;

function createSp50EnvelopeModel(): BuildingModel {
  return {
    ...createEmptyBuildingModel(),
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
    rooms: [
      {
        id: "r1",
        name: "Room",
        levelId: "l1",
        polygon: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 8 },
          { x: 0, y: 8 },
        ],
      },
    ],
    walls: [],
    roofs: [],
    floorSlabs: [],
    thermalProtection: {
      buildingCategory: "residential",
      storeys: 1,
      heatedAreaM2: 80,
      heatedVolumeM3: 240,
      climate: {
        city: "Москва",
        indoorTemperatureC: 20,
        indoorRelativeHumidityPercent: 55,
        outdoorHeatingPeriodAverageC: -3.1,
        heatingPeriodDurationDays: 214,
        outdoorDesignTemperatureC: -24,
        humidityZone: "normal",
      },
    },
  };
}

test("SP50: calculates GSOP", () => {
  const value = calculateGsop({
    indoorTemperatureC: 20,
    outdoorHeatingPeriodAverageC: -3.1,
    heatingPeriodDurationDays: 214,
  });
  expectApproximatelyEqual(value, 4943.4, 0.01, "GSOP should use (t_in - t_heat_period) * z_heat_period.");
});

test("SP50: calculates layer and multilayer resistance", () => {
  const brick = calculateLayerResistance(0.25, 0.52);
  const wool = calculateLayerResistance(0.15, 0.04);
  const total = calculateConstructionResistance({
    internalHeatTransferCoefficient: 8.7,
    externalHeatTransferCoefficient: 23,
    layerResistances: [brick, wool],
  });
  expectApproximatelyEqual(brick, 0.4808, 0.001, "Layer resistance should equal d / lambda.");
  expectApproximatelyEqual(total, 4.3892, 0.01, "Construction resistance should include surface resistances.");
  expectApproximatelyEqual(calculateHeatTransferCoefficient(total), 0.2278, 0.01, "U should equal 1 / R.");
});

test("SP50: covers all table 3 categories through internal category mapping", () => {
  const categories = [
    ["residential", "1.1"],
    ["medical", "1.2"],
    ["preschool", "1.2"],
    ["educational", "1.2"],
    ["public", "2"],
    ["administrative", "2"],
    ["industrialDry", "3"],
    ["agricultural", "3"],
    ["storage", "3"],
  ] as const;
  categories.forEach(([category, mapped]) => {
    const actual = getRequiredResistanceTableCategory(category);
    if (actual !== mapped) {
      throw new Error(`Expected ${category} to map to table ${mapped}, got ${String(actual)}.`);
    }
  });
});

test("SP50: covers all main construction types from table 3", () => {
  const cases = [
    { constructionType: "wall", expected: 3.15 },
    { constructionType: "roof", expected: 4.7 },
    { constructionType: "covering", expected: 4.7 },
    { constructionType: "atticFloor", expected: 4.15 },
    { constructionType: "floorOverBasement", expected: 4.15 },
    { constructionType: "floorOnGround", expected: 4.15 },
    { constructionType: "window", expected: 0.68 },
    { constructionType: "lantern", expected: 0.375 },
  ] as const;
  cases.forEach(({ constructionType, expected }) => {
    const required = getRequiredResistance({
      buildingCategory: "residential",
      constructionType,
      gsop: 5000,
    });
    expectApproximatelyEqual(required ?? 0, expected, 0.02, `Unexpected required resistance for ${constructionType}.`);
  });
});

test("SP50: interpolates required resistance by GSOP", () => {
  const required = getRequiredResistance({
    buildingCategory: "public",
    constructionType: "floorOverBasement",
    gsop: 5000,
  });
  expectApproximatelyEqual(required ?? 0, 2.45, 0.02, "Intermediate GSOP should interpolate from table 3 values.");
});

test("SP50: selects alpha_in and alpha_out from tables 4 and 6", () => {
  expectApproximatelyEqual(getInternalHeatTransferCoefficient("wall"), 8.7, 0.0001, "Wall alpha_in mismatch.");
  expectApproximatelyEqual(getInternalHeatTransferCoefficient("window"), 8, 0.0001, "Window alpha_in mismatch.");
  expectApproximatelyEqual(getInternalHeatTransferCoefficient("lantern"), 9.9, 0.0001, "Lantern alpha_in mismatch.");
  expectApproximatelyEqual(getExternalHeatTransferCoefficient("wall") ?? 0, 23, 0.0001, "Wall alpha_out mismatch.");
  expectApproximatelyEqual(getExternalHeatTransferCoefficient("atticFloor") ?? 0, 12, 0.0001, "Attic alpha_out mismatch.");
});

test("SP50: checks actual resistance against normalized resistance", () => {
  const check = checkResistanceCompliance(4.2, 3.5);
  if (!check.complies) {
    throw new Error("Expected R_actual >= R_norm to pass.");
  }
  expectApproximatelyEqual(check.margin_m2K_W, 0.7, 0.001, "Unexpected resistance margin.");
});

test("SP50: calculates kob and checks norm compliance", () => {
  const kob = calculateKob({
    fragments: [
      { nt: 1, areaM2: 120, reducedResistance_m2K_W: 3.2 },
      { nt: 1, areaM2: 60, reducedResistance_m2K_W: 0.7 },
    ],
    heatedVolumeM3: 900,
  });
  const kobNorm = getSpecificThermalProtectionNorm({ heatedVolumeM3: 900, gsop: 5000 });
  expectApproximatelyEqual(kob, 0.1369, 0.001, "Unexpected k_ob value.");
  if (kobNorm === null) {
    throw new Error("Expected k_ob norm for valid volume and GSOP.");
  }
  const check = checkKobCompliance(kob, kobNorm);
  if (!check.complies) {
    throw new Error("Expected kob <= kob_norm for the control sample.");
  }
});

test("SP50: interpolates k_ob norm by heated volume and GSOP", () => {
  const kobNorm = getSpecificThermalProtectionNorm({ heatedVolumeM3: 1000, gsop: 6000 });
  expectApproximatelyEqual(kobNorm ?? 0, 0.3557, 0.02, "Unexpected interpolated k_ob norm.");
});

test("SP50: resolves material properties for A and B", () => {
  const materialA = getMaterialThermalProperties({ materialId: "reinforced_concrete", operationCondition: "A" });
  const materialB = getMaterialThermalProperties({ materialId: "reinforced_concrete", operationCondition: "B" });
  expectApproximatelyEqual(materialA?.conductivity_W_mK ?? 0, 1.92, 0.001, "Condition A conductivity mismatch.");
  expectApproximatelyEqual(materialB?.conductivity_W_mK ?? 0, 2.04, 0.001, "Condition B conductivity mismatch.");
});

test("SP50: calculates temperature at section", () => {
  const temperature = calculateSectionTemperature({
    indoorTemperatureC: 20,
    outdoorTemperatureC: -20,
    resistanceToSection_m2K_W: 1.5,
    totalResistance_m2K_W: 4,
  });
  expectApproximatelyEqual(temperature, 5, 0.001, "Unexpected section temperature.");
});

test("SP50: calculates thermal inertia", () => {
  const inertia = calculateThermalInertia([
    { resistance_m2K_W: 0.35, heatAbsorption_W_m2K: 8.3 },
    { resistance_m2K_W: 3.57, heatAbsorption_W_m2K: 0.45 },
  ]);
  expectApproximatelyEqual(inertia.total, 4.5205, 0.01, "Unexpected thermal inertia.");
});

test("SP50: calculates heating energy characteristic and annual energy", () => {
  const qotp = calculateHeatingEnergyCharacteristic({
    kob_W_m3K: 0.32,
    ventilationCharacteristic_W_m3K: 0.06,
    betaGainUseFactor: 0.8,
    internalGainCharacteristic_W_m3K: 0.05,
    solarGainCharacteristic_W_m3K: 0.02,
  });
  expectApproximatelyEqual(qotp, 0.324, 0.001, "Unexpected q_heat_p value.");
  const annual = calculateAnnualHeatingEnergy(5000, 1000, qotp);
  expectApproximatelyEqual(annual, 38880, 0.1, "Unexpected annual heating energy.");
});

test("SP50: calculates air permeability and pressure difference", () => {
  const gamma = calculateAirSpecificWeight(-20);
  expectApproximatelyEqual(gamma, 13.688, 0.01, "Unexpected air specific weight.");
  const deltaP = calculatePressureDifference({
    heightM: 9,
    indoorTemperatureC: 20,
    outdoorTemperatureC: -20,
    windSpeedM_s: 4,
  });
  const required = calculateRequiredAirPermeabilityResistance(deltaP, 0.5);
  if (!(required > 0)) {
    throw new Error("Expected positive air permeability resistance.");
  }
});

test("SP50: calculates vapor permeability resistance", () => {
  const resistance = calculateVaporResistance([
    { thicknessM: 0.0125, vaporPermeability_mg_mhPa: 0.12 },
    { thicknessM: 0.15, vaporPermeability_mg_mhPa: 0.3 },
  ]);
  expectApproximatelyEqual(resistance, 0.6042, 0.001, "Unexpected vapor resistance.");
});

test("SP50: calculates floor heat absorption", () => {
  const heatAbsorption = calculateFloorHeatAbsorption([
    { resistance_m2K_W: 0.08, heatAbsorption_W_m2K: 7 },
    { resistance_m2K_W: 0.12, heatAbsorption_W_m2K: 5 },
  ]);
  expectApproximatelyEqual(heatAbsorption, 14, 0.001, "When D1 >= 0.5 the result should use 2 * s1.");
});

test("SP50: returns insufficient_data when building metadata is incomplete", () => {
  const model = createEmptyBuildingModel();
  const report = runSP50Compliance(model, undefined, {});
  if (!report.missingData.length) {
    throw new Error("Expected missing data markers for incomplete building model.");
  }
  if (report.building.status !== "insufficient_data") {
    throw new Error(`Expected building status insufficient_data, got ${report.building.status}.`);
  }
});

test("SP50: produces structured report for a minimal building", () => {
  const model: BuildingModel = {
    ...createEmptyBuildingModel(),
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
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
      },
    ],
    walls: [
      {
        id: "w1",
        levelId: "l1",
        a: { x: 0, y: 0 },
        b: { x: 10, y: 0 },
        thickness_m: 0.42,
        height_m: 3,
        layers: [
          { materialId: "ceramic_brick", thickness_m: 0.25 },
          { materialId: "mineral_wool", thickness_m: 0.15 },
          { materialId: "gypsum_board", thickness_m: 0.02 },
        ],
      },
    ],
    thermalProtection: {
      buildingCategory: "residential",
      storeys: 1,
      heatedAreaM2: 100,
      heatedVolumeM3: 300,
      climate: {
        city: "Москва",
        indoorTemperatureC: 20,
        indoorRelativeHumidityPercent: 55,
        outdoorHeatingPeriodAverageC: -3.1,
        heatingPeriodDurationDays: 214,
        outdoorDesignTemperatureC: -24,
        humidityZone: "normal",
      },
    },
  };

  const report = runSP50Compliance(model, undefined, {
    envelope: [
      {
        id: "wall-w1",
        label: "Наружная стена",
        kind: "wall",
        areaM2: 30,
        layerResistance_m2K_W: 4,
        internalSurfaceResistance_m2K_W: 1 / 8.7,
        externalSurfaceResistance_m2K_W: 1 / 23,
        totalResistance_m2K_W: 4.16,
        uValue_W_m2K: 1 / 4.16,
        heatFluxW: 317,
        heatFluxDensity_W_m2: 10.56,
        assumed: false,
        formulaBreakdown: {
          formula: "Q = U * A * dT",
          substitution: "0.24 * 30 * 44",
          units: "W",
          applicability: "test",
        },
        assumptions: [],
        roomId: "r1",
        roomName: "Room",
        levelId: "l1",
        orientation: "south",
        boundaryTemperatureC: -24,
        internalTemperatureC: 20,
        deltaTC: 44,
      },
    ],
    defaultIndoorTemperatureC: 20,
    defaultOutdoorTemperatureC: -24,
  });

  if (report.constructions.length !== 1) {
    throw new Error(`Expected one construction in report, got ${report.constructions.length}.`);
  }
  if (report.sourceData.gsop === null) {
    throw new Error("Expected GSOP in structured report.");
  }
});

test("SP50: maps roof to covering in derived envelope report", () => {
  const model = createSp50EnvelopeModel();
  model.roofs = [
    {
      id: "roof-1",
      levelId: "l1",
      name: "Main roof",
      kind: "pitched",
      boundary: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      elevationBase_m: 3,
      thickness_m: 0.25,
      slope: { directionDeg: 90, risePerMeter: 0.2 },
      layers: SP50_TEST_LAYERS.map((layer) => ({ ...layer })),
      heatedSide: "below",
    },
  ];

  const report = runSP50Compliance(model, undefined, {});
  const roof = report.constructions.find((entry) => entry.id === "roof-roof-1");
  if (!roof) {
    throw new Error("Expected derived roof construction in SP50 report.");
  }
  if (roof.constructionType !== "covering") {
    throw new Error(`Expected roof to map to covering, got ${roof.constructionType}.`);
  }
});

test("SP50: maps basement slab to floorOverBasement", () => {
  const model = createSp50EnvelopeModel();
  model.floorSlabs = [
    {
      id: "slab-1",
      levelId: "l1",
      name: "Basement slab",
      kind: "basement",
      boundary: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      elevation_m: 0,
      thickness_m: 0.28,
      layers: SP50_TEST_LAYERS.map((layer) => ({ ...layer })),
      heatedSide: "above",
    },
  ];

  const report = runSP50Compliance(model, undefined, {});
  const slab = report.constructions.find((entry) => entry.id === "slab-slab-1");
  if (!slab) {
    throw new Error("Expected basement slab in SP50 report.");
  }
  if (slab.constructionType !== "floorOverBasement") {
    throw new Error(`Expected basement slab to map to floorOverBasement, got ${slab.constructionType}.`);
  }
});

test("SP50: maps ground slab to floorOnGround", () => {
  const model = createSp50EnvelopeModel();
  model.floorSlabs = [
    {
      id: "slab-1",
      levelId: "l1",
      name: "Ground slab",
      kind: "ground",
      boundary: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      elevation_m: 0,
      thickness_m: 0.3,
      layers: SP50_TEST_LAYERS.map((layer) => ({ ...layer })),
      heatedSide: "above",
    },
  ];

  const report = runSP50Compliance(model, undefined, {});
  const slab = report.constructions.find((entry) => entry.id === "slab-slab-1");
  if (!slab) {
    throw new Error("Expected ground slab in SP50 report.");
  }
  if (slab.constructionType !== "floorOnGround") {
    throw new Error(`Expected ground slab to map to floorOnGround, got ${slab.constructionType}.`);
  }
});

test("SP50: does not include interfloor slab in external envelope", () => {
  const model = createSp50EnvelopeModel();
  model.floorSlabs = [
    {
      id: "slab-1",
      levelId: "l1",
      name: "Interfloor slab",
      kind: "interfloor",
      boundary: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      elevation_m: 3,
      thickness_m: 0.22,
      layers: SP50_TEST_LAYERS.map((layer) => ({ ...layer })),
      heatedSide: "below",
    },
  ];

  const report = runSP50Compliance(model, undefined, {});
  if (report.constructions.some((entry) => entry.id === "slab-slab-1")) {
    throw new Error("Interfloor slab should not be included in external envelope report.");
  }
  if (!report.missingData.some((entry) => entry.includes("межэтаж") || entry.includes("межэтаж"))) {
    throw new Error("Expected explanation about skipped interfloor slab.");
  }
});

test("SP50: kob changes when roof and slab are added to the envelope", () => {
  const baseModel = createSp50EnvelopeModel();
  baseModel.walls = [
    {
      id: "w1",
      levelId: "l1",
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
      thickness_m: 0.42,
      height_m: 3,
      layers: [
        { materialId: "ceramic_brick", thickness_m: 0.25 },
        { materialId: "mineral_wool", thickness_m: 0.15 },
      ],
    },
  ];
  const enrichedModel = createSp50EnvelopeModel();
  enrichedModel.walls = baseModel.walls.map((wall) => ({
    ...wall,
    a: { ...wall.a },
    b: { ...wall.b },
    layers: wall.layers?.map((layer) => ({ ...layer })),
  }));
  enrichedModel.roofs = [
    {
      id: "roof-1",
      levelId: "l1",
      name: "Roof",
      kind: "flat",
      boundary: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      elevationBase_m: 3,
      thickness_m: 0.25,
      layers: SP50_TEST_LAYERS.map((layer) => ({ ...layer })),
      heatedSide: "below",
    },
  ];
  enrichedModel.floorSlabs = [
    {
      id: "slab-1",
      levelId: "l1",
      name: "Ground slab",
      kind: "ground",
      boundary: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      elevation_m: 0,
      thickness_m: 0.3,
      layers: SP50_TEST_LAYERS.map((layer) => ({ ...layer })),
      heatedSide: "above",
    },
  ];

  const baseReport = runSP50Compliance(baseModel, undefined, {});
  const enrichedReport = runSP50Compliance(enrichedModel, undefined, {});
  if (baseReport.building.kob_W_m3K === null || enrichedReport.building.kob_W_m3K === null) {
    throw new Error("Expected kob values for comparison.");
  }
  if (Math.abs(baseReport.building.kob_W_m3K - enrichedReport.building.kob_W_m3K) < 1e-6) {
    throw new Error("Expected kob to change after adding roof and slab.");
  }
});

test("SP50 demo: returns a full report with core sections", () => {
  const demo = demoRunSP50Calculation();
  if (!demo.report.sourceData.gsop || demo.report.sourceData.gsop <= 0) {
    throw new Error("Expected positive GSOP in the demo report.");
  }
  if (demo.report.constructions.length < 3) {
    throw new Error("Expected at least three constructions in the demo report.");
  }
  if (!demo.report.constructions.some((entry) => entry.actualResistance_m2K_W !== null && entry.normalizedResistance_m2K_W !== null)) {
    throw new Error("Expected actual and normalized resistance values in the demo report.");
  }
  if (demo.report.building.kob_W_m3K === null || demo.report.building.kobNorm_W_m3K === null) {
    throw new Error("Expected actual and normative k_ob values in the demo report.");
  }
  const statuses = new Set(demo.report.constructions.map((entry) => entry.status));
  if (![...statuses].every((status) => status === "pass" || status === "fail" || status === "insufficient_data")) {
    throw new Error("Unexpected construction status in demo report.");
  }
  if (demo.topHeatLossContributors.length < 3) {
    throw new Error("Expected top-3 heat loss contributors in the demo report.");
  }
  if (!demo.report.constructions.some((entry) => entry.constructionType === "covering")) {
    throw new Error("Expected covering in demo SP50 constructions.");
  }
  if (!demo.report.constructions.some((entry) => entry.constructionType === "floorOverBasement")) {
    throw new Error("Expected floorOverBasement in demo SP50 constructions.");
  }
});

test("SP50 demo: exports JSON with major sections", () => {
  const demo = demoRunSP50Calculation();
  const json = exportDemoSp50ReportToJson(demo);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const requiredKeys = [
    "scenarioId",
    "sourceData",
    "constructions",
    "building",
    "energy",
    "temperature",
    "transient",
    "airPermeability",
    "moistureProtection",
    "floor",
    "statuses",
    "topHeatLossContributors",
    "engineeringConclusion",
    "missingData",
  ];
  requiredKeys.forEach((key) => {
    if (!(key in parsed)) {
      throw new Error(`Expected key ${key} in demo JSON export.`);
    }
  });
});
