import { useEffect, useRef } from "react";
import { navigate } from "../../app/router";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import {
  ActionBar,
  EmptyWorkspaceState,
  FormulaCard,
  InspectorPanel,
  MetricCard,
  ResultSummaryCard,
  SectionShell,
  StatusStrip,
  WorkspacePageHeader,
  WorkspaceShell,
} from "../../shared/ui";
import { formatEnergy, formatNumber, formatPercentage } from "../../shared/utils/format";
import { useBuildStore } from "../build/build.store";
import UncertaintyPanel from "./UncertaintyPanel";

export function UncertaintyWorkspacePage() {
  const buildModel = useBuildStore((state) => state.model);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const solveCompleted = useWorkflowStore((state) => state.solveCompleted);
  const monteCarloResult = useWorkflowStore((state) => state.monteCarloResult);
  const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
  const hadMonteCarlo = useRef(Boolean(monteCarloResult));

  useEffect(() => {
    setCurrentStep("uncertainty");
  }, [setCurrentStep]);

  useEffect(() => {
    if (!hadMonteCarlo.current && monteCarloResult) {
      hadMonteCarlo.current = true;
      navigate("/results");
      return;
    }
    hadMonteCarlo.current = Boolean(monteCarloResult);
  }, [monteCarloResult]);

  const hasModel = buildModel.rooms.length > 0;
  const hasScenario = Boolean(scenarioConfig);
  const missing = [
    hasModel ? null : "нет подготовленной модели",
    hasScenario ? null : "не задан сценарий",
  ].filter((value): value is string => Boolean(value));

  return (
    <section className="w-full space-y-4 ui-page-enter">
      <WorkspacePageHeader
        kicker="Раздел неопределённостей"
        title="Monte Carlo: неопределённости эксплуатации и климата"
        description="Оценка разброса результатов и риска недогрева."
      />

      <SectionShell
        title="Вероятностный инженерный анализ"
        description="P10/P50/P90 и риски на основе вариации входных параметров."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Прогонов Monte Carlo"
            value={monteCarloResult?.runs ?? null}
            unit="шт"
            formula="N"
            precision={0}
            status={monteCarloResult ? "success" : "warning"}
            subtitle="Количество сценариев в текущем анализе"
          />
          <MetricCard
            label="P50 энергия"
            value={monteCarloResult?.totalEnergy.p50 ?? null}
            unit="кВт·ч"
            formula="P50"
            precision={1}
            status={monteCarloResult ? "info" : "warning"}
          />
          <MetricCard
            label="P50 пик"
            value={monteCarloResult?.peakLoad.p50 ?? null}
            unit="кВт"
            formula="Peak P50"
            precision={2}
            status={monteCarloResult ? "info" : "warning"}
          />
          <MetricCard
            label="Риск T < 20°C"
            value={
              monteCarloResult?.underheatingBelow20CProbability == null
                ? null
                : monteCarloResult.underheatingBelow20CProbability * 100
            }
            unit="%"
            formula="Risk"
            precision={1}
            status={
              monteCarloResult?.underheatingBelow20CProbability != null &&
              monteCarloResult.underheatingBelow20CProbability > 0.3
                ? "warning"
                : monteCarloResult
                  ? "success"
                  : "warning"
            }
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <FormulaCard
            title="Вероятностный показатель энергии"
            formula="P50 = median(Q_i)"
            description="Показывает медианное значение энергопотребления среди всех прогонов."
            parameters={["Q_i — энергия i-го сценария", "N — количество прогонов"]}
          />
          <FormulaCard
            title="Риск недогрева"
            formula="Risk = n(T_min < 20°C) / N"
            description="Доля прогонов, в которых минимальная температура опускается ниже порога комфорта."
            parameters={["T_min — минимум температуры по зонам", "N — число прогонов"]}
          />
        </div>
      </SectionShell>

      <StatusStrip
        items={[
          {
            label: "Базовый расчёт",
            value: solveCompleted ? "Есть" : "Нет",
            tone: solveCompleted ? "success" : "warning",
          },
          {
            label: "Monte Carlo",
            value: monteCarloResult ? "Есть" : "Нет",
            tone: monteCarloResult ? "info" : "warning",
          },
          {
            label: "Прогонов",
            value: monteCarloResult?.runs ?? "—",
          },
        ]}
      />

      {missing.length > 0 ? (
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          Для вероятностного анализа не хватает: {missing.join(", ")}.
        </div>
      ) : null}

      {!solveCompleted ? (
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          Для корректного сравнения рекомендуется сначала выполнить базовый расчёт.
        </div>
      ) : null}

      <WorkspaceShell className="xl:grid-cols-[minmax(0,1fr),19rem]">
        <div className="min-w-0">
          <UncertaintyPanel />
        </div>

        <InspectorPanel
          title="Превью результата"
          subtitle="Краткая проверка распределений и рисков без открытия полной страницы результатов."
        >
          {monteCarloResult ? (
            <div className="space-y-4">
              <dl className="ui-workspace-facts">
                <FactRow label="Прогонов" value={monteCarloResult.runs} />
                <FactRow
                  label="P50 энергия"
                  value={formatEnergy(monteCarloResult.totalEnergy.p50)}
                />
                <FactRow
                  label="P50 пик"
                  value={`${formatNumber(monteCarloResult.peakLoad.p50)} кВт`}
                />
                <FactRow
                  label="Риск < 20 °C"
                  value={
                    monteCarloResult.underheatingBelow20CProbability == null
                      ? "—"
                      : formatPercentage(
                          monteCarloResult.underheatingBelow20CProbability
                        )
                  }
                />
              </dl>
              <button
                type="button"
                onClick={() => navigate("/results")}
                className="ui-btn-primary w-full px-4 py-2 text-sm"
              >
                Открыть результаты вероятностного анализа
              </button>
            </div>
          ) : (
            <EmptyWorkspaceState
              title="Monte Carlo ещё не выполнялся"
              message="После запуска здесь появится краткая сводка распределений и рисков, а полный анализ откроется в разделе результатов."
            />
          )}
        </InspectorPanel>
      </WorkspaceShell>

      <ActionBar>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">
            Дальше: вероятностные результаты
          </p>
          <p className="text-sm text-[color:var(--text-muted)]">
            Полный Monte Carlo остаётся внутри существующего results-контура; страница даёт только запуск и компактное превью.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/results")}
          className="ui-btn-secondary px-4 py-2 text-sm"
        >
          Открыть результаты
        </button>
      </ActionBar>

      <ResultSummaryCard
        totalHeatLossKW={monteCarloResult?.peakLoad.p50 ?? null}
        specificHeatLoss={null}
        weakElement={
          monteCarloResult?.roomRiskSummary
            ?.slice()
            .sort((a, b) => b.underheatingRisk - a.underheatingRisk)[0]
            ?.roomId ?? null
        }
        recommendation={
          monteCarloResult
            ? "Снизьте неопределённость по ACH и уставкам — это обычно сильнее всего влияет на разброс теплопотребления."
            : null
        }
      />
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

export default UncertaintyWorkspacePage;
