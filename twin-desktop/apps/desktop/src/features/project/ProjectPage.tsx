import {
  useCallback,
  useEffect,
} from "react";
import { navigate } from "../../app/router";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useWorkspaceStore } from "../../entities/workspace/workspace.store";
import {
  IconHeatLoss,
  IconModel,
  IconThermometer,
} from "../../shared/ui";
// `DocumentPreviewStack` временно скрыт из UI вместе с разделом проектной документации
// (Temporarily hidden from UI. Will be restored after project documentation export redesign).
import {
  InsightTile,
  ProductHeroMockup,
  WorkflowFeatureCard,
} from "../../shared/ui/landing";

export function ProjectPage() {
  const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
  const setWorkspaceMode = useWorkspaceStore((state) => state.setMode);

  useEffect(() => {
    setCurrentStep("geometry");
  }, [setCurrentStep]);

  const openModel = useCallback(
    (mode: "plan" | "view3d") => {
      setWorkspaceMode(mode);
      navigate("/model");
    },
    [setWorkspaceMode]
  );

  return (
    <section className="ui-landing-page ui-page-enter w-full">
      <div className="ui-landing-hero">
        <div className="ui-landing-hero__grid">
          <div className="space-y-6">
            <div className="ui-hero-appear space-y-3" style={{ animationDelay: "80ms" }}>
              <h1 className="ui-heading-hero">Тепловой анализ здания</h1>
              <p className="ui-body-lead max-w-xl">
                3D-модель, материалы, расчёт и отчёт — в одном рабочем пространстве.
              </p>
            </div>
            <div className="ui-hero-appear flex flex-wrap items-center gap-3" style={{ animationDelay: "160ms" }}>
              <button type="button" onClick={() => openModel("view3d")} className="ui-btn-primary px-5 py-3 text-sm">
                Открыть модель
              </button>
              <button type="button" onClick={() => navigate("/calculation")} className="ui-btn-secondary px-5 py-3 text-sm">
                Запустить расчёт
              </button>
            </div>
          </div>
          <ProductHeroMockup />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <QuickActionCard title="3D-модель" onClick={() => openModel("view3d")} />
        <QuickActionCard title="2D-чертёж" onClick={() => openModel("plan")} />
        <QuickActionCard title="Материалы" onClick={() => navigate("/scenarios")} />
        <QuickActionCard title="Расчёт" onClick={() => navigate("/calculation")} primary />
        <QuickActionCard title="Результаты" onClick={() => navigate("/results")} />
        <QuickActionCard title="Отчёты" onClick={() => navigate("/results")} accent />
      </section>

      <section className="ui-landing-section ui-landing-section--mint">
        <div className="mb-8 max-w-2xl space-y-2">
          <h2 className="ui-heading-section">От модели к расчёту</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <WorkflowFeatureCard
            step="1"
            title="Модель"
            description="Соберите геометрию в 2D и 3D."
            tone="blue"
            icon={<IconModel size={22} />}
          />
          <WorkflowFeatureCard
            step="2"
            title="Материалы"
            description="Назначьте слои и климатические условия."
            tone="lime"
            icon={<IconThermometer size={22} />}
          />
          <WorkflowFeatureCard
            step="3"
            title="Расчёт"
            description="Получите теплопотери и отчётные данные."
            tone="yellow"
            icon={<IconHeatLoss size={22} />}
          />
        </div>
      </section>

      <section className="ui-landing-section ui-landing-section--blue">
        <div className="mb-8 max-w-2xl space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">Возможности</p>
          <h2 className="ui-heading-section">Что показывает система</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InsightTile title="Теплопотери" description="Пиковые и удельные показатели по зданию." />
          <InsightTile title="Температура" description="Динамика помещений и риск недогрева." />
          <InsightTile title="Материалы" description="Слои ограждений и сопротивление R." />
          <InsightTile title="Отчёты" description="Расчётные отчёты и инженерные сводки." />
        </div>
      </section>

      {/* Temporarily hidden from UI. Will be restored after project documentation export redesign. */}
      {/*
      <section className="ui-landing-section ui-landing-section--lime">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl space-y-2">
            <p className="ui-kicker">Документы</p>
            <h2 className="ui-heading-section">Готовые отчёты</h2>
            <p className="ui-body-lead">Комплект для экспертизы и согласования.</p>
          </div>
          <button type="button" onClick={() => navigate("/results")} className="ui-btn-primary px-5 py-3 text-sm">
            Открыть отчёты
          </button>
        </div>
        <DocumentPreviewStack />
      </section>
      */}
    </section>
  );
}

function QuickActionCard({
  title,
  onClick,
  primary,
  accent,
}: {
  title: string;
  onClick: () => void;
  primary?: boolean;
  accent?: boolean;
}) {
  const className = accent
    ? "ui-btn-accent w-full px-4 py-3 text-sm"
    : primary
      ? "ui-btn-primary w-full px-4 py-3 text-sm"
      : "ui-btn-secondary w-full px-4 py-3 text-sm";

  return (
    <button type="button" onClick={onClick} className={`${className} ui-hover-lift text-left`}>
      {title}
    </button>
  );
}

export default ProjectPage;
