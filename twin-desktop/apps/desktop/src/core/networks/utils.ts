import type { DuctNetwork, PlanPoint, PipeNetwork } from "../../entities/networks/types";

export function polylineLength(path: PlanPoint[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1];
    const b = path[index];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

export function polylineMidpoint(path: PlanPoint[]): PlanPoint {
  if (!path.length) {
    return { x: 0, y: 0 };
  }
  const target = polylineLength(path) / 2;
  let traversed = 0;
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1];
    const b = path[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (traversed + length >= target && length > 0) {
      const local = (target - traversed) / length;
      return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local,
      };
    }
    traversed += length;
  }
  return path[path.length - 1];
}

export function isValidPolyline(path: PlanPoint[]): boolean {
  return path.length >= 2 && polylineLength(path) > 0.05;
}

export function clonePipe(pipe: PipeNetwork): PipeNetwork {
  return { ...pipe, path: pipe.path.map((point) => ({ ...point })), connectedEquipmentIds: [...pipe.connectedEquipmentIds] };
}

export function cloneDuct(duct: DuctNetwork): DuctNetwork {
  return {
    ...duct,
    path: duct.path.map((point) => ({ ...point })),
    section: { ...duct.section },
    connectedEquipmentIds: [...duct.connectedEquipmentIds],
  };
}
