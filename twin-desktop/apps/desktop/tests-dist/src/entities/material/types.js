import { getMaterialThermalProperties } from "../../norms/sp50_2024/materialThermalProperties";
function buildMaterialEntry(id, defaultThickness_m, fallbackName = id) {
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
export const MATERIAL_LIBRARY = {
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
};
export const WALL_ASSEMBLIES = {
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
export const getMaterial = (id) => MATERIAL_LIBRARY[id];
export const getWallAssembly = (id) => WALL_ASSEMBLIES[id];
export function computeWallProperties(layers, fallbackAssemblyId) {
    const assembly = fallbackAssemblyId ? getWallAssembly(fallbackAssemblyId) : undefined;
    const effectiveLayers = layers?.length ? layers : assembly?.layers;
    if (!effectiveLayers || !effectiveLayers.length) {
        return null;
    }
    let rTotal = 0;
    let heatCapacity = 0;
    let resolvedLayerCount = 0;
    effectiveLayers.forEach((layer) => {
        const material = getMaterial(layer.materialId);
        if (!material) {
            return;
        }
        const thickness = layer.thickness_m || material.defaultThickness_m;
        rTotal += thickness / material.lambda_W_mK;
        heatCapacity += material.rho_kg_m3 * material.c_J_kgK * thickness;
        resolvedLayerCount += 1;
    });
    if (rTotal <= 0 || resolvedLayerCount === 0) {
        return null;
    }
    return {
        rValue: rTotal,
        uValue: 1 / rTotal,
        heatCapacity_J_m2K: heatCapacity,
    };
}
export function ensureWallLayers(wallLayers, assemblyId) {
    if (wallLayers?.length) {
        return wallLayers;
    }
    const assembly = assemblyId ? getWallAssembly(assemblyId) : undefined;
    return assembly?.layers.map((layer) => ({ ...layer })) ?? [];
}
