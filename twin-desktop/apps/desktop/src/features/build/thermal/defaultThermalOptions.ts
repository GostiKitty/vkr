import { DEFAULT_ENGINEERING_OPTIONS } from "../../../core/thermal/engineering/constants";
import type { ThermalSimulationOptions } from "../../../core/thermal/solver";

export const DEFAULT_THERMAL_OPTIONS: ThermalSimulationOptions = {
  duration: "24h",
  timestepMinutes: 10,
  outdoor: {
    baseC: -2,
    amplitudeC: 9,
    seasonalOffsetC: 0,
    phaseShiftHours: -3,
  },
  setpoints: {
    day: 21,
    night: 18,
    dayStartHour: 6,
    nightStartHour: 22,
    /** Линейный разгон уставки 1 ч — снижает пики «идеальной» мощности на графике. */
    setpointRampMinutes: 60,
  },
  internalGains: {
    dayGain_W_m2: 5,
    nightGain_W_m2: 1,
  },
  infiltrationACH: 0.5,
  infiltration: {
    infiltrationMode: "envelopeLeakage",
    infiltrationACH: 0.5,
    envelopeLeakage: {
      envelopeAirPermeabilityM3sM2At10Pa: 0.00005,
      windowAirPermeabilityM3sMAt10Pa: 0.0008,
      doorAirPermeabilityM3sMAt10Pa: 0.0012,
      pressureExponent: 0.67,
      referencePressurePa: 10,
    },
    pressureBased: {
      windSpeedMps: 4,
      windPressureCoefficient: 0.6,
      stackHeightM: 6,
      mechanicalPressurePa: 0,
    },
  },
  engineering: DEFAULT_ENGINEERING_OPTIONS,
};
