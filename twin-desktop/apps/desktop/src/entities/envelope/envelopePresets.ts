import type {
  ConstructionLayer,
  FloorSlab,
  OpeningBase,
  Roof,
  Sp50ConstructionType,
  Wall,
  WallLayer,
} from "../geometry/types";
import { computeWallProperties, DEFAULT_WALL_ASSEMBLY_ID, WALL_ASSEMBLIES } from "../material/types";

export type EnvelopePresetKind = "wall" | "window" | "door" | "roof" | "slab";

export interface EnvelopePreset {
  id: string;
  kind: EnvelopePresetKind;
  name: string;
  category: string;
  description: string;
  sourceNote: string;
  layers?: WallLayer[];
  reportLayers?: ConstructionLayer[];
  wallAssemblyId?: string;
  assemblyId?: string | null;
  constructionType?: Sp50ConstructionType;
  /** Явный U для runtime (окна/двери). */
  runtimeU_W_m2K?: number;
  thickness_m?: number;
  roofKind?: Roof["kind"];
  slabKind?: FloorSlab["kind"];
  heatedSide?: "below" | "above";
}

const EXTERIOR_WALL_LAYERS: WallLayer[] = [
  { materialId: "cement_sand_plaster", thickness_m: 0.02 },
  { materialId: "aerated_concrete", thickness_m: 0.3 },
  { materialId: "mineral_wool", thickness_m: 0.12 },
  { materialId: "gypsum_plaster", thickness_m: 0.015 },
];

const INTERIOR_WALL_LAYERS: WallLayer[] = [
  { materialId: "gypsum_board", thickness_m: 0.0125 },
  { materialId: "mineral_wool", thickness_m: 0.08 },
  { materialId: "gypsum_board", thickness_m: 0.0125 },
];

const ROOF_LAYERS: WallLayer[] = [
  { materialId: "gypsum_board", thickness_m: 0.0125 },
  { materialId: "mineral_wool", thickness_m: 0.24 },
  { materialId: "plywood", thickness_m: 0.018 },
];

const ROOF_FLAT_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.18 },
  { materialId: "xps", thickness_m: 0.12 },
  { materialId: "cement_sand_plaster", thickness_m: 0.04 },
];

const FLOOR_GROUND_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.18 },
  { materialId: "xps", thickness_m: 0.1 },
  { materialId: "cement_sand_plaster", thickness_m: 0.05 },
];

const FLOOR_INTER_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.2 },
  { materialId: "mineral_wool", thickness_m: 0.06 },
  { materialId: "cement_sand_plaster", thickness_m: 0.04 },
];

const FLOOR_ATTIC_LAYERS: WallLayer[] = [
  { materialId: "gypsum_board", thickness_m: 0.0125 },
  { materialId: "mineral_wool", thickness_m: 0.2 },
  { materialId: "plywood", thickness_m: 0.018 },
];

const WINDOW_REPORT_LAYERS: ConstructionLayer[] = [
  { materialId: "pvc_double_glazed_unit_equivalent", thickness_m: 0.07 },
];

const DOOR_INSULATED_LAYERS: ConstructionLayer[] = [
  { materialId: "wood", thickness_m: 0.04 },
  { materialId: "eps", thickness_m: 0.05 },
  { materialId: "plywood", thickness_m: 0.01 },
];

const DOOR_INTERIOR_LAYERS: ConstructionLayer[] = [{ materialId: "wood", thickness_m: 0.04 }];

function cloneLayers<T extends ConstructionLayer>(layers: T[]): T[] {
  return layers.map((layer) => ({ ...layer }));
}

function resolveRuntimeUFromLayers(layers: ConstructionLayer[] | undefined, fallback: number): number {
  const props = layers?.length ? computeWallProperties(layers, undefined, { includeSp50AirFilms: true }) : null;
  return props?.uTotal_W_m2K ?? fallback;
}

