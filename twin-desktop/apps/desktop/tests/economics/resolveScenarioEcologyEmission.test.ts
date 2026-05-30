import { test } from "../testHarness.js";
import {
  defaultCo2EmissionFactorFromEcologyEnergySource,
  ecologyEnergySourceToHeatingSource,
} from "../../src/core/economics/defaultCo2EmissionFactors.js";
import {
  resolveScenarioEcologyEmissionFactor,
  syncEcologyEmissionFactorOnEnergySourceChange,
} from "../../src/core/economics/resolveScenarioEcologyEmission.js";
import { createDefaultScenarioConfig } from "../../src/entities/workflow/workflow.store.js";

test("resolveScenarioEcologyEmission: norm defaults by ecology energy source", () => {
  const electricity = resolveScenarioEcologyEmissionFactor({
    ...createDefaultScenarioConfig(),
    ecology: { energySource: "electricity", emissionFactorKgPerKWh: null },
  });
  if (electricity.source !== "norm" || electricity.value !== 0.35) {
    throw new Error(`Expected electricity norm 0.35, got ${electricity.value} (${electricity.source})`);
  }

  const heat = resolveScenarioEcologyEmissionFactor({
    ...createDefaultScenarioConfig(),
    ecology: { energySource: "централизованное теплоснабжение", emissionFactorKgPerKWh: null },
  });
  if (heat.source !== "norm" || heat.value !== 0.2) {
    throw new Error(`Expected district heat norm 0.20, got ${heat.value}`);
  }

  const gas = resolveScenarioEcologyEmissionFactor({
    ...createDefaultScenarioConfig(),
    ecology: { energySource: "natural_gas", emissionFactorKgPerKWh: null },
  });
  if (gas.source !== "norm" || gas.value !== 0.22) {
    throw new Error(`Expected gas norm 0.22, got ${gas.value}`);
  }
});

test("resolveScenarioEcologyEmission: explicit user value wins over norm", () => {
  const resolved = resolveScenarioEcologyEmissionFactor({
    ...createDefaultScenarioConfig(),
    ecology: { energySource: "electricity", emissionFactorKgPerKWh: 0.41 },
  });
  if (resolved.source !== "user" || resolved.value !== 0.41 || resolved.explicit !== true) {
    throw new Error("Explicit emission factor should override norm defaults.");
  }
});

test("syncEcologyEmissionFactorOnEnergySourceChange updates norm-linked values only", () => {
  const ecology = { energySource: "electricity", emissionFactorKgPerKWh: 0.35 as number | null };
  syncEcologyEmissionFactorOnEnergySourceChange(ecology, "electricity", "natural_gas");
  if (ecology.emissionFactorKgPerKWh !== 0.22) {
    throw new Error("Norm-linked EF should follow energy source changes.");
  }

  ecology.emissionFactorKgPerKWh = 0.41;
  syncEcologyEmissionFactorOnEnergySourceChange(ecology, "electricity", "natural_gas");
  if (ecology.emissionFactorKgPerKWh !== 0.41) {
    throw new Error("Custom EF should be preserved when it diverges from the previous norm.");
  }
});

test("ecologyEnergySourceToHeatingSource maps scenario select values", () => {
  if (ecologyEnergySourceToHeatingSource("централизованное теплоснабжение") !== "heat") {
    throw new Error("District heating label should map to heat.");
  }
  if (defaultCo2EmissionFactorFromEcologyEnergySource("") !== null) {
    throw new Error("Empty energy source should not yield a default EF.");
  }
});
