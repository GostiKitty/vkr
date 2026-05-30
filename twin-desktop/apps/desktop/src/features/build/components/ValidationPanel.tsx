import type { BuildIssue, IssueFix } from "../validation/issues";
import type { Selection } from "../build.store";

interface ValidationPanelProps {
  issues: BuildIssue[];
  onFocus: (target: Selection | undefined) => void;
  onFix: (action: IssueFix["action"]) => void;
}

const fixActions: Array<{ label: string; action: IssueFix["action"] }> = [
  { label: "Автозамыкание", action: "auto-close-room" },
  { label: "Слияние стен", action: "merge-colinear-walls" },
  { label: "Удалить мелкие сегменты", action: "remove-tiny-segments" },
];

export function ValidationPanel({ issues, onFocus, onFix }: ValidationPanelProps) {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return (
    <section className="ui-panel overflow-visible p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3 overflow-visible">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">Проверка модели</p>
          <p className="text-sm text-[color:var(--text-soft)]">
            {!issues.length
              ? "Критичных замечаний не найдено"
              : `Ошибок: ${errorCount}, предупреждений: ${warningCount}`}
          </p>
        </div>
        <details className="group relative z-50 shrink-0">
          <summary className="ui-control list-none cursor-pointer px-3 py-1.5 text-xs font-semibold">
            Автоисправления
          </summary>
          <div className="ui-overlay absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] p-2">
            <div className="space-y-1">
              {fixActions.map((fix) => (
                <button
                  key={fix.action}
                  type="button"
                  onClick={() => onFix(fix.action)}
                  className="ui-control-quiet w-full px-3 py-2 text-left text-sm font-medium whitespace-normal"
                >
                  {fix.label}
                </button>
              ))}
            </div>
          </div>
        </details>
      </header>

      {!issues.length ? (
        <div className="rounded-[16px] border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-4 py-3 text-sm text-[color:var(--success-fg)]">
          Все основные проверки пройдены.
        </div>
      ) : (
        <div className="grid gap-3">
          {issues.map((issue) => {
            const fix = issue.fix;
            return (
              <article key={issue.id} className="ui-panel-muted p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        issue.severity === "error" ? "bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]" : "bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"
                      }`}
                    >
                      {issue.severity === "error" ? "Ошибка" : "Предупреждение"}
                    </span>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{issue.message}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {fix ? (
                      <button
                        type="button"
                        onClick={() => onFix(fix.action)}
                        className="rounded-full border border-[color:var(--success-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--success-fg)] transition hover:border-[color:var(--success-border)]"
                      >
                        {fix.label}
                      </button>
                    ) : null}
                    {issue.target ? (
                      <button
                        type="button"
                        onClick={() => onFocus(issue.target)}
                        className="rounded-full border border-[color:var(--border-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-base)]"
                      >
                        Перейти
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ValidationPanel;
