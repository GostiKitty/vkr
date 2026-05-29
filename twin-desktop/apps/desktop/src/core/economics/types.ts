import type { Sp50ComplianceReport } from "../thermal/sp50/types";
import type { Sp50ConstructionType } from "../../entities/geometry/types";

export type BuildingType = "private_house" | "public_building" | "apartment_building" | "educational" | "office";
export type HeatingEnergySource = "heat" | "gas" | "electricity" | "unknown";
export type EconomicScenarioMode = "minimum_budget" | "maximum_saving" | "fast_payback" | "comprehensive";
export type EconomicComplexity = "низкая" | "средняя" | "средняя/высокая" | "высокая";
export type EconomicPriorityLevel = "очень высокий" | "высокий" | "средний" | "низкий";
export type EconomicPaybackClass =
  | "быстрая"
  | "средняя"
  | "длительная"
  | "низкая экономическая привлекательность"
  | "не окупается по прямой экономии";
export type EconomicDataQualityLevel = "calculated" | "estimated" | "default";
export type EconomicZoneId =
  | "walls"
  | "windows"
  | "roof"
  | "floor"
  | "doors"
  | "thermalBridges"
  | "ventilationInfiltration"
  | "heatingSystem";

export interface EconomicMeasureDefault {
  name: string;
  unit: "м²" | "комплекс";
  materialCostRubM2?: [number, number];
  workCostRubM2?: [number, number];
  totalCostRubM2?: [number, number];
  totalCostRub?: [number, number];
  expectedHeatLossReductionPercent?: [number, number];
  expectedEnergySavingPercent?: [number, number];
  complexity: EconomicComplexity;
  comfortEffect: string;
  riskReduction?: string;
  /** Расчётный срок службы конструкции/оборудования, лет. Используется для остаточной стоимости в NPV. */
  lifetimeYears?: number;
}

export interface EconomicDefaults {
  region: string;
  currency: string;
  heatTariffRubPerGcal: number;
  electricityTariffRubPerKwh: number;
  regionalCostFactor: number;
  measures: Record<string, EconomicMeasureDefault>;
}

export interface EconomicMeasureDefinition {
  id: string;
  zoneId: EconomicZoneId;
  targetConstructionTypes?: Sp50ConstructionType[];
  kind: "envelope" | "infiltration" | "heating";
  defaultsKey: keyof typeof economicDefaults.measures;
  description: string;
  application: "dominant_zone" | "all_zone_area" | "building_complex";
}

export interface EconomicZoneInput {
  id: EconomicZoneId;
  label: string;
  constructionTypes: Sp50ConstructionType[];
  areaM2: number;
  currentResistance_m2C_W: number | null;
  heatLoss_W: number;
  heatLossShare: number;
  source: "report" | "derived";
  dataQualityLevel: EconomicDataQualityLevel;
  note?: string;
}

export interface EconomicScoreBreakdown {
  energyScore: number;
  moneySavingScore: number;
  paybackScore: number;
  npvScore: number;
  heatLossShareScore: number;
  comfortScore: number;
  riskScore: number;
  complexityScore: number;
  budgetScore: number;
}

export interface EconomicScenario {
  id: string;
  name: string;
  mode: EconomicScenarioMode;
  region: string;
  buildingType: BuildingType;
  heatingEnergySource: HeatingEnergySource;
  heatTariffRubPerGcal: number;
  electricityTariffRubPerKwh: number;
  regionalCostFactor: number;
  /**
   * Удельный выброс CO₂ источника тепла, кг/кВт·ч тепловой энергии.
   * Gas котёл: ~0.22, ЦТ от ТЭЦ на газе: ~0.20, электроотопление: ~0.35.
   */
  co2EmissionFactor_kgPerKWh?: number;
  analysisPeriod_years: number;
  discountRate?: number;
  annualTariffGrowthPercent?: number;
  annualMaintenanceCost_RUB?: number;
  annualMaintenancePercentOfCost?: number;
  residualValuePercent?: number;
  tariff: {
    heatPrice_RUB_kWh: number;
    currency: string;
  };
  /**
   * Тариф на природный газ, руб./м³ (только для heatingEnergySource = "gas").
   * 0 или undefined — газ не используется как источник тепла.
   */
  gasTariffRubPerM3?: number;
  /**
   * Штраф за недобор газа, % от стоимости невыбранного объёма.
   * Применяется когда здание потребляет меньше договорного минимума.
   */
  gasUnderconsumptionPenaltyPercent?: number;
  /** Минимальный объём выборки газа, % от договорного (65–80 %). */
  gasMinimumOfftakePercent?: number;
  /**
   * Доля счёта на централизованное теплоснабжение, не зависящая от фактического потребления.
   * 0.0 — здание с прибором учёта; 0.10–0.25 — нормативный расчёт без счётчика.
   */
  heatContractMinimumPaymentFraction?: number;
  defaults: EconomicDefaults;
  measures: EconomicMeasureDefinition[];
}

