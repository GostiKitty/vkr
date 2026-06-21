import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo } from "react";
import { buildNetworkSystemsPresentation, } from "../networks/presentation";
export function NetworkSystemsPanel({ model, snapshot, onSetActiveScenario }) {
    const presentation = useMemo(() => buildNetworkSystemsPresentation(model, snapshot), [model, snapshot]);
    const hasPipeNetworks = presentation.pipe.branchCount > 0 || presentation.pipe.systemCount > 0 || presentation.pipe.families.length > 0;
    const hasAirNetworks = presentation.duct.branchCount > 0;
    const hasDiagnostics = presentation.diagnostics.warnings.length > 0 || presentation.diagnostics.suggestions.length > 0;
    const hasMonitoring = presentation.monitoring.events.length > 0 || presentation.monitoring.sensorAlerts.length > 0;
    return (_jsxs("section", { className: "ui-panel p-4 sm:p-5", children: [_jsxs("header", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]", children: "\u0420\u040E\u0420\u00B5\u0421\u201A\u0420\u0451" }), _jsx("h3", { className: "truncate text-base font-semibold text-[color:var(--text-base)]", children: "\u0420\u045E\u0421\u0402\u0421\u0453\u0420\u00B1\u0421\u2039 \u0420\u0451 \u0420\u0406\u0420\u0455\u0420\u00B7\u0420\u0491\u0421\u0453\u0421\u2026" })] }), _jsxs("label", { className: "flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]", children: ["\u0420\u040E\u0421\u2020\u0420\u00B5\u0420\u0405\u0420\u00B0\u0421\u0402\u0420\u0451\u0420\u2116", _jsxs("select", { value: model.activeScenarioId ?? "", onChange: (event) => onSetActiveScenario(event.target.value || null), className: "max-w-[220px] rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm normal-case tracking-normal text-[color:var(--text-base)]", children: [!model.scenarios.length ? _jsx("option", { value: "", children: "\u0420\u045C\u0420\u00B5\u0421\u201A \u0421\u0403\u0421\u2020\u0420\u00B5\u0420\u0405\u0420\u00B0\u0421\u0402\u0420\u0451\u0420\u00B5\u0420\u0406" }) : null, model.scenarios.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] })] })] }), presentation.overview.length ? (_jsx("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: presentation.overview.map((metric) => (_jsx(MetricCard, { label: metric.label, value: metric.value, detail: metric.detail }, metric.label))) })) : null, _jsxs("div", { className: "mt-4 grid gap-3 xl:grid-cols-2", children: [_jsxs(InsightCard, { title: "\u0420\u045E\u0421\u0402\u0421\u0453\u0420\u00B1\u0421\u2039", className: hasPipeNetworks ? "" : "hidden", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatPill, { label: "\u0420\u045F\u0420\u0455\u0420\u0491\u0420\u0454\u0420\u00BB\u0421\u040B\u0421\u2021\u0420\u00B5\u0420\u0405\u0420\u0455", value: `${presentation.pipe.connectedBranchCount}/${presentation.pipe.branchCount}` }), _jsx(StatPill, { label: "\u0420\u0459\u0420\u0455\u0420\u0405\u0421\u201A\u0421\u0453\u0421\u0402\u0421\u2039", value: `${presentation.pipe.connectedSystemCount}/${presentation.pipe.systemCount}` }), _jsx(StatPill, { label: "\u0420\u045C\u0420\u00B0\u0420\u0456\u0421\u0402\u0421\u0453\u0420\u00B7\u0420\u0454\u0420\u00B0", value: formatPower(presentation.pipe.totalLoadW) }), _jsx(StatPill, { label: "\u041E\u201Dp", value: formatPa(presentation.pipe.estimatedPressureDropPa) })] }), _jsx(SectionTitle, { className: presentation.pipe.families.length ? "mt-4" : "hidden", children: "\u0420\u040E\u0420\u00B5\u0420\u0458\u0420\u00B5\u0420\u2116\u0421\u0403\u0421\u201A\u0420\u0406\u0420\u00B0" }), presentation.pipe.families.length ? (_jsx("ul", { className: "space-y-2", children: presentation.pipe.families.map((family) => (_jsxs("li", { className: "flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-semibold text-[color:var(--text-base)]", children: family.label }), _jsxs("p", { className: "text-xs text-[color:var(--text-soft)]", children: [formatMeters(family.totalLength_m), " \u0420\u0458"] })] }), _jsxs("p", { className: "shrink-0 text-right text-xs text-[color:var(--text-muted)]", children: [family.connectedCount, "/", family.count] })] }, family.id))) })) : null, _jsx(SectionTitle, { className: presentation.pipe.systems.length ? "mt-4" : "hidden", children: "\u0420\u0459\u0420\u0455\u0420\u0405\u0421\u201A\u0421\u0453\u0421\u0402\u0421\u2039" }), presentation.pipe.systems.length ? (_jsx("ul", { className: "space-y-2", children: presentation.pipe.systems.map((system) => (_jsxs("li", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "min-w-0 truncate font-semibold text-[color:var(--text-base)]", children: system.name }), _jsx(ToneBadge, { tone: system.connected ? "success" : "warning", children: system.connected ? "СЃРѕР±СЂР°РЅ" : `${system.issueCount} Р·Р°РјРµС‡.` })] }), _jsxs("div", { className: "mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--text-soft)]", children: [_jsxs("span", { children: [system.branchCount, " \u0420\u0406\u0420\u00B5\u0421\u201A\u0420\u0455\u0420\u0454"] }), _jsxs("span", { children: [formatMeters(system.totalLength_m), " \u0420\u0458"] }), _jsx("span", { children: formatPower(system.totalLoadW) }), _jsxs("span", { children: ["\u0420\u0457\u0420\u0455\u0421\u201A\u0420\u00B5\u0421\u0402\u0420\u0451 ", formatPower(system.totalHeatLossW)] }), _jsxs("span", { children: [system.roomCount, " \u0420\u0457\u0420\u0455\u0420\u0458\u0420\u00B5\u0421\u2030\u0420\u00B5\u0420\u0405\u0420\u0451\u0420\u2116"] })] })] }, system.id))) })) : null] }), _jsxs(InsightCard, { title: "\u0420\u2019\u0420\u0455\u0420\u00B7\u0420\u0491\u0421\u0453\u0421\u2026", className: hasAirNetworks ? "" : "hidden", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatPill, { label: "\u0420\u045F\u0420\u0455\u0420\u0491\u0420\u0454\u0420\u00BB\u0421\u040B\u0421\u2021\u0420\u00B5\u0420\u0405\u0420\u0455", value: `${presentation.duct.connectedBranchCount}/${presentation.duct.branchCount}` }), _jsx(StatPill, { label: "\u0420\u00A0\u0420\u00B0\u0421\u0403\u0421\u2026\u0420\u0455\u0420\u0491", value: `${formatNumber(presentation.duct.totalAirflow_m3_s, 2)} РјВі/СЃ` }), _jsx(StatPill, { label: "\u0420\u040E\u0420\u0454\u0420\u0455\u0421\u0402\u0420\u0455\u0421\u0403\u0421\u201A\u0421\u040A", value: `${formatNumber(presentation.duct.averageAirVelocity_m_s, 1)} Рј/СЃ` }), _jsx(StatPill, { label: "\u041E\u201Dp", value: formatPa(presentation.duct.estimatedPressureDropPa) })] }), _jsx(SectionTitle, { className: presentation.duct.branches.length ? "mt-4" : "hidden", children: "\u0420\u2019\u0420\u00B5\u0421\u201A\u0420\u0454\u0420\u0451" }), presentation.duct.branches.length ? (_jsx("ul", { className: "space-y-2", children: presentation.duct.branches.map((branch) => (_jsxs("li", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "min-w-0 truncate font-semibold text-[color:var(--text-base)]", children: branch.label }), _jsxs("div", { className: "shrink-0 text-right text-xs font-semibold text-[color:var(--text-soft)]", children: [_jsxs("div", { children: [formatNumber(branch.airflow_m3_s, 2), " \u0420\u0458\u0412\u0456/\u0421\u0403"] }), branch.estimatedPressureDropPa != null ? (_jsx("div", { className: branchPressureClass(branch.estimatedPressureDropPa, branch.availablePressurePa), children: formatBranchPressure(branch.estimatedPressureDropPa, branch.availablePressurePa) })) : null] })] }), _jsxs("div", { className: "mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--text-soft)]", children: [_jsx("span", { children: branch.sectionLabel }), _jsxs("span", { children: [formatMeters(branch.totalLength_m), " \u0420\u0458"] }), _jsxs("span", { children: [formatNumber(branch.airVelocity_m_s, 1), " \u0420\u0458/\u0421\u0403"] })] })] }, branch.id))) })) : null] }), _jsxs(InsightCard, { title: "\u0420\u201D\u0420\u0451\u0420\u00B0\u0420\u0456\u0420\u0405\u0420\u0455\u0421\u0403\u0421\u201A\u0420\u0451\u0420\u0454\u0420\u00B0", className: hasDiagnostics ? "" : "hidden", children: [presentation.diagnostics.warnings.length ? (_jsxs(_Fragment, { children: [_jsx(SectionTitle, { children: "\u0420\u2014\u0420\u00B0\u0420\u0458\u0420\u00B5\u0421\u2021\u0420\u00B0\u0420\u0405\u0420\u0451\u0421\u040F" }), _jsx("div", { className: "space-y-2", children: presentation.diagnostics.warnings.map((warning) => (_jsx(WarningRow, { warning: warning }, warning.id))) })] })) : null, presentation.diagnostics.suggestions.length ? (_jsxs(_Fragment, { children: [_jsx(SectionTitle, { className: presentation.diagnostics.warnings.length ? "mt-4" : "", children: "\u0420\u040E\u0420\u0406\u0421\u040F\u0420\u00B7\u0420\u0451" }), _jsx("div", { className: "space-y-2", children: presentation.diagnostics.suggestions.map((suggestion) => (_jsx(SuggestionRow, { suggestion: suggestion }, suggestion.id))) })] })) : null] }), _jsxs(InsightCard, { title: "\u0420\u045A\u0420\u0455\u0420\u0405\u0420\u0451\u0421\u201A\u0420\u0455\u0421\u0402\u0420\u0451\u0420\u0405\u0420\u0456", className: hasMonitoring ? "" : "hidden", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsx(StatPill, { label: "\u0420\u040E\u0420\u0455\u0420\u00B1\u0421\u2039\u0421\u201A\u0420\u0451\u0421\u040F", value: `${presentation.monitoring.events.length}` }), _jsx(StatPill, { label: "\u0420\u045E\u0421\u0402\u0420\u00B5\u0420\u0406\u0420\u0455\u0420\u0456\u0420\u0451", value: `${presentation.monitoring.sensorAlerts.length}` })] }), presentation.monitoring.sensorAlerts.length ? (_jsxs(_Fragment, { children: [_jsx(SectionTitle, { className: "mt-4", children: "\u0420\u201D\u0420\u00B0\u0421\u201A\u0421\u2021\u0420\u0451\u0420\u0454\u0420\u0451" }), _jsx("div", { className: "space-y-2", children: presentation.monitoring.sensorAlerts.map((alert) => (_jsxs("div", { className: "flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2", children: [_jsx("span", { className: "min-w-0 truncate font-semibold text-[color:var(--text-base)]", children: alert.label }), _jsx("span", { className: sensorAlertClass(alert.status), children: alert.value })] }, alert.id))) })] })) : null, presentation.monitoring.events.length ? (_jsxs(_Fragment, { children: [_jsx(SectionTitle, { className: presentation.monitoring.sensorAlerts.length ? "mt-4" : "", children: "\u0420\u040E\u0420\u0455\u0420\u00B1\u0421\u2039\u0421\u201A\u0420\u0451\u0421\u040F" }), _jsx("div", { className: "flex flex-wrap gap-2", children: presentation.monitoring.events.map((event) => (_jsx(EventBadge, { event: event }, event.id))) })] })) : null] })] })] }));
}
function MetricCard({ label, value, detail }) {
    return (_jsxs("article", { className: "ui-metric flex min-h-[118px] flex-col justify-between rounded-[18px] p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]", children: label }), _jsxs("div", { children: [_jsx("p", { className: "mt-2 text-2xl font-semibold text-[color:var(--text-base)]", children: value }), _jsx("p", { className: "mt-1 text-xs leading-5 text-[color:var(--text-soft)]", children: detail })] })] }));
}
function InsightCard({ title, subtitle, children, className = "", }) {
    return (_jsxs("article", { className: `ui-metric flex min-h-[260px] flex-col rounded-[18px] p-3 ${className}`.trim(), children: [_jsxs("div", { className: "mb-3", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: title }), subtitle ? _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: subtitle }) : null] }), _jsx("div", { className: "min-h-0 flex-1", children: children })] }));
}
function SectionTitle({ children, className = "" }) {
    return (_jsx("p", { className: `mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)] ${className}`.trim(), children: children }));
}
function StatPill({ label, value }) {
    return (_jsxs("div", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2", children: [_jsx("p", { className: "text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]", children: label }), _jsx("p", { className: "mt-1 text-sm font-semibold text-[color:var(--text-base)]", children: value })] }));
}
function WarningRow({ warning }) {
    return (_jsx("div", { className: `rounded-xl border px-3 py-2 text-sm ${warning.severity === "error"
            ? "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]/80 text-[color:var(--danger-fg)]"
            : "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"}`, children: warning.message }));
}
function SuggestionRow({ suggestion }) {
    return (_jsxs("div", { className: `rounded-xl border px-3 py-2 ${suggestion.status === "compatible"
            ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]/80"
            : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]/80"}`, children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "min-w-0 truncate font-semibold text-[color:var(--text-base)]", children: suggestion.title }), _jsx(ToneBadge, { tone: suggestion.status === "compatible" ? "success" : "danger", children: suggestion.status === "compatible" ? "РґРѕРїСѓСЃС‚РёРјРѕ" : "РєРѕРЅС„Р»РёРєС‚" })] }), _jsxs("p", { className: "mt-1 text-[11px] font-medium text-[color:var(--text-soft)]", children: [formatNumber(suggestion.distance_m, 2), " \u0420\u0458"] })] }));
}
function EventBadge({ event }) {
    const toneClass = event.severity === "critical"
        ? "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]"
        : event.severity === "warning"
            ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"
            : "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]";
    return _jsx("span", { className: `rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClass}`, children: event.label });
}
function ToneBadge({ tone, children }) {
    const className = tone === "success"
        ? "bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
        : tone === "danger"
            ? "bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]"
            : "bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]";
    return _jsx("span", { className: `shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`, children: children });
}
function sensorAlertClass(status) {
    return status === "alarm"
        ? "shrink-0 font-semibold text-[color:var(--danger-fg)]"
        : "shrink-0 font-semibold text-[color:var(--warning-fg)]";
}
function formatBranchPressure(estimatedPressureDropPa, availablePressurePa) {
    if (availablePressurePa != null && availablePressurePa > 0) {
        return `О”p ${formatPa(estimatedPressureDropPa)} / P ${formatPa(availablePressurePa)}`;
    }
    return `О”p ${formatPa(estimatedPressureDropPa)}`;
}
function branchPressureClass(estimatedPressureDropPa, availablePressurePa) {
    if (availablePressurePa != null && availablePressurePa > 0 && estimatedPressureDropPa > availablePressurePa * 1.05) {
        return "text-[color:var(--danger-fg)]";
    }
    if (availablePressurePa != null && availablePressurePa > 0 && estimatedPressureDropPa > availablePressurePa * 0.9) {
        return "text-[color:var(--warning-fg)]";
    }
    return "text-[color:var(--text-soft)]";
}
function formatPower(value) {
    return value >= 1000 ? `${formatNumber(value / 1000, 1)} РєР’С‚` : `${formatNumber(value, 0)} Р’С‚`;
}
function formatPa(value) {
    return `${formatNumber(value, 0)} РџР°`;
}
function formatMeters(value) {
    return formatNumber(value, 1);
}
function formatNumber(value, maximumFractionDigits) {
    return new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 0,
        maximumFractionDigits,
    }).format(value);
}
export default NetworkSystemsPanel;
