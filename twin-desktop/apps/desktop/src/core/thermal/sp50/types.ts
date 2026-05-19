import type {
  Sp50BuildingCategory,
  Sp50ConstructionType,
  Sp50HumidityZone,
  Sp50MoistureMode,
  Sp50OperationCondition,
} from "../../../entities/geometry/types";

export type Sp50CheckStatus = "pass" | "fail" | "insufficient_data";

export interface Sp50SourceData {
  city: string | null;
  climateRegion: string | null;
  indoorTemperatureC: number | null;
  indoorRelativeHumidityPercent: number | null;
  outdoorHeatingPeriodAverageC: number | null;
  heatingPeriodDurationDays: number | null;
  outdoorDesignTemperatureC: number | null;
  gsop: number | null;
  heatedVolumeM3: number | null;
  heatedAreaM2: number | null;
  buildingCategory: Sp50BuildingCategory | null;
  storeys: number | null;
  humidityZone: Sp50HumidityZone | null;
  moistureMode: Sp50MoistureMode | null;
  operationCondition: Sp50OperationCondition | null;
}

export interface Sp50LayerResult {
  materialId: string;
  materialLabel: string;
  thicknessM: number;
  conductivity_W_mK: number | null;
  resistance_m2K_W: number | null;
  heatAbsorption_W_m2K: number | null;
  vaporPermeability_mg_mhPa: number | null;
}

export interface Sp50TemperaturePoint {
  positionM: number;
  temperatureC: number;
  label: string;
}

export interface Sp50ConstructionCheck {
  id: string;
  label: string;
  constructionType: Sp50ConstructionType;
  areaM2: number;
  nt: number;
  mp: number;
  layers: Sp50LayerResult[];
  internalHeatTransferCoefficient: number | null;
  externalHeatTransferCoefficient: number | null;
  actualResistance_m2K_W: number | null;
  requiredResistance_m2K_W: number | null;
  normalizedResistance_m2K_W: number | null;
  reducedResistance_m2K_W: number | null;
  heatTransferCoefficient_W_m2K: number | null;
  margin_m2K_W: number | null;
  complies: boolean | null;
  status: Sp50CheckStatus;
  explanation: string;
  internalSurfaceTemperatureC: number | null;
  dewPointTemperatureC: number | null;
  condensationRisk: boolean | null;
  riskZones: string[];
  temperatureProfile: Sp50TemperaturePoint[];
  contribution_W_K: number | null;
  homogeneityCoefficient: number | null;
}

export interface Sp50BuildingCheck {
  fragments: Array<{
    id: string;
    label: string;
    areaM2: number;
    reducedResistance_m2K_W: number | null;
    nt: number;
    contribution_W_K: number | null;
  }>;
  kob_W_m3K: number | null;
  kobNorm_W_m3K: number | null;
  kOverall_W_m2K: number | null;
  compactness_1_m: number | null;
  complies: boolean | null;
  status: Sp50CheckStatus;
}

export interface Sp50TemperatureCheck {
  minimumSurfaceTemperatureC: number | null;
  dewPointTemperatureC: number | null;
  riskCount: number;
  problematicZones: string[];
}

export interface Sp50TransientCheck {
  thermalInertia_D: number | null;
  thermalInertiaByLayer: number[];
  requiredAmplitudeC: number | null;
  calculatedExternalAmplitudeC: number | null;
  internalSurfaceAmplitudeC: number | null;
  summerExternalCoefficient_W_m2K: number | null;
  requiresDetailedCheck: boolean | null;
  complies: boolean | null;
  status: Sp50CheckStatus;
}

export interface Sp50AirPermeabilityCheck {
  pressureDifferencePa: number | null;
  specificWeights: { indoor: number | null; outdoor: number | null };
  actualResistance_m2hPa_kg: number | null;
  requiredResistance_m2hPa_kg: number | null;
  complies: boolean | null;
  status: Sp50CheckStatus;
}

export interface Sp50MoistureProtectionCheck {
  internalPartialPressurePa: number | null;
  saturationPressurePa: number | null;
  actualResistance_m2hPa_mg: number | null;
  requiredResistanceAnnual_m2hPa_mg: number | null;
  requiredResistanceColdPeriod_m2hPa_mg: number | null;
  governingRequiredResistance_m2hPa_mg: number | null;
  maxMoisturePlaneIndex: number | null;
  status: "calculated" | "insufficient_data";
  complies: boolean | null;
}

export interface Sp50FloorCheck {
  heatAbsorption_W_m2K: number | null;
  requiredHeatAbsorption_W_m2K: number | null;
  complies: boolean | null;
  status: Sp50CheckStatus;
}

export interface Sp50EnergyCheck {
  qHeatingCharacteristic_W_m3K: number | null;
  qHeatingNorm_kWh_m2: number | null;
  annualHeatingEnergy_kWh: number | null;
  annualTotalLosses_kWh: number | null;
  qByArea_kWh_m2: number | null;
  qByVolume_kWh_m3: number | null;
  betaGainUseFactor: number | null;
  ventilationCharacteristic_W_m3K: number | null;
  internalGainCharacteristic_W_m3K: number | null;
  solarGainCharacteristic_W_m3K: number | null;
  averageAirDensity_kg_m3: number | null;
  averageAirExchange_1_h: number | null;
  usesPlaceholderInputs: boolean;
  placeholderWarnings: string[];
  complies: boolean | null;
  status: Sp50CheckStatus;
}

export interface Sp50Recommendation {
  id: string;
  title: string;
  effect: string;
}

export interface Sp50MaterialEfficiencyResult {
  materialId: string;
  efficiency: number | null;
}

export interface Sp50ComplianceReport {
  sourceData: Sp50SourceData;
  constructions: Sp50ConstructionCheck[];
  building: Sp50BuildingCheck;
  temperature: Sp50TemperatureCheck;
  transient: Sp50TransientCheck;
  airPermeability: Sp50AirPermeabilityCheck;
  moistureProtection: Sp50MoistureProtectionCheck;
  floor: Sp50FloorCheck;
  energy: Sp50EnergyCheck;
  recommendations: Sp50Recommendation[];
  materialEfficiency: Sp50MaterialEfficiencyResult[];
  missingData: string[];
}
