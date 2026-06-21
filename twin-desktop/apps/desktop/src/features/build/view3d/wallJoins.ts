import type { BuildingModel, Vec2, Wall, WallFillet } from "../../../entities/geometry/types";
import { filletFromDirections } from "../../../core/geometry/fillets";

const ENDPOINT_TOLERANCE = 0.2;
const MIN_WALL_SEGMENT = 0.05;
/** Допуск сопоставления скругления стыку по позиции. */
const FILLET_MATCH_TOLERANCE = 0.3;

export interface WallJoinExtension {
  start: number;
  end: number;
}

/** Параметры скруглённого угла (общие для 2D, 3D и расчёта). */
export interface WallCornerRounding {
  center: Vec2;
  radius: number;
  /** Точка касания на ребре dirA. */
  fromPt: Vec2;
  /** Точка касания на ребре dirB. */
  toPt: Vec2;
  startAngle: number;
  signedSweep: number;
  turnAngle: number;
}

export interface WallCornerPatchInput {
  point: Vec2;
  dirA: Vec2;
  dirB: Vec2;
  trimA: number;
  trimB: number;
  thickness: number;
  maxHeight: number;
  levelElevation: number;
  /** Если задано — угол скруглён (дуга вместо квадратной заплатки). */
  rounded?: WallCornerRounding;
}

export function computeWallJoinData(model: Pick<BuildingModel, "walls" | "levels" | "wallFillets">): {
  extensions: Map<string, WallJoinExtension>;
  corners: WallCornerPatchInput[];
  /** Подрезка стен ТОЛЬКО от скруглений (для 2D-рендера; отдельно от косметических extensions). */
  filletTrims: Map<string, WallJoinExtension>;
  /** Доля длины дуги, приходящаяся на конец стены (для расчёта площади): половина длины дуги угла. */
  filletArcs: Map<string, WallJoinExtension>;
} {
  const extensions = new Map<string, WallJoinExtension>();
  const filletTrims = new Map<string, WallJoinExtension>();
  const filletArcs = new Map<string, WallJoinExtension>();
  const corners: WallCornerPatchInput[] = [];
  const fillets = model.wallFillets ?? [];
  const findFillet = (point: Vec2, levelId: string): WallFillet | null =>
    fillets.find(
      (fillet) =>
        fillet.levelId === levelId &&
        Math.hypot(fillet.point.x - point.x, fillet.point.y - point.y) <= FILLET_MATCH_TOLERANCE
    ) ?? null;
  const endpointMap = new Map<string, { point: Vec2; entries: Array<{ wall: Wall; dir: Vec2; isStart: boolean }> }>();

  model.walls.forEach((wall) => {
    const entries: Array<{ point: Vec2; dir: Vec2; isStart: boolean }> = [
      { point: wall.a, dir: normalize(subtract(wall.b, wall.a)), isStart: true },
      { point: wall.b, dir: normalize(subtract(wall.a, wall.b)), isStart: false },
    ];
    entries.forEach((entry) => {
      const key = resolveEndpointKey(entry.point, endpointMap);
      const existing = endpointMap.get(key);
      if (existing) {
        existing.entries.push({ wall, dir: entry.dir, isStart: entry.isStart });
      } else {
        endpointMap.set(key, { point: entry.point, entries: [{ wall, dir: entry.dir, isStart: entry.isStart }] });
      }
    });
  });

  endpointMap.forEach(({ point, entries }) => {
    if (entries.length < 2) {
      return;
    }
    // Скруглённый стык имеет приоритет над квадратной заплаткой.
    const levelId = entries[0].wall.levelId;
    const fillet = findFillet(point, levelId) ?? findFillet(point, entries[1]?.wall.levelId ?? levelId);
    if (fillet && applyRoundedCorner(point, entries, fillet, filletTrims, filletArcs, corners, model)) {
      return;
    }
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const first = entries[i];
        const second = entries[j];
        const angleDot = dot(first.dir, second.dir);
        if (Math.abs(angleDot) > 0.3) {
          continue;
        }
        const lengthA = wallLength(first.wall);
        const lengthB = wallLength(second.wall);
        const trimA = Math.min(first.wall.thickness_m / 2, Math.max(MIN_WALL_SEGMENT, lengthA / 6));
        const trimB = Math.min(second.wall.thickness_m / 2, Math.max(MIN_WALL_SEGMENT, lengthB / 6));
        applyExtension(extensions, first.wall.id, first.isStart, trimA);
        applyExtension(extensions, second.wall.id, second.isStart, trimB);
        corners.push({
          point,
          dirA: first.dir,
          dirB: second.dir,
          trimA,
          trimB,
          thickness: (first.wall.thickness_m + second.wall.thickness_m) / 2,
          maxHeight: Math.min(first.wall.height_m, second.wall.height_m),
          levelElevation: Math.max(getModelLevelElevation(model, first.wall.levelId), getModelLevelElevation(model, second.wall.levelId)),
        });
      }
    }
  });

  return { extensions, corners, filletTrims, filletArcs };
}

