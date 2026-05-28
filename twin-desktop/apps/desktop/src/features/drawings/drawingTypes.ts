/**
 * Типы для модуля генерации архитектурного чертёжного листа (ГОСТ/СПДС).
 * Не зависит от UI и от существующего 2D-редактора.
 */

// ---------------------------------------------------------------------------
// Форматы листов и масштабы
// ---------------------------------------------------------------------------

export type DrawingScale = "1:50" | "1:100" | "1:200";

/** Знаменатель масштаба (для расчётов) */
export function scaleDenominator(scale: DrawingScale): number {
  return parseInt(scale.split(":")[1], 10);
}

/** Перевод размера модели (м) → мм на листе при заданном масштабе */
export function modelToSheet(meters: number, scale: DrawingScale): number {
  return (meters * 1000) / scaleDenominator(scale);
}

export interface SheetFormat {
  id: "A4" | "A3" | "A2";
  widthMm: number;
  heightMm: number;
  orientation: "portrait" | "landscape";
}

export const SHEET_A3_LANDSCAPE: SheetFormat = {
  id: "A3",
  widthMm: 420,
  heightMm: 297,
  orientation: "landscape",
};

// ---------------------------------------------------------------------------
// ГОСТ-рамка (ГОСТ 2.104-2006, форма 1)
// ---------------------------------------------------------------------------

/** Поля рамки ГОСТ 2.301 в мм */
export const GOST_MARGIN = {
  left: 20,   // поле подшивки
  top: 5,
  right: 5,
  bottom: 5,
};

/** Основная надпись (штамп), ширина 185мм × высота 55мм */
export const GOST_TITLE_BLOCK = {
  widthMm: 185,
  heightMm: 55,
};

// ---------------------------------------------------------------------------
// Данные основной надписи (штампа)
// ---------------------------------------------------------------------------

export interface TitleBlockData {
  projectCode: string;
  objectName: string;
  sheetName: string;
  stage: string;
  sheetNumber: string;
  totalSheets: string;
  scale: string;
  developer: string;
  checker: string;
  date: string;
}

export function defaultTitleBlock(scale: DrawingScale = "1:100"): TitleBlockData {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return {
    projectCode: "ВКР-2026-ОВ",
    objectName: "Жилой дом",
    sheetName: "План 1-го этажа. Разрез 1-1",
    stage: "ВКР",
    sheetNumber: "1",
    totalSheets: "1",
    scale,
    developer: "",
    checker: "",
    date: `${month}.${now.getFullYear()}`,
  };
}

// ---------------------------------------------------------------------------
// Геометрия на листе (всё в мм от левого верхнего угла листа)
// ---------------------------------------------------------------------------

export interface Rect2D {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DrawingSheetLayout {
  sheet: SheetFormat;
  scale: DrawingScale;
  /** Внутреннее рабочее поле (за рамкой ГОСТ) */
  workArea: Rect2D;
  /** Зона плана этажа */
  planArea: Rect2D;
  /** Зона разреза 1-1 */
  sectionArea: Rect2D;
  /** Зона экспликации помещений */
  explicArea: Rect2D;
  /** Зона основной надписи */
  titleBlockArea: Rect2D;
}

// ---------------------------------------------------------------------------
// Размерные цепочки
// ---------------------------------------------------------------------------

export interface DimensionTick {
  /** Позиция засечки вдоль цепочки, мм на листе */
  positionMm: number;
  /** Текст подписи (например "3200") */
  label: string;
}

export interface DimensionChain {
  direction: "horizontal" | "vertical";
  /** Позиция самой линии цепочки (перпендикулярная координата, мм) */
  baselineMm: number;
  /** Начало и конец цепочки вдоль основного направления (мм) */
  startMm: number;
  endMm: number;
  /** Засечки, включая крайние */
  ticks: DimensionTick[];
  /** Расстояние от геометрии до линии цепочки (мм) */
  offsetFromGeometryMm: number;
}

// ---------------------------------------------------------------------------
// Разрез
// ---------------------------------------------------------------------------

export interface SectionParams {
  /** Ширина здания в плоскости разреза (м) */
  buildingWidthM: number;
  /** Количество этажей */
  floors: number;
  /** Высота этажа (м) */
  floorHeightM: number;
  /** Толщина перекрытия (м) */
  slabThicknessM: number;
  /** Глубина фундамента относительно уровня ±0.000 (м, положительное = вниз) */
  foundationDepthM: number;
  /** Высота чердака / кровли от верха последнего перекрытия (м) */
  roofHeightM: number;
  /** Вынос карниза (м) */
  roofOverhangM: number;
  /** Отметка земли (отн. ±0.000, обычно -0.150) */
  groundLevelM: number;
  /** Высота подоконника (м) */
  windowSillM: number;
  /** Высота окна (м) */
  windowHeightM: number;
  /** Высота двери (м) */
  doorHeightM: number;
}

export const DEFAULT_SECTION_PARAMS: SectionParams = {
  buildingWidthM: 9.0,
  floors: 2,
  floorHeightM: 3.0,
  slabThicknessM: 0.22,
  foundationDepthM: 0.8,
  roofHeightM: 1.8,
  roofOverhangM: 0.45,
  groundLevelM: -0.150,
  windowSillM: 0.900,
  windowHeightM: 1.400,
  doorHeightM: 2.100,
};

// ---------------------------------------------------------------------------
// Экспликация помещений
// ---------------------------------------------------------------------------

export interface ExplicationRow {
  number: number;
  name: string;
  areaSqM: number;
}
