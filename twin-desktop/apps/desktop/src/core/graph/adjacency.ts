import { angleBetween, midpoint, polygonCentroid, polygonContainsPoint, segmentLength } from "../../entities/geometry/geom";
import type { BuildingModel, Room, Vec2, Wall } from "../../entities/geometry/types";

export type Orientation = "N" | "E" | "S" | "W";

export interface ThermalGraph {
  nodes: Array<{ roomId: string }>;
  edges: Array<{ wallId: string; roomA: string; roomB: string; area_m2: number }>;
  outdoorEdges: Array<{ wallId: string; roomId: string; orientation: Orientation; area_m2: number }>;
}

export interface RoomNeighborEdge {
  wallId: string;
  roomA: string;
  roomB: string;
  length_m: number;
}

export interface ExternalWallEdge {
  wallId: string;
  roomId: string;
  orientation: Orientation;
  length_m: number;
  area_m2: number;
}

export interface AdjacencyResult {
  graph: ThermalGraph;
  neighbors: Record<string, string[]>;
  edges: RoomNeighborEdge[];
  external: ExternalWallEdge[];
  centroids: Record<string, Vec2>;
}

export function buildAdjacencyGraph(model: BuildingModel): AdjacencyResult {
  const neighbors: Record<string, Set<string>> = {};
  const edges: RoomNeighborEdge[] = [];
  const external: ExternalWallEdge[] = [];
  const centroids: Record<string, Vec2> = {};

  model.rooms.forEach((room) => {
    centroids[room.id] = polygonCentroid(room.polygon);
    neighbors[room.id] = new Set();
  });

  const graph: ThermalGraph = {
    nodes: model.rooms.map((room) => ({ roomId: room.id })),
    edges: [],
    outdoorEdges: [],
  };

  for (const wall of model.walls) {
    const assignment = detectRoomsForWall(wall, model.rooms);
    const length = segmentLength(wall.a, wall.b);
    const area = length * wall.height_m;
    if (assignment.length === 2) {
      const [roomA, roomB] = assignment;
      neighbors[roomA]?.add(roomB);
      neighbors[roomB]?.add(roomA);
      const edge: RoomNeighborEdge = { wallId: wall.id, roomA, roomB, length_m: length };
      edges.push(edge);
      graph.edges.push({ wallId: wall.id, roomA, roomB, area_m2: area });
    } else if (assignment.length === 1) {
      const roomId = assignment[0];
      const orientation = estimateWallOrientation(wall);
      const extEdge: ExternalWallEdge = {
        wallId: wall.id,
        roomId,
        orientation,
        length_m: length,
        area_m2: area,
      };
      external.push(extEdge);
      graph.outdoorEdges.push({ wallId: wall.id, roomId, orientation, area_m2: area });
    }
  }

  return {
    graph,
    neighbors: Object.fromEntries(Object.entries(neighbors).map(([roomId, set]) => [roomId, Array.from(set)])),
    edges,
    external,
    centroids,
  };
}

function detectRoomsForWall(wall: Wall, rooms: Room[]): string[] {
  const midpointWall = midpoint(wall.a, wall.b);
  const length = segmentLength(wall.a, wall.b);
  if (length === 0) {
    return [];
  }
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const normal = normalize({ x: -dy, y: dx });
  const sampleDistance = Math.max(wall.thickness_m || 0.2, 0.2);
  const samples: Array<{ point: Vec2; side: number }> = [
    { point: { x: midpointWall.x + normal.x * sampleDistance, y: midpointWall.y + normal.y * sampleDistance }, side: 1 },
    { point: { x: midpointWall.x - normal.x * sampleDistance, y: midpointWall.y - normal.y * sampleDistance }, side: -1 },
  ];
  const found: string[] = [];
  samples.forEach((sample) => {
    const room = rooms.find((candidate) => candidate.levelId === wall.levelId && polygonContainsPoint(sample.point, candidate.polygon));
    if (room && !found.includes(room.id)) {
      found.push(room.id);
    }
  });
  return found;
}

const normalize = (vec: Vec2): Vec2 => {
  const length = Math.hypot(vec.x, vec.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: vec.x / length, y: vec.y / length };
};

export function estimateWallOrientation(wall: Wall): Orientation {
  const angle = angleBetween(wall.a, wall.b);
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  if (deg >= 315 || deg < 45) {
    return "E";
  }
  if (deg >= 45 && deg < 135) {
    return "N";
  }
  if (deg >= 135 && deg < 225) {
    return "W";
  }
  return "S";
};
