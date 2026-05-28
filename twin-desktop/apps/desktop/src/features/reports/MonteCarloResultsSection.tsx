import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BuildingModel } from "../../entities/geometry/types";
import type { ThermalSimulationOptions, ThermalSimulationResult } from "../../core/thermal/solver";
import {
  buildSensitivityFactors,
  getThermalMonteCarloTargetMetricDefinition,
  getThermalMonteCarloTargetMetricValues,
  THERMAL_MONTE_CARLO_SENSITIVITY_METHOD_LABEL_RU,
  THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C,
  type ThermalMonteCarloTargetMetricId,
  type DistributionSummary,
  type ThermalMonteCarloResult,
  type ThermalMonteCarloSensitivityFactor,
} from "../../core/uncertainty/thermalMonteCarlo";
import { Badge, EmptyState, EngineeringCallout, MetricInfoTooltip } from "../../shared/ui";
import { formatEnergy, formatNumber, formatPercentage } from "../../shared/utils/format";
import { getRoomDisplayName } from "../../shared/utils/roomNames";
import { MonteCarloChart } from "./charts/MonteCarloChart";
import { MonteCarloScatterChart } from "./charts/MonteCarloScatterChart";
import { resultsMetricInfo, type MetricInfoDefinition } from "./resultsMetricInfo";

interface MonteCarloResultsSectionProps {
  baseResult: ThermalSimulationResult | null;
  baseOptions: ThermalSimulationOptions;
  buildingModel: BuildingModel;
  climateLabel: string | null;
  monteCarloResult: ThermalMonteCarloResult | null;
  onEditUncertainty?: () => void;
}

type RiskStatus = "низкий" | "средний" | "высокий";
type MetricTone = "success" | "info" | "warning" | "accent";

interface RiskRow {
  id: string;
  label: string;
  probability: number | null;
  status: RiskStatus;
}

interface RoomRiskRow {
  roomId: string;
  roomName: string;
  temperatureP50C: number;
  minimumTemperatureP10C: number;
  marginTo20C: number;
  underheatingRisk: number;
  status: RiskStatus;
}

interface UncertaintyMetricRow {
  id: string;
  label: string;
  info: MetricInfoDefinition;
  unit: string;
  decimals: number;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  spread: number | null;
  relativeSpreadPercent: number | null;
  cvPercent: number | null;
}

interface MonteCarloPresentation {
  sensitivity: ThermalMonteCarloSensitivityFactor[];
  mainFactor: ThermalMonteCarloSensitivityFactor | null;
  riskRows: RiskRow[];
  roomRows: RoomRiskRow[];
  topRiskRooms: RoomRiskRow[];
  riskiestRoom: RoomRiskRow | null;
  uncertaintyRows: UncertaintyMetricRow[];
  underheatingRisk: number | null;
  stabilityIndexPercent: number | null;
  peakExceedanceProbability: number | null;
  energyGrowthProbability: number | null;
  conclusionText: string;
}

const ROOM_RISK_EMPTY_TEXT =
  "Риск по помещениям появится после накопления агрегатов в результате Monte Carlo.";
const DEFAULT_PEAK_MARGIN_FACTOR = 1.2;
const DEFAULT_ENERGY_GROWTH_FACTOR = 1.2;

