import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { compactRoomLabel } from "../utils/entityLabels";
function computePlanCentroid(boundary) {
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
function computePlanBounds(points) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    });
    return { minX, minY, maxX, maxY };
}
export function createRoomFloorLabelRenderer(host) {
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1));
    labelRenderer.domElement.className = "build-3d-room-label-layer";
    labelRenderer.domElement.style.pointerEvents = "none";
    host.appendChild(labelRenderer.domElement);
    return labelRenderer;
}
export function buildRoomFloorLabelGroup(rooms, modelRooms, roomLabelById) {
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
        const nameEl = document.createElement("span");
        nameEl.textContent = label;
        labelElement.appendChild(nameEl);
        const tempC = room.temperature_C;
        if (typeof tempC === "number" && Number.isFinite(tempC)) {
            const tempEl = document.createElement("span");
            tempEl.className = "build-3d-room-label__temp";
            tempEl.textContent = `${tempC.toFixed(1)} °C`;
            if (room.temperatureColorCss) {
                tempEl.style.color = room.temperatureColorCss;
            }
            labelElement.appendChild(tempEl);
        }
        const labelObject = new CSS2DObject(labelElement);
        labelObject.position.set(center.x, room.elevation_m + 0.08, center.y);
        group.add(labelObject);
    });
    return group;
}
export function buildLevelElevationLabelGroup(levels) {
    const group = new THREE.Group();
    group.name = "group:level-elevation-labels";
    levels.forEach((level) => {
        if (!level.points.length) {
            return;
        }
        const bounds = computePlanBounds(level.points);
        if (!Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.minY)) {
            return;
        }
        const labelElement = document.createElement("div");
        labelElement.className = "build-3d-level-label";
        labelElement.textContent = level.text;
        const labelObject = new CSS2DObject(labelElement);
        labelObject.position.set(bounds.maxX + 0.45, level.elevation_m + 0.06, bounds.minY - 0.08);
        group.add(labelObject);
    });
    return group;
}
export function disposeRoomFloorLabelGroup(group) {
    if (!group) {
        return;
    }
    group.traverse((object) => {
        const label = object;
        label.element?.remove();
    });
    group.clear();
}
