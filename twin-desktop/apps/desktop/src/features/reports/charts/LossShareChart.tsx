import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { LossShareBreakdown } from "../../../core/thermal/thermalSimulationExport";
import type { LossCategoryKey } from "../../../core/thermal/thermalResultsChartPayload";
import { LossCategoryLegend } from "./LossCategoryLegend";
import { ThermalChartTooltip } from "./ThermalChartTooltip";
import { CHART_AXIS_TICK, formatChartPercent, LOSS_CATEGORY_COLORS, LOSS_CATEGORY_LABELS } from "./thermalChartTheme";

const ORDER: LossCategoryKey[] = ["opaque", "window", "door", "infiltration", "ventilation"];

interface LossShareChartProps {
  share: LossShareBreakdown;
}

function LossShareTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload as { key: LossCategoryKey; percent: number };
  return (
    <ThermalChartTooltip
      active
      payload={payload}
      title={LOSS_CATEGORY_LABELS[row.key]}
      rows={[{ label: "Доля при пиковой нагрузке", value: formatChartPercent(row.percent) }]}
    />
  );
}

export function LossShareChart({ share }: LossShareChartProps) {
  const segments = useMemo(
    () =>
      ORDER.map((key) => ({
        key,
        name: LOSS_CATEGORY_LABELS[key],
        percent: share[key],
      })).filter((item) => Number.isFinite(item.percent) && item.percent > 0),
    [share]
  );

  const stackedRow = useMemo(() => {
    const row: Record<string, number | string> = { name: "Структура потерь" };
    for (const segment of segments) {
      row[segment.key] = segment.percent;
    }
    return row;
  }, [segments]);

  if (!segments.length) {
    return (
      <p className="text-sm text-[color:var(--text-muted)]">Доли потерь не заданы для текущего результата.</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">
        100% структура потерь (пиковый срез)
      </p>
      <LossCategoryLegend />
      <div className="h-14 w-full min-w-0 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[stackedRow]} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }} stackOffset="expand" accessibilityLayer>
            <XAxis type="number" hide domain={[0, 1]} />
            <YAxis type="category" dataKey="name" hide width={0} />
            <Tooltip content={<LossShareTooltip />} cursor={{ fill: "transparent" }} />
            {segments.map((segment) => (
              <Bar
                key={segment.key}
                dataKey={segment.key}
                stackId="share"
                fill={LOSS_CATEGORY_COLORS[segment.key]}
                radius={segment.key === segments[0].key ? [8, 0, 0, 8] : segment.key === segments[segments.length - 1].key ? [0, 8, 8, 0] : 0}
              >
                <Cell fill={LOSS_CATEGORY_COLORS[segment.key]} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {segments.map((segment) => (
          <li
            key={segment.key}
            className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm"
          >
            <span className="inline-flex items-center gap-2 text-[color:var(--text-muted)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LOSS_CATEGORY_COLORS[segment.key] }} aria-hidden />
              {segment.name}
            </span>
            <span className="tabular-nums font-semibold text-[color:var(--text-base)]">{formatChartPercent(segment.percent)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default LossShareChart;
