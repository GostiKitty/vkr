import { buildThermalModel } from "./model";
import { createSinusoidalWeatherProfile } from "./weather";
import { evaluateInternalGains, evaluateSetpoint, } from "./schedules";
import { computeSimulationMetrics } from "./metrics";
const SECONDS_PER_HOUR = 3600;
const DEFAULT_TIMESTEP_SECONDS = 600;
const ABS_ZERO_OFFSET = 273.15;
export function runThermalSimulation(building, options, adjacency) {
    const durationHours = options.duration === "7d" ? 24 * 7 : 24;
    const timestepSeconds = Math.max(60, Math.round((options.timestepMinutes ?? 10) * 60));
    const { model: thermalModel } = buildThermalModel(building, {
        adjacency,
        infiltrationACH: options.infiltrationACH,
        effectiveMassFactor: options.engineering?.effectiveMassFactor ?? 1,
    });
    const scenario = {
        durationHours,
        timestepSeconds,
        weather: createSinusoidalWeatherProfile(options.outdoor),
        setpoints: {
            dayC: options.setpoints.day,
            nightC: options.setpoints.night,
            dayStartHour: options.setpoints.dayStartHour,
            nightStartHour: options.setpoints.nightStartHour,
        },
        gains: {
            dayGain_W_m2: options.internalGains.dayGain_W_m2,
            nightGain_W_m2: options.internalGains.nightGain_W_m2,
            dayStartHour: options.internalGains.dayStartHour ?? options.setpoints.dayStartHour,
            nightStartHour: options.internalGains.nightStartHour ?? options.setpoints.nightStartHour,
        },
        occupancy: options.occupancy ?? {
            dayFraction: 1,
            nightFraction: 0.2,
            dayStartHour: options.setpoints.dayStartHour,
            nightStartHour: options.setpoints.nightStartHour,
        },
        initialTemperatureC: options.initialTemperatureC ?? options.setpoints.night,
    };
    const run = simulateThermalNetwork(thermalModel, scenario);
    const metrics = computeSimulationMetrics(run.metricFrames);
    const rooms = {};
    run.roomHistories.forEach((history, roomId) => {
        const zoneMetrics = metrics.zones[roomId];
        rooms[roomId] = {
            roomId,
            timeline: history.timeline,
            dailyEnergyKWh: zoneMetrics ? zoneMetrics.energyJ / 3_600_000 : 0,
            discomfortHours: zoneMetrics ? zoneMetrics.discomfortSeconds / 3600 : 0,
        };
    });
    return {
        timeline: run.frames,
        rooms,
        summary: {
            peakLoadKW: metrics.peakHeatingW / 1000,
            totalEnergyKWh: metrics.totalEnergyJ / 3_600_000,
            discomfortHours: metrics.discomfortSeconds / 3600,
        },
    };
}
export function simulateThermalNetwork(model, scenario) {
    if (!model.zones.length) {
        throw new Error("Модель не содержит зон для расчёта.");
    }
    if (scenario.durationHours <= 0) {
        throw new Error("durationHours должен быть больше нуля.");
    }
    const timestepSeconds = scenario.timestepSeconds || DEFAULT_TIMESTEP_SECONDS;
    if (timestepSeconds <= 0) {
        throw new Error("timestepSeconds должен быть положительным.");
    }
    const totalSteps = Math.round((scenario.durationHours * SECONDS_PER_HOUR) / timestepSeconds);
    const adjacency = buildZoneAdjacency(model);
    const zoneState = initializeZoneState(model.zones, scenario.initialTemperatureC);
    const roomHistories = new Map(model.zones.map((zone) => [
        zone.id,
        {
            roomId: zone.id,
            timeline: [],
            dailyEnergyKWh: 0,
            discomfortHours: 0,
        },
    ]));
    const frames = [];
    const metricFrames = [];
    for (let step = 0; step <= totalSteps; step++) {
        const timeSeconds = step * timestepSeconds;
        const timeHours = timeSeconds / SECONDS_PER_HOUR;
        const outdoorC = scenario.weather.temperatureC(timeSeconds);
        const outdoorK = outdoorC + ABS_ZERO_OFFSET;
        const frame = {
            timeHours,
            outdoorTemperatureC: outdoorC,
            rooms: {},
        };
        const metricFrame = {
            timeSeconds,
            outdoorTemperatureC: outdoorC,
            timestepSeconds,
            zones: [],
        };
        const updates = [];
        model.zones.forEach((zone) => {
            const currentTempK = zoneState.get(zone.id) ?? (scenario.initialTemperatureC + ABS_ZERO_OFFSET);
            const currentTempC = currentTempK - ABS_ZERO_OFFSET;
            const setpointC = evaluateSetpoint(scenario.setpoints, timeSeconds);
            const setpointK = setpointC + ABS_ZERO_OFFSET;
            const connections = adjacency.get(zone.id);
            let netPowerW = 0;
            connections?.internal.forEach((link) => {
                const neighborId = link.fromZoneId === zone.id ? link.toZoneId : link.fromZoneId;
                const neighborTempK = zoneState.get(neighborId);
                if (neighborTempK !== undefined) {
                    netPowerW += link.conductance_W_K * (neighborTempK - currentTempK);
                }
            });
            connections?.external.forEach((link) => {
                netPowerW += link.conductance_W_K * (outdoorK - currentTempK);
            });
            netPowerW += zone.infiltrationConductance_W_K * (outdoorK - currentTempK);
            const { gainW } = evaluateInternalGains(scenario.gains, scenario.occupancy, timeSeconds, zone.area_m2);
            netPowerW += gainW;
            const predictedK = currentTempK + (netPowerW / zone.capacitance_J_K) * timestepSeconds;
            let heatingPowerW = 0;
            let nextTempK = predictedK;
            if (predictedK < setpointK) {
                const deltaK = setpointK - predictedK;
                heatingPowerW = (deltaK * zone.capacitance_J_K) / timestepSeconds;
                nextTempK = setpointK;
            }
            frame.rooms[zone.id] = {
                temperatureC: currentTempC,
                heatingPowerW,
                setpointC,
            };
            metricFrame.zones.push({
                zoneId: zone.id,
                temperatureC: currentTempC,
                setpointC,
                heatingPowerW,
            });
            const history = roomHistories.get(zone.id);
            if (history) {
                history.timeline.push({
                    timeHours,
                    temperatureC: currentTempC,
                    heatingPowerW,
                });
            }
            updates.push({ zoneId: zone.id, nextTempK });
        });
        frames.push(frame);
        metricFrames.push(metricFrame);
        updates.forEach(({ zoneId, nextTempK }) => zoneState.set(zoneId, nextTempK));
    }
    return {
        frames,
        roomHistories,
        metricFrames,
    };
}
function buildZoneAdjacency(model) {
    const adjacency = new Map();
    model.zones.forEach((zone) => {
        adjacency.set(zone.id, { internal: [], external: [] });
    });
    model.internalLinks.forEach((link) => {
        const from = adjacency.get(link.fromZoneId);
        const to = adjacency.get(link.toZoneId);
        if (from) {
            from.internal.push(link);
        }
        if (to) {
            to.internal.push(link);
        }
    });
    model.outdoorLinks.forEach((link) => {
        const entry = adjacency.get(link.fromZoneId);
        if (entry) {
            entry.external.push(link);
        }
    });
    return adjacency;
}
function initializeZoneState(zones, initialTempC) {
    const initialK = initialTempC + ABS_ZERO_OFFSET;
    const map = new Map();
    zones.forEach((zone) => map.set(zone.id, initialK));
    return map;
}
