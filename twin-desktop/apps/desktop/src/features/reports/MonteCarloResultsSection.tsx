import { useMemo, useState } from "react";
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
import type { BuildingModel, Sp50BuildingCategory } from "../../entities/geometry/types";
import type { ThermalSimulationOptions, ThermalSimulationResult } from "../../core/thermal/solver";
import type {
  ThermalMonteCarloResult,
  ThermalMonteCarloSensitivityFactor,
  ThermalUncertaintyDefinition,
} from "../../core/uncertainty/thermalMonteCarlo";
import { notifyError, notifyInfo } from "../../entities/notifications/notification.store";
import { Badge, EmptyState, EngineeringCallout, EngineeringMetricTile, EngineeringSectionHeader } from "../../shared/ui";
import { formatEnergy, formatNumber, formatPercentage } from "../../shared/utils/format";
import { getRoomDisplayName } from "../../shared/utils/roomNames";
import { MonteCarloChart } from "./charts/MonteCarloChart";

interface MonteCarloResultsSectionProps {
  baseResult: ThermalSimulationResult;
  baseOptions: ThermalSimulationOptions;
  buildingModel: BuildingModel;
  climateLabel: string | null;
  monteCarloResult: ThermalMonteCarloResult | null;
  uncertaintyDefinitions: ThermalUncertaintyDefinition[];
  onEditUncertainty?: () => void;
}

type RiskStatus = "низкий" | "средний" | "повышенный" | "высокий";

interface RiskRow {
  id: string;
  label: string;
  probability: number | null;
  status: RiskStatus;
}

interface MonteCarloPresentation {
  sensitivity: ThermalMonteCarloSensitivityFactor[];
  mainFactor: ThermalMonteCarloSensitivityFactor | null;
  mainFactorGroup: ReturnType<typeof resolveMainFactorGroup>;
  riskRows: RiskRow[];
  overallRisk: {
    status: RiskStatus;
    driver: string;
  };
  buildingTypeLabel: string;
  dataReliabilityLabel: string;
  operationModeLabel: string;
  outdoorRangeLabel: string;
  infiltrationRangeLabel: string;
  setpointRangeLabel: string;
  internalGainsRangeLabel: string;
  conclusionText: string;
  roomRows: Array<{
    roomId: string;
    roomName: string;
    temperatureP50C: number;
    minimumTemperatureP10C: number;
    underheatingRisk: number;
    recommendation: string;
  }>;
}

const ROOM_RISK_EMPTY_TEXT =
  "Расчёт по помещениям будет доступен после сохранения температурных траекторий по зонам.";

