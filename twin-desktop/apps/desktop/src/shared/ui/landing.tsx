import { useState, type ReactNode } from "react";
import {
  IconFlame,
  IconModel,
  IconReport,
  IconRisk,
  IconStatusOk,
  IconSun,
  IconThermometer,
  IconWind,
} from "./icons";

// ─── Hero: app-window mockup ─────────────────────────────────────────────────

const BREAKDOWN_BARS = [
  { lbl: "Стены",    w: "42%", c: "#3d82fa" },
  { lbl: "Окна",     w: "28%", c: "#a3e635" },
  { lbl: "Перекр.",  w: "18%", c: "#fac024" },
  { lbl: "Вентил.",  w: "12%", c: "#f97316" },
] as const;

export function HeroAppWindow() {
  return (
    <div className="lp-window ui-hero-appear--scale" style={{ animationDelay: "180ms" }}>
      {/* Window chrome */}
      <div className="lp-window__bar">
        <span className="lp-window__dot lp-window__dot--red" />
        <span className="lp-window__dot lp-window__dot--yellow" />
        <span className="lp-window__dot lp-window__dot--green" />
        <span className="lp-window__title">TherNest — Тепловой баланс</span>
        <span className="lp-window__live">● live</span>
      </div>

      {/* Window body */}
      <div className="lp-window__body">
        <div className="lp-win-grid">
          {/* Left: KPI + chips */}
          <div className="lp-win-left">
            <div className="lp-win-kpi">
              <p className="lp-win-kpi__lbl">Теплопотери</p>
              <p className="lp-win-kpi__big">
                8,6<span className="lp-win-kpi__unit">кВт</span>
              </p>
              <div className="lp-win-kpi__bar" aria-hidden>
                <span className="lp-win-kpi__bar-fill" />
              </div>
            </div>
            <div className="lp-win-chips">
              <div className="lp-win-chip">
                <p className="lp-win-chip__lbl">R</p>
                <p className="lp-win-chip__val">3,24</p>
              </div>
              <div className="lp-win-chip">
                <p className="lp-win-chip__lbl">T°</p>
                <p className="lp-win-chip__val">21 °C</p>
              </div>
              <div className="lp-win-chip lp-win-chip--ok">
                <p className="lp-win-chip__lbl">СП 50</p>
                <p className="lp-win-chip__val">✓</p>
              </div>
            </div>
          </div>

          {/* Right: breakdown bars */}
          <div className="lp-win-right">
            <p className="lp-win-right__ttl">Структура потерь</p>
            {BREAKDOWN_BARS.map((row) => (
              <div key={row.lbl} className="lp-win-bar">
                <span className="lp-win-bar__lbl">{row.lbl}</span>
                <div className="lp-win-bar__track" aria-hidden>
                  <span
                    className="lp-win-bar__fill"
                    style={{ "--w": row.w, "--c": row.c } as React.CSSProperties}
                  />
                </div>
                <span className="lp-win-bar__pct">{row.w}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="lp-win-status">
          <IconStatusOk size={12} />
          <span>Соответствует СП 50.1.327.2012 · ГСОП 5 618 °С·сут</span>
        </div>
      </div>
    </div>
  );
}

// ─── Legacy visual (kept for backwards compat) ───────────────────────────────

export function DarkHeroVisual() {
  return <HeroAppWindow />;
}

// ─── Hero scene illustration (flat house + meadow) ───────────────────────────

export function HeroScene({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 340"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label="Дом на лугу под солнцем"
    >
      {/* distant city silhouette */}
      <g fill="#bcd9ec" opacity="0.7">
        <rect x="860" y="170" width="34" height="80" rx="2" />
        <rect x="900" y="140" width="40" height="110" rx="2" />
        <rect x="946" y="186" width="28" height="64" rx="2" />
        <rect x="980" y="158" width="46" height="92" rx="2" />
        <rect x="1032" y="196" width="30" height="54" rx="2" />
        <rect x="1068" y="150" width="40" height="100" rx="2" />
      </g>

      {/* layered hills / meadow */}
      <path d="M0 250 Q 300 200 620 235 T 1200 228 L1200 340 L0 340Z" fill="#cdeccf" />
      <path d="M0 285 Q 360 250 720 280 T 1200 273 L1200 340 L0 340Z" fill="#a9dca0" />
      <path d="M0 312 Q 420 292 820 308 T 1200 304 L1200 340 L0 340Z" fill="#8ccd84" />

      {/* tree (left) */}
      <g transform="translate(120 150)">
        <rect x="-8" y="72" width="16" height="74" rx="5" fill="#9a6a45" />
        <circle cx="0" cy="52" r="52" fill="#7cc06a" />
        <circle cx="-38" cy="78" r="33" fill="#8fcd7c" />
        <circle cx="38" cy="78" r="33" fill="#8fcd7c" />
      </g>

      {/* house (left of centre) */}
      <g transform="translate(300 110)">
        <rect x="178" y="-8" width="22" height="54" rx="3" fill="#cf7d4d" />
        <polygon points="-12,72 120,-22 252,72" fill="#e58a52" />
        <rect x="8" y="70" width="224" height="118" rx="8" fill="#fdf2e2" />
        <rect x="92" y="120" width="56" height="68" rx="5" fill="#a26f49" />
        <circle cx="136" cy="156" r="4" fill="#f3cd84" />
        <rect x="34" y="98" width="46" height="44" rx="5" fill="#bfe3ff" stroke="#ffffff" strokeWidth="6" />
        <rect x="160" y="98" width="46" height="44" rx="5" fill="#bfe3ff" stroke="#ffffff" strokeWidth="6" />
      </g>

      {/* small flowers (foreground) */}
      {[640, 700, 1150].map((x, i) => (
        <g key={x} transform={`translate(${x} ${288 + (i % 2) * 6})`}>
          <rect x="-2" y="0" width="4" height="32" rx="2" fill="#5fa055" />
          <circle cx="0" cy="-4" r="8" fill={i === 1 ? "#f08aa6" : "#f6c945"} />
          <circle cx="0" cy="-4" r="3.5" fill="#e89c2a" />
        </g>
      ))}
    </svg>
  );
}

// ─── Hero device (light app window floating in the scene) ────────────────────

const DEVICE_BARS = [
  { lbl: "Стены", w: "42%", c: "#3d82fa" },
  { lbl: "Окна", w: "28%", c: "#22c55e" },
  { lbl: "Перекр.", w: "18%", c: "#f5a623" },
  { lbl: "Вентил.", w: "12%", c: "#f97316" },
] as const;

export function HeroDevice() {
  return (
    <div className="lp3-device">
      <div className="lp3-device__bar">
        <span className="lp3-device__dot" style={{ background: "#ff5f57" }} />
        <span className="lp3-device__dot" style={{ background: "#febc2e" }} />
        <span className="lp3-device__dot" style={{ background: "#28c840" }} />
        <span className="lp3-device__title">TherNest — тепловой баланс</span>
      </div>
      <div className="lp3-device__body">
        <div className="lp3-device__kpi">
          <p className="lp3-device__kpi-lbl">Теплопотери</p>
          <p className="lp3-device__kpi-big">
            8,6<span className="lp3-device__kpi-unit">кВт</span>
          </p>
          <div className="lp3-device__kpi-bar" aria-hidden>
            <span className="lp3-device__kpi-fill" />
          </div>
        </div>
        <div className="lp3-device__bars">
          {DEVICE_BARS.map((row) => (
            <div key={row.lbl} className="lp3-device__row">
              <span className="lp3-device__row-lbl">{row.lbl}</span>
              <span className="lp3-device__row-track" aria-hidden>
                <span
                  className="lp3-device__row-fill"
                  style={{ width: row.w, background: row.c }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="lp3-device__foot">
        <IconStatusOk size={12} />
        СП 50 · соответствует
      </div>
    </div>
  );
}

// ─── Platform mockup (zone graph + calculation log) ──────────────────────────

const GRAPH_NODES = [
  { label: "Геометрия", x: 50, y: 9, tone: "#3d82fa" },
  { label: "Ограждения", x: 89, y: 31, tone: "#22c55e" },
  { label: "Климат", x: 89, y: 71, tone: "#0ea5e9" },
  { label: "Режим", x: 50, y: 93, tone: "#f5a623" },
  { label: "Инфильтрация", x: 11, y: 71, tone: "#f97316" },
  { label: "Вентиляция", x: 11, y: 31, tone: "#8b5cf6" },
] as const;

const LOG_ITEMS = [
  { name: "Геометрия", detail: "площадь 248 м², объём 712 м³", state: "ok" as const },
  { name: "Ограждения", detail: "R стен 3,24 · окна 0,62", state: "ok" as const },
  { name: "Климат", detail: "ГСОП 5 618 °С·сут", state: "ok" as const },
  { name: "Тепловой баланс", detail: "сведение потоков", state: "run" as const },
];

export function PlatformMockup() {
  return (
    <div className="lp3-platform">
      <div className="lp3-platform__canvas">
        <div className="lp3-platform__toolbar">
          <span className="lp3-platform__chip-sm">Здание · демо</span>
          <span className="lp3-platform__zoom">60%</span>
        </div>
        <svg className="lp3-platform__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {GRAPH_NODES.map((n) => (
            <line
              key={n.label}
              x1="50"
              y1="50"
              x2={n.x}
              y2={n.y}
              stroke="#c7d4e2"
              strokeWidth="0.5"
              strokeDasharray="2 2"
            />
          ))}
        </svg>
        <span className="lp3-node lp3-node--center" style={{ left: "50%", top: "50%" }}>
          Здание
        </span>
        {GRAPH_NODES.map((n) => (
          <span
            key={n.label}
            className="lp3-node"
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            <span className="lp3-node__dot" style={{ background: n.tone }} />
            {n.label}
          </span>
        ))}
      </div>
      <aside className="lp3-platform__panel">
        <div className="lp3-platform__tabs">
          <span className="lp3-platform__tab lp3-platform__tab--active">Расчёт</span>
          <span className="lp3-platform__tab">Модель</span>
          <span className="lp3-platform__tab">Отчёты</span>
        </div>
        <div className="lp3-platform__log">
          {LOG_ITEMS.map((it) => (
            <div key={it.name} className="lp3-logitem">
              <span className={`lp3-logitem__icon lp3-logitem__icon--${it.state}`} aria-hidden>
                {it.state === "ok" ? "✓" : ""}
              </span>
              <span className="lp3-logitem__text">
                <span className="lp3-logitem__name">{it.name}</span>
                <span className="lp3-logitem__detail">{it.detail}</span>
              </span>
              <span className={`lp3-logitem__state lp3-logitem__state--${it.state}`}>
                {it.state === "ok" ? "готово" : "идёт"}
              </span>
            </div>
          ))}
        </div>
        <div className="lp3-platform__result">
          <span>Теплопотери</span>
          <b>8,6 кВт</b>
        </div>
      </aside>
    </div>
  );
}

// ─── Workflow steps ──────────────────────────────────────────────────────────

const FLOW_DATA = [
  { n: "01", title: "Геометрия" },
  { n: "02", title: "Погода" },
  { n: "03", title: "Данные" },
  { n: "04", title: "Расчёт" },
  { n: "05", title: "Отчёт" },
] as const;

export function FlowSection({ onStep }: { onStep: (i: number) => void }) {
  return (
    <div className="lp-flow">
      {FLOW_DATA.map((s, i) => (
        <button
          key={s.n}
          type="button"
          onClick={() => onStep(i)}
          className="lp-flow-step"
          style={{ ["--step-i" as string]: i }}
        >
          <span className="lp-flow-step__n" aria-hidden>{s.n}</span>
          <span className="lp-flow-step__title">{s.title}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Input factor grid (glow cards) ─────────────────────────────────────────

type FactorTone = "blue" | "lime" | "mint" | "yellow" | "orange" | "purple";

type InputFactor = {
  icon: ReactNode;
  title: string;
  hint: string;
  tags: string[];
  tone: FactorTone;
  color: string;
};

const FACTORS: InputFactor[] = [
  {
    icon: <IconModel size={18} />,
    title: "Геометрия",
    hint: "Площадь, объём, периметр здания",
    tags: ["Aотапл", "Vотапл"],
    tone: "blue",
    color: "#3d82fa",
  },
  {
    icon: <IconThermometer size={18} />,
    title: "Ограждения",
    hint: "Слои, окна, двери — тепловые сопротивления",
    tags: ["R, м²·°С/Вт", "U, Вт/м²·°С"],
    tone: "lime",
    color: "#65a30d",
  },
  {
    icon: <IconSun size={18} />,
    title: "Климат",
    hint: "Расчётная наружная температура, ГСОП",
    tags: ["t°нар", "ГСОП"],
    tone: "mint",
    color: "#059669",
  },
  {
    icon: <IconFlame size={18} />,
    title: "Режим",
    hint: "Внутренняя температура и расписание",
    tags: ["t°внутр", "ΔT"],
    tone: "yellow",
    color: "#b45309",
  },
  {
    icon: <IconRisk size={18} />,
    title: "Инфильтрация",
    hint: "Неплотности ограждений — до 20% Q",
    tags: ["n, 1/ч", "β"],
    tone: "orange",
    color: "#c2410c",
  },
  {
    icon: <IconWind size={18} />,
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

function orbitAngle(index: number) {
  return (index / ORBIT_COUNT) * 360 - 90;
}

function orbitPoint(index: number, radius: number) {
  const angleRad = (orbitAngle(index) * Math.PI) / 180;
  return {
    x: 50 + radius * Math.cos(angleRad),
    y: 50 + radius * Math.sin(angleRad),
    angleRad,
  };
}

function spokeEndpoints(index: number) {
  const start = orbitPoint(index, HUB_RADIUS);
  const end = orbitPoint(index, NODE_RADIUS);
  return { start, end };
}

export function InputFactorGrid() {
  const [active, setActive] = useState<number | null>(null);
  const nodes = FACTORS.map((_, index) => orbitPoint(index, NODE_RADIUS));

  return (
    <div className="lp-orbit" aria-label="Входные параметры теплового расчёта">
      <div className="lp-orbit__stage">
        <svg className="lp-orbit__svg" viewBox="0 0 100 100" aria-hidden>
          <defs>
            <radialGradient id="lp-orbit-aurora" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3d82fa" stopOpacity="0.22" />
              <stop offset="45%" stopColor="#059669" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="lp-orbit-ring-grad" gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="90" y2="90">
              <stop offset="0%" stopColor="#3d82fa" stopOpacity="0.5" />
              <stop offset="33%" stopColor="#059669" stopOpacity="0.35" />
              <stop offset="66%" stopColor="#b45309" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          <circle cx="50" cy="50" r="34" fill="url(#lp-orbit-aurora)" className="lp-orbit__aurora" />

          <g className="lp-orbit__ring-wrap lp-orbit__ring-wrap--reverse">
            <circle cx="50" cy="50" r={NODE_RADIUS + 3} className="lp-orbit__ring lp-orbit__ring--outer" />
          </g>

          <g className="lp-orbit__ring-wrap">
            <circle cx="50" cy="50" r={NODE_RADIUS} className="lp-orbit__ring lp-orbit__ring--grad" />
            <circle cx="50" cy="50" r={NODE_RADIUS} className="lp-orbit__ring lp-orbit__ring--trace" />
          </g>

          {nodes.map((_node, index) => {
            const factor = FACTORS[index];
            const isActive = active === index;
            const isDimmed = active !== null && !isActive;
            const { start, end } = spokeEndpoints(index);
            return (
              <g
                key={factor.title}
                className={[
                  "lp-orbit__spoke-group",
                  isActive ? "is-active" : "",
                  isDimmed ? "is-dimmed" : "",
                ].filter(Boolean).join(" ")}
                style={{ ["--node-color" as string]: factor.color }}
              >
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className="lp-orbit__spoke lp-orbit__spoke--base"
                />
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className="lp-orbit__spoke lp-orbit__spoke--flow"
                  style={{ ["--spoke-i" as string]: index }}
                />
                <circle r="0.65" className="lp-orbit__pulse">
                  <animateMotion
                    dur={`${2.4 + index * 0.25}s`}
                    repeatCount="indefinite"
                    path={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
                    begin={`${index * 0.4}s`}
                  />
                </circle>
              </g>
            );
          })}
        </svg>

        <div className="lp-orbit__hub">
          <span className="lp-orbit__hub-core">
            <span className="lp-orbit__hub-title">Итог</span>
          </span>
        </div>

        {FACTORS.map((factor, index) => {
          const node = nodes[index];
          const isActive = active === index;
          return (
            <div
              key={factor.title}
              className={["lp-orbit__node", isActive ? "is-active" : ""].filter(Boolean).join(" ")}
              title={factor.hint}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                ["--node-i" as string]: index,
                ["--node-color" as string]: factor.color,
              }}
            >
              <div className="lp-orbit__node-card">
                <span className="lp-orbit__node-dot" aria-hidden />
                <span className="lp-orbit__node-title">{factor.title}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Results dark belt ───────────────────────────────────────────────────────

const RESULT_TILES = [
  { stat: "Q",  name: "Теплопотери",     sub: "суммарные и удельные" },
  { stat: "T°", name: "Температура",     sub: "по помещениям" },
  { stat: "R",  name: "Тепловая защита", sub: "факт vs норма" },
  { stat: "5",  name: "Форм отчётов",    sub: "для экспертизы" },
] as const;

export function ResultsDarkGrid() {
  return (
    <div className="lp-results">
      {RESULT_TILES.map((item, i) => (
        <div
          key={item.stat}
          className="lp-result-tile"
          style={{ ["--tile-delay" as string]: `${i * 65}ms` }}
        >
          <p className="lp-result-tile__stat">{item.stat}</p>
          <p className="lp-result-tile__name">{item.name}</p>
          <p className="lp-result-tile__sub">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Legacy / shared components (kept for other pages) ──────────────────────

export function ProductHeroMockup() {
  return (
    <div className="ui-product-mockup ui-hero-appear--scale" style={{ animationDelay: "180ms" }}>
      <div className="ui-mockup-scanline" aria-hidden />
      <div className="relative z-[1] grid h-full min-h-[20rem] gap-3 sm:grid-cols-2">
        <div className="ui-mockup-float flex flex-col justify-between">
          <p className="text-sm font-semibold text-[color:var(--text-muted)]">2D-план</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((cell) => (
              <span
                key={cell}
                className="ui-mockup-cell aspect-square rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--workspace-canvas-bg)]"
                style={{ ["--cell-delay" as string]: `${cell * 120}ms` }}
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-[color:var(--text-muted)]">Схема помещений</p>
        </div>
        <div className="ui-mockup-float ui-mockup-float--delay flex flex-col justify-between">
          <p className="text-sm font-semibold text-[color:var(--text-muted)]">3D-модель</p>
          <div className="mt-3 flex h-28 items-end justify-center gap-2">
            <span className="ui-mockup-bar h-16 w-10 rounded-t-2xl bg-[color:var(--blue-bright)]/80" style={{ ["--bar-delay" as string]: "0ms" }} />
            <span className="ui-mockup-bar h-24 w-14 rounded-t-2xl bg-[color:var(--blue-bright)]" style={{ ["--bar-delay" as string]: "140ms" }} />
            <span className="ui-mockup-bar h-20 w-11 rounded-t-2xl bg-[color:var(--blue-bright)]/70" style={{ ["--bar-delay" as string]: "280ms" }} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-base)]">
            <IconModel size={18} className="text-[color:var(--blue-bright)]" />
            Цифровой контур
          </div>
        </div>
        <div className="ui-mockup-float ui-mockup-float--delay-2 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="ui-mockup-status flex items-center gap-2">
              <IconStatusOk size={18} className="text-[color:var(--success-fg)]" />
              <p className="text-sm font-bold text-[color:var(--text-base)]">Расчёт готов</p>
            </div>
            <span className="ui-mockup-live text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--blue-bright)]">live</span>
          </div>
          <div className="ui-mockup-progress mt-2" aria-hidden>
            <span className="ui-mockup-progress__bar" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MetricChip label="Q" value="8,6 кВт" delay="0ms" />
            <MetricChip label="R" value="3,24" delay="80ms" />
            <MetricChip label="U" value="0,31" delay="160ms" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricChip({ label, value, delay }: { label: string; value: string; delay: string }) {
  return (
    <div
      className="ui-mockup-metric rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2"
      style={{ ["--metric-delay" as string]: delay }}
    >
      <p className="text-sm font-semibold text-[color:var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-base font-bold text-[color:var(--text-base)]">{value}</p>
    </div>
  );
}

export function LandingImpactBanner({ children }: { children: ReactNode }) {
  return (
    <p className="ui-landing-impact" role="note">
      <span className="ui-landing-impact__dot" aria-hidden />
      {children}
    </p>
  );
}

export function StepChainHint() {
  const steps = ["Модель", "Данные", "Расчёт", "Отчёт"];
  return (
    <div className="ui-step-chain" aria-label="Порядок работы">
      {steps.flatMap((label, i) => {
        const pill = (
          <span key={label} className="ui-step-chain__pill" style={{ ["--chain-delay" as string]: `${i * 72}ms` }}>
            <span className="ui-step-chain__num">{i + 1}</span>
            {label}
          </span>
        );
        return i < steps.length - 1
          ? [pill, <span key={`a${i}`} className="ui-step-chain__arrow" aria-hidden>›</span>]
          : [pill];
      })}
    </div>
  );
}

export type WorkflowPipelineStep = {
  step: string;
  title: string;
  hint: string;
  tags: string[];
  tone: "blue" | "lime" | "yellow" | "mint" | "navy";
  icon: ReactNode;
  onClick: () => void;
};

export function WorkflowPipeline({ steps }: { steps: WorkflowPipelineStep[] }) {
  return (
    <div className="ui-workflow-pipeline">
      <div className="ui-workflow-pipeline__track" aria-hidden>
        <span className="ui-workflow-pipeline__flow" />
      </div>
      <ol className="ui-workflow-pipeline__steps">
        {steps.map((item, index) => (
          <li key={item.step} className="ui-workflow-pipeline__item">
            <button
              type="button"
              onClick={item.onClick}
              className={`ui-workflow-step ui-workflow-step--${item.tone} ui-hover-lift`}
              style={{ ["--step-delay" as string]: `${120 + index * 90}ms` }}
            >
              <span className={`ui-workflow-step__badge ui-workflow-step__badge--${item.tone}`}>{item.step}</span>
              <span className="ui-workflow-step__icon">{item.icon}</span>
              <span className="ui-workflow-step__title">{item.title}</span>
              <span className="ui-workflow-step__hint">{item.hint}</span>
              <span className="ui-workflow-step__tags">
                {item.tags.map((tag) => (
                  <span key={tag} className="ui-workflow-step__tag">{tag}</span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function QuickActionTile({
  title, hint, icon, onClick, tone = "neutral",
}: {
  title: string; hint: string; icon: ReactNode; onClick: () => void; tone?: "neutral" | "primary" | "accent";
}) {
  const toneClass = tone === "accent" ? "ui-quick-tile--accent" : tone === "primary" ? "ui-quick-tile--primary" : "";
  return (
    <button type="button" onClick={onClick} className={`ui-quick-tile ui-hover-lift ${toneClass}`}>
      <span className="ui-quick-tile__icon">{icon}</span>
      <span className="ui-quick-tile__title">{title}</span>
      <span className="ui-quick-tile__hint">{hint}</span>
    </button>
  );
}

export function InsightTile({ title, stat, description }: { title: string; stat?: string; description: string }) {
  return (
    <div className="ui-insight-card">
      {stat && <p className="ui-insight-stat">{stat}</p>}
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-sm opacity-80">{description}</p>
    </div>
  );
}

export function WorkflowFeatureCard({
  step, title, description, tone, icon,
}: {
  step: string; title: string; description: string; tone: "blue" | "lime" | "yellow"; icon: ReactNode;
}) {
  const ribbonClass = tone === "lime" ? "ui-feature-card__ribbon--lime" : tone === "yellow" ? "ui-feature-card__ribbon--yellow" : "ui-feature-card__ribbon--blue";
  return (
    <article className="ui-feature-card ui-hover-lift">
      <div className={`ui-feature-card__ribbon ${ribbonClass}`}>{step}</div>
      <div className="mb-3 text-[color:var(--blue-bright)]">{icon}</div>
      <h3 className="ui-heading-card">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">{description}</p>
    </article>
  );
}

export function WorkspaceDarkPreview() {
  return (
    <div className="ui-workspace-preview">
      <div className="ui-workspace-preview__chrome">
        <span className="ui-workspace-preview__dot" />
        <span className="ui-workspace-preview__dot" />
        <span className="ui-workspace-preview__dot" />
        <span className="ml-2 text-xs font-semibold text-white/70">TherNest · рабочее пространство</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[11rem,minmax(0,1fr),12rem]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold text-white/70">Инструменты</p>
          <div className="mt-3 grid gap-2">
            {["Стена", "Помещение", "Окно"].map((tool) => (
              <div key={tool} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">{tool}</div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#10233f] p-3">
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/10 p-1">
            <span className="rounded-full bg-[color:var(--lime-bright)] px-3 py-1 text-[11px] font-bold text-[color:var(--navy-deep)]">2D-чертёж</span>
            <span className="px-3 py-1 text-[11px] font-semibold text-white/65">3D-модель</span>
          </div>
          <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-white/15 bg-[#0d1c33]">
            <IconModel size={32} className="text-[color:var(--blue-bright)]" />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold text-white/70">Свойства</p>
          <dl className="mt-3 space-y-2 text-xs text-white/75">
            <div className="flex justify-between gap-2"><dt>Материал</dt><dd className="font-semibold text-white">Кирпич</dd></div>
            <div className="flex justify-between gap-2"><dt>R</dt><dd className="font-semibold text-white">3,24</dd></div>
            <div className="flex items-center justify-end gap-1 text-[color:var(--lime-bright)]">
              <IconThermometer size={14} /><span className="font-semibold">21 °C</span>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">Расчёт</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">Отчёты</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
          <IconWind size={12} />Теплопотери
        </span>
      </div>
    </div>
  );
}

export function DocumentPreviewStack() {
  const docs = ["Энергетический паспорт", "Расчёт тепловой защиты", "Инженерное заключение"];
  return (
    <div className="space-y-3">
      {docs.map((title, index) => (
        <div
          key={title}
          className="rounded-[28px] border border-[color:var(--border-soft)] bg-white px-5 py-4 shadow-[0_20px_50px_-32px_rgba(8,17,31,0.35)]"
          style={{ transform: `translateX(${index * 6}px)` }}
        >
          <p className="text-sm font-semibold text-[color:var(--text-muted)]">Документ {index + 1}</p>
          <p className="mt-1 text-lg font-bold text-[color:var(--text-base)]">{title}</p>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">Готов к экспорту после расчёта.</p>
        </div>
      ))}
    </div>
  );
}
