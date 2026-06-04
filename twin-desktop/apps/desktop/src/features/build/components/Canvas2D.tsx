import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BuildingModel,
  Door,
  FloorSlab,
  Roof,
  Room,
  Stair,
  Vec2,
  Wall,
  Window,
} from "../../../entities/geometry/types";
import type {
  EngineeringEquipment,
  EngineeringEquipmentType,
  EngineeringPipe,
  EngineeringPortDirection,
} from "../../../entities/engineering/types";
import type { DuctNetwork, Equipment, EquipmentType, PipeNetwork, PipeSystemType, SensorDevice } from "../../../entities/networks/types";
import {
  EQUIPMENT_TYPE_LABELS,
  getPipeVisualStyle,
  PIPE_TYPE_COLORS,
  PIPE_TYPE_LABELS,
  resolvePipeColor,
  SENSOR_TYPE_LABELS,
} from "../../../entities/networks/types";
import {
  midpoint,
  polygonArea,
  polygonCentroid,
  polygonContainsPoint,
  pointToSegmentDistance,
  segmentsIntersect,
  snapToGrid,
  validateRoomPolygon,
  orthogonalSnap,
} from "../../../entities/geometry/geom";
import { createId } from "../../../shared/utils/id";
import type { BuildTool, Selection } from "../build.store";
import { compactRoomLabel, getEquipmentDisplayName, getPipeDisplayLabel } from "../utils/entityLabels";
import {
  buildDuctHoverDetails,
  buildEquipmentHoverDetails,
  buildPipeHoverDetails,
  buildSensorHoverDetails,
} from "../engineering/userLabels";
import { renderEquipmentPlanSymbol } from "./equipmentPlanSymbols";
import { notifyError } from "../../../entities/notifications/notification.store";
import { formatArea, formatNumber } from "../../../shared/utils/format";
import type { RoomNeighborEdge } from "../../../core/graph/adjacency";
import type { RoomLoopCandidate } from "../auto/detectRoomsFromWalls";
import { buildHeatingModelSnapshot, type SmartModelSnapshot } from "../../../core/networks/index";
import type { ThermalTimelinePoint } from "../../../core/thermal/solver";
import type { TransientVisualizationFrame } from "../../../core/thermal/transient/index";
import {
  createThermalFieldModel,
  sampleSmoothedThermalFieldAtPoint,
  type ThermalFieldBuildOptions,
  type ThermalFieldModel,
} from "../../../core/thermal/field";
import { temperatureToColor } from "../../twin/twin.theme";
import { buildTemperatureLegendRange } from "../thermal/temperatureLegend";
import { transientSourceMatches } from "../thermal/transientVisualization";
import {
  createPipeDefaults,
  defaultEquipmentParams,
  DOOR_DEFAULTS,
  DUCT_DEFAULTS,
  FLOOR_SLAB_DEFAULTS,
  ROOF_DEFAULTS,
  SENSOR_DEFAULTS,
  STAIR_DEFAULTS,
  WALL_DEFAULTS,
  WINDOW_DEFAULTS,
} from "../defaults";
import { type HeatingNetworkDisplayMode } from "../networks/displayModes";
import {
  appendLinearDraftPoint,
  cancelLinearDraft,
  finalizeLinearDraft,
  isLinearTool,
  previewLinearDraftPoint,
} from "../../../core/editor/drawing";
import {
  autoJoinWalls,
  snapAxesToNearbyAnchors,
  snapToPoint,
  snapToPolygonBoundary,
  snapToSegment,
} from "../../../core/editor/geometry";
import type { LinearDraft } from "../../../core/editor/types";
import {
  anchorToOffset,
  buildAnchorFromOffset,
} from "../utils/openingMath";
import {
  connectionPointSupportsDuct,
  connectionPointSupportsPipe,
  getEquipmentConnectionPoints,
  getNetworkEndpointConnectionIds,
  type ConnectionPointRole,
  type EquipmentConnectionPoint,
} from "../engineering/connectionPoints";
import {
  engineeringModeUsesOverlay,
  type EngineeringSchematicStyle,
  type EngineeringVisualizationMode,
} from "../engineering/viewMode";
import { computeCanvasViewportFit } from "../canvas/canvasViewportFit";
import {
  areEngineeringPortsCompatible,
  buildEngineeringPipeRoute,
  createEngineeringEquipmentInstance,
  createEngineeringPipeConnection,
  ENGINEERING_EQUIPMENT_LABELS,
  ENGINEERING_MEDIUM_LABELS,
  ENGINEERING_MEDIUM_STYLES,
  findEngineeringPortAtPoint,
  getEngineeringEquipmentAtPoint,
  getEngineeringPort,
  getEngineeringPortWorldPosition,
  normalizeEngineeringRotation,
  rotateEngineeringDirection,
} from "../engineering2d/catalog";
import { renderEngineeringEquipmentSymbol } from "../engineering2d/render";
import {
  applyEnvelopePresetToDoor,
  applyEnvelopePresetToFloorSlab,
  applyEnvelopePresetToRoof,
  applyEnvelopePresetToWall,
  applyEnvelopePresetToWindow,
  resolveDefaultPresetId,
} from "../../../entities/envelope/envelopePresets";

export interface CanvasHandle {
  zoomToFit: () => void;
  focusSelection: (selection: Selection | null) => void;
  getSvgElement: () => SVGSVGElement | null;
}

interface Canvas2DProps {
  model: BuildingModel;
  activeLevelId: string | null;
  tool: BuildTool;
  selection: Selection;
  gridStep: number;
  snapEnabled: boolean;
  orthogonalMode: boolean;
  adjacencyOverlay: boolean;
  neighborEdges: RoomNeighborEdge[];
  centroids: Record<string, Vec2>;
  loops: RoomLoopCandidate[];
  loopDebug: boolean;
  smartSnapshot?: SmartModelSnapshot | null;
  showSmartOverlay?: boolean;
  thermalFrame?: ThermalTimelinePoint | null;
  transientFrame?: TransientVisualizationFrame | null;
  preparedThermalField?: ThermalFieldModel | null;
  showHeatmap?: boolean;
  heatmapIsPreview?: boolean;
  engineeringVisualizationMode?: EngineeringVisualizationMode;
  engineeringSchematicStyle?: EngineeringSchematicStyle;
  showEngineeringOverlay?: boolean;
  exportMode?: boolean;
  thermalBuildOptions?: Omit<ThermalFieldBuildOptions, "roomTemperaturesC">;
  multiSelection?: Selection[];
  onViewportPointerDown?: () => void;
  onToolChange: (tool: BuildTool) => void;
  onSelectionChange: (selection: Selection | null) => void;
  onMultiSelectionChange?: (items: Selection[]) => void;
  onAddRoom: (room: Room) => void;
  onUpdateRoom: (roomId: string, patch: Partial<Room>) => void;
  onSetWalls: (walls: Wall[]) => void;
  onUpdateWall: (wallId: string, patch: Partial<Wall>) => void;
  onAddRoof: (roof: Roof) => void;
  onUpdateRoof: (roofId: string, patch: Partial<Roof>) => void;
  onAddFloorSlab: (slab: FloorSlab) => void;
  onUpdateFloorSlab: (slabId: string, patch: Partial<FloorSlab>) => void;
  onAddStair: (stair: Stair) => void;
  onUpdateStair: (stairId: string, patch: Partial<Stair>) => void;
  onAddDoor: (door: Door) => void;
  onUpdateDoor: (doorId: string, patch: Partial<Door>) => void;
  onAddWindow: (window: Window) => void;
  onUpdateWindow: (windowId: string, patch: Partial<Window>) => void;
  onAddPipe: (pipe: PipeNetwork) => void;
  onUpdatePipe: (pipeId: string, patch: Partial<PipeNetwork>) => void;
  onAddDuct: (duct: DuctNetwork) => void;
  onUpdateDuct: (ductId: string, patch: Partial<DuctNetwork>) => void;
  pipeType: PipeSystemType;
  heatingDisplayMode: HeatingNetworkDisplayMode;
  showNetworkFlowArrows?: boolean;
  equipmentType: EquipmentType;
  engineeringEquipmentType: EngineeringEquipmentType;
  engineeringEquipmentVariant?: string;
  wallPreset?: string;
  windowPreset?: string;
  doorPreset?: string;
  roofPreset?: string;
  slabPreset?: string;
  onAddEquipment: (equipment: Equipment) => void;
  onAddSensor: (sensor: SensorDevice) => void;
  onUpdateEquipment: (equipmentId: string, patch: Partial<Equipment>) => void;
  onUpdateSensor: (sensorId: string, patch: Partial<SensorDevice>) => void;
  onAddEngineeringEquipment: (equipment: EngineeringEquipment) => void;
  onUpdateEngineeringEquipment: (equipmentId: string, patch: Partial<EngineeringEquipment>) => void;
  onAddEngineeringPipe: (pipe: EngineeringPipe) => void;
  onUpdateEngineeringPipe: (pipeId: string, patch: Partial<EngineeringPipe>) => void;
  onRemoveSelection: (selection: Selection | null) => void;
  layoutFitEpoch?: number;
}

type DragState =
  | { type: "room-vertex"; roomId: string; vertexIndex: number }
  | { type: "wall-end"; wallId: string; end: "a" | "b" }
  | { type: "opening"; openingKind: "door" | "window"; openingId: string }
  | { type: "move-object"; kind: "equipment" | "sensor"; id: string; origin: Vec2; start: Vec2 }
  | { type: "move-engineering-equipment"; id: string; origin: Vec2; start: Vec2 }
  | { type: "move-room"; roomId: string; origin: Vec2[]; start: Vec2 }
  | { type: "move-wall"; wallId: string; originA: Vec2; originB: Vec2; start: Vec2 }
  | { type: "move-network"; kind: "pipe" | "duct"; id: string; origin: Vec2[]; start: Vec2 }
  | { type: "select-area"; start: Vec2; end: Vec2 }
  | { type: "erase-area"; start: Vec2; end: Vec2 }
  | { type: "move-multi"; start: Vec2 }
  | null;

type NetworkHoverCard = {
  selection: Extract<NonNullable<Selection>, { kind: "pipe" | "duct" | "equipment" | "sensor" }>;
  screen: Vec2;
  title: string;
  subtitle?: string;
  details: string[];
  accent: string;
};

const MIN_SEGMENT = 0.1;
const MIN_RECT_SIZE = 1;
type RoomRectInputField = "width" | "height" | "area";

function parseLengthInput(value: string): number | null {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
const ENDPOINT_SNAP_TOLERANCE = 0.2;
const LOOP_CLOSE_TOLERANCE = 0.2;
const AXIS_SNAP_TOLERANCE = 0.18;
const GUIDE_TOLERANCE = 0.18;
const OPENING_HANDLE_THRESHOLD = 0.35;
const OPENING_SNAP_DISTANCE = 0.6;
const OPENING_CLEARANCE = 0.1;
const NETWORK_DUPLICATE_TOLERANCE = 0.05;
const NETWORK_OBJECT_CLEARANCE = 0.45;
const NETWORK_ROUTE_OFFSET_PX = 6;
const ROOM_AREA_LABEL_THRESHOLD = 4;
type LabelBox = { x: number; y: number; width: number; height: number };
type EngineeringNetworkDiagnostic = {
  id: string;
  targetKind: "pipe" | "equipment";
  targetId: string;
  severity: "warning" | "error";
  message: string;
  position: Vec2;
};

function inferEngineeringPortDirection(from: Vec2, to: Vec2): EngineeringPortDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

function boxesIntersect(a: LabelBox, b: LabelBox) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}


function toAreaBounds(start: Vec2, end: Vec2) {
  return {
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y),
  };
}

