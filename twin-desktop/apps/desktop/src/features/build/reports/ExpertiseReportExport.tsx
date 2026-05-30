import { useCallback, useEffect, useState } from "react";
import type { BuildingModel } from "../../../entities/geometry/types";
import type { EngineeringAnalysisResult } from "../../../core/thermal/engineering/types";
import type { ThermalSimulationResult } from "../../../core/thermal/solver";
import type { Sp50ComplianceReport } from "../../../core/thermal/sp50/types";
import type { TransientCalculationResult } from "../../../core/thermal/transient/index";
import { buildExpertiseThermalReportData, exportSpReportToPdf } from "./spReportPdf";
import { DEFAULT_REPORT_META, loadReportMeta, saveReportMeta, type ReportMeta } from "./reportMetaPersistence";

interface ExpertiseReportExportProps {
  projectKey: string;
  model: BuildingModel;
  sp50Report: Sp50ComplianceReport;
  engineeringResult?: EngineeringAnalysisResult | null;
  thermalResult?: ThermalSimulationResult | null;
  transientResult?: TransientCalculationResult | null;
  transientWarnings?: string[];
  calculationTimestampIso?: string | null;
  scenarioLabel?: string | null;
  climateBaseLabel?: string | null;
  compact?: boolean;
}

export function ExpertiseReportExport({
  projectKey,
  model,
  sp50Report,
  engineeringResult,
  thermalResult,
  transientResult,
  transientWarnings,
  calculationTimestampIso,
  scenarioLabel,
  climateBaseLabel,
  compact = false,
}: ExpertiseReportExportProps) {
  const [meta, setMeta] = useState<ReportMeta>(DEFAULT_REPORT_META);
  const [showMeta, setShowMeta] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    setMeta(loadReportMeta(projectKey));
  }, [projectKey]);

  const persistMeta = useCallback(
    (patch: Partial<ReportMeta>) => {
      setMeta((current) => {
        const next = { ...current, ...patch };
        saveReportMeta(projectKey, next);
        return next;
      });
    },
    [projectKey]
  );

  const handleExport = useCallback(() => {
    const data = buildExpertiseThermalReportData({
      report: sp50Report,
      model,
      meta,
      calculationTimestampIso,
      scenarioLabel,
      climateBaseLabel,
      engineering: engineeringResult ?? null,
      thermalResult: thermalResult ?? null,
      transientResult: transientResult ?? null,
      transientWarnings,
      includeRcAppendix: Boolean(thermalResult),
    });
    const ok = exportSpReportToPdf(data);
    setExportMessage(
      ok
        ? "Открыт HTML-отчёт: нажмите «Печать / Сохранить PDF» в новой вкладке (масштаб 100%, поля по умолчанию)."
        : "Не удалось открыть окно отчёта. Разрешите всплывающие окна или повторите экспорт."
    );
  }, [
    calculationTimestampIso,
    climateBaseLabel,
    engineeringResult,
    meta,
    model,
    scenarioLabel,
    sp50Report,
    thermalResult,
    transientResult,
    transientWarnings,
  ]);

  return (
    <div className={compact ? "space-y-2" : "mt-4 space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4"}>
      {!compact ? (
        <div>
          <h4 className="text-sm font-semibold text-[color:var(--text-base)]">Экспорт для экспертизы (СП 50)</h4>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-soft)]">
            Текстовая часть ПД по ПП РФ № 87 (оформление ГОСТ 2.105 / ГОСТ Р 21.1101). Энергопаспорт — прил. В СП 50. Сохранение через печать в PDF.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-base)] transition hover:opacity-90"
        >
          Экспорт для экспертизы (PDF)
        </button>
        <button
          type="button"
          onClick={() => setShowMeta((value) => !value)}
          className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)]"
        >
          {showMeta ? "Скрыть реквизиты" : "Реквизиты титульного листа"}
        </button>
      </div>
      {showMeta ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <MetaField label="Шифр проекта" value={meta.projectCipher} onChange={(value) => persistMeta({ projectCipher: value })} />
          <MetaField label="Адрес объекта" value={meta.buildingAddress} onChange={(value) => persistMeta({ buildingAddress: value })} />
          <MetaField label="Заказчик" value={meta.customerOrg} onChange={(value) => persistMeta({ customerOrg: value })} />
          <MetaField label="Разработчик" value={meta.developerOrg} onChange={(value) => persistMeta({ developerOrg: value })} />
          <MetaField label="Стадия" value={meta.documentStage} onChange={(value) => persistMeta({ documentStage: value })} />
          <MetaField
            label="Раздел ПД (ПП № 87)"
            value={meta.projectSection}
            onChange={(value) => persistMeta({ projectSection: value })}
            className="sm:col-span-2"
          />
          <MetaField label="Город (титул)" value={meta.documentCity} onChange={(value) => persistMeta({ documentCity: value })} />
        </div>
      ) : null}
      {exportMessage ? <p className="text-xs leading-5 text-[color:var(--text-soft)]">{exportMessage}</p> : null}
    </div>
  );
}

function MetaField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block text-xs font-semibold text-[color:var(--text-muted)] ${className}`.trim()}>
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2 text-sm font-normal text-[color:var(--text-base)]"
      />
    </label>
  );
}

export default ExpertiseReportExport;
