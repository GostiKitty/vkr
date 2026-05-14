import type { TransientScenario } from "./types";

export interface TransientScenarioOverrides {
  duration_s?: number;
  timeStep_s?: number;
  initialTemperature_C?: number;
  innerTemperature_C?: number;
  outerTemperature_C?: number;
  outerTemperatureEnd_C?: number;
  reducedInnerTemperature_C?: number;
  restoredInnerTemperature_C?: number;
}

interface TransientScenarioPreset {
  id: string;
  name: string;
  description: string;
  create: (overrides?: TransientScenarioOverrides) => TransientScenario;
}

const HOUR = 3600;

const PRESETS: TransientScenarioPreset[] = [
  {
    id: "cold_snap_24h",
    name: "Похолодание за 24 часа",
    description: "Наружная температура линейно падает, внутренняя сторона удерживается на уровне эксплуатации.",
    create: (overrides = {}) => {
      const duration_s = overrides.duration_s ?? 24 * HOUR;
      const outerStart = overrides.outerTemperature_C ?? -5;
      const outerEnd = overrides.outerTemperatureEnd_C ?? -25;
      const innerTemperature_C = overrides.innerTemperature_C ?? 20;
      return {
        id: "cold_snap_24h",
        name: "Похолодание за 24 часа",
        description: "Линейное падение наружной температуры от умеренного мороза к расчетному похолоданию.",
        duration_s,
        timeStep_s: overrides.timeStep_s ?? 300,
        initialCondition: {
          kind: "uniform",
          temperature_C: overrides.initialTemperature_C ?? innerTemperature_C,
        },
        innerBoundary: {
          kind: "convection",
          ambientTemperature_C: innerTemperature_C,
          alpha_W_m2K: 8.7,
        },
        outerBoundary: {
          kind: "convection",
          ambientTemperature_C: (time_s) => outerStart + ((outerEnd - outerStart) * time_s) / Math.max(duration_s, 1),
          alpha_W_m2K: 23,
        },
      };
    },
  },
  {
    id: "heating_shutdown_6h",
    name: "Отключение отопления на 6 часов",
    description: "Внутренний воздух быстро теряет уставку, наружный воздух остается отрицательным.",
    create: (overrides = {}) => ({
      id: "heating_shutdown_6h",
      name: "Отключение отопления на 6 часов",
      description: "Кратковременный отказ отопления с понижением внутренней температуры и остыванием поверхности.",
      duration_s: overrides.duration_s ?? 6 * HOUR,
      timeStep_s: overrides.timeStep_s ?? 180,
      initialCondition: {
        kind: "uniform",
        temperature_C: overrides.initialTemperature_C ?? 20,
      },
      innerBoundary: {
        kind: "convection",
        ambientTemperature_C: overrides.reducedInnerTemperature_C ?? 15,
        alpha_W_m2K: 6.5,
      },
      outerBoundary: {
        kind: "convection",
        ambientTemperature_C: overrides.outerTemperature_C ?? -18,
        alpha_W_m2K: 23,
      },
    }),
  },
  {
    id: "night_setback",
    name: "Ночной режим эксплуатации",
    description: "Внутренняя уставка ночью снижается и затем возвращается к дневному уровню.",
    create: (overrides = {}) => {
      const duration_s = overrides.duration_s ?? 24 * HOUR;
      const warm = overrides.innerTemperature_C ?? 22;
      const cool = overrides.reducedInnerTemperature_C ?? 18;
      return {
        id: "night_setback",
        name: "Ночной режим эксплуатации",
        description: "Сценарий пониженной ночной уставки и утреннего восстановления температуры.",
        duration_s,
        timeStep_s: overrides.timeStep_s ?? 300,
        initialCondition: {
          kind: "uniform",
          temperature_C: overrides.initialTemperature_C ?? warm,
        },
        innerBoundary: {
          kind: "convection",
          ambientTemperature_C: (time_s) => {
            const hour = (time_s / HOUR) % 24;
            return hour >= 23 || hour < 6 ? cool : warm;
          },
          alpha_W_m2K: 8.7,
        },
        outerBoundary: {
          kind: "convection",
          ambientTemperature_C: overrides.outerTemperature_C ?? -12,
          alpha_W_m2K: 23,
        },
      };
    },
  },
  {
    id: "heating_recovery",
    name: "Восстановление после включения отопления",
    description: "Конструкция стартует из холодного состояния, затем внутренняя уставка повышается.",
    create: (overrides = {}) => {
      const restoredTemperature_C = overrides.restoredInnerTemperature_C ?? 22;
      const startTemperature_C = overrides.initialTemperature_C ?? 16;
      return {
        id: "heating_recovery",
        name: "Восстановление после включения отопления",
        description: "Оценка прогрева внутренней поверхности после возврата отопления в нормальный режим.",
        duration_s: overrides.duration_s ?? 12 * HOUR,
        timeStep_s: overrides.timeStep_s ?? 180,
        initialCondition: {
          kind: "uniform",
          temperature_C: startTemperature_C,
        },
        innerBoundary: {
          kind: "convection",
          ambientTemperature_C: (time_s) => (time_s < HOUR ? startTemperature_C : restoredTemperature_C),
          alpha_W_m2K: 9.2,
        },
        outerBoundary: {
          kind: "convection",
          ambientTemperature_C: overrides.outerTemperature_C ?? -14,
          alpha_W_m2K: 23,
        },
      };
    },
  },
];

export function getTransientScenarioPresets(): Array<{ id: string; name: string; description: string }> {
  return PRESETS.map((preset) => ({ id: preset.id, name: preset.name, description: preset.description }));
}

export function buildTransientScenarioPreset(
  presetId: string,
  overrides?: TransientScenarioOverrides
): TransientScenario {
  const preset = PRESETS.find((entry) => entry.id === presetId) ?? PRESETS[0];
  return preset.create(overrides);
}
