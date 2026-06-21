import { getMaterialThermalProperties } from "../norms/sp50_2024/materialThermalProperties";
import { resolveLayerLambda_W_mK, resolveThermalBridgeInputsFromLayers, } from "../core/thermal/envelope/layerThermalBridgeInputs";
import { thermalBridgeLinearConductance, thermalBridgePointConductance, } from "../core/thermal/formulas";
import { SP230_DISC_ANCHOR_CHI_W_K, SP230_DISC_ANCHOR_DENSITY_PER_M2, SP230_THERMAL_BRIDGE_SOURCE, psiFloorOnGroundEdge_W_mK, psiPitchedRoofRafter_W_mK, psiPitchedRoofRidge_W_mK, psiSftkConvexCorner_W_mK, psiSftkWallRoofJunction_W_mK, psiSftkWindowJamb_W_mK, } from "../norms/sp230_2015/thermalBridgeJunctions";
export const VIDEO_DEMO_FOOTPRINT = { width: 14, depth: 10 };
const EXTERIOR_WALL_ASSEMBLY_ID = "video-exterior-wall";
function openingPerimeterM(opening) {
    return 2 * (Math.max(0, opening.width_m) + Math.max(0, opening.height_m));
}
function isHostedOnExteriorWall(model, wallId) {
    if (!wallId) {
        return false;
    }
    const wall = model.walls.find((entry) => entry.id === wallId);
    return wall?.wallAssemblyId === EXTERIOR_WALL_ASSEMBLY_ID;
}
function layerResistance_m2K_W(layers, materialId, operationCondition) {
    const layer = layers.find((entry) => entry.materialId === materialId);
    if (!layer || !(layer.thickness_m > 0)) {
        return null;
    }
    const material = getMaterialThermalProperties({
        materialId: layer.materialId,
        operationCondition,
    });
    const lambda = operationCondition === "A"
        ? material?.conductivityA_W_mK
        : material?.conductivityB_W_mK ?? material?.conductivityDry_W_mK;
    if (lambda == null || !(lambda > 0)) {
        return null;
    }
    return layer.thickness_m / lambda;
}
function insulationResistance_m2K_W(layers, operationCondition) {
    return layerResistance_m2K_W(layers, "mineral_wool", operationCondition);
}
function baseLayerLambda_W_mK(layers, operationCondition) {
    const baseLayer = layers.find((layer) => layer.materialId === "aerated_concrete");
    if (!baseLayer) {
        return null;
    }
    const material = getMaterialThermalProperties({
        materialId: baseLayer.materialId,
        operationCondition,
    });
    return operationCondition === "A"
        ? material?.conductivityA_W_mK ?? null
        : material?.conductivityB_W_mK ?? material?.conductivityDry_W_mK ?? null;
}
export function aggregateEnvelopeBridgeConductances(model) {
    const fragments = model.thermalProtection?.envelope ?? [];
    const linear = fragments.flatMap((fragment) => fragment.heterogeneity?.linear ?? []);
    const point = fragments.flatMap((fragment) => fragment.heterogeneity?.point ?? []);
    const hasLinear = linear.length > 0;
    const hasPoint = point.length > 0;
    return {
        H_psi: hasLinear ? thermalBridgeLinearConductance(linear) : null,
        H_chi: hasPoint ? thermalBridgePointConductance(point) : null,
        hasLinear,
        hasPoint,
    };
}
export function envelopeFragmentHasLinearOrPointBridges(fragment) {
    const heterogeneity = fragment.heterogeneity;
    if (!heterogeneity) {
        return false;
    }
    return ((heterogeneity.linear?.some((entry) => entry.lengthM > 0 && entry.psi_W_mK !== 0) ?? false) ||
        (heterogeneity.point?.some((entry) => entry.count > 0 && entry.chi_W_K !== 0) ?? false));
}
export function isUserSuppliedBridgeHeterogeneity(fragment) {
    const heterogeneity = fragment.heterogeneity;
    if (!heterogeneity) {
        return false;
    }
    const userLabel = "Задано пользователем";
    return ((heterogeneity.linear?.length === 1 && heterogeneity.linear[0]?.label === userLabel) ||
        (heterogeneity.point?.length === 1 && heterogeneity.point[0]?.label === userLabel));
}
export function envelopeFragmentHasThermalBridgeData(fragment) {
    const heterogeneity = fragment.heterogeneity;
    if (!heterogeneity) {
        return false;
    }
    if ((heterogeneity.planar?.length ?? 0) > 0) {
        return true;
    }
    return envelopeFragmentHasLinearOrPointBridges(fragment);
}
export function shouldSkipEnvelopeBridgeEnrichment(fragment) {
    if (isUserSuppliedBridgeHeterogeneity(fragment)) {
        return true;
    }
    return envelopeFragmentHasLinearOrPointBridges(fragment);
}
/**
 * Линейные и точечные мостики наружной стены demo-дома: длины из модели, ψ/χ — по СП 230 (прил. Г).
 */
