import type { EngineeringMedium } from "../../../../entities/engineering/types";
import type { PipeSystemType } from "../../../../entities/networks/types";

/**
 * Тема инженерного чертежа. Все цвета — фиксированные HEX (не CSS-переменные),
 * чтобы экспорт в PNG/SVG выглядел одинаково вне зависимости от темы UI.
 */

export const DRAWING_PAPER = {
  background: "#fbfbf7",
  ink: "#1f2937",
  inkSoft: "#4b5563",
  inkMuted: "#7a8597",
  border: "#1f2937",
  borderSoft: "#cbd2dd",
  fillRoom: "#f4f1ea",
  fillRoomAlt: "#efece3",
  fillWall: "#3a4250",
  fillHatch: "#9aa3b2",
  accent: "#2f6fdb",
  warn: "#c8782a",
};

export const DRAWING_TYPOGRAPHY = {
  family: "'Inter','Segoe UI','PT Sans',sans-serif",
  monoFamily: "'IBM Plex Mono','JetBrains Mono','Consolas',monospace",
  axisLabel: 11,
  dimensionLabel: 10,
  pipeLabel: 9.5,
  roomNumber: 12,
  roomName: 10,
  roomMeta: 9,
  stampTitle: 13,
  stampMeta: 10,
  legendTitle: 11,
  legendItem: 10,
  smallNote: 9,
};

export const DRAWING_LINE = {
  hairline: 0.4,
  thin: 0.7,
  regular: 1.0,
  medium: 1.4,
  thick: 1.9,
  heavy: 2.6,
};

export const DRAWING_DASH = {
  axis: "5 3 1 3", // штрих-пунктир для осей
  grid: "1 3",
  return: "6 3",
  drainage: "4 3 1 3",
  signal: "2 2",
  hidden: "3 3",
};

/**
 * Палитра инженерных сетей. Подобрана как «технический»
 * вариант ГОСТ-цветов, но с лучшей читаемостью на бумаге.
 */
export const MEDIUM_PALETTE: Record<
  EngineeringMedium,
  { ink: string; tint: string; label: string; short: string; dash?: string }
> = {
  supply: { ink: "#c44a1a", tint: "#fce4d6", label: "Подача (отопление)", short: "Т1" },
  return: { ink: "#1c66c4", tint: "#dbe7f8", label: "Обратка (отопление)", short: "Т2", dash: DRAWING_DASH.return },
  dhw: { ink: "#d87a14", tint: "#fdebd2", label: "ГВС", short: "Т3" },
  coldWater: { ink: "#0f8fbf", tint: "#d9eef6", label: "ХВС", short: "В1" },
  drain: { ink: "#5a4631", tint: "#e8ddcb", label: "Канализация/дренаж", short: "К", dash: DRAWING_DASH.drainage },
  electric: { ink: "#7c3aed", tint: "#ece1fb", label: "Электропитание", short: "Э" },
  signal: { ink: "#0f766e", tint: "#d4eee9", label: "Сигнал/КИП", short: "С", dash: DRAWING_DASH.signal },
  airSupply: { ink: "#0f8f7f", tint: "#d6f1ec", label: "Приточный воздух", short: "П1" },
  airExhaust: { ink: "#5f6b7a", tint: "#e4e8ed", label: "Вытяжной воздух", short: "В1", dash: DRAWING_DASH.hidden },
};

export const NETWORK_PIPE_PALETTE: Record<PipeSystemType, EngineeringMedium> = {
  heating_supply: "supply",
  heating_return: "return",
  dhw: "dhw",
  chw: "coldWater",
};

export interface SheetMetrics {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  innerFrameOffset: number;
  stamp: { width: number; height: number };
}

/**
 * Метрики листа в условных пикселях. ВыборA3 — оптимален для одного этажа.
 * Реальный масштаб (например 1:100) выводится в штампе и легенде.
 */
export const SHEET_PRESETS: Record<"A4" | "A3" | "A2" | "A1", SheetMetrics> = {
  A4: {
    width: 1188,
    height: 840,
    margin: { top: 20, right: 20, bottom: 20, left: 60 },
    innerFrameOffset: 6,
    stamp: { width: 360, height: 130 },
  },
  A3: {
    width: 1684,
    height: 1190,
    margin: { top: 24, right: 24, bottom: 24, left: 80 },
    innerFrameOffset: 8,
    stamp: { width: 420, height: 150 },
  },
  A2: {
    width: 2380,
    height: 1684,
    margin: { top: 28, right: 28, bottom: 28, left: 100 },
    innerFrameOffset: 10,
    stamp: { width: 480, height: 170 },
  },
  A1: {
    width: 3368,
    height: 2380,
    margin: { top: 32, right: 32, bottom: 32, left: 120 },
    innerFrameOffset: 12,
    stamp: { width: 540, height: 190 },
  },
};

export const DEFAULT_SHEET_PRESET: keyof typeof SHEET_PRESETS = "A3";
