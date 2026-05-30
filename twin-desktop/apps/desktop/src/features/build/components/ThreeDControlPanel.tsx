import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { View3DWorkflowMode } from "../../../core/editor/modes";
import type { BuildViewerOptions } from "../view3d/viewerOptions";
import type { ThermalDisplayOptions } from "../thermal/displayOptions";
import type { BuildSceneDebugOptions, BuildScenePerformanceState } from "../view3d/sceneContracts";
import ThermalDisplayPanel from "./ThermalDisplayPanel";

interface ToolGuide {
  title: string;
  description: string;
  hint: string;
}

interface ThreeDControlPanelProps {
  activeLevelName: string;
  selectedElementLabel: string | null;
  workflowMode: View3DWorkflowMode;
  toolGuide: ToolGuide;
  canFocusSelection: boolean;
  onWorkflowModeChange: (mode: View3DWorkflowMode) => void;
  onZoomToFit: () => void;
  onResetView: () => void;
  onTopView: () => void;
  onFocusSelection: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
  viewer: BuildViewerOptions;
  onViewerChange: (patch: Partial<BuildViewerOptions>) => void;
  engineeringOverviewActive: boolean;
  onApplyEngineeringOverview: () => void;
  onResetEngineeringOverview: () => void;
  thermalDisplay: ThermalDisplayOptions;
  onThermalDisplayChange: (next: ThermalDisplayOptions) => void;
  hasSimulation: boolean;
  thermalPlaying: boolean;
  onToggleThermalPlaying: () => void;
  thermalTimeIndex: number;
  onThermalTimeIndexChange: (index: number) => void;
  thermalTimelineLength: number;
  thermalTimeLabel: string;
  thermalStatus: string;
  currentOutdoorTemperatureC: number;
  performance: BuildScenePerformanceState | null;
  showDevDebug: boolean;
  debug: BuildSceneDebugOptions;
  onDebugChange: (patch: Partial<BuildSceneDebugOptions>) => void;
  inspector: ReactNode;
  stableMode?: boolean;
}

type SectionKey = "context" | "view" | "thermal" | "inspector" | "debug";

const WORKFLOW_ITEMS: Array<{ key: View3DWorkflowMode; label: string }> = [
  { key: "navigation", label: "Навигация" },
  { key: "edit", label: "Редактирование" },
  { key: "draw", label: "Построение" },
];

const VIEWER_TOGGLES: Array<{ key: keyof BuildViewerOptions; label: string }> = [
  { key: "showRooms", label: "Помещения" },
  { key: "showWalls", label: "Стены" },
  { key: "showOpenings", label: "Проемы" },
  { key: "showNetworks", label: "Сети" },
  { key: "showEquipment", label: "Оборудование" },
  { key: "transparentWalls", label: "Прозрачные стены" },
];

const VIEW_PRESETS = [
  {
    id: "shell",
    label: "Оболочка",
    patch: {
      showRooms: true,
      showWalls: true,
      showOpenings: true,
      showNetworks: false,
      showEquipment: false,
      transparentWalls: false,
    } satisfies Partial<BuildViewerOptions>,
  },
  {
    id: "networks",
    label: "Сети",
    patch: {
      showRooms: false,
      showWalls: true,
      showOpenings: true,
      showNetworks: true,
      showEquipment: true,
      transparentWalls: true,
    } satisfies Partial<BuildViewerOptions>,
  },
  {
    id: "temperature",
    label: "Температура",
    patch: {
      showRooms: true,
      showWalls: true,
      showOpenings: true,
      showNetworks: false,
      showEquipment: false,
      transparentWalls: true,
    } satisfies Partial<BuildViewerOptions>,
  },
  {
    id: "equipment",
    label: "Оборудование",
    patch: {
      showRooms: true,
      showWalls: true,
      showOpenings: false,
      showNetworks: false,
      showEquipment: true,
      transparentWalls: true,
    } satisfies Partial<BuildViewerOptions>,
  },
] as const;

const DEBUG_TOGGLES: Array<{ key: keyof BuildSceneDebugOptions; label: string }> = [
  { key: "showWallJoinDebug", label: "Стыки стен" },
  { key: "showWallNormals", label: "Нормали стен" },
  { key: "showRoomContours", label: "Контуры помещений" },
  { key: "showThermalGrid", label: "Ячейки теплового поля" },
  { key: "showRadiatorInfluence", label: "Зоны радиаторов" },
  { key: "showCoolingZones", label: "Охлаждение у фасада" },
  { key: "showOpeningHosts", label: "Привязка проемов" },
];

