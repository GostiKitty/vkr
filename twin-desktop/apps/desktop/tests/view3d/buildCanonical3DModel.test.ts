import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildGeometryRenderModel } from "../../src/core/geometry/bimPipeline.js";
import { createThermalFieldModel } from "../../src/core/thermal/field.js";
import { sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import { buildCanonical3DModel } from "../../src/features/build/view3d/buildCanonical3DModel.js";
import { test } from "../testHarness.js";

test("buildCanonical3DModel uses renderGeometry as the canonical source", () => {
  const canonical = buildCanonical3DModel(sampleBuildingSP50, "level-1");
  if (canonical.canonicalSource !== "renderGeometry") {
    throw new Error("Canonical 3D model should declare renderGeometry as its canonical source.");
  }
  if (!canonical.rooms.length || !canonical.walls.length) {
    throw new Error("Canonical 3D model should keep rooms and walls.");
  }
});

test("room floors and walls come from the same canonical render geometry", () => {
  const renderGeometry = buildGeometryRenderModel(sampleBuildingSP50);
  const canonical = buildCanonical3DModel(sampleBuildingSP50, "level-1");
  const renderRoom = renderGeometry.roomVolumes.find((room) => room.levelId === "level-1");
  const canonicalRoom = canonical.rooms.find((room) => room.levelId === "level-1");
  if (!renderRoom || !canonicalRoom) {
    throw new Error("Canonical 3D model should expose a room from renderGeometry.");
  }
  if (renderRoom.polygon.length !== canonicalRoom.boundary.length) {
    throw new Error("Canonical room floor should reuse the renderGeometry polygon.");
  }
  if (
    renderRoom.polygon.some((point, index) => {
      const sourcePoint = canonicalRoom.boundary[index];
      return Math.abs(point.x - sourcePoint.x) > 1e-6 || Math.abs(point.y - sourcePoint.y) > 1e-6;
    })
  ) {
    throw new Error("Canonical room floor should match the renderGeometry polygon exactly.");
  }
  const wallIds = new Set(renderGeometry.walls.filter((entry) => entry.wall.levelId === "level-1").map((entry) => entry.wall.id));
  if (canonical.walls.some((wall) => !wallIds.has(wall.id))) {
    throw new Error("Canonical walls should come from renderGeometry walls.");
  }
});

test("shifted thermal polygon does not affect canonical room floor position", () => {
  const field = createThermalFieldModel(sampleBuildingSP50, {
    outdoorTemperatureC: -12,
    setpointTemperatureC: 21,
    roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
  });
  const firstRoom = sampleBuildingSP50.rooms[0];
  const thermalRoom = field.roomMap.get(firstRoom.id);
  if (!thermalRoom) {
    throw new Error("Thermal room should exist.");
  }
  thermalRoom.polygon = thermalRoom.polygon.map((point) => ({ x: point.x + 7, y: point.y - 4 }));
  field.rooms = field.rooms.map((room) =>
    room.roomId === firstRoom.id
      ? { ...room, polygon: room.polygon.map((point) => ({ x: point.x + 7, y: point.y - 4 })) }
      : room
  );

  const canonical = buildCanonical3DModel(sampleBuildingSP50, "level-1", { thermalField: field });
  const baseline = buildGeometryRenderModel(sampleBuildingSP50).roomVolumes.find((room) => room.roomId === firstRoom.id);
  const canonicalRoom = canonical.rooms.find((room) => room.id === firstRoom.id);
  if (!baseline || !canonicalRoom) {
    throw new Error("Canonical room should exist.");
  }
  if (
    baseline.polygon.some((point, index) => {
      const sourcePoint = canonicalRoom.boundary[index];
      return Math.abs(point.x - sourcePoint.x) > 1e-6 || Math.abs(point.y - sourcePoint.y) > 1e-6;
    })
  ) {
    throw new Error("Shifted thermal polygon should not move canonical room geometry.");
  }
});

test("temperature values do not change canonical room floor geometry", () => {
  const field = createThermalFieldModel(sampleBuildingSP50, {
    outdoorTemperatureC: -10,
    setpointTemperatureC: 21,
    roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 19 + (room.id === sampleBuildingSP50.rooms[0].id ? 2 : 0)])),
  });
  const withoutTemperature = buildCanonical3DModel(sampleBuildingSP50, "level-1", { thermalField: null });
  const withTemperature = buildCanonical3DModel(sampleBuildingSP50, "level-1", { thermalField: field });
  if (withoutTemperature.rooms.length !== withTemperature.rooms.length) {
    throw new Error("Temperature values should not change room floor count.");
  }
  if (
    withTemperature.rooms.some((room, index) =>
      room.boundary.some((point, pointIndex) => {
        const basePoint = withoutTemperature.rooms[index]?.boundary[pointIndex];
        return !basePoint || Math.abs(point.x - basePoint.x) > 1e-6 || Math.abs(point.y - basePoint.y) > 1e-6;
      })
    )
  ) {
    throw new Error("Temperature values should not change canonical room floor geometry.");
  }
  if (!withTemperature.temperatureSurfaces.length) {
    throw new Error("Valid room polygons should keep floor temperature overlay surfaces.");
  }
});

