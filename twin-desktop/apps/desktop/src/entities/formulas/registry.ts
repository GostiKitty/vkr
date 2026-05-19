export type FormulaModule = "Geometry" | "Envelope" | "Thermal" | "Uncertainty" | "Calibration";

export interface FormulaVariable {
  key: string;
  symbolLatex?: string;
  label: string;
  unit?: string;
  source?: string;
}

export interface Formula {
  id: string;
  title: string;
  latex: string;
  description: string;
  variables: FormulaVariable[];
  module: FormulaModule;
  methodName: string;
  applicability: string;
  assumptions: string[];
  physicalMeaning: string;
  resultMeaning: string;
}

export interface Assumption {
  id: string;
  label: string;
  value: string;
  unit: string;
  description: string;
  source: string;
}

export const formulaModules: FormulaModule[] = ["Geometry", "Envelope", "Thermal", "Uncertainty", "Calibration"];

export const formulaRegistry: Formula[] = [
  {
    id: "geom_polygon_area",
    module: "Geometry",
    title: "Площадь произвольного многоугольника",
    latex: String.raw`A = \frac{1}{2}\left|\sum_{i=1}^{n} x_i y_{i+1} - x_{i+1} y_i\right|`,
    description: "Формула шнуровки используется для расчета площади контура помещения на плане.",
    methodName: "Shoelace formula",
    applicability: "Плоские замкнутые полигоны без самопересечений.",
    assumptions: ["Контур замкнут", "Вершины перечислены по порядку обхода"],
    physicalMeaning: "Дает реальную геометрическую площадь помещения по координатам вершин.",
    resultMeaning: "Результат используется для объема, удельных нагрузок и инженерных расчетов.",
    variables: [
      { key: "area", symbolLatex: "A", label: "площадь полигона", unit: "м²", source: "выход" },
      { key: "vertex_coords", symbolLatex: "x_i, y_i", label: "координаты вершин", unit: "м", source: "геометрия модели" },
      { key: "vertex_count", symbolLatex: "n", label: "число вершин", source: "геометрия модели" },
    ],
  },
  {
    id: "geom_volume",
    module: "Geometry",
    title: "Объем помещения",
    latex: String.raw`V = A \cdot h`,
    description: "Объем помещения принимается как площадь пола, умноженная на высоту уровня.",
    methodName: "Призматическая геометрическая модель",
    applicability: "Помещения с постоянной высотой по плану.",
    assumptions: ["Высота помещения принимается равной высоте уровня или заданной высоте комнаты"],
    physicalMeaning: "Дает геометрический объем воздуха в помещении.",
    resultMeaning: "Используется для воздухообмена, теплоемкости воздуха и баланса теплоты.",
    variables: [
      { key: "volume", symbolLatex: "V", label: "объем помещения", unit: "м³", source: "выход" },
      { key: "area", symbolLatex: "A", label: "площадь пола", unit: "м²", source: "геометрия модели" },
      { key: "level_height", symbolLatex: "h", label: "высота помещения или уровня", unit: "м", source: "геометрия модели" },
    ],
  },
  {
    id: "layer_resistance",
    module: "Envelope",
    title: "Сопротивление теплопередаче слоя",
    latex: String.raw`R = \frac{d}{\lambda}`,
    description: "Термическое сопротивление однородного слоя рассчитывается по толщине и теплопроводности материала.",
    methodName: "Стационарная одномерная теплопроводность",
    applicability: "Однородные слои в плоской ограждающей конструкции.",
    assumptions: ["Материал слоя однороден", "Теплопередача рассматривается по толщине слоя"],
    physicalMeaning: "Показывает, насколько слой препятствует тепловому потоку.",
    resultMeaning: "Чем больше R, тем меньше теплопотери через слой при прочих равных.",
    variables: [
      { key: "resistance", symbolLatex: "R", label: "термическое сопротивление слоя", unit: "м²·К/Вт", source: "выход" },
      { key: "thickness", symbolLatex: "d", label: "толщина слоя", unit: "м", source: "материал/конструкция" },
      { key: "conductivity", symbolLatex: "\\lambda", label: "коэффициент теплопроводности", unit: "Вт/(м·К)", source: "материал" },
    ],
  },
  {
    id: "total_resistance",
    module: "Envelope",
    title: "Суммарное сопротивление и U-значение конструкции",
    latex: String.raw`R_{total} = R_{si} + \sum_i \frac{d_i}{\lambda_i} + R_{se}, \quad U = \frac{1}{R_{total}}`,
    description: "Сопротивления слоев и поверхностные сопротивления складываются, после чего находится U-значение ограждения.",
    methodName: "Расчет многослойной ограждающей конструкции",
    applicability: "Многослойные стены, покрытия, перекрытия при стационарном режиме.",
    assumptions: ["Слои соединены последовательно", "Используются эквивалентные поверхностные сопротивления"],
    physicalMeaning: "Связывает состав конструкции с общей теплопередачей через ограждение.",
    resultMeaning: "U используется далее в формуле потерь через ограждение.",
    variables: [
      { key: "r_total", symbolLatex: "R_{total}", label: "суммарное сопротивление теплопередаче", unit: "м²·К/Вт", source: "расчет" },
      { key: "r_si", symbolLatex: "R_{si}", label: "внутреннее поверхностное сопротивление", unit: "м²·К/Вт", source: "допущение/норма" },
      { key: "r_se", symbolLatex: "R_{se}", label: "наружное поверхностное сопротивление", unit: "м²·К/Вт", source: "допущение/норма" },
      { key: "u_value", symbolLatex: "U", label: "коэффициент теплопередачи", unit: "Вт/(м²·К)", source: "расчет" },
    ],
  },
  {
    id: "envelope_heat_loss",
    module: "Envelope",
    title: "Теплопотери через ограждение",
    latex: String.raw`\dot{Q} = U \cdot A \cdot (T_{in} - T_{out})`,
    description: "Стационарная инженерная формула для стены, окна, двери, пола, потолка и кровли.",
    methodName: "Формула стационарной теплопередачи через ограждение",
    applicability: "Стационарная или квазистационарная оценка потерь.",
    assumptions: ["Установившийся режим", "Используется эквивалентное U-значение элемента"],
    physicalMeaning: "Дает тепловой поток через конкретный элемент оболочки.",
    resultMeaning: "Результат показывает мощность теплопотерь в ваттах.",
    variables: [
      { key: "u_value", symbolLatex: "U", label: "коэффициент теплопередачи", unit: "Вт/(м²·К)", source: "конструкция/настройки" },
      { key: "area", symbolLatex: "A", label: "площадь элемента", unit: "м²", source: "геометрия модели" },
      { key: "t_in", symbolLatex: "T_{in}", label: "внутренняя температура", unit: "°C", source: "уставка/расчет" },
      { key: "t_out", symbolLatex: "T_{out}", label: "наружная температура", unit: "°C", source: "климат/сценарий" },
    ],
  },
  {
    id: "transmission_loss",
    module: "Envelope",
    title: "Стационарная теплопередача через оболочку",
    latex: String.raw`Q = U \cdot A \cdot \Delta T`,
    description: "Та же физическая зависимость, используемая в инженерном блоке результатов и объяснениях методики.",
    methodName: "Стационарная теплопередача",
    applicability: "Любой элемент оболочки, для которого задано U.",
    assumptions: ["Перепад температур считается заданным", "Поток одномерно усреднен через эквивалентное U"],
    physicalMeaning: "Связывает свойства оболочки, ее площадь и температурный напор.",
    resultMeaning: "Результат показывает вклад конкретного элемента в суммарные потери.",
    variables: [
      { key: "heat_flow", symbolLatex: "Q", label: "тепловой поток", unit: "Вт", source: "выход" },
      { key: "u_value", symbolLatex: "U", label: "коэффициент теплопередачи", unit: "Вт/(м²·К)", source: "конструкция/настройки" },
      { key: "area", symbolLatex: "A", label: "площадь конструкции", unit: "м²", source: "геометрия модели" },
      { key: "delta_t", symbolLatex: "\\Delta T", label: "разность температур внутри и снаружи", unit: "К", source: "расчет" },
    ],
  },
  {
    id: "envelope_infiltration",
    module: "Envelope",
    title: "Теплопотери на инфильтрацию",
    latex: String.raw`\dot{Q}_{inf} = \rho \, c_p \, \dot{V}_{inf} \, (T_{in} - T_{out})`,
    description: "Чувствительная теплота воздуха, теряемая на инфильтрационный приток наружного воздуха.",
    methodName: "Формула чувствительной теплоты воздуха",
    applicability: "Инфильтрация и неучтенный подсос наружного воздуха.",
    assumptions: ["Учитывается только чувствительная теплота", "Свойства воздуха принимаются постоянными"],
    physicalMeaning: "Определяет требуемую мощность на нагрев наружного воздуха до температуры помещения.",
    resultMeaning: "Результат показывает потери в ваттах из-за инфильтрации.",
    variables: [
      { key: "rho_air", symbolLatex: "\\rho", label: "плотность воздуха", unit: "кг/м³", source: "константа" },
      { key: "cp_air", symbolLatex: "c_p", label: "удельная теплоемкость воздуха", unit: "Дж/(кг·К)", source: "константа" },
      { key: "v_dot_inf", symbolLatex: "\\dot{V}_{inf}", label: "расход инфильтрации", unit: "м³/с", source: "кратность/объем" },
      { key: "delta_t", symbolLatex: "T_{in} - T_{out}", label: "разность температур", unit: "К", source: "расчет" },
    ],
  },
  {
    id: "ventilation_loss",
    module: "Envelope",
    title: "Теплопотери на вентиляцию",
    latex: String.raw`\dot{Q}_{vent} = \rho \, c_p \, L \, \Delta T, \quad L = \frac{nV}{3600}`,
    description: "Инженерная формула для механического воздухообмена, когда задана кратность или расход приточного воздуха.",
    methodName: "Формула чувствительной теплоты воздуха",
    applicability: "Механическая вентиляция и приточные системы без учета влагообмена.",
    assumptions: ["Воздух считается сухим", "Рекуперация тепла учитывается отдельно, если она есть"],
    physicalMeaning: "Связывает расход воздуха с тепловой нагрузкой на его нагрев.",
    resultMeaning: "Результат показывает потери на подогрев приточного воздуха.",
    variables: [
      { key: "q_vent", symbolLatex: "\\dot{Q}_{vent}", label: "потери на вентиляцию", unit: "Вт", source: "выход" },
      { key: "rho_air", symbolLatex: "\\rho", label: "плотность воздуха", unit: "кг/м³", source: "константа" },
      { key: "cp_air", symbolLatex: "c_p", label: "удельная теплоемкость воздуха", unit: "Дж/(кг·К)", source: "константа" },
      { key: "airflow", symbolLatex: "L", label: "объемный расход воздуха", unit: "м³/с", source: "вентиляция" },
      { key: "ach", symbolLatex: "n", label: "кратность воздухообмена", unit: "1/ч", source: "сценарий" },
      { key: "volume", symbolLatex: "V", label: "объем помещения", unit: "м³", source: "геометрия модели" },
    ],
  },
  {
    id: "thermal_balance",
    module: "Thermal",
    title: "Тепловой баланс помещения",
    latex: String.raw`Q_{balance} = Q_{gains} - Q_{losses}, \quad Q_{deficit} = \max(Q_{losses} - Q_{gains}, 0)`,
    description: "Итоговый стационарный баланс притоков и потерь в помещении.",
    methodName: "Стационарный тепловой баланс",
    applicability: "Инженерная оценка требуемой мощности отопления на расчетный момент.",
    assumptions: ["Притоки и потери суммируются по мощности", "Баланс относится к выбранному расчетному срезу"],
    physicalMeaning: "Показывает, хватает ли имеющихся теплопритоков для компенсации теплопотерь.",
    resultMeaning: "Q_deficit равен требуемой дополнительной мощности отопления.",
    variables: [
      { key: "q_balance", symbolLatex: "Q_{balance}", label: "итоговый тепловой баланс", unit: "Вт", source: "расчет" },
      { key: "q_gains", symbolLatex: "Q_{gains}", label: "сумма теплопритоков", unit: "Вт", source: "расчет" },
      { key: "q_losses", symbolLatex: "Q_{losses}", label: "сумма теплопотерь", unit: "Вт", source: "расчет" },
      { key: "q_deficit", symbolLatex: "Q_{deficit}", label: "требуемая мощность отопления", unit: "Вт", source: "выход" },
    ],
  },
  {
    id: "thermal_balance_room",
    module: "Thermal",
    title: "Тепловой баланс помещения",
    latex: String.raw`Q_{balance} = Q_{gains} - Q_{losses}`,
    description: "Короткая версия баланса для подсказок в редакторе и свойствах помещений.",
    methodName: "Стационарный тепловой баланс",
    applicability: "Быстрые подсказки в Build Mode и панели свойств.",
    assumptions: ["Используется тот же баланс, что и в инженерной вкладке результатов"],
    physicalMeaning: "Показывает знак избытка или дефицита теплоты в помещении.",
    resultMeaning: "Положительный баланс означает избыток, отрицательный - дефицит теплоты.",
    variables: [
      { key: "q_balance", symbolLatex: "Q_{balance}", label: "итоговый тепловой баланс", unit: "Вт", source: "расчет" },
      { key: "q_gains", symbolLatex: "Q_{gains}", label: "теплопритоки", unit: "Вт", source: "расчет" },
      { key: "q_losses", symbolLatex: "Q_{losses}", label: "теплопотери", unit: "Вт", source: "расчет" },
    ],
  },
  {
    id: "rc_lumped",
    module: "Thermal",
    title: "Сосредоточенная RC-модель помещения",
    latex: String.raw`C_{eff}\frac{dT}{dt} = Q_{in} - Q_{out}, \quad T_{k+1} = T_k + \frac{\Delta t}{C_{eff}}(Q_{in} - Q_{out})`,
    description: "Модель первого порядка используется для прогноза температуры и сценарного сравнения.",
    methodName: "Lumped capacitance / RC model",
    applicability: "Прогноз средней температуры помещения во времени.",
    assumptions: ["Помещение описывается одной усредненной температурой", "Температурное поле по объему не разрешается"],
    physicalMeaning: "Определяет изменение средней температуры по балансу мощностей и эффективной теплоемкости.",
    resultMeaning: "Результат показывает, как будет меняться средняя температура помещения шаг за шагом.",
    variables: [
      { key: "c_eff", symbolLatex: "C_{eff}", label: "эффективная теплоемкость", unit: "Дж/К", source: "расчет" },
      { key: "temperature", symbolLatex: "T_k", label: "температура на текущем шаге", unit: "°C", source: "состояние модели" },
      { key: "next_temperature", symbolLatex: "T_{k+1}", label: "температура на следующем шаге", unit: "°C", source: "выход" },
      { key: "time_step", symbolLatex: "\\Delta t", label: "шаг по времени", unit: "с", source: "настройки расчета" },
      { key: "q_in", symbolLatex: "Q_{in}", label: "теплопритоки", unit: "Вт", source: "расчет" },
      { key: "q_out", symbolLatex: "Q_{out}", label: "теплопотери", unit: "Вт", source: "расчет" },
    ],
  },
  {
    id: "steady_field",
    module: "Thermal",
    title: "Стационарное температурное поле на сетке",
    latex: String.raw`\nabla \cdot (k_{eff}\nabla T) + q = 0, \quad T_{i,j} = \frac{T_E + T_W + T_N + T_S + q_{i,j}h^2/k_{eff}}{4}`,
    description: "Температурная карта строится конечно-разностным методом на равномерной 2D-сетке.",
    methodName: "Пятиточечная конечно-разностная схема",
    applicability: "Плановая стационарная карта температуры помещения.",
    assumptions: ["Рассматривается 2D-проекция", "Используется эффективная плановая теплопроводность/диффузия"],
    physicalMeaning: "Оценивает распределение температуры по плану с учетом источников и граничных условий.",
    resultMeaning: "Результат показывает локальные холодные и теплые зоны на сетке.",
    variables: [
      { key: "k_eff", symbolLatex: "k_{eff}", label: "эффективная теплопроводность", unit: "Вт/(м·К)", source: "модель поля" },
      { key: "q_source", symbolLatex: "q", label: "объемный источник теплоты", unit: "Вт/м³", source: "источники тепла" },
      { key: "grid_step", symbolLatex: "h", label: "шаг сетки", unit: "м", source: "настройки расчета" },
      { key: "temperature", symbolLatex: "T", label: "температура", unit: "°C", source: "решатель" },
    ],
  },
  {
    id: "boundary_conditions",
    module: "Thermal",
    title: "Граничные условия теплопроводности",
    latex: String.raw`T = T_{boundary}; \quad -k\frac{\partial T}{\partial n} = q_n; \quad -k\frac{\partial T}{\partial n} = h(T_{surface} - T_{air})`,
    description: "Для расчета поля допускаются условия Дирихле, Неймана и Робина; в текущей карте используются фиксированные температуры поверхностей.",
    methodName: "Граничные условия Дирихле, Неймана и Робина",
    applicability: "Постановка стационарной задачи теплопроводности.",
    assumptions: ["В текущем интерфейсе карта использует упрощенное фиксирование температур внутренних поверхностей"],
    physicalMeaning: "Определяет, как расчетная область обменивается теплом с границами и средой.",
    resultMeaning: "От выбора граничных условий зависит форма температурного поля и уровень локальных экстремумов.",
    variables: [
      { key: "t_boundary", symbolLatex: "T_{boundary}", label: "заданная температура границы", unit: "°C", source: "граничные условия" },
      { key: "heat_flux", symbolLatex: "q_n", label: "нормальный тепловой поток", unit: "Вт/м²", source: "граничные условия" },
      { key: "h_coeff", symbolLatex: "h", label: "коэффициент теплоотдачи", unit: "Вт/(м²·К)", source: "граничные условия" },
    ],
  },
  {
    id: "radiator_heat_output",
    module: "Thermal",
    title: "Тепловая мощность отопительного прибора",
    latex: String.raw`Q_{emit} = \dot{m} \, c_p \, (T_{supply} - T_{return})`,
    description: "Упрощенная оценка мощности водяного отопительного прибора по расходу и перепаду температур теплоносителя.",
    methodName: "Баланс теплоты теплоносителя",
    applicability: "Радиаторы, конвекторы и водяные отопительные контуры.",
    assumptions: [
      "Потери по трассе не выделяются отдельно в формуле прибора",
      "Свойства теплоносителя принимаются постоянными",
      "В текущей версии используется для инженерной оценки оборудования и derived hydronic metrics",
    ],
    physicalMeaning: "Связывает расход теплоносителя и его охлаждение с полезной тепловой мощностью прибора.",
    resultMeaning: "Результат показывает доступную тепловую мощность отопительного элемента.",
    variables: [
      { key: "power", symbolLatex: "Q_{emit}", label: "тепловая мощность прибора", unit: "Вт", source: "выход" },
      { key: "mass_flow", symbolLatex: "\\dot{m}", label: "массовый расход теплоносителя", unit: "кг/с", source: "сеть" },
      { key: "cp", symbolLatex: "c_p", label: "удельная теплоемкость теплоносителя", unit: "Дж/(кг·К)", source: "константа" },
      { key: "t_supply", symbolLatex: "T_{supply}", label: "температура подачи", unit: "°C", source: "сеть" },
      { key: "t_return", symbolLatex: "T_{return}", label: "температура обратки", unit: "°C", source: "сеть" },
    ],
  },
  {
    id: "coolant_flow_rate",
    module: "Thermal",
    title: "Расход теплоносителя по тепловой нагрузке",
    latex: String.raw`\dot{m} = \frac{Q}{c_p (T_{supply} - T_{return})}`,
    description: "Расход теплоносителя определяется по требуемой тепловой мощности и расчетному перепаду температур.",
    methodName: "Баланс теплоты теплоносителя",
    applicability: "Подбор ветвей отопления и водяных контуров.",
    assumptions: [
      "Теплоемкость теплоносителя принимается постоянной",
      "Перепад температур задан расчетом",
      "В текущей версии используется для derived hydronic metrics, а не как обязательный режим solver",
    ],
    physicalMeaning: "Показывает, какой расход нужен для переноса заданной тепловой мощности.",
    resultMeaning: "Результат используется для подбора труб и насосов.",
    variables: [
      { key: "mass_flow", symbolLatex: "\\dot{m}", label: "массовый расход теплоносителя", unit: "кг/с", source: "выход" },
      { key: "power", symbolLatex: "Q", label: "тепловая нагрузка", unit: "Вт", source: "нагрузка/расчет" },
      { key: "cp", symbolLatex: "c_p", label: "удельная теплоемкость теплоносителя", unit: "Дж/(кг·К)", source: "константа" },
      { key: "delta_t", symbolLatex: "T_{supply} - T_{return}", label: "перепад температур", unit: "К", source: "система отопления" },
    ],
  },
  {
    id: "airflow_rate",
    module: "Thermal",
    title: "Расход воздуха по кратности",
    latex: String.raw`L = \frac{nV}{3600}`,
    description: "Объемный расход воздуха определяется по кратности воздухообмена и объему помещения.",
    methodName: "Связь кратности и расхода воздуха",
    applicability: "Приточная и вытяжная вентиляция, быстрые инженерные оценки.",
    assumptions: ["Воздухообмен считается равномерным по помещению"],
    physicalMeaning: "Показывает, сколько воздуха подается или удаляется в единицу времени.",
    resultMeaning: "Результат используется в расчете вентиляционных потерь и подборе воздуховодов.",
    variables: [
      { key: "airflow", symbolLatex: "L", label: "объемный расход воздуха", unit: "м³/с", source: "выход" },
      { key: "ach", symbolLatex: "n", label: "кратность воздухообмена", unit: "1/ч", source: "сценарий" },
      { key: "volume", symbolLatex: "V", label: "объем помещения", unit: "м³", source: "геометрия модели" },
    ],
  },
  {
    id: "pressure_drop_simple",
    module: "Thermal",
    title: "Потеря давления по длине участка",
    latex: String.raw`\Delta p = R_l \, l`,
    description: "Упрощенная инженерная форма для оценки потери давления на прямом участке сети по известному удельному сопротивлению.",
    methodName: "Линейная оценка потерь давления",
    applicability: "Предварительный подбор насосов и воздуховодов на ранней стадии проекта.",
    assumptions: ["Удельное сопротивление участка известно или взято из расчета/таблицы", "Местные сопротивления учитываются отдельно"],
    physicalMeaning: "Показывает, сколько давления теряется на заданной длине трассы.",
    resultMeaning: "Результат используется для выбора насоса или вентилятора.",
    variables: [
      { key: "delta_p", symbolLatex: "\\Delta p", label: "потеря давления", unit: "Па", source: "выход" },
      { key: "r_l", symbolLatex: "R_l", label: "удельная потеря давления на длину", unit: "Па/м", source: "расчет/таблица" },
      { key: "length", symbolLatex: "l", label: "длина участка", unit: "м", source: "геометрия сети" },
    ],
  },
  {
    id: "thermal_peak_load",
    module: "Thermal",
    title: "Пиковая тепловая нагрузка",
    latex: String.raw`Q_{peak} = \max_t \left(\dot{Q}_{heat}(t)\right)`,
    description: "Максимальная потребная тепловая мощность за рассматриваемый период.",
    methodName: "Максимум временного ряда",
    applicability: "Подбор источника тепла и оценка пикового режима.",
    assumptions: ["Нагрузка берется по расчетному временному ряду"],
    physicalMeaning: "Показывает наибольшую требуемую тепловую мощность в течение расчета.",
    resultMeaning: "Используется при выборе котла, ИТП или другого источника тепла.",
    variables: [
      { key: "q_peak", symbolLatex: "Q_{peak}", label: "пиковая тепловая нагрузка", unit: "кВт", source: "выход" },
      { key: "q_heat_time", symbolLatex: "\\dot{Q}_{heat}(t)", label: "мощность отопления во времени", unit: "кВт", source: "временной ряд" },
    ],
  },
  {
    id: "sensitivity_index",
    module: "Uncertainty",
    title: "Коэффициент чувствительности",
    latex: String.raw`S_x = \frac{\Delta Y / Y}{\Delta X / X}`,
    description: "Локальная чувствительность оценивается конечным возмущением параметра и полным пересчетом результата.",
    methodName: "Локальная чувствительность конечным возмущением",
    applicability: "Сравнение влияния U, ACH, температурного напора и других входов на требуемую мощность.",
    assumptions: ["Изменение параметра мало относительно базовой точки расчета"],
    physicalMeaning: "Показывает, насколько относительное изменение параметра влияет на относительное изменение результата.",
    resultMeaning: "По знаку видно направление влияния, по модулю - его силу.",
    variables: [
      { key: "sensitivity", symbolLatex: "S_x", label: "индекс чувствительности", unit: "безразм.", source: "выход" },
      { key: "input", symbolLatex: "X", label: "входной параметр", source: "вход" },
      { key: "output", symbolLatex: "Y", label: "выходная величина", source: "выход" },
      { key: "delta_input", symbolLatex: "\\Delta X", label: "изменение входного параметра", source: "вариант" },
      { key: "delta_output", symbolLatex: "\\Delta Y", label: "изменение выходной величины", source: "пересчет" },
    ],
  },
  {
    id: "uncertainty_mc",
    module: "Uncertainty",
    title: "Среднее значение по Монте-Карло",
    latex: String.raw`\hat{\mu} = \frac{1}{N}\sum_{k=1}^{N} y_k`,
    description: "Среднее по множеству прогонов при случайных входных параметрах.",
    methodName: "Оценка математического ожидания по выборке",
    applicability: "Анализ неопределенности и вероятностные оценки.",
    assumptions: ["Прогоны независимы", "Выборка репрезентативна"],
    physicalMeaning: "Показывает ожидаемое значение выходной метрики с учетом разброса входов.",
    resultMeaning: "Используется как центральная оценка результата при неопределенности.",
    variables: [
      { key: "samples", symbolLatex: "N", label: "число прогонов", source: "настройки Monte Carlo" },
      { key: "sample_value", symbolLatex: "y_k", label: "результат k-го прогона", source: "выход" },
      { key: "mean_value", symbolLatex: "\\hat{\\mu}", label: "оценка среднего", source: "выход" },
    ],
  },
  {
    id: "uncertainty_std",
    module: "Uncertainty",
    title: "Стандартное отклонение по Монте-Карло",
    latex: String.raw`\hat{\sigma} = \sqrt{\frac{1}{N-1}\sum_{k=1}^{N}(y_k - \hat{\mu})^2}`,
    description: "Оценивает разброс результатов относительно среднего по серии прогонов.",
    methodName: "Несмещенная оценка стандартного отклонения",
    applicability: "Оценка разброса, доверительных интервалов и вероятностных диапазонов.",
    assumptions: ["Выборка достаточно велика для оценки разброса"],
    physicalMeaning: "Показывает степень неопределенности результата.",
    resultMeaning: "Чем больше σ, тем менее устойчив результат к разбросу входных данных.",
    variables: [
      { key: "std_value", symbolLatex: "\\hat{\\sigma}", label: "оценка стандартного отклонения", source: "выход" },
      { key: "mean_value", symbolLatex: "\\hat{\\mu}", label: "среднее значение", source: "выход" },
      { key: "sample_value", symbolLatex: "y_k", label: "результат k-го прогона", source: "выход" },
      { key: "samples", symbolLatex: "N", label: "число прогонов", source: "настройки Monte Carlo" },
    ],
  },
  {
    id: "calibration_rmse",
    module: "Calibration",
    title: "RMSE по месячным данным",
    latex: String.raw`RMSE = \sqrt{\frac{1}{M}\sum_{m=1}^{M}(E_m^{obs} - E_m^{sim})^2}`,
    description: "Классическая метрика расхождения между наблюдаемыми и расчетными месячными энергозатратами.",
    methodName: "Root Mean Square Error",
    applicability: "Калибровка модели по 12 месячным значениям или другой серии наблюдений.",
    assumptions: ["Все наблюдения даны в одинаковых единицах", "Каждая точка имеет одинаковый вес, если не задано иное"],
    physicalMeaning: "Показывает средний масштаб ошибки модели в тех же единицах, что и энергия.",
    resultMeaning: "Меньший RMSE означает лучшее совпадение модели с наблюдениями.",
    variables: [
      { key: "observations", symbolLatex: "M", label: "число наблюдений", source: "данные калибровки" },
      { key: "energy_obs", symbolLatex: "E_m^{obs}", label: "наблюдаемая энергия", unit: "кВт·ч", source: "измерения" },
      { key: "energy_sim", symbolLatex: "E_m^{sim}", label: "расчетная энергия", unit: "кВт·ч", source: "модель" },
    ],
  },
  {
    id: "calibration_mape",
    module: "Calibration",
    title: "MAPE по месячным данным",
    latex: String.raw`MAPE = \frac{100\%}{M}\sum_{m=1}^{M}\left|\frac{E_m^{obs} - E_m^{sim}}{E_m^{obs}}\right|`,
    description: "Средняя относительная ошибка между расчетом и наблюдениями в процентах.",
    methodName: "Mean Absolute Percentage Error",
    applicability: "Сравнение качества калибровки в относительных единицах.",
    assumptions: ["Наблюдаемые значения не равны нулю", "Все точки имеют одинаковый вес, если не задано иное"],
    physicalMeaning: "Показывает типичную относительную ошибку модели.",
    resultMeaning: "Чем меньше MAPE, тем ближе модель к фактическим месячным данным.",
    variables: [
      { key: "observations", symbolLatex: "M", label: "число наблюдений", source: "данные калибровки" },
      { key: "energy_obs", symbolLatex: "E_m^{obs}", label: "наблюдаемая энергия", unit: "кВт·ч", source: "измерения" },
      { key: "energy_sim", symbolLatex: "E_m^{sim}", label: "расчетная энергия", unit: "кВт·ч", source: "модель" },
    ],
  },
];

