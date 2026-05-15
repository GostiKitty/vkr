import React from "react";

interface EmptyStateProps {
  title?: string;
  message: string;
  icon?: React.ReactNode;
  tone?: "default" | "warning";
}

export function EmptyState({ title, message, icon, tone = "default" }: EmptyStateProps) {
  const palette =
    tone === "warning"
      ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"
      : "border-[color:var(--border-soft)] bg-[color:var(--surface-base)] text-[color:var(--text-muted)]";

  return (
    <div className={`group animate-ui-pop rounded-2xl border px-4 py-6 text-sm shadow-inner transition ${palette}`}>
      {icon && <div className="ui-icon-tap mb-2 text-[color:var(--accent-base)]">{icon}</div>}
      {title && <p className="text-base font-semibold text-[color:var(--text-base)]">{title}</p>}
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}

export default EmptyState;
