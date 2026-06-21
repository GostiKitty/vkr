import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ENGINEERING_MEDIUM_STYLES } from "./catalog";
function resolvePalette(selected, hovered, preview) {
    if (selected) {
        return {
            stroke: "var(--accent-base)",
            fill: "color-mix(in srgb, var(--surface-base) 86%, var(--accent-soft) 14%)",
            accent: "var(--accent-base)",
            soft: "color-mix(in srgb, var(--accent-base) 14%, transparent)",
            strokeWidth: 1.9,
        };
    }
    if (hovered || preview) {
        return {
            stroke: "var(--text-base)",
            fill: "color-mix(in srgb, var(--surface-base) 92%, var(--surface-muted) 8%)",
            accent: "var(--accent-strong)",
            soft: "color-mix(in srgb, var(--accent-strong) 12%, transparent)",
            strokeWidth: 1.7,
        };
    }
    return {
        stroke: "var(--text-base)",
        fill: "var(--surface-base)",
        accent: "var(--text-muted)",
        soft: "color-mix(in srgb, var(--border-soft) 65%, transparent)",
        strokeWidth: 1.55,
    };
}
function frame(cx, cy, rotation, width, height, palette, children, selected, className) {
    return (_jsxs("g", { className: className, transform: `translate(${cx}, ${cy}) rotate(${rotation})`, children: [selected ? (_jsx("rect", { x: -width / 2 - 6, y: -height / 2 - 6, width: width + 12, height: height + 12, rx: 14, fill: palette.soft, stroke: "none" })) : null, _jsx("g", { fill: "none", stroke: palette.stroke, strokeWidth: palette.strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", children: children })] }));
}
function resolveSymbolMetrics(props, defaultWidth, defaultHeight) {
    const scale = typeof props.scale === "number" && Number.isFinite(props.scale) ? Math.max(0.2, props.scale) : 1;
    const width = Math.max(12, (props.width ?? defaultWidth) * scale);
    const height = Math.max(12, (props.height ?? defaultHeight) * scale);
    return {
        center: props.center ?? { x: 0, y: 0 },
        width,
        height,
        rotation: typeof props.rotation === "number" && Number.isFinite(props.rotation) ? props.rotation : 0,
        palette: resolvePalette(Boolean(props.selected), Boolean(props.hovered), Boolean(props.preview)),
        showPorts: props.showPorts ?? Boolean(props.selected || props.hovered || props.preview),
        portRadius: props.portRadius ?? 3.8,
    };
}
function renderPortStem(direction, x, y, length) {
    switch (direction) {
        case "left":
            return _jsx("line", { x1: x - length, y1: y, x2: x, y2: y });
        case "right":
            return _jsx("line", { x1: x, y1: y, x2: x + length, y2: y });
        case "top":
            return _jsx("line", { x1: x, y1: y - length, x2: x, y2: y });
        case "bottom":
        default:
            return _jsx("line", { x1: x, y1: y, x2: x, y2: y + length });
    }
}
function renderPorts(ports, metrics) {
    if (!metrics.showPorts || !ports?.length) {
        return null;
    }
    const stemLength = Math.max(5, metrics.portRadius * 1.7);
    return (_jsx("g", { strokeLinecap: "round", strokeLinejoin: "round", children: ports.map((port) => {
            const mediumStyle = ENGINEERING_MEDIUM_STYLES[port.medium];
            return (_jsxs("g", { children: [_jsx("g", { stroke: mediumStyle.stroke, strokeWidth: 1.4, children: renderPortStem(port.direction, port.x, port.y, stemLength) }), _jsx("circle", { cx: port.x, cy: port.y, r: metrics.portRadius, fill: metrics.palette.fill, stroke: metrics.palette.stroke, strokeWidth: 1.2 }), _jsx("circle", { cx: port.x, cy: port.y, r: Math.max(1.6, metrics.portRadius * 0.48), fill: mediumStyle.stroke, stroke: "none" })] }, port.id));
        }) }));
}
function symbolFrame(props, defaultWidth, defaultHeight, renderBody) {
    const metrics = resolveSymbolMetrics(props, defaultWidth, defaultHeight);
    return frame(metrics.center.x, metrics.center.y, metrics.rotation, metrics.width, metrics.height, metrics.palette, _jsxs(_Fragment, { children: [renderBody(metrics), renderPorts(props.ports, metrics)] }), Boolean(props.selected), props.className);
}
function valveCore(width, height, palette, actuator = false) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-halfWidth} ${-halfHeight * 0.7} L 0 0 L ${-halfWidth} ${halfHeight * 0.7} Z`, fill: palette.fill }), _jsx("path", { d: `M ${halfWidth} ${-halfHeight * 0.7} L 0 0 L ${halfWidth} ${halfHeight * 0.7} Z`, fill: palette.fill }), actuator ? (_jsxs(_Fragment, { children: [_jsx("line", { x1: 0, y1: -halfHeight * 0.9, x2: 0, y2: -halfHeight * 1.65 }), _jsx("rect", { x: -width * 0.12, y: -halfHeight * 1.95, width: width * 0.24, height: height * 0.5, rx: 4, fill: palette.fill })] })) : null] }));
}
function labelGlyph(text, x, y, palette, size = 11) {
    return (_jsx("text", { x: x, y: y, textAnchor: "middle", dominantBaseline: "middle", fontSize: size, fontWeight: 700, fill: palette.stroke, stroke: "none", children: text }));
}
export function PumpSymbol(props) {
    const variant = props.parameters?.variant;
    return symbolFrame(props, 28, 28, ({ width, height, palette }) => {
        const radius = Math.min(width, height) * 0.42;
        const hw = width / 2;
        const tipX = radius;
        const triangleHeight = radius * 0.68;
        const halfBaseY = triangleHeight / Math.sqrt(3);
        const baseX = tipX - triangleHeight;
        if (variant === "centrifugal") {
            return (_jsxs(_Fragment, { children: [_jsx("circle", { cx: 0, cy: 0, r: radius, fill: palette.fill }), _jsx("path", { d: `M ${baseX} ${halfBaseY} L ${tipX} 0 L ${baseX} ${-halfBaseY} Z`, fill: palette.accent, stroke: "none" }), _jsx("line", { x1: 0, y1: -radius, x2: 0, y2: -hw * 0.96 })] }));
        }
        return (_jsxs(_Fragment, { children: [_jsx("circle", { cx: 0, cy: 0, r: radius, fill: palette.fill }), _jsx("path", { d: `M ${baseX} ${halfBaseY} L ${tipX} 0 L ${baseX} ${-halfBaseY} Z`, fill: palette.accent, stroke: "none" }), variant === "variable" ? (_jsx("line", { x1: -radius * 0.62, y1: radius * 0.62, x2: radius * 0.62, y2: -radius * 0.62 })) : null] }));
    });
}
/** Теплообменник пластинчатый 3.7.01 — прямоугольник с вертикальными пластинами */
export function HeatExchangerSymbol(props) {
    return symbolFrame(props, 46, 30, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        const plateXs = [-0.3, -0.15, 0, 0.15, 0.3].map((f) => width * f);
        return (_jsxs(_Fragment, { children: [_jsx("rect", { x: -hw, y: -hh, width: width, height: height, rx: 4, fill: palette.fill }), plateXs.map((x, i) => (_jsx("line", { x1: x, y1: -hh * 0.75, x2: x, y2: hh * 0.75 }, i)))] }));
    });
}
/** Фильтр 2.9.01 — ромб с крестообразной сеткой */
export function FilterSymbol(props) {
    return symbolFrame(props, 28, 28, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M 0 ${-hh} L ${hw} 0 L 0 ${hh} L ${-hw} 0 Z`, fill: palette.fill }), _jsx("line", { x1: -hw * 0.5, y1: -hh * 0.5, x2: hw * 0.5, y2: hh * 0.5 }), _jsx("line", { x1: hw * 0.5, y1: -hh * 0.5, x2: -hw * 0.5, y2: hh * 0.5 })] }));
    });
}
export function ValveSymbol(props) {
    const variant = props.parameters?.variant;
    if (variant === "angular") {
        return symbolFrame(props, 26, 26, ({ width, height, palette }) => {
            const hw = width / 2;
            const hh = height / 2;
            return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-hw} ${-hh * 0.65} L 0 0 L ${-hw} ${hh * 0.65} Z`, fill: palette.fill }), _jsx("path", { d: `M ${-hh * 0.65} ${-hh} L 0 0 L ${hh * 0.65} ${-hh} Z`, fill: palette.fill })] }));
        });
    }
    return symbolFrame(props, 28, 22, ({ width, height, palette }) => valveCore(width * 0.42, height * 0.7, palette));
}
/**
 * Обратный клапан ГОСТ 21-205-2016 — белый (открытый) треугольник со стороны входа
 * + чёрный (заполненный) треугольник со стороны выхода, оба вершинами к центру.
 */
export function CheckValveSymbol(props) {
    return symbolFrame(props, 26, 20, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-hw} ${-hh * 0.78} L 0 0 L ${-hw} ${hh * 0.78} Z`, fill: palette.fill }), _jsx("path", { d: `M ${hw} ${-hh * 0.78} L 0 0 L ${hw} ${hh * 0.78} Z`, fill: palette.stroke, stroke: "none" })] }));
    });
}
export function ControlValveSymbol(props) {
    const variant = props.parameters?.variant;
    if (variant === "angular") {
        return symbolFrame(props, 30, 38, ({ width, height, palette }) => {
            const hw = width / 2;
            const hh = height / 2;
            return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-hw} ${-hh * 0.45} L 0 0 L ${-hw} ${hh * 0.45} Z`, fill: palette.fill }), _jsx("path", { d: `M ${-hh * 0.45} ${-hh * 0.55} L 0 0 L ${hh * 0.45} ${-hh * 0.55} Z`, fill: palette.fill }), _jsx("line", { x1: 0, y1: -hh * 0.55, x2: 0, y2: -hh * 0.96 }), _jsx("rect", { x: -width * 0.12, y: -hh * 1.28, width: width * 0.24, height: hh * 0.5, rx: 4, fill: palette.fill })] }));
        });
    }
    if (variant === "triple") {
        return symbolFrame(props, 30, 34, ({ width, height, palette }) => {
            const hw = width / 2;
            const hh = height / 2;
            return (_jsxs(_Fragment, { children: [valveCore(width * 0.42, height * 0.7, palette, true), _jsx("line", { x1: 0, y1: hh * 0.3, x2: 0, y2: hh * 0.9 })] }));
        });
    }
    return symbolFrame(props, 30, 34, ({ width, height, palette }) => valveCore(width * 0.42, height * 0.7, palette, true));
}
/** Бак расширительный мембранный 3.7.06 — окружность с горизонтальной мембраной */
export function ExpansionTankSymbol(props) {
    return symbolFrame(props, 28, 32, ({ width, height, palette }) => {
        const r = Math.min(width, height) * 0.38;
        const cy = -height * 0.06;
        return (_jsxs(_Fragment, { children: [_jsx("circle", { cx: 0, cy: cy, r: r, fill: palette.fill }), _jsx("path", { d: `M ${-r} ${cy} A ${r} ${r} 0 0 1 ${r} ${cy} Z`, fill: palette.soft, stroke: "none" }), _jsx("circle", { cx: 0, cy: cy, r: r, fill: "none" }), _jsx("line", { x1: -r, y1: cy, x2: r, y2: cy }), _jsx("line", { x1: 0, y1: cy + r, x2: 0, y2: cy + r + height * 0.15 })] }));
    });
}
export function ManifoldSymbol(props) {
    return symbolFrame(props, 48, 18, ({ width, height, palette }) => {
        const halfWidth = width / 2;
        return (_jsxs(_Fragment, { children: [_jsx("rect", { x: -halfWidth, y: -height * 0.18, width: width, height: height * 0.36, rx: height * 0.18, fill: palette.fill }), [-0.26, 0, 0.26].map((offset) => (_jsx("line", { x1: width * offset, y1: -height * 0.52, x2: width * offset, y2: height * 0.52 }, offset)))] }));
    });
}
export function HeatMeterSymbol(props) {
    return symbolFrame(props, 34, 22, ({ width, height, palette }) => {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        return (_jsxs(_Fragment, { children: [_jsx("rect", { x: -halfWidth, y: -halfHeight, width: width, height: height, rx: 12, fill: palette.fill }), _jsx("circle", { cx: -width * 0.18, cy: 0, r: Math.min(width, height) * 0.16, fill: palette.fill }), _jsx("line", { x1: -width * 0.18, y1: 0, x2: -width * 0.1, y2: -height * 0.08 }), labelGlyph("Q", width * 0.16, 0, palette, 11)] }));
    });
}
export function AutomationCabinetSymbol(props) {
    return symbolFrame(props, 30, 40, ({ width, height, palette }) => {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        return (_jsxs(_Fragment, { children: [_jsx("rect", { x: -halfWidth, y: -halfHeight, width: width, height: height, rx: 10, fill: palette.fill }), _jsx("line", { x1: -width * 0.18, y1: -halfHeight, x2: -width * 0.18, y2: halfHeight }), _jsx("circle", { cx: width * 0.18, cy: -height * 0.18, r: height * 0.07, fill: palette.accent, stroke: "none" }), _jsx("circle", { cx: width * 0.18, cy: 0, r: height * 0.07, fill: palette.accent, stroke: "none" }), _jsx("circle", { cx: width * 0.18, cy: height * 0.18, r: height * 0.07, fill: palette.accent, stroke: "none" }), labelGlyph("ША", -width * 0.02, 0, palette, 11)] }));
    });
}
export function SensorSymbol({ variant = "temperature", ...props }) {
    const labelChar = variant === "pressure" ? "P" : variant === "flow" ? "G" : variant === "humidity" ? "φ" : "T";
    return symbolFrame(props, 18, 18, ({ width, height, palette }) => (_jsxs(_Fragment, { children: [_jsx("line", { x1: 0, y1: height * 0.2, x2: 0, y2: height * 0.56 }), _jsx("circle", { cx: 0, cy: 0, r: Math.min(width, height) * 0.46, fill: palette.fill }), labelGlyph(labelChar, 0, 0, palette, 12)] })));
}
// ── АВОК СТО НП 1.05-2006 ────────────────────────────────────────────────────
/** Задвижка ГОСТ 21-205-2016 — два треугольника + вертикальная линия-затвор + шток */
export function GateValveSymbol(props) {
    return symbolFrame(props, 26, 28, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-hw} ${-hh * 0.62} L 0 0 L ${-hw} ${hh * 0.62} Z`, fill: palette.fill }), _jsx("path", { d: `M ${hw} ${-hh * 0.62} L 0 0 L ${hw} ${hh * 0.62} Z`, fill: palette.fill }), _jsx("line", { x1: 0, y1: -hh * 0.72, x2: 0, y2: hh * 0.72 }), _jsx("line", { x1: 0, y1: -hh * 0.72, x2: 0, y2: -hh * 1.22 }), _jsx("line", { x1: -hw * 0.22, y1: -hh * 1.22, x2: hw * 0.22, y2: -hh * 1.22 })] }));
    });
}
/** Кран шаровой ГОСТ 21-205-2016 — ромб (повёрнутый квадрат) со штоком */
export function BallValveSymbol(props) {
    return symbolFrame(props, 24, 22, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        const d = Math.min(hw, hh) * 0.78;
        return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M 0 ${-d} L ${d} 0 L 0 ${d} L ${-d} 0 Z`, fill: palette.fill }), _jsx("line", { x1: -hw, y1: 0, x2: -d, y2: 0 }), _jsx("line", { x1: d, y1: 0, x2: hw, y2: 0 }), _jsx("line", { x1: 0, y1: -d, x2: 0, y2: -hh * 1.08 }), _jsx("line", { x1: -hw * 0.24, y1: -hh * 1.08, x2: hw * 0.24, y2: -hh * 1.08 })] }));
    });
}
/** Кран трёхходовой 2.8.08 — три направления с треугольными телами */
export function ThreeWayValveSymbol(props) {
    return symbolFrame(props, 28, 34, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        const bh = hh * 0.45;
        return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-hw} ${-bh} L ${-hw * 0.22} 0 L ${-hw} ${bh} Z`, fill: palette.fill }), _jsx("path", { d: `M ${hw} ${-bh} L ${hw * 0.22} 0 L ${hw} ${bh} Z`, fill: palette.fill }), _jsx("path", { d: `M ${-hw * 0.22} ${-bh * 0.6} L 0 ${-hh * 0.7} L ${hw * 0.22} ${-bh * 0.6} Z`, fill: palette.fill }), _jsx("line", { x1: 0, y1: -hh * 0.7, x2: 0, y2: -hh })] }));
    });
}
/** Клапан балансировочный ручной 2.8.13 — вентиль с рисками регулировки */
export function BalancingValveSymbol(props) {
    return symbolFrame(props, 28, 28, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-hw} ${-hh * 0.58} L 0 0 L ${-hw} ${hh * 0.58} Z`, fill: palette.fill }), _jsx("path", { d: `M ${hw} ${-hh * 0.58} L 0 0 L ${hw} ${hh * 0.58} Z`, fill: palette.fill }), _jsx("line", { x1: 0, y1: -hh * 0.58, x2: 0, y2: -hh * 1.18 }), _jsx("line", { x1: -hw * 0.28, y1: -hh * 0.88, x2: hw * 0.28, y2: -hh * 0.88 }), _jsx("line", { x1: -hw * 0.22, y1: -hh * 1.1, x2: hw * 0.22, y2: -hh * 1.1 })] }));
    });
}
/** Клапан предохранительный 2.8.23 — вентиль со стрелкой аварийного выброса */
export function SafetyValveSymbol(props) {
    return symbolFrame(props, 26, 32, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-hw} ${-hh * 0.52} L 0 0 L ${-hw} ${hh * 0.52} Z`, fill: palette.fill }), _jsx("path", { d: `M ${hw} ${-hh * 0.52} L 0 0 L ${hw} ${hh * 0.52} Z`, fill: palette.fill }), _jsx("line", { x1: 0, y1: -hh * 0.52, x2: 0, y2: -hh * 1.4 }), _jsx("path", { d: `M ${-hw * 0.24} ${-hh * 1.12} L 0 ${-hh * 1.45} L ${hw * 0.24} ${-hh * 1.12}` })] }));
    });
}
/** Регулятор перепада давления 2.8.20 — вентиль с мембраной ΔP */
export function PressureRegulatorSymbol(props) {
    return symbolFrame(props, 30, 38, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-hw} ${-hh * 0.42} L 0 0 L ${-hw} ${hh * 0.42} Z`, fill: palette.fill }), _jsx("path", { d: `M ${hw} ${-hh * 0.42} L 0 0 L ${hw} ${hh * 0.42} Z`, fill: palette.fill }), _jsx("line", { x1: 0, y1: -hh * 0.42, x2: 0, y2: -hh * 0.82 }), _jsx("ellipse", { cx: 0, cy: -hh * 1.06, rx: hw * 0.52, ry: hh * 0.26, fill: palette.fill }), _jsx("line", { x1: -hw * 0.88, y1: -hh * 1.06, x2: -hw * 0.55, y2: -hh * 1.06 }), _jsx("path", { d: `M ${-hw * 0.72} ${-hh * 1.26} L ${-hw * 0.88} ${-hh * 1.06} L ${-hw * 0.72} ${-hh * 0.86}` }), _jsx("line", { x1: hw * 0.55, y1: -hh * 1.06, x2: hw * 0.88, y2: -hh * 1.06 })] }));
    });
}
/** Терморегулятор радиаторный 2.8.19 — вентиль с термоголовкой (окружность) */
export function ThermostaticValveSymbol(props) {
    return symbolFrame(props, 26, 34, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        return (_jsxs(_Fragment, { children: [_jsx("path", { d: `M ${-hw} ${-hh * 0.5} L 0 0 L ${-hw} ${hh * 0.5} Z`, fill: palette.fill }), _jsx("path", { d: `M ${hw} ${-hh * 0.5} L 0 0 L ${hw} ${hh * 0.5} Z`, fill: palette.fill }), _jsx("line", { x1: 0, y1: -hh * 0.5, x2: 0, y2: -hh * 0.88 }), _jsx("circle", { cx: 0, cy: -hh * 1.22, r: hh * 0.36, fill: palette.fill }), labelGlyph("t", 0, -hh * 1.22, palette, 10)] }));
    });
}
/** Расходомер ГОСТ 21-205-2016 — окружность на трубопроводе (–○–), без подписей */
export function FlowMeterSymbol(props) {
    return symbolFrame(props, 32, 18, ({ width, height, palette }) => {
        const hw = width / 2;
        const r = Math.min(width, height) * 0.3;
        return (_jsxs(_Fragment, { children: [_jsx("circle", { cx: 0, cy: 0, r: r, fill: palette.fill }), _jsx("line", { x1: -hw, y1: 0, x2: -r, y2: 0 }), _jsx("line", { x1: r, y1: 0, x2: hw, y2: 0 })] }));
    });
}
/** Конвектор 3.1.04 — корпус снизу, стрелки конвекции направлены вверх */
export function ConvectorSymbol(props) {
    return symbolFrame(props, 36, 26, ({ width, height, palette }) => {
        const hw = width / 2;
        const hh = height / 2;
        const bodyTop = hh * 0.18;
        const finBase = bodyTop;
        const finTip = -hh * 0.82;
        const tipOff = width * 0.04;
        const fins = [-0.38, -0.14, 0.14, 0.38];
        return (_jsxs(_Fragment, { children: [fins.map((f) => (_jsx("line", { x1: width * f, y1: finBase, x2: width * f, y2: finTip }, f))), fins.map((f) => (_jsx("path", { d: `M ${width * f - tipOff} ${finTip + hh * 0.26} L ${width * f} ${finTip} L ${width * f + tipOff} ${finTip + hh * 0.26}` }, `a${f}`))), _jsx("rect", { x: -hw, y: bodyTop, width: width, height: height * 0.5, rx: 3, fill: palette.fill })] }));
    });
}
const ENGINEERING_SYMBOL_RENDERERS = {
    pump: PumpSymbol,
    heatExchanger: HeatExchangerSymbol,
    filter: FilterSymbol,
    valve: ValveSymbol,
    checkValve: CheckValveSymbol,
    controlValve: ControlValveSymbol,
    expansionTank: ExpansionTankSymbol,
    manifold: ManifoldSymbol,
    heatMeter: HeatMeterSymbol,
    automationCabinet: AutomationCabinetSymbol,
    sensorTemperature: (props) => SensorSymbol({ ...props, variant: "temperature" }),
    sensorPressure: (props) => SensorSymbol({ ...props, variant: "pressure" }),
    // АВОК СТО НП 1.05-2006
    gateValve: GateValveSymbol,
    ballValve: BallValveSymbol,
    threeWayValve: ThreeWayValveSymbol,
    balancingValve: BalancingValveSymbol,
    safetyValve: SafetyValveSymbol,
    pressureRegulator: PressureRegulatorSymbol,
    thermostaticValve: ThermostaticValveSymbol,
    flowMeter: FlowMeterSymbol,
    convector: ConvectorSymbol,
    sensorFlow: (props) => SensorSymbol({ ...props, variant: "flow" }),
    sensorHumidity: (props) => SensorSymbol({ ...props, variant: "humidity" }),
};
export function getEngineeringSymbolRenderer(type) {
    return ENGINEERING_SYMBOL_RENDERERS[type];
}
export function renderEngineeringEquipmentSymbol(equipment, center, options = {}) {
    const Renderer = getEngineeringSymbolRenderer(equipment.type);
    return Renderer({
        center,
        rotation: equipment.rotation,
        width: Math.max(20, equipment.width),
        height: Math.max(18, equipment.height),
        ports: equipment.ports,
        parameters: equipment.parameters,
        selected: options.selected,
        hovered: options.hovered,
        preview: options.preview,
        showPorts: options.showPorts,
        scale: options.scale,
        portRadius: options.portRadius,
    });
}
