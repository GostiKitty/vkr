import { polygonArea, segmentLength } from "../../entities/geometry/geom";
import type { BuildingModel } from "../../entities/geometry/types";
import { buildAdjacencyGraph } from "../graph/adjacency";
import { buildGeometryRenderModel } from "../geometry/bimPipeline";
import { airflowFromACH, ventilationLoss } from "./formulas";
import { calculateAirSpecificWeight } from "./sp50/calculations";

const DEFAULT_FALLBACK_ACH = 0.5;
const DEFAULT_AIR_DENSITY_KG_M3 = 1.204;
const DEFAULT_AIR_HEAT_CAPACITY_J_KG_K = 1005;
const DEFAULT_GRAVITY_M_S2 = 9.81;
const ABSOLUTE_ZERO_OFFSET_K = 273.15;
const DEFAULT_LEVEL_HEIGHT_M = 3;
export const DEFAULT_REFERENCE_PRESSURE_PA = 10;
export const DEFAULT_PRESSURE_EXPONENT = 0.67;
export const DEFAULT_ENVELOPE_LEAKAGE_M3S_M2_AT_10_PA = 0.00005;
export const DEFAULT_WINDOW_LEAKAGE_M3S_M_AT_10_PA = 0.0008;
export const DEFAULT_DOOR_LEAKAGE_M3S_M_AT_10_PA = 0.0012;
export const DEFAULT_WIND_SPEED_M_S = 4;
export const DEFAULT_WIND_PRESSURE_COEFFICIENT = 0.6;

export type InfiltrationMode = "manualAch" | "envelopeLeakage" | "pressureBased";
export type InfiltrationAchSource = "manual" | "calculated" | "fallback";

export interface EnvelopeLeakageInput {
  envelopeAirPermeabilityM3sM2At10Pa?: number | null;
  windowAirPermeabilityM3sMAt10Pa?: number | null;
  doorAirPermeabilityM3sMAt10Pa?: number | null;
  pressureExponent?: number | null;
  referencePressurePa?: number | null;
}

export interface PressureBasedInfiltrationInput extends EnvelopeLeakageInput {
  windSpeedMps?: number | null;
  windPressureCoefficient?: number | null;
  stackHeightM?: number | null;
  mechanicalPressurePa?: number | null;
}

export interface ThermalInfiltrationInput {
  infiltrationMode?: InfiltrationMode;
  infiltrationACH?: number | null;
  envelopeLeakage?: EnvelopeLeakageInput;
  pressureBased?: PressureBasedInfiltrationInput;
}

export interface BuildingInfiltrationContext {
  indoorTemperatureC: number;
  outdoorTemperatureC: number;
  mechanicalVentilationACH?: number | null;
  mechanicalVentilationEnabled?: boolean;
  defaultLevelHeightM?: number;
  airDensityKgM3?: number;
  airHeatCapacityJkgK?: number;
}

export interface InfiltrationGeometrySummary {
  heatedVolumeM3: number;
  envelopeOpaqueAreaM2: number;
  windowPerimeterM: number;
  doorPerimeterM: number;
  stackHeightM: number;
}

export interface InfiltrationCalculationDiagnostics {
  achSource: InfiltrationAchSource;
  selectedMode: InfiltrationMode;
  resolvedACH: number;
}

export interface InfiltrationCalculationResult {
  mode: InfiltrationMode;
  airflowM3s: number;
  airflowM3h: number;
  calculatedACH: number;
  pressureWindPa: number;
  pressureStackPa: number;
  pressureTotalPa: number;
  heatLossW: number;
  warnings: string[];
  assumptions: string[];
  diagnostics: InfiltrationCalculationDiagnostics;
  geometry: InfiltrationGeometrySummary;
}

