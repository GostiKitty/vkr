import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import Tooltip from "../../../shared/ui/Tooltip";
import { EQUIPMENT_TYPE_LABELS } from "../../../entities/networks/types";
import { HEATING_NETWORK_DISPLAY_LABELS } from "../networks/displayModes";
import { ENGINEERING_SCHEMATIC_STYLE_LABELS, ENGINEERING_VISUALIZATION_LABELS, } from "../engineering/viewMode";
import { BuildToolButton } from "./BuildToolButton";
import { BuildToolIcon } from "./buildToolIcons";
import { ENGINEERING_EQUIPMENT_LABELS } from "../engineering2d/catalog";
import { listEnvelopePresets } from "../../../entities/envelope/envelopePresets";
function PaletteIconButton({ icon, label, title, description, active, onClick, tone = "default" }) {
    return (_jsx(Tooltip, { title: title, description: description, className: "inline-flex shrink-0", children: _jsx(BuildToolButton, { variant: active ? "active" : "default", tone: tone, "aria-label": label, onClick: onClick, className: "inline-flex h-10 w-10 shrink-0 items-center justify-center !px-0 !py-0 text-[color:var(--text-base)]", children: _jsx(BuildToolIcon, { name: icon, className: "h-[18px] w-[18px]" }) }) }));
}
function PaletteSidebarButton({ icon, label, title, description, active, onClick, tone = "default" }) {
    return (_jsx(Tooltip, { title: title, description: description, className: "block w-full min-w-0", children: _jsxs(BuildToolButton, { variant: active ? "active" : "default", tone: tone, block: true, "aria-label": title, onClick: onClick, className: `flex min-w-0 items-center gap-2 !px-2 !py-1.5 text-left text-[11px] leading-tight ${active ? "" : "!bg-[color:var(--surface-elevated)]/80"}`, children: [_jsx("span", { className: `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border ${active
                        ? "border-[color:var(--accent-muted)]/60 bg-[color:var(--accent-soft)]"
                        : "border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]"}`, children: _jsx(BuildToolIcon, { name: icon, className: "h-3.5 w-3.5" }) }), _jsx("span", { className: "min-w-0 truncate font-semibold", children: label })] }) }));
}
function ToolDivider() {
    return _jsx("div", { className: "hidden h-7 w-px shrink-0 rounded-full bg-[color:var(--surface-strong)]/80 md:block", "aria-hidden": "true" });
}
function ToolbarGroup({ title, children }) {
    return (_jsxs("div", { className: "flex min-w-0 shrink-0 flex-nowrap items-center gap-2 rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-2 py-2", children: [_jsx("span", { className: "whitespace-nowrap px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-soft)]", children: title }), _jsx("div", { className: "flex min-w-0 flex-nowrap items-center gap-2", children: children })] }));
}
function SidebarSection({ title, children, columns = 1, }) {
    return (_jsxs("section", { className: "ui-build-sidebar-section", children: [_jsx("div", { className: "ui-build-sidebar-section__head", children: _jsx("p", { className: "ui-build-sidebar-section__title", children: title }) }), _jsx("div", { className: columns === 2 ? "ui-build-sidebar-tool-grid" : "ui-build-sidebar-tool-grid ui-build-sidebar-tool-grid--single", children: children })] }));
}
function ToolbarSelect({ label, value, options, onChange, }) {
    return (_jsxs("label", { className: "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-xs font-semibold text-[color:var(--text-soft)]", children: [_jsx("span", { children: label }), _jsx("select", { value: value, onChange: (event) => onChange(event.target.value), className: "ui-field min-w-[152px] rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--text-muted)]", children: options.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }));
}
function OverflowFade({ side, visible }) {
    if (!visible) {
        return null;
    }
    return (_jsx("div", { className: `pointer-events-none absolute bottom-0 top-0 hidden w-10 md:block ${side === "left"
            ? "left-0 bg-gradient-to-r from-[color:var(--surface-overlay)] via-[color:var(--surface-overlay)]/70 to-transparent"
            : "right-0 bg-gradient-to-l from-[color:var(--surface-overlay)] via-[color:var(--surface-overlay)]/70 to-transparent"}` }));
}
function EnvelopePresetToolbarSelect({ kind, value, onChange, }) {
    const options = listEnvelopePresets(kind).map((preset) => ({ value: preset.id, label: preset.name }));
    const labels = {
        wall: "Стена",
        window: "Окно",
        door: "Дверь",
        roof: "Кровля",
        slab: "Перекрытие",
    };
    return _jsx(ToolbarSelect, { label: labels[kind], value: value, options: options, onChange: onChange });
}
function SidebarPresetSelect({ kind, value, onChange, }) {
    const options = listEnvelopePresets(kind).map((preset) => ({ value: preset.id, label: preset.name }));
    const labels = {
        wall: "Тип стены",
        window: "Тип окна",
        door: "Тип двери",
        roof: "Тип кровли",
        slab: "Тип перекрытия",
    };
    return (_jsxs("label", { className: "block rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-xs font-semibold text-[color:var(--text-soft)]", children: [_jsx("span", { children: labels[kind] }), _jsx("select", { value: value, onChange: (event) => onChange(event.target.value), className: "ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--text-muted)]", children: options.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }));
}
export function BuildToolPalette({ variant, currentTool, activeViewport, equipmentPreset, engineeringEquipmentPreset, pipePreset, wallPreset, windowPreset, doorPreset, roofPreset, slabPreset, heatingDisplayMode, showNetworkFlowArrows, visualizationMode, schematicStyle, onToolChange, onViewportChange, onEquipmentPresetChange, onEngineeringEquipmentPresetChange, onPipePresetChange, onWallPresetChange, onWindowPresetChange, onDoorPresetChange, onRoofPresetChange, onSlabPresetChange, onHeatingDisplayModeChange, onShowNetworkFlowArrowsChange, onVisualizationModeChange, onSchematicStyleChange, onZoomToFit, onGenerateWallsFromRooms, onAddTypicalCtp, }) {
    const resultsMode = activeViewport === "results";
    const architectureMode = activeViewport === "plan" || activeViewport === "view3d";
    const networksMode = activeViewport === "networks" || activeViewport === "view3d";
    const scrollRef = useRef(null);
    const [overflowState, setOverflowState] = useState({ left: false, right: false });
    useEffect(() => {
        if (variant !== "top") {
            return;
        }
        const node = scrollRef.current;
        if (!node) {
            return;
        }
        const updateOverflow = () => {
            const maxScrollLeft = Math.max(node.scrollWidth - node.clientWidth, 0);
            setOverflowState({
                left: node.scrollLeft > 4,
                right: node.scrollLeft < maxScrollLeft - 4,
            });
        };
        updateOverflow();
        node.addEventListener("scroll", updateOverflow, { passive: true });
        window.addEventListener("resize", updateOverflow);
        return () => {
            node.removeEventListener("scroll", updateOverflow);
            window.removeEventListener("resize", updateOverflow);
        };
    }, [activeViewport, variant]);
    const heatingDisplayOptions = Object.entries(HEATING_NETWORK_DISPLAY_LABELS).map(([value, label]) => ({
        value,
        label,
    }));
    const visualizationOptions = Object.entries(ENGINEERING_VISUALIZATION_LABELS).map(([value, label]) => ({
        value,
        label,
    }));
    const schematicStyleOptions = Object.entries(ENGINEERING_SCHEMATIC_STYLE_LABELS).map(([value, label]) => ({
        value,
        label,
    }));
    const pickArchitectureViewport = () => {
        if (activeViewport === "view3d") {
            return;
        }
        onViewportChange("plan");
    };
    const pickNetworksViewport = () => {
        if (activeViewport === "view3d") {
            return;
        }
        onViewportChange("networks");
    };
    const commonButtons = {
        select: {
            icon: "cursor",
            label: "Выбор",
            title: "Курсор",
            description: "Выбор и редактирование уже созданных элементов.",
            active: currentTool === "select",
            onClick: () => onToolChange("select"),
        },
        move: {
            icon: "move",
            label: "Перемещение",
            title: "Перемещение",
            description: "Перемещение выбранных объектов в 3D.",
            active: currentTool === "move",
            onClick: () => onToolChange("move"),
        },
        erase: {
            icon: "erase",
            label: "Удаление",
            title: "Удаление",
            description: "Удаляет элемент под курсором или выбранный объект.",
            active: currentTool === "erase",
            onClick: () => onToolChange("erase"),
        },
    };
    const architectureButtons = [
        {
            icon: "roomRect",
            label: "Комната",
            title: "Комната (прямоугольник)",
            description: "Построение прямоугольной комнаты по двум точкам.",
            active: currentTool === "roomRect",
            onClick: () => {
                pickArchitectureViewport();
                onToolChange("roomRect");
            },
        },
        {
            icon: "roomContour",
            label: "Контур",
            title: "Комната (контур)",
            description: "Произвольный контур помещения по точкам.",
            active: currentTool === "room",
            onClick: () => {
                pickArchitectureViewport();
                onToolChange("room");
            },
        },
        {
            icon: "wall",
            label: "Стена",
            title: "Стена",
            description: "Построение сегмента стены на активном уровне.",
            active: currentTool === "wall",
            onClick: () => {
                pickArchitectureViewport();
                onToolChange("wall");
            },
        },
        {
            icon: "fillet",
            label: "Скругление",
            title: "Скругление углов",
            description: "Клик по стыку стен задаёт радиус закругления угла — видно на плане, в 3D и в расчёте площадей.",
            active: currentTool === "fillet",
            onClick: () => {
                pickArchitectureViewport();
                onToolChange("fillet");
            },
        },
        {
            icon: "roof",
            label: "Крыша",
            title: "Крыша",
            description: "Построение прямоугольной крыши по двум точкам.",
            active: currentTool === "roof",
            onClick: () => {
                pickArchitectureViewport();
                onToolChange("roof");
            },
        },
        {
            icon: "slab",
            label: "Перекрытие",
            title: "Перекрытие",
            description: "Построение прямоугольной плиты перекрытия.",
            active: currentTool === "slab",
            onClick: () => {
                pickArchitectureViewport();
                onToolChange("slab");
            },
        },
        {
            icon: "stair",
            label: "Лестница",
            title: "Лестница",
            description: "Прямой лестничный марш — прямоугольник с указанием числа ступеней.",
            active: currentTool === "stair",
            onClick: () => {
                pickArchitectureViewport();
                onToolChange("stair");
            },
        },
        {
            icon: "window",
            label: "Окно",
            title: "Окно",
            description: "Оконный проём с привязкой к ближайшей стене.",
            active: currentTool === "window",
            onClick: () => {
                pickArchitectureViewport();
                onToolChange("window");
            },
        },
        {
            icon: "door",
            label: "Дверь",
            title: "Дверь",
            description: "Дверной проём по выбранной стене.",
            active: currentTool === "door",
            onClick: () => {
                pickArchitectureViewport();
                onToolChange("door");
            },
        },
        ...(onGenerateWallsFromRooms
            ? [
                {
                    icon: "wallsFromRooms",
                    label: "Стены из комнат",
                    title: "Стены из комнат",
                    description: "Сгенерировать стены по контурам помещений.",
                    active: false,
                    onClick: onGenerateWallsFromRooms,
                },
            ]
            : []),
    ];
    const networkButtons = [
        {
            icon: "pipeSupply",
            label: "Подача",
            title: "Подача",
            description: "Построение подающей линии отопления.",
            active: currentTool === "pipe" && pipePreset === "heating_supply",
            tone: "supply",
            onClick: () => {
                pickNetworksViewport();
                onPipePresetChange("heating_supply");
                onToolChange("pipe");
            },
        },
        {
            icon: "pipeReturn",
            label: "Обратка",
            title: "Обратка",
            description: "Построение обратной линии отопления.",
            active: currentTool === "pipe" && pipePreset === "heating_return",
            tone: "return",
            onClick: () => {
                pickNetworksViewport();
                onPipePresetChange("heating_return");
                onToolChange("pipe");
            },
        },
        {
            icon: "duct",
            label: "Воздуховод",
            title: "Воздуховод",
            description: "Построение вентиляционной трассы.",
            active: currentTool === "duct",
            tone: "accent",
            onClick: () => {
                pickNetworksViewport();
                onToolChange("duct");
            },
        },
        {
            icon: "ahu",
            label: EQUIPMENT_TYPE_LABELS.ahu,
            title: EQUIPMENT_TYPE_LABELS.ahu,
            description: EQUIPMENT_TYPE_LABELS.ahu,
            active: currentTool === "equipment" && equipmentPreset === "ahu",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("ahu");
                onToolChange("equipment");
            },
        },
        {
            icon: "fancoil",
            label: EQUIPMENT_TYPE_LABELS.fancoil,
            title: EQUIPMENT_TYPE_LABELS.fancoil,
            description: EQUIPMENT_TYPE_LABELS.fancoil,
            active: currentTool === "equipment" && equipmentPreset === "fancoil",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("fancoil");
                onToolChange("equipment");
            },
        },
        {
            icon: "diffuser",
            label: EQUIPMENT_TYPE_LABELS.diffuser,
            title: EQUIPMENT_TYPE_LABELS.diffuser,
            description: EQUIPMENT_TYPE_LABELS.diffuser,
            active: currentTool === "equipment" && equipmentPreset === "diffuser",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("diffuser");
                onToolChange("equipment");
            },
        },
        {
            icon: "radiator",
            label: "Радиатор",
            title: "Радиатор",
            description: "Отопительный прибор в помещении.",
            active: currentTool === "equipment" && equipmentPreset === "radiator",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("radiator");
                onToolChange("equipment");
            },
        },
        {
            icon: "boiler",
            label: "Котёл",
            title: "Котёл",
            description: "Источник тепла или локальная котельная.",
            active: currentTool === "equipment" && equipmentPreset === "boiler",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("boiler");
                onToolChange("equipment");
            },
        },
        {
            icon: "pump",
            label: "Насос",
            title: "Насос",
            description: "Циркуляционный насос гидравлического контура.",
            active: currentTool === "equipment" && equipmentPreset === "pump",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("pump");
                onToolChange("equipment");
            },
        },
        {
            icon: "heatExchanger",
            label: "Водоподогреватель",
            title: "Водоподогреватель",
            description: "Пластинчатый водоподогреватель теплового пункта.",
            active: currentTool === "equipment" && equipmentPreset === "heat_exchanger",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("heat_exchanger");
                onToolChange("equipment");
            },
        },
        {
            icon: "elevator",
            label: "Элеватор",
            title: "Элеватор",
            description: "Водоструйный элеватор для подмешивания сетевой воды.",
            active: currentTool === "equipment" && equipmentPreset === "elevator",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("elevator");
                onToolChange("equipment");
            },
        },
        {
            icon: "expansionTank",
            label: "Расширительный бак",
            title: "Расширительный бак",
            description: "Мембранный бак на обратном контуре.",
            active: currentTool === "equipment" && equipmentPreset === "expansion_tank",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("expansion_tank");
                onToolChange("equipment");
            },
        },
        {
            icon: "dirtSeparator",
            label: "Грязевик",
            title: "Грязевик",
            description: "Магнитный грязевик на вводе теплового пункта.",
            active: currentTool === "equipment" && equipmentPreset === "dirt_separator",
            onClick: () => {
                pickNetworksViewport();
                onEquipmentPresetChange("dirt_separator");
                onToolChange("equipment");
            },
        },
        {
            icon: "sensor",
            label: "Датчик",
            title: "Датчик",
            description: "Датчик температуры, CO₂ или давления.",
            active: currentTool === "sensor",
            onClick: () => {
                pickNetworksViewport();
                onToolChange("sensor");
            },
        },
    ];
    const engineeringConnectionButtons = [
        {
            icon: "pipeSupply",
            label: "Труба",
            title: "Инженерный трубопровод",
            description: "Соединение портов инженерного оборудования с автоматической ортогональной трассировкой.",
            active: currentTool === "engineeringPipe",
            tone: "accent",
            onClick: () => {
                pickNetworksViewport();
                onToolChange("engineeringPipe");
            },
        },
    ];
    const engineeringButtons = [
        {
            icon: "heatExchanger",
            label: ENGINEERING_EQUIPMENT_LABELS.heatExchanger,
            title: ENGINEERING_EQUIPMENT_LABELS.heatExchanger,
            description: "Пластинчатый теплообменник с четырьмя портами первичного и вторичного контуров.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "heatExchanger",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("heatExchanger");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "pump",
            label: ENGINEERING_EQUIPMENT_LABELS.pump,
            title: ENGINEERING_EQUIPMENT_LABELS.pump,
            description: "Циркуляционный насос с подачей через линейные присоединительные патрубки.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "pump",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("pump");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "filter",
            label: ENGINEERING_EQUIPMENT_LABELS.filter,
            title: ENGINEERING_EQUIPMENT_LABELS.filter,
            description: "Фильтр или грязевик с дренажным портом для демонстрационных тепловых узлов.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "filter",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("filter");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "valve",
            label: ENGINEERING_EQUIPMENT_LABELS.valve,
            title: ENGINEERING_EQUIPMENT_LABELS.valve,
            description: "Запорный клапан или задвижка для линейной установки в гидравлической схеме.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "valve",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("valve");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "controlValve",
            label: ENGINEERING_EQUIPMENT_LABELS.controlValve,
            title: ENGINEERING_EQUIPMENT_LABELS.controlValve,
            description: "Регулирующий клапан с приводом и сигнальным подключением к шкафу автоматики.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "controlValve",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("controlValve");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "expansionTank",
            label: ENGINEERING_EQUIPMENT_LABELS.expansionTank,
            title: ENGINEERING_EQUIPMENT_LABELS.expansionTank,
            description: "Мембранный расширительный бак на обратном трубопроводе.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "expansionTank",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("expansionTank");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "manifold",
            label: ENGINEERING_EQUIPMENT_LABELS.manifold,
            title: ENGINEERING_EQUIPMENT_LABELS.manifold,
            description: "Коллектор или вводной/распределительный гребенчатый блок.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "manifold",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("manifold");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "heatMeter",
            label: ENGINEERING_EQUIPMENT_LABELS.heatMeter,
            title: ENGINEERING_EQUIPMENT_LABELS.heatMeter,
            description: "Узел учета тепловой энергии с гидравлическим и сигнальным портом.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "heatMeter",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("heatMeter");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "automationCabinet",
            label: ENGINEERING_EQUIPMENT_LABELS.automationCabinet,
            title: ENGINEERING_EQUIPMENT_LABELS.automationCabinet,
            description: "Шкаф автоматики для электропитания и сигнальных соединений.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "automationCabinet",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("automationCabinet");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "sensorTemperature",
            label: ENGINEERING_EQUIPMENT_LABELS.sensorTemperature,
            title: ENGINEERING_EQUIPMENT_LABELS.sensorTemperature,
            description: "Температурный датчик с сигнальным подключением.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "sensorTemperature",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("sensorTemperature");
                onToolChange("engineeringEquipment");
            },
        },
        {
            icon: "sensorPressure",
            label: ENGINEERING_EQUIPMENT_LABELS.sensorPressure,
            title: ENGINEERING_EQUIPMENT_LABELS.sensorPressure,
            description: "Датчик давления с сигнальным подключением.",
            active: currentTool === "engineeringEquipment" && engineeringEquipmentPreset === "sensorPressure",
            onClick: () => {
                pickNetworksViewport();
                onEngineeringEquipmentPresetChange("sensorPressure");
                onToolChange("engineeringEquipment");
            },
        },
    ];
    void engineeringConnectionButtons;
    void engineeringButtons;
    void onAddTypicalCtp;
    const Button = variant === "sidebar" ? PaletteSidebarButton : PaletteIconButton;
    if (variant === "sidebar") {
        return (_jsxs("div", { className: "space-y-2", children: [_jsxs(SidebarSection, { title: "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442", columns: 2, children: [_jsx(Button, { ...commonButtons.select }), activeViewport === "view3d" ? _jsx(Button, { ...commonButtons.move }) : null, !resultsMode ? _jsx(Button, { ...commonButtons.erase }) : null] }), architectureMode && !resultsMode ? (_jsxs(SidebarSection, { title: "\u0422\u0438\u043F\u043E\u0432\u044B\u0435 \u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F", columns: 1, children: [_jsx(SidebarPresetSelect, { kind: "wall", value: wallPreset, onChange: onWallPresetChange }), _jsx(SidebarPresetSelect, { kind: "window", value: windowPreset, onChange: onWindowPresetChange }), _jsx(SidebarPresetSelect, { kind: "door", value: doorPreset, onChange: onDoorPresetChange }), _jsx(SidebarPresetSelect, { kind: "roof", value: roofPreset, onChange: onRoofPresetChange }), _jsx(SidebarPresetSelect, { kind: "slab", value: slabPreset, onChange: onSlabPresetChange })] })) : null, architectureMode && !resultsMode ? (_jsx(SidebarSection, { title: "\u041F\u043B\u0430\u043D", columns: 2, children: architectureButtons.map((button) => (_jsx(Button, { ...button }, button.title))) })) : null, networksMode && !resultsMode ? (_jsx(SidebarSection, { title: "\u0421\u0435\u0442\u0438", columns: 2, children: networkButtons.map((button) => (_jsx(Button, { ...button }, button.title))) })) : null, _jsx(SidebarSection, { title: "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F", columns: 1, children: _jsx(Button, { icon: "fit", label: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0451", title: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0435", description: "\u041F\u043E\u0434\u043E\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431 \u0438 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043C\u043E\u0434\u0435\u043B\u044C \u0446\u0435\u043B\u0438\u043A\u043E\u043C.", active: false, onClick: onZoomToFit }) })] }));
    }
    return (_jsx("div", { className: "sticky top-0 z-20 min-w-0 max-w-full overflow-hidden border-b border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] backdrop-blur-sm", children: _jsxs("div", { className: "relative", children: [_jsx(OverflowFade, { side: "left", visible: overflowState.left }), _jsx(OverflowFade, { side: "right", visible: overflowState.right }), _jsxs("div", { ref: scrollRef, className: "flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 [scrollbar-width:thin]", children: [_jsxs(ToolbarGroup, { title: "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442", children: [_jsx(Button, { ...commonButtons.select }), activeViewport === "view3d" ? _jsx(Button, { ...commonButtons.move }) : null, !resultsMode ? _jsx(Button, { ...commonButtons.erase }) : null] }), !resultsMode ? (_jsxs(ToolbarGroup, { title: "\u0412\u0438\u0434", children: [_jsx(ToolbarSelect, { label: "\u0420\u0435\u0436\u0438\u043C", value: visualizationMode, onChange: (value) => onVisualizationModeChange(value), options: visualizationOptions }), _jsx(ToolbarSelect, { label: "\u0421\u0442\u0438\u043B\u044C", value: schematicStyle, onChange: (value) => onSchematicStyleChange(value), options: schematicStyleOptions })] })) : null, architectureMode && !resultsMode ? (_jsxs(_Fragment, { children: [_jsx(ToolDivider, {}), _jsx(ToolbarGroup, { title: "\u041F\u043B\u0430\u043D", children: architectureButtons.map((button) => (_jsx(Button, { ...button }, button.title))) }), _jsxs(ToolbarGroup, { title: "\u041F\u0440\u0435\u0441\u0435\u0442\u044B", children: [_jsx(EnvelopePresetToolbarSelect, { kind: "wall", value: wallPreset, onChange: onWallPresetChange }), _jsx(EnvelopePresetToolbarSelect, { kind: "window", value: windowPreset, onChange: onWindowPresetChange }), _jsx(EnvelopePresetToolbarSelect, { kind: "door", value: doorPreset, onChange: onDoorPresetChange }), _jsx(EnvelopePresetToolbarSelect, { kind: "roof", value: roofPreset, onChange: onRoofPresetChange }), _jsx(EnvelopePresetToolbarSelect, { kind: "slab", value: slabPreset, onChange: onSlabPresetChange })] })] })) : null, networksMode && !resultsMode ? (_jsxs(_Fragment, { children: [_jsx(ToolDivider, {}), _jsx(ToolbarGroup, { title: "\u0421\u0435\u0442\u0438", children: networkButtons.map((button) => (_jsx(Button, { ...button }, button.title))) }), _jsxs(ToolbarGroup, { title: "\u041E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435", children: [_jsx(ToolbarSelect, { label: "\u0412\u0438\u0434 \u0441\u0435\u0442\u0438", value: heatingDisplayMode, onChange: (value) => onHeatingDisplayModeChange(value), options: heatingDisplayOptions }), _jsx(ToolbarSelect, { label: "\u0421\u0442\u0440\u0435\u043B\u043A\u0438", value: showNetworkFlowArrows ? "on" : "off", onChange: (value) => onShowNetworkFlowArrowsChange(value === "on"), options: [
                                                { value: "on", label: "Показывать" },
                                                { value: "off", label: "Скрыть" },
                                            ] })] })] })) : null, _jsx(ToolDivider, {}), _jsx(ToolbarGroup, { title: "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F", children: _jsx(Button, { icon: "fit", label: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0451", title: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0435", description: "\u041F\u043E\u0434\u043E\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0441\u0448\u0442\u0430\u0431 \u0438 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0443\u044E \u043C\u043E\u0434\u0435\u043B\u044C \u0446\u0435\u043B\u0438\u043A\u043E\u043C.", active: false, onClick: onZoomToFit }) })] })] }) }));
}
export default BuildToolPalette;
