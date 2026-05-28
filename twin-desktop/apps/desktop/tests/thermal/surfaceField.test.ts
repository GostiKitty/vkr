import { buildSurfaceFieldResult } from "../../src/core/thermal/surfaceField.js";
import type { BuildingModel } from "../../src/entities/geometry/types.js";
import { buildSurfaceFieldOverlayGroup } from "../../src/features/build/view3d/surfaceFieldScene.js";
import { test } from "../testHarness.js";

function createSurfaceFieldFixture(): BuildingModel {
  return {
    levels: [
      {
        id: "level-1",
        name: "Level 1",
        elevation_m: 0,
        height_m: 3,
      },
    ],
    rooms: [
      {
        id: "room-1",
        name: "Demo room",
        levelId: "level-1",
        polygon: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 0, y: 4 },
        ],
      },
    ],
    walls: [
      { id: "wall-south", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, thickness_m: 0.24, height_m: 3, wallAssemblyId: "masonry" },
      { id: "wall-east", levelId: "level-1", a: { x: 4, y: 0 }, b: { x: 4, y: 4 }, thickness_m: 0.24, height_m: 3, wallAssemblyId: "masonry" },
      { id: "wall-north", levelId: "level-1", a: { x: 4, y: 4 }, b: { x: 0, y: 4 }, thickness_m: 0.24, height_m: 3, wallAssemblyId: "masonry" },
      { id: "wall-west", levelId: "level-1", a: { x: 0, y: 4 }, b: { x: 0, y: 0 }, thickness_m: 0.24, height_m: 3, wallAssemblyId: "masonry" },
    ],
    roofs: [
      {
        id: "roof-1",
        levelId: "level-1",
        name: "Roof",
        kind: "flat",
        boundary: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 0, y: 4 },
        ],
        elevationBase_m: 3,
        thickness_m: 0.28,
        layers: [
          { materialId: "reinforced_concrete", thickness_m: 0.18 },
          { materialId: "mineral_wool", thickness_m: 0.12 },
        ],
      },
    ],
    floorSlabs: [
      {
        id: "slab-1",
        levelId: "level-1",
        name: "Ground slab",
        kind: "ground",
        boundary: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 0, y: 4 },
        ],
        elevation_m: 0,
        thickness_m: 0.24,
        layers: [
          { materialId: "reinforced_concrete", thickness_m: 0.16 },
          { materialId: "xps", thickness_m: 0.08 },
        ],
      },
    ],
    doors: [],
    windows: [
      {
        id: "window-1",
        anchor: {
          wallId: "wall-north",
          t: 0.5,
          offset_m: 0,
        },
        width_m: 1.6,
        height_m: 1.5,
        sill_m: 0.9,
      },
    ],
    pipes: [
      {
        id: "pipe-1",
        levelId: "level-1",
        path: [
          { x: 0.7, y: 3.5 },
          { x: 3.3, y: 3.5 },
        ],
        type: "heating_supply",
        diameter_mm: 25,
        material: "steel",
        fluidTemperatureC: 70,
        flowRate_kg_s: 0.12,
        pressurePa: 12000,
        connectedEquipmentIds: ["radiator-1"],
        heatLossW: 110,
      },
    ],
    ducts: [],
    equipment: [
      {
        id: "radiator-1",
        type: "radiator",
        position: { x: 2, y: 3.45 },
        levelId: "level-1",
        roomId: "room-1",
        state: "on",
        params: {
          nominalPowerW: 1800,
        },
        connectedNetworkIds: ["pipe-1"],
      },
    ],
    sensors: [],
    scenarios: [],
    activeScenarioId: null,
    events: [],
    meta: {},
    thermalProtection: undefined,
    engineeringSystems: undefined,
  };
}

test("surface thermal field generates patch diagnostics and local gradients", () => {
  const model = createSurfaceFieldFixture();
  const result = buildSurfaceFieldResult({
    model,
    activeLevelId: "level-1",
    roomAirTemperaturesC: { "room-1": 21 },
    outdoorTemperatureC: -18,
    indoorRelativeHumidity: 0.85,
  });

  if (!result.patches.length || !result.surfaces.length) {
    throw new Error("Surface thermal field should generate surface patches for shell geometry.");
  }

  const roomDiagnostics = result.roomDiagnosticsByRoomId.get("room-1");
  if (!roomDiagnostics) {
    throw new Error("Room diagnostics should be generated for each resolved room.");
  }

  const windowPatches = result.patches.filter((patch) => patch.surfaceKind === "window");
  const wallPatches = result.patches.filter((patch) => patch.surfaceKind === "wall");
  if (!windowPatches.length || !wallPatches.length) {
    throw new Error("Fixture should produce both wall and window surface patches.");
  }

  const averageWindowTemp = windowPatches.reduce((sum, patch) => sum + patch.patchTemperatureC, 0) / windowPatches.length;
  const averageWallTemp = wallPatches.reduce((sum, patch) => sum + patch.patchTemperatureC, 0) / wallPatches.length;
  if (!(averageWindowTemp + 0.6 < averageWallTemp)) {
    throw new Error("Window cold zones should produce colder patches than adjacent opaque wall surfaces.");
  }

  const hottestPatch = roomDiagnostics.hottestPatchId ? result.patchMap.get(roomDiagnostics.hottestPatchId) ?? null : null;
  if (!hottestPatch) {
    throw new Error("Room diagnostics should identify the hottest patch.");
  }
  if (!(hottestPatch.patchTemperatureC > roomDiagnostics.avgSurfaceTempC + 0.4)) {
    throw new Error("Radiator and pipe influence should create a local warm patch above the room-average surface temperature.");
  }
  if (!hottestPatch.sourceIds.length) {
    throw new Error("The hottest patch should keep a trace of the heat source contribution.");
  }

  if (!(roomDiagnostics.minSurfaceTempC < roomDiagnostics.maxSurfaceTempC)) {
    throw new Error("Surface diagnostics should preserve a non-uniform temperature range inside the room.");
  }
  if (!roomDiagnostics.condensationRisk) {
    throw new Error("A cold external window in this fixture should trigger condensation risk diagnostics.");
  }

  const overlayGroup = buildSurfaceFieldOverlayGroup(result, {
    mode: "surfaceTemperature",
    showSurfaceField: true,
    showHeatSources: true,
    showThermalBridges: true,
    roomLabelById: new Map([["room-1", "Demo room"]]),
    xRay: true,
  });
  if (overlayGroup.children.length === 0) {
    throw new Error("A non-empty surface field result should produce a non-empty Three.js overlay group.");
  }
});
