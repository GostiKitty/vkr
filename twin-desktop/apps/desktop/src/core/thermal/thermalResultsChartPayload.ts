import type { ThermalSimulationResult } from "./solver";
import type { ZoneDiagnosticStatus } from "./thermalDiagnostics";

export const THERMAL_CHART_NOT_SET = "не задано";

export type LossCategoryKey = "opaque" | "window" | "door" | "infiltration" | "ventilation";

export type BuildingLossSeriesRow = {
  key: LossCategoryKey;
  label: string;
  valueW: number | null;
  sharePercent: number | null;
};

export type ZoneChartSeriesRow = {
  zoneId: string;
  zoneName: string;
  temperatureC: number | null;
  heatingPowerW: number | null;
  lossOpaqueW: number | null;
  lossWindowW: number | null;
  lossDoorW: number | null;
  lossInfiltrationW: number | null;
  lossMechanicalVentilationW: number | null;
  lossTotalW: number;
  infiltrationSharePct: number | null;
  status: ZoneDiagnosticStatus | null;
  statusNote: string | null;
};

export type ThermalKpiPayload = {
  peakLoadKW: number | null;
  totalEnergyKWh: number | null;
  discomfortHours: number | null;
  totalHeatingW: number | null;
};

export type ScenarioCompareRow = {
  scenarioId: string;
  label: string;
  peakLoadKW: number | null;
  totalEnergyKWh: number | null;
  discomfortHours: number | null;
};

export type Zone3DOverlayMetric = {
  temperatureC: number | null;
  heatingPowerW: number | null;
  lossTotalW: number;
  statusNote: string | null;
};

const asFinite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeZoneName = (value?: string | null) => (value ?? "").trim() || "Без названия";

const BUILDING_LOSS_LABELS: Record<LossCategoryKey, string> = {
  opaque: "Непрозрачные ограждения",
  window: "Окна",
  door: "Двери",
  infiltration: "Инфильтрация",
  ventilation: "Механическая вентиляция",
};

export function buildKpiPayload(result: ThermalSimulationResult): ThermalKpiPayload {
  const building = result.diagnostics?.building;
  return {
    peakLoadKW: asFinite(result.summary.peakLoadKW),
    totalEnergyKWh: asFinite(result.summary.totalEnergyKWh),
    discomfortHours: asFinite(result.summary.discomfortHours),
    totalHeatingW: asFinite(building?.totalHeatingW),
  };
}

export function buildBuildingLossSeries(result: ThermalSimulationResult): BuildingLossSeriesRow[] {
  const building = result.diagnostics?.building;
  if (!building) {
    return [];
  }

  const rows: BuildingLossSeriesRow[] = [
    { key: "opaque", label: BUILDING_LOSS_LABELS.opaque, valueW: asFinite(building.totalOpaqueLossW), sharePercent: null },
    { key: "window", label: BUILDING_LOSS_LABELS.window, valueW: asFinite(building.totalWindowLossW), sharePercent: null },
    { key: "door", label: BUILDING_LOSS_LABELS.door, valueW: asFinite(building.totalDoorLossW), sharePercent: null },
    {
      key: "infiltration",
      label: BUILDING_LOSS_LABELS.infiltration,
      valueW: asFinite(building.totalInfiltrationLossW),
      sharePercent: null,
    },
    {
      key: "ventilation",
      label: BUILDING_LOSS_LABELS.ventilation,
      valueW: asFinite(building.totalMechanicalVentilationLossW),
      sharePercent: null,
    },
  ];

  const present = rows.filter((row) => row.valueW !== null);
  const totalW = present.reduce((acc, row) => acc + (row.valueW ?? 0), 0);

  return present.map((row) => ({
    ...row,
    sharePercent:
      asFinite(building.lossSharePercent[row.key]) ??
      (totalW > 0 ? ((row.valueW ?? 0) / totalW) * 100 : null),
  }));
}

