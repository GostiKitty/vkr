import type { Sp50ComplianceReport } from "../thermal/sp50/types";
import type { Sp50ConstructionType } from "../../entities/geometry/types";

export type BuildingType = "private_house" | "public_building" | "apartment_building" | "educational" | "office";
export type HeatingEnergySource = "heat" | "electricity" | "unknown";
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
  packageSavedEnergy_kWh_year: number;
  packageSavedEnergy_Gcal_year: number;
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
    },
    wetFacade: {
      name: "Система мокрого фасада",
      unit: "м²",
      totalCostRubM2: [2000, 6000],
      expectedHeatLossReductionPercent: [30, 50],
      complexity: "средняя/высокая",
      comfortEffect: "высокий",
      riskReduction: "снижение мостиков холода в зоне фасада",
    },
    ventilatedFacade: {
      name: "Вентилируемый фасад с утеплителем",
      unit: "м²",
      totalCostRubM2: [3500, 7500],
      expectedHeatLossReductionPercent: [28, 48],
      complexity: "высокая",
      comfortEffect: "высокий",
      riskReduction: "снижение риска увлажнения ограждения и локального промерзания",
    },
    roofInsulationMineralWool: {
      name: "Утепление кровли или чердачного перекрытия минеральной ватой",
      unit: "м²",
      totalCostRubM2: [1500, 4000],
      expectedHeatLossReductionPercent: [15, 30],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска конденсата на покрытии",
    },
    roofInsulationBasalt: {
      name: "Утепление кровли базальтовой ватой",
      unit: "м²",
      totalCostRubM2: [1800, 4300],
      expectedHeatLossReductionPercent: [18, 32],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "уменьшение локального переохлаждения верхних помещений",
    },
    coldAtticInsulation: {
      name: "Утепление холодного чердака",
      unit: "м²",
      totalCostRubM2: [900, 2600],
      expectedHeatLossReductionPercent: [12, 25],
      complexity: "низкая",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска увлажнения чердачного перекрытия",
    },
    floorInsulation: {
      name: "Утепление пола или перекрытия над подвалом",
      unit: "м²",
      totalCostRubM2: [1600, 4200],
      expectedHeatLossReductionPercent: [15, 35],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска холодного пола и конденсата у цоколя",
    },
    windowReplacement: {
      name: "Замена окон на энергоэффективные",
      unit: "м²",
      totalCostRubM2: [8000, 18000],
      expectedHeatLossReductionPercent: [10, 25],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска продувания и переохлаждения откосов",
    },
    energyGlassUnit: {
      name: "Установка энергосберегающего стеклопакета",
      unit: "м²",
      totalCostRubM2: [5500, 12000],
      expectedHeatLossReductionPercent: [8, 18],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение риска конденсата на стекле",
    },
    jointsSealing: {
      name: "Герметизация оконных примыканий",
      unit: "м²",
      totalCostRubM2: [350, 1200],
      expectedHeatLossReductionPercent: [3, 8],
      complexity: "низкая",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска продувания и увлажнения откосов",
    },
    hardwareAdjustment: {
      name: "Регулировка фурнитуры и замена уплотнителей",
      unit: "комплекс",
      totalCostRub: [8000, 50000],
      expectedHeatLossReductionPercent: [3, 10],
      complexity: "низкая",
      comfortEffect: "средний",
      riskReduction: "снижение локального продувания и конденсата",
    },
    sealingLeaks: {
      name: "Герметизация щелей и примыканий",
      unit: "комплекс",
      totalCostRub: [10000, 80000],
      expectedHeatLossReductionPercent: [5, 15],
      complexity: "низкая",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска сквозняков, конденсата и плесени",
    },
    doorInsulation: {
      name: "Утепление входной двери и восстановление уплотнителей",
      unit: "комплекс",
      totalCostRub: [12000, 90000],
      expectedHeatLossReductionPercent: [6, 18],
      complexity: "низкая",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска продувания входной группы",
    },
    vestibule: {
      name: "Установка тамбура или второй двери",
      unit: "комплекс",
      totalCostRub: [60000, 350000],
      expectedHeatLossReductionPercent: [10, 28],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение пиковых инфильтрационных потерь",
    },
    thermalBridgeMitigation: {
      name: "Локальное устранение мостиков холода",
      unit: "комплекс",
      totalCostRub: [40000, 250000],
      expectedHeatLossReductionPercent: [10, 35],
      complexity: "средняя",
      comfortEffect: "средний/высокий",
      riskReduction: "снижение риска промерзания, конденсата и плесени",
    },
    heatingControl: {
      name: "Терморегуляторы и балансировка отопления",
      unit: "комплекс",
      totalCostRub: [30000, 200000],
      expectedEnergySavingPercent: [5, 20],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение перегревов, недогрева и гидравлических перекосов",
    },
    weatherControl: {
      name: "Погодозависимое регулирование",
      unit: "комплекс",
      totalCostRub: [50000, 250000],
      expectedEnergySavingPercent: [7, 18],
      complexity: "средняя",
      comfortEffect: "высокий",
      riskReduction: "снижение перетопов и температурных колебаний",
    },
    pipeInsulation: {
      name: "Утепление трубопроводов в неотапливаемых зонах",
      unit: "комплекс",
      totalCostRub: [15000, 100000],
      expectedEnergySavingPercent: [2, 8],
      complexity: "низкая",
      comfortEffect: "средний",
      riskReduction: "снижение потерь и риска переохлаждения магистралей",
    },
  },
};
