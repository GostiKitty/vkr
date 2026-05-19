import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ThermalSimulationResult } from "../../../core/thermal/solver";
import { formatTemperature } from "../../twin/twin.theme";

interface ThermalTimeSeriesChartProps {
  result: ThermalSimulationResult;
  roomId: string | null;
  roomLabel?: string;
}

export function ThermalTimeSeriesChart({ result, roomId, roomLabel }: ThermalTimeSeriesChartProps) {
  const data = useMemo(() => {
    if (!roomId || !result.rooms[roomId]) {
      return [];
    }
    const room = result.rooms[roomId];
    return room.timeline.map((point) => ({
      timeHours: point.timeHours,
      temperatureC: point.temperatureC,
      heatingPowerKW: point.heatingPowerW / 1000,
    }));
  }, [result, roomId]);

  if (!data.length) {
    return (
      <p className="text-sm text-[color:var(--text-muted)]">Выберите помещение, чтобы увидеть температуру во времени.</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">
        T(t) — {roomLabel ?? "помещение"}
      </p>
      <div className="h-52 w-full min-w-0 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="timeHours"
              tick={{ fill: "var(--text-soft)", fontSize: 11 }}
              tickFormatter={(value) => `${Number(value).toFixed(0)} ч`}
            />
            <YAxis
              tick={{ fill: "var(--text-soft)", fontSize: 11 }}
              tickFormatter={(value) => `${Number(value).toFixed(0)}°`}
              width={36}
            />
            <Tooltip
              formatter={(value: number, name) => [
                name === "temperatureC" ? formatTemperature(value) : `${value.toFixed(2)} кВт`,
                name === "temperatureC" ? "Температура" : "Отопление",
              ]}
              labelFormatter={(label) => `t = ${Number(label).toFixed(1)} ч`}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-soft)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="temperatureC"
              stroke="var(--chart-line)"
              strokeWidth={2}
              dot={false}
              name="temperatureC"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ThermalTimeSeriesChart;
