import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  MOUSE,
  PCFSoftShadowMap,
  PlaneGeometry,
  PerspectiveCamera,
  Raycaster,
  Scene,
  ShadowMaterial,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SpaceInstance } from "../../entities/twin/types";
import { useTwinStore } from "../../entities/twin/twin.store";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { formatTemperature, STOPS_DARK, STOPS_LIGHT } from "./twin.theme";
import { TemperatureScaleLegend } from "../../shared/ui";
import { useTheme } from "../../shared/theme";

type ByteColor = { r: number; g: number; b: number };
type ByteStop = ByteColor & { stop: number };

function parseHexByte(color: string): ByteColor {
  const n = color.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

// Градиент температур в виде байтов (разобран один раз, без парсинга строк в кадре).
const BYTE_STOPS_LIGHT: ByteStop[] = STOPS_LIGHT.map((s) => ({ stop: s.stop, ...parseHexByte(s.color) }));
const BYTE_STOPS_DARK: ByteStop[] = STOPS_DARK.map((s) => ({ stop: s.stop, ...parseHexByte(s.color) }));
// Базовый серый для смешивания вне теплокарты.
const MIX_BASE_LIGHT = parseHexByte("#94a3b8");
const MIX_BASE_DARK = parseHexByte("#5a6574");
const DIM_BASE_LIGHT = parseHexByte("#e3e9ef");
const DIM_BASE_DARK = parseHexByte("#44505f");
// Цвет подсветки выбранной зоны.
const SELECT_LIGHT = parseHexByte("#c2410c");
const SELECT_DARK = parseHexByte("#9cb87a");
// Переиспользуемые буферы, чтобы не аллоцировать объекты в цикле отрисовки.
const scratchThermal: ByteColor = { r: 0, g: 0, b: 0 };
const scratchVisual: ByteColor = { r: 0, g: 0, b: 0 };

function clampUnit(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Числовой аналог temperatureToColor(15..30): пишет байты в out без аллокаций и чтения DOM. */
function sampleTemperatureBytes(temp: number, stops: ByteStop[], out: ByteColor): void {
  const ratio = clampUnit((temp - 15) / 15);
  const nextIndex = stops.findIndex((entry) => ratio <= entry.stop);
  if (nextIndex <= 0) {
    out.r = stops[0].r;
    out.g = stops[0].g;
    out.b = stops[0].b;
    return;
  }
  const left = stops[nextIndex - 1];
  const right = stops[nextIndex];
  const local = clampUnit((ratio - left.stop) / Math.max(right.stop - left.stop, 1e-6));
  out.r = Math.round(left.r + (right.r - left.r) * local);
  out.g = Math.round(left.g + (right.g - left.g) * local);
  out.b = Math.round(left.b + (right.b - left.b) * local);
}

function mixBytes(base: ByteColor, blend: ByteColor, ratio: number, out: ByteColor): void {
  out.r = Math.round(base.r + (blend.r - base.r) * ratio);
  out.g = Math.round(base.g + (blend.g - base.g) * ratio);
  out.b = Math.round(base.b + (blend.b - base.b) * ratio);
}

// Байты -> hex-число. Color.set(number)/setHex трактуют его как sRGB — как и старый .set("#rrggbb").
function bytesToHex(c: ByteColor): number {
  return (c.r << 16) | (c.g << 8) | c.b;
}

// На огромных зданиях плавная анимация температур не видна, но стоит O(N)·~40 кадров —
// выше порога перекрашиваем мгновенно (один проход без хвоста анимации).
const INSTANT_RECOLOR_ABOVE = 2000;

// Зона затемнена, если включён фильтр этажа и зона на другом этаже.
function isDimmed(instance: SpaceInstance, filterLevel: string | null): boolean {
  return filterLevel !== null && (instance.level ?? "") !== filterLevel;
}

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
  // Все помещения рисуются ОДНИМ InstancedMesh: 1 draw call вместо тысяч.
  const instancedMeshRef = useRef<InstancedMesh | null>(null);
  const instanceGeometryRef = useRef<BoxGeometry | null>(null);
  const instanceMaterialRef = useRef<MeshStandardMaterial | null>(null);
  // Помещения в порядке индексов инстансов: instanceId -> данные зоны.
  const builtInstancesRef = useRef<SpaceInstance[]>([]);
  // Отдельный меш-оверлей для подсветки выбранной зоны (эмиссия per-instance в InstancedMesh недоступна).
  const highlightMeshRef = useRef<Mesh | null>(null);
  const sunLightRef = useRef<DirectionalLight | null>(null);
  const shadowGroundRef = useRef<Mesh | null>(null);
  const pointer = useRef(new Vector2());
  const raycaster = useRef(new Raycaster());
  const scratchMatrix = useRef(new Matrix4());
  const scratchColor = useRef(new Color());
  const displayedTempsRef = useRef<Record<string, number>>({});
  const targetTempsRef = useRef<Record<string, number>>({});
  const selectedSpaceRef = useRef<string | null>(null);
  const animationFrameRef = useRef(0);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const levelFilterRef = useRef<string | null>(null);
  // Отрисовка по требованию: рендерим только когда что-то изменилось.
  const colorsDirtyRef = useRef(true); // нужно пересчитать цвета всех зон (температуры/тема)
  const animatingRef = useRef(false); // температуры ещё «доезжают» до целевых
  const renderDirtyRef = useRef(true); // нужен один кадр отрисовки (камера/фон/размер)
  const filterDirtyRef = useRef(false); // сменился фильтр этажа — пересчитать только прозрачность
  const selectionDirtyRef = useRef(false); // сменился выбор — обновить только подсветку
  // id зоны -> индекс инстанса, чтобы подсветка находила выбранную зону без перебора всех.
  const instanceIndexByIdRef = useRef<Map<string, number>>(new Map());

  const spaceInstances = useTwinStore((state) => state.spaceInstances);
  const selectSpace = useTwinStore((state) => state.selectSpace);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const frames = useTwinStore((state) => state.simulationFrames);
  const timeIndex = useTwinStore((state) => state.timeIndex);
  const setTimeIndex = useTwinStore((state) => state.setTimeIndex);

  // Цвет зоны по сглаженной температуре (тепловая карта или смешение с серым).
  const visualHexForTemp = useCallback(
    (temp: number, dimmed = false): number => {
      const stops = theme === "dark" ? BYTE_STOPS_DARK : BYTE_STOPS_LIGHT;
      sampleTemperatureBytes(temp, stops, scratchThermal);
      if (heatmap) {
        scratchVisual.r = scratchThermal.r;
        scratchVisual.g = scratchThermal.g;
        scratchVisual.b = scratchThermal.b;
      } else {
        const mixBase = theme === "dark" ? MIX_BASE_DARK : MIX_BASE_LIGHT;
        mixBytes(mixBase, scratchThermal, 0.55, scratchVisual);
      }
      if (dimmed) {
        const dimBase = theme === "dark" ? DIM_BASE_DARK : DIM_BASE_LIGHT;
        mixBytes(dimBase, scratchVisual, theme === "dark" ? 0.22 : 0.16, scratchVisual);
      }
      return bytesToHex(scratchVisual);
    },
    [heatmap, theme]
  );

  // Подсветка выбранной зоны — отдельный меш чуть крупнее, нарисованный поверх инстансов.
  const applyHighlight = useCallback(
    (instance: SpaceInstance | null, visualHex: number, dimmed: boolean) => {
      const highlight = highlightMeshRef.current;
      if (!highlight) {
        return;
      }
      if (!instance) {
        highlight.visible = false;
        return;
      }
      const dark = theme === "dark";
      const hlMat = highlight.material as MeshStandardMaterial;
      hlMat.color.setHex(visualHex);
      hlMat.emissive.set(bytesToHex(dark ? SELECT_DARK : SELECT_LIGHT));
      hlMat.emissiveIntensity = dimmed ? 0.04 : dark ? 0.28 : 0.4;
      hlMat.opacity = dimmed ? 0.22 : 0.96;
      highlight.position.set(instance.position[0], instance.position[1], instance.position[2]);
      highlight.scale.set(instance.size[0] * 1.012, instance.size[1] * 1.012, instance.size[2] * 1.012);
      highlight.visible = true;
    },
    [theme]
  );

  // Полный пересчёт: цвета всех зон + прозрачность + подсветка. Двигает плавный переход температур.
  // Возвращает true, пока хотя бы одна зона ещё не доехала до целевой температуры.
  const recolorAll = useCallback(() => {
    const mesh = instancedMeshRef.current;
    const instances = builtInstancesRef.current;
    if (!mesh) {
      return false;
    }
    const targets = targetTempsRef.current;
    const displayed = displayedTempsRef.current;
    const selectedId = selectedSpaceRef.current;
    const filterLevel = levelFilterRef.current;
    const color = scratchColor.current;
    const instant = instances.length > INSTANT_RECOLOR_ABOVE;

    let animating = false;
    let selectedInstance: SpaceInstance | null = null;
    let selectedVisualHex = 0;
    let selectedDimmed = false;

    for (let i = 0; i < instances.length; i += 1) {
      const instance = instances[i];
      const id = instance.id;
      const prev = displayed[id] ?? targets[id] ?? 20;
      const target = targets[id] ?? prev;
      const diff = target - prev;
      let eased: number;
      if (instant || Math.abs(diff) < 0.01) {
        eased = target; // огромное здание или доехали — фиксируем без хвоста анимации
      } else {
        eased = prev + diff * 0.14;
        animating = true;
      }
      displayed[id] = eased;

      const dimmed = isDimmed(instance, filterLevel);
      const visualHex = visualHexForTemp(eased, dimmed);
      color.setHex(visualHex);
      mesh.setColorAt(i, color);

      if (selectedId === id) {
        selectedInstance = instance;
        selectedVisualHex = visualHex;
        selectedDimmed = dimmed;
      }
    }

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    applyHighlight(selectedInstance, selectedVisualHex, selectedDimmed);
    return animating;
  }, [applyHighlight, visualHexForTemp]);

  // Только обновление приглушенных цветов при смене фильтра этажа.
  const refreshAlpha = useCallback(() => {
    const mesh = instancedMeshRef.current;
    const instances = builtInstancesRef.current;
    if (!mesh) {
      return;
    }
    const displayed = displayedTempsRef.current;
    const selectedId = selectedSpaceRef.current;
    const filterLevel = levelFilterRef.current;
    const color = scratchColor.current;

    let selectedInstance: SpaceInstance | null = null;
    let selectedVisualHex = 0;
    let selectedDimmed = false;

    for (let i = 0; i < instances.length; i += 1) {
      const instance = instances[i];
      const dimmed = isDimmed(instance, filterLevel);
      const visualHex = visualHexForTemp(displayed[instance.id] ?? 20, dimmed);
      color.setHex(visualHex);
      mesh.setColorAt(i, color);
      if (selectedId === instance.id) {
        selectedInstance = instance;
        selectedVisualHex = visualHex;
        selectedDimmed = dimmed;
      }
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    applyHighlight(selectedInstance, selectedVisualHex, selectedDimmed);
  }, [applyHighlight, visualHexForTemp]);

  // Только подсветка (смена выбора): ни цвета, ни прозрачность не меняются — O(1) поиск по карте.
  const refreshHighlight = useCallback(() => {
    const instances = builtInstancesRef.current;
    const selectedId = selectedSpaceRef.current;
    const filterLevel = levelFilterRef.current;
    const displayed = displayedTempsRef.current;
    if (selectedId === null) {
      applyHighlight(null, 0, false);
      return;
    }
    const index = instanceIndexByIdRef.current.get(selectedId);
    const instance = index === undefined ? null : instances[index] ?? null;
    if (!instance) {
      applyHighlight(null, 0, false);
      return;
    }
    applyHighlight(instance, visualHexForTemp(displayed[instance.id] ?? 20), isDimmed(instance, filterLevel));
  }, [applyHighlight, visualHexForTemp]);

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

    // Один проход вместо шести Math.min(...map) — без spread, который роняет стек на больших зданиях.
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < target.length; i += 1) {
      const s = target[i];
      const hx = s.size[0] / 2;
      const hy = s.size[1] / 2;
      const hz = s.size[2] / 2;
      if (s.position[0] - hx < minX) minX = s.position[0] - hx;
      if (s.position[0] + hx > maxX) maxX = s.position[0] + hx;
      if (s.position[1] - hy < minY) minY = s.position[1] - hy;
      if (s.position[1] + hy > maxY) maxY = s.position[1] + hy;
      if (s.position[2] - hz < minZ) minZ = s.position[2] - hz;
      if (s.position[2] + hz > maxZ) maxZ = s.position[2] + hz;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 4);
    const distance = span * 1.5;

    controls.target.set(centerX, centerY, centerZ);
    camera.position.set(centerX + distance, centerY + distance * 0.9, centerZ + distance);
    camera.lookAt(centerX, centerY, centerZ);
    controls.update();

    const sunLight = sunLightRef.current;
    if (sunLight) {
      const shadowHalf = Math.max(span * 0.85, 10);
      sunLight.position.set(centerX + shadowHalf * 0.9, centerY + shadowHalf * 1.25, centerZ + shadowHalf * 0.7);
      sunLight.target.position.set(centerX, centerY, centerZ);
      sunLight.target.updateMatrixWorld();
      sunLight.shadow.camera.left = -shadowHalf;
      sunLight.shadow.camera.right = shadowHalf;
      sunLight.shadow.camera.top = shadowHalf;
      sunLight.shadow.camera.bottom = -shadowHalf;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = shadowHalf * 4 + 30;
      sunLight.shadow.camera.updateProjectionMatrix();
    }

    const ground = shadowGroundRef.current;
    if (ground) {
      const groundSize = Math.max(span * 4, 72);
      ground.position.set(centerX, minY - 0.04, centerZ);
      ground.scale.set(groundSize, groundSize, 1);
    }

    const renderer = rendererRef.current;
    if (renderer?.shadowMap) {
      renderer.shadowMap.needsUpdate = true;
    }
    renderDirtyRef.current = true;
  }, [spaceInstances]);

  const rebuildMeshes = useCallback(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    // Снести предыдущий InstancedMesh и связанные ресурсы.
    const prevMesh = instancedMeshRef.current;
    if (prevMesh) {
      group.remove(prevMesh);
      prevMesh.dispose();
      instancedMeshRef.current = null;
    }
    instanceGeometryRef.current?.dispose();
    instanceMaterialRef.current?.dispose();
    instanceGeometryRef.current = null;
    instanceMaterialRef.current = null;
    displayedTempsRef.current = {};
    instanceIndexByIdRef.current.clear();
    builtInstancesRef.current = spaceInstances;

    const count = spaceInstances.length;
    if (!count) {
      if (highlightMeshRef.current) {
        highlightMeshRef.current.visible = false;
      }
      colorsDirtyRef.current = true;
      renderDirtyRef.current = true;
      fitCameraToSpaces();
      return;
    }

    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial({
      color: 0xffffff, // белый base * instanceColor = чистый цвет инстанса
      metalness: 0.06,
      roughness: 0.88,
    });

    const mesh = new InstancedMesh(geometry, material, count);
    const matrix = scratchMatrix.current;
    const indexById = instanceIndexByIdRef.current;
    for (let i = 0; i < count; i += 1) {
      const instance = spaceInstances[i];
      matrix.makeScale(instance.size[0], instance.size[1], instance.size[2]);
      matrix.setPosition(instance.position[0], instance.position[1], instance.position[2]);
      mesh.setMatrixAt(i, matrix);
      indexById.set(instance.id, i);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    group.add(mesh);
    instancedMeshRef.current = mesh;
    instanceGeometryRef.current = geometry;
    instanceMaterialRef.current = material;

    colorsDirtyRef.current = true;
    const renderer = rendererRef.current;
    if (renderer?.shadowMap) {
      renderer.shadowMap.needsUpdate = true;
    }
    renderDirtyRef.current = true;
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
    // Ограничиваем pixel ratio: на 4K/Retina иначе рендерим в 4+ раза больше пикселей.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
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

    const hemiLight = new HemisphereLight(0xb9d7ef, 0xd7cfc0, 0.86);
    scene.add(hemiLight);

    const directional = new DirectionalLight(0xfff5e3, 1.08);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.bias = -0.0007;
    directional.shadow.normalBias = 0.018;
    directional.shadow.radius = 2.4;
    scene.add(directional, directional.target);
    sunLightRef.current = directional;

    const fillLight = new DirectionalLight(0xc5def5, 0.34);
    fillLight.position.set(-10, 8, -6);
    scene.add(fillLight);

    const ground = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({ opacity: theme === "dark" ? 0.14 : 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "ground:shadow";
    scene.add(ground);
    shadowGroundRef.current = ground;

    // Подсветка выбранной зоны: один меш чуть крупнее инстанса, обновляется в applyHighlight.
    const highlightGeometry = new BoxGeometry(1, 1, 1);
    const highlightMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.08,
      roughness: 0.82,
      transparent: true,
      opacity: 0.96,
    });
    const highlight = new Mesh(highlightGeometry, highlightMaterial);
    highlight.visible = false;
    highlight.renderOrder = 2;
    group.add(highlight);
    highlightMeshRef.current = highlight;

    const renderLoop = () => {
      // controls.update() дешёвый и возвращает true, пока камера движется (в т.ч. инерция).
      const cameraChanged = controls.update();
      let needsRender = cameraChanged || renderDirtyRef.current;
      // Самый дешёвый достаточный пересчёт: цвета только при смене температур/темы,
      // прозрачность — при смене фильтра этажа, подсветка — при смене выбора.
      if (colorsDirtyRef.current || animatingRef.current) {
        animatingRef.current = recolorAll();
        colorsDirtyRef.current = false;
        filterDirtyRef.current = false;
        selectionDirtyRef.current = false;
        needsRender = true;
      } else if (filterDirtyRef.current) {
        refreshAlpha();
        filterDirtyRef.current = false;
        selectionDirtyRef.current = false;
        needsRender = true;
      } else if (selectionDirtyRef.current) {
        refreshHighlight();
        selectionDirtyRef.current = false;
        needsRender = true;
      }
      if (needsRender) {
        renderer.render(scene, camera);
        renderDirtyRef.current = false;
      }
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const handleResize = () => {
      const widthPx = Math.max(container.clientWidth, 1);
      const heightPx = Math.max(container.clientHeight, 1);
      camera.aspect = widthPx / heightPx;
      camera.updateProjectionMatrix();
      renderer.setSize(widthPx, heightPx);
      renderDirtyRef.current = true;
    };
    window.addEventListener("resize", handleResize);

    const handlePointer = (event: PointerEvent) => {
      const instancedMesh = instancedMeshRef.current;
      if (!instancedMesh) {
        return;
      }
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.current.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.current.setFromCamera(pointer.current, camera);
      const intersects = raycaster.current.intersectObjects([instancedMesh], false);
      const hit = intersects.find((intersect) => intersect.instanceId !== undefined);
      if (hit && hit.instanceId !== undefined) {
        const instance = builtInstancesRef.current[hit.instanceId];
        if (instance) {
          selectSpace(instance.id);
        }
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
      const builtMesh = instancedMeshRef.current;
      if (builtMesh) {
        group.remove(builtMesh);
        builtMesh.dispose();
        instancedMeshRef.current = null;
      }
      instanceGeometryRef.current?.dispose();
      instanceMaterialRef.current?.dispose();
      instanceGeometryRef.current = null;
      instanceMaterialRef.current = null;
      highlightMeshRef.current = null;
      sunLightRef.current = null;
      const shadowGround = shadowGroundRef.current;
      if (shadowGround) {
        scene.remove(shadowGround);
        shadowGround.geometry.dispose();
        (shadowGround.material as ShadowMaterial).dispose();
        shadowGroundRef.current = null;
      }
      highlightGeometry.dispose();
      highlightMaterial.dispose();
      while (group.children.length) {
        group.remove(group.children[0]);
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [rebuildMeshes, selectSpace, recolorAll, refreshAlpha, refreshHighlight]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    applyViewerBackground(scene);
    const ground = shadowGroundRef.current;
    if (ground) {
      (ground.material as ShadowMaterial).opacity = theme === "dark" ? 0.14 : 0.2;
    }
    const renderer = rendererRef.current;
    if (renderer?.shadowMap) {
      renderer.shadowMap.needsUpdate = true;
    }
    colorsDirtyRef.current = true;
    renderDirtyRef.current = true;
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
    // Новые целевые температуры — запускаем плавный переход и хотя бы один пересчёт.
    animatingRef.current = true;
    colorsDirtyRef.current = true;
  }, [frames, timeIndex]);

  useEffect(() => {
    selectedSpaceRef.current = selectedSpaceId ?? null;
    selectionDirtyRef.current = true; // меняется только подсветка, не цвета зон
  }, [selectedSpaceId]);

  useEffect(() => {
    levelFilterRef.current = levelFilter;
    filterDirtyRef.current = true; // меняется только приглушение зон, не температуры
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

function formatTimeLabel(timeHours: number): string {
  const hours = Math.floor(timeHours);
  const minutes = Math.round((timeHours - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export default SpaceViewer3D;
