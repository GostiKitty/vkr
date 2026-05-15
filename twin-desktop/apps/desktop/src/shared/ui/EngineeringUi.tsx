import type { ReactNode } from "react";
import { IconStatusError, IconStatusOk, IconStatusWarn } from "./icons";

export type EngineeringCalloutVariant = "info" | "assumption" | "attention" | "risk" | "success";

const calloutClass: Record<EngineeringCalloutVariant, string> = {
  info: "ui-callout-info",
  assumption: "ui-callout-assumption",
  attention: "ui-callout-attention",
  risk: "ui-callout-risk",
  success: "ui-callout-success",
};

const calloutDefaultIcon: Record<EngineeringCalloutVariant, ReactNode> = {
  info: <IconStatusOk className="h-[1.1rem] w-[1.1rem] opacity-90" />,
  assumption: <IconStatusWarn className="h-[1.1rem] w-[1.1rem] opacity-80" />,
  attention: <IconStatusWarn className="h-[1.1rem] w-[1.1rem] opacity-90" />,
  risk: <IconStatusError className="h-[1.1rem] w-[1.1rem] opacity-90" />,
  success: <IconStatusOk className="h-[1.1rem] w-[1.1rem] opacity-90" />,
};

/** Информационный блок: допущения, ограничения метода, подсказки. */
export function EngineeringCallout({
  variant = "info",
  title,
  children,
  icon,
  className = "",
}: {
  variant?: EngineeringCalloutVariant;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const resolvedIcon = icon !== undefined ? icon : calloutDefaultIcon[variant];
  return (
    <div
      className={`group animate-ui-pop rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${calloutClass[variant]} ${className}`.trim()}
    >
      <p className="flex items-start gap-2 font-semibold text-[color:var(--text-base)]">
        {resolvedIcon != null ? (
          <span className="ui-icon-tap mt-0.5 shrink-0 text-[color:var(--accent-base)]">{resolvedIcon}</span>
        ) : null}
        <span>{title}</span>
      </p>
      <div className="mt-2 text-[0.925rem] leading-snug text-[color:var(--text-muted)] [&_ul]:mt-1 [&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-5 [&_p+p]:mt-2 [&_strong]:text-[color:var(--text-base)]">
        {children}
      </div>
    </div>
  );
}

export function EngineeringSectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="space-y-1">
      {kicker ? <p className="ui-kicker">{kicker}</p> : null}
      <h3 className="ui-heading-panel">{title}</h3>
      {subtitle ? <p className="max-w-3xl text-sm leading-relaxed text-[color:var(--text-muted)]">{subtitle}</p> : null}
    </header>
  );
}

export type MetricStatusTone = "neutral" | "ok" | "attention" | "risk";

const toneRing: Record<MetricStatusTone, string> = {
  neutral: "ring-[color:var(--border-base)]",
  ok: "ring-[color:var(--success-border)]",
  attention: "ring-[color:var(--warning-border)]",
  risk: "ring-[color:var(--danger-border)]",
};

/** Компактная карточка метрики: название, значение, единица, короткая подсказка. */
export function EngineeringMetricTile({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: MetricStatusTone;
}) {
  return (
    <div
      className={`ui-metric ui-hover-lift group flex flex-col gap-1 p-4 shadow-sm ring-1 ring-inset ${toneRing[tone]} hover:border-[color:var(--border-base)]`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">{label}</p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-[color:var(--text-base)]">
        {value}
        {unit ? <span className="ml-1.5 text-base font-medium text-[color:var(--text-muted)]">{unit}</span> : null}
      </p>
      {hint ? <p className="text-xs leading-snug text-[color:var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

/** Градиентная шкала для тепловой окраски (15…30 °C по умолчанию, согласовано с `temperatureToColor`). */
export function TemperatureScaleLegend({
  minC = 15,
  maxC = 30,
  caption,
}: {
  minC?: number;
  maxC?: number;
  caption?: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-[11px] text-[color:var(--text-muted)] shadow-sm backdrop-blur">
      <p className="mb-1.5 font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Шкала температуры</p>
      <div
        className="h-2.5 w-full max-w-[220px] rounded-full shadow-inner"
        style={{ background: "var(--temp-legend-gradient)" }}
        title={`От ${minC} °C (холоднее) к ${maxC} °C (теплее)`}
      />
      <div className="mt-1 flex max-w-[220px] justify-between font-medium tabular-nums text-[color:var(--text-base)]">
        <span>{minC} °C</span>
        <span>{maxC} °C</span>
      </div>
      {caption ? <p className="mt-1.5 text-[10px] leading-snug text-[color:var(--text-soft)]">{caption}</p> : null}
    </div>
  );
}
