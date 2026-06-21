import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CalculatedMetricSourceBadge } from "./engineeringWorkspace";
const STRIP_TONE_CLASS = {
    neutral: "",
    success: "ui-workspace-strip__item--success",
    warning: "ui-workspace-strip__item--warning",
    info: "ui-workspace-strip__item--info",
};
function joinClasses(...values) {
    return values.filter(Boolean).join(" ");
}
export function WorkspacePageHeader({ kicker, title, description, actions, }) {
    return (_jsxs("header", { className: "ui-workspace-header", children: [_jsxs("div", { className: "min-w-0 space-y-2", children: [kicker ? _jsx("p", { className: "ui-kicker", children: kicker }) : null, _jsx("h1", { className: "ui-heading-hero", children: title }), description ? (_jsx("p", { className: "max-w-2xl text-[15px] leading-snug text-[color:var(--text-muted)]", children: description })) : null] }), actions ? _jsx("div", { className: "ui-workspace-header__actions", children: actions }) : null] }));
}
export function StatusStrip({ items, className }) {
    return (_jsx("div", { className: joinClasses("ui-workspace-strip", className), children: items.map((item) => (_jsxs("div", { className: joinClasses("ui-workspace-strip__item", STRIP_TONE_CLASS[item.tone ?? "neutral"]), children: [_jsx("span", { className: "ui-workspace-strip__label", children: item.label }), _jsx("span", { className: "ui-workspace-strip__value", children: item.value })] }, item.label))) }));
}
export function WorkspaceShell({ children, className }) {
    return _jsx("div", { className: joinClasses("ui-workspace-shell", className), children: children });
}
export function WorkspacePane({ title, subtitle, actions, children, className, bodyClassName, }) {
    return (_jsxs("section", { className: joinClasses("ui-workspace-pane", className), children: [_jsxs("div", { className: "ui-workspace-pane__header", children: [_jsxs("div", { className: "min-w-0 space-y-1", children: [_jsx("h2", { className: "ui-heading-panel", children: title }), subtitle ? (_jsx("p", { className: "text-sm leading-relaxed text-[color:var(--text-muted)]", children: subtitle })) : null] }), actions ? _jsx("div", { className: "shrink-0", children: actions }) : null] }), _jsx("div", { className: joinClasses("ui-workspace-pane__body", bodyClassName), children: children })] }));
}
export function InspectorPanel(props) {
    return _jsx(WorkspacePane, { ...props, className: joinClasses("ui-workspace-pane--inspector", props.className) });
}
export function ActionBar({ children, className, }) {
    return _jsx("div", { className: joinClasses("ui-action-bar", className), children: children });
}
export function WorkspaceInlineNotice({ message, actions, className, }) {
    return (_jsxs("div", { className: joinClasses("ui-workspace-inline-notice", className), children: [_jsx("p", { className: "min-w-0 text-sm text-[color:var(--text-muted)]", children: message }), actions ? _jsx("div", { className: "flex shrink-0 flex-wrap gap-2", children: actions }) : null] }));
}
export function EmptyWorkspaceState({ title, message, actions, className, }) {
    return (_jsxs("div", { className: joinClasses("ui-empty-workspace", className), children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: title }), _jsx("p", { className: "text-sm leading-relaxed text-[color:var(--text-muted)]", children: message })] }), actions ? _jsx("div", { className: "ui-empty-workspace__actions", children: actions }) : null] }));
}
export function HighlightCard({ label, value, hint, tone = "neutral", metricInfo, calculated = false, }) {
    const toneClass = tone === "success"
        ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"
        : tone === "warning"
            ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]"
            : tone === "info"
                ? "border-[color:var(--info-border)] bg-[color:var(--info-bg)]"
                : "";
    const showCalculatedBadge = calculated && metricInfo != null;
    return (_jsxs("article", { className: joinClasses("ui-highlight-card ui-hover-lift", toneClass), children: [_jsxs("div", { className: "ui-highlight-card__header", children: [_jsx("p", { className: "ui-highlight-card__label", children: label }), showCalculatedBadge ? (_jsx("span", { className: "ui-highlight-card__source-badge", children: _jsx(CalculatedMetricSourceBadge, { info: metricInfo }) })) : null] }), _jsx("p", { className: "ui-highlight-card__value", children: value }), hint ? _jsx("p", { className: "ui-highlight-card__hint", children: hint }) : null] }));
}
export function SummaryHighlightGrid({ items, className, }) {
    return (_jsx("div", { className: joinClasses("ui-highlight-grid", className), children: items.map((item) => (_jsx(HighlightCard, { ...item }, item.label))) }));
}
export function SummaryHero({ title, description, children, className, }) {
    return (_jsxs("section", { className: joinClasses("ui-summary-hero", className), children: [_jsx("h2", { className: "ui-summary-hero__title", children: title }), description ? _jsx("p", { className: "ui-summary-hero__description", children: description }) : null, children ? _jsx("div", { className: "mt-4", children: children }) : null] }));
}
export function CollapsibleSection({ title, titleAddon, description, defaultOpen = false, children, className, }) {
    return (_jsxs("details", { className: joinClasses("ui-collapsible", className), open: defaultOpen || undefined, children: [_jsx("summary", { className: "ui-collapsible__summary", children: _jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [title, titleAddon ? (_jsx("span", { className: "inline-flex shrink-0", onClick: (event) => event.preventDefault(), onKeyDown: (event) => event.stopPropagation(), children: titleAddon })) : null] }) }), _jsxs("div", { className: "ui-collapsible__body", children: [description ? _jsx("p", { className: "ui-collapsible__description", children: description }) : null, children] })] }));
}
