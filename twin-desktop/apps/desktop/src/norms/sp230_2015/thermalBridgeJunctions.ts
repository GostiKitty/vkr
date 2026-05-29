/**
 * Типовые удельные потери теплоты ψ и χ по СП 230.1325800.2015 (приложение Г).
 * Используются для демо-модели с СФТК: газобетон + минераловатный слой 120 мм.
 */

export const SP230_THERMAL_BRIDGE_SOURCE = "СП 230.1325800.2015, приложение Г";

/** Тарельчатый анкер СФТК, табл. Г.4 (пример Б.2 — первая строка). */
export const SP230_DISC_ANCHOR_CHI_W_K = 0.006;

/** Средняя плотность тарельчатых анкеров для СФТК, шт/м² (пример Б.2, п. Б.3). */
export const SP230_DISC_ANCHOR_DENSITY_PER_M2 = 10;

const R_UT_COLUMNS = [1.5, 3.0, 6.0] as const;
const LAMBDA_O_COLUMNS = [0.2, 0.6, 1.8] as const;

/** Табл. Г.28 — выпуклый угол СФТК, Вт/(м·К). */
const G28_CONVEX_PSI: number[][] = [
  [0.088, 0.076, 0.06],
  [0.167, 0.121, 0.082],
  [0.234, 0.15, 0.093],
];

