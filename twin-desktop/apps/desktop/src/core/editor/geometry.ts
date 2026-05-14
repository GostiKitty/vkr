import { segmentsIntersect } from "../../entities/geometry/geom";
import type { BuildingModel, Vec2, Wall } from "../../entities/geometry/types";
import { createId } from "../../shared/utils/id";
import { detectRoomsFromWalls, type RoomLoopCandidate, type RoomProblem } from "../geometry/roomContours";
import type { SegmentSnapCandidate, WallJoinResult } from "./types";

const EPS = 1e-6;
const MIN_SEGMENT_LENGTH = 0.1;

export function snapToPoint(point: Vec2, anchors: readonly Vec2[], tolerance: number): Vec2 {
  let bestPointX = point.x;
  let bestPointY = point.y;
  let bestDistance = tolerance;
  anchors.forEach((anchor) => {
    const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestPointX = anchor.x;
      bestPointY = anchor.y;
    }
  });
  return { x: bestPointX, y: bestPointY };
}

export function snapToSegment(point: Vec2, walls: readonly Wall[], tolerance: number): SegmentSnapCandidate | null {
  let best: SegmentSnapCandidate | null = null;
  walls.forEach((wall) => {
    const projection = projectPointToSegment(point, wall.a, wall.b);
    if (!projection || projection.distance > tolerance) {
      return;
    }
    if (!best || projection.distance < best.distance) {
      best = {
        point: projection.point,
        distance: projection.distance,
        wallId: wall.id,
        t: projection.t,
      };
    }
  });
  return best;
}

export function detectIntersection(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  if (!segmentsIntersect(a1, a2, b1, b2)) {
    return null;
  }
  const denominator = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(denominator) <= EPS) {
    return null;
  }
  const crossA = a1.x * a2.y - a1.y * a2.x;
  const crossB = b1.x * b2.y - b1.y * b2.x;
  const x = (crossA * (b1.x - b2.x) - (a1.x - a2.x) * crossB) / denominator;
  const y = (crossA * (b1.y - b2.y) - (a1.y - a2.y) * crossB) / denominator;
  return { x, y };
}

export function autoJoinWalls(existingWalls: readonly Wall[], candidateWall: Wall, tolerance = 0.2): WallJoinResult {
  const anchors = existingWalls.flatMap((wall) => [wall.a, wall.b]);
  const snappedStart = snapToPoint(candidateWall.a, anchors, tolerance);
  const snappedEnd = snapToPoint(candidateWall.b, anchors, tolerance);
  const intersections: Vec2[] = [];

  let nextWalls = existingWalls.map((wall) => ({
    ...wall,
    a: { ...wall.a },
    b: { ...wall.b },
  }));

  nextWalls = nextWalls.flatMap((wall) => {
    if (sharesEndpoint(snappedStart, snappedEnd, wall, tolerance)) {
      return [wall];
    }
    const intersection = detectIntersection(snappedStart, snappedEnd, wall.a, wall.b);
    if (!intersection || isEndpoint(intersection, wall.a, tolerance) || isEndpoint(intersection, wall.b, tolerance)) {
      return [wall];
    }
    intersections.push(intersection);
    return splitWallAtPoint(wall, intersection);
  });

  const candidatePoints = uniquePoints([snappedStart, ...intersections, snappedEnd], tolerance).sort(
    (left, right) => distanceAlong(snappedStart, left) - distanceAlong(snappedStart, right)
  );
  const insertedSegments: Wall[] = [];
  for (let index = 1; index < candidatePoints.length; index += 1) {
    const a = candidatePoints[index - 1];
    const b = candidatePoints[index];
    if (segmentLength(a, b) < MIN_SEGMENT_LENGTH) {
      continue;
    }
    insertedSegments.push({
      ...candidateWall,
      id: createId("wall"),
      a: { ...a },
      b: { ...b },
    });
  }

  return {
    walls: dedupeWalls([...nextWalls, ...insertedSegments], tolerance),
    insertedWallIds: insertedSegments.map((wall) => wall.id),
    snappedStart,
    snappedEnd,
    intersections,
  };
}

export function rebuildRoomContours(
  model: BuildingModel
): { problems: RoomProblem[]; loops: RoomLoopCandidate[] } {
  const contours = detectRoomsFromWalls(model);
  return {
    problems: contours.problems,
    loops: contours.loops,
  };
}

function projectPointToSegment(point: Vec2, start: Vec2, end: Vec2) {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (lengthSquared <= EPS) {
    return null;
  }
  const t = clamp(
    ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / lengthSquared,
    0,
    1
  );
  const projected = {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
  return {
    point: projected,
    t,
    distance: Math.hypot(point.x - projected.x, point.y - projected.y),
  };
}

function splitWallAtPoint(wall: Wall, point: Vec2): Wall[] {
  if (segmentLength(wall.a, point) < MIN_SEGMENT_LENGTH || segmentLength(point, wall.b) < MIN_SEGMENT_LENGTH) {
    return [wall];
  }
  return [
    { ...wall, id: createId("wall"), a: { ...wall.a }, b: { ...point } },
    { ...wall, id: createId("wall"), a: { ...point }, b: { ...wall.b } },
  ];
}

function dedupeWalls(walls: Wall[], tolerance: number): Wall[] {
  const unique: Wall[] = [];
  walls.forEach((wall) => {
    if (segmentLength(wall.a, wall.b) < MIN_SEGMENT_LENGTH) {
      return;
    }
    const duplicate = unique.some(
      (candidate) =>
        (isEndpoint(candidate.a, wall.a, tolerance) && isEndpoint(candidate.b, wall.b, tolerance)) ||
        (isEndpoint(candidate.a, wall.b, tolerance) && isEndpoint(candidate.b, wall.a, tolerance))
    );
    if (!duplicate) {
      unique.push(wall);
    }
  });
  return unique;
}

function uniquePoints(points: Vec2[], tolerance: number): Vec2[] {
  const unique: Vec2[] = [];
  points.forEach((point) => {
    if (!unique.some((candidate) => isEndpoint(candidate, point, tolerance))) {
      unique.push(point);
    }
  });
  return unique;
}

function distanceAlong(origin: Vec2, point: Vec2): number {
  return Math.hypot(point.x - origin.x, point.y - origin.y);
}

function segmentLength(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sharesEndpoint(a: Vec2, b: Vec2, wall: Wall, tolerance: number): boolean {
  return isEndpoint(a, wall.a, tolerance) || isEndpoint(a, wall.b, tolerance) || isEndpoint(b, wall.a, tolerance) || isEndpoint(b, wall.b, tolerance);
}

function isEndpoint(a: Vec2, b: Vec2, tolerance: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
