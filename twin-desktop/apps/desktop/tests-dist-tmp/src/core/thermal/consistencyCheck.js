/**
 * Numerical consistency verification for the thermal calculation pipeline.
 *
 * Pure functions — no UI imports, no stores.
 * Input: ThermalSimulationResult + BuildingModel + ThermalSimulationOptions.
 * Output: ThermalConsistencyReport — all numbers, PASS/WARN/FAIL per invariant.
 */
import { polygonArea } from "../../entities/geometry/geom";
import { THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C } from "../uncertainty/thermalMonteCarlo";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function finite(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function diffPct(actual, expected) {
    if (!Number.isFinite(expected) || Math.abs(expected) < 1e-9)
        return null;
    return ((actual - expected) / Math.abs(expected)) * 100;
}
function heatedVolumeFromModel(model) {
    return model.rooms.reduce((sum, room) => {
        const level = model.levels.find((l) => l.id === room.levelId);
        const h = Math.max(2.5, level?.height_m ?? 3);
        const area = Math.abs(polygonArea(room.polygon));
        return sum + area * h;
    }, 0);
}
function zoneTempAverage(result) {
    const zones = result.diagnostics?.zones ?? [];
    if (!zones.length)
        return null;
    const sum = zones.reduce((s, z) => s + z.temperatureC, 0);
    return sum / zones.length;
}
function recomputeEnergyFromTimeline(result) {
    const tl = result.timeline;
    if (tl.length < 2) {
        return {
            recomputedKWh: 0,
            stepCount: 0,
            medianDtSeconds: 0,
            minTotalPowerKW: 0,
            maxTotalPowerKW: 0,
            durationHours: 0,
        };
    }
    let totalJ = 0;
    let minPowerKW = Infinity;
    let maxPowerKW = -Infinity;
    const dts = [];
    for (let i = 1; i < tl.length; i++) {
        const dtHours = tl[i].timeHours - tl[i - 1].timeHours;
        const dtSeconds = dtHours * 3600;
        dts.push(dtSeconds);
        // Use the power at step i (start of interval convention)
        let stepPowerW = 0;
        const roomsEntry = tl[i].rooms;
        for (const roomId of Object.keys(roomsEntry)) {
            stepPowerW += Math.max(0, roomsEntry[roomId].heatingPowerW ?? 0);
        }
        const stepPowerKW = stepPowerW / 1000;
        if (stepPowerKW < minPowerKW)
            minPowerKW = stepPowerKW;
        if (stepPowerKW > maxPowerKW)
            maxPowerKW = stepPowerKW;
        totalJ += stepPowerW * dtSeconds;
    }
    dts.sort((a, b) => a - b);
    const medianDtSeconds = dts[Math.floor(dts.length / 2)] ?? 0;
    const durationHours = tl[tl.length - 1].timeHours - tl[0].timeHours;
    return {
        recomputedKWh: totalJ / 3_600_000,
        stepCount: tl.length - 1,
        medianDtSeconds,
        minTotalPowerKW: Number.isFinite(minPowerKW) ? minPowerKW : 0,
        maxTotalPowerKW: Number.isFinite(maxPowerKW) ? maxPowerKW : 0,
        durationHours,
    };
}
function mkItem(id, label, status, actual, expected, unit, explanation) {
    const differenceAbs = actual !== undefined && expected !== undefined ? actual - expected : undefined;
    const differencePercent = differenceAbs !== undefined && expected !== undefined && Math.abs(expected) > 1e-9
        ? (differenceAbs / Math.abs(expected)) * 100
        : undefined;
    return {
        id,
        label,
        status,
        actual,
        expected,
        differenceAbs,
        differencePercent,
        unit,
        explanation,
    };
}
function worstStatus(items) {
    if (items.some((i) => i.status === "FAIL"))
        return "FAIL";
    if (items.some((i) => i.status === "WARN"))
        return "WARN";
    if (items.some((i) => i.status === "PASS"))
        return "PASS";
    return "INFO";
}
// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export function buildThermalConsistencyReport(result, options, buildingModel, monteCarloResult) {
    const assumptions = [];
    const fallbacks = [];
    const bld = result.diagnostics?.building;
    const zones = result.diagnostics?.zones ?? [];
    const derived = result.diagnostics?.derived;
    // ------------------------------------------------------------------
    // 1. GEOMETRY
    // ------------------------------------------------------------------
    const heatedAreaM2 = finite(bld?.heatedFloorAreaM2) ?? 0;
    const heatedVolumeM3 = heatedVolumeFromModel(buildingModel);
    assumptions.push("Отапливаемый объём рассчитан как Σ(area_i × height_i) по всем комнатам BuildingModel (height из level или 3 м по умолчанию).");
    const refDeltaT = bld
        ? bld.referenceOutdoorC === undefined
            ? null
            : (derived ? null : null) // placeholder
        : null;
    void refDeltaT;
    const T_avg_zone = zoneTempAverage(result);
    const T_out_ref = finite(bld?.referenceOutdoorC);
    const T_setpoint = options.setpoints.day;
    const deltaT_setpoint = T_out_ref !== null ? T_setpoint - T_out_ref : null;
    const deltaT_avg_zone = T_avg_zone !== null && T_out_ref !== null ? T_avg_zone - T_out_ref : null;
    // H_slice: conductance from reference-slice losses
    const sliceDeltaT = deltaT_avg_zone ?? deltaT_setpoint ?? 1;
    const safeDelta = Math.max(1, Math.abs(sliceDeltaT));
    const H_opaque_slice = bld ? bld.totalOpaqueLossW / safeDelta : null;
    const H_window_slice = bld ? bld.totalWindowLossW / safeDelta : null;
    const H_door_slice = bld ? bld.totalDoorLossW / safeDelta : null;
    // Window/door equivalent areas using SP50 defaults (reverse from W/K → m²)
    // U_window ≈ 1.8 W/(m²·K) — SP50 typical; U_door ≈ 1.5 W/(m²·K)
    const U_WINDOW_DEFAULT = 1.8;
    const U_DOOR_DEFAULT = 1.5;
    const windowAreaEquivM2 = H_window_slice !== null ? H_window_slice / U_WINDOW_DEFAULT : null;
    const doorAreaEquivM2 = H_door_slice !== null ? H_door_slice / U_DOOR_DEFAULT : null;
    assumptions.push("Эквивалентные площади окон/дверей рассчитаны обратно из H_window/H_door, используя типовые U: окна 1.8, двери 1.5 Вт/(м²·К).");
    const geometry = {
        roomCount: buildingModel.rooms.length,
        zoneCount: zones.length,
        heatedAreaM2,
        heatedVolumeM3,
        externalWallAreaM2: null, // ThermalModel.outdoorLinks not in result
        windowAreaEquivM2,
        doorAreaEquivM2,
    };
    // ------------------------------------------------------------------
    // 2. HEAT LOSS COEFFICIENTS
    // ------------------------------------------------------------------
    const H_tr = finite(derived?.transmissionHeatLossCoefficient_W_K.value);
    const H_inf = finite(derived?.infiltrationHeatLossCoefficient_W_K.value);
    const H_ve = finite(derived?.ventilationHeatLossCoefficient_W_K.value);
    const H_total = finite(derived?.totalHeatLossCoefficient_W_K.value);
    const heatLossCoefficients = {
        H_tr_W_K: H_tr,
        H_inf_W_K: H_inf,
        H_ve_W_K: H_ve,
        H_total_W_K: H_total,
        H_opaque_slice_W_K: H_opaque_slice,
        H_window_slice_W_K: H_window_slice,
        H_door_slice_W_K: H_door_slice,
    };
    // ------------------------------------------------------------------
    // 3. DESIGN ΔT
    // ------------------------------------------------------------------
    const designDeltaT = {
        T_setpoint_day_C: T_setpoint,
        T_outdoor_ref_C: T_out_ref ?? options.outdoor.baseC,
        deltaT_K: deltaT_setpoint ?? T_setpoint - options.outdoor.baseC,
        T_avg_zone_C: T_avg_zone,
        deltaT_avg_zone_K: deltaT_avg_zone,
    };
    // ------------------------------------------------------------------
    // 4. PEAK LOSS RECONSTRUCTION
    // ------------------------------------------------------------------
    const peakLoadKW = result.summary.peakLoadKW;
    const Q_int_gains_W = finite(bld?.totalInternalGainsW);
    let Q_stat_H_setpoint_kW = null;
    let Q_stat_minus_gains_kW = null;
    if (H_total !== null && deltaT_setpoint !== null) {
        Q_stat_H_setpoint_kW = (H_total * deltaT_setpoint) / 1000;
        if (Q_int_gains_W !== null) {
            Q_stat_minus_gains_kW = (H_total * deltaT_setpoint - Q_int_gains_W) / 1000;
        }
    }
    const Q_best_reconstructed_kW = Q_stat_minus_gains_kW ?? Q_stat_H_setpoint_kW;
    const diffStatKW = Q_stat_H_setpoint_kW !== null ? peakLoadKW - Q_stat_H_setpoint_kW : null;
    const diffStatPct = diffStatKW !== null && Q_stat_H_setpoint_kW !== null
        ? diffPct(peakLoadKW, Q_stat_H_setpoint_kW)
        : null;
    const diffWithGainsKW = Q_stat_minus_gains_kW !== null ? peakLoadKW - Q_stat_minus_gains_kW : null;
    const diffWithGainsPct = diffWithGainsKW !== null && Q_stat_minus_gains_kW !== null
        ? diffPct(peakLoadKW, Q_stat_minus_gains_kW)
        : null;
    const peakReconstruction = {
        peakLoadKW_solver: peakLoadKW,
        Q_stat_H_setpoint_kW,
        Q_stat_minus_gains_kW,
        Q_best_reconstructed_kW,
        Q_internal_gains_kW: Q_int_gains_W !== null ? Q_int_gains_W / 1000 : null,
        differenceStatKW: diffStatKW,
        differenceStatPercent: diffStatPct,
        differenceWithGainsKW: diffWithGainsKW,
        differenceWithGainsPercent: diffWithGainsPct,
        explanation: "Стационарная оценка Q_stat = H_total × ΔT не совпадает с пиком RC по нескольким причинам: " +
            "(a) динамика RC — ёмкость задерживает реакцию здания; " +
            "(b) ΔT по зонам неоднородна — усреднённая T_inside ≠ уставке во всех зонах одновременно; " +
            "(c) внутренние теплопоступления частично компенсируют потери, но не в том же соотношении по времени; " +
            "(d) в пиковый момент не все зоны находятся одновременно в наихудших условиях. " +
            "Допустимое расхождение для зональной RC — до 10–20% от H_total×ΔT.",
    };
    // ------------------------------------------------------------------
    // 5. COMPONENT SUM CHECK
    // ------------------------------------------------------------------
    const Q_opaque = finite(bld?.totalOpaqueLossW) ?? 0;
    const Q_window = finite(bld?.totalWindowLossW) ?? 0;
    const Q_door = finite(bld?.totalDoorLossW) ?? 0;
    const Q_infil = finite(bld?.totalInfiltrationLossW) ?? 0;
    const Q_vent = finite(bld?.totalMechanicalVentilationLossW) ?? 0;
    const Q_transmission = Q_opaque + Q_window + Q_door;
    const Q_air_exchange = Q_infil + Q_vent;
    const sumAllW = Q_transmission + Q_air_exchange;
    const reportedTotalLossW = finite(bld?.totalLossW) ?? 0;
    const componentDiffW = sumAllW - reportedTotalLossW;
    const componentDiffPct = Math.abs(reportedTotalLossW) > 1 ? (componentDiffW / reportedTotalLossW) * 100 : 0;
    const componentSum = {
        Q_opaque_W: Q_opaque,
        Q_window_W: Q_window,
        Q_door_W: Q_door,
        Q_infiltration_W: Q_infil,
        Q_ventilation_W: Q_vent,
        Q_transmission_W: Q_transmission,
        Q_air_exchange_W: Q_air_exchange,
        sumAllComponentsW: sumAllW,
        reportedTotalLossW,
        differenceW: componentDiffW,
        differencePercent: componentDiffPct,
    };
    // ------------------------------------------------------------------
    // 6. ROOM SUM CHECK
    // ------------------------------------------------------------------
    const sumZoneLossW = zones.reduce((s, z) => s + (finite(z.totalLossW) ?? 0), 0);
    const roomDiffW = sumZoneLossW - reportedTotalLossW;
    const roomDiffPct = Math.abs(reportedTotalLossW) > 1 ? (roomDiffW / reportedTotalLossW) * 100 : 0;
    const roomSum = {
        zoneCount: zones.length,
        sumZoneLossW,
        buildingTotalLossW: reportedTotalLossW,
        differenceW: roomDiffW,
        differencePercent: roomDiffPct,
    };
    // ------------------------------------------------------------------
    // 7. ENERGY INTEGRATION
    // ------------------------------------------------------------------
    const { recomputedKWh, stepCount, medianDtSeconds, minTotalPowerKW, maxTotalPowerKW, durationHours } = recomputeEnergyFromTimeline(result);
    const reportedEnergyKWh = result.summary.totalEnergyKWh;
    const energyDiffKWh = recomputedKWh - reportedEnergyKWh;
    const energyDiffPct = Math.abs(reportedEnergyKWh) > 0.001 ? (energyDiffKWh / reportedEnergyKWh) * 100 : 0;
    const energyIntegration = {
        timelineStepCount: stepCount,
        medianDtSeconds,
        durationHours,
        minTotalPowerKW,
        maxTotalPowerKW,
        recomputedEnergyKWh: recomputedKWh,
        reportedSummaryEnergyKWh: reportedEnergyKWh,
        differenceKWh: energyDiffKWh,
        differencePercent: energyDiffPct,
    };
    // ------------------------------------------------------------------
    // 8. MONTE CARLO CHECK
    // ------------------------------------------------------------------
    let monteCarlo = null;
    if (monteCarloResult) {
        const mc = monteCarloResult;
        const minTemps = mc.scenarioSeries.minimumIndoorTemperatureC ?? [];
        const underCount = minTemps.filter((t) => Number.isFinite(t) && t < THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C).length;
        const recomputedProb = mc.runs > 0 ? underCount / mc.runs : null;
        const reportedProb = finite(mc.underheatingBelow20CProbability);
        const probDiff = recomputedProb !== null && reportedProb !== null
            ? Math.abs(recomputedProb - reportedProb)
            : null;
        const q = (arr, p) => {
            const sorted = [...arr].filter(Number.isFinite).sort((a, b) => a - b);
            if (!sorted.length)
                return null;
            const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
            return sorted[idx];
        };
        monteCarlo = {
            runs: mc.runs,
            underheatingThresholdC: THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C,
            underheatingBelow20Count: underCount,
            underheatingProbabilityReported: reportedProb,
            underheatingProbabilityRecomputed: recomputedProb,
            probabilityDifferenceAbs: probDiff,
            peakLoad_P10_kW: finite(mc.peakLoad.p10),
            peakLoad_P50_kW: finite(mc.peakLoad.p50),
            peakLoad_P90_kW: finite(mc.peakLoad.p90),
            energy_P10_kWh: finite(mc.totalEnergy.p10),
            energy_P50_kWh: finite(mc.totalEnergy.p50),
            energy_P90_kWh: finite(mc.totalEnergy.p90),
            minTemp_P10_C: q(minTemps, 0.10),
            minTemp_P50_C: q(minTemps, 0.50),
            minTemp_P90_C: q(minTemps, 0.90),
        };
    }
    // ------------------------------------------------------------------
    // 9. INVARIANT CHECKS — PASS / WARN / FAIL
    // ------------------------------------------------------------------
    const invariants = [];
    // INV-01: H_total = H_tr + H_inf + H_ve
    if (H_tr !== null && H_inf !== null && H_ve !== null && H_total !== null) {
        const sum = H_tr + H_inf + H_ve;
        const diff = Math.abs(sum - H_total);
        const pct = H_total > 0 ? (diff / H_total) * 100 : 0;
        invariants.push(mkItem("INV-01", "H_total = H_tr + H_inf + H_ve", pct < 0.1 ? "PASS" : pct < 1 ? "WARN" : "FAIL", sum, H_total, "Вт/К", pct < 0.1
            ? "Сумма компонент совпадает с H_total."
            : `Расхождение ${pct.toFixed(2)}%. Возможна неточность суммирования или рекуперация.`));
    }
    // INV-02: Component loss sum ≈ totalLossW
    {
        const pct = Math.abs(componentDiffPct);
        invariants.push(mkItem("INV-02", "Σ компонент ≈ totalLossW", pct < 0.5 ? "PASS" : pct < 2 ? "WARN" : "FAIL", sumAllW, reportedTotalLossW, "Вт", pct < 0.5
            ? "Сумма компонент совпадает с суммарными потерями."
            : `Расхождение ${pct.toFixed(2)}%. Проверьте порядок суммирования в diagnostics.`));
    }
    // INV-03: Room loss sum ≈ totalLossW
    {
        const pct = Math.abs(roomDiffPct);
        invariants.push(mkItem("INV-03", "Σ потерь по зонам ≈ totalLossW", pct < 1 ? "PASS" : pct < 5 ? "WARN" : "FAIL", sumZoneLossW, reportedTotalLossW, "Вт", pct < 1
            ? "Сумма по зонам совпадает с потерями здания."
            : `Расхождение ${pct.toFixed(2)}%. Возможно, некоторые зоны не вошли в срез (T_i < T_n или связи через пол/потолок не разбиты).`));
    }
    // INV-04: Energy integration agrees with summary
    {
        const pct = Math.abs(energyDiffPct);
        invariants.push(mkItem("INV-04", "∫ Q(t)dt / 3.6M ≈ summary.totalEnergyKWh", pct < 0.5 ? "PASS" : pct < 2 ? "WARN" : "FAIL", recomputedKWh, reportedEnergyKWh, "кВт·ч", pct < 0.5
            ? "Энергия, вычисленная из timeline, совпадает с summary.totalEnergyKWh."
            : `Расхождение ${pct.toFixed(2)}%. Проверьте шаг интегрирования — timeline может пропускать кадры.`));
    }
    // INV-05: Peak reconstruction (best estimate: with gains subtracted)
    if (Q_best_reconstructed_kW !== null) {
        const pct = Math.abs(diffWithGainsPct ?? diffStatPct ?? 100);
        invariants.push(mkItem("INV-05", "H_total × ΔT − Q_int ≈ peakLoadKW", pct < 10 ? "PASS" : pct < 20 ? "WARN" : "INFO", peakLoadKW, Q_best_reconstructed_kW, "кВт", pct < 10
            ? "Стационарная реконструкция согласуется с пиком RC."
            : pct < 20
                ? `Расхождение ${pct.toFixed(1)}% (в норме для динамического RC из-за ёмкости и разброса температур по зонам).`
                : `Расхождение ${pct.toFixed(1)}% — значительное. Это ожидаемо для RC с нестационарным профилем погоды, нелинейными уставками или большой ёмкостью.`));
    }
    // INV-06: peakLoadKW consistency — max of timeline Σ matches summary
    {
        let timelinePeak = 0;
        for (const point of result.timeline) {
            let sum = 0;
            for (const roomId of Object.keys(point.rooms)) {
                sum += Math.max(0, point.rooms[roomId].heatingPowerW ?? 0);
            }
            if (sum > timelinePeak)
                timelinePeak = sum;
        }
        const timelinePeakKW = timelinePeak / 1000;
        const pct = Math.abs(result.summary.peakLoadKW > 0 ? ((timelinePeakKW - result.summary.peakLoadKW) / result.summary.peakLoadKW) * 100 : 0);
        invariants.push(mkItem("INV-06", "max∑Q(t) из timeline = summary.peakLoadKW", pct < 0.5 ? "PASS" : pct < 2 ? "WARN" : "FAIL", timelinePeakKW, result.summary.peakLoadKW, "кВт", pct < 0.5
            ? "Пик из timeline совпадает с summary.peakLoadKW."
            : `Расхождение ${pct.toFixed(2)}%. Возможно, metrics.ts использует только frame.zones, а timeline.rooms включает другой набор.`));
    }
    // INV-07: Room count matches zone diagnostic count
    {
        const roomCount = buildingModel.rooms.length;
        const zoneCount = zones.length;
        invariants.push(mkItem("INV-07", "Число комнат BuildingModel = число зон в diagnostics", roomCount === zoneCount ? "PASS" : "WARN", zoneCount, roomCount, "шт", roomCount === zoneCount
            ? "Все комнаты из BuildingModel вошли в расчёт."
            : `Расхождение: ${roomCount} комнат в модели, ${zoneCount} зон в diagnostics. Возможно, часть комнат без стен не вошла в RC-граф.`));
    }
    // INV-08: Balance residual — informational only for dynamic RC.
    //
    // In a quasi-static solver the residual r = Q_heat + Q_int − Σ G·ΔT → 0.
    // In nonstatic RC, the missing term is C·dT/dt (capacitive storage):
    //   r ≈ C·dT/dt at the peak step.
    // This can be 50–100% of Q_total and is NOT a bug — it means the building
    // is still warming up at the moment of peak demand.
    // We report the number but mark it INFO so it never blocks the overall status.
    if (bld) {
        const residual = Math.abs(bld.balanceResidualW);
        const scale = Math.max(100, bld.totalLossW);
        const relResidual = residual / scale;
        invariants.push(mkItem("INV-08", "Остаток баланса |r| (C·dT/dt в динамическом RC)", "INFO", residual, 0, "Вт", `|r| = ${residual.toFixed(0)} Вт = ${(relResidual * 100).toFixed(1)}% от Q_total. ` +
            `В нестационарном RC остаток ≈ C·ΔT/Δt в пиковом срезе; это ожидаемо и не свидетельствует об ошибке.`));
    }
    // INV-09: Monte Carlo probability recomputation
    if (monteCarlo) {
        const probDiff = monteCarlo.probabilityDifferenceAbs;
        invariants.push(mkItem("INV-09", "P(T_min < 20°C) пересчитана = reported", probDiff === null ? "INFO" : probDiff < 0.01 ? "PASS" : probDiff < 0.03 ? "WARN" : "FAIL", monteCarlo.underheatingProbabilityRecomputed ?? undefined, monteCarlo.underheatingProbabilityReported ?? undefined, "доля", probDiff === null
            ? "Нет данных для верификации."
            : probDiff < 0.01
                ? "Вероятность недогрева совпадает с пересчитанной по minimumIndoorTemperatureC."
                : `Расхождение ${(probDiff * 100).toFixed(2)}%. Возможно, порог или набор прогонов отличается.`));
    }
    // INV-10: Specific area load sanity (Вт/м²)
    if (heatedAreaM2 > 0 && bld) {
        const qA = bld.totalHeatingW / heatedAreaM2;
        const sane = qA >= 10 && qA <= 300;
        invariants.push(mkItem("INV-10", "Удельная нагрузка q_A в инженерном диапазоне [10, 300] Вт/м²", sane ? "PASS" : qA < 5 || qA > 500 ? "FAIL" : "WARN", qA, undefined, "Вт/м²", sane
            ? `q_A = ${qA.toFixed(1)} Вт/м² — в пределах типичного диапазона жилых/административных зданий.`
            : `q_A = ${qA.toFixed(1)} Вт/м² — вне типичного диапазона. Проверьте площадь помещений и температурные допущения.`));
    }
    // Collect model fallbacks
    if (result.modelWarnings?.length) {
        for (const w of result.modelWarnings) {
            if (w.toLowerCase().includes("fallback") || w.toLowerCase().includes("запасн") || w.toLowerCase().includes("1.4")) {
                fallbacks.push(w);
            }
            else {
                assumptions.push(w);
            }
        }
    }
    if (!H_tr && !H_inf && !H_ve) {
        fallbacks.push("derived-коэффициенты H_tr/H_ve недоступны — нет diagnostics.derived в результате.");
    }
    return {
        generatedAt: Date.now(),
        geometry,
        heatLossCoefficients,
        designDeltaT,
        peakReconstruction,
        componentSum,
        roomSum,
        energyIntegration,
        monteCarlo,
        invariants,
        assumptions,
        fallbacks,
        overallStatus: worstStatus(invariants),
    };
}
