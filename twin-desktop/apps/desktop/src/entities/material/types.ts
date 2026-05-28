import type { WallLayer } from "../geometry/types";
import { layerResistance, uValue } from "../../core/thermal/formulas";
import { calculateConstructionResistance } from "../../core/thermal/sp50/calculations";
import { getMaterialThermalProperties } from "../../norms/sp50_2024/materialThermalProperties";
import { EXTERNAL_HEAT_TRANSFER_COEFFICIENTS, INTERNAL_HEAT_TRANSFER_COEFFICIENTS } from "../../norms/sp50_2024/heatTransferCoefficients";

const SP50_WALL_ALPHA_IN = INTERNAL_HEAT_TRANSFER_COEFFICIENTS.wall;
const SP50_WALL_ALPHA_OUT = EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.wall;

export interface Material {
  id: string;
  name: string;
  lambda_W_mK: number;
  rho_kg_m3: number;
  c_J_kgK: number;
  defaultThickness_m: number;
}

export interface WallAssemblyLayer {
  materialId: string;
  thickness_m: number;
}

export interface WallAssembly {
  id: string;
  name: string;
  layers: WallAssemblyLayer[];
}

export interface WallThermalProperties {
  /** Полное R ограждения R_total = R_si + R_layers + R_se (или только слои без плёнок), м²·К/Вт. */
  rValue: number;
  /** U_total = 1 / R_total, Вт/(м²·К). */
  uValue: number;
  heatCapacity_J_m2K: number;
  /** Σ(d/λ) — сопротивление материальных слоёв, м²·К/Вт. */
  rMaterialLayers_m2K_W: number;
  /** R_si — внутреннее поверхностное (0, если плёнки СП 50 не включены). */
  rSi_m2K_W: number;
  /** R_se — наружное поверхностное. */
  rSe_m2K_W: number;
  /** R_total, м²·К/Вт (совпадает с rValue). */
  rTotal_m2K_W: number;
  /** U_layers = 1 / R_layers (без поверхностных сопротивлений). */
  uMaterialLayers_W_m2K: number;
  /** U_total = 1 / R_total (совпадает с uValue). */
  uTotal_W_m2K: number;
  /** @deprecated используйте rMaterialLayers_m2K_W */
  rLayersOnly_m2K_W?: number;
  /** @deprecated используйте uMaterialLayers_W_m2K */
  uLayersOnly_W_m2K?: number;
}

function buildMaterialEntry(id: string, defaultThickness_m: number, fallbackName = id): Material {
  const properties = getMaterialThermalProperties({ materialId: id, operationCondition: "A" });
  return {
    id,
    name: properties?.label ?? fallbackName,
    lambda_W_mK: properties?.conductivity_W_mK ?? 0.2,
    rho_kg_m3: properties?.density_kg_m3 ?? 1000,
    c_J_kgK: (properties?.heatCapacity_kJ_kgK ?? 0.84) * 1000,
    defaultThickness_m,
  };
}

export const MATERIAL_LIBRARY: Record<string, Material> = {
  reinforced_concrete: buildMaterialEntry("reinforced_concrete", 0.2),
  heavy_concrete: buildMaterialEntry("heavy_concrete", 0.2),
  concrete: buildMaterialEntry("concrete", 0.2),
  ceramic_brick: buildMaterialEntry("ceramic_brick", 0.25),
  silicate_brick: buildMaterialEntry("silicate_brick", 0.25),
  brick: buildMaterialEntry("brick", 0.25),
  aerated_concrete: buildMaterialEntry("aerated_concrete", 0.3),
  cement_sand_plaster: buildMaterialEntry("cement_sand_plaster", 0.02),
  gypsum_plaster: buildMaterialEntry("gypsum_plaster", 0.015),
  mineral_wool: buildMaterialEntry("mineral_wool", 0.15),
  eps: buildMaterialEntry("eps", 0.15),
  polystyrene: buildMaterialEntry("polystyrene", 0.15),
  xps: buildMaterialEntry("xps", 0.1),
  pur: buildMaterialEntry("pur", 0.1),
  wood: buildMaterialEntry("wood", 0.05),
  plywood: buildMaterialEntry("plywood", 0.012),
  gypsum_board: buildMaterialEntry("gypsum_board", 0.0125),
  gypsum: buildMaterialEntry("gypsum", 0.0125),
  glass: buildMaterialEntry("glass", 0.006),
  window_block: buildMaterialEntry("window_block", 0.02),
  pvc_double_glazed_unit_equivalent: buildMaterialEntry("pvc_double_glazed_unit_equivalent", 0.07),
};

