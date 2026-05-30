import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { getCityEnergyProfile, gasM3TariffToKwh } from "./cityEnergyProfile";
import { economicDefaults } from "./types";
const HOURS_PER_DAY = 24;
const KWH_PER_GCAL = 1163;
/** Удельные выбросы CO₂ по источнику тепла, кг/кВт·ч тепловой энергии */
const DEFAULT_CO2_FACTORS = {
    gas: 0.22, // газовый котёл: ГОСТ Р 56277; природный газ 55.9 г/МДж / η=0.92
    heat: 0.20, // ЦТ от ТЭЦ на газе (учитывает когенерационный КПД)
    electricity: 0.35, // средний по ОЭС России (Приказ Минэнерго №1069-2021)
    unknown: 0.22,
};
const ZONE_LABELS = {
    walls: "Наружные стены",
    windows: "Окна и светопрозрачные конструкции",
    roof: "Кровля / чердачное перекрытие",
    floor: "Пол / перекрытие над подвалом",
    doors: "Двери и входные группы",
    thermalBridges: "Мостики холода",
    ventilationInfiltration: "Вентиляционные потери и инфильтрация",
    heatingSystem: "Отопление и регулирование",
};
const CONSTRUCTION_ZONE_MAP = {
    wall: "walls",
    window: "windows",
    lantern: "windows",
    roof: "roof",
    atticFloor: "roof",
    covering: "roof",
    floorOverBasement: "floor",
    floorOnGround: "floor",
    door: "doors",
    gate: "doors",
};
const MEASURE_LIBRARY = [
    {
        id: "wall-mineral-wool",
        zoneId: "walls",
        targetConstructionTypes: ["wall"],
        kind: "envelope",
        defaultsKey: "wallInsulationMineralWool",
        description: "Внешнее утепление стен минеральной ватой толщиной 100-150 мм.",
        application: "all_zone_area",
    },
    {
        id: "wall-polystyrene",
        zoneId: "walls",
        targetConstructionTypes: ["wall"],
        kind: "envelope",
        defaultsKey: "wallInsulationPolystyrene",
        description: "Утепление стен пенополистиролом 100-150 мм.",
        application: "all_zone_area",
    },
    {
        id: "wet-facade",
        zoneId: "walls",
        targetConstructionTypes: ["wall"],
        kind: "envelope",
        defaultsKey: "wetFacade",
        description: "Комплексная система мокрого фасада с утеплителем.",
        application: "all_zone_area",
    },
    {
        id: "ventilated-facade",
        zoneId: "walls",
        targetConstructionTypes: ["wall"],
        kind: "envelope",
        defaultsKey: "ventilatedFacade",
        description: "Навесной вентилируемый фасад с утеплителем.",
        application: "all_zone_area",
    },
    {
        id: "roof-mineral-wool",
        zoneId: "roof",
        targetConstructionTypes: ["roof", "atticFloor", "covering"],
        kind: "envelope",
        defaultsKey: "roofInsulationMineralWool",
        description: "Дополнительное утепление покрытия или чердачного перекрытия минеральной ватой 150-200 мм.",
        application: "all_zone_area",
    },
    {
        id: "roof-basalt",
        zoneId: "roof",
        targetConstructionTypes: ["roof", "atticFloor", "covering"],
        kind: "envelope",
        defaultsKey: "roofInsulationBasalt",
        description: "Утепление покрытия базальтовой ватой.",
        application: "all_zone_area",
    },
    {
        id: "cold-attic",
        zoneId: "roof",
        targetConstructionTypes: ["atticFloor", "covering", "roof"],
        kind: "envelope",
        defaultsKey: "coldAtticInsulation",
        description: "Утепление холодного чердака без вмешательства в кровельный пирог.",
        application: "all_zone_area",
    },
    {
        id: "floor-insulation",
        zoneId: "floor",
        targetConstructionTypes: ["floorOverBasement", "floorOnGround"],
        kind: "envelope",
        defaultsKey: "floorInsulation",
        description: "Утепление пола или перекрытия над подвалом.",
        application: "all_zone_area",
    },
    {
        id: "window-replacement",
        zoneId: "windows",
        targetConstructionTypes: ["window", "lantern"],
        kind: "envelope",
        defaultsKey: "windowReplacement",
        description: "Полная замена старых окон на ПВХ-окна с двухкамерным стеклопакетом.",
        application: "all_zone_area",
    },
    {
        id: "energy-glazing",
        zoneId: "windows",
        targetConstructionTypes: ["window", "lantern"],
        kind: "envelope",
        defaultsKey: "energyGlassUnit",
        description: "Модернизация стеклопакета до энергосберегающего.",
        application: "all_zone_area",
    },
    {
        id: "window-joints-sealing",
        zoneId: "windows",
        targetConstructionTypes: ["window", "lantern"],
        kind: "infiltration",
        defaultsKey: "jointsSealing",
        description: "Герметизация оконных примыканий и монтажных швов.",
        application: "all_zone_area",
    },
    {
        id: "window-hardware-adjustment",
        zoneId: "windows",
        targetConstructionTypes: ["window", "lantern"],
        kind: "infiltration",
        defaultsKey: "hardwareAdjustment",
        description: "Регулировка фурнитуры и восстановление уплотнителей.",
        application: "building_complex",
    },
    {
        id: "door-insulation",
        zoneId: "doors",
        targetConstructionTypes: ["door", "gate"],
        kind: "infiltration",
        defaultsKey: "doorInsulation",
        description: "Утепление входной двери и уплотнение притворов.",
        application: "building_complex",
    },
    {
        id: "sealing-leaks",
        zoneId: "ventilationInfiltration",
        kind: "infiltration",
        defaultsKey: "sealingLeaks",
        description: "Герметизация щелей, неплотностей и узлов примыкания.",
        application: "building_complex",
    },
    {
        id: "vestibule",
        zoneId: "ventilationInfiltration",
        kind: "infiltration",
        defaultsKey: "vestibule",
        description: "Устройство тамбура или второй двери на входной группе.",
        application: "building_complex",
    },
    {
        id: "thermal-bridge-mitigation",
        zoneId: "thermalBridges",
        kind: "envelope",
        defaultsKey: "thermalBridgeMitigation",
        description: "Локальное утепление зон промерзания, откосов, перемычек и торцов плит.",
        application: "building_complex",
    },
    {
        id: "heating-control",
        zoneId: "heatingSystem",
        kind: "heating",
        defaultsKey: "heatingControl",
        description: "Установка терморегуляторов и гидравлическая балансировка системы.",
        application: "building_complex",
    },
    {
        id: "weather-control",
        zoneId: "heatingSystem",
        kind: "heating",
        defaultsKey: "weatherControl",
        description: "Погодозависимое регулирование источника тепла и контуров.",
        application: "building_complex",
    },
    {
        id: "pipe-insulation",
        zoneId: "heatingSystem",
        kind: "heating",
        defaultsKey: "pipeInsulation",
        description: "Утепление трубопроводов в подвале, чердаке и других неотапливаемых зонах.",
        application: "building_complex",
    },
];
export function buildDefaultEconomicScenario(report) {
    // getSp131CityClimate принимает и id («moscow»), и русскую метку («Москва») —
    // именно это нужно, т.к. sourceData.city хранит русское название.
    const climate = getSp131CityClimate(report.sourceData.city ?? null);
    const profile = getCityEnergyProfile(climate?.id ?? null);
    const heatTariff = profile?.heatTariffRubPerGcal ?? economicDefaults.heatTariffRubPerGcal;
    const elecTariff = profile?.electricityTariffRubPerKwh ?? economicDefaults.electricityTariffRubPerKwh;
    return {
        id: "default-economic-scenario",
        name: "Комплексная модернизация",
        mode: "comprehensive",
        region: report.sourceData.city ?? economicDefaults.region,
        buildingType: mapBuildingType(report.sourceData.buildingCategory),
        heatingEnergySource: "heat",
        heatTariffRubPerGcal: heatTariff,
        electricityTariffRubPerKwh: elecTariff,
        gasTariffRubPerM3: profile?.gasTariffRubPerM3 ?? 0,
        gasUnderconsumptionPenaltyPercent: profile?.gasUnderconsumptionPenaltyPercent ?? 25,
        gasMinimumOfftakePercent: profile?.gasMinimumOfftakePercent ?? 70,
        heatContractMinimumPaymentFraction: profile?.heatContractMinimumPaymentFraction ?? 0,
        regionalCostFactor: profile?.constructionCostFactor ?? economicDefaults.regionalCostFactor,
        co2EmissionFactor_kgPerKWh: DEFAULT_CO2_FACTORS.heat,
        analysisPeriod_years: 15,
        discountRate: 0.1,
        annualTariffGrowthPercent: 5,
        annualMaintenanceCost_RUB: 0,
        annualMaintenancePercentOfCost: 0,
        residualValuePercent: 0,
        tariff: {
            heatPrice_RUB_kWh: heatTariff / KWH_PER_GCAL,
            currency: economicDefaults.currency,
        },
        defaults: economicDefaults,
        measures: MEASURE_LIBRARY,
    };
}
export function runEconomicAssessment(report, scenario) {
    const warnings = [];
    const zones = buildEconomicZones(report, warnings);
    if (scenario.heatingEnergySource === "unknown") {
        warnings.push("Тип энергоносителя не задан. Для расчета по умолчанию использован тариф на тепловую энергию, руб./Гкал.");
    }
    if (scenario.heatingEnergySource === "heat" && scenario.heatTariffRubPerGcal <= 0) {
        warnings.push("Тариф на тепловую энергию не задан или равен нулю. Денежная экономия будет рассчитана как нулевая.");
    }
    if (scenario.heatingEnergySource === "electricity" && scenario.electricityTariffRubPerKwh <= 0) {
        warnings.push("Тариф на электроэнергию не задан или равен нулю. Денежная экономия будет рассчитана как нулевая.");
    }
    if (scenario.heatingEnergySource === "gas") {
        const penaltyPct = scenario.gasUnderconsumptionPenaltyPercent ?? 0;
        if (penaltyPct > 0) {
            warnings.push(`Источник тепла — газовый котёл. При наличии договора с минимальным объёмом выборки экономия от снижения потребления уменьшается на штраф за недобор (~${penaltyPct} % от сэкономленной суммы). Колонка «Эффект. экономия» учитывает этот штраф.`);
        }
        if ((scenario.gasTariffRubPerM3 ?? 0) <= 0) {
            warnings.push("Тариф на газ не задан. Денежная экономия для мероприятий рассчитана как нулевая.");
        }
    }
    if (scenario.heatingEnergySource === "heat") {
        const minFraction = scenario.heatContractMinimumPaymentFraction ?? 0;
        if (minFraction > 0.05) {
            warnings.push(`Для зданий без приборов учёта тепловой энергии часть оплаты (~${Math.round(minFraction * 100)} %) не зависит от фактического потребления. Эффективная экономия рассчитана с учётом этого ограничения.`);
        }
    }
    const totalHeatLoss_W = zones.reduce((sum, zone) => sum + zone.heatLoss_W, 0);
    zones.forEach((zone) => {
        zone.heatLossShare = totalHeatLoss_W > 0 ? zone.heatLoss_W / totalHeatLoss_W : 0;
    });
    const rawResults = scenario.measures.map((measure) => evaluateMeasure(report, scenario, measure, zones));
    const calculated = rawResults.filter((entry) => entry.status === "calculated");
    const normalized = normalizeScores(calculated, scenario.mode);
    const insufficient = rawResults.filter((entry) => entry.status !== "calculated");
    const ranked = [...normalized, ...insufficient].sort(compareMeasureResults);
    if (ranked.length > 0) {
        ranked[0] = { ...ranked[0], isRecommended: ranked[0].status === "calculated" };
    }
    ranked.forEach((entry) => warnings.push(...entry.warnings));
    const packageMeasures = buildRecommendedPackage(ranked);
    const packageCost_RUB = packageMeasures.reduce((sum, entry) => sum + entry.totalCost_RUB, 0);
    const packageAnnualSaving_RUB = packageMeasures.reduce((sum, entry) => sum + entry.annualSaving_RUB, 0);
    const packageContractPenalty_RUB = packageMeasures.reduce((sum, entry) => sum + entry.contractPenalty_RUB, 0);
    const packageEffectiveAnnualSaving_RUB = Math.max(0, packageAnnualSaving_RUB - packageContractPenalty_RUB);
    const packageSavedEnergy_kWh_year = packageMeasures.reduce((sum, entry) => sum + entry.savedEnergy_kWh_year, 0);
    const packageSavedEnergy_Gcal_year = packageSavedEnergy_kWh_year / KWH_PER_GCAL;
    const packageSavedCO2_raw = packageMeasures.reduce((acc, entry) => {
        if (entry.savedCO2_tCO2_year === null)
            return acc;
        return (acc ?? 0) + entry.savedCO2_tCO2_year;
    }, null);
    const packageSavedCO2_tCO2_year = packageSavedCO2_raw !== null ? Math.max(0, packageSavedCO2_raw) : null;
    const packagePayback_years = calculateSimplePayback_years(packageCost_RUB, packageEffectiveAnnualSaving_RUB);
    const packageNpv_RUB = packageMeasures.reduce((sum, entry) => sum + (entry.npv_RUB ?? 0), 0);
    const beforeEnergy = report.energy.annualHeatingEnergy_kWh;
    const afterEnergy = Number.isFinite(beforeEnergy) && Number.isFinite(packageSavedEnergy_kWh_year)
        ? Math.max(0, (beforeEnergy ?? 0) - packageSavedEnergy_kWh_year)
        : null;
    const mainZone = zones.slice().sort((left, right) => right.heatLossShare - left.heatLossShare)[0] ?? null;
    // Удельный расход и класс энергоэффективности
    const heatedArea = report.sourceData.heatedAreaM2;
    const qActual = report.energy.qByArea_kWh_m2;
    const qNorm = report.energy.qHeatingNorm_kWh_m2;
    const specificHeatConsumption_kWh_m2 = Number.isFinite(qActual) ? (qActual ?? null) : null;
    const specificHeatConsumptionAfter_kWh_m2 = afterEnergy !== null && heatedArea != null && heatedArea > 0
        ? afterEnergy / heatedArea
        : null;
    const sp50EnergyNorm_kWh_m2 = Number.isFinite(qNorm) ? (qNorm ?? null) : null;
    const energyClassBefore = specificHeatConsumption_kWh_m2 !== null && sp50EnergyNorm_kWh_m2 !== null
        ? classifyEnergyClass(specificHeatConsumption_kWh_m2, sp50EnergyNorm_kWh_m2)
        : null;
    const energyClassAfter = specificHeatConsumptionAfter_kWh_m2 !== null && sp50EnergyNorm_kWh_m2 !== null
        ? classifyEnergyClass(specificHeatConsumptionAfter_kWh_m2, sp50EnergyNorm_kWh_m2)
        : null;
    const sp50EnergyComplies = specificHeatConsumption_kWh_m2 !== null && sp50EnergyNorm_kWh_m2 !== null
        ? specificHeatConsumption_kWh_m2 <= sp50EnergyNorm_kWh_m2
        : null;
    // Чувствительность окупаемости к росту тарифа
    const paybackAtZeroGrowth_years = calculateSimplePayback_years(packageCost_RUB, packageEffectiveAnnualSaving_RUB);
    const paybackAtHighGrowth_years = calculateDiscountedPayback_years({
        cost_RUB: packageCost_RUB,
        annualSaving_RUB: packageEffectiveAnnualSaving_RUB,
        discountRate: 0,
        annualTariffGrowthPercent: 10,
        analysisPeriod_years: scenario.analysisPeriod_years,
    });
    const result = {
        scenario,
        sourceReport: report,
        summary: {
            totalHeatLoss_W,
            totalHeatLoss_kW: totalHeatLoss_W / 1000,
            mainLossZone: mainZone?.label ?? null,
            mainLossShare: mainZone?.heatLossShare ?? null,
            bestMeasureId: ranked[0]?.measureId ?? null,
            fastestPaybackMeasureId: calculated
                .slice()
                .sort((left, right) => (left.payback_years ?? Number.POSITIVE_INFINITY) - (right.payback_years ?? Number.POSITIVE_INFINITY))[0]?.measureId ?? null,
            packageCost_RUB,
            packageAnnualSaving_RUB,
            packageContractPenalty_RUB,
            packageEffectiveAnnualSaving_RUB,
            packageSavedEnergy_kWh_year,
            packageSavedEnergy_Gcal_year,
            packageSavedCO2_tCO2_year,
            packagePayback_years,
            packagePaybackClass: classifyPayback(packagePayback_years, packageAnnualSaving_RUB),
            totalCost_RUB: packageCost_RUB,
            totalAnnualSaving_RUB: packageAnnualSaving_RUB,
            totalSavedEnergy_kWh_year: packageSavedEnergy_kWh_year,
            simplePayback_years: packagePayback_years,
            npv_RUB: Number.isFinite(packageNpv_RUB) ? packageNpv_RUB : null,
            baseAnnualHeatingEnergy_kWh: beforeEnergy,
            estimatedAnnualHeatingEnergyBefore_kWh: beforeEnergy,
            estimatedAnnualHeatingEnergyAfter_kWh: afterEnergy,
            specificHeatConsumption_kWh_m2,
            specificHeatConsumptionAfter_kWh_m2,
            sp50EnergyNorm_kWh_m2,
            energyClassBefore,
            energyClassAfter,
            sp50EnergyComplies,
            paybackAtZeroGrowth_years,
            paybackAtHighGrowth_years,
            isApproximate: warnings.length > 0 || zones.some((zone) => zone.source === "derived"),
            hasAnyPayback: ranked.some((entry) => entry.status === "calculated" && entry.payback_years !== null),
            allMeasuresNonPayback: ranked.every((entry) => entry.status !== "calculated" || entry.payback_years === null),
        },
        zones,
        measureResults: ranked,
        recommendations: buildRecommendationSet(ranked),
        engineeringConclusion: "",
        exportData: {},
        warnings: dedupe(warnings),
    };
    result.engineeringConclusion = buildEngineeringConclusion(result);
    result.exportData = buildEconomicExportData(result);
    return result;
}
export function calculateSimplePayback_years(cost_RUB, annualSaving_RUB) {
    if (!Number.isFinite(cost_RUB) || !Number.isFinite(annualSaving_RUB) || annualSaving_RUB <= 0) {
        return null;
    }
    return cost_RUB / annualSaving_RUB;
}
export function calculateNpv_RUB(input) {
    const { cost_RUB, annualSaving_RUB, discountRate = 0.1, analysisPeriod_years, annualTariffGrowthPercent = 0, annualMaintenanceCost_RUB = 0, annualMaintenancePercentOfCost = 0, residualValuePercent = 0, } = input;
    if (!Number.isFinite(cost_RUB) || !Number.isFinite(annualSaving_RUB) || annualSaving_RUB < 0 || analysisPeriod_years <= 0) {
        return null;
    }
    const safeDiscountRate = Math.max(0, discountRate);
    const tariffGrowth = Math.max(-0.95, annualTariffGrowthPercent / 100);
    const maintenanceBase = Math.max(0, annualMaintenanceCost_RUB) + Math.max(0, annualMaintenancePercentOfCost / 100) * Math.max(0, cost_RUB);
    const residualValue = Math.max(0, residualValuePercent / 100) * Math.max(0, cost_RUB);
    let npv = -cost_RUB;
    for (let year = 1; year <= analysisPeriod_years; year += 1) {
        const savingForYear = annualSaving_RUB * (1 + tariffGrowth) ** (year - 1);
        const cashflow = savingForYear - maintenanceBase;
        npv += cashflow / (1 + safeDiscountRate) ** year;
    }
    npv += residualValue / (1 + safeDiscountRate) ** analysisPeriod_years;
    return npv;
}
export function calculateProfitabilityIndex(input) {
    if (!Number.isFinite(input.cost_RUB) || input.cost_RUB <= 0 || !Number.isFinite(input.npv_RUB)) {
        return null;
    }
    const pvBenefits = input.cost_RUB + (input.npv_RUB ?? 0);
    return pvBenefits / input.cost_RUB;
}
export function calculateDiscountedPayback_years(input) {
    const { cost_RUB, annualSaving_RUB, discountRate = 0.1, annualTariffGrowthPercent = 0, annualMaintenanceCost_RUB = 0, annualMaintenancePercentOfCost = 0, analysisPeriod_years, residualValuePercent = 0, } = input;
    if (!Number.isFinite(cost_RUB) || cost_RUB <= 0 || !Number.isFinite(annualSaving_RUB) || annualSaving_RUB <= 0 || analysisPeriod_years <= 0) {
        return null;
    }
    let cumulative = 0;
    const safeDiscountRate = Math.max(0, discountRate);
    const tariffGrowth = Math.max(-0.95, annualTariffGrowthPercent / 100);
    const maintenance = Math.max(0, annualMaintenanceCost_RUB) + Math.max(0, annualMaintenancePercentOfCost / 100) * cost_RUB;
    for (let year = 1; year <= analysisPeriod_years; year += 1) {
        const savingForYear = annualSaving_RUB * (1 + tariffGrowth) ** (year - 1);
        const cashflow = savingForYear - maintenance;
        cumulative += cashflow / (1 + safeDiscountRate) ** year;
        const residual = year === analysisPeriod_years ? (Math.max(0, residualValuePercent / 100) * cost_RUB) / (1 + safeDiscountRate) ** year : 0;
        cumulative += residual;
        if (cumulative >= cost_RUB) {
            return year;
        }
    }
    return null;
}
export function calculateRetrofitCost(area_m2, measure, defaults) {
    const def = defaults.measures[measure.defaultsKey];
    const regionalFactor = defaults.regionalCostFactor || 1;
    if (def.totalCostRub) {
        return midpoint(def.totalCostRub) * regionalFactor;
    }
    if (def.totalCostRubM2) {
        return Math.max(0, area_m2) * midpoint(def.totalCostRubM2) * regionalFactor;
    }
    const material = def.materialCostRubM2 ? midpoint(def.materialCostRubM2) : 0;
    const work = def.workCostRubM2 ? midpoint(def.workCostRubM2) : 0;
    return Math.max(0, area_m2) * (material + work) * regionalFactor;
}
export function estimateAnnualEnergySaving_kWh(input) {
    if (!Number.isFinite(input.deltaQ_W) || !Number.isFinite(input.heatingPeriodHours)) {
        return null;
    }
    return Math.max(0, (input.deltaQ_W * (input.heatingPeriodHours ?? 0)) / 1000);
}
function buildEconomicZones(report, warnings) {
    const deltaT = getDeltaT(report);
    const grouped = new Map();
    report.constructions.forEach((entry) => {
        if (!Number.isFinite(entry.areaM2) || (entry.areaM2 ?? 0) <= 0) {
            warnings.push(`Элемент «${entry.label}» пропущен в экономической оценке: площадь не задана или некорректна.`);
            return;
        }
        const zoneId = CONSTRUCTION_ZONE_MAP[entry.constructionType];
        if (!zoneId) {
            return;
        }
        const heatLoss_W = resolveConstructionHeatLoss_W(entry, deltaT);
        if (!Number.isFinite(heatLoss_W) || heatLoss_W <= 0) {
            warnings.push(`Для элемента «${entry.label}» не удалось получить положительные расчетные теплопотери.`);
            return;
        }
        const existing = grouped.get(zoneId);
        if (!existing) {
            grouped.set(zoneId, {
                id: zoneId,
                label: ZONE_LABELS[zoneId],
                constructionTypes: [entry.constructionType],
                areaM2: safe(entry.areaM2),
                currentResistance_m2C_W: weightedResistance(entry),
                heatLoss_W,
                heatLossShare: 0,
                source: heatLossFromContribution(entry, deltaT) ? "report" : "derived",
                dataQualityLevel: heatLossFromContribution(entry, deltaT) ? "calculated" : "estimated",
            });
            return;
        }
        const combinedArea = existing.areaM2 + safe(entry.areaM2);
        existing.currentResistance_m2C_W = combineResistance(existing, entry);
        existing.areaM2 = combinedArea;
        existing.heatLoss_W += heatLoss_W;
        if (!existing.constructionTypes.includes(entry.constructionType)) {
            existing.constructionTypes.push(entry.constructionType);
        }
        if (!heatLossFromContribution(entry, deltaT)) {
            existing.source = "derived";
            existing.dataQualityLevel = existing.dataQualityLevel === "calculated" ? "estimated" : existing.dataQualityLevel;
        }
    });
    const wallZone = grouped.get("walls");
    const windowZone = grouped.get("windows");
    if (wallZone && windowZone && wallZone.areaM2 > 0) {
        const windowShareByArea = windowZone.areaM2 / wallZone.areaM2;
        if (windowShareByArea > 0.75) {
            warnings.push("Площадь окон сопоставима с площадью наружных стен. Проверьте исходные площади, чтобы исключить двойной учет проемов в ограждениях.");
        }
    }
    const ventilationLoss_W = resolveVentilationHeatLoss_W(report, deltaT);
    if (ventilationLoss_W > 0) {
        grouped.set("ventilationInfiltration", {
            id: "ventilationInfiltration",
            label: ZONE_LABELS.ventilationInfiltration,
            constructionTypes: [],
            areaM2: 0,
            currentResistance_m2C_W: null,
            heatLoss_W: ventilationLoss_W,
            heatLossShare: 0,
            source: "report",
            dataQualityLevel: "calculated",
        });
    }
    else {
        warnings.push("Вентиляционные потери оценены ориентировочно: в отчете отсутствует устойчивая характеристика воздухообмена.");
    }
    const donorIds = ["walls", "windows", "roof", "floor", "doors"];
    const donorZones = donorIds.map((id) => grouped.get(id)).filter((zone) => Boolean(zone));
    const thermalBridgeLoss_W = resolveThermalBridgeLoss_W(report, donorZones);
    if (thermalBridgeLoss_W > 0 && donorZones.length) {
        const donorSum = donorZones.reduce((sum, zone) => sum + zone.heatLoss_W, 0);
        donorZones.forEach((zone) => {
            const share = donorSum > 0 ? zone.heatLoss_W / donorSum : 0;
            zone.heatLoss_W = Math.max(0, zone.heatLoss_W - thermalBridgeLoss_W * share);
        });
        grouped.set("thermalBridges", {
            id: "thermalBridges",
            label: ZONE_LABELS.thermalBridges,
            constructionTypes: donorZones.flatMap((zone) => zone.constructionTypes),
            areaM2: 0,
            currentResistance_m2C_W: null,
            heatLoss_W: thermalBridgeLoss_W,
            heatLossShare: 0,
            source: "derived",
            dataQualityLevel: "estimated",
            note: "Оценка по коэффициентам неоднородности и зонам риска",
        });
        warnings.push("Часть потерь по мостикам холода определена ориентировочно по коэффициентам теплотехнической неоднородности.");
    }
    grouped.set("heatingSystem", {
        id: "heatingSystem",
        label: ZONE_LABELS.heatingSystem,
        constructionTypes: [],
        areaM2: 0,
        currentResistance_m2C_W: null,
        heatLoss_W: 0,
        heatLossShare: 0,
        source: "derived",
        dataQualityLevel: "default",
        note: "Системные меры экономят энергию без изменения ограждающих конструкций",
    });
    const zones = Array.from(grouped.values()).filter((zone) => zone.heatLoss_W > 0 || zone.id === "heatingSystem");
    if (zones.some((zone) => zone.source === "derived")) {
        warnings.push("Часть экономической оценки является ориентировочной и использует упрощенные зависимости по площади, сопротивлению теплопередаче и расчетной разности температур.");
    }
    return zones;
}
function evaluateMeasure(report, scenario, measure, zones) {
    const zone = zones.find((entry) => entry.id === measure.zoneId);
    const defaults = scenario.defaults.measures[measure.defaultsKey];
    const warnings = [];
    if (!zone || !defaults) {
        return buildInsufficientResult(measure, warnings, zone?.label ?? ZONE_LABELS[measure.zoneId]);
    }
    const applicationArea_m2 = resolveApplicationArea(zone, measure, report);
    const reductionPercent = resolveReductionPercent(defaults.expectedHeatLossReductionPercent, scenario.mode);
    const systemSavingPercent = resolveReductionPercent(defaults.expectedEnergySavingPercent, scenario.mode);
    const heatingHours = resolveHeatingPeriodHours(report);
    const baseEnergy_kWh = report.energy.annualHeatingEnergy_kWh ?? null;
    const usesSystemSaving = measure.kind === "heating";
    if (applicationArea_m2 <= 0 && measure.application !== "building_complex") {
        warnings.push(`Для мероприятия «${defaults.name}» отсутствует корректная площадь применения.`);
        return buildInsufficientResult(measure, warnings, zone.label);
    }
    const heatLossBefore_W = usesSystemSaving ? zone.heatLoss_W : Math.max(0, zone.heatLoss_W);
    const heatLossReduction_W = usesSystemSaving
        ? 0
        : Math.max(0, (heatLossBefore_W * reductionPercent) / 100);
    const savedEnergy_kWh_year = usesSystemSaving
        ? Math.max(0, ((baseEnergy_kWh ?? 0) * systemSavingPercent) / 100)
        : estimateAnnualEnergySaving_kWh({ deltaQ_W: heatLossReduction_W, heatingPeriodHours: heatingHours });
    if (!Number.isFinite(savedEnergy_kWh_year)) {
        warnings.push(`Для мероприятия «${defaults.name}» недостаточно данных по отопительному периоду.`);
        return buildInsufficientResult(measure, warnings, zone.label);
    }
    if ((savedEnergy_kWh_year ?? 0) <= 0) {
        warnings.push(`Для мероприятия «${defaults.name}» расчетная годовая экономия равна нулю.`);
    }
    const totalCost_RUB = calculateRetrofitCost(applicationArea_m2, measure, {
        ...scenario.defaults,
        regionalCostFactor: scenario.regionalCostFactor,
    });
    if (!Number.isFinite(totalCost_RUB) || totalCost_RUB <= 0) {
        warnings.push(`Для мероприятия «${defaults.name}» не удалось получить корректную стоимость.`);
    }
    const { materialCost_RUB, workCost_RUB } = splitCosts(applicationArea_m2, defaults, scenario.regionalCostFactor, totalCost_RUB);
    const annualSaving_RUB = calculateAnnualMoneySaving(savedEnergy_kWh_year ?? 0, scenario);
    const contractPenalty_RUB = calculateContractPenalty(annualSaving_RUB, savedEnergy_kWh_year ?? 0, baseEnergy_kWh, scenario);
    const effectiveAnnualSaving_RUB = Math.max(0, annualSaving_RUB - contractPenalty_RUB);
    // Остаточная стоимость: автоматически из срока службы мероприятия
    const residualValuePercent = resolveResidualValuePercent(defaults.lifetimeYears, scenario.analysisPeriod_years);
    const payback_years = calculateSimplePayback_years(totalCost_RUB, effectiveAnnualSaving_RUB);
    const npv_RUB = calculateNpv_RUB({
        cost_RUB: totalCost_RUB,
        annualSaving_RUB: effectiveAnnualSaving_RUB,
        discountRate: scenario.discountRate,
        analysisPeriod_years: scenario.analysisPeriod_years,
        annualTariffGrowthPercent: scenario.annualTariffGrowthPercent,
        annualMaintenanceCost_RUB: scenario.annualMaintenanceCost_RUB,
        annualMaintenancePercentOfCost: scenario.annualMaintenancePercentOfCost,
        residualValuePercent,
    });
    const profitabilityIndex = calculateProfitabilityIndex({ cost_RUB: totalCost_RUB, npv_RUB });
    const discountedPayback_years = calculateDiscountedPayback_years({
        cost_RUB: totalCost_RUB,
        annualSaving_RUB: effectiveAnnualSaving_RUB,
        discountRate: scenario.discountRate,
        annualTariffGrowthPercent: scenario.annualTariffGrowthPercent,
        annualMaintenanceCost_RUB: scenario.annualMaintenanceCost_RUB,
        annualMaintenancePercentOfCost: scenario.annualMaintenancePercentOfCost,
        analysisPeriod_years: scenario.analysisPeriod_years,
        residualValuePercent,
    });
    const savedCO2_tCO2_year = calculateCO2Saving(savedEnergy_kWh_year ?? 0, scenario);
    const comfortScore = mapComfortScore(defaults.comfortEffect);
    const riskScore = mapRiskScore(defaults.riskReduction);
    const paybackClass = classifyPayback(payback_years, annualSaving_RUB);
    const economicallyPositive = (npv_RUB ?? Number.NEGATIVE_INFINITY) > 0;
    const comfortJustified = !economicallyPositive && (comfortScore >= 0.85 || riskScore >= 0.85);
    return {
        measureId: measure.id,
        measureName: defaults.name,
        zoneId: zone.id,
        zoneLabel: zone.label,
        area_m2: applicationArea_m2,
        materialCost_RUB,
        workCost_RUB,
        totalCost_RUB,
        cost_RUB: totalCost_RUB,
        heatLossBefore_W,
        heatLossReduction_W,
        heatLossReductionPercent: usesSystemSaving ? systemSavingPercent : reductionPercent,
        heatLossShare: zone.heatLossShare,
        savedEnergy_kWh_year: savedEnergy_kWh_year ?? 0,
        savedEnergy_Gcal_year: (savedEnergy_kWh_year ?? 0) / KWH_PER_GCAL,
        annualSaving_RUB,
        contractPenalty_RUB,
        effectiveAnnualSaving_RUB,
        savedCO2_tCO2_year,
        payback_years,
        paybackClass,
        discountedPayback_years,
        npv_RUB,
        profitabilityIndex,
        economicallyPositive,
        comfortJustified,
        priorityScore: 0,
        priorityScorePercent: 0,
        priorityLevel: "низкий",
        complexity: defaults.complexity,
        comfortEffect: defaults.comfortEffect,
        comfortScore,
        riskReduction: defaults.riskReduction ?? "ограниченное снижение эксплуатационных рисков",
        riskScore,
        implementationScope: describeScope(measure, zone, applicationArea_m2),
        recommendation: buildMeasureRecommendation(defaults.name, zone.label, annualSaving_RUB, payback_years),
        priorityReasons: [],
        scenarioExplanation: "",
        isRecommended: false,
        dataQualityLevel: zone.dataQualityLevel,
        scoreBreakdown: emptyScoreBreakdown(),
        status: "calculated",
        warnings: dedupe(warnings),
    };
}
function normalizeScores(results, mode) {
    const energyValues = results.map((entry) => entry.savedEnergy_kWh_year);
    const annualSavingValues = results.map((entry) => entry.annualSaving_RUB);
    const paybackValues = results.map((entry) => entry.payback_years ?? Number.POSITIVE_INFINITY).filter(Number.isFinite);
    const shareValues = results.map((entry) => entry.heatLossShare);
    const costValues = results.map((entry) => entry.totalCost_RUB);
    const npvValues = results.map((entry) => entry.npv_RUB ?? Number.NEGATIVE_INFINITY).filter(Number.isFinite);
    const complexityValues = results.map((entry) => complexityToScore(entry.complexity));
    return results.map((entry) => {
        const normalizedEnergySaving = normalizeDirect(entry.savedEnergy_kWh_year, energyValues);
        const normalizedAnnualSaving = normalizeDirect(entry.annualSaving_RUB, annualSavingValues);
        const normalizedPayback = normalizeInverse(entry.payback_years, paybackValues);
        const normalizedHeatLossShare = normalizeDirect(entry.heatLossShare, shareValues);
        const normalizedCost = normalizeInverse(entry.totalCost_RUB, costValues);
        const normalizedNpv = normalizeDirect(entry.npv_RUB ?? 0, npvValues);
        const normalizedComplexity = normalizeDirect(complexityToScore(entry.complexity), complexityValues);
        const scenarioScore = scenarioModeAdjustment(entry, { normalizedCost, normalizedEnergySaving, normalizedAnnualSaving, normalizedPayback, normalizedNpv }, mode);
        const rawScore = 0.18 * normalizedHeatLossShare +
            0.2 * normalizedEnergySaving +
            0.14 * normalizedAnnualSaving +
            0.16 * normalizedPayback +
            0.1 * normalizedNpv +
            0.08 * entry.comfortScore +
            0.08 * entry.riskScore +
            0.06 * normalizedComplexity +
            scenarioScore;
        const normalizedScore = clamp(rawScore, 0, 1);
        const scorePercent = Math.round(normalizedScore * 1000) / 10;
        const priorityReasons = buildPriorityReasons(entry, {
            normalizedHeatLossShare,
            normalizedEnergySaving,
            normalizedAnnualSaving,
            normalizedPayback,
            normalizedCost,
            normalizedNpv,
            normalizedComplexity,
        }, mode);
        return {
            ...entry,
            priorityScore: scorePercent,
            priorityScorePercent: scorePercent,
            priorityLevel: resolvePriorityLevel(scorePercent),
            scoreBreakdown: {
                energyScore: normalizedEnergySaving,
                moneySavingScore: normalizedAnnualSaving,
                paybackScore: normalizedPayback,
                npvScore: normalizedNpv,
                heatLossShareScore: normalizedHeatLossShare,
                comfortScore: entry.comfortScore,
                riskScore: entry.riskScore,
                complexityScore: normalizedComplexity,
                budgetScore: normalizedCost,
            },
            priorityReasons,
            scenarioExplanation: buildScenarioExplanation(mode, entry, priorityReasons),
        };
    });
}
function scenarioModeAdjustment(entry, normalized, mode) {
    if (mode === "fast_payback" && entry.payback_years === null) {
        return -0.2;
    }
    switch (mode) {
        case "minimum_budget":
            return 0.12 * normalized.normalizedCost + 0.04 * normalized.normalizedPayback;
        case "maximum_saving":
            return 0.08 * normalized.normalizedEnergySaving + 0.08 * normalized.normalizedAnnualSaving + 0.04 * normalized.normalizedNpv;
        case "fast_payback":
            return 0.14 * normalized.normalizedPayback + 0.02 * normalized.normalizedCost;
        default:
            return 0.04 * normalized.normalizedNpv + 0.04 * entry.riskScore + 0.04 * entry.comfortScore;
    }
}
function buildRecommendedPackage(results) {
    const taken = new Set();
    const packageMeasures = [];
    results.forEach((entry) => {
        if (entry.status !== "calculated") {
            return;
        }
        if (entry.zoneId !== "heatingSystem" && taken.has(entry.zoneId)) {
            return;
        }
        if (entry.payback_years !== null && entry.payback_years > 25 && entry.priorityScore < 45) {
            return;
        }
        packageMeasures.push(entry);
        taken.add(entry.zoneId);
    });
    return packageMeasures.slice(0, 6);
}
function buildRecommendationSet(results) {
    const calculated = results.filter((entry) => entry.status === "calculated");
    const cheapest = calculated.slice().sort((left, right) => left.totalCost_RUB - right.totalCost_RUB)[0] ?? null;
    const fastest = calculated
        .filter((entry) => entry.payback_years !== null)
        .sort((left, right) => (left.payback_years ?? Number.POSITIVE_INFINITY) - (right.payback_years ?? Number.POSITIVE_INFINITY))[0] ?? null;
    const maxEffect = calculated.slice().sort((left, right) => right.savedEnergy_kWh_year - left.savedEnergy_kWh_year)[0] ?? null;
    const first = calculated[0] ?? null;
    const defer = calculated
        .slice()
        .filter((entry) => (entry.payback_years ?? Number.POSITIVE_INFINITY) > 20 || entry.totalCost_RUB > 1_500_000)
        .sort((left, right) => (right.payback_years ?? 0) - (left.payback_years ?? 0))[0] ?? null;
    const firstPriority = first ? `${first.measureName} для зоны «${first.zoneLabel}».` : null;
    const maximumEffect = maxEffect ? `${maxEffect.measureName}: максимальная ожидаемая экономия ${formatRub(maxEffect.annualSaving_RUB)} в год.` : null;
    const cheapestText = cheapest ? `${cheapest.measureName}: минимальные вложения около ${formatRub(cheapest.totalCost_RUB)}.` : null;
    const fastestPayback = fastest ? `${fastest.measureName}: окупаемость около ${formatYears(fastest.payback_years)}.` : null;
    const deferText = defer ? `${defer.measureName}: высокие капитальные затраты или длительная окупаемость.` : null;
    const rows = [firstPriority, maximumEffect, cheapestText, fastestPayback, deferText].filter(Boolean);
    return Object.assign(rows, {
        firstPriority,
        leaderMeasure: first?.measureName ?? null,
        leaderReason: first?.scenarioExplanation ?? null,
        alternativeMeasure: (maxEffect?.measureId !== first?.measureId ? maxEffect?.measureName : cheapest?.measureName) ?? null,
        notRecommendedMeasures: calculated
            .filter((entry) => !entry.economicallyPositive && !entry.comfortJustified)
            .slice(-3)
            .map((entry) => entry.measureName),
        explanationText: first?.scenarioExplanation ?? null,
        maximumEffect,
        cheapest: cheapestText,
        fastestPayback,
        defer: deferText,
        scenarioLeaderReason: first?.scenarioExplanation ?? null,
    });
}
/**
 * Класс энергоэффективности по SP50.13330.2022 (таблица 15).
 * Отклонение = (фактический удельный расход − нормативный) / нормативный × 100 %.
 * Отрицательное отклонение означает, что здание экономит больше нормы.
 */
