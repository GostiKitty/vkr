import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { Bar, CartesianGrid, ComposedChart, Label, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { MetricInfoTooltip } from "../../../shared/ui";
import { formatNumber } from "../../../shared/utils/format";
import { resultsMetricInfo } from "../resultsMetricInfo";
export function MonteCarloChart({ result, baselineEnergyKWh = null }) {
    const histogramData = useMemo(() => result.totalEnergy.histogram.map((bin) => ({
        mid: bin.mid,
        count: bin.count,
        label: `${formatNumber(bin.binStart, { maximumFractionDigits: 1 })}–${formatNumber(bin.binEnd, {
            maximumFractionDigits: 1,
        })} кВт·ч`,
    })), [result.totalEnergy.histogram]);
    const markers = useMemo(() => [
        { key: "p10", label: "P10", value: result.totalEnergy.p10, stroke: "var(--chart-line-muted)", dash: "4 4" },
        { key: "p50", label: "P50", value: result.totalEnergy.p50, stroke: "var(--accent-base)", dash: undefined },
        { key: "p90", label: "P90", value: result.totalEnergy.p90, stroke: "var(--warning-border)", dash: "8 4" },
        baselineEnergyKWh == null
            ? null
            : { key: "base", label: "База", value: baselineEnergyKWh, stroke: "var(--danger-border)", dash: "2 3" },
    ].filter((entry) => entry !== null), [baselineEnergyKWh, result.totalEnergy.p10, result.totalEnergy.p50, result.totalEnergy.p90]);
    return (_jsxs("section", { className: "ui-chart-shell", children: [_jsx("div", { className: "mb-3", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0420\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.monteCarloHistogram })] }) }), _jsx("div", { className: "ui-chart-shell__body rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3", children: _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(ComposedChart, { data: histogramData, margin: { top: 28, right: 16, bottom: 24, left: 4 }, children: [_jsx(CartesianGrid, { stroke: "var(--chart-grid)", strokeDasharray: "3 3" }), _jsx(XAxis, { type: "number", dataKey: "mid", tick: { fill: "var(--text-soft)", fontSize: 11 }, tickFormatter: (value) => formatNumber(Number(value), { maximumFractionDigits: 0 }), domain: ["dataMin", "dataMax"], children: _jsx(Label, { value: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F, \u043A\u0412\u0442\u00B7\u0447", position: "insideBottom", offset: -4, fill: "var(--text-soft)", fontSize: 11 }) }), _jsx(YAxis, { tick: { fill: "var(--text-soft)", fontSize: 11 }, allowDecimals: false, width: 56, children: _jsx(Label, { value: "\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0438, \u0448\u0442.", angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 } }) }), _jsx(Tooltip, { formatter: (value) => [`${formatNumber(value, { maximumFractionDigits: 0 })}`, "Сценарии"], labelFormatter: (_, payload) => payload?.[0]?.payload?.label ?? "", contentStyle: {
                                    background: "var(--surface-elevated)",
                                    border: "1px solid var(--border-soft)",
                                    borderRadius: 12,
                                    fontSize: 12,
                                } }), _jsx(Bar, { dataKey: "count", fill: "var(--accent-soft)", radius: [8, 8, 0, 0], barSize: 14, isAnimationActive: true, animationDuration: 780, animationEasing: "ease-out" }), markers.map((marker) => (_jsx(ReferenceLine, { x: marker.value, stroke: marker.stroke, strokeWidth: 2, strokeDasharray: marker.dash, ifOverflow: "extendDomain", label: {
                                    value: marker.label,
                                    position: "top",
                                    offset: 6,
                                    fill: marker.stroke,
                                    fontSize: 11,
                                } }, marker.key)))] }) }) }), _jsxs("div", { className: "mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(LegendChip, { label: "P10", value: `${formatNumber(result.totalEnergy.p10, { maximumFractionDigits: 1 })} кВт·ч`, borderClass: "border-[color:var(--border-soft)]" }), _jsx(LegendChip, { label: "P50", value: `${formatNumber(result.totalEnergy.p50, { maximumFractionDigits: 1 })} кВт·ч`, borderClass: "border-[color:var(--accent-base)]/35" }), _jsx(LegendChip, { label: "P90", value: `${formatNumber(result.totalEnergy.p90, { maximumFractionDigits: 1 })} кВт·ч`, borderClass: "border-[color:var(--warning-border)]" }), baselineEnergyKWh != null ? (_jsx(LegendChip, { label: "\u0411\u0430\u0437\u043E\u0432\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442", value: `${formatNumber(baselineEnergyKWh, { maximumFractionDigits: 1 })} кВт·ч`, borderClass: "border-[color:var(--danger-border)]" })) : null] })] }));
}
function LegendChip({ label, value, borderClass, }) {
    return (_jsxs("div", { className: `rounded-2xl border bg-[color:var(--surface-overlay)] px-3 py-2 text-[color:var(--text-muted)] ${borderClass}`, children: [_jsx("p", { className: "font-semibold text-[color:var(--text-base)]", children: label }), _jsx("p", { children: value })] }));
}
export default MonteCarloChart;
