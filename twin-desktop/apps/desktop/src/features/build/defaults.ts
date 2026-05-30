import type { Equipment, EquipmentType, PipeNetwork, PipeSystemType } from "../../entities/networks/types";

export const WALL_DEFAULTS = { thickness: 0.3, height: 3 } as const;
export const ROOF_DEFAULTS = {
  thickness: 0.24,
  kind: "flat",
  heatedSide: "below",
  slopeDirectionDeg: 0,
  risePerMeter: 0.08,
} as const;
export const FLOOR_SLAB_DEFAULTS = {
  thickness: 0.22,
  kind: "interfloor",
  heatedSide: "below",
} as const;
export const DOOR_DEFAULTS = { width: 0.9, height: 2.1, swingDirection: "left" as const, openingDirection: "inward" as const } as const;
export const WINDOW_DEFAULTS = { width: 1.2, height: 1.4, sill: 0.9 } as const;

type PipeDefaults = Omit<PipeNetwork, "id" | "levelId" | "path" | "connectedEquipmentIds">;

export const PIPE_PRESET_DEFAULTS: Record<PipeSystemType, PipeDefaults> = {
  heating_supply: {
    type: "heating_supply",
    heatingSystemId: null,
    systemType: "heating",
    heatingSystemKind: "two_pipe",
    flowRole: "supply",
    circuitRole: "supply",
    segmentClass: "branch",
    flowDirection: "forward",
    markingColor: "gost_supply",
    heatCarrier: "water",
    diameter_mm: 25,
    innerDiameter_mm: 21,
    material: "steel",
    insulationThickness_mm: 20,
    insulationConductivity_W_mK: 0.04,
    roughness_mm: 0.1,
    fluidTemperatureC: 70,
    designIndoorTemperatureC: 21,
    designOutdoorTemperatureC: -18,
    temperatureDropC: 20,
    flowRate_kg_s: 0.12,
    designVelocity_m_s: 0.7,
    pressurePa: 12000,
    pressureDropPa: 0,
    heatLossW: 0,
  },
  heating_return: {
    type: "heating_return",
    heatingSystemId: null,
    systemType: "heating",
    heatingSystemKind: "two_pipe",
    flowRole: "return",
    circuitRole: "return",
    segmentClass: "branch",
    flowDirection: "forward",
    markingColor: "gost_return",
    heatCarrier: "water",
    diameter_mm: 25,
    innerDiameter_mm: 21,
    material: "steel",
    insulationThickness_mm: 20,
    insulationConductivity_W_mK: 0.04,
    roughness_mm: 0.1,
    fluidTemperatureC: 50,
    designIndoorTemperatureC: 21,
    designOutdoorTemperatureC: -18,
    temperatureDropC: 20,
    flowRate_kg_s: 0.12,
    designVelocity_m_s: 0.55,
    pressurePa: 9000,
    pressureDropPa: 0,
    heatLossW: 0,
  },
  dhw: {
    type: "dhw",
    heatingSystemId: null,
    systemType: "water",
    heatingSystemKind: "two_pipe",
    flowRole: "distribution",
    circuitRole: "mixed",
    segmentClass: "branch",
    flowDirection: "forward",
    markingColor: "gost_dhw",
    heatCarrier: "water",
    diameter_mm: 20,
    innerDiameter_mm: 16,
    material: "pex",
    insulationThickness_mm: 13,
    insulationConductivity_W_mK: 0.04,
    roughness_mm: 0.02,
    fluidTemperatureC: 55,
    designIndoorTemperatureC: 20,
    designOutdoorTemperatureC: -18,
    temperatureDropC: 10,
    flowRate_kg_s: 0.08,
    designVelocity_m_s: 0.6,
    pressurePa: 10000,
    pressureDropPa: 0,
    heatLossW: 0,
  },
  chw: {
    type: "chw",
    heatingSystemId: null,
    systemType: "water",
    heatingSystemKind: "two_pipe",
    flowRole: "distribution",
    circuitRole: "mixed",
    segmentClass: "branch",
    flowDirection: "forward",
    markingColor: "gost_chw",
    heatCarrier: "water",
    diameter_mm: 20,
    innerDiameter_mm: 16,
    material: "pex",
    insulationThickness_mm: 19,
    insulationConductivity_W_mK: 0.035,
    roughness_mm: 0.02,
    fluidTemperatureC: 7,
    designIndoorTemperatureC: 24,
    designOutdoorTemperatureC: 32,
    temperatureDropC: 5,
    flowRate_kg_s: 0.08,
    designVelocity_m_s: 0.65,
    pressurePa: 10000,
    pressureDropPa: 0,
    heatLossW: 0,
  },
};

export const PIPE_DEFAULTS = PIPE_PRESET_DEFAULTS.heating_supply;

export function createPipeDefaults(type: PipeSystemType): PipeDefaults {
  const preset = PIPE_PRESET_DEFAULTS[type];
  return {
    ...preset,
    heatingSystemId: preset.heatingSystemId ?? null,
  };
}

export const DUCT_DEFAULTS = {
  section: { shape: "rectangular", width_mm: 400, height_mm: 200 },
  airflow_m3_s: 0.35,
  airVelocity_m_s: 2.5,
} as const;

export const SENSOR_DEFAULTS = {
  type: "temperature",
  unit: "°C",
  status: "normal",
} as const;

export function defaultEquipmentParams(type: EquipmentType): Equipment["params"] {
  switch (type) {
    case "pump":
      return { headPa: 25000, designFlow_kg_s: 0.16, efficiency: 0.72, assignedSystemId: null };
    case "ahu":
      return { designAirflow_m3_s: 1.8, efficiency: 0.68 };
    case "diffuser":
      return { designAirflow_m3_s: 0.12 };
    case "boiler":
      return {
        nominalPowerW: 24000,
        efficiency: 0.92,
        supplyTemperatureC: 70,
        returnTemperatureC: 50,
        designIndoorTemperatureC: 21,
        designOutdoorTemperatureC: -18,
        assignedSystemId: null,
      };
    case "heat_exchanger":
      return {
        nominalPowerW: 180000,
        designFlow_kg_s: 0.42,
        supplyTemperatureC: 95,
        returnTemperatureC: 60,
        pressureDropPa: 35000,
        efficiency: 0.97,
        assignedSystemId: null,
      };
    case "elevator":
      return {
        designFlow_kg_s: 0.35,
        pressureDropPa: 12000,
        supplyTemperatureC: 95,
        returnTemperatureC: 70,
        assignedSystemId: null,
      };
    case "expansion_tank":
      return {
        pressureDropPa: 2000,
        note: "Мембранный расширительный бак на обратном контуре.",
        assignedSystemId: null,
      };
    case "dirt_separator":
      return {
        designFlow_kg_s: 0.35,
        pressureDropPa: 8000,
        assignedSystemId: null,
      };
    case "fancoil":
      return {
        nominalPowerW: 3200,
        designAirflow_m3_s: 0.25,
        designFlow_kg_s: 0.05,
        connectionType: "bottom",
        assignedSystemId: null,
      };
    case "sensor":
      return { note: "Используйте отдельный инструмент датчика для телеметрии." };
    case "radiator":
    default:
      return {
        nominalPowerW: 1800,
        designFlow_kg_s: 0.08,
        supplyTemperatureC: 70,
        returnTemperatureC: 50,
        designIndoorTemperatureC: 21,
        designOutdoorTemperatureC: -18,
        connectionType: "side",
        assignedSystemId: null,
      };
  }
}
