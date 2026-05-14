import { polygonArea } from "../../entities/geometry/geom";
import { computeWallProperties, DEFAULT_WALL_ASSEMBLY_ID } from "../../entities/material/types";
import { buildAdjacencyGraph } from "../graph/adjacency";
const AIR_DENSITY_KG_M3 = 1.204; // kg/m3
const AIR_CP_J_KG_K = 1005; // J/(kg·K)
const MIN_AREA_M2 = 0.5;
const MIN_HEIGHT_M = 2.5;
export function buildThermalModel(building, options = {}) {
    if (!building.rooms.length) {
        throw new Error("Добавьте хотя бы одно помещение для построения тепловой модели.");
    }
    const adjacency = options.adjacency ?? buildAdjacencyGraph(building);
    const infiltrationACH = options.infiltrationACH ?? 0.5;
    const defaultHeight = options.defaultHeight_m ?? MIN_HEIGHT_M;
    const defaultAssembly = options.defaultAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID;
    const effectiveMassFactor = Math.max(1, options.effectiveMassFactor ?? 1);
    const zones = building.rooms.map((room) => buildZone(room, building, infiltrationACH, defaultHeight, effectiveMassFactor));
    const wallMap = new Map(building.walls.map((wall) => [wall.id, wall]));
    const internalLinks = adjacency.graph.edges.map((edge, index) => {
        const conductance = resolveConductance(edge.wallId, edge.area_m2, wallMap, defaultAssembly);
        return {
            id: `internal_${edge.wallId}_${index}`,
            fromZoneId: edge.roomA,
            toZoneId: edge.roomB,
            conductance_W_K: conductance,
            area_m2: edge.area_m2,
            kind: "internal",
            wallId: edge.wallId,
        };
    });
    const outdoorLinks = adjacency.graph.outdoorEdges.map((edge, index) => {
        const conductance = resolveConductance(edge.wallId, edge.area_m2, wallMap, defaultAssembly);
        return {
            id: `outdoor_${edge.wallId}_${index}`,
            fromZoneId: edge.roomId,
            toZoneId: "outdoor",
            conductance_W_K: conductance,
            area_m2: edge.area_m2,
            kind: "external",
            wallId: edge.wallId,
        };
    });
    zones.forEach((zone) => {
        if (!outdoorLinks.some((link) => link.fromZoneId === zone.id)) {
            const perimeter = 4 * Math.sqrt(zone.area_m2);
            const area = perimeter * Math.max(defaultHeight, MIN_HEIGHT_M);
            outdoorLinks.push({
                id: `outdoor_fallback_${zone.id}`,
                fromZoneId: zone.id,
                toZoneId: "outdoor",
                conductance_W_K: resolveConductance(undefined, area, wallMap, defaultAssembly),
                area_m2: area,
                kind: "external",
            });
        }
    });
    return {
        model: {
            zones,
            internalLinks,
            outdoorLinks,
        },
        adjacency,
    };
}
function buildZone(room, building, infiltrationACH, defaultHeight, effectiveMassFactor) {
    const level = building.levels.find((lvl) => lvl.id === room.levelId);
    const height = Math.max(level?.height_m ?? defaultHeight, MIN_HEIGHT_M);
    const area = Math.max(MIN_AREA_M2, Math.abs(polygonArea(room.polygon)));
    const volume = area * height;
    const capacitance = AIR_DENSITY_KG_M3 * volume * AIR_CP_J_KG_K * Math.max(1, effectiveMassFactor);
    const infiltrationConductance = (AIR_DENSITY_KG_M3 * AIR_CP_J_KG_K * infiltrationACH * volume) / 3600;
    return {
        id: room.id,
        name: room.name,
        area_m2: area,
        volume_m3: volume,
        capacitance_J_K: capacitance,
        infiltrationACH,
        infiltrationConductance_W_K: infiltrationConductance,
    };
}
function resolveConductance(wallId, area_m2, wallMap, fallbackAssemblyId) {
    if (!Number.isFinite(area_m2) || area_m2 <= 0) {
        return 0;
    }
    const fallbackProps = computeWallProperties(undefined, fallbackAssemblyId);
    if (!wallId) {
        return area_m2 * (fallbackProps?.uValue ?? 0);
    }
    const wall = wallMap.get(wallId);
    const props = wall
        ? computeWallProperties(wall.layers, wall.wallAssemblyId ?? fallbackAssemblyId)
        : computeWallProperties(undefined, fallbackAssemblyId);
    const uValue = props?.uValue ?? fallbackProps?.uValue ?? 0;
    return area_m2 * uValue;
}
