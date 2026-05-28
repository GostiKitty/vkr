import type {
  BuildingEvent,
  DuctNetwork,
  Equipment,
  OperationalScenario,
  PipeNetwork,
  SensorDevice,
} from "../networks/types";
import type { EngineeringSystemsModel } from "../engineering/types";
import { createEmptyEngineeringSystems } from "../engineering/types";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Level {
  id: string;
  name: string;
  elevation_m: number;
  height_m: number;
}

export type RoomSource = "manual" | "auto";

export interface Room {
  id: string;
  name: string;
  levelId: string;
  polygon: Vec2[];
  source?: RoomSource;
}

export interface EnvelopePresetMetadata {
  presetId?: string;
  presetLabel?: string;
  sourceNote?: string;
  sourceType?: "preset" | "manual";
  /** Явный U для runtime-контура (окна/двери). */
  runtimeU_W_m2K?: number;
}

export type Sp50EnvelopeFragmentMetadata = EnvelopePresetMetadata;

export interface Wall {
  id: string;
  levelId: string;
  a: Vec2;
  b: Vec2;
  thickness_m: number;
  height_m: number;
  wallAssemblyId?: string;
  envelopePresetId?: string;
  layers?: WallLayer[];
}

export interface WallLayer {
  materialId: string;
  thickness_m: number;
}

export type ConstructionLayer = WallLayer;

export interface Roof {
  id: string;
  levelId: string;
  name: string;
  kind: "flat" | "pitched";
  boundary: Vec2[];
  elevationBase_m: number;
  thickness_m: number;
  slope?: { directionDeg: number; risePerMeter: number };
  layers?: ConstructionLayer[];
  assemblyId?: string | null;
  envelopePresetId?: string;
  heatedSide?: "below" | "above";
}

export interface FloorSlab {
  id: string;
  levelId: string;
  name: string;
  kind: "interfloor" | "attic" | "basement" | "ground";
  boundary: Vec2[];
  elevation_m: number;
  thickness_m: number;
  layers?: ConstructionLayer[];
  assemblyId?: string | null;
  envelopePresetId?: string;
  heatedSide?: "below" | "above";
}

export interface EnvelopeSurface {
  id: string;
  sourceType: "wall" | "roof" | "slab" | "window" | "door";
  sourceId: string;
  constructionType: Sp50ConstructionType;
  area_m2: number;
  levelId: string;
  layers: ConstructionLayer[];
  metadata: Record<string, unknown>;
}

export interface WallAnchor {
  wallId: string | null;
  /**
   * Нормированное положение вдоль стены (0 — начало, 1 — конец).
   */
  t: number;
  /**
   * Линейное смещение вдоль стены (м).
   */
  offset_m: number;
}

export interface OpeningBase {
  id: string;
  anchor: WallAnchor;
  width_m: number;
  height_m: number;
  sill_m?: number;
  envelopePresetId?: string;
  /** Явный U для runtime-расчёта (гибридная модель проёмов). */
  runtimeU_W_m2K?: number;
  /** Эквивалентные слои для отчётов и раздела «Данные». */
  reportLayers?: ConstructionLayer[];
  /**
   * true — стена-носитель удалена и проём требует перепривязки.
   */
  lost?: boolean;
}

export type DoorSwingDirection = "left" | "right";
export type DoorOpeningDirection = "inward" | "outward";

export interface Door extends OpeningBase {
  swingDirection?: DoorSwingDirection;
  openingDirection?: DoorOpeningDirection;
}
export type Window = OpeningBase;

export type Sp50BuildingCategory =
  | "residential"
  | "public"
  | "medical"
  | "educational"
  | "preschool"
  | "administrative"
  | "industrialDry"
  | "industrialWet"
  | "industrialHighHeat"
  | "agricultural"
  | "storage";

