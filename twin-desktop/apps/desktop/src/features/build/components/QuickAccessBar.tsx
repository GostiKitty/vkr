import { BuildToolPalette, type BuildToolPaletteProps } from "./BuildToolPalette";

export type QuickAccessBarProps = Omit<BuildToolPaletteProps, "variant">;

export function QuickAccessBar(props: QuickAccessBarProps) {
  return <BuildToolPalette variant="top" {...props} />;
}

export default QuickAccessBar;
