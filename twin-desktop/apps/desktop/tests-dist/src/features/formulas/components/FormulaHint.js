import React, { useMemo, useState } from "react";
import { BlockMath } from "react-katex";
import { getFormulasByIds } from "../../../entities/formulas/registry";
import { navigate } from "../../../app/router";
export function FormulaHint({ ids, label = "Формулы" }) {
    const [open, setOpen] = useState(false);
    const formulas = useMemo(() => getFormulasByIds(ids), [ids.join("|")]);
    if (!formulas.length) {
        return null;
    }
    return (<div className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400">
        ƒ
        <span>{label}</span>
      </button>
      {open && (<div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Связанные формулы</p>
          <ul className="mt-2 space-y-3">
            {formulas.map((formula) => (<li key={formula.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>{formula.title}</span>
                  <button type="button" className="text-[10px] text-slate-500 underline hover:text-slate-700" onClick={() => navigate(`/formulas#formula-${formula.id}`)}>
                    Открыть
                  </button>
                </div>
                <div className="mt-1 overflow-x-auto text-sm">
                  <BlockMath math={formula.latex}/>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Переменные: {formula.variables.slice(0, 3).map((variable) => variable.key).join(", ")}
                  {formula.variables.length > 3 ? " …" : ""}
                </p>
              </li>))}
          </ul>
        </div>)}
    </div>);
}
export default FormulaHint;
