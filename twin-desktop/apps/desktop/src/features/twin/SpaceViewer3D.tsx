import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useTwinStore } from "../../entities/twin/twin.store";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { formatTemperature, temperatureToColor } from "./twin.theme";

interface SpaceViewer3DProps {
  heatmap?: boolean;
  height?: number;
  caption?: string;
}

export function SpaceViewer3D({
  heatmap = false,
  height = 360,
  caption = "3D вид",
}: SpaceViewer3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<Group | null>(null);
  const meshesRef = useRef<Map<string, Mesh>>(new Map());
  const pointer = useRef(new Vector2());
  const raycaster = useRef(new Raycaster());
  const baseGeometryRef = useRef<BoxGeometry | null>(null);
  const displayedTempsRef = useRef<Record<string, number>>({});
  const targetTempsRef = useRef<Record<string, number>>({});
  const selectedSpaceRef = useRef<string | null>(null);
  const animationFrameRef = useRef(0);

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
      const eased = prev + (target - prev) * 0.14;
      displayed[id] = eased;

      const thermalColor = temperatureToColor(eased);
      const visualColor = heatmap ? thermalColor : mixColor("#94a3b8", thermalColor, 0.55);
      const material = mesh.material as MeshStandardMaterial;
      material.color.set(visualColor);
      material.opacity = 0.94;
      material.transparent = true;

      if (selectedId === id) {
        material.emissive.set("#f97316");
        material.emissiveIntensity = 0.45;
      } else {
        material.emissive.set(visualColor);
        material.emissiveIntensity = 0.08;
      }
    });
  }, [heatmap]);

  const fitCameraToSpaces = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !spaceInstances.length) {
      return;
    }

    const minX = Math.min(...spaceInstances.map((space) => space.position[0] - space.size[0] / 2));
    const maxX = Math.max(...spaceInstances.map((space) => space.position[0] + space.size[0] / 2));
    const minY = Math.min(...spaceInstances.map((space) => space.position[1] - space.size[1] / 2));
    const maxY = Math.max(...spaceInstances.map((space) => space.position[1] + space.size[1] / 2));
    const minZ = Math.min(...spaceInstances.map((space) => space.position[2] - space.size[2] / 2));
    const maxZ = Math.max(...spaceInstances.map((space) => space.position[2] + space.size[2] / 2));

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
      const child = group.children[0] as Mesh;
      group.remove(child);
    }

    meshesRef.current.forEach((mesh) => {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
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
    scene.background = new Color(0xf8fafc);

    const camera = new PerspectiveCamera(45, Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1), 0.1, 500);
    camera.position.set(12, 12, 12);
    camera.lookAt(0, 0, 0);

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

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

    const handlePointer = (event: PointerEvent) => {
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
      renderer.domElement.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      controls.dispose();
      while (group.children.length) {
        group.remove(group.children[0]);
      }
      meshesRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
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

  const selectedInstance = spaceInstances.find((space) => space.id === selectedSpaceId) ?? null;

  const stats = useMemo(() => {
    if (!selectedInstance) {
      return null;
    }
    const temperature = frames[timeIndex]?.temperatures[selectedInstance.id];
    return (
      <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-xs font-medium text-slate-700 shadow-lg backdrop-blur">
        <p className="text-sm font-semibold text-slate-900">{selectedInstance.name}</p>
        <p>Площадь: {formatArea(selectedInstance.area)}</p>
        <p>Объём: {formatVolume(selectedInstance.volume)}</p>
        <p>Температура: {formatTemperature(temperature)}</p>
      </div>
    );
  }, [frames, selectedInstance, timeIndex]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{caption}</h3>
        <p className="text-[11px] font-medium text-slate-400">Колесо мыши: масштаб, перетаскивание: орбита</p>
      </div>
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-900/10"
        style={{ minHeight: height }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        {!spaceInstances.length && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            Импортируйте модель или экспортируйте Build Mode, чтобы увидеть геометрию помещений.
          </div>
        )}
        {selectedInstance && <div className="absolute left-4 top-4 transition-all duration-300">{stats}</div>}
        {frames.length > 1 && (
          <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/60 bg-white/85 p-3 text-xs shadow-lg backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Время</span>
              <span>{formatTimeLabel(frames[timeIndex]?.time ?? 0)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={timeIndex}
              onChange={(event) => setTimeIndex(Number(event.target.value))}
              className="w-full accent-slate-900"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function mixColor(base: string, blend: string, ratio: number): string {
  const baseRgb = hexToRgb(base);
  const blendRgb = hexToRgb(blend);
  const r = Math.round(baseRgb.r + (blendRgb.r - baseRgb.r) * ratio);
  const g = Math.round(baseRgb.g + (blendRgb.g - baseRgb.g) * ratio);
  const b = Math.round(baseRgb.b + (blendRgb.b - baseRgb.b) * ratio);
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function formatTimeLabel(timeHours: number): string {
  const hours = Math.floor(timeHours);
  const minutes = Math.round((timeHours - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export default SpaceViewer3D;