export interface EconomicMeasureResult {
  measureId: string;
  measureName: string;
  zoneId: EconomicZoneId;
  zoneLabel: string;
  area_m2: number;
  materialCost_RUB: number;
  workCost_RUB: number;
  totalCost_RUB: number;
  cost_RUB: number;
  heatLossBefore_W: number;
  heatLossReduction_W: number;
  heatLossReductionPercent: number;
  heatLossShare: number;
  savedEnergy_kWh_year: number;
  savedEnergy_Gcal_year: number;
  annualSaving_RUB: number;
  /** Годовой штраф за недобор газа или минимальный платёж по ЦТ, руб./год */
  contractPenalty_RUB: number;
  /** Годовая экономия за вычетом штрафов по договору, руб./год */
  effectiveAnnualSaving_RUB: number;
  /** Снижение выбросов CO₂, т CO₂/год */
  savedCO2_tCO2_year: number | null;
  payback_years: number | null;
  paybackClass: EconomicPaybackClass;
  discountedPayback_years: number | null;
  npv_RUB: number | null;
  profitabilityIndex: number | null;
  economicallyPositive: boolean;
  comfortJustified: boolean;
  priorityScore: number;
  priorityScorePercent: number;
  priorityLevel: EconomicPriorityLevel;
  complexity: EconomicComplexity;
  comfortEffect: string;
  comfortScore: number;
  riskReduction: string;
  riskScore: number;
  implementationScope: string;
  recommendation: string;
  priorityReasons: string[];
  scenarioExplanation: string;
  isRecommended: boolean;
  dataQualityLevel: EconomicDataQualityLevel;
  scoreBreakdown: EconomicScoreBreakdown;
  status: "calculated" | "insufficient_data";
  warnings: string[];
}

export interface EconomicRecommendationSet {
  firstPriority: string | null;
  leaderMeasure: string | null;
  leaderReason: string | null;
  alternativeMeasure: string | null;
  notRecommendedMeasures: string[];
  explanationText: string | null;
  maximumEffect: string | null;
  cheapest: string | null;
  fastestPayback: string | null;
  defer: string | null;
  scenarioLeaderReason: string | null;
}

export interface EconomicAssessmentSummary {
  totalHeatLoss_W: number;
  totalHeatLoss_kW: number;
  mainLossZone: string | null;
  mainLossShare: number | null;
  bestMeasureId: string | null;
  fastestPaybackMeasureId: string | null;
  packageCost_RUB: number;
  packageAnnualSaving_RUB: number;
  /** Суммарный штраф по пакету мероприятий, руб./год */
  packageContractPenalty_RUB: number;
  /** Эффективная экономия пакета за вычетом штрафов, руб./год */
  packageEffectiveAnnualSaving_RUB: number;
  packageSavedEnergy_kWh_year: number;
  packageSavedEnergy_Gcal_year: number;
  /** Суммарное снижение выбросов CO₂ по пакету мер, т CO₂/год */
  packageSavedCO2_tCO2_year: number | null;
  packagePayback_years: number | null;
  packagePaybackClass: EconomicPaybackClass;
  totalCost_RUB: number;
  totalAnnualSaving_RUB: number;
  totalSavedEnergy_kWh_year: number;
  simplePayback_years: number | null;
  npv_RUB: number | null;
  baseAnnualHeatingEnergy_kWh: number | null;
  estimatedAnnualHeatingEnergyBefore_kWh: number | null;
  estimatedAnnualHeatingEnergyAfter_kWh: number | null;
  /** Удельный расход тепловой энергии на отопление до мер, кВт·ч/(м²·год) */
  specificHeatConsumption_kWh_m2: number | null;
  /** Удельный расход после реализации пакета, кВт·ч/(м²·год) */
  specificHeatConsumptionAfter_kWh_m2: number | null;
  /** Нормативный удельный расход по SP50, кВт·ч/(м²·год) */
  sp50EnergyNorm_kWh_m2: number | null;
  /** Класс энергоэффективности здания до мер по SP50.13330 (А++…G) */
  energyClassBefore: string | null;
  /** Класс энергоэффективности здания после реализации пакета */
  energyClassAfter: string | null;
  /** Соответствие нормативу SP50 до мер */
  sp50EnergyComplies: boolean | null;
  /** Срок окупаемости при нулевом росте тарифа, лет */
  paybackAtZeroGrowth_years: number | null;
  /** Срок окупаемости при росте тарифа 10%/год, лет (дисконт = 0) */
  paybackAtHighGrowth_years: number | null;
  isApproximate: boolean;
  hasAnyPayback: boolean;
  allMeasuresNonPayback: boolean;
}

