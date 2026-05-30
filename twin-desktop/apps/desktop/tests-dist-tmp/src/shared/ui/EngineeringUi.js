import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconStatusError, IconStatusOk, IconStatusWarn } from "./icons";
const calloutClass = {
    info: "ui-callout-info",
    assumption: "ui-callout-assumption",
    attention: "ui-callout-attention",
    risk: "ui-callout-risk",
    success: "ui-callout-success",
};
const calloutDefaultIcon = {
    info: _jsx(IconStatusOk, { className: "h-[1.1rem] w-[1.1rem] opacity-90" }),
    assumption: _jsx(IconStatusWarn, { className: "h-[1.1rem] w-[1.1rem] opacity-80" }),
    attention: _jsx(IconStatusWarn, { className: "h-[1.1rem] w-[1.1rem] opacity-90" }),
    risk: _jsx(IconStatusError, { className: "h-[1.1rem] w-[1.1rem] opacity-90" }),
    success: _jsx(IconStatusOk, { className: "h-[1.1rem] w-[1.1rem] opacity-90" }),
};
export function EngineeringCallout({ variant = "info", title, children, icon, className = "", }) {
    const resolvedIcon = icon !== undefined ? icon : calloutDefaultIcon[variant];
    return (_jsxs("div", { className: `group animate-ui-pop rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${calloutClass[variant]} ${className}`.trim(), children: [_jsxs("p", { className: "flex items-start gap-2 font-semibold text-[color:var(--text-base)]", children: [resolvedIcon != null ? (_jsx("span", { className: "ui-icon-tap mt-0.5 shrink-0 text-[color:var(--accent-base)]", children: resolvedIcon })) : null, _jsx("span", { children: title })] }), _jsx("div", { className: "mt-2 text-[0.925rem] leading-snug text-[color:var(--text-muted)] [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-5 [&_p+p]:mt-2 [&_strong]:text-[color:var(--text-base)]", children: children })] }));
}
export function EngineeringSectionHeader({ kicker, title, subtitle, }) {
    return (_jsxs("header", { className: "space-y-1", children: [kicker ? _jsx("p", { className: "ui-soft-kicker", children: kicker }) : null, _jsx("h3", { className: "ui-heading-card", children: title }), subtitle ? _jsx("p", { className: "max-w-3xl text-[15px] leading-snug text-[color:var(--text-muted)]", children: subtitle }) : null] }));
}
const toneRing = {
    neutral: "ring-[color:var(--border-base)]",
    ok: "ring-[color:var(--success-border)]",
    attention: "ring-[color:var(--warning-border)]",
    risk: "ring-[color:var(--danger-border)]",
};
export function EngineeringMetricTile({ label, value, unit, hint, tone = "neutral", }) {
    return (_jsxs("div", { className: `ui-metric ui-hover-lift group flex flex-col gap-1 p-4 shadow-sm ring-1 ring-inset ${toneRing[tone]} hover:border-[color:var(--border-base)]`, children: [_jsx("p", { className: "text-[0.8rem] font-semibold leading-snug text-[color:var(--text-muted)]", children: label }), _jsxs("p", { className: "text-2xl font-semibold tabular-nums tracking-tight text-[color:var(--text-base)]", children: [value, unit ? _jsx("span", { className: "ml-1.5 text-base font-medium text-[color:var(--text-muted)]", children: unit }) : null] }), hint ? _jsx("p", { className: "text-xs leading-snug text-[color:var(--text-muted)]", children: hint }) : null] }));
}
export function TemperatureScaleLegend({ minC = 15, maxC = 30, title = "Temperature Scale", unitLabel = "°C", minLabel, maxLabel, gradientCss, caption, }) {
    const resolvedMinLabel = minLabel ?? `${minC} ${unitLabel}`.trim();
    const resolvedMaxLabel = maxLabel ?? `${maxC} ${unitLabel}`.trim();
    return (_jsxs("div", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-muted)] shadow-sm backdrop-blur", children: [_jsx("p", { className: "mb-1.5 font-semibold text-[color:var(--text-base)]", children: title }), _jsx("div", { className: "h-2.5 w-full max-w-[220px] rounded-full shadow-inner", style: { background: gradientCss ?? "var(--temp-legend-gradient)" }, title: `${resolvedMinLabel} → ${resolvedMaxLabel}` }), _jsxs("div", { className: "mt-1 flex max-w-[220px] justify-between font-medium tabular-nums text-[color:var(--text-base)]", children: [_jsx("span", { children: resolvedMinLabel }), _jsx("span", { children: resolvedMaxLabel })] }), caption ? _jsx("p", { className: "mt-1.5 text-xs leading-snug text-[color:var(--text-soft)]", children: caption }) : null] }));
}
/**
 * Compact engineering-grade thermal field legend.
 *
 * Shows: mode title, ANSYS colorbar, min / avg / max values, unit label,
 * source caption, and optional warning list.
 *
 * Use this instead of TemperatureScaleLegend wherever ANSYS-like output is shown.
 */
export function ThermalFieldLegend({ title = "Thermal Field", minC, avgC, maxC, unitLabel = "°C", source, warnings, gradientCss, condensationMode, }) {
    const resolvedGradient = gradientCss ??
        (condensationMode
            ? "linear-gradient(90deg, #16a34a 0%, #f59e0b 50%, #dc2626 100%)"
            : "var(--temp-legend-gradient)");
    const fmt = (v) => unitLabel === "°C" ? `${v.toFixed(1)} ${unitLabel}` : `${v.toFixed(1)} ${unitLabel}`;
    const minLabel = condensationMode ? "Safe" : fmt(minC);
    const maxLabel = condensationMode ? "Risk" : fmt(maxC);
    return (_jsxs("div", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-muted)] shadow-sm backdrop-blur", children: [_jsx("p", { className: "mb-1.5 font-semibold text-[color:var(--text-base)]", children: title }), _jsx("div", { className: "h-2.5 w-full max-w-[220px] rounded-full shadow-inner", style: { background: resolvedGradient }, title: `${minLabel} → ${maxLabel}` }), _jsxs("div", { className: "mt-1 flex max-w-[220px] items-center justify-between font-medium tabular-nums text-[color:var(--text-base)]", children: [_jsx("span", { className: "text-[11px]", children: minLabel }), typeof avgC === "number" && !condensationMode ? (_jsxs("span", { className: "text-[10px] text-[color:var(--text-soft)]", children: ["\u2205 ", fmt(avgC)] })) : null, _jsx("span", { className: "text-[11px]", children: maxLabel })] }), source ? (_jsx("p", { className: "mt-1.5 text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-soft)]", children: source })) : null, warnings?.length ? (_jsx("div", { className: "mt-1.5 space-y-0.5", children: warnings.map((w) => (_jsxs("p", { className: "flex items-start gap-1 text-[10px] leading-snug text-[color:var(--text-muted)]", children: [_jsx("span", { className: "mt-px opacity-60", children: "\u26A0" }), _jsx("span", { children: w })] }, w))) })) : null] }));
}
