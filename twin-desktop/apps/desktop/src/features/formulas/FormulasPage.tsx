import React, { useMemo } from "react";
import { BlockMath, InlineMath } from "react-katex";
import type { Space } from "../../shared/api/types";
import { formatNumber } from "../../shared/utils/format";
import { useTwinStore } from "../../entities/twin/twin.store";
import type { SimulationFrame } from "../../entities/twin/types";
import { useWorkflowStore, type UncertaintyConfig } from "../../entities/workflow/workflow.store";
import {
  assumptions,
  formulaModules,
  groupedFormulas,
  type Formula,
  type Assumption,
  type FormulaVariable,
} from "../../entities/formulas/registry";

interface FormulaValueContext {
  selectedSpace: Space | null;
  frame: SimulationFrame | null;
  frames: SimulationFrame[];
  assumptionMap: Record<string, Assumption>;
  uncertaintyConfig: UncertaintyConfig | null;
}

interface ResolvedVariableValue {
  value: string;
  reason?: string;
}

const moduleDescriptions: Record<string, string> = {
  Geometry: "Формулы площади, периметра и объёма используются в конструкторе и при конвертации в студию.",
  Envelope: "Классические уравнения теплопередачи для стен, окон и инфильтрации.",
  Thermal: "Сердце RC-модели, определяющей динамику температур и нагрузок.",
  Uncertainty: "Математический аппарат Монте-Карло и статистических оценок.",
  Calibration: "Метрики качества и ошибка между наблюдениями и симуляцией.",
};

export default function FormulasPage() {
  const twin = useTwinStore((state) => state.twin);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const frames = useTwinStore((state) => state.simulationFrames);
  const timeIndex = useTwinStore((state) => state.timeIndex);
  const assumptionMap = useMemo(
    () => Object.fromEntries(assumptions.map((item) => [item.id, item])),
    []
  );
  const selectedSpace = useMemo(() => {
    if (!twin || !selectedSpaceId) {
      return null;
    }
    return twin.spaces?.find((space) => space.id === selectedSpaceId) ?? null;
  }, [twin, selectedSpaceId]);
  const currentFrame = frames[timeIndex] ?? null;
  const uncertaintyConfig = useWorkflowStore((state) => state.uncertaintyConfig);

  const valueContext = useMemo<FormulaValueContext>(
    () => ({
      selectedSpace,
      frame: currentFrame,
      frames,
      assumptionMap,
      uncertaintyConfig,
    }),
    [assumptionMap, currentFrame, frames, selectedSpace, uncertaintyConfig]
  );

  return (
    <section className="mx-auto max-w-[min(100%,96rem)] space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="ui-kicker">Теория</p>
        <h1 className="text-3xl font-semibold text-[color:var(--text-base)]">Формулы и допущения</h1>
        <p className="text-sm text-[color:var(--text-muted)]">
          Цифровой двойник прозрачен: ключевые метрики студии опираются на формулу с физическим смыслом, областью применимости, единицами и допущениями.
        </p>
      </header>

      {formulaModules.map((module) => (
        <FormulaGroup key={module} module={module} formulas={groupedFormulas[module]} context={valueContext} />
      ))}

      <AssumptionsPanel items={assumptions} />
    </section>
  );
}

