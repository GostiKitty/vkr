import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from "react";
import { runThermalMonteCarlo, runThermalMonteCarloAsync, THERMAL_MONTE_CARLO_MAX_RUNS, THERMAL_UNCERTAINTY_DEFINITIONS, } from "../../../core/uncertainty/thermalMonteCarlo";
import { buildMonteCarloInterpretationLines } from "../../../core/thermal/thermalResultsInterpretation";
import { formatNumber, formatPercentage } from "../../../shared/utils/format";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, } from "recharts";
import Tooltip from "../../../shared/ui/Tooltip";
const DEFAULT_RUNS = 200;
const DEFAULT_SEED = 2026;
const DEFAULT_THRESHOLD = 60;
const DEFAULT_VAR_LEVEL = 0.95;
/** При большем числе прогонов расчёт выполняется асинхронно с уступкой UI между пакетами итераций. */
const MONTE_CARLO_ASYNC_FROM = 80;
const MONTE_CARLO_YIELD_EVERY = 22;
export const THERMAL_MONTE_CARLO_HELP_TEXT = "Метод Монте-Карло многократно пересчитывает модель при случайном изменении исходных параметров в заданных пределах. Это помогает оценить диапазон возможных результатов и риск выхода за заданный порог, а не только одно расчетное значение.";
export function ThermalMonteCarloPanel({ model, adjacency, options }) {
    const [runs, setRuns] = useState(DEFAULT_RUNS);
    const [seed, setSeed] = useState(DEFAULT_SEED);
    const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
    const [varLevel, setVarLevel] = useState(DEFAULT_VAR_LEVEL);
    const [correlationInput, setCorrelationInput] = useState(buildIdentityMatrixText(THERMAL_UNCERTAINTY_DEFINITIONS.length));
    const [correlationError, setCorrelationError] = useState(null);
    const [result, setResult] = useState(null);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const histogramData = useMemo(() => {
        if (!result) {
            return [];
        }
        return result.peakLoad.histogram.map((bin, index) => ({
            id: index,
            label: `${bin.binStart.toFixed(1)}–${bin.binEnd.toFixed(1)}`,
            count: bin.count,
            probability: bin.probability * 100,
            mid: bin.mid,
        }));
    }, [result]);
    const cdfData = useMemo(() => {
        if (!result) {
            return [];
        }
        return result.peakLoad.cdf.map((point) => ({
            value: point.value,
            probability: point.probability * 100,
        }));
    }, [result]);
    const monteCarloInsightLines = useMemo(() => {
        if (!result) {
            return [];
        }
        const thresholdKW = threshold === "" ? undefined : Number(threshold);
        return buildMonteCarloInterpretationLines(result, Number.isFinite(thresholdKW) ? thresholdKW : undefined);
    }, [result, threshold]);
    const geometryBlockedReason = useMemo(() => {
        if (!model.rooms.length) {
            return "Добавьте хотя бы одно помещение на вкладке «План».";
        }
        if (!model.walls.length) {
            return "Добавьте стены на плане или используйте инструмент «Стены из комнат» в палитре построения.";
        }
        return null;
    }, [model.rooms.length, model.walls.length]);
    const canRun = geometryBlockedReason === null;
    const handleRun = useCallback(async () => {
        if (!canRun) {
            setError("Добавьте геометрию, чтобы выполнить расчёт неопределённостей.");
            return;
        }
        setError(null);
        setCorrelationError(null);
        let parsedMatrix;
        try {
            parsedMatrix = parseCorrelationMatrix(correlationInput, THERMAL_UNCERTAINTY_DEFINITIONS.length);
        }
        catch (matrixError) {
            const message = matrixError instanceof Error ? matrixError.message : "Матрица корреляций некорректна.";
            setCorrelationError(message);
            return;
        }
        setRunning(true);
        setProgress(0);
        try {
            const thresholdValue = threshold === "" ? undefined : Number(threshold);
            const runCount = Math.max(1, runs);
            const baseArgs = {
                model,
                adjacency,
                baseOptions: options,
                runs: runCount,
                seed,
                heatingThresholdKW: thresholdValue,
                varLevel,
                correlationMatrix: parsedMatrix,
                onProgress: (completed, total) => {
                    setProgress(completed / total);
                },
            };
            const data = runCount >= MONTE_CARLO_ASYNC_FROM
                ? await runThermalMonteCarloAsync({ ...baseArgs, yieldEvery: MONTE_CARLO_YIELD_EVERY })
                : runThermalMonteCarlo(baseArgs);
            setResult(data);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось выполнить расчёт Монте‑Карло.";
            setError(message);
        }
        finally {
            setRunning(false);
            setTimeout(() => setProgress(0), 300);
        }
    }, [adjacency, canRun, correlationInput, model, options, runs, seed, threshold, varLevel]);
    const stats = result?.peakLoad;
    const energyStats = result?.annualEnergy;
    const exceedProbability = result?.exceedanceProbability !== undefined
        ? formatPercentage(result.exceedanceProbability)
        : "—";
    const varDisplay = result ? `${formatNumber(result.peakLoad.valueAtRisk, { maximumFractionDigits: 1 })} кВт` : "—";
    const cvarDisplay = result ? `${formatNumber(result.peakLoad.conditionalValueAtRisk, { maximumFractionDigits: 1 })} кВт` : "—";
    return (_jsxs("section", { className: "min-w-0 space-y-4 overflow-hidden rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4 shadow-sm", children: [_jsxs("header", { className: "flex flex-col gap-1", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041D\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u043E\u0441\u0442\u044C" }), _jsx("h2", { className: "text-2xl font-semibold text-[color:var(--text-base)]", children: "\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u043D\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0440\u0438\u0441\u043A\u0430" }), _jsx("p", { className: "text-sm text-[color:var(--text-soft)]", children: THERMAL_MONTE_CARLO_HELP_TEXT }), _jsx("p", { className: "text-sm text-[color:var(--text-soft)]", children: "\u0417\u0430\u0447\u0435\u043C \u044D\u0442\u043E \u043D\u0443\u0436\u043D\u043E: \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043D\u044F\u0442\u044C, \u043D\u0430\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0443\u0441\u0442\u043E\u0439\u0447\u0438\u0432 \u043A \u043D\u0435\u0442\u043E\u0447\u043D\u043E\u0441\u0442\u0438 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438 \u043A\u0430\u043A\u0438\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0441\u0438\u043B\u044C\u043D\u0435\u0435 \u0432\u0441\u0435\u0433\u043E \u0432\u043B\u0438\u044F\u044E\u0442 \u043D\u0430 \u0440\u0438\u0441\u043A \u043F\u0435\u0440\u0435\u0433\u0440\u0443\u0437\u043A\u0438 \u0438\u043B\u0438 \u0434\u0438\u0441\u043A\u043E\u043C\u0444\u043E\u0440\u0442\u0430." }), _jsx("p", { className: "mt-2 text-xs text-[color:var(--text-soft)]", children: "\u0413\u0438\u0441\u0442\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0438 CDF \u043D\u0438\u0436\u0435 \u2014 \u043D\u0430\u0433\u043B\u044F\u0434\u043D\u043E\u0435 \u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u043A \u0447\u0438\u0441\u043B\u0430\u043C P5/P50/P95: \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0442 \u0444\u043E\u0440\u043C\u0443 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u043F\u0438\u043A\u043E\u0432\u043E\u0439 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0438 \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043D\u0443\u044E \u0434\u043E\u043B\u044E \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432. \u0414\u043B\u044F \u0431\u044B\u0441\u0442\u0440\u043E\u0439 \u043E\u0446\u0435\u043D\u043A\u0438 \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043F\u0435\u0440\u0446\u0435\u043D\u0442\u0438\u043B\u0435\u0439; \u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u043F\u043E\u043B\u0435\u0437\u043D\u044B \u0432 \u043F\u043E\u044F\u0441\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u043A\u0435 \u0412\u041A\u0420." })] }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]", children: [_jsx("div", { className: "min-w-0 space-y-4", children: _jsxs("div", { className: "min-w-0 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4", children: [_jsx("h3", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043F\u043E\u0438\u0441\u043A\u0430" }), _jsxs("div", { className: "mt-3 space-y-3", children: [_jsx(LabelledInput, { label: "\u0427\u0438\u0441\u043B\u043E \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432", value: runs, min: 10, max: THERMAL_MONTE_CARLO_MAX_RUNS, step: 10, onChange: (value) => {
                                                if (typeof value === "number") {
                                                    setRuns(Math.max(1, Math.min(THERMAL_MONTE_CARLO_MAX_RUNS, value)));
                                                }
                                            } }), runs >= MONTE_CARLO_ASYNC_FROM && (_jsxs("p", { className: "text-xs text-[color:var(--warning-fg)]", children: ["\u041F\u0440\u0438 ", MONTE_CARLO_ASYNC_FROM, "+ \u043F\u0440\u043E\u0433\u043E\u043D\u0430\u0445 \u0440\u0430\u0441\u0447\u0451\u0442 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u043F\u0430\u043A\u0435\u0442\u0430\u043C\u0438, \u0447\u0442\u043E\u0431\u044B \u043E\u043A\u043D\u043E \u043D\u0435 \u0437\u0430\u0432\u0438\u0441\u0430\u043B\u043E. \u0414\u043B\u044F \u0432\u0438\u0434\u0435\u043E \u043E\u0431\u044B\u0447\u043D\u043E \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E 150\u2013300 \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432."] })), _jsx(LabelledInput, { label: "Seed", value: seed, min: 1, step: 1, onChange: (value) => {
                                                if (typeof value === "number") {
                                                    setSeed(value);
                                                }
                                            } }), _jsx(LabelledInput, { label: "\u041F\u043E\u0440\u043E\u0433 \u043F\u0438\u043A\u043E\u0432\u043E\u0439 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438, \u043A\u0412\u0442", value: threshold, min: 1, step: 1, allowEmpty: true, onChange: (value) => setThreshold(value === "" ? "" : value) }), _jsx(LabelledInput, { label: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C VaR (0.50\u20130.99)", value: Number(varLevel.toFixed(2)), min: 0.5, max: 0.99, step: 0.01, onChange: (value) => {
                                                if (typeof value === "number") {
                                                    setVarLevel(Math.min(0.99, Math.max(0.5, value)));
                                                }
                                            } })] }), _jsx(Tooltip, { className: "mt-4 w-full", title: "\u041C\u043E\u043D\u0442\u0435\u2011\u041A\u0430\u0440\u043B\u043E", description: "\u041C\u043D\u043E\u0433\u043E\u043A\u0440\u0430\u0442\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0441\u0447\u0451\u0442 \u0437\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0439 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u043C\u043E\u0434\u0435\u043B\u0438 \u0437\u0434\u0430\u043D\u0438\u044F \u0441 \u0432\u0430\u0440\u0438\u0430\u0446\u0438\u0435\u0439 \u043A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0438 \u0440\u0435\u0436\u0438\u043C\u043D\u044B\u0445 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432.", details: ["Ввод: число прогонов N, seed", "Выход: гистограмма и CDF пиковой нагрузки (кВт), энергии (кВт·ч)"], linkedFormulaIds: ["uncertainty_mc", "uncertainty_std", "thermal_peak_load"], children: _jsx("button", { type: "button", disabled: !canRun || running, onClick: () => {
                                            void handleRun();
                                        }, className: `w-full rounded-2xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-muted)] ${!canRun || running ? "cursor-not-allowed bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]" : "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)] hover:brightness-110"}`, children: running ? "Сэмплирую..." : "Запустить вероятностный расчет" }) }), !canRun && geometryBlockedReason ? (_jsx("p", { className: "mt-2 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)]", children: geometryBlockedReason })) : null, running && (_jsxs("div", { className: "mt-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: [_jsxs("p", { className: "font-semibold text-[color:var(--text-muted)]", children: ["\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: ", (progress * 100).toFixed(0), "%"] }), _jsx("div", { className: "mt-1 h-2 rounded-full bg-[color:var(--surface-strong)]", children: _jsx("div", { className: "h-full rounded-full bg-[color:var(--accent-base)] transition-all duration-200", style: { width: `${Math.min(100, Math.round(progress * 100))}%` } }) })] })), error && (_jsx("p", { className: "mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600", children: error })), _jsxs("details", { className: "mt-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 text-xs text-[color:var(--text-muted)]", children: [_jsx("summary", { className: "cursor-pointer font-semibold text-[color:var(--text-muted)]", children: "\u041C\u0430\u0442\u0440\u0438\u0446\u0430 \u043A\u043E\u0440\u0440\u0435\u043B\u044F\u0446\u0438\u0439" }), _jsxs("p", { className: "mt-2 text-[color:var(--text-soft)]", children: ["\u0412\u0432\u0435\u0434\u0438\u0442\u0435 ", THERMAL_UNCERTAINTY_DEFINITIONS.length, "\u00D7", THERMAL_UNCERTAINTY_DEFINITIONS.length, " \u043C\u0430\u0442\u0440\u0438\u0446\u0443 (\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F 1 \u043D\u0430 \u0434\u0438\u0430\u0433\u043E\u043D\u0430\u043B\u0438)."] }), _jsx("textarea", { className: "mt-2 min-h-[140px] w-full resize-y rounded-xl border border-[color:var(--border-soft)] px-2 py-1 text-xs text-[color:var(--text-base)]", rows: THERMAL_UNCERTAINTY_DEFINITIONS.length, value: correlationInput, onChange: (event) => setCorrelationInput(event.target.value) }), correlationError && (_jsx("p", { className: "mt-1 text-xs text-red-600", children: correlationError }))] })] }) }), _jsxs("div", { className: "min-w-0 space-y-4", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2 2xl:grid-cols-4", children: [_jsx(StatBadge, { label: "P5, \u043A\u0412\u0442", value: stats ? formatNumber(stats.p5, { maximumFractionDigits: 1 }) : "—" }), _jsx(StatBadge, { label: "P50, \u043A\u0412\u0442", value: stats ? formatNumber(stats.p50, { maximumFractionDigits: 1 }) : "—" }), _jsx(StatBadge, { label: "P95, \u043A\u0412\u0442", value: stats ? formatNumber(stats.p95, { maximumFractionDigits: 1 }) : "—" }), _jsx(StatBadge, { label: "\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u0435\u0432\u044B\u0448\u0435\u043D\u0438\u044F", value: result ? exceedProbability : "—" })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(StatBadge, { label: `VaR (${result?.varLevel ? formatPercentage(result.varLevel) : "—"}) пиковой нагрузки, кВт`, value: varDisplay }), _jsx(StatBadge, { label: "CVaR \u043F\u0438\u043A\u043E\u0432\u043E\u0439 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438, \u043A\u0412\u0442", value: cvarDisplay })] }), _jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041A\u0430\u043A \u0447\u0438\u0442\u0430\u0442\u044C" }), _jsxs("ul", { className: "mt-2 space-y-2", children: [_jsx("li", { children: "P5 / P50 / P95 \u2014 5\u2011\u0439, 50\u2011\u0439 \u0438 95\u2011\u0439 \u043F\u0435\u0440\u0446\u0435\u043D\u0442\u0438\u043B\u0438 \u043F\u0438\u043A\u043E\u0432\u044B\u0445 \u043D\u0430\u0433\u0440\u0443\u0437\u043E\u043A (\u043D\u0438\u0437\u043A\u0438\u0439, \u043C\u0435\u0434\u0438\u0430\u043D\u043D\u044B\u0439 \u0438 \u0432\u044B\u0441\u043E\u043A\u0438\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0438)." }), _jsx("li", { children: "\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u0435\u0432\u044B\u0448\u0435\u043D\u0438\u044F \u2014 \u0434\u043E\u043B\u044F \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432, \u0432 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043F\u0438\u043A \u0432\u044B\u0448\u0435 \u0437\u0430\u0434\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u043E\u0440\u043E\u0433\u0430 (\u0447\u0430\u0441\u0442\u043E\u0442\u0430 \u043F\u043E \u0432\u044B\u0431\u043E\u0440\u043A\u0435, \u043D\u0435 \u00AB\u0438\u0441\u0442\u0438\u043D\u043D\u0430\u044F\u00BB \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u0431\u0435\u0437 \u043C\u043E\u0434\u0435\u043B\u0438 \u043E\u0448\u0438\u0431\u043E\u043A)." }), _jsx("li", { children: "VaR \u2014 \u043F\u0435\u0440\u0446\u0435\u043D\u0442\u0438\u043B\u044C \u043F\u0438\u043A\u043E\u0432\u043E\u0439 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438; CVaR \u2014 \u0441\u0440\u0435\u0434\u043D\u0435\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F\u043C \u0441 \u043F\u0438\u043A\u043E\u043C \u043D\u0435 \u043D\u0438\u0436\u0435 VaR (\u0442\u044F\u0436\u0451\u043B\u044B\u0439 \u0445\u0432\u043E\u0441\u0442)." })] }), monteCarloInsightLines.length ? (_jsx("ul", { className: "mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[color:var(--text-muted)]", children: monteCarloInsightLines.map((line) => (_jsx("li", { children: line }, line))) })) : null] }), _jsxs("div", { className: "min-w-0 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u0413\u0438\u0441\u0442\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u043F\u0438\u043A\u043E\u0432\u043E\u0439 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0441\u043B\u0443\u0447\u0430\u0435\u0432 vs \u043C\u043E\u0449\u043D\u043E\u0441\u0442\u044C, \u043A\u0412\u0442" }), _jsx("div", { className: "mt-3 h-[220px] sm:h-[240px]", children: histogramData.length ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: histogramData, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "label", tick: { fontSize: 11, fill: "#475569" } }), _jsx(YAxis, { tick: { fontSize: 11, fill: "#475569" } }), _jsx(RechartsTooltip, { content: _jsx(HistogramTooltip, {}) }), _jsx(Bar, { dataKey: "count", fill: "#0f172a", radius: [6, 6, 0, 0] })] }) })) : (_jsx(ChartPlaceholder, {})) })] }), _jsxs("div", { className: "min-w-0 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041A\u0443\u043C\u0443\u043B\u044F\u0442\u0438\u0432\u043D\u043E\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435" }), _jsx("p", { className: "text-xs text-[color:var(--text-soft)]", children: "CDF \u0434\u043B\u044F \u043F\u0438\u043A\u043E\u0432\u043E\u0439 \u043D\u0430\u0433\u0440\u0443\u0437\u043A\u0438" }), _jsx("div", { className: "mt-3 h-[220px] sm:h-[240px]", children: cdfData.length ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: cdfData, children: [_jsx(CartesianGrid, { stroke: "#e2e8f0", strokeDasharray: "4 4" }), _jsx(XAxis, { dataKey: "value", tickFormatter: (value) => `${formatNumber(value, { maximumFractionDigits: 1 })}`, tick: { fontSize: 11, fill: "#475569" } }), _jsx(YAxis, { domain: [0, 100], tickFormatter: (value) => `${value}%`, tick: { fontSize: 11, fill: "#475569" } }), _jsx(RechartsTooltip, { content: _jsx(CdfTooltip, {}) }), _jsx(Line, { type: "monotone", dataKey: "probability", stroke: "#2563eb", strokeWidth: 2, dot: false })] }) })) : (_jsx(ChartPlaceholder, {})) })] }), _jsxs("div", { className: "min-w-0 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u042D\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043C\u0435\u0442\u0440\u0438\u043A\u0438" }), _jsx("p", { className: "mt-1 text-xs text-[color:var(--text-soft)]", children: "\u00AB\u0423\u0441\u043B\u043E\u0432\u043D\u044B\u0439 \u0433\u043E\u0434\u00BB = 365 \u00D7 \u0441\u0440\u0435\u0434\u043D\u0435\u0441\u0443\u0442\u043E\u0447\u043D\u0430\u044F \u044D\u043D\u0435\u0440\u0433\u0438\u044F \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u0431\u0430\u0437\u043E\u0432\u043E\u0433\u043E \u0440\u0430\u0441\u0447\u0451\u0442\u0430 (24 \u0447 \u0438\u043B\u0438 7 \u0441\u0443\u0442\u043E\u043A); \u0434\u043B\u044F \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432 \u041C\u043E\u043D\u0442\u0435\u2011\u041A\u0430\u0440\u043B\u043E, \u043D\u0435 \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u044B\u0439 \u0433\u043E\u0434\u043E\u0432\u043E\u0439 \u0440\u0430\u0441\u0445\u043E\u0434." }), energyStats ? (_jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3", children: [_jsx(StatBadge, { label: "\u0423\u0441\u043B\u043E\u0432\u043D\u044B\u0439 \u0433\u043E\u0434 (365\u00D7), \u043A\u0412\u0442\u00B7\u0447", value: formatNumber(energyStats.mean, { maximumFractionDigits: 0 }) }), _jsx(StatBadge, { label: "P95, \u043A\u0412\u0442\u00B7\u0447", value: formatNumber(energyStats.p95, { maximumFractionDigits: 0 }) }), _jsx(StatBadge, { label: "\u03C3, \u043A\u0412\u0442\u00B7\u0447", value: formatNumber(energyStats.stdDev, { maximumFractionDigits: 0 }) })] })) : (_jsx("p", { className: "mt-2 text-sm text-[color:var(--text-soft)]", children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0430\u043D\u0430\u043B\u0438\u0437, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u044D\u043D\u0435\u0440\u0433\u043E\u043F\u043E\u0442\u0440\u0435\u0431\u043B\u0435\u043D\u0438\u044F." }))] })] })] })] }));
}
const LabelledInput = ({ label, value, min, max, step, onChange, allowEmpty, }) => (_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-muted)]", children: [label, _jsx("input", { type: "number", value: value, min: min, max: max, step: step ?? 1, onChange: (event) => {
                if (allowEmpty && event.target.value === "") {
                    onChange("");
                    return;
                }
                const next = Number(event.target.value);
                if (Number.isNaN(next)) {
                    return;
                }
                if (typeof min === "number" && next < min) {
                    onChange(min);
                    return;
                }
                if (typeof max === "number" && next > max) {
                    onChange(max);
                    return;
                }
                onChange(next);
            }, className: "mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]" })] }));
