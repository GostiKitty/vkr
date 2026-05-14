import { createEmptyBuildingModel, type BuildingModel, type Sp50EnvelopeFragmentInput, type WallLayer } from "../entities/geometry/types";
import type { Sp50ComplianceReport } from "../core/thermal/sp50/types";
import { runSP50Compliance } from "../core/thermal/sp50/index";

interface DemoHeatLossContributor {
  id: string;
  label: string;
  contribution_W_K: number;
  status: "pass" | "fail" | "insufficient_data";
}

export interface DemoSp50RunResult {
  scenarioId: string;
  model: BuildingModel;
  report: Sp50ComplianceReport;
  topHeatLossContributors: DemoHeatLossContributor[];
  engineeringConclusion: string;
}

export interface DemoSp50ExportPayload {
  scenarioId: string;
  exportedAt: string;
  sourceData: Sp50ComplianceReport["sourceData"];
  constructions: Sp50ComplianceReport["constructions"];
  building: Sp50ComplianceReport["building"];
  energy: Sp50ComplianceReport["energy"];
  temperature: Sp50ComplianceReport["temperature"];
  transient: Sp50ComplianceReport["transient"];
  airPermeability: Sp50ComplianceReport["airPermeability"];
  moistureProtection: Sp50ComplianceReport["moistureProtection"];
  floor: Sp50ComplianceReport["floor"];
  statuses: {
    constructions: Array<{ id: string; label: string; status: "pass" | "fail" | "insufficient_data" }>;
    building: "pass" | "fail" | "insufficient_data";
    energy: "pass" | "fail" | "insufficient_data";
    transient: "pass" | "fail" | "insufficient_data";
    airPermeability: "pass" | "fail" | "insufficient_data";
    floor: "pass" | "fail" | "insufficient_data";
    moistureProtection: "calculated" | "insufficient_data";
  };
  topHeatLossContributors: DemoHeatLossContributor[];
  engineeringConclusion: string;
  missingData: string[];
}

const DEMO_WALL_LAYERS: WallLayer[] = [
  { materialId: "cement_sand_plaster", thickness_m: 0.02 },
  { materialId: "aerated_concrete", thickness_m: 0.3 },
  { materialId: "mineral_wool", thickness_m: 0.12 },
  { materialId: "gypsum_plaster", thickness_m: 0.015 },
];

const DEMO_ROOF_LAYERS: WallLayer[] = [
  { materialId: "gypsum_board", thickness_m: 0.0125 },
  { materialId: "mineral_wool", thickness_m: 0.2 },
  { materialId: "plywood", thickness_m: 0.018 },
];

const DEMO_FLOOR_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.18 },
  { materialId: "xps", thickness_m: 0.08 },
  { materialId: "cement_sand_plaster", thickness_m: 0.05 },
];

const DEMO_WINDOW_LAYERS: WallLayer[] = [{ materialId: "window_block", thickness_m: 0.04 }];

const DEMO_DOOR_LAYERS: WallLayer[] = [
  { materialId: "wood", thickness_m: 0.04 },
  { materialId: "eps", thickness_m: 0.05 },
  { materialId: "plywood", thickness_m: 0.01 },
];

const DEMO_ENVELOPE: Sp50EnvelopeFragmentInput[] = [
  {
    id: "demo-walls",
    label: "Наружные стены",
    constructionType: "wall",
    areaM2: 228,
    conditionedAreaM2: 600,
    conditionedVolumeM3: 1800,
    layers: DEMO_WALL_LAYERS,
    riskZones: ["внешние углы", "примыкания окон", "зоны теплопроводных включений"],
  },
  {
    id: "demo-windows",
    label: "Окна и светопрозрачные конструкции",
    constructionType: "window",
    areaM2: 42,
    layers: DEMO_WINDOW_LAYERS,
    riskZones: ["оконные откосы", "примыкания окон"],
  },
  {
    id: "demo-roof",
    label: "Покрытие",
    constructionType: "covering",
    areaM2: 300,
    layers: DEMO_ROOF_LAYERS,
    riskZones: ["примыкания покрытия"],
  },
  {
    id: "demo-floor",
    label: "Перекрытие над подвалом",
    constructionType: "floorOverBasement",
    areaM2: 300,
    layers: DEMO_FLOOR_LAYERS,
    riskZones: ["переход к конструкциям в грунте"],
  },
  {
    id: "demo-door",
    label: "Наружные двери",
    constructionType: "door",
    areaM2: 4,
    layers: DEMO_DOOR_LAYERS,
    riskZones: ["примыкания дверей"],
  },
];

