import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from "react";
import { runThermalSimulation } from "../../../core/thermal/solver";
import { calibrateParameters } from "../../../core/calibration/calibrator";
import { formatNumber } from "../../../shared/utils/format";
import { Line, LineChart, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, XAxis, YAxis, } from "recharts";
import Tooltip from "../../../shared/ui/Tooltip";
const MONTH_LABELS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const PARAM_RANGES = {
    infiltrationMultiplier: { min: 0.4, max: 2.0 },
    internalGainMultiplier: { min: 0.5, max: 1.8 },
    setpointOffset: { min: -3, max: 3 },
};
export const THERMAL_CALIBRATION_HELP_TEXT = "Калибровка нужна, чтобы приблизить расчетную модель к реальному зданию. Если известны месячные данные по потреблению тепла или энергии, система может скорректировать инфильтрацию, внутренние теплопоступления и уставки отопления.";
export function ThermalCalibrationPanel({ model, adjacency, options }) {
    const [seriesText, setSeriesText] = useState("");
    const [observations, setObservations] = useState(null);
    const [calibration, setCalibration] = useState(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);
    const handleTextChange = (event) => {
        const value = event.target.value;
        setSeriesText(value);
        const parsed = parseNumbers(value);
        setObservations(parsed && parsed.length === 12 ? parsed : null);
    };
    const handleCalibrate = useCallback(async () => {
        if (!observations || observations.length !== 12) {
            setError("Нужно 12 чисел для каждого месяца.");
            return;
        }
        if (!model.rooms.length || !model.walls.length) {
            setError("Создайте геометрию, чтобы выполнить калибровку.");
            return;
        }
        setRunning(true);
        setError(null);
        try {
            const baseline = simulateMonthlySeries(model, adjacency, options, {
                infiltrationMultiplier: 1,
                internalGainMultiplier: 1,
                setpointOffset: 0,
            });
            const result = calibrateParameters({
                observations,
                iterations: 220,
                seed: 2403,
                parameters: [
                    { name: "infiltrationMultiplier", ...PARAM_RANGES.infiltrationMultiplier },
                    { name: "internalGainMultiplier", ...PARAM_RANGES.internalGainMultiplier },
                    { name: "setpointOffset", ...PARAM_RANGES.setpointOffset },
                ],
                model: (params) => simulateMonthlySeries(model, adjacency, options, {
                    infiltrationMultiplier: params.infiltrationMultiplier ?? 1,
                    internalGainMultiplier: params.internalGainMultiplier ?? 1,
                    setpointOffset: params.setpointOffset ?? 0,
                }),
            });
            const calibrated = simulateMonthlySeries(model, adjacency, options, {
                infiltrationMultiplier: result.bestParameters.infiltrationMultiplier ?? 1,
                internalGainMultiplier: result.bestParameters.internalGainMultiplier ?? 1,
                setpointOffset: result.bestParameters.setpointOffset ?? 0,
            });
            setCalibration({
                params: result.bestParameters,
                rmse: result.rmse,
                mape: result.mape,
                baseline,
                calibrated,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось выполнить калибровку.";
            setError(message);
        }
        finally {
            setRunning(false);
        }
    }, [adjacency, model, observations, options]);
    const chartData = useMemo(() => {
        if (!observations || !calibration) {
            return MONTH_LABELS.map((label, index) => ({
                month: label,
                observed: observations?.[index] ?? null,
            }));
        }
        return MONTH_LABELS.map((label, index) => ({
            month: label,
            observed: observations[index],
            baseline: calibration.baseline[index],
            calibrated: calibration.calibrated[index],
        }));
    }, [calibration, observations]);
    return (_jsxs("section", { className: "ui-panel space-y-4 p-4", children: [_jsxs("header", { className: "flex flex-col gap-1", children: [_jsx("p", { className: "ui-kicker", children: "\u041A\u0430\u043B\u0438\u0431\u0440\u043E\u0432\u043A\u0430" }), _jsx("h2", { className: "text-2xl font-semibold text-[color:var(--text-base)]", children: "\u041A\u0430\u043B\u0438\u0431\u0440\u043E\u0432\u043A\u0430 \u043C\u043E\u0434\u0435\u043B\u0438 \u043F\u043E \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u043C\u0443 \u043F\u043E\u0442\u0440\u0435\u0431\u043B\u0435\u043D\u0438\u044E" }), _jsx("p", { className: "text-sm text-[color:var(--text-soft)]", children: THERMAL_CALIBRATION_HELP_TEXT })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[320px,1fr]", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-muted)]", children: ["\u041C\u0435\u0441\u044F\u0447\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435, \u043A\u0412\u0442\u00B7\u0447", _jsx("textarea", { rows: 6, placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: 3200 2800 2500 ...", value: seriesText, onChange: handleTextChange, className: "ui-field mt-1 w-full px-3 py-2 text-sm" })] }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0440\u0430\u0437\u0434\u0435\u043B\u0438\u0442\u0435\u043B\u0438: \u043F\u0440\u043E\u0431\u0435\u043B, \u0437\u0430\u043F\u044F\u0442\u0430\u044F, \u043D\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430. \u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E \u0440\u043E\u0432\u043D\u043E 12 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439." }), _jsx(Tooltip, { className: "w-full", title: "\u041A\u0430\u043B\u0438\u0431\u0440\u043E\u0432\u043A\u0430 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432", description: "\u0418\u0449\u0435\u0442 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u0438 \u0438\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u0438, \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0442\u0435\u043F\u043B\u043E\u043F\u0440\u0438\u0442\u043E\u043A\u043E\u0432 \u0438 \u0441\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0441\u0435\u0442\u043F\u043E\u0438\u043D\u0442\u0430, \u043C\u0438\u043D\u0438\u043C\u0438\u0437\u0438\u0440\u0443\u044F RMSE/MAPE.", details: ["Ввод: энергопотребление за 12 месяцев (кВт·ч)", "Выход: RMSE, MAPE, новые множители"], linkedFormulaIds: ["calibration_rmse", "calibration_mape"], children: _jsx("button", { type: "button", onClick: handleCalibrate, disabled: !observations || running, className: `w-full rounded-2xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-muted)] ${!observations || running ? "ui-control cursor-not-allowed border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]" : "ui-control ui-control-active bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"}`, children: running ? "Подбираю..." : "Калибровать параметры" }) }), error && (_jsx("p", { className: "rounded-[16px] border border-red-200/80 bg-red-50/78 px-3 py-2.5 text-xs text-red-700", children: error })), calibration && (_jsxs("div", { className: "ui-panel-muted grid gap-2 p-3 text-sm text-[color:var(--text-muted)]", children: [_jsx(Stat, { label: "RMSE, \u043A\u0412\u0442\u00B7\u0447", value: formatNumber(calibration.rmse, { maximumFractionDigits: 1 }) }), _jsx(Stat, { label: "MAPE, %", value: formatNumber(calibration.mape, { maximumFractionDigits: 2 }) }), _jsx(Stat, { label: "\u0418\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044F \u00D7", value: formatNumber(calibration.params.infiltrationMultiplier, { maximumFractionDigits: 2 }) }), _jsx(Stat, { label: "\u0412\u043D\u0443\u0442\u0440. \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F \u00D7", value: formatNumber(calibration.params.internalGainMultiplier, { maximumFractionDigits: 2 }) }), _jsx(Stat, { label: "\u0421\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u0432\u043A\u0438, \u00B0C", value: formatNumber(calibration.params.setpointOffset, { maximumFractionDigits: 2 }) })] }))] }), _jsxs("div", { className: "ui-panel-muted p-4", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \u0441 \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u044F\u043C\u0438" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u0414\u043E \u0438 \u043F\u043E\u0441\u043B\u0435 \u043A\u0430\u043B\u0438\u0431\u0440\u043E\u0432\u043A\u0438" }), _jsxs("div", { className: "mt-3 h-[260px]", children: [_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: chartData, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "month", tick: { fontSize: 12, fill: "#475569" } }), _jsx(YAxis, { tick: { fontSize: 12, fill: "#475569" } }), _jsx(RechartsTooltip, { contentStyle: { fontSize: "12px" } }), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "observed", stroke: "#0f172a", strokeWidth: 2, dot: true }), calibration && (_jsxs(_Fragment, { children: [_jsx(Line, { type: "monotone", dataKey: "baseline", stroke: "#94a3b8", strokeWidth: 2, strokeDasharray: "6 4", dot: false }), _jsx(Line, { type: "monotone", dataKey: "calibrated", stroke: "#f97316", strokeWidth: 2, dot: false })] }))] }) }), !observations && (_jsx("p", { className: "mt-2 text-xs text-[color:var(--text-soft)]", children: "\u0412\u0441\u0442\u0430\u0432\u044C\u0442\u0435 12 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0433\u0440\u0430\u0444\u0438\u043A." }))] })] })] })] }));
}
const Stat = ({ label, value }) => (_jsxs("p", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: label }), _jsx("span", { className: "font-semibold text-[color:var(--text-base)]", children: value })] }));
function parseNumbers(input) {
    const tokens = input
        .split(/[\s,;]+/)
        .map((token) => token.trim())
        .filter(Boolean);
    if (!tokens.length) {
        return null;
    }
    const numbers = tokens.map((token) => Number(token));
    if (numbers.some((num) => Number.isNaN(num))) {
        return null;
    }
    return numbers;
}
function simulateMonthlySeries(model, adjacency, baseOptions, params) {
    const result = [];
    for (let month = 0; month < 12; month++) {
        const monthOptions = buildMonthlyOptions(baseOptions, month, params);
        const simulation = runThermalSimulation(model, monthOptions, adjacency);
        const durationDays = monthOptions.duration === "7d" ? 7 : 1;
        const dailyEnergy = simulation.summary.totalEnergyKWh / durationDays;
        result.push(dailyEnergy * DAYS_IN_MONTH[month]);
    }
    return result;
}
function buildMonthlyOptions(baseOptions, monthIndex, params) {
    const seasonAmplitude = Math.max(5, Math.abs(baseOptions.outdoor.seasonalOffsetC ?? 10));
    const monthPhase = ((monthIndex + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
    const monthlyShift = seasonAmplitude * Math.sin(monthPhase);
    return {
        ...baseOptions,
        outdoor: {
            ...baseOptions.outdoor,
            baseC: baseOptions.outdoor.baseC + monthlyShift,
            seasonalOffsetC: monthlyShift,
        },
        setpoints: {
            ...baseOptions.setpoints,
            day: baseOptions.setpoints.day + params.setpointOffset,
            night: baseOptions.setpoints.night + params.setpointOffset,
        },
        internalGains: {
            ...baseOptions.internalGains,
            dayGain_W_m2: Math.max(0, baseOptions.internalGains.dayGain_W_m2 * params.internalGainMultiplier),
            nightGain_W_m2: Math.max(0, baseOptions.internalGains.nightGain_W_m2 * params.internalGainMultiplier),
        },
        infiltrationACH: Math.max(0.05, (baseOptions.infiltrationACH ?? 0.5) * params.infiltrationMultiplier),
    };
}
export default ThermalCalibrationPanel;
