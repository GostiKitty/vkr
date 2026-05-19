import type { Vec2, Wall } from "../../entities/geometry/types";

export type EditorMode = "architecture" | "networks" | "view3d" | "results";
export type EditorViewport = "plan" | "view3d" | "networks" | "thermal" | "results";
export type LinearTool = "wall" | "pipe" | "duct";

export interface LinearDraft {
  tool: LinearTool;
  points: Vec2[];
}

export interface SnapCandidate {
  point: Vec2;
  distance: number;
}

export interface SegmentSnapCandidate extends SnapCandidate {
  wallId?: string;
  t: number;
}

export interface WallJoinResult {
  walls: Wall[];
  insertedWallIds: string[];
  snappedStart: Vec2;
  snappedEnd: Vec2;
  intersections: Vec2[];
}
