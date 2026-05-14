import { useState } from "react";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import {
  buildScientificReportData,
  createScientificReportPdf,
  generateCalibrationSummary,
  generateMonteCarloAnalytics,
} from "./reportUtils";

export function ReportGenerator() {
  const twin = useTwinStore((state) => state.twin);
  const frames = useTwinStore((state) => state.simulationFrames);
  const uncertainty = useWorkflowStore((state) => state.uncertaintyConfig);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

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
      triggerDownload(blob, `digital-twin-report-${Date.now()}.pdf`);
      setStatus("done");
      setMessage("PDF отчёт выгружен.");
    } catch (error) {
      console.error("Report generation failed", error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Не удалось сформировать отчёт.");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-slate-900">Научный отчёт</h3>
        <p className="text-sm text-slate-500">
          Автоматически формирует PDF с описанием модели, уравнениями, неопределённостями и калибровкой.
        </p>
      </div>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={status === "working" || !twin}
        className={`rounded-xl px-5 py-2 text-sm font-semibold text-white transition ${
          status === "working" || !twin
            ? "bg-slate-300 text-slate-500"
            : "bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
        }`}
      >
        {status === "working" ? "Генерирую PDF…" : "Сформировать отчёт"}
      </button>
      {message && (
        <p
          className={`mt-3 text-sm ${
            status === "error" ? "text-red-600" : status === "done" ? "text-emerald-600" : "text-slate-500"
          }`}
        >
          {message}
        </p>
      )}
      {!twin && (
        <p className="mt-3 text-xs text-slate-500">
          Требуется загруженный проект и результаты симуляций, чтобы отчёт мог сослаться на текущие данные.
        </p>
      )}
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
