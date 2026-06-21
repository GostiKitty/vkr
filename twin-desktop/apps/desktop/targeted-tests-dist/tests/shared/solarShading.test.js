import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types";
import { applyDefaultWindowEnvelope } from "../../src/shared/utils/openingThermalData";
import { resolveModelShadingFactor } from "../../src/shared/utils/openingThermalData";
import { combineArchitecturalAndSolarShading, computeFacadeSolarAccessFactor, } from "../../src/core/solar/solarShading";
import { computeSolarPosition } from "../../src/core/solar/solarPosition";
test("south facade gets direct sun near solar noon on summer day in Moscow", () => {
    const solar = computeSolarPosition({
        latitudeDeg: 55.75,
        dayOfYear: 172,
        hourDecimal: 12,
    });
    const access = computeFacadeSolarAccessFactor(solar, 180);
    assert.ok(access > 0.5);
});
test("north facade gets no direct sun near solar noon on summer day", () => {
    const solar = computeSolarPosition({
        latitudeDeg: 55.75,
        dayOfYear: 172,
        hourDecimal: 12,
    });
    const access = computeFacadeSolarAccessFactor(solar, 0);
    assert.equal(access, 0);
});
test("combineArchitecturalAndSolarShading increases factor when sun is behind facade", () => {
    const combined = combineArchitecturalAndSolarShading(0.9, 0);
    assert.equal(combined, 1);
});
test("resolveModelShadingFactor uses solar time for window on south wall", () => {
    const model = {
        ...createEmptyBuildingModel(),
        levels: [{ id: "lvl", name: "1", elevation_m: 0, height_m: 3 }],
        rooms: [
            {
                id: "room",
                levelId: "lvl",
                name: "Room",
                polygon: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 8 },
                    { x: 0, y: 8 },
                ],
                source: "user",
            },
        ],
        walls: [
            {
                id: "wall-s",
                levelId: "lvl",
                a: { x: 0, y: 0 },
                b: { x: 0, y: -10 },
                height_m: 3,
                thickness_m: 0.3,
                layers: [],
            },
        ],
        windows: [
            applyDefaultWindowEnvelope({
                id: "win",
                anchor: { wallId: "wall-s", t: 0.5, offset_m: 5 },
                width_m: 2,
                height_m: 1.5,
                envelopePresetId: "window-pvc-double-glazed",
            }),
        ],
    };
    const noon = resolveModelShadingFactor(model, {
        solarTime: { latitudeDeg: 55.75, dayOfYear: 172, hour: 12 },
    });
    const night = resolveModelShadingFactor(model, {
        solarTime: { latitudeDeg: 55.75, dayOfYear: 172, hour: 0 },
    });
    assert.ok(noon.usesSolarTime);
    assert.ok(night.usesSolarTime);
    assert.ok((noon.value ?? 1) < (night.value ?? 0));
});
