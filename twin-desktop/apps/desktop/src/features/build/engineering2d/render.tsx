import type { ReactNode } from "react";
import type {
  EngineeringEquipment,
  EngineeringEquipmentParameters,
  EngineeringEquipmentType,
  EngineeringPipe,
  EngineeringPort,
  EngineeringPortDirection,
} from "../../../entities/engineering/types";
import { buildEngineeringPorts, ENGINEERING_MEDIUM_STYLES } from "./catalog";

type RenderPalette = {
  stroke: string;
  fill: string;
  accent: string;
  soft: string;
  strokeWidth: number;
};

export interface EngineeringSymbolProps {
  center?: { x: number; y: number };
  width?: number;
  height?: number;
  rotation?: number;
  scale?: number;
  selected?: boolean;
  hovered?: boolean;
  preview?: boolean;
  ports?: Pick<EngineeringPort, "id" | "x" | "y" | "direction" | "medium">[];
  parameters?: EngineeringEquipmentParameters;
  showPorts?: boolean;
  portRadius?: number;
  className?: string;
}

export interface SensorSymbolProps extends EngineeringSymbolProps {
  variant?: "temperature" | "pressure" | "flow" | "humidity";
}

type EngineeringSymbolRenderer = (props: EngineeringSymbolProps) => ReactNode;

export type EngineeringSymbolSizeMode = "instance" | "schematic";

const SCHEMATIC_SYMBOL_TARGET_BOX = {
  width: 36,
  height: 28,
} as const;

const SCHEMATIC_SYMBOL_MIN_READABLE_SIZE = 14;

const ENGINEERING_SYMBOL_NOMINAL_SIZES: Record<EngineeringEquipmentType, { width: number; height: number }> = {
  pump: { width: 28, height: 28 },
  heatExchanger: { width: 46, height: 30 },
  filter: { width: 28, height: 28 },
  valve: { width: 28, height: 22 },
  checkValve: { width: 26, height: 20 },
  controlValve: { width: 30, height: 34 },
  expansionTank: { width: 28, height: 32 },
  manifold: { width: 48, height: 18 },
  heatMeter: { width: 34, height: 22 },
  automationCabinet: { width: 30, height: 40 },
  sensorTemperature: { width: 18, height: 18 },
  sensorPressure: { width: 18, height: 18 },
  gateValve: { width: 26, height: 28 },
  ballValve: { width: 24, height: 22 },
  threeWayValve: { width: 28, height: 34 },
  balancingValve: { width: 28, height: 28 },
  safetyValve: { width: 26, height: 32 },
  pressureRegulator: { width: 30, height: 38 },
  thermostaticValve: { width: 26, height: 34 },
  flowMeter: { width: 32, height: 18 },
  convector: { width: 36, height: 26 },
  sensorFlow: { width: 18, height: 18 },
  sensorHumidity: { width: 18, height: 18 },
  airHandlingUnit: { width: 58, height: 28 },
  ductFan: { width: 30, height: 24 },
  roofFan: { width: 30, height: 24 },
  airDamper: { width: 28, height: 18 },
  airCheckValve: { width: 30, height: 18 },
  fireDamper: { width: 30, height: 18 },
  airFilter: { width: 32, height: 18 },
  airFlowRegulatorConst: { width: 30, height: 18 },
  airFlowRegulatorVar: { width: 30, height: 18 },
  silencer: { width: 34, height: 18 },
  airHeater: { width: 32, height: 18 },
  airCooler: { width: 32, height: 18 },
  airHumidifier: { width: 32, height: 18 },
  airDehumidifier: { width: 32, height: 18 },
  supplyDiffuser: { width: 20, height: 20 },
  exhaustGrille: { width: 24, height: 16 },
};

type ResolvedSymbolMetrics = {
  center: { x: number; y: number };
  width: number;
  height: number;
  rotation: number;
  palette: RenderPalette;
  showPorts: boolean;
  portRadius: number;
};

