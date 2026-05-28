import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildDefaultEconomicScenario, runEconomicAssessment } from "../../core/economics/analysis";
import type { EconomicAssessmentResult, EconomicDataQualityLevel, EconomicScenario, EconomicScenarioMode } from "../../core/economics/types";
import type { Sp50ComplianceReport } from "../../core/thermal/sp50";
import { Badge, EmptyState, MetricInfoTooltip } from "../../shared/ui";
import { formatArea, formatEnergy, formatNumber } from "../../shared/utils/format";
import { resultsMetricInfo } from "./resultsMetricInfo";

interface ResultsEconomyTabProps {
  report: Sp50ComplianceReport | null;
  onOpenBuild?: () => void;
}

const KWH_PER_GCAL = 1163;

const SCENARIO_OPTIONS: Array<{ id: EconomicScenarioMode; label: string }> = [
  { id: "comprehensive", label: "Комплексная модернизация" },
  { id: "fast_payback", label: "Быстрая окупаемость" },
  { id: "maximum_saving", label: "Максимальная экономия" },
  { id: "minimum_budget", label: "Минимальный бюджет" },
];

export function ResultsEconomyTab({ report, onOpenBuild }: ResultsEconomyTabProps) {
  if (!report) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="Экономическая оценка пока недоступна"
          message="Для экономической оценки нужен нормативный или инженерный расчёт SP50. Откройте расчёт в /build или сформируйте исходные данные."
          tone="warning"
        />
        {onOpenBuild ? (
          <button type="button" onClick={onOpenBuild} className="ui-btn-secondary px-4 py-2 text-sm">
            Открыть /build
          </button>
        ) : null}
      </div>
    );
  }

  return <EconomyAssessmentPanel report={report} />;
}