export default function ThreeDControlPanel({
  activeLevelName,
  selectedElementLabel,
  workflowMode,
  toolGuide,
  canFocusSelection,
  onWorkflowModeChange,
  onZoomToFit,
  onResetView,
  onTopView,
  onFocusSelection,
  onToggleFullscreen,
  onClose,
  viewer,
  onViewerChange,
  engineeringOverviewActive,
  onApplyEngineeringOverview,
  onResetEngineeringOverview,
  thermalDisplay,
  onThermalDisplayChange,
  hasSimulation,
  thermalPlaying,
  onToggleThermalPlaying,
  thermalTimeIndex,
  onThermalTimeIndexChange,
  thermalTimelineLength,
  thermalTimeLabel,
  thermalStatus,
  currentOutdoorTemperatureC,
  performance,
  showDevDebug,
  debug,
  onDebugChange,
  inspector,
  stableMode = false,
}: ThreeDControlPanelProps) {
  const timelineActive = thermalDisplay.mode === "transient" && thermalTimelineLength > 0;
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    context: true,
    view: true,
    thermal: true,
    inspector: false,
    debug: false,
  });

  useEffect(() => {
    if (selectedElementLabel || workflowMode === "draw") {
      setOpenSections((prev) => (prev.inspector ? prev : { ...prev, inspector: true }));
    }
  }, [selectedElementLabel, workflowMode]);

  const visibleLayerCount = useMemo(
    () => VIEWER_TOGGLES.reduce((count, item) => count + (viewer[item.key] ? 1 : 0), 0),
    [viewer]
  );

  const toggleSection = (section: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (stableMode) {
    const thermalVisible =
      thermalDisplay.showSurfaceField ||
      thermalDisplay.showFloorField ||
      thermalDisplay.showContours ||
      thermalDisplay.showWallSurfaces;
    return (
      <aside className="ui-panel flex min-h-0 flex-col overflow-hidden rounded-[20px]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">3D</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-base)]">Объемная модель здания</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-control rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-elevated)]"
          >
            Свернуть
          </button>
        </div>

        <div className="ui-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <div className="space-y-3">
            <div className="ui-panel-muted rounded-[18px] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Контекст</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-base)]">{activeLevelName || "Все уровни"}</p>
              {selectedElementLabel ? (
                <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{selectedElementLabel}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ActionButton label="Фокус на модель" onClick={onZoomToFit} />
              <ActionButton label="Сбросить вид" onClick={onResetView} />
              <ActionButton label="Вид сверху" onClick={onTopView} />
              <ActionButton label="На весь экран" onClick={onToggleFullscreen} />
              <ActionButton label="Фокус на выборе" onClick={onFocusSelection} disabled={!canFocusSelection} />
            </div>

            <div className="grid gap-2">
              <ToggleCard
                label="Показать сети"
                checked={viewer.showNetworks}
                onChange={(checked) => onViewerChange({ showNetworks: checked })}
              />
              <ToggleCard
                label="Показать оборудование"
                checked={viewer.showEquipment}
                onChange={(checked) => onViewerChange({ showEquipment: checked })}
              />
              <ToggleCard
                label="Показать температуру"
                checked={thermalVisible}
                onChange={(checked) =>
                  onThermalDisplayChange({
                    ...thermalDisplay,
                    showSurfaceField: checked,
                    showFloorField: checked,
                    showContours: checked,
                    showWallSurfaces: false,
                  })
                }
              />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="ui-panel flex min-h-0 flex-col overflow-hidden rounded-[20px]">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-4 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">3D управление</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--text-base)]">Сцена и инженерный анализ</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ui-control rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-elevated)]"
        >
          Свернуть
        </button>
      </div>

      <div className="ui-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <PanelSection
          title="Контекст"
          summary={selectedElementLabel ?? toolGuide.title}
          open={openSections.context}
          onToggle={() => toggleSection("context")}
        >
          <div className="inline-flex rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-1">
            {WORKFLOW_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onWorkflowModeChange(item.key)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                  workflowMode === item.key
                    ? "border border-[color:var(--border-base)] bg-[color:var(--surface-elevated)] text-[color:var(--text-base)] shadow-[0_10px_18px_-16px_rgba(15,23,42,0.7)]"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--text-base)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            <InfoRow label="Уровень" value={activeLevelName} />
            <InfoRow label="Инструмент" value={toolGuide.title} />
            <InfoRow label="Выбор" value={selectedElementLabel ?? "Ничего не выбрано"} />
          </div>
          <p className="mt-3 text-sm text-[color:var(--text-muted)]">{toolGuide.description}</p>
          <p className="mt-2 text-xs text-[color:var(--text-soft)]">{toolGuide.hint}</p>
        </PanelSection>

        <PanelSection
          title="Вид и слои"
          summary={`${visibleLayerCount}/${VIEWER_TOGGLES.length} слоя`}
          open={openSections.view}
          onToggle={() => toggleSection("view")}
        >
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <ActionButton label="Фокус на модель" onClick={onZoomToFit} />
            <ActionButton label="Сбросить вид" onClick={onResetView} />
            <ActionButton label="Вид сверху" onClick={onTopView} />
            <ActionButton label="На весь экран" onClick={onToggleFullscreen} />
            <ActionButton label="Фокус на выборе" onClick={onFocusSelection} disabled={!canFocusSelection} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!stableMode ? (
            <button
              type="button"
              onClick={engineeringOverviewActive ? onResetEngineeringOverview : onApplyEngineeringOverview}
              title="Показать инженерные сети и оборудование в демонстрационном виде"
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                engineeringOverviewActive
                  ? "border-[color:var(--accent-base)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                  : "border-cyan-200/90 bg-cyan-50 text-cyan-900 hover:border-cyan-300 hover:bg-cyan-100"
              }`}
            >
              {engineeringOverviewActive ? "Сбросить обзор" : "Инженерный обзор"}
            </button>
            ) : null}
            {VIEW_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onViewerChange(preset.patch)}
                className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-base)]"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {VIEWER_TOGGLES.map((item) => (
              <ToggleCard
                key={item.key}
                label={item.label}
                checked={Boolean(viewer[item.key])}
                onChange={(checked) => onViewerChange({ [item.key]: checked })}
              />
            ))}
          </div>
        </PanelSection>

        <PanelSection
          title="Температура"
          summary={timelineActive ? thermalTimeLabel : `${currentOutdoorTemperatureC.toFixed(1)} °C`}
          open={openSections.thermal}
          onToggle={() => toggleSection("thermal")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-base)]">
                {timelineActive ? "Расчетный таймлайн" : "Стационарный режим"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                {timelineActive
                  ? "Сцена использует активный кадр расчета."
                  : "Параметры управляют демонстрационным температурным полем в 3D."}
              </p>
            </div>
            {timelineActive ? (
              <button
                type="button"
                onClick={onToggleThermalPlaying}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  thermalPlaying ? "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]" : "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                }`}
              >
                {thermalPlaying ? "Пауза" : "Пуск"}
              </button>
            ) : (
              <span className="rounded-full bg-[color:var(--info-bg)] px-3 py-1 text-[11px] font-semibold text-[color:var(--info-fg)]">
                Ручное управление
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <InfoRow label="Наружный воздух" value={`${currentOutdoorTemperatureC.toFixed(1)} °C`} />
            <InfoRow label="Источник" value={timelineActive ? "Кадр расчета" : "Параметры отображения"} />
          </div>
          {timelineActive ? (
            <>
              <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--text-soft)]">
                <span>{thermalTimeLabel}</span>
                <span>
                  Шаг {thermalTimeIndex + 1}/{thermalTimelineLength}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(thermalTimelineLength - 1, 0)}
                value={thermalTimeIndex}
                onChange={(event) => onThermalTimeIndexChange(Number(event.target.value))}
                className="mt-2 w-full accent-[color:var(--warning-fg)]"
              />
            </>
          ) : null}
          <div className="mt-3 rounded-[14px] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-[11px] text-[color:var(--text-muted)]">
            {thermalStatus}
          </div>
          <div className="mt-3">
            <ThermalDisplayPanel
              options={thermalDisplay}
              hasSimulation={hasSimulation}
              onChange={onThermalDisplayChange}
            />
          </div>
        </PanelSection>

        <PanelSection
          title="Свойства"
          summary={selectedElementLabel ?? toolGuide.title}
          open={openSections.inspector}
          onToggle={() => toggleSection("inspector")}
        >
          {inspector}
        </PanelSection>

        {showDevDebug ? (
          <PanelSection
            title="Отладка"
            summary={performance ? `${performance.fps.toFixed(0)} FPS` : "off"}
            open={openSections.debug}
            onToggle={() => toggleSection("debug")}
          >
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoRow label="FPS" value={performance ? performance.fps.toFixed(0) : "—"} />
              <InfoRow label="Кадр, мс" value={performance ? performance.frameMs.toFixed(1) : "—"} />
            </div>
            <div className="mt-3 grid gap-2">
              {DEBUG_TOGGLES.map((item) => (
                <ToggleCard
                  key={item.key}
                  label={item.label}
                  checked={debug[item.key]}
                  onChange={(checked) => onDebugChange({ [item.key]: checked })}
                />
              ))}
            </div>
          </PanelSection>
        ) : null}
      </div>
    </aside>
  );
}

function PanelSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="ui-panel-muted mb-3 overflow-hidden rounded-[18px] last:mb-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[color:var(--surface-elevated)]/55"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">{title}</p>
          <p className="mt-1 truncate text-sm text-[color:var(--text-muted)]">{summary}</p>
        </div>
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] text-sm text-[color:var(--text-soft)] transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          ⌃
        </span>
      </button>
      {open ? <div className="border-t border-[color:var(--border-soft)] px-4 py-4">{children}</div> : null}
    </section>
  );
}

function ActionButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2">
      <span className="text-sm font-medium text-[color:var(--text-muted)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-[color:var(--accent-base)]" : "bg-[color:var(--surface-strong)]"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-[color:var(--surface-elevated)] transition ${checked ? "translate-x-5" : "translate-x-1"}`}
        />
      </button>
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm">
      <span className="text-[color:var(--text-soft)]">{label}</span>
      <span className="font-semibold text-[color:var(--text-base)]">{value}</span>
    </div>
  );
}
