import type { BuildingModel, Room, RoomSource, Vec2 } from "../../entities/geometry/types";
import { createId } from "../../shared/utils/id";
import { polygonArea, validateRoomPolygon } from "../../entities/geometry/geom";

export interface RoomProblem {
  levelId: string;
  message: string;
  loopId?: string;
}

export interface RoomLoopCandidate {
  id: string;
  levelId: string;
  polygon: Vec2[];
  area: number;
  valid: boolean;
  reason?: string;
  roomId?: string;
  roomSource?: RoomSource;
}

interface Node {
  point: Vec2;
}

interface DirectedEdge {
  id: string;
  from: number;
  to: number;
  wallId: string;
  angle: number;
  twin?: DirectedEdge;
  visited: boolean;
}

interface Graph {
  nodes: Node[];
  outgoing: DirectedEdge[][];
  edges: DirectedEdge[];
}

const MERGE_TOLERANCE = 0.2;
const MIN_ROOM_AREA = 1;
const SIGNATURE_PRECISION = 3;

const clonePolygon = (polygon: Vec2[]): Vec2[] => polygon.map((point) => ({ ...point }));

function pointToken(point: Vec2): string {
  return `${point.x.toFixed(SIGNATURE_PRECISION)}:${point.y.toFixed(SIGNATURE_PRECISION)}`;
}

function rotateTokens(tokens: string[], startIndex: number): string[] {
  return tokens.slice(startIndex).concat(tokens.slice(0, startIndex));
}

function signature(polygon: Vec2[]): string {
  const tokens = polygon.map(pointToken);
  if (!tokens.length) {
    return "";
  }
  const candidates: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    candidates.push(rotateTokens(tokens, index).join("|"));
  }
  const reversed = [...tokens].reverse();
  for (let index = 0; index < reversed.length; index += 1) {
    candidates.push(rotateTokens(reversed, index).join("|"));
  }
  candidates.sort();
  return candidates[0] ?? "";
}

export function detectRoomsFromWalls(
  model: BuildingModel
): { rooms: Room[]; problems: RoomProblem[]; loops: RoomLoopCandidate[] } {
  const autoRooms: Room[] = [];
  const problems: RoomProblem[] = [];
  const loops: RoomLoopCandidate[] = [];

  const manualRoomMap = new Map<string, { id: string; levelId: string }>();
  model.rooms.forEach((room) => {
    const normalized = validateRoomPolygon(room.polygon).normalized ?? room.polygon;
    manualRoomMap.set(signature(normalized), { id: room.id, levelId: room.levelId });
  });

  model.levels.forEach((level) => {
    const levelWalls = model.walls.filter((wall) => wall.levelId === level.id);
    if (!levelWalls.length) {
      return;
    }
    const graph = buildGraph(levelWalls);
    const faces = extractFaces(graph, level.id, problems);
    let counter = 1;
    faces.forEach((nodeIndices) => {
      const loopId = createId("loop");
      const rawPolygon = nodeIndices.map((index) => graph.nodes[index].point);
      const polygon = normalizePolygon(rawPolygon);
      const signedArea = polygonArea(polygon);
      if (signedArea <= 0) {
        loops.push({
          id: loopId,
          levelId: level.id,
          polygon: clonePolygon(polygon),
          area: 0,
          valid: false,
          reason: "Контур ориентирован неверно или вырожден",
        });
        return;
      }
      const area = Math.abs(signedArea);
      if (area < MIN_ROOM_AREA) {
        problems.push({
          levelId: level.id,
          message: `Петля отброшена: площадь ${area.toFixed(2)} м² слишком мала`,
          loopId,
        });
        loops.push({
          id: loopId,
          levelId: level.id,
          polygon: clonePolygon(polygon),
          area,
          valid: false,
          reason: "Слишком маленькая площадь",
        });
        return;
      }
      const validation = validateRoomPolygon(polygon);
      const normalized = validation.normalized ?? polygon;
      if (!validation.valid) {
        problems.push({
          levelId: level.id,
          message: validation.reason ?? "Петля отброшена: некорректный полигон",
          loopId,
        });
        loops.push({
          id: loopId,
          levelId: level.id,
          polygon: clonePolygon(normalized),
          area,
          valid: false,
          reason: validation.reason ?? "Некорректный полигон",
        });
        return;
      }

      const loopSignature = signature(normalized);
      const manualMatch = manualRoomMap.get(loopSignature);
      if (manualMatch && manualMatch.levelId === level.id) {
        loops.push({
          id: loopId,
          levelId: level.id,
          polygon: clonePolygon(normalized),
          area,
          valid: true,
          roomId: manualMatch.id,
          roomSource: "manual",
        });
        return;
      }

      const roomId = createId("auto-room");
      loops.push({
        id: loopId,
        levelId: level.id,
        polygon: clonePolygon(normalized),
        area,
        valid: true,
        roomId,
        roomSource: "auto",
      });
      autoRooms.push({
        id: roomId,
        name: `Space ${counter++}`,
        levelId: level.id,
        polygon: normalized,
        source: "auto",
      });
    });
  });

  return { rooms: autoRooms, problems, loops };
}

