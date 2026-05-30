import type { Door, Vec2, Wall, Window } from "../../../entities/geometry/types";
import { anchorToOffset, buildAnchorFromOffset, projectPointToWall, resolveWallPoint } from "../utils/openingMath";

const TINY_WALL_THRESHOLD = 0.05;
const WALL_AXIS_TOLERANCE = 1e-3;
const WALL_PROP_TOLERANCE = 0.02;
const WALL_HEIGHT_TOLERANCE = 0.05;
const OPENING_REBIND_TOLERANCE_M = 0.12;
const OPENING_WIDTH_TOLERANCE_M = 0.08;

interface NormalizeWallTopologyParams {
  previousWalls: Wall[];
  nextWalls: Wall[];
  doors: Door[];
  windows: Window[];
}

interface NormalizedOpeningCandidate {
  wall: Wall;
  startOffsetM: number;
  score: number;
}

interface WallProjection {
  axis: Vec2;
  origin: Vec2;
  start: number;
  end: number;
}

export interface NormalizeWallTopologyResult {
  walls: Wall[];
  doors: Door[];
  windows: Window[];
}

export function normalizeWallTopology({
  previousWalls,
  nextWalls,
  doors,
  windows,
}: NormalizeWallTopologyParams): NormalizeWallTopologyResult {
  const normalizedWalls = mergeCollinearWalls(
    nextWalls
      .map(cloneWall)
      .filter((wall) => segmentLength(wall.a, wall.b) >= TINY_WALL_THRESHOLD),
    doors,
    windows
  );

  return {
    walls: normalizedWalls,
    doors: reconcileOpenings(doors, previousWalls, normalizedWalls),
    windows: reconcileOpenings(windows, previousWalls, normalizedWalls),
  };
}

function reconcileOpenings<T extends Door | Window>(openings: T[], previousWalls: Wall[], nextWalls: Wall[]): T[] {
  return openings.map((opening) => reconcileOpening(opening, previousWalls, nextWalls));
}

function reconcileOpening<T extends Door | Window>(opening: T, previousWalls: Wall[], nextWalls: Wall[]): T {
  if (!opening.anchor.wallId) {
    return opening;
  }

  const previousWall = previousWalls.find((wall) => wall.id === opening.anchor.wallId) ?? null;
  if (!previousWall) {
    return markOpeningLost(opening);
  }

  const bestCandidate = findBestOpeningCandidate(opening, previousWall, nextWalls);
  if (!bestCandidate) {
    return markOpeningLost(opening);
  }

  return {
    ...opening,
    anchor: buildAnchorFromOffset(bestCandidate.wall, bestCandidate.startOffsetM),
    lost: false,
  };
}

function findBestOpeningCandidate<T extends Door | Window>(
  opening: T,
  previousWall: Wall,
  nextWalls: Wall[]
): NormalizedOpeningCandidate | null {
  const openingStartM = anchorToOffset(opening.anchor, previousWall);
  const openingEndM = openingStartM + opening.width_m;
  const openingCenterM = openingStartM + opening.width_m / 2;
  const openingStartPoint = resolveWallPoint(previousWall, openingStartM);
  const openingEndPoint = resolveWallPoint(previousWall, openingEndM);
  const openingCenterPoint = resolveWallPoint(previousWall, openingCenterM);

  let best: NormalizedOpeningCandidate | null = null;

  nextWalls.forEach((wall) => {
    if (wall.levelId !== previousWall.levelId) {
      return;
    }

    const startProjection = projectPointToWall(openingStartPoint, wall);
    const endProjection = projectPointToWall(openingEndPoint, wall);
    if (startProjection && endProjection) {
      const startOffsetM = Math.min(startProjection.center, endProjection.center);
      const endOffsetM = Math.max(startProjection.center, endProjection.center);
      const projectedWidthM = endOffsetM - startOffsetM;
      const maxDistanceM = Math.max(startProjection.distance, endProjection.distance);
      if (
        maxDistanceM <= OPENING_REBIND_TOLERANCE_M &&
        Math.abs(projectedWidthM - opening.width_m) <= OPENING_WIDTH_TOLERANCE_M
      ) {
        const score = startProjection.distance + endProjection.distance + idBias(opening.anchor.wallId, wall.id);
        if (!best || score < best.score) {
          best = { wall, startOffsetM, score };
        }
        return;
      }
    }

    const centerProjection = projectPointToWall(openingCenterPoint, wall);
    if (!centerProjection) {
      return;
    }
    const wallLengthM = segmentLength(wall.a, wall.b);
    if (centerProjection.distance > OPENING_REBIND_TOLERANCE_M || wallLengthM + OPENING_WIDTH_TOLERANCE_M < opening.width_m) {
      return;
    }
    const startOffsetM = clamp(centerProjection.center - opening.width_m / 2, 0, Math.max(0, wallLengthM - opening.width_m));
    const score =
      centerProjection.distance + idBias(opening.anchor.wallId, wall.id) + Math.abs(startOffsetM - openingStartM) * 0.1;
    if (!best || score < best.score) {
      best = { wall, startOffsetM, score };
    }
  });

  return best;
}

