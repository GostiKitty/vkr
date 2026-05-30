import { gsop as calculateGsopSafe } from "../formulas";
import { calculateConstructionResistance, calculateHeatTransferCoefficient } from "./calculations";
import { computeSp50EnergyCharacteristic } from "./energyCharacteristic";
import { getSp131CityClimate } from "../../../norms/sp131_2025/climate";
import { calculateNt, getFloorHeatAbsorptionLimit, getGateRequiredResistance, getHeatingEnergyNorm, getInternalHeatTransferCoefficient, getExternalHeatTransferCoefficient, getInternalVaporPartialPressurePa, getLayerAirPermeabilityResistance, getMaterialThermalProperties, getMoistureMode, getNormalizedAirPermeability, getOperationCondition, getRequiredResistance, getSaturationVaporPressurePa, getSheetMaterialVaporResistance, getSolarAbsorptionCoefficient, getSolarRadiation, getSpecificThermalProtectionNorm, } from "../../../norms/sp50_2024/index";
export function runSP50Compliance(buildingModel, climateInput, options = {}) {
    const model = climateInput
        ? {
            ...buildingModel,
            thermalProtection: {
                ...(buildingModel.thermalProtection ?? {}),
                climate: {
                    ...(buildingModel.thermalProtection?.climate ?? {}),
                    ...climateInput,
                },
            },
        }
        : buildingModel;
    return runSp50ComplianceAnalysis({
        model,
        envelope: options.envelope ?? [],
        defaultIndoorTemperatureC: options.defaultIndoorTemperatureC ?? climateInput?.indoorTemperatureC ?? 20,
        defaultOutdoorTemperatureC: options.defaultOutdoorTemperatureC ?? climateInput?.outdoorDesignTemperatureC ?? -20,
    });
}
export function runSp50ComplianceAnalysis(input) {
    const context = resolveSourceData(input.model, input.defaultIndoorTemperatureC, input.defaultOutdoorTemperatureC);
    const resolvedEnvelope = resolveEnvelopeResults(input.model, input.envelope, context);
    context.missingData.push(...resolvedEnvelope.warnings);
    const constructions = buildConstructionChecks(input.model, resolvedEnvelope.results, context);
    const building = buildBuildingCheck(constructions, context);
    const temperature = buildTemperatureCheck(constructions);
    const transient = buildTransientCheck(constructions, context);
    const airPermeability = buildAirPermeabilityCheck(constructions, context);
    const moistureProtection = buildMoistureProtectionCheck(constructions, context);
    const floor = buildFloorCheck(constructions, context);
    const energy = buildEnergyCheck(building, context);
    if (energy.usesPlaceholderInputs) {
        context.missingData.push("Использованы placeholder-параметры в energy check СП 50; результат требует уточнения.");
    }
    context.missingData.push(...energy.placeholderWarnings);
    const materialEfficiency = buildMaterialEfficiency(constructions);
    const recommendations = buildRecommendations(constructions, building, energy, temperature);
    return {
        sourceData: context.sourceData,
        constructions,
        building,
        temperature,
        transient,
        airPermeability,
        moistureProtection,
        floor,
        energy,
        recommendations,
        materialEfficiency,
        missingData: context.missingData,
    };
}
function resolveSourceData(model, defaultIndoorTemperatureC, defaultOutdoorTemperatureC) {
    const buildingMeta = model.thermalProtection ?? {};
    const climate = buildingMeta.climate ?? {};
    const heatedAreaM2 = buildingMeta.heatedAreaM2 ??
        model.rooms.reduce((sum, room) => sum + polygonArea(room.polygon), 0);
    const averageHeight = model.levels.reduce((sum, level) => sum + level.height_m, 0) / Math.max(model.levels.length, 1);
    const heatedVolumeM3 = buildingMeta.heatedVolumeM3 ?? heatedAreaM2 * averageHeight;
    const sp131 = getSp131CityClimate(climate.city ?? null);
    const indoorTemperatureC = climate.indoorTemperatureC ?? defaultIndoorTemperatureC;
    const outdoorHeatingPeriodAverageC = climate.outdoorHeatingPeriodAverageC ?? sp131?.outdoorHeatingPeriodAverageC ?? null;
    const heatingPeriodDurationDays = climate.heatingPeriodDurationDays ?? sp131?.heatingPeriodDurationDays ?? null;
    const indoorRelativeHumidityPercent = climate.indoorRelativeHumidityPercent ?? 55;
    const humidityZone = climate.humidityZone ?? null;
    const moistureMode = buildingMeta.moistureMode ?? getMoistureMode({ indoorTemperature: indoorTemperatureC, relativeHumidity: indoorRelativeHumidityPercent });
    const operationCondition = buildingMeta.operationCondition ??
        (humidityZone ? getOperationCondition({ moistureMode, humidityZone }) : null);
    const gsop = outdoorHeatingPeriodAverageC !== null && heatingPeriodDurationDays !== null
        ? calculateGsopSafe(indoorTemperatureC, outdoorHeatingPeriodAverageC, heatingPeriodDurationDays)
        : null;
    const missingData = [];
    if (outdoorHeatingPeriodAverageC === null) {
        missingData.push("Не задана средняя температура наружного воздуха отопительного периода tот.");
    }
    if (heatingPeriodDurationDays === null) {
        missingData.push("Не задана продолжительность отопительного периода zот.");
    }
    if (!buildingMeta.buildingCategory) {
        missingData.push("Не задана категория здания для нормативных проверок СП 50.13330.2024.");
    }
    if (!humidityZone) {
        missingData.push("Не задана зона влажности района строительства.");
    }
    return {
        buildingMeta,
        missingData,
        sourceData: {
            city: climate.city ?? null,
            climateRegion: climate.climateRegion ?? null,
            indoorTemperatureC,
            indoorRelativeHumidityPercent,
            outdoorHeatingPeriodAverageC,
            heatingPeriodDurationDays,
            outdoorDesignTemperatureC: climate.outdoorDesignTemperatureC ?? sp131?.outdoorDesignTemperatureC ?? defaultOutdoorTemperatureC,
            gsop,
            heatedVolumeM3,
            heatedAreaM2,
            buildingCategory: buildingMeta.buildingCategory ?? null,
            storeys: buildingMeta.storeys ?? null,
            humidityZone,
            moistureMode,
            operationCondition,
        },
    };
}
function resolveEnvelopeResults(model, explicitEnvelope, context) {
    const results = [...explicitEnvelope];
    const warnings = [];
    const existingIds = new Set(results.map((entry) => entry.id));
    const shouldDeriveFullEnvelope = explicitEnvelope.length === 0;
    const derived = normalizeEnvelopeSurfaces(model, shouldDeriveFullEnvelope);
    derived.warnings.forEach((warning) => warnings.push(warning));
    derived.surfaces.forEach((surface) => {
        if (existingIds.has(surface.id)) {
            return;
        }
        if (!shouldDeriveFullEnvelope && surface.sourceType !== "roof" && surface.sourceType !== "slab") {
            return;
        }
        const result = buildEnvelopeResultFromSurface(surface, model, context);
        results.push(result);
        existingIds.add(result.id);
    });
    return { results, warnings };
}
function normalizeEnvelopeSurfaces(model, includeAllElements) {
    const surfaces = [];
    const warnings = [];
    const fragmentDefaults = model.thermalProtection?.envelope ?? [];
    const defaultLayersFor = (constructionType) => fragmentDefaults.find((fragment) => fragment.constructionType === constructionType || (constructionType === "covering" && fragment.constructionType === "roof"))?.layers?.map((layer) => ({ ...layer }));
    if (includeAllElements) {
        model.walls.forEach((wall) => {
            surfaces.push({
                id: `wall-${wall.id}`,
                sourceType: "wall",
                sourceId: wall.id,
                constructionType: "wall",
                area_m2: Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) * wall.height_m,
                levelId: wall.levelId,
                layers: wall.layers?.map((layer) => ({ ...layer })) ?? defaultLayersFor("wall") ?? [],
                metadata: {
                    name: wall.id,
                },
            });
        });
        const wallById = new Map(model.walls.map((wall) => [wall.id, wall]));
        model.windows.forEach((windowItem) => {
            const wall = windowItem.anchor.wallId ? wallById.get(windowItem.anchor.wallId) ?? null : null;
            surfaces.push({
                id: `window-${windowItem.id}`,
                sourceType: "window",
                sourceId: windowItem.id,
                constructionType: "window",
                area_m2: windowItem.width_m * windowItem.height_m,
                levelId: wall?.levelId ?? model.levels[0]?.id ?? "unknown-level",
                layers: defaultLayersFor("window") ?? [],
                metadata: {
                    name: windowItem.id,
                    wallId: wall?.id ?? null,
                },
            });
        });
        model.doors.forEach((door) => {
            const wall = door.anchor.wallId ? wallById.get(door.anchor.wallId) ?? null : null;
            surfaces.push({
                id: `door-${door.id}`,
                sourceType: "door",
                sourceId: door.id,
                constructionType: "door",
                area_m2: door.width_m * door.height_m,
                levelId: wall?.levelId ?? model.levels[0]?.id ?? "unknown-level",
                layers: defaultLayersFor("door") ?? [],
                metadata: {
                    name: door.id,
                    wallId: wall?.id ?? null,
                },
            });
        });
    }
    (model.roofs ?? []).forEach((roof) => {
        const projectedArea = polygonArea(roof.boundary);
        let area = projectedArea;
        let areaMode = "projection";
        const assumptions = [];
        if (roof.kind === "pitched") {
            if (roof.slope && Number.isFinite(roof.slope.risePerMeter)) {
                area *= Math.sqrt(1 + roof.slope.risePerMeter ** 2);
                areaMode = "slope-adjusted";
            }
            else {
                assumptions.push(`Крыша ${roof.name || roof.id}: использована площадь проекции, так как параметры уклона неполные.`);
            }
        }
        warnings.push(...assumptions);
        surfaces.push({
            id: `roof-${roof.id}`,
            sourceType: "roof",
            sourceId: roof.id,
            constructionType: "covering",
            area_m2: area,
            levelId: roof.levelId,
            layers: roof.layers?.map((layer) => ({ ...layer })) ?? defaultLayersFor("covering") ?? [],
            metadata: {
                name: roof.name,
                heatedSide: roof.heatedSide ?? "below",
                projectedArea_m2: projectedArea,
                areaMode,
                slope: roof.slope ?? null,
            },
        });
    });
    (model.floorSlabs ?? []).forEach((slab) => {
        if (slab.kind === "interfloor") {
            warnings.push(`Перекрытие ${slab.name || slab.id} не включено в наружную оболочку: межэтажная плита считается внутренним элементом.`);
            return;
        }
        const constructionType = slab.kind === "attic"
            ? "atticFloor"
            : slab.kind === "basement"
                ? "floorOverBasement"
                : slab.kind === "ground"
                    ? "floorOnGround"
                    : null;
        if (!constructionType) {
            warnings.push(`Перекрытие ${slab.name || slab.id}: тип не сопоставлен с СП 50, элемент будет отмечен как insufficient_data.`);
            return;
        }
        surfaces.push({
            id: `slab-${slab.id}`,
            sourceType: "slab",
            sourceId: slab.id,
            constructionType,
            area_m2: polygonArea(slab.boundary),
            levelId: slab.levelId,
            layers: slab.layers?.map((layer) => ({ ...layer })) ?? defaultLayersFor(constructionType) ?? [],
            metadata: {
                name: slab.name,
                heatedSide: slab.heatedSide ?? "below",
            },
        });
    });
    return { surfaces, warnings };
}
function buildEnvelopeResultFromSurface(surface, model, context) {
    const operationCondition = context.sourceData.operationCondition ?? "A";
    const layerDetails = buildLayerResults(surface.layers, operationCondition);
    const internalAlpha = getInternalHeatTransferCoefficient(mapConstructionToSurface(surface.constructionType));
    const externalAlpha = getExternalHeatTransferCoefficient(mapConstructionToSurface(surface.constructionType)) ??
        getExternalHeatTransferCoefficient("wall") ??
        23;
    const layerResistance = layerDetails.reduce((sum, layer) => sum + (layer.resistance_m2K_W ?? 0), 0);
    const hasResistanceData = layerDetails.length > 0 && layerDetails.every((layer) => isFiniteNumber(layer.resistance_m2K_W));
    const totalResistance = hasResistanceData
        ? calculateConstructionResistance({
            internalHeatTransferCoefficient: internalAlpha,
            externalHeatTransferCoefficient: externalAlpha,
            layerResistances: layerDetails.map((layer) => layer.resistance_m2K_W ?? 0),
        })
        : Number.NaN;
    const uValue = Number.isFinite(totalResistance) ? calculateHeatTransferCoefficient(totalResistance) : Number.NaN;
    const internalTemperatureC = context.sourceData.indoorTemperatureC ?? 20;
    const boundaryTemperatureC = context.sourceData.outdoorDesignTemperatureC ?? -20;
    const deltaTC = internalTemperatureC - boundaryTemperatureC;
    const heatFluxDensity = Number.isFinite(uValue) ? uValue * deltaTC : Number.NaN;
    const heatFluxW = Number.isFinite(heatFluxDensity) ? heatFluxDensity * surface.area_m2 : Number.NaN;
    const levelLabel = model.levels.find((level) => level.id === surface.levelId)?.name ?? surface.levelId;
    const assumptions = [
        ...(surface.metadata.areaMode === "projection" ? ["Площадь принята по проекции."] : []),
        ...(surface.layers.length === 0 ? ["Нет данных по слоям конструкции."] : []),
    ];
    return {
        id: surface.id,
        label: String(surface.metadata.name ?? surface.id),
        roomId: surface.levelId,
        roomName: levelLabel,
        levelId: surface.levelId,
        kind: mapConstructionTypeToEnvelopeKind(surface.constructionType),
        constructionType: surface.constructionType,
        sourceType: surface.sourceType,
        sourceId: surface.sourceId,
        layers: surface.layers.map((layer) => ({ ...layer })),
        orientation: resolveOrientation(surface.constructionType),
        areaM2: surface.area_m2,
        boundaryTemperatureC,
        internalTemperatureC,
        deltaTC,
        layerResistance_m2K_W: layerResistance,
        internalSurfaceResistance_m2K_W: 1 / internalAlpha,
        externalSurfaceResistance_m2K_W: 1 / externalAlpha,
        totalResistance_m2K_W: totalResistance,
        uValue_W_m2K: uValue,
        heatFluxW,
        heatFluxDensity_W_m2: heatFluxDensity,
        assumed: assumptions.length > 0,
        formulaBreakdown: {
            formula: "Ro = 1/alpha_in + sum(d/lambda) + 1/alpha_out; Q = U*A*dT",
            substitution: layerDetails.map((layer) => `${layer.materialId}:${(layer.resistance_m2K_W ?? 0).toFixed(3)}`).join(" + "),
            units: "m2K/W, W/(m2K), W",
            applicability: "SP50 normalized envelope surface",
        },
        assumptions,
    };
}
function buildConstructionChecks(model, envelope, context) {
    return envelope.map((entry) => {
        const constructionType = entry.constructionType ?? mapEnvelopeKindToConstructionType(entry.kind);
        const fragment = (model.thermalProtection?.envelope ?? []).find((candidate) => candidate.id === entry.id) ?? null;
        const indoorTemperatureC = entry.internalTemperatureC ?? context.sourceData.indoorTemperatureC ?? 20;
        const outdoorTemperatureC = entry.boundaryTemperatureC ?? context.sourceData.outdoorDesignTemperatureC ?? -20;
        const nt = context.sourceData.outdoorHeatingPeriodAverageC === null || context.sourceData.indoorTemperatureC === null
            ? 1
            : calculateNt({
                indoorTemperatureC: context.sourceData.indoorTemperatureC,
                outdoorHeatingPeriodAverageC: context.sourceData.outdoorHeatingPeriodAverageC,
                adjustedIndoorTemperatureC: indoorTemperatureC,
                adjustedOutdoorTemperatureC: context.sourceData.outdoorHeatingPeriodAverageC,
            });
        const mp = fragment?.multiplierMp ?? 1;
        const wall = findWallByEnvelopeLabel(model, entry.id);
        const layers = buildLayerResults(entry.layers ?? wall?.layers ?? fragment?.layers, fragment?.operationCondition ?? context.sourceData.operationCondition ?? "A");
        const actualResistance = isFiniteNumber(entry.totalResistance_m2K_W) ? entry.totalResistance_m2K_W : null;
        const requiredResistanceBase = constructionType === "gate"
            ? getGateRequiredResistance("insulated")
            : context.sourceData.gsop !== null && context.sourceData.buildingCategory
                ? getRequiredResistance({
                    buildingCategory: context.sourceData.buildingCategory,
                    constructionType,
                    gsop: context.sourceData.gsop,
                })
                : null;
        const requiredResistance = requiredResistanceBase !== null ? requiredResistanceBase * mp : null;
        const reducedResistance = buildReducedResistance(actualResistance, entry.areaM2, wall?.layers, indoorTemperatureC, outdoorTemperatureC, constructionType, fragment?.heterogeneity);
        const margin = actualResistance !== null && requiredResistance !== null ? actualResistance - requiredResistance : null;
        const dewPointTemperatureC = computeDewPointApproximation(indoorTemperatureC, context.sourceData.indoorRelativeHumidityPercent ?? 55);
        const alphaIn = getInternalHeatTransferCoefficient(mapConstructionToSurface(constructionType));
        const rsi = isFiniteNumber(entry.internalSurfaceResistance_m2K_W)
            ? entry.internalSurfaceResistance_m2K_W
            : 1 / Math.max(alphaIn, 1e-6);
        // T_si = T_in - ΔT * Rsi / R_total  (СП 50.13330.2024 формула для внутренней поверхности)
        const internalSurfaceTemperatureC = actualResistance !== null && actualResistance > 0
            ? indoorTemperatureC - (indoorTemperatureC - outdoorTemperatureC) * rsi / actualResistance
            : null;
        const temperatureProfile = buildTemperatureProfile(layers, indoorTemperatureC, outdoorTemperatureC, constructionType);
        const homogeneityCoefficient = actualResistance !== null && reducedResistance !== null && actualResistance > 0 ? reducedResistance / actualResistance : null;
        const complies = margin === null ? null : margin >= 0;
        return {
            id: entry.id,
            label: entry.label,
            constructionType,
            areaM2: entry.areaM2,
            nt,
            mp,
            layers,
            internalHeatTransferCoefficient: getInternalHeatTransferCoefficient(mapConstructionToSurface(constructionType)),
            externalHeatTransferCoefficient: getExternalHeatTransferCoefficient(mapConstructionToSurface(constructionType)),
            actualResistance_m2K_W: actualResistance,
            requiredResistance_m2K_W: requiredResistanceBase,
            normalizedResistance_m2K_W: requiredResistance,
            reducedResistance_m2K_W: reducedResistance,
            heatTransferCoefficient_W_m2K: isFiniteNumber(entry.uValue_W_m2K) ? entry.uValue_W_m2K : null,
            margin_m2K_W: margin,
            complies,
            status: resolveStatus(complies),
            explanation: margin === null
                ? "Недостаточно нормативных данных для полной проверки."
                : margin >= 0
                    ? "Фактическое сопротивление не ниже нормируемого."
                    : "Фактическое сопротивление ниже нормируемого.",
            internalSurfaceTemperatureC,
            dewPointTemperatureC,
            condensationRisk: internalSurfaceTemperatureC !== null && dewPointTemperatureC !== null ? internalSurfaceTemperatureC < dewPointTemperatureC : null,
            riskZones: fragment?.riskZones?.length ? fragment.riskZones : inferRiskZones(constructionType),
            temperatureProfile,
            contribution_W_K: reducedResistance ? (nt * entry.areaM2) / Math.max(reducedResistance, 1e-6) : null,
            homogeneityCoefficient,
        };
    });
}
function buildBuildingCheck(constructions, context) {
    const heatedVolume = context.sourceData.heatedVolumeM3;
    const totalArea = constructions.reduce((sum, entry) => sum + entry.areaM2, 0);
    const totalContribution = constructions.reduce((sum, entry) => sum + (entry.contribution_W_K ?? 0), 0);
    const kob = heatedVolume ? totalContribution / heatedVolume : null;
    const kOverall = totalArea > 0 ? totalContribution / totalArea : null;
    const compactness = heatedVolume ? totalArea / heatedVolume : null;
    const kobNorm = context.sourceData.gsop !== null && heatedVolume
        ? getSpecificThermalProtectionNorm({
            heatedVolumeM3: heatedVolume,
            gsop: context.sourceData.gsop,
        })
        : null;
    const complies = kob !== null && kobNorm !== null ? kob <= kobNorm : null;
    return {
        fragments: constructions.map((entry) => ({
            id: entry.id,
            label: entry.label,
            areaM2: entry.areaM2,
            reducedResistance_m2K_W: entry.reducedResistance_m2K_W,
            nt: entry.nt,
            contribution_W_K: entry.contribution_W_K,
        })),
        kob_W_m3K: kob,
        kobNorm_W_m3K: kobNorm,
        kOverall_W_m2K: kOverall,
        compactness_1_m: compactness,
        complies,
        status: resolveStatus(complies),
    };
}
function buildTemperatureCheck(constructions) {
    const temperatures = constructions.map((entry) => entry.internalSurfaceTemperatureC).filter(isFiniteNumber);
    const dewPoints = constructions.map((entry) => entry.dewPointTemperatureC).filter(isFiniteNumber);
    const problematicZones = constructions.filter((entry) => entry.condensationRisk).flatMap((entry) => entry.riskZones.map((zone) => `${entry.label}: ${zone}`));
    return {
        minimumSurfaceTemperatureC: temperatures.length ? Math.min(...temperatures) : null,
        dewPointTemperatureC: dewPoints.length ? Math.max(...dewPoints) : null,
        riskCount: problematicZones.length,
        problematicZones,
    };
}
function buildTransientCheck(constructions, context) {
    // Per-layer R×S products kept for display (thermalInertiaByLayer in the result).
    const inertiaLayers = constructions.flatMap((entry) => entry.layers.map((layer) => layer.resistance_m2K_W !== null && layer.heatAbsorption_W_m2K !== null
        ? layer.resistance_m2K_W * layer.heatAbsorption_W_m2K
        : 0));
    // D = Σ R_k × S_k computed per construction (СП 50.13330.2024, разд. 7.3).
    // Use the minimum D among exterior walls/coverings as the most critical check element.
    const perConstructionD = constructions.map((entry) => entry.layers.reduce((sum, layer) => sum +
        (layer.resistance_m2K_W !== null && layer.heatAbsorption_W_m2K !== null
            ? layer.resistance_m2K_W * layer.heatAbsorption_W_m2K
            : 0), 0));
    const envelopeD = constructions
        .map((entry, idx) => ({ type: entry.constructionType, d: perConstructionD[idx] ?? 0 }))
        .filter((x) => x.type === "wall" || x.type === "covering" || x.type === "floorOnGround")
        .map((x) => x.d)
        .filter((d) => d > 0);
    const positiveD = envelopeD.length > 0 ? envelopeD : perConstructionD.filter((d) => d > 0);
    const thermalInertia = positiveD.length ? Math.min(...positiveD) : 0;
    const july = context.buildingMeta.climate?.julyAverageTemperatureC ?? null;
    const summerAmplitude = context.buildingMeta.climate?.summerOutdoorAmplitudeC ?? null;
    const wind = context.buildingMeta.climate?.summerWindSpeedM_s ?? null;
    const summerAlpha = wind !== null ? 1.16 * (5 + 10 * Math.sqrt(Math.max(wind, 0))) : null;
    const radiation = context.buildingMeta.climate?.solarRadiationImax_W_m2 !== undefined &&
        context.buildingMeta.climate?.solarRadiationIavg_W_m2 !== undefined
        ? {
            Imax_W_m2: context.buildingMeta.climate.solarRadiationImax_W_m2,
            Iavg_W_m2: context.buildingMeta.climate.solarRadiationIavg_W_m2,
        }
        : getSolarRadiation(context.buildingMeta.climate?.solarRadiationZone ?? "central");
    const rho = getSolarAbsorptionCoefficient("mediumFacade") ?? 0.65;
    const requiredAmplitude = july !== null ? 2.5 - 0.1 * (july - 21) : null;
    const externalAmplitude = summerAmplitude !== null && summerAlpha !== null && radiation ? summerAmplitude + (0.5 * rho * (radiation.Imax_W_m2 - radiation.Iavg_W_m2)) / summerAlpha : null;
    const internalAmplitude = externalAmplitude !== null && thermalInertia > 0 ? externalAmplitude / Math.max(thermalInertia, 1) : null;
    const complies = requiredAmplitude !== null && internalAmplitude !== null ? internalAmplitude <= requiredAmplitude : null;
    return {
        thermalInertia_D: thermalInertia || null,
        thermalInertiaByLayer: inertiaLayers,
        requiredAmplitudeC: requiredAmplitude,
        calculatedExternalAmplitudeC: externalAmplitude,
        internalSurfaceAmplitudeC: internalAmplitude,
        summerExternalCoefficient_W_m2K: summerAlpha,
        requiresDetailedCheck: thermalInertia ? thermalInertia < 4 : null,
        complies,
        status: resolveStatus(complies),
    };
}
function buildAirPermeabilityCheck(constructions, context) {
    const indoorTemperature = context.sourceData.indoorTemperatureC;
    const outdoorTemperature = context.sourceData.outdoorDesignTemperatureC;
    const height = context.buildingMeta.storeys ? context.buildingMeta.storeys * 3 : null;
    // СП 50.13330.2024 разд. 8: ΔP использует январскую скорость ветра (СП 131, табл. Б.2), не летнюю.
    const wind = context.buildingMeta.climate?.winterWindSpeedM_s ??
        (context.buildingMeta.climate?.summerWindSpeedM_s != null
            ? context.buildingMeta.climate.summerWindSpeedM_s * 1.4
            : 5);
    const gammaIndoor = indoorTemperature !== null ? 3463 / (273 + indoorTemperature) : null;
    const gammaOutdoor = outdoorTemperature !== null ? 3463 / (273 + outdoorTemperature) : null;
    const pressureDifference = gammaIndoor !== null && gammaOutdoor !== null && height !== null
        ? 0.55 * height * (gammaOutdoor - gammaIndoor) + 0.03 * gammaOutdoor * wind ** 2
        : null;
    const candidate = constructions.find((entry) => entry.constructionType === "wall") ?? constructions[0] ?? null;
    const actualResistance = candidate ? sumAirResistance(candidate.layers) : null;
    const normG = candidate ? getNormalizedAirPermeability(candidate.constructionType) : null;
    const requiredResistance = pressureDifference !== null && normG ? pressureDifference / normG : null;
    const complies = actualResistance !== null && requiredResistance !== null ? actualResistance >= requiredResistance : null;
    return {
        pressureDifferencePa: pressureDifference,
        specificWeights: { indoor: gammaIndoor, outdoor: gammaOutdoor },
        actualResistance_m2hPa_kg: actualResistance,
        requiredResistance_m2hPa_kg: requiredResistance,
        complies,
        status: resolveStatus(complies),
    };
}
function buildMoistureProtectionCheck(constructions, context) {
    const indoorTemperature = context.sourceData.indoorTemperatureC;
    const humidity = context.sourceData.indoorRelativeHumidityPercent;
    if (indoorTemperature === null || humidity === null) {
        return {
            internalPartialPressurePa: null,
            saturationPressurePa: null,
            actualResistance_m2hPa_mg: null,
            requiredResistanceAnnual_m2hPa_mg: null,
            requiredResistanceColdPeriod_m2hPa_mg: null,
            governingRequiredResistance_m2hPa_mg: null,
            maxMoisturePlaneIndex: null,
            status: "insufficient_data",
            complies: null,
        };
    }
    const internalPartialPressure = getInternalVaporPartialPressurePa({
        indoorTemperatureC: indoorTemperature,
        relativeHumidityPercent: humidity,
    });
    const saturationPressure = getSaturationVaporPressurePa(indoorTemperature);
    const candidate = constructions.find((entry) => entry.constructionType === "wall") ?? constructions[0] ?? null;
    const actualResistance = candidate ? sumVaporResistance(candidate.layers) : null;
    const requiredAnnual = internalPartialPressure > 0 ? internalPartialPressure / 120 : null;
    const requiredCold = internalPartialPressure > 0 ? internalPartialPressure / 150 : null;
    const governing = requiredAnnual !== null && requiredCold !== null ? Math.max(requiredAnnual, requiredCold) : null;
    return {
        internalPartialPressurePa: internalPartialPressure,
        saturationPressurePa: saturationPressure,
        actualResistance_m2hPa_mg: actualResistance,
        requiredResistanceAnnual_m2hPa_mg: requiredAnnual,
        requiredResistanceColdPeriod_m2hPa_mg: requiredCold,
        governingRequiredResistance_m2hPa_mg: governing,
        maxMoisturePlaneIndex: candidate?.temperatureProfile.length ? candidate.temperatureProfile.length - 1 : null,
        status: actualResistance !== null && governing !== null ? "calculated" : "insufficient_data",
        complies: actualResistance !== null && governing !== null ? actualResistance >= governing : null,
    };
}
function buildFloorCheck(constructions, context) {
    const floor = constructions.find((entry) => entry.constructionType === "floorOnGround" || entry.constructionType === "floorOverBasement") ?? null;
    const limit = getFloorHeatAbsorptionLimit(context.sourceData.buildingCategory ?? undefined);
    if (!floor) {
        return {
            heatAbsorption_W_m2K: null,
            requiredHeatAbsorption_W_m2K: limit,
            complies: null,
            status: "insufficient_data",
        };
    }
    const heatAbsorption = calculateFloorHeatAbsorption(floor.layers);
    const complies = heatAbsorption !== null && limit !== null ? heatAbsorption <= limit : null;
    return {
        heatAbsorption_W_m2K: heatAbsorption,
        requiredHeatAbsorption_W_m2K: limit,
        complies,
        status: resolveStatus(complies),
    };
}
function buildEnergyCheck(building, context) {
    const gsop = context.sourceData.gsop;
    const volume = context.sourceData.heatedVolumeM3;
    const area = context.sourceData.heatedAreaM2;
    const ev = context.buildingMeta.energyVentilation ?? {};
    const usesDefaultVentilationAch = ev.ventilationFlowM3H == null && ev.ventilationACH == null;
    const usesDefaultInfiltrationAch = ev.infiltrationMassFlowKgH == null && ev.infiltrationACH == null;
    const computed = computeSp50EnergyCharacteristic({
        kob_W_m3K: building.kob_W_m3K,
        gsop,
        heatedVolumeM3: volume,
        heatedAreaM2: area,
        residentialAreaM2: context.buildingMeta.residentialAreaM2 ?? area,
        indoorTemperatureC: context.sourceData.indoorTemperatureC,
        outdoorHeatingPeriodAverageC: context.sourceData.outdoorHeatingPeriodAverageC,
        buildingCategory: context.sourceData.buildingCategory,
        storeys: context.sourceData.storeys,
        solarRadiationIavg_W_m2: context.buildingMeta.climate?.solarRadiationIavg_W_m2,
        solarRadiationZone: context.buildingMeta.climate?.solarRadiationZone,
        ventilation: {
            ventilationFlowM3H: ev.ventilationFlowM3H,
            infiltrationMassFlowKgH: ev.infiltrationMassFlowKgH,
            ventilationACH: ev.ventilationACH ?? 0.18,
            infiltrationACH: ev.infiltrationACH ?? 0.45,
            heatRecoveryFactor: ev.heatRecoveryFactor ?? 0,
            volumeCoefficientBetaV: ev.volumeCoefficientBetaV,
        },
    });
    const placeholderWarnings = [...computed.placeholderWarnings];
    if (usesDefaultVentilationAch) {
        placeholderWarnings.push("Placeholder: для расчёта энергопоказателей СП 50 использована типовая кратность механической вентиляции ventilationACH = 0.18 1/ч.");
    }
    if (usesDefaultInfiltrationAch) {
        placeholderWarnings.push("Placeholder: для расчёта энергопоказателей СП 50 использована типовая кратность инфильтрации infiltrationACH = 0.45 1/ч.");
    }
    const usesPlaceholderInputs = placeholderWarnings.length > 0;
    const qByArea = computed.annualHeatingEnergy_kWh !== null && area ? computed.annualHeatingEnergy_kWh / area : null;
    const qByVolume = computed.annualHeatingEnergy_kWh !== null && volume ? computed.annualHeatingEnergy_kWh / volume : null;
    const qNorm = getHeatingEnergyNorm(context.sourceData.buildingCategory ?? undefined, context.sourceData.storeys ?? undefined);
    const complies = qByArea !== null && qNorm !== null ? qByArea <= qNorm : null;
    return {
        qHeatingCharacteristic_W_m3K: computed.qHeatingCharacteristic_W_m3K,
        qHeatingNorm_kWh_m2: qNorm,
        annualHeatingEnergy_kWh: computed.annualHeatingEnergy_kWh,
        annualTotalLosses_kWh: computed.annualTotalLosses_kWh,
        qByArea_kWh_m2: qByArea,
        qByVolume_kWh_m3: qByVolume,
        betaGainUseFactor: computed.betaGainUseFactor,
        ventilationCharacteristic_W_m3K: computed.ventilationCharacteristic_W_m3K,
        internalGainCharacteristic_W_m3K: computed.internalGainCharacteristic_W_m3K,
        solarGainCharacteristic_W_m3K: computed.solarGainCharacteristic_W_m3K,
        averageAirDensity_kg_m3: computed.averageAirDensity_kg_m3,
        averageAirExchange_1_h: computed.averageAirExchange_1_h,
        usesPlaceholderInputs,
        placeholderWarnings,
        complies,
        status: resolveStatus(complies),
    };
}
function buildMaterialEfficiency(constructions) {
    const seen = new Set();
    const results = [];
    constructions.forEach((construction) => {
        construction.layers.forEach((layer) => {
            if (seen.has(layer.materialId)) {
                return;
            }
            seen.add(layer.materialId);
            const lambda = layer.conductivity_W_mK;
            const efficiency = lambda ? (30 * 1 / lambda) / 100 : null;
            results.push({ materialId: layer.materialId, efficiency });
        });
    });
    return results;
}
function buildRecommendations(constructions, building, energy, temperature) {
    const recommendations = [];
    const failed = constructions.filter((entry) => entry.complies === false).sort((left, right) => (left.margin_m2K_W ?? 0) - (right.margin_m2K_W ?? 0));
    failed.slice(0, 3).forEach((entry) => {
        recommendations.push({
            id: `construction-${entry.id}`,
            title: `Усилить ${entry.label}`,
            effect: `Дефицит по сопротивлению теплопередаче: ${Math.abs(entry.margin_m2K_W ?? 0).toFixed(2)} м²·К/Вт.`,
        });
    });
    if (building.complies === false) {
        recommendations.push({
            id: "kob",
            title: "Снизить удельную теплозащитную характеристику здания",
            effect: "Приоритетно улучшать элементы с максимальным вкладом A/R в общий теплоприток.",
        });
    }
    if (temperature.riskCount > 0) {
        recommendations.push({
            id: "condensation",
            title: "Устранить локальные зоны конденсации",
            effect: "Проверить наружные углы, откосы, примыкания и теплопроводные включения.",
        });
    }
    if (energy.complies === false) {
        recommendations.push({
            id: "energy",
            title: "Снизить годовой расход тепловой энергии",
            effect: "Наиболее быстрый эффект обычно дают окна, вентиляция и рекуперация.",
        });
    }
    return recommendations;
}
function buildLayerResults(layers, operationCondition) {
    return (layers ?? []).map((layer) => {
        const properties = getMaterialThermalProperties({ materialId: layer.materialId, operationCondition });
        return {
            materialId: layer.materialId,
            materialLabel: properties?.label ?? layer.materialId,
            thicknessM: layer.thickness_m,
            conductivity_W_mK: properties?.conductivity_W_mK ?? null,
            resistance_m2K_W: properties ? layer.thickness_m / Math.max(properties.conductivity_W_mK, 1e-9) : null,
            heatAbsorption_W_m2K: properties?.heatAbsorption_W_m2K ?? null,
            vaporPermeability_mg_mhPa: properties?.vaporPermeability_mg_mhPa ?? null,
        };
    });
}
function buildTemperatureProfile(layers, indoorTemperatureC, outdoorTemperatureC, constructionType) {
    const alphaIn = getInternalHeatTransferCoefficient(mapConstructionToSurface(constructionType));
    const alphaOut = getExternalHeatTransferCoefficient(mapConstructionToSurface(constructionType)) ?? 23;
    const rsi = 1 / Math.max(alphaIn, 1e-6);
    const rse = 1 / Math.max(alphaOut, 1e-6);
    const resistances = [rsi, ...layers.map((layer) => layer.resistance_m2K_W ?? 0), rse];
    const totalResistance = Math.max(resistances.reduce((sum, value) => sum + value, 0), 1e-9);
    const deltaT = indoorTemperatureC - outdoorTemperatureC;
    const points = [
        { positionM: 0, temperatureC: indoorTemperatureC, label: "Внутренний воздух" },
        { positionM: 0, temperatureC: indoorTemperatureC - deltaT * rsi / totalResistance, label: "Внутренняя поверхность" },
    ];
    let position = 0;
    let cumulativeResistance = rsi;
    layers.forEach((layer) => {
        cumulativeResistance += layer.resistance_m2K_W ?? 0;
        position += layer.thicknessM;
        points.push({
            positionM: position,
            temperatureC: indoorTemperatureC - deltaT * cumulativeResistance / totalResistance,
            label: layer.materialLabel,
        });
    });
    points.push({ positionM: position, temperatureC: outdoorTemperatureC + deltaT * rse / totalResistance, label: "Наружная поверхность" }, { positionM: position, temperatureC: outdoorTemperatureC, label: "Наружный воздух" });
    return points;
}
/**
 * Приведённое сопротивление теплопередаче по СП 50.13330.2024:
 * 1) Учёт плоскостной неоднородности (параллельные зоны с разным составом):
 *    U_ср = (A_осн·U_0 + Σ A_i·U_i) / A  (площадно-взвешенное U).
 * 2) Линейные и точечные тепловые мостики:
 *    U_pr = U_ср + (Σ ψ_i·L_i + Σ χ_j·n_j) / A, R_pr = 1/U_pr.
 */
