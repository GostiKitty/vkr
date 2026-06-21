import { create } from "zustand";
const STORAGE_KEY = "gnezdyshko-build-toolbar-layout";
const migrateStoredLayout = (stored) => {
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
function clampSidebarWidth(value) {
    if (!Number.isFinite(value)) {
        return WORKSPACE_SIDEBAR_WIDTH_DEFAULT;
    }
    return Math.min(WORKSPACE_SIDEBAR_WIDTH_MAX, Math.max(WORKSPACE_SIDEBAR_WIDTH_MIN, Math.round(value)));
}
const migrateStoredPlacement = (stored) => {
    if (stored === "top" || stored === "left" || stored === "compact" || stored === "auto") {
        return stored;
    }
    return "auto";
};
const readInitial = () => {
    if (typeof window === "undefined") {
        return "left";
    }
    return migrateStoredLayout(window.localStorage.getItem(STORAGE_KEY));
};
const persist = (value) => {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, value);
};
const readInitialToolsPlacement = () => {
    if (typeof window === "undefined") {
        return "auto";
    }
    return migrateStoredPlacement(window.localStorage.getItem(TOOLS_PLACEMENT_STORAGE_KEY));
};
const persistToolsPlacement = (value) => {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(TOOLS_PLACEMENT_STORAGE_KEY, value);
};
const readInitialSidebarWidth = () => {
    if (typeof window === "undefined") {
        return WORKSPACE_SIDEBAR_WIDTH_DEFAULT;
    }
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return clampSidebarWidth(stored || WORKSPACE_SIDEBAR_WIDTH_DEFAULT);
};
const persistSidebarWidth = (value) => {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(value)));
};
export const useBuildUiStore = create((set) => ({
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
export const BUILD_PANEL_SIDE_LABELS = {
    left: "Слева",
    right: "Справа",
};
export const BUILD_TOOLS_PLACEMENT_LABELS = {
    top: "Верхняя панель",
    left: "Левая панель",
    compact: "Компактно",
    auto: "Авто",
};
/** @deprecated Use BUILD_PANEL_SIDE_LABELS */
export const BUILD_TOOLBAR_LAYOUT_LABELS = BUILD_PANEL_SIDE_LABELS;
