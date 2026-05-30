import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ZoneChartSeriesRow } from "../../../core/thermal/thermalResultsChartPayload";
import { ThermalChartTooltip } from "./ThermalChartTooltip";
import {
  CHART_AXIS_TICK,
  CHART_MARGIN,
  clampChart,
  formatChartAxisPower,
  formatChartPower,
  formatChartTemperature,
  LOSS_CATEGORY_COLORS,
} from "./thermalChartTheme";

type ScatterPoint = ZoneChartSeriesRow & {
  temperatureC: number;
  heatingPowerW: number;
  bubbleSize: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  anomalyKind: "normal" | "attention" | "risk" | "infiltration" | "selected";
};

function RoomScatterTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload as ScatterPoint;
  return (
    <ThermalChartTooltip
      active
      payload={payload}
      title={row.zoneName}
      rows={[
        { label: "Температура", value: formatChartTemperature(row.temperatureC) },
        { label: "Требуемая мощность", value: formatChartPower(row.heatingPowerW) },
        { label: "Суммарные потери", value: formatChartPower(row.lossTotalW) },
        ...(row.infiltrationShareOfTotalPct != null
          ? [{ label: "Доля инфильтрации в теплопотерях", value: `${row.infiltrationShareOfTotalPct.toFixed(1)} %` }]
          : []),
        ...(row.infiltrationShareOfAirExchangePct != null
          ? [{ label: "Доля инфильтрации в воздухообмене", value: `${row.infiltrationShareOfAirExchangePct.toFixed(1)} %` }]
          : []),
      ]}
    />
  );
}

interface RoomScatterPlotProps {
  rows: ZoneChartSeriesRow[];
  setpointC?: number | null;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
}

const SCATTER_LEGEND: Array<{ id: ScatterPoint["anomalyKind"]; label: string; color: string }> = [
  { id: "normal", label: "Норма", color: "var(--chart-line)" },
  { id: "attention", label: "Внимание", color: "var(--warning-border)" },
  { id: "risk", label: "Риск", color: LOSS_CATEGORY_COLORS.infiltration },
  { id: "infiltration", label: "Инф. > 80%", color: "#ea580c" },
  { id: "selected", label: "Выбрано", color: "var(--accent-base)" },
];

function classifyPoint(row: ZoneChartSeriesRow, selectedRoomId: string | null): ScatterPoint["anomalyKind"] {
  if (selectedRoomId === row.zoneId) return "selected";
  if (row.status === "risk") return "risk";
  if (row.infiltrationShareOfTotalPct != null && row.infiltrationShareOfTotalPct > 80) return "infiltration";
  if (row.status === "attention") return "attention";
  return "normal";
}

function pointColors(kind: ScatterPoint["anomalyKind"]): { fill: string; stroke: string } {
  switch (kind) {
    case "selected":
      return { fill: "var(--accent-base)", stroke: "var(--text-base)" };
    case "risk":
      return { fill: LOSS_CATEGORY_COLORS.infiltration, stroke: "rgba(220, 38, 38, 0.45)" };
    case "infiltration":
      return { fill: "#ea580c", stroke: "rgba(234, 88, 12, 0.45)" };
    case "attention":
      return { fill: "var(--warning-border)", stroke: "rgba(202, 138, 4, 0.4)" };
    default:
      return { fill: "var(--chart-line)", stroke: "rgba(61, 130, 250, 0.35)" };
  }
}

export function RoomScatterPlot({ rows, setpointC, selectedRoomId, onSelectRoom }: RoomScatterPlotProps) {
  const data = useMemo(
    () =>
      rows
        .filter((row) => Number.isFinite(row.temperatureC) && Number.isFinite(row.heatingPowerW))
        .map((row) => {
          const anomalyKind = classifyPoint(row, selectedRoomId);
          const colors = pointColors(anomalyKind);
          return {
            ...row,
            temperatureC: row.temperatureC as number,
            heatingPowerW: row.heatingPowerW as number,
            bubbleSize: clampChart(row.lossTotalW / 60, 48, 320),
            anomalyKind,
            fill: colors.fill,
            stroke: colors.stroke,
            strokeWidth: anomalyKind === "selected" ? 2.5 : 1.5,
          };
        }),
    [rows, selectedRoomId]
  );

  const activeKinds = useMemo(() => new Set(data.map((row) => row.anomalyKind)), [data]);

  if (data.length < 2) {
    return (
      <section className="ui-chart-shell">
        <ScatterHeader />
        <div className="ui-loss-chart__empty">
          Для диаграммы рассеяния недостаточно точек с температурой и мощностью.
        </div>
      </section>
    );
  }

  const setpoint = Number.isFinite(setpointC) ? (setpointC as number) : null;

  return (
    <section className="ui-chart-shell" data-testid="room-scatter-plot">
      <ScatterHeader />
      <div className="ui-scatter__legend mt-3">
        {SCATTER_LEGEND.filter((item) => activeKinds.has(item.id)).map((item) => (
          <span key={item.id} className="ui-scatter__legend-item">
            <span className="ui-scatter__legend-dot" style={{ backgroundColor: item.color }} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>

      <div className="ui-scatter__chart mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{ ...CHART_MARGIN, top: 16, right: 20, bottom: 12 }}
            onClick={(state) => {
              const zoneId = state?.activePayload?.[0]?.payload?.zoneId;
              if (typeof zoneId === "string") {
                onSelectRoom(zoneId);
              }
            }}
          >
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              type="number"
              dataKey="temperatureC"
              name="Температура"
              unit=" °C"
              tick={CHART_AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-edge)" }}
            />
            <YAxis
              type="number"
              dataKey="heatingPowerW"
              name="Требуемая мощность"
              tick={CHART_AXIS_TICK}
              tickFormatter={formatChartAxisPower}
              tickLine={false}
              axisLine={{ stroke: "var(--chart-edge)" }}
              width={52}
            />
            <ZAxis type="number" dataKey="bubbleSize" range={[72, 380]} />
            {setpoint != null ? (
              <ReferenceLine
                x={setpoint}
                stroke="var(--accent-base)"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                strokeOpacity={0.85}
                label={{
                  value: `Уставка ${setpoint.toFixed(1)} °C`,
                  position: "insideTopRight",
                  fill: "var(--text-soft)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            ) : null}
            <Tooltip content={<RoomScatterTooltip />} cursor={{ strokeDasharray: "4 4", stroke: "var(--chart-edge)" }} />
            <Scatter data={data} name="Помещения" fillOpacity={0.78}>
              {data.map((row) => (
                <Cell key={row.zoneId} fill={row.fill} stroke={row.stroke} strokeWidth={row.strokeWidth} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ScatterHeader() {
  return (
    <header className="ui-loss-chart__head">
      <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Аномалии по помещениям</h3>
    </header>
  );
}

export default RoomScatterPlot;
