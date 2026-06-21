import { segmentLength } from "../../../entities/geometry/geom";
import { buildAdjacencyGraph } from "../../graph/adjacency";
import { buildGeometryRenderModel } from "../../geometry/bimPipeline";
import { getNormalizedAirPermeability, getLayerAirPermeabilityResistance } from "../../../norms/sp50_2024/airPermeability";
import { DEFAULT_DOOR_LEAKAGE_M3S_M_AT_10_PA, DEFAULT_ENVELOPE_LEAKAGE_M3S_M2_AT_10_PA, DEFAULT_PRESSURE_EXPONENT, DEFAULT_REFERENCE_PRESSURE_PA, DEFAULT_WINDOW_LEAKAGE_M3S_M_AT_10_PA, } from "../infiltration";
const AIR_DENSITY_KG_M3 = 1.204;
const REFERENCE_PRESSURE_PA = 10;
function kgM2HToM3sM2At10Pa(kgM2H, densityKgM3 = AIR_DENSITY_KG_M3) {
    return Math.max(0, kgM2H) / densityKgM3 / 3600;
}
function kgM2HToM3sMAt10Pa(kgM2H, areaM2, perimeterM, densityKgM3 = AIR_DENSITY_KG_M3) {
    const perM2 = kgM2HToM3sM2At10Pa(kgM2H, densityKgM3);
    if (perimeterM <= 0) {
        return perM2;
    }
    return perM2 * Math.max(0, areaM2) / perimeterM;
}
function summarizeOpeningLeakageGeometry(building) {
    const adjacency = buildAdjacencyGraph(building);
    const renderGeometry = buildGeometryRenderModel(building);
    const externalWallIds = new Set(adjacency.external.map((edge) => edge.wallId));
    let windowAreaM2 = 0;
    let windowPerimeterM = 0;
    let doorAreaM2 = 0;
    let doorPerimeterM = 0;
    renderGeometry.walls.forEach(({ wall, openings }) => {
        if (!externalWallIds.has(wall.id)) {
            return;
        }
        openings.forEach((opening) => {
            const areaM2 = Math.max(0, opening.widthM * opening.heightM);
            const perimeterM = 2 * Math.max(0, opening.widthM + opening.heightM);
            if (opening.type === "window") {
                windowAreaM2 += areaM2;
                windowPerimeterM += perimeterM;
            }
            else if (opening.type === "door") {
                doorAreaM2 += areaM2;
                doorPerimeterM += perimeterM;
            }
        });
    });
    return { windowAreaM2, windowPerimeterM, doorAreaM2, doorPerimeterM };
}
function sumWallAirResistanceM2hPaKg(wall) {
    const layers = wall.layers ?? [];
    if (!layers.length) {
        return null;
    }
    const values = layers
        .map((layer) => getLayerAirPermeabilityResistance(layer.materialId))
        .filter((value) => value != null && Number.isFinite(value) && value > 0);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}
