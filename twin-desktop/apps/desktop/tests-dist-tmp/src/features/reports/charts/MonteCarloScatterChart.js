import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { CartesianGrid, Label, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, } from "recharts";
import { THERMAL_MONTE_CARLO_TARGET_METRICS, getThermalMonteCarloTargetMetricDefinition, getThermalMonteCarloTargetMetricValues, } from "../../../core/uncertainty/thermalMonteCarlo";
import { EmptyState, MetricInfoTooltip, SelectDropdown } from "../../../shared/ui";
import { formatNumber } from "../../../shared/utils/format";
const PARAMETER_OPTIONS = [
    { id: "infiltration", label: "Инфильтрация", unit: "1/ч" },
    { id: "outdoor", label: "Наружная температура", unit: "°C" },
    { id: "daySetpoint", label: "Дневная уставка", unit: "°C" },
    { id: "nightSetpoint", label: "Ночная уставка", unit: "°C" },
    { id: "internalGains", label: "Внутренние теплопоступления", unit: "Вт/м²" },
    { id: "occupancy", label: "Коэффициент занятости", unit: "×" },
];
export function MonteCarloScatterChart({ result, baseOptions, targetMetric, onTargetMetricChange, }) {
    const [parameter, setParameter] = useState("infiltration");
    const parameterOption = PARAMETER_OPTIONS.find((item) => item.id === parameter) ?? PARAMETER_OPTIONS[0];
    const targetMetricOption = getThermalMonteCarloTargetMetricDefinition(targetMetric);
    const targetMetricValues = useMemo(() => getThermalMonteCarloTargetMetricValues(result, targetMetric), [result, targetMetric]);
    const hasMetricData = useMemo(() => targetMetricValues.some((value) => Number.isFinite(value)), [targetMetricValues]);
    const data = useMemo(() => result.samples
        .map((sample, index) => ({
        x: resolveParameterValue(parameter, sample, baseOptions),
        y: targetMetricValues[index] ?? Number.NaN,
    }))
        .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y)), [baseOptions, parameter, result.samples, targetMetricValues]);
    return (_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between", children: [_jsx("div", { children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: `Точечная диаграмма: ${parameterOption.label} → ${targetMetricOption.shortLabel}` }), _jsx(MetricInfoTooltip, { title: "\u0422\u043E\u0447\u0435\u0447\u043D\u0430\u044F \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u0430 Monte Carlo", meaning: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442, \u043A\u0430\u043A \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0432\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0430 \u0441\u0432\u044F\u0437\u0430\u043D\u043E \u0441 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u043C\u0435\u0442\u0440\u0438\u043A\u043E\u0439 \u043F\u043E \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F\u043C.", formula: `(x_i, y_i) = (input_i, ${targetMetric})`, inputs: ["samples", targetMetricOption.tooltipSeriesKey], calculatedIn: `src/core/uncertainty/thermalMonteCarlo.ts → samples + ${targetMetricOption.tooltipSeriesKey}` })] }) }), _jsxs("div", { className: "grid w-full gap-3 md:grid-cols-2 md:min-w-[28rem]", children: [_jsx(SelectDropdown, { label: "\u0424\u0430\u043A\u0442\u043E\u0440", value: parameter, options: PARAMETER_OPTIONS.map((option) => ({ value: option.id, label: option.label })), onChange: setParameter }), _jsx(SelectDropdown, { label: "\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u043C\u0435\u0442\u0440\u0438\u043A\u0430", value: targetMetric, options: THERMAL_MONTE_CARLO_TARGET_METRICS.map((option) => ({ value: option.id, label: option.label })), onChange: onTargetMetricChange })] })] }), _jsx("div", { className: "h-80 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3", children: hasMetricData ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(ScatterChart, { margin: { top: 8, right: 16, bottom: 8, left: 8 }, children: [_jsx(CartesianGrid, { stroke: "var(--chart-grid)", strokeDasharray: "3 3" }), _jsx(XAxis, { type: "number", dataKey: "x", name: parameterOption.label, tick: { fill: "var(--text-soft)", fontSize: 11 }, tickFormatter: (value) => formatNumber(Number(value), { maximumFractionDigits: parameter === "infiltration" ? 2 : 1 }), children: _jsx(Label, { value: `${parameterOption.label}, ${parameterOption.unit}`, position: "insideBottom", offset: -4, fill: "var(--text-soft)", fontSize: 11 }) }), _jsx(YAxis, { type: "number", dataKey: "y", name: targetMetricOption.shortLabel, tick: { fill: "var(--text-soft)", fontSize: 11 }, tickFormatter: (value) => formatNumber(Number(value), { maximumFractionDigits: targetMetricOption.decimals }), width: 84, children: _jsx(Label, { value: targetMetricOption.axisLabel, angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 } }) }), _jsx(Tooltip, { cursor: { strokeDasharray: "4 4" }, formatter: (value, name) => {
                                    if (name === "x") {
                                        return [
                                            `${formatNumber(value, { maximumFractionDigits: parameter === "infiltration" ? 2 : 1 })} ${parameterOption.unit}`,
                                            parameterOption.label,
                                        ];
                                    }
                                    return [formatTargetMetricValue(value, targetMetricOption), targetMetricOption.shortLabel];
                                }, labelFormatter: () => "", contentStyle: {
                                    background: "var(--surface-elevated)",
                                    border: "1px solid var(--border-soft)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                } }), _jsx(Scatter, { data: data, fill: "var(--accent-base)", fillOpacity: 0.75 })] }) })) : (_jsx("div", { className: "flex h-full items-center", children: _jsx(EmptyState, { title: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F \u0433\u0440\u0430\u0444\u0438\u043A\u0430", message: targetMetricOption.emptyStateMessage, tone: "warning" }) })) })] }));
}
function resolveParameterValue(parameter, sample, baseOptions) {
    switch (parameter) {
        case "infiltration":
            return Math.max(0.02, (baseOptions.infiltrationACH ?? 0.5) * sample.infiltrationMultiplier);
        case "outdoor":
            return baseOptions.outdoor.baseC + sample.outdoorBiasC;
        case "daySetpoint":
            return baseOptions.setpoints.day + sample.setpointOffsetC;
        case "nightSetpoint":
            return baseOptions.setpoints.night + sample.setpointOffsetC;
        case "internalGains":
            return Math.max(0, baseOptions.internalGains.dayGain_W_m2 * sample.internalGainMultiplier);
        case "occupancy":
            return Math.max(0, (baseOptions.occupancy?.dayFraction ?? 1) * sample.occupancyMultiplier);
        default:
            return 0;
    }
}
function formatTargetMetricValue(value, targetMetricOption) {
    return `${formatNumber(value, { maximumFractionDigits: targetMetricOption.decimals })} ${targetMetricOption.unit}`;
}
export default MonteCarloScatterChart;
