import {
  workflowOrder,
  type WorkflowStep,
  type WorkflowStepStatus,
} from "../../../entities/workflow/workflow.store";
import type { WorkflowDiagnostics } from "../../../entities/workflow/workflow.diagnostics";

const STEP_LABELS: Record<WorkflowStep, string> = {
  geometry: "Модель",
  envelope: "Ограждения",
  scenario: "Сценарий",
  solve: "Расчёт",
  uncertainty: "Риски",
  results: "Результаты",
};

const STATUS_LABELS: Record<WorkflowStepStatus, string> = {
  ready: "готово",
  pending: "ожидает",
  error: "ошибка",
};

const STATUS_CLASS: Record<WorkflowStepStatus, string> = {
  ready: "bg-[color:var(--success-bg)] text-[color:var(--success-fg)]",
  pending: "bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]",
  error: "bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]",
};

export function ModelReadinessPanel({
  diagnostics,
  onSelectStep,
}: {
  diagnostics: WorkflowDiagnostics;
  onSelectStep: (step: WorkflowStep) => void;
}) {
  return (
    <section className="ui-build-sidebar-section">
      <div className="ui-build-sidebar-section__head">
        <p className="ui-build-sidebar-section__title">Готовность модели</p>
      </div>
      <div className="space-y-1.5">
        {workflowOrder.map((step) => {
          const item = diagnostics[step];
          const reason = item.missing[0] ?? "Можно продолжать работу.";
          return (
            <button
              key={step}
              type="button"
              onClick={() => onSelectStep(step)}
              title={reason}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-2.5 py-2 text-left text-xs transition hover:border-[color:var(--border-strong)]"
            >
              <span className="min-w-0 truncate font-semibold text-[color:var(--text-base)]">{STEP_LABELS[step]}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${STATUS_CLASS[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default ModelReadinessPanel;
