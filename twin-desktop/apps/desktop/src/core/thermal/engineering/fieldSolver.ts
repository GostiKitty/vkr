import { pointToSegmentDistance, polygonContainsPoint } from "../../../entities/geometry/geom";
import type { BuildingModel, Vec2 } from "../../../entities/geometry/types";
import { computeWallProperties, DEFAULT_WALL_ASSEMBLY_ID } from "../../../entities/material/types";
import { buildGeometryRenderModel } from "../../geometry/bimPipeline";
import type { ThermalFieldModel } from "../field";
import { sampleSmoothedThermalFieldAtPoint } from "../field";
import type { ThermalPhysicsModel, ThermalSurfaceEstimate } from "../physics";
import {
  AIR_DENSITY_KG_M3,
  AIR_HEAT_CAPACITY_J_KG_K,
  DEFAULT_EFFECTIVE_AIR_DIFFUSIVITY_M2_S,
} from "./constants";
import { clamp, standardDeviation } from "./units";
import type { EngineeringFieldCell, EngineeringFieldResult, EngineeringFieldZone, ResolvedEngineeringOptions } from "./types";

interface GridCell {
  valid: boolean;
  roomId: string | null;
  x: number;
  y: number;
  temperatureC: number;
  sourceDensityW_m3: number;
  boundaryTemperatureC: number | null;
  nearWindow: boolean;
  nearWall: boolean;
  nearCorner: boolean;
  volumeM3: number;
}

interface DistributedSource {
  id: string;
  roomId: string;
  levelId: string;
  powerW: number;
  distribution: "uniform" | "localized";
  position?: Vec2;
  radiusM?: number;
}

interface SurfaceBoundaryTemperatures {
  wallByRoomId: Record<string, number>;
  windowByRoomId: Record<string, number>;
  doorByRoomId: Record<string, number>;
}

const WINDOW_BAND_M = 0.45;
const WALL_BAND_M = 0.35;
const CORNER_BAND_M = 0.45;
const MAX_GRID_CELLS = 9000;
const DEFAULT_ROOM_HEIGHT_M = 3;
const MIN_LOCAL_SOURCE_RADIUS_M = 0.55;

