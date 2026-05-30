import type { BuildingModel } from "../../../entities/geometry/types";
import type { AdjacencyResult, Orientation } from "../../../core/graph/adjacency";

export interface RoomEnvelopeMetrics {
  roomId: string;
  wallArea: number;
  windowArea: number;
  doorArea: number;
  wwr: number;
}

export interface EnvelopeMetrics {
  totalWallArea: number;
  totalWindowArea: number;
  totalDoorArea: number;
  wwr: number;
  orientation: Record<Orientation, { wallArea: number; windowArea: number }>;
  rooms: RoomEnvelopeMetrics[];
  warnings: string[];
}

export function computeEnvelopeMetrics(
  model: BuildingModel,
  adjacency: AdjacencyResult
): EnvelopeMetrics {
  const orientationBuckets: Record<Orientation, { wallArea: number; windowArea: number }> = {
    N: { wallArea: 0, windowArea: 0 },
    E: { wallArea: 0, windowArea: 0 },
    S: { wallArea: 0, windowArea: 0 },
    W: { wallArea: 0, windowArea: 0 },
  };

  const windowAreaByWall = new Map<string, number>();
  const doorAreaByWall = new Map<string, number>();

  model.windows.forEach((window) => {
    if (!window.anchor.wallId) {
      return;
    }
    windowAreaByWall.set(
      window.anchor.wallId,
      (windowAreaByWall.get(window.anchor.wallId) ?? 0) + window.width_m * window.height_m
    );
  });

  model.doors.forEach((door) => {
    if (!door.anchor.wallId) {
      return;
    }
    doorAreaByWall.set(
      door.anchor.wallId,
      (doorAreaByWall.get(door.anchor.wallId) ?? 0) + door.width_m * door.height_m
    );
  });

  const roomMetrics: Record<string, RoomEnvelopeMetrics> = {};
  model.rooms.forEach((room) => {
    roomMetrics[room.id] = {
      roomId: room.id,
      wallArea: 0,
      windowArea: 0,
      doorArea: 0,
      wwr: 0,
    };
  });

  adjacency.external.forEach((edge) => {
    const windows = windowAreaByWall.get(edge.wallId) ?? 0;
    const doors = doorAreaByWall.get(edge.wallId) ?? 0;
    orientationBuckets[edge.orientation].wallArea += edge.area_m2;
    orientationBuckets[edge.orientation].windowArea += windows;
    const metrics = roomMetrics[edge.roomId];
    if (metrics) {
      metrics.wallArea += edge.area_m2;
      metrics.windowArea += windows;
      metrics.doorArea += doors;
      metrics.wwr = metrics.wallArea > 0 ? metrics.windowArea / metrics.wallArea : 0;
    }
  });

  const totalWallArea = Object.values(roomMetrics).reduce((sum, room) => sum + room.wallArea, 0);
  const totalWindowArea = Object.values(roomMetrics).reduce((sum, room) => sum + room.windowArea, 0);
  const totalDoorArea = Object.values(roomMetrics).reduce((sum, room) => sum + room.doorArea, 0);
  const wwr = totalWallArea > 0 ? totalWindowArea / totalWallArea : 0;

  const warnings: string[] = [];
  if (wwr > 0.6) {
    warnings.push("Остекление выше 60%: проверьте теплопотери, перегрев и солнцезащиту.");
  } else if (wwr < 0.1 && totalWallArea > 0) {
    warnings.push("Остекление ниже 10%: проверьте, не пропущены ли окна. Это ориентир предварительной проверки, а не требование ГОСТ.");
  }

  return {
    totalWallArea,
    totalWindowArea,
    totalDoorArea,
    wwr,
    orientation: orientationBuckets,
    rooms: Object.values(roomMetrics),
    warnings,
  };
}
