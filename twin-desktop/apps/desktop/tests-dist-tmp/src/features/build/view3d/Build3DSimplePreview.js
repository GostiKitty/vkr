import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildSimple3DModel, } from "./buildSimple3DModel";
import { calculateSimplePreviewCamera, calculateSimplePreviewGrid } from "./simplePreviewMath";
const ROOM_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.34, roughness: 0.96, metalness: 0.01 });
const WALL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.88, metalness: 0.03 });
const OPENING_WINDOW_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.92, roughness: 0.45, metalness: 0.04 });
const OPENING_DOOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.95, roughness: 0.6, metalness: 0.04 });
const ROOF_FLAT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.62, roughness: 0.90, metalness: 0.03 });
const ROOF_PITCHED_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xb45309, transparent: true, opacity: 0.86, roughness: 0.80, metalness: 0.02 });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ROOF_MATERIAL = ROOF_FLAT_MATERIAL;
const SLAB_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.42, roughness: 0.95, metalness: 0.02 });
const SUPPLY_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.65, metalness: 0.04 });
const RETURN_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.65, metalness: 0.04 });
const DUCT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.4, roughness: 0.75, metalness: 0.03 });
const EQUIPMENT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.74, metalness: 0.04 });
const SENSOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.7, metalness: 0.03 });
const HIGHLIGHT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.08, roughness: 0.62, metalness: 0.04 });
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
    mesh.position.set((a.x + b.x) * 0.5, centerY, (a.y + b.y) * 0.5);
    mesh.rotation.y = -Math.atan2(dz, dx);
    root.add(mesh);
}
function addCylinderBetween(root, start, end, radius, material) {
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
    const length = direction.length();
    if (length < 1e-4) {
        return;
    }
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    root.add(mesh);
}
function getSelectionMaterial(selection, kind, id, material) {
    return selection?.kind === kind && selection.id === id ? HIGHLIGHT_MATERIAL : material;
}
function mixColor(a, b, t) {
    const ratio = Math.min(Math.max(t, 0), 1);
    const colorA = new THREE.Color(a);
    const colorB = new THREE.Color(b);
    const red = Math.round((colorA.r + (colorB.r - colorA.r) * ratio) * 255);
    const green = Math.round((colorA.g + (colorB.g - colorA.g) * ratio) * 255);
    const blue = Math.round((colorA.b + (colorB.b - colorA.b) * ratio) * 255);
    return new THREE.Color((red << 16) | (green << 8) | blue);
}
function createTemperatureMaterial(surface, summary) {
    const min = summary?.min_C ?? surface.temperature_C;
    const max = summary?.max_C ?? surface.temperature_C;
    const range = Math.max(max - min, 0.001);
    const ratio = (surface.temperature_C - min) / range;
    const color = mixColor(0x2563eb, 0xf97316, ratio);
    return new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: surface.sourceType === "wall" ? 0.5 : 0.58,
        roughness: 0.7,
        metalness: 0.02,
        depthWrite: false,
    });
}
/**
 * Строит меш скатной крыши в форме вальмовой (hip-roof):
 * - каждая точка контура имеет высоту, пропорциональную расстоянию до конька
 * - конёк проходит вдоль оси, перпендикулярной slope.directionDeg
 * - скаты симметрично опускаются к краям → нет разрыва между крышей и стенами
 */
