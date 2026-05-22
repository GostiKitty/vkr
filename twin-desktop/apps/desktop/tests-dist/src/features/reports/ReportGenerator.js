import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { buildScientificReportData, createScientificReportPdf, generateCalibrationSummary, generateMonteCarloAnalytics, } from "./reportUtils";
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
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState(null);
    const readiness = twin != null
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
        }
        catch (error) {
            console.error("Report generation failed", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Не удалось сформировать отчёт.");
        }
    };
    return (_jsxs("div", { className: "ui-panel space-y-5 p-5 sm:p-6", children: [_jsxs("div", { className: "flex flex-wrap items-start gap-4", children: [_jsx("div", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--accent-soft)] text-[color:var(--accent-base)]", children: _jsx(IconReport, { size: 26 }) }), _jsx("div", { className: "min-w-0 flex-1", children: _jsx(EngineeringSectionHeader, { kicker: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u043E\u0435 \u0437\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435", title: "Legacy PDF (Twin API)", subtitle: "\u0412\u0441\u043F\u043E\u043C\u043E\u0433\u0430\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430 \u0434\u043B\u044F \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0433\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F. \u041D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0451\u0442 \u0442\u0435\u043F\u043B\u043E\u0437\u0430\u0449\u0438\u0442\u044B \u0438 \u044D\u043D\u0435\u0440\u0433\u043E\u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u0432 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0435, \u00AB\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u044B\u00BB." }) })] }), _jsx(EngineeringCallout, { variant: "attention", title: "\u0423\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u0439 \u043A\u043E\u043D\u0442\u0443\u0440 / \u043D\u0435 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u044B \u043F\u043E \u0421\u041F 50", children: _jsx("p", { children: "\u042D\u0442\u043E\u0442 PDF \u2014 legacy-\u043E\u0442\u0447\u0451\u0442 \u043F\u043E Twin API (\u0430\u043D\u0433\u043B\u043E\u044F\u0437\u044B\u0447\u043D\u0430\u044F \u0441\u0432\u043E\u0434\u043A\u0430, Monte Carlo). \u0414\u043B\u044F \u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0439 \u0438 \u043D\u0435\u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0439 \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u044B \u043F\u043E \u0442\u0435\u043F\u043B\u043E\u0437\u0430\u0449\u0438\u0442\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043A\u043D\u043E\u043F\u043A\u0443 \u00AB\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u044B (PDF)\u00BB \u0432 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0435 \u043F\u043E\u0441\u043B\u0435 \u0440\u0430\u0441\u0447\u0451\u0442\u0430 (\u0431\u043B\u043E\u043A \u0421\u041F 50.13330.2024)." }) }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[1fr_minmax(0,1.1fr)]", children: [_jsxs("div", { className: "ui-report-frame space-y-3", children: [_jsx("p", { className: "ui-kicker", children: "\u0427\u0435\u043A\u043B\u0438\u0441\u0442 \u0440\u0430\u0437\u0434\u0435\u043B\u043E\u0432" }), _jsx("ul", { className: "space-y-2 text-sm text-[color:var(--text-muted)]", children: checklist.map((item) => (_jsxs("li", { className: "flex items-start gap-2", children: [_jsx("span", { className: "mt-0.5 text-[color:var(--accent-base)]", children: "\u2713" }), _jsx("span", { children: item.label })] }, item.id))) })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("span", { className: "ui-chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[color:var(--text-muted)]", children: [_jsx(IconThermometer, { size: 14 }), " \u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430"] }), _jsxs("span", { className: "ui-chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[color:var(--text-muted)]", children: [_jsx(IconRisk, { size: 14 }), " \u0420\u0438\u0441\u043A\u0438"] }), _jsxs("span", { className: "ui-chip inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[color:var(--text-muted)]", children: [_jsx(IconSp50, { size: 14 }), " \u041D\u0435 \u0421\u041F 50"] })] }), _jsx(EngineeringCallout, { variant: "assumption", title: "\u0421\u0442\u0430\u0442\u0443\u0441 \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u0438", children: _jsx("p", { children: readiness }) }), _jsx(EngineeringCallout, { variant: "info", title: "\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u044F", children: _jsx("p", { children: "\u041E\u0442\u0447\u0451\u0442 \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044F \u0438\u0437 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F \u0441\u0442\u0443\u0434\u0438\u0438. \u0420\u0430\u0437\u0434\u0435\u043B \u0421\u041F 50 \u0432 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0435 \u043E\u0444\u043E\u0440\u043C\u043B\u044F\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C \u043C\u043E\u0434\u0443\u043B\u0435\u043C. \u0414\u043B\u044F \u0447\u0430\u0441\u0442\u0438 \u0437\u043E\u043D \u043C\u043E\u0436\u0435\u0442 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u043E\u0446\u0435\u043D\u043E\u0447\u043D\u0430\u044F \u0441\u0432\u044F\u0437\u044C \u0441 \u043D\u0430\u0440\u0443\u0436\u043D\u043E\u0439 \u0441\u0440\u0435\u0434\u043E\u0439 \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0434\u043E\u043F\u0443\u0449\u0435\u043D\u0438\u044F \u0432 \u0442\u0435\u043A\u0441\u0442\u0435 PDF." }) })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("button", { type: "button", onClick: handleGenerate, disabled: status === "working" || !twin, className: "ui-btn-primary disabled:cursor-not-allowed", children: status === "working" ? "Формирую PDF…" : "Сформировать legacy PDF" }), !twin ? (_jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u043F\u0440\u043E\u0435\u043A\u0442 \u043D\u0430 \u0448\u0430\u0433\u0435 \u00AB\u041C\u043E\u0434\u0435\u043B\u044C\u00BB, \u0437\u0430\u0442\u0435\u043C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0440\u0430\u0441\u0447\u0451\u0442." })) : null] }), message ? (_jsx(EngineeringCallout, { variant: status === "error" ? "risk" : status === "done" ? "success" : "info", title: status === "error" ? "Ошибка" : status === "done" ? "Готово" : "Статус", children: _jsx("p", { children: message }) })) : null] }));
}
function triggerDownload(blob, filename) {
    if (typeof window === "undefined")
        return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}
export default ReportGenerator;
