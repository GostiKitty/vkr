import type { LossCategoryKey } from "../../../core/thermal/thermalResultsChartPayload";
import { formatNumber } from "../../../shared/utils/format";

export const THERMAL_CHART_NOT_SET = "не задано";

export const LOSS_CATEGORY_COLORS: Record<LossCategoryKey, string> = {
  opaque: "var(--chart-loss-opaque, #0f766e)",
  window: "var(--chart-loss-window, #3b82f6)",
  door: "var(--chart-loss-door, #f97316)",
  infiltration: "var(--chart-loss-infiltration, #dc2626)",
  ventilation: "var(--chart-loss-ventilation, #7c3aed)",
};

export const LOSS_CATEGORY_LABELS: Record<LossCategoryKey, string> = {
  opaque: "Непрозрачные ограждения",
  window: "Окна",
  door: "Двери",
  infiltration: "Инфильтрация",
  ventilation: "Механическая вентиляция",
};

export const CHART_AXIS_TICK = { fill: "var(--text-soft)", fontSize: 11 } as const;

export const CHART_TOOLTIP_STYLE = {
  background: "var(--surface-elevated)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--shadow-overlay, 0 8px 24px rgba(0,0,0,0.12))",
};

export const CHART_MARGIN = { top: 12, right: 28, left: 8, bottom: 8 } as const;

export const CHART_MARGIN_VERTICAL = { top: 12, right: 32, left: 12, bottom: 8 } as const;

export function formatChartPower(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return THERMAL_CHART_NOT_SET;
  }
  const numeric = value as number;
  if (Math.abs(numeric) >= 1000) {
    return `${formatNumber(numeric / 1000, { maximumFractionDigits: 1 })} кВт`;
  }
  return `${formatNumber(numeric, { maximumFractionDigits: 0 })} Вт`;
}

export function formatChartTemperature(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return THERMAL_CHART_NOT_SET;
  }
  return `${formatNumber(value, { maximumFractionDigits: 1 })} °C`;
}

export function formatChartPercent(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return THERMAL_CHART_NOT_SET;
  }
  return `${formatNumber(value, { maximumFractionDigits: 1 })} %`;
}

export function formatChartAxisPower(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${formatNumber(value / 1000, { maximumFractionDigits: 1 })} кВт`;
  }
  return `${formatNumber(value, { maximumFractionDigits: 0 })}`;
}

export function clampChart(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getFiniteChartDomain(values: Array<number | null | undefined>): [number, number] | null {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (!finite.length) {
    return null;
  }
  return [Math.min(...finite), Math.max(...finite)];
}

/** Температура: холоднее — синее, теплее — янтарное (для поиска «холодных» зон). */
export function heatColorTemperature(value: number, min: number, max: number): string {
  if (max <= min) {
    return "rgba(148, 163, 184, 0.2)";
  }
  const ratio = clampChart((value - min) / (max - min), 0, 1);
  const hue = 215 - ratio * 175;
  return `hsla(${hue}, 72%, 58%, 0.55)`;
}

/** Нагрузка/потери: выше — насыщеннее (красно-оранжевый). */
export function heatColorLoad(value: number, min: number, max: number): string {
  if (max <= min) {
    return "rgba(148, 163, 184, 0.2)";
  }
  const ratio = clampChart((value - min) / (max - min), 0, 1);
  const hue = 200 - ratio * 195;
  return `hsla(${hue}, 78%, 52%, 0.5)`;
}

export function heatCellTextClass(ratio: number): string {
  return ratio > 0.55 ? "font-semibold text-white" : "font-semibold text-slate-900";
}

export function formatZoneStatusLabel(status: "ok" | "attention" | "risk" | null): string {
  switch (status) {
    case "ok":
      return "Норма";
    case "attention":
      return "Внимание";
    case "risk":
      return "Риск";
    default:
      return THERMAL_CHART_NOT_SET;
  }
}

export function statusBadgeClass(status: "ok" | "attention" | "risk" | null): string {
  if (status === "risk") {
    return "inline-flex rounded-full border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--danger-fg)]";
  }
  if (status === "attention") {
    return "inline-flex rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--warning-fg)]";
  }
  if (status === "ok") {
    return "inline-flex rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--success-fg)]";
  }
  return "text-[color:var(--text-soft)]";
}