export function deriveVideoDemoExteriorWallThermalBridges(model, input) {
    const bridgeInputs = resolveThermalBridgeInputsFromLayers(input.layers, input.operationCondition);
    if (!bridgeInputs) {
        return { linear: [], point: [] };
    }
    const psiCorner = psiSftkConvexCorner_W_mK({
        insulationResistance_m2K_W: bridgeInputs.insulationResistance_m2K_W,
        baseLambda_W_mK: bridgeInputs.baseLambda_W_mK,
    });
    const psiOpeningJamb = psiSftkWindowJamb_W_mK(bridgeInputs.insulationResistance_m2K_W);
    const convexCornerLengthM = 4 * Math.max(1, input.storeys) * input.levelHeightM;
    let windowJambLengthM = 0;
    model.windows.forEach((window) => {
        if (isHostedOnExteriorWall(model, window.anchor.wallId)) {
            windowJambLengthM += openingPerimeterM(window);
        }
    });
    let doorJambLengthM = 0;
    model.doors.forEach((door) => {
        if (isHostedOnExteriorWall(model, door.anchor.wallId)) {
            doorJambLengthM += openingPerimeterM(door);
        }
    });
    const anchorCount = Math.max(0, Math.round(SP230_DISC_ANCHOR_DENSITY_PER_M2 * Math.max(0, input.grossWallAreaM2)));
    const linear = [];
    if (convexCornerLengthM > 0) {
        linear.push({
            lengthM: Number(convexCornerLengthM.toFixed(2)),
            psi_W_mK: Number(psiCorner.toFixed(3)),
            label: `Угол СФТК (выпуклый), табл. Г.28, ${SP230_THERMAL_BRIDGE_SOURCE}`,
        });
    }
    if (windowJambLengthM > 0) {
        linear.push({
            lengthM: Number(windowJambLengthM.toFixed(2)),
            psi_W_mK: Number(psiOpeningJamb.toFixed(3)),
            label: `Примыкание окон, табл. Г.34 (dн=20 мм), ${SP230_THERMAL_BRIDGE_SOURCE}`,
        });
    }
    if (doorJambLengthM > 0) {
        linear.push({
            lengthM: Number(doorJambLengthM.toFixed(2)),
            psi_W_mK: Number(psiOpeningJamb.toFixed(3)),
            label: `Примыкание двери (узел как у окна), табл. Г.34, ${SP230_THERMAL_BRIDGE_SOURCE}`,
        });
    }
    const point = anchorCount > 0
        ? [
            {
                count: anchorCount,
                chi_W_K: SP230_DISC_ANCHOR_CHI_W_K,
                label: `Тарельчатые анкеры СФТК (~${SP230_DISC_ANCHOR_DENSITY_PER_M2} шт/м²), табл. Г.4, ${SP230_THERMAL_BRIDGE_SOURCE}`,
            },
        ]
        : [];
    return { linear, point };
}
const DEMO_RAFTERS_SPACING_M = 0.75;
function footprintPerimeterM(widthM, depthM) {
    return 2 * (Math.max(0, widthM) + Math.max(0, depthM));
}
function pitchedRafterLengthM(depthM, risePerMeter) {
    const halfSpanM = Math.max(0, depthM) / 2;
    const riseM = halfSpanM * Math.max(0, risePerMeter);
    return 2 * Math.hypot(halfSpanM, riseM);
}
/**
 * Скатная кровля demo-дома: узел стена–кровля (Г.81), стропила (Г.103), конёк (Г.104).
 */