export function buildDetailedFieldResult(
  model: BuildingModel,
  physics: ThermalPhysicsModel,
  options: ResolvedEngineeringOptions,
  outdoorTemperatureC: number,
  roomTemperatureAnchorsC: Record<string, number> = {}
): EngineeringFieldResult | null {
  const targetLevelId = options.targetLevelId ?? model.levels[0]?.id ?? null;
  if (!targetLevelId) {
    return null;
  }

  const renderGeometry = buildGeometryRenderModel(model);
  const levelRooms = renderGeometry.roomVolumes.filter((room) => room.levelId === targetLevelId);
  if (!levelRooms.length) {
    return null;
  }

  const roomById = new Map(levelRooms.map((room) => [room.roomId, room]));
  const roomBalanceById = new Map(
    Array.from(physics.roomBalances.values())
      .filter((balance) => balance.levelId === targetLevelId)
      .map((balance) => [balance.roomId, balance])
  );

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  levelRooms.forEach((room) => {
    room.polygon.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  let step = clamp(options.grid.cellSizeM, 0.12, 1.2);
  let cols = Math.max(1, Math.ceil((maxX - minX) / step));
  let rows = Math.max(1, Math.ceil((maxY - minY) / step));
  if (rows * cols > MAX_GRID_CELLS) {
    const boundingAreaM2 = Math.max((maxX - minX) * (maxY - minY), step * step);
    step = Math.max(step, Math.sqrt(boundingAreaM2 / MAX_GRID_CELLS));
    cols = Math.max(1, Math.ceil((maxX - minX) / step));
    rows = Math.max(1, Math.ceil((maxY - minY) / step));
  }

  const surfacesByLevel = physics.surfaces.filter((surface) => surface.levelId === targetLevelId);
  const surfacesByRoom = new Map<string, ThermalSurfaceEstimate[]>();
  surfacesByLevel.forEach((surface) => {
    if (surface.positiveRoomId) {
      const list = surfacesByRoom.get(surface.positiveRoomId) ?? [];
      list.push(surface);
      surfacesByRoom.set(surface.positiveRoomId, list);
    }
    if (surface.negativeRoomId) {
      const list = surfacesByRoom.get(surface.negativeRoomId) ?? [];
      list.push(surface);
      surfacesByRoom.set(surface.negativeRoomId, list);
    }
  });

  const surfaceTemperatureMap = new Map<string, SurfaceBoundaryTemperatures>();
  surfacesByLevel.forEach((surface) => {
    surfaceTemperatureMap.set(
      surface.wallId,
      buildSurfaceBoundaryTemperatures(surface, roomBalanceById, outdoorTemperatureC, options)
    );
  });

  const grid: GridCell[][] = [];
  const roomCells = new Map<string, GridCell[]>();

  for (let row = 0; row < rows; row += 1) {
    const line: GridCell[] = [];
    for (let col = 0; col < cols; col += 1) {
      const x = minX + (col + 0.5) * step;
      const y = minY + (row + 0.5) * step;
      const room = levelRooms.find((candidate) => polygonContainsPoint({ x, y }, candidate.polygon)) ?? null;
      if (!room) {
        line.push({
          valid: false,
          roomId: null,
          x,
          y,
          temperatureC: outdoorTemperatureC,
          sourceDensityW_m3: 0,
          boundaryTemperatureC: null,
          nearWindow: false,
          nearWall: false,
          nearCorner: false,
          volumeM3: 0,
        });
        continue;
      }

      const roomBalance = roomBalanceById.get(room.roomId);
      const baseTemperatureC =
        roomTemperatureAnchorsC[room.roomId] ??
        roomBalance?.airTemperatureC ??
        20;
      const relatedSurfaces = surfacesByRoom.get(room.roomId) ?? [];
      const boundaryCandidates = relatedSurfaces
        .map((surface) => {
          const distance = pointToSegmentDistance({ x, y }, surface.wall.a, surface.wall.b);
          if (distance > Math.max(WALL_BAND_M, step * 1.1)) {
            return null;
          }
          const boundaryTemperatures = surfaceTemperatureMap.get(surface.wallId);
          if (!boundaryTemperatures) {
            return null;
          }
          const windowTemperature = boundaryTemperatures.windowByRoomId[room.roomId];
          const doorTemperature = boundaryTemperatures.doorByRoomId[room.roomId];
          const wallTemperature = boundaryTemperatures.wallByRoomId[room.roomId];
          const boundaryTemperatureC =
            surface.windowAreaM2 > 0 && distance <= WINDOW_BAND_M
              ? windowTemperature
              : surface.doorAreaM2 > 0 && distance <= WINDOW_BAND_M
                ? doorTemperature
                : wallTemperature;
          return {
            distance,
            boundaryTemperatureC,
            nearWindow: surface.windowAreaM2 > 0 && distance <= WINDOW_BAND_M,
          };
        })
        .filter(Boolean) as Array<{ distance: number; boundaryTemperatureC: number; nearWindow: boolean }>;

      const boundaryTemperatureC = boundaryCandidates.length
        ? boundaryCandidates.reduce((sum, item) => sum + item.boundaryTemperatureC / Math.max(item.distance, 0.06), 0) /
          boundaryCandidates.reduce((sum, item) => sum + 1 / Math.max(item.distance, 0.06), 0)
        : null;

      const cell: GridCell = {
        valid: true,
        roomId: room.roomId,
        x,
        y,
        temperatureC: baseTemperatureC,
        sourceDensityW_m3: 0,
        boundaryTemperatureC,
        nearWindow: boundaryCandidates.some((item) => item.nearWindow),
        nearWall: relatedSurfaces.some((surface) => pointToSegmentDistance({ x, y }, surface.wall.a, surface.wall.b) <= WALL_BAND_M),
        nearCorner: room.polygon.some((point) => Math.hypot(point.x - x, point.y - y) <= CORNER_BAND_M),
        volumeM3: 0,
      };

      const roomList = roomCells.get(room.roomId) ?? [];
      roomList.push(cell);
      roomCells.set(room.roomId, roomList);
      line.push(cell);
    }
    grid.push(line);
  }

  roomCells.forEach((cells, roomId) => {
    const balance = roomBalanceById.get(roomId);
    const volumeM3 = Math.max(balance?.volumeM3 ?? cells.length * step * step * DEFAULT_ROOM_HEIGHT_M, 1);
    const cellVolumeM3 = volumeM3 / Math.max(cells.length, 1);
    cells.forEach((cell) => {
      cell.volumeM3 = cellVolumeM3;
    });
  });

  const distributedSources = buildDistributedSources(model, roomById, roomBalanceById, targetLevelId);
  distributedSources.forEach((source) => {
    const cells = roomCells.get(source.roomId) ?? [];
    if (!cells.length || source.powerW <= 0) {
      return;
    }
    if (source.distribution === "uniform" || !source.position) {
      addUniformSource(cells, source.powerW);
      return;
    }
    addLocalizedSource(cells, source.powerW, source.position, source.radiusM ?? Math.max(MIN_LOCAL_SOURCE_RADIUS_M, step * 1.6));
  });

  const effectiveConductivity_W_mK =
    AIR_DENSITY_KG_M3 * AIR_HEAT_CAPACITY_J_KG_K * DEFAULT_EFFECTIVE_AIR_DIFFUSIVITY_M2_S;
  let iterations = 0;
  let residualC = Number.POSITIVE_INFINITY;

  for (iterations = 0; iterations < options.grid.maxIterations; iterations += 1) {
    residualC = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cell = grid[row][col];
        if (!cell.valid || !cell.roomId) {
          continue;
        }

        const neighborValues = [
          resolveNeighborTemperature(grid, row - 1, col, cell),
          resolveNeighborTemperature(grid, row + 1, col, cell),
          resolveNeighborTemperature(grid, row, col - 1, cell),
          resolveNeighborTemperature(grid, row, col + 1, cell),
        ];
        const sourceContributionC = (cell.sourceDensityW_m3 * step * step) / Math.max(effectiveConductivity_W_mK, 1e-6);
        const solvedTemperatureC = (neighborValues[0] + neighborValues[1] + neighborValues[2] + neighborValues[3] + sourceContributionC) / 4;
        const roomAnchorC =
          roomTemperatureAnchorsC[cell.roomId] ??
          roomBalanceById.get(cell.roomId)?.airTemperatureC ??
          cell.temperatureC;
        const lowerBoundC = roomAnchorC - clamp((roomAnchorC - outdoorTemperatureC) * 0.32, 2.2, 7.0);
        const upperBoundC = roomAnchorC + clamp(Math.max(sourceContributionC, 0) * 0.24 + 3.8, 3.8, 7.2);
        const nextTemperatureC = clamp(solvedTemperatureC, lowerBoundC, upperBoundC);
        residualC = Math.max(residualC, Math.abs(nextTemperatureC - cell.temperatureC));
        cell.temperatureC = nextTemperatureC;
      }
    }
    if (residualC <= options.grid.toleranceC) {
      break;
    }
  }

  const cells = grid.flatMap((row, rowIndex) =>
    row.flatMap((cell, colIndex): EngineeringFieldCell[] =>
      cell.valid && cell.roomId
        ? [{ row: rowIndex, col: colIndex, x: cell.x, y: cell.y, temperatureC: cell.temperatureC, roomId: cell.roomId }]
        : []
    )
  );
  if (!cells.length) {
    return null;
  }

  const values = cells.map((cell) => cell.temperatureC);
  return {
    kind: "detailed",
    levelId: targetLevelId,
    rows,
    cols,
    cellSizeM: step,
    toleranceC: options.grid.toleranceC,
    maxIterations: options.grid.maxIterations,
    minTemperatureC: Math.min(...values),
    maxTemperatureC: Math.max(...values),
    averageTemperatureC: average(values),
    converged: residualC <= options.grid.toleranceC,
    iterations: iterations + 1,
    residualC,
    sourceCount: distributedSources.length,
    cells,
    hotspots: pickCharacteristicCells(cells, "hot"),
    coldspots: pickCharacteristicCells(cells, "cold"),
    occupiedZone: pickCharacteristicCells(cells, "occupied"),
    wallBand: mapBand(grid, (cell) => cell.valid && cell.nearWall, "wall"),
    windowBand: mapBand(grid, (cell) => cell.valid && cell.nearWindow, "window"),
    cornerPoints: mapBand(grid, (cell) => cell.valid && cell.nearCorner, "corner"),
  };
}

