import { getVolumeCoefficientBetaV } from "../../../norms/sp50_2024/volumeCoefficient";
import { getSolarRadiation } from "../../../norms/sp50_2024/solarRadiation";
import { calculateAnnualHeatingEnergy, calculateHeatingEnergyCharacteristic, } from "./calculations";
/** Теплоёмкость воздуха в энергетической характеристике СП 50, кВт·ч/(м³·К). */
export const SP50_AIR_HEAT_CAPACITY_KWH_M3K = 0.28;
/**
 * Удельная плотность бытовых тепловых поступлений q_int по СП 50.13330.2024 Таблица Д.2, Вт/м².
 * Для жилых — расчётная площадь, для прочих — площадь помещений.
 */
export function sp50InternalGainDensity_W_m2(category) {
    switch (category) {
        case "public":
        case "administrative":
        case "educational":
            return 10;
        case "preschool":
        case "medical":
            return 8;
        case "industrialDry":
        case "industrialWet":
        case "industrialHighHeat":
        case "agricultural":
        case "storage":
            return 12;
        default:
            return 17;
    }
}
/**
 * Коэффициент ξ в формуле β_kpi = 1/(1 + ξ·n_kpi) по СП 50.13330.2024 п. 9.3.
 * Жилые: 0.8; общественные и прочие: 0.5.
 */
export function sp50GainUseCoefficientXi(category) {
    switch (category) {
        case "public":
        case "administrative":
        case "educational":
        case "preschool":
        case "medical":
            return 0.5;
        default:
            return 0.8;
    }
}
/** Средняя плотность воздуха в отопительный период по СП 50: γ = 353/(273+t), кг/м³. */
export function sp50AverageAirDensityKgM3(outdoorHeatingPeriodAverageC) {
    return 353 / (273 + outdoorHeatingPeriodAverageC);
}
const HOURS_PER_WEEK = 168;
function deriveVentilationFlows(volume, tOutdoor, ventilation) {
    const warnings = [];
    const rho = sp50AverageAirDensityKgM3(tOutdoor);
    let Lvent = ventilation.ventilationFlowM3H ?? null;
    if (Lvent === null && ventilation.ventilationACH != null && Number.isFinite(ventilation.ventilationACH)) {
        Lvent = volume * Math.max(0, ventilation.ventilationACH);
    }
    let Ginf = ventilation.infiltrationMassFlowKgH ?? null;
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
export function computeSp50EnergyCharacteristic(input) {
    const { kob_W_m3K, gsop, heatedVolumeM3: volume, heatedAreaM2: area, residentialAreaM2, indoorTemperatureC: tIndoor, outdoorHeatingPeriodAverageC: tOutdoor, ventilation, } = input;
    const placeholderWarnings = [];
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
    const betaV = ventilation.volumeCoefficientBetaV ??
        getVolumeCoefficientBetaV(input.buildingCategory ?? undefined);
    const averageAirDensity = tOutdoor !== null ? sp50AverageAirDensityKgM3(tOutdoor) : null;
    const { Lvent, Ginf, warnings: flowWarnings } = volume !== null && tOutdoor !== null
        ? deriveVentilationFlows(volume, tOutdoor, ventilation)
        : { Lvent: null, Ginf: null, warnings: [] };
    placeholderWarnings.push(...flowWarnings);
    const averageAirExchange = volume && averageAirDensity && Lvent !== null && Ginf !== null
        ? ((Lvent * nVent) / HOURS_PER_WEEK + Ginf * nInf / (HOURS_PER_WEEK * averageAirDensity)) / (betaV * volume)
        : null;
    /** k_vent по СП 50: c·(L_vent·γ·n·(1−k_ef)+G_inf·n) / (168·V), c = 0,28 кВт·ч/(м³·К). */
    const kVent = volume && averageAirDensity && Lvent !== null && Ginf !== null
        ? (c * (Lvent * averageAirDensity * nVent * (1 - kEf) + Ginf * nInf)) / (HOURS_PER_WEEK * volume)
        : null;
    const deltaT = tIndoor !== null && tOutdoor !== null ? tIndoor - tOutdoor : null;
    const qIntDensity = sp50InternalGainDensity_W_m2(input.buildingCategory);
    const qbyt = volume && deltaT && deltaT > 0
        ? ((residentialAreaM2 ?? area ?? 0) * qIntDensity) / (volume * deltaT)
        : null;
    const solarData = input.solarRadiationIavg_W_m2 != null
        ? { Iavg_W_m2: input.solarRadiationIavg_W_m2 }
        : getSolarRadiation(input.solarRadiationZone ?? "central");
    const solarIavg = solarData?.Iavg_W_m2 ?? 0;
    const qrad = volume && gsop && gsop > 0 ? (11.6 * (solarIavg * 0.001)) / (volume * gsop) : 0;
    const xi = sp50GainUseCoefficientXi(input.buildingCategory);
    const betaKpi = averageAirExchange !== null ? 1 / (1 + xi * averageAirExchange) : null;
    const qHeatingCharacteristic = kob_W_m3K !== null && kVent !== null && betaKpi !== null
        ? calculateHeatingEnergyCharacteristic({
            kob_W_m3K: kob_W_m3K,
            ventilationCharacteristic_W_m3K: kVent,
            betaGainUseFactor: betaKpi,
            internalGainCharacteristic_W_m3K: qbyt ?? 0,
            solarGainCharacteristic_W_m3K: qrad,
        })
        : null;
    const annualHeatingEnergy = gsop && volume && qHeatingCharacteristic !== null
        ? calculateAnnualHeatingEnergy(gsop, volume, qHeatingCharacteristic)
        : null;
    const annualTotalLosses = gsop && volume && kob_W_m3K !== null && kVent !== null
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
