import React, { useEffect, useState } from "react";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Установка неопределённостей</h3>
        <p className="text-sm text-slate-500">
          Определите количество прогонов Монте-Карло и режим расчётов, прежде чем переходить к решению.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Количество прогонов
            <input
              type="number"
              min={10}
              max={10000}
              value={runs}
              onChange={(event) => setRuns(Number(event.target.value))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-slate-900 shadow-inner focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Режим расчёта
            <select
              value={evaluationMode}
              onChange={(event) => setEvaluationMode(event.target.value as "full-physics" | "surrogate")}
              className="rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="full-physics">Full physics (точно)</option>
              <option value="surrogate">Surrogate (быстро)</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          className="mt-4 rounded-xl bg-slate-900 px-6 py-2 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          Сохранить настройки
        </button>

        {hasSaved && (
          <p className="mt-2 text-sm text-emerald-600">Конфигурация сохранена.</p>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-500">
        <p className="font-medium text-slate-600">Справка</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Full physics использует детальный решатель и занимает больше времени.</li>
          <li>Surrogate mode ожидает наличие обученной модели и работает быстрее.</li>
          <li>Вы можете изменить настройки в любое время — статус шагов обновится автоматически.</li>
        </ul>
      </div>
    </form>
  );
}

export default UncertaintyPanel;
