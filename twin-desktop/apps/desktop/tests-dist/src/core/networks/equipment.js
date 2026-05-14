export function summarizeEquipmentImpact(equipment) {
    const map = new Map();
    equipment.forEach((item) => {
        const roomId = item.roomId ?? "unassigned";
        const current = map.get(roomId) ?? { roomId, heatEmissionW: 0, supplyAir_m3_s: 0 };
        if (item.type === "radiator" || item.type === "fancoil" || item.type === "boiler") {
            current.heatEmissionW += item.params.nominalPowerW ?? 0;
        }
        if (item.type === "ahu" || item.type === "diffuser" || item.type === "fancoil") {
            current.supplyAir_m3_s += item.params.designAirflow_m3_s ?? 0;
        }
        map.set(roomId, current);
    });
    return [...map.values()];
}
export function summarizeSensors(sensors) {
    return sensors.map((sensor) => ({
        id: sensor.id,
        label: sensor.type,
        value: sensor.value,
        unit: sensor.unit,
        status: sensor.status,
    }));
}
export function summarizeScenario(scenarios, activeScenarioId, equipment) {
    const scenario = scenarios.find((item) => item.id === activeScenarioId);
    if (!scenario) {
        return null;
    }
    const activeEquipment = equipment.filter((item) => item.state === "on").length;
    const alarmEquipment = equipment.filter((item) => item.state === "alarm").length;
    return {
        scenario: scenario,
        activeEquipment,
        alarmEquipment,
    };
}