function mergeCollinearWalls(walls: Wall[], doors: Door[], windows: Window[]): Wall[] {
  const remaining = [...walls];
  const openingWallIds = new Set<string>();

  [...doors, ...windows].forEach((opening) => {
    if (opening.anchor.wallId) {
      openingWallIds.add(opening.anchor.wallId);
    }
  });

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < remaining.length; i += 1) {
      for (let j = i + 1; j < remaining.length; j += 1) {
        const left = remaining[i];
        const right = remaining[j];
        if (!canMergeWalls(left, right, remaining, openingWallIds)) {
          continue;
        }
        remaining.splice(j, 1);
        remaining.splice(i, 1, mergeWalls(left, right));
        changed = true;
        break;
      }
      if (changed) {
        break;
      }
    }
  }
  return remaining;
}

function canMergeWalls(left: Wall, right: Wall, allWalls: Wall[], openingWallIds: Set<string>): boolean {
  if (left.levelId !== right.levelId) {
    return false;
  }
  if (!haveCompatibleWallProps(left, right) || !areCollinear(left, right)) {
    return false;
  }

  if (isSameWallGeometry(left, right)) {
    return true;
  }

  if (openingWallIds.has(left.id) || openingWallIds.has(right.id)) {
    return false;
  }

  const projection = projectWall(left);
  const otherProjection = projectWallOnAxis(right, projection.axis);
  const overlap = intervalOverlapLength(projection.start, projection.end, otherProjection.start, otherProjection.end);
  if (overlap > WALL_AXIS_TOLERANCE) {
    return false;
  }

  const mergePoint = findSharedEndpoint(left, right);
  if (!mergePoint) {
    return false;
  }

  return !isStructuralJunction(mergePoint, left, right, allWalls, projection.axis);
}

function haveCompatibleWallProps(left: Wall, right: Wall): boolean {
  return (
    Math.abs(left.thickness_m - right.thickness_m) <= WALL_PROP_TOLERANCE &&
    Math.abs(left.height_m - right.height_m) <= WALL_HEIGHT_TOLERANCE &&
    (left.wallAssemblyId ?? null) === (right.wallAssemblyId ?? null) &&
    JSON.stringify(left.layers ?? []) === JSON.stringify(right.layers ?? [])
  );
}

function areCollinear(left: Wall, right: Wall): boolean {
  const axis = normalize({ x: left.b.x - left.a.x, y: left.b.y - left.a.y });
  if (!axis) {
    return false;
  }
  const startOffset = Math.abs(cross(axis, { x: right.a.x - left.a.x, y: right.a.y - left.a.y }));
  const endOffset = Math.abs(cross(axis, { x: right.b.x - left.a.x, y: right.b.y - left.a.y }));
  return startOffset <= WALL_AXIS_TOLERANCE && endOffset <= WALL_AXIS_TOLERANCE;
}

function isSameWallGeometry(left: Wall, right: Wall): boolean {
  return (
    (pointsClose(left.a, right.a) && pointsClose(left.b, right.b)) ||
    (pointsClose(left.a, right.b) && pointsClose(left.b, right.a))
  );
}

