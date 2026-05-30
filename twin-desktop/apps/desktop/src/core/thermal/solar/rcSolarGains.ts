import { polygonContainsPoint } from "../../../entities/geometry/geom";
import type { BuildingModel, Vec2, Wall } from "../../../entities/geometry/types";
import { getEnvelopePreset } from "../../../entities/envelope/envelopePresets";
import { buildGeometryRenderModel, type RoomVolumeDescriptor } from "../../geometry/bimPipeline";
import type { ThermalLink } from "../model";
import { polygonCentroid } from "../../../entities/geometry/geom";
import {
  combineArchitecturalAndSolarShading,
  computeFacadeSolarAccessFactor,
  exteriorFacadeAzimuthDeg,
} from "../../solar/solarShading";
import { computeSolarPosition } from "../../solar/solarPosition";
import { openingAreaM2, resolveModelWindowGValue, TYPICAL_PVC_WINDOW_G_VALUE, TYPICAL_WINDOW_SHADING_FACTOR } from "../../../shared/utils/openingThermalData";

/** Параметры солнечного канала в динамическом RC. */
export interface RcSolarSimulationConfig {
  enabled?: boolean;
  latitudeDeg?: number;
  /** День года [1..365] для положения солнца на протяжении суток. */
  dayOfYear?: number;
  /** Прямая облучённость вертикальной поверхности при полном солнце, Вт/м². */
  irradianceW_m2?: number;
  /**
   * Диффузная облучённость горизонтальной поверхности, Вт/м².
   * На вертикальный фасад попадает половина (коэффициент видимости неба 0,5).
   * Учитывает притоки при пасмурном небе и в северных помещениях.
   * По умолчанию 60 Вт/м² — типичное значение для зимнего дня в центральной России.
   */
  diffuseHorizIrradianceW_m2?: number;
}

export const DEFAULT_RC_SOLAR_CONFIG: Required<Pick<RcSolarSimulationConfig, "latitudeDeg" | "dayOfYear" | "irradianceW_m2" | "diffuseHorizIrradianceW_m2">> & {
  enabled: boolean;
} = {
  enabled: true,
  latitudeDeg: 55.75,
  dayOfYear: 15,
  irradianceW_m2: 220,
  diffuseHorizIrradianceW_m2: 60,
};

interface RcSolarGlazedSurface {
  glazedAreaM2: number;
  facadeAzimuthDeg: number;
  gValue: number;
  baseShading: number;
}

export type RcZoneSolarModel = Map<string, RcSolarGlazedSurface[]>;

function finitePositive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveWindowGValue(building: BuildingModel, fallbackG: number): number {
  return resolveModelWindowGValue(building) ?? fallbackG;
}

function resolveWindowBaseShading(
  building: BuildingModel,
  window: BuildingModel["windows"][number]
): number {
  const preset = getEnvelopePreset(window.envelopePresetId);
  if (preset?.kind === "window" && typeof preset.shadingFactor === "number" && preset.shadingFactor > 0) {
    return Math.min(1, preset.shadingFactor);
  }
  return resolveGlobalBaseShading(building);
}

function resolveGlobalBaseShading(building: BuildingModel): number {
  const meta = building.meta?.shadingFactor;
  if (typeof meta === "number" && Number.isFinite(meta) && meta > 0) {
    return Math.min(1, meta);
  }
  return TYPICAL_WINDOW_SHADING_FACTOR;
}

function resolveRoomAtPoint(rooms: RoomVolumeDescriptor[], levelId: string, point: Vec2): RoomVolumeDescriptor | null {
  return rooms.find((room) => room.levelId === levelId && polygonContainsPoint(point, room.polygon)) ?? null;
}

/** Помещение с наружной стороны стены (если стена — фасад, не перегородка). */
function resolveExteriorRoomForWall(building: BuildingModel, wall: Wall): string | null {
  const renderGeometry = buildGeometryRenderModel(building);
  const direction = normalizeVec({
    x: wall.b.x - wall.a.x,
    y: wall.b.y - wall.a.y,
  });
  const normal = { x: -direction.y, y: direction.x };
  const midpoint = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const probe = Math.max(0.24, wall.thickness_m * 0.8);
  const positiveRoom = resolveRoomAtPoint(renderGeometry.roomVolumes, wall.levelId, {
    x: midpoint.x + normal.x * probe,
    y: midpoint.y + normal.y * probe,
  });
  const negativeRoom = resolveRoomAtPoint(renderGeometry.roomVolumes, wall.levelId, {
    x: midpoint.x - normal.x * probe,
    y: midpoint.y - normal.y * probe,
  });
  if (positiveRoom && negativeRoom) {
    return null;
  }
  return positiveRoom?.roomId ?? negativeRoom?.roomId ?? null;
}

function normalizeVec(vec: Vec2): Vec2 {
  const length = Math.hypot(vec.x, vec.y);
  if (length <= 1e-9) {
    return { x: 1, y: 0 };
  }
  return { x: vec.x / length, y: vec.y / length };
}

function zoneIdForWall(
  building: BuildingModel,
  wall: Wall,
  outdoorLinks: ThermalLink[]
): string | null {
  const fromLink = outdoorLinks.find((link) => link.wallId === wall.id);
  if (fromLink) {
    return fromLink.fromZoneId;
  }
  return resolveExteriorRoomForWall(building, wall);
}

