import type { ZoneChartSeriesRow } from "../../../core/thermal/thermalResultsChartPayload";
import {
  formatChartPower,
  formatChartTemperature,
  getFiniteChartDomain,
  heatCellTextClass,
  heatColorLoad,
  heatColorTemperature,
  statusBadgeClass,
  THERMAL_CHART_NOT_SET,
} from "./thermalChartTheme";

interface RoomHeatmapMatrixProps {
  rows: ZoneChartSeriesRow[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
}

export function RoomHeatmapMatrix({ rows, selectedRoomId, onSelectRoom }: RoomHeatmapMatrixProps) {
  const limited = rows.slice(0, 20);
  if (!limited.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 text-center text-sm text-[color:var(--text-soft)]">
        Матрица недоступна: нет диагностик по помещениям.
      </div>
    );
  }

  const tempDomain = getFiniteChartDomain(limited.map((row) => row.temperatureC));
  const loadDomain = getFiniteChartDomain(limited.map((row) => row.heatingPowerW));
  const lossDomain = getFiniteChartDomain(limited.map((row) => row.lossTotalW));

  return (
    <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
      <table className="w-full border-collapse text-sm text-[color:var(--text-muted)]">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
            <th className="px-4 py-3 text-left font-semibold">Помещение</th>
            <th className="px-4 py-3 text-left font-semibold">Температура, °C</th>
            <th className="px-4 py-3 text-left font-semibold">Нагрузка</th>
            <th className="px-4 py-3 text-left font-semibold">Потери</th>
            <th className="px-4 py-3 text-left font-semibold">Статус</th>
          </tr>
        </thead>
        <tbody>
          {limited.map((row) => (
            <tr
              key={row.zoneId}
              className={`border-t border-[color:var(--border-soft)] transition-colors ${selectedRoomId === row.zoneId ? "bg-[color:var(--accent-muted)]/25 ring-1 ring-inset ring-[color:var(--accent-base)]/40" : "hover:bg-[color:var(--surface-muted)]/60"}`}
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSelectRoom(row.zoneId)}
                  className="text-left font-semibold text-[color:var(--text-base)] underline decoration-dotted underline-offset-4"
                >
                  {row.zoneName}
                </button>
              </td>
              <HeatmapCell value={row.temperatureC} domain={tempDomain} formatter={formatChartTemperature} variant="temperature" />
              <HeatmapCell value={row.heatingPowerW} domain={loadDomain} formatter={formatChartPower} variant="load" />
              <HeatmapCell value={row.lossTotalW} domain={lossDomain} formatter={formatChartPower} variant="load" />
              <td className="px-4 py-3">
                {row.statusNote ? (
                  <span className={statusBadgeClass(row.status)} title={row.statusNote}>
                    {row.statusNote}
                  </span>
                ) : (
                  <span className="text-[color:var(--text-soft)]">{THERMAL_CHART_NOT_SET}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatmapCell({
  value,
  domain,
  formatter,
  variant,
}: {
  value: number | null;
  domain: [number, number] | null;
  formatter: (value: number | null) => string;
  variant: "temperature" | "load";
}) {
  if (!Number.isFinite(value) || !domain) {
    return (
      <td className="px-4 py-3">
        <span
          className="inline-block min-w-[4.5rem] rounded-md border border-dashed border-[color:var(--border-soft)] bg-[repeating-linear-gradient(135deg,var(--surface-muted)_0,var(--surface-muted)_4px,transparent_4px,transparent_8px)] px-2 py-1 text-[color:var(--text-soft)]"
        >
          {THERMAL_CHART_NOT_SET}
        </span>
      </td>
    );
  }

  const numeric = value as number;
  const ratio = domain[1] > domain[0] ? (numeric - domain[0]) / (domain[1] - domain[0]) : 0;
  const backgroundColor =
    variant === "temperature"
      ? heatColorTemperature(numeric, domain[0], domain[1])
      : heatColorLoad(numeric, domain[0], domain[1]);

  return (
    <td className="px-4 py-3" style={{ backgroundColor }}>
      <span className={heatCellTextClass(ratio)}>{formatter(value)}</span>
    </td>
  );
}
