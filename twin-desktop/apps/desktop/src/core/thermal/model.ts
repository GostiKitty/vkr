import { polygonArea } from "../../entities/geometry/geom";
import type { BuildingModel, Room, Wall } from "../../entities/geometry/types";
import { DEFAULT_WALL_ASSEMBLY_ID } from "../../entities/material/types";
import { buildAdjacencyGraph, type AdjacencyResult } from "../graph/adjacency";
import { buildGeometryRenderModel } from "../geometry/bimPipeline";
import { airflowFromACH } from "./formulas";
import { computeWallFacadeConductances, computeFallbackFacadeConductance_W_K } from "./wallFacadeThermal";

const AIR_DENSITY_KG_M3 = 1.204; // kg/m3
const AIR_CP_J_KG_K = 1005; // J/(kg·K)
const MIN_AREA_M2 = 0.5;
const MIN_HEIGHT_M = 2.5;

export interface ThermalZone {
  id: string;
  name: string;
  area_m2: number;
  volume_m3: number;
  capacitance_J_K: number;
  infiltrationACH: number;
  infiltrationConductance_W_K: number;
}

export type ThermalLinkKind = "internal" | "external";

export interface ThermalLink {
  id: string;
  fromZoneId: string;
  toZoneId: string;
  conductance_W_K: number;
  area_m2: number;
  kind: ThermalLinkKind;
  wallId?: string;
  /** Для наружных связей: проводимость непрозрачной части, Вт/К (оценка по площади проёмов). */
  conductanceOpaque_W_K?: number;
  conductanceWindow_W_K?: number;
  conductanceDoor_W_K?: number;
}

export interface ThermalModel {
  zones: ThermalZone[];
  internalLinks: ThermalLink[];
  outdoorLinks: ThermalLink[];
}

export interface ThermalModelOptions {
  adjacency?: AdjacencyResult;
  infiltrationACH?: number;
  defaultHeight_m?: number;
  defaultAssemblyId?: string;
  effectiveMassFactor?: number;
}

export interface ThermalModelBuildResult {
  model: ThermalModel;
  adjacency: AdjacencyResult;
  /** Предупреждения построения (например, запасной наружный контур без фасадных стен). */
  warnings: string[];
}

export function buildThermalModel(
  building: BuildingModel,
  options: ThermalModelOptions = {}
): ThermalModelBuildResult {
  if (!building.rooms.length) {
    throw new Error("Добавьте хотя бы одно помещение для построения тепловой модели.");
  }
  const adjacency = options.adjacency ?? buildAdjacencyGraph(building);
  const infiltrationACH = options.infiltrationACH ?? 0.5;
  const defaultHeight = options.defaultHeight_m ?? MIN_HEIGHT_M;
  const defaultAssembly = options.defaultAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID;
  const effectiveMassFactor = Math.max(1, options.effectiveMassFactor ?? 1);

  const warnings: string[] = [];
  const renderGeometry = buildGeometryRenderModel(building);
  const openingsByWallId = new Map<string, { type: string; widthM: number; heightM: number }[]>();
  renderGeometry.walls.forEach(({ wall, openings }) => {
    openingsByWallId.set(wall.id, openings);
  });

  const zones = building.rooms.map((room) => buildZone(room, building, infiltrationACH, defaultHeight, effectiveMassFactor));
  const wallMap = new Map<string, Wall>(building.walls.map((wall) => [wall.id, wall]));

  const internalLinks: ThermalLink[] = adjacency.graph.edges.map((edge, index) => {
    const wall = wallMap.get(edge.wallId);
    const openings = openingsByWallId.get(edge.wallId) ?? [];
    const conductance = resolveConductanceForWall(wall, openings, edge.area_m2, defaultAssembly, warnings);
    return {
      id: `internal_${edge.wallId}_${index}`,
      fromZoneId: edge.roomA,
      toZoneId: edge.roomB,
      conductance_W_K: conductance.total_W_K,
      area_m2: edge.area_m2,
      kind: "internal",
      wallId: edge.wallId,
    };
  });

  const outdoorLinks: ThermalLink[] = adjacency.graph.outdoorEdges.map((edge, index) => {
    const wall = wallMap.get(edge.wallId);
    const openings = openingsByWallId.get(edge.wallId) ?? [];
    const conductance = resolveConductanceForWall(wall, openings, edge.area_m2, defaultAssembly, warnings);
    return {
      id: `outdoor_${edge.wallId}_${index}`,
      fromZoneId: edge.roomId,
      toZoneId: "outdoor",
      conductance_W_K: conductance.total_W_K,
      conductanceOpaque_W_K: conductance.opaque_W_K,
      conductanceWindow_W_K: conductance.window_W_K,
      conductanceDoor_W_K: conductance.door_W_K,
      area_m2: edge.area_m2,
      kind: "external",
      wallId: edge.wallId,
    };
  });

  zones.forEach((zone) => {
    if (!outdoorLinks.some((link) => link.fromZoneId === zone.id)) {
      warnings.push(
        `Зона «${zone.name}» (${zone.id}): в графе смежности нет наружных стен — добавлен запасной наружный контур по периметру площади. Проверьте стены и привязку к уровню.`
      );
      const perimeter = 4 * Math.sqrt(zone.area_m2);
      const area = perimeter * Math.max(defaultHeight, MIN_HEIGHT_M);
      const fb = computeFallbackFacadeConductance_W_K(area, defaultAssembly);
      outdoorLinks.push({
        id: `outdoor_fallback_${zone.id}`,
        fromZoneId: zone.id,
        toZoneId: "outdoor",
        conductance_W_K: fb,
        conductanceOpaque_W_K: fb,
        conductanceWindow_W_K: 0,
        conductanceDoor_W_K: 0,
        area_m2: area,
        kind: "external",
      });
    }
  });

  return {
    model: {
      zones,
      internalLinks,
      outdoorLinks,
    },
    adjacency,
    warnings,
  };
}

