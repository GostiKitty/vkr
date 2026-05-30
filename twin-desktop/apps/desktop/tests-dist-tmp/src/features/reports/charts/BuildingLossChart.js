import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { MetricInfoTooltip } from "../../../shared/ui";
import { resultsMetricInfo } from "../resultsMetricInfo";
import { LossCategoryLegend } from "./LossCategoryLegend";
import { formatChartPercent, formatChartPower, LOSS_CATEGORY_COLORS, } from "./thermalChartTheme";
export function BuildingLossChart({ rows }) {
    const data = useMemo(() => [...rows].filter((row) => Number.isFinite(row.valueW) && row.valueW > 0).sort((a, b) => b.valueW - a.valueW), [rows]);
    const totalW = useMemo(() => data.reduce((sum, row) => sum + row.valueW, 0), [data]);
    const maxW = data[0]?.valueW ?? 0;
    if (!data.length) {
        return (_jsxs("section", { className: "ui-chart-shell", "data-testid": "building-loss-chart", children: [_jsx(ChartHeader, { totalW: null }), _jsx("div", { className: "ui-loss-chart__empty", children: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438 \u043F\u043E \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430\u043C \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B." })] }));
    }
    return (_jsxs("section", { className: "ui-chart-shell", "data-testid": "building-loss-chart", "aria-labelledby": "building-loss-title", children: [_jsx(ChartHeader, { totalW: totalW }), _jsx(LossCategoryLegend, { className: "mt-3", variant: "compact" }), _jsx("ol", { className: "ui-loss-chart__bars mt-4 space-y-3", "aria-describedby": "building-loss-desc", children: data.map((row, index) => {
                    const widthPct = maxW > 0 ? (row.valueW / maxW) * 100 : 0;
                    return (_jsxs("li", { className: "ui-loss-chart__row group", style: { animationDelay: `${index * 45}ms` }, children: [_jsxs("div", { className: "ui-loss-chart__row-head", children: [_jsxs("span", { className: "ui-loss-chart__row-label", children: [_jsx("span", { className: "ui-loss-chart__swatch", style: { backgroundColor: LOSS_CATEGORY_COLORS[row.key] }, "aria-hidden": true }), row.label] }), _jsxs("span", { className: "ui-loss-chart__row-values", children: [_jsx("span", { className: "ui-loss-chart__power", children: formatChartPower(row.valueW) }), _jsx("span", { className: "ui-loss-chart__share", children: formatChartPercent(row.share) })] })] }), _jsx("div", { className: "ui-loss-chart__track", role: "img", "aria-label": `${row.label}: ${formatChartPower(row.valueW)}, ${formatChartPercent(row.share)}`, children: _jsx("div", { className: "ui-loss-chart__fill", style: {
                                        width: `${widthPct}%`,
                                        backgroundColor: LOSS_CATEGORY_COLORS[row.key],
                                    } }) })] }, row.key));
                }) }), _jsx("p", { id: "building-loss-desc", className: "sr-only", children: "\u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438 \u0447\u0435\u0440\u0435\u0437 \u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F, \u043E\u043A\u043D\u0430, \u0434\u0432\u0435\u0440\u0438 \u0438 \u0438\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044E \u0432 \u0432\u0430\u0442\u0442\u0430\u0445." })] }));
}
function ChartHeader({ totalW }) {
    return (_jsxs("header", { className: "ui-loss-chart__head", children: [_jsx("div", { children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("h3", { id: "building-loss-title", className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438 \u043F\u043E \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u0430\u043C" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.buildingLossBreakdown })] }) }), totalW != null ? (_jsxs("div", { className: "ui-loss-chart__total", children: [_jsx("span", { className: "ui-loss-chart__total-label", children: "\u0421\u0443\u043C\u043C\u0430\u0440\u043D\u043E" }), _jsx("span", { className: "ui-loss-chart__total-value", children: formatChartPower(totalW) })] })) : null] }));
}
export default BuildingLossChart;