function permeabilityM3sM2FromWallLayers(wall) {
    const resistance = sumWallAirResistanceM2hPaKg(wall);
    if (resistance == null || resistance <= 0) {
        return null;
    }
    const massPermeabilityKgM2H = REFERENCE_PRESSURE_PA / resistance;
    return kgM2HToM3sM2At10Pa(massPermeabilityKgM2H);
}
function pickDominantExternalWall(building) {
    const adjacency = buildAdjacencyGraph(building);
    const externalWallIds = new Set(adjacency.external.map((edge) => edge.wallId));
    let best = null;
    let bestArea = 0;
    building.walls.forEach((wall) => {
        if (!externalWallIds.has(wall.id)) {
            return;
        }
        const areaM2 = Math.max(0, segmentLength(wall.a, wall.b) * Math.max(0, wall.height_m));
        if (areaM2 > bestArea) {
            bestArea = areaM2;
            best = wall;
        }
    });
    return best;
}
function permeabilityM3sM2FromNorm(constructionType) {
    const normKgM2H = getNormalizedAirPermeability(constructionType);
    return normKgM2H != null ? kgM2HToM3sM2At10Pa(normKgM2H) : null;
}
function computeEnvelopePermeabilityFromModel(model) {
    const dominantWall = pickDominantExternalWall(model);
    if (dominantWall) {
        const fromLayers = permeabilityM3sM2FromWallLayers(dominantWall);
        if (fromLayers != null && fromLayers > 0) {
            return { value: fromLayers, source: "calculated" };
        }
    }
    const envelopeFragment = model.thermalProtection?.envelope?.find((fragment) => fragment.constructionType === "wall" || fragment.constructionType === "roof");
    if (envelopeFragment?.layers?.length) {
        const resistance = envelopeFragment.layers
            .map((layer) => getLayerAirPermeabilityResistance(layer.materialId))
            .filter((value) => value != null && Number.isFinite(value) && value > 0)
            .reduce((sum, value) => sum + value, 0);
        if (resistance > 0) {
            return { value: kgM2HToM3sM2At10Pa(REFERENCE_PRESSURE_PA / resistance), source: "calculated" };
        }
    }
    const norm = permeabilityM3sM2FromNorm(envelopeFragment?.constructionType ?? "wall");
    if (norm != null && norm > 0) {
        return { value: norm, source: "model" };
    }
    return null;
}
function computeWindowPermeabilityFromModel(model, openings) {
    const normKgM2H = getNormalizedAirPermeability("window");
    if (normKgM2H == null) {
        return null;
    }
    if (openings.windowPerimeterM > 0 && openings.windowAreaM2 > 0) {
        return {
            value: kgM2HToM3sMAt10Pa(normKgM2H, openings.windowAreaM2, openings.windowPerimeterM),
            source: "calculated",
        };
    }
    if (model.windows.length > 0) {
        return { value: kgM2HToM3sM2At10Pa(normKgM2H), source: "model" };
    }
    return null;
}
function computeDoorPermeabilityFromModel(model, openings) {
    const normKgM2H = getNormalizedAirPermeability("door");
    if (normKgM2H == null) {
        return null;
    }
    if (openings.doorPerimeterM > 0 && openings.doorAreaM2 > 0) {
        return {
            value: kgM2HToM3sMAt10Pa(normKgM2H, openings.doorAreaM2, openings.doorPerimeterM),
            source: "calculated",
        };
    }
    if (model.doors.length > 0) {
        return { value: kgM2HToM3sM2At10Pa(normKgM2H), source: "model" };
    }
    return null;
}
export function valuesClose(a, b) {
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= scale * 1e-6;
}
export function resolveVentilationScalar(raw, computed, fallback) {
    if (raw != null && Number.isFinite(raw)) {
        if (computed != null && !valuesClose(raw, computed.value)) {
            return { value: Math.max(0, raw), source: "user", explicit: true };
        }
        if (computed != null) {
            return { value: computed.value, source: computed.source, explicit: false };
        }
        if (valuesClose(raw, fallback)) {
            return { value: fallback, source: "fallback", explicit: false };
        }
        return { value: Math.max(0, raw), source: "user", explicit: true };
    }
    if (computed != null) {
        return { value: computed.value, source: computed.source, explicit: false };
    }
    return { value: fallback, source: "fallback", explicit: false };
}
export function buildResolvedEnvelopeLeakageConfig(resolved) {
    return {
        envelopeAirPermeabilityM3sM2At10Pa: resolved.envelopeAirPermeabilityM3sM2At10Pa.value,
        windowAirPermeabilityM3sMAt10Pa: resolved.windowAirPermeabilityM3sMAt10Pa.value,
        doorAirPermeabilityM3sMAt10Pa: resolved.doorAirPermeabilityM3sMAt10Pa.value,
        pressureExponent: resolved.pressureExponent.value,
        referencePressurePa: resolved.referencePressurePa.value,
    };
}
export function resolveScenarioEnvelopeLeakageInputs(scenarioConfig, scenario, model) {
    const raw = scenarioConfig?.ventilation?.envelopeLeakage;
    const openings = summarizeOpeningLeakageGeometry(model);
    const envelopeComputed = computeEnvelopePermeabilityFromModel(model);
    const windowComputed = computeWindowPermeabilityFromModel(model, openings);
    const doorComputed = computeDoorPermeabilityFromModel(model, openings);
    return {
        envelopeAirPermeabilityM3sM2At10Pa: resolveVentilationScalar(raw?.envelopeAirPermeabilityM3sM2At10Pa, envelopeComputed, DEFAULT_ENVELOPE_LEAKAGE_M3S_M2_AT_10_PA),
        windowAirPermeabilityM3sMAt10Pa: resolveVentilationScalar(raw?.windowAirPermeabilityM3sMAt10Pa, windowComputed, DEFAULT_WINDOW_LEAKAGE_M3S_M_AT_10_PA),
        doorAirPermeabilityM3sMAt10Pa: resolveVentilationScalar(raw?.doorAirPermeabilityM3sMAt10Pa, doorComputed, DEFAULT_DOOR_LEAKAGE_M3S_M_AT_10_PA),
        pressureExponent: resolveVentilationScalar(raw?.pressureExponent, { value: DEFAULT_PRESSURE_EXPONENT, source: "model" }, DEFAULT_PRESSURE_EXPONENT),
        referencePressurePa: resolveVentilationScalar(raw?.referencePressurePa, { value: DEFAULT_REFERENCE_PRESSURE_PA, source: "model" }, DEFAULT_REFERENCE_PRESSURE_PA),
    };
}
