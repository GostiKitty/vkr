import { useMemo, useState } from "react";

import { useBuildStore } from "../build/build.store";
import { type ThermalSimulationResult } from "../../core/thermal/solver";
import type { EngineeringMetricCard } from "../../core/thermal/thermalDiagnostics";
import { buildThermalSimulationInsightLines } from "../../core/thermal/thermalResultsInterpretation";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
import type { ProjectKind } from "../../entities/project/project.store";
import type { RunResult, RunResultMetric } from "../../shared/api/types";
import { ENGINE_RUN_PATH, runEngineSimulation } from "./runs.api";
import { FormulaHint } from "../formulas/components/FormulaHint";
import { openFormulaDrawer } from "../../entities/formulas/formulaDrawer.store";
import { formulaMap } from "../../entities/formulas/registry";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { ApiError } from "../../shared/api/client";
import { getProjectSource } from "../../shared/utils/projectRuntime";
import { runLocalThermalCalculation } from "./runLocalThermalCalculation";
import {
  CollapsibleSection,
  SummaryHero,
  SummaryHighlightGrid,
} from "../../shared/ui";
import {
  EngineeringCallout,
  EngineeringMetricTile,
  EngineeringSectionHeader,
  type MetricStatusTone,
} from "../../shared/ui/EngineeringUi";

interface SimulationPanelProps {
  projectId: string | null;
  projectKind: ProjectKind;
  onSolveComplete?: (result: ThermalSimulationResult) => void;
  onLocalRunStart?: () => void;
  onLocalRunFinish?: () => void;
  onLocalRunError?: (message: string) => void;
  /** Кнопка перехода к 3D (например, из вкладки «Результаты»). */
  onShowOnModel?: () => void;
  /** Прокрутка или фокус на блоке отчёта. */
  onGenerateReport?: () => void;
}

