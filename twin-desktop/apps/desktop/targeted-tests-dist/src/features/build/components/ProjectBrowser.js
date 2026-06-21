import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { describeLevel, describeRoom, getDuctDisplayLabel, getEquipmentDisplayLabel, getPipeDisplayLabel, getSensorDisplayLabel, getWallDisplayLabel, getWindowDisplayLabel, getDoorDisplayLabel, } from "../utils/entityLabels";
import { firstDisplayText } from "../../../shared/utils/displayText";
const groupLabel = {
    room: "Помещения",
    wall: "Стены",
    door: "Двери",
    window: "Окна",
    pipe: "Трубы",
    duct: "Воздуховоды",
    equipment: "Оборудование",
    sensor: "Датчики",
};
function groupKey(levelId, kind) {
    return `${levelId}:${kind}`;
}
function resolveSelectionLevelId(model, selection) {
    if (!selection) {
        return null;
    }
    switch (selection.kind) {
        case "room":
            return model.rooms.find((room) => room.id === selection.id)?.levelId ?? null;
        case "wall":
            return model.walls.find((wall) => wall.id === selection.id)?.levelId ?? null;
        case "door": {
            const door = model.doors.find((entry) => entry.id === selection.id);
            if (!door?.anchor.wallId) {
                return null;
            }
            return model.walls.find((wall) => wall.id === door.anchor.wallId)?.levelId ?? null;
        }
        case "window": {
            const window = model.windows.find((entry) => entry.id === selection.id);
            if (!window?.anchor.wallId) {
                return null;
            }
            return model.walls.find((wall) => wall.id === window.anchor.wallId)?.levelId ?? null;
        }
        case "pipe":
            return model.pipes.find((pipe) => pipe.id === selection.id)?.levelId ?? null;
        case "duct":
            return model.ducts.find((duct) => duct.id === selection.id)?.levelId ?? null;
        case "equipment":
            return model.equipment.find((item) => item.id === selection.id)?.levelId ?? null;
        case "sensor":
            return model.sensors.find((item) => item.id === selection.id)?.levelId ?? null;
        default:
            return null;
    }
}
function isNodeKind(kind) {
    return kind in groupLabel;
}
export function ProjectBrowser({ model, activeLevelId, selection, embedded = false, onSelect, onLevelSelect, onFocusViewport, }) {
    const tree = useMemo(() => model.levels.map((level) => {
        const rooms = model.rooms.filter((room) => room.levelId === level.id);
        const walls = model.walls.filter((wall) => wall.levelId === level.id);
        const doors = model.doors.filter((door) => door.anchor.wallId && walls.some((wall) => wall.id === door.anchor.wallId));
        const windows = model.windows.filter((window) => window.anchor.wallId && walls.some((wall) => wall.id === window.anchor.wallId));
        const pipes = model.pipes.filter((pipe) => pipe.levelId === level.id);
        const ducts = model.ducts.filter((duct) => duct.levelId === level.id);
        const equipment = model.equipment.filter((item) => item.levelId === level.id);
        const sensors = model.sensors.filter((item) => item.levelId === level.id);
        return { level, rooms, walls, doors, windows, pipes, ducts, equipment, sensors };
    }), [model]);
    const handleFocus = (callback, target) => {
        callback();
        onFocusViewport(target);
    };
    const isSelected = (target) => Boolean(selection && target && selection.kind === target.kind && selection.id === target.id);
    const [expandedGroups, setExpandedGroups] = useState(() => new Set());
    const [expandedLevels, setExpandedLevels] = useState(() => new Set());
    useEffect(() => {
        if (!selection || !isNodeKind(selection.kind)) {
            return;
        }
        const levelId = resolveSelectionLevelId(model, selection);
        if (!levelId) {
            return;
        }
        setExpandedLevels((prev) => {
            if (prev.has(levelId)) {
                return prev;
            }
            const next = new Set(prev);
            next.add(levelId);
            return next;
        });
        const key = groupKey(levelId, selection.kind);
        setExpandedGroups((prev) => {
            if (prev.has(key)) {
                return prev;
            }
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, [model, selection]);
    const toggleGroup = (levelId, kind) => {
        const key = groupKey(levelId, kind);
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            }
            else {
                next.add(key);
            }
            return next;
        });
    };
    const toggleLevel = (levelId) => {
        setExpandedLevels((prev) => {
            const next = new Set(prev);
            if (next.has(levelId)) {
                next.delete(levelId);
            }
            else {
                next.add(levelId);
            }
            return next;
        });
    };
    return (_jsxs("section", { className: embedded ? "min-w-0" : "ui-panel min-w-0 p-3.5", children: [_jsxs("header", { className: embedded ? "mb-2.5 min-w-0" : "mb-3 min-w-0", children: [!embedded ? _jsx("p", { className: "ui-kicker", children: "\u041F\u0440\u043E\u0432\u043E\u0434\u043D\u0438\u043A" }) : null, _jsx("button", { type: "button", onClick: () => onFocusViewport(null), className: `block w-full truncate text-left font-semibold text-[color:var(--text-base)] transition hover:text-[color:var(--accent-base)] ${embedded ? "text-[13px] leading-tight" : "mt-1 text-sm"}`, children: firstDisplayText([model.meta?.name], "Здание") }), _jsxs("div", { className: `flex flex-wrap gap-1 ${embedded ? "mt-1.5" : "mt-2"}`, children: [_jsxs("span", { className: "ui-build-badge", children: [model.levels.length, " \u0443\u0440."] }), _jsxs("span", { className: "ui-build-badge", children: [model.rooms.length, " \u043F\u043E\u043C."] }), _jsxs("span", { className: "ui-build-badge", children: [model.walls.length, " \u0441\u0442\u0435\u043D"] }), _jsxs("span", { className: "ui-build-badge ui-build-badge--info", children: [model.pipes.length + model.ducts.length, " \u0441\u0435\u0442\u0435\u0439"] })] })] }), _jsx("div", { className: "space-y-2 text-sm", children: tree.map(({ level, rooms, walls, doors, windows, pipes, ducts, equipment, sensors }) => {
                    const levelExpanded = expandedLevels.has(level.id);
                    const levelItemCount = rooms.length +
                        walls.length +
                        doors.length +
                        windows.length +
                        pipes.length +
                        ducts.length +
                        equipment.length +
                        sensors.length;
                    return (_jsxs("div", { className: "min-w-0 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]/70 p-1", children: [_jsxs("div", { className: "flex min-w-0 items-stretch gap-0.5", children: [_jsx("button", { type: "button", "aria-expanded": levelExpanded, "aria-label": levelExpanded ? "Свернуть уровень" : "Развернуть уровень", onClick: () => toggleLevel(level.id), className: "ui-control-quiet flex w-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold text-[color:var(--text-soft)]", children: levelExpanded ? "−" : "+" }), _jsxs("button", { type: "button", onClick: () => handleFocus(() => onLevelSelect(level.id), null), className: `flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[12px] px-2 py-2 text-left text-xs font-semibold transition ${activeLevelId === level.id
                                            ? "border border-[color:var(--accent-muted)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)] shadow-[var(--shadow-control)]"
                                            : "border border-transparent text-[color:var(--text-muted)] hover:bg-[color:var(--surface-elevated)]"}`, children: [_jsx("span", { className: "truncate", children: describeLevel(level, model.levels.findIndex((item) => item.id === level.id)) }), _jsxs("span", { className: `shrink-0 text-[10px] ${activeLevelId === level.id ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-soft)]"}`, children: [levelItemCount, " \u044D\u043B."] })] })] }), levelExpanded ? (_jsxs("ul", { className: "space-y-0.5 p-1.5 pt-1 text-[color:var(--text-muted)]", children: [renderGroup(level.id, "room", rooms), renderGroup(level.id, "wall", walls), renderGroup(level.id, "door", doors), renderGroup(level.id, "window", windows), renderGroup(level.id, "pipe", pipes), renderGroup(level.id, "duct", ducts), renderGroup(level.id, "equipment", equipment), renderGroup(level.id, "sensor", sensors)] })) : null] }, level.id));
                }) })] }));
    function renderGroup(levelId, kind, items) {
        if (!items.length) {
            return null;
        }
        const key = groupKey(levelId, kind);
        const expanded = expandedGroups.has(key);
        const hasSelectedChild = items.some((item) => isSelected({ kind, id: item.id }));
        return (_jsxs("li", { className: "min-w-0", children: [_jsxs("button", { type: "button", "aria-expanded": expanded, onClick: () => toggleGroup(levelId, kind), className: `flex w-full min-w-0 items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition ${hasSelectedChild
                        ? "bg-[color:var(--accent-soft)]/60 text-[color:var(--text-base)]"
                        : "text-[color:var(--text-soft)] hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--text-muted)]"}`, children: [_jsx("span", { className: "w-4 shrink-0 text-center text-sm leading-none text-[color:var(--text-muted)]", children: expanded ? "−" : "+" }), _jsx("span", { className: "min-w-0 flex-1 truncate", children: groupLabel[kind] }), _jsx("span", { className: "ui-build-badge shrink-0", children: items.length })] }), expanded ? (_jsx("ul", { className: "mt-0.5 space-y-0.5 border-l border-[color:var(--border-soft)] py-0.5 pl-2 ml-2", children: items.map((item) => {
                        const target = { kind, id: item.id };
                        const active = isSelected(target);
                        const label = describeItem(kind, item);
                        return (_jsx("li", { children: _jsx("button", { type: "button", onClick: () => handleFocus(() => {
                                    if ("levelId" in item) {
                                        onLevelSelect(item.levelId);
                                    }
                                    onSelect(target);
                                }, target), className: `w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-2 py-1.5 text-left text-xs font-medium transition ${active
                                    ? "ui-control-active bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
                                    : "ui-control-quiet text-[color:var(--text-soft)] hover:text-[color:var(--text-muted)]"}`, children: label }) }, item.id));
                    }) })) : null] }));
    }
    function describeItem(kind, item) {
        switch (kind) {
            case "room":
                return describeRoom(item, model.rooms.findIndex((entry) => entry.id === item.id));
            case "wall":
                return getWallDisplayLabel(model, item.id);
            case "door":
                return getDoorDisplayLabel(model.doors, item.id);
            case "window":
                return getWindowDisplayLabel(model.windows, item.id);
            case "pipe":
                return getPipeDisplayLabel(model.pipes, item.id);
            case "duct":
                return getDuctDisplayLabel(model.ducts, item.id);
            case "equipment":
                return getEquipmentDisplayLabel(model.equipment, item.id);
            case "sensor":
                return getSensorDisplayLabel(model.sensors, item.id);
            default:
                return "Элемент";
        }
    }
}
export default ProjectBrowser;
