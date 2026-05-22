import type { Sp50BuildingCategory } from "../../../entities/geometry/types";
import { getVolumeCoefficientBetaV } from "../../../norms/sp50_2024/volumeCoefficient";
import { getSolarRadiation } from "../../../norms/sp50_2024/solarRadiation";
import {
  calculateAirSpecificWeight,
  calculateAnnualHeatingEnergy,
  calculateHeatingEnergyCharacteristic,
} from "./calculations";

/** Теплоёмкость воздуха в энергетической характеристике СП 50, кВт·ч/(м³·К). */
export const SP50_AIR_HEAT_CAPACITY_KWH_M3K = 0.28;

/** Средняя плотность воздуха в отопительный период по СП 50: γ = 353/(273+t), кг/м³. */
export function sp50AverageAirDensityKgM3(outdoorHeatingPeriodAverageC: number): number {
  return 353 / (273 + outdoorHeatingPeriodAverageC);
}

export interface Sp50EnergyVentilationInputs {
  /** Объёмный расход приточного воздуха, м³/ч (L_vent). */
  ventilationFlowM3H?: number | null;
  /** Массовый расход инфильтрации, кг/ч (G_inf). */
  infiltrationMassFlowKgH?: number | null;
  /** Кратность механической вентиляции, 1/ч — для вывода L_vent = V·n_vent. */
  ventilationACH?: number | null;
  /** Кратность инфильтрации, 1/ч — для вывода G_inf = ρ·V·n_inf. */
  infiltrationACH?: number | null;
  /** Коэффициент эффективности рекуперации k_ef (0…1). */
  heatRecoveryFactor?: number | null;
  /** Коэффициент β_V; если не задан — из норм по категории здания. */
  volumeCoefficientBetaV?: number | null;
  /** Кратность работы систем (n_vent, n_inf); по умолчанию 1. */
  ventilationOperatingFactor?: number | null;
  infiltrationOperatingFactor?: number | null;
}

export interface Sp50EnergyCharacteristicInput {
  kob_W_m3K: number | null;
  gsop: number | null;
  heatedVolumeM3: number | null;
  heatedAreaM2: number | null;
  residentialAreaM2: number | null;
  indoorTemperatureC: number | null;
  outdoorHeatingPeriodAverageC: number | null;
  buildingCategory?: Sp50BuildingCategory | null;
  storeys?: number | null;
  solarRadiationIavg_W_m2?: number | null;
  solarRadiationZone?: string | null;
  ventilation: Sp50EnergyVentilationInputs;
}

export interface Sp50EnergyCharacteristicResult {
  qHeatingCharacteristic_W_m3K: number | null;
  annualHeatingEnergy_kWh: number | null;
  annualTotalLosses_kWh: number | null;
  betaGainUseFactor: number | null;
  ventilationCharacteristic_W_m3K: number | null;
  internalGainCharacteristic_W_m3K: number | null;
  solarGainCharacteristic_W_m3K: number | null;
  averageAirDensity_kg_m3: number | null;
  averageAirExchange_1_h: number | null;
  usesPlaceholderInputs: boolean;
  placeholderWarnings: string[];
  derivedInputs: {
    betaV: number | null;
    LventM3H: number | null;
    GinfKgH: number | null;
    nVent: number;
    nInf: number;
    kEf: number;
    c: number;
  };
}

const HOURS_PER_WEEK = 168;

function deriveVentilationFlows(
  volume: number,
  tOutdoor: number,
  ventilation: Sp50EnergyVentilationInputs
): { Lvent: number | null; Ginf: number | null; warnings: string[] } {
  const warnings: string[] = [];
  const rho = sp50AverageAirDensityKgM3(tOutdoor);

  let Lvent: number | null = ventilation.ventilationFlowM3H ?? null;
  if (Lvent === null && ventilation.ventilationACH != null && Number.isFinite(ventilation.ventilationACH)) {
    Lvent = volume * Math.max(0, ventilation.ventilationACH);
  }

  let Ginf: number | null = ventilation.infiltrationMassFlowKgH ?? null;
  if (Ginf === null && ventilation.infiltrationACH != null && Number.isFinite(ventilation.infiltrationACH)) {
    Ginf = rho * volume * Math.max(0, ventilation.infiltrationACH);
  }

  if (Lvent === null) {
    warnings.push("Не задан расход механической вентиляции L_vent (м³/ч) и кратность ventilationACH.");
  }
  if (Ginf === null) {
    warnings.push("Не задан расход инфильтрации G_inf (кг/ч) и кратность infiltrationACH.");
  }

  return { Lvent, Ginf, warnings };
}

