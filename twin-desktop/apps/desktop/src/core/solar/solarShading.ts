import type { BuildingModel, Wall, Window } from "../../entities/geometry/types";
import { estimateWallOrientation, type Orientation } from "../graph/adjacency";
import { computeSolarPosition, formatSolarHour, type SolarPosition } from "./solarPosition";

export interface SolarTimeInput {
  hour: number;
  dayOfYear: number;
  latitudeDeg: number;
}

export function orientationToAzimuthDeg(orientation: Orientation): number {
  switch (orientation) {
    case "N":
      return 0;
    case "E":
      return 90;
    case "S":
      return 180;
    case "W":
      return 270;
    default:
      return 180;
  }
}

export function wallFacadeAzimuthDeg(wall: Wall): number {
  return orientationToAzimuthDeg(estimateWallOrientation(wall));
}

/**
 * Азимут наружной нормали фасада (0° = север, 90° = восток, 180° = юг), °.
 * `roomCentroid` — центр помещения с внутренней стороны стены.
 */
export function exteriorFacadeAzimuthDeg(wall: Wall, roomCentroid: { x: number; y: number }): number {
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) {
    return orientationToAzimuthDeg(estimateWallOrientation(wall));
  }
  const tangent = { x: dx / length, y: dy / length };
  const normalA = { x: -tangent.y, y: tangent.x };
  const midpoint = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const toRoom = { x: roomCentroid.x - midpoint.x, y: roomCentroid.y - midpoint.y };
  const inward =
    normalA.x * toRoom.x + normalA.y * toRoom.y >= 0 ? normalA : { x: -normalA.x, y: -normalA.y };
  const outward = { x: -inward.x, y: -inward.y };
  // Азимут: 0° север (+y), 90° восток (+x), 180° юг (−y).
  const deg = (Math.atan2(outward.x, outward.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Доля прямого солнечного облучения вертикального фасада [0..1].
 * 0 — солнце сзади фасада или за горизонтом; 1 — максимальный прямой поток.
 */
export function computeFacadeSolarAccessFactor(
  solarPosition: SolarPosition,
  facadeAzimuthDeg: number
): number {
  if (!solarPosition.isAboveHorizon || solarPosition.altitudeDeg <= 0) {
    return 0;
  }
  let azDiff = solarPosition.azimuthDeg - facadeAzimuthDeg;
  while (azDiff > 180) {
    azDiff -= 360;
  }
  while (azDiff < -180) {
    azDiff += 360;
  }
  if (Math.abs(azDiff) >= 90) {
    return 0;
  }
  const altRad = (solarPosition.altitudeDeg * Math.PI) / 180;
  const azDiffRad = (azDiff * Math.PI) / 180;
  return Math.max(0, Math.cos(altRad) * Math.cos(azDiffRad));
}

/**
 * Эффективное затенение с учётом времени суток:
 * при отсутствии прямого солнца на фасаде → 1 (прямой луч не проходит),
 * при максимальном облучении → архитектурное baseShading.
 */
export function combineArchitecturalAndSolarShading(
  baseShading: number,
  solarAccessFactor: number
): number {
  const base = Math.min(1, Math.max(0.01, baseShading));
  const access = Math.min(1, Math.max(0, solarAccessFactor));
  return Math.min(1, Math.max(base, base + (1 - base) * (1 - access)));
}

export function resolveWindowFacadeAzimuthDeg(model: BuildingModel, window: Window): number | null {
  const wallId = window.anchor?.wallId;
  if (!wallId) {
    return null;
  }
  const wall = model.walls.find((entry) => entry.id === wallId);
  if (!wall) {
    return null;
  }
  return wallFacadeAzimuthDeg(wall);
}

export function buildSolarShadingNote(solarTime: SolarTimeInput, solarPosition: SolarPosition): string {
  return `Учтено солнечное время ${formatSolarHour(solarTime.hour)}, высота солнца ${solarPosition.altitudeDeg.toFixed(1)}°.`;
}

export function resolveSolarPositionFromTime(solarTime: SolarTimeInput | null | undefined): SolarPosition | null {
  if (!solarTime) {
    return null;
  }
  return computeSolarPosition({
    latitudeDeg: solarTime.latitudeDeg,
    dayOfYear: solarTime.dayOfYear,
    hourDecimal: solarTime.hour,
  });
}