function resolvePalette(selected: boolean, hovered: boolean, preview: boolean): RenderPalette {
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

function frame(
  cx: number,
  cy: number,
  rotation: number,
  width: number,
  height: number,
  palette: RenderPalette,
  children: ReactNode,
  selected: boolean,
  className?: string
) {
  return (
    <g className={className} transform={`translate(${cx}, ${cy}) rotate(${rotation})`}>
      {selected ? (
        <rect
          x={-width / 2 - 6}
          y={-height / 2 - 6}
          width={width + 12}
          height={height + 12}
          rx={14}
          fill={palette.soft}
          stroke="none"
        />
      ) : null}
      <g
        fill="none"
        stroke={palette.stroke}
        strokeWidth={palette.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </g>
  );
}

function resolveSymbolMetrics(
  props: EngineeringSymbolProps,
  defaultWidth: number,
  defaultHeight: number
): ResolvedSymbolMetrics {
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

function renderPortStem(
  direction: EngineeringPortDirection,
  x: number,
  y: number,
  length: number
) {
  switch (direction) {
    case "left":
      return <line x1={x - length} y1={y} x2={x} y2={y} />;
    case "right":
      return <line x1={x} y1={y} x2={x + length} y2={y} />;
    case "top":
      return <line x1={x} y1={y - length} x2={x} y2={y} />;
    case "bottom":
    default:
      return <line x1={x} y1={y} x2={x} y2={y + length} />;
  }
}

function renderPorts(
  ports: EngineeringSymbolProps["ports"],
  metrics: Pick<ResolvedSymbolMetrics, "showPorts" | "portRadius" | "palette">
) {
  if (!metrics.showPorts || !ports?.length) {
    return null;
  }
  const stemLength = Math.max(5, metrics.portRadius * 1.7);
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {ports.map((port) => {
        const mediumStyle = ENGINEERING_MEDIUM_STYLES[port.medium];
        return (
          <g key={port.id}>
            <g stroke={mediumStyle.stroke} strokeWidth={1.4}>
              {renderPortStem(port.direction, port.x, port.y, stemLength)}
            </g>
            <circle
              cx={port.x}
              cy={port.y}
              r={metrics.portRadius}
              fill={metrics.palette.fill}
              stroke={metrics.palette.stroke}
              strokeWidth={1.2}
            />
            <circle cx={port.x} cy={port.y} r={Math.max(1.6, metrics.portRadius * 0.48)} fill={mediumStyle.stroke} stroke="none" />
          </g>
        );
      })}
    </g>
  );
}

function symbolFrame(
  props: EngineeringSymbolProps,
  defaultWidth: number,
  defaultHeight: number,
  renderBody: (metrics: ResolvedSymbolMetrics) => ReactNode
) {
  const metrics = resolveSymbolMetrics(props, defaultWidth, defaultHeight);
  return frame(
    metrics.center.x,
    metrics.center.y,
    metrics.rotation,
    metrics.width,
    metrics.height,
    metrics.palette,
    <>
      {renderBody(metrics)}
      {renderPorts(props.ports, metrics)}
    </>,
    Boolean(props.selected),
    props.className
  );
}

function valveCore(width: number, height: number, palette: RenderPalette, actuator = false) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return (
    <>
      <path d={`M ${-halfWidth} ${-halfHeight * 0.7} L 0 0 L ${-halfWidth} ${halfHeight * 0.7} Z`} fill={palette.fill} />
      <path d={`M ${halfWidth} ${-halfHeight * 0.7} L 0 0 L ${halfWidth} ${halfHeight * 0.7} Z`} fill={palette.fill} />
      {actuator ? (
        <>
          <line x1={0} y1={-halfHeight * 0.9} x2={0} y2={-halfHeight * 1.65} />
          <rect
            x={-width * 0.12}
            y={-halfHeight * 1.95}
            width={width * 0.24}
            height={height * 0.5}
            rx={4}
            fill={palette.fill}
          />
        </>
      ) : null}
    </>
  );
}

function labelGlyph(text: string, x: number, y: number, palette: RenderPalette, size = 11) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={size}
      fontWeight={700}
      fill={palette.stroke}
      stroke="none"
    >
      {text}
    </text>
  );
}

export function resolveEngineeringEquipmentRenderSize(
  type: EngineeringEquipmentType,
  width: number,
  height: number,
  sizeMode: EngineeringSymbolSizeMode = "instance"
) {
  const resolvedWidth = Math.max(20, width);
  const resolvedHeight = Math.max(18, height);
  if (sizeMode !== "schematic") {
    return { width: resolvedWidth, height: resolvedHeight };
  }
  const nominal = ENGINEERING_SYMBOL_NOMINAL_SIZES[type];
  const fitScale = Math.min(
    SCHEMATIC_SYMBOL_TARGET_BOX.width / nominal.width,
    SCHEMATIC_SYMBOL_TARGET_BOX.height / nominal.height
  );
  const minSize = Math.min(nominal.width, nominal.height);
  const readableScale = SCHEMATIC_SYMBOL_MIN_READABLE_SIZE / minSize;
  const scale =
    nominal.width * readableScale <= SCHEMATIC_SYMBOL_TARGET_BOX.width &&
    nominal.height * readableScale <= SCHEMATIC_SYMBOL_TARGET_BOX.height
      ? Math.max(fitScale, readableScale)
      : fitScale;
  return {
    width: nominal.width * scale,
    height: nominal.height * scale,
  };
}

