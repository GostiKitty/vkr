/**
 * Региональные профили энергоснабжения.
 * Тарифы ориентировочные на 2024–2025 г., актуализируются по данным ФАС/ФСТ.
 * Штрафы за недобор газа — по типовым условиям договоров промышленных потребителей
 * (ПП РФ №549, №366). Для населения с приборами учёта штраф обычно 0.
 */
export interface CityEnergyProfile {
  cityId: string;
  /** Тариф на тепловую энергию от ЦТ, руб./Гкал */
  heatTariffRubPerGcal: number;
  /** Тариф на электроэнергию (население), руб./кВт·ч */
  electricityTariffRubPerKwh: number;
  /**
   * Тариф на природный газ, руб./м³.
   * 0 — если газ в регионе практически недоступен или не применяется для отопления.
   */
  gasTariffRubPerM3: number;
  /** Газоснабжение доступно в регионе */
  gasAvailable: boolean;
  /**
   * Штраф за недобор газа, % от стоимости невыбранного объёма.
   * Применяется когда фактическое потребление < договорного минимума.
   * Типичный диапазон: 20–35 % (для коммерческих/промышленных потребителей).
   * Для населения с приборами учёта — 0.
   */
  gasUnderconsumptionPenaltyPercent: number;
  /**
   * Минимальный объём выборки по договору газоснабжения, % от годового договорного объёма.
   * Если фактическое потребление ниже этого порога — начисляется штраф за недобор.
   * Типичный диапазон: 65–80 %.
   */
  gasMinimumOfftakePercent: number;
  /**
   * Доля счёта на тепловую энергию (ЦТ), не зависящая от фактического потребления
   * (абонентская плата, плата за поддержание подключённой мощности).
   * 0.0 — полностью переменная оплата (здания с узлами учёта);
   * 0.10–0.25 — типичный диапазон для зданий без приборов учёта или с нормативным расчётом.
   */
  heatContractMinimumPaymentFraction: number;
  /**
   * Региональный коэффициент к базовым ценам строительных материалов и работ.
   * Москва = 1.00; значения < 1 — регионы с более низкой стоимостью рабочей силы и материалов.
   */
  constructionCostFactor: number;
  /**
   * Ожидаемый среднегодовой рост тарифа на тепло/электроэнергию для населения, %.
   * Ориентир: индексация ЖКХ (Распоряжение Правительства №3287-р: 2025 — 11,9 %, 2026 — 5,4 %, 2027 — 4,8 %).
   */
  annualTariffGrowthPercent?: number;
}

/** Средний рост тарифов ЖКХ по РФ на горизонте 2025–2027 (см. №3287-р), %/год */
export const DEFAULT_ANNUAL_TARIFF_GROWTH_PERCENT = 8;

/** Теплотворная способность природного газа (низшая), кВт·ч/м³ */
export const GAS_LCV_KWH_PER_M3 = 9.3;

/** КПД стандартного газового котла (используется для пересчёта тарифа в руб./кВт·ч тепла) */
export const DEFAULT_BOILER_EFFICIENCY = 0.92;

/** Переводит тариф на газ руб./м³ → руб./кВт·ч тепловой энергии на выходе котла */
export function gasM3TariffToKwh(tariffRubPerM3: number, efficiency = DEFAULT_BOILER_EFFICIENCY): number {
  if (tariffRubPerM3 <= 0 || efficiency <= 0) {
    return 0;
  }
  return tariffRubPerM3 / (GAS_LCV_KWH_PER_M3 * efficiency);
}

