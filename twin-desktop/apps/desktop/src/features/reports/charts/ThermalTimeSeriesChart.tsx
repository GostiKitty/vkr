import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ThermalSimulationResult } from "../../../core/thermal/solver";
import { formatTemperature } from "../../twin/twin.theme";
import { CHART_AXIS_TICK, CHART_MARGIN, CHART_TOOLTIP_STYLE, formatChartPower } from "./thermalChartTheme";

interface ThermalTimeSeriesChartProps {
  result: ThermalSimulationResult;
  roomId: string | null;
  roomLabel?: string;
  setpointC?: number | null;
}

export function ThermalTimeSeriesChart({ result, roomId, roomLabel, setpointC }: ThermalTimeSeriesChartProps) {
  const data = useMemo(() => {
    if (!roomId || !result.rooms[roomId]) {
      return [];
    }
    const room = result.rooms[roomId];
    return room.timeline.map((point) => ({
      timeHours: point.timeHours,
      temperatureC: point.temperatureC,
      heatingPowerW: point.heatingPowerW,
    }));
  }, [result, roomId]);

  if (!data.length) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 text-center text-sm text-[color:var(--text-muted)]">
        Выберите помещение, чтобы увидеть температуру и мощность отопления во времени.
      </div>
    );
  }

  const setpoint = Number.isFinite(setpointC) ? (setpointC as number) : null;

  return (
    <div className="ui-panel-muted space-y-2 rounded-2xl p-4">
      <p className="text-sm font-semibold text-[color:var(--text-base)]">Динамика по помещению</p>
      <p className="text-xs text-[color:var(--text-soft)]">
        T(t) и мощность отопления — {roomLabel ?? "помещение"}. Данные из RC-модели, не CFD.
      </p>
      <div className="h-56 w-full min-w-0 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN} accessibilityLayer>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="timeHours"
              tick={CHART_AXIS_TICK}
              tickFormatter={(value) => `${Number(value).toFixed(0)} ч`}
            />
            <YAxis
              yAxisId="temp"
              tick={CHART_AXIS_TICK}
              tickFormatter={(value) => `${Number(value).toFixed(0)}°`}
              width={40}
            />
            <YAxis
              yAxisId="power"
              orientation="right"
              tick={CHART_AXIS_TICK}
              tickFormatter={(value) => formatChartPower(Number(value)).replace(" ", "")}
              width={52}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                name === "temperatureC" ? formatTemperature(value) : formatChartPower(value),
                name === "temperatureC" ? "Температура" : "Отопление",
              ]}
              labelFormatter={(label) => `t = ${Number(label).toFixed(1)} ч`}
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {setpoint != null ? (
              <ReferenceLine
                yAxisId="temp"
                y={setpoint}
                stroke="var(--accent-base)"
                strokeDasharray="5 4"
                label={{ value: `Уставка ${setpoint.toFixed(1)} °C`, position: "insideTopLeft", fontSize: 10, fill: "var(--text-soft)" }}
              />
            ) : null}
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temperatureC"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              name="temperatureC"
            />
            <Line
              yAxisId="power"
              type="monotone"
              dataKey="heatingPowerW"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
              name="heatingPowerW"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      </div>
  );
}

export default ThermalTimeSeriesChart;