export function resolveEngineeringEquipmentRenderRotation(
  equipment: Pick<EngineeringEquipment, "id" | "type" | "rotation">,
  pipes: EngineeringPipe[]
) {
  if (equipment.type !== "pump") {
    return equipment.rotation;
  }
  const outgoing = pipes.find((pipe) => pipe.fromEquipmentId === equipment.id && pipe.points.length >= 2);
  if (outgoing) {
    const from = outgoing.points[0];
    const to = outgoing.points[1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) > 1e-6) {
      return (Math.atan2(dy, dx) * 180) / Math.PI;
    }
  }
  const incoming = pipes.find((pipe) => pipe.toEquipmentId === equipment.id && pipe.points.length >= 2);
  if (incoming) {
    const from = incoming.points[incoming.points.length - 2];
    const to = incoming.points[incoming.points.length - 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) > 1e-6) {
      return (Math.atan2(dy, dx) * 180) / Math.PI;
    }
  }
  return equipment.rotation;
}

export function resolveEngineeringRenderedPortPosition(
  equipment: Pick<EngineeringEquipment, "type" | "width" | "height" | "rotation">,
  portId: string,
  center: { x: number; y: number },
  options: {
    sizeMode?: EngineeringSymbolSizeMode;
    rotation?: number;
  } = {}
) {
  const size = resolveEngineeringEquipmentRenderSize(
    equipment.type,
    equipment.width,
    equipment.height,
    options.sizeMode
  );
  const port = buildEngineeringPorts(equipment.type, size.width, size.height).find((item) => item.id === portId);
  if (!port) {
    return null;
  }
  const rotationDeg = typeof options.rotation === "number" && Number.isFinite(options.rotation)
    ? options.rotation
    : equipment.rotation;
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: center.x + port.x * cos - port.y * sin,
    y: center.y + port.x * sin + port.y * cos,
  };
}

export function PumpSymbol(props: EngineeringSymbolProps) {
  const variant = props.parameters?.variant as string | undefined;
  return symbolFrame(props, 28, 28, ({ width, height, palette }) => {
    const radius = Math.min(width, height) * 0.42;
    const hw = width / 2;
    const tipX = radius;
    const triangleHeight = radius * 0.68;
    const halfBaseY = triangleHeight / Math.sqrt(3);
    const baseX = tipX - triangleHeight;

    if (variant === "centrifugal") {
      return (
        <>
          <circle cx={0} cy={0} r={radius} fill={palette.fill} />
          <path
            d={`M ${baseX} ${halfBaseY} L ${tipX} 0 L ${baseX} ${-halfBaseY} Z`}
            fill={palette.accent}
            stroke="none"
          />
          {/* Тангенциальный выход вверх */}
          <line x1={0} y1={-radius} x2={0} y2={-hw * 0.96} />
        </>
      );
    }

    return (
      <>
        <circle cx={0} cy={0} r={radius} fill={palette.fill} />
        <path
          d={`M ${baseX} ${halfBaseY} L ${tipX} 0 L ${baseX} ${-halfBaseY} Z`}
          fill={palette.accent}
          stroke="none"
        />
        {variant === "variable" ? (
          <line x1={-radius * 0.62} y1={radius * 0.62} x2={radius * 0.62} y2={-radius * 0.62} />
        ) : null}
      </>
    );
  });
}

/** Теплообменник пластинчатый 3.7.01 — прямоугольник с вертикальными пластинами */
export function HeatExchangerSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 46, 30, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    const plateXs = [-0.3, -0.15, 0, 0.15, 0.3].map((f) => width * f);
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={4} fill={palette.fill} />
        {plateXs.map((x, i) => (
          <line key={i} x1={x} y1={-hh * 0.75} x2={x} y2={hh * 0.75} />
        ))}
      </>
    );
  });
}

/** Фильтр 2.9.01 — ромб с крестообразной сеткой */
export function FilterSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 28, 28, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <path d={`M 0 ${-hh} L ${hw} 0 L 0 ${hh} L ${-hw} 0 Z`} fill={palette.fill} />
        <line x1={-hw * 0.5} y1={-hh * 0.5} x2={hw * 0.5} y2={hh * 0.5} />
        <line x1={hw * 0.5} y1={-hh * 0.5} x2={-hw * 0.5} y2={hh * 0.5} />
      </>
    );
  });
}

export function ValveSymbol(props: EngineeringSymbolProps) {
  const variant = props.parameters?.variant as string | undefined;
  if (variant === "angular") {
    return symbolFrame(props, 26, 26, ({ width, height, palette }) => {
      const hw = width / 2;
      const hh = height / 2;
      return (
        <>
          {/* Горизонтальный вход */}
          <path d={`M ${-hw} ${-hh * 0.65} L 0 0 L ${-hw} ${hh * 0.65} Z`} fill={palette.fill} />
          {/* Вертикальный выход (угловой) */}
          <path d={`M ${-hh * 0.65} ${-hh} L 0 0 L ${hh * 0.65} ${-hh} Z`} fill={palette.fill} />
        </>
      );
    });
  }
  return symbolFrame(props, 28, 22, ({ width, height, palette }) => valveCore(width * 0.42, height * 0.7, palette));
}

