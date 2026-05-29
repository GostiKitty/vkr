import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  MOUSE,
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
import { TemperatureScaleLegend } from "../../shared/ui";
import { useTheme } from "../../shared/theme";

interface SpaceViewer3DProps {
  heatmap?: boolean;
  height?: number;
  caption?: string;
  /** Показать шкалу цвета (имеет смысл при тепловой окраске). */
  showLegend?: boolean;
  /** Кнопка «Подогнать вид» под сценой. */
  showFitControl?: boolean;
}

export function SpaceViewer3D({
  heatmap = false,
  height = 360,
  caption = "3D вид",
  showLegend = false,
  showFitControl = true,
}: SpaceViewer3DProps) {
  const { resolved: theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<Group | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const meshesRef = useRef<Map<string, Mesh>>(new Map());
  const pointer = useRef(new Vector2());
  const raycaster = useRef(new Raycaster());
  const baseGeometryRef = useRef<BoxGeometry | null>(null);
  const displayedTempsRef = useRef<Record<string, number>>({});
  const targetTempsRef = useRef<Record<string, number>>({});
  const selectedSpaceRef = useRef<string | null>(null);
  const animationFrameRef = useRef(0);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const levelFilterRef = useRef<string | null>(null);

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
      const material = mesh.material as MeshStandardMaterial;
      material.color.set(visualColor);
      material.transparent = true;

      const meshLevel = mesh.userData.level as string | undefined;
      const dimmed = filterLevel !== null && meshLevel !== filterLevel;
      material.opacity = dimmed ? 0.07 : 0.94;

      if (selectedId === id) {
        material.emissive.set(theme === "dark" ? "#9cb87a" : "#c2410c");
        material.emissiveIntensity = dimmed ? 0.02 : (theme === "dark" ? 0.28 : 0.4);
      } else {
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
    const seen = new Set<string>();
    const result: string[] = [];
    for (const inst of spaceInstances) {
      const lvl = inst.level ?? "";
      if (lvl && !seen.has(lvl)) {
        seen.add(lvl);
        result.push(lvl);
      }
    }
    return result;
  }, [spaceInstances]);

  const handleSetLevelFilter = useCallback(
    (level: string | null) => {
      levelFilterRef.current = level;
      setLevelFilter(level);
      fitCameraToSpaces();
    },
    [fitCameraToSpaces]
  );

  const selectedInstance = spaceInstances.find((space) => space.id === selectedSpaceId) ?? null;

  const stats = useMemo(() => {
    if (!selectedInstance) {
      return null;
    }
    const temperature = frames[timeIndex]?.temperatures[selectedInstance.id];
    return (
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-4 py-3 text-xs font-medium text-[color:var(--text-muted)] shadow-lg backdrop-blur">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">{selectedInstance.name}</p>
        <p>Площадь: {formatArea(selectedInstance.area)}</p>
        <p>Объём: {formatVolume(selectedInstance.volume)}</p>
        <p>Температура: {formatTemperature(temperature)}</p>
      </div>
    );
  }, [frames, selectedInstance, timeIndex]);

  return (
    <div className="ui-panel p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--text-base)]">{caption}</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[color:var(--text-muted)]">
            Колёсико мыши — масштаб; перетаскивание — обзор. Клик по объёму выбирает зону в списке свойств.
          </p>
        </div>
        {heatmap && showLegend ? (
          <TemperatureScaleLegend caption="Температурная карта построена по зональной модели и не является CFD." />
        ) : null}
      </div>
      {uniqueLevels.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-[color:var(--text-muted)]">Этаж:</span>
          <button
            type="button"
            onClick={() => handleSetLevelFilter(null)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              levelFilter === null
                ? "bg-[color:var(--accent-base)] text-white"
                : "border border-[color:var(--border-soft)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"
            }`}
          >
            Все уровни
          </button>
          {uniqueLevels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => handleSetLevelFilter(levelFilter === level ? null : level)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                levelFilter === level
                  ? "bg-[color:var(--accent-base)] text-white"
                  : "border border-[color:var(--border-soft)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      )}
      <div
        className="ui-workspace-canvas relative w-full overflow-hidden shadow-inner"
        style={{ minHeight: height }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        {!spaceInstances.length && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-[color:var(--text-muted)]">
            Импортируйте модель или откройте проект из конструктора, чтобы увидеть объёмы помещений.
          </div>
        )}
        {selectedInstance && <div className="absolute left-4 top-4 z-10 max-w-[min(100%,280px)] transition-all duration-300">{stats}</div>}
        {heatmap && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-sm rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-2.5 py-1.5 text-[10px] leading-snug text-[color:var(--text-muted)] shadow-sm backdrop-blur">
            Визуализация по зональным температурам, не CFD. Цвет — ориентир в диапазоне 15…30 °C.
          </div>
        )}
        {showFitControl && spaceInstances.length > 0 && (
          <button
            type="button"
            onClick={() => fitCameraToSpaces()}
            className="ui-btn-secondary absolute bottom-3 right-3 z-10 px-3 py-1.5 text-xs backdrop-blur"
          >
            Подогнать вид
          </button>
        )}
        {frames.length > 1 && (
          <div
            className={`absolute inset-x-4 z-10 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 text-xs shadow-lg backdrop-blur ${
              showFitControl && spaceInstances.length > 0 ? "bottom-14" : "bottom-4"
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-[color:var(--text-soft)]">
              <span>Момент времени</span>
              <span>{formatTimeLabel(frames[timeIndex]?.time ?? 0)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={timeIndex}
              onChange={(event) => setTimeIndex(Number(event.target.value))}
              className="w-full accent-[color:var(--accent-base)]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function applyViewerBackground(scene: Scene) {
  const raw =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--viewer3d-bg").trim()
      : "";
  const hex = raw.startsWith("#") ? raw : "#f4f7f5";
  scene.background = new Color(hex);
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
