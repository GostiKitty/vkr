/**
 * Verifies that the RC solver produces a well-formed temperature timeline
 * that the ThermalTimeSeriesChart can render without empty lines.
 *
 * Guards against regression where:
 * - room.timeline[i] is missing `temperatureC` or `setpointC`
 * - the chart's plottedData for temperature mode is empty
 * - heating data exists but temperature data does not
 */

import { runThermalSimulation } from "../../src/core/thermal/solver.js";
import { videoDemoHouse } from "../../src/demo/videoDemoHouse.js";
import { test } from "../testHarness.js";

const BASE_OPTIONS = {
  duration: "24h" as const,
  outdoor: { baseC: -26, amplitudeC: 4 },
  setpoints: { day: 21, night: 18, dayStartHour: 7, nightStartHour: 22 },
  internalGains: { dayGain_W_m2: 5, nightGain_W_m2: 1 },
  infiltrationACH: 0.5,
  ventilationACH: 0,
};

function runDemo() {
  return runThermalSimulation(videoDemoHouse, BASE_OPTIONS);
}

test("temperature series: result.rooms has at least one room with a non-empty timeline", () => {
  const result = runDemo();
  const roomIds = Object.keys(result.rooms);
  if (roomIds.length === 0) {
    throw new Error("result.rooms is empty — no zones produced by the solver.");
  }
  const roomsWithTimeline = roomIds.filter((id) => result.rooms[id].timeline.length > 0);
  if (!roomsWithTimeline.length) {
    throw new Error("No room has a non-empty timeline.");
  }
});

test("temperature series: every timeline point has finite temperatureC and heatingPowerW", () => {
  const result = runDemo();
  for (const [roomId, room] of Object.entries(result.rooms)) {
    for (let i = 0; i < room.timeline.length; i++) {
      const pt = room.timeline[i];
      if (!Number.isFinite(pt.temperatureC)) {
        throw new Error(
          `room ${roomId} timeline[${i}].temperatureC is not finite: ${pt.temperatureC}`
        );
      }
      if (!Number.isFinite(pt.heatingPowerW)) {
        throw new Error(
          `room ${roomId} timeline[${i}].heatingPowerW is not finite: ${pt.heatingPowerW}`
        );
      }
    }
  }
});

test("temperature series: every timeline point has setpointC (after solver fix)", () => {
  const result = runDemo();
  for (const [roomId, room] of Object.entries(result.rooms)) {
    for (let i = 0; i < room.timeline.length; i++) {
      const pt = room.timeline[i];
      if (pt.setpointC === undefined || !Number.isFinite(pt.setpointC)) {
        throw new Error(
          `room ${roomId} timeline[${i}].setpointC is missing or not finite: ${pt.setpointC}. ` +
            "Ensure the solver pushes setpointC in history.timeline.push(...)."
        );
      }
    }
  }
});

test("temperature series: temperatureC values are within realistic bounds", () => {
  const result = runDemo();
  // For a -26°C outdoor scenario with 18–21°C setpoints,
  // indoor temperature should never go below outdoor and never above extreme overheating
  const OUTDOOR_LOWER_BOUND = -30;
  const UPPER_BOUND = 35;
  for (const [roomId, room] of Object.entries(result.rooms)) {
    for (let i = 0; i < room.timeline.length; i++) {
      const { temperatureC } = room.timeline[i];
      if (temperatureC < OUTDOOR_LOWER_BOUND || temperatureC > UPPER_BOUND) {
        throw new Error(
          `room ${roomId} timeline[${i}].temperatureC = ${temperatureC.toFixed(2)} °C ` +
            `is outside realistic bounds [${OUTDOOR_LOWER_BOUND}, ${UPPER_BOUND}].`
        );
      }
    }
  }
});

test("temperature series: setpointC values are within [night, day] range", () => {
  // When setpointRampMinutes > 0 the setpoint interpolates between nightC and dayC
  // during transition windows — so it may not be exactly one of the two values.
  const result = runDemo();
  const DAY_SETPOINT = BASE_OPTIONS.setpoints.day;    // 21
  const NIGHT_SETPOINT = BASE_OPTIONS.setpoints.night; // 18
  const lo = Math.min(DAY_SETPOINT, NIGHT_SETPOINT);
  const hi = Math.max(DAY_SETPOINT, NIGHT_SETPOINT);
  for (const [roomId, room] of Object.entries(result.rooms)) {
    for (let i = 0; i < room.timeline.length; i++) {
      const { setpointC } = room.timeline[i];
      if (setpointC === undefined) {
        continue; // covered by previous test
      }
      if (setpointC < lo - 0.01 || setpointC > hi + 0.01) {
        throw new Error(
          `room ${roomId} timeline[${i}].setpointC = ${setpointC} is outside [${lo}, ${hi}].`
        );
      }
    }
  }
});

