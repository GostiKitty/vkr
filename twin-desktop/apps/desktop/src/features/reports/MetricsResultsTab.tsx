import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { extractLossSharePercent } from "../../core/thermal/thermalSimulationExport";
import {
  buildBuildingLossSeries,
  buildKpiPayload,
  buildThermalResultCapabilities,
  buildZoneSeries,
} from "../../core/thermal/thermalResultsChartPayload";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore, type ScenarioRunSnapshot } from "../../entities/workflow/workflow.store";
import {
  CollapsibleSection,
  MetricInfoTooltip,
  SummaryHighlightGrid,
} from "../../shared/ui";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
import { BuildingLossChart } from "./charts/BuildingLossChart";
import { useThermalChartResult } from "./charts/useThermalChartResult";
import { LossShareChart } from "./charts/LossShareChart";
import { RoomHeatmapMatrix } from "./charts/RoomHeatmapMatrix";
import { RoomLossStackedChart } from "./charts/RoomLossStackedChart";
import { RoomScatterPlot } from "./charts/RoomScatterPlot";
import { ThermalTimeSeriesChartBlock } from "./charts/ThermalTimeSeriesChartBlock";
import {
  formatChartPower,
  formatZoneStatusLabel,
  statusBadgeClass,
  THERMAL_CHART_NOT_SET,
} from "./charts/thermalChartTheme";
import { resultsMetricInfo, type MetricInfoDefinition } from "./resultsMetricInfo";
import BuildingPerformanceResultsSection, {
  BuildingPerformanceValidationSection,
} from "./BuildingPerformanceResultsSection";

interface MetricsResultsTabProps {
  onRecalculate?: () => void;
  onEditUncertainty?: () => void;
}

type RoomView = "stacked" | "heatmap" | "scatter";

const NOT_SET = THERMAL_CHART_NOT_SET;
const SHOW_INFILTRATION_DIAGNOSTICS = false;

const ROOM_VIEW_ITEMS: Array<{ id: RoomView; label: string }> = [
  { id: "stacked", label: "Потери по помещениям" },
  { id: "heatmap", label: "Матрица" },
  { id: "scatter", label: "Аномалии" },
];

