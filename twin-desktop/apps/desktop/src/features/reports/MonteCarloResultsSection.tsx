import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  Line,
  ReferenceLine,
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
  THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C,
  type ThermalMonteCarloTargetMetricId,
  type DistributionSummary,
  type ThermalMonteCarloResult,
  type ThermalMonteCarloSensitivityFactor,
} from "../../core/uncertainty/thermalMonteCarlo";
import { Badge, CollapsibleSection, EmptyState, MetricInfoTooltip } from "../../shared/ui";
import { formatEnergy, formatNumber, formatPercentage } from "../../shared/utils/format";
import { getRoomDisplayName } from "../../shared/utils/roomNames";
import { MonteCarloChart } from "./charts/MonteCarloChart";
import { MonteCarloScatterChart } from "./charts/MonteCarloScatterChart";
import { ThermalTimeSeriesChartBlock } from "./charts/ThermalTimeSeriesChartBlock";
import { resultsMetricInfo, type MetricInfoDefinition } from "./resultsMetricInfo";

interface MonteCarloResultsSectionProps {
  baseResult: ThermalSimulationResult | null;
  baseOptions: ThermalSimulationOptions;
  buildingModel: BuildingModel;
  climateLabel: string | null;
  monteCarloResult: ThermalMonteCarloResult | null;
  onEditUncertainty?: () => void;
  onRunCalculation?: () => void;
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
  p5: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  p95: number | null;
  spread: number | null;
  relativeSpreadPercent: number | null;
  cvPercent: number | null;
  ciLower: number | null;
  ciUpper: number | null;
}

interface TailRiskCard {
  id: string;
  label: string;
  valueAtRisk: number | null;
  conditionalValueAtRisk: number | null;
  unit: string;
  decimals: number;
}

interface CdfPointView {
  value: number;
  probabilityPercent: number;
}

