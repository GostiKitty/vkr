import { useMemo } from "react";
import { extractLossSharePercent } from "../../core/thermal/thermalSimulationExport";
import { buildThermalSimulationInsightLines } from "../../core/thermal/thermalResultsInterpretation";
import { THERMAL_UNCERTAINTY_DEFINITIONS } from "../../core/uncertainty/thermalMonteCarlo";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { DEFAULT_THERMAL_OPTIONS } from "../build/thermal/defaultThermalOptions";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import { EngineeringCallout, EngineeringMetricTile, EngineeringSectionHeader } from "../../shared/ui";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
import { LossShareChart } from "./charts/LossShareChart";
import { MonteCarloChart } from "./charts/MonteCarloChart";
import { ThermalTimeSeriesChart } from "./charts/ThermalTimeSeriesChart";

interface MetricsResultsTabProps {
  onRecalculate?: () => void;
}

export function MetricsResultsTab({ onRecalculate }: MetricsResultsTabProps) {
  const result = useTwinStore((state) => state.lastThermalResult);
  const simulationSource = useTwinStore((state) => state.simulationDataSource);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const uncertaintyConfig = useWorkflowStore((state) => state.uncertaintyConfig);
  const monteCarloResult = useWorkflowStore((state) => state.monteCarloResult);
  const activeOptions = useMemo(() => buildThermalOptionsFromWorkflow(scenarioConfig), [scenarioConfig]);

  const lossShare = useMemo(() => (result ? extractLossSharePercent(result) : null), [result]);
  const insightLines = useMemo(
    () => (result ? buildThermalSimulationInsightLines(result, { duration: activeOptions.duration ?? DEFAULT_THERMAL_OPTIONS.duration }) : []),
    [activeOptions.duration, result]
  );
  const activeAssumptions = useMemo(
    () =>
      [
        {
          label: "ACH инфильтрации",
          value: formatOptionalNumber(activeOptions.infiltrationACH, "1/ч", 2),
          note: "Используется в основном RC-расчёте через эквивалентную проводимость инфильтрации.",
        },
        {
          label: "effectiveMassFactor",
          value: formatOptionalNumber(activeOptions.engineering?.effectiveMassFactor, undefined, 2),
          note: "Множитель эффективной тепловой массы для зональной RC-модели.",
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
          label: "Сценарий наружной температуры",
          value: formatOutdoorScenario(activeOptions),
          note: "Синусоидальный климатический профиль текущего сценария.",
        },
        {
          label: "Длительность моделирования",
          value: activeOptions.duration === "7d" ? "7 суток" : "24 часа",
          note: "Период основного зонального RC-расчёта.",
        },
        {
          label: "Шаг по времени",
          value: formatOptionalNumber(activeOptions.timestepMinutes, "мин", 0),
          note: "Шаг интегрирования по времени в основном RC-расчёте.",
        },
        {
          label: "Внутренние теплопоступления",
          value: formatInternalGains(activeOptions),
          note: "Удельные gains сценария, подаваемые в RC-модель.",
        },
        {
          label: "Режим отопления",
          value: "Идеальный догрев до уставки",
          note: "Это сценарный контур, а не модель радиатора/котла по теплоносителю.",
        },
        {
          label: "Monte Carlo: число прогонов",
          value: formatMonteCarloRuns(uncertaintyConfig?.runs ?? monteCarloResult?.runs ?? null),
          note: "Показывается, если запускался вероятностный анализ поверх RC-модели.",
        },
        {
          label: "Параметры неопределённости",
          value: formatUncertaintyParameters(uncertaintyConfig != null || monteCarloResult != null),
          note: uncertaintyConfig?.evaluationMode
            ? `Режим оценки: ${formatEvaluationMode(uncertaintyConfig.evaluationMode)}.`
            : "Если вероятностный анализ не запускался, параметры остаются справочными.",
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

  if (!result) {
    return (
      <div className="space-y-4">
        <EngineeringCallout variant="info" title="Нет расчётных показателей">
          <p>Выполните зональный расчёт на шаге «Расчёт» в студии. После этого здесь появятся KPI, графики и доли потерь.</p>
        </EngineeringCallout>
        {onRecalculate ? (
          <button type="button" onClick={onRecalculate} className="ui-btn-primary px-5 py-2 text-sm">
            Перейти к расчёту
          </button>
        ) : null}
      </div>
    );
  }

  const b = result.diagnostics?.building;
  const zoneDiagnostics = result.diagnostics?.zones ?? [];
  const hasDiagnosticsBreakdown = Boolean(b && zoneDiagnostics.length > 0);
  const envelopeBreakdownRows = b
    ? [
        {
          label: "Непрозрачные ограждения",
          valueW: b.totalOpaqueLossW,
          share: b.lossSharePercent.opaque,
          note: "Стены, покрытия и другие непрозрачные элементы оболочки в диагностическом срезе.",
        },
        {
          label: "Окна",
          valueW: b.totalWindowLossW,
          share: b.lossSharePercent.window,
          note: "Теплопотери через оконные проёмы в доступном инженерном разложении.",
        },
        {
          label: "Двери",
          valueW: b.totalDoorLossW,
          share: b.lossSharePercent.door,
          note: "Теплопотери через дверные проёмы в диагностическом срезе.",
        },
        {
          label: "Вентиляция / инфильтрация",
          valueW: b.totalInfiltrationLossW,
          share: b.lossSharePercent.infiltration,
          note: "В текущем контуре доступна общая строка воздухообмена; отдельного split по механической вентиляции нет.",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {simulationSource === "demo" ? (
        <EngineeringCallout variant="attention" title="Демо-данные">
          <p>Кадры времени и 3D могут отражать упрощённую модель twin. Запустите локальный расчёт в студии для привязки к геометрии конструктора.</p>
        </EngineeringCallout>
      ) : null}

      <EngineeringSectionHeader
        kicker="Показатели"
        title="Сводка RC-модели"
        subtitle="Ключевые величины за период сценария. Не норматив СП 50 и не CFD."
      />

      <EngineeringCallout variant="attention" title="Ограничение модели отопления">
        <p>
          Основная RC-модель использует идеальный догрев до уставки. Это подходит для сценарной оценки теплового режима,
          но не является детальной моделью радиатора/котла по температуре подачи, обратки и расходу теплоносителя.
        </p>
      </EngineeringCallout>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <EngineeringMetricTile
          label="Пиковая мощность"
          value={formatNumber(result.summary.peakLoadKW, { maximumFractionDigits: 2 })}
          unit="кВт"
          hint="Максимум суммарной мощности отопления по зонам"
          tone="neutral"
        />
        <EngineeringMetricTile
          label="Энергия за период"
          value={formatEnergy(result.summary.totalEnergyKWh)}
          unit="кВт·ч"
          hint="Интеграл мощности за длительность сценария"
          tone="neutral"
        />
        <EngineeringMetricTile
          label="Дискомфорт"
          value={formatNumber(result.summary.discomfortHours, { maximumFractionDigits: 1 })}
          unit="ч·зона"
          hint="Сумма по зонам времени ниже уставки"
          tone="neutral"
        />
        {b ? (
          <EngineeringMetricTile
            label="Удельный пик"
            value={formatNumber(b.specificPeakLoad_W_m2, { maximumFractionDigits: 1 })}
            unit="Вт/м²"
            hint="Пик / площадь пола зон"
            tone="neutral"
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ThermalTimeSeriesChart result={result} roomId={chartRoomId} />
        {lossShare ? <LossShareChart share={lossShare} /> : null}
      </div>

      <section className="ui-panel-muted space-y-3 rounded-2xl p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Активные расчётные допущения</p>
          <p className="text-sm text-[color:var(--text-muted)]">
            Ниже перечислены параметры сценария и контуры, которые реально влияют на текущий результат. Значения без данных помечаются как «не задано».
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
          <table className="w-full text-left text-sm text-[color:var(--text-muted)]">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                <th className="px-4 py-2 font-semibold">Параметр</th>
                <th className="px-4 py-2 font-semibold">Значение</th>
                <th className="px-4 py-2 font-semibold">Как используется</th>
              </tr>
            </thead>
            <tbody>
              {activeAssumptions.map((item) => (
                <tr key={item.label} className="border-t border-[color:var(--border-soft)] align-top">
                  <td className="px-4 py-2 font-semibold text-[color:var(--text-base)]">{item.label}</td>
                  <td className="px-4 py-2">{item.value}</td>
                  <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-panel-muted space-y-4 rounded-2xl p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Инженерное разложение потерь и нагрузок</p>
          <p className="text-sm text-[color:var(--text-muted)]">
            Разложение строится по доступным результатам текущего расчётного контура. Если компонент отсутствует, он не рассчитывался в выбранном режиме.
          </p>
        </div>

        {hasDiagnosticsBreakdown ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <EngineeringMetricTile
                label="Суммарная тепловая нагрузка"
                value={formatOptionalNumber((b?.totalHeatingW ?? null) != null ? (b?.totalHeatingW ?? 0) / 1000 : null, undefined, 2)}
                unit="кВт"
                hint="Сумма мощности отопления в диагностическом срезе, по которому построено инженерное разложение."
                tone="neutral"
              />
              <EngineeringMetricTile
                label="Пиковая нагрузка"
                value={formatNumber(result.summary.peakLoadKW, { maximumFractionDigits: 2 })}
                unit="кВт"
                hint="Максимум по времени в основном RC-контуре."
                tone="neutral"
              />
              <EngineeringMetricTile
                label="Средняя температура"
                value={NOT_SET}
                hint="Нет данных в текущем расчётном контуре как готовой агрегированной метрики."
                tone="neutral"
              />
              <EngineeringMetricTile
                label="Минимальная температура"
                value={NOT_SET}
                hint="Нет данных в текущем расчётном контуре как готовой агрегированной метрики."
                tone="neutral"
              />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
              <table className="w-full text-left text-sm text-[color:var(--text-muted)]">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                    <th className="px-4 py-2 font-semibold">Компонент</th>
                    <th className="px-4 py-2 font-semibold">Потери</th>
                    <th className="px-4 py-2 font-semibold">Доля</th>
                    <th className="px-4 py-2 font-semibold">Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {envelopeBreakdownRows.map((row) => (
                    <tr key={row.label} className="border-t border-[color:var(--border-soft)] align-top">
                      <td className="px-4 py-2 font-semibold text-[color:var(--text-base)]">{row.label}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(row.valueW, "Вт", 0)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(row.share, "%", 1)}</td>
                      <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
              <table className="w-full text-left text-sm text-[color:var(--text-muted)]">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                    <th className="px-4 py-2 font-semibold">Помещение</th>
                    <th className="px-4 py-2 font-semibold">T среза</th>
                    <th className="px-4 py-2 font-semibold">Отопление</th>
                    <th className="px-4 py-2 font-semibold">Непрозрачные</th>
                    <th className="px-4 py-2 font-semibold">Окна</th>
                    <th className="px-4 py-2 font-semibold">Двери</th>
                    <th className="px-4 py-2 font-semibold">Воздухообмен</th>
                    <th className="px-4 py-2 font-semibold">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {zoneDiagnostics.map((zone) => (
                    <tr key={zone.zoneId} className="border-t border-[color:var(--border-soft)] align-top">
                      <td className="px-4 py-2 font-semibold text-[color:var(--text-base)]">{zone.zoneName}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.temperatureC, "°C", 1)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.heatingPowerW, "Вт", 0)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.lossOpaqueW, "Вт", 0)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.lossWindowW, "Вт", 0)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.lossDoorW, "Вт", 0)}</td>
                      <td className="px-4 py-2">{formatOptionalNumber(zone.lossInfiltrationW, "Вт", 0)}</td>
                      <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">{zone.statusNote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <EngineeringCallout variant="info" title="Что отсутствует в текущем контуре">
              <p>
                Средняя температура за период, минимальная температура за период и отдельное разложение механической вентиляции не сохранены как готовые агрегаты
                в текущем объекте результатов. В UI они помечены как «не задано», а не пересчитываются заново.
              </p>
            </EngineeringCallout>
          </>
        ) : (
          <EngineeringCallout variant="info" title="Нет данных в текущем расчётном контуре">
            <p>
              В этом результате нет инженерного разложения по помещениям и компонентам оболочки. Доступны только базовые KPI RC-модели и временные графики.
            </p>
          </EngineeringCallout>
        )}
      </section>

      {insightLines.length > 0 ? (
        <div className="ui-panel-muted space-y-2 rounded-2xl p-4 text-sm text-[color:var(--text-muted)]">
          <p className="font-semibold text-[color:var(--text-base)]">Инженерные выводы</p>
          <ul className="list-disc space-y-1 pl-5">
            {insightLines.slice(0, 4).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {monteCarloResult ? <MonteCarloChart result={monteCarloResult} /> : null}

      {onRecalculate ? (
        <button type="button" onClick={onRecalculate} className="ui-btn-secondary px-5 py-2 text-sm">
          Пересчитать на шаге «Расчёт»
        </button>
      ) : null}
    </div>
  );
}

export default MetricsResultsTab;

const NOT_SET = "не задано";

function formatOptionalNumber(value: number | null | undefined, unit?: string, digits = 2): string {
  if (!Number.isFinite(value)) {
    return NOT_SET;
  }
  const formatted = formatNumber(value, { maximumFractionDigits: digits });
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatOutdoorScenario(options: {
  outdoor: { baseC?: number; amplitudeC?: number; seasonalOffsetC?: number };
}): string {
  return `база ${formatOptionalNumber(options.outdoor.baseC, "°C", 1)}; амплитуда ${formatOptionalNumber(
    options.outdoor.amplitudeC,
    "°C",
    1
  )}; сезонное смещение ${formatOptionalNumber(options.outdoor.seasonalOffsetC, "°C", 1)}`;
}

function formatInternalGains(options: {
  internalGains: { dayGain_W_m2: number; nightGain_W_m2: number };
}): string {
  const day = formatOptionalNumber(options.internalGains.dayGain_W_m2, "Вт/м²", 1);
  const night = formatOptionalNumber(options.internalGains.nightGain_W_m2, "Вт/м²", 1);
  return `день ${day}; ночь ${night}`;
}

function formatMonteCarloRuns(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return NOT_SET;
  }
  return `${formatNumber(value, { maximumFractionDigits: 0 })} прогонов`;
}

function formatUncertaintyParameters(active: boolean): string {
  if (!active) {
    return NOT_SET;
  }
  return THERMAL_UNCERTAINTY_DEFINITIONS.map((item) => item.label).join(", ");
}

function formatEvaluationMode(mode: "full-physics" | "surrogate"): string {
  if (mode === "surrogate") {
    return "суррогатная оценка";
  }
  return "повторный полный RC-расчёт";
}
