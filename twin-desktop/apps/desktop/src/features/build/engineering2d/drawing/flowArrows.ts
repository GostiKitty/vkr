import type { EngineeringPipePoint } from "../../../../entities/engineering/types";

export interface FlowArrowMarker {
  /** Центр стрелки (px) */
  cx: number;
  cy: number;
  /** Угол поворота в градусах (направление стрелки) */
  angleDeg: number;
}

/**
 * Расставить маркеры-стрелки направления вдоль полилинии трубы.
 * spacingPx — рекомендованный шаг между стрелками в координатах SVG.
 */
export function distributeFlowArrows(
  projected: EngineeringPipePoint[],
  spacingPx: number,
  options: { reverse?: boolean; minCount?: number } = {}
): FlowArrowMarker[] {
  if (projected.length < 2) return [];

  const segments: Array<{
    a: EngineeringPipePoint;
    b: EngineeringPipePoint;
    length: number;
    angleDeg: number;
  }> = [];
  let total = 0;
  for (let i = 0; i < projected.length - 1; i++) {
    const a = projected[i];
    const b = projected[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 4) continue;
    total += length;
    segments.push({ a, b, length, angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI });
  }
  if (!segments.length) return [];

  const minCount = options.minCount ?? 1;
  const desired = Math.max(minCount, Math.floor(total / Math.max(40, spacingPx)));
  const step = total / (desired + 1);
  const markers: FlowArrowMarker[] = [];
  let target = step;
  let consumed = 0;
  let segIdx = 0;
  for (let i = 0; i < desired; i++) {
    while (segIdx < segments.length && consumed + segments[segIdx].length < target) {
      consumed += segments[segIdx].length;
      segIdx += 1;
    }
    if (segIdx >= segments.length) break;
    const seg = segments[segIdx];
    const localOffset = target - consumed;
    const t = localOffset / seg.length;
    const cx = seg.a.x + (seg.b.x - seg.a.x) * t;
    const cy = seg.a.y + (seg.b.y - seg.a.y) * t;
    markers.push({
      cx,
      cy,
      angleDeg: options.reverse ? seg.angleDeg + 180 : seg.angleDeg,
    });
    target += step;
  }
  return markers;
}
