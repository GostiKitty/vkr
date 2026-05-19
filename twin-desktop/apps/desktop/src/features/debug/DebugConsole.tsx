import { useDebugConsoleStore } from "../../entities/debug/debugConsole.store";
import { useNetworkLogStore } from "../../entities/debug/networkLog.store";
import { useProjectStore } from "../../entities/project/project.store";

import { formatProjectDisplayLabel } from "../../shared/utils/projectLabels";

const formatProjectKind = (value: "local" | "engine" | null | undefined): string => {
  if (value === "engine") {
    return "серверный";
  }
  return "локальный";
};

export function DebugConsole() {
  const isOpen = useDebugConsoleStore((state) => state.isOpen);
  const close = useDebugConsoleStore((state) => state.close);
  const logs = useNetworkLogStore((state) => state.logs);
  const clear = useNetworkLogStore((state) => state.clear);
  const projectKind = useProjectStore((state) => state.projectKind);
  const projectId = useProjectStore((state) => state.projectId);
  const displayedLogs = logs.slice(0, 20);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="ui-backdrop-fade fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-[2px]"
      onClick={close}
      role="presentation"
    >
      <div
        className="ui-drawer-panel flex h-full w-full max-w-3xl flex-col border-l border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-base)] shadow-[var(--shadow-overlay)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[color:var(--border-base)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text-base)]">Консоль отладки</h2>
            <p className="text-sm text-[color:var(--text-muted)]">Последние HTTP-запросы приложения</p>
            <p className="mt-1 text-xs text-[color:var(--text-soft)]">
              Режим: <span className="font-semibold text-[color:var(--text-base)]">{formatProjectKind(projectKind)}</span>
              {" · "}
              Проект:{" "}
              <span className="font-semibold text-[color:var(--text-base)]">
                {formatProjectDisplayLabel(projectId, { fallback: "—" })}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clear}
              className="ui-btn-secondary rounded-lg px-3 py-1.5 text-sm"
            >
              Очистить
            </button>
            <button type="button" onClick={close} className="ui-btn-secondary rounded-lg px-3 py-1.5 text-sm">
              Закрыть
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 text-sm">
          {displayedLogs.length === 0 ? (
            <p className="text-[color:var(--text-soft)]">Запросов пока нет.</p>
          ) : (
            <ul className="space-y-3">
              {displayedLogs.map((log) => (
                <li
                  key={log.id}
                  className="ui-hover-lift rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3 transition-colors hover:border-[color:var(--border-base)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--text-soft)]">
                    <span>{new Date(log.startedAt).toLocaleTimeString()}</span>
                    {log.durationMs !== undefined && <span>{log.durationMs.toFixed(0)} мс</span>}
                  </div>
                  <div className="mt-1 text-base font-semibold text-[color:var(--text-base)]">
                    <span className="mr-2 rounded-full border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] px-2 py-0.5 text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
                      {log.method}
                    </span>
                    <span className="break-all text-[color:var(--text-muted)]">{log.url}</span>
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--text-muted)]">
                    Статус:{" "}
                    {log.status !== undefined ? (
                      <span className={log.ok ? "text-[color:var(--success-fg)]" : "text-[color:var(--danger-fg)]"}>{log.status}</span>
                    ) : (
                      "—"
                    )}
                    {log.error && <span className="ml-2 text-[color:var(--danger-fg)]">{log.error}</span>}
                  </div>
                  {log.responseSnippet && (
                    <pre className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-2 font-mono text-xs text-[color:var(--text-muted)]">
                      {log.responseSnippet}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
          {logs.length > displayedLogs.length && (
            <p className="mt-4 text-center text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
              Показаны последние 20 запросов
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default DebugConsole;