export function deriveVideoDemoRoofThermalBridges(input) {
    const roofInputs = resolveThermalBridgeInputsFromLayers(input.roofLayers, input.operationCondition);
    const wallInputs = resolveThermalBridgeInputsFromLayers(input.wallLayers, input.operationCondition);
    if (!roofInputs || !wallInputs) {
        return { linear: [], point: [] };
    }
    const roofInsulationR = roofInputs.insulationResistance_m2K_W;
    const wallInsulationR = wallInputs.insulationResistance_m2K_W;
    const woolLayer = input.roofLayers.find((layer) => {
        const lambda = resolveLayerLambda_W_mK(layer.materialId, input.operationCondition);
        return lambda != null && lambda <= 0.12;
    });
    const insulationThicknessMm = (woolLayer?.thickness_m ?? 0) * 1000;
    const eavePerimeterM = footprintPerimeterM(input.footprintWidthM, input.footprintDepthM);
    const ridgeLengthM = Math.max(0, input.footprintWidthM);
    const rafterCount = Math.max(0, Math.floor(input.footprintWidthM / DEMO_RAFTERS_SPACING_M) + 1);
    const rafterLengthM = pitchedRafterLengthM(input.footprintDepthM, input.risePerMeter);
    const totalRafterLengthM = rafterCount * rafterLengthM;
    const linear = [];
    if (eavePerimeterM > 0) {
        linear.push({
            lengthM: Number(eavePerimeterM.toFixed(2)),
            psi_W_mK: Number(psiSftkWallRoofJunction_W_mK({
                wallInsulationResistance_m2K_W: wallInsulationR,
                roofInsulationResistance_m2K_W: roofInsulationR,
            }).toFixed(3)),
            label: `Сопряжение стены и кровли (карниз), табл. Г.81, ${SP230_THERMAL_BRIDGE_SOURCE}`,
        });
    }
    if (totalRafterLengthM > 0 && insulationThicknessMm > 0) {
        linear.push({
            lengthM: Number(totalRafterLengthM.toFixed(2)),
            psi_W_mK: Number(psiPitchedRoofRafter_W_mK(insulationThicknessMm).toFixed(3)),
            label: `Стропила в утеплителе (шаг ~${DEMO_RAFTERS_SPACING_M} м), табл. Г.103, ${SP230_THERMAL_BRIDGE_SOURCE}`,
        });
    }
    if (ridgeLengthM > 0 && insulationThicknessMm > 0) {
        linear.push({
            lengthM: Number(ridgeLengthM.toFixed(2)),
            psi_W_mK: Number(psiPitchedRoofRidge_W_mK(insulationThicknessMm).toFixed(3)),
            label: `Конёк скатной кровли, табл. Г.104, ${SP230_THERMAL_BRIDGE_SOURCE}`,
        });
    }
    return { linear, point: [] };
}
/**
 * Пол по грунту: ψпс по периметру здания (СП 50, прил. Г.7 → СП 230, табл. Г.40).
 */
