import { polylineLength } from "./utils";
export function summarizeDucts(ducts) {
    if (!ducts.length) {
        return {
            totalLength_m: 0,
            branchCount: 0,
            totalAirflow_m3_s: 0,
            averageAirVelocity_m_s: 0,
            estimatedPressureDropPa: 0,
            simplified: true,
        };
    }
    const totalLength_m = ducts.reduce((sum, duct) => sum + polylineLength(duct.path), 0);
    const totalAirflow_m3_s = ducts.reduce((sum, duct) => sum + Math.max(0, duct.airflow_m3_s), 0);
    const averageAirVelocity_m_s = ducts.reduce((sum, duct) => sum + Math.max(0, duct.airVelocity_m_s), 0) / Math.max(ducts.length, 1);
    const estimatedPressureDropPa = ducts.reduce((sum, duct) => {
        const length = polylineLength(duct.path);
        const hydraulicSize = duct.section.shape === "round"
            ? Math.max((duct.section.diameter_mm ?? 160) / 1000, 0.1)
            : Math.max(((duct.section.width_mm ?? 400) + (duct.section.height_mm ?? 200)) / 2000, 0.1);
        return sum + (length / hydraulicSize) * Math.max(duct.airflow_m3_s, 0.05) * 4;
    }, 0);
    return {
        totalLength_m,
        branchCount: ducts.length,
        totalAirflow_m3_s,
        averageAirVelocity_m_s,
        estimatedPressureDropPa,
        simplified: true,
    };
}
export function buildDuctConnectivity(ducts) {
    return ducts.map((duct) => ({
        id: duct.id,
        kind: "duct",
        nodeIds: duct.connectedEquipmentIds.length ? [...duct.connectedEquipmentIds] : [duct.id],
    }));
}
