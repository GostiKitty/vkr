import { renderEngineeringSymbol } from "../engineering/EngineeringSymbols";
export function renderEquipmentPlanSymbol(type, cx, cy, options = {}) {
    const state = options.error
        ? "error"
        : options.warning
            ? "warning"
            : options.selected
                ? "selected"
                : options.hovered
                    ? "hover"
                    : "default";
    return renderEngineeringSymbol(type, cx, cy, {
        state,
        monochrome: options.monochrome,
    });
}
