import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ENGINEERING_EQUIPMENT_LABELS, ENGINEERING_MEDIUM_LABELS, } from "../engineering2d/catalog";
const ROTATION_OPTIONS = ["0", "90", "180", "270"].map((value) => ({ value, label: `${value}°` }));
export function EngineeringEquipmentForm({ equipment, onUpdateEngineeringEquipment, }) {
    const updateParameters = (patch) => {
        onUpdateEngineeringEquipment(equipment.id, {
            parameters: { ...equipment.parameters, ...patch },
        });
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(TextField, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", value: equipment.name, onChange: (value) => onUpdateEngineeringEquipment(equipment.id, { name: value }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(NumberField, { label: "X", value: equipment.x, step: 0.1, onChange: (value) => onUpdateEngineeringEquipment(equipment.id, { x: value }) }), _jsx(NumberField, { label: "Y", value: equipment.y, step: 0.1, onChange: (value) => onUpdateEngineeringEquipment(equipment.id, { y: value }) }), _jsx(NumberField, { label: "\u0428\u0438\u0440\u0438\u043D\u0430", value: equipment.width, step: 0.1, onChange: (value) => onUpdateEngineeringEquipment(equipment.id, { width: value }) }), _jsx(NumberField, { label: "\u0412\u044B\u0441\u043E\u0442\u0430", value: equipment.height, step: 0.1, onChange: (value) => onUpdateEngineeringEquipment(equipment.id, { height: value }) })] }), _jsx(SelectField, { label: "\u041F\u043E\u0432\u043E\u0440\u043E\u0442", value: String(equipment.rotation), options: ROTATION_OPTIONS, onChange: (value) => onUpdateEngineeringEquipment(equipment.id, { rotation: Number(value) }) }), _jsx("button", { type: "button", onClick: () => onUpdateEngineeringEquipment(equipment.id, { rotation: ((equipment.rotation + 90) % 360) }), className: "ui-btn-secondary w-full rounded-[12px] px-3 py-2 text-sm font-semibold", children: "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u0430 90\u00B0" }), _jsx(EngineeringEquipmentParameterFields, { equipment: equipment, onPatch: updateParameters, onUpdateEquipment: onUpdateEngineeringEquipment })] }));
}
function EngineeringEquipmentParameterFields({ equipment, onPatch, onUpdateEquipment, }) {
    switch (equipment.type) {
        case "pump":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043C\u00B3/\u0447", value: toNumber(equipment.parameters.flowRateM3H), step: 0.1, onChange: (value) => onPatch({ flowRateM3H: value }) }), _jsx(NumberField, { label: "\u041D\u0430\u043F\u043E\u0440, \u043C", value: toNumber(equipment.parameters.headM), step: 0.1, onChange: (value) => onPatch({ headM: value }) }), _jsx(NumberField, { label: "\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C, \u043A\u0412\u0442", value: toNumber(equipment.parameters.powerKW), step: 0.1, onChange: (value) => onPatch({ powerKW: value }) }), _jsx(NumberField, { label: "\u041A\u041F\u0414", value: toNumber(equipment.parameters.efficiency), step: 0.01, onChange: (value) => onPatch({ efficiency: value }) })] }));
        case "heatExchanger":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(SelectField, { label: "\u0422\u0438\u043F \u0442\u0435\u043F\u043B\u043E\u043E\u0431\u043C\u0435\u043D\u043D\u0438\u043A\u0430", value: String(equipment.parameters.heatExchangerVariant ?? "fixedStraight"), options: [
                            { value: "fixedStraight", label: "с неподвижными трубными решетками при давлении в трубах и межтрубном пространстве выше атмосферного" },
                            { value: "fixedLowIntertube", label: "Кожухотрубный (низкое межтрубное давление)" },
                            { value: "fixedCompensator", label: "С температурным компенсатором" },
                            { value: "floatingHead", label: "С плавающей головкой" },
                            { value: "uTube", label: "С U-образными трубами" },
                            { value: "packedGland", label: "С сальником" },
                            { value: "vaporFloating", label: "С паровым пространством и плавающей головкой" },
                            { value: "vaporUTube", label: "С паровым пространством и U-трубами" },
                            { value: "coiledAtmospheric", label: "Витой (атмосферный)" },
                        ], onChange: (value) => {
                            onPatch({ heatExchangerVariant: value });
                            if (value === "fixedStraight") {
                                // Этот вариант должен быть строго вертикальным как на ГОСТ-образце.
                                onUpdateEquipment(equipment.id, { width: 1.4, height: 2.2, rotation: 0 });
                            }
                        } }), _jsx(NumberField, { label: "\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C, \u043A\u0412\u0442", value: toNumber(equipment.parameters.powerKW), step: 1, onChange: (value) => onPatch({ powerKW: value }) }), _jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043C\u00B3/\u0447", value: toNumber(equipment.parameters.flowRateM3H), step: 0.1, onChange: (value) => onPatch({ flowRateM3H: value }) }), _jsx(NumberField, { label: "\u041F\u0435\u0440\u0432\u0438\u0447\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0443\u0440, \u00B0C", value: toNumber(equipment.parameters.primaryTemperatureC), step: 0.5, onChange: (value) => onPatch({ primaryTemperatureC: value }) }), _jsx(NumberField, { label: "\u0412\u0442\u043E\u0440\u0438\u0447\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0443\u0440, \u00B0C", value: toNumber(equipment.parameters.secondaryTemperatureC), step: 0.5, onChange: (value) => onPatch({ secondaryTemperatureC: value }) }), _jsx(NumberField, { label: "\u041F\u043E\u0442\u0435\u0440\u0438 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F, \u043A\u041F\u0430", value: toNumber(equipment.parameters.pressureDropKPa), step: 0.5, onChange: (value) => onPatch({ pressureDropKPa: value }) })] }));
        case "valve":
        case "controlValve":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(NumberField, { label: "\u0414\u0438\u0430\u043C\u0435\u0442\u0440, \u043C\u043C", value: toNumber(equipment.parameters.diameterMm), step: 1, onChange: (value) => onPatch({ diameterMm: value }) }), _jsx(NumberField, { label: "Kv", value: toNumber(equipment.parameters.kv), step: 0.1, onChange: (value) => onPatch({ kv: value }) }), _jsx(SelectField, { label: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435", value: String(equipment.parameters.state ?? "open"), options: [
                            { value: "open", label: "Открыт" },
                            { value: "closed", label: "Закрыт" },
                            { value: "regulating", label: "Регулируемый" },
                        ], onChange: (value) => onPatch({ state: value }) })] }));
        case "filter":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(NumberField, { label: "\u0414\u0438\u0430\u043C\u0435\u0442\u0440, \u043C\u043C", value: toNumber(equipment.parameters.diameterMm), step: 1, onChange: (value) => onPatch({ diameterMm: value }) }), _jsx(NumberField, { label: "\u041F\u043E\u0442\u0435\u0440\u0438 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F, \u043A\u041F\u0430", value: toNumber(equipment.parameters.pressureDropKPa), step: 0.1, onChange: (value) => onPatch({ pressureDropKPa: value }) }), _jsx(NumberField, { label: "\u0417\u0430\u0433\u0440\u044F\u0437\u043D\u0435\u043D\u0438\u0435, %", value: toNumber(equipment.parameters.contaminationPercent), step: 1, onChange: (value) => onPatch({ contaminationPercent: value }) })] }));
        case "expansionTank":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(NumberField, { label: "\u041E\u0431\u044A\u0435\u043C, \u043B", value: toNumber(equipment.parameters.volumeL), step: 1, onChange: (value) => onPatch({ volumeL: value }) }), _jsx(NumberField, { label: "\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435, \u0431\u0430\u0440", value: toNumber(equipment.parameters.pressureBar), step: 0.1, onChange: (value) => onPatch({ pressureBar: value }) })] }));
        case "heatMeter":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043C\u00B3/\u0447", value: toNumber(equipment.parameters.flowRateM3H), step: 0.1, onChange: (value) => onPatch({ flowRateM3H: value }) }), _jsx(NumberField, { label: "\u041F\u043E\u0434\u0430\u0447\u0430, \u00B0C", value: toNumber(equipment.parameters.supplyTemperatureC), step: 0.1, onChange: (value) => onPatch({ supplyTemperatureC: value }) }), _jsx(NumberField, { label: "\u041E\u0431\u0440\u0430\u0442\u043A\u0430, \u00B0C", value: toNumber(equipment.parameters.returnTemperatureC), step: 0.1, onChange: (value) => onPatch({ returnTemperatureC: value }) }), _jsx(NumberField, { label: "\u0422\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C, \u043A\u0412\u0442", value: toNumber(equipment.parameters.heatPowerKW), step: 0.5, onChange: (value) => onPatch({ heatPowerKW: value }) })] }));
        default:
            return null;
    }
}
export function EngineeringPipeForm({ model, pipe, onUpdateEngineeringPipe, }) {
    const equipmentLookup = new Map((model.engineeringSystems?.equipment ?? []).map((item) => [item.id, item]));
    const fromEquipment = equipmentLookup.get(pipe.fromEquipmentId);
    const toEquipment = equipmentLookup.get(pipe.toEquipmentId);
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(InfoCard, { rows: [
                    { label: "От", value: fromEquipment?.name ?? pipe.fromEquipmentId },
                    { label: "До", value: toEquipment?.name ?? pipe.toEquipmentId },
                    { label: "Точек", value: String(pipe.points.length) },
                ] }), _jsx(SelectField, { label: "\u0421\u0440\u0435\u0434\u0430", value: pipe.medium, options: Object.entries(ENGINEERING_MEDIUM_LABELS).map(([value, label]) => ({ value, label })), onChange: (value) => onUpdateEngineeringPipe(pipe.id, { medium: value }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(NumberField, { label: "\u0414\u0438\u0430\u043C\u0435\u0442\u0440, \u043C\u043C", value: pipe.diameter, step: 1, onChange: (value) => onUpdateEngineeringPipe(pipe.id, { diameter: value }) }), _jsx(NumberField, { label: "\u0418\u0437\u043E\u043B\u044F\u0446\u0438\u044F, \u043C\u043C", value: pipe.insulation, step: 1, onChange: (value) => onUpdateEngineeringPipe(pipe.id, { insulation: value }) }), _jsx(NumberField, { label: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u00B0C", value: pipe.temperature ?? 0, step: 0.5, onChange: (value) => onUpdateEngineeringPipe(pipe.id, { temperature: value }) }), _jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434", value: pipe.flowRate ?? 0, step: 0.1, onChange: (value) => onUpdateEngineeringPipe(pipe.id, { flowRate: value }) })] }), _jsx(HintCard, { text: "\u0422\u0440\u0430\u0441\u0441\u0430 \u0442\u0440\u0443\u0431\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u0430 \u043F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u0440\u0438 \u043F\u043E\u0432\u043E\u0440\u043E\u0442\u0435 \u0438 \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u043E\u0433\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F." })] }));
}
export function EngineeringDraftCard({ tool, equipmentType, }) {
    if (tool === "engineeringPipe") {
        return (_jsxs("div", { className: "space-y-3", children: [_jsx(InfoCard, { rows: [{ label: "Режим", value: "Соединение порт-к-порту" }] }), _jsx(HintCard, { text: "\u041A\u043B\u0438\u043A\u043D\u0438\u0442\u0435 \u043F\u043E \u043F\u043E\u0440\u0442\u0443 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430, \u0437\u0430\u0442\u0435\u043C \u043F\u043E \u043F\u043E\u0440\u0442\u0443 \u0432\u0442\u043E\u0440\u043E\u0433\u043E. \u041C\u0430\u0440\u0448\u0440\u0443\u0442 \u043F\u043E\u0441\u0442\u0440\u043E\u0438\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0441 \u043E\u0440\u0442\u043E\u0433\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u043C\u0438 \u043A\u043E\u043B\u0435\u043D\u0430\u043C\u0438." })] }));
    }
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(InfoCard, { rows: [
                    { label: "Тип", value: ENGINEERING_EQUIPMENT_LABELS[equipmentType] },
                    { label: "Размещение", value: "Клик по плану" },
                ] }), _jsx(HintCard, { text: "\u0411\u043B\u043E\u043A \u0431\u0443\u0434\u0435\u0442 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D \u043A \u0441\u0435\u0442\u043A\u0435, \u0435\u0441\u043B\u0438 \u0448\u0430\u0433 \u0441\u0435\u0442\u043A\u0438 \u0432\u043A\u043B\u044E\u0447\u0435\u043D. \u041F\u043E\u0441\u043B\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u043C\u043E\u0436\u043D\u043E \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0430\u0442\u044C, \u0443\u0434\u0430\u043B\u044F\u0442\u044C \u0438 \u043F\u043E\u0432\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0442\u044C \u043D\u0430 90\u00B0." })] }));
}
function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function NumberField({ label, value, onChange, step, }) {
    return (_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-soft)]", children: [label, _jsx("input", { type: "number", step: step, value: Number.isFinite(value) ? value : 0, onChange: (event) => onChange(Number(event.target.value)), className: "ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]" })] }));
}
function TextField({ label, value, onChange, }) {
    return (_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-soft)]", children: [label, _jsx("input", { type: "text", value: value, onChange: (event) => onChange(event.target.value), className: "ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]" })] }));
}
function SelectField({ label, value, options, onChange, }) {
    return (_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-soft)]", children: [label, _jsx("select", { value: value, onChange: (event) => onChange(event.target.value), className: "ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]", children: options.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }));
}
function InfoCard({ rows }) {
    return (_jsx("div", { className: "ui-panel-muted rounded-[16px] p-3 text-xs text-[color:var(--text-muted)]", children: rows.map((row) => (_jsxs("div", { className: "flex items-center justify-between gap-3 py-1.5", children: [_jsx("span", { className: "uppercase tracking-wide text-[color:var(--text-soft)]", children: row.label }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: row.value })] }, row.label))) }));
}
function HintCard({ text }) {
    return (_jsx("div", { className: "rounded-[16px] border border-[color:var(--info-border)] bg-[color:var(--info-bg)] px-3 py-3 text-sm text-[color:var(--text-muted)]", children: text }));
}
