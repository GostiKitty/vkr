import { polygonArea, polygonContainsPoint, segmentLength } from "../../entities/geometry/geom";
import type { BuildingModel, Vec2, Wall } from "../../entities/geometry/types";
import { DEFAULT_WALL_ASSEMBLY_ID } from "../../entities/material/types";
import { computeWallFacadeConductances } from "./wallFacadeThermal";
import { buildSmartModelSnapshot, type SmartEquipmentState, type SmartModelSnapshot, type SmartNetworkState } from "../networks/intelligence";
import type { Orientation } from "../graph/adjacency";
import { buildAdjacencyGraph } from "../graph/adjacency";
import {
  buildGeometryRenderModel,
  type GeometryRenderModel,
  type OpeningCutDescriptor,
  type RoomVolumeDescriptor,
} from "../geometry/bimPipeline";
import { airflowFromACH } from "./formulas";

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

export interface ThermalPhysicsOptions {
  outdoorTemperatureC: number;
  timeHours?: number;
  setpointTemperatureC?: number;
  windFactor?: number;
  solarGainFactor?: number;
  lightingGain_W_m2?: number;
  occupancyGain_W_m2?: number;
  infiltrationACH?: number;
  ventilationACH?: number;
  supplyAirTemperatureC?: number | null;
  radiatorPowerMultiplier?: number;
  equipmentGainMultiplier?: number;
  transientBlend?: number;
  fixedRoomTemperaturesC?: Record<string, number>;
}

export interface ThermalRoomBalance {
  roomId: string;
  levelId: string;
  areaM2: number;
  volumeM3: number;
  centroid: Vec2;
  setpointC: number;
  airTemperatureC: number;
  heatingDeliveredW: number;
  heatingCapacityW: number;
  lightingGainW: number;
  occupancyGainW: number;
  equipmentGainW: number;
  pipeGainW: number;
  solarGainW: number;
  infiltrationLossW: number;
  mechanicalVentilationLossW: number;
  airExchangeLossW: number;
  ventilationLossW: number;
  envelopeLossW: number;
  adjacentExchangeW: number;
  externalUA_W_K: number;
  ventilationUA_W_K: number;
  internalCouplingUA_W_K: number;
}

export interface ThermalSurfaceEstimate {
  wallId: string;
  levelId: string;
  wall: Wall;
  kind: "external" | "internal";
  positiveRoomId: string | null;
  negativeRoomId: string | null;
  orientation: Orientation | null;
  wallAreaM2: number;
  opaqueAreaM2: number;
  windowAreaM2: number;
  doorAreaM2: number;
  effectiveU_W_m2K: number;
  effectiveR_m2K_W: number;
  conductance_W_K: number;
  bridgeFactor: number;
  solarGainW: number;
  openingPerimeterM: number;
}

export interface ThermalPhysicsModel {
  renderGeometry: GeometryRenderModel;
  roomBalances: Map<string, ThermalRoomBalance>;
  surfaces: ThermalSurfaceEstimate[];
  roomSurfaces: Map<string, ThermalSurfaceEstimate[]>;
  adjacency: ReturnType<typeof buildAdjacencyGraph>;
  /** Допущения и геометрические предупреждения (проёмы, оценки). */
  warnings: string[];
}

type RoomSeed = {
  roomId: string;
  levelId: string;
  polygon: Vec2[];
  areaM2: number;
  volumeM3: number;
  centroid: Vec2;
  setpointC: number;
  lightingGainW: number;
  occupancyGainW: number;
  equipmentGainW: number;
  pipeGainW: number;
  solarGainW: number;
  heatingCapacityW: number;
  infiltrationUA_W_K: number;
  mechanicalSupplyUA_W_K: number;
  supplyAirTemperatureC: number;
  externalUA_W_K: number;
  ventilationUA_W_K: number;
  internalCouplingUA_W_K: number;
};

type CouplingLink = {
  roomAId: string;
  roomBId: string;
  conductance_W_K: number;
};

type ThermalNetworkContext = {
  snapshot: SmartModelSnapshot;
  equipmentStateById: Map<string, SmartEquipmentState>;
  networkStateById: Map<string, SmartNetworkState>;
  roomHeatingCapacityW: Map<string, number>;
  roomEquipmentGainW: Map<string, number>;
  roomPipeGainW: Map<string, number>;
  roomSupplyAir: Map<string, { airflow_m3_s: number; supplyTemperatureC: number }>;
  setpointOffsetC: number;
  heatLoadMultiplier: number;
  networkFlowMultiplier: number;
};

