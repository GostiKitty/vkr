import React, { useMemo, useState } from "react";
import { useBuildStore } from "../build/build.store";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { runThermalSimulation, } from "../../core/thermal/solver";
import { DEFAULT_THERMAL_OPTIONS } from "../build/components/ThermalSimulationPanel";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
export function SimulationPanel({ projectId, projectKind, onSolveComplete }) {
    const buildModel = useBuildStore((state) => state.model);
    const isLocalProject = projectKind === "local";
    const [result, setResult] = useState(null);
    const [running, setRunning] = useState(false);
    const [simError, setSimError] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
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
    const handleRunLocal = () => {
        if (!isLocalProject || running) {
            return;
        }
        if (!buildModel.rooms.length) {
            setSimError("Добавьте помещения и стены в Build Mode, чтобы запустить расчёт.");
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось выполнить расчёт.";
            setSimError(message);
        }
        finally {
            setRunning(false);
        }
    };
    const localDisabled = !isLocalProject || !buildModel.rooms.length || running;
    return (<div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-slate-900">Запуск симуляции</h3>
          <p className="text-sm text-slate-500">Запустите расчёт для выбранного помещения, чтобы получить нагрузки.</p>
        </div>
        <button type="button" onClick={handleRunLocal} disabled={localDisabled} className={`w-full rounded-xl px-4 py-3 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-400 sm:w-auto ${localDisabled
            ? "cursor-not-allowed bg-slate-200 text-slate-500"
            : "bg-slate-900 text-white hover:bg-slate-800"}`}>
          {running ? "Считаю…" : "Запустить расчёт (локально)"}
        </button>

        {!isLocalProject && (<p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Удалённый расчёт через движок пока не поддерживается. Используйте Build Mode и сохраните проект как
            <code className="mx-1 rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white">local:…</code>, чтобы запустить локальный решатель.
          </p>)}
        {isLocalProject && !buildModel.rooms.length && (<p className="mt-3 text-xs text-amber-600">Добавьте помещения и стены в Build Mode, чтобы расчёт учитывал геометрию.</p>)}

        {simError && (<div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {simError}
          </div>)}

        {showSuccess && !simError && (<div className="mt-3 inline-flex items-center gap-3 rounded-full bg-emerald-100/80 px-4 py-2 text-sm font-medium text-emerald-700 shadow-inner transition-all duration-300">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white animate-pulse">
              ✓
            </span>
            Симуляция завершена
          </div>)}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Результаты</h4>
        {running ? (<div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (<div key={idx} className="h-12 rounded-xl bg-slate-100 animate-pulse"/>))}
          </div>) : !result ? (<p className="text-sm text-slate-500">Запустите симуляцию, чтобы увидеть результаты.</p>) : (<div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Потребление энергии" value={metrics.energyDemand} unit="kWh"/>
            <MetricCard label="Отопительная нагрузка" value={metrics.heatingLoad} unit="kW"/>
            <MetricCard label="Охладительная нагрузка" value={metrics.coolingLoad} unit="kW"/>
          </div>)}
      </div>

    </div>);
}
function MetricCard({ label, value, unit }) {
    return (<div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center shadow-inner">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value == null ? "—" : unit === "kWh" ? formatEnergy(value) : formatWithUnit(value, unit)}
      </p>
    </div>);
}
function formatWithUnit(value, unit) {
    const formatted = formatNumber(value, { maximumFractionDigits: 1 });
    return formatted === "—" ? formatted : `${formatted} ${unit}`;
}
export default SimulationPanel;
