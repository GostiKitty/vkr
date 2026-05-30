import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Label, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { buildSensitivityFactors, getThermalMonteCarloTargetMetricDefinition, getThermalMonteCarloTargetMetricValues, THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C, } from "../../core/uncertainty/thermalMonteCarlo";
import { Badge, CollapsibleSection, EmptyState, MetricInfoTooltip } from "../../shared/ui";
import { formatEnergy, formatNumber, formatPercentage } from "../../shared/utils/format";
import { getRoomDisplayName } from "../../shared/utils/roomNames";
import { MonteCarloChart } from "./charts/MonteCarloChart";
import { MonteCarloScatterChart } from "./charts/MonteCarloScatterChart";
import { ThermalTimeSeriesChartBlock } from "./charts/ThermalTimeSeriesChartBlock";
import { resultsMetricInfo } from "./resultsMetricInfo";
import { MonteCarloRunControls } from "../scenarios/MonteCarloRunControls";
const ROOM_RISK_EMPTY_TEXT = "Риск по помещениям появится после накопления агрегатов в результате Monte Carlo.";
const DEFAULT_PEAK_MARGIN_FACTOR = 1.2;
const DEFAULT_ENERGY_GROWTH_FACTOR = 1.2;
export function MonteCarloResultsSection({ baseResult, baseOptions, buildingModel, climateLabel, monteCarloResult, onRunCalculation, }) {
    const roomNameMap = useMemo(() => {
        const map = new Map();
        buildingModel.rooms.forEach((room, index) => {
            map.set(room.id, getRoomDisplayName(room, index));
        });
        return map;
    }, [buildingModel.rooms]);
    const peakThresholdKW = useMemo(() => {
        if (!baseResult) {
            return null;
        }
        return roundValue(baseResult.summary.peakLoadKW * DEFAULT_PEAK_MARGIN_FACTOR, 2);
    }, [baseResult]);
    const [selectedTargetMetric, setSelectedTargetMetric] = useState("totalEnergyKWh");
    const selectedTargetMetricDefinition = useMemo(() => getThermalMonteCarloTargetMetricDefinition(selectedTargetMetric), [selectedTargetMetric]);
    const selectedTargetMetricValues = useMemo(() => monteCarloResult ? getThermalMonteCarloTargetMetricValues(monteCarloResult, selectedTargetMetric) : [], [monteCarloResult, selectedTargetMetric]);
    const selectedTargetMetricHasData = useMemo(() => selectedTargetMetricValues.some((value) => Number.isFinite(value)), [selectedTargetMetricValues]);
    const presentation = useMemo(() => {
        if (!monteCarloResult || !baseResult) {
            return null;
        }
        const sensitivity = buildSensitivityFactors(monteCarloResult.samples, selectedTargetMetricValues, baseOptions, selectedTargetMetric).sort((left, right) => right.valuePercent - left.valuePercent);
        const underheatingRisk = monteCarloResult.underheatingBelow20CProbability ??
            probabilityOf(monteCarloResult.scenarioSeries.minimumIndoorTemperatureC, (value) => value < THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C);
        const stabilityIndexPercent = underheatingRisk === null ? null : (1 - underheatingRisk) * 100;
        const peakExceedanceProbability = peakThresholdKW === null
            ? null
            : probabilityOf(monteCarloResult.scenarioSeries.peakLoadKW, (value) => value > peakThresholdKW);
        const energyGrowthProbability = probabilityOf(monteCarloResult.scenarioSeries.totalEnergyKWh, (value) => value > baseResult.summary.totalEnergyKWh * DEFAULT_ENERGY_GROWTH_FACTOR);
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
            .sort((left, right) => right.underheatingRisk - left.underheatingRisk ||
            left.minimumTemperatureP10C - right.minimumTemperatureP10C ||
            left.roomName.localeCompare(right.roomName));
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
        if (!pts?.length)
            return [];
        const baseTl = baseResult?.timeline ?? [];
        const baseMap = new Map();
        baseTl.forEach((pt) => {
            const totalKW = Object.values(pt.rooms).reduce((sum, r) => sum + (r.heatingPowerW ?? 0), 0) / 1000;
            baseMap.set(Math.round(pt.timeHours * 100), totalKW);
        });
        const getBase = (t) => {
            const key = Math.round(t * 100);
            if (baseMap.has(key))
                return baseMap.get(key);
            for (let d = 1; d <= 10; d++) {
                if (baseMap.has(key + d))
                    return baseMap.get(key + d);
                if (baseMap.has(key - d))
                    return baseMap.get(key - d);
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
    const runControls = (_jsxs(_Fragment, { children: [!baseResult ? (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]", children: [_jsx("span", { children: "\u0414\u043B\u044F \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0433\u043E \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u0435\u043D \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0440\u0430\u0441\u0447\u0451\u0442." }), onRunCalculation ? (_jsx("button", { type: "button", onClick: onRunCalculation, className: "ui-btn-primary whitespace-nowrap px-4 py-2 text-sm", children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442" })) : null] })) : null, _jsx(MonteCarloRunControls, {})] }));
    if (!monteCarloResult) {
        return (_jsxs("div", { className: "space-y-5", "data-testid": "monte-carlo-results-section", children: [runControls, _jsx(EmptyState, { title: "\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u043D\u044B\u0439 \u0430\u043D\u0430\u043B\u0438\u0437 \u0435\u0449\u0451 \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D", message: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0432\u044B\u0448\u0435 \u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 Monte Carlo \u043F\u043E\u0432\u0435\u0440\u0445 \u043D\u0435\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u0430\u0440\u043D\u043E\u0433\u043E RC-\u0440\u0430\u0441\u0447\u0451\u0442\u0430." }), _jsx(ThermalTimeSeriesChartBlock, { heatingDisplay: "raw", onRunCalculation: onRunCalculation })] }));
    }
    if (!baseResult || !presentation) {
        return (_jsxs("div", { className: "space-y-5", "data-testid": "monte-carlo-results-section", children: [runControls, _jsx(EmptyState, { title: "\u041D\u0435\u0442 \u0431\u0430\u0437\u043E\u0432\u043E\u0433\u043E RC-\u0440\u0430\u0441\u0447\u0451\u0442\u0430", message: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0431\u0430\u0437\u043E\u0432\u044B\u0439 RC-\u0440\u0430\u0441\u0447\u0451\u0442, \u0447\u0442\u043E\u0431\u044B \u0441\u0440\u0430\u0432\u043D\u0438\u0442\u044C \u0435\u0433\u043E \u0441 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435\u043C Monte Carlo.", tone: "warning" })] }));
    }
    return (_jsxs("section", { className: "space-y-5", "data-testid": "monte-carlo-results-section", children: [runControls, _jsxs("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-5", children: [_jsx(KpiCard, { label: "\u0411\u0430\u0437\u043E\u0432\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442", value: formatEnergy(baseResult.summary.totalEnergyKWh, "кВт·ч"), info: resultsMetricInfo.energy }), _jsx(KpiCard, { label: "P50", value: formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч"), info: resultsMetricInfo.monteCarloP50 }), _jsx(KpiCard, { label: "P90", value: formatEnergy(monteCarloResult.totalEnergy.p90, "кВт·ч"), info: resultsMetricInfo.monteCarloP90 }), _jsx(KpiCard, { label: "\u0420\u0438\u0441\u043A \u043D\u0435\u0434\u043E\u0433\u0440\u0435\u0432\u0430", value: formatPercentage(presentation.underheatingRisk), info: resultsMetricInfo.underheatingRisk }), _jsx(KpiCard, { label: "\u0413\u043B\u0430\u0432\u043D\u044B\u0439 \u0444\u0430\u043A\u0442\u043E\u0440", value: presentation.mainFactor?.label ?? "—", info: resultsMetricInfo.sensitivity })] }), _jsx(ThermalTimeSeriesChartBlock, { heatingDisplay: "raw", onRunCalculation: onRunCalculation }), _jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-1 flex items-center gap-1.5", children: [_jsxs("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: ["\u0425\u0432\u043E\u0441\u0442\u043E\u0432\u044B\u0435 \u0440\u0438\u0441\u043A\u0438 VaR / CVaR (\u0443\u0440\u043E\u0432\u0435\u043D\u044C ", formatNumber(presentation.varLevelPercent, { maximumFractionDigits: 0 }), "%)"] }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.valueAtRisk })] }), _jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-4", children: presentation.tailRiskCards.flatMap((card) => [
                            _jsx(SummaryStripItem, { label: `VaR · ${card.label}`, value: formatMetricValue(card.valueAtRisk, card.unit, card.decimals), info: resultsMetricInfo.valueAtRisk }, `${card.id}-var`),
                            _jsx(SummaryStripItem, { label: `CVaR · ${card.label}`, value: formatMetricValue(card.conditionalValueAtRisk, card.unit, card.decimals), info: resultsMetricInfo.conditionalValueAtRisk }, `${card.id}-cvar`),
                        ]) })] }), _jsx(CollapsibleSection, { title: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u0435 \u043C\u0435\u0442\u0440\u0438\u043A\u0438 \u043D\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u043E\u0441\u0442\u0438", titleAddon: _jsx(MetricInfoTooltip, { ...resultsMetricInfo.coefficientOfVariation }), children: _jsxs("div", { className: "space-y-4 pt-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-3", children: [_jsx(SummaryStripItem, { label: "P50 \u044D\u043D\u0435\u0440\u0433\u0438\u0438", value: formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч"), info: resultsMetricInfo.monteCarloP50 }), _jsx(SummaryStripItem, { label: "\u0414\u0438\u0430\u043F\u0430\u0437\u043E\u043D P10\u2013P90", value: formatRangeValue(monteCarloResult.totalEnergy.p10, monteCarloResult.totalEnergy.p90, "кВт·ч", 1), info: resultsMetricInfo.probabilisticSpread }), _jsx(SummaryStripItem, { label: "CV \u044D\u043D\u0435\u0440\u0433\u0438\u0438", value: formatPercentValue(monteCarloResult.totalEnergy.coefficientOfVariationPercent), info: resultsMetricInfo.coefficientOfVariation }), _jsx(SummaryStripItem, { label: "\u0423\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u043E\u0441\u0442\u044C \u0440\u0435\u0436\u0438\u043C\u0430", value: formatPercentValue(presentation.stabilityIndexPercent), info: resultsMetricInfo.stabilityIndex }), _jsx(SummaryStripItem, { label: "\u0420\u0438\u0441\u043A \u043F\u0440\u0435\u0432\u044B\u0448\u0435\u043D\u0438\u044F \u043F\u0438\u043A\u0430", value: formatPercentage(presentation.peakExceedanceProbability), info: resultsMetricInfo.exceedanceProbability }), _jsx(SummaryStripItem, { label: "\u0420\u0438\u0441\u043A \u0440\u043E\u0441\u0442\u0430 \u044D\u043D\u0435\u0440\u0433\u0438\u0438", value: formatPercentage(presentation.energyGrowthProbability), info: resultsMetricInfo.energyGrowthRisk }), _jsx(SummaryStripItem, { label: "\u0421\u0430\u043C\u043E\u0435 \u0440\u0438\u0441\u043A\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435", value: presentation.riskiestRoom?.roomName ?? "—", info: resultsMetricInfo.roomMargin })] }), _jsx(CollapsibleSection, { title: "\u0414\u0435\u0442\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u043E \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044F\u043C", children: _jsx("div", { className: "overflow-x-auto pt-3", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-sm text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "P50" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "P10\u2013P90" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: _jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx("span", { children: "P5\u2013P95" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.percentileCorridorP5P95 })] }) }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0428\u0438\u0440\u0438\u043D\u0430" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "CV" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: _jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx("span", { children: "95% \u0414\u0418 \u03BC" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.confidenceIntervalMean })] }) }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0418\u043D\u0442\u0435\u0440\u043F\u0440\u0435\u0442\u0430\u0446\u0438\u044F" })] }) }), _jsx("tbody", { children: presentation.uncertaintyRows.map((row) => {
                                                const cvInfo = describeCv(row.cvPercent);
                                                return (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "px-4 py-2", children: _jsxs("div", { className: "flex items-center gap-1.5 font-medium text-[color:var(--text-base)]", children: [_jsx("span", { children: row.label }), _jsx(MetricInfoTooltip, { ...row.info })] }) }), _jsx("td", { className: "px-4 py-2", children: formatMetricValue(row.p50, row.unit, row.decimals) }), _jsx("td", { className: "px-4 py-2", children: formatRangeValue(row.p10, row.p90, row.unit, row.decimals) }), _jsx("td", { className: "px-4 py-2", children: formatRangeValue(row.p5, row.p95, row.unit, row.decimals) }), _jsxs("td", { className: "px-4 py-2", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { children: formatMetricValue(row.spread, row.unit, row.decimals) }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.probabilisticSpread })] }), _jsx("div", { className: "text-xs text-[color:var(--text-soft)]", children: formatPercentValue(row.relativeSpreadPercent) })] }), _jsx("td", { className: "px-4 py-2", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { children: formatPercentValue(row.cvPercent) }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.coefficientOfVariation })] }) }), _jsx("td", { className: "px-4 py-2", children: formatRangeValue(row.ciLower, row.ciUpper, row.unit, row.decimals) }), _jsx("td", { className: "px-4 py-2", children: _jsx(Badge, { tone: cvInfo.tone, children: cvInfo.label }) })] }, row.id));
                                            }) })] }) }) })] }) }), _jsx(CollapsibleSection, { title: "\u0411\u0430\u0437\u043E\u0432\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442 \u0438 \u043A\u0432\u0430\u043D\u0442\u0438\u043B\u0438 P10 / P50 / P90", titleAddon: _jsx(MetricInfoTooltip, { title: "\u041A\u0432\u0430\u043D\u0442\u0438\u043B\u0438 Monte Carlo", meaning: "\u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \u0431\u0430\u0437\u043E\u0432\u043E\u0433\u043E \u0434\u0435\u0442\u0435\u0440\u043C\u0438\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0433\u043E \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F \u0441 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435\u043C \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u043D\u043E\u0433\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430.", formula: "Base vs quantile(metric, q)", inputs: ["baseResult.summary", "scenarioSeries"], calculatedIn: "src/core/uncertainty/thermalMonteCarlo.ts" }), children: _jsx("div", { className: "overflow-x-auto pt-3", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-sm text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0411\u0430\u0437\u0430" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "P10" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "P50" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "P90" })] }) }), _jsxs("tbody", { children: [_jsx(ComparisonRow, { label: getThermalMonteCarloTargetMetricDefinition("totalEnergyKWh").shortLabel, info: resultsMetricInfo.energy, baseline: formatEnergy(baseResult.summary.totalEnergyKWh, "кВт·ч"), p10: formatEnergy(monteCarloResult.totalEnergy.p10, "кВт·ч"), p50: formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч"), p90: formatEnergy(monteCarloResult.totalEnergy.p90, "кВт·ч") }), _jsx(ComparisonRow, { label: getThermalMonteCarloTargetMetricDefinition("peakLoadKW").shortLabel, info: resultsMetricInfo.peakLoad, baseline: `${formatNumber(baseResult.summary.peakLoadKW, { maximumFractionDigits: 2 })} кВт`, p10: `${formatNumber(monteCarloResult.peakLoad.p10, { maximumFractionDigits: 2 })} кВт`, p50: `${formatNumber(monteCarloResult.peakLoad.p50, { maximumFractionDigits: 2 })} кВт`, p90: `${formatNumber(monteCarloResult.peakLoad.p90, { maximumFractionDigits: 2 })} кВт` }), _jsx(ComparisonRow, { label: getThermalMonteCarloTargetMetricDefinition("discomfortHours").shortLabel, info: resultsMetricInfo.discomfort, baseline: `${formatNumber(baseResult.summary.discomfortHours, { maximumFractionDigits: 1 })} ч`, p10: `${formatNumber(monteCarloResult.discomfort.p10, { maximumFractionDigits: 1 })} ч`, p50: `${formatNumber(monteCarloResult.discomfort.p50, { maximumFractionDigits: 1 })} ч`, p90: `${formatNumber(monteCarloResult.discomfort.p90, { maximumFractionDigits: 1 })} ч` })] })] }) }) }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[1.2fr,0.8fr]", children: [_jsx(MonteCarloChart, { result: monteCarloResult, baselineEnergyKWh: baseResult.summary.totalEnergyKWh }), _jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0427\u0443\u0432\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0444\u0430\u043A\u0442\u043E\u0440\u043E\u0432" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.sensitivity })] }), presentation.sensitivity.length ? (_jsx(_Fragment, { children: _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: presentation.sensitivity, layout: "vertical", margin: { top: 8, right: 12, bottom: 4, left: 8 }, children: [_jsx(CartesianGrid, { stroke: "var(--chart-grid)", strokeDasharray: "3 3" }), _jsx(XAxis, { type: "number", domain: [0, 100], tick: { fill: "var(--text-soft)", fontSize: 11 }, tickFormatter: (value) => `${Math.round(Number(value))}%`, children: _jsx(Label, { value: `Влияние на ${selectedTargetMetricDefinition.shortLabel}, %`, position: "insideBottom", offset: -2, fill: "var(--text-soft)", fontSize: 11 }) }), _jsx(YAxis, { type: "category", dataKey: "label", width: 148, tick: { fill: "var(--text-soft)", fontSize: 11 }, children: _jsx(Label, { value: "\u0424\u0430\u043A\u0442\u043E\u0440\u044B", angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 } }) }), _jsx(Tooltip, { formatter: (value) => [`${formatNumber(value, { maximumFractionDigits: 1 })}%`, "Влияние"], contentStyle: tooltipStyle }), _jsx(Bar, { dataKey: "valuePercent", radius: [0, 8, 8, 0], children: presentation.sensitivity.map((entry, index) => (_jsx(Cell, { fill: index === 0 ? "var(--accent-base)" : "var(--chart-line-muted)" }, `${entry.id}-${index}`))) })] }) }) }) })) : (_jsx(EmptyState, { message: selectedTargetMetricHasData
                                    ? "Для текущего набора сценариев чувствительность пока не рассчитана."
                                    : selectedTargetMetricDefinition.emptyStateMessage, tone: selectedTargetMetricHasData ? "default" : "warning" }))] })] }), _jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-1 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041A\u0440\u0438\u0432\u0430\u044F \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0438 \u044D\u043D\u0435\u0440\u0433\u0438\u0438 (CDF)" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.cumulativeDistribution })] }), presentation.energyCdf.length ? (_jsx("div", { className: "h-72", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: presentation.energyCdf, margin: { top: 28, right: 16, bottom: 28, left: 12 }, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "mc-cdf-fill", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "var(--accent-base)", stopOpacity: 0.35 }), _jsx("stop", { offset: "100%", stopColor: "var(--accent-base)", stopOpacity: 0.02 })] }) }), _jsx(CartesianGrid, { stroke: "var(--chart-grid)", strokeDasharray: "3 3" }), _jsx(XAxis, { type: "number", dataKey: "value", domain: ["dataMin", "dataMax"], tick: { fill: "var(--text-soft)", fontSize: 11 }, tickFormatter: (value) => formatNumber(Number(value), { maximumFractionDigits: 0 }), children: _jsx(Label, { value: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F, \u043A\u0412\u0442\u00B7\u0447", position: "insideBottom", offset: -4, fill: "var(--text-soft)", fontSize: 11 }) }), _jsx(YAxis, { domain: [0, 100], tick: { fill: "var(--text-soft)", fontSize: 11 }, tickFormatter: (value) => `${Math.round(Number(value))}%`, children: _jsx(Label, { value: "P(E \u2264 x), %", angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 } }) }), _jsx(Tooltip, { contentStyle: tooltipStyle, formatter: (value) => [`${formatNumber(value, { maximumFractionDigits: 1 })}%`, "Вероятность"], labelFormatter: (label) => `${formatNumber(Number(label), { maximumFractionDigits: 0 })} кВт·ч` }), [
                                        { value: monteCarloResult.totalEnergy.p10, label: "P10" },
                                        { value: monteCarloResult.totalEnergy.p50, label: "P50" },
                                        { value: monteCarloResult.totalEnergy.p90, label: "P90" },
                                    ].map((marker) => Number.isFinite(marker.value) ? (_jsx(ReferenceLine, { x: marker.value, stroke: "var(--chart-line-muted)", strokeDasharray: "4 4", label: { value: marker.label, position: "top", offset: 6, fill: "var(--text-soft)", fontSize: 10 } }, marker.label)) : null), _jsx(Area, { type: "monotone", dataKey: "probabilityPercent", stroke: "var(--accent-base)", strokeWidth: 2, fill: "url(#mc-cdf-fill)" })] }) }) })) : (_jsx(EmptyState, { message: "\u041A\u0440\u0438\u0432\u0430\u044F \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u0438 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u0438\u044F \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432 Monte Carlo." }))] }), _jsx(MonteCarloScatterChart, { result: monteCarloResult, baseOptions: baseOptions, targetMetric: selectedTargetMetric, onTargetMetricChange: setSelectedTargetMetric }), _jsx(CollapsibleSection, { title: "\u0420\u0438\u0441\u043A \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C", titleAddon: _jsx(MetricInfoTooltip, { title: "\u0420\u0438\u0441\u043A \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C", meaning: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043C\u0435\u0434\u0438\u0430\u043D\u043D\u0443\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443, \u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0439 \u0445\u0432\u043E\u0441\u0442 \u0438 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u043D\u0435\u0434\u043E\u0433\u0440\u0435\u0432\u0430 \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C.", formula: "Risk_room = count(T_min,room < threshold) / N", inputs: ["roomRiskSummary.temperatureP50C", "roomRiskSummary.minimumTemperatureP10C", "roomRiskSummary.underheatingRisk"], calculatedIn: "src/core/uncertainty/thermalMonteCarlo.ts \u2192 roomRiskSummary" }), children: _jsxs("div", { className: "space-y-3 pt-3", children: [presentation.topRiskRooms.length ? (_jsx("div", { className: "flex flex-wrap gap-2", children: presentation.topRiskRooms.map((room, index) => (_jsxs("div", { className: "rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs text-[color:var(--text-muted)]", children: [_jsxs("span", { className: "font-semibold text-[color:var(--text-base)]", children: [index + 1, ". ", room.roomName] }), _jsxs("span", { children: [" \u00B7 \u0440\u0438\u0441\u043A ", formatPercentage(room.underheatingRisk)] }), _jsxs("span", { children: [" \u00B7 \u0437\u0430\u043F\u0430\u0441 ", formatSignedTemperature(room.marginTo20C)] })] }, `${room.roomId}-${index}`))) })) : null, presentation.roomRows.length ? (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-sm text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 P50" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041C\u0438\u043D. \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 P10" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: _jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx("span", { children: "\u0417\u0430\u043F\u0430\u0441 \u0434\u043E \u043F\u043E\u0440\u043E\u0433\u0430" }), _jsx(MetricInfoTooltip, { ...resultsMetricInfo.roomMargin })] }) }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0420\u0438\u0441\u043A \u043D\u0435\u0434\u043E\u0433\u0440\u0435\u0432\u0430" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0421\u0442\u0430\u0442\u0443\u0441" })] }) }), _jsx("tbody", { children: presentation.roomRows.map((room) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "px-4 py-2 font-medium text-[color:var(--text-base)]", children: room.roomName }), _jsxs("td", { className: "px-4 py-2", children: [formatNumber(room.temperatureP50C, { maximumFractionDigits: 1 }), " \u00B0C"] }), _jsxs("td", { className: "px-4 py-2", children: [formatNumber(room.minimumTemperatureP10C, { maximumFractionDigits: 1 }), " \u00B0C"] }), _jsx("td", { className: "px-4 py-2", children: formatSignedTemperature(room.marginTo20C) }), _jsx("td", { className: "px-4 py-2", children: formatPercentage(room.underheatingRisk) }), _jsx("td", { className: "px-4 py-2", children: _jsx(Badge, { tone: riskBadgeTone(room.status), children: formatRiskStatus(room.status) }) })] }, room.roomId))) })] }) })) : (_jsx(EmptyState, { message: ROOM_RISK_EMPTY_TEXT }))] }) }), _jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsxs("div", { className: "mb-3 flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0412\u0435\u0435\u0440\u043D\u044B\u0439 \u0433\u0440\u0430\u0444\u0438\u043A \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u0438 \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F" }), _jsx(MetricInfoTooltip, { title: "\u0412\u0435\u0435\u0440\u043D\u044B\u0439 \u0433\u0440\u0430\u0444\u0438\u043A \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438" })] }), fanChartData.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "h-[260px] rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(ComposedChart, { data: fanChartData, margin: { top: 8, right: 16, bottom: 24, left: 4 }, children: [_jsx(CartesianGrid, { stroke: "var(--chart-grid)", strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "timeHours", type: "number", domain: ["dataMin", "dataMax"], tickFormatter: (v) => v < 24 ? `${Math.round(v)}ч` : `д${Math.floor(v / 24) + 1}`, tick: { fill: "var(--text-soft)", fontSize: 11 }, children: _jsx(Label, { value: "\u0412\u0440\u0435\u043C\u044F", position: "insideBottom", offset: -12, fill: "var(--text-soft)", fontSize: 11 }) }), _jsx(YAxis, { tick: { fill: "var(--text-soft)", fontSize: 11 }, tickFormatter: (v) => formatNumber(v, { maximumFractionDigits: 1 }), width: 52, children: _jsx(Label, { value: "\u043A\u0412\u0442", angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 } }) }), _jsx(Tooltip, { content: ({ active, payload }) => {
                                                    if (!active || !payload?.length)
                                                        return null;
                                                    const d = payload[0]?.payload;
                                                    if (!d)
                                                        return null;
                                                    return (_jsxs("div", { style: {
                                                            background: "var(--surface-elevated)",
                                                            border: "1px solid var(--border-soft)",
                                                            borderRadius: 12,
                                                            padding: "8px 12px",
                                                            fontSize: 12,
                                                        }, children: [_jsxs("p", { style: { color: "var(--text-soft)", marginBottom: 4 }, children: ["t = ", formatNumber(d.timeHours, { maximumFractionDigits: 1 }), " \u0447"] }), _jsxs("p", { children: ["P10: ", formatNumber(d.p10, { maximumFractionDigits: 2 }), " \u043A\u0412\u0442"] }), _jsxs("p", { children: ["P50: ", formatNumber(d.p50, { maximumFractionDigits: 2 }), " \u043A\u0412\u0442"] }), _jsxs("p", { children: ["P90: ", formatNumber(d.p90, { maximumFractionDigits: 2 }), " \u043A\u0412\u0442"] }), d.baseline != null && (_jsxs("p", { children: ["\u0411\u0430\u0437\u0430: ", formatNumber(d.baseline, { maximumFractionDigits: 2 }), " \u043A\u0412\u0442"] }))] }));
                                                } }), _jsx(Area, { type: "monotone", dataKey: "p10", stackId: "fan", fill: "transparent", stroke: "none", isAnimationActive: false }), _jsx(Area, { type: "monotone", dataKey: "bandWidth", stackId: "fan", fill: "var(--accent-soft)", fillOpacity: 0.45, stroke: "none", isAnimationActive: false }), _jsx(Line, { type: "monotone", dataKey: "p50", stroke: "var(--accent-base)", strokeWidth: 2, dot: false, isAnimationActive: false }), baseResult ? (_jsx(Line, { type: "monotone", dataKey: "baseline", stroke: "var(--danger-border)", strokeWidth: 1.5, strokeDasharray: "5 3", dot: false, isAnimationActive: false, connectNulls: false })) : null] }) }) }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-3 text-xs text-[color:var(--text-muted)]", children: [_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "inline-block h-3 w-5 rounded-sm", style: { background: "var(--accent-soft)", opacity: 0.6 } }), "P10\u2013P90 (80% \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432)"] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "inline-block h-0.5 w-5", style: { background: "var(--accent-base)" } }), "P50 \u2014 \u043C\u0435\u0434\u0438\u0430\u043D\u0430"] }), baseResult ? (_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "inline-block h-0.5 w-5", style: { background: "var(--danger-border)", borderTop: "2px dashed var(--danger-border)" } }), "\u0411\u0430\u0437\u043E\u0432\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439"] })) : null] })] })) : (_jsx(EmptyState, { message: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 Monte Carlo \u0437\u0430\u043D\u043E\u0432\u043E, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u0432\u0435\u0435\u0440\u043D\u044B\u0439 \u0433\u0440\u0430\u0444\u0438\u043A \u043F\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u043C \u0448\u0430\u0433\u0430\u043C." }))] }), _jsx(CollapsibleSection, { title: "\u0420\u0438\u0441\u043A\u0438 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432", titleAddon: _jsx(MetricInfoTooltip, { ...resultsMetricInfo.underheatingRisk }), children: _jsx("div", { className: "overflow-x-auto pt-3", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-sm text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0420\u0438\u0441\u043A" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C" })] }) }), _jsx("tbody", { children: presentation.riskRows.map((row) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "px-4 py-2 font-medium text-[color:var(--text-base)]", children: row.label }), _jsx("td", { className: "px-4 py-2", children: formatPercentage(row.probability) }), _jsx("td", { className: "px-4 py-2", children: _jsx(Badge, { tone: riskBadgeTone(row.status), children: formatRiskStatus(row.status) }) })] }, row.id))) })] }) }) })] }));
}
function KpiCard({ label, value, hint, info, }) {
    return (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: label }), _jsx(MetricInfoTooltip, { ...info })] }), _jsx("p", { className: "mt-1 text-lg font-semibold text-[color:var(--text-base)]", children: value }), hint ? _jsx("p", { className: "text-xs text-[color:var(--text-muted)]", children: hint }) : null] }));
}
function SummaryStripItem({ label, value, info, }) {
    return (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: label }), _jsx(MetricInfoTooltip, { ...info })] }), _jsx("p", { className: "mt-1 text-base font-semibold text-[color:var(--text-base)]", children: value })] }));
}
function ComparisonRow({ label, info, baseline, p10, p50, p90, }) {
    return (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "px-4 py-2", children: _jsxs("div", { className: "flex items-center gap-1.5 font-medium text-[color:var(--text-base)]", children: [_jsx("span", { children: label }), _jsx(MetricInfoTooltip, { ...info })] }) }), _jsx("td", { className: "px-4 py-2", children: baseline }), _jsx("td", { className: "px-4 py-2", children: p10 }), _jsx("td", { className: "px-4 py-2", children: p50 }), _jsx("td", { className: "px-4 py-2", children: p90 })] }));
}
function buildRiskRows(baseResult, monteCarloResult, peakThresholdKW) {
    const underheatingProbability = monteCarloResult.underheatingBelow20CProbability ??
        probabilityOf(monteCarloResult.scenarioSeries.minimumIndoorTemperatureC, (value) => value < THERMAL_MONTE_CARLO_UNDERHEAT_THRESHOLD_C);
    const peakProbability = peakThresholdKW === null
        ? null
        : probabilityOf(monteCarloResult.scenarioSeries.peakLoadKW, (value) => value > peakThresholdKW);
    const energyProbability = probabilityOf(monteCarloResult.scenarioSeries.totalEnergyKWh, (value) => value > baseResult.summary.totalEnergyKWh * DEFAULT_ENERGY_GROWTH_FACTOR);
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
            label: "Пиковая мощность выше базового результата на 20%",
            probability: peakProbability,
            status: resolveRiskStatus(peakProbability ?? 0),
        },
        {
            id: "energy",
            label: "Энергия выше базового результата на 20%",
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
function buildUncertaintyMetricRow(id, label, summary, unit, decimals, info) {
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
function buildTailRiskCard(id, label, summary, unit, decimals) {
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
function buildCdfView(cdf) {
    return cdf
        .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.probability))
        .map((point) => ({ value: point.value, probabilityPercent: point.probability * 100 }));
}
function probabilityOf(values, predicate) {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) {
        return null;
    }
    return finite.filter(predicate).length / finite.length;
}
function resolveRiskStatus(probability) {
    if (probability >= 0.3) {
        return "высокий";
    }
    if (probability >= 0.1) {
        return "средний";
    }
    return "низкий";
}
function formatRiskStatus(status) {
    return `${status.charAt(0).toUpperCase()}${status.slice(1)} риск`;
}
function riskBadgeTone(status) {
    switch (status) {
        case "высокий":
            return "accent";
        case "средний":
            return "warning";
        default:
            return "success";
    }
}
function describeCv(value) {
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
function describeStability(value) {
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
function formatPercentValue(value) {
    return value === null ? "—" : `${formatNumber(value, { maximumFractionDigits: 1 })}%`;
}
function formatMetricValue(value, unit, decimals) {
    if (value === null || !Number.isFinite(value)) {
        return "—";
    }
    return `${formatNumber(value, { maximumFractionDigits: decimals })} ${unit}`;
}
function formatRangeValue(minValue, maxValue, unit, decimals) {
    if (minValue === null || maxValue === null) {
        return "—";
    }
    return `${formatNumber(minValue, { maximumFractionDigits: decimals })}–${formatNumber(maxValue, {
        maximumFractionDigits: decimals,
    })} ${unit}`;
}
function formatSpreadValue(summary, unit, decimals) {
    const spread = summary.spreadP10P90;
    const relative = summary.relativeSpreadPercent;
    if (spread === null) {
        return "—";
    }
    return `${formatMetricValue(spread, unit, decimals)} / ${formatPercentValue(relative)}`;
}
function formatSignedTemperature(value) {
    if (value === null || !Number.isFinite(value)) {
        return "—";
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatNumber(value, { maximumFractionDigits: 1 })} °C`;
}
function roundValue(value, digits) {
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
