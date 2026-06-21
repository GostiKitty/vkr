import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { buildSmartModelSnapshot } from "../../src/core/networks/intelligence.js";
import { createEngineeringEquipmentInstance, createEngineeringPipeConnection } from "../../src/features/build/engineering2d/catalog.js";
import { buildNetworkSystemsPresentation } from "../../src/features/build/networks/presentation.js";
import { test } from "../testHarness.js";
test("networks: presentation summarizes pipe and air systems together", () => {
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        rooms: [
            {
                id: "room-1",
                name: "РљРѕРјРЅР°С‚Р° 1",
                levelId: "l1",
                polygon: [
                    { x: -1, y: -1 },
                    { x: 6, y: -1 },
                    { x: 6, y: 2 },
                    { x: -1, y: 2 },
                ],
            },
        ],
        pipes: [
            {
                id: "pipe-supply",
                levelId: "l1",
                type: "heating_supply",
                systemType: "heating",
                heatingSystemKind: "two_pipe",
                flowRole: "supply",
                circuitRole: "supply",
                segmentClass: "branch",
                flowDirection: "forward",
                path: [
                    { x: 0, y: 0 },
                    { x: 2, y: 0 },
                ],
                markingColor: "gost_supply",
                heatCarrier: "water",
                diameter_mm: 25,
                innerDiameter_mm: 21,
                material: "steel",
                fluidTemperatureC: 70,
                flowRate_kg_s: 0.12,
                pressurePa: 1000,
                pressureDropPa: 120,
                connectedEquipmentIds: ["pump-1", "rad-1"],
            },
            {
                id: "pipe-return",
                levelId: "l1",
                type: "heating_return",
                systemType: "heating",
                heatingSystemKind: "two_pipe",
                flowRole: "return",
                circuitRole: "return",
                segmentClass: "branch",
                flowDirection: "forward",
                path: [
                    { x: 0, y: 0.2 },
                    { x: 2, y: 0.2 },
                ],
                markingColor: "gost_return",
                heatCarrier: "water",
                diameter_mm: 25,
                innerDiameter_mm: 21,
                material: "steel",
                fluidTemperatureC: 50,
                flowRate_kg_s: 0.12,
                pressurePa: 900,
                pressureDropPa: 90,
                connectedEquipmentIds: ["pump-1", "rad-1"],
            },
        ],
        ducts: [
            {
                id: "duct-main",
                levelId: "l1",
                path: [
                    { x: 3, y: 0 },
                    { x: 5, y: 0 },
                ],
                section: {
                    shape: "rectangular",
                    width_mm: 500,
                    height_mm: 250,
                },
                airflow_m3_s: 1.2,
                airVelocity_m_s: 3.4,
                connectedEquipmentIds: ["ahu-1", "diff-1"],
            },
        ],
        equipment: [
            {
                id: "pump-1",
                type: "pump",
                position: { x: 0.1, y: 0.1 },
                levelId: "l1",
                roomId: null,
                state: "on",
                params: { designFlow_kg_s: 0.12 },
                connectedNetworkIds: ["pipe-supply", "pipe-return"],
            },
            {
                id: "rad-1",
                type: "radiator",
                position: { x: 1.1, y: 0.1 },
                levelId: "l1",
                roomId: null,
                state: "on",
                params: { nominalPowerW: 1800, designFlow_kg_s: 0.08 },
                connectedNetworkIds: ["pipe-supply", "pipe-return"],
            },
            {
                id: "ahu-1",
                type: "ahu",
                position: { x: 3.15, y: 0 },
                levelId: "l1",
                roomId: null,
                state: "on",
                params: { designAirflow_m3_s: 1.2 },
                connectedNetworkIds: ["duct-main"],
            },
            {
                id: "diff-1",
                type: "diffuser",
                position: { x: 4.85, y: 0 },
                levelId: "l1",
                roomId: null,
                state: "on",
                params: { designAirflow_m3_s: 0.6 },
                connectedNetworkIds: ["duct-main"],
            },
        ],
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    if (presentation.pipe.branchCount !== 2) {
        throw new Error(`Expected 2 pipe branches, got ${presentation.pipe.branchCount}.`);
    }
    if (presentation.pipe.connectedBranchCount < 1) {
        throw new Error("Expected at least one connected pipe branch in presentation.");
    }
    if (!presentation.pipe.families.some((family) => family.label === "Отопление" && family.count === 2)) {
        throw new Error("Expected pipe family summary for heating.");
    }
    if (presentation.pipe.systemCount !== 1) {
        throw new Error("Expected one heating contour in presentation.");
    }
    if (presentation.duct.branchCount !== 1 || presentation.duct.connectedBranchCount !== 1) {
        throw new Error("Expected one connected air branch in presentation.");
    }
    if (!(presentation.duct.totalAirflow_m3_s > 1)) {
        throw new Error("Expected airflow summary for duct network.");
    }
    if (!presentation.methodology.calculate.some((line) => line.includes("воздуховодов"))) {
        throw new Error("Expected calculation methodology to mention air ducts.");
    }
    if (!presentation.diagnostics.suggestions.some((item) => item.title.includes("Воздуховод"))) {
        throw new Error("Expected automatic connection suggestions to include air network links.");
    }
});
test("networks: presentation warns about unconnected engineering air equipment", () => {
    const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 1, y: 1 }, {
        levelId: "l1",
        name: "Рџ1",
        parameters: { airflowM3H: 450 },
    });
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        rooms: [
            {
                id: "room-1",
                name: "РљРѕРјРЅР°С‚Р° 1",
                levelId: "l1",
                polygon: [
                    { x: 0, y: 0 },
                    { x: 4, y: 0 },
                    { x: 4, y: 3 },
                    { x: 0, y: 3 },
                ],
            },
        ],
        engineeringSystems: {
            equipment: [diffuser],
            pipes: [],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("воздушной сети"))) {
        throw new Error("Expected diagnostics to warn about unconnected engineering air equipment.");
    }
});
test("networks: presentation warns about engineering air branch without pressure source", () => {
    const filter = createEngineeringEquipmentInstance("airFilter", { x: 0, y: 0 }, {
        levelId: "l1",
        name: "F-1",
        parameters: { airflowM3H: 500, pressureDropPa: 70, sectionWidthMm: 400, sectionHeightMm: 200 },
    });
    const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 3, y: 0 }, {
        levelId: "l1",
        name: "S-1",
        parameters: { airflowM3H: 500, pressureDropPa: 35 },
    });
    const branch = createEngineeringPipeConnection({
        fromEquipment: filter,
        fromPortId: "outlet",
        toEquipment: diffuser,
        toPortId: "supply",
        levelId: "l1",
    });
    if (!branch) {
        throw new Error("Expected engineering air branch without fan.");
    }
    branch.flowRate = 500;
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        engineeringSystems: {
            equipment: [filter, diffuser],
            pipes: [branch],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("источник давления"))) {
        throw new Error("Expected warning about missing pressure source on the engineering air branch.");
    }
});
test("networks: presentation overview hides empty pipe metrics for air-only model", () => {
    const fan = createEngineeringEquipmentInstance("ductFan", { x: 0, y: 0 }, {
        levelId: "l1",
        name: "FAN-OV-1",
        parameters: { airflowM3H: 500, pressurePa: 250 },
    });
    const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 3, y: 0 }, {
        levelId: "l1",
        name: "SUP-OV-1",
        parameters: { airflowM3H: 500, pressureDropPa: 35 },
    });
    const branch = createEngineeringPipeConnection({
        fromEquipment: fan,
        fromPortId: "outlet",
        toEquipment: diffuser,
        toPortId: "supply",
        levelId: "l1",
    });
    if (!branch) {
        throw new Error("Expected air-only engineering branch.");
    }
    branch.flowRate = 500;
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        engineeringSystems: {
            equipment: [fan, diffuser],
            pipes: [branch],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    if (presentation.overview.some((metric) => metric.label === "Трубные сети")) {
        throw new Error("Expected overview to hide empty pipe metrics for an air-only model.");
    }
    if (!presentation.overview.some((metric) => metric.label === "Воздушные сети")) {
        throw new Error("Expected overview to keep the air metric for an air-only model.");
    }
});
test("networks: presentation includes engineering air branches from schematic systems", () => {
    const ahu = createEngineeringEquipmentInstance("airHandlingUnit", { x: 0, y: 0 }, {
        levelId: "l1",
        name: "РџР’РЈ-1",
        parameters: { airflowM3H: 900, heatRecoveryEfficiency: 0.78 },
    });
    const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 4, y: -1 }, {
        levelId: "l1",
        name: "РџСЂРёС‚РѕРє-1",
        parameters: { airflowM3H: 900 },
    });
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: 4, y: 1 }, {
        levelId: "l1",
        name: "Р’С‹С‚СЏР¶РєР°-1",
        parameters: { airflowM3H: 900 },
    });
    const supplyBranch = createEngineeringPipeConnection({
        fromEquipment: ahu,
        fromPortId: "supply-out",
        toEquipment: diffuser,
        toPortId: "supply",
        levelId: "l1",
    });
    const exhaustBranch = createEngineeringPipeConnection({
        fromEquipment: grille,
        fromPortId: "exhaust",
        toEquipment: ahu,
        toPortId: "exhaust-in",
        levelId: "l1",
    });
    if (!supplyBranch || !exhaustBranch) {
        throw new Error("Expected engineering air branches to be created.");
    }
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        engineeringSystems: {
            equipment: [ahu, diffuser, grille],
            pipes: [supplyBranch, exhaustBranch],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    if (presentation.duct.branchCount !== 2 || presentation.duct.connectedBranchCount !== 2) {
        throw new Error("Expected engineering air branches to appear in air-network summary.");
    }
    if (!(presentation.duct.totalAirflow_m3_s > 0.45)) {
        throw new Error("Expected engineering air branches to contribute airflow.");
    }
    if (!presentation.duct.branches.some((branch) => branch.label.includes("Приток")) || !presentation.duct.branches.some((branch) => branch.label.includes("Вытяжка"))) {
        throw new Error("Expected engineering air branch labels in network presentation.");
    }
});
test("networks: presentation uses roof fan as exhaust pressure source", () => {
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: 0, y: 0 }, {
        levelId: "l1",
        name: "E-1",
        parameters: { airflowM3H: 700, pressureDropPa: 25 },
    });
    const roofFan = createEngineeringEquipmentInstance("roofFan", { x: 3.2, y: 0 }, {
        levelId: "l1",
        name: "RF-1",
        parameters: { airflowM3H: 700, pressurePa: 350, powerKW: 1.5, airMedium: "airExhaust" },
    });
    const branch = createEngineeringPipeConnection({
        fromEquipment: grille,
        fromPortId: "exhaust",
        toEquipment: roofFan,
        toPortId: "inlet",
        levelId: "l1",
    });
    if (!branch) {
        throw new Error("Expected exhaust branch to roof fan.");
    }
    branch.flowRate = 700;
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        engineeringSystems: {
            equipment: [grille, roofFan],
            pipes: [branch],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    const exhaustBranch = presentation.duct.branches.find((item) => item.label.includes("RF-1"));
    if (!exhaustBranch) {
        throw new Error("Expected roof fan exhaust branch in air-network summary.");
    }
    if ((exhaustBranch.availablePressurePa ?? 0) < 300) {
        throw new Error(`Expected roof fan available pressure to be used, got ${exhaustBranch.availablePressurePa}.`);
    }
});
test("networks: presentation warns about pressure deficit and room air imbalance in engineering air systems", () => {
    const ahu = createEngineeringEquipmentInstance("airHandlingUnit", { x: 0, y: 1.5 }, {
        levelId: "l1",
        name: "РџР’РЈ-1",
        parameters: { airflowM3H: 900, pressurePa: 90, supplyTemperatureC: 20 },
    });
    const heater = createEngineeringEquipmentInstance("airHeater", { x: 2.2, y: 1.5 }, {
        levelId: "l1",
        name: "РљР°Р»РѕСЂРёС„РµСЂ-1",
        parameters: { airflowM3H: 900, powerKW: 18, pressureDropPa: 120, supplyTemperatureC: 26 },
    });
    const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 4.3, y: 1.5 }, {
        levelId: "l1",
        name: "Рџ1",
        parameters: { airflowM3H: 900, pressureDropPa: 40, supplyTemperatureC: 24 },
    });
    const branchA = createEngineeringPipeConnection({
        fromEquipment: ahu,
        fromPortId: "supply-out",
        toEquipment: heater,
        toPortId: "inlet",
        levelId: "l1",
    });
    const branchB = createEngineeringPipeConnection({
        fromEquipment: heater,
        fromPortId: "outlet",
        toEquipment: diffuser,
        toPortId: "supply",
        levelId: "l1",
    });
    if (!branchA || !branchB) {
        throw new Error("Expected engineering supply branches to be created.");
    }
    branchA.flowRate = 900;
    branchB.flowRate = 900;
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        rooms: [
            {
                id: "room-1",
                name: "РљРѕРјРЅР°С‚Р° 1",
                levelId: "l1",
                polygon: [
                    { x: 3.2, y: 0.4 },
                    { x: 5.5, y: 0.4 },
                    { x: 5.5, y: 2.6 },
                    { x: 3.2, y: 2.6 },
                ],
            },
        ],
        engineeringSystems: {
            equipment: [ahu, heater, diffuser],
            pipes: [branchA, branchB],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("доступного давления"))) {
        throw new Error("Expected engineering air pressure deficit warning.");
    }
    if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("приток без вытяжки"))) {
        throw new Error("Expected room air imbalance warning for engineering air terminals.");
    }
});
test("networks: presentation accounts for air filter losses and closed fire damper", () => {
    const fan = createEngineeringEquipmentInstance("ductFan", { x: 0, y: 1.5 }, {
        levelId: "l1",
        name: "Р’Рљ-1",
        parameters: { airflowM3H: 600, pressurePa: 400, powerKW: 0.8 },
    });
    const filter = createEngineeringEquipmentInstance("airFilter", { x: 2, y: 1.5 }, {
        levelId: "l1",
        name: "Р¤Р’-1",
        parameters: { airflowM3H: 600, pressureDropPa: 80, contaminationPercent: 50 },
    });
    const fireDamper = createEngineeringEquipmentInstance("fireDamper", { x: 4, y: 1.5 }, {
        levelId: "l1",
        name: "РљРџ-1",
        parameters: { pressureDropPa: 35, state: "closed" },
    });
    const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 6, y: 1.5 }, {
        levelId: "l1",
        name: "Рџ1",
        parameters: { airflowM3H: 600, pressureDropPa: 30 },
    });
    const branchA = createEngineeringPipeConnection({
        fromEquipment: fan,
        fromPortId: "outlet",
        toEquipment: filter,
        toPortId: "inlet",
        levelId: "l1",
    });
    const branchB = createEngineeringPipeConnection({
        fromEquipment: filter,
        fromPortId: "outlet",
        toEquipment: fireDamper,
        toPortId: "inlet",
        levelId: "l1",
    });
    const branchC = createEngineeringPipeConnection({
        fromEquipment: fireDamper,
        fromPortId: "outlet",
        toEquipment: diffuser,
        toPortId: "supply",
        levelId: "l1",
    });
    if (!branchA || !branchB || !branchC) {
        throw new Error("Expected engineering air branches with filter and fire damper.");
    }
    branchA.flowRate = 600;
    branchB.flowRate = 600;
    branchC.flowRate = 600;
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        engineeringSystems: {
            equipment: [fan, filter, fireDamper, diffuser],
            pipes: [branchA, branchB, branchC],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    const filterBranch = presentation.duct.branches.find((branch) => branch.label.includes("Р’Рљ-1") && branch.label.includes("Р¤Р’-1"));
    if (!filterBranch || (filterBranch.estimatedPressureDropPa ?? 0) <= 110) {
        throw new Error("Expected air filter contamination to increase branch pressure loss.");
    }
    if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("перекрывает воздушную ветку"))) {
        throw new Error("Expected warning about closed fire damper blocking the air branch.");
    }
});
test("networks: presentation warns about a closed air check valve in an exhaust branch", () => {
    const grille = createEngineeringEquipmentInstance("exhaustGrille", { x: 0, y: 0 }, {
        levelId: "l1",
        name: "E-2",
        parameters: { airflowM3H: 650, pressureDropPa: 25 },
    });
    const checkValve = createEngineeringEquipmentInstance("airCheckValve", { x: 2.2, y: 0 }, {
        levelId: "l1",
        name: "OK-1",
        parameters: { airMedium: "airExhaust", pressureDropPa: 30, state: "closed" },
    });
    const roofFan = createEngineeringEquipmentInstance("roofFan", { x: 4.6, y: 0 }, {
        levelId: "l1",
        name: "RF-2",
        parameters: { airflowM3H: 650, pressurePa: 380, powerKW: 1.3, airMedium: "airExhaust" },
    });
    const branchA = createEngineeringPipeConnection({
        fromEquipment: grille,
        fromPortId: "exhaust",
        toEquipment: checkValve,
        toPortId: "inlet",
        levelId: "l1",
    });
    const branchB = createEngineeringPipeConnection({
        fromEquipment: checkValve,
        fromPortId: "outlet",
        toEquipment: roofFan,
        toPortId: "inlet",
        levelId: "l1",
    });
    if (!branchA || !branchB) {
        throw new Error("Expected exhaust branches with an air check valve.");
    }
    branchA.flowRate = 650;
    branchB.flowRate = 650;
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        engineeringSystems: {
            equipment: [grille, checkValve, roofFan],
            pipes: [branchA, branchB],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("перекрывает воздушную ветку"))) {
        throw new Error("Expected warning about a closed air check valve blocking the air branch.");
    }
    const downstreamBranch = presentation.duct.branches.find((branch) => branch.label.includes("OK-1") && branch.label.includes("RF-2"));
    if (!downstreamBranch || (downstreamBranch.estimatedPressureDropPa ?? 0) < 5000) {
        throw new Error("Expected a closed air check valve to add blocking pressure loss.");
    }
});
test("networks: presentation uses rectangular engineering air sections for branch label and velocity", () => {
    const fan = createEngineeringEquipmentInstance("ductFan", { x: 0, y: 0 }, {
        levelId: "l1",
        name: "Р’Рљ-1",
        parameters: { airflowM3H: 600, pressurePa: 250, sectionWidthMm: 600, sectionHeightMm: 300 },
    });
    const filter = createEngineeringEquipmentInstance("airFilter", { x: 2.4, y: 0 }, {
        levelId: "l1",
        name: "Р¤Р’-1",
        parameters: { sectionWidthMm: 600, sectionHeightMm: 300, pressureDropPa: 80 },
    });
    const branch = createEngineeringPipeConnection({
        fromEquipment: fan,
        fromPortId: "outlet",
        toEquipment: filter,
        toPortId: "inlet",
        levelId: "l1",
    });
    if (!branch) {
        throw new Error("Expected rectangular engineering air branch.");
    }
    branch.flowRate = 600;
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        engineeringSystems: {
            equipment: [fan, filter],
            pipes: [branch],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    const airBranch = presentation.duct.branches.find((item) => item.label.includes("Р’Рљ-1") && item.label.includes("Р¤Р’-1"));
    if (!airBranch) {
        throw new Error("Expected rectangular engineering air branch in presentation.");
    }
    if (!airBranch.sectionLabel.includes("600") || !airBranch.sectionLabel.includes("300")) {
        throw new Error(`Expected rectangular section label to keep 600×300, got ${airBranch.sectionLabel}.`);
    }
    if (!(airBranch.airVelocity_m_s > 0.8 && airBranch.airVelocity_m_s < 1.1)) {
        throw new Error(`Expected rectangular-section air velocity around 0.93 m/s, got ${airBranch.airVelocity_m_s}.`);
    }
});
test("networks: presentation warns about high velocity and abrupt section reduction in engineering air branch", () => {
    const fan = createEngineeringEquipmentInstance("ductFan", { x: 0, y: 0 }, {
        levelId: "l1",
        name: "Р вЂ™Р С™-2",
        parameters: { airflowM3H: 1500, pressurePa: 320, sectionWidthMm: 600, sectionHeightMm: 300 },
    });
    const regulator = createEngineeringEquipmentInstance("airFlowRegulatorVar", { x: 2.4, y: 0 }, {
        levelId: "l1",
        name: "РљР Р’-1",
        parameters: {
            airflowM3H: 1500,
            sectionWidthMm: 200,
            sectionHeightMm: 100,
            damperPositionPercent: 55,
            pressureDropPa: 45,
        },
    });
    const branch = createEngineeringPipeConnection({
        fromEquipment: fan,
        fromPortId: "outlet",
        toEquipment: regulator,
        toPortId: "inlet",
        levelId: "l1",
    });
    if (!branch) {
        throw new Error("Expected engineering air branch with a regulator.");
    }
    branch.flowRate = 1500;
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
        engineeringSystems: {
            equipment: [fan, regulator],
            pipes: [branch],
        },
    };
    const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
    const presentation = buildNetworkSystemsPresentation(model, snapshot);
    const airBranch = presentation.duct.branches.find((item) => item.label.includes("Р вЂ™Р С™-2") && item.label.includes("РљР Р’-1"));
    if (!airBranch) {
        throw new Error("Expected engineering air regulator branch in presentation.");
    }
    if (!airBranch.sectionLabel.includes("200") || !airBranch.sectionLabel.includes("100")) {
        throw new Error(`Expected smaller 200×100 section label, got ${airBranch.sectionLabel}.`);
    }
    if (!(airBranch.airVelocity_m_s > 20)) {
        throw new Error(`Expected high air velocity after reduction, got ${airBranch.airVelocity_m_s}.`);
    }
    if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("скорость"))) {
        throw new Error("Expected warning about excessive air velocity.");
    }
    if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("резкое заужение"))) {
        throw new Error("Expected warning about abrupt section reduction.");
    }
});
