import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import type { BuildingModel, Door, Room, Vec2, Wall, Window } from "../../entities/geometry/types";

interface ModelPlan2DProps {
  model: BuildingModel;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  onSelectWall: (wallId: string | null) => void;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

function computeBounds(rooms: Room[], walls: Wall[]): Bounds {
  const points: Vec2[] = [];
  rooms.forEach((room) => points.push(...room.polygon));
  walls.forEach((wall) => {
    points.push(normalizeVec(wall.a), normalizeVec(wall.b));
  });
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
  }
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function normalizeVec(point: unknown): Vec2 {
  if (
    point &&
    typeof point === "object" &&
    "x" in point &&
    "y" in point &&
    typeof (point as { x: unknown }).x === "number" &&
    typeof (point as { y: unknown }).y === "number"
  ) {
    return point as Vec2;
  }
  return { x: 0, y: 0 };
}

function roomPolygonPoints(room: Room) {
  return room.polygon.map((point) => `${point.x},${point.y}`).join(" ");
}

function resolveOpeningCenter(
  opening: Window | Door,
  wall: Wall
): { x: number; y: number; angleRad: number; length: number } | null {
  const a = normalizeVec(wall.a);
  const b = normalizeVec(wall.b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) {
    return null;
  }
  const anchorT = Number.isFinite(opening.anchor.t) ? opening.anchor.t : 0;
  const offsetRatio = Number.isFinite(opening.anchor.offset_m) ? opening.anchor.offset_m / length : anchorT;
  const t = Math.min(Math.max(anchorT > 0 && anchorT < 1 ? anchorT : offsetRatio, 0), 1);
  return {
    x: a.x + dx * t,
    y: a.y + dy * t,
    angleRad: Math.atan2(dy, dx),
    length,
  };
}

function openingSegment(
  opening: Window | Door,
  wall: Wall,
  depthM: number
): { x1: number; y1: number; x2: number; y2: number } | null {
  const center = resolveOpeningCenter(opening, wall);
  if (!center) {
    return null;
  }
  const halfWidth = Math.min(Math.max(opening.width_m, 0.2), center.length) * 0.5;
  const nx = Math.cos(center.angleRad);
  const ny = Math.sin(center.angleRad);
  const px = -ny * depthM * 0.5;
  const py = nx * depthM * 0.5;
  return {
    x1: center.x - nx * halfWidth + px,
    y1: center.y - ny * halfWidth + py,
    x2: center.x + nx * halfWidth + px,
    y2: center.y + ny * halfWidth + py,
  };
}

export function ModelPlan2D({
  model,
  selectedRoomId,
  selectedWallId,
  onSelectRoom,
  onSelectWall,
}: ModelPlan2DProps) {
  const { rooms, walls, windows, doors } = model;
  const wallsById = useMemo(() => new Map(walls.map((wall) => [wall.id, wall])), [walls]);

  const bounds = useMemo(() => computeBounds(rooms, walls), [rooms, walls]);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: bounds.minX + bounds.width / 2, y: bounds.minY + bounds.height / 2 });
  const dragRef = useRef<{ startX: number; startY: number; startCenterX: number; startCenterY: number } | null>(null);

  const padding = Math.max(bounds.width, bounds.height) * 0.08;
  const baseWidth = bounds.width + padding * 2;
  const baseHeight = bounds.height + padding * 2;
  const viewWidth = baseWidth / zoom;
  const viewHeight = baseHeight / zoom;
  const viewBoxMinX = center.x - viewWidth / 2;
  const viewBoxMinY = center.y - viewHeight / 2;

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => clamp(prev + delta, 0.6, 5));
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startCenterX: center.x,
      startCenterY: center.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) {
      return;
    }
    const svgRect = event.currentTarget.getBoundingClientRect();
    const dxPx = event.clientX - dragRef.current.startX;
    const dyPx = event.clientY - dragRef.current.startY;
    const worldDx = (dxPx / Math.max(svgRect.width, 1)) * viewWidth;
    const worldDy = (dyPx / Math.max(svgRect.height, 1)) * viewHeight;
    setCenter({
      x: dragRef.current.startCenterX - worldDx,
      y: dragRef.current.startCenterY - worldDy,
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (rooms.length === 0 && walls.length === 0) {
    return (
      <div className="ui-empty-workspace">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Нет 2D-плана</p>
          <p className="text-sm text-[color:var(--text-muted)]">
            Откройте проект или создайте простую модель, чтобы увидеть план.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[color:var(--text-muted)]">
          План помещений и стен. Колесо мыши - масштаб, перетаскивание - панорама.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className="ui-btn-secondary px-3 py-1.5 text-xs" onClick={() => setZoom(1)}>
            Сбросить масштаб
          </button>
          <span className="text-xs text-[color:var(--text-soft)]">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <div className="ui-workspace-canvas relative min-h-[28rem] overflow-hidden">
        <svg
          viewBox={`${viewBoxMinX} ${viewBoxMinY} ${viewWidth} ${viewHeight}`}
          className="h-full w-full touch-none"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <rect x={bounds.minX - padding} y={bounds.minY - padding} width={baseWidth} height={baseHeight} fill="#f9fffd" />
          {rooms.map((room) => {
            const isSelected = room.id === selectedRoomId;
            const fill = isSelected ? "rgba(61,130,250,0.22)" : "rgba(61,130,250,0.08)";
            const stroke = isSelected ? "#3d82fa" : "rgba(82,96,113,0.45)";
            const cx = room.polygon.reduce((sum, point) => sum + point.x, 0) / Math.max(room.polygon.length, 1);
            const cy = room.polygon.reduce((sum, point) => sum + point.y, 0) / Math.max(room.polygon.length, 1);
            return (
              <g key={room.id}>
                <polygon
                  points={roomPolygonPoints(room)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={0.08}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectRoom(room.id);
                  }}
                />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontSize: "0.46px", fill: "#08111f", fontWeight: 600, pointerEvents: "none" }}
                >
                  {room.name}
                </text>
              </g>
            );
          })}
          {walls.map((wall) => {
            const isSelected = wall.id === selectedWallId;
            const a = normalizeVec(wall.a);
            const b = normalizeVec(wall.b);
            return (
              <g key={wall.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={isSelected ? "#a3e635" : "#526071"}
                  strokeWidth={isSelected ? 0.14 : 0.1}
                  strokeLinecap="round"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectWall(wall.id);
                  }}
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth={0.4}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectWall(wall.id);
                  }}
                />
              </g>
            );
          })}
          {windows.map((window) => {
            const wall = window.anchor.wallId ? wallsById.get(window.anchor.wallId) ?? null : null;
            if (!wall) {
              return null;
            }
            const segment = openingSegment(window, wall, wall.thickness_m);
            if (!segment) {
              return null;
            }
            return (
              <line
                key={window.id}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke="#38bdf8"
                strokeWidth={0.16}
                strokeLinecap="round"
              >
                <title>
                  {window.runtimeU_W_m2K != null
                    ? `Окно · U=${window.runtimeU_W_m2K.toFixed(2)} Вт/(м²·К)`
                    : "Окно"}
                </title>
              </line>
            );
          })}
          {doors.map((door) => {
            const wall = door.anchor.wallId ? wallsById.get(door.anchor.wallId) ?? null : null;
            if (!wall) {
              return null;
            }
            const segment = openingSegment(door, wall, wall.thickness_m);
            if (!segment) {
              return null;
            }
            return (
              <line
                key={door.id}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke="#f59e0b"
                strokeWidth={0.14}
                strokeLinecap="round"
              >
                <title>
                  {door.runtimeU_W_m2K != null
                    ? `Дверь · U=${door.runtimeU_W_m2K.toFixed(2)} Вт/(м²·К)`
                    : "Дверь"}
                </title>
              </line>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default ModelPlan2D;
