import assert from "node:assert/strict";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { createThermalFieldModel } from "../../src/core/thermal/field.js";
import { test } from "../testHarness.js";
function requireEngineeringSystems(model) {
    if (!model.engineeringSystems) {
        throw new Error("Expected engineering systems model.");
    }
    return model.engineeringSystems;
}
test("thermal field: engineering convector contributes a heat source", () => {
    const model = createEmptyBuildingModel();
    model.levels = [{ id: "level-1", name: "1 этаж", elevation_m: 0, height_m: 3 }];
    model.rooms = [
        {
            id: "room-1",
            name: "Комната",
            levelId: "level-1",
            polygon: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 4 },
                { x: 0, y: 4 },
            ],
        },
    ];
    model.walls = [
        { id: "w1", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, thickness_m: 0.3, height_m: 3 },
        { id: "w2", levelId: "level-1", a: { x: 6, y: 0 }, b: { x: 6, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w3", levelId: "level-1", a: { x: 6, y: 4 }, b: { x: 0, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w4", levelId: "level-1", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3 },
    ];
    requireEngineeringSystems(model).equipment.push({
        id: "conv-1",
        type: "convector",
        name: "Конвектор",
        x: 1.2,
        y: 2,
        width: 1.4,
        height: 0.85,
        rotation: 0,
        ports: [],
        parameters: {
            nominalPowerW: 1800,
            designTemperatureC: 70,
        },
        metadata: {},
        levelId: "level-1",
    });
    const field = createThermalFieldModel(model, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: { "room-1": 21 },
    });
    const source = field.sources.find((item) => item.id === "conv-1");
    assert.ok(source, "Expected engineering convector to be exported as a heat source.");
    assert.equal(source.kind, "radiator");
    assert.ok(source.powerW >= 1800);
});
test("thermal field: engineering air heater contributes a heat source", () => {
    const model = createEmptyBuildingModel();
    model.levels = [{ id: "level-1", name: "1 этаж", elevation_m: 0, height_m: 3 }];
    model.rooms = [
        {
            id: "room-1",
            name: "Комната",
            levelId: "level-1",
            polygon: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 4 },
                { x: 0, y: 4 },
            ],
        },
    ];
    model.walls = [
        { id: "w1", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, thickness_m: 0.3, height_m: 3 },
        { id: "w2", levelId: "level-1", a: { x: 6, y: 0 }, b: { x: 6, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w3", levelId: "level-1", a: { x: 6, y: 4 }, b: { x: 0, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w4", levelId: "level-1", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3 },
    ];
    requireEngineeringSystems(model).equipment.push({
        id: "air-heater-1",
        type: "airHeater",
        name: "Калорифер",
        x: 2.6,
        y: 2,
        width: 1.6,
        height: 0.9,
        rotation: 0,
        ports: [],
        parameters: {
            powerKW: 18,
            airflowM3H: 1200,
            supplyTemperatureC: 24,
            pressureDropPa: 80,
        },
        metadata: {},
        levelId: "level-1",
    });
    const field = createThermalFieldModel(model, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: { "room-1": 21 },
    });
    const source = field.sources.find((item) => item.id === "air-heater-1");
    assert.ok(source, "Expected engineering air heater to be exported as a heat source.");
    assert.equal(source.kind, "equipment");
    assert.ok(source.powerW >= 18_000);
});
test("thermal field: engineering air humidifier contributes a heat source", () => {
    const model = createEmptyBuildingModel();
    model.levels = [{ id: "level-1", name: "1 СЌС‚Р°Р¶", elevation_m: 0, height_m: 3 }];
    model.rooms = [
        {
            id: "room-1",
            name: "РљРѕРјРЅР°С‚Р°",
            levelId: "level-1",
            polygon: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 4 },
                { x: 0, y: 4 },
            ],
        },
    ];
    model.walls = [
        { id: "w1", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, thickness_m: 0.3, height_m: 3 },
        { id: "w2", levelId: "level-1", a: { x: 6, y: 0 }, b: { x: 6, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w3", levelId: "level-1", a: { x: 6, y: 4 }, b: { x: 0, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w4", levelId: "level-1", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3 },
    ];
    requireEngineeringSystems(model).equipment.push({
        id: "air-humidifier-1",
        type: "airHumidifier",
        name: "РЈРІР»Р°Р¶РЅРёС‚РµР»СЊ",
        x: 2.8,
        y: 2,
        width: 1.6,
        height: 0.9,
        rotation: 0,
        ports: [],
        parameters: {
            powerKW: 3,
            airflowM3H: 1200,
            supplyTemperatureC: 19,
            pressureDropPa: 65,
            humidificationCapacityKgH: 15,
        },
        metadata: {},
        levelId: "level-1",
    });
    const field = createThermalFieldModel(model, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: { "room-1": 21 },
    });
    const source = field.sources.find((item) => item.id === "air-humidifier-1");
    assert.ok(source, "Expected engineering air humidifier to be exported as a heat source.");
    assert.equal(source.kind, "equipment");
    assert.ok(source.powerW >= 3_000);
});
test("thermal field: engineering air dehumidifier contributes a heat source", () => {
    const model = createEmptyBuildingModel();
    model.levels = [{ id: "level-1", name: "1 СЌС‚Р°Р¶", elevation_m: 0, height_m: 3 }];
    model.rooms = [
        {
            id: "room-1",
            name: "РљРѕРјРЅР°С‚Р°",
            levelId: "level-1",
            polygon: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 4 },
                { x: 0, y: 4 },
            ],
        },
    ];
    model.walls = [
        { id: "w1", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, thickness_m: 0.3, height_m: 3 },
        { id: "w2", levelId: "level-1", a: { x: 6, y: 0 }, b: { x: 6, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w3", levelId: "level-1", a: { x: 6, y: 4 }, b: { x: 0, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w4", levelId: "level-1", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3 },
    ];
    requireEngineeringSystems(model).equipment.push({
        id: "air-dehumidifier-1",
        type: "airDehumidifier",
        name: "РћСЃСѓС€РёС‚РµР»СЊ",
        x: 3,
        y: 2,
        width: 1.6,
        height: 0.9,
        rotation: 0,
        ports: [],
        parameters: {
            powerKW: 2.5,
            airflowM3H: 1200,
            supplyTemperatureC: 16,
            pressureDropPa: 70,
            moistureRemovalKgH: 8,
        },
        metadata: {},
        levelId: "level-1",
    });
    const field = createThermalFieldModel(model, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: { "room-1": 21 },
    });
    const source = field.sources.find((item) => item.id === "air-dehumidifier-1");
    assert.ok(source, "Expected engineering air dehumidifier to be exported as a heat source.");
    assert.equal(source.kind, "equipment");
    assert.ok(source.powerW >= 2_500);
});
test("thermal field: roof fan contributes an equipment heat source", () => {
    const model = createEmptyBuildingModel();
    model.levels = [{ id: "level-1", name: "1", elevation_m: 0, height_m: 3 }];
    model.rooms = [
        {
            id: "room-1",
            name: "Комната",
            levelId: "level-1",
            polygon: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 4 },
                { x: 0, y: 4 },
            ],
        },
    ];
    model.walls = [
        { id: "w1", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, thickness_m: 0.3, height_m: 3 },
        { id: "w2", levelId: "level-1", a: { x: 6, y: 0 }, b: { x: 6, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w3", levelId: "level-1", a: { x: 6, y: 4 }, b: { x: 0, y: 4 }, thickness_m: 0.3, height_m: 3 },
        { id: "w4", levelId: "level-1", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3 },
    ];
    requireEngineeringSystems(model).equipment.push({
        id: "roof-fan-1",
        type: "roofFan",
        name: "Roof Fan",
        x: 3,
        y: 2,
        width: 1.35,
        height: 1.1,
        rotation: 0,
        ports: [],
        parameters: {
            powerKW: 1.5,
            airflowM3H: 1800,
            pressurePa: 550,
            airMedium: "airExhaust",
        },
        metadata: {},
        levelId: "level-1",
    });
    const field = createThermalFieldModel(model, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: { "room-1": 21 },
    });
    const source = field.sources.find((item) => item.id === "roof-fan-1");
    assert.ok(source, "Expected roof fan to be exported as an equipment heat source.");
    assert.equal(source.kind, "equipment");
    assert.ok(source.powerW >= 800);
});
