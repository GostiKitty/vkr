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
      {kicker ? <p className="ui-soft-kicker">{kicker}</p> : null}
      <h3 className="ui-heading-card">{title}</h3>
      {subtitle ? <p className="max-w-3xl text-[15px] leading-snug text-[color:var(--text-muted)]">{subtitle}</p> : null}
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
      <p className="text-[0.8rem] font-semibold leading-snug text-[color:var(--text-muted)]">{label}</p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-[color:var(--text-base)]">
        {value}
        {unit ? <span className="ml-1.5 text-base font-medium text-[color:var(--text-muted)]">{unit}</span> : null}
      </p>
      {hint ? <p className="text-xs leading-snug text-[color:var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

export function TemperatureScaleLegend({
  minC = 15,
  maxC = 30,
  title = "Temperature Scale",
  unitLabel = "°C",
  minLabel,
  maxLabel,
  gradientCss,
  caption,
}: {
  minC?: number;
  maxC?: number;
  title?: string;
  unitLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  gradientCss?: string;
  caption?: string;
}) {
  const resolvedMinLabel = minLabel ?? `${minC} ${unitLabel}`.trim();
  const resolvedMaxLabel = maxLabel ?? `${maxC} ${unitLabel}`.trim();
  return (
    <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-muted)] shadow-sm backdrop-blur">
      <p className="mb-1.5 font-semibold text-[color:var(--text-base)]">{title}</p>
      <div
        className="h-2.5 w-full max-w-[220px] rounded-full shadow-inner"
        style={{ background: gradientCss ?? "var(--temp-legend-gradient)" }}
        title={`${resolvedMinLabel} → ${resolvedMaxLabel}`}
      />
      <div className="mt-1 flex max-w-[220px] justify-between font-medium tabular-nums text-[color:var(--text-base)]">
        <span>{resolvedMinLabel}</span>
        <span>{resolvedMaxLabel}</span>
      </div>
      {caption ? <p className="mt-1.5 text-xs leading-snug text-[color:var(--text-soft)]">{caption}</p> : null}
    </div>
  );
}

/**
 * Compact engineering-grade thermal field legend.
 *
 * Shows: mode title, ANSYS colorbar, min / avg / max values, unit label,
 * source caption, and optional warning list.
 *
 * Use this instead of TemperatureScaleLegend wherever ANSYS-like output is shown.
 */
export function ThermalFieldLegend({
  title = "Thermal Field",
  minC,
  avgC,
  maxC,
  unitLabel = "°C",
  source,
  warnings,
  gradientCss,
  condensationMode,
}: {
  title?: string;
  minC: number;
  avgC?: number;
  maxC: number;
  unitLabel?: string;
  /** Short caption describing the data source, e.g. "Patch thermal field" */
  source?: string;
  /** List of short warning strings shown below the bar */
  warnings?: string[];
  /** Override the CSS gradient (defaults to ANSYS thermal colormap) */
  gradientCss?: string;
  /** If true, switches to green→red condensation risk palette labels */
  condensationMode?: boolean;
}) {
  const resolvedGradient =
    gradientCss ??
    (condensationMode
      ? "linear-gradient(90deg, #16a34a 0%, #f59e0b 50%, #dc2626 100%)"
      : "var(--temp-legend-gradient)");

  const fmt = (v: number) =>
    unitLabel === "°C" ? `${v.toFixed(1)} ${unitLabel}` : `${v.toFixed(1)} ${unitLabel}`;

  const minLabel = condensationMode ? "Safe" : fmt(minC);
  const maxLabel = condensationMode ? "Risk" : fmt(maxC);

  return (
    <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-muted)] shadow-sm backdrop-blur">
      {/* Title row */}
      <p className="mb-1.5 font-semibold text-[color:var(--text-base)]">{title}</p>

      {/* Colorbar */}
      <div
        className="h-2.5 w-full max-w-[220px] rounded-full shadow-inner"
        style={{ background: resolvedGradient }}
        title={`${minLabel} → ${maxLabel}`}
      />

      {/* Min / [avg] / max row */}
      <div className="mt-1 flex max-w-[220px] items-center justify-between font-medium tabular-nums text-[color:var(--text-base)]">
        <span className="text-[11px]">{minLabel}</span>
        {typeof avgC === "number" && !condensationMode ? (
          <span className="text-[10px] text-[color:var(--text-soft)]">∅ {fmt(avgC)}</span>
        ) : null}
        <span className="text-[11px]">{maxLabel}</span>
      </div>

      {/* Source label */}
      {source ? (
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {source}
        </p>
      ) : null}

      {/* Warnings */}
      {warnings?.length ? (
        <div className="mt-1.5 space-y-0.5">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-1 text-[10px] leading-snug text-[color:var(--text-muted)]">
              <span className="mt-px opacity-60">⚠</span>
              <span>{w}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