export function buildFastFieldSummary(
  fastField: ThermalFieldModel,
  options: ResolvedEngineeringOptions
): EngineeringFieldResult | null {
  const levelId = options.targetLevelId ?? fastField.rooms[0]?.levelId ?? null;
  if (!levelId) {
    return null;
  }
  const cells = fastField.rooms
    .filter((room) => room.levelId === levelId)
    .flatMap((room) =>
      room.samplePoints.map((point, index) => ({
        row: 0,
        col: index,
        x: point.x,
        y: point.y,
        roomId: room.roomId,
        temperatureC: sampleSmoothedThermalFieldAtPoint(fastField, room.levelId, point),
      }))
    );
  if (!cells.length) {
    return null;
  }
  const values = cells.map((cell) => cell.temperatureC);
  return {
    kind: "fast",
    levelId,
    rows: 1,
    cols: cells.length,
    cellSizeM: 0,
    toleranceC: options.grid.toleranceC,
    maxIterations: options.grid.maxIterations,
    minTemperatureC: Math.min(...values),
    maxTemperatureC: Math.max(...values),
    averageTemperatureC: average(values),
    converged: true,
    iterations: 0,
    residualC: 0,
    sourceCount: fastField.sources.filter((source) => source.levelId === levelId).length,
    cells,
    hotspots: pickCharacteristicCells(cells, "hot"),
    coldspots: pickCharacteristicCells(cells, "cold"),
    occupiedZone: pickCharacteristicCells(cells, "occupied"),
    wallBand: [],
    windowBand: [],
    cornerPoints: [],
  };
}

