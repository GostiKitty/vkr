import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { polygonArea, polygonContainsPoint } from "../../../entities/geometry/geom";
import { buildLevelAdjacencyMap, sampleSmoothedThermalFieldForFloorOverlay, sampleSmoothedThermalFieldForInterfloorSlab, } from "../../../core/thermal/field";
import { buildCanonical3DModel, } from "./buildCanonical3DModel";
import { calculateFitCameraForBounds, calculateGridLayoutForBounds, calculateTopViewCameraForBounds, normalizeStablePreviewBounds, } from "./stablePreviewMath";
import { buildSurfaceFieldHoverInfo, buildSurfaceFieldOverlayGroup, } from "./surfaceFieldScene";
import { getRoomDisplayName } from "../../../shared/utils/roomNames";
import { thermalColor, percentileRange } from "./thermalColormap";
import { buildRoomFloorLabelGroup, createRoomFloorLabelRenderer, disposeRoomFloorLabelGroup, } from "./roomFloorLabels3D";
export const USE_ROOM_FLOOR_TEMPERATURE_COLORING = true;
export const DISABLE_ALL_3D_TEMPERATURE = false;
const DEBUG_3D_OVERLAY_DIAGNOSTICS = typeof window !== "undefined" &&
    (window.localStorage?.getItem("debug-3d-overlay") === "1" || window.sessionStorage?.getItem("debug-3d-overlay") === "1");
const MAX_FLOOR_THERMAL_SAMPLES_PER_ROOM = 220;
/**
 * Sample temperature across all room surfaces and compute a P5–P95 display range.
 * This prevents extreme outliers (near windows, radiators) from washing out the colormap.
 */
function buildSmoothedFieldColorSummary(thermalField, surfaces, interfloorSlabs, levelAdjacency) {
    const roomSurfaces = surfaces.filter((surface) => surface.sourceType === "room" && surface.boundary.length >= 3);
    if (!roomSurfaces.length) {
        return null;
    }
    const values = [];
    roomSurfaces.forEach((surface) => {
        const absArea = Math.abs(polygonArea(surface.boundary));
        let step = Math.sqrt(Math.max(absArea, 0.4) / 40);
        step = Math.min(0.52, Math.max(0.2, step));
        const minX = Math.min(...surface.boundary.map((p) => p.x));
        const maxX = Math.max(...surface.boundary.map((p) => p.x));
        const minY = Math.min(...surface.boundary.map((p) => p.y));
        const maxY = Math.max(...surface.boundary.map((p) => p.y));
        let roomSamples = 0;
        sampleLoop: for (let x = minX + step * 0.5; x < maxX; x += step) {
            for (let y = minY + step * 0.5; y < maxY; y += step) {
                const point = { x, y };
                if (!polygonContainsPoint(point, surface.boundary)) {
                    continue;
                }
                values.push(sampleSmoothedThermalFieldForFloorOverlay(thermalField, surface.levelId, point, levelAdjacency));
                roomSamples += 1;
                if (roomSamples >= MAX_FLOOR_THERMAL_SAMPLES_PER_ROOM) {
                    break sampleLoop;
                }
            }
        }
    });
    interfloorSlabs.forEach((slab) => {
        if (slab.boundary.length < 3) {
            return;
        }
        const absArea = Math.abs(polygonArea(slab.boundary));
        let step = Math.sqrt(Math.max(absArea, 0.4) / 40);
        step = Math.min(0.52, Math.max(0.2, step));
        const minX = Math.min(...slab.boundary.map((p) => p.x));
        const maxX = Math.max(...slab.boundary.map((p) => p.x));
        const minY = Math.min(...slab.boundary.map((p) => p.y));
        const maxY = Math.max(...slab.boundary.map((p) => p.y));
        let slabSamples = 0;
        slabSampleLoop: for (let x = minX + step * 0.5; x < maxX; x += step) {
            for (let y = minY + step * 0.5; y < maxY; y += step) {
                const point = { x, y };
                if (!polygonContainsPoint(point, slab.boundary)) {
                    continue;
                }
                ["bottom", "top"].forEach((face) => {
                    const temp = sampleSmoothedThermalFieldForInterfloorSlab(thermalField, slab.levelId, point, levelAdjacency, face);
                    if (temp !== null) {
                        values.push(temp);
                    }
                });
                slabSamples += 1;
                if (slabSamples >= MAX_FLOOR_THERMAL_SAMPLES_PER_ROOM) {
                    break slabSampleLoop;
                }
            }
        }
    });
    if (!values.length) {
        return null;
    }
    // P5–P95 normalization: extreme outliers (cold windows, hot radiators) don't
    // collapse the colormap range; minimum 2 °C visual spread.
    const { p5, p95, average } = percentileRange(values, 2.0);
    return {
        min_C: p5,
        max_C: p95,
        average_C: average,
        coloredRoomCount: roomSurfaces.length,
        warnings: [],
    };
}
function extractObjectBounds(object) {
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.isEmpty()) {
        return null;
    }
    return {
        min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
        max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
    };
}
function countOverlayObjects(object) {
    let meshCount = 0;
    let lineCount = 0;
    object.traverse((entry) => {
        if (entry instanceof THREE.Mesh) {
            meshCount += 1;
        }
        if (entry instanceof THREE.Line || entry instanceof THREE.LineSegments) {
            lineCount += 1;
        }
    });
    return { meshCount, lineCount };
}
const ROOM_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.88,
    roughness: 0.92,
    metalness: 0.01,
    side: THREE.DoubleSide,
    depthWrite: true,
});
const WALL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x8fa8c2, roughness: 0.80, metalness: 0.07 });
const WALL_TRANSPARENT_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.42,
    roughness: 0.88,
    metalness: 0.03,
});
const OPENING_WINDOW_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.92,
    roughness: 0.45,
    metalness: 0.04,
});
const OPENING_DOOR_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    transparent: true,
    opacity: 0.95,
    roughness: 0.6,
    metalness: 0.04,
});
const ROOF_FLAT_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    transparent: true,
    opacity: 0.65,
    roughness: 0.9,
    metalness: 0.03,
});
const ROOF_PITCHED_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    transparent: true,
    opacity: 0.82,
    roughness: 0.78,
    metalness: 0.02,
});
// Keep legacy alias for external references
const ROOF_MATERIAL = ROOF_FLAT_MATERIAL;
const SLAB_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.42,
    roughness: 0.95,
    metalness: 0.02,
});
const SUPPLY_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.65, metalness: 0.04 });
const RETURN_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.65, metalness: 0.04 });
const DUCT_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    transparent: true,
    opacity: 0.4,
    roughness: 0.75,
    metalness: 0.03,
});
const EQUIPMENT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.74, metalness: 0.04 });
const SENSOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.7, metalness: 0.03 });
const HIGHLIGHT_MATERIAL = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.08,
    roughness: 0.62,
    metalness: 0.04,
});
function buildShape(points) {
    if (points.length < 3) {
        return null;
    }
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
        shape.lineTo(points[index].x, points[index].y);
    }
    shape.lineTo(points[0].x, points[0].y);
    return shape;
}
/**
 * Строит меш скатной крыши (вальмовый тип).
 * Каждая вершина контура получает высоту, пропорциональную расстоянию до конька,
 * конёк проходит вдоль оси perpendicular to slope.directionDeg.
 */
