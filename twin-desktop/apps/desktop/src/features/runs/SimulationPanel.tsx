import { useMemo, useState } from "react";

import { useBuildStore } from "../build/build.store";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { runThermalSimulation, type ThermalSimulationResult } from "../../core/thermal/solver";
import { DEFAULT_THERMAL_OPTIONS } from "../build/components/ThermalSimulationPanel";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
import type { ProjectKind } from "../../entities/project/project.store";
import type { RunResult, RunResultMetric } from "../../shared/api/types";
import { runEngineSimulation } from "./runs.api";

interface SimulationPanelProps {
  projectId: string | null;
  projectKind: ProjectKind;
  onSolveComplete?: (result: ThermalSimulationResult) => void;
}

export function SimulationPanel({ projectId, projectKind, onSolveComplete }: SimulationPanelProps) {
  const buildModel = useBuildStore((state) => state.model);
  const isLocalProject = projectKind === "local";

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
      const simulation = runThermalSimulation(buildModel, DEFAULT_THERMAL_OPTIONS, adjacency);
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-slate-900">Локальный расчёт</h3>
          <p className="text-sm text-slate-500">Используются параметры текущей модели и встроенный локальный решатель.</p>
        </div>
        <button
          type="button"
          onClick={handleRunLocal}
          disabled={localDisabled}
          className={`w-full rounded-xl px-4 py-3 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-400 sm:w-auto ${
            localDisabled
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {running ? "Считаю…" : "Запустить расчёт (локально)"}
        </button>

        {!isLocalProject && (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Проект привязан к движку. При необходимости можно запустить серверный расчёт отдельной кнопкой ниже.
          </p>
        )}
        {isLocalProject && !buildModel.rooms.length && (
          <p className="mt-3 text-xs text-amber-600">
            Добавьте помещения и стены в режиме конструирования, чтобы расчёт учитывал геометрию.
          </p>
        )}

        {simError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {simError}
          </div>
        )}

        {showSuccess && !simError && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-full bg-emerald-100/80 px-4 py-2 text-sm font-medium text-emerald-700 shadow-inner transition-all duration-300">
            <span className="inline-flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-emerald-500 text-white">
              ✓
            </span>
            Расчёт завершён
          </div>
        )}
      </div>

      {projectKind === "engine" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-slate-900">Расчёт на движке</h3>
            <p className="text-sm text-slate-500">Будет отправлен запрос POST /run с текущим project_id.</p>
          </div>
          <button
            type="button"
            onClick={handleRunEngine}
            disabled={engineActionDisabled}
            className={`w-full rounded-xl px-4 py-3 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-400 sm:w-auto ${
              engineActionDisabled
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            {engineRunning ? "Отправляю запрос…" : "Запустить расчёт (движок)"}
          </button>
          {!projectId && (
            <p className="mt-3 text-xs text-amber-600">Сначала импортируйте IFC и получите project_id.</p>
          )}
          {engineError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {engineError}
            </div>
          )}
          {engineResult && (
            <div className="mt-4 space-y-1 text-sm text-slate-600">
              <p className="text-xs uppercase tracking-wide text-slate-500">Последний ответ</p>
              <p>
                ID запуска: <span className="font-semibold text-slate-900">{engineResult.id}</span>
              </p>
              <p>
                Статус: <span className="font-semibold text-slate-900">{translateStatus(engineResult.status)}</span>
              </p>
              <p>
                Время: <span className="font-semibold text-slate-900">{formatTimestamp(engineResult.started_at)}</span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Результаты</h4>
        {isBusy ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : !result && !engineResult ? (
          <p className="text-sm text-slate-500">Запустите расчёт, чтобы увидеть результаты.</p>
        ) : (
          <div className="space-y-4">
            {result && (
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard label="Потребление энергии" value={metrics.energyDemand} unit="kWh" />
                <MetricCard label="Пиковая нагрузка" value={metrics.heatingLoad} unit="kW" />
                <MetricCard label="Охлаждение" value={metrics.coolingLoad} unit="kW" />
              </div>
            )}
            {engineResult && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ответ движка</p>
                {engineMetrics.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {engineMetrics.map((metric) => (
                      <li key={metric.key} className="flex items-center justify-between gap-4">
                        <span>{metric.label ?? metric.key}</span>
                        <span className="font-semibold text-slate-900">{formatEngineValue(metric)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Метрики не переданы.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center shadow-inner">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value == null ? "—" : unit === "kWh" ? formatEnergy(value) : formatWithUnit(value, unit)}
      </p>
    </div>
  );
}

function formatWithUnit(value: number, unit: string): string {
  const formatted = formatNumber(value, { maximumFractionDigits: 1 });
  return formatted === "—" ? formatted : `${formatted} ${unit}`;
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
