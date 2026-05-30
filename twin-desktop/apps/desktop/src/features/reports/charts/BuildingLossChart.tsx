import { useMemo } from "react";
import type { LossCategoryKey } from "../../../core/thermal/thermalResultsChartPayload";
import { MetricInfoTooltip } from "../../../shared/ui";
import { resultsMetricInfo } from "../resultsMetricInfo";
import { LossCategoryLegend } from "./LossCategoryLegend";
import {
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

interface BuildingLossChartProps {
  rows: BuildingLossChartRow[];
}

export function BuildingLossChart({ rows }: BuildingLossChartProps) {
  const data = useMemo(
    () => [...rows].filter((row) => Number.isFinite(row.valueW) && row.valueW > 0).sort((a, b) => b.valueW - a.valueW),
    [rows]
  );

  const totalW = useMemo(() => data.reduce((sum, row) => sum + row.valueW, 0), [data]);
  const maxW = data[0]?.valueW ?? 0;

  if (!data.length) {
    return (
      <section className="ui-chart-shell" data-testid="building-loss-chart">
        <ChartHeader totalW={null} />
        <div className="ui-loss-chart__empty">
          Теплопотери по компонентам не заданы.
        </div>
      </section>
    );
  }

  return (
    <section className="ui-chart-shell" data-testid="building-loss-chart" aria-labelledby="building-loss-title">
      <ChartHeader totalW={totalW} />
      <LossCategoryLegend className="mt-3" variant="compact" />
      <ol className="ui-loss-chart__bars mt-4 space-y-3" aria-describedby="building-loss-desc">
        {data.map((row, index) => {
          const widthPct = maxW > 0 ? (row.valueW / maxW) * 100 : 0;
          return (
            <li key={row.key} className="ui-loss-chart__row group" style={{ animationDelay: `${index * 45}ms` }}>
              <div className="ui-loss-chart__row-head">
                <span className="ui-loss-chart__row-label">
                  <span
                    className="ui-loss-chart__swatch"
                    style={{ backgroundColor: LOSS_CATEGORY_COLORS[row.key] }}
                    aria-hidden
                  />
                  {row.label}
                </span>
                <span className="ui-loss-chart__row-values">
                  <span className="ui-loss-chart__power">{formatChartPower(row.valueW)}</span>
                  <span className="ui-loss-chart__share">{formatChartPercent(row.share)}</span>
                </span>
              </div>
              <div
                className="ui-loss-chart__track"
                role="img"
                aria-label={`${row.label}: ${formatChartPower(row.valueW)}, ${formatChartPercent(row.share)}`}
              >
                <div
                  className="ui-loss-chart__fill"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: LOSS_CATEGORY_COLORS[row.key],
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>
      <p id="building-loss-desc" className="sr-only">
        Горизонтальная диаграмма показывает теплопотери через ограждения, окна, двери и инфильтрацию в ваттах.
      </p>
    </section>
  );
}

function ChartHeader({ totalW }: { totalW: number | null }) {
  return (
    <header className="ui-loss-chart__head">
      <div>
        <div className="flex items-center gap-1.5">
          <h3 id="building-loss-title" className="text-sm font-semibold text-[color:var(--text-base)]">
            Теплопотери по компонентам
          </h3>
          <MetricInfoTooltip {...resultsMetricInfo.buildingLossBreakdown} />
        </div>
      </div>
      {totalW != null ? (
        <div className="ui-loss-chart__total">
          <span className="ui-loss-chart__total-label">Суммарно</span>
          <span className="ui-loss-chart__total-value">{formatChartPower(totalW)}</span>
        </div>
      ) : null}
    </header>
  );
}

export default BuildingLossChart;
