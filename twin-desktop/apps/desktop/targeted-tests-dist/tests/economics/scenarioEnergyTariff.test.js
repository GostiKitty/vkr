import assert from "node:assert/strict";
import { test } from "../testHarness.js";
import { KWH_PER_GCAL, REGIONAL_ENERGY_TARIFFS, resolveHeatingEnergySource, resolveScenarioEnergyTariff, } from "../../src/core/economics/scenarioEnergyTariff.js";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { createDefaultScenarioConfig } from "../../src/entities/workflow/workflow.store.js";
const emptyModel = createEmptyBuildingModel();
test("scenarioEnergyTariff: ecology electricity selects kWh tariff", () => {
    const scenario = createDefaultScenarioConfig();
    scenario.climateCityId = "moscow";
    scenario.ecology = { energySource: "electricity", emissionFactorKgPerKWh: null };
    const resolved = resolveScenarioEnergyTariff(scenario, emptyModel);
    assert.equal(resolved.heatingEnergySource, "electricity");
    assert.equal(resolved.tariffRubPerKWh, REGIONAL_ENERGY_TARIFFS.moscow.electricityTariffRubPerKwh);
});
test("scenarioEnergyTariff: centralized heat uses Gcal conversion for moscow", () => {
    const scenario = createDefaultScenarioConfig();
    scenario.climateCityId = "moscow";
    scenario.ecology = { energySource: "централизованное теплоснабжение", emissionFactorKgPerKWh: null };
    const resolved = resolveScenarioEnergyTariff(scenario, emptyModel);
    assert.equal(resolved.heatingEnergySource, "heat");
    assert.equal(resolved.tariffRubPerKWh, REGIONAL_ENERGY_TARIFFS.moscow.heatTariffRubPerGcal / KWH_PER_GCAL);
});
test("scenarioEnergyTariff: heating pipes in model imply heat when ecology unset", () => {
    const scenario = createDefaultScenarioConfig();
    scenario.climateCityId = "spb";
    scenario.ecology = { energySource: null, emissionFactorKgPerKWh: null };
    const model = {
        ...emptyModel,
        pipes: [
            {
                id: "p1",
                levelId: "l1",
                path: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
                type: "heating_supply",
                diameter_mm: 32,
                material: "steel",
                fluidTemperatureC: 70,
                flowRate_kg_s: 0.2,
                pressurePa: 0,
                connectedEquipmentIds: [],
            },
        ],
    };
    assert.equal(resolveHeatingEnergySource(scenario, model), "heat");
});
