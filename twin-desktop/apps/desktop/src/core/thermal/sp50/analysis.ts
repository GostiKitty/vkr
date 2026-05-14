import type { BuildingModel, EnvelopeSurface, Sp50BuildingMetadata, Sp50ConstructionType, WallLayer } from "../../../entities/geometry/types";
import type { EnvelopeElementResult } from "../engineering/types";
import { calculateConstructionResistance, calculateHeatTransferCoefficient } from "./calculations";
import {
  calculateGsop,
  calculateNt,
  getFloorHeatAbsorptionLimit,
  getGateRequiredResistance,
  getHeatingEnergyNorm,
  getInternalHeatTransferCoefficient,
  getExternalHeatTransferCoefficient,
  getInternalVaporPartialPressurePa,
  getLayerAirPermeabilityResistance,
  getMaterialThermalProperties,
  getMoistureMode,
  getNormalizedAirPermeability,
  getOperationCondition,
  getRequiredResistance,
  getSaturationVaporPressurePa,
  getSheetMaterialVaporResistance,
  getSolarAbsorptionCoefficient,
  getSolarRadiation,
  getSpecificThermalProtectionNorm,
} from "../../../norms/sp50_2024/index";
import type {
  Sp50AirPermeabilityCheck,
  Sp50BuildingCheck,
  Sp50CheckStatus,
  Sp50ComplianceReport,
  Sp50ConstructionCheck,
  Sp50EnergyCheck,
  Sp50FloorCheck,
  Sp50LayerResult,
  Sp50MaterialEfficiencyResult,
  Sp50MoistureProtectionCheck,
  Sp50Recommendation,
  Sp50SourceData,
  Sp50TemperatureCheck,
  Sp50TemperaturePoint,
  Sp50TransientCheck,
} from "./types";

interface RunSp50ComplianceOptions {
  model: BuildingModel;
  envelope: EnvelopeElementResult[];
  defaultIndoorTemperatureC: number;
  defaultOutdoorTemperatureC: number;
}

interface DerivedContext {
  sourceData: Sp50SourceData;
  missingData: string[];
  buildingMeta: Sp50BuildingMetadata;
}

interface ResolvedEnvelopeResults {
  results: EnvelopeElementResult[];
  warnings: string[];
}

