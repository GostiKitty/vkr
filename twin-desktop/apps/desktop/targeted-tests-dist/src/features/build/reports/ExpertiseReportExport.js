import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { buildExpertiseThermalReportData, exportSpReportToPdf } from "./spReportPdf";
import { DEFAULT_REPORT_META, loadReportMeta, saveReportMeta } from "./reportMetaPersistence";
export function ExpertiseReportExport({ projectKey, model, sp50Report, engineeringResult, thermalResult, transientResult, transientWarnings, calculationTimestampIso, scenarioLabel, climateBaseLabel, compact = false, }) {
    const [meta, setMeta] = useState(DEFAULT_REPORT_META);
    const [showMeta, setShowMeta] = useState(false);
    const [exportMessage, setExportMessage] = useState(null);
    useEffect(() => {
        setMeta(loadReportMeta(projectKey));
    }, [projectKey]);
    const persistMeta = useCallback((patch) => {
        setMeta((current) => {
            const next = { ...current, ...patch };
            saveReportMeta(projectKey, next);
            return next;
        });
    }, [projectKey]);
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
        setExportMessage(ok
            ? "Открыт HTML-отчёт: нажмите «Печать / Сохранить PDF» в новой вкладке (масштаб 100%, поля по умолчанию)."
            : "Не удалось открыть окно отчёта. Разрешите всплывающие окна или повторите экспорт.");
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
    return (_jsxs("div", { className: compact ? "space-y-2" : "mt-4 space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4", children: [!compact ? (_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u044B (\u0421\u041F 50)" }), _jsx("p", { className: "mt-1 text-xs leading-5 text-[color:var(--text-soft)]", children: "\u0422\u0435\u043A\u0441\u0442\u043E\u0432\u0430\u044F \u0447\u0430\u0441\u0442\u044C \u041F\u0414 \u043F\u043E \u041F\u041F \u0420\u0424 \u2116 87 (\u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u0413\u041E\u0421\u0422 2.105 / \u0413\u041E\u0421\u0422 \u0420 21.1101). \u042D\u043D\u0435\u0440\u0433\u043E\u043F\u0430\u0441\u043F\u043E\u0440\u0442 \u2014 \u043F\u0440\u0438\u043B. \u0412 \u0421\u041F 50. \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0447\u0435\u0440\u0435\u0437 \u043F\u0435\u0447\u0430\u0442\u044C \u0432 PDF." })] })) : null, _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("button", { type: "button", onClick: handleExport, className: "rounded-xl border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-base)] transition hover:opacity-90", children: "\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u044B (PDF)" }), _jsx("button", { type: "button", onClick: () => setShowMeta((value) => !value), className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)]", children: showMeta ? "Скрыть реквизиты" : "Реквизиты титульного листа" })] }), showMeta ? (_jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [_jsx(MetaField, { label: "\u0428\u0438\u0444\u0440 \u043F\u0440\u043E\u0435\u043A\u0442\u0430", value: meta.projectCipher, onChange: (value) => persistMeta({ projectCipher: value }) }), _jsx(MetaField, { label: "\u0410\u0434\u0440\u0435\u0441 \u043E\u0431\u044A\u0435\u043A\u0442\u0430", value: meta.buildingAddress, onChange: (value) => persistMeta({ buildingAddress: value }) }), _jsx(MetaField, { label: "\u0417\u0430\u043A\u0430\u0437\u0447\u0438\u043A", value: meta.customerOrg, onChange: (value) => persistMeta({ customerOrg: value }) }), _jsx(MetaField, { label: "\u0420\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0447\u0438\u043A", value: meta.developerOrg, onChange: (value) => persistMeta({ developerOrg: value }) }), _jsx(MetaField, { label: "\u0421\u0442\u0430\u0434\u0438\u044F", value: meta.documentStage, onChange: (value) => persistMeta({ documentStage: value }) }), _jsx(MetaField, { label: "\u0420\u0430\u0437\u0434\u0435\u043B \u041F\u0414 (\u041F\u041F \u2116 87)", value: meta.projectSection, onChange: (value) => persistMeta({ projectSection: value }), className: "sm:col-span-2" }), _jsx(MetaField, { label: "\u0413\u043E\u0440\u043E\u0434 (\u0442\u0438\u0442\u0443\u043B)", value: meta.documentCity, onChange: (value) => persistMeta({ documentCity: value }) })] })) : null, exportMessage ? _jsx("p", { className: "text-xs leading-5 text-[color:var(--text-soft)]", children: exportMessage }) : null] }));
}
function MetaField({ label, value, onChange, className = "", }) {
    return (_jsxs("label", { className: `block text-xs font-semibold text-[color:var(--text-muted)] ${className}`.trim(), children: [label, _jsx("input", { type: "text", value: value, onChange: (event) => onChange(event.target.value), className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2 text-sm font-normal text-[color:var(--text-base)]" })] }));
}
export default ExpertiseReportExport;
