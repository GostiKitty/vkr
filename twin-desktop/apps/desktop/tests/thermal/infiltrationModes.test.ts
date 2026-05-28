import { buildAdjacencyGraph } from "../../src/core/graph/adjacency.js";
import { runEngineeringThermalAnalysis } from "../../src/core/thermal/engineering/analysis.js";
import { resolveBuildingInfiltration } from "../../src/core/thermal/infiltration.js";
import { buildThermalPhysicsModel } from "../../src/core/thermal/physics.js";
import { runThermalSimulation } from "../../src/core/thermal/solver.js";
import type { BuildingModel } from "../../src/entities/geometry/types.js";
import { test, expectApproximatelyEqual } from "../testHarness.js";

function buildSimpleBuilding(): BuildingModel {
  return {
    levels: [{ id: "l1", name: "Этаж 1", elevation_m: 0, height_m: 3 }],
    rooms: [
      {
        id: "r1",
        name: "Комната 1",
        levelId: "l1",
        polygon: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 4 },
          { x: 0, y: 4 },
        ],
      },
    ],
    walls: [
      { id: "w1", levelId: "l1", a: { x: 0, y: 0 }, b: { x: 5, y: 0 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
      { id: "w2", levelId: "l1", a: { x: 5, y: 0 }, b: { x: 5, y: 4 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
      { id: "w3", levelId: "l1", a: { x: 5, y: 4 }, b: { x: 0, y: 4 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
      { id: "w4", levelId: "l1", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3, wallAssemblyId: "masonry" },
    ],
    roofs: [],
    floorSlabs: [],
    doors: [],
    windows: [],
    pipes: [],
    ducts: [],
    equipment: [],
    sensors: [],
    scenarios: [],
    activeScenarioId: null,
    events: [],
    meta: {},
  };
}

function buildBaseOptions() {
  return {
    duration: "24h" as const,
    timestepMinutes: 10,
    outdoor: { baseC: -10, amplitudeC: 0, seasonalOffsetC: 0, phaseShiftHours: 0 },
    setpoints: { day: 21, night: 19, dayStartHour: 6, nightStartHour: 22 },
    internalGains: { dayGain_W_m2: 2, nightGain_W_m2: 1 },
    infiltrationACH: 0.4,
    ventilationACH: 0.3,
    mechanicalVentilationEnabled: true,
    heatRecoveryFactor: 0.4,
  };
}

test("manualAch preserves previous solver result and reports manual ACH source", () => {
  const building = buildSimpleBuilding();
  const legacyOptions = buildBaseOptions();
  const explicitManualOptions = {
    ...legacyOptions,
    infiltration: {
      infiltrationMode: "manualAch" as const,
      infiltrationACH: legacyOptions.infiltrationACH,
    },
  };

  const legacy = runThermalSimulation(building, legacyOptions);
  const manual = runThermalSimulation(building, explicitManualOptions);

  expectApproximatelyEqual(
    manual.summary.peakLoadKW,
    legacy.summary.peakLoadKW,
    1e-9,
    "manualAch не должен менять peak load относительно старого ACH-пути."
  );
  expectApproximatelyEqual(
    manual.summary.totalEnergyKWh,
    legacy.summary.totalEnergyKWh,
    1e-9,
    "manualAch не должен менять энергопотребление относительно старого ACH-пути."
  );

  if (manual.diagnostics?.building.infiltration?.achSource !== "manual") {
    throw new Error("Diagnostics должны помечать источник ACH как manual при явном manualAch режиме.");
  }
});

test("envelopeLeakage computes ACH from envelope area and G_air", () => {
  const building = buildSimpleBuilding();
  const result = resolveBuildingInfiltration(
    building,
    {
      infiltrationMode: "envelopeLeakage",
      infiltrationACH: 0.2,
      envelopeLeakage: {
        envelopeAirPermeabilityM3sM2At10Pa: 0.0001,
        windowAirPermeabilityM3sMAt10Pa: 0,
        doorAirPermeabilityM3sMAt10Pa: 0,
        pressureExponent: 1,
        referencePressurePa: 10,
      },
    },
    {
      indoorTemperatureC: 21,
      outdoorTemperatureC: -10,
      mechanicalVentilationEnabled: false,
    }
  );

  expectApproximatelyEqual(result.geometry.envelopeOpaqueAreaM2, 54, 1e-9, "Для тестовой коробки должна использоваться наружная площадь 54 м².");
  expectApproximatelyEqual(result.airflowM3s, 0.0054, 1e-9, "Расход должен следовать формуле L_inf = G_air * A.");
  expectApproximatelyEqual(
    result.calculatedACH,
    (result.airflowM3s * 3600) / result.geometry.heatedVolumeM3,
    1e-9,
    "ACH должен быть получен из расчётного расхода и фактического отапливаемого объёма модели."
  );
  if (result.diagnostics.achSource !== "calculated") {
    throw new Error("Расчётный envelopeLeakage режим должен возвращать achSource = calculated.");
  }
});

test("pressureBased increases infiltration when wind speed increases", () => {
  const building = buildSimpleBuilding();
  const lowWind = resolveBuildingInfiltration(
    building,
    {
      infiltrationMode: "pressureBased",
      pressureBased: {
        windSpeedMps: 1,
        windPressureCoefficient: 0.6,
        stackHeightM: 3,
        mechanicalPressurePa: 0,
      },
    },
    {
      indoorTemperatureC: 21,
      outdoorTemperatureC: -10,
      mechanicalVentilationEnabled: false,
    }
  );
  const highWind = resolveBuildingInfiltration(
    building,
    {
      infiltrationMode: "pressureBased",
      pressureBased: {
        windSpeedMps: 8,
        windPressureCoefficient: 0.6,
        stackHeightM: 3,
        mechanicalPressurePa: 0,
      },
    },
    {
      indoorTemperatureC: 21,
      outdoorTemperatureC: -10,
      mechanicalVentilationEnabled: false,
    }
  );

  if (!(highWind.pressureWindPa > lowWind.pressureWindPa)) {
    throw new Error("Рост скорости ветра должен увеличивать ветровой перепад давления.");
  }
  if (!(highWind.calculatedACH > lowWind.calculatedACH)) {
    throw new Error("Рост скорости ветра должен увеличивать расчётную инфильтрацию.");
  }
});

test("heatRecoveryFactor affects only mechanical ventilation loss, not infiltration", () => {
  const building = buildSimpleBuilding();
  const infiltration = resolveBuildingInfiltration(
    building,
    {
      infiltrationMode: "pressureBased",
      pressureBased: {
        windSpeedMps: 5,
        windPressureCoefficient: 0.6,
        stackHeightM: 3,
        mechanicalPressurePa: 0,
      },
    },
    {
      indoorTemperatureC: 21,
      outdoorTemperatureC: -10,
      mechanicalVentilationACH: 0.3,
      mechanicalVentilationEnabled: true,
    }
  );

  const noRecovery = buildThermalPhysicsModel(building, {
    outdoorTemperatureC: -10,
    setpointTemperatureC: 21,
    infiltrationACH: infiltration.calculatedACH,
    ventilationACH: 0.3,
    heatRecoveryFactor: 0,
    fixedRoomTemperaturesC: { r1: 21 },
  });
  const withRecovery = buildThermalPhysicsModel(building, {
    outdoorTemperatureC: -10,
    setpointTemperatureC: 21,
    infiltrationACH: infiltration.calculatedACH,
    ventilationACH: 0.3,
    heatRecoveryFactor: 0.7,
    fixedRoomTemperaturesC: { r1: 21 },
  });

  const roomNoRecovery = Array.from(noRecovery.roomBalances.values())[0];
  const roomWithRecovery = Array.from(withRecovery.roomBalances.values())[0];
  if (!roomNoRecovery || !roomWithRecovery) {
    throw new Error("Ожидался баланс по одной комнате.");
  }

  expectApproximatelyEqual(
    roomWithRecovery.infiltrationLossW,
    roomNoRecovery.infiltrationLossW,
    1e-9,
    "Рекуперация не должна уменьшать потери на инфильтрацию."
  );
  if (!(roomWithRecovery.mechanicalVentilationLossW < roomNoRecovery.mechanicalVentilationLossW)) {
    throw new Error("Рекуперация должна уменьшать только потери на механическую вентиляцию.");
  }
});

test("engineering analysis keeps infiltration and ventilation losses separate without double counting", () => {
  const building = buildSimpleBuilding();
  const adjacency = buildAdjacencyGraph(building);
  const result = runEngineeringThermalAnalysis(
    building,
    adjacency,
    {
      ...buildBaseOptions(),
      infiltration: {
        infiltrationMode: "pressureBased",
        pressureBased: {
          windSpeedMps: 6,
          windPressureCoefficient: 0.6,
          stackHeightM: 3,
          mechanicalPressurePa: 2,
        },
      },
    },
    null
  );

  const room = result.rooms[0];
  if (!room) {
    throw new Error("Ожидался баланс хотя бы одной комнаты.");
  }

  expectApproximatelyEqual(
    room.airExchangeLossW,
    room.infiltrationLossW + room.mechanicalVentilationLossW,
    1e-9,
    "airExchangeLossW должен быть суммой инфильтрации и механической вентиляции."
  );
  expectApproximatelyEqual(
    room.ventilationLossW,
    room.airExchangeLossW,
    1e-9,
    "ventilationLossW в инженерном балансе должен оставаться алиасом суммарного воздухообмена без повторного счёта."
  );
  expectApproximatelyEqual(
    result.balance.totalLossW,
    result.balance.transmissionLossW + result.balance.infiltrationLossW + result.balance.ventilationLossW,
    1e-6,
    "Суммарные потери не должны повторно учитывать механическую вентиляцию и инфильтрацию."
  );
});
