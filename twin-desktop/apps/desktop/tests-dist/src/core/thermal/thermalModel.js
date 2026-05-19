export function simulateThermalModel(nodes, connections, boundary, options, stepObserver) {
    if (!nodes.length) {
        return [];
    }
    if (options.durationHours <= 0) {
        throw new Error("durationHours must be positive");
    }
    const timestepMinutes = options.timestepMinutes ?? 10;
    if (timestepMinutes <= 0) {
        throw new Error("timestepMinutes must be positive");
    }
    const dtHours = timestepMinutes / 60;
    const dtSeconds = dtHours * 3600;
    const steps = Math.ceil(options.durationHours / dtHours);
    const adjacency = buildAdjacency(nodes, connections);
    const temperatures = new Map();
    nodes.forEach((node) => {
        temperatures.set(node.id, node.initialTemp);
    });
    const series = [];
    for (let step = 0; step <= steps; step++) {
        const currentTimeHours = step * dtHours;
        series.push({ timeHours: currentTimeHours, temperatures: Object.fromEntries(temperatures) });
        if (step === steps) {
            break;
        }
        const outdoorTemp = boundary.outdoorTemp(currentTimeHours);
        const deltas = new Map();
        const observerSnapshots = stepObserver ? [] : undefined;
        adjacency.forEach((cache, nodeId) => {
            const node = cache.node;
            const currentTemp = temperatures.get(nodeId);
            if (currentTemp === undefined) {
                throw new Error(`Temperature missing for node ${nodeId}`);
            }
            const capacity = node.heatCapacity;
            if (capacity <= 0) {
                throw new Error(`Node ${nodeId} must have positive heat capacity`);
            }
            let netPower = 0;
            for (const connection of cache.adjacency) {
                const otherId = connection.from === nodeId ? connection.to : connection.from;
                const neighborTemp = temperatures.get(otherId);
                if (neighborTemp === undefined) {
                    throw new Error(`Temperature missing for neighbor ${otherId}`);
                }
                const conductance = connection.U * connection.area;
                netPower += conductance * (neighborTemp - currentTemp);
            }
            const massFlow = node.infiltrationMassFlow ?? 0;
            const cp = node.infiltrationSpecificHeat ?? 1005; // J/(kg·K)
            if (massFlow !== 0) {
                netPower += massFlow * cp * (outdoorTemp - currentTemp);
            }
            const internalGain = node.internalGain ?? 0;
            netPower += internalGain;
            const dTdt = netPower / capacity;
            const nextTemp = currentTemp + dTdt * dtSeconds;
            deltas.set(nodeId, nextTemp);
            if (observerSnapshots) {
                observerSnapshots.push({
                    nodeId,
                    temperature: currentTemp,
                    netPower,
                });
            }
        });
        deltas.forEach((value, key) => {
            temperatures.set(key, value);
        });
        if (observerSnapshots && stepObserver) {
            stepObserver({
                timeHours: currentTimeHours + dtHours,
                nodes: observerSnapshots,
            });
        }
    }
    return series;
}
function buildAdjacency(nodes, connections) {
    const adjacency = new Map();
    nodes.forEach((node) => {
        adjacency.set(node.id, { node, adjacency: [] });
    });
    connections.forEach((connection) => {
        const fromCache = adjacency.get(connection.from);
        const toCache = adjacency.get(connection.to);
        if (!fromCache || !toCache) {
            throw new Error(`Connection references unknown nodes: ${connection.from} -> ${connection.to}`);
        }
        fromCache.adjacency.push(connection);
        toCache.adjacency.push(connection);
    });
    return adjacency;
}
