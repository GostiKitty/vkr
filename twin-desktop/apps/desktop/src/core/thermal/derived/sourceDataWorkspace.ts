import { polygonArea, segmentLength } from "../../../entities/geometry/geom";
import type { BuildingModel, FloorSlab, Roof, Room, Sp50EnvelopeFragmentInput, Sp50EnvelopeFragmentMetadata, Wall } from "../../../entities/geometry/types";
import { computeWallProperties, getMaterial } from "../../../entities/material/types";
import type { SolarTimeInput } from "../../solar/solarShading";
import type { ScenarioConfig } from "../../../entities/workflow/workflow.store";
import {
  estimateBuildingMeanMrtC,
  estimateMrtFromEnvelope,
  resolveComfortMaxC,
  resolveComfortMinC,
  resolveRelativeHumidityPercent,
} from "../comfort/resolveScenarioComfort";
import {
  resolveScenarioEngineeringInputs,
  summarizeModelEngineering,
  type EngineeringInputSource,
} from "../engineering/resolveScenarioEngineering";
import { resolveScenarioConfig } from "../../../entities/workflow/workflow.store";
import { getSp131CityClimate } from "../../../norms/sp131_2025/climate";
import { getMaterialThermalProperties } from "../../../norms/sp50_2024/materialThermalProperties";
import { isCanonicalDemoProjectModel } from "../../../shared/utils/demoProject";
import {
  applyDefaultOpeningEnvelopeToModel,
  resolveModelDoorU_W_m2K,
  resolveModelShadingFactor,
  hasModelDoorAreaSource,
  hasModelWindowAreaSource,
  resolveModelDoorAreaM2,
  resolveModelWindowAreaM2,
  resolveModelWindowGValue,
  resolveModelWindowU_W_m2K,
  TYPICAL_PVC_WINDOW_G_VALUE,
  TYPICAL_WINDOW_SHADING_FACTOR,
  shadingEnvelopeSourceNote,
  windowEnvelopeSourceNote,
} from "../../../shared/utils/openingThermalData";
import { buildAdjacencyGraph } from "../../graph/adjacency";
import {
  airflowFromACH,
  calculateHydronicHeatPower,
  calculateRequiredHydronicMassFlow,
  calculateRequiredHydronicVolumeFlowM3H,
  dewPointMagnusC,
  gsop,
  heatLossCoefficientTransmission,
  heatLossCoefficientTotal,
  heatLossCoefficientVentilation,
  internalSurfaceTemperatureC,
  reducedResistanceByHomogeneity,
  thermalBridgeHeatLoss,
  thermalBridgeLinearConductance,
  thermalBridgePointConductance,
  ventilationLoss,
  ventilationRecoveryLoss,
} from "../formulas";
import { resolveBuildingInfiltration } from "../infiltration";
import type { ThermalSimulationResult } from "../solver";
import { resolveScenarioEnergyTariff } from "../../economics/scenarioEnergyTariff";
import { aggregateEnvelopeBridgeConductances } from "../../../demo/deriveExteriorWallThermalBridges";
import { syncAndEnrichThermalProtection } from "../../../features/build/envelope/syncAndEnrichThermalProtection";
import { ensureModelClimate, resolvePreferredClimateCityId } from "../climate/ensureModelClimate";
import {
  isOpaqueConstructionKind,
  resolveBridgeAccountingMode,
} from "../../../shared/utils/bridgeAccountingMode";
import {
  resolveFragmentHomogeneityCoefficient,
  resolveModelHomogeneityCoefficient,
} from "../../../shared/utils/homogeneityFromModel";
import { calculateValidationMetrics } from "./buildingPerformanceMetrics";

export type SourceDataSectionId =
  | "geometry"
  | "materials"
  | "climate"
  | "operation"
  | "airExchange"
  | "humidity"
  | "engineeringNetworks"
  | "ecology"
  | "economy"
  | "validation"
  | "reports";

export type SourceDataOrigin =
  | "model"
  | "user"
  | "scenario"
  | "calculated"
  | "result"
  | "sp50"
  | "sp131"
  | "fallback"
  | "missing";

export type SourceDataCompletenessStatus = "sufficient" | "partial" | "missing";

export interface SourceDataField {
  key: string;
  label: string;
  value: string | number | boolean | null;
  unit: string | null;
  source: SourceDataOrigin;
  sourceLabel: string;
  warnings: string[];
  notes: string[];
  missing: boolean;
}

export interface SourceDataRequirement {
  key: string;
  label: string;
  present: boolean;
  required: boolean;
  source: SourceDataOrigin;
  sourceLabel: string;
  warnings: string[];
}

export interface SourceDataSummaryCard {
  id: SourceDataSectionId;
  label: string;
  completionPercent: number;
  status: SourceDataCompletenessStatus;
  missingCount: number;
  fallbackCount: number;
  sourceLabels: string[];
}

export interface SourceDataGeometryRoom {
  roomId: string;
  roomName: string;
  areaM2: SourceDataField;
  volumeM3: SourceDataField;
  heightM: SourceDataField;
  heated: SourceDataField;
  floorContactType: SourceDataField;
  roofContactType: SourceDataField;
  purpose: SourceDataField;
}

export interface SourceDataLayerRow {
  materialId: string;
  materialLabel: string;
  thicknessM: SourceDataField;
  lambda_W_mK: SourceDataField;
  densityKgM3: SourceDataField;
  heatCapacity_J_kgK: SourceDataField;
  resistance_m2K_W: SourceDataField;
}

export interface SourceDataConstructionRow {
  id: string;
  label: string;
  kind: "wall" | "roof" | "slab" | "window" | "door";
  areaM2: SourceDataField;
  layerCount: SourceDataField;
  resistanceR0_m2K_W: SourceDataField;
  reducedResistance_m2K_W: SourceDataField;
  uValue_W_m2K: SourceDataField;
  bridgeMode: SourceDataField;
  layers: SourceDataLayerRow[];
  warnings: string[];
}

export interface SourceDataSectionReport {
  id: SourceDataSectionId;
  label: string;
  summary: SourceDataSummaryCard;
  requirements: SourceDataRequirement[];
  computedFields: SourceDataField[];
  warnings: string[];
}

export interface SourceDataReportMetadataInput {
  projectName?: string | null;
  objectAddress?: string | null;
  customerOrg?: string | null;
  developerOrg?: string | null;
  documentStage?: string | null;
  issueYear?: string | null;
  designBasis?: string | null;
  developedBy?: string | null;
  checkedBy?: string | null;
  chiefEngineer?: string | null;
  modelNote?: string | null;
}

export interface SourceDataWorkspaceReport {
  summaryCards: SourceDataSummaryCard[];
  sections: Record<SourceDataSectionId, SourceDataSectionReport>;
  geometryRooms: SourceDataGeometryRoom[];
  constructions: SourceDataConstructionRow[];
  reportWarnings: string[];
}

export interface BuildSourceDataWorkspaceReportInput {
  model: BuildingModel;
  scenarioConfig?: ScenarioConfig | null;
  thermalResult?: ThermalSimulationResult | null;
  reportInputs?: SourceDataReportMetadataInput | null;
  /** Солнечное время из конструктора (виджет «Положение солнца»). */
  solarTime?: SolarTimeInput | null;
}

import {
  AUTO_CALCULATED_SOURCE_LABEL,
  MODEL_SOURCE_LABEL,
} from "../../../shared/constants/sourceDataLabels";

const AIR_DENSITY_KG_M3 = 1.2;
const AIR_HEAT_CAPACITY_J_KG_K = 1005;
const WATER_DENSITY_KG_M3 = 998;
const WATER_HEAT_CAPACITY_J_KG_K = 4180;
const GLYCOL_DENSITY_KG_M3 = 1030;
const GLYCOL_HEAT_CAPACITY_J_KG_K = 3900;

const SECTION_LABELS: Record<SourceDataSectionId, string> = {
  geometry: "Геометрия",
  materials: "Материалы",
  climate: "Климат",
  operation: "Эксплуатация",
  airExchange: "Воздухообмен",
  humidity: "Влажность",
  engineeringNetworks: "Инженерные сети",
  ecology: "Экология",
  economy: "Экономика",
  validation: "Валидация",
  reports: "Отчёты",
};

function sourceLabel(source: SourceDataOrigin): string {
  switch (source) {
    case "model":
      return MODEL_SOURCE_LABEL;
    case "user":
      return "задано пользователем";
    case "scenario":
      return "задано пользователем";
    case "calculated":
    case "result":
      return AUTO_CALCULATED_SOURCE_LABEL;
    case "sp50":
      return "из СП 50";
    case "sp131":
      return "из СП 131";
    case "fallback":
      return "типовое значение";
    default:
      return "нет данных";
  }
}

function field(
  key: string,
  label: string,
  value: string | number | boolean | null,
  unit: string | null,
  source: SourceDataOrigin,
  warnings: string[] = [],
  notes: string[] = []
): SourceDataField {
  return {
    key,
    label,
    value,
    unit,
    source,
    sourceLabel: sourceLabel(source),
    warnings,
    notes,
    missing: value === null || value === "",
  };
}

function requirement(
  key: string,
  label: string,
  present: boolean,
  source: SourceDataOrigin,
  warnings: string[] = [],
  required = true
): SourceDataRequirement {
  return {
    key,
    label,
    present,
    required,
    source,
    sourceLabel: sourceLabel(source),
    warnings,
  };
}

function summarizeSection(
  id: SourceDataSectionId,
  requirements: SourceDataRequirement[]
): SourceDataSummaryCard {
  const required = requirements.filter((entry) => entry.required);
  const availableCount = required.filter((entry) => entry.present).length;
  const missingCount = required.length - availableCount;
  const fallbackCount = requirements.filter((entry) => entry.present && entry.source === "fallback").length;
  const completionPercent =
    required.length > 0 ? Math.round((availableCount / required.length) * 100) : 0;
  let status: SourceDataCompletenessStatus = "missing";
  if (availableCount === 0) {
    status = "missing";
  } else if (missingCount === 0 && fallbackCount === 0) {
    status = "sufficient";
  } else {
    status = "partial";
  }
  return {
    id,
    label: SECTION_LABELS[id],
    completionPercent,
    status,
    missingCount,
    fallbackCount,
    sourceLabels: Array.from(new Set(requirements.filter((entry) => entry.present).map((entry) => entry.sourceLabel))),
  };
}

function roomAreaM2(room: Room): number {
  return Math.abs(polygonArea(room.polygon));
}

function roofAreaM2(roof: Roof): number {
  return Math.abs(polygonArea(roof.boundary));
}

function slabAreaM2(slab: FloorSlab): number {
  return Math.abs(polygonArea(slab.boundary));
}

