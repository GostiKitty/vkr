import type { BuildingModel, Vec2, Wall } from "../../../../entities/geometry/types";
import type { EngineeringPipe, EngineeringPipePoint } from "../../../../entities/engineering/types";

export interface PlanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export const EMPTY_BOUNDS: PlanBounds = {
  minX: 0,
  minY: 0,
  maxX: 1,
  maxY: 1,
  width: 1,
  height: 1,
};

export function expandBounds(b: PlanBounds, margin: number): PlanBounds {
  return {
    minX: b.minX - margin,
    minY: b.minY - margin,
    maxX: b.maxX + margin,
    maxY: b.maxY + margin,
    width: b.width + margin * 2,
    height: b.height + margin * 2,
  };
}

function pushPoint(acc: { minX: number; minY: number; maxX: number; maxY: number } | null, p: { x: number; y: number }) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return acc;
  if (!acc) return { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
  acc.minX = Math.min(acc.minX, p.x);
  acc.minY = Math.min(acc.minY, p.y);
  acc.maxX = Math.max(acc.maxX, p.x);
  acc.maxY = Math.max(acc.maxY, p.y);
  return acc;
}

export function computePlanBounds(model: BuildingModel, activeLevelId: string | null): PlanBounds {
  let acc: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  const matchLevel = (id: string | null | undefined) => activeLevelId == null || id === activeLevelId;

  for (const room of model.rooms) {
    if (!matchLevel(room.levelId)) continue;
    for (const p of room.polygon) acc = pushPoint(acc, p);
  }
  for (const wall of model.walls) {
    if (!matchLevel(wall.levelId)) continue;
    acc = pushPoint(acc, wall.a);
    acc = pushPoint(acc, wall.b);
  }
  for (const pipe of model.engineeringSystems?.pipes ?? []) {
    if (!matchLevel(pipe.levelId)) continue;
    for (const p of pipe.points) acc = pushPoint(acc, p);
  }
  for (const eq of model.engineeringSystems?.equipment ?? []) {
    if (!matchLevel(eq.levelId)) continue;
    acc = pushPoint(acc, { x: eq.x - eq.width / 2, y: eq.y - eq.height / 2 });
    acc = pushPoint(acc, { x: eq.x + eq.width / 2, y: eq.y + eq.height / 2 });
  }
  for (const pipe of model.pipes ?? []) {
    if (!matchLevel(pipe.levelId)) continue;
    for (const p of pipe.path) acc = pushPoint(acc, p);
  }
  for (const duct of model.ducts ?? []) {
    if (!matchLevel(duct.levelId)) continue;
    for (const p of duct.path) acc = pushPoint(acc, p);
  }
  for (const eq of model.equipment ?? []) {
    if (!matchLevel(eq.levelId)) continue;
    acc = pushPoint(acc, eq.position);
  }
  for (const s of model.sensors ?? []) {
    if (!matchLevel(s.levelId)) continue;
    acc = pushPoint(acc, s.position);
  }

  if (!acc) return EMPTY_BOUNDS;
  return {
    minX: acc.minX,
    minY: acc.minY,
    maxX: acc.maxX,
    maxY: acc.maxY,
    width: Math.max(0.01, acc.maxX - acc.minX),
    height: Math.max(0.01, acc.maxY - acc.minY),
  };
}

/**
 * Подобрать сцены-местный масштаб (px на метр) так,
 * чтобы план вписался в указанную рабочую область листа.
 */
export function computePlanScale(
  bounds: PlanBounds,
  drawableWidth: number,
  drawableHeight: number,
  options: { maxScale?: number; minScale?: number } = {}
): number {
  const minScale = options.minScale ?? 4;
  const maxScale = options.maxScale ?? 220;
  const sx = drawableWidth / Math.max(0.01, bounds.width);
  const sy = drawableHeight / Math.max(0.01, bounds.height);
  return Math.max(minScale, Math.min(maxScale, Math.min(sx, sy)));
}

/**
 * Перевод координаты модели (м) в координаты SVG листа (px).
 */
export interface PlanProjection {
  scale: number;
  offsetX: number;
  offsetY: number;
  project: (p: { x: number; y: number }) => { x: number; y: number };
  unproject: (p: { x: number; y: number }) => { x: number; y: number };
}

