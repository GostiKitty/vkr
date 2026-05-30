import type { ReactNode } from "react";
import type { BuildingModel } from "../../../entities/geometry/types";
import { EQUIPMENT_TYPE_LABELS, PIPE_TYPE_LABELS } from "../../../entities/networks/types";
import { buildHeatingModelSnapshot, type SmartModelSnapshot } from "../../../core/networks/index";
import { buildNetworkConnectivityWarnings } from "../networks/connectivity";
import { getEquipmentDisplayName } from "../utils/entityLabels";

interface NetworkSystemsPanelProps {
  model: BuildingModel;
  snapshot: SmartModelSnapshot;
  onSetActiveScenario: (scenarioId: string | null) => void;
}

export function NetworkSystemsPanel({ model, snapshot, onSetActiveScenario }: NetworkSystemsPanelProps) {
  const heatingSnapshot = buildHeatingModelSnapshot(model);
  const activeEvents = snapshot.events.slice(0, 4);
  const hottestRooms = [...snapshot.roomStates]
    .sort((left, right) => right.temperatureC - left.temperatureC)
    .slice(0, 4);
  const sensorAlerts = snapshot.sensorStates.filter((sensor) => sensor.status !== "normal").slice(0, 4);
  const connectionSuggestions = snapshot.suggestedConnections.slice(0, 6);
  const connectivityWarnings = buildNetworkConnectivityWarnings(model).slice(0, 6);
  const equipmentLabel = (equipmentId: string) => getEquipmentDisplayName(equipmentId, model.equipment);

  return (
    <section className="ui-panel p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">Инженерные системы</p>
          <h3 className="truncate text-base font-semibold text-[color:var(--text-base)]">Состояние сетей и помещений</h3>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
          Сценарий
          <select
            value={model.activeScenarioId ?? ""}
            onChange={(event) => onSetActiveScenario(event.target.value || null)}
            className="max-w-[220px] rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm normal-case tracking-normal text-[color:var(--text-base)]"
          >
            {!model.scenarios.length ? <option value="">Нет сценариев</option> : null}
            {model.scenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Помещения" value={`${snapshot.roomStates.length}`} detail="в тепловой модели" />
        <MetricCard
          label="Теплосети"
          value={`${heatingSnapshot.systems.length}`}
          detail={`${heatingSnapshot.totalLength_m.toFixed(1)} м труб и ${heatingSnapshot.totalLoadW.toFixed(0)} Вт нагрузки`}
        />
        <MetricCard
          label="Воздуховоды"
          value={`${model.ducts.length}`}
          detail={`${snapshot.networkStates.filter((item) => item.kind === "duct").length} активных веток`}
        />
        <MetricCard label="События" value={`${activeEvents.length}`} detail={`${sensorAlerts.length} тревог по датчикам`} />
        <InsightCard title="Связность" subtitle="Неподключенные элементы и неполные контуры">
          {connectivityWarnings.length ? (
            <ul className="space-y-2">
              {connectivityWarnings.map((warning) => (
                <li key={warning.id} className="rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-sm text-[color:var(--warning-fg)]">
                  {warning.message}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Явных проблем связности на текущей модели не найдено." />
          )}
        </InsightCard>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <InsightCard title="Тепловой баланс" subtitle="Самые тёплые помещения">
          {hottestRooms.length ? (
            <ul className="space-y-2">
              {hottestRooms.map((room) => (
                <li key={room.roomId} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-[color:var(--text-base)]">{room.roomName}</span>
                    <span className="shrink-0">{room.temperatureC.toFixed(1)} °C</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-[color:var(--text-soft)]">
                    <span className="truncate">Уставка {room.setpointC.toFixed(1)} °C</span>
                    <span className="shrink-0">Q {formatSigned(room.netHeatFlowW)} Вт</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Добавьте помещения, чтобы получить тепловой профиль." />
          )}
        </InsightCard>

        <InsightCard title="Автосвязи" subtitle="Допустимые и отклонённые связи сетей">
          {connectionSuggestions.length ? (
            <ul className="space-y-2">
              {connectionSuggestions.map((item) => (
                <li
                  key={`${item.status}:${item.networkId}:${item.equipmentId}`}
                  className={`rounded-xl border px-3 py-2 ${connectionSuggestionClass(item.status)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-[color:var(--text-base)]">
                      {item.networkKind === "pipe" ? "Труба" : "Воздуховод"} → {equipmentLabel(item.equipmentId)}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${connectionSuggestionBadgeClass(item.status)}`}>
                      {connectionSuggestionLabel(item.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                    {item.status === "compatible"
                      ? "Связь допустима по инженерной логике и предложена по близости на плане."
                      : item.reason ?? "Связь отклонена: сеть и оборудование несовместимы."}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-[color:var(--text-soft)]">
                    Расстояние до трассы: {item.distance_m.toFixed(2)} м
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Ближайшие совместимые элементы будут показаны автоматически." />
          )}
        </InsightCard>

        <InsightCard title="Оборудование" subtitle="Сводка по инженерным элементам">
          <ul className="space-y-2">
            {summarizeEquipment(model).map((entry) => (
              <li key={entry.label} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2">
                <span className="min-w-0 truncate text-[color:var(--text-muted)]">{entry.label}</span>
                <span className="shrink-0 font-semibold text-[color:var(--text-base)]">{entry.value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 max-h-10 overflow-hidden text-xs leading-5 text-[color:var(--text-soft)]">
            Трубопроводы: {model.pipes.length ? [...new Set(model.pipes.map((pipe) => PIPE_TYPE_LABELS[pipe.type]))].join(", ") : "не заданы"}
          </p>
          <p className="mt-2 max-h-12 overflow-hidden text-xs leading-5 text-[color:var(--text-soft)]">
            Отопление: {heatingSnapshot.systems.length
              ? `${heatingSnapshot.systems.filter((system) => system.connected).length} из ${heatingSnapshot.systems.length} контуров связаны без висячих концов`
              : "контуры не сформированы"}
          </p>
        </InsightCard>

        <InsightCard title="Мониторинг" subtitle="Датчики и активные события">
          {sensorAlerts.length || activeEvents.length ? (
            <div className="space-y-2">
              {sensorAlerts.map((sensor) => (
                <div key={sensor.sensorId} className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-[color:var(--text-base)]">{sensor.label}</span>
                    <span className={statusClass(sensor.status)}>
                      {sensor.value == null ? "—" : `${sensor.value.toFixed(1)} ${sensor.unit}`}
                    </span>
                  </div>
                </div>
              ))}
              {activeEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-[color:var(--warning-fg)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold">{event.title}</span>
                    <span className="shrink-0 text-[11px] uppercase tracking-[0.18em]">{severityLabel(event.severity)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="После запуска сценариев здесь появятся датчики и события." />
          )}
        </InsightCard>
      </div>
    </section>
  );
}

function summarizeEquipment(model: BuildingModel): Array<{ label: string; value: string }> {
  const counts = new Map<string, number>();
  model.equipment.forEach((item) => {
    const label = EQUIPMENT_TYPE_LABELS[item.type];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  if (!counts.size) {
    return [{ label: "Оборудование", value: "0" }];
  }

  return [...counts.entries()].map(([label, count]) => ({ label, value: `${count}` }));
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="ui-metric flex min-h-[118px] flex-col justify-between rounded-[18px] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{label}</p>
      <div>
        <p className="mt-2 text-2xl font-semibold text-[color:var(--text-base)]">{value}</p>
        <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-[color:var(--text-soft)]">{detail}</p>
      </div>
    </article>
  );
}

function InsightCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className="ui-metric flex min-h-[260px] flex-col rounded-[18px] p-3">
      <div className="mb-3">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">{title}</p>
        <p className="text-xs text-[color:var(--text-soft)]">{subtitle}</p>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center rounded-[18px] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-4 text-sm text-[color:var(--text-soft)]">
      {text}
    </div>
  );
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}`;
}

function statusClass(status: SmartModelSnapshot["sensorStates"][number]["status"]): string {
  if (status === "alarm") {
    return "shrink-0 font-semibold text-[color:var(--danger-fg)]";
  }
  if (status === "warning") {
    return "shrink-0 font-semibold text-[color:var(--warning-fg)]";
  }
  return "shrink-0 font-semibold text-[color:var(--success-fg)]";
}

function severityLabel(severity: SmartModelSnapshot["events"][number]["severity"]): string {
  switch (severity) {
    case "critical":
      return "критично";
    case "warning":
      return "внимание";
    default:
      return "норма";
  }
}

function connectionSuggestionClass(status: SmartModelSnapshot["suggestedConnections"][number]["status"]): string {
  return status === "compatible"
    ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]/80"
    : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]/80";
}

function connectionSuggestionBadgeClass(status: SmartModelSnapshot["suggestedConnections"][number]["status"]): string {
  return status === "compatible"
    ? "bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
    : "bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]";
}

function connectionSuggestionLabel(status: SmartModelSnapshot["suggestedConnections"][number]["status"]): string {
  return status === "compatible" ? "допустимо" : "запрещено";
}

export default NetworkSystemsPanel;
