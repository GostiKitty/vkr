import { createEngineeringPipeConnection, createEngineeringEquipmentInstance, createTypicalCtpEngineeringSystems, createItpParallelDhwDependentHeating, getEngineeringPort, getEngineeringPortWorldPosition, rotateEngineeringDirection, } from "../../src/features/build/engineering2d/catalog.js";
import { resolveEngineeringEquipmentRenderRotation, resolveEngineeringEquipmentRenderSize, } from "../../src/features/build/engineering2d/render.js";
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
    expectApproximatelyEqual(world.y, 19.496, 1e-6, "Pump inlet Y after 90 degree rotation");
    const rotatedDirection = rotateEngineeringDirection(inlet.direction, pump.rotation);
    if (rotatedDirection !== "top") {
        throw new Error(`Expected rotated inlet direction to be top, got ${rotatedDirection}.`);
    }
});
test("engineering 2d: schematic symbols fit a common drawing box", () => {
    const pumpBox = resolveEngineeringEquipmentRenderSize("pump", 140, 140, "schematic");
    const ahuBox = resolveEngineeringEquipmentRenderSize("airHandlingUnit", 280, 140, "schematic");
    const heaterBox = resolveEngineeringEquipmentRenderSize("airHeater", 160, 90, "schematic");
    [pumpBox, ahuBox, heaterBox].forEach((box) => {
        if (box.width > 36.01 || box.height > 28.01) {
            throw new Error(`Expected schematic symbol to fit 36×28 box, got ${box.width}×${box.height}.`);
        }
    });
    if (pumpBox.width < 24 || pumpBox.height < 24) {
        throw new Error(`Expected pump symbol to stay readable after normalization, got ${pumpBox.width}×${pumpBox.height}.`);
    }
    if (ahuBox.width < 30) {
        throw new Error(`Expected AHU symbol to use the common width envelope, got ${ahuBox.width}.`);
    }
});
test("engineering 2d: pump render rotation follows connected branch direction", () => {
    const rotation = resolveEngineeringEquipmentRenderRotation({ id: "pump-1", type: "pump", rotation: 0 }, [
        {
            id: "pipe-1",
            fromEquipmentId: "pump-1",
            fromPortId: "outlet",
            toEquipmentId: "coil-1",
            toPortId: "inlet",
            points: [
                { x: 0, y: 0 },
                { x: 0, y: 3 },
            ],
            medium: "supply",
            diameter: 50,
            insulation: 0,
            temperature: null,
            flowRate: null,
        },
    ]);
    expectApproximatelyEqual(rotation, 90, 1e-6, "Pump render rotation should follow outgoing branch");
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
test("engineering 2d: air equipment keeps exhaust medium and builds an air branch", () => {
    const fan = createEngineeringEquipmentInstance("ductFan", { x: 0, y: 0 }, {
        parameters: { airMedium: "airExhaust", airflowM3H: 900, pressurePa: 320 },
    });
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: 4, y: 0 }, {
        parameters: { airflowM3H: 900 },
    });
    const inlet = getEngineeringPort(fan, "inlet");
    const outlet = getEngineeringPort(fan, "outlet");
    if (!inlet || !outlet) {
        throw new Error("Expected duct fan air ports.");
    }
    if (inlet.medium !== "airExhaust" || outlet.medium !== "airExhaust") {
        throw new Error("Expected duct fan ports to switch to exhaust medium.");
    }
    const branch = createEngineeringPipeConnection({
        fromEquipment: fan,
        fromPortId: "outlet",
        toEquipment: grille,
        toPortId: "exhaust",
    });
    if (!branch) {
        throw new Error("Expected exhaust air branch between duct fan and exhaust grille.");
    }
    if (branch.medium !== "airExhaust") {
        throw new Error(`Expected exhaust branch medium, got ${branch.medium}.`);
    }
    if (branch.points.length < 2) {
        throw new Error("Expected routed exhaust branch geometry.");
    }
});
test("engineering 2d: roof fan keeps exhaust medium and builds an exhaust branch", () => {
    const roofFan = createEngineeringEquipmentInstance("roofFan", { x: 0, y: 0 }, {
        parameters: { airMedium: "airExhaust", airflowM3H: 1200, pressurePa: 420, powerKW: 1.5 },
    });
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: -4, y: 0 }, {
        parameters: { airflowM3H: 1200 },
    });
    const inlet = getEngineeringPort(roofFan, "inlet");
    const outlet = getEngineeringPort(roofFan, "outlet");
    if (!inlet || !outlet) {
        throw new Error("Expected roof fan air ports.");
    }
    if (inlet.medium !== "airExhaust" || outlet.medium !== "airExhaust") {
        throw new Error("Expected roof fan ports to keep exhaust medium.");
    }
    const branch = createEngineeringPipeConnection({
        fromEquipment: grille,
        fromPortId: "exhaust",
        toEquipment: roofFan,
        toPortId: "inlet",
    });
    if (!branch) {
        throw new Error("Expected exhaust branch between exhaust grille and roof fan.");
    }
    if (branch.medium !== "airExhaust") {
        throw new Error(`Expected exhaust branch medium for roof fan, got ${branch.medium}.`);
    }
});
test("engineering 2d: new inline air devices switch to exhaust medium and connect correctly", () => {
    const fireDamper = createEngineeringEquipmentInstance("fireDamper", { x: 0, y: 0 }, {
        parameters: { airMedium: "airExhaust", state: "open", pressureDropPa: 30 },
    });
    const airFilter = createEngineeringEquipmentInstance("airFilter", { x: 4, y: 0 }, {
        parameters: { airMedium: "airExhaust", pressureDropPa: 90, contaminationPercent: 25 },
    });
    const inlet = getEngineeringPort(fireDamper, "inlet");
    const outlet = getEngineeringPort(airFilter, "outlet");
    if (!inlet || !outlet) {
        throw new Error("Expected ports on fire damper and air filter.");
    }
    if (inlet.medium !== "airExhaust" || outlet.medium !== "airExhaust") {
        throw new Error("Expected new inline air devices to switch ports to exhaust medium.");
    }
    const branch = createEngineeringPipeConnection({
        fromEquipment: fireDamper,
        fromPortId: "outlet",
        toEquipment: airFilter,
        toPortId: "inlet",
    });
    if (!branch) {
        throw new Error("Expected branch between fire damper and air filter.");
    }
    if (branch.medium !== "airExhaust") {
        throw new Error(`Expected exhaust branch medium for new air devices, got ${branch.medium}.`);
    }
});
test("engineering 2d: air check valve keeps exhaust medium and builds a branch", () => {
    const checkValve = createEngineeringEquipmentInstance("airCheckValve", { x: 0, y: 0 }, {
        parameters: { airMedium: "airExhaust", state: "open", pressureDropPa: 25 },
    });
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: 4, y: 0 }, {
        parameters: { airflowM3H: 800 },
    });
    const inlet = getEngineeringPort(checkValve, "inlet");
    const outlet = getEngineeringPort(checkValve, "outlet");
    if (!inlet || !outlet) {
        throw new Error("Expected air check valve ports.");
    }
    if (inlet.medium !== "airExhaust" || outlet.medium !== "airExhaust") {
        throw new Error("Expected air check valve ports to switch to exhaust medium.");
    }
    const branch = createEngineeringPipeConnection({
        fromEquipment: checkValve,
        fromPortId: "outlet",
        toEquipment: grille,
        toPortId: "exhaust",
    });
    if (!branch || branch.medium !== "airExhaust") {
        throw new Error("Expected exhaust branch from air check valve to exhaust grille.");
    }
});
test("engineering 2d: air cooler keeps inline medium rules", () => {
    const cooler = createEngineeringEquipmentInstance("airCooler", { x: 0, y: 0 }, {
        parameters: { airMedium: "airExhaust", pressureDropPa: 75, supplyTemperatureC: 14 },
    });
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: 4, y: 0 }, {
        parameters: { airflowM3H: 800 },
    });
    const inlet = getEngineeringPort(cooler, "inlet");
    const outlet = getEngineeringPort(cooler, "outlet");
    if (!inlet || !outlet) {
        throw new Error("Expected air cooler ports.");
    }
    if (inlet.medium !== "airExhaust" || outlet.medium !== "airExhaust") {
        throw new Error("Expected air cooler ports to switch to exhaust medium.");
    }
    const branch = createEngineeringPipeConnection({
        fromEquipment: cooler,
        fromPortId: "outlet",
        toEquipment: grille,
        toPortId: "exhaust",
    });
    if (!branch || branch.medium !== "airExhaust") {
        throw new Error("Expected exhaust branch from air cooler to exhaust grille.");
    }
});
test("engineering 2d: air humidifier keeps inline medium rules", () => {
    const humidifier = createEngineeringEquipmentInstance("airHumidifier", { x: 0, y: 0 }, {
        parameters: { airMedium: "airExhaust", pressureDropPa: 65, supplyTemperatureC: 19, powerKW: 3 },
    });
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: 4, y: 0 }, {
        parameters: { airflowM3H: 700 },
    });
    const inlet = getEngineeringPort(humidifier, "inlet");
    const outlet = getEngineeringPort(humidifier, "outlet");
    if (!inlet || !outlet) {
        throw new Error("Expected air humidifier ports.");
    }
    if (inlet.medium !== "airExhaust" || outlet.medium !== "airExhaust") {
        throw new Error("Expected air humidifier ports to switch to exhaust medium.");
    }
    const branch = createEngineeringPipeConnection({
        fromEquipment: humidifier,
        fromPortId: "outlet",
        toEquipment: grille,
        toPortId: "exhaust",
    });
    if (!branch || branch.medium !== "airExhaust") {
        throw new Error("Expected exhaust branch from air humidifier to exhaust grille.");
    }
});
test("engineering 2d: air dehumidifier keeps inline medium rules", () => {
    const dehumidifier = createEngineeringEquipmentInstance("airDehumidifier", { x: 0, y: 0 }, {
        parameters: { airMedium: "airExhaust", pressureDropPa: 70, supplyTemperatureC: 16, powerKW: 2.5 },
    });
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: 4, y: 0 }, {
        parameters: { airflowM3H: 700 },
    });
    const inlet = getEngineeringPort(dehumidifier, "inlet");
    const outlet = getEngineeringPort(dehumidifier, "outlet");
    if (!inlet || !outlet) {
        throw new Error("Expected air dehumidifier ports.");
    }
    if (inlet.medium !== "airExhaust" || outlet.medium !== "airExhaust") {
        throw new Error("Expected air dehumidifier ports to switch to exhaust medium.");
    }
    const branch = createEngineeringPipeConnection({
        fromEquipment: dehumidifier,
        fromPortId: "outlet",
        toEquipment: grille,
        toPortId: "exhaust",
    });
    if (!branch || branch.medium !== "airExhaust") {
        throw new Error("Expected exhaust branch from air dehumidifier to exhaust grille.");
    }
});
test("engineering 2d: air flow regulators keep exhaust medium and limit branch by smaller section and airflow", () => {
    const constantRegulator = createEngineeringEquipmentInstance("airFlowRegulatorConst", { x: 0, y: 0 }, {
        parameters: {
            airMedium: "airExhaust",
            airflowM3H: 550,
            sectionWidthMm: 400,
            sectionHeightMm: 200,
            pressureDropPa: 50,
        },
    });
    const variableRegulator = createEngineeringEquipmentInstance("airFlowRegulatorVar", { x: 4, y: 0 }, {
        parameters: {
            airMedium: "airExhaust",
            airflowM3H: 450,
            sectionWidthMm: 300,
            sectionHeightMm: 150,
            damperPositionPercent: 60,
            pressureDropPa: 45,
        },
    });
    const inlet = getEngineeringPort(constantRegulator, "inlet");
    const outlet = getEngineeringPort(variableRegulator, "outlet");
    if (!inlet || !outlet) {
        throw new Error("Expected air regulator ports.");
    }
    if (inlet.medium !== "airExhaust" || outlet.medium !== "airExhaust") {
        throw new Error("Expected air flow regulators to switch ports to exhaust medium.");
    }
    const branch = createEngineeringPipeConnection({
        fromEquipment: constantRegulator,
        fromPortId: "outlet",
        toEquipment: variableRegulator,
        toPortId: "inlet",
    });
    if (!branch) {
        throw new Error("Expected branch between air flow regulators.");
    }
    if (branch.medium !== "airExhaust") {
        throw new Error(`Expected exhaust branch between air flow regulators, got ${branch.medium}.`);
    }
    if (branch.flowRate !== 450) {
        throw new Error(`Expected flow to be limited by smaller regulator setpoint 450 м³/ч, got ${branch.flowRate}.`);
    }
    if (branch.metadata?.sectionShape !== "rectangular" || branch.metadata.sectionWidthMm !== 300 || branch.metadata.sectionHeightMm !== 150) {
        throw new Error("Expected branch to inherit the smaller 300×150 section.");
    }
    if (branch.metadata?.sectionTransitionRatio == null || Number(branch.metadata.sectionTransitionRatio) < 1.7) {
        throw new Error("Expected branch metadata to keep the section transition ratio.");
    }
});
test("engineering 2d: rectangular air branch inherits section metadata from connected equipment", () => {
    const filter = createEngineeringEquipmentInstance("airFilter", { x: 0, y: 0 }, {
        parameters: { sectionWidthMm: 600, sectionHeightMm: 300, pressureDropPa: 80 },
    });
    const silencer = createEngineeringEquipmentInstance("silencer", { x: 4, y: 0 }, {
        parameters: { sectionWidthMm: 600, sectionHeightMm: 300, pressureDropPa: 45 },
    });
    const branch = createEngineeringPipeConnection({
        fromEquipment: filter,
        fromPortId: "outlet",
        toEquipment: silencer,
        toPortId: "inlet",
    });
    if (!branch) {
        throw new Error("Expected rectangular engineering air branch.");
    }
    if (branch.metadata?.sectionShape !== "rectangular") {
        throw new Error("Expected rectangular section metadata on engineering air branch.");
    }
    if (branch.metadata?.sectionWidthMm !== 600 || branch.metadata?.sectionHeightMm !== 300) {
        throw new Error("Expected engineering air branch to keep 600×300 section metadata.");
    }
    if (branch.diameter !== 400) {
        throw new Error(`Expected hydraulic diameter 400 mm for 600×300 branch, got ${branch.diameter}.`);
    }
});