export function deriveVideoDemoFloorOnGroundThermalBridges(input) {
    const floorInputs = resolveThermalBridgeInputsFromLayers(input.floorLayers, input.operationCondition);
    const wallInputs = resolveThermalBridgeInputsFromLayers(input.wallLayers, input.operationCondition);
    if (!floorInputs || !wallInputs) {
        return { linear: [], point: [] };
    }
    const perimeterM = footprintPerimeterM(input.footprintWidthM, input.footprintDepthM);
    const psiEdge = psiFloorOnGroundEdge_W_mK({
        wallInsulationResistance_m2K_W: wallInputs.insulationResistance_m2K_W,
        floorInsulationResistance_m2K_W: floorInputs.insulationResistance_m2K_W,
    });
    const linear = perimeterM > 0
        ? [
            {
                lengthM: Number(perimeterM.toFixed(2)),
                psi_W_mK: Number(psiEdge.toFixed(3)),
                label: `Стык пола по грунту и наружной стены (Lпс), табл. Г.40, ${SP230_THERMAL_BRIDGE_SOURCE}`,
            },
        ]
        : [];
    return { linear, point: [] };
}
/**
 * Подставляет типовые ψ/χ в envelope, если фрагменты demo-дома ещё без heterogeneity
 * (например, старая сохранённая модель в build-store).
 */
export function enrichVideoDemoEnvelopeThermalBridges(model) {
    const thermalProtection = model.thermalProtection;
    const envelope = thermalProtection?.envelope;
    if (!envelope?.length) {
        return model;
    }
    const operationCondition = thermalProtection.operationCondition ?? "B";
    const storeys = thermalProtection.storeys ?? 2;
    const levelHeightM = model.levels[0]?.height_m ?? 3;
    const exteriorWallAreaM2 = envelope.find((fragment) => fragment.id === "video-ext-walls")?.areaM2 ??
        model.walls
            .filter((wall) => wall.wallAssemblyId === "video-exterior-wall")
            .reduce((sum, wall) => sum + Math.max(0, Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) * wall.height_m), 0);
    const risePerMeter = model.roofs?.[0]?.slope?.risePerMeter ?? 0.16;
    const wallLayers = envelope.find((entry) => entry.id === "video-ext-walls")?.layers ??
        model.walls.find((wall) => wall.wallAssemblyId === "video-exterior-wall")?.layers ??
        [];
    let changed = false;
    const nextEnvelope = envelope.map((fragment) => {
        if (shouldSkipEnvelopeBridgeEnrichment(fragment)) {
            return fragment;
        }
        if (fragment.id === "video-ext-walls" && fragment.layers?.length) {
            changed = true;
            return {
                ...fragment,
                heterogeneity: deriveVideoDemoExteriorWallThermalBridges(model, {
                    layers: fragment.layers,
                    operationCondition,
                    storeys,
                    levelHeightM,
                    grossWallAreaM2: exteriorWallAreaM2,
                }),
            };
        }
        if (fragment.id === "video-roof" && fragment.layers?.length) {
            changed = true;
            return {
                ...fragment,
                heterogeneity: deriveVideoDemoRoofThermalBridges({
                    roofLayers: fragment.layers,
                    wallLayers,
                    operationCondition,
                    footprintWidthM: VIDEO_DEMO_FOOTPRINT.width,
                    footprintDepthM: VIDEO_DEMO_FOOTPRINT.depth,
                    risePerMeter,
                }),
            };
        }
        if (fragment.id === "video-floor-ground" && fragment.layers?.length) {
            changed = true;
            return {
                ...fragment,
                heterogeneity: deriveVideoDemoFloorOnGroundThermalBridges({
                    floorLayers: fragment.layers,
                    wallLayers,
                    operationCondition,
                    footprintWidthM: VIDEO_DEMO_FOOTPRINT.width,
                    footprintDepthM: VIDEO_DEMO_FOOTPRINT.depth,
                }),
            };
        }
        return fragment;
    });
    if (!changed) {
        return model;
    }
    return {
        ...model,
        thermalProtection: {
            ...thermalProtection,
            envelope: nextEnvelope,
        },
    };
}
