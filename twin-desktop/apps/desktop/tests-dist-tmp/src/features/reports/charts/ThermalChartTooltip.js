import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ThermalChartTooltip({ active, payload, title, rows, footnote }) {
    if (!active || !payload?.length) {
        return null;
    }
    const item = payload[0]?.payload;
    const resolvedTitle = title ??
        (typeof item?.label === "string" ? item.label : undefined) ??
        (typeof item?.zoneName === "string" ? item.zoneName : undefined) ??
        "";
    const resolvedRows = rows ??
        payload.map((entry) => ({
            label: String(entry.name ?? ""),
            value: String(entry.value ?? ""),
        }));
    return (_jsxs("div", { className: "ui-overlay max-w-[min(320px,90vw)] rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2.5 text-xs shadow-lg", children: [resolvedTitle ? _jsx("p", { className: "font-semibold text-[color:var(--text-base)]", children: resolvedTitle }) : null, _jsx("dl", { className: resolvedTitle ? "mt-2 space-y-1" : "space-y-1", children: resolvedRows.map((row) => (_jsxs("div", { className: "flex items-baseline justify-between gap-4", children: [_jsx("dt", { className: "text-[color:var(--text-soft)]", children: row.label }), _jsx("dd", { className: "tabular-nums font-medium text-[color:var(--text-base)]", children: row.value })] }, row.label))) }), footnote ? _jsx("p", { className: "mt-2 border-t border-[color:var(--border-soft)] pt-2 text-[color:var(--text-soft)]", children: footnote }) : null] }));
}