function buildReducedResistance(actualResistance, areaM2, layers, indoorTemperatureC, outdoorTemperatureC, constructionType, heterogeneity) {
    void layers;
    void indoorTemperatureC;
    void outdoorTemperatureC;
    void constructionType;
    if (actualResistance === null || !Number.isFinite(actualResistance) || actualResistance <= 0) {
        return actualResistance;
    }
    if (!heterogeneity || areaM2 <= 0) {
        return actualResistance;
    }
    // 1. Плоскостная неоднородность: площадно-взвешенное U по параллельным зонам.
    const planarZones = heterogeneity.planar ?? [];
    let baseU = 1 / actualResistance;
    if (planarZones.length > 0) {
        const planarAreaTotal = planarZones.reduce((sum, zone) => sum + Math.max(0, zone.areaM2), 0);
        if (planarAreaTotal > 0 && planarAreaTotal < areaM2) {
            const baseAreaFraction = (areaM2 - planarAreaTotal) / areaM2;
            const planarUContribution = planarZones.reduce((sum, zone) => sum + (zone.areaM2 / areaM2) * (1 / Math.max(zone.resistance_m2K_W, 1e-6)), 0);
            baseU = baseAreaFraction * (1 / actualResistance) + planarUContribution;
        }
    }
    // 2. Линейные и точечные тепловые мостики.
    const linearBridge_W_K = (heterogeneity.linear ?? []).reduce((sum, bridge) => sum + bridge.psi_W_mK * bridge.lengthM, 0);
    const pointBridge_W_K = (heterogeneity.point ?? []).reduce((sum, bridge) => sum + bridge.chi_W_K * (bridge.count ?? 1), 0);
    const totalBridge_W_K = linearBridge_W_K + pointBridge_W_K;
    if (baseU <= 1 / actualResistance && totalBridge_W_K <= 0) {
        return actualResistance;
    }
    const uPr = baseU + totalBridge_W_K / areaM2;
    if (!Number.isFinite(uPr) || uPr <= 0) {
        return actualResistance;
    }
    return 1 / Math.max(uPr, 1e-6);
}
function calculateFloorHeatAbsorption(layers) {
    if (!layers.length) {
        return null;
    }
    let inertia = 0;
    for (let index = 0; index < layers.length; index += 1) {
        const layer = layers[index];
        const Ri = layer.resistance_m2K_W ?? 0;
        const si = layer.heatAbsorption_W_m2K ?? 0;
        inertia += Ri * si;
        if (index === 0 && inertia >= 0.5) {
            return 2 * si;
        }
        if (inertia >= 0.5) {
            return 2 * si;
        }
    }
    return 2 * (layers[layers.length - 1]?.heatAbsorption_W_m2K ?? 0);
}
function sumAirResistance(layers) {
    const values = layers
        .map((layer) => getLayerAirPermeabilityResistance(layer.materialId))
        .filter(isFiniteNumber);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}
