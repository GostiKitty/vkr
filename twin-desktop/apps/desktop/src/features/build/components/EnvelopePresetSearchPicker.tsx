import { useMemo } from "react";
import {
  listEnvelopePresets,
  type EnvelopePreset,
  type EnvelopePresetKind,
} from "../../../entities/envelope/envelopePresets";
import { SearchListPicker, type SearchListOption } from "./SearchListPicker";

function presetAccentColor(kind: EnvelopePresetKind): string {
  switch (kind) {
    case "wall":
      return "var(--warning-fg)";
    case "slab":
      return "var(--success-fg)";
    case "roof":
      return "var(--info-fg)";
    case "window":
      return "var(--accent-base)";
    case "door":
      return "var(--text-muted)";
    default:
      return "var(--accent-base)";
  }
}

function presetHint(preset: EnvelopePreset): string | undefined {
  if (preset.runtimeU_W_m2K != null) {
    return `U ${preset.runtimeU_W_m2K.toFixed(2)}`;
  }
  if (preset.thickness_m != null && preset.thickness_m > 0) {
    return `${Math.round(preset.thickness_m * 1000)} мм`;
  }
  if (preset.category.trim()) {
    return preset.category;
  }
  return undefined;
}

function toPresetOptions(kind: EnvelopePresetKind, presets: EnvelopePreset[]): SearchListOption[] {
  const accent = presetAccentColor(kind);
  return presets.map((preset) => ({
    value: preset.id,
    label: preset.name,
    hint: presetHint(preset),
    accentColor: accent,
  }));
}

export interface EnvelopePresetSearchPickerProps {
  kind: EnvelopePresetKind;
  value: string;
  onChange: (presetId: string) => void;
}

export function EnvelopePresetSearchPicker({ kind, value, onChange }: EnvelopePresetSearchPickerProps) {
  const options = useMemo(() => toPresetOptions(kind, listEnvelopePresets(kind)), [kind]);

  return (
    <SearchListPicker
      value={value}
      options={options}
      onChange={onChange}
      placeholder="Выберите пресет"
      searchPlaceholder="Найти пресет…"
    />
  );
}
