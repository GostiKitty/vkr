import { evaluateInternalGains, evaluateSetpoint } from "./schedules";
import { buildBuildingPerformanceDiagnostics } from "./derived/buildingPerformanceMetrics";
import { buildRcDerivedDiagnostics } from "./derived/metrics";
/** Уровень расчёта: не смешивать с СП 50, Monte Carlo и CFD. */
export const RC_CALCULATION_LEVEL_RU = "Зональная RC-модель здания (динамика по воздушной ёмкости зон)";
/**
 * Уравнение, дискретизируемое в `simulateThermalNetwork` (см. solver):
 * C_i·(T_i^{n+1}−T_i^n)/Δt = Σ_j G_ij(T_j^n−T_i^n) + G_inf,i(T_n−T_i^n) + Σ_k G_k,ext(T_n−T_i^n) + Q̇_int,i + Q̇_ot,i .
 * Здесь T_n — наружная температура воздуха; G_k,ext — проводимости рёбер «зона—наружная среда» (стены с учётом проёмов); G_inf — эквивалент по ACH.
 */
export const RC_DISCRETE_BALANCE_EQUATION = "C_iΔT_i/Δt = Σ_j G_ij(T_j−T_i) + G_inf,i(T_n−T_i) + Σ_k G_k,ext(T_n−T_i) + Q̇_int + Q̇_ot";
/** Постоянная проводимости инфильтрации в RC: G_inf = ρ_в·c_p,в·V·ACH/3600, Вт/К (сенсибельный тепловой поток притока/утечки воздуха). */
export const RC_INFILTRATION_CONDUCTANCE_FORMULA = "G_inf = ρ_в c_p,в V ACH / 3600";
/**
 * Потери через ограждение в выбранном срезе (T_i > T_n): Q̇_k = G_k,ext·(T_i−T_n) по каждому наружному ребру;
 * разложение G_k = G_непр + G_ок + G_дв — из геометрии проёмов и типовых U окон/дверей (см. wallFacadeThermal), не из СП 50 как нормативной проверки.
 */
