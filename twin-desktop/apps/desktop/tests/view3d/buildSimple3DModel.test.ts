import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { createThermalFieldModel } from "../../src/core/thermal/field.js";
import { sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import { buildSimple3DModel } from "../../src/features/build/view3d/buildSimple3DModel.js";
import { test } from "../testHarness.js";

const fixtureModel = {
  ...createEmptyBuildingModel(),
  levels: [{ id: "level-1", name: "1 этаж", elevation_m: 0, height_m: 3 }],
  rooms: [
    {
      id: "room-a",
      name: "Комната А",
      levelId: "level-1",
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
    },
  ],
  walls: [
    { id: "wall-north", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, thickness_m: 0.3, height_m: 3 },
    { id: "wall-east", levelId: "level-1", a: { x: 10, y: 0 }, b: { x: 10, y: 8 }, thickness_m: 0.3, height_m: 3 },
    { id: "wall-south", levelId: "level-1", a: { x: 10, y: 8 }, b: { x: 0, y: 8 }, thickness_m: 0.3, height_m: 3 },
    { id: "wall-west", levelId: "level-1", a: { x: 0, y: 8 }, b: { x: 0, y: 0 }, thickness_m: 0.3, height_m: 3 },
  ],
  windows: [
    {
      id: "window-east",
      anchor: { wallId: "wall-east", t: 0.5, offset_m: 4 },
      width_m: 1.6,
      height_m: 1.5,
      sill_m: 0.9,
    },
  ],
  doors: [
    {
      id: "door-north",
      anchor: { wallId: "wall-north", t: 0.4, offset_m: 4 },
      width_m: 1,
      height_m: 2.1,
      sill_m: 0,
    },
  ],
};

function createFixtureThermalField() {
  return createThermalFieldModel(fixtureModel, {
    outdoorTemperatureC: -12,
    setpointTemperatureC: 21,
    roomTemperaturesC: { "room-a": 20.5 },
  });
}

test("buildSimple3DModel returns shell and openings for demo", () => {
  const model = buildSimple3DModel(sampleBuildingSP50, "level-1", { showNetworks: true, showEquipment: true });
  if (!model.simpleWalls.length || !model.simpleRooms.length) {
    throw new Error("Demo simple model should contain walls and rooms.");
  }
  if (!model.simpleWindows.length || !model.simpleDoors.length) {
    throw new Error("Demo simple model should expose window and door placements.");
  }
});

test("buildSimple3DModel returns windows and doors for regular project model", () => {
  const model = buildSimple3DModel(fixtureModel, "level-1", {});
  if (model.simpleWindows.length !== 1 || model.simpleDoors.length !== 1) {
    throw new Error("Regular project model should keep window and door placements.");
  }
});

test("window and door placement stay on their host wall lines", () => {
  const model = buildSimple3DModel(fixtureModel, "level-1", {});
  const windowItem = model.simpleWindows[0];
  const doorItem = model.simpleDoors[0];
  if (!Number.isFinite(windowItem.center.x) || !Number.isFinite(windowItem.center.z) || !Number.isFinite(doorItem.center.x) || !Number.isFinite(doorItem.center.z)) {
    throw new Error("Opening placement should not produce NaN coordinates.");
  }
  if (Math.abs(windowItem.wallCenter.x - 10) > 0.001) {
    throw new Error("Window should stay on the east wall line.");
  }
  if (Math.abs(doorItem.wallCenter.z - 0) > 0.001) {
    throw new Error("Door should stay on the north wall line.");
  }
});

test("room boundary and room temperature surface share the same coordinates", () => {
  const thermalField = createFixtureThermalField();
  const model = buildSimple3DModel(fixtureModel, "level-1", {
    thermalField,
    showTemperature: true,
  });
  const room = model.simpleRooms.find((entry) => entry.id === "room-a");
  const surface = model.simpleTemperatureSurfaces.find((entry) => entry.id === "room:room-a");
  if (!room || !surface?.boundary) {
    throw new Error("Expected room temperature surface for room-a.");
  }
  if (JSON.stringify(room.boundary) !== JSON.stringify(surface.boundary)) {
    throw new Error("Room surface should reuse the same transformed boundary as the room shell.");
  }
});

test("temperature data returns summary and surfaces without offset warnings", () => {
  const thermalField = createFixtureThermalField();
  const model = buildSimple3DModel(fixtureModel, "level-1", {
    thermalField,
    showTemperature: true,
    showWallTemperature: true,
  });
  if (!model.temperatureSummary || model.simpleTemperatureSurfaces.length < 2) {
    throw new Error("Expected room and wall temperature surfaces when thermal data is available.");
  }
  if (!Number.isFinite(model.temperatureSummary.min_C) || !Number.isFinite(model.temperatureSummary.max_C)) {
    throw new Error("Temperature summary should contain finite min/max.");
  }
});

test("missing temperature data returns warning instead of shifted placeholder", () => {
  const model = buildSimple3DModel(fixtureModel, "level-1", {
    thermalField: null,
    showTemperature: true,
  });
  if (model.simpleTemperatureSurfaces.length !== 0) {
    throw new Error("No thermal field should mean no temperature surfaces.");
  }
  if (!model.temperatureSummary?.warnings.length) {
    throw new Error("Missing thermal data should produce a warning.");
  }
});

test("legacy project without windows and doors does not break simple 3D model", () => {
  const legacyModel = {
    ...sampleBuildingSP50,
    windows: [],
    doors: [],
    roofs: [],
    floorSlabs: [],
  };
  const model = buildSimple3DModel(legacyModel, "level-1", {});
  if (!model.simpleWalls.length || !model.simpleRooms.length) {
    throw new Error("Legacy shell should still render without openings and slabs.");
  }
});
