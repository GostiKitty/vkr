import { create } from "zustand";

import { createEmptyBuildingModel } from "../../entities/geometry/types";
import { createEmptyEngineeringSystems, type EngineeringEquipment, type EngineeringPipe } from "../../entities/engineering/types";

import type {

  BuildingModel,

  Door,
  FloorSlab,

  Level,
  Roof,

  Room,
  Stair,

  Wall,

  Window,

} from "../../entities/geometry/types";

import type { BuildingEvent, DuctNetwork, Equipment, OperationalScenario, PipeNetwork, SensorDevice } from "../../entities/networks/types";
import { DEFAULT_OPERATIONAL_SCENARIOS } from "../../entities/networks/types";
import { normalizeFlowDirection, resolveNetworkSystemType, resolvePipeCircuitRole } from "../../entities/networks/types";

import { type SolarTimeInput } from "../../core/solar/solarShading";
import { createId } from "../../shared/utils/id";
import { normalizeModelRoomNames } from "../../shared/utils/roomNames";
import { bumpModelRevision, ensureModelRevision, getModelRevision } from "../../shared/utils/modelSync";
import { DEFAULT_LOCAL_PROJECT_KEY } from "../../shared/utils/projectRuntime";

import { detectRoomsFromWalls, type RoomLoopCandidate, type RoomProblem } from "./auto/detectRoomsFromWalls";
import { pruneSubdividedManualRooms, reassignEntitiesFromRemovedRooms } from "./auto/pruneSubdividedManualRooms";
import { splitWallsAtJunctions } from "./auto/splitWallsAtJunctions";
import { normalizeWallTopology } from "./auto/wallTopology";
import { createPipeDefaults } from "./defaults";
import { normalizeEngineeringEquipment,
  normalizeEngineeringPipe,
  normalizeEngineeringSystems,
  rebuildEngineeringSystemsForEquipment,
} from "./engineering2d/catalog";
import { syncAndEnrichThermalProtection } from "./envelope/syncAndEnrichThermalProtection";
import { isWebProductionRuntime } from "../../shared/runtime/webProduction";



export type BuildTool =
  | "select"
  | "move"
  | "roomRect"
  | "room"
  | "wall"
  | "roof"
  | "slab"
  | "door"
  | "window"
  | "stair"
  | "erase"
  | "pipe"
  | "duct"
  | "equipment"
  | "sensor"
  | "engineeringEquipment"
  | "engineeringPipe";



export type Selection =

  | { kind: "room"; id: string }

  | { kind: "wall"; id: string }

  | { kind: "roof"; id: string }

  | { kind: "slab"; id: string }

  | { kind: "stair"; id: string }

  | { kind: "door"; id: string }

  | { kind: "window"; id: string }

  | { kind: "pipe"; id: string }

  | { kind: "duct"; id: string }

  | { kind: "equipment"; id: string }

  | { kind: "sensor"; id: string }

  | { kind: "engineeringEquipment"; id: string }

  | { kind: "engineeringPipe"; id: string }

  | { kind: "loop"; id: string }

  | null;

export interface BuildMutationOptions {
  resetSelection?: boolean;
  recalcRooms?: boolean;
  trackHistory?: boolean;
  persist?: boolean;
}



interface PersistedBuildState {

  model: BuildingModel;

  activeLevelId: string | null;

  selection: Selection;

  tool: BuildTool;

  gridStep: number;

  orthogonalMode: boolean;

  adjacencyOverlay: boolean;

  loopDebugOverlay: boolean;

}



interface SnapshotPayload extends PersistedBuildState {

  savedAt: number;

}



type PersistableSlice = Pick<

  BuildStoreState,

  "activeLevelId" | "selection" | "tool" | "gridStep" | "orthogonalMode" | "adjacencyOverlay" | "loopDebugOverlay"

>;



interface BuildStoreState {

  projectKey: string;

  model: BuildingModel;

  modelRevision: number;

  activeLevelId: string | null;

  selection: Selection;

  tool: BuildTool;

  gridStep: number;

  orthogonalMode: boolean;

  adjacencyOverlay: boolean;

  loopDebugOverlay: boolean;

  /** Солнечное время для 3D и расчёта затенения окон (виджет в конструкторе). */
  solarTime: SolarTimeInput;

  hasSnapshot: boolean;

  history: BuildingModel[];

  future: BuildingModel[];

  roomProblems: RoomProblem[];

  roomLoops: RoomLoopCandidate[];

  setProjectKey: (key: string | null) => void;

  setTool: (tool: BuildTool) => void;

  setSelection: (selection: Selection) => void;

  setGridStep: (grid: number) => void;

  setOrthogonalMode: (value: boolean) => void;

  setAdjacencyOverlay: (value: boolean) => void;

  setLoopDebugOverlay: (value: boolean) => void;

  setSolarTime: (patch: Partial<SolarTimeInput>) => void;

  addLevel: (level: Omit<Level, "id"> & { id?: string }) => void;

  updateLevel: (levelId: string, patch: Partial<Level>) => void;

  setActiveLevel: (levelId: string) => void;

  addRoom: (room: Room) => void;

  updateRoom: (roomId: string, patch: Partial<Room>) => void;

  removeRoom: (roomId: string) => void;

  addWall: (wall: Wall) => void;

  setWalls: (walls: Wall[]) => void;

  updateWall: (wallId: string, patch: Partial<Wall>) => void;

  removeWall: (wallId: string) => void;

  addRoof: (roof: Roof) => void;

  updateRoof: (roofId: string, patch: Partial<Roof>) => void;

  removeRoof: (roofId: string) => void;

  addFloorSlab: (slab: FloorSlab) => void;

  updateFloorSlab: (slabId: string, patch: Partial<FloorSlab>) => void;

  removeFloorSlab: (slabId: string) => void;

  addStair: (stair: Stair) => void;

  updateStair: (stairId: string, patch: Partial<Stair>) => void;

  removeStair: (stairId: string) => void;

  addDoor: (door: Door) => void;

  updateDoor: (doorId: string, patch: Partial<Door>) => void;

  removeDoor: (doorId: string) => void;

  addWindow: (window: Window) => void;

  updateWindow: (windowId: string, patch: Partial<Window>) => void;

  removeWindow: (windowId: string) => void;

  addPipe: (pipe: PipeNetwork) => void;

  updatePipe: (pipeId: string, patch: Partial<PipeNetwork>, options?: BuildMutationOptions) => void;

  removePipe: (pipeId: string) => void;

  addDuct: (duct: DuctNetwork) => void;

  updateDuct: (ductId: string, patch: Partial<DuctNetwork>, options?: BuildMutationOptions) => void;

  removeDuct: (ductId: string) => void;

  addEquipment: (equipment: Equipment) => void;

  updateEquipment: (equipmentId: string, patch: Partial<Equipment>, options?: BuildMutationOptions) => void;

  removeEquipment: (equipmentId: string) => void;

  addSensor: (sensor: SensorDevice) => void;

  updateSensor: (sensorId: string, patch: Partial<SensorDevice>, options?: BuildMutationOptions) => void;

  removeSensor: (sensorId: string) => void;

  addEngineeringEquipment: (equipment: EngineeringEquipment) => void;

  updateEngineeringEquipment: (equipmentId: string, patch: Partial<EngineeringEquipment>, options?: BuildMutationOptions) => void;

  removeEngineeringEquipment: (equipmentId: string) => void;

