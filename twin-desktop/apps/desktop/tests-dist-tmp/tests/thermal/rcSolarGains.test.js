import assert from "node:assert/strict";
import test from "node:test";
import { runThermalSimulation } from "../../src/core/thermal/solver.js";
import { computeZoneSolarGainW, buildRcZoneSolarModel } from "../../src/core/thermal/solar/rcSolarGains.js";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { applyDefaultWindowEnvelope } from "../../src/shared/utils/openingThermalData.js";
function buildSouthWindowModel() {
    return {
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
                b: { x: 10, y: 0 },
                height_m: 3,
                thickness_m: 0.3,
                layers: [],
            },
        ],
        windows: [
            applyDefaultWindowEnvelope({
                id: "win",
                anchor: { wallId: "wall-s", t: 0.5, offset_m: 5 },
                width_m: 3,
                height_m: 1.5,
                envelopePresetId: "window-pvc-double-glazed",
            }),
        ],
    };
}
test("rc solar: south facade gain is higher at solar noon than at night", () => {
    const model = buildSouthWindowModel();
    const zoneSolar = buildRcZoneSolarModel(model, [], { latitudeDeg: 55.75, dayOfYear: 172 });
    const surfaces = zoneSolar.get("room");
    assert.ok(surfaces && surfaces.length > 0);
    const noonGain = computeZoneSolarGainW(surfaces, 12 * 3600, {
        latitudeDeg: 55.75,
        dayOfYear: 172,
        irradianceW_m2: 220,
    });
    const nightGain = computeZoneSolarGainW(surfaces, 2 * 3600, {
        latitudeDeg: 55.75,
        dayOfYear: 172,
        irradianceW_m2: 220,
    });
    assert.ok(noonGain > nightGain + 10);
});
test("rc solar: simulation with solar enabled reduces heating power at noon", () => {
    const model = buildSouthWindowModel();
    const baseOptions = {
        duration: "24h",
        timestepMinutes: 60,
        outdoor: { baseC: -10, amplitudeC: 3 },
        setpoints: { day: 21, night: 21, dayStartHour: 0, nightStartHour: 24 },
        internalGains: { dayGain_W_m2: 0, nightGain_W_m2: 0 },
        infiltrationACH: 0.3,
        solar: { enabled: true, latitudeDeg: 55.75, dayOfYear: 172, irradianceW_m2: 300 },
    };
    const withSolar = runThermalSimulation(model, baseOptions);
    const withoutSolar = runThermalSimulation(model, { ...baseOptions, solar: { enabled: false } });
    const heatingAt = (result, hour) => {
        const pt = result.rooms.room.timeline.find((p) => Math.abs(p.timeHours - hour) < 0.01);
        return pt?.heatingPowerW ?? 0;
    };
    const noonWith = heatingAt(withSolar, 12);
    const noonWithout = heatingAt(withoutSolar, 12);
    assert.ok(noonWith < noonWithout - 5, `expected less heating with sun: ${noonWith} vs ${noonWithout}`);
});
