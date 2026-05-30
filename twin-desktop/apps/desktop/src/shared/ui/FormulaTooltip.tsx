import type { ReactNode } from "react";
import Tooltip from "./Tooltip";
import { IconInfo } from "./icons";

interface FormulaTooltipProps {
  title: string;
  meaning: string;
  formula?: string | null;
  inputs?: string | string[] | null;
  notes?: string | string[] | null;
  linkedFormulaIds?: string[];
  className?: string;
  children?: ReactNode;
}

const normalizeItems = (value?: string | string[] | null): string[] => {
  if (!value) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter(Boolean);
};

export function FormulaTooltip({
  title,
  meaning,
  formula,
  notes,
  linkedFormulaIds,
  className,
  children,
}: FormulaTooltipProps) {
  const details = [...normalizeItems(notes)];

  return (
    <Tooltip
      title={title}
      description={meaning}
      formulaLatex={formula}
      details={details}
      linkedFormulaIds={linkedFormulaIds ?? []}
      className={className}
    >
      {children ?? (
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-base)]"
          aria-label={`Информация: ${title}`}
        >
          <IconInfo size={14} />
        </button>
      )}
    </Tooltip>
  );
}

/** Компактная подсказка для KPI: только название и формула, без текстовых пояснений. */
export function MetricInfoTooltip({
  title,
  formula,
  description,
  meaning,
  linkedFormulaIds,
  className,
  children,
}: Pick<FormulaTooltipProps, "title" | "formula" | "linkedFormulaIds" | "className" | "children"> & {
  description?: string;
  meaning?: string;
}) {
  return (
    <Tooltip
      title={title}
      description={description ?? meaning}
      formulaLatex={formula}
      linkedFormulaIds={linkedFormulaIds ?? []}
      className={className}
    >
      {children ?? (
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-base)]"
          aria-label={`Информация: ${title}`}
        >
          <IconInfo size={14} />
        </button>
      )}
    </Tooltip>
  );
}

export default FormulaTooltip;
