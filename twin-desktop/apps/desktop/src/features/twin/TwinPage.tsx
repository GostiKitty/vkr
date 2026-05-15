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

const stepMetadata: Record<WorkflowStep, { order: number; label: string; description: string }> = {
  geometry: {
    order: 1,
    label: "Модель",
    description: "Импорт IFC, список помещений; при необходимости — доработка в конструкторе.",
  },
  envelope: {
    order: 2,
    label: "Ограждения",
    description: "Контуры и конструкции: движок, локальная модель, готовность теплового графа.",
  },
  scenario: {
    order: 3,
    label: "Сценарий",
    description: "Климат, уставки, внутренние тепловыделения, инфильтрация (ACH) — входы для расчёта.",
  },
  solve: {
    order: 4,
    label: "Расчёт",
    description: "Зональная RC-модель: пик, энергия, баланс (не норматив СП 50 и не CFD).",
  },
  uncertainty: {
    order: 5,
    label: "Риски",
    description: "Monte Carlo по разбросу входов той же RC-модели; перцентили и показатели риска.",
  },
  results: {
    order: 6,
    label: "Результаты",
    description: "Помещения, 3D, температурная карта, граф связей, инженерный отчёт PDF.",
  },
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
    const prefix = `${currentMeta.order}. ${currentMeta.label} — ${currentMeta.description}`;
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
            <div className="ui-panel p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Импортированная геометрия</h3>
                <button
                  type="button"
                  onClick={handleOpenInBuild}
                  disabled={!twin}
                  className="ui-btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Открыть в конструкторе
                </button>
              </div>
              <p className="mb-3 text-sm text-[color:var(--text-muted)]">
                После открытия в конструкторе можно редактировать стены, проёмы и инженерные сети.
              </p>
              {twin ? (
                <SpaceList />
              ) : (
                <EmptyState
                  title="Нет геометрии"
                  message="Импортируйте IFC или экспортируйте модель из конструктора, чтобы увидеть помещения."
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
    <section className="mx-auto flex max-w-[min(100%,96rem)] flex-col gap-8 px-1 py-3 sm:px-2">
      <header className="space-y-3">
        <p className="ui-kicker">Рабочий процесс</p>
        <h2 className="ui-heading-hero">Инженерная студия</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-[color:var(--text-muted)]">{helperText}</p>
        <ol className="mt-3 flex list-none flex-wrap gap-2 text-[11px] font-medium text-[color:var(--text-soft)]">
          {workflowOrder.map((step) => {
            const meta = stepMetadata[step];
            const active = currentStep === step;
            return (
              <li
                key={step}
                className={`rounded-full border px-2.5 py-1 transition ${
                  active
                    ? "border-[color:var(--accent-base)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)]"
                    : "border-transparent bg-[color:var(--surface-muted)]"
                }`}
              >
                <span className="tabular-nums text-[color:var(--accent-base)]">{meta.order}</span> {meta.label}
              </li>
            );
          })}
        </ol>
      </header>

      <form
        onSubmit={handleSubmit}
        className="ui-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5"
      >
        <input
          type="text"
          value={projectIdInput}
          onChange={handleInputChange}
          placeholder="Идентификатор проекта на движке"
          className="ui-field flex-1 px-4 py-2 text-base shadow-inner"
        />
        <button
          type="submit"
          className="ui-btn-primary px-6 py-2 text-base"
          disabled={loading}
        >
          {loading ? "Загружаю…" : "Применить"}
        </button>
      </form>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="ui-panel ui-demo-spotlight p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-base)]">Демонстрация</p>
              <h3 className="mt-1 text-xl font-semibold text-[color:var(--text-base)]">{VIDEO_DEMO_PROJECT_NAME}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">
                Двухэтажный дом с кровлей, тепловым пунктом, отоплением, вентиляцией, датчиками и готовыми 2D/3D-сценами для показа всех возможностей.
              </p>
            </div>
            <button type="button" onClick={handleOpenVideoDemo} className="ui-btn-primary shrink-0 px-4 py-3 text-sm">
              Открыть демонстрационный дом
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Источник" value="Локальный preset" />
            <SummaryCard label="Сохранение" value="localStorage + проект" />
            <SummaryCard label="Результат" value="2 этажа · сети · 3D" />
          </div>
        </div>
        <div className="ui-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">Состояние проекта</p>
          <h3 className="mt-1 text-lg font-semibold text-[color:var(--text-base)]">
            {storedProjectId === VIDEO_DEMO_PROJECT_ID || isVideoDemoProjectModel(buildModel) ? "Демо-дом загружен" : "Обычный проект"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
            {storedProjectId === VIDEO_DEMO_PROJECT_ID || isVideoDemoProjectModel(buildModel)
              ? "Последний демо-дом хранится в отдельном локальном проекте и восстанавливается после перезагрузки страницы."
              : "Можно загрузить демо-дом без влияния на IFC-проект: он откроется как отдельный локальный пресет."}
          </p>
        </div>
      </div>

      {buildingSummary && (
        <div className="ui-panel grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <SummaryCard label="Здание" value={buildingSummary.name} />
          <SummaryCard label="Помещений" value={String(buildingSummary.spaces)} />
          <SummaryCard
            label="Суммарные параметры"
            value={`${formatVolume(buildingSummary.totalVolume)} · ${formatArea(buildingSummary.totalArea)}`}
          />
        </div>
      )}

      <div className="ui-panel-muted p-3 sm:p-4">
        <p className="mb-3 px-1 text-xs font-medium text-[color:var(--text-soft)]">
          Шаги 1–6: выберите этап или «Назад» / «Далее»
        </p>
        <div className="flex flex-wrap gap-2 sm:gap-3">
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
                className={`min-w-[140px] flex-1 rounded-2xl border px-3 py-3 text-left transition sm:min-w-[158px] sm:flex-none sm:px-4 ${
                  isActive
                    ? "border-[color:var(--accent-base)] bg-[color:var(--accent-soft)] shadow-[var(--accent-glow)] ring-1 ring-[color:var(--accent-muted)]"
                    : locked
                      ? "cursor-not-allowed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]"
                      : "border-[color:var(--border-soft)] bg-[color:var(--surface-base)] text-[color:var(--text-base)] hover:border-[color:var(--accent-base)]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-semibold ${isActive ? "text-[color:var(--accent-base)]" : ""}`}>
                    <span className="mr-1.5 tabular-nums text-xs font-bold text-[color:var(--text-soft)]">{meta.order}.</span>
                    {meta.label}
                  </p>
                  <StatusBadge status={status} />
                </div>
                <p className={`mt-1 text-xs leading-snug ${isActive ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-soft)]"}`}>
                  {meta.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ui-panel space-y-4 p-4 sm:p-6">
        {currentMissing.length > 0 && (
          <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
            <p className="font-semibold text-[color:var(--text-base)]">Чеклист для шага «{stepMetadata[currentStep].label}»</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {currentMissing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {renderStepContent()}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-soft)] pt-4">
          <button
            type="button"
            onClick={() => prevStep && setCurrentStep(prevStep)}
            disabled={!prevStep}
            className="ui-btn-secondary px-4 py-2 text-sm disabled:opacity-40"
          >
            Назад
          </button>
          {nextStep ? (
            nextDisabled ? (
              <Tooltip
                className="inline-flex"
                title="Шаг пока недоступен"
                description="Выполните пункты чеклиста выше."
                details={nextBlockingReasons}
              >
                <button
                  type="button"
                  disabled
                  className="ui-btn-secondary cursor-not-allowed px-4 py-2 text-sm opacity-45"
                >
                  Далее
                </button>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentStep(nextStep)}
                className="ui-btn-primary px-5 py-2 text-sm"
              >
                Далее
              </button>
            )
          ) : (
            <button
              type="button"
              disabled
              className="ui-btn-secondary cursor-not-allowed px-4 py-2 text-sm opacity-45"
            >
              Все шаги пройдены
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: WorkflowStepStatus }) {
  if (status === "ready") {
    return (
      <span className="rounded-full bg-[color:var(--success-bg)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--success-fg)] ring-1 ring-[color:var(--success-border)]">
        Готово
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="rounded-full bg-[color:var(--danger-bg)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--danger-fg)] ring-1 ring-[color:var(--danger-border)]">
        Ошибка
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[color:var(--surface-strong)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--text-muted)]">
      Ожидает
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">{label}</p>
      <p className="text-lg font-semibold text-[color:var(--text-base)]">{value}</p>
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
      <div className="ui-panel space-y-3 p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Данные из движка</h3>
        {twinEnvelopeCount > 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            Движок передал {twinEnvelopeCount} элементов ограждений. Их можно использовать для дальнейшего анализа
            теплопотерь и сценариев.
          </p>
        ) : (
          <EmptyState
            title="Нет ограждений"
            message="В импортированном проекте не найдено ограждающих конструкций. При необходимости добавьте их в конструкторе."
            icon="Ст"
          />
        )}
      </div>

      <div className="ui-panel space-y-3 p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Локальная модель</h3>
        {localWalls === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            Добавьте стены в конструкторе, чтобы рассчитывать ограждения, смежности и теплопередачу.
          </p>
        ) : (
          <div className="space-y-2 text-sm text-[color:var(--text-muted)]">
            <p>
              Стен с материалами:{" "}
              <span className="font-semibold text-[color:var(--text-base)]">
                {wallsWithAssemblies}/{localWalls} ({completeness}%)
              </span>
            </p>
            <p>
              Тепловой граф:{" "}
              <span className="font-semibold text-[color:var(--text-base)]">{thermalGraphReady ? "готов" : "не готов"}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TwinPage;
