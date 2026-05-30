import { useCallback, useEffect, useMemo } from "react";
import { polygonArea, polygonCentroid, polygonContainsPoint } from "../../../entities/geometry/geom";
import { createId } from "../../../shared/utils/id";
import type { BuildingModel, ConstructionLayer, Door, FloorSlab, Roof, Room, Wall, Window } from "../../../entities/geometry/types";
import type { EngineeringEquipment, EngineeringEquipmentType, EngineeringPipe } from "../../../entities/engineering/types";
import type { DuctNetwork, Equipment, PipeNetwork, SensorDevice } from "../../../entities/networks/types";
import {
  EQUIPMENT_TYPE_LABELS,
  HEAT_CARRIER_LABELS,
  HEATING_CONNECTION_TYPE_LABELS,
  HEATING_SYSTEM_KIND_LABELS,
  NETWORK_SYSTEM_TYPE_LABELS,
  PIPE_CIRCUIT_ROLE_LABELS,
  PIPE_TYPE_LABELS,
  PIPE_MARKING_COLOR_LABELS,
  PIPE_FLOW_ROLE_LABELS,
  PIPE_SEGMENT_CLASS_LABELS,
  FLOW_DIRECTION_LABELS,
  resolveNetworkSystemType,
  resolvePipeCircuitRole,
  SENSOR_TYPE_LABELS,
  type EquipmentType,
  type NetworkSystemType,
  type PipeFlowRole,
  type PipeMarkingColor,
  type PipeMaterial,
  type PipeSystemType,
  type SensorStatus,
  type SensorType,
} from "../../../entities/networks/types";
import {
  WALL_ASSEMBLIES,
  DEFAULT_WALL_ASSEMBLY_ID,
  computeWallProperties,
  ensureWallLayers,
} from "../../../entities/material/types";
import {
  applyEnvelopePresetToDoor,
  applyEnvelopePresetToFloorSlab,
  applyEnvelopePresetToRoof,
  applyEnvelopePresetToWall,
  applyEnvelopePresetToWindow,
  describeEnvelopePreset,
  getEnvelopePreset,
  resolveDefaultPresetId,
  type EnvelopePresetKind,
} from "../../../entities/envelope/envelopePresets";
import { polylineLength } from "../../../core/networks/index";
import { describeEquipmentNetworkPolicy } from "../../../core/networks/compatibility";
import { getRoomDisplayName, normalizeStoredRoomName } from "../../../shared/utils/roomNames";
import type { Selection, BuildTool } from "../build.store";
import type { RoomLoopCandidate } from "../auto/detectRoomsFromWalls";
import type { RoomEnvelopeMetrics } from "../metrics/envelope";
import { formatArea } from "../../../shared/utils/format";
import { sanitizeDisplayText } from "../../../shared/utils/displayText";
import { anchorToOffset, buildAnchorFromOffset } from "../utils/openingMath";
import {
  getFloorDisplayLabel,
  getLevelDisplayLabel,
  getLevelSummaryLabel,
  getRoomDisplayLabel,
  getWallDisplayLabel,
} from "../utils/entityLabels";
import {
  describeEquipmentConnectionStatus,
  describeSupplyReturnRole,
  formatEquipmentStateLabel,
  formatHeatingCircuitLabel,
  getEquipmentInspectorTitle,
  getEquipmentPurposeLabel,
} from "../engineering/userLabels";
import {
  createPipeDefaults,
  DOOR_DEFAULTS,
  DUCT_DEFAULTS,
  FLOOR_SLAB_DEFAULTS,
  ROOF_DEFAULTS,
  SENSOR_DEFAULTS,
  WALL_DEFAULTS,
  WINDOW_DEFAULTS,
} from "../defaults";
import { ENGINEERING_EQUIPMENT_LABELS } from "../engineering2d/catalog";
import {
  EngineeringEquipmentForm,
  EngineeringPipeForm,
} from "./Engineering2DInspector";
import { ConstructionLayerEditor } from "./ConstructionLayerEditor";
import { EnvelopePresetSearchPicker } from "./EnvelopePresetSearchPicker";

interface RightInspectorProps {
  model: BuildingModel;
  selection: Selection;
  tool: BuildTool;
  equipmentPreset: EquipmentType;
  engineeringEquipmentPreset: EngineeringEquipmentType;
  pipePreset: PipeSystemType;
  wallPreset: string;
  windowPreset: string;
  doorPreset: string;
  roofPreset: string;
  slabPreset: string;
  activeLevelLabel: string;
  neighbors: Record<string, string[]>;
  roomNames: Record<string, string>;
  loops: Record<string, RoomLoopCandidate>;
  roomEnvelopes: Record<string, RoomEnvelopeMetrics>;
  minimal?: boolean;
  onUpdateRoom: (roomId: string, patch: Partial<Room>) => void;
  onUpdateWall: (wallId: string, patch: Partial<Wall>) => void;
  onUpdateRoof: (roofId: string, patch: Partial<Roof>) => void;
  onUpdateFloorSlab: (slabId: string, patch: Partial<FloorSlab>) => void;
  onUpdateDoor: (doorId: string, patch: Partial<Door>) => void;
  onUpdateWindow: (windowId: string, patch: Partial<Window>) => void;
  onUpdatePipe: (pipeId: string, patch: Partial<PipeNetwork>) => void;
  onUpdateDuct: (ductId: string, patch: Partial<DuctNetwork>) => void;
  onUpdateEquipment: (equipmentId: string, patch: Partial<Equipment>) => void;
  onUpdateSensor: (sensorId: string, patch: Partial<SensorDevice>) => void;
  onUpdateEngineeringEquipment: (equipmentId: string, patch: Partial<EngineeringEquipment>) => void;
  onUpdateEngineeringPipe: (pipeId: string, patch: Partial<EngineeringPipe>) => void;
  onAddFloorSlab: (slab: FloorSlab) => void;
  onRemoveSelection: () => void;
  onCreateRoomFromLoop: (loopId: string) => void;
}

type SelectedEntity =
  | Room
  | Wall
  | Roof
  | FloorSlab
  | Door
  | Window
  | PipeNetwork
  | DuctNetwork
  | Equipment
  | SensorDevice
  | EngineeringEquipment
  | EngineeringPipe
  | RoomLoopCandidate;
type DraftKind = "room" | "wall" | "roof" | "slab" | "door" | "window" | "pipe" | "duct" | "equipment" | "sensor" | "engineeringEquipment" | "engineeringPipe";
type SelectionKind = NonNullable<Selection>["kind"];

const PIPE_DIAMETER_OPTIONS = [15, 20, 25, 32, 40, 50, 65, 80, 100] as const;

function innerDiameterFor(outerDiameter_mm: number): number {
  if (outerDiameter_mm <= 20) {
    return Math.max(10, outerDiameter_mm - 4);
  }
  if (outerDiameter_mm <= 40) {
    return outerDiameter_mm - 5;
  }
  return outerDiameter_mm - 7;
}

function defaultPipeMarkingColor(type: PipeSystemType): PipeMarkingColor {
  if (type === "heating_supply") return "gost_supply";
  if (type === "heating_return") return "gost_return";
  if (type === "dhw") return "gost_dhw";
  if (type === "chw") return "gost_chw";
  return "neutral";
}

