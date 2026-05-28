import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import ModelPage from "../model/ModelPage";
import { QuickImportButton } from "../model/QuickImportButton";
import SimulationPanel from "../runs/SimulationPanel";
import ResultsPanel from "../reports/ResultsPanel";
import UncertaintyPanel from "../scenarios/UncertaintyPanel";
import ScenarioSetupPanel from "../scenarios/ScenarioSetupPanel";
import { EmptyState, SummaryHero, SummaryHighlightGrid, Tooltip } from "../../shared/ui";
import { formatProjectDisplayLabel } from "../../shared/utils/projectLabels";
import { isEngineProjectSource } from "../../shared/utils/projectRuntime";
import { useTwin } from "./useTwin";
import SpaceList from "./SpaceList";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useProjectStore } from "../../entities/project/project.store";
import { useBuildStore } from "../build/build.store";
import {
  useWorkflowStore,
  workflowOrder,
  type WorkflowStep,
} from "../../entities/workflow/workflow.store";
import { useWorkspaceStore } from "../../entities/workspace/workspace.store";
import { evaluateWorkflowDiagnostics } from "../../entities/workflow/workflow.diagnostics";
import { navigate } from "../../app/router";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { syncBuildSimulationToStudio } from "../../core/thermal/thermalSimulationExport";
import { buildModelFromTwin } from "../build/import/fromTwin";
import { notifyInfo } from "../../entities/notifications/notification.store";
import {
  buildPreparedDemoProject,
  DEMO_PROJECT_ID,
  DEMO_PROJECT_NAME,
  isDemoProjectModel,
} from "../build/demoProject";
import { useExpertiseInputsStore } from "../reports/exports/store/expertiseInputs.store";

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
  const workspaceCommand = useWorkspaceStore((state) => state.command);
  const workspaceCommandNonce = useWorkspaceStore((state) => state.commandNonce);
  const solveCompleted = useWorkflowStore((state) => state.solveCompleted);
  const markSolveCompleted = useWorkflowStore((state) => state.markSolveCompleted);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const uncertaintyConfig = useWorkflowStore((state) => state.uncertaintyConfig);

  useEffect(() => {
    setProjectIdInput(storedProjectId ?? "");
  }, [storedProjectId]);

  useEffect(() => {
    if (workspaceCommand !== "export-report") {
      return;
    }
    setCurrentStep("results");
  }, [setCurrentStep, workspaceCommand, workspaceCommandNonce]);

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

  const currentMissing = diagnostics[currentStep].missing;
  const currentMeta = stepMetadata[currentStep];
  const isDemoProject =
    storedProjectId === DEMO_PROJECT_ID || isDemoProjectModel(buildModel);
  const showEngineProjectForm = projectKind === "engine";
  const showDemoCta = !isDemoProject && !twin && buildModel.rooms.length === 0;
  const projectChipLabel = formatProjectDisplayLabel(storedProjectId, {
    modelName: isDemoProject ? DEMO_PROJECT_NAME : null,
  });
  const currentIndex = workflowOrder.indexOf(currentStep);
  const prevStep = workflowOrder[currentIndex - 1];
  const nextStep = workflowOrder[currentIndex + 1];
  const readyStepsCount = workflowOrder.filter((step) => diagnostics[step].status === "ready").length;

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

  const handleOpenInBuild = useCallback(() => {
    if (!twin) {
      return;
    }
    const nextProjectId = storedProjectId ?? `local:${Date.now()}`;
    const nextProjectKind = isEngineProjectSource(storedProjectId, projectKind) ? "engine" : "local";
    const editableModel = buildModelFromTwin(twin, storedProjectId ?? null);
    setProjectId(nextProjectId, nextProjectKind);
    setProjectKey(nextProjectId);
    loadModelSnapshot(editableModel);
    notifyInfo("Модель открыта в конструкторе. Можно дополнять стены, окна, двери и инженерные сети.");
    navigate("/build");
  }, [loadModelSnapshot, projectKind, setProjectId, setProjectKey, storedProjectId, twin]);

  const handleOpenDemoProject = useCallback(() => {
    const hasEditableModel =
      buildModel.rooms.length > 0 ||
      buildModel.walls.length > 0 ||
      (buildModel.roofs?.length ?? 0) > 0 ||
      (buildModel.floorSlabs?.length ?? 0) > 0;
    const alreadyDemoProject = isDemoProjectModel(buildModel) || storedProjectId === DEMO_PROJECT_ID;
    if (typeof window !== "undefined" && hasEditableModel && !alreadyDemoProject) {
      const confirmed = window.confirm(
        "Открыть подготовленный демонстрационный дом? Текущая локальная модель будет заменена демонстрационным проектом."
      );
      if (!confirmed) {
        return;
      }
    }
    const demoProject = buildPreparedDemoProject();
    setProjectId(DEMO_PROJECT_ID, "local");
    setProjectKey(DEMO_PROJECT_ID);
    useBuildStore.getState().loadModelSnapshot(demoProject.model);
    const { model: loadedDemoModel, modelRevision } = useBuildStore.getState();
    useWorkflowStore.getState().setScenarioConfig(demoProject.scenarioConfig);
    useWorkflowStore.getState().markSolveCompleted(true);
    useExpertiseInputsStore.getState().replaceInputs(DEMO_PROJECT_ID, demoProject.reportInputs);
    syncBuildSimulationToStudio(
      loadedDemoModel,
      demoProject.thermalResult,
      buildAdjacencyGraph(loadedDemoModel),
      {
        projectName: DEMO_PROJECT_NAME,
        projectKey: DEMO_PROJECT_ID,
        modelRevision,
      }
    );
    setCurrentStep("geometry");
    notifyInfo("Демонстрационный дом загружен вместе с инженерными исходными данными, расчетным сценарием и demo-результатом.");
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
                <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Импортированная геометрия</h3>
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
    <section className="mx-auto flex max-w-[min(100%,96rem)] flex-col gap-5 px-1 py-3 sm:px-2">
      <SummaryHero title={currentMeta.label} description={currentMeta.description}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="ui-soft-kicker">Шаг {currentMeta.order} из 6</p>
            {loading ? <p className="text-sm text-[color:var(--text-soft)]">Загружаю данные проекта…</p> : null}
            {error ? <p className="text-sm text-[color:var(--danger-fg)]">{error}</p> : null}
          </div>
          <span
            className="shrink-0 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[color:var(--text-base)]"
            title={projectChipLabel}
          >
            {projectChipLabel}
          </span>
        </div>
        <SummaryHighlightGrid
          className="mt-4"
          items={[
            {
              label: "Помещения",
              value: String(twin?.spaces?.length ?? buildModel.rooms.length),
              hint: "Данные из движка или локальной модели.",
            },
            {
              label: "Стены",
              value: String(buildModel.walls.length),
              hint: "Конструкции для ограждений и теплопередачи.",
            },
            {
              label: "Готовых шагов",
              value: `${readyStepsCount} / ${workflowOrder.length}`,
              hint: "Прогресс по рабочему маршруту проекта.",
            },
            {
              label: "Температурные кадры",
              value: String(simulationFrames.length),
              hint: "Появляются после расчёта и для карты результатов.",
              tone: simulationFrames.length > 0 ? "success" : "neutral",
            },
          ]}
        />
      </SummaryHero>

      {showDemoCta ? (
        <div className="ui-panel ui-demo-spotlight flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="ui-soft-kicker text-[color:var(--accent-base)]">Быстрый старт</p>
            <h3 className="mt-1 text-lg font-semibold text-[color:var(--text-base)]">{DEMO_PROJECT_NAME}</h3>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Двухэтажный дом с сетями и 3D.</p>
          </div>
          <button type="button" onClick={handleOpenDemoProject} className="ui-btn-primary shrink-0 px-4 py-2.5 text-sm">
            Открыть демонстрационный дом
          </button>
        </div>
      ) : null}

      {showEngineProjectForm ? (
        <details className="ui-panel group p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text-base)]">Подключить проект на движке</summary>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={projectIdInput}
              onChange={handleInputChange}
              placeholder="Идентификатор проекта на движке"
              className="ui-field flex-1 px-4 py-2 text-base shadow-inner"
            />
            <button type="submit" className="ui-btn-primary px-6 py-2 text-base" disabled={loading}>
              {loading ? "Загружаю…" : "Применить"}
            </button>
          </form>
        </details>
      ) : null}

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
        <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Данные из движка</h3>
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
        <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Локальная модель</h3>
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
