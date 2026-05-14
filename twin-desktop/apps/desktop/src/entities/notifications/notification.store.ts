import { create } from "zustand";

export interface Notification {
  id: string;
  type: "info" | "error";
  message: string;
}

interface NotificationState {
  items: Notification[];
  push: (type: Notification["type"], message: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const buildId = () => Math.random().toString(36).slice(2);

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  push: (type, message) =>
    set((state) => ({
      items: [...state.items, { id: buildId(), type, message }],
    })),
  remove: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  clear: () => set({ items: [] }),
}));

export function notifyError(message: string) {
  useNotificationStore.getState().push("error", message);
}

export function notifyInfo(message: string) {
  useNotificationStore.getState().push("info", message);
}
