import React, { useMemo, useRef, useEffect } from "react";
import { BlockMath } from "react-katex";
import { useFormulaDrawerStore } from "../../entities/formulas/formulaDrawer.store";
import { getFormulasByIds } from "../../entities/formulas/registry";
export function FormulaDrawer() {
    const { isOpen, pinned, formulaIds, activeFormulaId, close, togglePin, focus } = useFormulaDrawerStore();
    const formulas = useMemo(() => getFormulasByIds(formulaIds), [formulaIds]);
    const containerRef = useRef(null);
    useEffect(() => {
        if (!isOpen || !activeFormulaId) {
            return;
        }
        const node = containerRef.current?.querySelector(`[data-formula-id="${activeFormulaId}"]`);
        if (node) {
            node.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [isOpen, activeFormulaId]);
    if (!isOpen && !pinned) {
        return null;
    }
    return (<aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-slate-200 bg-white/95 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Формулы</p>
          <p className="text-base font-semibold text-slate-900">Теория, используемая действием</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={togglePin} className={`rounded-full border px-3 py-1 text-xs font-semibold ${pinned ? "border-emerald-500 text-emerald-600" : "border-slate-300 text-slate-600"}`}>
            {pinned ? "Закреплено" : "Закрепить"}
          </button>
          <button type="button" onClick={close} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-500">
            Закрыть
          </button>
        </div>
      </div>
      <div ref={containerRef} className="h-[calc(100%-60px)] overflow-y-auto px-5 py-4 space-y-4">
        {formulas.length === 0 ? (<p className="text-sm text-slate-500">Выберите действие с подсказкой «Формулы», чтобы увидеть подробности.</p>) : (formulas.map((formula) => (<article key={formula.id} data-formula-id={formula.id} className={`space-y-3 rounded-2xl border ${activeFormulaId === formula.id ? "border-slate-400" : "border-slate-200"} bg-white/90 p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{formula.id}</p>
                  <h3 className="text-base font-semibold text-slate-900">{formula.title}</h3>
                </div>
                <button type="button" onClick={() => focus(formula.id)} className="text-xs font-semibold text-slate-500 underline hover:text-slate-800">
                  В фокус
                </button>
              </div>
              <p className="text-sm text-slate-600">{formula.description}</p>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <BlockMath math={formula.latex}/>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/70">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-semibold">Переменная</th>
                      <th className="px-3 py-2 font-semibold">Описание</th>
                      <th className="px-3 py-2 font-semibold">Ед.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formula.variables.map((variable) => (<tr key={variable.key} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-900">{variable.key}</td>
                        <td className="px-3 py-2">{variable.label}</td>
                        <td className="px-3 py-2">{variable.unit ?? "—"}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            </article>)))}
      </div>
    </aside>);
}
export default FormulaDrawer;