/**
 * Обратный клапан ГОСТ 21-205-2016 — белый (открытый) треугольник со стороны входа
 * + чёрный (заполненный) треугольник со стороны выхода, оба вершинами к центру.
 */
export function CheckValveSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 26, 20, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        {/* Белый треугольник — сторона входа */}
        <path d={`M ${-hw} ${-hh * 0.78} L 0 0 L ${-hw} ${hh * 0.78} Z`} fill={palette.fill} />
        {/* Чёрный треугольник — сторона выхода */}
        <path d={`M ${hw} ${-hh * 0.78} L 0 0 L ${hw} ${hh * 0.78} Z`} fill={palette.stroke} stroke="none" />
      </>
    );
  });
}

export function ControlValveSymbol(props: EngineeringSymbolProps) {
  const variant = props.parameters?.variant as string | undefined;
  if (variant === "angular") {
    return symbolFrame(props, 30, 38, ({ width, height, palette }) => {
      const hw = width / 2;
      const hh = height / 2;
      return (
        <>
          <path d={`M ${-hw} ${-hh * 0.45} L 0 0 L ${-hw} ${hh * 0.45} Z`} fill={palette.fill} />
          <path d={`M ${-hh * 0.45} ${-hh * 0.55} L 0 0 L ${hh * 0.45} ${-hh * 0.55} Z`} fill={palette.fill} />
          <line x1={0} y1={-hh * 0.55} x2={0} y2={-hh * 0.96} />
          <rect x={-width * 0.12} y={-hh * 1.28} width={width * 0.24} height={hh * 0.5} rx={4} fill={palette.fill} />
        </>
      );
    });
  }
  if (variant === "triple") {
    return symbolFrame(props, 30, 34, ({ width, height, palette }) => {
      const hw = width / 2;
      const hh = height / 2;
      return (
        <>
          {valveCore(width * 0.42, height * 0.7, palette, true)}
          <line x1={0} y1={hh * 0.3} x2={0} y2={hh * 0.9} />
        </>
      );
    });
  }
  return symbolFrame(props, 30, 34, ({ width, height, palette }) => valveCore(width * 0.42, height * 0.7, palette, true));
}

/** Бак расширительный мембранный 3.7.06 — окружность с горизонтальной мембраной */
export function ExpansionTankSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 28, 32, ({ width, height, palette }) => {
    const r = Math.min(width, height) * 0.38;
    const cy = -height * 0.06;
    return (
      <>
        {/* Корпус */}
        <circle cx={0} cy={cy} r={r} fill={palette.fill} />
        {/* Водяная (нижняя) зона — лёгкая тонировка */}
        <path d={`M ${-r} ${cy} A ${r} ${r} 0 0 1 ${r} ${cy} Z`} fill={palette.soft} stroke="none" />
        {/* Контур поверх заливки + мембрана */}
        <circle cx={0} cy={cy} r={r} fill="none" />
        <line x1={-r} y1={cy} x2={r} y2={cy} />
        {/* Патрубок подключения снизу */}
        <line x1={0} y1={cy + r} x2={0} y2={cy + r + height * 0.15} />
      </>
    );
  });
}

export function ManifoldSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 48, 18, ({ width, height, palette }) => {
    const halfWidth = width / 2;
    return (
      <>
        <rect
          x={-halfWidth}
          y={-height * 0.18}
          width={width}
          height={height * 0.36}
          rx={height * 0.18}
          fill={palette.fill}
        />
        {[-0.26, 0, 0.26].map((offset) => (
          <line key={offset} x1={width * offset} y1={-height * 0.52} x2={width * offset} y2={height * 0.52} />
        ))}
      </>
    );
  });
}

export function HeatMeterSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 34, 22, ({ width, height, palette }) => {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    return (
      <>
        <rect x={-halfWidth} y={-halfHeight} width={width} height={height} rx={12} fill={palette.fill} />
        <circle cx={-width * 0.18} cy={0} r={Math.min(width, height) * 0.16} fill={palette.fill} />
        <line x1={-width * 0.18} y1={0} x2={-width * 0.1} y2={-height * 0.08} />
        {labelGlyph("Q", width * 0.16, 0, palette, 11)}
      </>
    );
  });
}

export function AutomationCabinetSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 30, 40, ({ width, height, palette }) => {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    return (
      <>
        <rect x={-halfWidth} y={-halfHeight} width={width} height={height} rx={10} fill={palette.fill} />
        <line x1={-width * 0.18} y1={-halfHeight} x2={-width * 0.18} y2={halfHeight} />
        <circle cx={width * 0.18} cy={-height * 0.18} r={height * 0.07} fill={palette.accent} stroke="none" />
        <circle cx={width * 0.18} cy={0} r={height * 0.07} fill={palette.accent} stroke="none" />
        <circle cx={width * 0.18} cy={height * 0.18} r={height * 0.07} fill={palette.accent} stroke="none" />
        {labelGlyph("ША", -width * 0.02, 0, palette, 11)}
      </>
    );
  });
}

