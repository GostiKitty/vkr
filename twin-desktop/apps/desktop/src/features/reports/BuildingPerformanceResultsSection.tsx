import type { ReactNode } from "react";
import type { BuildingPerformanceDiagnostics, DerivedMetricValue } from "../../core/thermal/derived/types";
import { CollapsibleSection, EngineeringMetricTile, MetricInfoTooltip } from "../../shared/ui";
import { formatNumber } from "../../shared/utils/format";
import { formatSurfaceTemperatureFactorStatus } from "../../shared/utils/engineeringStatusLabels";
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
    </div>
  );
}

export function BuildingPerformanceResultsSection({ diagnostics }: BuildingPerformanceResultsSectionProps) {
  if (!diagnostics) {
    return (
      <section className="ui-panel-muted rounded-2xl p-4">
        <p className="text-sm text-[color:var(--text-muted)]">{NO_DATA} — выполните тепловой расчёт.</p>
      </section>
    );
  }

  const { heatLossBreakdown, co2 } = diagnostics;
  if (!heatLossBreakdown || !co2) {
    return (
      <section className="ui-panel-muted rounded-2xl p-4">
        <p className="text-sm text-[color:var(--text-muted)]">{NO_DATA} — выполните тепловой расчёт.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6" data-testid="building-performance-metrics">
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
          {diagnostics.degreeHoursUnderheat?.building ? (
            <PerformanceMetricCard label="DH_underheat (здание)" metric={diagnostics.degreeHoursUnderheat.building} infoKey="degreeHoursUnderheat" digits={1} />
          ) : null}
          {diagnostics.degreeHoursOverheat?.building ? (
            <PerformanceMetricCard label="DH_overheat (здание)" metric={diagnostics.degreeHoursOverheat.building} infoKey="degreeHoursOverheat" digits={1} />
          ) : null}
        </div>
        {diagnostics.operativeTemperature?.zones?.length ? (
          <CollapsibleSection title="Оперативная температура по помещениям">
            <div className="overflow-x-auto pt-3">
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
          </CollapsibleSection>
        ) : null}
        {diagnostics.surfaceTemperatureFactor?.surfaces?.length ? (
          <CollapsibleSection title="Температура внутренней поверхности конструкций">
            <div className="overflow-x-auto pt-3">
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
                      <td className="px-4 py-2">
                        {formatSurfaceTemperatureFactorStatus(surface.status, NO_DATA)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        ) : null}
      </div>

      {diagnostics.pipeHeatLoss?.pipes?.length ? (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Инженерные сети</h4>
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
        </div>
      ) : null}

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Экология</h4>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <PerformanceMetricCard label="CO₂" metric={co2.CO2_kg} infoKey="co2Footprint" digits={1} />
          <PerformanceMetricCard label="CO₂" metric={co2.CO2_tonnes} infoKey="co2Footprint" digits={3} />
          <PerformanceMetricCard label="EF" metric={co2.emissionFactor} infoKey="co2Footprint" digits={3} />
        </div>
      </div>

    </section>
  );
}

export function BuildingPerformanceValidationSection({
  diagnostics,
}: BuildingPerformanceResultsSectionProps) {
  if (!diagnostics) {
    return null;
  }

  if (!diagnostics?.validation) {
    return null;
  }

  const { validation } = diagnostics;

  return (
    <div className="space-y-3" data-testid="building-performance-validation">
      <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Валидация цифрового двойника</h4>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <PerformanceMetricCard label="MBE" metric={validation.MBE_percent} infoKey="validationMbe" digits={2} />
        <PerformanceMetricCard label="CVRMSE" metric={validation.CVRMSE_percent} infoKey="validationCvrmse" digits={2} />
        <PerformanceMetricCard label="RMSE_T" metric={validation.RMSE_T_C} infoKey="validationRmse" digits={2} />
      </div>
    </div>
  );
}

export default BuildingPerformanceResultsSection;
