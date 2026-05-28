const ARCHITECTURE_TOOLS = ["select", "roomRect", "room", "wall", "roof", "slab", "door", "window", "erase"];
const NETWORK_TOOLS = [
    "select",
    "pipe",
    "duct",
    "equipment",
    "sensor",
    "engineeringEquipment",
    "engineeringPipe",
    "erase",
];
const DRAW_TOOLS = [
    "roomRect",
    "room",
    "wall",
    "roof",
    "slab",
    "door",
    "window",
    "pipe",
    "duct",
    "equipment",
    "sensor",
    "engineeringEquipment",
    "engineeringPipe",
];
export function modeFromViewport(viewport) {
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
export function allowedToolsForMode(mode) {
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
export function normalizeToolForMode(tool, mode) {
    const allowed = allowedToolsForMode(mode);
    if (allowed.includes(tool)) {
        return tool;
    }
    return mode === "networks" ? "pipe" : "select";
}
export function isDrawingTool(tool) {
    return DRAW_TOOLS.includes(tool);
}
export function workflowModeFromTool(tool) {
    if (tool === "move") {
        return "edit";
    }
    if (isDrawingTool(tool)) {
        return "draw";
    }
    return "navigation";
}
export function defaultToolForWorkflow(mode, currentTool) {
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
