import { useEffect } from "react";
import { useNotificationStore } from "../../entities/notifications/notification.store";

export function NotificationPanel() {
  const items = useNotificationStore((state) => state.items);
  const remove = useNotificationStore((state) => state.remove);

  useEffect(() => {
    const timers = items.map((item) =>
      window.setTimeout(() => {
        remove(item.id);
      }, 5000)
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
          className={`pointer-events-auto flex w-full max-w-md items-center justify-between rounded-2xl border px-4 py-3 text-sm shadow-lg ${
            item.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          <span>{item.message}</span>
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
            onClick={() => remove(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default NotificationPanel;
