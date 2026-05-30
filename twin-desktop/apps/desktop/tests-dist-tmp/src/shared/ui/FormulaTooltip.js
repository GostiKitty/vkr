import { jsx as _jsx } from "react/jsx-runtime";
import Tooltip from "./Tooltip";
import { IconInfo } from "./icons";
const normalizeItems = (value) => {
    if (!value) {
        return [];
    }
    return (Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter(Boolean);
};
export function FormulaTooltip({ title, meaning, formula, inputs, notes, linkedFormulaIds, className, children, }) {
    const details = [
        ...normalizeItems(inputs).map((item) => `Входные данные: ${item}`),
        ...normalizeItems(notes),
    ];
    return (_jsx(Tooltip, { title: title, description: meaning, formulaLatex: formula, details: details, linkedFormulaIds: linkedFormulaIds ?? [], className: className, children: children ?? (_jsx("button", { type: "button", className: "inline-flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-base)]", "aria-label": `Информация: ${title}`, children: _jsx(IconInfo, { size: 14 }) })) }));
}
/** Компактная подсказка для KPI: только название и формула, без текстовых пояснений. */
export function MetricInfoTooltip({ title, formula, linkedFormulaIds, className, children, }) {
    return (_jsx(Tooltip, { title: title, formulaLatex: formula, linkedFormulaIds: linkedFormulaIds ?? [], className: className, children: children ?? (_jsx("button", { type: "button", className: "inline-flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-base)]", "aria-label": `Информация: ${title}`, children: _jsx(IconInfo, { size: 14 }) })) }));
}
export default FormulaTooltip;
