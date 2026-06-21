import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { formatNumber } from "../../../shared/utils/format";
const HEATMAP_COLORS = ["#16344f", "#1f5d7a", "#2d8d8b", "#66b96a", "#f2c04c", "#e97232", "#a9341f"];
export function TemperatureHeatmapPanel({ field, hover, onHover, roomLabels, emptyMessage = "Недостаточно данных для визуализации. Запустите расчёт или уточните входные параметры.", }) {
    if (!field?.cells.length) {
        return _jsx(HeatmapPlaceholder, { message: emptyMessage });
    }
    const cellSize = field.kind === "detailed" ? 18 : 24;
    const width = Math.max((field.cols || 1) * cellSize, 320);
    const height = Math.max((field.rows || 1) * cellSize, 180);
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(HeatmapSvg, { field: field, cellSize: cellSize, width: width, height: height, roomLabels: roomLabels, hover: hover, onHover: onHover }), _jsx(GradientLegend, { minC: field.minTemperatureC, maxC: field.maxTemperatureC }), hover ? (_jsxs("div", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: [hover.roomLabel, " \u00B7 (", formatNumber(hover.x, { maximumFractionDigits: 2 }), ";", " ", formatNumber(hover.y, { maximumFractionDigits: 2 }), ") \u043C:", " ", _jsxs("span", { className: "font-semibold text-[color:var(--text-base)]", children: [formatNumber(hover.temperatureC, { maximumFractionDigits: 1 }), " \u00B0C"] })] })) : null] }));
}
function HeatmapSvg({ field, cellSize, width, height, roomLabels, hover, onHover, }) {
    const { cellMap, roomOverlays, borderSegments } = useMemo(() => buildDerivedGeometry(field.cells, cellSize, roomLabels), [field.cells, cellSize, roomLabels]);
    return (_jsx("div", { className: "ui-scroll max-w-full overflow-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2", children: _jsxs("svg", { width: width, height: height, className: "block max-w-none", children: [field.cells.map((cell) => (_jsx("rect", { x: cell.col * cellSize, y: cell.row * cellSize, width: cellSize, height: cellSize, rx: 2, fill: getHeatmapColor(cell.temperatureC, field.minTemperatureC, field.maxTemperatureC), stroke: "none", onMouseEnter: () => onHover({
                        x: cell.x,
                        y: cell.y,
                        temperatureC: cell.temperatureC,
                        roomId: cell.roomId,
                        roomLabel: roomLabels[cell.roomId] ?? "Помещение",
                    }), onMouseLeave: () => onHover(null) }, `${cell.row}-${cell.col}`))), borderSegments.map((seg, i) => (_jsx("line", { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, stroke: "rgba(255,255,255,0.55)", strokeWidth: 1.5, strokeLinecap: "square", style: { pointerEvents: "none" } }, i))), roomOverlays.map((overlay) => (_jsx("text", { x: overlay.cx, y: overlay.cy, textAnchor: "middle", dominantBaseline: "central", fontSize: cellSize <= 18 ? 9 : 11, fontWeight: 600, fill: "rgba(255,255,255,0.95)", stroke: "rgba(0,0,0,0.45)", strokeWidth: 2.5, paintOrder: "stroke", style: { pointerEvents: "none" }, children: overlay.label }, overlay.roomId)))] }) }));
}
function buildDerivedGeometry(cells, cellSize, roomLabels) {
    const cellMap = new Map();
    cells.forEach((cell) => cellMap.set(`${cell.row},${cell.col}`, cell));
    // room centroids for labels
    const roomAccum = new Map();
    cells.forEach((cell) => {
        const acc = roomAccum.get(cell.roomId) ?? { rowSum: 0, colSum: 0, count: 0 };
        acc.rowSum += cell.row;
        acc.colSum += cell.col;
        acc.count += 1;
        roomAccum.set(cell.roomId, acc);
    });
    const roomOverlays = [];
    roomAccum.forEach((acc, roomId) => {
        const rawLabel = roomLabels[roomId] ?? "Помещение";
        roomOverlays.push({
            roomId,
            label: rawLabel.length > 13 ? `${rawLabel.slice(0, 12)}…` : rawLabel,
            cx: (acc.colSum / acc.count + 0.5) * cellSize,
            cy: (acc.rowSum / acc.count + 0.5) * cellSize,
        });
    });
    // borders where roomId changes between adjacent cells or at field edge
    const borderSegments = [];
    cells.forEach((cell) => {
        const x = cell.col * cellSize;
        const y = cell.row * cellSize;
        const right = cellMap.get(`${cell.row},${cell.col + 1}`);
        if (!right || right.roomId !== cell.roomId) {
            borderSegments.push({ x1: x + cellSize, y1: y, x2: x + cellSize, y2: y + cellSize });
        }
        const bottom = cellMap.get(`${cell.row + 1},${cell.col}`);
        if (!bottom || bottom.roomId !== cell.roomId) {
            borderSegments.push({ x1: x, y1: y + cellSize, x2: x + cellSize, y2: y + cellSize });
        }
    });
    return { cellMap, roomOverlays, borderSegments };
}
function GradientLegend({ minC, maxC }) {
    const gradientId = "heatmap-temp-gradient";
    const stops = HEATMAP_COLORS.map((color, i) => (_jsx("stop", { offset: `${(i / (HEATMAP_COLORS.length - 1)) * 100}%`, stopColor: color }, color)));
    return (_jsxs("div", { className: "flex items-center gap-3 text-xs text-[color:var(--text-soft)]", children: [_jsxs("span", { className: "tabular-nums", children: [formatNumber(minC, { maximumFractionDigits: 1 }), " \u00B0C"] }), _jsxs("svg", { width: 160, height: 10, className: "flex-shrink-0 overflow-visible", children: [_jsx("defs", { children: _jsx("linearGradient", { id: gradientId, x1: "0%", y1: "0%", x2: "100%", y2: "0%", children: stops }) }), _jsx("rect", { x: 0, y: 0, width: 160, height: 10, rx: 5, fill: `url(#${gradientId})` })] }), _jsxs("span", { className: "tabular-nums", children: [formatNumber(maxC, { maximumFractionDigits: 1 }), " \u00B0C"] })] }));
}
function HeatmapPlaceholder({ message }) {
    return (_jsx("div", { className: "flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-sm text-[color:var(--text-soft)]", children: _jsx("span", { className: "max-w-xl whitespace-normal break-words px-4 text-center", children: message }) }));
}
function getHeatmapColor(value, min, max) {
    if (!Number.isFinite(value)) {
        return "#cbd5e1";
    }
    const normalized = Math.max(0, Math.min(1, (value - min) / Math.max(max - min, 1e-6)));
    const scaled = normalized * (HEATMAP_COLORS.length - 1);
    const index = Math.floor(scaled);
    const nextIndex = Math.min(HEATMAP_COLORS.length - 1, index + 1);
    const mix = scaled - index;
    return interpolateColor(HEATMAP_COLORS[index], HEATMAP_COLORS[nextIndex], mix);
}
function interpolateColor(from, to, mix) {
    const start = hexToRgb(from);
    const end = hexToRgb(to);
    const red = Math.round(start.r + (end.r - start.r) * mix);
    const green = Math.round(start.g + (end.g - start.g) * mix);
    const blue = Math.round(start.b + (end.b - start.b) * mix);
    return `rgb(${red}, ${green}, ${blue})`;
}
function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    };
}
export { getHeatmapColor, HEATMAP_COLORS };
