import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function baseProps(size) {
    return {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        "aria-hidden": true,
    };
}
export function IconModel({ size = 20, ...rest }) {
    const s = size ?? 20;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("path", { d: "M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }), _jsx("path", { d: "M4 8.5 12 13l8-4.5M12 13v7", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }));
}
export function IconThermometer({ size = 20, ...rest }) {
    const s = size ?? 20;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("path", { d: "M10 3.5v11.3a4 4 0 1 0 4 0V3.5a2 2 0 1 0-4 0Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }), _jsx("circle", { cx: "12", cy: "17", r: "1.5", fill: "currentColor" })] }));
}
export function IconFlame({ size = 20, ...rest }) {
    const s = size ?? 20;
    return (_jsx("svg", { ...baseProps(s), ...rest, children: _jsx("path", { d: "M12 3s2.5 2.2 2.5 5c0-1.2 1.2-2 2-1.5C18 8.5 19 11 19 14a7 7 0 1 1-14 0c0-2.2 1-4.5 3-6 .8-.6 2 .3 2 1.5 0-2.8 2.5-5 2.5-5Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }) }));
}
export function IconHeatLoss({ size = 20, ...rest }) {
    const s = size ?? 20;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("path", { d: "M6 18h12M8 14l4-10 4 10", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("path", { d: "M9.5 11h5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }));
}
export function IconWind({ size = 20, ...rest }) {
    const s = size ?? 20;
    return (_jsx("svg", { ...baseProps(s), ...rest, children: _jsx("path", { d: "M4 8h11a2 2 0 1 0-2-2M6 12h13a2 2 0 1 1-2 2M8 16h9", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) }));
}
export function IconSp50({ size = 20, ...rest }) {
    const s = size ?? 20;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("rect", { x: "5", y: "4", width: "14", height: "16", rx: "2", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("path", { d: "M8 8h8M8 11h6M8 14h8", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round" })] }));
}
export function IconDice({ size = 20, ...rest }) {
    const s = size ?? 20;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("rect", { x: "5", y: "5", width: "14", height: "14", rx: "2.5", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("circle", { cx: "9", cy: "9", r: "1.2", fill: "currentColor" }), _jsx("circle", { cx: "15", cy: "9", r: "1.2", fill: "currentColor" }), _jsx("circle", { cx: "12", cy: "12", r: "1.2", fill: "currentColor" }), _jsx("circle", { cx: "9", cy: "15", r: "1.2", fill: "currentColor" }), _jsx("circle", { cx: "15", cy: "15", r: "1.2", fill: "currentColor" })] }));
}
export function IconRisk({ size = 20, ...rest }) {
    const s = size ?? 20;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("path", { d: "M12 4 4 8v4c0 5 4 8 8 8s8-3 8-8V8l-8-4Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }), _jsx("path", { d: "M12 9v4M12 16h.01", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round" })] }));
}
export function IconReport({ size = 20, ...rest }) {
    const s = size ?? 20;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("path", { d: "M8 4h8l3 3v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }), _jsx("path", { d: "M8 9h8M8 13h6", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round" })] }));
}
export function IconStatusOk({ size = 18, ...rest }) {
    const s = size ?? 18;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("circle", { cx: "12", cy: "12", r: "8", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("path", { d: "M8.5 12.2 11 14.7 15.5 9.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
export function IconStatusWarn({ size = 18, ...rest }) {
    const s = size ?? 18;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("path", { d: "M12 4 3 19h18L12 4Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }), _jsx("path", { d: "M12 9v5M12 16h.01", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round" })] }));
}
export function IconStatusError({ size = 18, ...rest }) {
    const s = size ?? 18;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("circle", { cx: "12", cy: "12", r: "8", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("path", { d: "M9 9l6 6M15 9l-6 6", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }));
}
export function IconSun({ size = 18, ...rest }) {
    const s = size ?? 18;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("circle", { cx: "12", cy: "12", r: "3.5", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("path", { d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }));
}
export function IconMoon({ size = 18, ...rest }) {
    const s = size ?? 18;
    return (_jsx("svg", { ...baseProps(s), ...rest, children: _jsx("path", { d: "M10 4a8 8 0 1 0 8 8 6 6 0 0 1-8-8Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }) }));
}
export function IconMonitor({ size = 18, ...rest }) {
    const s = size ?? 18;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("rect", { x: "4", y: "5", width: "16", height: "11", rx: "1.5", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("path", { d: "M8 19h8M12 16v3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }));
}
export function IconInfo({ size = 18, ...rest }) {
    const s = size ?? 18;
    return (_jsxs("svg", { ...baseProps(s), ...rest, children: [_jsx("circle", { cx: "12", cy: "12", r: "8", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("path", { d: "M12 10v5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("circle", { cx: "12", cy: "7.25", r: "1", fill: "currentColor" })] }));
}
