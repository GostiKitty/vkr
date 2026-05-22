import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { BlockMath } from "react-katex";
import { getFormulasByIds } from "../../../entities/formulas/registry";
import { navigate } from "../../../app/router";
export function FormulaHint({ ids, label = "Формулы" }) {
    const [open, setOpen] = useState(false);
    const formulas = useMemo(() => getFormulasByIds(ids), [ids]);
    if (!formulas.length) {
        return null;
    }
    return (_jsxs("div", { className: "relative inline-flex", onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false), children: [_jsxs("button", { type: "button", onClick: () => setOpen((prev) => !prev), className: "inline-flex items-center gap-1 rounded-full border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] shadow-sm transition hover:border-[color:var(--accent-muted)] hover:text-[color:var(--text-base)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-muted)]", children: ["\u0192", _jsx("span", { children: label })] }), open && (_jsxs("div", { className: "ui-overlay absolute right-0 top-full z-30 mt-2 w-80 p-3", children: [_jsx("p", { className: "ui-kicker", children: "\u0421\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0435 \u0444\u043E\u0440\u043C\u0443\u043B\u044B" }), _jsx("ul", { className: "mt-2 space-y-3", children: formulas.map((formula) => (_jsxs("li", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2", children: [_jsxs("div", { className: "flex items-center justify-between text-xs font-semibold text-[color:var(--text-base)]", children: [_jsx("span", { children: formula.title }), _jsx("button", { type: "button", className: "text-[10px] font-semibold text-[color:var(--accent-base)] underline decoration-[color:var(--accent-muted)] underline-offset-2 hover:text-[color:var(--text-base)]", onClick: () => navigate(`/formulas#formula-${formula.id}`), children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C" })] }), _jsx("div", { className: "mt-1 overflow-x-auto text-sm", children: _jsx(BlockMath, { math: formula.latex }) }), _jsxs("p", { className: "mt-1 text-[11px] text-[color:var(--text-soft)]", children: ["\u041F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0435: ", formula.variables.slice(0, 3).map((variable) => variable.key).join(", "), formula.variables.length > 3 ? " …" : ""] })] }, formula.id))) })] }))] }));
}
export default FormulaHint;
