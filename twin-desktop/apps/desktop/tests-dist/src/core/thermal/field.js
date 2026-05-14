import { pointToSegmentDistance, polygonContainsPoint } from "../../entities/geometry/geom";
import { buildGeometryRenderModel } from "../geometry/bimPipeline";
import { getDefaultSurfaceResistanceProfile } from "../../norms/sp50_2024/heatTransferCoefficients";
import { buildThermalPhysicsModel, } from "./physics";
const DEFAULT_EXTERNAL_DECAY_M = 1.65;
const MIN_ROOM_SAMPLE_STEP_M = 0.18;
const MAX_ROOM_SAMPLE_STEP_M = 0.48;
const MAX_ROOM_SAMPLES = 160;
const DEFAULT_SMOOTHING_RADIUS_M = 0.12;
const MIN_DETAIL_SCALE = 0.55;
const MAX_DETAIL_SCALE = 1.4;
const MAX_SOURCE_GAIN_C = 8.6;
const MAX_WALL_COOLING_C = 5.2;
const MIN_WALL_INTERACTION_M = 0.35;
const DEFAULT_SURFACE_RESISTANCE = getDefaultSurfaceResistanceProfile();
const INTERNAL_SURFACE_RESISTANCE = DEFAULT_SURFACE_RESISTANCE.internal_m2K_W;
const EXTERNAL_SURFACE_RESISTANCE = DEFAULT_SURFACE_RESISTANCE.external_m2K_W;
const INTERNAL_COUPLING_SURFACE_RESISTANCE = 0.17;
const roomSampleCache = new Map();
export function createThermalFieldModel(model, options, renderGeometry = buildGeometryRenderModel(model), physics = buildThermalPhysicsModel(model, {
    ...options,
    fixedRoomTemperaturesC: options.roomTemperaturesC,
}, renderGeometry)) {
    const detailScale = clamp(options.detailScale ?? 1, MIN_DETAIL_SCALE, MAX_DETAIL_SCALE);
    const rooms = renderGeometry.roomVolumes.map((room) => createThermalRoom(room, physics.roomBalances.get(room.roomId), detailScale));
    const roomMap = new Map(rooms.map((room) => [room.roomId, room]));
    const sources = buildHeatSources(model, rooms, physics);
    const sourcesByLevel = groupByLevel(sources);
    const boundaries = buildFieldBoundaries(physics, options.outdoorTemperatureC);
    const boundariesByLevel = groupByLevel(boundaries);
    const boundaryByWallId = new Map(boundaries.map((boundary) => [boundary.wallId, boundary]));
    const field = {
        outdoorTemperatureC: options.outdoorTemperatureC,
        physics,
        renderGeometry,
        rooms,
        roomMap,
        sources,
        sourcesByLevel,
        boundaries,
        boundariesByLevel,
        boundaryByWallId,
        minTemperatureC: options.outdoorTemperatureC,
        maxTemperatureC: Math.max(options.outdoorTemperatureC, ...rooms.map((room) => room.baseTemperatureC)),
    };
    rooms.forEach((room) => {
        const points = room.samplePoints.length ? room.samplePoints : [room.centroid];
        const averageEffect = points.reduce((sum, point) => sum + computeLocalTemperatureEffect(field, room, point), 0) / points.length;
        room.normalizationBiasC = clamp(averageEffect * 0.72, -2.4, 2.8);
    });
    const allSamples = [];
    rooms.forEach((room) => {
        room.samplePoints.forEach((point) => {
            allSamples.push(sampleThermalFieldAtPoint(field, room.levelId, point));
        });
        allSamples.push(sampleSmoothedThermalFieldAtPoint(field, room.levelId, room.centroid));
    });
    sources.forEach((source) => {
        allSamples.push(sampleSmoothedThermalFieldAtPoint(field, source.levelId, source.position, source.decayM * 0.12));
    });
    boundaries.forEach((boundary) => {
        const surfaces = sampleWallSurfaceTemperatures(field, boundary.wallId);
        if (surfaces) {
            allSamples.push(surfaces.averageC, surfaces.positiveSideC, surfaces.negativeSideC);
        }
    });
    field.minTemperatureC = allSamples.length ? Math.min(...allSamples) : options.outdoorTemperatureC;
    field.maxTemperatureC = allSamples.length ? Math.max(...allSamples) : Math.max(options.outdoorTemperatureC, ...rooms.map((room) => room.baseTemperatureC));
    return field;
}
export function sampleThermalFieldAtPoint(field, levelId, point) {
    const room = resolveRoomAtPoint(field.rooms, levelId, point);
    if (!room) {
        return field.outdoorTemperatureC;
    }
    const effect = computeLocalTemperatureEffect(field, room, point);
    const rawTemperature = room.baseTemperatureC + effect - room.normalizationBiasC;
    const outdoorDeltaC = Math.max(0, room.baseTemperatureC - field.outdoorTemperatureC);
    const lowerBound = room.baseTemperatureC - clamp(outdoorDeltaC * 0.32, 2.4, 7.2);
    const upperBound = room.baseTemperatureC + Math.max(3.2, room.heatingDeliveredW > 0 ? 6.8 : 4.2);
    return clamp(rawTemperature, lowerBound, upperBound);
}
export function sampleSmoothedThermalFieldAtPoint(field, levelId, point, radiusM = DEFAULT_SMOOTHING_RADIUS_M) {
    const offsets = [
        { x: 0, y: 0, weight: 0.3 },
        { x: radiusM, y: 0, weight: 0.12 },
        { x: -radiusM, y: 0, weight: 0.12 },
        { x: 0, y: radiusM, weight: 0.12 },
        { x: 0, y: -radiusM, weight: 0.12 },
        { x: radiusM * 0.78, y: radiusM * 0.78, weight: 0.055 },
        { x: radiusM * 0.78, y: -radiusM * 0.78, weight: 0.055 },
        { x: -radiusM * 0.78, y: radiusM * 0.78, weight: 0.055 },
        { x: -radiusM * 0.78, y: -radiusM * 0.78, weight: 0.055 },
    ];
    let weightedSum = 0;
    let totalWeight = 0;
    offsets.forEach(({ x, y, weight }) => {
        weightedSum += sampleThermalFieldAtPoint(field, levelId, { x: point.x + x, y: point.y + y }) * weight;
        totalWeight += weight;
    });
    return totalWeight > 0 ? weightedSum / totalWeight : sampleThermalFieldAtPoint(field, levelId, point);
}
export function sampleWallSurfaceTemperatures(field, wallId) {
    const boundary = field.boundaryByWallId.get(wallId);
    if (!boundary) {
        return null;
    }
    const positiveRoomTemp = boundary.positiveRoomId !== null ? field.roomMap.get(boundary.positiveRoomId)?.baseTemperatureC ?? field.outdoorTemperatureC : field.outdoorTemperatureC;
    const negativeRoomTemp = boundary.negativeRoomId !== null ? field.roomMap.get(boundary.negativeRoomId)?.baseTemperatureC ?? field.outdoorTemperatureC : field.outdoorTemperatureC;
    const positiveSourceBoostC = computeWallSourceBoost(field, boundary, boundary.positiveRoomId);
    const negativeSourceBoostC = computeWallSourceBoost(field, boundary, boundary.negativeRoomId);
    const bridgePenaltyC = clamp(boundary.bridgeFactor * 0.35 + (boundary.windowAreaM2 + boundary.doorAreaM2) * 0.18, 0.08, 1.35);
    if (boundary.kind === "internal") {
        const totalResistance = INTERNAL_COUPLING_SURFACE_RESISTANCE * 2 + boundary.effectiveR_m2K_W;
        const heatFlux = (positiveRoomTemp - negativeRoomTemp) / Math.max(0.12, totalResistance);
        const positiveSideC = positiveRoomTemp - heatFlux * INTERNAL_COUPLING_SURFACE_RESISTANCE + positiveSourceBoostC;
        const negativeSideC = negativeRoomTemp + heatFlux * INTERNAL_COUPLING_SURFACE_RESISTANCE + negativeSourceBoostC;
        return {
            positiveSideC,
            negativeSideC,
            averageC: (positiveSideC + negativeSideC) / 2,
        };
    }
    if (boundary.positiveRoomId !== null) {
        const totalResistance = INTERNAL_SURFACE_RESISTANCE + boundary.effectiveR_m2K_W + EXTERNAL_SURFACE_RESISTANCE;
        const solarEquivalentC = boundary.solarGainC * 0.22;
        const heatFlux = (positiveRoomTemp - (field.outdoorTemperatureC + solarEquivalentC)) / Math.max(0.12, totalResistance);
        const positiveSideC = positiveRoomTemp - heatFlux * INTERNAL_SURFACE_RESISTANCE - bridgePenaltyC + positiveSourceBoostC;
        const negativeSideC = field.outdoorTemperatureC + solarEquivalentC + heatFlux * EXTERNAL_SURFACE_RESISTANCE;
        return {
            positiveSideC,
            negativeSideC,
            averageC: (positiveSideC + negativeSideC) / 2,
        };
    }
    if (boundary.negativeRoomId !== null) {
        const totalResistance = INTERNAL_SURFACE_RESISTANCE + boundary.effectiveR_m2K_W + EXTERNAL_SURFACE_RESISTANCE;
        const solarEquivalentC = boundary.solarGainC * 0.22;
        const heatFlux = (negativeRoomTemp - (field.outdoorTemperatureC + solarEquivalentC)) / Math.max(0.12, totalResistance);
        const negativeSideC = negativeRoomTemp - heatFlux * INTERNAL_SURFACE_RESISTANCE - bridgePenaltyC + negativeSourceBoostC;
        const positiveSideC = field.outdoorTemperatureC + solarEquivalentC + heatFlux * EXTERNAL_SURFACE_RESISTANCE;
        return {
            positiveSideC,
            negativeSideC,
            averageC: (positiveSideC + negativeSideC) / 2,
        };
    }
    return {
        positiveSideC: field.outdoorTemperatureC,
        negativeSideC: field.outdoorTemperatureC,
        averageC: field.outdoorTemperatureC,
    };
}
function computeWallSourceBoost(field, boundary, roomId) {
    if (!roomId) {
        return 0;
    }
    const rawBoost = (field.sourcesByLevel.get(boundary.levelId) ?? []).reduce((sum, source) => {
        if (source.roomId !== roomId) {
            return sum;
        }
        const distanceToWall = pointToSegmentDistance(source.position, boundary.wall.a, boundary.wall.b);
        const influence = Math.exp(-(distanceToWall * distanceToWall) / Math.max(0.22, source.spreadM * source.spreadM * 0.72));
        const factor = source.kind === "radiator" ? 0.28 : source.kind === "pipe" ? 0.14 : source.kind === "equipment" ? 0.1 : 0.04;
        return sum + source.amplitudeC * factor * influence;
    }, 0);
    return clamp(rawBoost, 0, 2.4);
}
function createThermalRoom(room, balance, detailScale) {
    const areaM2 = Math.max(1, room.areaM2);
    return {
        roomId: room.roomId,
        levelId: room.levelId,
        polygon: room.polygon.map((point) => ({ ...point })),
        centroid: { ...room.centroid },
        areaM2,
        volumeM3: balance?.volumeM3 ?? Math.max(3, areaM2 * 3),
        baseTemperatureC: balance?.airTemperatureC ?? 20,
        lightingGainW: balance?.lightingGainW ?? 0,
        occupancyGainW: balance?.occupancyGainW ?? 0,
        equipmentGainW: balance?.equipmentGainW ?? 0,
        pipeGainW: balance?.pipeGainW ?? 0,
        solarGainW: balance?.solarGainW ?? 0,
        heatingDeliveredW: balance?.heatingDeliveredW ?? 0,
        normalizationBiasC: 0,
        samplePoints: buildRoomSamplePoints(room, detailScale),
    };
}
function buildRoomSamplePoints(room, detailScale) {
    const normalizedScale = clamp(detailScale, MIN_DETAIL_SCALE, MAX_DETAIL_SCALE);
    const cacheKey = `${room.roomId}|${normalizedScale.toFixed(2)}|${room.polygon
        .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(";")}`;
    const cached = roomSampleCache.get(cacheKey);
    if (cached) {
        return cached.map((point) => ({ ...point }));
    }
    const bounds = room.polygon.reduce((acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        maxX: Math.max(acc.maxX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxY: Math.max(acc.maxY, point.y),
    }), {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    });
    const samples = [{ ...room.centroid }];
    const step = clamp(Math.sqrt(Math.max(room.areaM2, 1)) / (7.2 * normalizedScale), MIN_ROOM_SAMPLE_STEP_M / normalizedScale, MAX_ROOM_SAMPLE_STEP_M / Math.sqrt(normalizedScale));
    const maxSamples = Math.round(MAX_ROOM_SAMPLES * normalizedScale * 1.25);
    for (let x = bounds.minX + step / 2; x < bounds.maxX && samples.length < maxSamples; x += step) {
        for (let y = bounds.minY + step / 2; y < bounds.maxY && samples.length < maxSamples; y += step) {
            const point = { x, y };
            if (polygonContainsPoint(point, room.polygon)) {
                samples.push(point);
            }
        }
    }
    const unique = dedupePoints(samples);
    roomSampleCache.set(cacheKey, unique.map((point) => ({ ...point })));
    if (roomSampleCache.size > 96) {
        const oldestKey = roomSampleCache.keys().next().value;
        if (oldestKey) {
            roomSampleCache.delete(oldestKey);
        }
    }
    return unique;
}
function buildHeatSources(model, rooms, physics) {
    const sources = [];
    model.equipment.forEach((item) => {
        if (item.state !== "on") {
            return;
        }
        const room = resolveRoomAtPoint(rooms, item.levelId, item.position) ?? (item.roomId ? rooms.find((entry) => entry.roomId === item.roomId) ?? null : null);
        const roomArea = room?.areaM2 ?? 16;
        const balance = room ? physics.roomBalances.get(room.roomId) : null;
        let powerW = 0;
        let amplitudeC = 0;
        let decayM = 1.2;
        let spreadM = 1.8;
        let kind = "equipment";
        switch (item.type) {
            case "radiator": {
                const nominal = typeof item.params.nominalPowerW === "number" && item.params.nominalPowerW > 0 ? item.params.nominalPowerW : 1400;
                const deliveredFactor = balance && balance.heatingCapacityW > 0 ? balance.heatingDeliveredW / balance.heatingCapacityW : 1;
                powerW = nominal * clamp(deliveredFactor || 0.8, 0.2, 1);
                amplitudeC = clamp((powerW / Math.max(220, roomArea * 26)) * 1.18, 1.1, 7.2);
                decayM = clamp(Math.sqrt(roomArea) * 0.26, 0.75, 2.9);
                spreadM = decayM * 1.85;
                kind = "radiator";
                break;
            }
            case "fancoil": {
                const nominal = typeof item.params.nominalPowerW === "number" && item.params.nominalPowerW > 0 ? item.params.nominalPowerW : 900;
                powerW = nominal * 0.65;
                amplitudeC = clamp((powerW / Math.max(260, roomArea * 30)) * 0.98, 0.7, 5.4);
                decayM = clamp(Math.sqrt(roomArea) * 0.22, 0.55, 2.2);
                spreadM = decayM * 1.55;
                kind = "equipment";
                break;
            }
            case "ahu":
            case "pump":
            case "boiler":
            case "diffuser":
            case "sensor": {
                const nominal = typeof item.params.nominalPowerW === "number" && item.params.nominalPowerW > 0
                    ? item.params.nominalPowerW
                    : item.type === "pump"
                        ? 90
                        : item.type === "boiler"
                            ? 220
                            : item.type === "ahu"
                                ? 280
                                : item.type === "diffuser"
                                    ? 45
                                    : 8;
                powerW = nominal;
                amplitudeC = clamp(powerW / Math.max(520, roomArea * 82), 0.05, item.type === "boiler" ? 1.8 : 1.25);
                decayM = clamp(Math.sqrt(roomArea) * 0.18, 0.45, 1.8);
                spreadM = decayM * 1.4;
                kind = "equipment";
                break;
            }
            default:
                break;
        }
        if (powerW <= 0 || amplitudeC <= 0) {
            return;
        }
        sources.push({
            id: item.id,
            kind,
            levelId: item.levelId,
            roomId: room?.roomId ?? item.roomId,
            position: { ...item.position },
            powerW,
            amplitudeC,
            decayM,
            spreadM,
        });
    });
    model.pipes.forEach((pipe) => {
        if (pipe.path.length < 2) {
            return;
        }
        pipe.path.slice(1).forEach((point, index) => {
            const start = pipe.path[index];
            const center = { x: (start.x + point.x) / 2, y: (start.y + point.y) / 2 };
            const room = resolveRoomAtPoint(rooms, pipe.levelId, center);
            if (!room) {
                return;
            }
            const length = Math.hypot(point.x - start.x, point.y - start.y);
            const deltaFactor = Math.max(0, pipe.fluidTemperatureC - room.baseTemperatureC) / 24;
            const typeFactor = pipe.type === "heating_supply" ? 1 : pipe.type === "heating_return" ? 0.55 : 0.18;
            const powerW = length * 16 * deltaFactor * typeFactor;
            if (powerW <= 0) {
                return;
            }
            sources.push({
                id: `${pipe.id}:${index}`,
                kind: "pipe",
                levelId: pipe.levelId,
                roomId: room.roomId,
                position: center,
                powerW,
                amplitudeC: clamp(powerW / Math.max(420, room.areaM2 * 86), 0.05, 1.1),
                decayM: 0.55,
                spreadM: 0.95,
            });
        });
    });
    return sources;
}
function buildFieldBoundaries(physics, outdoorTemperatureC) {
    return physics.surfaces.map((surface) => {
        const positiveRoom = surface.positiveRoomId ? physics.roomBalances.get(surface.positiveRoomId) ?? null : null;
        const negativeRoom = surface.negativeRoomId ? physics.roomBalances.get(surface.negativeRoomId) ?? null : null;
        const positiveCoolingC = surface.kind === "external" && positiveRoom
            ? computeExternalCoolingAmplitude(positiveRoom.airTemperatureC, outdoorTemperatureC, surface)
            : 0;
        const negativeCoolingC = surface.kind === "external" && negativeRoom
            ? computeExternalCoolingAmplitude(negativeRoom.airTemperatureC, outdoorTemperatureC, surface)
            : 0;
        const internalMixC = surface.kind === "internal" && positiveRoom && negativeRoom
            ? clamp(Math.abs(positiveRoom.airTemperatureC - negativeRoom.airTemperatureC) * 0.24 + surface.conductance_W_K / Math.max(80, surface.wallAreaM2 * 30), 0.08, 0.85)
            : 0;
        const solarGainC = surface.windowAreaM2 > 0 ? clamp(surface.solarGainW / Math.max(100, surface.wallAreaM2 * 24), 0, 2.6) : 0;
        return {
            wallId: surface.wallId,
            wall: surface.wall,
            levelId: surface.levelId,
            kind: surface.kind,
            positiveRoomId: surface.positiveRoomId,
            negativeRoomId: surface.negativeRoomId,
            orientation: surface.orientation,
            effectiveU_W_m2K: surface.effectiveU_W_m2K,
            effectiveR_m2K_W: surface.effectiveR_m2K_W,
            conductance_W_K: surface.conductance_W_K,
            windowAreaM2: surface.windowAreaM2,
            doorAreaM2: surface.doorAreaM2,
            opaqueAreaM2: surface.opaqueAreaM2,
            bridgeFactor: surface.bridgeFactor,
            positiveCoolingC,
            negativeCoolingC,
            internalMixC,
            solarGainC,
        };
    });
}
function computeLocalTemperatureEffect(field, room, point) {
    const rawSourceGain = (field.sourcesByLevel.get(room.levelId) ?? []).reduce((sum, source) => {
        const distance = Math.hypot(source.position.x - point.x, source.position.y - point.y);
        const roomFactor = source.roomId === room.roomId ? 1 : source.roomId ? 0.08 : 0.18;
        const primary = Math.exp(-distance / Math.max(0.3, source.decayM));
        const secondary = Math.exp(-(distance * distance) / Math.max(0.28, source.spreadM * source.spreadM));
        const kindBoost = source.kind === "radiator"
            ? 1.15
            : source.kind === "pipe"
                ? 0.7
                : source.kind === "occupant"
                    ? 0.35
                    : source.kind === "lighting"
                        ? 0.28
                        : 0.55;
        return sum + source.amplitudeC * roomFactor * (primary * 0.62 + secondary * 0.38) * kindBoost;
    }, 0);
    const sourceGain = MAX_SOURCE_GAIN_C * (1 - Math.exp(-rawSourceGain / MAX_SOURCE_GAIN_C));
    let wallInfluence = 0;
    (field.boundariesByLevel.get(room.levelId) ?? []).forEach((boundary) => {
        const distance = pointToSegmentDistance(point, boundary.wall.a, boundary.wall.b);
        const decay = smoothBoundaryDecay(distance, Math.max(DEFAULT_EXTERNAL_DECAY_M, boundary.wall.thickness_m * 5.2));
        if (boundary.kind === "external") {
            if (boundary.positiveRoomId === room.roomId) {
                const openingBoost = 1 + (boundary.windowAreaM2 * 1.15 + boundary.doorAreaM2 * 0.75) / Math.max(0.5, boundary.opaqueAreaM2 + boundary.windowAreaM2 + boundary.doorAreaM2);
                wallInfluence -= Math.min(MAX_WALL_COOLING_C, boundary.positiveCoolingC * decay * openingBoost);
                wallInfluence += boundary.solarGainC * decay * (boundary.windowAreaM2 > 0 ? 0.72 : 0.18);
            }
            else if (boundary.negativeRoomId === room.roomId) {
                const openingBoost = 1 + (boundary.windowAreaM2 * 1.15 + boundary.doorAreaM2 * 0.75) / Math.max(0.5, boundary.opaqueAreaM2 + boundary.windowAreaM2 + boundary.doorAreaM2);
                wallInfluence -= Math.min(MAX_WALL_COOLING_C, boundary.negativeCoolingC * decay * openingBoost);
                wallInfluence += boundary.solarGainC * decay * (boundary.windowAreaM2 > 0 ? 0.72 : 0.18);
            }
            if (boundary.windowAreaM2 > 0 || boundary.doorAreaM2 > 0) {
                const bridgePenalty = clamp(boundary.bridgeFactor * 0.24, 0.08, 0.85) * smoothBoundaryDecay(distance, Math.max(0.55, boundary.wall.thickness_m * 2.6));
                wallInfluence -= bridgePenalty;
            }
            return;
        }
        const isPositive = boundary.positiveRoomId === room.roomId;
        const isNegative = boundary.negativeRoomId === room.roomId;
        if (!isPositive && !isNegative) {
            return;
        }
        const otherRoomId = isPositive ? boundary.negativeRoomId : boundary.positiveRoomId;
        const otherTemp = otherRoomId ? field.roomMap.get(otherRoomId)?.baseTemperatureC ?? room.baseTemperatureC : room.baseTemperatureC;
        const delta = otherTemp - room.baseTemperatureC;
        const coupling = delta * boundary.internalMixC * 0.18 * smoothBoundaryDecay(distance, Math.max(MIN_WALL_INTERACTION_M, boundary.wall.thickness_m * 3.1));
        wallInfluence += coupling;
    });
    const perimeterCooling = computePerimeterCooling(room.polygon, point);
    const floorEdgeCooling = 0.18 * Math.exp(-distanceToPolygonEdges(room.polygon, point) / 0.9);
    return sourceGain + wallInfluence - perimeterCooling - floorEdgeCooling;
}
function computeExternalCoolingAmplitude(roomTemperatureC, outdoorTemperatureC, boundary) {
    const delta = Math.max(0, roomTemperatureC - outdoorTemperatureC);
    const conductiveFactor = clamp(boundary.effectiveU_W_m2K * 0.14, 0.1, 0.56);
    const openingBoost = 1 + (boundary.windowAreaM2 * 1.8 + boundary.doorAreaM2 * 1.1) / Math.max(0.5, boundary.opaqueAreaM2 + boundary.windowAreaM2 + boundary.doorAreaM2);
    return delta * conductiveFactor * openingBoost;
}
function resolveRoomAtPoint(rooms, levelId, point) {
    return rooms.find((room) => room.levelId === levelId && polygonContainsPoint(point, room.polygon)) ?? null;
}
function groupByLevel(items) {
    const groups = new Map();
    items.forEach((item) => {
        const group = groups.get(item.levelId) ?? [];
        group.push(item);
        groups.set(item.levelId, group);
    });
    return groups;
}
function dedupePoints(points) {
    const unique = [];
    points.forEach((point) => {
        if (!unique.some((entry) => Math.hypot(entry.x - point.x, entry.y - point.y) <= 0.06)) {
            unique.push(point);
        }
    });
    return unique;
}
function smoothBoundaryDecay(distance, decayM) {
    const normalized = distance / Math.max(0.16, decayM);
    return Math.exp(-(normalized * normalized)) * 0.68 + Math.exp(-normalized) * 0.32;
}
function computePerimeterCooling(polygon, point) {
    return 0.14 * Math.exp(-distanceToPolygonEdges(polygon, point) / 1.15);
}
function distanceToPolygonEdges(polygon, point) {
    if (polygon.length < 2) {
        return 0;
    }
    let minDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < polygon.length; index += 1) {
        const start = polygon[index];
        const end = polygon[(index + 1) % polygon.length];
        minDistance = Math.min(minDistance, pointToSegmentDistance(point, start, end));
    }
    return Number.isFinite(minDistance) ? minDistance : 0;
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
