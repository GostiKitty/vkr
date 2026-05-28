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

function RoomScatterTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload as ZoneChartSeriesRow & { fill: string };
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
        ...row.lossShareWarnings.map((warning) => ({ label: "Пояснение", value: warning })),
        ...(row.statusNote ? [{ label: "Статус", value: row.statusNote }] : []),
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

export function RoomScatterPlot({ rows, setpointC, selectedRoomId, onSelectRoom }: RoomScatterPlotProps) {
  const data = useMemo(
    () =>
      rows
        .filter((row) => Number.isFinite(row.temperatureC) && Number.isFinite(row.heatingPowerW))
        .map((row) => {
          const highInfiltration = row.infiltrationShareOfTotalPct != null && row.infiltrationShareOfTotalPct > 80;
          const isRisk = row.status === "risk";
          const isSelected = selectedRoomId === row.zoneId;
          return {
            ...row,
            temperatureC: row.temperatureC as number,
            heatingPowerW: row.heatingPowerW as number,
            bubbleSize: clampChart(row.lossTotalW / 60, 48, 320),
            fill: isSelected
              ? "var(--accent-base)"
              : isRisk
                ? LOSS_CATEGORY_COLORS.infiltration
                : highInfiltration
                  ? "#ea580c"
                  : row.status === "attention"
                    ? "#ca8a04"
                    : "#2563eb",
            stroke: isSelected ? "var(--text-base)" : "transparent",
            strokeWidth: isSelected ? 2 : 0,
          };
        }),
    [rows, selectedRoomId]
  );

  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 text-center text-sm text-[color:var(--text-soft)]">
        Для диаграммы рассеяния недостаточно точек с температурой и мощностью.
      </div>
    );
  }

  const setpoint = Number.isFinite(setpointC) ? (setpointC as number) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-2">
        <div className="h-[min(420px,55vh)] min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={CHART_MARGIN}
              onClick={(state) => {
                const zoneId = state?.activePayload?.[0]?.payload?.zoneId;
                if (typeof zoneId === "string") {
                  onSelectRoom(zoneId);
                }
              }}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="temperatureC" name="Температура" unit=" °C" tick={CHART_AXIS_TICK} />
              <YAxis
                type="number"
                dataKey="heatingPowerW"
                name="Требуемая мощность"
                tick={CHART_AXIS_TICK}
                tickFormatter={formatChartAxisPower}
              />
              <ZAxis type="number" dataKey="bubbleSize" range={[64, 360]} />
              {setpoint != null ? (
                <ReferenceLine
                  x={setpoint}
                  stroke="var(--accent-base)"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Уставка ${setpoint.toFixed(1)} °C`,
                    position: "insideTopRight",
                    fill: "var(--text-soft)",
                    fontSize: 10,
                  }}
                />
              ) : null}
              <Tooltip content={<RoomScatterTooltip />} cursor={{ strokeDasharray: "4 4" }} />
              <Scatter data={data} name="Помещения">
                {data.map((row) => (
                  <Cell key={row.zoneId} fill={row.fill} stroke={row.stroke} strokeWidth={row.strokeWidth} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs text-[color:var(--text-soft)]">
        Размер пузыря — суммарные потери. Оранжевые и красные точки показывают помещения со статусом риска или с
        инфильтрацией выше 80% от всех теплопотерь. В tooltip отдельно показаны доля инфильтрации в общих потерях и
        внутри воздухообмена. Пунктир — дневная уставка RC-модели.
      </p>
    </div>
  );
}
