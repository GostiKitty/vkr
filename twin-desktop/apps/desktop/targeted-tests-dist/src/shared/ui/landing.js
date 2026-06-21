import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { IconFlame, IconModel, IconRisk, IconStatusOk, IconSun, IconThermometer, IconWind, } from "./icons";
// ─── Hero: app-window mockup ─────────────────────────────────────────────────
const BREAKDOWN_BARS = [
    { lbl: "Стены", w: "42%", c: "#3d82fa" },
    { lbl: "Окна", w: "28%", c: "#a3e635" },
    { lbl: "Перекр.", w: "18%", c: "#fac024" },
    { lbl: "Вентил.", w: "12%", c: "#f97316" },
];
export function HeroAppWindow() {
    return (_jsxs("div", { className: "lp-window ui-hero-appear--scale", style: { animationDelay: "180ms" }, children: [_jsxs("div", { className: "lp-window__bar", children: [_jsx("span", { className: "lp-window__dot lp-window__dot--red" }), _jsx("span", { className: "lp-window__dot lp-window__dot--yellow" }), _jsx("span", { className: "lp-window__dot lp-window__dot--green" }), _jsx("span", { className: "lp-window__title", children: "TherNest \u2014 \u0422\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0431\u0430\u043B\u0430\u043D\u0441" }), _jsx("span", { className: "lp-window__live", children: "\u25CF live" })] }), _jsxs("div", { className: "lp-window__body", children: [_jsxs("div", { className: "lp-win-grid", children: [_jsxs("div", { className: "lp-win-left", children: [_jsxs("div", { className: "lp-win-kpi", children: [_jsx("p", { className: "lp-win-kpi__lbl", children: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438" }), _jsxs("p", { className: "lp-win-kpi__big", children: ["8,6", _jsx("span", { className: "lp-win-kpi__unit", children: "\u043A\u0412\u0442" })] }), _jsx("div", { className: "lp-win-kpi__bar", "aria-hidden": true, children: _jsx("span", { className: "lp-win-kpi__bar-fill" }) })] }), _jsxs("div", { className: "lp-win-chips", children: [_jsxs("div", { className: "lp-win-chip", children: [_jsx("p", { className: "lp-win-chip__lbl", children: "R" }), _jsx("p", { className: "lp-win-chip__val", children: "3,24" })] }), _jsxs("div", { className: "lp-win-chip", children: [_jsx("p", { className: "lp-win-chip__lbl", children: "T\u00B0" }), _jsx("p", { className: "lp-win-chip__val", children: "21 \u00B0C" })] }), _jsxs("div", { className: "lp-win-chip lp-win-chip--ok", children: [_jsx("p", { className: "lp-win-chip__lbl", children: "\u0421\u041F 50" }), _jsx("p", { className: "lp-win-chip__val", children: "\u2713" })] })] })] }), _jsxs("div", { className: "lp-win-right", children: [_jsx("p", { className: "lp-win-right__ttl", children: "\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u043F\u043E\u0442\u0435\u0440\u044C" }), BREAKDOWN_BARS.map((row) => (_jsxs("div", { className: "lp-win-bar", children: [_jsx("span", { className: "lp-win-bar__lbl", children: row.lbl }), _jsx("div", { className: "lp-win-bar__track", "aria-hidden": true, children: _jsx("span", { className: "lp-win-bar__fill", style: { "--w": row.w, "--c": row.c } }) }), _jsx("span", { className: "lp-win-bar__pct", children: row.w })] }, row.lbl)))] })] }), _jsxs("div", { className: "lp-win-status", children: [_jsx(IconStatusOk, { size: 12 }), _jsx("span", { children: "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0421\u041F 50.1.327.2012 \u00B7 \u0413\u0421\u041E\u041F 5 618 \u00B0\u0421\u00B7\u0441\u0443\u0442" })] })] })] }));
}
// ─── Legacy visual (kept for backwards compat) ───────────────────────────────
export function DarkHeroVisual() {
    return _jsx(HeroAppWindow, {});
}
// ─── Hero scene illustration (flat house + meadow) ───────────────────────────
export function HeroScene({ className }) {
    return (_jsxs("svg", { className: className, viewBox: "0 0 1200 340", preserveAspectRatio: "xMidYMax slice", role: "img", "aria-label": "\u0414\u043E\u043C \u043D\u0430 \u043B\u0443\u0433\u0443 \u043F\u043E\u0434 \u0441\u043E\u043B\u043D\u0446\u0435\u043C", children: [_jsxs("g", { fill: "#bcd9ec", opacity: "0.7", children: [_jsx("rect", { x: "860", y: "170", width: "34", height: "80", rx: "2" }), _jsx("rect", { x: "900", y: "140", width: "40", height: "110", rx: "2" }), _jsx("rect", { x: "946", y: "186", width: "28", height: "64", rx: "2" }), _jsx("rect", { x: "980", y: "158", width: "46", height: "92", rx: "2" }), _jsx("rect", { x: "1032", y: "196", width: "30", height: "54", rx: "2" }), _jsx("rect", { x: "1068", y: "150", width: "40", height: "100", rx: "2" })] }), _jsx("path", { d: "M0 250 Q 300 200 620 235 T 1200 228 L1200 340 L0 340Z", fill: "#cdeccf" }), _jsx("path", { d: "M0 285 Q 360 250 720 280 T 1200 273 L1200 340 L0 340Z", fill: "#a9dca0" }), _jsx("path", { d: "M0 312 Q 420 292 820 308 T 1200 304 L1200 340 L0 340Z", fill: "#8ccd84" }), _jsxs("g", { transform: "translate(120 150)", children: [_jsx("rect", { x: "-8", y: "72", width: "16", height: "74", rx: "5", fill: "#9a6a45" }), _jsx("circle", { cx: "0", cy: "52", r: "52", fill: "#7cc06a" }), _jsx("circle", { cx: "-38", cy: "78", r: "33", fill: "#8fcd7c" }), _jsx("circle", { cx: "38", cy: "78", r: "33", fill: "#8fcd7c" })] }), _jsxs("g", { transform: "translate(300 110)", children: [_jsx("rect", { x: "178", y: "-8", width: "22", height: "54", rx: "3", fill: "#cf7d4d" }), _jsx("polygon", { points: "-12,72 120,-22 252,72", fill: "#e58a52" }), _jsx("rect", { x: "8", y: "70", width: "224", height: "118", rx: "8", fill: "#fdf2e2" }), _jsx("rect", { x: "92", y: "120", width: "56", height: "68", rx: "5", fill: "#a26f49" }), _jsx("circle", { cx: "136", cy: "156", r: "4", fill: "#f3cd84" }), _jsx("rect", { x: "34", y: "98", width: "46", height: "44", rx: "5", fill: "#bfe3ff", stroke: "#ffffff", strokeWidth: "6" }), _jsx("rect", { x: "160", y: "98", width: "46", height: "44", rx: "5", fill: "#bfe3ff", stroke: "#ffffff", strokeWidth: "6" })] }), [640, 700, 1150].map((x, i) => (_jsxs("g", { transform: `translate(${x} ${288 + (i % 2) * 6})`, children: [_jsx("rect", { x: "-2", y: "0", width: "4", height: "32", rx: "2", fill: "#5fa055" }), _jsx("circle", { cx: "0", cy: "-4", r: "8", fill: i === 1 ? "#f08aa6" : "#f6c945" }), _jsx("circle", { cx: "0", cy: "-4", r: "3.5", fill: "#e89c2a" })] }, x)))] }));
}
// ─── Hero device (light app window floating in the scene) ────────────────────
const DEVICE_BARS = [
    { lbl: "Стены", w: "42%", c: "#3d82fa" },
    { lbl: "Окна", w: "28%", c: "#22c55e" },
    { lbl: "Перекр.", w: "18%", c: "#f5a623" },
    { lbl: "Вентил.", w: "12%", c: "#f97316" },
];
export function HeroDevice() {
    return (_jsxs("div", { className: "lp3-device", children: [_jsxs("div", { className: "lp3-device__bar", children: [_jsx("span", { className: "lp3-device__dot", style: { background: "#ff5f57" } }), _jsx("span", { className: "lp3-device__dot", style: { background: "#febc2e" } }), _jsx("span", { className: "lp3-device__dot", style: { background: "#28c840" } }), _jsx("span", { className: "lp3-device__title", children: "TherNest \u2014 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0431\u0430\u043B\u0430\u043D\u0441" })] }), _jsxs("div", { className: "lp3-device__body", children: [_jsxs("div", { className: "lp3-device__kpi", children: [_jsx("p", { className: "lp3-device__kpi-lbl", children: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438" }), _jsxs("p", { className: "lp3-device__kpi-big", children: ["8,6", _jsx("span", { className: "lp3-device__kpi-unit", children: "\u043A\u0412\u0442" })] }), _jsx("div", { className: "lp3-device__kpi-bar", "aria-hidden": true, children: _jsx("span", { className: "lp3-device__kpi-fill" }) })] }), _jsx("div", { className: "lp3-device__bars", children: DEVICE_BARS.map((row) => (_jsxs("div", { className: "lp3-device__row", children: [_jsx("span", { className: "lp3-device__row-lbl", children: row.lbl }), _jsx("span", { className: "lp3-device__row-track", "aria-hidden": true, children: _jsx("span", { className: "lp3-device__row-fill", style: { width: row.w, background: row.c } }) })] }, row.lbl))) })] }), _jsxs("div", { className: "lp3-device__foot", children: [_jsx(IconStatusOk, { size: 12 }), "\u0421\u041F 50 \u00B7 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442"] })] }));
}
// ─── Platform mockup (zone graph + calculation log) ──────────────────────────
const GRAPH_NODES = [
    { label: "Геометрия", x: 50, y: 9, tone: "#3d82fa" },
    { label: "Ограждения", x: 89, y: 31, tone: "#22c55e" },
    { label: "Климат", x: 89, y: 71, tone: "#0ea5e9" },
    { label: "Режим", x: 50, y: 93, tone: "#f5a623" },
    { label: "Инфильтрация", x: 11, y: 71, tone: "#f97316" },
    { label: "Вентиляция", x: 11, y: 31, tone: "#8b5cf6" },
];
const LOG_ITEMS = [
    { name: "Геометрия", detail: "площадь 248 м², объём 712 м³", state: "ok" },
    { name: "Ограждения", detail: "R стен 3,24 · окна 0,62", state: "ok" },
    { name: "Климат", detail: "ГСОП 5 618 °С·сут", state: "ok" },
    { name: "Тепловой баланс", detail: "сведение потоков", state: "run" },
];
export function PlatformMockup() {
    return (_jsxs("div", { className: "lp3-platform", children: [_jsxs("div", { className: "lp3-platform__canvas", children: [_jsxs("div", { className: "lp3-platform__toolbar", children: [_jsx("span", { className: "lp3-platform__chip-sm", children: "\u0417\u0434\u0430\u043D\u0438\u0435 \u00B7 \u0434\u0435\u043C\u043E" }), _jsx("span", { className: "lp3-platform__zoom", children: "60%" })] }), _jsx("svg", { className: "lp3-platform__links", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": true, children: GRAPH_NODES.map((n) => (_jsx("line", { x1: "50", y1: "50", x2: n.x, y2: n.y, stroke: "#c7d4e2", strokeWidth: "0.5", strokeDasharray: "2 2" }, n.label))) }), _jsx("span", { className: "lp3-node lp3-node--center", style: { left: "50%", top: "50%" }, children: "\u0417\u0434\u0430\u043D\u0438\u0435" }), GRAPH_NODES.map((n) => (_jsxs("span", { className: "lp3-node", style: { left: `${n.x}%`, top: `${n.y}%` }, children: [_jsx("span", { className: "lp3-node__dot", style: { background: n.tone } }), n.label] }, n.label)))] }), _jsxs("aside", { className: "lp3-platform__panel", children: [_jsxs("div", { className: "lp3-platform__tabs", children: [_jsx("span", { className: "lp3-platform__tab lp3-platform__tab--active", children: "\u0420\u0430\u0441\u0447\u0451\u0442" }), _jsx("span", { className: "lp3-platform__tab", children: "\u041C\u043E\u0434\u0435\u043B\u044C" }), _jsx("span", { className: "lp3-platform__tab", children: "\u041E\u0442\u0447\u0451\u0442\u044B" })] }), _jsx("div", { className: "lp3-platform__log", children: LOG_ITEMS.map((it) => (_jsxs("div", { className: "lp3-logitem", children: [_jsx("span", { className: `lp3-logitem__icon lp3-logitem__icon--${it.state}`, "aria-hidden": true, children: it.state === "ok" ? "✓" : "" }), _jsxs("span", { className: "lp3-logitem__text", children: [_jsx("span", { className: "lp3-logitem__name", children: it.name }), _jsx("span", { className: "lp3-logitem__detail", children: it.detail })] }), _jsx("span", { className: `lp3-logitem__state lp3-logitem__state--${it.state}`, children: it.state === "ok" ? "готово" : "идёт" })] }, it.name))) }), _jsxs("div", { className: "lp3-platform__result", children: [_jsx("span", { children: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438" }), _jsx("b", { children: "8,6 \u043A\u0412\u0442" })] })] })] }));
}
// ─── Workflow steps ──────────────────────────────────────────────────────────
const FLOW_DATA = [
    { n: "01", title: "Геометрия" },
    { n: "02", title: "Погода" },
    { n: "03", title: "Данные" },
    { n: "04", title: "Расчёт" },
    { n: "05", title: "Отчёт" },
];
export function FlowSection({ onStep }) {
    return (_jsx("div", { className: "lp-flow", children: FLOW_DATA.map((s, i) => (_jsxs("button", { type: "button", onClick: () => onStep(i), className: "lp-flow-step", style: { ["--step-i"]: i }, children: [_jsx("span", { className: "lp-flow-step__n", "aria-hidden": true, children: s.n }), _jsx("span", { className: "lp-flow-step__title", children: s.title })] }, s.n))) }));
}
const FACTORS = [
    {
        icon: _jsx(IconModel, { size: 18 }),
        title: "Геометрия",
        hint: "Площадь, объём, периметр здания",
        tags: ["Aотапл", "Vотапл"],
        tone: "blue",
        color: "#3d82fa",
    },
    {
        icon: _jsx(IconThermometer, { size: 18 }),
        title: "Ограждения",
        hint: "Слои, окна, двери — тепловые сопротивления",
        tags: ["R, м²·°С/Вт", "U, Вт/м²·°С"],
        tone: "lime",
        color: "#65a30d",
    },
    {
        icon: _jsx(IconSun, { size: 18 }),
        title: "Климат",
        hint: "Расчётная наружная температура, ГСОП",
        tags: ["t°нар", "ГСОП"],
        tone: "mint",
        color: "#059669",
    },
    {
        icon: _jsx(IconFlame, { size: 18 }),
        title: "Режим",
        hint: "Внутренняя температура и расписание",
        tags: ["t°внутр", "ΔT"],
        tone: "yellow",
        color: "#b45309",
    },
    {
        icon: _jsx(IconRisk, { size: 18 }),
        title: "Инфильтрация",
        hint: "Неплотности ограждений — до 20% Q",
        tags: ["n, 1/ч", "β"],
        tone: "orange",
        color: "#c2410c",
    },
    {
        icon: _jsx(IconWind, { size: 18 }),
        title: "Вентиляция",
        hint: "Воздухообмен и рекуперация тепла",
        tags: ["GE, кг/ч", "η рек"],
        tone: "purple",
        color: "#6d28d9",
    },
];
const ORBIT_COUNT = FACTORS.length;
const NODE_RADIUS = 45;
const HUB_RADIUS = 13;
function orbitAngle(index) {
    return (index / ORBIT_COUNT) * 360 - 90;
}
function orbitPoint(index, radius) {
    const angleRad = (orbitAngle(index) * Math.PI) / 180;
    return {
        x: 50 + radius * Math.cos(angleRad),
        y: 50 + radius * Math.sin(angleRad),
        angleRad,
    };
}
function spokeEndpoints(index) {
    const start = orbitPoint(index, HUB_RADIUS);
    const end = orbitPoint(index, NODE_RADIUS);
    return { start, end };
}
export function InputFactorGrid() {
    const [active, setActive] = useState(null);
    const nodes = FACTORS.map((_, index) => orbitPoint(index, NODE_RADIUS));
    return (_jsx("div", { className: "lp-orbit", "aria-label": "\u0412\u0445\u043E\u0434\u043D\u044B\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0433\u043E \u0440\u0430\u0441\u0447\u0451\u0442\u0430", children: _jsxs("div", { className: "lp-orbit__stage", children: [_jsxs("svg", { className: "lp-orbit__svg", viewBox: "0 0 100 100", "aria-hidden": true, children: [_jsxs("defs", { children: [_jsxs("radialGradient", { id: "lp-orbit-aurora", cx: "50%", cy: "50%", r: "50%", children: [_jsx("stop", { offset: "0%", stopColor: "#3d82fa", stopOpacity: "0.22" }), _jsx("stop", { offset: "45%", stopColor: "#059669", stopOpacity: "0.08" }), _jsx("stop", { offset: "100%", stopColor: "#6d28d9", stopOpacity: "0" })] }), _jsxs("linearGradient", { id: "lp-orbit-ring-grad", gradientUnits: "userSpaceOnUse", x1: "10", y1: "10", x2: "90", y2: "90", children: [_jsx("stop", { offset: "0%", stopColor: "#3d82fa", stopOpacity: "0.5" }), _jsx("stop", { offset: "33%", stopColor: "#059669", stopOpacity: "0.35" }), _jsx("stop", { offset: "66%", stopColor: "#b45309", stopOpacity: "0.35" }), _jsx("stop", { offset: "100%", stopColor: "#6d28d9", stopOpacity: "0.5" })] })] }), _jsx("circle", { cx: "50", cy: "50", r: "34", fill: "url(#lp-orbit-aurora)", className: "lp-orbit__aurora" }), _jsx("g", { className: "lp-orbit__ring-wrap lp-orbit__ring-wrap--reverse", children: _jsx("circle", { cx: "50", cy: "50", r: NODE_RADIUS + 3, className: "lp-orbit__ring lp-orbit__ring--outer" }) }), _jsxs("g", { className: "lp-orbit__ring-wrap", children: [_jsx("circle", { cx: "50", cy: "50", r: NODE_RADIUS, className: "lp-orbit__ring lp-orbit__ring--grad" }), _jsx("circle", { cx: "50", cy: "50", r: NODE_RADIUS, className: "lp-orbit__ring lp-orbit__ring--trace" })] }), nodes.map((_node, index) => {
                            const factor = FACTORS[index];
                            const isActive = active === index;
                            const isDimmed = active !== null && !isActive;
                            const { start, end } = spokeEndpoints(index);
                            return (_jsxs("g", { className: [
                                    "lp-orbit__spoke-group",
                                    isActive ? "is-active" : "",
                                    isDimmed ? "is-dimmed" : "",
                                ].filter(Boolean).join(" "), style: { ["--node-color"]: factor.color }, children: [_jsx("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y, className: "lp-orbit__spoke lp-orbit__spoke--base" }), _jsx("line", { x1: start.x, y1: start.y, x2: end.x, y2: end.y, className: "lp-orbit__spoke lp-orbit__spoke--flow", style: { ["--spoke-i"]: index } }), _jsx("circle", { r: "0.65", className: "lp-orbit__pulse", children: _jsx("animateMotion", { dur: `${2.4 + index * 0.25}s`, repeatCount: "indefinite", path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, begin: `${index * 0.4}s` }) })] }, factor.title));
                        })] }), _jsx("div", { className: "lp-orbit__hub", children: _jsx("span", { className: "lp-orbit__hub-core", children: _jsx("span", { className: "lp-orbit__hub-title", children: "\u0418\u0442\u043E\u0433" }) }) }), FACTORS.map((factor, index) => {
                    const node = nodes[index];
                    const isActive = active === index;
                    return (_jsx("div", { className: ["lp-orbit__node", isActive ? "is-active" : ""].filter(Boolean).join(" "), title: factor.hint, onMouseEnter: () => setActive(index), onMouseLeave: () => setActive(null), onFocus: () => setActive(index), onBlur: () => setActive(null), tabIndex: 0, style: {
                            left: `${node.x}%`,
                            top: `${node.y}%`,
                            ["--node-i"]: index,
                            ["--node-color"]: factor.color,
                        }, children: _jsxs("div", { className: "lp-orbit__node-card", children: [_jsx("span", { className: "lp-orbit__node-dot", "aria-hidden": true }), _jsx("span", { className: "lp-orbit__node-title", children: factor.title })] }) }, factor.title));
                })] }) }));
}
// ─── Results dark belt ───────────────────────────────────────────────────────
const RESULT_TILES = [
    { stat: "Q", name: "Теплопотери", sub: "суммарные и удельные" },
    { stat: "T°", name: "Температура", sub: "по помещениям" },
    { stat: "R", name: "Тепловая защита", sub: "факт vs норма" },
    { stat: "5", name: "Форм отчётов", sub: "для экспертизы" },
];
export function ResultsDarkGrid() {
    return (_jsx("div", { className: "lp-results", children: RESULT_TILES.map((item, i) => (_jsxs("div", { className: "lp-result-tile", style: { ["--tile-delay"]: `${i * 65}ms` }, children: [_jsx("p", { className: "lp-result-tile__stat", children: item.stat }), _jsx("p", { className: "lp-result-tile__name", children: item.name }), _jsx("p", { className: "lp-result-tile__sub", children: item.sub })] }, item.stat))) }));
}
// ─── Legacy / shared components (kept for other pages) ──────────────────────
export function ProductHeroMockup() {
    return (_jsxs("div", { className: "ui-product-mockup ui-hero-appear--scale", style: { animationDelay: "180ms" }, children: [_jsx("div", { className: "ui-mockup-scanline", "aria-hidden": true }), _jsxs("div", { className: "relative z-[1] grid h-full min-h-[20rem] gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "ui-mockup-float flex flex-col justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: "2D-\u043F\u043B\u0430\u043D" }), _jsx("div", { className: "mt-3 grid grid-cols-3 gap-2", children: [0, 1, 2, 3, 4, 5].map((cell) => (_jsx("span", { className: "ui-mockup-cell aspect-square rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--workspace-canvas-bg)]", style: { ["--cell-delay"]: `${cell * 120}ms` } }, cell))) }), _jsx("p", { className: "mt-3 text-xs font-semibold text-[color:var(--text-muted)]", children: "\u0421\u0445\u0435\u043C\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0439" })] }), _jsxs("div", { className: "ui-mockup-float ui-mockup-float--delay flex flex-col justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: "3D-\u043C\u043E\u0434\u0435\u043B\u044C" }), _jsxs("div", { className: "mt-3 flex h-28 items-end justify-center gap-2", children: [_jsx("span", { className: "ui-mockup-bar h-16 w-10 rounded-t-2xl bg-[color:var(--blue-bright)]/80", style: { ["--bar-delay"]: "0ms" } }), _jsx("span", { className: "ui-mockup-bar h-24 w-14 rounded-t-2xl bg-[color:var(--blue-bright)]", style: { ["--bar-delay"]: "140ms" } }), _jsx("span", { className: "ui-mockup-bar h-20 w-11 rounded-t-2xl bg-[color:var(--blue-bright)]/70", style: { ["--bar-delay"]: "280ms" } })] }), _jsxs("div", { className: "mt-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-base)]", children: [_jsx(IconModel, { size: 18, className: "text-[color:var(--blue-bright)]" }), "\u0426\u0438\u0444\u0440\u043E\u0432\u043E\u0439 \u043A\u043E\u043D\u0442\u0443\u0440"] })] }), _jsxs("div", { className: "ui-mockup-float ui-mockup-float--delay-2 sm:col-span-2", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "ui-mockup-status flex items-center gap-2", children: [_jsx(IconStatusOk, { size: 18, className: "text-[color:var(--success-fg)]" }), _jsx("p", { className: "text-sm font-bold text-[color:var(--text-base)]", children: "\u0420\u0430\u0441\u0447\u0451\u0442 \u0433\u043E\u0442\u043E\u0432" })] }), _jsx("span", { className: "ui-mockup-live text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--blue-bright)]", children: "live" })] }), _jsx("div", { className: "ui-mockup-progress mt-2", "aria-hidden": true, children: _jsx("span", { className: "ui-mockup-progress__bar" }) }), _jsxs("div", { className: "mt-3 grid gap-2 sm:grid-cols-3", children: [_jsx(MetricChip, { label: "Q", value: "8,6 \u043A\u0412\u0442", delay: "0ms" }), _jsx(MetricChip, { label: "R", value: "3,24", delay: "80ms" }), _jsx(MetricChip, { label: "U", value: "0,31", delay: "160ms" })] })] })] })] }));
}
function MetricChip({ label, value, delay }) {
    return (_jsxs("div", { className: "ui-mockup-metric rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2", style: { ["--metric-delay"]: delay }, children: [_jsx("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: label }), _jsx("p", { className: "mt-0.5 text-base font-bold text-[color:var(--text-base)]", children: value })] }));
}
export function LandingImpactBanner({ children }) {
    return (_jsxs("p", { className: "ui-landing-impact", role: "note", children: [_jsx("span", { className: "ui-landing-impact__dot", "aria-hidden": true }), children] }));
}
export function StepChainHint() {
    const steps = ["Модель", "Данные", "Расчёт", "Отчёт"];
    return (_jsx("div", { className: "ui-step-chain", "aria-label": "\u041F\u043E\u0440\u044F\u0434\u043E\u043A \u0440\u0430\u0431\u043E\u0442\u044B", children: steps.flatMap((label, i) => {
            const pill = (_jsxs("span", { className: "ui-step-chain__pill", style: { ["--chain-delay"]: `${i * 72}ms` }, children: [_jsx("span", { className: "ui-step-chain__num", children: i + 1 }), label] }, label));
            return i < steps.length - 1
                ? [pill, _jsx("span", { className: "ui-step-chain__arrow", "aria-hidden": true, children: "\u203A" }, `a${i}`)]
                : [pill];
        }) }));
}
export function WorkflowPipeline({ steps }) {
    return (_jsxs("div", { className: "ui-workflow-pipeline", children: [_jsx("div", { className: "ui-workflow-pipeline__track", "aria-hidden": true, children: _jsx("span", { className: "ui-workflow-pipeline__flow" }) }), _jsx("ol", { className: "ui-workflow-pipeline__steps", children: steps.map((item, index) => (_jsx("li", { className: "ui-workflow-pipeline__item", children: _jsxs("button", { type: "button", onClick: item.onClick, className: `ui-workflow-step ui-workflow-step--${item.tone} ui-hover-lift`, style: { ["--step-delay"]: `${120 + index * 90}ms` }, children: [_jsx("span", { className: `ui-workflow-step__badge ui-workflow-step__badge--${item.tone}`, children: item.step }), _jsx("span", { className: "ui-workflow-step__icon", children: item.icon }), _jsx("span", { className: "ui-workflow-step__title", children: item.title }), _jsx("span", { className: "ui-workflow-step__hint", children: item.hint }), _jsx("span", { className: "ui-workflow-step__tags", children: item.tags.map((tag) => (_jsx("span", { className: "ui-workflow-step__tag", children: tag }, tag))) })] }) }, item.step))) })] }));
}
export function QuickActionTile({ title, hint, icon, onClick, tone = "neutral", }) {
    const toneClass = tone === "accent" ? "ui-quick-tile--accent" : tone === "primary" ? "ui-quick-tile--primary" : "";
    return (_jsxs("button", { type: "button", onClick: onClick, className: `ui-quick-tile ui-hover-lift ${toneClass}`, children: [_jsx("span", { className: "ui-quick-tile__icon", children: icon }), _jsx("span", { className: "ui-quick-tile__title", children: title }), _jsx("span", { className: "ui-quick-tile__hint", children: hint })] }));
}
export function InsightTile({ title, stat, description }) {
    return (_jsxs("div", { className: "ui-insight-card", children: [stat && _jsx("p", { className: "ui-insight-stat", children: stat }), _jsx("p", { className: "text-sm font-bold", children: title }), _jsx("p", { className: "mt-1 text-sm opacity-80", children: description })] }));
}
export function WorkflowFeatureCard({ step, title, description, tone, icon, }) {
    const ribbonClass = tone === "lime" ? "ui-feature-card__ribbon--lime" : tone === "yellow" ? "ui-feature-card__ribbon--yellow" : "ui-feature-card__ribbon--blue";
    return (_jsxs("article", { className: "ui-feature-card ui-hover-lift", children: [_jsx("div", { className: `ui-feature-card__ribbon ${ribbonClass}`, children: step }), _jsx("div", { className: "mb-3 text-[color:var(--blue-bright)]", children: icon }), _jsx("h3", { className: "ui-heading-card", children: title }), _jsx("p", { className: "mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]", children: description })] }));
}
export function WorkspaceDarkPreview() {
    return (_jsxs("div", { className: "ui-workspace-preview", children: [_jsxs("div", { className: "ui-workspace-preview__chrome", children: [_jsx("span", { className: "ui-workspace-preview__dot" }), _jsx("span", { className: "ui-workspace-preview__dot" }), _jsx("span", { className: "ui-workspace-preview__dot" }), _jsx("span", { className: "ml-2 text-xs font-semibold text-white/70", children: "TherNest \u00B7 \u0440\u0430\u0431\u043E\u0447\u0435\u0435 \u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u043E" })] }), _jsxs("div", { className: "grid gap-3 lg:grid-cols-[11rem,minmax(0,1fr),12rem]", children: [_jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-3", children: [_jsx("p", { className: "text-sm font-semibold text-white/70", children: "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B" }), _jsx("div", { className: "mt-3 grid gap-2", children: ["Стена", "Помещение", "Окно"].map((tool) => (_jsx("div", { className: "rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/85", children: tool }, tool))) })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-[#10233f] p-3", children: [_jsxs("div", { className: "mb-3 inline-flex rounded-full border border-white/10 bg-white/10 p-1", children: [_jsx("span", { className: "rounded-full bg-[color:var(--lime-bright)] px-3 py-1 text-[11px] font-bold text-[color:var(--navy-deep)]", children: "2D-\u0447\u0435\u0440\u0442\u0451\u0436" }), _jsx("span", { className: "px-3 py-1 text-[11px] font-semibold text-white/65", children: "3D-\u043C\u043E\u0434\u0435\u043B\u044C" })] }), _jsx("div", { className: "grid h-40 place-items-center rounded-2xl border border-dashed border-white/15 bg-[#0d1c33]", children: _jsx(IconModel, { size: 32, className: "text-[color:var(--blue-bright)]" }) })] }), _jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/5 p-3", children: [_jsx("p", { className: "text-sm font-semibold text-white/70", children: "\u0421\u0432\u043E\u0439\u0441\u0442\u0432\u0430" }), _jsxs("dl", { className: "mt-3 space-y-2 text-xs text-white/75", children: [_jsxs("div", { className: "flex justify-between gap-2", children: [_jsx("dt", { children: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" }), _jsx("dd", { className: "font-semibold text-white", children: "\u041A\u0438\u0440\u043F\u0438\u0447" })] }), _jsxs("div", { className: "flex justify-between gap-2", children: [_jsx("dt", { children: "R" }), _jsx("dd", { className: "font-semibold text-white", children: "3,24" })] }), _jsxs("div", { className: "flex items-center justify-end gap-1 text-[color:var(--lime-bright)]", children: [_jsx(IconThermometer, { size: 14 }), _jsx("span", { className: "font-semibold", children: "21 \u00B0C" })] })] })] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [_jsx("span", { className: "rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80", children: "\u0420\u0430\u0441\u0447\u0451\u0442" }), _jsx("span", { className: "rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80", children: "\u041E\u0442\u0447\u0451\u0442\u044B" }), _jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80", children: [_jsx(IconWind, { size: 12 }), "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438"] })] })] }));
}
export function DocumentPreviewStack() {
    const docs = ["Энергетический паспорт", "Расчёт тепловой защиты", "Инженерное заключение"];
    return (_jsx("div", { className: "space-y-3", children: docs.map((title, index) => (_jsxs("div", { className: "rounded-[28px] border border-[color:var(--border-soft)] bg-white px-5 py-4 shadow-[0_20px_50px_-32px_rgba(8,17,31,0.35)]", style: { transform: `translateX(${index * 6}px)` }, children: [_jsxs("p", { className: "text-sm font-semibold text-[color:var(--text-muted)]", children: ["\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 ", index + 1] }), _jsx("p", { className: "mt-1 text-lg font-bold text-[color:var(--text-base)]", children: title }), _jsx("p", { className: "mt-1 text-sm text-[color:var(--text-muted)]", children: "\u0413\u043E\u0442\u043E\u0432 \u043A \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0443 \u043F\u043E\u0441\u043B\u0435 \u0440\u0430\u0441\u0447\u0451\u0442\u0430." })] }, title))) }));
}
