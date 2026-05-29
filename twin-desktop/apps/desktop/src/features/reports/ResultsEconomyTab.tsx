import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildDefaultEconomicScenario, calculateDiscountedPayback_years, runEconomicAssessment } from "../../core/economics/analysis";
import type { EconomicAssessmentResult, EconomicAssessmentSummary, EconomicDataQualityLevel, EconomicScenario, EconomicScenarioMode } from "../../core/economics/types";
import type { Sp50ComplianceReport } from "../../core/thermal/sp50";
import { Badge, EmptyState, FormulaTooltip, MetricInfoTooltip } from "../../shared/ui";
import { formatArea, formatEnergy, formatNumber } from "../../shared/utils/format";
import { resultsMetricInfo } from "./resultsMetricInfo";

interface ResultsEconomyTabProps {
  report: Sp50ComplianceReport | null;
  onOpenBuild?: () => void;
}

const KWH_PER_GCAL = 1163;

/** Удельные выбросы CO₂ по умолчанию для каждого источника тепла, кг/кВт·ч */
const DEFAULT_CO2_FACTORS: Record<string, number> = {
  heat: 0.20,
  gas: 0.22,
  electricity: 0.35,
  unknown: 0.22,
};

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
  const [co2Factor, setCo2Factor] = useState(baseScenario.co2EmissionFactor_kgPerKWh ?? DEFAULT_CO2_FACTORS.heat);
  const [gasTariff, setGasTariff] = useState(baseScenario.gasTariffRubPerM3 ?? 0);
  const [gasPenaltyPct, setGasPenaltyPct] = useState(baseScenario.gasUnderconsumptionPenaltyPercent ?? 0);
  const [heatMinFraction, setHeatMinFraction] = useState((baseScenario.heatContractMinimumPaymentFraction ?? 0) * 100);
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
    setCo2Factor(baseScenario.co2EmissionFactor_kgPerKWh ?? DEFAULT_CO2_FACTORS[baseScenario.heatingEnergySource] ?? 0.22);
    setGasTariff(baseScenario.gasTariffRubPerM3 ?? 0);
    setGasPenaltyPct(baseScenario.gasUnderconsumptionPenaltyPercent ?? 0);
    setHeatMinFraction((baseScenario.heatContractMinimumPaymentFraction ?? 0) * 100);
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
      co2EmissionFactor_kgPerKWh: co2Factor,
      gasTariffRubPerM3: gasTariff,
      gasUnderconsumptionPenaltyPercent: gasPenaltyPct,
      heatContractMinimumPaymentFraction: heatMinFraction / 100,
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
            : heatingSource === "gas"
              ? gasTariff > 0 ? gasTariff / (9.3 * 0.92) : 0
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
      co2Factor,
      discountRatePercent,
      electricityTariff,
      gasPenaltyPct,
      gasTariff,
      heatMinFraction,
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
    let tariffPerKwh: number;
    if (scenario.heatingEnergySource === "electricity") {
      tariffPerKwh = scenario.electricityTariffRubPerKwh;
    } else if (scenario.heatingEnergySource === "gas") {
      tariffPerKwh = (scenario.gasTariffRubPerM3 ?? 0) > 0
        ? (scenario.gasTariffRubPerM3 as number) / (9.3 * 0.92)
        : 0;
    } else {
      tariffPerKwh = scenario.heatTariffRubPerGcal / KWH_PER_GCAL;
    }
    return resolvedEnergy * tariffPerKwh;
  }, [assessment.summary.baseAnnualHeatingEnergy_kWh, scenario.electricityTariffRubPerKwh, scenario.gasTariffRubPerM3, scenario.heatTariffRubPerGcal, scenario.heatingEnergySource]);

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

  const breakevenData = useMemo(() => {
    const cost = assessment.summary.packageCost_RUB;
    const saving = assessment.summary.packageEffectiveAnnualSaving_RUB;
    const growth = (scenario.annualTariffGrowthPercent ?? 0) / 100;
    const years = scenario.analysisPeriod_years;
    if (!Number.isFinite(cost) || !Number.isFinite(saving) || saving <= 0 || cost <= 0) return [];
    const data: Array<{ year: number; cumulative: number }> = [{ year: 0, cumulative: -Math.round(cost) }];
    let cum = -cost;
    for (let y = 1; y <= years; y++) {
      cum += saving * (1 + growth) ** (y - 1);
      data.push({ year: y, cumulative: Math.round(cum) });
    }
    return data;
  }, [assessment.summary.packageCost_RUB, assessment.summary.packageEffectiveAnnualSaving_RUB, scenario.annualTariffGrowthPercent, scenario.analysisPeriod_years]);

  const discountedPaybackYears = useMemo(
    () =>
      calculateDiscountedPayback_years({
        cost_RUB: assessment.summary.packageCost_RUB,
        annualSaving_RUB: assessment.summary.packageEffectiveAnnualSaving_RUB,
        discountRate: scenario.discountRate ?? 0.1,
        annualTariffGrowthPercent: scenario.annualTariffGrowthPercent ?? 5,
        analysisPeriod_years: scenario.analysisPeriod_years,
      }),
    [assessment.summary.packageCost_RUB, assessment.summary.packageEffectiveAnnualSaving_RUB, scenario.discountRate, scenario.annualTariffGrowthPercent, scenario.analysisPeriod_years]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5">
        <h3 className="ui-heading-panel">Экономическая оценка на базе SP50</h3>
        <MetricInfoTooltip {...resultsMetricInfo.payback} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiPill
          label="Стоимость энергии"
          value={formatCurrency(baseAnnualCost)}
          hint={`${formatEnergy(assessment.summary.baseAnnualHeatingEnergy_kWh, "кВт·ч/год")}`}
          info={resultsMetricInfo.cost}
        />
        <KpiPill
          label="Экономия (валовая)"
          value={formatCurrency(assessment.summary.packageAnnualSaving_RUB)}
          hint={`${formatNumber(assessment.summary.packageSavedEnergy_Gcal_year, { maximumFractionDigits: 2 })} Гкал/год`}
          info={resultsMetricInfo.saving}
        />
        {assessment.summary.packageContractPenalty_RUB > 0 && (
          <KpiPill
            label="Штраф по договору"
            value={`−${formatCurrency(assessment.summary.packageContractPenalty_RUB)}`}
            hint="Недобор газа / мин. платёж ЦТ"
            info={{ title: "Штраф за недобор", meaning: "Часть экономии, которую потребитель всё равно платит по условиям договора поставки энергоресурса. Для газа применяется только когда экономия снижает потребление ниже договорного минимума.", formula: "Penalty = (Q_min − Q_actual) × tariff × penalty%" }}
          />
        )}
        <KpiPill
          label="Окупаемость"
          value={formatPayback(assessment.summary.packagePayback_years)}
          hint={assessment.summary.packagePaybackClass}
          info={resultsMetricInfo.payback}
        />
        <KpiPill
          label="NPV"
          value={formatCurrency(assessment.summary.npv_RUB)}
          hint={`${analysisPeriodYears} лет, с остат. стоим.`}
          info={resultsMetricInfo.npv}
        />
        {assessment.summary.packageSavedCO2_tCO2_year !== null && (
          <KpiPill
            label="Снижение CO₂"
            value={`${formatNumber(assessment.summary.packageSavedCO2_tCO2_year, { maximumFractionDigits: 1 })} т/год`}
            hint={`фактор ${co2Factor} кг/кВт·ч`}
            info={{ title: "Снижение выбросов CO₂", meaning: "Сокращение выбросов углекислого газа при реализации пакета мероприятий. Рассчитывается по удельному выбросу источника тепла.", formula: "CO₂ = ΔE_kWh/год × f_CO₂ / 1000, т/год", inputs: ["savedEnergy_kWh_year", "co2EmissionFactor_kgPerKWh"] }}
          />
        )}
      </div>

      <EnergyClassSection summary={assessment.summary} />

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
            onChange={(event) => {
              const src = event.target.value as EconomicScenario["heatingEnergySource"];
              setHeatingSource(src);
              setCo2Factor(DEFAULT_CO2_FACTORS[src] ?? 0.22);
            }}
            className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
          >
            <option value="heat">Централизованное теплоснабжение</option>
            <option value="gas">Газовый котёл (автономное)</option>
            <option value="electricity">Электроотопление</option>
            <option value="unknown">Не задан</option>
          </select>
        </label>
        <NumberField label="Тариф на тепло (ЦТ), ₽/Гкал" value={heatTariff} step={50} onChange={setHeatTariff} />
        <NumberField label="Тариф на газ, ₽/м³" value={gasTariff} step={0.1} onChange={setGasTariff} />
        <NumberField label="Тариф на электроэнергию, ₽/кВт·ч" value={electricityTariff} step={0.1} onChange={setElectricityTariff} />
        {heatingSource === "gas" && (
          <NumberField label="Штраф за недобор газа, %" value={gasPenaltyPct} min={0} step={1} onChange={setGasPenaltyPct} />
        )}
        {heatingSource === "heat" && (
          <NumberField label="Мин. платёж ЦТ (без счётчика), %" value={heatMinFraction} min={0} step={1} onChange={setHeatMinFraction} />
        )}
        <NumberField label="Выброс CO₂, кг/кВт·ч тепла" value={co2Factor} min={0} step={0.01} onChange={setCo2Factor} />
        <NumberField label="Региональный коэффициент" value={regionalFactor} min={0.1} step={0.05} onChange={setRegionalFactor} />
        <NumberField label="Ставка дисконтирования, %" value={discountRatePercent} min={0} step={0.5} onChange={setDiscountRatePercent} />
        <NumberField label="Рост тарифа, %/год" value={annualTariffGrowthPercent} min={0} step={0.5} onChange={setAnnualTariffGrowthPercent} />
        <NumberField label="Обслуживание, ₽/год" value={annualMaintenanceCost} min={0} step={1000} onChange={setAnnualMaintenanceCost} />
        <NumberField label="Горизонт анализа, лет" value={analysisPeriodYears} min={1} step={1} integer onChange={setAnalysisPeriodYears} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Теплопотери по зонам">
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

        <ChartPanel title="Срок окупаемости мероприятий">
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

      {breakevenData.length > 1 && (
        <ChartPanel title="Накопленный денежный поток (окупаемость)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={breakevenData} margin={{ top: 8, right: 24, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--text-soft)" }} label={{ value: "лет", position: "insideRight", offset: -4, fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatCurrencyShort(v)} tick={{ fill: "var(--text-soft)", fontSize: 11 }} />
              <ReferenceLine y={0} stroke="var(--success-border)" strokeWidth={2} strokeDasharray="4 4" />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Накоплено"]}
                labelFormatter={(label) => `Год ${label}`}
                contentStyle={tooltipStyle}
              />
              <Line type="monotone" dataKey="cumulative" stroke="var(--accent-base)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}

      <MeasuresTable assessment={assessment} />

      <SensitivitySection
        summary={assessment.summary}
        discountedPayback={discountedPaybackYears}
        annualTariffGrowthPercent={annualTariffGrowthPercent}
        discountRatePercent={discountRatePercent}
      />

      <StagedRecommendationsSection measureResults={assessment.measureResults} />

    </div>
  );
}

