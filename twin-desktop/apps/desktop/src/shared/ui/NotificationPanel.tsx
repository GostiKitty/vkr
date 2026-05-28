import { useEffect } from "react";
import { useNotificationStore } from "../../entities/notifications/notification.store";

const NOTIFICATION_AUTO_DISMISS_MS = 1000;

export function NotificationPanel() {
  const items = useNotificationStore((state) => state.items);
  const remove = useNotificationStore((state) => state.remove);

  useEffect(() => {
    const timers = items.map((item) =>
      window.setTimeout(() => {
        remove(item.id);
      }, NOTIFICATION_AUTO_DISMISS_MS)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [items, remove]);

  if (!items.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto flex w-full max-w-md items-center justify-between rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow-overlay)] backdrop-blur-md animate-notify-in ${
            item.type === "error"
              ? "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]"
              : "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
          }`}
        >
          <span className="pr-2 leading-snug">{item.message}</span>
          <button
            type="button"
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-black/5 hover:text-[color:var(--text-base)]"
            onClick={() => remove(item.id)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default NotificationPanel;
