import type { BuildingModel, ConstructionLayer } from "../../../entities/geometry/types";
import { ensureWallLayers, getMaterial } from "../../../entities/material/types";
import { getTransientFrame, solveTransient1DExplicit, type FiniteDifference1DOptions } from "./finiteDifference1D";
import type {
  BuildTransientLayersResult,
  TransientCalculationResult,
  TransientConstructionTarget,
  TransientLayer,
  TransientScenario,
} from "./types";

export interface RunTransientConstructionAnalysisParams {
  target: TransientConstructionTarget;
  scenario: TransientScenario;
  nodesPerLayer?: number;
  options?: FiniteDifference1DOptions;
}

export function listTransientConstructionTargets(model: BuildingModel): TransientConstructionTarget[] {
  const wallTargets = model.walls.map((wall, index) => ({
    id: `wall:${wall.id}`,
    sourceType: "wall" as const,
    sourceId: wall.id,
    levelId: wall.levelId,
    label: `Стена ${index + 1}${wall.wallAssemblyId ? ` · ${wall.wallAssemblyId}` : ""}`,
    assemblyId: wall.wallAssemblyId ?? null,
    layers: wall.layers,
    fallbackThickness_m: wall.thickness_m,
  }));
  const roofTargets = (model.roofs ?? []).map((roof, index) => ({
    id: `roof:${roof.id}`,
    sourceType: "roof" as const,
    sourceId: roof.id,
    levelId: roof.levelId,
    label: roof.name || `Крыша ${index + 1}`,
    assemblyId: roof.assemblyId ?? null,
    layers: roof.layers,
    fallbackThickness_m: roof.thickness_m,
    heatedSide: roof.heatedSide,
  }));
  const slabTargets = (model.floorSlabs ?? []).map((slab, index) => ({
    id: `slab:${slab.id}`,
    sourceType: "slab" as const,
    sourceId: slab.id,
    levelId: slab.levelId,
    label: slab.name || `Перекрытие ${index + 1}`,
    assemblyId: slab.assemblyId ?? null,
    layers: slab.layers,
    fallbackThickness_m: slab.thickness_m,
    heatedSide: slab.heatedSide,
  }));
  return [...wallTargets, ...roofTargets, ...slabTargets];
}

export function buildTransientLayersFromConstruction(
  input:
    | {
        layers?: ConstructionLayer[];
        assemblyId?: string | null;
        fallbackThickness_m?: number;
        nodesPerLayer?: number;
        materialLookup?: (
          materialId: string
        ) =>
          | {
              id?: string;
              name?: string;
              lambda_W_mK?: number;
              rho_kg_m3?: number;
              c_J_kgK?: number;
              defaultThickness_m?: number;
            }
          | undefined;
      }
    | null
    | undefined
): BuildTransientLayersResult {
  if (!input) {
    return {
      layers: [],
      warnings: [],
      missingData: ["Конструкция для нестационарного расчета не выбрана."],
    };
  }

  const warnings: string[] = [];
  const missingData: string[] = [];
  const rawLayers = ensureWallLayers(input.layers, input.assemblyId ?? undefined);

  if (!rawLayers.length) {
    missingData.push("Для выбранной конструкции нет послойного состава.");
    return { layers: [], warnings, missingData };
  }

  const layers: TransientLayer[] = [];
  rawLayers.forEach((layer, index) => {
    const material = input.materialLookup?.(layer.materialId) ?? getMaterial(layer.materialId);
    if (!material) {
      missingData.push(`Материал ${layer.materialId} не найден в библиотеке.`);
      return;
    }
    const materialName = material.name ?? layer.materialId;
    const lambdaCandidate = material.lambda_W_mK;
    const thickness_m = layer.thickness_m || material.defaultThickness_m || input.fallbackThickness_m || 0;
    if (!(thickness_m >= 0.001)) {
      missingData.push(`Слой ${materialName} имеет некорректную толщину.`);
      return;
    }

    if (!Number.isFinite(lambdaCandidate) || lambdaCandidate === undefined || lambdaCandidate <= 0) {
      missingData.push(`Для материала ${materialName} отсутствует теплопроводность λ.`);
      return;
    }

    const lambda_W_mK: number = lambdaCandidate;
    const densityCandidate = material.rho_kg_m3;
    const heatCapacityCandidate = material.c_J_kgK;
    let density_kg_m3: number = Number.isFinite(densityCandidate) && densityCandidate !== undefined && densityCandidate > 0 ? densityCandidate : 1000;
    let heatCapacity_J_kgK: number =
      Number.isFinite(heatCapacityCandidate) && heatCapacityCandidate !== undefined && heatCapacityCandidate > 0 ? heatCapacityCandidate : 840;

    if (!(Number.isFinite(densityCandidate) && densityCandidate !== undefined && densityCandidate > 0)) {
      warnings.push(`Для материала ${materialName} отсутствовала плотность. Использован fallback 1000 кг/м3.`);
    }
    if (!(Number.isFinite(heatCapacityCandidate) && heatCapacityCandidate !== undefined && heatCapacityCandidate > 0)) {
      warnings.push(`Для материала ${materialName} отсутствовала теплоемкость. Использован fallback 840 Дж/(кг·К).`);
    }

    layers.push({
      id: `${layer.materialId}-${index}`,
      materialId: layer.materialId,
      name: materialName,
      thickness_m,
      lambda_W_mK,
      density_kg_m3,
      heatCapacity_J_kgK,
      nodesCount: Math.max(1, Math.round(input.nodesPerLayer ?? 3)),
    });
  });

  return { layers, warnings, missingData };
}

export function runTransientConstructionAnalysis(
  params: RunTransientConstructionAnalysisParams
): {
  result: TransientCalculationResult | null;
  warnings: string[];
  missingData: string[];
  layers: TransientLayer[];
} {
  const prepared = buildTransientLayersFromConstruction({
    layers: params.target.layers,
    assemblyId: params.target.assemblyId,
    fallbackThickness_m: params.target.fallbackThickness_m,
    nodesPerLayer: params.nodesPerLayer,
  });
  if (prepared.missingData.length || !prepared.layers.length) {
    return {
      result: null,
      warnings: prepared.warnings,
      missingData: prepared.missingData,
      layers: prepared.layers,
    };
  }
  const result = solveTransient1DExplicit(prepared.layers, params.scenario, params.options);
  return {
    result,
    warnings: [...prepared.warnings, ...result.warnings],
    missingData: prepared.missingData,
    layers: prepared.layers,
  };
}

export { getTransientFrame };
