import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ThermalMonteCarloResult } from "../../../core/uncertainty/thermalMonteCarlo";

interface MonteCarloChartProps {
  result: ThermalMonteCarloResult;
}

export function MonteCarloChart({ result }: MonteCarloChartProps) {
  const histogramData = useMemo(
    () =>
      result.peakLoad.histogram.map((bin) => ({
        mid: bin.mid,
        probability: bin.probability * 100,
        label: `${bin.binStart.toFixed(1)}–${bin.binEnd.toFixed(1)}`,
      })),
    [result.peakLoad.histogram]
  );

  const cdfData = useMemo(
    () =>
      result.peakLoad.cdf.map((point) => ({
        value: point.value,
        probability: point.probability * 100,
      })),
    [result.peakLoad.cdf]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">
          Пиковая нагрузка — гистограмма ({result.runs} прогонов)
        </p>
        <div className="h-48 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={histogramData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="mid" tick={{ fill: "var(--text-soft)", fontSize: 10 }} tickFormatter={(v) => `${v}`} />
              <YAxis tick={{ fill: "var(--text-soft)", fontSize: 10 }} width={36} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)}%`, "Вероятность"]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
                contentStyle={{
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="probability" stroke="var(--chart-line)" fill="var(--accent-soft)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">
          P5={result.peakLoad.p5.toFixed(2)} кВт · P50={result.peakLoad.p50.toFixed(2)} кВт · P95=
          {result.peakLoad.p95.toFixed(2)} кВт
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">CDF пиковой нагрузки</p>
        <div className="h-48 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cdfData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="value" tick={{ fill: "var(--text-soft)", fontSize: 10 }} />
              <YAxis tick={{ fill: "var(--text-soft)", fontSize: 10 }} width={36} domain={[0, 100]} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Накопленная вероятность"]}
                labelFormatter={(label) => `${Number(label).toFixed(2)} кВт`}
                contentStyle={{
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="probability" stroke="var(--chart-line-muted)" fill="var(--surface-strong)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default MonteCarloChart;
