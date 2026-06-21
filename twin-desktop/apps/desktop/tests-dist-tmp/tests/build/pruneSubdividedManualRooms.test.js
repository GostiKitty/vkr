import { detectRoomsFromWalls } from "../../src/core/geometry/roomContours.js";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { pruneSubdividedManualRooms } from "../../src/features/build/auto/pruneSubdividedManualRooms.js";
import { splitWallsAtJunctions } from "../../src/features/build/auto/splitWallsAtJunctions.js";
import { test } from "../testHarness.js";
function rectRoom(id, levelId, x0, y0, x1, y1) {
    return {
        id,
        name: "Parent",
        levelId,
        polygon: [
            { x: x0, y: y0 },
            { x: x1, y: y0 },
            { x: x1, y: y1 },
            { x: x0, y: y1 },
        ],
        source: "manual",
    };
}
function segmentWall(id, levelId, a, b) {
    return {
        id,
        levelId,
        a,
        b,
        thickness_m: 0.2,
        height_m: 3,
    };
}
test("pruneSubdividedManualRooms removes parent when a partition creates two child loops", () => {
    const levelId = "lvl-1";
    const parent = rectRoom("room-parent", levelId, 0, 0, 10, 10);
    const walls = [
        segmentWall("w-s", levelId, { x: 0, y: 0 }, { x: 10, y: 0 }),
        segmentWall("w-e", levelId, { x: 10, y: 0 }, { x: 10, y: 10 }),
        segmentWall("w-n", levelId, { x: 10, y: 10 }, { x: 0, y: 10 }),
        segmentWall("w-w", levelId, { x: 0, y: 10 }, { x: 0, y: 0 }),
        segmentWall("w-mid", levelId, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ];
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: levelId, name: "Level 1", elevation_m: 0, height_m: 3 }],
        rooms: [parent],
        walls: splitWallsAtJunctions(walls),
    };
    const { loops, rooms: autoRooms } = detectRoomsFromWalls(model);
    const { kept, removedIds } = pruneSubdividedManualRooms([parent], loops, autoRooms);
    if (!removedIds.has(parent.id)) {
        throw new Error("Expected subdivided parent room to be removed.");
    }
    if (kept.length !== 0) {
        throw new Error(`Expected no manual rooms to remain, got ${kept.length}.`);
    }
    if (autoRooms.length < 2) {
        throw new Error(`Expected at least two auto rooms from partition, got ${autoRooms.length}.`);
    }
});
test("pruneSubdividedManualRooms removes parent after vertical partition (shared boundary vertices)", () => {
    const levelId = "lvl-1";
    const parent = rectRoom("room-parent", levelId, 0, 0, 12, 8);
    const walls = [
        segmentWall("w-s", levelId, { x: 0, y: 0 }, { x: 12, y: 0 }),
        segmentWall("w-e", levelId, { x: 12, y: 0 }, { x: 12, y: 8 }),
        segmentWall("w-n", levelId, { x: 12, y: 8 }, { x: 0, y: 8 }),
        segmentWall("w-w", levelId, { x: 0, y: 8 }, { x: 0, y: 0 }),
        segmentWall("w-mid", levelId, { x: 4, y: 0 }, { x: 4, y: 8 }),
    ];
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: levelId, name: "Level 1", elevation_m: 0, height_m: 3 }],
        rooms: [parent],
        walls: splitWallsAtJunctions(walls),
    };
    const { loops, rooms: autoRooms } = detectRoomsFromWalls(model);
    const { removedIds } = pruneSubdividedManualRooms([parent], loops, autoRooms);
    if (!removedIds.has(parent.id)) {
        throw new Error("Expected parent room to be removed after vertical partition.");
    }
});
test("pruneSubdividedManualRooms removes parent when manual child rooms already exist inside", () => {
    const levelId = "lvl-1";
    const parent = rectRoom("room-parent", levelId, 0, 0, 12, 8);
    const left = {
        ...rectRoom("room-left", levelId, 0, 0, 4, 8),
        name: "Left",
        source: "manual",
    };
    const right = {
        ...rectRoom("room-right", levelId, 4, 0, 12, 8),
        name: "Right",
        source: "manual",
    };
    const { removedIds } = pruneSubdividedManualRooms([parent, left, right], [], []);
    if (!removedIds.has(parent.id)) {
        throw new Error("Expected parent to be removed when two manual child rooms lie inside it.");
    }
    if (removedIds.has(left.id) || removedIds.has(right.id)) {
        throw new Error("Child manual rooms should be kept.");
    }
});
test("pruneSubdividedManualRooms keeps standalone manual room without interior partitions", () => {
    const levelId = "lvl-1";
    const parent = rectRoom("room-parent", levelId, 0, 0, 8, 6);
    const walls = [
        segmentWall("w-s", levelId, { x: 0, y: 0 }, { x: 8, y: 0 }),
        segmentWall("w-e", levelId, { x: 8, y: 0 }, { x: 8, y: 6 }),
        segmentWall("w-n", levelId, { x: 8, y: 6 }, { x: 0, y: 6 }),
        segmentWall("w-w", levelId, { x: 0, y: 6 }, { x: 0, y: 0 }),
    ];
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: levelId, name: "Level 1", elevation_m: 0, height_m: 3 }],
        rooms: [parent],
        walls,
    };
    const { loops } = detectRoomsFromWalls(model);
    const { kept, removedIds } = pruneSubdividedManualRooms([parent], loops, []);
    if (removedIds.size > 0) {
        throw new Error("Expected undivided manual room to be kept.");
    }
    if (kept.length !== 1 || kept[0]?.id !== parent.id) {
        throw new Error("Expected the original manual room to remain.");
    }
});