function sumVaporResistance(layers) {
    const values = layers
        .map((layer) => {
        if (!layer.vaporPermeability_mg_mhPa || layer.vaporPermeability_mg_mhPa <= 0) {
            return getSheetMaterialVaporResistance(layer.materialId);
        }
        return layer.thicknessM / layer.vaporPermeability_mg_mhPa;
    })
        .filter(isFiniteNumber);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}
function inferRiskZones(constructionType) {
    if (constructionType === "window") {
        return ["примыкания окон", "оконные откосы"];
    }
    if (constructionType === "door") {
        return ["примыкания дверей"];
    }
    return ["внешние углы", "теплопроводные включения", "переходы к грунту"];
}
function mapConstructionTypeToEnvelopeKind(constructionType) {
    switch (constructionType) {
        case "window":
            return "window";
        case "door":
        case "gate":
            return "door";
        case "floorOnGround":
        case "floorOverBasement":
        case "atticFloor":
            return "floor";
        case "roof":
        case "covering":
            return "roof";
        default:
            return "wall";
    }
}
function resolveOrientation(constructionType) {
    if (constructionType === "wall" || constructionType === "window" || constructionType === "door") {
        return "mixed";
    }
    if (constructionType === "covering" || constructionType === "roof") {
        return "horizontal-up";
    }
    if (constructionType === "floorOverBasement" || constructionType === "floorOnGround" || constructionType === "atticFloor") {
        return "horizontal-down";
    }
    return null;
}
function mapConstructionToSurface(constructionType) {
    switch (constructionType) {
        case "roof":
        case "covering":
            return "roof";
        case "atticFloor":
            return "atticFloor";
        case "floorOverBasement":
        case "floorOnGround":
            return "floorOverBasement";
        case "window":
            return "window";
        case "lantern":
            return "lantern";
        case "door":
            return "door";
        case "gate":
            return "gate";
        default:
            return "wall";
    }
}
function mapEnvelopeKindToConstructionType(kind) {
    switch (kind) {
        case "roof":
            return "covering";
        case "floor":
            return "floorOverBasement";
        case "window":
            return "window";
        case "door":
            return "door";
        default:
            return "wall";
    }
}
function computeDewPointApproximation(temperatureC, relativeHumidityPercent) {
    const gamma = Math.log(relativeHumidityPercent / 100) + (17.27 * temperatureC) / (237.7 + temperatureC);
    return (237.7 * gamma) / (17.27 - gamma);
}
function polygonArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
}
function findWallByEnvelopeLabel(model, envelopeId) {
    const wallId = envelopeId.replace(/^(wall|window|door)-/, "");
    return model.walls.find((wall) => wall.id === wallId);
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function resolveStatus(complies) {
    if (complies === null) {
        return "insufficient_data";
    }
    return complies ? "pass" : "fail";
}
