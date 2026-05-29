/**
 * Генерация геометрии разреза 1-1 (автоматический разрез через здание).
 *
 * Если точные данные о конструкции недоступны — используются типовые fallback-значения.
 * Все координаты на выходе — в мм на листе (ось Y вниз).
 */

import type { BuildingModel } from "../../entities/geometry/types";
import type { SectionParams, Rect2D, DrawingScale } from "./drawingTypes";
import { DEFAULT_SECTION_PARAMS, modelToSheet } from "./drawingTypes";

// ---------------------------------------------------------------------------
// Извлечение параметров разреза из модели
// ---------------------------------------------------------------------------

export function extractSectionParams(model: BuildingModel): SectionParams {
  const levels = model.levels ?? [];

  // Ширина здания — максимальный габарит по X (горизонтальный размер разреза 7200)
  let minX = Infinity, maxX = -Infinity;
  for (const w of model.walls) {
    minX = Math.min(minX, w.a.x, w.b.x);
    maxX = Math.max(maxX, w.a.x, w.b.x);
  }
  const buildingWidthM = Number.isFinite(maxX - minX) && maxX > minX ? maxX - minX : 9.0;

  // Количество этажей и высота
  const floors = levels.length > 0 ? levels.length : DEFAULT_SECTION_PARAMS.floors;

  // Высота этажа: берём из первого уровня или из fallback
  let floorHeightM = DEFAULT_SECTION_PARAMS.floorHeightM;
  if (levels.length > 0 && Number.isFinite(levels[0].height_m) && levels[0].height_m > 1) {
    floorHeightM = levels[0].height_m;
  }

  return {
    ...DEFAULT_SECTION_PARAMS,
    buildingWidthM,
    floors,
    floorHeightM,
  };
}

// ---------------------------------------------------------------------------
// Координаты элементов разреза на листе (мм)
// ---------------------------------------------------------------------------

export interface SectionGeometry {
  /** Горизонтальный масштаб: мм_листа / м_модели */
  scaleH: number;
  /** Вертикальный масштаб (тот же) */
  scaleV: number;
  /** Отступ слева внутри зоны (мм на листе) */
  left: number;
  /** Отступ справа */
  right: number;
  /** Базовая Y-координата уровня ±0.000 на листе (мм) */
  zeroY: number;
  /** Полная ширина разреза на листе (мм) */
  widthMm: number;
  /** Полная высота разреза на листе (мм) */
  heightMm: number;
  /** Параметры */
  params: SectionParams;
  /** Рабочая зона разреза */
  area: Rect2D;
}

/**
 * Вычислить координаты разреза, вписав его в указанную зону листа.
 */
export function buildSectionGeometry(
  params: SectionParams,
  area: Rect2D,
  scale: DrawingScale
): SectionGeometry {
  const scaleH = 1000 / parseInt(scale.split(":")[1], 10); // мм/м
  const scaleV = scaleH;

  // Общая высота сечения: фундамент + этажи + кровля
  const totalHeightM =
    params.foundationDepthM +
    params.floors * params.floorHeightM +
    params.floors * params.slabThicknessM +
    params.roofHeightM;

  const totalWidthM = params.buildingWidthM + params.roofOverhangM * 2;

  const drawingW = modelToSheet(totalWidthM, scale);
  const drawingH = modelToSheet(totalHeightM, scale);

  // Отступ внутри зоны
  const padH = 10;
  const padV = 8;

  // Центрируем горизонтально
  const left = area.x + padH + (area.w - padH * 2 - drawingW) / 2;
  const right = left + drawingW;

  // Вертикальный ноль (±0.000) — высота фундамента снизу
  const bottomOfSection = area.y + area.h - padV;
  const zeroY = bottomOfSection - modelToSheet(params.foundationDepthM, scale);

  return {
    scaleH,
    scaleV,
    left,
    right,
    zeroY,
    widthMm: drawingW,
    heightMm: drawingH,
    params,
    area,
  };
}

// ---------------------------------------------------------------------------
// Отметки высот (высотные отметки СПДС)
// ---------------------------------------------------------------------------

export interface ElevationMark {
  /** Абсолютная отметка (м), напр. +3.000, -0.150 */
  valueM: number;
  /** Y-координата на листе (мм) */
  y: number;
  /** Форматированная строка (+3.000, ±0.000, -0.150) */
  label: string;
  /** Положение метки (левая или правая сторона) */
  side: "left" | "right";
}

function formatElevation(m: number): string {
  if (Math.abs(m) < 0.001) return "±0.000";
  const sign = m > 0 ? "+" : "";
  return `${sign}${m.toFixed(3)}`;
}

export function buildElevationMarks(geo: SectionGeometry): ElevationMark[] {
  const { params, zeroY, scaleV } = geo;

  const marks: ElevationMark[] = [];

  const toY = (heightFromZeroM: number) => zeroY - heightFromZeroM * scaleV;

  // Уровень земли
  marks.push({ valueM: params.groundLevelM, y: toY(params.groundLevelM), label: formatElevation(params.groundLevelM), side: "right" });

  // Уровень чистого пола (±0.000)
  marks.push({ valueM: 0, y: toY(0), label: "±0.000", side: "right" });

  // Подоконник 1 этажа
  marks.push({ valueM: params.windowSillM, y: toY(params.windowSillM), label: formatElevation(params.windowSillM), side: "right" });

  // Верх окна 1 этажа
  const winTopM = params.windowSillM + params.windowHeightM;
  marks.push({ valueM: winTopM, y: toY(winTopM), label: formatElevation(winTopM), side: "right" });

  // Верх двери 1 этажа
  marks.push({ valueM: params.doorHeightM, y: toY(params.doorHeightM), label: formatElevation(params.doorHeightM), side: "left" });

  // Перекрытие 1 этажа
  const slab1TopM = params.floorHeightM;
  marks.push({ valueM: slab1TopM, y: toY(slab1TopM), label: formatElevation(slab1TopM), side: "right" });

  if (params.floors >= 2) {
    // Перекрытие 2 этажа
    const slab2TopM = params.floorHeightM * 2 + params.slabThicknessM;
    marks.push({ valueM: slab2TopM, y: toY(slab2TopM), label: formatElevation(slab2TopM), side: "right" });
  }

  // Конёк / верхняя отметка
  const roofTopM =
    params.floors * params.floorHeightM +
    params.floors * params.slabThicknessM +
    params.roofHeightM;
  marks.push({ valueM: roofTopM, y: toY(roofTopM), label: formatElevation(roofTopM), side: "right" });

  // Фундамент (низ)
  marks.push({ valueM: -params.foundationDepthM, y: toY(-params.foundationDepthM), label: formatElevation(-params.foundationDepthM), side: "left" });

  return marks.filter((m) => Number.isFinite(m.y));
}