export function buildComfortSummary(field: EngineeringFieldResult | null, targetTemperatureC: number) {
  if (!field || !field.cells.length) {
    return {
      targetTemperatureC,
      meanAirTemperatureC: targetTemperatureC,
      occupiedMeanTemperatureC: targetTemperatureC,
      deviationFromTargetC: 0,
      occupiedBandSpreadC: 0,
      fieldSpreadC: 0,
      standardDeviationC: 0,
      localColdRisk: false,
      localOverheatRisk: false,
      rating: "attention" as const,
      explanation: "Температурное поле не построено, поэтому оценка комфорта пока ориентировочная.",
    };
  }

  const values = field.cells.map((cell) => cell.temperatureC);
  const occupiedValues = field.occupiedZone.map((zone) => zone.temperatureC);
  const meanAirTemperatureC = average(values);
  const occupiedMeanTemperatureC = average(occupiedValues.length ? occupiedValues : values);
  const deviationFromTargetC = occupiedMeanTemperatureC - targetTemperatureC;
  const occupiedBandSpreadC = occupiedValues.length ? Math.max(...occupiedValues) - Math.min(...occupiedValues) : 0;
  const fieldSpreadC = Math.max(...values) - Math.min(...values);
  const standardDeviationC = standardDeviation(values);
  const localColdRisk = Math.min(...values) < targetTemperatureC - 2;
  const localOverheatRisk = Math.max(...values) > targetTemperatureC + 2.5;

  let rating: "comfortable" | "attention" | "critical" = "comfortable";
  let explanation = "Средняя температура близка к целевой, а поле достаточно равномерно для инженерной предварительной оценки.";
  if (Math.abs(deviationFromTargetC) > 1 || occupiedBandSpreadC > 2 || localColdRisk || localOverheatRisk) {
    rating = "attention";
    explanation = "Есть локальные отклонения от целевой температуры или заметная неравномерность по плану.";
  }
  if (Math.abs(deviationFromTargetC) > 2 || occupiedBandSpreadC > 3.5 || (localColdRisk && localOverheatRisk)) {
    rating = "critical";
    explanation = "Поле выраженно неравномерно или средняя температура существенно отклоняется от целевой.";
  }

  return {
    targetTemperatureC,
    meanAirTemperatureC,
    occupiedMeanTemperatureC,
    deviationFromTargetC,
    occupiedBandSpreadC,
    fieldSpreadC,
    standardDeviationC,
    localColdRisk,
    localOverheatRisk,
    rating,
    explanation,
  };
}

