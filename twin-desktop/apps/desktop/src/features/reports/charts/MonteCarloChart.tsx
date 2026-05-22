import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ThermalMonteCarloResult } from "../../../core/uncertainty/thermalMonteCarlo";
import { formatNumber } from "../../../shared/utils/format";

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
        { key: "p10", label: "P10", value: result.totalEnergy.p10, stroke: "var(--chart-line-muted)" },
        { key: "p50", label: "P50", value: result.totalEnergy.p50, stroke: "var(--accent-base)" },
        { key: "p90", label: "P90", value: result.totalEnergy.p90, stroke: "var(--warning-border)" },
        baselineEnergyKWh == null
          ? null
          : { key: "base", label: "База", value: baselineEnergyKWh, stroke: "var(--danger-border)" },
      ].filter((entry): entry is { key: string; label: string; value: number; stroke: string } => entry !== null),
    [baselineEnergyKWh, result.totalEnergy.p10, result.totalEnergy.p50, result.totalEnergy.p90]
  );

  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Гистограмма энергопотребления</p>
        <p className="text-sm text-[color:var(--text-muted)]">
          X: totalEnergyKWh, Y: количество сценариев. Маркеры показывают P10, P50, P90 и базовый сценарий.
        </p>
      </div>

      <div className="h-80 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={histogramData} margin={{ top: 8, right: 16, bottom: 6, left: 4 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="mid"
              tick={{ fill: "var(--text-soft)", fontSize: 11 }}
              tickFormatter={(value) => formatNumber(Number(value), { maximumFractionDigits: 0 })}
              domain={["dataMin", "dataMax"]}
            />
            <YAxis
              tick={{ fill: "var(--text-soft)", fontSize: 11 }}
              allowDecimals={false}
              width={42}
            />
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
            <Bar dataKey="count" fill="var(--accent-soft)" radius={[8, 8, 0, 0]} barSize={14} />
            {markers.map((marker) => (
              <ReferenceLine
                key={marker.key}
                x={marker.value}
                stroke={marker.stroke}
                strokeWidth={2}
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

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--text-muted)]">
        <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1">
          P10: {formatNumber(result.totalEnergy.p10, { maximumFractionDigits: 1 })} кВт·ч
        </span>
        <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1">
          P50: {formatNumber(result.totalEnergy.p50, { maximumFractionDigits: 1 })} кВт·ч
        </span>
        <span className="rounded-full border border-[color:var(--border-soft)] px-3 py-1">
          P90: {formatNumber(result.totalEnergy.p90, { maximumFractionDigits: 1 })} кВт·ч
        </span>
        {baselineEnergyKWh != null ? (
          <span className="rounded-full border border-[color:var(--danger-border)] px-3 py-1 text-[color:var(--text-base)]">
            Базовый сценарий: {formatNumber(baselineEnergyKWh, { maximumFractionDigits: 1 })} кВт·ч
          </span>
        ) : null}
      </div>
    </section>
  );
}

export default MonteCarloChart;
