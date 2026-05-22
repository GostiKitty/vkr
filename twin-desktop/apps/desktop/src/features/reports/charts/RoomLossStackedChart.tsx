import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { ZoneChartSeriesRow } from "../../../core/thermal/thermalResultsChartPayload";
import { LossCategoryLegend } from "./LossCategoryLegend";
import { ThermalChartTooltip } from "./ThermalChartTooltip";
import {
  CHART_AXIS_TICK,
  CHART_MARGIN_VERTICAL,
  formatChartAxisPower,
  formatChartPower,
  LOSS_CATEGORY_COLORS,
  LOSS_CATEGORY_LABELS,
} from "./thermalChartTheme";

const LOSS_FIELDS = [
  { key: "lossOpaqueW" as const, label: LOSS_CATEGORY_LABELS.opaque },
  { key: "lossWindowW" as const, label: LOSS_CATEGORY_LABELS.window },
  { key: "lossDoorW" as const, label: LOSS_CATEGORY_LABELS.door },
  { key: "lossInfiltrationW" as const, label: LOSS_CATEGORY_LABELS.infiltration },
  { key: "lossMechanicalVentilationW" as const, label: LOSS_CATEGORY_LABELS.ventilation },
];

function RoomLossTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload as ZoneChartSeriesRow;
  const breakdown = LOSS_FIELDS.filter((field) => Number.isFinite(row[field.key]) && (row[field.key] as number) > 0).map(
    (field) => ({
      label: field.label,
      value: formatChartPower(row[field.key]),
    })
  );

  return (
    <ThermalChartTooltip
      active
      payload={payload}
      title={row.zoneName}
      rows={[
        ...breakdown,
        { label: "Суммарно", value: formatChartPower(row.lossTotalW) },
        ...(row.statusNote ? [{ label: "Статус", value: row.statusNote }] : []),
      ]}
    />
  );
}

interface RoomLossStackedChartProps {
  rows: ZoneChartSeriesRow[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
}

export function RoomLossStackedChart({ rows, selectedRoomId, onSelectRoom }: RoomLossStackedChartProps) {
  const data = useMemo(
    () =>
      rows.slice(0, 12).map((row) => ({
        ...row,
        lossOpaqueW: row.lossOpaqueW ?? 0,
        lossWindowW: row.lossWindowW ?? 0,
        lossDoorW: row.lossDoorW ?? 0,
        lossInfiltrationW: row.lossInfiltrationW ?? 0,
        lossMechanicalVentilationW: row.lossMechanicalVentilationW ?? 0,
      })),
    [rows]
  );

  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 text-center text-sm text-[color:var(--text-soft)]">
        Нет помещений с доступным разложением потерь.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <LossCategoryLegend />
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-2">
        <div className="h-[min(420px,55vh)] min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={CHART_MARGIN_VERTICAL}
              accessibilityLayer
              onClick={(state) => {
                const zoneId = state?.activePayload?.[0]?.payload?.zoneId;
                if (typeof zoneId === "string") {
                  onSelectRoom(zoneId);
                }
              }}
            >
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={CHART_AXIS_TICK} tickFormatter={formatChartAxisPower} />
              <YAxis dataKey="zoneName" type="category" width={180} tick={CHART_AXIS_TICK} />
              <Tooltip content={<RoomLossTooltip />} cursor={{ fill: "var(--accent-muted)", fillOpacity: 0.1 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="lossOpaqueW" name="Ограждения" stackId="loss" fill={LOSS_CATEGORY_COLORS.opaque} />
              <Bar dataKey="lossWindowW" name="Окна" stackId="loss" fill={LOSS_CATEGORY_COLORS.window} />
              <Bar dataKey="lossDoorW" name="Двери" stackId="loss" fill={LOSS_CATEGORY_COLORS.door} />
              <Bar dataKey="lossInfiltrationW" name="Инфильтрация" stackId="loss" fill={LOSS_CATEGORY_COLORS.infiltration} />
              <Bar
                dataKey="lossMechanicalVentilationW"
                name="Вентиляция"
                stackId="loss"
                fill={LOSS_CATEGORY_COLORS.ventilation}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs text-[color:var(--text-soft)]">
        Top-12 по суммарным потерям. Клик по строке синхронизирует таблицу и 3D.
        {selectedRoomId ? " Выбранное помещение подсвечено в таблице." : null}
      </p>
    </div>
  );
}
