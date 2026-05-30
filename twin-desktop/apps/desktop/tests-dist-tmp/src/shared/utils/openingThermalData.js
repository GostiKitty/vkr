import { buildSolarShadingNote, combineArchitecturalAndSolarShading, computeFacadeSolarAccessFactor, resolveSolarPositionFromTime, resolveWindowFacadeAzimuthDeg, } from "../../core/solar/solarShading";
import { applyEnvelopePresetToDoor, applyEnvelopePresetToWindow, getEnvelopePreset, resolveDefaultPresetId, } from "../../entities/envelope/envelopePresets";
/** Сертифицированный U оконного блока ПВХ с двухкамерным СП (типовой паспорт, ГОСТ 30674-99 / энергоэффективный вариант). */
export const TYPICAL_PVC_WINDOW_U_W_M2K = 1.2;
export const TYPICAL_PVC_WINDOW_G_VALUE = 0.55;
export const TYPICAL_WINDOW_SHADING_FACTOR = 0.9;
export const TYPICAL_INSULATED_DOOR_U_W_M2K = 1.2;
const WINDOW_PRESET_ID = resolveDefaultPresetId("window");
const DOOR_PRESET_ID = resolveDefaultPresetId("door");
export function openingAreaM2(opening) {
    const width = opening.width_m;
    const height = opening.height_m;
    if (width == null || height == null || !Number.isFinite(width) || !Number.isFinite(height)) {
        return 0;
    }
    return Math.max(0, width) * Math.max(0, height);
}
function envelopeFragmentAreaM2(model, constructionTypes) {
    return (model.thermalProtection?.envelope ?? [])
        .filter((fragment) => constructionTypes.includes(fragment.constructionType))
        .reduce((sum, fragment) => sum + Math.max(0, fragment.areaM2 ?? 0), 0);
}
export function resolveModelWindowAreaM2(model) {
    const fromOpenings = model.windows.reduce((sum, window) => sum + openingAreaM2(window), 0);
    if (fromOpenings > 0) {
        return fromOpenings;
    }
    return envelopeFragmentAreaM2(model, ["window", "lantern"]);
}
export function resolveModelDoorAreaM2(model) {
    const fromOpenings = model.doors.reduce((sum, door) => sum + openingAreaM2(door), 0);
    if (fromOpenings > 0) {
        return fromOpenings;
    }
    return envelopeFragmentAreaM2(model, ["door"]);
}
export function hasModelWindowAreaSource(model) {
    return (model.windows.length > 0 ||
        (model.thermalProtection?.envelope ?? []).some((fragment) => fragment.constructionType === "window" || fragment.constructionType === "lantern"));
}
export function hasModelDoorAreaSource(model) {
    return (model.doors.length > 0 ||
        (model.thermalProtection?.envelope ?? []).some((fragment) => fragment.constructionType === "door"));
}
function averageOpeningU(openings) {
    let conductance = 0;
    let area = 0;
    openings.forEach((opening) => {
        const presetU = getEnvelopePreset(opening.envelopePresetId)?.runtimeU_W_m2K ?? null;
        const u = opening.runtimeU_W_m2K ?? presetU;
        if (u == null || !(u > 0)) {
            return;
        }
        const openingArea = openingAreaM2(opening);
        if (openingArea <= 0) {
            return;
        }
        conductance += u * openingArea;
        area += openingArea;
    });
    return area > 0 ? conductance / area : null;
}
function envelopeRuntimeU(model, kind) {
    const constructionType = kind === "window" ? "window" : "door";
    const fragment = (model.thermalProtection?.envelope ?? []).find((entry) => entry.constructionType === constructionType);
    const runtimeU = fragment?.metadata?.runtimeU_W_m2K;
    return runtimeU != null && runtimeU > 0 ? runtimeU : null;
}
export function resolveModelWindowU_W_m2K(model) {
    return averageOpeningU(model.windows) ?? envelopeRuntimeU(model, "window");
}
export function resolveModelDoorU_W_m2K(model) {
    return averageOpeningU(model.doors) ?? envelopeRuntimeU(model, "door");
}
export function applyDefaultOpeningEnvelopeToModel(model) {
    const windows = model.windows.map((window) => applyDefaultWindowEnvelope(window));
    const doors = model.doors.map((door) => applyDefaultDoorEnvelope(door));
    if (windows === model.windows && doors === model.doors) {
        return model;
    }
    return { ...model, windows, doors };
}
export function applyDefaultWindowEnvelope(window) {
    if (window.runtimeU_W_m2K != null && window.runtimeU_W_m2K > 0 && window.reportLayers?.length) {
        return window;
    }
    return applyEnvelopePresetToWindow(window, window.envelopePresetId ?? WINDOW_PRESET_ID);
}
export function applyDefaultDoorEnvelope(door) {
    if (door.runtimeU_W_m2K != null && door.runtimeU_W_m2K > 0 && door.reportLayers?.length) {
        return door;
    }
    return applyEnvelopePresetToDoor(door, door.envelopePresetId ?? DOOR_PRESET_ID);
}
export function windowEnvelopeSourceNote() {
    const preset = getEnvelopePreset(WINDOW_PRESET_ID);
    return (preset?.sourceNote ??
        "ПВХ 3-кам., двухкамерный СП 4-16Ar-4-14Ar-4И; Uw≈1,2 Вт/(м²·К) по типовым протоколам испытаний (ГОСТ 30674-99, энергоэффективный блок).");
}
function finitePositive(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
export function resolveModelWindowGValue(model) {
    // 1. Явное значение из model.meta (задано пользователем)
    const metaValue = finitePositive(model.meta?.windowGValue);
    if (metaValue !== null) {
        return metaValue;
    }
    // 2. Взвешенное среднее g-value из пресетов окон модели
    let conductance = 0;
    let area = 0;
    model.windows.forEach((window) => {
        const preset = getEnvelopePreset(window.envelopePresetId);
        const g = preset?.gValue;
        if (g == null || !(g > 0)) {
            return;
        }
        const openingArea = openingAreaM2(window);
        if (openingArea <= 0) {
            return;
        }
        conductance += g * openingArea;
        area += openingArea;
    });
    return area > 0 ? conductance / area : null;
}
function resolvePresetShadingFactor(preset) {
    if (!preset || preset.kind !== "window") {
        return null;
    }
    return finitePositive(preset.shadingFactor) ?? TYPICAL_WINDOW_SHADING_FACTOR;
}
export function resolveModelShadingFactor(model, options) {
    const metaValue = finitePositive(model.meta?.shadingFactor);
    if (metaValue !== null) {
        return { value: metaValue, usesSolarTime: false, notes: [] };
    }
    const solarPosition = resolveSolarPositionFromTime(options?.solarTime ?? null);
    const usesSolarTime = solarPosition != null;
    let weightedSum = 0;
    let totalArea = 0;
    model.windows.forEach((window) => {
        const preset = getEnvelopePreset(window.envelopePresetId);
        const baseShading = resolvePresetShadingFactor(preset);
        if (baseShading == null) {
            return;
        }
        const areaM2 = openingAreaM2(window);
        if (areaM2 <= 0) {
            return;
        }
        let effectiveShading = baseShading;
        if (solarPosition) {
            const facadeAzimuthDeg = resolveWindowFacadeAzimuthDeg(model, window);
            if (facadeAzimuthDeg != null) {
                const solarAccess = computeFacadeSolarAccessFactor(solarPosition, facadeAzimuthDeg);
                effectiveShading = combineArchitecturalAndSolarShading(baseShading, solarAccess);
            }
        }
        weightedSum += effectiveShading * areaM2;
        totalArea += areaM2;
    });
    const notes = [];
    if (usesSolarTime && options?.solarTime && solarPosition) {
        notes.push(buildSolarShadingNote(options.solarTime, solarPosition));
        notes.push("Эффективное затенение: архитектурное из пресета + положение солнца и ориентация фасада окна (как в конструкторе).");
    }
    else if (totalArea > 0) {
        notes.push(shadingEnvelopeSourceNote());
    }
    return {
        value: totalArea > 0 ? weightedSum / totalArea : null,
        usesSolarTime,
        notes,
    };
}
export function shadingEnvelopeSourceNote() {
    return "Площадно-взвешенное затенение по типам окон в модели (пресет; при отсутствии — типовое 0,9).";
}
export function setModelOpeningUValues(model, input) {
    const nextWindowU = finitePositive(input.windowU_W_m2K);
    const nextDoorU = finitePositive(input.doorU_W_m2K);
    const windows = nextWindowU != null ? model.windows.map((item) => ({ ...item, runtimeU_W_m2K: nextWindowU })) : model.windows;
    const doors = nextDoorU != null ? model.doors.map((item) => ({ ...item, runtimeU_W_m2K: nextDoorU })) : model.doors;
    const envelope = (model.thermalProtection?.envelope ?? []).map((fragment) => {
        if (fragment.constructionType === "window" && nextWindowU != null) {
            return {
                ...fragment,
                metadata: { ...(fragment.metadata ?? {}), runtimeU_W_m2K: nextWindowU },
            };
        }
        if (fragment.constructionType === "door" && nextDoorU != null) {
            return {
                ...fragment,
                metadata: { ...(fragment.metadata ?? {}), runtimeU_W_m2K: nextDoorU },
            };
        }
        return fragment;
    });
    return {
        ...model,
        windows,
        doors,
        thermalProtection: model.thermalProtection
            ? {
                ...model.thermalProtection,
                envelope,
            }
            : model.thermalProtection,
    };
}
export function setModelOpticalFactors(model, input) {
    return {
        ...model,
        meta: {
            ...(model.meta ?? {}),
            windowGValue: finitePositive(input.windowGValue),
            shadingFactor: finitePositive(input.shadingFactor),
        },
    };
}
export function setModelBridgeConductance(model, input) {
    const hPsi = finitePositive(input.H_psi_W_K);
    const hChi = finitePositive(input.H_chi_W_K);
    const envelope = [...(model.thermalProtection?.envelope ?? [])];
    if (!envelope.length) {
        return model;
    }
    const targetIndex = envelope.findIndex((fragment) => fragment.constructionType === "wall");
    const index = targetIndex >= 0 ? targetIndex : 0;
    const target = envelope[index];
    const planar = target.heterogeneity?.planar;
    const nextHeterogeneity = hPsi != null || hChi != null
        ? {
            ...(planar?.length ? { planar } : {}),
            linear: hPsi != null
                ? [{ lengthM: 1, psi_W_mK: hPsi, label: "Задано пользователем" }]
                : [],
            point: hChi != null
                ? [{ count: 1, chi_W_K: hChi, label: "Задано пользователем" }]
                : [],
        }
        : planar?.length
            ? { planar }
            : undefined;
    envelope[index] = {
        ...target,
        heterogeneity: nextHeterogeneity,
    };
    return {
        ...model,
        thermalProtection: {
            ...(model.thermalProtection ?? {}),
            envelope,
        },
    };
}
