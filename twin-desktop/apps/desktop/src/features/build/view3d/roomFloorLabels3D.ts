import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Room, Vec2 } from "../../../entities/geometry/types";
import { compactRoomLabel } from "../utils/entityLabels";

export interface RoomFloorLabelSource {
  id: string;
  boundary: Vec2[];
  elevation_m: number;
}

function computePlanCentroid(boundary: Vec2[]): { x: number; y: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  boundary.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  return {
    x: (minX + maxX) * 0.5,
    y: (minY + maxY) * 0.5,
  };
}

export function createRoomFloorLabelRenderer(host: HTMLElement): CSS2DRenderer {
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1));
  labelRenderer.domElement.className = "build-3d-room-label-layer";
  labelRenderer.domElement.style.pointerEvents = "none";
  host.appendChild(labelRenderer.domElement);
  return labelRenderer;
}

export function buildRoomFloorLabelGroup(
  rooms: RoomFloorLabelSource[],
  modelRooms: Room[],
  roomLabelById: Map<string, string>
): THREE.Group {
  const group = new THREE.Group();
  group.name = "group:room-labels";
  const roomById = new Map(modelRooms.map((room) => [room.id, room]));

  rooms.forEach((room, index) => {
    if (room.boundary.length < 3) {
      return;
    }
    const modelRoom = roomById.get(room.id);
    const label = modelRoom
      ? compactRoomLabel(modelRoom, index)
      : (roomLabelById.get(room.id) ?? room.id);
    const center = computePlanCentroid(room.boundary);
    const labelElement = document.createElement("div");
    labelElement.className = "build-3d-room-label";
    labelElement.textContent = label;
    const labelObject = new CSS2DObject(labelElement);
    labelObject.position.set(center.x, room.elevation_m + 0.08, center.y);
    group.add(labelObject);
  });

  return group;
}

export function disposeRoomFloorLabelGroup(group: THREE.Group | null) {
  if (!group) {
    return;
  }
  group.traverse((object) => {
    const label = object as CSS2DObject;
    label.element?.remove();
  });
  group.clear();
}
