import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import ThermalDisplayPanel from "./ThermalDisplayPanel";
const WORKFLOW_ITEMS = [
    { key: "navigation", label: "Навигация" },
    { key: "edit", label: "Редактирование" },
    { key: "draw", label: "Построение" },
];
const VIEWER_TOGGLES = [
    { key: "showRooms", label: "Помещения" },
    { key: "showWalls", label: "Стены" },
    { key: "showOpenings", label: "Проемы" },
    { key: "showNetworks", label: "Сети" },
    { key: "showEquipment", label: "Оборудование" },
    { key: "transparentWalls", label: "Прозрачные стены" },
];
const VIEW_PRESETS = [
    {
        id: "shell",
        label: "Оболочка",
        patch: {
            showRooms: true,
            showWalls: true,
            showOpenings: true,
            showNetworks: false,
            showEquipment: false,
            transparentWalls: false,
        },
    },
    {
        id: "networks",
        label: "Сети",
        patch: {
            showRooms: false,
            showWalls: true,
            showOpenings: true,
            showNetworks: true,
            showEquipment: true,
            transparentWalls: true,
        },
    },
    {
        id: "temperature",
        label: "Температура",
        patch: {
            showRooms: true,
            showWalls: true,
            showOpenings: true,
            showNetworks: false,
            showEquipment: false,
            transparentWalls: true,
        },
    },
    {
        id: "equipment",
        label: "Оборудование",
        patch: {
            showRooms: true,
            showWalls: true,
            showOpenings: false,
            showNetworks: false,
            showEquipment: true,
            transparentWalls: true,
        },
    },
];
const DEBUG_TOGGLES = [
    { key: "showWallJoinDebug", label: "Стыки стен" },
    { key: "showWallNormals", label: "Нормали стен" },
    { key: "showRoomContours", label: "Контуры помещений" },
    { key: "showThermalGrid", label: "Ячейки теплового поля" },
    { key: "showRadiatorInfluence", label: "Зоны радиаторов" },
    { key: "showCoolingZones", label: "Охлаждение у фасада" },
    { key: "showOpeningHosts", label: "Привязка проемов" },
];
export default function ThreeDControlPanel({ activeLevelName, selectedElementLabel, workflowMode, toolGuide, canFocusSelection, onWorkflowModeChange, onZoomToFit, onResetView, onTopView, onFocusSelection, onToggleFullscreen, onClose, viewer, onViewerChange, engineeringOverviewActive, onApplyEngineeringOverview, onResetEngineeringOverview, thermalDisplay, onThermalDisplayChange, hasSimulation, thermalPlaying, onToggleThermalPlaying, thermalTimeIndex, onThermalTimeIndexChange, thermalTimelineLength, thermalTimeLabel, thermalStatus, currentOutdoorTemperatureC, performance, showDevDebug, debug, onDebugChange, inspector, stableMode = false, }) {
    const timelineActive = thermalDisplay.mode === "transient" && thermalTimelineLength > 0;
    const [openSections, setOpenSections] = useState({
        context: true,
        view: true,
        thermal: true,
        inspector: false,
        debug: false,
    });
    useEffect(() => {
        if (selectedElementLabel || workflowMode === "draw") {
            setOpenSections((prev) => (prev.inspector ? prev : { ...prev, inspector: true }));
        }
    }, [selectedElementLabel, workflowMode]);
    const visibleLayerCount = useMemo(() => VIEWER_TOGGLES.reduce((count, item) => count + (viewer[item.key] ? 1 : 0), 0), [viewer]);
    const toggleSection = (section) => {
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };
    if (stableMode) {
        const thermalVisible = thermalDisplay.showSurfaceField ||
            thermalDisplay.showFloorField ||
            thermalDisplay.showContours ||
            thermalDisplay.showWallSurfaces;
        return (_jsxs("aside", { className: "ui-panel flex min-h-0 flex-col overflow-hidden rounded-[20px]", children: [_jsxs("div", { className: "flex items-center justify-between gap-3 border-b border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-4 py-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]", children: "3D" }), _jsx("p", { className: "mt-1 text-sm font-semibold text-[color:var(--text-base)]", children: "\u041E\u0431\u044A\u0435\u043C\u043D\u0430\u044F \u043C\u043E\u0434\u0435\u043B\u044C \u0437\u0434\u0430\u043D\u0438\u044F" })] }), _jsx("button", { type: "button", onClick: onClose, className: "ui-control rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-elevated)]", children: "\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C" })] }), _jsx("div", { className: "ui-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3", children: _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "ui-panel-muted rounded-[18px] p-4", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442" }), _jsx("p", { className: "mt-2 text-sm font-semibold text-[color:var(--text-base)]", children: activeLevelName || "Все уровни" }), selectedElementLabel ? (_jsx("p", { className: "mt-1 text-sm leading-5 text-[color:var(--text-muted)]", children: selectedElementLabel })) : null] }), _jsxs("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-2", children: [_jsx(ActionButton, { label: "\u0424\u043E\u043A\u0443\u0441 \u043D\u0430 \u043C\u043E\u0434\u0435\u043B\u044C", onClick: onZoomToFit }), _jsx(ActionButton, { label: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0438\u0434", onClick: onResetView }), _jsx(ActionButton, { label: "\u0412\u0438\u0434 \u0441\u0432\u0435\u0440\u0445\u0443", onClick: onTopView }), _jsx(ActionButton, { label: "\u041D\u0430 \u0432\u0435\u0441\u044C \u044D\u043A\u0440\u0430\u043D", onClick: onToggleFullscreen }), _jsx(ActionButton, { label: "\u0424\u043E\u043A\u0443\u0441 \u043D\u0430 \u0432\u044B\u0431\u043E\u0440\u0435", onClick: onFocusSelection, disabled: !canFocusSelection })] }), _jsxs("div", { className: "grid gap-2", children: [_jsx(ToggleCard, { label: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u0435\u0442\u0438", checked: viewer.showNetworks, onChange: (checked) => onViewerChange({ showNetworks: checked }) }), _jsx(ToggleCard, { label: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435", checked: viewer.showEquipment, onChange: (checked) => onViewerChange({ showEquipment: checked }) }), _jsx(ToggleCard, { label: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443", checked: thermalVisible, onChange: (checked) => onThermalDisplayChange({
                                            ...thermalDisplay,
                                            showSurfaceField: checked,
                                            showFloorField: checked,
                                            showContours: checked,
                                            showWallSurfaces: false,
                                        }) })] })] }) })] }));
    }
    return (_jsxs("aside", { className: "ui-panel flex min-h-0 flex-col overflow-hidden rounded-[20px]", children: [_jsxs("div", { className: "sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-4 py-3 backdrop-blur-sm", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]", children: "3D \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435" }), _jsx("p", { className: "mt-1 text-sm font-semibold text-[color:var(--text-base)]", children: "\u0421\u0446\u0435\u043D\u0430 \u0438 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u0430\u043D\u0430\u043B\u0438\u0437" })] }), _jsx("button", { type: "button", onClick: onClose, className: "ui-control rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-elevated)]", children: "\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C" })] }), _jsxs("div", { className: "ui-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3", children: [_jsxs(PanelSection, { title: "\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442", summary: selectedElementLabel ?? toolGuide.title, open: openSections.context, onToggle: () => toggleSection("context"), children: [_jsx("div", { className: "inline-flex rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-1", children: WORKFLOW_ITEMS.map((item) => (_jsx("button", { type: "button", onClick: () => onWorkflowModeChange(item.key), className: `rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${workflowMode === item.key
                                        ? "border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-base)] shadow-[0_10px_18px_-16px_rgba(15,23,42,0.7)]"
                                        : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--text-base)]"}`, children: item.label }, item.key))) }), _jsxs("div", { className: "mt-3 grid gap-2", children: [_jsx(InfoRow, { label: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C", value: activeLevelName }), _jsx(InfoRow, { label: "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442", value: toolGuide.title }), _jsx(InfoRow, { label: "\u0412\u044B\u0431\u043E\u0440", value: selectedElementLabel ?? "Ничего не выбрано" })] }), _jsx("p", { className: "mt-3 text-sm text-[color:var(--text-muted)]", children: toolGuide.description }), _jsx("p", { className: "mt-2 text-xs text-[color:var(--text-soft)]", children: toolGuide.hint })] }), _jsxs(PanelSection, { title: "\u0412\u0438\u0434 \u0438 \u0441\u043B\u043E\u0438", summary: `${visibleLayerCount}/${VIEWER_TOGGLES.length} слоя`, open: openSections.view, onToggle: () => toggleSection("view"), children: [_jsxs("div", { className: "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2", children: [_jsx(ActionButton, { label: "\u0424\u043E\u043A\u0443\u0441 \u043D\u0430 \u043C\u043E\u0434\u0435\u043B\u044C", onClick: onZoomToFit }), _jsx(ActionButton, { label: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0432\u0438\u0434", onClick: onResetView }), _jsx(ActionButton, { label: "\u0412\u0438\u0434 \u0441\u0432\u0435\u0440\u0445\u0443", onClick: onTopView }), _jsx(ActionButton, { label: "\u041D\u0430 \u0432\u0435\u0441\u044C \u044D\u043A\u0440\u0430\u043D", onClick: onToggleFullscreen }), _jsx(ActionButton, { label: "\u0424\u043E\u043A\u0443\u0441 \u043D\u0430 \u0432\u044B\u0431\u043E\u0440\u0435", onClick: onFocusSelection, disabled: !canFocusSelection })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [!stableMode ? (_jsx("button", { type: "button", onClick: engineeringOverviewActive ? onResetEngineeringOverview : onApplyEngineeringOverview, title: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0435 \u0441\u0435\u0442\u0438 \u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0432 \u0434\u0435\u043C\u043E\u043D\u0441\u0442\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u043C \u0432\u0438\u0434\u0435", className: `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${engineeringOverviewActive
                                            ? "border-[color:var(--accent-base)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                                            : "border-cyan-200/90 bg-cyan-50 text-cyan-900 hover:border-cyan-300 hover:bg-cyan-100"}`, children: engineeringOverviewActive ? "Сбросить обзор" : "Инженерный обзор" })) : null, VIEW_PRESETS.map((preset) => (_jsx("button", { type: "button", onClick: () => onViewerChange(preset.patch), className: "rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-base)]", children: preset.label }, preset.id)))] }), _jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: VIEWER_TOGGLES.map((item) => (_jsx(ToggleCard, { label: item.label, checked: Boolean(viewer[item.key]), onChange: (checked) => onViewerChange({ [item.key]: checked }) }, item.key))) })] }), _jsxs(PanelSection, { title: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430", summary: timelineActive ? thermalTimeLabel : `${currentOutdoorTemperatureC.toFixed(1)} °C`, open: openSections.thermal, onToggle: () => toggleSection("thermal"), children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: timelineActive ? "Расчетный таймлайн" : "Стационарный режим" }), _jsx("p", { className: "mt-1 text-xs text-[color:var(--text-soft)]", children: timelineActive
                                                    ? "Сцена использует активный кадр расчета."
                                                    : "Параметры управляют демонстрационным температурным полем в 3D." })] }), timelineActive ? (_jsx("button", { type: "button", onClick: onToggleThermalPlaying, className: `rounded-full px-3 py-1 text-[11px] font-semibold ${thermalPlaying ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"}`, children: thermalPlaying ? "Пауза" : "Пуск" })) : (_jsx("span", { className: "rounded-full bg-[color:var(--info-bg)] px-3 py-1 text-[11px] font-semibold text-[color:var(--info-fg)]", children: "\u0420\u0443\u0447\u043D\u043E\u0435 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435" }))] }), _jsxs("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: [_jsx(InfoRow, { label: "\u041D\u0430\u0440\u0443\u0436\u043D\u044B\u0439 \u0432\u043E\u0437\u0434\u0443\u0445", value: `${currentOutdoorTemperatureC.toFixed(1)} °C` }), _jsx(InfoRow, { label: "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A", value: timelineActive ? "Кадр расчета" : "Параметры отображения" })] }), timelineActive ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mt-3 flex items-center justify-between text-[11px] text-[color:var(--text-soft)]", children: [_jsx("span", { children: thermalTimeLabel }), _jsxs("span", { children: ["\u0428\u0430\u0433 ", thermalTimeIndex + 1, "/", thermalTimelineLength] })] }), _jsx("input", { type: "range", min: 0, max: Math.max(thermalTimelineLength - 1, 0), value: thermalTimeIndex, onChange: (event) => onThermalTimeIndexChange(Number(event.target.value)), className: "mt-2 w-full accent-[color:var(--warning-fg)]" })] })) : null, _jsx("div", { className: "mt-3 rounded-[14px] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-[11px] text-[color:var(--text-muted)]", children: thermalStatus }), _jsx("div", { className: "mt-3", children: _jsx(ThermalDisplayPanel, { options: thermalDisplay, hasSimulation: hasSimulation, onChange: onThermalDisplayChange }) })] }), _jsx(PanelSection, { title: "\u0421\u0432\u043E\u0439\u0441\u0442\u0432\u0430", summary: selectedElementLabel ?? toolGuide.title, open: openSections.inspector, onToggle: () => toggleSection("inspector"), children: inspector }), showDevDebug ? (_jsxs(PanelSection, { title: "\u041E\u0442\u043B\u0430\u0434\u043A\u0430", summary: performance ? `${performance.fps.toFixed(0)} FPS` : "off", open: openSections.debug, onToggle: () => toggleSection("debug"), children: [_jsxs("div", { className: "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2", children: [_jsx(InfoRow, { label: "FPS", value: performance ? performance.fps.toFixed(0) : "—" }), _jsx(InfoRow, { label: "\u041A\u0430\u0434\u0440, \u043C\u0441", value: performance ? performance.frameMs.toFixed(1) : "—" })] }), _jsx("div", { className: "mt-3 grid gap-2", children: DEBUG_TOGGLES.map((item) => (_jsx(ToggleCard, { label: item.label, checked: debug[item.key], onChange: (checked) => onDebugChange({ [item.key]: checked }) }, item.key))) })] })) : null] })] }));
}
function PanelSection({ title, summary, open, onToggle, children, }) {
    return (_jsxs("section", { className: "ui-panel-muted mb-3 overflow-hidden rounded-[18px] last:mb-0", children: [_jsxs("button", { type: "button", onClick: onToggle, className: "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[color:var(--surface-elevated)]/55", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: title }), _jsx("p", { className: "mt-1 truncate text-sm text-[color:var(--text-muted)]", children: summary })] }), _jsx("span", { className: `inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] text-sm text-[color:var(--text-soft)] transition ${open ? "rotate-180" : ""}`, "aria-hidden": "true", children: "\u2303" })] }), open ? _jsx("div", { className: "border-t border-[color:var(--border-soft)] px-4 py-4", children: children }) : null] }));
}
function ActionButton({ label, onClick, disabled = false }) {
    return (_jsx("button", { type: "button", onClick: onClick, disabled: disabled, className: "rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50", children: label }));
}
function ToggleCard({ label, checked, onChange, }) {
    return (_jsxs("label", { className: "flex items-center justify-between gap-3 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2", children: [_jsx("span", { className: "text-sm font-medium text-[color:var(--text-muted)]", children: label }), _jsx("button", { type: "button", role: "switch", "aria-checked": checked, onClick: () => onChange(!checked), className: `relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-[color:var(--accent-base)]" : "bg-[color:var(--surface-strong)]"}`, children: _jsx("span", { className: `inline-block h-5 w-5 transform rounded-full bg-[color:var(--surface-elevated)] transition ${checked ? "translate-x-5" : "translate-x-1"}` }) })] }));
}
function InfoRow({ label, value }) {
    return (_jsxs("div", { className: "flex items-center justify-between gap-3 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm", children: [_jsx("span", { className: "text-[color:var(--text-soft)]", children: label }), _jsx("span", { className: "font-semibold text-[color:var(--text-base)]", children: value })] }));
}
