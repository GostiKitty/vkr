import { polygonArea } from "../../entities/geometry/geom";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { buildMonteCarloInterpretationLines, buildThermalSimulationInsightLines } from "../../core/thermal/thermalResultsInterpretation";
import { runSP50Compliance } from "../../core/thermal/sp50";
import { THERMAL_UNCERTAINTY_DEFINITIONS } from "../../core/uncertainty/thermalMonteCarlo";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { getMaterialThermalProperties } from "../../norms/sp50_2024/materialThermalProperties";
import { firstDisplayText, sanitizeDisplayText } from "../../shared/utils/displayText";
import { formatProjectDisplayLabel } from "../../shared/utils/projectLabels";
const NOT_SET = "не задано";
const NO_DATA = "нет данных";
const DOCUMENT_VERSION = "1.0";
const CALCULATION_PURPOSE = "Теплотехнический анализ здания";
const DOCUMENT_BASIS = "Данные цифровой модели здания, результаты теплотехнического расчета и доступные расчетно-диагностические сводки приложения.";
const REGULATORY_REFERENCE_TEXT = "Структура документа ориентирована на логику состава проектной документации, установленную Постановлением Правительства РФ № 87, и используется только как справочная привязка для расчетного паспорта.";
export function buildCalculationPassportData(input) {
    const { model, projectId, scenarioConfig, thermalResult, monteCarloResult } = input;
    const levelById = new Map(model.levels.map((level) => [level.id, level]));
    const roomRows = buildRoomRows(model.rooms, levelById);
    const totalAreaM2 = resolveTotalArea(model, roomRows);
    const totalVolumeM3 = resolveTotalVolume(model, roomRows);
    const climateInput = buildClimateInput(model.thermalProtection?.climate, scenarioConfig);
    const sp50Report = buildSp50Report(model, climateInput, scenarioConfig);
    const adjacency = buildAdjacencyGraph(model);
    const projectName = resolveProjectName(model, projectId);
    const constructionRows = buildConstructionRows(sp50Report);
    const materialRows = buildMaterialRows(sp50Report, model);
    const climate = {
        city: stringOrNull(firstDisplayText([sp50Report?.sourceData.city, climateInput?.city], "", { allowInternalId: false })),
        climateRegion: stringOrNull(sp50Report?.sourceData.climateRegion ?? climateInput?.climateRegion),
        indoorTemperatureC: finiteOrNull(sp50Report?.sourceData.indoorTemperatureC ?? climateInput?.indoorTemperatureC),
        outdoorDesignTemperatureC: finiteOrNull(sp50Report?.sourceData.outdoorDesignTemperatureC ?? climateInput?.outdoorDesignTemperatureC),
        outdoorHeatingAverageC: finiteOrNull(sp50Report?.sourceData.outdoorHeatingPeriodAverageC ?? climateInput?.outdoorHeatingPeriodAverageC),
        heatingDurationDays: finiteOrNull(sp50Report?.sourceData.heatingPeriodDurationDays ?? climateInput?.heatingPeriodDurationDays),
        humidityZone: stringOrNull(sp50Report?.sourceData.humidityZone ?? climateInput?.humidityZone),
    };
    const operation = {
        daySetpointC: finiteOrNull(scenarioConfig?.setpoints.day),
        nightSetpointC: finiteOrNull(scenarioConfig?.setpoints.night),
        infiltrationACH: finiteOrNull(scenarioConfig?.ventilation.infiltrationACH),
        ventilationACH: finiteOrNull(scenarioConfig?.ventilation.ventilationACH),
        heatRecoveryFactor: finiteOrNull(scenarioConfig?.ventilation.heatRecoveryFactor),
        internalGainDay_W_m2: finiteOrNull(scenarioConfig?.internalGains.dayGain_W_m2),
        internalGainNight_W_m2: finiteOrNull(scenarioConfig?.internalGains.nightGain_W_m2),
        occupancyDayFraction: finiteOrNull(scenarioConfig?.occupancy.dayFraction),
        occupancyNightFraction: finiteOrNull(scenarioConfig?.occupancy.nightFraction),
        mechanicalVentilationEnabled: typeof scenarioConfig?.ventilation.mechanicalVentilationEnabled === "boolean"
            ? scenarioConfig.ventilation.mechanicalVentilationEnabled
            : null,
    };
    const thermalDiagnostics = thermalResult?.diagnostics;
    const referenceTemperatures = (thermalDiagnostics?.zones ?? [])
        .map((zone) => finiteOrNull(zone.temperatureC))
        .filter((value) => value !== null);
    const insightLines = thermalResult
        ? buildThermalSimulationInsightLines(thermalResult, {
            duration: inferDuration(thermalResult),
            totalHeatedAreaM2: totalAreaM2 ?? undefined,
        })
        : [];
    const recommendations = uniqueNonEmpty([
        ...(sp50Report?.recommendations.map((item) => `${item.title}. ${item.effect}`) ?? []),
        ...(thermalDiagnostics?.building.balanceStatus === "risk"
            ? ["Проверить исходные режимы, наружные связи зон и состав ограждающих конструкций перед использованием результата в инженерных решениях."]
            : []),
        ...(monteCarloResult && (monteCarloResult.exceedanceProbability ?? 0) > 0.2
            ? ["Уточнить сценарные допущения и пороговые критерии риска перед принятием проектных решений по нагрузке."]
            : []),
    ]);
    const problemZones = uniqueNonEmpty(thermalDiagnostics?.zones
        .filter((zone) => zone.status !== "ok")
        .map((zone) => `${zone.zoneName}: ${zone.statusNote}`) ?? []);
    const thermalResults = {
        available: Boolean(thermalResult),
        averageRoomTemperatureC: referenceTemperatures.length > 0
            ? referenceTemperatures.reduce((sum, value) => sum + value, 0) / referenceTemperatures.length
            : null,
        minRoomTemperatureC: referenceTemperatures.length > 0 ? Math.min(...referenceTemperatures) : null,
        maxRoomTemperatureC: referenceTemperatures.length > 0 ? Math.max(...referenceTemperatures) : null,
        referenceOutdoorTemperatureC: finiteOrNull(thermalDiagnostics?.building.referenceOutdoorC),
        referenceTimeHours: finiteOrNull(thermalDiagnostics?.building.referenceTimeHours),
        totalOpaqueLossW: finiteOrNull(thermalDiagnostics?.building.totalOpaqueLossW),
        totalWindowLossW: finiteOrNull(thermalDiagnostics?.building.totalWindowLossW),
        totalDoorLossW: finiteOrNull(thermalDiagnostics?.building.totalDoorLossW),
        totalInfiltrationLossW: finiteOrNull(thermalDiagnostics?.building.totalInfiltrationLossW),
        totalVentilationLossW: finiteOrNull(thermalDiagnostics?.building.totalMechanicalVentilationLossW),
        totalHeatingW: finiteOrNull(thermalDiagnostics?.building.totalHeatingW),
        peakLoadKW: finiteOrNull(thermalResult?.summary.peakLoadKW),
        totalEnergyKWh: finiteOrNull(thermalResult?.summary.totalEnergyKWh),
        discomfortHours: finiteOrNull(thermalResult?.summary.discomfortHours),
        specificPeakLoad_W_m2: finiteOrNull(thermalDiagnostics?.building.specificPeakLoad_W_m2),
        specificEnergyKWh_m2: finiteOrNull(thermalDiagnostics?.building.specificEnergyKWh_m2),
        balanceStatusNote: stringOrNull(thermalDiagnostics?.building.balanceStatusNoteRu),
        modelWarnings: uniqueNonEmpty(thermalResult?.modelWarnings ?? []),
    };
    const monteCarlo = {
        available: Boolean(monteCarloResult),
        runs: finiteOrNull(monteCarloResult?.runs),
        meanPeakLoadKW: finiteOrNull(monteCarloResult?.peakLoad.mean),
        minPeakLoadKW: distributionMin(monteCarloResult?.peakLoad),
        maxPeakLoadKW: distributionMax(monteCarloResult?.peakLoad),
        p5PeakLoadKW: finiteOrNull(monteCarloResult?.peakLoad.p5),
        p95PeakLoadKW: finiteOrNull(monteCarloResult?.peakLoad.p95),
        exceedanceProbabilityPct: monteCarloResult && Number.isFinite(monteCarloResult.exceedanceProbability)
            ? (monteCarloResult.exceedanceProbability ?? 0) * 100
            : null,
        climateFactors: THERMAL_UNCERTAINTY_DEFINITIONS.filter((item) => item.id === "outdoorBiasC").map((item) => item.label),
        operationalFactors: THERMAL_UNCERTAINTY_DEFINITIONS.filter((item) => item.id !== "outdoorBiasC").map((item) => item.label),
        scope: stringOrNull(monteCarloResult?.engineeringScopeRu),
        interpretationLines: monteCarloResult ? buildMonteCarloInterpretationLines(monteCarloResult) : [],
    };
    const warnings = uniqueNonEmpty([
        ...(thermalResults.modelWarnings ?? []),
        ...(sp50Report?.missingData ?? []),
        ...(!scenarioConfig ? ["Сценарий расчета не задан. Разделы с режимами эксплуатации и тепловым режимом заполнены частично."] : []),
        ...(!thermalResult ? ["Теплотехнический расчет не выполнен. Разделы с результатами и инженерным заключением заполнены только доступными исходными данными."] : []),
        ...(!monteCarloResult ? ["Monte Carlo / вероятностный анализ не выполнен. Вероятностные показатели и риск выхода параметров не сформированы."] : []),
    ]);
    const summaryMetricsTable = [
        { label: "Количество уровней", value: model.levels.length, unit: "шт." },
        { label: "Количество помещений", value: model.rooms.length, unit: "шт." },
        { label: "Общая площадь", value: totalAreaM2, unit: "м²" },
        { label: "Общий объем", value: totalVolumeM3, unit: "м³" },
        { label: "Количество стен", value: model.walls.length, unit: "шт." },
        {
            label: "Количество ограждающих конструкций",
            value: sp50Report?.constructions.length ?? estimateEnvelopeCount(model),
            unit: "шт.",
        },
    ];
    const resultMetricsTable = [
        { label: "Средняя температура помещений", value: thermalResults.averageRoomTemperatureC, unit: "°C" },
        { label: "Минимальная температура", value: thermalResults.minRoomTemperatureC, unit: "°C" },
        { label: "Максимальная температура", value: thermalResults.maxRoomTemperatureC, unit: "°C" },
        { label: "Максимальные теплопотери", value: maxThermalLoss(thermalResults), unit: "Вт" },
        { label: "Расчетная тепловая нагрузка", value: thermalResults.peakLoadKW, unit: "кВт" },
    ];
    const monteCarloMetricsTable = [
        { label: "Количество испытаний", value: monteCarlo.runs, unit: "шт." },
        { label: "Среднее значение нагрузки", value: monteCarlo.meanPeakLoadKW, unit: "кВт" },
        { label: "Минимальное значение", value: monteCarlo.minPeakLoadKW, unit: "кВт" },
        { label: "Максимальное значение", value: monteCarlo.maxPeakLoadKW, unit: "кВт" },
        { label: "Вероятность риска", value: monteCarlo.exceedanceProbabilityPct, unit: "%" },
    ];
    const finalConclusion = buildFinalConclusion({
        thermalResult,
        monteCarloResult,
        problemZoneCount: problemZones.length,
    });
    return {
        documentVersion: DOCUMENT_VERSION,
        projectName,
        projectId,
        calculationPurpose: CALCULATION_PURPOSE,
        calculationBasis: DOCUMENT_BASIS,
        modelVersion: resolveModelVersion(model),
        documentStatus: "сформировано автоматически",
        summary: {
            levelCount: model.levels.length,
            roomCount: model.rooms.length,
            wallCount: model.walls.length,
            envelopeCount: sp50Report?.constructions.length ?? estimateEnvelopeCount(model),
            totalAreaM2,
            totalVolumeM3,
        },
        rooms: roomRows,
        materials: materialRows,
        constructions: constructionRows,
        climate,
        operation,
        adjacency: {
            internalConnections: adjacency.edges.length,
            externalConnections: adjacency.external.length,
            relationSummary: `В модели выявлено ${adjacency.edges.length} внутренних связей между помещениями и ${adjacency.external.length} наружных участков оболочки.`,
        },
        thermalResults,
        monteCarlo,
        sp50Report,
        summaryMetricsTable,
        resultMetricsTable,
        monteCarloMetricsTable,
        warnings,
        recommendations,
        problemZones,
        insightLines,
        finalConclusion,
        regulatoryReferenceText: REGULATORY_REFERENCE_TEXT,
        limitations: [
            "документ не является официальной проектной документацией;",
            "результаты предназначены для предварительной инженерной оценки;",
            "отчет не заменяет полный проектный расчет по действующим нормативным документам;",
            "при неполных исходных данных результаты должны рассматриваться как ориентировочные;",
            "расчетная модель требует проверки и валидации на реальных объектах.",
        ],
    };
}
function buildRoomRows(rooms, levelById) {
    return rooms.map((room, index) => {
        const areaM2 = Math.abs(polygonArea(room.polygon));
        const level = levelById.get(room.levelId);
        return {
            id: room.id,
            roomName: sanitizeDisplayText(room.name, `Помещение ${index + 1}`),
            levelName: level ? sanitizeDisplayText(level.name, room.levelId, { allowInternalId: true }) : room.levelId,
            areaM2: finiteOrNull(areaM2),
            volumeM3: finiteOrNull(level ? areaM2 * level.height_m : null),
        };
    });
}
function resolveTotalArea(model, roomRows) {
    return finiteOrNull(model.thermalProtection?.heatedAreaM2 ??
        roomRows.reduce((sum, room) => sum + (room.areaM2 ?? 0), 0));
}
function resolveTotalVolume(model, roomRows) {
    return finiteOrNull(model.thermalProtection?.heatedVolumeM3 ??
        roomRows.reduce((sum, room) => sum + (room.volumeM3 ?? 0), 0));
}
function buildClimateInput(climateMeta, scenarioConfig) {
    const cityClimate = getSp131CityClimate(scenarioConfig?.climateCityId ?? climateMeta?.city ?? null);
    const cityLabel = firstDisplayText([climateMeta?.city, cityClimate?.label], "", { allowInternalId: false });
    return {
        city: cityLabel || undefined,
        climateRegion: stringOrNull(climateMeta?.climateRegion) ?? undefined,
        indoorTemperatureC: finiteOrNull(climateMeta?.indoorTemperatureC ?? scenarioConfig?.setpoints.day) ?? undefined,
        outdoorHeatingPeriodAverageC: finiteOrNull(climateMeta?.outdoorHeatingPeriodAverageC ?? cityClimate?.outdoorHeatingPeriodAverageC) ?? undefined,
        heatingPeriodDurationDays: finiteOrNull(climateMeta?.heatingPeriodDurationDays ?? cityClimate?.heatingPeriodDurationDays) ?? undefined,
        outdoorDesignTemperatureC: finiteOrNull(climateMeta?.outdoorDesignTemperatureC ?? cityClimate?.outdoorDesignTemperatureC) ?? undefined,
        indoorRelativeHumidityPercent: finiteOrNull(climateMeta?.indoorRelativeHumidityPercent) ?? undefined,
        humidityZone: climateMeta?.humidityZone,
        solarRadiationZone: stringOrNull(climateMeta?.solarRadiationZone) ?? undefined,
        solarRadiationIavg_W_m2: finiteOrNull(climateMeta?.solarRadiationIavg_W_m2) ?? undefined,
        solarRadiationImax_W_m2: finiteOrNull(climateMeta?.solarRadiationImax_W_m2) ?? undefined,
    };
}
function buildSp50Report(model, climateInput, scenarioConfig) {
    try {
        return runSP50Compliance(model, climateInput, {
            defaultIndoorTemperatureC: scenarioConfig?.setpoints.day ?? 20,
            defaultOutdoorTemperatureC: climateInput?.outdoorDesignTemperatureC ?? scenarioConfig?.climate.baseC ?? -20,
        });
    }
    catch {
        return null;
    }
}
function buildConstructionRows(sp50Report) {
    if (!sp50Report) {
        return [];
    }
    return sp50Report.constructions.flatMap((construction) => {
        if (!construction.layers.length) {
            return [
                {
                    id: construction.id,
                    construction: construction.label,
                    material: NO_DATA,
                    thicknessM: null,
                    conductivity_W_mK: null,
                    resistance_m2K_W: finiteOrNull(construction.actualResistance_m2K_W),
                    uValue_W_m2K: finiteOrNull(construction.heatTransferCoefficient_W_m2K),
                },
            ];
        }
        return construction.layers.map((layer, index) => ({
            id: `${construction.id}-${layer.materialId}-${index}`,
            construction: construction.label,
            material: layer.materialLabel,
            thicknessM: finiteOrNull(layer.thicknessM),
            conductivity_W_mK: finiteOrNull(layer.conductivity_W_mK),
            resistance_m2K_W: finiteOrNull(construction.actualResistance_m2K_W),
            uValue_W_m2K: finiteOrNull(construction.heatTransferCoefficient_W_m2K),
        }));
    });
}
function buildMaterialRows(sp50Report, model) {
    const map = new Map();
    sp50Report?.constructions.forEach((construction) => {
        construction.layers.forEach((layer) => {
            const entry = map.get(layer.materialId);
            if (entry) {
                entry.occurrences += 1;
                if (Number.isFinite(layer.thicknessM)) {
                    entry.thicknessesM.push(layer.thicknessM);
                }
                if (entry.conductivity_W_mK === null && Number.isFinite(layer.conductivity_W_mK)) {
                    entry.conductivity_W_mK = layer.conductivity_W_mK;
                }
                return;
            }
            map.set(layer.materialId, {
                id: layer.materialId,
                material: layer.materialLabel,
                conductivity_W_mK: finiteOrNull(layer.conductivity_W_mK),
                thicknessesM: Number.isFinite(layer.thicknessM) ? [layer.thicknessM] : [],
                occurrences: 1,
            });
        });
    });
    if (map.size > 0) {
        return [...map.values()];
    }
    collectFallbackLayers(model).forEach((layer) => {
        const properties = getMaterialThermalProperties({ materialId: layer.materialId, operationCondition: "A" });
        const entry = map.get(layer.materialId);
        if (entry) {
            entry.occurrences += 1;
            entry.thicknessesM.push(layer.thickness_m);
            return;
        }
        map.set(layer.materialId, {
            id: layer.materialId,
            material: properties?.label ?? layer.materialId,
            conductivity_W_mK: finiteOrNull(properties?.conductivity_W_mK),
            thicknessesM: Number.isFinite(layer.thickness_m) ? [layer.thickness_m] : [],
            occurrences: 1,
        });
    });
    return [...map.values()];
}
function collectFallbackLayers(model) {
    return [
        ...model.walls.flatMap((wall) => wall.layers ?? []),
        ...(model.roofs ?? []).flatMap((roof) => roof.layers ?? []),
        ...(model.floorSlabs ?? []).flatMap((slab) => slab.layers ?? []),
    ];
}
function resolveProjectName(model, projectId) {
    const meta = model.meta ?? {};
    const modelName = firstDisplayText([meta["name"], meta["projectName"], meta["title"], meta["project"], meta["label"]], "", { allowInternalId: false });
    if (modelName) {
        return modelName;
    }
    if (projectId?.startsWith("local:")) {
        return NOT_SET;
    }
    const fallback = formatProjectDisplayLabel(projectId, { fallback: "" });
    return fallback || NOT_SET;
}
function resolveModelVersion(model) {
    const meta = model.meta ?? {};
    const version = firstDisplayText([meta["modelVersion"], meta["version"], meta["revision"], meta["schemaVersion"]], "", { allowInternalId: true });
    return version || null;
}
function estimateEnvelopeCount(model) {
    return (model.walls.length +
        (model.roofs?.length ?? 0) +
        (model.floorSlabs?.length ?? 0) +
        model.windows.length +
        model.doors.length);
}
function maxThermalLoss(thermalResults) {
    const values = [
        thermalResults.totalOpaqueLossW,
        thermalResults.totalWindowLossW,
        thermalResults.totalDoorLossW,
        thermalResults.totalInfiltrationLossW,
        thermalResults.totalVentilationLossW,
    ].filter((value) => value !== null);
    return values.length ? Math.max(...values) : null;
}
function distributionMin(summary) {
    const value = summary?.cdf[0]?.value;
    return finiteOrNull(value);
}
function distributionMax(summary) {
    const cdf = summary?.cdf ?? [];
    const value = cdf.length ? cdf[cdf.length - 1]?.value : null;
    return finiteOrNull(value);
}
function inferDuration(result) {
    const maxTimeHours = result.timeline.reduce((max, point) => Math.max(max, point.timeHours), 0);
    return maxTimeHours > 48 ? "7d" : "24h";
}
function buildFinalConclusion(input) {
    const { thermalResult, monteCarloResult, problemZoneCount } = input;
    if (!thermalResult) {
        return "Теплотехнический расчет не выполнен. Документ может использоваться только как паспорт исходной цифровой модели и перечень доступных исходных данных.";
    }
    if ((monteCarloResult?.exceedanceProbability ?? 0) > 0.2 || problemZoneCount > 0) {
        return "Расчетная модель содержит результаты, требующие дополнительной инженерной проверки. Паспорт допускается использовать как вспомогательный аналитический материал, но не как окончательное проектное обоснование.";
    }
    return "По доступным расчетным данным модель может использоваться как вспомогательный инженерный материал для подготовки и проверки проектных решений при обязательной последующей валидации.";
}
function uniqueNonEmpty(values) {
    const seen = new Set();
    return values
        .map((value) => sanitizeDisplayText(value, "", { allowInternalId: true }))
        .filter((value) => {
        if (!value || seen.has(value)) {
            return false;
        }
        seen.add(value);
        return true;
    });
}
function finiteOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function stringOrNull(value) {
    const sanitized = sanitizeDisplayText(value, "", { allowInternalId: true });
    return sanitized || null;
}
