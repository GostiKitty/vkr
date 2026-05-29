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
  /** Коэффициент пропускания солнечной радиации (SHGC / g-value). */
  gValue?: number;
  /** Коэффициент затенения (1 = нет затенения, 0 = полное затенение). */
  shadingFactor?: number;
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

const BRICK_THREE_LAYER_LAYERS: WallLayer[] = [
  { materialId: "ceramic_brick", thickness_m: 0.25 },
  { materialId: "mineral_wool", thickness_m: 0.1 },
  { materialId: "ceramic_brick", thickness_m: 0.12 },
];

const CONCRETE_PANEL_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.16 },
  { materialId: "xps", thickness_m: 0.1 },
  { materialId: "cement_sand_plaster", thickness_m: 0.02 },
];

const HOLLOW_CERAMIC_BLOCK_LAYERS: WallLayer[] = [
  { materialId: "lime_plaster", thickness_m: 0.015 },
  { materialId: "hollow_ceramic_block", thickness_m: 0.38 },
  { materialId: "gypsum_plaster", thickness_m: 0.015 },
];

const TIMBER_FRAME_LAYERS: WallLayer[] = [
  { materialId: "gypsum_board", thickness_m: 0.0125 },
  { materialId: "mineral_wool", thickness_m: 0.15 },
  { materialId: "osb", thickness_m: 0.012 },
];

const LOG_WALL_LAYERS: WallLayer[] = [
  { materialId: "wood", thickness_m: 0.22 },
];

const MASONRY_TWO_LAYER_LAYERS: WallLayer[] = [
  { materialId: "silicate_brick", thickness_m: 0.38 },
  { materialId: "mineral_wool", thickness_m: 0.12 },
];

const AERATED_CONCRETE_SLAG_WOOL_LAYERS: WallLayer[] = [
  { materialId: "cement_sand_plaster", thickness_m: 0.02 },
  { materialId: "aerated_concrete", thickness_m: 0.3 },
  { materialId: "slag_wool", thickness_m: 0.1 },
  { materialId: "gypsum_plaster", thickness_m: 0.015 },
];

const CLT_PANEL_LAYERS: WallLayer[] = [
  { materialId: "glued_laminated_timber", thickness_m: 0.16 },
  { materialId: "mineral_wool", thickness_m: 0.1 },
  { materialId: "gypsum_board", thickness_m: 0.0125 },
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

const ROOF_METAL_TILE_LAYERS: WallLayer[] = [
  { materialId: "gypsum_board", thickness_m: 0.0125 },
  { materialId: "mineral_wool", thickness_m: 0.2 },
  { materialId: "osb", thickness_m: 0.012 },
  { materialId: "bitumen_roll", thickness_m: 0.004 },
];

const ROOF_INVERTED_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.18 },
  { materialId: "rubber_membrane", thickness_m: 0.003 },
  { materialId: "xps", thickness_m: 0.12 },
  { materialId: "concrete_screed", thickness_m: 0.04 },
];

const ROOF_GREEN_EXTENSIVE_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.18 },
  { materialId: "rubber_membrane", thickness_m: 0.005 },
  { materialId: "xps", thickness_m: 0.1 },
  { materialId: "green_roof_substrate", thickness_m: 0.1 },
];

const ROOF_SHED_LAYERS: WallLayer[] = [
  { materialId: "gypsum_board", thickness_m: 0.0125 },
  { materialId: "mineral_wool", thickness_m: 0.2 },
  { materialId: "osb", thickness_m: 0.012 },
];

const ROOF_MANSARD_LAYERS: WallLayer[] = [
  { materialId: "gypsum_board", thickness_m: 0.0125 },
  { materialId: "mineral_wool", thickness_m: 0.15 },
  { materialId: "mineral_wool", thickness_m: 0.1 },
  { materialId: "plywood", thickness_m: 0.018 },
];

