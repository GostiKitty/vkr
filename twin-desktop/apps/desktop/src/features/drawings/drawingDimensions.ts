/**
 * Построение размерных цепочек для плана этажа.
 *
 * Формирует типовые ГОСТ-цепочки:
 *  - Цепочка 1: размеры простенков и проёмов вдоль наружных стен
 *  - Цепочка 2: расстояния между осями (упрощённо: внешние грани)
 *  - Цепочка 3: общий габарит здания
 */

import type { BuildingModel } from "../../entities/geometry/types";
import type { PlanProjection } from "./drawingGeometry";
import type { DimensionChain, DimensionTick } from "./drawingTypes";
import { anchorToOffset } from "../build/utils/openingMath";

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

function mmLabel(valueInMm: number): string {
  // Размер в мм (на листе) → обратно в мм модели
  // Выводится как целое число (без единиц)
  return String(Math.round(valueInMm));
}

/**
 * Собрать все значимые позиции вдоль одной стороны (горизонталь или вертикаль):
 * - крайние точки здания
 * - границы проёмов (окна, двери) в стенах, параллельных этой стороне
 */
function collectXPositions(model: BuildingModel, levelId: string | null): number[] {
  const pts: number[] = [];
  const match = (id: string | null | undefined) => !levelId || id === levelId;

  for (const w of model.walls) {
    if (!match(w.levelId)) continue;
    pts.push(w.a.x, w.b.x);
  }
  for (const r of model.rooms) {
    if (!match(r.levelId)) continue;
    for (const p of r.polygon) pts.push(p.x);
  }

  // Проёмы в горизонтальных стенах
  const wallById = new Map(model.walls.map((w) => [w.id, w]));
  for (const op of [...(model.windows ?? []), ...(model.doors ?? [])]) {
    const wall = wallById.get(op.anchor.wallId ?? "");
    if (!wall || op.lost || !match(wall.levelId)) continue;
    const wallLen = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    if (wallLen < 1e-6) continue;
    // Только стены, преимущественно горизонтальные
    const angle = Math.abs(Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x));
    if (angle > 0.2) continue; // не горизонтальная
    const offset = anchorToOffset(op.anchor, wall);
    const hw = (op.width_m ?? 1) / 2;
    const t0 = offset - hw;
    const t1 = offset + hw;
    pts.push(wall.a.x + (wall.b.x - wall.a.x) * (t0 / wallLen));
    pts.push(wall.a.x + (wall.b.x - wall.a.x) * (t1 / wallLen));
  }

  return pts;
}

function collectYPositions(model: BuildingModel, levelId: string | null): number[] {
  const pts: number[] = [];
  const match = (id: string | null | undefined) => !levelId || id === levelId;

  for (const w of model.walls) {
    if (!match(w.levelId)) continue;
    pts.push(w.a.y, w.b.y);
  }
  for (const r of model.rooms) {
    if (!match(r.levelId)) continue;
    for (const p of r.polygon) pts.push(p.y);
  }

  // Проёмы в вертикальных стенах
  const wallById = new Map(model.walls.map((w) => [w.id, w]));
  for (const op of [...(model.windows ?? []), ...(model.doors ?? [])]) {
    const wall = wallById.get(op.anchor.wallId ?? "");
    if (!wall || op.lost || !match(wall.levelId)) continue;
    const wallLen = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    if (wallLen < 1e-6) continue;
    const angle = Math.abs(Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x));
    if (angle < Math.PI / 2 - 0.2) continue; // не вертикальная
    const offset = anchorToOffset(op.anchor, wall);
    const hw = (op.width_m ?? 1) / 2;
    const t0 = offset - hw;
    const t1 = offset + hw;
    pts.push(wall.a.y + (wall.b.y - wall.a.y) * (t0 / wallLen));
    pts.push(wall.a.y + (wall.b.y - wall.a.y) * (t1 / wallLen));
  }

  return pts;
}

