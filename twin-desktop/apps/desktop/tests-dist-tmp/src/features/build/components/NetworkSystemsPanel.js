import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { EQUIPMENT_TYPE_LABELS, PIPE_TYPE_LABELS } from "../../../entities/networks/types";
import { buildHeatingModelSnapshot } from "../../../core/networks/index";
import { buildNetworkConnectivityWarnings } from "../networks/connectivity";
import { getEquipmentDisplayName } from "../utils/entityLabels";
export function NetworkSystemsPanel({ model, snapshot, onSetActiveScenario }) {
    const heatingSnapshot = buildHeatingModelSnapshot(model);
    const activeEvents = snapshot.events.slice(0, 4);
    const hottestRooms = [...snapshot.roomStates]
        .sort((left, right) => right.temperatureC - left.temperatureC)
        .slice(0, 4);
    const sensorAlerts = snapshot.sensorStates.filter((sensor) => sensor.status !== "normal").slice(0, 4);
    const connectionSuggestions = snapshot.suggestedConnections.slice(0, 6);
    const connectivityWarnings = buildNetworkConnectivityWarnings(model).slice(0, 6);
    const equipmentLabel = (equipmentId) => getEquipmentDisplayName(equipmentId, model.equipment);
    return (_jsxs("section", { className: "ui-panel p-4 sm:p-5", children: [_jsxs("header", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]", children: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u044B" }), _jsx("h3", { className: "truncate text-base font-semibold text-[color:var(--text-base)]", children: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0441\u0435\u0442\u0435\u0439 \u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439" })] }), _jsxs("label", { className: "flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]", children: ["\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439", _jsxs("select", { value: model.activeScenarioId ?? "", onChange: (event) => onSetActiveScenario(event.target.value || null), className: "max-w-[220px] rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm normal-case tracking-normal text-[color:var(--text-base)]", children: [!model.scenarios.length ? _jsx("option", { value: "", children: "\u041D\u0435\u0442 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432" }) : null, model.scenarios.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] })] })] }), _jsxs("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(MetricCard, { label: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F", value: `${snapshot.roomStates.length}`, detail: "\u0432 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u043C\u043E\u0434\u0435\u043B\u0438" }), _jsx(MetricCard, { label: "\u0422\u0435\u043F\u043B\u043E\u0441\u0435\u0442\u0438", value: `${heatingSnapshot.systems.length}`, detail: `${heatingSnapshot.totalLength_m.toFixed(1)} м труб и ${heatingSnapshot.totalLoadW.toFixed(0)} Вт нагрузки` }), _jsx(MetricCard, { label: "\u0412\u043E\u0437\u0434\u0443\u0445\u043E\u0432\u043E\u0434\u044B", value: `${model.ducts.length}`, detail: `${snapshot.networkStates.filter((item) => item.kind === "duct").length} активных веток` }), _jsx(MetricCard, { label: "\u0421\u043E\u0431\u044B\u0442\u0438\u044F", value: `${activeEvents.length}`, detail: `${sensorAlerts.length} тревог по датчикам` }), _jsx(InsightCard, { title: "\u0421\u0432\u044F\u0437\u043D\u043E\u0441\u0442\u044C", subtitle: "\u041D\u0435\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044B\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u0438 \u043D\u0435\u043F\u043E\u043B\u043D\u044B\u0435 \u043A\u043E\u043D\u0442\u0443\u0440\u044B", children: connectivityWarnings.length ? (_jsx("ul", { className: "space-y-2", children: connectivityWarnings.map((warning) => (_jsx("li", { className: "rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-sm text-[color:var(--warning-fg)]", children: warning.message }, warning.id))) })) : (_jsx(EmptyState, { text: "\u042F\u0432\u043D\u044B\u0445 \u043F\u0440\u043E\u0431\u043B\u0435\u043C \u0441\u0432\u044F\u0437\u043D\u043E\u0441\u0442\u0438 \u043D\u0430 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043C\u043E\u0434\u0435\u043B\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E." })) })] }), _jsxs("div", { className: "mt-4 grid gap-3 xl:grid-cols-2", children: [_jsx(InsightCard, { title: "\u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0431\u0430\u043B\u0430\u043D\u0441", subtitle: "\u0421\u0430\u043C\u044B\u0435 \u0442\u0451\u043F\u043B\u044B\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F", children: hottestRooms.length ? (_jsx("ul", { className: "space-y-2", children: hottestRooms.map((room) => (_jsxs("li", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "min-w-0 truncate font-semibold text-[color:var(--text-base)]", children: room.roomName }), _jsxs("span", { className: "shrink-0", children: [room.temperatureC.toFixed(1), " \u00B0C"] })] }), _jsxs("div", { className: "mt-1 flex items-center justify-between gap-3 text-xs text-[color:var(--text-soft)]", children: [_jsxs("span", { className: "truncate", children: ["\u0423\u0441\u0442\u0430\u0432\u043A\u0430 ", room.setpointC.toFixed(1), " \u00B0C"] }), _jsxs("span", { className: "shrink-0", children: ["Q ", formatSigned(room.netHeatFlowW), " \u0412\u0442"] })] })] }, room.roomId))) })) : (_jsx(EmptyState, { text: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u043F\u0440\u043E\u0444\u0438\u043B\u044C." })) }), _jsx(InsightCard, { title: "\u0410\u0432\u0442\u043E\u0441\u0432\u044F\u0437\u0438", subtitle: "\u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0435 \u0438 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D\u043D\u044B\u0435 \u0441\u0432\u044F\u0437\u0438 \u0441\u0435\u0442\u0435\u0439", children: connectionSuggestions.length ? (_jsx("ul", { className: "space-y-2", children: connectionSuggestions.map((item) => (_jsxs("li", { className: `rounded-xl border px-3 py-2 ${connectionSuggestionClass(item.status)}`, children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("span", { className: "min-w-0 truncate font-semibold text-[color:var(--text-base)]", children: [item.networkKind === "pipe" ? "Труба" : "Воздуховод", " \u2192 ", equipmentLabel(item.equipmentId)] }), _jsx("span", { className: `shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${connectionSuggestionBadgeClass(item.status)}`, children: connectionSuggestionLabel(item.status) })] }), _jsx("p", { className: "mt-1 text-xs text-[color:var(--text-soft)]", children: item.status === "compatible"
                                            ? "Связь допустима по инженерной логике и предложена по близости на плане."
                                            : item.reason ?? "Связь отклонена: сеть и оборудование несовместимы." }), _jsxs("p", { className: "mt-1 text-[11px] font-medium text-[color:var(--text-soft)]", children: ["\u0420\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0434\u043E \u0442\u0440\u0430\u0441\u0441\u044B: ", item.distance_m.toFixed(2), " \u043C"] })] }, `${item.status}:${item.networkId}:${item.equipmentId}`))) })) : (_jsx(EmptyState, { text: "\u0411\u043B\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u044B\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u0431\u0443\u0434\u0443\u0442 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438." })) }), _jsxs(InsightCard, { title: "\u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435", subtitle: "\u0421\u0432\u043E\u0434\u043A\u0430 \u043F\u043E \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u043C \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u043C", children: [_jsx("ul", { className: "space-y-2", children: summarizeEquipment(model).map((entry) => (_jsxs("li", { className: "flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2", children: [_jsx("span", { className: "min-w-0 truncate text-[color:var(--text-muted)]", children: entry.label }), _jsx("span", { className: "shrink-0 font-semibold text-[color:var(--text-base)]", children: entry.value })] }, entry.label))) }), _jsxs("p", { className: "mt-3 max-h-10 overflow-hidden text-xs leading-5 text-[color:var(--text-soft)]", children: ["\u0422\u0440\u0443\u0431\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u044B: ", model.pipes.length ? [...new Set(model.pipes.map((pipe) => PIPE_TYPE_LABELS[pipe.type]))].join(", ") : "не заданы"] }), _jsxs("p", { className: "mt-2 max-h-12 overflow-hidden text-xs leading-5 text-[color:var(--text-soft)]", children: ["\u041E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u0435: ", heatingSnapshot.systems.length
                                        ? `${heatingSnapshot.systems.filter((system) => system.connected).length} из ${heatingSnapshot.systems.length} контуров связаны без висячих концов`
                                        : "контуры не сформированы"] })] }), _jsx(InsightCard, { title: "\u041C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433", subtitle: "\u0414\u0430\u0442\u0447\u0438\u043A\u0438 \u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u044F", children: sensorAlerts.length || activeEvents.length ? (_jsxs("div", { className: "space-y-2", children: [sensorAlerts.map((sensor) => (_jsx("div", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2", children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "min-w-0 truncate font-semibold text-[color:var(--text-base)]", children: sensor.label }), _jsx("span", { className: statusClass(sensor.status), children: sensor.value == null ? "—" : `${sensor.value.toFixed(1)} ${sensor.unit}` })] }) }, sensor.sensorId))), activeEvents.map((event) => (_jsx("div", { className: "rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-[color:var(--warning-fg)]", children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "min-w-0 truncate font-semibold", children: event.title }), _jsx("span", { className: "shrink-0 text-[11px] uppercase tracking-[0.18em]", children: severityLabel(event.severity) })] }) }, event.id)))] })) : (_jsx(EmptyState, { text: "\u041F\u043E\u0441\u043B\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432 \u0437\u0434\u0435\u0441\u044C \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u0438 \u0441\u043E\u0431\u044B\u0442\u0438\u044F." })) })] })] }));
}
function summarizeEquipment(model) {
    const counts = new Map();
    model.equipment.forEach((item) => {
        const label = EQUIPMENT_TYPE_LABELS[item.type];
        counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    if (!counts.size) {
        return [{ label: "Оборудование", value: "0" }];
    }
    return [...counts.entries()].map(([label, count]) => ({ label, value: `${count}` }));
}
function MetricCard({ label, value, detail }) {
    return (_jsxs("article", { className: "ui-metric flex min-h-[118px] flex-col justify-between rounded-[18px] p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]", children: label }), _jsxs("div", { children: [_jsx("p", { className: "mt-2 text-2xl font-semibold text-[color:var(--text-base)]", children: value }), _jsx("p", { className: "mt-1 max-h-10 overflow-hidden text-xs leading-5 text-[color:var(--text-soft)]", children: detail })] })] }));
}
function InsightCard({ title, subtitle, children, }) {
    return (_jsxs("article", { className: "ui-metric flex min-h-[260px] flex-col rounded-[18px] p-3", children: [_jsxs("div", { className: "mb-3", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: title }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: subtitle })] }), _jsx("div", { className: "min-h-0 flex-1", children: children })] }));
}
function EmptyState({ text }) {
    return (_jsx("div", { className: "flex h-full min-h-[180px] items-center rounded-[18px] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-4 text-sm text-[color:var(--text-soft)]", children: text }));
}
function formatSigned(value) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(0)}`;
}
function statusClass(status) {
    if (status === "alarm") {
        return "shrink-0 font-semibold text-[color:var(--danger-fg)]";
    }
    if (status === "warning") {
        return "shrink-0 font-semibold text-[color:var(--warning-fg)]";
    }
    return "shrink-0 font-semibold text-[color:var(--success-fg)]";
}
function severityLabel(severity) {
    switch (severity) {
        case "critical":
            return "критично";
        case "warning":
            return "внимание";
        default:
            return "норма";
    }
}
function connectionSuggestionClass(status) {
    return status === "compatible"
        ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]/80"
        : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]/80";
}
function connectionSuggestionBadgeClass(status) {
    return status === "compatible"
        ? "bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
        : "bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]";
}
function connectionSuggestionLabel(status) {
    return status === "compatible" ? "допустимо" : "запрещено";
}
export default NetworkSystemsPanel;