export function resolveBuildingInfiltration(
  building: BuildingModel,
  input: ThermalInfiltrationInput | null | undefined,
  context: BuildingInfiltrationContext
): InfiltrationCalculationResult {
  const mode = input?.infiltrationMode ?? "manualAch";
  const geometry = summarizeInfiltrationGeometry(building, context.defaultLevelHeightM);
  const density = positiveOrFallback(context.airDensityKgM3, DEFAULT_AIR_DENSITY_KG_M3);
  const heatCapacity = positiveOrFallback(context.airHeatCapacityJkgK, DEFAULT_AIR_HEAT_CAPACITY_J_KG_K);
  const manualAch = finiteNonNegativeOrNull(input?.infiltrationACH);
  const fallbackAch = manualAch ?? DEFAULT_FALLBACK_ACH;
  const deltaT = Math.max(0, context.indoorTemperatureC - context.outdoorTemperatureC);

  if (mode === "manualAch") {
    return buildAchResult({
      mode,
      ach: fallbackAch,
      achSource: manualAch != null ? "manual" : "fallback",
      geometry,
      density,
      heatCapacity,
      deltaT,
      warnings:
        manualAch != null
          ? []
          : [`Инфильтрация ACH не задана, поэтому использовано значение по умолчанию ${DEFAULT_FALLBACK_ACH.toFixed(2)} 1/ч.`],
      assumptions: ["Использован прямой ввод ACH по формуле L = ACH * V / 3600."],
    });
  }

  if (geometry.heatedVolumeM3 <= 0) {
    return buildAchResult({
      mode,
      ach: fallbackAch,
      achSource: "fallback",
      geometry,
      density,
      heatCapacity,
      deltaT,
      warnings: [
        "Не удалось определить отапливаемый объём для расчётной инфильтрации; выполнен откат к manual ACH.",
        ...(manualAch == null
          ? [`В качестве fallback использовано значение по умолчанию ${DEFAULT_FALLBACK_ACH.toFixed(2)} 1/ч.`]
          : []),
      ],
      assumptions: ["Расчётная инфильтрация требует объёма здания; при его отсутствии используется ACH fallback."],
    });
  }

  if (mode === "envelopeLeakage") {
    const leakage = resolveEnvelopeLeakage(input?.envelopeLeakage, geometry);
    return buildCalculatedResult({
      mode,
      geometry,
      airflowM3s: leakage.airflowM3s,
      pressureWindPa: 0,
      pressureStackPa: 0,
      pressureTotalPa: leakage.pressureTotalPa,
      density,
      heatCapacity,
      deltaT,
      warnings: leakage.warnings,
      assumptions: leakage.assumptions,
      manualAchFallback: fallbackAch,
    });
  }

  const pressure = resolvePressureBasedLeakage(input?.pressureBased, geometry, context, density);
  const leakage = resolveEnvelopeLeakage(
    {
      ...(input?.envelopeLeakage ?? {}),
      ...(input?.pressureBased ?? {}),
    },
    geometry,
    pressure.pressureTotalPa
  );
  return buildCalculatedResult({
    mode,
    geometry,
    airflowM3s: leakage.airflowM3s,
    pressureWindPa: pressure.pressureWindPa,
    pressureStackPa: pressure.pressureStackPa,
    pressureTotalPa: pressure.pressureTotalPa,
    density,
    heatCapacity,
    deltaT,
    warnings: [...pressure.warnings, ...leakage.warnings],
    assumptions: [...pressure.assumptions, ...leakage.assumptions],
    manualAchFallback: fallbackAch,
  });
}

function buildCalculatedResult(input: {
  mode: InfiltrationMode;
  geometry: InfiltrationGeometrySummary;
  airflowM3s: number;
  pressureWindPa: number;
  pressureStackPa: number;
  pressureTotalPa: number;
  density: number;
  heatCapacity: number;
  deltaT: number;
  warnings: string[];
  assumptions: string[];
  manualAchFallback: number;
}): InfiltrationCalculationResult {
  if (!Number.isFinite(input.airflowM3s) || input.airflowM3s < 0) {
    return buildAchResult({
      mode: input.mode,
      ach: input.manualAchFallback,
      achSource: "fallback",
      geometry: input.geometry,
      density: input.density,
      heatCapacity: input.heatCapacity,
      deltaT: input.deltaT,
      pressureWindPa: input.pressureWindPa,
      pressureStackPa: input.pressureStackPa,
      pressureTotalPa: input.pressureTotalPa,
      warnings: [
        ...input.warnings,
        "Расчётный расход инфильтрации получился некорректным; выполнен откат к manual ACH.",
      ],
      assumptions: input.assumptions,
    });
  }

  const airflowM3s = Math.max(0, input.airflowM3s);
  const calculatedACH = input.geometry.heatedVolumeM3 > 0 ? (airflowM3s * 3600) / input.geometry.heatedVolumeM3 : 0;
  return {
    mode: input.mode,
    airflowM3s,
    airflowM3h: airflowM3s * 3600,
    calculatedACH,
    pressureWindPa: Math.max(0, input.pressureWindPa),
    pressureStackPa: Math.max(0, input.pressureStackPa),
    pressureTotalPa: Math.max(0, input.pressureTotalPa),
    heatLossW: ventilationLoss(airflowM3s, input.density, input.heatCapacity, input.deltaT),
    warnings: dedupe(input.warnings),
    assumptions: dedupe(input.assumptions),
    diagnostics: {
      achSource: "calculated",
      selectedMode: input.mode,
      resolvedACH: calculatedACH,
    },
    geometry: input.geometry,
  };
}