function dedup(arr: number[], eps = 0.01): number[] {
  const sorted = [...arr].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (!out.length || Math.abs(v - out[out.length - 1]) > eps) {
      out.push(v);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Построение цепочек
// ---------------------------------------------------------------------------

/**
 * Горизонтальные цепочки (по оси X).
 * @param baselineY Y-координата линии цепочки на листе (мм)
 * @param modelPositionsX список X-координат модели (м)
 * @param proj проекция
 * @param gapMinMm минимальный размер сегмента для включения в цепочку
 */
function buildHorizontalChain(
  modelPositionsX: number[],
  proj: PlanProjection,
  baselineY: number,
  offsetFromGeomMm: number,
  gapMinMm = 3
): DimensionChain | null {
  const positions = dedup(modelPositionsX);
  if (positions.length < 2) return null;

  const sheetPositions = positions.map(
    (x) => (x - proj.minX) * proj.scale + proj.offsetX
  );

  const ticks: DimensionTick[] = [];
  for (let i = 0; i < sheetPositions.length; i++) {
    const pos = sheetPositions[i];
    if (i === 0) {
      ticks.push({ positionMm: pos, label: "" });
      continue;
    }
    const prev = sheetPositions[i - 1];
    const segMm = pos - prev;
    if (segMm < gapMinMm) {
      ticks.push({ positionMm: pos, label: "" });
      continue;
    }
    // Подпись — размер в мм модели (масштабный размер × знаменатель / 1000)
    const modelSizeMm = Math.round((positions[i] - positions[i - 1]) * 1000);
    ticks.push({ positionMm: pos, label: String(modelSizeMm) });
  }

  return {
    direction: "horizontal",
    baselineMm: baselineY,
    startMm: sheetPositions[0],
    endMm: sheetPositions[sheetPositions.length - 1],
    ticks,
    offsetFromGeometryMm: offsetFromGeomMm,
  };
}

function buildVerticalChain(
  modelPositionsY: number[],
  proj: PlanProjection,
  baselineX: number,
  offsetFromGeomMm: number,
  gapMinMm = 3
): DimensionChain | null {
  const positions = dedup(modelPositionsY);
  if (positions.length < 2) return null;

  const sheetPositions = positions.map(
    (y) => (y - proj.minY) * proj.scale + proj.offsetY
  );

  const ticks: DimensionTick[] = [];
  for (let i = 0; i < sheetPositions.length; i++) {
    const pos = sheetPositions[i];
    if (i === 0) {
      ticks.push({ positionMm: pos, label: "" });
      continue;
    }
    const prev = sheetPositions[i - 1];
    const segMm = pos - prev;
    if (segMm < gapMinMm) {
      ticks.push({ positionMm: pos, label: "" });
      continue;
    }
    const modelSizeMm = Math.round((positions[i] - positions[i - 1]) * 1000);
    ticks.push({ positionMm: pos, label: String(modelSizeMm) });
  }

  return {
    direction: "vertical",
    baselineMm: baselineX,
    startMm: sheetPositions[0],
    endMm: sheetPositions[sheetPositions.length - 1],
    ticks,
    offsetFromGeometryMm: offsetFromGeomMm,
  };
}

// ---------------------------------------------------------------------------
// Публичный API
// ---------------------------------------------------------------------------

export interface PlanDimensions {
  /** Цепочка деталей вдоль нижнего края (простенки, проёмы) */
  bottomDetailChain: DimensionChain | null;
  /** Общий габарит по X (нижняя) */
  bottomTotalChain: DimensionChain | null;
  /** Цепочка деталей вдоль левого края */
  leftDetailChain: DimensionChain | null;
  /** Общий габарит по Y (левая) */
  leftTotalChain: DimensionChain | null;
}

export function buildPlanDimensions(
  model: BuildingModel,
  levelId: string | null,
  proj: PlanProjection
): PlanDimensions {
  // Крайние координаты в мм листа
  const xPositionsModel = collectXPositions(model, levelId);
  const yPositionsModel = collectYPositions(model, levelId);
  const xDedup = dedup(xPositionsModel);
  const yDedup = dedup(yPositionsModel);

  if (!xDedup.length || !yDedup.length) {
    return { bottomDetailChain: null, bottomTotalChain: null, leftDetailChain: null, leftTotalChain: null };
  }

  const geomBottomY = (Math.max(...yDedup) - proj.minY) * proj.scale + proj.offsetY;
  const geomLeftX = proj.offsetX;

  // Нижние цепочки
  const bottomDetailChain = buildHorizontalChain(
    xPositionsModel, proj,
    geomBottomY + 8,  // 8мм ниже геометрии
    8
  );
  const bottomTotalChain = buildHorizontalChain(
    [xDedup[0], xDedup[xDedup.length - 1]], proj,
    geomBottomY + 18, // ещё 10мм ниже
    18
  );

  // Левые цепочки
  const leftDetailChain = buildVerticalChain(
    yPositionsModel, proj,
    geomLeftX - 8,   // 8мм левее геометрии
    8
  );
  const leftTotalChain = buildVerticalChain(
    [yDedup[0], yDedup[yDedup.length - 1]], proj,
    geomLeftX - 18, // ещё 10мм левее
    18
  );

  return { bottomDetailChain, bottomTotalChain, leftDetailChain, leftTotalChain };
}

// Экспорт вспомогательных для SVG-рендера
export { mmLabel };
