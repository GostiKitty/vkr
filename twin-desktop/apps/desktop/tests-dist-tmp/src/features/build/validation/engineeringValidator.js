import { buildHeatingModelSnapshot } from "../../../core/networks/index";
import { canConnectEquipmentToNetwork, supportsDuctNetwork, supportsPipeNetwork } from "../../../core/networks/compatibility";
import { createId } from "../../../shared/utils/id";
import { getRoomDisplayName } from "../../../shared/utils/roomNames";
import { getEquipmentDisplayName } from "../utils/entityLabels";
export function validateEngineeringModel(model, snapshot) {
    const issues = [];
    const heatingModel = buildHeatingModelSnapshot(model);
    const networksById = new Map([
        ...model.pipes.map((pipe) => [pipe.id, pipe]),
        ...model.ducts.map((duct) => [duct.id, duct]),
    ]);
    model.rooms.forEach((room) => {
        const hasAnyWall = model.walls.some((wall) => wall.levelId === room.levelId);
        if (!hasAnyWall) {
            const roomIndex = model.rooms.findIndex((entry) => entry.id === room.id);
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: `Для помещения «${getRoomDisplayName(room, roomIndex)}» не найдено ни одной стены на уровне.`,
                target: { kind: "room", id: room.id },
            });
        }
    });
    snapshot.equipmentStates.forEach((item) => {
        const equipment = model.equipment.find((entry) => entry.id === item.equipmentId);
        if (!equipment) {
            return;
        }
        const equipmentLabel = getEquipmentDisplayName(equipment.id, model.equipment);
        equipment.connectedNetworkIds.forEach((networkId) => {
            const network = networksById.get(networkId);
            if (!network) {
                issues.push({
                    id: createId("issue"),
                    severity: "error",
                    message: `Оборудование «${equipmentLabel}» ссылается на отсутствующую сеть «${networkId}».`,
                    target: { kind: "equipment", id: equipment.id },
                });
                return;
            }
            const compatibility = canConnectEquipmentToNetwork(equipment, network);
            if (!compatibility.compatible) {
                issues.push({
                    id: createId("issue"),
                    severity: "error",
                    message: `Недопустимое подключение для «${equipmentLabel}»: ${compatibility.reason ?? "тип сети не соответствует оборудованию."}`,
                    target: { kind: "equipment", id: equipment.id },
                });
            }
        });
        if (supportsPipeNetwork(equipment.type) && !item.connectedNetworkIds.some((id) => model.pipes.some((pipe) => pipe.id === id))) {
            issues.push({
                id: createId("issue"),
                severity: "error",
                message: `Оборудование «${equipmentLabel}» не подключено к трубопроводу.`,
                target: { kind: "equipment", id: equipment.id },
            });
        }
        if (supportsDuctNetwork(equipment.type) && !item.connectedNetworkIds.some((id) => model.ducts.some((duct) => duct.id === id))) {
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: `Оборудование «${equipmentLabel}» не подключено к воздуховоду.`,
                target: { kind: "equipment", id: equipment.id },
            });
        }
        if (!item.roomId &&
            equipment.type !== "pump" &&
            equipment.type !== "boiler" &&
            equipment.type !== "ahu" &&
            equipment.type !== "heat_exchanger" &&
            equipment.type !== "elevator" &&
            equipment.type !== "expansion_tank" &&
            equipment.type !== "dirt_separator") {
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: `Оборудование «${equipmentLabel}» находится вне помещения.`,
                target: { kind: "equipment", id: equipment.id },
            });
        }
    });
    snapshot.sensorStates.forEach((sensor) => {
        if (!sensor.roomId) {
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: `Датчик «${sensor.label}» расположен вне помещения.`,
                target: { kind: "sensor", id: sensor.sensorId },
            });
        }
    });
    snapshot.networkStates.forEach((network) => {
        if (network.kind === "pipe" && !network.connectedEquipmentIds.length) {
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: "Трубопровод не связан с оборудованием.",
                target: { kind: "pipe", id: network.networkId },
            });
        }
        if (network.kind === "duct" && !network.connectedEquipmentIds.length) {
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: "Воздуховод не связан с решётками или установкой.",
                target: { kind: "duct", id: network.networkId },
            });
        }
    });
    heatingModel.systems.forEach((system) => {
        if (!system.hasSupply || !system.hasReturn) {
            issues.push({
                id: createId("issue"),
                severity: "error",
                message: `Отопительный контур «${system.name}» должен содержать и подачу, и обратку.`,
                target: { kind: "pipe", id: system.branches[0]?.pipeId ?? system.id },
            });
        }
        if (!system.sourceEquipmentIds.length) {
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: `Отопительный контур «${system.name}» не имеет источника тепла или узла циркуляции.`,
                target: { kind: "pipe", id: system.branches[0]?.pipeId ?? system.id },
            });
        }
        if (system.danglingNodeIds.length) {
            issues.push({
                id: createId("issue"),
                severity: "warning",
                message: `В контуре «${system.name}» есть висячие концы трубопроводов без оборудования или замыкания по сети.`,
                target: { kind: "pipe", id: system.branches[0]?.pipeId ?? system.id },
            });
        }
        system.equipmentConnections.forEach((connection) => {
            if ((connection.equipmentType === "radiator" || connection.equipmentType === "fancoil") && !connection.supplyPipeIds.length) {
                const equipmentLabel = getEquipmentDisplayName(connection.equipmentId, model.equipment);
                issues.push({
                    id: createId("issue"),
                    severity: "error",
                    message: `Прибор «${equipmentLabel}» не подключен к подающей линии отопления.`,
                    target: { kind: "equipment", id: connection.equipmentId },
                });
            }
            if ((connection.equipmentType === "radiator" || connection.equipmentType === "fancoil") && !connection.returnPipeIds.length) {
                const equipmentLabel = getEquipmentDisplayName(connection.equipmentId, model.equipment);
                issues.push({
                    id: createId("issue"),
                    severity: "error",
                    message: `Прибор «${equipmentLabel}» не подключен к обратной линии отопления.`,
                    target: { kind: "equipment", id: connection.equipmentId },
                });
            }
        });
    });
    heatingModel.unassignedHeatingPipeIds.forEach((pipeId) => {
        issues.push({
            id: createId("issue"),
            severity: "warning",
            message: `Тепловая ветвь «${pipeId}» изолирована и не включена в отопительный контур.`,
            target: { kind: "pipe", id: pipeId },
        });
    });
    heatingModel.unassignedHeatingEquipmentIds.forEach((equipmentId) => {
        const equipmentLabel = getEquipmentDisplayName(equipmentId, model.equipment);
        issues.push({
            id: createId("issue"),
            severity: "warning",
            message: `Отопительное оборудование «${equipmentLabel}» не включено ни в один тепловой контур.`,
            target: { kind: "equipment", id: equipmentId },
        });
    });
    return issues;
}
