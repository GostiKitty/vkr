import { useMemo, useState } from "react";

import { useBuildStore } from "../build/build.store";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { syncBuildSimulationToStudio } from "../../core/thermal/thermalSimulationExport";
import { runThermalSimulation, type ThermalSimulationResult } from "../../core/thermal/solver";
import type { EngineeringMetricCard } from "../../core/thermal/thermalDiagnostics";
import { buildThermalSimulationInsightLines } from "../../core/thermal/thermalResultsInterpretation";
import { applyScenarioToBuilding } from "../build/thermal/applyScenarioToBuilding";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
import type { ProjectKind } from "../../entities/project/project.store";
import type { RunResult, RunResultMetric } from "../../shared/api/types";
import { runEngineSimulation } from "./runs.api";
import { FormulaHint } from "../formulas/components/FormulaHint";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
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
  /** Кнопка перехода к 3D (например, из вкладки «Результаты»). */
  onShowOnModel?: () => void;
  /** Прокрутка или фокус на блоке отчёта. */
  onGenerateReport?: () => void;
}

export function SimulationPanel({
  projectId,
  projectKind,
  onSolveComplete,
  onShowOnModel,
  onGenerateReport,
}: SimulationPanelProps) {
  const buildModel = useBuildStore((state) => state.model);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const pushScenarioRunSnapshot = useWorkflowStore((state) => state.pushScenarioRunSnapshot);
  const isLocalProject = projectKind === "local";
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
    if (!isLocalProject || running) {
      return;
    }
    if (!buildModel.rooms.length) {
      setSimError("Добавьте помещения и стены в режиме конструирования, чтобы запустить расчёт.");
      return;
    }

    setRunning(true);
    setSimError(null);
    setShowSuccess(false);
    try {
      const adjacency = buildAdjacencyGraph(buildModel);
      const modelForSim = applyScenarioToBuilding(buildModel, scenarioConfig);
      const simulation = runThermalSimulation(modelForSim, simulationOptions, adjacency);
      syncBuildSimulationToStudio(modelForSim, simulation, adjacency);
      pushScenarioRunSnapshot({
        label: scenarioConfig?.climateCityId ?? "Прогон",
        peakLoadKW: simulation.summary.peakLoadKW,
        totalEnergyKWh: simulation.summary.totalEnergyKWh,
        discomfortHours: simulation.summary.discomfortHours,
      });
      setResult(simulation);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
      onSolveComplete?.(simulation);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось выполнить расчёт.";
      setSimError(message);
    } finally {
      setRunning(false);
    }
  };

  const handleRunEngine = async () => {
    if (projectKind !== "engine" || !projectId || engineRunning) {
      return;
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
      const message = err instanceof Error ? err.message : "Не удалось запустить расчёт на движке.";
      setEngineError(message);
    } finally {
      setEngineRunning(false);
    }
  };

  const localDisabled = !isLocalProject || !buildModel.rooms.length || running;
  const engineActionDisabled = projectKind !== "engine" || !projectId || engineRunning;
  const isBusy = running || engineRunning;
  const b = result?.diagnostics?.building;

  return (
    <div className="space-y-5">
      <div className="ui-panel p-5 sm:p-6">
        <EngineeringSectionHeader
          kicker="Шаг расчёта"
          title="Локальный тепловой расчёт"
          subtitle="Зональная RC-модель по текущей геометрии из конструктора. Если сценарий сохранён, расчёт использует его климат, уставки, теплопоступления и ACH; иначе применяется встроенный пресет."
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRunLocal}
            disabled={localDisabled}
            className={`rounded-xl px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-base)]/30 sm:min-w-[220px] ${
              localDisabled
                ? "cursor-not-allowed border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]"
                : "ui-btn-primary sm:min-w-[220px]"
            }`}
          >
            {running ? "Выполняется расчёт…" : "Запустить расчёт"}
          </button>
        </div>

        {!isLocalProject && (
          <EngineeringCallout variant="info" title="Проект на движке" className="mt-4">
            <p>
              Сейчас выбран серверный режим. Локальный RC-прогон ниже не блокирует движок; при необходимости используйте
              блок «Расчёт на движке».
            </p>
          </EngineeringCallout>
        )}
        {isLocalProject && !buildModel.rooms.length && (
          <EngineeringCallout variant="attention" title="Модель не готова" className="mt-4">
            <p>Добавьте помещения и стены в режиме конструирования — без зон расчёт не запустится.</p>
          </EngineeringCallout>
        )}

        {simError && (
          <EngineeringCallout variant="risk" title="Не удалось выполнить расчёт" className="mt-4">
            <p>{simError}</p>
          </EngineeringCallout>
        )}

        {showSuccess && !simError && (
          <EngineeringCallout variant="success" title="Расчётная тепловая модель обновлена" className="mt-4">
            <p>
              Зональный расчёт выполнен по текущей геометрии. Можно открыть результаты, 3D и температурную карту — она
              построена по зональной модели и не является CFD.
            </p>
          </EngineeringCallout>
        )}
      </div>

      {projectKind === "engine" && (
        <div className="ui-panel p-5 sm:p-6">
          <EngineeringSectionHeader
            kicker="Сервер"
            title="Расчёт на движке"
            subtitle="Запрос к API движка с текущим идентификатором проекта. Набор метрик зависит от версии сервера."
          />
          <button
            type="button"
            onClick={handleRunEngine}
            disabled={engineActionDisabled}
            className={`mt-4 rounded-xl px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-base)]/30 sm:min-w-[220px] ${
              engineActionDisabled
                ? "cursor-not-allowed border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]"
                : "ui-btn-primary sm:min-w-[220px]"
            }`}
          >
            {engineRunning ? "Отправка запроса…" : "Запросить расчёт на движке"}
          </button>
          {!projectId && (
            <EngineeringCallout variant="attention" title="Нет идентификатора проекта" className="mt-4">
              <p>Сначала загрузите проект в студии и получите идентификатор на движке.</p>
            </EngineeringCallout>
          )}
          {engineError && (
            <EngineeringCallout variant="risk" title="Ответ движка" className="mt-4">
              <p>{engineError}</p>
            </EngineeringCallout>
          )}
          {engineResult && (
            <div className="mt-4 space-y-1 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Последний ответ</p>
              <p>
                ID запуска: <span className="font-semibold text-[color:var(--text-base)]">{engineResult.id}</span>
              </p>
              <p>
                Статус: <span className="font-semibold text-[color:var(--text-base)]">{translateStatus(engineResult.status)}</span>
              </p>
              <p>
                Время: <span className="font-semibold text-[color:var(--text-base)]">{formatTimestamp(engineResult.started_at)}</span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="ui-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <EngineeringSectionHeader
            kicker="Выходные данные"
            title="Сводка по расчёту"
            subtitle="Ключевые величины за выбранный период сценария. Удельные показатели отнесены к суммарной площади пола зон модели (не к «отапливаемой площади» СП)."
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

                {b && (
                  <EngineeringCallout variant="assumption" title="Доли теплопотерь в диагностическом срезе (пик Σ Q̇_ot)">
                    <p className="mb-2 text-[color:var(--text-muted)]">
                      Непрозрачная часть {b.lossSharePercent.opaque.toFixed(0)}% · окна {b.lossSharePercent.window.toFixed(0)}% · двери{" "}
                      {b.lossSharePercent.door.toFixed(0)}% · инфильтрация {b.lossSharePercent.infiltration.toFixed(0)}%. Учитывается только
                      отвод при <em>T</em>
                      <sub>внутри</sub> &gt; <em>T</em>
                      <sub>наруж</sub>.
                    </p>
                    <p className="text-xs text-[color:var(--text-soft)]">{b.referenceNote}</p>
                  </EngineeringCallout>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <EngineeringCallout variant="assumption" title="Допущения расчёта">
                    <ul>
                      <li>Отопление моделируется как источник до уставки без учёта гидравлики и реальной регулировки.</li>
                      <li>Инфильтрация — сенсибельная модель по ACH (см. формулу проводимости в карточках ниже).</li>
                      <li>Блок не заменяет нормативную проверку СП 50 и не является CFD.</li>
                    </ul>
                  </EngineeringCallout>
                  <EngineeringCallout variant="info" title="Ограничения метода">
                    <ul>
                      <li>Зональная температура — усреднение по объёму зоны.</li>
                      <li>Остаток баланса в срезе проверяет согласованность с дискретным уравнением RC, а не «правильность здания» в нормах.</li>
                    </ul>
                  </EngineeringCallout>
                </div>

                {result.modelWarnings && result.modelWarnings.length > 0 && (
                  <EngineeringCallout variant="attention" title="Предупреждения модели — что стоит проверить">
                    <ul>
                      {result.modelWarnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </EngineeringCallout>
                )}

                {insightLines.length > 0 && (
                  <EngineeringCallout variant="info" title="Инженерный вывод (кратко)">
                    <ul>
                      {insightLines.map((line) => (
                        <li key={line.slice(0, 80)}>{line}</li>
                      ))}
                    </ul>
                  </EngineeringCallout>
                )}

                {result.diagnostics && (
                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-base)]">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Методика RC и контрольные карточки</p>
                    <p className="mt-2 leading-relaxed text-[color:var(--text-muted)]">{result.diagnostics.engineering.calculationLevelRu}</p>
                    <p className="mt-2 font-mono text-[11px] leading-snug text-[color:var(--text-muted)]">{result.diagnostics.engineering.discreteBalanceEquation}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">{result.diagnostics.engineering.infiltrationConductanceFormula}</p>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Показатели: формула и смысл</p>
                    <ul className="mt-2 space-y-3">
                      {result.diagnostics.metricCards.map((card) => (
                        <li key={card.title} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-3 shadow-sm">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-medium text-[color:var(--text-base)]">{card.title}</span>
                            <span className="tabular-nums text-[color:var(--text-base)]">
                              {card.valueText} <span className="text-[color:var(--text-muted)]">{card.unit}</span> <DiagnosticsStatusBadge status={card.status} />
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[color:var(--text-soft)]">Формула: {card.formula}</p>
                          <p className="mt-1 text-xs text-[color:var(--text-muted)]">{card.engineeringSenseRu}</p>
                          <p className="mt-1 text-xs text-[color:var(--text-muted)]">Допущения: {card.assumptionsRu}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-[color:var(--text-soft)]">{result.diagnostics.engineering.notSp50NormativeCheckRu}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-soft)]">{result.diagnostics.engineering.notMonteCarloRu}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-soft)]">{result.diagnostics.engineering.notCfdFieldRu}</p>
                  </div>
                )}

                {result && (onShowOnModel || onGenerateReport) ? (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--border-soft)] pt-4">
                    {onShowOnModel ? (
                      <button type="button" className="ui-btn-secondary text-sm" onClick={onShowOnModel}>
                        Показать на модели
                      </button>
                    ) : null}
                    {onGenerateReport ? (
                      <button type="button" className="ui-btn-primary text-sm" onClick={onGenerateReport}>
                        Сформировать отчёт
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
            {engineResult && (
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Ответ движка</p>
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

export default SimulationPanel;
