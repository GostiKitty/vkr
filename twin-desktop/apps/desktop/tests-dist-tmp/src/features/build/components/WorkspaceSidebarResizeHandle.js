import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback } from "react";
import { WORKSPACE_SIDEBAR_WIDTH_DEFAULT, WORKSPACE_SIDEBAR_WIDTH_MAX, WORKSPACE_SIDEBAR_WIDTH_MIN, useBuildUiStore, } from "../../../entities/build/buildUi.store";
function clampSidebarWidth(value) {
    return Math.min(WORKSPACE_SIDEBAR_WIDTH_MAX, Math.max(WORKSPACE_SIDEBAR_WIDTH_MIN, Math.round(value)));
}
export function WorkspaceSidebarResizeHandle({ panelSide, enabled = true }) {
    const width = useBuildUiStore((state) => state.workspaceSidebarWidth);
    const setWorkspaceSidebarWidth = useBuildUiStore((state) => state.setWorkspaceSidebarWidth);
    const handlePointerDown = useCallback((event) => {
        if (!enabled) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = width;
        const handlePointerMove = (moveEvent) => {
            const delta = panelSide === "left" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
            setWorkspaceSidebarWidth(clampSidebarWidth(startWidth + delta));
        };
        const handlePointerUp = () => {
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerUp);
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
    }, [enabled, panelSide, setWorkspaceSidebarWidth, width]);
    const handleDoubleClick = useCallback(() => {
        setWorkspaceSidebarWidth(WORKSPACE_SIDEBAR_WIDTH_DEFAULT);
    }, [setWorkspaceSidebarWidth]);
    if (!enabled) {
        return null;
    }
    return (_jsxs("div", { role: "separator", "aria-orientation": "vertical", "aria-label": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0448\u0438\u0440\u0438\u043D\u0443 \u0431\u043E\u043A\u043E\u0432\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438", "aria-valuemin": WORKSPACE_SIDEBAR_WIDTH_MIN, "aria-valuemax": WORKSPACE_SIDEBAR_WIDTH_MAX, "aria-valuenow": width, title: "\u041F\u043E\u0442\u044F\u043D\u0438\u0442\u0435 \u0434\u043B\u044F \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0448\u0438\u0440\u0438\u043D\u044B. \u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u0449\u0435\u043B\u0447\u043E\u043A \u2014 \u0441\u0431\u0440\u043E\u0441.", onPointerDown: handlePointerDown, onDoubleClick: handleDoubleClick, className: `group absolute inset-y-0 z-30 hidden w-3 touch-none md:block ${panelSide === "left" ? "-right-1.5 cursor-col-resize" : "-left-1.5 cursor-col-resize"}`, children: [_jsx("div", { className: "absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-[color:var(--border-soft)] transition group-hover:bg-[color:var(--accent-muted)] group-active:bg-[color:var(--accent-base)]" }), _jsxs("div", { className: "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/95 px-0.5 py-1 opacity-0 shadow-sm transition group-hover:opacity-100", children: [_jsx("span", { className: "h-0.5 w-0.5 rounded-full bg-[color:var(--text-soft)]" }), _jsx("span", { className: "h-0.5 w-0.5 rounded-full bg-[color:var(--text-soft)]" }), _jsx("span", { className: "h-0.5 w-0.5 rounded-full bg-[color:var(--text-soft)]" })] })] }));
}
