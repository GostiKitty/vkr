import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { buildDefaultEconomicScenario, calculateDiscountedPayback_years, runEconomicAssessment } from "../../core/economics/analysis";
import { Badge, EmptyState, FormulaTooltip, MetricInfoTooltip } from "../../shared/ui";
import { formatArea, formatEnergy, formatNumber } from "../../shared/utils/format";
import { resultsMetricInfo } from "./resultsMetricInfo";
const KWH_PER_GCAL = 1163;
/** Удельные выбросы CO₂ по умолчанию для каждого источника тепла, кг/кВт·ч */
const DEFAULT_CO2_FACTORS = {
    heat: 0.20,
    gas: 0.22,
    electricity: 0.35,
    unknown: 0.22,
};
const SCENARIO_OPTIONS = [
    { id: "comprehensive", label: "Комплексная модернизация" },
    { id: "fast_payback", label: "Быстрая окупаемость" },
    { id: "maximum_saving", label: "Максимальная экономия" },
    { id: "minimum_budget", label: "Минимальный бюджет" },
];
export function ResultsEconomyTab({ report, onOpenBuild }) {
    if (!report) {
        return (_jsxs("div", { className: "space-y-3", children: [_jsx(EmptyState, { title: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430", message: "\u0414\u043B\u044F \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043E\u0446\u0435\u043D\u043A\u0438 \u043D\u0443\u0436\u0435\u043D \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0438\u043B\u0438 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442 SP50. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442 \u0432 /build \u0438\u043B\u0438 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u0443\u0439\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435.", tone: "warning" }), onOpenBuild ? (_jsx("button", { type: "button", onClick: onOpenBuild, className: "ui-btn-secondary px-4 py-2 text-sm", children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C /build" })) : null] }));
    }
    return _jsx(EconomyAssessmentPanel, { report: report });
}
function EconomyAssessmentPanel({ report }) {
    const baseScenario = useMemo(() => buildDefaultEconomicScenario(report), [report]);
    const [scenarioMode, setScenarioMode] = useState(baseScenario.mode);
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
    const scenario = useMemo(() => ({
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
            heatPrice_RUB_kWh: heatingSource === "electricity"
                ? electricityTariff
                : heatingSource === "gas"
                    ? gasTariff > 0 ? gasTariff / (9.3 * 0.92) : 0
                    : heatTariff > 0
                        ? heatTariff / KWH_PER_GCAL
                        : 0,
        },
    }), [
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
    ]);
    const assessment = useMemo(() => runEconomicAssessment(report, scenario), [report, scenario]);
    const baseAnnualCost = useMemo(() => {
        const energy = assessment.summary.baseAnnualHeatingEnergy_kWh;
        if (!Number.isFinite(energy)) {
            return null;
        }
        const resolvedEnergy = energy;
        let tariffPerKwh;
        if (scenario.heatingEnergySource === "electricity") {
            tariffPerKwh = scenario.electricityTariffRubPerKwh;
        }
        else if (scenario.heatingEnergySource === "gas") {
            tariffPerKwh = (scenario.gasTariffRubPerM3 ?? 0) > 0
                ? scenario.gasTariffRubPerM3 / (9.3 * 0.92)
                : 0;
        }
        else {
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
        if (!Number.isFinite(cost) || !Number.isFinite(saving) || saving <= 0 || cost <= 0)
            return [];
        const data = [{ year: 0, cumulative: -Math.round(cost) }];
        let cum = -cost;
        for (let y = 1; y <= years; y++) {
            cum += saving * (1 + growth) ** (y - 1);
            data.push({ year: y, cumulative: Math.round(cum) });
        }
        return data;
    }, [assessment.summary.packageCost_RUB, assessment.summary.packageEffectiveAnnualSaving_RUB, scenario.annualTariffGrowthPercent, scenario.analysisPeriod_years]);
    const discountedPaybackYears = useMemo(() => calculateDiscountedPayback_years({
        cost_RUB: assessment.summary.packageCost_RUB,
        annualSaving_RUB: assessment.summary.packageEffectiveAnnualSaving_RUB,
        discountRate: scenario.discountRate ?? 0.1,
        annualTariffGrowthPercent: scenario.annualTariffGrowthPercent ?? 5,
        analysisPeriod_years: scenario.analysisPeriod_years,
    }), [assessment.summary.packageCost_RUB, assessment.summary.packageEffectiveAnnualSaving_RUB, scenario.discountRate, scenario.annualTariffGrowthPercent, scenario.analysisPeriod_years]);
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("h3", { className: "ui-heading-panel", children: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u043D\u0430 \u0431\u0430\u0437\u0435 SP50" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.payback })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-4", children: [_jsx(KpiPill, { label: "\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u044D\u043D\u0435\u0440\u0433\u0438\u0438", value: formatCurrency(baseAnnualCost), hint: `${formatEnergy(assessment.summary.baseAnnualHeatingEnergy_kWh, "кВт·ч/год")}`, info: resultsMetricInfo.cost }), _jsx(KpiPill, { label: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F (\u0432\u0430\u043B\u043E\u0432\u0430\u044F)", value: formatCurrency(assessment.summary.packageAnnualSaving_RUB), hint: `${formatNumber(assessment.summary.packageSavedEnergy_Gcal_year, { maximumFractionDigits: 2 })} Гкал/год`, info: resultsMetricInfo.saving }), assessment.summary.packageContractPenalty_RUB > 0 && (_jsx(KpiPill, { label: "\u0428\u0442\u0440\u0430\u0444 \u043F\u043E \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0443", value: `−${formatCurrency(assessment.summary.packageContractPenalty_RUB)}`, hint: "\u041D\u0435\u0434\u043E\u0431\u043E\u0440 \u0433\u0430\u0437\u0430 / \u043C\u0438\u043D. \u043F\u043B\u0430\u0442\u0451\u0436 \u0426\u0422", info: { title: "Штраф за недобор", meaning: "Часть экономии, которую потребитель всё равно платит по условиям договора поставки энергоресурса. Для газа применяется только когда экономия снижает потребление ниже договорного минимума.", formula: "Penalty = (Q_min − Q_actual) × tariff × penalty%" } })), _jsx(KpiPill, { label: "\u041E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C", value: formatPayback(assessment.summary.packagePayback_years), hint: assessment.summary.packagePaybackClass, info: resultsMetricInfo.payback }), _jsx(KpiPill, { label: "NPV", value: formatCurrency(assessment.summary.npv_RUB), hint: `${analysisPeriodYears} лет, с остат. стоим.`, info: resultsMetricInfo.npv }), assessment.summary.packageSavedCO2_tCO2_year !== null && (_jsx(KpiPill, { label: "\u0421\u043D\u0438\u0436\u0435\u043D\u0438\u0435 CO\u2082", value: `${formatNumber(assessment.summary.packageSavedCO2_tCO2_year, { maximumFractionDigits: 1 })} т/год`, hint: `фактор ${co2Factor} кг/кВт·ч`, info: { title: "Снижение выбросов CO₂", meaning: "Сокращение выбросов углекислого газа при реализации пакета мероприятий. Рассчитывается по удельному выбросу источника тепла.", formula: "CO₂ = ΔE_kWh/год × f_CO₂ / 1000, т/год", inputs: ["savedEnergy_kWh_year", "co2EmissionFactor_kgPerKWh"] } }))] }), _jsx(EnergyClassSection, { summary: assessment.summary }), _jsxs("div", { className: "grid gap-3 xl:grid-cols-4", children: [_jsxs("label", { className: "text-sm text-[color:var(--text-muted)]", children: ["\u0420\u0435\u0436\u0438\u043C \u043E\u0446\u0435\u043D\u043A\u0438", _jsx("select", { value: scenarioMode, onChange: (event) => setScenarioMode(event.target.value), className: "mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]", children: SCENARIO_OPTIONS.map((item) => (_jsx("option", { value: item.id, children: item.label }, item.id))) })] }), _jsxs("label", { className: "text-sm text-[color:var(--text-muted)]", children: ["\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0442\u0435\u043F\u043B\u0430", _jsxs("select", { value: heatingSource, onChange: (event) => {
                                    const src = event.target.value;
                                    setHeatingSource(src);
                                    setCo2Factor(DEFAULT_CO2_FACTORS[src] ?? 0.22);
                                }, className: "mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]", children: [_jsx("option", { value: "heat", children: "\u0426\u0435\u043D\u0442\u0440\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u0442\u0435\u043F\u043B\u043E\u0441\u043D\u0430\u0431\u0436\u0435\u043D\u0438\u0435" }), _jsx("option", { value: "gas", children: "\u0413\u0430\u0437\u043E\u0432\u044B\u0439 \u043A\u043E\u0442\u0451\u043B (\u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u043E\u0435)" }), _jsx("option", { value: "electricity", children: "\u042D\u043B\u0435\u043A\u0442\u0440\u043E\u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u0435" }), _jsx("option", { value: "unknown", children: "\u041D\u0435 \u0437\u0430\u0434\u0430\u043D" })] })] }), _jsx(NumberField, { label: "\u0422\u0430\u0440\u0438\u0444 \u043D\u0430 \u0442\u0435\u043F\u043B\u043E (\u0426\u0422), \u20BD/\u0413\u043A\u0430\u043B", value: heatTariff, step: 50, onChange: setHeatTariff }), _jsx(NumberField, { label: "\u0422\u0430\u0440\u0438\u0444 \u043D\u0430 \u0433\u0430\u0437, \u20BD/\u043C\u00B3", value: gasTariff, step: 0.1, onChange: setGasTariff }), _jsx(NumberField, { label: "\u0422\u0430\u0440\u0438\u0444 \u043D\u0430 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u044D\u043D\u0435\u0440\u0433\u0438\u044E, \u20BD/\u043A\u0412\u0442\u00B7\u0447", value: electricityTariff, step: 0.1, onChange: setElectricityTariff }), heatingSource === "gas" && (_jsx(NumberField, { label: "\u0428\u0442\u0440\u0430\u0444 \u0437\u0430 \u043D\u0435\u0434\u043E\u0431\u043E\u0440 \u0433\u0430\u0437\u0430, %", value: gasPenaltyPct, min: 0, step: 1, onChange: setGasPenaltyPct })), heatingSource === "heat" && (_jsx(NumberField, { label: "\u041C\u0438\u043D. \u043F\u043B\u0430\u0442\u0451\u0436 \u0426\u0422 (\u0431\u0435\u0437 \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u0430), %", value: heatMinFraction, min: 0, step: 1, onChange: setHeatMinFraction })), _jsx(NumberField, { label: "\u0412\u044B\u0431\u0440\u043E\u0441 CO\u2082, \u043A\u0433/\u043A\u0412\u0442\u00B7\u0447 \u0442\u0435\u043F\u043B\u0430", value: co2Factor, min: 0, step: 0.01, onChange: setCo2Factor }), _jsx(NumberField, { label: "\u0420\u0435\u0433\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u043A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442", value: regionalFactor, min: 0.1, step: 0.05, onChange: setRegionalFactor }), _jsx(NumberField, { label: "\u0421\u0442\u0430\u0432\u043A\u0430 \u0434\u0438\u0441\u043A\u043E\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F, %", value: discountRatePercent, min: 0, step: 0.5, onChange: setDiscountRatePercent }), _jsx(NumberField, { label: "\u0420\u043E\u0441\u0442 \u0442\u0430\u0440\u0438\u0444\u0430, %/\u0433\u043E\u0434", value: annualTariffGrowthPercent, min: 0, step: 0.5, onChange: setAnnualTariffGrowthPercent }), _jsx(NumberField, { label: "\u041E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435, \u20BD/\u0433\u043E\u0434", value: annualMaintenanceCost, min: 0, step: 1000, onChange: setAnnualMaintenanceCost }), _jsx(NumberField, { label: "\u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442 \u0430\u043D\u0430\u043B\u0438\u0437\u0430, \u043B\u0435\u0442", value: analysisPeriodYears, min: 1, step: 1, integer: true, onChange: setAnalysisPeriodYears })] }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-2", children: [_jsx(ChartPanel, { title: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438 \u043F\u043E \u0437\u043E\u043D\u0430\u043C", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: zoneChartData, layout: "vertical", margin: { top: 8, right: 12, left: 12, bottom: 8 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--chart-grid)" }), _jsx(XAxis, { type: "number" }), _jsx(YAxis, { type: "category", dataKey: "name", width: 160, tick: { fontSize: 11, fill: "var(--text-soft)" } }), _jsx(Tooltip, { formatter: (value) => [`${formatNumber(value, { maximumFractionDigits: 0 })} Вт`, "Теплопотери"], labelFormatter: (_, payload) => payload?.[0]?.payload?.fullName ?? "", contentStyle: tooltipStyle }), _jsx(Bar, { dataKey: "loss", fill: "var(--warning-border)", radius: [0, 8, 8, 0] })] }) }) }), _jsx(ChartPanel, { title: "\u0421\u0440\u043E\u043A \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0439", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: paybackChartData, margin: { top: 8, right: 12, left: 12, bottom: 56 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--chart-grid)" }), _jsx(XAxis, { dataKey: "name", angle: -30, textAnchor: "end", interval: 0, height: 88, tick: { fontSize: 11, fill: "var(--text-soft)" } }), _jsx(YAxis, { tick: { fill: "var(--text-soft)", fontSize: 11 } }), _jsx(Tooltip, { formatter: (value) => [`${formatNumber(value, { maximumFractionDigits: 1 })} лет`, "Окупаемость"], labelFormatter: (_, payload) => payload?.[0]?.payload?.fullName ?? "", contentStyle: tooltipStyle }), _jsx(Bar, { dataKey: "payback", radius: [8, 8, 0, 0], children: paybackChartData.map((entry) => (_jsx(Cell, { fill: entry.payback <= 8 ? "#22c55e" : entry.payback <= 15 ? "#f59e0b" : "#ef4444" }, entry.name))) })] }) }) })] }), breakevenData.length > 1 && (_jsx(ChartPanel, { title: "\u041D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043D\u044B\u0439 \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0439 \u043F\u043E\u0442\u043E\u043A (\u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C)", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: breakevenData, margin: { top: 8, right: 24, left: 12, bottom: 8 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--chart-grid)" }), _jsx(XAxis, { dataKey: "year", tick: { fontSize: 11, fill: "var(--text-soft)" }, label: { value: "лет", position: "insideRight", offset: -4, fontSize: 11 } }), _jsx(YAxis, { tickFormatter: (v) => formatCurrencyShort(v), tick: { fill: "var(--text-soft)", fontSize: 11 } }), _jsx(ReferenceLine, { y: 0, stroke: "var(--success-border)", strokeWidth: 2, strokeDasharray: "4 4" }), _jsx(Tooltip, { formatter: (value) => [formatCurrency(value), "Накоплено"], labelFormatter: (label) => `Год ${label}`, contentStyle: tooltipStyle }), _jsx(Line, { type: "monotone", dataKey: "cumulative", stroke: "var(--accent-base)", strokeWidth: 2, dot: false })] }) }) })), _jsx(MeasuresTable, { assessment: assessment }), _jsx(SensitivitySection, { summary: assessment.summary, discountedPayback: discountedPaybackYears, annualTariffGrowthPercent: annualTariffGrowthPercent, discountRatePercent: discountRatePercent }), _jsx(StagedRecommendationsSection, { measureResults: assessment.measureResults })] }));
}
function MeasuresTable({ assessment }) {
    const hasPenalty = assessment.summary.packageContractPenalty_RUB > 0;
    const hasCO2 = assessment.measureResults.some((e) => e.savedCO2_tCO2_year !== null);
    return (_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F" }), _jsx(FormulaTooltip, { title: "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0439", meaning: "\u0421\u0432\u043E\u0434\u043D\u044B\u0439 \u0440\u0435\u0439\u0442\u0438\u043D\u0433 \u0441\u043E\u0447\u0435\u0442\u0430\u0435\u0442 \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u044E, \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C, \u0434\u043E\u043B\u044E \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u044C, \u043A\u043E\u043C\u0444\u043E\u0440\u0442 \u0438 \u0440\u0438\u0441\u043A\u0438. NPV \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442 \u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u0443\u044E \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C (\u0441\u0440\u043E\u043A \u0441\u043B\u0443\u0436\u0431\u044B \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F > \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430 \u0430\u043D\u0430\u043B\u0438\u0437\u0430).", formula: "Priority = f(saving, payback, NPV, heatLossShare, comfort, risk)" })] }), _jsx("div", { className: "overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]", children: _jsxs("table", { className: "w-full min-w-[960px] text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0417\u043E\u043D\u0430" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041F\u043B\u043E\u0449\u0430\u0434\u044C" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "CAPEX" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F, \u20BD/\u0433\u043E\u0434" }), hasPenalty && _jsx("th", { className: "px-4 py-2 font-semibold text-[color:var(--warning-fg)]", children: "\u0428\u0442\u0440\u0430\u0444" }), hasPenalty && _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u042D\u0444\u0444. \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u044F" }), hasCO2 && _jsx("th", { className: "px-4 py-2 font-semibold", children: "CO\u2082, \u0442/\u0433\u043E\u0434" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u044C" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "NPV" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442" })] }) }), _jsx("tbody", { children: assessment.measureResults.map((entry) => (_jsxs("tr", { className: `border-t border-[color:var(--border-soft)] align-top ${entry.isRecommended ? "bg-[color:var(--success-bg)]/40" : ""}`, children: [_jsxs("td", { className: "px-4 py-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-1.5 font-medium text-[color:var(--text-base)]", children: [_jsx("span", { children: entry.measureName }), entry.isRecommended ? _jsx(Badge, { tone: "success", children: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F" }) : null, _jsx("span", { className: qualityBadgeClass(entry.dataQualityLevel), children: qualityLabel(entry.dataQualityLevel) })] }), entry.status !== "calculated" && (_jsx("div", { className: "mt-0.5 text-xs text-[color:var(--text-muted)]", children: "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0434\u0430\u043D\u043D\u044B\u0445" }))] }), _jsx("td", { className: "px-4 py-3 text-[color:var(--text-soft)]", children: entry.zoneLabel }), _jsx("td", { className: "px-4 py-3 tabular-nums", children: entry.area_m2 > 0 ? formatArea(entry.area_m2) : "комплекс" }), _jsx("td", { className: "px-4 py-3 tabular-nums", children: formatCurrency(entry.totalCost_RUB) }), _jsx("td", { className: "px-4 py-3 tabular-nums", children: formatCurrency(entry.annualSaving_RUB) }), hasPenalty && (_jsx("td", { className: "px-4 py-3 tabular-nums text-[color:var(--warning-fg)]", children: entry.contractPenalty_RUB > 0 ? `−${formatCurrency(entry.contractPenalty_RUB)}` : "—" })), hasPenalty && (_jsx("td", { className: "px-4 py-3 tabular-nums font-medium", children: formatCurrency(entry.effectiveAnnualSaving_RUB) })), hasCO2 && (_jsx("td", { className: "px-4 py-3 tabular-nums text-[color:var(--accent-base)]", children: entry.savedCO2_tCO2_year !== null
                                            ? formatNumber(entry.savedCO2_tCO2_year, { maximumFractionDigits: 2 })
                                            : "—" })), _jsx("td", { className: "px-4 py-3 tabular-nums", children: formatPayback(entry.payback_years) }), _jsx("td", { className: "px-4 py-3 tabular-nums", children: formatCurrency(entry.npv_RUB) }), _jsxs("td", { className: "px-4 py-3", children: [_jsx("span", { className: priorityBadgeClass(entry.priorityLevel), children: entry.priorityLevel }), _jsxs("div", { className: "mt-0.5 text-xs text-[color:var(--text-soft)]", children: [formatNumber(entry.priorityScorePercent, { maximumFractionDigits: 0 }), " / 100"] })] })] }, entry.measureId))) })] }) })] }));
}
function KpiPill({ label, value, hint, info, }) {
    return (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: label }), _jsx(FormulaTooltip, { title: info.title, meaning: info.meaning, formula: info.formula, inputs: info.inputs, notes: info.notes })] }), _jsx("p", { className: "mt-1 text-lg font-semibold text-[color:var(--text-base)]", children: value }), hint ? _jsx("p", { className: "text-xs text-[color:var(--text-muted)]", children: hint }) : null] }));
}
function NumberField({ label, value, onChange, min = 0, step = 1, integer = false, }) {
    return (_jsxs("label", { className: "text-sm text-[color:var(--text-muted)]", children: [label, _jsx("input", { type: "number", min: min, step: step, value: value, onChange: (event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) {
                        return;
                    }
                    onChange(integer ? Math.max(min, Math.round(next)) : Math.max(min, next));
                }, className: "mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]" })] }));
}
function ChartPanel({ title, children }) {
    return (_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsx("p", { className: "mb-3 text-sm font-semibold text-[color:var(--text-base)]", children: title }), _jsx("div", { className: "h-80", children: children })] }));
}
function shortenLabel(value) {
    return value.length > 18 ? `${value.slice(0, 18).trimEnd()}…` : value;
}
function formatCurrency(value) {
    if (value == null || !Number.isFinite(value)) {
        return "—";
    }
    return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0,
    }).format(value);
}
function formatPayback(value) {
    if (value == null || !Number.isFinite(value)) {
        return "—";
    }
    return `${formatNumber(value, { maximumFractionDigits: 1 })} лет`;
}
function qualityLabel(value) {
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
function priorityBadgeClass(level) {
    if (level === "очень высокий")
        return "inline-block rounded-full bg-[color:var(--success-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--success-fg)]";
    if (level === "высокий")
        return "inline-block rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent-base)]";
    if (level === "средний")
        return "inline-block rounded-full bg-[color:var(--warning-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--warning-fg)]";
    return "inline-block rounded-full bg-[color:var(--surface-overlay)] px-2 py-0.5 text-xs font-semibold text-[color:var(--text-soft)]";
}
function qualityBadgeClass(value) {
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
function energyClassBadgeClass(cls) {
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
function EnergyClassSection({ summary }) {
    const { energyClassBefore, energyClassAfter, specificHeatConsumption_kWh_m2, specificHeatConsumptionAfter_kWh_m2, sp50EnergyNorm_kWh_m2, sp50EnergyComplies, } = summary;
    if (!energyClassBefore && specificHeatConsumption_kWh_m2 === null)
        return null;
    return (_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3", children: [_jsxs("div", { className: "mb-3 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u042D\u043D\u0435\u0440\u0433\u043E\u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u043F\u043E SP50" }), _jsx(FormulaTooltip, { title: "\u041A\u043B\u0430\u0441\u0441 \u044D\u043D\u0435\u0440\u0433\u043E\u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438 SP50", meaning: "\u041F\u043E SP50.13330.2022 \u0437\u0434\u0430\u043D\u0438\u044F \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u0446\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u043E\u0442 \u0410++ (\u043D\u0430\u0438\u0431\u043E\u043B\u0435\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u044B\u0435) \u0434\u043E G. \u041A\u043B\u0430\u0441\u0441 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u043E \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044E \u0443\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u0440\u0430\u0441\u0445\u043E\u0434\u0430 \u0442\u0435\u043F\u043B\u0430 \u043E\u0442 \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F. \u0410++ < \u221260 %, \u0410+ < \u221245 %, \u0410 < \u221230 %, \u0412 < \u221210 %, \u0421 < +5 %, D < +25 %, E < +50 %, F < +75 %, G \u2265 +75 %.", formula: "\u0394 = (q_\u0444\u0430\u043A\u0442 \u2212 q_\u043D\u043E\u0440\u043C) / q_\u043D\u043E\u0440\u043C \u00D7 100 %" })] }), _jsxs("div", { className: "flex flex-wrap items-end gap-6", children: [specificHeatConsumption_kWh_m2 !== null && (_jsxs("div", { children: [_jsx("p", { className: "mb-1 text-xs text-[color:var(--text-muted)]", children: "\u0420\u0430\u0441\u0445\u043E\u0434 (\u0442\u0435\u043A\u0443\u0449\u0438\u0439)" }), _jsxs("p", { className: "text-base font-semibold text-[color:var(--text-base)]", children: [formatNumber(specificHeatConsumption_kWh_m2, { maximumFractionDigits: 1 }), " \u043A\u0412\u0442\u00B7\u0447/\u043C\u00B2\u00B7\u0433\u043E\u0434"] })] })), specificHeatConsumptionAfter_kWh_m2 !== null && (_jsxs("div", { children: [_jsx("p", { className: "mb-1 text-xs text-[color:var(--text-muted)]", children: "\u0420\u0430\u0441\u0445\u043E\u0434 (\u043F\u043E\u0441\u043B\u0435 \u043F\u0430\u043A\u0435\u0442\u0430)" }), _jsxs("p", { className: "text-base font-semibold text-[color:var(--success-fg)]", children: [formatNumber(specificHeatConsumptionAfter_kWh_m2, { maximumFractionDigits: 1 }), " \u043A\u0412\u0442\u00B7\u0447/\u043C\u00B2\u00B7\u0433\u043E\u0434"] })] })), sp50EnergyNorm_kWh_m2 !== null && (_jsxs("div", { children: [_jsx("p", { className: "mb-1 text-xs text-[color:var(--text-muted)]", children: "\u041D\u043E\u0440\u043C\u0430\u0442\u0438\u0432 SP50" }), _jsxs("p", { className: "text-base font-semibold text-[color:var(--text-soft)]", children: [formatNumber(sp50EnergyNorm_kWh_m2, { maximumFractionDigits: 1 }), " \u043A\u0412\u0442\u00B7\u0447/\u043C\u00B2\u00B7\u0433\u043E\u0434"] })] })), energyClassBefore && (_jsxs("div", { children: [_jsx("p", { className: "mb-1 text-xs text-[color:var(--text-muted)]", children: "\u041A\u043B\u0430\u0441\u0441 \u0414\u041E" }), _jsx("span", { className: energyClassBadgeClass(energyClassBefore), children: energyClassBefore })] })), energyClassAfter && energyClassAfter !== energyClassBefore && (_jsxs(_Fragment, { children: [_jsx("p", { className: "mb-1 text-xl text-[color:var(--text-soft)]", children: "\u2192" }), _jsxs("div", { children: [_jsx("p", { className: "mb-1 text-xs text-[color:var(--text-muted)]", children: "\u041A\u043B\u0430\u0441\u0441 \u041F\u041E\u0421\u041B\u0415" }), _jsx("span", { className: energyClassBadgeClass(energyClassAfter), children: energyClassAfter })] })] })), sp50EnergyComplies !== null && (_jsxs("div", { children: [_jsx("p", { className: "mb-1 text-xs text-[color:var(--text-muted)]", children: "\u041D\u043E\u0440\u043C\u0430\u0442\u0438\u0432 SP50" }), _jsx("p", { className: `text-sm font-semibold ${sp50EnergyComplies ? "text-[color:var(--success-fg)]" : "text-[color:var(--warning-fg)]"}`, children: sp50EnergyComplies ? "Соответствует ✓" : "Не соответствует ✗" })] }))] })] }));
}
// ─── Анализ чувствительности ─────────────────────────────────────────────────
function SensitivitySection({ summary, discountedPayback, annualTariffGrowthPercent, discountRatePercent, }) {
    const { paybackAtZeroGrowth_years, paybackAtHighGrowth_years, packageCost_RUB, packageEffectiveAnnualSaving_RUB } = summary;
    if (packageCost_RUB <= 0 || packageEffectiveAnnualSaving_RUB <= 0)
        return null;
    const rows = [
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
    return (_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0410\u043D\u0430\u043B\u0438\u0437 \u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438" }), _jsx(FormulaTooltip, { title: "\u0427\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043A \u0440\u043E\u0441\u0442\u0443 \u0442\u0430\u0440\u0438\u0444\u0430", meaning: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442, \u043A\u0430\u043A \u0441\u0440\u043E\u043A \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043F\u0440\u0438 \u0440\u0430\u0437\u043D\u044B\u0445 \u043F\u0440\u0435\u0434\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u0445 \u043E \u0434\u0438\u043D\u0430\u043C\u0438\u043A\u0435 \u044D\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0442\u0430\u0440\u0438\u0444\u043E\u0432. \u0423\u0441\u043A\u043E\u0440\u0435\u043D\u043D\u044B\u0439 \u0440\u043E\u0441\u0442 \u0442\u0430\u0440\u0438\u0444\u0430 \u0441\u043E\u043A\u0440\u0430\u0449\u0430\u0435\u0442 \u0441\u0440\u043E\u043A \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438 \u2014 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F \u0432\u044B\u0433\u043E\u0434\u043D\u0435\u0435.", formula: "DPP: \u03A3CF_t/(1+r)^t \u2265 CAPEX \u043F\u0440\u0438 t = DPP" })] }), _jsx("div", { className: "overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0420\u043E\u0441\u0442 \u0442\u0430\u0440\u0438\u0444\u0430" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0421\u0442\u0430\u0432\u043A\u0430 \u0434\u0438\u0441\u043A\u0440." }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0421\u0440\u043E\u043A \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438" })] }) }), _jsx("tbody", { children: rows.map((row) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "px-4 py-2 text-[color:var(--text-base)]", children: row.scenario }), _jsx("td", { className: "px-4 py-2 tabular-nums text-[color:var(--text-soft)]", children: row.growth }), _jsx("td", { className: "px-4 py-2 tabular-nums text-[color:var(--text-soft)]", children: row.discount }), _jsx("td", { className: `px-4 py-2 tabular-nums font-semibold ${paybackColor(row.payback)}`, children: formatPayback(row.payback) })] }, row.scenario))) })] }) })] }));
}
// ─── Поэтапные рекомендации ───────────────────────────────────────────────────
function StagedRecommendationsSection({ measureResults }) {
    const calculated = measureResults.filter((entry) => entry.status === "calculated");
    if (calculated.length === 0)
        return null;
    const quick = calculated.filter((entry) => entry.payback_years !== null && entry.payback_years < 5);
    const medium = calculated.filter((entry) => entry.payback_years !== null && entry.payback_years >= 5 && entry.payback_years < 15);
    const strategic = calculated.filter((entry) => entry.payback_years === null ||
        entry.payback_years >= 15 ||
        (entry.comfortJustified && !entry.economicallyPositive));
    if (quick.length === 0 && medium.length === 0 && strategic.length === 0)
        return null;
    return (_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-4 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041F\u043E\u044D\u0442\u0430\u043F\u043D\u0430\u044F \u0440\u0435\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F" }), _jsx(FormulaTooltip, { title: "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u043E \u0441\u0440\u043E\u043A\u0430\u043C \u043E\u043A\u0443\u043F\u0430\u0435\u043C\u043E\u0441\u0442\u0438", meaning: "\u041C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F \u0441\u0433\u0440\u0443\u043F\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u0432 \u0442\u0440\u0438 \u0432\u043E\u043B\u043D\u044B: \u0431\u044B\u0441\u0442\u0440\u044B\u0435 (\u0434\u043E 5 \u043B\u0435\u0442) \u0440\u0435\u0430\u043B\u0438\u0437\u0443\u044E\u0442\u0441\u044F \u043F\u0435\u0440\u0432\u044B\u043C\u0438 \u0438 \u0444\u0438\u043D\u0430\u043D\u0441\u0438\u0440\u0443\u044E\u0442 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u044D\u0442\u0430\u043F\u044B; \u0441\u0440\u0435\u0434\u043D\u0435\u0441\u0440\u043E\u0447\u043D\u044B\u0435 (5\u201315 \u043B\u0435\u0442) \u2014 \u043F\u043B\u0430\u043D\u043E\u0432\u0430\u044F \u043C\u043E\u0434\u0435\u0440\u043D\u0438\u0437\u0430\u0446\u0438\u044F; \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u2014 \u0444\u0443\u043D\u0434\u0430\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u044F \u0441 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u043C \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u043C." })] }), _jsxs("div", { className: "space-y-4", children: [quick.length > 0 && (_jsx(StageTier, { label: "\u042D\u0442\u0430\u043F 1 \u2014 \u0411\u044B\u0441\u0442\u0440\u044B\u0435 \u043C\u0435\u0440\u044B", badge: "\u0434\u043E 5 \u043B\u0435\u0442", badgeTone: "success", description: "\u0420\u0435\u0430\u043B\u0438\u0437\u0443\u044E\u0442\u0441\u044F \u043F\u0435\u0440\u0432\u044B\u043C\u0438, \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u044F \u0444\u0438\u043D\u0430\u043D\u0441\u0438\u0440\u0443\u0435\u0442 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u044D\u0442\u0430\u043F\u044B.", items: quick })), medium.length > 0 && (_jsx(StageTier, { label: "\u042D\u0442\u0430\u043F 2 \u2014 \u041F\u043B\u0430\u043D\u043E\u0432\u0430\u044F \u043C\u043E\u0434\u0435\u0440\u043D\u0438\u0437\u0430\u0446\u0438\u044F", badge: "5\u201315 \u043B\u0435\u0442", badgeTone: "warning", description: "\u0412\u044B\u043F\u043E\u043B\u043D\u044F\u044E\u0442\u0441\u044F \u0432 \u043F\u043B\u0430\u043D\u043E\u0432\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u044F \u0437\u0434\u0430\u043D\u0438\u044F.", items: medium })), strategic.length > 0 && (_jsx(StageTier, { label: "\u042D\u0442\u0430\u043F 3 \u2014 \u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043C\u0435\u0440\u044B", badge: "> 15 \u043B\u0435\u0442 \u0438\u043B\u0438 \u043E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E \u043A\u043E\u043C\u0444\u043E\u0440\u0442\u0443", badgeTone: "neutral", description: "\u041A\u0430\u043F\u0438\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F \u0441 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0441\u0440\u043E\u043A\u043E\u043C \u044D\u0444\u0444\u0435\u043A\u0442\u0430 \u0438\u043B\u0438 \u0446\u0435\u043D\u043D\u043E\u0441\u0442\u044C\u044E \u0434\u043B\u044F \u043A\u043E\u043C\u0444\u043E\u0440\u0442\u0430 \u0438 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438.", items: strategic }))] })] }));
}
function StageTier({ label, badge, badgeTone, description, items, }) {
    const badgeClass = badgeTone === "success"
        ? "rounded-full bg-[color:var(--success-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--success-fg)]"
        : badgeTone === "warning"
            ? "rounded-full bg-[color:var(--warning-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--warning-fg)]"
            : "rounded-full bg-[color:var(--surface-overlay)] px-2 py-0.5 text-xs font-semibold text-[color:var(--text-soft)]";
    return (_jsxs("div", { className: "rounded-xl border border-[color:var(--border-soft)] p-3", children: [_jsxs("div", { className: "mb-1 flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: label }), _jsx("span", { className: badgeClass, children: badge })] }), _jsx("p", { className: "mb-2 text-xs text-[color:var(--text-muted)]", children: description }), _jsx("div", { className: "flex flex-wrap gap-2", children: items.map((entry) => (_jsxs("div", { className: "rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-xs", children: [_jsx("span", { className: "font-medium text-[color:var(--text-base)]", children: entry.measureName }), _jsx("span", { className: "ml-2 text-[color:var(--text-soft)]", children: formatPayback(entry.payback_years) }), entry.annualSaving_RUB > 0 && (_jsxs("span", { className: "ml-2 text-[color:var(--success-fg)]", children: [formatCurrency(entry.annualSaving_RUB), "/\u0433\u043E\u0434"] }))] }, entry.measureId))) })] }));
}
// ─── Утилиты ─────────────────────────────────────────────────────────────────
function formatCurrencyShort(value) {
    if (Math.abs(value) >= 1_000_000)
        return `${(value / 1_000_000).toFixed(1)} М₽`;
    if (Math.abs(value) >= 1_000)
        return `${(value / 1_000).toFixed(0)} т₽`;
    return `${value} ₽`;
}
function paybackColor(years) {
    if (years === null)
        return "text-[color:var(--text-muted)]";
    if (years < 5)
        return "text-[color:var(--success-fg)]";
    if (years < 15)
        return "text-[color:var(--warning-fg)]";
    return "text-[color:var(--error-fg)]";
}
export default ResultsEconomyTab;
