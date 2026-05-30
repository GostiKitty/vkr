import { polygonArea, segmentLength } from "../../../entities/geometry/geom";
import { computeWallProperties } from "../../../entities/material/types";
import { buildAdjacencyGraph } from "../../graph/adjacency";
import { internalSurfaceTemperatureC, thermalBridgeLinearConductance, thermalBridgePointConductance, } from "../formulas";
const DERIVED_CONTOUR = "derived-only";
const DERIVED_STATUS = "derived-only";
const DEFAULT_COMFORT_MAX_C = 26;
function derivedMetric(value, unit, source = "engineering-derived", assumptions = [], warnings = []) {
    return {
        value,
        unit,
        source,
        contour: DERIVED_CONTOUR,
        status: DERIVED_STATUS,
        affectsMainSolver: false,
        assumptions,
        warnings,
    };
}
const DATA_COMPLETENESS_SECTION_LABELS = {
    geometry: "Геометрия",
    materials: "Материалы",
    climate: "Климат",
    operation: "Эксплуатация",
    airExchange: "Воздухообмен",
    humidity: "Влажность",
    engineeringNetworks: "Инженерные сети",
    economy: "Экономика",
    ecology: "Экология",
    validation: "Валидация",
};
function isPresentValue(value) {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === "number") {
        return Number.isFinite(value);
    }
    if (typeof value === "string") {
        return value.trim().length > 0;
    }
    if (typeof value === "boolean") {
        return true;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return true;
}
function makeRequirementInput(input) {
    return {
        ...input,
        required: input.required ?? true,
        warnings: input.warnings ?? [],
    };
}
function buildMetricRequirementsMap(input) {
    const requiredInputs = input.requiredInputs ?? [];
    const missingFields = requiredInputs
        .filter((entry) => !entry.present)
        .map((entry) => `${entry.label} (${entry.sourcePath})`);
    return {
        metricId: input.metricId,
        formula: input.formula,
        requiredInputs,
        optionalInputs: input.optionalInputs ?? [],
        computedInputs: input.computedInputs ?? [],
        sourcePath: input.sourcePath,
        fallbackAllowed: input.fallbackAllowed ?? false,
        warningIfFallback: input.warningIfFallback ?? null,
        canCalculateNow: input.canCalculateNow,
        missingFields,
        affectsMainSolver: input.affectsMainSolver ?? false,
    };
}
function summarizeDataCompletenessSections(metrics) {
    return Object.keys(DATA_COMPLETENESS_SECTION_LABELS).map((sectionId) => {
        const fieldMap = new Map();
        const ingestField = (field) => {
            if (field.section !== sectionId) {
                return;
            }
            const dedupeKey = `${field.key}::${field.sourcePath}`;
            const existing = fieldMap.get(dedupeKey);
            if (!existing) {
                fieldMap.set(dedupeKey, {
                    ...field,
                    warnings: [...field.warnings],
                });
                return;
            }
            fieldMap.set(dedupeKey, {
                ...existing,
                present: existing.present || field.present,
                required: existing.required || field.required,
                warnings: Array.from(new Set([...existing.warnings, ...field.warnings])),
            });
        };
        metrics.forEach((metric) => {
            metric.requiredInputs.forEach(ingestField);
            metric.optionalInputs.forEach(ingestField);
            metric.computedInputs.forEach(ingestField);
        });
        const fields = Array.from(fieldMap.values());
        const requiredFields = fields.filter((field) => field.required);
        const availableCount = requiredFields.filter((field) => field.present).length;
        const fallbackCount = fields.filter((field) => field.sourceCategory === "fallbackDefault" && field.present).length;
        const missingFields = requiredFields
            .filter((field) => !field.present)
            .map((field) => `${field.label} (${field.sourcePath})`);
        const warnings = Array.from(new Set(fields.flatMap((field) => field.warnings)));
        let status = "needs_input";
        if (!fields.length) {
            status = "needs_input";
        }
        else if (missingFields.length === 0 && fallbackCount === 0) {
            status = "complete";
        }
        else if (missingFields.length === 0 && fallbackCount > 0) {
            status = "fallback";
        }
        else if (availableCount > 0 || fallbackCount > 0) {
            status = "partial";
        }
        return {
            id: sectionId,
            label: DATA_COMPLETENESS_SECTION_LABELS[sectionId],
            status,
            requiredCount: requiredFields.length,
            availableCount,
            fallbackCount,
            missingFields,
            warnings,
            fields,
        };
    });
}
export function calculateCompactness(A_env, V_h) {
    const warnings = [];
    if (!Number.isFinite(V_h) || V_h <= 0) {
        warnings.push("Отапливаемый объём V_h <= 0 — коэффициент компактности не рассчитан.");
        return derivedMetric(null, "1/м", "engineering-derived", ["K_compact = A_env / V_h"], warnings);
    }
    if (!Number.isFinite(A_env) || A_env <= 0) {
        warnings.push("Площадь наружной оболочки A_env <= 0 — коэффициент компактности не рассчитан.");
        return derivedMetric(null, "1/м", "engineering-derived", ["K_compact = A_env / V_h"], warnings);
    }
    return derivedMetric(A_env / V_h, "1/м", "engineering-derived", [
        "K_compact = A_env / V_h",
        "A_env — только наружная оболочка (стены, кровля, пол к наружной среде).",
    ]);
}
export function calculateWindowToWallRatio(A_win, A_facade) {
    const warnings = [];
    if (!Number.isFinite(A_facade) || A_facade <= 0) {
        warnings.push("Площадь фасада A_facade <= 0 — доля остекления не рассчитана.");
        return {
            ratio: derivedMetric(null, "доля", "engineering-derived", ["WWR = A_win / A_facade"], warnings),
            percent: derivedMetric(null, "%", "engineering-derived", ["WWR_percent = 100 · WWR"], warnings),
        };
    }
    const ratio = Math.max(0, A_win) / A_facade;
    return {
        ratio: derivedMetric(ratio, "доля", "engineering-derived", ["WWR = A_win / A_facade"]),
        percent: derivedMetric(ratio * 100, "%", "engineering-derived", ["WWR_percent = 100 · WWR"]),
    };
}
export function calculateEquivalentUValue(elements) {
    const valid = elements.filter((element) => element.U_W_m2K !== null &&
        element.areaM2 !== null &&
        Number.isFinite(element.U_W_m2K) &&
        Number.isFinite(element.areaM2) &&
        element.U_W_m2K > 0 &&
        element.areaM2 > 0);
    const excluded = elements.filter((element) => !valid.includes(element));
    const warnings = excluded.length
        ? [`Исключены элементы без валидных U/A: ${excluded.map((element) => element.label ?? element.id).join(", ")}.`]
        : [];
    if (!valid.length) {
        warnings.push("Нет элементов с валидными U и A — U_eq не рассчитан.");
        return derivedMetric(null, "Вт/(м²·К)", "engineering-derived", ["U_eq = Σ(U_i · A_i) / ΣA_i"], warnings);
    }
    const weighted = valid.reduce((sum, element) => ({
        numerator: sum.numerator + element.U_W_m2K * element.areaM2,
        area: sum.area + element.areaM2,
    }), { numerator: 0, area: 0 });
    if (weighted.area <= 0) {
        return derivedMetric(null, "Вт/(м²·К)", "engineering-derived", ["U_eq = Σ(U_i · A_i) / ΣA_i"], warnings);
    }
    const reducedElements = valid.filter((element) => element.usesReducedResistance);
    const assumptions = ["U_eq = Σ(U_i · A_i) / ΣA_i", "Используются только элементы с валидными U и A."];
    if (reducedElements.length) {
        assumptions.push(`Элементы с R_red не смешиваются с ψ/χ: ${reducedElements.map((element) => element.label ?? element.id).join(", ")}.`);
    }
    return derivedMetric(weighted.numerator / weighted.area, "Вт/(м²·К)", "engineering-derived", assumptions, warnings);
}
export function calculateTotalHeatLossCoefficient(input) {
    const assumptions = ["H_total = H_tr + H_ve + H_ψ + H_χ"];
    const warnings = [];
    const H_tr = Number.isFinite(input.H_tr) ? Math.max(0, input.H_tr) : null;
    const H_ve = Number.isFinite(input.H_ve) ? Math.max(0, input.H_ve) : null;
    const H_psi = input.H_psi === undefined || input.H_psi === null
        ? 0
        : Number.isFinite(input.H_psi)
            ? Math.max(0, input.H_psi)
            : null;
    const H_chi = input.H_chi === undefined || input.H_chi === null
        ? 0
        : Number.isFinite(input.H_chi)
            ? Math.max(0, input.H_chi)
            : null;
    if (input.H_psi === undefined || input.H_psi === null) {
        assumptions.push("H_ψ принят равным 0 — явные линейные мостики не заданы.");
    }
    if (input.H_chi === undefined || input.H_chi === null) {
        assumptions.push("H_χ принят равным 0 — явные точечные мостики не заданы.");
    }
    if (H_tr === null) {
        warnings.push("H_tr недоступен — H_total не рассчитан.");
    }
    if (H_ve === null) {
        warnings.push("H_ve недоступен — H_total не рассчитан.");
    }
    if (H_psi === null) {
        warnings.push("H_ψ недоступен — H_total не рассчитан.");
    }
    if (H_chi === null) {
        warnings.push("H_χ недоступен — H_total не рассчитан.");
    }
    const H_total = H_tr === null || H_ve === null || H_psi === null || H_chi === null
        ? null
        : H_tr + H_ve + H_psi + H_chi;
    return {
        H_tr: derivedMetric(H_tr, "Вт/К", "solver", ["H_tr = Σ(U_i · A_i) по наружной оболочке"]),
        H_ve: derivedMetric(H_ve, "Вт/К", "solver", ["H_ve — суммарный коэффициент воздухообмена (инфильтрация + вентиляция)."]),
        H_psi: derivedMetric(H_psi, "Вт/К", "engineering-derived", assumptions, input.H_psi == null ? [] : []),
        H_chi: derivedMetric(H_chi, "Вт/К", "engineering-derived", assumptions, input.H_chi == null ? [] : []),
        H_total: derivedMetric(H_total, "Вт/К", "engineering-derived", assumptions, warnings),
    };
}
export function calculateDegreeHoursUnderheat(series, T_min, dtHours) {
    if (!series.length) {
        return derivedMetric(null, "°C·ч", "solver", ["DH_underheat = Σ max(0, T_min − T_in(t)) · Δt"], [
            "Нет временного ряда температур.",
        ]);
    }
    if (!Number.isFinite(T_min)) {
        return derivedMetric(null, "°C·ч", "user input", ["DH_underheat = Σ max(0, T_min − T_in(t)) · Δt"], [
            "T_min не задан.",
        ]);
    }
    const dt = Number.isFinite(dtHours) && dtHours > 0 ? dtHours : 1;
    const value = series.reduce((sum, point) => sum + Math.max(0, T_min - point.temperatureC) * dt, 0);
    return derivedMetric(value, "°C·ч", "solver", [
        "DH_underheat = Σ max(0, T_min − T_in(t)) · Δt",
        "Сумма по зонам может превышать длительность сценария.",
    ]);
}
export function calculateDegreeHoursOverheat(series, T_max, dtHours) {
    if (!series.length) {
        return derivedMetric(null, "°C·ч", "solver", ["DH_overheat = Σ max(0, T_in(t) − T_max) · Δt"], [
            "Нет временного ряда температур.",
        ]);
    }
    const warnings = [];
    if (!Number.isFinite(T_max)) {
        return derivedMetric(null, "°C·ч", "fallback", ["DH_overheat = Σ max(0, T_in(t) − T_max) · Δt"], [
            "T_max не задан.",
        ]);
    }
    const dt = Number.isFinite(dtHours) && dtHours > 0 ? dtHours : 1;
    const value = series.reduce((sum, point) => sum + Math.max(0, point.temperatureC - T_max) * dt, 0);
    return derivedMetric(value, "°C·ч", "user input", [
        "DH_overheat = Σ max(0, T_in(t) − T_max) · Δt",
        "Не смешивать с discomfortHours без пояснения: здесь используется явный T_max.",
    ], warnings);
}
export function calculateOperativeTemperature(T_air, T_mrt, approximateMrt = false) {
    if (T_air === null || !Number.isFinite(T_air)) {
        return derivedMetric(null, "°C", "solver", ["T_op = (T_air + T_mrt) / 2"], ["T_air недоступна."]);
    }
    if (T_mrt === null || !Number.isFinite(T_mrt)) {
        return derivedMetric(null, "°C", "solver", ["T_op = (T_air + T_mrt) / 2"], ["T_mrt недоступна — T_op не рассчитан."]);
    }
    const warnings = approximateMrt ? ["T_mrt оценена по температурам поверхностей — приближение."] : [];
    return derivedMetric((T_air + T_mrt) / 2, "°C", approximateMrt ? "engineering-derived" : "solver", [
        "T_op = (T_air + T_mrt) / 2",
    ], warnings);
}
export function classifySurfaceTemperatureFactor(f_Rsi) {
    if (f_Rsi === null || !Number.isFinite(f_Rsi)) {
        return null;
    }
    if (f_Rsi < 0.5) {
        return "mold_risk_possible";
    }
    if (f_Rsi < 0.75) {
        return "cold_surface_risk";
    }
    return "normal";
}
export function calculateSurfaceTemperatureFactor(tau_si, T_out, T_in) {
    if (tau_si === null || T_out === null || T_in === null) {
        return {
            f_Rsi: derivedMetric(null, "доля", "engineering-derived", ["f_Rsi = (τ_si − T_out) / (T_in − T_out)"], [
                "Недостаточно данных для f_Rsi.",
            ]),
            status: null,
        };
    }
    const delta = T_in - T_out;
    if (Math.abs(delta) < 1e-6) {
        return {
            f_Rsi: derivedMetric(null, "доля", "engineering-derived", ["f_Rsi = (τ_si − T_out) / (T_in − T_out)"], [
                "T_in ≈ T_out — f_Rsi не определён.",
            ]),
            status: null,
        };
    }
    const value = (tau_si - T_out) / delta;
    return {
        f_Rsi: derivedMetric(value, "доля", "engineering-derived", [
            "f_Rsi = (τ_si − T_out) / (T_in − T_out)",
            "Диагностика холодных поверхностей; не заменяет расчёт влагопереноса.",
        ]),
        status: classifySurfaceTemperatureFactor(value),
    };
}
export function calculatePipeHeatLoss(U_pipe, lengthM, T_water, T_air, warnings = []) {
    if (U_pipe === null || !Number.isFinite(U_pipe) || U_pipe <= 0) {
        return derivedMetric(null, "Вт", "engineering-derived", ["Q_pipe = U_pipe · L · (T_water − T_air)"], [
            ...warnings,
            "U_pipe неизвестен — Q_pipe не рассчитан.",
        ]);
    }
    if (lengthM === null || !Number.isFinite(lengthM) || lengthM <= 0) {
        return derivedMetric(null, "Вт", "engineering-derived", ["Q_pipe = U_pipe · L · (T_water − T_air)"], [
            ...warnings,
            "Длина трубопровода неизвестна — Q_pipe не рассчитан.",
        ]);
    }
    if (T_water === null || !Number.isFinite(T_water)) {
        return derivedMetric(null, "Вт", "engineering-derived", ["Q_pipe = U_pipe · L · (T_water − T_air)"], [
            ...warnings,
            "T_water неизвестна — Q_pipe не рассчитан.",
        ]);
    }
    if (T_air === null || !Number.isFinite(T_air)) {
        return derivedMetric(null, "Вт", "engineering-derived", ["Q_pipe = U_pipe · L · (T_water − T_air)"], [
            ...warnings,
            "T_air неизвестна — Q_pipe не рассчитан.",
        ]);
    }
    return derivedMetric(U_pipe * lengthM * (T_water - T_air), "Вт", "engineering-derived", [
        "Q_pipe = U_pipe · L · (T_water − T_air)",
        "derived-only; не изменяет основной RC-solver.",
    ], warnings);
}
export function calculateCO2(E_kWh, emissionFactor, energySourceLabel = null) {
    if (E_kWh === null || !Number.isFinite(E_kWh) || E_kWh < 0) {
        return {
            CO2_kg: derivedMetric(null, "кг CO₂", "engineering-derived", ["CO2 = E · EF"], ["Энергия E недоступна."]),
            CO2_tonnes: derivedMetric(null, "т CO₂", "engineering-derived", ["CO2_tonnes = CO2_kg / 1000"]),
            emissionFactor: derivedMetric(emissionFactor, "кг CO₂/(кВт·ч)", "user input"),
            energySource: derivedMetric(energySourceLabel, null, "user input"),
            energyKWh: derivedMetric(E_kWh, "кВт·ч", "solver"),
        };
    }
    if (emissionFactor === null || !Number.isFinite(emissionFactor) || emissionFactor < 0) {
        return {
            CO2_kg: derivedMetric(null, "кг CO₂", "engineering-derived", ["CO2 = E · EF"], ["EF не задан — CO₂ не рассчитан."]),
            CO2_tonnes: derivedMetric(null, "т CO₂", "engineering-derived", ["CO2_tonnes = CO2_kg / 1000"]),
            emissionFactor: derivedMetric(null, "кг CO₂/(кВт·ч)", "user input", [], ["Задайте emissionFactor в настройках проекта."]),
            energySource: derivedMetric(energySourceLabel, null, "user input"),
            energyKWh: derivedMetric(E_kWh, "кВт·ч", "solver"),
        };
    }
    const co2Kg = E_kWh * emissionFactor;
    return {
        CO2_kg: derivedMetric(co2Kg, "кг CO₂", "engineering-derived", ["CO2 = E · EF"]),
        CO2_tonnes: derivedMetric(co2Kg / 1000, "т CO₂", "engineering-derived", ["CO2_tonnes = CO2_kg / 1000"]),
        emissionFactor: derivedMetric(emissionFactor, "кг CO₂/(кВт·ч)", "user input"),
        energySource: derivedMetric(energySourceLabel, null, "user input"),
        energyKWh: derivedMetric(E_kWh, "кВт·ч", "solver"),
    };
}
export function calculateValidationMetrics(measuredSeries, simulatedSeries) {
    const warnings = [];
    if (!measuredSeries.length || !simulatedSeries.length) {
        return emptyValidation("no_data", ["Нет измеренных или смоделированных данных."]);
    }
    const aligned = alignValidationSeries(measuredSeries, simulatedSeries, warnings);
    const n = aligned.length;
    if (n < 2) {
        return emptyValidation("insufficient_data", [
            ...warnings,
            "Недостаточно синхронизированных точек для CVRMSE (n < 2).",
        ]);
    }
    const measured = aligned.map((point) => point.measured);
    const simulated = aligned.map((point) => point.simulated);
    const errors = measured.map((value, index) => value - simulated[index]);
    const sumMeasured = measured.reduce((sum, value) => sum + value, 0);
    const meanMeasured = sumMeasured / n;
    const mbe = Math.abs(sumMeasured) < 1e-9
        ? null
        : (errors.reduce((sum, value) => sum + value, 0) / sumMeasured) * 100;
    const variance = errors.reduce((sum, value) => sum + value * value, 0) / (n - 1);
    const cvrmse = meanMeasured === 0 ? null : (Math.sqrt(variance) / Math.abs(meanMeasured)) * 100;
    const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / n);
    const period = formatValidationPeriod(aligned);
    return {
        MBE_percent: derivedMetric(mbe, "%", "user input", ["MBE = Σ(M_i − S_i) / ΣM_i · 100%"], warnings),
        CVRMSE_percent: derivedMetric(cvrmse, "%", "user input", [
            "CVRMSE = sqrt(Σ(M_i − S_i)² / (n − 1)) / mean(M) · 100%",
        ], warnings),
        RMSE_T_C: derivedMetric(rmse, "°C", "user input", ["RMSE_T = sqrt(Σ(T_meas,i − T_sim,i)² / N)"], warnings),
        sampleCount: derivedMetric(n, null, "user input"),
        validationPeriod: derivedMetric(period, null, "user input"),
        status: "valid",
    };
}
function emptyValidation(status, warnings) {
    return {
        MBE_percent: derivedMetric(null, "%", "user input", [], warnings),
        CVRMSE_percent: derivedMetric(null, "%", "user input", [], warnings),
        RMSE_T_C: derivedMetric(null, "°C", "user input", [], warnings),
        sampleCount: derivedMetric(null, null, "user input", [], warnings),
        validationPeriod: derivedMetric(null, null, "user input", [], warnings),
        status,
    };
}
function alignValidationSeries(measuredSeries, simulatedSeries, warnings) {
    if (measuredSeries.length !== simulatedSeries.length) {
        warnings.push(`Длины рядов различаются (measured=${measuredSeries.length}, simulated=${simulatedSeries.length}) — выполнено усечение по min(n).`);
    }
    const count = Math.min(measuredSeries.length, simulatedSeries.length);
    const aligned = [];
    for (let index = 0; index < count; index += 1) {
        const measured = measuredSeries[index];
        const simulated = simulatedSeries[index];
        if (!Number.isFinite(measured.value) || !Number.isFinite(simulated.value)) {
            continue;
        }
        const measuredTime = measured.timeHours ?? measured.timestamp ?? null;
        const simulatedTime = simulated.timeHours ?? simulated.timestamp ?? null;
        if (measuredTime !== null &&
            simulatedTime !== null &&
            Math.abs(measuredTime - simulatedTime) > 1e-3) {
            warnings.push(`Несовпадение меток времени в точке ${index}: measured=${measuredTime}, simulated=${simulatedTime}.`);
        }
        aligned.push({
            measured: measured.value,
            simulated: simulated.value,
            timeHours: measuredTime ?? simulatedTime,
        });
    }
    return aligned;
}
function formatValidationPeriod(aligned) {
    const times = aligned.map((point) => point.timeHours).filter((value) => value !== null);
    if (!times.length) {
        return `${aligned.length} точек`;
    }
    const min = Math.min(...times);
    const max = Math.max(...times);
    return `${min.toFixed(2)}–${max.toFixed(2)} ч (${aligned.length} точек)`;
}
function windowAreaM2(window) {
    return Math.max(0, window.width_m) * Math.max(0, window.height_m);
}
function exteriorEnvelopeAreaM2(model, adjacency) {
    const facadeAreaM2 = adjacency.external.reduce((sum, edge) => sum + Math.max(0, edge.area_m2), 0);
    const roofAreaM2 = (model.roofs ?? []).reduce((sum, roof) => sum + Math.abs(polygonArea(roof.boundary)), 0);
    const floorAreaM2 = (model.floorSlabs ?? [])
        .filter((slab) => slab.kind === "ground" || slab.kind === "basement")
        .reduce((sum, slab) => sum + Math.abs(polygonArea(slab.boundary)), 0);
    return facadeAreaM2 + roofAreaM2 + floorAreaM2;
}
function facadeAreaM2(adjacency) {
    return adjacency.external.reduce((sum, edge) => sum + Math.max(0, edge.area_m2), 0);
}
function totalWindowAreaM2(model) {
    return model.windows.reduce((sum, window) => sum + windowAreaM2(window), 0);
}
function heatedVolumeM3(model, thermalModel) {
    const fromMeta = model.thermalProtection?.heatedVolumeM3;
    if (fromMeta !== undefined && Number.isFinite(fromMeta) && fromMeta > 0) {
        return fromMeta;
    }
    return thermalModel.zones.reduce((sum, zone) => sum + Math.max(0, zone.volume_m3), 0);
}
function collectOutdoorLinkElements(thermalModel) {
    return thermalModel.outdoorLinks.flatMap((link, index) => {
        const parts = [];
        const pushPart = (suffix, conductance) => {
            if (conductance === undefined || !Number.isFinite(conductance) || conductance <= 0) {
                return;
            }
            const areaM2 = link.area_m2 > 0 ? link.area_m2 : null;
            if (!areaM2) {
                return;
            }
            parts.push({
                id: `${link.id}-${suffix}`,
                label: `Наружная связь ${index + 1} (${suffix})`,
                conductance,
                areaM2,
            });
        };
        pushPart("opaque", link.conductanceOpaque_W_K);
        pushPart("window", link.conductanceWindow_W_K);
        pushPart("door", link.conductanceDoor_W_K);
        if (!parts.length && link.conductance_W_K > 0 && link.area_m2 > 0) {
            parts.push({
                id: link.id,
                label: `Наружная связь ${index + 1}`,
                conductance: link.conductance_W_K,
                areaM2: link.area_m2,
            });
        }
        return parts.map((part) => ({
            id: part.id,
            label: part.label,
            U_W_m2K: part.conductance / part.areaM2,
            areaM2: part.areaM2,
        }));
    });
}
function fragmentUValue(fragment) {
    if (!fragment.layers?.length) {
        return null;
    }
    const props = computeWallProperties(fragment.layers, undefined, { includeSp50AirFilms: true });
    return props?.uValue ?? null;
}
function collectExplicitUElements(model, adjacency) {
    const envelopeFragments = model.thermalProtection?.envelope ?? [];
    if (envelopeFragments.length) {
        return envelopeFragments.map((fragment) => ({
            id: fragment.id,
            label: fragment.label,
            U_W_m2K: fragmentUValue(fragment),
            areaM2: fragment.areaM2,
            usesReducedResistance: Boolean(fragment.heterogeneity?.planar?.length || fragment.multiplierMp),
        }));
    }
    return adjacency.external.map((edge) => ({
        id: edge.wallId,
        label: `Фасад ${edge.orientation}`,
        U_W_m2K: null,
        areaM2: edge.area_m2,
    }));
}
function resolveThermalBridgeConductances(model) {
    const fragments = model.thermalProtection?.envelope ?? [];
    const linear = fragments.flatMap((fragment) => fragment.heterogeneity?.linear ?? []);
    const point = fragments.flatMap((fragment) => fragment.heterogeneity?.point ?? []);
    if (!linear.length && !point.length) {
        return { H_psi: null, H_chi: null, explicit: false };
    }
    return {
        H_psi: thermalBridgeLinearConductance(linear),
        H_chi: thermalBridgePointConductance(point),
        explicit: true,
    };
}
function polylineLengthM(path) {
    if (path.length < 2) {
        return 0;
    }
    let length = 0;
    for (let index = 1; index < path.length; index += 1) {
        length += segmentLength(path[index - 1], path[index]);
    }
    return length;
}
function derivePipeLinearU_W_mK(pipe) {
    const warnings = [];
    const insulationThickness = pipe.insulationThickness_mm;
    const conductivity = pipe.insulationConductivity_W_mK;
    if (insulationThickness === undefined || conductivity === undefined || insulationThickness <= 0 || conductivity <= 0) {
        return { U_pipe: null, warnings: ["U_pipe не задан и не может быть оценен по изоляции."] };
    }
    const diameterM = Math.max(0.01, (pipe.innerDiameter_mm ?? pipe.diameter_mm) / 1000);
    const insulationM = insulationThickness / 1000;
    const resistance = insulationM / conductivity;
    const U = 1 / Math.max(resistance, 1e-6);
    warnings.push("U_pipe оценён по толщине и λ изоляции (цилиндрическое приближение).");
    void diameterM;
    return { U_pipe: U, warnings };
}
function resolvePipeWaterTemperature(pipe, hydronicSupply, hydronicReturn) {
    const warnings = [];
    if (Number.isFinite(pipe.fluidTemperatureC)) {
        return { T_water: pipe.fluidTemperatureC, warnings };
    }
    if (hydronicSupply !== null && hydronicReturn !== null) {
        warnings.push("T_water оценена как среднее (T_supply + T_return) / 2.");
        return { T_water: (hydronicSupply + hydronicReturn) / 2, warnings };
    }
    return { T_water: null, warnings: ["T_water неизвестна."] };
}
function extractSensorValidationSeries(model, thermalResult, roomId) {
    if (model.meta?.validationStatus === "unavailable" ||
        model.meta?.validationSource === "synthetic-demo-sensors") {
        return { measured: [], simulated: [] };
    }
    const sensors = model.sensors.filter((sensor) => sensor.type === "temperature" && sensor.history.length > 0 && (roomId ? sensor.roomId === roomId : true));
    if (!sensors.length) {
        return { measured: [], simulated: [] };
    }
    const sensor = sensors[0];
    const room = roomId ? thermalResult.rooms[roomId] : Object.values(thermalResult.rooms)[0];
    if (!room) {
        return { measured: [], simulated: [] };
    }
    const measured = sensor.history.map((reading) => ({
        timestamp: reading.timestamp,
        value: reading.value,
    }));
    const simulated = room.timeline.map((point) => ({
        timeHours: point.timeHours,
        value: point.temperatureC,
    }));
    return { measured, simulated };
}
function resolveComfortMinC(options, performanceOptions) {
    if (performanceOptions?.comfortMinC !== undefined && performanceOptions.comfortMinC !== null) {
        return { value: performanceOptions.comfortMinC, warnings: [] };
    }
    const day = options.setpoints.day;
    const night = options.setpoints.night;
    return { value: Math.min(day, night), warnings: [] };
}
function resolveComfortMaxC(performanceOptions) {
    if (performanceOptions?.comfortMaxC !== undefined && performanceOptions.comfortMaxC !== null) {
        return { value: performanceOptions.comfortMaxC, warnings: [] };
    }
    return {
        value: DEFAULT_COMFORT_MAX_C,
        warnings: [`T_max = ${DEFAULT_COMFORT_MAX_C} °C принят по умолчанию — задайте comfortMaxC явно.`],
    };
}
function estimateMeanRadiantTemperatureC(surfaces) {
    if (!surfaces.length) {
        return { T_mrt: null, approximate: false, warnings: ["Нет температур поверхностей для T_mrt."] };
    }
    const totalArea = surfaces.reduce((sum, surface) => sum + Math.max(0, surface.areaM2), 0);
    if (totalArea <= 0) {
        return { T_mrt: null, approximate: false, warnings: ["Суммарная площадь поверхностей для T_mrt <= 0."] };
    }
    const T_mrt = surfaces.reduce((sum, surface) => sum + surface.tau_si * Math.max(0, surface.areaM2), 0) / totalArea;
    return { T_mrt, approximate: true, warnings: ["T_mrt оценена как площадно-взвешенное среднее τ_si."] };
}
function buildSurfaceTemperatureDiagnostics(model, T_in, T_out) {
    const fragments = model.thermalProtection?.envelope ?? [];
    const surfaces = fragments.map((fragment) => {
        const props = fragment.layers?.length ? computeWallProperties(fragment.layers, undefined, { includeSp50AirFilms: true }) : null;
        const totalResistance = props?.rValue ?? null;
        const tau_si = totalResistance && totalResistance > 0
            ? internalSurfaceTemperatureC(T_in, T_out, 0.13, totalResistance)
            : null;
        const { f_Rsi, status } = calculateSurfaceTemperatureFactor(tau_si, T_out, T_in);
        return {
            surfaceId: fragment.id,
            label: fragment.label,
            f_Rsi,
            tau_si_C: derivedMetric(tau_si, "°C", "engineering-derived"),
            status,
        };
    });
    return { surfaces };
}
export function buildDataRequirementsAudit(input) {
    const { model, thermalResult, thermalRcModel, options, derived, performanceOptions, adjacency, zoneDiagnostics } = input;
    const envelopeFragments = model.thermalProtection?.envelope ?? [];
    const climateMeta = model.thermalProtection?.climate;
    const totalWindowArea = totalWindowAreaM2(model);
    const totalFacadeArea = facadeAreaM2(adjacency);
    const totalEnvelopeArea = exteriorEnvelopeAreaM2(model, adjacency);
    const heatedVolumeMeta = model.thermalProtection?.heatedVolumeM3;
    const heatedVolumeZones = thermalRcModel.zones.reduce((sum, zone) => sum + Math.max(0, zone.volume_m3), 0);
    const heatedVolume = heatedVolumeMeta && heatedVolumeMeta > 0 ? heatedVolumeMeta : heatedVolumeZones;
    const explicitUElements = collectExplicitUElements(model, adjacency);
    const validEquivalentElements = explicitUElements.filter((element) => element.U_W_m2K !== null &&
        element.areaM2 !== null &&
        Number.isFinite(element.U_W_m2K) &&
        Number.isFinite(element.areaM2) &&
        element.U_W_m2K > 0 &&
        element.areaM2 > 0);
    const linearBridges = envelopeFragments.flatMap((fragment) => fragment.heterogeneity?.linear ?? []);
    const pointBridges = envelopeFragments.flatMap((fragment) => fragment.heterogeneity?.point ?? []);
    const roomSeries = Object.values(thermalResult.rooms);
    const buildingUnderheatSeries = roomSeries.flatMap((room) => room.timeline);
    const latestIndoorTemperature = roomSeries[0]?.timeline.at(-1)?.temperatureC ?? null;
    const hasZoneDiagnostics = Boolean(zoneDiagnostics?.length);
    const peakIndoorTemperature = hasZoneDiagnostics
        ? zoneDiagnostics.reduce((sum, zone) => sum + zone.temperatureC, 0) /
            Math.max(zoneDiagnostics.length, 1)
        : latestIndoorTemperature;
    const outdoorTemperature = thermalResult.timeline[0]?.outdoorTemperatureC ?? null;
    const comfortMinExplicit = performanceOptions?.comfortMinC;
    const comfortMaxExplicit = performanceOptions?.comfortMaxC;
    const comfortMinResolved = resolveComfortMinC(options, performanceOptions);
    const comfortMaxResolved = resolveComfortMaxC(performanceOptions);
    const annualEnergyKWh = performanceOptions?.annualEnergyKWh ?? thermalResult.summary.totalEnergyKWh ?? null;
    const emissionFactor = performanceOptions?.emissionFactorKgPerKWh ?? null;
    const measuredSeries = performanceOptions?.measuredSeries ?? extractSensorValidationSeries(model, thermalResult, null).measured;
    const simulatedSeries = performanceOptions?.simulatedSeries ?? extractSensorValidationSeries(model, thermalResult, null).simulated;
    const hasValidationPairs = measuredSeries.length > 1 && simulatedSeries.length > 1;
    const hasIndoorHumidity = isPresentValue(climateMeta?.indoorRelativeHumidityPercent);
    const hasHeatingPeriodAverage = isPresentValue(climateMeta?.outdoorHeatingPeriodAverageC);
    const hasHeatingPeriodDuration = isPresentValue(climateMeta?.heatingPeriodDurationDays);
    const hasExplicitSurfaceLayers = envelopeFragments.some((fragment) => Boolean(fragment.layers?.length));
    const surfaceTempFallbackWarnings = [
        ...(outdoorTemperature === null ? ["Наружная температура отсутствует — для surface temperature/f_Rsi в текущем core есть fallback T_out = 0 °C."] : []),
        ...(!hasZoneDiagnostics && peakIndoorTemperature === null
            ? ["Внутренняя температура зоны отсутствует — для surface temperature/f_Rsi в текущем core используется fallback по setpoint."] : []),
    ];
    const hydronic = derived.hydronic;
    const hydronicWarnings = hydronic?.usedInputs.fluidDensityKgM3 != null && hydronic.usedInputs.fluidHeatCapacityJkgK != null
        ? ["Плотность и теплоёмкость теплоносителя сейчас берутся из внутренних water-defaults core, без отдельного пользовательского поля."]
        : [];
    const hasPipeNetwork = model.pipes.length > 0;
    const hasPipeInsulationData = model.pipes.some((pipe) => pipe.insulationThickness_mm !== undefined &&
        pipe.insulationConductivity_W_mK !== undefined &&
        pipe.insulationThickness_mm > 0 &&
        pipe.insulationConductivity_W_mK > 0);
    const hasPipeLength = model.pipes.some((pipe) => polylineLengthM(pipe.path) > 0);
    const hasPipeFluidTemperature = model.pipes.some((pipe) => Number.isFinite(pipe.fluidTemperatureC));
    const hasHydronicTemperatures = hydronic?.supplyTemperatureC != null && hydronic.returnTemperatureC != null;
    const hasPipeDesignIndoorTemperature = model.pipes.some((pipe) => Number.isFinite(pipe.designIndoorTemperatureC));
    const metrics = [
        buildMetricRequirementsMap({
            metricId: "K_compact",
            formula: "K_compact = A_env / V_h",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateCompactness",
            requiredInputs: [
                makeRequirementInput({
                    key: "geometry.A_env",
                    label: "Площадь наружной оболочки A_env",
                    section: "geometry",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "buildAdjacencyGraph(...) + exteriorEnvelopeAreaM2(...)",
                    present: totalEnvelopeArea > 0,
                }),
                makeRequirementInput({
                    key: "geometry.V_h",
                    label: "Отапливаемый объём V_h",
                    section: "geometry",
                    sourceCategory: heatedVolumeMeta && heatedVolumeMeta > 0 ? "buildingModel" : "computedAutomatically",
                    sourcePath: heatedVolumeMeta && heatedVolumeMeta > 0
                        ? "BuildingModel.thermalProtection.heatedVolumeM3"
                        : "ThermalModel.zones[].volume_m3",
                    present: heatedVolume > 0,
                }),
            ],
            canCalculateNow: totalEnvelopeArea > 0 && heatedVolume > 0,
        }),
        buildMetricRequirementsMap({
            metricId: "WWR",
            formula: "WWR = A_win / A_facade",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateWindowToWallRatio",
            requiredInputs: [
                makeRequirementInput({
                    key: "geometry.A_win",
                    label: "Суммарная площадь окон A_win",
                    section: "geometry",
                    sourceCategory: "buildingModel",
                    sourcePath: "BuildingModel.windows[]",
                    present: totalWindowArea >= 0 && model.windows.length > 0,
                }),
                makeRequirementInput({
                    key: "geometry.A_facade",
                    label: "Площадь фасада A_facade",
                    section: "geometry",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "AdjacencyResult.external[].area_m2",
                    present: totalFacadeArea > 0,
                }),
            ],
            canCalculateNow: totalFacadeArea > 0,
        }),
        buildMetricRequirementsMap({
            metricId: "U_eq",
            formula: "U_eq = Σ(U_i · A_i) / ΣA_i",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateEquivalentUValue",
            requiredInputs: [
                makeRequirementInput({
                    key: "materials.envelope_layers_or_u",
                    label: "U_i или слои ограждения",
                    section: "materials",
                    sourceCategory: envelopeFragments.length ? "thermalProtectionSp50" : "computedAutomatically",
                    sourcePath: envelopeFragments.length
                        ? "BuildingModel.thermalProtection.envelope[].layers"
                        : "ThermalModel.outdoorLinks[].conductance_W_K",
                    present: validEquivalentElements.length > 0,
                }),
                makeRequirementInput({
                    key: "geometry.envelope_area",
                    label: "Площадь элементов A_i",
                    section: "geometry",
                    sourceCategory: envelopeFragments.length ? "thermalProtectionSp50" : "computedAutomatically",
                    sourcePath: envelopeFragments.length
                        ? "BuildingModel.thermalProtection.envelope[].areaM2"
                        : "ThermalModel.outdoorLinks[].area_m2",
                    present: validEquivalentElements.length > 0,
                }),
            ],
            optionalInputs: [
                makeRequirementInput({
                    key: "materials.R_red_flag",
                    label: "Флаг использования R_red",
                    section: "materials",
                    sourceCategory: "thermalProtectionSp50",
                    sourcePath: "BuildingModel.thermalProtection.envelope[].heterogeneity / multiplierMp",
                    present: envelopeFragments.some((fragment) => Boolean(fragment.heterogeneity?.planar?.length || fragment.multiplierMp)),
                    required: false,
                }),
            ],
            canCalculateNow: validEquivalentElements.length > 0,
        }),
        buildMetricRequirementsMap({
            metricId: "H_total",
            formula: "H_total = H_tr + H_ve + H_ψ + H_χ",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateTotalHeatLossCoefficient",
            requiredInputs: [
                makeRequirementInput({
                    key: "thermal.H_tr",
                    label: "H_tr",
                    section: "materials",
                    sourceCategory: "diagnosticsThermalResult",
                    sourcePath: "DerivedRcDiagnostics.transmissionHeatLossCoefficient_W_K",
                    present: isPresentValue(derived.transmissionHeatLossCoefficient_W_K.value),
                }),
                makeRequirementInput({
                    key: "airExchange.H_ve",
                    label: "H_ve",
                    section: "airExchange",
                    sourceCategory: "diagnosticsThermalResult",
                    sourcePath: "DerivedRcDiagnostics.infiltrationHeatLossCoefficient_W_K + ventilationHeatLossCoefficient_W_K",
                    present: isPresentValue(derived.infiltrationHeatLossCoefficient_W_K.value) &&
                        isPresentValue(derived.ventilationHeatLossCoefficient_W_K.value),
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "materials.H_psi",
                    label: "H_ψ",
                    section: "materials",
                    sourceCategory: linearBridges.length ? "thermalProtectionSp50" : "fallbackDefault",
                    sourcePath: linearBridges.length
                        ? "BuildingModel.thermalProtection.envelope[].heterogeneity.linear[]"
                        : "fallback H_ψ = 0",
                    present: true,
                    required: false,
                    warnings: linearBridges.length ? [] : ["H_ψ принят равным 0 — явные линейные мостики не заданы."],
                }),
                makeRequirementInput({
                    key: "materials.H_chi",
                    label: "H_χ",
                    section: "materials",
                    sourceCategory: pointBridges.length ? "thermalProtectionSp50" : "fallbackDefault",
                    sourcePath: pointBridges.length
                        ? "BuildingModel.thermalProtection.envelope[].heterogeneity.point[]"
                        : "fallback H_χ = 0",
                    present: true,
                    required: false,
                    warnings: pointBridges.length ? [] : ["H_χ принят равным 0 — явные точечные мостики не заданы."],
                }),
            ],
            fallbackAllowed: true,
            warningIfFallback: !linearBridges.length || !pointBridges.length
                ? "При отсутствии явных ψ/χ текущий derived-контур принимает их равными 0 и должен показывать warning."
                : null,
            canCalculateNow: isPresentValue(derived.transmissionHeatLossCoefficient_W_K.value) &&
                isPresentValue(derived.infiltrationHeatLossCoefficient_W_K.value) &&
                isPresentValue(derived.ventilationHeatLossCoefficient_W_K.value),
        }),
        buildMetricRequirementsMap({
            metricId: "DH_underheat",
            formula: "DH_underheat = Σ max(0, T_min − T_in(t)) · Δt",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateDegreeHoursUnderheat",
            requiredInputs: [
                makeRequirementInput({
                    key: "operation.temperature_series",
                    label: "Временной ряд T_in(t)",
                    section: "operation",
                    sourceCategory: "diagnosticsThermalResult",
                    sourcePath: "ThermalSimulationResult.rooms[].timeline[].temperatureC",
                    present: buildingUnderheatSeries.length > 0,
                }),
                makeRequirementInput({
                    key: "operation.comfort_min",
                    label: "Минимально допустимая температура T_min",
                    section: "operation",
                    sourceCategory: comfortMinExplicit != null ? "scenarioConfig" : "computedAutomatically",
                    sourcePath: comfortMinExplicit != null
                        ? "BuildBuildingPerformanceDiagnosticsOptions.comfortMinC"
                        : "ThermalSimulationOptions.setpoints.day/night -> min(...)",
                    present: isPresentValue(comfortMinResolved.value),
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "operation.delta_t_hours",
                    label: "Шаг интегрирования Δt",
                    section: "operation",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "BuildBuildingPerformanceDiagnosticsOptions.timestepSeconds",
                    present: true,
                    required: false,
                }),
            ],
            canCalculateNow: buildingUnderheatSeries.length > 0 && isPresentValue(comfortMinResolved.value),
        }),
        buildMetricRequirementsMap({
            metricId: "DH_overheat",
            formula: "DH_overheat = Σ max(0, T_in(t) − T_max) · Δt",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateDegreeHoursOverheat",
            requiredInputs: [
                makeRequirementInput({
                    key: "operation.temperature_series_overheat",
                    label: "Временной ряд T_in(t)",
                    section: "operation",
                    sourceCategory: "diagnosticsThermalResult",
                    sourcePath: "ThermalSimulationResult.rooms[].timeline[].temperatureC",
                    present: buildingUnderheatSeries.length > 0,
                }),
                makeRequirementInput({
                    key: "operation.comfort_max_user",
                    label: "Порог перегрева T_max",
                    section: "operation",
                    sourceCategory: comfortMaxExplicit != null ? "scenarioConfig" : "missingUserInput",
                    sourcePath: "BuildBuildingPerformanceDiagnosticsOptions.comfortMaxC",
                    present: comfortMaxExplicit != null,
                    warnings: comfortMaxExplicit != null ? [] : ["T_max не задан пользователем и должен быть явно подтверждён."],
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "operation.comfort_max_fallback",
                    label: "Fallback T_max",
                    section: "operation",
                    sourceCategory: comfortMaxExplicit != null ? "computedAutomatically" : "fallbackDefault",
                    sourcePath: comfortMaxExplicit != null
                        ? "BuildBuildingPerformanceDiagnosticsOptions.comfortMaxC"
                        : `fallback ${comfortMaxResolved.value} °C`,
                    present: isPresentValue(comfortMaxResolved.value),
                    required: false,
                    warnings: comfortMaxResolved.warnings,
                }),
            ],
            fallbackAllowed: true,
            warningIfFallback: comfortMaxResolved.warnings[0] ?? null,
            canCalculateNow: buildingUnderheatSeries.length > 0 && isPresentValue(comfortMaxResolved.value),
        }),
        buildMetricRequirementsMap({
            metricId: "T_op",
            formula: "T_op = (T_air + T_mrt) / 2",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateOperativeTemperature",
            requiredInputs: [
                makeRequirementInput({
                    key: "operation.zone_air_temperature",
                    label: "Температура воздуха T_air",
                    section: "operation",
                    sourceCategory: "diagnosticsThermalResult",
                    sourcePath: "ThermalSimulationResult.rooms[].timeline[].temperatureC",
                    present: latestIndoorTemperature !== null,
                }),
                makeRequirementInput({
                    key: "materials.surface_layers_for_mrt",
                    label: "Поверхности для оценки T_mrt",
                    section: "materials",
                    sourceCategory: "thermalProtectionSp50",
                    sourcePath: "BuildingModel.thermalProtection.envelope[].layers",
                    present: hasExplicitSurfaceLayers,
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "operation.mean_radiant_temperature",
                    label: "Средняя радиационная температура T_mrt",
                    section: "operation",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "estimateMeanRadiantTemperatureC(...)",
                    present: latestIndoorTemperature !== null && hasExplicitSurfaceLayers,
                    required: false,
                    warnings: hasExplicitSurfaceLayers ? ["T_mrt оценивается как derived approximation по температурам поверхностей."] : [],
                }),
            ],
            canCalculateNow: latestIndoorTemperature !== null && hasExplicitSurfaceLayers,
        }),
        buildMetricRequirementsMap({
            metricId: "f_Rsi",
            formula: "f_Rsi = (τ_si − T_out) / (T_in − T_out)",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateSurfaceTemperatureFactor",
            requiredInputs: [
                makeRequirementInput({
                    key: "materials.surface_resistance_data",
                    label: "Слои ограждения / сопротивление для τ_si",
                    section: "materials",
                    sourceCategory: "thermalProtectionSp50",
                    sourcePath: "BuildingModel.thermalProtection.envelope[].layers",
                    present: hasExplicitSurfaceLayers,
                }),
                makeRequirementInput({
                    key: "climate.outdoor_temperature_surface",
                    label: "Наружная температура T_out",
                    section: "climate",
                    sourceCategory: outdoorTemperature !== null ? "diagnosticsThermalResult" : "missingUserInput",
                    sourcePath: "ThermalSimulationResult.timeline[].outdoorTemperatureC",
                    present: outdoorTemperature !== null,
                    warnings: surfaceTempFallbackWarnings,
                }),
                makeRequirementInput({
                    key: "operation.indoor_temperature_surface",
                    label: "Внутренняя температура T_in",
                    section: "operation",
                    sourceCategory: peakIndoorTemperature !== null
                        ? hasZoneDiagnostics
                            ? "diagnosticsThermalResult"
                            : "diagnosticsThermalResult"
                        : "missingUserInput",
                    sourcePath: hasZoneDiagnostics
                        ? "ThermalSimulationDiagnostics.zones[].temperatureC"
                        : "ThermalSimulationResult.rooms[].timeline[].temperatureC",
                    present: peakIndoorTemperature !== null,
                    warnings: surfaceTempFallbackWarnings,
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "materials.tau_si",
                    label: "Внутренняя температура поверхности τ_si",
                    section: "materials",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "internalSurfaceTemperatureC(...)",
                    present: hasExplicitSurfaceLayers && (peakIndoorTemperature !== null || isPresentValue(options.setpoints.day)),
                    required: false,
                    warnings: surfaceTempFallbackWarnings,
                }),
                makeRequirementInput({
                    key: "operation.indoor_temperature_surface_fallback",
                    label: "Fallback T_in",
                    section: "operation",
                    sourceCategory: peakIndoorTemperature !== null ? "computedAutomatically" : "fallbackDefault",
                    sourcePath: peakIndoorTemperature !== null ? "zone diagnostics / last room temperature" : "ThermalSimulationOptions.setpoints.day",
                    present: peakIndoorTemperature !== null || isPresentValue(options.setpoints.day),
                    required: false,
                    warnings: peakIndoorTemperature !== null ? [] : surfaceTempFallbackWarnings,
                }),
                makeRequirementInput({
                    key: "climate.outdoor_temperature_surface_fallback",
                    label: "Fallback T_out",
                    section: "climate",
                    sourceCategory: outdoorTemperature !== null ? "computedAutomatically" : "fallbackDefault",
                    sourcePath: outdoorTemperature !== null ? "ThermalSimulationResult.timeline[0]" : "fallback T_out = 0 °C",
                    present: true,
                    required: false,
                    warnings: outdoorTemperature !== null ? [] : surfaceTempFallbackWarnings,
                }),
            ],
            fallbackAllowed: true,
            warningIfFallback: surfaceTempFallbackWarnings[0] ?? null,
            canCalculateNow: hasExplicitSurfaceLayers && (peakIndoorTemperature !== null || isPresentValue(options.setpoints.day)),
        }),
        buildMetricRequirementsMap({
            metricId: "Q_pipe",
            formula: "Q_pipe = U_pipe · L · (T_water − T_air)",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculatePipeHeatLoss",
            requiredInputs: [
                makeRequirementInput({
                    key: "engineering.pipes_present",
                    label: "Трубопроводы",
                    section: "engineeringNetworks",
                    sourceCategory: "buildingModel",
                    sourcePath: "BuildingModel.pipes[]",
                    present: hasPipeNetwork,
                }),
                makeRequirementInput({
                    key: "engineering.pipe_u",
                    label: "Линейный U_pipe",
                    section: "engineeringNetworks",
                    sourceCategory: hasPipeInsulationData ? "computedAutomatically" : "missingUserInput",
                    sourcePath: "PipeNetwork.insulationThickness_mm + insulationConductivity_W_mK",
                    present: hasPipeInsulationData,
                    warnings: hasPipeInsulationData ? [] : ["U_pipe не задан и не может быть оценён без данных по изоляции."],
                }),
                makeRequirementInput({
                    key: "engineering.pipe_length",
                    label: "Длина трубопровода L",
                    section: "engineeringNetworks",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "PipeNetwork.path[] -> polylineLengthM(...)",
                    present: hasPipeLength,
                }),
            ],
            optionalInputs: [
                makeRequirementInput({
                    key: "engineering.pipe_water_temperature_user",
                    label: "Температура теплоносителя T_water",
                    section: "engineeringNetworks",
                    sourceCategory: hasPipeFluidTemperature ? "buildingModel" : "missingUserInput",
                    sourcePath: "PipeNetwork.fluidTemperatureC",
                    present: hasPipeFluidTemperature,
                    required: false,
                }),
                makeRequirementInput({
                    key: "operation.pipe_air_temperature_user",
                    label: "Температура воздуха вокруг трубы T_air",
                    section: "operation",
                    sourceCategory: hasPipeDesignIndoorTemperature ? "buildingModel" : "diagnosticsThermalResult",
                    sourcePath: hasPipeDesignIndoorTemperature
                        ? "PipeNetwork.designIndoorTemperatureC"
                        : "ThermalSimulationResult.rooms[].timeline[].temperatureC",
                    present: hasPipeDesignIndoorTemperature || latestIndoorTemperature !== null,
                    required: false,
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "engineering.pipe_water_temperature_fallback",
                    label: "Fallback/derived T_water",
                    section: "engineeringNetworks",
                    sourceCategory: hasPipeFluidTemperature ? "computedAutomatically" : hasHydronicTemperatures ? "computedAutomatically" : "fallbackDefault",
                    sourcePath: hasPipeFluidTemperature
                        ? "PipeNetwork.fluidTemperatureC"
                        : hasHydronicTemperatures
                            ? "HydronicAssessment.supplyTemperatureC/returnTemperatureC"
                            : "T_water missing",
                    present: hasPipeFluidTemperature || Boolean(hasHydronicTemperatures),
                    required: false,
                    warnings: hasPipeFluidTemperature || !hasHydronicTemperatures
                        ? []
                        : ["T_water оценивается как среднее (T_supply + T_return) / 2."],
                }),
                makeRequirementInput({
                    key: "operation.pipe_air_temperature_fallback",
                    label: "Fallback T_air",
                    section: "operation",
                    sourceCategory: hasPipeDesignIndoorTemperature || latestIndoorTemperature !== null ? "computedAutomatically" : "fallbackDefault",
                    sourcePath: hasPipeDesignIndoorTemperature || latestIndoorTemperature !== null
                        ? "PipeNetwork.designIndoorTemperatureC / ThermalSimulationResult.rooms[]"
                        : "ThermalSimulationOptions.setpoints.day",
                    present: hasPipeDesignIndoorTemperature || latestIndoorTemperature !== null || isPresentValue(options.setpoints.day),
                    required: false,
                    warnings: hasPipeDesignIndoorTemperature || latestIndoorTemperature !== null
                        ? []
                        : ["T_air для трубы отсутствует — используется fallback по setpoint day."],
                }),
            ],
            fallbackAllowed: true,
            warningIfFallback: !hasPipeFluidTemperature && !hasHydronicTemperatures
                ? "Без температуры теплоносителя Q_pipe не рассчитывается; среднее T_supply/T_return допустимо только с явным warning."
                : !hasPipeDesignIndoorTemperature && latestIndoorTemperature === null
                    ? "При отсутствии локальной T_air current core использует setpoint day как fallback."
                    : null,
            canCalculateNow: hasPipeNetwork &&
                hasPipeInsulationData &&
                hasPipeLength &&
                (hasPipeFluidTemperature || Boolean(hasHydronicTemperatures)) &&
                (hasPipeDesignIndoorTemperature || latestIndoorTemperature !== null || isPresentValue(options.setpoints.day)),
        }),
        buildMetricRequirementsMap({
            metricId: "CO2",
            formula: "CO2 = E · EF",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateCO2",
            requiredInputs: [
                makeRequirementInput({
                    key: "ecology.energy_kwh",
                    label: "Энергия E",
                    section: "ecology",
                    sourceCategory: performanceOptions?.annualEnergyKWh != null ? "scenarioConfig" : "diagnosticsThermalResult",
                    sourcePath: performanceOptions?.annualEnergyKWh != null
                        ? "BuildBuildingPerformanceDiagnosticsOptions.annualEnergyKWh"
                        : "ThermalSimulationResult.summary.totalEnergyKWh",
                    present: annualEnergyKWh != null && annualEnergyKWh >= 0,
                }),
                makeRequirementInput({
                    key: "ecology.emission_factor",
                    label: "Коэффициент выбросов EF",
                    section: "ecology",
                    sourceCategory: emissionFactor != null ? "scenarioConfig" : "missingUserInput",
                    sourcePath: "BuildBuildingPerformanceDiagnosticsOptions.emissionFactorKgPerKWh",
                    present: emissionFactor != null,
                    warnings: emissionFactor != null ? [] : ["EF не задан — выбросы CO₂ должны быть запрошены у пользователя."],
                }),
            ],
            canCalculateNow: annualEnergyKWh != null && annualEnergyKWh >= 0 && emissionFactor != null,
        }),
        buildMetricRequirementsMap({
            metricId: "MBE",
            formula: "MBE = Σ(M_i − S_i) / ΣM_i · 100%",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateValidationMetrics",
            requiredInputs: [
                makeRequirementInput({
                    key: "validation.measured_series",
                    label: "Измеренный ряд M_i",
                    section: "validation",
                    sourceCategory: performanceOptions?.measuredSeries != null ? "scenarioConfig" : measuredSeries.length ? "buildingModel" : "missingUserInput",
                    sourcePath: performanceOptions?.measuredSeries != null
                        ? "BuildBuildingPerformanceDiagnosticsOptions.measuredSeries"
                        : "BuildingModel.sensors[].history",
                    present: measuredSeries.length > 0,
                    warnings: measuredSeries.length ? [] : ["Нет измеренного ряда для MBE/CVRMSE/RMSE_T."],
                }),
                makeRequirementInput({
                    key: "validation.simulated_series",
                    label: "Смоделированный ряд S_i",
                    section: "validation",
                    sourceCategory: performanceOptions?.simulatedSeries != null ? "scenarioConfig" : "diagnosticsThermalResult",
                    sourcePath: performanceOptions?.simulatedSeries != null
                        ? "BuildBuildingPerformanceDiagnosticsOptions.simulatedSeries"
                        : "ThermalSimulationResult.rooms[].timeline[].temperatureC",
                    present: simulatedSeries.length > 0,
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "validation.aligned_points",
                    label: "Синхронизированные пары точек",
                    section: "validation",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "alignValidationSeries(...)",
                    present: hasValidationPairs,
                    required: false,
                }),
            ],
            canCalculateNow: hasValidationPairs,
        }),
        buildMetricRequirementsMap({
            metricId: "CVRMSE",
            formula: "CVRMSE = sqrt(Σ(M_i − S_i)^2 / (n − 1)) / mean(M) · 100%",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateValidationMetrics",
            requiredInputs: [
                makeRequirementInput({
                    key: "validation.measured_series_cvrmse",
                    label: "Измеренный ряд M_i",
                    section: "validation",
                    sourceCategory: performanceOptions?.measuredSeries != null ? "scenarioConfig" : measuredSeries.length ? "buildingModel" : "missingUserInput",
                    sourcePath: performanceOptions?.measuredSeries != null
                        ? "BuildBuildingPerformanceDiagnosticsOptions.measuredSeries"
                        : "BuildingModel.sensors[].history",
                    present: measuredSeries.length > 0,
                }),
                makeRequirementInput({
                    key: "validation.simulated_series_cvrmse",
                    label: "Смоделированный ряд S_i",
                    section: "validation",
                    sourceCategory: performanceOptions?.simulatedSeries != null ? "scenarioConfig" : "diagnosticsThermalResult",
                    sourcePath: performanceOptions?.simulatedSeries != null
                        ? "BuildBuildingPerformanceDiagnosticsOptions.simulatedSeries"
                        : "ThermalSimulationResult.rooms[].timeline[].temperatureC",
                    present: simulatedSeries.length > 0,
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "validation.n_points",
                    label: "Число синхронизированных точек n",
                    section: "validation",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "alignValidationSeries(...)",
                    present: hasValidationPairs,
                    required: false,
                }),
            ],
            canCalculateNow: hasValidationPairs,
        }),
        buildMetricRequirementsMap({
            metricId: "RMSE_T",
            formula: "RMSE_T = sqrt(Σ(T_meas,i − T_sim,i)^2 / N)",
            sourcePath: "src/core/thermal/derived/buildingPerformanceMetrics.ts#calculateValidationMetrics",
            requiredInputs: [
                makeRequirementInput({
                    key: "validation.measured_series_rmse",
                    label: "Измеренный температурный ряд",
                    section: "validation",
                    sourceCategory: performanceOptions?.measuredSeries != null ? "scenarioConfig" : measuredSeries.length ? "buildingModel" : "missingUserInput",
                    sourcePath: performanceOptions?.measuredSeries != null
                        ? "BuildBuildingPerformanceDiagnosticsOptions.measuredSeries"
                        : "BuildingModel.sensors[].history",
                    present: measuredSeries.length > 0,
                }),
                makeRequirementInput({
                    key: "validation.simulated_series_rmse",
                    label: "Смоделированный температурный ряд",
                    section: "validation",
                    sourceCategory: performanceOptions?.simulatedSeries != null ? "scenarioConfig" : "diagnosticsThermalResult",
                    sourcePath: performanceOptions?.simulatedSeries != null
                        ? "BuildBuildingPerformanceDiagnosticsOptions.simulatedSeries"
                        : "ThermalSimulationResult.rooms[].timeline[].temperatureC",
                    present: simulatedSeries.length > 0,
                }),
            ],
            canCalculateNow: hasValidationPairs,
        }),
        buildMetricRequirementsMap({
            metricId: "R_red",
            formula: "R_red = r · R_0",
            sourcePath: "src/core/thermal/formulas.ts#reducedResistanceByHomogeneity",
            requiredInputs: [
                makeRequirementInput({
                    key: "materials.base_resistance",
                    label: "Базовое сопротивление R_0",
                    section: "materials",
                    sourceCategory: "thermalProtectionSp50",
                    sourcePath: "BuildingModel.thermalProtection.envelope[].layers / totalResistance_m2K_W",
                    present: envelopeFragments.some((fragment) => Boolean(fragment.layers?.length)),
                }),
                makeRequirementInput({
                    key: "materials.homogeneity_coefficient",
                    label: "Коэффициент однородности r",
                    section: "materials",
                    sourceCategory: envelopeFragments.some((fragment) => Boolean(fragment.multiplierMp || fragment.heterogeneity?.planar?.length))
                        ? "thermalProtectionSp50"
                        : "missingUserInput",
                    sourcePath: "BuildingModel.thermalProtection.envelope[].multiplierMp / heterogeneity",
                    present: envelopeFragments.some((fragment) => Boolean(fragment.multiplierMp || fragment.heterogeneity?.planar?.length)),
                    warnings: envelopeFragments.some((fragment) => Boolean(fragment.multiplierMp || fragment.heterogeneity?.planar?.length))
                        ? []
                        : ["Коэффициент однородности для R_red не задан."],
                }),
            ],
            canCalculateNow: envelopeFragments.some((fragment) => Boolean(fragment.layers?.length)) &&
                envelopeFragments.some((fragment) => Boolean(fragment.multiplierMp || fragment.heterogeneity?.planar?.length)),
        }),
        buildMetricRequirementsMap({
            metricId: "Q_psi_Q_chi",
            formula: "Q_ψ/Q_χ = ΔT · (Σψ_i·l_i + Σχ_i)",
            sourcePath: "src/core/thermal/formulas.ts#thermalBridgeLinearConductance",
            requiredInputs: [
                makeRequirementInput({
                    key: "materials.linear_bridges",
                    label: "Линейные мостики ψ·l",
                    section: "materials",
                    sourceCategory: linearBridges.length ? "thermalProtectionSp50" : "missingUserInput",
                    sourcePath: "BuildingModel.thermalProtection.envelope[].heterogeneity.linear[]",
                    present: linearBridges.length > 0,
                }),
                makeRequirementInput({
                    key: "materials.point_bridges",
                    label: "Точечные мостики χ",
                    section: "materials",
                    sourceCategory: pointBridges.length ? "thermalProtectionSp50" : "missingUserInput",
                    sourcePath: "BuildingModel.thermalProtection.envelope[].heterogeneity.point[]",
                    present: pointBridges.length > 0,
                }),
                makeRequirementInput({
                    key: "climate.delta_t_bridge",
                    label: "Перепад температур ΔT",
                    section: "climate",
                    sourceCategory: outdoorTemperature !== null && (peakIndoorTemperature !== null || isPresentValue(options.setpoints.day))
                        ? "diagnosticsThermalResult"
                        : "missingUserInput",
                    sourcePath: "ThermalSimulationResult.timeline[].outdoorTemperatureC + zone temperature",
                    present: outdoorTemperature !== null && (peakIndoorTemperature !== null || isPresentValue(options.setpoints.day)),
                }),
            ],
            canCalculateNow: (linearBridges.length > 0 || pointBridges.length > 0) &&
                outdoorTemperature !== null &&
                (peakIndoorTemperature !== null || isPresentValue(options.setpoints.day)),
        }),
        buildMetricRequirementsMap({
            metricId: "GSOP",
            formula: "GSOP = (T_in − T_ot,avg) · z_ot",
            sourcePath: "src/core/thermal/formulas.ts#gsop",
            requiredInputs: [
                makeRequirementInput({
                    key: "climate.heating_period_average",
                    label: "Средняя температура отопительного периода",
                    section: "climate",
                    sourceCategory: "thermalProtectionSp50",
                    sourcePath: "BuildingModel.thermalProtection.climate.outdoorHeatingPeriodAverageC",
                    present: hasHeatingPeriodAverage,
                }),
                makeRequirementInput({
                    key: "climate.heating_period_days",
                    label: "Продолжительность отопительного периода",
                    section: "climate",
                    sourceCategory: "thermalProtectionSp50",
                    sourcePath: "BuildingModel.thermalProtection.climate.heatingPeriodDurationDays",
                    present: hasHeatingPeriodDuration,
                }),
                makeRequirementInput({
                    key: "operation.indoor_temperature_gsop",
                    label: "Расчётная внутренняя температура",
                    section: "operation",
                    sourceCategory: isPresentValue(climateMeta?.indoorTemperatureC) ? "thermalProtectionSp50" : "scenarioConfig",
                    sourcePath: isPresentValue(climateMeta?.indoorTemperatureC)
                        ? "BuildingModel.thermalProtection.climate.indoorTemperatureC"
                        : "ThermalSimulationOptions.setpoints.day",
                    present: isPresentValue(climateMeta?.indoorTemperatureC) || isPresentValue(options.setpoints.day),
                }),
            ],
            canCalculateNow: hasHeatingPeriodAverage &&
                hasHeatingPeriodDuration &&
                (isPresentValue(climateMeta?.indoorTemperatureC) || isPresentValue(options.setpoints.day)),
        }),
        buildMetricRequirementsMap({
            metricId: "tau",
            formula: "τ = C / H",
            sourcePath: "src/core/thermal/derived/metrics.ts#buildRcDerivedDiagnostics",
            requiredInputs: [
                makeRequirementInput({
                    key: "materials.capacitance_total",
                    label: "Суммарная теплоёмкость C",
                    section: "materials",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "ThermalModel.zones[].capacitance_J_K",
                    present: thermalRcModel.zones.some((zone) => zone.capacitance_J_K > 0),
                }),
                makeRequirementInput({
                    key: "materials.heat_loss_total_tau",
                    label: "Суммарный коэффициент теплопотерь H",
                    section: "materials",
                    sourceCategory: "diagnosticsThermalResult",
                    sourcePath: "DerivedRcDiagnostics.totalHeatLossCoefficient_W_K",
                    present: isPresentValue(derived.totalHeatLossCoefficient_W_K.value),
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "materials.tau_hours",
                    label: "τ, ч",
                    section: "materials",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "thermalTimeConstantSeconds(...)",
                    present: isPresentValue(derived.buildingTauHours.value),
                    required: false,
                }),
            ],
            canCalculateNow: thermalRcModel.zones.some((zone) => zone.capacitance_J_K > 0) &&
                isPresentValue(derived.totalHeatLossCoefficient_W_K.value) &&
                derived.totalHeatLossCoefficient_W_K.value > 0,
        }),
        buildMetricRequirementsMap({
            metricId: "surface_temperature",
            formula: "τ_si = T_in − (T_in − T_out) · R_si / R_total",
            sourcePath: "src/core/thermal/formulas.ts#internalSurfaceTemperatureC",
            requiredInputs: [
                makeRequirementInput({
                    key: "materials.surface_layers",
                    label: "Слои конструкции / R_total",
                    section: "materials",
                    sourceCategory: "thermalProtectionSp50",
                    sourcePath: "BuildingModel.thermalProtection.envelope[].layers",
                    present: hasExplicitSurfaceLayers,
                }),
                makeRequirementInput({
                    key: "operation.indoor_temperature_surface_direct",
                    label: "Внутренняя температура T_in",
                    section: "operation",
                    sourceCategory: peakIndoorTemperature !== null ? "diagnosticsThermalResult" : "missingUserInput",
                    sourcePath: "ThermalSimulationDiagnostics.zones[].temperatureC / ThermalSimulationResult.rooms[]",
                    present: peakIndoorTemperature !== null,
                    warnings: surfaceTempFallbackWarnings,
                }),
                makeRequirementInput({
                    key: "climate.outdoor_temperature_surface_direct",
                    label: "Наружная температура T_out",
                    section: "climate",
                    sourceCategory: outdoorTemperature !== null ? "diagnosticsThermalResult" : "missingUserInput",
                    sourcePath: "ThermalSimulationResult.timeline[].outdoorTemperatureC",
                    present: outdoorTemperature !== null,
                    warnings: surfaceTempFallbackWarnings,
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "materials.surface_temperature_fallbacks",
                    label: "Fallbacks surface temperature",
                    section: "materials",
                    sourceCategory: surfaceTempFallbackWarnings.length > 0 ? "fallbackDefault" : "computedAutomatically",
                    sourcePath: "buildSurfaceTemperatureDiagnostics(...)",
                    present: true,
                    required: false,
                    warnings: surfaceTempFallbackWarnings,
                }),
            ],
            fallbackAllowed: true,
            warningIfFallback: surfaceTempFallbackWarnings[0] ?? null,
            canCalculateNow: hasExplicitSurfaceLayers && (peakIndoorTemperature !== null || isPresentValue(options.setpoints.day)),
        }),
        buildMetricRequirementsMap({
            metricId: "dew_point",
            formula: "t_dew = f(T_in, φ)",
            sourcePath: "src/core/thermal/formulas.ts#dewPointMagnusC",
            requiredInputs: [
                makeRequirementInput({
                    key: "operation.indoor_temperature_dew",
                    label: "Температура воздуха T_in",
                    section: "operation",
                    sourceCategory: isPresentValue(climateMeta?.indoorTemperatureC) ? "thermalProtectionSp50" : "scenarioConfig",
                    sourcePath: isPresentValue(climateMeta?.indoorTemperatureC)
                        ? "BuildingModel.thermalProtection.climate.indoorTemperatureC"
                        : "ThermalSimulationOptions.setpoints.day",
                    present: isPresentValue(climateMeta?.indoorTemperatureC) || isPresentValue(options.setpoints.day),
                }),
                makeRequirementInput({
                    key: "humidity.relative_humidity",
                    label: "Относительная влажность φ",
                    section: "humidity",
                    sourceCategory: hasIndoorHumidity ? "thermalProtectionSp50" : "missingUserInput",
                    sourcePath: "BuildingModel.thermalProtection.climate.indoorRelativeHumidityPercent",
                    present: hasIndoorHumidity,
                    warnings: hasIndoorHumidity ? [] : ["Относительная влажность не задана — SP50-контур использует fallback 55% RH, только с warning."],
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "humidity.relative_humidity_fallback",
                    label: "Fallback RH",
                    section: "humidity",
                    sourceCategory: hasIndoorHumidity ? "computedAutomatically" : "fallbackDefault",
                    sourcePath: hasIndoorHumidity ? "BuildingModel.thermalProtection.climate.indoorRelativeHumidityPercent" : "fallback RH = 55%",
                    present: true,
                    required: false,
                    warnings: hasIndoorHumidity ? [] : ["RH=55% допускается только как явный fallback с предупреждением."],
                }),
            ],
            fallbackAllowed: true,
            warningIfFallback: hasIndoorHumidity ? null : "Точка росы без заданной RH опирается на fallback 55% RH.",
            canCalculateNow: isPresentValue(climateMeta?.indoorTemperatureC) || isPresentValue(options.setpoints.day),
        }),
        buildMetricRequirementsMap({
            metricId: "ventilation_recovery",
            formula: "Q_vent,after = Q_vent,before · (1 − k_ef)",
            sourcePath: "src/core/thermal/derived/metrics.ts#buildVentilationRecovery",
            requiredInputs: [
                makeRequirementInput({
                    key: "airExchange.ventilation_loss_before",
                    label: "Потери вентиляции до рекуперации",
                    section: "airExchange",
                    sourceCategory: "diagnosticsThermalResult",
                    sourcePath: "ThermalSimulationDiagnostics.building.totalMechanicalVentilationLossW",
                    present: isPresentValue(derived.ventilationRecovery.ventilationLossBeforeRecovery_W.value),
                }),
                makeRequirementInput({
                    key: "airExchange.heat_recovery_factor",
                    label: "Коэффициент рекуперации k_ef",
                    section: "airExchange",
                    sourceCategory: "scenarioConfig",
                    sourcePath: "ThermalSimulationOptions.heatRecoveryFactor",
                    present: isPresentValue(options.heatRecoveryFactor),
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "airExchange.ventilation_after_recovery",
                    label: "Потери после рекуперации",
                    section: "airExchange",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "DerivedRcDiagnostics.ventilationRecovery",
                    present: isPresentValue(derived.ventilationRecovery.ventilationLossAfterRecovery_W.value),
                    required: false,
                    warnings: derived.ventilationRecovery.ventilationLossAfterRecovery_W.warnings,
                }),
            ],
            canCalculateNow: isPresentValue(derived.ventilationRecovery.ventilationLossBeforeRecovery_W.value) &&
                isPresentValue(options.heatRecoveryFactor),
        }),
        buildMetricRequirementsMap({
            metricId: "hydronic",
            formula: "Q_hyd = m · c_p · (T_supply − T_return)",
            sourcePath: "src/core/thermal/engineering/analysis.ts#buildHydronicAssessment",
            requiredInputs: [
                makeRequirementInput({
                    key: "engineering.required_heating_power",
                    label: "Требуемая мощность отопления",
                    section: "engineeringNetworks",
                    sourceCategory: "diagnosticsThermalResult",
                    sourcePath: "EngineeringBalanceSummary.requiredHeatingW",
                    present: hydronic != null,
                }),
                makeRequirementInput({
                    key: "engineering.supply_temperature",
                    label: "Температура подачи",
                    section: "engineeringNetworks",
                    sourceCategory: hydronic?.supplyTemperatureC != null ? "buildingModel" : "missingUserInput",
                    sourcePath: "Heating equipment params.supplyTemperatureC",
                    present: hydronic?.supplyTemperatureC != null,
                }),
                makeRequirementInput({
                    key: "engineering.return_temperature",
                    label: "Температура обратки",
                    section: "engineeringNetworks",
                    sourceCategory: hydronic?.returnTemperatureC != null ? "buildingModel" : "missingUserInput",
                    sourcePath: "Heating equipment params.returnTemperatureC",
                    present: hydronic?.returnTemperatureC != null,
                }),
                makeRequirementInput({
                    key: "engineering.mass_or_volume_flow",
                    label: "Расход теплоносителя",
                    section: "engineeringNetworks",
                    sourceCategory: hydronic?.usedInputs.massFlowKgS != null || hydronic?.usedInputs.volumeFlowM3H != null
                        ? "buildingModel"
                        : "missingUserInput",
                    sourcePath: "Heating model snapshot estimatedFlow_kg_s / volumeFlowM3H",
                    present: hydronic?.usedInputs.massFlowKgS != null || hydronic?.usedInputs.volumeFlowM3H != null,
                }),
            ],
            computedInputs: [
                makeRequirementInput({
                    key: "engineering.fluid_properties_default",
                    label: "Свойства теплоносителя (ρ, c_p)",
                    section: "engineeringNetworks",
                    sourceCategory: hydronic ? "fallbackDefault" : "missingUserInput",
                    sourcePath: "DEFAULT_WATER_DENSITY_KG_M3 + DEFAULT_WATER_HEAT_CAPACITY_J_KG_K",
                    present: hydronic != null,
                    required: false,
                    warnings: hydronicWarnings,
                }),
                makeRequirementInput({
                    key: "engineering.hydronic_delta_t",
                    label: "ΔT теплоносителя",
                    section: "engineeringNetworks",
                    sourceCategory: "computedAutomatically",
                    sourcePath: "HydronicAssessment.deltaT_C",
                    present: hydronic?.deltaT_C != null,
                    required: false,
                }),
            ],
            fallbackAllowed: true,
            warningIfFallback: hydronicWarnings[0] ?? null,
            canCalculateNow: hydronic != null &&
                hydronic.supplyTemperatureC != null &&
                hydronic.returnTemperatureC != null &&
                (hydronic.usedInputs.massFlowKgS != null || hydronic.usedInputs.volumeFlowM3H != null),
        }),
    ];
    const sections = summarizeDataCompletenessSections(metrics);
    const generatedWarnings = Array.from(new Set(metrics.flatMap((metric) => [
        ...(metric.warningIfFallback ? [metric.warningIfFallback] : []),
        ...metric.requiredInputs.flatMap((entry) => entry.warnings),
        ...metric.optionalInputs.flatMap((entry) => entry.warnings),
        ...metric.computedInputs.flatMap((entry) => entry.warnings),
    ].filter(Boolean))));
    return {
        metrics,
        sections,
        generatedWarnings,
    };
}
export function buildBuildingPerformanceDiagnostics(model, thermalResult, thermalRcModel, options, derived, performanceOptions = {}, adjacency, zoneDiagnostics) {
    const adj = adjacency ?? buildAdjacencyGraph(model);
    const A_env = exteriorEnvelopeAreaM2(model, adj);
    const V_h = heatedVolumeM3(model, thermalRcModel);
    const compactness = calculateCompactness(A_env, V_h);
    const wwr = calculateWindowToWallRatio(totalWindowAreaM2(model), facadeAreaM2(adj));
    const uElements = collectExplicitUElements(model, adj);
    const outdoorLinkElements = collectOutdoorLinkElements(thermalRcModel);
    const equivalentElements = uElements.some((element) => element.U_W_m2K !== null) ? uElements : outdoorLinkElements;
    const equivalentUValue = calculateEquivalentUValue(equivalentElements);
    const bridges = resolveThermalBridgeConductances(model);
    const H_tr = derived.transmissionHeatLossCoefficient_W_K.value;
    const H_ve = (derived.infiltrationHeatLossCoefficient_W_K.value ?? 0) +
        (derived.ventilationHeatLossCoefficient_W_K.value ?? 0);
    const heatLossBreakdown = calculateTotalHeatLossCoefficient({
        H_tr,
        H_ve: Number.isFinite(H_ve) ? H_ve : null,
        H_psi: bridges.explicit ? bridges.H_psi : null,
        H_chi: bridges.explicit ? bridges.H_chi : null,
    });
    const dtHours = (performanceOptions.timestepSeconds ?? 3600) / 3600;
    const comfortMin = resolveComfortMinC(options, performanceOptions);
    const comfortMax = resolveComfortMaxC(performanceOptions);
    const zoneDegreeUnderheat = Object.values(thermalResult.rooms).map((room) => {
        const series = room.timeline.map((point) => ({ timeHours: point.timeHours, temperatureC: point.temperatureC }));
        return {
            zoneId: room.roomId,
            zoneName: model.rooms.find((entry) => entry.id === room.roomId)?.name ?? room.roomId,
            value: calculateDegreeHoursUnderheat(series, comfortMin.value, dtHours),
        };
    });
    const buildingUnderheatSeries = Object.values(thermalResult.rooms).flatMap((room) => room.timeline.map((point) => ({ timeHours: point.timeHours, temperatureC: point.temperatureC })));
    const degreeHoursUnderheat = {
        building: calculateDegreeHoursUnderheat(buildingUnderheatSeries, comfortMin.value, dtHours),
        zones: zoneDegreeUnderheat,
    };
    const zoneDegreeOverheat = Object.values(thermalResult.rooms).map((room) => {
        const series = room.timeline.map((point) => ({ timeHours: point.timeHours, temperatureC: point.temperatureC }));
        const metric = calculateDegreeHoursOverheat(series, comfortMax.value, dtHours);
        return {
            zoneId: room.roomId,
            zoneName: model.rooms.find((entry) => entry.id === room.roomId)?.name ?? room.roomId,
            value: {
                ...metric,
                warnings: [...metric.warnings, ...comfortMax.warnings],
            },
        };
    });
    const buildingOverheatSeries = buildingUnderheatSeries;
    const buildingOverheat = calculateDegreeHoursOverheat(buildingOverheatSeries, comfortMax.value, dtHours);
    const degreeHoursOverheat = {
        building: {
            ...buildingOverheat,
            warnings: [...buildingOverheat.warnings, ...comfortMax.warnings],
        },
        zones: zoneDegreeOverheat,
    };
    const T_out = thermalResult.timeline[0]?.outdoorTemperatureC ?? null;
    const operativeTemperature = {
        zones: Object.values(thermalResult.rooms).map((room) => {
            const latest = room.timeline[room.timeline.length - 1];
            const T_air = latest?.temperatureC ?? null;
            const fragmentSurfaces = (model.thermalProtection?.envelope ?? [])
                .filter((fragment) => fragment.areaM2 > 0)
                .map((fragment) => {
                const props = fragment.layers?.length
                    ? computeWallProperties(fragment.layers, undefined, { includeSp50AirFilms: true })
                    : null;
                const totalResistance = props?.rValue ?? null;
                const tau_si = totalResistance && totalResistance > 0 && T_air !== null && T_out !== null
                    ? internalSurfaceTemperatureC(T_air, T_out, 0.13, totalResistance)
                    : T_air;
                return { tau_si: tau_si ?? T_air ?? 0, areaM2: fragment.areaM2 };
            });
            const mrtEstimate = T_air !== null
                ? estimateMeanRadiantTemperatureC(fragmentSurfaces)
                : { T_mrt: null, approximate: false, warnings: ["T_mrt недоступна."] };
            const T_op = calculateOperativeTemperature(T_air, mrtEstimate.T_mrt, mrtEstimate.approximate);
            return {
                zoneId: room.roomId,
                zoneName: model.rooms.find((entry) => entry.id === room.roomId)?.name ?? room.roomId,
                T_op: {
                    ...T_op,
                    warnings: [...T_op.warnings, ...mrtEstimate.warnings],
                },
                T_air: derivedMetric(T_air, "°C", "solver"),
                T_mrt: derivedMetric(mrtEstimate.T_mrt, "°C", mrtEstimate.approximate ? "engineering-derived" : "solver", [], mrtEstimate.warnings),
            };
        }),
    };
    const peakT_in = zoneDiagnostics && zoneDiagnostics.length
        ? zoneDiagnostics.reduce((sum, zone) => sum + zone.temperatureC, 0) / zoneDiagnostics.length
        : Object.values(thermalResult.rooms)[0]?.timeline.at(-1)?.temperatureC ?? options.setpoints.day;
    const surfaceTemperatureFactor = buildSurfaceTemperatureDiagnostics(model, peakT_in, T_out ?? 0);
    const hydronicSupply = derived.hydronic?.supplyTemperatureC ?? null;
    const hydronicReturn = derived.hydronic?.returnTemperatureC ?? null;
    const pipeHeatLoss = {
        pipes: model.pipes.map((pipe) => {
            const { U_pipe, warnings: uWarnings } = derivePipeLinearU_W_mK(pipe);
            const { T_water, warnings: tWarnings } = resolvePipeWaterTemperature(pipe, hydronicSupply, hydronicReturn);
            const connectedRoomId = model.equipment.find((item) => pipe.connectedEquipmentIds.includes(item.id))?.roomId ?? null;
            const T_air = pipe.designIndoorTemperatureC ??
                (connectedRoomId
                    ? operativeTemperature.zones.find((zone) => zone.zoneId === connectedRoomId)?.T_air.value ?? null
                    : options.setpoints.day);
            const lengthM = polylineLengthM(pipe.path);
            const Q_loss = calculatePipeHeatLoss(U_pipe, lengthM, T_water, T_air, [...uWarnings, ...tWarnings]);
            const gain = connectedRoomId && Q_loss.value !== null
                ? derivedMetric(Math.max(0, Q_loss.value), "Вт", "engineering-derived", [
                    "Q_pipe_gain_to_room_W — теплоприток в помещение при прохождении трубы внутри.",
                ])
                : derivedMetric(null, "Вт", "engineering-derived", [], ["Труба не привязана к отапливаемому помещению."]);
            return {
                pipeId: pipe.id,
                label: `${pipe.type} ${pipe.id}`,
                roomId: connectedRoomId,
                Q_pipe_loss_W: Q_loss,
                Q_pipe_gain_to_room_W: gain,
            };
        }),
    };
    const energyKWh = performanceOptions.annualEnergyKWh ??
        thermalResult.summary.totalEnergyKWh;
    const energySource = performanceOptions.energySourceLabel ??
        (performanceOptions.annualEnergyKWh ? "annualEnergyKWh" : "totalEnergyKWh (период симуляции)");
    const co2 = calculateCO2(energyKWh ?? null, performanceOptions.emissionFactorKgPerKWh ?? null, energySource);
    const measuredSeries = performanceOptions.measuredSeries ??
        extractSensorValidationSeries(model, thermalResult, null).measured;
    const simulatedSeries = performanceOptions.simulatedSeries ??
        extractSensorValidationSeries(model, thermalResult, null).simulated;
    const validation = calculateValidationMetrics(measuredSeries, simulatedSeries);
    const dataRequirementsAudit = buildDataRequirementsAudit({
        model,
        thermalResult,
        thermalRcModel,
        options,
        derived,
        performanceOptions,
        adjacency: adj,
        zoneDiagnostics,
    });
    return {
        compactness,
        windowToWallRatio: wwr.ratio,
        windowToWallRatioPercent: wwr.percent,
        equivalentUValue,
        heatLossBreakdown,
        degreeHoursUnderheat,
        degreeHoursOverheat,
        operativeTemperature,
        surfaceTemperatureFactor,
        pipeHeatLoss,
        co2,
        validation,
        dataRequirementsAudit,
    };
}
