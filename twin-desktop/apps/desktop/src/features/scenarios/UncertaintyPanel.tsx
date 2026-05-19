import React, { useCallback, useEffect, useState } from "react";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { runThermalMonteCarlo, THERMAL_MONTE_CARLO_MAX_RUNS } from "../../core/uncertainty/thermalMonteCarlo";
import { useBuildStore } from "../build/build.store";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { EngineeringCallout, EngineeringSectionHeader } from "../../shared/ui";

const DEFAULT_MONTE_CARLO_RUNS = 200;
const DEFAULT_MONTE_CARLO_MODE = "full-physics" as const;

const clampMonteCarloRuns = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_MONTE_CARLO_RUNS;
  }
  return Math.min(THERMAL_MONTE_CARLO_MAX_RUNS, Math.max(1, Math.round(value)));
};

export function UncertaintyPanel() {
  const config = useWorkflowStore((state) => state.uncertaintyConfig);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const setConfig = useWorkflowStore((state) => state.setUncertaintyConfig);
  const setMonteCarloResult = useWorkflowStore((state) => state.setMonteCarloResult);
  const buildModel = useBuildStore((state) => state.model);
  const [runs, setRuns] = useState(config?.runs ?? DEFAULT_MONTE_CARLO_RUNS);
  const [mcRunning, setMcRunning] = useState(false);
  const [mcError, setMcError] = useState<string | null>(null);
  const [evaluationMode, setEvaluationMode] = useState<"full-physics" | "surrogate">(
    config?.evaluationMode ?? DEFAULT_MONTE_CARLO_MODE
  );
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setRuns(clampMonteCarloRuns(config.runs));
      setEvaluationMode(config.evaluationMode);
    }
  }, [config]);

  const handleReset = () => {
    setRuns(DEFAULT_MONTE_CARLO_RUNS);
    setEvaluationMode(DEFAULT_MONTE_CARLO_MODE);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextRuns = clampMonteCarloRuns(runs);
    setRuns(nextRuns);
    setConfig({ runs: nextRuns, evaluationMode });
    setHasSaved(true);
    setTimeout(() => setHasSaved(false), 1500);
  };

  const handleRunMonteCarlo = useCallback(() => {
    if (!buildModel.rooms.length) {
      setMcError("Добавьте помещения в конструкторе перед анализом рисков.");
      return;
    }
    setMcRunning(true);
    setMcError(null);
    try {
      const adjacency = buildAdjacencyGraph(buildModel);
      const nextRuns = clampMonteCarloRuns(runs);
      setRuns(nextRuns);
      const result = runThermalMonteCarlo({
        model: buildModel,
        baseOptions: buildThermalOptionsFromWorkflow(scenarioConfig),
        runs: nextRuns,
        adjacency,
      });
      setMonteCarloResult(result);
      setConfig({ runs: nextRuns, evaluationMode });
    } catch (error) {
      setMcError(error instanceof Error ? error.message : "Не удалось выполнить Monte Carlo.");
    } finally {
      setMcRunning(false);
    }
  }, [buildModel, evaluationMode, runs, scenarioConfig, setConfig, setMonteCarloResult]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="ui-panel p-5 sm:p-6">
        <EngineeringSectionHeader
          kicker="Шаг 5 · риски"
          title="Неопределённость входов (Monte Carlo)"
          subtitle="Число прогонов и режим оценки. Анализ показывает разброс показателей при вариации климата, ACH, тепловыделений и уставок в той же RC-модели — это не «абсолютный прогноз» и не норматив СП 50."
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.95fr)]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Параметры прогона</p>
            <EngineeringCallout variant="assumption" title="Изменения применяются к следующему прогону">
              <p>
                Число прогонов и режим оценки меняют только следующий запуск вероятностного анализа. Уже сохранённые распределения, гистограммы и CDF не
                пересчитываются автоматически.
              </p>
            </EngineeringCallout>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="ui-panel-muted rounded-2xl border border-[color:var(--border-soft)] p-4 text-sm font-medium text-[color:var(--text-muted)]">
                <span className="flex flex-wrap items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block">Число прогонов</span>
                    <span className="mt-1 block text-xs font-normal leading-5 text-[color:var(--text-soft)]">
                      Текущее значение: {runs} прогонов. Используется в вероятностном анализе RC-модели. Допустимый диапазон: от 1 до {THERMAL_MONTE_CARLO_MAX_RUNS}. По умолчанию: {DEFAULT_MONTE_CARLO_RUNS}.
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRuns(DEFAULT_MONTE_CARLO_RUNS)}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]"
                  >
                    Сбросить
                  </button>
                </span>
                <input
                  type="number"
                  min={1}
                  max={THERMAL_MONTE_CARLO_MAX_RUNS}
                  value={runs}
                  onChange={(event) => setRuns(clampMonteCarloRuns(Number(event.target.value)))}
                  className="ui-field mt-2 px-3 py-2 shadow-inner"
                />
                <span className="mt-2 text-xs font-normal text-[color:var(--text-soft)]">
                  Больше прогонов — глаже перцентили P5/P50/P95 и оценка VaR/CVaR (дольше по времени).
                </span>
              </label>

              <label className="ui-panel-muted rounded-2xl border border-[color:var(--border-soft)] p-4 text-sm font-medium text-[color:var(--text-muted)]">
                <span className="flex flex-wrap items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block">Режим расчёта</span>
                    <span className="mt-1 block text-xs font-normal leading-5 text-[color:var(--text-soft)]">
                      Где используется: вероятностный анализ по RC-модели. По умолчанию: {DEFAULT_MONTE_CARLO_MODE === "full-physics" ? "полная физика" : "суррогат"}.
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEvaluationMode(DEFAULT_MONTE_CARLO_MODE)}
                    className="rounded-full border border-[color:var(--border-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-elevated)]"
                  >
                    Сбросить
                  </button>
                </span>
                <select
                  value={evaluationMode}
                  onChange={(event) => setEvaluationMode(event.target.value as "full-physics" | "surrogate")}
                  className="ui-field mt-2 px-3 py-2"
                >
                  <option value="full-physics">Полная физика (каждый прогон — RC-модель)</option>
                  <option value="surrogate">Суррогат (быстро, если доступна обученная замена)</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="ui-btn-secondary px-6 py-2.5 text-sm"
              >
                Сбросить к умолчанию
              </button>
              <button
                type="submit"
                className="ui-btn-secondary px-6 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-base)]/25"
              >
                Сохранить настройки
              </button>
              <button
                type="button"
                onClick={handleRunMonteCarlo}
                disabled={mcRunning}
                className="ui-btn-primary px-6 py-2.5 text-sm disabled:opacity-60"
              >
                {mcRunning ? "Прогон…" : "Запустить Monte Carlo"}
              </button>
            </div>

            {mcError ? (
              <EngineeringCallout variant="risk" title="Ошибка прогона" className="mt-2">
                <p>{mcError}</p>
              </EngineeringCallout>
            ) : null}

            {hasSaved && (
              <EngineeringCallout variant="success" title="Сохранено" className="mt-2">
                <p>Параметры учтены. Гистограммы и CDF доступны на шаге «Результаты» во вкладке «Показатели».</p>
              </EngineeringCallout>
            )}

            <EngineeringCallout variant="info" title="Пока не вынесено в настройки" className="mt-2">
              <p>
                Порог по пиковой нагрузке <code>heatingThresholdKW</code> и уровень риска <code>varLevel</code> уже есть в Monte Carlo-ядре, но пока не вынесены в
                редактируемый UI. Они помечены как TODO в backlog, чтобы не создавать новый расчётный контур без отдельного согласования.
              </p>
            </EngineeringCallout>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Что означают числа</p>
            <EngineeringCallout variant="info" title="Гистограмма, CDF, P5 / P50 / P95">
              <p>
                <strong>Гистограмма</strong> показывает частоту значений метрики по прогонам, <strong>CDF</strong> — накопленную долю до заданного уровня.{" "}
                <strong>P5, P50, P95</strong> — типичный низкий, медианный и высокий уровень выборки.{" "}
                <strong>Вероятность превышения</strong> — доля сценариев выше выбранного порога; зависит от порога и числа прогонов.
              </p>
            </EngineeringCallout>
            <EngineeringCallout variant="assumption" title="VaR, CVaR и seed">
              <ul>
                <li>
                  <strong>VaR</strong> (value-at-risk) — порог на заданной вероятности: «не хуже этого значения» в соответствующей доле случаев.
                </li>
                <li>
                  <strong>CVaR</strong> — среднее в «хвосте» хуже VaR: насколько тяжёлые сценарии среди худших процентов.
                </li>
                <li>
                  <strong>Seed</strong> задаётся при запуске сценария Monte Carlo в конструкторе/отчёте: при тех же входах и seed последовательность случайных чисел воспроизводима; смена seed даёт другую выборку при тех же границах неопределённости.
                </li>
              </ul>
            </EngineeringCallout>
            <EngineeringCallout variant="attention" title="Инженерный вывод по риску">
              <p>
                Интерпретируйте разброс как чувствительность <em>данной</em> модели к допущениям по климату, ACH и режиму. Для проектной
                документации требуется отдельная нормативная база (СП и др.).
              </p>
            </EngineeringCallout>
          </div>
        </div>
      </div>
    </form>
  );
}

export default UncertaintyPanel;
