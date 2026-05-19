import { useState } from "react";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import {
  buildScientificReportData,
  createScientificReportPdf,
  generateCalibrationSummary,
  generateMonteCarloAnalytics,
} from "./reportUtils";
import { EngineeringCallout, EngineeringSectionHeader, IconReport, IconRisk, IconSp50, IconThermometer } from "../../shared/ui";

const checklist = [
  { id: "twin", label: "Описание цифрового двойника и доступных данных", ready: true },
  { id: "balance", label: "Фрагменты по тепловому балансу и динамике (если есть кадры симуляции)", ready: true },
  { id: "unc", label: "Блок неопределённостей и Monte Carlo (если настроены прогоны)", ready: true },
  { id: "cal", label: "Калибровочные заметки по измерениям (если есть данные)", ready: true },
];

export function ReportGenerator() {
  const twin = useTwinStore((state) => state.twin);
  const frames = useTwinStore((state) => state.simulationFrames);
  const uncertainty = useWorkflowStore((state) => state.uncertaintyConfig);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const readiness =
    twin != null
      ? frames.length > 0
        ? "Готово к развёрнутому PDF: есть модель и кадры расчёта."
        : "Базовый PDF: модель есть, кадры симуляции пусты — разделы по динамике будут краткими."
      : "Нужны данные проекта: загрузите модель в студии.";

  const handleGenerate = async () => {
    if (!twin) {
      setMessage("Загрузите модель и выполните расчёты, прежде чем формировать отчёт.");
      setStatus("error");
      return;
    }
    try {
      setStatus("working");
      setMessage(null);
      const monteCarlo = generateMonteCarloAnalytics(twin);
      const calibration = generateCalibrationSummary(twin);
      const reportData = buildScientificReportData({
        twin,
        frames,
        uncertaintyRuns: uncertainty?.runs,
        uncertaintyMode: uncertainty?.evaluationMode,
        monteCarlo,
        calibration,
      });
      const blob = createScientificReportPdf(reportData);
      triggerDownload(blob, `gnezdyshko-report-${Date.now()}.pdf`);
      setStatus("done");
      setMessage("PDF сформирован и сохранён в папку загрузок браузера.");
    } catch (error) {
      console.error("Report generation failed", error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Не удалось сформировать отчёт.");
    }
  };

  return (
    <div className="ui-panel space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--accent-soft)] text-[color:var(--accent-base)]">
          <IconReport size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <EngineeringSectionHeader
            kicker="Инженерное заключение"
            title="Подготовка отчёта PDF"
            subtitle="Сводка модели, уравнения, неопределённость и калибровка в одном файле для пояснительной записки или приложения. Не заменяет полный комплект ТПР и нормативную экспертизу СП 50."
          />
        </div>
      </div>

      <EngineeringCallout variant="attention" title="Устаревший контур отчёта / требует синхронизации с основным расчётом">
        <p>
          Этот PDF собирается через legacy report path по данным Twin API и отдельным отчётным процедурам. Его выводы нужно читать отдельно от основного builder-расчёта,
          результатов RC-модели и нормативной проверки СП 50.
        </p>
      </EngineeringCallout>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,1.1fr)]">
        <div className="ui-report-frame space-y-3">
          <p className="ui-kicker">Чеклист разделов</p>
          <ul className="space-y-2 text-sm text-[color:var(--text-muted)]">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span className="mt-0.5 text-[color:var(--accent-base)]">✓</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="ui-chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
              <IconThermometer size={14} /> Температура
            </span>
            <span className="ui-chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
              <IconRisk size={14} /> Риски
            </span>
            <span className="ui-chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
              <IconSp50 size={14} /> Не СП 50
            </span>
          </div>
          <EngineeringCallout variant="assumption" title="Статус готовности">
            <p>{readiness}</p>
          </EngineeringCallout>
          <EngineeringCallout variant="info" title="Предупреждения">
            <p>
              Отчёт собирается из текущего состояния студии. Раздел СП 50 в конструкторе оформляется отдельным модулем.
              Для части зон может использоваться оценочная связь с наружной средой — проверьте допущения в тексте PDF.
            </p>
          </EngineeringCallout>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === "working" || !twin}
          className="ui-btn-primary disabled:cursor-not-allowed"
        >
          {status === "working" ? "Формирую PDF…" : "Сформировать отчёт"}
        </button>
        {!twin ? (
          <p className="text-xs text-[color:var(--text-soft)]">Сначала загрузите проект на шаге «Модель», затем выполните расчёт.</p>
        ) : null}
      </div>

      {message ? (
        <EngineeringCallout
          variant={status === "error" ? "risk" : status === "done" ? "success" : "info"}
          title={status === "error" ? "Ошибка" : status === "done" ? "Готово" : "Статус"}
        >
          <p>{message}</p>
        </EngineeringCallout>
      ) : null}
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default ReportGenerator;
