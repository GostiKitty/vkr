import type { ZoneChartSeriesRow } from "../../../core/thermal/thermalResultsChartPayload";
import {
  formatChartPower,
  formatChartTemperature,
  formatZoneStatusLabel,
  getFiniteChartDomain,
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
      <section className="ui-chart-shell">
        <HeatmapHeader />
        <div className="ui-loss-chart__empty">Матрица недоступна: нет диагностик по помещениям.</div>
      </section>
    );
  }

  const tempDomain = getFiniteChartDomain(limited.map((row) => row.temperatureC));
  const loadDomain = getFiniteChartDomain(limited.map((row) => row.heatingPowerW));
  const lossDomain = getFiniteChartDomain(limited.map((row) => row.lossTotalW));

  return (
    <section className="ui-chart-shell" data-testid="room-heatmap-matrix">
      <HeatmapHeader />
      <div className="ui-heatmap__scales mt-3">
        <HeatmapScale label="Температура" variant="temperature" domain={tempDomain} />
        <HeatmapScale label="Нагрузка и потери" variant="load" domain={loadDomain ?? lossDomain} />
      </div>
      <div className="ui-heatmap__table-wrap mt-4">
        <table className="ui-heatmap__table">
          <thead>
            <tr>
              <th className="ui-heatmap__th ui-heatmap__th--sticky">Помещение</th>
              <th className="ui-heatmap__th">Температура</th>
              <th className="ui-heatmap__th">Нагрузка</th>
              <th className="ui-heatmap__th">Потери</th>
              <th className="ui-heatmap__th">Статус</th>
            </tr>
          </thead>
          <tbody>
            {limited.map((row) => {
              const selected = selectedRoomId === row.zoneId;
              return (
                <tr
                  key={row.zoneId}
                  className={`ui-heatmap__row${selected ? " ui-heatmap__row--selected" : ""}`}
                >
                  <td className="ui-heatmap__td ui-heatmap__td--sticky">
                    <button
                      type="button"
                      onClick={() => onSelectRoom(row.zoneId)}
                      className="ui-heatmap__room"
                    >
                      {row.zoneName}
                    </button>
                  </td>
                  <HeatmapCell
                    value={row.temperatureC}
                    domain={tempDomain}
                    formatter={formatChartTemperature}
                    variant="temperature"
                  />
                  <HeatmapCell
                    value={row.heatingPowerW}
                    domain={loadDomain}
                    formatter={formatChartPower}
                    variant="load"
                  />
                  <HeatmapCell
                    value={row.lossTotalW}
                    domain={lossDomain}
                    formatter={formatChartPower}
                    variant="load"
                  />
                  <td className="ui-heatmap__td">
                    <span className={statusBadgeClass(row.status)}>{formatZoneStatusLabel(row.status)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HeatmapHeader() {
  return (
    <header className="ui-loss-chart__head">
      <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Матрица помещений</h3>
    </header>
  );
}

function HeatmapScale({
  label,
  variant,
  domain,
}: {
  label: string;
  variant: "temperature" | "load";
  domain: [number, number] | null;
}) {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  const colorAt = (ratio: number) => {
    if (!domain) return "var(--surface-muted)";
    const value = domain[0] + ratio * (domain[1] - domain[0]);
    return variant === "temperature"
      ? heatColorTemperature(value, domain[0], domain[1])
      : heatColorLoad(value, domain[0], domain[1]);
  };

  return (
    <div className="ui-heatmap__scale">
      <span className="ui-heatmap__scale-label">{label}</span>
      <div className="ui-heatmap__scale-bar" aria-hidden>
        {stops.map((ratio) => (
          <span key={ratio} className="ui-heatmap__scale-stop" style={{ backgroundColor: colorAt(ratio) }} />
        ))}
      </div>
      {domain ? (
        <span className="ui-heatmap__scale-range">
          {variant === "temperature"
            ? `${formatChartTemperature(domain[0])} … ${formatChartTemperature(domain[1])}`
            : `${formatChartPower(domain[0])} … ${formatChartPower(domain[1])}`}
        </span>
      ) : null}
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
      <td className="ui-heatmap__td">
        <span className="ui-heatmap__empty">{THERMAL_CHART_NOT_SET}</span>
      </td>
    );
  }

  const numeric = value as number;
  const ratio = domain[1] > domain[0] ? (numeric - domain[0]) / (domain[1] - domain[0]) : 0;
  const fillColor =
    variant === "temperature"
      ? heatColorTemperature(numeric, domain[0], domain[1])
      : heatColorLoad(numeric, domain[0], domain[1]);

  return (
    <td className="ui-heatmap__td">
      <div className="ui-heatmap__cell">
        <div className="ui-heatmap__cell-track" aria-hidden>
          <div
            className="ui-heatmap__cell-fill"
            style={{ width: `${Math.max(ratio * 100, 4)}%`, backgroundColor: fillColor }}
          />
        </div>
        <span className="ui-heatmap__cell-value">{formatter(value)}</span>
      </div>
    </td>
  );
}

export default RoomHeatmapMatrix;
