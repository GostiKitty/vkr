import { create } from "zustand";



const STORAGE_KEY = "gnezdyshko-build-toolbar-layout";



export type BuildPanelSide = "left" | "right";
export type BuildToolsPlacement = "top" | "left" | "compact" | "auto";



/** @deprecated Use BuildPanelSide */

export type BuildToolbarLayout = BuildPanelSide;



const migrateStoredLayout = (stored: string | null): BuildPanelSide => {

  if (stored === "left" || stored === "right") {

    return stored;

  }

  // Legacy: top | both → left; sidebar → right

  if (stored === "sidebar") {

    return "right";

  }

  return "left";

};



const TOOLS_PLACEMENT_STORAGE_KEY = "gnezdyshko-build-tools-placement";
const SIDEBAR_WIDTH_STORAGE_KEY = "gnezdyshko-build-sidebar-width";

export const WORKSPACE_SIDEBAR_WIDTH_MIN = 280;
export const WORKSPACE_SIDEBAR_WIDTH_MAX = 560;
export const WORKSPACE_SIDEBAR_WIDTH_DEFAULT = 320;

function clampSidebarWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return WORKSPACE_SIDEBAR_WIDTH_DEFAULT;
  }
  return Math.min(WORKSPACE_SIDEBAR_WIDTH_MAX, Math.max(WORKSPACE_SIDEBAR_WIDTH_MIN, Math.round(value)));
}

const migrateStoredPlacement = (stored: string | null): BuildToolsPlacement => {
  if (stored === "top" || stored === "left" || stored === "compact" || stored === "auto") {
    return stored;
  }
  return "auto";
};

const readInitial = (): BuildPanelSide => {

  if (typeof window === "undefined") {

    return "left";

  }

  return migrateStoredLayout(window.localStorage.getItem(STORAGE_KEY));

};



const persist = (value: BuildPanelSide) => {

  if (typeof window === "undefined") {

    return;

  }

  window.localStorage.setItem(STORAGE_KEY, value);

};

const readInitialToolsPlacement = (): BuildToolsPlacement => {
  if (typeof window === "undefined") {
    return "auto";
  }
  return migrateStoredPlacement(window.localStorage.getItem(TOOLS_PLACEMENT_STORAGE_KEY));
};

const persistToolsPlacement = (value: BuildToolsPlacement) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TOOLS_PLACEMENT_STORAGE_KEY, value);
};

const readInitialSidebarWidth = (): number => {
  if (typeof window === "undefined") {
    return WORKSPACE_SIDEBAR_WIDTH_DEFAULT;
  }
  const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  return clampSidebarWidth(stored || WORKSPACE_SIDEBAR_WIDTH_DEFAULT);
};

const persistSidebarWidth = (value: number) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(value)));
};



interface BuildUiState {

  panelSide: BuildPanelSide;
  toolsPlacement: BuildToolsPlacement;
  workspaceSidebarWidth: number;

  /** @deprecated Use panelSide */

  toolbarLayout: BuildPanelSide;

  setPanelSide: (side: BuildPanelSide) => void;
  setToolsPlacement: (placement: BuildToolsPlacement) => void;
  setWorkspaceSidebarWidth: (width: number) => void;

  /** @deprecated Use setPanelSide */

  setToolbarLayout: (side: BuildPanelSide) => void;

}



export const useBuildUiStore = create<BuildUiState>((set) => ({

  panelSide: readInitial(),
  toolsPlacement: readInitialToolsPlacement(),
  workspaceSidebarWidth: readInitialSidebarWidth(),

  toolbarLayout: readInitial(),

  setPanelSide: (side) => {

    persist(side);

    set({ panelSide: side, toolbarLayout: side });

  },
  setToolsPlacement: (placement) => {
    persistToolsPlacement(placement);
    set({ toolsPlacement: placement });
  },
  setWorkspaceSidebarWidth: (width) => {
    const nextWidth = clampSidebarWidth(width);
    persistSidebarWidth(nextWidth);
    set({ workspaceSidebarWidth: nextWidth });
  },

  setToolbarLayout: (side) => {

    persist(side);

    set({ panelSide: side, toolbarLayout: side });

  },

}));



export const BUILD_PANEL_SIDE_LABELS: Record<BuildPanelSide, string> = {

  left: "Слева",

  right: "Справа",

};

export const BUILD_TOOLS_PLACEMENT_LABELS: Record<BuildToolsPlacement, string> = {
  top: "Верхняя панель",
  left: "Левая панель",
  compact: "Компактно",
  auto: "Авто",
};



/** @deprecated Use BUILD_PANEL_SIDE_LABELS */

export const BUILD_TOOLBAR_LAYOUT_LABELS = BUILD_PANEL_SIDE_LABELS;


