import { useMemo, useState } from "react";
import { extractLossSharePercent } from "../../core/thermal/thermalSimulationExport";
import {
  buildBuildingLossSeries,
  buildKpiPayload,
  buildMissingResultFieldLabels,
  buildScenarioHistoryCompareRows,
  buildThermalResultCapabilities,
  buildZoneSeries,
} from "../../core/thermal/thermalResultsChartPayload";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useBuildStore } from "../build/build.store";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import SpaceViewer3D from "../twin/SpaceViewer3D";
import {
  CollapsibleSection,
  EngineeringCallout,
  EngineeringSectionHeader,
  MetricInfoTooltip,
  SummaryHighlightGrid,
} from "../../shared/ui";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { BuildingLossChart } from "./charts/BuildingLossChart";
import { LossShareChart } from "./charts/LossShareChart";
import { RoomHeatmapMatrix } from "./charts/RoomHeatmapMatrix";
import { RoomLossStackedChart } from "./charts/RoomLossStackedChart";
import { RoomScatterPlot } from "./charts/RoomScatterPlot";
import { ThermalTimeSeriesChart } from "./charts/ThermalTimeSeriesChart";
import {
  formatChartPower,
  statusBadgeClass,
  THERMAL_CHART_NOT_SET,
} from "./charts/thermalChartTheme";
import { resultsMetricInfo, type MetricInfoDefinition } from "./resultsMetricInfo";
import BuildingPerformanceResultsSection from "./BuildingPerformanceResultsSection";
import { ThermalCalculationConsistencyReport } from "./ThermalCalculationConsistencyReport";

interface MetricsResultsTabProps {
  onRecalculate?: () => void;
  onEditUncertainty?: () => void;
}

type RoomView = "stacked" | "heatmap" | "scatter";

const NOT_SET = THERMAL_CHART_NOT_SET;

const ROOM_VIEW_ITEMS: Array<{ id: RoomView; label: string }> = [
  { id: "stacked", label: "Потери по помещениям" },
  { id: "heatmap", label: "Матрица" },
  { id: "scatter", label: "Аномалии" },
];

