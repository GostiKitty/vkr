import { jsx as _jsx } from "react/jsx-runtime";
import React, { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildGeometryRenderModel } from "../../../core/geometry/bimPipeline";
import { anchorToOffset, resolveWallPoint } from "../utils/openingMath";
import { calculateFitCameraForBounds, calculateGridLayoutForBounds, calculateTopViewCameraForBounds, normalizeStablePreviewBounds, } from "./stablePreviewMath";
const ROOM_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.46, roughness: 0.92, metalness: 0.02 });
const WALL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: false, opacity: 1, roughness: 0.84, metalness: 0.04 });
const WALL_TRANSPARENT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.42, roughness: 0.84, metalness: 0.04 });
const OPENING_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.82, roughness: 0.52, metalness: 0.08 });
const ROOF_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.88, roughness: 0.86, metalness: 0.06 });
const SLAB_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.74, roughness: 0.9, metalness: 0.04 });
const PIPE_SUPPLY_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.56, metalness: 0.08 });
const PIPE_RETURN_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.56, metalness: 0.08 });
const DUCT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.56, roughness: 0.7, metalness: 0.06 });
const EQUIPMENT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.72, metalness: 0.06 });
const SENSOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.7, metalness: 0.04 });
const HIGHLIGHT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.08, roughness: 0.58, metalness: 0.06 });
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(12, 11, 12);
const DEFAULT_TARGET = new THREE.Vector3(0, 1, 0);
const DEBUG_STABLE_3D_FIT = false;
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
function addBoxBetween(root, a, b, width, height, centerY, material) {
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) {
        return;
    }
    const geometry = new THREE.BoxGeometry(length, height, width);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((a.x + b.x) / 2, centerY, (a.y + b.y) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    root.add(mesh);
}
function addCylinderBetween(root, start, end, radius, material) {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
    const length = Math.hypot(direction.x, direction.y, direction.z);
    if (length < 1e-4) {
        return;
    }
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    root.add(mesh);
}
function createBox3() {
    return new THREE.Box3();
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
function applyCameraFrame(camera, controls, frame) {
    camera.position.set(frame.position.x, frame.position.y, frame.position.z);
    controls.target.set(frame.target.x, frame.target.y, frame.target.z);
    writeCameraPlanes(camera, frame.near, frame.far);
    controls.update();
}
function buildSimpleEquipment(item, levelElevation) {
    const group = new THREE.Group();
    const material = item.type === "sensor" ? SENSOR_MATERIAL : EQUIPMENT_MATERIAL;
    if (item.type === "pump") {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 8), material);
        body.rotation.z = Math.PI / 2;
        body.position.set(item.position.x, levelElevation + 0.22, item.position.y);
        group.add(body);
        return group;
    }
    const size = item.type === "radiator"
        ? { x: 0.8, y: 0.5, z: 0.08, baseY: 0.28 }
        : item.type === "boiler"
            ? { x: 0.55, y: 1, z: 0.42, baseY: 0.5 }
            : item.type === "heat_exchanger"
                ? { x: 0.92, y: 0.52, z: 0.4, baseY: 0.34 }
                : item.type === "elevator"
                    ? { x: 0.28, y: 0.72, z: 0.28, baseY: 0.26 }
                    : item.type === "expansion_tank"
                        ? { x: 0.56, y: 0.24, z: 0.24, baseY: 0.38 }
                        : item.type === "dirt_separator"
                            ? { x: 0.32, y: 0.62, z: 0.32, baseY: 0.22 }
                            : item.type === "ahu"
                                ? { x: 1.1, y: 0.55, z: 0.55, baseY: 0.38 }
                                : item.type === "diffuser"
                                    ? { x: 0.24, y: 0.03, z: 0.24, baseY: 2.72 }
                                    : item.type === "sensor"
                                        ? { x: 0.1, y: 0.1, z: 0.06, baseY: 1.6 }
                                        : { x: 0.75, y: 0.28, z: 0.2, baseY: 0.22 };
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.set(item.position.x, levelElevation + size.baseY, item.position.y);
    group.add(mesh);
    return group;
}
function extractBoundsFromObject(root) {
    const box = createBox3().setFromObject(root);
    if (box.isEmpty()) {
        return null;
    }
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return normalizeStablePreviewBounds(center, size);
}
function getStableFitRoot(shellRoot, contentRoot) {
    if (shellRoot && shellRoot.children.length > 0) {
        return shellRoot;
    }
    return contentRoot;
}
export function getStablePreviewVisibilityStats(model, activeLevelId) {
    const doorsCount = model.doors.filter((door) => {
        if (!activeLevelId) {
            return true;
        }
        return model.walls.find((wall) => wall.id === door.anchor.wallId)?.levelId === activeLevelId;
    }).length;
    const windowsCount = model.windows.filter((windowItem) => {
        if (!activeLevelId) {
            return true;
        }
        return model.walls.find((wall) => wall.id === windowItem.anchor.wallId)?.levelId === activeLevelId;
    }).length;
    const matchLevel = (items) => (activeLevelId ? items.filter((item) => item.levelId === activeLevelId) : items);
    return {
        roomCount: matchLevel(model.rooms).length,
        wallCount: matchLevel(model.walls).length,
        openingCount: doorsCount + windowsCount,
        roofCount: matchLevel(model.roofs ?? []).length,
        slabCount: matchLevel(model.floorSlabs ?? []).length,
        pipeCount: matchLevel(model.pipes).length,
        ductCount: matchLevel(model.ducts).length,
        equipmentCount: matchLevel(model.equipment).length,
        sensorCount: matchLevel(model.sensors).length,
    };
}
export function resolveStablePreviewLevelId(model, activeLevelId) {
    if (!activeLevelId) {
        return null;
    }
    const stats = getStablePreviewVisibilityStats(model, activeLevelId);
    return stats.roomCount > 0 || stats.wallCount > 0 || stats.roofCount > 0 || stats.slabCount > 0 ? activeLevelId : null;
}
function buildOpeningPoint(wallsById, opening) {
    if (!opening.anchor.wallId) {
        return null;
    }
    const wall = wallsById.get(opening.anchor.wallId);
    if (!wall) {
        return null;
    }
    const offset = anchorToOffset(opening.anchor, wall);
    const point = resolveWallPoint(wall, offset);
    const dx = wall.b.x - wall.a.x;
    const dz = wall.b.y - wall.a.y;
    const angle = -Math.atan2(dz, dx);
    return { point, angle, wall };
}
export const Build3DStablePreview = React.forwardRef(({ model, activeLevelId, selection, viewer }, forwardedRef) => {
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const contentRef = useRef(null);
    const animationFrameRef = useRef(0);
    const fitRafRef = useRef(null);
    const resizeObserverRef = useRef(null);
    const currentSelectionRef = useRef(selection);
    const shellRootRef = useRef(null);
    const systemsRootRef = useRef(null);
    const gridRef = useRef(null);
    const contentSignatureRef = useRef("");
    const hasInitialFitRef = useRef(false);
    const lastFitModelKeyRef = useRef("");
    const containerSizeRef = useRef({ width: 0, height: 0 });
    const homeViewRef = useRef(null);
    useLayoutEffect(() => {
        currentSelectionRef.current = selection;
    }, [selection]);
    const renderGeometry = useMemo(() => buildGeometryRenderModel(model), [model]);
    const resolvedLevelId = useMemo(() => resolveStablePreviewLevelId(model, activeLevelId), [model, activeLevelId]);
    const visibilityStats = useMemo(() => getStablePreviewVisibilityStats(model, resolvedLevelId), [model, resolvedLevelId]);
    const logStableFit = (...args) => {
        if (DEBUG_STABLE_3D_FIT) {
            console.info("[stable-3d-fit]", ...args);
        }
    };
    const fitToShell = (reason, options) => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        const fitRoot = getStableFitRoot(shellRootRef.current, contentRef.current);
        if (!camera || !controls || !fitRoot) {
            return;
        }
        const bounds = extractBoundsFromObject(fitRoot);
        if (!bounds) {
            applyCameraFrame(camera, controls, {
                position: { x: DEFAULT_CAMERA_POSITION.x, y: DEFAULT_CAMERA_POSITION.y, z: DEFAULT_CAMERA_POSITION.z },
                target: { x: DEFAULT_TARGET.x, y: DEFAULT_TARGET.y, z: DEFAULT_TARGET.z },
                near: 0.1,
                far: 1000,
            });
            rendererRef.current?.render(sceneRef.current, camera);
            return;
        }
        const frame = options?.topView
            ? calculateTopViewCameraForBounds(bounds, camera.aspect, readCameraFov(camera))
            : calculateFitCameraForBounds(bounds, camera.aspect, readCameraFov(camera));
        logStableFit(reason, {
            bounds,
            frame,
            container: containerSizeRef.current,
        });
        applyCameraFrame(camera, controls, frame);
        if (options?.updateHome ?? true) {
            homeViewRef.current = {
                position: { ...frame.position },
                target: { ...frame.target },
                near: frame.near,
                far: frame.far,
            };
        }
        hasInitialFitRef.current = true;
        rendererRef.current?.render(sceneRef.current, camera);
    };
    const scheduleInitialFit = (reason) => {
        if (fitRafRef.current !== null) {
            window.cancelAnimationFrame(fitRafRef.current);
        }
        fitRafRef.current = window.requestAnimationFrame(() => {
            fitRafRef.current = null;
            if (!containerSizeRef.current.width || !containerSizeRef.current.height || hasInitialFitRef.current) {
                return;
            }
            fitToShell(reason);
        });
    };
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(canvas.clientWidth || 300, canvas.clientHeight || 200, false);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf3f6fa);
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        camera.position.copy(DEFAULT_CAMERA_POSITION);
        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.enablePan = true;
        controls.enableRotate = true;
        controls.enableZoom = true;
        controls.target.copy(DEFAULT_TARGET);
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const light = new THREE.DirectionalLight(0xffffff, 0.85);
        light.position.set(12, 18, 10);
        scene.add(light);
        const grid = new THREE.GridHelper(24, 24, 0xe2e8f0, 0xf1f5f9);
        const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
        gridMaterials.forEach((material) => {
            material.transparent = true;
            material.opacity = 0.38;
        });
        scene.add(grid);
        const content = new THREE.Group();
        scene.add(content);
        const shellRoot = new THREE.Group();
        const systemsRoot = new THREE.Group();
        content.add(shellRoot);
        content.add(systemsRoot);
        const resize = () => {
            const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 300;
            const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 200;
            containerSizeRef.current = { width, height };
            renderer.setSize(width, height, false);
            camera.aspect = width / Math.max(height, 1);
            camera.updateProjectionMatrix();
            if (!hasInitialFitRef.current) {
                scheduleInitialFit("initial");
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
        const animate = () => {
            controls.update();
            renderer.render(scene, camera);
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
        gridRef.current = grid;
        resizeObserverRef.current = resizeObserver;
        return () => {
            if (animationFrameRef.current) {
                window.cancelAnimationFrame(animationFrameRef.current);
            }
            if (fitRafRef.current !== null) {
                window.cancelAnimationFrame(fitRafRef.current);
            }
            resizeObserver.disconnect();
            canvas.removeEventListener("wheel", preventViewportScroll);
            canvas.removeEventListener("contextmenu", preventContextMenu);
            controls.dispose();
            renderer.dispose();
            scene.traverse((object) => {
                const mesh = object;
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
                if (mesh.material) {
                    const material = mesh.material;
                    if (Array.isArray(material)) {
                        material.forEach((entry) => entry.dispose());
                    }
                    else {
                        material.dispose();
                    }
                }
            });
            rendererRef.current = null;
            sceneRef.current = null;
            cameraRef.current = null;
            controlsRef.current = null;
            contentRef.current = null;
            shellRootRef.current = null;
            systemsRootRef.current = null;
            gridRef.current = null;
            resizeObserverRef.current = null;
            homeViewRef.current = null;
        };
    }, []);
    useEffect(() => {
        const content = contentRef.current;
        const shellRoot = shellRootRef.current;
        const systemsRoot = systemsRootRef.current;
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        const grid = gridRef.current;
        if (!content || !shellRoot || !systemsRoot || !camera || !controls) {
            return;
        }
        while (shellRoot.children.length) {
            shellRoot.remove(shellRoot.children[0]);
        }
        while (systemsRoot.children.length) {
            systemsRoot.remove(systemsRoot.children[0]);
        }
        const levelMap = new Map(model.levels.map((level) => [level.id, level]));
        const wallsById = new Map(model.walls.map((wall) => [wall.id, wall]));
        const visibleSelection = currentSelectionRef.current;
        const wallMaterial = viewer.transparentWalls ? WALL_TRANSPARENT_MATERIAL : WALL_MATERIAL;
        if (viewer.showRooms) {
            renderGeometry.roomVolumes.forEach((room) => {
                if (resolvedLevelId && room.levelId !== resolvedLevelId) {
                    return;
                }
                const levelElevation = levelMap.get(room.levelId)?.elevation_m ?? 0;
                const shape = buildShape(room.polygon);
                if (!shape) {
                    return;
                }
                const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }), visibleSelection?.kind === "room" && visibleSelection.id === room.roomId ? HIGHLIGHT_MATERIAL : ROOM_MATERIAL);
                mesh.rotation.x = Math.PI / 2;
                mesh.position.y = levelElevation + 0.01 + 0.04;
                shellRoot.add(mesh);
            });
        }
        if (viewer.showWalls) {
            renderGeometry.walls.forEach(({ wall }) => {
                if (resolvedLevelId && wall.levelId !== resolvedLevelId) {
                    return;
                }
                const levelElevation = levelMap.get(wall.levelId)?.elevation_m ?? 0;
                addBoxBetween(shellRoot, wall.a, wall.b, wall.thickness_m, wall.height_m, levelElevation + wall.height_m / 2, visibleSelection?.kind === "wall" && visibleSelection.id === wall.id ? HIGHLIGHT_MATERIAL : wallMaterial);
            });
        }
        if (viewer.showOpenings) {
            model.doors.forEach((door) => {
                const data = buildOpeningPoint(wallsById, door);
                if (!data) {
                    return;
                }
                if (resolvedLevelId && data.wall.levelId !== resolvedLevelId) {
                    return;
                }
                const levelElevation = levelMap.get(data.wall.levelId)?.elevation_m ?? 0;
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(door.width_m, door.height_m, Math.max(data.wall.thickness_m * 0.55, 0.08)), visibleSelection?.kind === "door" && visibleSelection.id === door.id ? HIGHLIGHT_MATERIAL : OPENING_MATERIAL);
                mesh.rotation.y = data.angle;
                mesh.position.set(data.point.x, levelElevation + door.height_m / 2, data.point.y);
                shellRoot.add(mesh);
            });
            model.windows.forEach((windowItem) => {
                const data = buildOpeningPoint(wallsById, windowItem);
                if (!data) {
                    return;
                }
                if (resolvedLevelId && data.wall.levelId !== resolvedLevelId) {
                    return;
                }
                const levelElevation = levelMap.get(data.wall.levelId)?.elevation_m ?? 0;
                const sill = windowItem.sill_m ?? 0.9;
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(windowItem.width_m, windowItem.height_m, Math.max(data.wall.thickness_m * 0.4, 0.06)), visibleSelection?.kind === "window" && visibleSelection.id === windowItem.id ? HIGHLIGHT_MATERIAL : OPENING_MATERIAL);
                mesh.rotation.y = data.angle;
                mesh.position.set(data.point.x, levelElevation + sill + windowItem.height_m / 2, data.point.y);
                shellRoot.add(mesh);
            });
        }
        renderGeometry.roofs.forEach((roof) => {
            if (resolvedLevelId && roof.levelId !== resolvedLevelId) {
                return;
            }
            const shape = buildShape(roof.boundary);
            if (!shape) {
                return;
            }
            const roofDepth = Math.max(roof.thickness_m, 0.04);
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: roofDepth, bevelEnabled: false });
            const mesh = new THREE.Mesh(geometry, visibleSelection?.kind === "roof" && visibleSelection.id === roof.id ? HIGHLIGHT_MATERIAL : ROOF_MATERIAL);
            mesh.rotation.x = Math.PI / 2;
            mesh.position.y = roof.elevationBase_m + roofDepth;
            shellRoot.add(mesh);
        });
        renderGeometry.floorSlabs.forEach((slab) => {
            if (resolvedLevelId && slab.levelId !== resolvedLevelId) {
                return;
            }
            const shape = buildShape(slab.boundary);
            if (!shape) {
                return;
            }
            const slabDepth = Math.max(slab.thickness_m, 0.04);
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: slabDepth, bevelEnabled: false });
            const mesh = new THREE.Mesh(geometry, visibleSelection?.kind === "slab" && visibleSelection.id === slab.id ? HIGHLIGHT_MATERIAL : SLAB_MATERIAL);
            mesh.rotation.x = Math.PI / 2;
            mesh.position.y = slab.elevation_m + slabDepth;
            shellRoot.add(mesh);
        });
        if (viewer.showNetworks) {
            model.pipes.forEach((pipe) => {
                if (resolvedLevelId && pipe.levelId !== resolvedLevelId) {
                    return;
                }
                const levelElevation = levelMap.get(pipe.levelId)?.elevation_m ?? 0;
                pipe.path.slice(1).forEach((point, index) => {
                    const start = pipe.path[index];
                    const from = new THREE.Vector3(start.x, levelElevation + 0.22, start.y);
                    const to = new THREE.Vector3(point.x, levelElevation + 0.22, point.y);
                    addCylinderBetween(systemsRoot, from, to, Math.max(pipe.diameter_mm / 2000, 0.018), pipe.type === "heating_return" ? PIPE_RETURN_MATERIAL : PIPE_SUPPLY_MATERIAL);
                });
            });
            model.ducts.forEach((duct) => {
                if (resolvedLevelId && duct.levelId !== resolvedLevelId) {
                    return;
                }
                const levelElevation = levelMap.get(duct.levelId)?.elevation_m ?? 0;
                const width = Math.max(0.12, (duct.section.width_mm ?? duct.section.diameter_mm ?? 300) / 1000);
                const height = Math.max(0.08, (duct.section.height_mm ?? duct.section.diameter_mm ?? 220) / 1000);
                duct.path.slice(1).forEach((point, index) => {
                    addBoxBetween(systemsRoot, duct.path[index], point, width, height, levelElevation + 2.3, DUCT_MATERIAL);
                });
            });
        }
        if (viewer.showEquipment) {
            model.equipment.forEach((item) => {
                if (resolvedLevelId && item.levelId !== resolvedLevelId) {
                    return;
                }
                const levelElevation = levelMap.get(item.levelId)?.elevation_m ?? 0;
                const visual = buildSimpleEquipment(item, levelElevation);
                systemsRoot.add(visual);
            });
            model.sensors.forEach((sensor) => {
                if (resolvedLevelId && sensor.levelId !== resolvedLevelId) {
                    return;
                }
                const levelElevation = levelMap.get(sensor.levelId)?.elevation_m ?? 0;
                const marker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), SENSOR_MATERIAL);
                marker.position.set(sensor.position.x, levelElevation + 1.6, sensor.position.y);
                systemsRoot.add(marker);
            });
        }
        const signature = [
            resolvedLevelId ?? "all-levels",
            visibilityStats.roomCount,
            visibilityStats.wallCount,
            visibilityStats.openingCount,
            visibilityStats.roofCount,
            visibilityStats.slabCount,
        ].join(":");
        if (lastFitModelKeyRef.current !== signature) {
            lastFitModelKeyRef.current = signature;
            contentSignatureRef.current = signature;
            hasInitialFitRef.current = false;
            homeViewRef.current = null;
        }
        const fitRoot = getStableFitRoot(shellRoot, content);
        const bounds = fitRoot ? extractBoundsFromObject(fitRoot) : null;
        if (grid && bounds) {
            const layout = calculateGridLayoutForBounds(bounds);
            grid.position.set(layout.position.x, layout.position.y, layout.position.z);
            grid.scale.set(layout.size / 24, 1, layout.size / 24);
        }
        if (!hasInitialFitRef.current) {
            scheduleInitialFit(contentSignatureRef.current ? "model-change" : "initial");
        }
        controls.update();
        rendererRef.current?.render(sceneRef.current, camera);
    }, [model, renderGeometry, resolvedLevelId, selection, viewer, visibilityStats]);
    useImperativeHandle(forwardedRef, () => ({
        getCanvas: () => canvasRef.current,
        zoomToFit: () => {
            fitToShell("manual-focus");
        },
        resetView: () => {
            if (cameraRef.current && controlsRef.current) {
                const homeView = homeViewRef.current;
                if (homeView) {
                    applyCameraFrame(cameraRef.current, controlsRef.current, homeView);
                }
                else {
                    fitToShell("reset");
                    return;
                }
                rendererRef.current?.render(sceneRef.current, cameraRef.current);
            }
        },
        setTopView: () => {
            fitToShell("top-view", { topView: true, updateHome: false });
        },
        focusSelection: () => {
            fitToShell("manual-focus", { updateHome: false });
        },
    }), []);
    return _jsx("canvas", { ref: canvasRef, className: "block h-full w-full touch-none overscroll-contain" });
});
Build3DStablePreview.displayName = "Build3DStablePreview";
export default Build3DStablePreview;
