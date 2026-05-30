import { useMemo } from "react";
import type { ConstructionLayer } from "../../../entities/geometry/types";
import { MaterialSearchPicker, listMaterials } from "./MaterialSearchPicker";

export interface ConstructionLayerEditorProps {
  title?: string;
  layers: ConstructionLayer[];
  hasCustomLayers: boolean;
  onUpdateLayer: (index: number, patch: Partial<ConstructionLayer>) => void;
  onAddLayer: () => void;
  onRemoveLayer: (index: number) => void;
  onReset?: () => void;
  resetLabel?: string;
  minLayers?: number;
}

export function ConstructionLayerEditor({
  title = "Состав",
  layers,
  hasCustomLayers,
  onUpdateLayer,
  onAddLayer,
  onRemoveLayer,
  onReset,
  resetLabel = "Вернуть по сборке",
  minLayers = 1,
}: ConstructionLayerEditorProps) {
  const materials = useMemo(() => listMaterials(), []);
  const totalThicknessMm = useMemo(
    () => Math.round(layers.reduce((sum, layer) => sum + (layer.thickness_m || 0), 0) * 1000),
    [layers]
  );

  return (
    <details
      open={hasCustomLayers}
      className="rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]"
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[color:var(--text-muted)]">
            {hasCustomLayers ? `${title} · вручную` : title}
          </span>
          <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[color:var(--text-soft)]">
            {layers.length} · {totalThicknessMm} мм
          </span>
        </div>
      </summary>

      <div className="space-y-1 border-t border-[color:var(--border-soft)] px-2.5 py-2.5">
        <div className="grid grid-cols-[20px_minmax(0,1fr)_72px_22px] gap-x-1.5 gap-y-1 px-0.5 pb-0.5">
          <span />
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Материал</span>
          <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">d, м</span>
          <span />
        </div>

        {layers.map((layer, index) => (
          <div
            key={`${layer.materialId}-${index}`}
            className="grid grid-cols-[20px_minmax(0,1fr)_72px_22px] items-start gap-x-1.5 gap-y-1 rounded-[10px] px-0.5 py-0.5 transition hover:bg-[color:var(--surface-muted)]/45"
          >
            <span className="pt-2.5 text-center text-[11px] font-medium tabular-nums text-[color:var(--text-soft)]">
              {index + 1}
            </span>
            <MaterialSearchPicker
              value={layer.materialId}
              materials={materials}
              onChange={(materialId) => onUpdateLayer(index, { materialId })}
              compact
            />
            <label className="relative block pt-0.5">
              <input
                type="number"
                step={0.005}
                min={0.001}
                max={2}
                value={layer.thickness_m}
                onChange={(event) => onUpdateLayer(index, { thickness_m: Number(event.target.value) })}
                className="ui-field w-full rounded-[11px] border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] py-1.5 pl-2 pr-5 text-right text-[12px] tabular-nums"
              />
              <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[10px] text-[color:var(--text-soft)]">
                м
              </span>
            </label>
            <button
              type="button"
              onClick={() => onRemoveLayer(index)}
              disabled={layers.length <= minLayers}
              className="pt-1.5 text-[16px] leading-none text-[color:var(--text-soft)] transition hover:text-[color:var(--danger-fg)] disabled:cursor-not-allowed disabled:opacity-25"
              title="Удалить слой"
              aria-label="Удалить слой"
            >
              ×
            </button>
          </div>
        ))}

        <div className="flex items-center justify-between gap-3 pt-1.5">
          <button
            type="button"
            onClick={onAddLayer}
            className="rounded-[10px] border border-dashed border-[color:var(--accent-muted)]/60 px-2.5 py-1.5 text-[12px] font-semibold text-[color:var(--accent-base)] transition hover:border-[color:var(--accent-muted)] hover:bg-[color:var(--accent-soft)]/40"
          >
            + слой
          </button>
          {hasCustomLayers && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="text-[12px] text-[color:var(--text-soft)] underline-offset-2 hover:text-[color:var(--text-muted)] hover:underline"
            >
              {resetLabel}
            </button>
          ) : null}
        </div>
      </div>
    </details>
  );
}