function buildAchResult(input: {
  mode: InfiltrationMode;
  ach: number;
  achSource: InfiltrationAchSource;
  geometry: InfiltrationGeometrySummary;
  density: number;
  heatCapacity: number;
  deltaT: number;
  pressureWindPa?: number;
  pressureStackPa?: number;
  pressureTotalPa?: number;
  warnings: string[];
  assumptions: string[];
}): InfiltrationCalculationResult {
  const airflowM3s = input.geometry.heatedVolumeM3 > 0 ? airflowFromACH(Math.max(0, input.ach), input.geometry.heatedVolumeM3) : 0;
  return {
    mode: input.mode,
    airflowM3s,
    airflowM3h: airflowM3s * 3600,
    calculatedACH: Math.max(0, input.ach),
    pressureWindPa: Math.max(0, input.pressureWindPa ?? 0),
    pressureStackPa: Math.max(0, input.pressureStackPa ?? 0),
    pressureTotalPa: Math.max(0, input.pressureTotalPa ?? 0),
    heatLossW: ventilationLoss(airflowM3s, input.density, input.heatCapacity, input.deltaT),
    warnings: dedupe(input.warnings),
    assumptions: dedupe(input.assumptions),
    diagnostics: {
      achSource: input.achSource,
      selectedMode: input.mode,
      resolvedACH: Math.max(0, input.ach),
    },
    geometry: input.geometry,
  };
}

function resolveEnvelopeLeakage(
  input: EnvelopeLeakageInput | PressureBasedInfiltrationInput | null | undefined,
  geometry: InfiltrationGeometrySummary,
  explicitPressurePa?: number
): { airflowM3s: number; pressureTotalPa: number; warnings: string[]; assumptions: string[] } {
  const referencePressurePa = positiveOrFallback(input?.referencePressurePa, DEFAULT_REFERENCE_PRESSURE_PA);
  const pressureExponent = positiveOrFallback(input?.pressureExponent, DEFAULT_PRESSURE_EXPONENT);
  const pressureTotalPa = Math.max(0, explicitPressurePa ?? referencePressurePa);
  const pressureFactor = Math.pow(pressureTotalPa / referencePressurePa, pressureExponent);
  const envelopeLeakage = nonNegativeOrFallback(
    input?.envelopeAirPermeabilityM3sM2At10Pa,
    DEFAULT_ENVELOPE_LEAKAGE_M3S_M2_AT_10_PA
  );
  const windowLeakage = nonNegativeOrFallback(input?.windowAirPermeabilityM3sMAt10Pa, DEFAULT_WINDOW_LEAKAGE_M3S_M_AT_10_PA);
  const doorLeakage = nonNegativeOrFallback(input?.doorAirPermeabilityM3sMAt10Pa, DEFAULT_DOOR_LEAKAGE_M3S_M_AT_10_PA);
  const airflowM3s =
    (envelopeLeakage * geometry.envelopeOpaqueAreaM2 +
      windowLeakage * geometry.windowPerimeterM +
      doorLeakage * geometry.doorPerimeterM) *
    pressureFactor;

  const warnings: string[] = [];
  if (geometry.envelopeOpaqueAreaM2 <= 0 && geometry.windowPerimeterM <= 0 && geometry.doorPerimeterM <= 0) {
    warnings.push("Для расчёта инфильтрации не найдено наружных ограждений или проёмов с ненулевой площадью.");
  }

  return {
    airflowM3s,
    pressureTotalPa,
    warnings,
    assumptions: [
      "Расход рассчитан по формуле L_inf = Σ G_air_i * A_or_P_i * (ΔP / 10)^n.",
      "Для непрозрачных ограждений используется площадь, для окон и дверей — периметр притвора.",
      pressureTotalPa === referencePressurePa
        ? "В режиме envelopeLeakage принят опорный перепад давления 10 Па."
        : "В режиме pressureBased коэффициенты утечки приведены к опорному перепаду 10 Па.",
    ],
  };
}

