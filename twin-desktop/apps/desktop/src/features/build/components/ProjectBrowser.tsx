import { useEffect, useMemo, useState } from "react";
import type { BuildingModel, Door, Room, Wall, Window } from "../../../entities/geometry/types";
import type { DuctNetwork, Equipment, PipeNetwork, SensorDevice } from "../../../entities/networks/types";
import type { Selection } from "../build.store";
import {
  describeLevel,
  describeRoom,
  getDuctDisplayLabel,
  getEquipmentDisplayLabel,
  getPipeDisplayLabel,
  getSensorDisplayLabel,
  getWallDisplayLabel,
  getWindowDisplayLabel,
  getDoorDisplayLabel,
} from "../utils/entityLabels";
import { firstDisplayText } from "../../../shared/utils/displayText";

interface ProjectBrowserProps {
  model: BuildingModel;
  activeLevelId: string | null;
  selection: Selection;
  embedded?: boolean;
  onSelect: (selection: Selection | null) => void;
  onLevelSelect: (levelId: string) => void;
  onFocusViewport: (selection?: Selection | null) => void;
}

type NodeKind = "room" | "wall" | "door" | "window" | "pipe" | "duct" | "equipment" | "sensor";

type TreeNodeMap = {
  room: Room;
  wall: Wall;
  door: Door;
  window: Window;
  pipe: PipeNetwork;
  duct: DuctNetwork;
  equipment: Equipment;
  sensor: SensorDevice;
};

const groupLabel: Record<NodeKind, string> = {
  room: "Помещения",
  wall: "Стены",
  door: "Двери",
  window: "Окна",
  pipe: "Трубы",
  duct: "Воздуховоды",
  equipment: "Оборудование",
  sensor: "Датчики",
};

function groupKey(levelId: string, kind: NodeKind) {
  return `${levelId}:${kind}`;
}

function resolveSelectionLevelId(model: BuildingModel, selection: Selection): string | null {
  if (!selection) {
    return null;
  }

  switch (selection.kind) {
    case "room":
      return model.rooms.find((room) => room.id === selection.id)?.levelId ?? null;
    case "wall":
      return model.walls.find((wall) => wall.id === selection.id)?.levelId ?? null;
    case "door": {
      const door = model.doors.find((entry) => entry.id === selection.id);
      if (!door?.anchor.wallId) {
        return null;
      }
      return model.walls.find((wall) => wall.id === door.anchor.wallId)?.levelId ?? null;
    }
    case "window": {
      const window = model.windows.find((entry) => entry.id === selection.id);
      if (!window?.anchor.wallId) {
        return null;
      }
      return model.walls.find((wall) => wall.id === window.anchor.wallId)?.levelId ?? null;
    }
    case "pipe":
      return model.pipes.find((pipe) => pipe.id === selection.id)?.levelId ?? null;
    case "duct":
      return model.ducts.find((duct) => duct.id === selection.id)?.levelId ?? null;
    case "equipment":
      return model.equipment.find((item) => item.id === selection.id)?.levelId ?? null;
    case "sensor":
      return model.sensors.find((item) => item.id === selection.id)?.levelId ?? null;
    default:
      return null;
  }
}

function isNodeKind(kind: string): kind is NodeKind {
  return kind in groupLabel;
}

