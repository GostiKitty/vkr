import { buildGeometryRenderModel } from "../../src/core/geometry/bimPipeline.js";
import { createThermalFieldModel } from "../../src/core/thermal/field.js";
import { sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import { test } from "../testHarness.js";

test("demo model keeps windows and doors in 3D render model", () => {
  const renderModel = buildGeometryRenderModel(sampleBuildingSP50);
  const openingCount = renderModel.walls.reduce((sum, wall) => sum + wall.openings.length, 0);
  if (openingCount <= 0) {
    throw new Error("3D render model should keep opening cuts for demo windows and doors.");
  }
});

test("project without networks still keeps shell for restored 3D path", () => {
  const shellOnlyModel = {
    ...sampleBuildingSP50,
    pipes: [],
    ducts: [],
    equipment: [],
    sensors: [],
  };
  const renderModel = buildGeometryRenderModel(shellOnlyModel);
  if (!renderModel.roomVolumes.length || !renderModel.walls.length) {
    throw new Error("Shell geometry should remain available without networks.");
  }
});

test("thermal field uses room and wall ids from model without extra detached offset data", () => {
  const renderModel = buildGeometryRenderModel(sampleBuildingSP50);
  const field = createThermalFieldModel(sampleBuildingSP50, {
    outdoorTemperatureC: -12,
    setpointTemperatureC: 21,
    roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
  }, renderModel);
  const renderRoomMap = new Map(renderModel.roomVolumes.map((room) => [room.roomId, room]));
  const wallIds = new Set(sampleBuildingSP50.walls.map((wall) => wall.id));
  if (!field.rooms.length) {
    throw new Error("Thermal field should keep room surfaces for restored 3D path.");
  }
  if (
    field.rooms.some((room) => {
      const source = renderRoomMap.get(room.roomId);
      if (!source) {
        return true;
      }
      if (room.polygon.length !== source.polygon.length) {
        return true;
      }
      return room.polygon.some((point, index) => {
        const sourcePoint = source.polygon[index];
        return Math.abs(point.x - sourcePoint.x) > 1e-6 || Math.abs(point.y - sourcePoint.y) > 1e-6;
      });
    })
  ) {
    throw new Error("Thermal field room surfaces should stay anchored to render geometry without detached offset.");
  }
  if (field.boundaries.some((boundary) => !wallIds.has(boundary.wallId))) {
    throw new Error("Thermal field should stay anchored to existing wall ids.");
  }
});