export const ENVELOPE_PRESETS: Record<string, EnvelopePreset> = {
  "wall-exterior-aerated-insulated": {
    id: "wall-exterior-aerated-insulated",
    kind: "wall",
    name: "Наружная: газобетон + минвата",
    category: "Наружные стены",
    description: "Типовая наружная стена жилого дома по СП 50.",
    sourceNote: "Типовой состав: штукатурка, газобетон D500, минвата 120 мм, внутренняя отделка.",
    layers: cloneLayers(EXTERIOR_WALL_LAYERS),
    wallAssemblyId: "exterior-aerated-insulated",
    constructionType: "wall",
    thickness_m: 0.34,
  },
  "wall-interior-partition": {
    id: "wall-interior-partition",
    kind: "wall",
    name: "Перегородка: ГКЛ + минвата",
    category: "Внутренние стены",
    description: "Лёгкая звуко- и теплоизоляционная перегородка.",
    sourceNote: "Типовой каркасно-облицовочный узел с минватой между листами ГКЛ.",
    layers: cloneLayers(INTERIOR_WALL_LAYERS),
    wallAssemblyId: "interior-partition",
    constructionType: "wall",
    thickness_m: 0.16,
  },
  "wall-masonry-insulated": {
    id: "wall-masonry-insulated",
    kind: "wall",
    name: "Кирпич + утеплитель",
    category: "Наружные стены",
    description: "Кирпичная кладка с наружным или внутренним утеплителем.",
    sourceNote: "На базе типовой сборки masonry из библиотеки материалов.",
    layers: cloneLayers(WALL_ASSEMBLIES.masonry.layers),
    wallAssemblyId: "masonry",
    constructionType: "wall",
    thickness_m: 0.3,
  },
  "window-pvc-double-glazed": {
    id: "window-pvc-double-glazed",
    kind: "window",
    name: "Окно ПВХ, 2-камерный СП",
    category: "Окна",
    description: "Современный ПВХ-блок с двухкамерным стеклопакетом.",
    sourceNote:
      "ПВХ 3-кам., СП 4-16Ar-4-14Ar-4И; Uw=1,2 Вт/(м²·К) — типовой паспорт энергоэффективного блока (ГОСТ 30674-99, R≥0,83 м²·K/Вт; базовый 4-10-4-10-4 ≈1,96 Вт/(м²·К)).",
    reportLayers: cloneLayers(WINDOW_REPORT_LAYERS),
    runtimeU_W_m2K: 1.2,
    constructionType: "window",
  },
  "window-wood-double-glazed": {
    id: "window-wood-double-glazed",
    kind: "window",
    name: "Окно деревянное, 2-камерный СП",
    category: "Окна",
    description: "Деревянный блок с двухкамерным стеклопакетом.",
    sourceNote: "Runtime: типовой U деревянного окна; отчёт: эквивалентный слой.",
    reportLayers: [{ materialId: "window_block", thickness_m: 0.04 }],
    runtimeU_W_m2K: 1.1,
    constructionType: "window",
  },
  "door-insulated-entry": {
    id: "door-insulated-entry",
    kind: "door",
    name: "Входная утеплённая",
    category: "Двери",
    description: "Металлическая или деревянная входная дверь с утеплителем.",
    sourceNote: "Runtime: типовой U утеплённой входной двери; отчёт: эквивалентная панель.",
    reportLayers: cloneLayers(DOOR_INSULATED_LAYERS),
    runtimeU_W_m2K: resolveRuntimeUFromLayers(DOOR_INSULATED_LAYERS, 1.2),
    constructionType: "door",
  },
  "door-interior-light": {
    id: "door-interior-light",
    kind: "door",
    name: "Межкомнатная лёгкая",
    category: "Двери",
    description: "Внутренняя дверь без специального утепления.",
    sourceNote: "Runtime: типовой U внутренней двери; отчёт: деревянная панель.",
    reportLayers: cloneLayers(DOOR_INTERIOR_LAYERS),
    runtimeU_W_m2K: 2.0,
    constructionType: "door",
  },
  "roof-insulated-pitched": {
    id: "roof-insulated-pitched",
    kind: "roof",
    name: "Скатная утеплённая",
    category: "Кровля",
    description: "Скатная кровля с минватой и облицовкой.",
    sourceNote: "Типовой утеплённый скатный пирог для жилого дома.",
    layers: cloneLayers(ROOF_LAYERS),
    assemblyId: "roof-insulated-pitched",
    constructionType: "covering",
    roofKind: "pitched",
    heatedSide: "below",
    thickness_m: 0.24,
  },
  "roof-insulated-flat": {
    id: "roof-insulated-flat",
    kind: "roof",
    name: "Плоская утеплённая",
    category: "Кровля",
    description: "Эксплуатируемая или неэксплуатируемая плоская кровля.",
    sourceNote: "Ж/б плита, XPS, стяжка — типовой плоский пирог.",
    layers: cloneLayers(ROOF_FLAT_LAYERS),
    assemblyId: "roof-insulated-flat",
    constructionType: "covering",
    roofKind: "flat",
    heatedSide: "below",
    thickness_m: 0.24,
  },
  "slab-interfloor": {
    id: "slab-interfloor",
    kind: "slab",
    name: "Межэтажное перекрытие",
    category: "Перекрытия",
    description: "Ж/б плита с локальной звукоизоляцией.",
    sourceNote: "Типовое межэтажное перекрытие жилого дома.",
    layers: cloneLayers(FLOOR_INTER_LAYERS),
    assemblyId: "slab-interfloor",
    constructionType: "atticFloor",
    slabKind: "interfloor",
    heatedSide: "below",
    thickness_m: 0.22,
  },
  "slab-attic": {
    id: "slab-attic",
    kind: "slab",
    name: "Чердачное перекрытие",
    category: "Перекрытия",
    description: "Утеплённое перекрытие над холодным чердаком.",
    sourceNote: "Типовой пирог чердачного перекрытия с минватой.",
    layers: cloneLayers(FLOOR_ATTIC_LAYERS),
    assemblyId: "slab-attic",
    constructionType: "atticFloor",
    slabKind: "attic",
    heatedSide: "below",
    thickness_m: 0.22,
  },
  "slab-ground": {
    id: "slab-ground",
    kind: "slab",
    name: "Пол по грунту",
    category: "Перекрытия",
    description: "Плита по грунту с extruded polystyrene.",
    sourceNote: "Типовой пол по грунту для жилого дома.",
    layers: cloneLayers(FLOOR_GROUND_LAYERS),
    assemblyId: "slab-ground",
    constructionType: "floorOnGround",
    slabKind: "ground",
    heatedSide: "above",
    thickness_m: 0.22,
  },
};

