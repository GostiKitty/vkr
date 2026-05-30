import type { BuildingModel, Vec2 } from "../../../entities/geometry/types";

export interface SimplePreviewBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  empty: boolean;
}

export interface SimplePreviewCameraFrame {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  distance: number;
  near: number;
  far: number;
}

const MIN_DIMENSION_M = 5;

function expandBounds(bounds: SimplePreviewBounds, x: number, y: number, z: number) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxZ = Math.max(bounds.maxZ, z);
  bounds.empty = false;
}

function visitPolygon(bounds: SimplePreviewBounds, polygon: Vec2[], elevation: number) {
  polygon.forEach((point) => {
    expandBounds(bounds, point.x, elevation, point.y);
  });
}

export function resolveSimplePreviewLevelId(model: BuildingModel, activeLevelId: string | null): string | null {
  if (!activeLevelId) {
    return null;
  }
  const hasShellOnLevel =
    model.rooms.some((room) => room.levelId === activeLevelId) ||
    model.walls.some((wall) => wall.levelId === activeLevelId) ||
    (model.roofs ?? []).some((roof) => roof.levelId === activeLevelId) ||
    (model.floorSlabs ?? []).some((slab) => slab.levelId === activeLevelId);
  return hasShellOnLevel ? activeLevelId : null;
}

export function buildSimplePreviewBounds(model: BuildingModel, activeLevelId: string | null): SimplePreviewBounds {
  const levelId = resolveSimplePreviewLevelId(model, activeLevelId);
  const levelMap = new Map(model.levels.map((level) => [level.id, level]));
  const bounds: SimplePreviewBounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
    center: { x: 0, y: 0, z: 0 },
    size: { x: 0, y: 0, z: 0 },
    empty: true,
  };

  model.rooms.forEach((room) => {
    if (levelId && room.levelId !== levelId) {
      return;
    }
    const elevation = levelMap.get(room.levelId)?.elevation_m ?? 0;
    visitPolygon(bounds, room.polygon, elevation);
  });

  model.walls.forEach((wall) => {
    if (levelId && wall.levelId !== levelId) {
      return;
    }
    const elevation = levelMap.get(wall.levelId)?.elevation_m ?? 0;
    const halfThickness = Math.max(wall.thickness_m * 0.5, 0.06);
    expandBounds(bounds, wall.a.x - halfThickness, elevation, wall.a.y - halfThickness);
    expandBounds(bounds, wall.a.x + halfThickness, elevation + wall.height_m, wall.a.y + halfThickness);
    expandBounds(bounds, wall.b.x - halfThickness, elevation, wall.b.y - halfThickness);
    expandBounds(bounds, wall.b.x + halfThickness, elevation + wall.height_m, wall.b.y + halfThickness);
  });

  (model.roofs ?? []).forEach((roof) => {
    if (levelId && roof.levelId !== levelId) {
      return;
    }
    visitPolygon(bounds, roof.boundary, roof.elevationBase_m);
    visitPolygon(bounds, roof.boundary, roof.elevationBase_m + Math.max(roof.thickness_m, 0.04));
  });

  (model.floorSlabs ?? []).forEach((slab) => {
    if (levelId && slab.levelId !== levelId) {
      return;
    }
    visitPolygon(bounds, slab.boundary, slab.elevation_m);
    visitPolygon(bounds, slab.boundary, slab.elevation_m + Math.max(slab.thickness_m, 0.04));
  });

  if (bounds.empty) {
    return bounds;
  }

  const rawSize = {
    x: bounds.maxX - bounds.minX,
    y: bounds.maxY - bounds.minY,
    z: bounds.maxZ - bounds.minZ,
  };

  bounds.size = {
    x: Math.max(rawSize.x, MIN_DIMENSION_M),
    y: Math.max(rawSize.y, MIN_DIMENSION_M * 0.6),
    z: Math.max(rawSize.z, MIN_DIMENSION_M),
  };
  bounds.center = {
    x: (bounds.minX + bounds.maxX) * 0.5,
    y: (bounds.minY + bounds.maxY) * 0.5,
    z: (bounds.minZ + bounds.maxZ) * 0.5,
  };
  return bounds;
}

export function calculateSimplePreviewCamera(bounds: SimplePreviewBounds, mode: "iso" | "top" = "iso"): SimplePreviewCameraFrame {
  if (bounds.empty) {
    return {
      position: { x: 12, y: 9, z: 12 },
      target: { x: 0, y: 1, z: 0 },
      distance: 12,
      near: 0.1,
      far: 1000,
    };
  }

  const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, MIN_DIMENSION_M);
  const distance = mode === "top" ? maxDim * 1.45 : maxDim * 1.8;
  const target = { ...bounds.center };
  const position =
    mode === "top"
      ? { x: target.x, y: target.y + distance, z: target.z + 0.01 }
      : { x: target.x + distance, y: target.y + distance * 0.75, z: target.z + distance };

  return {
    position,
    target,
    distance,
    near: Math.max(distance / 100, 0.01),
    far: Math.max(distance * 100, 1000),
  };
}

export function calculateSimplePreviewGrid(bounds: SimplePreviewBounds) {
  const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, MIN_DIMENSION_M);
  return {
    size: maxDim * 2,
    divisions: Math.min(40, Math.max(10, Math.round(maxDim * 2))),
    center: bounds.center,
  };
}
