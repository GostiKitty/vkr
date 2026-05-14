import { readFileSync } from "node:fs";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { createThermalFieldModel } from "../../src/core/thermal/field.js";
import { sampleBuildingSP50 } from "../../src/demo/sampleBuildingSP50.js";
import { buildRecovered3DModel, buildRecoveredTemperatureSurfaces, filterDisplayedRecoveredTemperatureSurfaces, filterAnchoredTemperatureSurfaces, getRecoveredRoomFloorPolygon, getRoomPolygonFor3D, getRoomTemperatureMap, summarizeRecoveredTemperatureSurfaces, summarizeRecoveredRoomTemperatures, } from "../../src/features/build/view3d/buildRecovered3DModel.js";
import { DISABLE_ALL_3D_TEMPERATURE, resolveRecoveredTemperatureRuntime, USE_ROOM_FLOOR_TEMPERATURE_COLORING, } from "../../src/features/build/view3d/Build3DRecoveredPreview.js";
import { test } from "../testHarness.js";
function getPolygonCenter(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
        x: (Math.min(...xs) + Math.max(...xs)) * 0.5,
        y: (Math.min(...ys) + Math.max(...ys)) * 0.5,
    };
}
function createRect(x, y, width, height) {
    return [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
    ];
}
test("buildRecovered3DModel returns shell and openings for demo", () => {
    const recovered = buildRecovered3DModel(sampleBuildingSP50, "level-1");
    if (!recovered.rooms.length || !recovered.walls.length) {
        throw new Error("Recovered 3D model should keep rooms and walls.");
    }
    if (!recovered.windows.length || !recovered.doors.length) {
        throw new Error("Recovered 3D model should keep demo windows and doors.");
    }
});
test("buildRecovered3DModel tolerates project without roofs, slabs and networks", () => {
    const legacy = {
        ...sampleBuildingSP50,
        roofs: [],
        floorSlabs: [],
        pipes: [],
        ducts: [],
        equipment: [],
        sensors: [],
    };
    const recovered = buildRecovered3DModel(legacy, "level-1");
    if (!recovered.rooms.length || !recovered.walls.length) {
        throw new Error("Recovered 3D model should still keep shell geometry for legacy projects.");
    }
});
test("recovered openings stay anchored to host wall without NaN", () => {
    const recovered = buildRecovered3DModel(sampleBuildingSP50, "level-1");
    const openings = [...recovered.windows, ...recovered.doors];
    if (!openings.length) {
        throw new Error("Recovered model should expose openings.");
    }
    if (openings.some((opening) => [opening.center.x, opening.center.y, opening.center.z, opening.rotationY_rad].some((value) => !Number.isFinite(value)))) {
        throw new Error("Recovered openings should have finite coordinates.");
    }
});
test("room temperature surfaces reuse the same boundary as recovered room geometry", () => {
    const field = createThermalFieldModel(sampleBuildingSP50, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
    });
    const recovered = buildRecovered3DModel(sampleBuildingSP50, "level-1", {
        thermalField: field,
        showTemperature: true,
    });
    const result = buildRecoveredTemperatureSurfaces(sampleBuildingSP50, field, "level-1", {
        showTemperature: true,
        showWallTemperature: false,
    });
    const roomSurface = result.surfaces.find((surface) => surface.sourceType === "room");
    if (!roomSurface?.boundary) {
        throw new Error("Recovered temperature surfaces should include room boundaries.");
    }
    const roomId = roomSurface.id.replace("room:", "");
    const room = sampleBuildingSP50.rooms.find((entry) => entry.id === roomId);
    if (!room) {
        throw new Error("Recovered room surface should point to an existing room.");
    }
    const recoveredRoom = recovered.rooms.find((entry) => entry.id === roomId);
    if (!recoveredRoom) {
        throw new Error("Recovered room should exist for room temperature surface.");
    }
    if (roomSurface.boundary.length !== recoveredRoom.boundary.length) {
        throw new Error("Recovered room temperature surface should match recovered room polygon length.");
    }
    if (roomSurface.boundary.some((point, index) => {
        const sourcePoint = recoveredRoom.boundary[index];
        return Math.abs(point.x - sourcePoint.x) > 1e-6 || Math.abs(point.y - sourcePoint.y) > 1e-6;
    })) {
        throw new Error("Recovered room temperature surface should use the same polygon as recovered room geometry.");
    }
    const roomCenter = getPolygonCenter(recoveredRoom.boundary);
    const surfaceCenter = getPolygonCenter(roomSurface.boundary);
    if (Math.abs(roomCenter.x - surfaceCenter.x) > 1e-6 || Math.abs(roomCenter.y - surfaceCenter.y) > 1e-6) {
        throw new Error("Recovered room temperature surface center should match recovered room center in X/Z.");
    }
});
test("getRoomPolygonFor3D keeps geometry polygon even when thermal room polygon exists", () => {
    const field = createThermalFieldModel(sampleBuildingSP50, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
    });
    const room = sampleBuildingSP50.rooms[0];
    const polygon = getRoomPolygonFor3D(room, field);
    if (polygon.length !== room.polygon.length) {
        throw new Error("Recovered room polygon should stay on geometry room polygon.");
    }
    if (polygon.some((point, index) => {
        const sourcePoint = room.polygon[index];
        return Math.abs(point.x - sourcePoint.x) > 1e-6 || Math.abs(point.y - sourcePoint.y) > 1e-6;
    })) {
        throw new Error("Recovered room polygon should not be replaced by thermal room polygon.");
    }
});
test("getRoomTemperatureMap keeps room-based temperatures and ignores foreign levels", () => {
    const field = createThermalFieldModel(sampleBuildingSP50, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
    });
    field.rooms = [
        ...field.rooms,
        {
            ...field.rooms[0],
            roomId: "ghost-room",
            levelId: "other-level",
            baseTemperatureC: 99,
        },
    ];
    const result = getRoomTemperatureMap(field, "level-1");
    if (!result.roomTemperatures.has(sampleBuildingSP50.rooms[0].id)) {
        throw new Error("Recovered room temperature map should keep valid room temperatures for the active level.");
    }
    if (result.roomTemperatures.has("ghost-room")) {
        throw new Error("Recovered room temperature map should ignore room temperatures from another level.");
    }
});
test("room floor geometry stays identical when recovered room temperature coloring is enabled", () => {
    const field = createThermalFieldModel(sampleBuildingSP50, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
    });
    const withoutTemperature = buildRecovered3DModel(sampleBuildingSP50, "level-1", {
        thermalField: field,
        showTemperature: false,
    });
    const withTemperature = buildRecovered3DModel(sampleBuildingSP50, "level-1", {
        thermalField: field,
        showTemperature: true,
    });
    if (withTemperature.temperatureSurfaces.length !== 0) {
        throw new Error("Recovered room temperature coloring should not create separate temperature surfaces.");
    }
    if (withoutTemperature.rooms.length !== withTemperature.rooms.length) {
        throw new Error("Recovered room temperature coloring should not change room count.");
    }
    if (withTemperature.rooms.some((room, index) => room.boundary.some((point, pointIndex) => {
        const basePoint = withoutTemperature.rooms[index]?.boundary[pointIndex];
        return !basePoint || Math.abs(point.x - basePoint.x) > 1e-6 || Math.abs(point.y - basePoint.y) > 1e-6;
    }))) {
        throw new Error("Recovered room temperature coloring should not move room floor geometry.");
    }
});
test("shifted room polygon does not become recovered room floor geometry", () => {
    const shiftedModel = {
        ...sampleBuildingSP50,
        rooms: sampleBuildingSP50.rooms.map((room, index) => index === 0
            ? {
                ...room,
                polygon: room.polygon.map((point) => ({ x: point.x + 8, y: point.y + 6 })),
            }
            : room),
    };
    const targetRoom = shiftedModel.rooms[0];
    const geometry = getRecoveredRoomFloorPolygon(targetRoom, shiftedModel, null, null, "level-1");
    if (!geometry) {
        throw new Error("Recovered room floor helper should derive a safe polygon from wall geometry.");
    }
    if (geometry.source === "room") {
        throw new Error("Recovered room floor helper should not reuse shifted raw room polygon when it does not align with walls.");
    }
    const shiftedCenter = getPolygonCenter(targetRoom.polygon);
    const recoveredCenter = getPolygonCenter(geometry.boundary);
    if (Math.abs(shiftedCenter.x - recoveredCenter.x) < 1 || Math.abs(shiftedCenter.y - recoveredCenter.y) < 1) {
        throw new Error("Recovered room floor helper should keep room floor away from shifted raw room polygon.");
    }
});
test("shifted thermal polygon does not move recovered room floor geometry", () => {
    const field = createThermalFieldModel(sampleBuildingSP50, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
    });
    const targetRoom = sampleBuildingSP50.rooms[0];
    const thermalRoom = field.roomMap.get(targetRoom.id);
    if (!thermalRoom) {
        throw new Error("Thermal room should exist.");
    }
    thermalRoom.polygon = thermalRoom.polygon.map((point) => ({ x: point.x + 5, y: point.y - 4 }));
    field.rooms = field.rooms.map((room) => room.roomId === targetRoom.id ? { ...room, polygon: room.polygon.map((point) => ({ x: point.x + 5, y: point.y - 4 })) } : room);
    const baselineField = createThermalFieldModel(sampleBuildingSP50, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
    });
    const baseline = buildRecovered3DModel(sampleBuildingSP50, "level-1", {
        thermalField: baselineField,
        showTemperature: true,
    });
    const recovered = buildRecovered3DModel(sampleBuildingSP50, "level-1", {
        thermalField: field,
        showTemperature: true,
    });
    const baselineRoom = baseline.rooms.find((room) => room.id === targetRoom.id);
    const recoveredRoom = recovered.rooms.find((room) => room.id === targetRoom.id);
    if (!recoveredRoom || !baselineRoom) {
        throw new Error("Recovered room should exist.");
    }
    if (recovered.temperatureSurfaces.length !== 0) {
        throw new Error("Recovered 3D runtime should not expose separate temperature surfaces.");
    }
    if (recoveredRoom.boundary.some((point, index) => {
        const sourcePoint = baselineRoom.boundary[index];
        return Math.abs(point.x - sourcePoint.x) > 1e-6 || Math.abs(point.y - sourcePoint.y) > 1e-6;
    })) {
        throw new Error("Recovered room floor geometry should stay on canonical shell geometry even if thermal polygon is shifted.");
    }
});
test("recovered room geometry prefers canonical shell geometry when raw room polygon diverges", () => {
    const field = createThermalFieldModel(sampleBuildingSP50, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
    });
    const shiftedModel = {
        ...sampleBuildingSP50,
        rooms: sampleBuildingSP50.rooms.map((room, index) => index === 0
            ? {
                ...room,
                polygon: room.polygon.map((point) => ({ x: point.x + 0.8, y: point.y + 0.8 })),
            }
            : room),
    };
    const recovered = buildRecovered3DModel(shiftedModel, "level-1", {
        thermalField: field,
        showTemperature: true,
    });
    const targetRoom = shiftedModel.rooms[0];
    const recoveredRoom = recovered.rooms.find((room) => room.id === targetRoom.id);
    if (!recoveredRoom) {
        throw new Error("Recovered room should exist after geometry shift.");
    }
    if (recovered.temperatureSurfaces.length !== 0) {
        throw new Error("Recovered 3D runtime should not keep separate temperature surfaces after geometry shift.");
    }
    if (!recoveredRoom.boundary.some((point, index) => {
        const sourcePoint = targetRoom.polygon[index];
        return Math.abs(point.x - sourcePoint.x) > 1e-6 || Math.abs(point.y - sourcePoint.y) > 1e-6;
    })) {
        throw new Error("Recovered room boundary should switch away from shifted raw room polygon.");
    }
    if (recoveredRoom.geometrySource === "room") {
        throw new Error("Recovered room should prefer canonical renderGeometry or wall-derived polygon over raw room polygon.");
    }
});
test("missing recovered temperature data returns empty surfaces with warning", () => {
    const result = buildRecoveredTemperatureSurfaces(sampleBuildingSP50, null, "level-1", {
        showTemperature: true,
        showWallTemperature: false,
    });
    if (result.surfaces.length !== 0) {
        throw new Error("Recovered temperature surfaces should stay empty without data.");
    }
    if (!result.summary?.warnings.length) {
        throw new Error("Recovered temperature surfaces should report a warning when data is missing.");
    }
});
test("room-floor temperature summary uses only colored rooms", () => {
    const summary = summarizeRecoveredRoomTemperatures([
        { boundary: sampleBuildingSP50.rooms[0].polygon, temperature_C: 19 },
        { boundary: sampleBuildingSP50.rooms[0].polygon, temperature_C: 23 },
        { boundary: [], temperature_C: 99 },
        { boundary: sampleBuildingSP50.rooms[0].polygon, temperature_C: null },
    ], ["diagnostic warning"]);
    if (summary.min_C > 19.1 || summary.max_C < 22.9) {
        throw new Error("Recovered room-floor summary should use only colored room floors.");
    }
    if (summary.average_C < 20.9 || summary.average_C > 21.1) {
        throw new Error("Recovered room-floor summary should average only colored room floors.");
    }
});
test("room-floor temperature summary reports missing room data", () => {
    const summary = summarizeRecoveredRoomTemperatures([{ boundary: sampleBuildingSP50.rooms[0].polygon, temperature_C: null }], []);
    if (!summary.warnings.some((warning) => warning.includes("нет привязанных данных для 3D"))) {
        throw new Error("Recovered room-floor summary should report missing room temperature data.");
    }
});
test("room floor temperature runtime keeps room coloring without separate temperature surfaces", () => {
    const field = createThermalFieldModel(sampleBuildingSP50, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
    });
    const runtime = resolveRecoveredTemperatureRuntime(true, true);
    const recovered = buildRecovered3DModel(sampleBuildingSP50, "level-1", {
        thermalField: field,
        showTemperature: runtime.showTemperature,
        showWallTemperature: runtime.showWallTemperature,
    });
    if (runtime.showWallTemperature) {
        throw new Error("Recovered 3D room-floor temperature runtime should never enable wall temperature surfaces.");
    }
    if (!USE_ROOM_FLOOR_TEMPERATURE_COLORING) {
        throw new Error("Recovered 3D should keep room-floor temperature coloring enabled.");
    }
    if (DISABLE_ALL_3D_TEMPERATURE && runtime.showTemperature) {
        throw new Error("Recovered 3D emergency disable flag should suppress room-floor temperature coloring.");
    }
    if (recovered.temperatureSurfaces.length !== 0) {
        throw new Error("Recovered 3D should not build separate temperature surfaces for room coloring runtime.");
    }
    if (!DISABLE_ALL_3D_TEMPERATURE && !recovered.rooms.some((room) => Number.isFinite(room.temperature_C))) {
        throw new Error("Recovered 3D should keep room temperatures on recovered room floors when temperature view is enabled.");
    }
});
test("empty recovered model stays empty", () => {
    const recovered = buildRecovered3DModel(createEmptyBuildingModel(), null);
    if (!recovered.bounds.empty) {
        throw new Error("Recovered empty model should keep empty bounds.");
    }
});
test("unanchored floorField surface is rejected", () => {
    const filtered = filterAnchoredTemperatureSurfaces([
        {
            id: "floor-field:1",
            sourceType: "floorField",
            sourceId: null,
            levelId: "level-1",
            boundary: createRect(100, 100, 6, 4),
            temperature_C: 19,
        },
    ], sampleBuildingSP50, "level-1");
    if (filtered.surfaces.length !== 0 || filtered.rejectedCount !== 1) {
        throw new Error("Unanchored floorField surface should be rejected.");
    }
    if (!filtered.warnings.some((warning) => warning.includes("нет привязки к геометрии"))) {
        throw new Error("Rejected unanchored floorField surface should return an anchor warning.");
    }
});
test("grid, bbox and fallback surfaces are rejected", () => {
    const filtered = filterAnchoredTemperatureSurfaces([
        { id: "grid:1", sourceType: "grid", sourceId: "grid-1", levelId: "level-1", boundary: createRect(30, 30, 4, 3), temperature_C: 16 },
        { id: "bbox:1", sourceType: "bbox", sourceId: "bbox-1", levelId: "level-1", boundary: createRect(40, 40, 5, 4), temperature_C: 17 },
        { id: "fallback:1", sourceType: "fallback", sourceId: "fallback-1", levelId: "level-1", boundary: createRect(50, 50, 5, 4), temperature_C: 18 },
    ], sampleBuildingSP50, "level-1");
    if (filtered.surfaces.length !== 0 || filtered.rejectedCount !== 3) {
        throw new Error("Grid, bbox and fallback surfaces should all be rejected.");
    }
});
test("surface with polygon but without sourceId is rejected", () => {
    const filtered = filterAnchoredTemperatureSurfaces([
        {
            id: "orphan:1",
            sourceType: "room",
            sourceId: null,
            levelId: "level-1",
            boundary: createRect(0, 0, 2, 2),
            temperature_C: 20,
        },
    ], sampleBuildingSP50, "level-1");
    if (filtered.surfaces.length !== 0 || filtered.rejectedCount !== 1) {
        throw new Error("Surface without sourceId should be rejected.");
    }
});
test("slab and roof surfaces without ids are rejected", () => {
    const filtered = filterAnchoredTemperatureSurfaces([
        {
            id: "slab:missing",
            sourceType: "slab",
            sourceId: null,
            levelId: "level-1",
            boundary: createRect(0, 0, 3, 3),
            temperature_C: 8,
        },
        {
            id: "roof:missing",
            sourceType: "roof",
            sourceId: null,
            levelId: "level-1",
            boundary: createRect(0, 0, 3, 3),
            temperature_C: 7,
        },
    ], sampleBuildingSP50, "level-1");
    if (filtered.surfaces.length !== 0 || filtered.rejectedCount !== 2) {
        throw new Error("Slab and roof surfaces without ids should be rejected.");
    }
});
test("summary min and max use only accepted surfaces", () => {
    const filtered = filterAnchoredTemperatureSurfaces([
        {
            id: `room:${sampleBuildingSP50.rooms[0].id}`,
            sourceType: "room",
            sourceId: sampleBuildingSP50.rooms[0].id,
            levelId: "level-1",
            temperature_C: 21,
        },
        {
            id: "grid:hot",
            sourceType: "grid",
            sourceId: "grid-hot",
            levelId: "level-1",
            boundary: createRect(90, 90, 12, 6),
            temperature_C: 200,
        },
    ], sampleBuildingSP50, "level-1");
    const summary = summarizeRecoveredTemperatureSurfaces(filtered.surfaces, filtered.warnings, filtered.rejectedCount);
    if (!summary) {
        throw new Error("Recovered temperature summary should exist.");
    }
    if (summary.max_C > 30 || summary.min_C < 19) {
        throw new Error("Rejected surfaces should not affect min/max legend values.");
    }
    if (summary.rejectedCount !== 1) {
        throw new Error("Recovered temperature summary should keep rejected surface count.");
    }
});
test("wall surface does not reach displayedTemperatureSurfaces in recovered 3D", () => {
    const field = createThermalFieldModel(sampleBuildingSP50, {
        outdoorTemperatureC: -12,
        setpointTemperatureC: 21,
        roomTemperaturesC: Object.fromEntries(sampleBuildingSP50.rooms.map((room) => [room.id, 20])),
    });
    const result = buildRecoveredTemperatureSurfaces(sampleBuildingSP50, field, "level-1", {
        showTemperature: true,
        showWallTemperature: true,
    });
    if (result.surfaces.some((surface) => surface.sourceType !== "room")) {
        throw new Error("Recovered 3D should keep only room temperature surfaces for display.");
    }
    if (!result.summary?.warnings.some((warning) => warning.includes("только заливка помещений"))) {
        throw new Error("Recovered 3D should warn when non-room surfaces are dropped from 3D display.");
    }
});
test("room surface with mismatching bbox is rejected from displayed recovered temperature surfaces", () => {
    const room = sampleBuildingSP50.rooms[0];
    const result = filterDisplayedRecoveredTemperatureSurfaces([
        {
            id: `room:${room.id}`,
            sourceType: "room",
            sourceId: room.id,
            levelId: room.levelId,
            boundary: createRect(room.polygon[0].x + 2, room.polygon[0].y + 1, 3, 2),
            temperature_C: 20,
        },
    ], [
        {
            id: room.id,
            levelId: room.levelId,
            boundary: room.polygon,
        },
    ]);
    if (result.surfaces.length !== 0 || result.rejectedCount !== 1) {
        throw new Error("Mismatching room temperature surface should be rejected.");
    }
    if (!result.warnings.some((warning) => warning.includes("не совпадает с геометрией помещения"))) {
        throw new Error("Recovered 3D should report a geometry mismatch for invalid room surfaces.");
    }
});
test("room surface with matching polygon is displayed", () => {
    const room = sampleBuildingSP50.rooms[0];
    const result = filterDisplayedRecoveredTemperatureSurfaces([
        {
            id: `room:${room.id}`,
            sourceType: "room",
            sourceId: room.id,
            levelId: room.levelId,
            boundary: room.polygon,
            temperature_C: 20,
        },
    ], [
        {
            id: room.id,
            levelId: room.levelId,
            boundary: room.polygon,
        },
    ]);
    if (result.surfaces.length !== 1 || result.rejectedCount !== 0) {
        throw new Error("Matching room temperature surface should stay visible in recovered 3D.");
    }
});
test("all rejected surfaces produce no anchored data summary", () => {
    const filtered = filterAnchoredTemperatureSurfaces([
        {
            id: "bbox:ghost",
            sourceType: "bbox",
            sourceId: "bbox-ghost",
            levelId: "level-1",
            boundary: createRect(70, 70, 5, 5),
            temperature_C: -2,
        },
    ], sampleBuildingSP50, "level-1");
    const summary = summarizeRecoveredTemperatureSurfaces(filtered.surfaces, filtered.warnings, filtered.rejectedCount);
    if (!summary?.warnings.some((warning) => warning.includes("нет привязанных данных"))) {
        throw new Error("Summary should report missing anchored data when all surfaces are rejected.");
    }
});
test("unrelated rectangle outside shell does not create detached temperature surface", () => {
    const filtered = filterAnchoredTemperatureSurfaces([
        {
            id: "fallback:outside",
            sourceType: "fallback",
            sourceId: "outside-rect",
            levelId: "level-1",
            boundary: createRect(120, 120, 10, 6),
            temperature_C: -1.5,
        },
    ], sampleBuildingSP50, "level-1");
    if (filtered.surfaces.length !== 0) {
        throw new Error("Detached rectangle outside building shell should not become a recovered temperature surface.");
    }
});
test("Build3DRecoveredPreview does not render wall temperature boxes", () => {
    const source = readFileSync("c:\\Users\\Liza\\vkr\\twin-desktop\\apps\\desktop\\src\\features\\build\\view3d\\Build3DRecoveredPreview.tsx", "utf-8");
    if (source.includes('if (surface.sourceType === "wall" && surface.wall)')) {
        throw new Error("Recovered preview should not render dedicated wall temperature boxes.");
    }
});
