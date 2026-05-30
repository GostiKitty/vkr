import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Label,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ThermalSimulationOptions } from "../../../core/thermal/solver";
import {
  THERMAL_MONTE_CARLO_TARGET_METRICS,
  getThermalMonteCarloTargetMetricDefinition,
  getThermalMonteCarloTargetMetricValues,
  type ThermalMonteCarloResult,
  type ThermalMonteCarloTargetMetricDefinition,
  type ThermalMonteCarloTargetMetricId,
} from "../../../core/uncertainty/thermalMonteCarlo";
import { EmptyState, MetricInfoTooltip, SelectDropdown } from "../../../shared/ui";
import { formatNumber } from "../../../shared/utils/format";

type ScatterParameterId =
  | "infiltration"
  | "outdoor"
  | "daySetpoint"
  | "nightSetpoint"
  | "internalGains"
  | "occupancy";

interface ScatterParameterOption {
  id: ScatterParameterId;
  label: string;
  unit: string;
}

const PARAMETER_OPTIONS: ScatterParameterOption[] = [
  { id: "infiltration", label: "Инфильтрация", unit: "1/ч" },
  { id: "outdoor", label: "Наружная температура", unit: "°C" },
  { id: "daySetpoint", label: "Дневная уставка", unit: "°C" },
  { id: "nightSetpoint", label: "Ночная уставка", unit: "°C" },
  { id: "internalGains", label: "Внутренние теплопоступления", unit: "Вт/м²" },
  { id: "occupancy", label: "Коэффициент занятости", unit: "×" },
];

interface MonteCarloScatterChartProps {
  result: ThermalMonteCarloResult;
  baseOptions: ThermalSimulationOptions;
  targetMetric: ThermalMonteCarloTargetMetricId;
  onTargetMetricChange: (metric: ThermalMonteCarloTargetMetricId) => void;
}

export function MonteCarloScatterChart({
  result,
  baseOptions,
  targetMetric,
  onTargetMetricChange,
}: MonteCarloScatterChartProps) {
  const [parameter, setParameter] = useState<ScatterParameterId>("infiltration");

  const parameterOption = PARAMETER_OPTIONS.find((item) => item.id === parameter) ?? PARAMETER_OPTIONS[0];
  const targetMetricOption = getThermalMonteCarloTargetMetricDefinition(targetMetric);
  const targetMetricValues = useMemo(
    () => getThermalMonteCarloTargetMetricValues(result, targetMetric),
    [result, targetMetric]
  );
  const hasMetricData = useMemo(
    () => targetMetricValues.some((value) => Number.isFinite(value)),
    [targetMetricValues]
  );

  const data = useMemo(
    () =>
      result.samples
        .map((sample, index) => ({
          x: resolveParameterValue(parameter, sample, baseOptions),
          y: targetMetricValues[index] ?? Number.NaN,
        }))
        .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y)),
    [baseOptions, parameter, result.samples, targetMetricValues]
  );

  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-[color:var(--text-base)]">
              {`Точечная диаграмма: ${parameterOption.label} → ${targetMetricOption.shortLabel}`}
            </p>
            <MetricInfoTooltip
              title="Точечная диаграмма Monte Carlo"
              meaning="Показывает, как изменение входного параметра связано с выбранной целевой метрикой по сценариям."
              formula={`(x_i, y_i) = (input_i, ${targetMetric})`}
              inputs={["samples", targetMetricOption.tooltipSeriesKey]}
              calculatedIn={`src/core/uncertainty/thermalMonteCarlo.ts → samples + ${targetMetricOption.tooltipSeriesKey}`}
            />
          </div>
        </div>

        <div className="grid w-full gap-3 md:grid-cols-2 md:min-w-[28rem]">
          <SelectDropdown
            label="Фактор"
            value={parameter}
            options={PARAMETER_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
            onChange={setParameter}
          />
          <SelectDropdown
            label="Целевая метрика"
            value={targetMetric}
            options={THERMAL_MONTE_CARLO_TARGET_METRICS.map((option) => ({ value: option.id, label: option.label }))}
            onChange={onTargetMetricChange}
          />
        </div>
      </div>

      <div className="h-80 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3">
        {hasMetricData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name={parameterOption.label}
                tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                tickFormatter={(value) =>
                  formatNumber(Number(value), { maximumFractionDigits: parameter === "infiltration" ? 2 : 1 })
                }
              >
                <Label
                  value={`${parameterOption.label}, ${parameterOption.unit}`}
                  position="insideBottom"
                  offset={-4}
                  fill="var(--text-soft)"
                  fontSize={11}
                />
              </XAxis>
              <YAxis
                type="number"
                dataKey="y"
                name={targetMetricOption.shortLabel}
                tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                tickFormatter={(value) => formatNumber(Number(value), { maximumFractionDigits: targetMetricOption.decimals })}
                width={84}
              >
                <Label
                  value={targetMetricOption.axisLabel}
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 }}
                />
              </YAxis>
              <Tooltip
                cursor={{ strokeDasharray: "4 4" }}
                formatter={(value: number, name: string) => {
                  if (name === "x") {
                    return [
                      `${formatNumber(value, { maximumFractionDigits: parameter === "infiltration" ? 2 : 1 })} ${parameterOption.unit}`,
                      parameterOption.label,
                    ];
                  }
                  return [formatTargetMetricValue(value, targetMetricOption), targetMetricOption.shortLabel];
                }}
                labelFormatter={() => ""}
                contentStyle={{
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Scatter data={data} fill="var(--accent-base)" fillOpacity={0.75} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center">
            <EmptyState title="Нет данных для графика" message={targetMetricOption.emptyStateMessage} tone="warning" />
          </div>
        )}
      </div>
    </section>
  );
}

function resolveParameterValue(
  parameter: ScatterParameterId,
  sample: ThermalMonteCarloResult["samples"][number],
  baseOptions: ThermalSimulationOptions
): number {
  switch (parameter) {
    case "infiltration":
      return Math.max(0.02, (baseOptions.infiltrationACH ?? 0.5) * sample.infiltrationMultiplier);
    case "outdoor":
      return baseOptions.outdoor.baseC + sample.outdoorBiasC;
    case "daySetpoint":
      return baseOptions.setpoints.day + sample.setpointOffsetC;
    case "nightSetpoint":
      return baseOptions.setpoints.night + sample.setpointOffsetC;
    case "internalGains":
      return Math.max(0, (baseOptions.internalGains?.dayGain_W_m2 ?? 0) * sample.internalGainMultiplier);
    case "occupancy":
      return Math.max(0, (baseOptions.occupancy?.dayFraction ?? 1) * sample.occupancyMultiplier);
    default:
      return 0;
  }
}

function formatTargetMetricValue(value: number, targetMetricOption: ThermalMonteCarloTargetMetricDefinition): string {
  return `${formatNumber(value, { maximumFractionDigits: targetMetricOption.decimals })} ${targetMetricOption.unit}`;
}

export default MonteCarloScatterChart;
