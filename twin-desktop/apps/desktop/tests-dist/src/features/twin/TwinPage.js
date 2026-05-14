import React, { useCallback, useEffect, useMemo, useState } from "react";
import ModelPage from "../model/ModelPage";
import { QuickImportButton } from "../model/QuickImportButton";
import SimulationPanel from "../runs/SimulationPanel";
import ResultsPanel from "../reports/ResultsPanel";
import UncertaintyPanel from "../scenarios/UncertaintyPanel";
import { summarizeBuilding } from "../../entities/building";
import { EmptyState } from "../../shared/ui";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { useTwin } from "./useTwin";
import SpaceList from "./SpaceList";
import SpaceDetails from "./SpaceDetails";
import SpaceViewer3D from "./SpaceViewer3D";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useProjectStore } from "../../entities/project/project.store";
import { useWorkflowStore, workflowOrder, } from "../../entities/workflow/workflow.store";
const stepMetadata = {
    geometry: { label: "Геометрия", description: "Импорт и проверка исходной модели" },
    physics: { label: "Физика", description: "Настройка физических свойств" },
    uncertainty: { label: "Неопределённости", description: "Определение сценариев Монте-Карло" },
    solve: { label: "Расчёт", description: "Запуск моделирования" },
    results: { label: "Результаты", description: "Анализ тепловых данных" },
};
export function TwinPage() {
    const storedProjectId = useProjectStore((state) => state.projectId);
    const projectKind = useProjectStore((state) => state.projectKind);
    const setProjectId = useProjectStore((state) => state.setProjectId);
    const [projectIdInput, setProjectIdInput] = useState(storedProjectId ?? "");
    const { twin, loading, error } = useTwin(storedProjectId ?? null, projectKind);
    const thermalGraph = useTwinStore((state) => state.thermalGraph);
    const simulationFrames = useTwinStore((state) => state.simulationFrames);
    const currentStep = useWorkflowStore((state) => state.currentStep);
    const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
    const resetWorkflow = useWorkflowStore((state) => state.resetWorkflow);
    const solveCompleted = useWorkflowStore((state) => state.solveCompleted);
    const markSolveCompleted = useWorkflowStore((state) => state.markSolveCompleted);
    const uncertaintyConfig = useWorkflowStore((state) => state.uncertaintyConfig);
    useEffect(() => {
        setProjectIdInput(storedProjectId ?? "");
    }, [storedProjectId]);
    useEffect(() => {
        resetWorkflow();
    }, [storedProjectId, resetWorkflow]);
    const statuses = useMemo(() => {
        const geometryValid = Boolean(twin);
        const physicsValid = geometryValid && Boolean(thermalGraph);
        const uncertaintyValid = Boolean(uncertaintyConfig);
        const solveValid = solveCompleted;
        const resultsValid = solveCompleted && simulationFrames.length > 0;
        return {
            geometry: geometryValid ? "valid" : "pending",
            physics: physicsValid ? "valid" : "pending",
            uncertainty: uncertaintyValid ? "valid" : "pending",
            solve: solveValid ? "valid" : "pending",
            results: resultsValid ? "valid" : "pending",
        };
    }, [solveCompleted, thermalGraph, twin, uncertaintyConfig, simulationFrames.length]);
    useEffect(() => {
        const firstBlocked = workflowOrder.find((step) => {
            const idx = workflowOrder.indexOf(step);
            const previousOk = workflowOrder.slice(0, idx).every((prev) => statuses[prev] === "valid");
            return !previousOk;
        });
        if (firstBlocked) {
            setCurrentStep(firstBlocked);
            return;
        }
        const firstPending = workflowOrder.find((step) => statuses[step] !== "valid");
        if (firstPending) {
            const currentIndex = workflowOrder.indexOf(currentStep);
            const pendingIndex = workflowOrder.indexOf(firstPending);
            if (pendingIndex < currentIndex) {
                setCurrentStep(firstPending);
            }
        }
    }, [currentStep, setCurrentStep, statuses]);
    const canEnterStep = useCallback((step) => {
        const index = workflowOrder.indexOf(step);
        return workflowOrder.slice(0, index).every((prev) => statuses[prev] === "valid");
    }, [statuses]);
    const handleInputChange = useCallback((event) => {
        setProjectIdInput(event.target.value);
    }, []);
    const handleSubmit = useCallback((event) => {
        event.preventDefault();
        const trimmed = projectIdInput.trim();
        setProjectId(trimmed || null, trimmed ? "engine" : "local");
    }, [projectIdInput, setProjectId]);
    const helperText = useMemo(() => {
        const currentMeta = stepMetadata[currentStep];
        const prefix = `${currentMeta.label} · ${currentMeta.description}`;
        if (loading) {
            return `${prefix}. Загружаю данные…`;
        }
        if (error) {
            return `${prefix}. Ошибка: ${error}`;
        }
        return prefix;
    }, [currentStep, error, loading]);
    const buildingSummary = useMemo(() => summarizeBuilding(twin), [twin]);
    const renderStepContent = () => {
        switch (currentStep) {
            case "geometry":
                return (<div className="grid gap-4 xl:grid-cols-[1.3fr,0.7fr]">
            <div className="space-y-3">
              <QuickImportButton variant="geometry"/>
              <ModelPage />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Импортированная геометрия</h3>
              {twin ? (<SpaceList />) : (<EmptyState message="Импортируйте IFC, чтобы увидеть список помещений." title="Нет геометрии" icon="📁"/>)}
            </div>
          </div>);
            case "physics":
                return (<div className="grid gap-4 xl:grid-cols-[1.3fr,0.7fr]">
            <SpaceViewer3D caption="Просмотр физической модели" height={420}/>
            <SpaceDetails />
          </div>);
            case "uncertainty":
                return <UncertaintyPanel />;
            case "solve":
                return (<SimulationPanel projectId={storedProjectId ?? null} projectKind={projectKind} onSolveComplete={() => markSolveCompleted(true)}/>);
            case "results":
                return <ResultsPanel projectId={storedProjectId ?? null}/>;
            default:
                return null;
        }
    };
    const goToStep = (step) => {
        if (step === currentStep) {
            return;
        }
        if (step === "geometry" || canEnterStep(step)) {
            setCurrentStep(step);
        }
    };
    const currentIndex = workflowOrder.indexOf(currentStep);
    const prevStep = workflowOrder[currentIndex - 1];
    const nextStep = workflowOrder[currentIndex + 1];
    const nextDisabled = !nextStep || statuses[currentStep] !== "valid" || !canEnterStep(nextStep);
    return (<section className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Студия рабочего процесса</p>
        <h2 className="text-3xl font-semibold text-slate-900">Управление цифровым двойником</h2>
        <p className="text-sm text-slate-500">{helperText}</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <input type="text" value={projectIdInput} onChange={handleInputChange} placeholder="Введите ID проекта" className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-base text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"/>
        <button type="submit" className="rounded-xl bg-slate-900 px-6 py-2 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400" disabled={loading}>
          {loading ? "Загружаю…" : "Применить ID"}
        </button>
      </form>

      {buildingSummary && (<div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
          <SummaryCard label="Здание" value={buildingSummary.name}/>
          <SummaryCard label="Помещений" value={String(buildingSummary.spaces)}/>
          <SummaryCard label="Суммарные параметры" value={`${formatVolume(buildingSummary.totalVolume)} · ${formatArea(buildingSummary.totalArea)}`}/>
        </div>)}

      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
        <div className="flex flex-wrap gap-3">
          {workflowOrder.map((step) => {
            const locked = step !== "geometry" && !canEnterStep(step);
            const isActive = currentStep === step;
            const status = statuses[step];
            const meta = stepMetadata[step];
            return (<button key={step} type="button" onClick={() => goToStep(step)} disabled={locked} className={`flex-1 min-w-[120px] rounded-2xl border px-4 py-3 text-left transition sm:flex-none ${isActive
                    ? "border-slate-900 bg-slate-900 text-white shadow"
                    : locked
                        ? "border-slate-200 bg-white text-slate-400"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <StatusBadge status={status}/>
                </div>
                <p className={`mt-1 text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>{meta.description}</p>
              </button>);
        })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
        {renderStepContent()}

        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => prevStep && setCurrentStep(prevStep)} disabled={!prevStep} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40">
            Назад
          </button>
          <button type="button" onClick={() => nextStep && setCurrentStep(nextStep)} disabled={nextDisabled} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Далее
          </button>
        </div>
      </div>
    </section>);
}
function StatusBadge({ status }) {
    if (status === "valid") {
        return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Готово</span>;
    }
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Ожидает</span>;
}
export default TwinPage;
function SummaryCard({ label, value }) {
    return (<div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>);
}
