import { useMemo, type CSSProperties } from "react";
import type { ThermalSimulationResult } from "../../core/thermal/solver";
import type { ThermalMonteCarloResult } from "../../core/uncertainty/thermalMonteCarlo";
import { MetricInfoTooltip } from "../../shared/ui";
import { formatNumber } from "../../shared/utils/format";
import { resultsMetricInfo, type MetricInfoDefinition } from "./resultsMetricInfo";

type MetricGroup = "loss" | "energy" | "comfort" | "risk";

type SummaryMetric = {
  label: string;
  value: string;
  unit?: string;
  group: MetricGroup;
  featured?: boolean;
  metricInfo?: MetricInfoDefinition;
};

const COMPACT_LEFT_LABELS = ["Удельные потери", "Удельная пиковая"] as const;
const COMPACT_RIGHT_LABELS = ["Дискомфорт", "P50 Monte Carlo", "Теплопотребление P50"] as const;

function formatKw(value: number | null, digits = 2): { value: string; unit: string } {
  if (value == null || !Number.isFinite(value)) {
    return { value: "—", unit: "кВт" };
  }
  return {
    value: formatNumber(value, { maximumFractionDigits: digits }),
    unit: "кВт",
  };
}

function formatSpecific(value: number | null, unit: string, digits = 2): { value: string; unit: string } {
  if (value == null || !Number.isFinite(value)) {
    return { value: "—", unit };
  }
  const formatted = formatNumber(value, { maximumFractionDigits: digits });
  const [num, ...rest] = formatted.split(" ");
  if (rest.length) {
    return { value: `${num} ${rest.join(" ")}`, unit: "" };
  }
  return { value: num, unit };
}

function MetricInfoButton({ info }: { info: MetricInfoDefinition }) {
  return (
    <MetricInfoTooltip title={info.title} formula={info.formula} linkedFormulaIds={info.linkedFormulaIds}>
      <button type="button" className="ui-results-summary__info" aria-label={`Справка: ${info.title}`}>
        ?
      </button>
    </MetricInfoTooltip>
  );
}

function SummaryCompactGrid({ metrics, startIndex }: { metrics: SummaryMetric[]; startIndex: number }) {
  if (!metrics.length) {
    return null;
  }

  const leftMetrics = COMPACT_LEFT_LABELS.map((label) => metrics.find((metric) => metric.label === label)).filter(
    (metric): metric is SummaryMetric => metric != null
  );
  const rightMetrics = COMPACT_RIGHT_LABELS.map((label) => metrics.find((metric) => metric.label === label)).filter(
    (metric): metric is SummaryMetric => metric != null
  );
  const assigned = new Set([...leftMetrics, ...rightMetrics].map((metric) => metric.label));
  metrics.forEach((metric) => {
    if (!assigned.has(metric.label)) {
      (leftMetrics.length <= rightMetrics.length ? leftMetrics : rightMetrics).push(metric);
    }
  });

  const renderItem = (metric: SummaryMetric, index: number) => (
    <div
      key={metric.label}
      className={`ui-results-summary__compact-item ui-results-summary__compact-item--${metric.group}`}
      style={{ "--summary-i": startIndex + index } as CSSProperties}
    >
      <div className="ui-results-summary__compact-head">
        <p className="ui-results-summary__compact-label">{metric.label}</p>
        {metric.metricInfo ? <MetricInfoButton info={metric.metricInfo} /> : null}
      </div>
      <div className="ui-results-summary__compact-value">
        <span className="ui-results-summary__compact-number">{metric.value}</span>
        {metric.unit ? <span className="ui-results-summary__compact-unit">{metric.unit}</span> : null}
      </div>
    </div>
  );

  return (
    <section
      className="ui-results-summary__compact-panel"
      aria-label="Дополнительные показатели"
      style={{ "--summary-i": startIndex } as CSSProperties}
    >
      <div className="ui-results-summary__compact-columns">
        <div className="ui-results-summary__compact-col">{leftMetrics.map((metric, index) => renderItem(metric, index))}</div>
        <div className="ui-results-summary__compact-col">
          {rightMetrics.map((metric, index) => renderItem(metric, leftMetrics.length + index))}
        </div>
      </div>
    </section>
  );
}

function SummaryKpi({
  metric,
  size,
  index,
}: {
  metric: SummaryMetric;
  size: "spotlight" | "compact";
  index: number;
}) {
  const isSpotlight = size === "spotlight";
  const cardStyle = { "--summary-i": index } as CSSProperties;

  return (
    <article
      className={`ui-results-summary__kpi ui-results-summary__kpi--${metric.group} ui-results-summary__kpi--${isSpotlight ? "spotlight" : "compact"}`}
      style={cardStyle}
    >
      <header className="ui-results-summary__kpi-head">
        <p className="ui-results-summary__kpi-label">{metric.label}</p>
        {metric.metricInfo ? <MetricInfoButton info={metric.metricInfo} /> : null}
      </header>
      <div className="ui-results-summary__kpi-value">
        <span className="ui-results-summary__kpi-number">{metric.value}</span>
        {metric.unit ? <span className="ui-results-summary__kpi-unit">{metric.unit}</span> : null}
      </div>
    </article>
  );
}