export function SensorSymbol({ variant = "temperature", ...props }: SensorSymbolProps) {
  const labelChar = variant === "pressure" ? "P" : variant === "flow" ? "G" : variant === "humidity" ? "φ" : "T";
  return symbolFrame(props, 18, 18, ({ width, height, palette }) => (
    <>
      <line x1={0} y1={height * 0.2} x2={0} y2={height * 0.56} />
      <circle cx={0} cy={0} r={Math.min(width, height) * 0.46} fill={palette.fill} />
      {labelGlyph(labelChar, 0, 0, palette, 12)}
    </>
  ));
}

// ── АВОК СТО НП 1.05-2006 ────────────────────────────────────────────────────

/** Задвижка ГОСТ 21-205-2016 — два треугольника + вертикальная линия-затвор + шток */
export function GateValveSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 26, 28, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <path d={`M ${-hw} ${-hh * 0.62} L 0 0 L ${-hw} ${hh * 0.62} Z`} fill={palette.fill} />
        <path d={`M ${hw} ${-hh * 0.62} L 0 0 L ${hw} ${hh * 0.62} Z`} fill={palette.fill} />
        {/* Вертикальная линия — затвор (ГОСТ 21-205-2016, в отличие от АВОК нет заполненного прямоугольника) */}
        <line x1={0} y1={-hh * 0.72} x2={0} y2={hh * 0.72} />
        {/* Шток */}
        <line x1={0} y1={-hh * 0.72} x2={0} y2={-hh * 1.22} />
        <line x1={-hw * 0.22} y1={-hh * 1.22} x2={hw * 0.22} y2={-hh * 1.22} />
      </>
    );
  });
}

/** Кран шаровой ГОСТ 21-205-2016 — ромб (повёрнутый квадрат) со штоком */
export function BallValveSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 24, 22, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    const d = Math.min(hw, hh) * 0.78;
    return (
      <>
        {/* Ромб — корпус крана */}
        <path d={`M 0 ${-d} L ${d} 0 L 0 ${d} L ${-d} 0 Z`} fill={palette.fill} />
        {/* Штуцеры подключения */}
        <line x1={-hw} y1={0} x2={-d} y2={0} />
        <line x1={d} y1={0} x2={hw} y2={0} />
        {/* Шток */}
        <line x1={0} y1={-d} x2={0} y2={-hh * 1.08} />
        <line x1={-hw * 0.24} y1={-hh * 1.08} x2={hw * 0.24} y2={-hh * 1.08} />
      </>
    );
  });
}

/** Кран трёхходовой 2.8.08 — три направления с треугольными телами */
export function ThreeWayValveSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 28, 34, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    const bh = hh * 0.45;
    return (
      <>
        <path d={`M ${-hw} ${-bh} L ${-hw * 0.22} 0 L ${-hw} ${bh} Z`} fill={palette.fill} />
        <path d={`M ${hw} ${-bh} L ${hw * 0.22} 0 L ${hw} ${bh} Z`} fill={palette.fill} />
        <path d={`M ${-hw * 0.22} ${-bh * 0.6} L 0 ${-hh * 0.7} L ${hw * 0.22} ${-bh * 0.6} Z`} fill={palette.fill} />
        <line x1={0} y1={-hh * 0.7} x2={0} y2={-hh} />
      </>
    );
  });
}

/** Клапан балансировочный ручной 2.8.13 — вентиль с рисками регулировки */
export function BalancingValveSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 28, 28, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <path d={`M ${-hw} ${-hh * 0.58} L 0 0 L ${-hw} ${hh * 0.58} Z`} fill={palette.fill} />
        <path d={`M ${hw} ${-hh * 0.58} L 0 0 L ${hw} ${hh * 0.58} Z`} fill={palette.fill} />
        <line x1={0} y1={-hh * 0.58} x2={0} y2={-hh * 1.18} />
        <line x1={-hw * 0.28} y1={-hh * 0.88} x2={hw * 0.28} y2={-hh * 0.88} />
        <line x1={-hw * 0.22} y1={-hh * 1.1} x2={hw * 0.22} y2={-hh * 1.1} />
      </>
    );
  });
}

/** Клапан предохранительный 2.8.23 — вентиль со стрелкой аварийного выброса */
export function SafetyValveSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 26, 32, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <path d={`M ${-hw} ${-hh * 0.52} L 0 0 L ${-hw} ${hh * 0.52} Z`} fill={palette.fill} />
        <path d={`M ${hw} ${-hh * 0.52} L 0 0 L ${hw} ${hh * 0.52} Z`} fill={palette.fill} />
        <line x1={0} y1={-hh * 0.52} x2={0} y2={-hh * 1.4} />
        <path d={`M ${-hw * 0.24} ${-hh * 1.12} L 0 ${-hh * 1.45} L ${hw * 0.24} ${-hh * 1.12}`} />
      </>
    );
  });
}

