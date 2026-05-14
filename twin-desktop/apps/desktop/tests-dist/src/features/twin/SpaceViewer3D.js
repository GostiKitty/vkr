import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { AmbientLight, BoxGeometry, Color, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer, } from "three";
import { useTwinStore } from "../../entities/twin/twin.store";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { formatTemperature, temperatureToColor } from "./twin.theme";
export function SpaceViewer3D({ heatmap = false, height = 360, caption = "3D вид" }) {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const groupRef = useRef(null);
    const meshesRef = useRef(new Map());
    const pointer = useRef(new Vector2());
    const raycaster = useRef(new Raycaster());
    const baseGeometryRef = useRef(null);
    const displayedTempsRef = useRef({});
    const targetTempsRef = useRef({});
    const selectedSpaceRef = useRef(null);
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
        meshes.forEach((mesh, id) => {
            const prev = displayed[id] ?? targets[id] ?? 20;
            const target = targets[id] ?? prev;
            const eased = prev + (target - prev) * 0.12;
            displayed[id] = eased;
            const thermalColor = temperatureToColor(eased);
            const visualColor = heatmap ? thermalColor : mixColor("#94a3b8", thermalColor, 0.65);
            const material = mesh.material;
            material.color.set(visualColor);
            material.opacity = 0.92;
            material.transparent = true;
            if (selectedId && selectedId === id) {
                material.emissive.set("#f97316");
                material.emissiveIntensity = 0.55;
            }
            else {
                material.emissive.set(visualColor);
                material.emissiveIntensity = 0.12;
            }
        });
    }, [heatmap]);
    const rebuildMeshes = useCallback(() => {
        const group = groupRef.current;
        if (!group)
            return;
        group.clear();
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
            const material = new MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.1, roughness: 0.85 });
            const mesh = new Mesh(baseGeometry, material);
            mesh.scale.set(instance.size[0], instance.size[1], instance.size[2]);
            mesh.position.set(...instance.position);
            mesh.userData.spaceId = instance.id;
            group.add(mesh);
            meshesRef.current.set(instance.id, mesh);
        });
    }, [spaceInstances]);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const scene = new Scene();
        scene.background = new Color(0xf8fafc);
        const camera = new PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
        camera.position.set(12, 12, 12);
        camera.lookAt(0, 0, 0);
        const renderer = new WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);
        const group = new Group();
        scene.add(group);
        const ambient = new AmbientLight(0xffffff, 0.8);
        const directional = new DirectionalLight(0xffffff, 0.6);
        directional.position.set(10, 20, 10);
        scene.add(ambient, directional);
        renderer.setAnimationLoop(() => {
            group.rotation.y += 0.0015;
            updateMeshVisuals();
            renderer.render(scene, camera);
        });
        const handleResize = () => {
            if (!container)
                return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener("resize", handleResize);
        const handlePointer = (event) => {
            const bounds = container.getBoundingClientRect();
            pointer.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.current.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            raycaster.current.setFromCamera(pointer.current, camera);
            const intersects = raycaster.current.intersectObjects(group.children, false);
            const hit = intersects.find((intersect) => intersect.object.userData.spaceId);
            if (hit) {
                const id = hit.object.userData.spaceId;
                selectSpace(id);
            }
        };
        renderer.domElement.addEventListener("pointerdown", handlePointer);
        rendererRef.current = renderer;
        cameraRef.current = camera;
        groupRef.current = group;
        rebuildMeshes();
        return () => {
            renderer.domElement.removeEventListener("pointerdown", handlePointer);
            window.removeEventListener("resize", handleResize);
            renderer.setAnimationLoop(null);
            group.clear();
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
        rebuildMeshes();
    }, [rebuildMeshes]);
    useEffect(() => {
        const temps = frames[timeIndex]?.temperatures ?? {};
        targetTempsRef.current = temps;
        const display = displayedTempsRef.current;
        Object.entries(temps).forEach(([key, value]) => {
            if (display[key] === undefined) {
                display[key] = value;
            }
        });
    }, [frames, timeIndex]);
    useEffect(() => {
        selectedSpaceRef.current = selectedSpaceId ?? null;
    }, [selectedSpaceId]);
    const selectedInstance = spaceInstances.find((space) => space.id === selectedSpaceId) ?? null;
    const stats = useMemo(() => {
        if (!selectedInstance) {
            return null;
        }
        const temperature = frames[timeIndex]?.temperatures[selectedInstance.id];
        return (<div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-xs font-medium text-slate-700 shadow-lg backdrop-blur">
        <p className="text-sm font-semibold text-slate-900">{selectedInstance.name}</p>
        <p>Площадь: {formatArea(selectedInstance.area)}</p>
        <p>Объем: {formatVolume(selectedInstance.volume)}</p>
        <p>Температура: {formatTemperature(temperature)}</p>
      </div>);
    }, [frames, selectedInstance, timeIndex]);
    return (<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{caption}</h3>
      <div className="relative w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-900/10" style={{ minHeight: height }}>
        <div ref={containerRef} className="absolute inset-0"/>
        {!spaceInstances.length && (<div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            Импортируйте модель, чтобы увидеть геометрию помещений.
          </div>)}
        {selectedInstance && <div className="absolute left-4 top-4 transition-all duration-300">{stats}</div>}
        {frames.length > 1 && (<div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/60 bg-white/80 p-3 text-xs shadow-lg backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Время</span>
              <span>{formatTimeLabel(frames[timeIndex]?.time ?? 0)}</span>
            </div>
            <input type="range" min={0} max={frames.length - 1} value={timeIndex} onChange={(event) => setTimeIndex(Number(event.target.value))} className="w-full accent-slate-900"/>
          </div>)}
      </div>
    </div>);
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
