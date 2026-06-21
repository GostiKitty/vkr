import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from "react";
import { listEnvelopePresets, } from "../../../entities/envelope/envelopePresets";
import { SearchListPicker } from "./SearchListPicker";
function presetAccentColor(kind) {
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
function presetHint(preset) {
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
function toPresetOptions(kind, presets) {
    const accent = presetAccentColor(kind);
    return presets.map((preset) => ({
        value: preset.id,
        label: preset.name,
        hint: presetHint(preset),
        accentColor: accent,
    }));
}
export function EnvelopePresetSearchPicker({ kind, value, onChange }) {
    const options = useMemo(() => toPresetOptions(kind, listEnvelopePresets(kind)), [kind]);
    return (_jsx(SearchListPicker, { value: value, options: options, onChange: onChange, placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0440\u0435\u0441\u0435\u0442", searchPlaceholder: "\u041D\u0430\u0439\u0442\u0438 \u043F\u0440\u0435\u0441\u0435\u0442\u2026" }));
}
