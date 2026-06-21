import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, } from "recharts";
import { ThermalChartTooltip } from "./ThermalChartTooltip";
import { CHART_AXIS_TICK, CHART_MARGIN, clampChart, formatChartAxisPower, formatChartPower, formatChartTemperature, LOSS_CATEGORY_COLORS, } from "./thermalChartTheme";
function RoomScatterTooltip({ active, payload }) {
    if (!active || !payload?.length) {
        return null;
    }
    const row = payload[0]?.payload;
    return (_jsx(ThermalChartTooltip, { active: true, payload: payload, title: row.zoneName, rows: [
            { label: "Температура", value: formatChartTemperature(row.temperatureC) },
            { label: "Требуемая мощность", value: formatChartPower(row.heatingPowerW) },
            { label: "Суммарные потери", value: formatChartPower(row.lossTotalW) },
            ...(row.infiltrationShareOfTotalPct != null
                ? [{ label: "Доля инфильтрации в теплопотерях", value: `${row.infiltrationShareOfTotalPct.toFixed(1)} %` }]
                : []),
            ...(row.infiltrationShareOfAirExchangePct != null
                ? [{ label: "Доля инфильтрации в воздухообмене", value: `${row.infiltrationShareOfAirExchangePct.toFixed(1)} %` }]
                : []),
        ] }));
}
const SCATTER_LEGEND = [
    { id: "normal", label: "Норма", color: "var(--chart-line)" },
    { id: "attention", label: "Внимание", color: "var(--warning-border)" },
    { id: "risk", label: "Риск", color: LOSS_CATEGORY_COLORS.infiltration },
    { id: "infiltration", label: "Инф. > 80%", color: "#ea580c" },
    { id: "selected", label: "Выбрано", color: "var(--accent-base)" },
];
function classifyPoint(row, selectedRoomId) {
    if (selectedRoomId === row.zoneId)
        return "selected";
    if (row.status === "risk")
        return "risk";
    if (row.infiltrationShareOfTotalPct != null && row.infiltrationShareOfTotalPct > 80)
        return "infiltration";
    if (row.status === "attention")
        return "attention";
    return "normal";
}
function pointColors(kind) {
    switch (kind) {
        case "selected":
            return { fill: "var(--accent-base)", stroke: "var(--text-base)" };
        case "risk":
            return { fill: LOSS_CATEGORY_COLORS.infiltration, stroke: "rgba(220, 38, 38, 0.45)" };
        case "infiltration":
            return { fill: "#ea580c", stroke: "rgba(234, 88, 12, 0.45)" };
        case "attention":
            return { fill: "var(--warning-border)", stroke: "rgba(202, 138, 4, 0.4)" };
        default:
            return { fill: "var(--chart-line)", stroke: "rgba(61, 130, 250, 0.35)" };
    }
}
export function RoomScatterPlot({ rows, setpointC, selectedRoomId, onSelectRoom }) {
    const data = useMemo(() => rows
        .filter((row) => Number.isFinite(row.temperatureC) && Number.isFinite(row.heatingPowerW))
        .map((row) => {
        const anomalyKind = classifyPoint(row, selectedRoomId);
        const colors = pointColors(anomalyKind);
        return {
            ...row,
            temperatureC: row.temperatureC,
            heatingPowerW: row.heatingPowerW,
            bubbleSize: clampChart(row.lossTotalW / 60, 48, 320),
            anomalyKind,
            fill: colors.fill,
            stroke: colors.stroke,
            strokeWidth: anomalyKind === "selected" ? 2.5 : 1.5,
        };
    }), [rows, selectedRoomId]);
    const activeKinds = useMemo(() => new Set(data.map((row) => row.anomalyKind)), [data]);
    if (data.length < 2) {
        return (_jsxs("section", { className: "ui-chart-shell", children: [_jsx(ScatterHeader, {}), _jsx("div", { className: "ui-loss-chart__empty", children: "\u0414\u043B\u044F \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u044B \u0440\u0430\u0441\u0441\u0435\u044F\u043D\u0438\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0442\u043E\u0447\u0435\u043A \u0441 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043E\u0439 \u0438 \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C\u044E." })] }));
    }
    const setpoint = Number.isFinite(setpointC) ? setpointC : null;
    return (_jsxs("section", { className: "ui-chart-shell", "data-testid": "room-scatter-plot", children: [_jsx(ScatterHeader, {}), _jsx("div", { className: "ui-scatter__legend mt-3", children: SCATTER_LEGEND.filter((item) => activeKinds.has(item.id)).map((item) => (_jsxs("span", { className: "ui-scatter__legend-item", children: [_jsx("span", { className: "ui-scatter__legend-dot", style: { backgroundColor: item.color }, "aria-hidden": true }), item.label] }, item.id))) }), _jsx("div", { className: "ui-scatter__chart mt-4", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(ScatterChart, { margin: { ...CHART_MARGIN, top: 16, right: 20, bottom: 12 }, onClick: (state) => {
                            const zoneId = state?.activePayload?.[0]?.payload?.zoneId;
                            if (typeof zoneId === "string") {
                                onSelectRoom(zoneId);
                            }
                        }, children: [_jsx(CartesianGrid, { stroke: "var(--chart-grid)", strokeDasharray: "3 3", vertical: false }), _jsx(XAxis, { type: "number", dataKey: "temperatureC", name: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430", unit: " \u00B0C", tick: CHART_AXIS_TICK, tickLine: false, axisLine: { stroke: "var(--chart-edge)" } }), _jsx(YAxis, { type: "number", dataKey: "heatingPowerW", name: "\u0422\u0440\u0435\u0431\u0443\u0435\u043C\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C", tick: CHART_AXIS_TICK, tickFormatter: formatChartAxisPower, tickLine: false, axisLine: { stroke: "var(--chart-edge)" }, width: 52 }), _jsx(ZAxis, { type: "number", dataKey: "bubbleSize", range: [72, 380] }), setpoint != null ? (_jsx(ReferenceLine, { x: setpoint, stroke: "var(--accent-base)", strokeDasharray: "6 4", strokeWidth: 1.5, strokeOpacity: 0.85, label: {
                                    value: `Уставка ${setpoint.toFixed(1)} °C`,
                                    position: "insideTopRight",
                                    fill: "var(--text-soft)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                } })) : null, _jsx(Tooltip, { content: _jsx(RoomScatterTooltip, {}), cursor: { strokeDasharray: "4 4", stroke: "var(--chart-edge)" } }), _jsx(Scatter, { data: data, name: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F", fillOpacity: 0.78, children: data.map((row) => (_jsx(Cell, { fill: row.fill, stroke: row.stroke, strokeWidth: row.strokeWidth }, row.zoneId))) })] }) }) })] }));
}
function ScatterHeader() {
    return (_jsx("header", { className: "ui-loss-chart__head", children: _jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0410\u043D\u043E\u043C\u0430\u043B\u0438\u0438 \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C" }) }));
}
export default RoomScatterPlot;
