import { useMemo, type ReactNode } from "react";
import type { BuildingModel } from "../../../entities/geometry/types";
import type { SmartModelSnapshot } from "../../../core/networks/index";
import {
  buildNetworkSystemsPresentation,
  type EventPresentation,
  type NetworkSuggestionPresentation,
  type NetworkWarningPresentation,
} from "../networks/presentation";

interface NetworkSystemsPanelProps {
  model: BuildingModel;
  snapshot: SmartModelSnapshot;
  onSetActiveScenario: (scenarioId: string | null) => void;
}

export function NetworkSystemsPanel({ model, snapshot, onSetActiveScenario }: NetworkSystemsPanelProps) {
  const presentation = useMemo(() => buildNetworkSystemsPresentation(model, snapshot), [model, snapshot]);
  const hasPipeNetworks = presentation.pipe.branchCount > 0 || presentation.pipe.systemCount > 0 || presentation.pipe.families.length > 0;
  const hasAirNetworks = presentation.duct.branchCount > 0;
  const hasDiagnostics = presentation.diagnostics.warnings.length > 0 || presentation.diagnostics.suggestions.length > 0;
  const hasMonitoring = presentation.monitoring.events.length > 0 || presentation.monitoring.sensorAlerts.length > 0;

  return (
    <section className="ui-panel p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">Сети</p>
          <h3 className="truncate text-base font-semibold text-[color:var(--text-base)]">Трубы и воздух</h3>
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

      {presentation.overview.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {presentation.overview.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <InsightCard title="Трубы" className={hasPipeNetworks ? "" : "hidden"}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill label="Подключено" value={`${presentation.pipe.connectedBranchCount}/${presentation.pipe.branchCount}`} />
            <StatPill label="Контуры" value={`${presentation.pipe.connectedSystemCount}/${presentation.pipe.systemCount}`} />
            <StatPill label="Нагрузка" value={formatPower(presentation.pipe.totalLoadW)} />
            <StatPill label="Δp" value={formatPa(presentation.pipe.estimatedPressureDropPa)} />
          </div>

          <SectionTitle className={presentation.pipe.families.length ? "mt-4" : "hidden"}>Семейства</SectionTitle>
          {presentation.pipe.families.length ? (
            <ul className="space-y-2">
              {presentation.pipe.families.map((family) => (
                <li
                  key={family.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--text-base)]">{family.label}</p>
                    <p className="text-xs text-[color:var(--text-soft)]">{formatMeters(family.totalLength_m)} м</p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-[color:var(--text-muted)]">
                    {family.connectedCount}/{family.count}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          <SectionTitle className={presentation.pipe.systems.length ? "mt-4" : "hidden"}>Контуры</SectionTitle>
          {presentation.pipe.systems.length ? (
            <ul className="space-y-2">
              {presentation.pipe.systems.map((system) => (
                <li
                  key={system.id}
                  className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-[color:var(--text-base)]">{system.name}</span>
                    <ToneBadge tone={system.connected ? "success" : "warning"}>
                      {system.connected ? "собран" : `${system.issueCount} замеч.`}
                    </ToneBadge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--text-soft)]">
                    <span>{system.branchCount} веток</span>
                    <span>{formatMeters(system.totalLength_m)} м</span>
                    <span>{formatPower(system.totalLoadW)}</span>
                    <span>потери {formatPower(system.totalHeatLossW)}</span>
                    <span>{system.roomCount} помещений</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </InsightCard>

        <InsightCard title="Воздух" className={hasAirNetworks ? "" : "hidden"}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill label="Подключено" value={`${presentation.duct.connectedBranchCount}/${presentation.duct.branchCount}`} />
            <StatPill label="Расход" value={`${formatNumber(presentation.duct.totalAirflow_m3_s, 2)} м³/с`} />
            <StatPill label="Скорость" value={`${formatNumber(presentation.duct.averageAirVelocity_m_s, 1)} м/с`} />
            <StatPill label="Δp" value={formatPa(presentation.duct.estimatedPressureDropPa)} />
          </div>

          <SectionTitle className={presentation.duct.branches.length ? "mt-4" : "hidden"}>Ветки</SectionTitle>
          {presentation.duct.branches.length ? (
            <ul className="space-y-2">
              {presentation.duct.branches.map((branch) => (
                <li
                  key={branch.id}
                  className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-[color:var(--text-base)]">{branch.label}</span>
                    <div className="shrink-0 text-right text-xs font-semibold text-[color:var(--text-soft)]">
                      <div>{formatNumber(branch.airflow_m3_s, 2)} м³/с</div>
                      {branch.estimatedPressureDropPa != null ? (
                        <div className={branchPressureClass(branch.estimatedPressureDropPa, branch.availablePressurePa)}>
                          {formatBranchPressure(branch.estimatedPressureDropPa, branch.availablePressurePa)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--text-soft)]">
                    <span>{branch.sectionLabel}</span>
                    <span>{formatMeters(branch.totalLength_m)} м</span>
                    <span>{formatNumber(branch.airVelocity_m_s, 1)} м/с</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </InsightCard>

        <InsightCard title="Диагностика" className={hasDiagnostics ? "" : "hidden"}>
          {presentation.diagnostics.warnings.length ? (
            <>
              <SectionTitle>Замечания</SectionTitle>
              <div className="space-y-2">
                {presentation.diagnostics.warnings.map((warning) => (
                  <WarningRow key={warning.id} warning={warning} />
                ))}
              </div>
            </>
          ) : null}

          {presentation.diagnostics.suggestions.length ? (
            <>
              <SectionTitle className={presentation.diagnostics.warnings.length ? "mt-4" : ""}>Связи</SectionTitle>
              <div className="space-y-2">
                {presentation.diagnostics.suggestions.map((suggestion) => (
                  <SuggestionRow key={suggestion.id} suggestion={suggestion} />
                ))}
              </div>
            </>
          ) : null}
        </InsightCard>

        <InsightCard title="Мониторинг" className={hasMonitoring ? "" : "hidden"}>
          <div className="grid gap-2 sm:grid-cols-2">
            <StatPill label="События" value={`${presentation.monitoring.events.length}`} />
            <StatPill label="Тревоги" value={`${presentation.monitoring.sensorAlerts.length}`} />
          </div>

          {presentation.monitoring.sensorAlerts.length ? (
            <>
              <SectionTitle className="mt-4">Датчики</SectionTitle>
              <div className="space-y-2">
                {presentation.monitoring.sensorAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2"
                  >
                    <span className="min-w-0 truncate font-semibold text-[color:var(--text-base)]">{alert.label}</span>
                    <span className={sensorAlertClass(alert.status)}>{alert.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {presentation.monitoring.events.length ? (
            <>
              <SectionTitle className={presentation.monitoring.sensorAlerts.length ? "mt-4" : ""}>События</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {presentation.monitoring.events.map((event) => (
                  <EventBadge key={event.id} event={event} />
                ))}
              </div>
            </>
          ) : null}
        </InsightCard>
      </div>
    </section>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="ui-metric flex min-h-[118px] flex-col justify-between rounded-[18px] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{label}</p>
      <div>
        <p className="mt-2 text-2xl font-semibold text-[color:var(--text-base)]">{value}</p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--text-soft)]">{detail}</p>
      </div>
    </article>
  );
}

function InsightCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`ui-metric flex min-h-[260px] flex-col rounded-[18px] p-3 ${className}`.trim()}>
      <div className="mb-3">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">{title}</p>
        {subtitle ? <p className="text-xs text-[color:var(--text-soft)]">{subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </article>
  );
}

function SectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)] ${className}`.trim()}>
      {children}
    </p>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--text-base)]">{value}</p>
    </div>
  );
}

function WarningRow({ warning }: { warning: NetworkWarningPresentation }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-sm ${
        warning.severity === "error"
          ? "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]/80 text-[color:var(--danger-fg)]"
          : "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"
      }`}
    >
      {warning.message}
    </div>
  );
}

function SuggestionRow({ suggestion }: { suggestion: NetworkSuggestionPresentation }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        suggestion.status === "compatible"
          ? "border-[color:var(--success-border)] bg-[color:var(--success-bg)]/80"
          : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]/80"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-semibold text-[color:var(--text-base)]">{suggestion.title}</span>
        <ToneBadge tone={suggestion.status === "compatible" ? "success" : "danger"}>
          {suggestion.status === "compatible" ? "допустимо" : "конфликт"}
        </ToneBadge>
      </div>
      <p className="mt-1 text-[11px] font-medium text-[color:var(--text-soft)]">
        {formatNumber(suggestion.distance_m, 2)} м
      </p>
    </div>
  );
}

function EventBadge({ event }: { event: EventPresentation }) {
  const toneClass =
    event.severity === "critical"
      ? "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]"
      : event.severity === "warning"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"
        : "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]";

  return <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClass}`}>{event.label}</span>;
}

function ToneBadge({ tone, children }: { tone: "success" | "warning" | "danger"; children: ReactNode }) {
  const className =
    tone === "success"
      ? "bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"
      : tone === "danger"
        ? "bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]"
        : "bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]";

  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

function sensorAlertClass(status: "warning" | "alarm"): string {
  return status === "alarm"
    ? "shrink-0 font-semibold text-[color:var(--danger-fg)]"
    : "shrink-0 font-semibold text-[color:var(--warning-fg)]";
}

function formatBranchPressure(estimatedPressureDropPa: number, availablePressurePa?: number): string {
  if (availablePressurePa != null && availablePressurePa > 0) {
    return `Δp ${formatPa(estimatedPressureDropPa)} / P ${formatPa(availablePressurePa)}`;
  }
  return `Δp ${formatPa(estimatedPressureDropPa)}`;
}

function branchPressureClass(estimatedPressureDropPa: number, availablePressurePa?: number): string {
  if (availablePressurePa != null && availablePressurePa > 0 && estimatedPressureDropPa > availablePressurePa * 1.05) {
    return "text-[color:var(--danger-fg)]";
  }
  if (availablePressurePa != null && availablePressurePa > 0 && estimatedPressureDropPa > availablePressurePa * 0.9) {
    return "text-[color:var(--warning-fg)]";
  }
  return "text-[color:var(--text-soft)]";
}

function formatPower(value: number): string {
  return value >= 1000 ? `${formatNumber(value / 1000, 1)} кВт` : `${formatNumber(value, 0)} Вт`;
}

function formatPa(value: number): string {
  return `${formatNumber(value, 0)} Па`;
}

function formatMeters(value: number): string {
  return formatNumber(value, 1);
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export default NetworkSystemsPanel;