const StatBadge = ({ label, value }) => (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2 text-center shadow-inner", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: label }), _jsx("p", { className: "mt-1 text-xl font-semibold text-[color:var(--text-base)]", children: value })] }));
const HistogramTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
        return null;
    }
    const entry = payload[0];
    const label = entry.payload?.label;
    return (_jsxs("div", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)] shadow-lg", children: [_jsxs("p", { className: "font-semibold", children: [label, " \u043A\u0412\u0442"] }), _jsxs("p", { children: ["\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u0432: ", entry.value] })] }));
};
const CdfTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) {
        return null;
    }
    const entry = payload[0];
    return (_jsxs("div", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)] shadow-lg", children: [_jsxs("p", { children: ["\u041D\u0430\u0433\u0440\u0443\u0437\u043A\u0430: ", formatNumber(entry.payload.value, { maximumFractionDigits: 1 }), " \u043A\u0412\u0442"] }), _jsxs("p", { children: ["\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C: ", formatNumber(Number(entry.value), { maximumFractionDigits: 1 }), "%"] })] }));
};
const ChartPlaceholder = () => (_jsx("div", { className: "flex h-full items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-sm text-[color:var(--text-soft)]", children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u0430\u043D\u0430\u043B\u0438\u0437, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0433\u0440\u0430\u0444\u0438\u043A." }));
function buildIdentityMatrixText(size) {
    return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => (row === col ? "1" : "0")).join(" ")).join("\n");
}
function parseCorrelationMatrix(input, size) {
    const trimmed = input.trim();
    if (!trimmed.length) {
        return undefined;
    }
    const rows = trimmed
        .split(/\n+/)
        .map((row) => row
        .trim()
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map(Number))
        .filter((row) => row.length);
    if (rows.length !== size) {
        throw new Error(`Ожидается ${size} строк в матрице корреляций.`);
    }
    rows.forEach((row) => {
        if (row.length !== size) {
            throw new Error(`Каждая строка должна содержать ${size} значений.`);
        }
        if (row.some((value) => Number.isNaN(value))) {
            throw new Error("Матрица содержит нечисловые значения.");
        }
    });
    return rows;
}
export default ThermalMonteCarloPanel;
