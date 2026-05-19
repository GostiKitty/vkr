import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { filterSpaces, sortSpacesByArea } from "../../entities/space";
import { useTwinStore } from "../../entities/twin/twin.store";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { getSpaceDisplayName } from "../../shared/utils/roomNames";
import { formatTemperature, temperatureToColor } from "./twin.theme";
const skeletonItems = Array.from({ length: 5 });
export function SpaceList() {
    const spaces = useTwinStore((state) => state.twin?.spaces ?? []);
    const selectedId = useTwinStore((state) => state.selectedSpaceId);
    const selectSpace = useTwinStore((state) => state.selectSpace);
    const loading = useTwinStore((state) => state.loading);
    const frames = useTwinStore((state) => state.simulationFrames);
    const timeIndex = useTwinStore((state) => state.timeIndex);
    const [search, setSearch] = useState("");
    const [sortDir, setSortDir] = useState("desc");
    const currentTemps = frames[timeIndex]?.temperatures ?? {};
    const filteredSpaces = useMemo(() => {
        const filtered = filterSpaces(spaces, search);
        return sortSpacesByArea(filtered, sortDir);
    }, [spaces, search, sortDir]);
    const handleSortToggle = () => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    return (_jsxs("div", { className: "ui-panel p-4", children: [_jsxs("div", { className: "mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: loading ? "Загружаю…" : `${filteredSpaces.length} найдено` })] }), _jsxs("div", { className: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center", children: [_jsx("input", { type: "search", placeholder: "\u041D\u0430\u0439\u0442\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435", value: search, onChange: (event) => setSearch(event.target.value), className: "ui-field w-full px-3 py-2 text-sm shadow-inner" }), _jsxs("button", { type: "button", onClick: handleSortToggle, className: "ui-control px-3 py-2 text-sm font-medium", children: ["\u041F\u043B\u043E\u0449\u0430\u0434\u044C ", sortDir === "asc" ? "↑" : "↓"] })] })] }), loading ? (_jsx("div", { className: "space-y-3", children: skeletonItems.map((_, idx) => (_jsx("div", { className: "h-14 animate-pulse rounded-xl bg-[color:var(--surface-strong)]" }, idx))) })) : filteredSpaces.length === 0 ? (_jsx("div", { className: "rounded-xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-6 text-center text-sm text-[color:var(--text-muted)] transition-all duration-300", children: "\u041D\u0435\u0442 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439, \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0445 \u043F\u043E\u0434 \u0437\u0430\u043F\u0440\u043E\u0441." })) : (_jsx("div", { className: "flex flex-col gap-2", children: filteredSpaces.map((space, index) => {
                    const isSelected = space.id === selectedId;
                    const temperature = currentTemps[space.id];
                    const badgeColor = temperatureToColor(temperature);
                    const displayName = getSpaceDisplayName(space, index);
                    return (_jsxs("button", { type: "button", onClick: () => selectSpace(space.id), className: `group w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${isSelected
                            ? "border-[color:var(--accent-base)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)] shadow-[var(--accent-glow)]"
                            : "border-[color:var(--border-soft)] bg-[color:var(--surface-base)] text-[color:var(--text-muted)] hover:border-[color:var(--accent-base)]/35 hover:bg-[color:var(--surface-muted)]"}`, children: [_jsxs("div", { className: "flex items-center justify-between text-sm font-semibold text-[color:var(--text-base)]", children: [_jsx("span", { className: "truncate", children: displayName }), _jsx("span", { className: "text-xs text-[color:var(--text-soft)]", children: formatArea(space.area_m2) })] }), _jsxs("div", { className: "mt-1 flex items-center justify-between text-xs text-[color:var(--text-soft)]", children: [_jsx("span", { className: "truncate", children: space.level ?? "—" }), _jsx("span", { children: formatVolume(space.volume_m3) })] }), _jsxs("div", { className: "mt-2 flex items-center justify-between text-xs", children: [_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "text-[color:var(--text-soft)]", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430" }), _jsx("span", { className: "h-3 w-10 rounded-full ring-1 ring-[color:var(--border-base)]", style: { background: badgeColor } })] }), _jsx("span", { className: "text-sm font-semibold tabular-nums text-[color:var(--text-base)]", children: formatTemperature(temperature) })] })] }, space.id));
                }) }))] }));
}
export default SpaceList;