function buildPitchedRoofMesh(boundaryIn, elevationBase, slope, material) {
    if (boundaryIn.length < 3) {
        return new THREE.Mesh(new THREE.BufferGeometry(), material);
    }
    const slopeDirRad = (slope.directionDeg * Math.PI) / 180;
    const sdx = Math.cos(slopeDirRad);
    const sdz = Math.sin(slopeDirRad);
    const cx = boundaryIn.reduce((s, p) => s + p.x, 0) / boundaryIn.length;
    const cz = boundaryIn.reduce((s, p) => s + p.y, 0) / boundaryIn.length;
    const projections = boundaryIn.map((p) => (p.x - cx) * sdx + (p.y - cz) * sdz);
    const maxAbsProj = Math.max(...projections.map((v) => Math.abs(v)), 0.5);
    const rawHeights = boundaryIn.map((_, i) => elevationBase + slope.risePerMeter * (maxAbsProj - Math.abs(projections[i])));
    const contourVecs = boundaryIn.map((p) => new THREE.Vector2(p.x, p.y));
    const isClockWise = THREE.ShapeUtils.isClockWise(contourVecs);
    const boundary = isClockWise ? [...boundaryIn].reverse() : boundaryIn;
    const heights = isClockWise ? [...rawHeights].reverse() : rawHeights;
    const triContour = isClockWise ? [...contourVecs].reverse() : contourVecs;
    let faces;
    try {
        faces = THREE.ShapeUtils.triangulateShape(triContour, []);
    }
    catch {
        return new THREE.Mesh(new THREE.BufferGeometry(), material);
    }
    const positions = [];
    const normals = [];
    for (const face of faces) {
        const [ai, bi, ci] = face;
        const va = [boundary[ai].x, heights[ai], boundary[ai].y];
        const vb = [boundary[bi].x, heights[bi], boundary[bi].y];
        const vc = [boundary[ci].x, heights[ci], boundary[ci].y];
        const e1 = [vb[0] - va[0], vb[1] - va[1], vb[2] - va[2]];
        const e2 = [vc[0] - va[0], vc[1] - va[1], vc[2] - va[2]];
        const nx = e1[1] * e2[2] - e1[2] * e2[1];
        const ny = e1[2] * e2[0] - e1[0] * e2[2];
        const nz = e1[0] * e2[1] - e1[1] * e2[0];
        const len = Math.hypot(nx, ny, nz) || 1;
        positions.push(...va, ...vb, ...vc);
        for (let j = 0; j < 3; j++)
            normals.push(nx / len, ny / len, nz / len);
    }
    for (let i = 0; i < boundary.length; i++) {
        const ai = i;
        const bi = (i + 1) % boundary.length;
        const ha = heights[ai];
        const hb = heights[bi];
        const pa = boundary[ai];
        const pb = boundary[bi];
        if (ha - elevationBase < 0.02 && hb - elevationBase < 0.02)
            continue;
        const ex = pb.x - pa.x;
        const ez = pb.y - pa.y;
        const elen = Math.hypot(ex, ez) || 1;
        const wnx = -ez / elen;
        const wnz = ex / elen;
        positions.push(pa.x, elevationBase, pa.y, pb.x, elevationBase, pb.y, pb.x, hb, pb.y);
        positions.push(pa.x, elevationBase, pa.y, pb.x, hb, pb.y, pa.x, ha, pa.y);
        for (let j = 0; j < 6; j++)
            normals.push(wnx, 0, wnz);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    return new THREE.Mesh(geo, material);
}
function computePlanBounds(points) {
    return points.reduce((acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        maxX: Math.max(acc.maxX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxY: Math.max(acc.maxY, point.y),
    }), {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    });
}
function intersectPlanBounds(a, b) {
    const width = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
    const height = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
    return width * height;
}
function getSurfaceShellIntersectionRatio(surfaceBoundary, shellBoundary) {
    const surfaceBounds = computePlanBounds(surfaceBoundary);
    const shellBounds = computePlanBounds(shellBoundary);
    const surfaceArea = Math.max((surfaceBounds.maxX - surfaceBounds.minX) * (surfaceBounds.maxY - surfaceBounds.minY), 1e-6);
    return intersectPlanBounds(surfaceBounds, shellBounds) / surfaceArea;
}
function warnShiftedTemperatureSurface(details) {
    if (DEBUG_3D_OVERLAY_DIAGNOSTICS) {
        console.warn("[canonical-3d] skipped shifted temperature surface", details);
    }
}
function collectCanonicalShellPlanPoints(model) {
    const wallPoints = model.walls.flatMap((wall) => [wall.start, wall.end]);
    const roomPoints = model.rooms.flatMap((room) => room.boundary);
    // Включаем контуры помещений в опорный план: только концы стен дают «коробку»,
    // которая не совпадает с фактическим полом (внутренние контуры, демо-полигоны из модели),
    // из-за чего корректные температурные оверлеи ошибочно отбрасывались как «сдвинутые».
    if (wallPoints.length >= 4) {
        return [...wallPoints, ...roomPoints];
    }
    return [...roomPoints, ...model.roofs.flatMap((roof) => roof.boundary)];
}
function setMeshIdentity(mesh, name, userData) {
    mesh.name = name;
    Object.assign(mesh.userData, userData);
    return mesh;
}
function getSelectionMaterial(selection, kind, id, material) {
    return selection?.kind === kind && selection.id === id ? HIGHLIGHT_MATERIAL : material;
}
/**
 * Create a MeshStandardMaterial tinted with the ANSYS-like thermal colormap.
 * Used for flat-shaded fallback surfaces (non-room sources).
 */
function createRoomTemperatureMaterial(temperature_C, summary) {
    const min = summary?.min_C ?? temperature_C;
    const max = summary?.max_C ?? temperature_C;
    const span = Math.max(max - min, 1e-6);
    const color = thermalColor((temperature_C - min) / span);
    return new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.76,
        roughness: 0.80,
        metalness: 0.01,
        emissive: color,
        emissiveIntensity: 0.10,
        depthTest: false,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
    });
}
function createWallTemperatureMaterial(temperature_C, summary, transparent) {
    const min = summary?.min_C ?? temperature_C;
    const max = summary?.max_C ?? temperature_C;
    const span = Math.max(max - min, 1e-6);
    const color = thermalColor((temperature_C - min) / span);
    return new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: transparent ? 0.50 : 0.78,
        roughness: 0.78,
        metalness: 0.02,
        emissive: color,
        emissiveIntensity: 0.06,
        depthTest: false,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -0.5,
        polygonOffsetUnits: -0.5,
    });
}
/**
 * Build a smooth thermal field mesh for a room floor using vertex colors.
 *
 * Instead of individual box tiles (which produce the blocky appearance), this
 * builds a single BufferGeometry with a regular grid, samples the temperature at
 * every vertex, and assigns vertex colors. WebGL interpolates colors between
 * vertices using barycentric coordinates (Gouraud shading), giving the continuous
 * ANSYS/CFD-like gradient look.
 */
/**
 * Build a smooth thermal field mesh using vertex colors on a horizontal plan patch.
 */
