import { polygonArea, polygonCentroid, polygonContainsPoint } from "../../entities/geometry/geom";
import { computeWallProperties, DEFAULT_WALL_ASSEMBLY_ID } from "../../entities/material/types";
import { getEnvelopePreset, resolveDefaultPresetId, resolvePresetLayers } from "../../entities/envelope/envelopePresets";
import { buildAdjacencyGraph } from "../graph/adjacency";
import { buildGeometryRenderModel } from "../geometry/bimPipeline";
import { airflowFromACH } from "./formulas";
import { computeWallFacadeConductances, computeFallbackFacadeConductance_W_K } from "./wallFacadeThermal";
const AIR_DENSITY_KG_M3 = 1.204; // kg/m3
const AIR_CP_J_KG_K = 1005; // J/(kg·K)
const MIN_AREA_M2 = 0.5;
const MIN_HEIGHT_M = 2.5;
/**
 * Поправочный коэффициент для потерь через пол по грунту.
 * Грунт у основания фундамента теплее наружного воздуха на 25–30 °C.
 * Для Москвы: (21−2)/(21−(−25)) ≈ 0,41 → принято 0,4.
 */
const GROUND_FLOOR_CORRECTION = 0.4;
export function buildThermalModel(building, options = {}) {
    if (!building.rooms.length) {
        throw new Error("Добавьте хотя бы одно помещение для построения тепловой модели.");
    }
    const adjacency = options.adjacency ?? buildAdjacencyGraph(building);
    const infiltrationACH = options.infiltrationCalculation?.calculatedACH ?? options.infiltrationACH ?? 0.5;
    const ventilationACH = options.ventilationACH ?? 0;
    const heatRecoveryFactor = Math.min(1, Math.max(0, options.heatRecoveryFactor ?? 0));
    const defaultHeight = options.defaultHeight_m ?? MIN_HEIGHT_M;
    const defaultAssembly = options.defaultAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID;
    const effectiveMassFactor = Math.max(1, options.effectiveMassFactor ?? 1);
    const warnings = [];
    const renderGeometry = buildGeometryRenderModel(building);
    const openingsByWallId = new Map();
    renderGeometry.walls.forEach(({ wall, openings }) => {
        openingsByWallId.set(wall.id, openings);
    });
    const zones = building.rooms.map((room) => buildZone(room, building, infiltrationACH, options.infiltrationCalculation, ventilationACH, heatRecoveryFactor, defaultHeight, effectiveMassFactor));
    const wallMap = new Map(building.walls.map((wall) => [wall.id, wall]));
    const internalLinks = adjacency.graph.edges.map((edge, index) => {
        const wall = wallMap.get(edge.wallId);
        const openings = openingsByWallId.get(edge.wallId) ?? [];
        const conductance = resolveConductanceForWall(wall, openings, edge.area_m2, defaultAssembly, warnings);
        return {
            id: `internal_${edge.wallId}_${index}`,
            fromZoneId: edge.roomA,
            toZoneId: edge.roomB,
            conductance_W_K: conductance.total_W_K,
            area_m2: edge.area_m2,
            kind: "internal",
            wallId: edge.wallId,
        };
    });
    const outdoorLinks = adjacency.graph.outdoorEdges.map((edge, index) => {
        const wall = wallMap.get(edge.wallId);
        const openings = openingsByWallId.get(edge.wallId) ?? [];
        const conductance = resolveConductanceForWall(wall, openings, edge.area_m2, defaultAssembly, warnings);
        return {
            id: `outdoor_${edge.wallId}_${index}`,
            fromZoneId: edge.roomId,
            toZoneId: "outdoor",
            conductance_W_K: conductance.total_W_K,
            conductanceOpaque_W_K: conductance.opaque_W_K,
            conductanceWindow_W_K: conductance.window_W_K,
            conductanceDoor_W_K: conductance.door_W_K,
            area_m2: edge.area_m2,
            kind: "external",
            wallId: edge.wallId,
        };
    });
    zones.forEach((zone) => {
        if (!outdoorLinks.some((link) => link.fromZoneId === zone.id)) {
            warnings.push(`Зона «${zone.name}» (${zone.id}): в графе смежности нет наружных стен — добавлен запасной наружный контур по периметру площади. Проверьте стены и привязку к уровню.`);
            const perimeter = 4 * Math.sqrt(zone.area_m2);
            const area = perimeter * Math.max(defaultHeight, MIN_HEIGHT_M);
            const fb = computeFallbackFacadeConductance_W_K(area, defaultAssembly);
            outdoorLinks.push({
                id: `outdoor_fallback_${zone.id}`,
                fromZoneId: zone.id,
                toZoneId: "outdoor",
                conductance_W_K: fb,
                conductanceOpaque_W_K: fb,
                conductanceWindow_W_K: 0,
                conductanceDoor_W_K: 0,
                area_m2: area,
                kind: "external",
            });
        }
    });
    // Потери через кровлю (верхний уровень) и пол по грунту (нижний уровень)
    const envelopeLinks = buildHorizontalEnvelopeLinks(building, zones);
    outdoorLinks.push(...envelopeLinks);
    // Теплообмен через межэтажные перекрытия (внутренняя связь между этажами)
    const interfloorLinks = buildInterfloorSlabLinks(building, zones);
    internalLinks.push(...interfloorLinks);
    return {
        model: {
            zones,
            internalLinks,
            outdoorLinks,
            infiltrationCalculation: options.infiltrationCalculation,
        },
        adjacency,
        warnings,
    };
}
function buildZone(room, building, infiltrationACH, infiltrationCalculation, ventilationACH, heatRecoveryFactor, defaultHeight, effectiveMassFactor) {
    const level = building.levels.find((lvl) => lvl.id === room.levelId);
    const height = Math.max(level?.height_m ?? defaultHeight, MIN_HEIGHT_M);
    const area = Math.max(MIN_AREA_M2, Math.abs(polygonArea(room.polygon)));
    const volume = area * height;
    const capacitance = AIR_DENSITY_KG_M3 * volume * AIR_CP_J_KG_K * Math.max(1, effectiveMassFactor);
    const infiltrationConductance = AIR_DENSITY_KG_M3 * AIR_CP_J_KG_K * airflowFromACH(infiltrationACH, volume);
    const ventilationConductance = ventilationACH > 0
        ? AIR_DENSITY_KG_M3 * AIR_CP_J_KG_K * airflowFromACH(ventilationACH, volume) * (1 - heatRecoveryFactor)
        : 0;
    return {
        id: room.id,
        name: room.name,
        area_m2: area,
        volume_m3: volume,
        capacitance_J_K: capacitance,
        infiltrationACH,
        infiltrationConductance_W_K: infiltrationConductance,
        infiltrationCalculation,
        ventilationACH,
        ventilationConductance_W_K: ventilationConductance,
    };
}
/**
 * Возвращает проводимости Вт/К через кровлю (верхний уровень) и пол по грунту
 * (нижний уровень). Срабатывает только если в модели есть соответствующие элементы.
 */
