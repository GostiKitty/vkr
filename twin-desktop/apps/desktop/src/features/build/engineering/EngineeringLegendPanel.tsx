import { renderEngineeringSymbol } from "./EngineeringSymbols";
import type { EngineeringSchematicStyle } from "./viewMode";

const LEGEND_ITEMS = [
  { key: "radiator", label: "Радиатор", kind: "radiator" as const },
  { key: "boiler", label: "Котёл / теплогенератор", kind: "boiler" as const },
  { key: "pump", label: "Насос", kind: "pump" as const },
  { key: "heat_exchanger", label: "Теплообменник", kind: "heat_exchanger" as const },
  { key: "collector", label: "Коллектор", kind: "collector" as const },
  { key: "shutoff_valve", label: "Запорный клапан", kind: "shutoff_valve" as const },
  { key: "control_valve", label: "Регулирующий клапан", kind: "control_valve" as const },
  { key: "dirt_separator", label: "Фильтр / грязевик", kind: "dirt_separator" as const },
  { key: "temperature_sensor", label: "Датчик температуры", kind: "temperature_sensor" as const },
  { key: "pressure_sensor", label: "Датчик давления", kind: "pressure_sensor" as const },
  { key: "heat_meter", label: "Счётчик тепла", kind: "heat_meter" as const },
  { key: "mixing_node", label: "Узел смешения", kind: "mixing_node" as const },
];

interface EngineeringLegendPanelProps {
  styleMode: EngineeringSchematicStyle;
  compact?: boolean;
}

function networkColor(monochrome: boolean, role: "supply" | "return" | "mono"): string {
  if (monochrome) {
    return "var(--network-monochrome)";
  }
  return role === "supply" ? "var(--network-supply)" : "var(--network-return)";
}

export default function EngineeringLegendPanel({
  styleMode,
  compact = false,
}: EngineeringLegendPanelProps) {
  const monochrome = styleMode === "monochrome";
  const supply = networkColor(monochrome, "supply");
  const returnColor = networkColor(monochrome, "return");
  const mono = networkColor(true, "mono");

  return (
    <section className="ui-panel p-4 sm:p-5">
      <div className="mb-3">
        <p className="ui-build-section-title">Условные обозначения</p>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          Инженерная схема оборудования и трубопроводов для тепловых пунктов и отопительных контуров.
        </p>
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"}`}>
        {LEGEND_ITEMS.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2"
          >
            <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" className="shrink-0">
              {renderEngineeringSymbol(item.kind, 17, 13, { monochrome })}
            </svg>
            <span className="min-w-0 text-sm font-medium text-[color:var(--text-base)]">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
          <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" className="shrink-0">
            <line x1="4" y1="9" x2="30" y2="9" stroke={supply} strokeWidth="2.1" strokeLinecap="round" />
            <line x1="12" y1="9" x2="18" y2="9" stroke={supply} strokeWidth="1.6" />
            <path d="M 18 9 L 15 7 L 15 11 Z" fill={supply} />
          </svg>
          <span className="text-sm font-medium text-[color:var(--text-base)]">Подающий трубопровод</span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
          <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" className="shrink-0">
            <line
              x1="4"
              y1="17"
              x2="30"
              y2="17"
              stroke={returnColor}
              strokeWidth="2.1"
              strokeDasharray={monochrome ? "6 3" : undefined}
              strokeLinecap="round"
            />
            <line x1="22" y1="17" x2="16" y2="17" stroke={returnColor} strokeWidth="1.6" />
            <path d="M 16 17 L 19 15 L 19 19 Z" fill={returnColor} />
          </svg>
          <span className="text-sm font-medium text-[color:var(--text-base)]">Обратный трубопровод</span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
          <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" className="shrink-0">
            <path
              d="M 8 13 H 20 M 17 10 L 20 13 L 17 16"
              fill="none"
              stroke={monochrome ? mono : "#0f766e"}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm font-medium text-[color:var(--text-base)]">Направление потока</span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
          <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" className="shrink-0">
            <circle cx="17" cy="13" r="7" fill="none" stroke={monochrome ? mono : "#ea580c"} strokeWidth="1.8" />
            <text x="17" y="16.5" textAnchor="middle" fontSize="11" fontWeight="700" fill={monochrome ? mono : "#ea580c"}>
              !
            </text>
          </svg>
          <span className="text-sm font-medium text-[color:var(--text-base)]">Предупреждение / диагностика</span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2">
          <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" className="shrink-0">
            <line x1="6" y1="13" x2="14" y2="13" stroke={monochrome ? mono : "#94a3b8"} strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="13" x2="28" y2="13" stroke={monochrome ? mono : "#94a3b8"} strokeWidth="2" strokeLinecap="round" />
            <circle cx="17" cy="13" r="2.2" fill={monochrome ? mono : "#f43f5e"} />
          </svg>
          <span className="text-sm font-medium text-[color:var(--text-base)]">Разрыв сети</span>
        </div>
      </div>
    </section>
  );
}

