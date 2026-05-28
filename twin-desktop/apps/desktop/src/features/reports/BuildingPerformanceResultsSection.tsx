import type { ReactNode } from "react";
import type { BuildingPerformanceDiagnostics, DerivedMetricValue } from "../../core/thermal/derived/types";
import { EngineeringCallout, EngineeringMetricTile, EngineeringSectionHeader, MetricInfoTooltip } from "../../shared/ui";
import { formatNumber } from "../../shared/utils/format";
import { resultsMetricInfo } from "./resultsMetricInfo";

interface BuildingPerformanceResultsSectionProps {
  diagnostics: BuildingPerformanceDiagnostics | null | undefined;
}

const NO_DATA = "нет данных";

function formatMetricValue(metric: DerivedMetricValue<number | null>, digits = 3): string {
  if (metric.value === null || !Number.isFinite(metric.value)) {
    return NO_DATA;
  }
  return formatNumber(metric.value, { maximumFractionDigits: digits });
}

function formatMetricWithUnit(metric: DerivedMetricValue<number | null>, digits = 3): ReactNode {
  const value = formatMetricValue(metric, digits);
  if (value === NO_DATA) {
    return NO_DATA;
  }
  return (
    <>
      {value}
      {metric.unit ? <span className="ml-1 text-base font-medium text-[color:var(--text-muted)]">{metric.unit}</span> : null}
    </>
  );
}

