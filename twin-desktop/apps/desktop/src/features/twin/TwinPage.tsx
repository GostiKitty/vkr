import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import ModelPage from "../model/ModelPage";
import { QuickImportButton } from "../model/QuickImportButton";
import SimulationPanel from "../runs/SimulationPanel";
import ResultsPanel from "../reports/ResultsPanel";
import UncertaintyPanel from "../scenarios/UncertaintyPanel";
import ScenarioSetupPanel from "../scenarios/ScenarioSetupPanel";
import { summarizeBuilding } from "../../entities/building";
import { EmptyState, Tooltip } from "../../shared/ui";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { useTwin } from "./useTwin";
import SpaceList from "./SpaceList";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useProjectStore } from "../../entities/project/project.store";
import { useBuildStore } from "../build/build.store";
import {
  useWorkflowStore,
  workflowOrder,
  type WorkflowStep,
  type WorkflowStepStatus,
} from "../../entities/workflow/workflow.store";
import { evaluateWorkflowDiagnostics } from "../../entities/workflow/workflow.diagnostics";
import { navigate } from "../../app/router";
import { buildModelFromTwin } from "../build/import/fromTwin";
import { notifyInfo } from "../../entities/notifications/notification.store";
import {
  buildVideoDemoProjectModel,
  isVideoDemoProjectModel,
  VIDEO_DEMO_PROJECT_ID,
  VIDEO_DEMO_PROJECT_NAME,
} from "../build/demoVideoProject";

const stepMetadata: Record<WorkflowStep, { label: string; description: string }> = {
  geometry: { label: "Геометрия", description: "Импорт IFC" },
  envelope: { label: "Ограждения", description: "Стены, материалы и теплотехнические свойства" },
  scenario: { label: "Сценарий", description: "Климат, уставки и режим эксплуатации" },
  solve: { label: "Расчёт", description: "Детерминированное моделирование" },
  uncertainty: { label: "Неопределённости", description: "Вероятностная оценка риска и чувствительность" },
  results: { label: "Результаты", description: "Графики, тепловая карта и отчёты" },
};

