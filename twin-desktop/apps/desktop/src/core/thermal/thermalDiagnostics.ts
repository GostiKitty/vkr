import type { BuildingModel } from "../../entities/geometry/types";
import type { ThermalModel, ThermalLink } from "./model";
import type { FrameInstant, ZoneSummaryMetrics } from "./metrics";
import { evaluateInternalGains, evaluateSetpoint, type GainSchedule, type OccupancySchedule, type SetpointSchedule } from "./schedules";

/** Уровень расчёта: не смешивать с СП 50, Monte Carlo и CFD. */
export const RC_CALCULATION_LEVEL_RU = "Зональная RC-модель здания (динамика по воздушной ёмкости зон)";

/**
 * Уравнение, дискретизируемое в `simulateThermalNetwork` (см. solver):
 * C_i·(T_i^{n+1}−T_i^n)/Δt = Σ_j G_ij(T_j^n−T_i^n) + G_inf,i(T_n−T_i^n) + Σ_k G_k,ext(T_n−T_i^n) + Q̇_int,i + Q̇_ot,i .
 * Здесь T_n — наружная температура воздуха; G_k,ext — проводимости рёбер «зона—наружная среда» (стены с учётом проёмов); G_inf — эквивалент по ACH.
 */
export const RC_DISCRETE_BALANCE_EQUATION =
  "C_iΔT_i/Δt = Σ_j G_ij(T_j−T_i) + G_inf,i(T_n−T_i) + Σ_k G_k,ext(T_n−T_i) + Q̇_int + Q̇_ot";

/** Постоянная проводимости инфильтрации в RC: G_inf = ρ_в·c_p,в·V·ACH/3600, Вт/К (сенсибельный тепловой поток притока/утечки воздуха). */
export const RC_INFILTRATION_CONDUCTANCE_FORMULA = "G_inf = ρ_в c_p,в V ACH / 3600";

/**
 * Потери через ограждение в выбранном срезе (T_i > T_n): Q̇_k = G_k,ext·(T_i−T_n) по каждому наружному ребру;
 * разложение G_k = G_непр + G_ок + G_дв — из геометрии проёмов и типовых U окон/дверей (см. wallFacadeThermal), не из СП 50 как нормативной проверки.
 */
export const RC_ENVELOPE_LOSS_SLICE_FORMULA = "Q̇_огр,k = G_k,ext max(0, T_i−T_n); G_k = G_непр + G_ок + G_дв";

export interface ThermalDiagnosticsEngineering {
  calculationLevelRu: string;
  discreteBalanceEquation: string;
  infiltrationConductanceFormula: string;
  envelopeLossSliceFormula: string;
  diagnosticSliceDefinitionRu: string;
  notSp50NormativeCheckRu: string;
  notMonteCarloRu: string;
  notCfdFieldRu: string;
}

export interface EngineeringMetricCard {
  title: string;
  valueText: string;
  unit: string;
  formula: string;
  engineeringSenseRu: string;
  assumptionsRu: string;
  calculationLevelRu: string;
  status: ZoneDiagnosticStatus;
}

export function buildThermalDiagnosticsEngineering(): ThermalDiagnosticsEngineering {
  return {
    calculationLevelRu: RC_CALCULATION_LEVEL_RU,
    discreteBalanceEquation: RC_DISCRETE_BALANCE_EQUATION,
    infiltrationConductanceFormula: RC_INFILTRATION_CONDUCTANCE_FORMULA,
    envelopeLossSliceFormula: RC_ENVELOPE_LOSS_SLICE_FORMULA,
    diagnosticSliceDefinitionRu:
      "Постдиагностика: момент времени, в котором сумма мощностей отопления по зонам максимальна; температуры и T_n берутся из того же индекса кадра timeline, что и metricFrames (начало шага).",
    notSp50NormativeCheckRu:
      "СП 50 — отдельный нормативный модуль (требуемые R, влажностные проверки и т.д.); показатели этого блока не являются заключением по СП.",
    notMonteCarloRu:
      "Monte Carlo по теплу — отдельный уровень: повторный прогон той же RC-модели при вариации входов; не подменяет нормативную проверку.",
    notCfdFieldRu:
      "Температурное поле в плане — визуализация на базе зональных T и эвристик у стен/источников; не поле CFD и не решение уравнения теплопроводности в объёме.",
  };
}

