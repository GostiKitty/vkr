import { polygonArea, polygonContainsPoint, segmentLength } from "../../entities/geometry/geom";
import { DEFAULT_WALL_ASSEMBLY_ID } from "../../entities/material/types";
import { computeWallFacadeConductances } from "./wallFacadeThermal";
import { buildSmartModelSnapshot } from "../networks/intelligence";
import { buildAdjacencyGraph } from "../graph/adjacency";
import { buildGeometryRenderModel, } from "../geometry/bimPipeline";
import { airflowFromACH } from "./formulas";
import { computeSolarPosition } from "../solar/solarPosition";
import { computeFacadeSolarAccessFactor, orientationToAzimuthDeg } from "../solar/solarShading";
import { resolveModelHomogeneityCoefficient } from "../../shared/utils/homogeneityFromModel";
const AIR_DENSITY_KG_M3 = 1.204;
const AIR_CP_J_KG_K = 1005;
const DEFAULT_SETPOINT_C = 21;
const DEFAULT_INFILTRATION_ACH = 0.45;
const DEFAULT_VENTILATION_ACH = 0.18;
const DEFAULT_LIGHTING_W_M2 = 2.6;
const DEFAULT_OCCUPANCY_W_M2 = 1.4;
const DEFAULT_SOLAR_GAIN_FACTOR = 0.4;
const DEFAULT_WIND_FACTOR = 1;
const DEFAULT_RADIATOR_MULTIPLIER = 1;
const DEFAULT_EQUIPMENT_MULTIPLIER = 1;
const MAX_ITERATIONS = 12;
export function buildThermalPhysicsModel(model, options, renderGeometry = buildGeometryRenderModel(model)) {
    const adjacency = buildAdjacencyGraph(model);
    const networkContext = buildThermalNetworkContext(model, options);
    const levelMap = new Map(model.levels.map((level) => [level.id, level]));
    const orientationByWallId = new Map(adjacency.external.map((edge) => [edge.wallId, edge.orientation]));
    const bridgeFactor = resolveBridgeFactor(model);
    const { surfaces, warnings: surfaceWarnings } = buildSurfaceEstimates(renderGeometry, options, orientationByWallId, bridgeFactor);
    const roomSurfaces = new Map();
    surfaces.forEach((surface) => {
        if (surface.positiveRoomId) {
            const list = roomSurfaces.get(surface.positiveRoomId) ?? [];
            list.push(surface);
            roomSurfaces.set(surface.positiveRoomId, list);
        }
        if (surface.negativeRoomId) {
            const list = roomSurfaces.get(surface.negativeRoomId) ?? [];
            list.push(surface);
            roomSurfaces.set(surface.negativeRoomId, list);
        }
    });
    const roomSeeds = renderGeometry.roomVolumes.map((room) => createRoomSeed(model, room, roomSurfaces.get(room.roomId) ?? [], levelMap, options, networkContext));
    const couplingLinks = buildCouplingLinks(surfaces);
    const roomBalances = solveRoomBalances(roomSeeds, couplingLinks, options);
    return {
        renderGeometry,
        roomBalances,
        surfaces,
        roomSurfaces,
        adjacency,
        warnings: surfaceWarnings,
    };
}
function createRoomSeed(model, room, surfaces, levelMap, options, networkContext) {
    const level = levelMap.get(room.levelId);
    const heightM = Math.max(2.4, level?.height_m ?? 3);
    const areaM2 = Math.max(1, Math.abs(room.areaM2 || polygonArea(room.polygon)));
    const volumeM3 = Math.max(3, areaM2 * heightM);
    const lightingGainW = areaM2 * (options.lightingGain_W_m2 ?? DEFAULT_LIGHTING_W_M2);
    const occupancyGainW = areaM2 * (options.occupancyGain_W_m2 ?? DEFAULT_OCCUPANCY_W_M2);
    const equipmentGainW = networkContext.roomEquipmentGainW.get(room.roomId) ?? resolveRoomEquipmentGainW(model, room.roomId, room.levelId, room.polygon, options);
    const pipeGainW = networkContext.roomPipeGainW.get(room.roomId) ?? resolveRoomPipeGainW(model, room.levelId, room.polygon);
    const solarGainW = surfaces.reduce((sum, surface) => {
        if (surface.kind !== "external") {
            return sum;
        }
        if (surface.positiveRoomId === room.roomId || surface.negativeRoomId === room.roomId) {
            return sum + surface.solarGainW;
        }
        return sum;
    }, 0);
    const externalUA_W_K = surfaces.reduce((sum, surface) => {
        if (surface.kind !== "external") {
            return sum;
        }
        if (surface.positiveRoomId === room.roomId || surface.negativeRoomId === room.roomId) {
            return sum + surface.conductance_W_K;
        }
        return sum;
    }, 0);
    const internalCouplingUA_W_K = surfaces.reduce((sum, surface) => {
        if (surface.kind !== "internal") {
            return sum;
        }
        if (surface.positiveRoomId === room.roomId || surface.negativeRoomId === room.roomId) {
            return sum + surface.conductance_W_K;
        }
        return sum;
    }, 0);
    const infiltrationAch = Math.max(0.02, options.infiltrationACH ?? DEFAULT_INFILTRATION_ACH);
    const infiltrationUA_W_K = AIR_DENSITY_KG_M3 * AIR_CP_J_KG_K * airflowFromACH(infiltrationAch, volumeM3);
    const roomSupply = networkContext.roomSupplyAir.get(room.roomId);
    const scheduledVentilationAch = Math.max(0, options.ventilationACH ?? DEFAULT_VENTILATION_ACH);
    const heatRecoveryFactor = Math.min(1, Math.max(0, options.heatRecoveryFactor ?? 0));
    const scheduledVentilationUA_W_K = AIR_DENSITY_KG_M3 * AIR_CP_J_KG_K * airflowFromACH(scheduledVentilationAch, volumeM3) * (1 - heatRecoveryFactor);
    const mechanicalSupplyUA_W_K = roomSupply
        ? AIR_DENSITY_KG_M3 * AIR_CP_J_KG_K * getRoomMechanicalAirflowM3s(roomSupply) * (1 - heatRecoveryFactor)
        : 0;
    const ventilationUA_W_K = infiltrationUA_W_K + scheduledVentilationUA_W_K + mechanicalSupplyUA_W_K;
    const supplyAirTemperatureC = roomSupply?.supplyTemperatureC ?? options.supplyAirTemperatureC ?? options.outdoorTemperatureC;
    return {
        roomId: room.roomId,
        levelId: room.levelId,
        polygon: room.polygon.map((point) => ({ ...point })),
        areaM2,
        volumeM3,
        centroid: { ...room.centroid },
        setpointC: (options.setpointTemperatureC ?? DEFAULT_SETPOINT_C) + networkContext.setpointOffsetC,
        lightingGainW,
        occupancyGainW,
        equipmentGainW,
        pipeGainW,
        solarGainW,
        heatingCapacityW: networkContext.roomHeatingCapacityW.get(room.roomId) ?? resolveRoomHeatingCapacityW(model, room.roomId, room.levelId, room.polygon, options),
        infiltrationUA_W_K,
        mechanicalSupplyUA_W_K,
        supplyAirTemperatureC,
        externalUA_W_K,
        ventilationUA_W_K,
        internalCouplingUA_W_K,
    };
}
function buildSurfaceEstimates(renderGeometry, options, orientationByWallId, bridgeFactor = 1) {
    const warnings = [];
    const surfaces = renderGeometry.walls.map(({ wall, openings }) => {
        const direction = normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
        const normal = { x: -direction.y, y: direction.x };
        const midpoint = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
        const probeDistance = Math.max(0.24, wall.thickness_m * 0.8);
        const positiveRoom = resolveRoomAtPoint(renderGeometry.roomVolumes, wall.levelId, {
            x: midpoint.x + normal.x * probeDistance,
            y: midpoint.y + normal.y * probeDistance,
        });
        const negativeRoom = resolveRoomAtPoint(renderGeometry.roomVolumes, wall.levelId, {
            x: midpoint.x - normal.x * probeDistance,
            y: midpoint.y - normal.y * probeDistance,
        });
        const windFactor = clamp(options.windFactor ?? DEFAULT_WIND_FACTOR, 0.4, 2.4);
        const conductanceMultiplier = positiveRoom && negativeRoom ? 1 : windFactor * bridgeFactor;
        const facade = computeWallFacadeConductances(wall, openings, wall.wallAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID, conductanceMultiplier);
        warnings.push(...facade.warnings);
        const { wallAreaM2, opaqueAreaM2, windowAreaM2, doorAreaM2, weightedU_W_m2K: weightedU } = facade;
        const effectiveR = 1 / Math.max(0.12, weightedU);
        const conductance_W_K = facade.conductanceTotal_W_K;
        const orientation = positiveRoom && negativeRoom ? null : orientationByWallId.get(wall.id) ?? estimateOrientation(wall);
        const solarGainW = computeSolarGainW(windowAreaM2, orientation, options);
        return {
            wallId: wall.id,
            levelId: wall.levelId,
            wall,
            kind: (positiveRoom && negativeRoom ? "internal" : "external"),
            positiveRoomId: positiveRoom?.roomId ?? null,
            negativeRoomId: negativeRoom?.roomId ?? null,
            orientation,
            wallAreaM2,
            opaqueAreaM2,
            windowAreaM2,
            doorAreaM2,
            effectiveU_W_m2K: weightedU * bridgeFactor,
            effectiveR_m2K_W: effectiveR / Math.max(1e-6, bridgeFactor),
            conductance_W_K,
            bridgeFactor,
            solarGainW,
            openingPerimeterM: openings.reduce((sum, opening) => sum + opening.widthM * 2 + opening.heightM * 2, 0),
        };
    });
    return { surfaces, warnings };
}
function solveRoomBalances(roomSeeds, couplingLinks, options) {
    const fixed = options.fixedRoomTemperaturesC ?? {};
    const transientBlend = clamp(options.transientBlend ?? 1, 0.2, 1);
    const roomTemp = new Map();
    roomSeeds.forEach((room) => {
        const fixedTemperature = fixed[room.roomId];
        if (typeof fixedTemperature === "number") {
            roomTemp.set(room.roomId, fixedTemperature);
            return;
        }
        const denominator = room.externalUA_W_K + room.ventilationUA_W_K + room.internalCouplingUA_W_K + 1;
        const passive = (room.lightingGainW + room.occupancyGainW + room.equipmentGainW + room.pipeGainW + room.solarGainW +
            room.externalUA_W_K * options.outdoorTemperatureC +
            room.infiltrationUA_W_K * options.outdoorTemperatureC +
            (room.ventilationUA_W_K - room.infiltrationUA_W_K) * room.supplyAirTemperatureC) /
            denominator;
        roomTemp.set(room.roomId, clamp(passive, options.outdoorTemperatureC - 2, room.setpointC + 4));
    });
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
        roomSeeds.forEach((room) => {
            if (typeof fixed[room.roomId] === "number") {
                return;
            }
            const adjacencyNumerator = couplingLinks.reduce((sum, link) => {
                if (link.roomAId === room.roomId) {
                    return sum + link.conductance_W_K * (roomTemp.get(link.roomBId) ?? room.setpointC);
                }
                if (link.roomBId === room.roomId) {
                    return sum + link.conductance_W_K * (roomTemp.get(link.roomAId) ?? room.setpointC);
                }
                return sum;
            }, 0);
            const denominator = Math.max(1, room.externalUA_W_K + room.ventilationUA_W_K + room.internalCouplingUA_W_K);
            const passiveNumerator = room.lightingGainW +
                room.occupancyGainW +
                room.equipmentGainW +
                room.pipeGainW +
                room.solarGainW +
                room.externalUA_W_K * options.outdoorTemperatureC +
                room.infiltrationUA_W_K * options.outdoorTemperatureC +
                (room.ventilationUA_W_K - room.infiltrationUA_W_K) * room.supplyAirTemperatureC +
                adjacencyNumerator;
            const passiveTemperatureC = passiveNumerator / denominator;
            const requiredHeatingW = Math.max(0, (room.setpointC - passiveTemperatureC) * denominator);
            const heatingDeliveredW = Math.min(room.heatingCapacityW, requiredHeatingW);
            const steadyStateTemperatureC = (passiveNumerator + heatingDeliveredW) / denominator;
            const baseline = passiveTemperatureC * 0.82 + options.outdoorTemperatureC * 0.18;
            const blendedTemperature = baseline + (steadyStateTemperatureC - baseline) * transientBlend;
            roomTemp.set(room.roomId, clamp(blendedTemperature, options.outdoorTemperatureC - 3, room.setpointC + 4.5));
        });
    }
    const balances = new Map();
    roomSeeds.forEach((room) => {
        const airTemperatureC = roomTemp.get(room.roomId) ?? room.setpointC;
        const lossReferenceTemperatureC = room.setpointC;
        const adjacencyExchangeW = couplingLinks.reduce((sum, link) => {
            if (link.roomAId === room.roomId) {
                return sum + link.conductance_W_K * ((roomTemp.get(link.roomBId) ?? airTemperatureC) - airTemperatureC);
            }
            if (link.roomBId === room.roomId) {
                return sum + link.conductance_W_K * ((roomTemp.get(link.roomAId) ?? airTemperatureC) - airTemperatureC);
            }
            return sum;
        }, 0);
        const envelopeLossW = Math.max(0, room.externalUA_W_K * (lossReferenceTemperatureC - options.outdoorTemperatureC));
        const infiltrationLossW = Math.max(0, room.infiltrationUA_W_K * (lossReferenceTemperatureC - options.outdoorTemperatureC));
        const mechanicalVentilationLossW = Math.max(0, (room.ventilationUA_W_K - room.infiltrationUA_W_K) * (lossReferenceTemperatureC - room.supplyAirTemperatureC));
        const airExchangeLossW = infiltrationLossW + mechanicalVentilationLossW;
        const denominator = Math.max(1, room.externalUA_W_K + room.ventilationUA_W_K + room.internalCouplingUA_W_K);
        const requiredHeatingW = Math.max(0, room.setpointC * denominator -
            (room.lightingGainW +
                room.occupancyGainW +
                room.equipmentGainW +
                room.pipeGainW +
                room.solarGainW +
                room.externalUA_W_K * options.outdoorTemperatureC +
                room.infiltrationUA_W_K * options.outdoorTemperatureC +
                (room.ventilationUA_W_K - room.infiltrationUA_W_K) * room.supplyAirTemperatureC +
                couplingLinks.reduce((sum, link) => {
                    if (link.roomAId === room.roomId) {
                        return sum + link.conductance_W_K * (roomTemp.get(link.roomBId) ?? airTemperatureC);
                    }
                    if (link.roomBId === room.roomId) {
                        return sum + link.conductance_W_K * (roomTemp.get(link.roomAId) ?? airTemperatureC);
                    }
                    return sum;
                }, 0)));
        balances.set(room.roomId, {
            roomId: room.roomId,
            levelId: room.levelId,
            areaM2: room.areaM2,
            volumeM3: room.volumeM3,
            centroid: room.centroid,
            setpointC: room.setpointC,
            airTemperatureC,
            heatingDeliveredW: Math.min(room.heatingCapacityW, requiredHeatingW),
            heatingCapacityW: room.heatingCapacityW,
            lightingGainW: room.lightingGainW,
            occupancyGainW: room.occupancyGainW,
            equipmentGainW: room.equipmentGainW,
            pipeGainW: room.pipeGainW,
            solarGainW: room.solarGainW,
            infiltrationLossW,
            mechanicalVentilationLossW,
            airExchangeLossW,
            ventilationLossW: airExchangeLossW,
            envelopeLossW,
            adjacentExchangeW: adjacencyExchangeW,
            externalUA_W_K: room.externalUA_W_K,
            ventilationUA_W_K: room.ventilationUA_W_K,
            internalCouplingUA_W_K: room.internalCouplingUA_W_K,
        });
    });
    return balances;
}
function buildCouplingLinks(surfaces) {
    return surfaces
        .filter((surface) => surface.kind === "internal" && surface.positiveRoomId && surface.negativeRoomId)
        .map((surface) => ({
        roomAId: surface.positiveRoomId,
        roomBId: surface.negativeRoomId,
        conductance_W_K: surface.conductance_W_K,
    }));
}
function readEngineeringParameterNumber(parameters, key) {
    const value = parameters?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function readEngineeringAirflowM3s(parameters) {
    const airflowM3H = readEngineeringParameterNumber(parameters, "airflowM3H") ??
        readEngineeringParameterNumber(parameters, "designAirflowM3H");
    if (airflowM3H != null) {
        return Math.max(0, airflowM3H) / 3600;
    }
    const airflowM3S = readEngineeringParameterNumber(parameters, "airflowM3S") ??
        readEngineeringParameterNumber(parameters, "designAirflowM3S");
    return airflowM3S != null ? Math.max(0, airflowM3S) : 0;
}
function readEngineeringPipeAirflowM3s(pipe) {
    return typeof pipe.flowRate === "number" && Number.isFinite(pipe.flowRate) ? Math.max(0, pipe.flowRate) / 3600 : 0;
}
function getConnectedEngineeringAirPipes(pipesByEquipmentId, equipmentId, medium) {
    return (pipesByEquipmentId.get(equipmentId) ?? []).filter((pipe) => pipe.medium === medium);
}
function resolveEngineeringAirTerminalAirflowM3s(equipment, medium, pipesByEquipmentId, equipmentById) {
    const connectedPipes = getConnectedEngineeringAirPipes(pipesByEquipmentId, equipment.id, medium);
    const pipeAirflow = connectedPipes
        .map((pipe) => readEngineeringPipeAirflowM3s(pipe))
        .find((value) => value > 0);
    if (pipeAirflow != null) {
        return pipeAirflow;
    }
    const ownAirflow = readEngineeringAirflowM3s(equipment.parameters);
    if (ownAirflow > 0) {
        return ownAirflow;
    }
    for (const pipe of connectedPipes) {
        const otherEquipmentId = pipe.fromEquipmentId === equipment.id ? pipe.toEquipmentId : pipe.fromEquipmentId;
        const otherEquipment = equipmentById.get(otherEquipmentId);
        if (!otherEquipment) {
            continue;
        }
        const otherAirflow = readEngineeringAirflowM3s(otherEquipment.parameters);
        if (otherAirflow > 0) {
            return otherAirflow;
        }
    }
    return 0;
}
function resolveEngineeringSupplyTemperatureC(equipment, pipesByEquipmentId, equipmentById, fallbackC) {
    const connectedPipes = getConnectedEngineeringAirPipes(pipesByEquipmentId, equipment.id, "airSupply");
    const pipeTemperature = connectedPipes.find((pipe) => typeof pipe.temperature === "number" && Number.isFinite(pipe.temperature))?.temperature;
    if (pipeTemperature != null) {
        return pipeTemperature;
    }
    if (equipment.type === "supplyDiffuser") {
        for (const pipe of connectedPipes) {
            const otherEquipmentId = pipe.fromEquipmentId === equipment.id ? pipe.toEquipmentId : pipe.fromEquipmentId;
            const otherEquipment = equipmentById.get(otherEquipmentId);
            if (!otherEquipment) {
                continue;
            }
            const otherTemperature = readEngineeringParameterNumber(otherEquipment.parameters, "supplyTemperatureC") ??
                readEngineeringParameterNumber(otherEquipment.parameters, "temperatureC");
            if (otherTemperature != null) {
                return otherTemperature;
            }
        }
    }
    const ownTemperature = readEngineeringParameterNumber(equipment.parameters, "supplyTemperatureC") ??
        readEngineeringParameterNumber(equipment.parameters, "temperatureC");
    if (ownTemperature != null) {
        return ownTemperature;
    }
    for (const pipe of connectedPipes) {
        const otherEquipmentId = pipe.fromEquipmentId === equipment.id ? pipe.toEquipmentId : pipe.fromEquipmentId;
        const otherEquipment = equipmentById.get(otherEquipmentId);
        if (!otherEquipment) {
            continue;
        }
        const otherTemperature = readEngineeringParameterNumber(otherEquipment.parameters, "supplyTemperatureC") ??
            readEngineeringParameterNumber(otherEquipment.parameters, "temperatureC");
        if (otherTemperature != null) {
            return otherTemperature;
        }
    }
    return fallbackC;
}
function accumulateRoomMechanicalAir(roomSupplyAir, roomId, input) {
    const current = roomSupplyAir.get(roomId) ?? {
        supplyAirflow_m3_s: 0,
        exhaustAirflow_m3_s: 0,
        supplyTemperatureC: input.supplyTemperatureC,
    };
    const addedSupplyAirflow = Math.max(0, input.supplyAirflow_m3_s ?? 0);
    const supplyAirflow_m3_s = current.supplyAirflow_m3_s + addedSupplyAirflow;
    const exhaustAirflow_m3_s = current.exhaustAirflow_m3_s + Math.max(0, input.exhaustAirflow_m3_s ?? 0);
    const supplyTemperatureC = addedSupplyAirflow > 0
        ? (current.supplyAirflow_m3_s * current.supplyTemperatureC + addedSupplyAirflow * input.supplyTemperatureC) /
            Math.max(supplyAirflow_m3_s, 1e-6)
        : current.supplyTemperatureC;
    roomSupplyAir.set(roomId, {
        supplyAirflow_m3_s,
        exhaustAirflow_m3_s,
        supplyTemperatureC,
    });
}
function getRoomMechanicalAirflowM3s(state) {
    if (!state) {
        return 0;
    }
    return Math.max(0, Math.max(state.supplyAirflow_m3_s, state.exhaustAirflow_m3_s));
}
function buildThermalNetworkContext(model, options) {
    const snapshot = buildSmartModelSnapshot(model, null, 0);
    const equipmentStateById = new Map(snapshot.equipmentStates.map((entry) => [entry.equipmentId, entry]));
    const networkStateById = new Map(snapshot.networkStates.map((entry) => [entry.networkId, entry]));
    const roomHeatingCapacityW = new Map();
    const roomEquipmentGainW = new Map();
    const roomPipeGainW = new Map();
    const roomSupplyAir = new Map();
    const heatLoadMultiplier = snapshot.scenario?.impact.heatLoadMultiplier ?? 1;
    const networkFlowMultiplier = snapshot.scenario?.impact.networkFlowMultiplier ?? 1;
    const roomById = new Map(model.rooms.map((room) => [room.id, room]));
    const engineeringEquipment = model.engineeringSystems?.equipment ?? [];
    const engineeringEquipmentById = new Map(engineeringEquipment.map((item) => [item.id, item]));
    const engineeringAirPipes = (model.engineeringSystems?.pipes ?? []).filter((pipe) => pipe.medium === "airSupply" || pipe.medium === "airExhaust");
    const engineeringAirPipesByEquipmentId = new Map();
    engineeringAirPipes.forEach((pipe) => {
        const fromPipes = engineeringAirPipesByEquipmentId.get(pipe.fromEquipmentId) ?? [];
        fromPipes.push(pipe);
        engineeringAirPipesByEquipmentId.set(pipe.fromEquipmentId, fromPipes);
        const toPipes = engineeringAirPipesByEquipmentId.get(pipe.toEquipmentId) ?? [];
        toPipes.push(pipe);
        engineeringAirPipesByEquipmentId.set(pipe.toEquipmentId, toPipes);
    });
    model.equipment.forEach((item) => {
        const state = equipmentStateById.get(item.id);
        if (!state || state.effectiveState !== "on") {
            return;
        }
        const roomId = state.roomId ?? item.roomId;
        if (!roomId || !roomById.has(roomId)) {
            return;
        }
        const connectedPipeIds = state.connectedNetworkIds.filter((id) => {
            const network = networkStateById.get(id);
            return network?.kind === "pipe";
        });
        const connectedDuctIds = state.connectedNetworkIds.filter((id) => {
            const network = networkStateById.get(id);
            return network?.kind === "duct";
        });
        const pipeSupport = connectedPipeIds.length
            ? clamp(connectedPipeIds.reduce((sum, id) => {
                const pipe = model.pipes.find((entry) => entry.id === id);
                const network = networkStateById.get(id);
                if (!pipe) {
                    return sum;
                }
                const flowFactor = clamp(pipe.flowRate_kg_s / 0.12, 0.2, 1.2);
                const tempFactor = clamp((pipe.fluidTemperatureC - 24) / 26, 0, 1.4);
                const hasActiveSource = network?.connectedEquipmentIds.some((equipmentId) => {
                    const equipment = model.equipment.find((entry) => entry.id === equipmentId);
                    const equipmentState = equipmentStateById.get(equipmentId);
                    return (equipment &&
                        equipmentState?.effectiveState === "on" &&
                        (equipment.type === "boiler" || equipment.type === "pump" || equipment.type === "heat_exchanger"));
                }) ?? false;
                return sum + flowFactor * tempFactor * (hasActiveSource ? 1 : 0.35);
            }, 0) / connectedPipeIds.length, 0, 1.4)
            : 0;
        const ductSupport = connectedDuctIds.length
            ? clamp(connectedDuctIds.reduce((sum, id) => {
                const duct = model.ducts.find((entry) => entry.id === id);
                if (!duct) {
                    return sum;
                }
                return sum + clamp(duct.airflow_m3_s / 0.18, 0.2, 1.4);
            }, 0) / connectedDuctIds.length, 0, 1.4)
            : 0;
        const nominalPower = resolveEquipmentNominalPower(item, item.type === "radiator" ? 1400 : item.type === "fancoil" ? 950 : item.type === "ahu" ? 320 : 90);
        if (item.type === "radiator" || item.type === "fancoil") {
            const deliveredW = nominalPower * (options.radiatorPowerMultiplier ?? DEFAULT_RADIATOR_MULTIPLIER) * heatLoadMultiplier *
                (item.type === "fancoil" ? Math.max(pipeSupport, ductSupport * 0.65) : pipeSupport);
            if (deliveredW > 0) {
                roomHeatingCapacityW.set(roomId, (roomHeatingCapacityW.get(roomId) ?? 0) + deliveredW);
            }
        }
        const equipmentGainW = resolvePassiveEquipmentGainW(item, options, heatLoadMultiplier);
        if (equipmentGainW > 0) {
            roomEquipmentGainW.set(roomId, (roomEquipmentGainW.get(roomId) ?? 0) + equipmentGainW);
        }
        const designAirflow = Math.max(0, item.params.designAirflow_m3_s ?? 0);
        if (designAirflow > 0 && (item.type === "ahu" || item.type === "diffuser" || item.type === "fancoil")) {
            const airflow_m3_s = designAirflow * Math.max(0, ductSupport || networkFlowMultiplier * 0.25);
            if (airflow_m3_s > 0) {
                accumulateRoomMechanicalAir(roomSupplyAir, roomId, {
                    supplyAirflow_m3_s: airflow_m3_s,
                    supplyTemperatureC: item.params.supplyTemperatureC ?? options.supplyAirTemperatureC ?? options.outdoorTemperatureC,
                });
            }
        }
    });
    engineeringEquipment.forEach((item) => {
        if (!item.levelId) {
            return;
        }
        const room = resolveRoomAtPoint(model.rooms, item.levelId, { x: item.x, y: item.y });
        if (!room) {
            return;
        }
        if (item.type === "supplyDiffuser") {
            const airflow_m3_s = resolveEngineeringAirTerminalAirflowM3s(item, "airSupply", engineeringAirPipesByEquipmentId, engineeringEquipmentById);
            if (airflow_m3_s <= 0) {
                return;
            }
            accumulateRoomMechanicalAir(roomSupplyAir, room.id, {
                supplyAirflow_m3_s: airflow_m3_s,
                supplyTemperatureC: resolveEngineeringSupplyTemperatureC(item, engineeringAirPipesByEquipmentId, engineeringEquipmentById, options.supplyAirTemperatureC ?? options.outdoorTemperatureC),
            });
            return;
        }
        if (item.type === "exhaustGrille") {
            const airflow_m3_s = resolveEngineeringAirTerminalAirflowM3s(item, "airExhaust", engineeringAirPipesByEquipmentId, engineeringEquipmentById);
            if (airflow_m3_s <= 0) {
                return;
            }
            accumulateRoomMechanicalAir(roomSupplyAir, room.id, {
                exhaustAirflow_m3_s: airflow_m3_s,
                supplyTemperatureC: options.supplyAirTemperatureC ?? options.outdoorTemperatureC,
            });
        }
    });
    model.pipes.forEach((pipe) => {
        if (pipe.path.length < 2) {
            return;
        }
        const networkState = networkStateById.get(pipe.id);
        const supportFactor = networkState && networkState.connectedEquipmentIds.length
            ? clamp(networkState.connectedEquipmentIds.reduce((sum, equipmentId) => {
                const equipment = model.equipment.find((entry) => entry.id === equipmentId);
                const state = equipmentStateById.get(equipmentId);
                if (!equipment || !state || state.effectiveState !== "on") {
                    return sum;
                }
                if (equipment.type === "boiler" ||
                    equipment.type === "pump" ||
                    equipment.type === "heat_exchanger" ||
                    equipment.type === "radiator" ||
                    equipment.type === "fancoil") {
                    return sum + 1;
                }
                return sum + 0.25;
            }, 0) / Math.max(1, networkState.connectedEquipmentIds.length), 0, 1)
            : 0;
        const hasActiveSource = networkState?.connectedEquipmentIds.some((equipmentId) => {
            const equipment = model.equipment.find((entry) => entry.id === equipmentId);
            const equipmentState = equipmentStateById.get(equipmentId);
            return (equipment &&
                equipmentState?.effectiveState === "on" &&
                (equipment.type === "boiler" || equipment.type === "pump" || equipment.type === "heat_exchanger"));
        }) ?? false;
        if (supportFactor <= 0 || (pipe.type !== "heating_supply" && pipe.type !== "heating_return")) {
            return;
        }
        pipe.path.slice(1).forEach((point, index) => {
            const start = pipe.path[index];
            const midpoint = { x: (start.x + point.x) / 2, y: (start.y + point.y) / 2 };
            const room = model.rooms.find((entry) => entry.levelId === pipe.levelId && polygonContainsPoint(midpoint, entry.polygon));
            if (!room) {
                return;
            }
            const lengthM = segmentLength(start, point);
            const materialFactor = pipe.material === "steel" ? 1 : pipe.material === "copper" ? 0.92 : pipe.material === "pex" ? 0.62 : 0.55;
            const deltaFactor = clamp((pipe.fluidTemperatureC - 22) / 28, 0, 1.4);
            const typeFactor = pipe.type === "heating_supply" ? 1 : 0.58;
            const gainW = lengthM *
                10.5 *
                materialFactor *
                deltaFactor *
                typeFactor *
                supportFactor *
                (hasActiveSource ? 1 : 0.28) *
                networkFlowMultiplier;
            if (gainW > 0) {
                roomPipeGainW.set(room.id, (roomPipeGainW.get(room.id) ?? 0) + gainW);
            }
        });
    });
    return {
        snapshot,
        equipmentStateById,
        networkStateById,
        roomHeatingCapacityW,
        roomEquipmentGainW,
        roomPipeGainW,
        roomSupplyAir,
        setpointOffsetC: snapshot.scenario?.impact.setpointOffsetC ?? 0,
        heatLoadMultiplier,
        networkFlowMultiplier,
    };
}
function resolveRoomHeatingCapacityW(model, roomId, levelId, polygon, options) {
    const multiplier = options.radiatorPowerMultiplier ?? DEFAULT_RADIATOR_MULTIPLIER;
    return model.equipment.reduce((sum, item) => {
        if (item.state !== "on" || item.levelId !== levelId) {
            return sum;
        }
        const hosted = item.roomId === roomId || polygonContainsPoint(item.position, polygon);
        if (!hosted) {
            return sum;
        }
        if (item.type === "radiator") {
            return sum + resolveEquipmentNominalPower(item, 1400) * multiplier;
        }
        if (item.type === "fancoil") {
            return sum + resolveEquipmentNominalPower(item, 950) * multiplier * 0.85;
        }
        if (item.type === "diffuser") {
            return sum + resolveEquipmentNominalPower(item, 220) * 0.25;
        }
        return sum;
    }, 0);
}
function resolveRoomEquipmentGainW(model, roomId, levelId, polygon, options) {
    return model.equipment.reduce((sum, item) => {
        if (item.state !== "on" || item.levelId !== levelId) {
            return sum;
        }
        const hosted = item.roomId === roomId || polygonContainsPoint(item.position, polygon);
        if (!hosted) {
            return sum;
        }
        switch (item.type) {
            case "radiator":
                return sum;
            default:
                return sum + resolvePassiveEquipmentGainW(item, options, 1);
        }
    }, 0);
}
function resolvePassiveEquipmentGainW(item, options, heatLoadMultiplier) {
    const multiplier = options.equipmentGainMultiplier ?? DEFAULT_EQUIPMENT_MULTIPLIER;
    const emittedW = resolveEquipmentPassiveEmissionBaseW(item);
    return emittedW * multiplier * heatLoadMultiplier;
}
function resolveEquipmentPassiveEmissionBaseW(item) {
    const nominalPower = typeof item.params.nominalPowerW === "number" && item.params.nominalPowerW > 0
        ? item.params.nominalPowerW
        : null;
    switch (item.type) {
        case "radiator":
            return 0;
        case "fancoil":
            return Math.min(nominalPower ? nominalPower * 0.18 : 260, 320);
        case "ahu":
            return Math.min(nominalPower ? nominalPower * 0.2 : 320, 420);
        case "pump":
            return nominalPower ? Math.min(Math.max(nominalPower * 0.06, 45), 120) : 90;
        case "boiler":
            return nominalPower ? Math.min(Math.max(nominalPower * 0.015, 120), 260) : 220;
        case "heat_exchanger":
            return nominalPower ? Math.min(Math.max(nominalPower * 0.004, 60), 140) : 80;
        case "elevator":
            return 24;
        case "expansion_tank":
            return 12;
        case "dirt_separator":
            return 32;
        case "diffuser":
            return 45;
        case "sensor":
            return 8;
        default:
            return nominalPower ? Math.min(nominalPower * 0.12, 120) : 60;
    }
}
function resolveRoomPipeGainW(model, levelId, polygon) {
    return model.pipes.reduce((sum, pipe) => {
        if (pipe.levelId !== levelId || pipe.path.length < 2) {
            return sum;
        }
        let hostedLength = 0;
        pipe.path.slice(1).forEach((point, index) => {
            const start = pipe.path[index];
            const mid = { x: (start.x + point.x) / 2, y: (start.y + point.y) / 2 };
            if (!polygonContainsPoint(mid, polygon)) {
                return;
            }
            hostedLength += segmentLength(start, point);
        });
        if (hostedLength <= 0) {
            return sum;
        }
        const deltaFactor = Math.max(0, pipe.fluidTemperatureC - 20) / 25;
        const typeFactor = pipe.type === "heating_supply" ? 1 : pipe.type === "heating_return" ? 0.55 : 0.18;
        return sum + hostedLength * 11 * deltaFactor * typeFactor;
    }, 0);
}
function resolveEquipmentNominalPower(item, fallbackW) {
    return typeof item.params.nominalPowerW === "number" && item.params.nominalPowerW > 0
        ? item.params.nominalPowerW
        : fallbackW;
}
/**
 * Поправочный множитель на тепловые мостики ограждения: 1/r по данным ψ/χ модели.
 * Если мостиков нет — возвращает 1 (без изменения теплопотерь).
 */
function resolveBridgeFactor(model) {
    const homogeneity = resolveModelHomogeneityCoefficient(model);
    if (homogeneity.hasBridgeData && homogeneity.value != null && homogeneity.value > 0) {
        return 1 / homogeneity.value;
    }
    return 1;
}
/**
 * Солнечный приток через остекление, Вт.
 * Раскладывает излучение на прямую (зависит от высоты солнца и ориентации фасада)
 * и рассеянную (небо + отражение земли, не зависит от ориентации).
 * Прямая составляющая: I_dir = 320 · sin(altitude) — эмпирическое приближение
 * нормальной прямой радиации для умеренных широт в зимний день.
 * Рассеянная: I_dif ≈ 55 Вт/м² (стандартное значение для зимы, СП 131).
 * SHGC типового стеклопакета 0.5 заложен в solarGainFactor (DEFAULT = 0.4–0.5).
 */
function computeSolarGainW(windowAreaM2, orientation, options) {
    if (windowAreaM2 <= 0 || !orientation) {
        return 0;
    }
    const factor = options.solarGainFactor ?? DEFAULT_SOLAR_GAIN_FACTOR;
    const hour = options.timeHours ?? 12;
    const solarPosition = computeSolarPosition({
        latitudeDeg: options.solarLatitudeDeg ?? 55.75,
        dayOfYear: options.solarDayOfYear ?? 15,
        hourDecimal: hour,
    });
    const facadeAzimuth = orientationToAzimuthDeg(orientation);
    const accessFactor = computeFacadeSolarAccessFactor(solarPosition, facadeAzimuth);
    // Прямая составляющая: масштабируется sin(altitude) — при alt=0 прямое излучение = 0
    const sinAlt = solarPosition.isAboveHorizon
        ? Math.sin(solarPosition.altitudeDeg * (Math.PI / 180))
        : 0;
    const directIrradiance = 320 * Math.max(0, sinAlt); // Вт/м², вертикальная поверхность
    // Рассеянная от неба (коэф. видимости вертикальной поверхности ≈ 0.5)
    const diffuseIrradiance = 55 * 0.5;
    const totalIrradiance = directIrradiance * accessFactor + diffuseIrradiance;
    return windowAreaM2 * totalIrradiance * factor;
}
function resolveRoomAtPoint(rooms, levelId, point) {
    return rooms.find((room) => room.levelId === levelId && polygonContainsPoint(point, room.polygon)) ?? null;
}
function estimateOrientation(wall) {
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    if (deg >= 315 || deg < 45) {
        return "E";
    }
    if (deg < 135) {
        return "N";
    }
    if (deg < 225) {
        return "W";
    }
    return "S";
}
function normalize(point) {
    const length = Math.hypot(point.x, point.y);
    if (length <= 1e-8) {
        return { x: 0, y: 0 };
    }
    return { x: point.x / length, y: point.y / length };
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
