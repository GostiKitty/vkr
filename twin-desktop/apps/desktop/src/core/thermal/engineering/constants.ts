import type {
  EngineeringGridOptions,
  EngineeringMethodEntry,
  ResolvedEngineeringOptions,
  EngineeringScenarioDraft,
  EngineeringSurfaceResistanceProfile,
} from "./types";
import { getDefaultSurfaceResistanceProfile } from "../../../norms/sp50_2024/heatTransferCoefficients";

export const AIR_DENSITY_KG_M3 = 1.204;
export const AIR_HEAT_CAPACITY_J_KG_K = 1005;
export const DEFAULT_WATER_DENSITY_KG_M3 = 998;
export const DEFAULT_WATER_HEAT_CAPACITY_J_KG_K = 4180;
export const DEFAULT_WINDOW_U_W_M2K = 2.0;
export const DEFAULT_DOOR_U_W_M2K = 1.8;
export const DEFAULT_FLOOR_U_W_M2K = 0.45;
export const DEFAULT_ROOF_U_W_M2K = 0.3;
export const DEFAULT_GROUND_TEMPERATURE_C = 8;
export const DEFAULT_SOLAR_IRRADIANCE_W_M2 = 220;
export const DEFAULT_SOLAR_TRANSMITTANCE = 0.62;
export const DEFAULT_SOLAR_SHADING_FACTOR = 0.72;
export const DEFAULT_OCCUPANT_SENSIBLE_GAIN_W = 75;
export const DEFAULT_EFFECTIVE_MASS_FACTOR = 3.2;
export const DEFAULT_EFFECTIVE_AIR_DIFFUSIVITY_M2_S = 1e-3;
export const DEFAULT_ANALYSIS_HOUR = 12;
const DEFAULT_SP50_SURFACE_RESISTANCE = getDefaultSurfaceResistanceProfile();

export const DEFAULT_SURFACE_RESISTANCE_PROFILE: EngineeringSurfaceResistanceProfile = {
  label: "Внутренняя поверхность / наружный воздух",
  internal_m2K_W: DEFAULT_SP50_SURFACE_RESISTANCE.internal_m2K_W,
  external_m2K_W: DEFAULT_SP50_SURFACE_RESISTANCE.external_m2K_W,
  source: "Типовые поверхностные сопротивления для стационарной строительной теплотехники",
};

export const DEFAULT_GRID_OPTIONS: EngineeringGridOptions = {
  cellSizeM: 0.35,
  maxIterations: 400,
  toleranceC: 0.02,
  anchorWeight: 0,
  smoothingPasses: 0,
};

export const DEFAULT_SCENARIO_DRAFT: EngineeringScenarioDraft = {
  name: "Пользовательский сценарий",
  outdoorDeltaC: -5,
  insulationResistanceDelta_m2K_W: 1.2,
  windowUScale: 0.7,
  ventilationMultiplier: 1.2,
  radiatorPowerMultiplier: 1,
  equipmentGainMultiplier: 1,
};

export const DEFAULT_ENGINEERING_OPTIONS: ResolvedEngineeringOptions = {
  mode: "engineering",
  analysisTimeHours: DEFAULT_ANALYSIS_HOUR,
  targetLevelId: null,
  targetTemperatureC: 21,
  ventilationACH: 0.18,
  supplyAirTemperatureC: null,
  floorU_W_m2K: DEFAULT_FLOOR_U_W_M2K,
  roofU_W_m2K: DEFAULT_ROOF_U_W_M2K,
  windowU_W_m2K: DEFAULT_WINDOW_U_W_M2K,
  doorU_W_m2K: DEFAULT_DOOR_U_W_M2K,
  groundTemperatureC: DEFAULT_GROUND_TEMPERATURE_C,
  solarIrradianceW_m2: DEFAULT_SOLAR_IRRADIANCE_W_M2,
  solarTransmittance: DEFAULT_SOLAR_TRANSMITTANCE,
  solarShadingFactor: DEFAULT_SOLAR_SHADING_FACTOR,
  lightingGain_W_m2: 2.6,
  occupancyGain_W_m2: 1.4,
  peopleCount: null,
  peopleSensibleGainW: DEFAULT_OCCUPANT_SENSIBLE_GAIN_W,
  radiatorPowerMultiplier: 1,
  equipmentGainMultiplier: 1,
  effectiveMassFactor: DEFAULT_EFFECTIVE_MASS_FACTOR,
  surfaceResistances: DEFAULT_SURFACE_RESISTANCE_PROFILE,
  grid: DEFAULT_GRID_OPTIONS,
  scenarioDraft: DEFAULT_SCENARIO_DRAFT,
};

