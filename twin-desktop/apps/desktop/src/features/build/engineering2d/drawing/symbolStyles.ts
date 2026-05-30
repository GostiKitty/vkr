import { DRAWING_LINE } from "./drawingTheme";

/**
 * Стили для условных обозначений на чертеже. Совпадают с EQUIPMENT_STYLES,
 * вынесены отдельно для будущей расширяемой библиотеки символов.
 */
export const SYMBOL_INK = "#1f2937";
export const SYMBOL_FILL = "#ffffff";
export const SYMBOL_ACCENT = "#10745f";

export const SYMBOL_DEFAULTS = {
  stroke: SYMBOL_INK,
  fill: SYMBOL_FILL,
  strokeWidth: DRAWING_LINE.thin,
};

export const SYMBOL_VARIANTS = {
  riser: {
    radius: 8,
    stroke: SYMBOL_INK,
    fill: "#fce4d6",
    text: SYMBOL_INK,
  },
  outlet: {
    radius: 8,
    stroke: SYMBOL_INK,
    fill: "#dbe7f8",
    text: SYMBOL_INK,
  },
  meter: {
    width: 24,
    height: 16,
    radius: 3,
  },
  arrow: {
    headLength: 7,
    headWidth: 4.5,
    stroke: SYMBOL_INK,
  },
};