export function runSP50Compliance(
  buildingModel: BuildingModel,
  climateInput: Partial<NonNullable<Sp50BuildingMetadata["climate"]>> | undefined,
  options: {
    envelope?: EnvelopeElementResult[];
    defaultIndoorTemperatureC?: number;
    defaultOutdoorTemperatureC?: number;
  } = {}
): Sp50ComplianceReport {
  const model: BuildingModel = climateInput
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

export function runSp50ComplianceAnalysis(input: RunSp50ComplianceOptions): Sp50ComplianceReport {
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

function resolveSourceData(model: BuildingModel, defaultIndoorTemperatureC: number, defaultOutdoorTemperatureC: number): DerivedContext {
  const buildingMeta = model.thermalProtection ?? {};
  const climate = buildingMeta.climate ?? {};
  const heatedAreaM2 =
    buildingMeta.heatedAreaM2 ??
    model.rooms.reduce((sum, room) => sum + polygonArea(room.polygon), 0);
  const averageHeight =
    model.levels.reduce((sum, level) => sum + level.height_m, 0) / Math.max(model.levels.length, 1);
  const heatedVolumeM3 = buildingMeta.heatedVolumeM3 ?? heatedAreaM2 * averageHeight;
  const indoorTemperatureC = climate.indoorTemperatureC ?? defaultIndoorTemperatureC;
  const outdoorHeatingPeriodAverageC = climate.outdoorHeatingPeriodAverageC ?? null;
  const heatingPeriodDurationDays = climate.heatingPeriodDurationDays ?? null;
  const indoorRelativeHumidityPercent = climate.indoorRelativeHumidityPercent ?? 55;
  const humidityZone = climate.humidityZone ?? null;
  const moistureMode = buildingMeta.moistureMode ?? getMoistureMode({ indoorTemperature: indoorTemperatureC, relativeHumidity: indoorRelativeHumidityPercent });
  const operationCondition =
    buildingMeta.operationCondition ??
    (humidityZone ? getOperationCondition({ moistureMode, humidityZone }) : null);
  const gsop =
    outdoorHeatingPeriodAverageC !== null && heatingPeriodDurationDays !== null
      ? calculateGsop({
          indoorTemperatureC,
          outdoorHeatingPeriodAverageC,
          heatingPeriodDurationDays,
        })
      : null;
  const missingData: string[] = [];

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
      outdoorDesignTemperatureC: climate.outdoorDesignTemperatureC ?? defaultOutdoorTemperatureC,
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

function resolveEnvelopeResults(
  model: BuildingModel,
  explicitEnvelope: EnvelopeElementResult[],
  context: DerivedContext
): ResolvedEnvelopeResults {
  const results = [...explicitEnvelope];
  const warnings: string[] = [];
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

function normalizeEnvelopeSurfaces(model: BuildingModel, includeAllElements: boolean): { surfaces: EnvelopeSurface[]; warnings: string[] } {
  const surfaces: EnvelopeSurface[] = [];
  const warnings: string[] = [];
  const fragmentDefaults = model.thermalProtection?.envelope ?? [];
  const defaultLayersFor = (constructionType: Sp50ConstructionType): WallLayer[] | undefined =>
    fragmentDefaults.find((fragment) => fragment.constructionType === constructionType || (constructionType === "covering" && fragment.constructionType === "roof"))?.layers?.map((layer) => ({ ...layer }));

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
    let areaMode: "projection" | "slope-adjusted" = "projection";
    const assumptions: string[] = [];
    if (roof.kind === "pitched") {
      if (roof.slope && Number.isFinite(roof.slope.risePerMeter)) {
        area *= Math.sqrt(1 + roof.slope.risePerMeter ** 2);
        areaMode = "slope-adjusted";
      } else {
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
    const constructionType =
      slab.kind === "attic"
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

function buildEnvelopeResultFromSurface(
  surface: EnvelopeSurface,
  model: BuildingModel,
  context: DerivedContext
): EnvelopeElementResult {
  const operationCondition = context.sourceData.operationCondition ?? "A";
  const layerDetails = buildLayerResults(surface.layers, operationCondition);
  const internalAlpha = getInternalHeatTransferCoefficient(mapConstructionToSurface(surface.constructionType));
  const externalAlpha =
    getExternalHeatTransferCoefficient(mapConstructionToSurface(surface.constructionType)) ??
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

function buildConstructionChecks(
  model: BuildingModel,
  envelope: EnvelopeElementResult[],
  context: DerivedContext
): Sp50ConstructionCheck[] {
  return envelope.map((entry) => {
    const constructionType = entry.constructionType ?? mapEnvelopeKindToConstructionType(entry.kind);
    const fragment = (model.thermalProtection?.envelope ?? []).find((candidate) => candidate.id === entry.id) ?? null;
    const indoorTemperatureC = entry.internalTemperatureC ?? context.sourceData.indoorTemperatureC ?? 20;
    const outdoorTemperatureC = entry.boundaryTemperatureC ?? context.sourceData.outdoorDesignTemperatureC ?? -20;
    const nt =
      context.sourceData.outdoorHeatingPeriodAverageC === null || context.sourceData.indoorTemperatureC === null
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
    const requiredResistanceBase =
      constructionType === "gate"
        ? getGateRequiredResistance("insulated")
        : context.sourceData.gsop !== null && context.sourceData.buildingCategory
          ? getRequiredResistance({
              buildingCategory: context.sourceData.buildingCategory,
              constructionType,
              gsop: context.sourceData.gsop,
            })
          : null;
    const requiredResistance = requiredResistanceBase !== null ? requiredResistanceBase * mp : null;
    const reducedResistance = buildReducedResistance(actualResistance, entry.areaM2, wall?.layers, indoorTemperatureC, outdoorTemperatureC, constructionType);
    const margin = actualResistance !== null && requiredResistance !== null ? actualResistance - requiredResistance : null;
    const dewPointTemperatureC = computeDewPointApproximation(indoorTemperatureC, context.sourceData.indoorRelativeHumidityPercent ?? 55);
    const internalSurfaceTemperatureC =
      actualResistance !== null
        ? indoorTemperatureC - (indoorTemperatureC - outdoorTemperatureC) * (1 / Math.max(actualResistance * (entry.uValue_W_m2K || 1), 1))
        : null;
    const temperatureProfile = buildTemperatureProfile(layers, indoorTemperatureC, outdoorTemperatureC, constructionType);
    const homogeneityCoefficient =
      actualResistance !== null && reducedResistance !== null && actualResistance > 0 ? reducedResistance / actualResistance : null;
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
      explanation:
        margin === null
          ? "Недостаточно нормативных данных для полной проверки."
          : margin >= 0
            ? "Фактическое сопротивление не ниже нормируемого."
            : "Фактическое сопротивление ниже нормируемого.",
      internalSurfaceTemperatureC,
      dewPointTemperatureC,
      condensationRisk:
        internalSurfaceTemperatureC !== null && dewPointTemperatureC !== null ? internalSurfaceTemperatureC < dewPointTemperatureC : null,
      riskZones: fragment?.riskZones?.length ? fragment.riskZones : inferRiskZones(constructionType),
      temperatureProfile,
      contribution_W_K: reducedResistance ? (nt * entry.areaM2) / Math.max(reducedResistance, 1e-6) : null,
      homogeneityCoefficient,
    };
  });
}

function buildBuildingCheck(constructions: Sp50ConstructionCheck[], context: DerivedContext): Sp50BuildingCheck {
  const heatedVolume = context.sourceData.heatedVolumeM3;
  const totalArea = constructions.reduce((sum, entry) => sum + entry.areaM2, 0);
  const totalContribution = constructions.reduce((sum, entry) => sum + (entry.contribution_W_K ?? 0), 0);
  const kob = heatedVolume ? totalContribution / heatedVolume : null;
  const kOverall = totalArea > 0 ? totalContribution / totalArea : null;
  const compactness = heatedVolume ? totalArea / heatedVolume : null;
  const kobNorm =
    context.sourceData.gsop !== null && heatedVolume
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

function buildTemperatureCheck(constructions: Sp50ConstructionCheck[]): Sp50TemperatureCheck {
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

function buildTransientCheck(constructions: Sp50ConstructionCheck[], context: DerivedContext): Sp50TransientCheck {
  const inertiaLayers = constructions.flatMap((entry) =>
    entry.layers.map((layer) =>
      layer.resistance_m2K_W !== null && layer.heatAbsorption_W_m2K !== null
        ? layer.resistance_m2K_W * layer.heatAbsorption_W_m2K
        : 0
    )
  );
  const thermalInertia = inertiaLayers.reduce((sum, value) => sum + value, 0) / Math.max(constructions.length, 1);
  const july = context.buildingMeta.climate?.julyAverageTemperatureC ?? null;
  const summerAmplitude = context.buildingMeta.climate?.summerOutdoorAmplitudeC ?? null;
  const wind = context.buildingMeta.climate?.summerWindSpeedM_s ?? null;
  const summerAlpha = wind !== null ? 1.16 * (5 + 10 * Math.sqrt(Math.max(wind, 0))) : null;
  const radiation =
    context.buildingMeta.climate?.solarRadiationImax_W_m2 !== undefined &&
    context.buildingMeta.climate?.solarRadiationIavg_W_m2 !== undefined
      ? {
          Imax_W_m2: context.buildingMeta.climate.solarRadiationImax_W_m2,
          Iavg_W_m2: context.buildingMeta.climate.solarRadiationIavg_W_m2,
        }
      : getSolarRadiation(context.buildingMeta.climate?.solarRadiationZone ?? "central");
  const rho = getSolarAbsorptionCoefficient("mediumFacade") ?? 0.65;
  const requiredAmplitude = july !== null ? 2.5 - 0.1 * (july - 21) : null;
  const externalAmplitude =
    summerAmplitude !== null && summerAlpha !== null && radiation ? summerAmplitude + (0.5 * rho * (radiation.Imax_W_m2 - radiation.Iavg_W_m2)) / summerAlpha : null;
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

function buildAirPermeabilityCheck(constructions: Sp50ConstructionCheck[], context: DerivedContext): Sp50AirPermeabilityCheck {
  const indoorTemperature = context.sourceData.indoorTemperatureC;
  const outdoorTemperature = context.sourceData.outdoorDesignTemperatureC;
  const height = context.buildingMeta.storeys ? context.buildingMeta.storeys * 3 : null;
  const wind = context.buildingMeta.climate?.summerWindSpeedM_s ?? 4;
  const gammaIndoor = indoorTemperature !== null ? 3463 / (273 + indoorTemperature) : null;
  const gammaOutdoor = outdoorTemperature !== null ? 3463 / (273 + outdoorTemperature) : null;
  const pressureDifference =
    gammaIndoor !== null && gammaOutdoor !== null && height !== null
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

function buildMoistureProtectionCheck(constructions: Sp50ConstructionCheck[], context: DerivedContext): Sp50MoistureProtectionCheck {
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

function buildFloorCheck(constructions: Sp50ConstructionCheck[], context: DerivedContext): Sp50FloorCheck {
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

function buildEnergyCheck(building: Sp50BuildingCheck, context: DerivedContext): Sp50EnergyCheck {
  const gsop = context.sourceData.gsop;
  const volume = context.sourceData.heatedVolumeM3;
  const area = context.sourceData.heatedAreaM2;
  const tIndoor = context.sourceData.indoorTemperatureC;
  const tOutdoor = context.sourceData.outdoorHeatingPeriodAverageC;
  const betaV = 0.85;
  const Lvent = 1;
  const nVent = 1;
  const kEf = 0;
  const Ginf = 1;
  const nInf = 1;
  const c = 1;
  const averageAirDensity = tOutdoor !== null ? 353 / (273 + tOutdoor) : null;
  const averageAirExchange =
    volume && averageAirDensity
      ? ((Lvent * nVent) / 168 + (Ginf * nInf) / (168 * averageAirDensity)) / (betaV * volume)
      : null;
  const kVent =
    volume && averageAirDensity
      ? (0.28 * c * (Lvent * averageAirDensity * nVent * (1 - kEf) + Ginf * nInf)) / (168 * volume)
      : null;
  const deltaT = tIndoor !== null && tOutdoor !== null ? tIndoor - tOutdoor : null;
  const qbyt =
    volume && deltaT && deltaT > 0
      ? ((context.buildingMeta.residentialAreaM2 ?? area ?? 0) * 17) / (volume * deltaT)
      : null;
  const qrad = volume && gsop ? (11.6 * ((context.buildingMeta.climate?.solarRadiationIavg_W_m2 ?? 0) * 0.001)) / (volume * gsop) : 0;
  const betaKpi = averageAirExchange !== null ? 1 / (1 + 0.5 * averageAirExchange) : null;
  const qHeatingCharacteristic =
    building.kob_W_m3K !== null && kVent !== null && betaKpi !== null
      ? building.kob_W_m3K + kVent - betaKpi * ((qbyt ?? 0) + qrad)
      : null;
  const annualHeatingEnergy = gsop && volume && qHeatingCharacteristic !== null ? 0.024 * gsop * volume * qHeatingCharacteristic : null;
  const annualTotalLosses = gsop && volume && building.kob_W_m3K !== null && kVent !== null ? 0.024 * gsop * volume * (building.kob_W_m3K + kVent) : null;
  const qByArea = annualHeatingEnergy !== null && area ? annualHeatingEnergy / area : null;
  const qByVolume = annualHeatingEnergy !== null && volume ? annualHeatingEnergy / volume : null;
  const qNorm = getHeatingEnergyNorm(context.sourceData.buildingCategory ?? undefined, context.sourceData.storeys ?? undefined);
  const complies = qByArea !== null && qNorm !== null ? qByArea <= qNorm : null;
  return {
    qHeatingCharacteristic_W_m3K: qHeatingCharacteristic,
    qHeatingNorm_kWh_m2: qNorm,
    annualHeatingEnergy_kWh: annualHeatingEnergy,
    annualTotalLosses_kWh: annualTotalLosses,
    qByArea_kWh_m2: qByArea,
    qByVolume_kWh_m3: qByVolume,
    betaGainUseFactor: betaKpi,
    ventilationCharacteristic_W_m3K: kVent,
    internalGainCharacteristic_W_m3K: qbyt,
    solarGainCharacteristic_W_m3K: qrad,
    averageAirDensity_kg_m3: averageAirDensity,
    averageAirExchange_1_h: averageAirExchange,
    complies,
    status: resolveStatus(complies),
  };
}

function buildMaterialEfficiency(constructions: Sp50ConstructionCheck[]): Sp50MaterialEfficiencyResult[] {
  const seen = new Set<string>();
  const results: Sp50MaterialEfficiencyResult[] = [];
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

function buildRecommendations(
  constructions: Sp50ConstructionCheck[],
  building: Sp50BuildingCheck,
  energy: Sp50EnergyCheck,
  temperature: Sp50TemperatureCheck
): Sp50Recommendation[] {
  const recommendations: Sp50Recommendation[] = [];
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

function buildLayerResults(layers: WallLayer[] | undefined, operationCondition: "A" | "B"): Sp50LayerResult[] {
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

function buildTemperatureProfile(
  layers: Sp50LayerResult[],
  indoorTemperatureC: number,
  outdoorTemperatureC: number,
  constructionType: Sp50ConstructionType
): Sp50TemperaturePoint[] {
  const alphaIn = getInternalHeatTransferCoefficient(mapConstructionToSurface(constructionType));
  const alphaOut = getExternalHeatTransferCoefficient(mapConstructionToSurface(constructionType)) ?? 23;
  const resistances = [1 / alphaIn, ...layers.map((layer) => layer.resistance_m2K_W ?? 0), 1 / alphaOut];
  const totalResistance = resistances.reduce((sum, value) => sum + value, 0);
  let position = 0;
  let cumulativeResistance = 0;
  const points: Sp50TemperaturePoint[] = [{ positionM: 0, temperatureC: indoorTemperatureC, label: "Внутренний воздух" }];
  layers.forEach((layer, index) => {
    cumulativeResistance += index === 0 ? resistances[0] : 0;
    cumulativeResistance += layer.resistance_m2K_W ?? 0;
    position += layer.thicknessM;
    points.push({
      positionM: position,
      temperatureC: indoorTemperatureC - ((indoorTemperatureC - outdoorTemperatureC) * cumulativeResistance) / Math.max(totalResistance, 1e-9),
      label: layer.materialLabel,
    });
  });
  points.push({ positionM: position, temperatureC: outdoorTemperatureC, label: "Наружный воздух" });
  return points;
}

function buildReducedResistance(
  actualResistance: number | null,
  areaM2: number,
  layers: WallLayer[] | undefined,
  indoorTemperatureC: number,
  outdoorTemperatureC: number,
  constructionType: Sp50ConstructionType
): number | null {
  void areaM2;
  void layers;
  void indoorTemperatureC;
  void outdoorTemperatureC;
  void constructionType;
  return actualResistance;
}

function calculateFloorHeatAbsorption(layers: Sp50LayerResult[]): number | null {
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

function sumAirResistance(layers: Sp50LayerResult[]): number | null {
  const values = layers
    .map((layer) => getLayerAirPermeabilityResistance(layer.materialId))
    .filter(isFiniteNumber);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function sumVaporResistance(layers: Sp50LayerResult[]): number | null {
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

function inferRiskZones(constructionType: Sp50ConstructionType): string[] {
  if (constructionType === "window") {
    return ["примыкания окон", "оконные откосы"];
  }
  if (constructionType === "door") {
    return ["примыкания дверей"];
  }
  return ["внешние углы", "теплопроводные включения", "переходы к грунту"];
}

function mapConstructionTypeToEnvelopeKind(constructionType: Sp50ConstructionType): EnvelopeElementResult["kind"] {
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

function resolveOrientation(constructionType: Sp50ConstructionType): string | null {
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

function mapConstructionToSurface(constructionType: Sp50ConstructionType) {
  switch (constructionType) {
    case "roof":
    case "covering":
      return "roof" as const;
    case "atticFloor":
      return "atticFloor" as const;
    case "floorOverBasement":
    case "floorOnGround":
      return "floorOverBasement" as const;
    case "window":
      return "window" as const;
    case "lantern":
      return "lantern" as const;
    case "door":
      return "door" as const;
    case "gate":
      return "gate" as const;
    default:
      return "wall" as const;
  }
}

function mapEnvelopeKindToConstructionType(kind: string): Sp50ConstructionType {
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

function computeDewPointApproximation(temperatureC: number, relativeHumidityPercent: number): number {
  const gamma = Math.log(relativeHumidityPercent / 100) + (17.27 * temperatureC) / (237.7 + temperatureC);
  return (237.7 * gamma) / (17.27 - gamma);
}

function polygonArea(points: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function findWallByEnvelopeLabel(model: BuildingModel, envelopeId: string) {
  const wallId = envelopeId.replace(/^(wall|window|door)-/, "");
  return model.walls.find((wall) => wall.id === wallId);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveStatus(complies: boolean | null): Sp50CheckStatus {
  if (complies === null) {
    return "insufficient_data";
  }
  return complies ? "pass" : "fail";
}