export const groupedFormulas: Record<FormulaModule, Formula[]> = formulaModules.reduce((acc, module) => {
  acc[module] = formulaRegistry.filter((formula) => formula.module === module);
  return acc;
}, {} as Record<FormulaModule, Formula[]>);

export const formulaMap: Record<string, Formula> = formulaRegistry.reduce(
  (acc, formula) => ({
    ...acc,
    [formula.id]: formula,
  }),
  {} as Record<string, Formula>
);

export const assumptions: Assumption[] = [
  {
    id: "air_density",
    label: "Плотность воздуха",
    value: "1.204",
    unit: "кг/м³",
    description: "Используется в формулах вентиляционных и инфильтрационных потерь.",
    source: "Исаченко В.П., Осипова В.А., Сукомел А.С. «Теплопередача»; инженерное допущение для сухого воздуха около 20 °C",
  },
  {
    id: "air_cp",
    label: "Удельная теплоемкость воздуха",
    value: "1005",
    unit: "Дж/(кг·К)",
    description: "Используется для расчета чувствительной теплоты воздуха.",
    source: "Исаченко В.П., Осипова В.А., Сукомел А.С. «Теплопередача»; инженерное допущение для сухого воздуха около 20 °C",
  },
  {
    id: "air_heat_capacity_bulk",
    label: "Объемная теплоемкость воздуха",
    value: "1.21",
    unit: "кДж/(м³·К)",
    description: "Приближенное произведение плотности воздуха на его теплоемкость.",
    source: "Производная инженерная величина из ρ и c_p воздуха",
  },
  {
    id: "surface_resistance_internal",
    label: "Внутреннее поверхностное сопротивление",
    value: "0.13",
    unit: "м²·К/Вт",
    description: "Типовое сопротивление теплоотдаче со стороны помещения.",
    source: "СП 50.13330.2024, табличные значения коэффициентов теплоотдачи / поверхностных сопротивлений",
  },
  {
    id: "surface_resistance_external",
    label: "Наружное поверхностное сопротивление",
    value: "0.04",
    unit: "м²·К/Вт",
    description: "Типовое сопротивление теплоотдаче со стороны наружного воздуха.",
    source: "СП 50.13330.2024, табличные значения коэффициентов теплоотдачи / поверхностных сопротивлений",
  },
  {
    id: "comfort_setpoint_day",
    label: "Дневная уставка температуры",
    value: "21",
    unit: "°C",
    description: "Базовая дневная температура в расчетах по умолчанию.",
    source: "Настройки приложения",
  },
  {
    id: "comfort_setpoint_night",
    label: "Ночная уставка температуры",
    value: "18",
    unit: "°C",
    description: "Базовая ночная температура в расчетах по умолчанию.",
    source: "Настройки приложения",
  },
];

export const getFormulasByIds = (ids: string[]): Formula[] => ids.map((id) => formulaMap[id]).filter(Boolean);
