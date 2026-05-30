import { segmentLength } from "../../../entities/geometry/geom";
import type { BuildingModel, Level, Room, Vec2, Wall } from "../../../entities/geometry/types";
import { createId } from "../../../shared/utils/id";

export interface WallGenerationOptions {
  defaultThickness?: number;
  defaultHeight?: number;
  tolerance?: number;
}

export interface WallGenerationResult {
  walls: Wall[];
  adjacency: Record<string, string[]>;
}

interface RawRoomEdge {
  roomId: string;
  levelId: string;
  a: Vec2;
  b: Vec2;
}

interface OrientedRoomEdge extends RawRoomEdge {
  direction: Vec2;
  normal: Vec2;
  offset: number;
  start: number;
  end: number;
}

interface AtomicEdge {
  a: Vec2;
  b: Vec2;
  levelId: string;
  rooms: Set<string>;
}

export function generateWallsFromRooms(
  model: BuildingModel,
  options: WallGenerationOptions = {}
): WallGenerationResult {
  const thickness = options.defaultThickness ?? 0.3;
  const height = options.defaultHeight ?? estimateDefaultHeight(model);
  const tolerance = options.tolerance ?? 1e-3;
  const levelLookup = new Map(model.levels.map((level) => [level.id, level]));
  const rawEdges = collectRoomEdges(model.rooms, tolerance);
  const atomicEdges = splitRoomEdges(rawEdges, tolerance);
  const adjacency = new Map<string, Set<string>>();

  const walls = atomicEdges.map((edge) => {
    const touchingRooms = Array.from(edge.rooms);
    for (let index = 0; index < touchingRooms.length; index += 1) {
      for (let pairIndex = index + 1; pairIndex < touchingRooms.length; pairIndex += 1) {
        linkRooms(adjacency, touchingRooms[index], touchingRooms[pairIndex]);
      }
    }
    return {
      id: createId("wall"),
      levelId: edge.levelId,
      a: edge.a,
      b: edge.b,
      thickness_m: thickness,
      height_m: heightForLevel(edge.levelId, levelLookup, height),
    };
  });

  return {
    walls,
    adjacency: Object.fromEntries(
      Array.from(adjacency.entries()).map(([roomId, neighbors]) => [roomId, Array.from(neighbors)])
    ),
  };
}

function collectRoomEdges(rooms: Room[], tolerance: number): RawRoomEdge[] {
  const edges: RawRoomEdge[] = [];
  rooms.forEach((room) => {
    const polygon = normalizePolygon(room);
    if (polygon.length < 2) {
      return;
    }
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      if (segmentLength(a, b) < tolerance) {
        continue;
      }
      edges.push({
        roomId: room.id,
        levelId: room.levelId,
        a: { ...a },
        b: { ...b },
      });
    }
  });
  return edges;
}

function splitRoomEdges(edges: RawRoomEdge[], tolerance: number): AtomicEdge[] {
  const groups = new Map<string, OrientedRoomEdge[]>();

  edges.forEach((edge) => {
    const oriented = orientEdge(edge, tolerance);
    if (!oriented) {
      return;
    }
    const key = buildLineKey(oriented.direction, oriented.offset, edge.levelId, tolerance);
    const bucket = groups.get(key) ?? [];
    bucket.push(oriented);
    groups.set(key, bucket);
  });

  const atomicEdges: AtomicEdge[] = [];
  groups.forEach((group) => {
    const first = group[0];
    const breakpoints = uniqueSortedScalars(
      group.flatMap((edge) => [edge.start, edge.end]),
      tolerance
    );

    for (let index = 1; index < breakpoints.length; index += 1) {
      const start = breakpoints[index - 1];
      const end = breakpoints[index];
      if (end - start <= tolerance) {
        continue;
      }
      const midpoint = (start + end) / 2;
      const rooms = new Set(
        group
          .filter((edge) => midpoint >= edge.start - tolerance && midpoint <= edge.end + tolerance)
          .map((edge) => edge.roomId)
      );
      if (!rooms.size) {
        continue;
      }
      const lineOrigin = scale(first.normal, first.offset);
      atomicEdges.push({
        a: pointOnLine(lineOrigin, first.direction, start),
        b: pointOnLine(lineOrigin, first.direction, end),
        levelId: first.levelId,
        rooms,
      });
    }
  });

  return atomicEdges.filter((edge) => segmentLength(edge.a, edge.b) > tolerance);
}

function orientEdge(edge: RawRoomEdge, tolerance: number): OrientedRoomEdge | null {
  const dx = edge.b.x - edge.a.x;
  const dy = edge.b.y - edge.a.y;
  const length = Math.hypot(dx, dy);
  if (length <= tolerance) {
    return null;
  }

  let direction = { x: dx / length, y: dy / length };
  let startPoint = edge.a;
  let endPoint = edge.b;
  if (direction.x < -tolerance || (Math.abs(direction.x) <= tolerance && direction.y < 0)) {
    direction = { x: -direction.x, y: -direction.y };
    startPoint = edge.b;
    endPoint = edge.a;
  }

  const normal = { x: -direction.y, y: direction.x };
  const start = dot(direction, startPoint);
  const end = dot(direction, endPoint);

  return {
    ...edge,
    a: { ...startPoint },
    b: { ...endPoint },
    direction,
    normal,
    offset: dot(normal, startPoint),
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

function buildLineKey(direction: Vec2, offset: number, levelId: string, tolerance: number): string {
  return `${levelId}:${formatScalar(direction.x, tolerance)}:${formatScalar(direction.y, tolerance)}:${formatScalar(offset, tolerance)}`;
}

function uniqueSortedScalars(values: number[], tolerance: number): number[] {
  const sorted = [...values].sort((left, right) => left - right);
  const unique: number[] = [];
  sorted.forEach((value) => {
    if (!unique.length || Math.abs(unique[unique.length - 1] - value) > tolerance) {
      unique.push(value);
    }
  });
  return unique;
}

function pointOnLine(origin: Vec2, direction: Vec2, distanceAlongLine: number): Vec2 {
  return {
    x: origin.x + direction.x * distanceAlongLine,
    y: origin.y + direction.y * distanceAlongLine,
  };
}

function dot(left: Vec2, right: Vec2): number {
  return left.x * right.x + left.y * right.y;
}

function scale(vector: Vec2, factor: number): Vec2 {
  return {
    x: vector.x * factor,
    y: vector.y * factor,
  };
}

function formatScalar(value: number, tolerance: number): string {
  const factor = 1 / tolerance;
  return `${Math.round(value * factor) / factor}`;
}

function normalizePolygon(room: Room): Vec2[] {
  const polygon = room.polygon ?? [];
  if (!polygon.length) {
    return [];
  }
  const last = polygon[polygon.length - 1];
  const first = polygon[0];
  const closed = Math.abs(last.x - first.x) < 1e-6 && Math.abs(last.y - first.y) < 1e-6;
  return closed ? polygon.slice(0, -1) : polygon;
}

function linkRooms(graph: Map<string, Set<string>>, a: string, b: string) {
  if (!graph.has(a)) {
    graph.set(a, new Set());
  }
  if (!graph.has(b)) {
    graph.set(b, new Set());
  }
  graph.get(a)?.add(b);
  graph.get(b)?.add(a);
}

function estimateDefaultHeight(model: BuildingModel): number {
  const heights = model.levels.map((level) => level.height_m).filter((value) => Number.isFinite(value));
  return heights.length ? heights[0] : 3;
}

function heightForLevel(levelId: string, lookup: Map<string, Level>, fallback: number): number {
  const level = lookup.get(levelId);
  return level?.height_m ?? fallback;
}
