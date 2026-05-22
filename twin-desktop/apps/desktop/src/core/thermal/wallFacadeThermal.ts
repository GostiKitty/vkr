import { segmentLength } from "../../entities/geometry/geom";
import type { Wall } from "../../entities/geometry/types";
import { computeWallProperties, DEFAULT_WALL_ASSEMBLY_ID } from "../../entities/material/types";
import { getTypicalDoorU_W_m2K, getTypicalWindowU_W_m2K } from "../../norms/sp50_2024/typicalOpeningU";

/** Типовое U окон по СП 50 (без паспорта изделия), Вт/(м²·К). */
export const DEFAULT_WINDOW_U_W_M2K = getTypicalWindowU_W_m2K();
/** Типовое U дверей по СП 50, Вт/(м²·К). */
export const DEFAULT_DOOR_U_W_M2K = getTypicalDoorU_W_m2K();
export const DEFAULT_WALL_U_FALLBACK_W_M2K = 1.4;

export interface OpeningDescriptorLike {
  type: "window" | "door" | string;
  widthM: number;
  heightM: number;
}

export function computeWallOpeningAreasM2(openings: OpeningDescriptorLike[]): {
  windowAreaM2: number;
  doorAreaM2: number;
} {
  let windowAreaM2 = 0;
  let doorAreaM2 = 0;
  for (const o of openings) {
    const a = Math.max(0, o.widthM) * Math.max(0, o.heightM);
    if (!Number.isFinite(a)) {
      continue;
    }
    if (o.type === "window") {
      windowAreaM2 += a;
    } else if (o.type === "door") {
      doorAreaM2 += a;
    }
  }
  return { windowAreaM2, doorAreaM2 };
}

export interface WallFacadeConductances {
  wallAreaM2: number;
  opaqueAreaM2: number;
  windowAreaM2: number;
  doorAreaM2: number;
  weightedU_W_m2K: number;
  conductanceTotal_W_K: number;
  conductanceOpaque_W_K: number;
  conductanceWindow_W_K: number;
  conductanceDoor_W_K: number;
  warnings: string[];
  /** U_total = 1/R_total непрозрачной части (слои + R_si + R_se по СП 50). */
  opaqueUTotal_W_m2K: number;
}

function finitePositive(x: number, fallback: number): number {
  if (!Number.isFinite(x) || x <= 0) {
    return fallback;
  }
  return x;
}

/**
 * Проводимости участка стены с учётом непрозрачной части (U_total материала) и типовых U окон/дверей.
 * `conductanceMultiplier` — внешние коэффициенты (мостики, ветер) для стационарной физики; в RC-модели обычно 1.
 */
export function computeWallFacadeConductances(
  wall: Wall | undefined,
  openings: OpeningDescriptorLike[],
  fallbackAssemblyId: string,
  conductanceMultiplier: number
): WallFacadeConductances {
  const warnings: string[] = [];
  const assemblyId = wall?.wallAssemblyId ?? fallbackAssemblyId;
  const lengthM = wall ? segmentLength(wall.a, wall.b) : 1;
  const heightM = wall ? Math.max(0.2, wall.height_m) : 3;
  const wallAreaM2 = wall ? Math.max(0.25, lengthM * heightM) : 1;
  let { windowAreaM2, doorAreaM2 } = computeWallOpeningAreasM2(openings);
  const openingRaw = windowAreaM2 + doorAreaM2;
  if (openingRaw > wallAreaM2 + 1e-6) {
    warnings.push(
      `Площадь проёмов (${openingRaw.toFixed(2)} м²) больше площади стены (${wallAreaM2.toFixed(2)} м²) ` +
        `${wall?.id ? `(id: ${wall.id})` : "(запасной контур)"}: для расчёта проводимости проёмы пропорционально усечены до площади стены.`
    );
    const scale = wallAreaM2 / Math.max(openingRaw, 1e-9);
    windowAreaM2 *= scale;
    doorAreaM2 *= scale;
  }
  const openingAreaM2 = windowAreaM2 + doorAreaM2;
  const opaqueAreaM2 = Math.max(0, wallAreaM2 - openingAreaM2);
  const props = computeWallProperties(wall?.layers, assemblyId, { includeSp50AirFilms: true });
  const opaqueU = finitePositive(props?.uValue ?? DEFAULT_WALL_U_FALLBACK_W_M2K, DEFAULT_WALL_U_FALLBACK_W_M2K);
  const denom = Math.max(0.1, wallAreaM2);
  const weightedU =
    (opaqueAreaM2 * opaqueU + windowAreaM2 * DEFAULT_WINDOW_U_W_M2K + doorAreaM2 * DEFAULT_DOOR_U_W_M2K) / denom;
  const mult = finitePositive(conductanceMultiplier, 1);
  const conductanceOpaque_W_K = opaqueU * opaqueAreaM2 * mult;
  const conductanceWindow_W_K = DEFAULT_WINDOW_U_W_M2K * windowAreaM2 * mult;
  const conductanceDoor_W_K = DEFAULT_DOOR_U_W_M2K * doorAreaM2 * mult;
  const conductanceTotal_W_K = weightedU * wallAreaM2 * mult;
  return {
    wallAreaM2,
    opaqueAreaM2,
    windowAreaM2,
    doorAreaM2,
    weightedU_W_m2K: weightedU,
    conductanceTotal_W_K,
    conductanceOpaque_W_K,
    conductanceWindow_W_K,
    conductanceDoor_W_K,
    warnings,
    opaqueUTotal_W_m2K: opaqueU,
  };
}

export function computeFallbackFacadeConductance_W_K(areaM2: number, fallbackAssemblyId = DEFAULT_WALL_ASSEMBLY_ID): number {
  const props = computeWallProperties(undefined, fallbackAssemblyId, { includeSp50AirFilms: true });
  const u = finitePositive(props?.uValue ?? DEFAULT_WALL_U_FALLBACK_W_M2K, DEFAULT_WALL_U_FALLBACK_W_M2K);
  return Math.max(0, areaM2) * u;
}