function classifyEnergyClass(qActual_kWh_m2, qNorm_kWh_m2) {
    if (qNorm_kWh_m2 <= 0)
        return "—";
    const deviation = ((qActual_kWh_m2 - qNorm_kWh_m2) / qNorm_kWh_m2) * 100;
    if (deviation < -60)
        return "А++";
    if (deviation < -45)
        return "А+";
    if (deviation < -30)
        return "А";
    if (deviation < -10)
        return "В";
    if (deviation < 5)
        return "С";
    if (deviation < 25)
        return "D";
    if (deviation < 50)
        return "E";
    if (deviation < 75)
        return "F";
    return "G";
}
function buildEngineeringConclusion(result) {
    const mainZoneSharePercent = (result.summary.mainLossShare ?? 0) * 100;
    const calculated = result.measureResults.filter((entry) => entry.status === "calculated");
    const best = calculated[0] ?? null;
    const cheapest = calculated.slice().sort((left, right) => left.totalCost_RUB - right.totalCost_RUB)[0] ?? null;
    const strongestEffect = calculated.slice().sort((left, right) => right.savedEnergy_kWh_year - left.savedEnergy_kWh_year)[0] ?? null;
    const { energyClassBefore, energyClassAfter, specificHeatConsumption_kWh_m2, sp50EnergyNorm_kWh_m2 } = result.summary;
    const energyClassSentence = energyClassBefore
        ? ` Текущий класс энергоэффективности здания — ${energyClassBefore}${specificHeatConsumption_kWh_m2 != null ? ` (${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(specificHeatConsumption_kWh_m2)} кВт·ч/(м²·год)` + (sp50EnergyNorm_kWh_m2 != null ? `, норма ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(sp50EnergyNorm_kWh_m2)}` : "") + ")" : ""}.${energyClassAfter && energyClassAfter !== energyClassBefore ? ` После реализации пакета ожидается переход в класс ${energyClassAfter}.` : ""}`
        : "";
    const prefix = result.summary.mainLossZone
        ? `Наибольшая доля теплопотерь приходится на ${result.summary.mainLossZone.toLowerCase()} — ${mainZoneSharePercent.toFixed(0)}%.${energyClassSentence}`
        : `Наиболее проблемная зона теплопотерь не определена из-за неполных данных.${energyClassSentence}`;
    const bestSentence = best
        ? ` В сценарии ${translateScenarioMode(result.scenario.mode)} приоритет получает ${best.measureName.toLowerCase()}, поскольку ${best.priorityReasons.join(", ")}. Ориентировочная стоимость составляет ${formatRub(best.totalCost_RUB)} ₽, ожидаемая экономия — ${formatRub(best.annualSaving_RUB)} ₽/год, срок окупаемости — ${formatYears(best.payback_years)}.`
        : "";
    const cheapSentence = cheapest
        ? ` При ограниченном бюджете можно начать с мероприятия «${cheapest.measureName}»: оно требует меньших вложений и сохраняет практический эффект.`
        : "";
    const maxEffectSentence = strongestEffect && strongestEffect.measureId !== best?.measureId
        ? ` Если цель — максимальное снижение теплопотерь и расходов, дополнительно стоит рассмотреть «${strongestEffect.measureName}».`
        : "";
    const npvSentence = best && best.npv_RUB !== null && best.npv_RUB < 0
        ? " По NPV мероприятие окупается слабо, но остается полезным с точки зрения комфорта и снижения эксплуатационных рисков."
        : "";
    const co2 = result.summary.packageSavedCO2_tCO2_year;
    const co2Sentence = co2 !== null && co2 > 0
        ? ` Реализация пакета мероприятий позволяет снизить выбросы CO₂ ориентировочно на ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(co2)} т CO₂/год.`
        : "";
    const warningSentence = " Результат является предварительной технико-экономической оценкой при заданных тарифах и текущих исходных данных; фактическая стоимость зависит от региона, состояния здания, выбранных материалов, подрядчика и действующих тарифов.";
    return `${prefix}${bestSentence}${cheapSentence}${maxEffectSentence}${npvSentence}${co2Sentence}${warningSentence}`;
}
function buildEconomicExportData(result) {
    return {
        calculatedAt: new Date().toISOString(),
        region: result.scenario.region,
        tariffs: {
            heatingEnergySource: result.scenario.heatingEnergySource,
            heatTariffRubPerGcal: result.scenario.heatTariffRubPerGcal,
            electricityTariffRubPerKwh: result.scenario.electricityTariffRubPerKwh,
            annualTariffGrowthPercent: result.scenario.annualTariffGrowthPercent ?? 0,
        },
        scenario: {
            id: result.scenario.id,
            name: result.scenario.name,
            mode: result.scenario.mode,
            analysisPeriod_years: result.scenario.analysisPeriod_years,
            discountRatePercent: (result.scenario.discountRate ?? 0) * 100,
        },
        totalHeatLoss_W: result.summary.totalHeatLoss_W,
        totalHeatLoss_kW: result.summary.totalHeatLoss_kW,
        zones: result.zones,
        measures: result.measureResults,
        recommendedMeasure: result.measureResults.find((entry) => entry.isRecommended)?.measureName ?? null,
        summary: result.summary,
        warnings: result.warnings,
        engineeringConclusion: result.engineeringConclusion,
    };
}
function resolveHeatingPeriodHours(report) {
    // ГСОП / ΔT_design × 24 — «эквивалентные часы полной нагрузки».
    // Это правильный способ перевести мощностную экономию (Вт при расчётной ΔT)
    // в годовую энергию: E = ΔQ_W / ΔT × ГСОП × 24 / 1000.
    // Использование дней × 24 (полная длительность сезона) систематически завышает
    // экономию, так как ΔQ рассчитан при максимальной ΔT, а не средней.
    const gsop = report.sourceData.gsop;
    const deltaT = getDeltaT(report);
    if (typeof gsop === "number" && Number.isFinite(gsop) && typeof deltaT === "number" && Number.isFinite(deltaT) && deltaT > 0) {
        return (gsop / deltaT) * HOURS_PER_DAY;
    }
    // Fallback: длительность сезона без корректировки на среднюю ΔT.
    // Даёт завышенную оценку — показывается предупреждение в вызывающем коде.
    const days = report.sourceData.heatingPeriodDurationDays;
    if (Number.isFinite(days)) {
        return (days ?? 0) * HOURS_PER_DAY;
    }
    return null;
}
function resolveConstructionHeatLoss_W(entry, deltaT) {
    const fromContribution = heatLossFromContribution(entry, deltaT);
    if (fromContribution) {
        return fromContribution;
    }
    if (!Number.isFinite(deltaT) || !Number.isFinite(entry.areaM2)) {
        return 0;
    }
    const resistance = entry.reducedResistance_m2K_W ?? entry.actualResistance_m2K_W;
    if (!Number.isFinite(resistance) || (resistance ?? 0) <= 0) {
        return 0;
    }
    return ((entry.areaM2 ?? 0) * (deltaT ?? 0)) / (resistance ?? 1);
}
function heatLossFromContribution(entry, deltaT) {
    if (!Number.isFinite(entry.contribution_W_K) || !Number.isFinite(deltaT)) {
        return null;
    }
    return Math.max(0, (entry.contribution_W_K ?? 0) * (deltaT ?? 0));
}
function resolveVentilationHeatLoss_W(report, deltaT) {
    const ventilationCharacteristic = report.energy.ventilationCharacteristic_W_m3K;
    const volume = report.sourceData.heatedVolumeM3;
    if (Number.isFinite(ventilationCharacteristic) && Number.isFinite(volume) && Number.isFinite(deltaT)) {
        return Math.max(0, (ventilationCharacteristic ?? 0) * (volume ?? 0) * (deltaT ?? 0));
    }
    const airExchange = report.energy.averageAirExchange_1_h;
    if (Number.isFinite(airExchange) && Number.isFinite(volume) && Number.isFinite(deltaT)) {
        const density = report.energy.averageAirDensity_kg_m3 ?? 1.2;
        const cp = 0.28;
        return Math.max(0, (airExchange ?? 0) * (volume ?? 0) * density * cp * (deltaT ?? 0));
    }
    return 0;
}
function resolveThermalBridgeLoss_W(report, donorZones) {
    if (!donorZones.length) {
        return 0;
    }
    const related = report.constructions.filter((entry) => donorZones.some((zone) => zone.constructionTypes.includes(entry.constructionType)));
    const weightedDeficit = related.reduce((sum, entry) => {
        const area = safe(entry.areaM2);
        const deficit = Number.isFinite(entry.homogeneityCoefficient) ? Math.max(0, 1 - (entry.homogeneityCoefficient ?? 1)) : 0;
        return sum + area * deficit;
    }, 0);
    const areaSum = related.reduce((sum, entry) => sum + safe(entry.areaM2), 0);
    const riskCount = related.reduce((sum, entry) => sum + entry.riskZones.length, 0);
    if (areaSum <= 0 || riskCount <= 0) {
        return 0;
    }
    const avgDeficit = weightedDeficit / areaSum;
    const factor = clamp(avgDeficit * 0.6 + 0.03, 0.03, 0.12);
    const donorLoss = donorZones.reduce((sum, zone) => sum + zone.heatLoss_W, 0);
    return donorLoss * factor;
}
function resolveApplicationArea(zone, measure, report) {
    switch (measure.application) {
        case "all_zone_area":
            return Math.max(0, zone.areaM2);
        case "building_complex":
            return Math.max(0, report.sourceData.heatedAreaM2 ?? zone.areaM2 ?? 0);
        default:
            return Math.max(0, zone.areaM2);
    }
}
function resolveReductionPercent(range, mode) {
    if (!range) {
        return 0;
    }
    const [min, max] = range;
    switch (mode) {
        case "minimum_budget":
            return min;
        case "maximum_saving":
            return max;
        case "fast_payback":
            return min + (max - min) * 0.55;
        default:
            return midpoint(range);
    }
}
function calculateAnnualMoneySaving(savedEnergy_kWh_year, scenario) {
    const saved = Math.max(0, savedEnergy_kWh_year);
    if (scenario.heatingEnergySource === "electricity") {
        return saved * Math.max(0, scenario.electricityTariffRubPerKwh);
    }
    if (scenario.heatingEnergySource === "gas") {
        const gasTariffM3 = scenario.gasTariffRubPerM3 ?? 0;
        if (gasTariffM3 <= 0) {
            return 0;
        }
        return saved * gasM3TariffToKwh(gasTariffM3);
    }
    return (saved / KWH_PER_GCAL) * Math.max(0, scenario.heatTariffRubPerGcal);
}
/**
 * Рассчитывает годовой штраф за недобор по договору.
 *
 * Для газа: штраф начисляется только тогда, когда экономия снижает потребление
 * ниже договорного минимума (gasMinimumOfftakePercent). Если экономия невелика
 * и здание остаётся выше порога — штрафа нет. Штраф = стоимость объёма ниже
 * порога × gasUnderconsumptionPenaltyPercent.
 *
 * Для ЦТ без прибора учёта: минимальный платёж (доля счёта, не зависящая от
 * фактического потребления) применяется равномерно ко всей экономии.
 */
