import { useMemo } from "react";
import { MATERIAL_LIBRARY, type Material } from "../../../entities/material/types";
import { SearchListPicker, type SearchListOption } from "./SearchListPicker";

export function listMaterials(): Material[] {
  return Object.values(MATERIAL_LIBRARY);
}

function materialAccentColor(materialId: string): string {
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

function toMaterialOptions(materials: Material[]): SearchListOption[] {
  return materials.map((material) => ({
    value: material.id,
    label: material.name,
    hint: `λ ${material.lambda_W_mK.toFixed(2)}`,
    accentColor: materialAccentColor(material.id),
  }));
}

export interface MaterialSearchPickerProps {
  value: string;
  materials?: Material[];
  onChange: (materialId: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export function MaterialSearchPicker({
  value,
  materials = listMaterials(),
  onChange,
  placeholder = "Материал",
  compact = false,
}: MaterialSearchPickerProps) {
  const options = useMemo(() => toMaterialOptions(materials), [materials]);

  return (
    <SearchListPicker
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Найти материал…"
      compact={compact}
    />
  );
}