export function MetricsResultsTab({ onRecalculate, onEditUncertainty }: MetricsResultsTabProps) {
  const result = useTwinStore((state) => state.lastThermalResult);
  const resultBinding = useTwinStore((state) => state.lastThermalResultBinding);
  const simulationSource = useTwinStore((state) => state.simulationDataSource);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const selectSpace = useTwinStore((state) => state.selectSpace);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const uncertaintyConfig = useWorkflowStore((state) => state.uncertaintyConfig);
  const monteCarloResult = useWorkflowStore((state) => state.monteCarloResult);
  const scenarioRunHistory = useWorkflowStore((state) => state.scenarioRunHistory);
  const buildModel = useBuildStore((state) => state.model);
  const projectKey = useBuildStore((state) => state.projectKey);
  const modelRevision = useBuildStore((state) => state.modelRevision);
  const [roomView, setRoomView] = useState<RoomView>("stacked");
  const resultState = getResultSyncState(Boolean(result), resultBinding, projectKey, modelRevision);
  const visibleResult = resultState === "current" ? result : null;
  const activeOptions = useMemo(() => buildThermalOptionsFromWorkflow(scenarioConfig), [scenarioConfig]);

  const lossShare = useMemo(() => (visibleResult ? extractLossSharePercent(visibleResult) : null), [visibleResult]);
  const activeAssumptions = useMemo(
    () =>
      [
        {
          label: "ACH инфильтрации",
          value: formatOptionalNumber(activeOptions.infiltrationACH, "1/ч", 2),
          note: "G_inf = ρ·c_p·V·ACH/3600 в RC-модели.",
        },
        {
          label: "ACH вентиляции",
          value: formatOptionalNumber(activeOptions.ventilationACH, "1/ч", 2),
          note: "Отдельный канал G_vent в RC при ACH > 0.",
        },
        {
          label: "Уставка внутри помещения",
          value: `день ${formatOptionalNumber(activeOptions.setpoints.day, "°C", 1)}; ночь ${formatOptionalNumber(
            activeOptions.setpoints.night,
            "°C",
            1
          )}`,
          note: "RC-модель использует дневную и ночную уставки для идеального догрева.",
        },
        {
          label: "Режим отопления",
          value: "Идеальный догрев до уставки",
          note: "Основная RC-модель использует идеальный догрев до уставки, а не модель радиатора, котла или гидравлики.",
        },
        {
          label: "Monte Carlo",
          value: formatMonteCarloRuns(uncertaintyConfig?.runs ?? monteCarloResult?.runs ?? null),
          note: "Отдельный контур отчёта, не часть основного result.",
        },
      ] satisfies Array<{ label: string; value: string; note: string }>,
    [activeOptions, monteCarloResult, uncertaintyConfig]
  );

  const chartRoomOptions = useMemo(() => {
    if (!result) {
      return [];
    }
    return buildModel.rooms
      .filter((room) => result.rooms[room.id])
      .map((room) => ({
        id: room.id,
        label: room.name?.trim() || room.id,
      }));
  }, [buildModel.rooms, result]);

  const chartRoomId = useMemo(() => {
    if (!result) {
      return null;
    }
    // Prefer currently selected space if it has a result room
    if (selectedSpaceId && result.rooms[selectedSpaceId]) {
      return selectedSpaceId;
    }
    // Auto-select: first room option that has temperature data in its timeline
    const firstWithData = chartRoomOptions.find((opt) => {
      const room = result.rooms[opt.id];
      return room && room.timeline.length > 0 && room.timeline.some((pt) => Number.isFinite(pt.temperatureC));
    });
    return firstWithData?.id ?? null;
  }, [result, selectedSpaceId, chartRoomOptions]);

  const roomTemperatureStats = useMemo(() => {
    if (!visibleResult) {
      return new Map<string, { averageTemperatureC: number | null; minimumTemperatureC: number | null }>();
    }
    return new Map(
      Object.values(visibleResult.rooms).map((room) => {
        const temperatures = room.timeline
          .map((point) => point.temperatureC)
          .filter((value): value is number => Number.isFinite(value));
        return [
          room.roomId,
          {
            averageTemperatureC: temperatures.length
              ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
              : null,
            minimumTemperatureC: temperatures.length ? Math.min(...temperatures) : null,
          },
        ];
      })
    );
  }, [visibleResult]);

  if (!result) {
    return (
      <div className="space-y-4">
        <EngineeringCallout variant="info" title="Нет расчётных показателей">
          <p>
            Запустите базовый расчёт, чтобы здесь появились графики, KPI и диагностические сводки.
          </p>
        </EngineeringCallout>
        {onRecalculate ? (
          <button type="button" onClick={onRecalculate} className="ui-btn-primary px-5 py-2 text-sm">
            Запустить расчёт
          </button>
        ) : null}
      </div>
    );
  }

  if (resultState === "stale") {
    return (
      <div className="space-y-4">
        <EngineeringCallout variant="attention" title="Результаты устарели">
          <p>Модель изменилась после последнего запуска. Динамика помещения и остальные инженерные графики требуют пересчёта.</p>
        </EngineeringCallout>
        <ThermalTimeSeriesChart
          result={result}
          roomId={chartRoomId}
          roomOptions={chartRoomOptions}
          onSelectRoom={selectSpace}
          resultState={resultState}
          simulationSource={simulationSource}
          onRunCalculation={onRecalculate}
        />
      </div>
    );
  }

  const currentResult = visibleResult ?? result;
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
  const missingFields = buildMissingResultFieldLabels(capabilities);
  const scenarioCompareRows = buildScenarioHistoryCompareRows(scenarioRunHistory);
  const buildingLossRows = buildBuildingLossSeries(currentResult).map((row) => ({
    key: row.key,
    label: row.label,
    valueW: row.valueW ?? 0,
    share: row.sharePercent ?? 0,
    note: "Агрегат diagnostics.building в пиковом срезе RC.",
  }));
  const buildingLossWarnings = currentResult.diagnostics?.building.lossShareWarnings ?? [];
  const derived = currentResult.diagnostics?.derived ?? null;
  const derivedWarnings = derived ? collectDerivedWarnings(derived) : [];
  return (
    <div className="space-y-6" data-testid="thermal-results-panel">
      {simulationSource === "demo" ? (
        <EngineeringCallout variant="attention" title="Демо-данные">
          <p>Для инженерной интерпретации используйте локальный расчёт конструктора.</p>
        </EngineeringCallout>
      ) : null}

      <EngineeringSectionHeader
        kicker="Тепловой расчёт"
        title="Нестационарный RC-расчёт"
        subtitle="Существующие графики и таблицы базового зонального расчёта без Monte Carlo и без нормативного контура SP50."
      />

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

      <EngineeringCallout variant="assumption" title="Базовое допущение RC-модели">
        <p>Основная RC-модель использует идеальный догрев до уставки. Полученные пик, энергия и дискомфорт нельзя напрямую трактовать как подбор котла, радиатора или норматив СП 50.</p>
      </EngineeringCallout>

      {currentResult.modelWarnings && currentResult.modelWarnings.length > 0 ? (
        <EngineeringCallout variant="attention" title="Предупреждения модели здания">
          <p className="mb-2">Следующие геометрические или материальные допущения были применены автоматически. Проверьте их точность:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {currentResult.modelWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </EngineeringCallout>
      ) : null}

      <EngineeringCallout variant="info" title="Вероятностный анализ вынесен в отдельную вкладку">
        <p>
          Monte Carlo показывается во вкладке «Вероятностный анализ» как многократный запуск этого же нестационарного RC-расчёта. Там доступны P10/P50/P90, гистограмма, чувствительность и риск по помещениям.
        </p>
        {onEditUncertainty ? (
          <div className="mt-3">
            <button type="button" onClick={onEditUncertainty} className="ui-btn-secondary px-4 py-2 text-sm">
              Перейти к настройке Monte Carlo
            </button>
          </div>
        ) : null}
      </EngineeringCallout>

      <SummaryHighlightGrid
        items={[
          {
            label: "Пиковая нагрузка",
            value: `${formatNumber(currentResult.summary.peakLoadKW, { maximumFractionDigits: 2 })} кВт`,
            hint: "Максимум суммы мощности по зонам.",
          },
          {
            label: "Энергия за период",
            value: formatEnergy(currentResult.summary.totalEnergyKWh, "кВт·ч"),
            hint: "Интеграл отопительной нагрузки.",
          },
          {
            label: "Часы дискомфорта",
            value: `${formatNumber(currentResult.summary.discomfortHours, { maximumFractionDigits: 1 })} ч`,
            hint: "Суммарно по зонам модели.",
          },
          {
            label: "Суммарная мощность",
            value: formatChartPower(kpi.totalHeatingW),
            hint: "Диагностический срез по зонам.",
            tone: "info",
          },
        ]}
      />

      {derived ? (
        <CollapsibleSection
          title="Дополнительные показатели и проверки"
          description="Коэффициенты потерь, инерционность и удельные нагрузки — поверх основного RC-расчёта."
        >
        <section className="ui-panel-muted mt-3 space-y-4 rounded-2xl p-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[color:var(--text-base)]">Дополнительные показатели и проверки</p>
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-2.5 py-1 text-sm font-semibold text-[color:var(--text-soft)]">
                не влияет на основной расчёт без отдельного режима
              </span>
            </div>
            <p className="text-sm text-[color:var(--text-muted)]">
              Здесь показаны дополнительные инженерные показатели поверх уже выполненного RC-расчёта: коэффициенты теплопотерь, тепловая постоянная времени, удельные нагрузки и сценарий свободного остывания.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DerivedMetricTile label="H_tr" value={formatDerivedMetric(derived.transmissionHeatLossCoefficient_W_K.value, "Вт/К", 1)} hint="Трансмиссия" info={resultsMetricInfo.heatLossCoefficientTransmission} />
            <DerivedMetricTile label="H_ve" value={formatDerivedMetric(derived.ventilationHeatLossCoefficient_W_K.value, "Вт/К", 1)} hint="Воздухообмен" info={resultsMetricInfo.heatLossCoefficientVentilation} />
            <DerivedMetricTile label="H_total" value={formatDerivedMetric(derived.totalHeatLossCoefficient_W_K.value, "Вт/К", 1)} hint="Суммарные потери" info={resultsMetricInfo.heatLossCoefficientTotal} />
            <DerivedMetricTile label="τ здания" value={formatDerivedMetric(derived.buildingTauHours.value, "ч", 1)} hint="Инерционность" info={resultsMetricInfo.thermalTimeConstant} />
            <DerivedMetricTile label="q_A" value={formatDerivedMetric(derived.specificIndicators.qArea_W_m2.value, "Вт/м²", 1)} hint="По площади пола" info={resultsMetricInfo.specificLoadArea} />
            <DerivedMetricTile label="q_V" value={formatDerivedMetric(derived.specificIndicators.qVolume_W_m3.value, "Вт/м³", 2)} hint="По объёму" info={resultsMetricInfo.specificLoadVolume} />
            <DerivedMetricTile label="q_VΔT" value={formatDerivedMetric(derived.specificIndicators.qVolumeDeltaT_W_m3K.value, "Вт/(м³·К)", 3)} hint="По объёму и ΔT" info={resultsMetricInfo.specificLoadVolume} />
            <DerivedMetricTile label="Рекуперация" value={formatDerivedMetric(derived.ventilationRecovery.savedByRecovery_W.value, "Вт", 1)} hint="Справочный эффект η_rec" info={resultsMetricInfo.ventilationRecovery} />
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.15fr,0.85fr]">
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-[color:var(--text-base)]">Свободное остывание</p>
                <MetricInfoTooltip {...resultsMetricInfo.freeCooling} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {derived.freeCooling.map((point) => (
                  <div key={point.hours} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
                    <p className="text-sm font-semibold text-[color:var(--text-muted)]">{point.hours} ч</p>
                    <p className="mt-1 text-base font-semibold text-[color:var(--text-base)]">
                      {formatDerivedMetric(point.temperatureC.value, "°C", 1)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-[color:var(--text-base)]">Тепловая постоянная времени по помещениям</p>
                <MetricInfoTooltip {...resultsMetricInfo.thermalTimeConstant} />
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-sm text-[color:var(--text-soft)]">
                      <th className="px-3 py-2 font-semibold">Помещение</th>
                      <th className="px-3 py-2 font-semibold">τ</th>
                      <th className="px-3 py-2 font-semibold">H</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derived.zoneTauHours.slice(0, 6).map((zone) => (
                      <tr key={zone.zoneId} className="border-t border-[color:var(--border-soft)]">
                        <td className="px-3 py-2 font-medium text-[color:var(--text-base)]">{zone.zoneName}</td>
                        <td className="px-3 py-2">{formatDerivedMetric(zone.tauHours.value, "ч", 1)}</td>
                        <td className="px-3 py-2">{formatDerivedMetric(zone.heatLossCoefficient_W_K.value, "Вт/К", 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {derivedWarnings.length ? (
            <EngineeringCallout variant="attention" title="Ограничения дополнительных метрик">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {derivedWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </EngineeringCallout>
          ) : null}
        </section>
        </CollapsibleSection>
      ) : null}

      <ThermalTimeSeriesChart
        result={currentResult}
        roomId={chartRoomId}
        roomOptions={chartRoomOptions}
        onSelectRoom={selectSpace}
        resultState={resultState}
        simulationSource={simulationSource}
        onRunCalculation={onRecalculate}
      />

      <div className="grid gap-4 xl:grid-cols-[1.25fr,0.95fr]">
        <section className="ui-panel-muted rounded-2xl p-4" data-testid="building-loss-chart">
          <p className="mb-3 text-sm font-semibold text-[color:var(--text-base)]">Теплопотери по компонентам</p>
          <BuildingLossChart rows={buildingLossRows} />
        </section>
        <section className="ui-panel-muted rounded-2xl p-4">
          {lossShare ? <LossShareChart share={lossShare} /> : <ChartEmptyState text="Доли потерь не заданы." />}
        </section>
      </div>

      {buildingLossWarnings.length ? (
        <EngineeringCallout variant="attention" title="Пояснение по долям инфильтрации">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {buildingLossWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </EngineeringCallout>
      ) : null}

      <BuildingPerformanceResultsSection diagnostics={currentResult.diagnostics?.buildingPerformance} />

      <section className="ui-panel-muted rounded-2xl p-4">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Ограничения данных</p>
        {missingFields.length ? (
          <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
            {missingFields.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[color:var(--success-fg)]">Все основные каналы result заполнены.</p>
        )}
      </section>

      <section className="ui-panel-muted space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-base)]">Инженерное разложение потерь и нагрузок</p>
            <p className="text-sm text-[color:var(--text-muted)]">
              Разложение строится по доступным результатам текущего расчётного контура: температура, мощность и потери
              по `diagnostics.zones`. Для общей структуры потерь доля инфильтрации считается от `totalLossW`, а доля
              внутри воздухообмена показывается отдельно.
            </p>
          </div>
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

            <div className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr,0.85fr]">
              <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
                <table className="w-full text-left text-sm text-[color:var(--text-muted)]">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                      <th className="px-4 py-2 font-semibold">Помещение</th>
                      <th className="px-4 py-2 font-semibold">Средняя температура</th>
                      <th className="px-4 py-2 font-semibold">Минимальная температура</th>
                      <th className="px-4 py-2 font-semibold">Мощность</th>
                      <th className="px-4 py-2 font-semibold">Потери</th>
                      <th className="px-4 py-2 font-semibold">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zoneRows.map((zone) => (
                      <tr
                        key={zone.zoneId}
                        className={`border-t border-[color:var(--border-soft)] ${selectedSpaceId === zone.zoneId ? "bg-[color:var(--accent-muted)]/25" : ""}`}
                      >
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => selectSpace(zone.zoneId)}
                            className="font-semibold text-[color:var(--text-base)] underline decoration-dotted underline-offset-4"
                          >
                            {zone.zoneName}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          {formatOptionalNumber(roomTemperatureStats.get(zone.zoneId)?.averageTemperatureC, "°C", 1)}
                        </td>
                        <td className="px-4 py-2">
                          {formatOptionalNumber(roomTemperatureStats.get(zone.zoneId)?.minimumTemperatureC, "°C", 1)}
                        </td>
                        <td className="px-4 py-2">{formatChartPower(zone.heatingPowerW)}</td>
                        <td className="px-4 py-2">{formatChartPower(zone.lossTotalW)}</td>
                        <td className="px-4 py-2 text-xs">
                          <span className={statusBadgeClass(zone.status)} title={zone.statusNote ?? undefined}>
                            {zone.statusNote ?? NOT_SET}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ui-panel-muted space-y-2 rounded-2xl p-3" data-testid="thermal-results-3d-overlay">
                <p className="text-sm font-semibold text-[color:var(--text-base)]">3D-окраска помещений</p>
                <SpaceViewer3D heatmap caption="Температура по зонам" height={320} showLegend showFitControl />
              </div>
            </div>

          </>
        ) : (
          <ChartEmptyState text="В текущем результате нет разложения по помещениям." />
        )}
      </section>

      <section className="ui-panel-muted space-y-3 rounded-2xl p-4" data-testid="scenario-compare-panel">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Сравнение прогонов</p>
        {scenarioCompareRows.length > 1 ? (
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                  <th className="px-4 py-2">Сценарий</th>
                  <th className="px-4 py-2">Пик, кВт</th>
                  <th className="px-4 py-2">Энергия, кВт·ч</th>
                  <th className="px-4 py-2">Дискомфорт, ч</th>
                </tr>
              </thead>
              <tbody>
                {scenarioCompareRows.map((row) => (
                  <tr key={row.scenarioId} className="border-t border-[color:var(--border-soft)]">
                    <td className="px-4 py-2 font-semibold">{row.label}</td>
                    <td className="px-4 py-2">{formatOptionalNumber(row.peakLoadKW, "кВт", 2)}</td>
                    <td className="px-4 py-2">{formatOptionalNumber(row.totalEnergyKWh, "кВт·ч", 1)}</td>
                    <td className="px-4 py-2">{formatOptionalNumber(row.discomfortHours, "ч", 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ChartEmptyState text="Для сравнения выполните минимум два расчёта на шаге «Расчёт»." />
        )}
      </section>

      <section className="ui-panel-muted space-y-3 rounded-2xl p-4">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Активные расчётные допущения</p>
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
          <table className="w-full text-left text-sm">
            <tbody>
              {activeAssumptions.map((item) => (
                <tr key={item.label} className="border-t border-[color:var(--border-soft)]">
                  <td className="px-4 py-2 font-semibold">{item.label}</td>
                  <td className="px-4 py-2">{item.value}</td>
                  <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Infiltration diagnostics — shown only when building.infiltration is available */}
      {currentResult.diagnostics?.building.infiltration ? (
        <InfiltrationDiagnosticsCard infiltration={currentResult.diagnostics.building.infiltration} />
      ) : null}

      {/* Numerical consistency report — dev/engineering verification panel */}
      <CollapsibleSection
        title="Численная верификация расчёта"
        description="Инварианты, реконструкция пика, интеграл энергии, баланс компонент и сравнение с Monte Carlo."
      >
        <ThermalCalculationConsistencyReport />
      </CollapsibleSection>

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

function InfiltrationDiagnosticsCard({ infiltration }: { infiltration: InfiltrationDiagCard }) {
  return (
    <section className="ui-panel-muted space-y-3 rounded-2xl p-4" data-testid="infiltration-diagnostics-card">
      <p className="text-sm font-semibold text-[color:var(--text-base)]">Расчёт инфильтрации</p>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
        <table className="w-full text-left text-sm">
          <tbody>
            <tr className="border-t border-[color:var(--border-soft)]">
              <td className="px-4 py-2 font-semibold">Режим</td>
              <td className="px-4 py-2">{infiltration.mode}</td>
              <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">{infiltration.achSource}</td>
            </tr>
            <tr className="border-t border-[color:var(--border-soft)]">
              <td className="px-4 py-2 font-semibold">ACH</td>
              <td className="px-4 py-2">{formatOptionalNumber(infiltration.calculatedACH, "1/ч", 3)}</td>
              <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">Расчётная кратность воздухообмена</td>
            </tr>
            <tr className="border-t border-[color:var(--border-soft)]">
              <td className="px-4 py-2 font-semibold">Расход воздуха</td>
              <td className="px-4 py-2">{formatOptionalNumber(infiltration.airflowM3h, "м³/ч", 1)}</td>
              <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">Суммарный по зданию</td>
            </tr>
            {Number.isFinite(infiltration.pressureTotalPa) && infiltration.pressureTotalPa > 0 ? (
              <tr className="border-t border-[color:var(--border-soft)]">
                <td className="px-4 py-2 font-semibold">Давление</td>
                <td className="px-4 py-2">
                  {formatOptionalNumber(infiltration.pressureTotalPa, "Па", 1)} (ветер {formatOptionalNumber(infiltration.pressureWindPa, "Па", 1)} + гравитация {formatOptionalNumber(infiltration.pressureStackPa, "Па", 1)})
                </td>
                <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">Суммарное давление инфильтрации</td>
              </tr>
            ) : null}
            <tr className="border-t border-[color:var(--border-soft)]">
              <td className="px-4 py-2 font-semibold">Потери тепла</td>
              <td className="px-4 py-2">{formatOptionalNumber(infiltration.heatLossW / 1000, "кВт", 2)}</td>
              <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">В пиковом срезе RC</td>
            </tr>
          </tbody>
        </table>
      </div>
      {infiltration.assumptions.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-[color:var(--text-muted)]">
          {infiltration.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
        </ul>
      ) : null}
      {infiltration.warnings.length > 0 ? (
        <EngineeringCallout variant="attention" title="Предупреждения инфильтрации">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {infiltration.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </EngineeringCallout>
      ) : null}
    </section>
  );
}

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

function formatMonteCarloRuns(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return NOT_SET;
  }
  return `${formatNumber(value, { maximumFractionDigits: 0 })} прогонов`;
}

function formatDerivedMetric(value: number | null | undefined, unit: string, digits = 2): string {
  if (!Number.isFinite(value)) {
    return NOT_SET;
  }
  return `${formatNumber(value, { maximumFractionDigits: digits })} ${unit}`;
}

function collectDerivedWarnings(
  derived: NonNullable<NonNullable<ReturnType<typeof useTwinStore.getState>["lastThermalResult"]>["diagnostics"]>["derived"]
): string[] {
  const warnings = new Set<string>();
  [
    ...derived.transmissionHeatLossCoefficient_W_K.warnings,
    ...derived.infiltrationHeatLossCoefficient_W_K.warnings,
    ...derived.ventilationHeatLossCoefficient_W_K.warnings,
    ...derived.totalHeatLossCoefficient_W_K.warnings,
    ...derived.buildingTauHours.warnings,
    ...derived.specificIndicators.qArea_W_m2.warnings,
    ...derived.specificIndicators.qVolume_W_m3.warnings,
    ...derived.specificIndicators.qVolumeDeltaT_W_m3K.warnings,
    ...derived.ventilationRecovery.ventilationLossAfterRecovery_W.warnings,
    ...derived.ventilationRecovery.savedByRecovery_W.warnings,
    ...derived.normativeVentilation.requiredFlowM3H.warnings,
  ].forEach((warning) => {
    if (warning.trim()) {
      warnings.add(warning);
    }
  });
  return Array.from(warnings);
}

function DerivedMetricTile({
  label,
  value,
  hint,
  info,
}: {
  label: string;
  value: string;
  hint: string;
  info: MetricInfoDefinition;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-[color:var(--text-muted)]">{label}</p>
        <MetricInfoTooltip {...info} />
      </div>
      <p className="mt-1 text-base font-semibold text-[color:var(--text-base)]">{value}</p>
      <p className="mt-1 text-xs text-[color:var(--text-muted)]">{hint}</p>
    </div>
  );
}

export default MetricsResultsTab;