function buildSurfaceBoundaryTemperatures(
  surface: ThermalSurfaceEstimate,
  roomBalanceById: Map<string, ThermalPhysicsModel["roomBalances"] extends Map<string, infer T> ? T : never>,
  outdoorTemperatureC: number,
  options: ResolvedEngineeringOptions
): SurfaceBoundaryTemperatures {
  const positiveRoomTemperatureC =
    surface.positiveRoomId ? roomBalanceById.get(surface.positiveRoomId)?.airTemperatureC ?? outdoorTemperatureC : outdoorTemperatureC;
  const negativeRoomTemperatureC =
    surface.negativeRoomId ? roomBalanceById.get(surface.negativeRoomId)?.airTemperatureC ?? outdoorTemperatureC : outdoorTemperatureC;

  const wallProps = computeWallProperties(surface.wall.layers, surface.wall.wallAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID);
  const fallbackProps = computeWallProperties(undefined, DEFAULT_WALL_ASSEMBLY_ID);
  const layerResistance = wallProps?.rValue ?? fallbackProps?.rValue ?? 0;
  const wallResistanceExternal =
    options.surfaceResistances.internal_m2K_W + layerResistance + options.surfaceResistances.external_m2K_W;
  const wallResistanceInternal = options.surfaceResistances.internal_m2K_W * 2 + layerResistance;

  const wallByRoomId: Record<string, number> = {};
  const windowByRoomId: Record<string, number> = {};
  const doorByRoomId: Record<string, number> = {};

  if (surface.kind === "external") {
    const roomId = surface.positiveRoomId ?? surface.negativeRoomId;
    const roomTemperatureC = roomId === surface.positiveRoomId ? positiveRoomTemperatureC : negativeRoomTemperatureC;
    const wallSurfaceTemperatureC = computeExternalSurfaceTemperature(
      roomTemperatureC,
      outdoorTemperatureC,
      wallResistanceExternal,
      options.surfaceResistances.internal_m2K_W
    );
    const windowSurfaceTemperatureC = computeExternalSurfaceTemperature(
      roomTemperatureC,
      outdoorTemperatureC,
      1 / Math.max(options.windowU_W_m2K, 1e-6),
      options.surfaceResistances.internal_m2K_W
    );
    const doorSurfaceTemperatureC = computeExternalSurfaceTemperature(
      roomTemperatureC,
      outdoorTemperatureC,
      1 / Math.max(options.doorU_W_m2K, 1e-6),
      options.surfaceResistances.internal_m2K_W
    );
    if (roomId) {
      wallByRoomId[roomId] = wallSurfaceTemperatureC;
      windowByRoomId[roomId] = windowSurfaceTemperatureC;
      doorByRoomId[roomId] = doorSurfaceTemperatureC;
    }
    return { wallByRoomId, windowByRoomId, doorByRoomId };
  }

  if (surface.positiveRoomId && surface.negativeRoomId) {
    const [positiveSurfaceTemperatureC, negativeSurfaceTemperatureC] = computeInternalSurfaceTemperatures(
      positiveRoomTemperatureC,
      negativeRoomTemperatureC,
      wallResistanceInternal,
      options.surfaceResistances.internal_m2K_W
    );
    wallByRoomId[surface.positiveRoomId] = positiveSurfaceTemperatureC;
    wallByRoomId[surface.negativeRoomId] = negativeSurfaceTemperatureC;
    windowByRoomId[surface.positiveRoomId] = positiveSurfaceTemperatureC;
    windowByRoomId[surface.negativeRoomId] = negativeSurfaceTemperatureC;
    doorByRoomId[surface.positiveRoomId] = positiveSurfaceTemperatureC;
    doorByRoomId[surface.negativeRoomId] = negativeSurfaceTemperatureC;
  }

  return { wallByRoomId, windowByRoomId, doorByRoomId };
}