export const RC_ENVELOPE_LOSS_SLICE_FORMULA = "Q̇_огр,k = G_k,ext max(0, T_i−T_n); G_k = G_непр + G_ок + G_дв";
export function buildThermalDiagnosticsEngineering() {
    return {
        calculationLevelRu: RC_CALCULATION_LEVEL_RU,
        discreteBalanceEquation: RC_DISCRETE_BALANCE_EQUATION,
        infiltrationConductanceFormula: RC_INFILTRATION_CONDUCTANCE_FORMULA,
        envelopeLossSliceFormula: RC_ENVELOPE_LOSS_SLICE_FORMULA,
        diagnosticSliceDefinitionRu: "Постдиагностика: момент времени, в котором сумма мощностей отопления по зонам максимальна; температуры и T_n берутся из того же индекса кадра timeline, что и metricFrames (начало шага).",
        notSp50NormativeCheckRu: "СП 50 — отдельный нормативный модуль (требуемые R, влажностные проверки и т.д.); показатели этого блока не являются заключением по СП.",
        notMonteCarloRu: "Monte Carlo по теплу — отдельный уровень: повторный прогон той же RC-модели при вариации входов; не подменяет нормативную проверку.",
        notCfdFieldRu: "Температурное поле в плане — визуализация на базе зональных T и эвристик у стен/источников; не поле CFD и не решение уравнения теплопроводности в объёме.",
    };
}
function zoneDisplayName(building, zoneId) {
    return building.rooms.find((r) => r.id === zoneId)?.name ?? zoneId;
}
function findPeakHeatingStep(metricFrames) {
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
function internalExchangeNetW(zoneId, model, zoneTempsC) {
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
function externalLossesForZone(zoneId, outdoorLinks, zoneTempC, outdoorC) {
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
function envelopeExchangeSignedFromLinksW(zoneId, outdoorLinks, zoneTempC, outdoorC) {
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
function envelopeConductanceSplitMismatchMaxW(zoneId, outdoorLinks, zoneTempC, outdoorC) {
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
function balanceResidualScaleW(totalHeating, totalGains, totalEnvelopeSigned, totalInfilSigned, intExAbsSum) {
    return Math.max(50, totalHeating, totalGains, Math.abs(totalEnvelopeSigned), Math.abs(totalInfilSigned), intExAbsSum);
}
function classifyBalanceResidual(relative) {
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
function sharePercent(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
        return null;
    }
    return (100 * Math.max(0, numerator)) / denominator;
}
function sharePercentOrZero(numerator, denominator) {
    return sharePercent(numerator, denominator) ?? 0;
}
export function calculateLossShareMetrics(input) {
    const transmissionLossW = Math.max(0, input.transmissionLossW);
    const infiltrationLossW = Math.max(0, input.infiltrationLossW);
    const mechanicalVentilationLossW = Math.max(0, input.mechanicalVentilationLossW);
    const airExchangeLossW = infiltrationLossW + mechanicalVentilationLossW;
    const totalLossW = transmissionLossW + airExchangeLossW;
    return {
        transmissionLossW,
        infiltrationLossW,
        mechanicalVentilationLossW,
        airExchangeLossW,
        totalLossW,
        infiltrationShareOfTotalPct: sharePercent(infiltrationLossW, totalLossW),
        infiltrationShareOfAirExchangePct: sharePercent(infiltrationLossW, airExchangeLossW),
    };
}
function buildLossShareWarnings(scopeLabel, infiltrationShareOfTotalPct, infiltrationShareOfAirExchangePct, mechanicalVentilationLossW) {
    const warnings = [];
    if (infiltrationShareOfTotalPct !== null && infiltrationShareOfTotalPct > 80) {
        warnings.push(`${scopeLabel}: инфильтрация формирует ${infiltrationShareOfTotalPct.toFixed(1)}% всех теплопотерь в текущем диагностическом срезе.`);
    }
    if (infiltrationShareOfAirExchangePct !== null &&
        infiltrationShareOfAirExchangePct >= 99.95 &&
        mechanicalVentilationLossW <= 1e-6) {
        warnings.push(`${scopeLabel}: 100% относится только к потерям воздухообмена — механическая вентиляция не даёт потерь после рекуперации или отключена.`);
    }
    return warnings;
}
function buildEngineeringMetricCards(engineering, building, peakLoadKW, totalEnergyKWh) {
    const level = RC_CALCULATION_LEVEL_RU;
    const cards = [
        {
            title: "Пиковая мощность отопления (здание)",
            valueText: peakLoadKW.toFixed(3),
            unit: "кВт",
            formula: "Q̇_ot,пик = max_t Σ_i Q̇_ot,i(t) по кадрам симуляции",
            formulaId: "thermal_peak_load",
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
            formulaId: "rc_heating_energy_integral",
            engineeringSenseRu: "Интеграл суммарной мощности отопления по времени сценария (не нормативный годовой расход).",
            assumptionsRu: "Интегрирование по интервалам между кадрами metricFrames; последний кадр timeline не добавляет Δt.",
            calculationLevelRu: level,
            status: "ok",
        },
        {
            title: "Остаток теплового баланса в диагностическом срезе",
            valueText: building.balanceResidualW.toFixed(0),
            unit: "Вт",
            formula: "r = Q̇_ot + Q̇_int + Σ_j G_ij(T_j−T_i) − Σ_k G_k,ext(T_i−T_n) − G_inf(T_i−T_n) − G_vent(T_i−T_n)",
            formulaId: "thermal_balance",
            engineeringSenseRu: "Проверка согласованности среза с дискретным уравнением RC: при квазистационаре r → 0 для алгебраических потоков (включая приток с улицы при T_n>T_i).",
            assumptionsRu: "Отдельно от «зимних потерь» max(0,T_i−T_n): доли opaque/окно/дверь/инфильтрация в отчёте — только положительный отвод при T_i>T_n.",
            calculationLevelRu: level,
            status: building.balanceStatus,
        },
        {
            title: "Относительный остаток баланса",
            valueText: (100 * building.balanceRelativeResidual).toFixed(1),
            unit: "%",
            formula: "|r| / max(50 Вт; Q̇_ot; Q̇_int; |Σ_k G_k,ext(T_i−T_n)|; |G_inf(T_i−T_n)|; Σ_i|обмен_i|)",
            formulaId: "diagnostics_balance_relative_residual",
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
            formulaId: "specific_heat_load_area",
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
            formulaId: "diagnostics_envelope_split_deviation",
            engineeringSenseRu: "Контроль: сумма проводимостей по непрозрачной части, окнам и дверям должна совпадать с G_k,ext на ребре.",
            assumptionsRu: "Порог 0,05 Вт отсекает машинный шум; при превышении проверьте округление площадей и масштабирование рёбер графа к площади стены.",
            calculationLevelRu: level,
            status: "attention",
        });
    }
    void engineering;
    return cards;
}
function zoneStatus(T, sp, heatingW, areaM2) {
    const q = areaM2 > 0 ? heatingW / areaM2 : 0;
    if (T + 0.75 < sp) {
        return { status: "risk", note: "Температура заметно ниже уставки (риск недогрева в срезе пиковой нагрузки)." };
    }
    if (q > 95) {
        return { status: "attention", note: "Повышенная удельная мощность отопления в выбранный момент времени." };
    }
    return { status: "ok", note: "В пределах допущений зональной модели для выбранного среза." };
}
export function buildThermalSimulationDiagnostics(input) {
    const { building: buildingModel, model, options, frames, metricFrames, setpoints, gains, occupancy, timestepSeconds, zoneSummary, totalEnergyKWh, peakLoadKW, hydronic, adjacency, performanceOptions, } = input;
    const heatedFloorAreaM2 = buildingModel.rooms.reduce((sum, room) => {
        const z = model.zones.find((zz) => zz.id === room.id);
        return sum + (z?.area_m2 ?? 0);
    }, 0);
    const floorSafe = Math.max(1, heatedFloorAreaM2);
    const peakIdx = metricFrames.length ? findPeakHeatingStep(metricFrames) : 0;
    const frame = frames[Math.min(peakIdx, frames.length - 1)];
    const timeSeconds = peakIdx * timestepSeconds;
    const outdoorC = frame?.outdoorTemperatureC ?? 0;
    const zoneTemps = {};
    const zoneSetpoints = {};
    const zoneHeating = {};
    if (frame?.rooms) {
        Object.entries(frame.rooms).forEach(([id, r]) => {
            zoneTemps[id] = r.temperatureC;
            zoneSetpoints[id] = r.setpointC;
            zoneHeating[id] = r.heatingPowerW;
        });
    }
    const zones = model.zones.map((zone) => {
        const Ti = zoneTemps[zone.id] ?? evaluateSetpoint(setpoints, timeSeconds);
        const sp = zoneSetpoints[zone.id] ?? evaluateSetpoint(setpoints, timeSeconds);
        const heatingW = Math.max(0, zoneHeating[zone.id] ?? 0);
        const ex = externalLossesForZone(zone.id, model.outdoorLinks, Ti, outdoorC);
        const gInf = zone.infiltrationConductance_W_K;
        const gVent = zone.ventilationConductance_W_K;
        const lossInf = Math.max(0, gInf * (Ti - outdoorC));
        const lossVent = Math.max(0, gVent * (Ti - outdoorC));
        const infSigned = Number.isFinite(gInf) ? gInf * (Ti - outdoorC) : 0;
        const ventSigned = Number.isFinite(gVent) ? gVent * (Ti - outdoorC) : 0;
        const envSigned = envelopeExchangeSignedFromLinksW(zone.id, model.outdoorLinks, Ti, outdoorC);
        const { gainW } = evaluateInternalGains(gains, occupancy, timeSeconds, zone.area_m2);
        const intEx = internalExchangeNetW(zone.id, model, zoneTemps);
        const zm = zoneSummary[zone.id];
        const peakW = zm?.peakHeatingW ?? heatingW;
        const energyKWh = zm ? zm.energyJ / 3_600_000 : 0;
        const { status, note } = zoneStatus(Ti, sp, heatingW, zone.area_m2);
        const zoneName = zoneDisplayName(buildingModel, zone.id);
        const lossShareMetrics = calculateLossShareMetrics({
            transmissionLossW: ex.opaque + ex.window + ex.door,
            infiltrationLossW: lossInf,
            mechanicalVentilationLossW: lossVent,
        });
        const lossShareWarnings = buildLossShareWarnings(`Помещение «${zoneName}»`, lossShareMetrics.infiltrationShareOfTotalPct, lossShareMetrics.infiltrationShareOfAirExchangePct, lossShareMetrics.mechanicalVentilationLossW);
        return {
            zoneId: zone.id,
            zoneName,
            temperatureC: Ti,
            setpointC: sp,
            heatingPowerW: heatingW,
            envelopeExchangeSignedW: envSigned,
            infiltrationExchangeSignedW: infSigned,
            mechanicalVentilationExchangeSignedW: ventSigned,
            airExchangeSignedW: infSigned + ventSigned,
            transmissionLossW: lossShareMetrics.transmissionLossW,
            lossOpaqueW: ex.opaque,
            lossWindowW: ex.window,
            lossDoorW: ex.door,
            lossInfiltrationW: lossInf,
            lossMechanicalVentilationW: lossVent,
            airExchangeLossW: lossShareMetrics.airExchangeLossW,
            totalLossW: lossShareMetrics.totalLossW,
            infiltrationShareOfTotalPct: lossShareMetrics.infiltrationShareOfTotalPct,
            infiltrationShareOfAirExchangePct: lossShareMetrics.infiltrationShareOfAirExchangePct,
            lossShareWarnings,
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
    const totalVent = zones.reduce((s, z) => s + z.lossMechanicalVentilationW, 0);
    const totalTransmission = totalOpaque + totalWindow + totalDoor;
    const totalGains = zones.reduce((s, z) => s + z.internalGainsW, 0);
    const totalHeating = zones.reduce((s, z) => s + z.heatingPowerW, 0);
    const intExSum = zones.reduce((s, z) => s + z.internalExchangeNetW, 0);
    const totalEnvelopeSigned = zones.reduce((s, z) => s + z.envelopeExchangeSignedW, 0);
    const totalInfilSigned = zones.reduce((s, z) => s + z.infiltrationExchangeSignedW, 0);
    const totalMechanicalVentilationSigned = zones.reduce((s, z) => s + z.mechanicalVentilationExchangeSignedW, 0);
    const totalAirExchangeSigned = zones.reduce((s, z) => s + z.airExchangeSignedW, 0);
    const lossShareMetrics = calculateLossShareMetrics({
        transmissionLossW: totalTransmission,
        infiltrationLossW: totalInfil,
        mechanicalVentilationLossW: totalVent,
    });
    const balanceResidual = totalHeating + totalGains + intExSum - totalEnvelopeSigned - totalAirExchangeSigned;
    const totalPeakHeating = metricFrames.length
        ? metricFrames[peakIdx].zones.reduce((s, z) => s + Math.max(0, z.heatingPowerW), 0)
        : totalHeating;
    const intExAbsSum = zones.reduce((s, z) => s + Math.abs(z.internalExchangeNetW), 0);
    let envelopeSplitMaxDeviationW = 0;
    zones.forEach((z) => {
        envelopeSplitMaxDeviationW = Math.max(envelopeSplitMaxDeviationW, envelopeConductanceSplitMismatchMaxW(z.zoneId, model.outdoorLinks, z.temperatureC, outdoorC));
    });
    const balanceScale = balanceResidualScaleW(totalHeating, totalGains, totalEnvelopeSigned, totalAirExchangeSigned, intExAbsSum);
    const balanceRelativeResidual = Math.abs(balanceResidual) / balanceScale;
    const { status: balanceStatus, note: balanceStatusNoteRu } = classifyBalanceResidual(balanceRelativeResidual);
    const lossShareWarnings = buildLossShareWarnings("Здание", lossShareMetrics.infiltrationShareOfTotalPct, lossShareMetrics.infiltrationShareOfAirExchangePct, lossShareMetrics.mechanicalVentilationLossW);
    const engineering = buildThermalDiagnosticsEngineering();
    const infiltrationDiagnostics = model.infiltrationCalculation
        ? {
            mode: model.infiltrationCalculation.mode,
            achSource: model.infiltrationCalculation.diagnostics.achSource,
            calculatedACH: model.infiltrationCalculation.calculatedACH,
            airflowM3h: model.infiltrationCalculation.airflowM3h,
            pressureWindPa: model.infiltrationCalculation.pressureWindPa,
            pressureStackPa: model.infiltrationCalculation.pressureStackPa,
            pressureTotalPa: model.infiltrationCalculation.pressureTotalPa,
            heatLossW: model.infiltrationCalculation.heatLossW,
            warnings: [...model.infiltrationCalculation.warnings],
            assumptions: [...model.infiltrationCalculation.assumptions],
        }
        : undefined;
    const building = {
        referenceTimeHours: frame?.timeHours ?? 0,
        referenceOutdoorC: outdoorC,
        referenceNote: "Срез в момент максимальной суммарной мощности отопления по зонам. Доли потерь считаются только от totalLossW = transmissionLossW + infiltrationLossW + mechanicalVentilationLossW при положительном отводе тепла (T_i>T_n). Отдельная доля инфильтрации внутри воздухообмена использует знаменатель airExchangeLossW = infiltrationLossW + mechanicalVentilationLossW.",
        totalEnvelopeExchangeSignedW: totalEnvelopeSigned,
        totalInfiltrationExchangeSignedW: totalInfilSigned,
        totalMechanicalVentilationExchangeSignedW: totalMechanicalVentilationSigned,
        totalAirExchangeSignedW: totalAirExchangeSigned,
        totalTransmissionLossW: totalTransmission,
        totalOpaqueLossW: totalOpaque,
        totalWindowLossW: totalWindow,
        totalDoorLossW: totalDoor,
        totalInfiltrationLossW: totalInfil,
        totalMechanicalVentilationLossW: totalVent,
        totalAirExchangeLossW: lossShareMetrics.airExchangeLossW,
        totalLossW: lossShareMetrics.totalLossW,
        infiltrationShareOfTotalPct: lossShareMetrics.infiltrationShareOfTotalPct,
        infiltrationShareOfAirExchangePct: lossShareMetrics.infiltrationShareOfAirExchangePct,
        lossShareWarnings,
        totalInternalGainsW: totalGains,
        totalHeatingW: totalHeating,
        internalExchangeNetSumW: intExSum,
        balanceResidualW: balanceResidual,
        lossSharePercent: {
            opaque: sharePercentOrZero(totalOpaque, lossShareMetrics.totalLossW),
            window: sharePercentOrZero(totalWindow, lossShareMetrics.totalLossW),
            door: sharePercentOrZero(totalDoor, lossShareMetrics.totalLossW),
            infiltration: sharePercentOrZero(totalInfil, lossShareMetrics.totalLossW),
            ventilation: sharePercentOrZero(totalVent, lossShareMetrics.totalLossW),
        },
        heatedFloorAreaM2: heatedFloorAreaM2,
        specificPeakLoad_W_m2: totalPeakHeating / floorSafe,
        specificEnergyKWh_m2: totalEnergyKWh / floorSafe,
        envelopeSplitMaxDeviationW,
        balanceRelativeResidual,
        balanceStatus,
        balanceStatusNoteRu,
        infiltration: infiltrationDiagnostics,
    };
    const metricCards = buildEngineeringMetricCards(engineering, building, peakLoadKW, totalEnergyKWh);
    const derived = buildRcDerivedDiagnostics({
        buildingModel,
        model,
        options,
        building,
        zones,
        hydronic,
    });
    const discomfortHours = Object.values(zoneSummary).reduce((sum, zone) => sum + zone.discomfortSeconds / 3600, 0);
    const thermalResultForPerformance = {
        timeline: frames.map((frame) => ({
            timeHours: frame.timeHours,
            outdoorTemperatureC: frame.outdoorTemperatureC,
            rooms: frame.rooms ?? {},
        })),
        rooms: Object.fromEntries(model.zones.map((zone) => [
            zone.id,
            {
                roomId: zone.id,
                timeline: frames.map((frame) => ({
                    timeHours: frame.timeHours,
                    temperatureC: frame.rooms?.[zone.id]?.temperatureC ?? 0,
                    heatingPowerW: frame.rooms?.[zone.id]?.heatingPowerW ?? 0,
                })),
                dailyEnergyKWh: zoneSummary[zone.id] ? zoneSummary[zone.id].energyJ / 3_600_000 : 0,
                discomfortHours: zoneSummary[zone.id] ? zoneSummary[zone.id].discomfortSeconds / 3600 : 0,
            },
        ])),
        summary: {
            peakLoadKW,
            totalEnergyKWh,
            discomfortHours,
        },
    };
    const buildingPerformance = buildBuildingPerformanceDiagnostics(buildingModel, thermalResultForPerformance, model, options, derived, { ...performanceOptions, timestepSeconds }, adjacency, zones);
    return {
        engineering,
        building,
        zones,
        derived,
        buildingPerformance,
        metricCards,
    };
}
