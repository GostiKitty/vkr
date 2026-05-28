import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type StatusTone = "neutral" | "info" | "success" | "warning" | "error";

interface SectionShellProps {
  title: string;
  description?: string;
  kicker?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface StatusBadgeProps {
  tone?: StatusTone;
  children: ReactNode;
}

interface MetricCardProps {
  label: string;
  value: number | null;
  unit?: string;
  formula?: string;
  subtitle?: string;
  precision?: number;
  status?: StatusTone;
  icon?: ReactNode;
  trend?: string;
  animateValue?: boolean;
}

interface FormulaCardProps {
  title: string;
  formula: string;
  description: string;
  parameters: string[];
}

interface EngineeringPanelProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

interface ResultSummaryCardProps {
  totalHeatLossKW: number | null;
  specificHeatLoss: number | null;
  weakElement?: string | null;
  recommendation?: string | null;
}

interface ReportPreviewCardProps {
  title?: string;
  sections?: string[];
  status?: string;
  loading?: boolean;
  onExport?: () => void;
  exportLabel?: string;
}

interface AnimatedTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  tabs: Array<{
    id: T;
    label: string;
    disabled?: boolean;
    hint?: string;
    badge?: ReactNode;
  }>;
}

interface CalculationProgressProps {
  title?: string;
  running: boolean;
  completed: boolean;
  steps: string[];
  activeStep: number;
  error?: string | null;
}