export const CITY_ENERGY_PROFILES: CityEnergyProfile[] = [
  // ─── Европейская часть ───────────────────────────────────────────────────
  {
    cityId: "moscow",
    heatTariffRubPerGcal: 3200,
    electricityTariffRubPerKwh: 5.8,
    gasTariffRubPerM3: 7.4,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 30,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.10,
    constructionCostFactor: 1.00,
    annualTariffGrowthPercent: 10,
  },
  {
    cityId: "spb",
    heatTariffRubPerGcal: 3100,
    electricityTariffRubPerKwh: 5.5,
    gasTariffRubPerM3: 7.2,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 28,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.12,
    constructionCostFactor: 0.95,
    annualTariffGrowthPercent: 10,
  },
  {
    cityId: "voronezh",
    heatTariffRubPerGcal: 2600,
    electricityTariffRubPerKwh: 4.5,
    gasTariffRubPerM3: 7.0,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 25,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.76,
    annualTariffGrowthPercent: 9,
  },
  {
    cityId: "nizhny_novgorod",
    heatTariffRubPerGcal: 2750,
    electricityTariffRubPerKwh: 4.5,
    gasTariffRubPerM3: 7.0,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 25,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.82,
    annualTariffGrowthPercent: 9,
  },
  {
    cityId: "kazan",
    heatTariffRubPerGcal: 2500,
    electricityTariffRubPerKwh: 3.7,
    gasTariffRubPerM3: 6.8,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 22,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.80,
    annualTariffGrowthPercent: 9,
  },
  {
    cityId: "samara",
    heatTariffRubPerGcal: 2600,
    electricityTariffRubPerKwh: 3.9,
    gasTariffRubPerM3: 6.5,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 22,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.79,
    annualTariffGrowthPercent: 9,
  },
  {
    cityId: "ufa",
    heatTariffRubPerGcal: 2400,
    electricityTariffRubPerKwh: 3.5,
    gasTariffRubPerM3: 6.0,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 20,
    gasMinimumOfftakePercent: 65,
    heatContractMinimumPaymentFraction: 0.18,
    constructionCostFactor: 0.78,
    annualTariffGrowthPercent: 8,
  },
  {
    cityId: "saratov",
    heatTariffRubPerGcal: 2550,
    electricityTariffRubPerKwh: 4.3,
    gasTariffRubPerM3: 6.8,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 22,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.76,
    annualTariffGrowthPercent: 9,
  },
  {
    cityId: "volgograd",
    heatTariffRubPerGcal: 2500,
    electricityTariffRubPerKwh: 4.5,
    gasTariffRubPerM3: 6.7,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 22,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.77,
    annualTariffGrowthPercent: 9,
  },
  {
    cityId: "rostov",
    heatTariffRubPerGcal: 3000,
    electricityTariffRubPerKwh: 4.8,
    gasTariffRubPerM3: 6.9,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 25,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.12,
    constructionCostFactor: 0.82,
    annualTariffGrowthPercent: 10,
  },
  {
    cityId: "krasnodar",
    heatTariffRubPerGcal: 2900,
    electricityTariffRubPerKwh: 5.0,
    gasTariffRubPerM3: 6.5,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 22,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.12,
    constructionCostFactor: 0.87,
    annualTariffGrowthPercent: 10,
  },
  // ─── Урал ────────────────────────────────────────────────────────────────
  {
    cityId: "ekb",
    heatTariffRubPerGcal: 2800,
    electricityTariffRubPerKwh: 4.2,
    gasTariffRubPerM3: 6.8,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 25,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.85,
    annualTariffGrowthPercent: 9,
  },
  {
    cityId: "chelyabinsk",
    heatTariffRubPerGcal: 2650,
    electricityTariffRubPerKwh: 3.8,
    gasTariffRubPerM3: 6.5,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 25,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.80,
    annualTariffGrowthPercent: 9,
  },
  {
    cityId: "perm",
    heatTariffRubPerGcal: 2700,
    electricityTariffRubPerKwh: 4.0,
    gasTariffRubPerM3: 6.5,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 25,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.80,
    annualTariffGrowthPercent: 9,
  },
  // ─── Западная Сибирь ─────────────────────────────────────────────────────
  {
    cityId: "tyumen",
    heatTariffRubPerGcal: 2100,
    electricityTariffRubPerKwh: 2.5,
    gasTariffRubPerM3: 5.8,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 18,
    gasMinimumOfftakePercent: 65,
    heatContractMinimumPaymentFraction: 0.10,
    constructionCostFactor: 0.92,
    annualTariffGrowthPercent: 7,
  },
  {
    cityId: "omsk",
    heatTariffRubPerGcal: 2200,
    electricityTariffRubPerKwh: 3.5,
    gasTariffRubPerM3: 7.2,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 25,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.80,
    annualTariffGrowthPercent: 8,
  },
  {
    cityId: "novosibirsk",
    heatTariffRubPerGcal: 2700,
    electricityTariffRubPerKwh: 3.2,
    gasTariffRubPerM3: 7.5,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 25,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.83,
    annualTariffGrowthPercent: 8,
  },
  {
    cityId: "tomsk",
    heatTariffRubPerGcal: 2300,
    electricityTariffRubPerKwh: 3.8,
    gasTariffRubPerM3: 7.3,
    gasAvailable: true,
    gasUnderconsumptionPenaltyPercent: 25,
    gasMinimumOfftakePercent: 70,
    heatContractMinimumPaymentFraction: 0.15,
    constructionCostFactor: 0.82,
    annualTariffGrowthPercent: 8,
  },
  // ─── Восточная Сибирь и ДВ ───────────────────────────────────────────────
  {
    cityId: "krasnoyarsk",
    heatTariffRubPerGcal: 2200,
    electricityTariffRubPerKwh: 2.0,
    gasTariffRubPerM3: 0,
    gasAvailable: false,
    gasUnderconsumptionPenaltyPercent: 0,
    gasMinimumOfftakePercent: 0,
    heatContractMinimumPaymentFraction: 0.10,
    constructionCostFactor: 0.88,
    annualTariffGrowthPercent: 7,
  },
  {
    cityId: "irkutsk",
    heatTariffRubPerGcal: 1800,
    electricityTariffRubPerKwh: 1.2,
    gasTariffRubPerM3: 0,
    gasAvailable: false,
    gasUnderconsumptionPenaltyPercent: 0,
    gasMinimumOfftakePercent: 0,
    heatContractMinimumPaymentFraction: 0.10,
    constructionCostFactor: 0.85,
    annualTariffGrowthPercent: 7,
  },
  {
    cityId: "khabarovsk",
    heatTariffRubPerGcal: 2800,
    electricityTariffRubPerKwh: 4.0,
    gasTariffRubPerM3: 0,
    gasAvailable: false,
    gasUnderconsumptionPenaltyPercent: 0,
    gasMinimumOfftakePercent: 0,
    heatContractMinimumPaymentFraction: 0.12,
    constructionCostFactor: 0.90,
    annualTariffGrowthPercent: 9,
  },
];

const _profileIndex = new Map<string, CityEnergyProfile>(
  CITY_ENERGY_PROFILES.map((p) => [p.cityId, p])
);

export function getCityEnergyProfile(cityId: string | null | undefined): CityEnergyProfile | null {
  if (!cityId) {
    return null;
  }
  return _profileIndex.get(cityId.trim().toLowerCase()) ?? null;
}
