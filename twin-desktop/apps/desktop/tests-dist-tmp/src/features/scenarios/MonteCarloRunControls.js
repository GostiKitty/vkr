import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { THERMAL_MONTE_CARLO_MAX_RUNS } from "../../core/uncertainty/thermalMonteCarlo";
import { useBuildStore } from "../build/build.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { EngineeringCallout } from "../../shared/ui";
import { formatNumber } from "../../shared/utils/format";
import { DEFAULT_MONTE_CARLO_RUNS, clampMonteCarloRuns, runThermalMonteCarloAnalysis, } from "./runThermalMonteCarloAnalysis";
const MONTE_CARLO_EVALUATION_MODE = "full-physics";
const RUN_PRESETS = [50, 100, 200, 400];
export function MonteCarloRunControls() {
    const config = useWorkflowStore((state) => state.uncertaintyConfig);
    const setConfig = useWorkflowStore((state) => state.setUncertaintyConfig);
    const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
    const buildModel = useBuildStore((state) => state.model);
    const [runs, setRuns] = useState(config?.runs ?? DEFAULT_MONTE_CARLO_RUNS);
    const [mcRunning, setMcRunning] = useState(false);
    const [mcError, setMcError] = useState(null);
    const [hasSaved, setHasSaved] = useState(false);
    useEffect(() => {
        if (config) {
            setRuns(clampMonteCarloRuns(config.runs));
        }
    }, [config]);
    const persistConfig = useCallback((nextRuns) => {
        setConfig({ runs: nextRuns, evaluationMode: MONTE_CARLO_EVALUATION_MODE });
    }, [setConfig]);
    const applyRuns = useCallback((value) => {
        setRuns(clampMonteCarloRuns(value));
    }, []);
    const handleReset = () => {
        applyRuns(DEFAULT_MONTE_CARLO_RUNS);
    };
    const handleSubmit = (event) => {
        event.preventDefault();
        const nextRuns = clampMonteCarloRuns(runs);
        setRuns(nextRuns);
        persistConfig(nextRuns);
        setHasSaved(true);
        setTimeout(() => setHasSaved(false), 1500);
    };
    const handleRunMonteCarlo = useCallback(() => {
        if (!buildModel.rooms.length) {
            setMcError("Добавьте помещения в конструкторе перед анализом рисков.");
            return;
        }
        setMcRunning(true);
        setMcError(null);
        try {
            const nextRuns = clampMonteCarloRuns(runs);
            setRuns(nextRuns);
            persistConfig(nextRuns);
            runThermalMonteCarloAnalysis();
            setCurrentStep("results");
        }
        catch (error) {
            setMcError(error instanceof Error ? error.message : "Не удалось выполнить Monte Carlo.");
        }
        finally {
            setMcRunning(false);
        }
    }, [buildModel.rooms.length, persistConfig, runs, setCurrentStep]);
    const isDefaultRuns = runs === DEFAULT_MONTE_CARLO_RUNS;
    return (_jsx("section", { className: "ui-chart-shell", "data-testid": "monte-carlo-run-controls", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsx("h3", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B Monte Carlo" }), _jsxs("div", { className: "ui-mc-controls__field", children: [_jsxs("div", { className: "ui-mc-controls__label-row", children: [_jsx("label", { htmlFor: "monte-carlo-runs", className: "ui-mc-controls__label", children: "\u0427\u0438\u0441\u043B\u043E \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432" }), _jsxs("span", { className: "ui-mc-controls__range", children: ["1\u2013", formatNumber(THERMAL_MONTE_CARLO_MAX_RUNS, { maximumFractionDigits: 0 })] })] }), _jsxs("div", { className: "ui-mc-controls__input-row", children: [_jsx("button", { type: "button", className: "ui-mc-controls__step", "aria-label": "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C \u0447\u0438\u0441\u043B\u043E \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432 \u043D\u0430 10", onClick: () => applyRuns(runs - 10), children: "\u221210" }), _jsx("input", { id: "monte-carlo-runs", type: "number", min: 1, max: THERMAL_MONTE_CARLO_MAX_RUNS, value: runs, onChange: (event) => applyRuns(Number(event.target.value)), className: "ui-mc-controls__input ui-field px-3 py-2 shadow-inner" }), _jsx("button", { type: "button", className: "ui-mc-controls__step", "aria-label": "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u0447\u0438\u0441\u043B\u043E \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432 \u043D\u0430 10", onClick: () => applyRuns(runs + 10), children: "+10" })] }), _jsx("div", { className: "ui-mc-controls__presets", role: "group", "aria-label": "\u0411\u044B\u0441\u0442\u0440\u044B\u0439 \u0432\u044B\u0431\u043E\u0440 \u0447\u0438\u0441\u043B\u0430 \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432", children: RUN_PRESETS.map((preset) => (_jsx("button", { type: "button", onClick: () => applyRuns(preset), className: `ui-mc-controls__preset${runs === preset ? " ui-mc-controls__preset--active" : ""}`, children: preset }, preset))) })] }), _jsxs("div", { className: "ui-mc-controls__actions", children: [_jsxs("div", { className: "ui-mc-controls__actions-secondary", children: [_jsx("button", { type: "button", onClick: handleReset, disabled: isDefaultRuns, className: "ui-btn-secondary px-4 py-2 text-sm disabled:opacity-45", children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C" }), _jsx("button", { type: "submit", className: "ui-btn-secondary px-4 py-2 text-sm", children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" })] }), _jsx("button", { type: "button", onClick: handleRunMonteCarlo, disabled: mcRunning, className: "ui-btn-primary px-5 py-2.5 text-sm disabled:opacity-60", children: mcRunning ? "Прогон…" : "Запустить Monte Carlo" })] }), mcError ? (_jsx(EngineeringCallout, { variant: "risk", title: "\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0433\u043E\u043D\u0430", children: _jsx("p", { children: mcError }) })) : null, hasSaved ? (_jsx(EngineeringCallout, { variant: "success", title: "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E", children: _jsx("p", { children: "\u0427\u0438\u0441\u043B\u043E \u043F\u0440\u043E\u0433\u043E\u043D\u043E\u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E. \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 Monte Carlo, \u0447\u0442\u043E\u0431\u044B \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F." }) })) : null] }) }));
}
export default MonteCarloRunControls;
