import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Label, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, } from "recharts";
import { buildThermalConsistencyReport, } from "../../core/thermal/consistencyCheck";
import { extractLossSharePercent } from "../../core/thermal/thermalSimulationExport";
import { buildBuildingLossSeries, buildKpiPayload, buildThermalResultCapabilities, buildZoneSeries, } from "../../core/thermal/thermalResultsChartPayload";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useBuildStore } from "../build/build.store";
import { CollapsibleSection, MetricInfoTooltip, SummaryHighlightGrid, } from "../../shared/ui";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
import { BuildingLossChart } from "./charts/BuildingLossChart";
import { useThermalChartResult } from "./charts/useThermalChartResult";
import { LossShareChart } from "./charts/LossShareChart";
import { RoomHeatmapMatrix } from "./charts/RoomHeatmapMatrix";
import { RoomLossStackedChart } from "./charts/RoomLossStackedChart";
import { RoomScatterPlot } from "./charts/RoomScatterPlot";
import { ThermalTimeSeriesChartBlock } from "./charts/ThermalTimeSeriesChartBlock";
import { formatChartPower, formatZoneStatusLabel, statusBadgeClass, THERMAL_CHART_NOT_SET, } from "./charts/thermalChartTheme";
import { resultsMetricInfo } from "./resultsMetricInfo";
import BuildingPerformanceResultsSection, { BuildingPerformanceValidationSection, } from "./BuildingPerformanceResultsSection";
const NOT_SET = THERMAL_CHART_NOT_SET;
const SHOW_INFILTRATION_DIAGNOSTICS = false;
const ROOM_VIEW_ITEMS = [
    { id: "stacked", label: "Потери по помещениям" },
    { id: "heatmap", label: "Матрица" },
    { id: "scatter", label: "Аномалии" },
];
export function MetricsResultsTab({ onRecalculate, onEditUncertainty }) {
    const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
    const selectSpace = useTwinStore((state) => state.selectSpace);
    const buildModel = useBuildStore((state) => state.model);
    const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
    const scenarioRunHistory = useWorkflowStore((state) => state.scenarioRunHistory);
    const [roomView, setRoomView] = useState("stacked");
    const { chartResult, resultState, chartPreview, activeOptions } = useThermalChartResult();
    const lossShare = useMemo(() => (chartResult ? extractLossSharePercent(chartResult) : null), [chartResult]);
    const consistencyReport = useMemo(() => (chartResult ? buildThermalConsistencyReport(chartResult, activeOptions, buildModel, null) : null), [activeOptions, buildModel, chartResult]);
    if (resultState === "stale") {
        return (_jsx("div", { className: "space-y-4", children: _jsx(ThermalTimeSeriesChartBlock, { heatingDisplay: "equipment", onRunCalculation: onRecalculate }) }));
    }
    if (!chartResult) {
        return (_jsxs("div", { className: "space-y-4", "data-testid": "thermal-results-panel", children: [_jsx(ThermalTimeSeriesChartBlock, { heatingDisplay: "equipment", onRunCalculation: onRecalculate }), onRecalculate ? (_jsx("button", { type: "button", onClick: onRecalculate, className: "ui-btn-primary px-5 py-2 text-sm", children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0440\u0430\u0441\u0447\u0451\u0442" })) : null] }));
    }
    const currentResult = chartResult;
    const kpi = buildKpiPayload(currentResult);
    const zoneRows = buildZoneSeries(currentResult);
    const hasDiagnosticsBreakdown = zoneRows.length > 0;
    const climateLabel = scenarioConfig?.climateCityId
        ? getSp131CityClimate(scenarioConfig.climateCityId)?.label ?? scenarioConfig.climateCityId
        : null;
    const capabilities = buildThermalResultCapabilities(currentResult, {
        climateCityLabel: climateLabel,
        scenarioHistoryCount: scenarioRunHistory.length,
    });
    const compareTableRows = buildCompareTableRows(scenarioRunHistory);
    const compareChartData = scenarioRunHistory.map((run, index) => ({
        name: `П${index + 1}`,
        label: run.label,
        energyKWh: run.totalEnergyKWh,
    }));
    const buildingLossRows = buildBuildingLossSeries(currentResult).map((row) => ({
        key: row.key,
        label: row.label,
        valueW: row.valueW ?? 0,
        share: row.sharePercent ?? 0,
        note: chartPreview
            ? "Предпросмотр: RC по текущей модели и сценарию (пиковый срез diagnostics.building)."
            : "Агрегат diagnostics.building в пиковом срезе RC по сохранённому прогону.",
    }));
    const derived = currentResult.diagnostics?.derived ?? null;
    // Sizing data
    const diagBuilding = currentResult.diagnostics?.building ?? null;
    const diagZones = currentResult.diagnostics?.zones ?? [];
    const peakRcKW = currentResult.summary.peakLoadKW;
    const staticQReqKW = diagBuilding
        ? Math.max(0, diagBuilding.totalLossW - diagBuilding.totalInternalGainsW) / 1000
        : null;
    const divergencePct = staticQReqKW !== null && peakRcKW > 0
        ? ((staticQReqKW - peakRcKW) / peakRcKW) * 100
        : null;
    const hTotal = derived?.totalHeatLossCoefficient_W_K.value ?? null;
    return (_jsxs("div", { className: "space-y-6", "data-testid": "thermal-results-panel", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-sm text-[color:var(--text-muted)]", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-1.5", children: ["RC-\u0444\u0438\u0437\u0438\u043A\u0430", _jsx(MetricInfoTooltip, { ...resultsMetricInfo.rcBalance })] }), capabilities.climateBaseLabel ? (_jsx("span", { className: "inline-flex rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-1.5", children: capabilities.climateBaseLabel })) : null] }), _jsx(SummaryHighlightGrid, { items: [
                    {
                        label: "Пиковая нагрузка",
                        value: `${formatNumber(currentResult.summary.peakLoadKW, { maximumFractionDigits: 2 })} кВт`,
                    },
                    {
                        label: "Теплопотребление",
                        value: formatEnergy(currentResult.summary.totalEnergyKWh, "кВт·ч"),
                    },
                    {
                        label: "Часы дискомфорта",
                        value: `${formatNumber(currentResult.summary.discomfortHours, { maximumFractionDigits: 1 })} ч`,
                    },
                    {
                        label: "Суммарная мощность",
                        value: formatChartPower(kpi.totalHeatingW),
                        tone: "info",
                    },
                ] }), consistencyReport ? _jsx(ThermalConsistencySummarySection, { report: consistencyReport }) : null, derived ? (_jsx(CollapsibleSection, { title: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438", children: _jsxs("section", { className: "ui-panel-muted mt-3 space-y-4 rounded-2xl p-4", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-4", children: [_jsx(DerivedMetricTile, { label: "H_tr", value: formatDerivedMetric(derivedMetricNumber(derived.transmissionHeatLossCoefficient_W_K), "Вт/К", 1), info: resultsMetricInfo.heatLossCoefficientTransmission }), _jsx(DerivedMetricTile, { label: "H_ve", value: formatDerivedMetric(derivedMetricNumber(derived.ventilationHeatLossCoefficient_W_K), "Вт/К", 1), info: resultsMetricInfo.heatLossCoefficientVentilation }), _jsx(DerivedMetricTile, { label: "H_total", value: formatDerivedMetric(derivedMetricNumber(derived.totalHeatLossCoefficient_W_K), "Вт/К", 1), info: resultsMetricInfo.heatLossCoefficientTotal }), _jsx(DerivedMetricTile, { label: "\u03C4 \u0437\u0434\u0430\u043D\u0438\u044F", value: formatDerivedMetric(derivedMetricNumber(derived.buildingTauHours), "ч", 1), info: resultsMetricInfo.thermalTimeConstant }), _jsx(DerivedMetricTile, { label: "q_A", value: formatDerivedMetric(derivedMetricNumber(derived.specificIndicators?.qArea_W_m2), "Вт/м²", 1), info: resultsMetricInfo.specificLoadArea }), _jsx(DerivedMetricTile, { label: "q_V", value: formatDerivedMetric(derivedMetricNumber(derived.specificIndicators?.qVolume_W_m3), "Вт/м³", 2), info: resultsMetricInfo.specificLoadVolume }), _jsx(DerivedMetricTile, { label: "q_V\u0394T", value: formatDerivedMetric(derivedMetricNumber(derived.specificIndicators?.qVolumeDeltaT_W_m3K), "Вт/(м³·К)", 3), info: resultsMetricInfo.specificLoadVolume }), _jsx(DerivedMetricTile, { label: "\u0420\u0435\u043A\u0443\u043F\u0435\u0440\u0430\u0446\u0438\u044F", value: formatDerivedMetric(derivedMetricNumber(derived.ventilationRecovery?.savedByRecovery_W), "Вт", 1), info: resultsMetricInfo.ventilationRecovery })] }), _jsxs("div", { className: "grid gap-3 xl:grid-cols-[1.15fr,0.85fr]", children: [_jsx(CollapsibleSection, { title: "\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0435 \u043E\u0441\u0442\u044B\u0432\u0430\u043D\u0438\u0435", titleAddon: _jsx(MetricInfoTooltip, { ...resultsMetricInfo.freeCooling }), children: _jsx("div", { className: "grid gap-2 pt-3 sm:grid-cols-2 xl:grid-cols-4", children: (derived.freeCooling ?? []).map((point) => (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsxs("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: [point.hours, " \u0447"] }), _jsx("p", { className: "mt-1 text-base font-semibold text-[color:var(--text-base)]", children: formatDerivedMetric(point.temperatureC.value, "°C", 1) })] }, point.hours))) }) }), _jsx(CollapsibleSection, { title: "\u0422\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u0430\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C", titleAddon: _jsx(MetricInfoTooltip, { ...resultsMetricInfo.thermalTimeConstant }), children: _jsx("div", { className: "overflow-x-auto pt-3", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-sm text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-3 py-2 font-semibold", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("th", { className: "px-3 py-2 font-semibold", children: "\u03C4" }), _jsx("th", { className: "px-3 py-2 font-semibold", children: "H" })] }) }), _jsx("tbody", { children: (derived.zoneTauHours ?? []).slice(0, 6).map((zone) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "px-3 py-2 font-medium text-[color:var(--text-base)]", children: zone.zoneName }), _jsx("td", { className: "px-3 py-2", children: formatDerivedMetric(zone.tauHours.value, "ч", 1) }), _jsx("td", { className: "px-3 py-2", children: formatDerivedMetric(zone.heatLossCoefficient_W_K.value, "Вт/К", 1) })] }, zone.zoneId))) })] }) }) })] })] }) })) : null, _jsx(ThermalTimeSeriesChartBlock, { heatingDisplay: "equipment", onRunCalculation: onRecalculate }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[1.25fr,0.95fr]", children: [_jsx(BuildingLossChart, { rows: buildingLossRows }), lossShare ? (_jsx(LossShareChart, { share: lossShare })) : (_jsxs("section", { className: "ui-chart-shell", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u044C" }), _jsx(ChartEmptyState, { text: "\u0414\u043E\u043B\u0438 \u043F\u043E\u0442\u0435\u0440\u044C \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B." })] }))] }), _jsx(BuildingPerformanceResultsSection, { diagnostics: currentResult.diagnostics?.buildingPerformance }), _jsx(CollapsibleSection, { title: "\u0422\u0440\u0435\u0431\u0443\u0435\u043C\u0430\u044F \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430 \u0442\u0435\u043F\u043B\u0430", children: _jsxs("section", { className: "ui-panel-muted mt-3 space-y-4 rounded-2xl p-4", "data-testid": "heating-sizing-section", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(SizingKpiTile, { label: "\u041F\u0438\u043A RC", value: formatOptionalNumber(peakRcKW, "кВт", 2) }), _jsx(SizingKpiTile, { label: "\u0421\u0442\u0430\u0442\u0438\u0447. Q_req", value: formatOptionalNumber(staticQReqKW, "кВт", 2) }), _jsx(SizingKpiTile, { label: "\u0421 \u0437\u0430\u043F\u0430\u0441\u043E\u043C \u00D71.15", value: formatOptionalNumber(peakRcKW * 1.15, "кВт", 2), accent: true }), _jsx(SizingKpiTile, { label: "\u0421 \u0437\u0430\u043F\u0430\u0441\u043E\u043C \u00D71.25", value: formatOptionalNumber(peakRcKW * 1.25, "кВт", 2) })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsx(SizingKpiTile, { label: "\u0423\u0434. \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0430", value: formatOptionalNumber(diagBuilding?.specificPeakLoad_W_m2, "Вт/м²", 1) }), _jsx(SizingKpiTile, { label: "H_total", value: formatOptionalNumber(hTotal, "Вт/К", 1) }), _jsx(SizingKpiTile, { label: "\u0420\u0430\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435 RC\u2013\u0441\u0442\u0430\u0442\u0438\u043A\u0430", value: divergencePct !== null ? `${divergencePct > 0 ? "+" : ""}${formatNumber(divergencePct, { maximumFractionDigits: 1 })}%` : NOT_SET })] }), diagZones.length > 0 ? (_jsx("div", { className: "overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2 font-semibold", children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "Q_RC, \u043A\u0412\u0442" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "Q_\u0441\u0442\u0430\u0442, \u043A\u0412\u0442" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "q, \u0412\u0442/\u043C\u00B2" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0422\u0440\u0430\u043D\u0441\u043C., \u043A\u0412\u0442" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0418\u043D\u0444., \u043A\u0412\u0442" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0412\u0435\u043D\u0442., \u043A\u0412\u0442" }), _jsx("th", { className: "px-4 py-2 font-semibold", children: "\u0421\u0442\u0430\u0442\u0443\u0441" })] }) }), _jsxs("tbody", { children: [diagZones.map((zone) => {
                                                const zoneStaticKW = Math.max(0, zone.totalLossW - zone.internalGainsW) / 1000;
                                                return (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsx("td", { className: "px-4 py-2 font-medium text-[color:var(--text-base)]", children: zone.zoneName }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(zone.heatingPowerW / 1000, "кВт", 2) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(zoneStaticKW, "кВт", 2) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(zone.peakSpecificLoad_W_m2, "Вт/м²", 1) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(zone.transmissionLossW / 1000, "кВт", 2) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(zone.lossInfiltrationW / 1000, "кВт", 2) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(zone.lossMechanicalVentilationW / 1000, "кВт", 2) }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: statusBadgeClass(zone.status), children: formatZoneStatusLabel(zone.status) }) })] }, zone.zoneId));
                                            }), _jsxs("tr", { className: "border-t-2 border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] font-semibold", children: [_jsx("td", { className: "px-4 py-2 text-[color:var(--text-base)]", children: "\u0417\u0434\u0430\u043D\u0438\u0435 (\u0438\u0442\u043E\u0433\u043E)" }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(peakRcKW, "кВт", 2) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(staticQReqKW, "кВт", 2) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(diagBuilding?.specificPeakLoad_W_m2, "Вт/м²", 1) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(diagBuilding ? diagBuilding.totalTransmissionLossW / 1000 : null, "кВт", 2) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(diagBuilding ? diagBuilding.totalInfiltrationLossW / 1000 : null, "кВт", 2) }), _jsx("td", { className: "px-4 py-2", children: formatOptionalNumber(diagBuilding ? diagBuilding.totalMechanicalVentilationLossW / 1000 : null, "кВт", 2) }), _jsx("td", { className: "px-4 py-2" })] })] })] }) })) : null] }) }), _jsxs("section", { className: "ui-panel-muted space-y-4 rounded-2xl p-4", children: [_jsxs("div", { className: "flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E\u0435 \u0440\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043F\u043E\u0442\u0435\u0440\u044C \u0438 \u043D\u0430\u0433\u0440\u0443\u0437\u043E\u043A" }), _jsx("div", { className: "flex flex-wrap gap-2", children: ROOM_VIEW_ITEMS.map((item) => (_jsx("button", { type: "button", onClick: () => setRoomView(item.id), className: item.id === roomView ? "ui-btn-primary px-3 py-1.5 text-xs" : "ui-btn-secondary px-3 py-1.5 text-xs", children: item.label }, item.id))) })] }), hasDiagnosticsBreakdown ? (_jsxs(_Fragment, { children: [roomView === "stacked" ? (_jsx(RoomLossStackedChart, { rows: zoneRows, selectedRoomId: selectedSpaceId, onSelectRoom: selectSpace })) : null, roomView === "heatmap" ? (_jsx(RoomHeatmapMatrix, { rows: zoneRows, selectedRoomId: selectedSpaceId, onSelectRoom: selectSpace })) : null, roomView === "scatter" ? (_jsx(RoomScatterPlot, { rows: zoneRows, selectedRoomId: selectedSpaceId, setpointC: activeOptions.setpoints.day, onSelectRoom: selectSpace })) : null] })) : (_jsx(ChartEmptyState, { text: "\u0412 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0435 \u043D\u0435\u0442 \u0440\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C." }))] }), _jsxs("section", { className: "ui-panel-muted space-y-3 rounded-2xl p-4", "data-testid": "scenario-compare-panel", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432" }), scenarioRunHistory.length > 0 ? (_jsx("span", { className: "rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-2 py-0.5 text-xs text-[color:var(--text-soft)]", children: scenarioRunHistory.length })) : null] }), scenarioRunHistory.length === 0 ? (_jsx(ChartEmptyState, { text: "\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442, \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C \u043D\u0430\u043A\u0430\u043F\u043B\u0438\u0432\u0430\u0442\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432." })) : (_jsxs("div", { className: "space-y-3", children: [scenarioRunHistory.length >= 2 ? (_jsx("div", { className: "h-44 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 pb-1 pt-3", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: compareChartData, margin: { top: 4, right: 16, bottom: 4, left: 4 }, children: [_jsx(CartesianGrid, { stroke: "var(--chart-grid)", strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "name", tick: { fill: "var(--text-soft)", fontSize: 11 } }), _jsx(YAxis, { tick: { fill: "var(--text-soft)", fontSize: 11 }, tickFormatter: (v) => formatNumber(Number(v), { maximumFractionDigits: 0 }), width: 52, children: _jsx(Label, { value: "\u043A\u0412\u0442\u00B7\u0447", angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 } }) }), _jsx(RechartsTooltip, { formatter: (v) => [formatEnergy(v, "кВт·ч"), "Энергия"], labelFormatter: (_name, payload) => payload?.[0]?.payload?.label ?? _name, contentStyle: METRICS_CHART_TOOLTIP_STYLE }), _jsx(ReferenceLine, { y: scenarioRunHistory[0].totalEnergyKWh, stroke: "var(--chart-line-muted)", strokeDasharray: "4 4", label: { value: "база", position: "insideTopRight", fill: "var(--text-soft)", fontSize: 10 } }), _jsx(Bar, { dataKey: "energyKWh", radius: [6, 6, 0, 0], children: compareChartData.map((entry, index) => (_jsx(Cell, { fill: index === 0 ? "var(--chart-line-muted)" : "var(--accent-base)" }, entry.name))) })] }) }) })) : null, _jsx("div", { className: "overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-xs uppercase tracking-wide text-[color:var(--text-soft)]", children: [_jsx("th", { className: "px-4 py-2", children: "\u041F\u0440\u043E\u0433\u043E\u043D" }), _jsx("th", { className: "px-4 py-2", children: "\u041F\u0438\u043A, \u043A\u0412\u0442" }), scenarioRunHistory.length >= 2 ? _jsx("th", { className: "px-4 py-2", children: "\u0394 \u043F\u0438\u043A" }) : null, _jsx("th", { className: "px-4 py-2", children: "\u042D\u043D\u0435\u0440\u0433\u0438\u044F, \u043A\u0412\u0442\u00B7\u0447" }), scenarioRunHistory.length >= 2 ? _jsx("th", { className: "px-4 py-2", children: "\u0394 \u044D\u043D\u0435\u0440\u0433\u0438\u044F" }) : null, _jsx("th", { className: "px-4 py-2", children: "\u0414\u0438\u0441\u043A\u043E\u043C\u0444\u043E\u0440\u0442, \u0447" }), scenarioRunHistory.length >= 2 ? _jsx("th", { className: "px-4 py-2", children: "\u0394" }) : null, _jsx("th", { className: "px-4 py-2", children: "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B" })] }) }), _jsx("tbody", { children: compareTableRows.map((row) => (_jsxs("tr", { className: "border-t border-[color:var(--border-soft)]", children: [_jsxs("td", { className: "px-4 py-2", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [row.isBaseline ? (_jsx("span", { className: "rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-soft)]", children: "\u0431\u0430\u0437\u0430" })) : null, _jsx("span", { className: "font-semibold text-[color:var(--text-base)]", children: row.label })] }), _jsx("div", { className: "mt-0.5 text-xs text-[color:var(--text-soft)]", children: formatRunTime(row.savedAt) })] }), _jsx("td", { className: `px-4 py-2 font-medium ${row.isPeakMin ? "text-[color:var(--success-fg)]" : row.isPeakMax ? "text-[color:var(--warning-border)]" : ""}`, children: formatOptionalNumber(row.peakLoadKW, "кВт", 2) }), scenarioRunHistory.length >= 2 ? (_jsx("td", { className: `px-4 py-2 text-xs ${deltaClass(row.deltaPeak)}`, children: formatDeltaPercent(row.deltaPeak) })) : null, _jsx("td", { className: `px-4 py-2 font-medium ${row.isEnergyMin ? "text-[color:var(--success-fg)]" : row.isEnergyMax ? "text-[color:var(--warning-border)]" : ""}`, children: formatEnergy(row.totalEnergyKWh, "кВт·ч") }), scenarioRunHistory.length >= 2 ? (_jsx("td", { className: `px-4 py-2 text-xs ${deltaClass(row.deltaEnergy)}`, children: formatDeltaPercent(row.deltaEnergy) })) : null, _jsx("td", { className: `px-4 py-2 ${row.isDiscomfortMin ? "text-[color:var(--success-fg)]" : row.isDiscomfortMax ? "text-[color:var(--warning-border)]" : ""}`, children: formatOptionalNumber(row.discomfortHours, "ч", 1) }), scenarioRunHistory.length >= 2 ? (_jsx("td", { className: `px-4 py-2 text-xs ${deltaClass(row.deltaDiscomfort)}`, children: formatDeltaPercent(row.deltaDiscomfort) })) : null, _jsx("td", { className: "px-4 py-2 text-xs text-[color:var(--text-soft)]", children: _jsx(CompareParamsCell, { run: row }) })] }, row.id))) })] }) }), scenarioRunHistory.length === 1 ? (_jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0435\u0449\u0451 \u043E\u0434\u0438\u043D \u0440\u0430\u0441\u0447\u0451\u0442 \u0441 \u0434\u0440\u0443\u0433\u0438\u043C\u0438 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0430\u043C\u0438 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F, \u0447\u0442\u043E\u0431\u044B \u0441\u0440\u0430\u0432\u043D\u0438\u0442\u044C \u043F\u0440\u043E\u0433\u043E\u043D\u044B." })) : null] }))] }), SHOW_INFILTRATION_DIAGNOSTICS && currentResult.diagnostics?.building.infiltration ? (_jsx(InfiltrationDiagnosticsCard, { infiltration: currentResult.diagnostics.building.infiltration })) : null, _jsx(BuildingPerformanceValidationSection, { diagnostics: currentResult.diagnostics?.buildingPerformance }), onRecalculate ? (_jsx("button", { type: "button", onClick: onRecalculate, className: "ui-btn-secondary px-5 py-2 text-sm", children: "\u041F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u0442\u044C" })) : null] }));
}
function MetricsPanelCell({ label, value, note, accent = "neutral", featured = false, }) {
    return (_jsxs("article", { className: `ui-metrics-panel__cell ui-metrics-panel__cell--${accent} ${featured ? "ui-metrics-panel__cell--featured" : ""}`, children: [_jsx("span", { className: "ui-metrics-panel__accent", "aria-hidden": "true" }), _jsxs("header", { className: "ui-metrics-panel__cell-head", children: [_jsx("p", { className: "ui-metrics-panel__label", children: label }), note ? (_jsx(MetricInfoTooltip, { title: label, formula: note, children: _jsx("button", { type: "button", className: "ui-metrics-panel__info", "aria-label": `Справка: ${label}`, children: "?" }) })) : null] }), _jsx("div", { className: "ui-metrics-panel__value", children: value })] }));
}
function MetricsInsightPanel({ title, testId, items, footer, }) {
    return (_jsxs("section", { className: "ui-metrics-panel", "data-testid": testId, children: [_jsx("header", { className: "ui-metrics-panel__head", children: _jsx("h3", { className: "ui-metrics-panel__title", children: title }) }), _jsx("div", { className: "ui-metrics-panel__grid", children: items.map((item) => (_jsx(MetricsPanelCell, { ...item }, item.label))) }), footer ? _jsx("div", { className: "ui-metrics-panel__footer", children: footer }) : null] }));
}
function InfiltrationDiagnosticsCard({ infiltration }) {
    const items = [
        {
            label: "Потери тепла",
            value: formatOptionalNumber(infiltration.heatLossW / 1000, "кВт", 2),
            accent: "air",
            featured: true,
        },
        {
            label: "ACH",
            value: formatOptionalNumber(infiltration.calculatedACH, "1/ч", 3),
            note: infiltration.achSource ? `Источник: ${infiltration.achSource}` : undefined,
            accent: "energy",
            featured: true,
        },
        {
            label: "Расход воздуха",
            value: formatOptionalNumber(infiltration.airflowM3h, "м³/ч", 1),
            accent: "air",
        },
    ];
    if (Number.isFinite(infiltration.pressureTotalPa) && infiltration.pressureTotalPa > 0) {
        items.push({
            label: "Давление",
            value: (_jsxs(_Fragment, { children: [formatOptionalNumber(infiltration.pressureTotalPa, "Па", 1), _jsxs("span", { className: "ui-metrics-panel__value-meta", children: [" ", "\u00B7 \u0432\u0435\u0442\u0435\u0440 ", formatOptionalNumber(infiltration.pressureWindPa, "Па", 1), " + \u0433\u0440\u0430\u0432\u0438\u0442\u0430\u0446\u0438\u044F", " ", formatOptionalNumber(infiltration.pressureStackPa, "Па", 1)] })] })),
            accent: "info",
        });
    }
    return (_jsx(MetricsInsightPanel, { title: "\u0420\u0430\u0441\u0447\u0451\u0442 \u0438\u043D\u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u0438", testId: "infiltration-diagnostics-card", items: items, footer: null }));
}
function buildCompareTableRows(history) {
    if (!history.length)
        return [];
    const baseline = history[0];
    const peaks = history.map((r) => r.peakLoadKW);
    const energies = history.map((r) => r.totalEnergyKWh);
    const discomforts = history.map((r) => r.discomfortHours);
    const minPeak = Math.min(...peaks), maxPeak = Math.max(...peaks);
    const minEnergy = Math.min(...energies), maxEnergy = Math.max(...energies);
    const minDiscomfort = Math.min(...discomforts), maxDiscomfort = Math.max(...discomforts);
    const multi = history.length >= 2;
    return history.map((run, index) => ({
        ...run,
        isBaseline: index === 0,
        deltaPeak: !multi || index === 0 ? null : safeDeltaPercent(run.peakLoadKW, baseline.peakLoadKW),
        deltaEnergy: !multi || index === 0 ? null : safeDeltaPercent(run.totalEnergyKWh, baseline.totalEnergyKWh),
        deltaDiscomfort: !multi || index === 0 ? null : safeDeltaPercent(run.discomfortHours, baseline.discomfortHours),
        isPeakMin: multi && run.peakLoadKW === minPeak,
        isPeakMax: multi && run.peakLoadKW === maxPeak,
        isEnergyMin: multi && run.totalEnergyKWh === minEnergy,
        isEnergyMax: multi && run.totalEnergyKWh === maxEnergy,
        isDiscomfortMin: multi && run.discomfortHours === minDiscomfort,
        isDiscomfortMax: multi && run.discomfortHours === maxDiscomfort,
    }));
}
function safeDeltaPercent(value, baseline) {
    if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0)
        return null;
    return ((value - baseline) / baseline) * 100;
}
function formatDeltaPercent(delta) {
    if (delta === null)
        return "—";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${formatNumber(delta, { maximumFractionDigits: 1 })}%`;
}
function deltaClass(delta) {
    if (delta === null)
        return "";
    if (delta > 5)
        return "text-[color:var(--warning-border)]";
    if (delta < -5)
        return "text-[color:var(--success-fg)]";
    return "";
}
function formatRunTime(savedAt) {
    try {
        const d = new Date(savedAt);
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const mins = String(d.getMinutes()).padStart(2, "0");
        return `${day}.${month} · ${hours}:${mins}`;
    }
    catch {
        return "";
    }
}
function CompareParamsCell({ run }) {
    const items = [];
    if (run.setpointDayC != null)
        items.push(`уставка ${formatNumber(run.setpointDayC, { maximumFractionDigits: 0 })} °C`);
    if (run.infiltrationACH != null)
        items.push(`инф. ${formatNumber(run.infiltrationACH, { maximumFractionDigits: 2 })} 1/ч`);
    if (run.ventilationACH != null && run.ventilationACH > 0)
        items.push(`вент. ${formatNumber(run.ventilationACH, { maximumFractionDigits: 2 })} 1/ч`);
    if (!items.length)
        return _jsx("span", { children: "\u2014" });
    return (_jsx("div", { className: "space-y-0.5", children: items.map((item) => (_jsx("div", { children: item }, item))) }));
}
const METRICS_CHART_TOOLTIP_STYLE = {
    background: "var(--surface-elevated)",
    border: "1px solid var(--border-soft)",
    borderRadius: 12,
    fontSize: 12,
};
function ChartEmptyState({ text }) {
    return (_jsx("div", { className: "flex h-40 items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] px-4 text-center text-sm text-[color:var(--text-soft)]", children: text }));
}
function formatOptionalNumber(value, unit, digits = 2) {
    if (!Number.isFinite(value)) {
        return NOT_SET;
    }
    const formatted = formatNumber(value, { maximumFractionDigits: digits });
    return unit ? `${formatted} ${unit}` : formatted;
}
function derivedMetricNumber(metric) {
    return metric?.value ?? null;
}
function formatDerivedMetric(value, unit, digits = 2) {
    if (!Number.isFinite(value)) {
        return NOT_SET;
    }
    return `${formatNumber(value, { maximumFractionDigits: digits })} ${unit}`;
}
function DerivedMetricTile({ label, value, info, }) {
    return (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: label }), _jsx(MetricInfoTooltip, { ...info })] }), _jsx("p", { className: "mt-1 text-base font-semibold text-[color:var(--text-base)]", children: value })] }));
}
function ThermalConsistencySummarySection({ report }) {
    const actionableChecks = report.invariants.filter((item) => item.status !== "INFO");
    const passCount = report.invariants.filter((item) => item.status === "PASS").length;
    const warnCount = report.invariants.filter((item) => item.status === "WARN").length;
    const failCount = report.invariants.filter((item) => item.status === "FAIL").length;
    const peakInvariant = report.invariants.find((item) => item.id === "INV-06") ?? null;
    const energyDeltaPercent = Math.abs(report.energyIntegration.differencePercent);
    const peakDeltaPercent = Math.abs(peakInvariant?.differencePercent ?? 0);
    const keyIssues = report.invariants.filter((item) => item.status === "FAIL" || item.status === "WARN").slice(0, 3);
    const checksSummary = failCount > 0
        ? `${failCount} fail`
        : warnCount > 0
            ? `${warnCount} warn`
            : `${passCount} pass`;
    return (_jsx(CollapsibleSection, { title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430", description: "\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u043E\u0441\u0442\u044C timeline, summary \u0438 diagnostics \u0434\u043B\u044F \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E RC-\u0440\u0430\u0441\u0447\u0451\u0442\u0430.", children: _jsxs("section", { className: "ui-panel-muted mt-3 space-y-3 rounded-2xl p-4", "data-testid": "thermal-consistency-summary", children: [_jsx(SummaryHighlightGrid, { items: [
                        {
                            label: "Статус",
                            value: formatConsistencyStatus(report.overallStatus),
                            hint: checksSummary,
                            tone: consistencyTone(report.overallStatus),
                        },
                        {
                            label: "Энергия Δ",
                            value: formatPercentMagnitude(energyDeltaPercent),
                            hint: `${formatNumber(report.energyIntegration.recomputedEnergyKWh, { maximumFractionDigits: 2 })} vs ${formatNumber(report.energyIntegration.reportedSummaryEnergyKWh, { maximumFractionDigits: 2 })} кВт·ч`,
                            tone: energyDeltaPercent < 0.5 ? "success" : "warning",
                        },
                        {
                            label: "Пик Δ",
                            value: formatPercentMagnitude(peakDeltaPercent),
                            hint: "timeline vs summary",
                            tone: peakDeltaPercent < 0.5 ? "success" : "warning",
                        },
                        {
                            label: "Проверки",
                            value: `${passCount}/${actionableChecks.length}`,
                            hint: "PASS / все проверки",
                            tone: failCount > 0 ? "warning" : warnCount > 0 ? "info" : "success",
                        },
                    ] }), keyIssues.length ? (_jsx("div", { className: "space-y-1 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3", children: keyIssues.map((item) => (_jsxs("p", { className: "text-sm text-[color:var(--text-muted)]", children: [_jsx("span", { className: "font-semibold text-[color:var(--text-base)]", children: item.id }), ": ", item.label, formatConsistencyIssueDelta(item)] }, item.id))) })) : (_jsx("p", { className: "text-sm text-[color:var(--text-muted)]", children: "\u041A\u0440\u0438\u0442\u0438\u0447\u043D\u044B\u0445 \u0440\u0430\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0439 \u043C\u0435\u0436\u0434\u0443 \u0440\u0430\u0441\u0447\u0451\u0442\u043E\u043C \u0438 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044F\u043C\u0438 \u043E\u0442\u0447\u0451\u0442\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E." }))] }) }));
}
function SizingKpiTile({ label, value, accent = false, }) {
    return (_jsxs("div", { className: `rounded-2xl border px-4 py-3 ${accent
            ? "border-[color:var(--accent-base)]/35 bg-[color:var(--accent-muted)]/20"
            : "border-[color:var(--border-soft)] bg-[color:var(--surface-base)]"}`, children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: label }), _jsx("p", { className: `mt-1 text-base font-semibold ${accent ? "text-[color:var(--accent-base)]" : "text-[color:var(--text-base)]"}`, children: value })] }));
}
function formatConsistencyStatus(status) {
    switch (status) {
        case "PASS":
            return "OK";
        case "WARN":
            return "Проверить";
        case "FAIL":
            return "Расхождение";
        default:
            return "Инфо";
    }
}
function consistencyTone(status) {
    switch (status) {
        case "PASS":
            return "success";
        case "WARN":
        case "FAIL":
            return "warning";
        default:
            return "info";
    }
}
function formatPercentMagnitude(value) {
    return `${formatNumber(value, { maximumFractionDigits: 2 })}%`;
}
function formatConsistencyIssueDelta(item) {
    if (item.differencePercent !== undefined && Number.isFinite(item.differencePercent)) {
        return ` (Δ ${formatPercentMagnitude(Math.abs(item.differencePercent))})`;
    }
    if (item.differenceAbs !== undefined && Number.isFinite(item.differenceAbs)) {
        return ` (Δ ${formatNumber(Math.abs(item.differenceAbs), { maximumFractionDigits: 2 })}${item.unit ? ` ${item.unit}` : ""})`;
    }
    return "";
}
export default MetricsResultsTab;
