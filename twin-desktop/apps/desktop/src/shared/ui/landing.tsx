import type { ReactNode } from "react";
import { IconModel, IconStatusOk, IconThermometer, IconWind } from "./icons";

export function ProductHeroMockup() {
  return (
    <div className="ui-product-mockup ui-hero-appear--scale" style={{ ["--hero-delay" as string]: "180ms" }}>
      <div className="relative z-[1] grid h-full min-h-[20rem] gap-3 sm:grid-cols-2">
        <div className="ui-mockup-float flex flex-col justify-between">
          <p className="text-sm font-semibold text-[color:var(--text-muted)]">2D-план</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((cell) => (
              <span
                key={cell}
                className="aspect-square rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--workspace-canvas-bg)]"
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-[color:var(--text-muted)]">Схема помещений</p>
        </div>

        <div className="ui-mockup-float ui-mockup-float--delay flex flex-col justify-between">
          <p className="text-sm font-semibold text-[color:var(--text-muted)]">3D-модель</p>
          <div className="mt-3 flex h-28 items-end justify-center gap-2">
            <span className="h-16 w-10 rounded-t-2xl bg-[color:var(--blue-bright)]/80" />
            <span className="h-24 w-14 rounded-t-2xl bg-[color:var(--blue-bright)]" />
            <span className="h-20 w-11 rounded-t-2xl bg-[color:var(--blue-bright)]/70" />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-base)]">
            <IconModel size={18} className="text-[color:var(--blue-bright)]" />
            Цифровой контур здания
          </div>
        </div>

        <div className="ui-mockup-float sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IconStatusOk size={18} className="text-[color:var(--success-fg)]" />
              <p className="text-sm font-bold text-[color:var(--text-base)]">Расчёт выполнен</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MetricChip label="Q" value="8,6 кВт" />
            <MetricChip label="R" value="3,24" />
            <MetricChip label="U" value="0,31" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
      <p className="text-sm font-semibold text-[color:var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-base font-bold text-[color:var(--text-base)]">{value}</p>
    </div>
  );
}

export function WorkflowFeatureCard({
  step,
  title,
  description,
  tone,
  icon,
}: {
  step: string;
  title: string;
  description: string;
  tone: "blue" | "lime" | "yellow";
  icon: ReactNode;
}) {
  const ribbonClass =
    tone === "lime"
      ? "ui-feature-card__ribbon--lime"
      : tone === "yellow"
        ? "ui-feature-card__ribbon--yellow"
        : "ui-feature-card__ribbon--blue";

  return (
    <article className="ui-feature-card ui-hover-lift">
      <div className={`ui-feature-card__ribbon ${ribbonClass}`}>{step}</div>
      <div className="mb-3 text-[color:var(--blue-bright)]">{icon}</div>
      <h3 className="ui-heading-card">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">{description}</p>
    </article>
  );
}

export function InsightTile({ title, description }: { title: string; description: string }) {
  return (
    <div className="ui-insight-card">
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{description}</p>
    </div>
  );
}

export function WorkspaceDarkPreview() {
  return (
    <div className="ui-workspace-preview">
      <div className="ui-workspace-preview__chrome">
        <span className="ui-workspace-preview__dot" />
        <span className="ui-workspace-preview__dot" />
        <span className="ui-workspace-preview__dot" />
        <span className="ml-2 text-xs font-semibold text-white/70">TherNest · рабочее пространство</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[11rem,minmax(0,1fr),12rem]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold text-white/70">Инструменты</p>
          <div className="mt-3 grid gap-2">
            {["Стена", "Помещение", "Окно"].map((tool) => (
              <div key={tool} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
                {tool}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#10233f] p-3">
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/10 p-1">
            <span className="rounded-full bg-[color:var(--lime-bright)] px-3 py-1 text-[11px] font-bold text-[color:var(--navy-deep)]">
              2D-чертёж
            </span>
            <span className="px-3 py-1 text-[11px] font-semibold text-white/65">3D-модель</span>
          </div>
          <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-white/15 bg-[#0d1c33]">
            <IconModel size={32} className="text-[color:var(--blue-bright)]" />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold text-white/70">Свойства</p>
          <dl className="mt-3 space-y-2 text-xs text-white/75">
            <div className="flex justify-between gap-2">
              <dt>Материал</dt>
              <dd className="font-semibold text-white">Кирпич</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>R</dt>
              <dd className="font-semibold text-white">3,24</dd>
            </div>
            <div className="flex items-center gap-1 justify-end text-[color:var(--lime-bright)]">
              <IconThermometer size={14} />
              <span className="font-semibold">21 °C</span>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">Расчёт</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">Отчёты</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
          <IconWind size={12} />
          Теплопотери
        </span>
      </div>
    </div>
  );
}

export function DocumentPreviewStack() {
  const docs = ["Энергетический паспорт", "Расчёт тепловой защиты", "Инженерное заключение"];
  return (
    <div className="space-y-3">
      {docs.map((title, index) => (
        <div
          key={title}
          className="rounded-[28px] border border-[color:var(--border-soft)] bg-white px-5 py-4 shadow-[0_20px_50px_-32px_rgba(8,17,31,0.35)]"
          style={{ transform: `translateX(${index * 6}px)` }}
        >
          <p className="text-sm font-semibold text-[color:var(--text-muted)]">
            Документ {index + 1}
          </p>
          <p className="mt-1 text-lg font-bold text-[color:var(--text-base)]">{title}</p>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">Готов к экспорту после расчёта.</p>
        </div>
      ))}
    </div>
  );
}
