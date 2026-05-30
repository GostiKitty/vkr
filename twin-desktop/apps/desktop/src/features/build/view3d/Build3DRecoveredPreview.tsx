import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BuildingModel, Vec2 } from "../../../entities/geometry/types";
import type { ThermalFieldModel } from "../../../core/thermal/field";
import type { Selection } from "../build.store";
import type { BuildViewerOptions } from "./viewerOptions";
import {
  buildRecovered3DModel,
  type Recovered3DModel,
  type RecoveredOpeningModel,
} from "./buildRecovered3DModel";
import { calculateRecoveredCameraFrame, calculateRecoveredGrid } from "./recoveredPreviewMath";
import { collectRecoveredSceneMeshAudit } from "./recoveredMeshAudit";

export const DEBUG_3D_MESH_AUDIT = false;
export const USE_ROOM_FLOOR_TEMPERATURE_COLORING = true;
export const DISABLE_ALL_3D_TEMPERATURE = false;

export function resolveRecoveredTemperatureRuntime(showTemperature: boolean, showWallTemperature: boolean) {
  const disabled = DISABLE_ALL_3D_TEMPERATURE || !USE_ROOM_FLOOR_TEMPERATURE_COLORING;
  return {
    disabled,
    showTemperature: !disabled && showTemperature,
    showWallTemperature: !disabled && showTemperature && showWallTemperature && false,
  };
}

export interface Build3DRecoveredPreviewHandle {
  getCanvas: () => HTMLCanvasElement | null;
  focusModel: () => void;
  resetView: () => void;
  topView: () => void;
  zoomToFit: () => void;
  setTopView: () => void;
  focusSelection: () => void;
}

interface Build3DRecoveredPreviewProps {
  model: BuildingModel;
  activeLevelId: string | null;
  selection: Selection | null;
  viewer: BuildViewerOptions;
  thermalField?: ThermalFieldModel | null;
  showTemperature?: boolean;
  showWallTemperature?: boolean;
  onSelect?: (selection: Selection | null) => void;
}

const ROOM_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.34, roughness: 0.96, metalness: 0.01 });
const WALL_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.88, metalness: 0.03 });
const OPENING_WINDOW_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.92, roughness: 0.45, metalness: 0.04 });
const OPENING_DOOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.95, roughness: 0.6, metalness: 0.04 });
const ROOF_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.58, roughness: 0.9, metalness: 0.03 });
const SLAB_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.42, roughness: 0.95, metalness: 0.02 });
const SUPPLY_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.65, metalness: 0.04 });
const RETURN_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.65, metalness: 0.04 });
const DUCT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.4, roughness: 0.75, metalness: 0.03 });
const EQUIPMENT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.74, metalness: 0.04 });
const SENSOR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.7, metalness: 0.03 });
const HIGHLIGHT_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.08, roughness: 0.62, metalness: 0.04 });

function setMeshIdentity(mesh: THREE.Mesh, name: string, userData: Record<string, unknown>) {
  mesh.name = name;
  Object.assign(mesh.userData, userData);
  return mesh;
}

function buildShape(points: Vec2[]): THREE.Shape | null {
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

function getSelectionMaterial(
  selection: Selection | null,
  kind: Exclude<NonNullable<Selection>["kind"], "loop" | "level">,
  id: string,
  material: THREE.Material
) {
  return selection?.kind === kind && selection.id === id ? HIGHLIGHT_MATERIAL : material;
}

function mixColor(a: number | string, b: number | string, t: number) {
  const ratio = Math.min(Math.max(t, 0), 1);
  const colorA = new THREE.Color(a);
  const colorB = new THREE.Color(b);
  const red = Math.round((colorA.r + (colorB.r - colorA.r) * ratio) * 255);
  const green = Math.round((colorA.g + (colorB.g - colorA.g) * ratio) * 255);
  const blue = Math.round((colorA.b + (colorB.b - colorA.b) * ratio) * 255);
  return new THREE.Color((red << 16) | (green << 8) | blue);
}

function createRoomTemperatureMaterial(temperature_C: number, summary: Recovered3DModel["temperatureSummary"]) {
  const min = summary?.min_C ?? temperature_C;
  const max = summary?.max_C ?? temperature_C;
  const range = Math.max(max - min, 0.001);
  const ratio = (temperature_C - min) / range;
  const color = mixColor(0x2563eb, 0xf97316, ratio);
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.64,
    roughness: 0.82,
    metalness: 0.02,
    emissive: color,
    emissiveIntensity: 0.1,
  });
}