/** Регулятор перепада давления 2.8.20 — вентиль с мембраной ΔP */
export function PressureRegulatorSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 30, 38, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <path d={`M ${-hw} ${-hh * 0.42} L 0 0 L ${-hw} ${hh * 0.42} Z`} fill={palette.fill} />
        <path d={`M ${hw} ${-hh * 0.42} L 0 0 L ${hw} ${hh * 0.42} Z`} fill={palette.fill} />
        <line x1={0} y1={-hh * 0.42} x2={0} y2={-hh * 0.82} />
        <ellipse cx={0} cy={-hh * 1.06} rx={hw * 0.52} ry={hh * 0.26} fill={palette.fill} />
        <line x1={-hw * 0.88} y1={-hh * 1.06} x2={-hw * 0.55} y2={-hh * 1.06} />
        <path d={`M ${-hw * 0.72} ${-hh * 1.26} L ${-hw * 0.88} ${-hh * 1.06} L ${-hw * 0.72} ${-hh * 0.86}`} />
        <line x1={hw * 0.55} y1={-hh * 1.06} x2={hw * 0.88} y2={-hh * 1.06} />
      </>
    );
  });
}

/** Терморегулятор радиаторный 2.8.19 — вентиль с термоголовкой (окружность) */
export function ThermostaticValveSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 26, 34, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <path d={`M ${-hw} ${-hh * 0.5} L 0 0 L ${-hw} ${hh * 0.5} Z`} fill={palette.fill} />
        <path d={`M ${hw} ${-hh * 0.5} L 0 0 L ${hw} ${hh * 0.5} Z`} fill={palette.fill} />
        <line x1={0} y1={-hh * 0.5} x2={0} y2={-hh * 0.88} />
        <circle cx={0} cy={-hh * 1.22} r={hh * 0.36} fill={palette.fill} />
        {labelGlyph("t", 0, -hh * 1.22, palette, 10)}
      </>
    );
  });
}

/** Расходомер ГОСТ 21-205-2016 — окружность на трубопроводе (–○–), без подписей */
export function FlowMeterSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 32, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const r = Math.min(width, height) * 0.3;
    return (
      <>
        <circle cx={0} cy={0} r={r} fill={palette.fill} />
        <line x1={-hw} y1={0} x2={-r} y2={0} />
        <line x1={r} y1={0} x2={hw} y2={0} />
      </>
    );
  });
}

/** Конвектор 3.1.04 — корпус снизу, стрелки конвекции направлены вверх */
export function ConvectorSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 36, 26, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    const bodyTop = hh * 0.18;
    const finBase = bodyTop;
    const finTip = -hh * 0.82;
    const tipOff = width * 0.04;
    const fins = [-0.38, -0.14, 0.14, 0.38] as const;
    return (
      <>
        {/* Рёбра — вертикальные линии вверх */}
        {fins.map((f) => (
          <line key={f} x1={width * f} y1={finBase} x2={width * f} y2={finTip} />
        ))}
        {/* Наконечники стрелок — вверх */}
        {fins.map((f) => (
          <path key={`a${f}`} d={`M ${width * f - tipOff} ${finTip + hh * 0.26} L ${width * f} ${finTip} L ${width * f + tipOff} ${finTip + hh * 0.26}`} />
        ))}
        {/* Корпус конвектора — снизу (рисуем поверх оснований рёбер) */}
        <rect x={-hw} y={bodyTop} width={width} height={height * 0.5} rx={3} fill={palette.fill} />
      </>
    );
  });
}

export function AirHandlingUnitSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 58, 28, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    const fanR = Math.min(width, height) * 0.18;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={4} fill={palette.fill} />
        <line x1={-width * 0.1} y1={-hh} x2={-width * 0.1} y2={hh} />
        <line x1={width * 0.18} y1={-hh} x2={width * 0.18} y2={hh} />
        <circle cx={-width * 0.28} cy={0} r={fanR} fill={palette.fill} />
        <path
          d={`M ${-width * 0.36} ${fanR * 0.45} L ${-width * 0.2} 0 L ${-width * 0.36} ${-fanR * 0.45} Z`}
          fill={palette.accent}
          stroke="none"
        />
        <path d={`M ${width * 0.02} ${-hh * 0.62} L ${width * 0.12} ${hh * 0.62}`} />
        <path d={`M ${width * 0.12} ${-hh * 0.62} L ${width * 0.02} ${hh * 0.62}`} />
        <path
          d={`M ${width * 0.28} ${hh * 0.22} L ${width * 0.34} ${-hh * 0.02} L ${width * 0.4} ${hh * 0.22} L ${width * 0.46} ${-hh * 0.02}`}
        />
      </>
    );
  });
}

