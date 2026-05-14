import type { EditorMode, EditorViewport } from "./types";

export type EditorTool =
  | "select"
  | "move"
  | "roomRect"
  | "room"
  | "wall"
  | "roof"
  | "slab"
  | "door"
  | "window"
  | "erase"
  | "pipe"
  | "duct"
  | "equipment"
  | "sensor";

export type View3DWorkflowMode = "navigation" | "edit" | "draw";

const ARCHITECTURE_TOOLS: readonly EditorTool[] = ["select", "roomRect", "room", "wall", "roof", "slab", "door", "window", "erase"];
const NETWORK_TOOLS: readonly EditorTool[] = ["select", "pipe", "duct", "equipment", "sensor", "erase"];
const DRAW_TOOLS: readonly EditorTool[] = ["roomRect", "room", "wall", "roof", "slab", "door", "window", "pipe", "duct", "equipment", "sensor"];

export function modeFromViewport(viewport: EditorViewport): EditorMode {
  if (viewport === "view3d") {
    return "view3d";
  }
  if (viewport === "networks") {
    return "networks";
  }
  if (viewport === "results") {
    return "results";
  }
  return "architecture";
}

export function allowedToolsForMode(mode: EditorMode): readonly EditorTool[] {
  switch (mode) {
    case "architecture":
      return ARCHITECTURE_TOOLS;
    case "networks":
      return NETWORK_TOOLS;
    case "view3d":
      return ["select", "move", ...ARCHITECTURE_TOOLS, ...NETWORK_TOOLS];
    case "results":
      return ["select"];
    default:
      return ["select"];
  }
}

export function normalizeToolForMode(tool: EditorTool, mode: EditorMode): EditorTool {
  const allowed = allowedToolsForMode(mode);
  if (allowed.includes(tool)) {
    return tool;
  }
  return mode === "networks" ? "pipe" : "select";
}

export function isDrawingTool(tool: EditorTool): boolean {
  return DRAW_TOOLS.includes(tool);
}

export function workflowModeFromTool(tool: EditorTool): View3DWorkflowMode {
  if (tool === "move") {
    return "edit";
  }
  if (isDrawingTool(tool)) {
    return "draw";
  }
  return "navigation";
}

export function defaultToolForWorkflow(mode: View3DWorkflowMode, currentTool: EditorTool): EditorTool {
  switch (mode) {
    case "navigation":
      return "select";
    case "edit":
      return "move";
    case "draw":
      return isDrawingTool(currentTool) ? currentTool : "wall";
    default:
      return "select";
  }
}