function buildGraph(walls: BuildingModel["walls"]): Graph {
  const nodes: Node[] = [];
  const outgoing: DirectedEdge[][] = [];
  const edges: DirectedEdge[] = [];

  const findOrAddNode = (point: Vec2): number => {
    const existingIndex = nodes.findIndex((node) => distance(node.point, point) <= MERGE_TOLERANCE);
    if (existingIndex !== -1) {
      return existingIndex;
    }
    nodes.push({ point });
    outgoing.push([]);
    return nodes.length - 1;
  };

  walls.forEach((wall) => {
    const fromIndex = findOrAddNode(wall.a);
    const toIndex = findOrAddNode(wall.b);
    if (fromIndex === toIndex) {
      return;
    }
    const forward: DirectedEdge = {
      id: createId("edge"),
      from: fromIndex,
      to: toIndex,
      wallId: wall.id,
      angle: Math.atan2(nodes[toIndex].point.y - nodes[fromIndex].point.y, nodes[toIndex].point.x - nodes[fromIndex].point.x),
      visited: false,
    };
    const backward: DirectedEdge = {
      id: createId("edge"),
      from: toIndex,
      to: fromIndex,
      wallId: wall.id,
      angle: Math.atan2(nodes[fromIndex].point.y - nodes[toIndex].point.y, nodes[fromIndex].point.x - nodes[toIndex].point.x),
      visited: false,
    };
    forward.twin = backward;
    backward.twin = forward;
    edges.push(forward, backward);
    outgoing[fromIndex].push(forward);
    outgoing[toIndex].push(backward);
  });

  outgoing.forEach((list) => list.sort((a, b) => a.angle - b.angle));

  return { nodes, outgoing, edges };
}

function extractFaces(graph: Graph, levelId: string, problems: RoomProblem[]): number[][] {
  const faces: number[][] = [];

  graph.edges.forEach((edge) => {
    if (edge.visited) {
      return;
    }
    const loop: number[] = [];
    let current: DirectedEdge | undefined = edge;
    const startId = edge.id;
    let guard = 0;
    let valid = true;

    while (current && guard < 1000) {
      guard += 1;
      current.visited = true;
      loop.push(current.from);
      const next = nextEdge(graph, current);
      if (!next) {
        valid = false;
        problems.push({
          levelId,
          message: "Петля не замкнута — есть разрыв в стенах",
        });
        break;
      }
      current = next;
      if (current.id === startId) {
        break;
      }
    }
    if (!valid || loop.length < 3 || guard >= 1000) {
      return;
    }
    faces.push(loop);
  });

  return faces;
}

function nextEdge(graph: Graph, edge: DirectedEdge): DirectedEdge | undefined {
  const outgoing = graph.outgoing[edge.to];
  if (!outgoing.length || !edge.twin) {
    return undefined;
  }
  const reverseIndex = outgoing.findIndex((candidate) => candidate.to === edge.from && candidate.wallId === edge.wallId);
  if (reverseIndex === -1) {
    return undefined;
  }
  const nextIndex = (reverseIndex - 1 + outgoing.length) % outgoing.length;
  return outgoing[nextIndex];
}

function normalizePolygon(points: Vec2[]): Vec2[] {
  const cleaned: Vec2[] = [];
  points.forEach((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length];
    if (distance(point, prev) > 1e-3) {
      cleaned.push(point);
    }
  });
  return cleaned;
}

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
