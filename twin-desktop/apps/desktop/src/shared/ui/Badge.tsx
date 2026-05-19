import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "accent";

const toneClass: Record<BadgeTone, string> = {
  neutral: "",
  info: "ui-build-badge--info",
  success: "ui-build-badge--success",
  warning: "ui-build-badge--warning",
  accent: "ui-build-badge--accent",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ tone = "neutral", children, className = "", title }: BadgeProps) {
  return (
    <span className={`ui-build-badge ${toneClass[tone]} ${className}`.trim()} title={title}>
      {children}
    </span>
  );
}
