import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { MetricInfoTooltip } from "../../../shared/ui";
import { resultsMetricInfo } from "../resultsMetricInfo";
import { LossCategoryLegend } from "./LossCategoryLegend";
import { ThermalChartTooltip } from "./ThermalChartTooltip";
import { formatChartPercent, LOSS_CATEGORY_COLORS, LOSS_CATEGORY_LABELS } from "./thermalChartTheme";
const ORDER = ["opaque", "window", "door", "infiltration", "ventilation"];
function LossShareTooltip({ active, payload }) {
    if (!active || !payload?.length) {
        return null;
    }
    const row = payload[0]?.payload;
    return (_jsx(ThermalChartTooltip, { active: true, payload: payload, title: `${row.name} · ${formatChartPercent(row.percent)}`, rows: [] }));
}
export function LossShareChart({ share }) {
    const segments = useMemo(() => ORDER.map((key) => ({
        key,
        name: LOSS_CATEGORY_LABELS[key],
        percent: share[key],
    })).filter((item) => Number.isFinite(item.percent) && item.percent > 0), [share]);
    if (!segments.length) {
        return (_jsxs("section", { className: "ui-chart-shell", children: [_jsx(ShareChartHeader, {}), _jsx("div", { className: "ui-loss-chart__empty", children: "\u0414\u043E\u043B\u0438 \u043F\u043E\u0442\u0435\u0440\u044C \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B \u0434\u043B\u044F \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430." })] }));
    }
    return (_jsxs("section", { className: "ui-chart-shell", "data-testid": "loss-share-chart", children: [_jsx(ShareChartHeader, {}), _jsx(LossCategoryLegend, { className: "mt-3", variant: "compact" }), _jsxs("div", { className: "ui-loss-share mt-4", children: [_jsx("div", { className: "ui-loss-share__donut", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { accessibilityLayer: true, children: [_jsx(Pie, { data: segments, dataKey: "percent", nameKey: "name", cx: "50%", cy: "50%", innerRadius: "58%", outerRadius: "88%", paddingAngle: 2, stroke: "var(--surface-elevated)", strokeWidth: 2, children: segments.map((segment) => (_jsx(Cell, { fill: LOSS_CATEGORY_COLORS[segment.key] }, segment.key))) }), _jsx(Tooltip, { content: _jsx(LossShareTooltip, {}) })] }) }) }), _jsx("ul", { className: "ui-loss-share__list", children: [...segments]
                            .sort((a, b) => b.percent - a.percent)
                            .map((segment) => (_jsxs("li", { className: "ui-loss-share__item", children: [_jsxs("div", { className: "ui-loss-share__item-head", children: [_jsxs("span", { className: "ui-loss-share__item-label", children: [_jsx("span", { className: "ui-loss-chart__swatch", style: { backgroundColor: LOSS_CATEGORY_COLORS[segment.key] }, "aria-hidden": true }), segment.name] }), _jsx("span", { className: "ui-loss-share__item-value", children: formatChartPercent(segment.percent) })] }), _jsx("div", { className: "ui-loss-share__item-track", "aria-hidden": true, children: _jsx("div", { className: "ui-loss-share__item-fill", style: {
                                            width: `${segment.percent}%`,
                                            backgroundColor: LOSS_CATEGORY_COLORS[segment.key],
                                        } }) })] }, segment.key))) })] })] }));
}
function ShareChartHeader() {
    return (_jsx("header", { className: "ui-loss-chart__head", children: _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u044C" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.lossShareBreakdown })] }), _jsx("p", { className: "mt-0.5 text-xs text-[color:var(--text-soft)]", children: "100% \u0432\u0441\u0435\u0445 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u044C \u0432 \u043F\u0438\u043A\u043E\u0432\u043E\u043C \u0441\u0440\u0435\u0437\u0435" })] }) }));
}
export default LossShareChart;
