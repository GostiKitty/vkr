import { jsx as _jsx } from "react/jsx-runtime";
import { BlockMath } from "react-katex";
/** Отображает LaTeX-формулу; при ошибке разбора показывает исходную строку. */
export function FormulaMath({ latex, className }) {
    const trimmed = latex.trim();
    if (!trimmed) {
        return null;
    }
    return (_jsx("div", { className: ["ui-formula-math", className].filter(Boolean).join(" "), children: _jsx(BlockMath, { math: trimmed, renderError: () => (_jsx("p", { className: "ui-formula-math__fallback text-[11px] leading-5 text-[color:var(--text-soft)]", children: trimmed })) }) }));
}
export default FormulaMath;
