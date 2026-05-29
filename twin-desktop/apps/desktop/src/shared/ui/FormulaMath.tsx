import { BlockMath } from "react-katex";

type FormulaMathProps = {
  latex: string;
  className?: string;
};

/** Отображает LaTeX-формулу; при ошибке разбора показывает исходную строку. */
export function FormulaMath({ latex, className }: FormulaMathProps) {
  const trimmed = latex.trim();
  if (!trimmed) {
    return null;
  }

  return (
    <div className={["ui-formula-math", className].filter(Boolean).join(" ")}>
      <BlockMath
        math={trimmed}
        renderError={() => (
          <p className="ui-formula-math__fallback text-[11px] leading-5 text-[color:var(--text-soft)]">{trimmed}</p>
        )}
      />
    </div>
  );
}

export default FormulaMath;
