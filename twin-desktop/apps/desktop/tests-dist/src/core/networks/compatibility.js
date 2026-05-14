import { EQUIPMENT_TYPE_LABELS, PIPE_TYPE_LABELS, } from "../../entities/networks/types";
const PIPE_RULES = {
    radiator: ["heating_supply", "heating_return"],
    fancoil: ["heating_supply", "heating_return", "chw"],
    ahu: [],
    pump: ["heating_supply", "heating_return", "dhw", "chw"],
    boiler: ["heating_supply", "heating_return"],
    diffuser: [],
    sensor: [],
};
const DUCT_RULES = {
    radiator: false,
    fancoil: true,
    ahu: true,
    pump: false,
    boiler: false,
    diffuser: true,
    sensor: false,
};
export function canConnectEquipmentToNetwork(equipment, network) {
    if ("type" in network) {
        return canConnectEquipmentToPipeSystem(equipment.type, network.type);
    }
    return canConnectEquipmentToDuctSystem(equipment.type);
}
export function canConnectEquipmentToPipeSystem(equipmentType, pipeType) {
    const allowed = PIPE_RULES[equipmentType] ?? [];
    if (allowed.includes(pipeType)) {
        return { compatible: true, reason: null };
    }
    if (!allowed.length) {
        return {
            compatible: false,
            reason: `${EQUIPMENT_TYPE_LABELS[equipmentType]} не работает с трубопроводными контурами.`,
        };
    }
    return {
        compatible: false,
        reason: `${EQUIPMENT_TYPE_LABELS[equipmentType]} несовместим с контуром «${PIPE_TYPE_LABELS[pipeType]}».`,
    };
}
export function canConnectEquipmentToDuctSystem(equipmentType) {
    if (DUCT_RULES[equipmentType]) {
        return { compatible: true, reason: null };
    }
    return {
        compatible: false,
        reason: `${EQUIPMENT_TYPE_LABELS[equipmentType]} не подключается к воздуховодам.`,
    };
}
export function supportsPipeNetwork(type) {
    return (PIPE_RULES[type] ?? []).length > 0;
}
export function supportsDuctNetwork(type) {
    return DUCT_RULES[type];
}
export function describeEquipmentNetworkPolicy(type) {
    const lines = [];
    const pipeTypes = PIPE_RULES[type] ?? [];
    if (pipeTypes.length) {
        lines.push(`Трубопроводы: ${pipeTypes.map((entry) => PIPE_TYPE_LABELS[entry]).join(", ")}`);
    }
    if (DUCT_RULES[type]) {
        lines.push("Воздуховоды: допустимо подключение");
    }
    if (!lines.length) {
        lines.push("Сетевые подключения не предусмотрены");
    }
    return lines;
}
