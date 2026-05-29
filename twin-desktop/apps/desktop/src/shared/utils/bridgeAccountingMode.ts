import type { BuildingModel } from "../../entities/geometry/types";

export type BridgeAccountingMode = "disabled" | "homogeneityCoefficient" | "explicitPsiChi";

export interface ResolvedBridgeAccounting {
  mode: BridgeAccountingMode;
  origin: "user" | "calculated";
  userMode: BridgeAccountingMode | undefined;
  notes: string[];
}

const OPAQUE_CONSTRUCTION_TYPES = new Set([
  "wall",
  "roof",
  "covering",
  "atticFloor",
  "floorOverBasement",
  "floorOnGround",
]);

export function modelHasLinearOrPointBridges(model: BuildingModel): boolean {
  return (model.thermalProtection?.envelope ?? []).some(
    (fragment) =>
      (fragment.heterogeneity?.linear?.length ?? 0) > 0 || (fragment.heterogeneity?.point?.length ?? 0) > 0
  );
}

export function modelHasPlanarHeterogeneity(model: BuildingModel): boolean {
  return (model.thermalProtection?.envelope ?? []).some((fragment) => (fragment.heterogeneity?.planar?.length ?? 0) > 0);
}

function modelHasOpaqueEnvelope(model: BuildingModel): boolean {
  return (model.thermalProtection?.envelope ?? []).some((fragment) =>
    OPAQUE_CONSTRUCTION_TYPES.has(fragment.constructionType)
  );
}

/**
 * Выбирает способ учёта мостиков: явный ψ/χ точнее при наличии данных в модели;
 * r — когда задан только сводный коэффициент или плоскостные зоны.
 */
export function resolveBridgeAccountingMode(input: {
  userMode?: BridgeAccountingMode;
  userHomogeneityCoefficient: number | null;
  model: BuildingModel;
}): ResolvedBridgeAccounting {
  const { userMode, userHomogeneityCoefficient, model } = input;
  const hasPsiChi = modelHasLinearOrPointBridges(model);
  const hasPlanar = modelHasPlanarHeterogeneity(model);
  const notes: string[] = [];

  if (userMode === "disabled" && !hasPsiChi && !hasPlanar && userHomogeneityCoefficient == null) {
    return { mode: "disabled", origin: "user", userMode, notes };
  }

  if (hasPsiChi) {
    if (userMode === "homogeneityCoefficient" || userHomogeneityCoefficient != null) {
      notes.push(
        "В модели заданы ψ/χ — для расчёта потерь выбран явный учёт мостиков (нормативно точнее, чем одновременно ухудшать R через r)."
      );
    } else if (userMode !== "explicitPsiChi") {
      notes.push("В модели заданы ψ/χ — режим учёта мостиков выбран автоматически: линейные/точечные ψ/χ.");
    }
    return {
      mode: "explicitPsiChi",
      origin: userMode === "explicitPsiChi" ? "user" : "calculated",
      userMode,
      notes,
    };
  }

  if (userMode === "explicitPsiChi") {
    return {
      mode: "explicitPsiChi",
      origin: "user",
      userMode,
      notes: ["Режим ψ/χ: в модели нет линейных/точечных мостиков — H_psi = 0, H_chi = 0."],
    };
  }

  if (
    userMode === "homogeneityCoefficient" ||
    userHomogeneityCoefficient != null ||
    hasPlanar
  ) {
    if (hasPlanar && userMode !== "homogeneityCoefficient" && userHomogeneityCoefficient == null) {
      notes.push("В модели заданы плоскостные зоны неоднородности — учёт через коэффициент однородности и R_red.");
    }
    return {
      mode: "homogeneityCoefficient",
      origin:
        userMode === "homogeneityCoefficient" || userHomogeneityCoefficient != null ? "user" : "calculated",
      userMode,
      notes,
    };
  }

  if (userMode === "disabled") {
    return { mode: "disabled", origin: "user", userMode, notes };
  }

  if (modelHasOpaqueEnvelope(model)) {
    return { mode: "disabled", origin: "calculated", userMode, notes };
  }

  return { mode: "disabled", origin: "calculated", userMode, notes };
}

export function isOpaqueConstructionKind(kind: string): boolean {
  return kind === "wall" || kind === "roof" || kind === "slab";
}
