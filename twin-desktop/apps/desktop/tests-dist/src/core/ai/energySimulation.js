const VENTILATION_HEAT_FACTOR_W_PER_M3_H_K = 0.33;
const COOLING_SHARE = 0.62;
export function runEnergySimulation(input) {
    const timestamp = Date.now();
    const zones = (Array.isArray(input) ? input : [input]).map((zone, index) => simulateZone(zone, index));
    const zoneCount = zones.length;
    const totalArea = zones.reduce((sum, zone) => sum + zone.roomArea_m2, 0);
    const totalAirflow = zones.reduce((sum, zone) => sum + zone.ventilationAirflow_m3_s, 0);
    const averageInsulation = zoneCount > 0 ? zones.reduce((sum, zone) => sum + zone.insulationCoefficient_W_m2K, 0) / zoneCount : 0;
    const designDelta = zoneCount > 0 ? zones.reduce((sum, zone) => sum + zone.temperatureDifference_C, 0) / zoneCount : 0;
    return {
        module: "energySimulation",
        timestamp,
        inputs: {
            zoneCount,
            totalArea_m2: roundValue(totalArea),
            averageInsulationCoefficient_W_m2K: roundValue(averageInsulation),
            designTemperatureDifference_C: roundValue(designDelta),
            totalVentilationAirflow_m3_s: roundValue(totalAirflow),
        },
        zones,
        totals: {
            heatingDemand_W: roundValue(zones.reduce((sum, zone) => sum + zone.heatingDemand_W, 0)),
            coolingDemand_W: roundValue(zones.reduce((sum, zone) => sum + zone.coolingDemand_W, 0)),
            ventilationEnergy_W: roundValue(zones.reduce((sum, zone) => sum + zone.ventilationEnergy_W, 0)),
            peakDemand_W: roundValue(zones.reduce((sum, zone) => Math.max(sum, zone.totalLoad_W), 0)),
        },
    };
}
function simulateZone(input, index) {
    const roomArea = Math.max(input.roomArea_m2, 0);
    const insulation = Math.max(input.insulationCoefficient_W_m2K, 0);
    const deltaT = Math.abs(input.temperatureDifference_C);
    const airflow = Math.max(input.ventilationAirflow_m3_s, 0);
    const ventilationAirflow_m3_h = airflow * 3600;
    const transmissionLoad = roomArea * insulation * deltaT;
    const ventilationEnergy = ventilationAirflow_m3_h * VENTILATION_HEAT_FACTOR_W_PER_M3_H_K * deltaT;
    const heatingDemand = transmissionLoad + ventilationEnergy;
    const coolingDemand = transmissionLoad * COOLING_SHARE + ventilationEnergy * 0.8;
    return {
        zoneId: `zone-${index + 1}`,
        zoneName: `Zone ${index + 1}`,
        roomArea_m2: roundValue(roomArea),
        insulationCoefficient_W_m2K: roundValue(insulation),
        temperatureDifference_C: roundValue(deltaT),
        ventilationAirflow_m3_s: roundValue(airflow),
        heatingDemand_W: roundValue(heatingDemand),
        coolingDemand_W: roundValue(coolingDemand),
        ventilationEnergy_W: roundValue(ventilationEnergy),
        totalLoad_W: roundValue(Math.max(heatingDemand, coolingDemand)),
    };
}
function roundValue(value) {
    return Math.round(value * 1000) / 1000;
}