  addEngineeringPipe: (pipe: EngineeringPipe) => void;

  updateEngineeringPipe: (pipeId: string, patch: Partial<EngineeringPipe>, options?: BuildMutationOptions) => void;

  removeEngineeringPipe: (pipeId: string) => void;

  setEngineeringSystems: (systems: { equipment: EngineeringEquipment[]; pipes: EngineeringPipe[] }, options?: BuildMutationOptions) => void;

  setActiveScenario: (scenarioId: string | null) => void;

  upsertScenario: (scenario: OperationalScenario) => void;

  removeScenario: (scenarioId: string) => void;

  addEvent: (event: BuildingEvent, options?: BuildMutationOptions) => void;

  updateEvent: (eventId: string, patch: Partial<BuildingEvent>, options?: BuildMutationOptions) => void;

  removeEvent: (eventId: string, options?: BuildMutationOptions) => void;

  resetModel: () => void;

  undo: () => void;

  redo: () => void;

  createRoomFromLoop: (loopId: string) => string | null;

  saveSnapshot: () => void;

  restoreSnapshot: () => boolean;
  loadModelSnapshot: (model: BuildingModel) => void;

}



const STORAGE_PREFIX = "twinstudio.build";

const SNAPSHOT_SUFFIX = ".snapshot";

const HISTORY_LIMIT = 50;

const DEFAULT_GRID_STEP = 0.5;

const DEFAULT_TOOL: BuildTool = "roomRect";

export const DEFAULT_SOLAR_TIME: SolarTimeInput = {
  hour: 12,
  dayOfYear: 172,
  latitudeDeg: 55.75,
};



const defaultLevel = (): Level => ({

  id: createId("lvl"),

  name: "Уровень 1",

  elevation_m: 0,

  height_m: 3,

});



const createDefaultModel = (): BuildingModel => {

  const model = createEmptyBuildingModel();

  const level = defaultLevel();

  return ensureModelRevision({

    ...model,

    levels: [level],

    scenarios: DEFAULT_OPERATIONAL_SCENARIOS.map((scenario) => ({
      ...scenario,
      impact: {
        ...scenario.impact,
        equipmentStateOverrides: { ...scenario.impact.equipmentStateOverrides },
      },
    })),

    activeScenarioId: DEFAULT_OPERATIONAL_SCENARIOS[0]?.id ?? null,

  }).model;

};

const normalizeOpeningAnchor = (
  anchor: Partial<Door["anchor"]> | Partial<Window["anchor"]> | null | undefined
): Door["anchor"] => ({
  wallId: typeof anchor?.wallId === "string" ? anchor.wallId : null,
  t: typeof anchor?.t === "number" && Number.isFinite(anchor.t) ? anchor.t : 0,
  offset_m: typeof anchor?.offset_m === "number" && Number.isFinite(anchor.offset_m) ? anchor.offset_m : 0,
});



const storageKey = (projectKey: string) => `${STORAGE_PREFIX}.${projectKey}`;
const snapshotStorageKey = (projectKey: string) => `${storageKey(projectKey)}${SNAPSHOT_SUFFIX}`;


const saveStateToStorage = (projectKey: string, payload: PersistedBuildState) => {

  if (typeof window === "undefined") {

    return;

  }

  try {

    window.localStorage.setItem(storageKey(projectKey), JSON.stringify(payload));

  } catch {

    // ignore quota errors

  }

};



const loadPersistedState = (projectKey: string): PersistedBuildState | null => {

  if (typeof window === "undefined") {

    return null;

  }

  try {

    const raw = window.localStorage.getItem(storageKey(projectKey));

    if (!raw) {

      return null;

    }

    const parsed = JSON.parse(raw) as unknown;

    return normalizePersistedState(parsed);

  } catch {

    return null;

  }

};



const saveSnapshotPayload = (projectKey: string, payload: SnapshotPayload) => {

  if (typeof window === "undefined") {

    return;

  }

  try {

    window.localStorage.setItem(snapshotStorageKey(projectKey), JSON.stringify(payload));

  } catch {

    // ignore quota errors

  }

};



const loadSnapshotPayload = (projectKey: string): SnapshotPayload | null => {

  if (typeof window === "undefined") {

    return null;

  }

  try {

    const raw = window.localStorage.getItem(snapshotStorageKey(projectKey));

    if (!raw) {

      return null;

    }

    const parsed = JSON.parse(raw) as SnapshotPayload;

    return {

      ...parsed,

      selection: parsed.selection ?? null,

    };

  } catch {

    return null;

  }

};



const hasSnapshotStored = (projectKey: string): boolean => {

  if (typeof window === "undefined") {

    return false;

  }

  return Boolean(window.localStorage.getItem(snapshotStorageKey(projectKey)));

};



