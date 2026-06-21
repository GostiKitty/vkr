import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState, } from "react";
import { Badge } from "./Badge";
import { AutoCalculatedSourceIcon } from "./AutoCalculatedSourceIcon";
import { MetricInfoTooltip } from "./FormulaTooltip";
const STATUS_CLASS = {
    neutral: "ui-status-badge ui-status-badge--neutral",
    info: "ui-status-badge ui-status-badge--info",
    success: "ui-status-badge ui-status-badge--success",
    warning: "ui-status-badge ui-status-badge--warning",
    error: "ui-status-badge ui-status-badge--error",
};
function joinClasses(...values) {
    return values.filter(Boolean).join(" ");
}
function useReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) {
            return;
        }
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);
    return reduced;
}
function useAnimatedNumber(targetValue, precision, durationMs, enabled) {
    const reducedMotion = useReducedMotion();
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (targetValue == null) {
            setValue(0);
            return;
        }
        if (!enabled || reducedMotion) {
            setValue(targetValue);
            return;
        }
        const start = performance.now();
        let frameId = 0;
        const animate = (now) => {
            const progress = Math.min((now - start) / durationMs, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(targetValue * eased);
            if (progress < 1) {
                frameId = window.requestAnimationFrame(animate);
            }
        };
        frameId = window.requestAnimationFrame(animate);
        return () => window.cancelAnimationFrame(frameId);
    }, [durationMs, enabled, precision, reducedMotion, targetValue]);
    if (targetValue == null) {
        return "—";
    }
    return value.toLocaleString("ru-RU", {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    });
}
function SectionShellChevron({ open }) {
    return (_jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", className: joinClasses("ui-section-shell__chevron", open && "ui-section-shell__chevron--open"), children: _jsx("path", { d: "M6 9l6 6 6-6", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
export function SectionShell({ title, description, kicker, action, children, className, collapsible = false, open: controlledOpen, defaultOpen = true, onOpenChange, }) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
    const bodyId = useRef(`section-shell-${Math.random().toString(36).slice(2, 9)}`).current;
    const setOpen = (nextOpen) => {
        if (!isControlled) {
            setUncontrolledOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };
    const titleBlock = (_jsxs("div", { className: "space-y-2", children: [kicker ? _jsx("p", { className: "ui-kicker", children: kicker }) : null, _jsx("h2", { className: "ui-section-shell__title", children: title }), description ? _jsx("p", { className: "ui-section-shell__description", children: description }) : null] }));
    return (_jsxs("section", { className: joinClasses("ui-section-shell", collapsible && "ui-section-shell--collapsible", collapsible && !isOpen && "ui-section-shell--collapsed", className), children: [_jsxs("header", { className: "ui-section-shell__header", children: [collapsible ? (_jsxs("button", { type: "button", className: "ui-section-shell__toggle", "aria-expanded": isOpen, "aria-controls": bodyId, onClick: () => setOpen(!isOpen), children: [titleBlock, _jsx(SectionShellChevron, { open: isOpen })] })) : (titleBlock), action ? _jsx("div", { className: "ui-section-shell__action", children: action }) : null] }), (!collapsible || isOpen) && (_jsx("div", { id: bodyId, className: "ui-section-shell__body", children: children }))] }));
}
export function StatusBadge({ tone = "neutral", children }) {
    return _jsx("span", { className: STATUS_CLASS[tone], children: children });
}
export function CalculatedMetricSourceBadge({ info }) {
    return (_jsx(MetricInfoTooltip, { title: info.title, formula: info.formula, linkedFormulaIds: info.linkedFormulaIds, className: "inline-flex shrink-0", children: _jsx(Badge, { tone: "success", className: "ui-build-badge--icon-only", children: _jsx(AutoCalculatedSourceIcon, { size: 20 }) }) }));
}
function MetricCardStatus({ value, status, metricInfo, }) {
    if (metricInfo && value == null) {
        return _jsx(StatusBadge, { tone: "warning", children: "\u041D\u0435\u0442 \u0440\u0430\u0441\u0447\u0451\u0442\u0430" });
    }
    if (metricInfo) {
        return null;
    }
    return _jsx(StatusBadge, { tone: status, children: mapStatusLabel(status) });
}
export function MetricCard({ label, value, unit, formula, subtitle, precision = 2, status = "neutral", icon, trend, animateValue = true, metricInfo, }) {
    const display = useAnimatedNumber(value, precision, 1000, animateValue);
    const showCalculatedBadge = metricInfo != null && value != null;
    const showStatusBadge = metricInfo ? value == null : true;
    const showStatusRow = showStatusBadge || trend != null;
    return (_jsxs("article", { className: "ui-metric-card ui-hover-lift group", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "ui-metric-card__label", children: label }), formula ? _jsx("p", { className: "ui-metric-card__formula", children: formula }) : null] }), showCalculatedBadge || icon ? (_jsxs("div", { className: "ui-metric-card__icons", children: [showCalculatedBadge ? (_jsx("span", { className: "ui-metric-card__source-badge", children: _jsx(CalculatedMetricSourceBadge, { info: metricInfo }) })) : null, icon ? _jsx("span", { className: "ui-metric-card__icon ui-icon-tap", children: icon }) : null] })) : null] }), _jsxs("div", { className: "mt-4 flex items-end gap-2", children: [_jsx("p", { className: "ui-metric-card__value", children: display }), unit ? _jsx("p", { className: "ui-metric-card__unit", children: unit }) : null] }), showStatusRow ? (_jsxs("div", { className: "mt-3 flex items-center justify-between gap-2", children: [showStatusBadge ? (_jsx(MetricCardStatus, { value: value, status: status, metricInfo: metricInfo })) : null, trend ? _jsx("span", { className: "ui-metric-card__trend", children: trend }) : null] })) : null, subtitle ? _jsx("p", { className: "ui-metric-card__subtitle", children: subtitle }) : null] }));
}
function mapStatusLabel(status) {
    switch (status) {
        case "success":
            return "Расчёт выполнен";
        case "warning":
            return "Есть предупреждения";
        case "error":
            return "Нужна проверка";
        case "info":
            return "Инженерные данные";
        default:
            return "Статус";
    }
}
export function FormulaCard({ title, formula, description, parameters, }) {
    return (_jsxs("article", { className: "ui-formula-card", children: [_jsx("p", { className: "ui-formula-card__title", children: title }), _jsx("p", { className: "ui-formula-card__formula", children: formula }), _jsx("p", { className: "ui-formula-card__description", children: description }), _jsx("ul", { className: "ui-formula-card__list", children: parameters.map((parameter) => (_jsx("li", { children: parameter }, parameter))) })] }));
}
export function EngineeringPanel({ title, description, children, className, }) {
    return (_jsxs("section", { className: joinClasses("ui-engineering-panel", className), children: [_jsxs("header", { className: "space-y-1", children: [_jsx("h3", { className: "ui-engineering-panel__title", children: title }), description ? _jsx("p", { className: "ui-engineering-panel__description", children: description }) : null] }), _jsx("div", { className: "mt-4", children: children })] }));
}
export function ResultSummaryCard({ totalHeatLossKW, specificHeatLoss, weakElement, weakElementLabel = "Наиболее слабая конструкция", recommendation, totalHeatLossMetricInfo, specificHeatLossMetricInfo, }) {
    return (_jsx(EngineeringPanel, { title: "\u0418\u0442\u043E\u0433 \u0440\u0430\u0441\u0447\u0451\u0442\u0430", className: "ui-result-summary-card", children: _jsxs("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(MetricCard, { label: "\u0421\u0443\u043C\u043C\u0430\u0440\u043D\u044B\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438", value: totalHeatLossKW, unit: "\u043A\u0412\u0442", precision: 2, status: totalHeatLossKW != null ? "success" : "warning", metricInfo: totalHeatLossMetricInfo }), _jsx(MetricCard, { label: "\u0423\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0442\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438", value: specificHeatLoss, unit: "\u0412\u0442/\u043C\u00B2", precision: 1, status: specificHeatLoss != null ? "info" : "warning", metricInfo: specificHeatLossMetricInfo }), _jsxs("article", { className: "ui-result-note-card", children: [_jsx("p", { className: "ui-result-note-card__label", children: weakElementLabel }), _jsx("p", { className: "ui-result-note-card__value", children: weakElement ?? "Определится после расчёта" })] }), _jsxs("article", { className: "ui-result-note-card", children: [_jsx("p", { className: "ui-result-note-card__label", children: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u044F" }), _jsx("p", { className: "ui-result-note-card__value", children: recommendation ?? "После расчёта появится автоматический инженерный комментарий." })] })] }) }));
}
export function ReportPreviewCard({ title = "Предпросмотр отчёта", 
// Temporarily hidden from UI. Will be restored after project documentation export redesign.
// Прежний набор разделов (тепловая защита, энергопаспорт, заключение) перенесён
// в нейтральный список расчётных сводок.
sections = [
    "Исходные данные проекта",
    "Расчётная сводка по теплопотерям",
    "Метрики помещений и динамика",
], status = "Отчёт ещё не сформирован", loading = false, onExport, exportLabel = "Экспорт отчёта", }) {
    return (_jsxs("section", { className: "ui-report-preview-card", children: [_jsxs("div", { className: "ui-report-preview-card__sheet", children: [_jsx("p", { className: "ui-report-preview-card__title", children: title }), _jsx("ul", { className: "ui-report-preview-card__list", children: sections.map((section) => (_jsx("li", { children: section }, section))) })] }), _jsxs("div", { className: "ui-report-preview-card__footer", children: [_jsx(StatusBadge, { tone: loading ? "info" : status.includes("сформирован") ? "success" : "warning", children: status }), _jsx("button", { type: "button", onClick: onExport, disabled: loading || !onExport, className: "ui-btn-primary", children: loading ? "Формирование..." : exportLabel })] })] }));
}
export function AnimatedTabs({ value, onChange, className, tabs, }) {
    const containerRef = useRef(null);
    const buttonRefs = useRef({});
    const [indicator, setIndicator] = useState({ width: 0, left: 0 });
    const reducedMotion = useReducedMotion();
    useLayoutEffect(() => {
        const container = containerRef.current;
        const activeButton = buttonRefs.current[value];
        if (!container || !activeButton) {
            return;
        }
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        setIndicator({
            width: buttonRect.width,
            left: buttonRect.left - containerRect.left,
        });
    }, [tabs, value]);
    return (_jsxs("div", { ref: containerRef, className: joinClasses("ui-animated-tabs ui-tabs-track", className), role: "tablist", children: [_jsx("span", { className: "ui-animated-tabs__indicator", style: {
                    width: indicator.width,
                    transform: `translateX(${indicator.left}px)`,
                    transitionDuration: reducedMotion ? "0ms" : "220ms",
                } }), tabs.map((tab) => {
                const isActive = tab.id === value;
                return (_jsxs("button", { ref: (element) => {
                        buttonRefs.current[tab.id] = element;
                    }, type: "button", role: "tab", disabled: tab.disabled, title: tab.hint, "aria-selected": isActive, onClick: () => !tab.disabled && onChange(tab.id), className: joinClasses("ui-animated-tabs__tab", isActive && "ui-animated-tabs__tab--active", tab.disabled && "ui-animated-tabs__tab--disabled"), children: [tab.label, tab.badge] }, tab.id));
            })] }));
}
export function CalculationProgress({ title = "Идёт инженерный расчёт", running, completed, steps, activeStep, error, }) {
    const completedCount = completed ? steps.length : Math.max(0, Math.min(steps.length, activeStep));
    const progressPercent = steps.length === 0 ? 0 : Math.round((completedCount / steps.length) * 100);
    return (_jsxs("section", { className: "ui-calculation-progress", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h3", { className: "ui-calculation-progress__title", children: title }), _jsx(StatusBadge, { tone: error ? "error" : completed ? "success" : running ? "info" : "warning", children: error
                            ? "Ошибка расчёта"
                            : completed
                                ? "Расчёт выполнен"
                                : running
                                    ? "В процессе"
                                    : "Требуются исходные данные" })] }), _jsx("div", { className: "ui-calculation-progress__bar-wrap", children: _jsx("div", { className: "ui-calculation-progress__bar", style: { width: `${progressPercent}%` } }) }), _jsx("ol", { className: "ui-calculation-progress__steps", children: steps.map((step, index) => {
                    const stepState = completed || index < activeStep ? "done" : index === activeStep ? "active" : "idle";
                    return (_jsxs("li", { className: `ui-calculation-progress__step ui-calculation-progress__step--${stepState}`, children: [_jsx("span", { className: "ui-calculation-progress__dot" }), _jsx("span", { children: step })] }, step));
                }) }), error ? _jsx("p", { className: "ui-calculation-progress__error", children: error }) : null] }));
}
