import { useMemo, useState } from "react";
import Tooltip from "../../../shared/ui/Tooltip";
import { BuildToolButton } from "./BuildToolButton";
import type { EquipmentType } from "../../../entities/networks/types";
import type { WorkspaceMode } from "../../../entities/workspace/workspace.store";
import type { BuildTool } from "../build.store";

export type BuildViewportMode = WorkspaceMode;

type ToolButton = {
  id: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  tooltip?: {
    title: string;
    description: string;
  };
};

interface LeftToolbarProps {
  currentTool: BuildTool;
  activeViewport: BuildViewportMode;
  equipmentPreset: EquipmentType;
  hasHeatmap: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  orthogonalMode: boolean;
  adjacencyOverlay: boolean;
  loopDebugOverlay: boolean;
  showHelp: boolean;
  onToolChange: (tool: BuildTool) => void;
  onViewportChange: (mode: BuildViewportMode) => void;
  onEquipmentPresetChange: (type: EquipmentType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSnap: () => void;
  onToggleOrthogonal: () => void;
  onToggleAdjacency: () => void;
  onToggleLoopDebug: () => void;
  onToggleHelp: () => void;
  onZoomToFit: () => void;
  onImportIfc: () => void;
  onImportRevit: () => void;
  onExportPng: () => void;
  onCaptureViewSnapshot: () => void;
  onCreateProjectSnapshot: () => void;
  onOpenValidation: () => void;
  onOpenFormulas: () => void;
}

function ActionButton({ button }: { button: ToolButton }) {
  const control = (
    <BuildToolButton
      block
      variant={button.disabled ? "disabled" : button.active ? "active" : "default"}
      onClick={button.onClick}
      className="flex w-full items-center justify-between text-left"
    >
      <span className="truncate">{button.label}</span>
    </BuildToolButton>
  );

  if (!button.tooltip) {
    return control;
  }

  return (
    <Tooltip
      className="w-full"
      title={button.tooltip.title}
      description={button.disabled ? button.disabledReason ?? button.tooltip.description : button.tooltip.description}
    >
      {control}
    </Tooltip>
  );
}

function CollapsibleGroup({
  title,
  defaultOpen,
  accent,
  buttons,
}: {
  title: string;
  defaultOpen?: boolean;
  accent: string;
  buttons: ToolButton[];
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <section className="ui-panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-3 text-left"
      >
        <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${accent}`}>{title}</p>
        <span className="text-[color:var(--text-soft)]">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="grid gap-2 border-t border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-3">
          {buttons.map((button) => (
            <ActionButton key={button.id} button={button} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function LeftToolbar({
  activeViewport,
  hasHeatmap,
  canUndo,
  canRedo,
  snapEnabled,
  orthogonalMode,
  adjacencyOverlay,
  loopDebugOverlay,
  showHelp,
  onViewportChange,
  onUndo,
  onRedo,
  onToggleSnap,
  onToggleOrthogonal,
  onToggleAdjacency,
  onToggleLoopDebug,
  onToggleHelp,
  onZoomToFit,
  onImportIfc,
  onImportRevit,
  onExportPng,
  onCaptureViewSnapshot,
  onCreateProjectSnapshot,
  onOpenValidation,
  onOpenFormulas,
}: LeftToolbarProps) {
  const analysisButtons = useMemo<ToolButton[]>(
    () => [
      {
        id: "validation",
        label: "Проверка модели",
        onClick: onOpenValidation,
        tooltip: {
          title: "Проверка модели",
          description: "Список проблем модели и быстрых исправлений.",
        },
      },
      {
        id: "formulas",
        label: "Формулы",
        onClick: onOpenFormulas,
        tooltip: {
          title: "Формулы",
          description: "Панель инженерных формул и обозначений.",
        },
      },
      {
        id: "results",
        label: "Результаты",
        active: activeViewport === "results",
        onClick: () => onViewportChange("results"),
        tooltip: {
          title: "Результаты",
          description: "Тепловой расчет, сценарии, калибровка и анализ неопределенности.",
        },
      },
      {
        id: "help",
        label: showHelp ? "Подсказки: вкл." : "Подсказки: выкл.",
        active: showHelp,
        onClick: onToggleHelp,
        tooltip: {
          title: "Подсказки",
          description: "Короткие пояснения по текущему инструменту.",
        },
      },
    ],
    [activeViewport, onOpenFormulas, onOpenValidation, onToggleHelp, onViewportChange, showHelp]
  );

  const fileButtons = useMemo<ToolButton[]>(
    () => [
      {
        id: "import-ifc",
        label: "Импорт IFC",
        onClick: onImportIfc,
        tooltip: {
          title: "Импорт IFC",
          description: "Загрузить внешнюю BIM-модель в формате IFC.",
        },
      },
      {
        id: "import-rvt",
        label: "Импорт Revit",
        onClick: onImportRevit,
        tooltip: {
          title: "Импорт Revit",
          description: "Открыть сценарий импорта модели Revit через IFC.",
        },
      },
      {
        id: "capture-view",
        label: "Кадр вида",
        onClick: onCaptureViewSnapshot,
        tooltip: {
          title: "Кадр вида",
          description: "Сохранить изображение текущего плана или 3D-вида.",
        },
      },
      {
        id: "project-snapshot",
        label: "Версия проекта",
        onClick: onCreateProjectSnapshot,
        tooltip: {
          title: "Версия проекта",
          description: "Сохранить текущее состояние модели и результатов.",
        },
      },
      {
        id: "export-png",
        label: "Экспорт PNG",
        onClick: onExportPng,
        tooltip: {
          title: "Экспорт PNG",
          description: "Экспортировать активный вид в PNG.",
        },
      },
    ],
    [onCaptureViewSnapshot, onCreateProjectSnapshot, onExportPng, onImportIfc, onImportRevit]
  );

  const navigationButtons = useMemo<ToolButton[]>(
    () => [
      {
        id: "undo",
        label: "Отменить",
        disabled: !canUndo,
        disabledReason: "Нет действий для отмены.",
        onClick: onUndo,
        tooltip: {
          title: "Отменить",
          description: "Вернуть предыдущее состояние модели.",
        },
      },
      {
        id: "redo",
        label: "Повторить",
        disabled: !canRedo,
        disabledReason: "Нет действий для повтора.",
        onClick: onRedo,
        tooltip: {
          title: "Повторить",
          description: "Повторить отмененное действие.",
        },
      },
      {
        id: "fit",
        label: "Показать все",
        onClick: onZoomToFit,
        tooltip: {
          title: "Показать все",
          description: "Отцентрировать сцену и подобрать масштаб.",
        },
      },
      {
        id: "snap-grid",
        label: `Привязка: ${snapEnabled ? "вкл." : "выкл."}`,
        active: snapEnabled,
        onClick: onToggleSnap,
        tooltip: {
          title: "Привязка к сетке",
          description: "Фиксировать точки построения по шагу сетки.",
        },
      },
      {
        id: "ortho",
        label: `Ортогональность: ${orthogonalMode ? "вкл." : "выкл."}`,
        active: orthogonalMode,
        onClick: onToggleOrthogonal,
        tooltip: {
          title: "Ортогональный режим",
          description: "Ограничить построение углами 0° и 90°.",
        },
      },
      {
        id: "adjacency",
        label: `Соседства: ${adjacencyOverlay ? "показать" : "скрыть"}`,
        active: adjacencyOverlay,
        onClick: onToggleAdjacency,
        tooltip: {
          title: "Граф соседств",
          description: "Показать связи между соседними помещениями.",
        },
      },
      {
        id: "loops",
        label: `Контуры: ${loopDebugOverlay ? "вкл." : "выкл."}`,
        active: loopDebugOverlay,
        onClick: onToggleLoopDebug,
        tooltip: {
          title: "Контуры комнат",
          description: "Показать найденные циклы стен и вершины контуров.",
        },
      },
      {
        id: "heatmap",
        label: hasHeatmap ? "Теплокарта готова" : "Теплокарта недоступна",
        active: hasHeatmap && activeViewport === "results",
        disabled: !hasHeatmap,
        disabledReason: "Сначала выполните расчет, чтобы появилась теплокарта.",
        onClick: () => onViewportChange("results"),
        tooltip: {
          title: "Теплокарта",
          description: "Тепловое поле станет доступно после расчета.",
        },
      },
    ],
    [
      activeViewport,
      adjacencyOverlay,
      canRedo,
      canUndo,
      hasHeatmap,
      loopDebugOverlay,
      onRedo,
      onToggleAdjacency,
      onToggleLoopDebug,
      onToggleOrthogonal,
      onToggleSnap,
      onUndo,
      onViewportChange,
      onZoomToFit,
      orthogonalMode,
      snapEnabled,
    ]
  );

  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      <CollapsibleGroup title="Анализ" accent="text-[color:var(--success-fg)]" defaultOpen buttons={analysisButtons} />
      <CollapsibleGroup title="Файл" accent="text-[color:var(--warning-fg)]" buttons={fileButtons} />
      <CollapsibleGroup title="Навигация" accent="text-[color:var(--info-fg)]" defaultOpen buttons={navigationButtons} />
    </aside>
  );
}

export default LeftToolbar;