export function computeSp50EnergyCharacteristic(input: Sp50EnergyCharacteristicInput): Sp50EnergyCharacteristicResult {
  const {
    kob_W_m3K,
    gsop,
    heatedVolumeM3: volume,
    heatedAreaM2: area,
    residentialAreaM2,
    indoorTemperatureC: tIndoor,
    outdoorHeatingPeriodAverageC: tOutdoor,
    ventilation,
  } = input;

  const placeholderWarnings: string[] = [];
  const nVent = ventilation.ventilationOperatingFactor ?? 1;
  const nInf = ventilation.infiltrationOperatingFactor ?? 1;
  const kEf = Math.min(1, Math.max(0, ventilation.heatRecoveryFactor ?? 0));
  const c = SP50_AIR_HEAT_CAPACITY_KWH_M3K;

  if (volume === null || volume <= 0) {
    placeholderWarnings.push("Не задан отапливаемый объём V.");
  }
  if (gsop === null) {
    placeholderWarnings.push("Не задан GSOP (климат / отопительный период).");
  }
  if (tOutdoor === null) {
    placeholderWarnings.push("Не задана средняя t_ot отопительного периода.");
  }
  if (kob_W_m3K === null) {
    placeholderWarnings.push("Не рассчитан k_ob здания.");
  }

  const betaV =
    ventilation.volumeCoefficientBetaV ??
    getVolumeCoefficientBetaV(input.buildingCategory ?? undefined);

  const averageAirDensity = tOutdoor !== null ? sp50AverageAirDensityKgM3(tOutdoor) : null;

  const { Lvent, Ginf, warnings: flowWarnings } =
    volume !== null && tOutdoor !== null
      ? deriveVentilationFlows(volume, tOutdoor, ventilation)
      : { Lvent: null, Ginf: null, warnings: [] as string[] };
  placeholderWarnings.push(...flowWarnings);

  const averageAirExchange =
    volume && averageAirDensity && Lvent !== null && Ginf !== null
      ? ((Lvent * nVent) / HOURS_PER_WEEK + Ginf * nInf / (HOURS_PER_WEEK * averageAirDensity)) / (betaV * volume)
      : null;

  /** k_vent по СП 50: c·(L_vent·γ·n·(1−k_ef)+G_inf·n) / (168·V), c = 0,28 кВт·ч/(м³·К). */
  const kVent =
    volume && averageAirDensity && Lvent !== null && Ginf !== null
      ? (c * (Lvent * averageAirDensity * nVent * (1 - kEf) + Ginf * nInf)) / (HOURS_PER_WEEK * volume)
      : null;

  const deltaT = tIndoor !== null && tOutdoor !== null ? tIndoor - tOutdoor : null;
  const qbyt =
    volume && deltaT && deltaT > 0
      ? ((residentialAreaM2 ?? area ?? 0) * 17) / (volume * deltaT)
      : null;

  const solarData =
    input.solarRadiationIavg_W_m2 != null
      ? { Iavg_W_m2: input.solarRadiationIavg_W_m2 }
      : getSolarRadiation(input.solarRadiationZone ?? "central");
  const solarIavg = solarData?.Iavg_W_m2 ?? 0;
  const qrad =
    volume && gsop && gsop > 0 ? (11.6 * (solarIavg * 0.001)) / (volume * gsop) : 0;

  const betaKpi = averageAirExchange !== null ? 1 / (1 + 0.5 * averageAirExchange) : null;

  const qHeatingCharacteristic =
    kob_W_m3K !== null && kVent !== null && betaKpi !== null
      ? calculateHeatingEnergyCharacteristic({
          kob_W_m3K: kob_W_m3K,
          ventilationCharacteristic_W_m3K: kVent,
          betaGainUseFactor: betaKpi,
          internalGainCharacteristic_W_m3K: qbyt ?? 0,
          solarGainCharacteristic_W_m3K: qrad,
        })
      : null;

  const annualHeatingEnergy =
    gsop && volume && qHeatingCharacteristic !== null
      ? calculateAnnualHeatingEnergy(gsop, volume, qHeatingCharacteristic)
      : null;

  const annualTotalLosses =
    gsop && volume && kob_W_m3K !== null && kVent !== null
      ? calculateAnnualHeatingEnergy(gsop, volume, kob_W_m3K + kVent)
      : null;

  const usesPlaceholderInputs = placeholderWarnings.length > 0;

  return {
    qHeatingCharacteristic_W_m3K: qHeatingCharacteristic,
    annualHeatingEnergy_kWh: annualHeatingEnergy,
    annualTotalLosses_kWh: annualTotalLosses,
    betaGainUseFactor: betaKpi,
    ventilationCharacteristic_W_m3K: kVent,
    internalGainCharacteristic_W_m3K: qbyt,
    solarGainCharacteristic_W_m3K: qrad,
    averageAirDensity_kg_m3: averageAirDensity,
    averageAirExchange_1_h: averageAirExchange,
    usesPlaceholderInputs,
    placeholderWarnings,
    derivedInputs: {
      betaV,
      LventM3H: Lvent,
      GinfKgH: Ginf,
      nVent,
      nInf,
      kEf,
      c,
    },
  };
}
