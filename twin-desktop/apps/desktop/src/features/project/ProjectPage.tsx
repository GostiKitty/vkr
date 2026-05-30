import { useCallback, useEffect } from "react";
import { navigate } from "../../app/router";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useWorkspaceStore } from "../../entities/workspace/workspace.store";
import {
  FlowSection,
  HeroScene,
  InputFactorGrid,
} from "../../shared/ui/landing";

export function ProjectPage() {
  const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
  const setWorkspaceMode = useWorkspaceStore((state) => state.setMode);

  useEffect(() => { setCurrentStep("geometry"); }, [setCurrentStep]);

  const openModel = useCallback(
    (mode: "plan" | "view3d") => { setWorkspaceMode(mode); navigate("/model"); },
    [setWorkspaceMode]
  );

  const stepActions = [
    () => openModel("view3d"),
    () => openModel("plan"),
    () => navigate("/scenarios"),
    () => navigate("/calculation"),
    () => navigate("/results"),
  ];

  return (
    <section className="lp3-page ui-page-enter">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="lp3-hero">
        <span className="lp3-sun" aria-hidden />
        <span className="lp3-cloud lp3-cloud--1" aria-hidden />
        <span className="lp3-cloud lp3-cloud--2" aria-hidden />
        <span className="lp3-cloud lp3-cloud--3" aria-hidden />
        <HeroScene className="lp3-scene" />

        <div className="lp3-hero__inner ui-hero-appear" style={{ animationDelay: "60ms" }}>
          <h1 className="lp3-h1">
            Тепловой анализ здания <em>от модели до отчёта</em>
          </h1>

          <div className="lp3-cta">
            <button type="button" onClick={() => openModel("view3d")} className="lp3-btn-primary">
              Открыть модель
            </button>
            <button type="button" onClick={() => navigate("/results")} className="lp3-btn-ghost">
              Запустить расчёт
            </button>
          </div>
        </div>
      </header>

      {/* ── Input factors ────────────────────────────────────── */}
      <section className="lp3-block">
        <div className="lp3-sec-head">
          <h2 className="lp3-sec-title">Что влияет на расчёт</h2>
        </div>
        <InputFactorGrid />
      </section>

      {/* ── Workflow ─────────────────────────────────────────── */}
      <section className="lp3-block">
        <div className="lp3-sec-head">
          <h2 className="lp3-sec-title">Как это работает</h2>
        </div>
        <FlowSection onStep={(i) => stepActions[i]()} />
      </section>

    </section>
  );
}

export default ProjectPage;