export function RightInspector(props: RightInspectorProps) {
  const { model, selection, tool, equipmentPreset, pipePreset, activeLevelLabel, minimal = false, onRemoveSelection } = props;

  const selectedEntity = useMemo<SelectedEntity | null>(() => {
    if (!selection) {
      return null;
    }
    switch (selection.kind) {
      case "room":
        return model.rooms.find((room) => room.id === selection.id) ?? null;
      case "wall":
        return model.walls.find((wall) => wall.id === selection.id) ?? null;
      case "roof":
        return (model.roofs ?? []).find((roof) => roof.id === selection.id) ?? null;
      case "slab":
        return (model.floorSlabs ?? []).find((slab) => slab.id === selection.id) ?? null;
      case "door":
        return model.doors.find((door) => door.id === selection.id) ?? null;
      case "window":
        return model.windows.find((window) => window.id === selection.id) ?? null;
      case "pipe":
        return model.pipes.find((pipe) => pipe.id === selection.id) ?? null;
      case "duct":
        return model.ducts.find((duct) => duct.id === selection.id) ?? null;
      case "equipment":
        return model.equipment.find((item) => item.id === selection.id) ?? null;
      case "sensor":
        return model.sensors.find((item) => item.id === selection.id) ?? null;
      case "engineeringEquipment":
        return model.engineeringSystems?.equipment.find((item) => item.id === selection.id) ?? null;
      case "engineeringPipe":
        return model.engineeringSystems?.pipes.find((item) => item.id === selection.id) ?? null;
      case "loop":
        return props.loops[selection.id] ?? null;
      default:
        return null;
    }
  }, [model, props.loops, selection]);

  const draftKind = useMemo<DraftKind | null>(() => {
    switch (tool) {
      case "room":
      case "roomRect":
        return "room";
      case "wall":
      case "roof":
      case "slab":
      case "door":
      case "window":
      case "pipe":
      case "duct":
      case "equipment":
      case "sensor":
      case "engineeringEquipment":
      case "engineeringPipe":
        return tool;
      default:
        return null;
    }
  }, [tool]);

  const mode: "selected" | "draft" | "empty" = selectedEntity && selection ? "selected" : draftKind ? "draft" : "empty";
  const hideDraftHeader = mode === "draft";
  const subtitle =
    mode === "selected"
      ? selectionLabel(selection?.kind)
      : mode === "draft"
        ? draftLabel(draftKind, tool, equipmentPreset, props.engineeringEquipmentPreset)
        : "Ничего не выбрано";

  return (
    <aside
      className={`flex min-h-0 min-w-0 flex-col ${
        minimal
          ? "ui-panel rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-2.5 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.45)]"
          : "h-full"
      }`}
    >
      <section className={`${minimal ? "ui-panel-muted p-3 rounded-[18px] bg-[color:var(--surface-elevated)]/55" : "h-full p-0 bg-transparent"}`}>
        {!hideDraftHeader ? (
          <header className="sticky top-0 z-10 mb-3 flex items-start justify-between gap-3 border-b border-[color:var(--border-soft)] bg-[color:var(--surface-base)]/80 pb-2.5 pt-1 backdrop-blur-sm">
            <div className="min-w-0">
              {mode === "empty" ? null : (
                <p className="truncate text-sm font-medium text-[color:var(--text-muted)]">{subtitle}</p>
              )}
            </div>
            {mode === "selected" && selection ? (
              <button
                type="button"
                onClick={onRemoveSelection}
                className="ui-control shrink-0 rounded-[10px] border border-[color:var(--danger-border)]/70 bg-[color:var(--danger-bg)]/70 px-2.5 py-1 text-xs font-semibold text-[color:var(--danger-fg)] hover:border-[color:var(--danger-border)] hover:bg-[color:var(--danger-bg)]"
              >
                Удалить
              </button>
            ) : null}
          </header>
        ) : null}

        {mode === "selected" && selection && selectedEntity ? <SelectionForm {...props} entity={selectedEntity} /> : null}
        {mode === "draft" && draftKind ? (
          <DraftForm
            draftKind={draftKind}
            wallPreset={props.wallPreset}
            windowPreset={props.windowPreset}
            doorPreset={props.doorPreset}
            roofPreset={props.roofPreset}
            slabPreset={props.slabPreset}
          />
        ) : null}
      </section>
    </aside>
  );
}

type SelectionFormProps = RightInspectorProps & {
  entity: SelectedEntity;
};

function SelectionForm({
  model,
  selection,
  neighbors,
  roomNames,
  loops,
  roomEnvelopes,
  slabPreset,
  entity,
  onUpdateRoom,
  onUpdateWall,
  onUpdateRoof,
  onAddFloorSlab,
  onUpdateFloorSlab,
  onUpdateDoor,
  onUpdateWindow,
  onUpdatePipe,
  onUpdateDuct,
  onUpdateEquipment,
  onUpdateSensor,
  onUpdateEngineeringEquipment,
  onUpdateEngineeringPipe,
  onCreateRoomFromLoop,
}: SelectionFormProps) {
  if (!selection) {
    return null;
  }

  switch (selection.kind) {
    case "loop": {
      const loop = loops[selection.id];
      if (!loop) {
        return <p className="text-sm text-[color:var(--text-soft)]">Контур не найден.</p>;
      }
      const status =
        loop.roomSource === "manual"
          ? "Комната уже создана вручную"
          : loop.roomSource === "auto"
            ? "Комната распознана автоматически"
            : loop.valid
              ? "Контур готов к созданию комнаты"
              : loop.reason ?? "Контур невалиден";
      const cannotCreate = !loop.valid || Boolean(loop.roomId && loop.roomSource === "manual");
      return (
        <div className="space-y-3">
          <InfoCard
            rows={[
              { label: "Этаж", value: getFloorDisplayLabel(model, loop.levelId) },
              { label: "Площадь", value: formatArea(loop.area) },
              { label: "Статус", value: status },
            ]}
          />
          <button
            type="button"
            onClick={() => onCreateRoomFromLoop(selection.id)}
            disabled={cannotCreate}
            className={`w-full rounded-xl px-3 py-2 text-sm font-semibold transition ${
              cannotCreate
                ? "cursor-not-allowed border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]"
                : "border border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)] hover:border-[color:var(--success-border)]"
            }`}
          >
            Создать комнату
          </button>
        </div>
      );
    }
    case "room": {
      const selectedRoom = entity as Room;
      const roomIndex = model.rooms.findIndex((item) => item.id === selectedRoom.id);
      return (
        <RoomForm
          room={selectedRoom}
          roomIndex={roomIndex}
          levels={model.levels}
          neighbors={neighbors}
          roomNames={roomNames}
          roomEnvelopes={roomEnvelopes}
          floorSlabs={model.floorSlabs ?? []}
          slabPreset={slabPreset}
          onUpdateRoom={onUpdateRoom}
          onAddFloorSlab={onAddFloorSlab}
          onUpdateFloorSlab={onUpdateFloorSlab}
        />
      );
    }
    case "wall":
      return <WallForm wall={entity as Wall} levels={model.levels} onUpdateWall={onUpdateWall} />;
    case "roof":
      return <RoofForm roof={entity as Roof} levels={model.levels} onUpdateRoof={onUpdateRoof} />;
    case "slab":
      return <FloorSlabForm slab={entity as FloorSlab} levels={model.levels} onUpdateFloorSlab={onUpdateFloorSlab} />;
    case "door":
      return <OpeningForm kind="door" opening={entity as Door} model={model} onUpdate={(patch) => onUpdateDoor(selection.id, patch)} />;
    case "window":
      return <OpeningForm kind="window" opening={entity as Window} model={model} onUpdate={(patch) => onUpdateWindow(selection.id, patch)} />;
    case "pipe":
      return <PipeForm model={model} pipe={entity as PipeNetwork} onUpdatePipe={onUpdatePipe} />;
    case "duct":
      return <DuctForm duct={entity as DuctNetwork} onUpdateDuct={onUpdateDuct} />;
    case "equipment":
      return <EquipmentForm model={model} equipment={entity as Equipment} roomNames={roomNames} onUpdateEquipment={onUpdateEquipment} />;
    case "sensor":
      return <SensorForm sensor={entity as SensorDevice} roomNames={roomNames} onUpdateSensor={onUpdateSensor} />;
    case "engineeringEquipment":
      return (
        <EngineeringEquipmentForm
          equipment={entity as EngineeringEquipment}
          onUpdateEngineeringEquipment={onUpdateEngineeringEquipment}
        />
      );
    case "engineeringPipe":
      return (
        <EngineeringPipeForm
          model={model}
          pipe={entity as EngineeringPipe}
          onUpdateEngineeringPipe={onUpdateEngineeringPipe}
        />
      );
    default:
      return null;
  }
}

function EnvelopePresetField({
  kind,
  value,
  onChange,
}: {
  kind: EnvelopePresetKind;
  value: string;
  onChange: (presetId: string) => void;
}) {
  return (
    <label className="block space-y-1 text-xs font-semibold text-[color:var(--text-soft)]">
      Типовой пресет
      <EnvelopePresetSearchPicker kind={kind} value={value} onChange={onChange} />
    </label>
  );
}
function DraftForm({
  draftKind,
  wallPreset,
  windowPreset,
  doorPreset,
  roofPreset,
  slabPreset,
}: {
  draftKind: DraftKind;
  wallPreset: string;
  windowPreset: string;
  doorPreset: string;
  roofPreset: string;
  slabPreset: string;
}) {
  if (draftKind === "engineeringEquipment" || draftKind === "engineeringPipe") {
    return null;
  }
  switch (draftKind) {
    case "room":
      return null;
    case "wall": {
      const preset = getEnvelopePreset(wallPreset);
      const layers = preset?.layers ?? WALL_ASSEMBLIES[DEFAULT_WALL_ASSEMBLY_ID]?.layers;
      const properties = computeWallProperties(layers, preset?.wallAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID, {
        includeSp50AirFilms: true,
      });
      return (
        <div className="space-y-3">
          <EnvelopePresetField kind="wall" value={wallPreset} onChange={() => undefined} />
          {properties ? (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
              <ValueTile label="R, м²К/Вт" value={properties.rValue.toFixed(3)} />
              <ValueTile label="U, Вт/(м²К)" value={properties.uValue.toFixed(3)} />
              <div className="col-span-2">
                <ValueTile label="Теплоёмкость, Дж/(м²К)" value={properties.heatCapacity_J_m2K.toFixed(0)} />
              </div>
            </div>
          ) : null}
        </div>
      );
    }
    case "roof":
      return <EnvelopePresetField kind="roof" value={roofPreset} onChange={() => undefined} />;
    case "slab":
      return <EnvelopePresetField kind="slab" value={slabPreset} onChange={() => undefined} />;
    case "door":
      return <EnvelopePresetField kind="door" value={doorPreset} onChange={() => undefined} />;
    case "window":
      return <EnvelopePresetField kind="window" value={windowPreset} onChange={() => undefined} />;
    case "pipe":
    case "duct":
    case "equipment":
    case "sensor":
      return null;
    default:
      return null;
  }
}

