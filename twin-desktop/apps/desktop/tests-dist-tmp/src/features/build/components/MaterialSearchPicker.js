import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from "react";
import { MATERIAL_LIBRARY } from "../../../entities/material/types";
import { SearchListPicker } from "./SearchListPicker";
export function listMaterials() {
    return Object.values(MATERIAL_LIBRARY);
}
function materialAccentColor(materialId) {
    if (/wool|eps|xps|pur|foam|polystyrene|slag|acoustic/.test(materialId)) {
        return "var(--info-fg)";
    }
    if (/brick|concrete|reinforced|aerated|ceramic|silicate|hollow|steel|screed/.test(materialId)) {
        return "var(--warning-fg)";
    }
    if (/wood|osb|plywood|timber|parquet/.test(materialId)) {
        return "var(--success-fg)";
    }
    if (/glass|window|pvc/.test(materialId)) {
        return "var(--text-muted)";
    }
    return "var(--accent-base)";
}
function toMaterialOptions(materials) {
    return materials.map((material) => ({
        value: material.id,
        label: material.name,
        hint: `λ ${material.lambda_W_mK.toFixed(2)}`,
        accentColor: materialAccentColor(material.id),
    }));
}
export function MaterialSearchPicker({ value, materials = listMaterials(), onChange, placeholder = "Материал", compact = false, }) {
    const options = useMemo(() => toMaterialOptions(materials), [materials]);
    return (_jsx(SearchListPicker, { value: value, options: options, onChange: onChange, placeholder: placeholder, searchPlaceholder: "\u041D\u0430\u0439\u0442\u0438 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u2026", compact: compact }));
}