test("windows and doors stay attached to canonical openings", () => {
  const renderGeometry = buildGeometryRenderModel(sampleBuildingSP50);
  const canonical = buildCanonical3DModel(sampleBuildingSP50, "level-1");
  const openingCount = renderGeometry.walls
    .filter((entry) => entry.wall.levelId === "level-1")
    .reduce((sum, entry) => sum + entry.openings.length, 0);
  if (canonical.windows.length + canonical.doors.length !== openingCount) {
    throw new Error("Canonical preview should keep canonical openings from renderGeometry.");
  }
  const wallIds = new Set(canonical.walls.map((wall) => wall.id));
  if ([...canonical.windows, ...canonical.doors].some((opening) => !wallIds.has(opening.wallId))) {
    throw new Error("Canonical openings should stay attached to canonical walls.");
  }
});

test("model without thermal data still shows canonical geometry", () => {
  const canonical = buildCanonical3DModel(sampleBuildingSP50, "level-1", { thermalField: null });
  if (!canonical.rooms.length || !canonical.walls.length) {
    throw new Error("Canonical geometry should remain available without thermal data.");
  }
  if (!canonical.temperatureSummary?.warnings.some((warning) => warning.includes("нет данных по помещениям"))) {
    throw new Error("Canonical summary should report missing room temperature data.");
  }
});

test("model without networks still shows canonical shell", () => {
  const shellOnly = {
    ...sampleBuildingSP50,
    pipes: [],
    ducts: [],
    equipment: [],
    sensors: [],
  };
  const canonical = buildCanonical3DModel(shellOnly, "level-1");
  if (!canonical.rooms.length || !canonical.walls.length) {
    throw new Error("Canonical shell should remain available without networks.");
  }
});

test("canonical 3D filters room floors that escape the shell bounds", () => {
  const distorted = {
    ...sampleBuildingSP50,
    rooms: [
      ...sampleBuildingSP50.rooms,
      {
        id: "room-invalid",
        name: "Помещение 99",
        levelId: "level-1",
        polygon: [
          { x: -40, y: -40 },
          { x: 40, y: -40 },
          { x: 40, y: 40 },
          { x: -40, y: 40 },
        ],
      },
    ],
  };
  const field = createThermalFieldModel(distorted, {
    outdoorTemperatureC: -12,
    setpointTemperatureC: 21,
    roomTemperaturesC: Object.fromEntries(distorted.rooms.map((room) => [room.id, 20])),
  });
  const canonical = buildCanonical3DModel(distorted, "level-1", { thermalField: field });
  if (canonical.rooms.some((room) => room.id === "room-invalid")) {
    throw new Error("Off-shell room polygon should be filtered out from canonical 3D room floors.");
  }
  if (canonical.temperatureSurfaces.some((surface) => surface.roomId === "room-invalid")) {
    throw new Error("Off-shell room polygon should be filtered out from canonical 3D temperature surfaces.");
  }
  if (!canonical.temperatureSurfaces.length) {
    throw new Error("Filtering one invalid polygon should not remove the remaining temperature surfaces.");
  }
});

test("canonical 3D builds wall temperature metadata from valid thermal inputs", () => {
  const activeLevelId = sampleBuildingSP50.levels[0]?.id ?? null;
  const field = createThermalFieldModel(sampleBuildingSP50, {
    outdoorTemperatureC: -14,
    setpointTemperatureC: 21,
    roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
  });
  const canonical = buildCanonical3DModel(sampleBuildingSP50, activeLevelId, { thermalField: field });
  if (!canonical.walls.some((wall) => typeof wall.temperature_C === "number" && wall.temperatureSource !== null)) {
    throw new Error("Canonical walls should expose temperature metadata when thermal data is valid.");
  }
});

test("canonical preview source renders dedicated floor temperature overlays and wall coloring", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/features/build/view3d/Build3DCanonicalPreview.tsx"),
    "utf8"
  );
  if (!source.includes("temperature:room:")) {
    throw new Error("Canonical preview should create dedicated floor temperature overlay meshes.");
  }
  if (!source.includes("createWallTemperatureMaterial")) {
    throw new Error("Canonical preview should color walls when wall temperature metadata is available.");
  }
  if (!source.includes("collectCanonicalShellPlanPoints")) {
    throw new Error("Canonical preview should validate temperature overlay bounds against shell plan geometry.");
  }
  if (!source.includes("< 0.7")) {
    throw new Error("Canonical preview should keep a strict shell intersection threshold for shifted overlays.");
  }
  if (!source.includes('skipped shifted slab surface')) {
    throw new Error("Canonical preview should skip slab surfaces that drift outside the shell.");
  }
  if (!source.includes('skipped shifted roof surface')) {
    throw new Error("Canonical preview should skip roof surfaces that drift outside the shell.");
  }
  if (!source.includes('console.warn("[canonical-3d] skipped shifted temperature surface"')) {
    throw new Error("Canonical preview should warn and skip shifted temperature overlays.");
  }
  if (!source.includes('debug-3d-overlay')) {
    throw new Error("Shifted temperature diagnostics should stay behind an explicit debug flag.");
  }
});
