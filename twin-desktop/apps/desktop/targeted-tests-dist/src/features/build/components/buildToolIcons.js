import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function BuildToolIcon({ name, className = "h-4 w-4" }) {
    const commonProps = {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round",
        strokeLinejoin: "round",
    };
    switch (name) {
        case "cursor":
            return (_jsx("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: _jsx("path", { ...commonProps, d: "M6 4.5v14l4.4-4.4 3.1 5.4 2.6-1.5-3.2-5.5H18L6 4.5Z" }) }));
        case "move":
            return (_jsx("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: _jsx("path", { ...commonProps, d: "M12 3v18M3 12h18M8 8l4-4 4 4M8 16l4 4 4-4M8 8l-4 4 4 4M16 8l4 4-4 4" }) }));
        case "roomRect":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "5", y: "5", width: "14", height: "14", rx: "1.5", strokeDasharray: "3 2" }), _jsx("path", { ...commonProps, d: "M8.5 8.5h7v7h-7z" })] }));
        case "roomContour":
            return (_jsx("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: _jsx("path", { ...commonProps, d: "M6 8h4V6h8v2h4v8h-4v2H10v-2H6V8z" }) }));
        case "wall":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "4", y: "9.5", width: "16", height: "5", rx: "1" }), _jsx("path", { ...commonProps, d: "M4 12h16" })] }));
        case "roof":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M2.5 15.8 12 10.2l9.5 5.6" }), _jsx("path", { ...commonProps, d: "M2.5 13.2 12 7.6l9.5 5.6" }), _jsx("path", { ...commonProps, d: "M17.8 10.8V7h3.2v5.6" }), _jsx("path", { ...commonProps, d: "M18.7 8.7h1.4" })] }));
        case "slab":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 9.5h14v5H5z" }), _jsx("path", { ...commonProps, d: "M7 7.5h10M7 16.5h10" })] }));
        case "window":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "4.5", y: "3.5", width: "15", height: "17", rx: "0.8" }), _jsx("path", { ...commonProps, d: "M12 3.5v17" }), _jsx("path", { ...commonProps, d: "M4.5 12h15" })] }));
        case "door":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M4 21.5h16" }), _jsx("rect", { ...commonProps, x: "5.5", y: "2.8", width: "13", height: "18.7", rx: "0.6" }), _jsx("path", { ...commonProps, d: "M16 10v4.8" })] }));
        case "stair":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M4 20h4v-4h4v-4h4v-4h4" }), _jsx("path", { ...commonProps, d: "M16 8v-4h4", strokeDasharray: "0" })] }));
        case "erase":
            return (_jsx("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: _jsx("path", { ...commonProps, d: "m16 5-1.5 1.5M7 14l-2 2a2 2 0 0 0 0 2.8l1.2 1.2a2 2 0 0 0 2.8 0l2-2M18 6l-8 8" }) }));
        case "wallsFromRooms":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "6", y: "6", width: "12", height: "12", rx: "1" }), _jsx("path", { ...commonProps, d: "M4 4h4M16 4h4M4 20h4M16 20h4" })] }));
        case "pipeSupply":
            return (_jsx("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: _jsx("path", { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.2V16.2M4.2 16.2h15.6" }) }));
        case "pipeReturn":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M19 16h-8a3 3 0 0 1-3-3V9" }), _jsx("path", { ...commonProps, d: "M9 9H5" }), _jsx("path", { ...commonProps, d: "m6.5 6.5-3 2.5 3 2.5" }), _jsx("circle", { ...commonProps, cx: "19", cy: "16", r: "1.4" })] }));
        case "engineeringPipe":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("ellipse", { ...commonProps, cx: "4.2", cy: "12.6", rx: "1.7", ry: "2.7" }), _jsx("path", { ...commonProps, d: "M5.4 10.2 7.4 9" }), _jsx("path", { ...commonProps, d: "M7.8 9.4 9.2 10.8" }), _jsx("path", { ...commonProps, d: "M9.6 8.8 12.4 7.8" }), _jsx("path", { ...commonProps, d: "M12.4 7.8 12.6 13.6" }), _jsx("path", { ...commonProps, d: "M4.8 15.4 12.6 13.6" }), _jsx("path", { ...commonProps, d: "M10.8 10.6 19.4 9.4" }), _jsx("path", { ...commonProps, d: "M10.8 13.4 19.4 12.2" }), _jsx("ellipse", { ...commonProps, cx: "19.8", cy: "11.4", rx: "1.4", ry: "2.2" })] }));
        case "duct":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "5", y: "8", width: "7", height: "4", rx: "1" }), _jsx("path", { ...commonProps, d: "M12 10h4a3 3 0 0 1 3 3v3" }), _jsx("rect", { ...commonProps, x: "17", y: "14", width: "2", height: "4", rx: "1" })] }));
        case "radiator":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "5", y: "7", width: "14", height: "10", rx: "2" }), _jsx("path", { ...commonProps, d: "M8 9v6M12 9v6M16 9v6" })] }));
        case "fancoil":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "4.5", y: "7", width: "15", height: "10", rx: "1.8" }), _jsx("path", { ...commonProps, d: "M7.5 12h4.5" }), _jsx("circle", { ...commonProps, cx: "15", cy: "12", r: "2.4" })] }));
        case "ahu":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "4", y: "7", width: "16", height: "10", rx: "1.8" }), _jsx("circle", { ...commonProps, cx: "12", cy: "12", r: "3" }), _jsx("path", { ...commonProps, d: "M9.9 9.9 14.1 14.1M14.1 9.9 9.9 14.1" })] }));
        case "boiler":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "6", y: "5", width: "12", height: "14", rx: "2" }), _jsx("path", { ...commonProps, d: "M9 9h6M9 13h4M9 19v2M15 19v2" })] }));
        case "pump":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "12", cy: "12", r: "5.5" }), _jsx("path", { ...commonProps, d: "M9.5 14.5 12 10l2.5 4.5" })] }));
        case "heatExchanger":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "5", y: "7", width: "14", height: "10", rx: "2" }), _jsx("path", { ...commonProps, d: "M9 8v8M12 8v8M15 8v8" }), _jsx("path", { ...commonProps, d: "M5 10H3M21 10h-2M5 14H3M21 14h-2" })] }));
        case "elevator":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M12 4v12M8 8l4-4 4 4" }), _jsx("path", { ...commonProps, d: "M7 18h10" })] }));
        case "expansionTank":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "12", cy: "11", r: "7" }), _jsx("line", { ...commonProps, x1: "5", y1: "11", x2: "19", y2: "11" }), _jsx("line", { ...commonProps, x1: "12", y1: "18", x2: "12", y2: "21" })] }));
        case "dirtSeparator":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M12 5v11M8 9h8M8 15h8" }), _jsx("path", { ...commonProps, d: "M10 19h4" })] }));
        case "diffuser":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "6", y: "6", width: "12", height: "12", rx: "1.4" }), _jsx("path", { ...commonProps, d: "M8.8 8.8 15.2 15.2M15.2 8.8 8.8 15.2" })] }));
        case "filter":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M12 4 L20 12 L12 20 L4 12 Z" }), _jsx("path", { ...commonProps, d: "M8 8 L16 16 M16 8 L8 16" })] }));
        case "valve":
            return (_jsx("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: _jsx("path", { ...commonProps, d: "M5 8 12 12 5 16V8ZM19 8l-7 4 7 4V8Z" }) }));
        case "checkValve":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M4 8 14 12 4 16V8Z" }), _jsx("line", { ...commonProps, x1: "14", y1: "7", x2: "14", y2: "17" }), _jsx("path", { ...commonProps, d: "M15 12h5M17 10l3 2-3 2" })] }));
        case "controlValve":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 9 12 12 5 15V9ZM19 9l-7 3 7 3V9Z" }), _jsx("path", { ...commonProps, d: "M12 4v5M9 4h6" })] }));
        case "manifold":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "4", y: "10", width: "16", height: "4", rx: "2" }), _jsx("path", { ...commonProps, d: "M8 6v12M12 6v12M16 6v12" })] }));
        case "heatMeter":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "5", y: "7", width: "14", height: "10", rx: "2" }), _jsx("path", { ...commonProps, d: "M8.5 12h7" }), _jsx("circle", { ...commonProps, cx: "8.5", cy: "12", r: "1.2" }), _jsx("circle", { ...commonProps, cx: "15.5", cy: "12", r: "1.2" })] }));
        case "automationCabinet":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "6", y: "4", width: "12", height: "16", rx: "2" }), _jsx("path", { ...commonProps, d: "M10 4v16M12.5 10h2.5M12.5 14h2.5" })] }));
        case "sensorTemperature":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "12", cy: "12", r: "5.5" }), _jsx("path", { ...commonProps, d: "M12 9v6M9 9h6" })] }));
        case "sensorPressure":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "12", cy: "12", r: "5.5" }), _jsx("path", { ...commonProps, d: "M10 8.5h2.5a2.5 2.5 0 0 1 0 5H10v-5Z" })] }));
        case "sensor":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "12", cy: "12", r: "2.5" }), _jsx("path", { ...commonProps, d: "M6.5 12a5.5 5.5 0 0 1 11 0" }), _jsx("path", { ...commonProps, d: "M4 12a8 8 0 0 1 16 0" })] }));
        case "fit":
            return (_jsx("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: _jsx("path", { ...commonProps, d: "M8 5H5v3M16 5h3v3M8 19H5v-3M16 19h3v-3" }) }));
        case "grid":
            return (_jsx("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: _jsx("path", { ...commonProps, d: "M4 4h16v16H4zM4 9.33h16M4 14.67h16M9.33 4v16M14.67 4v16" }) }));
        case "orthogonal":
            return (_jsx("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: _jsx("path", { fill: "none", stroke: "currentColor", strokeWidth: 3.6, strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4.2V16.2M4.2 16.2h15.6" }) }));
        case "magnet":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M7 5v7a5 5 0 0 0 10 0V5" }), _jsx("path", { ...commonProps, d: "M7 5h4M13 5h4M7 9h4M13 9h4" })] }));
        case "layers":
        case "levels":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M12 4 20 8 12 12 4 8 12 4Z" }), _jsx("path", { ...commonProps, d: "M4 12 12 16 20 12" }), _jsx("path", { ...commonProps, d: "M4 16 12 20 20 16" })] }));
        case "cube":
        case "view3d":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" }), _jsx("path", { ...commonProps, d: "M12 12 4.5 7.7M12 12l7.5-4.3M12 12v8.5" })] }));
        case "plan2d":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "4", y: "4", width: "16", height: "16", rx: "2" }), _jsx("path", { ...commonProps, d: "M4 10h16M10 4v16M14 10v10" })] }));
        case "networks":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "6", cy: "12", r: "2.2" }), _jsx("circle", { ...commonProps, cx: "18", cy: "7", r: "2.2" }), _jsx("circle", { ...commonProps, cx: "18", cy: "17", r: "2.2" }), _jsx("path", { ...commonProps, d: "M8.2 11.2 15.8 7.8M8.2 12.8l7.6 3.4" })] }));
        case "more":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "7", cy: "12", r: "1.4", fill: "currentColor", stroke: "none" }), _jsx("circle", { ...commonProps, cx: "12", cy: "12", r: "1.4", fill: "currentColor", stroke: "none" }), _jsx("circle", { ...commonProps, cx: "17", cy: "12", r: "1.4", fill: "currentColor", stroke: "none" })] }));
        case "thermometer":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" }), _jsx("path", { ...commonProps, d: "M12 7v8" })] }));
        case "chart":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 19V5M5 19h14" }), _jsx("path", { ...commonProps, d: "M8 16v-4M12 16V8M16 16v-6" })] }));
        case "tag":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M4 6v6.5L11.5 20 20 11.5 12.5 4H6a2 2 0 0 0-2 2Z" }), _jsx("circle", { ...commonProps, cx: "8.5", cy: "8.5", r: "1.2" })] }));
        case "sliders":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 7h4M15 7h4M5 12h8M17 12h2M5 17h2M11 17h8" }), _jsx("circle", { ...commonProps, cx: "12", cy: "7", r: "2" }), _jsx("circle", { ...commonProps, cx: "15", cy: "12", r: "2" }), _jsx("circle", { ...commonProps, cx: "9", cy: "17", r: "2" })] }));
        // ── АВОК СТО НП 1.05-2006 ──────────────────────────────────────────────
        case "gateValve":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 8 L12 12 L5 16 V8Z M19 8 L12 12 L19 16 V8Z" }), _jsx("line", { ...commonProps, x1: "12", y1: "7.5", x2: "12", y2: "16.5" }), _jsx("line", { ...commonProps, x1: "12", y1: "7.5", x2: "12", y2: "5" }), _jsx("line", { ...commonProps, x1: "9.5", y1: "5", x2: "14.5", y2: "5" })] }));
        case "ballValve":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M12 7.5 L16.5 12 L12 16.5 L7.5 12 Z" }), _jsx("line", { ...commonProps, x1: "3", y1: "12", x2: "7.5", y2: "12" }), _jsx("line", { ...commonProps, x1: "16.5", y1: "12", x2: "21", y2: "12" }), _jsx("line", { ...commonProps, x1: "12", y1: "7.5", x2: "12", y2: "5" }), _jsx("line", { ...commonProps, x1: "9.5", y1: "5", x2: "14.5", y2: "5" })] }));
        case "threeWayValve":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M4 9.5 L10.5 12 L4 14.5 V9.5Z M20 9.5 L13.5 12 L20 14.5 V9.5Z" }), _jsx("path", { ...commonProps, d: "M10.5 9.5 L12 6.5 L13.5 9.5 Z" }), _jsx("line", { ...commonProps, x1: "12", y1: "6.5", x2: "12", y2: "4" })] }));
        case "balancingValve":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 9 L12 12 L5 15 V9Z M19 9 L12 12 L19 15 V9Z" }), _jsx("line", { ...commonProps, x1: "12", y1: "9", x2: "12", y2: "5" }), _jsx("line", { ...commonProps, x1: "9.8", y1: "6.5", x2: "14.2", y2: "6.5" }), _jsx("line", { ...commonProps, x1: "10.2", y1: "5", x2: "13.8", y2: "5" })] }));
        case "safetyValve":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 9 L12 12 L5 15 V9Z M19 9 L12 12 L19 15 V9Z" }), _jsx("line", { ...commonProps, x1: "12", y1: "9", x2: "12", y2: "4.5" }), _jsx("path", { ...commonProps, d: "M10 6.5 L12 4 L14 6.5" })] }));
        case "pressureRegulator":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 10 L12 12 L5 14 V10Z M19 10 L12 12 L19 14 V10Z" }), _jsx("line", { ...commonProps, x1: "12", y1: "10", x2: "12", y2: "7.5" }), _jsx("ellipse", { ...commonProps, cx: "12", cy: "6", rx: "3.8", ry: "1.8" }), _jsx("path", { ...commonProps, d: "M5.5 6 L8 6 M10.5 4.5 L8 6 L10.5 7.5" }), _jsx("line", { ...commonProps, x1: "16", y1: "6", x2: "18.5", y2: "6" })] }));
        case "thermostaticValve":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 9 L12 12 L5 15 V9Z M19 9 L12 12 L19 15 V9Z" }), _jsx("line", { ...commonProps, x1: "12", y1: "9", x2: "12", y2: "6.5" }), _jsx("circle", { ...commonProps, cx: "12", cy: "4.8", r: "2.2" })] }));
        case "flowMeter":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "12", cy: "12", r: "4.5" }), _jsx("line", { ...commonProps, x1: "3", y1: "12", x2: "7.5", y2: "12" }), _jsx("line", { ...commonProps, x1: "16.5", y1: "12", x2: "21", y2: "12" })] }));
        case "convector":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("rect", { ...commonProps, x: "4", y: "15", width: "16", height: "4", rx: "1" }), _jsx("line", { ...commonProps, x1: "8", y1: "15", x2: "8", y2: "9" }), _jsx("path", { ...commonProps, d: "M6.5 11.5 L8 9 L9.5 11.5" }), _jsx("line", { ...commonProps, x1: "12", y1: "15", x2: "12", y2: "9" }), _jsx("path", { ...commonProps, d: "M10.5 11.5 L12 9 L13.5 11.5" }), _jsx("line", { ...commonProps, x1: "16", y1: "15", x2: "16", y2: "9" }), _jsx("path", { ...commonProps, d: "M14.5 11.5 L16 9 L17.5 11.5" })] }));
        case "sensorFlow":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "12", cy: "12", r: "5.5" }), _jsx("line", { ...commonProps, x1: "8.5", y1: "12", x2: "15.5", y2: "12" }), _jsx("path", { ...commonProps, d: "M13.5 10 L15.5 12 L13.5 14" })] }));
        case "sensorHumidity":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("circle", { ...commonProps, cx: "12", cy: "12", r: "5.5" }), _jsx("path", { ...commonProps, d: "M12 9 C9.5 11.5 9.5 15 12 15 C14.5 15 14.5 11.5 12 9 Z" })] }));
        case "fillet":
            return (_jsxs("svg", { viewBox: "0 0 24 24", className: className, "aria-hidden": "true", children: [_jsx("path", { ...commonProps, d: "M5 19 L5 9" }), _jsx("path", { ...commonProps, d: "M5 9 L15 9", strokeDasharray: "3 2", opacity: "0.45" }), _jsx("path", { ...commonProps, d: "M15 9 L19 9" }), _jsx("path", { ...commonProps, d: "M5 14 A 5 5 0 0 1 10 9", strokeWidth: 2.2 }), _jsx("circle", { cx: "5", cy: "9", r: "2", fill: "currentColor", opacity: "0.35", stroke: "none" })] }));
        default:
            return null;
    }
}