export type Sp50HumidityZone = "dry" | "normal" | "wet";
export type Sp50MoistureMode = "dry" | "normal" | "wet" | "veryWet";
export type Sp50OperationCondition = "A" | "B";
export type Sp50ConstructionType =
  | "wall"
  | "roof"
  | "atticFloor"
  | "floorOverBasement"
  | "floorOnGround"
  | "window"
  | "lantern"
  | "door"
  | "gate"
  | "covering";

export interface Sp50ClimateData {
  city?: string;
  climateRegion?: string;
  indoorTemperatureC?: number;
  indoorRelativeHumidityPercent?: number;
  outdoorHeatingPeriodAverageC?: number;
  heatingPeriodDurationDays?: number;
  outdoorDesignTemperatureC?: number;
  julyAverageTemperatureC?: number;
  summerOutdoorAmplitudeC?: number;
  summerWindSpeedM_s?: number;
  humidityZone?: Sp50HumidityZone;
  solarRadiationZone?: string;
  solarRadiationImax_W_m2?: number;
  solarRadiationIavg_W_m2?: number;
}

export interface Sp50EnvelopeFragmentInput {
  id: string;
  label: string;
  constructionType: Sp50ConstructionType;
  areaM2: number;
  conditionedVolumeM3?: number;
  conditionedAreaM2?: number;
  indoorTemperatureC?: number;
  outdoorTemperatureC?: number;
  multiplierMp?: number;
  layers?: WallLayer[];
  metadata?: Sp50EnvelopeFragmentMetadata;
  operationCondition?: Sp50OperationCondition;
  heterogeneity?: {
    planar?: Array<{ areaM2: number; resistance_m2K_W: number; label?: string }>;
    linear?: Array<{ lengthM: number; psi_W_mK: number; label?: string }>;
    point?: Array<{ count: number; chi_W_K: number; label?: string }>;
  };
  riskZones?: string[];
}

export interface Sp50EnergyVentilationMetadata {
  ventilationACH?: number;
  infiltrationACH?: number;
  ventilationFlowM3H?: number;
  infiltrationMassFlowKgH?: number;
  heatRecoveryFactor?: number;
  volumeCoefficientBetaV?: number;
}

export interface Sp50BuildingMetadata {
  buildingCategory?: Sp50BuildingCategory;
  storeys?: number;
  heatedVolumeM3?: number;
  heatedAreaM2?: number;
  residentialAreaM2?: number;
  occupiedAreaM2?: number;
  climate?: Sp50ClimateData;
  moistureMode?: Sp50MoistureMode;
  operationCondition?: Sp50OperationCondition;
  envelope?: Sp50EnvelopeFragmentInput[];
  /** Входы для расчёта q_от и годовой энергии по СП 50 (вентиляция / инфильтрация). */
  energyVentilation?: Sp50EnergyVentilationMetadata;
}

export interface BuildingModel {
  levels: Level[];
  rooms: Room[];
  walls: Wall[];
  roofs?: Roof[];
  floorSlabs?: FloorSlab[];
  doors: Door[];
  windows: Window[];
  pipes: PipeNetwork[];
  ducts: DuctNetwork[];
  equipment: Equipment[];
  sensors: SensorDevice[];
  scenarios: OperationalScenario[];
  activeScenarioId: string | null;
  events: BuildingEvent[];
  meta?: Record<string, unknown>;
  thermalProtection?: Sp50BuildingMetadata;
  engineeringSystems?: EngineeringSystemsModel;
}

export type SelectionKind = "room" | "wall" | "door" | "window" | "level";

export const createEmptyBuildingModel = (): BuildingModel => ({
  levels: [],
  rooms: [],
  walls: [],
  roofs: [],
  floorSlabs: [],
  doors: [],
  windows: [],
  pipes: [],
  ducts: [],
  equipment: [],
  sensors: [],
  scenarios: [],
  activeScenarioId: null,
  events: [],
  meta: {},
  thermalProtection: undefined,
  engineeringSystems: createEmptyEngineeringSystems(),
});
