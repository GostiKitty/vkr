import { create } from "zustand";
const dedupe = (ids) => Array.from(new Set(ids.filter(Boolean)));
export const useFormulaDrawerStore = create((set) => ({
    isOpen: false,
    pinned: false,
    formulaIds: [],
    activeFormulaId: null,
    open: (ids, focusId) => set({
        isOpen: true,
        formulaIds: dedupe(ids),
        activeFormulaId: focusId ?? ids[0] ?? null,
    }),
    append: (ids) => set((state) => ({
        isOpen: true,
        formulaIds: dedupe([...state.formulaIds, ...ids]),
        activeFormulaId: state.activeFormulaId ?? ids[0] ?? null,
    })),
    close: () => set({
        isOpen: false,
        formulaIds: [],
        activeFormulaId: null,
        pinned: false,
    }),
    togglePin: () => set((state) => ({
        pinned: !state.pinned,
        isOpen: !state.pinned ? true : state.isOpen,
    })),
    focus: (id) => set((state) => ({
        activeFormulaId: id,
        isOpen: state.isOpen || Boolean(id),
    })),
}));
export const openFormulaDrawer = (ids, focusId) => {
    useFormulaDrawerStore.getState().open(ids, focusId);
};