function boundsContainsPoint(bounds: ReturnType<typeof toAreaBounds>, point: Vec2) {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function segmentIntersectsBounds(bounds: ReturnType<typeof toAreaBounds>, a: Vec2, b: Vec2) {
  if (boundsContainsPoint(bounds, a) || boundsContainsPoint(bounds, b)) {
    return true;
  }
  const topLeft = { x: bounds.minX, y: bounds.minY };
  const topRight = { x: bounds.maxX, y: bounds.minY };
  const bottomRight = { x: bounds.maxX, y: bounds.maxY };
  const bottomLeft = { x: bounds.minX, y: bounds.maxY };
  return (
    segmentsIntersect(a, b, topLeft, topRight) ||
    segmentsIntersect(a, b, topRight, bottomRight) ||
    segmentsIntersect(a, b, bottomRight, bottomLeft) ||
    segmentsIntersect(a, b, bottomLeft, topLeft)
  );
}

function polygonIntersectsBounds(bounds: ReturnType<typeof toAreaBounds>, polygon: Vec2[]) {
  if (polygon.some((point) => boundsContainsPoint(bounds, point))) {
    return true;
  }
  const corners: Vec2[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  if (corners.some((corner) => polygonContainsPoint(corner, polygon))) {
    return true;
  }
  for (let i = 0; i < polygon.length; i += 1) {
    const next = (i + 1) % polygon.length;
    if (segmentIntersectsBounds(bounds, polygon[i], polygon[next])) {
      return true;
    }
  }
  return false;
}

function polylineIntersectsBounds(bounds: ReturnType<typeof toAreaBounds>, points: Vec2[]) {
  if (points.some((point) => boundsContainsPoint(bounds, point))) {
    return true;
  }
  for (let index = 1; index < points.length; index += 1) {
    if (segmentIntersectsBounds(bounds, points[index - 1], points[index])) {
      return true;
    }
  }
  return false;
}

function expandLabelBox(box: LabelBox, padding: number): LabelBox {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };
}

function estimateTextWidth(text: string, fontSize: number) {
  return Math.max(40, text.length * (fontSize <= 10 ? 5.9 : 6.4));
}

function buildLabelBox(center: Vec2, lineWidths: number[], lineCount: number, compact: boolean): LabelBox {
  const width = Math.min(156, Math.max(...lineWidths) + (compact ? 18 : 10));
  const height = lineCount > 1 ? 32 : compact ? 20 : 18;
  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
}

function buildRoomStateObstacle(room: Room, worldToScreen: (point: Vec2) => Vec2): LabelBox {
  const center = worldToScreen(polygonCentroid(room.polygon));
  const compact = Math.abs(polygonArea(room.polygon)) < 8;
  const width = compact ? 66 : 78;
  const height = compact ? 26 : 40;
  const y = compact ? center.y - 16 : center.y - 14;
  return {
    x: center.x - width / 2,
    y,
    width,
    height,
  };
}

function buildEquipmentObstacle(
  item: Equipment,
  worldToScreen: (point: Vec2) => Vec2,
  showCallout: boolean
): LabelBox[] {
  const point = worldToScreen(item.position);
  const boxes: LabelBox[] = [{ x: point.x - 18, y: point.y - 18, width: 36, height: 36 }];
  if (showCallout) {
    const name = getEquipmentDisplayName(item.id, [item]);
    const width = Math.min(168, Math.max(92, name.length * 6.2 + 36));
    boxes.push({
      x: point.x + 18,
      y: point.y - 22,
      width,
      height: 34,
    });
  }
  return boxes;
}

function buildSensorObstacle(sensor: SensorDevice, worldToScreen: (point: Vec2) => Vec2): LabelBox {
  const point = worldToScreen(sensor.position);
  return { x: point.x - 13, y: point.y - 13, width: 26, height: 26 };
}

function formatEngineeringPower(value: number | null | undefined): string | null {
  if (!Number.isFinite(value) || !value) {
    return null;
  }
  return value >= 1000 ? `${(value / 1000).toFixed(1)} кВт` : `${value.toFixed(0)} Вт`;
}

function buildEngineeringNetworkDiagnostics(
  pipes: PipeNetwork[],
  ducts: DuctNetwork[],
  equipment: Equipment[]
): EngineeringNetworkDiagnostic[] {
  const diagnostics: EngineeringNetworkDiagnostic[] = [];

  pipes.forEach((pipe) => {
    if (!pipe.connectedEquipmentIds.length) {
      const point = pipe.path[Math.floor(pipe.path.length / 2)] ?? pipe.path[0];
      if (point) {
        diagnostics.push({
          id: `pipe:${pipe.id}:connection`,
          targetKind: "pipe",
          targetId: pipe.id,
          severity: "warning",
          message: "Трубопровод не привязан к оборудованию.",
          position: point,
        });
      }
    }
    if (!Number.isFinite(pipe.diameter_mm) || pipe.diameter_mm <= 0) {
      const point = pipe.path[Math.floor(pipe.path.length / 2)] ?? pipe.path[0];
      if (point) {
        diagnostics.push({
          id: `pipe:${pipe.id}:diameter`,
          targetKind: "pipe",
          targetId: pipe.id,
          severity: "error",
          message: "Не задан диаметр трубы.",
          position: point,
        });
      }
    }
  });

  ducts.forEach((duct) => {
    if (!duct.connectedEquipmentIds.length) {
      const point = duct.path[Math.floor(duct.path.length / 2)] ?? duct.path[0];
      if (point) {
        diagnostics.push({
          id: `duct:${duct.id}:connection`,
          targetKind: "pipe",
          targetId: duct.id,
          severity: "warning",
          message: "Воздуховод не привязан к оборудованию.",
          position: point,
        });
      }
    }
  });

  equipment.forEach((item) => {
    if (!item.roomId) {
      diagnostics.push({
        id: `equipment:${item.id}:room`,
        targetKind: "equipment",
        targetId: item.id,
        severity: "warning",
        message: "Оборудование не привязано к помещению.",
        position: item.position,
      });
    }
    if ((item.type === "radiator" || item.type === "boiler" || item.type === "heat_exchanger") && !item.connectedNetworkIds.length) {
      diagnostics.push({
        id: `equipment:${item.id}:network`,
        targetKind: "equipment",
        targetId: item.id,
        severity: "warning",
        message: "Оборудование не связано с расчётной сетью.",
        position: item.position,
      });
    }
    if ((item.type === "radiator" || item.type === "boiler" || item.type === "heat_exchanger") && !Number.isFinite(item.params.nominalPowerW ?? NaN)) {
      diagnostics.push({
        id: `equipment:${item.id}:power`,
        targetKind: "equipment",
        targetId: item.id,
        severity: "error",
        message: "Не задана расчётная мощность.",
        position: item.position,
      });
    }
  });

  return diagnostics;
}

function resolvePlanLabelLayout(
  room: Room,
  obstacles: LabelBox[],
  scale: number,
  worldToScreen: (point: Vec2) => Vec2,
  screenToWorld: (point: Vec2) => Vec2,
  compactLabels = false,
  exportMode = false
): {
  labelLines: string[];
  position: { screenCenter: Vec2; box: LabelBox } | null;
  showArea: boolean;
  compact: boolean;
  hiddenReason: string | null;
  fontSize: number;
  title: string;
} {
  const area = Math.abs(polygonArea(room.polygon));
  const bounds = room.polygon.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxX: Math.max(acc.maxX, point.x),
      maxY: Math.max(acc.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
  const roomWidth = (bounds.maxX - bounds.minX) * scale;
  const roomHeight = (bounds.maxY - bounds.minY) * scale;
  const center = polygonCentroid(room.polygon);
  const title = compactRoomLabel(room);
  const roomScreenPoints = room.polygon.map((point) => worldToScreen(point));
  const roomScreenBounds = roomScreenPoints.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxX: Math.max(acc.maxX, point.x),
      maxY: Math.max(acc.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
  const normalizedRoomScreenBounds: LabelBox = {
    x: roomScreenBounds.minX,
    y: roomScreenBounds.minY,
    width: roomScreenBounds.maxX - roomScreenBounds.minX,
    height: roomScreenBounds.maxY - roomScreenBounds.minY,
  };
  const obstacleInRoom = obstacles.some((obstacle) => boxesIntersect(expandLabelBox(obstacle, 4), normalizedRoomScreenBounds));
  const compactMode = exportMode || compactLabels || obstacleInRoom || area < 12 || roomWidth < 110 || roomHeight < 54;
  const fontSize = area < 8 || roomWidth < 96 || roomHeight < 44 ? 10 : 12;
  const shortLabel = area < 8 || obstacleInRoom || roomWidth < 100 || roomHeight < 48 ? compactRoomLabel(room, 0, 12) : title;
  const primaryLabel = compactMode ? shortLabel : title;
  const wrapLabel = primaryLabel.length > 14 && primaryLabel.includes(" ") && area >= 10 && roomWidth >= 120 && roomHeight >= 58 && !exportMode;
  const labelLines = wrapLabel
    ? (() => {
        const parts = primaryLabel.split(" ");
        const middle = Math.ceil(parts.length / 2);
        return [parts.slice(0, middle).join(" "), parts.slice(middle).join(" ")].filter(Boolean);
      })()
    : [primaryLabel];
  const showArea = !obstacleInRoom && !compactMode && area >= ROOM_AREA_LABEL_THRESHOLD && area >= 8 && roomWidth >= 116 && roomHeight >= 54;
  const xOffset = (bounds.maxX - bounds.minX) * 0.18;
  const yOffset = (bounds.maxY - bounds.minY) * 0.14;
  const candidates: Vec2[] = [
    { x: center.x, y: center.y - yOffset },
    { x: center.x, y: center.y + yOffset },
    { x: center.x - xOffset, y: center.y },
    { x: center.x + xOffset, y: center.y },
    center,
    { x: (bounds.minX + bounds.maxX) * 0.5, y: (bounds.minY + bounds.maxY) * 0.5 },
    { x: center.x - xOffset, y: center.y - yOffset },
    { x: center.x + xOffset, y: center.y - yOffset },
    { x: center.x - xOffset, y: center.y + yOffset },
    { x: center.x + xOffset, y: center.y + yOffset },
  ];

  const evaluatePlacements = (lineTexts: string[], areaVisible: boolean, compact: boolean, size: number) =>
    candidates
      .map((candidate) => {
      if (!polygonContainsPoint(candidate, room.polygon)) {
        return null;
      }
      const screenCenter = worldToScreen(candidate);
      const box = buildLabelBox(
        screenCenter,
        lineTexts.map((line) => estimateTextWidth(line, size)),
        lineTexts.length + (areaVisible ? 1 : 0),
        compact
      );
      const corners = [
        screenToWorld({ x: box.x + 4, y: box.y + 4 }),
        screenToWorld({ x: box.x + box.width - 4, y: box.y + 4 }),
        screenToWorld({ x: box.x + box.width - 4, y: box.y + box.height - 4 }),
        screenToWorld({ x: box.x + 4, y: box.y + box.height - 4 }),
      ];
      if (!corners.every((corner) => polygonContainsPoint(corner, room.polygon))) {
        return null;
      }
      if (obstacles.some((obstacle) => boxesIntersect(expandLabelBox(box, 4), expandLabelBox(obstacle, 2)))) {
        return null;
      }
      const nearestObstacleDistance = obstacles.reduce((minDistance, obstacle) => {
        const obstacleCenter = { x: obstacle.x + obstacle.width / 2, y: obstacle.y + obstacle.height / 2 };
        return Math.min(minDistance, Math.hypot(obstacleCenter.x - screenCenter.x, obstacleCenter.y - screenCenter.y));
      }, 9999);
      return {
        screenCenter,
        box,
        score: Math.hypot(candidate.x - center.x, candidate.y - center.y) - nearestObstacleDistance * 0.0025,
      };
      })
      .filter((placement): placement is { screenCenter: Vec2; box: LabelBox; score: number } => Boolean(placement))
      .sort((left, right) => left.score - right.score);

  if (area < 8 && obstacleInRoom) {
    return {
      labelLines: [shortLabel.slice(0, 12)],
      position: null,
      showArea: false,
      compact: true,
      hiddenReason: "small-room-obstacle",
      fontSize,
      title,
    };
  }

  const primaryPlacements = evaluatePlacements(labelLines, showArea, compactMode, fontSize);
  const compactFallbackLines = [shortLabel.length > 12 ? `${shortLabel.slice(0, 11).trimEnd()}…` : shortLabel];
  const fallbackPlacements =
    primaryPlacements[0] || compactFallbackLines[0] === labelLines[0]
      ? primaryPlacements
      : evaluatePlacements(compactFallbackLines, false, true, 10);
  const bestPlacement = fallbackPlacements[0] ?? null;

  if (bestPlacement) {
    return {
      labelLines: bestPlacement === primaryPlacements[0] ? labelLines : compactFallbackLines,
      position: { screenCenter: bestPlacement.screenCenter, box: bestPlacement.box },
      showArea: bestPlacement === primaryPlacements[0] ? showArea : false,
      compact: bestPlacement === primaryPlacements[0] ? compactMode : true,
      hiddenReason: null,
      fontSize: bestPlacement === primaryPlacements[0] ? fontSize : 10,
      title,
    };
  }

  return {
    labelLines,
    position: null,
    showArea: false,
    compact: true,
    hiddenReason: area < 5 || roomWidth < 84 || roomHeight < 34 ? "small-room-conflict" : "obstacle-conflict",
    fontSize,
    title,
  };
}

const Canvas2D = React.forwardRef<CanvasHandle, Canvas2DProps>(
  (
    {
      model,
      activeLevelId,
      tool,
      selection,
      gridStep,
      snapEnabled,
      orthogonalMode,
      adjacencyOverlay,
      neighborEdges,
      centroids,
      loops,
      loopDebug,
      smartSnapshot,
      showSmartOverlay = false,
      thermalFrame = null,
      transientFrame = null,
      preparedThermalField = null,
      showHeatmap = false,
      heatmapIsPreview = false,
      engineeringVisualizationMode = "plan",
      engineeringSchematicStyle = "gost",
      showEngineeringOverlay = false,
      exportMode = false,
      thermalBuildOptions,
      multiSelection = [],
      onViewportPointerDown,
      onToolChange,
      onSelectionChange,
      onMultiSelectionChange,
      onAddRoom,
      onUpdateRoom,
      onSetWalls,
      onUpdateWall,
      onAddRoof,
      onAddFloorSlab,
      onAddStair,
      onAddDoor,
      onUpdateDoor,
      onAddWindow,
      onUpdateWindow,
      onAddPipe,
      onUpdatePipe,
      onAddDuct,
      onUpdateDuct,
      pipeType,
      heatingDisplayMode,
      showNetworkFlowArrows = true,
      equipmentType,
      engineeringEquipmentType,
      engineeringEquipmentVariant,
      wallPreset = resolveDefaultPresetId("wall"),
      windowPreset = resolveDefaultPresetId("window"),
      doorPreset = resolveDefaultPresetId("door"),
      roofPreset = resolveDefaultPresetId("roof"),
      slabPreset = resolveDefaultPresetId("slab"),
      onAddEquipment,
      onAddSensor,
      onUpdateEquipment,
      onUpdateSensor,
      onAddEngineeringEquipment,
      onUpdateEngineeringEquipment,
      onAddEngineeringPipe,
      onRemoveSelection,
      layoutFitEpoch = 0,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const lastObservedSizeRef = useRef({ width: 0, height: 0 });
    const layoutFitEpochRef = useRef(layoutFitEpoch);
    const lastAppliedLayoutFitEpochRef = useRef(0);
    const userAdjustedViewRef = useRef(false);
    const zoomToFitContentRef = useRef<(force?: boolean) => void>(() => {});
    const [size, setSize] = useState({ width: 900, height: 600 });
    const [view, setView] = useState({ origin: { x: -10, y: -10 }, zoom: 60 });
    const viewRef = useRef(view);
    useLayoutEffect(() => {
      viewRef.current = view;
    }, [view]);
    const [spacePressed, setSpacePressed] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef<{ x: number; y: number; origin: Vec2 }>({ x: 0, y: 0, origin: { x: 0, y: 0 } });
    const rectDirectionRef = useRef<{ x: number; y: number }>({ x: 1, y: 1 });

    const [draftRoom, setDraftRoom] = useState<Vec2[]>([]);
    const [linearDraft, setLinearDraft] = useState<LinearDraft | null>(null);
    const finalizeLinearDraftRef = useRef<(draft: LinearDraft | null) => void>(() => {});
    const [dragState, setDragState] = useState<DragState>(null);
    const [multiMoveDelta, setMultiMoveDelta] = useState<{ x: number; y: number } | null>(null);
    // Marquee-select/erase иногда работает нестабильно в Electron при частичном дублировании pointer/mouse событий.
    // Этот флаг гарантирует, что active marquee-сессия завершается и визуализируется только по одной системе.
    const usedPointerEventsRef = useRef(false);


    const [roomDraft, setRoomDraft] = useState<{ roomId: string; polygon: Vec2[] } | null>(null);
    const [wallDraft, setWallDraft] = useState<{ wallId: string; a: Vec2; b: Vec2 } | null>(null);
    const [networkDraft, setNetworkDraft] = useState<{ kind: "pipe" | "duct"; id: string; path: Vec2[] } | null>(null);
    const [objectDraft, setObjectDraft] = useState<{ kind: "equipment" | "sensor"; id: string; position: Vec2 } | null>(null);
    const [openingDraft, setOpeningDraft] = useState<{
      id: string;
      kind: "door" | "window";
      wallId: string;
      width: number;
      offset: number;
    } | null>(null);
    const [engineeringPipeDraft, setEngineeringPipeDraft] = useState<{
      fromEquipmentId: string;
      fromPortId: string;
    } | null>(null);
    const [engineeringEquipmentDraft, setEngineeringEquipmentDraft] = useState<{ id: string; x: number; y: number } | null>(null);
    const [hoveredEngineeringEquipmentId, setHoveredEngineeringEquipmentId] = useState<string | null>(null);
    const [pointerWorld, setPointerWorld] = useState<Vec2 | null>(null);
    const [rectStart, setRectStart] = useState<Vec2 | null>(null);
    const [rectPreview, setRectPreview] = useState<Vec2 | null>(null);
    const [rectInput, setRectInput] = useState<{ width: string; height: string; area: string }>({
      width: "",
      height: "",
      area: "",
    });
    const [rectInputLocked, setRectInputLocked] = useState(false);
    const [rectActiveField, setRectActiveField] = useState<RoomRectInputField>("width");
    const rectActiveFieldRef = useRef<RoomRectInputField>("width");
    const finalizeRectangleShapeRef = useRef<
      (start: Vec2, end: Vec2, kind: "roomRect" | "roof" | "slab" | "stair") => void
    >(() => {});
    const [wallLengthInput, setWallLengthInput] = useState("");

    const clearRectDraft = useCallback(() => {
      setRectStart(null);
      setRectPreview(null);
      setRectInput({ width: "", height: "", area: "" });
      setRectInputLocked(false);
      setRectActiveField("width");
      setPointerWorld(null);
    }, []);

    const buildRectEndFromInputs = useCallback(
      (start: Vec2, width: number, height: number): Vec2 => ({
        x: start.x + rectDirectionRef.current.x * width,
        y: start.y + rectDirectionRef.current.y * height,
      }),
      []
    );
    const areaDragInputRef = useRef<"pointer" | "mouse" | null>(null);
    const [guides, setGuides] = useState<{ vertical: number | null; horizontal: number | null }>({
      vertical: null,
      horizontal: null,
    });
    const [hoverLoopId, setHoverLoopId] = useState<string | null>(null);
    const [networkHoverCard, setNetworkHoverCard] = useState<NetworkHoverCard | null>(null);
    const engineeringOverlayActive = showEngineeringOverlay || engineeringModeUsesOverlay(engineeringVisualizationMode);
    const monochromeSchematic = engineeringSchematicStyle === "monochrome";
    const orderedLevels = useMemo(
      () =>
        [...model.levels].sort(
          (left, right) => left.elevation_m - right.elevation_m || left.height_m - right.height_m || left.id.localeCompare(right.id)
        ),
      [model.levels]
    );
    const activeLevelIndex = useMemo(
      () => orderedLevels.findIndex((level) => level.id === activeLevelId),
      [activeLevelId, orderedLevels]
    );
    const previousLevel = activeLevelIndex > 0 ? orderedLevels[activeLevelIndex - 1] ?? null : null;
    const nextLevel =
      activeLevelIndex >= 0 && activeLevelIndex < orderedLevels.length - 1 ? orderedLevels[activeLevelIndex + 1] ?? null : null;
    const contextLevels = useMemo(
      () =>
        [
          previousLevel ? { level: previousLevel, relation: "below" as const } : null,
          nextLevel ? { level: nextLevel, relation: "above" as const } : null,
        ].filter((entry): entry is { level: BuildingModel["levels"][number]; relation: "below" | "above" } => Boolean(entry)),
      [nextLevel, previousLevel]
    );
    const openingHeightLimitByLevel = useMemo(() => {
      const sorted = [...model.levels].sort((left, right) => left.elevation_m - right.elevation_m || left.id.localeCompare(right.id));
      const result = new Map<string, number>();
      sorted.forEach((level, index) => {
        const next = sorted[index + 1];
        const ceilingElevation = next ? next.elevation_m : level.elevation_m + level.height_m;
        result.set(level.id, Math.max(0.2, ceilingElevation - level.elevation_m));
      });
      return result;
    }, [model.levels]);
    const pipeDefaults = useMemo(() => createPipeDefaults(pipeType), [pipeType]);
    const heatingSnapshot = useMemo(() => buildHeatingModelSnapshot(model), [model]);

    const isSelected = (kind: NonNullable<Selection>["kind"], id: string): boolean =>
      (selection?.kind === kind && selection.id === id) ||
      multiSelection.some((s) => s.kind === kind && s.id === id);

    const rooms = useMemo(() => {
      const filtered = model.rooms.filter((room) => room.levelId === activeLevelId);
      let result = roomDraft
        ? filtered.map((room) => (room.id === roomDraft.roomId ? { ...room, polygon: roomDraft.polygon } : room))
        : filtered;
      if (multiMoveDelta) {
        result = result.map((room) =>
          multiSelection.some((s) => s.kind === "room" && s.id === room.id)
            ? { ...room, polygon: room.polygon.map((p) => ({ x: p.x + multiMoveDelta.x, y: p.y + multiMoveDelta.y })) }
            : room
        );
      }
      return result;
    }, [model.rooms, activeLevelId, roomDraft, multiMoveDelta, multiSelection]);

    const walls = useMemo(() => {
      const filtered = model.walls.filter((wall) => wall.levelId === activeLevelId);
      let result = wallDraft
        ? filtered.map((wall) => (wall.id === wallDraft.wallId ? { ...wall, a: wallDraft.a, b: wallDraft.b } : wall))
        : filtered;
      if (multiMoveDelta) {
        result = result.map((wall) =>
          multiSelection.some((s) => s.kind === "wall" && s.id === wall.id)
            ? { ...wall, a: { x: wall.a.x + multiMoveDelta.x, y: wall.a.y + multiMoveDelta.y }, b: { x: wall.b.x + multiMoveDelta.x, y: wall.b.y + multiMoveDelta.y } }
            : wall
        );
      }
      return result;
    }, [model.walls, activeLevelId, wallDraft, multiMoveDelta, multiSelection]);
    const roofs = useMemo(() => (model.roofs ?? []).filter((roof) => roof.levelId === activeLevelId), [activeLevelId, model.roofs]);
    const floorSlabs = useMemo(
      () => (model.floorSlabs ?? []).filter((slab) => slab.levelId === activeLevelId),
      [activeLevelId, model.floorSlabs]
    );
    const stairs = useMemo(
      () => (model.stairs ?? []).filter((stair) => stair.levelId === activeLevelId),
      [activeLevelId, model.stairs]
    );
    const contextRooms = useMemo(
      () =>
        contextLevels.flatMap(({ level, relation }) =>
          model.rooms
            .filter((room) => room.levelId === level.id)
            .map((room) => ({ room, relation }))
        ),
      [contextLevels, model.rooms]
    );
    const contextWalls = useMemo(
      () =>
        contextLevels.flatMap(({ level, relation }) =>
          model.walls
            .filter((wall) => wall.levelId === level.id)
            .map((wall) => ({ wall, relation }))
        ),
      [contextLevels, model.walls]
    );
    const belowLevelWalls = useMemo(
      () => contextWalls.filter((entry) => entry.relation === "below").map((entry) => entry.wall),
      [contextWalls]
    );
    const belowLevelRooms = useMemo(
      () => contextRooms.filter((entry) => entry.relation === "below").map((entry) => entry.room),
      [contextRooms]
    );

    const doors = useMemo(
      () =>
        model.doors.filter(
          (door) => door.anchor.wallId && walls.some((wall) => wall.id === door.anchor.wallId)
        ),
      [model.doors, walls]
    );
    const windows = useMemo(
      () =>
        model.windows.filter(
          (window) => window.anchor.wallId && walls.some((wall) => wall.id === window.anchor.wallId)
        ),
      [model.windows, walls]
    );
    const pipes = useMemo(() => {
      const filtered = model.pipes.filter((pipe) => pipe.levelId === activeLevelId);
      let result = networkDraft?.kind === "pipe"
        ? filtered.map((pipe) => (pipe.id === networkDraft.id ? { ...pipe, path: networkDraft.path } : pipe))
        : filtered;
      if (multiMoveDelta) {
        result = result.map((pipe) =>
          multiSelection.some((s) => s.kind === "pipe" && s.id === pipe.id)
            ? { ...pipe, path: (pipe.path ?? []).map((p) => ({ x: p.x + multiMoveDelta.x, y: p.y + multiMoveDelta.y })) }
            : pipe
        );
      }
      return result;
    }, [activeLevelId, model.pipes, networkDraft, multiMoveDelta, multiSelection]);
    const ducts = useMemo(() => {
      const filtered = model.ducts.filter((duct) => duct.levelId === activeLevelId);
      let result = networkDraft?.kind === "duct"
        ? filtered.map((duct) => (duct.id === networkDraft.id ? { ...duct, path: networkDraft.path } : duct))
        : filtered;
      if (multiMoveDelta) {
        result = result.map((duct) =>
          multiSelection.some((s) => s.kind === "duct" && s.id === duct.id)
            ? { ...duct, path: (duct.path ?? []).map((p) => ({ x: p.x + multiMoveDelta.x, y: p.y + multiMoveDelta.y })) }
            : duct
        );
      }
      return result;
    }, [activeLevelId, model.ducts, networkDraft, multiMoveDelta, multiSelection]);
    const equipment = useMemo(() => {
      const filtered = model.equipment.filter((item) => item.levelId === activeLevelId);
      let result = objectDraft?.kind === "equipment"
        ? filtered.map((item) => (item.id === objectDraft.id ? { ...item, position: objectDraft.position } : item))
        : filtered;
      if (multiMoveDelta) {
        result = result.map((item) =>
          multiSelection.some((s) => s.kind === "equipment" && s.id === item.id)
            ? { ...item, position: { x: item.position.x + multiMoveDelta.x, y: item.position.y + multiMoveDelta.y } }
            : item
        );
      }
      return result;
    }, [activeLevelId, model.equipment, objectDraft, multiMoveDelta, multiSelection]);
    const equipmentConnectionPoints = useMemo(
      () =>
        equipment.flatMap((item) =>
          getEquipmentConnectionPoints(item).map((point) => ({
            equipmentId: item.id,
            equipmentType: item.type,
            point,
          }))
        ),
      [equipment]
    );
    const pipeEquipmentLinks = useMemo(
      () =>
        pipes.flatMap((pipe) =>
          pipe.connectedEquipmentIds
            .map((equipmentId) => {
              const item = equipment.find((entry) => entry.id === equipmentId && entry.levelId === pipe.levelId);
              if (!item) {
                return null;
              }
              const ports = getEquipmentConnectionPoints(item).filter(connectionPointSupportsPipe);
              const anchor =
                ports
                  .map((port) => {
                    const pointOnPipe = closestPointOnPolyline(port.position, pipe.path);
                    if (!pointOnPipe) {
                      return null;
                    }
                    return {
                      from: port.position,
                      to: pointOnPipe,
                      distance: Math.hypot(pointOnPipe.x - port.position.x, pointOnPipe.y - port.position.y),
                    };
                  })
                  .filter((entry): entry is { from: Vec2; to: Vec2; distance: number } => Boolean(entry))
                  .sort((left, right) => left.distance - right.distance)[0] ?? null;
              if (!anchor) {
                return null;
              }
              return {
                id: `${pipe.id}:${item.id}`,
                from: anchor.from,
                to: anchor.to,
                color: resolvePipeColor(pipe),
              };
            })
            .filter((entry): entry is { id: string; from: Vec2; to: Vec2; color: string } => Boolean(entry))
        ),
      [equipment, pipes]
    );
    const pipeDisplayState = useMemo(() => {
      const branchByPipeId = new Map(
        heatingSnapshot.systems.flatMap((system) => system.branches.map((branch) => [branch.pipeId, branch] as const))
      );
      const allTemperatures = pipes.map((pipe) => pipe.fluidTemperatureC);
      const minTemperature = allTemperatures.length ? Math.min(...allTemperatures) : 20;
      const maxTemperature = allTemperatures.length ? Math.max(...allTemperatures) : 70;
      const maxFlow = Math.max(0.01, ...pipes.map((pipe) => pipe.flowRate_kg_s));
      const maxDiameter = Math.max(1, ...pipes.map((pipe) => pipe.diameter_mm));
      const maxLoad = Math.max(1, ...heatingSnapshot.systems.flatMap((system) => system.branches.map((branch) => branch.downstreamLoadW ?? branch.localLoadW ?? 0)));
      const maxRooms = Math.max(1, ...heatingSnapshot.systems.flatMap((system) => system.branches.map((branch) => branch.servedRoomIds?.length ?? 0)));

      return new Map(
        pipes.map((pipe) => {
          const branch = branchByPipeId.get(pipe.id);
          const flowRatio = Math.max(0, pipe.flowRate_kg_s) / maxFlow;
          const diameterRatio = pipe.diameter_mm / maxDiameter;
          const loadValue = branch?.downstreamLoadW ?? branch?.localLoadW ?? 0;
          const loadRatio = loadValue / maxLoad;
          const roomsCount = branch?.servedRoomIds?.length ?? 0;
          const roomRatio = roomsCount / maxRooms;

          switch (heatingDisplayMode) {
            case "diameter":
              return [
                pipe.id,
                {
                  color: diameterToColor(diameterRatio),
                  strokeWidth: 2.5 + diameterRatio * 4,
                  label: `${pipe.diameter_mm.toFixed(0)} мм`,
                },
              ] as const;
            case "flow":
              return [
                pipe.id,
                {
                  color: intensityToColor(flowRatio, "#dbeafe", "#1d4ed8"),
                  strokeWidth: 2.5 + flowRatio * 3.5,
                  label: `${pipe.flowRate_kg_s.toFixed(2)} кг/с`,
                },
              ] as const;
            case "temperature":
              return [
                pipe.id,
                {
                  color: temperatureToColor(pipe.fluidTemperatureC, minTemperature, maxTemperature),
                  strokeWidth: 3.4,
                  label: `${pipe.fluidTemperatureC.toFixed(1)} °C`,
                },
              ] as const;
            case "load":
              return [
                pipe.id,
                {
                  color: intensityToColor(loadRatio, "#fde68a", "#b45309"),
                  strokeWidth: 2.8 + loadRatio * 4,
                  label: `${Math.round(loadValue)} Вт`,
                },
              ] as const;
            case "rooms":
              return [
                pipe.id,
                {
                  color: intensityToColor(roomRatio, "#dcfce7", "#15803d"),
                  strokeWidth: 2.8 + roomRatio * 3,
                  label: roomsCount ? `${roomsCount} пом.` : "без зон",
                },
              ] as const;
            case "lineRole":
            default:
              {
                const baseStyle = getPipeVisualStyle(pipe, { showFlowArrows: showNetworkFlowArrows });
              return [
                pipe.id,
                {
                  color: baseStyle.stroke,
                  strokeWidth: baseStyle.strokeWidth,
                  dashArray: baseStyle.dashArray,
                  info: baseStyle.info,
                  label: PIPE_TYPE_LABELS[pipe.type],
                },
              ] as const;
              }
          }
        })
      );
    }, [heatingDisplayMode, heatingSnapshot.systems, pipes, showNetworkFlowArrows]);
    const sensors = useMemo(() => {
      const filtered = model.sensors.filter((item) => item.levelId === activeLevelId);
      let result = objectDraft?.kind === "sensor"
        ? filtered.map((item) => (item.id === objectDraft.id ? { ...item, position: objectDraft.position } : item))
        : filtered;
      if (multiMoveDelta) {
        result = result.map((item) =>
          multiSelection.some((s) => s.kind === "sensor" && s.id === item.id)
            ? { ...item, position: { x: item.position.x + multiMoveDelta.x, y: item.position.y + multiMoveDelta.y } }
            : item
        );
      }
      return result;
    }, [activeLevelId, model.sensors, objectDraft, multiMoveDelta, multiSelection]);
    const engineeringEquipment = useMemo(() => {
      const filtered = (model.engineeringSystems?.equipment ?? []).filter((item) => (item.levelId ?? activeLevelId) === activeLevelId);
      let result = engineeringEquipmentDraft
        ? filtered.map((item) => (item.id === engineeringEquipmentDraft.id ? { ...item, x: engineeringEquipmentDraft.x, y: engineeringEquipmentDraft.y } : item))
        : filtered;
      if (multiMoveDelta) {
        result = result.map((item) =>
          multiSelection.some((s) => s.kind === "engineeringEquipment" && s.id === item.id)
            ? { ...item, x: item.x + multiMoveDelta.x, y: item.y + multiMoveDelta.y }
            : item
        );
      }
      return result;
    }, [activeLevelId, engineeringEquipmentDraft, model.engineeringSystems?.equipment, multiMoveDelta, multiSelection]);
    const engineeringPipes = useMemo(() => {
      const filtered = (model.engineeringSystems?.pipes ?? []).filter((pipe) => (pipe.levelId ?? activeLevelId) === activeLevelId);
      if (!multiMoveDelta) return filtered;
      return filtered.map((pipe) =>
        multiSelection.some((s) => s.kind === "engineeringPipe" && s.id === pipe.id)
          ? { ...pipe, points: pipe.points.map((p) => ({ x: p.x + multiMoveDelta.x, y: p.y + multiMoveDelta.y })) }
          : pipe
      );
    }, [activeLevelId, model.engineeringSystems?.pipes, multiMoveDelta, multiSelection]);
    const hoveredEngineeringPort = useMemo(() => {
      if (!pointerWorld) {
        return null;
      }
      return findEngineeringPortAtPoint(pointerWorld, engineeringEquipment, 0.26);
    }, [engineeringEquipment, pointerWorld]);
    const engineeringPipePreview = useMemo(() => {
      if (!engineeringPipeDraft) {
        return null;
      }
      const fromEquipment = engineeringEquipment.find((item) => item.id === engineeringPipeDraft.fromEquipmentId);
      const fromPort = fromEquipment ? getEngineeringPort(fromEquipment, engineeringPipeDraft.fromPortId) : null;
      if (!fromEquipment || !fromPort) {
        return null;
      }
      const start = getEngineeringPortWorldPosition(fromEquipment, fromPort);
      const startDirection = rotateEngineeringDirection(fromPort.direction, fromEquipment.rotation);
      const targetPort =
        hoveredEngineeringPort &&
        !(hoveredEngineeringPort.equipment.id === fromEquipment.id && hoveredEngineeringPort.port.id === fromPort.id)
          ? hoveredEngineeringPort
          : null;
      const end = targetPort?.position ?? pointerWorld ?? start;
      const endDirection = targetPort
        ? rotateEngineeringDirection(targetPort.port.direction, targetPort.equipment.rotation)
        : inferEngineeringPortDirection(start, end);
      return {
        fromEquipment,
        fromPort,
        targetPort,
        compatible: !targetPort || areEngineeringPortsCompatible(fromPort, targetPort.port),
        points: buildEngineeringPipeRoute(start, startDirection, end, endDirection),
      };
    }, [engineeringEquipment, engineeringPipeDraft, hoveredEngineeringPort, pointerWorld]);
    const engineeringDiagnostics = useMemo(
      () => buildEngineeringNetworkDiagnostics(pipes, ducts, equipment),
      [ducts, equipment, pipes]
    );
    const engineeringDiagnosticsByTarget = useMemo(() => {
      const grouped = new Map<string, EngineeringNetworkDiagnostic[]>();
      engineeringDiagnostics.forEach((issue) => {
        const key = `${issue.targetKind}:${issue.targetId}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.push(issue);
          return;
        }
        grouped.set(key, [issue]);
      });
      return grouped;
    }, [engineeringDiagnostics]);
    const thermalField = useMemo(() => {
      if (!showHeatmap || !thermalFrame) {
        return null;
      }
      if (preparedThermalField) {
        return preparedThermalField;
      }
      const roomTemperaturesC = Object.fromEntries(
        Object.entries(thermalFrame.rooms).map(([roomId, payload]) => [roomId, payload.temperatureC])
      );
      return createThermalFieldModel(model, {
        ...thermalBuildOptions,
        outdoorTemperatureC: thermalBuildOptions?.outdoorTemperatureC ?? thermalFrame.outdoorTemperatureC,
        roomTemperaturesC,
      });
    }, [model, showHeatmap, thermalBuildOptions, preparedThermalField, thermalFrame]);
    const thermalLegend = useMemo(() => {
      if (!showHeatmap || !thermalField) {
        return null;
      }
      return buildTemperatureLegendRange(thermalField.minTemperatureC, thermalField.maxTemperatureC, heatmapIsPreview);
    }, [heatmapIsPreview, showHeatmap, thermalField]);
    const smartRoomStates = useMemo(
      () => (smartSnapshot?.roomStates ?? []).filter((room) => room.levelId === activeLevelId),
      [activeLevelId, smartSnapshot]
    );
    const smartNetworkStates = useMemo(
      () => (smartSnapshot?.networkStates ?? []).filter((network) => network.levelId === activeLevelId),
      [activeLevelId, smartSnapshot]
    );
    const networkRenderOffsets = useMemo(() => {
      const groups = new Map<string, Array<{ id: string }>>();
      [...pipes, ...ducts].forEach((network) => {
        const signature = buildPolylineSignature(network.path);
        const bucket = groups.get(signature);
        if (bucket) {
          bucket.push({ id: network.id });
        } else {
          groups.set(signature, [{ id: network.id }]);
        }
      });

      const offsets: Record<string, number> = {};
      groups.forEach((group) => {
        const centerIndex = (group.length - 1) / 2;
        group
          .slice()
          .sort((left, right) => left.id.localeCompare(right.id))
          .forEach((entry, index) => {
            offsets[entry.id] = (index - centerIndex) * NETWORK_ROUTE_OFFSET_PX;
          });
      });
      return offsets;
    }, [ducts, pipes]);

    const objectPlacementBlocked = useCallback(
      (point: Vec2, ignore?: { kind: "equipment" | "sensor"; id: string }) => {
        const collidesWithEquipment = equipment.some(
          (item) =>
            !(ignore?.kind === "equipment" && ignore.id === item.id) &&
            distance(item.position, point) < NETWORK_OBJECT_CLEARANCE
        );
        if (collidesWithEquipment) {
          return true;
        }
        return sensors.some(
          (item) =>
            !(ignore?.kind === "sensor" && ignore.id === item.id) &&
            distance(item.position, point) < NETWORK_OBJECT_CLEARANCE
        );
      },
      [equipment, sensors]
    );

    const validateNetworkPath = useCallback(
      (kind: "pipe" | "duct", path: Vec2[], ignoreId?: string) => {
        const normalized = normalizePolylinePath(path);
        if (normalized.length < 2) {
          notifyError("Недостаточно точек для инженерной трассы.");
          return null;
        }
        const signature = buildPolylineSignature(normalized);
        const existing = (kind === "pipe" ? pipes : ducts).some(
          (network) => network.id !== ignoreId && buildPolylineSignature(network.path) === signature
        );
        if (existing) {
          notifyError("Такая трасса уже существует на текущем уровне.");
          return null;
        }
        return normalized;
      },
      [ducts, pipes]
    );

    const findWallForOpening = useCallback(
      (opening: Door | Window) => {
        if (!opening.anchor.wallId) {
          return null;
        }
        return walls.find((wall) => wall.id === opening.anchor.wallId) ?? null;
      },
      [walls]
    );

    const levelLoops = useMemo(
      () => (activeLevelId ? loops.filter((loop) => loop.levelId === activeLevelId) : []),
      [activeLevelId, loops]
    );

    const anchorPoints = useMemo(() => {
      const points: Vec2[] = [];
      rooms.forEach((room) => room.polygon.forEach((point) => points.push(point)));
      belowLevelRooms.forEach((room) => room.polygon.forEach((point) => points.push(point)));
      roofs.forEach((roof) => roof.boundary.forEach((point) => points.push(point)));
      floorSlabs.forEach((slab) => slab.boundary.forEach((point) => points.push(point)));
      stairs.forEach((stair) => stair.boundary.forEach((point) => points.push(point)));
      walls.forEach((wall) => {
        points.push(wall.a, wall.b, midpoint(wall.a, wall.b));
      });
      belowLevelWalls.forEach((wall) => {
        points.push(wall.a, wall.b, midpoint(wall.a, wall.b));
      });
      pipes.forEach((pipe) => pipe.path.forEach((point) => points.push(point)));
      ducts.forEach((duct) => duct.path.forEach((point) => points.push(point)));
      equipment.forEach((item) => points.push(item.position));
      sensors.forEach((item) => points.push(item.position));
      engineeringPipes.forEach((pipe) => pipe.points.forEach((point) => points.push(point)));
      engineeringEquipment.forEach((item) => points.push({ x: item.x, y: item.y }));
      return points;
    }, [
      belowLevelRooms,
      belowLevelWalls,
      rooms,
      roofs,
      floorSlabs,
      stairs,
      walls,
      pipes,
      ducts,
      equipment,
      sensors,
      engineeringPipes,
      engineeringEquipment,
    ]);

    const networkConnectionPoints = useMemo(() => {
      return {
        pipe: [
          ...pipes.flatMap((pipe) => [pipe.path[0], pipe.path[pipe.path.length - 1]].filter(Boolean)),
          ...equipmentConnectionPoints.filter((entry) => connectionPointSupportsPipe(entry.point)).map((entry) => entry.point.position),
        ],
        duct: [
          ...ducts.flatMap((duct) => [duct.path[0], duct.path[duct.path.length - 1]].filter(Boolean)),
          ...equipmentConnectionPoints.filter((entry) => connectionPointSupportsDuct(entry.point)).map((entry) => entry.point.position),
        ],
      };
    }, [ducts, equipmentConnectionPoints, pipes]);

    const getLoopAtPoint = useCallback(
      (point: Vec2) => levelLoops.find((loop) => polygonContainsPoint(point, loop.polygon)),
      [levelLoops]
    );

    const snap = useCallback(
      (point: Vec2): Vec2 => {
        if (!snapEnabled || gridStep <= 0) {
          return point;
        }
        return snapToGrid(point, gridStep);
      },
      [gridStep, snapEnabled]
    );

    const snapToAnchors = useCallback(
      (point: Vec2): Vec2 => snapAxesToNearbyAnchors(point, anchorPoints, AXIS_SNAP_TOLERANCE),
      [anchorPoints]
    );

    const snapToExistingEndpoint = useCallback(
      (point: Vec2): Vec2 => {
        const endpoints = [
          ...walls.flatMap((wall) => [wall.a, wall.b]),
          ...belowLevelWalls.flatMap((wall) => [wall.a, wall.b]),
        ];
        const endpointSnap = snapToPoint(point, endpoints, ENDPOINT_SNAP_TOLERANCE);
        if (distance(endpointSnap, point) > 1e-6) {
          return endpointSnap;
        }
        const currentSegment = snapToSegment(point, walls, ENDPOINT_SNAP_TOLERANCE);
        const belowSegment = snapToSegment(point, belowLevelWalls, ENDPOINT_SNAP_TOLERANCE);
        const segmentSnap =
          currentSegment && belowSegment
            ? currentSegment.distance <= belowSegment.distance
              ? currentSegment
              : belowSegment
            : currentSegment ?? belowSegment;
        if (segmentSnap) {
          return segmentSnap.point;
        }
        const contourSnap = snapToPolygonBoundary(
          point,
          belowLevelRooms.map((room) => room.polygon),
          ENDPOINT_SNAP_TOLERANCE
        );
        return contourSnap ?? point;
      },
      [belowLevelRooms, belowLevelWalls, walls]
    );

    const snapToNetworkConnections = useCallback(
      (point: Vec2, kind: "pipe" | "duct"): Vec2 => {
        const connectionSnap = snapToPoint(point, networkConnectionPoints[kind], 0.35);
        if (distance(connectionSnap, point) > 1e-6) {
          return connectionSnap;
        }
        const networks: Array<{ path: Vec2[] }> = kind === "pipe" ? pipes : ducts;
        let best: { point: Vec2; distance: number } | null = null;
        for (const network of networks) {
          const candidate = closestPointOnPolyline(point, network.path);
          if (!candidate) {
            continue;
          }
          const candidateDistance = distance(point, candidate);
          if (candidateDistance <= 0.28 && (!best || candidateDistance < best.distance)) {
            best = { point: candidate, distance: candidateDistance };
          }
        }
        return best ? best.point : point;
      },
      [ducts, networkConnectionPoints, pipes]
    );

    const snapToEngineeringPorts = useCallback(
      (point: Vec2): Vec2 => {
        const hit = findEngineeringPortAtPoint(point, engineeringEquipment, 0.35);
        return hit?.position ?? point;
      },
      [engineeringEquipment]
    );

    const resolvePointerPoint = useCallback(
      (point: Vec2, activeTool: BuildTool): Vec2 => {
        let resolved = point;
        let geometrySnapped = false;

        if (activeTool === "pipe" || activeTool === "duct") {
          resolved = snapToNetworkConnections(point, activeTool);
          geometrySnapped = distance(resolved, point) > 1e-6;
        } else if (activeTool === "engineeringPipe") {
          resolved = snapToEngineeringPorts(point);
          geometrySnapped = distance(resolved, point) > 1e-6;
        } else {
          const contourResolved = snapToExistingEndpoint(point);
          if (distance(contourResolved, point) > 1e-6) {
            resolved = contourResolved;
            geometrySnapped = true;
          }
        }

        if (geometrySnapped) {
          const vertexSnap = snapToPoint(resolved, anchorPoints, 0.25);
          if (distance(vertexSnap, resolved) > 1e-6) {
            resolved = vertexSnap;
          }
        } else {
          resolved = snapToAnchors(resolved);
        }

        if (snapEnabled && !geometrySnapped) {
          return snap(resolved);
        }
        return resolved;
      },
      [
        anchorPoints,
        snap,
        snapEnabled,
        snapToAnchors,
        snapToEngineeringPorts,
        snapToExistingEndpoint,
        snapToNetworkConnections,
      ]
    );

    const updateGuides = useCallback(
      (point: Vec2) => {
        let vertical: number | null = null;
        let horizontal: number | null = null;
        let bestX = GUIDE_TOLERANCE;
        let bestY = GUIDE_TOLERANCE;
        anchorPoints.forEach((anchor) => {
          const dx = Math.abs(anchor.x - point.x);
          if (dx < bestX && Math.abs(anchor.y - point.y) <= GUIDE_TOLERANCE) {
            bestX = dx;
            vertical = anchor.x;
          }
          const dy = Math.abs(anchor.y - point.y);
          if (dy < bestY && Math.abs(anchor.x - point.x) <= GUIDE_TOLERANCE) {
            bestY = dy;
            horizontal = anchor.y;
          }
        });
        setGuides((prev) => {
          if (prev.vertical === vertical && prev.horizontal === horizontal) {
            return prev;
          }
          return { vertical, horizontal };
        });
      },
      [anchorPoints]
    );

    const getViewportSize = useCallback((): { width: number; height: number } => {
      const node = containerRef.current;
      if (!node) {
        return size;
      }
      const rect = node.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) {
        return { width: rect.width, height: rect.height };
      }
      return size;
    }, [size.height, size.width]);

    useEffect(() => {
      const node = containerRef.current;
      if (!node) {
        return;
      }
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const nextWidth = entry.contentRect.width;
          const nextHeight = entry.contentRect.height;
          lastObservedSizeRef.current = { width: nextWidth, height: nextHeight };
          setSize((prev) => {
            if (Math.abs(prev.width - nextWidth) < 0.5 && Math.abs(prev.height - nextHeight) < 0.5) {
              return prev;
            }
            return { width: nextWidth, height: nextHeight };
          });
          // Size-only updates; layoutFitEpoch from BuildPage triggers fit when panels change.
        }
      });
      observer.observe(node);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        const wallLengthTypingActive = tool === "wall" && linearDraft?.tool === "wall" && linearDraft.points.length > 0;
        const rectTypingActive =
          rectStart != null && (tool === "roomRect" || tool === "roof" || tool === "slab" || tool === "stair");
        const inTextInput = Boolean((event.target as HTMLElement)?.closest("input,textarea,[contenteditable=true]"));

        if (rectTypingActive && !event.ctrlKey && !event.metaKey && !event.altKey && !inTextInput) {
          const activeField = rectActiveFieldRef.current;
          if (/^\d$/.test(event.key)) {
            setRectInputLocked(true);
            setRectInput((prev) => {
              const nextValue = `${prev[activeField]}${event.key}`;
              const next = { ...prev, [activeField]: nextValue };
              const widthValue = parseLengthInput(activeField === "width" ? nextValue : prev.width);
              const heightValue = parseLengthInput(activeField === "height" ? nextValue : prev.height);
              if (widthValue != null && heightValue != null) {
                next.area = (widthValue * heightValue).toFixed(2);
              }
              return next;
            });
            event.preventDefault();
            return;
          }
          if (event.key === "." || event.key === ",") {
            setRectInputLocked(true);
            setRectInput((prev) => {
              const current = prev[activeField];
              if (current.includes(".") || current.includes(",")) {
                return prev;
              }
              const nextValue = current ? `${current}.` : "0.";
              const next = { ...prev, [activeField]: nextValue };
              return next;
            });
            event.preventDefault();
            return;
          }
          if (event.key === "Backspace") {
            setRectInputLocked(true);
            setRectInput((prev) => {
              const nextValue = prev[activeField].slice(0, -1);
              const next = { ...prev, [activeField]: nextValue };
              const widthValue = parseLengthInput(activeField === "width" ? nextValue : prev.width);
              const heightValue = parseLengthInput(activeField === "height" ? nextValue : prev.height);
              if (widthValue != null && heightValue != null) {
                next.area = (widthValue * heightValue).toFixed(2);
              } else if (activeField === "area") {
                next.area = nextValue;
              }
              return next;
            });
            event.preventDefault();
            return;
          }
          if (event.key === "Delete") {
            setRectInputLocked(true);
            setRectInput((prev) => ({ ...prev, [activeField]: "" }));
            event.preventDefault();
            return;
          }
          if (event.code === "Tab") {
            setRectActiveField((prev) => {
              if (prev === "width") return "height";
              if (prev === "height") return "area";
              return "width";
            });
            event.preventDefault();
            return;
          }
        }

        if (wallLengthTypingActive && !event.ctrlKey && !event.metaKey && !event.altKey) {
          if (/^\d$/.test(event.key)) {
            setWallLengthInput((prev) => `${prev}${event.key}`);
            event.preventDefault();
            return;
          }
          if (event.key === "." || event.key === ",") {
            setWallLengthInput((prev) => {
              if (prev.includes(".") || prev.includes(",")) {
                return prev;
              }
              return prev ? `${prev}.` : "0.";
            });
            event.preventDefault();
            return;
          }
          if (event.key === "Backspace") {
            setWallLengthInput((prev) => prev.slice(0, -1));
            event.preventDefault();
            return;
          }
          if (event.key === "Delete") {
            setWallLengthInput("");
            event.preventDefault();
            return;
          }
        }
        if ((event.target as HTMLElement)?.closest("input,textarea,[contenteditable=true]")) {
          return;
        }
        if (event.code === "Enter" && rectTypingActive) {
          const activeField = rectActiveFieldRef.current;
          const typedWidth = parseLengthInput(rectInput.width);
          const typedHeight = parseLengthInput(rectInput.height);
          if (activeField === "width") {
            if (typedWidth != null && typedWidth >= MIN_RECT_SIZE) {
              setRectActiveField("height");
            }
            event.preventDefault();
            return;
          }
          if (activeField === "height") {
            if (
              typedWidth != null &&
              typedHeight != null &&
              typedWidth >= MIN_RECT_SIZE &&
              typedHeight >= MIN_RECT_SIZE &&
              rectStart
            ) {
              finalizeRectangleShapeRef.current(
                rectStart,
                buildRectEndFromInputs(rectStart, typedWidth, typedHeight),
                tool as "roomRect" | "roof" | "slab" | "stair"
              );
              clearRectDraft();
            } else if (typedHeight != null && typedHeight >= MIN_RECT_SIZE) {
              setRectActiveField("area");
            }
            event.preventDefault();
            return;
          }
          if (activeField === "area") {
            const areaValue = parseLengthInput(rectInput.area);
            if (areaValue != null && typedWidth != null && typedWidth > 0) {
              const derivedHeight = areaValue / typedWidth;
              setRectInput((prev) => ({
                ...prev,
                height: derivedHeight.toFixed(2),
                area: prev.area,
              }));
              setRectActiveField("height");
            } else if (areaValue != null && typedHeight != null && typedHeight > 0) {
              const derivedWidth = areaValue / typedHeight;
              setRectInput((prev) => ({
                ...prev,
                width: derivedWidth.toFixed(2),
                area: prev.area,
              }));
              setRectActiveField("width");
            }
            event.preventDefault();
            return;
          }
        }
        if (event.code === "Space") {
          setSpacePressed(true);
          event.preventDefault();
          return;
        }
        if (event.code === "KeyR" && selection?.kind === "engineeringEquipment") {
          const target = engineeringEquipment.find((item) => item.id === selection.id);
          if (target) {
            onUpdateEngineeringEquipment(selection.id, { rotation: normalizeEngineeringRotation(target.rotation + 90) });
            event.preventDefault();
            return;
          }
        }
        if (event.code === "Escape") {
          setDragState(null);
          setRoomDraft(null);
          setWallDraft(null);
          setNetworkDraft(null);
          setObjectDraft(null);
          setEngineeringEquipmentDraft(null);
          setEngineeringPipeDraft(null);
          setOpeningDraft(null);
          setGuides({ vertical: null, horizontal: null });
          setWallLengthInput("");
          setRectInput({ width: "", height: "", area: "" });
          setRectInputLocked(false);
          setRectActiveField("width");
          setRectStart(null);
          setRectPreview(null);
          if (linearDraft) {
            setLinearDraft(cancelLinearDraft());
            event.preventDefault();
          }
          if (tool === "room" && draftRoom.length) {
            setDraftRoom([]);
            event.preventDefault();
          }
          if (tool !== "select") {
            onToolChange("select");
            event.preventDefault();
            return;
          }
        }
        if (event.code === "Enter" && linearDraft) {
          let draftToFinalize = linearDraft;
          if (tool === "wall" && linearDraft.tool === "wall" && pointerWorld) {
            const withPoint = appendLinearDraftPoint(linearDraft, "wall", pointerWorld, orthogonalMode);
            draftToFinalize = applyFixedWallLengthToDraft(withPoint);
          }
          finalizeLinearDraftRef.current(draftToFinalize);
          event.preventDefault();
        }
      };
      const handleKeyUp = (event: KeyboardEvent) => {
        if (event.code === "Space") {
          setSpacePressed(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }, [
      buildRectEndFromInputs,
      clearRectDraft,
      draftRoom.length,
      engineeringEquipment,
      linearDraft,
      onUpdateEngineeringEquipment,
      orthogonalMode,
      pointerWorld,
      rectInput.area,
      rectInput.height,
      rectInput.width,
      rectStart,
      selection,
      tool,
    ]);

    const focusOnPoints = useCallback(
      (points: Vec2[]) => {
        const viewport = getViewportSize();
        const fit = computeCanvasViewportFit(points, viewport);
        if (!fit) {
          return;
        }
        setView(fit);
      },
      [getViewportSize]
    );

    const collectFitPoints = useCallback((): Vec2[] => {
      const points: Vec2[] = [];
      rooms.forEach((room) => room.polygon.forEach((point) => points.push(point)));
      roofs.forEach((roof) => roof.boundary.forEach((point) => points.push(point)));
      floorSlabs.forEach((slab) => slab.boundary.forEach((point) => points.push(point)));
      stairs.forEach((stair) => stair.boundary.forEach((point) => points.push(point)));
      walls.forEach((wall) => {
        points.push(wall.a, wall.b);
      });
      if (showSmartOverlay) {
        pipes.forEach((pipe) => pipe.path.forEach((point) => points.push(point)));
        ducts.forEach((duct) => duct.path.forEach((point) => points.push(point)));
        equipment.forEach((item) => points.push(item.position));
        sensors.forEach((item) => points.push(item.position));
      }
      engineeringPipes.forEach((pipe) => pipe.points.forEach((point) => points.push(point)));
      engineeringEquipment.forEach((item) => points.push({ x: item.x, y: item.y }));
      return points;
    }, [ducts, engineeringEquipment, engineeringPipes, equipment, floorSlabs, stairs, pipes, roofs, rooms, sensors, showSmartOverlay, walls]);

    const zoomToFitContent = useCallback(
      (force = false) => {
        if (userAdjustedViewRef.current && !force) {
          return;
        }
        const points = collectFitPoints();
        if (!points.length) {
          setView((prev) => ({ ...prev, origin: { x: -10, y: -10 }, zoom: 60 }));
          return;
        }
        focusOnPoints(points);
        userAdjustedViewRef.current = false;
      },
      [collectFitPoints, focusOnPoints, layoutFitEpoch]
    );

    useLayoutEffect(() => {
      layoutFitEpochRef.current = layoutFitEpoch;
    }, [layoutFitEpoch]);

    useLayoutEffect(() => {
      zoomToFitContentRef.current = zoomToFitContent;
    }, [zoomToFitContent]);

    useLayoutEffect(() => {
      if (!layoutFitEpoch || layoutFitEpoch === lastAppliedLayoutFitEpochRef.current) {
        return;
      }
      lastAppliedLayoutFitEpochRef.current = layoutFitEpoch;
      userAdjustedViewRef.current = false;
      const rafId = window.requestAnimationFrame(() => {
        zoomToFitContentRef.current(true);
      });
      return () => window.cancelAnimationFrame(rafId);
    }, [layoutFitEpoch]);

    useImperativeHandle(
      ref,
      () => ({
        zoomToFit: () => {
          zoomToFitContent(true);
        },
        focusSelection: (target) => {
          if (!target) {
            return;
          }
          const points =
            target.kind === "room"
              ? rooms.find((room) => room.id === target.id)?.polygon ?? []
              : target.kind === "wall"
                ? (() => {
                    const wall = walls.find((entry) => entry.id === target.id);
                    return wall ? [wall.a, wall.b] : [];
                  })()
                : target.kind === "roof"
                  ? roofs.find((entry) => entry.id === target.id)?.boundary ?? []
                  : target.kind === "slab"
                    ? floorSlabs.find((entry) => entry.id === target.id)?.boundary ?? []
                  : target.kind === "stair"
                    ? stairs.find((entry) => entry.id === target.id)?.boundary ?? []
                  : target.kind === "door" || target.kind === "window"
                  ? (() => {
                      const opening =
                        target.kind === "door"
                          ? doors.find((entry) => entry.id === target.id)
                          : windows.find((entry) => entry.id === target.id);
                      if (!opening) {
                        return [];
                      }
                      const wall = findWallForOpening(opening);
                      const segment = wall ? getOpeningSegment(wall, opening) : null;
                      return segment ? [segment.start, segment.end, segment.center] : [];
                    })()
                  : target.kind === "pipe"
                    ? pipes.find((entry) => entry.id === target.id)?.path ?? []
                    : target.kind === "duct"
                      ? ducts.find((entry) => entry.id === target.id)?.path ?? []
                      : target.kind === "engineeringPipe"
                        ? engineeringPipes.find((entry) => entry.id === target.id)?.points ?? []
                        : target.kind === "engineeringEquipment"
                          ? (() => {
                              const item = engineeringEquipment.find((entry) => entry.id === target.id);
                              if (!item) {
                                return [];
                              }
                              return [
                                { x: item.x - item.width / 2, y: item.y - item.height / 2 },
                                { x: item.x + item.width / 2, y: item.y + item.height / 2 },
                              ];
                            })()
                      : target.kind === "equipment"
                        ? (() => {
                            const item = equipment.find((entry) => entry.id === target.id);
                            return item ? [item.position] : [];
                          })()
                        : target.kind === "sensor"
                          ? (() => {
                              const item = sensors.find((entry) => entry.id === target.id);
                              return item ? [item.position] : [];
                            })()
                          : levelLoops.find((loop) => loop.id === target.id)?.polygon ?? [];
          focusOnPoints(points);
        },
        getSvgElement: () => svgRef.current,
      }),
      [
        doors,
        ducts,
        engineeringEquipment,
        engineeringPipes,
        equipment,
        findWallForOpening,
        floorSlabs,
        focusOnPoints,
        levelLoops,
        pipes,
        rooms,
        roofs,
        sensors,
        walls,
        windows,
        zoomToFitContent,
      ]
    );

    useLayoutEffect(() => {
      rectActiveFieldRef.current = rectActiveField;
    }, [rectActiveField]);

    useEffect(() => {
      setDragState(null);
      setDraftRoom([]);
      setRectStart(null);
      setRectPreview(null);
      setRectInput({ width: "", height: "", area: "" });
      setRectInputLocked(false);
      setRectActiveField("width");
      setLinearDraft(null);
      setNetworkDraft(null);
      setObjectDraft(null);
      setEngineeringEquipmentDraft(null);
      setEngineeringPipeDraft(null);
      setOpeningDraft(null);
      setHoverLoopId(null);
      setHoveredEngineeringEquipmentId(null);
      setMultiMoveDelta(null);
      areaDragInputRef.current = null;
    }, [tool, activeLevelId]);

    useEffect(() => {
      if (hoverLoopId && !levelLoops.some((loop) => loop.id === hoverLoopId)) {
        setHoverLoopId(null);
      }
    }, [hoverLoopId, levelLoops]);

    const worldToScreen = useCallback(
      (point: Vec2): Vec2 => ({
        x: (point.x - view.origin.x) * view.zoom,
        y: (point.y - view.origin.y) * view.zoom,
      }),
      [view.origin.x, view.origin.y, view.zoom]
    );

    const screenToWorld = useCallback(
      (point: Vec2): Vec2 => ({
        x: point.x / view.zoom + view.origin.x,
        y: point.y / view.zoom + view.origin.y,
      }),
      [view.origin.x, view.origin.y, view.zoom]
    );

    const screenToWorldRef = useRef(screenToWorld);
    useLayoutEffect(() => {
      screenToWorldRef.current = screenToWorld;
    }, [screenToWorld]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) {
        return;
      }
      const onWheelNative = (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const v = viewRef.current;
        const delta = event.deltaY;
        const zoomFactor = Math.exp(-delta * 0.001);
        const newZoom = Math.min(Math.max(v.zoom * zoomFactor, 10), 300);
        const bounds = el.getBoundingClientRect();
        const pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        const before = screenToWorldRef.current(pointer);
        const after = {
          x: pointer.x / newZoom + v.origin.x,
          y: pointer.y / newZoom + v.origin.y,
        };
        const newOrigin = {
          x: v.origin.x + (before.x - after.x),
          y: v.origin.y + (before.y - after.y),
        };
        userAdjustedViewRef.current = true;
        setView({ origin: newOrigin, zoom: newZoom });
      };
      el.addEventListener("wheel", onWheelNative, { passive: false });
      return () => el.removeEventListener("wheel", onWheelNative);
    }, []);

    const roomLabelObstacles = useMemo(() => {
      const equipmentBoxes = equipment.flatMap((item) =>
        buildEquipmentObstacle(item, worldToScreen, engineeringOverlayActive && (showSmartOverlay || !exportMode))
      );
      const sensorBoxes = sensors.map((sensor) => buildSensorObstacle(sensor, worldToScreen));
      const roomStateBoxes = (showSmartOverlay || engineeringOverlayActive)
        ? smartRoomStates
            .map((roomState) => rooms.find((room) => room.id === roomState.roomId))
            .filter((room): room is Room => Boolean(room))
            .map((room) => buildRoomStateObstacle(room, worldToScreen))
        : [];
      return [...equipmentBoxes, ...sensorBoxes, ...roomStateBoxes];
    }, [engineeringOverlayActive, equipment, exportMode, rooms, sensors, showSmartOverlay, smartRoomStates, worldToScreen]);

    const getEventPoint = (event: React.PointerEvent): Vec2 => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) {
        return { x: 0, y: 0 };
      }
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      return screenToWorld({ x, y });
    };

    const updateRectPreviewFromInputs = useCallback(
      (nextWidth: number | null, nextHeight: number | null, currentPreview: Vec2 | null) => {
        if (!rectStart) {
          return;
        }
        const base = currentPreview ?? pointerWorld ?? rectStart;
        const dx = base.x - rectStart.x;
        const dy = base.y - rectStart.y;
        const width = typeof nextWidth === "number" ? Math.max(0.2, nextWidth) : Math.abs(dx);
        const height = typeof nextHeight === "number" ? Math.max(0.2, nextHeight) : Math.abs(dy);
        const next = {
          x: rectStart.x + rectDirectionRef.current.x * width,
          y: rectStart.y + rectDirectionRef.current.y * height,
        };
        setRectPreview(next);
      },
      [pointerWorld, rectStart]
    );

    useEffect(() => {
      if (!rectStart || !(tool === "roomRect" || tool === "roof" || tool === "slab" || tool === "stair")) {
        return;
      }
      if (!rectInputLocked) {
        return;
      }
      updateRectPreviewFromInputs(parseLengthInput(rectInput.width), parseLengthInput(rectInput.height), rectPreview);
    }, [rectInput.height, rectInput.width, rectInputLocked, rectStart, tool, updateRectPreviewFromInputs]);

    const resolveWallLengthPoint = useCallback(
      (point: Vec2): Vec2 => {
        if (tool !== "wall" || !linearDraft || linearDraft.tool !== "wall" || linearDraft.points.length === 0) {
          return point;
        }
        const targetLength = parseLengthInput(wallLengthInput);
        if (targetLength == null || targetLength <= 0) {
          return point;
        }
        const start = linearDraft.points[linearDraft.points.length - 1];
        const rawVector = { x: point.x - start.x, y: point.y - start.y };
        const rawLength = Math.hypot(rawVector.x, rawVector.y);
        const fallback =
          linearDraft.points.length > 1
            ? {
                x: start.x - linearDraft.points[linearDraft.points.length - 2].x,
                y: start.y - linearDraft.points[linearDraft.points.length - 2].y,
              }
            : { x: 1, y: 0 };
        const fallbackLength = Math.hypot(fallback.x, fallback.y);
        const direction =
          rawLength > 1e-6
            ? { x: rawVector.x / rawLength, y: rawVector.y / rawLength }
            : fallbackLength > 1e-6
              ? { x: fallback.x / fallbackLength, y: fallback.y / fallbackLength }
              : { x: 1, y: 0 };
        const length = Math.max(MIN_SEGMENT, targetLength);
        return {
          x: start.x + direction.x * length,
          y: start.y + direction.y * length,
        };
      },
      [linearDraft, tool, wallLengthInput]
    );
    const applyFixedWallLengthToDraft = useCallback(
      (draft: LinearDraft): LinearDraft => {
        if (draft.tool !== "wall" || draft.points.length < 2) {
          return draft;
        }
        const targetLength = parseLengthInput(wallLengthInput);
        if (targetLength == null || targetLength <= 0) {
          return draft;
        }
        const points = [...draft.points];
        const from = points[points.length - 2];
        const to = points[points.length - 1];
        const vector = { x: to.x - from.x, y: to.y - from.y };
        const length = Math.hypot(vector.x, vector.y);
        if (length <= 1e-6) {
          return draft;
        }
        const fixedLength = Math.max(MIN_SEGMENT, targetLength);
        points[points.length - 1] = {
          x: from.x + (vector.x / length) * fixedLength,
          y: from.y + (vector.y / length) * fixedLength,
        };
        return { ...draft, points };
      },
      [wallLengthInput]
    );

    const handleCanvasPointerDown = (event: React.PointerEvent) => {
      usedPointerEventsRef.current = true;
      if (event.button === 2) {

        if (linearDraft) {
          finalizeActiveLinearDraft(linearDraft);
        }
        event.preventDefault();
        return;
      }
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some embedded runtimes may reject pointer capture for this target.
        // Selection and drag should still work via regular pointer events.
      }
      if (spacePressed || event.button === 1) {
        // Prevent browser autoscroll on middle click; pan should start exactly from click point.
        event.preventDefault();
        setIsPanning(true);
        panStartRef.current = { x: event.clientX, y: event.clientY, origin: { ...view.origin } };
        return;
      }
      if (event.button === 0) {
        onViewportPointerDown?.();
      }
      if (!activeLevelId && tool !== "select" && tool !== "erase") {
        notifyError("Создайте уровень, чтобы рисовать.");
        return;
      }
      const rawPoint = getEventPoint(event);
      const worldPoint = resolveWallLengthPoint(resolvePointerPoint(rawPoint, tool));
      setPointerWorld(worldPoint);

      if (tool === "roomRect" || tool === "roof" || tool === "slab" || tool === "stair") {
        if (!rectStart) {
          setRectStart(worldPoint);
          setRectPreview(worldPoint);
          setRectInput({ width: "", height: "", area: "" });
          setRectInputLocked(false);
          setRectActiveField("width");
          rectDirectionRef.current = { x: 1, y: 1 };
        }
        return;
      }
      if (tool === "room") {
        setDraftRoom((prev) => {
          const prevPoint = prev[prev.length - 1];
          const candidate = orthogonalMode && prevPoint ? orthogonalSnap(worldPoint, prevPoint) : worldPoint;
          const nextPolygon = [...prev, candidate];
          if (createsSelfIntersection(nextPolygon)) {
            notifyError("Контур самопересекается.");
            return prev;
          }
          return nextPolygon;
        });
        return;
      }
      if (isLinearTool(tool)) {
        let nextDraft = appendLinearDraftPoint(linearDraft, tool, worldPoint, orthogonalMode);
        if (tool === "wall") {
          nextDraft = applyFixedWallLengthToDraft(nextDraft);
        }
        if (linearDraft && linearDraft.tool === tool && tool === "wall") {
          const firstPoint = nextDraft.points[0];
          const lastPoint = nextDraft.points[nextDraft.points.length - 1];
          if (distance(firstPoint, lastPoint) <= LOOP_CLOSE_TOLERANCE && nextDraft.points.length > 2) {
            nextDraft.points[nextDraft.points.length - 1] = { ...firstPoint };
          }
        }
        setLinearDraft(nextDraft);
        return;
      }
      if (tool === "equipment") {
        placeEquipment(worldPoint);
        return;
      }
      if (tool === "engineeringEquipment") {
        placeEngineeringEquipment(worldPoint);
        return;
      }
      if (tool === "sensor") {
        placeSensor(worldPoint);
        return;
      }
      if (tool === "engineeringPipe") {
        handleEngineeringPipePointerDown(worldPoint);
        return;
      }
      if (tool === "door" || tool === "window") {
        placeOpening(worldPoint, tool);
        return;
      }
      if (tool === "erase") {
        if (event.button === 0 && !event.altKey) {
          const rawWorldPoint = rawPoint;
          areaDragInputRef.current = "pointer";
          setDragState({ type: "erase-area", start: rawWorldPoint, end: rawWorldPoint });
          return;
        }
        return;
      }
      if (tool === "select") {
        const openingHandle = hitOpeningHandle(worldPoint);
        if (openingHandle) {
          const source =
            openingHandle.openingKind === "door"
              ? doors.find((door) => door.id === openingHandle.openingId)
              : windows.find((window) => window.id === openingHandle.openingId);
          const wall = source ? findWallForOpening(source) : null;
          if (source && wall) {
            setDragState(openingHandle);
            setOpeningDraft({
              id: source.id,
              kind: openingHandle.openingKind,
              wallId: wall.id,
              width: source.width_m,
              offset: anchorToOffset(source.anchor, wall),
            });
            onSelectionChange({ kind: openingHandle.openingKind, id: source.id });
            return;
          }
        }
        const vertexHandle = hitTestVertex(worldPoint);
        if (vertexHandle) {
          setDragState(vertexHandle);
          if (vertexHandle.type === "room-vertex" && !roomDraft) {
            const original = rooms.find((room) => room.id === vertexHandle.roomId);
            if (original) {
              setRoomDraft({ roomId: original.id, polygon: original.polygon.map((point) => ({ ...point })) });
            }
          }
          if (vertexHandle.type === "wall-end" && !wallDraft) {
            const original = walls.find((wall) => wall.id === vertexHandle.wallId);
            if (original) {
              setWallDraft({
                wallId: original.id,
                a: { ...original.a },
                b: { ...original.b },
              });
            }
          }
          return;
        }
        const target = hitTest(worldPoint);
        if (target && event.altKey) {
          onRemoveSelection(target);
          return;
        }
        if (target && event.button === 0) {
          const inMulti = multiSelection.length > 0 && multiSelection.some((s) => s.kind === target.kind && s.id === target.id);
          if (inMulti) {
            // Move all multi-selected items together
            areaDragInputRef.current = "pointer";
            setDragState({ type: "move-multi", start: rawPoint });
            return;
          }
          // Otherwise start marquee selection
          areaDragInputRef.current = "pointer";
          setDragState({ type: "select-area", start: rawPoint, end: rawPoint });
          return;
        }
        if (target?.kind === "door" || target?.kind === "window") {
          const source =
            target.kind === "door"
              ? doors.find((door) => door.id === target.id)
              : windows.find((window) => window.id === target.id);
          const wall = source ? findWallForOpening(source) : null;
          if (source && wall) {
            setDragState({ type: "opening", openingKind: target.kind, openingId: source.id });
            setOpeningDraft({
              id: source.id,
              kind: target.kind,
              wallId: wall.id,
              width: source.width_m,
              offset: anchorToOffset(source.anchor, wall),
            });
            onSelectionChange(target);
            return;
          }
        }
        if (target?.kind === "equipment") {
          const item = equipment.find((entry) => entry.id === target.id);
          if (item) {
            setObjectDraft({ kind: "equipment", id: item.id, position: { ...item.position } });
            setDragState({ type: "move-object", kind: "equipment", id: item.id, origin: { ...item.position }, start: worldPoint });
            onSelectionChange(target);
            return;
          }
        }
        if (target?.kind === "sensor") {
          const item = sensors.find((entry) => entry.id === target.id);
          if (item) {
            setObjectDraft({ kind: "sensor", id: item.id, position: { ...item.position } });
            setDragState({ type: "move-object", kind: "sensor", id: item.id, origin: { ...item.position }, start: worldPoint });
            onSelectionChange(target);
            return;
          }
        }
        if (target?.kind === "engineeringEquipment") {
          const item = engineeringEquipment.find((entry) => entry.id === target.id);
          if (item) {
            setEngineeringEquipmentDraft({ id: item.id, x: item.x, y: item.y });
            setDragState({
              type: "move-engineering-equipment",
              id: item.id,
              origin: { x: item.x, y: item.y },
              start: worldPoint,
            });
            onSelectionChange(target);
            return;
          }
        }
        if (target?.kind === "room") {
          const room = rooms.find((entry) => entry.id === target.id);
          if (room && room.source !== "auto") {
            setDragState({
              type: "move-room",
              roomId: room.id,
              origin: room.polygon.map((point) => ({ ...point })),
              start: worldPoint,
            });
            setRoomDraft({ roomId: room.id, polygon: room.polygon.map((point) => ({ ...point })) });
            onSelectionChange(target);
            return;
          }
        }
        if (target?.kind === "wall") {
          const wall = walls.find((entry) => entry.id === target.id);
          if (wall) {
            setDragState({
              type: "move-wall",
              wallId: wall.id,
              originA: { ...wall.a },
              originB: { ...wall.b },
              start: worldPoint,
            });
            setWallDraft({ wallId: wall.id, a: { ...wall.a }, b: { ...wall.b } });
            onSelectionChange(target);
            return;
          }
        }
        if (target?.kind === "pipe") {
          const pipe = pipes.find((entry) => entry.id === target.id);
          if (pipe) {
            setNetworkDraft({ kind: "pipe", id: pipe.id, path: pipe.path.map((point) => ({ ...point })) });
            setDragState({
              type: "move-network",
              kind: "pipe",
              id: pipe.id,
              origin: pipe.path.map((point) => ({ ...point })),
              start: worldPoint,
            });
            onSelectionChange(target);
            return;
          }
        }
        if (target?.kind === "duct") {
          const duct = ducts.find((entry) => entry.id === target.id);
          if (duct) {
            setNetworkDraft({ kind: "duct", id: duct.id, path: duct.path.map((point) => ({ ...point })) });
            setDragState({
              type: "move-network",
              kind: "duct",
              id: duct.id,
              origin: duct.path.map((point) => ({ ...point })),
              start: worldPoint,
            });
            onSelectionChange(target);
            return;
          }
        }
        const loopHit = !target ? getLoopAtPoint(worldPoint) : null;
        if (loopHit) {
          onSelectionChange({ kind: "loop", id: loopHit.id });
          return;
        }
        if (!target) {
          onViewportPointerDown?.();
          if (event.button === 0) {
            const rawWorldPoint = rawPoint;
            areaDragInputRef.current = "pointer";
            setDragState({ type: "select-area", start: rawWorldPoint, end: rawWorldPoint });
            return;
          }
        }
        setNetworkHoverCard(null);
        onSelectionChange(target);
      }
    };

    const handlePointerMove = (event: React.PointerEvent) => {
      const snapped = resolvePointerPoint(getEventPoint(event), tool);

      const basePreview = previewLinearDraftPoint(linearDraft, snapped, orthogonalMode) ?? snapped;
      const previewPoint = resolveWallLengthPoint(basePreview);
      setPointerWorld(previewPoint);
      updateGuides(previewPoint);
      if (!isPanning && rectStart && (tool === "roomRect" || tool === "roof" || tool === "slab" || tool === "stair")) {
        setRectPreview(previewPoint);
        const dx = previewPoint.x - rectStart.x;
        const dy = previewPoint.y - rectStart.y;
        rectDirectionRef.current = { x: dx >= 0 ? 1 : -1, y: dy >= 0 ? 1 : -1 };
        if (!rectInputLocked) {
          const width = Math.abs(dx);
          const height = Math.abs(dy);
          setRectInput({
            width: width.toFixed(2),
            height: height.toFixed(2),
            area: (width * height).toFixed(2),
          });
        }
      }

      if (!isPanning && !dragState && tool === "select") {
        const hoveredLoop = getLoopAtPoint(previewPoint);
        setHoverLoopId(hoveredLoop?.id ?? null);
      }
      if (!isPanning && !dragState) {
        const hoveredSelection = hitTest(previewPoint);
        setHoveredEngineeringEquipmentId(hoveredSelection?.kind === "engineeringEquipment" ? hoveredSelection.id : null);
        if (
          hoveredSelection &&
          (hoveredSelection.kind === "pipe" ||
            hoveredSelection.kind === "duct" ||
            hoveredSelection.kind === "equipment" ||
            hoveredSelection.kind === "sensor")
        ) {
          setNetworkHoverCard(
            buildNetworkHoverCard(hoveredSelection, {
              model,
              screen: getEventPoint(event),
            })
          );
        } else {
          setNetworkHoverCard(null);
        }
      }

      if (isPanning) {
        const dx = event.clientX - panStartRef.current.x;
        const dy = event.clientY - panStartRef.current.y;
        const newOrigin = {
          x: panStartRef.current.origin.x - dx / view.zoom,
          y: panStartRef.current.origin.y - dy / view.zoom,
        };
        userAdjustedViewRef.current = true;
        setView((prev) => ({ ...prev, origin: newOrigin }));
        return;
      }
      if (!dragState) {
        return;
      }
      if (dragState.type === "erase-area" || dragState.type === "select-area") {
        const rawWorldPoint = getEventPoint(event);
        setDragState({ ...dragState, end: rawWorldPoint });
        return;
      }
      if (dragState.type === "move-multi") {
        const rawWorldPoint = getEventPoint(event);
        setMultiMoveDelta({ x: rawWorldPoint.x - dragState.start.x, y: rawWorldPoint.y - dragState.start.y });
        return;
      }
      if (dragState.type === "room-vertex" && roomDraft) {
        const prev = roomDraft.polygon[(dragState.vertexIndex - 1 + roomDraft.polygon.length) % roomDraft.polygon.length];
        const candidate =
          orthogonalMode && prev ? orthogonalSnap(snapped, prev) : snapped;
        const nextPolygon = roomDraft.polygon.map((point, index) =>
          index === dragState.vertexIndex ? candidate : point
        );
        if (createsSelfIntersection(nextPolygon)) {
          return;
        }
        setRoomDraft({ roomId: roomDraft.roomId, polygon: nextPolygon });
        return;
      }
      if (dragState.type === "wall-end" && wallDraft) {
        const reference = dragState.end === "a" ? wallDraft.b : wallDraft.a;
        const candidate = orthogonalMode && reference ? orthogonalSnap(snapped, reference) : snapped;
        setWallDraft({
          wallId: wallDraft.wallId,
          a: dragState.end === "a" ? candidate : wallDraft.a,
          b: dragState.end === "b" ? candidate : wallDraft.b,
        });
        return;
      }
      if (dragState.type === "opening" && openingDraft) {
        const wall = walls.find((w) => w.id === openingDraft.wallId);
        if (!wall) {
          return;
        }
        const projection = projectPointOnWall(previewPoint, wall);
        if (!projection) {
          return;
        }
        const nextOffset = clampOpeningOffset(projection.center, openingDraft.width, projection.length);
        if (nextOffset == null) {
          return;
        }
        if (openingOverlaps(wall, nextOffset, openingDraft.width, doors, windows, openingDraft.id)) {
          return;
        }
        setOpeningDraft({
          ...openingDraft,
          offset: nextOffset,
        });
        return;
      }
      if (dragState.type === "move-object") {
        const delta = { x: snapped.x - dragState.start.x, y: snapped.y - dragState.start.y };
        const nextPosition = { x: dragState.origin.x + delta.x, y: dragState.origin.y + delta.y };
        setObjectDraft({ kind: dragState.kind, id: dragState.id, position: nextPosition });
        return;
      }
      if (dragState.type === "move-engineering-equipment") {
        const delta = { x: snapped.x - dragState.start.x, y: snapped.y - dragState.start.y };
        setEngineeringEquipmentDraft({ id: dragState.id, x: dragState.origin.x + delta.x, y: dragState.origin.y + delta.y });
        return;
      }
      if (dragState.type === "move-room" && roomDraft) {
        const delta = { x: snapped.x - dragState.start.x, y: snapped.y - dragState.start.y };
        const nextPolygon = dragState.origin.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));
        if (createsSelfIntersection(nextPolygon)) {
          return;
        }
        setRoomDraft({ roomId: roomDraft.roomId, polygon: nextPolygon });
        return;
      }
      if (dragState.type === "move-wall" && wallDraft) {
        const delta = { x: snapped.x - dragState.start.x, y: snapped.y - dragState.start.y };
        setWallDraft({
          wallId: wallDraft.wallId,
          a: { x: dragState.originA.x + delta.x, y: dragState.originA.y + delta.y },
          b: { x: dragState.originB.x + delta.x, y: dragState.originB.y + delta.y },
        });
        return;
      }
      if (dragState.type === "move-network") {
        const delta = { x: snapped.x - dragState.start.x, y: snapped.y - dragState.start.y };
        const nextPath = dragState.origin.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));
        setNetworkDraft({ kind: dragState.kind, id: dragState.id, path: nextPath });
      }
    };

    const handlePointerUp = (event?: React.PointerEvent) => {
      if (event) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
      }
      if (rectStart && (tool === "roomRect" || tool === "roof" || tool === "slab" || tool === "stair")) {
        const typedWidth = parseLengthInput(rectInput.width);
        const typedHeight = parseLengthInput(rectInput.height);
        const hasTypedDimensions =
          rectInputLocked &&
          typedWidth != null &&
          typedHeight != null &&
          typedWidth >= MIN_RECT_SIZE &&
          typedHeight >= MIN_RECT_SIZE;
        const dragTarget = pointerWorld ?? rectPreview ?? rectStart;
        const dragWidth = Math.abs(dragTarget.x - rectStart.x);
        const dragHeight = Math.abs(dragTarget.y - rectStart.y);
        const hasDragDimensions = dragWidth >= MIN_RECT_SIZE && dragHeight >= MIN_RECT_SIZE;

        if (hasTypedDimensions) {
          finalizeRectangleShape(
            rectStart,
            buildRectEndFromInputs(rectStart, typedWidth, typedHeight),
            tool
          );
          clearRectDraft();
          return;
        }
        if (hasDragDimensions) {
          finalizeRectangleShape(rectStart, dragTarget, tool);
          clearRectDraft();
          return;
        }
        if (tool === "roomRect") {
          return;
        }
        clearRectDraft();
        return;
      }
      if (isPanning) {
        setIsPanning(false);
        return;
      }
      if (dragState?.type === "move-multi" && multiMoveDelta) {
        const delta = multiMoveDelta;
        multiSelection.forEach((item) => {
          if (item.kind === "room") {
            const orig = model.rooms.find((r) => r.id === item.id);
            if (orig && orig.source !== "auto") {
              onUpdateRoom(orig.id, { polygon: orig.polygon.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })) });
            }
          } else if (item.kind === "wall") {
            const orig = model.walls.find((w) => w.id === item.id);
            if (orig) onUpdateWall(orig.id, { a: { x: orig.a.x + delta.x, y: orig.a.y + delta.y }, b: { x: orig.b.x + delta.x, y: orig.b.y + delta.y } });
          } else if (item.kind === "equipment") {
            const orig = model.equipment.find((e) => e.id === item.id);
            if (orig) onUpdateEquipment(orig.id, { position: { x: orig.position.x + delta.x, y: orig.position.y + delta.y } });
          } else if (item.kind === "sensor") {
            const orig = model.sensors.find((s) => s.id === item.id);
            if (orig) onUpdateSensor(orig.id, { position: { x: orig.position.x + delta.x, y: orig.position.y + delta.y } });
          } else if (item.kind === "engineeringEquipment") {
            const orig = (model.engineeringSystems?.equipment ?? []).find((e) => e.id === item.id);
            if (orig) onUpdateEngineeringEquipment(orig.id, { x: orig.x + delta.x, y: orig.y + delta.y });
          } else if (item.kind === "pipe") {
            const orig = model.pipes.find((p) => p.id === item.id);
            if (orig) onUpdatePipe(orig.id, { path: (orig.path ?? []).map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })) });
          } else if (item.kind === "duct") {
            const orig = model.ducts.find((d) => d.id === item.id);
            if (orig) onUpdateDuct(orig.id, { path: (orig.path ?? []).map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })) });
          } else if (item.kind === "engineeringPipe") {
            const orig = (model.engineeringSystems?.pipes ?? []).find((p) => p.id === item.id);
            if (orig) onUpdateEngineeringPipe(orig.id, { points: orig.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })) });
          }
        });
        setMultiMoveDelta(null);
        // keep multiSelection intact after move
      }
      if (dragState?.type === "erase-area" || dragState?.type === "select-area") {
        const bounds = toAreaBounds(dragState.start, dragState.end);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        const startScreen = worldToScreen(dragState.start);
        const endScreen = worldToScreen(dragState.end);
        const movedEnoughPx = Math.abs(endScreen.x - startScreen.x) >= 6 || Math.abs(endScreen.y - startScreen.y) >= 6;
        const isAreaSelection = (width >= 0.15 && height >= 0.15) || movedEnoughPx;
        if (isAreaSelection) {
          const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
          const targets: Selection[] = [];

          for (const door of doors) {
            const wall = door.anchor.wallId ? wallsById.get(door.anchor.wallId) : null;
            if (wall) {
              const center = midpoint(wall.a, wall.b, door.anchor.t);
              if (boundsContainsPoint(bounds, center)) {
                targets.push({ kind: "door", id: door.id });
              }
            }
          }
          for (const window of windows) {
            const wall = window.anchor.wallId ? wallsById.get(window.anchor.wallId) : null;
            if (wall) {
              const center = midpoint(wall.a, wall.b, window.anchor.t);
              if (boundsContainsPoint(bounds, center)) {
                targets.push({ kind: "window", id: window.id });
              }
            }
          }

          for (const room of rooms) {
            if (polygonIntersectsBounds(bounds, room.polygon)) {
              targets.push({ kind: "room", id: room.id });
            }
          }
          for (const roof of roofs) {
            if (polygonIntersectsBounds(bounds, roof.boundary)) {
              targets.push({ kind: "roof", id: roof.id });
            }
          }
          for (const slab of floorSlabs) {
            if (polygonIntersectsBounds(bounds, slab.boundary)) {
              targets.push({ kind: "slab", id: slab.id });
            }
          }
          for (const stair of stairs) {
            if (polygonIntersectsBounds(bounds, stair.boundary)) {
              targets.push({ kind: "stair", id: stair.id });
            }
          }
          for (const wall of walls) {
            if (segmentIntersectsBounds(bounds, wall.a, wall.b)) {
              targets.push({ kind: "wall", id: wall.id });
            }
          }

          for (const pipe of pipes) {
            if (polylineIntersectsBounds(bounds, pipe.path ?? [])) {
              targets.push({ kind: "pipe", id: pipe.id });
            }
          }
          for (const duct of ducts) {
            if (polylineIntersectsBounds(bounds, duct.path ?? [])) {
              targets.push({ kind: "duct", id: duct.id });
            }
          }
          for (const item of equipment) {
            if (boundsContainsPoint(bounds, item.position)) {
              targets.push({ kind: "equipment", id: item.id });
            }
          }
          for (const sensor of sensors) {
            if (boundsContainsPoint(bounds, sensor.position)) {
              targets.push({ kind: "sensor", id: sensor.id });
            }
          }

          for (const item of engineeringEquipment) {
            if (boundsContainsPoint(bounds, { x: item.x, y: item.y })) {
              targets.push({ kind: "engineeringEquipment", id: item.id });
            }
          }
          for (const pipe of engineeringPipes) {
            if (polylineIntersectsBounds(bounds, pipe.points ?? [])) {
              targets.push({ kind: "engineeringPipe", id: pipe.id });
            }
          }

          const seen = new Set<string>();
          const ordered = targets.filter((target) => {
            const key = `${target.kind}:${target.id}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          });
          if (dragState.type === "erase-area") {
            ordered.forEach((target) => onRemoveSelection(target));
            onSelectionChange(null);
          } else {
            const priority: Array<NonNullable<Selection>["kind"]> = [
              "room",
              "wall",
              "roof",
              "slab",
              "stair",
              "door",
              "window",
              "equipment",
              "sensor",
              "pipe",
              "duct",
              "engineeringEquipment",
              "engineeringPipe",
              "loop",
            ];
            const nextSelection =
              priority
                .map((kind) => ordered.find((target) => target.kind === kind))
                .find((target): target is NonNullable<Selection> => Boolean(target)) ??
              (ordered[0] ?? null);
            onSelectionChange(nextSelection);
            onMultiSelectionChange?.(ordered);
          }
        } else if (dragState.type === "select-area") {
          const clickTarget = hitTest(dragState.end);
          if (clickTarget) {
            onMultiSelectionChange?.([]);
            onSelectionChange(clickTarget);
          } else {
            const loopHit = getLoopAtPoint(dragState.end);
            onMultiSelectionChange?.([]);
            onSelectionChange(loopHit ? { kind: "loop", id: loopHit.id } : null);
          }
        } else {
          const clickTarget = hitTest(dragState.end);
          if (clickTarget) {
            onRemoveSelection(clickTarget);
            onSelectionChange(null);
          }
        }
      }
      if (dragState?.type === "room-vertex" && roomDraft) {
        onUpdateRoom(dragState.roomId, { polygon: roomDraft.polygon });
      }
      if (dragState?.type === "wall-end" && wallDraft) {
        if (wallIntersectsExisting(wallDraft.a, wallDraft.b, walls, wallDraft.wallId)) {
          notifyError("Стену нельзя пересекать без узла.");
        } else {
          onUpdateWall(dragState.wallId, { a: wallDraft.a, b: wallDraft.b });
        }
      }
      if (dragState?.type === "move-room" && roomDraft) {
        onUpdateRoom(dragState.roomId, { polygon: roomDraft.polygon });
      }
      if (dragState?.type === "move-wall" && wallDraft) {
        if (wallIntersectsExisting(wallDraft.a, wallDraft.b, walls, wallDraft.wallId)) {
          notifyError("Стену нельзя пересекать без узла.");
        } else {
          onUpdateWall(dragState.wallId, { a: wallDraft.a, b: wallDraft.b });
        }
      }
      if (dragState?.type === "move-object" && objectDraft) {
        if (objectPlacementBlocked(objectDraft.position, { kind: objectDraft.kind, id: dragState.id })) {
          notifyError("Элемент нельзя переместить в занятую точку.");
        } else {
        const roomId = rooms.find((room) => polygonContainsPoint(objectDraft.position, room.polygon))?.id ?? null;
        if (objectDraft.kind === "equipment") {
          onUpdateEquipment(dragState.id, { position: objectDraft.position, roomId });
        } else {
          onUpdateSensor(dragState.id, { position: objectDraft.position, roomId });
        }
        }
      }
      if (dragState?.type === "move-engineering-equipment" && engineeringEquipmentDraft) {
        onUpdateEngineeringEquipment(dragState.id, {
          x: engineeringEquipmentDraft.x,
          y: engineeringEquipmentDraft.y,
        });
      }
      if (dragState?.type === "move-network" && networkDraft) {
        const normalizedPath = validateNetworkPath(networkDraft.kind, networkDraft.path, dragState.id);
        if (!normalizedPath) {
          notifyError("Трасса конфликтует с уже существующей сетью.");
        } else if (networkDraft.kind === "pipe") {
          onUpdatePipe(dragState.id, { path: normalizedPath });
        } else {
          onUpdateDuct(dragState.id, { path: normalizedPath });
        }
      }
      if (dragState?.type === "opening" && openingDraft) {
        const wall = walls.find((w) => w.id === openingDraft.wallId);
        if (wall) {
          const anchorPatch = buildAnchorFromOffset(wall, openingDraft.offset);
          if (openingDraft.kind === "door") {
            onUpdateDoor(openingDraft.id, { anchor: anchorPatch, lost: false });
          } else {
            onUpdateWindow(openingDraft.id, { anchor: anchorPatch, lost: false });
          }
        }
      }
      setDragState(null);
      setRoomDraft(null);
      setWallDraft(null);
      setNetworkDraft(null);
      setObjectDraft(null);
      setEngineeringEquipmentDraft(null);
      setOpeningDraft(null);
      setGuides({ vertical: null, horizontal: null });
      setPointerWorld(null);
      setHoveredEngineeringEquipmentId(null);
      setNetworkHoverCard(null);
      setMultiMoveDelta(null);
      areaDragInputRef.current = null;
    };

    const handlePointerLeave = (event: React.PointerEvent) => {
      if (rectStart && (tool === "roof" || tool === "slab" || tool === "stair")) {
        clearRectDraft();
      }
      // Only finalize the drag if the button is already released.
      // When button is still held, pointer capture should still deliver pointer-up;
      // cancelling here would silently drop the drag in Electron environments.
      if ((event.buttons & 1) === 0) {
        handlePointerUp(event);
      }
      setHoverLoopId(null);
      setHoveredEngineeringEquipmentId(null);
      setNetworkHoverCard(null);
    };

    const handleMouseDownFallback = (event: React.MouseEvent) => {
      if (areaDragInputRef.current === "pointer" || event.button !== 0 || event.altKey) {
        return;
      }
      if (tool !== "select" && tool !== "erase") {
        return;
      }
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }
      const rawWorldPoint = screenToWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
      areaDragInputRef.current = "mouse";
      setDragState({ type: tool === "erase" ? "erase-area" : "select-area", start: rawWorldPoint, end: rawWorldPoint });
    };

    const handleMouseMoveFallback = (event: React.MouseEvent) => {
      if (areaDragInputRef.current !== "mouse" || (event.buttons & 1) !== 1) {
        return;
      }
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }
      const rawWorldPoint = screenToWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
      setDragState((prev) =>
        prev && (prev.type === "erase-area" || prev.type === "select-area") ? { ...prev, end: rawWorldPoint } : prev
      );
    };

    const handleMouseUpFallback = (event: React.MouseEvent) => {
      if (areaDragInputRef.current !== "mouse" || event.button !== 0) {
        return;
      }
      handlePointerUp();
    };

    const handleDoubleClick = () => {
      if (linearDraft) {
        finalizeActiveLinearDraft(linearDraft);
        return;
      }
      if (tool !== "room" || draftRoom.length < 3 || !activeLevelId) {
        return;
      }
      const validation = validateRoomPolygon(draftRoom);
      if (!validation.valid || !validation.normalized) {
        notifyError(validation.reason ?? "Некорректный контур помещения.");
        return;
      }
      const newRoom: Room = {
        id: createId("room"),
        name: `Помещение ${model.rooms.length + 1}`,
        levelId: activeLevelId,
        polygon: validation.normalized,
        source: "manual",
      };
      onAddRoom(newRoom);
      setDraftRoom([]);
      onSelectionChange({ kind: "room", id: newRoom.id });
      onToolChange("select");
    };

    const finalizeRectangleShape = (start: Vec2, end: Vec2, kind: "roomRect" | "roof" | "slab" | "stair") => {
      if (!activeLevelId) {
        notifyError("Создайте уровень, чтобы рисовать элемент.");
        return;
      }
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      const width = maxX - minX;
      const height = maxY - minY;
      if (width < MIN_RECT_SIZE || height < MIN_RECT_SIZE) {
        notifyError("Минимальный размер прямоугольника — 1 м × 1 м.");
        return;
      }
      const polygon: Vec2[] = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
      const level = model.levels.find((entry) => entry.id === activeLevelId);
      if (kind === "roof") {
        const roof: Roof = applyEnvelopePresetToRoof(
          {
            id: createId("roof"),
            name: `Крыша ${roofs.length + 1}`,
            levelId: activeLevelId,
            kind: ROOF_DEFAULTS.kind,
            boundary: polygon,
            elevationBase_m: (level?.elevation_m ?? 0) + (level?.height_m ?? WALL_DEFAULTS.height),
            thickness_m: ROOF_DEFAULTS.thickness,
            slope: {
              directionDeg: ROOF_DEFAULTS.slopeDirectionDeg,
              risePerMeter: ROOF_DEFAULTS.risePerMeter,
            },
            heatedSide: ROOF_DEFAULTS.heatedSide,
            assemblyId: null,
          },
          roofPreset
        );
        onAddRoof(roof);
        onSelectionChange({ kind: "roof", id: roof.id });
        return;
      }
      if (kind === "slab") {
        const slab: FloorSlab = applyEnvelopePresetToFloorSlab(
          {
            id: createId("slab"),
            name: `Перекрытие ${floorSlabs.length + 1}`,
            levelId: activeLevelId,
            kind: FLOOR_SLAB_DEFAULTS.kind,
            boundary: polygon,
            elevation_m: level?.elevation_m ?? 0,
            thickness_m: FLOOR_SLAB_DEFAULTS.thickness,
            heatedSide: FLOOR_SLAB_DEFAULTS.heatedSide,
            assemblyId: null,
          },
          slabPreset
        );
        onAddFloorSlab(slab);
        onSelectionChange({ kind: "slab", id: slab.id });
        return;
      }
      if (kind === "stair") {
        const stair: Stair = {
          id: createId("stair"),
          name: `Лестница ${stairs.length + 1}`,
          levelId: activeLevelId,
          boundary: polygon,
          stepCount: STAIR_DEFAULTS.stepCount,
          totalRise_m: level?.height_m ?? STAIR_DEFAULTS.totalRise_m,
        };
        onAddStair(stair);
        onSelectionChange({ kind: "stair", id: stair.id });
        return;
      }
      const newRoom: Room = {
        id: createId("room"),
        name: `Помещение ${model.rooms.length + 1}`,
        levelId: activeLevelId,
        polygon,
        source: "manual",
      };
      onAddRoom(newRoom);
      onSelectionChange({ kind: "room", id: newRoom.id });
    };

    useEffect(() => {
      finalizeRectangleShapeRef.current = finalizeRectangleShape;
    });

    function resetLinearDraft() {
      setLinearDraft(cancelLinearDraft());
      setWallLengthInput("");
      setPointerWorld(null);
      setGuides({ vertical: null, horizontal: null });
    }

    function finalizeActiveLinearDraft(draft: LinearDraft | null) {
      if (!activeLevelId) {
        resetLinearDraft();
        return;
      }
      const points = finalizeLinearDraft(draft);
      if (points.length < 2 || !draft) {
        resetLinearDraft();
        return;
      }

      if (draft.tool === "wall") {
        let nextWalls = model.walls.map((wall) => ({
          ...wall,
          a: { ...wall.a },
          b: { ...wall.b },
        }));
        const insertedWallIds: string[] = [];
        const fixedLengthInput = parseLengthInput(wallLengthInput);
        const lockSegmentLength = fixedLengthInput != null && fixedLengthInput > 0;

        points.slice(1).forEach((point, index) => {
          const start = points[index];
          const rawEnd = point;
          const rawLength = Math.hypot(rawEnd.x - start.x, rawEnd.y - start.y);
          if (rawLength < MIN_SEGMENT) {
            return;
          }
          const fixedLength = lockSegmentLength ? Math.max(MIN_SEGMENT, fixedLengthInput ?? MIN_SEGMENT) : null;
          const end =
            fixedLength != null
              ? {
                  x: start.x + ((rawEnd.x - start.x) / rawLength) * fixedLength,
                  y: start.y + ((rawEnd.y - start.y) / rawLength) * fixedLength,
                }
              : rawEnd;
          const candidateWall: Wall = applyEnvelopePresetToWall(
            {
              id: createId("wall"),
              levelId: activeLevelId,
              a: { ...start },
              b: { ...end },
              thickness_m: WALL_DEFAULTS.thickness,
              height_m:
                model.levels.find((level) => level.id === activeLevelId)?.height_m ?? WALL_DEFAULTS.height,
            },
            wallPreset
          );
          const joined = autoJoinWalls(nextWalls, candidateWall, lockSegmentLength ? 0 : ENDPOINT_SNAP_TOLERANCE);
          nextWalls = joined.walls;
          insertedWallIds.push(...joined.insertedWallIds);
        });

        if (!insertedWallIds.length) {
          notifyError("Не удалось построить стены по выбранной траектории.");
          resetLinearDraft();
          return;
        }
        onSetWalls(nextWalls);
        onSelectionChange({ kind: "wall", id: insertedWallIds[insertedWallIds.length - 1] });
        resetLinearDraft();
        return;
      }

      if (draft.tool === "pipe") {
        const normalizedPath = validateNetworkPath("pipe", points);
        if (!normalizedPath) {
          resetLinearDraft();
          return;
        }
        const connectedEquipmentIds = getNetworkEndpointConnectionIds(
          { id: "draft-pipe", path: normalizedPath },
          equipment,
          "pipe"
        );
        const pipe: PipeNetwork = {
          id: createId("pipe"),
          levelId: activeLevelId,
          ...pipeDefaults,
          path: normalizedPath,
          connectedEquipmentIds,
        };
        onAddPipe(pipe);
        connectedEquipmentIds.forEach((equipmentId) => {
          const target = equipment.find((item) => item.id === equipmentId);
          if (!target) {
            return;
          }
          const nextNetworkIds = [...new Set([...(target.connectedNetworkIds ?? []), pipe.id])];
          onUpdateEquipment(equipmentId, { connectedNetworkIds: nextNetworkIds });
        });
        onSelectionChange({ kind: "pipe", id: pipe.id });
        resetLinearDraft();
        return;
      }

      const normalizedPath = validateNetworkPath("duct", points);
      if (!normalizedPath) {
        resetLinearDraft();
        return;
      }
      const duct: DuctNetwork = {
        id: createId("duct"),
        levelId: activeLevelId,
        path: normalizedPath,
        section: { ...DUCT_DEFAULTS.section },
        airflow_m3_s: DUCT_DEFAULTS.airflow_m3_s,
        airVelocity_m_s: DUCT_DEFAULTS.airVelocity_m_s,
        connectedEquipmentIds: getNetworkEndpointConnectionIds({ id: "draft-duct", path: normalizedPath }, equipment, "duct"),
      };
      onAddDuct(duct);
      duct.connectedEquipmentIds.forEach((equipmentId) => {
        const target = equipment.find((item) => item.id === equipmentId);
        if (!target) {
          return;
        }
        const nextNetworkIds = [...new Set([...(target.connectedNetworkIds ?? []), duct.id])];
        onUpdateEquipment(equipmentId, { connectedNetworkIds: nextNetworkIds });
      });
      onSelectionChange({ kind: "duct", id: duct.id });
      resetLinearDraft();
    }

    useEffect(() => {
      finalizeLinearDraftRef.current = finalizeActiveLinearDraft;
    });

    const placeEquipment = (point: Vec2) => {
      if (!activeLevelId) {
        return;
      }
      if (objectPlacementBlocked(point)) {
        notifyError("Оборудование нельзя размещать поверх другого элемента.");
        return;
      }
      const room = rooms.find((entry) => polygonContainsPoint(point, entry.polygon));
      const equipmentItem: Equipment = {
        id: createId("eqp"),
        type: equipmentType,
        levelId: activeLevelId,
        position: point,
        roomId: room?.id ?? null,
        state: "on",
        params: defaultEquipmentParams(equipmentType),
        connectedNetworkIds: [],
      };
      onAddEquipment(equipmentItem);
      onSelectionChange({ kind: "equipment", id: equipmentItem.id });
      onToolChange("select");
    };

    const placeEngineeringEquipment = (point: Vec2) => {
      if (!activeLevelId) {
        return;
      }
      const equipmentItem = createEngineeringEquipmentInstance(engineeringEquipmentType, point, {
        levelId: activeLevelId,
        parameters: engineeringEquipmentVariant ? { variant: engineeringEquipmentVariant } : undefined,
      });
      onAddEngineeringEquipment(equipmentItem);
      setEngineeringPipeDraft(null);
      onSelectionChange({ kind: "engineeringEquipment", id: equipmentItem.id });
      onToolChange("select");
    };

    const handleEngineeringPipePointerDown = (point: Vec2) => {
      if (!activeLevelId) {
        return;
      }
      const targetPort = findEngineeringPortAtPoint(point, engineeringEquipment, 0.28);
      if (!targetPort) {
        return;
      }
      if (!engineeringPipeDraft) {
        setEngineeringPipeDraft({
          fromEquipmentId: targetPort.equipment.id,
          fromPortId: targetPort.port.id,
        });
        onSelectionChange({ kind: "engineeringEquipment", id: targetPort.equipment.id });
        return;
      }

      const fromEquipment = engineeringEquipment.find((item) => item.id === engineeringPipeDraft.fromEquipmentId);
      const fromPort = fromEquipment ? getEngineeringPort(fromEquipment, engineeringPipeDraft.fromPortId) : null;
      if (!fromEquipment || !fromPort) {
        setEngineeringPipeDraft(null);
        return;
      }
      if (fromEquipment.id === targetPort.equipment.id && fromPort.id === targetPort.port.id) {
        setEngineeringPipeDraft(null);
        return;
      }
      if (!areEngineeringPortsCompatible(fromPort, targetPort.port)) {
        notifyError("Порты используют разные среды и не могут быть соединены.");
        return;
      }
      const duplicate = engineeringPipes.some(
        (pipe) =>
          (pipe.fromEquipmentId === fromEquipment.id &&
            pipe.fromPortId === fromPort.id &&
            pipe.toEquipmentId === targetPort.equipment.id &&
            pipe.toPortId === targetPort.port.id) ||
          (pipe.fromEquipmentId === targetPort.equipment.id &&
            pipe.fromPortId === targetPort.port.id &&
            pipe.toEquipmentId === fromEquipment.id &&
            pipe.toPortId === fromPort.id)
      );
      if (duplicate) {
        notifyError("Такое соединение порт-к-порту уже существует.");
        return;
      }
      const pipe = createEngineeringPipeConnection({
        levelId: activeLevelId,
        fromEquipment,
        fromPortId: fromPort.id,
        toEquipment: targetPort.equipment,
        toPortId: targetPort.port.id,
      });
      if (!pipe) {
        notifyError("Не удалось создать инженерное соединение.");
        return;
      }
      onAddEngineeringPipe(pipe);
      setEngineeringPipeDraft(null);
      onSelectionChange({ kind: "engineeringPipe", id: pipe.id });
      onToolChange("select");
    };

    const placeSensor = (point: Vec2) => {
      if (!activeLevelId) {
        return;
      }
      if (objectPlacementBlocked(point)) {
        notifyError("Датчик нельзя размещать поверх другого элемента.");
        return;
      }
      const room = rooms.find((entry) => polygonContainsPoint(point, entry.polygon));
      const sensor: SensorDevice = {
        id: createId("sns"),
        type: SENSOR_DEFAULTS.type,
        levelId: activeLevelId,
        position: point,
        roomId: room?.id ?? null,
        value: room ? 22 : null,
        unit: SENSOR_DEFAULTS.unit,
        status: SENSOR_DEFAULTS.status,
        history: [],
      };
      onAddSensor(sensor);
      onSelectionChange({ kind: "sensor", id: sensor.id });
      onToolChange("select");
    };

    const placeOpening = (point: Vec2, type: "door" | "window") => {
      const hit = findClosestWall(point);
      if (!hit) {
        notifyError("Подведите курсор ближе к стене.");
        return;
      }
      const { wall, offset: projectedCenter, distance, length } = hit;
      if (distance > OPENING_SNAP_DISTANCE) {
        notifyError("Подведите курсор ближе к стене.");
        return;
      }
      if (length < MIN_SEGMENT) {
        notifyError("Стеновой сегмент слишком короткий.");
        return;
      }
      const defaults = type === "door" ? DOOR_DEFAULTS : WINDOW_DEFAULTS;
      const maxOpeningHeight = openingHeightLimitByLevel.get(wall.levelId) ?? wall.height_m;
      const openingHeight = Math.max(0.2, Math.min(defaults.height, maxOpeningHeight));
      const startOffset = clampOpeningOffset(projectedCenter, defaults.width, length);
      if (startOffset == null) {
        notifyError("Проём выходит за границы стены.");
        return;
      }
      if (openingOverlaps(wall, startOffset, defaults.width, doors, windows)) {
        notifyError("Проёмы на стене пересекаются.");
        return;
      }
      const anchor = buildAnchorFromOffset(wall, startOffset);
      if (type === "door") {
        const door: Door = applyEnvelopePresetToDoor<Door>(
          {
            id: createId("door"),
            anchor,
            width_m: defaults.width,
            height_m: openingHeight,
            swingDirection: DOOR_DEFAULTS.swingDirection,
            openingDirection: DOOR_DEFAULTS.openingDirection,
          },
          doorPreset
        );
        onAddDoor(door);
        onSelectionChange({ kind: "door", id: door.id });
      } else {
        const windowData: Window = applyEnvelopePresetToWindow<Window>(
          {
            id: createId("window"),
            anchor,
            width_m: defaults.width,
            height_m: openingHeight,
            sill_m: WINDOW_DEFAULTS.sill,
          },
          windowPreset
        );
        onAddWindow(windowData);
        onSelectionChange({ kind: "window", id: windowData.id });
      }
      onToolChange("select");
    };

    const findClosestWall = (
      point: Vec2
    ): { wall: Wall; offset: number; distance: number; length: number } | null => {
      let closest: { wall: Wall; offset: number; distance: number; length: number } | null = null;
      walls.forEach((wall) => {
        const projection = projectPointOnWall(point, wall);
        if (!projection) {
          return;
        }
        if (closest === null || projection.distance < closest.distance) {
          closest = { wall, offset: projection.center, distance: projection.distance, length: projection.length };
        }
      });
      return closest;
    };

    const projectPointOnWall = (point: Vec2, wall: Wall) => {
      const vec = { x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y };
      const length = Math.hypot(vec.x, vec.y);
      if (length < MIN_SEGMENT) {
        return null;
      }
      const t =
        ((point.x - wall.a.x) * vec.x + (point.y - wall.a.y) * vec.y) / (length * length);
      const clamped = Math.max(0, Math.min(1, t));
      const projection = {
        x: wall.a.x + vec.x * clamped,
        y: wall.a.y + vec.y * clamped,
      };
      const distanceToWall = Math.hypot(point.x - projection.x, point.y - projection.y);
      return { center: clamped * length, distance: distanceToWall, length };
    };

    const hitTest = (point: Vec2): Selection | null => {
      for (const item of engineeringEquipment) {
        if (getEngineeringEquipmentAtPoint(point, item, 0.08)) {
          return { kind: "engineeringEquipment", id: item.id };
        }
      }
      for (const pipe of engineeringPipes) {
        if (isPointNearPolyline(point, pipe.points, 0.16)) {
          return { kind: "engineeringPipe", id: pipe.id };
        }
      }
      for (const sensor of sensors) {
        if (distance(sensor.position, point) < 0.2) {
          return { kind: "sensor", id: sensor.id };
        }
      }
      for (const item of equipment) {
        if (distance(item.position, point) < 0.25) {
          return { kind: "equipment", id: item.id };
        }
      }
      for (const window of windows) {
        const wall = findWallForOpening(window);
        if (wall && isPointNearOpening(point, wall, window)) {
          return { kind: "window", id: window.id };
        }
      }
      for (const door of doors) {
        const wall = findWallForOpening(door);
        if (wall && isPointNearOpening(point, wall, door)) {
          return { kind: "door", id: door.id };
        }
      }
      for (const wall of walls) {
        if (pointToSegmentDistance(point, wall.a, wall.b) < 0.2) {
          return { kind: "wall", id: wall.id };
        }
      }
      for (const roof of roofs) {
        const edges = roof.boundary.map((vertex, index) => [vertex, roof.boundary[(index + 1) % roof.boundary.length]] as const);
        if (edges.some(([a, b]) => pointToSegmentDistance(point, a, b) < 0.2) || isPointInsidePolygon(point, roof.boundary)) {
          return { kind: "roof", id: roof.id };
        }
      }
      for (const slab of floorSlabs) {
        const edges = slab.boundary.map((vertex, index) => [vertex, slab.boundary[(index + 1) % slab.boundary.length]] as const);
        if (edges.some(([a, b]) => pointToSegmentDistance(point, a, b) < 0.2) || isPointInsidePolygon(point, slab.boundary)) {
          return { kind: "slab", id: slab.id };
        }
      }
      for (const stair of stairs) {
        const edges = stair.boundary.map((vertex, index) => [vertex, stair.boundary[(index + 1) % stair.boundary.length]] as const);
        if (edges.some(([a, b]) => pointToSegmentDistance(point, a, b) < 0.2) || isPointInsidePolygon(point, stair.boundary)) {
          return { kind: "stair", id: stair.id };
        }
      }
      for (const pipe of pipes) {
        if (isPointNearPolyline(point, pipe.path, 0.18)) {
          return { kind: "pipe", id: pipe.id };
        }
      }
      for (const duct of ducts) {
        if (isPointNearPolyline(point, duct.path, 0.22)) {
          return { kind: "duct", id: duct.id };
        }
      }
      for (const room of rooms) {
        if (isPointInsidePolygon(point, room.polygon)) {
          return { kind: "room", id: room.id };
        }
      }
      return null;
    };

    const hitOpeningHandle = (point: Vec2): Extract<NonNullable<DragState>, { type: "opening" }> | null => {
      for (const door of doors) {
        const wall = findWallForOpening(door);
        const segment = wall ? getOpeningSegment(wall, door) : null;
        if (segment && distance(segment.center, point) < OPENING_HANDLE_THRESHOLD) {
          return { type: "opening", openingKind: "door", openingId: door.id };
        }
      }
      for (const window of windows) {
        const wall = findWallForOpening(window);
        const segment = wall ? getOpeningSegment(wall, window) : null;
        if (segment && distance(segment.center, point) < OPENING_HANDLE_THRESHOLD) {
          return { type: "opening", openingKind: "window", openingId: window.id };
        }
      }
      return null;
    };

    const getOpeningPreview = (point: Vec2, kind: "door" | "window") => {
        const closest = findClosestWall(point);
        if (!closest) {
          return null;
        }
        const width = kind === "door" ? DOOR_DEFAULTS.width : WINDOW_DEFAULTS.width;
        const offset = clampOpeningOffset(closest.offset, width, closest.length);
        if (offset == null) {
          return null;
        }
        const anchor = buildAnchorFromOffset(closest.wall, offset);
        const opening: Door | Window =
          kind === "door"
            ? { id: "preview", anchor, width_m: width, height_m: DOOR_DEFAULTS.height }
            : { id: "preview", anchor, width_m: width, height_m: WINDOW_DEFAULTS.height, sill_m: WINDOW_DEFAULTS.sill };
        const segment = getOpeningSegment(closest.wall, opening);
        if (!segment) {
          return null;
        }
        return { wall: closest.wall, segment };
    };

    const hitTestVertex = (point: Vec2): DragState | null => {
      for (const room of rooms) {
        if (room.source === "auto") {
          continue;
        }
        const index = room.polygon.findIndex((vertex) => distance(vertex, point) < 0.2);
        if (index !== -1) {
          return { type: "room-vertex", roomId: room.id, vertexIndex: index };
        }
      }
      for (const wall of walls) {
        if (distance(wall.a, point) < 0.2) {
          return { type: "wall-end", wallId: wall.id, end: "a" };
        }
        if (distance(wall.b, point) < 0.2) {
          return { type: "wall-end", wallId: wall.id, end: "b" };
        }
      }
      return null;
    };

    const levelContextSummary = useMemo(() => {
      if (activeLevelIndex < 0) {
        return null;
      }
      const current = orderedLevels[activeLevelIndex];
      return {
        current,
        previous: previousLevel,
        next: nextLevel,
        ordinal: activeLevelIndex + 1,
        total: orderedLevels.length,
      };
    }, [activeLevelIndex, nextLevel, orderedLevels, previousLevel]);

    const scaleLabel = `${(1 / (view.zoom / 100)).toFixed(2)} м ≈ 100 px`;
    const visibleWorld = {
      left: view.origin.x,
      right: view.origin.x + size.width / view.zoom,
      top: view.origin.y,
      bottom: view.origin.y + size.height / view.zoom,
    };
    const selectedOpening =
      selection?.kind === "door"
        ? doors.find((door) => door.id === selection.id)
        : selection?.kind === "window"
        ? windows.find((window) => window.id === selection.id)
        : null;
    const selectedOpeningWall = selectedOpening ? findWallForOpening(selectedOpening) : null;

    const gridStyle = useMemo(
      () => buildGridStyle(view.zoom, gridStep, snapEnabled),
      [view.zoom, gridStep, snapEnabled]
    );

    const rectMetrics = useMemo(() => {
      if (!rectStart || !rectPreview) {
        return null;
      }
      const width = Math.abs(rectPreview.x - rectStart.x);
      const height = Math.abs(rectPreview.y - rectStart.y);
      return {
        width,
        height,
        area: width * height,
        center: {
          x: (rectStart.x + rectPreview.x) / 2,
          y: (rectStart.y + rectPreview.y) / 2,
        },
      };
    }, [rectPreview, rectStart]);

    const draftPolygon = useMemo(() => {
      if (tool !== "room") {
        return null;
      }
      if (draftRoom.length < 2 || !pointerWorld) {
        return null;
      }
      return [...draftRoom, pointerWorld];
    }, [draftRoom, pointerWorld, tool]);

    const draftAreaLabel = useMemo(() => {
      if (!draftPolygon || draftPolygon.length < 3) {
        return null;
      }
      const area = Math.abs(polygonArea(draftPolygon));
      const center = polygonCentroid(draftPolygon);
        return { area, center };
      }, [draftPolygon]);

    const compactOverlay = size.width < 960;
    const narrowOverlay = size.width < 720;

    const networkLegendItems = useMemo(() => {
      const items: Array<{ key: string; label: string; color: string }> = [];
      if (pipes.some((pipe) => (pipe.circuitRole ?? pipe.flowRole) === "supply" || pipe.type === "heating_supply")) {
        items.push({ key: "supply", label: "Подача", color: "#c2410c" });
      }
      if (pipes.some((pipe) => (pipe.circuitRole ?? pipe.flowRole) === "return" || pipe.type === "heating_return")) {
        items.push({ key: "return", label: "Обратка", color: "#2563eb" });
      }
      if (ducts.length > 0) {
        items.push({ key: "duct", label: "Воздуховод", color: "#64748b" });
      }
      if (equipment.length > 0) {
        items.push({ key: "equipment", label: "Оборудование", color: "#7c3aed" });
      }
      if (sensors.length > 0) {
        items.push({ key: "sensor", label: "Датчики", color: "#0ea5e9" });
      }
      return items;
    }, [ducts.length, equipment.length, pipes, sensors.length]);

    const overlayNotices = useMemo(() => {
      const notices: Array<{
        id: string;
        title: string;
        description: string;
        tone: "neutral" | "info" | "warning";
      }> = [];

      if (showSmartOverlay && pipes.length + ducts.length + equipment.length + sensors.length === 0) {
        notices.push({
          id: "no-networks",
          title: "Нет сетей",
          description: "На активном уровне еще нет труб, воздуховодов, оборудования или датчиков.",
          tone: "info",
        });
      }

      if (showSmartOverlay && smartRoomStates.length + smartNetworkStates.length === 0) {
        notices.push({
          id: "no-smart-data",
          title: "Нет результатов сети",
          description: "Инженерная сводка появится после расчета или при наличии сценарных данных.",
          tone: "warning",
        });
      }

      if (showHeatmap && !thermalFrame) {
        notices.push({
          id: "no-thermal-frame",
          title: "Нет температурных данных",
          description: "Запустите теплотехнический расчет, чтобы построить температурное поле на плане.",
          tone: "warning",
        });
      } else if (showHeatmap && thermalFrame && !thermalLegend) {
        notices.push({
          id: "no-thermal-level-data",
          title: "Нет поля для уровня",
          description: "Для текущего уровня не удалось подготовить карту температур.",
          tone: "warning",
        });
      }

      return notices;
    }, [
      ducts.length,
      equipment.length,
      pipes.length,
      rooms.length,
      sensors.length,
      showHeatmap,
      showSmartOverlay,
      smartNetworkStates.length,
      smartRoomStates.length,
      thermalFrame,
      thermalLegend,
    ]);

    const transientBadge = useMemo(() => {
      if (!transientFrame) {
        return null;
      }
      return {
        color: temperatureToColor(
          transientFrame.innerSurfaceTemperature_C,
          transientFrame.minTemperature_C,
          transientFrame.maxTemperature_C
        ),
        label: `t = ${formatNumber(transientFrame.time_s / 3600, { maximumFractionDigits: 2 })} ч, τв = ${formatNumber(
          transientFrame.innerSurfaceTemperature_C,
          { maximumFractionDigits: 1 }
        )} °C`,
      };
    }, [transientFrame]);

    const openingPreview = useMemo(() => {
      if (!pointerWorld) {
        return null;
      }
      if (tool !== "door" && tool !== "window") {
        return null;
      }
      return getOpeningPreview(pointerWorld, tool);
    }, [getOpeningPreview, pointerWorld, tool]);
    const wallPreviewLength = useMemo(() => {
      if (tool !== "wall" || !linearDraft || linearDraft.tool !== "wall" || linearDraft.points.length === 0 || !pointerWorld) {
        return null;
      }
      const from = linearDraft.points[linearDraft.points.length - 1];
      return Math.hypot(pointerWorld.x - from.x, pointerWorld.y - from.y);
    }, [linearDraft, pointerWorld, tool]);

    return (
      <div className="flex h-full min-h-0 min-w-0 max-w-full w-full flex-col overflow-hidden bg-[color:var(--surface-elevated)]">
        <div
          ref={containerRef}
          className="ui-build-canvas-cursor relative h-full min-h-0 min-w-0 w-full max-w-full flex-1 touch-none overflow-hidden overscroll-contain"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onMouseDown={handleMouseDownFallback}
          onMouseMove={handleMouseMoveFallback}
          onMouseUp={handleMouseUpFallback}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(event) => {
            event.preventDefault();
            if (linearDraft) {
              finalizeActiveLinearDraft(linearDraft);
            }
          }}
          style={{
            backgroundImage: gridStyle.image,
            backgroundSize: gridStyle.size,
          }}
        >
          <div className="pointer-events-none absolute inset-0 z-20 flex min-h-0 flex-col justify-between gap-3 p-3">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
                {tool === "roomRect" && rectStart ? (
                  <div className="pointer-events-auto w-full max-w-[320px] sm:max-w-[280px]">
                    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 shadow-lg backdrop-blur">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Размеры помещения</p>
                      <div className={`mt-2 grid gap-2 ${narrowOverlay ? "grid-cols-1" : "grid-cols-1"}`}>
                        <label className="grid gap-1 text-xs text-[color:var(--text-soft)]">
                          Ширина, м
                          <input
                            type="text"
                            value={rectInput.width}
                            onFocus={() => {
                              setRectActiveField("width");
                              setRectInputLocked(true);
                            }}
                            onBlur={() => {
                              if (!rectInput.width.trim() && !rectInput.height.trim() && !rectInput.area.trim()) {
                                setRectInputLocked(false);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") {
                                return;
                              }
                              event.preventDefault();
                              const widthValue = parseLengthInput(rectInput.width);
                              if (widthValue != null && widthValue >= MIN_RECT_SIZE) {
                                setRectActiveField("height");
                              }
                            }}
                            onChange={(event) => {
                              const next = event.target.value;
                              const widthValue = parseLengthInput(next);
                              const heightValue = parseLengthInput(rectInput.height);
                              const nextArea =
                                widthValue != null && heightValue != null ? (widthValue * heightValue).toFixed(2) : rectInput.area;
                              setRectInput((prev) => ({ ...prev, width: next, area: nextArea }));
                              setRectInputLocked(true);
                              updateRectPreviewFromInputs(widthValue, heightValue, rectPreview);
                            }}
                            className={`rounded-lg border px-2 py-1 text-sm text-[color:var(--text-base)] ${
                              rectActiveField === "width"
                                ? "border-[color:var(--accent)] ring-2 ring-[color:var(--accent)]/25"
                                : "border-[color:var(--border-soft)]"
                            }`}
                            placeholder="например, 4.2"
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-[color:var(--text-soft)]">
                          Длина, м
                          <input
                            type="text"
                            value={rectInput.height}
                            onFocus={() => {
                              setRectActiveField("height");
                              setRectInputLocked(true);
                            }}
                            onBlur={() => {
                              if (!rectInput.width.trim() && !rectInput.height.trim() && !rectInput.area.trim()) {
                                setRectInputLocked(false);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") {
                                return;
                              }
                              event.preventDefault();
                              const widthValue = parseLengthInput(rectInput.width);
                              const heightValue = parseLengthInput(rectInput.height);
                              if (
                                widthValue != null &&
                                heightValue != null &&
                                widthValue >= MIN_RECT_SIZE &&
                                heightValue >= MIN_RECT_SIZE &&
                                rectStart
                              ) {
                                finalizeRectangleShape(
                                  rectStart,
                                  buildRectEndFromInputs(rectStart, widthValue, heightValue),
                                  "roomRect"
                                );
                                clearRectDraft();
                                return;
                              }
                              if (heightValue != null && heightValue >= MIN_RECT_SIZE) {
                                setRectActiveField("area");
                              }
                            }}
                            onChange={(event) => {
                              const next = event.target.value;
                              const heightValue = parseLengthInput(next);
                              const widthValue = parseLengthInput(rectInput.width);
                              const nextArea =
                                widthValue != null && heightValue != null ? (widthValue * heightValue).toFixed(2) : rectInput.area;
                              setRectInput((prev) => ({ ...prev, height: next, area: nextArea }));
                              setRectInputLocked(true);
                              updateRectPreviewFromInputs(widthValue, heightValue, rectPreview);
                            }}
                            className={`rounded-lg border px-2 py-1 text-sm text-[color:var(--text-base)] ${
                              rectActiveField === "height"
                                ? "border-[color:var(--accent)] ring-2 ring-[color:var(--accent)]/25"
                                : "border-[color:var(--border-soft)]"
                            }`}
                            placeholder="например, 3.5"
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-[color:var(--text-soft)]">
                          Площадь, м²
                          <input
                            type="text"
                            value={rectInput.area}
                            onFocus={() => {
                              setRectActiveField("area");
                              setRectInputLocked(true);
                            }}
                            onBlur={() => {
                              if (!rectInput.width.trim() && !rectInput.height.trim() && !rectInput.area.trim()) {
                                setRectInputLocked(false);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") {
                                return;
                              }
                              event.preventDefault();
                              setRectActiveField("width");
                            }}
                            onChange={(event) => {
                              const next = event.target.value;
                              const areaValue = parseLengthInput(next);
                              const widthValue = parseLengthInput(rectInput.width);
                              const heightValue = parseLengthInput(rectInput.height);
                              let nextWidth = rectInput.width;
                              let nextHeight = rectInput.height;
                              if (areaValue != null && widthValue != null && widthValue > 0) {
                                nextHeight = (areaValue / widthValue).toFixed(2);
                              } else if (areaValue != null && heightValue != null && heightValue > 0) {
                                nextWidth = (areaValue / heightValue).toFixed(2);
                              }
                              setRectInput({ width: nextWidth, height: nextHeight, area: next });
                              setRectInputLocked(true);
                              updateRectPreviewFromInputs(parseLengthInput(nextWidth), parseLengthInput(nextHeight), rectPreview);
                            }}
                            className={`rounded-lg border px-2 py-1 text-sm text-[color:var(--text-base)] ${
                              rectActiveField === "area"
                                ? "border-[color:var(--accent)] ring-2 ring-[color:var(--accent)]/25"
                                : "border-[color:var(--border-soft)]"
                            }`}
                            placeholder="например, 18"
                          />
                        </label>
                      </div>
                      <div className="mt-2 text-xs text-[color:var(--text-soft)]">
                        Площадь:{" "}
                        <span className="font-semibold text-[color:var(--text-base)]">
                          {rectMetrics ? formatArea(rectMetrics.area) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
                {tool === "wall" && linearDraft?.tool === "wall" && linearDraft.points.length > 0 ? (
                  <div className="pointer-events-auto w-full max-w-[280px] sm:max-w-[240px]">
                    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 shadow-lg backdrop-blur">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Сегмент стены</p>
                      <label className="mt-2 grid gap-1 text-xs text-[color:var(--text-soft)]">
                        Длина, м
                        <input
                          type="text"
                          value={wallLengthInput}
                          onChange={(event) => setWallLengthInput(event.target.value)}
                          className="rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-sm text-[color:var(--text-base)]"
                          placeholder="например, 4.2"
                        />
                      </label>
                      <div className="mt-2 text-xs text-[color:var(--text-soft)]">
                        Фактическая длина:{" "}
                        <span className="font-semibold text-[color:var(--text-base)]">
                          {wallPreviewLength != null ? `${wallPreviewLength.toFixed(2)} м` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

              </div>

              {/* Контекст уровней скрыт по запросу: без плашек "этаж/выше/ниже". */}
            </div>

            <div className="flex min-w-0 flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                {thermalLegend ? (
                  <HeatmapLegend
                    minTemperatureC={thermalLegend.min}
                    maxTemperatureC={thermalLegend.max}
                    synthetic={thermalLegend.synthetic}
                    compact={compactOverlay}
                  />
                ) : null}
                {transientFrame ? (
                  <TransientLegendOverlay
                    innerSurfaceTemperature_C={transientFrame.innerSurfaceTemperature_C}
                    stable={transientFrame.stable}
                    compact={compactOverlay}
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 justify-start sm:justify-end">
                <NetworkLegendOverlay
                  items={networkLegendItems}
                  compact={compactOverlay}
                  show={showSmartOverlay && networkLegendItems.length > 0}
                />
              </div>
            </div>
            {networkHoverCard ? (
              <NetworkHoverOverlay card={networkHoverCard} containerSize={size} compact={compactOverlay} />
            ) : null}
          </div>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-full w-full max-w-full"
          >
            <g>
              {guides.vertical != null && (
                <GuideLine
                  orientation="vertical"
                  value={guides.vertical}
                  worldBounds={visibleWorld}
                  worldToScreen={worldToScreen}
                />
              )}
              {guides.horizontal != null && (
                <GuideLine
                  orientation="horizontal"
                  value={guides.horizontal}
                  worldBounds={visibleWorld}
                  worldToScreen={worldToScreen}
                />
              )}
              {contextRooms.map(({ room, relation }) => (
                <ContextRoomPolygon
                  key={`context-room-${relation}-${room.id}`}
                  room={room}
                  relation={relation}
                  worldToScreen={worldToScreen}
                />
              ))}
              {contextWalls.map(({ wall, relation }) => (
                <ContextWallSegment
                  key={`context-wall-${relation}-${wall.id}`}
                  wall={wall}
                  relation={relation}
                  worldToScreen={worldToScreen}
                />
              ))}
              {showHeatmap &&
                thermalField &&
                rooms.map((room) => {
                  if (!thermalField.roomMap.has(room.id)) {
                    return null;
                  }
                  return (
                    <RoomHeatmapOverlay
                      key={`heatmap-${room.id}`}
                      room={room}
                      field={thermalField}
                      worldToScreen={worldToScreen}
                    />
                  );
                })}
              {floorSlabs.map((slab) => (
                <PlanSurfacePolygon
                  key={slab.id}
                  points={slab.boundary}
                  worldToScreen={worldToScreen}
                  selected={isSelected("slab", slab.id)}
                  label={slab.name}
                  fill={
                    transientSourceMatches(transientFrame, "slab", slab.id) && transientBadge
                      ? transientBadge.color
                      : "rgba(59,130,246,0.08)"
                  }
                  stroke={transientSourceMatches(transientFrame, "slab", slab.id) ? "#0f172a" : "#2563eb"}
                  strokeDasharray={slab.kind === "ground" ? "10 4" : slab.kind === "attic" ? "4 4" : slab.kind === "basement" ? "2 6" : undefined}
                  badgeText={transientSourceMatches(transientFrame, "slab", slab.id) ? transientBadge?.label : undefined}
                  unstable={transientSourceMatches(transientFrame, "slab", slab.id) ? !transientFrame?.stable : false}
                />
              ))}
              {roofs.map((roof) => (
                <PlanSurfacePolygon
                  key={roof.id}
                  points={roof.boundary}
                  worldToScreen={worldToScreen}
                  selected={isSelected("roof", roof.id)}
                  label={roof.name}
                  fill={
                    transientSourceMatches(transientFrame, "roof", roof.id) && transientBadge
                      ? transientBadge.color
                      : roof.kind === "flat"
                        ? "rgba(245,158,11,0.12)"
                        : "rgba(245,158,11,0.04)"
                  }
                  stroke={transientSourceMatches(transientFrame, "roof", roof.id) ? "#0f172a" : "#d97706"}
                  hatch={roof.kind === "flat"}
                  arrow={roof.kind === "pitched" ? roof.slope : undefined}
                  badgeText={transientSourceMatches(transientFrame, "roof", roof.id) ? transientBadge?.label : undefined}
                  unstable={transientSourceMatches(transientFrame, "roof", roof.id) ? !transientFrame?.stable : false}
                />
              ))}
              {stairs.map((stair) => (
                <PlanStair
                  key={stair.id}
                  stair={stair}
                  worldToScreen={worldToScreen}
                  selected={isSelected("stair", stair.id)}
                />
              ))}
              {rooms.map((room) => (
                <RoomPolygon
                  key={room.id}
                  room={room}
                  worldToScreen={worldToScreen}
                  screenToWorld={screenToWorld}
                  scale={view.zoom}
                  selected={isSelected("room", room.id)}
                  compactLabels={showSmartOverlay}
                  suppressPlanLabel={showSmartOverlay}
                  obstacles={roomLabelObstacles}
                  schematicMode={engineeringOverlayActive}
                  exportMode={exportMode}
                />
              ))}
              {levelLoops.map((loop) => (
                <LoopOverlay
                  key={loop.id}
                  loop={loop}
                  worldToScreen={worldToScreen}
                  selected={isSelected("loop", loop.id)}
                  hovered={hoverLoopId === loop.id}
                />
              ))}
              {loopDebug &&
                levelLoops.map((loop) => (
                  <LoopDebugMarkers key={`${loop.id}-debug`} loop={loop} worldToScreen={worldToScreen} />
                ))}
              {rectMetrics && (
                <g pointerEvents="none">
                  {(() => {
                    const labelPos = worldToScreen(rectMetrics.center);
                    return (
                      <>
                        <rect
                          x={labelPos.x - 46}
                          y={labelPos.y - 18}
                          width={92}
                          height={18}
                          rx={6}
                          fill="rgba(15,23,42,0.78)"
                        />
                        <text x={labelPos.x} y={labelPos.y - 5} textAnchor="middle" fill="#f8fafc" fontSize={10}>
                          {formatArea(rectMetrics.area)}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
              {draftRoom.length > 1 && (
                <RoomDraft
                  points={draftRoom}
                  previewPoint={pointerWorld ?? undefined}
                  worldToScreen={worldToScreen}
                />
              )}
              {draftAreaLabel && (
                <g pointerEvents="none">
                  {(() => {
                    const labelPos = worldToScreen(draftAreaLabel.center);
                    return (
                      <>
                        <rect
                          x={labelPos.x - 46}
                          y={labelPos.y - 18}
                          width={92}
                          height={18}
                          rx={6}
                          fill="rgba(15,23,42,0.78)"
                        />
                        <text x={labelPos.x} y={labelPos.y - 5} textAnchor="middle" fill="#f8fafc" fontSize={10}>
                          {formatArea(draftAreaLabel.area)}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
              {walls.map((wall) => (
                <WallSegment
                  key={wall.id}
                  wall={wall}
                  walls={walls}
                  worldToScreen={worldToScreen}
                  selected={isSelected("wall", wall.id)}
                  schematicMode={engineeringOverlayActive}
                  exportMode={exportMode}
                  transientHighlight={
                    transientSourceMatches(transientFrame, "wall", wall.id) && transientBadge
                      ? {
                          color: transientBadge.color,
                          badgeText: transientBadge.label,
                          unstable: !(transientFrame?.stable ?? true),
                        }
                      : null
                  }
                />
              ))}
              {openingPreview && (
                <g pointerEvents="none" opacity={0.65}>
                  {(() => {
                    const start = worldToScreen(openingPreview.segment.start);
                    const end = worldToScreen(openingPreview.segment.end);
                    const center = worldToScreen(openingPreview.segment.center);
                    return (
                      <>
                        <line
                          x1={start.x}
                          y1={start.y}
                          x2={end.x}
                          y2={end.y}
                          stroke={tool === "door" ? "#0ea5e9" : "#8b5cf6"}
                          strokeWidth={6}
                          strokeLinecap="round"
                          strokeDasharray="6 6"
                        />
                        <circle cx={center.x} cy={center.y} r={4} fill="#0f172a" />
                      </>
                    );
                  })()}
                </g>
              )}
              {pipes.map((pipe) => (
                (() => {
                  const anchoredPath = (() => {
                    if (pipe.path.length < 2 || pipe.connectedEquipmentIds.length === 0) {
                      // Продолжим ниже через proximity-fallback.
                    }
                    const connectedCandidates = equipment
                      .filter((item) => pipe.connectedEquipmentIds.includes(item.id))
                      .flatMap((item) =>
                        getEquipmentConnectionPoints(item)
                          .filter(connectionPointSupportsPipe)
                          .map((point) => ({
                            equipmentId: item.id,
                            equipmentType: item.type,
                            equipmentPosition: item.position,
                            pointRole: point.role,
                            position: point.position,
                          }))
                      );
                    const allCandidates = equipment.flatMap((item) =>
                      getEquipmentConnectionPoints(item)
                        .filter(connectionPointSupportsPipe)
                        .map((point) => ({
                          equipmentId: item.id,
                          equipmentType: item.type,
                          equipmentPosition: item.position,
                          pointRole: point.role,
                          position: point.position,
                        }))
                    );
                    const candidatePool = connectedCandidates.length > 0 ? connectedCandidates : allCandidates;
                    if (candidatePool.length === 0) {
                      return pipe.path;
                    }

                    const nearestTo = (
                      target: Vec2,
                      source: Array<{
                        equipmentId: string;
                        equipmentType: Equipment["type"];
                        equipmentPosition: Vec2;
                        pointRole: ConnectionPointRole;
                        position: Vec2;
                      }>,
                      excludePointKey?: string
                    ) => {
                      let nearest: {
                        equipmentId: string;
                        equipmentType: Equipment["type"];
                        equipmentPosition: Vec2;
                        pointRole: ConnectionPointRole;
                        position: Vec2;
                        pointKey: string;
                        dist: number;
                      } | null = null;
                      source.forEach((candidate) => {
                        const pointKey = `${candidate.equipmentId}:${candidate.pointRole}:${candidate.position.x.toFixed(6)}:${candidate.position.y.toFixed(6)}`;
                        if (excludePointKey && pointKey === excludePointKey) {
                          return;
                        }
                        const dist = Math.hypot(target.x - candidate.position.x, target.y - candidate.position.y);
                        if (!nearest || dist < nearest.dist) {
                          nearest = { ...candidate, pointKey, dist };
                        }
                      });
                      return nearest;
                    };

                    const firstConnected = nearestTo(pipe.path[0], connectedCandidates);
                    const lastConnected =
                      nearestTo(pipe.path[pipe.path.length - 1], connectedCandidates, firstConnected?.pointKey) ??
                      nearestTo(pipe.path[pipe.path.length - 1], connectedCandidates);

                    // Если сеть ещё не "привязана" логически, подхватываем ближайшие точки по расстоянию.
                    const firstFallback = nearestTo(pipe.path[0], allCandidates);
                    const lastFallback =
                      nearestTo(pipe.path[pipe.path.length - 1], allCandidates, firstFallback?.pointKey) ??
                      nearestTo(pipe.path[pipe.path.length - 1], allCandidates);

                    const snapDistance = Number.POSITIVE_INFINITY;
                    const first =
                      firstConnected ??
                      (firstFallback && firstFallback.dist <= snapDistance ? firstFallback : null);
                    const last =
                      lastConnected ??
                      (lastFallback && lastFallback.dist <= snapDistance ? lastFallback : null);
                    if (!first || !last) {
                      return pipe.path;
                    }

                    const lockToDirtSeparator = (endpoint: Vec2, current: typeof first) => {
                      if (current.equipmentType !== "dirt_separator") {
                        return current;
                      }
                      const sameEquipmentPoints = candidatePool.filter(
                        (candidate) =>
                          candidate.equipmentId === current.equipmentId &&
                          (candidate.pointRole === "flowIn" || candidate.pointRole === "flowOut")
                      );
                      if (sameEquipmentPoints.length < 2) {
                        return current;
                      }
                      const leftPort = sameEquipmentPoints.find((candidate) => candidate.pointRole === "flowIn");
                      const rightPort = sameEquipmentPoints.find((candidate) => candidate.pointRole === "flowOut");
                      if (!leftPort || !rightPort) {
                        return current;
                      }
                      return endpoint.x <= current.equipmentPosition.x
                        ? { ...leftPort, dist: Math.hypot(endpoint.x - leftPort.position.x, endpoint.y - leftPort.position.y) }
                        : { ...rightPort, dist: Math.hypot(endpoint.x - rightPort.position.x, endpoint.y - rightPort.position.y) };
                    };

                    const firstLocked = lockToDirtSeparator(pipe.path[0], first);
                    const lastLocked = lockToDirtSeparator(pipe.path[pipe.path.length - 1], last);

                    const next = pipe.path.map((point) => ({ ...point }));
                    next[0] = { ...firstLocked.position };
                    next[next.length - 1] = { ...lastLocked.position };
                    return next;
                  })();

                  const hovered = networkHoverCard?.selection.kind === "pipe" && networkHoverCard.selection.id === pipe.id;
                  const style = getPipeVisualStyle(pipe, {
                    selected: isSelected("pipe", pipe.id),
                    showFlowArrows: showNetworkFlowArrows,
                  });
                  const displayState = pipeDisplayState.get(pipe.id);
                  const display: {
                    color: string;
                    strokeWidth: number;
                    label: string;
                    info: string;
                    dashArray?: string;
                  } = displayState
                    ? {
                        color: displayState.color,
                        strokeWidth: displayState.strokeWidth,
                        label: displayState.label,
                        info: "info" in displayState && typeof displayState.info === "string" ? displayState.info : "",
                        dashArray:
                          "dashArray" in displayState && typeof displayState.dashArray === "string"
                            ? displayState.dashArray
                            : undefined,
                      }
                    : {
                        color: style.stroke,
                        strokeWidth: style.strokeWidth,
                        dashArray: style.dashArray ?? undefined,
                        info: style.info ?? "",
                        label: PIPE_TYPE_LABELS[pipe.type],
                      };
                  // Для подключённых труб отключаем параллельный визуальный сдвиг:
                  // иначе концы линии уезжают от портов оборудования.
                  const renderOffset =
                    (pipe.connectedEquipmentIds?.length ?? 0) > 0 ? 0 : (networkRenderOffsets[pipe.id] ?? 0);
                  return (
                    <React.Fragment key={pipe.id}>
                      <NetworkPolyline
                        id={pipe.id}
                        kind="pipe"
                        path={anchoredPath}
                        color={display.color}
                        label={display.label}
                        info={display.info ?? ""}
                        dashArray={display.dashArray ?? undefined}
                        strokeWidth={display.strokeWidth}
                        worldToScreen={worldToScreen}
                        offsetPx={renderOffset}
                        selected={isSelected("pipe", pipe.id)}
                        hovered={hovered}
                        schematicMode={engineeringOverlayActive}
                        monochrome={monochromeSchematic}
                        calloutMode={showSmartOverlay && engineeringOverlayActive ? "always" : "hover"}
                        flowRole={pipe.circuitRole ?? pipe.flowRole ?? "distribution"}
                        secondaryLabel={`${Math.round(pipe.diameter_mm)} мм`}
                        exportMode={exportMode}
                      />
                      {style.arrowEnabled || engineeringOverlayActive ? (
                        <NetworkFlowOverlay
                          path={anchoredPath}
                          color={display.color}
                          kind="pipe"
                          magnitude={Math.max(pipe.flowRate_kg_s, 0.05)}
                          direction={style.arrowDirection}
                          worldToScreen={worldToScreen}
                        offsetPx={renderOffset}
                          emphasized={isSelected("pipe", pipe.id) || hovered}
                          schematicMode={engineeringOverlayActive}
                          monochrome={monochromeSchematic}
                        />
                      ) : null}
                    </React.Fragment>
                  );
                })()
              ))}
              {ducts.map((duct) => (
                <NetworkPolyline
                  key={duct.id}
                  id={duct.id}
                  kind="duct"
                  path={duct.path}
                  color="#64748b"
                  label="Воздуховод"
                  worldToScreen={worldToScreen}
                  offsetPx={networkRenderOffsets[duct.id] ?? 0}
                  selected={isSelected("duct", duct.id)}
                  hovered={networkHoverCard?.selection.kind === "duct" && networkHoverCard.selection.id === duct.id}
                  schematicMode={engineeringOverlayActive}
                  monochrome={monochromeSchematic}
                  calloutMode={showSmartOverlay && engineeringOverlayActive ? "always" : "hover"}
                  exportMode={exportMode}
                />
              ))}
              {showSmartOverlay &&
                smartNetworkStates.filter((network) => network.kind !== "pipe").map((network) => (
                  <NetworkFlowOverlay
                    key={`flow-${network.networkId}`}
                    path={network.path}
                    color={network.color}
                    kind={network.kind}
                    magnitude={network.magnitude}
                    direction="forward"
                    worldToScreen={worldToScreen}
                    offsetPx={networkRenderOffsets[network.networkId] ?? 0}
                  />
                ))}
              {showSmartOverlay &&
                pipeEquipmentLinks.map((link) => (
                  <EquipmentConnectionOverlay
                    key={link.id}
                    from={link.from}
                    to={link.to}
                    color={link.color}
                    worldToScreen={worldToScreen}
                  />
                ))}
              {engineeringOverlayActive &&
                !exportMode &&
                equipmentConnectionPoints
                  .filter((entry) => {
                    if (tool === "pipe") {
                      return entry.point.medium === "pipe";
                    }
                    if (tool === "duct") {
                      return entry.point.medium === "duct";
                    }
                    return selection?.kind === "equipment" ? selection.id === entry.equipmentId : multiSelection.some(s => s.kind === "equipment" && s.id === entry.equipmentId);
                  })
                  .map((entry) => (
                    <ConnectionPointOverlay
                      key={entry.point.id}
                      point={entry.point}
                      worldToScreen={worldToScreen}
                      monochrome={monochromeSchematic}
                    />
                  ))}
              {engineeringPipes.map((pipe) => {
                const screenPoints = pipe.points.map((point) => worldToScreen(point));
                const style = ENGINEERING_MEDIUM_STYLES[pipe.medium];
                const selectedPipe = isSelected("engineeringPipe", pipe.id);
                const labelPoint = pipe.points[Math.max(0, Math.floor(pipe.points.length / 2))] ?? pipe.points[0];
                const label = labelPoint ? worldToScreen(labelPoint) : null;
                return (
                  <g key={pipe.id}>
                    <polyline
                      points={screenPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                      fill="none"
                      stroke={style.outline}
                      strokeWidth={style.width + (selectedPipe ? 5 : 3)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points={screenPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                      fill="none"
                      stroke={selectedPipe ? "var(--accent-base)" : style.stroke}
                      strokeWidth={style.width + (selectedPipe ? 0.8 : 0)}
                      strokeDasharray={style.dashArray}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {!exportMode && label ? (
                      <g pointerEvents="none" opacity={selectedPipe || view.zoom > 34 ? 1 : 0.82}>
                        <rect
                          x={label.x - 38}
                          y={label.y - 20}
                          width={76}
                          height={16}
                          rx={8}
                          fill="color-mix(in srgb, var(--surface-base) 92%, transparent)"
                          stroke="color-mix(in srgb, var(--border-soft) 72%, transparent)"
                        />
                        <text
                          x={label.x}
                          y={label.y - 8}
                          textAnchor="middle"
                          className="fill-[color:var(--text-muted)] text-[10px] font-semibold"
                        >
                          {`${ENGINEERING_MEDIUM_LABELS[pipe.medium]} • ${Math.round(pipe.diameter)}`}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
              {engineeringPipePreview && engineeringPipePreview.points.length > 1 ? (
                <g pointerEvents="none">
                  {(() => {
                    const stroke = engineeringPipePreview.compatible
                      ? ENGINEERING_MEDIUM_STYLES[engineeringPipePreview.fromPort.medium].stroke
                      : "#dc2626";
                    const dashArray = engineeringPipePreview.compatible ? "8 5" : "4 4";
                    return (
                      <polyline
                        points={engineeringPipePreview.points.map((point) => {
                          const screen = worldToScreen(point);
                          return `${screen.x},${screen.y}`;
                        }).join(" ")}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={3}
                        strokeDasharray={dashArray}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })()}
                </g>
              ) : null}
              {engineeringEquipment.map((item) => {
                const center = worldToScreen({ x: item.x, y: item.y });
                const selectedEquipment = isSelected("engineeringEquipment", item.id);
                const hoveredEquipment = hoveredEngineeringEquipmentId === item.id;
                const pumpFlowRotation =
                  item.type === "pump"
                    ? (() => {
                        const outgoing = engineeringPipes.find(
                          (pipe) => pipe.fromEquipmentId === item.id && pipe.points.length >= 2
                        );
                        if (outgoing) {
                          const from = outgoing.points[0];
                          const to = outgoing.points[1];
                          const dx = to.x - from.x;
                          const dy = to.y - from.y;
                          if (Math.hypot(dx, dy) > 1e-6) {
                            return (Math.atan2(dy, dx) * 180) / Math.PI;
                          }
                        }
                        const incoming = engineeringPipes.find(
                          (pipe) => pipe.toEquipmentId === item.id && pipe.points.length >= 2
                        );
                        if (incoming) {
                          const from = incoming.points[incoming.points.length - 2];
                          const to = incoming.points[incoming.points.length - 1];
                          const dx = to.x - from.x;
                          const dy = to.y - from.y;
                          if (Math.hypot(dx, dy) > 1e-6) {
                            return (Math.atan2(dy, dx) * 180) / Math.PI;
                          }
                        }
                        return item.rotation;
                      })()
                    : item.rotation;
                const showPorts =
                  !exportMode &&
                  (selectedEquipment ||
                    hoveredEquipment ||
                    tool === "engineeringPipe" ||
                    engineeringPipeDraft?.fromEquipmentId === item.id);
                return (
                  <g key={item.id}>
                    {renderEngineeringEquipmentSymbol(
                      {
                        type: item.type,
                        rotation: pumpFlowRotation,
                        width: item.width * view.zoom,
                        height: item.height * view.zoom,
                        parameters: item.parameters,
                      },
                      center,
                      { selected: selectedEquipment, hovered: hoveredEquipment }
                    )}
                    {!exportMode && item.name ? (
                      <g pointerEvents="none">
                        <rect
                          x={center.x - 52}
                          y={center.y + Math.max(16, (item.height * view.zoom) / 2 + 10)}
                          width={104}
                          height={18}
                          rx={9}
                          fill="color-mix(in srgb, var(--surface-base) 92%, transparent)"
                          stroke="color-mix(in srgb, var(--border-soft) 72%, transparent)"
                        />
                        <text
                          x={center.x}
                          y={center.y + Math.max(28, (item.height * view.zoom) / 2 + 22)}
                          textAnchor="middle"
                          className="fill-[color:var(--text-base)] text-[10px] font-semibold"
                        >
                          {item.name}
                        </text>
                      </g>
                    ) : null}
                    {showPorts
                      ? item.ports.map((port) => {
                          const worldPort = getEngineeringPortWorldPosition(item, port);
                          const screenPort = worldToScreen(worldPort);
                          const style = ENGINEERING_MEDIUM_STYLES[port.medium];
                          const activePort =
                            engineeringPipeDraft?.fromEquipmentId === item.id && engineeringPipeDraft.fromPortId === port.id;
                          return (
                            <g key={`${item.id}:${port.id}`} pointerEvents="none">
                              <circle
                                cx={screenPort.x}
                                cy={screenPort.y}
                                r={activePort ? 6.6 : 5.2}
                                fill={style.outline}
                                stroke={activePort ? "var(--accent-base)" : style.stroke}
                                strokeWidth={activePort ? 2.2 : 1.6}
                              />
                              <circle cx={screenPort.x} cy={screenPort.y} r={2.1} fill={style.stroke} />
                            </g>
                          );
                        })
                      : null}
                  </g>
                );
              })}
              {tool === "engineeringEquipment" && pointerWorld ? (
                <g pointerEvents="none" opacity={0.72}>
                  {(() => {
                    const preview = createEngineeringEquipmentInstance(engineeringEquipmentType, pointerWorld, {
                      id: "engineering-preview",
                      levelId: activeLevelId,
                      parameters: engineeringEquipmentVariant ? { variant: engineeringEquipmentVariant } : undefined,
                    });
                    return renderEngineeringEquipmentSymbol(
                      {
                        type: preview.type,
                        rotation: preview.rotation,
                        width: preview.width * view.zoom,
                        height: preview.height * view.zoom,
                      },
                      worldToScreen(pointerWorld),
                      { preview: true }
                    );
                  })()}
                  <text
                    x={worldToScreen(pointerWorld).x + 18}
                    y={worldToScreen(pointerWorld).y + 4}
                    className="fill-[color:var(--text-muted)] text-[10px] font-semibold"
                  >
                    {ENGINEERING_EQUIPMENT_LABELS[engineeringEquipmentType]}
                  </text>
                </g>
              ) : null}
              {equipment.map((item) => (
                <EquipmentMarker
                  key={item.id}
                  item={item}
                  worldToScreen={worldToScreen}
                  selected={isSelected("equipment", item.id)}
                  hovered={networkHoverCard?.selection.kind === "equipment" && networkHoverCard.selection.id === item.id}
                  diagnostics={engineeringDiagnosticsByTarget.get(`equipment:${item.id}`) ?? []}
                  schematicMode={engineeringOverlayActive}
                  monochrome={monochromeSchematic}
                  annotationMode={showSmartOverlay && engineeringOverlayActive ? "always" : "hover"}
                  exportMode={exportMode}
                />
              ))}
              {tool === "equipment" && pointerWorld && (
                <g pointerEvents="none" opacity={0.52}>
                  {(() => {
                    const point = worldToScreen(pointerWorld);
                    return (
                      <>
                        <rect
                          x={point.x - 8}
                          y={point.y - 8}
                          width={16}
                          height={16}
                          rx={4}
                          fill="#7c3aed"
                          stroke="#5b21b6"
                          strokeWidth={1.2}
                          strokeDasharray="4 3"
                        />
                        <text x={point.x + 12} y={point.y + 4} className="fill-[color:var(--text-muted)] text-[10px] font-semibold">
                          {EQUIPMENT_TYPE_LABELS[equipmentType]}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
              {sensors.map((sensor) => (
                <SensorMarker
                  key={sensor.id}
                  sensor={sensor}
                  worldToScreen={worldToScreen}
                  selected={isSelected("sensor", sensor.id)}
                  hovered={networkHoverCard?.selection.kind === "sensor" && networkHoverCard.selection.id === sensor.id}
                  schematicMode={engineeringOverlayActive}
                  monochrome={monochromeSchematic}
                  exportMode={exportMode}
                />
              ))}
              {tool === "sensor" && pointerWorld && (
                <g pointerEvents="none" opacity={0.52}>
                  {(() => {
                    const point = worldToScreen(pointerWorld);
                    return (
                      <>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={6}
                          fill="#0ea5e9"
                          stroke="#0369a1"
                          strokeWidth={1.2}
                          strokeDasharray="4 3"
                        />
                        <text x={point.x + 10} y={point.y + 4} className="fill-[color:var(--text-muted)] text-[10px] font-semibold">
                          {SENSOR_TYPE_LABELS.temperature}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
              {(showSmartOverlay || engineeringOverlayActive) &&
                !exportMode &&
                smartRoomStates.map((roomState) => {
                  const room = rooms.find((item) => item.id === roomState.roomId);
                  if (!room) {
                    return null;
                  }
                  return (
                    <RoomStateOverlay
                      key={`room-state-${room.id}`}
                      room={room}
                      state={roomState}
                      worldToScreen={worldToScreen}
                      schematicMode={engineeringOverlayActive}
                    />
                  );
                })}
              {engineeringOverlayActive &&
                !exportMode &&
                engineeringDiagnostics.map((issue) => (
                  <EngineeringDiagnosticMarker
                    key={issue.id}
                    diagnostic={issue}
                    worldToScreen={worldToScreen}
                    monochrome={monochromeSchematic}
                  />
                ))}
              {doors.map((door) => {
                const wall = findWallForOpening(door);
                if (!wall) {
                  return null;
                }
                const openingData =
                  openingDraft && openingDraft.kind === "door" && openingDraft.id === door.id
                    ? { ...door, anchor: buildAnchorFromOffset(wall, openingDraft.offset) }
                    : door;
                return (
                  <Opening
                    key={door.id}
                    opening={openingData}
                    wall={wall}
                    worldToScreen={worldToScreen}
                    color="#f97316"
                    selected={isSelected("door", door.id)}
                    kind="door"
                  />
                );
              })}
              {windows.map((window) => {
                const wall = findWallForOpening(window);
                if (!wall) {
                  return null;
                }
                const openingData =
                  openingDraft && openingDraft.kind === "window" && openingDraft.id === window.id
                    ? { ...window, anchor: buildAnchorFromOffset(wall, openingDraft.offset) }
                    : window;
                return (
                  <Opening
                    key={window.id}
                    opening={openingData}
                    wall={wall}
                    worldToScreen={worldToScreen}
                    color="#0ea5e9"
                    selected={isSelected("window", window.id)}
                    kind="window"
                  />
                );
              })}
              {selectedOpening && selectedOpeningWall && (
                <DimensionLabel
                  key={`dim-${selectedOpening.id}`}
                  opening={selectedOpening}
                  wall={selectedOpeningWall}
                  worldToScreen={worldToScreen}
                />
              )}
              {linearDraft && linearDraft.points.length > 0 && linearDraft.tool === "wall" && (
                <NetworkDraft
                  kind="wall"
                  points={linearDraft.points}
                  previewPoint={pointerWorld ?? undefined}
                  color="#0f172a"
                  worldToScreen={worldToScreen}
                />
              )}
              {linearDraft && linearDraft.tool === "pipe" && linearDraft.points.length > 0 && (
                <NetworkDraft
                  kind="pipe"
                  points={linearDraft.points}
                  previewPoint={pointerWorld ?? undefined}
                  color={PIPE_TYPE_COLORS[pipeType]}
                  worldToScreen={worldToScreen}
                />
              )}
              {linearDraft && linearDraft.tool === "duct" && linearDraft.points.length > 0 && (
                <NetworkDraft
                  kind="duct"
                  points={linearDraft.points}
                  previewPoint={pointerWorld ?? undefined}
                  color="#64748b"
                  worldToScreen={worldToScreen}
                />
              )}
              {adjacencyOverlay &&
                neighborEdges.map((edge) => {
                  const a = centroids[edge.roomA];
                  const b = centroids[edge.roomB];
                  if (!a || !b) {
                    return null;
                  }
                  const screenA = worldToScreen(a);
                  const screenB = worldToScreen(b);
                  return (
                    <line
                      key={`${edge.wallId}-${edge.roomA}-${edge.roomB}`}
                      x1={screenA.x}
                      y1={screenA.y}
                      x2={screenB.x}
                      y2={screenB.y}
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      opacity={0.6}
                    />
                  );
                })}
              {rectStart && rectPreview && (
                <RectDraft start={rectStart} end={rectPreview} worldToScreen={worldToScreen} />
              )}
              {dragState?.type === "erase-area" && (
                <RectDraft
                  start={dragState.start}
                  end={dragState.end}
                  worldToScreen={worldToScreen}
                  variant="danger"
                />
              )}
              {dragState?.type === "select-area" && (
                <RectDraft
                  start={dragState.start}
                  end={dragState.end}
                  worldToScreen={worldToScreen}
                  variant="danger"
                />
              )}
            </g>
          </svg>
        </div>
        <div className="flex items-center justify-end border-t border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)]">
          Масштаб: {scaleLabel}
        </div>
      </div>
    );
  }
);

const GuideLine = ({
  orientation,
  value,
  worldBounds,
  worldToScreen,
}: {
  orientation: "vertical" | "horizontal";
  value: number;
  worldBounds: { top: number; bottom: number; left: number; right: number };
  worldToScreen: (point: Vec2) => Vec2;
}) => {
  const startPoint =
    orientation === "vertical"
      ? { x: value, y: worldBounds.top }
      : { x: worldBounds.left, y: value };
  const endPoint =
    orientation === "vertical"
      ? { x: value, y: worldBounds.bottom }
      : { x: worldBounds.right, y: value };
  const start = worldToScreen(startPoint);
  const end = worldToScreen(endPoint);
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke="#38bdf8"
      strokeWidth={1.5}
      strokeDasharray="6 4"
      opacity={0.9}
    />
  );
};

const CONTEXT_LEVEL_STYLE: Record<"below" | "above", { stroke: string; fill: string }> = {
  below: { stroke: "#0f766e", fill: "rgba(15,118,110,0.05)" },
  above: { stroke: "#b45309", fill: "rgba(180,83,9,0.05)" },
};

const ContextRoomPolygon = ({
  room,
  relation,
  worldToScreen,
}: {
  room: Room;
  relation: "below" | "above";
  worldToScreen: (point: Vec2) => Vec2;
}) => {
  const style = CONTEXT_LEVEL_STYLE[relation];
  const pointsAttr = room.polygon.map((point) => {
    const screen = worldToScreen(point);
    return `${screen.x},${screen.y}`;
  });
  return (
    <polygon
      points={pointsAttr.join(" ")}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={1}
      strokeDasharray="8 5"
      opacity={0.55}
      pointerEvents="none"
    />
  );
};

const ContextWallSegment = ({
  wall,
  relation,
  worldToScreen,
}: {
  wall: Wall;
  relation: "below" | "above";
  worldToScreen: (point: Vec2) => Vec2;
}) => {
  const style = CONTEXT_LEVEL_STYLE[relation];
  const a = worldToScreen(wall.a);
  const b = worldToScreen(wall.b);
  return (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={style.stroke}
      strokeWidth={2}
      strokeDasharray="6 4"
      opacity={0.45}
      pointerEvents="none"
    />
  );
};

const PlanSurfacePolygon = ({
  points,
  worldToScreen,
  selected,
  label,
  fill,
  stroke,
  strokeDasharray,
  hatch = false,
  arrow,
  badgeText,
  unstable = false,
}: {
  points: Vec2[];
  worldToScreen: (point: Vec2) => Vec2;
  selected: boolean;
  label: string;
  fill: string;
  stroke: string;
  strokeDasharray?: string;
  hatch?: boolean;
  arrow?: { directionDeg: number; risePerMeter: number };
  badgeText?: string;
  unstable?: boolean;
}) => {
  if (points.length < 3) {
    return null;
  }
  const pointsAttr = points.map((point) => {
    const screen = worldToScreen(point);
    return `${screen.x},${screen.y}`;
  });
  const centroidWorld = polygonCentroid(points);
  const centroid = worldToScreen(centroidWorld);
  const patternId = `surface-hatch-${label.replace(/\s+/g, "-")}-${Math.round(centroid.x)}-${Math.round(centroid.y)}`;
  const arrowLength = 28;
  const angleRad = arrow ? (arrow.directionDeg * Math.PI) / 180 : 0;
  const arrowEnd = arrow
    ? {
        x: centroid.x + Math.cos(angleRad) * arrowLength,
        y: centroid.y + Math.sin(angleRad) * arrowLength,
      }
    : null;
  return (
    <g>
      {hatch ? (
        <defs>
          <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="8" stroke={stroke} strokeWidth="1" opacity="0.24" />
          </pattern>
        </defs>
      ) : null}
      <polygon
        points={pointsAttr.join(" ")}
        fill={hatch ? `url(#${patternId})` : fill}
        stroke={selected ? "#0f172a" : stroke}
        strokeWidth={selected ? 2.4 : 1.6}
        strokeDasharray={strokeDasharray}
        opacity={selected ? 0.95 : 0.9}
      />
      {!hatch ? <polygon points={pointsAttr.join(" ")} fill={fill} opacity={selected ? 0.9 : 0.72} stroke="none" /> : null}
      {arrow && arrowEnd ? (
        <>
          <line x1={centroid.x} y1={centroid.y} x2={arrowEnd.x} y2={arrowEnd.y} stroke={selected ? "#0f172a" : stroke} strokeWidth={1.8} />
          <polygon
            points={`${arrowEnd.x},${arrowEnd.y} ${arrowEnd.x - 8 * Math.cos(angleRad - 0.45)},${arrowEnd.y - 8 * Math.sin(angleRad - 0.45)} ${arrowEnd.x - 8 * Math.cos(angleRad + 0.45)},${arrowEnd.y - 8 * Math.sin(angleRad + 0.45)}`}
            fill={selected ? "#0f172a" : stroke}
          />
        </>
      ) : null}
      {badgeText ? (
        <g transform={`translate(${centroid.x},${centroid.y - 18})`}>
          <rect
            x={-72}
            y={-10}
            width={144}
            height={20}
            rx={10}
            fill={unstable ? "rgba(254,243,199,0.96)" : "rgba(255,255,255,0.96)"}
            stroke={unstable ? "#d97706" : "#cbd5e1"}
          />
          <text textAnchor="middle" fill={unstable ? "#92400e" : "#0f172a"} fontSize={10} fontWeight={700}>
            {unstable ? `${badgeText} · неуст.` : badgeText}
          </text>
        </g>
      ) : null}
    </g>
  );
};

const PlanStair = ({
  stair,
  worldToScreen,
  selected,
}: {
  stair: Stair;
  worldToScreen: (point: Vec2) => Vec2;
  selected: boolean;
}) => {
  if (stair.boundary.length < 4) return null;

  const pts = stair.boundary.map((p) => worldToScreen(p));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const n = Math.max(2, stair.stepCount);
  const stroke = selected ? "#0f172a" : "#16a34a";
  const fill = selected ? "rgba(22,163,74,0.22)" : "rgba(22,163,74,0.08)";
  const pointsAttr = pts.map((p) => `${p.x},${p.y}`).join(" ");

  // Ступени перпендикулярны направлению движения:
  // высокий марш (h > w) → движение по Y → линии горизонтальные (вдоль X)
  // широкий марш (w > h) → движение по X → линии вертикальные (вдоль Y)
  const stepLines: React.ReactNode[] = [];
  if (h >= w) {
    for (let i = 1; i < n; i++) {
      const y = minY + (h * i) / n;
      stepLines.push(<line key={i} x1={minX} y1={y} x2={maxX} y2={y} stroke={stroke} strokeWidth={0.8} opacity={0.55} />);
    }
  } else {
    for (let i = 1; i < n; i++) {
      const x = minX + (w * i) / n;
      stepLines.push(<line key={i} x1={x} y1={minY} x2={x} y2={maxY} stroke={stroke} strokeWidth={0.8} opacity={0.55} />);
    }
  }

  // Arrow of ascent toward the "far" end
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const arrowLen = Math.min(w, h) * 0.4;
  const ax = w >= h ? cx : cx;
  const ay = w >= h ? cy : cy;
  const aex = w >= h ? ax : ax;
  const aey = w >= h ? ay - arrowLen : ay - arrowLen;

  return (
    <g>
      <polygon points={pointsAttr} fill={fill} stroke={stroke} strokeWidth={selected ? 2 : 1.5} />
      {stepLines}
      <line x1={ax} y1={ay} x2={aex} y2={aey} stroke={stroke} strokeWidth={1.6} />
      <polygon
        points={`${aex},${aey} ${aex - 5},${aey + 7} ${aex + 5},${aey + 7}`}
        fill={stroke}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill={stroke}
        stroke="#fff"
        strokeWidth={2}
        strokeLinejoin="round"
        paintOrder="stroke fill"
        pointerEvents="none"
      >
        {stair.name}
      </text>
    </g>
  );
};

const ROOM_LABEL_STROKE_WIDTH = 1.35;

const RoomPolygon = ({
  room,
  worldToScreen,
  screenToWorld,
  scale,
  selected,
  compactLabels = false,
  suppressPlanLabel = false,
  obstacles = [],
  schematicMode = false,
  exportMode = false,
}: {
  room: Room;
  worldToScreen: (point: Vec2) => Vec2;
  screenToWorld: (point: Vec2) => Vec2;
  scale: number;
  selected: boolean;
  compactLabels?: boolean;
  /** В режиме «Сети» поверх комнаты уже есть карточка T/Q (RoomStateOverlay) — не дублировать подпись. */
  suppressPlanLabel?: boolean;
  obstacles?: LabelBox[];
  schematicMode?: boolean;
  exportMode?: boolean;
}) => {
  const pointsAttr = room.polygon.map((point) => {
    const screen = worldToScreen(point);
    return `${screen.x},${screen.y}`;
  });
  const editable = room.source !== "auto";
  const area = Math.abs(polygonArea(room.polygon));
  const labelLayout = resolvePlanLabelLayout(room, obstacles, scale, worldToScreen, screenToWorld, compactLabels, exportMode);
  const placement = labelLayout.position;
  const showLabel = Boolean(placement) && !suppressPlanLabel && !schematicMode;
  const labelTextBottom = placement ? placement.box.y + 14 + Math.max(0, labelLayout.labelLines.length - 1) * 12 : 0;
  const areaY = placement ? Math.max(placement.box.y + placement.box.height - 6, labelTextBottom + 12) : 0;
  const areaFitsWithoutOverlap = placement ? areaY <= placement.box.y + placement.box.height - 2 : false;
  return (
    <g data-layer="room-label">
      <title>{labelLayout.title}</title>
      <polygon
        points={pointsAttr.join(" ")}
        fill={selected ? "rgba(59,130,246,0.3)" : schematicMode ? "rgba(248,250,252,0.34)" : "rgba(15,23,42,0.08)"}
        stroke={selected ? "#2563eb" : schematicMode ? "#cbd5e1" : "#94a3b8"}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      {showLabel && labelLayout.compact ? (
        <rect
          x={placement!.box.x}
          y={placement!.box.y}
          width={placement!.box.width}
          height={placement!.box.height}
          rx={10}
          fill="rgba(255,255,255,0.92)"
          stroke="rgba(203,213,225,0.9)"
        />
      ) : null}
      {showLabel ? (
        <g>
          {!labelLayout.compact ? (
            <rect
              x={placement!.box.x}
              y={placement!.box.y}
              width={placement!.box.width}
              height={placement!.box.height}
              rx={10}
              fill="rgba(255,255,255,0.78)"
              stroke="rgba(226,232,240,0.9)"
            />
          ) : null}
          {labelLayout.labelLines.map((line, index) => (
            <text
              key={`${room.id}-label-${index}`}
              x={placement!.screenCenter.x}
              y={placement!.box.y + 14 + index * 12}
              textAnchor="middle"
              fill="#0f172a"
              fontSize={labelLayout.fontSize}
              fontWeight={600}
              stroke="#ffffff"
              strokeWidth={labelLayout.compact ? 0 : ROOM_LABEL_STROKE_WIDTH}
              strokeLinejoin="round"
              paintOrder="stroke fill"
            >
              {line}
            </text>
          ))}
          {labelLayout.showArea && area >= 8 && areaFitsWithoutOverlap ? (
            <text
              x={placement!.screenCenter.x}
              y={areaY}
              textAnchor="middle"
              fill="#0f172a"
              fontSize={11}
              stroke="#ffffff"
              strokeWidth={ROOM_LABEL_STROKE_WIDTH}
              strokeLinejoin="round"
              paintOrder="stroke fill"
            >
              {formatArea(area)}
            </text>
          ) : null}
        </g>
      ) : null}
      {selected &&
        editable &&
        !exportMode &&
        room.polygon.map((point, index) => {
          const screen = worldToScreen(point);
          return (
            <circle
              key={`${room.id}-v-${index}`}
              cx={screen.x}
              cy={screen.y}
              r={5}
              fill="#2563eb"
              stroke="#0f172a"
              strokeWidth={1}
            />
          );
        })}
    </g>
  );
};

const RectDraft = ({
  start,
  end,
  worldToScreen,
  variant = "default",
}: {
  start: Vec2;
  end: Vec2;
  worldToScreen: (point: Vec2) => Vec2;
  variant?: "default" | "danger";
}) => {
  const startScreen = worldToScreen(start);
  const endScreen = worldToScreen(end);
  const left = Math.min(startScreen.x, endScreen.x);
  const top = Math.min(startScreen.y, endScreen.y);
  const width = Math.abs(endScreen.x - startScreen.x);
  const height = Math.abs(endScreen.y - startScreen.y);
  const fill = variant === "danger" ? "rgba(220,38,38,0.12)" : "rgba(15,23,42,0.08)";
  const stroke = variant === "danger" ? "#dc2626" : "#0f172a";
  return (
    <rect
      x={left}
      y={top}
      width={width}
      height={height}
      fill={fill}
      stroke={stroke}
      strokeDasharray="6 4"
      strokeWidth={1.5}
    />
  );
};

const LoopOverlay = ({
  loop,
  worldToScreen,
  selected,
  hovered,
}: {
  loop: RoomLoopCandidate;
  worldToScreen: (point: Vec2) => Vec2;
  selected: boolean;
  hovered: boolean;
}) => {
  const pointsAttr = loop.polygon.map((point) => {
    const screen = worldToScreen(point);
    return `${screen.x},${screen.y}`;
  });
  const color = !loop.valid
    ? "#f97316"
    : loop.roomSource === "manual"
    ? "#10b981"
    : loop.roomSource === "auto"
    ? "#0ea5e9"
    : "#94a3b8";
  const strokeWidth = selected ? 3.5 : hovered ? 2.5 : 1.4;
  const fillOpacity = selected ? 0.22 : hovered ? 0.12 : 0;
  const dash =
    !loop.valid ? "4 3" : loop.roomSource === "auto" ? "8 4" : loop.roomSource === "manual" ? "1 0" : "6 3";
  return (
    <polygon
      points={pointsAttr.join(" ")}
      fill={color}
      fillOpacity={fillOpacity}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={dash}
      pointerEvents="none"
    />
  );
};

const LoopDebugMarkers = ({
  loop,
  worldToScreen,
}: {
  loop: RoomLoopCandidate;
  worldToScreen: (point: Vec2) => Vec2;
}) => (
  <g pointerEvents="none">
    {loop.polygon.map((point, index) => {
      const screen = worldToScreen(point);
      return (
        <g key={`${loop.id}-marker-${index}`}>
          <circle
            cx={screen.x}
            cy={screen.y}
            r={4}
            fill={loop.valid ? "#0ea5e9" : "#f97316"}
            stroke="#0f172a"
            strokeWidth={0.8}
          />
          <text x={screen.x} y={screen.y - 6} textAnchor="middle" fill="#0f172a" fontSize={9} fontWeight={600}>
            {index + 1}
          </text>
        </g>
      );
    })}
  </g>
);

const RoomDraft = ({
  points,
  previewPoint,
  worldToScreen,
}: {
  points: Vec2[];
  previewPoint?: Vec2;
  worldToScreen: (point: Vec2) => Vec2;
}) => {
  const drawPoints = previewPoint ? [...points, previewPoint] : points;
  const attr = drawPoints.map((point) => {
    const p = worldToScreen(point);
    return `${p.x},${p.y}`;
  });
  return (
    <polyline
      points={attr.join(" ")}
      fill="none"
      stroke="#0f172a"
      strokeWidth={1.5}
      strokeDasharray="4 4"
    />
  );
};

const WallSegment = ({
  wall,
  walls,
  worldToScreen,
  selected,
  transientHighlight,
  schematicMode = false,
  exportMode = false,
}: {
  wall: Wall;
  walls: Wall[];
  worldToScreen: (point: Vec2) => Vec2;
  selected: boolean;
  transientHighlight?: { color: string; badgeText: string; unstable: boolean } | null;
  schematicMode?: boolean;
  exportMode?: boolean;
}) => {
  const polygon = getWallPolygon(wall, walls);
  if (!polygon.length) {
    return null;
  }
  const attr = polygon
    .map((point) => {
      const screen = worldToScreen(point);
      return `${screen.x},${screen.y}`;
    })
    .join(" ");
  const fill = transientHighlight?.color ?? (selected ? "#1e293b" : schematicMode ? "#111827" : "#0f172a");
  const stroke = transientHighlight ? "#0f172a" : selected ? "#e11d48" : fill;
  const a = worldToScreen(wall.a);
  const b = worldToScreen(wall.b);
  const centerX = (a.x + b.x) / 2;
  const centerY = (a.y + b.y) / 2;
  return (
    <g>
      <polygon
        points={attr}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected || transientHighlight ? 2 : 1}
        strokeLinejoin="round"
      />
      {transientHighlight ? (
        <g transform={`translate(${centerX},${centerY - 10})`}>
          <rect
            x={-72}
            y={-10}
            width={144}
            height={20}
            rx={10}
            fill={transientHighlight.unstable ? "rgba(254,243,199,0.96)" : "rgba(255,255,255,0.96)"}
            stroke={transientHighlight.unstable ? "#d97706" : "#cbd5e1"}
          />
          <text textAnchor="middle" fill={transientHighlight.unstable ? "#92400e" : "#0f172a"} fontSize={10} fontWeight={700}>
            {transientHighlight.unstable ? `${transientHighlight.badgeText} · неуст.` : transientHighlight.badgeText}
          </text>
        </g>
      ) : null}
      {selected && !exportMode && (
        <>
          <circle cx={a.x} cy={a.y} r={5} fill="#e11d48" stroke="#0f172a" strokeWidth={1} />
          <circle cx={b.x} cy={b.y} r={5} fill="#e11d48" stroke="#0f172a" strokeWidth={1} />
          <text
            x={(a.x + b.x) / 2}
            y={(a.y + b.y) / 2 - 8}
            textAnchor="middle"
            fill="#0f172a"
            fontSize={10}
          >
            {(wall.thickness_m ?? WALL_DEFAULTS.thickness).toFixed(2)} м
          </text>
        </>
      )}
    </g>
  );
};

const WALL_JOIN_TOLERANCE = 1e-4;
const WALL_MITER_LIMIT = 3.5;

const getWallPolygon = (wall: Wall, walls: Wall[]): Vec2[] => {
  const thickness = wall.thickness_m ?? WALL_DEFAULTS.thickness;
  const dir = normalizeVec({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y });
  if (!dir) {
    return [];
  }
  const normal = { x: -dir.y, y: dir.x };
  const half = thickness / 2;
  const startPlus = resolveWallJoinPoint(wall, walls, wall.a, wall.b, normal, half, 1);
  const endPlus = resolveWallJoinPoint(wall, walls, wall.b, wall.a, normal, half, 1);
  const endMinus = resolveWallJoinPoint(wall, walls, wall.b, wall.a, normal, half, -1);
  const startMinus = resolveWallJoinPoint(wall, walls, wall.a, wall.b, normal, half, -1);
  return [
    startPlus,
    endPlus,
    endMinus,
    startMinus,
  ];
};

function resolveWallJoinPoint(
  wall: Wall,
  walls: Wall[],
  joint: Vec2,
  opposite: Vec2,
  wallNormal: Vec2,
  halfThickness: number,
  sideSign: 1 | -1
): Vec2 {
  const basePoint = addVec(joint, scaleVec(wallNormal, halfThickness * sideSign));
  const connected = walls.filter((candidate) => {
    if (candidate.id === wall.id || candidate.levelId !== wall.levelId) {
      return false;
    }
    return isSamePoint(candidate.a, joint) || isSamePoint(candidate.b, joint);
  });
  if (!connected.length) {
    return basePoint;
  }

  const currentOutgoing = normalizeVec({ x: opposite.x - joint.x, y: opposite.y - joint.y });
  if (!currentOutgoing) {
    return basePoint;
  }

  let bestNeighbor: Wall | null = null;
  let bestAlignment = Number.NEGATIVE_INFINITY;
  connected.forEach((candidate) => {
    const candidateOther = isSamePoint(candidate.a, joint) ? candidate.b : candidate.a;
    const candidateOutgoing = normalizeVec({ x: candidateOther.x - joint.x, y: candidateOther.y - joint.y });
    if (!candidateOutgoing) {
      return;
    }
    const alignment = currentOutgoing.x * candidateOutgoing.x + currentOutgoing.y * candidateOutgoing.y;
    if (alignment > bestAlignment) {
      bestAlignment = alignment;
      bestNeighbor = candidate;
    }
  });

  if (!bestNeighbor) {
    return basePoint;
  }

  const neighborOther = isSamePoint(bestNeighbor.a, joint) ? bestNeighbor.b : bestNeighbor.a;
  const neighborDir = normalizeVec({ x: neighborOther.x - joint.x, y: neighborOther.y - joint.y });
  if (!neighborDir) {
    return basePoint;
  }
  const neighborThickness = bestNeighbor.thickness_m ?? WALL_DEFAULTS.thickness;
  const neighborNormal = { x: -neighborDir.y, y: neighborDir.x };
  const neighborOffsetA = addVec(joint, scaleVec(neighborNormal, neighborThickness / 2));
  const neighborOffsetB = addVec(joint, scaleVec(neighborNormal, -neighborThickness / 2));
  const currentVector = { x: basePoint.x - joint.x, y: basePoint.y - joint.y };
  const neighborBase =
    neighborOffsetA.x * currentVector.x + neighborOffsetA.y * currentVector.y >=
    neighborOffsetB.x * currentVector.x + neighborOffsetB.y * currentVector.y
      ? neighborOffsetA
      : neighborOffsetB;

  const intersection = intersectInfiniteLines(basePoint, currentOutgoing, neighborBase, neighborDir);
  if (!intersection) {
    return basePoint;
  }
  const miterLength = Math.hypot(intersection.x - joint.x, intersection.y - joint.y);
  if (miterLength > Math.max(halfThickness, neighborThickness / 2) * WALL_MITER_LIMIT) {
    return basePoint;
  }
  return intersection;
}

function intersectInfiniteLines(originA: Vec2, dirA: Vec2, originB: Vec2, dirB: Vec2): Vec2 | null {
  const cross = dirA.x * dirB.y - dirA.y * dirB.x;
  if (Math.abs(cross) < 1e-6) {
    return null;
  }
  const delta = { x: originB.x - originA.x, y: originB.y - originA.y };
  const t = (delta.x * dirB.y - delta.y * dirB.x) / cross;
  return { x: originA.x + dirA.x * t, y: originA.y + dirA.y * t };
}

function isSamePoint(a: Vec2, b: Vec2): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= WALL_JOIN_TOLERANCE;
}

const getOpeningSegment = (wall: Wall, opening: Door | Window) => {
  const wallVec = { x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y };
  const length = Math.hypot(wallVec.x, wallVec.y);
  if (length === 0) {
    return null;
  }
  const dir = { x: wallVec.x / length, y: wallVec.y / length };
  const normal = { x: -dir.y, y: dir.x };
  const offset = anchorToOffset(opening.anchor, wall);
  const start = {
    x: wall.a.x + dir.x * offset,
    y: wall.a.y + dir.y * offset,
  };
  const end = {
    x: start.x + dir.x * opening.width_m,
    y: start.y + dir.y * opening.width_m,
  };
  const center = {
    x: start.x + dir.x * (opening.width_m / 2),
    y: start.y + dir.y * (opening.width_m / 2),
  };
  return { start, end, center, length, dir, normal };
};

const Opening = ({
  opening,
  wall,
  worldToScreen,
  color,
  selected,
  kind,
}: {
  opening: Door | Window;
  wall: Wall | undefined;
  worldToScreen: (point: Vec2) => Vec2;
  color: string;
  selected: boolean;
  kind: "door" | "window";
}) => {
  if (!wall) {
    return null;
  }
  const segment = getOpeningSegment(wall, opening);
  if (!segment) {
    return null;
  }
  const thickness = wall.thickness_m ?? WALL_DEFAULTS.thickness;
  const half = thickness / 2;
  const gapPolygon = [
    addVec(segment.start, scaleVec(segment.normal, half)),
    addVec(segment.end, scaleVec(segment.normal, half)),
    addVec(segment.end, scaleVec(segment.normal, -half)),
    addVec(segment.start, scaleVec(segment.normal, -half)),
  ];
  const gapPoints = gapPolygon
    .map((point) => {
      const screen = worldToScreen(point);
      return `${screen.x},${screen.y}`;
    })
    .join(" ");
  const accent = selected ? "#facc15" : color;
  const swingRight = kind === "door" && (opening as Door).swingDirection === "right";
  const opensOutward = kind === "door" && (opening as Door).openingDirection === "outward";
  const hinge = swingRight ? segment.end : segment.start;
  const closedEnd = swingRight ? segment.start : segment.end;
  const openingNormalSign = opensOutward ? 1 : -1;
  const openEnd = addVec(hinge, scaleVec(segment.normal, opening.width_m * openingNormalSign));
  const gapFill = "#f8fafc";

  return (
    <g>
      <polygon points={gapPoints} fill={gapFill} stroke={gapFill} strokeWidth={selected ? 1.5 : 1} />
      {kind === "door" ? (
        <DoorSymbol
          hinge={hinge}
          closedEnd={closedEnd}
          openEnd={openEnd}
          worldToScreen={worldToScreen}
          accent={accent}
        />
      ) : (
        <WindowSymbol segment={segment} thickness={thickness} worldToScreen={worldToScreen} color={accent} />
      )}
    </g>
  );
};

const DoorSymbol = ({
  hinge,
  closedEnd,
  openEnd,
  worldToScreen,
  accent,
}: {
  hinge: Vec2;
  closedEnd: Vec2;
  openEnd: Vec2;
  worldToScreen: (point: Vec2) => Vec2;
  accent: string;
}) => {
  const hingeScreen = worldToScreen(hinge);
  const closedScreen = worldToScreen(closedEnd);
  const openScreen = worldToScreen(openEnd);
  const radius = Math.hypot(closedScreen.x - hingeScreen.x, closedScreen.y - hingeScreen.y);
  const cross =
    (closedScreen.x - hingeScreen.x) * (openScreen.y - hingeScreen.y) -
    (closedScreen.y - hingeScreen.y) * (openScreen.x - hingeScreen.x);
  const sweepFlag = cross < 0 ? 0 : 1;
  return (
    <>
      <line
        x1={hingeScreen.x}
        y1={hingeScreen.y}
        x2={closedScreen.x}
        y2={closedScreen.y}
        stroke={accent}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.9}
      />
      <line
        x1={hingeScreen.x}
        y1={hingeScreen.y}
        x2={openScreen.x}
        y2={openScreen.y}
        stroke={accent}
        strokeWidth={1.25}
        strokeLinecap="round"
      />
      <path
        d={`M ${closedScreen.x} ${closedScreen.y} A ${radius} ${radius} 0 0 ${sweepFlag} ${openScreen.x} ${openScreen.y}`}
        fill="none"
        stroke={accent}
        strokeWidth={1.05}
        opacity={0.9}
      />
    </>
  );
};

const WindowSymbol = ({
  segment,
  thickness,
  worldToScreen,
  color,
}: {
  segment: NonNullable<ReturnType<typeof getOpeningSegment>>;
  thickness: number;
  worldToScreen: (point: Vec2) => Vec2;
  color: string;
}) => {
  if (!segment) {
    return null;
  }
  const offset = Math.max(0.015, thickness * 0.3);
  const lines = [
    {
      start: addVec(segment.start, scaleVec(segment.normal, offset)),
      end: addVec(segment.end, scaleVec(segment.normal, offset)),
    },
    {
      start: addVec(segment.start, scaleVec(segment.normal, -offset)),
      end: addVec(segment.end, scaleVec(segment.normal, -offset)),
    },
  ];
  const mullion = {
    start: addVec(segment.start, scaleVec(segment.normal, 0)),
    end: addVec(segment.end, scaleVec(segment.normal, 0)),
  };
  return (
    <>
      {lines.map((line, index) => {
        const a = worldToScreen(line.start);
        const b = worldToScreen(line.end);
        return (
          <line key={`window-frame-${index}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={1.6} />
        );
      })}
      <line
        x1={worldToScreen(mullion.start).x}
        y1={worldToScreen(mullion.start).y}
        x2={worldToScreen(mullion.end).x}
        y2={worldToScreen(mullion.end).y}
        stroke="#0f172a"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </>
  );
};

const DimensionLabel = ({
  opening,
  wall,
  worldToScreen,
}: {
  opening: Door | Window;
  wall: Wall;
  worldToScreen: (point: Vec2) => Vec2;
}) => {
  const segment = getOpeningSegment(wall, opening);
  if (!segment) {
    return null;
  }
  const offset = Math.max(0.25, (wall.thickness_m ?? WALL_DEFAULTS.thickness) + 0.2);
  const anchor = addVec(segment.center, scaleVec(segment.normal, offset));
  const screen = worldToScreen(anchor);
  const text = `${Math.round(opening.width_m * 1000)} мм`;
  return (
    <text
      x={screen.x}
      y={screen.y - 4}
      textAnchor="middle"
      fill="#0f172a"
      fontSize={11}
      fontWeight={600}
      stroke="#ffffff"
      strokeWidth={4}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
};

const buildGridStyle = (zoom: number, gridStep: number, snapEnabled: boolean): { image: string; size: string } => {
  const spacing = Math.max(gridStep, 0.5);
  const gap = Math.max(spacing * zoom, 10);
  const majorGap = Math.max(gap * 5, 40);
  const minorAlpha = snapEnabled ? 0.12 : 0.06;
  const majorAlpha = snapEnabled ? 0.26 : 0.14;
  return {
    image: `linear-gradient(90deg, rgba(148,163,184,${majorAlpha}) 1px, transparent 1px), linear-gradient(rgba(148,163,184,${majorAlpha}) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,${minorAlpha}) 1px, transparent 1px), linear-gradient(rgba(148,163,184,${minorAlpha}) 1px, transparent 1px)`,
    size: `${majorGap}px ${majorGap}px, ${majorGap}px ${majorGap}px, ${gap}px ${gap}px, ${gap}px ${gap}px`,
  };
};

const normalizePolylinePath = (path: Vec2[], tolerance = NETWORK_DUPLICATE_TOLERANCE): Vec2[] => {
  const collapsed: Vec2[] = [];
  path.forEach((point) => {
    const previous = collapsed[collapsed.length - 1];
    if (!previous || distance(previous, point) > tolerance) {
      collapsed.push({ ...point });
    }
  });

  if (collapsed.length < 3) {
    return collapsed;
  }

  const simplified: Vec2[] = [collapsed[0]];
  for (let index = 1; index < collapsed.length - 1; index += 1) {
    const prev = simplified[simplified.length - 1];
    const current = collapsed[index];
    const next = collapsed[index + 1];
    if (pointToSegmentDistance(current, prev, next) <= tolerance) {
      continue;
    }
    simplified.push(current);
  }
  simplified.push(collapsed[collapsed.length - 1]);
  return simplified;
};

const buildPolylineSignature = (path: Vec2[]): string => {
  const normalized = normalizePolylinePath(path);
  const forward = normalized.map((point) => `${point.x.toFixed(2)}:${point.y.toFixed(2)}`).join("|");
  const backward = [...normalized]
    .reverse()
    .map((point) => `${point.x.toFixed(2)}:${point.y.toFixed(2)}`)
    .join("|");
  return forward < backward ? forward : backward;
};

const offsetScreenPolyline = (points: Vec2[], offsetPx: number): Vec2[] => {
  if (!offsetPx || points.length < 2) {
    return points;
  }
  return points.map((point, index) => {
    const prev = points[index - 1] ?? point;
    const next = points[index + 1] ?? point;
    const tangent = normalizeVec({ x: next.x - prev.x, y: next.y - prev.y });
    if (!tangent) {
      return point;
    }
    const normal = { x: -tangent.y, y: tangent.x };
    return {
      x: point.x + normal.x * offsetPx,
      y: point.y + normal.y * offsetPx,
    };
  });
};

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

const isPointInsidePolygon = (point: Vec2, polygon: Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-6) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
};

const isPointNearOpening = (point: Vec2, wall: Wall, opening: Door | Window): boolean => {
  const segment = getOpeningSegment(wall, opening);
  if (!segment) {
    return false;
  }
  return pointToSegmentDistance(point, segment.start, segment.end) < 0.2;
};

const arePointsClose = (a: Vec2, b: Vec2, tolerance = 1e-3): boolean => distance(a, b) < tolerance;

const wallIntersectsExisting = (start: Vec2, end: Vec2, walls: Wall[], ignoreId: string | null): boolean => {
  return walls.some((wall) => {
    if (ignoreId && wall.id === ignoreId) {
      return false;
    }
    if (sharesEndpoint(start, end, wall)) {
      return false;
    }
    return segmentsIntersect(start, end, wall.a, wall.b);
  });
};

const sharesEndpoint = (start: Vec2, end: Vec2, wall: Wall): boolean => {
  return (
    arePointsClose(start, wall.a) ||
    arePointsClose(start, wall.b) ||
    arePointsClose(end, wall.a) ||
    arePointsClose(end, wall.b)
  );
};

const openingOverlaps = (
  wall: Wall,
  offset: number,
  width: number,
  doors: Door[],
  windows: Window[],
  ignoreOpeningId?: string
): boolean => {
  const [start, end] = [offset, offset + width];
  const overlapsRange = (range: readonly [number, number]) =>
    Math.max(start, range[0]) < Math.min(end, range[1]);
  return [...doors, ...windows].some(
    (opening) =>
      opening.anchor.wallId === wall.id &&
      opening.id !== ignoreOpeningId &&
      overlapsRange([
        anchorToOffset(opening.anchor, wall),
        anchorToOffset(opening.anchor, wall) + opening.width_m,
      ])
  );
};

const clampOpeningOffset = (center: number, width: number, wallLength: number): number | null => {
  const half = width / 2;
  if (wallLength <= width + OPENING_CLEARANCE * 2) {
    return null;
  }
  const minCenter = OPENING_CLEARANCE + half;
  const maxCenter = wallLength - OPENING_CLEARANCE - half;
  if (minCenter >= maxCenter) {
    return null;
  }
  const clampedCenter = Math.max(minCenter, Math.min(center, maxCenter));
  return clampedCenter - half;
};

const addVec = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

const scaleVec = (vec: Vec2, scalar: number): Vec2 => ({ x: vec.x * scalar, y: vec.y * scalar });

const normalizeVec = (vec: Vec2): Vec2 | null => {
  const length = Math.hypot(vec.x, vec.y);
  if (length === 0) {
    return null;
  }
  return { x: vec.x / length, y: vec.y / length };
};

const createsSelfIntersection = (points: Vec2[]): boolean => {
  if (points.length < 4) {
    return false;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a1 = points[i];
    const a2 = points[i + 1];
    for (let j = i + 1; j < points.length - 1; j++) {
      if (Math.abs(i - j) <= 1) {
        continue;
      }
      const b1 = points[j];
      const b2 = points[j + 1];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
};

const isPointNearPolyline = (point: Vec2, path: Vec2[], tolerance: number): boolean => {
  for (let index = 1; index < path.length; index += 1) {
    if (pointToSegmentDistance(point, path[index - 1], path[index]) <= tolerance) {
      return true;
    }
  }
  return false;
};

const closestPointOnPolyline = (point: Vec2, path: Vec2[]): Vec2 | null => {
  if (path.length < 2) {
    return null;
  }
  let bestPoint: Vec2 | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 1e-6) {
      continue;
    }
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
    const candidate = {
      x: start.x + dx * t,
      y: start.y + dy * t,
    };
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = candidate;
    }
  }
  return bestPoint;
};

const intensityToColor = (ratio: number, start: string, end: string): string => {
  const clampRatio = Math.max(0, Math.min(1, ratio));
  const startRgb = hexToRgb(start);
  const endRgb = hexToRgb(end);
  return rgbToHex({
    r: Math.round(startRgb.r + (endRgb.r - startRgb.r) * clampRatio),
    g: Math.round(startRgb.g + (endRgb.g - startRgb.g) * clampRatio),
    b: Math.round(startRgb.b + (endRgb.b - startRgb.b) * clampRatio),
  });
};

const diameterToColor = (ratio: number): string => intensityToColor(ratio, "#cbd5e1", "#0f172a");

const hexToRgb = (value: string): { r: number; g: number; b: number } => {
  const normalized = value.replace("#", "");
  const safe = normalized.length === 3 ? normalized.split("").map((char) => `${char}${char}`).join("") : normalized;
  const parsed = Number.parseInt(safe, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }): string =>
  `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")}`;

const NetworkPolyline = ({
  id,
  path,
  color,
  label,
  info,
  kind,
  dashArray,
  strokeWidth,
  worldToScreen,
  offsetPx,
  selected,
  hovered,
  secondaryLabel,
  schematicMode = false,
  monochrome = false,
  calloutMode = "hover",
  flowRole = "distribution",
  exportMode = false,
}: {
  id?: string;
  path: Vec2[];
  color: string;
  label: string;
  info?: string;
  kind: "pipe" | "duct";
  dashArray?: string;
  strokeWidth?: number;
  worldToScreen: (point: Vec2) => Vec2;
  offsetPx: number;
  selected: boolean;
  hovered?: boolean;
  secondaryLabel?: string;
  schematicMode?: boolean;
  monochrome?: boolean;
  calloutMode?: "hover" | "always";
  flowRole?: "supply" | "return" | "distribution" | "unknown" | "mixed";
  exportMode?: boolean;
}) => {
  if (path.length < 2) {
    return null;
  }
  const points = offsetScreenPolyline(path.map((point) => worldToScreen(point)), offsetPx);
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const midpointIndex = Math.floor(points.length / 2);
  const marker = points[midpointIndex] ?? points[0];
  const emphasized = selected || hovered;
  const shouldShowCallout = !exportMode && (calloutMode === "always" || emphasized);
  const schematicStroke =
    kind === "duct"
      ? "#475569"
      : monochrome
        ? flowRole === "return"
          ? "#475569"
          : "#111827"
        : color;
  const schematicDashArray = kind === "pipe" && monochrome && flowRole === "return" ? "9 4" : dashArray;
  const labelText = secondaryLabel ? `${label} · ${secondaryLabel}` : label;
  return (
    <g>
      {emphasized ? (
        <polyline
          points={linePoints}
          fill="none"
          stroke={schematicMode ? "rgba(255,255,255,0.94)" : kind === "duct" ? "#cbd5e1" : "#e2e8f0"}
          strokeWidth={schematicMode ? Math.max((strokeWidth ?? 3) + 3.2, 5.8) : kind === "duct" ? 10.5 : Math.max((strokeWidth ?? 3) + 4.6, 6.5)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={selected ? 0.72 : 0.5}
        />
      ) : null}
      <polyline
        points={linePoints}
        fill="none"
        stroke={schematicMode ? "rgba(255,255,255,0.38)" : "#ffffff"}
        strokeWidth={schematicMode ? Math.max((strokeWidth ?? 3) * 0.22, 1.1) : kind === "duct" ? 3.6 : Math.max((strokeWidth ?? 3) * 0.34, 1.4)}
        strokeDasharray={schematicDashArray}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={kind === "duct" ? 0.12 : emphasized ? 0.58 : 0.34}
      />
      <polyline
        points={linePoints}
        fill="none"
        stroke={schematicMode ? schematicStroke : color}
        strokeWidth={
          schematicMode
            ? kind === "duct"
              ? selected
                ? 6.4
                : hovered
                  ? 5.8
                  : 4.2
              : selected
                ? Math.max((strokeWidth ?? 3) + 0.6, 3.8)
                : hovered
                  ? Math.max((strokeWidth ?? 3) + 0.25, 3.2)
                  : Math.max((strokeWidth ?? 3) - 0.1, 2.8)
            : kind === "duct"
              ? selected
                ? 8
                : hovered
                  ? 7
                  : 5.5
              : selected
                ? Math.max((strokeWidth ?? 3) + 1, 4)
                : hovered
                  ? Math.max((strokeWidth ?? 3) + 0.45, 3.4)
                  : strokeWidth ?? 3
        }
        strokeDasharray={schematicDashArray}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={emphasized ? 0.98 : 0.88}
      >
        <title>{info ? `${label}\n${info}` : label}</title>
      </polyline>
      {shouldShowCallout ? (
        <>
          <line
            x1={marker.x}
            y1={marker.y}
            x2={marker.x + 14}
            y2={marker.y - 11}
            stroke={schematicMode ? schematicStroke : color}
            strokeWidth={1.2}
          />
          <circle cx={marker.x} cy={marker.y} r={kind === "duct" ? 4.5 : 3.5} fill={schematicMode ? schematicStroke : color} opacity={0.98} />
          <rect
            x={marker.x + 13}
            y={marker.y - 28}
            width={Math.max(92, labelText.length * 6.1)}
            height={20}
            rx={9}
            fill="rgba(255,255,255,0.97)"
            stroke={schematicMode ? "rgba(148,163,184,0.92)" : "rgba(203,213,225,0.92)"}
          />
          <text x={marker.x + 21} y={marker.y - 15} className="fill-[color:var(--text-muted)] text-[10px] font-semibold" data-network-id={id}>
            {labelText}
          </text>
        </>
      ) : null}
    </g>
  );
};

const NetworkDraft = ({
  points,
  previewPoint,
  color,
  kind,
  worldToScreen,
}: {
  points: Vec2[];
  previewPoint?: Vec2;
  color: string;
  kind: "wall" | "pipe" | "duct";
  worldToScreen: (point: Vec2) => Vec2;
}) => {
  const fullPath = previewPoint ? [...points, previewPoint] : points;
  if (fullPath.length < 2) {
    return null;
  }
  const screenPoints = fullPath.map((point) => worldToScreen(point)).map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <polyline
      points={screenPoints}
      fill="none"
      stroke={color}
      strokeWidth={kind === "duct" ? 6 : kind === "wall" ? 2 : 3}
      strokeDasharray="6 4"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.8}
    />
  );
};

const RoomHeatmapOverlay = ({
  room,
  field,
  worldToScreen,
}: {
  room: Room;
  field: ThermalFieldModel;
  worldToScreen: (point: Vec2) => Vec2;
}) => {
  const clipPathId = `room-heatmap-clip-${room.id}`;
  const clipPolygon = room.polygon.map((point) => worldToScreen(point)).map((point) => `${point.x},${point.y}`).join(" ");
  const bounds = room.polygon.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );
  const roomArea = Math.max(1, Math.abs(polygonArea(room.polygon)));
  const step = Math.max(0.18, Math.min(0.28, Math.sqrt(roomArea) / 18));
  const cells: React.ReactElement[] = [];

  for (let x = bounds.minX; x < bounds.maxX; x += step) {
    for (let y = bounds.minY; y < bounds.maxY; y += step) {
      const center = { x: x + step / 2, y: y + step / 2 };
      if (!polygonContainsPoint(center, room.polygon)) {
        continue;
      }
      const corners = [
        { x, y },
        { x: x + step, y },
        { x: x + step, y: y + step },
        { x, y: y + step },
      ];
      const screenPoints = corners.map((point) => worldToScreen(point));
      const temperatureC = sampleSmoothedThermalFieldAtPoint(field, room.levelId, center, step * 0.55);
      cells.push(
        <polygon
          key={`${room.id}-${x.toFixed(2)}-${y.toFixed(2)}`}
          points={screenPoints.map((point) => `${point.x},${point.y}`).join(" ")}
          fill={temperatureToColor(temperatureC, field.minTemperatureC, field.maxTemperatureC)}
          fillOpacity={0.22}
          stroke="none"
          pointerEvents="none"
        />
      );
    }
  }

  return (
    <g pointerEvents="none">
      <defs>
        <clipPath id={clipPathId}>
          <polygon points={clipPolygon} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipPathId})`}>{cells}</g>
    </g>
  );
};

const HeatmapLegend = ({
  minTemperatureC,
  maxTemperatureC,
  synthetic,
  compact = false,
}: {
  minTemperatureC: number;
  maxTemperatureC: number;
  synthetic: boolean;
  compact?: boolean;
}) => (
  <div className={`pointer-events-none rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 shadow-lg backdrop-blur ${compact ? "w-full max-w-[18rem]" : "w-full max-w-[22rem]"}`}>
    <div className="mb-2 flex items-start justify-between gap-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">Тепловое поле</p>
        <p className="text-sm font-semibold text-[color:var(--text-base)]">
          {synthetic ? "Предварительная оценка" : "Расчетное поле"}
        </p>
      </div>
      <div className={`rounded-full bg-[color:var(--surface-muted)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] ${compact ? "hidden sm:block" : ""}`}>
        {minTemperatureC.toFixed(1)}–{maxTemperatureC.toFixed(1)} °C
      </div>
    </div>
    <div className="h-3 w-full rounded-full" style={{ background: "var(--temp-legend-gradient)" }} />
    <div className="mt-2 flex items-center justify-between text-[11px] text-[color:var(--text-soft)]">
      <span>Мин. {minTemperatureC.toFixed(1)} °C</span>
      <span>Макс. {maxTemperatureC.toFixed(1)} °C</span>
    </div>
  </div>
);

const TransientLegendOverlay = ({
  innerSurfaceTemperature_C,
  stable,
  compact,
}: {
  innerSurfaceTemperature_C: number;
  stable: boolean;
  compact: boolean;
}) => (
  <div className={`pointer-events-none mt-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 shadow-lg backdrop-blur ${compact ? "w-full max-w-[18rem]" : "w-full max-w-[22rem]"}`}>
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">Нестационарный сценарий</p>
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Подсветка конструкции</p>
      </div>
      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${stable ? "bg-[color:var(--success-bg)] text-[color:var(--success-fg)]" : "bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"}`}>
        {stable ? "stable" : "unstable"}
      </span>
    </div>
    <div className="mt-2 h-3 w-full rounded-full" style={{ background: "var(--temp-legend-gradient)" }} />
    <div className="mt-2 flex items-center justify-between text-[11px] text-[color:var(--text-soft)]">
      <span>Холоднее</span>
      <span>Теплее</span>
    </div>
    <div className="mt-2 text-[11px] text-[color:var(--text-muted)]">
      τв: <span className="font-semibold text-[color:var(--text-base)]">{formatNumber(innerSurfaceTemperature_C, { maximumFractionDigits: 1 })} °C</span>
    </div>
  </div>
);

const LevelContextOverlay = ({
  summary,
  compact,
}: {
  summary: {
    current: BuildingModel["levels"][number];
    previous: BuildingModel["levels"][number] | null;
    next: BuildingModel["levels"][number] | null;
    ordinal: number;
    total: number;
  };
  compact: boolean;
}) => (
  <div className="pointer-events-none flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:max-w-[24rem] sm:justify-end">
    <span className="rounded-full bg-[color:var(--accent-base)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] shadow-sm">
      {summary.current.name} · {summary.current.elevation_m.toFixed(2)} м
      {!compact ? ` · ${summary.ordinal}/${summary.total}` : ""}
    </span>
    {summary.previous ? (
      <span className={`rounded-full border border-[color:var(--info-border)] bg-[color:var(--info-bg)]/95 px-3 py-1.5 text-xs font-semibold text-[color:var(--info-fg)] shadow-sm ${compact ? "hidden md:inline-flex" : ""}`}>
        Ниже: {summary.previous.name} ({summary.previous.elevation_m.toFixed(2)} м)
      </span>
    ) : null}
    {summary.next ? (
      <span className={`rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--warning-fg)] shadow-sm ${compact ? "hidden md:inline-flex" : ""}`}>
        Выше: {summary.next.name} ({summary.next.elevation_m.toFixed(2)} м)
      </span>
    ) : null}
  </div>
);

const OverlayNoticeStack = ({
  notices,
  compact,
}: {
  notices: Array<{ id: string; title: string; description: string; tone: "neutral" | "info" | "warning" }>;
  compact: boolean;
}) => (
  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
    {notices.map((notice) => (
      <div
        key={notice.id}
        className={`max-w-full rounded-2xl border px-3 py-2 shadow-md backdrop-blur ${resolveOverlayToneClass(notice.tone)} ${compact ? "sm:max-w-[18rem]" : "sm:max-w-[22rem]"}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide">{notice.title}</p>
        <p className={`mt-1 text-xs leading-5 ${compact ? "max-h-10 overflow-hidden" : ""}`}>{notice.description}</p>
      </div>
    ))}
  </div>
);

const NetworkLegendOverlay = ({
  items,
  compact,
  show,
}: {
  items: Array<{ key: string; label: string; color: string }>;
  compact: boolean;
  show: boolean;
}) => {
  if (!show) {
    return null;
  }

  return (
    <div className={`pointer-events-none rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 shadow-lg backdrop-blur ${compact ? "w-full max-w-[18rem]" : "w-full max-w-[22rem]"}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">Сети</p>
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Типы трасс на уровне</p>
        </div>
        {!compact ? <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-muted)]">{items.length}</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-2.5 py-1 text-xs font-medium text-[color:var(--text-muted)]"
          >
            {item.key === "equipment" || item.key === "sensor" ? (
              <span
                className={`inline-block shrink-0 ${item.key === "sensor" ? "h-3.5 w-3.5 rounded-full border-2 border-white" : "h-3.5 w-3.5 rounded-md"}`}
                style={{ backgroundColor: item.color }}
              />
            ) : (
              <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true" className="shrink-0">
                <line
                  x1="1"
                  y1="5"
                  x2="21"
                  y2="5"
                  stroke={item.color}
                  strokeWidth={item.key === "duct" ? 3.2 : 2.6}
                  strokeDasharray={item.key === "duct" ? "5 3" : undefined}
                  strokeLinecap="round"
                />
              </svg>
            )}
            {compact ? item.label.split(" ")[0] : item.label}
          </span>
        ))}
      </div>
    </div>
  );
};

function resolveOverlayToneClass(tone: "neutral" | "info" | "warning"): string {
  switch (tone) {
    case "info":
      return "border-[color:var(--info-border)] bg-[color:var(--info-bg)]/92 text-[color:var(--info-fg)]";
    case "warning":
      return "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]";
    default:
      return "border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] text-[color:var(--text-muted)]";
  }
}

const NetworkFlowOverlay = ({
  path,
  color,
  kind,
  magnitude,
  direction,
  worldToScreen,
  offsetPx,
  emphasized = false,
  schematicMode = false,
  monochrome = false,
}: {
  path: Vec2[];
  color: string;
  kind: "pipe" | "duct";
  magnitude: number;
  direction: "forward" | "backward" | "unknown";
  worldToScreen: (point: Vec2) => Vec2;
  offsetPx: number;
  emphasized?: boolean;
  schematicMode?: boolean;
  monochrome?: boolean;
}) => {
  if (path.length < 2 || magnitude <= 0 || direction === "unknown") {
    return null;
  }
  const points = offsetScreenPolyline(path.map((point) => worldToScreen(point)), offsetPx);
  const pathPoints = direction === "backward" ? [...points].reverse() : points;
  const polylineLength = measurePolylineLength(pathPoints);
  if (polylineLength < 24) {
    return null;
  }
  const spacing = kind === "duct" ? 86 : 74;
  const arrowCount = Math.max(1, Math.min(4, Math.round(polylineLength / spacing)));
  const arrowColor = schematicMode && monochrome ? "#334155" : color;
  const markers = Array.from({ length: arrowCount }, (_, index) => {
    const offset = polylineLength * ((index + 1) / (arrowCount + 1));
    return samplePolylineAtLength(pathPoints, offset);
  }).filter((marker): marker is { point: Vec2; angle: number } => Boolean(marker));
  return (
    <g opacity={emphasized ? 0.86 : 0.58}>
      {markers.map((marker, index) => {
        const head = kind === "duct" ? 4.8 : 4.2;
        const tail = kind === "duct" ? 6.5 : 5.8;
        const base = {
          x: marker.point.x - Math.cos(marker.angle) * tail,
          y: marker.point.y - Math.sin(marker.angle) * tail,
        };
        const left = {
          x: marker.point.x - Math.cos(marker.angle) * head + Math.cos(marker.angle + Math.PI / 2) * head * 0.78,
          y: marker.point.y - Math.sin(marker.angle) * head + Math.sin(marker.angle + Math.PI / 2) * head * 0.78,
        };
        const right = {
          x: marker.point.x - Math.cos(marker.angle) * head + Math.cos(marker.angle - Math.PI / 2) * head * 0.78,
          y: marker.point.y - Math.sin(marker.angle) * head + Math.sin(marker.angle - Math.PI / 2) * head * 0.78,
        };
        return (
          <g key={`${marker.point.x}-${marker.point.y}-${index}`}>
            <line
              x1={base.x}
              y1={base.y}
              x2={marker.point.x}
              y2={marker.point.y}
              stroke={arrowColor}
              strokeWidth={schematicMode ? (kind === "duct" ? 1.45 : 1.25) : kind === "duct" ? 1.7 : 1.5}
              strokeLinecap="round"
            />
            <polyline
              points={`${left.x},${left.y} ${marker.point.x},${marker.point.y} ${right.x},${right.y}`}
              fill="none"
              stroke={arrowColor}
              strokeWidth={schematicMode ? (kind === "duct" ? 1.45 : 1.25) : kind === "duct" ? 1.7 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </g>
  );
};

const EquipmentConnectionOverlay = ({
  from,
  to,
  color,
  worldToScreen,
}: {
  from: Vec2;
  to: Vec2;
  color: string;
  worldToScreen: (point: Vec2) => Vec2;
}) => {
  const start = worldToScreen(from);
  const end = worldToScreen(to);
  return (
    <g opacity={0.85}>
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeWidth={1.8} strokeDasharray="5 4" />
      <circle cx={end.x} cy={end.y} r={2.5} fill={color} />
    </g>
  );
};

const ConnectionPointOverlay = ({
  point,
  worldToScreen,
  monochrome = false,
}: {
  point: EquipmentConnectionPoint;
  worldToScreen: (point: Vec2) => Vec2;
  monochrome?: boolean;
}) => {
  const screen = worldToScreen(point.position);
  const color = monochrome ? "#334155" : point.medium === "duct" ? "#0f766e" : "#2563eb";
  return (
    <g opacity={0.96} pointerEvents="none">
      <circle cx={screen.x} cy={screen.y} r={4.3} fill="rgba(255,255,255,0.98)" stroke={color} strokeWidth={1.4} />
      <circle cx={screen.x} cy={screen.y} r={1.5} fill={color} />
    </g>
  );
};

const EngineeringDiagnosticMarker = ({
  diagnostic,
  worldToScreen,
  monochrome = false,
}: {
  diagnostic: EngineeringNetworkDiagnostic;
  worldToScreen: (point: Vec2) => Vec2;
  monochrome?: boolean;
}) => {
  const point = worldToScreen(diagnostic.position);
  const color = diagnostic.severity === "error" ? "#e11d48" : monochrome ? "#92400e" : "#ea580c";
  return (
    <g opacity={0.96} pointerEvents="none">
      <circle cx={point.x} cy={point.y} r={6} fill="rgba(255,255,255,0.96)" stroke={color} strokeWidth={1.4} />
      <text x={point.x} y={point.y + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>
        !
      </text>
      <title>{diagnostic.message}</title>
    </g>
  );
};

const RoomStateOverlay = ({
  room,
  state,
  worldToScreen,
  schematicMode = false,
}: {
  room: Room;
  state: SmartModelSnapshot["roomStates"][number];
  worldToScreen: (point: Vec2) => Vec2;
  schematicMode?: boolean;
}) => {
  const center = worldToScreen(polygonCentroid(room.polygon));
  const warm = state.netHeatFlowW >= 0;
  const compact = Math.abs(polygonArea(room.polygon)) < 8;
  const width = compact ? 58 : 68;
  const height = compact ? 22 : 34;
  const boxY = compact ? center.y - 3 : center.y + 4;
  return (
    <g opacity={0.96}>
      <rect
        x={center.x - width / 2}
        y={compact ? boxY - 11 : boxY - 16}
        width={width}
        height={height}
        rx={10}
        fill={warm ? (schematicMode ? "rgba(255,247,237,0.94)" : "rgba(249,115,22,0.12)") : schematicMode ? "rgba(239,246,255,0.94)" : "rgba(14,165,233,0.12)"}
        stroke={warm ? "#f97316" : "#0ea5e9"}
      />
      <text
        x={center.x}
        y={compact ? boxY : boxY - 5}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-[color:var(--text-base)] text-[11px] font-semibold"
      >
        {state.temperatureC.toFixed(1)} °C
      </text>
      {!compact ? (
        <text
          x={center.x}
          y={boxY + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-[color:var(--text-soft)] text-[9px] font-medium"
        >
        {state.netHeatFlowW >= 0 ? "+" : ""}{state.netHeatFlowW.toFixed(0)} Вт
        </text>
      ) : null}
    </g>
  );
};

const EquipmentMarker = ({
  item,
  worldToScreen,
  selected,
  hovered,
  diagnostics = [],
  schematicMode = false,
  monochrome = false,
  annotationMode = "hover",
  exportMode = false,
}: {
  item: Equipment;
  worldToScreen: (point: Vec2) => Vec2;
  selected: boolean;
  hovered?: boolean;
  diagnostics?: EngineeringNetworkDiagnostic[];
  schematicMode?: boolean;
  monochrome?: boolean;
  annotationMode?: "hover" | "always";
  exportMode?: boolean;
}) => {
  const point = worldToScreen(item.position);
  const emphasized = selected || hovered;
  const name = getEquipmentDisplayName(item.id, [item]);
  const power = formatEngineeringPower(item.params.nominalPowerW);
  const warnings = diagnostics.filter((entry) => entry.severity === "warning").length;
  const errors = diagnostics.filter((entry) => entry.severity === "error").length;
  const showAnnotation = !exportMode && (annotationMode === "always" || emphasized);
  return (
    <g>
      {!exportMode && !schematicMode ? (
        <rect
          x={point.x - 15}
          y={point.y - 12}
          width={30}
          height={24}
          rx={4}
          fill="var(--surface-base, #ffffff)"
          opacity={emphasized ? 0.96 : 0.88}
          stroke={emphasized ? "var(--accent-base, #2563eb)" : "var(--border-soft, #cbd5e1)"}
          strokeWidth={emphasized ? 1.4 : 0.8}
        />
      ) : null}
      {renderEquipmentPlanSymbol(item.type, point.x, point.y, {
        selected,
        hovered,
        warning: warnings > 0,
        error: errors > 0,
        monochrome,
      })}
      <title>{`${getEquipmentDisplayName(item.id, [item])}${typeof item.params.nominalPowerW === "number" ? `\n${item.params.nominalPowerW.toFixed(0)} Вт` : ""}`}</title>
      {emphasized && !exportMode && !schematicMode ? (
        <text x={point.x + 14} y={point.y + 4} className="fill-[color:var(--text-muted)] text-[10px] font-semibold">
          {getEquipmentDisplayName(item.id, [item])}
        </text>
      ) : null}
      {showAnnotation && schematicMode ? (
        <>
          <line
            x1={point.x + 9}
            y1={point.y - 3}
            x2={point.x + 20}
            y2={point.y - 16}
            stroke="#64748b"
            strokeWidth={1.1}
          />
          <rect
            x={point.x + 20}
            y={point.y - 28}
            width={Math.max(112, name.length * 6 + 26)}
            height={power ? 28 : 18}
            rx={8}
            fill="rgba(255,255,255,0.97)"
            stroke={errors ? "#e11d48" : warnings ? "#ea580c" : "rgba(203,213,225,0.92)"}
          />
          <text x={point.x + 28} y={point.y - 16} className="fill-[color:var(--text-base)] text-[10px] font-semibold">
            {name}
          </text>
          {power ? (
            <text x={point.x + 28} y={point.y - 5} className="fill-[color:var(--text-soft)] text-[9px] font-medium">
              {power}
            </text>
          ) : null}
        </>
      ) : null}
      {errors ? <circle cx={point.x - 11} cy={point.y - 11} r={4} fill="#e11d48" /> : null}
      {!errors && warnings ? <circle cx={point.x - 11} cy={point.y - 11} r={4} fill="#ea580c" /> : null}
    </g>
  );
};

const SensorMarker = ({
  sensor,
  worldToScreen,
  selected,
  hovered,
  schematicMode = false,
  monochrome = false,
  exportMode = false,
}: {
  sensor: SensorDevice;
  worldToScreen: (point: Vec2) => Vec2;
  selected: boolean;
  hovered?: boolean;
  schematicMode?: boolean;
  monochrome?: boolean;
  exportMode?: boolean;
}) => {
  const point = worldToScreen(sensor.position);
  const emphasized = selected || hovered;
  const color = schematicMode && monochrome ? "#475569" : selected ? "#0f766e" : "#0ea5e9";
  return (
    <g>
      <circle cx={point.x} cy={point.y} r={emphasized ? 9 : 7.5} fill="rgba(255,255,255,0.94)" stroke="rgba(203,213,225,0.9)" />
      <line x1={point.x} y1={point.y + 7} x2={point.x} y2={point.y + 12} stroke="#94a3b8" strokeWidth={1.3} />
      <circle cx={point.x} cy={point.y} r={selected ? 5.5 : 4.2} fill={color} opacity={0.95} />
      <circle cx={point.x} cy={point.y} r={selected ? 2.3 : 1.8} fill="#ffffff" opacity={0.95} />
      <title>{SENSOR_TYPE_LABELS[sensor.type]}</title>
      {emphasized && !exportMode ? (
        <text x={point.x + 11} y={point.y + 4} className="fill-[color:var(--text-muted)] text-[10px] font-semibold">
          {SENSOR_TYPE_LABELS[sensor.type]}
        </text>
      ) : null}
    </g>
  );
};

const NetworkHoverOverlay = ({
  card,
  containerSize,
  compact,
}: {
  card: NetworkHoverCard;
  containerSize: { width: number; height: number };
  compact: boolean;
}) => {
  const width = compact ? 220 : 252;
  const left = Math.max(14, Math.min(card.screen.x + 14, containerSize.width - width - 14));
  const top = Math.max(14, Math.min(card.screen.y + 14, containerSize.height - 132));
  return (
    <div
      className="pointer-events-none absolute z-30 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 shadow-xl backdrop-blur"
      style={{ left, top, width }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: card.accent }} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[color:var(--text-base)]">{card.title}</p>
          {card.subtitle ? <p className="mt-0.5 text-xs text-[color:var(--text-soft)]">{card.subtitle}</p> : null}
        </div>
      </div>
      {card.details.length ? (
        <div className="mt-2 grid gap-1.5 text-[11px] text-[color:var(--text-muted)]">
          {card.details.slice(0, 3).map((detail, index) => (
            <div key={`${card.selection.id}-${index}`} className="rounded-xl bg-[color:var(--surface-muted)] px-2.5 py-1.5">
              {detail}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

function buildNetworkHoverCard(
  selection: Extract<NonNullable<Selection>, { kind: "pipe" | "duct" | "equipment" | "sensor" }>,
  context: {
    model: BuildingModel;
    screen: Vec2;
  }
): NetworkHoverCard | null {
  if (selection.kind === "pipe") {
    const pipe = context.model.pipes.find((entry) => entry.id === selection.id);
    if (!pipe) {
      return null;
    }
    return {
      selection,
      screen: context.screen,
      title: getPipeDisplayLabel(context.model.pipes, pipe.id),
      subtitle: `${Math.round(pipe.diameter_mm)} мм · ${PIPE_TYPE_LABELS[pipe.type]}`,
      details: buildPipeHoverDetails(pipe),
      accent: resolvePipeColor(pipe),
    };
  }
  if (selection.kind === "duct") {
    const duct = context.model.ducts.find((entry) => entry.id === selection.id);
    if (!duct) {
      return null;
    }
    const width = duct.section.width_mm ?? duct.section.diameter_mm ?? 300;
    const height = duct.section.height_mm ?? duct.section.diameter_mm ?? 220;
    return {
      selection,
      screen: context.screen,
      title: "Воздуховод",
      subtitle: `${Math.round(width)}×${Math.round(height)} мм`,
      details: buildDuctHoverDetails(duct),
      accent: "#64748b",
    };
  }
  if (selection.kind === "equipment") {
    const equipment = context.model.equipment.find((entry) => entry.id === selection.id);
    if (!equipment) {
      return null;
    }
    return {
      selection,
      screen: context.screen,
      title: getEquipmentDisplayName(selection.id, context.model.equipment),
      subtitle: EQUIPMENT_TYPE_LABELS[equipment.type],
      details: buildEquipmentHoverDetails(context.model, equipment),
      accent: equipment.type === "diffuser" ? "#38bdf8" : equipment.type === "ahu" ? "#19897b" : equipment.type === "radiator" ? "#d9485f" : "#7c5cff",
    };
  }
  const sensor = context.model.sensors.find((entry) => entry.id === selection.id);
  if (!sensor) {
    return null;
  }
  return {
    selection,
    screen: context.screen,
    title: SENSOR_TYPE_LABELS[sensor.type],
    subtitle: "Датчик",
    details: buildSensorHoverDetails(context.model, sensor),
    accent: "#0ea5e9",
  };
}

function measurePolylineLength(path: Vec2[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y);
  }
  return total;
}

function samplePolylineAtLength(path: Vec2[], distanceTarget: number): { point: Vec2; angle: number } | null {
  let traversed = 0;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length <= 0.001) {
      continue;
    }
    if (traversed + length >= distanceTarget) {
      const ratio = (distanceTarget - traversed) / length;
      return {
        point: {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
        },
        angle: Math.atan2(end.y - start.y, end.x - start.x),
      };
    }
    traversed += length;
  }
  if (path.length >= 2) {
    const start = path[path.length - 2];
    const end = path[path.length - 1];
    return {
      point: end,
      angle: Math.atan2(end.y - start.y, end.x - start.x),
    };
  }
  return null;
}

export default Canvas2D;