export const WALL_ASSEMBLIES: Record<string, WallAssembly> = {
  masonry: {
    id: "masonry",
    name: "Кирпичная стена + утеплитель",
    layers: [
      { materialId: "ceramic_brick", thickness_m: 0.25 },
      { materialId: "mineral_wool", thickness_m: 0.15 },
      { materialId: "gypsum_board", thickness_m: 0.0125 },
    ],
  },
  concrete: {
    id: "concrete",
    name: "Железобетонная стена",
    layers: [
      { materialId: "reinforced_concrete", thickness_m: 0.2 },
      { materialId: "gypsum_board", thickness_m: 0.0125 },
    ],
  },
  glass: {
    id: "glass",
    name: "Стеклянная панель",
    layers: [{ materialId: "glass", thickness_m: 0.02 }],
  },
};

export const DEFAULT_WALL_ASSEMBLY_ID = "masonry";

export const getMaterial = (id: string): Material | undefined => MATERIAL_LIBRARY[id];
export const getWallAssembly = (id: string): WallAssembly | undefined => WALL_ASSEMBLIES[id];

export interface ComputeWallPropertiesOptions {
  /**
   * Если true — к сопротивлению слоёв добавляются типовые поверхностные сопротивления
   * по СП 50.13330 (αв = 8.7, αн = 23 Вт/(м²·К) для стены), как в нормативном модуле.
   * Используется в зональной динамической модели для согласования U с нормативной логикой.
   */
  includeSp50AirFilms?: boolean;
}

export function computeWallProperties(
  layers: WallLayer[] | undefined,
  fallbackAssemblyId?: string,
  options?: ComputeWallPropertiesOptions
): WallThermalProperties | null {
  const assembly = fallbackAssemblyId ? getWallAssembly(fallbackAssemblyId) : undefined;
  const effectiveLayers = layers?.length ? layers : assembly?.layers;
  if (!effectiveLayers || !effectiveLayers.length) {
    return null;
  }
  let rLayers = 0;
  let heatCapacity = 0;
  let resolvedLayerCount = 0;
  effectiveLayers.forEach((layer) => {
    const material = getMaterial(layer.materialId);
    if (!material) {
      return;
    }
    const thickness = layer.thickness_m || material.defaultThickness_m;
    const lam = material.lambda_W_mK;
    if (!Number.isFinite(lam) || lam <= 0 || !Number.isFinite(thickness) || thickness <= 0) {
      return;
    }
    rLayers += layerResistance(thickness, lam);
    heatCapacity += material.rho_kg_m3 * material.c_J_kgK * thickness;
    resolvedLayerCount += 1;
  });
  if (rLayers <= 0 || resolvedLayerCount === 0 || !Number.isFinite(rLayers)) {
    return null;
  }
  if (options?.includeSp50AirFilms) {
    const layerResistances = effectiveLayers
      .map((layer) => {
        const material = getMaterial(layer.materialId);
        if (!material) {
          return null;
        }
        const thickness = layer.thickness_m || material.defaultThickness_m;
        const lam = material.lambda_W_mK;
        if (!Number.isFinite(lam) || lam <= 0) {
          return null;
        }
        return thickness / lam;
      })
      .filter((value): value is number => value !== null && value > 0);
    if (!layerResistances.length) {
      return null;
    }
    const rSi = 1 / SP50_WALL_ALPHA_IN;
    const rSe = 1 / SP50_WALL_ALPHA_OUT;
    const rComplete = calculateConstructionResistance({
      internalHeatTransferCoefficient: SP50_WALL_ALPHA_IN,
      externalHeatTransferCoefficient: SP50_WALL_ALPHA_OUT,
      layerResistances,
    });
    const rLayersOnly = layerResistances.reduce((sum, value) => sum + value, 0);
    const uLayers = uValue(rLayersOnly);
    const uTot = uValue(rComplete);
    return {
      rValue: rComplete,
      uValue: uTot,
      heatCapacity_J_m2K: heatCapacity,
      rMaterialLayers_m2K_W: rLayersOnly,
      rSi_m2K_W: rSi,
      rSe_m2K_W: rSe,
      rTotal_m2K_W: rComplete,
      uMaterialLayers_W_m2K: uLayers,
      uTotal_W_m2K: uTot,
      rLayersOnly_m2K_W: rLayersOnly,
      uLayersOnly_W_m2K: uLayers,
    };
  }
  const uMat = uValue(rLayers);
  return {
    rValue: rLayers,
    uValue: uMat,
    heatCapacity_J_m2K: heatCapacity,
    rMaterialLayers_m2K_W: rLayers,
    rSi_m2K_W: 0,
    rSe_m2K_W: 0,
    rTotal_m2K_W: rLayers,
    uMaterialLayers_W_m2K: uMat,
    uTotal_W_m2K: uMat,
  };
}

export function ensureWallLayers(wallLayers: WallLayer[] | undefined, assemblyId?: string): WallLayer[] {
  if (wallLayers?.length) {
    return wallLayers;
  }
  const assembly = assemblyId ? getWallAssembly(assemblyId) : undefined;
  return assembly?.layers.map((layer) => ({ ...layer })) ?? [];
}