const normalizeModel = (model: BuildingModel | null | undefined): BuildingModel => {

  if (!model) {

    return createDefaultModel();

  }

  return ensureModelRevision({

    ...createEmptyBuildingModel(),

    ...model,

    levels: Array.isArray(model.levels) && model.levels.length ? model.levels : [defaultLevel()],

    rooms: Array.isArray(model.rooms) ? model.rooms.map((room) => ({

      ...room,

      polygon: room.polygon ?? [],

      source: room.source ?? "manual",

    })) : [],

    walls: Array.isArray(model.walls)
      ? model.walls.map((wall) => ({
          ...wall,
          a: wall.a ?? { x: 0, y: 0 },
          b: wall.b ?? { x: 0, y: 0 },
          thickness_m: typeof wall.thickness_m === "number" && Number.isFinite(wall.thickness_m) ? wall.thickness_m : 0.2,
          height_m: typeof wall.height_m === "number" && Number.isFinite(wall.height_m) ? wall.height_m : 3,
        }))
      : [],

    roofs: Array.isArray(model.roofs)
      ? model.roofs.map((roof) => ({
          ...roof,
          boundary: Array.isArray(roof.boundary) ? roof.boundary.map((point) => ({ x: point?.x ?? 0, y: point?.y ?? 0 })) : [],
          kind: roof.kind === "pitched" ? "pitched" : "flat",
          elevationBase_m:
            typeof roof.elevationBase_m === "number" && Number.isFinite(roof.elevationBase_m) ? roof.elevationBase_m : 0,
          thickness_m: typeof roof.thickness_m === "number" && Number.isFinite(roof.thickness_m) ? roof.thickness_m : 0.24,
          slope:
            roof.slope && Number.isFinite(roof.slope.directionDeg) && Number.isFinite(roof.slope.risePerMeter)
              ? { directionDeg: roof.slope.directionDeg, risePerMeter: roof.slope.risePerMeter }
              : undefined,
          layers: roof.layers?.map((layer) => ({ ...layer })),
          assemblyId: roof.assemblyId ?? null,
          heatedSide: roof.heatedSide === "above" ? "above" : "below",
        }))
      : [],

    floorSlabs: Array.isArray(model.floorSlabs)
      ? model.floorSlabs.map((slab) => ({
          ...slab,
          boundary: Array.isArray(slab.boundary) ? slab.boundary.map((point) => ({ x: point?.x ?? 0, y: point?.y ?? 0 })) : [],
          kind:
            slab.kind === "attic" || slab.kind === "basement" || slab.kind === "ground"
              ? slab.kind
              : "interfloor",
          elevation_m: typeof slab.elevation_m === "number" && Number.isFinite(slab.elevation_m) ? slab.elevation_m : 0,
          thickness_m: typeof slab.thickness_m === "number" && Number.isFinite(slab.thickness_m) ? slab.thickness_m : 0.22,
          layers: slab.layers?.map((layer) => ({ ...layer })),
          assemblyId: slab.assemblyId ?? null,
          heatedSide: slab.heatedSide === "above" ? "above" : "below",
        }))
      : [],

    doors: Array.isArray(model.doors)
      ? model.doors.map((door) => ({
          ...door,
          anchor: normalizeOpeningAnchor(door.anchor),
          width_m: typeof door.width_m === "number" && Number.isFinite(door.width_m) ? door.width_m : 0.9,
          height_m: typeof door.height_m === "number" && Number.isFinite(door.height_m) ? door.height_m : 2.1,
        }))
      : [],

    windows: Array.isArray(model.windows)
      ? model.windows.map((window) => ({
          ...window,
          anchor: normalizeOpeningAnchor(window.anchor),
          width_m: typeof window.width_m === "number" && Number.isFinite(window.width_m) ? window.width_m : 1.2,
          height_m: typeof window.height_m === "number" && Number.isFinite(window.height_m) ? window.height_m : 1.4,
          sill_m: typeof window.sill_m === "number" && Number.isFinite(window.sill_m) ? window.sill_m : 0.9,
        }))
      : [],

    pipes: Array.isArray(model.pipes)
      ? model.pipes.map((pipe) => {
          const pipeType =
            pipe.type === "heating_return" || pipe.type === "dhw" || pipe.type === "chw"
              ? pipe.type
              : "heating_supply";
          const legacySystemType = typeof (pipe as { systemType?: unknown }).systemType === "string" ? (pipe as { systemType?: string }).systemType : null;
          const defaults = createPipeDefaults(pipeType);
          return {
            ...defaults,
            ...pipe,
            type: pipeType,
            path: Array.isArray(pipe.path) ? pipe.path.map((point) => ({ x: point?.x ?? 0, y: point?.y ?? 0 })) : [],
            heatingSystemId: pipe.heatingSystemId ?? defaults.heatingSystemId ?? null,
            systemType:
              pipe.systemType === "heating" || pipe.systemType === "water" || pipe.systemType === "ventilation" || pipe.systemType === "custom"
                ? pipe.systemType
                : resolveNetworkSystemType(pipeType),
            heatingSystemKind:
              pipe.heatingSystemKind === "single_pipe" || pipe.heatingSystemKind === "collector"
                ? pipe.heatingSystemKind
                : legacySystemType === "two_pipe" || legacySystemType === "single_pipe" || legacySystemType === "collector"
                  ? legacySystemType
                : "two_pipe",
            flowRole: pipe.flowRole ?? defaults.flowRole,
            circuitRole:
              pipe.circuitRole === "supply" || pipe.circuitRole === "return" || pipe.circuitRole === "mixed" || pipe.circuitRole === "unknown"
                ? pipe.circuitRole
                : resolvePipeCircuitRole(pipeType),
            segmentClass: pipe.segmentClass ?? defaults.segmentClass,
            flowDirection: normalizeFlowDirection((pipe.flowDirection ?? defaults.flowDirection) as PipeNetwork["flowDirection"] | "reverse" | undefined),
            heatCarrier: pipe.heatCarrier ?? defaults.heatCarrier,
            diameter_mm: typeof pipe.diameter_mm === "number" && Number.isFinite(pipe.diameter_mm) ? pipe.diameter_mm : defaults.diameter_mm,
            innerDiameter_mm:
              typeof pipe.innerDiameter_mm === "number" && Number.isFinite(pipe.innerDiameter_mm)
                ? pipe.innerDiameter_mm
                : defaults.innerDiameter_mm,
            material: pipe.material ?? defaults.material,
            insulationThickness_mm:
              typeof pipe.insulationThickness_mm === "number" && Number.isFinite(pipe.insulationThickness_mm)
                ? pipe.insulationThickness_mm
                : defaults.insulationThickness_mm,
            insulationConductivity_W_mK:
              typeof pipe.insulationConductivity_W_mK === "number" && Number.isFinite(pipe.insulationConductivity_W_mK)
                ? pipe.insulationConductivity_W_mK
                : defaults.insulationConductivity_W_mK,
            roughness_mm:
              typeof pipe.roughness_mm === "number" && Number.isFinite(pipe.roughness_mm)
                ? pipe.roughness_mm
                : defaults.roughness_mm,
            fluidTemperatureC:
              typeof pipe.fluidTemperatureC === "number" && Number.isFinite(pipe.fluidTemperatureC)
                ? pipe.fluidTemperatureC
                : defaults.fluidTemperatureC,
            designIndoorTemperatureC:
              typeof pipe.designIndoorTemperatureC === "number" && Number.isFinite(pipe.designIndoorTemperatureC)
                ? pipe.designIndoorTemperatureC
                : defaults.designIndoorTemperatureC,
            designOutdoorTemperatureC:
              typeof pipe.designOutdoorTemperatureC === "number" && Number.isFinite(pipe.designOutdoorTemperatureC)
                ? pipe.designOutdoorTemperatureC
                : defaults.designOutdoorTemperatureC,
            temperatureDropC:
              typeof pipe.temperatureDropC === "number" && Number.isFinite(pipe.temperatureDropC)
                ? pipe.temperatureDropC
                : defaults.temperatureDropC,
            flowRate_kg_s:
              typeof pipe.flowRate_kg_s === "number" && Number.isFinite(pipe.flowRate_kg_s) ? pipe.flowRate_kg_s : defaults.flowRate_kg_s,
            designVelocity_m_s:
              typeof pipe.designVelocity_m_s === "number" && Number.isFinite(pipe.designVelocity_m_s)
                ? pipe.designVelocity_m_s
                : defaults.designVelocity_m_s,
            pressurePa: typeof pipe.pressurePa === "number" && Number.isFinite(pipe.pressurePa) ? pipe.pressurePa : defaults.pressurePa,
            pressureDropPa:
              typeof pipe.pressureDropPa === "number" && Number.isFinite(pipe.pressureDropPa)
                ? pipe.pressureDropPa
                : defaults.pressureDropPa,
            heatLossW:
              typeof pipe.heatLossW === "number" && Number.isFinite(pipe.heatLossW) ? pipe.heatLossW : defaults.heatLossW,
            connectedEquipmentIds: Array.isArray(pipe.connectedEquipmentIds) ? [...pipe.connectedEquipmentIds] : [],
          };
        })
      : [],

    ducts: Array.isArray(model.ducts)
      ? model.ducts.map((duct) => ({
          ...duct,
          path: Array.isArray(duct.path) ? duct.path.map((point) => ({ x: point?.x ?? 0, y: point?.y ?? 0 })) : [],
          section: { ...duct.section },
          airflow_m3_s:
            typeof duct.airflow_m3_s === "number" && Number.isFinite(duct.airflow_m3_s) ? duct.airflow_m3_s : 0.35,
          airVelocity_m_s:
            typeof duct.airVelocity_m_s === "number" && Number.isFinite(duct.airVelocity_m_s)
              ? duct.airVelocity_m_s
              : 2.5,
          connectedEquipmentIds: Array.isArray(duct.connectedEquipmentIds) ? [...duct.connectedEquipmentIds] : [],
        }))
      : [],

    equipment: Array.isArray(model.equipment)
      ? model.equipment.map((equipment) => ({
          ...equipment,
          position: { x: equipment.position?.x ?? 0, y: equipment.position?.y ?? 0 },
          roomId: equipment.roomId ?? null,
          params: { ...(equipment.params ?? {}) },
          connectedNetworkIds: Array.isArray(equipment.connectedNetworkIds) ? [...equipment.connectedNetworkIds] : [],
        }))
      : [],

    sensors: Array.isArray(model.sensors)
      ? model.sensors.map((sensor) => ({
          ...sensor,
          position: { x: sensor.position?.x ?? 0, y: sensor.position?.y ?? 0 },
          roomId: sensor.roomId ?? null,
          value: typeof sensor.value === "number" && Number.isFinite(sensor.value) ? sensor.value : null,
          history: Array.isArray(sensor.history)
            ? sensor.history.map((item) => ({ timestamp: item.timestamp, value: item.value }))
            : [],
        }))
      : [],

    scenarios: Array.isArray(model.scenarios) && model.scenarios.length
      ? model.scenarios.map((scenario) => ({
          ...scenario,
          impact: {
            ...scenario.impact,
            equipmentStateOverrides: { ...scenario.impact.equipmentStateOverrides },
          },
        }))
      : DEFAULT_OPERATIONAL_SCENARIOS.map((scenario) => ({
          ...scenario,
          impact: {
            ...scenario.impact,
            equipmentStateOverrides: { ...scenario.impact.equipmentStateOverrides },
          },
        })),

    activeScenarioId:
      typeof model.activeScenarioId === "string" ? model.activeScenarioId : DEFAULT_OPERATIONAL_SCENARIOS[0]?.id ?? null,

    events: Array.isArray(model.events)
      ? model.events.map((event) => ({
          ...event,
          acknowledged: Boolean(event.acknowledged),
        }))
      : [],

    engineeringSystems: normalizeEngineeringSystems(model.engineeringSystems ?? createEmptyEngineeringSystems()),

  }).model;

};



