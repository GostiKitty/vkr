import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { LossShareBreakdown } from "../../../core/thermal/thermalSimulationExport";
import type { LossCategoryKey } from "../../../core/thermal/thermalResultsChartPayload";
import { MetricInfoTooltip } from "../../../shared/ui";
import { resultsMetricInfo } from "../resultsMetricInfo";
import { LossCategoryLegend } from "./LossCategoryLegend";
import { ThermalChartTooltip } from "./ThermalChartTooltip";
import { formatChartPercent, LOSS_CATEGORY_COLORS, LOSS_CATEGORY_LABELS } from "./thermalChartTheme";

const ORDER: LossCategoryKey[] = ["opaque", "window", "door", "infiltration", "ventilation"];

interface LossShareChartProps {
  share: LossShareBreakdown;
}

function LossShareTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload as { key: LossCategoryKey; percent: number; name: string };
  return (
    <ThermalChartTooltip
      active
      payload={payload}
      title={`${row.name} · ${formatChartPercent(row.percent)}`}
      rows={[]}
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

  if (!segments.length) {
    return (
      <section className="ui-chart-shell">
        <ShareChartHeader />
        <div className="ui-loss-chart__empty">Доли потерь не заданы для текущего результата.</div>
      </section>
    );
  }

  return (
    <section className="ui-chart-shell" data-testid="loss-share-chart">
      <ShareChartHeader />
      <LossCategoryLegend className="mt-3" variant="compact" />

      <div className="ui-loss-share mt-4">
        <div className="ui-loss-share__donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer>
              <Pie
                data={segments}
                dataKey="percent"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="var(--surface-elevated)"
                strokeWidth={2}
              >
                {segments.map((segment) => (
                  <Cell key={segment.key} fill={LOSS_CATEGORY_COLORS[segment.key]} />
                ))}
              </Pie>
              <Tooltip content={<LossShareTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="ui-loss-share__list">
          {[...segments]
            .sort((a, b) => b.percent - a.percent)
            .map((segment) => (
            <li key={segment.key} className="ui-loss-share__item">
              <div className="ui-loss-share__item-head">
                <span className="ui-loss-share__item-label">
                  <span
                    className="ui-loss-chart__swatch"
                    style={{ backgroundColor: LOSS_CATEGORY_COLORS[segment.key] }}
                    aria-hidden
                  />
                  {segment.name}
                </span>
                <span className="ui-loss-share__item-value">{formatChartPercent(segment.percent)}</span>
              </div>
              <div className="ui-loss-share__item-track" aria-hidden>
                <div
                  className="ui-loss-share__item-fill"
                  style={{
                    width: `${segment.percent}%`,
                    backgroundColor: LOSS_CATEGORY_COLORS[segment.key],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ShareChartHeader() {
  return (
    <header className="ui-loss-chart__head">
      <div>
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Структура теплопотерь</h3>
          <MetricInfoTooltip {...resultsMetricInfo.lossShareBreakdown} />
        </div>
        <p className="mt-0.5 text-xs text-[color:var(--text-soft)]">100% всех теплопотерь в пиковом срезе</p>
      </div>
    </header>
  );
}

export default LossShareChart;
