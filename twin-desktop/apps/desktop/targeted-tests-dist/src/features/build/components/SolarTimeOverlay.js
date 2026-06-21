import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { computeSolarPosition, dayOfYearLabel, formatAzimuth, formatSolarHour, } from "../../../core/solar/solarPosition";
/** Компас-роза с индикатором солнца (SVG). */
export function CompassRose({ solarPosition }) {
    const R = 36; // радиус окружности
    const CX = 44;
    const CY = 44;
    // Позиция солнца на компасе
    let sunX = CX;
    let sunY = CY - R * 0.68;
    let sunVisible = false;
    if (solarPosition && solarPosition.isAboveHorizon) {
        const az = solarPosition.azimuthDeg * (Math.PI / 180);
        // Высота влияет на расстояние от центра (зенит = центр, горизонт = край)
        const altFraction = Math.max(0, Math.min(1, solarPosition.altitudeDeg / 90));
        const r = R * 0.65 * (1 - altFraction * 0.55);
        sunX = CX + r * Math.sin(az);
        sunY = CY - r * Math.cos(az);
        sunVisible = true;
    }
    return (_jsxs("svg", { width: 88, height: 88, viewBox: "0 0 88 88", className: "shrink-0", "aria-label": "\u041A\u043E\u043C\u043F\u0430\u0441\u043D\u0430\u044F \u0440\u043E\u0437\u0430", children: [_jsx("circle", { cx: CX, cy: CY, r: R, fill: "#f1f5f9", stroke: "#cbd5e1", strokeWidth: 1.5 }), [0, 90, 180, 270].map((deg) => {
                const rad = deg * (Math.PI / 180);
                const x1 = CX + (R - 6) * Math.sin(rad);
                const y1 = CY - (R - 6) * Math.cos(rad);
                const x2 = CX + R * Math.sin(rad);
                const y2 = CY - R * Math.cos(rad);
                return _jsx("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: "#94a3b8", strokeWidth: 1.5 }, deg);
            }), _jsx("polygon", { points: `${CX},${CY - R + 10} ${CX - 4},${CY - 4} ${CX},${CY + 4} ${CX + 4},${CY - 4}`, fill: "#ef4444", opacity: 0.85 }), _jsx("polygon", { points: `${CX},${CY + R - 10} ${CX - 4},${CY + 4} ${CX},${CY - 4} ${CX + 4},${CY + 4}`, fill: "#94a3b8", opacity: 0.7 }), _jsx("circle", { cx: CX, cy: CY, r: 3, fill: "#475569" }), _jsx("text", { x: CX, y: CY - R + 4, textAnchor: "middle", dominantBaseline: "hanging", fontSize: 9, fontWeight: "700", fill: "#1e293b", children: "\u0421" }), _jsx("text", { x: CX + R - 4, y: CY, textAnchor: "start", dominantBaseline: "middle", fontSize: 9, fontWeight: "600", fill: "#64748b", children: "\u0412" }), _jsx("text", { x: CX, y: CY + R - 4, textAnchor: "middle", dominantBaseline: "auto", fontSize: 9, fontWeight: "600", fill: "#64748b", children: "\u042E" }), _jsx("text", { x: CX - R + 4, y: CY, textAnchor: "end", dominantBaseline: "middle", fontSize: 9, fontWeight: "600", fill: "#64748b", children: "\u0417" }), sunVisible && (_jsxs("g", { children: [[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                        const rad = deg * (Math.PI / 180);
                        return (_jsx("line", { x1: sunX + 6.5 * Math.cos(rad), y1: sunY + 6.5 * Math.sin(rad), x2: sunX + 10 * Math.cos(rad), y2: sunY + 10 * Math.sin(rad), stroke: "#f59e0b", strokeWidth: 1.5, strokeLinecap: "round" }, deg));
                    }), _jsx("circle", { cx: sunX, cy: sunY, r: 5.5, fill: "#fbbf24", stroke: "#f59e0b", strokeWidth: 1 })] })), !sunVisible && (_jsxs("g", { opacity: 0.4, children: [_jsx("circle", { cx: CX, cy: CY, r: 5, fill: "none", stroke: "#64748b", strokeWidth: 1.5, strokeDasharray: "2,2" }), _jsx("text", { x: CX, y: CY, textAnchor: "middle", dominantBaseline: "middle", fontSize: 9, fill: "#64748b", children: "\uD83C\uDF19" })] }))] }));
}
export default function SolarTimeOverlay({ state, onChange, onClose }) {
    const solarPos = computeSolarPosition({
        latitudeDeg: state.latitudeDeg,
        dayOfYear: state.dayOfYear,
        hourDecimal: state.hour,
    });
    return (_jsxs("div", { className: "pointer-events-auto select-none rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm", style: { minWidth: 280, maxWidth: 340 }, children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-base", children: "\u2600\uFE0F" }), _jsx("span", { className: "text-sm font-semibold text-slate-800", children: "\u041F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441\u043E\u043B\u043D\u0446\u0430" })] }), _jsx("button", { onClick: onClose, className: "rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u2715" })] }), _jsxs("div", { className: "flex gap-3 px-4 pb-3 pt-3", children: [_jsx(CompassRose, { solarPosition: solarPos }), _jsxs("div", { className: "flex flex-1 flex-col gap-1 pt-1", children: [_jsxs("div", { className: "text-xs text-slate-500", children: ["\u0414\u0430\u0442\u0430: ", _jsx("span", { className: "font-medium text-slate-700", children: dayOfYearLabel(state.dayOfYear) })] }), _jsxs("div", { className: "text-xs text-slate-500", children: ["\u0412\u0440\u0435\u043C\u044F: ", _jsx("span", { className: "font-medium text-slate-700", children: formatSolarHour(state.hour) })] }), solarPos.isAboveHorizon ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "text-xs text-slate-500", children: ["\u0412\u044B\u0441\u043E\u0442\u0430: ", _jsxs("span", { className: "font-medium text-amber-600", children: [solarPos.altitudeDeg.toFixed(1), "\u00B0"] })] }), _jsxs("div", { className: "text-xs text-slate-500", children: ["\u0410\u0437\u0438\u043C\u0443\u0442: ", _jsx("span", { className: "font-medium text-slate-700", children: formatAzimuth(solarPos.azimuthDeg) })] })] })) : (_jsx("div", { className: "mt-1 text-xs font-medium text-slate-400", children: "\u0421\u043E\u043B\u043D\u0446\u0435 \u0437\u0430 \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u043E\u043C" })), _jsxs("div", { className: "text-xs text-slate-400", children: ["\u03C6 = ", state.latitudeDeg.toFixed(1), "\u00B0"] })] })] }), _jsxs("div", { className: "border-t border-slate-100 px-4 pb-4 pt-3", children: [_jsxs("label", { className: "mb-1.5 flex items-center justify-between text-xs text-slate-500", children: [_jsx("span", { children: "\u0412\u0440\u0435\u043C\u044F \u0441\u0443\u0442\u043E\u043A" }), _jsx("span", { className: "font-semibold text-slate-700", children: formatSolarHour(state.hour) })] }), _jsx("input", { type: "range", min: 0, max: 24, step: 0.25, value: state.hour, onChange: (e) => onChange({ hour: Number(e.target.value) }), className: "w-full accent-amber-500" }), _jsxs("div", { className: "mt-0.5 flex justify-between text-[10px] text-slate-400", children: [_jsx("span", { children: "00:00" }), _jsx("span", { children: "06:00" }), _jsx("span", { children: "12:00" }), _jsx("span", { children: "18:00" }), _jsx("span", { children: "24:00" })] })] }), _jsxs("div", { className: "border-t border-slate-100 px-4 pb-4 pt-3", children: [_jsxs("label", { className: "mb-1.5 flex items-center justify-between text-xs text-slate-500", children: [_jsx("span", { children: "\u0414\u0435\u043D\u044C \u0433\u043E\u0434\u0430" }), _jsx("span", { className: "font-semibold text-slate-700", children: dayOfYearLabel(state.dayOfYear) })] }), _jsx("input", { type: "range", min: 1, max: 365, step: 1, value: state.dayOfYear, onChange: (e) => onChange({ dayOfYear: Number(e.target.value) }), className: "w-full accent-amber-500" }), _jsxs("div", { className: "mt-0.5 flex justify-between text-[10px] text-slate-400", children: [_jsx("span", { children: "\u042F\u043D\u0432" }), _jsx("span", { children: "\u0410\u043F\u0440" }), _jsx("span", { children: "\u0418\u044E\u043B" }), _jsx("span", { children: "\u041E\u043A\u0442" }), _jsx("span", { children: "\u0414\u0435\u043A" })] })] })] }));
}
