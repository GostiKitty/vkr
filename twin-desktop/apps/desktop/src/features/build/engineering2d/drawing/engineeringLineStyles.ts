import { DRAWING_LINE, DRAWING_DASH, MEDIUM_PALETTE } from "./drawingTheme";
import type { EngineeringMedium } from "../../../../entities/engineering/types";

export interface PipeStrokeStyle {
  stroke: string;
  strokeWidth: number;
  dasharray?: string;
  /**
   * Толщина «тени» (контур-обложка под основной линией),
   * используется для подачи/обратки чтобы стык читался как трубопровод.
   */
  haloWidth?: number;
  halo?: string;
}

/**
 * Толщина линии трубы в условных px по фактическому диаметру (мм).
 * Магистрали Ø100+ — толще, разводка Ø15..32 — тоньше. Сохраняем
 * визуальную иерархию без потери читаемости.
 */
export function pipeWidthFromDiameter(diameterMm: number | null | undefined): number {
  if (!diameterMm || !Number.isFinite(diameterMm)) {
    return DRAWING_LINE.medium;
  }
  if (diameterMm >= 150) return DRAWING_LINE.heavy;
  if (diameterMm >= 80) return DRAWING_LINE.thick;
  if (diameterMm >= 40) return DRAWING_LINE.medium;
  if (diameterMm >= 20) return DRAWING_LINE.regular;
  return DRAWING_LINE.thin;
}

export function getPipeStrokeStyle(
  medium: EngineeringMedium,
  diameterMm: number | null | undefined,
  options: { selected?: boolean; emphasised?: boolean } = {}
): PipeStrokeStyle {
  const palette = MEDIUM_PALETTE[medium];
  const width = pipeWidthFromDiameter(diameterMm) * (options.emphasised ? 1.15 : 1);
  return {
    stroke: palette.ink,
    strokeWidth: options.selected ? Math.max(width, DRAWING_LINE.thick) : width,
    dasharray: palette.dash,
    haloWidth: width + 1.6,
    halo: palette.tint,
  };
}

export const WALL_STYLES = {
  exterior: {
    stroke: "#1f2937",
    strokeWidth: DRAWING_LINE.medium,
    fill: "#3a4250",
    hatch: "#9aa3b2",
  },
  interior: {
    stroke: "#3a4250",
    strokeWidth: DRAWING_LINE.thin,
    fill: "#9aa3b2",
    hatch: "#c3c9d3",
  },
};

export const ROOM_STYLES = {
  fill: "#f4f1ea",
  fillAlt: "#efece3",
  stroke: "rgba(31,41,55,0.18)",
  strokeWidth: DRAWING_LINE.hairline,
};

export const AXIS_STYLES = {
  stroke: "#1f2937",
  strokeWidth: DRAWING_LINE.thin,
  dasharray: DRAWING_DASH.axis,
  bubbleRadius: 11,
  bubbleStroke: "#1f2937",
  bubbleFill: "#fbfbf7",
  labelColor: "#1f2937",
};

export const DIMENSION_STYLES = {
  stroke: "#1f2937",
  strokeWidth: DRAWING_LINE.hairline,
  tickLength: 6,
  textColor: "#1f2937",
  offset: 26,
};

export const GRID_STYLES = {
  stroke: "rgba(31,41,55,0.05)",
  strokeWidth: DRAWING_LINE.hairline,
  majorStroke: "rgba(31,41,55,0.09)",
  majorWidth: DRAWING_LINE.hairline,
};

export const OPENING_STYLES = {
  windowOuter: "#1f2937",
  windowInner: "#36a7e7",
  windowWidth: DRAWING_LINE.thin,
  doorArc: "rgba(31,41,55,0.55)",
  doorLeaf: "#1f2937",
  doorWidth: DRAWING_LINE.thin,
};

export const EQUIPMENT_STYLES = {
  stroke: "#1f2937",
  fill: "#ffffff",
  strokeWidth: DRAWING_LINE.thin,
  accent: "#10745f",
  highlight: "#2f6fdb",
};