export function MetricsResultsTab({ onRecalculate, onEditUncertainty }: MetricsResultsTabProps) {
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const selectSpace = useTwinStore((state) => state.selectSpace);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const scenarioRunHistory = useWorkflowStore((state) => state.scenarioRunHistory);
  const [roomView, setRoomView] = useState<RoomView>("stacked");
  const { chartResult, resultState, chartPreview, activeOptions } = useThermalChartResult();

  const lossShare = useMemo(() => (chartResult ? extractLossSharePercent(chartResult) : null), [chartResult]);

  if (resultState === "stale") {
    return (
      <div className="space-y-4">
        <ThermalTimeSeriesChartBlock heatingDisplay="equipment" onRunCalculation={onRecalculate} />
      </div>
    );
  }

  if (!chartResult) {
    return (
      <div className="space-y-4" data-testid="thermal-results-panel">
        <ThermalTimeSeriesChartBlock heatingDisplay="equipment" onRunCalculation={onRecalculate} />
        {onRecalculate ? (
          <button type="button" onClick={onRecalculate} className="ui-btn-primary px-5 py-2 text-sm">
            Запустить расчёт
          </button>
        ) : null}
      </div>
    );
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
  const divergencePct =
    staticQReqKW !== null && peakRcKW > 0
      ? ((staticQReqKW - peakRcKW) / peakRcKW) * 100
      : null;
  const hTotal = derived?.totalHeatLossCoefficient_W_K.value ?? null;
  return (
    <div className="space-y-6" data-testid="thermal-results-panel">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-1.5">
          RC-физика
          <MetricInfoTooltip {...resultsMetricInfo.rcBalance} />
        </span>
        {capabilities.climateBaseLabel ? (
          <span className="inline-flex rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-1.5">
            {capabilities.climateBaseLabel}
          </span>
        ) : null}
      </div>

      <SummaryHighlightGrid
        items={[
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
        ]}
      />

      {derived ? (
        <CollapsibleSection title="Дополнительные показатели и проверки">
        <section className="ui-panel-muted mt-3 space-y-4 rounded-2xl p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DerivedMetricTile label="H_tr" value={formatDerivedMetric(derivedMetricNumber(derived.transmissionHeatLossCoefficient_W_K), "Вт/К", 1)} info={resultsMetricInfo.heatLossCoefficientTransmission} />
            <DerivedMetricTile label="H_ve" value={formatDerivedMetric(derivedMetricNumber(derived.ventilationHeatLossCoefficient_W_K), "Вт/К", 1)} info={resultsMetricInfo.heatLossCoefficientVentilation} />
            <DerivedMetricTile label="H_total" value={formatDerivedMetric(derivedMetricNumber(derived.totalHeatLossCoefficient_W_K), "Вт/К", 1)} info={resultsMetricInfo.heatLossCoefficientTotal} />
            <DerivedMetricTile label="τ здания" value={formatDerivedMetric(derivedMetricNumber(derived.buildingTauHours), "ч", 1)} info={resultsMetricInfo.thermalTimeConstant} />
            <DerivedMetricTile label="q_A" value={formatDerivedMetric(derivedMetricNumber(derived.specificIndicators?.qArea_W_m2), "Вт/м²", 1)} info={resultsMetricInfo.specificLoadArea} />
            <DerivedMetricTile label="q_V" value={formatDerivedMetric(derivedMetricNumber(derived.specificIndicators?.qVolume_W_m3), "Вт/м³", 2)} info={resultsMetricInfo.specificLoadVolume} />
            <DerivedMetricTile label="q_VΔT" value={formatDerivedMetric(derivedMetricNumber(derived.specificIndicators?.qVolumeDeltaT_W_m3K), "Вт/(м³·К)", 3)} info={resultsMetricInfo.specificLoadVolume} />
            <DerivedMetricTile label="Рекуперация" value={formatDerivedMetric(derivedMetricNumber(derived.ventilationRecovery?.savedByRecovery_W), "Вт", 1)} info={resultsMetricInfo.ventilationRecovery} />
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.15fr,0.85fr]">
            <CollapsibleSection
              title="Свободное остывание"
              titleAddon={<MetricInfoTooltip {...resultsMetricInfo.freeCooling} />}
            >
              <div className="grid gap-2 pt-3 sm:grid-cols-2 xl:grid-cols-4">
                {(derived.freeCooling ?? []).map((point) => (
                  <div key={point.hours} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
                    <p className="text-sm font-semibold text-[color:var(--text-muted)]">{point.hours} ч</p>
                    <p className="mt-1 text-base font-semibold text-[color:var(--text-base)]">
                      {formatDerivedMetric(point.temperatureC.value, "°C", 1)}
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Тепловая постоянная времени по помещениям"
              titleAddon={<MetricInfoTooltip {...resultsMetricInfo.thermalTimeConstant} />}
            >
              <div className="overflow-x-auto pt-3">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-sm text-[color:var(--text-soft)]">
                      <th className="px-3 py-2 font-semibold">Помещение</th>
                      <th className="px-3 py-2 font-semibold">τ</th>
                      <th className="px-3 py-2 font-semibold">H</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(derived.zoneTauHours ?? []).slice(0, 6).map((zone) => (
                      <tr key={zone.zoneId} className="border-t border-[color:var(--border-soft)]">
                        <td className="px-3 py-2 font-medium text-[color:var(--text-base)]">{zone.zoneName}</td>
                        <td className="px-3 py-2">{formatDerivedMetric(zone.tauHours.value, "ч", 1)}</td>
                        <td className="px-3 py-2">{formatDerivedMetric(zone.heatLossCoefficient_W_K.value, "Вт/К", 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          </div>
        </section>
        </CollapsibleSection>
      ) : null}

      <ThermalTimeSeriesChartBlock heatingDisplay="equipment" onRunCalculation={onRecalculate} />

      <div className="grid gap-4 xl:grid-cols-[1.25fr,0.95fr]">
        <BuildingLossChart rows={buildingLossRows} />
        {lossShare ? (
          <LossShareChart share={lossShare} />
        ) : (
          <section className="ui-chart-shell">
            <p className="text-sm font-semibold text-[color:var(--text-base)]">Структура теплопотерь</p>
            <ChartEmptyState text="Доли потерь не заданы." />
          </section>
        )}
      </div>

      <BuildingPerformanceResultsSection diagnostics={currentResult.diagnostics?.buildingPerformance} />

      <CollapsibleSection title="Требуемая мощность источника тепла">
        <section className="ui-panel-muted mt-3 space-y-4 rounded-2xl p-4" data-testid="heating-sizing-section">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SizingKpiTile label="Пик RC" value={formatOptionalNumber(peakRcKW, "кВт", 2)} />
          <SizingKpiTile label="Статич. Q_req" value={formatOptionalNumber(staticQReqKW, "кВт", 2)} />
          <SizingKpiTile label="С запасом ×1.15" value={formatOptionalNumber(peakRcKW * 1.15, "кВт", 2)} accent />
          <SizingKpiTile label="С запасом ×1.25" value={formatOptionalNumber(peakRcKW * 1.25, "кВт", 2)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SizingKpiTile label="Уд. нагрузка" value={formatOptionalNumber(diagBuilding?.specificPeakLoad_W_m2, "Вт/м²", 1)} />
          <SizingKpiTile label="H_total" value={formatOptionalNumber(hTotal, "Вт/К", 1)} />
          <SizingKpiTile
            label="Расхождение RC–статика"
            value={divergencePct !== null ? `${divergencePct > 0 ? "+" : ""}${formatNumber(divergencePct, { maximumFractionDigits: 1 })}%` : NOT_SET}
          />
        </div>

        {/* Per-zone table */}
        {diagZones.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                  <th className="px-4 py-2 font-semibold">Помещение</th>
                  <th className="px-4 py-2 font-semibold">Q_RC, кВт</th>
                  <th className="px-4 py-2 font-semibold">Q_стат, кВт</th>
                  <th className="px-4 py-2 font-semibold">q, Вт/м²</th>
                  <th className="px-4 py-2 font-semibold">Трансм., кВт</th>
                  <th className="px-4 py-2 font-semibold">Инф., кВт</th>
                  <th className="px-4 py-2 font-semibold">Вент., кВт</th>
                  <th className="px-4 py-2 font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody>
                {diagZones.map((zone) => {
                  const zoneStaticKW = Math.max(0, zone.totalLossW - zone.internalGainsW) / 1000;
                  return (
                    <tr key={zone.zoneId} className="border-t border-[color:var(--border-soft)]">
                      <td className="px-4 py-2 font-medium text-[color:var(--text-base)]">{zone.zoneName}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.heatingPowerW / 1000, "кВт", 2)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zoneStaticKW, "кВт", 2)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.peakSpecificLoad_W_m2, "Вт/м²", 1)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.transmissionLossW / 1000, "кВт", 2)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.lossInfiltrationW / 1000, "кВт", 2)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.lossMechanicalVentilationW / 1000, "кВт", 2)}</td>
                      <td className="px-4 py-2">
                        <span className={statusBadgeClass(zone.status)}>{formatZoneStatusLabel(zone.status)}</span>
                      </td>
                    </tr>
                  );
                })}
                {/* Building total row */}
                <tr className="border-t-2 border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] font-semibold">
                  <td className="px-4 py-2 text-[color:var(--text-base)]">Здание (итого)</td>
                  <td className="px-4 py-2">{formatOptionalNumber(peakRcKW, "кВт", 2)}</td>
                  <td className="px-4 py-2">{formatOptionalNumber(staticQReqKW, "кВт", 2)}</td>
                  <td className="px-4 py-2">{formatOptionalNumber(diagBuilding?.specificPeakLoad_W_m2, "Вт/м²", 1)}</td>
                  <td className="px-4 py-2">{formatOptionalNumber(diagBuilding ? diagBuilding.totalTransmissionLossW / 1000 : null, "кВт", 2)}</td>
                  <td className="px-4 py-2">{formatOptionalNumber(diagBuilding ? diagBuilding.totalInfiltrationLossW / 1000 : null, "кВт", 2)}</td>
                  <td className="px-4 py-2">{formatOptionalNumber(diagBuilding ? diagBuilding.totalMechanicalVentilationLossW / 1000 : null, "кВт", 2)}</td>
                  <td className="px-4 py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
        </section>
      </CollapsibleSection>

      <section className="ui-panel-muted space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Инженерное разложение потерь и нагрузок</p>
          <div className="flex flex-wrap gap-2">
            {ROOM_VIEW_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRoomView(item.id)}
                className={item.id === roomView ? "ui-btn-primary px-3 py-1.5 text-xs" : "ui-btn-secondary px-3 py-1.5 text-xs"}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {hasDiagnosticsBreakdown ? (
          <>
            {roomView === "stacked" ? (
              <RoomLossStackedChart rows={zoneRows} selectedRoomId={selectedSpaceId} onSelectRoom={selectSpace} />
            ) : null}
            {roomView === "heatmap" ? (
              <RoomHeatmapMatrix rows={zoneRows} selectedRoomId={selectedSpaceId} onSelectRoom={selectSpace} />
            ) : null}
            {roomView === "scatter" ? (
              <RoomScatterPlot
                rows={zoneRows}
                selectedRoomId={selectedSpaceId}
                setpointC={activeOptions.setpoints.day}
                onSelectRoom={selectSpace}
              />
            ) : null}

          </>
        ) : (
          <ChartEmptyState text="В текущем результате нет разложения по помещениям." />
        )}
      </section>

      <section className="ui-panel-muted space-y-3 rounded-2xl p-4" data-testid="scenario-compare-panel">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Сравнение прогонов</p>
          {scenarioRunHistory.length > 0 ? (
            <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-2 py-0.5 text-xs text-[color:var(--text-soft)]">
              {scenarioRunHistory.length}
            </span>
          ) : null}
        </div>

        {scenarioRunHistory.length === 0 ? (
          <ChartEmptyState text="Выполните расчёт, чтобы начать накапливать историю прогонов." />
        ) : (
          <div className="space-y-3">
            {/* Bar chart — only when 2+ runs */}
            {scenarioRunHistory.length >= 2 ? (
              <div className="h-44 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 pb-1 pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareChartData} margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-soft)", fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                      tickFormatter={(v) => formatNumber(Number(v), { maximumFractionDigits: 0 })}
                      width={52}
                    >
                      <Label
                        value="кВт·ч"
                        angle={-90}
                        position="insideLeft"
                        style={{ textAnchor: "middle", fill: "var(--text-soft)", fontSize: 11 }}
                      />
                    </YAxis>
                    <RechartsTooltip
                      formatter={(v: number) => [formatEnergy(v, "кВт·ч"), "Энергия"]}
                      labelFormatter={(_name: string, payload) =>
                        (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? _name
                      }
                      contentStyle={METRICS_CHART_TOOLTIP_STYLE}
                    />
                    <ReferenceLine
                      y={scenarioRunHistory[0].totalEnergyKWh}
                      stroke="var(--chart-line-muted)"
                      strokeDasharray="4 4"
                      label={{ value: "база", position: "insideTopRight", fill: "var(--text-soft)", fontSize: 10 }}
                    />
                    <Bar dataKey="energyKWh" radius={[6, 6, 0, 0]}>
                      {compareChartData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={index === 0 ? "var(--chart-line-muted)" : "var(--accent-base)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            {/* Delta table */}
            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                    <th className="px-4 py-2">Прогон</th>
                    <th className="px-4 py-2">Пик, кВт</th>
                    {scenarioRunHistory.length >= 2 ? <th className="px-4 py-2">Δ пик</th> : null}
                    <th className="px-4 py-2">Энергия, кВт·ч</th>
                    {scenarioRunHistory.length >= 2 ? <th className="px-4 py-2">Δ энергия</th> : null}
                    <th className="px-4 py-2">Дискомфорт, ч</th>
                    {scenarioRunHistory.length >= 2 ? <th className="px-4 py-2">Δ</th> : null}
                    <th className="px-4 py-2">Параметры</th>
                  </tr>
                </thead>
                <tbody>
                  {compareTableRows.map((row) => (
                    <tr key={row.id} className="border-t border-[color:var(--border-soft)]">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          {row.isBaseline ? (
                            <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-soft)]">
                              база
                            </span>
                          ) : null}
                          <span className="font-semibold text-[color:var(--text-base)]">{row.label}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-[color:var(--text-soft)]">{formatRunTime(row.savedAt)}</div>
                      </td>
                      <td className={`px-4 py-2 font-medium ${row.isPeakMin ? "text-[color:var(--success-fg)]" : row.isPeakMax ? "text-[color:var(--warning-border)]" : ""}`}>
                        {formatOptionalNumber(row.peakLoadKW, "кВт", 2)}
                      </td>
                      {scenarioRunHistory.length >= 2 ? (
                        <td className={`px-4 py-2 text-xs ${deltaClass(row.deltaPeak)}`}>
                          {formatDeltaPercent(row.deltaPeak)}
                        </td>
                      ) : null}
                      <td className={`px-4 py-2 font-medium ${row.isEnergyMin ? "text-[color:var(--success-fg)]" : row.isEnergyMax ? "text-[color:var(--warning-border)]" : ""}`}>
                        {formatEnergy(row.totalEnergyKWh, "кВт·ч")}
                      </td>
                      {scenarioRunHistory.length >= 2 ? (
                        <td className={`px-4 py-2 text-xs ${deltaClass(row.deltaEnergy)}`}>
                          {formatDeltaPercent(row.deltaEnergy)}
                        </td>
                      ) : null}
                      <td className={`px-4 py-2 ${row.isDiscomfortMin ? "text-[color:var(--success-fg)]" : row.isDiscomfortMax ? "text-[color:var(--warning-border)]" : ""}`}>
                        {formatOptionalNumber(row.discomfortHours, "ч", 1)}
                      </td>
                      {scenarioRunHistory.length >= 2 ? (
                        <td className={`px-4 py-2 text-xs ${deltaClass(row.deltaDiscomfort)}`}>
                          {formatDeltaPercent(row.deltaDiscomfort)}
                        </td>
                      ) : null}
                      <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">
                        <CompareParamsCell run={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {scenarioRunHistory.length === 1 ? (
              <p className="text-xs text-[color:var(--text-soft)]">
                Выполните ещё один расчёт с другими параметрами сценария, чтобы сравнить прогоны.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* Infiltration diagnostics — shown only when building.infiltration is available */}
      {SHOW_INFILTRATION_DIAGNOSTICS && currentResult.diagnostics?.building.infiltration ? (
        <InfiltrationDiagnosticsCard infiltration={currentResult.diagnostics.building.infiltration} />
      ) : null}

      <BuildingPerformanceValidationSection diagnostics={currentResult.diagnostics?.buildingPerformance} />

      {onRecalculate ? (
        <button type="button" onClick={onRecalculate} className="ui-btn-secondary px-5 py-2 text-sm">
          Пересчитать
        </button>
      ) : null}
    </div>
  );
}

interface InfiltrationDiagCard {
  mode: string;
  achSource: string;
  calculatedACH: number;
  airflowM3h: number;
  pressureWindPa: number;
  pressureStackPa: number;
  pressureTotalPa: number;
  heatLossW: number;
  warnings: string[];
  assumptions: string[];
}

type MetricsPanelAccent = "neutral" | "energy" | "air" | "info";

type MetricsPanelItem = {
  label: string;
  value: ReactNode;
  note?: string;
  accent?: MetricsPanelAccent;
  featured?: boolean;
};

function MetricsPanelCell({
  label,
  value,
  note,
  accent = "neutral",
  featured = false,
}: MetricsPanelItem) {
  return (
    <article
      className={`ui-metrics-panel__cell ui-metrics-panel__cell--${accent} ${
        featured ? "ui-metrics-panel__cell--featured" : ""
      }`}
    >
      <span className="ui-metrics-panel__accent" aria-hidden="true" />
      <header className="ui-metrics-panel__cell-head">
        <p className="ui-metrics-panel__label">{label}</p>
        {note ? (
          <MetricInfoTooltip title={label} formula={note}>
            <button type="button" className="ui-metrics-panel__info" aria-label={`Справка: ${label}`}>
              ?
            </button>
          </MetricInfoTooltip>
        ) : null}
      </header>
      <div className="ui-metrics-panel__value">{value}</div>
    </article>
  );
}

function MetricsInsightPanel({
  title,
  testId,
  items,
  footer,
}: {
  title: string;
  testId?: string;
  items: MetricsPanelItem[];
  footer?: ReactNode;
}) {
  return (
    <section className="ui-metrics-panel" data-testid={testId}>
      <header className="ui-metrics-panel__head">
        <h3 className="ui-metrics-panel__title">{title}</h3>
      </header>
      <div className="ui-metrics-panel__grid">
        {items.map((item) => (
          <MetricsPanelCell key={item.label} {...item} />
        ))}
      </div>
      {footer ? <div className="ui-metrics-panel__footer">{footer}</div> : null}
    </section>
  );
}

function InfiltrationDiagnosticsCard({ infiltration }: { infiltration: InfiltrationDiagCard }) {
  const items: MetricsPanelItem[] = [
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
      value: (
        <>
          {formatOptionalNumber(infiltration.pressureTotalPa, "Па", 1)}
          <span className="ui-metrics-panel__value-meta">
            {" "}
            · ветер {formatOptionalNumber(infiltration.pressureWindPa, "Па", 1)} + гравитация{" "}
            {formatOptionalNumber(infiltration.pressureStackPa, "Па", 1)}
          </span>
        </>
      ),
      accent: "info",
    });
  }

  return (
    <MetricsInsightPanel
      title="Расчёт инфильтрации"
      testId="infiltration-diagnostics-card"
      items={items}
      footer={null}
    />
  );
}

// ─── Scenario compare helpers ────────────────────────────────────────────────

type CompareTableRow = ScenarioRunSnapshot & {
  isBaseline: boolean;
  deltaPeak: number | null;
  deltaEnergy: number | null;
  deltaDiscomfort: number | null;
  isPeakMin: boolean;
  isPeakMax: boolean;
  isEnergyMin: boolean;
  isEnergyMax: boolean;
  isDiscomfortMin: boolean;
  isDiscomfortMax: boolean;
};

function buildCompareTableRows(history: ScenarioRunSnapshot[]): CompareTableRow[] {
  if (!history.length) return [];
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

function safeDeltaPercent(value: number, baseline: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) return null;
  return ((value - baseline) / baseline) * 100;
}

function formatDeltaPercent(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatNumber(delta, { maximumFractionDigits: 1 })}%`;
}

function deltaClass(delta: number | null): string {
  if (delta === null) return "";
  if (delta > 5) return "text-[color:var(--warning-border)]";
  if (delta < -5) return "text-[color:var(--success-fg)]";
  return "";
}

function formatRunTime(savedAt: string): string {
  try {
    const d = new Date(savedAt);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day}.${month} · ${hours}:${mins}`;
  } catch {
    return "";
  }
}

function CompareParamsCell({ run }: { run: CompareTableRow }) {
  const items: string[] = [];
  if (run.setpointDayC != null)
    items.push(`уставка ${formatNumber(run.setpointDayC, { maximumFractionDigits: 0 })} °C`);
  if (run.infiltrationACH != null)
    items.push(`инф. ${formatNumber(run.infiltrationACH, { maximumFractionDigits: 2 })} 1/ч`);
  if (run.ventilationACH != null && run.ventilationACH > 0)
    items.push(`вент. ${formatNumber(run.ventilationACH, { maximumFractionDigits: 2 })} 1/ч`);
  if (!items.length) return <span>—</span>;
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <div key={item}>{item}</div>
      ))}
    </div>
  );
}

const METRICS_CHART_TOOLTIP_STYLE = {
  background: "var(--surface-elevated)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  fontSize: 12,
};

function ChartEmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] px-4 text-center text-sm text-[color:var(--text-soft)]">
      {text}
    </div>
  );
}

function formatOptionalNumber(value: number | null | undefined, unit?: string, digits = 2): string {
  if (!Number.isFinite(value)) {
    return NOT_SET;
  }
  const formatted = formatNumber(value, { maximumFractionDigits: digits });
  return unit ? `${formatted} ${unit}` : formatted;
}

function derivedMetricNumber(metric: { value: number | null } | null | undefined): number | null {
  return metric?.value ?? null;
}

function formatDerivedMetric(value: number | null | undefined, unit: string, digits = 2): string {
  if (!Number.isFinite(value)) {
    return NOT_SET;
  }
  return `${formatNumber(value, { maximumFractionDigits: digits })} ${unit}`;
}

function DerivedMetricTile({
  label,
  value,
  info,
}: {
  label: string;
  value: string;
  info: MetricInfoDefinition;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[color:var(--text-muted)]">{label}</p>
        <MetricInfoTooltip {...info} />
      </div>
      <p className="mt-1 text-base font-semibold text-[color:var(--text-base)]">{value}</p>
    </div>
  );
}

function SizingKpiTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        accent
          ? "border-[color:var(--accent-base)]/35 bg-[color:var(--accent-muted)]/20"
          : "border-[color:var(--border-soft)] bg-[color:var(--surface-base)]"
      }`}
    >
      <p className="text-sm font-semibold text-[color:var(--text-muted)]">{label}</p>
      <p className={`mt-1 text-base font-semibold ${accent ? "text-[color:var(--accent-base)]" : "text-[color:var(--text-base)]"}`}>
        {value}
      </p>
    </div>
  );
}

export default MetricsResultsTab;