const normalizePersistedState = (input: unknown): PersistedBuildState => {

  if (isPersistedState(input)) {

    const persisted = input as PersistedBuildState;

    return {

      model: normalizeModel(persisted.model),

      activeLevelId: persisted.activeLevelId ?? null,

      selection: persisted.selection ?? null,

      tool: persisted.tool ?? DEFAULT_TOOL,

      gridStep: typeof persisted.gridStep === "number" ? Math.max(0, persisted.gridStep) : DEFAULT_GRID_STEP,

      orthogonalMode: persisted.orthogonalMode ?? true,

      adjacencyOverlay: persisted.adjacencyOverlay ?? false,

      loopDebugOverlay: persisted.loopDebugOverlay ?? false,

    };

  }

  if (isLegacyModel(input)) {

    const model = normalizeModel(input as BuildingModel);

    return {

      ...createDefaultPersistedState(),

      model,

    };

  }

  return createDefaultPersistedState();

};



const isPersistedState = (value: unknown): value is PersistedBuildState => {

  if (!value || typeof value !== "object") {

    return false;

  }

  return "model" in (value as Record<string, unknown>);

};



const isLegacyModel = (value: unknown): value is BuildingModel => {

  if (!value || typeof value !== "object") {

    return false;

  }

  const candidate = value as Partial<BuildingModel>;

  return Array.isArray(candidate.levels) && Array.isArray(candidate.rooms);

};



const createDefaultPersistedState = (): PersistedBuildState => {

  const model = createDefaultModel();

  return {

    model,

    activeLevelId: model.levels[0]?.id ?? null,

    selection: null,

    tool: DEFAULT_TOOL,

    gridStep: DEFAULT_GRID_STEP,

    orthogonalMode: true,

    adjacencyOverlay: false,

    loopDebugOverlay: false,

  };

};



const sanitizeSelection = (selection: Selection, model: BuildingModel): Selection => {

  if (!selection) {

    return null;

  }

  switch (selection.kind) {

    case "room":

      return model.rooms.some((room) => room.id === selection.id) ? selection : null;

    case "wall":

      return model.walls.some((wall) => wall.id === selection.id) ? selection : null;

    case "roof":

      return (model.roofs ?? []).some((roof) => roof.id === selection.id) ? selection : null;

    case "slab":

      return (model.floorSlabs ?? []).some((slab) => slab.id === selection.id) ? selection : null;

    case "door":

      return model.doors.some((door) => door.id === selection.id) ? selection : null;

    case "window":

      return model.windows.some((window) => window.id === selection.id) ? selection : null;

    case "pipe":

      return model.pipes.some((pipe) => pipe.id === selection.id) ? selection : null;

    case "duct":

      return model.ducts.some((duct) => duct.id === selection.id) ? selection : null;

    case "equipment":

      return model.equipment.some((equipment) => equipment.id === selection.id) ? selection : null;

    case "sensor":

      return model.sensors.some((sensor) => sensor.id === selection.id) ? selection : null;

    case "engineeringEquipment":

      return (model.engineeringSystems?.equipment ?? []).some((equipment) => equipment.id === selection.id) ? selection : null;

    case "engineeringPipe":

      return (model.engineeringSystems?.pipes ?? []).some((pipe) => pipe.id === selection.id) ? selection : null;

    default:

      return null;

  }

};



const ensureActiveLevel = (candidate: string | null, model: BuildingModel): string | null => {

  if (candidate && model.levels.some((level) => level.id === candidate)) {

    return candidate;

  }

  return model.levels[0]?.id ?? null;

};



const buildSnapshotFromState = (model: BuildingModel, slice: PersistableSlice): PersistedBuildState => ({

  model,

  activeLevelId: ensureActiveLevel(slice.activeLevelId, model),

  selection: sanitizeSelection(slice.selection, model),

  tool: slice.tool ?? DEFAULT_TOOL,

  gridStep: typeof slice.gridStep === "number" ? slice.gridStep : DEFAULT_GRID_STEP,

  orthogonalMode: slice.orthogonalMode ?? true,

  adjacencyOverlay: slice.adjacencyOverlay ?? false,

  loopDebugOverlay: slice.loopDebugOverlay ?? false,

});



const cloneWallEntity = (wall: Wall): Wall => ({

  ...wall,

  a: { ...wall.a },

  b: { ...wall.b },

  layers: wall.layers?.map((layer) => ({ ...layer })),

});

const cloneRoofEntity = (roof: Roof): Roof => ({

  ...roof,

  boundary: roof.boundary.map((point) => ({ ...point })),

  slope: roof.slope ? { ...roof.slope } : undefined,

  layers: roof.layers?.map((layer) => ({ ...layer })),

});

const cloneFloorSlabEntity = (slab: FloorSlab): FloorSlab => ({

  ...slab,

  boundary: slab.boundary.map((point) => ({ ...point })),

  layers: slab.layers?.map((layer) => ({ ...layer })),

});

const cloneStairEntity = (stair: Stair): Stair => ({

  ...stair,

  boundary: stair.boundary.map((point) => ({ ...point })),

});



const cloneDoorEntity = (door: Door): Door => ({

  ...door,

  anchor: { ...door.anchor },

});



const cloneWindowEntity = (window: Window): Window => ({

  ...window,

  anchor: { ...window.anchor },

});



