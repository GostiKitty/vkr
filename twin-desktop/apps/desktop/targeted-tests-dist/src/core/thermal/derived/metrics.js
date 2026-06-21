import { freeCoolingTemperatureAtTime, heatLossCoefficientTotal, specificHeatLoadByArea, specificHeatLoadByVolume, specificHeatLoadByVolumeAndDeltaT, thermalTimeConstantSeconds, } from "../formulas";
const SECONDS_PER_HOUR = 3600;
function metric(value, unit, source, contour, status, affectsMainSolver, assumptions = [], warnings = []) {
    return {
        value,
        unit,
        source,
        contour,
        status,
        affectsMainSolver,
        assumptions,
        warnings,
    };
}
function zoneOutdoorConductance(model, zoneId) {
    return model.outdoorLinks.reduce((sum, link) => (link.fromZoneId === zoneId ? sum + link.conductance_W_K : sum), 0);
}
function zoneAverageReferenceTemperature(zones) {
    if (!zones.length) {
        return null;
    }
    const weighted = zones.reduce((sum, zone) => {
        const area = Math.max(1, zone.peakSpecificLoad_W_m2 > 0 ? zone.heatingPowerW / zone.peakSpecificLoad_W_m2 : 1);
        return {
            temperature: sum.temperature + zone.temperatureC * area,
            weight: sum.weight + area,
        };
    }, { temperature: 0, weight: 0 });
    if (weighted.weight <= 0) {
        return null;
    }
    return weighted.temperature / weighted.weight;
}
function buildVentilationRecovery(options, buildingDiagnostics) {
    const recovery = Math.min(1, Math.max(0, options.heatRecoveryFactor ?? 0));
    // The RC solver already applies (1 − heatRecoveryFactor) to ventilationConductance_W_K,
    // so totalMechanicalVentilationLossW is the post-recovery (actual) value from the solver.
    const after = Number.isFinite(buildingDiagnostics.totalMechanicalVentilationLossW)
        ? buildingDiagnostics.totalMechanicalVentilationLossW
        : null;
    // Reconstruct the pre-recovery baseline so users see what losses would be without HRV.
    const before = recovery > 0 && recovery < 1 && after !== null
        ? after / (1 - recovery)
        : after;
    const saved = before !== null && after !== null ? before - after : null;
    const warnings = recovery > 0
        ? [
            "КПД рекуперации учтён в RC-solver через уменьшение conductance вентиляции; значение «до» рассчитано обратным ходом от фактических потерь solver.",
        ]
        : [];
    return {
        efficiency: metric(recovery, "доля", "user input", "derived-only", "derived-only", false),
        ventilationLossBeforeRecovery_W: metric(before, "Вт", "engineering-derived", "derived-only", "derived-only", false),
        ventilationLossAfterRecovery_W: metric(after, "Вт", "solver", "rc-runtime", "main-runtime", true, [], warnings),
        savedByRecovery_W: metric(saved, "Вт", "engineering-derived", "derived-only", "derived-only", false, [], warnings),
    };
}
function buildSpecificIndicators(model, building, zones) {
    const floorAreaM2 = Math.max(0, building.heatedFloorAreaM2);
    const volumeM3 = model.zones.reduce((sum, zone) => sum + Math.max(0, zone.volume_m3), 0);
    const avgIndoor = zoneAverageReferenceTemperature(zones);
    const deltaT = avgIndoor === null ? null : avgIndoor - building.referenceOutdoorC;
    const qArea = specificHeatLoadByArea(building.totalHeatingW, floorAreaM2);
    const qVolume = specificHeatLoadByVolume(building.totalHeatingW, volumeM3);
    const qVolumeDeltaT = deltaT === null ? null : specificHeatLoadByVolumeAndDeltaT(building.totalHeatingW, volumeM3, deltaT);
    const sharedWarnings = [
        ...(floorAreaM2 <= 0 ? ["Не удалось определить отапливаемую площадь модели."] : []),
        ...(volumeM3 <= 0 ? ["Не удалось определить отапливаемый объём модели."] : []),
    ];
    return {
        qArea_W_m2: metric(qArea, "Вт/м²", "solver", "derived-only", "derived-only", false, ["Используется реальная площадь пола зон RC-модели."], sharedWarnings),
        qVolume_W_m3: metric(qVolume, "Вт/м³", "solver", "derived-only", "derived-only", false, ["Используется реальный объём зон RC-модели."], sharedWarnings),
        qVolumeDeltaT_W_m3K: metric(qVolumeDeltaT, "Вт/(м³·К)", "solver", "derived-only", "derived-only", false, ["ΔT берётся по референсному срезу RC-диагностики."], sharedWarnings),
    };
}
function buildNormativeVentilation(model) {
    const providedFlowM3H = model.zones.reduce((sum, zone) => sum + Math.max(0, zone.ventilationACH) * Math.max(0, zone.volume_m3), 0);
    const warnings = [
        "Нормативный расход не пересчитывается автоматически в solver и требует явных нормативных исходных данных.",
    ];
    return {
        requiredFlowM3H: metric(null, "м³/ч", "user input", "normative-check", "normative-check", false, [], warnings),
        providedFlowM3H: metric(providedFlowM3H, "м³/ч", "solver", "derived-only", "derived-only", false),
        deficitFlowM3H: metric(null, "м³/ч", "engineering-derived", "derived-only", "derived-only", false, [], warnings),
        affectsSolverNow: false,
    };
}
function buildBalanceLines(building, ventilationRecovery) {
    return [
        {
            id: "transmission",
            label: "Трансмиссионные потери",
            valueW: building.totalOpaqueLossW + building.totalWindowLossW + building.totalDoorLossW,
            source: "solver",
            contour: "rc-runtime",
            affectsMainSolver: true,
            warnings: [],
        },
        {
            id: "infiltration",
            label: "Инфильтрация",
            valueW: building.totalInfiltrationLossW,
            source: "solver",
            contour: "rc-runtime",
            affectsMainSolver: true,
            warnings: [],
        },
        {
            id: "ventilation",
            label: "Механическая вентиляция",
            valueW: building.totalMechanicalVentilationLossW,
            source: "solver",
            contour: "rc-runtime",
            affectsMainSolver: true,
            warnings: [],
        },
        {
            id: "ventilation-after-recovery",
            label: "Вентиляция после рекуперации",
            valueW: ventilationRecovery.ventilationLossAfterRecovery_W.value,
            source: "engineering-derived",
            contour: "derived-only",
            affectsMainSolver: false,
            warnings: ventilationRecovery.ventilationLossAfterRecovery_W.warnings,
        },
        {
            id: "internal-gains",
            label: "Внутренние теплопоступления",
            valueW: building.totalInternalGainsW,
            source: "solver",
            contour: "rc-runtime",
            affectsMainSolver: true,
            warnings: [],
        },
        {
            id: "heating",
            label: "Требуемая мощность отопления",
            valueW: building.totalHeatingW,
            source: "solver",
            contour: "rc-runtime",
            affectsMainSolver: true,
            warnings: [],
        },
    ];
}
export function buildRcDerivedDiagnostics(input) {
    const { buildingModel, model, options, building, zones, hydronic = null } = input;
    const transmissionConductance = model.outdoorLinks.reduce((sum, link) => sum + Math.max(0, link.conductance_W_K), 0);
    const infiltrationConductance = model.zones.reduce((sum, zone) => sum + Math.max(0, zone.infiltrationConductance_W_K), 0);
    const ventilationConductance = model.zones.reduce((sum, zone) => sum + Math.max(0, zone.ventilationConductance_W_K), 0);
    const totalConductance = heatLossCoefficientTotal(transmissionConductance, infiltrationConductance, ventilationConductance);
    const totalCapacitance = model.zones.reduce((sum, zone) => sum + Math.max(0, zone.capacitance_J_K), 0);
    const buildingTauSeconds = thermalTimeConstantSeconds(totalCapacitance, totalConductance);
    const effectiveMassFactor = Math.max(1, options.engineering?.effectiveMassFactor ?? 1);
    const ventilationRecovery = buildVentilationRecovery(options, building);
    const freeCooling = buildingTauSeconds === null
        ? [1, 6, 12, 24].map((hours) => ({
            hours,
            temperatureC: metric(null, "°C", "engineering-derived", "derived-only", "derived-only", false, [], ["Не удалось определить тепловую постоянную времени τ."]),
        }))
        : [1, 6, 12, 24].map((hours) => ({
            hours,
            temperatureC: metric(freeCoolingTemperatureAtTime(zoneAverageReferenceTemperature(zones) ?? 20, building.referenceOutdoorC, hours * SECONDS_PER_HOUR, buildingTauSeconds), "°C", "engineering-derived", "derived-only", "derived-only", false, ["Свободное остывание без отопления не заменяет основную RC-симуляцию."]),
        }));
    return {
        transmissionHeatLossCoefficient_W_K: metric(transmissionConductance, "Вт/К", "solver", "derived-only", "derived-only", false, ["H_tr агрегирован по conductance внешних связей зональной RC-модели."]),
        infiltrationHeatLossCoefficient_W_K: metric(infiltrationConductance, "Вт/К", "solver", "derived-only", "derived-only", false, ["Инфильтрация показана отдельно, чтобы не задваивать её с механической вентиляцией."]),
        ventilationHeatLossCoefficient_W_K: metric(ventilationConductance, "Вт/К", "solver", "derived-only", "derived-only", false, ["H_ve агрегирован по effective conductance механической вентиляции зональной RC-модели с учётом рекуперации, если она задана."]),
        totalHeatLossCoefficient_W_K: metric(totalConductance, "Вт/К", "solver", "derived-only", "derived-only", false, ["H_total = H_tr + H_inf + H_ve,eff."]),
        buildingTauHours: metric(buildingTauSeconds === null ? null : buildingTauSeconds / SECONDS_PER_HOUR, "ч", "engineering-derived", "derived-only", "derived-only", false, [`effectiveMassFactor = ${effectiveMassFactor}`], totalConductance <= 0 ? ["Суммарный коэффициент теплопотерь H <= 0, τ не определена."] : []),
        zoneTauHours: model.zones.map((zone) => {
            const zoneConductance = heatLossCoefficientTotal(zoneOutdoorConductance(model, zone.id), Math.max(0, zone.infiltrationConductance_W_K), Math.max(0, zone.ventilationConductance_W_K));
            const tauSeconds = thermalTimeConstantSeconds(zone.capacitance_J_K, zoneConductance);
            return {
                zoneId: zone.id,
                zoneName: buildingModel.rooms.find((room) => room.id === zone.id)?.name ?? zone.name,
                tauHours: metric(tauSeconds === null ? null : tauSeconds / SECONDS_PER_HOUR, "ч", "engineering-derived", "derived-only", "derived-only", false, [`effectiveMassFactor = ${effectiveMassFactor}`]),
                capacitance_J_K: metric(zone.capacitance_J_K, "Дж/К", "solver", "rc-runtime", "main-runtime", true),
                heatLossCoefficient_W_K: metric(zoneConductance, "Вт/К", "solver", "derived-only", "derived-only", false),
            };
        }),
        freeCooling,
        specificIndicators: buildSpecificIndicators(model, building, zones),
        ventilationRecovery,
        normativeVentilation: buildNormativeVentilation(model),
        balanceLines: buildBalanceLines(building, ventilationRecovery),
        hydronic,
    };
}
