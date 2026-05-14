export function temperatureToColor(temp?: number | null, min = 15, max = 30): string {
  if (temp === null || temp === undefined || Number.isNaN(temp)) {
    return "#cbd5f5";
  }
  const span = max - min;
  const ratio = span <= 1e-6 ? 0.5 : clamp((temp - min) / span, 0, 1);
  return interpolateStops(ratio, [
    { stop: 0, color: "#1d4ed8" },
    { stop: 0.18, color: "#06b6d4" },
    { stop: 0.4, color: "#10b981" },
    { stop: 0.62, color: "#facc15" },
    { stop: 0.8, color: "#fb923c" },
    { stop: 1, color: "#dc2626" },
  ]);
}

export function formatTemperature(temp?: number | null, unit = "°C"): string {
  if (temp === null || temp === undefined || Number.isNaN(temp)) {
    return "—";
  }
  return `${temp.toFixed(1)}${unit}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function interpolateStops(ratio: number, stops: Array<{ stop: number; color: string }>) {
  const nextIndex = stops.findIndex((entry) => ratio <= entry.stop);
  if (nextIndex <= 0) {
    return stops[0]?.color ?? "#1d4ed8";
  }
  if (nextIndex === -1) {
    return stops[stops.length - 1]?.color ?? "#dc2626";
  }
  const left = stops[nextIndex - 1];
  const right = stops[nextIndex];
  const localRatio = clamp((ratio - left.stop) / Math.max(right.stop - left.stop, 1e-6), 0, 1);
  const leftRgb = hexToRgb(left.color);
  const rightRgb = hexToRgb(right.color);
  return rgbToHex({
    r: Math.round(leftRgb.r + (rightRgb.r - leftRgb.r) * localRatio),
    g: Math.round(leftRgb.g + (rightRgb.g - leftRgb.g) * localRatio),
    b: Math.round(leftRgb.b + (rightRgb.b - leftRgb.b) * localRatio),
  });
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}