export const sampleBuildingSP50: BuildingModel = {
  ...createEmptyBuildingModel(),
  levels: [
    { id: "level-1", name: "1 этаж", elevation_m: 0, height_m: 3 },
    { id: "level-2", name: "2 этаж", elevation_m: 3, height_m: 3 },
  ],
  rooms: [
    {
      id: "room-1",
      name: "1 этаж",
      levelId: "level-1",
      polygon: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 15 },
        { x: 0, y: 15 },
      ],
    },
    {
      id: "room-2",
      name: "2 этаж",
      levelId: "level-2",
      polygon: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 15 },
        { x: 0, y: 15 },
      ],
    },
  ],
  walls: [
    { id: "w1-1", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 20, y: 0 }, thickness_m: 0.455, height_m: 3, layers: DEMO_WALL_LAYERS },
    { id: "w1-2", levelId: "level-1", a: { x: 20, y: 0 }, b: { x: 20, y: 15 }, thickness_m: 0.455, height_m: 3, layers: DEMO_WALL_LAYERS },
    { id: "w1-3", levelId: "level-1", a: { x: 20, y: 15 }, b: { x: 0, y: 15 }, thickness_m: 0.455, height_m: 3, layers: DEMO_WALL_LAYERS },
    { id: "w1-4", levelId: "level-1", a: { x: 0, y: 15 }, b: { x: 0, y: 0 }, thickness_m: 0.455, height_m: 3, layers: DEMO_WALL_LAYERS },
    { id: "w2-1", levelId: "level-2", a: { x: 0, y: 0 }, b: { x: 20, y: 0 }, thickness_m: 0.455, height_m: 3, layers: DEMO_WALL_LAYERS },
    { id: "w2-2", levelId: "level-2", a: { x: 20, y: 0 }, b: { x: 20, y: 15 }, thickness_m: 0.455, height_m: 3, layers: DEMO_WALL_LAYERS },
    { id: "w2-3", levelId: "level-2", a: { x: 20, y: 15 }, b: { x: 0, y: 15 }, thickness_m: 0.455, height_m: 3, layers: DEMO_WALL_LAYERS },
    { id: "w2-4", levelId: "level-2", a: { x: 0, y: 15 }, b: { x: 0, y: 0 }, thickness_m: 0.455, height_m: 3, layers: DEMO_WALL_LAYERS },
  ],
  roofs: [
    {
      id: "roof-1",
      levelId: "level-2",
      name: "Основное покрытие",
      kind: "pitched",
      boundary: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 15 },
        { x: 0, y: 15 },
      ],
      elevationBase_m: 6,
      thickness_m: 0.2305,
      slope: { directionDeg: 90, risePerMeter: 0.18 },
      layers: DEMO_ROOF_LAYERS,
      heatedSide: "below",
      assemblyId: "demo-roof",
    },
  ],
  floorSlabs: [
    {
      id: "slab-1",
      levelId: "level-1",
      name: "Перекрытие над подвалом",
      kind: "basement",
      boundary: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 15 },
        { x: 0, y: 15 },
      ],
      elevation_m: 0,
      thickness_m: 0.31,
      layers: DEMO_FLOOR_LAYERS,
      heatedSide: "above",
      assemblyId: "demo-floor",
    },
  ],
  windows: [
    { id: "win-1", anchor: { wallId: "w1-1", t: 0.25, offset_m: 5 }, width_m: 1.6, height_m: 1.8, sill_m: 0.9 },
    { id: "win-2", anchor: { wallId: "w1-1", t: 0.7, offset_m: 14 }, width_m: 1.6, height_m: 1.8, sill_m: 0.9 },
    { id: "win-3", anchor: { wallId: "w1-3", t: 0.25, offset_m: 5 }, width_m: 1.6, height_m: 1.8, sill_m: 0.9 },
    { id: "win-4", anchor: { wallId: "w1-3", t: 0.7, offset_m: 14 }, width_m: 1.6, height_m: 1.8, sill_m: 0.9 },
    { id: "win-5", anchor: { wallId: "w2-1", t: 0.35, offset_m: 7 }, width_m: 1.8, height_m: 1.8, sill_m: 0.9 },
    { id: "win-6", anchor: { wallId: "w2-3", t: 0.35, offset_m: 7 }, width_m: 1.8, height_m: 1.8, sill_m: 0.9 },
  ],
  doors: [{ id: "door-1", anchor: { wallId: "w1-2", t: 0.2, offset_m: 3 }, width_m: 1.2, height_m: 2.1, sill_m: 0 }],
  thermalProtection: {
    buildingCategory: "residential",
    storeys: 2,
    heatedAreaM2: 600,
    heatedVolumeM3: 1800,
    residentialAreaM2: 540,
    envelope: DEMO_ENVELOPE,
    climate: {
      city: "Демо-сценарий",
      climateRegion: "IIБ",
      indoorTemperatureC: 20,
      indoorRelativeHumidityPercent: 55,
      outdoorHeatingPeriodAverageC: -3.1,
      heatingPeriodDurationDays: 214,
      outdoorDesignTemperatureC: -26,
      julyAverageTemperatureC: 19.8,
      summerOutdoorAmplitudeC: 10,
      summerWindSpeedM_s: 3.5,
      humidityZone: "normal",
      solarRadiationZone: "central",
      solarRadiationImax_W_m2: 680,
      solarRadiationIavg_W_m2: 310,
    },
  },
};

