import { useMemo, useState } from "react";
import { useBuildStore } from "../build.store";
import { useProjectStore } from "../../../entities/project/project.store";
import { firstDisplayText } from "../../../shared/utils/displayText";

export default function TelemetryPanel() {
  const [open, setOpen] = useState(false);
  const model = useBuildStore((state) => state.model);
  const projectId = useProjectStore((state) => state.projectId);
  const selection = useBuildStore((state) => state.selection);

  const stats = useMemo(
    () => ({
      rooms: model.rooms.length,
      walls: model.walls.length,
      openings: model.doors.length + model.windows.length,
      levels: model.levels.length,
    }),
    [model]
  );
  const projectLabel = useMemo(
    () =>
      firstDisplayText(
        [model.meta?.name, model.meta?.sourceProjectName],
        projectId?.startsWith("localdemo") || projectId?.startsWith("demo") || projectId?.includes("demo-video")
          ? "Демонстрационный дом"
          : "Текущий проект"
      ),
    [model.meta?.name, model.meta?.sourceProjectName, projectId]
  );

  return (
    <div className="fixed bottom-4 right-4 z-30 max-w-sm rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] shadow-2xl">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-semibold text-[color:var(--text-muted)]"
      >
        <span>Телеметрия проекта</span>
        <span className="text-xs text-[color:var(--text-soft)]">{open ? "Свернуть" : "Развернуть"}</span>
      </button>
      {open && (
        <div className="border-t border-[color:var(--border-soft)] px-4 py-3 text-xs text-[color:var(--text-muted)]">
          <p className="text-[10px] uppercase tracking-wide text-[color:var(--text-soft)]">Проект</p>
          <p className="mb-2 font-semibold text-[color:var(--text-base)]">{projectLabel}</p>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Уровни" value={stats.levels} />
            <Stat label="Помещения" value={stats.rooms} />
            <Stat label="Стены" value={stats.walls} />
            <Stat label="Проёмы" value={stats.openings} />
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-wide text-[color:var(--text-soft)]">Выбор</p>
          <p className="font-semibold text-[color:var(--text-base)]">{selection ? `${selection.kind} • ${selection.id}` : "—"}</p>
        </div>
      )}
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-2 py-1.5 text-center">
    <p className="text-[10px] uppercase tracking-wide text-[color:var(--text-soft)]">{label}</p>
    <p className="text-lg font-semibold text-[color:var(--text-base)]">{value}</p>
  </div>
);