/** Минимальный снимок кадра (без циклического импорта из solver). */
export type DiagnosticsTimelineFrame = {
  timeHours: number;
  outdoorTemperatureC: number;
  rooms: Record<string, { temperatureC: number; heatingPowerW: number; setpointC: number }>;
};

export type ZoneDiagnosticStatus = "ok" | "attention" | "risk";

export interface ThermalBuildingDiagnostics {
  referenceTimeHours: number;
  referenceOutdoorC: number;
  /** Момент выбран по максимуму суммарной мощности отопления по зонам (типовой «пиковый» срез). */
  referenceNote: string;
  /** Сумма по зонам Σ_k G_k,ext(T_i−T_n) — алгебраический теплопоток «из зоны наружу» (Вт); при T_n>T_i отрицателен (приток с улицы). */
  totalEnvelopeExchangeSignedW: number;
  /** Σ_i G_inf,i(T_i−T_n), Вт. */
  totalInfiltrationExchangeSignedW: number;
  totalOpaqueLossW: number;
  totalWindowLossW: number;
  totalDoorLossW: number;
  totalInfiltrationLossW: number;
  totalInternalGainsW: number;
  totalHeatingW: number;
  /** Сумма по зонам чистого обмена с соседями (для всего здания близка к нулю). */
  internalExchangeNetSumW: number;
  /**
   * Остаток алгебраического баланса мощностей в срезе:
   * r = Q̇_ot + Q̇_int + Σ_j G_ij(T_j−T_i) − Σ_k G_k,ext(T_i−T_n) − G_inf(T_i−T_n).
   * При квазистационаре r → 0; не смешивать с «зимними потерями» max(0,·) ниже.
   */
  balanceResidualW: number;
  lossSharePercent: {
    opaque: number;
    window: number;
    door: number;
    infiltration: number;
  };
  heatedFloorAreaM2: number;
  /** Удельная пиковая нагрузка по зданию в момент референса, Вт/м². */
  specificPeakLoad_W_m2: number;
  /** Удельная энергия отопления за период, кВт·ч/м². */
  specificEnergyKWh_m2: number;
  /** max по зонам и наружным рёбрам |(G_непр+G_ок+G_дв)−G_k,ext|·|T_i−T_n|; ≈0 при согласованном разложении проводимостей. */
  envelopeSplitMaxDeviationW: number;
  /** |остаток баланса в срезе| относительно масштаба мощностей (0…1). */
  balanceRelativeResidual: number;
  /** Норма / внимание / риск по величине остатка баланса в срезе (не норматив СП 50). */
  balanceStatus: ZoneDiagnosticStatus;
  balanceStatusNoteRu: string;
}

export interface ThermalZoneDiagnostics {
  zoneId: string;
  zoneName: string;
  temperatureC: number;
  setpointC: number;
  heatingPowerW: number;
  /** Σ_k G_k,ext(T_i−T_n), Вт (алгебраический поток через наружные рёбра). */
  envelopeExchangeSignedW: number;
  /** G_inf(T_i−T_n), Вт. */
  infiltrationExchangeSignedW: number;
  lossOpaqueW: number;
  lossWindowW: number;
  lossDoorW: number;
  lossInfiltrationW: number;
  internalGainsW: number;
  internalExchangeNetW: number;
  peakSpecificLoad_W_m2: number;
  energyKWh_m2: number;
  discomfortHours: number;
  status: ZoneDiagnosticStatus;
  statusNote: string;
}

export interface ThermalSimulationDiagnostics {
  engineering: ThermalDiagnosticsEngineering;
  building: ThermalBuildingDiagnostics;
  zones: ThermalZoneDiagnostics[];
  /** Карточки для UI/отчёта: название, единицы, формула, смысл, допущения, уровень RC. */
  metricCards: EngineeringMetricCard[];
}

export interface BuildThermalDiagnosticsInput {
  building: BuildingModel;
  model: ThermalModel;
  frames: DiagnosticsTimelineFrame[];
  metricFrames: FrameInstant[];
  setpoints: SetpointSchedule;
  gains: GainSchedule;
  occupancy?: OccupancySchedule;
  timestepSeconds: number;
  zoneSummary: Record<string, ZoneSummaryMetrics>;
  totalEnergyKWh: number;
  peakLoadKW: number;
}

function zoneDisplayName(building: BuildingModel, zoneId: string): string {
  return building.rooms.find((r) => r.id === zoneId)?.name ?? zoneId;
}