export function buildZoneSeries(result: ThermalSimulationResult): ZoneChartSeriesRow[] {
  const zones = result.diagnostics?.zones ?? [];
  return zones
    .map((zone) => {
      const lossOpaqueW = asFinite(zone.lossOpaqueW);
      const lossWindowW = asFinite(zone.lossWindowW);
      const lossDoorW = asFinite(zone.lossDoorW);
      const lossInfiltrationW = asFinite(zone.lossInfiltrationW);
      const lossMechanicalVentilationW = asFinite(zone.lossMechanicalVentilationW);
      const lossTotalW =
        (lossOpaqueW ?? 0) +
        (lossWindowW ?? 0) +
        (lossDoorW ?? 0) +
        (lossInfiltrationW ?? 0) +
        (lossMechanicalVentilationW ?? 0);

      return {
        zoneId: zone.zoneId,
        zoneName: normalizeZoneName(zone.zoneName),
        temperatureC: asFinite(zone.temperatureC),
        heatingPowerW: asFinite(zone.heatingPowerW),
        lossOpaqueW,
        lossWindowW,
        lossDoorW,
        lossInfiltrationW,
        lossMechanicalVentilationW,
        lossTotalW,
        infiltrationSharePct:
          lossTotalW > 0 && lossInfiltrationW != null ? (lossInfiltrationW / lossTotalW) * 100 : null,
        status: zone.status ?? null,
        statusNote: zone.statusNote?.trim() || null,
      };
    })
    .sort((left, right) => right.lossTotalW - left.lossTotalW);
}

export function build3DOverlayMap(
  zoneSeries: ZoneChartSeriesRow[]
): Map<string, Zone3DOverlayMetric> {
  return new Map(
    zoneSeries.map((zone) => [
      zone.zoneName.toLowerCase(),
      {
        temperatureC: zone.temperatureC,
        heatingPowerW: zone.heatingPowerW,
        lossTotalW: zone.lossTotalW,
        statusNote: zone.statusNote,
      },
    ])
  );
}

export type ScenarioResultInput = {
  scenarioId: string;
  label: string;
  result: ThermalSimulationResult;
};

export function buildScenarioCompareSeries(items: ScenarioResultInput[]): ScenarioCompareRow[] {
  return items.map((item) => ({
    scenarioId: item.scenarioId,
    label: item.label,
    peakLoadKW: asFinite(item.result.summary.peakLoadKW),
    totalEnergyKWh: asFinite(item.result.summary.totalEnergyKWh),
    discomfortHours: asFinite(item.result.summary.discomfortHours),
  }));
}

export function buildScenarioHistoryCompareRows(
  items: Array<{
    id: string;
    label: string;
    peakLoadKW: number;
    totalEnergyKWh: number;
    discomfortHours: number;
  }>
): ScenarioCompareRow[] {
  return items.map((item) => ({
    scenarioId: item.id,
    label: item.label,
    peakLoadKW: asFinite(item.peakLoadKW),
    totalEnergyKWh: asFinite(item.totalEnergyKWh),
    discomfortHours: asFinite(item.discomfortHours),
  }));
}

export function hasBuildingDiagnostics(result: ThermalSimulationResult): boolean {
  return buildBuildingLossSeries(result).length > 0;
}

export function hasZoneDiagnostics(result: ThermalSimulationResult): boolean {
  return buildZoneSeries(result).length > 0;
}

export type ThermalResultCapability = {
  mechanicalVentilation: boolean;
  perSurfaceEnvelope: boolean;
  monteCarloInResult: boolean;
  climateBaseLabel: string | null;
  scenarioCompare: boolean;
};

export function buildThermalResultCapabilities(
  result: ThermalSimulationResult | null,
  options?: { climateCityLabel?: string | null; scenarioHistoryCount?: number }
): ThermalResultCapability {
  const building = result?.diagnostics?.building;
  const hasVent =
    building != null &&
    Number.isFinite(building.totalMechanicalVentilationLossW) &&
    building.totalMechanicalVentilationLossW > 0;
  return {
    mechanicalVentilation: hasVent,
    perSurfaceEnvelope: false,
    monteCarloInResult: false,
    climateBaseLabel: options?.climateCityLabel
      ? `СП 131.13330.2025, ${options.climateCityLabel}`
      : null,
    scenarioCompare: (options?.scenarioHistoryCount ?? 0) > 1,
  };
}

export function buildMissingResultFieldLabels(capabilities: ThermalResultCapability): string[] {
  const missing: string[] = [];
  if (!capabilities.mechanicalVentilation) {
    missing.push("Механическая вентиляция — задайте ventilationACH > 0 в сценарии");
  }
  if (!capabilities.perSurfaceEnvelope) {
    missing.push("Потери по каждой поверхности ограждения — в разработке");
  }
  if (!capabilities.monteCarloInResult) {
    missing.push("Monte Carlo внутри result — запускайте отдельный шаг «Неопределённость»");
  }
  if (!capabilities.climateBaseLabel) {
    missing.push("Климатическая база — выберите город (СП 131) в сценарии");
  }
  if (!capabilities.scenarioCompare) {
    missing.push("Сравнение сценариев — сохраните несколько прогонов");
  }
  return missing;
}