export function MonteCarloResultsSection({
  baseResult,
  baseOptions,
  buildingModel,
  climateLabel,
  monteCarloResult,
  uncertaintyDefinitions,
  onEditUncertainty,
}: MonteCarloResultsSectionProps) {
  const [showManualSettings, setShowManualSettings] = useState(false);

  const roomNameMap = useMemo(() => buildRoomNameMap(buildingModel), [buildingModel]);

  const presentation = useMemo<MonteCarloPresentation | null>(() => {
    if (!monteCarloResult) {
      return null;
    }
    const sensitivity = [...(monteCarloResult.sensitivity ?? [])].sort((left, right) => right.valuePercent - left.valuePercent);
    const mainFactor = sensitivity[0] ?? null;
    const riskRows = buildRiskRows(baseResult, monteCarloResult);
    const overallRisk = resolveOverallRisk(riskRows);
    return {
      sensitivity,
      mainFactor,
      mainFactorGroup: resolveMainFactorGroup(mainFactor?.id ?? null),
      riskRows,
      overallRisk,
      buildingTypeLabel: mapBuildingCategory(buildingModel.thermalProtection?.buildingCategory ?? null),
      dataReliabilityLabel: resolveDataReliability(buildingModel, climateLabel, monteCarloResult),
      operationModeLabel: `День ${formatNumber(baseOptions.setpoints.day, { maximumFractionDigits: 1 })} °C / ночь ${formatNumber(
        baseOptions.setpoints.night,
        { maximumFractionDigits: 1 }
      )} °C, идеальный догрев до уставки`,
      outdoorRangeLabel: formatRangeLabel(
        monteCarloResult.samples.map((sample) => baseOptions.outdoor.baseC + sample.outdoorBiasC),
        "°C"
      ),
      infiltrationRangeLabel: formatRangeLabel(
        monteCarloResult.samples.map((sample) => Math.max(0.02, (baseOptions.infiltrationACH ?? 0.5) * sample.infiltrationMultiplier)),
        "1/ч",
        2
      ),
      setpointRangeLabel: [
        `день ${formatRangeLabel(
          monteCarloResult.samples.map((sample) => baseOptions.setpoints.day + sample.setpointOffsetC),
          "°C"
        )}`,
        `ночь ${formatRangeLabel(
          monteCarloResult.samples.map((sample) => baseOptions.setpoints.night + sample.setpointOffsetC),
          "°C"
        )}`,
      ].join(" · "),
      internalGainsRangeLabel: [
        `день ${formatRangeLabel(
          monteCarloResult.samples.map(
            (sample) => Math.max(0, baseOptions.internalGains.dayGain_W_m2 * sample.internalGainMultiplier)
          ),
          "Вт/м²",
          1
        )}`,
        `ночь ${formatRangeLabel(
          monteCarloResult.samples.map(
            (sample) => Math.max(0, baseOptions.internalGains.nightGain_W_m2 * sample.internalGainMultiplier)
          ),
          "Вт/м²",
          1
        )}`,
      ].join(" · "),
      conclusionText: buildConclusion({
        mainFactorGroup: resolveMainFactorGroup(mainFactor?.id ?? null),
        underheatingRiskStatus: resolveRiskStatus(monteCarloResult.underheatingBelow20CProbability ?? 0),
        overallRiskStatus: overallRisk.status,
      }),
      roomRows:
        monteCarloResult.roomRiskSummary?.map((room) => ({
          ...room,
          roomName: roomNameMap.get(room.roomId) ?? room.roomId,
          recommendation: buildRoomRecommendation(room.underheatingRisk, room.minimumTemperatureP10C),
        })) ?? [],
    };
  }, [baseOptions, baseResult, buildingModel, climateLabel, monteCarloResult, roomNameMap]);

  const handleExportReport = () => {
    if (!monteCarloResult || !presentation) {
      notifyError("Сначала выполните Monte Carlo, затем формируйте отчёт.");
      return;
    }
    try {
      const content = buildMonteCarloMarkdownReport({
        baseResult,
        baseOptions,
        buildingModel,
        climateLabel,
        monteCarloResult,
        presentation,
      });
      triggerDownload(
        new Blob([content], { type: "text/markdown;charset=utf-8" }),
        `monte-carlo-report-${new Date().toISOString().slice(0, 10)}.md`
      );
      notifyInfo("Отчёт Monte Carlo подготовлен в формате Markdown.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Не удалось сформировать отчёт Monte Carlo.");
    }
  };

  return (
    <section className="ui-panel-muted space-y-5 rounded-2xl p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <EngineeringSectionHeader
          kicker="Вероятностный анализ"
          title="Результаты Monte Carlo"
          subtitle="Инженерная интерпретация разброса по энергии, пиковой нагрузке, дискомфорту и риску недогрева в пределах текущей RC-модели."
        />
        <div className="flex flex-wrap gap-2">
          {monteCarloResult ? (
            <Badge tone="accent" title="Количество сценариев Monte Carlo">
              {formatNumber(monteCarloResult.runs, { maximumFractionDigits: 0 })} сценариев
            </Badge>
          ) : null}
          <button
            type="button"
            onClick={handleExportReport}
            disabled={!monteCarloResult}
            className="ui-btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Сформировать отчёт
          </button>
        </div>
      </div>

      {!monteCarloResult || !presentation ? (
        <EmptyState
          title="Вероятностный анализ ещё не выполнен"
          message="Сначала запустите Monte Carlo на шаге «Неопределённость», чтобы получить диапазоны P10–P90, сводку риска и чувствительность."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <EngineeringMetricTile
              label="Базовое энергопотребление"
              value={formatNumber(baseResult.summary.totalEnergyKWh, { maximumFractionDigits: 1 })}
              unit="кВт·ч"
              hint="Детерминированный базовый расчёт RC за тот же период"
              tone="neutral"
            />
            <EngineeringMetricTile
              label="Диапазон P10–P90 по энергии"
              value={`${formatNumber(monteCarloResult.totalEnergy.p10, { maximumFractionDigits: 1 })}–${formatNumber(
                monteCarloResult.totalEnergy.p90,
                { maximumFractionDigits: 1 }
              )}`}
              unit="кВт·ч"
              hint="Вероятный диапазон totalEnergyKWh по сценариям"
              tone="neutral"
            />
            <EngineeringMetricTile
              label="Диапазон P10–P90 по пику"
              value={`${formatNumber(monteCarloResult.peakLoad.p10, { maximumFractionDigits: 2 })}–${formatNumber(
                monteCarloResult.peakLoad.p90,
                { maximumFractionDigits: 2 }
              )}`}
              unit="кВт"
              hint="Одновременная пиковая нагрузка системы отопления"
              tone="neutral"
            />
            <EngineeringMetricTile
              label="Риск недогрева ниже 20 °C"
              value={formatPercentage(monteCarloResult.underheatingBelow20CProbability ?? null)}
              hint="Вероятность, что минимум хотя бы одной зоны уйдёт ниже 20 °C"
              tone={riskTone(resolveRiskStatus(monteCarloResult.underheatingBelow20CProbability ?? 0))}
            />
            <EngineeringMetricTile
              label="Главный фактор влияния"
              value={presentation.mainFactor?.label ?? "Не определён"}
              hint="Максимальный вклад в разброс totalEnergyKWh"
              tone="attention"
            />
            <EngineeringMetricTile
              label="Статус риска"
              value={presentation.overallRisk.status}
              hint={`Определён по наиболее тяжёлому риску матрицы: ${presentation.overallRisk.driver}`}
              tone={riskTone(presentation.overallRisk.status)}
            />
          </div>

          <section className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-base)]">Базовый сценарий vs вероятностный анализ</p>
              <p className="text-sm text-[color:var(--text-muted)]">Одно значение для базового расчёта и диапазоны P10 / P50 / P90 для Monte Carlo.</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                    <th className="px-4 py-2 font-semibold">Показатель</th>
                    <th className="px-4 py-2 font-semibold">Базовый расчёт</th>
                    <th className="px-4 py-2 font-semibold">P10</th>
                    <th className="px-4 py-2 font-semibold">P50</th>
                    <th className="px-4 py-2 font-semibold">P90</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow
                    label="Энергия отопления"
                    baseline={formatEnergy(baseResult.summary.totalEnergyKWh, "кВт·ч")}
                    p10={formatEnergy(monteCarloResult.totalEnergy.p10, "кВт·ч")}
                    p50={formatEnergy(monteCarloResult.totalEnergy.p50, "кВт·ч")}
                    p90={formatEnergy(monteCarloResult.totalEnergy.p90, "кВт·ч")}
                  />
                  <ComparisonRow
                    label="Пиковая нагрузка"
                    baseline={`${formatNumber(baseResult.summary.peakLoadKW, { maximumFractionDigits: 2 })} кВт`}
                    p10={`${formatNumber(monteCarloResult.peakLoad.p10, { maximumFractionDigits: 2 })} кВт`}
                    p50={`${formatNumber(monteCarloResult.peakLoad.p50, { maximumFractionDigits: 2 })} кВт`}
                    p90={`${formatNumber(monteCarloResult.peakLoad.p90, { maximumFractionDigits: 2 })} кВт`}
                  />
                  <ComparisonRow
                    label="Часы дискомфорта"
                    baseline={`${formatNumber(baseResult.summary.discomfortHours, { maximumFractionDigits: 1 })} ч`}
                    p10={`${formatNumber(monteCarloResult.discomfort.p10, { maximumFractionDigits: 1 })} ч`}
                    p50={`${formatNumber(monteCarloResult.discomfort.p50, { maximumFractionDigits: 1 })} ч`}
                    p90={`${formatNumber(monteCarloResult.discomfort.p90, { maximumFractionDigits: 1 })} ч`}
                  />
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-[color:var(--text-base)]">Автоматически принятые допущения</p>
                <p className="text-sm text-[color:var(--text-muted)]">
                  Диапазоны собраны по текущей выборке Monte Carlo. Ручные распределения скрыты по умолчанию.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowManualSettings((current) => !current)} className="ui-btn-secondary px-4 py-2 text-sm">
                  Изменить вручную
                </button>
                {onEditUncertainty ? (
                  <button type="button" onClick={onEditUncertainty} className="ui-btn-secondary px-4 py-2 text-sm">
                    Открыть шаг неопределённости
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <AssumptionCard label="Тип здания" value={presentation.buildingTypeLabel} />
              <AssumptionCard label="Город / климатический пресет" value={climateLabel ?? "Не задано"} />
              <AssumptionCard label="Режим эксплуатации" value={presentation.operationModeLabel} />
              <AssumptionCard label="Уровень достоверности данных" value={presentation.dataReliabilityLabel} />
              <AssumptionCard
                label="Количество сценариев"
                value={`${formatNumber(monteCarloResult.runs, { maximumFractionDigits: 0 })} прогонов`}
              />
              <AssumptionCard label="Диапазон наружной температуры" value={presentation.outdoorRangeLabel} />
              <AssumptionCard label="Диапазон инфильтрации" value={presentation.infiltrationRangeLabel} />
              <AssumptionCard label="Диапазон уставок" value={presentation.setpointRangeLabel} />
              <AssumptionCard label="Диапазон внутренних теплопоступлений" value={presentation.internalGainsRangeLabel} />
            </div>

            {showManualSettings ? (
              <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                      <th className="px-4 py-2 font-semibold">Параметр</th>
                      <th className="px-4 py-2 font-semibold">Распределение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uncertaintyDefinitions.map((definition) => (
                      <tr key={definition.id} className="border-t border-[color:var(--border-soft)]">
                        <td className="px-4 py-2 font-semibold text-[color:var(--text-base)]">{definition.label}</td>
                        <td className="px-4 py-2 text-[color:var(--text-muted)]">{definition.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[color:var(--text-muted)]">
                Ручные распределения скрыты. По умолчанию используется автоматическая инженерная настройка текущей выборки Monte Carlo.
              </p>
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <MonteCarloChart result={monteCarloResult} baselineEnergyKWh={baseResult.summary.totalEnergyKWh} />
            <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-[color:var(--text-base)]">График чувствительности</p>
                <p className="text-sm text-[color:var(--text-muted)]">
                  Нормированный вклад факторов в разброс totalEnergyKWh. Максимальный фактор принят как главный.
                </p>
              </div>
              {presentation.sensitivity.length ? (
                <>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={presentation.sensitivity} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
                        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                          tickFormatter={(value) => `${Math.round(Number(value))}%`}
                          domain={[0, 100]}
                        />
                        <YAxis dataKey="label" type="category" width={132} tick={{ fill: "var(--text-soft)", fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: number) => [`${formatNumber(value, { maximumFractionDigits: 1 })}%`, "Влияние"]}
                          contentStyle={{
                            background: "var(--surface-elevated)",
                            border: "1px solid var(--border-soft)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="valuePercent" radius={[0, 8, 8, 0]}>
                          {presentation.sensitivity.map((entry, index) => (
                            <Cell
                              key={`${entry.id}-${index}`}
                              fill={index === 0 ? "var(--accent-base)" : "var(--chart-line-muted)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-3 text-sm text-[color:var(--text-muted)]">
                    Главный фактор влияния:{" "}
                    <span className="font-semibold text-[color:var(--text-base)]">
                      {presentation.mainFactor?.label ?? "не определён"}
                    </span>
                    .
                  </p>
                </>
              ) : (
                <EmptyState
                  title="Чувствительность недоступна"
                  message="Для текущего результата не удалось нормировать вклад факторов по энергии."
                />
              )}
            </section>
          </div>

          <section className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-base)]">Матрица риска</p>
              <p className="text-sm text-[color:var(--text-muted)]">Уровни: 0–10% низкий, 10–30% средний, 30–60% повышенный, более 60% высокий.</p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                    <th className="px-4 py-2 font-semibold">Риск</th>
                    <th className="px-4 py-2 font-semibold">Вероятность</th>
                    <th className="px-4 py-2 font-semibold">Уровень</th>
                  </tr>
                </thead>
                <tbody>
                  {presentation.riskRows.map((row) => (
                    <tr key={row.id} className="border-t border-[color:var(--border-soft)]">
                      <td className="px-4 py-2 font-medium text-[color:var(--text-base)]">{row.label}</td>
                      <td className="px-4 py-2">{formatProbability(row.probability)}</td>
                      <td className="px-4 py-2">
                        <Badge tone={riskBadgeTone(row.status)}>{row.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-base)]">Риск по помещениям</p>
              <p className="text-sm text-[color:var(--text-muted)]">Медианная температура по помещению, холодный хвост P10 и риск локального недогрева.</p>
            </div>
            {presentation.roomRows.length ? (
              <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
                      <th className="px-4 py-2 font-semibold">Помещение</th>
                      <th className="px-4 py-2 font-semibold">P50 температуры</th>
                      <th className="px-4 py-2 font-semibold">Минимальная температура P10</th>
                      <th className="px-4 py-2 font-semibold">Риск недогрева</th>
                      <th className="px-4 py-2 font-semibold">Рекомендация</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentation.roomRows.map((room) => (
                      <tr key={room.roomId} className="border-t border-[color:var(--border-soft)]">
                        <td className="px-4 py-2 font-medium text-[color:var(--text-base)]">{room.roomName}</td>
                        <td className="px-4 py-2">{formatNumber(room.temperatureP50C, { maximumFractionDigits: 1 })} °C</td>
                        <td className="px-4 py-2">{formatNumber(room.minimumTemperatureP10C, { maximumFractionDigits: 1 })} °C</td>
                        <td className="px-4 py-2">{formatPercentage(room.underheatingRisk)}</td>
                        <td className="px-4 py-2 text-[color:var(--text-muted)]">{room.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message={ROOM_RISK_EMPTY_TEXT} />
            )}
          </section>

          <EngineeringCallout
            variant={presentation.overallRisk.status === "высокий" ? "risk" : presentation.overallRisk.status === "повышенный" ? "attention" : "info"}
            title="Автоматический инженерный вывод"
          >
            <p>{presentation.conclusionText}</p>
          </EngineeringCallout>
        </>
      )}
    </section>
  );
}

function ComparisonRow({
  label,
  baseline,
  p10,
  p50,
  p90,
}: {
  label: string;
  baseline: string;
  p10: string;
  p50: string;
  p90: string;
}) {
  return (
    <tr className="border-t border-[color:var(--border-soft)]">
      <td className="px-4 py-2 font-medium text-[color:var(--text-base)]">{label}</td>
      <td className="px-4 py-2">{baseline}</td>
      <td className="px-4 py-2">{p10}</td>
      <td className="px-4 py-2">{p50}</td>
      <td className="px-4 py-2">{p90}</td>
    </tr>
  );
}

function AssumptionCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-[color:var(--text-base)]">{value}</p>
    </div>
  );
}

function buildRiskRows(baseResult: ThermalSimulationResult, monteCarloResult: ThermalMonteCarloResult): RiskRow[] {
  const scenarioSeries = monteCarloResult.scenarioSeries;
  const underheatingProbability =
    monteCarloResult.underheatingBelow20CProbability ??
    probabilityOf(scenarioSeries.minimumIndoorTemperatureC, (value) => value < 20);
  const peakPlus20Probability = probabilityOf(scenarioSeries.peakLoadKW, (value) => value > baseResult.summary.peakLoadKW * 1.2);
  const energyPlus20Probability = probabilityOf(
    scenarioSeries.totalEnergyKWh,
    (value) => value > baseResult.summary.totalEnergyKWh * 1.2
  );
  const discomfortOver5Probability = probabilityOf(scenarioSeries.discomfortHours, (value) => value > 5);

  return [
    {
      id: "underheating",
      label: "Риск недогрева ниже 20 °C",
      probability: underheatingProbability,
      status: resolveRiskStatus(underheatingProbability ?? 0),
    },
    {
      id: "peak",
      label: "Риск превышения базовой пиковой нагрузки на 20%",
      probability: peakPlus20Probability,
      status: resolveRiskStatus(peakPlus20Probability ?? 0),
    },
    {
      id: "energy",
      label: "Риск роста энергопотребления выше базового на 20%",
      probability: energyPlus20Probability,
      status: resolveRiskStatus(energyPlus20Probability ?? 0),
    },
    {
      id: "discomfort",
      label: "Риск дискомфорта больше 5 часов",
      probability: discomfortOver5Probability,
      status: resolveRiskStatus(discomfortOver5Probability ?? 0),
    },
  ];
}

function resolveOverallRisk(risks: RiskRow[]) {
  const worst = risks.reduce<RiskRow | null>((current, row) => {
    if (!current) {
      return row;
    }
    return riskRank(row.status) > riskRank(current.status) ? row : current;
  }, null);
  return {
    status: worst?.status ?? ("низкий" as RiskStatus),
    driver: worst?.label ?? "Нет данных",
  };
}

function resolveMainFactorGroup(
  factorId: ThermalMonteCarloSensitivityFactor["id"] | null
): "infiltrationACH" | "outdoorTemperatureShift" | "setpoint" | "internalGains" | "occupancy" | null {
  if (!factorId) {
    return null;
  }
  if (factorId === "daySetpoint" || factorId === "nightSetpoint") {
    return "setpoint";
  }
  return factorId;
}

function buildConclusion(input: {
  mainFactorGroup: ReturnType<typeof resolveMainFactorGroup>;
  underheatingRiskStatus: RiskStatus;
  overallRiskStatus: RiskStatus;
}) {
  const lines: string[] = [];
  if (input.mainFactorGroup === "infiltrationACH") {
    lines.push(
      "Основной источник неопределённости — воздухообмен и инфильтрация. Рекомендуется уточнить режим проветривания и герметичность ограждений."
    );
  } else if (input.mainFactorGroup === "outdoorTemperatureShift") {
    lines.push(
      "Основной источник неопределённости — климатические условия. Рекомендуется проверить расчётный климатический сценарий и наружные температуры."
    );
  } else if (input.mainFactorGroup === "setpoint") {
    lines.push(
      "Основной источник неопределённости — температурные уставки отопления. Рекомендуется уточнить режим эксплуатации здания."
    );
  } else if (input.mainFactorGroup === "internalGains") {
    lines.push("Сильное влияние оказывают внутренние теплопоступления. Желательно уточнить графики тепловыделений по эксплуатации.");
  } else if (input.mainFactorGroup === "occupancy") {
    lines.push("Сильное влияние оказывает режим занятости. Желательно уточнить фактический график присутствия пользователей в помещениях.");
  } else {
    lines.push("Главный фактор влияния не выделен однозначно; рекомендуется уточнять исходные допущения комплексно.");
  }

  if (input.underheatingRiskStatus === "высокий") {
    lines.push("Требуется проверить достаточность установленной мощности отопления.");
  }
  if (input.overallRiskStatus === "низкий") {
    lines.push("Тепловой режим устойчив в большинстве рассмотренных сценариев.");
  }
  return lines.join(" ");
}

function buildRoomRecommendation(underheatingRisk: number, minimumTemperatureP10C: number) {
  if (underheatingRisk > 0.6 || minimumTemperatureP10C < 18) {
    return "Проверить локальную мощность отопления, воздухопроницаемость и ограждающие конструкции.";
  }
  if (underheatingRisk > 0.3 || minimumTemperatureP10C < 19.5) {
    return "Уточнить режим эксплуатации, инфильтрацию и теплопотери по помещению.";
  }
  return "Существенный риск локального недогрева по выборке не выявлен.";
}

function buildRoomNameMap(model: BuildingModel) {
  return new Map(model.rooms.map((room, index) => [room.id, getRoomDisplayName(room, index)]));
}

function mapBuildingCategory(category: Sp50BuildingCategory | null) {
  switch (category) {
    case "residential":
      return "Жилое";
    case "public":
      return "Общественное";
    case "medical":
      return "Медицинское";
    case "educational":
      return "Образовательное";
    case "preschool":
      return "Дошкольное";
    case "administrative":
      return "Административное";
    case "industrialDry":
      return "Производственное (сухой режим)";
    case "industrialWet":
      return "Производственное (влажный режим)";
    case "industrialHighHeat":
      return "Производственное (повышенные тепловыделения)";
    case "agricultural":
      return "Сельскохозяйственное";
    case "storage":
      return "Складское";
    default:
      return "Не задано";
  }
}

function resolveDataReliability(model: BuildingModel, climateLabel: string | null, monteCarloResult: ThermalMonteCarloResult) {
  let score = 0;
  if (model.rooms.length > 0) score += 1;
  if (model.walls.length > 0) score += 1;
  if (climateLabel) score += 1;
  if (model.thermalProtection?.buildingCategory) score += 1;
  if ((monteCarloResult.roomRiskSummary?.length ?? 0) > 0) score += 1;

  if (score >= 5) {
    return "Высокий";
  }
  if (score >= 3) {
    return "Средний";
  }
  return "Ограниченный";
}

function formatRangeLabel(values: number[], unit: string, digits = 1) {
  if (!values.length) {
    return "Не определено";
  }
  return `${formatNumber(quantile(values, 0.1), { maximumFractionDigits: digits })}–${formatNumber(quantile(values, 0.9), {
    maximumFractionDigits: digits,
  })} ${unit}`;
}

function quantile(values: number[], probability: number) {
  if (!values.length) {
    return Number.NaN;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function probabilityOf(values: number[], predicate: (value: number) => boolean) {
  if (!values.length) {
    return null;
  }
  const matching = values.filter((value) => Number.isFinite(value) && predicate(value)).length;
  return matching / values.length;
}

function resolveRiskStatus(probability: number): RiskStatus {
  if (probability <= 0.1) {
    return "низкий";
  }
  if (probability <= 0.3) {
    return "средний";
  }
  if (probability <= 0.6) {
    return "повышенный";
  }
  return "высокий";
}

function riskRank(status: RiskStatus) {
  switch (status) {
    case "низкий":
      return 0;
    case "средний":
      return 1;
    case "повышенный":
      return 2;
    case "высокий":
      return 3;
    default:
      return 0;
  }
}

function riskBadgeTone(status: RiskStatus): "success" | "info" | "warning" | "accent" {
  switch (status) {
    case "низкий":
      return "success";
    case "средний":
      return "info";
    case "повышенный":
      return "warning";
    case "высокий":
      return "accent";
    default:
      return "info";
  }
}

function riskTone(status: RiskStatus): "ok" | "neutral" | "attention" | "risk" {
  switch (status) {
    case "низкий":
      return "ok";
    case "средний":
      return "neutral";
    case "повышенный":
      return "attention";
    case "высокий":
      return "risk";
    default:
      return "neutral";
  }
}

function formatProbability(value: number | null) {
  return value == null ? "—" : formatPercentage(value);
}

function buildMonteCarloMarkdownReport(input: {
  baseResult: ThermalSimulationResult;
  baseOptions: ThermalSimulationOptions;
  buildingModel: BuildingModel;
  climateLabel: string | null;
  monteCarloResult: ThermalMonteCarloResult;
  presentation: MonteCarloPresentation;
}) {
  const { baseResult, baseOptions, climateLabel, monteCarloResult, presentation } = input;
  const lines: string[] = [
    "# Отчёт по вероятностному анализу Monte Carlo",
    "",
    `Дата формирования: ${new Date().toLocaleString("ru-RU")}`,
    "",
    "## Исходные допущения",
    `- Тип здания: ${presentation.buildingTypeLabel}`,
    `- Город / климатический пресет: ${climateLabel ?? "Не задано"}`,
    `- Режим эксплуатации: ${presentation.operationModeLabel}`,
    `- Уровень достоверности данных: ${presentation.dataReliabilityLabel}`,
    `- Количество сценариев: ${monteCarloResult.runs}`,
    `- Диапазон наружной температуры: ${presentation.outdoorRangeLabel}`,
    `- Диапазон инфильтрации: ${presentation.infiltrationRangeLabel}`,
    `- Диапазон уставок: ${presentation.setpointRangeLabel}`,
    `- Диапазон внутренних теплопоступлений: ${presentation.internalGainsRangeLabel}`,
    "",
    "## Метод Monte Carlo",
    `- ${monteCarloResult.engineeringScopeRu}`,
    `- Период расчёта RC: ${baseOptions.duration === "7d" ? "7 суток" : "24 часа"}`,
    `- Seed: ${monteCarloResult.seed}`,
    `- VaR level: ${formatNumber(monteCarloResult.varLevel * 100, { maximumFractionDigits: 1 })}%`,
    "",
    "## Базовый сценарий и P10 / P50 / P90",
    "",
    "| Показатель | Базовый | P10 | P50 | P90 |",
    "| --- | ---: | ---: | ---: | ---: |",
    `| Энергия отопления, кВт·ч | ${formatNumber(baseResult.summary.totalEnergyKWh, { maximumFractionDigits: 1 })} | ${formatNumber(monteCarloResult.totalEnergy.p10, {
      maximumFractionDigits: 1,
    })} | ${formatNumber(monteCarloResult.totalEnergy.p50, { maximumFractionDigits: 1 })} | ${formatNumber(monteCarloResult.totalEnergy.p90, {
      maximumFractionDigits: 1,
    })} |`,
    `| Пиковая нагрузка, кВт | ${formatNumber(baseResult.summary.peakLoadKW, { maximumFractionDigits: 2 })} | ${formatNumber(monteCarloResult.peakLoad.p10, {
      maximumFractionDigits: 2,
    })} | ${formatNumber(monteCarloResult.peakLoad.p50, { maximumFractionDigits: 2 })} | ${formatNumber(monteCarloResult.peakLoad.p90, {
      maximumFractionDigits: 2,
    })} |`,
    `| Часы дискомфорта, ч | ${formatNumber(baseResult.summary.discomfortHours, { maximumFractionDigits: 1 })} | ${formatNumber(monteCarloResult.discomfort.p10, {
      maximumFractionDigits: 1,
    })} | ${formatNumber(monteCarloResult.discomfort.p50, { maximumFractionDigits: 1 })} | ${formatNumber(monteCarloResult.discomfort.p90, {
      maximumFractionDigits: 1,
    })} |`,
    "",
    "## Риски",
    "",
    "| Риск | Вероятность | Уровень |",
    "| --- | ---: | --- |",
    ...presentation.riskRows.map(
      (row) => `| ${row.label} | ${formatProbability(row.probability)} | ${row.status} |`
    ),
    "",
    "## Чувствительность",
    "",
    "| Фактор | Влияние, % |",
    "| --- | ---: |",
    ...presentation.sensitivity.map(
      (item) => `| ${item.label} | ${formatNumber(item.valuePercent, { maximumFractionDigits: 1 })} |`
    ),
    "",
    "## Инженерное заключение",
    presentation.conclusionText,
  ];

  if (presentation.roomRows.length) {
    lines.push(
      "",
      "## Риск по помещениям",
      "",
      "| Помещение | P50 температуры, °C | Минимальная температура P10, °C | Риск недогрева | Рекомендация |",
      "| --- | ---: | ---: | ---: | --- |",
      ...presentation.roomRows.map(
        (room) =>
          `| ${room.roomName} | ${formatNumber(room.temperatureP50C, {
            maximumFractionDigits: 1,
          })} | ${formatNumber(room.minimumTemperatureP10C, {
            maximumFractionDigits: 1,
          })} | ${formatPercentage(room.underheatingRisk)} | ${room.recommendation} |`
      )
    );
  }

  return `${lines.join("\n")}\n`;
}

function triggerDownload(blob: Blob, filename: string) {
  if (typeof window === "undefined") {
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default MonteCarloResultsSection;