/** Табл. Г.34 — примыкание оконного блока, dн = 20 мм, λо = 0,2, Вт/(м·К). */
const G34_WINDOW_JAMB_PSI_BY_R_UT: Record<number, number> = {
  1.5: 0.092,
  3.0: 0.092,
  6.0: 0.072,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function interpolate1D(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (xs.length !== ys.length || xs.length === 0) {
    return ys[0] ?? 0;
  }
  const clamped = clamp(x, xs[0]!, xs[xs.length - 1]!);
  for (let index = 0; index < xs.length - 1; index += 1) {
    const x0 = xs[index]!;
    const x1 = xs[index + 1]!;
    if (clamped <= x1) {
      const y0 = ys[index]!;
      const y1 = ys[index + 1]!;
      if (Math.abs(x1 - x0) < 1e-9) {
        return y0;
      }
      const t = (clamped - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return ys[ys.length - 1]!;
}

/**
 * ψ выпуклого угла СФТК (табл. Г.28) с линейной интерполяцией по Rут и λо.
 */
export function psiSftkConvexCorner_W_mK(input: {
  insulationResistance_m2K_W: number;
  baseLambda_W_mK: number;
}): number {
  const rUt = Math.max(0.1, input.insulationResistance_m2K_W);
  const lambdaO = Math.max(0.05, input.baseLambda_W_mK);
  const byLambda = LAMBDA_O_COLUMNS.map((lambdaColumn, rowIndex) =>
    interpolate1D(rUt, R_UT_COLUMNS, G28_CONVEX_PSI[rowIndex] ?? G28_CONVEX_PSI[0]!)
  );
  return interpolate1D(lambdaO, LAMBDA_O_COLUMNS, byLambda);
}

/**
 * ψ примыкания оконного/дверного блока к стене СФТК (табл. Г.34, dн = 20 мм, λо = 0,2).
 */
export function psiSftkWindowJamb_W_mK(insulationResistance_m2K_W: number): number {
  const rUt = Math.max(0.1, insulationResistance_m2K_W);
  const entries = Object.entries(G34_WINDOW_JAMB_PSI_BY_R_UT).map(([key, value]) => [Number(key), value] as const);
  const xs = entries.map(([key]) => key);
  const ys = entries.map(([, value]) => value);
  return interpolate1D(rUt, xs, ys);
}

/** Табл. Г.81 — сопряжение стены СФТК с совмещённым покрытием (λо = 0,2). */
const G81_WALL_ROOF_R_UT1 = [1.88, 3.13, 5.0] as const;
const G81_WALL_ROOF_R_UT2 = [1.5, 3.0, 5.0, 6.0] as const;
const G81_WALL_ROOF_PSI: number[][] = [
  [0.301, 0.252, 0.282, 0.282],
  [0.294, 0.241, 0.223, 0.212],
  [0.282, 0.223, 0.194, 0.194],
];

/** Табл. Г.40 — стена СФТК / цоколь (стык пола по грунту, λо = 0,2), Вт/(м·К). */
const G40_FLOOR_EDGE_R_UT1 = [1.5, 3.0, 6.0] as const;
const G40_FLOOR_EDGE_R_UT2 = [1.88, 3.13, 5.0, 7.81] as const;
const G40_FLOOR_EDGE_PSI: number[][] = [
  [0.156, 0.135, 0.115, 0.099],
  [0.175, 0.152, 0.128, 0.107],
  [0.194, 0.168, 0.141, 0.116],
];

/** Табл. Г.103 — стропила, dдоп = 0, Вт/(м·К). */
const G103_RAFTER_D_UT = [100, 150, 200] as const;
const G103_RAFTER_PSI = [0.044, 0.034, 0.027];

/** Табл. Г.104 — конёк/ендова, Вт/(м·К). */
const G104_RIDGE_D_UT = [100, 150, 200] as const;
const G104_RIDGE_PSI = [0.084, 0.065, 0.053];

function interpolate2DGrid(
  rUt1: number,
  rUt2: number,
  rows: readonly number[],
  cols: readonly number[],
  grid: readonly (readonly number[])[]
): number {
  let rowIndex = 0;
  for (let index = 0; index < rows.length - 1; index += 1) {
    if (rUt1 >= rows[index]! && rUt1 <= rows[index + 1]!) {
      rowIndex = index;
      break;
    }
    if (rUt1 > rows[rows.length - 1]!) {
      rowIndex = rows.length - 2;
    }
  }
  let colIndex = 0;
  for (let index = 0; index < cols.length - 1; index += 1) {
    if (rUt2 >= cols[index]! && rUt2 <= cols[index + 1]!) {
      colIndex = index;
      break;
    }
    if (rUt2 > cols[cols.length - 1]!) {
      colIndex = cols.length - 2;
    }
  }
  const r0 = rows[rowIndex]!;
  const r1 = rows[rowIndex + 1] ?? rows[rowIndex]!;
  const c0 = cols[colIndex]!;
  const c1 = cols[colIndex + 1] ?? cols[colIndex]!;
  const tRow = Math.abs(r1 - r0) < 1e-9 ? 0 : (rUt1 - r0) / (r1 - r0);
  const tCol = Math.abs(c1 - c0) < 1e-9 ? 0 : (rUt2 - c0) / (c1 - c0);
  const q00 = grid[rowIndex]?.[colIndex] ?? 0;
  const q01 = grid[rowIndex]?.[colIndex + 1] ?? q00;
  const q10 = grid[rowIndex + 1]?.[colIndex] ?? q00;
  const q11 = grid[rowIndex + 1]?.[colIndex + 1] ?? q10;
  const q0 = q00 + tCol * (q01 - q00);
  const q1 = q10 + tCol * (q11 - q10);
  return q0 + tRow * (q1 - q0);
}

/** ψ сопряжения стены и покрытия/кровли (табл. Г.81, СФТК, λо = 0,2). */
export function psiSftkWallRoofJunction_W_mK(input: {
  wallInsulationResistance_m2K_W: number;
  roofInsulationResistance_m2K_W: number;
}): number {
  return interpolate2DGrid(
    Math.max(0.1, input.wallInsulationResistance_m2K_W),
    Math.max(0.1, input.roofInsulationResistance_m2K_W),
    G81_WALL_ROOF_R_UT1,
    G81_WALL_ROOF_R_UT2,
    G81_WALL_ROOF_PSI
  );
}

/**
 * ψ стыка пола по грунту со стеной (СП 50.13330, прил. Г → СП 230, табл. Г.40; для Lпс).
 */
export function psiFloorOnGroundEdge_W_mK(input: {
  wallInsulationResistance_m2K_W: number;
  floorInsulationResistance_m2K_W: number;
}): number {
  return interpolate2DGrid(
    Math.max(0.1, input.wallInsulationResistance_m2K_W),
    Math.max(0.1, input.floorInsulationResistance_m2K_W),
    G40_FLOOR_EDGE_R_UT1,
    G40_FLOOR_EDGE_R_UT2,
    G40_FLOOR_EDGE_PSI
  );
}

/** ψ прохождения стропила через утеплитель скатной кровли (табл. Г.103, dдоп = 0). */
export function psiPitchedRoofRafter_W_mK(insulationThicknessMm: number): number {
  return interpolate1D(Math.max(50, insulationThicknessMm), G103_RAFTER_D_UT, G103_RAFTER_PSI);
}

/** ψ конька/ендовы скатной кровли (табл. Г.104). */
export function psiPitchedRoofRidge_W_mK(insulationThicknessMm: number): number {
  return interpolate1D(Math.max(50, insulationThicknessMm), G104_RIDGE_D_UT, G104_RIDGE_PSI);
}
