import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { EmptyState, MetricInfoTooltip } from "../../../shared/ui";
import { formatEnergy, formatNumber } from "../../../shared/utils/format";
import { resultsMetricInfo } from "../resultsMetricInfo";
import { CHART_AXIS_TICK, CHART_MARGIN, CHART_TOOLTIP_STYLE } from "./thermalChartTheme";
const UNDERLAY_GRID_COLOR = "rgba(148, 163, 184, 0.16)";
const TEMPERATURE_LINE_COLOR = "#2563eb";
const SETPOINT_LINE_COLOR = "#64748b";
const HEATING_LINE_COLOR = "#c67b2f";
const IS_DEV = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toFiniteNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    }
    return null;
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function resolveHeatingBandAtTime(percentilesByTime, timeHours) {
    if (!percentilesByTime?.length || !Number.isFinite(timeHours)) {
        return { heatingBandBase: null, heatingBandWidth: null };
    }
    const first = percentilesByTime[0];
    const last = percentilesByTime[percentilesByTime.length - 1];
    if (timeHours <= first.timeHours) {
        return bandFromPercentilePoint(first);
    }
    if (timeHours >= last.timeHours) {
        return bandFromPercentilePoint(last);
    }
    let left = 0;
    let right = percentilesByTime.length - 1;
    while (left + 1 < right) {
        const mid = Math.floor((left + right) / 2);
        if (percentilesByTime[mid].timeHours <= timeHours) {
            left = mid;
        }
        else {
            right = mid;
        }
    }
    const start = percentilesByTime[left];
    const end = percentilesByTime[right];
    const spanHours = end.timeHours - start.timeHours;
    const fraction = spanHours > 0 ? (timeHours - start.timeHours) / spanHours : 0;
    const p10 = lerpNullable(start.p10, end.p10, fraction);
    const p90 = lerpNullable(start.p90, end.p90, fraction);
    if (!isFiniteNumber(p10) || !isFiniteNumber(p90)) {
        return { heatingBandBase: null, heatingBandWidth: null };
    }
    return { heatingBandBase: p10, heatingBandWidth: Math.max(0, p90 - p10) };
}
function bandFromPercentilePoint(point) {
    if (!Number.isFinite(point.p10) || !Number.isFinite(point.p90)) {
        return { heatingBandBase: null, heatingBandWidth: null };
    }
    return { heatingBandBase: point.p10, heatingBandWidth: Math.max(0, point.p90 - point.p10) };
}
/** Builds chart points from a room's own timeline (self-contained, no cross-index lookup). */
function buildChartPoints(result, roomId, monteCarloResult) {
    const roomData = result.rooms[roomId];
    if (!roomData) {
        return [];
    }
    const roomTimeline = roomData.timeline;
    if (!roomTimeline.length) {
        return [];
    }
    const percentilesByTime = monteCarloResult?.percentilesByTime;
    return roomTimeline.map((pt, index) => {
        // Primary source: room timeline (now includes setpointC from solver)
        const airTemperatureC = toFiniteNumber(pt.temperatureC);
        const heatingPowerW = toFiniteNumber(pt.heatingPowerW);
        // setpointC: prefer room timeline (added in solver fix), fall back to main frame
        let setpointC = toFiniteNumber(pt.setpointC);
        if (setpointC === null) {
            // Fallback: index-based lookup into result.timeline
            const frame = result.timeline[index];
            setpointC = toFiniteNumber(frame?.rooms?.[roomId]?.setpointC);
        }
        const heatingPowerKW = heatingPowerW !== null ? heatingPowerW / 1000 : null;
        const timeHours = toFiniteNumber(pt.timeHours) ?? index * (result.timeline[1]?.timeHours ?? 1);
        const { heatingBandBase, heatingBandWidth } = resolveHeatingBandAtTime(percentilesByTime, timeHours);
        return {
            timeHours,
            airTemperatureC,
            setpointC,
            heatingPowerKW,
            heatingPowerDisplayKW: heatingPowerKW,
            heatingBandBase,
            heatingBandWidth,
        };
    });
}
function resolveEquipmentCapacityKW(points, installedCapacityKW) {
    if (installedCapacityKW != null && installedCapacityKW > 0) {
        return installedCapacityKW;
    }
    const values = points.map((pt) => pt.heatingPowerKW).filter(isFiniteNumber);
    if (!values.length) {
        return 10;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1];
    return Math.max(0.5, p90 * 1.08);
}
function applyMovingAverageKW(values, windowSteps) {
    return values.map((_, index) => {
        const start = Math.max(0, index - windowSteps + 1);
        const slice = values.slice(start, index + 1).filter(isFiniteNumber);
        if (!slice.length) {
            return 0;
        }
        return slice.reduce((sum, value) => sum + value, 0) / slice.length;
    });
}
/** Ограничение мощности + сглаживание ~2 ч + ограничение скорости набора нагрузки. */
function applyEquipmentLikeDisplay(points, installedCapacityKW) {
    if (points.length < 2) {
        return points;
    }
    const capKW = resolveEquipmentCapacityKW(points, installedCapacityKW);
    const timestepHours = resolveTimestepHours(points);
    const windowSteps = Math.max(4, Math.min(18, Math.round(2 / Math.max(timestepHours, 1 / 12))));
    const maxRampKWPerStep = Math.max(0.08, capKW * Math.min(0.2, (0.12 * timestepHours) / 0.167));
    const capped = points.map((pt) => isFiniteNumber(pt.heatingPowerKW)
        ? { ...pt, heatingPowerDisplayKW: Math.min(pt.heatingPowerKW, capKW) }
        : { ...pt, heatingPowerDisplayKW: null });
    const averaged = applyMovingAverageKW(capped.map((pt) => pt.heatingPowerDisplayKW), windowSteps);
    let previous = null;
    return capped.map((pt, index) => {
        if (!isFiniteNumber(averaged[index])) {
            previous = null;
            return { ...pt, heatingPowerDisplayKW: null };
        }
        let next = Math.min(averaged[index], capKW);
        if (previous != null) {
            next = Math.max(previous - maxRampKWPerStep, Math.min(previous + maxRampKWPerStep, next));
        }
        previous = next;
        return { ...pt, heatingPowerDisplayKW: next };
    });
}
function enrichPlottedPoints(points, heatingDisplay, installedCapacityKW) {
    if (heatingDisplay !== "equipment" || points.length < 2) {
        return points;
    }
    return applyEquipmentLikeDisplay(points, installedCapacityKW);
}
/** RC timeline stores temperature at step start; for display use end-of-step (next point's start). */
function alignTemperatureToEndOfStep(points) {
    if (points.length < 2) {
        return points;
    }
    return points.map((pt, index) => {
        const next = points[index + 1];
        if (!next || !isFiniteNumber(next.airTemperatureC)) {
            return pt;
        }
        return { ...pt, airTemperatureC: next.airTemperatureC };
    });
}
function lerpNullable(a, b, fraction) {
    if (!isFiniteNumber(a) || !isFiniteNumber(b)) {
        return fraction < 0.5 ? a : b;
    }
    return a + fraction * (b - a);
}
/** Finer samples for chart only — smooths ramps without changing the RC solve. */
function densifyChartPoints(points, maxStepHours = 2 / 60) {
    if (points.length < 2) {
        return points;
    }
    const dense = [points[0]];
    for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const deltaHours = end.timeHours - start.timeHours;
        if (!Number.isFinite(deltaHours) || deltaHours <= 0) {
            dense.push(end);
            continue;
        }
        const segments = Math.max(1, Math.ceil(deltaHours / maxStepHours));
        for (let segment = 1; segment < segments; segment += 1) {
            const fraction = segment / segments;
            dense.push({
                timeHours: start.timeHours + fraction * deltaHours,
                airTemperatureC: lerpNullable(start.airTemperatureC, end.airTemperatureC, fraction),
                setpointC: lerpNullable(start.setpointC, end.setpointC, fraction),
                heatingPowerKW: lerpNullable(start.heatingPowerKW, end.heatingPowerKW, fraction),
                heatingPowerDisplayKW: lerpNullable(start.heatingPowerDisplayKW, end.heatingPowerDisplayKW, fraction),
                heatingBandBase: lerpNullable(start.heatingBandBase, end.heatingBandBase, fraction),
                heatingBandWidth: lerpNullable(start.heatingBandWidth, end.heatingBandWidth, fraction),
            });
        }
        dense.push(end);
    }
    return dense;
}
function prepareChartSeries(points) {
    return densifyChartPoints(alignTemperatureToEndOfStep(points));
}
/** Emits a dev-mode diagnostic log for the chart to help debug data issues. */
function devLogChartDiagnostics(roomId, roomLabel, data, result) {
    if (!IS_DEV) {
        return;
    }
    const availableRoomIds = result
        ? Object.entries(result.rooms)
            .filter(([, r]) => r.timeline.length > 0)
            .map(([id]) => id)
        : [];
    const tempPoints = data.filter((pt) => isFiniteNumber(pt.airTemperatureC));
    const heatingPoints = data.filter((pt) => isFiniteNumber(pt.heatingPowerKW));
    // eslint-disable-next-line no-console
    console.group("[ThermalTimeSeriesChart] dev diagnostics");
    // eslint-disable-next-line no-console
    console.log({
        selectedRoomId: roomId,
        selectedRoomName: roomLabel,
        matchedZoneId: roomId && result?.rooms[roomId] ? roomId : null,
        countTemperaturePoints: tempPoints.length,
        countHeatingPoints: heatingPoints.length,
        firstTemperaturePoint: tempPoints[0] ?? null,
        lastTemperaturePoint: tempPoints[tempPoints.length - 1] ?? null,
        availableRoomIdsWithTimeline: availableRoomIds,
    });
    if (tempPoints.length === 0) {
        // eslint-disable-next-line no-console
        console.warn("[ThermalTimeSeriesChart] ⚠ No finite airTemperatureC values found. " +
            "Check that result.rooms[roomId].timeline is populated and temperatureC is a finite number.");
    }
    if (data.every((pt) => pt.setpointC === null)) {
        // eslint-disable-next-line no-console
        console.warn("[ThermalTimeSeriesChart] ⚠ All setpointC values are null. " +
            "Ensure solver pushes setpointC in history.timeline.push, or result.timeline[i].rooms[roomId].setpointC exists.");
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
}
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ThermalTimeSeriesChart({ result, roomId, roomOptions, onSelectRoom, resultState = "current", simulationSource = "computed", onRunCalculation, heatingDisplay = "raw", installedCapacityKW = null, monteCarloResult = null, }) {
    const [mode, setMode] = useState("temperature");
    const selectedRoom = useMemo(() => roomOptions.find((room) => room.id === roomId) ?? null, [roomId, roomOptions]);
    const data = useMemo(() => {
        if (!result || !roomId) {
            return [];
        }
        const raw = buildChartPoints(result, roomId, monteCarloResult);
        const enriched = enrichPlottedPoints(raw, heatingDisplay, installedCapacityKW);
        return prepareChartSeries(enriched);
    }, [result, roomId, heatingDisplay, installedCapacityKW, monteCarloResult]);
    const minimumTempP10C = useMemo(() => {
        if (!monteCarloResult?.roomRiskSummary || !roomId)
            return null;
        const summary = monteCarloResult.roomRiskSummary.find((s) => s.roomId === roomId);
        return summary != null && Number.isFinite(summary.minimumTemperatureP10C)
            ? summary.minimumTemperatureP10C
            : null;
    }, [monteCarloResult, roomId]);
    const hasUncertaintyBand = useMemo(() => data.some((pt) => pt.heatingBandBase != null && pt.heatingBandWidth != null), [data]);
    const heatingIsEquipment = heatingDisplay === "equipment";
    // Emit dev diagnostics after data is computed
    useMemo(() => {
        devLogChartDiagnostics(roomId, selectedRoom?.label ?? null, data, result);
    }, [data, roomId, selectedRoom, result]);
    const stats = useMemo(() => {
        if (!result || !roomId || !result.rooms[roomId]) {
            return null;
        }
        const room = result.rooms[roomId];
        const temperatures = data
            .map((pt) => pt.airTemperatureC)
            .filter((v) => isFiniteNumber(v));
        const peakHeatingW = room.timeline.reduce((peak, pt) => (Number.isFinite(pt.heatingPowerW) ? Math.max(peak, pt.heatingPowerW) : peak), 0);
        const timestepHours = resolveTimestepHours(room.timeline);
        const heatingRuntimeHours = room.timeline.reduce((sum, pt) => sum + (Number.isFinite(pt.heatingPowerW) && pt.heatingPowerW > 1 ? timestepHours : 0), 0);
        return {
            averageTemperatureC: temperatures.length > 0 ? temperatures.reduce((s, v) => s + v, 0) / temperatures.length : null,
            peakHeatingKW: peakHeatingW / 1000,
            energyKWh: Number.isFinite(room.dailyEnergyKWh) ? room.dailyEnergyKWh : null,
            heatingRuntimeHours,
        };
    }, [result, roomId, data]);
    const periodLabel = useMemo(() => buildPeriodLabel(data), [data]);
    const peakExplanation = useMemo(() => buildPeakExplanation(data), [data]);
    const temperatureDomain = useMemo(() => {
        const values = data
            .flatMap((pt) => [pt.airTemperatureC, pt.setpointC])
            .filter(isFiniteNumber);
        if (!values.length) {
            return [18, 24];
        }
        const min = Math.min(...values);
        const max = Math.max(...values);
        // Ensure a minimum visible span of 2°C so lines don't collapse to an invisible dot
        const span = Math.max(max - min, 2);
        const margin = Math.max(0.6, span * 0.08);
        return [
            Math.floor((min - margin) * 2) / 2,
            Math.ceil((max + margin) * 2) / 2,
        ];
    }, [data]);
    const heatingDomain = useMemo(() => {
        const displayValues = data.map((pt) => pt.heatingPowerDisplayKW).filter(isFiniteNumber);
        const p90Values = data
            .map((pt) => (pt.heatingBandBase != null && pt.heatingBandWidth != null ? pt.heatingBandBase + pt.heatingBandWidth : null))
            .filter(isFiniteNumber);
        const allValues = [...displayValues, ...p90Values];
        const max = allValues.length ? Math.max(...allValues) : 1;
        return [0, Math.max(0.5, Math.ceil(max * 10) / 10)];
    }, [data]);
    const hasTemperatureSeries = useMemo(() => data.some((pt) => isFiniteNumber(pt.airTemperatureC) || isFiniteNumber(pt.setpointC)), [data]);
    const hasHeatingSeries = useMemo(() => data.some((pt) => isFiniteNumber(pt.heatingPowerDisplayKW)), [data]);
    // All three Lines are always rendered (hidden via the `hide` prop), so pass all data.
    // DO NOT filter by mode here — Recharts 2 does not traverse Fragments, so Lines must
    // be direct children and data must cover all series at once.
    const plottedData = data;
    // ---------------------------------------------------------------------------
    // Guard renders
    // ---------------------------------------------------------------------------
    if (resultState === "stale") {
        return (_jsx(ChartState, { title: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u0438", message: "\u0413\u0440\u0430\u0444\u0438\u043A \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u043A \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u043C\u043E\u0434\u0435\u043B\u0438. \u041C\u043E\u0434\u0435\u043B\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0433\u043E \u0440\u0430\u0441\u0447\u0451\u0442\u0430.", buttonLabel: "\u041F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u043F\u043E \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043C\u043E\u0434\u0435\u043B\u0438", onClick: onRunCalculation }));
    }
    if (simulationSource === "demo" && !result) {
        return (_jsx(ChartState, { title: "\u041D\u0435\u0442 \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u044B\u0445 \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445", message: "\u0414\u043B\u044F \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043C\u043E\u0434\u0435\u043B\u0438 \u043D\u0435\u0442 RC-\u0440\u044F\u0434\u0430. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0432 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0435 \u0438\u043B\u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442.", buttonLabel: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442", onClick: onRunCalculation }));
    }
    if (!result) {
        return (_jsx(ChartState, { title: "\u041D\u0435\u0442 \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445", message: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0434\u0438\u043D\u0430\u043C\u0438\u043A\u0443 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0438 \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u0438.", buttonLabel: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442", onClick: onRunCalculation }));
    }
    if (!roomOptions.length) {
        return (_jsx(ChartState, { title: "\u041D\u0435\u0442 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043C\u043E\u0434\u0435\u043B\u0438", message: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0432 \u043C\u043E\u0434\u0435\u043B\u0438, \u0437\u0430\u0442\u0435\u043C \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442.", buttonLabel: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442", onClick: onRunCalculation }));
    }
    if (!roomId || !selectedRoom) {
        return (_jsxs("section", { className: "ui-chart-shell", children: [_jsx(ChartHeader, { roomId: roomId, roomOptions: roomOptions, onSelectRoom: onSelectRoom, periodLabel: periodLabel }), _jsx("div", { className: "mt-4 rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-5", children: _jsx(EmptyState, { title: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435", message: "\u0413\u0440\u0430\u0444\u0438\u043A \u0441\u0442\u0440\u043E\u0438\u0442\u0441\u044F \u0434\u043B\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043C\u043E\u0434\u0435\u043B\u0438." }) })] }));
    }
    // No data at all for any room
    if (!roomId || !data.length) {
        return (_jsxs("section", { className: "ui-chart-shell", children: [_jsx(ChartHeader, { roomId: roomId, roomOptions: roomOptions, onSelectRoom: onSelectRoom, periodLabel: null }), _jsx("div", { className: "mt-4 rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-5", children: _jsx(EmptyState, { title: "\u041D\u0435\u0442 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0433\u043E \u0440\u044F\u0434\u0430", message: "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0437\u0430\u043F\u0443\u0441\u043A RC-\u0440\u0430\u0441\u0447\u0451\u0442\u0430. \u0414\u0430\u043D\u043D\u044B\u0435 timeline \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B \u043D\u0438 \u0434\u043B\u044F \u043E\u0434\u043D\u043E\u0433\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F." }) })] }));
    }
    // Mode-specific empty guard
    if ((mode === "temperature" && (!hasTemperatureSeries || !data.length)) ||
        (mode === "heating" && (!hasHeatingSeries || !data.length))) {
        return (_jsxs("section", { className: "ui-chart-shell", children: [_jsx(ChartHeader, { roomId: roomId, roomOptions: roomOptions, onSelectRoom: onSelectRoom, periodLabel: periodLabel }), _jsx("div", { className: "mt-4 rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-5", children: _jsx(EmptyState, { title: mode === "temperature"
                            ? "Нет температурного временного ряда"
                            : "Нет данных мощности отопления", message: mode === "temperature"
                            ? "Для выбранного помещения отсутствуют данные температуры воздуха и уставки в RC timeline. Проверьте запуск RC-расчёта."
                            : "Для выбранного помещения отсутствуют данные мощности отопления." }) })] }));
    }
    // ---------------------------------------------------------------------------
    // Normal render
    // ---------------------------------------------------------------------------
    const roomLabel = selectedRoom?.label ?? roomId;
    return (_jsxs("section", { className: "ui-chart-shell", children: [_jsx(ChartHeader, { roomId: roomId, roomOptions: roomOptions, onSelectRoom: onSelectRoom, periodLabel: periodLabel }), _jsxs("div", { className: "mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(MetricPill, { label: "\u0421\u0440\u0435\u0434\u043D\u044F\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430", value: formatTemperatureValue(stats?.averageTemperatureC ?? null) }), _jsx(MetricPill, { label: "\u041F\u0438\u043A\u043E\u0432\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C", value: formatPowerValue(stats?.peakHeatingKW ?? null) }), _jsx(MetricPill, { label: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0440\u0435\u0431\u043B\u0435\u043D\u0438\u0435", value: formatEnergy(stats?.energyKWh ?? null, "кВт·ч") }), _jsx(MetricPill, { label: "\u0412\u0440\u0435\u043C\u044F \u0440\u0430\u0431\u043E\u0442\u044B \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F", value: stats == null ? "—" : `${formatNumber(stats.heatingRuntimeHours, { maximumFractionDigits: 1 })} ч` })] }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => setMode("temperature"), className: mode === "temperature" ? "ui-btn-primary px-3 py-1.5 text-xs" : "ui-btn-secondary px-3 py-1.5 text-xs", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430" }), _jsx("button", { type: "button", onClick: () => setMode("heating"), className: mode === "heating" ? "ui-btn-primary px-3 py-1.5 text-xs" : "ui-btn-secondary px-3 py-1.5 text-xs", children: "\u041E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u0435" })] }), _jsx("div", { className: "mt-3 flex flex-wrap items-center gap-3 text-xs text-[color:var(--text-muted)]", children: mode === "temperature" ? (_jsxs(_Fragment, { children: [_jsx(LegendSwatch, { color: TEMPERATURE_LINE_COLOR, label: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432\u043E\u0437\u0434\u0443\u0445\u0430, \u00B0C" }), _jsx(LegendSwatch, { color: SETPOINT_LINE_COLOR, dashed: true, label: "\u0423\u0441\u0442\u0430\u0432\u043A\u0430, \u00B0C" }), minimumTempP10C != null ? (_jsx(LegendSwatch, { color: "#ef4444", dashed: true, label: "\u041C\u0438\u043D\u0438\u043C\u0443\u043C P10 (\u041C\u041A)" })) : null] })) : (_jsxs(_Fragment, { children: [_jsx(LegendSwatch, { color: HEATING_LINE_COLOR, label: heatingIsEquipment ? "Нагрузка (огранич. источник), кВт" : "Тепловая нагрузка, кВт" }), hasUncertaintyBand ? (_jsx(LegendSwatch, { color: HEATING_LINE_COLOR, band: true, label: "\u0414\u0438\u0430\u043F\u0430\u0437\u043E\u043D P10\u2013P90 (\u041C\u041A)" })) : null] })) }), _jsx("div", { className: "ui-chart-shell__body mt-3 h-[min(320px,42vh)] w-full min-w-0", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(ComposedChart, { data: plottedData, margin: CHART_MARGIN, accessibilityLayer: true, children: [_jsx(CartesianGrid, { stroke: UNDERLAY_GRID_COLOR, strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { dataKey: "timeHours", tick: CHART_AXIS_TICK, tickFormatter: (value) => formatTimeAxisTick(Number(value), data[data.length - 1]?.timeHours ?? 24), ticks: buildTimeTicks(data[data.length - 1]?.timeHours ?? 24), minTickGap: 12 }), mode === "temperature" ? (_jsx(YAxis, { domain: temperatureDomain, tick: CHART_AXIS_TICK, tickFormatter: (value) => `${formatNumber(Number(value), { maximumFractionDigits: 0 })}`, width: 44, label: {
                                    value: "°C",
                                    angle: -90,
                                    position: "insideLeft",
                                    style: { fill: "var(--text-soft)", fontSize: 11, textAnchor: "middle" },
                                } })) : (_jsx(YAxis, { domain: heatingDomain, tick: CHART_AXIS_TICK, tickFormatter: (value) => formatNumber(Number(value), { maximumFractionDigits: 1 }), width: 52, label: {
                                    value: "кВт",
                                    angle: -90,
                                    position: "insideLeft",
                                    style: { fill: "var(--text-soft)", fontSize: 11, textAnchor: "middle" },
                                } })), _jsx(Tooltip, { contentStyle: CHART_TOOLTIP_STYLE, labelFormatter: (label) => `Время: ${formatTooltipTime(Number(label))}`, formatter: (value, name) => {
                                    // Always hide internal band series
                                    if (name === "__band_base" || name === "__band_width") {
                                        return null;
                                    }
                                    // In heating mode hide temperature entries; in temperature mode hide heating entry
                                    if (mode === "heating" && (name === "Температура воздуха, °C" || name === "Уставка, °C")) {
                                        return null;
                                    }
                                    if (mode === "temperature" &&
                                        (name === "Тепловая нагрузка, кВт" || name === "Нагрузка (огранич. источник), кВт")) {
                                        return null;
                                    }
                                    if (name === "Температура воздуха, °C" || name === "Уставка, °C") {
                                        return [`${formatNumber(value, { maximumFractionDigits: 1 })} °C`, name];
                                    }
                                    const heatingLabel = heatingIsEquipment ? "источник" : "нагрузка";
                                    return [`${formatNumber(value, { maximumFractionDigits: 2 })} кВт (${heatingLabel})`, name];
                                } }), _jsx(Area, { type: "monotone", dataKey: "heatingBandBase", name: "__band_base", stackId: "mc-band", fill: "transparent", stroke: "none", legendType: "none", hide: mode !== "heating" || !hasUncertaintyBand }), _jsx(Area, { type: "monotone", dataKey: "heatingBandWidth", name: "__band_width", stackId: "mc-band", fill: HEATING_LINE_COLOR, fillOpacity: 0.18, stroke: "none", legendType: "none", hide: mode !== "heating" || !hasUncertaintyBand }), _jsx(Line, { type: "monotone", dataKey: "airTemperatureC", name: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432\u043E\u0437\u0434\u0443\u0445\u0430, \u00B0C", stroke: TEMPERATURE_LINE_COLOR, strokeWidth: 2.2, dot: data.length <= 2 ? { r: 2.5 } : false, activeDot: { r: 3 }, connectNulls: true, hide: mode !== "temperature" }), _jsx(Line, { type: "monotone", dataKey: "setpointC", name: "\u0423\u0441\u0442\u0430\u0432\u043A\u0430, \u00B0C", stroke: SETPOINT_LINE_COLOR, strokeDasharray: "5 4", strokeWidth: 1.6, dot: data.length <= 2 ? { r: 2 } : false, activeDot: { r: 2 }, connectNulls: true, hide: mode !== "temperature" }), _jsx(Line, { type: "monotone", dataKey: "heatingPowerDisplayKW", name: heatingIsEquipment ? "Нагрузка (огранич. источник), кВт" : "Тепловая нагрузка, кВт", stroke: HEATING_LINE_COLOR, strokeWidth: 2.2, dot: data.length <= 2 ? { r: 2.5 } : false, activeDot: { r: 3 }, connectNulls: true, hide: mode !== "heating" }), mode === "temperature" && minimumTempP10C != null ? (_jsx(ReferenceLine, { y: minimumTempP10C, stroke: "#ef4444", strokeDasharray: "4 3", strokeWidth: 1.5, label: {
                                    value: `P10 мин. ${formatNumber(minimumTempP10C, { maximumFractionDigits: 1 })}°C`,
                                    position: "insideBottomLeft",
                                    fontSize: 10,
                                    fill: "#ef4444",
                                } })) : null] }) }) }), peakExplanation ? (_jsx("div", { className: "mt-3 text-sm text-[color:var(--text-muted)]", children: _jsx("p", { children: peakExplanation }) })) : null] }));
}
// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ChartHeader({ roomId, roomOptions, onSelectRoom, periodLabel, }) {
    return (_jsxs("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-base font-semibold text-[color:var(--text-base)]", children: "\u0414\u0438\u043D\u0430\u043C\u0438\u043A\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0438 \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.rcBalance })] }), periodLabel ? _jsxs("p", { className: "mt-1 text-xs text-[color:var(--text-soft)]", children: ["\u0420\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434: ", periodLabel, "."] }) : null] }), _jsxs("label", { className: "block w-full lg:max-w-xs", children: [_jsx("span", { className: "mb-1 block text-sm font-semibold text-[color:var(--text-base)]", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsxs("select", { value: roomId ?? "", onChange: (event) => onSelectRoom?.(event.target.value || null), className: "ui-field w-full px-3 py-2 text-sm shadow-inner", children: [_jsx("option", { value: "", children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), roomOptions.map((room) => (_jsx("option", { value: room.id, children: room.label }, room.id)))] })] })] }));
}
function ChartState({ title, message, buttonLabel, onClick, }) {
    return (_jsxs("section", { className: "ui-chart-shell", children: [_jsx(EmptyState, { title: title, message: message }), buttonLabel && onClick ? (_jsx("div", { className: "mt-4", children: _jsx("button", { type: "button", onClick: onClick, className: "ui-btn-primary px-4 py-2 text-sm", children: buttonLabel }) })) : null] }));
}
function MetricPill({ label, value }) {
    return (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: label }), _jsx("p", { className: "mt-1 text-base font-semibold text-[color:var(--text-base)]", children: value })] }));
}
function LegendSwatch({ color, label, dashed = false, band = false, }) {
    return (_jsxs("span", { className: "inline-flex items-center gap-2", children: [band ? (_jsx("span", { className: "h-3 w-6 rounded-sm opacity-50", style: { backgroundColor: color } })) : (_jsx("span", { className: "h-[2px] w-6", style: {
                    backgroundImage: dashed
                        ? `repeating-linear-gradient(to right, ${color}, ${color} 6px, transparent 6px, transparent 10px)`
                        : "none",
                    backgroundColor: dashed ? "transparent" : color,
                } })), _jsx("span", { children: label })] }));
}
// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
function resolveTimestepHours(points) {
    if (points.length < 2) {
        return 0;
    }
    const delta = points[1].timeHours - points[0].timeHours;
    return Number.isFinite(delta) && delta > 0 ? delta : 0;
}
function buildPeriodLabel(data) {
    if (!data.length) {
        return null;
    }
    const maxTime = data[data.length - 1]?.timeHours ?? 0;
    if (!Number.isFinite(maxTime) || maxTime <= 0) {
        return null;
    }
    if (maxTime <= 24.01) {
        return `${formatNumber(maxTime, { maximumFractionDigits: 0 })} ч`;
    }
    const days = maxTime / 24;
    return `${formatNumber(days, { maximumFractionDigits: 0 })} суток`;
}
function buildPeakExplanation(data) {
    const peakIndex = data.reduce((maxIndex, pt, index, items) => {
        const current = pt.heatingPowerKW ?? -Infinity;
        const maxValue = items[maxIndex]?.heatingPowerKW ?? -Infinity;
        return current > maxValue ? index : maxIndex;
    }, 0);
    if (!data.length || peakIndex <= 0) {
        return null;
    }
    const current = data[peakIndex];
    const previous = data[peakIndex - 1];
    if (!isFiniteNumber(current.heatingPowerKW) || current.heatingPowerKW <= 0) {
        return null;
    }
    const setpointStep = (current.setpointC ?? 0) - (previous.setpointC ?? 0);
    if (setpointStep >= 0.4) {
        return "Пик мощности связан с восстановлением температуры до новой уставки.";
    }
    return null;
}
function buildTimeTicks(maxTime) {
    if (!Number.isFinite(maxTime) || maxTime <= 0) {
        return [0, 4, 8, 12, 16, 20, 24];
    }
    if (maxTime <= 24.01) {
        return [0, 4, 8, 12, 16, 20, 24].filter((tick) => tick <= maxTime + 0.01);
    }
    const step = maxTime <= 48 ? 8 : 24;
    const ticks = [];
    for (let value = 0; value <= maxTime + 0.01; value += step) {
        ticks.push(Number(value.toFixed(2)));
    }
    return ticks;
}
function formatTimeAxisTick(value, maxTime) {
    if (!Number.isFinite(value)) {
        return "—";
    }
    if (maxTime <= 24.01) {
        return `${Math.round(value)}`;
    }
    const day = Math.floor(value / 24) + 1;
    const hour = Math.round(value % 24);
    return `Д${day} ${hour}`;
}
function formatTooltipTime(value) {
    if (!Number.isFinite(value)) {
        return "—";
    }
    const totalMinutes = Math.round(value * 60);
    const day = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    if (day > 0) {
        return `день ${day + 1}, ${hours}:${String(minutes).padStart(2, "0")}`;
    }
    return `${hours}:${String(minutes).padStart(2, "0")}`;
}
function formatTemperatureValue(value) {
    return value == null ? "—" : `${formatNumber(value, { maximumFractionDigits: 1 })} °C`;
}
function formatPowerValue(value) {
    return value == null ? "—" : `${formatNumber(value, { maximumFractionDigits: 2 })} кВт`;
}
export default ThermalTimeSeriesChart;