export const ENGINEERING_METHODS: EngineeringMethodEntry[] = [
  {
    id: "layer_resistance",
    title: "Термическое сопротивление однородного слоя",
    classification: "physical model",
    formula: "R = d / λ",
    variables: [
      { symbol: "R", description: "термическое сопротивление слоя", unit: "м²·К/Вт" },
      { symbol: "d", description: "толщина слоя", unit: "м" },
      { symbol: "λ", description: "коэффициент теплопроводности материала", unit: "Вт/(м·К)" },
    ],
    explanation: "Формула используется для каждого слоя ограждающей конструкции перед суммированием сопротивлений.",
    physicalMeaning: "Показывает, насколько слой препятствует прохождению теплового потока при одномерной теплопередаче.",
    resultMeaning: "Чем больше R, тем меньше вклад слоя в теплопотери при одинаковом температурном напоре.",
    assumptions: ["Слой однороден", "Теплопередача рассматривается по толщине слоя", "Режим стационарный"],
    applicability: "Стационарный расчет плоских слоистых конструкций.",
    limitations: "Не учитывает двумерные мостики холода, влажностный режим и температурную зависимость λ.",
  },
  {
    id: "total_resistance",
    title: "Суммарное сопротивление многослойной конструкции",
    classification: "physical model",
    formula: "R_total = R_si + Σ(d_i / λ_i) + R_se,  U = 1 / R_total",
    variables: [
      { symbol: "R_si", description: "внутреннее поверхностное сопротивление", unit: "м²·К/Вт" },
      { symbol: "R_se", description: "наружное поверхностное сопротивление", unit: "м²·К/Вт" },
      { symbol: "d_i", description: "толщина i-го слоя", unit: "м" },
      { symbol: "λ_i", description: "теплопроводность i-го слоя", unit: "Вт/(м·К)" },
      { symbol: "U", description: "коэффициент теплопередачи", unit: "Вт/(м²·К)" },
    ],
    explanation: "По этой формуле формируется U-значение стены, если в модели заданы реальные слои.",
    physicalMeaning: "Связывает состав конструкции с итоговой теплопередачей через ограждение.",
    resultMeaning: "Результат дает суммарное сопротивление и U-значение, которые потом напрямую входят в расчет теплопотерь.",
    assumptions: ["Поверхностные сопротивления заданы отдельно", "Слои соединены последовательно", "Режим стационарный"],
    applicability: "Наружные стены, покрытия, перекрытия и другие слоистые ограждения.",
    limitations: "Не заменяет узловой расчет сопряжений и линейных теплопотерь.",
  },
  {
    id: "transmission_loss",
    title: "Стационарная теплопередача через ограждение",
    classification: "physical model",
    formula: "Q = U · A · ΔT",
    variables: [
      { symbol: "Q", description: "тепловой поток", unit: "Вт" },
      { symbol: "U", description: "коэффициент теплопередачи", unit: "Вт/(м²·К)" },
      { symbol: "A", description: "площадь конструкции", unit: "м²" },
      { symbol: "ΔT", description: "разность температур внутренней и наружной среды", unit: "К" },
    ],
    explanation: "Используется для стен, окон, дверей, пола и покрытия в стационарном инженерном балансе.",
    physicalMeaning: "Дает мощность теплопотерь через конкретный элемент оболочки при заданной разности температур.",
    resultMeaning: "Результат показывает, сколько ватт теряется через конкретное ограждение в расчетном режиме.",
    assumptions: ["Установившийся режим", "Используется эквивалентное U-значение элемента"],
    applicability: "Быстрая и инженерно корректная оценка потерь через оболочку.",
    limitations: "Не описывает суточную тепловую инерцию конструкции.",
  },
  {
    id: "ventilation_loss",
    title: "Потери на вентиляцию и инфильтрацию",
    classification: "physical model",
    formula: "Q_vent = ρ · c_p · L · ΔT,   L = n · V / 3600",
    variables: [
      { symbol: "Q_vent", description: "потери на подогрев воздуха", unit: "Вт" },
      { symbol: "ρ", description: "плотность воздуха", unit: "кг/м³" },
      { symbol: "c_p", description: "удельная теплоемкость воздуха", unit: "Дж/(кг·К)" },
      { symbol: "L", description: "объемный расход воздуха", unit: "м³/с" },
      { symbol: "n", description: "кратность воздухообмена", unit: "1/ч" },
      { symbol: "V", description: "объем помещения", unit: "м³" },
    ],
    explanation: "Формула применяется напрямую, без замен на декоративные коэффициенты потерь воздуха.",
    physicalMeaning: "Определяет, сколько тепловой мощности требуется для нагрева поступающего воздуха до внутренней температуры.",
    resultMeaning: "Результат показывает долю теплопотерь, связанную именно с воздухообменом и инфильтрацией.",
    assumptions: ["Считается только чувствительная теплота", "Свойства воздуха принимаются постоянными"],
    applicability: "Вентиляционные и инфильтрационные потери в жилых и общественных помещениях.",
    limitations: "Не учитывает влагосодержание и рекуперацию тепла.",
  },
  {
    id: "room_balance",
    title: "Стационарный тепловой баланс помещения",
    classification: "physical model",
    formula: "Q_balance = Q_gains - Q_losses,   Q_deficit = max(Q_losses - Q_gains, 0)",
    variables: [
      { symbol: "Q_balance", description: "итоговый тепловой баланс помещения", unit: "Вт" },
      { symbol: "Q_gains", description: "сумма теплопритоков", unit: "Вт" },
      { symbol: "Q_losses", description: "сумма теплопотерь", unit: "Вт" },
      { symbol: "Q_deficit", description: "требуемая дополнительная мощность отопления", unit: "Вт" },
    ],
    explanation: "На этой формуле основан итоговый вывод о дефиците тепла и требуемой мощности отопления.",
    physicalMeaning: "Показывает, хватает ли имеющихся теплопритоков для компенсации потерь.",
    resultMeaning: "Если баланс отрицателен, модуль выдает дефицит как требуемую дополнительную мощность отопления.",
    assumptions: ["Баланс составлен для выбранного расчетного среза по времени", "Притоки и потери суммируются по мощности"],
    applicability: "Стационарный и квазистационарный инженерный анализ помещения.",
    limitations: "Не описывает переходные процессы без учета теплоемкости.",
  },
  {
    id: "lumped_rc",
    title: "Сосредоточенная RC-модель помещения",
    classification: "engineering approximation",
    formula: "C_eff · dT/dt = Q_in - Q_out,   T_(k+1) = T_k + (Δt / C_eff) · (Q_in - Q_out)",
    variables: [
      { symbol: "C_eff", description: "эффективная теплоемкость воздуха и активной массы", unit: "Дж/К" },
      { symbol: "T_k", description: "температура на текущем шаге", unit: "°C" },
      { symbol: "T_(k+1)", description: "температура на следующем шаге", unit: "°C" },
      { symbol: "Δt", description: "шаг по времени", unit: "с" },
      { symbol: "Q_in", description: "теплопритоки и отопление", unit: "Вт" },
      { symbol: "Q_out", description: "теплопотери через оболочку и воздух", unit: "Вт" },
    ],
    explanation: "Эта модель используется только для сценарного прогноза во времени и честно обозначена как lumped / RC.",
    physicalMeaning: "Описывает, как средняя температура помещения меняется во времени под действием баланса мощностей.",
    resultMeaning: "Результат дает прогноз средней температуры помещения на каждом временном шаге сценария.",
    assumptions: ["Помещение представлено одной усредненной температурой", "Тепловая масса сведена к одному эквивалентному C_eff"],
    applicability: "Сценарный прогноз, время прогрева, сравнение вариантов эксплуатации.",
    limitations: "Это не CFD и не распределенная по объему модель температуры.",
  },
  {
    id: "steady_planar_field",
    title: "Стационарное температурное поле на плановой сетке",
    classification: "engineering approximation",
    formula: "∇ · (k_eff ∇T) + q = 0,   T_(i,j) = (T_E + T_W + T_N + T_S + q_(i,j) h² / k_eff) / 4",
    variables: [
      { symbol: "k_eff", description: "эффективная теплопроводность смешанного воздуха в плоскости", unit: "Вт/(м·К)" },
      { symbol: "q", description: "объемный источник тепла", unit: "Вт/м³" },
      { symbol: "h", description: "шаг расчетной сетки", unit: "м" },
      { symbol: "T_E, T_W, T_N, T_S", description: "температуры соседних узлов", unit: "°C" },
    ],
    explanation: "Поле считается методом конечных разностей по стандартной 5-точечной схеме на равномерной сетке.",
    physicalMeaning: "Позволяет оценить распределение температуры по плану помещения с учетом граничных температур и реальных тепловых источников.",
    resultMeaning: "Результат дает стационарное поле температуры по ячейкам сетки, пригодное для инженерной тепловой карты.",
    assumptions: [
      "Рассматривается 2D-проекция на плане",
      "Конвективное перемешивание сведено к эффективной плановой диффузии",
      "Источники задаются через объемную мощность q",
    ],
    applicability: "Инженерная тепловая карта помещения по плану.",
    limitations: "Не описывает вертикальную стратификацию и не заменяет полноценный CFD/FEM расчет.",
  },
  {
    id: "boundary_conditions",
    title: "Граничные условия для теплового поля",
    classification: "engineering approximation",
    formula: "T = T_boundary;   -k ∂T/∂n = q_n;   -k ∂T/∂n = h · (T_surface - T_air)",
    variables: [
      { symbol: "T_boundary", description: "заданная температура границы", unit: "°C" },
      { symbol: "q_n", description: "заданный нормальный тепловой поток", unit: "Вт/м²" },
      { symbol: "h", description: "коэффициент теплоотдачи", unit: "Вт/(м²·К)" },
      { symbol: "T_surface", description: "температура поверхности", unit: "°C" },
      { symbol: "T_air", description: "температура воздуха у границы", unit: "°C" },
    ],
    explanation: "В модуле используются упрощенные граничные температуры на стенах, рассчитанные из стационарного теплового сопротивления ограждений.",
    physicalMeaning: "Граничные условия задают, как помещение обменивается теплом с оболочкой и соседними помещениями.",
    resultMeaning: "Результат постановки определяет, какие температуры или тепловые потоки закреплены на границах расчетной области.",
    assumptions: ["Для карты по плану применяются фиксированные температуры внутренних поверхностей как упрощение"],
    applicability: "Постановка стационарной задачи на сетке без полного 3D-расчета поверхности.",
    limitations: "В текущей реализации используется упрощение Дирихле по внутренним поверхностям, а не полный конвективный Robin на каждой ячейке.",
  },
  {
    id: "sensitivity_index",
    title: "Коэффициент чувствительности",
    classification: "engineering approximation",
    formula: "S_x = (ΔY / Y) / (ΔX / X)",
    variables: [
      { symbol: "X", description: "входной параметр", unit: "в зависимости от параметра" },
      { symbol: "Y", description: "выходная метрика, здесь требуемая мощность отопления", unit: "Вт" },
      { symbol: "ΔX", description: "изменение входного параметра", unit: "в зависимости от параметра" },
      { symbol: "ΔY", description: "изменение выходной метрики", unit: "Вт" },
    ],
    explanation: "Чувствительность считается не по произвольным весам, а по конечному пересчету модели после контролируемого изменения входа.",
    physicalMeaning: "Показывает, насколько сильно относительное изменение параметра влияет на относительное изменение результата.",
    resultMeaning: "Знак и модуль коэффициента позволяют сравнить, какие входные параметры сильнее всего влияют на требуемую мощность отопления.",
    assumptions: ["Используется локальное конечное возмущение около базовой точки расчета"],
    applicability: "Сравнение влияния U, вентиляции, наружной температуры и отопительной мощности.",
    limitations: "Это локальный, а не глобальный анализ чувствительности.",
  },
];