const FormulaGroup = ({
  module,
  formulas,
  context,
}: {
  module: string;
  formulas: Formula[];
  context: FormulaValueContext;
}) => {
  if (!formulas.length) {
    return null;
  }
  return (
    <section className="ui-panel space-y-3 p-5 sm:p-6" id={`module-${module}`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-[color:var(--text-base)]">{module}</h2>
        <p className="text-sm text-[color:var(--text-soft)]">{moduleDescriptions[module] ?? ""}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {formulas.map((formula) => (
          <FormulaCard key={formula.id} formula={formula} context={context} />
        ))}
      </div>
    </section>
  );
};

const FormulaCard = ({ formula, context }: { formula: Formula; context: FormulaValueContext }) => {
  const resolvedVariables = formula.variables.map((variable) => ({
    variable,
    data: resolveVariableValue(formula.id, variable, context),
  }));

  const [copied, setCopied] = React.useState<"latex" | "text" | null>(null);
  const copy = async (mode: "latex" | "text") => {
    const payload = mode === "latex" ? formula.latex : buildPlainText(formula);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(mode);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  };

  return (
    <article id={`formula-${formula.id}`} className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">{formula.id}</p>
        <h3 className="text-lg font-semibold text-[color:var(--text-base)]">{formula.title}</h3>
        <p className="text-sm text-[color:var(--text-muted)]">{formula.description}</p>
        <p className="mt-1 text-xs text-[color:var(--text-soft)]">
          <span className="font-semibold text-[color:var(--text-muted)]">Метод:</span> {formula.methodName}
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3">
        <BlockMath math={formula.latex} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy("latex")}
          className="ui-control rounded-full px-3 py-1 text-xs font-semibold hover:border-[color:var(--accent-base)]/35"
        >
          {copied === "latex" ? "Скопировано" : "Скопировать LaTeX"}
        </button>
        <button
          type="button"
          onClick={() => copy("text")}
          className="ui-control rounded-full px-3 py-1 text-xs font-semibold hover:border-[color:var(--accent-base)]/35"
        >
          {copied === "text" ? "Готово" : "Скопировать текст"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]">
        <table className="w-full text-sm text-[color:var(--text-muted)]">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
              <th className="px-3 py-2 text-left font-semibold">Переменная</th>
              <th className="px-3 py-2 text-left font-semibold">Описание</th>
              <th className="px-3 py-2 text-left font-semibold">Значение</th>
              <th className="px-3 py-2 text-left font-semibold">Ед.</th>
              <th className="px-3 py-2 text-left font-semibold">Источник</th>
            </tr>
          </thead>
          <tbody>
            {resolvedVariables.map(({ variable, data }) => (
              <tr key={`${formula.id}-${variable.key}`} className="border-t border-[color:var(--border-soft)]">
                <td className="px-3 py-2 font-semibold text-[color:var(--text-base)]">
                  {variable.symbolLatex ? <InlineMath math={variable.symbolLatex} /> : variable.key}
                </td>
                <td className="px-3 py-2">{variable.label}</td>
                <td className="px-3 py-2">
                  {data.value}
                  {data.reason && <p className="text-xs text-[color:var(--text-soft)]">{data.reason}</p>}
                </td>
                <td className="px-3 py-2">{variable.unit ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-[color:var(--text-soft)]">{variable.source ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Подставленные значения</p>
        <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-muted)]">
          {resolvedVariables.map(({ variable, data }) => (
            <li key={`resolved-${formula.id}-${variable.key}`} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-[color:var(--text-base)]">
                  {variable.symbolLatex ? <InlineMath math={variable.symbolLatex} /> : variable.key}
                </span>
                <span>{data.value}</span>
              </div>
              {data.reason && <span className="text-xs text-[color:var(--text-soft)]">{data.reason}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Физический смысл</p>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">{formula.physicalMeaning}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Что означает результат</p>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">{formula.resultMeaning}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Область применимости</p>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">{formula.applicability}</p>
      </div>

      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Допущения</p>
        <ul className="mt-2 space-y-1 text-sm text-[color:var(--text-muted)]">
          {formula.assumptions.map((assumption) => (
            <li key={`${formula.id}-${assumption}`}>{assumption}</li>
          ))}
        </ul>
      </div>
    </article>
  );
};

const AssumptionsPanel = ({ items }: { items: Assumption[] }) => (
  <section id="assumptions" className="ui-panel space-y-3 p-5 sm:p-6">
    <div>
      <h2 className="text-2xl font-semibold text-[color:var(--text-base)]">Допущения и константы</h2>
      <p className="text-sm text-[color:var(--text-muted)]">
        Значения используются по умолчанию для расчётов инфильтрации, сетпоинтов, контактных коэффициентов и тепловой массы. Изменение этих параметров влияет на все формулы RC-модели.
      </p>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]">
      <table className="w-full text-left text-sm text-[color:var(--text-muted)]">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">
            <th className="px-4 py-2 font-semibold">Параметр</th>
            <th className="px-4 py-2 font-semibold">Значение</th>
            <th className="px-4 py-2 font-semibold">Описание</th>
            <th className="px-4 py-2 font-semibold">Источник</th>
          </tr>
        </thead>
        <tbody>
          {items.map((assumption) => (
            <tr key={assumption.id} className="border-t border-[color:var(--border-soft)]">
              <td className="px-4 py-2 font-semibold text-[color:var(--text-base)]">{assumption.label}</td>
              <td className="px-4 py-2">
                {assumption.value} {assumption.unit}
              </td>
              <td className="px-4 py-2">{assumption.description}</td>
              <td className="px-4 py-2 text-xs text-[color:var(--text-soft)]">{assumption.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const buildPlainText = (formula: Formula): string => {
  const variables = formula.variables
    .map((variable) => `${variable.symbolLatex ?? variable.key}: ${variable.label} (${variable.unit ?? "—"})`)
    .join("\n");
  const assumptionsText = formula.assumptions.map((item) => `- ${item}`).join("\n");
  return [
    formula.title,
    `Метод: ${formula.methodName}`,
    formula.latex,
    variables,
    `Применимость: ${formula.applicability}`,
    `Физический смысл: ${formula.physicalMeaning}`,
    `Что означает результат: ${formula.resultMeaning}`,
    "Допущения:",
    assumptionsText,
  ].join("\n");
};

const AIR_DENSITY = 1.204; // kg/m3
const AIR_HEAT_CAPACITY = 1005; // J/(kgK)
const DEFAULT_HEIGHT = 3;

const formatWithUnit = (value: number, unit?: string, digits = 2): string => {
  const formatted = formatNumber(value, { maximumFractionDigits: digits });
  return unit ? `${formatted} ${unit}` : formatted;
};

const numberFromAssumption = (map: Record<string, Assumption>, id: string): number | null => {
  const entry = map[id];
  if (!entry) {
    return null;
  }
  const normalized = entry.value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

function resolveVariableValue(
  formulaId: string,
  variable: FormulaVariable,
  context: FormulaValueContext
): ResolvedVariableValue {
  const { selectedSpace, frame, frames, assumptionMap, uncertaintyConfig } = context;
  const area = selectedSpace?.area_m2 ?? null;
  const volume = selectedSpace?.volume_m3 ?? null;
  const height = area && volume ? volume / area : DEFAULT_HEIGHT;
  const indoorTemp = frame && selectedSpace ? frame.temperatures[selectedSpace.id] ?? null : null;
  const outdoorTemp = null;

  const missing = (message: string): ResolvedVariableValue => ({ value: "—", reason: message });

  switch (formulaId) {
    case "geom_polygon_area":
      if (variable.key === "area") {
        return area != null ? { value: formatWithUnit(area, "м²", 2) } : missing("нет выбранного помещения");
      }
      if (variable.key === "vertex_coords") {
        return selectedSpace ? { value: "используются вершины наброска" } : missing("нет данных контура");
      }
      if (variable.key === "vertex_count") {
        return selectedSpace ? { value: "n", reason: "число вершин берётся из контура" } : missing("контур не создан");
      }
      break;
    case "geom_volume":
      if (variable.key === "volume") {
        return volume != null ? { value: formatWithUnit(volume, "м³", 2) } : missing("у помещения нет сохранённого объёма");
      }
      if (variable.key === "area") {
        return area != null ? { value: formatWithUnit(area, "м²", 2) } : missing("нет площади помещения");
      }
      if (variable.key === "level_height") {
        return { value: formatWithUnit(height, "м", 2), reason: "используется высота уровня или значение по умолчанию" };
      }
      break;
    case "envelope_heat_loss":
      if (variable.key === "u_value") {
        return missing("выберите сборку стены в инспекторе");
      }
      if (variable.key === "area") {
        return area != null ? { value: formatWithUnit(area, "м²", 2) } : missing("нет выбранной стены");
      }
      if (variable.key === "t_in") {
        const fallback = numberFromAssumption(assumptionMap, "comfort_setpoint_day") ?? 21;
        const source = indoorTemp == null ? "используется сетпоинт по умолчанию" : undefined;
        return { value: `${formatNumber(indoorTemp ?? fallback, { maximumFractionDigits: 1 })} °C`, reason: source };
      }
      if (variable.key === "t_out") {
        return outdoorTemp != null ? { value: `${formatNumber(outdoorTemp, { maximumFractionDigits: 1 })} °C` } : missing("нет погодного профиля");
      }
      break;
    case "envelope_infiltration":
      if (variable.key === "rho_air") {
        const value = numberFromAssumption(assumptionMap, "air_density");
        return value != null ? { value: formatWithUnit(value, "кг/м³", 2) } : missing("нет допущения air_density");
      }
      if (variable.key === "cp_air") {
        const valueJ = numberFromAssumption(assumptionMap, "air_cp");
        if (valueJ == null) {
          return missing("нет допущения air_cp");
        }
        return {
          value: formatWithUnit(valueJ / 1000, "кДж/(кг·К)", 3),
          reason: "переведено из Дж/(кг·К) в кДж/(кг·К)",
        };
      }
      if (variable.key === "v_dot_inf") {
        return missing("не задан расход инфильтрации");
      }
      if (variable.key === "delta_t") {
        if (indoorTemp == null || outdoorTemp == null) {
          return missing("нужны температуры помещения и улицы");
        }
        return { value: formatWithUnit(indoorTemp - outdoorTemp, "К", 1) };
      }
      break;
    case "thermal_balance":
    case "thermal_balance_room":
      if (variable.key === "c_node") {
        if (area == null) {
          return missing("нет площади помещения");
        }
        const volumeEstimate = area * (height || DEFAULT_HEIGHT);
        const capacityKJ = (AIR_DENSITY * volumeEstimate * AIR_HEAT_CAPACITY) / 1000;
        return { value: formatWithUnit(capacityKJ, "кДж/К", 1), reason: "оценка по воздуху в помещении" };
      }
      if (variable.key === "u_ij" || variable.key === "a_ij") {
        return missing("рассчитывается после построения стен и смежностей");
      }
      if (variable.key === "q_inf" || variable.key === "q_int" || variable.key === "q_hvac") {
        return missing("зависит от сценариев и решателя");
      }
      break;
    case "thermal_peak_load":
      if (variable.key === "q_peak") {
        return missing("пиковая нагрузка доступна после детального расчёта HVAC");
      }
      if (variable.key === "q_hvac_time") {
        return frames.length
          ? { value: "см. график тепловой нагрузки", reason: "используйте результаты расчёта" }
          : missing("нет данных решателя");
      }
      break;
    case "uncertainty_mc":
      if (variable.key === "samples") {
        return uncertaintyConfig
          ? { value: String(uncertaintyConfig.runs) }
          : missing("не выбрано количество прогонов");
      }
      if (variable.key === "sample_value") {
        return missing("определяется в каждом прогоне Monte Carlo");
      }
      break;
    case "uncertainty_std":
      if (variable.key === "mu_hat") {
        return missing("вычисляется после завершения Монте-Карло");
      }
      if (variable.key === "sample_value") {
        return missing("каждый прогон даёт своё значение");
      }
      if (variable.key === "samples") {
        return uncertaintyConfig
          ? { value: String(uncertaintyConfig.runs) }
          : missing("не задано количество прогонов");
      }
      break;
    case "calibration_rmse":
    case "calibration_mape":
      if (variable.key === "observations") {
        return { value: "12", reason: "введите 12 значений энергии" };
      }
      if (variable.key === "energy_obs") {
        return missing("заполните фактические данные");
      }
      if (variable.key === "energy_sim") {
        return missing("зависит от результатов расчёта");
      }
      break;
    default:
      break;
  }
  return { value: "—" };
}