function addPlanarThermalColorMesh(shellRoot, boundary, baseY, colorScale, sampleTemperatureC, meshName, identity, renderOrder, opacity = 0.82) {
    if (boundary.length < 3) {
        return;
    }
    const absArea = Math.abs(polygonArea(boundary));
    const step = Math.min(0.45, Math.max(0.20, Math.sqrt(Math.max(absArea, 0.5) / 60)));
    const minX = Math.min(...boundary.map((p) => p.x));
    const maxX = Math.max(...boundary.map((p) => p.x));
    const minY = Math.min(...boundary.map((p) => p.y));
    const maxY = Math.max(...boundary.map((p) => p.y));
    const cols = Math.ceil((maxX - minX) / step) + 2;
    const rows = Math.ceil((maxY - minY) / step) + 2;
    const nodes = [];
    for (let row = 0; row < rows; row++) {
        nodes[row] = [];
        for (let col = 0; col < cols; col++) {
            const x = minX + (col - 0.5) * step;
            const y = minY + (row - 0.5) * step;
            const inside = polygonContainsPoint({ x, y }, boundary);
            const tempC = inside ? sampleTemperatureC({ x, y }) : null;
            nodes[row][col] = { x, y, inside, tempC };
        }
    }
    const positions = [];
    const colors = [];
    const { min_C, max_C } = colorScale;
    const span = Math.max(max_C - min_C, 1e-6);
    function pushVertex(n) {
        if (n.tempC === null) {
            return;
        }
        positions.push(n.x, baseY, n.y);
        const c = thermalColor((n.tempC - min_C) / span);
        colors.push(c.r, c.g, c.b);
    }
    for (let row = 0; row < rows - 1; row++) {
        for (let col = 0; col < cols - 1; col++) {
            const v00 = nodes[row][col];
            const v10 = nodes[row][col + 1];
            const v01 = nodes[row + 1][col];
            const v11 = nodes[row + 1][col + 1];
            if (v00.inside && v10.inside && v11.inside && v00.tempC !== null && v10.tempC !== null && v11.tempC !== null) {
                pushVertex(v00);
                pushVertex(v10);
                pushVertex(v11);
            }
            if (v00.inside && v11.inside && v01.inside && v00.tempC !== null && v11.tempC !== null && v01.tempC !== null) {
                pushVertex(v00);
                pushVertex(v11);
                pushVertex(v01);
            }
        }
    }
    if (positions.length === 0) {
        return;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = renderOrder;
    setMeshIdentity(mesh, meshName, { ...identity, disposeMaterial: true });
    shellRoot.add(mesh);
}
function addRoomFloorThermalMesh(shellRoot, surface, thermalField, colorScale, levelAdjacency) {
    addPlanarThermalColorMesh(shellRoot, surface.boundary, surface.elevation_m + 0.022, colorScale, (point) => sampleSmoothedThermalFieldForFloorOverlay(thermalField, surface.levelId, point, levelAdjacency), `temperature:floor:${surface.id}`, {
        category: "temperature-floor",
        sourceType: surface.sourceType,
        sourceId: surface.roomId ?? surface.id,
        levelId: surface.levelId,
        geometrySource: surface.geometrySource,
        warning: surface.warning,
    }, 3);
}
function addInterfloorSlabThermalMeshes(shellRoot, slab, thermalField, colorScale, levelAdjacency) {
    const slabDepth = Math.max(slab.thickness_m, 0.05);
    const sampleForFace = (face) => (point) => sampleSmoothedThermalFieldForInterfloorSlab(thermalField, slab.levelId, point, levelAdjacency, face);
    // Bottom face — ceiling of the level below the slab (visible when looking up).
    addPlanarThermalColorMesh(shellRoot, slab.boundary, slab.elevation_m + 0.014, colorScale, sampleForFace("bottom"), `temperature:slab-bottom:${slab.id}`, {
        category: "temperature-slab",
        sourceType: "slab",
        sourceId: slab.id,
        levelId: slab.levelId,
        slabKind: slab.kind,
        slabFace: "bottom",
    }, 2.6, 0.88);
    // Top face — underside of the floor above; sits just under the room-floor overlay.
    addPlanarThermalColorMesh(shellRoot, slab.boundary, slab.elevation_m + slabDepth - 0.014, colorScale, sampleForFace("top"), `temperature:slab-top:${slab.id}`, {
        category: "temperature-slab",
        sourceType: "slab",
        sourceId: slab.id,
        levelId: slab.levelId,
        slabKind: slab.kind,
        slabFace: "top",
    }, 2.85, 0.72);
}
function addBoxBetween(root, a, b, width, height, centerY, material, options) {
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) {
        return null;
    }
    const geometry = new THREE.BoxGeometry(length, height, width);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((a.x + b.x) * 0.5, centerY, (a.y + b.y) * 0.5);
    mesh.rotation.y = -Math.atan2(dz, dx);
    if (options?.name || options?.userData) {
        setMeshIdentity(mesh, options?.name ?? mesh.name, options?.userData ?? {});
    }
    root.add(mesh);
    return mesh;
}
function addCylinderBetween(root, start, end, radius, material, options) {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
    const length = direction.length();
    if (length < 1e-4) {
        return null;
    }
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    if (options?.name || options?.userData) {
        setMeshIdentity(mesh, options?.name ?? mesh.name, options?.userData ?? {});
    }
    root.add(mesh);
    return mesh;
}
function createOpeningMesh(opening, selection) {
    const baseMaterial = opening.type === "window"
        ? getSelectionMaterial(selection, "window", opening.id, OPENING_WINDOW_MATERIAL)
        : getSelectionMaterial(selection, "door", opening.id, OPENING_DOOR_MATERIAL);
    const geometry = new THREE.BoxGeometry(opening.width_m, opening.height_m, opening.depth_m);
    const mesh = new THREE.Mesh(geometry, baseMaterial);
    mesh.rotation.y = opening.rotationY_rad;
    mesh.position.set(opening.center.x, opening.center.y, opening.center.z);
    return setMeshIdentity(mesh, `${opening.type}:${opening.id}`, {
        sourceType: opening.type,
        sourceId: opening.id,
        wallId: opening.wallId,
        category: "opening",
        selection: { kind: opening.type, id: opening.id },
    });
}
function buildSimpleEquipmentMesh(item, selection) {
    const material = getSelectionMaterial(selection, "equipment", item.id, EQUIPMENT_MATERIAL);
    const geometry = item.type === "pump"
        ? new THREE.CylinderGeometry(0.08, 0.08, 0.22, 8)
        : item.type === "radiator"
            ? new THREE.BoxGeometry(0.8, 0.48, 0.08)
            : item.type === "boiler"
                ? new THREE.BoxGeometry(0.55, 0.95, 0.42)
                : item.type === "ahu"
                    ? new THREE.BoxGeometry(1.1, 0.55, 0.55)
                    : item.type === "diffuser"
                        ? new THREE.BoxGeometry(0.24, 0.03, 0.24)
                        : new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const mesh = new THREE.Mesh(geometry, material);
    if (item.type === "pump") {
        mesh.rotation.z = Math.PI / 2;
    }
    mesh.position.set(item.position.x, item.position.y, item.position.z);
    return setMeshIdentity(mesh, `equipment:${item.id}`, {
        sourceType: "equipment",
        sourceId: item.id,
        category: "equipment",
        equipmentType: item.type,
        selection: { kind: "equipment", id: item.id },
    });
}
function disposeNode(root) {
    root.traverse((object) => {
        const mesh = object;
        mesh.geometry?.dispose?.();
        if (mesh.userData?.disposeMaterial === true) {
            const material = mesh.material;
            if (Array.isArray(material)) {
                material.forEach((entry) => entry.dispose?.());
            }
            else {
                material?.dispose?.();
            }
        }
    });
}
function extractBoundsFromObject(root) {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) {
        return null;
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return normalizeStablePreviewBounds(center, size);
}
function getFitRoot(shellRoot, contentRoot) {
    if (shellRoot && shellRoot.children.length > 0) {
        return shellRoot;
    }
    return contentRoot;
}
function readCameraFov(camera) {
    return camera.fov;
}
function writeCameraPlanes(camera, near, far) {
    const mutableCamera = camera;
    mutableCamera.near = near;
    mutableCamera.far = far;
    camera.updateProjectionMatrix();
}
export const Build3DCanonicalPreview = React.forwardRef(({ model, activeLevelId, selection, viewer, thermalField = null, surfaceField = null, surfaceFieldMode = "surfaceTemperature", showSurfaceField = false, showHeatSources = false, showThermalBridges = false, showTemperature = false, showWallTemperature = false, surfaceFieldOpacity = 0.52, solarPosition = null, onSelect, onHoverInfo, onCameraStateChange, onSurfaceFieldDebug, }, forwardedRef) => {
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const contentRef = useRef(null);
    const shellRootRef = useRef(null);
    const systemsRootRef = useRef(null);
    const thermalRootRef = useRef(null);
    const gridRef = useRef(null);
    const labelsRootRef = useRef(null);
    const labelRendererRef = useRef(null);
    const sunLightRef = useRef(null);
    const animationFrameRef = useRef(0);
    const resizeObserverRef = useRef(null);
    const fitRafRef = useRef(null);
    const pointerDownRef = useRef(null);
    const containerSizeRef = useRef({ width: 0, height: 0 });
    const homeViewRef = useRef(null);
    const hasInitialFitRef = useRef(false);
    const lastModelKeyRef = useRef("");
    const onSelectRef = useRef(onSelect);
    const onHoverInfoRef = useRef(onHoverInfo);
    const onCameraStateChangeRef = useRef(onCameraStateChange);
    const emitCameraStateRef = useRef(null);
    const onSurfaceFieldDebugRef = useRef(onSurfaceFieldDebug);
    const surfaceFieldRef = useRef(surfaceField);
    const surfaceFieldModeRef = useRef(surfaceFieldMode);
    const roomLabelByIdRef = useRef(new Map());
    useEffect(() => {
        onSelectRef.current = onSelect;
    }, [onSelect]);
    useEffect(() => {
        onHoverInfoRef.current = onHoverInfo;
    }, [onHoverInfo]);
    useEffect(() => {
        onCameraStateChangeRef.current = onCameraStateChange;
    }, [onCameraStateChange]);
    useEffect(() => {
        onSurfaceFieldDebugRef.current = onSurfaceFieldDebug;
    }, [onSurfaceFieldDebug]);
    useEffect(() => {
        surfaceFieldRef.current = surfaceField;
    }, [surfaceField]);
    useEffect(() => {
        surfaceFieldModeRef.current = surfaceFieldMode;
    }, [surfaceFieldMode]);
    const temperatureEnabled = showTemperature && USE_ROOM_FLOOR_TEMPERATURE_COLORING && !DISABLE_ALL_3D_TEMPERATURE;
    const wallTemperatureEnabled = temperatureEnabled && showWallTemperature;
    const canonicalModel = useMemo(() => buildCanonical3DModel(model, activeLevelId, {
        thermalField,
    }), [activeLevelId, model, thermalField]);
    const levelAdjacency = useMemo(() => buildLevelAdjacencyMap(model.levels), [model.levels]);
    const interfloorSlabs = useMemo(() => canonicalModel.slabs.filter((slab) => slab.kind === "interfloor"), [canonicalModel.slabs]);
    const smoothedFieldColorSummary = useMemo(() => thermalField
        ? buildSmoothedFieldColorSummary(thermalField, canonicalModel.temperatureSurfaces, interfloorSlabs, levelAdjacency)
        : null, [thermalField, canonicalModel.temperatureSurfaces, interfloorSlabs, levelAdjacency]);
    const temperatureColorScale = useMemo(() => smoothedFieldColorSummary ?? canonicalModel.temperatureSummary, [canonicalModel.temperatureSummary, smoothedFieldColorSummary]);
    const roomLabelById = useMemo(() => new Map(model.rooms.map((room, index) => [room.id, getRoomDisplayName(room, index)])), [model.rooms]);
    useEffect(() => {
        roomLabelByIdRef.current = roomLabelById;
    }, [roomLabelById]);
    const coloredRoomFloorCount = useMemo(() => (temperatureEnabled ? canonicalModel.temperatureSurfaces.length : 0), [canonicalModel.temperatureSurfaces.length, temperatureEnabled]);
    const coloredWallCount = useMemo(() => wallTemperatureEnabled
        ? canonicalModel.walls.filter((wall) => Number.isFinite(wall.temperature_C)).length
        : 0, [canonicalModel.walls, wallTemperatureEnabled]);
    const coloredInterfloorSlabCount = useMemo(() => (temperatureEnabled && thermalField ? interfloorSlabs.length : 0), [interfloorSlabs.length, temperatureEnabled, thermalField]);
    // Реактивное обновление положения солнца → позиция ключевого света
    useEffect(() => {
        const light = sunLightRef.current;
        if (!light) {
            return;
        }
        if (solarPosition && solarPosition.isAboveHorizon) {
            const DIST = 50;
            light.position.set(solarPosition.lightX * DIST, solarPosition.lightY * DIST, solarPosition.lightZ * DIST);
            light.intensity = 0.88;
        }
        else {
            // Ночь / солнце за горизонтом — возвращаем стандартную позицию
            light.position.set(18, 22, 14);
            light.intensity = solarPosition ? 0.12 : 0.88;
        }
    }, [solarPosition]);
    const renderCurrentScene = () => {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    };
    const applyCameraFrame = (frame, updateHome) => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) {
            return;
        }
        camera.position.set(frame.position.x, frame.position.y, frame.position.z);
        writeCameraPlanes(camera, frame.near, frame.far);
        controls.target.set(frame.target.x, frame.target.y, frame.target.z);
        controls.update();
        emitCameraStateRef.current?.();
        renderCurrentScene();
        if (updateHome) {
            homeViewRef.current = {
                ...frame,
                position: { ...frame.position },
                target: { ...frame.target },
            };
        }
        hasInitialFitRef.current = true;
    };
    const fitToModel = (mode, updateHome) => {
        const camera = cameraRef.current;
        const fitRoot = getFitRoot(shellRootRef.current, contentRef.current);
        if (!camera || !fitRoot) {
            return;
        }
        const bounds = extractBoundsFromObject(fitRoot);
        if (!bounds) {
            const fallback = mode === "top"
                ? {
                    position: { x: 0, y: 14, z: 0.01 },
                    target: { x: 0, y: 0, z: 0 },
                    distance: 14,
                    near: 0.1,
                    far: 1000,
                }
                : {
                    position: { x: 12, y: 10, z: 12 },
                    target: { x: 0, y: 1, z: 0 },
                    distance: 12,
                    near: 0.1,
                    far: 1000,
                };
            applyCameraFrame(fallback, updateHome);
            return;
        }
        const frame = mode === "top"
            ? calculateTopViewCameraForBounds(bounds, camera.aspect, readCameraFov(camera))
            : calculateFitCameraForBounds(bounds, camera.aspect, readCameraFov(camera));
        applyCameraFrame(frame, updateHome);
    };
    const scheduleInitialFit = () => {
        if (fitRafRef.current !== null) {
            window.cancelAnimationFrame(fitRafRef.current);
        }
        fitRafRef.current = window.requestAnimationFrame(() => {
            fitRafRef.current = null;
            if (!containerSizeRef.current.width || !containerSizeRef.current.height || hasInitialFitRef.current) {
                return;
            }
            fitToModel("focus", true);
        });
    };
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 220, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.95;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xc8dff0);
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        camera.position.set(12, 10, 12);
        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.enablePan = true;
        controls.enableRotate = true;
        controls.enableZoom = true;
        controls.target.set(0, 1, 0);
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE,
        };
        let queuedCameraState = null;
        let cameraStateFrameId = 0;
        let lastCameraState = null;
        const buildCameraState = () => {
            const dx = camera.position.x - controls.target.x;
            const dy = camera.position.y - controls.target.y;
            const dz = camera.position.z - controls.target.z;
            return {
                position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
                azimuthRad: controls.getAzimuthalAngle(),
                polarRad: controls.getPolarAngle(),
                distance: Math.hypot(dx, dy, dz),
            };
        };
        const sameCameraState = (left, right) => Boolean(left &&
            right &&
            Math.abs(left.position.x - right.position.x) < 0.001 &&
            Math.abs(left.position.y - right.position.y) < 0.001 &&
            Math.abs(left.position.z - right.position.z) < 0.001 &&
            Math.abs(left.target.x - right.target.x) < 0.001 &&
            Math.abs(left.target.y - right.target.y) < 0.001 &&
            Math.abs(left.target.z - right.target.z) < 0.001 &&
            Math.abs(left.azimuthRad - right.azimuthRad) < 0.0005 &&
            Math.abs(left.polarRad - right.polarRad) < 0.0005 &&
            Math.abs(left.distance - right.distance) < 0.001);
        const flushCameraState = () => {
            cameraStateFrameId = 0;
            if (!onCameraStateChangeRef.current) {
                return;
            }
            if (!queuedCameraState || sameCameraState(lastCameraState, queuedCameraState)) {
                return;
            }
            lastCameraState = queuedCameraState;
            onCameraStateChangeRef.current(queuedCameraState);
        };
        const emitCameraState = () => {
            if (!onCameraStateChangeRef.current) {
                return;
            }
            queuedCameraState = buildCameraState();
            if (cameraStateFrameId !== 0) {
                return;
            }
            cameraStateFrameId = window.requestAnimationFrame(flushCameraState);
        };
        emitCameraStateRef.current = emitCameraState;
        controls.addEventListener("change", emitCameraState);
        emitCameraState();
        // Hemisphere light: sky (cool blue) / ground (warm beige) for realistic shading
        const hemiLight = new THREE.HemisphereLight(0xb2d4f0, 0xcec8b4, 0.75);
        scene.add(hemiLight);
        const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.15);
        keyLight.position.set(18, 22, 14);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 200;
        keyLight.shadow.camera.left = -45;
        keyLight.shadow.camera.right = 45;
        keyLight.shadow.camera.top = 45;
        keyLight.shadow.camera.bottom = -45;
        keyLight.shadow.bias = -0.0008;
        keyLight.shadow.radius = 2.5;
        scene.add(keyLight);
        sunLightRef.current = keyLight;
        const fillLight = new THREE.DirectionalLight(0xc2ddf5, 0.42);
        fillLight.position.set(-10, 8, -6);
        scene.add(fillLight);
        // Invisible ground plane that receives soft shadows from the building
        const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.18 }));
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = -0.02;
        groundMesh.receiveShadow = true;
        groundMesh.name = "ground:shadow";
        scene.add(groundMesh);
        const grid = new THREE.GridHelper(20, 20, 0xb0c8e0, 0xd0dfe8);
        grid.name = "grid:canonical";
        const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
        gridMaterials.forEach((material) => {
            material.transparent = true;
            material.opacity = 0.28;
        });
        scene.add(grid);
        const content = new THREE.Group();
        content.name = "group:content";
        const shellRoot = new THREE.Group();
        shellRoot.name = "group:shell";
        const systemsRoot = new THREE.Group();
        systemsRoot.name = "group:systems";
        const thermalRoot = new THREE.Group();
        thermalRoot.name = "group:thermal";
        const labelsRoot = new THREE.Group();
        labelsRoot.name = "group:room-labels";
        content.add(shellRoot);
        content.add(systemsRoot);
        content.add(thermalRoot);
        content.add(labelsRoot);
        scene.add(content);
        const labelHost = canvas.parentElement ?? canvas;
        const labelRenderer = createRoomFloorLabelRenderer(labelHost);
        const resize = () => {
            const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
            const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 220;
            containerSizeRef.current = { width, height };
            renderer.setSize(width, height, false);
            labelRenderer.setSize(width, height);
            camera.aspect = width / Math.max(height, 1);
            camera.updateProjectionMatrix();
            if (!hasInitialFitRef.current) {
                scheduleInitialFit();
            }
        };
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const resolveSelection = (event) => {
            const rect = canvas.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(content.children, true);
            const hit = hits.find((entry) => entry.object.userData?.selection);
            if (!hit) {
                onSelectRef.current?.(null);
                return;
            }
            onSelectRef.current?.(hit.object.userData.selection);
        };
        const handlePointerMove = (event) => {
            if (!onHoverInfoRef.current) {
                return;
            }
            const rect = canvas.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(content.children, true);
            const hit = hits.find((entry) => {
                const category = entry.object.userData?.category;
                return (category === "surface-field" ||
                    category === "surface-heat-source" ||
                    category === "surface-thermal-bridge");
            });
            const currentSurfaceField = surfaceFieldRef.current;
            if (!hit || !currentSurfaceField) {
                onHoverInfoRef.current?.(null);
                return;
            }
            onHoverInfoRef.current?.(buildSurfaceFieldHoverInfo({
                intersection: hit,
                result: currentSurfaceField,
                mode: surfaceFieldModeRef.current,
                roomLabelById: roomLabelByIdRef.current,
                screenX: event.clientX - rect.left,
                screenY: event.clientY - rect.top,
            }));
        };
        const handlePointerLeave = () => {
            onHoverInfoRef.current?.(null);
        };
        const handlePointerDown = (event) => {
            pointerDownRef.current = { x: event.clientX, y: event.clientY };
        };
        const handlePointerUp = (event) => {
            const pointerDown = pointerDownRef.current;
            pointerDownRef.current = null;
            if (!pointerDown || event.button !== 0) {
                return;
            }
            if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) <= 4) {
                resolveSelection(event);
            }
        };
        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        const preventViewportScroll = (event) => {
            event.preventDefault();
        };
        const preventContextMenu = (event) => {
            event.preventDefault();
        };
        canvas.addEventListener("wheel", preventViewportScroll, { passive: false });
        canvas.addEventListener("contextmenu", preventContextMenu);
        canvas.addEventListener("pointerdown", handlePointerDown);
        canvas.addEventListener("pointerup", handlePointerUp);
        canvas.addEventListener("pointermove", handlePointerMove);
        canvas.addEventListener("pointerleave", handlePointerLeave);
        const animate = () => {
            controls.update();
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
            animationFrameRef.current = window.requestAnimationFrame(animate);
        };
        animate();
        rendererRef.current = renderer;
        sceneRef.current = scene;
        cameraRef.current = camera;
        controlsRef.current = controls;
        contentRef.current = content;
        shellRootRef.current = shellRoot;
        systemsRootRef.current = systemsRoot;
        thermalRootRef.current = thermalRoot;
        labelsRootRef.current = labelsRoot;
        labelRendererRef.current = labelRenderer;
        gridRef.current = grid;
        resizeObserverRef.current = resizeObserver;
        return () => {
            emitCameraStateRef.current = null;
            if (cameraStateFrameId !== 0) {
                window.cancelAnimationFrame(cameraStateFrameId);
            }
            controls.removeEventListener("change", emitCameraState);
            if (animationFrameRef.current) {
                window.cancelAnimationFrame(animationFrameRef.current);
            }
            if (fitRafRef.current !== null) {
                window.cancelAnimationFrame(fitRafRef.current);
            }
            resizeObserver.disconnect();
            canvas.removeEventListener("wheel", preventViewportScroll);
            canvas.removeEventListener("contextmenu", preventContextMenu);
            canvas.removeEventListener("pointerdown", handlePointerDown);
            canvas.removeEventListener("pointerup", handlePointerUp);
            canvas.removeEventListener("pointermove", handlePointerMove);
            canvas.removeEventListener("pointerleave", handlePointerLeave);
            disposeRoomFloorLabelGroup(labelsRootRef.current);
            labelsRootRef.current = null;
            labelRendererRef.current?.domElement.remove();
            labelRendererRef.current = null;
            controls.dispose();
            renderer.dispose();
            scene.traverse((object) => {
                const mesh = object;
                mesh.geometry?.dispose?.();
                const material = mesh.material;
                if (Array.isArray(material)) {
                    material.forEach((entry) => entry.dispose?.());
                }
                else {
                    material?.dispose?.();
                }
            });
        };
    }, []);
    useEffect(() => {
        const content = contentRef.current;
        const shellRoot = shellRootRef.current;
        const systemsRoot = systemsRootRef.current;
        const thermalRoot = thermalRootRef.current;
        const labelsRoot = labelsRootRef.current;
        const grid = gridRef.current;
        if (!content || !shellRoot || !systemsRoot || !thermalRoot || !labelsRoot || !grid) {
            return;
        }
        shellRoot.children.slice().forEach((child) => {
            shellRoot.remove(child);
            disposeNode(child);
        });
        systemsRoot.children.slice().forEach((child) => {
            systemsRoot.remove(child);
            disposeNode(child);
        });
        thermalRoot.children.slice().forEach((child) => {
            thermalRoot.remove(child);
            disposeNode(child);
        });
        disposeRoomFloorLabelGroup(labelsRoot);
        labelsRoot.clear();
        const wallMaterial = viewer.transparentWalls ? WALL_TRANSPARENT_MATERIAL : WALL_MATERIAL;
        const shellPlanBoundary = collectCanonicalShellPlanPoints(canonicalModel);
        const colorScale = temperatureColorScale;
        canonicalModel.rooms.forEach((room) => {
            if (!viewer.showRooms) {
                return;
            }
            const shape = buildShape(room.boundary);
            if (!shape) {
                return;
            }
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
            const baseMaterial = ROOM_MATERIAL;
            const roomMaterial = getSelectionMaterial(selection, "room", room.id, baseMaterial);
            const mesh = new THREE.Mesh(geometry, roomMaterial);
            // План (x, y) → мир (x, Y, z): как у стен и planToCanonicalScene — z = y_плана.
            // Rx(-π/2) давал z = -y_плана и «уносил» пол/температуру/плиты от корпуса.
            mesh.rotation.x = Math.PI / 2;
            mesh.position.y = room.elevation_m + 0.02 + 0.03;
            mesh.renderOrder = 1;
            setMeshIdentity(mesh, `roomFloor:${room.id}`, {
                category: "room-floor",
                sourceType: "room",
                sourceId: room.id,
                levelId: room.levelId,
                temperature_C: room.temperature_C,
                geometrySource: room.geometrySource,
                disposeMaterial: roomMaterial === baseMaterial && baseMaterial !== ROOM_MATERIAL,
                selection: { kind: "room", id: room.id },
            });
            shellRoot.add(mesh);
        });
        if (viewer.showRooms && canonicalModel.rooms.length > 0) {
            labelsRoot.add(buildRoomFloorLabelGroup(canonicalModel.rooms, model.rooms, roomLabelById));
        }
        canonicalModel.walls.forEach((wall) => {
            if (!viewer.showWalls) {
                return;
            }
            const baseWallMaterial = wallTemperatureEnabled && Number.isFinite(wall.temperature_C) && colorScale
                ? createWallTemperatureMaterial(wall.temperature_C, colorScale, viewer.transparentWalls)
                : wallMaterial;
            const wallMeshMaterial = getSelectionMaterial(selection, "wall", wall.id, baseWallMaterial);
            addBoxBetween(shellRoot, wall.start, wall.end, Math.max(wall.thickness_m, 0.08), Math.max(wall.height_m, 2.4), wall.elevation_m + wall.height_m * 0.5, wallMeshMaterial, {
                name: `wall:${wall.id}`,
                userData: {
                    category: "shell",
                    sourceType: "wall",
                    sourceId: wall.id,
                    levelId: wall.levelId,
                    temperature_C: wall.temperature_C,
                    adjacentRoomId: wall.adjacentRoomId,
                    disposeMaterial: baseWallMaterial !== wallMaterial,
                    selection: { kind: "wall", id: wall.id },
                },
            });
            if (wallMeshMaterial !== baseWallMaterial && baseWallMaterial !== wallMaterial) {
                baseWallMaterial.dispose();
            }
        });
        if (viewer.showOpenings) {
            canonicalModel.doors.forEach((door) => shellRoot.add(createOpeningMesh(door, selection)));
            canonicalModel.windows.forEach((windowItem) => shellRoot.add(createOpeningMesh(windowItem, selection)));
        }
        canonicalModel.roofs.forEach((roof) => {
            if (shellPlanBoundary.length >= 3 && getSurfaceShellIntersectionRatio(roof.boundary, shellPlanBoundary) < 0.7) {
                warnShiftedTemperatureSurface({ id: roof.id, levelId: roof.levelId, sourceType: "roof" });
                if (DEBUG_3D_OVERLAY_DIAGNOSTICS) {
                    console.warn("[canonical-3d] skipped shifted roof surface", { id: roof.id, levelId: roof.levelId });
                }
                return;
            }
            const selectionMat = (base) => getSelectionMaterial(selection, "roof", roof.id, base);
            const identity = {
                category: "roof",
                sourceType: "roof",
                sourceId: roof.id,
                levelId: roof.levelId,
                selection: { kind: "roof", id: roof.id },
            };
            if (roof.kind === "pitched" && roof.slope) {
                // Скатная крыша — вальмовая геометрия
                const mat = selectionMat(ROOF_PITCHED_MATERIAL);
                const mesh = buildPitchedRoofMesh(roof.boundary, roof.elevation_m, roof.slope, mat);
                setMeshIdentity(mesh, `roof:${roof.id}`, identity);
                shellRoot.add(mesh);
            }
            else {
                // Плоская крыша — экструзия-плита
                const shape = buildShape(roof.boundary);
                if (!shape) {
                    return;
                }
                const roofDepth = Math.max(roof.thickness_m, 0.05);
                const geometry = new THREE.ExtrudeGeometry(shape, { depth: roofDepth, bevelEnabled: false });
                const mesh = new THREE.Mesh(geometry, selectionMat(ROOF_FLAT_MATERIAL));
                mesh.rotation.x = Math.PI / 2;
                mesh.position.y = roof.elevation_m + roofDepth;
                setMeshIdentity(mesh, `roof:${roof.id}`, identity);
                shellRoot.add(mesh);
            }
        });
        canonicalModel.slabs.forEach((slab) => {
            if (shellPlanBoundary.length >= 3 && getSurfaceShellIntersectionRatio(slab.boundary, shellPlanBoundary) < 0.7) {
                warnShiftedTemperatureSurface({ id: slab.id, levelId: slab.levelId, sourceType: "slab" });
                if (DEBUG_3D_OVERLAY_DIAGNOSTICS) {
                    console.warn("[canonical-3d] skipped shifted slab surface", { id: slab.id, levelId: slab.levelId });
                }
                return;
            }
            const shape = buildShape(slab.boundary);
            if (!shape) {
                return;
            }
            const slabDepth = Math.max(slab.thickness_m, 0.05);
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: slabDepth, bevelEnabled: false });
            const mesh = new THREE.Mesh(geometry, getSelectionMaterial(selection, "slab", slab.id, SLAB_MATERIAL));
            mesh.rotation.x = Math.PI / 2;
            mesh.position.y = slab.elevation_m + slabDepth;
            setMeshIdentity(mesh, `slab:${slab.id}`, {
                category: "slab",
                sourceType: "slab",
                sourceId: slab.id,
                levelId: slab.levelId,
                selection: { kind: "slab", id: slab.id },
            });
            shellRoot.add(mesh);
        });
        if (viewer.showNetworks) {
            canonicalModel.pipes.forEach((pipe) => {
                pipe.path.slice(1).forEach((point, index) => {
                    const start = pipe.path[index];
                    addCylinderBetween(systemsRoot, new THREE.Vector3(start.x, start.y, start.z), new THREE.Vector3(point.x, point.y, point.z), Math.max(pipe.diameter_m * 0.5, 0.014), pipe.colorRole === "return" ? RETURN_MATERIAL : SUPPLY_MATERIAL, {
                        name: `pipe:${pipe.id}:segment:${index}`,
                        userData: {
                            category: "network",
                            sourceType: "pipe",
                            sourceId: pipe.id,
                            colorRole: pipe.colorRole,
                        },
                    });
                });
            });
            canonicalModel.ducts.forEach((duct) => {
                duct.path.slice(1).forEach((point, index) => {
                    const start = duct.path[index];
                    addBoxBetween(systemsRoot, { x: start.x, y: start.z }, { x: point.x, y: point.z }, duct.width_m, duct.height_m, start.y, DUCT_MATERIAL, {
                        name: `duct:${duct.id}:segment:${index}`,
                        userData: {
                            category: "network",
                            sourceType: "duct",
                            sourceId: duct.id,
                        },
                    });
                });
            });
        }
        if (viewer.showEquipment) {
            canonicalModel.equipment.forEach((item) => {
                systemsRoot.add(buildSimpleEquipmentMesh(item, selection));
            });
            canonicalModel.sensors.forEach((sensor) => {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), getSelectionMaterial(selection, "sensor", sensor.id, SENSOR_MATERIAL));
                mesh.position.set(sensor.position.x, sensor.position.y, sensor.position.z);
                setMeshIdentity(mesh, `sensor:${sensor.id}`, {
                    category: "sensor",
                    sourceType: "sensor",
                    sourceId: sensor.id,
                    levelId: sensor.levelId,
                    selection: { kind: "sensor", id: sensor.id },
                });
                systemsRoot.add(mesh);
            });
        }
        const surfaceFieldOverlayActive = showSurfaceField || showHeatSources || showThermalBridges;
        const surfaceFieldXRay = surfaceFieldOverlayActive && !viewer.transparentWalls;
        let surfaceFieldDebugInfo = null;
        if (surfaceField && surfaceFieldOverlayActive) {
            const overlayGroup = buildSurfaceFieldOverlayGroup(surfaceField, {
                mode: surfaceFieldMode,
                showSurfaceField,
                showHeatSources,
                showThermalBridges,
                roomLabelById,
                xRay: surfaceFieldXRay,
                overlayOpacity: surfaceFieldOpacity,
            });
            thermalRoot.add(overlayGroup);
            const stats = countOverlayObjects(overlayGroup);
            surfaceFieldDebugInfo = {
                overlayEnabled: true,
                showSurfaceField,
                showHeatSources,
                showThermalBridges,
                xRay: surfaceFieldXRay,
                mode: surfaceFieldMode,
                surfaces: surfaceField.surfaces.length,
                patches: surfaceField.patches.length,
                heatSources: surfaceField.heatSources.length,
                thermalBridges: surfaceField.thermalBridges.length,
                groupChildren: overlayGroup.children.length,
                meshCount: stats.meshCount,
                lineCount: stats.lineCount,
                thermalRootChildren: thermalRoot.children.length,
                sceneHasSurfaceFieldGroup: thermalRoot.children.includes(overlayGroup),
                bounds: extractObjectBounds(overlayGroup),
            };
        }
        else {
            surfaceFieldDebugInfo = {
                overlayEnabled: false,
                showSurfaceField,
                showHeatSources,
                showThermalBridges,
                xRay: false,
                mode: surfaceFieldMode,
                surfaces: surfaceField?.surfaces.length ?? 0,
                patches: surfaceField?.patches.length ?? 0,
                heatSources: surfaceField?.heatSources.length ?? 0,
                thermalBridges: surfaceField?.thermalBridges.length ?? 0,
                groupChildren: 0,
                meshCount: 0,
                lineCount: 0,
                thermalRootChildren: thermalRoot.children.length,
                sceneHasSurfaceFieldGroup: false,
                bounds: null,
                reason: !surfaceField
                    ? "no surfaceFieldResult"
                    : surfaceFieldOverlayActive
                        ? "overlay group produced no meshes"
                        : "surface field toggles disabled",
            };
        }
        onSurfaceFieldDebugRef.current?.(surfaceFieldDebugInfo);
        if (surfaceFieldDebugInfo && DEBUG_3D_OVERLAY_DIAGNOSTICS) {
            console.debug("[surface-field-overlay]", surfaceFieldDebugInfo);
        }
        const fitRoot = getFitRoot(shellRoot, content);
        const bounds = fitRoot ? extractBoundsFromObject(fitRoot) : null;
        if (bounds) {
            const gridLayout = calculateGridLayoutForBounds(bounds);
            grid.position.set(gridLayout.position.x, gridLayout.position.y, gridLayout.position.z);
            grid.scale.set(Math.max(gridLayout.size / 20, 1), 1, Math.max(gridLayout.size / 20, 1));
        }
        const modelKey = [
            canonicalModel.levelId ?? "all-levels",
            canonicalModel.rooms.length,
            canonicalModel.walls.length,
            canonicalModel.windows.length,
            canonicalModel.doors.length,
            canonicalModel.roofs.length,
            canonicalModel.slabs.length,
            canonicalModel.pipes.length,
            canonicalModel.ducts.length,
            canonicalModel.equipment.length,
            canonicalModel.sensors.length,
            viewer.showRooms ? 1 : 0,
            viewer.showWalls ? 1 : 0,
            viewer.showOpenings ? 1 : 0,
            viewer.showNetworks ? 1 : 0,
            viewer.showEquipment ? 1 : 0,
        ].join(":");
        if (lastModelKeyRef.current !== modelKey) {
            lastModelKeyRef.current = modelKey;
            hasInitialFitRef.current = false;
        }
        if (!hasInitialFitRef.current && bounds) {
            scheduleInitialFit();
        }
        // Enable shadow casting/receiving on all shell geometry
        shellRoot.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });
        renderCurrentScene();
    }, [
        canonicalModel,
        model.rooms,
        roomLabelById,
        selection,
        showHeatSources,
        showSurfaceField,
        showThermalBridges,
        surfaceField,
        surfaceFieldMode,
        surfaceFieldOpacity,
        viewer,
        wallTemperatureEnabled,
    ]);
    useEffect(() => {
        const shellRoot = shellRootRef.current;
        if (!shellRoot) {
            return;
        }
        const removeTemperatureMeshes = () => {
            shellRoot.children
                .filter((child) => {
                const name = child.name ?? "";
                return name.startsWith("temperature:") || child.userData?.category === "temperature-floor" || child.userData?.category === "temperature-slab";
            })
                .forEach((child) => {
                shellRoot.remove(child);
                disposeNode(child);
            });
        };
        removeTemperatureMeshes();
        if (!viewer.showRooms || !temperatureEnabled || !temperatureColorScale) {
            renderCurrentScene();
            return;
        }
        const shellPlanBoundary = collectCanonicalShellPlanPoints(canonicalModel);
        canonicalModel.temperatureSurfaces.forEach((surface) => {
            const shellGuardApplies = surface.sourceType === "shell-fallback" &&
                shellPlanBoundary.length >= 3 &&
                getSurfaceShellIntersectionRatio(surface.boundary, shellPlanBoundary) < 0.7;
            if (shellGuardApplies) {
                return;
            }
            if (thermalField && surface.sourceType === "room") {
                addRoomFloorThermalMesh(shellRoot, surface, thermalField, temperatureColorScale, levelAdjacency);
                return;
            }
            const shape = buildShape(surface.boundary);
            if (!shape) {
                return;
            }
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: false });
            const baseMaterial = createRoomTemperatureMaterial(surface.temperature_C, temperatureColorScale);
            const mesh = new THREE.Mesh(geometry, baseMaterial);
            mesh.rotation.x = Math.PI / 2;
            mesh.position.y = surface.elevation_m + 0.028 + 0.018;
            mesh.renderOrder = 2;
            setMeshIdentity(mesh, `temperature:room:${surface.id}`, {
                category: "temperature-floor",
                sourceType: surface.sourceType,
                sourceId: surface.roomId ?? surface.id,
                levelId: surface.levelId,
                temperature_C: surface.temperature_C,
                geometrySource: surface.geometrySource,
                warning: surface.warning,
                disposeMaterial: true,
            });
            shellRoot.add(mesh);
        });
        if (thermalField) {
            interfloorSlabs.forEach((slab) => {
                if (shellPlanBoundary.length >= 3 && getSurfaceShellIntersectionRatio(slab.boundary, shellPlanBoundary) < 0.7) {
                    return;
                }
                addInterfloorSlabThermalMeshes(shellRoot, slab, thermalField, temperatureColorScale, levelAdjacency);
            });
        }
        renderCurrentScene();
    }, [
        canonicalModel,
        interfloorSlabs,
        levelAdjacency,
        temperatureColorScale,
        temperatureEnabled,
        thermalField,
        viewer.showRooms,
    ]);
    useImperativeHandle(forwardedRef, () => ({
        getCanvas: () => canvasRef.current,
        focusModel: () => fitToModel("focus", true),
        resetView: () => {
            const homeView = homeViewRef.current;
            if (homeView) {
                applyCameraFrame(homeView, false);
                return;
            }
            fitToModel("focus", true);
        },
        topView: () => fitToModel("top", false),
        zoomToFit: () => fitToModel("focus", true),
        setTopView: () => fitToModel("top", false),
        focusSelection: () => fitToModel("focus", false),
    }), [canonicalModel.levelId]);
    const partialTemperatureWarning = temperatureEnabled &&
        canonicalModel.temperatureSummary?.warnings.find((warning) => /оболочк|построен по плану|отключен/i.test(warning));
    return (_jsxs("div", { className: "relative h-full w-full overflow-hidden touch-none", children: [_jsx("canvas", { ref: canvasRef, className: "block h-full w-full touch-none overscroll-contain" }), temperatureEnabled && temperatureColorScale && (coloredRoomFloorCount > 0 || coloredWallCount > 0 || coloredInterfloorSlabCount > 0) ? (_jsx("div", { className: "pointer-events-none absolute bottom-3 left-3 z-10", children: _jsxs("div", { className: "ui-overlay max-w-[15rem] px-3 py-2.5", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0435 \u043F\u043E\u043B\u0435" }), _jsxs("p", { className: "mt-1 text-sm font-semibold text-slate-900", children: [temperatureColorScale.min_C.toFixed(1), "\u2013", temperatureColorScale.max_C.toFixed(1), " \u00B0C"] }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["\u0421\u0440\u0435\u0434\u043D\u044F\u044F ", temperatureColorScale.average_C.toFixed(1), " \u00B0C"] }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["\u041F\u043E\u043B: ", coloredRoomFloorCount, " \u00B7 \u041F\u043B\u0438\u0442\u044B: ", coloredInterfloorSlabCount, " \u00B7 \u0421\u0442\u0435\u043D\u044B: ", coloredWallCount] }), partialTemperatureWarning ? _jsx("p", { className: "mt-1 text-xs text-amber-700", children: partialTemperatureWarning }) : null] }) })) : null] }));
});
Build3DCanonicalPreview.displayName = "Build3DCanonicalPreview";
export default Build3DCanonicalPreview;
