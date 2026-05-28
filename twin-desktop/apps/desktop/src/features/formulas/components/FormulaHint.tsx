import { useMemo, useState } from "react";
import { BlockMath } from "react-katex";
import { getFormulasByIds } from "../../../entities/formulas/registry";
import { navigate } from "../../../app/router";

interface FormulaHintProps {
  ids: string[];
  label?: string;
}

export function FormulaHint({ ids, label = "Формулы" }: FormulaHintProps) {
  const [open, setOpen] = useState(false);
  const formulas = useMemo(() => getFormulasByIds(ids), [ids]);

  if (!formulas.length) {
    return null;
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text-muted)] shadow-sm transition hover:border-[color:var(--accent-muted)] hover:text-[color:var(--text-base)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-muted)]"
      >
        ƒ
        <span>{label}</span>
      </button>
      {open && (
        <div className="ui-overlay absolute right-0 top-full z-30 mt-2 w-80 p-3">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Связанные формулы</p>
          <ul className="mt-2 space-y-3">
            {formulas.map((formula) => (
              <li key={formula.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2">
                <div className="flex items-center justify-between text-sm font-semibold text-[color:var(--text-base)]">
                  <span>{formula.title}</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[color:var(--accent-base)] underline decoration-[color:var(--accent-muted)] underline-offset-2 hover:text-[color:var(--text-base)]"
                    onClick={() => navigate(`/formulas#formula-${formula.id}`)}
                  >
                    Открыть
                  </button>
                </div>
                <div className="mt-1 overflow-x-auto text-sm">
                  <BlockMath math={formula.latex} />
                </div>
                <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                  Переменные: {formula.variables.slice(0, 3).map((variable) => variable.key).join(", ")}
                  {formula.variables.length > 3 ? " …" : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default FormulaHint;
