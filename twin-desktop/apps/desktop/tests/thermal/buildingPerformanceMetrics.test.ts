import {
  buildDataRequirementsAudit,
  calculateCO2,
  calculateCompactness,
  calculateDegreeHoursOverheat,
  calculateDegreeHoursUnderheat,
  calculateEquivalentUValue,
  calculateOperativeTemperature,
  calculatePipeHeatLoss,
  calculateSurfaceTemperatureFactor,
  calculateTotalHeatLossCoefficient,
  calculateValidationMetrics,
  calculateWindowToWallRatio,
} from "../../src/core/thermal/derived/buildingPerformanceMetrics.js";
import { calculateLossShareMetrics } from "../../src/core/thermal/thermalDiagnostics.js";
import { expectApproximatelyEqual, test } from "../testHarness.js";

function metric(value: number | null) {
  return {
    value,
    unit: null,
    source: "solver",
    contour: "derived-only",
    affectsMainSolver: false,
    assumptions: [],
    warnings: [],
    status: "derived-only",
  };
}

function buildAuditFixture(overrides: any = {}) {
  return buildDataRequirementsAudit(({
    model: {
      windows: [{ width_m: 1.5, height_m: 1.4 }],
      thermalProtection: {
        envelope: [
          {
            id: "wall-1",
            label: "Стена 1",
            areaM2: 12,
            layers: [
              { materialId: "brick", thickness_m: 0.25 },
              { materialId: "mineral_wool", thickness_m: 0.12 },
            ],
          },
        ],
        climate: {
          indoorTemperatureC: 20,
          outdoorHeatingPeriodAverageC: -3.1,
          heatingPeriodDurationDays: 214,
        },
      },
      pipes: [],
      sensors: [],
      equipment: [],
      rooms: [{ id: "room-1", name: "Комната 1" }],
      ...overrides.model,
    },
    thermalResult: {
      timeline: [{ timeHours: 0, outdoorTemperatureC: -10, rooms: { "room-1": { temperatureC: 20, heatingPowerW: 0, setpointC: 21 } } }],
      rooms: {
        "room-1": {
          roomId: "room-1",
          timeline: [
            { timeHours: 0, temperatureC: 20, heatingPowerW: 0 },
            { timeHours: 1, temperatureC: 21, heatingPowerW: 0 },
          ],
          dailyEnergyKWh: 5,
          discomfortHours: 0,
        },
      },
      summary: { totalEnergyKWh: 120 },
      ...overrides.thermalResult,
    },
    thermalRcModel: {
      zones: [{ id: "room-1", name: "Комната 1", volume_m3: 48, capacitance_J_K: 40000, ventilationACH: 0.2 }],
      outdoorLinks: [{ id: "link-1", wallId: "wall-1", fromZoneId: "room-1", area_m2: 12, conductance_W_K: 8 }],
      ...overrides.thermalRcModel,
    },
    options: {
      setpoints: { day: 21, night: 18 },
      heatRecoveryFactor: 0.35,
      ...overrides.options,
    },
    derived: {
      transmissionHeatLossCoefficient_W_K: metric(80),
      infiltrationHeatLossCoefficient_W_K: metric(10),
      ventilationHeatLossCoefficient_W_K: metric(15),
      totalHeatLossCoefficient_W_K: metric(105),
      buildingTauHours: metric(3.5),
      ventilationRecovery: {
        efficiency: metric(0.35),
        ventilationLossBeforeRecovery_W: metric(120),
        ventilationLossAfterRecovery_W: metric(78),
        savedByRecovery_W: metric(42),
      },
      hydronic: null,
      ...overrides.derived,
    },
    performanceOptions: overrides.performanceOptions ?? {},
    adjacency: {
      external: [{ wallId: "wall-1", area_m2: 12, orientation: "S" }],
      ...overrides.adjacency,
    },
    zoneDiagnostics: overrides.zoneDiagnostics ?? [{ zoneId: "room-1", temperatureC: 21 }],
  }) as any);
}

test("building performance: compactness A_env=300 V_h=600 => 0.5", () => {
  const result = calculateCompactness(300, 600);
  expectApproximatelyEqual(result.value ?? 0, 0.5, 1e-9, "K_compact");
  if (result.affectsMainSolver) {
    throw new Error("compactness must not affect main solver");
  }
});

