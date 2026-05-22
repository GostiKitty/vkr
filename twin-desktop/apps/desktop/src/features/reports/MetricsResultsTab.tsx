import { useMemo, useState } from "react";
import { extractLossSharePercent } from "../../core/thermal/thermalSimulationExport";
import { buildThermalSimulationInsightLines } from "../../core/thermal/thermalResultsInterpretation";
import {
  buildBuildingLossSeries,
  buildKpiPayload,
  buildMissingResultFieldLabels,
  buildScenarioHistoryCompareRows,
  buildThermalResultCapabilities,
  buildZoneSeries,
} from "../../core/thermal/thermalResultsChartPayload";
import { THERMAL_UNCERTAINTY_DEFINITIONS } from "../../core/uncertainty/thermalMonteCarlo";
import { getSp131CityClimate } from "../../norms/sp131_2025/climate";
import { FormulaHint } from "../formulas/components/FormulaHint";
import { useBuildStore } from "../build/build.store";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { DEFAULT_THERMAL_OPTIONS } from "../build/thermal/defaultThermalOptions";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import SpaceViewer3D from "../twin/SpaceViewer3D";
import { EngineeringCallout, EngineeringMetricTile, EngineeringSectionHeader } from "../../shared/ui";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
import MonteCarloResultsSection from "./MonteCarloResultsSection";
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
  const buildModel = useBuildStore((state) => state.model);
  const result = useTwinStore((state) => state.lastThermalResult);
  const simulationSource = useTwinStore((state) => state.simulationDataSource);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const selectSpace = useTwinStore((state) => state.selectSpace);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const uncertaintyConfig = useWorkflowStore((state) => state.uncertaintyConfig);
  const monteCarloResult = useWorkflowStore((state) => state.monteCarloResult);
  const scenarioRunHistory = useWorkflowStore((state) => state.scenarioRunHistory);
  const [roomView, setRoomView] = useState<RoomView>("stacked");
  const activeOptions = useMemo(() => buildThermalOptionsFromWorkflow(scenarioConfig), [scenarioConfig]);

  const lossShare = useMemo(() => (result ? extractLossSharePercent(result) : null), [result]);
  const insightLines = useMemo(
    () =>
      result
        ? buildThermalSimulationInsightLines(result, {
            duration: activeOptions.duration ?? DEFAULT_THERMAL_OPTIONS.duration,
          })
        : [],
    [activeOptions.duration, result]
  );
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

  const chartRoomId = useMemo(() => {
    if (!result) {
      return null;
    }
    if (selectedSpaceId && result.rooms[selectedSpaceId]) {
      return selectedSpaceId;
    }
    return Object.keys(result.rooms)[0] ?? null;
  }, [result, selectedSpaceId]);

  const roomTemperatureStats = useMemo(() => {
    if (!result) {
      return new Map<string, { averageTemperatureC: number | null; minimumTemperatureC: number | null }>();
    }
    return new Map(
      Object.values(result.rooms).map((room) => {
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
  }, [result]);

  if (!result) {
    return (
      <div className="space-y-4">
        <EngineeringCallout variant="info" title="Нет расчётных показателей">
          <p>Выполните зональный расчёт на шаге «Расчёт» в студии.</p>
        </EngineeringCallout>
        {onRecalculate ? (
          <button type="button" onClick={onRecalculate} className="ui-btn-primary px-5 py-2 text-sm">
            Перейти к расчёту
          </button>
        ) : null}
      </div>
    );
  }

  const kpi = buildKpiPayload(result);
  const zoneRows = buildZoneSeries(result);
  const hasDiagnosticsBreakdown = zoneRows.length > 0;
  const climateLabel = scenarioConfig?.climateCityId
    ? getSp131CityClimate(scenarioConfig.climateCityId)?.label ?? scenarioConfig.climateCityId
    : null;
  const capabilities = buildThermalResultCapabilities(result, {
    climateCityLabel: climateLabel,
    scenarioHistoryCount: scenarioRunHistory.length,
  });
  const missingFields = buildMissingResultFieldLabels(capabilities);
  const scenarioCompareRows = buildScenarioHistoryCompareRows(scenarioRunHistory);
  const buildingLossRows = buildBuildingLossSeries(result).map((row) => ({
    key: row.key,
    label: row.label,
    valueW: row.valueW ?? 0,
    share: row.sharePercent ?? 0,
    note: "Агрегат diagnostics.building в пиковом срезе RC.",
  }));

  return (
    <div className="space-y-6" data-testid="thermal-results-panel">
      {simulationSource === "demo" ? (
        <EngineeringCallout variant="attention" title="Демо-данные">
          <p>Для инженерной интерпретации используйте локальный расчёт конструктора.</p>
        </EngineeringCallout>
      ) : null}

      <EngineeringSectionHeader
        kicker="Показатели"
        title="Сводка RC-модели"
        subtitle="Агрегаты result.summary и result.diagnostics без дорисовки отсутствующих каналов."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <EngineeringCallout variant="attention" title="Контур интерпретации">
          <p>Пиковая нагрузка и энергия — зональная RC-модель, не мощность котла и не СП 50.</p>
        </EngineeringCallout>
        <EngineeringCallout variant="info" title="Климатическая база">
          <p>{capabilities.climateBaseLabel ?? "Город СП 131 не выбран в сценарии."}</p>
        </EngineeringCallout>
      </div>

      <EngineeringCallout variant="assumption" title="Базовое допущение RC-модели">
        <p>Основная RC-модель использует идеальный догрев до уставки. Полученные пик, энергия и дискомфорт нельзя напрямую трактовать как подбор котла, радиатора или норматив СП 50.</p>
      </EngineeringCallout>

      <div className="mb-2 flex flex-wrap gap-2">
        <FormulaHint ids={["thermal_peak_load", "rc_lumped", "thermal_balance"]} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <EngineeringMetricTile
          label="Пиковая нагрузка модели"
          value={formatNumber(result.summary.peakLoadKW, { maximumFractionDigits: 2 })}
          unit="кВт"
          hint="Максимум суммы требуемой мощности по зонам"
          tone="neutral"
        />
        <EngineeringMetricTile
          label="Энергия за период"
          value={formatEnergy(result.summary.totalEnergyKWh, "кВт·ч")}
          hint="Интеграл мощности отопления"
          tone="neutral"
        />
        <EngineeringMetricTile
          label="Часы дискомфорта"
          value={formatNumber(result.summary.discomfortHours, { maximumFractionDigits: 1 })}
          unit="ч"
          hint="Не прямой норматив ГОСТ 30494"
          tone="neutral"
        />
        <EngineeringMetricTile
          label="Суммарная тепловая мощность"
          value={formatChartPower(kpi.totalHeatingW)}
          hint="Диагностический срез по зонам"
          tone="neutral"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr,0.95fr]">
        <section className="ui-panel-muted rounded-2xl p-4" data-testid="building-loss-chart">
          <p className="mb-3 text-sm font-semibold text-[color:var(--text-base)]">Теплопотери по компонентам</p>
          <BuildingLossChart rows={buildingLossRows} />
        </section>
        <section className="ui-panel-muted rounded-2xl p-4">
          {lossShare ? <LossShareChart share={lossShare} /> : <ChartEmptyState text="Доли потерь не заданы." />}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ThermalTimeSeriesChart
          result={result}
          roomId={chartRoomId}
          setpointC={activeOptions.setpoints.day}
          roomLabel={chartRoomId ? zoneRows.find((z) => z.zoneId === chartRoomId)?.zoneName : undefined}
        />
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
      </div>

      <section className="ui-panel-muted space-y-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-base)]">Инженерное разложение потерь и нагрузок</p>
            <p className="text-sm text-[color:var(--text-muted)]">Разложение строится по доступным результатам текущего расчётного контура: температура, мощность и потери по diagnostics.zones.</p>
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
          <ChartEmptyState text="В текущем результате нет инженерного разложения по помещениям; отображается fallback «нет инженерного разложения»." />
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

      {insightLines.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--text-muted)]">
          {insightLines.slice(0, 4).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      <MonteCarloResultsSection
        baseResult={result}
        baseOptions={activeOptions}
        buildingModel={buildModel}
        climateLabel={climateLabel}
        monteCarloResult={monteCarloResult}
        uncertaintyDefinitions={THERMAL_UNCERTAINTY_DEFINITIONS}
        onEditUncertainty={onEditUncertainty}
      />

      {onRecalculate ? (
        <button type="button" onClick={onRecalculate} className="ui-btn-secondary px-5 py-2 text-sm">
          Пересчитать
        </button>
      ) : null}
    </div>
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

export default MetricsResultsTab;