export function TwinPage() {
  const storedProjectId = useProjectStore((state) => state.projectId);
  const projectKind = useProjectStore((state) => state.projectKind);
  const setProjectId = useProjectStore((state) => state.setProjectId);
  const [projectIdInput, setProjectIdInput] = useState(storedProjectId ?? "");

  const { twin, loading, error } = useTwin(storedProjectId ?? null, projectKind);
  const thermalGraph = useTwinStore((state) => state.thermalGraph);
  const simulationFrames = useTwinStore((state) => state.simulationFrames);
  const buildModel = useBuildStore((state) => state.model);
  const loadModelSnapshot = useBuildStore((state) => state.loadModelSnapshot);
  const setProjectKey = useBuildStore((state) => state.setProjectKey);

  const currentStep = useWorkflowStore((state) => state.currentStep);
  const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
  const resetWorkflow = useWorkflowStore((state) => state.resetWorkflow);
  const solveCompleted = useWorkflowStore((state) => state.solveCompleted);
  const markSolveCompleted = useWorkflowStore((state) => state.markSolveCompleted);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const uncertaintyConfig = useWorkflowStore((state) => state.uncertaintyConfig);

  useEffect(() => {
    setProjectIdInput(storedProjectId ?? "");
  }, [storedProjectId]);

  useEffect(() => {
    const desiredKey = storedProjectId ?? "local-project";
    setProjectKey(desiredKey);
  }, [setProjectKey, storedProjectId]);

  useEffect(() => {
    resetWorkflow();
  }, [storedProjectId, resetWorkflow]);

  const wallsWithoutAssembly = useMemo(
    () => buildModel.walls.filter((wall) => !(wall.wallAssemblyId || wall.layers?.length)).length,
    [buildModel.walls]
  );

  const diagnostics = useMemo(
    () =>
      evaluateWorkflowDiagnostics({
        twinSpaces: twin?.spaces?.length ?? 0,
        twinEnvelope: Array.isArray(twin?.envelope) ? twin.envelope.length : 0,
        localRooms: buildModel.rooms.length,
        localWalls: buildModel.walls.length,
        wallsMissingAssemblies: wallsWithoutAssembly,
        scenarioConfig,
        uncertaintyConfig,
        solveCompleted,
        resultsAvailable: simulationFrames.length > 0,
      }),
    [buildModel.rooms.length, buildModel.walls.length, wallsWithoutAssembly, scenarioConfig, uncertaintyConfig, solveCompleted, simulationFrames.length, twin]
  );

  useEffect(() => {
    const firstBlockingIndex = workflowOrder.findIndex((step) => diagnostics[step].status !== "ready");
    if (firstBlockingIndex === -1) {
      return;
    }
    const currentIndex = workflowOrder.indexOf(currentStep);
    if (currentIndex > firstBlockingIndex) {
      setCurrentStep(workflowOrder[firstBlockingIndex]);
    }
  }, [currentStep, diagnostics, setCurrentStep]);

  const canEnterStep = useCallback(
    (step: WorkflowStep) => {
      const index = workflowOrder.indexOf(step);
      return workflowOrder.slice(0, index).every((prev) => diagnostics[prev].status === "ready");
    },
    [diagnostics]
  );

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setProjectIdInput(event.target.value);
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = projectIdInput.trim();
      setProjectId(trimmed || null, trimmed ? "engine" : "local");
    },
    [projectIdInput, setProjectId]
  );

  const helperText = useMemo(() => {
    const currentMeta = stepMetadata[currentStep];
    const prefix = `${currentMeta.label} · ${currentMeta.description}`;
    if (loading) {
      return `${prefix}. Загружаю данные проекта…`;
    }
    if (error) {
      return `${prefix}. Ошибка: ${error}`;
    }
    return prefix;
  }, [currentStep, error, loading]);

  const buildingSummary = useMemo(() => summarizeBuilding(twin), [twin]);
  const currentMissing = diagnostics[currentStep].missing;
  const currentIndex = workflowOrder.indexOf(currentStep);
  const prevStep = workflowOrder[currentIndex - 1];
  const nextStep = workflowOrder[currentIndex + 1];

  const nextBlockingReasons = useMemo(() => {
    if (!nextStep) {
      return [];
    }
    if (diagnostics[currentStep].status !== "ready") {
      return diagnostics[currentStep].missing;
    }
    if (!canEnterStep(nextStep)) {
      return diagnostics[nextStep].missing;
    }
    return [];
  }, [canEnterStep, currentStep, diagnostics, nextStep]);

  const nextDisabled = !nextStep || nextBlockingReasons.length > 0;

  const goToStep = (step: WorkflowStep) => {
    if (step === currentStep) {
      return;
    }
    if (step === "geometry" || canEnterStep(step)) {
      setCurrentStep(step);
    }
  };

  const handleOpenInBuild = useCallback(() => {
    if (!twin) {
      return;
    }
    const editableModel = buildModelFromTwin(twin, storedProjectId ?? null);
    loadModelSnapshot(editableModel);
    setProjectId(storedProjectId ?? `local:${Date.now()}`, storedProjectId ? "engine" : "local");
    notifyInfo("Модель открыта в конструкторе. Можно дополнять стены, окна, двери и инженерные сети.");
    navigate("/build");
  }, [loadModelSnapshot, setProjectId, storedProjectId, twin]);

  const handleOpenVideoDemo = useCallback(() => {
    const hasEditableModel =
      buildModel.rooms.length > 0 ||
      buildModel.walls.length > 0 ||
      (buildModel.roofs?.length ?? 0) > 0 ||
      (buildModel.floorSlabs?.length ?? 0) > 0;
    const alreadyDemoVideo = isVideoDemoProjectModel(buildModel) || storedProjectId === VIDEO_DEMO_PROJECT_ID;
    if (typeof window !== "undefined" && hasEditableModel && !alreadyDemoVideo) {
      const confirmed = window.confirm(
        "Открыть подготовленный демонстрационный дом? Текущая локальная модель будет заменена демонстрационным проектом."
      );
      if (!confirmed) {
        return;
      }
    }
    const demoModel = buildVideoDemoProjectModel();
    setProjectId(VIDEO_DEMO_PROJECT_ID, "local");
    setProjectKey(VIDEO_DEMO_PROJECT_ID);
    useBuildStore.getState().loadModelSnapshot(demoModel);
    setCurrentStep("geometry");
    notifyInfo("Демонстрационный дом загружен. Открываю модель в конструкторе с сохранением в локальном проекте.");
    navigate("/build");
  }, [buildModel, setCurrentStep, setProjectId, setProjectKey, storedProjectId]);

  const renderStepContent = () => {
    switch (currentStep) {
      case "geometry":
        return (
          <div className="grid gap-4 xl:grid-cols-[1.3fr,0.7fr]">
            <div className="space-y-3">
              <QuickImportButton variant="geometry" />
              <ModelPage />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Импортированная геометрия</h3>
                <button
                  type="button"
                  onClick={handleOpenInBuild}
                  disabled={!twin}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Открыть в конструкторе
                </button>
              </div>
              <p className="mb-3 text-sm text-slate-500">
                После открытия в конструкторе модель можно редактировать, дополнять сетями и дорабатывать вручную.
              </p>
              {twin ? (
                <SpaceList />
              ) : (
                <EmptyState
                  title="Нет геометрии"
                  message="Импортируйте IFC или экспортируйте модель из Build Mode, чтобы увидеть помещения."
                  icon="П"
                />
              )}
            </div>
          </div>
        );
      case "envelope":
        return (
          <EnvelopeStatusPanel
            twinEnvelopeCount={Array.isArray(twin?.envelope) ? twin.envelope.length : 0}
            localWalls={buildModel.walls.length}
            wallsWithAssemblies={buildModel.walls.length - wallsWithoutAssembly}
            thermalGraphReady={Boolean(thermalGraph)}
          />
        );
      case "scenario":
        return <ScenarioSetupPanel />;
      case "solve":
        return (
          <SimulationPanel
            projectId={storedProjectId ?? null}
            projectKind={projectKind}
            onSolveComplete={() => markSolveCompleted(true)}
          />
        );
      case "uncertainty":
        return <UncertaintyPanel />;
      case "results":
        return <ResultsPanel projectId={storedProjectId ?? null} />;
      default:
        return null;
    }
  };

  return (
    <section className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">

        <h2 className="text-3xl font-semibold text-slate-900">Управление проектом </h2>
        <p className="text-sm text-slate-500">{helperText}</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"
      >
        <input
          type="text"
          value={projectIdInput}
          onChange={handleInputChange}
          placeholder="Введите ID проекта"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-base text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-6 py-2 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
          disabled={loading}
        >
          {loading ? "Загружаю…" : "Применить ID"}
        </button>
      </form>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="rounded-3xl border border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#e0f2fe_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Демо-режим</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">{VIDEO_DEMO_PROJECT_NAME}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Быстрый демонстрационный запуск: готовая геометрия, отопление, стабильная 2D/3D-модель и температурная
                визуализация без ручной подготовки сцены.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenVideoDemo}
              className="rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
            >
              Открыть демонстрационный дом
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Источник" value="Локальный preset" />
            <SummaryCard label="Сохранение" value="localStorage + проект" />
            <SummaryCard label="Результат" value="2D, 3D и температура готовы" />
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Состояние проекта</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {storedProjectId === VIDEO_DEMO_PROJECT_ID || isVideoDemoProjectModel(buildModel) ? "Демо-дом загружен" : "Обычный проект"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {storedProjectId === VIDEO_DEMO_PROJECT_ID || isVideoDemoProjectModel(buildModel)
              ? "Последний демо-дом хранится в отдельном локальном проекте и восстанавливается после перезагрузки страницы."
              : "Можно загрузить демо-дом без влияния на IFC-проект: он откроется как отдельный локальный пресет."}
          </p>
        </div>
      </div>

      {buildingSummary && (
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
          <SummaryCard label="Здание" value={buildingSummary.name} />
          <SummaryCard label="Помещений" value={String(buildingSummary.spaces)} />
          <SummaryCard
            label="Суммарные параметры"
            value={`${formatVolume(buildingSummary.totalVolume)} · ${formatArea(buildingSummary.totalArea)}`}
          />
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
        <div className="flex flex-wrap gap-3">
          {workflowOrder.map((step) => {
            const locked = step !== "geometry" && !canEnterStep(step);
            const isActive = currentStep === step;
            const status = diagnostics[step].status;
            const meta = stepMetadata[step];
            return (
              <button
                key={step}
                type="button"
                onClick={() => goToStep(step)}
                disabled={locked}
                className={`min-w-[120px] flex-1 rounded-2xl border px-4 py-3 text-left transition sm:flex-none ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white shadow"
                    : locked
                    ? "border-slate-200 bg-white text-slate-400"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <StatusBadge status={status} />
                </div>
                <p className={`mt-1 text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>{meta.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
        {currentMissing.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Для шага «{stepMetadata[currentStep].label}» нужно:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {currentMissing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {renderStepContent()}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => prevStep && setCurrentStep(prevStep)}
            disabled={!prevStep}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"
          >
            Назад
          </button>
          {nextStep ? (
            nextDisabled ? (
              <Tooltip
                className="inline-flex"
                title="Шаг пока недоступен"
                description="Завершите обязательные требования текущего шага."
                details={nextBlockingReasons}
              >
                <button
                  type="button"
                  disabled
                  className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-white opacity-60"
                >
                  Далее
                </button>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentStep(nextStep)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Далее
              </button>
            )
          ) : (
            <button
              type="button"
              disabled
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white opacity-50"
            >
              Готово
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: WorkflowStepStatus }) {
  if (status === "ready") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Готово</span>;
  }
  if (status === "error") {
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Ошибка</span>;
  }
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Ожидает</span>;
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EnvelopeStatusPanel({
  twinEnvelopeCount,
  localWalls,
  wallsWithAssemblies,
  thermalGraphReady,
}: {
  twinEnvelopeCount: number;
  localWalls: number;
  wallsWithAssemblies: number;
  thermalGraphReady: boolean;
}) {
  const completeness = localWalls === 0 ? 0 : Math.round((wallsWithAssemblies / Math.max(localWalls, 1)) * 100);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Данные из движка</h3>
        {twinEnvelopeCount > 0 ? (
          <p className="text-sm text-slate-600">
            Движок передал {twinEnvelopeCount} элементов ограждений. Их можно использовать для дальнейшего анализа
            теплопотерь и сценариев.
          </p>
        ) : (
          <EmptyState
            title="Нет ограждений"
            message="В импортированном проекте не найдено ограждающих конструкций. При необходимости добавьте их в Build Mode."
            icon="Ст"
          />
        )}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Локальная модель</h3>
        {localWalls === 0 ? (
          <p className="text-sm text-slate-600">
            Добавьте стены в Build Mode, чтобы рассчитывать ограждения, смежности и теплопередачу.
          </p>
        ) : (
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Стен с материалами:{" "}
              <span className="font-semibold text-slate-900">
                {wallsWithAssemblies}/{localWalls} ({completeness}%)
              </span>
            </p>
            <p>
              Тепловой граф:{" "}
              <span className="font-semibold text-slate-900">{thermalGraphReady ? "готов" : "не готов"}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TwinPage;
