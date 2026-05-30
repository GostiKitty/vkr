import { useState } from "react";
import type {
  ThermalDisplayOptions,
  ThermalPreviewMode,
  ThermalSurfaceFieldMode,
} from "../thermal/displayOptions";

interface ThermalDisplayPanelProps {
  options: ThermalDisplayOptions;
  hasSimulation: boolean;
  onChange: (next: ThermalDisplayOptions) => void;
  className?: string;
}

type ThermalPanelSection = "environment" | "visualization";

const OUTDOOR_PRESETS = [-25, -15, -5, 0, 5];
const SURFACE_MODE_ITEMS: Array<{ key: ThermalSurfaceFieldMode; label: string }> = [
  { key: "surfaceTemperature", label: "Температура" },
  { key: "heatFlux", label: "Поток" },
  { key: "heatLoss", label: "Теплопот." },
  { key: "condensationRisk", label: "Конденсат" },
];

export default function ThermalDisplayPanel({
  options,
  hasSimulation,
  onChange,
  className,
}: ThermalDisplayPanelProps) {
  const [section, setSection] = useState<ThermalPanelSection>("environment");
  const patch = (next: Partial<ThermalDisplayOptions>) => onChange({ ...options, ...next });
  const outdoorLocked = options.mode === "transient" && hasSimulation;

  return (
    <section className={`ui-panel p-4 ${className ?? ""}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ui-kicker">Thermal Analysis</p>
          <h3 className="mt-1 text-sm font-semibold text-[color:var(--text-base)]">3D thermal visualization</h3>
        </div>
        <div className="ui-panel-muted inline-flex p-1">
          {([
            { key: "steady", label: "Steady" },
            { key: "transient", label: "Transient" },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => patch({ mode: item.key as ThermalPreviewMode })}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                options.mode === item.key
                  ? "ui-control ui-control-active bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                  : "ui-control-quiet"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ui-panel-muted mt-3 px-3 py-2.5 text-xs text-[color:var(--text-muted)]">
        {outdoorLocked
          ? "Outdoor temperature is inherited from the selected simulation frame."
          : hasSimulation
            ? "You can switch between the timeline frame and a manual steady preview."
            : "Parameters below drive a lightweight engineering preview without running the full simulation again."}
      </div>

      <div className="ui-panel-muted mt-4 inline-flex p-1">
        <SectionTab
          active={section === "environment"}
          label="Environment"
          onClick={() => setSection("environment")}
        />
        <SectionTab
          active={section === "visualization"}
          label="Visualization"
          onClick={() => setSection("visualization")}
        />
      </div>

      {section === "environment" ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <NumericField
              label="Outdoor air, °C"
              value={options.outdoorTemperatureC}
              step={0.5}
              disabled={outdoorLocked}
              onChange={(value) => patch({ outdoorTemperatureC: value })}
            />
            <NumericField
              label="Supply air, °C"
              value={options.supplyAirTemperatureC ?? options.outdoorTemperatureC}
              step={0.5}
              onChange={(value) => patch({ supplyAirTemperatureC: value })}
            />
            <NumericField
              label="Radiator power, x"
              value={options.radiatorPowerMultiplier}
              step={0.05}
              min={0}
              onChange={(value) => patch({ radiatorPowerMultiplier: clamp(value, 0, 3) })}
            />
            <NumericField
              label="Equipment heat, x"
              value={options.equipmentGainMultiplier}
              step={0.05}
              min={0}
              onChange={(value) => patch({ equipmentGainMultiplier: clamp(value, 0, 3) })}
            />
            <NumericField
              label="Lighting, W/m²"
              value={options.lightingGain_W_m2}
              step={0.2}
              min={0}
              onChange={(value) => patch({ lightingGain_W_m2: clamp(value, 0, 25) })}
            />
            <NumericField
              label="Occupancy, W/m²"
              value={options.occupancyGain_W_m2}
              step={0.2}
              min={0}
              onChange={(value) => patch({ occupancyGain_W_m2: clamp(value, 0, 20) })}
            />
            <NumericField
              label="Infiltration, ACH"
              value={options.infiltrationACH}
              step={0.05}
              min={0}
              onChange={(value) => patch({ infiltrationACH: clamp(value, 0, 4) })}
            />
            <NumericField
              label="Ventilation, ACH"
              value={options.ventilationACH}
              step={0.05}
              min={0}
              onChange={(value) => patch({ ventilationACH: clamp(value, 0, 6) })}
            />
            <NumericField
              label="Wind, x"
              value={options.windFactor}
              step={0.05}
              min={0.4}
              onChange={(value) => patch({ windFactor: clamp(value, 0.4, 2.5) })}
            />
            <NumericField
              label="Solar gains, x"
              value={options.solarGainFactor}
              step={0.05}
              min={0}
              onChange={(value) => patch({ solarGainFactor: clamp(value, 0, 2.5) })}
            />
          </div>

          {!outdoorLocked ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {OUTDOOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => patch({ outdoorTemperatureC: preset })}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    Math.abs(options.outdoorTemperatureC - preset) < 0.01
                      ? "ui-control ui-control-active bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                      : "ui-control text-[color:var(--text-muted)]"
                  }`}
                >
                  {preset > 0 ? `+${preset}` : preset} °C
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 rounded-[16px] border border-[color:var(--info-border)] bg-[color:var(--info-bg)] px-3 py-2.5 text-xs text-[color:var(--text-muted)]">
            The current RC solver still drives room air temperature and heat balance. The surface module only refines what the user sees on walls, floors, ceilings, windows, and doors.
          </div>
        </>
      ) : (
        <>
          {/* ── режим поля ── */}
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              Режим поля
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SURFACE_MODE_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => patch({ surfaceFieldMode: item.key, showSurfaceField: true })}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                    options.surfaceFieldMode === item.key
                      ? "ui-control ui-control-active bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                      : "ui-control text-[color:var(--text-muted)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── слои ── */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <ToggleRow
              label="Поверхностное поле"
              checked={options.showSurfaceField}
              onChange={(checked) => patch({ showSurfaceField: checked })}
            />
            <ToggleRow
              label="Источники тепла"
              checked={options.showHeatSources}
              onChange={(checked) => patch({ showHeatSources: checked })}
            />
            <ToggleRow
              label="Тепловые мостики"
              checked={options.showThermalBridges}
              onChange={(checked) => patch({ showThermalBridges: checked })}
            />
            <ToggleRow
              label="Поле пола (план)"
              checked={options.showFloorField}
              onChange={(checked) => patch({ showFloorField: checked })}
            />
            <ToggleRow
              label="Заливка стен (устар.)"
              checked={options.showWallSurfaces}
              onChange={(checked) => patch({ showWallSurfaces: checked })}
            />
            <ToggleRow
              label="Изолинии"
              checked={options.showContours}
              onChange={(checked) => patch({ showContours: checked })}
            />
            <ToggleRow
              label="Объёмный тинт"
              checked={options.showVolumeTint}
              onChange={(checked) => patch({ showVolumeTint: checked })}
            />
            <ToggleRow
              label="Легенда"
              checked={options.showLegend}
              onChange={(checked) => patch({ showLegend: checked })}
            />
            <ToggleRow
              label="Подсказки при наведении"
              checked={options.showTooltip}
              onChange={(checked) => patch({ showTooltip: checked })}
            />
          </div>

          {/* ── прозрачность overlay ── */}
          {options.showSurfaceField ? (
            <div className="mt-4">
              <label className="flex items-center justify-between text-xs font-semibold text-[color:var(--text-muted)]">
                <span>Прозрачность поля</span>
                <span className="tabular-nums text-[color:var(--text-base)]">
                  {Math.round(options.surfaceFieldOpacity * 100)} %
                </span>
              </label>
              <input
                type="range"
                min={10}
                max={95}
                step={1}
                value={Math.round(options.surfaceFieldOpacity * 100)}
                onChange={(e) => patch({ surfaceFieldOpacity: Number(e.target.value) / 100 })}
                className="mt-1.5 w-full accent-[color:var(--accent-base)]"
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-[color:var(--text-soft)]">
                <span>Прозрачнее</span>
                <span>Плотнее</span>
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-[16px] border border-[color:var(--info-border)] bg-[color:var(--info-bg)] px-3 py-2.5 text-xs text-[color:var(--text-muted)]">
            Поверхностное поле — стационарное патч-приближение над температурами RC-модели. Учитывает источники тепла, холодные зоны у окон, угловые пенальти и среднюю лучистую связь.
          </div>
        </>
      )}
    </section>
  );
}

function SectionTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? "ui-control ui-control-active bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "ui-control-quiet"
      }`}
    >
      {label}
    </button>
  );
}

function NumericField({
  label,
  value,
  step,
  min,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs font-semibold text-[color:var(--text-muted)]">
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) {
            return;
          }
          onChange(next);
        }}
        className="ui-field mt-1 w-full px-3 py-2 text-sm disabled:bg-[color:var(--surface-muted)] disabled:text-[color:var(--text-soft)]"
      />
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ui-panel-muted flex min-h-[44px] min-w-0 items-center justify-between gap-3 px-3 py-2.5 text-sm text-[color:var(--text-muted)]">
      <span className="min-w-0 flex-1 truncate leading-5">{label}</span>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full p-0.5 transition ${
          checked ? "bg-[color:var(--accent-base)]" : "bg-[color:var(--surface-strong)]"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-[color:var(--surface-elevated)] shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </label>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