function RoomForm({
  room,
  roomIndex,
  levels,
  neighbors,
  roomNames,
  roomEnvelopes,
  floorSlabs,
  slabPreset,
  onUpdateRoom,
  onAddFloorSlab,
  onUpdateFloorSlab,
}: {
  room: Room;
  roomIndex: number;
  levels: BuildingModel["levels"];
  neighbors: Record<string, string[]>;
  roomNames: Record<string, string>;
  roomEnvelopes: Record<string, RoomEnvelopeMetrics>;
  floorSlabs: FloorSlab[];
  slabPreset: string;
  onUpdateRoom: (roomId: string, patch: Partial<Room>) => void;
  onAddFloorSlab: (slab: FloorSlab) => void;
  onUpdateFloorSlab: (slabId: string, patch: Partial<FloorSlab>) => void;
}) {
  const area = Math.abs(polygonArea(room.polygon));
  const envelope = roomEnvelopes[room.id];
  const resolvedRoomIndex = roomIndex >= 0 ? roomIndex : 0;

  useEffect(() => {
    const normalized = normalizeStoredRoomName(room, resolvedRoomIndex);
    if (normalized) {
      onUpdateRoom(room.id, { name: normalized });
    }
  }, [onUpdateRoom, resolvedRoomIndex, room, room.id, room.name]);

  const roomDisplayName = useMemo(() => {
    return roomNames[room.id] ?? getRoomDisplayName(room, resolvedRoomIndex);
  }, [room, roomNames, resolvedRoomIndex]);

  const associatedSlab = useMemo(() => {
    const centroid = polygonCentroid(room.polygon);
    return (
      floorSlabs.find(
        (slab) => slab.levelId === room.levelId && polygonContainsPoint(centroid, slab.boundary)
      ) ?? null
    );
  }, [floorSlabs, room.polygon, room.levelId]);

  const handleCreateSlab = useCallback(() => {
    const presetId = slabPreset || resolveDefaultPresetId("slab");
    const baseSlab: FloorSlab = {
      id: createId("slab"),
      name: `Пол · ${roomDisplayName}`,
      levelId: room.levelId,
      kind: FLOOR_SLAB_DEFAULTS.kind,
      boundary: room.polygon.map((pt) => ({ ...pt })),
      elevation_m: 0,
      thickness_m: FLOOR_SLAB_DEFAULTS.thickness,
      heatedSide: FLOOR_SLAB_DEFAULTS.heatedSide,
      assemblyId: null,
    };
    onAddFloorSlab(applyEnvelopePresetToFloorSlab(baseSlab, presetId));
  }, [room, roomDisplayName, slabPreset, onAddFloorSlab]);

  return (
    <div className="space-y-3">
      <TextField
        label="Название"
        value={roomDisplayName}
        onChange={(value) => onUpdateRoom(room.id, { name: value })}
      />
      <InfoCard
        rows={[
          { label: "Площадь", value: `${area.toFixed(2)} м²` },
          { label: "Контур", value: `${room.polygon.length} вершин` },
          { label: "Уровень", value: getLevelSummaryLabel({ levels }, room.levelId) },
        ]}
      />
      {envelope ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
          <ValueTile label="Окна, м²" value={envelope.windowArea.toFixed(2)} />
          <ValueTile label="Двери, м²" value={envelope.doorArea.toFixed(2)} />
          <div className="col-span-2">
            <ValueTile label="Окна / стены" value={`${(envelope.wwr * 100).toFixed(1)}%`} />
          </div>
        </div>
      ) : null}

      {/* ── Перекрытие пола ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">
          Перекрытие пола
        </p>
        {associatedSlab ? (
          <div className="space-y-2">
            <EnvelopePresetField
              kind="slab"
              value={associatedSlab.envelopePresetId ?? resolveDefaultPresetId("slab")}
              onChange={(value) =>
                onUpdateFloorSlab(associatedSlab.id, applyEnvelopePresetToFloorSlab(associatedSlab, value))
              }
            />
            <p className="text-xs text-[color:var(--text-soft)]">
              Пол · {roomDisplayName} · {associatedSlab.thickness_m.toFixed(3)} м
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCreateSlab}
            className="w-full rounded-xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[color:var(--text-soft)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
          >
            + Создать пол для этой комнаты
          </button>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Соседи</p>
        {neighbors[room.id]?.length ? (
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-muted)]">
            {neighbors[room.id].map((neighborId) => (
              <li key={neighborId} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2">
                {roomNames[neighborId] ?? neighborId}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[color:var(--text-soft)]">Смежные помещения пока не определены.</p>
        )}
      </div>
    </div>
  );
}

function RoofForm({
  roof,
  levels,
  onUpdateRoof,
}: {
  roof: Roof;
  levels: BuildingModel["levels"];
  onUpdateRoof: (roofId: string, patch: Partial<Roof>) => void;
}) {
  const planArea = Math.abs(polygonArea(roof.boundary));
  const presetId = roof.envelopePresetId ?? resolveDefaultPresetId("roof");
  const presetLayers = getEnvelopePreset(presetId)?.layers ?? [];
  const layers: ConstructionLayer[] = roof.layers ?? presetLayers;
  const properties = computeWallProperties(layers, undefined, { includeSp50AirFilms: true });
  const hasCustomLayers = Boolean(roof.layers?.length);

  // Угол уклона в градусах для отображения
  const risePerMeter = roof.slope?.risePerMeter ?? ROOF_DEFAULTS.risePerMeter;
  const slopeAngleDeg = (Math.atan(risePerMeter) * 180) / Math.PI;
  // Фактическая площадь скатной крыши больше плановой
  const actualArea =
    roof.kind === "pitched" ? planArea / Math.cos(Math.atan(risePerMeter)) : planArea;

  const applyLayersPatch = useCallback(
    (nextLayers: ConstructionLayer[]) => {
      const totalThickness = nextLayers.reduce((sum, l) => sum + (l.thickness_m || 0), 0);
      onUpdateRoof(roof.id, {
        layers: nextLayers.length ? nextLayers : undefined,
        thickness_m: totalThickness > 0.001 ? Math.round(totalThickness * 1000) / 1000 : roof.thickness_m,
      });
    },
    [roof.id, roof.thickness_m, onUpdateRoof]
  );

  const updateLayer = useCallback(
    (index: number, patch: Partial<ConstructionLayer>) => {
      const nextLayers = layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer));
      applyLayersPatch(nextLayers);
    },
    [layers, applyLayersPatch]
  );

  const addLayer = useCallback(() => {
    applyLayersPatch([...layers, { materialId: "mineral_wool", thickness_m: 0.1 }]);
  }, [layers, applyLayersPatch]);

  const removeLayer = useCallback(
    (index: number) => {
      applyLayersPatch(layers.filter((_, i) => i !== index));
    },
    [layers, applyLayersPatch]
  );

  const resetToPreset = useCallback(() => {
    const preset = getEnvelopePreset(presetId);
    onUpdateRoof(roof.id, {
      layers: undefined,
      thickness_m: preset?.thickness_m ?? roof.thickness_m,
    });
  }, [presetId, roof.id, roof.thickness_m, onUpdateRoof]);

  return (
    <div className="space-y-3">
      <EnvelopePresetField
        kind="roof"
        value={presetId}
        onChange={(value) => onUpdateRoof(roof.id, applyEnvelopePresetToRoof(roof, value))}
      />
      <TextField label="Название" value={sanitizeDisplayText(roof.name, "", { allowInternalId: false })} onChange={(value) => onUpdateRoof(roof.id, { name: value })} />
      <InfoCard
        rows={[
          { label: "Площадь (план)", value: `${planArea.toFixed(2)} м²` },
          ...(roof.kind === "pitched"
            ? [{ label: "Площадь (факт)", value: `${actualArea.toFixed(2)} м²` }]
            : []),
          { label: "Контур", value: `${roof.boundary.length} вершин` },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Тип"
          value={roof.kind}
          onChange={(value) => onUpdateRoof(roof.id, { kind: value as Roof["kind"] })}
          options={[
            { value: "flat", label: "Плоская" },
            { value: "pitched", label: "Скатная" },
          ]}
        />
        <SelectField
          label="Уровень"
          value={roof.levelId}
          onChange={(value) => onUpdateRoof(roof.id, { levelId: value })}
          options={levels.map((level) => ({ value: level.id, label: getLevelDisplayLabel({ levels }, level.id) }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={hasCustomLayers ? "Толщина (авто), м" : "Толщина, м"}
          value={roof.thickness_m}
          step={0.01}
          onChange={(value) => onUpdateRoof(roof.id, { thickness_m: value })}
        />
        <NumberField label="Отметка основания, м" value={roof.elevationBase_m} step={0.05} onChange={(value) => onUpdateRoof(roof.id, { elevationBase_m: value })} />
      </div>

      {/* Параметры скатной крыши */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Направление, °"
          value={roof.slope?.directionDeg ?? ROOF_DEFAULTS.slopeDirectionDeg}
          step={5}
          onChange={(value) =>
            onUpdateRoof(roof.id, {
              slope: { directionDeg: value, risePerMeter: roof.slope?.risePerMeter ?? ROOF_DEFAULTS.risePerMeter },
            })
          }
          disabled={roof.kind !== "pitched"}
        />
        <NumberField
          label="Уклон, м/м"
          value={risePerMeter}
          step={0.05}
          onChange={(value) =>
            onUpdateRoof(roof.id, {
              slope: { directionDeg: roof.slope?.directionDeg ?? ROOF_DEFAULTS.slopeDirectionDeg, risePerMeter: value },
            })
          }
          disabled={roof.kind !== "pitched"}
        />
      </div>
      {roof.kind === "pitched" && (
        <div className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
          Угол уклона: <span className="font-semibold text-[color:var(--text-base)]">{slopeAngleDeg.toFixed(1)}°</span>
          {" · "}
          Коэффициент площади: <span className="font-semibold text-[color:var(--text-base)]">{(actualArea / Math.max(planArea, 0.01)).toFixed(3)}</span>
        </div>
      )}

      <HeatedSideField
        value={roof.heatedSide ?? ROOF_DEFAULTS.heatedSide}
        onChange={(value) => onUpdateRoof(roof.id, { heatedSide: value })}
        options={ROOF_HEATED_SIDE_OPTIONS}
      />

      {properties ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
          <ValueTile label="R total, м²К/Вт" value={properties.rTotal_m2K_W.toFixed(3)} />
          <ValueTile label="U total, Вт/(м²К)" value={properties.uTotal_W_m2K.toFixed(3)} />
          <div className="col-span-2">
            <ValueTile label="Теплоёмкость, Дж/(м²К)" value={properties.heatCapacity_J_m2K.toFixed(0)} />
          </div>
        </div>
      ) : null}

      <ConstructionLayerEditor
        title="Состав кровли"
        layers={layers}
        hasCustomLayers={hasCustomLayers}
        onUpdateLayer={updateLayer}
        onAddLayer={addLayer}
        onRemoveLayer={removeLayer}
        onReset={resetToPreset}
        resetLabel="Вернуть по пресету"
      />
    </div>
  );
}