function calculateContractPenalty(annualSaving_RUB, savedEnergy_kWh_year, baseEnergy_kWh, scenario) {
    if (annualSaving_RUB <= 0)
        return 0;
    if (scenario.heatingEnergySource === "gas") {
        const penaltyPct = scenario.gasUnderconsumptionPenaltyPercent ?? 0;
        if (penaltyPct <= 0)
            return 0;
        const minOfftakeFraction = clamp((scenario.gasMinimumOfftakePercent ?? 70) / 100, 0, 1);
        const gasTariffM3 = scenario.gasTariffRubPerM3 ?? 0;
        if (baseEnergy_kWh && baseEnergy_kWh > 0 && gasTariffM3 > 0) {
            const savingFraction = clamp(savedEnergy_kWh_year / baseEnergy_kWh, 0, 1);
            const residualFraction = 1 - savingFraction;
            if (residualFraction >= minOfftakeFraction) {
                // Потребление выше договорного минимума — штрафа нет
                return 0;
            }
            // Часть экономии, которая «уводит» потребление ниже порога
            const penalizedEnergyFraction = minOfftakeFraction - residualFraction;
            const penalizedEnergy_kWh = baseEnergy_kWh * penalizedEnergyFraction;
            const penalizedValue_RUB = penalizedEnergy_kWh * gasM3TariffToKwh(gasTariffM3);
            return Math.max(0, penalizedValue_RUB * (penaltyPct / 100));
        }
        // Fallback без данных о базовом потреблении: штраф от всей экономии
        return annualSaving_RUB * clamp(penaltyPct / 100, 0, 1);
    }
    if (scenario.heatingEnergySource === "heat") {
        const minFraction = scenario.heatContractMinimumPaymentFraction ?? 0;
        return annualSaving_RUB * clamp(minFraction, 0, 1);
    }
    return 0;
}
function calculateCO2Saving(savedEnergy_kWh_year, scenario) {
    const factor = scenario.co2EmissionFactor_kgPerKWh ?? DEFAULT_CO2_FACTORS[scenario.heatingEnergySource] ?? null;
    if (!factor || !Number.isFinite(savedEnergy_kWh_year) || savedEnergy_kWh_year <= 0)
        return null;
    return Math.max(0, (savedEnergy_kWh_year * factor) / 1000); // кг → тонны
}
/**
 * Остаточная стоимость мероприятия, % от CAPEX.
 * Если срок службы длиннее горизонта анализа — возвращает пропорцию оставшегося ресурса.
 * Меры с истёкшим ресурсом возвращают 0.
 */
