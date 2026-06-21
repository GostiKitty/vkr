import { sampleWallSurfaceTemperatures } from "../../../core/thermal/field";
import { buildSimplePreviewBounds, resolveSimplePreviewLevelId } from "./simplePreviewMath";
export const DEBUG_SIMPLE_3D = false;
function logDebug(message, payload) {
    if (DEBUG_SIMPLE_3D) {
        console.info("[simple-3d]", message, payload);
    }
}
export function planToSimpleScene(point, elevation_m) {
    return {
        x: point.x,
        y: elevation_m,
        z: point.y,
    };
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function computePolygonBounds(points) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    });
    return { minX, minY, maxX, maxY };
}
function polygonsRoughlyAlign(primary, candidate) {
    if (primary.length < 3 || candidate.length < 3) {
        return false;
    }
    const primaryBounds = computePolygonBounds(primary);
    const candidateBounds = computePolygonBounds(candidate);
    const width = Math.max(primaryBounds.maxX - primaryBounds.minX, 0.01);
    const height = Math.max(primaryBounds.maxY - primaryBounds.minY, 0.01);
    const marginX = Math.max(0.35, width * 0.08);
    const marginY = Math.max(0.35, height * 0.08);
    return !(candidateBounds.minX < primaryBounds.minX - marginX ||
        candidateBounds.maxX > primaryBounds.maxX + marginX ||
        candidateBounds.minY < primaryBounds.minY - marginY ||
        candidateBounds.maxY > primaryBounds.maxY + marginY);
}
function getLevelElevation(model, levelId) {
    return model.levels.find((level) => level.id === levelId)?.elevation_m ?? 0;
}
function resolveOpeningPlacement(wall, opening, levelElevation_m, type) {
    if (!wall) {
        return null;
    }
    const dx = wall.b.x - wall.a.x;
    const dz = wall.b.y - wall.a.y;
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) {
        return null;
    }
    const dirX = dx / length;
    const dirZ = dz / length;
    const anchorT = Number.isFinite(opening.anchor.t) ? opening.anchor.t : 0;
    const offsetRatio = Number.isFinite(opening.anchor.offset_m) ? opening.anchor.offset_m / length : anchorT;
    const t = clamp(anchorT > 0 && anchorT < 1 ? anchorT : offsetRatio, 0, 1);
    const baseX = wall.a.x + dx * t;
    const baseZ = wall.a.y + dz * t;
    const normalX = -dirZ;
    const normalZ = dirX;
    const depth_m = Math.max(Math.min(wall.thickness_m * 0.22, 0.12), 0.05);
    const surfaceOffset_m = wall.thickness_m * 0.5 + depth_m * 0.55 + 0.012;
    const centerX = baseX + normalX * surfaceOffset_m;
    const centerZ = baseZ + normalZ * surfaceOffset_m;
    const height_m = Math.max(opening.height_m || (type === "door" ? 2.1 : 1.4), type === "door" ? 2 : 1.1);
    const sill_m = type === "door" ? 0 : Math.max(opening.sill_m ?? 0.9, 0.1);
    const centerY = levelElevation_m + sill_m + height_m * 0.5;
    return {
        id: opening.id,
        type,
        levelId: wall.levelId,
        center: { x: centerX, y: centerY, z: centerZ },
        wallCenter: { x: baseX, y: centerY, z: baseZ },
        width_m: Math.max(opening.width_m || 0.9, type === "door" ? 0.8 : 0.6),
        height_m,
        depth_m,
        rotationY_rad: -Math.atan2(dz, dx),
        wallId: wall.id,
        onWall: true,
        uValue_W_m2K: opening.runtimeU_W_m2K,
        envelopePresetId: opening.envelopePresetId,
    };
}
function buildSimpleOpenings(model, levelId, type) {
    const wallsById = new Map(model.walls.map((wall) => [wall.id, wall]));
    const source = type === "window" ? model.windows : model.doors;
    return source
        .map((opening) => {
        const wall = opening.anchor.wallId ? wallsById.get(opening.anchor.wallId) ?? null : null;
        if (!wall) {
            return null;
        }
        if (levelId && wall.levelId !== levelId) {
            return null;
        }
        return resolveOpeningPlacement(wall, opening, getLevelElevation(model, wall.levelId), type);
    })
        .filter((item) => Boolean(item));
}
function buildSimpleTemperatureSurfaces(model, levelId, thermalField, showTemperature, showWallTemperature) {
    const surfaces = [];
    const warnings = [];
    if (!showTemperature && !showWallTemperature) {
        return { surfaces, summary: null };
    }
    if (!thermalField) {
        return {
            surfaces,
            summary: {
                min_C: 0,
                max_C: 0,
                average_C: 0,
                warnings: ["Нет температурных данных."],
            },
        };
    }
    if (showTemperature) {
        thermalField.rooms.forEach((room) => {
            if (levelId && room.levelId !== levelId) {
                return;
            }
            const existingRoom = model.rooms.find((item) => item.id === room.roomId);
            if (!existingRoom) {
                warnings.push(`Температурная комната ${room.roomId} не найдена в модели.`);
                return;
            }
            if (!polygonsRoughlyAlign(existingRoom.polygon, room.polygon)) {
                warnings.push(`Температурный слой для помещения ${room.roomId} отключен: геометрия не согласована с планом.`);
                return;
            }
            surfaces.push({
                id: `room:${room.roomId}`,
                sourceType: "room",
                levelId: room.levelId,
                boundary: existingRoom.polygon.map((point) => ({ ...point })),
                temperature_C: room.baseTemperatureC,
            });
            if (!existingRoom) {
                warnings.push(`Температурная комната ${room.roomId} не найдена в модели.`);
            }
        });
    }
    if (showWallTemperature) {
        thermalField.boundaries.forEach((boundary) => {
            if (levelId && boundary.levelId !== levelId) {
                return;
            }
            const wallSample = sampleWallSurfaceTemperatures(thermalField, boundary.wallId);
            if (!wallSample) {
                return;
            }
            surfaces.push({
                id: `wall:${boundary.wallId}`,
                sourceType: "wall",
                levelId: boundary.levelId,
                wall: {
                    start: { ...boundary.wall.a },
                    end: { ...boundary.wall.b },
                    thickness_m: boundary.wall.thickness_m,
                    height_m: boundary.wall.height_m,
                    elevation_m: getLevelElevation(model, boundary.levelId),
                },
                temperature_C: wallSample.averageC,
            });
        });
    }
    const temperatures = surfaces.map((surface) => surface.temperature_C).filter(Number.isFinite);
    return {
        surfaces,
        summary: temperatures.length
            ? {
                min_C: Math.min(...temperatures),
                max_C: Math.max(...temperatures),
                average_C: temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length,
                warnings,
            }
            : {
                min_C: thermalField.minTemperatureC,
                max_C: thermalField.maxTemperatureC,
                average_C: (thermalField.minTemperatureC + thermalField.maxTemperatureC) * 0.5,
                warnings: warnings.length ? warnings : ["Нет температурных поверхностей для текущего уровня."],
            },
    };
}
export function buildSimple3DModel(model, activeLevelId, options = {}) {
    const levelId = resolveSimplePreviewLevelId(model, activeLevelId);
    const bounds = buildSimplePreviewBounds(model, levelId);
    const showNetworks = options.showNetworks ?? true;
    const showEquipment = options.showEquipment ?? true;
    const showTemperature = options.showTemperature ?? false;
    const showWallTemperature = options.showWallTemperature ?? false;
    const simpleRooms = model.rooms
        .filter((room) => !levelId || room.levelId === levelId)
        .map((room) => ({
        id: room.id,
        levelId: room.levelId,
        boundary: room.polygon.map((point) => ({ ...point })),
        elevation_m: getLevelElevation(model, room.levelId),
        temperature_C: options.thermalField?.roomMap.get(room.id)?.baseTemperatureC ?? null,
    }));
    const simpleWalls = model.walls
        .filter((wall) => !levelId || wall.levelId === levelId)
        .map((wall) => ({
        id: wall.id,
        levelId: wall.levelId,
        start: { ...wall.a },
        end: { ...wall.b },
        elevation_m: getLevelElevation(model, wall.levelId),
        height_m: wall.height_m,
        thickness_m: wall.thickness_m,
        temperature_C: options.thermalField ? sampleWallSurfaceTemperatures(options.thermalField, wall.id)?.averageC ?? null : null,
    }));
    const simpleWindows = buildSimpleOpenings(model, levelId, "window");
    const simpleDoors = buildSimpleOpenings(model, levelId, "door");
    // Вычисляем реальный верх стен для каждого уровня, чтобы не было разрыва между
    // крышей и зданием: крыша не может начинаться ниже, чем верхняя грань стен.
    const wallTopByLevel = new Map();
    model.walls.forEach((wall) => {
        const levelElev = getLevelElevation(model, wall.levelId);
        const wallTop = levelElev + Math.max(wall.height_m, 2.4);
        const current = wallTopByLevel.get(wall.levelId) ?? 0;
        wallTopByLevel.set(wall.levelId, Math.max(current, wallTop));
    });
    const simpleRoofs = (model.roofs ?? [])
        .filter((roof) => !levelId || roof.levelId === levelId)
        .map((roof) => {
        const wallTop = wallTopByLevel.get(roof.levelId);
        // Прижимаем низ крыши к верху стен; если elevationBase уже выше — оставляем как есть
        const elevation_m = wallTop !== undefined ? Math.max(roof.elevationBase_m, wallTop) : roof.elevationBase_m;
        return {
            id: roof.id,
            levelId: roof.levelId,
            boundary: roof.boundary.map((point) => ({ ...point })),
            elevation_m,
            thickness_m: roof.thickness_m,
            kind: roof.kind,
            slope: roof.slope ? { ...roof.slope } : undefined,
        };
    });
    const simpleSlabs = (model.floorSlabs ?? [])
        .filter((slab) => !levelId || slab.levelId === levelId)
        .map((slab) => ({
        id: slab.id,
        levelId: slab.levelId,
        boundary: slab.boundary.map((point) => ({ ...point })),
        elevation_m: slab.elevation_m,
        thickness_m: slab.thickness_m,
    }));
    const simplePipes = showNetworks
        ? model.pipes
            .filter((pipe) => !levelId || pipe.levelId === levelId)
            .map((pipe) => {
            const elevation_m = getLevelElevation(model, pipe.levelId) + 0.24;
            return {
                id: pipe.id,
                levelId: pipe.levelId,
                path: pipe.path.map((point) => planToSimpleScene(point, elevation_m)),
                diameter_m: Math.max(pipe.diameter_mm / 1000, 0.025),
                colorRole: pipe.type === "heating_return" ? "return" : "supply",
            };
        })
        : [];
    const simpleDucts = showNetworks
        ? model.ducts
            .filter((duct) => !levelId || duct.levelId === levelId)
            .map((duct) => {
            const elevation_m = getLevelElevation(model, duct.levelId) + 2.3;
            return {
                id: duct.id,
                levelId: duct.levelId,
                path: duct.path.map((point) => planToSimpleScene(point, elevation_m)),
                width_m: Math.max(0.12, (duct.section.width_mm ?? duct.section.diameter_mm ?? 300) / 1000),
                height_m: Math.max(0.08, (duct.section.height_mm ?? duct.section.diameter_mm ?? 240) / 1000),
            };
        })
        : [];
    const simpleEquipment = showEquipment
        ? model.equipment
            .filter((item) => !levelId || item.levelId === levelId)
            .map((item) => ({
            id: item.id,
            levelId: item.levelId,
            type: item.type,
            position: planToSimpleScene(item.position, getLevelElevation(model, item.levelId) + (item.type === "diffuser" ? 2.7 : item.type === "radiator" ? 0.28 : item.type === "boiler" ? 0.5 : 0.24)),
        }))
        : [];
    const simpleSensors = showEquipment
        ? model.sensors
            .filter((sensor) => !levelId || sensor.levelId === levelId)
            .map((sensor) => ({
            id: sensor.id,
            levelId: sensor.levelId,
            position: planToSimpleScene(sensor.position, getLevelElevation(model, sensor.levelId) + 1.6),
        }))
        : [];
    const temperatureBuild = buildSimpleTemperatureSurfaces(model, levelId, options.thermalField ?? null, showTemperature, showWallTemperature);
    const result = {
        levelId,
        simpleRooms,
        simpleWalls,
        simpleWindows,
        simpleDoors,
        simpleRoofs,
        simpleSlabs,
        simplePipes,
        simpleDucts,
        simpleEquipment,
        simpleSensors,
        simpleTemperatureSurfaces: temperatureBuild.surfaces,
        temperatureSummary: temperatureBuild.summary,
        bounds,
        warnings: temperatureBuild.summary?.warnings ?? [],
    };
    logDebug("counts", {
        rooms: result.simpleRooms.length,
        walls: result.simpleWalls.length,
        windows: result.simpleWindows.length,
        doors: result.simpleDoors.length,
        roofs: result.simpleRoofs.length,
        slabs: result.simpleSlabs.length,
        pipes: result.simplePipes.length,
        ducts: result.simpleDucts.length,
        equipment: result.simpleEquipment.length + result.simpleSensors.length,
        thermalSurfaces: result.simpleTemperatureSurfaces.length,
    });
    return result;
}
