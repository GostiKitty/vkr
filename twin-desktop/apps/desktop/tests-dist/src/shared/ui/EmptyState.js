import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function EmptyState({ title, message, icon, tone = "default" }) {
    const palette = tone === "warning"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"
        : "border-[color:var(--border-soft)] bg-[color:var(--surface-base)] text-[color:var(--text-muted)]";
    return (_jsxs("div", { className: `group animate-ui-pop rounded-2xl border px-4 py-6 text-sm shadow-inner transition ${palette}`, children: [icon && _jsx("div", { className: "ui-icon-tap mb-2 text-[color:var(--accent-base)]", children: icon }), title && _jsx("p", { className: "text-base font-semibold text-[color:var(--text-base)]", children: title }), _jsx("p", { className: "leading-relaxed", children: message })] }));
}
export default EmptyState;
