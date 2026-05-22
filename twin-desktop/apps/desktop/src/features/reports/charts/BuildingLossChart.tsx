import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { LossCategoryKey } from "../../../core/thermal/thermalResultsChartPayload";
import { LossCategoryLegend } from "./LossCategoryLegend";
import { ThermalChartTooltip } from "./ThermalChartTooltip";
import {
  CHART_AXIS_TICK,
  CHART_MARGIN_VERTICAL,
  formatChartAxisPower,
  formatChartPercent,
  formatChartPower,
  LOSS_CATEGORY_COLORS,
} from "./thermalChartTheme";

export type BuildingLossChartRow = {
  key: LossCategoryKey;
  label: string;
  valueW: number;
  share: number;
  note: string;
};

function BuildingLossTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload as BuildingLossChartRow;
  return (
    <ThermalChartTooltip
      active
      payload={payload}
      title={row.label}
      rows={[
        { label: "Потери", value: formatChartPower(row.valueW) },
        { label: "Доля", value: formatChartPercent(row.share) },
      ]}
      footnote={row.note}
    />
  );
}

interface BuildingLossChartProps {
  rows: BuildingLossChartRow[];
}

export function BuildingLossChart({ rows }: BuildingLossChartProps) {
  const data = useMemo(
    () => [...rows].filter((row) => Number.isFinite(row.valueW) && row.valueW > 0).sort((a, b) => b.valueW - a.valueW),
    [rows]
  );

  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 text-center text-sm text-[color:var(--text-soft)]">
        Теплопотери по компонентам не заданы.
      </div>
    );
  }

  return (
    <figure aria-labelledby="building-loss-title" aria-describedby="building-loss-desc">
      <figcaption id="building-loss-title" className="sr-only">
        Теплопотери по компонентам
      </figcaption>
      <p id="building-loss-desc" className="sr-only">
        Горизонтальная диаграмма показывает теплопотери через ограждения, окна, двери и инфильтрацию в ваттах.
      </p>
      <LossCategoryLegend className="mb-3" />
      <div className="h-64 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-2 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={CHART_MARGIN_VERTICAL} accessibilityLayer>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={CHART_AXIS_TICK} tickFormatter={formatChartAxisPower} />
            <YAxis dataKey="label" type="category" width={168} tick={CHART_AXIS_TICK} />
            <Tooltip content={<BuildingLossTooltip />} cursor={{ fill: "var(--accent-muted)", fillOpacity: 0.12 }} />
            <Bar dataKey="valueW" radius={[0, 8, 8, 0]} maxBarSize={32}>
              {data.map((row) => (
                <Cell key={row.key} fill={LOSS_CATEGORY_COLORS[row.key]} />
              ))}
              <LabelList
                dataKey="valueW"
                position="right"
                formatter={(value: number) => formatChartPower(Number(value))}
                fill="var(--text-muted)"
                fontSize={10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