const cloneModel = (model: BuildingModel): BuildingModel => ({

  ...model,

  meta: { ...(model.meta ?? {}) },

  levels: model.levels.map((level) => ({ ...level })),

  rooms: model.rooms.map((room) => ({ ...room, polygon: room.polygon.map((point) => ({ ...point })) })),

  walls: model.walls.map(cloneWallEntity),

  roofs: (model.roofs ?? []).map(cloneRoofEntity),

  floorSlabs: (model.floorSlabs ?? []).map(cloneFloorSlabEntity),

  stairs: (model.stairs ?? []).map(cloneStairEntity),

  doors: model.doors.map(cloneDoorEntity),

  windows: model.windows.map(cloneWindowEntity),

  pipes: model.pipes.map((pipe) => ({
    ...pipe,
    path: pipe.path.map((point) => ({ ...point })),
    connectedEquipmentIds: [...pipe.connectedEquipmentIds],
  })),

  ducts: model.ducts.map((duct) => ({
    ...duct,
    path: duct.path.map((point) => ({ ...point })),
    section: { ...duct.section },
    connectedEquipmentIds: [...duct.connectedEquipmentIds],
  })),

  equipment: model.equipment.map((equipment) => ({
    ...equipment,
    position: { ...equipment.position },
    params: { ...equipment.params },
    connectedNetworkIds: [...equipment.connectedNetworkIds],
  })),

  sensors: model.sensors.map((sensor) => ({
    ...sensor,
    position: { ...sensor.position },
    history: sensor.history.map((item) => ({ ...item })),
  })),

  scenarios: model.scenarios.map((scenario) => ({
    ...scenario,
    impact: {
      ...scenario.impact,
      equipmentStateOverrides: { ...scenario.impact.equipmentStateOverrides },
    },
  })),

  activeScenarioId: model.activeScenarioId,

  events: model.events.map((event) => ({ ...event })),

});



const reconcileWallModel = (
  model: BuildingModel,
  nextWalls: Wall[],
  openings?: { doors?: Door[]; windows?: Window[] }
): BuildingModel => {

  const normalized = normalizeWallTopology({
    previousWalls: model.walls,
    nextWalls: nextWalls.map(cloneWallEntity),
    doors: (openings?.doors ?? model.doors).map(cloneDoorEntity),
    windows: (openings?.windows ?? model.windows).map(cloneWindowEntity),
  });

  return {
    ...model,
    walls: normalized.walls,
    doors: normalized.doors,
    windows: normalized.windows,
  };

};



const mergeAutoRooms = (model: BuildingModel): { model: BuildingModel; problems: RoomProblem[]; loops: RoomLoopCandidate[] } => {

  const manualRooms = model.rooms.filter((room) => room.source !== "auto");

  const baseModel: BuildingModel = { ...model, rooms: manualRooms };

  const { rooms: autoRooms, problems, loops } = detectRoomsFromWalls(baseModel);

  const { kept: prunedManualRooms, removedIds } = pruneSubdividedManualRooms(manualRooms, loops, autoRooms);

  const rooms = [...prunedManualRooms, ...autoRooms];

  const mergedModel = removedIds.size
    ? reassignEntitiesFromRemovedRooms({ ...baseModel, rooms }, removedIds, rooms)
    : { ...baseModel, rooms };

  return {

    model: mergedModel,

    problems,

    loops,

  };

};



const prepareModelForEditing = (
  model: BuildingModel
): { model: BuildingModel; problems: RoomProblem[]; loops: RoomLoopCandidate[] } => {

  const wallNormalized = reconcileWallModel(model, splitWallsAtJunctions(model.walls));
  return mergeAutoRooms(wallNormalized);

};



let buildPersistenceHydrated = !isWebProductionRuntime();

const modelHasGeometry = (model: BuildingModel): boolean =>
  model.rooms.length > 0 ||
  model.walls.length > 0 ||
  (model.roofs?.length ?? 0) > 0 ||
  (model.floorSlabs?.length ?? 0) > 0;

export function deferBuildStorePersistenceHydration(): void {
  if (buildPersistenceHydrated || typeof window === "undefined") {
    return;
  }
  const run = () => {
    if (buildPersistenceHydrated) {
      return;
    }
    buildPersistenceHydrated = true;
    const key = useBuildStore.getState().projectKey;
    const stored = loadPersistedState(key);
    if (!stored || !modelHasGeometry(stored.model)) {
      return;
    }
    useBuildStore.getState().setProjectKey(key);
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => run(), { timeout: 2_000 });
  } else {
    window.setTimeout(run, 0);
  }
}

