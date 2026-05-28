import {
  createEngineeringEquipmentInstance,
  createTypicalCtpEngineeringSystems,
  getEngineeringPort,
  getEngineeringPortWorldPosition,
  rotateEngineeringDirection,
} from "../../src/features/build/engineering2d/catalog.js";
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
  ] as const;

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
  expectApproximatelyEqual(world.y, 19.4, 1e-6, "Pump inlet Y after 90 degree rotation");

  const rotatedDirection = rotateEngineeringDirection(inlet.direction, pump.rotation);
  if (rotatedDirection !== "top") {
    throw new Error(`Expected rotated inlet direction to be top, got ${rotatedDirection}.`);
  }
});

test("engineering 2d: automation links are routed as signal pipes", () => {
  const systems = createTypicalCtpEngineeringSystems("l1");
  const signalPipes = systems.pipes.filter((pipe) => pipe.medium === "signal");
  if (signalPipes.length < 2) {
    throw new Error(`Expected at least 2 signal connections to automation cabinet, got ${signalPipes.length}.`);
  }
});
