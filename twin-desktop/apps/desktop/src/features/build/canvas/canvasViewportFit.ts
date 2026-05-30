import type { Vec2 } from "../../../entities/geometry/types";

export type CanvasViewportSize = {
  width: number;
  height: number;
};

export type CanvasViewportFit = {
  origin: Vec2;
  zoom: number;
};

export type CanvasViewportFitOptions = {
  padding?: number;
  minZoom?: number;
  maxZoom?: number;
};

export function computeCanvasViewportFit(
  points: Vec2[],
  viewport: CanvasViewportSize,
  options: CanvasViewportFitOptions = {}
): CanvasViewportFit | null {
  if (!points.length || viewport.width <= 1 || viewport.height <= 1) {
    return null;
  }

  const padding = options.padding ?? 1.5;
  const minZoom = options.minZoom ?? 18;
  const maxZoom = options.maxZoom ?? 220;

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const boundsWidth = Math.max(maxX - minX, 1) + padding * 2;
  const boundsHeight = Math.max(maxY - minY, 1) + padding * 2;
  const zoomX = viewport.width / boundsWidth;
  const zoomY = viewport.height / boundsHeight;
  const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), minZoom), maxZoom);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    origin: {
      x: centerX - viewport.width / (2 * zoom),
      y: centerY - viewport.height / (2 * zoom),
    },
    zoom,
  };
}

export function worldToScreenPoint(point: Vec2, view: CanvasViewportFit): Vec2 {
  return {
    x: (point.x - view.origin.x) * view.zoom,
    y: (point.y - view.origin.y) * view.zoom,
  };
}
