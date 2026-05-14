declare module "react-katex" {
  import type { ComponentType, ReactNode } from "react";

  export interface KatexProps {
    children?: string;
    math?: string;
    errorColor?: string;
    renderError?: (error: Error) => ReactNode;
    settings?: Record<string, unknown>;
  }

  export const InlineMath: ComponentType<KatexProps>;
  export const BlockMath: ComponentType<KatexProps>;
}

interface ImportMetaEnv {
  readonly DEV?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "three" {
  export class Object3D {
    children: Object3D[];
    parent: Object3D | null;
    name: string;
    uuid: string;
    visible: boolean;
    position: { set: (...args: number[]) => void; copy: (value: Vector3) => void; x: number; y: number; z: number };
    up: { set: (...args: number[]) => void; x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    quaternion: { setFromUnitVectors: (from: Vector3, to: Vector3) => void };
    scale: { set: (...args: number[]) => void; multiplyScalar: (value: number) => void; x: number; y: number; z: number };
    renderOrder: number;
    add: (...objects: Object3D[]) => void;
    remove: (...objects: Object3D[]) => void;
    clear: () => void;
    traverse: (callback: (object: Object3D) => void) => void;
    userData: Record<string, unknown>;
  }

  export class Scene extends Object3D {
    background: Color | null;
    fog: Fog | null;
  }

  export class Group extends Object3D {}

  export class Color {
    constructor(value?: number | string);
    r: number;
    g: number;
    b: number;
    getHex(): number;
    getHexString(): string;
    getHSL(target: { h: number; s: number; l: number }): { h: number; s: number; l: number };
    set(value: number | string): void;
    setHex(value: number): void;
  }

  export class Mesh<TGeometry = unknown, TMaterial = unknown> extends Object3D {
    constructor(geometry?: TGeometry, material?: TMaterial);
    geometry: { dispose: () => void; clone: () => unknown };
    material: TMaterial;
    castShadow: boolean;
    receiveShadow: boolean;
  }

  export class MeshStandardMaterial {
    constructor(parameters?: Record<string, unknown>);
    type: string;
    color: { set: (value: number | string) => void; setHex: (value: number) => void };
    emissive: { set: (value: number | string) => void };
    opacity: number;
    transparent: boolean;
    emissiveIntensity: number;
    roughness: number;
    metalness: number;
    depthWrite: boolean;
    dispose(): void;
    clone(): MeshStandardMaterial;
  }

  export type Material = MeshStandardMaterial;

  export class Box3 {
    constructor(min?: Vector3, max?: Vector3);
    min: Vector3;
    max: Vector3;
    setFromObject(object: Object3D): Box3;
    isEmpty(): boolean;
    getSize(target: Vector3): Vector3;
    getCenter(target: Vector3): Vector3;
    intersectsBox(box: Box3): boolean;
  }

  export class BoxGeometry {
    constructor(...args: number[]);
    dispose(): void;
  }

  export class EdgesGeometry {
    constructor(geometry?: unknown);
    dispose(): void;
  }

  export class CylinderGeometry {
    constructor(...args: number[]);
    dispose(): void;
  }

  export class SphereGeometry {
    constructor(...args: number[]);
    dispose(): void;
  }

  export class ExtrudeGeometry {
    constructor(shape: Shape, options?: Record<string, unknown>);
    rotateX(radians: number): void;
    translate(x: number, y: number, z: number): void;
    dispose(): void;
  }

  export class BufferGeometry {
    constructor();
    setAttribute(name: string, attribute: unknown): BufferGeometry;
    setIndex(indices: number[]): BufferGeometry;
    setFromPoints(points: Vector3[]): BufferGeometry;
    computeVertexNormals(): void;
    dispose(): void;
  }

  export class Float32BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number);
  }

  export class Shape {
    constructor(points?: Vector2[]);
    holes: Path[];
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    closePath(): void;
  }

