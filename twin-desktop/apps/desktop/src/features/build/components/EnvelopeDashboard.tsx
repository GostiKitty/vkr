import type { EnvelopeMetrics } from "../metrics/envelope";

interface EnvelopeDashboardProps {
  metrics: EnvelopeMetrics;
}

export function EnvelopeDashboard({ metrics }: EnvelopeDashboardProps) {
  const orientationLabels: Record<string, string> = {
    N: "Север",
    E: "Восток",
    S: "Юг",
    W: "Запад",
  };

  return (
    <section className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-4 shadow-sm">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">Оболочка</p>
          <h3 className="truncate text-base font-semibold text-[color:var(--text-base)]">Окна и наружные стены</h3>
          <p className="mt-1 text-xs text-[color:var(--text-soft)]">
            WWR показывает отношение площади окон к площади наружных стен.
          </p>
        </div>
        <div className="shrink-0 text-right text-sm font-semibold text-[color:var(--text-muted)]">
          WWR: {(metrics.wwr * 100).toFixed(1)}%
          <div className="text-xs font-normal text-[color:var(--text-soft)]">Остекление {metrics.totalWindowArea.toFixed(1)} м²</div>
        </div>
      </header>

      {metrics.warnings.length > 0 ? (
        <div className="mb-3 rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          <ul className="list-disc space-y-1 pl-4">
            {metrics.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[color:var(--warning-fg)]">
            Порог 10–60% используется как ориентир предварительной проверки модели, а не как прямое нормативное требование.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(metrics.orientation).map(([key, data]) => {
          const wwr = data.wallArea > 0 ? (data.windowArea / data.wallArea) * 100 : 0;
          return (
            <article
              key={key}
              className="flex min-h-[124px] flex-col justify-between rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3 text-sm"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{orientationLabels[key] ?? key}</p>
              <div>
                <p className="text-lg font-semibold text-[color:var(--text-base)]">{wwr.toFixed(1)}%</p>
                <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-[color:var(--text-soft)]">
                  Окна {data.windowArea.toFixed(1)} м² · Стены {data.wallArea.toFixed(1)} м²
                </p>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[color:var(--surface-strong)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent-base)]"
                  style={{ width: `${Math.max(12, Math.min(100, wwr))}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default EnvelopeDashboard;
