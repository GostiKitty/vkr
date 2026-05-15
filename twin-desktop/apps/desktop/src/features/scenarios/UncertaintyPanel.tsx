import React, { useEffect, useState } from "react";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { EngineeringCallout, EngineeringSectionHeader } from "../../shared/ui";

export function UncertaintyPanel() {
  const config = useWorkflowStore((state) => state.uncertaintyConfig);
  const setConfig = useWorkflowStore((state) => state.setUncertaintyConfig);
  const [runs, setRuns] = useState(config?.runs ?? 200);
  const [evaluationMode, setEvaluationMode] = useState<"full-physics" | "surrogate">(
    config?.evaluationMode ?? "full-physics"
  );
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setRuns(config.runs);
      setEvaluationMode(config.evaluationMode);
    }
  }, [config]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setConfig({ runs, evaluationMode });
    setHasSaved(true);
    setTimeout(() => setHasSaved(false), 1500);
  };

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
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-[color:var(--text-muted)]">
                Число прогонов
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={runs}
                  onChange={(event) => setRuns(Number(event.target.value))}
                  className="ui-field px-3 py-2 shadow-inner"
                />
                <span className="text-xs font-normal text-[color:var(--text-soft)]">
                  Больше прогонов — глаже перцентили P5/P50/P95 и оценка VaR/CVaR (дольше по времени).
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-[color:var(--text-muted)]">
                Режим расчёта
                <select
                  value={evaluationMode}
                  onChange={(event) => setEvaluationMode(event.target.value as "full-physics" | "surrogate")}
                  className="ui-field px-3 py-2"
                >
                  <option value="full-physics">Полная физика (каждый прогон — RC-модель)</option>
                  <option value="surrogate">Суррогат (быстро, если доступна обученная замена)</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              className="ui-btn-primary px-6 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-base)]/25"
            >
              Сохранить настройки
            </button>

            {hasSaved && (
              <EngineeringCallout variant="success" title="Сохранено" className="mt-2">
                <p>Параметры учтены в статусе шага. Полные гистограммы и CDF смотрите в сценарии ВКР/отчёте после прогона.</p>
              </EngineeringCallout>
            )}
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
