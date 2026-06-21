import type { EngineeringPipe } from "../../../../entities/engineering/types";
import { MEDIUM_PALETTE } from "./drawingTheme";

export interface PipeLabelInfo {
  text: string;
  short: string;
  ink: string;
  diameter: number;
}

const SYSTEM_PREFIX: Record<string, string> = {
  supply: "Т1",
  return: "Т2",
  dhw: "Т3",
  coldWater: "В1",
  drain: "К1",
  electric: "Э",
  signal: "С",
  airSupply: "П1",
  airExhaust: "В1",
};

export function buildPipeLabel(pipe: EngineeringPipe): PipeLabelInfo {
  const medium = pipe.medium;
  const palette = MEDIUM_PALETTE[medium];
  const diameter = Number.isFinite(pipe.diameter) ? Math.round(pipe.diameter) : 0;
  const diameterText = diameter > 0 ? `Ø${diameter}` : "";
  const prefix = SYSTEM_PREFIX[medium] ?? palette.short;
  return {
    text: diameterText ? `${prefix} ${diameterText}` : prefix,
    short: diameterText || palette.short,
    ink: palette.ink,
    diameter,
  };
}
