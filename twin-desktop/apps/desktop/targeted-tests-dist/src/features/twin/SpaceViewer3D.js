import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmbientLight, BoxGeometry, Color, DirectionalLight, Group, Mesh, MeshStandardMaterial, MOUSE, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer, } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useTwinStore } from "../../entities/twin/twin.store";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { formatTemperature, temperatureToColor } from "./twin.theme";
import { TemperatureScaleLegend } from "../../shared/ui";
import { useTheme } from "../../shared/theme";
export function SpaceViewer3D({ heatmap = false, height = 360, caption = "3D вид", showLegend = false, showFitControl = true, }) {
    const { resolved: theme } = useTheme();
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const groupRef = useRef(null);
    const sceneRef = useRef(null);
    const meshesRef = useRef(new Map());
    const pointer = useRef(new Vector2());
    const raycaster = useRef(new Raycaster());
    const baseGeometryRef = useRef(null);
    const displayedTempsRef = useRef({});
    const targetTempsRef = useRef({});
    const selectedSpaceRef = useRef(null);
    const animationFrameRef = useRef(0);
    const [levelFilter, setLevelFilter] = useState(null);
    const levelFilterRef = useRef(null);
    const spaceInstances = useTwinStore((state) => state.spaceInstances);
    const selectSpace = useTwinStore((state) => state.selectSpace);
    const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
    const frames = useTwinStore((state) => state.simulationFrames);
    const timeIndex = useTwinStore((state) => state.timeIndex);
    const setTimeIndex = useTwinStore((state) => state.setTimeIndex);
    const updateMeshVisuals = useCallback(() => {
        const meshes = meshesRef.current;
        const targets = targetTempsRef.current;
        const displayed = displayedTempsRef.current;
        const selectedId = selectedSpaceRef.current;
        const filterLevel = levelFilterRef.current;
        meshes.forEach((mesh, id) => {
            const prev = displayed[id] ?? targets[id] ?? 20;
            const target = targets[id] ?? prev;
            const eased = prev + (target - prev) * 0.14;
            displayed[id] = eased;
            const thermalColor = temperatureToColor(eased);
            const mixBase = theme === "dark" ? "#5a6574" : "#94a3b8";
            const visualColor = heatmap ? thermalColor : mixColor(mixBase, thermalColor, 0.55);
            const material = mesh.material;
            material.color.set(visualColor);
            material.transparent = true;
            const meshLevel = mesh.userData.level;
            const dimmed = filterLevel !== null && meshLevel !== filterLevel;
            material.opacity = dimmed ? 0.07 : 0.94;
            if (selectedId === id) {
                material.emissive.set(theme === "dark" ? "#9cb87a" : "#c2410c");
                material.emissiveIntensity = dimmed ? 0.02 : (theme === "dark" ? 0.28 : 0.4);
            }
            else {
                material.emissive.set(visualColor);
                material.emissiveIntensity = dimmed ? 0.0 : 0.08;
            }
        });
    }, [heatmap, theme]);
    const fitCameraToSpaces = useCallback(() => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls || !spaceInstances.length) {
            return;
        }
        const filterLevel = levelFilterRef.current;
        const visible = filterLevel !== null
            ? spaceInstances.filter((s) => s.level === filterLevel)
            : spaceInstances;
        const target = visible.length ? visible : spaceInstances;
        const minX = Math.min(...target.map((s) => s.position[0] - s.size[0] / 2));
        const maxX = Math.max(...target.map((s) => s.position[0] + s.size[0] / 2));
        const minY = Math.min(...target.map((s) => s.position[1] - s.size[1] / 2));
        const maxY = Math.max(...target.map((s) => s.position[1] + s.size[1] / 2));
        const minZ = Math.min(...target.map((s) => s.position[2] - s.size[2] / 2));
        const maxZ = Math.max(...target.map((s) => s.position[2] + s.size[2] / 2));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 4);
        const distance = span * 1.5;
        controls.target.set(centerX, centerY, centerZ);
        camera.position.set(centerX + distance, centerY + distance * 0.9, centerZ + distance);
        camera.lookAt(centerX, centerY, centerZ);
        controls.update();
    }, [spaceInstances]);
    const rebuildMeshes = useCallback(() => {
        const group = groupRef.current;
        if (!group) {
            return;
        }
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
        }
        meshesRef.current.forEach((mesh) => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        meshesRef.current.clear();
        displayedTempsRef.current = {};
        const baseGeometry = baseGeometryRef.current ?? new BoxGeometry(1, 1, 1);
        if (!baseGeometryRef.current) {
            baseGeometryRef.current = baseGeometry;
        }
        spaceInstances.forEach((instance) => {
            const material = new MeshStandardMaterial({
                color: 0x94a3b8,
                metalness: 0.08,
                roughness: 0.82,
            });
            const mesh = new Mesh(baseGeometry, material);
            mesh.scale.set(instance.size[0], instance.size[1], instance.size[2]);
            mesh.position.set(...instance.position);
            mesh.userData.spaceId = instance.id;
            mesh.userData.level = instance.level ?? "";
            group.add(mesh);
            meshesRef.current.set(instance.id, mesh);
        });
        fitCameraToSpaces();
    }, [fitCameraToSpaces, spaceInstances]);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const scene = new Scene();
        sceneRef.current = scene;
        applyViewerBackground(scene);
        const camera = new PerspectiveCamera(45, Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1), 0.1, 500);
        camera.position.set(12, 12, 12);
        camera.lookAt(0, 0, 0);
        const renderer = new WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
        container.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.mouseButtons = {
            LEFT: MOUSE.ROTATE,
            MIDDLE: MOUSE.PAN,
            RIGHT: MOUSE.ROTATE,
        };
        const group = new Group();
        scene.add(group);
        const ambient = new AmbientLight(0xffffff, 0.84);
        const directional = new DirectionalLight(0xffffff, 0.62);
        directional.position.set(10, 18, 10);
        scene.add(ambient, directional);
        const renderLoop = () => {
            controls.update();
            updateMeshVisuals();
            renderer.render(scene, camera);
            animationFrameRef.current = requestAnimationFrame(renderLoop);
        };
        renderLoop();
        const handleResize = () => {
            const widthPx = Math.max(container.clientWidth, 1);
            const heightPx = Math.max(container.clientHeight, 1);
            camera.aspect = widthPx / heightPx;
            camera.updateProjectionMatrix();
            renderer.setSize(widthPx, heightPx);
        };
        window.addEventListener("resize", handleResize);
        const handlePointer = (event) => {
            const bounds = renderer.domElement.getBoundingClientRect();
            pointer.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.current.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            raycaster.current.setFromCamera(pointer.current, camera);
            const intersects = raycaster.current.intersectObjects(group.children, false);
            const hit = intersects.find((intersect) => intersect.object.userData.spaceId);
            if (hit) {
                selectSpace(String(hit.object.userData.spaceId));
            }
        };
        renderer.domElement.addEventListener("pointerdown", handlePointer);
        rendererRef.current = renderer;
        cameraRef.current = camera;
        controlsRef.current = controls;
        groupRef.current = group;
        rebuildMeshes();
        return () => {
            sceneRef.current = null;
            renderer.domElement.removeEventListener("pointerdown", handlePointer);
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(animationFrameRef.current);
            controls.dispose();
            while (group.children.length) {
                group.remove(group.children[0]);
            }
            meshesRef.current.forEach((mesh) => {
                mesh.geometry.dispose();
                mesh.material.dispose();
            });
            meshesRef.current.clear();
            baseGeometryRef.current?.dispose();
            baseGeometryRef.current = null;
            renderer.dispose();
            container.removeChild(renderer.domElement);
        };
    }, [rebuildMeshes, selectSpace, updateMeshVisuals]);
    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) {
            return;
        }
        applyViewerBackground(scene);
    }, [theme]);
    useEffect(() => {
        rebuildMeshes();
    }, [rebuildMeshes]);
    useEffect(() => {
        const temps = frames[timeIndex]?.temperatures ?? {};
        targetTempsRef.current = temps;
        const displayed = displayedTempsRef.current;
        Object.entries(temps).forEach(([key, value]) => {
            if (displayed[key] === undefined) {
                displayed[key] = value;
            }
        });
    }, [frames, timeIndex]);
    useEffect(() => {
        selectedSpaceRef.current = selectedSpaceId ?? null;
    }, [selectedSpaceId]);
    useEffect(() => {
        levelFilterRef.current = levelFilter;
    }, [levelFilter]);
    const uniqueLevels = useMemo(() => {
        const seen = new Set();
        const result = [];
        for (const inst of spaceInstances) {
            const lvl = inst.level ?? "";
            if (lvl && !seen.has(lvl)) {
                seen.add(lvl);
                result.push(lvl);
            }
        }
        return result;
    }, [spaceInstances]);
    const handleSetLevelFilter = useCallback((level) => {
        levelFilterRef.current = level;
        setLevelFilter(level);
        fitCameraToSpaces();
    }, [fitCameraToSpaces]);
    const selectedInstance = spaceInstances.find((space) => space.id === selectedSpaceId) ?? null;
    const stats = useMemo(() => {
        if (!selectedInstance) {
            return null;
        }
        const temperature = frames[timeIndex]?.temperatures[selectedInstance.id];
        return (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-4 py-3 text-xs font-medium text-[color:var(--text-muted)] shadow-lg backdrop-blur", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: selectedInstance.name }), _jsxs("p", { children: ["\u041F\u043B\u043E\u0449\u0430\u0434\u044C: ", formatArea(selectedInstance.area)] }), _jsxs("p", { children: ["\u041E\u0431\u044A\u0451\u043C: ", formatVolume(selectedInstance.volume)] }), _jsxs("p", { children: ["\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430: ", formatTemperature(temperature)] })] }));
    }, [frames, selectedInstance, timeIndex]);
    return (_jsxs("div", { className: "ui-panel p-4 sm:p-5", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: caption }), _jsx("p", { className: "mt-1 max-w-xl text-sm leading-relaxed text-[color:var(--text-muted)]", children: "\u041A\u043E\u043B\u0451\u0441\u0438\u043A\u043E \u043C\u044B\u0448\u0438 \u2014 \u043C\u0430\u0441\u0448\u0442\u0430\u0431; \u043F\u0435\u0440\u0435\u0442\u0430\u0441\u043A\u0438\u0432\u0430\u043D\u0438\u0435 \u2014 \u043E\u0431\u0437\u043E\u0440. \u041A\u043B\u0438\u043A \u043F\u043E \u043E\u0431\u044A\u0451\u043C\u0443 \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u0437\u043E\u043D\u0443 \u0432 \u0441\u043F\u0438\u0441\u043A\u0435 \u0441\u0432\u043E\u0439\u0441\u0442\u0432." })] }), heatmap && showLegend ? (_jsx(TemperatureScaleLegend, { caption: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u0430 \u043F\u043E \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0439 \u043C\u043E\u0434\u0435\u043B\u0438 \u0438 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F CFD." })) : null] }), uniqueLevels.length > 1 && (_jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-1.5", children: [_jsx("span", { className: "text-xs font-medium text-[color:var(--text-muted)]", children: "\u042D\u0442\u0430\u0436:" }), _jsx("button", { type: "button", onClick: () => handleSetLevelFilter(null), className: `rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${levelFilter === null
                            ? "bg-[color:var(--accent-base)] text-white"
                            : "border border-[color:var(--border-soft)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"}`, children: "\u0412\u0441\u0435 \u0443\u0440\u043E\u0432\u043D\u0438" }), uniqueLevels.map((level) => (_jsx("button", { type: "button", onClick: () => handleSetLevelFilter(levelFilter === level ? null : level), className: `rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${levelFilter === level
                            ? "bg-[color:var(--accent-base)] text-white"
                            : "border border-[color:var(--border-soft)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"}`, children: level }, level)))] })), _jsxs("div", { className: "ui-workspace-canvas relative w-full overflow-hidden shadow-inner", style: { minHeight: height }, children: [_jsx("div", { ref: containerRef, className: "absolute inset-0" }), !spaceInstances.length && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[color:var(--text-muted)]", children: "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u043C\u043E\u0434\u0435\u043B\u044C \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442 \u0438\u0437 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u043E\u0431\u044A\u0451\u043C\u044B \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439." })), selectedInstance && _jsx("div", { className: "absolute left-4 top-4 z-10 max-w-[min(100%,280px)] transition-all duration-300", children: stats }), heatmap && (_jsx("div", { className: "pointer-events-none absolute bottom-3 left-3 z-10 max-w-sm rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-2.5 py-1.5 text-[10px] leading-snug text-[color:var(--text-muted)] shadow-sm backdrop-blur", children: "\u0412\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u043E \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u043C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430\u043C, \u043D\u0435 CFD. \u0426\u0432\u0435\u0442 \u2014 \u043E\u0440\u0438\u0435\u043D\u0442\u0438\u0440 \u0432 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0435 15\u202630 \u00B0C." })), showFitControl && spaceInstances.length > 0 && (_jsx("button", { type: "button", onClick: () => fitCameraToSpaces(), className: "ui-btn-secondary absolute bottom-3 right-3 z-10 px-3 py-1.5 text-xs backdrop-blur", children: "\u041F\u043E\u0434\u043E\u0433\u043D\u0430\u0442\u044C \u0432\u0438\u0434" })), frames.length > 1 && (_jsxs("div", { className: `absolute inset-x-4 z-10 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 text-xs shadow-lg backdrop-blur ${showFitControl && spaceInstances.length > 0 ? "bottom-14" : "bottom-4"}`, children: [_jsxs("div", { className: "mb-1 flex items-center justify-between text-sm font-semibold text-[color:var(--text-soft)]", children: [_jsx("span", { children: "\u041C\u043E\u043C\u0435\u043D\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438" }), _jsx("span", { children: formatTimeLabel(frames[timeIndex]?.time ?? 0) })] }), _jsx("input", { type: "range", min: 0, max: frames.length - 1, value: timeIndex, onChange: (event) => setTimeIndex(Number(event.target.value)), className: "w-full accent-[color:var(--accent-base)]" })] }))] })] }));
}
function applyViewerBackground(scene) {
    const raw = typeof document !== "undefined"
        ? getComputedStyle(document.documentElement).getPropertyValue("--viewer3d-bg").trim()
        : "";
    const hex = raw.startsWith("#") ? raw : "#f4f7f5";
    scene.background = new Color(hex);
}
function mixColor(base, blend, ratio) {
    const baseRgb = hexToRgb(base);
    const blendRgb = hexToRgb(blend);
    const r = Math.round(baseRgb.r + (blendRgb.r - baseRgb.r) * ratio);
    const g = Math.round(baseRgb.g + (blendRgb.g - baseRgb.g) * ratio);
    const b = Math.round(baseRgb.b + (blendRgb.b - baseRgb.b) * ratio);
    return `#${[r, g, b]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")}`;
}
function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
    };
}
function formatTimeLabel(timeHours) {
    const hours = Math.floor(timeHours);
    const minutes = Math.round((timeHours - hours) * 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
export default SpaceViewer3D;
