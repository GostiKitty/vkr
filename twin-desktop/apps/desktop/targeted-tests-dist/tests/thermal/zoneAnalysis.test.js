import { buildAdjacencyGraph } from "../../src/core/graph/adjacency.js";
import { runEngineeringThermalAnalysis } from "../../src/core/thermal/engineering/analysis.js";
import { runThermalSimulation } from "../../src/core/thermal/solver.js";
import { test } from "../testHarness.js";
const buildModel = () => ({
    levels: [{ id: "level-1", name: "Этаж 1", elevation_m: 0, height_m: 3 }],
    rooms: [
        {
            id: "room-t5kozwyx2o",
            name: "0lsm0c0HzCfPR7Kbs7C_Ki",
            levelId: "level-1",
            polygon: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 4.5 },
                { x: 0, y: 4.5 },
            ],
        },
    ],
    walls: [
        { id: "wall-n", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
        { id: "wall-e", levelId: "level-1", a: { x: 6, y: 0 }, b: { x: 6, y: 4.5 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
        { id: "wall-s", levelId: "level-1", a: { x: 6, y: 4.5 }, b: { x: 0, y: 4.5 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
        { id: "wall-w", levelId: "level-1", a: { x: 0, y: 4.5 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
    ],
    doors: [],
    windows: [
        {
            id: "window-1",
            anchor: { wallId: "wall-n", t: 0.5, offset_m: 2.2 },
            width_m: 1.6,
            height_m: 1.5,
            sill_m: 0.9,
        },
    ],
    pipes: [],
    ducts: [],
    equipment: [
        {
            id: "rad-1",
            type: "radiator",
            position: { x: 1.2, y: 0.8 },
            levelId: "level-1",
            roomId: "room-t5kozwyx2o",
            state: "on",
            params: { nominalPowerW: 1800 },
            connectedNetworkIds: [],
        },
    ],
    sensors: [],
    scenarios: [],
    activeScenarioId: null,
    events: [],
    meta: {},
});
test("zone analysis hides raw ids and anchors field around room operating temperature", () => {
    const model = buildModel();
    const adjacency = buildAdjacencyGraph(model);
    const simulation = runThermalSimulation(model, {
        duration: "24h",
        timestepMinutes: 10,
        outdoor: {
            baseC: -12,
            amplitudeC: 2,
            seasonalOffsetC: 0,
            phaseShiftHours: 0,
        },
        setpoints: {
            day: 21,
            night: 19,
            dayStartHour: 6,
            nightStartHour: 22,
        },
        internalGains: {
            dayGain_W_m2: 4,
            nightGain_W_m2: 1,
        },
        infiltrationACH: 0.45,
    });
    const result = runEngineeringThermalAnalysis(model, adjacency, {
        duration: "24h",
        timestepMinutes: 10,
        outdoor: {
            baseC: -12,
            amplitudeC: 2,
            seasonalOffsetC: 0,
            phaseShiftHours: 0,
        },
        setpoints: {
            day: 21,
            night: 19,
            dayStartHour: 6,
            nightStartHour: 22,
        },
        internalGains: {
            dayGain_W_m2: 4,
            nightGain_W_m2: 1,
        },
        infiltrationACH: 0.45,
    }, simulation);
    if (!result.zoneInsights.length) {
        throw new Error("Ожидались инженерно осмысленные зоны.");
    }
    if (result.zoneInsights.some((zone) => zone.title.includes("0lsm0c0HzCfPR7Kbs7C_Ki") || zone.roomName.includes("0lsm0c0HzCfPR7Kbs7C_Ki"))) {
        throw new Error("Raw/internal id не должен попадать в подписи зон.");
    }
    const field = result.detailedField ?? result.fastField;
    if (!field) {
        throw new Error("Ожидалось построение температурного поля.");
    }
    if (field.averageTemperatureC < 18) {
        throw new Error("Поле не должно уходить в нефизично низкие температуры при рабочем отопительном режиме.");
    }
    if (result.envelope.some((entry) => entry.label.includes("wall-") || entry.label.includes("room-t5kozwyx2o"))) {
        throw new Error("Подписи ограждений не должны показывать внутренние идентификаторы.");
    }
});
