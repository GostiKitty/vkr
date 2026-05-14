import * as THREE from "three";
import {
  createEquipmentVisual,
  createSensorVisual,
  getEquipmentBaseY,
  getEquipmentWorldConnectionPoint,
  getSensorWorldPosition,
} from "../../src/features/build/view3d/equipmentMeshes.js";
import type { Equipment, SensorDevice } from "../../src/entities/networks/types.js";
import { test } from "../testHarness.js";

const baseEquipment = (type: Equipment["type"]): Equipment => ({
  id: `eq-${type}`,
  type,
  position: { x: 1, y: 2 },
  levelId: "lvl-1",
  roomId: null,
  state: "on",
  params: {},
  connectedNetworkIds: [],
});

const baseSensor: SensorDevice = {
  id: "sensor-1",
  type: "temperature",
  position: { x: 2, y: 3 },
  levelId: "lvl-1",
  roomId: null,
  value: 21.5,
  unit: "°C",
  status: "normal",
  history: [],
};

test("createEquipmentVisual returns Group for all supported types", () => {
  const types: Equipment["type"][] = ["radiator", "boiler", "pump", "ahu", "diffuser", "fancoil", "sensor"];
  types.forEach((type) => {
    const visual = createEquipmentVisual(baseEquipment(type), { selected: false, levelHeight: 3 });
    if (!(visual instanceof THREE.Group) || visual.children.length === 0) {
      throw new Error(`Equipment visual for ${type} should be a non-empty THREE.Group.`);
    }
  });
});

test("unknown equipment type falls back to generic 3D visual", () => {
  const fallback = createEquipmentVisual(({
    ...baseEquipment("radiator"),
    type: "unknown_equipment",
  } as unknown) as Equipment, { selected: false, levelHeight: 3 });
  if (!(fallback instanceof THREE.Group) || fallback.children.length === 0) {
    throw new Error("Fallback equipment visual should build a valid THREE.Group.");
  }
});

test("simplified equipment mode keeps supported equipment lightweight", () => {
  const types: Equipment["type"][] = ["radiator", "boiler", "pump"];
  types.forEach((type) => {
    const visual = createEquipmentVisual(baseEquipment(type), { selected: false, levelHeight: 3, simplified: true });
    if (!(visual instanceof THREE.Group) || visual.children.length === 0) {
      throw new Error(`Simplified equipment visual for ${type} should still be a non-empty THREE.Group.`);
    }
  });
});

test("sensor factory builds compact sensor visual", () => {
  const visual = createSensorVisual(baseSensor, { selected: false, levelHeight: 3 });
  if (!(visual instanceof THREE.Group) || visual.children.length === 0) {
    throw new Error("Sensor visual should be a non-empty THREE.Group.");
  }
});

test("getEquipmentBaseY places major equipment at sensible heights", () => {
  const levelHeight = 3;
  const radiatorY = getEquipmentBaseY("radiator", levelHeight);
  const boilerY = getEquipmentBaseY("boiler", levelHeight);
  const pumpY = getEquipmentBaseY("pump", levelHeight);
  const ahuY = getEquipmentBaseY("ahu", levelHeight);
  const diffuserY = getEquipmentBaseY("diffuser", levelHeight);
  if (!(radiatorY > 0.1 && radiatorY < 0.3)) {
    throw new Error("Radiator base height should keep it slightly above the floor.");
  }
  if (!(boilerY > 0.45 && boilerY < 0.7)) {
    throw new Error("Boiler base height should keep it on the floor without floating.");
  }
  if (!(pumpY > 0.15 && pumpY < 0.35)) {
    throw new Error("Pump base height should be compact and near pipe level.");
  }
  if (!(ahuY > 0.25 && ahuY < 0.6)) {
    throw new Error("AHU base height should remain near the service floor zone.");
  }
  if (!(diffuserY > 2.2 && diffuserY <= levelHeight)) {
    throw new Error("Diffuser base height should stay near the ceiling.");
  }
});

test("getEquipmentWorldConnectionPoint returns different meaningful anchors", () => {
  const radiator = getEquipmentWorldConnectionPoint(baseEquipment("radiator"), "pipe", 0, 3, { x: 3, y: 2 });
  const boiler = getEquipmentWorldConnectionPoint(baseEquipment("boiler"), "pipe", 0, 3, { x: 0, y: 1 });
  const pump = getEquipmentWorldConnectionPoint(baseEquipment("pump"), "pipe", 0, 3, { x: 3, y: 2 });
  const ahu = getEquipmentWorldConnectionPoint(baseEquipment("ahu"), "duct", 0, 3, { x: 3, y: 2 });
  const diffuser = getEquipmentWorldConnectionPoint(baseEquipment("diffuser"), "duct", 0, 3, { x: 3, y: 2 });
  const fallback = getEquipmentWorldConnectionPoint(({
    ...baseEquipment("radiator"),
    type: "unknown_equipment",
  } as unknown) as Equipment, "pipe", 0, 3, { x: 0, y: 1 });

  [radiator, boiler, pump, ahu, diffuser, fallback].forEach((vector) => {
    if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y) || !Number.isFinite(vector.z)) {
      throw new Error("3D connection point helper must return finite coordinates.");
    }
  });

  if (!(radiator.y < diffuser.y && pump.y < ahu.y)) {
    throw new Error("Pipe equipment anchors should stay lower than ceiling air equipment anchors.");
  }
  if (radiator.x === pump.x && radiator.z === pump.z) {
    throw new Error("Radiator and pump should not share the same connection anchor.");
  }
  if (fallback.x === 1 && fallback.z === 2) {
    throw new Error("Fallback equipment anchor should use a side offset instead of the body center.");
  }
});

test("equipment and sensor anchors return finite 3D coordinates", () => {
  const equipmentAnchor = getEquipmentWorldConnectionPoint(baseEquipment("pump"), "pipe", 0, 3, { x: 4, y: 2 });
  const diffuserAnchor = getEquipmentWorldConnectionPoint(baseEquipment("diffuser"), "duct", 0, 3, { x: 4, y: 2 });
  const sensorPoint = getSensorWorldPosition(baseSensor, 0, 3);
  [equipmentAnchor, diffuserAnchor, sensorPoint].forEach((vector) => {
    if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y) || !Number.isFinite(vector.z)) {
      throw new Error("3D anchor helpers must return finite coordinates.");
    }
  });
});