export const DEFAULT_ENVELOPE_PRESET_IDS: Record<EnvelopePresetKind, string> = {
  wall: "wall-exterior-aerated-insulated",
  window: "window-pvc-double-glazed",
  door: "door-insulated-entry",
  roof: "roof-insulated-pitched",
  slab: "slab-interfloor",
};

export const DEFAULT_WALL_PRESET_ID = DEFAULT_ENVELOPE_PRESET_IDS.wall;

export function getEnvelopePreset(id: string | null | undefined): EnvelopePreset | undefined {
  if (!id) {
    return undefined;
  }
  return ENVELOPE_PRESETS[id];
}

export function listEnvelopePresets(kind: EnvelopePresetKind): EnvelopePreset[] {
  return Object.values(ENVELOPE_PRESETS).filter((preset) => preset.kind === kind);
}

export function resolveDefaultPresetId(kind: EnvelopePresetKind): string {
  return DEFAULT_ENVELOPE_PRESET_IDS[kind];
}

export function resolvePresetLayers(preset: EnvelopePreset): ConstructionLayer[] {
  return cloneLayers(preset.layers ?? preset.reportLayers ?? []);
}

export function applyEnvelopePresetToWall(wall: Wall, presetId: string): Wall {
  const preset = getEnvelopePreset(presetId);
  if (!preset || preset.kind !== "wall") {
    return wall;
  }
  return {
    ...wall,
    envelopePresetId: preset.id,
    wallAssemblyId: preset.wallAssemblyId ?? wall.wallAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID,
    layers: resolvePresetLayers(preset),
    thickness_m: preset.thickness_m ?? wall.thickness_m,
  };
}

export function applyEnvelopePresetToWindow<T extends OpeningBase>(
  opening: T,
  presetId: string
): T {
  const preset = getEnvelopePreset(presetId);
  if (!preset || preset.kind !== "window") {
    return opening;
  }
  return {
    ...opening,
    envelopePresetId: preset.id,
    runtimeU_W_m2K: preset.runtimeU_W_m2K,
    reportLayers: resolvePresetLayers(preset),
  };
}

export function applyEnvelopePresetToDoor<T extends OpeningBase>(
  opening: T,
  presetId: string
): T {
  const preset = getEnvelopePreset(presetId);
  if (!preset || preset.kind !== "door") {
    return opening;
  }
  return {
    ...opening,
    envelopePresetId: preset.id,
    runtimeU_W_m2K: preset.runtimeU_W_m2K,
    reportLayers: resolvePresetLayers(preset),
  };
}

export function applyEnvelopePresetToRoof(roof: Roof, presetId: string): Roof {
  const preset = getEnvelopePreset(presetId);
  if (!preset || preset.kind !== "roof") {
    return roof;
  }
  return {
    ...roof,
    envelopePresetId: preset.id,
    kind: preset.roofKind ?? roof.kind,
    layers: resolvePresetLayers(preset),
    assemblyId: preset.assemblyId ?? roof.assemblyId ?? null,
    heatedSide: preset.heatedSide ?? roof.heatedSide,
    thickness_m: preset.thickness_m ?? roof.thickness_m,
  };
}

export function applyEnvelopePresetToFloorSlab(slab: FloorSlab, presetId: string): FloorSlab {
  const preset = getEnvelopePreset(presetId);
  if (!preset || preset.kind !== "slab") {
    return slab;
  }
  return {
    ...slab,
    envelopePresetId: preset.id,
    kind: preset.slabKind ?? slab.kind,
    layers: resolvePresetLayers(preset),
    assemblyId: preset.assemblyId ?? slab.assemblyId ?? null,
    heatedSide: preset.heatedSide ?? slab.heatedSide,
    thickness_m: preset.thickness_m ?? slab.thickness_m,
  };
}

export function describeEnvelopePreset(presetId: string | null | undefined): string | null {
  const preset = getEnvelopePreset(presetId);
  return preset ? `${preset.name} · ${preset.sourceNote}` : null;
}
