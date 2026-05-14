import { orthogonalSnap } from "../../entities/geometry/geom";
import type { Vec2 } from "../../entities/geometry/types";
import type { LinearDraft, LinearTool } from "./types";

export function isLinearTool(tool: string): tool is LinearTool {
  return tool === "wall" || tool === "pipe" || tool === "duct";
}

export function startLinearDraft(tool: LinearTool, point: Vec2): LinearDraft {
  return { tool, points: [{ ...point }] };
}

export function appendLinearDraftPoint(
  draft: LinearDraft | null,
  tool: LinearTool,
  point: Vec2,
  orthogonalMode: boolean
): LinearDraft {
  if (!draft || draft.tool !== tool || draft.points.length === 0) {
    return startLinearDraft(tool, point);
  }
  const lastPoint = draft.points[draft.points.length - 1];
  const nextPoint = orthogonalMode ? orthogonalSnap(point, lastPoint) : point;
  const isDuplicate = Math.hypot(nextPoint.x - lastPoint.x, nextPoint.y - lastPoint.y) < 1e-6;
  if (isDuplicate) {
    return draft;
  }
  return {
    tool,
    points: [...draft.points, { ...nextPoint }],
  };
}

export function previewLinearDraftPoint(
  draft: LinearDraft | null,
  point: Vec2,
  orthogonalMode: boolean
): Vec2 | null {
  if (!draft || draft.points.length === 0) {
    return null;
  }
  const lastPoint = draft.points[draft.points.length - 1];
  return orthogonalMode ? orthogonalSnap(point, lastPoint) : point;
}

export function cancelLinearDraft(): null {
  return null;
}

export function finalizeLinearDraft(draft: LinearDraft | null): Vec2[] {
  if (!draft || draft.points.length < 2) {
    return [];
  }
  return draft.points.map((point) => ({ ...point }));
}
