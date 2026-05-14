import { create } from "zustand";
export const useDebugConsoleStore = create((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    toggle: () => set((state) => ({
        isOpen: !state.isOpen,
    })),
}));