test("building performance: compactness V_h=0 => no value + warning", () => {
  const result = calculateCompactness(300, 0);
  if (result.value !== null) {
    throw new Error("Expected null compactness for V_h=0");
  }
  if (!result.warnings.some((warning) => warning.includes("V_h"))) {
    throw new Error("Expected V_h warning");
  }
});

test("building performance: WWR A_win=40 A_facade=200 => 0.2 / 20%", () => {
  const result = calculateWindowToWallRatio(40, 200);
  expectApproximatelyEqual(result.ratio.value ?? 0, 0.2, 1e-9, "WWR");
  expectApproximatelyEqual(result.percent.value ?? 0, 20, 1e-9, "WWR percent");
});

test("building performance: WWR A_facade=0 => warning/no value", () => {
  const result = calculateWindowToWallRatio(40, 0);
  if (result.ratio.value !== null) {
    throw new Error("Expected null WWR for A_facade=0");
  }
  if (!result.ratio.warnings.length) {
    throw new Error("Expected WWR warning");
  }
});

test("building performance: U_eq weighted average", () => {
  const result = calculateEquivalentUValue([
    { id: "a", U_W_m2K: 0.3, areaM2: 100 },
    { id: "b", U_W_m2K: 1.5, areaM2: 20 },
  ]);
  expectApproximatelyEqual(result.value ?? 0, 0.5, 1e-9, "U_eq");
});

test("building performance: H_total breakdown", () => {
  const result = calculateTotalHeatLossCoefficient({
    H_tr: 120,
    H_ve: 50,
    H_psi: 10,
    H_chi: 5,
  });
  expectApproximatelyEqual(result.H_total.value ?? 0, 185, 1e-9, "H_total");
});

test("loss shares: transmission=800 infiltration=200 ventilation=0", () => {
  const result = calculateLossShareMetrics({
    transmissionLossW: 800,
    infiltrationLossW: 200,
    mechanicalVentilationLossW: 0,
  });
  expectApproximatelyEqual(result.totalLossW, 1000, 1e-9, "totalLossW");
  expectApproximatelyEqual(result.infiltrationShareOfTotalPct ?? 0, 20, 1e-9, "infiltrationShareOfTotalPct");
  expectApproximatelyEqual(result.infiltrationShareOfAirExchangePct ?? 0, 100, 1e-9, "infiltrationShareOfAirExchangePct");
});

test("loss shares: transmission=800 infiltration=200 ventilation=200", () => {
  const result = calculateLossShareMetrics({
    transmissionLossW: 800,
    infiltrationLossW: 200,
    mechanicalVentilationLossW: 200,
  });
  expectApproximatelyEqual(result.totalLossW, 1200, 1e-9, "totalLossW");
  expectApproximatelyEqual(result.infiltrationShareOfTotalPct ?? 0, 16.6666666667, 1e-6, "infiltrationShareOfTotalPct");
  expectApproximatelyEqual(result.infiltrationShareOfAirExchangePct ?? 0, 50, 1e-9, "infiltrationShareOfAirExchangePct");
});

test("loss shares: transmission=0 infiltration=200 ventilation=0", () => {
  const result = calculateLossShareMetrics({
    transmissionLossW: 0,
    infiltrationLossW: 200,
    mechanicalVentilationLossW: 0,
  });
  expectApproximatelyEqual(result.totalLossW, 200, 1e-9, "totalLossW");
  expectApproximatelyEqual(result.infiltrationShareOfTotalPct ?? 0, 100, 1e-9, "infiltrationShareOfTotalPct");
  expectApproximatelyEqual(result.infiltrationShareOfAirExchangePct ?? 0, 100, 1e-9, "infiltrationShareOfAirExchangePct");
});

test("building performance: missing H_psi/H_chi treated as 0 with assumptions", () => {
  const result = calculateTotalHeatLossCoefficient({
    H_tr: 120,
    H_ve: 50,
  });
  expectApproximatelyEqual(result.H_total.value ?? 0, 170, 1e-9, "H_total without bridges");
  if (!result.H_psi.assumptions.some((item) => item.includes("H_ψ"))) {
    throw new Error("Expected H_psi assumption");
  }
});