function resolvePressureBasedLeakage(
  input: PressureBasedInfiltrationInput | null | undefined,
  geometry: InfiltrationGeometrySummary,
  context: BuildingInfiltrationContext,
  density: number
): {
  pressureWindPa: number;
  pressureStackPa: number;
  pressureTotalPa: number;
  warnings: string[];
  assumptions: string[];
} {
  const windSpeedMps = nonNegativeOrFallback(input?.windSpeedMps, DEFAULT_WIND_SPEED_M_S);
  const windPressureCoefficient = positiveOrFallback(
    input?.windPressureCoefficient,
    DEFAULT_WIND_PRESSURE_COEFFICIENT
  );
  const stackHeightM = positiveOrFallback(input?.stackHeightM, geometry.stackHeightM);
  const mechanicalPressurePa = nonNegativeOrFallback(input?.mechanicalPressurePa, 0);
  // Нормативные формулы СП 50.13330.2024 (формулы Г.3, Г.4):
  // ΔP_wind = 0.03 * γout * v²  (коэффициент 0.03 включает Cp и долю от полного напора)
  // ΔP_stack = 0.55 * H * (γout − γin)  где γ = 3463/(273+T) — удельный вес воздуха, Па/м
  const gammaOut = calculateAirSpecificWeight(context.outdoorTemperatureC);
  const gammaIn = calculateAirSpecificWeight(context.indoorTemperatureC);
  const pressureWindPa = 0.03 * gammaOut * windSpeedMps * windSpeedMps * windPressureCoefficient;
  const pressureStackPa = Math.max(0, 0.55 * stackHeightM * (gammaOut - gammaIn));
  const pressureTotalPa = Math.max(0, pressureWindPa + pressureStackPa + mechanicalPressurePa);

  const assumptions = [
    "ΔP_wind = 0.03 * γout * v² * Cp (СП 50.13330.2024, формула Г.4).",
    "ΔP_stack = 0.55 * H * (γout − γin), γ = 3463/(273+T) (СП 50.13330.2024, формула Г.3).",
  ];
  if ((input?.mechanicalPressurePa ?? null) != null) {
    assumptions.push("К суммарному перепаду добавлено заданное давление механической вентиляции.");
  } else if (context.mechanicalVentilationEnabled && (context.mechanicalVentilationACH ?? 0) > 0) {
    assumptions.push("Механическая вентиляция учитывается только через отдельные потери Q_vent; дополнительное давление не задано и принято 0 Па.");
  }

  return {
    pressureWindPa,
    pressureStackPa,
    pressureTotalPa,
    warnings: pressureTotalPa <= 0 ? ["Суммарный перепад давления не превышает 0 Па, поэтому расчётная инфильтрация равна 0."] : [],
    assumptions,
  };
}

export function summarizeInfiltrationGeometry(
  building: BuildingModel,
  defaultLevelHeightM = DEFAULT_LEVEL_HEIGHT_M
): InfiltrationGeometrySummary {
  const adjacency = buildAdjacencyGraph(building);
  const renderGeometry = buildGeometryRenderModel(building);
  const heatedVolumeM3 = estimateHeatedVolumeM3(building, defaultLevelHeightM);
  const externalWallIds = new Set(adjacency.external.map((edge) => edge.wallId));

  let envelopeOpaqueAreaM2 = 0;
  let windowPerimeterM = 0;
  let doorPerimeterM = 0;

  renderGeometry.walls.forEach(({ wall, openings }) => {
    if (!externalWallIds.has(wall.id)) {
      return;
    }
    const grossAreaM2 = Math.max(0, segmentLength(wall.a, wall.b) * Math.max(0, wall.height_m));
    let opaqueAreaM2 = grossAreaM2;
    openings.forEach((opening) => {
      opaqueAreaM2 -= Math.max(0, opening.widthM * opening.heightM);
      const perimeter = 2 * Math.max(0, opening.widthM + opening.heightM);
      if (opening.type === "window") {
        windowPerimeterM += perimeter;
      } else if (opening.type === "door") {
        doorPerimeterM += perimeter;
      }
    });
    envelopeOpaqueAreaM2 += Math.max(0, opaqueAreaM2);
  });

  return {
    heatedVolumeM3,
    envelopeOpaqueAreaM2,
    windowPerimeterM,
    doorPerimeterM,
    stackHeightM: estimateStackHeightM(building, defaultLevelHeightM),
  };
}

function estimateStackHeightM(building: BuildingModel, defaultLevelHeightM: number): number {
  if (!building.levels.length) {
    return defaultLevelHeightM;
  }
  const relevantLevels = building.levels.filter((level) => building.rooms.some((room) => room.levelId === level.id));
  const levels = relevantLevels.length ? relevantLevels : building.levels;
  const minElevation = Math.min(...levels.map((level) => level.elevation_m));
  const maxElevation = Math.max(...levels.map((level) => level.elevation_m + Math.max(level.height_m || 0, defaultLevelHeightM)));
  return Math.max(defaultLevelHeightM, maxElevation - minElevation);
}

function finiteNonNegativeOrNull(value: number | null | undefined): number | null {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? Math.max(0, value ?? 0) : null;
}

function positiveOrFallback(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value! : fallback;
}

function nonNegativeOrFallback(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? value! : fallback;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function estimateHeatedVolumeM3(building: BuildingModel, defaultLevelHeightM = DEFAULT_LEVEL_HEIGHT_M): number {
  const levelHeightById = new Map(building.levels.map((level) => [level.id, Math.max(1, level.height_m || defaultLevelHeightM)]));
  return building.rooms.reduce((sum, room) => {
    const area = Math.abs(polygonArea(room.polygon));
    const heightM = levelHeightById.get(room.levelId) ?? defaultLevelHeightM;
    return sum + Math.max(0, area) * Math.max(1, heightM);
  }, 0);
}
