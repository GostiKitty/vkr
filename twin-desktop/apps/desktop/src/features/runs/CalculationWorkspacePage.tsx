import { useEffect, useMemo, useState } from "react";
import { navigate } from "../../app/router";
import { useProjectStore } from "../../entities/project/project.store";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import {
  ActionBar,
  CalculationProgress,
  CollapsibleSection,
  EmptyWorkspaceState,
  FormulaCard,
  InspectorPanel,
  ReportPreviewCard,
  ResultSummaryCard,
  StatusStrip,
  WorkspacePageHeader,
  WorkspaceShell,
} from "../../shared/ui";
import { formatEnergy, formatNumber } from "../../shared/utils/format";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { buildAdjacencyGraph } from "../../core/graph/adjacency";
import { syncBuildSimulationToStudio } from "../../core/thermal/thermalSimulationExport";
import { useBuildStore } from "../build/build.store";
import {
  buildPreparedDemoProject,
  DEMO_PROJECT_ID,
  DEMO_PROJECT_NAME,
} from "../build/demoProject";
import { useExpertiseInputsStore } from "../reports/exports/store/expertiseInputs.store";
import SimulationPanel from "./SimulationPanel";

export function CalculationWorkspacePage() {
  const buildModel = useBuildStore((state) => state.model);
  const projectKey = useBuildStore((state) => state.projectKey);
  const modelRevision = useBuildStore((state) => state.modelRevision);
  const loadModelSnapshot = useBuildStore((state) => state.loadModelSnapshot);
  const setProjectKey = useBuildStore((state) => state.setProjectKey);
  const projectId = useProjectStore((state) => state.projectId);
  const projectKind = useProjectStore((state) => state.projectKind);
  const setProjectId = useProjectStore((state) => state.setProjectId);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const solveCompleted = useWorkflowStore((state) => state.solveCompleted);
  const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
  const markSolveCompleted = useWorkflowStore((state) => state.markSolveCompleted);
  const scenarioRunHistory = useWorkflowStore((state) => state.scenarioRunHistory);
  const lastThermalResult = useTwinStore((state) => state.lastThermalResult);
  const lastThermalResultBinding = useTwinStore((state) => state.lastThermalResultBinding);
  const [runningLocal, setRunningLocal] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentStep("solve");
  }, [setCurrentStep]);

  const thermalResultState = getResultSyncState(
    Boolean(lastThermalResult),
    lastThermalResultBinding,
    projectKey,
    modelRevision
  );
  const hasCurrentThermalResult = thermalResultState === "current";
  const hasStaleThermalResult = thermalResultState === "stale";
  const visibleThermalResult = hasCurrentThermalResult ? lastThermalResult : null;

  const readiness = useMemo(
    () => ({
      hasModel: buildModel.rooms.length > 0,
      hasScenario: Boolean(scenarioConfig),
      hasSolve: hasCurrentThermalResult && solveCompleted,
    }),
    [buildModel.rooms.length, hasCurrentThermalResult, scenarioConfig, solveCompleted]
  );

  const missing = [
    readiness.hasModel ? null : "нет подготовленной модели",
    readiness.hasScenario ? null : "не задан сценарий",
  ].filter((value): value is string => Boolean(value));

  const lastSnapshot =
    scenarioRunHistory.length > 0
      ? scenarioRunHistory[scenarioRunHistory.length - 1]
      : null;

  const logItems = [
    {
      title: "Модель",
      body: readiness.hasModel
        ? "Геометрия и помещения готовы к прогону."
        : "Для запуска расчёта нужна локальная модель с помещениями.",
      tone: readiness.hasModel ? "success" : "warning",
    },
    {
      title: "Сценарий",
      body: readiness.hasScenario
        ? "Климат и эксплуатационные параметры сохранены."
        : "Сценарий ещё не задан.",
      tone: readiness.hasScenario ? "success" : "warning",
    },
    {
      title: "Расчёт",
      body: readiness.hasSolve
        ? `Последний прогон сохранён${lastSnapshot ? `: ${lastSnapshot.label}` : ""}.`
        : hasStaleThermalResult
          ? "Модель изменилась после последнего расчёта. Требуется пересчёт."
        : "Базовый расчёт ещё не выполнялся.",
      tone: readiness.hasSolve ? "info" : "warning",
    },
  ] as const;

  useEffect(() => {
    if (!runningLocal) {
      return;
    }
    const interval = window.setInterval(() => {
      setActiveStep((prev) => (prev >= 4 ? prev : prev + 1));
    }, 650);
    return () => window.clearInterval(interval);
  }, [runningLocal]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    console.debug("[analysis-sync] calculation-page", {
      route: "/calculation",
      projectKey,
      modelRevision,
      rooms: buildModel.rooms.length,
      walls: buildModel.walls.length,
      thermalResultState,
      lastCalculatedModelRevision: lastThermalResultBinding?.modelRevision ?? null,
    });
  }, [
    buildModel.rooms.length,
    buildModel.walls.length,
    lastThermalResultBinding?.modelRevision,
    modelRevision,
    projectKey,
    thermalResultState,
  ]);

  return (
    <section className="w-full space-y-4 ui-page-enter">
      <WorkspacePageHeader
        kicker="Расчёт"
        title="Теплотехнический расчёт"
        description="Запуск, этапы и переход к результатам."
      />

      <CalculationProgress
        running={runningLocal}
        completed={!runningLocal && hasCurrentThermalResult}
        activeStep={activeStep}
        error={runError}
        steps={[
          "Проверка геометрии",
          "Расчёт сопротивления теплопередаче",
          "Учёт климатических условий",
          "Расчёт теплопотерь",
          "Формирование отчётных данных",
        ]}
      />

      <StatusStrip
        items={[
          {
            label: "Модель",
            value: readiness.hasModel ? "Готова" : "Нет",
            tone: readiness.hasModel ? "success" : "warning",
          },
          {
            label: "Сценарий",
            value: readiness.hasScenario ? "Задан" : "Нет",
            tone: readiness.hasScenario ? "success" : "warning",
          },
          {
            label: "Расчёт",
            value: readiness.hasSolve ? "Выполнен" : hasStaleThermalResult ? "Устарел" : "Не выполнен",
            tone: readiness.hasSolve ? "info" : "warning",
          },
        ]}
      />

      {missing.length > 0 ? (
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          <p>Для запуска расчёта не хватает: {missing.join(", ")}.</p>
          {!readiness.hasModel ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const demoProject = buildPreparedDemoProject();
                  setProjectId(DEMO_PROJECT_ID, "local");
                  setProjectKey(DEMO_PROJECT_ID);
                  loadModelSnapshot(demoProject.model);
                  const { model: loadedDemoModel, modelRevision: nextModelRevision } = useBuildStore.getState();
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
                      modelRevision: nextModelRevision,
                    }
                  );
                  navigate("/model");
                }}
                className="ui-btn-secondary px-4 py-2 text-sm"
              >
                Открыть демо-дом
              </button>
              <button
                type="button"
                onClick={() => navigate("/model")}
                className="ui-btn-secondary px-4 py-2 text-sm"
              >
                Перейти в конструктор
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasStaleThermalResult ? (
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          Модель изменилась после последнего расчёта. Запустите расчёт заново, чтобы результаты и отчёты соответствовали текущей геометрии.
        </div>
      ) : null}

      <WorkspaceShell className="xl:grid-cols-[minmax(0,1fr),19rem]">
        <div className="min-w-0">
          <SimulationPanel
            projectId={projectId ?? null}
            projectKind={projectKind}
            onLocalRunStart={() => {
              setRunError(null);
              setActiveStep(0);
              setRunningLocal(true);
            }}
            onLocalRunError={(message) => {
              setRunError(message);
            }}
            onLocalRunFinish={() => {
              setRunningLocal(false);
              setActiveStep(5);
            }}
            onSolveComplete={(result) => {
              void result;
              markSolveCompleted(true);
            }}
          />
          <CollapsibleSection
            title="Справочные формулы"
            description="Краткая методическая подсказка — не обязательна для запуска расчёта."
            className="mt-4"
          >
            <div className="grid gap-3 pt-3 lg:grid-cols-2">
              <FormulaCard
                title="Теплопередача ограждения"
                formula="Q = U · A · ΔT"
                description="Основная зависимость для расчёта потерь через конструкцию."
                parameters={["U — коэффициент теплопередачи", "A — площадь", "ΔT — перепад температур"]}
              />
              <FormulaCard
                title="Сопротивление конструкции"
                formula="R_total = R_si + Σ(d_i / λ_i) + R_se"
                description="Используется для вычисления коэффициента U и оценки соответствия нормам."
                parameters={["d_i — толщина слоя", "λ_i — теплопроводность", "R_si/R_se — плёночные сопротивления"]}
              />
            </div>
          </CollapsibleSection>
        </div>

        <InspectorPanel
          title="Готовность расчёта"
          subtitle="Проверка входных условий и последний сохранённый результат."
        >
          <div className="space-y-4">
            <dl className="ui-workspace-facts">
              <FactRow
                label="Модель"
                value={readiness.hasModel ? "Подготовлена" : "Нет"}
              />
              <FactRow
                label="Сценарий"
                value={readiness.hasScenario ? "Задан" : "Нет"}
              />
              <FactRow
                label="История прогонов"
                value={scenarioRunHistory.length}
              />
            </dl>

            {visibleThermalResult ? (
              <dl className="ui-workspace-facts">
                <FactRow
                  label="Энергия"
                  value={formatEnergy(visibleThermalResult.summary.totalEnergyKWh)}
                />
                <FactRow
                  label="Пик"
                  value={`${formatNumber(visibleThermalResult.summary.peakLoadKW)} кВт`}
                />
                <FactRow
                  label="Дискомфорт"
                  value={`${formatNumber(visibleThermalResult.summary.discomfortHours)} ч`}
                />
              </dl>
            ) : (
              <EmptyWorkspaceState
                title={hasStaleThermalResult ? "Последний результат устарел" : "Последнего результата нет"}
                message={
                  hasStaleThermalResult
                    ? "После изменения модели сохранённый расчёт больше не соответствует текущей геометрии."
                    : "После успешного прогона здесь появится краткая сводка для перехода в результаты."
                }
              />
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[color:var(--text-base)]">Ход подготовки</p>
              <div className="ui-workspace-log">
                {logItems.map((item) => (
                  <div key={item.title} className="ui-workspace-log__item">
                    <span
                      className={`ui-workspace-log__marker ${
                        item.tone === "success"
                          ? "ui-workspace-log__marker--success"
                          : item.tone === "info"
                            ? "ui-workspace-log__marker--info"
                            : "ui-workspace-log__marker--warning"
                      }`}
                    />
                    <div>
                      <p className="ui-workspace-log__title">{item.title}</p>
                      <p className="ui-workspace-log__body">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </InspectorPanel>
      </WorkspaceShell>

      <ResultSummaryCard
        totalHeatLossKW={visibleThermalResult?.summary.peakLoadKW ?? null}
        specificHeatLoss={
          visibleThermalResult && buildModel.rooms.length > 0
            ? (visibleThermalResult.summary.peakLoadKW * 1000) / Math.max(buildModel.rooms.length * 25, 1)
            : null
        }
        weakElement={lastSnapshot?.label ?? "Ограждающие конструкции без слоя утепления"}
        recommendation={
          visibleThermalResult
            ? "Проверьте конструкции с максимальным U и уточните инфильтрацию ACH перед экспортом отчёта."
            : null
        }
      />

      <ReportPreviewCard
        status={
          hasCurrentThermalResult
            ? "Документ сформирован"
            : hasStaleThermalResult
              ? "Результаты устарели"
              : "Отчёт ещё не сформирован"
        }
        loading={runningLocal}
        onExport={lastThermalResult ? () => navigate("/results") : undefined}
        exportLabel="Открыть отчётный раздел"
      />

      <ActionBar>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">
            Дальше: результаты или Monte Carlo
          </p>
          <p className="text-sm text-[color:var(--text-muted)]">
            Сначала базовый расчёт, затем вероятностный анализ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/results")}
            className="ui-btn-secondary px-4 py-2 text-sm"
          >
            Открыть результаты
          </button>
          <button
            type="button"
            onClick={() => navigate("/uncertainty")}
            className="ui-btn-primary px-4 py-2 text-sm"
          >
            Перейти к Monte Carlo
          </button>
        </div>
      </ActionBar>
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ui-workspace-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default CalculationWorkspacePage;
