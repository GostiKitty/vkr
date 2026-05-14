import { useDebugConsoleStore } from "../../entities/debug/debugConsole.store";
import { useNetworkLogStore } from "../../entities/debug/networkLog.store";
import { useProjectStore } from "../../entities/project/project.store";

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
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={close}>
      <div
        className="h-full w-full max-w-3xl bg-slate-900 text-slate-50 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Консоль отладки</h2>
            <p className="text-sm text-slate-300">Последние HTTP-запросы приложения</p>
            <p className="mt-1 text-xs text-slate-400">
              Режим: <span className="font-semibold text-slate-100">{formatProjectKind(projectKind)}</span>
              {" · "}
              Проект: <span className="font-semibold text-slate-100">{projectId ?? "—"}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clear}
              className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
            >
              Очистить
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
            >
              Закрыть
            </button>
          </div>
        </header>
        <div className="h-[calc(100%-80px)] overflow-y-auto px-6 py-4 text-sm">
          {displayedLogs.length === 0 ? (
            <p className="text-slate-400">Запросов пока нет.</p>
          ) : (
            <ul className="space-y-3">
              {displayedLogs.map((log) => (
                <li key={log.id} className="rounded-xl border border-slate-700 bg-slate-800 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>{new Date(log.startedAt).toLocaleTimeString()}</span>
                    {log.durationMs !== undefined && <span>{log.durationMs.toFixed(0)} мс</span>}
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-100">
                    <span className="mr-2 rounded-full border border-slate-600 px-2 py-0.5 text-xs uppercase tracking-wide">
                      {log.method}
                    </span>
                    <span className="break-all text-slate-50/90">{log.url}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Статус:{" "}
                    {log.status !== undefined ? (
                      <span className={log.ok ? "text-emerald-400" : "text-red-400"}>{log.status}</span>
                    ) : (
                      "—"
                    )}
                    {log.error && <span className="ml-2 text-red-300">{log.error}</span>}
                  </div>
                  {log.responseSnippet && (
                    <pre className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-slate-900/60 p-2 text-xs text-slate-200">
                      {log.responseSnippet}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
          {logs.length > displayedLogs.length && (
            <p className="mt-4 text-center text-xs uppercase tracking-wide text-slate-500">
              Показаны последние 20 запросов
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default DebugConsole;
