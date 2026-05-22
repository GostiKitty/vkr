import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

interface ThermalChartTooltipProps extends TooltipProps<ValueType, NameType> {
  title?: string;
  rows?: Array<{ label: string; value: string }>;
  footnote?: string;
}

export function ThermalChartTooltip({ active, payload, title, rows, footnote }: ThermalChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload as Record<string, unknown> | undefined;
  const resolvedTitle =
    title ??
    (typeof item?.label === "string" ? item.label : undefined) ??
    (typeof item?.zoneName === "string" ? item.zoneName : undefined) ??
    "";

  const resolvedRows =
    rows ??
    payload.map((entry) => ({
      label: String(entry.name ?? ""),
      value: String(entry.value ?? ""),
    }));

  return (
    <div className="ui-overlay max-w-[min(320px,90vw)] rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2.5 text-xs shadow-lg">
      {resolvedTitle ? <p className="font-semibold text-[color:var(--text-base)]">{resolvedTitle}</p> : null}
      <dl className={resolvedTitle ? "mt-2 space-y-1" : "space-y-1"}>
        {resolvedRows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-[color:var(--text-soft)]">{row.label}</dt>
            <dd className="tabular-nums font-medium text-[color:var(--text-base)]">{row.value}</dd>
          </div>
        ))}
      </dl>
      {footnote ? <p className="mt-2 border-t border-[color:var(--border-soft)] pt-2 text-[color:var(--text-soft)]">{footnote}</p> : null}
    </div>
  );
}
