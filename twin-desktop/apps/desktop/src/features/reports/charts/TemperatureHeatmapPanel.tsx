import { useMemo } from "react";
import type { EngineeringFieldCell, EngineeringFieldResult } from "../../../core/thermal/engineering/types";
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
      <HeatmapSvg
        field={field}
        cellSize={cellSize}
        width={width}
        height={height}
        roomLabels={roomLabels}
        hover={hover}
        onHover={onHover}
      />
      <GradientLegend
        minC={field.minTemperatureC}
        maxC={field.maxTemperatureC}
      />
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

function HeatmapSvg({
  field,
  cellSize,
  width,
  height,
  roomLabels,
  hover,
  onHover,
}: {
  field: EngineeringFieldResult;
  cellSize: number;
  width: number;
  height: number;
  roomLabels: Record<string, string>;
  hover: TemperatureHeatmapHover | null;
  onHover: (value: TemperatureHeatmapHover | null) => void;
}) {
  const { cellMap, roomOverlays, borderSegments } = useMemo(
    () => buildDerivedGeometry(field.cells, cellSize, roomLabels),
    [field.cells, cellSize, roomLabels]
  );

  return (
    <div className="ui-scroll max-w-full overflow-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2">
      <svg width={width} height={height} className="block max-w-none">
        {/* cells */}
        {field.cells.map((cell) => (
          <rect
            key={`${cell.row}-${cell.col}`}
            x={cell.col * cellSize}
            y={cell.row * cellSize}
            width={cellSize}
            height={cellSize}
            rx={2}
            fill={getHeatmapColor(cell.temperatureC, field.minTemperatureC, field.maxTemperatureC)}
            stroke="none"
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

        {/* room boundary lines */}
        {borderSegments.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1.5}
            strokeLinecap="square"
            style={{ pointerEvents: "none" }}
          />
        ))}

        {/* room labels */}
        {roomOverlays.map((overlay) => (
          <text
            key={overlay.roomId}
            x={overlay.cx}
            y={overlay.cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={cellSize <= 18 ? 9 : 11}
            fontWeight={600}
            fill="rgba(255,255,255,0.95)"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={2.5}
            paintOrder="stroke"
            style={{ pointerEvents: "none" }}
          >
            {overlay.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

interface BorderSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface RoomOverlay {
  roomId: string;
  label: string;
  cx: number;
  cy: number;
}

function buildDerivedGeometry(
  cells: EngineeringFieldCell[],
  cellSize: number,
  roomLabels: Record<string, string>
): {
  cellMap: Map<string, EngineeringFieldCell>;
  roomOverlays: RoomOverlay[];
  borderSegments: BorderSegment[];
} {
  const cellMap = new Map<string, EngineeringFieldCell>();
  cells.forEach((cell) => cellMap.set(`${cell.row},${cell.col}`, cell));

  // room centroids for labels
  const roomAccum = new Map<string, { rowSum: number; colSum: number; count: number }>();
  cells.forEach((cell) => {
    const acc = roomAccum.get(cell.roomId) ?? { rowSum: 0, colSum: 0, count: 0 };
    acc.rowSum += cell.row;
    acc.colSum += cell.col;
    acc.count += 1;
    roomAccum.set(cell.roomId, acc);
  });

  const roomOverlays: RoomOverlay[] = [];
  roomAccum.forEach((acc, roomId) => {
    const rawLabel = roomLabels[roomId] ?? "Помещение";
    roomOverlays.push({
      roomId,
      label: rawLabel.length > 13 ? `${rawLabel.slice(0, 12)}…` : rawLabel,
      cx: (acc.colSum / acc.count + 0.5) * cellSize,
      cy: (acc.rowSum / acc.count + 0.5) * cellSize,
    });
  });

  // borders where roomId changes between adjacent cells or at field edge
  const borderSegments: BorderSegment[] = [];
  cells.forEach((cell) => {
    const x = cell.col * cellSize;
    const y = cell.row * cellSize;
    const right = cellMap.get(`${cell.row},${cell.col + 1}`);
    if (!right || right.roomId !== cell.roomId) {
      borderSegments.push({ x1: x + cellSize, y1: y, x2: x + cellSize, y2: y + cellSize });
    }
    const bottom = cellMap.get(`${cell.row + 1},${cell.col}`);
    if (!bottom || bottom.roomId !== cell.roomId) {
      borderSegments.push({ x1: x, y1: y + cellSize, x2: x + cellSize, y2: y + cellSize });
    }
  });

  return { cellMap, roomOverlays, borderSegments };
}

function GradientLegend({ minC, maxC }: { minC: number; maxC: number }) {
  const gradientId = "heatmap-temp-gradient";
  const stops = HEATMAP_COLORS.map((color, i) => (
    <stop
      key={color}
      offset={`${(i / (HEATMAP_COLORS.length - 1)) * 100}%`}
      stopColor={color}
    />
  ));
  return (
    <div className="flex items-center gap-3 text-xs text-[color:var(--text-soft)]">
      <span className="tabular-nums">{formatNumber(minC, { maximumFractionDigits: 1 })} °C</span>
      <svg width={160} height={10} className="flex-shrink-0 overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {stops}
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={160} height={10} rx={5} fill={`url(#${gradientId})`} />
      </svg>
      <span className="tabular-nums">{formatNumber(maxC, { maximumFractionDigits: 1 })} °C</span>
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
