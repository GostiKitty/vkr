import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatChartPower, formatChartTemperature, formatZoneStatusLabel, getFiniteChartDomain, heatColorLoad, heatColorTemperature, statusBadgeClass, THERMAL_CHART_NOT_SET, } from "./thermalChartTheme";
export function RoomHeatmapMatrix({ rows, selectedRoomId, onSelectRoom }) {
    const limited = rows.slice(0, 20);
    if (!limited.length) {
        return (_jsxs("section", { className: "ui-chart-shell", children: [_jsx(HeatmapHeader, {}), _jsx("div", { className: "ui-loss-chart__empty", children: "\u041C\u0430\u0442\u0440\u0438\u0446\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430: \u043D\u0435\u0442 \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C." })] }));
    }
    const tempDomain = getFiniteChartDomain(limited.map((row) => row.temperatureC));
    const loadDomain = getFiniteChartDomain(limited.map((row) => row.heatingPowerW));
    const lossDomain = getFiniteChartDomain(limited.map((row) => row.lossTotalW));
    return (_jsxs("section", { className: "ui-chart-shell", "data-testid": "room-heatmap-matrix", children: [_jsx(HeatmapHeader, {}), _jsxs("div", { className: "ui-heatmap__scales mt-3", children: [_jsx(HeatmapScale, { label: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430", variant: "temperature", domain: tempDomain }), _jsx(HeatmapScale, { label: "\u041D\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0438 \u043F\u043E\u0442\u0435\u0440\u0438", variant: "load", domain: loadDomain ?? lossDomain })] }), _jsx("div", { className: "ui-heatmap__table-wrap mt-4", children: _jsxs("table", { className: "ui-heatmap__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "ui-heatmap__th ui-heatmap__th--sticky", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("th", { className: "ui-heatmap__th", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430" }), _jsx("th", { className: "ui-heatmap__th", children: "\u041D\u0430\u0433\u0440\u0443\u0437\u043A\u0430" }), _jsx("th", { className: "ui-heatmap__th", children: "\u041F\u043E\u0442\u0435\u0440\u0438" }), _jsx("th", { className: "ui-heatmap__th", children: "\u0421\u0442\u0430\u0442\u0443\u0441" })] }) }), _jsx("tbody", { children: limited.map((row) => {
                                const selected = selectedRoomId === row.zoneId;
                                return (_jsxs("tr", { className: `ui-heatmap__row${selected ? " ui-heatmap__row--selected" : ""}`, children: [_jsx("td", { className: "ui-heatmap__td ui-heatmap__td--sticky", children: _jsx("button", { type: "button", onClick: () => onSelectRoom(row.zoneId), className: "ui-heatmap__room", children: row.zoneName }) }), _jsx(HeatmapCell, { value: row.temperatureC, domain: tempDomain, formatter: formatChartTemperature, variant: "temperature" }), _jsx(HeatmapCell, { value: row.heatingPowerW, domain: loadDomain, formatter: formatChartPower, variant: "load" }), _jsx(HeatmapCell, { value: row.lossTotalW, domain: lossDomain, formatter: formatChartPower, variant: "load" }), _jsx("td", { className: "ui-heatmap__td", children: _jsx("span", { className: statusBadgeClass(row.status), children: formatZoneStatusLabel(row.status) }) })] }, row.zoneId));
                            }) })] }) })] }));
}
function HeatmapHeader() {
    return (_jsx("header", { className: "ui-loss-chart__head", children: _jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041C\u0430\u0442\u0440\u0438\u0446\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439" }) }));
}
function HeatmapScale({ label, variant, domain, }) {
    const stops = [0, 0.25, 0.5, 0.75, 1];
    const colorAt = (ratio) => {
        if (!domain)
            return "var(--surface-muted)";
        const value = domain[0] + ratio * (domain[1] - domain[0]);
        return variant === "temperature"
            ? heatColorTemperature(value, domain[0], domain[1])
            : heatColorLoad(value, domain[0], domain[1]);
    };
    return (_jsxs("div", { className: "ui-heatmap__scale", children: [_jsx("span", { className: "ui-heatmap__scale-label", children: label }), _jsx("div", { className: "ui-heatmap__scale-bar", "aria-hidden": true, children: stops.map((ratio) => (_jsx("span", { className: "ui-heatmap__scale-stop", style: { backgroundColor: colorAt(ratio) } }, ratio))) }), domain ? (_jsx("span", { className: "ui-heatmap__scale-range", children: variant === "temperature"
                    ? `${formatChartTemperature(domain[0])} … ${formatChartTemperature(domain[1])}`
                    : `${formatChartPower(domain[0])} … ${formatChartPower(domain[1])}` })) : null] }));
}
function HeatmapCell({ value, domain, formatter, variant, }) {
    if (!Number.isFinite(value) || !domain) {
        return (_jsx("td", { className: "ui-heatmap__td", children: _jsx("span", { className: "ui-heatmap__empty", children: THERMAL_CHART_NOT_SET }) }));
    }
    const numeric = value;
    const ratio = domain[1] > domain[0] ? (numeric - domain[0]) / (domain[1] - domain[0]) : 0;
    const fillColor = variant === "temperature"
        ? heatColorTemperature(numeric, domain[0], domain[1])
        : heatColorLoad(numeric, domain[0], domain[1]);
    return (_jsx("td", { className: "ui-heatmap__td", children: _jsxs("div", { className: "ui-heatmap__cell", children: [_jsx("div", { className: "ui-heatmap__cell-track", "aria-hidden": true, children: _jsx("div", { className: "ui-heatmap__cell-fill", style: { width: `${Math.max(ratio * 100, 4)}%`, backgroundColor: fillColor } }) }), _jsx("span", { className: "ui-heatmap__cell-value", children: formatter(value) })] }) }));
}
export default RoomHeatmapMatrix;
