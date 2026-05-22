import test from "node:test";
import assert from "node:assert/strict";
import { computeSp50EnergyCharacteristic } from "../../src/core/thermal/sp50/energyCharacteristic.js";

test("computeSp50EnergyCharacteristic without placeholders when ACH and climate given", () => {
  const result = computeSp50EnergyCharacteristic({
    kob_W_m3K: 0.45,
    gsop: 4500,
    heatedVolumeM3: 500,
    heatedAreaM2: 120,
    residentialAreaM2: 100,
    indoorTemperatureC: 20,
    outdoorHeatingPeriodAverageC: -2,
    buildingCategory: "residential",
    storeys: 2,
    solarRadiationZone: "central",
    ventilation: {
      infiltrationACH: 0.4,
      ventilationACH: 0.5,
      heatRecoveryFactor: 0,
    },
  });

  assert.equal(result.usesPlaceholderInputs, false);
  assert.ok(result.qHeatingCharacteristic_W_m3K !== null && result.qHeatingCharacteristic_W_m3K > 0);
  assert.ok(result.ventilationCharacteristic_W_m3K !== null);
  assert.ok(result.annualHeatingEnergy_kWh !== null);
  assert.equal(result.derivedInputs.betaV, 0.85);
  assert.ok((result.derivedInputs.LventM3H ?? 0) > 0);
  assert.ok((result.derivedInputs.GinfKgH ?? 0) > 0);
});

test("computeSp50EnergyCharacteristic reports missing GSOP", () => {
  const result = computeSp50EnergyCharacteristic({
    kob_W_m3K: 0.4,
    gsop: null,
    heatedVolumeM3: 300,
    heatedAreaM2: 80,
    residentialAreaM2: 80,
    indoorTemperatureC: 20,
    outdoorHeatingPeriodAverageC: -3,
    ventilation: { infiltrationACH: 0.5, ventilationACH: 0.2 },
  });
  assert.equal(result.usesPlaceholderInputs, true);
  assert.ok(result.placeholderWarnings.some((w) => w.includes("GSOP")));
});
