import type { EngineeringFieldResult } from "../../../core/thermal/engineering/types";
import { formatNumber } from "../../../shared/utils/format";

const HEATMAP_COLORS = ["#16344f", "#1f5d7a", "#2d8d8b", "#66b96a", "#f2c04c", "#e97232", "#a9341f"];

export type TemperatureHeatmapHover = {
  x: number;
  y: number;
  temperatureC: number;
  roomId: string;
  roomLabel: string;
};

export function TemperatureHeatmapPanel({
  field,
  hover,
  onHover,
  roomLabels,
  emptyMessage = "Недостаточно данных для визуализации. Запустите расчёт или уточните входные параметры.",
}: {
  field: EngineeringFieldResult | null;
  hover: TemperatureHeatmapHover | null;
  onHover: (value: TemperatureHeatmapHover | null) => void;
  roomLabels: Record<string, string>;
  emptyMessage?: string;
}) {
  if (!field?.cells.length) {
    return <HeatmapPlaceholder message={emptyMessage} />;
  }

  const cellSize = field.kind === "detailed" ? 18 : 24;
  const width = Math.max((field.cols || 1) * cellSize, 320);
  const height = Math.max((field.rows || 1) * cellSize, 180);

  return (
    <div className="space-y-3">
      <div className="ui-scroll max-w-full overflow-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2">
        <svg width={width} height={height} className="block max-w-none">
          {field.cells.map((cell) => (
            <rect
              key={`${cell.row}-${cell.col}-${cell.roomId}`}
              x={cell.col * cellSize}
              y={cell.row * cellSize}
              width={cellSize}
              height={cellSize}
              rx={3}
              fill={getHeatmapColor(cell.temperatureC, field.minTemperatureC, field.maxTemperatureC)}
              stroke="rgba(255,255,255,0.22)"
              onMouseEnter={() =>
                onHover({
                  x: cell.x,
                  y: cell.y,
                  temperatureC: cell.temperatureC,
                  roomId: cell.roomId,
                  roomLabel: roomLabels[cell.roomId] ?? "Помещение",
                })
              }
              onMouseLeave={() => onHover(null)}
            />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--text-soft)]">
        <div className="flex items-center gap-2">
          {HEATMAP_COLORS.map((color) => (
            <span key={color} className="h-2.5 w-8 rounded-full" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span>
          {formatNumber(field.minTemperatureC, { maximumFractionDigits: 1 })} °C ..{" "}
          {formatNumber(field.maxTemperatureC, { maximumFractionDigits: 1 })} °C
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Сетка
          <div className="font-semibold text-[color:var(--text-base)]">
            {field.rows} × {field.cols}
          </div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Шаг сетки
          <div className="font-semibold text-[color:var(--text-base)]">
            {formatNumber(field.cellSizeM, { maximumFractionDigits: 2 })} м
          </div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Итерации
          <div className="font-semibold text-[color:var(--text-base)]">{field.iterations}</div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Сходимость
          <div className="font-semibold text-[color:var(--text-base)]">{field.converged ? "достигнута" : "ограничена"}</div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Невязка
          <div className="font-semibold text-[color:var(--text-base)]">
            {formatNumber(field.residualC, { maximumFractionDigits: 4 })} °C
          </div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Критерий
          <div className="font-semibold text-[color:var(--text-base)]">
            max |ΔT| ≤ {formatNumber(field.toleranceC, { maximumFractionDigits: 3 })} °C
          </div>
        </div>
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Метод
          <div className="font-semibold text-[color:var(--text-base)]">Итерационный Gauss–Seidel</div>
        </div>
      </div>
      {hover ? (
        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          {hover.roomLabel} · ({formatNumber(hover.x, { maximumFractionDigits: 2 })};{" "}
          {formatNumber(hover.y, { maximumFractionDigits: 2 })}) м:{" "}
          <span className="font-semibold text-[color:var(--text-base)]">
            {formatNumber(hover.temperatureC, { maximumFractionDigits: 1 })} °C
          </span>
        </div>
      ) : null}
    </div>
  );
}

function HeatmapPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-sm text-[color:var(--text-soft)]">
      <span className="max-w-xl whitespace-normal break-words px-4 text-center">{message}</span>
    </div>
  );
}

function getHeatmapColor(value: number, min: number, max: number): string {
  if (!Number.isFinite(value)) {
    return "#cbd5e1";
  }
  const normalized = Math.max(0, Math.min(1, (value - min) / Math.max(max - min, 1e-6)));
  const scaled = normalized * (HEATMAP_COLORS.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(HEATMAP_COLORS.length - 1, index + 1);
  const mix = scaled - index;
  return interpolateColor(HEATMAP_COLORS[index], HEATMAP_COLORS[nextIndex], mix);
}

function interpolateColor(from: string, to: string, mix: number): string {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const red = Math.round(start.r + (end.r - start.r) * mix);
  const green = Math.round(start.g + (end.g - start.g) * mix);
  const blue = Math.round(start.b + (end.b - start.b) * mix);
  return `rgb(${red}, ${green}, ${blue})`;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export { getHeatmapColor, HEATMAP_COLORS };
