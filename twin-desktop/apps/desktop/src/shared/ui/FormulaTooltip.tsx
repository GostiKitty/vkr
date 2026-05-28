import type { ReactNode } from "react";
import Tooltip from "./Tooltip";
import { IconInfo } from "./icons";

interface FormulaTooltipProps {
  title: string;
  meaning: string;
  formula?: string | null;
  inputs?: string | string[] | null;
  calculatedIn?: string | null;
  notes?: string | string[] | null;
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
  inputs,
  calculatedIn,
  notes,
  className,
  children,
}: FormulaTooltipProps) {
  const details = [
    ...(formula ? [`Формула: ${formula}`] : []),
    ...normalizeItems(inputs).map((item) => `Входные данные: ${item}`),
    ...(calculatedIn ? [`Где считается: ${calculatedIn}`] : []),
    ...normalizeItems(notes),
  ];

  return (
    <Tooltip title={title} description={meaning} details={details} className={className}>
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

export const MetricInfoTooltip = FormulaTooltip;

export default FormulaTooltip;