/**
 * Собирает остеклённые фасады по зонам RC: окна на наружных стенах модели.
 */
export function buildRcZoneSolarModel(
  building: BuildingModel,
  outdoorLinks: ThermalLink[],
  config: RcSolarSimulationConfig = {}
): RcZoneSolarModel {
  const zoneMap: RcZoneSolarModel = new Map();
  if (config.enabled === false) {
    return zoneMap;
  }

  const defaultG = resolveWindowGValue(building, TYPICAL_PVC_WINDOW_G_VALUE);
  const globalShading = resolveGlobalBaseShading(building);
  const wallById = new Map(building.walls.map((wall) => [wall.id, wall]));
  const roomCentroidById = new Map(
    building.rooms.map((room) => [room.id, polygonCentroid(room.polygon)])
  );

  for (const window of building.windows) {
    const wallId = window.anchor?.wallId;
    if (!wallId) {
      continue;
    }
    const wall = wallById.get(wallId);
    if (!wall) {
      continue;
    }
    const zoneId = zoneIdForWall(building, wall, outdoorLinks);
    if (!zoneId) {
      continue;
    }
    const glazedAreaM2 = openingAreaM2(window);
    if (glazedAreaM2 <= 0) {
      continue;
    }

    const preset = getEnvelopePreset(window.envelopePresetId);
    const gValue = typeof preset?.gValue === "number" && preset.gValue > 0 ? preset.gValue : defaultG;
    const presetShading = resolveWindowBaseShading(building, window);
    const roomCentroid = roomCentroidById.get(zoneId);
    const surface: RcSolarGlazedSurface = {
      glazedAreaM2,
      facadeAzimuthDeg: roomCentroid
        ? exteriorFacadeAzimuthDeg(wall, roomCentroid)
        : exteriorFacadeAzimuthDeg(wall, { x: 0, y: 0 }),
      gValue,
      baseShading: Math.min(1, Math.max(0.01, presetShading > 0 ? presetShading : globalShading)),
    };

    const existing = zoneMap.get(zoneId) ?? [];
    existing.push(surface);
    zoneMap.set(zoneId, existing);
  }

  return zoneMap;
}

function resolveRcSolarConfig(config: RcSolarSimulationConfig): Required<
  Pick<RcSolarSimulationConfig, "latitudeDeg" | "dayOfYear" | "irradianceW_m2" | "diffuseHorizIrradianceW_m2">
> {
  return {
    latitudeDeg: config.latitudeDeg ?? DEFAULT_RC_SOLAR_CONFIG.latitudeDeg,
    dayOfYear: config.dayOfYear ?? DEFAULT_RC_SOLAR_CONFIG.dayOfYear,
    irradianceW_m2: finitePositive(config.irradianceW_m2, DEFAULT_RC_SOLAR_CONFIG.irradianceW_m2),
    diffuseHorizIrradianceW_m2: finitePositive(
      config.diffuseHorizIrradianceW_m2,
      DEFAULT_RC_SOLAR_CONFIG.diffuseHorizIrradianceW_m2
    ),
  };
}

/**
 * Мгновенный солнечный приток в зону, Вт.
 * Учитываются два канала:
 *  - Прямая (бимовая) составляющая: зависит от положения солнца и ориентации фасада.
 *  - Диффузная составляющая от небосвода: изотропная модель, коэффициент видимости
 *    вертикального фасада = 0,5 ((1+cos90°)/2).
 */
export function computeZoneSolarGainW(
  surfaces: RcSolarGlazedSurface[] | undefined,
  timeSeconds: number,
  config: RcSolarSimulationConfig
): number {
  if (!surfaces?.length || config.enabled === false) {
    return 0;
  }

  const resolved = resolveRcSolarConfig(config);
  const hourDecimal = ((timeSeconds / 3600) % 24 + 24) % 24;
  const solarPosition = computeSolarPosition({
    latitudeDeg: resolved.latitudeDeg,
    dayOfYear: resolved.dayOfYear,
    hourDecimal,
  });

  // Диффузная облучённость вертикального фасада: I_diff_horiz × 0,5
  const diffuseVerticalW_m2 = resolved.diffuseHorizIrradianceW_m2 * 0.5;

  let gainW = 0;
  for (const surface of surfaces) {
    // Прямая составляющая
    const access = computeFacadeSolarAccessFactor(solarPosition, surface.facadeAzimuthDeg);
    if (access > 0) {
      const effectiveShading = combineArchitecturalAndSolarShading(surface.baseShading, access);
      const transmission = Math.max(0, 1 - effectiveShading);
      gainW += surface.glazedAreaM2 * resolved.irradianceW_m2 * surface.gValue * access * transmission;
    }

    // Диффузная составляющая от небосвода — только при солнце над горизонтом.
    // Ночью диффузная составляющая равна нулю.
    if (solarPosition.isAboveHorizon) {
      gainW += surface.glazedAreaM2 * diffuseVerticalW_m2 * surface.gValue * (1 - surface.baseShading);
    }
  }

  return Math.max(0, gainW);
}