const STATUS_CLASS: Record<StatusTone, string> = {
  neutral: "ui-status-badge ui-status-badge--neutral",
  info: "ui-status-badge ui-status-badge--info",
  success: "ui-status-badge ui-status-badge--success",
  warning: "ui-status-badge ui-status-badge--warning",
  error: "ui-status-badge ui-status-badge--error",
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useAnimatedNumber(
  targetValue: number | null,
  precision: number,
  durationMs: number,
  enabled: boolean
) {
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (targetValue == null) {
      setValue(0);
      return;
    }
    if (!enabled || reducedMotion) {
      setValue(targetValue);
      return;
    }
    const start = performance.now();
    let frameId = 0;

    const animate = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(targetValue * eased);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [durationMs, enabled, precision, reducedMotion, targetValue]);

  if (targetValue == null) {
    return "—";
  }
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function SectionShell({
  title,
  description,
  kicker,
  action,
  children,
  className,
}: SectionShellProps) {
  return (
    <section className={joinClasses("ui-section-shell", className)}>
      <header className="ui-section-shell__header">
        <div className="space-y-2">
          {kicker ? <p className="ui-kicker">{kicker}</p> : null}
          <h2 className="ui-section-shell__title">{title}</h2>
          {description ? <p className="ui-section-shell__description">{description}</p> : null}
        </div>
        {action ? <div className="ui-section-shell__action">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return <span className={STATUS_CLASS[tone]}>{children}</span>;
}

export function MetricCard({
  label,
  value,
  unit,
  formula,
  subtitle,
  precision = 2,
  status = "neutral",
  icon,
  trend,
  animateValue = true,
}: MetricCardProps) {
  const display = useAnimatedNumber(value, precision, 1000, animateValue);
  return (
    <article className="ui-metric-card ui-hover-lift group">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="ui-metric-card__label">{label}</p>
          {formula ? <p className="ui-metric-card__formula">{formula}</p> : null}
        </div>
        {icon ? <span className="ui-metric-card__icon ui-icon-tap">{icon}</span> : null}
      </div>
      <div className="mt-4 flex items-end gap-2">
        <p className="ui-metric-card__value">{display}</p>
        {unit ? <p className="ui-metric-card__unit">{unit}</p> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusBadge tone={status}>{mapStatusLabel(status)}</StatusBadge>
        {trend ? <span className="ui-metric-card__trend">{trend}</span> : null}
      </div>
      {subtitle ? <p className="ui-metric-card__subtitle">{subtitle}</p> : null}
    </article>
  );
}

function mapStatusLabel(status: StatusTone): string {
  switch (status) {
    case "success":
      return "Расчёт выполнен";
    case "warning":
      return "Есть предупреждения";
    case "error":
      return "Нужна проверка";
    case "info":
      return "Инженерные данные";
    default:
      return "Статус";
  }
}

export function FormulaCard({
  title,
  formula,
  description,
  parameters,
}: FormulaCardProps) {
  return (
    <article className="ui-formula-card">
      <p className="ui-formula-card__title">{title}</p>
      <p className="ui-formula-card__formula">{formula}</p>
      <p className="ui-formula-card__description">{description}</p>
      <ul className="ui-formula-card__list">
        {parameters.map((parameter) => (
          <li key={parameter}>{parameter}</li>
        ))}
      </ul>
    </article>
  );
}

export function EngineeringPanel({
  title,
  description,
  children,
  className,
}: EngineeringPanelProps) {
  return (
    <section className={joinClasses("ui-engineering-panel", className)}>
      <header className="space-y-1">
        <h3 className="ui-engineering-panel__title">{title}</h3>
        {description ? <p className="ui-engineering-panel__description">{description}</p> : null}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ResultSummaryCard({
  totalHeatLossKW,
  specificHeatLoss,
  weakElement,
  recommendation,
}: ResultSummaryCardProps) {
  return (
    <EngineeringPanel
      title="Итог расчёта"
      description="Ключевые показатели теплопотерь и инженерная рекомендация."
      className="ui-result-summary-card"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Суммарные теплопотери"
          value={totalHeatLossKW}
          unit="кВт"
          formula="Q"
          precision={2}
          status={totalHeatLossKW != null ? "success" : "warning"}
          subtitle="Расчётные потери здания"
        />
        <MetricCard
          label="Удельные теплопотери"
          value={specificHeatLoss}
          unit="Вт/м²"
          formula="q"
          precision={1}
          status={specificHeatLoss != null ? "info" : "warning"}
          subtitle="Нагрузка на единицу площади"
        />
        <article className="ui-result-note-card">
          <p className="ui-result-note-card__label">Наиболее слабая конструкция</p>
          <p className="ui-result-note-card__value">{weakElement ?? "Определится после расчёта"}</p>
        </article>
        <article className="ui-result-note-card">
          <p className="ui-result-note-card__label">Рекомендация</p>
          <p className="ui-result-note-card__value">
            {recommendation ?? "После расчёта появится автоматический инженерный комментарий."}
          </p>
        </article>
      </div>
    </EngineeringPanel>
  );
}

export function ReportPreviewCard({
  title = "Предпросмотр отчёта",
  // Temporarily hidden from UI. Will be restored after project documentation export redesign.
  // Прежний набор разделов (тепловая защита, энергопаспорт, заключение) перенесён
  // в нейтральный список расчётных сводок.
  sections = [
    "Исходные данные проекта",
    "Расчётная сводка по теплопотерям",
    "Метрики помещений и динамика",
  ],
  status = "Отчёт ещё не сформирован",
  loading = false,
  onExport,
  exportLabel = "Экспорт отчёта",
}: ReportPreviewCardProps) {
  return (
    <section className="ui-report-preview-card">
      <div className="ui-report-preview-card__sheet">
        <p className="ui-report-preview-card__title">{title}</p>
        <ul className="ui-report-preview-card__list">
          {sections.map((section) => (
            <li key={section}>{section}</li>
          ))}
        </ul>
      </div>
      <div className="ui-report-preview-card__footer">
        <StatusBadge tone={loading ? "info" : status.includes("сформирован") ? "success" : "warning"}>
          {status}
        </StatusBadge>
        <button type="button" onClick={onExport} disabled={loading || !onExport} className="ui-btn-primary">
          {loading ? "Формирование..." : exportLabel}
        </button>
      </div>
    </section>
  );
}

export function AnimatedTabs<T extends string>({
  value,
  onChange,
  tabs,
}: AnimatedTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ width: 0, left: 0 });
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const activeButton = buttonRefs.current[value];
    if (!container || !activeButton) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    setIndicator({
      width: buttonRect.width,
      left: buttonRect.left - containerRect.left,
    });
  }, [tabs, value]);

  return (
    <div ref={containerRef} className="ui-animated-tabs ui-tabs-track" role="tablist">
      <span
        className="ui-animated-tabs__indicator"
        style={
          {
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
            transitionDuration: reducedMotion ? "0ms" : "220ms",
          } as CSSProperties
        }
      />
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              buttonRefs.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            disabled={tab.disabled}
            title={tab.hint}
            aria-selected={isActive}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={joinClasses(
              "ui-animated-tabs__tab",
              isActive && "ui-animated-tabs__tab--active",
              tab.disabled && "ui-animated-tabs__tab--disabled"
            )}
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

export function CalculationProgress({
  title = "Идёт инженерный расчёт",
  running,
  completed,
  steps,
  activeStep,
  error,
}: CalculationProgressProps) {
  const completedCount = completed ? steps.length : Math.max(0, Math.min(steps.length, activeStep));
  const progressPercent = steps.length === 0 ? 0 : Math.round((completedCount / steps.length) * 100);

  return (
    <section className="ui-calculation-progress">
      <div className="flex items-center justify-between gap-3">
        <h3 className="ui-calculation-progress__title">{title}</h3>
        <StatusBadge tone={error ? "error" : completed ? "success" : running ? "info" : "warning"}>
          {error
            ? "Ошибка расчёта"
            : completed
              ? "Расчёт выполнен"
              : running
                ? "В процессе"
                : "Требуются исходные данные"}
        </StatusBadge>
      </div>
      <div className="ui-calculation-progress__bar-wrap">
        <div className="ui-calculation-progress__bar" style={{ width: `${progressPercent}%` }} />
      </div>
      <ol className="ui-calculation-progress__steps">
        {steps.map((step, index) => {
          const stepState = completed || index < activeStep ? "done" : index === activeStep ? "active" : "idle";
          return (
            <li key={step} className={`ui-calculation-progress__step ui-calculation-progress__step--${stepState}`}>
              <span className="ui-calculation-progress__dot" />
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
      {error ? <p className="ui-calculation-progress__error">{error}</p> : null}
    </section>
  );
}

