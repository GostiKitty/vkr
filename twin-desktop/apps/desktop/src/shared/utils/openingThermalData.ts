import type { BuildingModel, Door, Window } from "../../entities/geometry/types";
import {
  applyEnvelopePresetToDoor,
  applyEnvelopePresetToWindow,
  getEnvelopePreset,
  resolveDefaultPresetId,
} from "../../entities/envelope/envelopePresets";

/** Сертифицированный U оконного блока ПВХ с двухкамерным СП (типовой паспорт, ГОСТ 30674-99 / энергоэффективный вариант). */
export const TYPICAL_PVC_WINDOW_U_W_M2K = 1.2;

export const TYPICAL_PVC_WINDOW_G_VALUE = 0.55;
export const TYPICAL_WINDOW_SHADING_FACTOR = 0.9;

export const TYPICAL_INSULATED_DOOR_U_W_M2K = 1.2;

const WINDOW_PRESET_ID = resolveDefaultPresetId("window");
const DOOR_PRESET_ID = resolveDefaultPresetId("door");

function openingAreaM2(opening: { width_m: number; height_m: number }): number {
  return Math.max(0, opening.width_m) * Math.max(0, opening.height_m);
}

function averageOpeningU(
  openings: Array<{ width_m: number; height_m: number; runtimeU_W_m2K?: number; envelopePresetId?: string }>
): number | null {
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

function envelopeRuntimeU(model: BuildingModel, kind: "window" | "door"): number | null {
  const constructionType = kind === "window" ? "window" : "door";
  const fragment = (model.thermalProtection?.envelope ?? []).find(
    (entry) => entry.constructionType === constructionType
  );
  const runtimeU = fragment?.metadata?.runtimeU_W_m2K;
  return runtimeU != null && runtimeU > 0 ? runtimeU : null;
}

export function resolveModelWindowU_W_m2K(model: BuildingModel): number | null {
  return averageOpeningU(model.windows) ?? envelopeRuntimeU(model, "window");
}

export function resolveModelDoorU_W_m2K(model: BuildingModel): number | null {
  return averageOpeningU(model.doors) ?? envelopeRuntimeU(model, "door");
}

export function applyDefaultOpeningEnvelopeToModel(model: BuildingModel): BuildingModel {
  const windows = model.windows.map((window) => applyDefaultWindowEnvelope(window));
  const doors = model.doors.map((door) => applyDefaultDoorEnvelope(door));
  if (windows === model.windows && doors === model.doors) {
    return model;
  }
  return { ...model, windows, doors };
}

export function applyDefaultWindowEnvelope<T extends Window>(window: T): T {
  if (window.runtimeU_W_m2K != null && window.runtimeU_W_m2K > 0 && window.reportLayers?.length) {
    return window;
  }
  return applyEnvelopePresetToWindow(window, window.envelopePresetId ?? WINDOW_PRESET_ID);
}

export function applyDefaultDoorEnvelope<T extends Door>(door: T): T {
  if (door.runtimeU_W_m2K != null && door.runtimeU_W_m2K > 0 && door.reportLayers?.length) {
    return door;
  }
  return applyEnvelopePresetToDoor(door, door.envelopePresetId ?? DOOR_PRESET_ID);
}

export function windowEnvelopeSourceNote(): string {
  const preset = getEnvelopePreset(WINDOW_PRESET_ID);
  return (
    preset?.sourceNote ??
    "ПВХ 3-кам., двухкамерный СП 4-16Ar-4-14Ar-4И; Uw≈1,2 Вт/(м²·К) по типовым протоколам испытаний (ГОСТ 30674-99, энергоэффективный блок)."
  );
}

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveModelWindowGValue(model: BuildingModel): number | null {
  const value = model.meta?.windowGValue;
  return finitePositive(value);
}

export function resolveModelShadingFactor(model: BuildingModel): number | null {
  const value = model.meta?.shadingFactor;
  return finitePositive(value);
}

export function setModelOpeningUValues(
  model: BuildingModel,
  input: { windowU_W_m2K?: number | null; doorU_W_m2K?: number | null }
): BuildingModel {
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

export function setModelOpticalFactors(
  model: BuildingModel,
  input: { windowGValue?: number | null; shadingFactor?: number | null }
): BuildingModel {
  return {
    ...model,
    meta: {
      ...(model.meta ?? {}),
      windowGValue: finitePositive(input.windowGValue),
      shadingFactor: finitePositive(input.shadingFactor),
    },
  };
}

export function setModelBridgeConductance(
  model: BuildingModel,
  input: { H_psi_W_K?: number | null; H_chi_W_K?: number | null }
): BuildingModel {
  const hPsi = finitePositive(input.H_psi_W_K) ?? 0;
  const hChi = finitePositive(input.H_chi_W_K) ?? 0;
  const envelope = [...(model.thermalProtection?.envelope ?? [])];
  if (!envelope.length) {
    return model;
  }
  const targetIndex = envelope.findIndex((fragment) => fragment.constructionType === "wall");
  const index = targetIndex >= 0 ? targetIndex : 0;
  const target = envelope[index]!;
  envelope[index] = {
    ...target,
    heterogeneity: {
      ...(target.heterogeneity ?? {}),
      linear: hPsi > 0 ? [{ lengthM: 1, psi_W_mK: hPsi, label: "Задано пользователем" }] : [],
      point: hChi > 0 ? [{ count: 1, chi_W_K: hChi, label: "Задано пользователем" }] : [],
    },
  };
  return {
    ...model,
    thermalProtection: {
      ...(model.thermalProtection ?? {}),
      envelope,
    },
  };
}