function buildPitchedRoofMesh(boundaryIn, elevationBase, slope, material) {
    if (boundaryIn.length < 3) {
        return new THREE.Mesh(new THREE.BufferGeometry(), material);
    }
    // Единичный вектор направления уклона (вниз от конька)
    const slopeDirRad = (slope.directionDeg * Math.PI) / 180;
    const sdx = Math.cos(slopeDirRad);
    const sdz = Math.sin(slopeDirRad);
    // Центроид полигона контура
    const cx = boundaryIn.reduce((s, p) => s + p.x, 0) / boundaryIn.length;
    const cz = boundaryIn.reduce((s, p) => s + p.y, 0) / boundaryIn.length;
    // Проекция каждой вершины на направление уклона (от центроида)
    const projections = boundaryIn.map((p) => (p.x - cx) * sdx + (p.y - cz) * sdz);
    const maxAbsProj = Math.max(...projections.map((v) => Math.abs(v)), 0.5);
    // Симметричный профиль: высота максимальна на коньке (proj≈0), минимальна у карниза
    const rawHeights = boundaryIn.map((_, i) => elevationBase + slope.risePerMeter * (maxAbsProj - Math.abs(projections[i])));
    // Проверяем порядок обхода полигона, THREE.ShapeUtils ожидает CCW
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
    // ── Верхняя скатная поверхность ──────────────────────────────────────────
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
    // ── Боковые щипцовые / вальмовые грани ───────────────────────────────────
    for (let i = 0; i < boundary.length; i++) {
        const ai = i;
        const bi = (i + 1) % boundary.length;
        const ha = heights[ai];
        const hb = heights[bi];
        const pa = boundary[ai];
        const pb = boundary[bi];
        // Карнизный свес — обе точки на уровне основания, стенка не нужна
        if (ha - elevationBase < 0.02 && hb - elevationBase < 0.02)
            continue;
        // Нормаль грани — наружу (перпендикулярно ребру в горизонтальной плоскости)
        const ex = pb.x - pa.x;
        const ez = pb.y - pa.y;
        const elen = Math.hypot(ex, ez) || 1;
        const wnx = -ez / elen;
        const wnz = ex / elen;
        // Два треугольника квада (pa-нижн, pb-нижн, pb-верхн, pa-верхн)
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
function createOpeningMesh(opening, selection) {
    const baseMaterial = opening.type === "window"
        ? getSelectionMaterial(selection, "window", opening.id, OPENING_WINDOW_MATERIAL)
        : getSelectionMaterial(selection, "door", opening.id, OPENING_DOOR_MATERIAL);
    const geometry = new THREE.BoxGeometry(opening.width_m, opening.height_m, opening.depth_m);
    const mesh = new THREE.Mesh(geometry, baseMaterial);
    mesh.rotation.y = opening.rotationY_rad;
    mesh.position.set(opening.center.x, opening.center.y, opening.center.z);
    return mesh;
}
export const Build3DSimplePreview = React.forwardRef(({ model, activeLevelId, selection, showNetworks = true, showEquipment = true, showOpenings = true, thermalField = null, showTemperature = false, showWallTemperature = false, }, forwardedRef) => {
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const contentRef = useRef(null);
    const shellRootRef = useRef(null);
    const gridRef = useRef(null);
    const animationFrameRef = useRef(0);
    const resizeObserverRef = useRef(null);
    const fitRafRef = useRef(null);
    const homeModeRef = useRef("iso");
    const hasInitialFitRef = useRef(false);
    const lastModelKeyRef = useRef("");
    const containerSizeRef = useRef({ width: 0, height: 0 });
    const simpleModel = useMemo(() => buildSimple3DModel(model, activeLevelId, {
        showNetworks,
        showEquipment,
        showTemperature,
        showWallTemperature,
        thermalField,
    }), [activeLevelId, model, showEquipment, showNetworks, showTemperature, showWallTemperature, thermalField]);
    const applyCameraMode = (mode, setHome = true) => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) {
            return;
        }
        const frame = calculateSimplePreviewCamera(simpleModel.bounds, mode);
        camera.position.set(frame.position.x, frame.position.y, frame.position.z);
        camera.near = frame.near;
        camera.far = frame.far;
        camera.updateProjectionMatrix();
        controls.target.set(frame.target.x, frame.target.y, frame.target.z);
        controls.update();
        rendererRef.current?.render(sceneRef.current, camera);
        if (setHome) {
            homeModeRef.current = mode;
        }
        hasInitialFitRef.current = true;
    };
    const scheduleInitialFit = () => {
        if (fitRafRef.current !== null) {
            window.cancelAnimationFrame(fitRafRef.current);
        }
        fitRafRef.current = window.requestAnimationFrame(() => {
            fitRafRef.current = null;
            if (!containerSizeRef.current.width || !containerSizeRef.current.height || hasInitialFitRef.current || simpleModel.bounds.empty) {
                return;
            }
            applyCameraMode("iso", true);
        });
    };
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf4f7fa);
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
        const controls = new OrbitControls(camera, canvas);
        controls.enableRotate = true;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.enableDamping = false;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        scene.add(new THREE.AmbientLight(0xffffff, 0.92));
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.88);
        keyLight.position.set(18, 22, 14);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.36);
        fillLight.position.set(-10, 8, -6);
        scene.add(fillLight);
        const grid = new THREE.GridHelper(20, 20, 0xe2e8f0, 0xf1f5f9);
        const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
        materials.forEach((material) => {
            material.transparent = true;
            material.opacity = 0.18;
        });
        scene.add(grid);
        const content = new THREE.Group();
        const shellRoot = new THREE.Group();
        content.add(shellRoot);
        scene.add(content);
        const resize = () => {
            const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
            const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 220;
            containerSizeRef.current = { width, height };
            renderer.setSize(width, height, false);
            camera.aspect = width / Math.max(height, 1);
            camera.updateProjectionMatrix();
            if (!hasInitialFitRef.current) {
                scheduleInitialFit();
            }
        };
        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        const preventContextMenu = (event) => event.preventDefault();
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
            canvas.removeEventListener("contextmenu", preventContextMenu);
            controls.dispose();
            renderer.dispose();
            scene.traverse((object) => {
                const mesh = object;
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
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
        const grid = gridRef.current;
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (!content || !shellRoot || !grid || !renderer || !scene || !camera) {
            return;
        }
        while (content.children.length) {
            content.remove(content.children[0]);
        }
        content.add(shellRoot);
        while (shellRoot.children.length) {
            shellRoot.remove(shellRoot.children[0]);
        }
        simpleModel.simpleRooms.forEach((room) => {
            const shape = buildShape(room.boundary);
            if (!shape) {
                return;
            }
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
            const mesh = new THREE.Mesh(geometry, getSelectionMaterial(selection, "room", room.id, ROOM_MATERIAL));
            mesh.rotation.x = Math.PI / 2;
            mesh.position.y = room.elevation_m + 0.015 + 0.02;
            shellRoot.add(mesh);
        });
        simpleModel.simpleWalls.forEach((wall) => {
            addBoxBetween(shellRoot, wall.start, wall.end, Math.max(wall.thickness_m, 0.08), Math.max(wall.height_m, 2.4), wall.elevation_m + wall.height_m * 0.5, getSelectionMaterial(selection, "wall", wall.id, WALL_MATERIAL));
        });
        if (showOpenings) {
            simpleModel.simpleDoors.forEach((door) => {
                shellRoot.add(createOpeningMesh(door, selection));
            });
            simpleModel.simpleWindows.forEach((windowItem) => {
                shellRoot.add(createOpeningMesh(windowItem, selection));
            });
        }
        simpleModel.simpleRoofs.forEach((roof) => {
            if (roof.kind === "pitched" && roof.slope) {
                // Скатная крыша: вальмовая геометрия с симметричным коньком
                const mesh = buildPitchedRoofMesh(roof.boundary, roof.elevation_m, roof.slope, ROOF_PITCHED_MATERIAL);
                shellRoot.add(mesh);
            }
            else {
                // Плоская крыша: экструзия-плита как прежде
                const shape = buildShape(roof.boundary);
                if (!shape) {
                    return;
                }
                const roofDepth = Math.max(roof.thickness_m, 0.05);
                const geometry = new THREE.ExtrudeGeometry(shape, { depth: roofDepth, bevelEnabled: false });
                const mesh = new THREE.Mesh(geometry, ROOF_FLAT_MATERIAL);
                mesh.rotation.x = Math.PI / 2;
                mesh.position.y = roof.elevation_m + roofDepth;
                shellRoot.add(mesh);
            }
        });
        simpleModel.simpleSlabs.forEach((slab) => {
            const shape = buildShape(slab.boundary);
            if (!shape) {
                return;
            }
            const slabDepth = Math.max(slab.thickness_m, 0.05);
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: slabDepth, bevelEnabled: false });
            const mesh = new THREE.Mesh(geometry, SLAB_MATERIAL);
            mesh.rotation.x = Math.PI / 2;
            mesh.position.y = slab.elevation_m + slabDepth;
            shellRoot.add(mesh);
        });
        simpleModel.simpleTemperatureSurfaces.forEach((surface) => {
            const material = createTemperatureMaterial(surface, simpleModel.temperatureSummary);
            if (surface.sourceType === "room" && surface.boundary) {
                const shape = buildShape(surface.boundary);
                if (!shape) {
                    material.dispose();
                    return;
                }
                const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.x = Math.PI / 2;
                const room = simpleModel.simpleRooms.find((entry) => entry.id === surface.id.replace("room:", ""));
                mesh.position.y = (room?.elevation_m ?? 0) + 0.03 + 0.015;
                shellRoot.add(mesh);
                return;
            }
            if (surface.sourceType === "wall" && surface.wall) {
                addBoxBetween(shellRoot, surface.wall.start, surface.wall.end, Math.max(Math.min(surface.wall.thickness_m * 0.16, 0.07), 0.03), Math.max(surface.wall.height_m - 0.05, 0.4), surface.wall.elevation_m + surface.wall.height_m * 0.5, material);
                return;
            }
            material.dispose();
        });
        simpleModel.simplePipes.forEach((pipe) => {
            pipe.path.slice(1).forEach((point, index) => {
                const start = pipe.path[index];
                addCylinderBetween(content, new THREE.Vector3(start.x, start.y, start.z), new THREE.Vector3(point.x, point.y, point.z), Math.max(pipe.diameter_m * 0.5, 0.014), pipe.colorRole === "return" ? RETURN_MATERIAL : SUPPLY_MATERIAL);
            });
        });
        simpleModel.simpleDucts.forEach((duct) => {
            duct.path.slice(1).forEach((point, index) => {
                const start = duct.path[index];
                addBoxBetween(content, { x: start.x, y: start.z }, { x: point.x, y: point.z }, duct.width_m, duct.height_m, start.y, DUCT_MATERIAL);
            });
        });
        simpleModel.simpleEquipment.forEach((item) => {
            const material = getSelectionMaterial(selection, "equipment", item.id, EQUIPMENT_MATERIAL);
            const geometry = item.type === "pump"
                ? new THREE.CylinderGeometry(0.08, 0.08, 0.22, 8)
                : item.type === "radiator"
                    ? new THREE.BoxGeometry(0.8, 0.48, 0.08)
                    : item.type === "boiler"
                        ? new THREE.BoxGeometry(0.55, 0.95, 0.42)
                        : new THREE.BoxGeometry(0.28, 0.28, 0.28);
            const mesh = new THREE.Mesh(geometry, material);
            if (item.type === "pump") {
                mesh.rotation.z = Math.PI / 2;
            }
            mesh.position.set(item.position.x, item.position.y, item.position.z);
            content.add(mesh);
        });
        simpleModel.simpleSensors.forEach((sensor) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), getSelectionMaterial(selection, "sensor", sensor.id, SENSOR_MATERIAL));
            mesh.position.set(sensor.position.x, sensor.position.y, sensor.position.z);
            content.add(mesh);
        });
        const gridLayout = calculateSimplePreviewGrid(simpleModel.bounds);
        grid.position.set(gridLayout.center.x, simpleModel.bounds.empty ? 0 : simpleModel.bounds.minY, gridLayout.center.z);
        grid.scale.set(Math.max(gridLayout.size / 20, 1), 1, Math.max(gridLayout.size / 20, 1));
        const modelKey = [
            simpleModel.levelId ?? "all-levels",
            simpleModel.simpleRooms.length,
            simpleModel.simpleWalls.length,
            simpleModel.simpleWindows.length,
            simpleModel.simpleDoors.length,
            simpleModel.simpleRoofs.length,
            simpleModel.simpleSlabs.length,
            simpleModel.simpleTemperatureSurfaces.length,
        ].join(":");
        if (lastModelKeyRef.current !== modelKey) {
            lastModelKeyRef.current = modelKey;
            hasInitialFitRef.current = false;
        }
        if (!hasInitialFitRef.current && !simpleModel.bounds.empty) {
            scheduleInitialFit();
        }
        renderer.render(scene, camera);
    }, [selection, showOpenings, simpleModel]);
    useImperativeHandle(forwardedRef, () => ({
        getCanvas: () => canvasRef.current,
        focus: () => applyCameraMode("iso", true),
        top: () => applyCameraMode("top", false),
        reset: () => applyCameraMode(homeModeRef.current, false),
        zoomToFit: () => applyCameraMode("iso", true),
        resetView: () => applyCameraMode(homeModeRef.current, false),
        setTopView: () => applyCameraMode("top", false),
        focusSelection: () => applyCameraMode("iso", false),
    }), [simpleModel.bounds]);
    const showTemperatureWarning = (showTemperature || showWallTemperature) &&
        (!simpleModel.temperatureSummary || simpleModel.simpleTemperatureSurfaces.length === 0);
    return (_jsxs("div", { className: "relative h-full w-full overflow-hidden touch-none", children: [_jsx("canvas", { ref: canvasRef, className: "block h-full w-full touch-none" }), simpleModel.bounds.empty ? (_jsx("div", { className: "pointer-events-none absolute inset-x-4 top-1/2 z-10 -translate-y-1/2", children: _jsxs("div", { className: "ui-overlay mx-auto max-w-sm px-4 py-3 text-center", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-slate-400", children: "3D" }), _jsx("p", { className: "mt-2 text-sm font-semibold text-slate-900", children: "3D-\u043C\u043E\u0434\u0435\u043B\u044C \u043D\u0435 \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u0430" }), _jsx("p", { className: "mt-1 text-sm text-slate-600", children: "\u0412 \u043C\u043E\u0434\u0435\u043B\u0438 \u043D\u0435\u0442 \u0441\u0442\u0435\u043D \u0438\u043B\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439 \u0434\u043B\u044F 3D-\u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u044F." })] }) })) : null, simpleModel.temperatureSummary && simpleModel.simpleTemperatureSurfaces.length > 0 ? (_jsx("div", { className: "pointer-events-none absolute bottom-3 left-3 z-10", children: _jsxs("div", { className: "ui-overlay max-w-[15rem] px-3 py-2.5", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430" }), _jsxs("p", { className: "mt-1 text-sm font-semibold text-slate-900", children: [simpleModel.temperatureSummary.min_C.toFixed(1), "\u2013", simpleModel.temperatureSummary.max_C.toFixed(1), " \u00B0C"] }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["\u0421\u0440\u0435\u0434\u043D\u044F\u044F ", simpleModel.temperatureSummary.average_C.toFixed(1), " \u00B0C"] })] }) })) : null, showTemperatureWarning ? (_jsx("div", { className: "pointer-events-none absolute bottom-3 left-3 z-10", children: _jsx("div", { className: "ui-overlay max-w-[16rem] px-3 py-2.5 text-xs text-slate-600", children: "\u041D\u0435\u0442 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445." }) })) : null] }));
});
Build3DSimplePreview.displayName = "Build3DSimplePreview";
export default Build3DSimplePreview;