const ROOF_HIP_LAYERS: WallLayer[] = [
  { materialId: "gypsum_board", thickness_m: 0.0125 },
  { materialId: "mineral_wool", thickness_m: 0.24 },
  { materialId: "plywood", thickness_m: 0.018 },
  { materialId: "bitumen_roll", thickness_m: 0.004 },
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

const FLOOR_INTER_PARQUET_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.18 },
  { materialId: "acoustic_mat", thickness_m: 0.02 },
  { materialId: "cement_sand_plaster", thickness_m: 0.05 },
  { materialId: "parquet", thickness_m: 0.015 },
];

const FLOOR_INTER_CERAMIC_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.18 },
  { materialId: "acoustic_mat", thickness_m: 0.02 },
  { materialId: "cement_sand_plaster", thickness_m: 0.05 },
  { materialId: "ceramic_tile", thickness_m: 0.01 },
];

const FLOOR_HEATED_CERAMIC_LAYERS: WallLayer[] = [
  { materialId: "reinforced_concrete", thickness_m: 0.18 },
  { materialId: "xps", thickness_m: 0.03 },
  { materialId: "cement_sand_plaster", thickness_m: 0.06 },
  { materialId: "ceramic_tile", thickness_m: 0.01 },
];

const FLOOR_BASEMENT_INSULATED_LAYERS: WallLayer[] = [
  { materialId: "mineral_wool", thickness_m: 0.12 },
  { materialId: "reinforced_concrete", thickness_m: 0.16 },
  { materialId: "cement_sand_plaster", thickness_m: 0.04 },
];

const FLOOR_GROUND_XPS_LAYERS: WallLayer[] = [
  { materialId: "sand_gravel", thickness_m: 0.1 },
  { materialId: "xps", thickness_m: 0.12 },
  { materialId: "reinforced_concrete", thickness_m: 0.15 },
  { materialId: "cement_sand_plaster", thickness_m: 0.05 },
];