interface MonteCarloPresentation {
  sensitivity: ThermalMonteCarloSensitivityFactor[];
  mainFactor: ThermalMonteCarloSensitivityFactor | null;
  riskRows: RiskRow[];
  roomRows: RoomRiskRow[];
  topRiskRooms: RoomRiskRow[];
  riskiestRoom: RoomRiskRow | null;
  uncertaintyRows: UncertaintyMetricRow[];
  tailRiskCards: TailRiskCard[];
  varLevelPercent: number;
  energyCdf: CdfPointView[];
  underheatingRisk: number | null;
  stabilityIndexPercent: number | null;
  peakExceedanceProbability: number | null;
  energyGrowthProbability: number | null;
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
  onRunCalculation,
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
      tailRiskCards: [
        buildTailRiskCard("energy", "Энергия отопления", monteCarloResult.totalEnergy, "кВт·ч", 1),
        buildTailRiskCard("peak", "Пиковая нагрузка", monteCarloResult.peakLoad, "кВт", 2),
      ],
      varLevelPercent: roundValue(monteCarloResult.varLevel * 100, 0),
      energyCdf: buildCdfView(monteCarloResult.totalEnergy.cdf),
      underheatingRisk,
      stabilityIndexPercent,
      peakExceedanceProbability,
      energyGrowthProbability,
    };
  }, [
    baseOptions,
    baseResult,
    monteCarloResult,
    peakThresholdKW,
    roomNameMap,
    selectedTargetMetric,
    selectedTargetMetricValues,
  ]);

  const fanChartData = useMemo(() => {
    const pts = monteCarloResult?.percentilesByTime;
    if (!pts?.length) return [];
    const baseTl = baseResult?.timeline ?? [];
    const baseMap = new Map<number, number>();
    baseTl.forEach((pt) => {
      const totalKW = Object.values(pt.rooms).reduce((sum, r) => sum + (r.heatingPowerW ?? 0), 0) / 1000;
      baseMap.set(Math.round(pt.timeHours * 100), totalKW);
    });
    const getBase = (t: number): number | null => {
      const key = Math.round(t * 100);
      if (baseMap.has(key)) return baseMap.get(key)!;
      for (let d = 1; d <= 10; d++) {
        if (baseMap.has(key + d)) return baseMap.get(key + d)!;
        if (baseMap.has(key - d)) return baseMap.get(key - d)!;
      }
      return null;
    };
    return pts.map((pt) => ({
      timeHours: pt.timeHours,
      p10: pt.p10,
      bandWidth: Math.max(0, pt.p90 - pt.p10),
      p50: pt.p50,
      p90: pt.p90,
      baseline: baseTl.length > 0 ? getBase(pt.timeHours) : null,
    }));
  }, [monteCarloResult?.percentilesByTime, baseResult?.timeline]);

  if (!monteCarloResult) {
    return (
      <div className="space-y-5" data-testid="monte-carlo-results-section">
        <EmptyState
          title="Вероятностный анализ ещё не выполнен"
          message="Перейдите в раздел «Вероятностный анализ» и запустите Monte Carlo поверх нестационарного RC-расчёта."
        />
        {onEditUncertainty ? (
          <button type="button" onClick={onEditUncertainty} className="ui-btn-primary px-4 py-2 text-sm">
            Перейти к вероятностному анализу
          </button>
        ) : null}
        <ThermalTimeSeriesChartBlock heatingDisplay="raw" onRunCalculation={onRunCalculation} />
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
          <h3 className="ui-heading-panel">Monte Carlo поверх нестационарного RC-расчёта</h3>
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

      <div className="space-y-2">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Базовый нестационарный RC (исходные шаги)</p>
        <ThermalTimeSeriesChartBlock heatingDisplay="raw" onRunCalculation={onRunCalculation} />
      </div>

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">
            Хвостовые риски VaR / CVaR (уровень {formatNumber(presentation.varLevelPercent, { maximumFractionDigits: 0 })}%)
          </p>
          <MetricInfoTooltip {...resultsMetricInfo.valueAtRisk} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {presentation.tailRiskCards.flatMap((card) => [
            <SummaryStripItem
              key={`${card.id}-var`}
              label={`VaR · ${card.label}`}
              value={formatMetricValue(card.valueAtRisk, card.unit, card.decimals)}
              hint={`P${formatNumber(presentation.varLevelPercent, { maximumFractionDigits: 0 })} — не превышается в ${formatNumber(
                presentation.varLevelPercent,
                { maximumFractionDigits: 0 }
              )}% сценариев`}
              info={resultsMetricInfo.valueAtRisk}
            />,
            <SummaryStripItem
              key={`${card.id}-cvar`}
              label={`CVaR · ${card.label}`}
              value={formatMetricValue(card.conditionalValueAtRisk, card.unit, card.decimals)}
              hint={`Среднее в худших ${formatNumber(100 - presentation.varLevelPercent, {
                maximumFractionDigits: 0,
              })}% сценариев`}
              info={resultsMetricInfo.conditionalValueAtRisk}
            />,
          ])}
        </div>
      </section>

      <CollapsibleSection
        title="Инженерные метрики неопределённости"
        titleAddon={<MetricInfoTooltip {...resultsMetricInfo.coefficientOfVariation} />}
      >
        <div className="space-y-4 pt-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[color:var(--text-muted)]">
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
                className="shrink-0 rounded-full border border-[color:var(--border-soft)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]"
                onClick={() => setPeakThresholdInput(formatInputNumber(defaultPeakThresholdKW))}
              >
                1,2× база
              </button>
            </div>
            <p className="mt-2 text-xs text-[color:var(--text-muted)]">
              По умолчанию 120% от базовой пиковой нагрузки. Пустое поле — вероятность превышения не считается.
            </p>
          </div>
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

        <CollapsibleSection title="Детализация по показателям">
          <div className="overflow-x-auto pt-3">
            <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-sm text-[color:var(--text-soft)]">
                <th className="px-4 py-2 font-semibold">Показатель</th>
                <th className="px-4 py-2 font-semibold">P50</th>
                <th className="px-4 py-2 font-semibold">P10–P90</th>
                <th className="px-4 py-2 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <span>P5–P95</span>
                    <MetricInfoTooltip {...resultsMetricInfo.percentileCorridorP5P95} />
                  </span>
                </th>
                <th className="px-4 py-2 font-semibold">Ширина</th>
                <th className="px-4 py-2 font-semibold">CV</th>
                <th className="px-4 py-2 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <span>95% ДИ μ</span>
                    <MetricInfoTooltip {...resultsMetricInfo.confidenceIntervalMean} />
                  </span>
                </th>
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
                    <td className="px-4 py-2">{formatRangeValue(row.p5, row.p95, row.unit, row.decimals)}</td>
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
                    <td className="px-4 py-2">{formatRangeValue(row.ciLower, row.ciUpper, row.unit, row.decimals)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={cvInfo.tone}>{cvInfo.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </CollapsibleSection>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Базовый расчёт и квантили P10 / P50 / P90"
        titleAddon={
          <MetricInfoTooltip
            title="Квантили Monte Carlo"
            meaning="Сравнение базового детерминированного сценария с распределением вероятностного результата."
            formula="Base vs quantile(metric, q)"
            inputs={["baseResult.summary", "scenarioSeries"]}
            calculatedIn="src/core/uncertainty/thermalMonteCarlo.ts"
          />
        }
      >
        <div className="overflow-x-auto pt-3">
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
      </CollapsibleSection>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <MonteCarloChart result={monteCarloResult} baselineEnergyKWh={baseResult.summary.totalEnergyKWh} />
        <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <p className="text-sm font-semibold text-[color:var(--text-base)]">Чувствительность факторов</p>
            <MetricInfoTooltip {...resultsMetricInfo.sensitivity} />
          </div>
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

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Кривая вероятности энергии (CDF)</p>
          <MetricInfoTooltip {...resultsMetricInfo.cumulativeDistribution} />
        </div>
        {presentation.energyCdf.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={presentation.energyCdf} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="mc-cdf-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-base)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent-base)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="value"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                  tickFormatter={(value) => formatNumber(Number(value), { maximumFractionDigits: 0 })}
                >
                  <Label value="Энергия отопления, кВт·ч" position="insideBottom" offset={-4} fill="var(--text-soft)" fontSize={11} />
                </XAxis>
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                  tickFormatter={(value) => `${Math.round(Number(value))}%`}
                >
                  <Label
                    value="P(E ≤ x), %"
                    angle={-90}
                    position="insideLeft"
                    style={{ textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 }}
                  />
                </YAxis>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`${formatNumber(value, { maximumFractionDigits: 1 })}%`, "Вероятность"]}
                  labelFormatter={(label) => `${formatNumber(Number(label), { maximumFractionDigits: 0 })} кВт·ч`}
                />
                {([
                  { value: monteCarloResult.totalEnergy.p10, label: "P10" },
                  { value: monteCarloResult.totalEnergy.p50, label: "P50" },
                  { value: monteCarloResult.totalEnergy.p90, label: "P90" },
                ] as const).map((marker) =>
                  Number.isFinite(marker.value) ? (
                    <ReferenceLine
                      key={marker.label}
                      x={marker.value}
                      stroke="var(--chart-line-muted)"
                      strokeDasharray="4 4"
                      label={{ value: marker.label, position: "top", fill: "var(--text-soft)", fontSize: 10 }}
                    />
                  ) : null
                )}
                <Area
                  type="monotone"
                  dataKey="probabilityPercent"
                  stroke="var(--accent-base)"
                  strokeWidth={2}
                  fill="url(#mc-cdf-fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Кривая вероятности появится после накопления сценариев Monte Carlo." />
        )}
      </section>

      <MonteCarloScatterChart
        result={monteCarloResult}
        baseOptions={baseOptions}
        targetMetric={selectedTargetMetric}
        onTargetMetricChange={setSelectedTargetMetric}
      />

      <CollapsibleSection
        title="Риск по помещениям"
        titleAddon={
          <MetricInfoTooltip
            title="Риск по помещениям"
            meaning="Показывает медианную температуру, холодный хвост и вероятность недогрева по помещениям."
            formula="Risk_room = count(T_min,room < threshold) / N"
            inputs={["roomRiskSummary.temperatureP50C", "roomRiskSummary.minimumTemperatureP10C", "roomRiskSummary.underheatingRisk"]}
            calculatedIn="src/core/uncertainty/thermalMonteCarlo.ts → roomRiskSummary"
          />
        }
      >
        <div className="space-y-3 pt-3">
        {presentation.topRiskRooms.length ? (
          <div className="flex flex-wrap gap-2">
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
          <div className="overflow-x-auto">
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
        </div>
      </CollapsibleSection>

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Веерный график мощности отопления</p>
          <MetricInfoTooltip title="Веерный график по времени" />
        </div>
        {fanChartData.length > 0 ? (
          <>
            <div className="h-[260px] rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={fanChartData} margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timeHours"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v: number) =>
                      v < 24 ? `${Math.round(v)}ч` : `д${Math.floor(v / 24) + 1}`
                    }
                    tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                  >
                    <Label value="Время" position="insideBottom" offset={-12} fill="var(--text-soft)" fontSize={11} />
                  </XAxis>
                  <YAxis
                    tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                    tickFormatter={(v: number) => formatNumber(v, { maximumFractionDigits: 1 })}
                    width={52}
                  >
                    <Label
                      value="кВт"
                      angle={-90}
                      position="insideLeft"
                      style={{ textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 }}
                    />
                  </YAxis>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as typeof fanChartData[number];
                      if (!d) return null;
                      return (
                        <div
                          style={{
                            background: "var(--surface-elevated)",
                            border: "1px solid var(--border-soft)",
                            borderRadius: 12,
                            padding: "8px 12px",
                            fontSize: 12,
                          }}
                        >
                          <p style={{ color: "var(--text-soft)", marginBottom: 4 }}>
                            t = {formatNumber(d.timeHours, { maximumFractionDigits: 1 })} ч
                          </p>
                          <p>P10: {formatNumber(d.p10, { maximumFractionDigits: 2 })} кВт</p>
                          <p>P50: {formatNumber(d.p50, { maximumFractionDigits: 2 })} кВт</p>
                          <p>P90: {formatNumber(d.p90, { maximumFractionDigits: 2 })} кВт</p>
                          {d.baseline != null && (
                            <p>База: {formatNumber(d.baseline, { maximumFractionDigits: 2 })} кВт</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  {/* Полоса P10–P90: прозрачная база до P10, затем цветная ширина до P90 */}
                  <Area
                    type="monotone"
                    dataKey="p10"
                    stackId="fan"
                    fill="transparent"
                    stroke="none"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="bandWidth"
                    stackId="fan"
                    fill="var(--accent-soft)"
                    fillOpacity={0.45}
                    stroke="none"
                    isAnimationActive={false}
                  />
                  {/* Медиана P50 */}
                  <Line
                    type="monotone"
                    dataKey="p50"
                    stroke="var(--accent-base)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* Базовый сценарий */}
                  {baseResult ? (
                    <Line
                      type="monotone"
                      dataKey="baseline"
                      stroke="var(--danger-border)"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[color:var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-5 rounded-sm"
                  style={{ background: "var(--accent-soft)", opacity: 0.6 }}
                />
                P10–P90 (80% сценариев)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5" style={{ background: "var(--accent-base)" }} />
                P50 — медиана
              </span>
              {baseResult ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-0.5 w-5"
                    style={{ background: "var(--danger-border)", borderTop: "2px dashed var(--danger-border)" }}
                  />
                  Базовый сценарий
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState message="Запустите Monte Carlo заново, чтобы построить веерный график по временным шагам." />
        )}
      </section>

      <CollapsibleSection
        title="Риски сценариев"
        titleAddon={<MetricInfoTooltip {...resultsMetricInfo.underheatingRisk} />}
      >
        <div className="overflow-x-auto pt-3">
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
      </CollapsibleSection>

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
    p5: summary.p5,
    p10: summary.p10,
    p50: summary.p50,
    p90: summary.p90,
    p95: summary.p95,
    spread: summary.spreadP10P90,
    relativeSpreadPercent: summary.relativeSpreadPercent,
    cvPercent: summary.coefficientOfVariationPercent,
    ciLower: summary.confidenceIntervalMean95?.lower ?? null,
    ciUpper: summary.confidenceIntervalMean95?.upper ?? null,
  };
}

function buildTailRiskCard(
  id: string,
  label: string,
  summary: DistributionSummary,
  unit: string,
  decimals: number
): TailRiskCard {
  return {
    id,
    label,
    valueAtRisk: Number.isFinite(summary.valueAtRisk) ? summary.valueAtRisk : null,
    conditionalValueAtRisk: Number.isFinite(summary.conditionalValueAtRisk)
      ? summary.conditionalValueAtRisk
      : null,
    unit,
    decimals,
  };
}

function buildCdfView(cdf: { value: number; probability: number }[]): CdfPointView[] {
  return cdf
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.probability))
    .map((point) => ({ value: point.value, probabilityPercent: point.probability * 100 }));
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
