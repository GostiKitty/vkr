import React, { useMemo } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { formatNumber } from "../../shared/utils/format";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { assumptions, formulaModules, groupedFormulas, } from "../../entities/formulas/registry";
const moduleDescriptions = {
    Geometry: "Формулы расчёта площади, периметра и объёма используются в Build Mode и Twin конвертации.",
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
    const assumptionMap = useMemo(() => Object.fromEntries(assumptions.map((item) => [item.id, item])), []);
    const selectedSpace = useMemo(() => {
        if (!twin || !selectedSpaceId) {
            return null;
        }
        return twin.spaces?.find((space) => space.id === selectedSpaceId) ?? null;
    }, [twin, selectedSpaceId]);
    const currentFrame = frames[timeIndex] ?? null;
    const uncertaintyConfig = useWorkflowStore((state) => state.uncertaintyConfig);
    const valueContext = useMemo(() => ({
        selectedSpace,
        frame: currentFrame,
        frames,
        assumptionMap,
        uncertaintyConfig,
    }), [assumptionMap, currentFrame, frames, selectedSpace, uncertaintyConfig]);
    return (<section className="space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Теория</p>
        <h1 className="text-3xl font-semibold text-slate-900">Формулы и допущения</h1>
        <p className="text-sm text-slate-600">
          Цифровой двойник прозрачен: каждая кнопка и каждая метрика в Studio опирается на проверяемые формулы. Ниже —
          полный справочник с переменными и предположениями.
        </p>
      </header>

      {formulaModules.map((module) => (<FormulaGroup key={module} module={module} formulas={groupedFormulas[module]} context={valueContext}/>))}

      <AssumptionsPanel items={assumptions}/>
    </section>);
}
const FormulaGroup = ({ module, formulas, context, }) => {
    if (!formulas.length) {
        return null;
    }
    return (<section className="space-y-3 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm" id={`module-${module}`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-slate-900">{module}</h2>
        <p className="text-sm text-slate-500">{moduleDescriptions[module] ?? ""}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {formulas.map((formula) => (<FormulaCard key={formula.id} formula={formula} context={context}/>))}
      </div>
    </section>);
};
const FormulaCard = ({ formula, context }) => {
    const resolvedVariables = formula.variables.map((variable) => ({
        variable,
        data: resolveVariableValue(formula.id, variable, context),
    }));
    const [copied, setCopied] = React.useState(null);
    const copy = async (mode) => {
        const payload = mode === "latex" ? formula.latex : buildPlainText(formula);
        try {
            await navigator.clipboard.writeText(payload);
            setCopied(mode);
            window.setTimeout(() => setCopied(null), 1200);
        }
        catch {
            setCopied(null);
        }
    };
    return (<article id={`formula-${formula.id}`} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{formula.id}</p>
        <h3 className="text-lg font-semibold text-slate-900">{formula.title}</h3>
        <p className="text-sm text-slate-600">{formula.description}</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <BlockMath math={formula.latex}/>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("latex")} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400">
          {copied === "latex" ? "Скопировано" : "Скопировать LaTeX"}
        </button>
        <button type="button" onClick={() => copy("text")} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400">
          {copied === "text" ? "Готово" : "Скопировать текст"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white/60">
        <table className="w-full text-sm text-slate-600">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-left font-semibold">Переменная</th>
              <th className="px-3 py-2 text-left font-semibold">Описание</th>
              <th className="px-3 py-2 text-left font-semibold">Значение</th>
              <th className="px-3 py-2 text-left font-semibold">Ед.</th>
              <th className="px-3 py-2 text-left font-semibold">Источник</th>
            </tr>
          </thead>
          <tbody>
            {resolvedVariables.map(({ variable, data }) => (<tr key={`${formula.id}-${variable.key}`} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {variable.symbolLatex ? <InlineMath math={variable.symbolLatex}/> : variable.key}
                </td>
                <td className="px-3 py-2">{variable.label}</td>
                <td className="px-3 py-2">
                  {data.value}
                  {data.reason && <p className="text-xs text-slate-500">{data.reason}</p>}
                </td>
                <td className="px-3 py-2">{variable.unit ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{variable.source ?? "—"}</td>
              </tr>))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white/70 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Подставленные значения</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {resolvedVariables.map(({ variable, data }) => (<li key={`resolved-${formula.id}-${variable.key}`} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-slate-900">
                  {variable.symbolLatex ? <InlineMath math={variable.symbolLatex}/> : variable.key}
                </span>
                <span>{data.value}</span>
              </div>
              {data.reason && <span className="text-xs text-slate-500">{data.reason}</span>}
            </li>))}
        </ul>
      </div>
    </article>);
};
const AssumptionsPanel = ({ items }) => (<section id="assumptions" className="space-y-3 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm">
    <div>
      <h2 className="text-2xl font-semibold text-slate-900">Допущения и константы</h2>
      <p className="text-sm text-slate-600">
        Значения используются по умолчанию для расчётов инфильтрации, сетпоинтов, контактных коэффициентов и тепловой массы. Изменение этих параметров влияет на все формулы RC-модели.
      </p>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/70">
      <table className="w-full text-left text-sm text-slate-600">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2 font-semibold">Параметр</th>
            <th className="px-4 py-2 font-semibold">Значение</th>
            <th className="px-4 py-2 font-semibold">Описание</th>
            <th className="px-4 py-2 font-semibold">Источник</th>
          </tr>
        </thead>
        <tbody>
          {items.map((assumption) => (<tr key={assumption.id} className="border-t border-slate-100">
              <td className="px-4 py-2 font-semibold text-slate-900">{assumption.label}</td>
              <td className="px-4 py-2">
                {assumption.value} {assumption.unit}
              </td>
              <td className="px-4 py-2">{assumption.description}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{assumption.source}</td>
            </tr>))}
        </tbody>
      </table>
    </div>
  </section>);
const buildPlainText = (formula) => {
    const variables = formula.variables
        .map((variable) => `${variable.symbolLatex ?? variable.key}: ${variable.label} (${variable.unit ?? "—"})`)
        .join("\n");
    return `${formula.title}\n${formula.latex}\n${variables}`;
};
const AIR_DENSITY = 1.204; // kg/m3
const AIR_HEAT_CAPACITY = 1005; // J/(kgK)
const DEFAULT_HEIGHT = 3;
const formatWithUnit = (value, unit, digits = 2) => {
    const formatted = formatNumber(value, { maximumFractionDigits: digits });
    return unit ? `${formatted} ${unit}` : formatted;
};
const formatPowerSI = (valueW) => {
    const base = `${formatNumber(valueW, { maximumFractionDigits: 0 })} Вт`;
    if (Math.abs(valueW) >= 1000) {
        const kW = valueW / 1000;
        return `${base} (${formatNumber(kW, { maximumFractionDigits: 2 })} кВт)`;
    }
    return base;
};
const numberFromAssumption = (map, id) => {
    const entry = map[id];
    if (!entry) {
        return null;
    }
    const normalized = entry.value.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};
function resolveVariableValue(formulaId, variable, context) {
    const { selectedSpace, frame, frames, assumptionMap, uncertaintyConfig } = context;
    const area = selectedSpace?.area_m2 ?? null;
    const volume = selectedSpace?.volume_m3 ?? null;
    const height = area && volume ? volume / area : DEFAULT_HEIGHT;
    const indoorTemp = frame && selectedSpace ? frame.rooms[selectedSpace.id]?.temperatureC ?? null : null;
    const outdoorTemp = frame?.outdoorTemperatureC ?? null;
    const missing = (message) => ({ value: "—", reason: message });
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
                if (!frames.length) {
                    return missing("нет таймлайна расчёта");
                }
                const peak = frames.reduce((max, frameEntry) => {
                    const total = Object.values(frameEntry.rooms).reduce((sum, room) => sum + room.heatingPowerW, 0);
                    return Math.max(max, total);
                }, 0);
                return { value: formatPowerSI(peak) };
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
