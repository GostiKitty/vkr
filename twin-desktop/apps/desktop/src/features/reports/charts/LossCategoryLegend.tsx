import { LOSS_CATEGORY_COLORS, LOSS_CATEGORY_LABELS } from "./thermalChartTheme";
import type { LossCategoryKey } from "../../../core/thermal/thermalResultsChartPayload";

const ORDER: LossCategoryKey[] = ["opaque", "window", "door", "infiltration", "ventilation"];

export function LossCategoryLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Легенда категорий потерь">
      {ORDER.map((key) => (
        <li
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-2.5 py-1 text-[11px] text-[color:var(--text-muted)]"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: LOSS_CATEGORY_COLORS[key] }} aria-hidden />
          {LOSS_CATEGORY_LABELS[key]}
        </li>
      ))}
    </ul>
  );
}