function addBoxBetween(
  root: THREE.Object3D,
  a: Vec2,
  b: Vec2,
  width: number,
  height: number,
  centerY: number,
  material: THREE.Material,
  options?: { name?: string; userData?: Record<string, unknown> }
) {
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

function addCylinderBetween(
  root: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  options?: { name?: string; userData?: Record<string, unknown> }
) {
  const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
  const length = direction.length();
  if (length < 1e-4) {
    return;
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

function createOpeningMesh(opening: RecoveredOpeningModel, selection: Selection | null) {
  const baseMaterial =
    opening.type === "window"
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
    selection: { kind: opening.type, id: opening.id } satisfies Selection,
  });
}

function logMeshAudit(scene: THREE.Scene, shellRoot: THREE.Group) {
  if (!DEBUG_3D_MESH_AUDIT) {
    return;
  }
  const audit = collectRecoveredSceneMeshAudit(scene, shellRoot);
  console.table(
    audit.rows.map((row) => ({
      name: row.name,
      parent: row.parentName,
      category: row.category,
      color: row.materialColorHex,
      opacity: row.materialOpacity,
      geometry: row.geometryType,
      centerX: row.bbox?.center.x ?? null,
      centerY: row.bbox?.center.y ?? null,
      centerZ: row.bbox?.center.z ?? null,
      sizeX: row.bbox?.size.x ?? null,
      sizeY: row.bbox?.size.y ?? null,
      sizeZ: row.bbox?.size.z ?? null,
      visible: row.visible,
      renderOrder: row.renderOrder,
    }))
  );
  if (audit.suspiciousRows.length) {
    console.table(
      audit.suspiciousRows.map((row) => ({
        name: row.name,
        category: row.category,
        color: row.materialColorHex,
        opacity: row.materialOpacity,
        centerX: row.bbox?.center.x ?? null,
        centerZ: row.bbox?.center.z ?? null,
        sizeX: row.bbox?.size.x ?? null,
        sizeZ: row.bbox?.size.z ?? null,
      }))
    );
  }
  if (audit.outsideShellRows.length) {
    console.table(
      audit.outsideShellRows.map((row) => ({
        name: row.name,
        category: row.category,
        color: row.materialColorHex,
        centerX: row.bbox?.center.x ?? null,
        centerZ: row.bbox?.center.z ?? null,
        sizeX: row.bbox?.size.x ?? null,
        sizeZ: row.bbox?.size.z ?? null,
      }))
    );
  }
}

export const Build3DRecoveredPreview = React.forwardRef<Build3DRecoveredPreviewHandle, Build3DRecoveredPreviewProps>(
  ({ model, activeLevelId, selection, viewer, thermalField = null, showTemperature = false, showWallTemperature = false, onSelect }, forwardedRef) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const contentRef = useRef<THREE.Group | null>(null);
    const shellRootRef = useRef<THREE.Group | null>(null);
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const animationFrameRef = useRef<number>(0);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const fitRafRef = useRef<number | null>(null);
    const homeModeRef = useRef<"focus" | "top">("focus");
    const hasInitialFitRef = useRef(false);
    const lastModelKeyRef = useRef("");
    const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
    const containerSizeRef = useRef({ width: 0, height: 0 });
    const onSelectRef = useRef<typeof onSelect>(onSelect);

    useEffect(() => {
      onSelectRef.current = onSelect;
    }, [onSelect]);
    const temperatureRuntime = useMemo(
      () => resolveRecoveredTemperatureRuntime(showTemperature, showWallTemperature),
      [showTemperature, showWallTemperature]
    );
    const simpleModel = useMemo(
      () =>
        buildRecovered3DModel(model, activeLevelId, {
          showNetworks: viewer.showNetworks,
          showEquipment: viewer.showEquipment,
          showTemperature: temperatureRuntime.showTemperature,
          showWallTemperature: temperatureRuntime.showWallTemperature,
          thermalField,
        }),
      [activeLevelId, model, temperatureRuntime.showTemperature, temperatureRuntime.showWallTemperature, thermalField, viewer.showEquipment, viewer.showNetworks]
    );
    const coloredRoomFloorCount = useMemo(
      () =>
        temperatureRuntime.showTemperature
          ? simpleModel.rooms.filter((room) => room.boundary.length >= 3 && Number.isFinite(room.temperature_C)).length
          : 0,
      [simpleModel.rooms, temperatureRuntime.showTemperature]
    );

    const renderCurrentScene = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    const applyCameraMode = (mode: "focus" | "top", setHome = true) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) {
        return;
      }
      const frame = calculateRecoveredCameraFrame(simpleModel.bounds, mode);
      camera.position.set(frame.position.x, frame.position.y, frame.position.z);
      const perspectiveCamera = camera as THREE.PerspectiveCamera & { near: number; far: number };
      perspectiveCamera.near = frame.near;
      perspectiveCamera.far = frame.far;
      perspectiveCamera.updateProjectionMatrix();
      controls.target.set(frame.target.x, frame.target.y, frame.target.z);
      controls.update();
      renderCurrentScene();
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
        applyCameraMode("focus", true);
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
      grid.name = "grid:recovered";
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMaterials.forEach((material) => {
        material.transparent = true;
        material.opacity = 0.18;
      });
      scene.add(grid);

      const content = new THREE.Group();
      content.name = "group:content";
      const shellRoot = new THREE.Group();
      shellRoot.name = "group:shell";
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

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const resolveSelection = (event: PointerEvent) => {
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
        onSelectRef.current?.(hit.object.userData.selection as Selection);
      };

      const handlePointerDown = (event: PointerEvent) => {
        pointerDownRef.current = { x: event.clientX, y: event.clientY };
      };

      const handlePointerUp = (event: PointerEvent) => {
        const pointerDown = pointerDownRef.current;
        pointerDownRef.current = null;
        if (!pointerDown || event.button !== 0) {
          return;
        }
        const delta = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
        if (delta <= 4) {
          resolveSelection(event);
        }
      };

      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      const preventContextMenu = (event: MouseEvent) => event.preventDefault();
      canvas.addEventListener("contextmenu", preventContextMenu);
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointerup", handlePointerUp);

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
        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("pointerup", handlePointerUp);
        controls.dispose();
        renderer.dispose();
        scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
          const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(material)) {
            material.forEach((entry) => entry.dispose?.());
          } else {
            material?.dispose?.();
          }
        });
      };
    }, []);

    useEffect(() => {
      const content = contentRef.current;
      const shellRoot = shellRootRef.current;
      const grid = gridRef.current;
      if (!content || !shellRoot || !grid) {
        return;
      }

      while (content.children.length) {
        content.remove(content.children[0]);
      }
      content.add(shellRoot);
      while (shellRoot.children.length) {
        shellRoot.remove(shellRoot.children[0]);
      }

      simpleModel.rooms.forEach((room) => {
        const shape = buildShape(room.boundary);
        if (!shape) {
          return;
        }
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
        const baseMaterial =
          temperatureRuntime.showTemperature && Number.isFinite(room.temperature_C) && simpleModel.temperatureSummary
            ? createRoomTemperatureMaterial(room.temperature_C as number, simpleModel.temperatureSummary)
            : ROOM_MATERIAL;
        const roomMaterial = getSelectionMaterial(selection, "room", room.id, baseMaterial);
        if (roomMaterial !== baseMaterial && baseMaterial !== ROOM_MATERIAL) {
          baseMaterial.dispose();
        }
        const mesh = new THREE.Mesh(geometry, roomMaterial);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = room.elevation_m + 0.015 + 0.02;
        setMeshIdentity(mesh, `roomFloor:${room.id}`, {
          sourceType: "room",
          sourceId: room.id,
          category: "room-floor",
          levelId: room.levelId,
          temperature_C: room.temperature_C,
          geometrySource: room.geometrySource,
          alignedWithWalls: room.alignedWithWalls,
          selection: { kind: "room", id: room.id } satisfies Selection,
        });
        shellRoot.add(mesh);
      });

      simpleModel.walls.forEach((wall) => {
        addBoxBetween(
          shellRoot,
          wall.start,
          wall.end,
          Math.max(wall.thickness_m, 0.08),
          Math.max(wall.height_m, 2.4),
          wall.elevation_m + wall.height_m * 0.5,
          getSelectionMaterial(selection, "wall", wall.id, WALL_MATERIAL),
          {
            name: `wall:${wall.id}`,
            userData: {
              sourceType: "wall",
              sourceId: wall.id,
              category: "shell",
              selection: { kind: "wall", id: wall.id } satisfies Selection,
            },
          }
        );
      });

      if (viewer.showOpenings) {
        simpleModel.doors.forEach((door) => shellRoot.add(createOpeningMesh(door, selection)));
        simpleModel.windows.forEach((windowItem) => shellRoot.add(createOpeningMesh(windowItem, selection)));
      }

      simpleModel.roofs.forEach((roof) => {
        const shape = buildShape(roof.boundary);
        if (!shape) {
          return;
        }
        const roofDepth = Math.max(roof.thickness_m, 0.05);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: roofDepth, bevelEnabled: false });
        const mesh = new THREE.Mesh(geometry, ROOF_MATERIAL);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = roof.elevation_m + roofDepth;
        setMeshIdentity(mesh, `roof:${roof.id}`, {
          sourceType: "roof",
          sourceId: roof.id,
          category: "roof",
        });
        shellRoot.add(mesh);
      });

      simpleModel.slabs.forEach((slab) => {
        const shape = buildShape(slab.boundary);
        if (!shape) {
          return;
        }
        const slabDepth = Math.max(slab.thickness_m, 0.05);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: slabDepth, bevelEnabled: false });
        const mesh = new THREE.Mesh(geometry, SLAB_MATERIAL);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.y = slab.elevation_m + slabDepth;
        setMeshIdentity(mesh, `slab:${slab.id}`, {
          sourceType: "slab",
          sourceId: slab.id,
          category: "slab",
        });
        shellRoot.add(mesh);
      });

      simpleModel.pipes.forEach((pipe) => {
        pipe.path.slice(1).forEach((point, index) => {
          const start = pipe.path[index];
          addCylinderBetween(
            content,
            new THREE.Vector3(start.x, start.y, start.z),
            new THREE.Vector3(point.x, point.y, point.z),
            Math.max(pipe.diameter_m * 0.5, 0.014),
            pipe.colorRole === "return" ? RETURN_MATERIAL : SUPPLY_MATERIAL,
            {
              name: `pipe:${pipe.id}:segment:${index}`,
              userData: {
                sourceType: "pipe",
                sourceId: pipe.id,
                category: "network",
                colorRole: pipe.colorRole,
              },
            }
          );
        });
      });

      simpleModel.ducts.forEach((duct) => {
        duct.path.slice(1).forEach((point, index) => {
          const start = duct.path[index];
          addBoxBetween(content, { x: start.x, y: start.z }, { x: point.x, y: point.z }, duct.width_m, duct.height_m, start.y, DUCT_MATERIAL, {
            name: `duct:${duct.id}:segment:${index}`,
            userData: {
              sourceType: "duct",
              sourceId: duct.id,
              category: "network",
            },
          });
        });
      });

      simpleModel.equipment.forEach((item) => {
        const material = getSelectionMaterial(selection, "equipment", item.id, EQUIPMENT_MATERIAL);
        const geometry =
          item.type === "pump"
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
        setMeshIdentity(mesh, `equipment:${item.id}`, {
          sourceType: "equipment",
          sourceId: item.id,
          category: "equipment",
          equipmentType: item.type,
          selection: { kind: "equipment", id: item.id } satisfies Selection,
        });
        content.add(mesh);
      });

      simpleModel.sensors.forEach((sensor) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 0.05),
          getSelectionMaterial(selection, "sensor", sensor.id, SENSOR_MATERIAL)
        );
        mesh.position.set(sensor.position.x, sensor.position.y, sensor.position.z);
        setMeshIdentity(mesh, `sensor:${sensor.id}`, {
          sourceType: "sensor",
          sourceId: sensor.id,
          category: "sensor",
          selection: { kind: "sensor", id: sensor.id } satisfies Selection,
        });
        content.add(mesh);
      });

      const gridLayout = calculateRecoveredGrid(simpleModel.bounds);
      grid.position.set(gridLayout.center.x, simpleModel.bounds.empty ? 0 : simpleModel.bounds.minY, gridLayout.center.z);
      grid.scale.set(Math.max(gridLayout.size / 20, 1), 1, Math.max(gridLayout.size / 20, 1));

      const modelKey = [
        simpleModel.levelId ?? "all-levels",
        simpleModel.rooms.length,
        simpleModel.walls.length,
        simpleModel.windows.length,
        simpleModel.doors.length,
        simpleModel.roofs.length,
        simpleModel.slabs.length,
        coloredRoomFloorCount,
        temperatureRuntime.showTemperature ? 1 : 0,
        viewer.showNetworks ? 1 : 0,
        viewer.showEquipment ? 1 : 0,
        viewer.showOpenings ? 1 : 0,
      ].join(":");
      if (lastModelKeyRef.current !== modelKey) {
        lastModelKeyRef.current = modelKey;
        hasInitialFitRef.current = false;
      }
      if (!hasInitialFitRef.current && !simpleModel.bounds.empty) {
        scheduleInitialFit();
      }

      renderCurrentScene();
      if (sceneRef.current) {
        logMeshAudit(sceneRef.current, shellRoot);
      }
    }, [coloredRoomFloorCount, selection, simpleModel, temperatureRuntime.showTemperature, viewer.showNetworks, viewer.showEquipment, viewer.showOpenings]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        getCanvas: () => canvasRef.current,
        focusModel: () => applyCameraMode("focus", true),
        resetView: () => {
          if (!hasInitialFitRef.current) {
            applyCameraMode("focus", true);
            return;
          }
          applyCameraMode(homeModeRef.current, false);
        },
        topView: () => applyCameraMode("top", false),
        zoomToFit: () => applyCameraMode("focus", true),
        setTopView: () => applyCameraMode("top", false),
        focusSelection: () => applyCameraMode("focus", false),
      }),
      [simpleModel.bounds]
    );

    const showTemperatureWarning =
      !temperatureRuntime.disabled &&
      (showTemperature || showWallTemperature) &&
      Boolean(simpleModel.temperatureSummary) &&
      coloredRoomFloorCount === 0;

    return (
      <div className="relative h-full w-full overflow-hidden touch-none">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" />
        {simpleModel.bounds.empty ? (
          <div className="pointer-events-none absolute inset-x-4 top-1/2 z-10 -translate-y-1/2">
            <div className="ui-overlay mx-auto max-w-sm px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">3D</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">3D-модель не построена</p>
              <p className="mt-1 text-sm text-slate-600">В модели нет стен или помещений для 3D-представления.</p>
            </div>
          </div>
        ) : null}
        {temperatureRuntime.disabled && (showTemperature || showWallTemperature) ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10">
            <div className="ui-overlay max-w-[18rem] px-3 py-2.5 text-xs text-slate-600">
              Температурное поле в 3D временно отключено. Используйте 2D или результаты расчета.
            </div>
          </div>
        ) : null}
        {!temperatureRuntime.disabled && simpleModel.temperatureSummary && coloredRoomFloorCount > 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10">
            <div className="ui-overlay max-w-[15rem] px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Температурное поле</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {simpleModel.temperatureSummary.min_C.toFixed(1)}–{simpleModel.temperatureSummary.max_C.toFixed(1)} °C
              </p>
              <p className="mt-1 text-xs text-slate-500">Средняя {simpleModel.temperatureSummary.average_C.toFixed(1)} °C</p>
              <p className="mt-1 text-xs text-slate-500">Температура отображается по помещениям.</p>
              {simpleModel.temperatureSummary.rejectedCount > 0 ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  {simpleModel.temperatureSummary.rejectedCount} поверхностей пропущено
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {showTemperatureWarning ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10">
            <div className="ui-overlay max-w-[16rem] px-3 py-2.5 text-xs text-slate-600">
              {simpleModel.temperatureSummary?.warnings[0] ?? "Температурное поле: нет привязанных данных для 3D."}
            </div>
          </div>
        ) : null}
      </div>
    );
  }
);

Build3DRecoveredPreview.displayName = "Build3DRecoveredPreview";

export default Build3DRecoveredPreview;