function MetricMeta({ metric }: { metric: DerivedMetricValue<unknown> }) {
  const notes = [...metric.assumptions, ...metric.warnings].filter(Boolean);
  if (!notes.length) {
    return null;
  }
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-[color:var(--text-soft)]">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

function PerformanceMetricCard({
  label,
  metric,
  infoKey,
  digits = 3,
}: {
  label: string;
  metric: DerivedMetricValue<number | null>;
  infoKey?: keyof typeof resultsMetricInfo;
  digits?: number;
}) {
  const info = infoKey ? resultsMetricInfo[infoKey] : undefined;
  return (
    <div className="ui-panel-muted rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">{label}</p>
        {info ? <MetricInfoTooltip {...info} /> : null}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-[color:var(--text-base)]">{formatMetricWithUnit(metric, digits)}</p>
      <MetricMeta metric={metric} />
    </div>
  );
}

function formatCompletenessStatus(status: BuildingPerformanceDiagnostics["dataRequirementsAudit"]["sections"][number]["status"]): {
  label: string;
  className: string;
} {
  switch (status) {
    case "complete":
      return {
        label: "полно",
        className:
          "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]",
      };
    case "fallback":
      return {
        label: "оценка по умолчанию",
        className:
          "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]",
      };
    case "partial":
      return {
        label: "частично",
        className:
          "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]",
      };
    default:
      return {
        label: "нет данных",
        className: "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]",
      };
  }
}

function DataCompletenessSection({
  section,
}: {
  section: BuildingPerformanceDiagnostics["dataRequirementsAudit"]["sections"][number];
}) {
  const badge = formatCompletenessStatus(section.status);
  const missingLines = section.missingFields.slice(0, 3);
  const warningLines = section.warnings.slice(0, 2);

  return (
    <div className="ui-panel-muted rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-base)]">{section.label}</p>
          <p className="mt-1 text-xs text-[color:var(--text-soft)]">
            {section.requiredCount > 0
              ? `${section.availableCount}/${section.requiredCount} обязательных полей`
              : "нет данных в текущем контуре"}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
      </div>
      {missingLines.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-[color:var(--text-muted)]">
          {missingLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {!missingLines.length && warningLines.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-[color:var(--text-muted)]">
          {warningLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {!missingLines.length && !warningLines.length && section.requiredCount === 0 ? (
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">{NO_DATA}</p>
      ) : null}
    </div>
  );
}

export function BuildingPerformanceResultsSection({ diagnostics }: BuildingPerformanceResultsSectionProps) {
  if (!diagnostics) {
    return (
      <section className="ui-panel-muted rounded-2xl p-4">
        <EngineeringSectionHeader
          title="Дополнительные инженерные показатели"
          subtitle="Дополнительные метрики формы здания, теплопотерь, комфорта и валидации модели."
        />
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">{NO_DATA} — выполните тепловой расчёт.</p>
      </section>
    );
  }

  const { heatLossBreakdown, co2, validation } = diagnostics;

  return (
    <section className="space-y-6" data-testid="building-performance-metrics">
      <EngineeringSectionHeader
        kicker="Дополнительно"
        title="Дополнительные инженерные показатели"
        subtitle="Показатели рассчитываются поверх основного RC-расчёта и не меняют его результат."
      />

      <EngineeringCallout variant="assumption" title="Контур расчёта">
        <p>
          Показатели рассчитываются поверх основного RC-прогона и не подменяют его результат. При отсутствии исходных данных
          отображается «{NO_DATA}» без подстановки фиктивных значений.
        </p>
      </EngineeringCallout>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Полнота исходных данных</h4>
          <MetricInfoTooltip
            title="Полнота исходных данных"
            meaning="UI отображает только audit-map из core: какие поля уже доступны, где используется fallback/default и что ещё нужно запросить у пользователя."
            formula="data completeness = f(metric requirements audit from core)"
            inputs={[
              "diagnostics.buildingPerformance.dataRequirementsAudit.metrics",
              "diagnostics.buildingPerformance.dataRequirementsAudit.sections",
            ]}
            calculatedIn="src/core/thermal/derived/buildingPerformanceMetrics.ts → buildDataRequirementsAudit(...)"
            notes={[
              "Интерфейс не рассчитывает формулы заново.",
              "При отсутствии входов показывается «нет данных», а не 0.",
            ]}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {diagnostics.dataRequirementsAudit.sections.map((section) => (
            <DataCompletenessSection key={section.id} section={section} />
          ))}
        </div>
        {diagnostics.dataRequirementsAudit.generatedWarnings.length ? (
          <EngineeringCallout variant="attention" title="Предупреждения по оценкам по умолчанию">
            <ul className="list-disc space-y-1 pl-4">
              {diagnostics.dataRequirementsAudit.generatedWarnings.slice(0, 4).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </EngineeringCallout>
        ) : null}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Форма здания</h4>
        <div className="grid gap-3 md:grid-cols-3">
          <PerformanceMetricCard label="K_compact" metric={diagnostics.compactness} infoKey="compactness" digits={3} />
          <PerformanceMetricCard label="WWR" metric={diagnostics.windowToWallRatio} infoKey="windowToWallRatio" digits={3} />
          <PerformanceMetricCard label="WWR, %" metric={diagnostics.windowToWallRatioPercent} infoKey="windowToWallRatio" digits={1} />
          <PerformanceMetricCard label="U_eq" metric={diagnostics.equivalentUValue} infoKey="equivalentUValue" digits={3} />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Теплопотери</h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <PerformanceMetricCard label="H_tr" metric={heatLossBreakdown.H_tr} infoKey="heatLossTransmission" digits={1} />
          <PerformanceMetricCard label="H_ve" metric={heatLossBreakdown.H_ve} infoKey="heatLossVentilation" digits={1} />
          <PerformanceMetricCard label="H_ψ" metric={heatLossBreakdown.H_psi} infoKey="heatLossLinearBridges" digits={1} />
          <PerformanceMetricCard label="H_χ" metric={heatLossBreakdown.H_chi} infoKey="heatLossPointBridges" digits={1} />
          <PerformanceMetricCard label="H_total" metric={heatLossBreakdown.H_total} infoKey="heatLossTotal" digits={1} />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Комфорт</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <PerformanceMetricCard label="DH_underheat (здание)" metric={diagnostics.degreeHoursUnderheat.building} infoKey="degreeHoursUnderheat" digits={1} />
          <PerformanceMetricCard label="DH_overheat (здание)" metric={diagnostics.degreeHoursOverheat.building} infoKey="degreeHoursOverheat" digits={1} />
        </div>
        {diagnostics.operativeTemperature.zones.length ? (
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--surface-base)] text-left text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-2 font-semibold">Помещение</th>
                  <th className="px-4 py-2 font-semibold">T_op</th>
                  <th className="px-4 py-2 font-semibold">T_air</th>
                  <th className="px-4 py-2 font-semibold">T_mrt</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.operativeTemperature.zones.map((zone) => (
                  <tr key={zone.zoneId} className="border-t border-[color:var(--border-soft)]">
                    <td className="px-4 py-2">{zone.zoneName}</td>
                    <td className="px-4 py-2">{formatMetricValue(zone.T_op)}</td>
                    <td className="px-4 py-2">{formatMetricValue(zone.T_air)}</td>
                    <td className="px-4 py-2">{formatMetricValue(zone.T_mrt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {diagnostics.surfaceTemperatureFactor.surfaces.length ? (
          <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--surface-base)] text-left text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-2 font-semibold">Конструкция</th>
                  <th className="px-4 py-2 font-semibold">f_Rsi</th>
                  <th className="px-4 py-2 font-semibold">τ_si</th>
                  <th className="px-4 py-2 font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.surfaceTemperatureFactor.surfaces.map((surface) => (
                  <tr key={surface.surfaceId} className="border-t border-[color:var(--border-soft)]">
                    <td className="px-4 py-2">{surface.label}</td>
                    <td className="px-4 py-2">{formatMetricValue(surface.f_Rsi)}</td>
                    <td className="px-4 py-2">{formatMetricValue(surface.tau_si_C)}</td>
                    <td className="px-4 py-2">{surface.status ?? NO_DATA}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Инженерные сети</h4>
        {diagnostics.pipeHeatLoss.pipes.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {diagnostics.pipeHeatLoss.pipes.map((pipe) => (
              <div key={pipe.pipeId} className="ui-panel-muted rounded-2xl p-4">
                <p className="text-sm font-semibold">{pipe.label}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <EngineeringMetricTile
                    label="Q_pipe_loss"
                    value={formatMetricValue(pipe.Q_pipe_loss_W)}
                    unit={pipe.Q_pipe_loss_W.unit ?? "Вт"}
                    hint="Дополнительный показатель"
                  />
                  <EngineeringMetricTile
                    label="Q_pipe_gain_to_room"
                    value={formatMetricValue(pipe.Q_pipe_gain_to_room_W)}
                    unit={pipe.Q_pipe_gain_to_room_W.unit ?? "Вт"}
                    hint="Только для труб внутри помещения"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--text-muted)]">{NO_DATA} — задайте трубопроводы с U_pipe, L и T_water.</p>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Экология</h4>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PerformanceMetricCard label="CO₂" metric={co2.CO2_kg} infoKey="co2Footprint" digits={1} />
          <PerformanceMetricCard label="CO₂" metric={co2.CO2_tonnes} infoKey="co2Footprint" digits={3} />
          <PerformanceMetricCard label="EF" metric={co2.emissionFactor} infoKey="co2Footprint" digits={3} />
          <div className="ui-panel-muted rounded-2xl p-4">
            <p className="text-sm font-semibold">Источник энергии</p>
            <p className="mt-2 text-lg font-semibold">{co2.energySource.value ?? NO_DATA}</p>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              E = {formatMetricValue(co2.energyKWh, 1)} {co2.energyKWh.unit ?? "кВт·ч"}
            </p>
            <MetricMeta metric={co2.CO2_kg} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Валидация цифрового двойника</h4>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <PerformanceMetricCard label="MBE" metric={validation.MBE_percent} infoKey="validationMbe" digits={2} />
          <PerformanceMetricCard label="CVRMSE" metric={validation.CVRMSE_percent} infoKey="validationCvrmse" digits={2} />
          <PerformanceMetricCard label="RMSE_T" metric={validation.RMSE_T_C} infoKey="validationRmse" digits={2} />
        </div>
      </div>
    </section>
  );
}

export default BuildingPerformanceResultsSection;