export function makeProjection(
  bounds: PlanBounds,
  scale: number,
  offsetX: number,
  offsetY: number
): PlanProjection {
  return {
    scale,
    offsetX,
    offsetY,
    project: (p) => ({ x: (p.x - bounds.minX) * scale + offsetX, y: (p.y - bounds.minY) * scale + offsetY }),
    unproject: (p) => ({ x: (p.x - offsetX) / scale + bounds.minX, y: (p.y - offsetY) / scale + bounds.minY }),
  };
}

export interface SegmentInfo {
  a: Vec2;
  b: Vec2;
  length: number;
  dx: number;
  dy: number;
  ux: number;
  uy: number;
  nx: number; // нормаль (-uy)
  ny: number; // нормаль ( ux)
  midX: number;
  midY: number;
  angleDeg: number;
}

export function segmentInfo(a: Vec2, b: Vec2): SegmentInfo {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const ux = length > 1e-9 ? dx / length : 1;
  const uy = length > 1e-9 ? dy / length : 0;
  return {
    a,
    b,
    length,
    dx,
    dy,
    ux,
    uy,
    nx: -uy,
    ny: ux,
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

export function isExteriorWall(model: BuildingModel, wall: Wall): boolean {
  /**
   * Эвристика: стена считается наружной, если она не делит две соседние комнаты.
   * Точный topology-расчёт есть в core/graph — но он тяжёлый, для draft-режима
   * достаточно простой проверки толщины: пользователи задают наружным стенам
   * thickness >= 0.3 м, внутренним < 0.3 м. Если ничего не задано — берём по
   * умолчанию «наружная».
   */
  void model;
  if (wall.thickness_m != null && Number.isFinite(wall.thickness_m)) {
    return wall.thickness_m >= 0.28;
  }
  return true;
}

/**
 * Сместить полилинию по нормали на distance (в метрах модели).
 * Используется для разнесения подачи и обратки.
 */
export function offsetPolyline(points: EngineeringPipePoint[], distance: number): EngineeringPipePoint[] {
  if (points.length < 2 || Math.abs(distance) < 1e-6) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }
  const offsetSegments = [] as Array<{ a: EngineeringPipePoint; b: EngineeringPipePoint; nx: number; ny: number }>;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const seg = segmentInfo(a, b);
    if (seg.length < 1e-9) continue;
    offsetSegments.push({
      a: { x: a.x + seg.nx * distance, y: a.y + seg.ny * distance },
      b: { x: b.x + seg.nx * distance, y: b.y + seg.ny * distance },
      nx: seg.nx,
      ny: seg.ny,
    });
  }
  if (!offsetSegments.length) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: EngineeringPipePoint[] = [offsetSegments[0].a];
  for (let i = 0; i < offsetSegments.length - 1; i++) {
    const cur = offsetSegments[i];
    const next = offsetSegments[i + 1];
    const denom = cur.nx * next.ny - cur.ny * next.nx;
    if (Math.abs(denom) < 1e-6) {
      out.push(cur.b);
      continue;
    }
    // intersect two offset lines
    const x1 = cur.a.x;
    const y1 = cur.a.y;
    const x2 = cur.b.x;
    const y2 = cur.b.y;
    const x3 = next.a.x;
    const y3 = next.a.y;
    const x4 = next.b.x;
    const y4 = next.b.y;
    const det = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (Math.abs(det) < 1e-6) {
      out.push(cur.b);
      continue;
    }
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / det;
    out.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) });
  }
  out.push(offsetSegments[offsetSegments.length - 1].b);
  return out;
}

/**
 * Найти лучший «средний» сегмент для подписи: с максимальной длиной.
 */
export function pickPipeLabelSegment(points: EngineeringPipePoint[]): SegmentInfo | null {
  let best: SegmentInfo | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const seg = segmentInfo(points[i], points[i + 1]);
    if (!best || seg.length > best.length) best = seg;
  }
  return best;
}

/**
 * Преобразовать угол сегмента к читабельному (без переворотов «вверх ногами»).
 */
export function normalizeLabelAngle(angleDeg: number): number {
  let a = angleDeg;
  while (a <= -90) a += 180;
  while (a > 90) a -= 180;
  return a;
}

export function polygonCentroid(points: { x: number; y: number }[]): { x: number; y: number } | null {
  if (!points.length) return null;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-9) {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function polygonArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

export function pipeLengthMeters(pipe: EngineeringPipe): number {
  let len = 0;
  for (let i = 0; i < pipe.points.length - 1; i++) {
    const a = pipe.points[i];
    const b = pipe.points[i + 1];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}
