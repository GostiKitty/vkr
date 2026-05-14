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
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-white text-slate-500";

  return (
    <div className={`rounded-2xl border px-4 py-6 text-sm shadow-inner transition ${palette}`}>
      {icon && <div className="mb-2 text-2xl">{icon}</div>}
      {title && <p className="text-base font-semibold text-slate-900">{title}</p>}
      <p>{message}</p>
    </div>
  );
}

export default EmptyState;
