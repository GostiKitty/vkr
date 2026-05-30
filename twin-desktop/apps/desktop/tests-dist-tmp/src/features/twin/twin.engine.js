import { polygonArea, polygonCentroid } from "../../entities/geometry/geom";
import { getSpaceDisplayName } from "../../shared/utils/roomNames";
import { estimateExteriorEnvelopeAreaM2, estimateSharedWallAreaM2, twinInternalConductanceWPerK, twinNodeCapacitanceJPerK, twinOutdoorConductanceWPerK, } from "../../core/thermal/twinGraphHeuristics";
const DEFAULT_OUTDOOR_TEMPS = Array.from({ length: 24 }, (_, hour) => 5 + 10 * Math.sin((Math.PI * (hour - 6)) / 12));
export function buildSpaceInstances(spaces) {
    if (!spaces.length) {
        return [];
    }
    const levelMap = new Map();
    for (const space of spaces) {
        const key = space.level?.trim() || "Уровень 1";
        if (!levelMap.has(key))
            levelMap.set(key, []);
        levelMap.get(key).push(space);
    }
    const sortedLevelKeys = Array.from(levelMap.keys()).sort(compareFloorLabels);
    const result = [];
    let elevationOffset = 0;
    for (const levelKey of sortedLevelKeys) {
        const levelSpaces = levelMap.get(levelKey);
        const gridSize = Math.ceil(Math.sqrt(levelSpaces.length));
        const spacing = 4;
        const offset = (gridSize - 1) * spacing * 0.5;
        let maxFloorHeight = 2.5;
        for (const space of levelSpaces) {
            const area = Math.max(space.area_m2 ?? 50, 20);
            const volume = Math.max(space.volume_m3 ?? area * 3, area * 2);
            const h = clamp(volume / area, 2.5, 4.5);
            if (h > maxFloorHeight)
                maxFloorHeight = h;
        }
        levelSpaces.forEach((space, index) => {
            const globalIndex = result.length;
            const col = index % gridSize;
            const row = Math.floor(index / gridSize);
            const area = Math.max(space.area_m2 ?? 50, 20);
            const volume = Math.max(space.volume_m3 ?? area * 3, area * 2);
            const width = clamp(Math.sqrt(area) * 0.4, 1.5, 4.5);
            const depth = clamp(Math.sqrt(area) * 0.4, 1.5, 4.5);
            const height = clamp(volume / area, 2.5, 4.5);
            const x = col * spacing - offset;
            const z = row * spacing - offset;
            result.push({
                id: space.id,
                name: getSpaceDisplayName(space, globalIndex),
                position: [x, elevationOffset + height / 2, z],
                size: [width, height, depth],
                area,
                volume,
                level: levelKey,
            });
        });
        elevationOffset += maxFloorHeight + 0.3;
    }
    return result;
}
export function buildSpaceInstancesFromModel(model) {
    if (!model.rooms.length) {
        return [];
    }
    const levelLookup = new Map(model.levels.map((level) => [level.id, level]));
    return model.rooms.map((room, index) => {
        const level = levelLookup.get(room.levelId);
        const area = Math.max(Math.abs(polygonArea(room.polygon)), 1);
        const volume = area * Math.max(level?.height_m ?? 3, 2.4);
        const bounds = getRoomBounds(room);
        const centroid = polygonCentroid(room.polygon);
        const width = clamp(bounds.maxX - bounds.minX, 0.8, 200);
        const depth = clamp(bounds.maxY - bounds.minY, 0.8, 200);
        const height = clamp(level?.height_m ?? 3, 2.4, 8);
        const elevation = level?.elevation_m ?? 0;
        return {
            id: room.id,
            name: getSpaceDisplayName({
                name: room.name,
                long_name: room.name,
            }, index),
            position: [centroid.x, elevation + height / 2, centroid.y],
            size: [width, height, depth],
            area,
            volume,
            level: level?.name,
        };
    });
}
export function buildThermalGraph(spaces, instances) {
    const nodes = spaces.map((space, idx) => {
        const instance = instances[idx];
        const area = instance?.area ?? space.area_m2 ?? 50;
        return {
            id: space.id,
            label: getSpaceDisplayName(space, idx),
            type: "space",
            capacity: twinNodeCapacitanceJPerK(area),
            heatGain: 0.15 * area,
            initialTemp: 20 + Math.random() * 2,
        };
    });
    const outdoorNode = {
        id: "outdoor",
        label: "Наружный воздух",
        type: "outdoor",
        capacity: Infinity,
        heatGain: 0,
        initialTemp: DEFAULT_OUTDOOR_TEMPS[0],
    };
    const edges = [];
    const distanceThreshold = 5;
    nodes.forEach((node, idx) => {
        const instance = instances[idx];
        const envelopeArea = instance
            ? estimateExteriorEnvelopeAreaM2(instance.size[0], instance.size[2], instance.size[1])
            : 50;
        edges.push({
            from: node.id,
            to: outdoorNode.id,
            conductance: twinOutdoorConductanceWPerK(envelopeArea),
        });
    });
    for (let i = 0; i < instances.length; i++) {
        for (let j = i + 1; j < instances.length; j++) {
            const a = instances[i];
            const b = instances[j];
            const distance = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
            if (distance <= distanceThreshold) {
                const wallArea = estimateSharedWallAreaM2(a.size[0], a.size[1], b.size[0], b.size[1]);
                edges.push({ from: a.id, to: b.id, conductance: twinInternalConductanceWPerK(wallArea) });
            }
        }
    }
    return { nodes: [...nodes, outdoorNode], edges };
}
export function simulateThermalGraph(graph, options = {}) {
    if (!graph.nodes.length) {
        return [];
    }
    const durationHours = options.durationHours ?? 24;
    const timestepMinutes = options.timestepMinutes ?? 30;
    const dt = timestepMinutes / 60;
    const steps = Math.ceil(durationHours / dt);
    const tempMap = new Map();
    graph.nodes.forEach((node) => {
        tempMap.set(node.id, node.initialTemp);
    });
    const adjacency = new Map();
    graph.edges.forEach((edge) => {
        adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge]);
        adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge]);
    });
    const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node]));
    const frames = [];
    for (let step = 0; step <= steps; step++) {
        const time = step * dt;
        frames.push({ time, temperatures: Object.fromEntries(tempMap) });
        const deltas = new Map();
        for (const node of graph.nodes) {
            if (node.type === "outdoor") {
                const outdoorTemp = outdoorTemperatureAt(time);
                tempMap.set(node.id, outdoorTemp);
                continue;
            }
            const currentTemp = tempMap.get(node.id) ?? 20;
            const neighbors = adjacency.get(node.id) ?? [];
            let flow = 0;
            for (const edge of neighbors) {
                const otherId = edge.from === node.id ? edge.to : edge.from;
                const otherNode = nodeLookup.get(otherId);
                const otherTemp = otherNode?.type === "outdoor" ? outdoorTemperatureAt(time) : tempMap.get(otherId) ?? currentTemp;
                flow += edge.conductance * (otherTemp - currentTemp);
            }
            const delta = ((flow + node.heatGain) / Math.max(node.capacity, 1)) * dt;
            deltas.set(node.id, currentTemp + delta);
        }
        deltas.forEach((value, key) => tempMap.set(key, value));
    }
    return frames;
}
export function outdoorTemperatureAt(timeHours) {
    const wrapped = timeHours % 24;
    const lower = Math.floor(wrapped);
    const upper = Math.ceil(wrapped);
    const frac = wrapped - lower;
    const tLower = DEFAULT_OUTDOOR_TEMPS[lower % 24];
    const tUpper = DEFAULT_OUTDOOR_TEMPS[upper % 24];
    return lerp(tLower, tUpper, frac);
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}
function getRoomBounds(room) {
    const xs = room.polygon.map((point) => point.x);
    const ys = room.polygon.map((point) => point.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
    };
}
function extractFloorNumber(label) {
    const match = label.match(/-?\d+/);
    return match ? parseInt(match[0], 10) : null;
}
function compareFloorLabels(a, b) {
    const numA = extractFloorNumber(a);
    const numB = extractFloorNumber(b);
    if (numA !== null && numB !== null)
        return numA - numB;
    return a.localeCompare(b, "ru");
}