function findPeakHeatingStep(metricFrames: FrameInstant[]): number {
  let best = 0;
  let bestSum = -1;
  metricFrames.forEach((frame, index) => {
    const sum = frame.zones.reduce((s, z) => s + Math.max(0, z.heatingPowerW), 0);
    if (sum > bestSum) {
      bestSum = sum;
      best = index;
    }
  });
  return best;
}

function internalExchangeNetW(
  zoneId: string,
  model: ThermalModel,
  zoneTempsC: Record<string, number | undefined>
): number {
  const Ti = zoneTempsC[zoneId];
  if (Ti === undefined || !Number.isFinite(Ti)) {
    return 0;
  }
  let net = 0;
  model.internalLinks.forEach((link) => {
    const neighborId = link.fromZoneId === zoneId ? link.toZoneId : link.toZoneId === zoneId ? link.fromZoneId : null;
    if (!neighborId) {
      return;
    }
    const Tj = zoneTempsC[neighborId];
    if (Tj === undefined || !Number.isFinite(Tj)) {
      return;
    }
    const g = link.conductance_W_K;
    if (!Number.isFinite(g)) {
      return;
    }
    net += g * (Tj - Ti);
  });
  return net;
}

function externalLossesForZone(
  zoneId: string,
  outdoorLinks: ThermalLink[],
  zoneTempC: number,
  outdoorC: number
): { opaque: number; window: number; door: number } {
  let opaque = 0;
  let window = 0;
  let door = 0;
  const dT = Math.max(0, zoneTempC - outdoorC);
  if (dT <= 0 || !Number.isFinite(dT)) {
    return { opaque: 0, window: 0, door: 0 };
  }
  outdoorLinks.forEach((link) => {
    if (link.fromZoneId !== zoneId) {
      return;
    }
    const g = link.conductance_W_K;
    const go = link.conductanceOpaque_W_K;
    const gw = link.conductanceWindow_W_K;
    const gd = link.conductanceDoor_W_K;
    if (go !== undefined || gw !== undefined || gd !== undefined) {
      opaque += Math.max(0, (go ?? 0) * dT);
      window += Math.max(0, (gw ?? 0) * dT);
      door += Math.max(0, (gd ?? 0) * dT);
      return;
    }
    opaque += Math.max(0, g * dT);
  });
  return { opaque, window, door };
}

function envelopeExchangeSignedFromLinksW(
  zoneId: string,
  outdoorLinks: ThermalLink[],
  zoneTempC: number,
  outdoorC: number
): number {
  const dT = zoneTempC - outdoorC;
  if (!Number.isFinite(dT)) {
    return 0;
  }
  let s = 0;
  outdoorLinks.forEach((link) => {
    if (link.fromZoneId !== zoneId) {
      return;
    }
    const g = link.conductance_W_K;
    if (Number.isFinite(g)) {
      s += g * dT;
    }
  });
  return s;
}

function envelopeConductanceSplitMismatchMaxW(
  zoneId: string,
  outdoorLinks: ThermalLink[],
  zoneTempC: number,
  outdoorC: number
): number {
  const dT = zoneTempC - outdoorC;
  if (!Number.isFinite(dT) || !Number.isFinite(zoneTempC)) {
    return 0;
  }
  let m = 0;
  outdoorLinks.forEach((link) => {
    if (link.fromZoneId !== zoneId) {
      return;
    }
    const g = link.conductance_W_K;
    const go = link.conductanceOpaque_W_K;
    const gw = link.conductanceWindow_W_K;
    const gd = link.conductanceDoor_W_K;
    if (go !== undefined || gw !== undefined || gd !== undefined) {
      const sumG = (go ?? 0) + (gw ?? 0) + (gd ?? 0);
      if (Number.isFinite(g)) {
        m = Math.max(m, Math.abs(sumG - g) * Math.abs(dT));
      }
    }
  });
  return m;
}

function balanceResidualScaleW(
  totalHeating: number,
  totalGains: number,
  totalEnvelopeSigned: number,
  totalInfilSigned: number,
  intExAbsSum: number
): number {
  return Math.max(
    50,
    totalHeating,
    totalGains,
    Math.abs(totalEnvelopeSigned),
    Math.abs(totalInfilSigned),
    intExAbsSum
  );
}

