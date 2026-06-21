import { buildGeometryRenderModel, buildResolvedGeometryRenderModel, dedupeRoomVolumesForModel, finalizeRoomVolumesForModel, } from "../../src/core/geometry/bimPipeline.js";
import { buildStableAutoRoomId } from "../../src/core/geometry/roomContours.js";
import { buildCanonical3DModel } from "../../src/features/build/view3d/buildCanonical3DModel.js";
import { buildPreviewThermalFrame } from "../../src/core/thermal/preview.js";
import { createThermalFieldModel } from "../../src/core/thermal/field.js";
import { polygonArea } from "../../src/entities/geometry/geom.js";
import { test } from "../testHarness.js";
function buildWallsOnlyLeftModel() {
    return {
        id: "test",
        name: "test",
        levels: [{ id: "level-1", name: "1", elevation_m: 0, height_m: 3 }],
        rooms: [
            {
                id: "room-right",
                name: "Right",
                levelId: "level-1",
                polygon: [
                    { x: 6, y: 0 },
                    { x: 12, y: 0 },
                    { x: 12, y: 12 },
                    { x: 6, y: 12 },
                ],
                source: "manual",
            },
        ],
        walls: [
            { id: "w1", levelId: "level-1", a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, thickness_m: 0.2, height_m: 3 },
            { id: "w2", levelId: "level-1", a: { x: 6, y: 0 }, b: { x: 6, y: 12 }, thickness_m: 0.2, height_m: 3 },
            { id: "w3", levelId: "level-1", a: { x: 6, y: 12 }, b: { x: 0, y: 12 }, thickness_m: 0.2, height_m: 3 },
            { id: "w4", levelId: "level-1", a: { x: 0, y: 12 }, b: { x: 0, y: 0 }, thickness_m: 0.2, height_m: 3 },
            { id: "w5", levelId: "level-1", a: { x: 6, y: 0 }, b: { x: 12, y: 0 }, thickness_m: 0.2, height_m: 3 },
            { id: "w6", levelId: "level-1", a: { x: 12, y: 0 }, b: { x: 12, y: 12 }, thickness_m: 0.2, height_m: 3 },
            { id: "w7", levelId: "level-1", a: { x: 12, y: 12 }, b: { x: 6, y: 12 }, thickness_m: 0.2, height_m: 3 },
            { id: "wL1", levelId: "level-1", a: { x: 6, y: 6 }, b: { x: 3, y: 6 }, thickness_m: 0.12, height_m: 3 },
            { id: "wL2", levelId: "level-1", a: { x: 3, y: 6 }, b: { x: 3, y: 9 }, thickness_m: 0.12, height_m: 3 },
        ],
        doors: [],
        windows: [],
        roofs: [],
        floorSlabs: [],
        pipes: [],
        ducts: [],
        equipment: [],
        sensors: [],
        scenarios: [],
        activeScenarioId: null,
    };
}
test("dedupeRoomVolumesForModel keeps auto-detected left room when only right room is manual", () => {
    const model = buildWallsOnlyLeftModel();
    const renderGeometry = buildGeometryRenderModel(model);
    const deduped = dedupeRoomVolumesForModel(renderGeometry.roomVolumes, model.rooms, "level-1");
    const uniqueIds = new Set(deduped.map((room) => room.roomId));
    if (deduped.length !== 2) {
        throw new Error(`Expected two room volumes after dedupe, got ${deduped.length}.`);
    }
    if (uniqueIds.size !== 2) {
        throw new Error("Auto-detected left room must not be remapped to the manual right room id.");
    }
    if (!deduped.some((room) => room.roomId === "room-right")) {
        throw new Error("Manual right room should remain in deduped volumes.");
    }
    if (deduped.some((room) => room.roomId === "room-right" && room.areaM2 < 60)) {
        throw new Error("Right room volume should keep the right-hand footprint.");
    }
    const leftVolume = deduped.find((room) => room.roomId !== "room-right");
    if (!leftVolume || leftVolume.areaM2 < 60) {
        throw new Error("Left auto-detected room volume should stay available for thermal visualization.");
    }
});
test("auto-room ids are stable across geometry rebuilds", () => {
    const model = buildWallsOnlyLeftModel();
    const leftPolygon = [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 12 },
        { x: 0, y: 12 },
    ];
    const expectedId = buildStableAutoRoomId("level-1", leftPolygon);
    const first = buildResolvedGeometryRenderModel(model, "level-1");
    const second = buildResolvedGeometryRenderModel(model, "level-1");
    const leftFirst = first.roomVolumes.find((room) => room.roomId !== "room-right");
    const leftSecond = second.roomVolumes.find((room) => room.roomId !== "room-right");
    if (!leftFirst || !leftSecond) {
        throw new Error("Left auto room volume should exist.");
    }
    if (leftFirst.roomId !== expectedId || leftSecond.roomId !== expectedId) {
        throw new Error(`Expected stable auto room id ${expectedId}, got ${leftFirst.roomId} and ${leftSecond.roomId}.`);
    }
});
test("finalizeRoomVolumesForModel adds manual room polygon when walls only define the other side", () => {
    const model = {
        ...buildWallsOnlyLeftModel(),
        rooms: [
            ...buildWallsOnlyLeftModel().rooms,
            {
                id: "room-left",
                name: "Left",
                levelId: "level-1",
                polygon: [
                    { x: 0, y: 0 },
                    { x: 6, y: 0 },
                    { x: 6, y: 12 },
                    { x: 0, y: 12 },
                ],
                source: "manual",
            },
        ],
    };
    const renderGeometry = buildGeometryRenderModel(model);
    const finalized = finalizeRoomVolumesForModel(renderGeometry.roomVolumes, model.rooms, "level-1");
    const left = finalized.find((room) => room.roomId === "room-left");
    if (!left || left.areaM2 < 60) {
        throw new Error("Manual left room should remain in finalized volumes with full footprint.");
    }
});
test("canonical 3D keeps temperature overlay for wall-defined left room with internal partition", () => {
    const model = buildWallsOnlyLeftModel();
    const preview = buildPreviewThermalFrame(model, { outdoorTemperatureC: -2, setpointTemperatureC: 21 });
    const field = createThermalFieldModel(model, {
        outdoorTemperatureC: -2,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(Object.entries(preview.rooms).map(([roomId, payload]) => [roomId, payload.temperatureC])),
    });
    const canonical = buildCanonical3DModel(model, "level-1", { thermalField: field });
    if (canonical.temperatureSurfaces.length < 2) {
        throw new Error("Both left and right spaces should expose floor temperature overlays.");
    }
    const leftSurface = canonical.temperatureSurfaces.find((surface) => surface.roomId !== "room-right");
    if (!leftSurface || Math.abs(polygonArea(leftSurface.boundary)) < 60) {
        throw new Error("Left temperature overlay should cover the wall-defined room footprint.");
    }
});