function buildHorizontalEnvelopeLinks(building, zones) {
    const hasRoofs = (building.roofs?.length ?? 0) > 0;
    const hasGroundSlabs = (building.floorSlabs ?? []).some((s) => s.kind === "ground");
    if (!hasRoofs && !hasGroundSlabs) {
        return [];
    }
    const sortedByTop = [...building.levels].sort((a, b) => (b.elevation_m + (b.height_m || MIN_HEIGHT_M)) - (a.elevation_m + (a.height_m || MIN_HEIGHT_M)));
    const sortedByBottom = [...building.levels].sort((a, b) => a.elevation_m - b.elevation_m);
    const topLevelId = sortedByTop[0]?.id ?? null;
    const bottomLevelId = sortedByBottom[0]?.id ?? null;
    const roomById = new Map(building.rooms.map((r) => [r.id, r]));
    const links = [];
    for (const zone of zones) {
        const room = roomById.get(zone.id);
        if (!room)
            continue;
        if (hasRoofs && room.levelId === topLevelId) {
            const conductance = resolveRoofConductance(building, room.levelId, zone.area_m2);
            if (conductance > 0) {
                links.push({
                    id: `outdoor_roof_${zone.id}`,
                    fromZoneId: zone.id,
                    toZoneId: "outdoor",
                    conductance_W_K: conductance,
                    conductanceOpaque_W_K: conductance,
                    conductanceWindow_W_K: 0,
                    conductanceDoor_W_K: 0,
                    area_m2: zone.area_m2,
                    kind: "external",
                });
            }
        }
        if (hasGroundSlabs && room.levelId === bottomLevelId) {
            const conductance = resolveGroundFloorConductance(building, room.levelId, zone.area_m2);
            if (conductance > 0) {
                links.push({
                    id: `outdoor_ground_${zone.id}`,
                    fromZoneId: zone.id,
                    toZoneId: "outdoor",
                    conductance_W_K: conductance,
                    conductanceOpaque_W_K: conductance,
                    conductanceWindow_W_K: 0,
                    conductanceDoor_W_K: 0,
                    area_m2: zone.area_m2,
                    kind: "external",
                });
            }
        }
    }
    return links;
}
/**
 * Тепловые связи через межэтажные перекрытия: пары помещений на соседних уровнях,
 * центроид одного попадает в полигон другого (взаимная проверка).
 */
