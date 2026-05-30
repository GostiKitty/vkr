import { polygonArea, segmentLength } from "../../../entities/geometry/geom";
import type {
  BuildingModel,
  Sp50EnvelopeFragmentInput,
  Sp50EnvelopeFragmentMetadata,
  Wall,
} from "../../../entities/geometry/types";
import {
  describeEnvelopePreset,
  getEnvelopePreset,
  resolveDefaultPresetId,
  resolvePresetLayers,
} from "../../../entities/envelope/envelopePresets";
import {
  getDoorEnvelopeLabel,
  getRoofEnvelopeLabel,
  getSlabEnvelopeLabel,
  getWallEnvelopeLabel,
  getWindowEnvelopeLabel,
} from "../utils/entityLabels";

function wallAreaM2(wall: Wall): number {
  return Math.max(0, segmentLength(wall.a, wall.b) * Math.max(0.2, wall.height_m));
}

function roofAreaM2(roof: NonNullable<BuildingModel["roofs"]>[number]): number {
  const projectedArea = Math.abs(polygonArea(roof.boundary));
  if (roof.kind !== "pitched" || !roof.slope || !Number.isFinite(roof.slope.risePerMeter)) {
    return projectedArea;
  }
  return projectedArea * Math.sqrt(1 + roof.slope.risePerMeter ** 2);
}

function slabAreaM2(slab: NonNullable<BuildingModel["floorSlabs"]>[number]): number {
  return Math.abs(polygonArea(slab.boundary));
}

function buildFragmentMetadata(presetId: string | undefined, runtimeU?: number): Sp50EnvelopeFragmentMetadata | undefined {
  const preset = getEnvelopePreset(presetId);
  if (!preset && runtimeU == null) {
    return undefined;
  }
  return {
    presetId: preset?.id,
    presetLabel: preset?.name,
    sourceNote: preset?.sourceNote ?? describeEnvelopePreset(presetId) ?? undefined,
    sourceType: preset ? "preset" : undefined,
    runtimeU_W_m2K: runtimeU ?? preset?.runtimeU_W_m2K,
  };
}

function resolveWallLayers(wall: Wall) {
  if (wall.layers?.length) {
    return wall.layers.map((layer) => ({ ...layer }));
  }
  const preset = getEnvelopePreset(wall.envelopePresetId ?? resolveDefaultPresetId("wall"));
  return preset ? resolvePresetLayers(preset) : [];
}

function resolveRoofLayers(roof: NonNullable<BuildingModel["roofs"]>[number]) {
  if (roof.layers?.length) {
    return roof.layers.map((layer) => ({ ...layer }));
  }
  const preset = getEnvelopePreset(roof.envelopePresetId ?? resolveDefaultPresetId("roof"));
  return preset ? resolvePresetLayers(preset) : [];
}

function resolveSlabLayers(slab: NonNullable<BuildingModel["floorSlabs"]>[number]) {
  if (slab.layers?.length) {
    return slab.layers.map((layer) => ({ ...layer }));
  }
  const preset = getEnvelopePreset(slab.envelopePresetId ?? resolveDefaultPresetId("slab"));
  return preset ? resolvePresetLayers(preset) : [];
}

function resolveOpeningLayers(
  opening: { envelopePresetId?: string; reportLayers?: BuildingModel["walls"][number]["layers"] },
  kind: "window" | "door"
) {
  if (opening.reportLayers?.length) {
    return opening.reportLayers.map((layer) => ({ ...layer }));
  }
  const preset = getEnvelopePreset(opening.envelopePresetId ?? resolveDefaultPresetId(kind));
  return preset ? resolvePresetLayers(preset) : [];
}

function mapSlabConstructionType(kind: NonNullable<BuildingModel["floorSlabs"]>[number]["kind"]) {
  switch (kind) {
    case "attic":
      return "atticFloor" as const;
    case "basement":
      return "floorOverBasement" as const;
    case "ground":
      return "floorOnGround" as const;
    default:
      return "atticFloor" as const;
  }
}