/** Скругляет стык: выбирает «самую угловую» пару стен и добавляет дуговой угол. */
function applyRoundedCorner(
  point: Vec2,
  entries: Array<{ wall: Wall; dir: Vec2; isStart: boolean }>,
  fillet: WallFillet,
  filletTrims: Map<string, WallJoinExtension>,
  filletArcs: Map<string, WallJoinExtension>,
  corners: WallCornerPatchInput[],
  model: Pick<BuildingModel, "levels">
): boolean {
  const arms = entries.filter((entry) => entry.wall.levelId === fillet.levelId);
  // Скругляем только чистый угловой стык РОВНО из 2 стен. На T/X-стыках (3+ стен) одна стена
  // «проходит насквозь» и подрезка соседей оставляет щель — такие стыки не скругляем.
  if (arms.length !== 2) {
    return false;
  }
  let best: { a: typeof arms[number]; b: typeof arms[number]; result: NonNullable<ReturnType<typeof filletFromDirections>> } | null = null;
  for (let i = 0; i < arms.length; i += 1) {
    for (let j = i + 1; j < arms.length; j += 1) {
      const a = arms[i];
      const b = arms[j];
      const maxTrim = Math.min(wallLength(a.wall), wallLength(b.wall)) * 0.5;
      const result = filletFromDirections(point, a.dir, b.dir, fillet.radius_m, maxTrim);
      if (!result) {
        continue;
      }
      if (!best || result.turnAngle > best.result.turnAngle) {
        best = { a, b, result };
      }
    }
  }
  if (!best) {
    return false;
  }
  const { a, b, result } = best;
  // Скруглённый конец стены ПОДРЕЗается (не удлиняется): только filletTrims, не extensions.
  applyExtension(filletTrims, a.wall.id, a.isStart, result.trim);
  applyExtension(filletTrims, b.wall.id, b.isStart, result.trim);
  // Половина длины дуги угла приходится на каждую из двух стен (для расчёта площади).
  const arcHalf = (result.radius * result.turnAngle) / 2;
  applyExtension(filletArcs, a.wall.id, a.isStart, arcHalf);
  applyExtension(filletArcs, b.wall.id, b.isStart, arcHalf);
  corners.push({
    point,
    dirA: a.dir,
    dirB: b.dir,
    trimA: result.trim,
    trimB: result.trim,
    thickness: (a.wall.thickness_m + b.wall.thickness_m) / 2,
    maxHeight: Math.min(a.wall.height_m, b.wall.height_m),
    levelElevation: getModelLevelElevation(model, fillet.levelId),
    rounded: {
      center: result.center,
      radius: result.radius,
      fromPt: result.tangentA,
      toPt: result.tangentB,
      startAngle: result.startAngle,
      signedSweep: result.signedSweep,
      turnAngle: result.turnAngle,
    },
  });
  return true;
}

function applyExtension(map: Map<string, WallJoinExtension>, wallId: string, isStart: boolean, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }
  const entry = map.get(wallId) ?? { start: 0, end: 0 };
  if (isStart) {
    entry.start = Math.max(entry.start, value);
  } else {
    entry.end = Math.max(entry.end, value);
  }
  map.set(wallId, entry);
}

function resolveEndpointKey(
  point: Vec2,
  map: Map<string, { point: Vec2; entries: Array<{ wall: Wall; dir: Vec2; isStart: boolean }> }>
): string {
  for (const [key, bucket] of map.entries()) {
    if (Math.hypot(bucket.point.x - point.x, bucket.point.y - point.y) <= ENDPOINT_TOLERANCE) {
      return key;
    }
  }
  return `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
}

function normalize(point: Vec2): Vec2 {
  const length = Math.hypot(point.x, point.y);
  if (length <= 1e-9) {
    return { x: 0, y: 0 };
  }
  return { x: point.x / length, y: point.y / length };
}

function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function wallLength(wall: Wall): number {
  return Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
}

function getModelLevelElevation(model: Pick<BuildingModel, "levels">, levelId: string): number {
  return model.levels.find((level) => level.id === levelId)?.elevation_m ?? 0;
}
