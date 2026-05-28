/**
 * Извлечение и преобразование геометрии из BuildingModel
 * для отображения на архитектурном чертёжном листе.
 *
 * Все выходные координаты — в мм на листе.
 */

import type { BuildingModel, Room, Wall, Door, Window, Vec2 } from "../../entities/geometry/types";
import { polygonArea as polyAreaSigned } from "../../entities/geometry/geom";
import { anchorToOffset } from "../build/utils/openingMath";
import type { DrawingScale, ExplicationRow, Rect2D } from "./drawingTypes";
import { modelToSheet } from "./drawingTypes";

// ---------------------------------------------------------------------------
// Преобразование координат
// ---------------------------------------------------------------------------

export interface PlanProjection {
  /** px/мм или мм/м, зависит от viewBox */
  scale: number;      // мм_листа / метры_модели
  offsetX: number;    // мм, смещение начала плана на листе
  offsetY: number;    // мм
  minX: number;       // мин. X модели
  minY: number;       // мин. Y модели
}

export function projectPoint(p: Vec2, proj: PlanProjection): { x: number; y: number } {
  return {
    x: (p.x - proj.minX) * proj.scale + proj.offsetX,
    y: (p.y - proj.minY) * proj.scale + proj.offsetY,
  };
}

export function projectLength(meters: number, proj: PlanProjection): number {
  return meters * proj.scale;
}

// ---------------------------------------------------------------------------
// Построение проекции плана в рабочей зоне
// ---------------------------------------------------------------------------

export interface PlanBoundsMeters {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthM: number;
  heightM: number;
}

export function computeModelBounds(model: BuildingModel, levelId?: string | null): PlanBoundsMeters {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const match = (id: string | null | undefined) => !levelId || id === levelId;

  for (const w of model.walls) {
    if (!match(w.levelId)) continue;
    minX = Math.min(minX, w.a.x, w.b.x);
    minY = Math.min(minY, w.a.y, w.b.y);
    maxX = Math.max(maxX, w.a.x, w.b.x);
    maxY = Math.max(maxY, w.a.y, w.b.y);
  }
  for (const r of model.rooms) {
    if (!match(r.levelId)) continue;
    for (const p of r.polygon) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 10, maxY: 8, widthM: 10, heightM: 8 };
  }
  return {
    minX, minY, maxX, maxY,
    widthM: maxX - minX,
    heightM: maxY - minY,
  };
}

/**
 * Построить проекцию, центрирующую план в указанной области листа с заданными отступами.
 * @param paddingMm отступ от края зоны (для размерных линий)
 */
export function buildPlanProjection(
  bounds: PlanBoundsMeters,
  area: Rect2D,
  scale: DrawingScale,
  paddingMm: number = 28
): PlanProjection {
  const scaleMmPerM = 1000 / parseInt(scale.split(":")[1], 10);

  const drawW = modelToSheet(bounds.widthM, scale);
  const drawH = modelToSheet(bounds.heightM, scale);

  // Центрирование в рабочей зоне
  const availW = area.w - paddingMm * 2;
  const availH = area.h - paddingMm * 2;

  const offsetX = area.x + paddingMm + (availW - drawW) / 2;
  const offsetY = area.y + paddingMm + (availH - drawH) / 2;

  return {
    scale: scaleMmPerM,
    offsetX,
    offsetY,
    minX: bounds.minX,
    minY: bounds.minY,
  };
}

// ---------------------------------------------------------------------------
// Классификация стен
// ---------------------------------------------------------------------------

