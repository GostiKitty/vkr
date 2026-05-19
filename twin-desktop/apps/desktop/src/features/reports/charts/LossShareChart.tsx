import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LossShareBreakdown } from "../../../core/thermal/thermalSimulationExport";

const LABELS: Record<keyof LossShareBreakdown, string> = {
  opaque: "Стены",
  window: "Окна",
  door: "Двери",
  infiltration: "Инфильтрация",
};

interface LossShareChartProps {
  share: LossShareBreakdown;
}

export function LossShareChart({ share }: LossShareChartProps) {
  const data = (Object.keys(share) as Array<keyof LossShareBreakdown>).map((key) => ({
    name: LABELS[key],
    percent: share[key],
  }));

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">
        Доли потерь при пиковой нагрузке
      </p>
      <div className="h-48 w-full min-w-0 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--text-soft)", fontSize: 11 }} />
            <YAxis
              tick={{ fill: "var(--text-soft)", fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
              width={40}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Доля"]}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-soft)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Bar dataKey="percent" fill="var(--chart-line)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LossShareChart;
