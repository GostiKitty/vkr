/**
 * ThermalCalculationConsistencyReport
 *
 * Engineering dev/debug panel — numerical verification of the thermal pipeline.
 * Shows exact numbers, not just "✅". Highlights mismatches without masking with UI colors.
 *
 * Temporarily hidden from production UI. Accessible via debug console or dev mode.
 */

import { useMemo } from "react";
import { buildThermalConsistencyReport, type CheckStatus, type ConsistencyItem } from "../../core/thermal/consistencyCheck";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { useBuildStore } from "../build/build.store";
import { buildThermalOptionsFromWorkflow } from "../build/thermal/workflowThermalOptions";
import { getResultSyncState } from "../../shared/utils/modelSync";

// ---------------------------------------------------------------------------
// Status badge helpers — intentionally raw colors, not CSS vars,
// so even if the theme is broken, mismatches stay visible.
// ---------------------------------------------------------------------------

function statusColor(status: CheckStatus): { bg: string; text: string; border: string } {
  switch (status) {
    case "PASS":
      return { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" };
    case "WARN":
      return { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" };
    case "FAIL":
      return { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" };
    default:
      return { bg: "#f0f9ff", text: "#0c4a6e", border: "#7dd3fc" };
  }
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const { bg, text, border } = statusColor(status);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        minWidth: 44,
        textAlign: "center",
      }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "6px 12px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        borderBottom: "1px solid #e5e7eb",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      style={{
        padding: "6px 12px",
        fontSize: 12,
        fontFamily: mono ? "'Courier New', monospace" : undefined,
        color: "#374151",
        borderBottom: "1px solid #f3f4f6",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 8,
          borderBottom: "2px solid #e5e7eb",
          paddingBottom: 4,
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function KvRow({ label, value, unit, note }: { label: string; value: React.ReactNode; unit?: string; note?: string }) {
  return (
    <tr>
      <Td>
        <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
      </Td>
      <Td mono>
        <span style={{ color: "#111827" }}>
          {value}
          {unit ? <span style={{ color: "#9ca3af", marginLeft: 4, fontSize: 11 }}>{unit}</span> : null}
        </span>
      </Td>
      {note !== undefined ? (
        <Td>
          <span style={{ color: "#9ca3af", fontSize: 11 }}>{note}</span>
        </Td>
      ) : null}
    </tr>
  );
}

function fmt(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Invariant table
// ---------------------------------------------------------------------------

function InvariantRow({ item }: { item: ConsistencyItem }) {
  const { bg } = statusColor(item.status);
  return (
    <tr style={{ background: item.status === "FAIL" ? "#fff1f2" : item.status === "WARN" ? "#fffbeb" : undefined }}>
      <Td mono>
        <span style={{ color: "#6b7280", fontSize: 11 }}>{item.id}</span>
      </Td>
      <Td>
        <StatusBadge status={item.status} />
      </Td>
      <Td>{item.label}</Td>
      <Td mono>
        {item.actual !== undefined ? (
          <span style={{ color: "#111827" }}>
            {fmt(item.actual, 3)} {item.unit ?? ""}
          </span>
        ) : "—"}
      </Td>
      <Td mono>
        {item.expected !== undefined ? (
          <span style={{ color: "#6b7280" }}>
            {fmt(item.expected, 3)} {item.unit ?? ""}
          </span>
        ) : "—"}
      </Td>
      <Td mono>
        {item.differenceAbs !== undefined ? (
          <span style={{ color: Math.abs(item.differenceAbs) < 1e-6 ? "#6b7280" : "#b45309" }}>
            {fmtPct(item.differencePercent)} ({fmt(item.differenceAbs, 2)} {item.unit ?? ""})
          </span>
        ) : "—"}
      </Td>
      <Td>
        <span style={{ color: "#6b7280", fontSize: 11, maxWidth: 300, display: "block", whiteSpace: "normal" }}>{item.explanation}</span>
      </Td>
      <Td>
        <span style={{ display: "block", width: 16, height: 16, borderRadius: 4, background: bg, border: "1px solid #d1d5db" }} />
      </Td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ThermalCalculationConsistencyReport() {
  const result = useTwinStore((state) => state.lastThermalResult);
  const resultBinding = useTwinStore((state) => state.lastThermalResultBinding);
  const monteCarloResult = useWorkflowStore((state) => state.monteCarloResult);
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const buildModel = useBuildStore((state) => state.model);
  const projectKey = useBuildStore((state) => state.projectKey);
  const modelRevision = useBuildStore((state) => state.modelRevision);

  const resultState = getResultSyncState(Boolean(result), resultBinding, projectKey, modelRevision);
  const activeOptions = useMemo(() => buildThermalOptionsFromWorkflow(scenarioConfig), [scenarioConfig]);

  const report = useMemo(() => {
    if (!result || resultState !== "current") return null;
    return buildThermalConsistencyReport(result, activeOptions, buildModel, monteCarloResult ?? null);
  }, [result, resultState, activeOptions, buildModel, monteCarloResult]);

  const containerStyle: React.CSSProperties = {
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontSize: 13,
    color: "#374151",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 24,
    margin: "0 0 16px 0",
    overflowX: "auto",
  };

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    marginBottom: 8,
  };

  if (!result) {
    return (
      <div style={containerStyle}>
        <p style={{ color: "#9ca3af" }}>Нет результата расчёта. Запустите базовый расчёт на шаге «Расчёт».</p>
      </div>
    );
  }

  if (resultState === "stale") {
    return (
      <div style={containerStyle}>
        <p style={{ color: "#b45309" }}>⚠ Результат устарел — модель изменилась после расчёта. Пересчитайте для актуального отчёта.</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={containerStyle}>
        <p style={{ color: "#9ca3af" }}>Отчёт недоступен.</p>
      </div>
    );
  }

  const { geometry, heatLossCoefficients: hlc, designDeltaT, peakReconstruction: pr, componentSum: cs, roomSum: rs, energyIntegration: ei, monteCarlo: mc, invariants, assumptions, fallbacks, overallStatus } = report;

  const headerColor = statusColor(overallStatus);

  return (
    <div style={containerStyle} data-testid="thermal-consistency-report">
      {/* Header */}
      <div
        style={{
          background: headerColor.bg,
          border: `1px solid ${headerColor.border}`,
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <StatusBadge status={overallStatus} />
        <span style={{ fontWeight: 700, fontSize: 14, color: headerColor.text }}>
          Численная верификация теплового расчёта
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
          {new Date(report.generatedAt).toLocaleTimeString("ru-RU")}
        </span>
      </div>

      {/* 1. Geometry */}
      <Section title="1. Геометрия модели">
        <table style={tableStyle}>
          <tbody>
            <KvRow label="Помещений в BuildingModel" value={geometry.roomCount} unit="шт" />
            <KvRow label="Зон в diagnostics" value={geometry.zoneCount} unit="шт"
              note={geometry.roomCount !== geometry.zoneCount ? "⚠ не совпадает с BuildingModel.rooms.length" : undefined} />
            <KvRow label="Отапливаемая площадь (из diagnostics.building)" value={fmt(geometry.heatedAreaM2)} unit="м²" />
            <KvRow label="Отапливаемый объём (Σ площадь×высота)" value={fmt(geometry.heatedVolumeM3)} unit="м³"
              note="расчёт по BuildingModel.rooms × уровни" />
            <KvRow label="Эквивалентная площадь окон (H_win / U_ок≈1.8)" value={fmt(geometry.windowAreaEquivM2)} unit="м²"
              note="оценка обратно из потерь" />
            <KvRow label="Эквивалентная площадь дверей (H_door / U_дв≈1.5)" value={fmt(geometry.doorAreaEquivM2)} unit="м²"
              note="оценка обратно из потерь" />
          </tbody>
        </table>
      </Section>

      {/* 2. Heat Loss Coefficients */}
      <Section title="2. Коэффициенты теплопотерь, Вт/К">
        <table style={tableStyle}>
          <tbody>
            <KvRow label="H_tr (трансмиссия, derived от RC)" value={fmt(hlc.H_tr_W_K, 1)} unit="Вт/К"
              note="Σ conductance_W_K наружных рёбер RC" />
            <KvRow label="H_inf (инфильтрация, derived от RC)" value={fmt(hlc.H_inf_W_K, 1)} unit="Вт/К"
              note="Σ infiltrationConductance_W_K зон" />
            <KvRow label="H_ve (вентиляция, derived от RC)" value={fmt(hlc.H_ve_W_K, 1)} unit="Вт/К"
              note="Σ ventilationConductance_W_K зон" />
            <KvRow label="H_total = H_tr + H_inf + H_ve" value={fmt(hlc.H_total_W_K, 1)} unit="Вт/К" />
            <KvRow label="H_opaque (из среза, totalOpaqueLossW / ΔT)" value={fmt(hlc.H_opaque_slice_W_K, 1)} unit="Вт/К"
              note="диагностический срез, не суммарный" />
            <KvRow label="H_window (из среза)" value={fmt(hlc.H_window_slice_W_K, 1)} unit="Вт/К" />
            <KvRow label="H_door (из среза)" value={fmt(hlc.H_door_slice_W_K, 1)} unit="Вт/К" />
          </tbody>
        </table>
      </Section>

      {/* 3. Design ΔT */}
      <Section title="3. Расчётный перепад температур">
        <table style={tableStyle}>
          <tbody>
            <KvRow label="T_setpoint (дневная уставка)" value={fmt(designDeltaT.T_setpoint_day_C, 1)} unit="°C" />
            <KvRow label="T_out (реф. наружная из diagnostics.building.referenceOutdoorC)" value={fmt(designDeltaT.T_outdoor_ref_C, 1)} unit="°C" />
            <KvRow label="ΔT по уставке" value={fmt(designDeltaT.deltaT_K, 1)} unit="К" />
            <KvRow label="T_avg по зонам в реф. срезе" value={fmt(designDeltaT.T_avg_zone_C, 2)} unit="°C"
              note="среднее по зонам diagnostics, может отличаться от уставки" />
            <KvRow label="ΔT по средней зональной T" value={fmt(designDeltaT.deltaT_avg_zone_K, 2)} unit="К" />
          </tbody>
        </table>
      </Section>

      {/* 4. Peak Loss Reconstruction */}
      <Section title="4. Реконструкция пиковых потерь">
        <table style={tableStyle}>
          <tbody>
            <KvRow label="peakLoadKW из RC (solver)" value={fmt(pr.peakLoadKW_solver)} unit="кВт"
              note="max_t Σ Q_z(t) из RC timeline" />
            <KvRow label="Q_stat = H_total × ΔT_уставка / 1000" value={fmt(pr.Q_stat_H_setpoint_kW)} unit="кВт"
              note="без учёта внутренних поступлений" />
            <KvRow label="Q_int (внутренние поступления)" value={fmt(pr.Q_internal_gains_kW)} unit="кВт" />
            <KvRow label="Q_stat − Q_int (лучшая стационарная оценка)" value={fmt(pr.Q_best_reconstructed_kW)} unit="кВт" />
            <KvRow
              label="Δ (пик RC) − Q_stat_no_gains"
              value={
                <span style={{ color: Math.abs(pr.differenceStatPercent ?? 0) > 20 ? "#991b1b" : "#374151" }}>
                  {fmt(pr.differenceStatKW)} ({fmtPct(pr.differenceStatPercent)})
                </span>
              }
              unit="кВт"
            />
            <KvRow
              label="Δ (пик RC) − Q_stat_with_gains"
              value={
                <span style={{ color: Math.abs(pr.differenceWithGainsPercent ?? 0) > 20 ? "#991b1b" : "#374151" }}>
                  {fmt(pr.differenceWithGainsKW)} ({fmtPct(pr.differenceWithGainsPercent)})
                </span>
              }
              unit="кВт"
            />
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
          {pr.explanation}
        </p>
      </Section>

      {/* 5. Component Sum */}
      <Section title="5. Баланс компонент потерь в пиковом срезе">
        <table style={tableStyle}>
          <tbody>
            <KvRow label="Q_opaque (непрозрачные)" value={fmt(cs.Q_opaque_W / 1000)} unit="кВт" />
            <KvRow label="Q_window (окна)" value={fmt(cs.Q_window_W / 1000)} unit="кВт" />
            <KvRow label="Q_door (двери)" value={fmt(cs.Q_door_W / 1000)} unit="кВт" />
            <KvRow label="Q_transmission = opaque + window + door" value={fmt(cs.Q_transmission_W / 1000)} unit="кВт" />
            <KvRow label="Q_infiltration" value={fmt(cs.Q_infiltration_W / 1000)} unit="кВт" />
            <KvRow label="Q_ventilation (мех.)" value={fmt(cs.Q_ventilation_W / 1000)} unit="кВт" />
            <KvRow label="Q_air_exchange = infil + vent" value={fmt(cs.Q_air_exchange_W / 1000)} unit="кВт" />
            <KvRow label="Σ всех компонент" value={fmt(cs.sumAllComponentsW / 1000)} unit="кВт" />
            <KvRow
              label="totalLossW (из diagnostics.building)"
              value={fmt(cs.reportedTotalLossW / 1000)}
              unit="кВт"
            />
            <KvRow
              label="Δ (сумма − totalLossW)"
              value={
                <span style={{ color: Math.abs(cs.differencePercent) > 2 ? "#991b1b" : "#374151" }}>
                  {fmt(cs.differenceW / 1000)} ({fmtPct(cs.differencePercent)})
                </span>
              }
              unit="кВт"
            />
          </tbody>
        </table>
      </Section>

      {/* 6. Room Sum */}
      <Section title="6. Сумма потерь по зонам">
        <table style={tableStyle}>
          <tbody>
            <KvRow label="Число зон в diagnostics" value={rs.zoneCount} unit="шт" />
            <KvRow label="Σ totalLossW по зонам" value={fmt(rs.sumZoneLossW / 1000)} unit="кВт" />
            <KvRow label="diagnostics.building.totalLossW" value={fmt(rs.buildingTotalLossW / 1000)} unit="кВт" />
            <KvRow
              label="Δ"
              value={
                <span style={{ color: Math.abs(rs.differencePercent) > 5 ? "#991b1b" : "#374151" }}>
                  {fmt(rs.differenceW / 1000)} ({fmtPct(rs.differencePercent)})
                </span>
              }
              unit="кВт"
              note={Math.abs(rs.differencePercent) > 5 ? "⚠ расхождение > 5% — зоны с T_i < T_n не включаются в losses" : undefined}
            />
          </tbody>
        </table>
      </Section>

      {/* 7. Energy Integration */}
      <Section title="7. Верификация энергии по timeline">
        <table style={tableStyle}>
          <tbody>
            <KvRow label="Шагов в timeline" value={ei.timelineStepCount} unit="шт" />
            <KvRow label="Медианный dt" value={fmt(ei.medianDtSeconds, 0)} unit="с" />
            <KvRow label="Длина периода" value={fmt(ei.durationHours, 1)} unit="ч" />
            <KvRow label="Мин. суммарная мощность" value={fmt(ei.minTotalPowerKW)} unit="кВт" />
            <KvRow label="Макс. суммарная мощность" value={fmt(ei.maxTotalPowerKW)} unit="кВт" />
            <KvRow label="Вычисленная энергия из timeline (Σ Q·Δt / 3.6M)" value={fmt(ei.recomputedEnergyKWh, 3)} unit="кВт·ч" />
            <KvRow label="summary.totalEnergyKWh" value={fmt(ei.reportedSummaryEnergyKWh, 3)} unit="кВт·ч" />
            <KvRow
              label="Δ"
              value={
                <span style={{ color: Math.abs(ei.differencePercent) > 2 ? "#991b1b" : "#374151" }}>
                  {fmt(ei.differenceKWh, 3)} ({fmtPct(ei.differencePercent)})
                </span>
              }
              unit="кВт·ч"
            />
          </tbody>
        </table>
      </Section>

      {/* 8. Monte Carlo */}
      {mc ? (
        <Section title="8. Верификация Monte Carlo">
          <table style={tableStyle}>
            <tbody>
              <KvRow label="Прогонов" value={mc.runs} unit="шт" />
              <KvRow label="Порог недогрева" value={mc.underheatingThresholdC} unit="°C" />
              <KvRow label="Прогонов с T_min < 20°C" value={mc.underheatingBelow20Count} unit="шт" />
              <KvRow label="P(T_min < 20°C) reported" value={mc.underheatingProbabilityReported !== null ? fmt(mc.underheatingProbabilityReported * 100, 1) : "—"} unit="%" />
              <KvRow label="P(T_min < 20°C) пересчитан из minimumIndoorTemperatureC" value={mc.underheatingProbabilityRecomputed !== null ? fmt(mc.underheatingProbabilityRecomputed * 100, 1) : "—"} unit="%" />
              <KvRow label="Δ вероятностей" value={mc.probabilityDifferenceAbs !== null ? fmt(mc.probabilityDifferenceAbs * 100, 2) : "—"} unit="п.п." />
              <KvRow label="peakLoad P10/P50/P90" value={`${fmt(mc.peakLoad_P10_kW)} / ${fmt(mc.peakLoad_P50_kW)} / ${fmt(mc.peakLoad_P90_kW)}`} unit="кВт" />
              <KvRow label="energy P10/P50/P90" value={`${fmt(mc.energy_P10_kWh, 1)} / ${fmt(mc.energy_P50_kWh, 1)} / ${fmt(mc.energy_P90_kWh, 1)}`} unit="кВт·ч" />
              <KvRow label="T_min P10/P50/P90" value={`${fmt(mc.minTemp_P10_C, 1)} / ${fmt(mc.minTemp_P50_C, 1)} / ${fmt(mc.minTemp_P90_C, 1)}`} unit="°C"
                note={mc.minTemp_P10_C !== null && mc.minTemp_P10_C < 20 ? "⚠ P10 ниже порога 20°C" : undefined} />
            </tbody>
          </table>
        </Section>
      ) : (
        <Section title="8. Monte Carlo">
          <p style={{ color: "#9ca3af", fontSize: 12 }}>Monte Carlo не запущен — раздел недоступен.</p>
        </Section>
      )}

      {/* 9. Invariant Table */}
      <Section title="9. Инварианты PASS / WARN / FAIL">
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Статус</Th>
                <Th>Инвариант</Th>
                <Th>Факт</Th>
                <Th>Ожидаемое</Th>
                <Th>Δ</Th>
                <Th>Пояснение</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {invariants.map((item) => (
                <InvariantRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 10. Assumptions & Fallbacks */}
      {(assumptions.length > 0 || fallbacks.length > 0) && (
        <Section title="10. Допущения и fallback-значения">
          {fallbacks.length > 0 && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
              <p style={{ fontWeight: 700, color: "#9a3412", fontSize: 12, marginBottom: 4 }}>Fallback-значения (обнаружены в modelWarnings):</p>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#9a3412", fontSize: 12 }}>
                {fallbacks.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )}
          {assumptions.length > 0 && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ fontWeight: 700, color: "#475569", fontSize: 12, marginBottom: 4 }}>Допущения:</p>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#64748b", fontSize: 12 }}>
                {assumptions.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

export default ThermalCalculationConsistencyReport;