export function syncThermalProtectionEnvelope(model: BuildingModel): BuildingModel {
  const previousEnvelopeById = new Map(
    (model.thermalProtection?.envelope ?? []).map((fragment) => [fragment.id, fragment])
  );
  const envelope: Sp50EnvelopeFragmentInput[] = [];
  const heatedAreaM2 =
    model.thermalProtection?.heatedAreaM2 ??
    model.rooms.reduce((sum, room) => sum + Math.abs(polygonArea(room.polygon)), 0);
  const averageHeight =
    model.levels.reduce((sum, level) => sum + level.height_m, 0) / Math.max(model.levels.length, 1);
  const heatedVolumeM3 = model.thermalProtection?.heatedVolumeM3 ?? heatedAreaM2 * averageHeight;

  model.walls.forEach((wall) => {
    const preset = getEnvelopePreset(wall.envelopePresetId);
    envelope.push({
      id: `wall-${wall.id}`,
      label: getWallEnvelopeLabel(model, wall),
      constructionType: preset?.constructionType ?? "wall",
      areaM2: Number(wallAreaM2(wall).toFixed(3)),
      conditionedAreaM2: heatedAreaM2 > 0 ? Number(heatedAreaM2.toFixed(3)) : undefined,
      conditionedVolumeM3: heatedVolumeM3 > 0 ? Number(heatedVolumeM3.toFixed(3)) : undefined,
      layers: resolveWallLayers(wall),
      metadata: buildFragmentMetadata(wall.envelopePresetId),
      heterogeneity: previousEnvelopeById.get(`wall-${wall.id}`)?.heterogeneity,
    });
  });

  model.windows.forEach((windowItem, index) => {
    const preset = getEnvelopePreset(windowItem.envelopePresetId);
    envelope.push({
      id: `window-${windowItem.id}`,
      label: getWindowEnvelopeLabel(model, windowItem, index),
      constructionType: "window",
      areaM2: Number((windowItem.width_m * windowItem.height_m).toFixed(3)),
      layers: resolveOpeningLayers(windowItem, "window"),
      metadata: buildFragmentMetadata(windowItem.envelopePresetId, windowItem.runtimeU_W_m2K ?? preset?.runtimeU_W_m2K),
      heterogeneity: previousEnvelopeById.get(`window-${windowItem.id}`)?.heterogeneity,
    });
  });

  model.doors.forEach((door, index) => {
    const preset = getEnvelopePreset(door.envelopePresetId);
    envelope.push({
      id: `door-${door.id}`,
      label: getDoorEnvelopeLabel(model, door, index),
      constructionType: "door",
      areaM2: Number((door.width_m * door.height_m).toFixed(3)),
      layers: resolveOpeningLayers(door, "door"),
      metadata: buildFragmentMetadata(door.envelopePresetId, door.runtimeU_W_m2K ?? preset?.runtimeU_W_m2K),
      heterogeneity: previousEnvelopeById.get(`door-${door.id}`)?.heterogeneity,
    });
  });

  (model.roofs ?? []).forEach((roof, index) => {
    const preset = getEnvelopePreset(roof.envelopePresetId);
    envelope.push({
      id: `roof-${roof.id}`,
      label: getRoofEnvelopeLabel(model, roof, index),
      constructionType: preset?.constructionType ?? "covering",
      areaM2: Number(roofAreaM2(roof).toFixed(3)),
      layers: resolveRoofLayers(roof),
      metadata: buildFragmentMetadata(roof.envelopePresetId),
      heterogeneity: previousEnvelopeById.get(`roof-${roof.id}`)?.heterogeneity,
    });
  });

  (model.floorSlabs ?? []).forEach((slab, index) => {
    const preset = getEnvelopePreset(slab.envelopePresetId);
    envelope.push({
      id: `slab-${slab.id}`,
      label: getSlabEnvelopeLabel(model, slab, index),
      constructionType: preset?.constructionType ?? mapSlabConstructionType(slab.kind),
      areaM2: Number(slabAreaM2(slab).toFixed(3)),
      layers: resolveSlabLayers(slab),
      metadata: buildFragmentMetadata(slab.envelopePresetId),
      heterogeneity: previousEnvelopeById.get(`slab-${slab.id}`)?.heterogeneity,
    });
  });

  return {
    ...model,
    thermalProtection: {
      ...(model.thermalProtection ?? {}),
      heatedAreaM2,
      heatedVolumeM3,
      envelope,
    },
  };
}
