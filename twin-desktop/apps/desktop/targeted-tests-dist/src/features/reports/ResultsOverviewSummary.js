import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { MetricInfoTooltip } from "../../shared/ui";
import { formatNumber } from "../../shared/utils/format";
import { resultsMetricInfo } from "./resultsMetricInfo";
const COMPACT_LEFT_LABELS = ["Удельные потери", "Удельная пиковая"];
const COMPACT_RIGHT_LABELS = ["Дискомфорт", "P50 Monte Carlo", "Теплопотребление P50"];
function formatKw(value, digits = 2) {
    if (value == null || !Number.isFinite(value)) {
        return { value: "—", unit: "кВт" };
    }
    return {
        value: formatNumber(value, { maximumFractionDigits: digits }),
        unit: "кВт",
    };
}
function formatSpecific(value, unit, digits = 2) {
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
function MetricInfoButton({ info }) {
    return (_jsx(MetricInfoTooltip, { title: info.title, formula: info.formula, linkedFormulaIds: info.linkedFormulaIds, children: _jsx("button", { type: "button", className: "ui-results-summary__info", "aria-label": `Справка: ${info.title}`, children: "?" }) }));
}
function SummaryCompactGrid({ metrics, startIndex }) {
    if (!metrics.length) {
        return null;
    }
    const leftMetrics = COMPACT_LEFT_LABELS.map((label) => metrics.find((metric) => metric.label === label)).filter((metric) => metric != null);
    const rightMetrics = COMPACT_RIGHT_LABELS.map((label) => metrics.find((metric) => metric.label === label)).filter((metric) => metric != null);
    const assigned = new Set([...leftMetrics, ...rightMetrics].map((metric) => metric.label));
    metrics.forEach((metric) => {
        if (!assigned.has(metric.label)) {
            (leftMetrics.length <= rightMetrics.length ? leftMetrics : rightMetrics).push(metric);
        }
    });
    const renderItem = (metric, index) => (_jsxs("div", { className: `ui-results-summary__compact-item ui-results-summary__compact-item--${metric.group}`, style: { "--summary-i": startIndex + index }, children: [_jsxs("div", { className: "ui-results-summary__compact-head", children: [_jsx("p", { className: "ui-results-summary__compact-label", children: metric.label }), metric.metricInfo ? _jsx(MetricInfoButton, { info: metric.metricInfo }) : null] }), _jsxs("div", { className: "ui-results-summary__compact-value", children: [_jsx("span", { className: "ui-results-summary__compact-number", children: metric.value }), metric.unit ? _jsx("span", { className: "ui-results-summary__compact-unit", children: metric.unit }) : null] })] }, metric.label));
    return (_jsx("section", { className: "ui-results-summary__compact-panel", "aria-label": "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438", style: { "--summary-i": startIndex }, children: _jsxs("div", { className: "ui-results-summary__compact-columns", children: [_jsx("div", { className: "ui-results-summary__compact-col", children: leftMetrics.map((metric, index) => renderItem(metric, index)) }), _jsx("div", { className: "ui-results-summary__compact-col", children: rightMetrics.map((metric, index) => renderItem(metric, leftMetrics.length + index)) })] }) }));
}
function SummaryKpi({ metric, size, index, }) {
    const isSpotlight = size === "spotlight";
    const cardStyle = { "--summary-i": index };
    return (_jsxs("article", { className: `ui-results-summary__kpi ui-results-summary__kpi--${metric.group} ui-results-summary__kpi--${isSpotlight ? "spotlight" : "compact"}`, style: cardStyle, children: [_jsxs("header", { className: "ui-results-summary__kpi-head", children: [_jsx("p", { className: "ui-results-summary__kpi-label", children: metric.label }), metric.metricInfo ? _jsx(MetricInfoButton, { info: metric.metricInfo }) : null] }), _jsxs("div", { className: "ui-results-summary__kpi-value", children: [_jsx("span", { className: "ui-results-summary__kpi-number", children: metric.value }), metric.unit ? _jsx("span", { className: "ui-results-summary__kpi-unit", children: metric.unit }) : null] })] }));
}
export function ResultsOverviewSummary({ lastThermalResult, monteCarloResult, }) {
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
    const totalHeatLossKW = transmissionLossKW != null && airExchangeLossKW != null ? transmissionLossKW + airExchangeLossKW : null;
    const transmissionShare = totalHeatLossKW && transmissionLossKW != null && totalHeatLossKW > 0
        ? Math.min(100, Math.max(0, (transmissionLossKW / totalHeatLossKW) * 100))
        : null;
    const allMetrics = useMemo(() => {
        const items = [];
        const summary = lastThermalResult?.summary;
        if (lastThermalResult && summary) {
            const specificEnergy = buildingDiagnostics?.specificEnergyKWh_m2 ?? null;
            const specificPeak = buildingDiagnostics?.specificPeakLoad_W_m2 ?? null;
            const peak = formatKw(summary.peakLoadKW);
            const specificEnergyParts = formatSpecific(specificEnergy, "кВт·ч/м²");
            const specificPeakParts = formatSpecific(specificPeak, "Вт/м²", 1);
            items.push({
                label: "Теплопотребление",
                value: formatNumber(summary.totalEnergyKWh, { maximumFractionDigits: 1 }),
                unit: "кВт·ч",
                group: "energy",
                featured: true,
                metricInfo: resultsMetricInfo.energy,
            }, {
                label: "Пиковая нагрузка",
                value: peak.value,
                unit: peak.unit,
                group: "energy",
                featured: true,
                metricInfo: resultsMetricInfo.peakLoad,
            }, {
                label: "Через ограждения",
                value: formatKw(transmissionLossKW).value,
                unit: "кВт",
                group: "loss",
                metricInfo: resultsMetricInfo.buildingTransmissionLossKW,
            }, {
                label: "Воздухообмен",
                value: formatKw(airExchangeLossKW).value,
                unit: "кВт",
                group: "loss",
                metricInfo: resultsMetricInfo.buildingAirExchangeLossKW,
            }, {
                label: "Удельные потери",
                value: specificEnergyParts.value,
                unit: specificEnergyParts.unit || "кВт·ч/м²",
                group: "energy",
                metricInfo: resultsMetricInfo.buildingSpecificEnergyKWhM2,
            }, {
                label: "Удельная пиковая",
                value: specificPeakParts.value,
                unit: specificPeakParts.unit || "Вт/м²",
                group: "energy",
                metricInfo: resultsMetricInfo.peakLoad,
            }, {
                label: "Дискомфорт",
                value: formatNumber(summary.discomfortHours, { maximumFractionDigits: 1 }),
                unit: "ч",
                group: "comfort",
                metricInfo: resultsMetricInfo.discomfort,
            });
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
    const compositionRingStyle = transmissionShare != null
        ? {
            background: `conic-gradient(
            var(--accent-base) 0% ${transmissionShare}%,
            var(--accent-lime) ${transmissionShare}% 100%
          )`,
        }
        : undefined;
    let cardIndex = 1;
    return (_jsx("div", { className: "ui-results-overview ui-results-summary", children: _jsxs("div", { className: "ui-results-summary__bento", "aria-label": "\u0421\u0432\u043E\u0434\u043A\u0430 \u0440\u0430\u0441\u0447\u0451\u0442\u0430", children: [totalHeatLossKW != null ? (_jsxs("section", { className: "ui-results-summary__hero", "aria-label": "\u0421\u0443\u043C\u043C\u0430\u0440\u043D\u044B\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438", style: { "--summary-i": 0 }, children: [_jsxs("div", { className: "ui-results-summary__hero-ambient", "aria-hidden": "true", children: [_jsx("div", { className: "ui-results-summary__hero-mesh" }), _jsx("div", { className: "ui-results-summary__hero-orb ui-results-summary__hero-orb--a" }), _jsx("div", { className: "ui-results-summary__hero-orb ui-results-summary__hero-orb--b" }), _jsx("div", { className: "ui-results-summary__hero-grid" })] }), _jsxs("div", { className: "ui-results-summary__hero-inner", children: [_jsxs("div", { className: "ui-results-summary__hero-top", children: [_jsxs("div", { className: "ui-results-summary__hero-head", children: [_jsxs("span", { className: "ui-results-summary__hero-badge", children: [_jsx("span", { className: "ui-results-summary__hero-badge-dot", "aria-hidden": "true" }), "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438"] }), lastThermalResult ? _jsx(MetricInfoButton, { info: resultsMetricInfo.buildingTotalHeatLossKW }) : null] }), _jsxs("div", { className: "ui-results-summary__hero-value", children: [_jsx("span", { className: "ui-results-summary__hero-number", children: hero.value }), _jsx("span", { className: "ui-results-summary__hero-unit", children: hero.unit })] })] }), transmissionShare != null &&
                                    transmissionLossKW != null &&
                                    airExchangeLossKW != null &&
                                    airShare != null ? (_jsx("div", { className: "ui-results-summary__composition", children: _jsxs("div", { className: "ui-results-summary__composition-layout", children: [_jsx("div", { className: "ui-results-summary__composition-ring-wrap", children: _jsx("div", { className: "ui-results-summary__composition-ring", style: compositionRingStyle, children: _jsxs("div", { className: "ui-results-summary__composition-ring-core", children: [_jsxs("span", { className: "ui-results-summary__composition-ring-value", children: [Math.round(transmissionShare), _jsx("span", { className: "ui-results-summary__composition-ring-pct", children: "%" })] }), _jsx("span", { className: "ui-results-summary__composition-ring-caption", children: "\u043E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F" })] }) }) }), _jsxs("div", { className: "ui-results-summary__composition-body", children: [_jsxs("div", { className: "ui-results-summary__composition-head", children: [_jsx("span", { className: "ui-results-summary__composition-title", children: "\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u043F\u043E\u0442\u0435\u0440\u044C" }), _jsxs("span", { className: "ui-results-summary__composition-meta", children: [Math.round(transmissionShare), "% / ", Math.round(airShare), "%"] })] }), _jsxs("div", { className: "ui-results-summary__composition-track", role: "img", "aria-label": `Ограждения ${Math.round(transmissionShare)}%, воздухообмен ${Math.round(airShare)}%`, children: [_jsx("span", { className: "ui-results-summary__composition-seg ui-results-summary__composition-seg--envelope", style: { width: `${transmissionShare}%` } }), _jsx("span", { className: "ui-results-summary__composition-seg ui-results-summary__composition-seg--air", style: { width: `${airShare}%` } })] }), _jsxs("ul", { className: "ui-results-summary__composition-legend", children: [_jsxs("li", { className: "ui-results-summary__composition-item ui-results-summary__composition-item--envelope", children: [_jsx("span", { className: "ui-results-summary__composition-label", children: "\u041E\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u0438\u044F" }), _jsxs("span", { className: "ui-results-summary__composition-value", children: [formatKw(transmissionLossKW).value, _jsx("span", { className: "ui-results-summary__composition-unit", children: "\u043A\u0412\u0442" })] })] }), _jsxs("li", { className: "ui-results-summary__composition-item ui-results-summary__composition-item--air", children: [_jsx("span", { className: "ui-results-summary__composition-label", children: "\u0412\u043E\u0437\u0434\u0443\u0445\u043E\u043E\u0431\u043C\u0435\u043D" }), _jsxs("span", { className: "ui-results-summary__composition-value", children: [formatKw(airExchangeLossKW).value, _jsx("span", { className: "ui-results-summary__composition-unit", children: "\u043A\u0412\u0442" })] })] })] })] })] }) })) : null] })] })) : null, spotlightMetrics.map((metric) => {
                    const index = cardIndex++;
                    return _jsx(SummaryKpi, { metric: metric, size: "spotlight", index: index }, metric.label);
                }), gridMetrics.length ? _jsx(SummaryCompactGrid, { metrics: gridMetrics, startIndex: cardIndex }) : null] }) }));
}
export default ResultsOverviewSummary;