export function buildThermalPhysicsModel(
  model: BuildingModel,
  options: ThermalPhysicsOptions,
  renderGeometry = buildGeometryRenderModel(model)
): ThermalPhysicsModel {
  const adjacency = buildAdjacencyGraph(model);
  const networkContext = buildThermalNetworkContext(model, options);
  const levelMap = new Map(model.levels.map((level) => [level.id, level]));
  const orientationByWallId = new Map(adjacency.external.map((edge) => [edge.wallId, edge.orientation]));
  const { surfaces, warnings: surfaceWarnings } = buildSurfaceEstimates(renderGeometry, options, orientationByWallId);
  const roomSurfaces = new Map<string, ThermalSurfaceEstimate[]>();
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

  const roomSeeds = renderGeometry.roomVolumes.map((room) =>
    createRoomSeed(model, room, roomSurfaces.get(room.roomId) ?? [], levelMap, options, networkContext)
  );
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

function createRoomSeed(
  model: BuildingModel,
  room: RoomVolumeDescriptor,
  surfaces: ThermalSurfaceEstimate[],
  levelMap: Map<string, BuildingModel["levels"][number]>,
  options: ThermalPhysicsOptions,
  networkContext: ThermalNetworkContext
): RoomSeed {
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
  const scheduledVentilationUA_W_K = AIR_DENSITY_KG_M3 * AIR_CP_J_KG_K * airflowFromACH(scheduledVentilationAch, volumeM3);
  const mechanicalSupplyUA_W_K = roomSupply
    ? AIR_DENSITY_KG_M3 * AIR_CP_J_KG_K * Math.max(0, roomSupply.airflow_m3_s)
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

function buildSurfaceEstimates(
  renderGeometry: GeometryRenderModel,
  options: ThermalPhysicsOptions,
  orientationByWallId: Map<string, Orientation>
): { surfaces: ThermalSurfaceEstimate[]; warnings: string[] } {
  const warnings: string[] = [];
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
    const bridgeFactor = computeBridgeFactor(wall, openings, positiveRoom !== null && negativeRoom !== null);
    const windFactor = clamp(options.windFactor ?? DEFAULT_WIND_FACTOR, 0.4, 2.4);
    const conductanceMultiplier = positiveRoom && negativeRoom ? 1 : windFactor * bridgeFactor;
    const facade = computeWallFacadeConductances(
      wall,
      openings,
      wall.wallAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID,
      conductanceMultiplier
    );
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
      kind: (positiveRoom && negativeRoom ? "internal" : "external") as "internal" | "external",
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

function solveRoomBalances(
  roomSeeds: RoomSeed[],
  couplingLinks: CouplingLink[],
  options: ThermalPhysicsOptions
): Map<string, ThermalRoomBalance> {
  const fixed = options.fixedRoomTemperaturesC ?? {};
  const transientBlend = clamp(options.transientBlend ?? 1, 0.2, 1);
  const roomTemp = new Map<string, number>();

  roomSeeds.forEach((room) => {
    const fixedTemperature = fixed[room.roomId];
    if (typeof fixedTemperature === "number") {
      roomTemp.set(room.roomId, fixedTemperature);
      return;
    }
    const denominator = room.externalUA_W_K + room.ventilationUA_W_K + room.internalCouplingUA_W_K + 1;
    const passive =
      (room.lightingGainW + room.occupancyGainW + room.equipmentGainW + room.pipeGainW + room.solarGainW +
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
      const denominator = Math.max(
        1,
        room.externalUA_W_K + room.ventilationUA_W_K + room.internalCouplingUA_W_K
      );
      const passiveNumerator =
        room.lightingGainW +
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

  const balances = new Map<string, ThermalRoomBalance>();
  roomSeeds.forEach((room) => {
    const airTemperatureC = roomTemp.get(room.roomId) ?? room.setpointC;
    const adjacencyExchangeW = couplingLinks.reduce((sum, link) => {
      if (link.roomAId === room.roomId) {
        return sum + link.conductance_W_K * ((roomTemp.get(link.roomBId) ?? airTemperatureC) - airTemperatureC);
      }
      if (link.roomBId === room.roomId) {
        return sum + link.conductance_W_K * ((roomTemp.get(link.roomAId) ?? airTemperatureC) - airTemperatureC);
      }
      return sum;
    }, 0);
    const envelopeLossW = Math.max(0, room.externalUA_W_K * (airTemperatureC - options.outdoorTemperatureC));
    const infiltrationLossW = Math.max(0, room.infiltrationUA_W_K * (airTemperatureC - options.outdoorTemperatureC));
    const mechanicalVentilationLossW = Math.max(
      0,
      (room.ventilationUA_W_K - room.infiltrationUA_W_K) * (airTemperatureC - room.supplyAirTemperatureC)
    );
    const airExchangeLossW = infiltrationLossW + mechanicalVentilationLossW;
    const denominator = Math.max(1, room.externalUA_W_K + room.ventilationUA_W_K + room.internalCouplingUA_W_K);
    const requiredHeatingW = Math.max(
      0,
      room.setpointC * denominator -
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
          }, 0))
    );

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

function buildCouplingLinks(surfaces: ThermalSurfaceEstimate[]): CouplingLink[] {
  return surfaces
    .filter((surface) => surface.kind === "internal" && surface.positiveRoomId && surface.negativeRoomId)
    .map((surface) => ({
      roomAId: surface.positiveRoomId!,
      roomBId: surface.negativeRoomId!,
      conductance_W_K: surface.conductance_W_K,
    }));
}

function buildThermalNetworkContext(
  model: BuildingModel,
  options: ThermalPhysicsOptions
): ThermalNetworkContext {
  const snapshot = buildSmartModelSnapshot(model, null, 0);
  const equipmentStateById = new Map(snapshot.equipmentStates.map((entry) => [entry.equipmentId, entry]));
  const networkStateById = new Map(snapshot.networkStates.map((entry) => [entry.networkId, entry]));
  const roomHeatingCapacityW = new Map<string, number>();
  const roomEquipmentGainW = new Map<string, number>();
  const roomPipeGainW = new Map<string, number>();
  const roomSupplyAir = new Map<string, { airflow_m3_s: number; supplyTemperatureC: number }>();
  const heatLoadMultiplier = snapshot.scenario?.impact.heatLoadMultiplier ?? 1;
  const networkFlowMultiplier = snapshot.scenario?.impact.networkFlowMultiplier ?? 1;
  const roomById = new Map(model.rooms.map((room) => [room.id, room]));

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
      ? clamp(
          connectedPipeIds.reduce((sum, id) => {
            const pipe = model.pipes.find((entry) => entry.id === id);
            const network = networkStateById.get(id);
            if (!pipe) {
              return sum;
            }
            const flowFactor = clamp(pipe.flowRate_kg_s / 0.12, 0.2, 1.2);
            const tempFactor = clamp((pipe.fluidTemperatureC - 24) / 26, 0, 1.4);
            const hasActiveSource =
              network?.connectedEquipmentIds.some((equipmentId) => {
                const equipment = model.equipment.find((entry) => entry.id === equipmentId);
                const equipmentState = equipmentStateById.get(equipmentId);
                return (
                  equipment &&
                  equipmentState?.effectiveState === "on" &&
                  (equipment.type === "boiler" || equipment.type === "pump" || equipment.type === "heat_exchanger")
                );
              }) ?? false;
            return sum + flowFactor * tempFactor * (hasActiveSource ? 1 : 0.35);
          }, 0) / connectedPipeIds.length,
          0,
          1.4
        )
      : 0;

    const ductSupport = connectedDuctIds.length
      ? clamp(
          connectedDuctIds.reduce((sum, id) => {
            const duct = model.ducts.find((entry) => entry.id === id);
            if (!duct) {
              return sum;
            }
            return sum + clamp(duct.airflow_m3_s / 0.18, 0.2, 1.4);
          }, 0) / connectedDuctIds.length,
          0,
          1.4
        )
      : 0;

    const nominalPower = resolveEquipmentNominalPower(
      item,
      item.type === "radiator" ? 1400 : item.type === "fancoil" ? 950 : item.type === "ahu" ? 320 : 90
    );

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
        const current = roomSupplyAir.get(roomId) ?? {
          airflow_m3_s: 0,
          supplyTemperatureC: item.params.supplyTemperatureC ?? options.supplyAirTemperatureC ?? options.outdoorTemperatureC,
        };
        const supplyTemperatureC = item.params.supplyTemperatureC ?? current.supplyTemperatureC;
        const mixedSupplyTemperatureC =
          (current.airflow_m3_s * current.supplyTemperatureC + airflow_m3_s * supplyTemperatureC) /
          Math.max(airflow_m3_s + current.airflow_m3_s, 1e-6);
        roomSupplyAir.set(roomId, {
          airflow_m3_s: current.airflow_m3_s + airflow_m3_s,
          supplyTemperatureC: mixedSupplyTemperatureC,
        });
      }
    }
  });

  model.pipes.forEach((pipe) => {
    if (pipe.path.length < 2) {
      return;
    }
    const networkState = networkStateById.get(pipe.id);
    const supportFactor = networkState && networkState.connectedEquipmentIds.length
      ? clamp(
          networkState.connectedEquipmentIds.reduce((sum, equipmentId) => {
            const equipment = model.equipment.find((entry) => entry.id === equipmentId);
            const state = equipmentStateById.get(equipmentId);
            if (!equipment || !state || state.effectiveState !== "on") {
              return sum;
            }
            if (
              equipment.type === "boiler" ||
              equipment.type === "pump" ||
              equipment.type === "heat_exchanger" ||
              equipment.type === "radiator" ||
              equipment.type === "fancoil"
            ) {
              return sum + 1;
            }
            return sum + 0.25;
          }, 0) / Math.max(1, networkState.connectedEquipmentIds.length),
          0,
          1
        )
      : 0;
    const hasActiveSource =
      networkState?.connectedEquipmentIds.some((equipmentId) => {
        const equipment = model.equipment.find((entry) => entry.id === equipmentId);
        const equipmentState = equipmentStateById.get(equipmentId);
        return (
          equipment &&
          equipmentState?.effectiveState === "on" &&
          (equipment.type === "boiler" || equipment.type === "pump" || equipment.type === "heat_exchanger")
        );
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
      const materialFactor =
        pipe.material === "steel" ? 1 : pipe.material === "copper" ? 0.92 : pipe.material === "pex" ? 0.62 : 0.55;
      const deltaFactor = clamp((pipe.fluidTemperatureC - 22) / 28, 0, 1.4);
      const typeFactor = pipe.type === "heating_supply" ? 1 : 0.58;
      const gainW =
        lengthM *
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

function resolveRoomHeatingCapacityW(
  model: BuildingModel,
  roomId: string,
  levelId: string,
  polygon: Vec2[],
  options: ThermalPhysicsOptions
): number {
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

function resolveRoomEquipmentGainW(
  model: BuildingModel,
  roomId: string,
  levelId: string,
  polygon: Vec2[],
  options: ThermalPhysicsOptions
): number {
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

function resolvePassiveEquipmentGainW(
  item: BuildingModel["equipment"][number],
  options: ThermalPhysicsOptions,
  heatLoadMultiplier: number
): number {
  const multiplier = options.equipmentGainMultiplier ?? DEFAULT_EQUIPMENT_MULTIPLIER;
  const emittedW = resolveEquipmentPassiveEmissionBaseW(item);
  return emittedW * multiplier * heatLoadMultiplier;
}

function resolveEquipmentPassiveEmissionBaseW(item: BuildingModel["equipment"][number]): number {
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

function resolveRoomPipeGainW(model: BuildingModel, levelId: string, polygon: Vec2[]): number {
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

function resolveEquipmentNominalPower(
  item: BuildingModel["equipment"][number],
  fallbackW: number
): number {
  return typeof item.params.nominalPowerW === "number" && item.params.nominalPowerW > 0
    ? item.params.nominalPowerW
    : fallbackW;
}

function computeSolarGainW(
  windowAreaM2: number,
  orientation: Orientation | null,
  options: ThermalPhysicsOptions
): number {
  if (windowAreaM2 <= 0 || !orientation) {
    return 0;
  }
  const factor = options.solarGainFactor ?? DEFAULT_SOLAR_GAIN_FACTOR;
  const hour = options.timeHours ?? 12;
  const solarProfile = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const orientationWeight =
    orientation === "S" ? 1 : orientation === "E" || orientation === "W" ? 0.74 : 0.42;
  return windowAreaM2 * 115 * factor * solarProfile * orientationWeight;
}

function computeBridgeFactor(
  wall: Wall,
  openings: OpeningCutDescriptor[],
  isInternal: boolean
): number {
  const wallLength = Math.max(0.2, segmentLength(wall.a, wall.b));
  const openingPerimeter = openings.reduce((sum, opening) => sum + opening.widthM * 2 + opening.heightM * 2, 0);
  const density = openingPerimeter / Math.max(1, wallLength * wall.height_m);
  const base = isInternal ? 1.02 : 1.06;
  return clamp(base + density * 0.18 + wall.thickness_m * 0.04, 1, 1.24);
}

function resolveRoomAtPoint<T extends Pick<RoomVolumeDescriptor, "levelId" | "polygon">>(
  rooms: T[],
  levelId: string,
  point: Vec2
): T | null {
  return rooms.find((room) => room.levelId === levelId && polygonContainsPoint(point, room.polygon)) ?? null;
}

function estimateOrientation(wall: Wall): Orientation {
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

function normalize(point: Vec2): Vec2 {
  const length = Math.hypot(point.x, point.y);
  if (length <= 1e-8) {
    return { x: 0, y: 0 };
  }
  return { x: point.x / length, y: point.y / length };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