function buildInterfloorSlabLinks(building, zones) {
    const interfloorSlabs = (building.floorSlabs ?? []).filter((s) => s.kind === "interfloor");
    if (!interfloorSlabs.length) {
        return [];
    }
    const sortedLevels = [...building.levels].sort((a, b) => a.elevation_m - b.elevation_m);
    const levelRank = new Map(sortedLevels.map((lvl, idx) => [lvl.id, idx]));
    const roomsByLevel = new Map();
    building.rooms.forEach((room) => {
        const list = roomsByLevel.get(room.levelId) ?? [];
        list.push(room);
        roomsByLevel.set(room.levelId, list);
    });
    const links = [];
    for (const slab of interfloorSlabs) {
        const lowerIdx = levelRank.get(slab.levelId) ?? -1;
        if (lowerIdx < 0 || lowerIdx + 1 >= sortedLevels.length) {
            continue;
        }
        const upperLevelId = sortedLevels[lowerIdx + 1].id;
        const lowerRooms = roomsByLevel.get(slab.levelId) ?? [];
        const upperRooms = roomsByLevel.get(upperLevelId) ?? [];
        const u = resolveInterfloorSlabU(slab);
        for (const lowerRoom of lowerRooms) {
            const lowerCentroid = polygonCentroid(lowerRoom.polygon);
            for (const upperRoom of upperRooms) {
                const upperCentroid = polygonCentroid(upperRoom.polygon);
                const overlaps = polygonContainsPoint(upperCentroid, lowerRoom.polygon) ||
                    polygonContainsPoint(lowerCentroid, upperRoom.polygon);
                if (!overlaps) {
                    continue;
                }
                const lowerArea = Math.abs(polygonArea(lowerRoom.polygon));
                const upperArea = Math.abs(polygonArea(upperRoom.polygon));
                const overlapArea = Math.min(lowerArea, upperArea);
                if (overlapArea <= 0) {
                    continue;
                }
                links.push({
                    id: `interfloor_${slab.id}_${lowerRoom.id}_${upperRoom.id}`,
                    fromZoneId: lowerRoom.id,
                    toZoneId: upperRoom.id,
                    conductance_W_K: u * overlapArea,
                    area_m2: overlapArea,
                    kind: "internal",
                });
            }
        }
    }
    return links;
}
function resolveInterfloorSlabU(slab) {
    const u = resolveLayersConductance(slab.layers, slab.envelopePresetId, "slab");
    return u ?? 1.0;
}
function resolveLayersConductance(layers, presetId, defaultPresetKind) {
    const effectiveLayers = layers?.length
        ? layers
        : (() => {
            const pid = presetId ?? resolveDefaultPresetId(defaultPresetKind);
            const preset = getEnvelopePreset(pid);
            return preset ? resolvePresetLayers(preset) : [];
        })();
    if (!effectiveLayers.length)
        return null;
    const props = computeWallProperties(effectiveLayers, undefined, { includeSp50AirFilms: true });
    return props?.uValue ?? null;
}
function resolveRoofConductance(building, levelId, areaM2) {
    const roof = (building.roofs ?? []).find((r) => r.levelId === levelId) ??
        (building.roofs ?? [])[0];
    if (!roof)
        return 0;
    const u = resolveLayersConductance(roof.layers, roof.envelopePresetId, "roof") ?? 0.35;
    return u * areaM2;
}
function resolveGroundFloorConductance(building, levelId, areaM2) {
    const slab = (building.floorSlabs ?? []).find((s) => s.levelId === levelId && s.kind === "ground");
    if (!slab)
        return 0;
    const u = resolveLayersConductance(slab.layers, slab.envelopePresetId, "slab") ?? 0.5;
    // Поправка на температуру грунта: грунт ≈ +2 °C при расчётном t_out = −25 °C
    return u * areaM2 * GROUND_FLOOR_CORRECTION;
}
function resolveConductanceForWall(wall, openings, area_m2_from_graph, fallbackAssemblyId, warnings) {
    if (!Number.isFinite(area_m2_from_graph) || area_m2_from_graph <= 0) {
        return { total_W_K: 0, opaque_W_K: 0, window_W_K: 0, door_W_K: 0 };
    }
    if (!wall) {
        const g = computeFallbackFacadeConductance_W_K(area_m2_from_graph, fallbackAssemblyId);
        return { total_W_K: g, opaque_W_K: g, window_W_K: 0, door_W_K: 0 };
    }
    const facade = computeWallFacadeConductances(wall, openings, wall.wallAssemblyId ?? fallbackAssemblyId, 1);
    warnings.push(...facade.warnings);
    /** Граф смежности задаёт площадь как L·H; при расхождении с конвейером геометрии масштабируем G. */
    const scale = area_m2_from_graph / Math.max(1e-6, facade.wallAreaM2);
    if (!Number.isFinite(scale) || scale <= 0) {
        return { total_W_K: 0, opaque_W_K: 0, window_W_K: 0, door_W_K: 0 };
    }
    return {
        total_W_K: facade.conductanceTotal_W_K * scale,
        opaque_W_K: facade.conductanceOpaque_W_K * scale,
        window_W_K: facade.conductanceWindow_W_K * scale,
        door_W_K: facade.conductanceDoor_W_K * scale,
    };
}
