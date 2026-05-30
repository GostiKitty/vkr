import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LossCategoryLegend } from "./LossCategoryLegend";
import { ThermalChartTooltip } from "./ThermalChartTooltip";
import { CHART_AXIS_TICK, CHART_MARGIN_VERTICAL, formatChartAxisPower, formatChartPower, LOSS_CATEGORY_COLORS, LOSS_CATEGORY_LABELS, } from "./thermalChartTheme";
const LOSS_FIELDS = [
    { key: "lossOpaqueW", label: LOSS_CATEGORY_LABELS.opaque },
    { key: "lossWindowW", label: LOSS_CATEGORY_LABELS.window },
    { key: "lossDoorW", label: LOSS_CATEGORY_LABELS.door },
    { key: "lossInfiltrationW", label: LOSS_CATEGORY_LABELS.infiltration },
    { key: "lossMechanicalVentilationW", label: LOSS_CATEGORY_LABELS.ventilation },
];
function RoomLossTooltip({ active, payload }) {
    if (!active || !payload?.length) {
        return null;
    }
    const row = payload[0]?.payload;
    const breakdown = LOSS_FIELDS.filter((field) => Number.isFinite(row[field.key]) && row[field.key] > 0).map((field) => ({
        label: field.label,
        value: formatChartPower(row[field.key]),
    }));
    return (_jsx(ThermalChartTooltip, { active: true, payload: payload, title: row.zoneName, rows: [
            ...breakdown,
            { label: "Суммарно", value: formatChartPower(row.lossTotalW) },
            ...(row.statusNote ? [{ label: "Статус", value: row.statusNote }] : []),
        ] }));
}
export function RoomLossStackedChart({ rows, selectedRoomId, onSelectRoom }) {
    const data = useMemo(() => rows.slice(0, 12).map((row) => ({
        ...row,
        lossOpaqueW: row.lossOpaqueW ?? 0,
        lossWindowW: row.lossWindowW ?? 0,
        lossDoorW: row.lossDoorW ?? 0,
        lossInfiltrationW: row.lossInfiltrationW ?? 0,
        lossMechanicalVentilationW: row.lossMechanicalVentilationW ?? 0,
    })), [rows]);
    if (!data.length) {
        return (_jsx("div", { className: "flex h-48 items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 text-center text-sm text-[color:var(--text-soft)]", children: "\u041D\u0435\u0442 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439 \u0441 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u043C \u0440\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u0438\u0435\u043C \u043F\u043E\u0442\u0435\u0440\u044C." }));
    }
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(LossCategoryLegend, {}), _jsx("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-2", children: _jsx("div", { className: "h-[min(420px,55vh)] min-h-[280px]", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: data, layout: "vertical", margin: CHART_MARGIN_VERTICAL, accessibilityLayer: true, onClick: (state) => {
                                const zoneId = state?.activePayload?.[0]?.payload?.zoneId;
                                if (typeof zoneId === "string") {
                                    onSelectRoom(zoneId);
                                }
                            }, children: [_jsx(CartesianGrid, { stroke: "var(--chart-grid)", strokeDasharray: "3 3", horizontal: false }), _jsx(XAxis, { type: "number", tick: CHART_AXIS_TICK, tickFormatter: formatChartAxisPower }), _jsx(YAxis, { dataKey: "zoneName", type: "category", width: 180, tick: CHART_AXIS_TICK }), _jsx(Tooltip, { content: _jsx(RoomLossTooltip, {}), cursor: { fill: "var(--accent-muted)", fillOpacity: 0.1 } }), _jsx(Legend, { wrapperStyle: { fontSize: 11, paddingTop: 8 } }), _jsx(Bar, { dataKey: "lossOpaqueW", name: "\u041E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F", stackId: "loss", fill: LOSS_CATEGORY_COLORS.opaque }), _jsx(Bar, { dataKey: "lossWindowW", name: "\u041E\u043A\u043D\u0430", stackId: "loss", fill: LOSS_CATEGORY_COLORS.window }), _jsx(Bar, { dataKey: "lossDoorW", name: "\u0414\u0432\u0435\u0440\u0438", stackId: "loss", fill: LOSS_CATEGORY_COLORS.door }), _jsx(Bar, { dataKey: "lossInfiltrationW", name: "\u0418\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044F", stackId: "loss", fill: LOSS_CATEGORY_COLORS.infiltration }), _jsx(Bar, { dataKey: "lossMechanicalVentilationW", name: "\u0412\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u044F", stackId: "loss", fill: LOSS_CATEGORY_COLORS.ventilation })] }) }) }) })] }));
}