export function ProjectBrowser({
  model,
  activeLevelId,
  selection,
  embedded = false,
  onSelect,
  onLevelSelect,
  onFocusViewport,
}: ProjectBrowserProps) {
  const tree = useMemo(
    () =>
      model.levels.map((level) => {
        const rooms = model.rooms.filter((room) => room.levelId === level.id);
        const walls = model.walls.filter((wall) => wall.levelId === level.id);
        const doors = model.doors.filter(
          (door) => door.anchor.wallId && walls.some((wall) => wall.id === door.anchor.wallId)
        );
        const windows = model.windows.filter(
          (window) => window.anchor.wallId && walls.some((wall) => wall.id === window.anchor.wallId)
        );
        const pipes = model.pipes.filter((pipe) => pipe.levelId === level.id);
        const ducts = model.ducts.filter((duct) => duct.levelId === level.id);
        const equipment = model.equipment.filter((item) => item.levelId === level.id);
        const sensors = model.sensors.filter((item) => item.levelId === level.id);
        return { level, rooms, walls, doors, windows, pipes, ducts, equipment, sensors };
      }),
    [model]
  );

  const handleFocus = (callback: () => void, target?: Selection | null) => {
    callback();
    onFocusViewport(target);
  };

  const isSelected = (target: Selection | null) =>
    Boolean(selection && target && selection.kind === target.kind && selection.id === target.id);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!selection || !isNodeKind(selection.kind)) {
      return;
    }
    const levelId = resolveSelectionLevelId(model, selection);
    if (!levelId) {
      return;
    }
    setExpandedLevels((prev) => {
      if (prev.has(levelId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(levelId);
      return next;
    });
    const key = groupKey(levelId, selection.kind);
    setExpandedGroups((prev) => {
      if (prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [model, selection]);

  const toggleGroup = (levelId: string, kind: NodeKind) => {
    const key = groupKey(levelId, kind);
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleLevel = (levelId: string) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) {
        next.delete(levelId);
      } else {
        next.add(levelId);
      }
      return next;
    });
  };

  return (
    <section className={embedded ? "min-w-0" : "ui-panel min-w-0 p-3.5"}>
      <header className={embedded ? "mb-2.5 min-w-0" : "mb-3 min-w-0"}>
        {!embedded ? <p className="ui-kicker">Проводник</p> : null}
        <button
          type="button"
          onClick={() => onFocusViewport(null)}
          className={`block w-full truncate text-left font-semibold text-[color:var(--text-base)] transition hover:text-[color:var(--accent-base)] ${
            embedded ? "text-[13px] leading-tight" : "mt-1 text-sm"
          }`}
        >
          {firstDisplayText([model.meta?.name], "Здание")}
        </button>
        <div className={`flex flex-wrap gap-1 ${embedded ? "mt-1.5" : "mt-2"}`}>
          <span className="ui-build-badge">{model.levels.length} ур.</span>
          <span className="ui-build-badge">{model.rooms.length} пом.</span>
          <span className="ui-build-badge">{model.walls.length} стен</span>
          <span className="ui-build-badge ui-build-badge--info">{model.pipes.length + model.ducts.length} сетей</span>
        </div>
      </header>
      <div className="space-y-2 text-sm">
        {tree.map(({ level, rooms, walls, doors, windows, pipes, ducts, equipment, sensors }) => {
          const levelExpanded = expandedLevels.has(level.id);
          const levelItemCount =
            rooms.length +
            walls.length +
            doors.length +
            windows.length +
            pipes.length +
            ducts.length +
            equipment.length +
            sensors.length;

          return (
            <div key={level.id} className="min-w-0 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]/70 p-1">
              <div className="flex min-w-0 items-stretch gap-0.5">
                <button
                  type="button"
                  aria-expanded={levelExpanded}
                  aria-label={levelExpanded ? "Свернуть уровень" : "Развернуть уровень"}
                  onClick={() => toggleLevel(level.id)}
                  className="ui-control-quiet flex w-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold text-[color:var(--text-soft)]"
                >
                  {levelExpanded ? "−" : "+"}
                </button>
                <button
                  type="button"
                  onClick={() => handleFocus(() => onLevelSelect(level.id), null)}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[12px] px-2 py-2 text-left text-xs font-semibold transition ${
                    activeLevelId === level.id
                      ? "border border-[color:var(--accent-muted)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)] shadow-[var(--shadow-control)]"
                      : "border border-transparent text-[color:var(--text-muted)] hover:bg-[color:var(--surface-elevated)]"
                  }`}
                >
                  <span className="truncate">{describeLevel(level, model.levels.findIndex((item) => item.id === level.id))}</span>
                  <span
                    className={`shrink-0 text-[10px] ${activeLevelId === level.id ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-soft)]"}`}
                  >
                    {levelItemCount} эл.
                  </span>
                </button>
              </div>
              {levelExpanded ? (
                <ul className="space-y-0.5 p-1.5 pt-1 text-[color:var(--text-muted)]">
                  {renderGroup(level.id, "room", rooms)}
                  {renderGroup(level.id, "wall", walls)}
                  {renderGroup(level.id, "door", doors)}
                  {renderGroup(level.id, "window", windows)}
                  {renderGroup(level.id, "pipe", pipes)}
                  {renderGroup(level.id, "duct", ducts)}
                  {renderGroup(level.id, "equipment", equipment)}
                  {renderGroup(level.id, "sensor", sensors)}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );

  function renderGroup<K extends NodeKind>(levelId: string, kind: K, items: TreeNodeMap[K][]) {
    if (!items.length) {
      return null;
    }

    const key = groupKey(levelId, kind);
    const expanded = expandedGroups.has(key);
    const hasSelectedChild = items.some((item) => isSelected({ kind, id: item.id }));

    return (
      <li className="min-w-0">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => toggleGroup(levelId, kind)}
          className={`flex w-full min-w-0 items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
            hasSelectedChild
              ? "bg-[color:var(--accent-soft)]/60 text-[color:var(--text-base)]"
              : "text-[color:var(--text-soft)] hover:bg-[color:var(--surface-elevated)] hover:text-[color:var(--text-muted)]"
          }`}
        >
          <span className="w-4 shrink-0 text-center text-sm leading-none text-[color:var(--text-muted)]">{expanded ? "−" : "+"}</span>
          <span className="min-w-0 flex-1 truncate">{groupLabel[kind]}</span>
          <span className="ui-build-badge shrink-0">{items.length}</span>
        </button>
        {expanded ? (
          <ul className="mt-0.5 space-y-0.5 border-l border-[color:var(--border-soft)] py-0.5 pl-2 ml-2">
            {items.map((item) => {
              const target = { kind, id: item.id } as Extract<Selection, { kind: K }>;
              const active = isSelected(target);
              const label = describeItem(kind, item);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      handleFocus(() => {
                        if ("levelId" in item) {
                          onLevelSelect(item.levelId);
                        }
                        onSelect(target);
                      }, target)
                    }
                    className={`w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-2 py-1.5 text-left text-xs font-medium transition ${
                      active
                        ? "ui-control-active bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
                        : "ui-control-quiet text-[color:var(--text-soft)] hover:text-[color:var(--text-muted)]"
                    }`}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  }

  function describeItem<K extends NodeKind>(kind: K, item: TreeNodeMap[K]): string {
    switch (kind) {
      case "room":
        return describeRoom(item as Room, model.rooms.findIndex((entry) => entry.id === item.id));
      case "wall":
        return getWallDisplayLabel(model, item.id);
      case "door":
        return getDoorDisplayLabel(model.doors, item.id);
      case "window":
        return getWindowDisplayLabel(model.windows, item.id);
      case "pipe":
        return getPipeDisplayLabel(model.pipes, item.id);
      case "duct":
        return getDuctDisplayLabel(model.ducts, item.id);
      case "equipment":
        return getEquipmentDisplayLabel(model.equipment, item.id);
      case "sensor":
        return getSensorDisplayLabel(model.sensors, item.id);
      default:
        return "Элемент";
    }
  }
}

export default ProjectBrowser;