function buildZone(
  room: Room,
  building: BuildingModel,
  infiltrationACH: number,
  defaultHeight: number,
  effectiveMassFactor: number
): ThermalZone {
  const level = building.levels.find((lvl) => lvl.id === room.levelId);
  const height = Math.max(level?.height_m ?? defaultHeight, MIN_HEIGHT_M);
  const area = Math.max(MIN_AREA_M2, Math.abs(polygonArea(room.polygon)));
  const volume = area * height;
  const capacitance = AIR_DENSITY_KG_M3 * volume * AIR_CP_J_KG_K * Math.max(1, effectiveMassFactor);
  const infiltrationConductance = AIR_DENSITY_KG_M3 * AIR_CP_J_KG_K * airflowFromACH(infiltrationACH, volume);
  return {
    id: room.id,
    name: room.name,
    area_m2: area,
    volume_m3: volume,
    capacitance_J_K: capacitance,
    infiltrationACH,
    infiltrationConductance_W_K: infiltrationConductance,
  };
}

function resolveConductanceForWall(
  wall: Wall | undefined,
  openings: { type: string; widthM: number; heightM: number }[],
  area_m2_from_graph: number,
  fallbackAssemblyId: string,
  warnings: string[]
): { total_W_K: number; opaque_W_K: number; window_W_K: number; door_W_K: number } {
  if (!Number.isFinite(area_m2_from_graph) || area_m2_from_graph <= 0) {
    return { total_W_K: 0, opaque_W_K: 0, window_W_K: 0, door_W_K: 0 };
  }
  if (!wall) {
    const g = computeFallbackFacadeConductance_W_K(area_m2_from_graph, fallbackAssemblyId);
    return { total_W_K: g, opaque_W_K: g, window_W_K: 0, door_W_K: 0 };
  }
  const facade = computeWallFacadeConductances(wall, openings, wall.wallAssemblyId ?? fallbackAssemblyId, 1);
  warnings.push(...facade.warnings);
  /** Граф смежности задаёт площадь как L·H; при расхождении с конвейером геометрии масштабируем G. */
  const scale = area_m2_from_graph / Math.max(1e-6, facade.wallAreaM2);
  if (!Number.isFinite(scale) || scale <= 0) {
    return { total_W_K: 0, opaque_W_K: 0, window_W_K: 0, door_W_K: 0 };
  }
  return {
    total_W_K: facade.conductanceTotal_W_K * scale,
    opaque_W_K: facade.conductanceOpaque_W_K * scale,
    window_W_K: facade.conductanceWindow_W_K * scale,
    door_W_K: facade.conductanceDoor_W_K * scale,
  };
}