export const useBuildStore = create<BuildStoreState>((set, get) => {

  const initialKey = DEFAULT_LOCAL_PROJECT_KEY;
  const skipHeavyBootstrap = isWebProductionRuntime();

  const initialPersisted = skipHeavyBootstrap
    ? createDefaultPersistedState()
    : loadPersistedState(initialKey) ?? createDefaultPersistedState();

  const normalizedInitial = normalizeModel(initialPersisted.model);

  const initialWithAuto = skipHeavyBootstrap
    ? { model: normalizedInitial, problems: [] as RoomProblem[], loops: [] as RoomLoopCandidate[] }
    : prepareModelForEditing(normalizedInitial);

  const initialRevisioned = ensureModelRevision(initialWithAuto.model);

  const initialActiveLevel = ensureActiveLevel(initialPersisted.activeLevelId, initialRevisioned.model);

  const initialSelection = sanitizeSelection(initialPersisted.selection, initialRevisioned.model);

  const initialTool = initialPersisted.tool ?? DEFAULT_TOOL;

  const initialGridStep = typeof initialPersisted.gridStep === "number" ? initialPersisted.gridStep : DEFAULT_GRID_STEP;

  const initialOrthogonal = initialPersisted.orthogonalMode ?? true;

  const initialAdjacency = initialPersisted.adjacencyOverlay ?? false;

  const initialLoopDebug = initialPersisted.loopDebugOverlay ?? false;

  if (!skipHeavyBootstrap) {
    saveStateToStorage(
      initialKey,
      buildSnapshotFromState(initialRevisioned.model, {
        activeLevelId: initialActiveLevel,
        selection: initialSelection,
        tool: initialTool,
        gridStep: initialGridStep,
        orthogonalMode: initialOrthogonal,
        adjacencyOverlay: initialAdjacency,
        loopDebugOverlay: initialLoopDebug,
      })
    );
  }



  const applyModelUpdate = (
    recipe: (model: BuildingModel, state: BuildStoreState) => BuildingModel,
    options?: BuildMutationOptions
  ) => {
    set((state) => {
      let nextModel = recipe(state.model, state);
      let roomProblems = state.roomProblems;
      let roomLoops = state.roomLoops;
      if (options?.recalcRooms) {
        const merged = prepareModelForEditing(nextModel);
        nextModel = merged.model;
        roomProblems = merged.problems;
        roomLoops = merged.loops;
      }
      nextModel = syncAndEnrichThermalProtection(nextModel);
      const revisioned = bumpModelRevision(nextModel, state.modelRevision);
      nextModel = revisioned.model;
      const history =
        options?.trackHistory === false ? state.history : [cloneModel(state.model), ...state.history].slice(0, HISTORY_LIMIT);
      let selection = options?.resetSelection ? null : state.selection;
      if (selection?.kind === "loop") {
        selection = roomLoops.some((loop) => loop.id === selection?.id) ? selection : null;
      } else {
        selection = sanitizeSelection(selection, nextModel);
      }
      const nextState: BuildStoreState = {
        ...state,
        model: nextModel,
        modelRevision: revisioned.revision,
        roomProblems,
        roomLoops,
        history,
        future: options?.trackHistory === false ? state.future : [],
        selection,
      };
      const persistable: PersistableSlice = {
        activeLevelId: nextState.activeLevelId,
        selection: nextState.selection,
        tool: nextState.tool,
        gridStep: nextState.gridStep,
        orthogonalMode: nextState.orthogonalMode,
        adjacencyOverlay: nextState.adjacencyOverlay,
        loopDebugOverlay: nextState.loopDebugOverlay,
      };
      if (options?.persist !== false) {
        saveStateToStorage(state.projectKey, buildSnapshotFromState(nextModel, persistable));
      }
      return nextState;
    });
  };

  const replaceModel = (payload: PersistedBuildState, projectKey: string) => {
    const normalized = normalizeModelRoomNames(normalizeModel(payload.model));
    const merged = prepareModelForEditing(normalized);
    const syncedModel = syncAndEnrichThermalProtection(merged.model);
    const incomingRevision = getModelRevision(payload.model);
    const revisioned =
      incomingRevision > 0
        ? ensureModelRevision(syncedModel, incomingRevision)
        : bumpModelRevision(syncedModel, get().modelRevision);
    const activeLevelId = ensureActiveLevel(payload.activeLevelId, revisioned.model);
    const selection = sanitizeSelection(payload.selection, revisioned.model);
    const snapshot = buildSnapshotFromState(revisioned.model, {
      activeLevelId,
      selection,
      tool: payload.tool ?? DEFAULT_TOOL,
      gridStep: typeof payload.gridStep === "number" ? payload.gridStep : DEFAULT_GRID_STEP,
      orthogonalMode: payload.orthogonalMode ?? true,
      adjacencyOverlay: payload.adjacencyOverlay ?? false,
      loopDebugOverlay: payload.loopDebugOverlay ?? false,
    });
    saveStateToStorage(projectKey, snapshot);
    set({
      projectKey,
      model: revisioned.model,
      modelRevision: revisioned.revision,
      roomProblems: merged.problems,
      roomLoops: merged.loops,
      activeLevelId,
      selection,
      tool: snapshot.tool,
      gridStep: snapshot.gridStep,
      orthogonalMode: snapshot.orthogonalMode,
      adjacencyOverlay: snapshot.adjacencyOverlay,
      loopDebugOverlay: snapshot.loopDebugOverlay,
      history: [],
      future: [],
      hasSnapshot: hasSnapshotStored(projectKey),
    });
  };

  const persistViewState = (state: BuildStoreState) => {
    const persistable: PersistableSlice = {
      activeLevelId: state.activeLevelId,
      selection: state.selection,
      tool: state.tool,
      gridStep: state.gridStep,
      orthogonalMode: state.orthogonalMode,
      adjacencyOverlay: state.adjacencyOverlay,
      loopDebugOverlay: state.loopDebugOverlay,
    };
    saveStateToStorage(state.projectKey, buildSnapshotFromState(state.model, persistable));
  };


  return {
    projectKey: initialKey,
    model: initialRevisioned.model,
    modelRevision: getModelRevision(initialRevisioned.model),
    roomProblems: initialWithAuto.problems,
    activeLevelId: initialActiveLevel,
    selection: initialSelection,
    tool: initialTool,
    gridStep: initialGridStep,
    orthogonalMode: initialOrthogonal,
    adjacencyOverlay: initialAdjacency,
    loopDebugOverlay: initialLoopDebug,
    solarTime: { ...DEFAULT_SOLAR_TIME },
    history: [],
    future: [],
    roomLoops: initialWithAuto.loops,
    hasSnapshot: hasSnapshotStored(initialKey),
    setSolarTime: (patch) =>
      set((state) => ({
        solarTime: {
          ...state.solarTime,
          ...patch,
        },
      })),
    setProjectKey: (key) => {
      const nextKey = key?.trim() || DEFAULT_LOCAL_PROJECT_KEY;
      if (get().projectKey === nextKey) {
        if (isWebProductionRuntime() && !buildPersistenceHydrated) {
          buildPersistenceHydrated = true;
          const stored = loadPersistedState(nextKey);
          if (stored && modelHasGeometry(stored.model)) {
            replaceModel(stored, nextKey);
          }
        }
        return;
      }
      const stored = loadPersistedState(nextKey) ?? createDefaultPersistedState();
      replaceModel(stored, nextKey);
    },
    setTool: (tool) =>
      set((state) => {
        const nextState = { ...state, tool };
        persistViewState(nextState);
        return nextState;
      }),
    setSelection: (selection) =>
      set((state) => {
        const nextState = { ...state, selection };
        persistViewState(nextState);
        return nextState;
      }),
    setGridStep: (grid) =>
      set((state) => {
        const value = grid <= 0 ? 0 : Math.max(0.05, grid);
        const nextState = { ...state, gridStep: value };
        persistViewState(nextState);
        return nextState;
      }),
    setOrthogonalMode: (value) =>
      set((state) => {
        const nextState = { ...state, orthogonalMode: value };
        persistViewState(nextState);
        return nextState;
      }),
    setAdjacencyOverlay: (value) =>
      set((state) => {
        const nextState = { ...state, adjacencyOverlay: value };
        persistViewState(nextState);
        return nextState;
      }),
    setLoopDebugOverlay: (value) =>
      set((state) => {
        const nextState = { ...state, loopDebugOverlay: value };
        persistViewState(nextState);
        return nextState;
      }),
    saveSnapshot: () =>
      set((state) => {
        const payload: SnapshotPayload = {
          ...buildSnapshotFromState(state.model, {
            activeLevelId: state.activeLevelId,
            selection: state.selection,
            tool: state.tool,
            gridStep: state.gridStep,
            orthogonalMode: state.orthogonalMode,
            adjacencyOverlay: state.adjacencyOverlay,
            loopDebugOverlay: state.loopDebugOverlay,
          }),
          savedAt: Date.now(),
        };
        saveSnapshotPayload(state.projectKey, payload);
        return { ...state, hasSnapshot: true };
      }),
    restoreSnapshot: () => {
      const snapshot = loadSnapshotPayload(get().projectKey);
      if (!snapshot) {
        return false;
      }
      replaceModel(snapshot, get().projectKey);
      return true;
    },
    loadModelSnapshot: (model) => {
      const state = get();
      const snapshot: PersistedBuildState = buildSnapshotFromState(normalizeModelRoomNames(model), {
        activeLevelId: ensureActiveLevel(state.activeLevelId, model),
        selection: null,
        tool: state.tool,
        gridStep: state.gridStep,
        orthogonalMode: state.orthogonalMode,
        adjacencyOverlay: state.adjacencyOverlay,
        loopDebugOverlay: state.loopDebugOverlay,
      });
      replaceModel(snapshot, state.projectKey);
    },
    addLevel: (level) => {
      const withId: Level = { ...level, id: level.id ?? createId("lvl") };
      applyModelUpdate(
        (model) => ({
          ...model,
          levels: [...model.levels, withId],
        }),
        { resetSelection: true }
      );
      set((state) => {
        const nextState = { ...state, activeLevelId: withId.id };
        persistViewState(nextState);
        return nextState;
      });
    },
    updateLevel: (levelId, patch) =>

      applyModelUpdate((model) => ({

        ...model,

        levels: model.levels.map((level) => (level.id === levelId ? { ...level, ...patch } : level)),

      })),

    setActiveLevel: (levelId) =>
      set((state) => {
        const nextState = { ...state, activeLevelId: levelId };
        persistViewState(nextState);
        return nextState;
      }),
    addRoom: (room) =>

      applyModelUpdate((model) => ({

        ...model,

        rooms: upsert(model.rooms, { ...room, source: room.source ?? "manual" }),

      })),

    updateRoom: (roomId, patch) =>

      applyModelUpdate((model) => ({

        ...model,

        rooms: model.rooms.map((room) => (room.id === roomId ? { ...room, ...patch } : room)),

      })),

    removeRoom: (roomId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          rooms: model.rooms.filter((room) => room.id !== roomId),

        }),

        { resetSelection: true }

      ),

    addWall: (wall) =>

      applyModelUpdate(

        (model) => reconcileWallModel(model, upsert(model.walls, wall)),

        { recalcRooms: true }

      ),

    setWalls: (walls) =>

      applyModelUpdate(

        (model) => reconcileWallModel(model, walls),

        { resetSelection: true, recalcRooms: true }

      ),

    updateWall: (wallId, patch) =>

      applyModelUpdate(

        (model) => {

          const nextWalls = model.walls.map((wall) => (wall.id === wallId ? { ...wall, ...patch } : wall));
          return reconcileWallModel(model, nextWalls);

        },

        { recalcRooms: true }

      ),

    removeWall: (wallId) =>

      applyModelUpdate(

        (model) => {

          const nextDoors = model.doors.map((door) =>

            door.anchor.wallId === wallId

              ? {

                  ...door,

                  anchor: { ...door.anchor, wallId: null },

                  lost: true,

                }

              : door

          );

          const nextWindows = model.windows.map((window) =>

            window.anchor.wallId === wallId

              ? {

                  ...window,

                  anchor: { ...window.anchor, wallId: null },

                  lost: true,

                }

              : window

          );

          return reconcileWallModel(model, model.walls.filter((wall) => wall.id !== wallId), {
            doors: nextDoors,
            windows: nextWindows,
          });

        },

        { resetSelection: true, recalcRooms: true }

      ),

    addRoof: (roof) =>

      applyModelUpdate((model) => ({

        ...model,

        roofs: upsert(model.roofs ?? [], cloneRoofEntity(roof)),

      })),

    updateRoof: (roofId, patch) =>

      applyModelUpdate((model) => ({

        ...model,

        roofs: (model.roofs ?? []).map((roof) => (roof.id === roofId ? { ...roof, ...patch } : roof)),

      })),

    removeRoof: (roofId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          roofs: (model.roofs ?? []).filter((roof) => roof.id !== roofId),

        }),

        { resetSelection: true }

      ),

    addFloorSlab: (slab) =>

      applyModelUpdate((model) => ({

        ...model,

        floorSlabs: upsert(model.floorSlabs ?? [], cloneFloorSlabEntity(slab)),

      })),

    updateFloorSlab: (slabId, patch) =>

      applyModelUpdate((model) => ({

        ...model,

        floorSlabs: (model.floorSlabs ?? []).map((slab) => (slab.id === slabId ? { ...slab, ...patch } : slab)),

      })),

    removeFloorSlab: (slabId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          floorSlabs: (model.floorSlabs ?? []).filter((slab) => slab.id !== slabId),

        }),

        { resetSelection: true }

      ),

    addStair: (stair) =>

      applyModelUpdate((model) => ({

        ...model,

        stairs: upsert(model.stairs ?? [], cloneStairEntity(stair)),

      })),

    updateStair: (stairId, patch) =>

      applyModelUpdate((model) => ({

        ...model,

        stairs: (model.stairs ?? []).map((stair) => (stair.id === stairId ? { ...stair, ...patch } : stair)),

      })),

    removeStair: (stairId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          stairs: (model.stairs ?? []).filter((stair) => stair.id !== stairId),

        }),

        { resetSelection: true }

      ),

    addDoor: (door) =>

      applyModelUpdate((model) => ({

        ...model,

        doors: upsert(model.doors, door),

      })),

    updateDoor: (doorId, patch) =>

      applyModelUpdate((model) => ({

        ...model,

        doors: model.doors.map((door) => (door.id === doorId ? { ...door, ...patch } : door)),

      })),

    removeDoor: (doorId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          doors: model.doors.filter((door) => door.id !== doorId),

        }),

        { resetSelection: true }

      ),

    addWindow: (window) =>

      applyModelUpdate((model) => ({

        ...model,

        windows: upsert(model.windows, window),

      })),

    updateWindow: (windowId, patch) =>

      applyModelUpdate((model) => ({

        ...model,

        windows: model.windows.map((window) => (window.id === windowId ? { ...window, ...patch } : window)),

      })),

    removeWindow: (windowId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          windows: model.windows.filter((window) => window.id !== windowId),

        }),

        { resetSelection: true }

      ),

    addPipe: (pipe) =>

      applyModelUpdate((model) => ({

        ...model,

        pipes: upsert(model.pipes, pipe),

      })),

    updatePipe: (pipeId, patch, options) =>

      applyModelUpdate((model) => ({

        ...model,

        pipes: model.pipes.map((pipe) => (pipe.id === pipeId ? { ...pipe, ...patch } : pipe)),

      }), options),

    removePipe: (pipeId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          pipes: model.pipes.filter((pipe) => pipe.id !== pipeId),

          equipment: model.equipment.map((equipment) => ({
            ...equipment,
            connectedNetworkIds: equipment.connectedNetworkIds.filter((id) => id !== pipeId),
          })),

        }),

        { resetSelection: true }

      ),

    addDuct: (duct) =>

      applyModelUpdate((model) => ({

        ...model,

        ducts: upsert(model.ducts, duct),

      })),

    updateDuct: (ductId, patch, options) =>

      applyModelUpdate((model) => ({

        ...model,

        ducts: model.ducts.map((duct) => (duct.id === ductId ? { ...duct, ...patch } : duct)),

      }), options),

    removeDuct: (ductId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          ducts: model.ducts.filter((duct) => duct.id !== ductId),

          equipment: model.equipment.map((equipment) => ({
            ...equipment,
            connectedNetworkIds: equipment.connectedNetworkIds.filter((id) => id !== ductId),
          })),

        }),

        { resetSelection: true }

      ),

    addEquipment: (equipment) =>

      applyModelUpdate((model) => ({

        ...model,

        equipment: upsert(model.equipment, equipment),

      })),

    updateEquipment: (equipmentId, patch, options) =>

      applyModelUpdate((model) => ({

        ...model,

        equipment: model.equipment.map((equipment) =>
          equipment.id === equipmentId ? { ...equipment, ...patch } : equipment
        ),

      }), options),

    removeEquipment: (equipmentId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          pipes: model.pipes.map((pipe) => ({
            ...pipe,
            connectedEquipmentIds: pipe.connectedEquipmentIds.filter((id) => id !== equipmentId),
          })),

          ducts: model.ducts.map((duct) => ({
            ...duct,
            connectedEquipmentIds: duct.connectedEquipmentIds.filter((id) => id !== equipmentId),
          })),

          equipment: model.equipment.filter((equipment) => equipment.id !== equipmentId),

        }),

        { resetSelection: true }

      ),

    addSensor: (sensor) =>

      applyModelUpdate((model) => ({

        ...model,

        sensors: upsert(model.sensors, sensor),

      })),

    updateSensor: (sensorId, patch, options) =>

      applyModelUpdate((model) => ({

        ...model,

        sensors: model.sensors.map((sensor) => (sensor.id === sensorId ? { ...sensor, ...patch } : sensor)),

      }), options),

    removeSensor: (sensorId) =>

      applyModelUpdate(

        (model) => ({

          ...model,

          sensors: model.sensors.filter((sensor) => sensor.id !== sensorId),

        }),

        { resetSelection: true }

      ),

    addEngineeringEquipment: (equipment) =>

      applyModelUpdate((model) => {
        const current = normalizeEngineeringSystems(model.engineeringSystems ?? createEmptyEngineeringSystems());
        const nextEquipment = upsert(current.equipment, normalizeEngineeringEquipment(equipment));
        const nextSystems = rebuildEngineeringSystemsForEquipment({ ...current, equipment: nextEquipment }, equipment.id);
        return {
          ...model,
          engineeringSystems: nextSystems,
        };
      }),

    updateEngineeringEquipment: (equipmentId, patch, options) =>

      applyModelUpdate((model) => {
        const current = normalizeEngineeringSystems(model.engineeringSystems ?? createEmptyEngineeringSystems());
        const nextEquipment = current.equipment.map((equipment) =>
          equipment.id === equipmentId ? normalizeEngineeringEquipment({ ...equipment, ...patch, id: equipmentId, type: patch.type ?? equipment.type }) : equipment
        );
        const nextSystems = rebuildEngineeringSystemsForEquipment({ ...current, equipment: nextEquipment }, equipmentId);
        return {
          ...model,
          engineeringSystems: nextSystems,
        };
      }, options),

    removeEngineeringEquipment: (equipmentId) =>

      applyModelUpdate(

        (model) => {
          const current = normalizeEngineeringSystems(model.engineeringSystems ?? createEmptyEngineeringSystems());
          return {
            ...model,
            engineeringSystems: {
              equipment: current.equipment.filter((equipment) => equipment.id !== equipmentId),
              pipes: current.pipes.filter((pipe) => pipe.fromEquipmentId !== equipmentId && pipe.toEquipmentId !== equipmentId),
            },
          };
        },

        { resetSelection: true }

      ),

    addEngineeringPipe: (pipe) =>

      applyModelUpdate((model) => {
        const current = normalizeEngineeringSystems(model.engineeringSystems ?? createEmptyEngineeringSystems());
        return {
          ...model,
          engineeringSystems: {
            ...current,
            pipes: upsert(current.pipes, normalizeEngineeringPipe(pipe)),
          },
        };
      }),

    updateEngineeringPipe: (pipeId, patch, options) =>

      applyModelUpdate((model) => {
        const current = normalizeEngineeringSystems(model.engineeringSystems ?? createEmptyEngineeringSystems());
        return {
          ...model,
          engineeringSystems: {
            ...current,
            pipes: current.pipes.map((pipe) =>
              pipe.id === pipeId ? normalizeEngineeringPipe({ ...pipe, ...patch, id: pipeId, medium: patch.medium ?? pipe.medium }) : pipe
            ),
          },
        };
      }, options),

    removeEngineeringPipe: (pipeId) =>

      applyModelUpdate(

        (model) => {
          const current = normalizeEngineeringSystems(model.engineeringSystems ?? createEmptyEngineeringSystems());
          return {
            ...model,
            engineeringSystems: {
              ...current,
              pipes: current.pipes.filter((pipe) => pipe.id !== pipeId),
            },
          };
        },

        { resetSelection: true }

      ),

    setEngineeringSystems: (systems, options) =>

      applyModelUpdate((model) => ({

        ...model,

        engineeringSystems: normalizeEngineeringSystems(systems),

      }), options),

    setActiveScenario: (scenarioId) =>

      applyModelUpdate((model) => ({

        ...model,

        activeScenarioId: scenarioId,

      })),

    upsertScenario: (scenario) =>

      applyModelUpdate((model) => ({

        ...model,

        scenarios: upsert(model.scenarios, scenario),

      })),

    removeScenario: (scenarioId) =>

      applyModelUpdate((model) => ({

        ...model,

        scenarios: model.scenarios.filter((scenario) => scenario.id !== scenarioId),

        activeScenarioId: model.activeScenarioId === scenarioId ? null : model.activeScenarioId,

      })),

    addEvent: (event, options) =>

      applyModelUpdate((model) => ({

        ...model,

        events: upsert(model.events, event),

      }), options),

    updateEvent: (eventId, patch, options) =>

      applyModelUpdate((model) => ({

        ...model,

        events: model.events.map((event) => (event.id === eventId ? { ...event, ...patch } : event)),

      }), options),

    removeEvent: (eventId, options) =>

      applyModelUpdate((model) => ({

        ...model,

        events: model.events.filter((event) => event.id !== eventId),

      }), options),

    resetModel: () => replaceModel(createDefaultPersistedState(), get().projectKey),
    undo: () =>
      set((state) => {
        if (!state.history.length) {
          return state;
        }
        const [previous, ...rest] = state.history;
        const future = [cloneModel(state.model), ...state.future].slice(0, HISTORY_LIMIT);
        const merged = prepareModelForEditing(previous);
        const nextState: BuildStoreState = {
          ...state,
          model: merged.model,
          roomProblems: merged.problems,
          roomLoops: merged.loops,
          history: rest,
          future,
          selection: null,
        };
        persistViewState(nextState);
        return nextState;
      }),

    redo: () =>
      set((state) => {
        if (!state.future.length) {
          return state;
        }
        const [next, ...rest] = state.future;
        const history = [cloneModel(state.model), ...state.history].slice(0, HISTORY_LIMIT);
        const merged = prepareModelForEditing(next);
        const nextState: BuildStoreState = {
          ...state,
          model: merged.model,
          roomProblems: merged.problems,
          roomLoops: merged.loops,
          history,
          future: rest,
          selection: null,
        };
        persistViewState(nextState);
        return nextState;
      }),

    createRoomFromLoop: (loopId) => {

      const state = get();

      const loop = state.roomLoops.find((entry) => entry.id === loopId);

      if (!loop || !loop.valid) {

        return null;

      }

      const existingRoom = state.model.rooms.find((room) => room.id === loop.roomId);

      if (existingRoom && existingRoom.source !== "auto") {

        return existingRoom.id;

      }

      const newRoom: Room = {

        id: createId("room"),

        name: buildRoomName(state.model.rooms.length + 1),

        levelId: loop.levelId,

        polygon: loop.polygon.map((point) => ({ ...point })),

        source: "manual",

      };

      const removeId = existingRoom?.source === "auto" ? existingRoom.id : null;

      applyModelUpdate(
        (model) => ({
          ...model,
          rooms: [...model.rooms.filter((room) => room.id !== removeId), newRoom],
        }),
        { recalcRooms: true }
      );

      set((current) => {
        const nextState = {
          ...current,
          selection: { kind: "room", id: newRoom.id } as Selection,
          roomLoops: current.roomLoops.map((entry) =>
            entry.id === loopId ? { ...entry, roomId: newRoom.id, roomSource: "manual" as const } : entry
          ),
        };
        persistViewState(nextState);
        return nextState;
      });

      return newRoom.id;

    },

  };

});



const buildRoomName = (index: number): string => `Помещение ${index}`;



const upsert = <T extends { id: string }>(items: T[], entry: T): T[] => {

  const existingIndex = items.findIndex((item) => item.id === entry.id);

  if (existingIndex === -1) {

    return [...items, entry];

  }

  const next = items.slice();

  next[existingIndex] = entry;

  return next;

};