test("building performance: degree hours underheat", () => {
  const result = calculateDegreeHoursUnderheat(
    [
      { timeHours: 0, temperatureC: 19 },
      { timeHours: 1, temperatureC: 20 },
      { timeHours: 2, temperatureC: 18 },
    ],
    20,
    1
  );
  expectApproximatelyEqual(result.value ?? 0, 3, 1e-9, "DH_underheat");
});

test("building performance: degree hours overheat", () => {
  const result = calculateDegreeHoursOverheat(
    [
      { timeHours: 0, temperatureC: 25 },
      { timeHours: 1, temperatureC: 27 },
      { timeHours: 2, temperatureC: 29 },
    ],
    26,
    1
  );
  expectApproximatelyEqual(result.value ?? 0, 4, 1e-9, "DH_overheat");
});

test("building performance: operative temperature", () => {
  const result = calculateOperativeTemperature(22, 20);
  expectApproximatelyEqual(result.value ?? 0, 21, 1e-9, "T_op");
});

test("building performance: f_Rsi", () => {
  const result = calculateSurfaceTemperatureFactor(16, -10, 20);
  expectApproximatelyEqual(result.f_Rsi.value ?? 0, 0.8666666667, 1e-6, "f_Rsi");
  if (result.status !== "normal") {
    throw new Error("Expected normal f_Rsi status");
  }
});

test("building performance: f_Rsi T_in == T_out => warning/no value", () => {
  const result = calculateSurfaceTemperatureFactor(20, 20, 20);
  if (result.f_Rsi.value !== null) {
    throw new Error("Expected null f_Rsi when T_in == T_out");
  }
  if (!result.f_Rsi.warnings.some((warning) => warning.includes("T_in"))) {
    throw new Error("Expected T_in≈T_out warning");
  }
});

test("building performance: pipe heat loss", () => {
  const result = calculatePipeHeatLoss(0.5, 20, 60, 20);
  expectApproximatelyEqual(result.value ?? 0, 400, 1e-9, "Q_pipe");
});

test("building performance: CO2", () => {
  const result = calculateCO2(1000, 0.4);
  expectApproximatelyEqual(result.CO2_kg.value ?? 0, 400, 1e-9, "CO2 kg");
});

test("building performance: validation metrics", () => {
  const measured = [{ value: 100 }, { value: 110 }, { value: 90 }];
  const simulated = [{ value: 95 }, { value: 115 }, { value: 85 }];
  const result = calculateValidationMetrics(measured, simulated);
  expectApproximatelyEqual(result.MBE_percent.value ?? 0, 1.6666666667, 1e-4, "MBE");
  expectApproximatelyEqual(result.CVRMSE_percent.value ?? 0, 6.123724356957, 1e-4, "CVRMSE");
  expectApproximatelyEqual(result.RMSE_T_C.value ?? 0, 5, 1e-9, "RMSE_T");
  if (result.status !== "valid") {
    throw new Error("Expected valid validation status");
  }
});

test("building performance: validation mismatch lengths => warning", () => {
  const result = calculateValidationMetrics([{ value: 100 }, { value: 110 }], [{ value: 95 }]);
  if (!result.MBE_percent.warnings.some((warning) => warning.includes("Длины рядов"))) {
    throw new Error("Expected length mismatch warning");
  }
});

test("data requirements audit: DH_overheat exposes explicit fallback warning for T_max", () => {
  const audit = buildAuditFixture();
  const metricAudit = audit.metrics.find((entry) => entry.metricId === "DH_overheat");
  if (!metricAudit) {
    throw new Error("Expected DH_overheat metric audit.");
  }
  if (!metricAudit.fallbackAllowed) {
    throw new Error("DH_overheat should allow fallback only with explicit warning.");
  }
  if (!metricAudit.warningIfFallback || !metricAudit.warningIfFallback.includes("26")) {
    throw new Error("Expected fallback warning for default T_max = 26 °C.");
  }
});

test("data requirements audit: CO2 requests emission factor instead of hiding it", () => {
  const audit = buildAuditFixture();
  const metricAudit = audit.metrics.find((entry) => entry.metricId === "CO2");
  if (!metricAudit) {
    throw new Error("Expected CO2 metric audit.");
  }
  if (metricAudit.canCalculateNow) {
    throw new Error("CO2 should not be calculable without emission factor.");
  }
  if (!metricAudit.missingFields.some((field) => field.includes("emissionFactorKgPerKWh"))) {
    throw new Error("Expected emission factor to be listed as missing user input.");
  }
});