  export class Path {
    constructor(points?: Vector2[]);
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    closePath(): void;
  }

  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
  }

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    length(): number;
    normalize(): Vector3;
    clone(): Vector3;
    copy(value: Vector3): Vector3;
  }

  export class Fog {
    constructor(color?: number | string, near?: number, far?: number);
  }

  export class PerspectiveCamera extends Object3D {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    aspect: number;
    lookAt(x: number, y: number, z: number): void;
    updateProjectionMatrix(): void;
  }

  export class WebGLRenderer {
    constructor(options?: Record<string, unknown>);
    domElement: HTMLCanvasElement;
    clippingPlanes: Plane[];
    shadowMap: { enabled: boolean; type: number };
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setAnimationLoop(callback: (() => void) | null): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
    dispose(): void;
  }

  export class AmbientLight extends Object3D {
    constructor(color?: number | string, intensity?: number);
  }

  export class HemisphereLight extends Object3D {
    constructor(skyColor?: number | string, groundColor?: number | string, intensity?: number);
  }

  export class DirectionalLight extends Object3D {
    constructor(color?: number | string, intensity?: number);
    castShadow: boolean;
    shadow: {
      mapSize: { set: (width: number, height: number) => void };
      camera: { near: number; far: number };
    };
  }

  export class GridHelper extends Object3D {
    constructor(size?: number, divisions?: number, colorCenterLine?: number | string, colorGrid?: number | string);
    material: Material | Material[];
  }

  export class Plane {
    constructor(normal?: Vector3, constant?: number);
    normal: Vector3;
    constant: number;
  }

  export class Raycaster {
    setFromCamera(pointer: Vector2, camera: PerspectiveCamera): void;
    intersectObjects(objects: Object3D[], recursive?: boolean): Array<{ object: Object3D; point: Vector3 }>;
  }

  export class LineBasicMaterial {
    constructor(parameters?: Record<string, unknown>);
    dispose(): void;
  }

  export class LineDashedMaterial extends LineBasicMaterial {
    constructor(parameters?: Record<string, unknown>);
  }

  export class LineSegments<TGeometry = unknown, TMaterial = unknown> extends Object3D {
    constructor(geometry?: TGeometry, material?: TMaterial);
    geometry: TGeometry;
    material: TMaterial;
    renderOrder: number;
  }

  export class Line<TGeometry = unknown, TMaterial = unknown> extends Object3D {
    constructor(geometry?: TGeometry, material?: TMaterial);
    geometry: TGeometry;
    material: TMaterial;
    renderOrder: number;
    computeLineDistances(): void;
  }

  export class Points<TGeometry = unknown, TMaterial = unknown> extends Object3D {
    constructor(geometry?: TGeometry, material?: TMaterial);
    geometry: TGeometry;
    material: TMaterial;
  }

  export class PointsMaterial {
    constructor(parameters?: Record<string, unknown>);
    dispose(): void;
  }

  export class EllipseCurve {
    constructor(
      aX?: number,
      aY?: number,
      xRadius?: number,
      yRadius?: number,
      aStartAngle?: number,
      aEndAngle?: number,
      aClockwise?: boolean,
      aRotation?: number
    );
    getPoints(divisions?: number): Vector2[];
  }

  export const MathUtils: {
    degToRad: (degrees: number) => number;
    lerp: (x: number, y: number, t: number) => number;
  };

  export const ShapeUtils: {
    triangulateShape(contour: Vector2[], holes: Vector2[][]): Array<[number, number, number]>;
  };

  export class MeshBasicMaterial {
    constructor(parameters?: Record<string, unknown>);
    dispose(): void;
  }

  export const DoubleSide: number;
  export const BackSide: number;
  export const PCFSoftShadowMap: number;
  export const MOUSE: {
    LEFT: number;
    MIDDLE: number;
    RIGHT: number;
    ROTATE: number;
    DOLLY: number;
    PAN: number;
  };
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  export { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
}