const FLOOR_WOOD_FRAME_LAYERS: WallLayer[] = [
  { materialId: "plywood", thickness_m: 0.018 },
  { materialId: "mineral_wool", thickness_m: 0.15 },
  { materialId: "plywood", thickness_m: 0.018 },
  { materialId: "parquet", thickness_m: 0.015 },
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

const DOOR_METAL_PUR_LAYERS: ConstructionLayer[] = [
  { materialId: "steel_sheet", thickness_m: 0.002 },
  { materialId: "pur", thickness_m: 0.08 },
  { materialId: "steel_sheet", thickness_m: 0.002 },
];

const DOOR_WOODEN_INSULATED_LAYERS: ConstructionLayer[] = [
  { materialId: "wood", thickness_m: 0.04 },
  { materialId: "mineral_wool", thickness_m: 0.04 },
  { materialId: "plywood", thickness_m: 0.01 },
];

const DOOR_GLASS_ALUMINUM_LAYERS: ConstructionLayer[] = [
  { materialId: "glass", thickness_m: 0.008 },
];

const DOOR_OLD_WOODEN_LAYERS: ConstructionLayer[] = [
  { materialId: "wood", thickness_m: 0.04 },
];

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
  "wall-exterior-brick-three-layer": {
    id: "wall-exterior-brick-three-layer",
    kind: "wall",
    name: "Трёхслойная кирпичная стена",
    category: "Наружные стены",
    description: "Несущий керамический кирпич + минвата + лицевой кирпич. U≈0.30 Вт/(м²·К).",
    sourceNote: "СП 23-101-2004 §8; кирпич керамический 250 мм + минвата 100 мм + кирпич лицевой 120 мм.",
    layers: cloneLayers(BRICK_THREE_LAYER_LAYERS),
    wallAssemblyId: "masonry",
    constructionType: "wall",
    thickness_m: 0.47,
  },
  "wall-exterior-concrete-panel": {
    id: "wall-exterior-concrete-panel",
    kind: "wall",
    name: "Ж/б панель + ЭППС (типовая серия)",
    category: "Наружные стены",
    description: "Железобетонная несущая панель 160 мм с ЭППС 100 мм и штукатуркой. U≈0.31 Вт/(м²·К).",
    sourceNote: "Типовая панельная серия П-44Т/П-3М; ж/б 160 мм + XPS 100 мм + ц/п штукатурка 20 мм.",
    layers: cloneLayers(CONCRETE_PANEL_LAYERS),
    wallAssemblyId: "concrete",
    constructionType: "wall",
    thickness_m: 0.28,
  },
  "wall-exterior-hollow-ceramic-block": {
    id: "wall-exterior-hollow-ceramic-block",
    kind: "wall",
    name: "Поризованный блок Porotherm 38",
    category: "Наружные стены",
    description: "Однослойная стена из поризованных керамических блоков без доп. утеплителя. U≈0.40 Вт/(м²·К).",
    sourceNote: "Porotherm 38 (Wienerberger); λ_A=0.17 Вт/(м·К); известк. штукатурка снаружи, гипс. — внутри.",
    layers: cloneLayers(HOLLOW_CERAMIC_BLOCK_LAYERS),
    constructionType: "wall",
    thickness_m: 0.41,
  },
  "wall-exterior-timber-frame": {
    id: "wall-exterior-timber-frame",
    kind: "wall",
    name: "Каркасная стена (минвата 150 мм)",
    category: "Наружные стены",
    description: "Деревянный каркас с минватой 150 мм, OSB снаружи, ГКЛ внутри. U≈0.25 Вт/(м²·К).",
    sourceNote: "Типовой каркасный пирог; ГКЛ 12.5 мм + минвата 150 мм + OSB 12 мм; по ГОСТ Р 54854.",
    layers: cloneLayers(TIMBER_FRAME_LAYERS),
    constructionType: "wall",
    thickness_m: 0.175,
  },
  "wall-exterior-log": {
    id: "wall-exterior-log",
    kind: "wall",
    name: "Бревенчатая стена 220 мм",
    category: "Наружные стены",
    description: "Стена из бревна/профилированного бруса диаметром 220 мм. U≈0.58 Вт/(м²·К).",
    sourceNote: "Хвойная древесина λ_A=0.14 Вт/(м·К); типовой диаметр бревна 220 мм.",
    layers: cloneLayers(LOG_WALL_LAYERS),
    constructionType: "wall",
    thickness_m: 0.22,
  },
  "wall-exterior-silicate-minwool": {
    id: "wall-exterior-silicate-minwool",
    kind: "wall",
    name: "Силикатный кирпич + минвата вентфасад",
    category: "Наружные стены",
    description: "Силикатный кирпич 380 мм + минвата 120 мм вентилируемый фасад. U≈0.27 Вт/(м²·К).",
    sourceNote: "Типовая двухслойная система: силикатный кирпич 1.5NF 380 мм + минвата 120 мм.",
    layers: cloneLayers(MASONRY_TWO_LAYER_LAYERS),
    wallAssemblyId: "masonry",
    constructionType: "wall",
    thickness_m: 0.5,
  },
  "wall-exterior-aerated-slag-wool": {
    id: "wall-exterior-aerated-slag-wool",
    kind: "wall",
    name: "Газобетон + шлаковата",
    category: "Наружные стены",
    description: "Газобетон D500 300 мм + шлаковата 100 мм (экономичная альтернатива минвате). U≈0.27 Вт/(м²·К).",
    sourceNote: "Шлаковата λ_A=0.046 Вт/(м·К) по СП 50.13330.2024 Прил. М; аналог минваты из вторсырья.",
    layers: cloneLayers(AERATED_CONCRETE_SLAG_WOOL_LAYERS),
    constructionType: "wall",
    thickness_m: 0.435,
  },
  "wall-exterior-clt": {
    id: "wall-exterior-clt",
    kind: "wall",
    name: "CLT-панель + минвата",
    category: "Наружные стены",
    description: "Клееная древесная панель CLT 160 мм + минвата 100 мм + ГКЛ. U≈0.27 Вт/(м²·К).",
    sourceNote: "CLT (Cross Laminated Timber) по EN 16351; λ_A≈0.13 Вт/(м·К); применяется в малоэтажном и среднеэтажном строительстве.",
    layers: cloneLayers(CLT_PANEL_LAYERS),
    constructionType: "wall",
    thickness_m: 0.2725,
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
    gValue: 0.55,
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
    gValue: 0.58,
    constructionType: "window",
  },
  "window-pvc-triple-low-e": {
    id: "window-pvc-triple-low-e",
    kind: "window",
    name: "Окно ПВХ, 3-камерный СП Low-E + Ar",
    category: "Окна",
    description: "ПВХ-профиль 82 мм, 3-камерный стеклопакет с Low-E покрытием и аргоном. Uw≈0.8 Вт/(м²·К).",
    sourceNote: "VEKA Softline 82 AD / REHAU Geneo; СП 4-16Ar-4-16Ar-4И; Uw=0.80 Вт/(м²·К) по тех. паспорту.",
    reportLayers: cloneLayers(WINDOW_REPORT_LAYERS),
    runtimeU_W_m2K: 0.8,
    gValue: 0.38,
    constructionType: "window",
  },
  "window-pvc-single-glazed-legacy": {
    id: "window-pvc-single-glazed-legacy",
    kind: "window",
    name: "Окно ПВХ, 1-камерный СП 4-16-4 (старый)",
    category: "Окна",
    description: "ПВХ-блок с однокамерным стеклопакетом 4-16-4 без тепл. обработки. Uw≈2.0 Вт/(м²·К).",
    sourceNote: "Базовый СП 4-16-4 без Low-E; Uw≈2.0 Вт/(м²·К) по ГОСТ 30674-99; типично для продукции 2000-х гг.",
    reportLayers: [{ materialId: "window_block", thickness_m: 0.04 }],
    runtimeU_W_m2K: 2.0,
    gValue: 0.70,
    constructionType: "window",
  },
  "window-aluminum-warm": {
    id: "window-aluminum-warm",
    kind: "window",
    name: "Окно алюминий (тёплый профиль) + 2-камерный СП",
    category: "Окна",
    description: "Алюминиевая рама с термовставкой (warm-frame), 2-камерный стеклопакет. Uw≈1.4 Вт/(м²·К).",
    sourceNote: "Schüco AWS 75 / ALUMIL M9; 2-камерный СП с аргоном; Uw≈1.4 Вт/(м²·К) по данным производителей.",
    reportLayers: [{ materialId: "window_block", thickness_m: 0.04 }],
    runtimeU_W_m2K: 1.4,
    gValue: 0.50,
    constructionType: "window",
  },
  "window-wood-single-old": {
    id: "window-wood-single-old",
    kind: "window",
    name: "Окно деревянное советское (одинарное стекло)",
    category: "Окна",
    description: "Двойной деревянный переплёт с одинарным остеклением. Uw≈2.7 Вт/(м²·К).",
    sourceNote: "Советские ОС-ГОСТ 11214-86; двойная деревянная коробка + воздушная прослойка + одинарное стекло; Uw≈2.5–2.8 Вт/(м²·К).",
    reportLayers: [{ materialId: "window_block", thickness_m: 0.04 }],
    runtimeU_W_m2K: 2.7,
    gValue: 0.75,
    constructionType: "window",
  },
  "window-pvc-two-sash-improved": {
    id: "window-pvc-two-sash-improved",
    kind: "window",
    name: "Окно ПВХ, 2-камерный СП + низкоэмиссионное",
    category: "Окна",
    description: "ПВХ-профиль 70 мм, 2-камерный СП с i-стеклом и аргоном. Uw≈1.0 Вт/(м²·К).",
    sourceNote: "KBE 70 / PROPLEX Optima; СП 4-14Ar-4-14Ar-4И; Uw≈1.0 Вт/(м²·К) — энергоэффективный класс А.",
    reportLayers: cloneLayers(WINDOW_REPORT_LAYERS),
    runtimeU_W_m2K: 1.0,
    gValue: 0.45,
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
  "door-metal-pur-insulated": {
    id: "door-metal-pur-insulated",
    kind: "door",
    name: "Металлическая с ПУР-пеной (80 мм)",
    category: "Двери",
    description: "Стальная входная дверь с заполнением ПУР-пеной 80 мм. Ud≈0.9 Вт/(м²·К).",
    sourceNote: "Torex / Стальная линия; лист сталь 2 мм + ПУР 80 мм + лист сталь 2 мм; Ud≈0.9 Вт/(м²·К) с учётом тепловых мостов рамы.",
    reportLayers: cloneLayers(DOOR_METAL_PUR_LAYERS),
    runtimeU_W_m2K: 0.9,
    constructionType: "door",
  },
  "door-wooden-panel-insulated": {
    id: "door-wooden-panel-insulated",
    kind: "door",
    name: "Деревянная щитовая утеплённая",
    category: "Двери",
    description: "Деревянная щитовая дверь с заполнением минватой. Ud≈1.0 Вт/(м²·К).",
    sourceNote: "Типовая деревянная щитовая дверь с минватой 40 мм; дерево 40 мм + минвата 40 мм + фанера 10 мм; Ud≈1.0 Вт/(м²·К).",
    reportLayers: cloneLayers(DOOR_WOODEN_INSULATED_LAYERS),
    runtimeU_W_m2K: 1.0,
    constructionType: "door",
  },
  "door-glass-aluminum": {
    id: "door-glass-aluminum",
    kind: "door",
    name: "Стеклянная в алюминиевой раме",
    category: "Двери",
    description: "Входная стеклянная дверь в алюминиевой раме (лобби, офис). Ud≈2.5 Вт/(м²·К).",
    sourceNote: "Стеклянная дверь с алюминиевой рамой без термовставки; Ud≈2.5 Вт/(м²·К) по паспортным данным системных профилей.",
    reportLayers: cloneLayers(DOOR_GLASS_ALUMINUM_LAYERS),
    runtimeU_W_m2K: 2.5,
    constructionType: "door",
  },
  "door-old-wooden": {
    id: "door-old-wooden",
    kind: "door",
    name: "Старая деревянная (без утепления)",
    category: "Двери",
    description: "Советская деревянная дверь без утеплителя и уплотнителей. Ud≈3.0 Вт/(м²·К).",
    sourceNote: "Старые деревянные двери без теплоизоляционного заполнителя; щитовая конструкция 40 мм; Ud≈3.0 Вт/(м²·К).",
    reportLayers: cloneLayers(DOOR_OLD_WOODEN_LAYERS),
    runtimeU_W_m2K: 3.0,
    constructionType: "door",
  },
  "door-metal-mineral-wool": {
    id: "door-metal-mineral-wool",
    kind: "door",
    name: "Металлическая с минватой (50 мм)",
    category: "Двери",
    description: "Стальная дверь с заполнением минеральной ватой 50 мм. Ud≈1.2 Вт/(м²·К).",
    sourceNote: "Типовая металлическая дверь с минватой 50 мм (Гардиан, ДорХан); Ud≈1.2 Вт/(м²·К) по данным производителей.",
    reportLayers: [
      { materialId: "steel_sheet", thickness_m: 0.002 },
      { materialId: "mineral_wool", thickness_m: 0.05 },
      { materialId: "steel_sheet", thickness_m: 0.002 },
    ],
    runtimeU_W_m2K: 1.2,
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
  "roof-hip-insulated": {
    id: "roof-hip-insulated",
    kind: "roof",
    name: "Вальмовая утеплённая",
    category: "Кровля",
    description: "Четырёхскатная вальмовая крыша с минватой и рулонной гидроизоляцией.",
    sourceNote: "ГКЛ 12.5 мм + минвата 240 мм + фанера 18 мм + битумный рулон 4 мм; R≈6.1 м²·К/Вт.",
    layers: cloneLayers(ROOF_HIP_LAYERS),
    assemblyId: "roof-hip-insulated",
    constructionType: "covering",
    roofKind: "pitched",
    heatedSide: "below",
    thickness_m: 0.26,
  },
  "roof-shed-insulated": {
    id: "roof-shed-insulated",
    kind: "roof",
    name: "Односкатная утеплённая",
    category: "Кровля",
    description: "Односкатная кровля с минватой 200 мм и OSB-обрешёткой.",
    sourceNote: "ГКЛ 12.5 мм + минвата 200 мм + OSB 12 мм; R≈5.1 м²·К/Вт; монопитч для пристроек и гаражей.",
    layers: cloneLayers(ROOF_SHED_LAYERS),
    assemblyId: "roof-shed-insulated",
    constructionType: "covering",
    roofKind: "pitched",
    heatedSide: "below",
    thickness_m: 0.225,
  },
  "roof-mansard-insulated": {
    id: "roof-mansard-insulated",
    kind: "roof",
    name: "Мансардная ломаная",
    category: "Кровля",
    description: "Двухслойное утепление мансардного этажа (межстропильный + надстропильный слой минваты).",
    sourceNote: "ГКЛ 12.5 мм + минвата 150 мм (межстропильная) + минвата 100 мм (надстропильная) + фанера 18 мм; R≈6.4 м²·К/Вт.",
    layers: cloneLayers(ROOF_MANSARD_LAYERS),
    assemblyId: "roof-mansard-insulated",
    constructionType: "covering",
    roofKind: "pitched",
    heatedSide: "below",
    thickness_m: 0.28,
  },
  "roof-metal-tile": {
    id: "roof-metal-tile",
    kind: "roof",
    name: "Металлочерепица на стропилах",
    category: "Кровля",
    description: "Скатная кровля: металлочерепица, OSB-обрешётка, минвата 200 мм, ГКЛ изнутри.",
    sourceNote: "ГКЛ 12.5 мм + минвата 200 мм + OSB 12 мм + ветрозащитная мембрана 4 мм; R≈5.1 м²·К/Вт; металлочерепица учтена как несущий слой без теплосопротивления.",
    layers: cloneLayers(ROOF_METAL_TILE_LAYERS),
    assemblyId: "roof-metal-tile",
    constructionType: "covering",
    roofKind: "pitched",
    heatedSide: "below",
    thickness_m: 0.23,
  },
  "roof-inverted-flat": {
    id: "roof-inverted-flat",
    kind: "roof",
    name: "Инвертированная плоская",
    category: "Кровля",
    description: "Плоская эксплуатируемая кровля: гидроизоляция под утеплителем, XPS поверх, балластная стяжка.",
    sourceNote: "Ж/б 180 мм + мембрана ПВХ 3 мм + XPS 120 мм + стяжка 40 мм; R≈3.6 м²·К/Вт; схема «инверт» защищает гидроизоляцию от термоудара.",
    layers: cloneLayers(ROOF_INVERTED_LAYERS),
    assemblyId: "roof-inverted-flat",
    constructionType: "covering",
    roofKind: "flat",
    heatedSide: "below",
    thickness_m: 0.343,
  },
  "roof-green-extensive": {
    id: "roof-green-extensive",
    kind: "roof",
    name: "Зелёная кровля экстенсивная",
    category: "Кровля",
    description: "Плоская кровля с газоном/седум-ковром: мембрана, XPS, почвогрунт 100 мм.",
    sourceNote: "Ж/б 180 мм + мембрана ПВХ 5 мм + XPS 100 мм + субстрат 100 мм; R≈3.3 м²·К/Вт; экстенсивный газон по FLL Richtlinie.",
    layers: cloneLayers(ROOF_GREEN_EXTENSIVE_LAYERS),
    assemblyId: "roof-green-extensive",
    constructionType: "covering",
    roofKind: "flat",
    heatedSide: "below",
    thickness_m: 0.385,
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

  // ── Новые пресеты перекрытий ───────────────────────────────────────────────

  "slab-interfloor-parquet": {
    id: "slab-interfloor-parquet",
    kind: "slab",
    name: "Межэтажное с паркетом",
    category: "Перекрытия",
    description: "Ж/б плита + звукоизоляция + стяжка + паркетная доска.",
    sourceNote: "Ж/б 180 мм + акустический мат 20 мм + стяжка 50 мм + паркет 15 мм; итог 265 мм.",
    layers: cloneLayers(FLOOR_INTER_PARQUET_LAYERS),
    assemblyId: "slab-interfloor-parquet",
    constructionType: "atticFloor",
    slabKind: "interfloor",
    heatedSide: "below",
    thickness_m: 0.265,
  },

  "slab-interfloor-ceramic": {
    id: "slab-interfloor-ceramic",
    kind: "slab",
    name: "Межэтажное с керамической плиткой",
    category: "Перекрытия",
    description: "Ж/б плита + звукоизоляция + стяжка + керамогранит.",
    sourceNote: "Ж/б 180 мм + акустический мат 20 мм + стяжка 50 мм + плитка 10 мм; итог 260 мм.",
    layers: cloneLayers(FLOOR_INTER_CERAMIC_LAYERS),
    assemblyId: "slab-interfloor-ceramic",
    constructionType: "atticFloor",
    slabKind: "interfloor",
    heatedSide: "below",
    thickness_m: 0.26,
  },

  "slab-heated-floor-ceramic": {
    id: "slab-heated-floor-ceramic",
    kind: "slab",
    name: "Тёплый пол (водяной) + керамика",
    category: "Перекрытия",
    description: "Ж/б + ЭППС под трубы + стяжка с трубами + плитка. Обогрев снизу.",
    sourceNote: "Ж/б 180 мм + XPS 30 мм + стяжка с трубами 60 мм + плитка 10 мм; итог 280 мм; heatedSide=above (тепло вверх).",
    layers: cloneLayers(FLOOR_HEATED_CERAMIC_LAYERS),
    assemblyId: "slab-heated-floor-ceramic",
    constructionType: "atticFloor",
    slabKind: "interfloor",
    heatedSide: "above",
    thickness_m: 0.28,
  },

  "slab-basement-insulated": {
    id: "slab-basement-insulated",
    kind: "slab",
    name: "Над подвалом утеплённое",
    category: "Перекрытия",
    description: "Ж/б перекрытие над холодным подвалом с утеплением снизу.",
    sourceNote: "Минвата 120 мм (снизу) + ж/б 160 мм + стяжка 40 мм; итог 320 мм; R≈3.1 м²·К/Вт.",
    layers: cloneLayers(FLOOR_BASEMENT_INSULATED_LAYERS),
    assemblyId: "slab-basement-insulated",
    constructionType: "atticFloor",
    slabKind: "basement",
    heatedSide: "below",
    thickness_m: 0.32,
  },

  "slab-ground-xps-improved": {
    id: "slab-ground-xps-improved",
    kind: "slab",
    name: "Пол по грунту улучшенный (ЭППС 120 мм)",
    category: "Перекрытия",
    description: "Песчано-гравийная подготовка + ЭППС 120 мм + ж/б + стяжка.",
    sourceNote: "ПГС 100 мм + XPS 120 мм + ж/б 150 мм + стяжка 50 мм; итог 420 мм; R≈3.6 м²·К/Вт.",
    layers: cloneLayers(FLOOR_GROUND_XPS_LAYERS),
    assemblyId: "slab-ground-xps-improved",
    constructionType: "floorOnGround",
    slabKind: "ground",
    heatedSide: "above",
    thickness_m: 0.42,
  },

  "slab-wood-frame": {
    id: "slab-wood-frame",
    kind: "slab",
    name: "Деревянное перекрытие по лагам",
    category: "Перекрытия",
    description: "Каркасное деревянное перекрытие: фанера + минвата + фанера + паркет.",
    sourceNote: "Фанера 18 мм + минвата 150 мм + фанера 18 мм + паркет 15 мм; итог 201 мм; R≈3.8 м²·К/Вт.",
    layers: cloneLayers(FLOOR_WOOD_FRAME_LAYERS),
    assemblyId: "slab-wood-frame",
    constructionType: "atticFloor",
    slabKind: "interfloor",
    heatedSide: "below",
    thickness_m: 0.201,
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
