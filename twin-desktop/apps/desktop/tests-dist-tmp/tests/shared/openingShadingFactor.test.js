import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types";
import { applyDefaultWindowEnvelope } from "../../src/shared/utils/openingThermalData";
import { resolveModelShadingFactor } from "../../src/shared/utils/openingThermalData";
test("resolveModelShadingFactor uses area-weighted preset shading for windows", () => {
    const model = {
        ...createEmptyBuildingModel(),
        windows: [
            applyDefaultWindowEnvelope({
                id: "w1",
                anchor: { wallId: "wall-1", offset_m: 0 },
                width_m: 2,
                height_m: 1.5,
                elevation_m: 0.9,
                envelopePresetId: "window-pvc-double-glazed",
            }),
            applyDefaultWindowEnvelope({
                id: "w2",
                anchor: { wallId: "wall-1", offset_m: 2 },
                width_m: 1,
                height_m: 1,
                elevation_m: 0.9,
                envelopePresetId: "window-pvc-triple-low-e",
            }),
        ],
        thermalProtection: {
            envelope: [],
        },
    };
    const shading = resolveModelShadingFactor(model);
    assert.equal(shading.value, 0.9);
});
test("resolveModelShadingFactor prefers model.meta over presets", () => {
    const model = {
        ...createEmptyBuildingModel(),
        meta: { shadingFactor: 0.75 },
        windows: [
            applyDefaultWindowEnvelope({
                id: "w1",
                anchor: { wallId: "wall-1", offset_m: 0 },
                width_m: 2,
                height_m: 1.5,
                elevation_m: 0.9,
                envelopePresetId: "window-pvc-double-glazed",
            }),
        ],
    };
    assert.equal(resolveModelShadingFactor(model).value, 0.75);
});