export function ResultsOverviewSummary({
  lastThermalResult,
  monteCarloResult,
}: {
  lastThermalResult: ThermalSimulationResult | null;
  monteCarloResult: ThermalMonteCarloResult | null;
}) {
  const buildingDiagnostics = lastThermalResult?.diagnostics?.building ?? null;
  const transmissionLossKW = buildingDiagnostics
    ? (buildingDiagnostics.totalOpaqueLossW +
        buildingDiagnostics.totalWindowLossW +
        buildingDiagnostics.totalDoorLossW) /
      1000
    : null;
  const airExchangeLossKW = buildingDiagnostics
    ? (buildingDiagnostics.totalInfiltrationLossW + buildingDiagnostics.totalMechanicalVentilationLossW) / 1000
    : null;
  const totalHeatLossKW =
    transmissionLossKW != null && airExchangeLossKW != null ? transmissionLossKW + airExchangeLossKW : null;

  const transmissionShare =
    totalHeatLossKW && transmissionLossKW != null && totalHeatLossKW > 0
      ? Math.min(100, Math.max(0, (transmissionLossKW / totalHeatLossKW) * 100))
      : null;

  const allMetrics = useMemo(() => {
    const items: SummaryMetric[] = [];

    const summary = lastThermalResult?.summary;
    if (lastThermalResult && summary) {
      const specificEnergy = buildingDiagnostics?.specificEnergyKWh_m2 ?? null;
      const specificPeak = buildingDiagnostics?.specificPeakLoad_W_m2 ?? null;
      const peak = formatKw(summary.peakLoadKW);
      const specificEnergyParts = formatSpecific(specificEnergy, "кВт·ч/м²");
      const specificPeakParts = formatSpecific(specificPeak, "Вт/м²", 1);

      items.push(
        {
          label: "Теплопотребление",
          value: formatNumber(summary.totalEnergyKWh, { maximumFractionDigits: 1 }),
          unit: "кВт·ч",
          group: "energy",
          featured: true,
          metricInfo: resultsMetricInfo.energy,
        },
        {
          label: "Пиковая нагрузка",
          value: peak.value,
          unit: peak.unit,
          group: "energy",
          featured: true,
          metricInfo: resultsMetricInfo.peakLoad,
        },
        {
          label: "Через ограждения",
          value: formatKw(transmissionLossKW).value,
          unit: "кВт",
          group: "loss",
          metricInfo: resultsMetricInfo.buildingTransmissionLossKW,
        },
        {
          label: "Воздухообмен",
          value: formatKw(airExchangeLossKW).value,
          unit: "кВт",
          group: "loss",
          metricInfo: resultsMetricInfo.buildingAirExchangeLossKW,
        },
        {
          label: "Удельные потери",
          value: specificEnergyParts.value,
          unit: specificEnergyParts.unit || "кВт·ч/м²",
          group: "energy",
          metricInfo: resultsMetricInfo.buildingSpecificEnergyKWhM2,
        },
        {
          label: "Удельная пиковая",
          value: specificPeakParts.value,
          unit: specificPeakParts.unit || "Вт/м²",
          group: "energy",
          metricInfo: resultsMetricInfo.peakLoad,
        },
        {
          label: "Дискомфорт",
          value: formatNumber(summary.discomfortHours, { maximumFractionDigits: 1 }),
          unit: "ч",
          group: "comfort",
          metricInfo: resultsMetricInfo.discomfort,
        }
      );
    }

    if (monteCarloResult?.totalEnergy && Number.isFinite(monteCarloResult.totalEnergy.p50)) {
      items.push({
        label: "Теплопотребление P50",
        value: formatNumber(monteCarloResult.totalEnergy.p50, { maximumFractionDigits: 1 }),
        unit: "кВт·ч",
        group: "risk",
        metricInfo: resultsMetricInfo.monteCarloP50,
      });
    }

    return items;
  }, [airExchangeLossKW, buildingDiagnostics, lastThermalResult, monteCarloResult, transmissionLossKW]);

  const { spotlightMetrics, gridMetrics } = useMemo(() => {
    const spotlight = allMetrics.filter((metric) => metric.featured);
    const grid = allMetrics.filter((metric) => {
      if (metric.featured) {
        return false;
      }
      if (totalHeatLossKW != null && (metric.label === "Через ограждения" || metric.label === "Воздухообмен")) {
        return false;
      }
      return true;
    });
    return { spotlightMetrics: spotlight, gridMetrics: grid };
  }, [allMetrics, totalHeatLossKW]);

  if (!lastThermalResult && !monteCarloResult) {
    return null;
  }

  const hero = formatKw(totalHeatLossKW);
  const airShare = transmissionShare != null ? Math.max(0, 100 - transmissionShare) : null;
  const compositionRingStyle =
    transmissionShare != null
      ? ({
          background: `conic-gradient(
            var(--accent-base) 0% ${transmissionShare}%,
            var(--accent-lime) ${transmissionShare}% 100%
          )`,
        } as const)
      : undefined;

  let cardIndex = 1;

  return (
    <div className="ui-results-overview ui-results-summary">
      <div className="ui-results-summary__bento" aria-label="Сводка расчёта">
        {totalHeatLossKW != null ? (
          <section
            className="ui-results-summary__hero"
            aria-label="Суммарные теплопотери"
            style={{ "--summary-i": 0 } as CSSProperties}
          >
            <div className="ui-results-summary__hero-ambient" aria-hidden="true">
              <div className="ui-results-summary__hero-mesh" />
              <div className="ui-results-summary__hero-orb ui-results-summary__hero-orb--a" />
              <div className="ui-results-summary__hero-orb ui-results-summary__hero-orb--b" />
              <div className="ui-results-summary__hero-grid" />
            </div>

            <div className="ui-results-summary__hero-inner">
              <div className="ui-results-summary__hero-top">
                <div className="ui-results-summary__hero-head">
                  <span className="ui-results-summary__hero-badge">
                    <span className="ui-results-summary__hero-badge-dot" aria-hidden="true" />
                    Теплопотери
                  </span>
                  {lastThermalResult ? <MetricInfoButton info={resultsMetricInfo.buildingTotalHeatLossKW} /> : null}
                </div>
                <div className="ui-results-summary__hero-value">
                  <span className="ui-results-summary__hero-number">{hero.value}</span>
                  <span className="ui-results-summary__hero-unit">{hero.unit}</span>
                </div>
              </div>

              {transmissionShare != null &&
              transmissionLossKW != null &&
              airExchangeLossKW != null &&
              airShare != null ? (
                <div className="ui-results-summary__composition">
                  <div className="ui-results-summary__composition-layout">
                    <div className="ui-results-summary__composition-ring-wrap">
                      <div className="ui-results-summary__composition-ring" style={compositionRingStyle}>
                        <div className="ui-results-summary__composition-ring-core">
                          <span className="ui-results-summary__composition-ring-value">
                            {Math.round(transmissionShare)}
                            <span className="ui-results-summary__composition-ring-pct">%</span>
                          </span>
                          <span className="ui-results-summary__composition-ring-caption">ограждения</span>
                        </div>
                      </div>
                    </div>

                    <div className="ui-results-summary__composition-body">
                      <div className="ui-results-summary__composition-head">
                        <span className="ui-results-summary__composition-title">Структура потерь</span>
                        <span className="ui-results-summary__composition-meta">
                          {Math.round(transmissionShare)}% / {Math.round(airShare)}%
                        </span>
                      </div>
                      <div
                        className="ui-results-summary__composition-track"
                        role="img"
                        aria-label={`Ограждения ${Math.round(transmissionShare)}%, воздухообмен ${Math.round(airShare)}%`}
                      >
                        <span
                          className="ui-results-summary__composition-seg ui-results-summary__composition-seg--envelope"
                          style={{ width: `${transmissionShare}%` }}
                        />
                        <span
                          className="ui-results-summary__composition-seg ui-results-summary__composition-seg--air"
                          style={{ width: `${airShare}%` }}
                        />
                      </div>
                      <ul className="ui-results-summary__composition-legend">
                        <li className="ui-results-summary__composition-item ui-results-summary__composition-item--envelope">
                          <span className="ui-results-summary__composition-label">Ограждения</span>
                          <span className="ui-results-summary__composition-value">
                            {formatKw(transmissionLossKW).value}
                            <span className="ui-results-summary__composition-unit">кВт</span>
                          </span>
                        </li>
                        <li className="ui-results-summary__composition-item ui-results-summary__composition-item--air">
                          <span className="ui-results-summary__composition-label">Воздухообмен</span>
                          <span className="ui-results-summary__composition-value">
                            {formatKw(airExchangeLossKW).value}
                            <span className="ui-results-summary__composition-unit">кВт</span>
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {spotlightMetrics.map((metric) => {
          const index = cardIndex++;
          return <SummaryKpi key={metric.label} metric={metric} size="spotlight" index={index} />;
        })}

        {gridMetrics.length ? <SummaryCompactGrid metrics={gridMetrics} startIndex={cardIndex} /> : null}
      </div>
    </div>
  );
}

export default ResultsOverviewSummary;
