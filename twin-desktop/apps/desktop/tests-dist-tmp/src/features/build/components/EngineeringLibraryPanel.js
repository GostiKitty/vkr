import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { ENGINEERING_EQUIPMENT_LABELS, EQUIPMENT_VARIANT_DEFAULT, EQUIPMENT_VARIANTS } from "../engineering2d/catalog";
const TAB_LABELS = {
    valves: "Арматура",
    equipment: "Оборудование",
    sensors: "Датчики",
};
const VALVE_BUTTONS = [
    { type: "valve", avokCode: "2.8.01" },
    { type: "gateValve", avokCode: "2.8.03" },
    { type: "ballValve", avokCode: "2.8.05" },
    { type: "checkValve", avokCode: "2.8.15" },
    { type: "threeWayValve", avokCode: "2.8.08" },
    { type: "controlValve", avokCode: "2.8.09" },
    { type: "balancingValve", avokCode: "2.8.13" },
    { type: "pressureRegulator", avokCode: "2.8.20" },
    { type: "safetyValve", avokCode: "2.8.23" },
    { type: "thermostaticValve", avokCode: "2.8.19" },
    { type: "filter", avokCode: "2.9.01" },
    { type: "flowMeter", avokCode: "2.9.04" },
];
const EQUIPMENT_BUTTONS = [
    { type: "heatExchanger", avokCode: "3.7.01" },
    { type: "pump", avokCode: "3.6.02" },
    { type: "convector", avokCode: "3.1.04" },
    { type: "expansionTank", avokCode: "3.7.06" },
    { type: "manifold", avokCode: "—" },
    { type: "heatMeter", avokCode: "—" },
    { type: "automationCabinet", avokCode: "—" },
];
const SENSOR_BUTTONS = [
    { type: "sensorTemperature", avokCode: "5.1.02" },
    { type: "sensorPressure", avokCode: "5.1.05" },
    { type: "sensorFlow", avokCode: "5.1.07" },
    { type: "sensorHumidity", avokCode: "5.1.09" },
];
function SectionLabel({ children }) {
    return _jsx("p", { className: "ui-engineering-lib__label", children: children });
}
function QuickActionButton({ label, title, active, onClick, }) {
    return (_jsx("button", { type: "button", title: title, "aria-label": title, "aria-pressed": active, onClick: onClick, className: `ui-engineering-lib__action ${active ? "ui-engineering-lib__action--active" : ""}`, children: _jsx("span", { className: "min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight", children: label }) }));
}
function VariantDropdown({ type, currentVariant, onSelect, onClose, }) {
    const variants = EQUIPMENT_VARIANTS[type];
    const ref = useRef(null);
    useEffect(() => {
        const handler = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);
    if (!variants?.length) {
        return null;
    }
    return (_jsx("div", { ref: ref, className: "ui-engineering-lib__variant-menu", children: variants.map((variant) => (_jsxs("button", { type: "button", onMouseDown: (event) => {
                event.stopPropagation();
                onSelect(variant.key);
                onClose();
            }, className: `ui-engineering-lib__variant-item ${variant.key === currentVariant ? "ui-engineering-lib__variant-item--active" : ""}`, children: [variant.key === currentVariant ? (_jsx("span", { className: "inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent-base)]" })) : (_jsx("span", { className: "inline-block h-1.5 w-1.5 shrink-0" })), variant.label] }, variant.key))) }));
}
function EquipmentListItem({ label, title, active, equipmentType, hasVariants, currentVariant, onPickVariant, onClick, }) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const wrapperRef = useRef(null);
    const variants = equipmentType && hasVariants ? EQUIPMENT_VARIANTS[equipmentType] : undefined;
    const variantLabel = variants?.find((variant) => variant.key === currentVariant)?.label;
    return (_jsxs("div", { ref: wrapperRef, className: "relative min-w-0", children: [_jsxs("div", { className: `ui-engineering-lib__item ${active ? "ui-engineering-lib__item--active" : ""}`, children: [_jsx("button", { type: "button", title: title, "aria-label": title, "aria-pressed": active, onClick: onClick, className: "ui-engineering-lib__item-main", children: _jsx("span", { className: "min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight", children: label }) }), hasVariants ? (_jsxs("button", { type: "button", "aria-label": `Вариант: ${variantLabel ?? "не выбран"}`, "aria-expanded": dropdownOpen, onClick: (event) => {
                            event.stopPropagation();
                            setDropdownOpen((open) => !open);
                        }, className: `ui-engineering-lib__variant-trigger ${active ? "ui-engineering-lib__variant-trigger--active" : ""}`, children: [_jsx("span", { className: "max-w-[5.5rem] truncate", children: variantLabel ?? "Вариант" }), _jsx("span", { "aria-hidden": "true", children: "\u25BE" })] })) : null] }), dropdownOpen && hasVariants && equipmentType && onPickVariant ? (_jsx(VariantDropdown, { type: equipmentType, currentVariant: currentVariant ?? "", onSelect: (variant) => {
                    onPickVariant(variant);
                    setDropdownOpen(false);
                }, onClose: () => setDropdownOpen(false) })) : null] }));
}
export function EngineeringLibraryPanel({ currentTool, selectedType, selectedVariant, onPickEquipment, onPickPipe, onAddItpParallelDhw, }) {
    const [activeTab, setActiveTab] = useState("valves");
    const [variantByType, setVariantByType] = useState({});
    const getVariant = (type) => {
        return variantByType[type] ?? EQUIPMENT_VARIANT_DEFAULT[type];
    };
    const handlePickVariant = (type, variant) => {
        setVariantByType((prev) => ({ ...prev, [type]: variant }));
        if (currentTool === "engineeringEquipment" && selectedType === type) {
            onPickEquipment(type, variant);
        }
    };
    const isEquipmentActive = (type) => currentTool === "engineeringEquipment" && selectedType === type;
    const currentButtons = activeTab === "valves" ? VALVE_BUTTONS : activeTab === "sensors" ? SENSOR_BUTTONS : EQUIPMENT_BUTTONS;
    return (_jsxs("div", { className: "ui-engineering-lib", children: [_jsxs("section", { className: "ui-engineering-lib__section", children: [_jsx(SectionLabel, { children: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435" }), _jsxs("div", { className: "ui-engineering-lib__actions", children: [_jsx(QuickActionButton, { label: "\u0421\u043E\u0435\u0434\u0438\u043D\u0438\u0442\u044C \u0442\u0440\u0443\u0431\u043E\u0439", title: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u0442\u0440\u0443\u0431\u043E\u043F\u0440\u043E\u0432\u043E\u0434", active: currentTool === "engineeringPipe", onClick: onPickPipe }), _jsx(QuickActionButton, { label: "\u0418\u0422\u041F \u043F\u0430\u0440\u0430\u043B. \u0413\u0412\u0421 + \u0437\u0430\u0432. \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u0435", title: "\u0418\u0422\u041F \u043F\u0430\u0440\u0430\u043B. \u0413\u0412\u0421 + \u0437\u0430\u0432. \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u0435", onClick: onAddItpParallelDhw })] })] }), _jsx("section", { className: "ui-engineering-lib__section", children: _jsx("div", { className: "ui-segmented-control flex w-full", role: "tablist", "aria-label": "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F", children: Object.entries(TAB_LABELS).map(([id, label]) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activeTab === id, onClick: () => setActiveTab(id), className: `ui-segmented-control__item min-w-0 flex-1 px-2 py-1.5 text-[11px] ${activeTab === id ? "ui-segmented-control__item--active" : ""}`, children: label }, id))) }) }), _jsx("section", { className: "ui-engineering-lib__section", children: _jsx("div", { className: "ui-engineering-lib__list", children: currentButtons.map((button) => {
                        const hasVariants = Boolean(EQUIPMENT_VARIANTS[button.type]?.length);
                        const variant = getVariant(button.type);
                        return (_jsx(EquipmentListItem, { equipmentType: button.type, label: ENGINEERING_EQUIPMENT_LABELS[button.type], title: ENGINEERING_EQUIPMENT_LABELS[button.type], active: isEquipmentActive(button.type), hasVariants: hasVariants, currentVariant: variant, onPickVariant: (nextVariant) => handlePickVariant(button.type, nextVariant), onClick: () => onPickEquipment(button.type, variant) }, button.type));
                    }) }) })] }));
}
export default EngineeringLibraryPanel;
