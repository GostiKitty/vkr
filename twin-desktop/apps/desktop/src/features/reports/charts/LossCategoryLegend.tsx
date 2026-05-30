import { LOSS_CATEGORY_COLORS, LOSS_CATEGORY_LABELS } from "./thermalChartTheme";
import type { LossCategoryKey } from "../../../core/thermal/thermalResultsChartPayload";

const ORDER: LossCategoryKey[] = ["opaque", "window", "door", "infiltration", "ventilation"];

export function LossCategoryLegend({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "compact";
}) {
  const itemClass =
    variant === "compact"
      ? "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] text-[color:var(--text-soft)]"
      : "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-2.5 py-1 text-[11px] text-[color:var(--text-muted)]";

  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Легенда категорий потерь">
      {ORDER.map((key) => (
        <li key={key} className={itemClass}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: LOSS_CATEGORY_COLORS[key] }} aria-hidden />
          {LOSS_CATEGORY_LABELS[key]}
        </li>
      ))}
    </ul>
  );
}
