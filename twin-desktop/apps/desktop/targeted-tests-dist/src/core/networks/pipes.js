import { polylineLength } from "./utils";
export function summarizePipes(pipes) {
    if (!pipes.length) {
        return {
            totalLength_m: 0,
            branchCount: 0,
            totalFlow_kg_s: 0,
            averageFluidTemperatureC: 0,
            estimatedPressureDropPa: 0,
            simplified: true,
        };
    }
    const totalLength_m = pipes.reduce((sum, pipe) => sum + polylineLength(pipe.path), 0);
    const totalFlow_kg_s = pipes.reduce((sum, pipe) => sum + Math.max(0, pipe.flowRate_kg_s), 0);
    const weightedTemp = pipes.reduce((sum, pipe) => sum + pipe.fluidTemperatureC * Math.max(pipe.flowRate_kg_s, 0.001), 0) /
        pipes.reduce((sum, pipe) => sum + Math.max(pipe.flowRate_kg_s, 0.001), 0);
    const estimatedPressureDropPa = pipes.reduce((sum, pipe) => {
        const length = polylineLength(pipe.path);
        const diameterFactor = Math.max(pipe.diameter_mm, 10) / 1000;
        return sum + (length / diameterFactor) * Math.max(pipe.flowRate_kg_s, 0.05) * 8;
    }, 0);
    return {
        totalLength_m,
        branchCount: pipes.length,
        totalFlow_kg_s,
        averageFluidTemperatureC: weightedTemp,
        estimatedPressureDropPa,
        simplified: true,
    };
}
export function buildPipeConnectivity(pipes) {
    return pipes.map((pipe) => ({
        id: pipe.id,
        kind: "pipe",
        nodeIds: pipe.connectedEquipmentIds.length ? [...pipe.connectedEquipmentIds] : [pipe.id],
    }));
}
