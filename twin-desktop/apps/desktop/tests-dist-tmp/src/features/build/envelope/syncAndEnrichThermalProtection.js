import { enrichEnvelopeThermalBridges } from "../../../core/thermal/envelope/enrichEnvelopeThermalBridges";
import { enrichVideoDemoEnvelopeThermalBridges } from "../../../demo/deriveExteriorWallThermalBridges";
import { syncThermalProtectionEnvelope } from "./syncThermalProtectionEnvelope";
/** Синхронизирует envelope из геометрии и подставляет ψ/χ (СП 230) по слоям и контуру. */
export function syncAndEnrichThermalProtection(model) {
    const hasEnvelopeGeometry = model.walls.length > 0 || (model.roofs?.length ?? 0) > 0 || (model.floorSlabs?.length ?? 0) > 0;
    let next = hasEnvelopeGeometry ? syncThermalProtectionEnvelope(model) : model;
    next = enrichVideoDemoEnvelopeThermalBridges(next);
    next = enrichEnvelopeThermalBridges(next);
    return next;
}