function computeExternalSurfaceTemperature(
  indoorTemperatureC: number,
  outdoorTemperatureC: number,
  totalResistance_m2K_W: number,
  internalSurfaceResistance_m2K_W: number
): number {
  const heatFlux_W_m2 = (indoorTemperatureC - outdoorTemperatureC) / Math.max(totalResistance_m2K_W, 1e-6);
  return indoorTemperatureC - heatFlux_W_m2 * internalSurfaceResistance_m2K_W;
}

function computeInternalSurfaceTemperatures(
  positiveRoomTemperatureC: number,
  negativeRoomTemperatureC: number,
  totalResistance_m2K_W: number,
  internalSurfaceResistance_m2K_W: number
): [number, number] {
  const heatFlux_W_m2 = (positiveRoomTemperatureC - negativeRoomTemperatureC) / Math.max(totalResistance_m2K_W, 1e-6);
  return [
    positiveRoomTemperatureC - heatFlux_W_m2 * internalSurfaceResistance_m2K_W,
    negativeRoomTemperatureC + heatFlux_W_m2 * internalSurfaceResistance_m2K_W,
  ];
}

function buildDistributedSources(
  model: BuildingModel,
  roomById: Map<string, ReturnType<typeof buildGeometryRenderModel>["roomVolumes"][number]>,
  roomBalanceById: Map<string, ThermalPhysicsModel["roomBalances"] extends Map<string, infer T> ? T : never>,
  targetLevelId: string
): DistributedSource[] {
  const sources: DistributedSource[] = [];

  roomBalanceById.forEach((balance, roomId) => {
    if (balance.lightingGainW > 0) {
      sources.push({
        id: `${roomId}:lighting`,
        roomId,
        levelId: targetLevelId,
        powerW: balance.lightingGainW,
        distribution: "uniform",
      });
    }
    if (balance.occupancyGainW > 0) {
      sources.push({
        id: `${roomId}:occupancy`,
        roomId,
        levelId: targetLevelId,
        powerW: balance.occupancyGainW,
        distribution: "uniform",
      });
    }
  });

  roomBalanceById.forEach((balance, roomId) => {
    const room = roomById.get(roomId);
    if (!room) {
      return;
    }
    const hostedHeating = model.equipment.filter((item) => {
      if (item.levelId !== targetLevelId || item.state !== "on") {
        return false;
      }
      const hosted = item.roomId === roomId || polygonContainsPoint(item.position, room.polygon);
      return hosted && (item.type === "radiator" || item.type === "fancoil");
    });
    distributeEquipmentPower(
      sources,
      hostedHeating,
      balance.heatingDeliveredW,
      roomId,
      targetLevelId,
      `${roomId}:heating`,
      0.7
    );

    const hostedEquipment = model.equipment.filter((item) => {
      if (item.levelId !== targetLevelId || item.state !== "on") {
        return false;
      }
      const hosted = item.roomId === roomId || polygonContainsPoint(item.position, room.polygon);
      return hosted && item.type !== "radiator" && item.type !== "fancoil";
    });
    distributeEquipmentPower(
      sources,
      hostedEquipment,
      balance.equipmentGainW,
      roomId,
      targetLevelId,
      `${roomId}:equipment`,
      0.75
    );

    const solarSurfaces = model.walls
      .filter((wall) => wall.levelId === targetLevelId)
      .map((wall) => ({
        wall,
        roomHosted:
          polygonContainsPoint({ x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 }, room.polygon),
      }))
      .filter((entry) => entry.roomHosted);

    if (balance.solarGainW > 0) {
      if (solarSurfaces.length) {
        const shareW = balance.solarGainW / solarSurfaces.length;
        solarSurfaces.forEach((entry, index) => {
          sources.push({
            id: `${roomId}:solar:${index}`,
            roomId,
            levelId: targetLevelId,
            powerW: shareW,
            distribution: "localized",
            position: {
              x: (entry.wall.a.x + entry.wall.b.x) / 2,
              y: (entry.wall.a.y + entry.wall.b.y) / 2,
            },
            radiusM: 0.95,
          });
        });
      } else {
        sources.push({
          id: `${roomId}:solar`,
          roomId,
          levelId: targetLevelId,
          powerW: balance.solarGainW,
          distribution: "uniform",
        });
      }
    }
  });

  model.pipes.forEach((pipe) => {
    if (pipe.levelId !== targetLevelId || pipe.path.length < 2) {
      return;
    }
    pipe.path.slice(1).forEach((point, index) => {
      const start = pipe.path[index];
      const center = { x: (start.x + point.x) / 2, y: (start.y + point.y) / 2 };
      const room = Array.from(roomById.values()).find((candidate) => polygonContainsPoint(center, candidate.polygon));
      if (!room) {
        return;
      }
      const balance = roomBalanceById.get(room.roomId);
      if (!balance || balance.pipeGainW <= 0) {
        return;
      }
      sources.push({
        id: `${pipe.id}:${index}`,
        roomId: room.roomId,
        levelId: targetLevelId,
        powerW: balance.pipeGainW / Math.max(pipe.path.length - 1, 1),
        distribution: "localized",
        position: center,
        radiusM: 0.45,
      });
    });
  });

  return sources.filter((source) => source.powerW > 0);
}