function MeasuresTable({ assessment }: { assessment: EconomicAssessmentResult }) {
  const hasPenalty = assessment.summary.packageContractPenalty_RUB > 0;
  const hasCO2 = assessment.measureResults.some((e) => e.savedCO2_tCO2_year !== null);

  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Мероприятия</p>
        <FormulaTooltip
          title="Приоритет мероприятий"
          meaning="Сводный рейтинг сочетает экономию, окупаемость, долю теплопотерь, комфорт и риски. NPV учитывает остаточную стоимость (срок службы мероприятия > горизонта анализа)."
          formula="Priority = f(saving, payback, NPV, heatLossShare, comfort, risk)"
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="text-xs text-[color:var(--text-soft)]">
              <th className="px-4 py-2 font-semibold">Мероприятие</th>
              <th className="px-4 py-2 font-semibold">Зона</th>
              <th className="px-4 py-2 font-semibold">Площадь</th>
              <th className="px-4 py-2 font-semibold">CAPEX</th>
              <th className="px-4 py-2 font-semibold">Экономия, ₽/год</th>
              {hasPenalty && <th className="px-4 py-2 font-semibold text-[color:var(--warning-fg)]">Штраф</th>}
              {hasPenalty && <th className="px-4 py-2 font-semibold">Эфф. экономия</th>}
              {hasCO2 && <th className="px-4 py-2 font-semibold">CO₂, т/год</th>}
              <th className="px-4 py-2 font-semibold">Окупаемость</th>
              <th className="px-4 py-2 font-semibold">NPV</th>
              <th className="px-4 py-2 font-semibold">Приоритет</th>
            </tr>
          </thead>
          <tbody>
            {assessment.measureResults.map((entry) => (
              <tr
                key={entry.measureId}
                className={`border-t border-[color:var(--border-soft)] align-top ${entry.isRecommended ? "bg-[color:var(--success-bg)]/40" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5 font-medium text-[color:var(--text-base)]">
                    <span>{entry.measureName}</span>
                    {entry.isRecommended ? <Badge tone="success">Рекомендуется</Badge> : null}
                    <span className={qualityBadgeClass(entry.dataQualityLevel)}>{qualityLabel(entry.dataQualityLevel)}</span>
                  </div>
                  {entry.status !== "calculated" && (
                    <div className="mt-0.5 text-xs text-[color:var(--text-muted)]">Недостаточно данных</div>
                  )}
                </td>
                <td className="px-4 py-3 text-[color:var(--text-soft)]">{entry.zoneLabel}</td>
                <td className="px-4 py-3 tabular-nums">{entry.area_m2 > 0 ? formatArea(entry.area_m2) : "комплекс"}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(entry.totalCost_RUB)}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(entry.annualSaving_RUB)}</td>
                {hasPenalty && (
                  <td className="px-4 py-3 tabular-nums text-[color:var(--warning-fg)]">
                    {entry.contractPenalty_RUB > 0 ? `−${formatCurrency(entry.contractPenalty_RUB)}` : "—"}
                  </td>
                )}
                {hasPenalty && (
                  <td className="px-4 py-3 tabular-nums font-medium">
                    {formatCurrency(entry.effectiveAnnualSaving_RUB)}
                  </td>
                )}
                {hasCO2 && (
                  <td className="px-4 py-3 tabular-nums text-[color:var(--accent-base)]">
                    {entry.savedCO2_tCO2_year !== null
                      ? formatNumber(entry.savedCO2_tCO2_year, { maximumFractionDigits: 2 })
                      : "—"}
                  </td>
                )}
                <td className="px-4 py-3 tabular-nums">{formatPayback(entry.payback_years)}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(entry.npv_RUB)}</td>
                <td className="px-4 py-3">
                  <span className={priorityBadgeClass(entry.priorityLevel)}>{entry.priorityLevel}</span>
                  <div className="mt-0.5 text-xs text-[color:var(--text-soft)]">
                    {formatNumber(entry.priorityScorePercent, { maximumFractionDigits: 0 })} / 100
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
        <FormulaTooltip title={info.title} meaning={info.meaning} formula={info.formula} inputs={info.inputs} notes={info.notes} />
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

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <p className="mb-3 text-sm font-semibold text-[color:var(--text-base)]">{title}</p>
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

function priorityBadgeClass(level: string): string {
  if (level === "очень высокий") return "inline-block rounded-full bg-[color:var(--success-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--success-fg)]";
  if (level === "высокий") return "inline-block rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent-base)]";
  if (level === "средний") return "inline-block rounded-full bg-[color:var(--warning-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--warning-fg)]";
  return "inline-block rounded-full bg-[color:var(--surface-overlay)] px-2 py-0.5 text-xs font-semibold text-[color:var(--text-soft)]";
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

// ─── Энергокласс ────────────────────────────────────────────────────────────

function energyClassBadgeClass(cls: string): string {
  if (cls === "А++" || cls === "А+" || cls === "А") {
    return "inline-block rounded-full bg-[color:var(--success-bg)] border border-[color:var(--success-border)] px-3 py-1 text-sm font-bold text-[color:var(--success-fg)]";
  }
  if (cls === "В") {
    return "inline-block rounded-full bg-[color:var(--accent-soft)] border border-[color:var(--accent-muted)] px-3 py-1 text-sm font-bold text-[color:var(--accent-base)]";
  }
  if (cls === "С") {
    return "inline-block rounded-full bg-[color:var(--surface-overlay)] border border-[color:var(--border-soft)] px-3 py-1 text-sm font-bold text-[color:var(--text-base)]";
  }
  if (cls === "D" || cls === "E") {
    return "inline-block rounded-full bg-[color:var(--warning-bg)] border border-[color:var(--warning-border)] px-3 py-1 text-sm font-bold text-[color:var(--warning-fg)]";
  }
  return "inline-block rounded-full bg-[color:var(--error-bg)] border border-[color:var(--error-border)] px-3 py-1 text-sm font-bold text-[color:var(--error-fg)]";
}

function EnergyClassSection({ summary }: { summary: EconomicAssessmentSummary }) {
  const {
    energyClassBefore,
    energyClassAfter,
    specificHeatConsumption_kWh_m2,
    specificHeatConsumptionAfter_kWh_m2,
    sp50EnergyNorm_kWh_m2,
    sp50EnergyComplies,
  } = summary;

  if (!energyClassBefore && specificHeatConsumption_kWh_m2 === null) return null;

  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3">
      <div className="mb-3 flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Энергоэффективность по SP50</p>
        <FormulaTooltip
          title="Класс энергоэффективности SP50"
          meaning="По SP50.13330.2022 здания классифицируются от А++ (наиболее эффективные) до G. Класс определяется по отклонению удельного расхода тепла от нормативного значения. А++ < −60 %, А+ < −45 %, А < −30 %, В < −10 %, С < +5 %, D < +25 %, E < +50 %, F < +75 %, G ≥ +75 %."
          formula="Δ = (q_факт − q_норм) / q_норм × 100 %"
        />
      </div>
      <div className="flex flex-wrap items-end gap-6">
        {specificHeatConsumption_kWh_m2 !== null && (
          <div>
            <p className="mb-1 text-xs text-[color:var(--text-muted)]">Расход (текущий)</p>
            <p className="text-base font-semibold text-[color:var(--text-base)]">
              {formatNumber(specificHeatConsumption_kWh_m2, { maximumFractionDigits: 1 })} кВт·ч/м²·год
            </p>
          </div>
        )}
        {specificHeatConsumptionAfter_kWh_m2 !== null && (
          <div>
            <p className="mb-1 text-xs text-[color:var(--text-muted)]">Расход (после пакета)</p>
            <p className="text-base font-semibold text-[color:var(--success-fg)]">
              {formatNumber(specificHeatConsumptionAfter_kWh_m2, { maximumFractionDigits: 1 })} кВт·ч/м²·год
            </p>
          </div>
        )}
        {sp50EnergyNorm_kWh_m2 !== null && (
          <div>
            <p className="mb-1 text-xs text-[color:var(--text-muted)]">Норматив SP50</p>
            <p className="text-base font-semibold text-[color:var(--text-soft)]">
              {formatNumber(sp50EnergyNorm_kWh_m2, { maximumFractionDigits: 1 })} кВт·ч/м²·год
            </p>
          </div>
        )}
        {energyClassBefore && (
          <div>
            <p className="mb-1 text-xs text-[color:var(--text-muted)]">Класс ДО</p>
            <span className={energyClassBadgeClass(energyClassBefore)}>{energyClassBefore}</span>
          </div>
        )}
        {energyClassAfter && energyClassAfter !== energyClassBefore && (
          <>
            <p className="mb-1 text-xl text-[color:var(--text-soft)]">→</p>
            <div>
              <p className="mb-1 text-xs text-[color:var(--text-muted)]">Класс ПОСЛЕ</p>
              <span className={energyClassBadgeClass(energyClassAfter)}>{energyClassAfter}</span>
            </div>
          </>
        )}
        {sp50EnergyComplies !== null && (
          <div>
            <p className="mb-1 text-xs text-[color:var(--text-muted)]">Норматив SP50</p>
            <p className={`text-sm font-semibold ${sp50EnergyComplies ? "text-[color:var(--success-fg)]" : "text-[color:var(--warning-fg)]"}`}>
              {sp50EnergyComplies ? "Соответствует ✓" : "Не соответствует ✗"}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Анализ чувствительности ─────────────────────────────────────────────────

function SensitivitySection({
  summary,
  discountedPayback,
  annualTariffGrowthPercent,
  discountRatePercent,
}: {
  summary: EconomicAssessmentSummary;
  discountedPayback: number | null;
  annualTariffGrowthPercent: number;
  discountRatePercent: number;
}) {
  const { paybackAtZeroGrowth_years, paybackAtHighGrowth_years, packageCost_RUB, packageEffectiveAnnualSaving_RUB } = summary;
  if (packageCost_RUB <= 0 || packageEffectiveAnnualSaving_RUB <= 0) return null;

  const rows: Array<{ scenario: string; growth: string; discount: string; payback: number | null }> = [
    {
      scenario: "Без роста тарифа",
      growth: "0 %",
      discount: "0 %",
      payback: paybackAtZeroGrowth_years,
    },
    {
      scenario: `Базовый (рост ${annualTariffGrowthPercent} %, дисконт ${discountRatePercent} %)`,
      growth: `${annualTariffGrowthPercent} %`,
      discount: `${discountRatePercent} %`,
      payback: discountedPayback,
    },
    {
      scenario: "Ускоренный рост тарифа 10 %/год",
      growth: "10 %",
      discount: "0 %",
      payback: paybackAtHighGrowth_years,
    },
  ];

  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Анализ чувствительности окупаемости</p>
        <FormulaTooltip
          title="Чувствительность к росту тарифа"
          meaning="Показывает, как срок окупаемости меняется при разных предположениях о динамике энергетических тарифов. Ускоренный рост тарифа сокращает срок окупаемости — мероприятия выгоднее."
          formula="DPP: ΣCF_t/(1+r)^t ≥ CAPEX при t = DPP"
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-[color:var(--text-soft)]">
              <th className="px-4 py-2 font-semibold">Сценарий</th>
              <th className="px-4 py-2 font-semibold">Рост тарифа</th>
              <th className="px-4 py-2 font-semibold">Ставка дискр.</th>
              <th className="px-4 py-2 font-semibold">Срок окупаемости</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.scenario} className="border-t border-[color:var(--border-soft)]">
                <td className="px-4 py-2 text-[color:var(--text-base)]">{row.scenario}</td>
                <td className="px-4 py-2 tabular-nums text-[color:var(--text-soft)]">{row.growth}</td>
                <td className="px-4 py-2 tabular-nums text-[color:var(--text-soft)]">{row.discount}</td>
                <td className={`px-4 py-2 tabular-nums font-semibold ${paybackColor(row.payback)}`}>
                  {formatPayback(row.payback)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Поэтапные рекомендации ───────────────────────────────────────────────────

function StagedRecommendationsSection({ measureResults }: { measureResults: EconomicAssessmentResult["measureResults"] }) {
  const calculated = measureResults.filter((entry) => entry.status === "calculated");
  if (calculated.length === 0) return null;

  const quick = calculated.filter((entry) => entry.payback_years !== null && entry.payback_years < 5);
  const medium = calculated.filter((entry) => entry.payback_years !== null && entry.payback_years >= 5 && entry.payback_years < 15);
  const strategic = calculated.filter(
    (entry) =>
      entry.payback_years === null ||
      entry.payback_years >= 15 ||
      (entry.comfortJustified && !entry.economicallyPositive)
  );

  if (quick.length === 0 && medium.length === 0 && strategic.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <div className="mb-4 flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Поэтапная реализация</p>
        <FormulaTooltip
          title="Приоритизация по срокам окупаемости"
          meaning="Мероприятия сгруппированы в три волны: быстрые (до 5 лет) реализуются первыми и финансируют следующие этапы; среднесрочные (5–15 лет) — плановая модернизация; стратегические — фундаментальные улучшения с длительным экономическим эффектом."
        />
      </div>
      <div className="space-y-4">
        {quick.length > 0 && (
          <StageTier
            label="Этап 1 — Быстрые меры"
            badge="до 5 лет"
            badgeTone="success"
            description="Реализуются первыми, экономия финансирует следующие этапы."
            items={quick}
          />
        )}
        {medium.length > 0 && (
          <StageTier
            label="Этап 2 — Плановая модернизация"
            badge="5–15 лет"
            badgeTone="warning"
            description="Выполняются в плановый период технического обслуживания здания."
            items={medium}
          />
        )}
        {strategic.length > 0 && (
          <StageTier
            label="Этап 3 — Стратегические меры"
            badge="> 15 лет или обоснование по комфорту"
            badgeTone="neutral"
            description="Капитальные мероприятия с длительным сроком эффекта или ценностью для комфорта и безопасности."
            items={strategic}
          />
        )}
      </div>
    </section>
  );
}

function StageTier({
  label,
  badge,
  badgeTone,
  description,
  items,
}: {
  label: string;
  badge: string;
  badgeTone: "success" | "warning" | "neutral";
  description: string;
  items: EconomicAssessmentResult["measureResults"];
}) {
  const badgeClass =
    badgeTone === "success"
      ? "rounded-full bg-[color:var(--success-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--success-fg)]"
      : badgeTone === "warning"
        ? "rounded-full bg-[color:var(--warning-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--warning-fg)]"
        : "rounded-full bg-[color:var(--surface-overlay)] px-2 py-0.5 text-xs font-semibold text-[color:var(--text-soft)]";

  return (
    <div className="rounded-xl border border-[color:var(--border-soft)] p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">{label}</p>
        <span className={badgeClass}>{badge}</span>
      </div>
      <p className="mb-2 text-xs text-[color:var(--text-muted)]">{description}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((entry) => (
          <div
            key={entry.measureId}
            className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-xs"
          >
            <span className="font-medium text-[color:var(--text-base)]">{entry.measureName}</span>
            <span className="ml-2 text-[color:var(--text-soft)]">{formatPayback(entry.payback_years)}</span>
            {entry.annualSaving_RUB > 0 && (
              <span className="ml-2 text-[color:var(--success-fg)]">{formatCurrency(entry.annualSaving_RUB)}/год</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function formatCurrencyShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} М₽`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)} т₽`;
  return `${value} ₽`;
}

function paybackColor(years: number | null): string {
  if (years === null) return "text-[color:var(--text-muted)]";
  if (years < 5) return "text-[color:var(--success-fg)]";
  if (years < 15) return "text-[color:var(--warning-fg)]";
  return "text-[color:var(--error-fg)]";
}

export default ResultsEconomyTab;