export function SimulationPanel({
  projectId,
  projectKind,
  onSolveComplete,
  onLocalRunStart,
  onLocalRunFinish,
  onLocalRunError,
  onShowOnModel,
  onGenerateReport,
}: SimulationPanelProps) {
  const buildModel = useBuildStore((state) => state.model);
  const projectKey = useBuildStore((state) => state.projectKey);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const engineBaseUrl = useEngineSettingsStore((state) => state.baseUrl.trim());
  const projectSource = getProjectSource(projectId, projectKind);
  const engineProjectAvailable = projectSource === "engine";
  const simulationOptions = useMemo(() => buildThermalOptionsFromWorkflow(scenarioConfig), [scenarioConfig]);

  const [result, setResult] = useState<ThermalSimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [engineResult, setEngineResult] = useState<RunResult | null>(null);
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  const metrics = useMemo(() => {
    if (!result) {
      return { energyDemand: null, heatingLoad: null, coolingLoad: null };
    }
    return {
      energyDemand: result.summary.totalEnergyKWh,
      heatingLoad: result.summary.peakLoadKW,
      coolingLoad: null,
    };
  }, [result]);

  const engineMetrics = useMemo(() => extractEngineMetrics(engineResult), [engineResult]);

  const roomTempRange = useMemo(() => (result ? roomTemperatureRangeAcrossTimeline(result) : { min: null, max: null }), [result]);

  const insightLines = useMemo(
    () => (result ? buildThermalSimulationInsightLines(result, { duration: simulationOptions.duration }) : []),
    [result, simulationOptions.duration]
  );

  const balanceTone: MetricStatusTone = useMemo(() => {
    const s = result?.diagnostics?.building.balanceStatus;
    if (s === "risk") {
      return "risk";
    }
    if (s === "attention") {
      return "attention";
    }
    return "ok";
  }, [result?.diagnostics?.building.balanceStatus]);

  const handleRunLocal = () => {
    if (running) {
      return;
    }
    if (!buildModel.rooms.length) {
      setSimError("Добавьте помещения и стены в режиме конструирования, чтобы запустить расчёт.");
      return;
    }

    setRunning(true);
    onLocalRunStart?.();
    setSimError(null);
    setShowSuccess(false);
    try {
      const simulation = runLocalThermalCalculation();
      setResult(simulation);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
      onSolveComplete?.(simulation);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось выполнить расчёт.";
      setSimError(message);
      onLocalRunError?.(message);
    } finally {
      setRunning(false);
      onLocalRunFinish?.();
    }
  };

  const handleRunEngine = async () => {
    if (!engineProjectAvailable) {
      setEngineError(
        "Серверный расчёт недоступен для локального проекта. Используйте локальный расчёт или импортируйте модель на движок."
      );
      return;
    }
    if (!projectId || engineRunning) {
      return;
    }
    if (!engineBaseUrl) {
      setEngineError("Не задан адрес движка. Откройте Инструменты → Настройки.");
      return;
    }
    const endpoint = `${engineBaseUrl.replace(/\/+$/, "")}${ENGINE_RUN_PATH}`;
    if (import.meta.env.DEV) {
      console.groupCollapsed("[engine-run] Request debug");
      console.log({
        projectId,
        projectKind,
        projectKey,
        baseUrl: engineBaseUrl,
        endpoint,
        source: projectSource,
      });
      console.groupEnd();
    }
    setEngineRunning(true);
    setEngineError(null);
    try {
      const response = await runEngineSimulation(projectId);
      setEngineResult(response);
      const fallbackSummary = buildEngineSummary(response);
      if (fallbackSummary) {
        onSolveComplete?.({ timeline: [], rooms: {}, summary: fallbackSummary });
      }
    } catch (err) {
      const message = mapEngineRunError(err, {
        projectSource,
        baseUrl: engineBaseUrl,
      });
      setEngineError(message);
    } finally {
      setEngineRunning(false);
    }
  };

  const localDisabled = !buildModel.rooms.length || running;
  const engineActionDisabled = !engineProjectAvailable || !projectId || !engineBaseUrl || engineRunning;
  const isBusy = running || engineRunning;
  const b = result?.diagnostics?.building;

  const enginePeakMetric = engineMetrics.find((m) => /peak|нагруз/i.test(m.key) || /peak|нагруз/i.test(m.label ?? ""));
  const heroHighlights =
    result || engineResult
      ? [
          {
            label: "Пиковая нагрузка",
            value:
              metrics.heatingLoad != null
                ? `${formatNumber(metrics.heatingLoad, { maximumFractionDigits: 2 })} кВт`
                : enginePeakMetric
                  ? formatEngineValue(enginePeakMetric)
                  : "—",
            hint: "Максимум суммарной мощности отопления за период.",
            tone: "info" as const,
          },
          {
            label: "Тепловая энергия",
            value: metrics.energyDemand == null ? "—" : formatEnergy(metrics.energyDemand),
            hint: "Интеграл нагрузки за длительность сценария.",
            tone: "neutral" as const,
          },
          {
            label: "Часы дискомфорта",
            value:
              result?.summary.discomfortHours == null
                ? "—"
                : `${formatNumber(result.summary.discomfortHours, { maximumFractionDigits: 1 })} ч`,
            hint: "Суммарно по зонам при отклонении ниже уставки.",
            tone: (result?.summary.discomfortHours ?? 0) > 24 ? ("warning" as const) : ("success" as const),
          },
          {
            label: "Удельная пиковая нагрузка",
            value: b == null ? "—" : `${formatNumber(b.specificPeakLoad_W_m2, { maximumFractionDigits: 1 })} Вт/м²`,
            hint: "На м² пола зон RC-модели.",
            tone: balanceTone === "ok" ? ("success" as const) : balanceTone === "risk" ? ("warning" as const) : ("info" as const),
          },
        ]
      : [];

  return (
    <div className="space-y-5">
      <SummaryHero
        title="Запуск теплового расчёта"
        description="Локальная зональная RC-модель по геометрии из конструктора. При сохранённом сценарии учитываются климат, уставки и инфильтрация."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRunLocal}
            disabled={localDisabled}
            className={`rounded-xl px-6 py-3.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-base)]/30 sm:min-w-[240px] ${
              localDisabled
                ? "cursor-not-allowed border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]"
                : "ui-btn-primary sm:min-w-[240px]"
            }`}
          >
            {running ? "Выполняется расчёт…" : "Запустить расчёт"}
          </button>
          {result && (onShowOnModel || onGenerateReport) ? (
            <div className="flex flex-wrap gap-2">
              {onShowOnModel ? (
                <button type="button" className="ui-btn-secondary text-sm" onClick={onShowOnModel}>
                  Показать на модели
                </button>
              ) : null}
              {onGenerateReport ? (
                <button type="button" className="ui-btn-secondary text-sm" onClick={onGenerateReport}>
                  Сформировать отчёт
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {engineProjectAvailable ? (
          <p className="mt-3 text-sm text-[color:var(--text-muted)]">
            Проект также доступен на движке — серверный запрос вынесен в дополнительный блок ниже.
          </p>
        ) : null}
        {!buildModel.rooms.length ? (
          <EngineeringCallout variant="attention" title="Модель не готова" className="mt-4">
            <p>Добавьте помещения и стены в конструкторе — без зон расчёт не запустится.</p>
          </EngineeringCallout>
        ) : null}
        {simError ? (
          <EngineeringCallout variant="risk" title="Не удалось выполнить расчёт" className="mt-4">
            <p>{simError}</p>
          </EngineeringCallout>
        ) : null}
        {showSuccess && !simError ? (
          <EngineeringCallout variant="success" title="Расчёт обновлён" className="mt-4">
            <p>Модель пересчитана. Откройте результаты или 3D — карта температур строится по зональной модели, не CFD.</p>
          </EngineeringCallout>
        ) : null}
      </SummaryHero>

      {heroHighlights.length > 0 ? <SummaryHighlightGrid items={heroHighlights} /> : null}

      <CollapsibleSection
        title="Расчёт на движке (опционально)"
        description="Запрос к API движка. Набор метрик зависит от версии сервера."
      >
        <div className="space-y-4 pt-3">
          <button
            type="button"
            onClick={handleRunEngine}
            disabled={engineActionDisabled}
            className={`rounded-xl px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-base)]/30 sm:min-w-[220px] ${
              engineActionDisabled
                ? "cursor-not-allowed border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]"
                : "ui-btn-secondary sm:min-w-[220px]"
            }`}
          >
            {engineRunning ? "Отправка запроса…" : "Запросить расчёт на движке"}
          </button>
          {!engineProjectAvailable ? (
            <EngineeringCallout variant="info" title="Локальная модель">
              <p>Серверный расчёт доступен после импорта проекта на движок.</p>
            </EngineeringCallout>
          ) : null}
          {engineProjectAvailable && !engineBaseUrl ? (
            <EngineeringCallout variant="attention" title="Движок не настроен">
              <p>Укажите адрес в Инструменты → Настройки.</p>
            </EngineeringCallout>
          ) : null}
          {engineProjectAvailable && !projectId ? (
            <EngineeringCallout variant="attention" title="Нет идентификатора проекта">
              <p>Сначала загрузите проект на движке.</p>
            </EngineeringCallout>
          ) : null}
          {engineError ? (
            <EngineeringCallout variant="risk" title="Ответ движка">
              <p>{engineError}</p>
            </EngineeringCallout>
          ) : null}
          {engineResult ? (
            <div className="space-y-1 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]">
              <p className="text-sm font-semibold text-[color:var(--text-base)]">Последний ответ</p>
              <p>
                Запуск: <span className="font-semibold text-[color:var(--text-base)]">{engineResult.id}</span>
              </p>
              <p>
                Статус: <span className="font-semibold text-[color:var(--text-base)]">{translateStatus(engineResult.status)}</span>
              </p>
              <p>
                Время: <span className="font-semibold text-[color:var(--text-base)]">{formatTimestamp(engineResult.started_at)}</span>
              </p>
            </div>
          ) : null}
        </div>
      </CollapsibleSection>

      <div className="ui-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <EngineeringSectionHeader
            kicker="Показатели"
            title="Детальная сводка"
            subtitle="Расширенные величины за период сценария. Удельные значения — на м² пола зон модели."
          />
          <FormulaHint ids={["thermal_peak_load"]} />
        </div>
        {isBusy ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-14 ui-skeleton rounded-xl" />
            ))}
          </div>
        ) : !result && !engineResult ? (
          <p className="mt-4 text-sm text-[color:var(--text-muted)]">Запустите локальный или серверный расчёт — здесь появятся числа и инженерные выводы.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {result && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <EngineeringMetricTile
                    label="Пиковая мощность отопления"
                    value={metrics.heatingLoad == null ? "—" : formatNumber(metrics.heatingLoad, { maximumFractionDigits: 3 })}
                    unit="кВт"
                    hint="Максимум по времени суммы мощностей по зонам — одновременная нагрузка на «систему» в модели."
                    tone="neutral"
                  />
                  <EngineeringMetricTile
                    label="Тепловая энергия за период"
                    value={metrics.energyDemand == null ? "—" : formatEnergy(metrics.energyDemand)}
                    unit="кВт·ч"
                    hint="Интеграл суммарной мощности отопления за длительность сценария (24 ч в пресете)."
                    tone="neutral"
                  />
                  <EngineeringMetricTile
                    label="Удельная пиковая нагрузка"
                    value={b == null ? "—" : formatNumber(b.specificPeakLoad_W_m2, { maximumFractionDigits: 1 })}
                    unit="Вт/м²"
                    hint="Пик / площадь пола зон RC-модели."
                    tone={balanceTone}
                  />
                  <EngineeringMetricTile
                    label="Удельная энергия за период"
                    value={b == null ? "—" : formatNumber(b.specificEnergyKWh_m2, { maximumFractionDigits: 2 })}
                    unit="кВт·ч/м²"
                    hint="Энергия отопления за период на м² пола зон."
                    tone="neutral"
                  />
                  <EngineeringMetricTile
                    label="Мин. температура зон (по таймлайну)"
                    value={roomTempRange.min == null ? "—" : formatNumber(roomTempRange.min, { maximumFractionDigits: 1 })}
                    unit="°C"
                    hint="Минимум по всем зонам и всем шагам после расчёта — ориентир, не норматив комфорта."
                    tone="neutral"
                  />
                  <EngineeringMetricTile
                    label="Часы дискомфорта (сумма по зонам)"
                    value={result.summary.discomfortHours == null ? "—" : formatNumber(result.summary.discomfortHours, { maximumFractionDigits: 1 })}
                    unit="ч"
                    hint="Время ниже уставки более чем на 0,05 °C; при нескольких зонах может превышать длительность периода."
                    tone={result.summary.discomfortHours > 24 ? "attention" : "ok"}
                  />
                </div>

                {insightLines.length > 0 ? (
                  <EngineeringCallout variant="info" title="Краткий вывод">
                    <ul>
                      {insightLines.map((line) => (
                        <li key={line.slice(0, 80)}>{line}</li>
                      ))}
                    </ul>
                  </EngineeringCallout>
                ) : null}

                <CollapsibleSection
                  title="Методика, допущения и диагностика"
                  description="Формулы, ограничения модели и контрольные карточки RC — для углублённой проверки."
                >
                  <div className="space-y-4 pt-3">
                    {b ? (
                      <EngineeringCallout variant="assumption" title="Доли теплопотерь (пик)">
                        <p className="mb-2 text-[color:var(--text-muted)]">
                          Непрозрачные {b.lossSharePercent.opaque.toFixed(0)}% · окна {b.lossSharePercent.window.toFixed(0)}% · двери{" "}
                          {b.lossSharePercent.door.toFixed(0)}% · инфильтрация {(b.infiltrationShareOfTotalPct ?? b.lossSharePercent.infiltration).toFixed(0)}% от всех теплопотерь.
                        </p>
                        {b.lossShareWarnings.length ? (
                          <ul className="mb-2 list-disc pl-5 text-xs text-[color:var(--text-soft)]">
                            {b.lossShareWarnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="text-xs text-[color:var(--text-soft)]">{b.referenceNote}</p>
                      </EngineeringCallout>
                    ) : null}

                    <div className="grid gap-4 lg:grid-cols-2">
                      <EngineeringCallout variant="assumption" title="Допущения расчёта">
                        <ul>
                          <li>Отопление — источник до уставки без гидравлики и реальной регулировки.</li>
                          <li>Инфильтрация по ACH; см. формулы в карточках ниже.</li>
                          <li>Не заменяет нормативную проверку СП 50 и не является CFD.</li>
                        </ul>
                      </EngineeringCallout>
                      <EngineeringCallout variant="info" title="Ограничения метода">
                        <ul>
                          <li>Зональная температура — усреднение по объёму.</li>
                          <li>Остаток баланса проверяет согласованность RC, а не норматив здания.</li>
                        </ul>
                      </EngineeringCallout>
                    </div>

                    {result.modelWarnings && result.modelWarnings.length > 0 ? (
                      <EngineeringCallout variant="attention" title="Предупреждения модели">
                        <ul>
                          {result.modelWarnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      </EngineeringCallout>
                    ) : null}

                    {result.diagnostics ? (
                      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-base)]">
                        <p className="text-sm font-semibold text-[color:var(--text-base)]">Методика RC</p>
                        <p className="mt-2 leading-relaxed text-[color:var(--text-muted)]">{result.diagnostics.engineering.calculationLevelRu}</p>
                        <p className="mt-2 font-mono text-[11px] leading-snug text-[color:var(--text-muted)]">
                          {result.diagnostics.engineering.discreteBalanceEquation}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--text-muted)]">{result.diagnostics.engineering.infiltrationConductanceFormula}</p>
                        <p className="mt-4 text-sm font-semibold text-[color:var(--text-base)]">Контрольные показатели</p>
                        <ul className="mt-2 space-y-3">
                          {result.diagnostics.metricCards.map((card) => {
                            const linkedFormulaIds = result.diagnostics!.metricCards
                              .map((entry) => entry.formulaId)
                              .filter((id): id is string => typeof id === "string" && Boolean(formulaMap[id]));
                            return (
                            <li key={card.title} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-3 shadow-sm">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium text-[color:var(--text-base)]">{card.title}</span>
                                <span className="tabular-nums text-[color:var(--text-base)]">
                                  {card.valueText} <span className="text-[color:var(--text-muted)]">{card.unit}</span>{" "}
                                  <DiagnosticsStatusBadge status={card.status} />
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[color:var(--text-soft)]">Формула: {card.formula}</p>
                              {card.formulaId && formulaMap[card.formulaId] ? (
                                <button
                                  type="button"
                                  className="mt-1 text-xs font-semibold text-[color:var(--accent-base)] underline-offset-2 hover:underline"
                                  onClick={() => openFormulaDrawer(linkedFormulaIds, card.formulaId)}
                                >
                                  {formulaMap[card.formulaId].title} — открыть в реестре
                                </button>
                              ) : null}
                              <p className="mt-1 text-xs text-[color:var(--text-muted)]">{card.engineeringSenseRu}</p>
                              <p className="mt-1 text-xs text-[color:var(--text-muted)]">Допущения: {card.assumptionsRu}</p>
                            </li>
                            );
                          })}
                        </ul>
                        <p className="mt-3 text-xs text-[color:var(--text-soft)]">{result.diagnostics.engineering.notSp50NormativeCheckRu}</p>
                        <p className="mt-1 text-xs text-[color:var(--text-soft)]">{result.diagnostics.engineering.notMonteCarloRu}</p>
                        <p className="mt-1 text-xs text-[color:var(--text-soft)]">{result.diagnostics.engineering.notCfdFieldRu}</p>
                      </div>
                    ) : null}
                  </div>
                </CollapsibleSection>
              </>
            )}
            {engineResult && (
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4">
                <p className="text-sm font-semibold text-[color:var(--text-base)]">Ответ движка</p>
                {engineMetrics.length ? (
                  <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--text-muted)]">
                    {engineMetrics.map((metric) => (
                      <li key={metric.key} className="flex items-center justify-between gap-4 border-b border-[color:var(--border-soft)] py-1 last:border-0">
                        <span>{metric.label ?? metric.key}</span>
                        <span className="font-semibold tabular-nums text-[color:var(--text-base)]">{formatEngineValue(metric)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[color:var(--text-soft)]">Метрики в ответе не переданы.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DiagnosticsStatusBadge({ status }: { status: EngineeringMetricCard["status"] }) {
  const map = {
    ok: { label: "норма", className: "bg-[color:var(--success-bg)] text-[color:var(--success-fg)] ring-1 ring-[color:var(--success-border)]" },
    attention: {
      label: "внимание",
      className: "bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)] ring-1 ring-[color:var(--warning-border)]",
    },
    risk: { label: "риск", className: "bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)] ring-1 ring-[color:var(--danger-border)]" },
  } as const;
  const entry = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${entry.className}`}>{entry.label}</span>;
}

function roomTemperatureRangeAcrossTimeline(result: ThermalSimulationResult): { min: number | null; max: number | null } {
  let minV = Infinity;
  let maxV = -Infinity;
  for (const frame of result.timeline) {
    if (!frame.rooms) {
      continue;
    }
    for (const r of Object.values(frame.rooms)) {
      if (Number.isFinite(r.temperatureC)) {
        minV = Math.min(minV, r.temperatureC);
        maxV = Math.max(maxV, r.temperatureC);
      }
    }
  }
  if (!Number.isFinite(minV)) {
    return { min: null, max: null };
  }
  return { min: minV, max: maxV };
}

function extractEngineMetrics(result: RunResult | null): RunResultMetric[] {
  return result?.metrics ?? [];
}

function formatEngineValue(metric: RunResultMetric): string {
  const formatted = formatNumber(metric.value, { maximumFractionDigits: 2 });
  return metric.unit ? `${formatted} ${metric.unit}` : formatted;
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "—";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function translateStatus(status: RunResult["status"]): string {
  switch (status) {
    case "completed":
      return "Готово";
    case "failed":
      return "Ошибка";
    case "running":
      return "Выполняется";
    default:
      return "Ожидает";
  }
}

function buildEngineSummary(result: RunResult | null): ThermalSimulationResult["summary"] | null {
  if (!result?.metrics) {
    return null;
  }
  const findMetric = (key: string) => result.metrics?.find((metric) => metric.key === key)?.value ?? null;
  const energy = findMetric("energy_demand_kwh") ?? findMetric("energy_kwh");
  const peak = findMetric("peak_heating_kw");
  if (energy == null && peak == null) {
    return null;
  }
  return {
    totalEnergyKWh: energy ?? 0,
    peakLoadKW: peak ?? 0,
    discomfortHours: 0,
  };
}

function mapEngineRunError(
  error: unknown,
  context: {
    projectSource: ReturnType<typeof getProjectSource>;
    baseUrl: string;
  }
): string {
  if (context.projectSource !== "engine") {
    return "Серверный расчёт недоступен для локального проекта. Используйте локальный расчёт или импортируйте модель на движок.";
  }
  if (!context.baseUrl) {
    return "Не задан адрес движка. Откройте Инструменты → Настройки.";
  }
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return "Проект не найден на движке. Проверьте ID проекта или повторите импорт IFC.";
    }
    if (error.status >= 500) {
      return "Движок не смог выполнить расчёт. Проверьте доступность сервера и повторите запрос.";
    }
  }
  return error instanceof Error ? error.message : "Не удалось запустить расчёт на движке.";
}

export default SimulationPanel;