function distributeEquipmentPower(
  target: DistributedSource[],
  equipment: BuildingModel["equipment"],
  totalPowerW: number,
  roomId: string,
  levelId: string,
  idPrefix: string,
  radiusM: number
) {
  if (totalPowerW <= 0) {
    return;
  }
  if (!equipment.length) {
    target.push({
      id: idPrefix,
      roomId,
      levelId,
      powerW: totalPowerW,
      distribution: "uniform",
    });
    return;
  }
  const weights = equipment.map((item) => resolveNominalPower(item));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  equipment.forEach((item, index) => {
    target.push({
      id: `${idPrefix}:${item.id}`,
      roomId,
      levelId,
      powerW: totalPowerW * (weights[index] / Math.max(totalWeight, 1)),
      distribution: "localized",
      position: item.position,
      radiusM,
    });
  });
}

function resolveNominalPower(item: BuildingModel["equipment"][number]): number {
  if (typeof item.params.nominalPowerW === "number" && item.params.nominalPowerW > 0) {
    return item.params.nominalPowerW;
  }
  switch (item.type) {
    case "radiator":
      return 1400;
    case "fancoil":
      return 950;
    case "ahu":
      return 320;
    case "pump":
      return 90;
    case "boiler":
      return 220;
    case "diffuser":
      return 45;
    case "sensor":
    default:
      return 8;
  }
}

