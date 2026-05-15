import type { Equipment, SensorDevice } from "../../entities/networks/types";
import type { NetworkScenarioSnapshot, RoomEquipmentImpact, SensorSnapshot } from "./types";

export function summarizeEquipmentImpact(equipment: Equipment[]): RoomEquipmentImpact[] {
  const map = new Map<string, RoomEquipmentImpact>();
  equipment.forEach((item) => {
    const roomId = item.roomId ?? "unassigned";
    const current = map.get(roomId) ?? { roomId, heatEmissionW: 0, supplyAir_m3_s: 0 };
    if (
      item.type === "radiator" ||
      item.type === "fancoil" ||
      item.type === "boiler" ||
      item.type === "heat_exchanger"
    ) {
      current.heatEmissionW += item.params.nominalPowerW ?? 0;
    }
    if (item.type === "ahu" || item.type === "diffuser" || item.type === "fancoil") {
      current.supplyAir_m3_s += item.params.designAirflow_m3_s ?? 0;
    }
    map.set(roomId, current);
  });
  return [...map.values()];
}

export function summarizeSensors(sensors: SensorDevice[]): SensorSnapshot[] {
  return sensors.map((sensor) => ({
    id: sensor.id,
    label: sensor.type,
    value: sensor.value,
    unit: sensor.unit,
    status: sensor.status,
  }));
}

export function summarizeScenario(
  scenarios: { id: string }[],
  activeScenarioId: string | null,
  equipment: Equipment[]
): NetworkScenarioSnapshot | null {
  const scenario = scenarios.find((item) => item.id === activeScenarioId);
  if (!scenario) {
    return null;
  }
  const activeEquipment = equipment.filter((item) => item.state === "on").length;
  const alarmEquipment = equipment.filter((item) => item.state === "alarm").length;
  return {
    scenario: scenario as NetworkScenarioSnapshot["scenario"],
    activeEquipment,
    alarmEquipment,
  };
}
