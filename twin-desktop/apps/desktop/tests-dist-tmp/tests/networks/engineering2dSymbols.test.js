import { createEngineeringEquipmentInstance, createTypicalCtpEngineeringSystems, createItpParallelDhwDependentHeating, getEngineeringPort, getEngineeringPortWorldPosition, rotateEngineeringDirection, } from "../../src/features/build/engineering2d/catalog.js";
import { expectApproximatelyEqual, test } from "../testHarness.js";
test("engineering 2d: typical CTP system covers the required equipment library", () => {
    const systems = createTypicalCtpEngineeringSystems("l1");
    const types = new Set(systems.equipment.map((item) => item.type));
    const requiredTypes = [
        "pump",
        "heatExchanger",
        "filter",
        "controlValve",
        "expansionTank",
        "manifold",
        "heatMeter",
        "automationCabinet",
    ];
    requiredTypes.forEach((type) => {
        if (!types.has(type)) {
            throw new Error(`Expected typical CTP template to include ${type}.`);
        }
    });
});
test("engineering 2d: rotated pump ports preserve world geometry and direction", () => {
    const pump = createEngineeringEquipmentInstance("pump", { x: 10, y: 20 }, { rotation: 90 });
    const inlet = getEngineeringPort(pump, "inlet");
    if (!inlet) {
        throw new Error("Expected pump inlet port.");
    }
    const world = getEngineeringPortWorldPosition(pump, inlet);
    expectApproximatelyEqual(world.x, 10, 1e-6, "Pump inlet X after 90 degree rotation");
    expectApproximatelyEqual(world.y, 19.4, 1e-6, "Pump inlet Y after 90 degree rotation");
    const rotatedDirection = rotateEngineeringDirection(inlet.direction, pump.rotation);
    if (rotatedDirection !== "top") {
        throw new Error(`Expected rotated inlet direction to be top, got ${rotatedDirection}.`);
    }
});
test("engineering 2d: automation links are routed as signal pipes", () => {
    const systems = createTypicalCtpEngineeringSystems("l1");
    const signalPipes = systems.pipes.filter((pipe) => pipe.medium === "signal");
    if (signalPipes.length < 2) {
        throw new Error(`Expected at least 2 signal connections to automation cabinet, got ${signalPipes.length}.`);
    }
});
test("engineering 2d: ITP parallel DHW + dependent heating contains required equipment", () => {
    const systems = createItpParallelDhwDependentHeating("l1");
    const types = new Set(systems.equipment.map((item) => item.type));
    const requiredTypes = [
        "pump", // насос ГВС и корректирующий насос
        "heatExchanger", // водоподогреватель ГВС
        "controlValve", // рег. перепада давл., рег. теплоты, рег. клапан ГВС
        "checkValve", // обратные клапаны
        "filter", // грязевик
        "heatMeter", // теплосчётчик и водомер ХВС
        "manifold", // коллекторы
        "automationCabinet",
    ];
    requiredTypes.forEach((type) => {
        if (!types.has(type)) {
            throw new Error(`Expected ITP parallel DHW template to include equipment type: ${type}.`);
        }
    });
});
test("engineering 2d: ITP parallel DHW + dependent heating has DHW and coldWater medium pipes", () => {
    const systems = createItpParallelDhwDependentHeating("l1");
    const mediums = new Set(systems.pipes.map((p) => p.medium));
    if (!mediums.has("dhw")) {
        throw new Error("Expected ITP template to have pipes with 'dhw' medium (ГВС circuit).");
    }
    if (!mediums.has("coldWater")) {
        throw new Error("Expected ITP template to have pipes with 'coldWater' medium (ХВС inlet).");
    }
    if (!mediums.has("supply")) {
        throw new Error("Expected ITP template to have pipes with 'supply' medium (district heating).");
    }
    if (!mediums.has("return")) {
        throw new Error("Expected ITP template to have pipes with 'return' medium (district return).");
    }
});
test("engineering 2d: ITP parallel DHW + dependent heating has no isolated equipment (all pipes resolved)", () => {
    const systems = createItpParallelDhwDependentHeating("l1");
    // Все трубы должны быть успешно маршрутизированы (не пустые)
    const emptyPipes = systems.pipes.filter((p) => p.points.length < 2);
    if (emptyPipes.length > 0) {
        throw new Error(`Found ${emptyPipes.length} pipe(s) with insufficient routing points in ITP template.`);
    }
});
