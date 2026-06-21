import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import Tooltip from "../../../shared/ui/Tooltip";
import { BuildToolButton } from "./BuildToolButton";
function ActionButton({ button }) {
    const control = (_jsx(BuildToolButton, { block: true, variant: button.disabled ? "disabled" : button.active ? "active" : "default", onClick: button.onClick, className: "flex w-full items-center justify-between text-left", children: _jsx("span", { className: "truncate", children: button.label }) }));
    if (!button.tooltip) {
        return control;
    }
    return (_jsx(Tooltip, { className: "w-full", title: button.tooltip.title, description: button.disabled ? button.disabledReason ?? button.tooltip.description : button.tooltip.description, children: control }));
}
function CollapsibleGroup({ title, defaultOpen, accent, buttons, }) {
    const [open, setOpen] = useState(Boolean(defaultOpen));
    return (_jsxs("section", { className: "ui-panel overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => setOpen((value) => !value), className: "flex w-full items-center justify-between px-3 py-3 text-left", children: [_jsx("p", { className: `text-[11px] font-semibold uppercase tracking-[0.18em] ${accent}`, children: title }), _jsx("span", { className: "text-[color:var(--text-soft)]", children: open ? "−" : "+" })] }), open ? (_jsx("div", { className: "grid gap-2 border-t border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-3", children: buttons.map((button) => (_jsx(ActionButton, { button: button }, button.id))) })) : null] }));
}
export function LeftToolbar({ activeViewport, hasHeatmap, canUndo, canRedo, snapEnabled, orthogonalMode, adjacencyOverlay, loopDebugOverlay, showHelp, onViewportChange, onUndo, onRedo, onToggleSnap, onToggleOrthogonal, onToggleAdjacency, onToggleLoopDebug, onToggleHelp, onZoomToFit, onImportIfc, onImportRevit, onExportPng, onCaptureViewSnapshot, onCreateProjectSnapshot, onOpenValidation, onOpenFormulas, }) {
    const analysisButtons = useMemo(() => [
        {
            id: "validation",
            label: "Проверка модели",
            onClick: onOpenValidation,
            tooltip: {
                title: "Проверка модели",
                description: "Список проблем модели и быстрых исправлений.",
            },
        },
        {
            id: "formulas",
            label: "Формулы",
            onClick: onOpenFormulas,
            tooltip: {
                title: "Формулы",
                description: "Панель инженерных формул и обозначений.",
            },
        },
        {
            id: "results",
            label: "Результаты",
            active: activeViewport === "results",
            onClick: () => onViewportChange("results"),
            tooltip: {
                title: "Результаты",
                description: "Тепловой расчет, сценарии, калибровка и анализ неопределенности.",
            },
        },
        {
            id: "help",
            label: showHelp ? "Подсказки: вкл." : "Подсказки: выкл.",
            active: showHelp,
            onClick: onToggleHelp,
            tooltip: {
                title: "Подсказки",
                description: "Короткие пояснения по текущему инструменту.",
            },
        },
    ], [activeViewport, onOpenFormulas, onOpenValidation, onToggleHelp, onViewportChange, showHelp]);
    const fileButtons = useMemo(() => [
        {
            id: "import-ifc",
            label: "Импорт IFC",
            onClick: onImportIfc,
            tooltip: {
                title: "Импорт IFC",
                description: "Загрузить внешнюю BIM-модель в формате IFC.",
            },
        },
        {
            id: "import-rvt",
            label: "Импорт Revit",
            onClick: onImportRevit,
            tooltip: {
                title: "Импорт Revit",
                description: "Открыть сценарий импорта модели Revit через IFC.",
            },
        },
        {
            id: "capture-view",
            label: "Кадр вида",
            onClick: onCaptureViewSnapshot,
            tooltip: {
                title: "Кадр вида",
                description: "Сохранить изображение текущего плана или 3D-вида.",
            },
        },
        {
            id: "project-snapshot",
            label: "Версия проекта",
            onClick: onCreateProjectSnapshot,
            tooltip: {
                title: "Версия проекта",
                description: "Сохранить текущее состояние модели и результатов.",
            },
        },
        {
            id: "export-png",
            label: "Экспорт PNG",
            onClick: onExportPng,
            tooltip: {
                title: "Экспорт PNG",
                description: "Экспортировать активный вид в PNG.",
            },
        },
    ], [onCaptureViewSnapshot, onCreateProjectSnapshot, onExportPng, onImportIfc, onImportRevit]);
    const navigationButtons = useMemo(() => [
        {
            id: "undo",
            label: "Отменить",
            disabled: !canUndo,
            disabledReason: "Нет действий для отмены.",
            onClick: onUndo,
            tooltip: {
                title: "Отменить",
                description: "Вернуть предыдущее состояние модели.",
            },
        },
        {
            id: "redo",
            label: "Повторить",
            disabled: !canRedo,
            disabledReason: "Нет действий для повтора.",
            onClick: onRedo,
            tooltip: {
                title: "Повторить",
                description: "Повторить отмененное действие.",
            },
        },
        {
            id: "fit",
            label: "Показать все",
            onClick: onZoomToFit,
            tooltip: {
                title: "Показать все",
                description: "Отцентрировать сцену и подобрать масштаб.",
            },
        },
        {
            id: "snap-grid",
            label: `Привязка: ${snapEnabled ? "вкл." : "выкл."}`,
            active: snapEnabled,
            onClick: onToggleSnap,
            tooltip: {
                title: "Привязка к сетке",
                description: "Фиксировать точки построения по шагу сетки.",
            },
        },
        {
            id: "ortho",
            label: `Ортогональность: ${orthogonalMode ? "вкл." : "выкл."}`,
            active: orthogonalMode,
            onClick: onToggleOrthogonal,
            tooltip: {
                title: "Ортогональный режим",
                description: "Ограничить построение углами 0° и 90°.",
            },
        },
        {
            id: "adjacency",
            label: `Соседства: ${adjacencyOverlay ? "показать" : "скрыть"}`,
            active: adjacencyOverlay,
            onClick: onToggleAdjacency,
            tooltip: {
                title: "Граф соседств",
                description: "Показать связи между соседними помещениями.",
            },
        },
        {
            id: "loops",
            label: `Контуры: ${loopDebugOverlay ? "вкл." : "выкл."}`,
            active: loopDebugOverlay,
            onClick: onToggleLoopDebug,
            tooltip: {
                title: "Контуры комнат",
                description: "Показать найденные циклы стен и вершины контуров.",
            },
        },
        {
            id: "heatmap",
            label: hasHeatmap ? "Теплокарта готова" : "Теплокарта недоступна",
            active: hasHeatmap && activeViewport === "results",
            disabled: !hasHeatmap,
            disabledReason: "Сначала выполните расчет, чтобы появилась теплокарта.",
            onClick: () => onViewportChange("results"),
            tooltip: {
                title: "Теплокарта",
                description: "Тепловое поле станет доступно после расчета.",
            },
        },
    ], [
        activeViewport,
        adjacencyOverlay,
        canRedo,
        canUndo,
        hasHeatmap,
        loopDebugOverlay,
        onRedo,
        onToggleAdjacency,
        onToggleLoopDebug,
        onToggleOrthogonal,
        onToggleSnap,
        onUndo,
        onViewportChange,
        onZoomToFit,
        orthogonalMode,
        snapEnabled,
    ]);
    return (_jsxs("aside", { className: "flex h-full flex-col gap-3 overflow-y-auto pr-1", children: [_jsx(CollapsibleGroup, { title: "\u0410\u043D\u0430\u043B\u0438\u0437", accent: "text-[color:var(--success-fg)]", defaultOpen: true, buttons: analysisButtons }), _jsx(CollapsibleGroup, { title: "\u0424\u0430\u0439\u043B", accent: "text-[color:var(--warning-fg)]", buttons: fileButtons }), _jsx(CollapsibleGroup, { title: "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F", accent: "text-[color:var(--info-fg)]", defaultOpen: true, buttons: navigationButtons })] }));
}
export default LeftToolbar;
