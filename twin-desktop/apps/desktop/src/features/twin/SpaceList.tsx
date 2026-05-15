import { useMemo, useState } from "react";
import { filterSpaces, sortSpacesByArea, type SortDirection } from "../../entities/space";
import { useTwinStore } from "../../entities/twin/twin.store";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { getSpaceDisplayName } from "../../shared/utils/roomNames";
import { formatTemperature, temperatureToColor } from "./twin.theme";

const skeletonItems = Array.from({ length: 5 });

export function SpaceList() {
  const spaces = useTwinStore((state) => state.twin?.spaces ?? []);
  const selectedId = useTwinStore((state) => state.selectedSpaceId);
  const selectSpace = useTwinStore((state) => state.selectSpace);
  const loading = useTwinStore((state) => state.loading);
  const frames = useTwinStore((state) => state.simulationFrames);
  const timeIndex = useTwinStore((state) => state.timeIndex);

  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const currentTemps = frames[timeIndex]?.temperatures ?? {};

  const filteredSpaces = useMemo(() => {
    const filtered = filterSpaces(spaces, search);
    return sortSpacesByArea(filtered, sortDir);
  }, [spaces, search, sortDir]);

  const handleSortToggle = () => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));

  return (
    <div className="ui-panel p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Помещения</h3>
          <p className="text-xs text-[color:var(--text-soft)]">{loading ? "Загружаю…" : `${filteredSpaces.length} найдено`}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Найти помещение"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="ui-field w-full px-3 py-2 text-sm shadow-inner"
          />
          <button type="button" onClick={handleSortToggle} className="ui-control px-3 py-2 text-sm font-medium">
            Площадь {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {skeletonItems.map((_, idx) => (
            <div key={idx} className="h-14 animate-pulse rounded-xl bg-[color:var(--surface-strong)]" />
          ))}
        </div>
      ) : filteredSpaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-6 text-center text-sm text-[color:var(--text-muted)] transition-all duration-300">
          Нет помещений, подходящих под запрос.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredSpaces.map((space, index) => {
            const isSelected = space.id === selectedId;
            const temperature = currentTemps[space.id];
            const badgeColor = temperatureToColor(temperature);
            const displayName = getSpaceDisplayName(space, index);
            return (
              <button
                key={space.id}
                type="button"
                onClick={() => selectSpace(space.id)}
                className={`group w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-[color:var(--accent-base)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)] shadow-[var(--accent-glow)]"
                    : "border-[color:var(--border-soft)] bg-[color:var(--surface-base)] text-[color:var(--text-muted)] hover:border-[color:var(--accent-base)]/35 hover:bg-[color:var(--surface-muted)]"
                }`}
              >
                <div className="flex items-center justify-between text-sm font-semibold text-[color:var(--text-base)]">
                  <span className="truncate">{displayName}</span>
                  <span className="text-xs text-[color:var(--text-soft)]">{formatArea(space.area_m2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-[color:var(--text-soft)]">
                  <span className="truncate">{space.level ?? "—"}</span>
                  <span>{formatVolume(space.volume_m3)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-[color:var(--text-soft)]">Температура</span>
                    <span
                      className="h-3 w-10 rounded-full ring-1 ring-[color:var(--border-base)]"
                      style={{ background: badgeColor }}
                    />
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-[color:var(--text-base)]">{formatTemperature(temperature)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SpaceList;
