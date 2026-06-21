import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { buildThermalPhysicsModel } from "../../src/core/thermal/physics.js";
import { createEngineeringEquipmentInstance, createEngineeringPipeConnection } from "../../src/features/build/engineering2d/catalog.js";
import { expectApproximatelyEqual, test } from "../testHarness.js";
function buildSimpleBuilding() {
    const building = createEmptyBuildingModel();
    building.levels = [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }];
    building.rooms = [
        {
            id: "r1",
            levelId: "l1",
            name: "Комната 1",
            polygon: [
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 5, y: 4 },
                { x: 0, y: 4 },
            ],
        },
    ];
    return building;
}
test("engineering air cooler affects supply temperature of downstream diffuser", () => {
    const building = buildSimpleBuilding();
    const ahu = createEngineeringEquipmentInstance("airHandlingUnit", { x: -1.6, y: 2 }, {
        levelId: "l1",
        name: "ПВУ-1",
        parameters: { airflowM3H: 900, supplyTemperatureC: 18 },
    });
    const cooler = createEngineeringEquipmentInstance("airCooler", { x: 0.2, y: 2 }, {
        levelId: "l1",
        name: "Охладитель-1",
        parameters: { airflowM3H: 900, supplyTemperatureC: 12, pressureDropPa: 75, coolingPowerKW: 12 },
    });
    const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 2, y: 2 }, {
        levelId: "l1",
        name: "П1",
        parameters: { airflowM3H: 900 },
    });
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: 3.2, y: 2 }, {
        levelId: "l1",
        name: "В1",
        parameters: { airflowM3H: 900 },
    });
    const supplyA = createEngineeringPipeConnection({
        fromEquipment: ahu,
        fromPortId: "supply-out",
        toEquipment: cooler,
        toPortId: "inlet",
        levelId: "l1",
    });
    const supplyB = createEngineeringPipeConnection({
        fromEquipment: cooler,
        fromPortId: "outlet",
        toEquipment: diffuser,
        toPortId: "supply",
        levelId: "l1",
    });
    const exhaust = createEngineeringPipeConnection({
        fromEquipment: grille,
        fromPortId: "exhaust",
        toEquipment: ahu,
        toPortId: "exhaust-in",
        levelId: "l1",
    });
    if (!supplyA || !supplyB || !exhaust) {
        throw new Error("Expected engineering air branches with an air cooler.");
    }
    supplyA.flowRate = 900;
    supplyB.flowRate = 900;
    exhaust.flowRate = 900;
    building.engineeringSystems = {
        equipment: [ahu, cooler, diffuser, grille],
        pipes: [supplyA, supplyB, exhaust],
    };
    const physics = buildThermalPhysicsModel(building, {
        outdoorTemperatureC: -10,
        setpointTemperatureC: 21,
        infiltrationACH: 0,
        ventilationACH: 0,
        heatRecoveryFactor: 0,
        fixedRoomTemperaturesC: { r1: 21 },
    });
    const room = physics.roomBalances.get("r1");
    if (!room) {
        throw new Error("Expected room balance for r1.");
    }
    const expectedLossW = 1.204 * 1005 * (900 / 3600) * (21 - 12);
    expectApproximatelyEqual(room.mechanicalVentilationLossW, expectedLossW, 2, "Air cooler should define supply temperature for the downstream diffuser.");
});