export interface EconomicExportData {
  calculatedAt: string;
  region: string;
  tariffs: {
    heatingEnergySource: HeatingEnergySource;
    heatTariffRubPerGcal: number;
    electricityTariffRubPerKwh: number;
    annualTariffGrowthPercent: number;
  };
  scenario: {
    id: string;
    name: string;
    mode: EconomicScenarioMode;
    analysisPeriod_years: number;
    discountRatePercent: number;
  };
  totalHeatLoss_W: number;
  totalHeatLoss_kW: number;
  zones: EconomicZoneInput[];
  measures: EconomicMeasureResult[];
  recommendedMeasure: string | null;
  summary: EconomicAssessmentSummary;
  warnings: string[];
  engineeringConclusion: string;
}

export interface EconomicAssessmentResult {
  scenario: EconomicScenario;
  sourceReport: Sp50ComplianceReport;
  summary: EconomicAssessmentSummary;
  zones: EconomicZoneInput[];
  measureResults: EconomicMeasureResult[];
  recommendations: EconomicRecommendationSet & string[];
  engineeringConclusion: string;
  exportData: EconomicExportData;
  warnings: string[];
}

export const economicDefaults: EconomicDefaults = {
  region: "Россия",
  currency: "RUB",
  heatTariffRubPerGcal: 3500,
  electricityTariffRubPerKwh: 6,
  regionalCostFactor: 1,
  measures: {
    wallInsulationMineralWool: {
      name: "Утепление наружных стен минеральной ватой",
      unit: "м²",
      materialCostRubM2: [500, 900],
      workCostRubM2: [1200, 2000],
      totalCostRubM2: [1800, 4000],
      expectedHeatLossReductionPercent: [25, 45],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска промерзания и конденсата",
      lifetimeYears: 30,
    },
    wallInsulationPolystyrene: {
      name: "Утепление наружных стен пенополистиролом",
      unit: "м²",
      materialCostRubM2: [450, 850],
      workCostRubM2: [1100, 1800],
      totalCostRubM2: [1700, 3600],
      expectedHeatLossReductionPercent: [22, 40],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска промерзания при корректном узле пароизоляции",
      lifetimeYears: 30,
    },
    wetFacade: {
      name: "Система мокрого фасада",
      unit: "м²",
      totalCostRubM2: [2000, 6000],
      expectedHeatLossReductionPercent: [30, 50],
      complexity: "средняя/высокая",
      comfortEffect: "высокий",
      riskReduction: "снижение мостиков холода в зоне фасада",
      lifetimeYears: 25,
    },
    ventilatedFacade: {
      name: "Вентилируемый фасад с утеплителем",
      unit: "м²",
      totalCostRubM2: [3500, 7500],
      expectedHeatLossReductionPercent: [28, 48],
      complexity: "высокая",
      comfortEffect: "высокий",
      riskReduction: "снижение риска увлажнения ограждения и локального промерзания",
      lifetimeYears: 30,
    },
    roofInsulationMineralWool: {
      name: "Утепление кровли или чердачного перекрытия минеральной ватой",
      unit: "м²",
      totalCostRubM2: [1500, 4000],
      expectedHeatLossReductionPercent: [15, 30],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска конденсата на покрытии",
      lifetimeYears: 25,
    },
    roofInsulationBasalt: {
      name: "Утепление кровли базальтовой ватой",
      unit: "м²",
      totalCostRubM2: [1800, 4300],
      expectedHeatLossReductionPercent: [18, 32],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "уменьшение локального переохлаждения верхних помещений",
      lifetimeYears: 25,
    },
    coldAtticInsulation: {
      name: "Утепление холодного чердака",
      unit: "м²",
      totalCostRubM2: [900, 2600],
      expectedHeatLossReductionPercent: [12, 25],
      complexity: "низкая",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска увлажнения чердачного перекрытия",
      lifetimeYears: 20,
    },
    floorInsulation: {
      name: "Утепление пола или перекрытия над подвалом",
      unit: "м²",
      totalCostRubM2: [1600, 4200],
      expectedHeatLossReductionPercent: [15, 35],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска холодного пола и конденсата у цоколя",
      lifetimeYears: 25,
    },
    windowReplacement: {
      name: "Замена окон на энергоэффективные",
      unit: "м²",
      totalCostRubM2: [8000, 18000],
      expectedHeatLossReductionPercent: [10, 25],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска продувания и переохлаждения откосов",
      lifetimeYears: 20,
    },
    energyGlassUnit: {
      name: "Установка энергосберегающего стеклопакета",
      unit: "м²",
      totalCostRubM2: [5500, 12000],
      expectedHeatLossReductionPercent: [8, 18],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска конденсата на стекле",
      lifetimeYears: 20,
    },
    jointsSealing: {
      name: "Герметизация оконных примыканий",
      unit: "м²",
      totalCostRubM2: [350, 1200],
      expectedHeatLossReductionPercent: [3, 8],
      complexity: "низкая",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска продувания и увлажнения откосов",
      lifetimeYears: 5,
    },
    hardwareAdjustment: {
      name: "Регулировка фурнитуры и замена уплотнителей",
      unit: "комплекс",
      totalCostRub: [8000, 50000],
      expectedHeatLossReductionPercent: [3, 10],
      complexity: "низкая",
      comfortEffect: "средний",
      riskReduction: "снижение локального продувания и конденсата",
      lifetimeYears: 8,
    },
    sealingLeaks: {
      name: "Герметизация щелей и примыканий",
      unit: "комплекс",
      totalCostRub: [10000, 80000],
      expectedHeatLossReductionPercent: [5, 15],
      complexity: "низкая",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска сквозняков, конденсата и плесени",
      lifetimeYears: 5,
    },
    doorInsulation: {
      name: "Утепление входной двери и восстановление уплотнителей",
      unit: "комплекс",
      totalCostRub: [12000, 90000],
      expectedHeatLossReductionPercent: [6, 18],
      complexity: "низкая",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска продувания входной группы",
      lifetimeYears: 10,
    },
    vestibule: {
      name: "Установка тамбура или второй двери",
      unit: "комплекс",
      totalCostRub: [60000, 350000],
      expectedHeatLossReductionPercent: [10, 28],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение пиковых инфильтрационных потерь",
      lifetimeYears: 30,
    },
    thermalBridgeMitigation: {
      name: "Локальное устранение мостиков холода",
      unit: "комплекс",
      totalCostRub: [40000, 250000],
      expectedHeatLossReductionPercent: [10, 35],
      complexity: "средняя",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска промерзания, конденсата и плесени",
      lifetimeYears: 20,
    },
    heatingControl: {
      name: "Терморегуляторы и балансировка отопления",
      unit: "комплекс",
      totalCostRub: [30000, 200000],
      expectedEnergySavingPercent: [5, 20],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение перегревов, недогрева и гидравлических перекосов",
      lifetimeYears: 15,
    },
    weatherControl: {
      name: "Погодозависимое регулирование",
      unit: "комплекс",
      totalCostRub: [50000, 250000],
      expectedEnergySavingPercent: [7, 18],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение перетопов и температурных колебаний",
      lifetimeYears: 15,
    },
    pipeInsulation: {
      name: "Утепление трубопроводов в неотапливаемых зонах",
      unit: "комплекс",
      totalCostRub: [15000, 100000],
      expectedEnergySavingPercent: [2, 8],
      complexity: "низкая",
      comfortEffect: "средний",
      riskReduction: "снижение потерь и риска переохлаждения магистралей",
      lifetimeYears: 15,
    },
  },
};
