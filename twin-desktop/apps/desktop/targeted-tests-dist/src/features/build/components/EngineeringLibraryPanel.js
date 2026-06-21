import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { ENGINEERING_EQUIPMENT_LABELS, EQUIPMENT_VARIANT_DEFAULT, EQUIPMENT_VARIANTS } from "../engineering2d/catalog";
const TAB_LABELS = {
    valves: "РђСЂРјР°С‚СѓСЂР°",
    equipment: "РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ",
    air: "Р’РѕР·РґСѓС…",
    sensors: "Р”Р°С‚С‡РёРєРё",
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
    { type: "flowMeter", avokCode: "2.9.04" },
];
const EQUIPMENT_BUTTONS = [
    { type: "heatExchanger", avokCode: "3.7.01" },
    { type: "pump", avokCode: "3.6.02" },
    { type: "convector", avokCode: "3.1.04" },
    { type: "expansionTank", avokCode: "3.7.06" },
    { type: "manifold", avokCode: "вЂ”" },
    { type: "heatMeter", avokCode: "вЂ”" },
    { type: "automationCabinet", avokCode: "вЂ”" },
];
const AIR_BUTTONS = [
    { type: "airHandlingUnit", avokCode: "вЂ”" },
    { type: "ductFan", avokCode: "вЂ”" },
    { type: "roofFan", avokCode: "вЂ”" },
    { type: "airFilter", avokCode: "вЂ”" },
    { type: "airDamper", avokCode: "вЂ”" },
    { type: "airCheckValve", avokCode: "—" },
    { type: "fireDamper", avokCode: "вЂ”" },
    { type: "silencer", avokCode: "вЂ”" },
    { type: "airHeater", avokCode: "вЂ”" },
    { type: "airCooler", avokCode: "вЂ”" },
    { type: "airHumidifier", avokCode: "вЂ”" },
    { type: "airDehumidifier", avokCode: "вЂ”" },
    { type: "supplyDiffuser", avokCode: "вЂ”" },
    { type: "exhaustGrille", avokCode: "вЂ”" },
];
AIR_BUTTONS.splice(5, 0, { type: "airFlowRegulatorConst", avokCode: "вЂ”" }, { type: "airFlowRegulatorVar", avokCode: "вЂ”" });
const SENSOR_BUTTONS = [
    { type: "sensorTemperature", avokCode: "5.1.02" },
    { type: "sensorPressure", avokCode: "5.1.05" },
    { type: "sensorFlow", avokCode: "5.1.07" },
    { type: "sensorHumidity", avokCode: "5.1.09" },
];
const AIR_GOST_REFERENCE = {
    airHandlingUnit: "Р“РћРЎРў 21.205-2016",
    ductFan: "Р“РћРЎРў 21.205-2016, РїРѕР·. 20",
    airFilter: "Р“РћРЎРў 21.205-2016, РїРѕР·. 23",
    airDamper: "Р“РћРЎРў 21.205-2016, РїРѕР·. 24",
    fireDamper: "Р“РћРЎРў 21.205-2016, РїРѕР·. 15",
    silencer: "Р“РћРЎРў 21.205-2016, РїРѕР·. 27",
    airHeater: "Р“РћРЎРў 21.205-2016, РїРѕР·. 2",
    airCooler: "Р“РћРЎРў 21.205-2016, РїРѕР·. 3",
    airHumidifier: "Р“РћРЎРў 21.205-2016",
    airDehumidifier: "Р“РћРЎРў 21.205-2016",
    supplyDiffuser: "Р“РћРЎРў 21.205-2016, С‚Р°Р±Р». 10, РїРѕР·. 1",
    exhaustGrille: "Р“РћРЎРў 21.205-2016, С‚Р°Р±Р». 10, РїРѕР·. 2",
};
AIR_GOST_REFERENCE.airFlowRegulatorConst = "Р“РћРЎРў 21.205-2016, РїРѕР·. 17";
AIR_GOST_REFERENCE.airFlowRegulatorVar = "Р“РћРЎРў 21.205-2016, РїРѕР·. 18";
AIR_GOST_REFERENCE.roofFan = "Р“РћРЎРў 21.205-2016";
AIR_GOST_REFERENCE.airCheckValve = "ГОСТ 21.205-2016";
function SectionLabel({ children }) {
    return _jsx("p", { className: "ui-engineering-lib__label", children: children });
}
function buildEquipmentTitle(type, code) {
    const label = ENGINEERING_EQUIPMENT_LABELS[type];
    const gostRef = AIR_GOST_REFERENCE[type];
    if (gostRef) {
        return `${label} В· ${gostRef}`;
    }
    if (code === "вЂ”" || code === "РІР‚вЂ”") {
        return label;
    }
    return `${label} В· ${code}`;
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
    return (_jsxs("div", { ref: wrapperRef, className: "relative min-w-0", children: [_jsxs("div", { className: `ui-engineering-lib__item ${active ? "ui-engineering-lib__item--active" : ""}`, children: [_jsx("button", { type: "button", title: title, "aria-label": title, "aria-pressed": active, onClick: onClick, className: "ui-engineering-lib__item-main", children: _jsx("span", { className: "min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight", children: label }) }), hasVariants ? (_jsxs("button", { type: "button", "aria-label": `Р’Р°СЂРёР°РЅС‚: ${variantLabel ?? "РЅРµ РІС‹Р±СЂР°РЅ"}`, "aria-expanded": dropdownOpen, onClick: (event) => {
                            event.stopPropagation();
                            setDropdownOpen((open) => !open);
                        }, className: `ui-engineering-lib__variant-trigger ${active ? "ui-engineering-lib__variant-trigger--active" : ""}`, children: [_jsx("span", { className: "max-w-[5.5rem] truncate", children: variantLabel ?? "Р’Р°СЂРёР°РЅС‚" }), _jsx("span", { "aria-hidden": "true", children: "\u0432\u2013\u0455" })] })) : null] }), dropdownOpen && hasVariants && equipmentType && onPickVariant ? (_jsx(VariantDropdown, { type: equipmentType, currentVariant: currentVariant ?? "", onSelect: (variant) => {
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
    const currentButtons = activeTab === "valves"
        ? VALVE_BUTTONS
        : activeTab === "air"
            ? AIR_BUTTONS
            : activeTab === "sensors"
                ? SENSOR_BUTTONS
                : EQUIPMENT_BUTTONS;
    return (_jsxs("div", { className: "ui-engineering-lib", children: [_jsxs("section", { className: "ui-engineering-lib__section", children: [_jsx(SectionLabel, { children: "\u0420\u045F\u0420\u0455\u0420\u0491\u0420\u0454\u0420\u00BB\u0421\u040B\u0421\u2021\u0420\u00B5\u0420\u0405\u0420\u0451\u0420\u00B5" }), _jsxs("div", { className: "ui-engineering-lib__actions", children: [_jsx(QuickActionButton, { label: "\u0420\u040E\u0420\u0455\u0420\u00B5\u0420\u0491\u0420\u0451\u0420\u0405\u0420\u0451\u0421\u201A\u0421\u040A \u0421\u201A\u0421\u0402\u0421\u0453\u0420\u00B1\u0420\u0455\u0420\u2116", title: "\u0420\u0098\u0420\u0405\u0420\u00B6\u0420\u00B5\u0420\u0405\u0420\u00B5\u0421\u0402\u0420\u0405\u0421\u2039\u0420\u2116 \u0421\u201A\u0421\u0402\u0421\u0453\u0420\u00B1\u0420\u0455\u0420\u0457\u0421\u0402\u0420\u0455\u0420\u0406\u0420\u0455\u0420\u0491", active: currentTool === "engineeringPipe", onClick: onPickPipe }), _jsx(QuickActionButton, { label: "\u0420\u0098\u0420\u045E\u0420\u045F \u0420\u0457\u0420\u00B0\u0421\u0402\u0420\u00B0\u0420\u00BB. \u0420\u201C\u0420\u2019\u0420\u040E + \u0420\u00B7\u0420\u00B0\u0420\u0406. \u0420\u0455\u0421\u201A\u0420\u0455\u0420\u0457\u0420\u00BB\u0420\u00B5\u0420\u0405\u0420\u0451\u0420\u00B5", title: "\u0420\u0098\u0420\u045E\u0420\u045F \u0420\u0457\u0420\u00B0\u0421\u0402\u0420\u00B0\u0420\u00BB. \u0420\u201C\u0420\u2019\u0420\u040E + \u0420\u00B7\u0420\u00B0\u0420\u0406. \u0420\u0455\u0421\u201A\u0420\u0455\u0420\u0457\u0420\u00BB\u0420\u00B5\u0420\u0405\u0420\u0451\u0420\u00B5", onClick: onAddItpParallelDhw })] })] }), _jsx("section", { className: "ui-engineering-lib__section", children: _jsx("div", { className: "ui-segmented-control flex w-full", role: "tablist", "aria-label": "\u0420\u0459\u0420\u00B0\u0421\u201A\u0420\u00B5\u0420\u0456\u0420\u0455\u0421\u0402\u0420\u0451\u0421\u040F \u0420\u0455\u0420\u00B1\u0420\u0455\u0421\u0402\u0421\u0453\u0420\u0491\u0420\u0455\u0420\u0406\u0420\u00B0\u0420\u0405\u0420\u0451\u0421\u040F", children: Object.entries(TAB_LABELS).map(([id, label]) => (_jsx("button", { type: "button", role: "tab", "aria-selected": activeTab === id, onClick: () => setActiveTab(id), className: `ui-segmented-control__item min-w-0 flex-1 px-2 py-1.5 text-[11px] ${activeTab === id ? "ui-segmented-control__item--active" : ""}`, children: label }, id))) }) }), _jsx("section", { className: "ui-engineering-lib__section", children: _jsx("div", { className: "ui-engineering-lib__list", children: currentButtons.map((button) => {
                        const hasVariants = Boolean(EQUIPMENT_VARIANTS[button.type]?.length);
                        const variant = getVariant(button.type);
                        return (_jsx(EquipmentListItem, { equipmentType: button.type, label: ENGINEERING_EQUIPMENT_LABELS[button.type], title: buildEquipmentTitle(button.type, button.avokCode), active: isEquipmentActive(button.type), hasVariants: hasVariants, currentVariant: variant, onPickVariant: (nextVariant) => handlePickVariant(button.type, nextVariant), onClick: () => onPickEquipment(button.type, variant) }, button.type));
                    }) }) })] }));
}
export default EngineeringLibraryPanel;
