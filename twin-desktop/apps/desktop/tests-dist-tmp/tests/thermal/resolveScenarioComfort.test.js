import assert from "node:assert/strict";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { createDefaultScenarioConfig } from "../../src/entities/workflow/workflow.store.js";
import { buildPerformanceOptionsFromScenario, estimateBuildingMeanMrtC, estimateMrtFromEnvelope, resolveComfortMinC, resolveRelativeHumidityPercent, } from "../../src/core/thermal/comfort/resolveScenarioComfort.js";
function testRelativeHumidityFromModel() {
    const scenario = createDefaultScenarioConfig();
    const model = createEmptyBuildingModel();
    model.thermalProtection = {
        climate: { indoorRelativeHumidityPercent: 55 },
    };
    const resolved = resolveRelativeHumidityPercent(null, scenario, model);
    assert.equal(resolved.value, 55);
    assert.equal(resolved.source, "model");
    assert.equal(resolved.explicit, false);
}
function testComfortMinFromSetpoints() {
    const scenario = createDefaultScenarioConfig();
    scenario.setpoints.day = 21;
    scenario.setpoints.night = 18;
    const resolved = resolveComfortMinC(null, scenario);
    assert.equal(resolved.value, 18);
    assert.equal(resolved.source, "setpoints");
}
function testPerformanceOptionsWiring() {
    const scenario = createDefaultScenarioConfig();
    const config = {
        ...scenario,
        comfort: { ...scenario.comfort, comfortMinC: 19, comfortMaxC: 25 },
    };
    const options = buildPerformanceOptionsFromScenario(config, scenario);
    assert.equal(options.comfortMinC, 19);
    assert.equal(options.comfortMaxC, 25);
}
function testEstimatedMrtFromDiagnostics() {
    const mrt = estimateBuildingMeanMrtC({
        timeline: [],
        rooms: {},
        summary: { peakLoadKW: 0, totalEnergyKWh: 0, discomfortHours: 0 },
        diagnostics: {
            buildingPerformance: {
                operativeTemperature: {
                    zones: [
                        {
                            zoneId: "r1",
                            zoneName: "Room",
                            T_air: { value: 21, unit: "°C", source: "solver", warnings: [] },
                            T_mrt: { value: 19.5, unit: "°C", source: "engineering-derived", warnings: [] },
                            T_op: { value: 20.25, unit: "°C", source: "calculated", warnings: [] },
                        },
                        {
                            zoneId: "r2",
                            zoneName: "Room 2",
                            T_air: { value: 21, unit: "°C", source: "solver", warnings: [] },
                            T_mrt: { value: 20.5, unit: "°C", source: "engineering-derived", warnings: [] },
                            T_op: { value: 20.75, unit: "°C", source: "calculated", warnings: [] },
                        },
                    ],
                },
            },
        },
    });
    assert.ok(mrt != null && Math.abs(mrt - 20) < 0.01);
}
function testMrtFromEnvelope() {
    const model = createEmptyBuildingModel();
    model.thermalProtection = {
        envelope: [
            {
                id: "wall-1",
                label: "Wall",
                kind: "wall",
                areaM2: 20,
                layers: [
                    { materialId: "brick_clay", thickness_m: 0.51 },
                    { materialId: "mineral_wool", thickness_m: 0.15 },
                ],
            },
        ],
    };
    const mrt = estimateMrtFromEnvelope(model, 21, -26);
    assert.ok(mrt != null && mrt < 21);
}
export function runResolveScenarioComfortTests() {
    testRelativeHumidityFromModel();
    testComfortMinFromSetpoints();
    testPerformanceOptionsWiring();
    testEstimatedMrtFromDiagnostics();
    testMrtFromEnvelope();
    console.log("resolveScenarioComfort tests passed");
}
