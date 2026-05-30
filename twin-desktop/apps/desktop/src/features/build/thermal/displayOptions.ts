import type { ThermalFieldBuildOptions } from "../../../core/thermal/field";
import type { ThermalSimulationOptions, ThermalTimelinePoint } from "../../../core/thermal/solver";

export type ThermalPreviewMode = "steady" | "transient";
export type ThermalSurfaceFieldMode = "surfaceTemperature" | "heatFlux" | "heatLoss" | "condensationRisk";

export interface ThermalDisplayOptions {
  outdoorTemperatureC: number;
  windFactor: number;
  solarGainFactor: number;
  lightingGain_W_m2: number;
  occupancyGain_W_m2: number;
  infiltrationACH: number;
  ventilationACH: number;
  supplyAirTemperatureC: number | null;
  radiatorPowerMultiplier: number;
  equipmentGainMultiplier: number;
  mode: ThermalPreviewMode;
  showSurfaceField: boolean;
  surfaceFieldMode: ThermalSurfaceFieldMode;
  showHeatSources: boolean;
  showThermalBridges: boolean;
  showFloorField: boolean;
  showWallSurfaces: boolean;
  showContours: boolean;
  showVolumeTint: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  /** Opacity of the surface thermal field overlay (0–1). Default 0.52. */
  surfaceFieldOpacity: number;
}

export const DEFAULT_THERMAL_DISPLAY_OPTIONS: ThermalDisplayOptions = {
  outdoorTemperatureC: 4,
  windFactor: 1,
  solarGainFactor: 0.45,
  lightingGain_W_m2: 2.6,
  occupancyGain_W_m2: 1.4,
  infiltrationACH: 0.45,
  ventilationACH: 0.18,
  supplyAirTemperatureC: null,
  radiatorPowerMultiplier: 1,
  equipmentGainMultiplier: 1,
  mode: "steady",
  showSurfaceField: true,
  surfaceFieldMode: "surfaceTemperature",
  showHeatSources: false,
  showThermalBridges: false,
  showFloorField: true,
  showWallSurfaces: true,
  showContours: true,
  showVolumeTint: false,
  showLegend: true,
  showTooltip: true,
  surfaceFieldOpacity: 0.52,
};

export function buildThermalFieldOptions(
  display: ThermalDisplayOptions,
  simulation: ThermalSimulationOptions,
  frame: ThermalTimelinePoint | null
): Omit<ThermalFieldBuildOptions, "roomTemperaturesC"> {
  const timeHours = frame?.timeHours ?? 12;
  const outdoorTemperatureC = frame?.outdoorTemperatureC ?? display.outdoorTemperatureC;
  const dayStart = simulation.setpoints.dayStartHour;
  const nightStart = simulation.setpoints.nightStartHour;
  const hour = ((timeHours % 24) + 24) % 24;
  const isDay = dayStart < nightStart
    ? hour >= dayStart && hour < nightStart
    : hour >= dayStart || hour < nightStart;

  return {
    outdoorTemperatureC,
    timeHours,
    setpointTemperatureC: isDay ? simulation.setpoints.day : simulation.setpoints.night,
    windFactor: display.windFactor,
    solarGainFactor: display.solarGainFactor,
    lightingGain_W_m2: display.lightingGain_W_m2,
    occupancyGain_W_m2: display.occupancyGain_W_m2,
    infiltrationACH: display.infiltrationACH,
    ventilationACH: display.ventilationACH,
    supplyAirTemperatureC: display.supplyAirTemperatureC,
    radiatorPowerMultiplier: display.radiatorPowerMultiplier,
    equipmentGainMultiplier: display.equipmentGainMultiplier,
    transientBlend: display.mode === "steady" ? 1 : 0.64,
  };
}
