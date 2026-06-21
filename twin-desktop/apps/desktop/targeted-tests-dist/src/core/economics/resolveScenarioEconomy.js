import { polygonArea } from "../../entities/geometry/geom";
import { buildAdjacencyGraph } from "../graph/adjacency";
import { hasModelWindowAreaSource, resolveModelWindowAreaM2 } from "../../shared/utils/openingThermalData";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { DEFAULT_ANNUAL_TARIFF_GROWTH_PERCENT, getCityEnergyProfile } from "./cityEnergyProfile";
import { economicDefaults } from "./types";
/** Ставка дисконтирования для ТЭО энергоэффективных мероприятий жилфонда, % */
export const DEFAULT_DISCOUNT_RATE_PERCENT = 10;
/** Доля CAPEX на ежегодное обслуживание инженерии после модернизации */
export const DEFAULT_MAINTENANCE_PERCENT_OF_CAPEX = 1.5;
export const ECONOMY_NORM_NOTES = {
    discountRate: "Ставка дисконтирования 10 % — типовой ориентир для ТЭО энергоэффективных мероприятий жилых и общественных зданий.",
    tariffGrowth: "Рост тарифа: индексация ЖКХ по Распоряжению Правительства РФ №3287-р (2025 — 11,9 %, 2026 — 5,4 %, 2027 — 4,8 %); по региону — уточнение.",
    maintenance: `Эксплуатация ${DEFAULT_MAINTENANCE_PERCENT_OF_CAPEX} % от CAPEX в год — ориентир для обслуживания инженерии после реновации.`,
    insulation: "Смета утепления: площади стен/кровли/пола из модели × типовые цены материалов и работ (средние по РФ) × региональный коэффициент.",
    windows: "Смета окон: площадь окон из модели × типовая стоимость замены на энергоэффективные (средний диапазон по рынку РФ) × региональный коэффициент.",
    equipment: "Смета оборудования: типовой комплекс терморегулирования и балансировки отопления (средний диапазон по рынку РФ) × региональный коэффициент.",
    capex: "CAPEX = утепление + окна + оборудование (оценка по модели и региональным коэффициентам).",
};
function midpoint([min, max]) {
    return (min + max) / 2;
}
function isExplicitNumber(value) {
    return value != null && Number.isFinite(value);
}
function resolveScalar(raw, estimate, sourceWhenEstimated, normNote) {
    if (isExplicitNumber(raw)) {
        return { value: raw, source: "user", explicit: true, normNote: null };
    }
    const value = estimate();
    if (value == null || !Number.isFinite(value)) {
        return { value: null, source: "missing", explicit: false, normNote: null };
    }
    return { value, source: sourceWhenEstimated, explicit: false, normNote };
}
function measureCostRubM2(measureKey, areaM2, regionalFactor) {
    const def = economicDefaults.measures[measureKey];
    if (!def || areaM2 <= 0) {
        return 0;
    }
    if (def.totalCostRubM2) {
        return areaM2 * midpoint(def.totalCostRubM2) * regionalFactor;
    }
    const material = def.materialCostRubM2 ? midpoint(def.materialCostRubM2) : 0;
    const work = def.workCostRubM2 ? midpoint(def.workCostRubM2) : 0;
    return areaM2 * (material + work) * regionalFactor;
}
function measureCostComplex(measureKey, regionalFactor) {
    const def = economicDefaults.measures[measureKey];
    if (!def?.totalCostRub) {
        return 0;
    }
    return midpoint(def.totalCostRub) * regionalFactor;
}
export function extractEnvelopeAreasForEconomy(model) {
    const adjacency = buildAdjacencyGraph(model);
    const facadeAreaM2 = adjacency.external.reduce((sum, edge) => sum + Math.max(0, edge.area_m2), 0);
    const hasWindowArea = hasModelWindowAreaSource(model);
    const windowAreaM2 = hasWindowArea ? resolveModelWindowAreaM2(model) : 0;
    const wallOpaqueAreaM2 = Math.max(0, facadeAreaM2 - windowAreaM2);
    const roofAreaM2 = (model.roofs ?? []).reduce((sum, roof) => sum + Math.abs(polygonArea(roof.boundary)), 0);
    const floorAreaM2 = (model.floorSlabs ?? [])
        .filter((slab) => slab.kind === "ground" || slab.kind === "basement")
        .reduce((sum, slab) => sum + Math.abs(polygonArea(slab.boundary)), 0);
    const heatedAreaM2 = model.rooms.reduce((sum, room) => sum + Math.abs(polygonArea(room.polygon)), 0);
    return { wallOpaqueAreaM2, windowAreaM2, roofAreaM2, floorAreaM2, heatedAreaM2, hasWindowArea };
}
function estimateInsulationCostRub(areas, regionalFactor) {
    const wall = measureCostRubM2("wallInsulationMineralWool", areas.wallOpaqueAreaM2, regionalFactor);
    const roof = measureCostRubM2("roofInsulationMineralWool", areas.roofAreaM2, regionalFactor);
    const floor = measureCostRubM2("floorInsulation", areas.floorAreaM2, regionalFactor);
    const total = wall + roof + floor;
    if (total > 0) {
        return Math.round(total);
    }
    if (areas.heatedAreaM2 > 0) {
        return Math.round(areas.heatedAreaM2 * 2800 * regionalFactor);
    }
    return null;
}
function estimateWindowsCostRub(areas, regionalFactor) {
    if (areas.hasWindowArea && areas.windowAreaM2 > 0) {
        return Math.round(measureCostRubM2("windowReplacement", areas.windowAreaM2, regionalFactor));
    }
    if (areas.heatedAreaM2 > 0) {
        const assumedWindowAreaM2 = Math.min(areas.heatedAreaM2 * 0.18, 120);
        return Math.round(measureCostRubM2("windowReplacement", assumedWindowAreaM2, regionalFactor));
    }
    return null;
}
function estimateEquipmentCostRub(regionalFactor) {
    return Math.round(measureCostComplex("heatingControl", regionalFactor));
}
function estimateCapexRub(insulation, windows, equipment) {
    const parts = [insulation, windows, equipment].filter((v) => v != null && v > 0);
    if (!parts.length) {
        return null;
    }
    return Math.round(parts.reduce((sum, value) => sum + value, 0));
}
function estimateMaintenanceCostRub(capex) {
    if (capex == null || capex <= 0) {
        return null;
    }
    return Math.round((capex * DEFAULT_MAINTENANCE_PERCENT_OF_CAPEX) / 100);
}
export function resolveRegionalTariffGrowthPercent(climateCityId) {
    const city = getSp131CityClimate(climateCityId ?? null);
    const profile = getCityEnergyProfile(city?.id ?? null);
    return {
        value: profile?.annualTariffGrowthPercent ?? DEFAULT_ANNUAL_TARIFF_GROWTH_PERCENT,
        cityLabel: city?.label ?? null,
    };
}
export function resolveScenarioEconomy(scenarioConfig, model) {
    const economy = scenarioConfig?.economy;
    const tariffGrowth = resolveRegionalTariffGrowthPercent(scenarioConfig?.climateCityId);
    const profile = getCityEnergyProfile(getSp131CityClimate(scenarioConfig?.climateCityId ?? null)?.id ?? null);
    const regionalFactor = profile?.constructionCostFactor ?? economicDefaults.regionalCostFactor;
    const areas = extractEnvelopeAreasForEconomy(model);
    const insulationEstimate = estimateInsulationCostRub(areas, regionalFactor);
    const windowsEstimate = estimateWindowsCostRub(areas, regionalFactor);
    const equipmentEstimate = estimateEquipmentCostRub(regionalFactor);
    const insulation = resolveScalar(economy?.insulationCostRub, () => insulationEstimate, "estimated", ECONOMY_NORM_NOTES.insulation);
    const windows = resolveScalar(economy?.windowsCostRub, () => windowsEstimate, "estimated", ECONOMY_NORM_NOTES.windows);
    const equipment = resolveScalar(economy?.equipmentCostRub, () => equipmentEstimate, "estimated", ECONOMY_NORM_NOTES.equipment);
    const capex = resolveScalar(economy?.capexRub, () => estimateCapexRub(insulation.explicit ? economy?.insulationCostRub ?? null : insulation.value, windows.explicit ? economy?.windowsCostRub ?? null : windows.value, equipment.explicit ? economy?.equipmentCostRub ?? null : equipment.value), "estimated", ECONOMY_NORM_NOTES.capex);
    const maintenance = resolveScalar(economy?.annualMaintenanceCostRub, () => estimateMaintenanceCostRub(capex.explicit ? economy?.capexRub ?? null : capex.value), "estimated", ECONOMY_NORM_NOTES.maintenance);
    const tariffGrowthNote = tariffGrowth.cityLabel
        ? `${ECONOMY_NORM_NOTES.tariffGrowth} (${tariffGrowth.cityLabel}).`
        : ECONOMY_NORM_NOTES.tariffGrowth;
    return {
        discountRatePercent: resolveScalar(economy?.discountRatePercent, () => DEFAULT_DISCOUNT_RATE_PERCENT, "norm", ECONOMY_NORM_NOTES.discountRate),
        annualTariffGrowthPercent: resolveScalar(economy?.annualTariffGrowthPercent, () => tariffGrowth.value, scenarioConfig?.climateCityId ? "norm" : "norm", tariffGrowthNote),
        analysisPeriodYears: resolveScalar(economy?.analysisPeriodYears, () => 15, "norm", "Период анализа 15 лет — типовый горизонт для оценки энергоэффективных мероприятий."),
        annualMaintenanceCostRub: maintenance,
        insulationCostRub: insulation,
        windowsCostRub: windows,
        equipmentCostRub: equipment,
        capexRub: capex,
        constructionCostFactor: regionalFactor,
        cityLabel: tariffGrowth.cityLabel,
    };
}
export function resolvedEconomyDisplayValue(raw, resolved) {
    return isExplicitNumber(raw) ? raw : resolved.value;
}