function classifyBalanceResidual(relative: number): { status: ZoneDiagnosticStatus; note: string } {
  if (!Number.isFinite(relative) || relative < 0.12) {
    return { status: "ok", note: "Алгебраический остаток баланса в срезе мал; знак ΔT на ограждении учтён в r." };
  }
  if (relative < 0.28) {
    return {
      status: "attention",
      note: "Умеренный остаток: возможны несовпадение среза с моментом квазистационара, влияние ёмкости между кадром и шагом, либо сильный обмен с соседями.",
    };
  }
  return {
    status: "risk",
    note: "Большой остаток баланса в срезе — трактовать разрез потерь осторожно; проверьте шаг Δt, граничные условия и запасные наружные связи зон.",
  };
}

function buildEngineeringMetricCards(
  engineering: ThermalDiagnosticsEngineering,
  building: ThermalBuildingDiagnostics,
  peakLoadKW: number,
  totalEnergyKWh: number
): EngineeringMetricCard[] {
  const level = RC_CALCULATION_LEVEL_RU;
  const cards: EngineeringMetricCard[] = [
    {
      title: "Пиковая мощность отопления (здание)",
      valueText: peakLoadKW.toFixed(3),
      unit: "кВт",
      formula: "Q̇_ot,пик = max_t Σ_i Q̇_ot,i(t) по кадрам симуляции",
      engineeringSenseRu: "Одновременная нагрузка на отопительную систему в наихудшем по сумме зон шаге.",
      assumptionsRu: "Модель идеализирует отопление как неограниченный источник до уставки (см. solver); не учитывает гидравлику и реальную регулировку клапанов.",
      calculationLevelRu: level,
      status: "ok",
    },
    {
      title: "Тепловая энергия отопления за период",
      valueText: totalEnergyKWh.toFixed(2),
      unit: "кВт·ч",
      formula: "E = Σ_k (Σ_i Q̇_ot,i,k) Δt_k / 3,6·10⁶",
      engineeringSenseRu: "Интеграл суммарной мощности отопления по времени сценария (не нормативный годовой расход).",
      assumptionsRu: "Интегрирование по интервалам между кадрами metricFrames; последний кадр timeline не добавляет Δt.",
      calculationLevelRu: level,
      status: "ok",
    },
    {
      title: "Остаток теплового баланса в диагностическом срезе",
      valueText: building.balanceResidualW.toFixed(0),
      unit: "Вт",
      formula: "r = Q̇_ot + Q̇_int + Σ_j G_ij(T_j−T_i) − Σ_k G_k,ext(T_i−T_n) − G_inf(T_i−T_n)",
      engineeringSenseRu:
        "Проверка согласованности среза с дискретным уравнением RC: при квазистационаре r → 0 для алгебраических потоков (включая приток с улицы при T_n>T_i).",
      assumptionsRu:
        "Отдельно от «зимних потерь» max(0,T_i−T_n): доли opaque/окно/дверь/инфильтрация в отчёте — только положительный отвод при T_i>T_n.",
      calculationLevelRu: level,
      status: building.balanceStatus,
    },
    {
      title: "Относительный остаток баланса",
      valueText: (100 * building.balanceRelativeResidual).toFixed(1),
      unit: "%",
      formula: "|r| / max(50 Вт; Q̇_ot; Q̇_int; |Σ_k G_k,ext(T_i−T_n)|; |G_inf(T_i−T_n)|; Σ_i|обмен_i|)",
      engineeringSenseRu: "Безразмерная величина для оценки, насколько срез близок к локальному равновесию мощностей.",
      assumptionsRu: "Знаменатель — инженерный масштаб мощности, чтобы не завышать значимость шума при малых нагрузках.",
      calculationLevelRu: level,
      status: building.balanceStatus,
    },
    {
      title: "Удельная пиковая нагрузка (по полу)",
      valueText: building.specificPeakLoad_W_m2.toFixed(1),
      unit: "Вт/м²",
      formula: "(Σ_i Q̇_ot,i)пик / A_пол",
      engineeringSenseRu: "Ориентир плотности пиковой нагрузки по суммарной площади пола зон RC-модели.",
      assumptionsRu: "A_пол — сумма площадей зон из RC-модели; не нормативная «отапливаемая площадь» СП.",
      calculationLevelRu: level,
      status: building.balanceStatus === "risk" ? "attention" : "ok",
    },
  ];
  if (building.envelopeSplitMaxDeviationW > 0.05) {
    cards.push({
      title: "Расхождение разложения ограждения и ΣG_k",
      valueText: building.envelopeSplitMaxDeviationW.toFixed(2),
      unit: "Вт",
      formula: "max по наружным рёбрам |(G_непр+G_ок+G_дв)−G_k,ext|·|T_i−T_n|",
      engineeringSenseRu: "Контроль: сумма проводимостей по непрозрачной части, окнам и дверям должна совпадать с G_k,ext на ребре.",
      assumptionsRu: "Порог 0,05 Вт отсекает машинный шум; при превышении проверьте округление площадей и масштабирование рёбер графа к площади стены.",
      calculationLevelRu: level,
      status: "attention",
    });
  }
  void engineering;
  return cards;
}

