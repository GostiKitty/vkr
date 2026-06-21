import { getMaterialThermalProperties } from "../../../norms/sp50_2024/materialThermalProperties";
import { buildAdjacencyGraph } from "../../graph/adjacency";
const INSULATION_LAMBDA_THRESHOLD_W_mK = 0.12;
const FINISH_MAX_THICKNESS_M = 0.03;
const FINISH_MATERIAL_IDS = new Set([
    "cement_sand_plaster",
    "gypsum_plaster",
    "lime_plaster",
    "gypsum_board",
    "gypsum",
]);
export function resolveLayerLambda_W_mK(materialId, operationCondition) {
    const material = getMaterialThermalProperties({ materialId, operationCondition });
    if (!material) {
        return null;
    }
    const lambda = operationCondition === "A"
        ? material.conductivityA_W_mK
        : material.conductivityB_W_mK ?? material.conductivityDry_W_mK;
    return lambda != null && lambda > 0 ? lambda : null;
}
export function resolveLayerResistance_m2K_W(layer, operationCondition) {
    if (!(layer.thickness_m > 0)) {
        return null;
    }
    const lambda = resolveLayerLambda_W_mK(layer.materialId, operationCondition);
    if (lambda == null) {
        return null;
    }
    return layer.thickness_m / lambda;
}
function isFinishLayer(layer, lambda_W_mK) {
    if (FINISH_MATERIAL_IDS.has(layer.materialId)) {
        return true;
    }
    return lambda_W_mK != null && layer.thickness_m <= FINISH_MAX_THICKNESS_M + 1e-6;
}
function isInsulationLayer(resistance_m2K_W, lambda_W_mK) {
    if (lambda_W_mK != null && lambda_W_mK <= INSULATION_LAMBDA_THRESHOLD_W_mK) {
        return true;
    }
    return resistance_m2K_W >= 0.35 && lambda_W_mK != null && lambda_W_mK < 0.2;
}
/**
 * Rут и λо для таблиц СП 230 по фактическим слоям (любые materialId из справочника).
 */
export function resolveThermalBridgeInputsFromLayers(layers, operationCondition) {
    if (!layers.length) {
        return null;
    }
    const analyzed = layers
        .map((layer) => {
        const lambda = resolveLayerLambda_W_mK(layer.materialId, operationCondition);
        const resistance = resolveLayerResistance_m2K_W(layer, operationCondition);
        return { layer, lambda, resistance };
    })
        .filter((entry) => entry.resistance != null && entry.resistance > 0);
    if (!analyzed.length) {
        return null;
    }
    const insulationEntries = analyzed.filter((entry) => entry.resistance != null && isInsulationLayer(entry.resistance, entry.lambda));
    const structuralEntries = analyzed.filter((entry) => entry.resistance != null &&
        !isInsulationLayer(entry.resistance, entry.lambda) &&
        !isFinishLayer(entry.layer, entry.lambda));
    let insulationResistance_m2K_W = insulationEntries.length > 0
        ? Math.max(...insulationEntries.map((entry) => entry.resistance))
        : null;
    const finishResistance = analyzed
        .filter((entry) => isFinishLayer(entry.layer, entry.lambda))
        .reduce((sum, entry) => sum + (entry.resistance ?? 0), 0);
    if (insulationResistance_m2K_W == null && finishResistance > 0) {
        insulationResistance_m2K_W = finishResistance;
    }
    if (insulationResistance_m2K_W == null) {
        const totalResistance = analyzed.reduce((sum, entry) => sum + (entry.resistance ?? 0), 0);
        const structuralResistance = structuralEntries.reduce((sum, entry) => sum + (entry.resistance ?? 0), 0);
        const derivedInsulation = totalResistance - structuralResistance;
        if (derivedInsulation > 0.05) {
            insulationResistance_m2K_W = derivedInsulation;
        }
    }
    const baseCandidate = structuralEntries.length > 0
        ? [...structuralEntries].sort((left, right) => right.layer.thickness_m - left.layer.thickness_m)[0]
        : [...analyzed].sort((left, right) => right.layer.thickness_m - left.layer.thickness_m)[0];
    const baseLambda_W_mK = baseCandidate?.lambda ?? null;
    if (insulationResistance_m2K_W == null || baseLambda_W_mK == null) {
        const totalResistance = analyzed.reduce((sum, entry) => sum + (entry.resistance ?? 0), 0);
        if (!(totalResistance > 0)) {
            return null;
        }
        return {
            insulationResistance_m2K_W: Math.max(0.1, insulationResistance_m2K_W ?? totalResistance * 0.25),
            baseLambda_W_mK: Math.max(0.05, baseLambda_W_mK ?? 0.2),
            insulationMaterialIds: insulationEntries.map((entry) => entry.layer.materialId),
            baseMaterialId: baseCandidate?.layer.materialId ?? null,
        };
    }
    return {
        insulationResistance_m2K_W,
        baseLambda_W_mK,
        insulationMaterialIds: insulationEntries.map((entry) => entry.layer.materialId),
        baseMaterialId: baseCandidate?.layer.materialId ?? null,
    };
}
export function resolveExteriorWallIds(model) {
    const adjacency = buildAdjacencyGraph(model);
    if (adjacency.external.length > 0) {
        return new Set(adjacency.external.map((edge) => edge.wallId));
    }
    if (model.walls.length > 0) {
        return new Set(model.walls.map((wall) => wall.id));
    }
    return new Set();
}
