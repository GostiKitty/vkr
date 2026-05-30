import { useCallback, useEffect, useState } from "react";
import { THERMAL_MONTE_CARLO_MAX_RUNS } from "../../core/uncertainty/thermalMonteCarlo";
import { useBuildStore } from "../build/build.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { EngineeringCallout } from "../../shared/ui";
import { formatNumber } from "../../shared/utils/format";
import {
  DEFAULT_MONTE_CARLO_RUNS,
  clampMonteCarloRuns,
  runThermalMonteCarloAnalysis,
} from "./runThermalMonteCarloAnalysis";

const MONTE_CARLO_EVALUATION_MODE = "full-physics" as const;
const RUN_PRESETS = [50, 100, 200, 400] as const;

export function MonteCarloRunControls() {
  const config = useWorkflowStore((state) => state.uncertaintyConfig);
  const setConfig = useWorkflowStore((state) => state.setUncertaintyConfig);
  const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
  const buildModel = useBuildStore((state) => state.model);
  const [runs, setRuns] = useState(config?.runs ?? DEFAULT_MONTE_CARLO_RUNS);
  const [mcRunning, setMcRunning] = useState(false);
  const [mcError, setMcError] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setRuns(clampMonteCarloRuns(config.runs));
    }
  }, [config]);

  const persistConfig = useCallback(
    (nextRuns: number) => {
      setConfig({ runs: nextRuns, evaluationMode: MONTE_CARLO_EVALUATION_MODE });
    },
    [setConfig]
  );

  const applyRuns = useCallback((value: number) => {
    setRuns(clampMonteCarloRuns(value));
  }, []);

  const handleReset = () => {
    applyRuns(DEFAULT_MONTE_CARLO_RUNS);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextRuns = clampMonteCarloRuns(runs);
    setRuns(nextRuns);
    persistConfig(nextRuns);
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
      const nextRuns = clampMonteCarloRuns(runs);
      setRuns(nextRuns);
      persistConfig(nextRuns);
      runThermalMonteCarloAnalysis();
      setCurrentStep("results");
    } catch (error) {
      setMcError(error instanceof Error ? error.message : "Не удалось выполнить Monte Carlo.");
    } finally {
      setMcRunning(false);
    }
  }, [buildModel.rooms.length, persistConfig, runs, setCurrentStep]);

  const isDefaultRuns = runs === DEFAULT_MONTE_CARLO_RUNS;

  return (
    <section className="ui-chart-shell" data-testid="monte-carlo-run-controls">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Параметры Monte Carlo</h3>

        <div className="ui-mc-controls__field">
          <div className="ui-mc-controls__label-row">
            <label htmlFor="monte-carlo-runs" className="ui-mc-controls__label">
              Число прогонов
            </label>
            <span className="ui-mc-controls__range">
              1–{formatNumber(THERMAL_MONTE_CARLO_MAX_RUNS, { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="ui-mc-controls__input-row">
            <button
              type="button"
              className="ui-mc-controls__step"
              aria-label="Уменьшить число прогонов на 10"
              onClick={() => applyRuns(runs - 10)}
            >
              −10
            </button>
            <input
              id="monte-carlo-runs"
              type="number"
              min={1}
              max={THERMAL_MONTE_CARLO_MAX_RUNS}
              value={runs}
              onChange={(event) => applyRuns(Number(event.target.value))}
              className="ui-mc-controls__input ui-field px-3 py-2 shadow-inner"
            />
            <button
              type="button"
              className="ui-mc-controls__step"
              aria-label="Увеличить число прогонов на 10"
              onClick={() => applyRuns(runs + 10)}
            >
              +10
            </button>
          </div>

          <div className="ui-mc-controls__presets" role="group" aria-label="Быстрый выбор числа прогонов">
            {RUN_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyRuns(preset)}
                className={`ui-mc-controls__preset${runs === preset ? " ui-mc-controls__preset--active" : ""}`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="ui-mc-controls__actions">
          <div className="ui-mc-controls__actions-secondary">
            <button
              type="button"
              onClick={handleReset}
              disabled={isDefaultRuns}
              className="ui-btn-secondary px-4 py-2 text-sm disabled:opacity-45"
            >
              Сбросить
            </button>
            <button type="submit" className="ui-btn-secondary px-4 py-2 text-sm">
              Сохранить
            </button>
          </div>
          <button
            type="button"
            onClick={handleRunMonteCarlo}
            disabled={mcRunning}
            className="ui-btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {mcRunning ? "Прогон…" : "Запустить Monte Carlo"}
          </button>
        </div>

        {mcError ? (
          <EngineeringCallout variant="risk" title="Ошибка прогона">
            <p>{mcError}</p>
          </EngineeringCallout>
        ) : null}

        {hasSaved ? (
          <EngineeringCallout variant="success" title="Сохранено">
            <p>Число прогонов сохранено. Запустите Monte Carlo, чтобы обновить распределения.</p>
          </EngineeringCallout>
        ) : null}
      </form>
    </section>
  );
}

export default MonteCarloRunControls;
