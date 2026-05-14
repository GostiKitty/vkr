import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import {
  getPipeVisualStyle,
  isPipeVisuallyDistinctByRole,
  resolveNetworkSystemType,
  resolvePipeCircuitRole,
} from "../../src/entities/networks/types.js";
import { useBuildStore } from "../../src/features/build/build.store.js";
import { buildNetworkConnectivityWarnings } from "../../src/features/build/networks/connectivity.js";
import { test } from "../testHarness.js";

test("networks: legacy pipe without new fields is normalized safely", () => {
  const store = useBuildStore.getState();
  store.loadModelSnapshot({
    ...createEmptyBuildingModel(),
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
    pipes: [
      {
        id: "p1",
        levelId: "l1",
        type: "heating_supply",
        path: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        diameter_mm: 25,
        material: "steel",
        fluidTemperatureC: 70,
        flowRate_kg_s: 0.1,
        pressurePa: 1000,
        connectedEquipmentIds: [],
      },
    ],
  });
  const pipe = useBuildStore.getState().model.pipes[0];
  if (!pipe) {
    throw new Error("Expected normalized pipe in store.");
  }
  if (pipe.systemType !== "heating") {
    throw new Error(`Expected normalized systemType heating, got ${String(pipe.systemType)}.`);
  }
  if (pipe.circuitRole !== "supply") {
    throw new Error(`Expected normalized circuitRole supply, got ${String(pipe.circuitRole)}.`);
  }
  if (pipe.flowDirection !== "forward") {
    throw new Error(`Expected default flowDirection forward, got ${String(pipe.flowDirection)}.`);
  }
});

test("networks: supply and return are visually distinct", () => {
  const supply = {
    type: "heating_supply" as const,
    systemType: resolveNetworkSystemType("heating_supply"),
    flowRole: "supply" as const,
    circuitRole: resolvePipeCircuitRole("heating_supply"),
    markingColor: undefined,
  };
  const ret = {
    type: "heating_return" as const,
    systemType: resolveNetworkSystemType("heating_return"),
    flowRole: "return" as const,
    circuitRole: resolvePipeCircuitRole("heating_return"),
    markingColor: undefined,
  };
  if (!isPipeVisuallyDistinctByRole(supply, ret)) {
    throw new Error("Expected supply and return pipes to have distinct visual roles.");
  }
});

test("networks: diameter affects visual style", () => {
  const small = getPipeVisualStyle({
    type: "heating_supply",
    systemType: "heating",
    flowRole: "supply",
    circuitRole: "supply",
    diameter_mm: 20,
    material: "steel",
    flowDirection: "forward",
    markingColor: undefined,
  });
  const large = getPipeVisualStyle({
    type: "heating_supply",
    systemType: "heating",
    flowRole: "supply",
    circuitRole: "supply",
    diameter_mm: 100,
    material: "steel",
    flowDirection: "forward",
    markingColor: undefined,
  });
  if (!(large.strokeWidth > small.strokeWidth)) {
    throw new Error("Expected larger diameter to increase visual stroke width.");
  }
  if (!(large.radius_m > small.radius_m)) {
    throw new Error("Expected larger diameter to increase 3D radius.");
  }
});

test("networks: connectivity validation finds unconnected elements", () => {
  const warnings = buildNetworkConnectivityWarnings({
    ...createEmptyBuildingModel(),
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
    pipes: [
      {
        id: "p1",
        levelId: "l1",
        type: "heating_supply",
        systemType: "heating",
        heatingSystemKind: "two_pipe",
        flowRole: "supply",
        circuitRole: "supply",
        segmentClass: "branch",
        flowDirection: "forward",
        path: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        markingColor: "gost_supply",
        heatCarrier: "water",
        diameter_mm: 25,
        innerDiameter_mm: 21,
        material: "steel",
        fluidTemperatureC: 70,
        flowRate_kg_s: 0.1,
        pressurePa: 1000,
        connectedEquipmentIds: [],
      },
    ],
    equipment: [
      {
        id: "eq1",
        type: "radiator",
        position: { x: 2, y: 2 },
        levelId: "l1",
        roomId: null,
        state: "on",
        params: {},
        connectedNetworkIds: [],
      },
    ],
  });
  if (!warnings.some((warning) => warning.targetKind === "pipe")) {
    throw new Error("Expected warning for unconnected pipe.");
  }
  if (!warnings.some((warning) => warning.targetKind === "equipment")) {
    throw new Error("Expected warning for unconnected equipment.");
  }
});