test("temperature series: buildChartPoints produces non-empty temperature payload", () => {
  // Simulates what ThermalTimeSeriesChart.buildChartPoints does:
  // map room timeline → {airTemperatureC, setpointC, heatingPowerKW}
  // and verify the temperature mode filter yields non-zero points.
  const result = runDemo();
  const roomIds = Object.keys(result.rooms).filter((id) => result.rooms[id].timeline.length > 0);
  if (!roomIds.length) {
    throw new Error("No rooms with timeline data.");
  }

  const firstRoomId = roomIds[0];
  const room = result.rooms[firstRoomId];

  const chartPoints = room.timeline.map((pt, index) => {
    const airTemperatureC = Number.isFinite(pt.temperatureC) ? pt.temperatureC : null;
    const heatingPowerKW = Number.isFinite(pt.heatingPowerW) ? pt.heatingPowerW / 1000 : null;

    // setpointC: prefer room timeline, fall back to main frame
    let setpointC: number | null = Number.isFinite(pt.setpointC) ? (pt.setpointC as number) : null;
    if (setpointC === null) {
      const frame = result.timeline[index];
      const frameSetpoint = frame?.rooms?.[firstRoomId]?.setpointC;
      setpointC = Number.isFinite(frameSetpoint) ? (frameSetpoint as number) : null;
    }

    return { timeHours: pt.timeHours, airTemperatureC, setpointC, heatingPowerKW };
  });

  // Temperature mode filter: same as in ThermalTimeSeriesChart.plottedData
  const tempPlottedData = chartPoints.filter(
    (pt) =>
      (typeof pt.airTemperatureC === "number" && Number.isFinite(pt.airTemperatureC)) ||
      (typeof pt.setpointC === "number" && Number.isFinite(pt.setpointC))
  );

  if (tempPlottedData.length === 0) {
    throw new Error(
      `Temperature mode plottedData is empty for room ${firstRoomId}. ` +
        `All ${chartPoints.length} chart points have null airTemperatureC and null setpointC. ` +
        "This would cause the temperature tab to show empty axes with no lines."
    );
  }

  // Verify airTemperatureC is finite in at least some points
  const withTemp = tempPlottedData.filter(
    (pt) => typeof pt.airTemperatureC === "number" && Number.isFinite(pt.airTemperatureC)
  );
  if (!withTemp.length) {
    throw new Error(
      `No chart point has a finite airTemperatureC for room ${firstRoomId}. ` +
        "The airTemperatureC (blue) line would not render. Only setpointC might show."
    );
  }

  // Verify setpointC is finite in at least some points
  const withSetpoint = tempPlottedData.filter(
    (pt) => typeof pt.setpointC === "number" && Number.isFinite(pt.setpointC)
  );
  if (!withSetpoint.length) {
    throw new Error(
      `No chart point has a finite setpointC for room ${firstRoomId}. ` +
        "The setpoint (gray dashed) line would not render."
    );
  }
});

test("heating series: setpoint ramp lowers ideal-mode peak power", () => {
  const baseSetpoints = {
    day: 21,
    night: 18,
    dayStartHour: 7,
    nightStartHour: 22,
  };
  const stepped = runThermalSimulation(videoDemoHouse, {
    ...BASE_OPTIONS,
    setpoints: { ...baseSetpoints, setpointRampMinutes: 0 },
    heatingMode: "ideal",
  });
  const ramped = runThermalSimulation(videoDemoHouse, {
    ...BASE_OPTIONS,
    setpoints: { ...baseSetpoints, setpointRampMinutes: 60 },
    heatingMode: "ideal",
  });
  const peakFor = (result: ReturnType<typeof runThermalSimulation>) => {
    const room = Object.values(result.rooms).find((entry) => entry.timeline.length > 0);
    if (!room) {
      return 0;
    }
    return room.timeline.reduce((peak, pt) => Math.max(peak, pt.heatingPowerW), 0);
  };
  const peakSteppedW = peakFor(stepped);
  const peakRampedW = peakFor(ramped);
  if (!(peakSteppedW > peakRampedW * 1.15)) {
    throw new Error(
      `Expected stepped setpoint peak (${peakSteppedW.toFixed(0)} W) to exceed ramped peak (${peakRampedW.toFixed(0)} W) by >15%.`
    );
  }
});

test("temperature series: chart points for 'Тепловой пункт' are valid when it exists", () => {
  // Verifies the specific room mentioned in the bug report
  const result = runDemo();
  const utilityRoomEntry = Object.entries(result.rooms).find(([id]) =>
    id.toLowerCase().includes("utility")
  );
  if (!utilityRoomEntry) {
    // Not present in all configurations — skip
    return;
  }
  const [utilityRoomId, room] = utilityRoomEntry;
  if (!room.timeline.length) {
    throw new Error(`'Тепловой пункт' room ${utilityRoomId} has empty timeline.`);
  }
  const withTemp = room.timeline.filter((pt) => Number.isFinite(pt.temperatureC));
  if (!withTemp.length) {
    throw new Error(
      `'Тепловой пункт' room ${utilityRoomId}: no finite temperatureC values in timeline (${room.timeline.length} points).`
    );
  }
  const withSetpoint = room.timeline.filter((pt) => pt.setpointC !== undefined && Number.isFinite(pt.setpointC));
  if (!withSetpoint.length) {
    throw new Error(
      `'Тепловой пункт' room ${utilityRoomId}: no finite setpointC values in timeline after solver fix.`
    );
  }
});
