import type { BuildingEvent } from "../../../entities/networks/types";

interface EventJournalPanelProps {
  events: BuildingEvent[];
  onAcknowledge: (eventId: string) => void;
}

export function EventJournalPanel({ events, onAcknowledge }: EventJournalPanelProps) {
  const ordered = [...events].sort((left, right) => right.timestamp - left.timestamp);

  return (
    <section className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">События</p>
          <h3 className="truncate text-base font-semibold text-[color:var(--text-base)]">Журнал инженерных событий</h3>
        </div>
        <span className="shrink-0 rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
          {ordered.length} записей
        </span>
      </div>

      {ordered.length ? (
        <div className="mt-4 grid gap-3">
          {ordered.map((event) => (
            <article key={event.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={badgeClass(event)}>
                      {event.acknowledged ? "подтверждено" : severityLabel(event.severity)}
                    </span>
                    <span className="text-xs font-medium text-[color:var(--text-soft)]">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-base font-semibold text-[color:var(--text-base)]">{event.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{event.message}</p>
                  <p className="mt-2 text-xs text-[color:var(--text-soft)]">Объект: {event.relatedId ?? "—"}</p>
                </div>
                {!event.acknowledged ? (
                  <button
                    type="button"
                    onClick={() => onAcknowledge(event.id)}
                    className="shrink-0 rounded-xl border border-[color:var(--border-base)] px-3 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)]"
                  >
                    Подтвердить
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-soft)]">
          Активные события появятся здесь автоматически, когда модель начнет генерировать предупреждения и аварии.
        </p>
      )}
    </section>
  );
}

function severityLabel(severity: BuildingEvent["severity"]): string {
  switch (severity) {
    case "critical":
      return "критично";
    case "warning":
      return "внимание";
    default:
      return "норма";
  }
}

function badgeClass(event: BuildingEvent): string {
  if (event.acknowledged) {
    return "rounded-full bg-[color:var(--surface-muted)] px-2 py-1 text-xs font-semibold text-[color:var(--text-muted)]";
  }
  if (event.severity === "critical") {
    return "rounded-full bg-[color:var(--danger-bg)] px-2 py-1 text-xs font-semibold text-[color:var(--danger-fg)]";
  }
  if (event.severity === "warning") {
    return "rounded-full bg-[color:var(--warning-bg)] px-2 py-1 text-xs font-semibold text-[color:var(--warning-fg)]";
  }
  return "rounded-full bg-[color:var(--success-bg)] px-2 py-1 text-xs font-semibold text-[color:var(--success-fg)]";
}

export default EventJournalPanel;
