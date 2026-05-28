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
    <div className="ui-panel ui-hover-lift rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold text-[color:var(--text-base)]">Детали помещения</h3>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="ui-skeleton h-10 rounded-xl" />
          ))}
        </div>
      ) : !space ? (
        <div className="animate-ui-pop rounded-xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-6 text-center text-sm text-[color:var(--text-muted)]">
          Выберите помещение, чтобы увидеть детали.
        </div>
      ) : (
        <dl className="divide-y divide-[color:var(--border-soft)] text-sm text-[color:var(--text-muted)]">
          <InfoRow label="Код помещения" value={space.id} />
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
    <div className="flex items-center justify-between gap-6 py-3 transition-colors hover:bg-[color:var(--surface-muted)]/60">
      <dt className="text-sm font-medium text-[color:var(--text-soft)]">{label}</dt>
      <dd className="text-right text-base font-medium tabular-nums text-[color:var(--text-base)]">{value}</dd>
    </div>
  );
}

export default SpaceDetails;
