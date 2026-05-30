import type { ReactNode } from "react";
import type { EquipmentType } from "../../../entities/networks/types";
import { renderEngineeringSymbol } from "../engineering/EngineeringSymbols";

export function renderEquipmentPlanSymbol(
  type: EquipmentType | string,
  cx: number,
  cy: number,
  options: { selected?: boolean; hovered?: boolean; warning?: boolean; error?: boolean; monochrome?: boolean } = {}
): ReactNode {
  const state = options.error
    ? "error"
    : options.warning
      ? "warning"
      : options.selected
        ? "selected"
        : options.hovered
          ? "hover"
          : "default";

  return renderEngineeringSymbol(type as EquipmentType, cx, cy, {
    state,
    monochrome: options.monochrome,
  });
}