export function demoRunSP50Calculation(): DemoSp50RunResult {
  return buildDemoSp50RunResult(sampleBuildingSP50, "sampleBuildingSP50");
}

export function buildDemoSp50RunResult(model: BuildingModel, scenarioId = "sampleBuildingSP50"): DemoSp50RunResult {
  const climate = model.thermalProtection?.climate;
  const report = runSP50Compliance(model, climate, {
    defaultIndoorTemperatureC: climate?.indoorTemperatureC,
    defaultOutdoorTemperatureC: climate?.outdoorDesignTemperatureC,
  });
  const topHeatLossContributors = report.constructions
    .filter((entry) => Number.isFinite(entry.contribution_W_K ?? Number.NaN))
    .sort((left, right) => (right.contribution_W_K ?? 0) - (left.contribution_W_K ?? 0))
    .slice(0, 3)
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      contribution_W_K: entry.contribution_W_K ?? 0,
      status: entry.status,
    }));

  return {
    scenarioId,
    model,
    report,
    topHeatLossContributors,
    engineeringConclusion: buildEngineeringConclusion(report, topHeatLossContributors),
  };
}

export function exportDemoSp50ReportToJson(result: DemoSp50RunResult): string {
  const payload: DemoSp50ExportPayload = {
    scenarioId: result.scenarioId,
    exportedAt: new Date().toISOString(),
    sourceData: result.report.sourceData,
    constructions: result.report.constructions,
    building: result.report.building,
    energy: result.report.energy,
    temperature: result.report.temperature,
    transient: result.report.transient,
    airPermeability: result.report.airPermeability,
    moistureProtection: result.report.moistureProtection,
    floor: result.report.floor,
    statuses: {
      constructions: result.report.constructions.map((entry) => ({ id: entry.id, label: entry.label, status: entry.status })),
      building: result.report.building.status,
      energy: result.report.energy.status,
      transient: result.report.transient.status,
      airPermeability: result.report.airPermeability.status,
      floor: result.report.floor.status,
      moistureProtection: result.report.moistureProtection.status,
    },
    topHeatLossContributors: result.topHeatLossContributors,
    engineeringConclusion: result.engineeringConclusion,
    missingData: result.report.missingData,
  };
  return JSON.stringify(payload, null, 2);
}

function buildEngineeringConclusion(report: Sp50ComplianceReport, topLosses: DemoHeatLossContributor[]): string {
  const topLabels = topLosses.map((entry) => entry.label.toLowerCase());
  const contributorsText =
    topLabels.length >= 2 ? `${topLabels.slice(0, 2).join(" и ")}` : topLabels[0] ?? "ограждающие конструкции";
  const kobActual = formatMetric(report.building.kob_W_m3K, 3);
  const kobNorm = formatMetric(report.building.kobNorm_W_m3K, 3);
  const weakest = report.constructions
    .filter((entry) => entry.status === "fail")
    .sort((left, right) => (left.margin_m2K_W ?? 0) - (right.margin_m2K_W ?? 0))[0];
  const energy = formatMetric(report.energy.annualHeatingEnergy_kWh, 0);
  const advice = weakest
    ? `Для повышения соответствия рекомендуется увеличить сопротивление теплопередаче конструкции «${weakest.label}».`
    : "По основным проверкам дефицит сопротивления теплопередаче не выявлен.";
  return `По результатам расчета основными источниками теплопотерь являются ${contributorsText}. Удельная теплозащитная характеристика здания составляет ${kobActual} при нормативном значении ${kobNorm}. Расчетный годовой расход тепловой энергии на отопление составляет ${energy} кВт·ч. ${advice}`;
}

function formatMetric(value: number | null, maximumFractionDigits: number): string {
  if (value === null || !Number.isFinite(value)) {
    return "н/д";
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits, minimumFractionDigits: 0 }).format(value);
}