export function isExteriorWall(wall: Wall): boolean {
  if (wall.thickness_m != null && Number.isFinite(wall.thickness_m)) {
    return wall.thickness_m >= 0.28;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Геометрия стен с учётом проёмов
// ---------------------------------------------------------------------------

export interface WallDrawData {
  wall: Wall;
  isExterior: boolean;
  /** SVG path для заливки стены (с выломом под проёмы) */
  fillPath: string;
  /** Центральная линия стены (для осей) */
  centerLine: string;
}

function wallRectPoints(wall: Wall, proj: PlanProjection) {
  const a = projectPoint(wall.a, proj);
  const b = projectPoint(wall.b, proj);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const hw = projectLength(wall.thickness_m ?? 0.2, proj) / 2;
  return { a, b, nx, ny, hw, ux, uy };
}

export function buildWallPath(wall: Wall, proj: PlanProjection): WallDrawData | null {
  const r = wallRectPoints(wall, proj);
  if (!r) return null;
  const { a, b, nx, ny, hw } = r;
  const p1 = { x: a.x + nx * hw, y: a.y + ny * hw };
  const p2 = { x: b.x + nx * hw, y: b.y + ny * hw };
  const p3 = { x: b.x - nx * hw, y: b.y - ny * hw };
  const p4 = { x: a.x - nx * hw, y: a.y - ny * hw };
  const d = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} L ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
  const c = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  return {
    wall,
    isExterior: isExteriorWall(wall),
    fillPath: d,
    centerLine: c,
  };
}

// ---------------------------------------------------------------------------
// Геометрия проёмов (окна/двери)
// ---------------------------------------------------------------------------

export interface OpeningDrawData {
  type: "window" | "door";
  /** Начало проёма на плане (мм) */
  a: { x: number; y: number };
  /** Конец проёма на плане (мм) */
  b: { x: number; y: number };
  /** Нормаль стены (наружная сторона) */
  nx: number;
  ny: number;
  /** Полуширина стены в мм */
  halfWallMm: number;
  /** Ширина проёма в мм */
  widthMm: number;
  swingDirection?: "left" | "right";
}

export function buildOpeningData(
  openings: (Door | Window)[],
  openingType: "window" | "door",
  model: BuildingModel,
  proj: PlanProjection
): OpeningDrawData[] {
  const wallById = new Map(model.walls.map((w) => [w.id, w]));
  const result: OpeningDrawData[] = [];

  for (const op of openings) {
    const wall = wallById.get(op.anchor.wallId ?? "");
    if (!wall || op.lost) continue;

    const wallLen = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    if (wallLen < 1e-6) continue;

    const offset = anchorToOffset(op.anchor, wall);
    const halfW = (op.width_m ?? 1) / 2;
    const t0 = Math.max(0, offset - halfW) / wallLen;
    const t1 = Math.min(wallLen, offset + halfW) / wallLen;

    const a3d = {
      x: wall.a.x + (wall.b.x - wall.a.x) * t0,
      y: wall.a.y + (wall.b.y - wall.a.y) * t0,
    };
    const b3d = {
      x: wall.a.x + (wall.b.x - wall.a.x) * t1,
      y: wall.a.y + (wall.b.y - wall.a.y) * t1,
    };

    const a = projectPoint(a3d, proj);
    const b = projectPoint(b3d, proj);

    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const len = Math.hypot(dx, dy);
    const nx = -(dy / len);
    const ny = dx / len;

    result.push({
      type: openingType,
      a,
      b,
      nx,
      ny,
      halfWallMm: projectLength(wall.thickness_m ?? 0.2, proj) / 2,
      widthMm: projectLength(op.width_m ?? 1, proj),
      swingDirection: openingType === "door" ? (op as Door).swingDirection : undefined,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Оси здания
// ---------------------------------------------------------------------------

export interface BuildingAxis {
  direction: "horizontal" | "vertical";
  /** Координата оси в мм на листе (Y для горизонтальных, X для вертикальных) */
  positionMm: number;
  /** Метка оси (А, Б, В... или 1, 2, 3...) */
  label: string;
  /** Начало и конец линии оси (мм) */
  startMm: number;
  endMm: number;
}

export function buildBuildingAxes(
  bounds: PlanBoundsMeters,
  proj: PlanProjection,
  extendMm: number = 10
): BuildingAxis[] {
  const axes: BuildingAxis[] = [];

  // Вертикальные оси (по X) — цифровые
  // Горизонтальные оси (по Y) — буквенные

  // Упрощённо: ставим оси по крайним точкам здания + середине
  const axisExtend = extendMm;
  const { minX, maxX, minY, maxY } = bounds;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const startY = proj.offsetY - axisExtend;
  const endY = proj.offsetY + (maxY - minY) * proj.scale + axisExtend;
  const startX = proj.offsetX - axisExtend;
  const endX = proj.offsetX + (maxX - minX) * proj.scale + axisExtend;

  void midX; void midY; void minX; void minY; void maxX; void maxY;

  // Ось 1 (левая вертикальная)
  axes.push({
    direction: "vertical",
    positionMm: proj.offsetX,
    label: "1",
    startMm: startY,
    endMm: endY,
  });
  // Ось 2 (правая вертикальная)
  axes.push({
    direction: "vertical",
    positionMm: proj.offsetX + (maxX - minX) * proj.scale,
    label: "2",
    startMm: startY,
    endMm: endY,
  });
  // Ось А (нижняя горизонтальная)
  axes.push({
    direction: "horizontal",
    positionMm: proj.offsetY,
    label: "А",
    startMm: startX,
    endMm: endX,
  });
  // Ось Б (верхняя горизонтальная)
  axes.push({
    direction: "horizontal",
    positionMm: proj.offsetY + (maxY - minY) * proj.scale,
    label: "Б",
    startMm: startX,
    endMm: endX,
  });

  return axes;
}

// ---------------------------------------------------------------------------
// Экспликация помещений
// ---------------------------------------------------------------------------

export function buildExplication(model: BuildingModel, levelId?: string | null): ExplicationRow[] {
  const match = (id: string | null | undefined) => !levelId || id === levelId;
  const rows: ExplicationRow[] = [];
  let num = 1;

  for (const room of model.rooms) {
    if (!match(room.levelId)) continue;
    const area = Math.abs(polyAreaSigned(room.polygon));
    const name =
      (room.name?.trim() || "") ||
      `Помещение ${num}`;
    rows.push({
      number: num++,
      name,
      areaSqM: Math.round(area * 100) / 100,
    });
  }

  return rows;
}
