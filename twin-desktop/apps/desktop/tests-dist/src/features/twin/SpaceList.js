import React, { useMemo, useState } from "react";
import { filterSpaces, sortSpacesByArea } from "../../entities/space";
import { useTwinStore } from "../../entities/twin/twin.store";
import { formatArea, formatVolume } from "../../shared/utils/format";
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
    const [sortDir, setSortDir] = useState("desc");
    const currentTemps = frames[timeIndex]?.temperatures ?? {};
    const filteredSpaces = useMemo(() => {
        const filtered = filterSpaces(spaces, search);
        return sortSpacesByArea(filtered, sortDir);
    }, [spaces, search, sortDir]);
    const handleSortToggle = () => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    return (<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Помещения</h3>
          <p className="text-xs text-slate-400">{loading ? "Загружаю…" : `${filteredSpaces.length} найдено`}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input type="search" placeholder="Найти помещение" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"/>
          <button type="button" onClick={handleSortToggle} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50">
            Площадь {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {loading ? (<div className="space-y-3">
          {skeletonItems.map((_, idx) => (<div key={idx} className="h-14 rounded-xl bg-slate-100 animate-pulse"/>))}
        </div>) : filteredSpaces.length === 0 ? (<div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 transition-all duration-300">
          Нет помещений, подходящих под запрос.
        </div>) : (<div className="flex flex-col gap-2">
          {filteredSpaces.map((space) => {
                const isSelected = space.id === selectedId;
                const temperature = currentTemps[space.id];
                const badgeColor = temperatureToColor(temperature);
                return (<button key={space.id} type="button" onClick={() => selectSpace(space.id)} className={`group w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${isSelected
                        ? "border-slate-900 bg-slate-900/5 text-slate-900 shadow"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"}`}>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="truncate">{space.name ?? "Без названия"}</span>
                  <span className="text-xs text-slate-500">{formatArea(space.area_m2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate">{space.level ?? "—"}</span>
                  <span>{formatVolume(space.volume_m3)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-slate-500">Температура</span>
                    <span className="h-3 w-10 rounded-full" style={{ background: badgeColor, boxShadow: "0 0 0 1px rgba(15,23,42,0.08)" }}/>
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{formatTemperature(temperature)}</span>
                </div>
              </button>);
            })}
        </div>)}
    </div>);
}
export default SpaceList;
