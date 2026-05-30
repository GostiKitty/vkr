import { useEffect, useMemo, useRef } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { useFormulaDrawerStore } from "../../entities/formulas/formulaDrawer.store";
import { getFormulasByIds } from "../../entities/formulas/registry";

export function FormulaDrawer() {
  const { isOpen, formulaIds, activeFormulaId, close } = useFormulaDrawerStore();
  const formulas = useMemo(() => getFormulasByIds(formulaIds), [formulaIds]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !activeFormulaId) {
      return;
    }
    const node = containerRef.current?.querySelector<HTMLDivElement>(`[data-formula-id="${activeFormulaId}"]`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isOpen, activeFormulaId]);

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="ui-drawer-panel fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/96 shadow-[var(--shadow-overlay)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-[color:var(--border-soft)] px-5 py-3">
        <h2 className="text-base font-semibold text-[color:var(--text-base)]">Формулы</h2>
        <button type="button" onClick={close} className="ui-btn-secondary rounded-full px-3 py-1 text-xs font-semibold">
          Закрыть
        </button>
      </div>
      <div ref={containerRef} className="h-[calc(100%-52px)] space-y-4 overflow-y-auto px-5 py-4">
        {formulas.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            Выберите действие с подсказкой «Формулы», чтобы открыть связанную методику.
          </p>
        ) : (
          formulas.map((formula) => (
            <article
              key={formula.id}
              data-formula-id={formula.id}
              className={`ui-hover-lift space-y-3 rounded-2xl border bg-[color:var(--surface-base)] p-4 shadow-sm ${
                activeFormulaId === formula.id
                  ? "border-[color:var(--accent-muted)] ring-1 ring-[color:var(--accent-muted)]"
                  : "border-[color:var(--border-soft)]"
              }`}
            >
              <h3 className="text-base font-semibold text-[color:var(--text-base)]">{formula.title}</h3>

              <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
                <BlockMath math={formula.latex} />
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]">
                <table className="w-full text-left text-sm text-[color:var(--text-muted)]">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                      <th className="px-3 py-2 font-semibold">Переменная</th>
                      <th className="px-3 py-2 font-semibold">Описание</th>
                      <th className="px-3 py-2 font-semibold">Ед.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formula.variables.map((variable) => (
                      <tr key={variable.key} className="border-t border-[color:var(--border-soft)]">
                        <td className="px-3 py-2 font-semibold text-[color:var(--text-base)]">
                          {variable.symbolLatex ? <InlineMath math={variable.symbolLatex} /> : variable.key}
                        </td>
                        <td className="px-3 py-2">{variable.label}</td>
                        <td className="px-3 py-2">{variable.unit ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-3 text-sm text-[color:var(--text-muted)]">
                <span className="font-semibold text-[color:var(--text-base)]">Физический смысл:</span>{" "}
                {formula.physicalMeaning}
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

export default FormulaDrawer;
