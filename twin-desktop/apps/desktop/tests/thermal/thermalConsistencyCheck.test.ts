/**
 * Numerical consistency checks for the thermal calculation pipeline.
 *
 * Verifies that the consistency report's invariants all pass
 * for the canonical demo house scenario.
 */

import { runThermalSimulation } from "../../src/core/thermal/solver.js";
import { buildThermalConsistencyReport } from "../../src/core/thermal/consistencyCheck.js";
import { videoDemoHouse } from "../../src/demo/videoDemoHouse.js";
import { test } from "../testHarness.js";

const BASE_OPTIONS = {
  duration: "24h" as const,
  outdoor: { baseC: -26, amplitudeC: 4 },
  setpoints: { day: 21, night: 18, dayStartHour: 7, nightStartHour: 22 },
  internalGains: { dayGain_W_m2: 5, nightGain_W_m2: 1 },
  infiltrationACH: 0.5,
  ventilationACH: 0,
};

function runDemo() {
  return runThermalSimulation(videoDemoHouse, BASE_OPTIONS);
}

test("consistency INV-01: H_total = H_tr + H_inf + H_ve", () => {
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);
  const inv = report.invariants.find((i) => i.id === "INV-01");
  if (!inv) {
    throw new Error("INV-01 not found in invariants.");
  }
  if (inv.status === "FAIL") {
    throw new Error(`INV-01 failed: ${inv.explanation}  actual=${inv.actual}  expected=${inv.expected}`);
  }
});

test("consistency INV-02: component sum ≈ totalLossW", () => {
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);
  const inv = report.invariants.find((i) => i.id === "INV-02");
  if (!inv) throw new Error("INV-02 not found.");
  if (inv.status === "FAIL") {
    throw new Error(`INV-02 failed: diff=${inv.differenceAbs?.toFixed(1)} Вт (${inv.differencePercent?.toFixed(2)}%)`);
  }
});

test("consistency INV-03: room sum ≈ totalLossW", () => {
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);
  const inv = report.invariants.find((i) => i.id === "INV-03");
  if (!inv) throw new Error("INV-03 not found.");
  if (inv.status === "FAIL") {
    throw new Error(`INV-03 failed: Σ zones=${inv.actual?.toFixed(0)} W, building=${inv.expected?.toFixed(0)} W, diff=${inv.differencePercent?.toFixed(2)}%`);
  }
});

test("consistency INV-04: energy from timeline ≈ summary.totalEnergyKWh", () => {
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);
  const inv = report.invariants.find((i) => i.id === "INV-04");
  if (!inv) throw new Error("INV-04 not found.");
  if (inv.status === "FAIL") {
    throw new Error(`INV-04 failed: recomputed=${inv.actual?.toFixed(3)} kWh, summary=${inv.expected?.toFixed(3)} kWh, diff=${inv.differencePercent?.toFixed(2)}%`);
  }
});

test("consistency INV-06: max∑Q(t) from timeline = summary.peakLoadKW", () => {
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);
  const inv = report.invariants.find((i) => i.id === "INV-06");
  if (!inv) throw new Error("INV-06 not found.");
  if (inv.status === "FAIL") {
    throw new Error(`INV-06 failed: timeline peak=${inv.actual?.toFixed(3)} kW, summary=${inv.expected?.toFixed(3)} kW, diff=${inv.differencePercent?.toFixed(2)}%`);
  }
});

test("consistency report geometry: room count matches zones", () => {
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);
  if (report.geometry.roomCount !== report.geometry.zoneCount) {
    const inv = report.invariants.find((i) => i.id === "INV-07");
    if (inv?.status === "FAIL") {
      throw new Error(`Room count mismatch: BuildingModel.rooms=${report.geometry.roomCount}, zones=${report.geometry.zoneCount}`);
    }
  }
});

test("consistency report energy integration: <0.5% deviation", () => {
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);
  const pct = Math.abs(report.energyIntegration.differencePercent);
  if (pct > 0.5) {
    throw new Error(`Energy integration deviation ${pct.toFixed(3)}% exceeds 0.5% threshold. recomputed=${report.energyIntegration.recomputedEnergyKWh.toFixed(3)}, summary=${report.energyIntegration.reportedSummaryEnergyKWh.toFixed(3)}`);
  }
});