function zoneStatus(
  T: number,
  sp: number,
  heatingW: number,
  areaM2: number
): { status: ZoneDiagnosticStatus; note: string } {
  const q = areaM2 > 0 ? heatingW / areaM2 : 0;
  if (T + 0.75 < sp) {
    return { status: "risk", note: "Температура заметно ниже уставки (риск недогрева в срезе пиковой нагрузки)." };
  }
  if (q > 95) {
    return { status: "attention", note: "Повышенная удельная мощность отопления в выбранный момент времени." };
  }
  return { status: "ok", note: "В пределах допущений зональной модели для выбранного среза." };
}

export function buildThermalSimulationDiagnostics(input: BuildThermalDiagnosticsInput): ThermalSimulationDiagnostics {
  const {
    building: buildingModel,
    model,
    frames,
    metricFrames,
    setpoints,
    gains,
    occupancy,
    timestepSeconds,
    zoneSummary,
    totalEnergyKWh,
    peakLoadKW,
  } = input;
  const heatedFloorAreaM2 = buildingModel.rooms.reduce((sum, room) => {
    const z = model.zones.find((zz) => zz.id === room.id);
    return sum + (z?.area_m2 ?? 0);
  }, 0);
  const floorSafe = Math.max(1, heatedFloorAreaM2);

  const peakIdx = metricFrames.length ? findPeakHeatingStep(metricFrames) : 0;
  const frame = frames[Math.min(peakIdx, frames.length - 1)];
  const timeSeconds = peakIdx * timestepSeconds;
  const outdoorC = frame?.outdoorTemperatureC ?? 0;

  const zoneTemps: Record<string, number | undefined> = {};
  const zoneSetpoints: Record<string, number> = {};
  const zoneHeating: Record<string, number> = {};
  if (frame?.rooms) {
    Object.entries(frame.rooms).forEach(([id, r]) => {
      zoneTemps[id] = r.temperatureC;
      zoneSetpoints[id] = r.setpointC;
      zoneHeating[id] = r.heatingPowerW;
    });
  }

  const zones: ThermalZoneDiagnostics[] = model.zones.map((zone) => {
    const Ti = zoneTemps[zone.id] ?? evaluateSetpoint(setpoints, timeSeconds);
    const sp = zoneSetpoints[zone.id] ?? evaluateSetpoint(setpoints, timeSeconds);
    const heatingW = Math.max(0, zoneHeating[zone.id] ?? 0);
    const ex = externalLossesForZone(zone.id, model.outdoorLinks, Ti, outdoorC);
    const gInf = zone.infiltrationConductance_W_K;
    const lossInf = Math.max(0, gInf * (Ti - outdoorC));
    const infSigned = Number.isFinite(gInf) ? gInf * (Ti - outdoorC) : 0;
    const envSigned = envelopeExchangeSignedFromLinksW(zone.id, model.outdoorLinks, Ti, outdoorC);
    const { gainW } = evaluateInternalGains(gains, occupancy, timeSeconds, zone.area_m2);
    const intEx = internalExchangeNetW(zone.id, model, zoneTemps);
    const zm = zoneSummary[zone.id];
    const peakW = zm?.peakHeatingW ?? heatingW;
    const energyKWh = zm ? zm.energyJ / 3_600_000 : 0;
    const { status, note } = zoneStatus(Ti, sp, heatingW, zone.area_m2);
    return {
      zoneId: zone.id,
      zoneName: zoneDisplayName(buildingModel, zone.id),
      temperatureC: Ti,
      setpointC: sp,
      heatingPowerW: heatingW,
      envelopeExchangeSignedW: envSigned,
      infiltrationExchangeSignedW: infSigned,
      lossOpaqueW: ex.opaque,
      lossWindowW: ex.window,
      lossDoorW: ex.door,
      lossInfiltrationW: lossInf,
      internalGainsW: gainW,
      internalExchangeNetW: intEx,
      peakSpecificLoad_W_m2: zone.area_m2 > 0 ? peakW / zone.area_m2 : 0,
      energyKWh_m2: zone.area_m2 > 0 ? energyKWh / zone.area_m2 : 0,
      discomfortHours: zm ? zm.discomfortSeconds / 3600 : 0,
      status,
      statusNote: note,
    };
  });

  const totalOpaque = zones.reduce((s, z) => s + z.lossOpaqueW, 0);
  const totalWindow = zones.reduce((s, z) => s + z.lossWindowW, 0);
  const totalDoor = zones.reduce((s, z) => s + z.lossDoorW, 0);
  const totalInfil = zones.reduce((s, z) => s + z.lossInfiltrationW, 0);
  const totalGains = zones.reduce((s, z) => s + z.internalGainsW, 0);
  const totalHeating = zones.reduce((s, z) => s + z.heatingPowerW, 0);
  const intExSum = zones.reduce((s, z) => s + z.internalExchangeNetW, 0);
  const totalEnvelopeSigned = zones.reduce((s, z) => s + z.envelopeExchangeSignedW, 0);
  const totalInfilSigned = zones.reduce((s, z) => s + z.infiltrationExchangeSignedW, 0);
  const lossSum = totalOpaque + totalWindow + totalDoor + totalInfil;
  const balanceResidual = totalHeating + totalGains + intExSum - totalEnvelopeSigned - totalInfilSigned;
  const denom = lossSum > 1 ? lossSum : 1;

  const totalPeakHeating = metricFrames.length
    ? metricFrames[peakIdx].zones.reduce((s, z) => s + Math.max(0, z.heatingPowerW), 0)
    : totalHeating;

  const intExAbsSum = zones.reduce((s, z) => s + Math.abs(z.internalExchangeNetW), 0);
  let envelopeSplitMaxDeviationW = 0;
  zones.forEach((z) => {
    envelopeSplitMaxDeviationW = Math.max(
      envelopeSplitMaxDeviationW,
      envelopeConductanceSplitMismatchMaxW(z.zoneId, model.outdoorLinks, z.temperatureC, outdoorC)
    );
  });

  const balanceScale = balanceResidualScaleW(
    totalHeating,
    totalGains,
    totalEnvelopeSigned,
    totalInfilSigned,
    intExAbsSum
  );
  const balanceRelativeResidual = Math.abs(balanceResidual) / balanceScale;
  const { status: balanceStatus, note: balanceStatusNoteRu } = classifyBalanceResidual(balanceRelativeResidual);

  const engineering = buildThermalDiagnosticsEngineering();

  const building: ThermalBuildingDiagnostics = {
      referenceTimeHours: frame?.timeHours ?? 0,
      referenceOutdoorC: outdoorC,
      referenceNote:
        "Срез в момент максимальной суммарной мощности отопления по зонам. Доли потерь: только положительный отвод при T_i>T_n (opaque/окно/дверь/инфильтрация). Остаток r в карточках — алгебраический баланс с Σ_k G_k,ext(T_i−T_n) и G_inf(T_i−T_n) без max(0,·).",
      totalEnvelopeExchangeSignedW: totalEnvelopeSigned,
      totalInfiltrationExchangeSignedW: totalInfilSigned,
      totalOpaqueLossW: totalOpaque,
      totalWindowLossW: totalWindow,
      totalDoorLossW: totalDoor,
      totalInfiltrationLossW: totalInfil,
      totalInternalGainsW: totalGains,
      totalHeatingW: totalHeating,
      internalExchangeNetSumW: intExSum,
      balanceResidualW: balanceResidual,
      lossSharePercent: {
        opaque: (100 * totalOpaque) / denom,
        window: (100 * totalWindow) / denom,
        door: (100 * totalDoor) / denom,
        infiltration: (100 * totalInfil) / denom,
      },
      heatedFloorAreaM2: heatedFloorAreaM2,
      specificPeakLoad_W_m2: totalPeakHeating / floorSafe,
      specificEnergyKWh_m2: totalEnergyKWh / floorSafe,
      envelopeSplitMaxDeviationW,
      balanceRelativeResidual,
      balanceStatus,
      balanceStatusNoteRu,
    };

  const metricCards = buildEngineeringMetricCards(engineering, building, peakLoadKW, totalEnergyKWh);

  return {
    engineering,
    building,
    zones,
    metricCards,
  };
}
