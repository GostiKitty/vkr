import { create } from "zustand";
const buildId = () => Math.random().toString(36).slice(2);
export const useNotificationStore = create((set) => ({
    items: [],
    push: (type, message) => set((state) => ({
        items: [...state.items, { id: buildId(), type, message }],
    })),
    remove: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id),
    })),
    clear: () => set({ items: [] }),
}));
export function notifyError(message) {
    useNotificationStore.getState().push("error", message);
}
export function notifyInfo(message) {
    useNotificationStore.getState().push("info", message);
}