function roomPolygonSignature(room: Room): string {
  const tokens = room.polygon.map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`);
  if (!tokens.length) {
    return `${room.levelId}:empty`;
  }
  const candidates: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    candidates.push(tokens.slice(index).concat(tokens.slice(0, index)).join("|"));
  }
  const reversed = [...tokens].reverse();
  for (let index = 0; index < reversed.length; index += 1) {
    candidates.push(reversed.slice(index).concat(reversed.slice(0, index)).join("|"));
  }
  candidates.sort();
  return `${room.levelId}:${candidates[0] ?? ""}`;
}

function dedupeRooms(rooms: Room[]): Room[] {
  const uniqueRooms = new Map<string, Room>();
  rooms.forEach((room) => {
    const key = roomPolygonSignature(room);
    const existing = uniqueRooms.get(key);
    if (!existing) {
      uniqueRooms.set(key, room);
      return;
    }
    if (existing.source === "auto" && room.source !== "auto") {
      uniqueRooms.set(key, room);
    }
  });
  return Array.from(uniqueRooms.values());
}

function polylineLengthM(points: Array<{ x: number; y: number }>): number {
  if (points.length < 2) {
    return 0;
  }
  return points.slice(1).reduce((sum, point, index) => sum + segmentLength(points[index]!, point), 0);
}

function findLevelHeightM(model: BuildingModel, room: Room): number | null {
  const level = model.levels.find((entry) => entry.id === room.levelId);
  return level && Number.isFinite(level.height_m) && level.height_m > 0 ? level.height_m : null;
}

function inferRoomPurpose(room: Room): { value: string | null; source: SourceDataOrigin; warnings: string[] } {
  const value = room.name.trim();
  return value
    ? { value, source: "model", warnings: [] }
    : { value: null, source: "missing", warnings: ["Название помещения не задано в модели."] };
}

function inferRoomHeated(): { value: boolean; source: SourceDataOrigin; warnings: string[] } {
  return {
    value: true,
    source: "model",
    warnings: [],
  };
}

function inferRoomFloorContactType(
  room: Room,
  levelIndexById: Map<string, number>,
  levelCount: number,
  floorKindsByLevelId: Map<string, Set<FloorSlab["kind"]>>
): {
  value: "ground" | "basement" | "outdoor" | "interfloor" | null;
  source: SourceDataOrigin;
  warnings: string[];
} {
  const levelIndex = levelIndexById.get(room.levelId) ?? -1;
  const floorKinds = floorKindsByLevelId.get(room.levelId);

  if (floorKinds?.has("ground")) {
    return { value: "ground", source: "model", warnings: [] };
  }
  if (floorKinds?.has("basement")) {
    return { value: "basement", source: "model", warnings: [] };
  }
  if (floorKinds?.has("interfloor")) {
    return { value: "interfloor", source: "model", warnings: [] };
  }
  if (levelCount === 1 || levelIndex === 0) {
    return { value: "ground", source: "model", warnings: [] };
  }
  if (levelIndex > 0) {
    return { value: "interfloor", source: "model", warnings: [] };
  }
  return {
    value: null,
    source: "missing",
    warnings: ["Тип контакта пола не удалось определить из модели."],
  };
}

function inferRoomRoofContactType(
  room: Room,
  levelIndexById: Map<string, number>,
  levelCount: number,
  roofLevelIds: Set<string>
): {
  value: "outdoor" | "attic" | "technical" | "interfloor" | null;
  source: SourceDataOrigin;
  warnings: string[];
} {
  const levelIndex = levelIndexById.get(room.levelId) ?? -1;

  if (roofLevelIds.has(room.levelId)) {
    return { value: "outdoor", source: "model", warnings: [] };
  }
  if (levelCount === 1 || levelIndex === levelCount - 1) {
    return { value: "outdoor", source: "model", warnings: [] };
  }
  if (levelIndex >= 0 && levelIndex < levelCount - 1) {
    return { value: "interfloor", source: "model", warnings: [] };
  }
  return {
    value: null,
    source: "missing",
    warnings: ["Тип контакта кровли не удалось определить из модели."],
  };
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveHumiditySource(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): { value: number | null; source: SourceDataOrigin; warnings: string[] } {
  const resolved = resolveRelativeHumidityPercent(scenarioConfig, scenario, model);
  const source: SourceDataOrigin =
    resolved.source === "user"
      ? "user"
      : resolved.source === "model"
        ? "sp50"
        : "fallback";
  const warnings =
    resolved.explicit || resolved.source === "model"
      ? []
      : ["Влажность подставлена автоматически (модель или 50 % по умолчанию)."];
  return { value: resolved.value, source, warnings };
}

function comfortBoundsOrigin(source: ReturnType<typeof resolveComfortMinC>["source"]): SourceDataOrigin {
  switch (source) {
    case "user":
      return "user";
    case "setpoints":
      return "calculated";
    default:
      return "fallback";
  }
}

function resolveIndoorTemperatureC(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel,
  thermalResult: ThermalSimulationResult | null | undefined
): { value: number | null; source: SourceDataOrigin } {
  const fromResult = thermalResult?.timeline.at(-1)?.rooms;
  if (fromResult) {
    const temperatures = Object.values(fromResult)
      .map((entry) => entry.temperatureC)
      .filter((value) => Number.isFinite(value));
    if (temperatures.length) {
      return {
        value: temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length,
        source: "result",
      };
    }
  }
  const fromSp50 = model.thermalProtection?.climate?.indoorTemperatureC;
  if (fromSp50 != null && Number.isFinite(fromSp50)) {
    return { value: fromSp50, source: "sp50" };
  }
  if (scenarioConfig?.setpoints?.day != null && Number.isFinite(scenarioConfig.setpoints.day)) {
    return { value: scenarioConfig.setpoints.day, source: "scenario" };
  }
  if (scenario.setpoints.day != null && Number.isFinite(scenario.setpoints.day)) {
    return { value: scenario.setpoints.day, source: "fallback" };
  }
  return { value: null, source: "missing" };
}

function resolveClimateMeta(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): {
  cityLabel: string | null;
  designOutdoorC: number | null;
  heatingAverageC: number | null;
  heatingDurationDays: number | null;
  source: SourceDataOrigin;
  warnings: string[];
} {
  const manual = scenarioConfig?.climate?.manual;
  const hasManualOutdoor =
    manual &&
    (manual.outdoorDesignTemperatureC != null ||
      manual.outdoorHeatingAverageC != null ||
      manual.heatingDurationDays != null);

  const sp50Climate = model.thermalProtection?.climate;
  const hasModelOutdoor =
    sp50Climate &&
    (sp50Climate.outdoorDesignTemperatureC != null ||
      sp50Climate.outdoorHeatingPeriodAverageC != null ||
      sp50Climate.heatingPeriodDurationDays != null);

  const preferredCityId = resolvePreferredClimateCityId(model, scenarioConfig);
  const sp131City = getSp131CityClimate(preferredCityId);

  if (hasManualOutdoor) {
    return {
      cityLabel: sp50Climate?.city ?? sp131City?.label ?? null,
      designOutdoorC:
        manual.outdoorDesignTemperatureC != null && Number.isFinite(manual.outdoorDesignTemperatureC)
          ? manual.outdoorDesignTemperatureC
          : hasModelOutdoor
            ? (sp50Climate?.outdoorDesignTemperatureC ?? sp131City?.outdoorDesignTemperatureC ?? null)
            : (sp131City?.outdoorDesignTemperatureC ?? null),
      heatingAverageC:
        manual.outdoorHeatingAverageC != null && Number.isFinite(manual.outdoorHeatingAverageC)
          ? manual.outdoorHeatingAverageC
          : hasModelOutdoor
            ? (sp50Climate?.outdoorHeatingPeriodAverageC ?? sp131City?.outdoorHeatingPeriodAverageC ?? null)
            : (sp131City?.outdoorHeatingPeriodAverageC ?? null),
      heatingDurationDays:
        manual.heatingDurationDays != null && Number.isFinite(manual.heatingDurationDays)
          ? manual.heatingDurationDays
          : hasModelOutdoor
            ? (sp50Climate?.heatingPeriodDurationDays ?? sp131City?.heatingPeriodDurationDays ?? null)
            : (sp131City?.heatingPeriodDurationDays ?? null),
      source: "user",
      warnings: [],
    };
  }

  if (hasModelOutdoor) {
    return {
      cityLabel: sp50Climate?.city ?? sp131City?.label ?? null,
      designOutdoorC: sp50Climate?.outdoorDesignTemperatureC ?? sp131City?.outdoorDesignTemperatureC ?? null,
      heatingAverageC: sp50Climate?.outdoorHeatingPeriodAverageC ?? sp131City?.outdoorHeatingPeriodAverageC ?? null,
      heatingDurationDays:
        sp50Climate?.heatingPeriodDurationDays ?? sp131City?.heatingPeriodDurationDays ?? null,
      source: "model",
      warnings: [],
    };
  }

  if (sp131City) {
    const fromScenarioCity = Boolean(scenarioConfig?.climateCityId?.trim());
    return {
      cityLabel: sp131City.label,
      designOutdoorC: sp131City.outdoorDesignTemperatureC,
      heatingAverageC: sp131City.outdoorHeatingPeriodAverageC,
      heatingDurationDays: sp131City.heatingPeriodDurationDays,
      source: fromScenarioCity ? "sp131" : "fallback",
      warnings: [],
    };
  }

  const fallbackCity = scenario.climateCityId ? getSp131CityClimate(scenario.climateCityId) : null;
  if (fallbackCity) {
    return {
      cityLabel: fallbackCity.label,
      designOutdoorC: fallbackCity.outdoorDesignTemperatureC,
      heatingAverageC: fallbackCity.outdoorHeatingPeriodAverageC,
      heatingDurationDays: fallbackCity.heatingPeriodDurationDays,
      source: "fallback",
      warnings: [],
    };
  }

  return {
    cityLabel: null,
    designOutdoorC: null,
    heatingAverageC: null,
    heatingDurationDays: null,
    source: "missing",
    warnings: ["Климатический профиль не задан. GSOP и нормативные климатические проверки недоступны."],
  };
}

function buildGeometrySection(model: BuildingModel): { section: SourceDataSectionReport; rooms: SourceDataGeometryRoom[] } {
  const distinctRooms = dedupeRooms(model.rooms);
  const geometryModel = distinctRooms.length === model.rooms.length ? model : { ...model, rooms: distinctRooms };
  const adjacency = buildAdjacencyGraph(geometryModel);
  const geometryWarnings: string[] = [];
  const sortedLevels = [...geometryModel.levels].sort((left, right) => left.elevation_m - right.elevation_m);
  const levelIndexById = new Map(sortedLevels.map((level, index) => [level.id, index]));
  const floorKindsByLevelId = new Map<string, Set<FloorSlab["kind"]>>();
  (geometryModel.floorSlabs ?? []).forEach((slab) => {
    const kinds = floorKindsByLevelId.get(slab.levelId) ?? new Set<FloorSlab["kind"]>();
    kinds.add(slab.kind);
    floorKindsByLevelId.set(slab.levelId, kinds);
  });
  const roofLevelIds = new Set((geometryModel.roofs ?? []).map((roof) => roof.levelId));
  const rooms: SourceDataGeometryRoom[] = geometryModel.rooms.map((room) => {
    const levelHeightM = findLevelHeightM(geometryModel, room);
    const fallbackHeightWarning =
      levelHeightM == null ? ["Высота помещения не задана, используется 3 м."] : [];
    const heightM = levelHeightM ?? 3;
    const areaM2 = roomAreaM2(room);
    const heated = inferRoomHeated();
    const floorContactType = inferRoomFloorContactType(
      room,
      levelIndexById,
      sortedLevels.length,
      floorKindsByLevelId
    );
    const roofContactType = inferRoomRoofContactType(room, levelIndexById, sortedLevels.length, roofLevelIds);
    const purpose = inferRoomPurpose(room);
    const volumeM3 = areaM2 > 0 && heightM > 0 ? areaM2 * heightM : null;
    const heightSource: SourceDataOrigin = levelHeightM != null ? "model" : "fallback";
    return {
      roomId: room.id,
      roomName: room.name,
      areaM2: field(`room:${room.id}:area`, "Площадь помещения", areaM2, "м²", "model"),
      volumeM3: field(`room:${room.id}:volume`, "Объём помещения", volumeM3, "м³", volumeM3 == null ? "missing" : "calculated"),
      heightM: field(`room:${room.id}:height`, "Высота помещения", heightM, "м", heightSource, fallbackHeightWarning),
      heated: field(`room:${room.id}:heated`, "Отапливаемое помещение", heated.value, null, heated.source, heated.warnings),
      floorContactType: field(
        `room:${room.id}:floor-contact`,
        "Контакт пола",
        floorContactType.value,
        null,
        floorContactType.source,
        floorContactType.warnings
      ),
      roofContactType: field(
        `room:${room.id}:roof-contact`,
        "Контакт кровли",
        roofContactType.value,
        null,
        roofContactType.source,
        roofContactType.warnings
      ),
      purpose: field(
        `room:${room.id}:purpose`,
        "Назначение помещения",
        purpose.value,
        null,
        purpose.source,
        purpose.warnings
      ),
    };
  });

  const heatedRooms = rooms.filter((room) => room.heated.value !== false);
  const heatedAreaM2 = heatedRooms.reduce((sum, room) => sum + ((typeof room.areaM2.value === "number" ? room.areaM2.value : 0) || 0), 0);
  const heatedVolumeM3 = heatedRooms.reduce((sum, room) => sum + ((typeof room.volumeM3.value === "number" ? room.volumeM3.value : 0) || 0), 0);
  const facadeAreaM2 = adjacency.external.reduce((sum, edge) => sum + Math.max(0, edge.area_m2), 0);
  const windowAreaM2 = resolveModelWindowAreaM2(geometryModel);
  const doorAreaM2 = resolveModelDoorAreaM2(geometryModel);
  const hasWindowArea = hasModelWindowAreaSource(geometryModel);
  const hasDoorArea = hasModelDoorAreaSource(geometryModel);
  const roofAreaTotalM2 = (geometryModel.roofs ?? []).reduce((sum, roof) => sum + roofAreaM2(roof), 0);
  const floorAreaTotalM2 = (geometryModel.floorSlabs ?? []).reduce((sum, slab) => sum + slabAreaM2(slab), 0);
  const envelopeAreaM2 =
    facadeAreaM2 +
    roofAreaTotalM2 +
    (geometryModel.floorSlabs ?? [])
      .filter((slab) => slab.kind === "ground" || slab.kind === "basement")
      .reduce((sum, slab) => sum + slabAreaM2(slab), 0);
  const compactness =
    heatedVolumeM3 > 0 && envelopeAreaM2 > 0 ? envelopeAreaM2 / heatedVolumeM3 : null;
  const wwr = facadeAreaM2 > 0 ? windowAreaM2 / facadeAreaM2 : null;

  const requirements: SourceDataRequirement[] = [
    requirement("geometry.rooms", "Помещения модели", geometryModel.rooms.length > 0, geometryModel.rooms.length > 0 ? "model" : "missing"),
    requirement("geometry.levels", "Уровни модели", geometryModel.levels.length > 0, geometryModel.levels.length > 0 ? "model" : "missing"),
    requirement(
      "geometry.heights",
      "Высоты помещений",
      rooms.every((room) => room.heightM.source !== "missing"),
      rooms.some((room) => room.heightM.source === "fallback") ? "fallback" : "model",
      rooms.some((room) => room.heightM.source === "fallback") ? ["Часть объёмов рассчитана с допущением по высоте 3 м."] : []
    ),
    requirement(
      "geometry.heated-rooms",
      "Признак отапливаемых помещений",
      rooms.length > 0,
      rooms.length > 0 ? "model" : "missing"
    ),
  ];

  if (rooms.some((room) => room.heightM.source === "fallback")) {
    geometryWarnings.push("Для части помещений объём рассчитан с высотой 3 м по умолчанию.");
  }

  const computedFields: SourceDataField[] = [
    field("geometry.floor-area", "Площадь помещений", geometryModel.rooms.reduce((sum, room) => sum + roomAreaM2(room), 0), "м²", geometryModel.rooms.length ? "calculated" : "missing"),
    field("geometry.heated-area", "Отапливаемая площадь", heatedAreaM2 || null, "м²", heatedAreaM2 > 0 ? "calculated" : "missing", heatedAreaM2 > 0 ? [] : ["Нет данных об отапливаемых помещениях."]),
    field("geometry.heated-volume", "Отапливаемый объём", heatedVolumeM3 || null, "м³", heatedVolumeM3 > 0 ? "calculated" : "missing"),
    field("geometry.facade-area", "Площадь фасадов", facadeAreaM2 || null, "м²", facadeAreaM2 > 0 ? "calculated" : "missing"),
    field("geometry.window-area", "Площадь окон", hasWindowArea ? windowAreaM2 : null, "м²", hasWindowArea ? "model" : "missing"),
    field("geometry.door-area", "Площадь дверей", hasDoorArea ? doorAreaM2 : null, "м²", hasDoorArea ? "model" : "missing"),
    field("geometry.roof-area", "Площадь кровли", roofAreaTotalM2 || null, "м²", (geometryModel.roofs ?? []).length ? "model" : "missing"),
    field("geometry.floor-slab-area", "Площадь пола/перекрытий", floorAreaTotalM2 || null, "м²", (geometryModel.floorSlabs ?? []).length ? "model" : "missing"),
    field("geometry.envelope-area", "Площадь наружной оболочки A_env", envelopeAreaM2 || null, "м²", envelopeAreaM2 > 0 ? "calculated" : "missing"),
    field("geometry.wwr", "WWR = A_win / A_facade", wwr, null, wwr != null ? "calculated" : "missing"),
    field("geometry.compactness", "K_compact = A_env / V_h", compactness, "1/м", compactness != null ? "calculated" : "missing"),
  ];

  const summary = summarizeSection("geometry", requirements);
  return {
    section: {
      id: "geometry",
      label: SECTION_LABELS.geometry,
      summary,
      requirements,
      computedFields,
      warnings: geometryWarnings,
    },
    rooms,
  };
}

function collectBridgeFragments(model: BuildingModel) {
  const fragments = model.thermalProtection?.envelope ?? [];
  const linear = fragments.flatMap((fragment) => fragment.heterogeneity?.linear ?? []);
  const point = fragments.flatMap((fragment) => fragment.heterogeneity?.point ?? []);
  return { fragments, linear, point };
}

function envelopeFragmentKind(
  constructionType: Sp50EnvelopeFragmentInput["constructionType"]
): SourceDataConstructionRow["kind"] | null {
  switch (constructionType) {
    case "wall":
      return "wall";
    case "window":
    case "lantern":
      return "window";
    case "door":
    case "gate":
      return "door";
    case "roof":
    case "covering":
      return "roof";
    case "atticFloor":
    case "floorOverBasement":
    case "floorOnGround":
      return "slab";
    default:
      return null;
  }
}

function resolveOpeningUFields(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig
): {
  windowU: number | null;
  windowUSource: SourceDataOrigin;
  windowUNotes: string[];
  doorU: number | null;
  doorUSource: SourceDataOrigin;
  doorUNotes: string[];
} {
  const modelWindowU = resolveModelWindowU_W_m2K(model);
  const modelDoorU = resolveModelDoorU_W_m2K(model);
  const scenarioWindowU = scenario.materials?.windowUValue_W_m2K ?? null;
  const scenarioDoorU = scenario.materials?.doorUValue_W_m2K ?? null;
  const windowU = modelWindowU ?? (scenarioWindowU != null && scenarioWindowU > 0 ? scenarioWindowU : null);
  const doorU = modelDoorU ?? (scenarioDoorU != null && scenarioDoorU > 0 ? scenarioDoorU : null);
  const windowUSource: SourceDataOrigin =
    modelWindowU != null
        ? "model"
      : scenarioConfig?.materials?.windowUValue_W_m2K != null && scenarioWindowU != null && scenarioWindowU > 0
        ? "user"
        : "missing";
  const doorUSource: SourceDataOrigin =
    modelDoorU != null
        ? "model"
      : scenarioConfig?.materials?.doorUValue_W_m2K != null && scenarioDoorU != null && scenarioDoorU > 0
        ? "user"
        : "missing";
  const windowUNotes =
    windowUSource === "user"
      ? ["Типовое значение для demo-проекта: уточняйте по паспорту оконного блока."]
      : windowUSource === "model"
        ? [windowEnvelopeSourceNote()]
        : [];
  const doorUNotes =
    doorUSource === "user"
      ? ["Типовое значение для demo-проекта: уточняйте по паспорту дверного блока."]
      : doorUSource === "model"
        ? ["U взято из назначенного пресета двери в геометрии модели."]
        : [];
  return { windowU, windowUSource, windowUNotes, doorU, doorUSource, doorUNotes };
}

function resolveOpeningOpticalFields(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  solarTime?: SolarTimeInput | null
): {
  windowG: number | null;
  windowGSource: SourceDataOrigin;
  shadingFactor: number | null;
  shadingFactorSource: SourceDataOrigin;
  shadingNotes: string[];
} {
  const hasWindows = model.windows.length > 0;
  const modelWindowG = resolveModelWindowGValue(model);
  const modelShadingResult = resolveModelShadingFactor(model, { solarTime });
  const modelShading = modelShadingResult.value;
  const windowG =
    modelWindowG ??
    (scenarioConfig?.materials?.windowGValue != null
      ? scenario.materials?.windowGValue ?? null
      : isCanonicalDemoProjectModel(model) && hasWindows
        ? TYPICAL_PVC_WINDOW_G_VALUE
        : null);
  const windowGSource: SourceDataOrigin =
    modelWindowG != null ? "model" : scenarioConfig?.materials?.windowGValue != null ? "user" : windowG != null ? "model" : "missing";

  const shadingFactor =
    modelShading ??
    (scenarioConfig?.materials?.shadingFactor != null
      ? scenario.materials?.shadingFactor ?? null
      : isCanonicalDemoProjectModel(model) && hasWindows
        ? TYPICAL_WINDOW_SHADING_FACTOR
        : null);
  const shadingFactorSource: SourceDataOrigin =
    modelShading != null
      ? scenarioConfig?.materials?.shadingFactor != null
        ? "user"
        : modelShadingResult.usesSolarTime
          ? "calculated"
          : "model"
      : scenarioConfig?.materials?.shadingFactor != null
        ? "user"
        : shadingFactor != null
          ? modelShadingResult.usesSolarTime
            ? "calculated"
            : "model"
          : "missing";
  const shadingNotes =
    shadingFactorSource === "model" && scenarioConfig?.materials?.shadingFactor == null
      ? modelShadingResult.notes.length
        ? modelShadingResult.notes
        : [shadingEnvelopeSourceNote()]
      : [];

  return {
    windowG,
    windowGSource,
    shadingFactor,
    shadingFactorSource,
    shadingNotes,
  };
}

function resolveConstructionRows(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  designDeltaT: number | null,
  thermalResult: ThermalSimulationResult | null | undefined,
  solarTime?: SolarTimeInput | null
): { rows: SourceDataConstructionRow[]; warnings: string[]; computedFields: SourceDataField[]; requirements: SourceDataRequirement[] } {
  const warnings: string[] = [];
  const rows: SourceDataConstructionRow[] = [];
  const openingU = resolveOpeningUFields(model, scenarioConfig, scenario);
  const openingOptical = resolveOpeningOpticalFields(model, scenarioConfig, scenario, solarTime);
  const userHomogeneityCoefficient = scenarioConfig?.materials?.homogeneityCoefficient ?? null;
  const modelHomogeneity = resolveModelHomogeneityCoefficient(model);
  const homogeneityCoefficient = userHomogeneityCoefficient ?? modelHomogeneity.value;
  const resolvedBridge = resolveBridgeAccountingMode({
    userMode: scenarioConfig?.materials?.bridgeAccountingMode ?? scenario.materials?.bridgeAccountingMode,
    userHomogeneityCoefficient,
    model,
  });
  const bridgeMode = resolvedBridge.mode;
  const bridgeModeOrigin = resolvedBridge.origin;
  const bridgeAggregates = aggregateEnvelopeBridgeConductances(model);
  const { linear, point } = collectBridgeFragments(model);
  const explicitBridgeMode = bridgeMode === "explicitPsiChi";
  const homogeneityMode = bridgeMode === "homogeneityCoefficient";
  const operationCondition = model.thermalProtection?.operationCondition ?? "A";
  const performance = thermalResult?.diagnostics?.buildingPerformance ?? null;

  const materialElements: Array<{
    id: string;
    label: string;
    kind: SourceDataConstructionRow["kind"];
    areaM2: number;
    layers: Wall["layers"];
    metadata?: Sp50EnvelopeFragmentMetadata;
  }> = (model.thermalProtection?.envelope ?? [])
    .map((fragment) => {
      const kind = envelopeFragmentKind(fragment.constructionType);
      if (!kind) {
        return null;
      }
      return {
        id: fragment.id,
        label: fragment.label,
        kind,
        areaM2: fragment.areaM2,
        layers: fragment.layers,
        metadata: fragment.metadata,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (explicitBridgeMode && userHomogeneityCoefficient != null && resolvedBridge.userMode === "explicitPsiChi") {
    warnings.push("При explicit ψ/χ ручной коэффициент r не ухудшает R_red той же конструкции.");
  }
  warnings.push(...resolvedBridge.notes);

  materialElements.forEach((element) => {
    const props = element.layers?.length
      ? computeWallProperties(element.layers, undefined, { includeSp50AirFilms: true })
      : null;
    const localWarnings: string[] = [];
    const presetRuntimeU =
      element.metadata?.runtimeU_W_m2K != null && element.metadata.runtimeU_W_m2K > 0
        ? element.metadata.runtimeU_W_m2K
        : null;
    const scenarioOverrideU =
      element.kind === "window"
        ? openingU.windowU
        : element.kind === "door"
          ? openingU.doorU
          : null;
    const overrideU = presetRuntimeU ?? scenarioOverrideU;
    const derivedU = overrideU != null && overrideU > 0 ? overrideU : props?.uTotal_W_m2K ?? null;
    const r0 = overrideU != null && overrideU > 0 ? 1 / overrideU : props?.rTotal_m2K_W ?? null;
    const fragmentFromModel = (model.thermalProtection?.envelope ?? []).find((entry) => entry.id === element.id);
    const homogeneityForElement =
      userHomogeneityCoefficient ??
      (fragmentFromModel ? resolveFragmentHomogeneityCoefficient(fragmentFromModel, r0) : null) ??
      modelHomogeneity.value ??
      1;
    const homogeneitySource: SourceDataOrigin =
      userHomogeneityCoefficient != null
        ? "user"
        : fragmentFromModel &&
            (fragmentFromModel.heterogeneity?.linear?.length ||
              fragmentFromModel.heterogeneity?.point?.length ||
              fragmentFromModel.heterogeneity?.planar?.length)
          ? "model"
          : modelHomogeneity.value != null
            ? "model"
            : "fallback";
    const rReduced =
      homogeneityMode && r0 != null ? reducedResistanceByHomogeneity(r0, homogeneityForElement) : r0;
    const transmissionU =
      homogeneityMode && isOpaqueConstructionKind(element.kind) && rReduced != null && rReduced > 0
        ? 1 / rReduced
        : derivedU;
    if (homogeneityMode && userHomogeneityCoefficient == null && homogeneityForElement === 1 && !modelHomogeneity.hasBridgeData) {
      localWarnings.push("Коэффициент однородности не задан в сценарии и в модели нет ψ/χ — принято r = 1.");
    } else if (homogeneityMode && userHomogeneityCoefficient == null && homogeneitySource === "model") {
      localWarnings.push(
        `r = ${homogeneityForElement.toFixed(3)} рассчитан из модели (ψ/χ или зоны неоднородности).`
      );
    }
    if (element.metadata?.sourceType === "preset" && element.metadata.sourceNote) {
      localWarnings.push(`Типовой пресет: ${element.metadata.sourceNote}`);
    }
    if (overrideU != null && overrideU > 0 && presetRuntimeU != null) {
      localWarnings.push(
        element.kind === "window"
          ? "Runtime и отчёт используют U типового окна из пресета конструктора."
          : element.kind === "door"
            ? "Runtime и отчёт используют U типовой двери из пресета конструктора."
            : "Используется U из типового пресета конструктора."
      );
      if (element.kind === "window") {
        localWarnings.push("Окно использует заданный проектный U окна, а не послойный U стекла.");
      }
    } else if (scenarioOverrideU != null && scenarioOverrideU > 0) {
      localWarnings.push(
        element.kind === "window"
          ? "Окно использует заданный проектный U окна, а не послойный U стекла."
          : "Дверь использует заданный проектный U двери, а не послойный U панели."
      );
    }
    const rowLayers: SourceDataLayerRow[] = (element.layers ?? []).map((layer, index) => {
      const material = getMaterial(layer.materialId);
      const normMaterial = getMaterialThermalProperties({
        materialId: layer.materialId,
        operationCondition,
      });
      const lambda = material?.lambda_W_mK ?? null;
      const thickness = Number.isFinite(layer.thickness_m) && layer.thickness_m > 0 ? layer.thickness_m : null;
      const resistance =
        thickness != null && lambda != null && lambda > 0 ? thickness / lambda : null;
      const layerWarnings =
        element.metadata?.sourceType === "preset" && element.metadata.sourceNote
          ? [`Типовой пресет: ${element.metadata.sourceNote}`]
          : normMaterial?.isApproximate
            ? [`Типовое значение: ${normMaterial.sourceNote ?? `материал ${normMaterial.label} задан эквивалентно.`}`]
            : [];
      if (layerWarnings.length) {
        localWarnings.push(...layerWarnings);
      }
      const materialSource: SourceDataOrigin =
        element.metadata?.sourceType === "preset"
          ? "model"
          : normMaterial != null
            ? normMaterial.isApproximate
              ? "fallback"
              : "sp50"
            : material
              ? "sp50"
              : "missing";
      return {
        materialId: layer.materialId,
        materialLabel: material?.name ?? layer.materialId ?? `Слой ${index + 1}`,
        thicknessM: field(`${element.id}:layer:${index}:thickness`, "Толщина", thickness, "м", thickness != null ? "model" : "missing"),
        lambda_W_mK: field(
          `${element.id}:layer:${index}:lambda`,
          "Теплопроводность λ",
          lambda,
          "Вт/(м·К)",
          lambda != null ? materialSource : "missing",
          layerWarnings
        ),
        densityKgM3: field(
          `${element.id}:layer:${index}:rho`,
          "Плотность ρ",
          material?.rho_kg_m3 ?? null,
          "кг/м³",
          material ? materialSource : "missing",
          layerWarnings
        ),
        heatCapacity_J_kgK: field(
          `${element.id}:layer:${index}:c`,
          "Теплоёмкость c",
          material?.c_J_kgK ?? null,
          "Дж/(кг·К)",
          material ? materialSource : "missing",
          layerWarnings
        ),
        resistance_m2K_W: field(
          `${element.id}:layer:${index}:r`,
          "Сопротивление слоя",
          resistance,
          "м²·К/Вт",
          resistance != null ? "calculated" : "missing",
          layerWarnings
        ),
      };
    });

    rows.push({
      id: element.id,
      label: element.label,
      kind: element.kind,
      areaM2: field(`${element.id}:area`, "Площадь", element.areaM2 || null, "м²", element.areaM2 > 0 ? "model" : "missing"),
      layerCount: field(`${element.id}:layers`, "Количество слоёв", rowLayers.length || null, null, rowLayers.length ? "model" : "missing"),
      resistanceR0_m2K_W: field(`${element.id}:r0`, "R_0", r0, "м²·К/Вт", r0 != null ? "calculated" : "missing"),
      reducedResistance_m2K_W: field(
        `${element.id}:rred`,
        "R_red",
        rReduced,
        "м²·К/Вт",
        rReduced != null
          ? homogeneityMode
            ? homogeneitySource === "fallback"
              ? "fallback"
              : "calculated"
            : "calculated"
          : "missing",
        localWarnings,
        homogeneityMode ? ["Приведённое сопротивление учитывает неоднородность конструкции."] : []
      ),
      uValue_W_m2K: field(
        `${element.id}:u`,
        "U",
        transmissionU,
        "Вт/(м²·К)",
        transmissionU != null
          ? presetRuntimeU != null
            ? "model"
            : overrideU != null && overrideU > 0
              ? "scenario"
              : "calculated"
          : "missing",
        localWarnings,
        presetRuntimeU != null
          ? ["Используется U типового пресета из конструктора."]
          : overrideU != null && overrideU > 0
            ? ["Используется U, заданный для окна/двери в исходных данных."]
            : []
      ),
      bridgeMode: field(
        `${element.id}:bridge-mode`,
        "Учёт мостиков холода",
        bridgeMode,
        null,
        bridgeModeOrigin === "user" ? "user" : "calculated",
        resolvedBridge.notes
      ),
      layers: rowLayers,
      warnings: localWarnings,
    });
  });

  const validTransmissionElements = rows
    .filter((row) => typeof row.areaM2.value === "number" && typeof row.uValue_W_m2K.value === "number")
    .map((row) => {
      const areaM2 = row.areaM2.value as number;
      const catalogU = row.uValue_W_m2K.value as number;
      const r0 = row.resistanceR0_m2K_W.value;
      const rRed = row.reducedResistance_m2K_W.value;
      const U_W_m2K =
        homogeneityMode &&
        typeof r0 === "number" &&
        typeof rRed === "number" &&
        r0 > 0 &&
        rRed > 0 &&
        isOpaqueConstructionKind(row.kind)
          ? 1 / rRed
          : catalogU;
      return {
        id: row.id,
        label: row.label,
        areaM2,
        U_W_m2K,
      };
    });
  const H_tr = validTransmissionElements.length
    ? heatLossCoefficientTransmission(validTransmissionElements)
    : null;
  const modelH_psi = bridgeAggregates.H_psi;
  const modelH_chi = bridgeAggregates.H_chi;
  const H_psi = explicitBridgeMode ? (modelH_psi ?? 0) : 0;
  const H_chi = explicitBridgeMode ? (modelH_chi ?? 0) : 0;
  const bridgeLossW =
    H_psi === 0 && H_chi === 0
      ? 0
      : designDeltaT != null
        ? thermalBridgeHeatLoss(designDeltaT, H_psi, H_chi)
        : null;
  const H_total =
    H_tr != null
      ? heatLossCoefficientTotal(H_tr, H_psi ?? 0, H_chi ?? 0)
      : null;
  const bridgeSharePercent =
    H_total != null && H_total > 0
      ? ((H_psi + H_chi) / H_total) * 100
      : H_total != null
        ? 0
        : null;
  const weightedArea = validTransmissionElements.reduce((sum, element) => sum + element.areaM2, 0);
  const U_eq =
    weightedArea > 0
      ? validTransmissionElements.reduce((sum, element) => sum + element.areaM2 * element.U_W_m2K, 0) / weightedArea
      : null;
  const Q_tr = H_tr != null && designDeltaT != null ? H_tr * designDeltaT : null;

  const requirements: SourceDataRequirement[] = [
    requirement(
      "materials.layers",
      "Слои конструкций",
      rows.some((row) => row.layers.length > 0),
      rows.some((row) => row.layers.length > 0) ? "model" : "missing"
    ),
    requirement(
      "materials.bridge-mode",
      "Способ учёта неоднородностей",
      bridgeMode !== "disabled" || bridgeModeOrigin === "user",
      bridgeModeOrigin === "user" ? "user" : bridgeMode === "disabled" ? "fallback" : "calculated",
      bridgeModeOrigin === "user" ? [] : resolvedBridge.notes
    ),
    requirement(
      "materials.homogeneity-or-bridges",
      "Данные по неоднородностям",
      bridgeMode === "disabled" ||
        (bridgeMode === "homogeneityCoefficient" &&
          ((scenarioConfig?.materials?.homogeneityCoefficient ?? null) != null || modelHomogeneity.hasBridgeData)) ||
        (bridgeMode === "explicitPsiChi" && (linear.length > 0 || point.length > 0)),
      bridgeMode === "explicitPsiChi"
        ? linear.length > 0 || point.length > 0
          ? "sp50"
          : "missing"
        : bridgeMode === "homogeneityCoefficient"
          ? (scenarioConfig?.materials?.homogeneityCoefficient ?? null) != null
            ? "user"
            : modelHomogeneity.hasBridgeData
              ? "model"
              : "calculated"
          : "calculated",
      warnings
    ),
  ];

  const computedFields: SourceDataField[] = [
    field(
      "materials.bridge-mode",
      "Режим учёта мостиков холода",
      bridgeMode,
      null,
      bridgeModeOrigin === "user" ? "user" : "calculated",
      warnings,
      resolvedBridge.notes
    ),
    field(
      "materials.homogeneity-coefficient",
      "Коэффициент однородности r",
      homogeneityCoefficient,
      null,
      userHomogeneityCoefficient != null ? "user" : modelHomogeneity.value != null ? "model" : "missing",
      [],
      modelHomogeneity.notes
    ),
    field("materials.window-u", "U окна", openingU.windowU, "Вт/(м²·К)", openingU.windowUSource, openingU.windowUNotes),
    field("materials.door-u", "U двери", openingU.doorU, "Вт/(м²·К)", openingU.doorUSource, openingU.doorUNotes),
    field("materials.window-g", "g-value окна", openingOptical.windowG, null, openingOptical.windowGSource),
    field(
      "materials.shading-factor",
      "Shading factor",
      openingOptical.shadingFactor,
      null,
      openingOptical.shadingFactorSource,
      [],
      openingOptical.shadingNotes
    ),
    field("materials.u-eq", "U_eq", performance?.equivalentUValue.value ?? U_eq, "Вт/(м²·К)", performance?.equivalentUValue.value != null || U_eq != null ? "calculated" : "missing"),
    field("materials.h-tr", "H_tr", performance?.heatLossBreakdown.H_tr.value ?? H_tr, "Вт/К", performance?.heatLossBreakdown.H_tr.value != null || H_tr != null ? "calculated" : "missing"),
    field("materials.h-total", "H_total", performance?.heatLossBreakdown.H_total.value ?? H_total, "Вт/К", performance?.heatLossBreakdown.H_total.value != null || H_total != null ? "calculated" : "missing"),
    field("materials.q-tr", "Q_tr", Q_tr, "Вт", Q_tr != null ? "calculated" : "missing"),
    field(
      "materials.h-psi",
      "H_psi",
      modelH_psi,
      "Вт/К",
      modelH_psi != null ? (bridgeAggregates.hasLinear ? "sp50" : "calculated") : "missing"
    ),
    field(
      "materials.h-chi",
      "H_chi",
      modelH_chi,
      "Вт/К",
      modelH_chi != null ? (bridgeAggregates.hasPoint ? "sp50" : "calculated") : "missing"
    ),
    field("materials.q-bridges", "Q_thermal_bridges", bridgeLossW, "Вт", bridgeLossW != null ? "calculated" : "missing"),
    field("materials.bridge-share", "Доля мостиков холода", bridgeSharePercent, "%", bridgeSharePercent != null ? "calculated" : "missing"),
  ];

  return { rows, warnings, computedFields, requirements };
}

function buildClimateSection(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel
): { section: SourceDataSectionReport; designDeltaT: number | null } {
  const climate = resolveClimateMeta(scenarioConfig, scenario, model);
  const indoor = resolveIndoorTemperatureC(scenarioConfig, scenario, model, null);
  const designDeltaT =
    climate.designOutdoorC != null && indoor.value != null ? indoor.value - climate.designOutdoorC : null;
  const gsopValue =
    indoor.value != null && climate.heatingAverageC != null && climate.heatingDurationDays != null
      ? gsop(indoor.value, climate.heatingAverageC, climate.heatingDurationDays)
      : null;

  const requirements: SourceDataRequirement[] = [
    requirement(
      "climate.profile",
      "Город / климатический профиль",
      Boolean(scenarioConfig?.climateCityId) || Boolean(climate.cityLabel),
      scenarioConfig?.climateCityId ? "sp131" : climate.cityLabel ? climate.source : "missing"
    ),
    requirement(
      "climate.heating-average",
      "Средняя температура отопительного периода",
      climate.heatingAverageC != null,
      climate.source,
      climate.warnings
    ),
    requirement(
      "climate.heating-duration",
      "Продолжительность отопительного периода",
      climate.heatingDurationDays != null,
      climate.source,
      climate.warnings
    ),
    requirement(
      "climate.design-outdoor",
      "Расчётная наружная температура",
      climate.designOutdoorC != null,
      climate.source,
      climate.warnings
    ),
    requirement(
      "climate.base-scenario",
      "Базовый температурный график сценария",
      scenarioConfig?.climate != null,
      scenarioConfig?.climate ? "scenario" : "fallback",
      scenarioConfig?.climate ? [] : ["Используются значения сценария по умолчанию."]
    ),
  ];

  const computedFields: SourceDataField[] = [
    field("climate.city", "Климатический профиль", climate.cityLabel, null, climate.cityLabel ? climate.source : "missing", climate.warnings),
    field("climate.design-outdoor", "Расчётная наружная температура", climate.designOutdoorC, "°C", climate.designOutdoorC != null ? climate.source : "missing", climate.warnings),
    field("climate.heating-average", "Средняя температура отопительного периода", climate.heatingAverageC, "°C", climate.heatingAverageC != null ? climate.source : "missing", climate.warnings),
    field("climate.heating-duration", "Длительность отопительного периода", climate.heatingDurationDays, "сут", climate.heatingDurationDays != null ? climate.source : "missing", climate.warnings),
    field("climate.baseC", "Базовая температура сценария", scenario.climate.baseC, "°C", scenarioConfig?.climate?.baseC != null ? "scenario" : "fallback"),
    field("climate.amplitude", "Амплитуда наружной температуры", scenario.climate.amplitudeC, "°C", scenarioConfig?.climate?.amplitudeC != null ? "scenario" : "fallback"),
    field("climate.offset", "Фаза / смещение графика", scenario.climate.seasonalOffsetC, "°C", scenarioConfig?.climate?.seasonalOffsetC != null ? "scenario" : "fallback"),
    field("climate.gsop", "GSOP", gsopValue, "°C·сут", gsopValue != null ? "calculated" : "missing", gsopValue == null ? climate.warnings : []),
    field("climate.deltaT", "ΔT = T_in - T_out", designDeltaT, "К", designDeltaT != null ? "calculated" : "missing"),
    field("climate.source", "Источник климатических данных", climate.source === "missing" ? null : sourceLabel(climate.source), null, climate.source, climate.warnings),
  ];

  return {
    section: {
      id: "climate",
      label: SECTION_LABELS.climate,
      summary: summarizeSection("climate", requirements),
      requirements,
      computedFields,
      warnings: climate.warnings,
    },
    designDeltaT,
  };
}

function buildOperationSection(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  thermalResult: ThermalSimulationResult | null | undefined
): SourceDataSectionReport {
  const performance = thermalResult?.diagnostics?.buildingPerformance ?? null;
  const requirements: SourceDataRequirement[] = [
    requirement("operation.setpoints", "Дневная и ночная уставка", true, scenarioConfig?.setpoints ? "scenario" : "fallback", scenarioConfig?.setpoints ? [] : ["Используются значения уставок по умолчанию."]),
    requirement("operation.gains", "Внутренние теплопоступления", true, scenarioConfig?.internalGains ? "scenario" : "fallback"),
    requirement("operation.occupancy", "Занятость", true, scenarioConfig?.occupancy ? "scenario" : "fallback"),
    requirement("operation.duration", "Длительность расчёта", true, scenarioConfig?.operation?.duration ? "user" : "fallback"),
    requirement("operation.timestep", "Шаг расчёта", true, scenarioConfig?.operation?.timestepMinutes != null ? "user" : "fallback"),
  ];
  const computedFields: SourceDataField[] = [
    field("operation.day-setpoint", "Дневная уставка", scenario.setpoints.day, "°C", scenarioConfig?.setpoints?.day != null ? "scenario" : "fallback"),
    field("operation.night-setpoint", "Ночная уставка", scenario.setpoints.night, "°C", scenarioConfig?.setpoints?.night != null ? "scenario" : "fallback"),
    field("operation.day-hours", "Дневной режим", `${scenario.setpoints.dayStartHour}:00–${scenario.setpoints.nightStartHour}:00`, null, "calculated"),
    field("operation.internal-gains-day", "Внутренние теплопоступления днём", scenario.internalGains.dayGain_W_m2, "Вт/м²", scenarioConfig?.internalGains?.dayGain_W_m2 != null ? "scenario" : "fallback"),
    field("operation.internal-gains-night", "Внутренние теплопоступления ночью", scenario.internalGains.nightGain_W_m2, "Вт/м²", scenarioConfig?.internalGains?.nightGain_W_m2 != null ? "scenario" : "fallback"),
    field("operation.occupancy-day", "Занятость днём", scenario.occupancy.dayFraction, null, scenarioConfig?.occupancy?.dayFraction != null ? "scenario" : "fallback"),
    field("operation.occupancy-night", "Занятость ночью", scenario.occupancy.nightFraction, null, scenarioConfig?.occupancy?.nightFraction != null ? "scenario" : "fallback"),
    field("operation.duration", "Длительность расчёта", scenario.operation?.duration ?? "24h", null, scenarioConfig?.operation?.duration ? "user" : "fallback"),
    field("operation.timestep", "Шаг расчёта", scenario.operation?.timestepMinutes ?? 10, "мин", scenarioConfig?.operation?.timestepMinutes != null ? "user" : "fallback"),
    field("operation.peak-load", "peakLoadKW", thermalResult?.summary.peakLoadKW ?? null, "кВт", thermalResult ? "result" : "missing"),
    field("operation.total-energy", "totalEnergyKWh", thermalResult?.summary.totalEnergyKWh ?? null, "кВт·ч", thermalResult ? "result" : "missing"),
    field(
      "operation.degree-hours-underheat",
      "DH_underheat",
      performance?.degreeHoursUnderheat.building.value ?? null,
      "°C·ч",
      performance?.degreeHoursUnderheat.building.value != null ? "result" : "missing"
    ),
    field(
      "operation.degree-hours-overheat",
      "DH_overheat",
      performance?.degreeHoursOverheat.building.value ?? null,
      "°C·ч",
      performance?.degreeHoursOverheat.building.value != null ? "result" : "missing"
    ),
    field("operation.underheating-hours", "underheatingHours", thermalResult?.summary.underheatingHours ?? null, "ч", thermalResult ? "result" : "missing"),
    field("operation.overheating-hours", "overheatingHours", thermalResult?.summary.overheatingHours ?? null, "ч", thermalResult ? "result" : "missing"),
    field("operation.total-discomfort-hours", "totalDiscomfortHours", thermalResult?.summary.totalDiscomfortHours ?? thermalResult?.summary.discomfortHours ?? null, "ч", thermalResult ? "result" : "missing"),
  ];

  return {
    id: "operation",
    label: SECTION_LABELS.operation,
    summary: summarizeSection("operation", requirements),
    requirements,
    computedFields,
    warnings: [],
  };
}

function buildAirExchangeSection(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  designDeltaT: number | null
): SourceDataSectionReport {
  const indoorTemperatureC = scenario.setpoints.day;
  const outdoorTemperatureC =
    designDeltaT != null ? indoorTemperatureC - designDeltaT : scenario.climate.baseC + scenario.climate.seasonalOffsetC;
  const infiltrationResult = resolveBuildingInfiltration(
    model,
    {
      infiltrationMode: scenario.ventilation.infiltrationMode,
      infiltrationACH: scenario.ventilation.infiltrationACH,
      envelopeLeakage: scenario.ventilation.envelopeLeakage,
      pressureBased: scenario.ventilation.pressureBased,
    },
    {
      indoorTemperatureC,
      outdoorTemperatureC,
      mechanicalVentilationACH: scenario.ventilation.mechanicalVentilationEnabled ? scenario.ventilation.ventilationACH : 0,
      mechanicalVentilationEnabled: scenario.ventilation.mechanicalVentilationEnabled,
    }
  );
  const totalVolumeM3 = infiltrationResult.geometry.heatedVolumeM3;
  const infiltrationFlowM3s = totalVolumeM3 > 0 ? infiltrationResult.airflowM3s : null;
  const ventilationFlowM3s =
    totalVolumeM3 > 0 && scenario.ventilation.mechanicalVentilationEnabled
      ? airflowFromACH(scenario.ventilation.ventilationACH, totalVolumeM3)
      : 0;
  const infiltrationLossW = infiltrationFlowM3s != null ? infiltrationResult.heatLossW : null;
  const ventilationLossBeforeW =
    ventilationFlowM3s != null && designDeltaT != null
      ? ventilationLoss(ventilationFlowM3s, AIR_DENSITY_KG_M3, AIR_HEAT_CAPACITY_J_KG_K, designDeltaT)
      : null;
  const recovery =
    ventilationFlowM3s != null && designDeltaT != null
      ? ventilationRecoveryLoss(
          ventilationFlowM3s,
          AIR_DENSITY_KG_M3,
          AIR_HEAT_CAPACITY_J_KG_K,
          designDeltaT,
          scenario.ventilation.heatRecoveryFactor
        )
      : null;
  const H_inf =
    infiltrationFlowM3s != null
      ? heatLossCoefficientVentilation(infiltrationFlowM3s, AIR_DENSITY_KG_M3, AIR_HEAT_CAPACITY_J_KG_K, 0)
      : null;
  const H_vent_before =
    ventilationFlowM3s != null
      ? heatLossCoefficientVentilation(ventilationFlowM3s, AIR_DENSITY_KG_M3, AIR_HEAT_CAPACITY_J_KG_K, 0)
      : null;
  const H_vent_after =
    ventilationFlowM3s != null
      ? heatLossCoefficientVentilation(
          ventilationFlowM3s,
          AIR_DENSITY_KG_M3,
          AIR_HEAT_CAPACITY_J_KG_K,
          scenario.ventilation.heatRecoveryFactor
        )
      : null;
  const H_total =
    H_inf != null && H_vent_after != null ? heatLossCoefficientTotal(H_inf, H_vent_after) : null;
  const warnings = [
    ...infiltrationResult.warnings,
    ...(scenario.ventilation.heatRecoveryFactor > 0
      ? ["Рекуперация применяется только к механической вентиляции. Derived-показатели не меняют RC-solver автоматически."]
      : []),
  ];
  const infiltrationFieldSource =
    infiltrationResult.diagnostics.achSource === "calculated"
      ? "calculated"
      : infiltrationResult.diagnostics.achSource === "manual"
        ? scenarioConfig?.ventilation?.infiltrationACH != null || scenarioConfig?.ventilation?.infiltrationMode != null
          ? "scenario"
          : "fallback"
        : "fallback";
  const requirements: SourceDataRequirement[] = [
    requirement("air.infiltration", "Инфильтрация ACH", true, scenarioConfig?.ventilation?.infiltrationACH != null ? "scenario" : "fallback"),
    requirement("air.ventilation", "Вентиляция ACH / механическая вентиляция", true, scenarioConfig?.ventilation?.ventilationACH != null || scenarioConfig?.ventilation?.mechanicalVentilationEnabled != null ? "scenario" : "fallback"),
    requirement("air.volume", "Отапливаемый объём для перевода ACH -> расход", totalVolumeM3 > 0, totalVolumeM3 > 0 ? "calculated" : "missing"),
  ];

  return {
    id: "airExchange",
    label: SECTION_LABELS.airExchange,
    summary: summarizeSection("airExchange", requirements),
    requirements,
    warnings,
    computedFields: [
      field("air.total-volume", "Отапливаемый объём", totalVolumeM3 || null, "м³", totalVolumeM3 > 0 ? "calculated" : "missing"),
      field("air.infiltration-mode", "Режим инфильтрации", scenario.ventilation.infiltrationMode ?? "manualAch", "", scenarioConfig?.ventilation?.infiltrationMode != null ? "scenario" : "fallback"),
      field("air.infiltration-source", "Источник ACH", infiltrationResult.diagnostics.achSource, "", infiltrationFieldSource),
      field("air.infiltration-ach", "Infiltration ACH", infiltrationResult.calculatedACH, "1/ч", infiltrationFieldSource, infiltrationResult.assumptions),
      field("air.ventilation-ach", "Ventilation ACH", scenario.ventilation.mechanicalVentilationEnabled ? scenario.ventilation.ventilationACH : 0, "1/ч", scenarioConfig?.ventilation?.ventilationACH != null ? "scenario" : "fallback"),
      field("air.infiltration-flow", "L_inf = ACH · V / 3600", infiltrationFlowM3s != null ? infiltrationFlowM3s * 3600 : null, "м³/ч", infiltrationFlowM3s != null ? "calculated" : "missing"),
      field("air.ventilation-flow", "L_vent = ACH · V / 3600", ventilationFlowM3s != null ? ventilationFlowM3s * 3600 : null, "м³/ч", ventilationFlowM3s != null ? "calculated" : "missing"),
      field("air.pressure-wind", "ΔP_wind", infiltrationResult.pressureWindPa, "Па", "calculated"),
      field("air.pressure-stack", "ΔP_stack", infiltrationResult.pressureStackPa, "Па", "calculated"),
      field("air.pressure-total", "ΔP_total", infiltrationResult.pressureTotalPa, "Па", "calculated"),
      field("air.q-inf", "Q_inf", infiltrationLossW, "Вт", infiltrationLossW != null ? "calculated" : "missing"),
      field("air.q-vent-before", "Q_vent до рекуперации", ventilationLossBeforeW, "Вт", ventilationLossBeforeW != null ? "calculated" : "missing"),
      field("air.q-vent-after", "Q_vent после рекуперации", recovery?.afterRecoveryW ?? null, "Вт", recovery ? "calculated" : "missing", warnings),
      field("air.saved-by-recovery", "savedByRecovery", recovery?.savedW ?? null, "Вт", recovery ? "calculated" : "missing", warnings),
      field("air.h-inf", "H_inf", H_inf, "Вт/К", H_inf != null ? "calculated" : "missing"),
      field("air.h-vent-before", "H_ve до рекуперации", H_vent_before, "Вт/К", H_vent_before != null ? "calculated" : "missing"),
      field("air.h-vent", "H_ve", H_vent_after, "Вт/К", H_vent_after != null ? "calculated" : "missing", warnings),
      field("air.h-total", "H_total", H_total, "Вт/К", H_total != null ? "calculated" : "missing", warnings),
    ],
  };
}

function buildHumiditySection(
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  model: BuildingModel,
  thermalResult: ThermalSimulationResult | null | undefined,
  climateSection: SourceDataSectionReport
): SourceDataSectionReport {
  const humidity = resolveHumiditySource(scenarioConfig, scenario, model);
  const indoor = resolveIndoorTemperatureC(scenarioConfig, scenario, model, thermalResult);
  const outdoorDesign = climateSection.computedFields.find((entry) => entry.key === "climate.design-outdoor")?.value;
  const outdoorDesignC = typeof outdoorDesign === "number" ? outdoorDesign : null;
  const minSurfaceFromDiagnostics = thermalResult?.diagnostics?.buildingPerformance?.surfaceTemperatureFactor.surfaces
    ?.map((entry) => entry.tau_si_C.value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right)[0] ?? null;
  const surfaceTemperatureC =
    scenarioConfig?.comfort?.measuredSurfaceTemperatureC != null
      ? scenarioConfig.comfort.measuredSurfaceTemperatureC
      : minSurfaceFromDiagnostics;
  const dewPointC =
    indoor.value != null && humidity.value != null
      ? dewPointMagnusC(indoor.value, humidity.value / 100)
      : null;
  const measuredMrtC =
    scenarioConfig?.comfort?.measuredMrtC != null && Number.isFinite(scenarioConfig.comfort.measuredMrtC)
      ? scenarioConfig.comfort.measuredMrtC
      : null;
  const mrtFromRun = estimateBuildingMeanMrtC(thermalResult);
  const mrtFromEnvelope =
    indoor.value != null && outdoorDesignC != null
      ? estimateMrtFromEnvelope(model, indoor.value, outdoorDesignC)
      : null;
  const estimatedMrtC = mrtFromRun ?? mrtFromEnvelope;
  const mrtC = measuredMrtC ?? estimatedMrtC;
  const mrtSource: SourceDataOrigin =
    measuredMrtC != null ? "user" : mrtFromRun != null ? "result" : mrtFromEnvelope != null ? "calculated" : "missing";
  const operativeTemperatureC =
    indoor.value != null && mrtC != null ? (indoor.value + mrtC) / 2 : null;
  const comfortMin = resolveComfortMinC(scenarioConfig, scenario);
  const comfortMax = resolveComfortMaxC(scenarioConfig, scenario);

  const surfaceFragment = model.thermalProtection?.envelope?.find((fragment) => fragment.layers?.length);
  const surfaceProps =
    surfaceFragment?.layers?.length
      ? computeWallProperties(surfaceFragment.layers, undefined, { includeSp50AirFilms: true })
      : null;
  const tauSiC =
    surfaceTemperatureC != null
      ? surfaceTemperatureC
      : indoor.value != null && outdoorDesignC != null && surfaceProps?.rTotal_m2K_W
        ? internalSurfaceTemperatureC(indoor.value, outdoorDesignC, surfaceProps.rSi_m2K_W || 0.13, surfaceProps.rTotal_m2K_W)
        : null;
  const condensationMarginC =
    tauSiC != null && dewPointC != null ? tauSiC - dewPointC : null;
  const condensationStatus =
    condensationMarginC == null ? null : condensationMarginC <= 0 ? "condensation_risk" : condensationMarginC < 2 ? "cold_surface" : "normal";
  const requirements: SourceDataRequirement[] = [
    requirement("humidity.rh", "Относительная влажность", humidity.value != null, humidity.source, humidity.warnings),
    requirement("humidity.comfort-limits", "Границы комфортной температуры", true, scenarioConfig?.comfort ? "user" : "fallback"),
    requirement("humidity.surface-temp", "Температура внутренней поверхности / τ_si", tauSiC != null, tauSiC != null ? (scenarioConfig?.comfort?.measuredSurfaceTemperatureC != null ? "user" : minSurfaceFromDiagnostics != null ? "result" : surfaceProps ? "calculated" : "missing") : "missing"),
  ];
  const warnings = [...humidity.warnings];
  if (mrtC == null) {
    warnings.push("MRT не задана. Назначьте слои ограждения, запустите расчёт или укажите измеренную MRT.");
  } else if (measuredMrtC == null && mrtFromRun != null) {
    warnings.push("MRT оценена по результатам расчёта (среднее по зонам).");
  } else if (measuredMrtC == null && mrtFromEnvelope != null) {
    warnings.push("MRT оценена по τ_si ограждений при расчётном ΔT (до прогона).");
  }
  return {
    id: "humidity",
    label: SECTION_LABELS.humidity,
    summary: summarizeSection("humidity", requirements),
    requirements,
    warnings,
    computedFields: [
      field("humidity.dew-point", "Точка росы", dewPointC, "°C", dewPointC != null ? "calculated" : "missing", humidity.warnings),
      field("humidity.surface-temp", "Минимальная температура внутренней поверхности", tauSiC, "°C", tauSiC != null ? (scenarioConfig?.comfort?.measuredSurfaceTemperatureC != null ? "user" : minSurfaceFromDiagnostics != null ? "result" : "calculated") : "missing"),
      field("humidity.f-rsi", "f_Rsi", tauSiC != null && indoor.value != null && outdoorDesignC != null && Math.abs(indoor.value - outdoorDesignC) > 1e-6 ? (tauSiC - outdoorDesignC) / (indoor.value - outdoorDesignC) : null, null, tauSiC != null ? "calculated" : "missing"),
      field("humidity.condensation-margin", "Запас до точки росы", condensationMarginC, "°C", condensationMarginC != null ? "calculated" : "missing"),
      field("humidity.condensation-status", "Статус поверхности", condensationStatus, null, condensationStatus != null ? "calculated" : "missing"),
      field(
        "humidity.comfort-min",
        "Минимально допустимая температура",
        comfortMin.value,
        "°C",
        comfortBoundsOrigin(comfortMin.source)
      ),
      field(
        "humidity.comfort-max",
        "Максимально допустимая температура",
        comfortMax.value,
        "°C",
        comfortBoundsOrigin(comfortMax.source)
      ),
      field(
        "humidity.mrt",
        "Средняя радиационная температура",
        mrtC,
        "°C",
        mrtSource,
        measuredMrtC == null && mrtFromEnvelope != null && mrtFromRun == null
          ? ["Оценка по ограждению до прогона."]
          : measuredMrtC == null && mrtFromRun != null
            ? ["Оценка по зонам после прогона."]
            : []
      ),
      field("humidity.t-op", "T_op = (T_air + T_mrt) / 2", operativeTemperatureC, "°C", operativeTemperatureC != null ? "calculated" : "missing", mrtC == null ? ["Без MRT оперативная температура не рассчитывается."] : []),
    ],
  };
}

function fluidProps(
  fluidType: NonNullable<ScenarioConfig["engineeringSystems"]>["fluidType"] | undefined
): {
  density: number;
  cp: number;
  warnings: string[];
} {
  if (fluidType === "glycol") {
    return {
      density: GLYCOL_DENSITY_KG_M3,
      cp: GLYCOL_HEAT_CAPACITY_J_KG_K,
      warnings: ["Используются справочные свойства водно-гликолевой смеси."],
    };
  }
  return {
    density: WATER_DENSITY_KG_M3,
    cp: WATER_HEAT_CAPACITY_J_KG_K,
    warnings: fluidType === "other" ? ["Используются свойства воды по умолчанию для неизвестного теплоносителя."] : [],
  };
}

function engineeringInputOrigin(source: EngineeringInputSource): SourceDataOrigin {
  switch (source) {
    case "user":
      return "user";
    case "model":
      return "model";
    case "result":
      return "result";
    case "calculated":
      return "calculated";
    default:
      return "fallback";
  }
}

function buildEngineeringSection(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  thermalResult: ThermalSimulationResult | null | undefined
): SourceDataSectionReport {
  const modelSummary = summarizeModelEngineering(model);
  const totalPipeLengthM = modelSummary.totalPipeLengthM;
  const diameters = Array.from(
    new Set(
      model.pipes
        .map((pipe) => pipe.diameter_mm)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
        .sort((left, right) => left - right)
    )
  );
  const insulatedPipeCount = model.pipes.filter((pipe) => (pipe.insulationThickness_mm ?? 0) > 0).length;
  const requiredPowerW = thermalResult?.summary.peakLoadKW != null ? thermalResult.summary.peakLoadKW * 1000 : null;
  const provisionalDeltaT =
    scenario.engineeringSystems?.supplyTemperatureC != null &&
    scenario.engineeringSystems?.returnTemperatureC != null
      ? scenario.engineeringSystems.supplyTemperatureC - scenario.engineeringSystems.returnTemperatureC
      : 20;
  const provisionalRequiredMassFlowKgS =
    requiredPowerW != null && provisionalDeltaT > 0
      ? calculateRequiredHydronicMassFlow(requiredPowerW, provisionalDeltaT, fluidProps("water").cp)
      : null;
  const resolved = resolveScenarioEngineeringInputs(
    scenarioConfig,
    scenario,
    model,
    thermalResult,
    provisionalRequiredMassFlowKgS
  );
  const fluid = fluidProps(resolved.fluidType);
  const hydronic = calculateHydronicHeatPower({
    massFlowKgS: resolved.massFlowKgS.value,
    supplyTemperatureC: resolved.supplyTemperatureC.value,
    returnTemperatureC: resolved.returnTemperatureC.value,
    fluidDensityKgM3: fluid.density,
    fluidHeatCapacityJkgK: fluid.cp,
    maxPowerW: resolved.installedCapacityW.value,
  });
  const requiredMassFlowKgS =
    requiredPowerW != null && hydronic.deltaT != null && hydronic.deltaT > 0
      ? calculateRequiredHydronicMassFlow(requiredPowerW, hydronic.deltaT, fluid.cp)
      : null;
  const requiredVolumeFlowM3H =
    requiredPowerW != null && hydronic.deltaT != null && hydronic.deltaT > 0
      ? calculateRequiredHydronicVolumeFlowM3H(requiredPowerW, hydronic.deltaT, fluid.density, fluid.cp)
      : null;
  const installedCapacityW = resolved.installedCapacityW.value;
  const capacityLimited = scenario.engineeringSystems?.heatingMode === "capacityLimited";

  const requirements: SourceDataRequirement[] = [
    requirement("engineering.heating-enabled", "Наличие системы отопления", true, scenarioConfig?.engineeringSystems?.heatingEnabled != null ? "user" : "fallback"),
    requirement("engineering.heating-mode", "Режим отопления", true, scenarioConfig?.engineeringSystems?.heatingMode ? "user" : "fallback"),
    requirement(
      "engineering.capacity",
      "Установленная мощность",
      !capacityLimited || installedCapacityW > 0,
      !capacityLimited
        ? "calculated"
        : resolved.installedCapacityW.explicit
          ? "user"
          : resolved.installedCapacityW.source === "model" || resolved.installedCapacityW.source === "result"
            ? engineeringInputOrigin(resolved.installedCapacityW.source)
            : "missing",
      capacityLimited && installedCapacityW <= 0
        ? ["Для режима capacityLimited требуется установленная мощность (модель, сценарий или пик нагрузки)."]
        : []
    ),
  ];

  const autoFillNotes: string[] = [];
  if (!resolved.supplyTemperatureC.explicit && resolved.supplyTemperatureC.source !== "fallback") {
    autoFillNotes.push("Температура подачи подставлена из оборудования или труб модели.");
  }
  if (!resolved.returnTemperatureC.explicit && resolved.returnTemperatureC.source === "calculated") {
    autoFillNotes.push("Температура обратки рассчитана как T_подачи − 20 K.");
  }
  if (!resolved.massFlowKgS.explicit && resolved.massFlowKgS.source !== "fallback") {
    autoFillNotes.push("Массовый расход подставлен из оборудования или требуемого расхода по пику нагрузки.");
  }
  if (!resolved.installedCapacityW.explicit && resolved.installedCapacityW.source !== "fallback") {
    autoFillNotes.push("Установленная мощность подставлена из оборудования модели или пика нагрузки.");
  }

  const warnings = [
    ...(scenario.engineeringSystems?.heatingMode === "ideal"
      ? ["Режим ideal остаётся режимом solver по умолчанию: требуемая мощность не ограничивается."] : []),
    ...autoFillNotes,
    ...fluid.warnings,
    ...hydronic.warnings,
    ...(requiredPowerW != null && installedCapacityW > 0 && requiredPowerW > installedCapacityW
      ? ["Пиковая нагрузка превышает установленную мощность — рассмотрите режим capacityLimited или увеличьте мощность."]
      : []),
  ];

  return {
    id: "engineeringNetworks",
    label: SECTION_LABELS.engineeringNetworks,
    summary: summarizeSection("engineeringNetworks", requirements),
    requirements,
    warnings,
    computedFields: [
      field("engineering.heating-enabled", "Система отопления", scenario.engineeringSystems?.heatingEnabled ?? true, null, scenarioConfig?.engineeringSystems?.heatingEnabled != null ? "user" : "fallback"),
      field("engineering.heating-mode", "Режим отопления", scenario.engineeringSystems?.heatingMode ?? "ideal", null, scenarioConfig?.engineeringSystems?.heatingMode ? "user" : "fallback", scenario.engineeringSystems?.heatingMode === "ideal" ? ["ideal = требуемая мощность без ограничения."] : ["capacityLimited = расчёт с ограниченной доступной мощностью."]),
      field("engineering.supply-temp", "Температура подачи", resolved.supplyTemperatureC.value, "°C", engineeringInputOrigin(resolved.supplyTemperatureC.source)),
      field("engineering.return-temp", "Температура обратки", resolved.returnTemperatureC.value, "°C", engineeringInputOrigin(resolved.returnTemperatureC.source)),
      field(
        "engineering.heat-carrier",
        "Теплоноситель",
        resolved.fluidType,
        null,
        engineeringInputOrigin(resolved.fluidTypeSource)
      ),
      field("engineering.delta-t", "ΔT теплоносителя", hydronic.deltaT, "К", hydronic.deltaT != null ? "calculated" : "missing", hydronic.warnings),
      field("engineering.mass-flow", "Заданный массовый расход", hydronic.massFlowKgS, "кг/с", hydronic.massFlowKgS != null ? engineeringInputOrigin(resolved.massFlowKgS.source) : "missing", hydronic.warnings),
      field("engineering.hydronic-capacity", "Q_hyd", hydronic.availablePowerW, "Вт", hydronic.availablePowerW != null ? "calculated" : "missing", ["Гидравлическая мощность рассчитана справочно и не ограничивает RC-solver без отдельного режима.", ...hydronic.warnings]),
      field("engineering.required-mass-flow", "Требуемый расход теплоносителя", requiredMassFlowKgS, "кг/с", requiredMassFlowKgS != null ? "calculated" : "missing"),
      field("engineering.required-volume-flow", "Требуемый объёмный расход", requiredVolumeFlowM3H, "м³/ч", requiredVolumeFlowM3H != null ? "calculated" : "missing"),
      field("engineering.installed-capacity", "Установленная мощность", installedCapacityW || null, "Вт", engineeringInputOrigin(resolved.installedCapacityW.source)),
      field("engineering.pipe-count", "Количество трубных участков", model.pipes.length || null, null, model.pipes.length ? "model" : "missing"),
      field("engineering.pipe-total-length", "Суммарная длина труб", totalPipeLengthM || null, "м", totalPipeLengthM > 0 ? "model" : "missing"),
      field(
        "engineering.pipe-diameter",
        "Диаметры труб",
        diameters.length ? (diameters.length === 1 ? String(diameters[0]) : `${diameters[0]}–${diameters[diameters.length - 1]}`) : null,
        "мм",
        diameters.length ? "model" : "missing"
      ),
      field(
        "engineering.pipe-insulation",
        "Теплоизоляция труб",
        model.pipes.length ? `${insulatedPipeCount}/${model.pipes.length}` : null,
        null,
        model.pipes.length ? "model" : "missing"
      ),
      field("engineering.peak-unmet-load", "peakUnmetLoadKW", thermalResult?.summary.peakUnmetLoadKW ?? null, "кВт", thermalResult ? "result" : "missing"),
      field("engineering.unmet-energy", "unmetEnergyKWh", thermalResult?.summary.unmetEnergyKWh ?? null, "кВт·ч", thermalResult ? "result" : "missing"),
    ],
  };
}

function buildEcologySection(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  thermalResult: ThermalSimulationResult | null | undefined
): SourceDataSectionReport {
  const emissionFactor = scenario.ecology?.emissionFactorKgPerKWh ?? null;
  const energyKWh = thermalResult?.summary.totalEnergyKWh ?? null;
  const co2Kg =
    emissionFactor != null && energyKWh != null ? emissionFactor * energyKWh : null;
  const isDemoProject = isCanonicalDemoProjectModel(model);
  const requirements: SourceDataRequirement[] = [
    requirement("ecology.energy-source", "Источник энергии", Boolean(scenarioConfig?.ecology?.energySource), scenarioConfig?.ecology?.energySource ? "user" : "missing"),
    requirement("ecology.ef", "Emission factor", emissionFactor != null, emissionFactor != null ? "user" : "missing"),
  ];
  return {
    id: "ecology",
    label: SECTION_LABELS.ecology,
    summary: summarizeSection("ecology", requirements),
    requirements,
    warnings:
      emissionFactor == null
        ? [
            "Emission factor не задан, CO₂ не рассчитывается.",
            ...(isDemoProject ? ["Для demo-проекта источник энергии показан, но EF оставлен как «нет данных» до подтверждения проверяемым источником."] : []),
          ]
        : isDemoProject
          ? ["EF для demo-проекта должен быть явно подтвержден источником или помечен как типовое значение."]
          : [],
    computedFields: [
      field("ecology.energy-source", "Источник энергии", scenario.ecology?.energySource ?? null, null, scenarioConfig?.ecology?.energySource ? "user" : "missing"),
      field("ecology.ef", "Emission factor", emissionFactor, "кг CO₂/кВт·ч", emissionFactor != null ? "user" : "missing"),
      field("ecology.energy", "Энергия расчётного периода", energyKWh, "кВт·ч", energyKWh != null ? "result" : "missing"),
      field("ecology.co2-kg", "CO₂", co2Kg, "кг", co2Kg != null ? "calculated" : "missing", emissionFactor == null ? ["Без emission factor выбросы не вычисляются."] : []),
      field("ecology.co2-tonnes", "CO₂", co2Kg != null ? co2Kg / 1000 : null, "т", co2Kg != null ? "calculated" : "missing", emissionFactor == null ? ["Без emission factor выбросы не вычисляются."] : []),
    ],
  };
}

function buildEconomySection(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig | null | undefined,
  scenario: ScenarioConfig,
  thermalResult: ThermalSimulationResult | null | undefined
): SourceDataSectionReport {
  const periodDays = scenario.operation?.duration === "7d" ? 7 : 1;
  const periodEnergyKWh = thermalResult?.summary.totalEnergyKWh ?? null;
  const annualizedEnergyKWh =
    periodEnergyKWh != null && periodDays > 0 ? (periodEnergyKWh / periodDays) * 365 : null;
  const resolvedTariff = resolveScenarioEnergyTariff(scenario, model);
  const tariff = resolvedTariff.tariffRubPerKWh;
  const annualCostRub =
    annualizedEnergyKWh != null ? tariff * annualizedEnergyKWh : null;
  const requirements: SourceDataRequirement[] = [
    requirement("economy.tariff", "Тариф", true, scenario.climateCityId ? "sp131" : "fallback"),
    requirement("economy.capex", "CAPEX мероприятий", (scenario.economy?.capexRub ?? null) != null, (scenario.economy?.capexRub ?? null) != null ? "user" : "missing", [], false),
    requirement("economy.discount", "Ставка дисконтирования", true, scenarioConfig?.economy?.discountRatePercent != null ? "user" : "fallback"),
  ];
  const warnings: string[] = [];
  const tariffUnit =
    resolvedTariff.heatingEnergySource === "electricity" ? "руб/кВт·ч" : "руб/кВт·ч (из руб/Гкал)";
  return {
    id: "economy",
    label: SECTION_LABELS.economy,
    summary: summarizeSection("economy", requirements),
    requirements,
    warnings,
    computedFields: [
      field(
        "economy.heating-source",
        "Способ отопления",
        resolvedTariff.heatingEnergySourceLabel,
        null,
        scenario.ecology?.energySource ? "scenario" : model.pipes.length > 0 ? "model" : "fallback"
      ),
      field(
        "economy.tariff",
        "Тариф",
        tariff,
        tariffUnit,
        scenario.climateCityId ? "sp131" : "fallback"
      ),
      field("economy.capex", "CAPEX", scenario.economy?.capexRub ?? null, "руб", scenarioConfig?.economy?.capexRub != null ? "user" : "missing"),
      field("economy.analysis-period", "Период анализа", scenario.economy?.analysisPeriodYears ?? null, "лет", scenarioConfig?.economy?.analysisPeriodYears != null ? "user" : "fallback"),
      field("economy.discount", "Ставка дисконтирования", scenario.economy?.discountRatePercent ?? null, "%", scenarioConfig?.economy?.discountRatePercent != null ? "user" : "fallback"),
      field("economy.tariff-growth", "Рост тарифа", scenario.economy?.annualTariffGrowthPercent ?? null, "%", scenarioConfig?.economy?.annualTariffGrowthPercent != null ? "user" : "fallback"),
      field("economy.maintenance", "Стоимость обслуживания", scenario.economy?.annualMaintenanceCostRub ?? null, "руб/год", scenarioConfig?.economy?.annualMaintenanceCostRub != null ? "user" : "missing"),
      field("economy.annualized-energy", "Annualized energy", annualizedEnergyKWh, "кВт·ч/год", annualizedEnergyKWh != null ? "calculated" : "missing"),
      field("economy.annual-cost", "Annual cost", annualCostRub, "руб/год", annualCostRub != null ? "calculated" : "missing"),
    ],
  };
}

function buildValidationSection(
  model: BuildingModel,
  scenario: ScenarioConfig,
  thermalResult: ThermalSimulationResult | null | undefined
): SourceDataSectionReport {
  const validation = scenario.validation;
  const explicitUnavailable =
    validation?.availabilityStatus === "unavailable" ||
    validation?.dataOrigin === "synthetic" ||
    model.meta?.validationStatus === "unavailable";
  if (explicitUnavailable) {
    const warning =
      validation?.note ??
      "В текущем demo-проекте нет реальных измерений: validation = unavailable, MBE/CVRMSE/RMSE не интерпретируются как фактическая верификация.";
    const requirements: SourceDataRequirement[] = [
      requirement("validation.status", "Статус валидации", true, "scenario", [warning]),
    ];
    return {
      id: "validation",
      label: SECTION_LABELS.validation,
      summary: summarizeSection("validation", requirements),
      requirements,
      warnings: [warning],
      computedFields: [
        field("validation.status", "Статус валидации", "unavailable", null, "scenario", [warning]),
        field(
          "validation.origin",
          "Источник данных",
          validation?.dataOrigin ?? "synthetic",
          null,
          "scenario",
          ["Synthetic/demo sensors не выдаются за реальные измерения."]
        ),
        field("validation.series-count", "Количество точек измерений", null, null, "missing", [warning]),
        field("validation.period", "Период измерений", validation?.periodLabel ?? "нет данных", null, "scenario", [warning]),
        field("validation.measured-energy", "Фактическое потребление энергии", null, "кВт·ч", "missing", [warning]),
        field("validation.mbe", "MBE", null, "%", "missing", [warning]),
        field("validation.cvrmse", "CVRMSE", null, "%", "missing", [warning]),
        field("validation.rmse", "RMSE_T", null, "°C", "missing", [warning]),
      ],
    };
  }
  const selectedRoomId = validation?.roomId ?? null;
  const roomExists = selectedRoomId ? model.rooms.some((room) => room.id === selectedRoomId) : false;
  const measuredSeries = validation?.measuredSeries ?? [];
  const parsedSeries = measuredSeries
    .map((entry) => {
      const timestamp = parseTimestamp(entry.timestamp);
      return timestamp == null || !Number.isFinite(entry.valueC)
        ? null
        : { timestamp, value: entry.valueC };
    })
    .filter((entry): entry is { timestamp: number; value: number } => entry !== null)
    .sort((left, right) => left.timestamp - right.timestamp);

  const simulationRoom = selectedRoomId ? thermalResult?.rooms[selectedRoomId] ?? null : null;
  const simulationTimeline = simulationRoom?.timeline ?? [];
  const simulationStepHours =
    simulationTimeline.length >= 2 ? simulationTimeline[1].timeHours - simulationTimeline[0].timeHours : null;
  const firstTimestamp = parsedSeries[0]?.timestamp ?? null;
  const alignedMeasured = parsedSeries.flatMap((entry) => {
    if (firstTimestamp == null || simulationStepHours == null || simulationStepHours <= 0) {
      return [];
    }
    const elapsedHours = (entry.timestamp - firstTimestamp) / 3_600_000;
    const nearest = simulationTimeline.reduce<{ distance: number; value: number } | null>((best, point) => {
      const distance = Math.abs(point.timeHours - elapsedHours);
      if (distance > Math.max(0.3, simulationStepHours * 0.6)) {
        return best;
      }
      if (!best || distance < best.distance) {
        return { distance, value: point.temperatureC };
      }
      return best;
    }, null);
    return nearest ? [{ measured: entry.value, simulated: nearest.value }] : [];
  });

  const validationMetrics =
    roomExists && alignedMeasured.length >= 3
      ? calculateValidationMetrics(
          alignedMeasured.map((entry) => ({ value: entry.measured })),
          alignedMeasured.map((entry) => ({ value: entry.simulated }))
        )
      : null;
  const warnings: string[] = [];
  if (!selectedRoomId) {
    warnings.push("Не выбран roomId для валидации.");
  } else if (!roomExists) {
    warnings.push("Выбранный roomId не найден в текущей модели.");
  } else if (!thermalResult) {
    warnings.push("Нет актуального результата расчёта для сопоставления с измерениями.");
  } else if (parsedSeries.length < 3) {
    warnings.push("Для валидации требуется не менее трёх измерений с timestamp.");
  } else if (alignedMeasured.length < 3) {
    warnings.push("Measured timestamps не удалось корректно сопоставить с timeline расчёта.");
  }

  const requirements: SourceDataRequirement[] = [
    requirement("validation.room", "Связь sensor/roomId", roomExists, roomExists ? "user" : "missing", warnings),
    requirement("validation.series", "История датчика температуры", parsedSeries.length >= 3, parsedSeries.length >= 3 ? "user" : "missing", warnings),
    requirement("validation.result", "Актуальный расчёт для сравнения", Boolean(thermalResult), thermalResult ? "result" : "missing", warnings),
  ];

  return {
    id: "validation",
    label: SECTION_LABELS.validation,
    summary: summarizeSection("validation", requirements),
    requirements,
    warnings,
    computedFields: [
      field("validation.room", "Комната датчика", selectedRoomId, null, selectedRoomId ? (roomExists ? "user" : "missing") : "missing", warnings),
      field("validation.series-count", "Количество точек измерений", parsedSeries.length || null, null, parsedSeries.length ? "user" : "missing"),
      field("validation.period", "Период измерений", validation?.periodLabel ?? null, null, validation?.periodLabel ? "user" : "missing"),
      field("validation.measured-energy", "Фактическое потребление энергии", validation?.measuredEnergyKWh ?? null, "кВт·ч", validation?.measuredEnergyKWh != null ? "user" : "missing"),
      field("validation.mbe", "MBE", validationMetrics?.MBE_percent.value ?? null, "%", validationMetrics ? "calculated" : "missing", warnings),
      field("validation.cvrmse", "CVRMSE", validationMetrics?.CVRMSE_percent.value ?? null, "%", validationMetrics ? "calculated" : "missing", warnings),
      field("validation.rmse", "RMSE_T", validationMetrics?.RMSE_T_C.value ?? null, "°C", validationMetrics ? "calculated" : "missing", warnings),
      field("validation.status", "Статус валидации", validationMetrics?.status ?? null, null, validationMetrics ? "calculated" : "missing", warnings),
    ],
  };
}

function buildReportsSection(reportInputs: SourceDataReportMetadataInput | null | undefined): SourceDataSectionReport {
  const inputs = reportInputs ?? {};
  const requirements: SourceDataRequirement[] = [
    requirement("reports.project-name", "Название объекта", hasText(inputs.projectName), hasText(inputs.projectName) ? "user" : "missing"),
    requirement("reports.address", "Адрес", hasText(inputs.objectAddress), hasText(inputs.objectAddress) ? "user" : "missing"),
    requirement("reports.customer", "Заказчик", hasText(inputs.customerOrg), hasText(inputs.customerOrg) ? "user" : "missing"),
    requirement("reports.developer", "Проектировщик", hasText(inputs.developerOrg), hasText(inputs.developerOrg) ? "user" : "missing"),
    requirement("reports.stage", "Стадия", hasText(inputs.documentStage), hasText(inputs.documentStage) ? "user" : "missing"),
    requirement("reports.year", "Дата / год", hasText(inputs.issueYear), hasText(inputs.issueYear) ? "user" : "missing"),
  ];
  return {
    id: "reports",
    label: SECTION_LABELS.reports,
    summary: summarizeSection("reports", requirements),
    requirements,
    warnings: [],
    computedFields: [
      field("reports.project-name", "Название объекта", inputs.projectName ?? null, null, hasText(inputs.projectName) ? "user" : "missing"),
      field("reports.address", "Адрес", inputs.objectAddress ?? null, null, hasText(inputs.objectAddress) ? "user" : "missing"),
      field("reports.customer", "Заказчик", inputs.customerOrg ?? null, null, hasText(inputs.customerOrg) ? "user" : "missing"),
      field("reports.developer", "Проектировщик", inputs.developerOrg ?? null, null, hasText(inputs.developerOrg) ? "user" : "missing"),
      field("reports.stage", "Стадия", inputs.documentStage ?? null, null, hasText(inputs.documentStage) ? "user" : "missing"),
      field("reports.year", "Год выпуска", inputs.issueYear ?? null, null, hasText(inputs.issueYear) ? "user" : "missing"),
      field("reports.design-basis", "Нормативная база / основание", inputs.designBasis ?? null, null, hasText(inputs.designBasis) ? "user" : "missing"),
      field("reports.responsibles", "Ответственные лица", [inputs.developedBy, inputs.checkedBy, inputs.chiefEngineer].filter(hasText).join(", ") || null, null, [inputs.developedBy, inputs.checkedBy, inputs.chiefEngineer].some(hasText) ? "user" : "missing"),
      field("reports.model-note", "Пояснения / допущения", inputs.modelNote ?? null, null, hasText(inputs.modelNote) ? "user" : "missing"),
    ],
  };
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Синхронизирует envelope, ψ/χ и климат для отчёта «Данные для расчёта» (без записи в build-store). */
export function prepareModelForSourceData(
  model: BuildingModel,
  scenarioConfig?: ScenarioConfig | null
): BuildingModel {
  let next = syncAndEnrichThermalProtection(model);
  next = ensureModelClimate(next, scenarioConfig);
  return next;
}

export function buildSourceDataWorkspaceReport(
  input: BuildSourceDataWorkspaceReportInput
): SourceDataWorkspaceReport {
  const model = applyDefaultOpeningEnvelopeToModel(
    prepareModelForSourceData(input.model, input.scenarioConfig)
  );
  const scenario = resolveScenarioConfig(input.scenarioConfig ?? null);
  const geometry = buildGeometrySection(model);
  const climate = buildClimateSection(input.scenarioConfig, scenario, model);
  const materials = resolveConstructionRows(
    model,
    input.scenarioConfig,
    scenario,
    climate.designDeltaT,
    input.thermalResult,
    input.solarTime
  );
  const operation = buildOperationSection(input.scenarioConfig, scenario, input.thermalResult);
  const airExchange = buildAirExchangeSection(model, input.scenarioConfig, scenario, climate.designDeltaT);
  const humidity = buildHumiditySection(input.scenarioConfig, scenario, model, input.thermalResult, climate.section);
  const engineeringNetworks = buildEngineeringSection(model, input.scenarioConfig, scenario, input.thermalResult);
  const ecology = buildEcologySection(model, input.scenarioConfig, scenario, input.thermalResult);
  const economy = buildEconomySection(model, input.scenarioConfig, scenario, input.thermalResult);
  const validation = buildValidationSection(model, scenario, input.thermalResult);
  const reports = buildReportsSection(input.reportInputs);

  const sections: Record<SourceDataSectionId, SourceDataSectionReport> = {
    geometry: geometry.section,
    materials: {
      id: "materials",
      label: SECTION_LABELS.materials,
      summary: summarizeSection("materials", materials.requirements),
      requirements: materials.requirements,
      computedFields: materials.computedFields,
      warnings: materials.warnings,
    },
    climate: climate.section,
    operation,
    airExchange,
    humidity,
    engineeringNetworks,
    ecology,
    economy,
    validation,
    reports,
  };

  const summaryCards = (Object.keys(sections) as SourceDataSectionId[]).map((key) => sections[key].summary);
  const reportWarnings = Array.from(
    new Set(
      (Object.keys(sections) as SourceDataSectionId[]).flatMap((key) => [
        ...sections[key].warnings,
        ...sections[key].computedFields.flatMap((entry) => entry.warnings),
        ...sections[key].requirements.flatMap((entry) => entry.warnings),
      ])
    )
  );

  return {
    summaryCards,
    sections,
    geometryRooms: geometry.rooms,
    constructions: materials.rows,
    reportWarnings,
  };
}
