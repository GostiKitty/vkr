/**
 * Вычисляет компоновку элементов на листе А3.
 *
 * Координатная система: мм от левого верхнего угла листа.
 * Ось Y направлена вниз (как в SVG).
 *
 * Типовая СПДС-компоновка для А3 альбомной:
 *   ┌────────────────────────────────────────────┐
 *   │ (рамка и поле подшивки, ГОСТ 2.301)        │
 *   │  ┌─────────────────────┬───────────────┐  │
 *   │  │                     │  Экспликация  │  │
 *   │  │   ПЛАН ЭТАЖА        ├───────────────┤  │
 *   │  │   (вид сверху)      │               │  │
 *   │  │                     │  РАЗРЕЗ 1-1   │  │
 *   │  ├─────────────────────┤               │  │
 *   │  │                     ├───────────────┤  │
 *   │  │                     │  ОСНОВНАЯ     │  │
 *   │  │                     │  НАДПИСЬ      │  │
 *   │  └─────────────────────┴───────────────┘  │
 *   └────────────────────────────────────────────┘
 */

import type { BuildingModel } from "../../entities/geometry/types";
import {
  GOST_MARGIN,
  GOST_TITLE_BLOCK,
  SHEET_A3_LANDSCAPE,
  type DrawingScale,
  type DrawingSheetLayout,
  type Rect2D,
  type SheetFormat,
  modelToSheet,
} from "./drawingTypes";

// ---------------------------------------------------------------------------
// Вспомогательные расчёты
// ---------------------------------------------------------------------------

/** Рабочее поле внутри рамки ГОСТ (мм, от края листа) */
export function computeWorkArea(sheet: SheetFormat): Rect2D {
  return {
    x: GOST_MARGIN.left,
    y: GOST_MARGIN.top,
    w: sheet.widthMm - GOST_MARGIN.left - GOST_MARGIN.right,
    h: sheet.heightMm - GOST_MARGIN.top - GOST_MARGIN.bottom,
  };
}

/**
 * Подобрать масштаб так, чтобы план этажа вписался в ~55% рабочего поля по ширине.
 * Возвращает масштаб и размер плана с размерными линиями.
 */
export function choosePlanScale(
  model: BuildingModel,
  availableWidthMm: number,
  availableHeightMm: number
): { scale: DrawingScale; planBodyMm: { w: number; h: number } } {
  // Получить максимальные габариты здания по всем уровням
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of model.walls) {
    minX = Math.min(minX, w.a.x, w.b.x);
    minY = Math.min(minY, w.a.y, w.b.y);
    maxX = Math.max(maxX, w.a.x, w.b.x);
    maxY = Math.max(maxY, w.a.y, w.b.y);
  }
  for (const r of model.rooms) {
    for (const p of r.polygon) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  const bldW = Number.isFinite(maxX - minX) && maxX > minX ? maxX - minX : 10;
  const bldH = Number.isFinite(maxY - minY) && maxY > minY ? maxY - minY : 8;

  // Запас на размерные линии: 30мм по каждому краю
  const dimMargin = 30;

  const scales: DrawingScale[] = ["1:50", "1:100", "1:200"];
  for (const s of scales) {
    const wMm = modelToSheet(bldW, s);
    const hMm = modelToSheet(bldH, s);
    if (wMm + dimMargin * 2 <= availableWidthMm && hMm + dimMargin * 2 <= availableHeightMm) {
      return { scale: s, planBodyMm: { w: wMm, h: hMm } };
    }
  }
  // Fallback: 1:200 (самый мелкий)
  return {
    scale: "1:200",
    planBodyMm: {
      w: modelToSheet(bldW, "1:200"),
      h: modelToSheet(bldH, "1:200"),
    },
  };
}

// ---------------------------------------------------------------------------
// Главная функция компоновки
// ---------------------------------------------------------------------------

export function buildDrawingSheetLayout(model: BuildingModel): DrawingSheetLayout {
  const sheet = SHEET_A3_LANDSCAPE;
  const work = computeWorkArea(sheet);

  // Основная надпись — в правом нижнем углу рабочего поля
  const tbW = GOST_TITLE_BLOCK.widthMm;
  const tbH = GOST_TITLE_BLOCK.heightMm;
  const titleBlockArea: Rect2D = {
    x: work.x + work.w - tbW,
    y: work.y + work.h - tbH,
    w: tbW,
    h: tbH,
  };

  // Правая колонка (ширина = ширина штампа)
  const rightColX = titleBlockArea.x;
  const rightColW = tbW;
  const rightColTopY = work.y;
  const rightColH = work.h - tbH; // до штампа

  // Левая колонка: от левого края рабочего поля до правой колонки
  const leftColW = work.w - rightColW;
  const leftColX = work.x;
  const leftColH = work.h;

  // В правой колонке сверху — экспликация, снизу — свободное место (до штампа)
  const explicH = Math.min(90, rightColH);
  const explicArea: Rect2D = {
    x: rightColX,
    y: rightColTopY,
    w: rightColW,
    h: explicH,
  };

  // В левой колонке: план сверху (~65%), разрез снизу (~35%)
  const planAreaH = Math.round(leftColH * 0.62);
  const sectionAreaH = leftColH - planAreaH;

  const planArea: Rect2D = {
    x: leftColX,
    y: work.y,
    w: leftColW,
    h: planAreaH,
  };
  const sectionArea: Rect2D = {
    x: leftColX,
    y: work.y + planAreaH,
    w: leftColW,
    h: sectionAreaH,
  };

  // Выбрать масштаб под план
  const { scale } = choosePlanScale(model, leftColW - 5, planAreaH - 5);

  return {
    sheet,
    scale,
    workArea: work,
    planArea,
    sectionArea,
    explicArea,
    titleBlockArea,
  };
}
