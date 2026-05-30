/**
 * ANSYS/CFD-inspired thermal colormap for building visualization.
 *
 * 6-stop gradient:
 *   0.00 → deep navy   (cold surfaces, ~outdoor or below comfort)
 *   0.20 → sky blue    (cool air near windows/exterior walls)
 *   0.38 → cyan        (lower comfort zone boundary)
 *   0.55 → green       (comfortable, ~18–21 °C)
 *   0.70 → yellow      (warm, ~22–25 °C)
 *   0.82 → orange      (hot, near radiators / >25 °C)
 *   1.00 → deep red    (overheating / high surface temperature)
 *
 * Not a CFD solver — purely a visualization layer.
 */
import * as THREE from "three";

interface ColorStop {
  t: number;
  r: number;
  g: number;
  b: number;
}

/** Normalized [0..1] RGB stops, physically inspired for thermal visualization. */
const STOPS: ColorStop[] = [
  { t: 0.00, r: 0.06, g: 0.12, b: 0.52 }, // #0f1f85  deep navy
  { t: 0.20, r: 0.04, g: 0.47, b: 0.82 }, // #0a78d1  sky blue
  { t: 0.38, r: 0.05, g: 0.76, b: 0.76 }, // #0dc2c2  cyan-teal
  { t: 0.55, r: 0.18, g: 0.76, b: 0.38 }, // #2ec261  green
  { t: 0.70, r: 0.93, g: 0.85, b: 0.10 }, // #edd919  yellow
  { t: 0.82, r: 0.97, g: 0.51, b: 0.08 }, // #f78214  orange
  { t: 1.00, r: 0.72, g: 0.07, b: 0.07 }, // #b71212  deep red
];

/**
 * Map a normalized [0..1] value to an ANSYS-like thermal color.
 * Clamped to [0, 1]. Returns a THREE.Color (sRGB).
 */
export function thermalColor(t: number): THREE.Color {
  const clamped = Math.min(1.0, Math.max(0.0, t));

  // Find surrounding stops
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (clamped >= STOPS[i].t && clamped <= STOPS[i + 1].t) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }

  const span = Math.max(hi.t - lo.t, 1e-9);
  const f = (clamped - lo.t) / span;
  const out = new THREE.Color();
  out.r = lo.r + (hi.r - lo.r) * f;
  out.g = lo.g + (hi.g - lo.g) * f;
  out.b = lo.b + (hi.b - lo.b) * f;
  return out;
}

/**
 * Map a physical value to a thermal color given a display range.
 * Values outside [min, max] are clamped.
 */
export function thermalColorFromValue(
  value: number,
  min: number,
  max: number,
): THREE.Color {
  const span = Math.max(max - min, 1e-9);
  return thermalColor((value - min) / span);
}

/**
 * Compute P5..P95 percentile range from a sorted array.
 * Returns a ≥ MIN_VISUAL_RANGE spread centered on the median.
 */
export function percentileRange(
  values: number[],
  minVisualRange = 2.0,
): { p5: number; p95: number; average: number } {
  if (values.length === 0) {
    return { p5: 0, p95: minVisualRange, average: minVisualRange * 0.5 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const p5 = sorted[Math.max(0, Math.floor(sorted.length * 0.05))];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;

  const spread = p95 - p5;
  if (spread < minVisualRange) {
    const center = (p5 + p95) * 0.5;
    return {
      p5: center - minVisualRange * 0.5,
      p95: center + minVisualRange * 0.5,
      average,
    };
  }
  return { p5, p95, average };
}

/** CSS linear-gradient string matching the colormap stops, for use in HTML legends. */
export function thermalGradientCss(): string {
  const parts = STOPS.map((s) => {
    const r = Math.round(s.r * 255);
    const g = Math.round(s.g * 255);
    const b = Math.round(s.b * 255);
    return `rgb(${r},${g},${b}) ${(s.t * 100).toFixed(0)}%`;
  });
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

/**
 * Two-stop gradient for a special mode (e.g. condensation risk: safe→danger).
 */
export function binaryGradientCss(coldHex: string, hotHex: string): string {
  return `linear-gradient(90deg, ${coldHex} 0%, ${hotHex} 100%)`;
}
