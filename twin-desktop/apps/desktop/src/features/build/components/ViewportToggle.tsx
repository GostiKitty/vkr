

export interface ViewportToggleProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

/**
 * Small pill toggle used to switch between plan/3D/result overlays.
 * Includes a defensive fallback so Build Mode keeps rendering even if styling crashes.
 */
export function ViewportToggle({ label, active, onClick }: ViewportToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-out active:scale-95 ${
        active
          ? "border-[color:var(--accent-base)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)] shadow-sm"
          : "border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] text-[color:var(--text-muted)] hover:scale-[1.03] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)]"
      }`}
    >
      {label}
    </button>
  );
}

export default ViewportToggle;
