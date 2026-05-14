import { simulateThermalNetwork } from "../../src/core/thermal/solver.js";
import { createSinusoidalWeatherProfile } from "../../src/core/thermal/weather.js";
import { test, expectApproximatelyEqual } from "../testHarness.js";
test("one-zone RC model follows analytical solution without отопление", () => {
    const heatCapacity = 50_000; // J/K
    const conductance = 80; // W/K
    const initialTempC = 20;
    const outdoorTempC = 5;
    const durationHours = 2;
    const model = {
        zones: [
            {
                id: "zone",
                name: "Тест",
                area_m2: 40,
                volume_m3: 120,
                capacitance_J_K: heatCapacity,
                infiltrationACH: 0,
                infiltrationConductance_W_K: 0,
            },
        ],
        internalLinks: [],
        outdoorLinks: [
            {
                id: "ext",
                fromZoneId: "zone",
                toZoneId: "outdoor",
                conductance_W_K: conductance,
                area_m2: 20,
                kind: "external",
            },
        ],
    };
    const scenario = {
        durationHours,
        timestepSeconds: 60,
        weather: createSinusoidalWeatherProfile({ baseC: outdoorTempC, amplitudeC: 0 }),
        setpoints: {
            dayC: -50,
            nightC: -50,
            dayStartHour: 0,
            nightStartHour: 12,
        },
        gains: {
            dayGain_W_m2: 0,
            nightGain_W_m2: 0,
            dayStartHour: 0,
            nightStartHour: 12,
        },
        occupancy: {
            dayFraction: 0,
            nightFraction: 0,
            dayStartHour: 0,
            nightStartHour: 12,
        },
        initialTemperatureC: initialTempC,
    };
    const run = simulateThermalNetwork(model, scenario);
    const frames = run.frames;
    const lastFrame = frames[frames.length - 1];
    const lastTempC = lastFrame.rooms.zone.temperatureC;
    const totalSeconds = durationHours * 3600;
    const expected = outdoorTempC + (initialTempC - outdoorTempC) * Math.exp((-conductance / heatCapacity) * totalSeconds);
    expectApproximatelyEqual(lastTempC, expected, 0.15, "Температура зоны должна совпадать с аналитическим решением");
});