export function DuctFanSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 30, 24, ({ width, height, palette }) => {
    const hw = width / 2;
    const radius = Math.min(width, height) * 0.34;
    return (
      <>
        <rect x={-hw} y={-height * 0.36} width={width} height={height * 0.72} rx={height * 0.2} fill={palette.fill} />
        <circle cx={0} cy={0} r={radius} fill={palette.fill} />
        <path d={`M ${-radius * 0.78} ${radius * 0.42} L ${radius * 0.72} 0 L ${-radius * 0.78} ${-radius * 0.42} Z`} fill={palette.accent} stroke="none" />
        <line x1={0} y1={-height * 0.36} x2={0} y2={-height * 0.62} />
      </>
    );
  });
}

export function RoofFanSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 30, 24, ({ width, height, palette }) => {
    const radius = Math.min(width, height) * 0.32;
    return (
      <>
        <rect x={-width * 0.42} y={-height * 0.18} width={width * 0.84} height={height * 0.36} rx={height * 0.12} fill={palette.fill} />
        <circle cx={0} cy={0} r={radius} fill={palette.fill} />
        <path d={`M ${-radius * 0.78} ${radius * 0.42} L ${radius * 0.72} 0 L ${-radius * 0.78} ${-radius * 0.42} Z`} fill={palette.accent} stroke="none" />
        <path d={`M ${-width * 0.42} ${height * 0.34} L 0 ${height * 0.54} L ${width * 0.42} ${height * 0.34}`} />
        <line x1={0} y1={-height * 0.18} x2={0} y2={-height * 0.46} />
      </>
    );
  });
}

export function AirDamperSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 28, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        <line x1={-hw * 0.72} y1={hh * 0.72} x2={hw * 0.72} y2={-hh * 0.72} />
        <line x1={-hw * 0.2} y1={hh * 0.3} x2={hw * 0.2} y2={-hh * 0.3} />
      </>
    );
  });
}

export function AirCheckValveSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 30, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        <path d={`M ${-width * 0.22} ${-hh * 0.58} L ${width * 0.16} 0 L ${-width * 0.22} ${hh * 0.58} Z`} />
        <line x1={width * 0.22} y1={-hh * 0.66} x2={width * 0.22} y2={hh * 0.66} />
      </>
    );
  });
}

export function FireDamperSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 30, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        <line x1={-hw * 0.76} y1={hh * 0.76} x2={hw * 0.76} y2={-hh * 0.76} />
        <line x1={-hw * 0.76} y1={-hh * 0.76} x2={hw * 0.2} y2={hh * 0.2} />
        <rect x={-width * 0.1} y={-height * 0.2} width={width * 0.2} height={height * 0.4} fill={palette.fill} />
      </>
    );
  });
}

export function AirFilterSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 32, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        {[-0.42, -0.14, 0.14, 0.42].map((offset) => (
          <line
            key={offset}
            x1={width * (offset - 0.12)}
            y1={hh * 0.78}
            x2={width * (offset + 0.12)}
            y2={-hh * 0.78}
          />
        ))}
      </>
    );
  });
}

export function AirFlowRegulatorConstSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 30, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        <line x1={-width * 0.18} y1={-hh * 0.72} x2={-width * 0.18} y2={hh * 0.72} />
        <line x1={width * 0.18} y1={-hh * 0.72} x2={width * 0.18} y2={hh * 0.72} />
        <line x1={-width * 0.3} y1={0} x2={width * 0.3} y2={0} />
      </>
    );
  });
}

export function AirFlowRegulatorVarSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 30, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        <line x1={-width * 0.18} y1={-hh * 0.72} x2={-width * 0.18} y2={hh * 0.72} />
        <line x1={width * 0.18} y1={-hh * 0.72} x2={width * 0.18} y2={hh * 0.72} />
        <line x1={-width * 0.3} y1={hh * 0.54} x2={width * 0.3} y2={-hh * 0.54} />
      </>
    );
  });
}

export function SilencerSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 34, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        {[-0.28, 0, 0.28].map((offset) => (
          <line key={offset} x1={width * offset} y1={-hh * 0.8} x2={width * offset} y2={hh * 0.8} />
        ))}
      </>
    );
  });
}

export function AirHeaterSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 32, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        <path
          d={`M ${-width * 0.34} ${hh * 0.45} L ${-width * 0.18} ${-hh * 0.45} L 0 ${hh * 0.45} L ${width * 0.18} ${-hh * 0.45} L ${width * 0.34} ${hh * 0.45}`}
        />
      </>
    );
  });
}

