import { test } from "../testHarness.js";
import {
  getEquipmentConnectionPoints,
  getNetworkEndpointConnectionIds,
} from "../../src/features/build/engineering/connectionPoints.js";
import {
  engineeringModeUsesHeatmap,
  engineeringModeUsesOverlay,
} from "../../src/features/build/engineering/viewMode.js";

test("engineering schematic: radiator exposes supply and return connection points", () => {
  const points = getEquipmentConnectionPoints({
    id: "eq-rad",
    type: "radiator",
    position: { x: 4, y: 2 },
  });
  if (points.length !== 2) {
    throw new Error(`Expected 2 radiator ports, got ${points.length}.`);
  }
  const roles = points.map((point) => point.role).sort().join(",");
  if (roles !== "returnOut,supplyIn") {
    throw new Error(`Unexpected radiator roles: ${roles}.`);
  }
});

test("engineering schematic: endpoint snap resolves connected equipment ids", () => {
  const connected = getNetworkEndpointConnectionIds(
    {
      id: "pipe-1",
      path: [
        { x: -0.34, y: -0.08 },
        { x: 2, y: -0.08 },
      ],
    },
    [
      {
        id: "eq-rad",
        type: "radiator",
        position: { x: 0, y: 0 },
        levelId: "l1",
        roomId: null,
        state: "on",
        params: {},
        connectedNetworkIds: [],
      },
    ],
    "pipe"
  );

  if (connected.length !== 1 || connected[0] !== "eq-rad") {
    throw new Error(`Expected pipe endpoint to bind radiator, got ${connected.join(", ")}.`);
  }
});

test("engineering schematic: combined mode enables both overlay and heatmap", () => {
  if (!engineeringModeUsesOverlay("combined")) {
    throw new Error("Combined mode should keep the engineering overlay visible.");
  }
  if (!engineeringModeUsesHeatmap("combined")) {
    throw new Error("Combined mode should keep the heatmap visible.");
  }
});
