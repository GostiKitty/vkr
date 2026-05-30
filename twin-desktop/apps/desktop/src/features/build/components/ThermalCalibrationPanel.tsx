import React, { useCallback, useMemo, useState } from "react";
import type { BuildingModel } from "../../../entities/geometry/types";
import type { AdjacencyResult } from "../../../core/graph/adjacency";
import type { ThermalSimulationOptions } from "../../../core/thermal/solver";
import { runThermalSimulation } from "../../../core/thermal/solver";
import { calibrateParameters } from "../../../core/calibration/calibrator";
import { formatNumber } from "../../../shared/utils/format";
import {
  Line,
  LineChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import Tooltip from "../../../shared/ui/Tooltip";

const MONTH_LABELS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

interface ThermalCalibrationPanelProps {
  model: BuildingModel;
  adjacency: AdjacencyResult;
  options: ThermalSimulationOptions;
}

interface CalibrationState {
  params: Record<string, number>;
  rmse: number;
  mape: number;
  baseline: number[];
  calibrated: number[];
}

const PARAM_RANGES = {
  infiltrationMultiplier: { min: 0.4, max: 2.0 },
  internalGainMultiplier: { min: 0.5, max: 1.8 },
  setpointOffset: { min: -3, max: 3 },
} as const;
export const THERMAL_CALIBRATION_HELP_TEXT =
  "Калибровка нужна, чтобы приблизить расчетную модель к реальному зданию. Если известны месячные данные по потреблению тепла или энергии, система может скорректировать инфильтрацию, внутренние теплопоступления и уставки отопления.";

export function ThermalCalibrationPanel({ model, adjacency, options }: ThermalCalibrationPanelProps) {
  const [seriesText, setSeriesText] = useState("");
  const [observations, setObservations] = useState<number[] | null>(null);
  const [calibration, setCalibration] = useState<CalibrationState | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setSeriesText(value);
    const parsed = parseNumbers(value);
    setObservations(parsed && parsed.length === 12 ? parsed : null);
  };

  const handleCalibrate = useCallback(async () => {
    if (!observations || observations.length !== 12) {
      setError("Нужно 12 чисел для каждого месяца.");
      return;
    }
    if (!model.rooms.length || !model.walls.length) {
      setError("Создайте геометрию, чтобы выполнить калибровку.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const baseline = simulateMonthlySeries(model, adjacency, options, {
        infiltrationMultiplier: 1,
        internalGainMultiplier: 1,
        setpointOffset: 0,
      });

      const result = calibrateParameters({
        observations,
        iterations: 220,
        seed: 2403,
        parameters: [
          { name: "infiltrationMultiplier", ...PARAM_RANGES.infiltrationMultiplier },
          { name: "internalGainMultiplier", ...PARAM_RANGES.internalGainMultiplier },
          { name: "setpointOffset", ...PARAM_RANGES.setpointOffset },
        ],
        model: (params) =>
          simulateMonthlySeries(model, adjacency, options, {
            infiltrationMultiplier: params.infiltrationMultiplier ?? 1,
            internalGainMultiplier: params.internalGainMultiplier ?? 1,
            setpointOffset: params.setpointOffset ?? 0,
          }),
      });

      const calibrated = simulateMonthlySeries(model, adjacency, options, {
        infiltrationMultiplier: result.bestParameters.infiltrationMultiplier ?? 1,
        internalGainMultiplier: result.bestParameters.internalGainMultiplier ?? 1,
        setpointOffset: result.bestParameters.setpointOffset ?? 0,
      });

      setCalibration({
        params: result.bestParameters,
        rmse: result.rmse,
        mape: result.mape,
        baseline,
        calibrated,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось выполнить калибровку.";
      setError(message);
    } finally {
      setRunning(false);
    }
  }, [adjacency, model, observations, options]);

  const chartData = useMemo(() => {
    if (!observations || !calibration) {
      return MONTH_LABELS.map((label, index) => ({
        month: label,
        observed: observations?.[index] ?? null,
      }));
    }
    return MONTH_LABELS.map((label, index) => ({
      month: label,
      observed: observations[index],
      baseline: calibration.baseline[index],
      calibrated: calibration.calibrated[index],
    }));
  }, [calibration, observations]);

  return (
    <section className="ui-panel space-y-4 p-4">
      <header className="flex flex-col gap-1">
        <p className="ui-kicker">Калибровка</p>
        <h2 className="text-2xl font-semibold text-[color:var(--text-base)]">Калибровка модели по фактическому потреблению</h2>
        <p className="text-sm text-[color:var(--text-soft)]">
          {THERMAL_CALIBRATION_HELP_TEXT}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="space-y-3">
          <label className="text-xs font-semibold text-[color:var(--text-muted)]">
            Месячные данные, кВт·ч
            <textarea
              rows={6}
              placeholder="Например: 3200 2800 2500 ..."
              value={seriesText}
              onChange={handleTextChange}
              className="ui-field mt-1 w-full px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-[color:var(--text-soft)]">
            Поддерживаются разделители: пробел, запятая, новая строка. Необходимо ровно 12 значений.
          </p>
          <Tooltip
            className="w-full"
            title="Калибровка параметров"
            description="Ищет множители инфильтрации, внутренних теплопритоков и смещения сетпоинта, минимизируя RMSE/MAPE."
            details={["Ввод: энергопотребление за 12 месяцев (кВт·ч)", "Выход: RMSE, MAPE, новые множители"]}
            linkedFormulaIds={["calibration_rmse", "calibration_mape"]}
          >
            <button
              type="button"
              onClick={handleCalibrate}
              disabled={!observations || running}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-muted)] ${
                !observations || running ? "ui-control cursor-not-allowed border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]" : "ui-control ui-control-active bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
              }`}
            >
              {running ? "Подбираю..." : "Калибровать параметры"}
            </button>
          </Tooltip>
          {error && (
            <p className="rounded-[16px] border border-red-200/80 bg-red-50/78 px-3 py-2.5 text-xs text-red-700">{error}</p>
          )}
          {calibration && (
            <div className="ui-panel-muted grid gap-2 p-3 text-sm text-[color:var(--text-muted)]">
              <Stat label="RMSE, кВт·ч" value={formatNumber(calibration.rmse, { maximumFractionDigits: 1 })} />
              <Stat label="MAPE, %" value={formatNumber(calibration.mape, { maximumFractionDigits: 2 })} />
              <Stat
                label="Инфильтрация ×"
                value={formatNumber(calibration.params.infiltrationMultiplier, { maximumFractionDigits: 2 })}
              />
              <Stat
                label="Внутр. теплопоступления ×"
                value={formatNumber(calibration.params.internalGainMultiplier, { maximumFractionDigits: 2 })}
              />
              <Stat
                label="Смещение уставки, °C"
                value={formatNumber(calibration.params.setpointOffset, { maximumFractionDigits: 2 })}
              />
            </div>
          )}
        </div>

        <div className="ui-panel-muted p-4">
          <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Сравнение с наблюдениями</h3>
          <p className="text-xs text-[color:var(--text-soft)]">До и после калибровки</p>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 12, fill: "#475569" }} />
                <RechartsTooltip contentStyle={{ fontSize: "12px" }} />
                <Legend />
                <Line type="monotone" dataKey="observed" stroke="#0f172a" strokeWidth={2} dot />
                {calibration && (
                  <>
                    <Line type="monotone" dataKey="baseline" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                    <Line type="monotone" dataKey="calibrated" stroke="#f97316" strokeWidth={2} dot={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
            {!observations && (
              <p className="mt-2 text-xs text-[color:var(--text-soft)]">Вставьте 12 значений, чтобы увидеть график.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <p className="flex items-center justify-between">
    <span className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">{label}</span>
    <span className="font-semibold text-[color:var(--text-base)]">{value}</span>
  </p>
);

function parseNumbers(input: string): number[] | null {
  const tokens = input
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length) {
    return null;
  }
  const numbers = tokens.map((token) => Number(token));
  if (numbers.some((num) => Number.isNaN(num))) {
    return null;
  }
  return numbers;
}

function simulateMonthlySeries(
  model: BuildingModel,
  adjacency: AdjacencyResult,
  baseOptions: ThermalSimulationOptions,
  params: { infiltrationMultiplier: number; internalGainMultiplier: number; setpointOffset: number }
): number[] {
  const result: number[] = [];
  for (let month = 0; month < 12; month++) {
    const monthOptions = buildMonthlyOptions(baseOptions, month, params);
    const simulation = runThermalSimulation(model, monthOptions, adjacency);
    const durationDays = monthOptions.duration === "7d" ? 7 : 1;
    const dailyEnergy = simulation.summary.totalEnergyKWh / durationDays;
    result.push(dailyEnergy * DAYS_IN_MONTH[month]);
  }
  return result;
}

function buildMonthlyOptions(
  baseOptions: ThermalSimulationOptions,
  monthIndex: number,
  params: { infiltrationMultiplier: number; internalGainMultiplier: number; setpointOffset: number }
): ThermalSimulationOptions {
  const seasonAmplitude = Math.max(5, Math.abs(baseOptions.outdoor.seasonalOffsetC ?? 10));
  const monthPhase = ((monthIndex + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
  const monthlyShift = seasonAmplitude * Math.sin(monthPhase);

  return {
    ...baseOptions,
    outdoor: {
      ...baseOptions.outdoor,
      baseC: baseOptions.outdoor.baseC + monthlyShift,
      seasonalOffsetC: monthlyShift,
    },
    setpoints: {
      ...baseOptions.setpoints,
      day: baseOptions.setpoints.day + params.setpointOffset,
      night: baseOptions.setpoints.night + params.setpointOffset,
    },
    internalGains: {
      ...baseOptions.internalGains,
      dayGain_W_m2: Math.max(0, baseOptions.internalGains.dayGain_W_m2 * params.internalGainMultiplier),
      nightGain_W_m2: Math.max(0, baseOptions.internalGains.nightGain_W_m2 * params.internalGainMultiplier),
    },
    infiltrationACH: Math.max(0.05, (baseOptions.infiltrationACH ?? 0.5) * params.infiltrationMultiplier),
  };
}

export default ThermalCalibrationPanel;

