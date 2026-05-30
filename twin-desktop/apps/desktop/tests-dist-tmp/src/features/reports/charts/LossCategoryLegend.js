import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LOSS_CATEGORY_COLORS, LOSS_CATEGORY_LABELS } from "./thermalChartTheme";
const ORDER = ["opaque", "window", "door", "infiltration", "ventilation"];
export function LossCategoryLegend({ className = "", variant = "default", }) {
    const itemClass = variant === "compact"
        ? "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-soft)]"
        : "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-2.5 py-1 text-[11px] text-[color:var(--text-muted)]";
    return (_jsx("ul", { className: `flex flex-wrap gap-1.5 ${className}`, "aria-label": "\u041B\u0435\u0433\u0435\u043D\u0434\u0430 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439 \u043F\u043E\u0442\u0435\u0440\u044C", children: ORDER.map((key) => (_jsxs("li", { className: itemClass, children: [_jsx("span", { className: "h-2.5 w-2.5 shrink-0 rounded-full", style: { backgroundColor: LOSS_CATEGORY_COLORS[key] }, "aria-hidden": true }), LOSS_CATEGORY_LABELS[key]] }, key))) }));
}
