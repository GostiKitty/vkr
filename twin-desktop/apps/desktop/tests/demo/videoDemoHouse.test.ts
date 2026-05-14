import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildGeometryRenderModel } from "../../src/core/geometry/bimPipeline.js";
import { buildAdjacencyGraph } from "../../src/core/graph/adjacency.js";
import { createThermalFieldModel } from "../../src/core/thermal/field.js";
import { runEngineeringThermalAnalysis } from "../../src/core/thermal/engineering/analysis.js";
import { buildDemoSp50RunResult } from "../../src/demo/sampleBuildingSP50.js";
import { buildVideoDemoHouseModel, buildVideoDemoThermalResult, VIDEO_DEMO_ROOM_TEMPERATURES, videoDemoHouse } from "../../src/demo/videoDemoHouse.js";
import { runVideoDemoScenario, videoDemoScenario } from "../../src/demo/videoDemoScenario.js";
import { buildCanonical3DModel } from "../../src/features/build/view3d/buildCanonical3DModel.js";
import { test } from "../testHarness.js";

function assertFiniteDeep(value: unknown, path = "root") {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Expected finite numeric value at ${path}.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertFiniteDeep(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      assertFiniteDeep(entry, `${path}.${key}`);
    });
  }
}

test("videoDemoHouse contains complete geometry, networks and temperature data", () => {
  if (videoDemoHouse.levels.length !== 1) {
    throw new Error("Video demo house should stay one-storey.");
  }
  if (videoDemoHouse.rooms.length < 4 || videoDemoHouse.walls.length < 12) {
    throw new Error("Video demo house should include a complete shell with four rooms.");
  }
  if (!videoDemoHouse.windows.length || !videoDemoHouse.doors.length) {
    throw new Error("Video demo house should include windows and doors.");
  }
  if (!(videoDemoHouse.roofs?.length ?? 0) || !(videoDemoHouse.floorSlabs?.length ?? 0)) {
    throw new Error("Video demo house should include roof and floor slab.");
  }
  if (!videoDemoHouse.pipes.length || !videoDemoHouse.equipment.length || !videoDemoHouse.sensors.length) {
    throw new Error("Video demo house should include simple heating network, equipment and a sensor.");
  }
  if (Object.keys(VIDEO_DEMO_ROOM_TEMPERATURES).length !== videoDemoHouse.rooms.length) {
    throw new Error("Every video demo room should have room-based temperature data.");
  }
});

test("videoDemoHouse room polygons stay aligned in canonical 3D", () => {
  const thermalResult = buildVideoDemoThermalResult(videoDemoHouse);
  const firstFrame = thermalResult.timeline[0];
  if (!firstFrame) {
    throw new Error("Video demo thermal result should expose at least one frame.");
  }
  const thermalField = createThermalFieldModel(videoDemoHouse, {
    outdoorTemperatureC: firstFrame.outdoorTemperatureC,
    setpointTemperatureC: 21,
    roomTemperaturesC: Object.fromEntries(
      Object.entries(firstFrame.rooms).map(([roomId, payload]) => [roomId, payload.temperatureC])
    ),
  });
  const canonical = buildCanonical3DModel(videoDemoHouse, videoDemoHouse.levels[0]?.id ?? null, { thermalField });
  const renderGeometry = buildGeometryRenderModel(videoDemoHouse);
  const renderRoomsById = new Map(
    renderGeometry.roomVolumes
      .filter((entry) => entry.roomId.startsWith("video-room-"))
      .map((entry) => [entry.roomId, entry])
  );
  if (canonical.rooms.length !== videoDemoHouse.rooms.length) {
    throw new Error("Canonical 3D should expose one room floor per demo room.");
  }
  canonical.rooms.forEach((room) => {
    const source = renderRoomsById.get(room.id);
    if (!source) {
      throw new Error(`Render geometry room ${room.id} should exist for the video demo.`);
    }
    if (source.polygon.length !== room.boundary.length) {
      throw new Error(`Canonical room floor ${room.id} should keep the renderGeometry polygon.`);
    }
    if (
      source.polygon.some((point, index) => {
        const current = room.boundary[index];
        return Math.abs(point.x - current.x) > 1e-6 || Math.abs(point.y - current.y) > 1e-6;
      })
    ) {
      throw new Error(`Canonical room floor ${room.id} should stay aligned with renderGeometry.`);
    }
    if (!Number.isFinite(room.temperature_C)) {
      throw new Error(`Room ${room.id} should receive room-based temperature coloring data.`);
    }
  });
});

