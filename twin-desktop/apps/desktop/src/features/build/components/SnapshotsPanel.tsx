import type { ProjectSnapshot, ViewSnapshot } from "../snapshots/types";

interface SnapshotsPanelProps {
  viewSnapshots: ViewSnapshot[];
  projectSnapshots: ProjectSnapshot[];
  onCapturePlan: () => void;
  onCapture3d: () => void;
  onCreateProjectSnapshot: () => void;
  onDeleteViewSnapshot: (id: string) => void;
  onDeleteProjectSnapshot: (id: string) => void;
  onRestoreProjectSnapshot: (id: string) => void;
}

export function SnapshotsPanel({
  viewSnapshots,
  projectSnapshots,
  onCapturePlan,
  onCapture3d,
  onCreateProjectSnapshot,
  onDeleteViewSnapshot,
  onDeleteProjectSnapshot,
  onRestoreProjectSnapshot,
}: SnapshotsPanelProps) {
  return (
    <section className="space-y-6 rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-5 shadow-sm">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Снимки</p>
        <h2 className="text-2xl font-semibold text-[color:var(--text-base)]">Снимки вида и проекта</h2>
        <p className="text-sm text-[color:var(--text-soft)]">
          Сохраняйте визуальные кадры и полные состояния проекта, чтобы возвращаться к ключевым версиям.
        </p>
      </header>

      <div className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--text-base)]">Снимки вида</h3>
            <p className="text-sm text-[color:var(--text-soft)]">PNG текущего плана или 3D-вида с активными наложениями.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCapturePlan}
              className="rounded-xl border border-[color:var(--border-base)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]"
            >
              Сохранить план
            </button>
            <button
              type="button"
              onClick={onCapture3d}
              className="rounded-xl border border-[color:var(--border-base)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]"
            >
              Сохранить 3D
            </button>
          </div>
        </div>
        {viewSnapshots.length === 0 ? (
          <p className="text-sm text-[color:var(--text-soft)]">Снимков вида пока нет. Сохраните текущий план или 3D-вид.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {viewSnapshots.map((snapshot) => (
              <article key={snapshot.id} className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-3 shadow-sm">
                <img src={snapshot.imageDataUrl} alt={snapshot.title} className="h-40 w-full rounded-xl object-cover" />
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-base)]">{snapshot.title}</p>
                  <p className="text-xs text-[color:var(--text-soft)]">{new Date(snapshot.createdAt).toLocaleString()}</p>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-[color:var(--text-muted)]">
                    <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 font-semibold uppercase tracking-wide">
                      {snapshot.kind === "plan" ? "План" : "3D"}
                    </span>
                    {snapshot.overlays.adjacency && (
                      <span className="rounded-full bg-[color:var(--warning-bg)] px-2 py-0.5 text-[color:var(--warning-fg)]">Соседства</span>
                    )}
                    {snapshot.overlays.heatmap && (
                      <span className="rounded-full bg-[color:var(--danger-bg)] px-2 py-0.5 text-[color:var(--danger-fg)]">Теплокарта</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => downloadSnapshot(snapshot)}
                    className="flex-1 rounded-lg border border-[color:var(--border-base)] px-3 py-1 font-semibold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]"
                  >
                    Скачать
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteViewSnapshot(snapshot.id)}
                    className="flex-1 rounded-lg border border-red-200 px-3 py-1 font-semibold text-red-600 hover:border-red-300"
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--text-base)]">Снимки проекта</h3>
            <p className="text-sm text-[color:var(--text-soft)]">JSON-состояние модели, сценария и результатов для последующего восстановления.</p>
          </div>
          <button
            type="button"
            onClick={onCreateProjectSnapshot}
            className="rounded-xl bg-[color:var(--accent-base)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent-contrast)] shadow hover:brightness-110"
          >
            Создать снимок проекта
          </button>
        </div>
        {projectSnapshots.length === 0 ? (
          <p className="text-sm text-[color:var(--text-soft)]">Снимков проекта пока нет. Создайте первый снимок, чтобы фиксировать версии.</p>
        ) : (
          <ul className="space-y-3">
            {projectSnapshots.map((snapshot) => (
              <li key={snapshot.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-3 shadow-sm">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-[color:var(--text-base)]">{snapshot.title}</p>
                  <p className="text-xs text-[color:var(--text-soft)]">{new Date(snapshot.createdAt).toLocaleString()}</p>
                  <p className="text-sm text-[color:var(--text-muted)]">{snapshot.comment || "Без комментария"}</p>
                </div>
                <div className="mt-3 flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onRestoreProjectSnapshot(snapshot.id)}
                    className="flex-1 rounded-lg border border-[color:var(--success-border)] px-3 py-1 font-semibold text-[color:var(--success-fg)] hover:border-[color:var(--success-border)]"
                  >
                    Восстановить
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProjectSnapshot(snapshot.id)}
                    className="flex-1 rounded-lg border border-red-200 px-3 py-1 font-semibold text-red-600 hover:border-red-300"
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function downloadSnapshot(snapshot: ViewSnapshot) {
  const link = document.createElement("a");
  link.href = snapshot.imageDataUrl;
  const safeTitle = snapshot.title.replace(/[^а-яА-Яa-zA-Z0-9-_]+/g, "_");
  link.download = `${safeTitle || "snapshot"}.png`;
  link.click();
}

export default SnapshotsPanel;
