import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTwinStore } from "../../entities/twin/twin.store";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { getSpaceDisplayName } from "../../shared/utils/roomNames";
import { formatTemperature } from "./twin.theme";
export function SpaceDetails() {
    const selectedId = useTwinStore((state) => state.selectedSpaceId);
    const twin = useTwinStore((state) => state.twin);
    const loading = useTwinStore((state) => state.loading);
    const frames = useTwinStore((state) => state.simulationFrames);
    const timeIndex = useTwinStore((state) => state.timeIndex);
    const space = selectedId ? twin?.spaces?.find((item) => item.id === selectedId) ?? null : null;
    const currentTemp = selectedId ? frames[timeIndex]?.temperatures[selectedId] : null;
    const spaceIndex = space ? twin?.spaces?.findIndex((item) => item.id === space.id) ?? 0 : 0;
    return (_jsxs("div", { className: "ui-panel ui-hover-lift rounded-2xl p-4", children: [_jsx("h3", { className: "mb-3 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0414\u0435\u0442\u0430\u043B\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F" }), loading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 5 }).map((_, idx) => (_jsx("div", { className: "ui-skeleton h-10 rounded-xl" }, idx))) })) : !space ? (_jsx("div", { className: "animate-ui-pop rounded-xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-6 text-center text-sm text-[color:var(--text-muted)]", children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0434\u0435\u0442\u0430\u043B\u0438." })) : (_jsxs("dl", { className: "divide-y divide-[color:var(--border-soft)] text-sm text-[color:var(--text-muted)]", children: [_jsx(InfoRow, { label: "ID", value: space.id }), _jsx(InfoRow, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", value: getSpaceDisplayName(space, spaceIndex) }), _jsx(InfoRow, { label: "\u041F\u043E\u043B\u043D\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", value: space.long_name ?? "—" }), _jsx(InfoRow, { label: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C", value: space.level ?? "—" }), _jsx(InfoRow, { label: "\u041F\u043B\u043E\u0449\u0430\u0434\u044C", value: formatArea(space.area_m2) }), _jsx(InfoRow, { label: "\u041E\u0431\u044A\u0451\u043C", value: formatVolume(space.volume_m3) }), _jsx(InfoRow, { label: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430", value: formatTemperature(currentTemp) })] }))] }));
}
function InfoRow({ label, value }) {
    return (_jsxs("div", { className: "flex items-center justify-between gap-6 py-3 transition-colors hover:bg-[color:var(--surface-muted)]/60", children: [_jsx("dt", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: label }), _jsx("dd", { className: "text-right text-base font-medium tabular-nums text-[color:var(--text-base)]", children: value })] }));
}
export default SpaceDetails;