test("video demo thermal result keeps canonical geometry and now supports dedicated temperature overlays", () => {
  const thermalResult = buildVideoDemoThermalResult(videoDemoHouse);
  if (!thermalResult.timeline.length) {
    throw new Error("Video demo thermal result should not be empty.");
  }
  const source = readFileSync(
    resolve(process.cwd(), "src/features/build/view3d/Build3DCanonicalPreview.tsx"),
    "utf8"
  );
  if (!source.includes("temperature:room:")) {
    throw new Error("Canonical 3D should create dedicated temperature overlay meshes for room floors.");
  }
  const baseline = buildCanonical3DModel(videoDemoHouse, videoDemoHouse.levels[0]?.id ?? null, { thermalField: null });
  const firstFrame = thermalResult.timeline[0];
  const thermalField = createThermalFieldModel(videoDemoHouse, {
    outdoorTemperatureC: firstFrame.outdoorTemperatureC,
    setpointTemperatureC: 21,
    roomTemperaturesC: Object.fromEntries(
      Object.entries(firstFrame.rooms).map(([roomId, payload]) => [roomId, payload.temperatureC])
    ),
  });
  const colored = buildCanonical3DModel(videoDemoHouse, videoDemoHouse.levels[0]?.id ?? null, { thermalField });
  baseline.rooms.forEach((room, index) => {
    const coloredRoom = colored.rooms[index];
    if (!coloredRoom) {
      throw new Error("Colored canonical room should exist.");
    }
    if (
      room.boundary.some((point, pointIndex) => {
        const next = coloredRoom.boundary[pointIndex];
        return !next || Math.abs(point.x - next.x) > 1e-6 || Math.abs(point.y - next.y) > 1e-6;
      })
    ) {
      throw new Error("Temperature coloring must not change room floor geometry.");
    }
  });
  if (!colored.temperatureSurfaces.length) {
    throw new Error("Video demo should expose dedicated room temperature surfaces.");
  }
});

test("video demo SP50 report contains finite primary metrics", () => {
  const sp50 = buildDemoSp50RunResult(videoDemoHouse, "video-demo-house");
  assertFiniteDeep(sp50.report.building, "sp50.building");
  assertFiniteDeep(sp50.report.energy, "sp50.energy");
  if (!sp50.report.constructions.length) {
    throw new Error("Video demo SP50 report should include envelope constructions.");
  }
});

test("demo house keeps passive gains below total heat losses in the cold scenario", () => {
  const result = runEngineeringThermalAnalysis(
    videoDemoHouse,
    buildAdjacencyGraph(videoDemoHouse),
    {
      duration: "24h",
      timestepMinutes: 10,
      outdoor: {
        baseC: -18,
        amplitudeC: 0,
        seasonalOffsetC: 0,
        phaseShiftHours: 0,
      },
      setpoints: {
        day: 21,
        night: 19,
        dayStartHour: 6,
        nightStartHour: 22,
      },
      internalGains: {
        dayGain_W_m2: 3,
        nightGain_W_m2: 1,
      },
      infiltrationACH: 0.45,
    },
    null
  );
  if (!(result.balance.passiveGainsW < result.balance.totalLossW)) {
    throw new Error(
      `Passive gains should stay below total losses for the demo house. Got ${result.balance.passiveGainsW} W vs ${result.balance.totalLossW} W.`
    );
  }
  if (result.balance.requiredHeatingW <= 0) {
    throw new Error("Cold demo scenario should still require a positive heating power.");
  }
});

test("video demo scenario runs transient and Monte Carlo reproducibly", () => {
  const first = runVideoDemoScenario(videoDemoScenario);
  const second = runVideoDemoScenario(videoDemoScenario);
  if (!first.transient?.result || !first.monteCarlo?.summary || !first.sp50?.report) {
    throw new Error("Video demo scenario should prepare thermal, SP50, transient and Monte Carlo outputs.");
  }
  if (JSON.stringify(first.thermalResult.timeline) !== JSON.stringify(second.thermalResult.timeline)) {
    throw new Error("Video demo thermal result should be reproducible.");
  }
  if (first.monteCarlo.summary.p50MinTemperature !== second.monteCarlo?.summary.p50MinTemperature) {
    throw new Error("Video demo Monte Carlo should be reproducible for a fixed seed.");
  }
  if (!first.engineeringConclusion.trim() || /NaN|undefined|null/.test(first.engineeringConclusion)) {
    throw new Error("Video demo engineering conclusion should be finite and readable.");
  }
});

test("user-facing 3D UI does not mention simple or recovered preview labels", () => {
  const buildPageSource = readFileSync(resolve(process.cwd(), "src/features/build/BuildPage.tsx"), "utf8");
  const panelSource = readFileSync(
    resolve(process.cwd(), "src/features/build/components/ThreeDControlPanel.tsx"),
    "utf8"
  );
  const forbiddenFragments = ["simple preview", "recovered preview", "stable preview", "demo preview"];
  if (forbiddenFragments.some((fragment) => buildPageSource.toLowerCase().includes(fragment))) {
    throw new Error("Main BuildPage 3D UI should not expose preview debug labels.");
  }
  if (forbiddenFragments.some((fragment) => panelSource.toLowerCase().includes(fragment))) {
    throw new Error("3D control panel should not expose preview debug labels.");
  }
});

test("BuildPage keeps Build3DCanonicalPreview as the main 3D path for the video demo", () => {
  const source = readFileSync(resolve(process.cwd(), "src/features/build/BuildPage.tsx"), "utf8");
  if (!source.includes("Build3DCanonicalPreview")) {
    throw new Error("BuildPage should keep canonical 3D as the primary path for the video demo.");
  }
  if (!source.includes("onVideoDemoStepChange={handleVideoDemoStepChange}")) {
    throw new Error("BuildPage should wire the video demo stepper into viewport switching.");
  }
});

test("building a fresh video demo model returns an isolated clone", () => {
  const fresh = buildVideoDemoHouseModel();
  fresh.rooms[0]!.name = "Измененная комната";
  if (videoDemoHouse.rooms[0]?.name === fresh.rooms[0]?.name) {
    throw new Error("Video demo fixture builder should return an isolated clone for loading into the editor.");
  }
});