function FloorSlabForm({
  slab,
  levels,
  onUpdateFloorSlab,
}: {
  slab: FloorSlab;
  levels: BuildingModel["levels"];
  onUpdateFloorSlab: (slabId: string, patch: Partial<FloorSlab>) => void;
}) {
  const area = Math.abs(polygonArea(slab.boundary));
  const presetId = slab.envelopePresetId ?? resolveDefaultPresetId("slab");
  const presetLayers = getEnvelopePreset(presetId)?.layers ?? [];
  // Если пользователь задал слои вручную — используем их; иначе — из пресета
  const layers: ConstructionLayer[] = slab.layers ?? presetLayers;
  const properties = computeWallProperties(layers, undefined, { includeSp50AirFilms: true });
  const hasCustomLayers = Boolean(slab.layers?.length);

  /** Пересчитывает суммарную толщину из слоёв и пишет в slab */
  const applyLayersPatch = useCallback(
    (nextLayers: ConstructionLayer[]) => {
      const totalThickness = nextLayers.reduce((sum, l) => sum + (l.thickness_m || 0), 0);
      onUpdateFloorSlab(slab.id, {
        layers: nextLayers.length ? nextLayers : undefined,
        thickness_m: totalThickness > 0.001 ? Math.round(totalThickness * 1000) / 1000 : slab.thickness_m,
      });
    },
    [slab.id, slab.thickness_m, onUpdateFloorSlab]
  );

  const updateLayer = useCallback(
    (index: number, patch: Partial<ConstructionLayer>) => {
      const nextLayers = layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer));
      applyLayersPatch(nextLayers);
    },
    [layers, applyLayersPatch]
  );

  const addLayer = useCallback(() => {
    const newLayer: ConstructionLayer = { materialId: "mineral_wool", thickness_m: 0.05 };
    applyLayersPatch([...layers, newLayer]);
  }, [layers, applyLayersPatch]);

  const removeLayer = useCallback(
    (index: number) => {
      applyLayersPatch(layers.filter((_, i) => i !== index));
    },
    [layers, applyLayersPatch]
  );

  const resetToPreset = useCallback(() => {
    const preset = getEnvelopePreset(presetId);
    onUpdateFloorSlab(slab.id, {
      layers: undefined,
      thickness_m: preset?.thickness_m ?? slab.thickness_m,
    });
  }, [presetId, slab.id, slab.thickness_m, onUpdateFloorSlab]);

  return (
    <div className="space-y-3">
      <EnvelopePresetField
        kind="slab"
        value={presetId}
        onChange={(value) => onUpdateFloorSlab(slab.id, applyEnvelopePresetToFloorSlab(slab, value))}
      />
      <TextField
        label="Название"
        value={sanitizeDisplayText(slab.name, "", { allowInternalId: false })}
        onChange={(value) => onUpdateFloorSlab(slab.id, { name: value })}
      />
      <InfoCard
        rows={[
          { label: "Площадь", value: `${area.toFixed(2)} м²` },
          { label: "Контур", value: `${slab.boundary.length} вершин` },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Тип"
          value={slab.kind}
          onChange={(value) => onUpdateFloorSlab(slab.id, { kind: value as FloorSlab["kind"] })}
          options={[
            { value: "interfloor", label: "Межэтажное" },
            { value: "attic", label: "Чердачное" },
            { value: "basement", label: "Над подвалом" },
            { value: "ground", label: "Пол по грунту" },
          ]}
        />
        <SelectField
          label="Уровень"
          value={slab.levelId}
          onChange={(value) => onUpdateFloorSlab(slab.id, { levelId: value })}
          options={levels.map((level) => ({ value: level.id, label: getLevelDisplayLabel({ levels }, level.id) }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={hasCustomLayers ? "Толщина (авто), м" : "Толщина, м"}
          value={slab.thickness_m}
          step={0.005}
          onChange={(value) => onUpdateFloorSlab(slab.id, { thickness_m: value })}
        />
        <NumberField
          label="Отметка, м"
          value={slab.elevation_m}
          step={0.05}
          onChange={(value) => onUpdateFloorSlab(slab.id, { elevation_m: value })}
        />
      </div>
      <SelectField
        label="Обогреваемая сторона"
        value={slab.heatedSide ?? FLOOR_SLAB_DEFAULTS.heatedSide}
        onChange={(value) => onUpdateFloorSlab(slab.id, { heatedSide: value as FloorSlab["heatedSide"] })}
        options={[
          { value: "below", label: "Снизу (пол холодный)" },
          { value: "above", label: "Сверху (тёплый пол)" },
        ]}
      />
      {properties ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
          <ValueTile label="R, м²К/Вт" value={properties.rTotal_m2K_W.toFixed(3)} />
          <ValueTile label="U, Вт/(м²К)" value={properties.uTotal_W_m2K.toFixed(3)} />
          <div className="col-span-2">
            <ValueTile label="Теплоёмкость, Дж/(м²К)" value={properties.heatCapacity_J_m2K.toFixed(0)} />
          </div>
        </div>
      ) : null}

      <ConstructionLayerEditor
        title="Состав перекрытия"
        layers={layers}
        hasCustomLayers={hasCustomLayers}
        onUpdateLayer={updateLayer}
        onAddLayer={addLayer}
        onRemoveLayer={removeLayer}
        onReset={resetToPreset}
        resetLabel="Вернуть по пресету"
      />
    </div>
  );
}

function WallForm({
  wall,
  levels,
  onUpdateWall,
}: {
  wall: Wall;
  levels: BuildingModel["levels"];
  onUpdateWall: (wallId: string, patch: Partial<Wall>) => void;
}) {
  const presetId = wall.envelopePresetId ?? resolveDefaultPresetId("wall");
  const assemblyId = wall.wallAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID;
  const presetLayers = ensureWallLayers(undefined, assemblyId);
  const layers: ConstructionLayer[] = wall.layers ?? presetLayers;
  const properties = computeWallProperties(layers, assemblyId, {
    includeSp50AirFilms: true,
  });
  const hasCustomLayers = Boolean(wall.layers?.length);

  const applyLayersPatch = useCallback(
    (nextLayers: ConstructionLayer[]) => {
      const totalThickness = nextLayers.reduce((sum, layer) => sum + (layer.thickness_m || 0), 0);
      onUpdateWall(wall.id, {
        layers: nextLayers.length ? nextLayers : undefined,
        thickness_m: totalThickness > 0.001 ? Math.round(totalThickness * 1000) / 1000 : wall.thickness_m,
      });
    },
    [onUpdateWall, wall.id, wall.thickness_m]
  );

  const updateLayer = useCallback(
    (index: number, patch: Partial<ConstructionLayer>) => {
      const nextLayers = layers.map((layer, layerIndex) => (layerIndex === index ? { ...layer, ...patch } : layer));
      applyLayersPatch(nextLayers);
    },
    [applyLayersPatch, layers]
  );

  const addLayer = useCallback(() => {
    applyLayersPatch([...layers, { materialId: "mineral_wool", thickness_m: 0.05 }]);
  }, [applyLayersPatch, layers]);

  const removeLayer = useCallback(
    (index: number) => {
      applyLayersPatch(layers.filter((_, layerIndex) => layerIndex !== index));
    },
    [applyLayersPatch, layers]
  );

  const resetToAssembly = useCallback(() => {
    onUpdateWall(wall.id, {
      layers: undefined,
      thickness_m: presetLayers.reduce((sum, layer) => sum + (layer.thickness_m || 0), 0) || wall.thickness_m,
    });
  }, [onUpdateWall, presetLayers, wall.id, wall.thickness_m]);

  return (
    <div className="space-y-3">
      <EnvelopePresetField
        kind="wall"
        value={presetId}
        onChange={(value) => onUpdateWall(wall.id, applyEnvelopePresetToWall(wall, value))}
      />
      <InfoCard
        rows={[
          { label: "Длина", value: `${wallLength(wall).toFixed(2)} м` },
          { label: "Уровень", value: getLevelSummaryLabel({ levels }, wall.levelId) },
          { label: "Источник", value: describeEnvelopePreset(presetId) ?? "Ручная настройка" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={hasCustomLayers ? "Толщина (авто), м" : "Толщина, м"}
          value={wall.thickness_m}
          step={0.01}
          onChange={(value) => onUpdateWall(wall.id, { thickness_m: value })}
        />
        <NumberField label="Высота, м" value={wall.height_m} step={0.1} onChange={(value) => onUpdateWall(wall.id, { height_m: value })} />
      </div>
      {properties ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
          <ValueTile label="R, м²К/Вт" value={properties.rValue.toFixed(3)} />
          <ValueTile label="U, Вт/(м²К)" value={properties.uValue.toFixed(3)} />
          <div className="col-span-2">
            <ValueTile label="Теплоёмкость, Дж/(м²К)" value={properties.heatCapacity_J_m2K.toFixed(0)} />
          </div>
        </div>
      ) : null}
      <ConstructionLayerEditor
        title="Состав стены"
        layers={layers}
        hasCustomLayers={hasCustomLayers}
        onUpdateLayer={updateLayer}
        onAddLayer={addLayer}
        onRemoveLayer={removeLayer}
        onReset={resetToAssembly}
        resetLabel="Вернуть по сборке"
      />
    </div>
  );
}
function OpeningForm({
  kind,
  opening,
  model,
  onUpdate,
}: {
  kind: "door" | "window";
  opening: Door | Window;
  model: Pick<BuildingModel, "walls" | "levels">;
  onUpdate: (patch: Partial<Door> | Partial<Window>) => void;
}) {
  const { walls } = model;
  const attachedWall = opening.anchor.wallId ? walls.find((wall) => wall.id === opening.anchor.wallId) ?? null : null;
  const offsetValue = attachedWall ? anchorToOffset(opening.anchor, attachedWall) : 0;
  const presetId = opening.envelopePresetId ?? resolveDefaultPresetId(kind);
  const reportLayers = opening.reportLayers ?? getEnvelopePreset(presetId)?.reportLayers;
  const runtimeU = opening.runtimeU_W_m2K ?? getEnvelopePreset(presetId)?.runtimeU_W_m2K ?? null;
  const reportProps = reportLayers?.length
    ? computeWallProperties(reportLayers, undefined, { includeSp50AirFilms: true })
    : null;
  const openingHeightLimit = useMemo(() => {
    if (!attachedWall) {
      return null;
    }
    const sorted = [...model.levels].sort((left, right) => left.elevation_m - right.elevation_m || left.id.localeCompare(right.id));
    const wallLevel = sorted.find((level) => level.id === attachedWall.levelId);
    if (!wallLevel) {
      return Math.max(0.2, attachedWall.height_m);
    }
    const nextLevel = sorted.find((level) => level.elevation_m > wallLevel.elevation_m);
    const ceilingElevation = nextLevel ? nextLevel.elevation_m : wallLevel.elevation_m + wallLevel.height_m;
    const limitByLevel = Math.max(0.2, ceilingElevation - wallLevel.elevation_m);
    return Math.max(0.2, Math.min(limitByLevel, attachedWall.height_m));
  }, [attachedWall, model.levels]);
  const clampOpeningHeight = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) {
        return 0.2;
      }
      const base = Math.max(0.2, value);
      if (openingHeightLimit == null) {
        return base;
      }
      return Math.min(base, openingHeightLimit);
    },
    [openingHeightLimit]
  );

  const rebind = (wall: Wall | null, offset: number) => {
    if (!wall) {
      onUpdate({ anchor: { wallId: null, t: 0, offset_m: 0 }, lost: true });
      return;
    }
    const clamped = clampOffset(offset, wall, opening.width_m);
    onUpdate({ anchor: buildAnchorFromOffset(wall, clamped), lost: false });
  };

  const applyPreset = (value: string) => {
    if (kind === "door") {
      onUpdate(applyEnvelopePresetToDoor(opening, value));
      return;
    }
    onUpdate(applyEnvelopePresetToWindow(opening, value));
  };

  return (
    <div className="space-y-3">
      <EnvelopePresetField kind={kind} value={presetId} onChange={applyPreset} />
      <InfoCard
        rows={[
          { label: "Тип", value: kind === "door" ? "Дверь" : "Окно" },
          { label: "Привязка", value: opening.anchor.wallId ? getWallDisplayLabel(model, opening.anchor.wallId) : "Не привязано" },
          { label: "U runtime", value: runtimeU != null ? `${runtimeU.toFixed(3)} Вт/(м²·К)` : "—" },
        ]}
      />
      {reportProps ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
          <ValueTile label="R_red (отчёт)" value={reportProps.rValue.toFixed(3)} />
          <ValueTile label="U (отчёт)" value={reportProps.uValue.toFixed(3)} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Ширина, м" value={opening.width_m} step={0.05} onChange={(value) => onUpdate({ width_m: value })} />
        <NumberField
          label={openingHeightLimit != null ? `Высота, м (до ${openingHeightLimit.toFixed(2)})` : "Высота, м"}
          value={opening.height_m}
          step={0.05}
          min={0.2}
          max={openingHeightLimit ?? undefined}
          onChange={(value) => onUpdate({ height_m: clampOpeningHeight(value) })}
        />
      </div>
      {kind === "door" ? (
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Петли"
            value={(opening as Door).swingDirection ?? "left"}
            onChange={(value) => onUpdate({ swingDirection: value as Door["swingDirection"] })}
            options={[
              { value: "left", label: "Влево" },
              { value: "right", label: "Вправо" },
            ]}
          />
          <SelectField
            label="Открывание"
            value={(opening as Door).openingDirection ?? "inward"}
            onChange={(value) => onUpdate({ openingDirection: value as Door["openingDirection"] })}
            options={[
              { value: "inward", label: "Внутрь" },
              { value: "outward", label: "Наружу" },
            ]}
          />
        </div>
      ) : null}
      {kind === "window" ? (
        <NumberField label="Подоконник, м" value={opening.sill_m ?? 0} step={0.05} onChange={(value) => onUpdate({ sill_m: value })} />
      ) : null}
      <SelectField
        label="Стена"
        value={opening.anchor.wallId ?? ""}
        onChange={(value) => {
          const nextWall = value ? walls.find((wall) => wall.id === value) ?? null : null;
          rebind(nextWall, offsetValue);
        }}
        options={[
          { value: "", label: "Не выбрана" },
          ...walls.map((wall) => ({
            value: wall.id,
            label: getWallDisplayLabel(model, wall.id),
          })),
        ]}
      />
      <NumberField
        label="Смещение, м"
        value={attachedWall ? offsetValue : 0}
        step={0.05}
        onChange={(value) => {
          if (attachedWall) {
            rebind(attachedWall, value);
          }
        }}
        disabled={!attachedWall}
      />
      {!opening.anchor.wallId ? (
        <HintCard tone="warning" text="Проём потерял привязку к стене. Выберите новую стену, чтобы избежать некорректной 3D-геометрии." />
      ) : null}
    </div>
  );
}

function PipeForm({
  model,
  pipe,
  onUpdatePipe,
}: {
  model: BuildingModel;
  pipe: PipeNetwork;
  onUpdatePipe: (pipeId: string, patch: Partial<PipeNetwork>) => void;
}) {
  const updatePipeRole = (value: PipeFlowRole) => {
    const nextType =
      value === "supply" ? "heating_supply" : value === "return" ? "heating_return" : pipe.type;
    onUpdatePipe(pipe.id, {
      flowRole: value,
      circuitRole: value === "distribution" ? "mixed" : value,
      type: nextType,
    });
  };

  return (
    <div className="space-y-3">
      <InfoCard
        rows={[
          { label: "Длина", value: `${polylineLength(pipe.path).toFixed(2)} м` },
          { label: "Сегменты", value: `${Math.max(pipe.path.length - 1, 0)}` },
          { label: "Подключения", value: pipe.connectedEquipmentIds.length ? `${pipe.connectedEquipmentIds.length}` : "Нет" },
          { label: "Этаж", value: getFloorDisplayLabel(model, pipe.levelId) },
          { label: "Контур", value: formatHeatingCircuitLabel(pipe.heatingSystemId) },
          { label: "Система", value: NETWORK_SYSTEM_TYPE_LABELS[pipe.systemType ?? resolveNetworkSystemType(pipe.type)] },
          { label: "Подача/обратка", value: describeSupplyReturnRole(pipe) },
          { label: "Диаметр", value: `${Math.round(pipe.diameter_mm)} мм` },
        ]}
      />
      <TextField label="Идентификатор контура" value={pipe.heatingSystemId ?? ""} onChange={(value) => onUpdatePipe(pipe.id, { heatingSystemId: value.trim() || null })} />
      <SelectField
        label="Тип сети"
        value={pipe.type}
        onChange={(value) => {
          const nextType = value as PipeSystemType;
          const defaults = createPipeDefaults(nextType);
          onUpdatePipe(pipe.id, {
            type: nextType,
            flowRole: defaults.flowRole,
            circuitRole: defaults.circuitRole,
            systemType: pipe.systemType ?? defaults.systemType,
            heatingSystemKind: pipe.heatingSystemKind ?? defaults.heatingSystemKind,
            heatCarrier: pipe.heatCarrier ?? defaults.heatCarrier,
            markingColor: defaultPipeMarkingColor(nextType),
          });
        }}
        options={Object.entries(PIPE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Тип системы"
          value={pipe.systemType ?? resolveNetworkSystemType(pipe.type)}
          onChange={(value) => onUpdatePipe(pipe.id, { systemType: value as NetworkSystemType })}
          options={Object.entries(NETWORK_SYSTEM_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Роль ветви"
          value={pipe.flowRole ?? "distribution"}
          onChange={(value) => updatePipeRole(value as PipeFlowRole)}
          options={Object.entries(PIPE_FLOW_ROLE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Схема отопления"
          value={pipe.heatingSystemKind ?? "two_pipe"}
          onChange={(value) => onUpdatePipe(pipe.id, { heatingSystemKind: value as PipeNetwork["heatingSystemKind"] })}
          options={Object.entries(HEATING_SYSTEM_KIND_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Роль контура"
          value={pipe.circuitRole ?? resolvePipeCircuitRole(pipe.type)}
          onChange={(value) => onUpdatePipe(pipe.id, { circuitRole: value as PipeNetwork["circuitRole"] })}
          options={Object.entries(PIPE_CIRCUIT_ROLE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Класс участка"
          value={pipe.segmentClass ?? "branch"}
          onChange={(value) => onUpdatePipe(pipe.id, { segmentClass: value as PipeNetwork["segmentClass"] })}
          options={Object.entries(PIPE_SEGMENT_CLASS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Теплоноситель"
          value={pipe.heatCarrier ?? "water"}
          onChange={(value) => onUpdatePipe(pipe.id, { heatCarrier: value as PipeNetwork["heatCarrier"] })}
          options={Object.entries(HEAT_CARRIER_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Направление потока"
          value={pipe.flowDirection ?? "unknown"}
          onChange={(value) => onUpdatePipe(pipe.id, { flowDirection: value as PipeNetwork["flowDirection"] })}
          options={Object.entries(FLOW_DIRECTION_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <TextField
          label="Подключенное оборудование"
          value={pipe.connectedEquipmentIds.join(", ")}
          onChange={(value) =>
            onUpdatePipe(pipe.id, {
              connectedEquipmentIds: value
                .split(",")
                .map((entry) => entry.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Материал"
          value={pipe.material}
          onChange={(value) => onUpdatePipe(pipe.id, { material: value as PipeMaterial })}
          options={[
            { value: "steel", label: "Сталь" },
            { value: "pex", label: "PEX" },
            { value: "copper", label: "Медь" },
            { value: "polypropylene", label: "Полипропилен" },
          ]}
        />
        <SelectField
          label="Маркировка трубы"
          value={pipe.markingColor ?? defaultPipeMarkingColor(pipe.type)}
          onChange={(value) => onUpdatePipe(pipe.id, { markingColor: value as PipeMarkingColor })}
          options={Object.entries(PIPE_MARKING_COLOR_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Диаметр по ряду, мм"
          value={String(pipe.diameter_mm)}
          onChange={(value) => {
            const diameter = Number(value);
            onUpdatePipe(pipe.id, { diameter_mm: diameter, innerDiameter_mm: innerDiameterFor(diameter) });
          }}
          options={PIPE_DIAMETER_OPTIONS.map((diameter) => ({ value: String(diameter), label: `${diameter} мм` }))}
        />
        <NumberField label="Внутренний диаметр, мм" value={pipe.innerDiameter_mm ?? innerDiameterFor(pipe.diameter_mm)} step={1} onChange={(value) => onUpdatePipe(pipe.id, { innerDiameter_mm: value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Температура, °C" value={pipe.fluidTemperatureC} step={0.5} onChange={(value) => onUpdatePipe(pipe.id, { fluidTemperatureC: value })} />
        <NumberField label="Перепад ΔT, °C" value={pipe.temperatureDropC ?? 0} step={0.5} onChange={(value) => onUpdatePipe(pipe.id, { temperatureDropC: value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Расход, кг/с" value={pipe.flowRate_kg_s} step={0.01} onChange={(value) => onUpdatePipe(pipe.id, { flowRate_kg_s: value })} />
        <NumberField label="Скорость, м/с" value={pipe.designVelocity_m_s ?? 0} step={0.05} onChange={(value) => onUpdatePipe(pipe.id, { designVelocity_m_s: value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Давление, Па" value={pipe.pressurePa} step={100} onChange={(value) => onUpdatePipe(pipe.id, { pressurePa: value })} />
        <NumberField label="Потери давления, Па" value={pipe.pressureDropPa ?? 0} step={50} onChange={(value) => onUpdatePipe(pipe.id, { pressureDropPa: value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Изоляция, мм" value={pipe.insulationThickness_mm ?? 0} step={1} onChange={(value) => onUpdatePipe(pipe.id, { insulationThickness_mm: value })} />
        <NumberField label="Теплопотери, Вт" value={pipe.heatLossW ?? 0} step={10} onChange={(value) => onUpdatePipe(pipe.id, { heatLossW: value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Внутренняя расч. t, °C" value={pipe.designIndoorTemperatureC ?? 21} step={0.5} onChange={(value) => onUpdatePipe(pipe.id, { designIndoorTemperatureC: value })} />
        <NumberField label="Наружная расч. t, °C" value={pipe.designOutdoorTemperatureC ?? -18} step={0.5} onChange={(value) => onUpdatePipe(pipe.id, { designOutdoorTemperatureC: value })} />
      </div>
    </div>
  );
}

function DuctForm({
  duct,
  onUpdateDuct,
}: {
  duct: DuctNetwork;
  onUpdateDuct: (ductId: string, patch: Partial<DuctNetwork>) => void;
}) {
  return (
    <div className="space-y-3">
      <InfoCard
        rows={[
          { label: "Длина", value: `${polylineLength(duct.path).toFixed(2)} м` },
          { label: "Сегменты", value: `${Math.max(duct.path.length - 1, 0)}` },
          { label: "Подключения", value: `${duct.connectedEquipmentIds.length}` },
        ]}
      />
      <SelectField
        label="Сечение"
        value={duct.section.shape}
        onChange={(value) => onUpdateDuct(duct.id, { section: { ...duct.section, shape: value as DuctNetwork["section"]["shape"] } })}
        options={[
          { value: "rectangular", label: "Прямоугольное" },
          { value: "round", label: "Круглое" },
        ]}
      />
      {duct.section.shape === "rectangular" ? (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Ширина, мм" value={duct.section.width_mm ?? 400} step={10} onChange={(value) => onUpdateDuct(duct.id, { section: { ...duct.section, width_mm: value } })} />
          <NumberField label="Высота, мм" value={duct.section.height_mm ?? 200} step={10} onChange={(value) => onUpdateDuct(duct.id, { section: { ...duct.section, height_mm: value } })} />
        </div>
      ) : (
        <NumberField label="Диаметр, мм" value={duct.section.diameter_mm ?? 250} step={10} onChange={(value) => onUpdateDuct(duct.id, { section: { ...duct.section, diameter_mm: value } })} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Расход, м³/с" value={duct.airflow_m3_s} step={0.01} onChange={(value) => onUpdateDuct(duct.id, { airflow_m3_s: value })} />
        <NumberField label="Скорость, м/с" value={duct.airVelocity_m_s} step={0.1} onChange={(value) => onUpdateDuct(duct.id, { airVelocity_m_s: value })} />
      </div>
    </div>
  );
}

function EquipmentForm({
  model,
  equipment,
  roomNames,
  onUpdateEquipment,
}: {
  model: BuildingModel;
  equipment: Equipment;
  roomNames: Record<string, string>;
  onUpdateEquipment: (equipmentId: string, patch: Partial<Equipment>) => void;
}) {
  const connectedPipes = model.pipes.filter((pipe) => equipment.connectedNetworkIds.includes(pipe.id));
  const connectedDucts = model.ducts.filter((duct) => equipment.connectedNetworkIds.includes(duct.id));
  const primaryPipe = connectedPipes[0];
  const diagnostics = [
    !equipment.roomId ? "Помещение не назначено — уточните привязку для теплового расчёта." : null,
    !equipment.connectedNetworkIds.length ? "Нет связи с инженерной сетью." : null,
    typeof equipment.params.nominalPowerW !== "number" && ["radiator", "boiler", "heat_exchanger", "fancoil"].includes(equipment.type)
      ? "Не задана расчётная мощность"
      : null,
  ].filter(Boolean) as string[];
  const designFlow =
    typeof equipment.params.designFlow_kg_s === "number"
      ? `${equipment.params.designFlow_kg_s.toFixed(2)} кг/с`
      : typeof equipment.params.designAirflow_m3_s === "number"
        ? `${equipment.params.designAirflow_m3_s.toFixed(2)} м³/с`
        : "Не задан";
  const power =
    typeof equipment.params.nominalPowerW === "number" && Number.isFinite(equipment.params.nominalPowerW)
      ? `${equipment.params.nominalPowerW.toFixed(0)} Вт`
      : "Не задана";
  const thermalPair =
    typeof equipment.params.supplyTemperatureC === "number" || typeof equipment.params.returnTemperatureC === "number"
      ? `${equipment.params.supplyTemperatureC?.toFixed(0) ?? "—"} / ${equipment.params.returnTemperatureC?.toFixed(0) ?? "—"} °C`
      : "Нет данных";
  const roomLabel = equipment.roomId
    ? roomNames[equipment.roomId] ?? getRoomDisplayLabel(model, equipment.roomId)
    : "Не назначено";
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Инженерная карточка</p>
        <div className="mt-3 grid gap-2 text-sm text-[color:var(--text-muted)]">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Наименование</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">
              {getEquipmentInspectorTitle(equipment, model.equipment)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Тип</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">{EQUIPMENT_TYPE_LABELS[equipment.type]}</span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Назначение</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">{getEquipmentPurposeLabel(equipment.type)}</span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Этаж</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">{getFloorDisplayLabel(model, equipment.levelId)}</span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Помещение</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">{roomLabel}</span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Контур</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">
              {formatHeatingCircuitLabel(equipment.params.assignedSystemId)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Подача / обратка</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">{describeSupplyReturnRole(primaryPipe)}</span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Мощность</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">{power}</span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Расход</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">{designFlow}</span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Температура</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">{thermalPair}</span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Состояние</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">
              {formatEquipmentStateLabel(equipment.state)} · {describeEquipmentConnectionStatus(equipment, model.pipes)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2">
            <span>Тепловая модель</span>
            <span className="text-right font-semibold text-[color:var(--text-base)]">
              {equipment.roomId && typeof equipment.params.nominalPowerW === "number"
                ? "Учитывается в зональном балансе"
                : "Нет данных для зоны"}
            </span>
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Тип оборудования"
          value={equipment.type}
          onChange={(value) => onUpdateEquipment(equipment.id, { type: value as EquipmentType })}
          options={Object.entries(EQUIPMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Состояние"
          value={equipment.state}
          onChange={(value) => onUpdateEquipment(equipment.id, { state: value as Equipment["state"] })}
          options={[
            { value: "on", label: "Включено" },
            { value: "off", label: "Выключено" },
            { value: "alarm", label: "Авария" },
          ]}
        />
      </div>
      {connectedPipes.length ? <PolicyList title="Трубопроводы" items={connectedPipes.map((pipe) => PIPE_TYPE_LABELS[pipe.type])} /> : null}
      {connectedDucts.length ? <PolicyList title="Воздуховоды" items={connectedDucts.map((_, index) => `Воздуховод ${index + 1}`)} /> : null}
      {diagnostics.length ? <PolicyList title="Предупреждения" items={diagnostics} /> : null}
      <EquipmentParameterFields equipment={equipment} onUpdateEquipment={onUpdateEquipment} />
      <PolicyList title="Допустимые сети" items={describeEquipmentNetworkPolicy(equipment.type)} />
    </div>
  );
}

function SensorForm({
  sensor,
  roomNames,
  onUpdateSensor,
}: {
  sensor: SensorDevice;
  roomNames: Record<string, string>;
  onUpdateSensor: (sensorId: string, patch: Partial<SensorDevice>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Тип датчика"
          value={sensor.type}
          onChange={(value) => onUpdateSensor(sensor.id, { type: value as SensorType })}
          options={Object.entries(SENSOR_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectField
          label="Статус"
          value={sensor.status}
          onChange={(value) => onUpdateSensor(sensor.id, { status: value as SensorStatus })}
          options={[
            { value: "normal", label: "Норма" },
            { value: "warning", label: "Внимание" },
            { value: "alarm", label: "Авария" },
          ]}
        />
      </div>
      <InfoCard rows={[{ label: "Помещение", value: sensor.roomId ? roomNames[sensor.roomId] ?? sensor.roomId : "Не привязано" }]} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Текущее значение" value={sensor.value ?? 0} step={0.1} onChange={(value) => onUpdateSensor(sensor.id, { value })} />
        <TextField label="Единицы" value={sensor.unit} onChange={(value) => onUpdateSensor(sensor.id, { unit: value })} />
      </div>
    </div>
  );
}

function EquipmentParameterFields({
  equipment,
  onUpdateEquipment,
}: {
  equipment: Equipment;
  onUpdateEquipment: (equipmentId: string, patch: Partial<Equipment>) => void;
}) {
  const updateParams = (patch: Partial<Equipment["params"]>) =>
    onUpdateEquipment(equipment.id, { params: { ...equipment.params, ...patch } });

  switch (equipment.type) {
    case "radiator":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Мощность, Вт" value={equipment.params.nominalPowerW ?? 0} step={50} onChange={(value) => updateParams({ nominalPowerW: value })} />
          <NumberField label="Расход, кг/с" value={equipment.params.designFlow_kg_s ?? 0} step={0.01} onChange={(value) => updateParams({ designFlow_kg_s: value })} />
          <NumberField label="Подача, °C" value={equipment.params.supplyTemperatureC ?? 70} step={0.5} onChange={(value) => updateParams({ supplyTemperatureC: value })} />
          <NumberField label="Обратка, °C" value={equipment.params.returnTemperatureC ?? 50} step={0.5} onChange={(value) => updateParams({ returnTemperatureC: value })} />
          <SelectField
            label="Тип подключения"
            value={equipment.params.connectionType ?? "side"}
            onChange={(value) => updateParams({ connectionType: value as Equipment["params"]["connectionType"] })}
            options={Object.entries(HEATING_CONNECTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <TextField label="Контур" value={equipment.params.assignedSystemId ?? ""} onChange={(value) => updateParams({ assignedSystemId: value.trim() || null })} />
        </div>
      );
    case "boiler":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Мощность, Вт" value={equipment.params.nominalPowerW ?? 0} step={100} onChange={(value) => updateParams({ nominalPowerW: value })} />
          <NumberField label="КПД" value={equipment.params.efficiency ?? 0.9} step={0.01} onChange={(value) => updateParams({ efficiency: value })} />
          <NumberField label="Подача, °C" value={equipment.params.supplyTemperatureC ?? 70} step={0.5} onChange={(value) => updateParams({ supplyTemperatureC: value })} />
          <NumberField label="Обратка, °C" value={equipment.params.returnTemperatureC ?? 50} step={0.5} onChange={(value) => updateParams({ returnTemperatureC: value })} />
          <NumberField label="Внутренняя расч. t, °C" value={equipment.params.designIndoorTemperatureC ?? 21} step={0.5} onChange={(value) => updateParams({ designIndoorTemperatureC: value })} />
          <NumberField label="Наружная расч. t, °C" value={equipment.params.designOutdoorTemperatureC ?? -18} step={0.5} onChange={(value) => updateParams({ designOutdoorTemperatureC: value })} />
        </div>
      );
    case "pump":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Напор, Па" value={equipment.params.headPa ?? 0} step={100} onChange={(value) => updateParams({ headPa: value })} />
          <NumberField label="Расход, кг/с" value={equipment.params.designFlow_kg_s ?? 0} step={0.01} onChange={(value) => updateParams({ designFlow_kg_s: value })} />
          <NumberField label="КПД" value={equipment.params.efficiency ?? 0.7} step={0.01} onChange={(value) => updateParams({ efficiency: value })} />
        </div>
      );
    case "ahu":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Воздух, м³/с" value={equipment.params.designAirflow_m3_s ?? 0} step={0.01} onChange={(value) => updateParams({ designAirflow_m3_s: value })} />
          <NumberField label="КПД" value={equipment.params.efficiency ?? 0.68} step={0.01} onChange={(value) => updateParams({ efficiency: value })} />
        </div>
      );
    case "diffuser":
      return <NumberField label="Воздух, м³/с" value={equipment.params.designAirflow_m3_s ?? 0} step={0.01} onChange={(value) => updateParams({ designAirflow_m3_s: value })} />;
    case "fancoil":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Мощность, Вт" value={equipment.params.nominalPowerW ?? 0} step={50} onChange={(value) => updateParams({ nominalPowerW: value })} />
          <NumberField label="Воздух, м³/с" value={equipment.params.designAirflow_m3_s ?? 0} step={0.01} onChange={(value) => updateParams({ designAirflow_m3_s: value })} />
          <NumberField label="Расход, кг/с" value={equipment.params.designFlow_kg_s ?? 0} step={0.01} onChange={(value) => updateParams({ designFlow_kg_s: value })} />
        </div>
      );
    case "heat_exchanger":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Мощность, Вт" value={equipment.params.nominalPowerW ?? 0} step={500} onChange={(value) => updateParams({ nominalPowerW: value })} />
          <NumberField label="Расход, кг/с" value={equipment.params.designFlow_kg_s ?? 0} step={0.01} onChange={(value) => updateParams({ designFlow_kg_s: value })} />
          <NumberField label="Подача, °C" value={equipment.params.supplyTemperatureC ?? 95} step={0.5} onChange={(value) => updateParams({ supplyTemperatureC: value })} />
          <NumberField label="Обратка, °C" value={equipment.params.returnTemperatureC ?? 60} step={0.5} onChange={(value) => updateParams({ returnTemperatureC: value })} />
          <NumberField label="Δp, Па" value={equipment.params.pressureDropPa ?? 0} step={500} onChange={(value) => updateParams({ pressureDropPa: value })} />
          <NumberField label="КПД" value={equipment.params.efficiency ?? 0.97} step={0.01} onChange={(value) => updateParams({ efficiency: value })} />
        </div>
      );
    case "elevator":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Расход, кг/с" value={equipment.params.designFlow_kg_s ?? 0} step={0.01} onChange={(value) => updateParams({ designFlow_kg_s: value })} />
          <NumberField label="Δp, Па" value={equipment.params.pressureDropPa ?? 0} step={500} onChange={(value) => updateParams({ pressureDropPa: value })} />
          <NumberField label="Подача, °C" value={equipment.params.supplyTemperatureC ?? 95} step={0.5} onChange={(value) => updateParams({ supplyTemperatureC: value })} />
          <NumberField label="Обратка, °C" value={equipment.params.returnTemperatureC ?? 70} step={0.5} onChange={(value) => updateParams({ returnTemperatureC: value })} />
        </div>
      );
    case "expansion_tank":
      return (
        <NumberField label="Δp, Па" value={equipment.params.pressureDropPa ?? 0} step={200} onChange={(value) => updateParams({ pressureDropPa: value })} />
      );
    case "dirt_separator":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Расход, кг/с" value={equipment.params.designFlow_kg_s ?? 0} step={0.01} onChange={(value) => updateParams({ designFlow_kg_s: value })} />
          <NumberField label="Δp, Па" value={equipment.params.pressureDropPa ?? 0} step={500} onChange={(value) => updateParams({ pressureDropPa: value })} />
        </div>
      );
    default:
      return <HintCard text="Для этого типа оборудования индивидуальные расчётные параметры пока не заданы." />;
  }
}

function PolicyList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-muted)]">
        {items.map((item) => (
          <li key={item} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="text-xs font-semibold text-[color:var(--text-soft)]">
      {label}
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) {
            onChange(next);
            return;
          }
          const clampedMin = typeof min === "number" ? Math.max(min, next) : next;
          const clamped = typeof max === "number" ? Math.min(max, clampedMin) : clampedMin;
          onChange(clamped);
        }}
        className="ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)] disabled:bg-[color:var(--surface-muted)]"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-semibold text-[color:var(--text-soft)]">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]"
      />
    </label>
  );
}

const ROOF_HEATED_SIDE_OPTIONS: Array<{ value: NonNullable<Roof["heatedSide"]>; label: string }> = [
  { value: "below", label: "Снизу тёплое помещение" },
  { value: "above", label: "Снизу холодное помещение (чердак)" },
];

function HeatedSideField({
  value,
  onChange,
  options,
}: {
  value: NonNullable<Roof["heatedSide"]>;
  onChange: (value: NonNullable<Roof["heatedSide"]>) => void;
  options: Array<{ value: NonNullable<Roof["heatedSide"]>; label: string }>;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-0.5 rounded-[10px] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]/50 p-0.5"
      role="group"
      aria-label="Обогреваемая сторона"
    >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`rounded-[8px] px-2 py-1.5 text-left text-[11px] font-medium leading-snug transition ${
                active
                  ? "bg-[color:var(--surface-elevated)] text-[color:var(--text-base)] shadow-[var(--shadow-control)] ring-1 ring-[color:var(--accent-muted)]"
                  : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-base)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="text-xs font-semibold text-[color:var(--text-soft)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoCard({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="ui-panel-muted rounded-[16px] p-3 text-xs text-[color:var(--text-muted)]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
          <span className="uppercase tracking-wide text-[color:var(--text-soft)]">{row.label}</span>
          <span className="text-right font-semibold text-[color:var(--text-base)]">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function HintCard({
  text,
  tone = "info",
}: {
  text: string;
  tone?: "info" | "warning";
}) {
  return (
    <div
      className={`rounded-[16px] border px-3 py-3 text-sm ${
        tone === "warning"
          ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"
          : "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--text-muted)]"
      }`}
    >
      {text}
    </div>
  );
}

function ValueTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[color:var(--text-soft)]">{label}</p>
      <p className="text-sm font-semibold text-[color:var(--text-base)]">{value}</p>
    </div>
  );
}

const wallLength = (wall: Wall): number => Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);

const clampOffset = (value: number, wall: Wall, width: number): number => {
  const max = Math.max(0, wallLength(wall) - width);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(0, value), max);
};

function selectionLabel(kind: SelectionKind | undefined): string {
  if (kind === "engineeringEquipment") {
    return "Инженерное оборудование";
  }
  if (kind === "engineeringPipe") {
    return "Инженерный трубопровод";
  }
  switch (kind) {
    case "room":
      return "Помещение";
    case "wall":
      return "Стена";
    case "roof":
      return "Крыша";
    case "slab":
      return "Перекрытие";
    case "door":
      return "Дверь";
    case "window":
      return "Окно";
    case "pipe":
      return "Трубопровод";
    case "duct":
      return "Воздуховод";
    case "equipment":
      return "Оборудование";
    case "sensor":
      return "Датчик";
    case "loop":
      return "Замкнутый контур";
    default:
      return "Объект";
  }
}

function draftLabel(
  kind: DraftKind | null,
  tool: BuildTool,
  equipmentPreset: EquipmentType,
  engineeringEquipmentPreset: EngineeringEquipmentType
): string {
  if (kind === "engineeringEquipment") {
    return `Новое инженерное оборудование: ${ENGINEERING_EQUIPMENT_LABELS[engineeringEquipmentPreset]}`;
  }
  if (kind === "engineeringPipe") {
    return "Новый инженерный трубопровод";
  }
  switch (kind) {
    case "room":
      return tool === "roomRect" ? "Новая прямоугольная комната" : "Новая комната по контуру";
    case "wall":
      return "Новая стена";
    case "roof":
      return "Новая крыша";
    case "slab":
      return "Новое перекрытие";
    case "door":
      return "Новая дверь";
    case "window":
      return "Новое окно";
    case "pipe":
      return "Новый трубопровод";
    case "duct":
      return "Новый воздуховод";
    case "equipment":
      return `Новое оборудование: ${EQUIPMENT_TYPE_LABELS[equipmentPreset]}`;
    case "sensor":
      return "Новый датчик";
    default:
      return "Инструмент";
  }
}

export default RightInspector;
