import type { Twin } from "../../../shared/api/types";
import { createEmptyBuildingModel, type BuildingModel, type Vec2, type Wall } from "../../../entities/geometry/types";
import { DEFAULT_OPERATIONAL_SCENARIOS } from "../../../entities/networks/types";
import { createId } from "../../../shared/utils/id";
import { sanitizeDisplayText } from "../../../shared/utils/displayText";

const DEFAULT_ROOM_AREA_M2 = 25;
const DEFAULT_ROOM_HEIGHT_M = 3;
const DEFAULT_WALL_THICKNESS_M = 0.25;
const ROOM_GAP_M = 1.5;
const ROW_LIMIT_M = 42;
const GRID_STEP_M = 0.5;

function buildImportedLevelName(index: number): string {
  return `Уровень ${Math.max(1, index)}`;
}

function buildImportedRoomName(index: number): string {
  return `Помещение ${Math.max(1, index)}`;
}

function roundToGrid(value: number): number {
  return Math.max(GRID_STEP_M, Math.round(value / GRID_STEP_M) * GRID_STEP_M);
}

function estimateRoomSize(areaM2?: number | null): { width: number; depth: number } {
  const area = areaM2 && areaM2 > 1 ? areaM2 : DEFAULT_ROOM_AREA_M2;
  const width = roundToGrid(Math.max(3, Math.sqrt(area)));
  const depth = roundToGrid(Math.max(3, area / width));
  return { width, depth };
}

function estimateRoomHeight(areaM2?: number | null, volumeM3?: number | null): number {
  if (areaM2 && areaM2 > 0 && volumeM3 && volumeM3 > 0) {
    return roundToGrid(Math.max(2.7, Math.min(4.5, volumeM3 / areaM2)));
  }
  return DEFAULT_ROOM_HEIGHT_M;
}

function rectPolygon(x: number, y: number, width: number, depth: number): Vec2[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth },
  ];
}

function buildWalls(levelId: string, polygon: Vec2[], heightM: number): Wall[] {
  return polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return {
      id: createId("wall"),
      levelId,
      a: { ...point },
      b: { ...next },
      thickness_m: DEFAULT_WALL_THICKNESS_M,
      height_m: heightM,
    };
  });
}

export function buildModelFromTwin(twin: Twin, sourceProjectId: string | null): BuildingModel {
  const model = createEmptyBuildingModel();
  const spaces = Array.isArray(twin.spaces) ? twin.spaces : [];
  const levelOrder = new Map<string, string>();

  spaces.forEach((space, index) => {
    const levelName = sanitizeDisplayText(space.level, buildImportedLevelName(index + 1), { allowInternalId: false });
    if (!levelOrder.has(levelName)) {
      levelOrder.set(levelName, createId(`lvl${index + 1}`));
    }
  });

  if (!levelOrder.size) {
    levelOrder.set(buildImportedLevelName(1), createId("lvl1"));
  }

  model.levels = Array.from(levelOrder.entries()).map(([name, id], index) => ({
    id,
    name,
    elevation_m: index * DEFAULT_ROOM_HEIGHT_M,
    height_m: DEFAULT_ROOM_HEIGHT_M,
  }));

  const levelState = new Map<string, { cursorX: number; cursorY: number; rowDepth: number }>();

  spaces.forEach((space, index) => {
    const levelName = sanitizeDisplayText(space.level, buildImportedLevelName(index + 1), { allowInternalId: false });
    const levelId = levelOrder.get(levelName) ?? model.levels[0]?.id;
    if (!levelId) {
      return;
    }

    const state = levelState.get(levelId) ?? { cursorX: 0, cursorY: 0, rowDepth: 0 };
    const { width, depth } = estimateRoomSize(space.area_m2);
    const roomHeight = estimateRoomHeight(space.area_m2, space.volume_m3);

    if (state.cursorX + width > ROW_LIMIT_M) {
      state.cursorX = 0;
      state.cursorY += state.rowDepth + ROOM_GAP_M;
      state.rowDepth = 0;
    }

    const polygon = rectPolygon(state.cursorX, state.cursorY, width, depth);
    model.rooms.push({
      id: space.id || createId("room"),
      name: sanitizeDisplayText(space.name, buildImportedRoomName(index + 1), { allowInternalId: false }),
      levelId,
      polygon,
      source: "manual",
    });
    model.walls.push(...buildWalls(levelId, polygon, roomHeight));

    state.cursorX += width + ROOM_GAP_M;
    state.rowDepth = Math.max(state.rowDepth, depth);
    levelState.set(levelId, state);
  });

  model.scenarios = DEFAULT_OPERATIONAL_SCENARIOS.map((scenario) => ({
    ...scenario,
    impact: {
      ...scenario.impact,
      equipmentStateOverrides: { ...scenario.impact.equipmentStateOverrides },
    },
  }));
  model.activeScenarioId = model.scenarios[0]?.id ?? null;
  model.meta = {
    name: typeof twin.building?.name === "string" ? twin.building.name : "Импортированная модель",
    source: twin.meta?.source ?? "engine",
    sourceProjectId,
    generatedGeometry: true,
    importedAt: new Date().toISOString(),
    note:
      "Редактируемая BIM-модель собрана автоматически по помещениям, потому что исходный IFC-движок не передает точную геометрию стен и проемов.",
  };

  return model;
}
