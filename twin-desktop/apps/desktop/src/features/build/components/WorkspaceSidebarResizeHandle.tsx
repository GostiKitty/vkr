import { useCallback, type PointerEvent } from "react";
import type { BuildPanelSide } from "../../../entities/build/buildUi.store";
import {
  WORKSPACE_SIDEBAR_WIDTH_DEFAULT,
  WORKSPACE_SIDEBAR_WIDTH_MAX,
  WORKSPACE_SIDEBAR_WIDTH_MIN,
  useBuildUiStore,
} from "../../../entities/build/buildUi.store";

function clampSidebarWidth(value: number): number {
  return Math.min(WORKSPACE_SIDEBAR_WIDTH_MAX, Math.max(WORKSPACE_SIDEBAR_WIDTH_MIN, Math.round(value)));
}

interface WorkspaceSidebarResizeHandleProps {
  panelSide: BuildPanelSide;
  enabled?: boolean;
}

export function WorkspaceSidebarResizeHandle({ panelSide, enabled = true }: WorkspaceSidebarResizeHandleProps) {
  const width = useBuildUiStore((state) => state.workspaceSidebarWidth);
  const setWorkspaceSidebarWidth = useBuildUiStore((state) => state.setWorkspaceSidebarWidth);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!enabled) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = width;

      const handlePointerMove = (moveEvent: PointerEvent) => {
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
    },
    [enabled, panelSide, setWorkspaceSidebarWidth, width]
  );

  const handleDoubleClick = useCallback(() => {
    setWorkspaceSidebarWidth(WORKSPACE_SIDEBAR_WIDTH_DEFAULT);
  }, [setWorkspaceSidebarWidth]);

  if (!enabled) {
    return null;
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Изменить ширину боковой панели"
      aria-valuemin={WORKSPACE_SIDEBAR_WIDTH_MIN}
      aria-valuemax={WORKSPACE_SIDEBAR_WIDTH_MAX}
      aria-valuenow={width}
      title="Потяните для изменения ширины. Двойной щелчок — сброс."
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      className={`group absolute inset-y-0 z-30 hidden w-3 touch-none md:block ${
        panelSide === "left" ? "-right-1.5 cursor-col-resize" : "-left-1.5 cursor-col-resize"
      }`}
    >
      <div className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-[color:var(--border-soft)] transition group-hover:bg-[color:var(--accent-muted)] group-active:bg-[color:var(--accent-base)]" />
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/95 px-0.5 py-1 opacity-0 shadow-sm transition group-hover:opacity-100">
        <span className="h-0.5 w-0.5 rounded-full bg-[color:var(--text-soft)]" />
        <span className="h-0.5 w-0.5 rounded-full bg-[color:var(--text-soft)]" />
        <span className="h-0.5 w-0.5 rounded-full bg-[color:var(--text-soft)]" />
      </div>
    </div>
  );
}