function addUniformSource(cells: GridCell[], powerW: number) {
  const totalVolumeM3 = cells.reduce((sum, cell) => sum + cell.volumeM3, 0);
  if (totalVolumeM3 <= 0) {
    return;
  }
  const densityW_m3 = powerW / totalVolumeM3;
  cells.forEach((cell) => {
    cell.sourceDensityW_m3 += densityW_m3;
  });
}

function addLocalizedSource(cells: GridCell[], powerW: number, position: Vec2, radiusM: number) {
  const sigmaM = Math.max(radiusM * 0.6, MIN_LOCAL_SOURCE_RADIUS_M * 0.45);
  const weightedCells = cells
    .map((cell) => {
      const distanceM = Math.hypot(cell.x - position.x, cell.y - position.y);
      if (distanceM > radiusM * 2.8) {
        return null;
      }
      const weight = Math.exp(-(distanceM * distanceM) / Math.max(2 * sigmaM * sigmaM, 1e-6));
      return { cell, weight };
    })
    .filter(Boolean) as Array<{ cell: GridCell; weight: number }>;

  if (!weightedCells.length) {
    const nearest = cells.reduce<{ cell: GridCell | null; distanceM: number }>(
      (best, cell) => {
        const distanceM = Math.hypot(cell.x - position.x, cell.y - position.y);
        return distanceM < best.distanceM ? { cell, distanceM } : best;
      },
      { cell: null, distanceM: Number.POSITIVE_INFINITY }
    ).cell;
    if (nearest && nearest.volumeM3 > 0) {
      nearest.sourceDensityW_m3 += powerW / nearest.volumeM3;
    }
    return;
  }

  const totalWeight = weightedCells.reduce((sum, item) => sum + item.weight, 0);
  weightedCells.forEach(({ cell, weight }) => {
    if (cell.volumeM3 <= 0) {
      return;
    }
    cell.sourceDensityW_m3 += (powerW * weight) / Math.max(totalWeight, 1e-6) / cell.volumeM3;
  });
}

function resolveNeighborTemperature(grid: GridCell[][], row: number, col: number, cell: GridCell): number {
  const neighbor = grid[row]?.[col] ?? null;
  if (neighbor?.valid && neighbor.roomId === cell.roomId) {
    return neighbor.temperatureC;
  }
  if (cell.boundaryTemperatureC !== null) {
    return cell.boundaryTemperatureC;
  }
  return cell.temperatureC;
}

function pickCharacteristicCells(cells: EngineeringFieldCell[], category: "hot" | "cold" | "occupied"): EngineeringFieldZone[] {
  const meanValue = average(cells.map((cell) => cell.temperatureC));
  const source =
    category === "occupied"
      ? [...cells].sort((left, right) => Math.abs(left.temperatureC - meanValue) - Math.abs(right.temperatureC - meanValue))
      : [...cells].sort((left, right) => (category === "cold" ? left.temperatureC - right.temperatureC : right.temperatureC - left.temperatureC));
  return source.slice(0, 4).map((cell, index) => ({
    label: `${category}-${index + 1}`,
    roomId: cell.roomId,
    x: cell.x,
    y: cell.y,
    temperatureC: cell.temperatureC,
    category,
  }));
}

function mapBand(
  grid: GridCell[][],
  predicate: (cell: GridCell) => boolean,
  category: EngineeringFieldZone["category"]
): EngineeringFieldZone[] {
  return grid
    .flatMap((row) => row)
    .filter((cell) => predicate(cell))
    .slice(0, 12)
    .map((cell, index) => ({
      label: `${category}-${index + 1}`,
      roomId: cell.roomId,
      x: cell.x,
      y: cell.y,
      temperatureC: cell.temperatureC,
      category,
    }));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}
