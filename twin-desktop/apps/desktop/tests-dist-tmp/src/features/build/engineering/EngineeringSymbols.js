import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
function paletteForState(state, monochrome) {
    if (state === "error") {
        return { stroke: "#9f1239", fill: "#fff1f2", accent: "#e11d48", strokeWidth: 1.8, opacity: 1 };
    }
    if (state === "warning") {
        return { stroke: "#92400e", fill: "#fff7ed", accent: "#ea580c", strokeWidth: 1.75, opacity: 1 };
    }
    if (state === "selected") {
        return {
            stroke: monochrome ? "#0f172a" : "#0f4c81",
            fill: "#ffffff",
            accent: monochrome ? "#0f172a" : "#2563eb",
            strokeWidth: 1.9,
            opacity: 1,
        };
    }
    if (state === "hover") {
        return {
            stroke: monochrome ? "#334155" : "#0f766e",
            fill: "#ffffff",
            accent: monochrome ? "#334155" : "#0ea5a4",
            strokeWidth: 1.75,
            opacity: 1,
        };
    }
    if (state === "disabled") {
        return { stroke: "#94a3b8", fill: "#f8fafc", accent: "#cbd5e1", strokeWidth: 1.4, opacity: 0.72 };
    }
    return {
        stroke: monochrome ? "#1f2937" : "#111827",
        fill: "#ffffff",
        accent: monochrome ? "#111827" : "#0f172a",
        strokeWidth: 1.55,
        opacity: 0.98,
    };
}
function symbolFrame({ cx, cy, palette }, children) {
    return (_jsx("g", { transform: `translate(${cx}, ${cy})`, fill: "none", stroke: palette.stroke, strokeWidth: palette.strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", opacity: palette.opacity, children: children }));
}
function radiator(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("line", { x1: -11, y1: -5, x2: 11, y2: -5 }), _jsx("line", { x1: -11, y1: 5, x2: 11, y2: 5 }), [-8, -4, 0, 4, 8].map((x) => (_jsx("line", { x1: x, y1: -4, x2: x, y2: 4 }, x)))] }));
}
function pump(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("circle", { cx: 0, cy: 0, r: 8 }), _jsx("path", { d: "M -3.5 3 L 5 0 L -3.5 -3 Z", fill: props.palette.accent, stroke: "none" })] }));
}
function boiler(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("rect", { x: -9, y: -9, width: 18, height: 16, rx: 1.5, fill: props.palette.fill }), _jsx("path", { d: "M -6 9 Q -3 5.5 0 9 T 6 9" })] }));
}
function heatExchanger(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("rect", { x: -10, y: -6, width: 20, height: 12, fill: props.palette.fill }), [-4, 0, 4].map((x) => (_jsx("line", { x1: x, y1: -4.5, x2: x, y2: 4.5 }, x))), _jsx("line", { x1: -12, y1: -3, x2: -10, y2: -3 }), _jsx("line", { x1: -12, y1: 3, x2: -10, y2: 3 }), _jsx("line", { x1: 10, y1: -3, x2: 12, y2: -3 }), _jsx("line", { x1: 10, y1: 3, x2: 12, y2: 3 })] }));
}
function expansionTank(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("ellipse", { cx: 0, cy: 0, rx: 10, ry: 5 }), _jsx("line", { x1: 0, y1: -5, x2: 0, y2: -9 })] }));
}
function dirtSeparator(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("path", { d: "M -5 -8 L 5 -8 L 5 -1 L 0 8 L -5 -1 Z", fill: props.palette.fill }), _jsx("line", { x1: -9, y1: -1, x2: -5, y2: -1 }), _jsx("line", { x1: 5, y1: -1, x2: 9, y2: -1 })] }));
}
function ahu(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("rect", { x: -11, y: -6, width: 22, height: 12, fill: props.palette.fill }), _jsx("circle", { cx: 0, cy: 0, r: 3.5 }), _jsx("line", { x1: -2.5, y1: -2.5, x2: 2.5, y2: 2.5 }), _jsx("line", { x1: 2.5, y1: -2.5, x2: -2.5, y2: 2.5 })] }));
}
function fancoil(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("rect", { x: -10, y: -5, width: 20, height: 10, fill: props.palette.fill }), _jsx("circle", { cx: 5, cy: 0, r: 3 }), _jsx("path", { d: "M 3 0 L 7 -2 L 7 2 Z", fill: props.palette.accent, stroke: "none" })] }));
}
function diffuser(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("rect", { x: -7, y: -7, width: 14, height: 14, fill: props.palette.fill }), _jsx("line", { x1: -4, y1: -4, x2: 4, y2: 4 }), _jsx("line", { x1: 4, y1: -4, x2: -4, y2: 4 })] }));
}
function collector(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("rect", { x: -10, y: -3.5, width: 20, height: 7, rx: 2, fill: props.palette.fill }), [-6, -2, 2, 6].map((x) => (_jsx("line", { x1: x, y1: -7.5, x2: x, y2: 7.5 }, x)))] }));
}
function shutoffValve(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("path", { d: "M -8 -5 L 0 0 L -8 5 Z", fill: props.palette.fill }), _jsx("path", { d: "M 8 -5 L 0 0 L 8 5 Z", fill: props.palette.fill })] }));
}
function controlValve(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("path", { d: "M -8 -5 L 0 0 L -8 5 Z", fill: props.palette.fill }), _jsx("path", { d: "M 8 -5 L 0 0 L 8 5 Z", fill: props.palette.fill }), _jsx("line", { x1: 0, y1: -8, x2: 0, y2: -1.5 }), _jsx("line", { x1: -4.5, y1: -8, x2: 4.5, y2: -8 })] }));
}
function temperatureSensor(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("circle", { cx: 0, cy: 0, r: 5.5, fill: props.palette.fill }), _jsx("line", { x1: 0, y1: 5.5, x2: 0, y2: 11 }), _jsx("line", { x1: -2, y1: -2, x2: -2, y2: 2.5 }), _jsx("circle", { cx: -2, cy: 4, r: 1.7, fill: props.palette.accent, stroke: "none" })] }));
}
function pressureSensor(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("circle", { cx: 0, cy: 0, r: 5.5, fill: props.palette.fill }), _jsx("line", { x1: 0, y1: 5.5, x2: 0, y2: 11 }), _jsx("path", { d: "M 0 0 L 3 -2" })] }));
}
function heatMeter(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("rect", { x: -8, y: -6, width: 16, height: 12, rx: 2, fill: props.palette.fill }), _jsx("line", { x1: -4.5, y1: 0, x2: 4.5, y2: 0 }), _jsx("circle", { cx: -4.5, cy: 0, r: 1.5, fill: props.palette.accent, stroke: "none" }), _jsx("circle", { cx: 4.5, cy: 0, r: 1.5, fill: props.palette.accent, stroke: "none" })] }));
}
function mixingNode(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("circle", { cx: 0, cy: 0, r: 7.5, fill: props.palette.fill }), _jsx("path", { d: "M -6 1 L 0 -4 L 6 1" }), _jsx("path", { d: "M -4 5 L 0 1 L 4 5" })] }));
}
function riser(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("line", { x1: 0, y1: -10, x2: 0, y2: 10 }), _jsx("path", { d: "M -3 -6 L 0 -10 L 3 -6" })] }));
}
function tee(props) {
    return symbolFrame(props, _jsxs(_Fragment, { children: [_jsx("line", { x1: -10, y1: 0, x2: 10, y2: 0 }), _jsx("line", { x1: 0, y1: 0, x2: 0, y2: -9 }), _jsx("circle", { cx: 0, cy: 0, r: 1.8, fill: props.palette.accent, stroke: "none" })] }));
}
function elbow(props) {
    return symbolFrame(props, _jsx("path", { d: "M -8 0 H 0 V 8" }));
}
function generic(props) {
    return symbolFrame(props, _jsx("rect", { x: -7, y: -7, width: 14, height: 14, rx: 2, fill: props.palette.fill }));
}
export function renderEngineeringSymbol(kind, cx, cy, options = {}) {
    const palette = paletteForState(options.state ?? "default", Boolean(options.monochrome));
    const props = { cx, cy, palette };
    switch (kind) {
        case "radiator":
            return radiator(props);
        case "pump":
            return pump(props);
        case "boiler":
            return boiler(props);
        case "heat_exchanger":
            return heatExchanger(props);
        case "elevator":
            return mixingNode(props);
        case "expansion_tank":
            return expansionTank(props);
        case "dirt_separator":
            return dirtSeparator(props);
        case "ahu":
            return ahu(props);
        case "fancoil":
            return fancoil(props);
        case "diffuser":
            return diffuser(props);
        case "collector":
            return collector(props);
        case "shutoff_valve":
            return shutoffValve(props);
        case "control_valve":
            return controlValve(props);
        case "temperature_sensor":
            return temperatureSensor(props);
        case "pressure_sensor":
            return pressureSensor(props);
        case "heat_meter":
            return heatMeter(props);
        case "mixing_node":
            return mixingNode(props);
        case "riser":
            return riser(props);
        case "tee":
            return tee(props);
        case "pipe_elbow":
            return elbow(props);
        default:
            return generic(props);
    }
}
