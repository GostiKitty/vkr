import { polygonArea, segmentLength } from "../../../entities/geometry/geom";
import type { BuildingModel } from "../../../entities/geometry/types";
import type { SmartModelSnapshot } from "../../../core/networks/index";
import { firstDisplayText } from "../../../shared/utils/displayText";

interface ModelSummaryPanelProps {
  model: BuildingModel;
  snapshot: SmartModelSnapshot;
  issuesCount: number;
  compact?: boolean;
}

export function ModelSummaryPanel({
  model,
  snapshot,
  issuesCount,
  compact = false,
}: ModelSummaryPanelProps) {
  const totalArea = model.rooms.reduce((sum, room) => sum + Math.abs(polygonArea(room.polygon)), 0);
  const wallLength = model.walls.reduce((sum, wall) => sum + segmentLength(wall.a, wall.b), 0);
  const networkCount = model.pipes.length + model.ducts.length;
  const activeEvents = snapshot.events.length;
  const sensorAlerts = snapshot.sensorStates.filter((sensor) => sensor.status !== "normal").length;
  const summaryCards = [
    {
      label: "Помещения",
      value: `${model.rooms.length}`,
      detail: `${totalArea.toFixed(1)} м²`,
    },
    {
      label: "Ограждения",
      value: `${model.walls.length}`,
      detail: `${wallLength.toFixed(1)} м стен`,
    },
    {
      label: "Сети",
      value: `${networkCount}`,
      detail: `${model.sensors.length} датчиков`,
    },
    {
      label: "Проверка",
      value: `${issuesCount}`,
      detail: activeEvents ? `${activeEvents} активных событий` : `${sensorAlerts} сигналов датчиков`,
    },
  ];

  return (
    <section className="ui-panel p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="ui-kicker">Сводка модели</p>
          <h3 className="truncate text-base font-semibold text-[color:var(--text-base)]">
            {firstDisplayText([model.meta?.name], "Текущий BIM-проект")}
          </h3>
        </div>
        <span className="ui-chip shrink-0 px-3 py-1 text-[11px] font-semibold">
          {model.levels.length} ур.
        </span>
      </header>

      <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-2"}`}>
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="ui-metric flex min-h-[112px] flex-col justify-between p-3.5"
          >
            <p className="ui-kicker truncate">{card.label}</p>
            <div className="mt-3">
              <p className="truncate text-2xl font-semibold text-[color:var(--text-base)]">{card.value}</p>
              <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-[color:var(--text-soft)]">{card.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ModelSummaryPanel;