function findSharedEndpoint(left: Wall, right: Wall): Vec2 | null {
  if (pointsClose(left.a, right.a) || pointsClose(left.a, right.b)) {
    return { ...left.a };
  }
  if (pointsClose(left.b, right.a) || pointsClose(left.b, right.b)) {
    return { ...left.b };
  }
  return null;
}

function isStructuralJunction(point: Vec2, left: Wall, right: Wall, walls: Wall[], axis: Vec2): boolean {
  return walls.some((wall) => {
    if (wall.id === left.id || wall.id === right.id) {
      return false;
    }

    const touchesEndpoint = pointsClose(point, wall.a) || pointsClose(point, wall.b);
    if (touchesEndpoint) {
      return !wallIsParallelToAxis(wall, axis);
    }

    return pointLiesOnWallInterior(point, wall);
  });
}

function wallIsParallelToAxis(wall: Wall, axis: Vec2): boolean {
  const wallAxis = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
  if (!wallAxis) {
    return false;
  }
  return Math.abs(cross(axis, wallAxis)) <= WALL_AXIS_TOLERANCE;
}

function pointLiesOnWallInterior(point: Vec2, wall: Wall): boolean {
  const projection = projectPointToSegment(point, wall.a, wall.b);
  if (!projection) {
    return false;
  }
  return projection.distance <= WALL_AXIS_TOLERANCE && projection.t > WALL_AXIS_TOLERANCE && projection.t < 1 - WALL_AXIS_TOLERANCE;
}

function mergeWalls(primary: Wall, secondary: Wall): Wall {
  const projection = projectWall(primary);
  const otherProjection = projectWallOnAxis(secondary, projection.axis);
  const start = Math.min(projection.start, otherProjection.start);
  const end = Math.max(projection.end, otherProjection.end);
  return {
    ...primary,
    a: {
      x: projection.origin.x + projection.axis.x * start,
      y: projection.origin.y + projection.axis.y * start,
    },
    b: {
      x: projection.origin.x + projection.axis.x * end,
      y: projection.origin.y + projection.axis.y * end,
    },
  };
}

function projectWall(wall: Wall): WallProjection {
  const axis = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y }) ?? { x: 1, y: 0 };
  const normal = { x: -axis.y, y: axis.x };
  const start = dot(axis, wall.a);
  const end = dot(axis, wall.b);
  return {
    axis,
    origin: scale(normal, dot(normal, wall.a)),
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

function projectWallOnAxis(wall: Wall, axis: Vec2) {
  return {
    start: Math.min(dot(axis, wall.a), dot(axis, wall.b)),
    end: Math.max(dot(axis, wall.a), dot(axis, wall.b)),
  };
}

function cloneWall(wall: Wall): Wall {
  return {
    ...wall,
    a: { ...wall.a },
    b: { ...wall.b },
    layers: wall.layers?.map((layer) => ({ ...layer })),
  };
}

function markOpeningLost<T extends Door | Window>(opening: T): T {
  return {
    ...opening,
    anchor: { ...opening.anchor, wallId: null },
    lost: true,
  };
}

function projectPointToSegment(point: Vec2, start: Vec2, end: Vec2) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= WALL_AXIS_TOLERANCE) {
    return null;
  }
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  const projected = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
  return {
    t,
    distance: segmentLength(point, projected),
  };
}

function intervalOverlapLength(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function pointsClose(left: Vec2, right: Vec2): boolean {
  return segmentLength(left, right) <= WALL_AXIS_TOLERANCE;
}

function segmentLength(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(vector: Vec2): Vec2 | null {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= WALL_AXIS_TOLERANCE) {
    return null;
  }
  return { x: vector.x / length, y: vector.y / length };
}

function scale(vector: Vec2, factor: number): Vec2 {
  return { x: vector.x * factor, y: vector.y * factor };
}

function dot(left: Vec2, right: Vec2): number {
  return left.x * right.x + left.y * right.y;
}

function cross(left: Vec2, right: Vec2): number {
  return left.x * right.y - left.y * right.x;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function idBias(expectedId: string | null, candidateId: string): number {
  return expectedId === candidateId ? -0.01 : 0;
}
