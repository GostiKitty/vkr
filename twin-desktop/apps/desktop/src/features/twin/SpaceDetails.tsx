import React from "react";
import { useTwinStore } from "../../entities/twin/twin.store";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { getSpaceDisplayName } from "../../shared/utils/roomNames";
import { formatTemperature } from "./twin.theme";

export function SpaceDetails() {
  const selectedId = useTwinStore((state) => state.selectedSpaceId);
  const twin = useTwinStore((state) => state.twin);
  const loading = useTwinStore((state) => state.loading);
  const frames = useTwinStore((state) => state.simulationFrames);
  const timeIndex = useTwinStore((state) => state.timeIndex);

  const space = selectedId ? twin?.spaces?.find((item) => item.id === selectedId) ?? null : null;
  const currentTemp = selectedId ? frames[timeIndex]?.temperatures[selectedId] : null;
  const spaceIndex = space ? twin?.spaces?.findIndex((item) => item.id === space.id) ?? 0 : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Детали помещения</h3>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-10 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : !space ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 transition-all duration-300">
          Выберите помещение, чтобы увидеть детали.
        </div>
      ) : (
        <dl className="divide-y divide-slate-100 text-sm text-slate-700">
          <InfoRow label="ID" value={space.id} />
          <InfoRow label="Название" value={getSpaceDisplayName(space, spaceIndex)} />
          <InfoRow label="Полное название" value={space.long_name ?? "—"} />
          <InfoRow label="Уровень" value={space.level ?? "—"} />
          <InfoRow label="Площадь" value={formatArea(space.area_m2)} />
          <InfoRow label="Объём" value={formatVolume(space.volume_m3)} />
          <InfoRow label="Температура" value={formatTemperature(currentTemp)} />
        </dl>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-right text-base text-slate-900">{value}</dd>
    </div>
  );
}

export default SpaceDetails;
