import React from "react";
import type { Level } from "../../../entities/geometry/types";
import type { RoomProblem } from "../auto/detectRoomsFromWalls";

interface RoomProblemsPanelProps {
  problems: RoomProblem[];
  levels: Level[];
}

const RoomProblemsPanel: React.FC<RoomProblemsPanelProps> = ({ problems, levels }) => {
  const levelName = (id: string): string => levels.find((level) => level.id === id)?.name ?? id;

  return (
    <section className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 shadow-sm">
      <header className="mb-3 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Проблемы контуров</p>
        <p className="text-sm text-[color:var(--text-soft)]">Петли стен, которые не превратились в помещения</p>
      </header>
      {problems.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-4 py-3 text-sm text-[color:var(--success-fg)]">
          Ошибок не найдено.
        </div>
      ) : (
        <ul className="space-y-2 text-sm text-[color:var(--text-muted)]">
          {problems.map((problem, index) => (
            <li
              key={`${problem.levelId}-${index}`}
              className="min-h-[92px] rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-3 text-[color:var(--warning-fg)]"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--warning-fg)]">{levelName(problem.levelId)}</p>
              <p className="mt-2 leading-6">{problem.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default RoomProblemsPanel;