export function MonteCarloResultsSection({
  baseResult,
  baseOptions,
  buildingModel,
  climateLabel,
  monteCarloResult,
  onEditUncertainty,
}: MonteCarloResultsSectionProps) {
  const roomNameMap = useMemo(() => {
    const map = new Map<string, string>();
    buildingModel.rooms.forEach((room, index) => {
      map.set(room.id, getRoomDisplayName(room, index));
    });
    return map;
  }, [buildingModel.rooms]);

  const defaultPeakThresholdKW = useMemo(() => {
    if (!baseResult) {
      return null;
    }
    return roundValue(baseResult.summary.peakLoadKW * DEFAULT_PEAK_MARGIN_FACTOR, 2);
  }, [baseResult]);

  const [peakThresholdInput, setPeakThresholdInput] = useState("");
  const [selectedTargetMetric, setSelectedTargetMetric] = useState<ThermalMonteCarloTargetMetricId>("totalEnergyKWh");

  useEffect(() => {
    setPeakThresholdInput(formatInputNumber(defaultPeakThresholdKW));
  }, [defaultPeakThresholdKW]);

  const peakThresholdKW = useMemo(() => parsePositiveNumber(peakThresholdInput), [peakThresholdInput]);
  const selectedTargetMetricDefinition = useMemo(
    () => getThermalMonteCarloTargetMetricDefinition(selectedTargetMetric),
    [selectedTargetMetric]
  );
  const selectedTargetMetricValues = useMemo(
    () =>
      monteCarloResult ? getThermalMonteCarloTargetMetricValues(monteCarloResult, selectedTargetMetric) : [],
    [monteCarloResult, selectedTargetMetric]
  );
  const selectedTargetMetricHasData = useMemo(
    () => selectedTargetMetricValues.some((value) => Number.isFinite(value)),
    [selectedTargetMetricValues]
  );

  const presentation = useMemo<MonteCarloPresentation | null>(() => {
    if (!monteCarloResult || !baseResult) {
      return null;
    }

    const sensitivity = buildSensitivityFactors(
      monteCarloResult.samples,
      selectedTargetMetricValues,
      baseOptions,
      selectedTargetMetric
    ).sort((left, right) => right.valuePercent - left.valuePercent);
    const underheatingRisk =
      monteCarloResult.underheatingBelow20CProbability ??
      probabilityOf(
        monteCarloResult.scenarioSeries.minimumIndoorTemperatureC,
        (value) => value < THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C
      );
    const stabilityIndexPercent = underheatingRisk === null ? null : (1 - underheatingRisk) * 100;
    const peakExceedanceProbability =
      peakThresholdKW === null
        ? null
        : probabilityOf(monteCarloResult.scenarioSeries.peakLoadKW, (value) => value > peakThresholdKW);
    const energyGrowthProbability = probabilityOf(
      monteCarloResult.scenarioSeries.totalEnergyKWh,
      (value) => value > baseResult.summary.totalEnergyKWh * DEFAULT_ENERGY_GROWTH_FACTOR
    );
    const riskRows = buildRiskRows(baseResult, monteCarloResult, peakThresholdKW);
    const roomRows = [...(monteCarloResult.roomRiskSummary ?? [])]
      .map((room) => ({
        roomId: room.roomId,
        roomName: roomNameMap.get(room.roomId) ?? room.roomId,
        temperatureP50C: room.temperatureP50C,
        minimumTemperatureP10C: room.minimumTemperatureP10C,
        marginTo20C: room.minimumTemperatureP10C - THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C,
        underheatingRisk: room.underheatingRisk,
        status: resolveRiskStatus(room.underheatingRisk),
      }))
      .sort(
        (left, right) =>
          right.underheatingRisk - left.underheatingRisk ||
          left.minimumTemperatureP10C - right.minimumTemperatureP10C ||
          left.roomName.localeCompare(right.roomName)
      );

    return {
      sensitivity,
      mainFactor: sensitivity[0] ?? null,
      riskRows,
      roomRows,
      topRiskRooms: roomRows.slice(0, 3),
      riskiestRoom: roomRows[0] ?? null,
      uncertaintyRows: [
        buildUncertaintyMetricRow("energy", "Энергия отопления", monteCarloResult.totalEnergy, "кВт·ч", 1, resultsMetricInfo.energy),
        buildUncertaintyMetricRow("peak", "Пиковая нагрузка", monteCarloResult.peakLoad, "кВт", 2, resultsMetricInfo.peakLoad),
        buildUncertaintyMetricRow("discomfort", "Дискомфорт", monteCarloResult.discomfort, "ч", 1, resultsMetricInfo.discomfort),
      ],
      underheatingRisk,
      stabilityIndexPercent,
      peakExceedanceProbability,
      energyGrowthProbability,
      conclusionText: buildConclusion({
        climateLabel,
        mainFactorLabel: sensitivity[0]?.label ?? null,
        underheatingRisk: underheatingRisk ?? 0,
      }),
    };
  }, [
    baseOptions,
    baseResult,
    climateLabel,
    monteCarloResult,
    peakThresholdKW,
    roomNameMap,
    selectedTargetMetric,
    selectedTargetMetricValues,
  ]);

  if (!monteCarloResult) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="Вероятностный анализ ещё не выполнен"
          message="Перейдите в раздел «Вероятностный анализ» и запустите Monte Carlo поверх нестационарного RC-расчёта."
        />
        {onEditUncertainty ? (
          <button type="button" onClick={onEditUncertainty} className="ui-btn-primary px-4 py-2 text-sm">
            Перейти к вероятностному анализу
          </button>
        ) : null}
      </div>
    );
  }

  if (!baseResult || !presentation) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="Нет базового RC-расчёта"
          message="Сначала выполните базовый RC-расчёт, чтобы сравнить его с распределением Monte Carlo."
          tone="warning"
        />
      </div>
    );
  }

  return (
    <section className="space-y-5" data-testid="monte-carlo-results-section">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="ui-soft-kicker">Вероятностный анализ</p>
          <h3 className="ui-heading-panel">Monte Carlo поверх нестационарного RC-расчёта</h3>
          <p className="text-sm text-[color:var(--text-muted)]">
            Каждый сценарий повторно запускает тот же временной RC-расчёт с вариацией входных параметров. Ниже показаны
            диапазоны P10/P50/P90, гистограмму, чувствительность, риск по помещениям и дополнительные метрики
            неопределённости.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{formatNumber(monteCarloResult.runs, { maximumFractionDigits: 0 })} сценариев</Badge>
          {climateLabel ? <Badge tone="info">{climateLabel}</Badge> : null}
          <Badge tone={riskBadgeTone(resolveRiskStatus(presentation.underheatingRisk ?? 0))}>
            Риск недогрева {formatPercentage(presentation.underheatingRisk)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Базовый расчёт" value={formatEnergy(baseResult.summary.totalEnergyKWh, "кВт·ч")} info={resultsMetricInfo.energy} />
        <KpiCard label="P50" value={formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч")} info={resultsMetricInfo.monteCarloP50} />
        <KpiCard label="P90" value={formatEnergy(monteCarloResult.totalEnergy.p90, "кВт·ч")} info={resultsMetricInfo.monteCarloP90} />
        <KpiCard
          label="Риск недогрева"
          value={formatPercentage(presentation.underheatingRisk)}
          info={resultsMetricInfo.underheatingRisk}
        />
        <KpiCard
          label="Главный фактор"
          value={presentation.mainFactor?.label ?? "—"}
          hint={
            selectedTargetMetricHasData
              ? `По метрике «${selectedTargetMetricDefinition.shortLabel}»`
              : selectedTargetMetricDefinition.emptyStateMessage
          }
          info={resultsMetricInfo.sensitivity}
        />
      </div>

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[color:var(--text-base)]">Инженерные метрики неопределённости</p>
              <MetricInfoTooltip {...resultsMetricInfo.coefficientOfVariation} />
            </div>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Производные метрики считаются по уже сохранённым сводкам распределения и сценариям без повторного расчёта
              и без временного веерного графика.
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3 xl:min-w-[280px]">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[color:var(--text-base)]">
                Порог пиковой мощности, кВт
              </p>
              <MetricInfoTooltip {...resultsMetricInfo.exceedanceProbability} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.1"
                value={peakThresholdInput}
                onChange={(event) => setPeakThresholdInput(event.target.value)}
                className="ui-field min-w-0 flex-1 px-3 py-2 text-sm shadow-inner"
              />
              <button
                type="button"
                className="rounded-full border border-[color:var(--border-soft)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]"
                onClick={() => setPeakThresholdInput(formatInputNumber(defaultPeakThresholdKW))}
              >
                1,2× база
              </button>
            </div>
            <p className="mt-2 text-xs text-[color:var(--text-soft)]">
              По умолчанию используется 120% от базовой пиковой нагрузки. Если поле пустое, вероятность превышения не вычисляется.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SummaryStripItem
            label="P50 энергии"
            value={formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч")}
            hint={`Среднее ${formatEnergy(monteCarloResult.totalEnergy.mean, "кВт·ч")}`}
            info={resultsMetricInfo.monteCarloP50}
          />
          <SummaryStripItem
            label="Диапазон P10–P90"
            value={formatRangeValue(monteCarloResult.totalEnergy.p10, monteCarloResult.totalEnergy.p90, "кВт·ч", 1)}
            hint={`Ширина ${formatSpreadValue(monteCarloResult.totalEnergy, "кВт·ч", 1)}`}
            info={resultsMetricInfo.probabilisticSpread}
          />
          <SummaryStripItem
            label="CV энергии"
            value={formatPercentValue(monteCarloResult.totalEnergy.coefficientOfVariationPercent)}
            hint={describeCv(monteCarloResult.totalEnergy.coefficientOfVariationPercent).label}
            info={resultsMetricInfo.coefficientOfVariation}
          />
          <SummaryStripItem
            label="Устойчивость режима"
            value={formatPercentValue(presentation.stabilityIndexPercent)}
            hint={describeStability(presentation.stabilityIndexPercent).label}
            info={resultsMetricInfo.stabilityIndex}
          />
          <SummaryStripItem
            label="Риск превышения пика"
            value={formatPercentage(presentation.peakExceedanceProbability)}
            hint={peakThresholdKW === null ? "Введите порог Q_lim" : `Q_lim = ${formatNumber(peakThresholdKW, { maximumFractionDigits: 2 })} кВт`}
            info={resultsMetricInfo.exceedanceProbability}
          />
          <SummaryStripItem
            label="Риск роста энергии"
            value={formatPercentage(presentation.energyGrowthProbability)}
            hint={`Порог 1.2 × E_base = ${formatEnergy(baseResult.summary.totalEnergyKWh * DEFAULT_ENERGY_GROWTH_FACTOR, "кВт·ч")}`}
            info={resultsMetricInfo.energyGrowthRisk}
          />
          <SummaryStripItem
            label="Самое рискованное помещение"
            value={presentation.riskiestRoom?.roomName ?? "—"}
            hint={
              presentation.riskiestRoom
                ? `${formatPercentage(presentation.riskiestRoom.underheatingRisk)} · запас ${formatSignedTemperature(
                    presentation.riskiestRoom.marginTo20C
                  )}`
                : "Нет риска по помещениям"
            }
            info={resultsMetricInfo.roomMargin}
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-sm text-[color:var(--text-soft)]">
                <th className="px-4 py-2 font-semibold">Показатель</th>
                <th className="px-4 py-2 font-semibold">P50</th>
                <th className="px-4 py-2 font-semibold">P10–P90</th>
                <th className="px-4 py-2 font-semibold">Ширина</th>
                <th className="px-4 py-2 font-semibold">CV</th>
                <th className="px-4 py-2 font-semibold">Интерпретация</th>
              </tr>
            </thead>
            <tbody>
              {presentation.uncertaintyRows.map((row) => {
                const cvInfo = describeCv(row.cvPercent);
                return (
                  <tr key={row.id} className="border-t border-[color:var(--border-soft)]">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5 font-medium text-[color:var(--text-base)]">
                        <span>{row.label}</span>
                        <MetricInfoTooltip {...row.info} />
                      </div>
                    </td>
                    <td className="px-4 py-2">{formatMetricValue(row.p50, row.unit, row.decimals)}</td>
                    <td className="px-4 py-2">{formatRangeValue(row.p10, row.p90, row.unit, row.decimals)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span>{formatMetricValue(row.spread, row.unit, row.decimals)}</span>
                        <MetricInfoTooltip {...resultsMetricInfo.probabilisticSpread} />
                      </div>
                      <div className="text-xs text-[color:var(--text-soft)]">{formatPercentValue(row.relativeSpreadPercent)}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span>{formatPercentValue(row.cvPercent)}</span>
                        <MetricInfoTooltip {...resultsMetricInfo.coefficientOfVariation} />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge tone={cvInfo.tone}>{cvInfo.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Базовый расчёт и квантили P10 / P50 / P90</p>
          <MetricInfoTooltip
            title="Квантили Monte Carlo"
            meaning="Сравнение базового детерминированного сценария с распределением вероятностного результата."
            formula="Base vs quantile(metric, q)"
            inputs={["baseResult.summary", "scenarioSeries"]}
            calculatedIn="src/core/uncertainty/thermalMonteCarlo.ts"
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-sm text-[color:var(--text-soft)]">
                <th className="px-4 py-2 font-semibold">Показатель</th>
                <th className="px-4 py-2 font-semibold">База</th>
                <th className="px-4 py-2 font-semibold">P10</th>
                <th className="px-4 py-2 font-semibold">P50</th>
                <th className="px-4 py-2 font-semibold">P90</th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow
                label="totalEnergyKWh"
                info={resultsMetricInfo.energy}
                baseline={formatEnergy(baseResult.summary.totalEnergyKWh, "кВт·ч")}
                p10={formatEnergy(monteCarloResult.totalEnergy.p10, "кВт·ч")}
                p50={formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч")}
                p90={formatEnergy(monteCarloResult.totalEnergy.p90, "кВт·ч")}
              />
              <ComparisonRow
                label="peakLoadKW"
                info={resultsMetricInfo.peakLoad}
                baseline={`${formatNumber(baseResult.summary.peakLoadKW, { maximumFractionDigits: 2 })} кВт`}
                p10={`${formatNumber(monteCarloResult.peakLoad.p10, { maximumFractionDigits: 2 })} кВт`}
                p50={`${formatNumber(monteCarloResult.peakLoad.p50, { maximumFractionDigits: 2 })} кВт`}
                p90={`${formatNumber(monteCarloResult.peakLoad.p90, { maximumFractionDigits: 2 })} кВт`}
              />
              <ComparisonRow
                label="discomfortHours"
                info={resultsMetricInfo.discomfort}
                baseline={`${formatNumber(baseResult.summary.discomfortHours, { maximumFractionDigits: 1 })} ч`}
                p10={`${formatNumber(monteCarloResult.discomfort.p10, { maximumFractionDigits: 1 })} ч`}
                p50={`${formatNumber(monteCarloResult.discomfort.p50, { maximumFractionDigits: 1 })} ч`}
                p90={`${formatNumber(monteCarloResult.discomfort.p90, { maximumFractionDigits: 1 })} ч`}
              />
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <MonteCarloChart result={monteCarloResult} baselineEnergyKWh={baseResult.summary.totalEnergyKWh} />
        <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <p className="text-sm font-semibold text-[color:var(--text-base)]">Чувствительность факторов</p>
            <MetricInfoTooltip {...resultsMetricInfo.sensitivity} />
          </div>
          <p className="mb-3 text-sm text-[color:var(--text-muted)]">
            Оценка влияния факторов на выбранную целевую метрику.
          </p>
          <p className="mb-3 text-xs text-[color:var(--text-soft)]">{THERMAL_MONTE_CARLO_SENSITIVITY_METHOD_LABEL_RU}</p>
          {presentation.sensitivity.length ? (
            <>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={presentation.sensitivity} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                      tickFormatter={(value) => `${Math.round(Number(value))}%`}
                    >
                      <Label
                        value={`Влияние на ${selectedTargetMetricDefinition.shortLabel}, %`}
                        position="insideBottom"
                        offset={-2}
                        fill="var(--text-soft)"
                        fontSize={11}
                      />
                    </XAxis>
                    <YAxis type="category" dataKey="label" width={148} tick={{ fill: "var(--text-soft)", fontSize: 11 }}>
                      <Label
                        value="Факторы"
                        angle={-90}
                        position="insideLeft"
                        style={{ textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 }}
                      />
                    </YAxis>
                    <Tooltip
                      formatter={(value: number) => [`${formatNumber(value, { maximumFractionDigits: 1 })}%`, "Влияние"]}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="valuePercent" radius={[0, 8, 8, 0]}>
                      {presentation.sensitivity.map((entry, index) => (
                        <Cell key={`${entry.id}-${index}`} fill={index === 0 ? "var(--accent-base)" : "var(--chart-line-muted)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-sm text-[color:var(--text-muted)]">
                Главный фактор: <span className="font-semibold text-[color:var(--text-base)]">{presentation.mainFactor?.label ?? "не определён"}</span>
              </p>
            </>
          ) : (
            <EmptyState
              message={
                selectedTargetMetricHasData
                  ? "Для текущего набора сценариев чувствительность пока не рассчитана."
                  : selectedTargetMetricDefinition.emptyStateMessage
              }
              tone={selectedTargetMetricHasData ? "default" : "warning"}
            />
          )}
        </section>
      </div>

      <MonteCarloScatterChart
        result={monteCarloResult}
        baseOptions={baseOptions}
        targetMetric={selectedTargetMetric}
        onTargetMetricChange={setSelectedTargetMetric}
      />

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Риск по помещениям</p>
          <MetricInfoTooltip
            title="Риск по помещениям"
            meaning="Показывает медианную температуру, холодный хвост и вероятность недогрева по помещениям."
            formula="Risk_room = count(T_min,room < threshold) / N"
            inputs={["roomRiskSummary.temperatureP50C", "roomRiskSummary.minimumTemperatureP10C", "roomRiskSummary.underheatingRisk"]}
            calculatedIn="src/core/uncertainty/thermalMonteCarlo.ts → roomRiskSummary"
          />
        </div>
        {presentation.topRiskRooms.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {presentation.topRiskRooms.map((room, index) => (
              <div
                key={`${room.roomId}-${index}`}
                className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs text-[color:var(--text-muted)]"
              >
                <span className="font-semibold text-[color:var(--text-base)]">{index + 1}. {room.roomName}</span>
                <span> · риск {formatPercentage(room.underheatingRisk)}</span>
                <span> · запас {formatSignedTemperature(room.marginTo20C)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {presentation.roomRows.length ? (
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-sm text-[color:var(--text-soft)]">
                  <th className="px-4 py-2 font-semibold">Помещение</th>
                  <th className="px-4 py-2 font-semibold">temperatureP50C</th>
                  <th className="px-4 py-2 font-semibold">minimumTemperatureP10C</th>
                  <th className="px-4 py-2 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <span>Margin_room</span>
                      <MetricInfoTooltip {...resultsMetricInfo.roomMargin} />
                    </span>
                  </th>
                  <th className="px-4 py-2 font-semibold">underheatingRisk</th>
                  <th className="px-4 py-2 font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody>
                {presentation.roomRows.map((room) => (
                  <tr key={room.roomId} className="border-t border-[color:var(--border-soft)]">
                    <td className="px-4 py-2 font-medium text-[color:var(--text-base)]">{room.roomName}</td>
                    <td className="px-4 py-2">{formatNumber(room.temperatureP50C, { maximumFractionDigits: 1 })} °C</td>
                    <td className="px-4 py-2">{formatNumber(room.minimumTemperatureP10C, { maximumFractionDigits: 1 })} °C</td>
                    <td className="px-4 py-2">{formatSignedTemperature(room.marginTo20C)}</td>
                    <td className="px-4 py-2">{formatPercentage(room.underheatingRisk)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={riskBadgeTone(room.status)}>{formatRiskStatus(room.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message={ROOM_RISK_EMPTY_TEXT} />
        )}
      </section>

      <section className="rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-4">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Веерный график по времени</p>
          <MetricInfoTooltip
            title="Веерный график по времени"
            meaning="Показывает временные P10/P50/P90 для температуры или мощности по каждому шагу времени."
            formula="percentilesByTime[t] = quantile(metric_scenario(t), q)"
            inputs={["trajectories per scenario", "или percentilesByTime"]}
            calculatedIn="Пока не сохраняется в ThermalMonteCarloResult"
            notes="Станет доступен после сохранения percentilesByTime в Monte Carlo result."
          />
        </div>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          Веерный график по времени появится после сохранения квантилей по шагам в результате Monte Carlo.
        </p>
      </section>

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Риски сценариев</p>
          <MetricInfoTooltip {...resultsMetricInfo.underheatingRisk} />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-sm text-[color:var(--text-soft)]">
                <th className="px-4 py-2 font-semibold">Риск</th>
                <th className="px-4 py-2 font-semibold">Вероятность</th>
                <th className="px-4 py-2 font-semibold">Уровень</th>
              </tr>
            </thead>
            <tbody>
              {presentation.riskRows.map((row) => (
                <tr key={row.id} className="border-t border-[color:var(--border-soft)]">
                  <td className="px-4 py-2 font-medium text-[color:var(--text-base)]">{row.label}</td>
                  <td className="px-4 py-2">{formatPercentage(row.probability)}</td>
                  <td className="px-4 py-2">
                    <Badge tone={riskBadgeTone(row.status)}>{formatRiskStatus(row.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  info,
}: {
  label: string;
  value: string;
  hint?: string;
  info: MetricInfoDefinition;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[color:var(--text-muted)]">{label}</p>
        <MetricInfoTooltip {...info} />
      </div>
      <p className="mt-1 text-lg font-semibold text-[color:var(--text-base)]">{value}</p>
      {hint ? <p className="text-xs text-[color:var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

function SummaryStripItem({
  label,
  value,
  hint,
  info,
}: {
  label: string;
  value: string;
  hint?: string;
  info: MetricInfoDefinition;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[color:var(--text-muted)]">{label}</p>
        <MetricInfoTooltip {...info} />
      </div>
      <p className="mt-1 text-base font-semibold text-[color:var(--text-base)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[color:var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

function ComparisonRow({
  label,
  info,
  baseline,
  p10,
  p50,
  p90,
}: {
  label: string;
  info: MetricInfoDefinition;
  baseline: string;
  p10: string;
  p50: string;
  p90: string;
}) {
  return (
    <tr className="border-t border-[color:var(--border-soft)]">
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5 font-medium text-[color:var(--text-base)]">
          <span>{label}</span>
          <MetricInfoTooltip {...info} />
        </div>
      </td>
      <td className="px-4 py-2">{baseline}</td>
      <td className="px-4 py-2">{p10}</td>
      <td className="px-4 py-2">{p50}</td>
      <td className="px-4 py-2">{p90}</td>
    </tr>
  );
}

function buildRiskRows(
  baseResult: ThermalSimulationResult,
  monteCarloResult: ThermalMonteCarloResult,
  peakThresholdKW: number | null
): RiskRow[] {
  const underheatingProbability =
    monteCarloResult.underheatingBelow20CProbability ??
    probabilityOf(
      monteCarloResult.scenarioSeries.minimumIndoorTemperatureC,
      (value) => value < THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C
    );
  const peakProbability =
    peakThresholdKW === null
      ? null
      : probabilityOf(monteCarloResult.scenarioSeries.peakLoadKW, (value) => value > peakThresholdKW);
  const energyProbability = probabilityOf(
    monteCarloResult.scenarioSeries.totalEnergyKWh,
    (value) => value > baseResult.summary.totalEnergyKWh * DEFAULT_ENERGY_GROWTH_FACTOR
  );
  const discomfortProbability = probabilityOf(monteCarloResult.scenarioSeries.discomfortHours, (value) => value > 5);

  return [
    {
      id: "underheating",
      label: `Температура ниже ${THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C} °C`,
      probability: underheatingProbability,
      status: resolveRiskStatus(underheatingProbability ?? 0),
    },
    {
      id: "peak",
      label:
        peakThresholdKW === null
          ? "Порог пиковой мощности не задан"
          : `Пиковая мощность выше ${formatNumber(peakThresholdKW, { maximumFractionDigits: 2 })} кВт`,
      probability: peakProbability,
      status: resolveRiskStatus(peakProbability ?? 0),
    },
    {
      id: "energy",
      label: "Энергия выше base на 20%",
      probability: energyProbability,
      status: resolveRiskStatus(energyProbability ?? 0),
    },
    {
      id: "discomfort",
      label: "Дискомфорт больше 5 ч",
      probability: discomfortProbability,
      status: resolveRiskStatus(discomfortProbability ?? 0),
    },
  ];
}

function buildUncertaintyMetricRow(
  id: string,
  label: string,
  summary: DistributionSummary,
  unit: string,
  decimals: number,
  info: MetricInfoDefinition
): UncertaintyMetricRow {
  return {
    id,
    label,
    info,
    unit,
    decimals,
    p10: summary.p10,
    p50: summary.p50,
    p90: summary.p90,
    spread: summary.spreadP10P90,
    relativeSpreadPercent: summary.relativeSpreadPercent,
    cvPercent: summary.coefficientOfVariationPercent,
  };
}

function buildConclusion(input: {
  climateLabel: string | null;
  mainFactorLabel: string | null;
  underheatingRisk: number;
}): string {
  const driver = input.mainFactorLabel ? `Основной риск: ${input.mainFactorLabel.toLowerCase()}.` : "";
  const climate = input.climateLabel ? ` Климатический сценарий: ${input.climateLabel}.` : "";
  if (input.underheatingRisk >= 0.3) {
    return `${driver} Вероятность недогрева повышенная.${climate}`.trim();
  }
  if (input.underheatingRisk >= 0.1) {
    return `${driver} Риск недогрева умеренный, имеет смысл проверить диапазоны инфильтрации и уставок.${climate}`.trim();
  }
  return `${driver} Критических рисков по вероятностному анализу не выявлено.${climate}`.trim();
}

function probabilityOf(values: number[], predicate: (value: number) => boolean): number | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) {
    return null;
  }
  return finite.filter(predicate).length / finite.length;
}

function resolveRiskStatus(probability: number): RiskStatus {
  if (probability >= 0.3) {
    return "высокий";
  }
  if (probability >= 0.1) {
    return "средний";
  }
  return "низкий";
}

function formatRiskStatus(status: RiskStatus): string {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)} риск`;
}

function riskBadgeTone(status: RiskStatus): MetricTone {
  switch (status) {
    case "высокий":
      return "accent";
    case "средний":
      return "warning";
    default:
      return "success";
  }
}

function describeCv(value: number | null): { label: string; tone: MetricTone } {
  if (value === null) {
    return { label: "Нет данных", tone: "info" };
  }
  if (value < 10) {
    return { label: "Устойчивый результат", tone: "success" };
  }
  if (value <= 25) {
    return { label: "Умеренная неопределённость", tone: "warning" };
  }
  return { label: "Высокая неопределённость", tone: "accent" };
}

function describeStability(value: number | null): { label: string; tone: MetricTone } {
  if (value === null) {
    return { label: "Нет данных", tone: "info" };
  }
  if (value > 90) {
    return { label: "Устойчивый режим", tone: "success" };
  }
  if (value >= 70) {
    return { label: "Требуется проверка", tone: "warning" };
  }
  return { label: "Высокий риск", tone: "accent" };
}

function resolveCalloutVariant(probability: number): "info" | "attention" | "risk" {
  if (probability >= 0.3) {
    return "risk";
  }
  if (probability >= 0.1) {
    return "attention";
  }
  return "info";
}

function formatPercentValue(value: number | null): string {
  return value === null ? "—" : `${formatNumber(value, { maximumFractionDigits: 1 })}%`;
}

function formatMetricValue(value: number | null, unit: string, decimals: number): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatNumber(value, { maximumFractionDigits: decimals })} ${unit}`;
}

function formatRangeValue(minValue: number | null, maxValue: number | null, unit: string, decimals: number): string {
  if (minValue === null || maxValue === null) {
    return "—";
  }
  return `${formatNumber(minValue, { maximumFractionDigits: decimals })}–${formatNumber(maxValue, {
    maximumFractionDigits: decimals,
  })} ${unit}`;
}

function formatSpreadValue(summary: DistributionSummary, unit: string, decimals: number): string {
  const spread = summary.spreadP10P90;
  const relative = summary.relativeSpreadPercent;
  if (spread === null) {
    return "—";
  }
  return `${formatMetricValue(spread, unit, decimals)} / ${formatPercentValue(relative)}`;
}

function formatSignedTemperature(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, { maximumFractionDigits: 1 })} °C`;
}

function parsePositiveNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const normalized = Number(value.replace(",", "."));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

function formatInputNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }
  return String(roundValue(value, 2));
}

function roundValue(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const tooltipStyle = {
  background: "var(--surface-elevated)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  fontSize: 12,
};

export default MonteCarloResultsSection;
