export const THERMAL_CHART_NOT_SET = "не задано";
const asFinite = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const asStringArray = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim().length > 0) : [];
const normalizeZoneName = (value) => (value ?? "").trim() || "Без названия";
const BUILDING_LOSS_LABELS = {
    opaque: "Непрозрачные ограждения",
    window: "Окна",
    door: "Двери",
    infiltration: "Инфильтрация",
    ventilation: "Механическая вентиляция",
};
export function buildKpiPayload(result) {
    const building = result.diagnostics?.building;
    return {
        peakLoadKW: asFinite(result.summary.peakLoadKW),
        totalEnergyKWh: asFinite(result.summary.totalEnergyKWh),
        discomfortHours: asFinite(result.summary.discomfortHours),
        totalHeatingW: asFinite(building?.totalHeatingW),
    };
}
export function buildBuildingLossSeries(result) {
    const building = result.diagnostics?.building;
    if (!building) {
        return [];
    }
    const rows = [
        { key: "opaque", label: BUILDING_LOSS_LABELS.opaque, valueW: asFinite(building.totalOpaqueLossW), sharePercent: null },
        { key: "window", label: BUILDING_LOSS_LABELS.window, valueW: asFinite(building.totalWindowLossW), sharePercent: null },
        { key: "door", label: BUILDING_LOSS_LABELS.door, valueW: asFinite(building.totalDoorLossW), sharePercent: null },
        {
            key: "infiltration",
            label: BUILDING_LOSS_LABELS.infiltration,
            valueW: asFinite(building.totalInfiltrationLossW),
            sharePercent: null,
        },
        {
            key: "ventilation",
            label: BUILDING_LOSS_LABELS.ventilation,
            valueW: asFinite(building.totalMechanicalVentilationLossW),
            sharePercent: null,
        },
    ];
    const present = rows.filter((row) => row.valueW !== null);
    const totalW = asFinite(building.totalLossW) ?? present.reduce((acc, row) => acc + (row.valueW ?? 0), 0);
    return present.map((row) => ({
        ...row,
        sharePercent: (row.key === "infiltration"
            ? asFinite(building.infiltrationShareOfTotalPct)
            : asFinite(building.lossSharePercent[row.key])) ??
            (totalW > 0 ? ((row.valueW ?? 0) / totalW) * 100 : null),
    }));
}
export function buildZoneSeries(result) {
    const zones = result.diagnostics?.zones ?? [];
    return zones
        .map((zone) => {
        const lossOpaqueW = asFinite(zone.lossOpaqueW);
        const lossWindowW = asFinite(zone.lossWindowW);
        const lossDoorW = asFinite(zone.lossDoorW);
        const lossInfiltrationW = asFinite(zone.lossInfiltrationW);
        const lossMechanicalVentilationW = asFinite(zone.lossMechanicalVentilationW);
        const airExchangeLossW = asFinite(zone.airExchangeLossW) ??
            (lossInfiltrationW ?? 0) +
                (lossMechanicalVentilationW ?? 0);
        const lossTotalW = asFinite(zone.totalLossW) ??
            (lossOpaqueW ?? 0) +
                (lossWindowW ?? 0) +
                (lossDoorW ?? 0) +
                airExchangeLossW;
        const infiltrationShareOfTotalPct = asFinite(zone.infiltrationShareOfTotalPct) ??
            (lossTotalW > 0 && lossInfiltrationW != null ? (lossInfiltrationW / lossTotalW) * 100 : null);
        const infiltrationShareOfAirExchangePct = asFinite(zone.infiltrationShareOfAirExchangePct) ??
            (airExchangeLossW > 0 && lossInfiltrationW != null ? (lossInfiltrationW / airExchangeLossW) * 100 : null);
        return {
            zoneId: zone.zoneId,
            zoneName: normalizeZoneName(zone.zoneName),
            temperatureC: asFinite(zone.temperatureC),
            heatingPowerW: asFinite(zone.heatingPowerW),
            lossOpaqueW,
            lossWindowW,
            lossDoorW,
            lossInfiltrationW,
            lossMechanicalVentilationW,
            airExchangeLossW,
            lossTotalW,
            infiltrationShareOfTotalPct,
            infiltrationShareOfAirExchangePct,
            lossShareWarnings: asStringArray(zone.lossShareWarnings),
            status: zone.status ?? null,
            statusNote: zone.statusNote?.trim() || null,
        };
    })
        .sort((left, right) => right.lossTotalW - left.lossTotalW);
}
export function build3DOverlayMap(zoneSeries) {
    return new Map(zoneSeries.map((zone) => [
        zone.zoneName.toLowerCase(),
        {
            temperatureC: zone.temperatureC,
            heatingPowerW: zone.heatingPowerW,
            lossTotalW: zone.lossTotalW,
            statusNote: zone.statusNote,
        },
    ]));
}
export function buildScenarioCompareSeries(items) {
    return items.map((item) => ({
        scenarioId: item.scenarioId,
        label: item.label,
        peakLoadKW: asFinite(item.result.summary.peakLoadKW),
        totalEnergyKWh: asFinite(item.result.summary.totalEnergyKWh),
        discomfortHours: asFinite(item.result.summary.discomfortHours),
    }));
}
export function buildScenarioHistoryCompareRows(items) {
    return items.map((item) => ({
        scenarioId: item.id,
        label: item.label,
        peakLoadKW: asFinite(item.peakLoadKW),
        totalEnergyKWh: asFinite(item.totalEnergyKWh),
        discomfortHours: asFinite(item.discomfortHours),
    }));
}
export function hasBuildingDiagnostics(result) {
    return buildBuildingLossSeries(result).length > 0;
}
export function hasZoneDiagnostics(result) {
    return buildZoneSeries(result).length > 0;
}
export function buildThermalResultCapabilities(result, options) {
    const building = result?.diagnostics?.building;
    const hasVent = building != null &&
        Number.isFinite(building.totalMechanicalVentilationLossW) &&
        building.totalMechanicalVentilationLossW > 0;
    return {
        mechanicalVentilation: hasVent,
        perSurfaceEnvelope: false,
        monteCarloInResult: false,
        climateBaseLabel: options?.climateCityLabel
            ? `СП 131.13330.2025, ${options.climateCityLabel}`
            : null,
        scenarioCompare: (options?.scenarioHistoryCount ?? 0) > 1,
    };
}
export function buildMissingResultFieldLabels(capabilities) {
    const missing = [];
    if (!capabilities.mechanicalVentilation) {
        missing.push("Механическая вентиляция — задайте ventilationACH > 0 в сценарии");
    }
    if (!capabilities.perSurfaceEnvelope) {
        missing.push("Потери по каждой поверхности ограждения — в разработке");
    }
    if (!capabilities.monteCarloInResult) {
        missing.push("Monte Carlo внутри result — запускайте отдельный шаг «Неопределённость»");
    }
    if (!capabilities.climateBaseLabel) {
        missing.push("Климатическая база — выберите город (СП 131) в сценарии");
    }
    if (!capabilities.scenarioCompare) {
        missing.push("Сравнение сценариев — сохраните несколько прогонов");
    }
    return missing;
}