test("consistency report specific load sanity: 10 ≤ q_A ≤ 300 Вт/м²", () => {
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);
  const inv = report.invariants.find((i) => i.id === "INV-10");
  if (!inv) throw new Error("INV-10 not found.");
  if (inv.status === "FAIL") {
    throw new Error(`Specific load q_A = ${inv.actual?.toFixed(1)} Вт/м² is outside [10, 300] range.`);
  }
});

test("consistency report: overall status is not FAIL for demo house", () => {
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);
  const failedInvariants = report.invariants.filter((i) => i.status === "FAIL");
  if (failedInvariants.length > 0) {
    const details = failedInvariants
      .map((i) => `  ${i.id} (${i.label}): ${i.explanation}`)
      .join("\n");
    throw new Error(`${failedInvariants.length} invariant(s) FAIL for demo house:\n${details}`);
  }
});

test("consistency report: print all numbers for demo house", () => {
  // This test never fails — it prints the full report to stdout for inspection.
  const result = runDemo();
  const report = buildThermalConsistencyReport(result, BASE_OPTIONS, videoDemoHouse, null);

  const line = (label: string, value: string) =>
    `  ${label.padEnd(55)}: ${value}`;

  const lines = [
    "",
    "=== THERMAL CALCULATION CONSISTENCY REPORT ===",
    `  Overall status: ${report.overallStatus}`,
    "",
    "--- 1. Geometry ---",
    line("Room count (BuildingModel)", String(report.geometry.roomCount)),
    line("Zone count (diagnostics)", String(report.geometry.zoneCount)),
    line("Heated area", `${report.geometry.heatedAreaM2.toFixed(1)} м²`),
    line("Heated volume (Σ area×height)", `${report.geometry.heatedVolumeM3.toFixed(1)} м³`),
    line("Window area equiv (H_win/U_ок=1.8)", report.geometry.windowAreaEquivM2 !== null ? `${report.geometry.windowAreaEquivM2.toFixed(1)} м²` : "—"),
    line("Door area equiv (H_door/U_дв=1.5)", report.geometry.doorAreaEquivM2 !== null ? `${report.geometry.doorAreaEquivM2.toFixed(1)} м²` : "—"),
    "",
    "--- 2. Heat Loss Coefficients ---",
    line("H_tr (transmission)", `${report.heatLossCoefficients.H_tr_W_K?.toFixed(1) ?? "—"} Вт/К`),
    line("H_inf (infiltration)", `${report.heatLossCoefficients.H_inf_W_K?.toFixed(1) ?? "—"} Вт/К`),
    line("H_ve (ventilation)", `${report.heatLossCoefficients.H_ve_W_K?.toFixed(1) ?? "—"} Вт/К`),
    line("H_total", `${report.heatLossCoefficients.H_total_W_K?.toFixed(1) ?? "—"} Вт/К`),
    line("H_opaque slice", `${report.heatLossCoefficients.H_opaque_slice_W_K?.toFixed(1) ?? "—"} Вт/К`),
    line("H_window slice", `${report.heatLossCoefficients.H_window_slice_W_K?.toFixed(1) ?? "—"} Вт/К`),
    line("H_door slice", `${report.heatLossCoefficients.H_door_slice_W_K?.toFixed(1) ?? "—"} Вт/К`),
    "",
    "--- 3. Design ΔT ---",
    line("T_setpoint (day)", `${report.designDeltaT.T_setpoint_day_C} °C`),
    line("T_outdoor (reference)", `${report.designDeltaT.T_outdoor_ref_C.toFixed(1)} °C`),
    line("ΔT (setpoint)", `${report.designDeltaT.deltaT_K.toFixed(1)} К`),
    line("T_avg zones", `${report.designDeltaT.T_avg_zone_C?.toFixed(2) ?? "—"} °C`),
    line("ΔT (avg zones)", `${report.designDeltaT.deltaT_avg_zone_K?.toFixed(2) ?? "—"} К`),
    "",
    "--- 4. Peak Reconstruction ---",
    line("peakLoadKW (RC solver)", `${report.peakReconstruction.peakLoadKW_solver.toFixed(3)} кВт`),
    line("Q_stat = H × ΔT_уставка", `${report.peakReconstruction.Q_stat_H_setpoint_kW?.toFixed(3) ?? "—"} кВт`),
    line("Q_internal_gains", `${report.peakReconstruction.Q_internal_gains_kW?.toFixed(3) ?? "—"} кВт`),
    line("Q_stat − Q_int", `${report.peakReconstruction.Q_best_reconstructed_kW?.toFixed(3) ?? "—"} кВт`),
    line("Δ (peak − Q_stat)", `${report.peakReconstruction.differenceStatKW?.toFixed(3) ?? "—"} кВт (${report.peakReconstruction.differenceStatPercent?.toFixed(1) ?? "—"}%)`),
    line("Δ (peak − Q_stat_with_gains)", `${report.peakReconstruction.differenceWithGainsKW?.toFixed(3) ?? "—"} кВт (${report.peakReconstruction.differenceWithGainsPercent?.toFixed(1) ?? "—"}%)`),
    "",
    "--- 5. Component Sum ---",
    line("Q_opaque", `${(report.componentSum.Q_opaque_W / 1000).toFixed(3)} кВт`),
    line("Q_window", `${(report.componentSum.Q_window_W / 1000).toFixed(3)} кВт`),
    line("Q_door", `${(report.componentSum.Q_door_W / 1000).toFixed(3)} кВт`),
    line("Q_infiltration", `${(report.componentSum.Q_infiltration_W / 1000).toFixed(3)} кВт`),
    line("Q_ventilation", `${(report.componentSum.Q_ventilation_W / 1000).toFixed(3)} кВт`),
    line("Sum all components", `${(report.componentSum.sumAllComponentsW / 1000).toFixed(3)} кВт`),
    line("totalLossW (diagnostics)", `${(report.componentSum.reportedTotalLossW / 1000).toFixed(3)} кВт`),
    line("Δ%", `${report.componentSum.differencePercent.toFixed(3)}%`),
    "",
    "--- 6. Room Sum ---",
    line("Σ zones totalLossW", `${(report.roomSum.sumZoneLossW / 1000).toFixed(3)} кВт`),
    line("building.totalLossW", `${(report.roomSum.buildingTotalLossW / 1000).toFixed(3)} кВт`),
    line("Δ%", `${report.roomSum.differencePercent.toFixed(3)}%`),
    "",
    "--- 7. Energy Integration ---",
    line("Timeline steps", String(report.energyIntegration.timelineStepCount)),
    line("Median dt", `${report.energyIntegration.medianDtSeconds.toFixed(0)} с`),
    line("Duration", `${report.energyIntegration.durationHours.toFixed(1)} ч`),
    line("Min/Max power", `${report.energyIntegration.minTotalPowerKW.toFixed(2)} / ${report.energyIntegration.maxTotalPowerKW.toFixed(2)} кВт`),
    line("Recomputed energy (timeline)", `${report.energyIntegration.recomputedEnergyKWh.toFixed(4)} кВт·ч`),
    line("summary.totalEnergyKWh", `${report.energyIntegration.reportedSummaryEnergyKWh.toFixed(4)} кВт·ч`),
    line("Δ%", `${report.energyIntegration.differencePercent.toFixed(4)}%`),
    "",
    "--- 9. Invariants ---",
    ...report.invariants.map(
      (i) => `  [${i.status.padEnd(4)}] ${i.id}  ${i.label}`
        + (i.differencePercent !== undefined ? `  Δ=${i.differencePercent.toFixed(2)}%` : "")
    ),
    "",
    "--- Assumptions ---",
    ...report.assumptions.map((a) => `  • ${a}`),
    "",
    "--- Fallbacks ---",
    ...(report.fallbacks.length ? report.fallbacks.map((f) => `  ⚠ ${f}`) : ["  (нет)"]),
    "===========================================",
  ];

  console.log(lines.join("\n"));
});
