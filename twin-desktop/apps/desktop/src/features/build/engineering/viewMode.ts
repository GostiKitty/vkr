export type EngineeringVisualizationMode = "plan" | "heatmap" | "schematic" | "combined";

export type EngineeringSchematicStyle = "gost" | "monochrome";

export const ENGINEERING_VISUALIZATION_LABELS: Record<EngineeringVisualizationMode, string> = {
  plan: "План",
  heatmap: "Тепловая карта",
  schematic: "Инженерная схема",
  combined: "Комбинированный режим",
};

export const ENGINEERING_SCHEMATIC_STYLE_LABELS: Record<EngineeringSchematicStyle, string> = {
  gost: "ГОСТ/схема",
  monochrome: "Монохромный чертёж",
};

export function engineeringModeUsesHeatmap(mode: EngineeringVisualizationMode): boolean {
  return mode === "heatmap" || mode === "combined";
}

export function engineeringModeUsesOverlay(mode: EngineeringVisualizationMode): boolean {
  return mode === "schematic" || mode === "combined";
}

/**
 * Режим рендера 2D-плана: «Редактор» — текущий Canvas2D с handles, snap, draft;
 * «Чертёж» — read-only EngineeringPlanView с инженерным оформлением, рамкой и штампом.
 * Хранится отдельно от EngineeringVisualizationMode, чтобы не ломать существующую логику.
 */
export type Plan2DRenderMode = "editor" | "drawing";

export const PLAN_2D_RENDER_MODE_LABELS: Record<Plan2DRenderMode, string> = {
  editor: "Редактор",
  drawing: "Чертёж",
};