export function AirCoolerSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 32, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        <path
          d={`M ${-width * 0.34} ${-hh * 0.46} L ${-width * 0.18} ${hh * 0.46} L 0 ${-hh * 0.46} L ${width * 0.18} ${hh * 0.46} L ${width * 0.34} ${-hh * 0.46}`}
        />
        <line x1={-width * 0.1} y1={-hh * 0.1} x2={width * 0.1} y2={hh * 0.1} />
      </>
    );
  });
}

export function AirHumidifierSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 32, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        <path
          d={`M 0 ${-hh * 0.52} C ${width * 0.14} ${-hh * 0.18}, ${width * 0.2} ${hh * 0.08}, 0 ${hh * 0.42} C ${-width * 0.2} ${hh * 0.08}, ${-width * 0.14} ${-hh * 0.18}, 0 ${-hh * 0.52} Z`}
        />
        <line x1={-width * 0.3} y1={hh * 0.48} x2={width * 0.3} y2={hh * 0.48} />
      </>
    );
  });
}

export function AirDehumidifierSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 32, 18, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        <path
          d={`M 0 ${-hh * 0.5} C ${width * 0.12} ${-hh * 0.16}, ${width * 0.18} ${hh * 0.12}, 0 ${hh * 0.42} C ${-width * 0.18} ${hh * 0.12}, ${-width * 0.12} ${-hh * 0.16}, 0 ${-hh * 0.5} Z`}
        />
        <line x1={-width * 0.22} y1={-hh * 0.44} x2={width * 0.24} y2={hh * 0.34} />
      </>
    );
  });
}

export function SupplyDiffuserSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 20, 20, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw * 0.82} y={-hh * 0.82} width={width * 1.64} height={height * 1.64} rx={2} fill={palette.fill} />
        <rect x={-hw * 0.24} y={-hh * 0.24} width={width * 0.48} height={height * 0.48} fill={palette.fill} />
        <line x1={0} y1={-hh * 0.24} x2={0} y2={-hh * 0.72} />
        <line x1={0} y1={hh * 0.24} x2={0} y2={hh * 0.72} />
        <line x1={-hw * 0.24} y1={0} x2={-hw * 0.72} y2={0} />
        <line x1={hw * 0.24} y1={0} x2={hw * 0.72} y2={0} />
      </>
    );
  });
}

export function ExhaustGrilleSymbol(props: EngineeringSymbolProps) {
  return symbolFrame(props, 24, 16, ({ width, height, palette }) => {
    const hw = width / 2;
    const hh = height / 2;
    return (
      <>
        <rect x={-hw} y={-hh} width={width} height={height} rx={2} fill={palette.fill} />
        {[-0.35, 0, 0.35].map((offset) => (
          <line key={offset} x1={-hw * 0.72} y1={height * offset} x2={hw * 0.72} y2={height * offset} />
        ))}
      </>
    );
  });
}

const ENGINEERING_SYMBOL_RENDERERS: Record<EngineeringEquipmentType, EngineeringSymbolRenderer> = {
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
  airHandlingUnit: AirHandlingUnitSymbol,
  ductFan: DuctFanSymbol,
  roofFan: RoofFanSymbol,
  airDamper: AirDamperSymbol,
  airCheckValve: AirCheckValveSymbol,
  fireDamper: FireDamperSymbol,
  airFilter: AirFilterSymbol,
  airFlowRegulatorConst: AirFlowRegulatorConstSymbol,
  airFlowRegulatorVar: AirFlowRegulatorVarSymbol,
  silencer: SilencerSymbol,
  airHeater: AirHeaterSymbol,
  airCooler: AirCoolerSymbol,
  airHumidifier: AirHumidifierSymbol,
  airDehumidifier: AirDehumidifierSymbol,
  supplyDiffuser: SupplyDiffuserSymbol,
  exhaustGrille: ExhaustGrilleSymbol,
};

export function getEngineeringSymbolRenderer(type: EngineeringEquipmentType): EngineeringSymbolRenderer {
  return ENGINEERING_SYMBOL_RENDERERS[type];
}

export function renderEngineeringEquipmentSymbol(
  equipment: Pick<EngineeringEquipment, "type" | "rotation" | "width" | "height"> & {
    ports?: Pick<EngineeringPort, "id" | "x" | "y" | "direction" | "medium">[];
    parameters?: EngineeringEquipmentParameters;
  },
  center: { x: number; y: number },
  options: {
    selected?: boolean;
    hovered?: boolean;
    preview?: boolean;
    showPorts?: boolean;
    scale?: number;
    portRadius?: number;
    sizeMode?: EngineeringSymbolSizeMode;
  } = {}
) {
  const Renderer = getEngineeringSymbolRenderer(equipment.type);
  const size = resolveEngineeringEquipmentRenderSize(
    equipment.type,
    equipment.width,
    equipment.height,
    options.sizeMode
  );
  return Renderer({
    center,
    rotation: equipment.rotation,
    width: size.width,
    height: size.height,
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
