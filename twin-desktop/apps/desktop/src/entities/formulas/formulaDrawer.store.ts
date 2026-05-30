import { create } from "zustand";

interface FormulaDrawerState {
  isOpen: boolean;
  formulaIds: string[];
  activeFormulaId: string | null;
  open: (ids: string[], focusId?: string) => void;
  append: (ids: string[]) => void;
  close: () => void;
}

const dedupe = (ids: string[]): string[] => Array.from(new Set(ids.filter(Boolean)));

export const useFormulaDrawerStore = create<FormulaDrawerState>((set) => ({
  isOpen: false,
  formulaIds: [],
  activeFormulaId: null,
  open: (ids, focusId) =>
    set({
      isOpen: true,
      formulaIds: dedupe(ids),
      activeFormulaId: focusId ?? ids[0] ?? null,
    }),
  append: (ids) =>
    set((state) => ({
      isOpen: true,
      formulaIds: dedupe([...state.formulaIds, ...ids]),
      activeFormulaId: state.activeFormulaId ?? ids[0] ?? null,
    })),
  close: () =>
    set({
      isOpen: false,
      formulaIds: [],
      activeFormulaId: null,
    }),
}));

export const openFormulaDrawer = (ids: string[], focusId?: string) => {
  useFormulaDrawerStore.getState().open(ids, focusId);
};