function resolveResidualValuePercent(lifetimeYears, analysisPeriod_years) {
    if (!lifetimeYears || lifetimeYears <= analysisPeriod_years)
        return 0;
    const remainingFraction = (lifetimeYears - analysisPeriod_years) / lifetimeYears;
    return Math.round(remainingFraction * 100);
}
function splitCosts(area_m2, defaults, regionalFactor, totalCost_RUB) {
    if (defaults.materialCostRubM2 || defaults.workCostRubM2) {
        const materialCost_RUB = area_m2 * (defaults.materialCostRubM2 ? midpoint(defaults.materialCostRubM2) : 0) * regionalFactor;
        const workCost_RUB = area_m2 * (defaults.workCostRubM2 ? midpoint(defaults.workCostRubM2) : 0) * regionalFactor;
        return { materialCost_RUB, workCost_RUB };
    }
    return {
        materialCost_RUB: totalCost_RUB * 0.45,
        workCost_RUB: totalCost_RUB * 0.55,
    };
}
function compareMeasureResults(left, right) {
    if (left.status !== right.status) {
        return left.status === "calculated" ? -1 : 1;
    }
    if (Math.abs(right.priorityScore - left.priorityScore) > 1e-9) {
        return right.priorityScore - left.priorityScore;
    }
    const leftPayback = left.payback_years ?? Number.POSITIVE_INFINITY;
    const rightPayback = right.payback_years ?? Number.POSITIVE_INFINITY;
    if (Math.abs(leftPayback - rightPayback) > 1e-9) {
        return leftPayback - rightPayback;
    }
    return right.savedEnergy_kWh_year - left.savedEnergy_kWh_year;
}
function buildInsufficientResult(measure, warnings, zoneLabel) {
    const defaults = economicDefaults.measures[measure.defaultsKey];
    return {
        measureId: measure.id,
        measureName: defaults?.name ?? measure.id,
        zoneId: measure.zoneId,
        zoneLabel,
        area_m2: 0,
        materialCost_RUB: 0,
        workCost_RUB: 0,
        totalCost_RUB: 0,
        cost_RUB: 0,
        heatLossBefore_W: 0,
        heatLossReduction_W: 0,
        heatLossReductionPercent: 0,
        heatLossShare: 0,
        savedEnergy_kWh_year: 0,
        savedEnergy_Gcal_year: 0,
        annualSaving_RUB: 0,
        contractPenalty_RUB: 0,
        effectiveAnnualSaving_RUB: 0,
        savedCO2_tCO2_year: null,
        payback_years: null,
        paybackClass: "не окупается по прямой экономии",
        discountedPayback_years: null,
        npv_RUB: null,
        profitabilityIndex: null,
        economicallyPositive: false,
        comfortJustified: false,
        priorityScore: 0,
        priorityScorePercent: 0,
        priorityLevel: "низкий",
        complexity: defaults?.complexity ?? "средняя",
        comfortEffect: defaults?.comfortEffect ?? "средний",
        comfortScore: 0.5,
        riskReduction: defaults?.riskReduction ?? "недостаточно данных",
        riskScore: 0.4,
        implementationScope: "Недостаточно данных для оценки",
        recommendation: `Для мероприятия «${defaults?.name ?? measure.id}» недостаточно данных.`,
        priorityReasons: ["недостаточно исходных данных"],
        scenarioExplanation: "Мероприятие не ранжировано из-за неполных данных.",
        isRecommended: false,
        dataQualityLevel: "default",
        scoreBreakdown: emptyScoreBreakdown(),
        status: "insufficient_data",
        warnings: dedupe(warnings),
    };
}
function combineResistance(existing, entry) {
    const current = existing.currentResistance_m2C_W;
    const next = entry.reducedResistance_m2K_W ?? entry.actualResistance_m2K_W;
    if (!Number.isFinite(current) && !Number.isFinite(next)) {
        return null;
    }
    if (!Number.isFinite(current)) {
        return next ?? null;
    }
    if (!Number.isFinite(next)) {
        return current;
    }
    const totalArea = safe(existing.areaM2) + safe(entry.areaM2);
    if (totalArea <= 0) {
        return current;
    }
    return ((current ?? 0) * safe(existing.areaM2) + (next ?? 0) * safe(entry.areaM2)) / totalArea;
}
function weightedResistance(entry) {
    const resistance = entry.reducedResistance_m2K_W ?? entry.actualResistance_m2K_W;
    return Number.isFinite(resistance) ? resistance ?? null : null;
}
function getDeltaT(report) {
    const indoor = report.sourceData.indoorTemperatureC;
    const outdoor = report.sourceData.outdoorDesignTemperatureC;
    if (!Number.isFinite(indoor) || !Number.isFinite(outdoor)) {
        return null;
    }
    return (indoor ?? 0) - (outdoor ?? 0);
}
function mapBuildingType(category) {
    switch (category) {
        case "residential":
            return "apartment_building";
        case "educational":
        case "preschool":
            return "educational";
        case "administrative":
            return "office";
        default:
            return "public_building";
    }
}
function mapComfortScore(value) {
    if (value.includes("высок")) {
        return 0.95;
    }
    if (value.includes("средний/высокий")) {
        return 0.8;
    }
    if (value.includes("сред")) {
        return 0.65;
    }
    return 0.5;
}
function mapRiskScore(value) {
    if (!value) {
        return 0.4;
    }
    if (value.includes("плес")) {
        return 0.95;
    }
    if (value.includes("промерз")) {
        return 0.9;
    }
    if (value.includes("конденсат")) {
        return 0.8;
    }
    return 0.55;
}
function emptyScoreBreakdown() {
    return {
        energyScore: 0,
        moneySavingScore: 0,
        paybackScore: 0,
        npvScore: 0,
        heatLossShareScore: 0,
        comfortScore: 0,
        riskScore: 0,
        complexityScore: 0,
        budgetScore: 0,
    };
}
function complexityToScore(value) {
    switch (value) {
        case "низкая":
            return 1;
        case "средняя":
            return 0.72;
        case "средняя/высокая":
            return 0.48;
        case "высокая":
            return 0.24;
        default:
            return 0.5;
    }
}
function classifyPayback(payback_years, annualSaving_RUB) {
    if (!Number.isFinite(annualSaving_RUB) || annualSaving_RUB <= 0 || payback_years === null) {
        return "не окупается по прямой экономии";
    }
    if (payback_years <= 3) {
        return "быстрая";
    }
    if (payback_years <= 7) {
        return "средняя";
    }
    if (payback_years <= 15) {
        return "длительная";
    }
    return "низкая экономическая привлекательность";
}
function buildPriorityReasons(entry, normalized, mode) {
    const reasons = [];
    if (normalized.normalizedHeatLossShare >= 0.7) {
        reasons.push("высокая доля теплопотерь");
    }
    if (normalized.normalizedEnergySaving >= 0.7 || normalized.normalizedAnnualSaving >= 0.7) {
        reasons.push("существенная экономия энергии и затрат");
    }
    if (normalized.normalizedPayback >= 0.75) {
        reasons.push("короткий срок окупаемости");
    }
    if (normalized.normalizedCost >= 0.75) {
        reasons.push("низкая стоимость внедрения");
    }
    if (entry.comfortScore >= 0.85) {
        reasons.push("существенное влияние на комфорт");
    }
    if (entry.riskScore >= 0.85) {
        reasons.push("снижение риска промерзания, конденсата или плесени");
    }
    if (normalized.normalizedNpv >= 0.7) {
        reasons.push("положительный долгосрочный экономический эффект");
    }
    if (normalized.normalizedComplexity >= 0.75) {
        reasons.push("относительно простая реализация");
    }
    if (mode === "minimum_budget") {
        reasons.push("приоритет сценария минимального бюджета");
    }
    else if (mode === "maximum_saving") {
        reasons.push("приоритет сценария максимальной экономии");
    }
    else if (mode === "fast_payback") {
        reasons.push("приоритет сценария быстрой окупаемости");
    }
    else {
        reasons.push("сбалансированный эффект по экономике, рискам и комфорту");
    }
    return dedupe(reasons).slice(0, 4);
}
function buildScenarioExplanation(mode, _entry, reasons) {
    const reasonText = reasons.length ? reasons.join(", ") : "сбалансированный профиль мероприятия";
    switch (mode) {
        case "minimum_budget":
            return `В сценарии минимального бюджета мероприятие поднято выше за счет умеренной стоимости и приемлемого эффекта: ${reasonText}.`;
        case "maximum_saving":
            return `В сценарии максимальной экономии мероприятие выбрано из-за наибольшей ожидаемой экономии: ${reasonText}.`;
        case "fast_payback":
            return `В сценарии быстрой окупаемости мероприятие приоритетно, потому что быстрее возвращает вложения: ${reasonText}.`;
        default:
            return `В сценарии комплексной модернизации мероприятие лидирует, так как сочетает экономию, комфорт и снижение рисков: ${reasonText}.`;
    }
}
function resolvePriorityLevel(score) {
    if (score >= 80) {
        return "очень высокий";
    }
    if (score >= 65) {
        return "высокий";
    }
    if (score >= 45) {
        return "средний";
    }
    return "низкий";
}
function normalizeDirect(value, collection) {
    const min = Math.min(...collection);
    const max = Math.max(...collection);
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
        return 0;
    }
    if (Math.abs(max - min) < 1e-9) {
        return max > 0 ? 1 : 0;
    }
    return clamp((value - min) / (max - min), 0, 1);
}
function normalizeInverse(value, collection) {
    if (value === null || !collection.length) {
        return 0;
    }
    const min = Math.min(...collection);
    const max = Math.max(...collection);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return 0;
    }
    if (Math.abs(max - min) < 1e-9) {
        return max > 0 ? 1 : 0;
    }
    return clamp((max - value) / (max - min), 0, 1);
}
function midpoint([min, max]) {
    return min + (max - min) / 2;
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function safe(value) {
    return Number.isFinite(value) ? (value ?? 0) : 0;
}
function describeScope(measure, zone, area_m2) {
    if (measure.application === "building_complex") {
        return "Комплексно по зданию";
    }
    if (area_m2 > 0) {
        return `${zone.label}, ${area_m2.toFixed(0)} м²`;
    }
    return zone.label;
}
function buildMeasureRecommendation(name, zoneLabel, annualSaving_RUB, payback_years) {
    return `Для зоны «${zoneLabel}» мероприятие «${name}» даёт экономию ${formatRub(annualSaving_RUB)} руб./год и окупаемость ${formatYears(payback_years)}.`;
}
function translateScenarioMode(mode) {
    switch (mode) {
        case "minimum_budget":
            return "минимального бюджета";
        case "maximum_saving":
            return "максимальной экономии";
        case "fast_payback":
            return "быстрой окупаемости";
        default:
            return "комплексной модернизации";
    }
}
function formatRub(value) {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}
function formatYears(value) {
    if (!Number.isFinite(value)) {
        return "не определен";
    }
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value ?? 0)} года`;
}
function dedupe(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
