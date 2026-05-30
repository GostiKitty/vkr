import { isHeatingPipeType } from "../../entities/networks/types";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { CITY_ENERGY_PROFILES, GAS_LCV_KWH_PER_M3, DEFAULT_BOILER_EFFICIENCY, gasM3TariffToKwh, getCityEnergyProfile } from "./cityEnergyProfile";
import { economicDefaults } from "./types";
export const KWH_PER_GCAL = 1163;
export { GAS_LCV_KWH_PER_M3, DEFAULT_BOILER_EFFICIENCY, gasM3TariffToKwh };
/**
 * Обратно-совместимый объект региональных тарифов.
 * Строится автоматически из CITY_ENERGY_PROFILES, поэтому всегда синхронизирован.
 */
export const REGIONAL_ENERGY_TARIFFS = Object.fromEntries(CITY_ENERGY_PROFILES.map((p) => [
    p.cityId,
    { heatTariffRubPerGcal: p.heatTariffRubPerGcal, electricityTariffRubPerKwh: p.electricityTariffRubPerKwh },
]));
const DEFAULT_TARIFFS = {
    heatTariffRubPerGcal: economicDefaults.heatTariffRubPerGcal,
    electricityTariffRubPerKwh: economicDefaults.electricityTariffRubPerKwh,
};
export function resolveHeatingEnergySource(scenario, model) {
    const ecology = scenario.ecology?.energySource?.trim().toLowerCase() ?? "";
    if (ecology === "electricity") {
        return "electricity";
    }
    if (ecology === "gas" || ecology === "natural_gas" || ecology.includes("газ")) {
        return "gas";
    }
    if (ecology === "централизованное теплоснабжение" ||
        ecology.includes("теплоснабж") ||
        ecology.includes("цт")) {
        return "heat";
    }
    const emitter = scenario.engineeringSystems?.emitterType?.toLowerCase() ?? "";
    if (/электр|конвектор|тэ[нн]|инфракрасн|камин/.test(emitter)) {
        return "electricity";
    }
    const hasHydronicHeating = model.pipes.some((pipe) => isHeatingPipeType(pipe.type)) ||
        model.equipment.some((item) => item.type === "boiler" || item.type === "radiator" || item.type === "heat_exchanger");
    if (hasHydronicHeating) {
        return "heat";
    }
    if (scenario.engineeringSystems?.heatingEnabled === false) {
        return "unknown";
    }
    return "unknown";
}
export function heatingEnergySourceLabel(source) {
    switch (source) {
        case "electricity":
            return "Электроотопление";
        case "gas":
            return "Газовый котёл (автономное)";
        case "heat":
            return "Тепловая энергия (ЦТ / котёл)";
        default:
            return "Не определён";
    }
}
export function resolveScenarioEnergyTariff(scenario, model) {
    const city = getSp131CityClimate(scenario.climateCityId ?? null);
    const profile = getCityEnergyProfile(city?.id ?? null);
    const regional = profile ?? DEFAULT_TARIFFS;
    let heatingEnergySource = resolveHeatingEnergySource(scenario, model);
    if (heatingEnergySource === "unknown") {
        heatingEnergySource = "heat";
    }
    const heatTariffRubPerGcal = regional.heatTariffRubPerGcal;
    const electricityTariffRubPerKwh = regional.electricityTariffRubPerKwh;
    const gasTariffRubPerM3 = profile?.gasTariffRubPerM3 ?? 0;
    let tariffRubPerKWh;
    if (heatingEnergySource === "electricity") {
        tariffRubPerKWh = electricityTariffRubPerKwh;
    }
    else if (heatingEnergySource === "gas") {
        tariffRubPerKWh = gasM3TariffToKwh(gasTariffRubPerM3);
    }
    else {
        tariffRubPerKWh = heatTariffRubPerGcal / KWH_PER_GCAL;
    }
    const warnings = [];
    if (heatingEnergySource === "gas" && !profile?.gasAvailable) {
        warnings.push("В выбранном городе газ для отопления ограниченно доступен. Тариф использован по умолчанию.");
    }
    return {
        heatingEnergySource,
        heatingEnergySourceLabel: heatingEnergySourceLabel(heatingEnergySource),
        heatTariffRubPerGcal,
        electricityTariffRubPerKwh,
        gasTariffRubPerM3,
        tariffRubPerKWh,
        cityLabel: city?.label ?? null,
        constructionCostFactor: profile?.constructionCostFactor ?? 1.0,
        gasUnderconsumptionPenaltyPercent: profile?.gasUnderconsumptionPenaltyPercent ?? 25,
        heatContractMinimumPaymentFraction: profile?.heatContractMinimumPaymentFraction ?? 0,
        warnings,
    };
}
