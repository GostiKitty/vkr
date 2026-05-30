import type { ButtonHTMLAttributes, ReactNode } from "react";

export type BuildToolButtonVariant = "default" | "active" | "disabled";
export type BuildToolButtonTone = "default" | "supply" | "return" | "accent";

const toneActiveClass: Record<BuildToolButtonTone, string> = {
  default: "ui-control-active border-[color:var(--accent-muted)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)]",
  supply:
    "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)] shadow-[var(--shadow-control)]",
  return: "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info-fg)] shadow-[var(--shadow-control)]",
  accent: "ui-control-active",
};

interface BuildToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BuildToolButtonVariant;
  tone?: BuildToolButtonTone;
  children: ReactNode;
  className?: string;
  block?: boolean;
}

export function BuildToolButton({
  variant = "default",
  tone = "default",
  children,
  className = "",
  block = false,
  disabled,
  type = "button",
  ...rest
}: BuildToolButtonProps) {
  const isDisabled = variant === "disabled" || disabled;
  const isActive = variant === "active" && !isDisabled;

  const stateClass = isDisabled
    ? "cursor-not-allowed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-disabled)] opacity-100 shadow-none"
    : isActive
      ? toneActiveClass[tone]
      : "border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-base)]";

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`ui-control rounded-[var(--radius-control)] border px-3 py-2 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-base)] ${block ? "w-full" : ""} ${stateClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
