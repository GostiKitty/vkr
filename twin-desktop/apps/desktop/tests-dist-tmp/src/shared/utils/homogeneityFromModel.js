import { computeWallProperties } from "../../entities/material/types";
import { thermalBridgeLinearConductance, thermalBridgePointConductance, } from "../../core/thermal/formulas";
import { calculateReducedResistance } from "../../core/thermal/sp50/calculations";
const OPAQUE_CONSTRUCTION_TYPES = new Set([
    "wall",
    "roof",
    "covering",
    "atticFloor",
    "floorOverBasement",
    "floorOnGround",
]);
function clampHomogeneityCoefficient(value) {
    return Math.min(1, Math.max(0.01, value));
}
/**
 * r = R_red / R_0 при эквивалентном учёте линейных и точечных мостиков:
 * G = A/R_0 + H_psi + H_chi  =>  R_red = A/G  =>  r = A / (A + (H_psi + H_chi) * R_0).
 */
export function homogeneityCoefficientFromLinearPointBridges(r0_m2K_W, areaM2, linear, point) {
    if (!(r0_m2K_W > 0) || !(areaM2 > 0)) {
        return 1;
    }
    const bridgeConductance_W_K = thermalBridgeLinearConductance(linear) + thermalBridgePointConductance(point);
    if (bridgeConductance_W_K <= 0) {
        return 1;
    }
    return clampHomogeneityCoefficient(areaM2 / (areaM2 + bridgeConductance_W_K * r0_m2K_W));
}
function resolveFragmentR0_m2K_W(fragment) {
    const presetU = fragment.metadata?.runtimeU_W_m2K;
    if (presetU != null && presetU > 0) {
        return 1 / presetU;
    }
    if (!fragment.layers?.length) {
        return null;
    }
    const props = computeWallProperties(fragment.layers, undefined, { includeSp50AirFilms: true });
    const r0 = props?.rTotal_m2K_W;
    return r0 != null && r0 > 0 ? r0 : null;
}
export function resolveFragmentHomogeneityCoefficient(fragment, r0_m2K_W) {
    if (r0_m2K_W == null || !(r0_m2K_W > 0)) {
        return null;
    }
    const linear = fragment.heterogeneity?.linear ?? [];
    const point = fragment.heterogeneity?.point ?? [];
    const planar = fragment.heterogeneity?.planar ?? [];
    if (planar.length > 0) {
        const totalPlanarArea = planar.reduce((sum, zone) => sum + Math.max(0, zone.areaM2), 0);
        const referenceArea = totalPlanarArea > 0 ? totalPlanarArea : Math.max(0, fragment.areaM2);
        if (referenceArea > 0) {
            const areaFractions = planar.map((zone) => Math.max(0, zone.areaM2) / referenceArea);
            const planarResistances = planar.map((zone) => zone.resistance_m2K_W);
            if (planarResistances.every((resistance) => resistance > 0)) {
                const reducedResistance = calculateReducedResistance({
                    areaFractions,
                    planarResistances_m2K_W: planarResistances,
                    linear,
                    point,
                });
                if (reducedResistance > 0) {
                    return clampHomogeneityCoefficient(reducedResistance / r0_m2K_W);
                }
            }
        }
    }
    if (linear.length > 0 || point.length > 0) {
        return homogeneityCoefficientFromLinearPointBridges(r0_m2K_W, Math.max(0, fragment.areaM2), linear, point);
    }
    return 1;
}
export function resolveModelHomogeneityCoefficient(model) {
    const fragments = model.thermalProtection?.envelope ?? [];
    const byFragmentId = {};
    let weightedSum = 0;
    let totalArea = 0;
    let hasBridgeData = false;
    const notes = [];
    fragments.forEach((fragment) => {
        if (!OPAQUE_CONSTRUCTION_TYPES.has(fragment.constructionType)) {
            return;
        }
        const linear = fragment.heterogeneity?.linear ?? [];
        const point = fragment.heterogeneity?.point ?? [];
        const planar = fragment.heterogeneity?.planar ?? [];
        if (linear.length > 0 || point.length > 0 || planar.length > 0) {
            hasBridgeData = true;
        }
        const r0 = resolveFragmentR0_m2K_W(fragment);
        const coefficient = resolveFragmentHomogeneityCoefficient(fragment, r0);
        if (coefficient == null) {
            return;
        }
        byFragmentId[fragment.id] = coefficient;
        const areaM2 = Math.max(0, fragment.areaM2);
        if (areaM2 > 0) {
            weightedSum += coefficient * areaM2;
            totalArea += areaM2;
        }
    });
    const value = totalArea > 0 ? weightedSum / totalArea : null;
    if (fragments.length === 0) {
        notes.push("В модели нет фрагментов ограждения — r из модели недоступен.");
    }
    else if (!hasBridgeData) {
        notes.push("В модели не заданы ψ/χ и зоны неоднородности — для однородной конструкции r = 1,0.");
    }
    else if (value != null) {
        notes.push("r рассчитан по данным модели: для каждого ограждения R_red / R_0 с учётом ψ, χ и зон, затем усреднение по площади.");
    }
    return { value, byFragmentId, hasBridgeData, notes };
}
