/** Эвристики twin-графа (см. registry: twin_graph_*). */

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** C = 120 + 0,3·A_пол (Дж/К) */
export function twinNodeCapacitanceJPerK(floorAreaM2: number): number {
  return 120 + 0.3 * floorAreaM2;
}

/** G_int = clamp(A/600, 0,05, 0,35) (Вт/К) */
export function twinInternalConductanceWPerK(wallAreaM2: number): number {
  return clamp(wallAreaM2 / 600, 0.05, 0.35);
}

/** G_out = clamp(A/500, 0,05, 0,3) (Вт/К) */
export function twinOutdoorConductanceWPerK(envelopeAreaM2: number): number {
  return clamp(envelopeAreaM2 / 500, 0.05, 0.3);
}

/** Оценка площади наружного контура по габаритам помещения (м²). */
export function estimateExteriorEnvelopeAreaM2(widthM: number, depthM: number, heightM: number): number {
  return 2 * (widthM + depthM) * heightM;
}

/** Оценка площади общей стены между соседними зонами (м²). */
export function estimateSharedWallAreaM2(
  widthA: number,
  heightA: number,
  widthB: number,
  heightB: number
): number {
  return Math.min(widthA, widthB) * Math.min(heightA, heightB);
}
