import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildLevelName, getLevelDisplayLabel } from "../utils/entityLabels";
import { firstDisplayText } from "../../../shared/utils/displayText";
export function LevelsPanel({ levels, activeLevelId, onSelectLevel, onAddLevel, onUpdateLevel, onCopyLevelModel }) {
    const rootRef = useRef(null);
    const activeSummaryRef = useRef(null);
    const metricsGridRef = useRef(null);
    const [draftName, setDraftName] = useState("");
    const [draftElevation, setDraftElevation] = useState(3);
    const [draftHeight, setDraftHeight] = useState(3);
    const orderedLevels = useMemo(() => [...levels].sort((left, right) => left.elevation_m - right.elevation_m || left.height_m - right.height_m || left.id.localeCompare(right.id)), [levels]);
    const activeLevelIndex = useMemo(() => orderedLevels.findIndex((level) => level.id === activeLevelId), [activeLevelId, orderedLevels]);
    const activeLevel = activeLevelIndex >= 0 ? orderedLevels[activeLevelIndex] ?? null : null;
    const previousLevel = activeLevelIndex > 0 ? orderedLevels[activeLevelIndex - 1] ?? null : null;
    const nextLevel = activeLevelIndex >= 0 && activeLevelIndex < orderedLevels.length - 1 ? orderedLevels[activeLevelIndex + 1] ?? null : null;
    const nextLevelName = useMemo(() => buildLevelName(levels.length + 1), [levels.length]);
    useEffect(() => {
        const root = rootRef.current;
        const summary = activeSummaryRef.current;
        const grid = metricsGridRef.current;
        if (!root || !summary || !grid) {
            return;
        }
        const block = root.closest(".ui-build-sidebar-block");
        const previousBlock = block?.previousElementSibling;
        const previousSection = root.previousElementSibling;
        const rootRect = root.getBoundingClientRect();
        const blockRect = block?.getBoundingClientRect();
        const previousRect = previousBlock?.getBoundingClientRect();
        const previousSectionRect = previousSection?.getBoundingClientRect();
        const summaryRect = summary.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();
        const cards = Array.from(grid.querySelectorAll("[data-level-metric]")).map((card) => {
            const rect = card.getBoundingClientRect();
            const label = card.querySelector("[data-level-metric-label]");
            const value = card.querySelector("[data-level-metric-value]");
            const labelRect = label?.getBoundingClientRect();
            const valueRect = value?.getBoundingClientRect();
            return {
                text: card.textContent?.trim() ?? "",
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                labelWidth: labelRect ? Math.round(labelRect.width) : null,
                labelScrollWidth: label instanceof HTMLElement ? label.scrollWidth : null,
                valueWidth: valueRect ? Math.round(valueRect.width) : null,
                valueScrollWidth: value instanceof HTMLElement ? value.scrollWidth : null,
                cardScrollWidth: card instanceof HTMLElement ? card.scrollWidth : null,
            };
        });
        // #region agent log
        fetch("http://127.0.0.1:7637/ingest/4f7bb7c6-5696-42f7-857e-af01b8cf01ed", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "016eb9" },
            body: JSON.stringify({
                sessionId: "016eb9",
                runId: "levels-panel-initial",
                hypothesisId: "H1,H2,H3,H4,H5",
                location: "src/features/build/components/LevelsPanel.tsx:layout-effect",
                message: "LevelsPanel active summary metrics",
                data: {
                    levelsCount: levels.length,
                    activeLevelId,
                    root: {
                        top: Math.round(rootRect.top),
                        left: Math.round(rootRect.left),
                        width: Math.round(rootRect.width),
                        paddingTop: window.getComputedStyle(root).paddingTop,
                    },
                    block: blockRect
                        ? {
                            top: Math.round(blockRect.top),
                            previousGap: previousRect ? Math.round(blockRect.top - previousRect.bottom) : null,
                            marginTop: block ? window.getComputedStyle(block).marginTop : null,
                            paddingTop: block ? window.getComputedStyle(block).paddingTop : null,
                            borderTopWidth: block ? window.getComputedStyle(block).borderTopWidth : null,
                        }
                        : null,
                    previousBlock: previousRect
                        ? {
                            bottom: Math.round(previousRect.bottom),
                            height: Math.round(previousRect.height),
                        }
                        : null,
                    previousSection: previousSectionRect
                        ? {
                            bottom: Math.round(previousSectionRect.bottom),
                            height: Math.round(previousSectionRect.height),
                            gapToRoot: Math.round(rootRect.top - previousSectionRect.bottom),
                            marginBottom: previousSection ? window.getComputedStyle(previousSection).marginBottom : null,
                        }
                        : null,
                    summaryWidth: Math.round(summaryRect.width),
                    gridWidth: Math.round(gridRect.width),
                    gridScrollWidth: grid.scrollWidth,
                    gridTemplateColumns: window.getComputedStyle(grid).gridTemplateColumns,
                    cards,
                },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion
    }, [activeLevelId, levels.length, orderedLevels]);
    const handleAdd = () => {
        const nextHeight = clampLevelHeight(Number(draftHeight) || 3);
        const nextElevation = Number.isFinite(draftElevation) ? draftElevation : 0;
        onAddLevel({
            name: firstDisplayText([draftName], nextLevelName, { allowInternalId: false }),
            elevation_m: nextElevation,
            height_m: nextHeight,
        });
        setDraftElevation(nextElevation + nextHeight);
        setDraftName("");
    };
    return (_jsxs("section", { ref: rootRef, className: "space-y-3", children: [activeLevel ? (_jsxs("div", { ref: activeSummaryRef, className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "ui-control-active rounded-full px-2.5 py-1 text-xs font-semibold", children: "\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C" }), _jsx("span", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: getLevelDisplayLabel({ levels: orderedLevels }, activeLevel.id) })] }), _jsxs("div", { ref: metricsGridRef, className: "grid gap-1.5 text-xs text-[color:var(--text-muted)]", children: [_jsxs("div", { "data-level-metric": true, className: "ui-metric flex items-center justify-between gap-3 rounded-[14px] px-3 py-2", children: [_jsx("p", { "data-level-metric-label": true, className: "ui-kicker text-[10px]", children: "\u041E\u0442\u043C\u0435\u0442\u043A\u0430" }), _jsxs("p", { "data-level-metric-value": true, className: "min-w-0 text-right font-semibold text-[color:var(--text-base)]", children: [activeLevel.elevation_m.toFixed(2), " \u043C"] })] }), _jsxs("div", { "data-level-metric": true, className: "ui-metric flex items-center justify-between gap-3 rounded-[14px] px-3 py-2", children: [_jsx("p", { "data-level-metric-label": true, className: "ui-kicker text-[10px]", children: "\u041D\u0438\u0436\u0435" }), _jsx("p", { "data-level-metric-value": true, className: "min-w-0 text-right font-semibold text-[color:var(--text-base)]", children: previousLevel ? getLevelDisplayLabel({ levels: orderedLevels }, previousLevel.id) : "Нет уровня" })] }), _jsxs("div", { "data-level-metric": true, className: "ui-metric flex items-center justify-between gap-3 rounded-[14px] px-3 py-2", children: [_jsx("p", { "data-level-metric-label": true, className: "ui-kicker text-[10px]", children: "\u0412\u044B\u0448\u0435" }), _jsx("p", { "data-level-metric-value": true, className: "min-w-0 text-right font-semibold text-[color:var(--text-base)]", children: nextLevel ? getLevelDisplayLabel({ levels: orderedLevels }, nextLevel.id) : "Нет уровня" })] })] })] })) : null, activeLevel && onCopyLevelModel && orderedLevels.length > 1 ? (_jsxs("div", { className: "space-y-1.5", children: [_jsx("p", { className: "ui-kicker text-[10px]", children: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u043B\u0430\u043D \u043D\u0430 \u0443\u0440\u043E\u0432\u0435\u043D\u044C" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: orderedLevels
                            .filter((level) => level.id !== activeLevelId)
                            .map((level) => (_jsx("button", { type: "button", onClick: () => onCopyLevelModel(level.id), className: "ui-control rounded-[12px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-2.5 py-1 text-xs font-medium text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]", children: getLevelDisplayLabel({ levels: orderedLevels }, level.id) }, level.id))) })] })) : null, _jsxs("div", { className: "space-y-2", children: [orderedLevels.map((level) => {
                        const isActive = level.id === activeLevelId;
                        const levelLabel = getLevelDisplayLabel({ levels: orderedLevels }, level.id);
                        return (_jsxs("button", { type: "button", onClick: () => onSelectLevel(level.id), className: `w-full rounded-[18px] border px-3 py-2.5 text-left transition ${isActive
                                ? "border-[color:var(--accent-base)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                                : "border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]"}`, children: [_jsxs("div", { className: "flex items-center justify-between text-sm font-semibold", children: [_jsx("input", { type: "text", value: levelLabel, onChange: (event) => onUpdateLevel(level.id, { name: event.target.value }), onClick: (event) => event.stopPropagation(), className: `w-full bg-transparent ${isActive ? "text-[color:var(--accent-contrast)] placeholder-[color:var(--accent-contrast)]/60" : "text-[color:var(--text-muted)]"}` }), _jsxs("span", { className: "ml-2 text-xs", children: [level.height_m.toFixed(2), " \u043C"] })] }), _jsxs("div", { className: `mt-2 grid grid-cols-2 gap-2 text-xs ${isActive ? "text-[color:var(--accent-contrast)]/80" : "text-[color:var(--text-soft)]"}`, onClick: (event) => event.stopPropagation(), children: [_jsxs("label", { className: "flex flex-col gap-1", children: [_jsx("span", { children: "\u041E\u0442\u043C., \u043C" }), _jsx("input", { type: "number", value: level.elevation_m, onChange: (event) => onUpdateLevel(level.id, { elevation_m: Number(event.target.value) }), className: `rounded-xl border px-2 py-1 text-xs ${isActive ? "border-[color:var(--accent-contrast)]/20 bg-[color:var(--accent-contrast)]/10 text-[color:var(--accent-contrast)]" : "ui-field text-[color:var(--text-muted)]"}` })] }), _jsxs("label", { className: "flex flex-col gap-1", children: [_jsx("span", { children: "\u0412\u044B\u0441\u043E\u0442\u0430" }), _jsx("input", { type: "number", value: level.height_m, onChange: (event) => onUpdateLevel(level.id, { height_m: clampLevelHeight(Number(event.target.value)) }), className: `rounded-xl border px-2 py-1 text-xs ${isActive ? "border-[color:var(--accent-contrast)]/20 bg-[color:var(--accent-contrast)]/10 text-[color:var(--accent-contrast)]" : "ui-field text-[color:var(--text-muted)]"}` })] })] })] }, level.id));
                    }), levels.length === 0 ? (_jsx("p", { className: "text-sm text-[color:var(--text-soft)]", children: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0443\u0440\u043E\u0432\u0435\u043D\u044C, \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C \u043C\u043E\u0434\u0435\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435." })) : null] }), _jsxs("div", { className: "mt-4 space-y-2", children: [_jsx("p", { className: "ui-kicker", children: "\u041D\u043E\u0432\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C" }), _jsx("input", { type: "text", value: draftName, onChange: (event) => setDraftName(event.target.value), className: "ui-field w-full px-3 py-2 text-sm", placeholder: nextLevelName }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u041E\u0442\u043C\u0435\u0442\u043A\u0430, \u043C", _jsx("input", { type: "number", value: draftElevation, onChange: (event) => setDraftElevation(Number(event.target.value)), className: "ui-field mt-1 w-full px-3 py-2 text-sm" })] }), _jsxs("label", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u0412\u044B\u0441\u043E\u0442\u0430, \u043C", _jsx("input", { type: "number", value: draftHeight, onChange: (event) => setDraftHeight(clampLevelHeight(Number(event.target.value))), className: "ui-field mt-1 w-full px-3 py-2 text-sm" })] })] }), _jsx("button", { type: "button", onClick: handleAdd, className: "ui-control w-full px-3 py-2 text-sm font-semibold", children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0440\u043E\u0432\u0435\u043D\u044C" })] })] }));
}
function clampLevelHeight(value) {
    if (!Number.isFinite(value)) {
        return 3;
    }
    return Math.max(0.5, value);
}
export default LevelsPanel;
