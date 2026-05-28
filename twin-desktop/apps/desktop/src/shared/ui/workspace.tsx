import type { ReactNode } from "react";

type StatusStripTone = "neutral" | "success" | "warning" | "info";

interface WorkspacePageHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

interface StatusStripItem {
  label: string;
  value: ReactNode;
  tone?: StatusStripTone;
}

interface StatusStripProps {
  items: StatusStripItem[];
  className?: string;
}

interface WorkspaceShellProps {
  children: ReactNode;
  className?: string;
}

interface WorkspacePaneProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

interface EmptyWorkspaceStateProps {
  title: string;
  message: string;
  actions?: ReactNode;
  className?: string;
}

const STRIP_TONE_CLASS: Record<StatusStripTone, string> = {
  neutral: "",
  success: "ui-workspace-strip__item--success",
  warning: "ui-workspace-strip__item--warning",
  info: "ui-workspace-strip__item--info",
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function WorkspacePageHeader({
  kicker,
  title,
  description,
  actions,
}: WorkspacePageHeaderProps) {
  return (
    <header className="ui-workspace-header">
      <div className="min-w-0 space-y-2">
        {kicker ? <p className="ui-kicker">{kicker}</p> : null}
        <h1 className="ui-heading-hero">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-[15px] leading-snug text-[color:var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="ui-workspace-header__actions">{actions}</div> : null}
    </header>
  );
}

export function StatusStrip({ items, className }: StatusStripProps) {
  return (
    <div className={joinClasses("ui-workspace-strip", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={joinClasses(
            "ui-workspace-strip__item",
            STRIP_TONE_CLASS[item.tone ?? "neutral"]
          )}
        >
          <span className="ui-workspace-strip__label">{item.label}</span>
          <span className="ui-workspace-strip__value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceShell({ children, className }: WorkspaceShellProps) {
  return <div className={joinClasses("ui-workspace-shell", className)}>{children}</div>;
}

export function WorkspacePane({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: WorkspacePaneProps) {
  return (
    <section className={joinClasses("ui-workspace-pane", className)}>
      <div className="ui-workspace-pane__header">
        <div className="min-w-0 space-y-1">
          <h2 className="ui-heading-panel">{title}</h2>
          {subtitle ? (
            <p className="text-sm leading-relaxed text-[color:var(--text-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className={joinClasses("ui-workspace-pane__body", bodyClassName)}>{children}</div>
    </section>
  );
}

export function InspectorPanel(props: WorkspacePaneProps) {
  return <WorkspacePane {...props} className={joinClasses("ui-workspace-pane--inspector", props.className)} />;
}

export function ActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={joinClasses("ui-action-bar", className)}>{children}</div>;
}

export function EmptyWorkspaceState({
  title,
  message,
  actions,
  className,
}: EmptyWorkspaceStateProps) {
  return (
    <div className={joinClasses("ui-empty-workspace", className)}>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">{title}</p>
        <p className="text-sm leading-relaxed text-[color:var(--text-muted)]">{message}</p>
      </div>
      {actions ? <div className="ui-empty-workspace__actions">{actions}</div> : null}
    </div>
  );
}

type HighlightTone = StatusStripTone;

export function HighlightCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: HighlightTone;
}) {
  const toneClass =
    tone === "success"
      ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"
      : tone === "warning"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]"
        : tone === "info"
          ? "border-[color:var(--info-border)] bg-[color:var(--info-bg)]"
          : "";

  return (
    <article className={joinClasses("ui-highlight-card ui-hover-lift", toneClass)}>
      <p className="ui-highlight-card__label">{label}</p>
      <p className="ui-highlight-card__value">{value}</p>
      {hint ? <p className="ui-highlight-card__hint">{hint}</p> : null}
    </article>
  );
}

export function SummaryHighlightGrid({
  items,
  className,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    hint?: string;
    tone?: HighlightTone;
  }>;
  className?: string;
}) {
  return (
    <div className={joinClasses("ui-highlight-grid", className)}>
      {items.map((item) => (
        <HighlightCard key={item.label} {...item} />
      ))}
    </div>
  );
}

export function SummaryHero({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={joinClasses("ui-summary-hero", className)}>
      <h2 className="ui-summary-hero__title">{title}</h2>
      {description ? <p className="ui-summary-hero__description">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={joinClasses("ui-collapsible", className)} open={defaultOpen || undefined}>
      <summary className="ui-collapsible__summary">{title}</summary>
      <div className="ui-collapsible__body">
        {description ? <p className="ui-collapsible__description">{description}</p> : null}
        {children}
      </div>
    </details>
  );
}