function EconomyAssessmentPanel({ report }: { report: Sp50ComplianceReport }) {
  const baseScenario = useMemo(() => buildDefaultEconomicScenario(report), [report]);
  const [scenarioMode, setScenarioMode] = useState<EconomicScenarioMode>(baseScenario.mode);
  const [heatTariff, setHeatTariff] = useState(baseScenario.heatTariffRubPerGcal);
  const [electricityTariff, setElectricityTariff] = useState(baseScenario.electricityTariffRubPerKwh);
  const [heatingSource, setHeatingSource] = useState(baseScenario.heatingEnergySource);
  const [regionalFactor, setRegionalFactor] = useState(baseScenario.regionalCostFactor);
  const [discountRatePercent, setDiscountRatePercent] = useState((baseScenario.discountRate ?? 0.1) * 100);
  const [annualTariffGrowthPercent, setAnnualTariffGrowthPercent] = useState(baseScenario.annualTariffGrowthPercent ?? 5);
  const [annualMaintenanceCost, setAnnualMaintenanceCost] = useState(baseScenario.annualMaintenanceCost_RUB ?? 0);
  const [analysisPeriodYears, setAnalysisPeriodYears] = useState(baseScenario.analysisPeriod_years);

  useEffect(() => {
    setScenarioMode(baseScenario.mode);
    setHeatTariff(baseScenario.heatTariffRubPerGcal);
    setElectricityTariff(baseScenario.electricityTariffRubPerKwh);
    setHeatingSource(baseScenario.heatingEnergySource);
    setRegionalFactor(baseScenario.regionalCostFactor);
    setDiscountRatePercent((baseScenario.discountRate ?? 0.1) * 100);
    setAnnualTariffGrowthPercent(baseScenario.annualTariffGrowthPercent ?? 5);
    setAnnualMaintenanceCost(baseScenario.annualMaintenanceCost_RUB ?? 0);
    setAnalysisPeriodYears(baseScenario.analysisPeriod_years);
  }, [baseScenario]);

  const scenario = useMemo<EconomicScenario>(
    () => ({
      ...baseScenario,
      mode: scenarioMode,
      name: SCENARIO_OPTIONS.find((item) => item.id === scenarioMode)?.label ?? baseScenario.name,
      heatTariffRubPerGcal: heatTariff,
      electricityTariffRubPerKwh: electricityTariff,
      heatingEnergySource: heatingSource,
      regionalCostFactor: regionalFactor,
      discountRate: discountRatePercent / 100,
      annualTariffGrowthPercent,
      annualMaintenanceCost_RUB: annualMaintenanceCost,
      analysisPeriod_years: analysisPeriodYears,
      tariff: {
        ...baseScenario.tariff,
        heatPrice_RUB_kWh:
          heatingSource === "electricity"
            ? electricityTariff
            : heatTariff > 0
              ? heatTariff / KWH_PER_GCAL
              : 0,
      },
    }),
    [
      analysisPeriodYears,
      annualMaintenanceCost,
      annualTariffGrowthPercent,
      baseScenario,
      discountRatePercent,
      electricityTariff,
      heatTariff,
      heatingSource,
      regionalFactor,
      scenarioMode,
    ]
  );

  const assessment = useMemo<EconomicAssessmentResult>(() => runEconomicAssessment(report, scenario), [report, scenario]);

  const baseAnnualCost = useMemo(() => {
    const energy = assessment.summary.baseAnnualHeatingEnergy_kWh;
    if (!Number.isFinite(energy)) {
      return null;
    }
    const resolvedEnergy = energy as number;
    const tariffPerKwh =
      scenario.heatingEnergySource === "electricity"
        ? scenario.electricityTariffRubPerKwh
        : scenario.heatTariffRubPerGcal / KWH_PER_GCAL;
    return resolvedEnergy * tariffPerKwh;
  }, [assessment.summary.baseAnnualHeatingEnergy_kWh, scenario.electricityTariffRubPerKwh, scenario.heatTariffRubPerGcal, scenario.heatingEnergySource]);

  const zoneChartData = assessment.zones
    .filter((entry) => entry.id !== "heatingSystem" && entry.heatLoss_W > 0)
    .map((entry) => ({
      name: shortenLabel(entry.label),
      fullName: entry.label,
      loss: Number(entry.heatLoss_W.toFixed(0)),
    }));

  const paybackChartData = assessment.measureResults
    .filter((entry) => entry.status === "calculated" && entry.payback_years !== null)
    .slice(0, 8)
    .map((entry) => ({
      name: shortenLabel(entry.measureName),
      fullName: entry.measureName,
      payback: Number((entry.payback_years ?? 0).toFixed(1)),
    }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="ui-soft-kicker">Экономика</p>
          <div className="flex items-center gap-1.5">
            <h3 className="ui-heading-panel">Экономическая оценка на базе SP50</h3>
            <MetricInfoTooltip {...resultsMetricInfo.payback} />
          </div>
          <p className="text-sm text-[color:var(--text-muted)]">
            Оценка затрат, экономии и окупаемости на основе нормативного расчёта СП 50.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{SCENARIO_OPTIONS.find((item) => item.id === scenarioMode)?.label ?? scenarioMode}</Badge>
          <Badge tone={assessment.summary.isApproximate ? "warning" : "success"}>
            {assessment.summary.isApproximate ? "Есть оценочные допущения" : "Расчётные данные готовы"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiPill
          label="Стоимость энергии"
          value={formatCurrency(baseAnnualCost)}
          hint={`${formatEnergy(assessment.summary.baseAnnualHeatingEnergy_kWh, "кВт·ч/год")}`}
          info={resultsMetricInfo.cost}
        />
        <KpiPill
          label="Экономия"
          value={formatCurrency(assessment.summary.packageAnnualSaving_RUB)}
          hint={`${formatNumber(assessment.summary.packageSavedEnergy_Gcal_year, { maximumFractionDigits: 2 })} Гкал/год`}
          info={resultsMetricInfo.saving}
        />
        <KpiPill
          label="Окупаемость"
          value={formatPayback(assessment.summary.packagePayback_years)}
          hint={assessment.summary.packagePaybackClass}
          info={resultsMetricInfo.payback}
        />
        <KpiPill
          label="NPV"
          value={formatCurrency(assessment.summary.npv_RUB)}
          hint={`${analysisPeriodYears} лет`}
          info={resultsMetricInfo.npv}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <label className="text-sm text-[color:var(--text-muted)]">
          Режим оценки
          <select
            value={scenarioMode}
            onChange={(event) => setScenarioMode(event.target.value as EconomicScenarioMode)}
            className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
          >
            {SCENARIO_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[color:var(--text-muted)]">
          Источник тепла
          <select
            value={heatingSource}
            onChange={(event) => setHeatingSource(event.target.value as EconomicScenario["heatingEnergySource"])}
            className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
          >
            <option value="heat">Тепловая энергия</option>
            <option value="electricity">Электроотопление</option>
            <option value="unknown">Не задан</option>
          </select>
        </label>
        <NumberField label="Тариф на тепло, ₽/Гкал" value={heatTariff} step={50} onChange={setHeatTariff} />
        <NumberField label="Тариф на электроэнергию, ₽/кВт·ч" value={electricityTariff} step={0.1} onChange={setElectricityTariff} />
        <NumberField label="Региональный коэффициент" value={regionalFactor} min={0.1} step={0.05} onChange={setRegionalFactor} />
        <NumberField label="Ставка дисконтирования, %" value={discountRatePercent} min={0} step={0.5} onChange={setDiscountRatePercent} />
        <NumberField label="Рост тарифа, %/год" value={annualTariffGrowthPercent} min={0} step={0.5} onChange={setAnnualTariffGrowthPercent} />
        <NumberField label="Обслуживание, ₽/год" value={annualMaintenanceCost} min={0} step={1000} onChange={setAnnualMaintenanceCost} />
        <NumberField label="Горизонт анализа, лет" value={analysisPeriodYears} min={1} step={1} integer onChange={setAnalysisPeriodYears} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Теплопотери по зонам"
          subtitle="Какие зоны сильнее всего формируют базовые потери для экономической оценки."
          tooltipInfo={{
            title: "Теплопотери по зонам",
            meaning: "Распределение базовых теплопотерь по укрупнённым зонам ограждения.",
            formula: "Share_i = Q_i / ΣQ",
            inputs: ["SP50 constructions", "heatLoss_W"],
            calculatedIn: "src/core/economics/analysis.ts → buildEconomicZones(...)",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={zoneChartData} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: "var(--text-soft)" }} />
              <Tooltip
                formatter={(value: number) => [`${formatNumber(value, { maximumFractionDigits: 0 })} Вт`, "Теплопотери"]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="loss" fill="var(--warning-border)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Срок окупаемости мероприятий"
          subtitle="Сравнение самых сильных мер по простому сроку окупаемости."
          tooltipInfo={resultsMetricInfo.payback}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paybackChartData} margin={{ top: 8, right: 12, left: 12, bottom: 56 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={88} tick={{ fontSize: 11, fill: "var(--text-soft)" }} />
              <YAxis tick={{ fill: "var(--text-soft)", fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [`${formatNumber(value, { maximumFractionDigits: 1 })} лет`, "Окупаемость"]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="payback" radius={[8, 8, 0, 0]}>
                {paybackChartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.payback <= 8 ? "#22c55e" : entry.payback <= 15 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Мероприятия</p>
          <MetricInfoTooltip
            title="Приоритет мероприятий"
            meaning="Сводный рейтинг, который сочетает экономию, окупаемость, вклад в потери, комфорт и риски."
            formula="Priority = f(saving, payback, NPV, heatLossShare, comfort, risk)"
            inputs={["EconomicAssessmentResult.measureResults", "scoreBreakdown"]}
            calculatedIn="src/core/economics/analysis.ts → normalizeScores(...)"
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="text-sm text-[color:var(--text-soft)]">
                <th className="px-4 py-2 font-semibold">Мероприятие</th>
                <th className="px-4 py-2 font-semibold">Зона</th>
                <th className="px-4 py-2 font-semibold">Площадь</th>
                <th className="px-4 py-2 font-semibold">CAPEX</th>
                <th className="px-4 py-2 font-semibold">Экономия</th>
                <th className="px-4 py-2 font-semibold">Окупаемость</th>
                <th className="px-4 py-2 font-semibold">NPV</th>
                <th className="px-4 py-2 font-semibold">Статус</th>
                <th className="px-4 py-2 font-semibold">Приоритет</th>
              </tr>
            </thead>
            <tbody>
              {assessment.measureResults.map((entry) => (
                <tr key={entry.measureId} className={`border-t border-[color:var(--border-soft)] align-top ${entry.isRecommended ? "bg-[color:var(--success-bg)]/45" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-[color:var(--text-base)]">
                      <span>{entry.measureName}</span>
                      {entry.isRecommended ? <Badge tone="success">Рекомендуется</Badge> : null}
                      <span className={qualityBadgeClass(entry.dataQualityLevel)}>{qualityLabel(entry.dataQualityLevel)}</span>
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-soft)]">{entry.recommendation}</div>
                  </td>
                  <td className="px-4 py-3">{entry.zoneLabel}</td>
                  <td className="px-4 py-3">{entry.area_m2 > 0 ? formatArea(entry.area_m2) : "комплекс"}</td>
                  <td className="px-4 py-3">{formatCurrency(entry.totalCost_RUB)}</td>
                  <td className="px-4 py-3">{formatCurrency(entry.annualSaving_RUB)}</td>
                  <td className="px-4 py-3">{formatPayback(entry.payback_years)}</td>
                  <td className="px-4 py-3">{formatCurrency(entry.npv_RUB)}</td>
                  <td className="px-4 py-3">{entry.status === "calculated" ? "Расчёт" : "Недостаточно данных"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[color:var(--text-base)]">{entry.priorityLevel}</div>
                    <div className="text-xs text-[color:var(--text-soft)]">
                      {formatNumber(entry.priorityScorePercent, { maximumFractionDigits: 1 })} / 100
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {assessment.warnings.length ? (
        <section className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] p-4">
          <p className="text-sm font-semibold text-[color:var(--warning-fg)]">Предупреждения</p>
          <ul className="mt-2 space-y-1 text-sm text-[color:var(--warning-fg)]">
            {assessment.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KpiPill({
  label,
  value,
  hint,
  info,
}: {
  label: string;
  value: string;
  hint?: string;
  info: { title: string; meaning: string; formula?: string; inputs?: string | string[]; calculatedIn?: string; notes?: string | string[] };
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

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  integer = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  integer?: boolean;
}) {
  return (
    <label className="text-sm text-[color:var(--text-muted)]">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) {
            return;
          }
          onChange(integer ? Math.max(min, Math.round(next)) : Math.max(min, next));
        }}
        className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
      />
    </label>
  );
}

function ChartPanel({
  title,
  subtitle,
  tooltipInfo,
  children,
}: {
  title: string;
  subtitle: string;
  tooltipInfo: { title: string; meaning: string; formula?: string; inputs?: string | string[]; calculatedIn?: string; notes?: string | string[] };
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <div className="mb-3">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">{title}</p>
          <MetricInfoTooltip {...tooltipInfo} />
        </div>
        <p className="text-sm text-[color:var(--text-muted)]">{subtitle}</p>
      </div>
      <div className="h-80">{children}</div>
    </section>
  );
}

function shortenLabel(value: string): string {
  return value.length > 18 ? `${value.slice(0, 18).trimEnd()}…` : value;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPayback(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatNumber(value, { maximumFractionDigits: 1 })} лет`;
}

function qualityLabel(value: EconomicDataQualityLevel): string {
  switch (value) {
    case "calculated":
      return "расчёт";
    case "estimated":
      return "оценка";
    case "default":
      return "справочно";
    default:
      return value;
  }
}

function qualityBadgeClass(value: EconomicDataQualityLevel): string {
  switch (value) {
    case "calculated":
      return "rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--success-fg)]";
    case "estimated":
      return "rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--warning-fg)]";
    default:
      return "rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--text-soft)]";
  }
}

const tooltipStyle = {
  background: "var(--surface-elevated)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  fontSize: 12,
};

export default ResultsEconomyTab;
