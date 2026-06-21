import { polygonArea } from "../../entities/geometry/geom";
import { useTwinStore } from "../../entities/twin/twin.store";
import { buildModelToTwin } from "../../features/build/export/toTwin";
import { buildSpaceInstancesFromModel } from "../../features/twin/twin.engine";
import { getRoomDisplayName } from "../../shared/utils/roomNames";
import { createModelBinding, getModelRevision } from "../../shared/utils/modelSync";
import { twinInternalConductanceWPerK, twinNodeCapacitanceJPerK, twinOutdoorConductanceWPerK, } from "./twinGraphHeuristics";
export function buildThermalGraphFromBuilding(model, adjacency, initialOutdoorC = -5) {
    const nodes = model.rooms.map((room, index) => {
        const area = Math.max(Math.abs(polygonArea(room.polygon)), 20);
        return {
            id: room.id,
            label: getRoomDisplayName(room, index),
            type: "space",
            capacity: twinNodeCapacitanceJPerK(area),
            heatGain: 0,
            initialTemp: 20,
        };
    });
    nodes.push({
        id: "outdoor",
        label: "Наружный воздух",
        type: "outdoor",
        capacity: Number.POSITIVE_INFINITY,
        heatGain: 0,
        initialTemp: initialOutdoorC,
    });
    const edges = [];
    for (const edge of adjacency.graph.edges) {
        const conductance = twinInternalConductanceWPerK(edge.area_m2);
        edges.push({ from: edge.roomA, to: edge.roomB, conductance });
    }
    for (const ext of adjacency.graph.outdoorEdges) {
        const conductance = twinOutdoorConductanceWPerK(ext.area_m2);
        edges.push({ from: ext.roomId, to: "outdoor", conductance });
    }
    return { nodes, edges };
}
export function thermalResultToSimulationFrames(result) {
    if (!result.timeline.length) {
        return [];
    }
    return result.timeline.map((point) => ({
        time: point.timeHours,
        temperatures: {
            outdoor: point.outdoorTemperatureC,
            ...Object.fromEntries(Object.entries(point.rooms).map(([roomId, roomState]) => [roomId, roomState.temperatureC])),
        },
    }));
}
export function extractLossSharePercent(result) {
    const building = result.diagnostics?.building;
    if (!building) {
        return null;
    }
    return {
        opaque: building.lossSharePercent.opaque,
        window: building.lossSharePercent.window,
        door: building.lossSharePercent.door,
        infiltration: building.infiltrationShareOfTotalPct ?? building.lossSharePercent.infiltration,
        ventilation: building.lossSharePercent.ventilation,
    };
}
/** Привязывает результат RC-расчёта к студии: twin, 3D-инстансы, кадры и граф. */
export function syncBuildSimulationToStudio(model, result, adjacency, options) {
    const frames = thermalResultToSimulationFrames(result);
    const outdoorC = result.timeline[0]?.outdoorTemperatureC ?? -5;
    const graph = buildThermalGraphFromBuilding(model, adjacency, outdoorC);
    const twin = buildModelToTwin(model, { projectName: options?.projectName, projectId: options?.projectId ?? null });
    const instances = buildSpaceInstancesFromModel(model);
    const store = useTwinStore.getState();
    store.setSimulationResult({
        frames,
        graph,
        result,
        source: "computed",
        binding: createModelBinding(options?.projectKey ?? null, options?.modelRevision ?? getModelRevision(model)),
    });
    store.setTwin(twin);
    store.setSpaceInstances(instances);
}
