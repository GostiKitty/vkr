import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ThermalMonteCarloResult } from "../../../core/uncertainty/thermalMonteCarlo";
import { MetricInfoTooltip } from "../../../shared/ui";
import { formatNumber } from "../../../shared/utils/format";
import { resultsMetricInfo } from "../resultsMetricInfo";

interface MonteCarloChartProps {
  result: ThermalMonteCarloResult;
  baselineEnergyKWh?: number | null;
}

export function MonteCarloChart({ result, baselineEnergyKWh = null }: MonteCarloChartProps) {
  const histogramData = useMemo(
    () =>
      result.totalEnergy.histogram.map((bin) => ({
        mid: bin.mid,
        count: bin.count,
        label: `${formatNumber(bin.binStart, { maximumFractionDigits: 1 })}–${formatNumber(bin.binEnd, {
          maximumFractionDigits: 1,
        })} кВт·ч`,
      })),
    [result.totalEnergy.histogram]
  );

  const markers = useMemo(
    () =>
      [
        { key: "p10", label: "P10", value: result.totalEnergy.p10, stroke: "var(--chart-line-muted)", dash: "4 4" },
        { key: "p50", label: "P50", value: result.totalEnergy.p50, stroke: "var(--accent-base)", dash: undefined },
        { key: "p90", label: "P90", value: result.totalEnergy.p90, stroke: "var(--warning-border)", dash: "8 4" },
        baselineEnergyKWh == null
          ? null
          : { key: "base", label: "База", value: baselineEnergyKWh, stroke: "var(--danger-border)", dash: "2 3" },
      ].filter(
        (entry): entry is { key: string; label: string; value: number; stroke: string; dash?: string } => entry !== null
      ),
    [baselineEnergyKWh, result.totalEnergy.p10, result.totalEnergy.p50, result.totalEnergy.p90]
  );

  return (
    <section className="ui-chart-shell">
      <div className="mb-3">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Распределение энергии за период</p>
          <MetricInfoTooltip {...resultsMetricInfo.monteCarloHistogram} />
        </div>
      </div>

      <div className="ui-chart-shell__body rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={histogramData} margin={{ top: 8, right: 16, bottom: 6, left: 4 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="mid"
              tick={{ fill: "var(--text-soft)", fontSize: 11 }}
              tickFormatter={(value) => formatNumber(Number(value), { maximumFractionDigits: 0 })}
              domain={["dataMin", "dataMax"]}
            >
              <Label value="Энергия, кВт·ч" position="insideBottom" offset={-4} fill="var(--text-soft)" fontSize={11} />
            </XAxis>
            <YAxis tick={{ fill: "var(--text-soft)", fontSize: 11 }} allowDecimals={false} width={56}>
              <Label
                value="Сценарии, шт."
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 }}
              />
            </YAxis>
            <Tooltip
              formatter={(value: number) => [`${formatNumber(value, { maximumFractionDigits: 0 })}`, "Сценарии"]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-soft)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="count"
              fill="var(--accent-soft)"
              radius={[8, 8, 0, 0]}
              barSize={14}
              isAnimationActive
              animationDuration={780}
              animationEasing="ease-out"
            />
            {markers.map((marker) => (
              <ReferenceLine
                key={marker.key}
                x={marker.value}
                stroke={marker.stroke}
                strokeWidth={2}
                strokeDasharray={marker.dash}
                ifOverflow="extendDomain"
                label={{
                  value: marker.label,
                  position: "top",
                  fill: marker.stroke,
                  fontSize: 11,
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <LegendChip
          label="P10"
          value={`${formatNumber(result.totalEnergy.p10, { maximumFractionDigits: 1 })} кВт·ч`}
          borderClass="border-[color:var(--border-soft)]"
        />
        <LegendChip
          label="P50"
          value={`${formatNumber(result.totalEnergy.p50, { maximumFractionDigits: 1 })} кВт·ч`}
          borderClass="border-[color:var(--accent-base)]/35"
        />
        <LegendChip
          label="P90"
          value={`${formatNumber(result.totalEnergy.p90, { maximumFractionDigits: 1 })} кВт·ч`}
          borderClass="border-[color:var(--warning-border)]"
        />
        {baselineEnergyKWh != null ? (
          <LegendChip
            label="Базовый расчёт"
            value={`${formatNumber(baselineEnergyKWh, { maximumFractionDigits: 1 })} кВт·ч`}
            borderClass="border-[color:var(--danger-border)]"
          />
        ) : null}
      </div>
    </section>
  );
}

function LegendChip({
  label,
  value,
  borderClass,
}: {
  label: string;
  value: string;
  borderClass: string;
}) {
  return (
    <div className={`rounded-2xl border bg-[color:var(--surface-overlay)] px-3 py-2 text-[color:var(--text-muted)] ${borderClass}`}>
      <p className="font-semibold text-[color:var(--text-base)]">{label}</p>
      <p>{value}</p>
    </div>
  );
}

export default MonteCarloChart;
