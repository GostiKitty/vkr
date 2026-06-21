import { getEnvelopePreset, resolveDefaultPresetId, resolvePresetLayers, } from "../../../entities/envelope/envelopePresets";
import { SP230_DISC_ANCHOR_CHI_W_K, SP230_DISC_ANCHOR_DENSITY_PER_M2, SP230_THERMAL_BRIDGE_SOURCE, psiSftkConvexCorner_W_mK, psiSftkWindowJamb_W_mK, } from "../../../norms/sp230_2015/thermalBridgeJunctions";
import { deriveVideoDemoFloorOnGroundThermalBridges, deriveVideoDemoRoofThermalBridges, shouldSkipEnvelopeBridgeEnrichment, } from "../../../demo/deriveExteriorWallThermalBridges";
import { resolveExteriorWallIds, resolveThermalBridgeInputsFromLayers, } from "./layerThermalBridgeInputs";
const VIDEO_DEMO_FRAGMENT_IDS = new Set(["video-ext-walls", "video-roof", "video-floor-ground"]);
const OPAQUE_WALL_TYPES = new Set(["wall"]);
const OPAQUE_ROOF_TYPES = new Set(["covering", "roof"]);
const OPAQUE_FLOOR_TYPES = new Set([
    "floorOnGround",
    "floorOverBasement",
    "atticFloor",
]);
function openingPerimeterM(opening) {
    return 2 * (Math.max(0, opening.width_m) + Math.max(0, opening.height_m));
}
function pointKey(point) {
    return `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
}
function resolveWallLayersFromModel(wall) {
    if (!wall) {
        return [];
    }
    if (wall.layers?.length) {
        return wall.layers.map((layer) => ({ ...layer }));
    }
    const preset = getEnvelopePreset(wall.envelopePresetId ?? resolveDefaultPresetId("wall"));
    return preset ? resolvePresetLayers(preset) : [];
}
function resolveFragmentLayers(model, fragment) {
    if (fragment.layers?.length) {
        return fragment.layers.map((layer) => ({ ...layer }));
    }
    if (fragment.id.startsWith("wall-")) {
        return resolveWallLayersFromModel(model.walls.find((wall) => wall.id === fragment.id.slice("wall-".length)));
    }
    if (fragment.id.startsWith("roof-")) {
        const roof = (model.roofs ?? []).find((entry) => entry.id === fragment.id.slice("roof-".length));
        if (roof?.layers?.length) {
            return roof.layers.map((layer) => ({ ...layer }));
        }
        const preset = getEnvelopePreset(roof?.envelopePresetId ?? resolveDefaultPresetId("roof"));
        return preset ? resolvePresetLayers(preset) : [];
    }
    if (fragment.id.startsWith("slab-")) {
        const slab = (model.floorSlabs ?? []).find((entry) => entry.id === fragment.id.slice("slab-".length));
        if (slab?.layers?.length) {
            return slab.layers.map((layer) => ({ ...layer }));
        }
        const preset = getEnvelopePreset(slab?.envelopePresetId ?? resolveDefaultPresetId("slab"));
        return preset ? resolvePresetLayers(preset) : [];
    }
    return [];
}
function footprintFromModel(model) {
    const roomPoints = model.rooms.flatMap((room) => room.polygon);
    const points = roomPoints.length > 0
        ? roomPoints
        : model.walls.flatMap((wall) => [wall.a, wall.b]);
    if (!points.length) {
        return { widthM: 0, depthM: 0 };
    }
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
        widthM: Math.max(0, Math.max(...xs) - Math.min(...xs)),
        depthM: Math.max(0, Math.max(...ys) - Math.min(...ys)),
    };
}
function exteriorConvexCornerLengthM(model, exteriorWallIds) {
    const endpointMap = new Map();
    model.walls.forEach((wall) => {
        if (!exteriorWallIds.has(wall.id)) {
            return;
        }
        [wall.a, wall.b].forEach((point) => {
            const key = pointKey(point);
            const existing = endpointMap.get(key) ?? [];
            if (!existing.some((entry) => entry.id === wall.id)) {
                existing.push(wall);
            }
            endpointMap.set(key, existing);
        });
    });
    let cornerLengthM = 0;
    endpointMap.forEach((walls) => {
        if (walls.length !== 2) {
            return;
        }
        const heightM = Math.max(...walls.map((wall) => Math.max(0, wall.height_m)));
        if (heightM > 0) {
            cornerLengthM += heightM;
        }
    });
    return cornerLengthM;
}
function resolveReferenceWallLayers(model, envelope, exteriorWallIds) {
    for (const fragment of envelope) {
        if (fragment.constructionType !== "wall") {
            continue;
        }
        const wallId = fragment.id.startsWith("wall-") ? fragment.id.slice("wall-".length) : null;
        if (wallId && !exteriorWallIds.has(wallId)) {
            continue;
        }
        const layers = resolveFragmentLayers(model, fragment);
        if (layers.length) {
            return layers;
        }
    }
    const exteriorWall = model.walls.find((wall) => exteriorWallIds.has(wall.id));
    return resolveWallLayersFromModel(exteriorWall);
}
function deriveWallFragmentThermalBridges(input) {
    const bridgeInputs = resolveThermalBridgeInputsFromLayers(input.layers, input.operationCondition);
    if (!bridgeInputs) {
        return { linear: [], point: [] };
    }
    const psiCorner = psiSftkConvexCorner_W_mK({
        insulationResistance_m2K_W: bridgeInputs.insulationResistance_m2K_W,
        baseLambda_W_mK: bridgeInputs.baseLambda_W_mK,
    });
    const psiOpeningJamb = psiSftkWindowJamb_W_mK(bridgeInputs.insulationResistance_m2K_W);
    let windowJambLengthM = 0;
    let doorJambLengthM = 0;
    if (input.wallId) {
        input.model.windows.forEach((window) => {
            if (window.anchor.wallId === input.wallId) {
                windowJambLengthM += openingPerimeterM(window);
            }
        });
        input.model.doors.forEach((door) => {
            if (door.anchor.wallId === input.wallId) {
                doorJambLengthM += openingPerimeterM(door);
            }
        });
    }
    else {
        input.model.windows.forEach((window) => {
            windowJambLengthM += openingPerimeterM(window);
        });
        input.model.doors.forEach((door) => {
            doorJambLengthM += openingPerimeterM(door);
        });
    }
    const anchorCount = Math.max(0, Math.round(SP230_DISC_ANCHOR_DENSITY_PER_M2 * Math.max(0, input.wallAreaM2)));
    const linear = [];
    const cornerLengthM = input.cornerLengthShareM > 0
        ? input.cornerLengthShareM
        : input.wallLengthM > 0
            ? 2 * Math.max(0, input.wallHeightM)
            : 0;
    if (cornerLengthM > 0) {
        linear.push({
            lengthM: Number(cornerLengthM.toFixed(2)),
            psi_W_mK: Number(psiCorner.toFixed(3)),
            label: `Угол (λо=${bridgeInputs.baseMaterialId ?? "основание"}, Rут по ${bridgeInputs.insulationMaterialIds.join("+") || "слоям"}), табл. Г.28, ${SP230_THERMAL_BRIDGE_SOURCE}`,
        });
    }
    if (windowJambLengthM > 0) {
        linear.push({
            lengthM: Number(windowJambLengthM.toFixed(2)),
            psi_W_mK: Number(psiOpeningJamb.toFixed(3)),
            label: `Примыкание окон, табл. Г.34, ${SP230_THERMAL_BRIDGE_SOURCE}`,
        });
    }
    if (doorJambLengthM > 0) {
        linear.push({
            lengthM: Number(doorJambLengthM.toFixed(2)),
            psi_W_mK: Number(psiOpeningJamb.toFixed(3)),
            label: `Примыкание двери, табл. Г.34, ${SP230_THERMAL_BRIDGE_SOURCE}`,
        });
    }
    const point = anchorCount > 0
        ? [
            {
                count: anchorCount,
                chi_W_K: SP230_DISC_ANCHOR_CHI_W_K,
                label: `Точечные включения (~${SP230_DISC_ANCHOR_DENSITY_PER_M2} шт/м²), табл. Г.4, ${SP230_THERMAL_BRIDGE_SOURCE}`,
            },
        ]
        : [];
    return { linear, point };
}
function deriveRoofFragmentThermalBridges(input) {
    if (input.footprintWidthM > 0 && input.footprintDepthM > 0) {
        return deriveVideoDemoRoofThermalBridges({
            roofLayers: input.roofLayers,
            wallLayers: input.wallLayers,
            operationCondition: input.operationCondition,
            footprintWidthM: input.footprintWidthM,
            footprintDepthM: input.footprintDepthM,
            risePerMeter: input.risePerMeter,
        });
    }
    return { linear: [], point: [] };
}
function deriveGroundFloorFragmentThermalBridges(input) {
    if (input.footprintWidthM > 0 && input.footprintDepthM > 0) {
        return deriveVideoDemoFloorOnGroundThermalBridges({
            floorLayers: input.floorLayers,
            wallLayers: input.wallLayers,
            operationCondition: input.operationCondition,
            footprintWidthM: input.footprintWidthM,
            footprintDepthM: input.footprintDepthM,
        });
    }
    return { linear: [], point: [] };
}
/**
 * Подставляет ψ/χ по геометрии и послойному составу (все materialId из справочника).
 */
export function enrichEnvelopeThermalBridges(model) {
    const thermalProtection = model.thermalProtection;
    const envelope = thermalProtection?.envelope;
    if (!thermalProtection || !envelope?.length) {
        return model;
    }
    const exteriorWallIds = resolveExteriorWallIds(model);
    if (!exteriorWallIds.size) {
        return model;
    }
    const operationCondition = thermalProtection.operationCondition ?? "B";
    const footprint = footprintFromModel(model);
    const referenceWallLayers = resolveReferenceWallLayers(model, envelope, exteriorWallIds);
    const adjacencyExternal = model.rooms.length
        ? [...exteriorWallIds].map((wallId) => {
            const wall = model.walls.find((entry) => entry.id === wallId);
            const lengthM = wall
                ? Math.max(0, Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y))
                : 0;
            return { wallId, lengthM };
        })
        : [...exteriorWallIds].map((wallId) => {
            const wall = model.walls.find((entry) => entry.id === wallId);
            return {
                wallId,
                lengthM: Math.max(0, Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)),
            };
        });
    const totalExteriorLengthM = adjacencyExternal.reduce((sum, edge) => sum + edge.lengthM, 0);
    const totalCornerLengthM = exteriorConvexCornerLengthM(model, exteriorWallIds);
    const risePerMeter = model.roofs?.[0]?.slope?.risePerMeter ?? 0.16;
    let changed = false;
    const nextEnvelope = envelope.map((fragment) => {
        if (VIDEO_DEMO_FRAGMENT_IDS.has(fragment.id) || shouldSkipEnvelopeBridgeEnrichment(fragment)) {
            return fragment;
        }
        const layers = resolveFragmentLayers(model, fragment);
        if (!layers.length) {
            return fragment;
        }
        if (OPAQUE_WALL_TYPES.has(fragment.constructionType)) {
            const wallId = fragment.id.startsWith("wall-") ? fragment.id.slice("wall-".length) : null;
            if (wallId && !exteriorWallIds.has(wallId)) {
                return fragment;
            }
            const wall = wallId ? model.walls.find((entry) => entry.id === wallId) : null;
            const wallLengthM = wall
                ? Math.max(0, Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y))
                : totalExteriorLengthM;
            const wallHeightM = wall?.height_m ?? model.levels[0]?.height_m ?? 3;
            const cornerShareM = wallId && totalExteriorLengthM > 0 && totalCornerLengthM > 0
                ? totalCornerLengthM * (wallLengthM / totalExteriorLengthM)
                : totalCornerLengthM > 0
                    ? totalCornerLengthM
                    : 0;
            const heterogeneity = deriveWallFragmentThermalBridges({
                model,
                wallId,
                layers,
                wallAreaM2: fragment.areaM2,
                wallLengthM,
                wallHeightM,
                operationCondition,
                cornerLengthShareM: cornerShareM,
            });
            if (!heterogeneity.linear.length && !heterogeneity.point.length) {
                return fragment;
            }
            changed = true;
            return { ...fragment, layers, heterogeneity };
        }
        if (OPAQUE_ROOF_TYPES.has(fragment.constructionType) || fragment.id.startsWith("roof-")) {
            const heterogeneity = deriveRoofFragmentThermalBridges({
                roofLayers: layers,
                wallLayers: referenceWallLayers,
                operationCondition,
                footprintWidthM: footprint.widthM,
                footprintDepthM: footprint.depthM,
                risePerMeter,
            });
            if (!heterogeneity.linear.length) {
                return fragment;
            }
            changed = true;
            return { ...fragment, layers, heterogeneity };
        }
        if (OPAQUE_FLOOR_TYPES.has(fragment.constructionType) || fragment.constructionType === "floorOnGround") {
            const heterogeneity = deriveGroundFloorFragmentThermalBridges({
                floorLayers: layers,
                wallLayers: referenceWallLayers,
                operationCondition,
                footprintWidthM: footprint.widthM,
                footprintDepthM: footprint.depthM,
            });
            if (!heterogeneity.linear.length) {
                return fragment;
            }
            changed = true;
            return { ...fragment, layers, heterogeneity };
        }
        return fragment;
    });
    if (!changed) {
        const aggregate = nextEnvelope.flatMap((fragment) => [
            ...(fragment.heterogeneity?.linear ?? []),
            ...(fragment.heterogeneity?.point ?? []),
        ]);
        if (aggregate.length === 0 && exteriorWallIds.size > 0) {
            const targetIndex = nextEnvelope.findIndex((fragment) => OPAQUE_WALL_TYPES.has(fragment.constructionType) &&
                (!fragment.id.startsWith("wall-") || exteriorWallIds.has(fragment.id.slice("wall-".length))));
            if (targetIndex >= 0) {
                const target = nextEnvelope[targetIndex];
                const layers = resolveFragmentLayers(model, target);
                if (layers.length) {
                    const wallId = target.id.startsWith("wall-") ? target.id.slice("wall-".length) : null;
                    const heterogeneity = deriveWallFragmentThermalBridges({
                        model,
                        wallId,
                        layers,
                        wallAreaM2: target.areaM2,
                        wallLengthM: totalExteriorLengthM,
                        wallHeightM: model.levels[0]?.height_m ?? 3,
                        operationCondition,
                        cornerLengthShareM: totalCornerLengthM,
                    });
                    if (heterogeneity.linear.length > 0 || heterogeneity.point.length > 0) {
                        const patched = [...nextEnvelope];
                        patched[targetIndex] = { ...target, layers, heterogeneity };
                        return {
                            ...model,
                            thermalProtection: {
                                ...thermalProtection,
                                envelope: patched,
                            },
                        };
                    }
                }
            }
        }
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
