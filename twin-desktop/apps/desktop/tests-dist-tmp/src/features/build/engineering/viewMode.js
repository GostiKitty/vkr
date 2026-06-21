export const ENGINEERING_VISUALIZATION_LABELS = {
    plan: "План",
    heatmap: "Тепловая карта",
    schematic: "Инженерная схема",
    combined: "Комбинированный режим",
};
export const ENGINEERING_SCHEMATIC_STYLE_LABELS = {
    gost: "ГОСТ/схема",
    monochrome: "Монохромный чертёж",
};
export function engineeringModeUsesHeatmap(mode) {
    return mode === "heatmap" || mode === "combined";
}
export function engineeringModeUsesOverlay(mode) {
    return mode === "schematic" || mode === "combined";
}
export const PLAN_2D_RENDER_MODE_LABELS = {
    editor: "Редактор",
    drawing: "Чертёж",
};
