import assert from "node:assert/strict";
import test from "node:test";
import { getRoomDisplayName, normalizeModelRoomNames, normalizeStoredRoomName } from "../../src/shared/utils/roomNames.js";

test("normalizeStoredRoomName converts technical Space labels to Помещение", () => {
  const room = { id: "room-2", name: "Space 2", levelId: "lvl-1", polygon: [] };
  assert.equal(normalizeStoredRoomName(room, 1), "Помещение 2");
  assert.equal(getRoomDisplayName(room, 1), "Помещение 2");
});

test("normalizeStoredRoomName keeps meaningful custom names", () => {
  const room = { id: "room-kitchen", name: "Кухня", levelId: "lvl-1", polygon: [] };
  assert.equal(normalizeStoredRoomName(room, 0), null);
});

test("normalizeModelRoomNames rewrites only technical room names", () => {
  const model = normalizeModelRoomNames({
    levels: [{ id: "lvl-1", name: "Уровень 1", elevation_m: 0, height_m: 3 }],
    rooms: [
      { id: "r1", name: "Space 1", levelId: "lvl-1", polygon: [] },
      { id: "r2", name: "Кухня", levelId: "lvl-1", polygon: [] },
    ],
    walls: [],
    windows: [],
    doors: [],
    roofs: [],
    floorSlabs: [],
    pipes: [],
    ducts: [],
    equipment: [],
    sensors: [],
    scenarios: [],
    events: [],
  });
  assert.equal(model.rooms[0]?.name, "Помещение 1");
  assert.equal(model.rooms[1]?.name, "Кухня");
});
