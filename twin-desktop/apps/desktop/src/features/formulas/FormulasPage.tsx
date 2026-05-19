import React, { useMemo } from "react";
import { BlockMath, InlineMath } from "react-katex";
import type { Space } from "../../shared/api/types";
import { formatNumber } from "../../shared/utils/format";
import { useTwinStore } from "../../entities/twin/twin.store";
import type { SimulationFrame } from "../../entities/twin/types";
import { useWorkflowStore, type UncertaintyConfig } from "../../entities/workflow/workflow.store";
import {
  assumptions,
  formulaRegistry,
  type Formula,
  type Assumption,
  type FormulaVariable,
} from "../../entities/formulas/registry";
import type { ScenarioConfig } from "../../entities/workflow/workflow.store";

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

type FormulaUsageStatus =
  | "используется в RC-модели"
  | "используется в инженерном балансе"
  | "используется в инженерной оценке оборудования"
  | "используется в hydronic mode"
  | "используется в проверке СП 50"
  | "используется в 1D transient"
  | "используется только в legacy path"
  | "справочная / пока не участвует в основном расчёте";

interface FormulaTopic {
  id: string;
  title: string;
  description: string;
  formulaIds: string[];
}

const formulaTopics: FormulaTopic[] = [
  {
    id: "envelope",
    title: "Теплопередача через ограждения",
    description: "R, U и тепловой поток через стены, окна, двери и многослойные конструкции.",
    formulaIds: ["layer_resistance", "total_resistance", "envelope_heat_loss", "transmission_loss"],
  },
  {
    id: "transient",
    title: "Нестационарный тепловой режим",
    description: "RC-баланс зоны, эффективная теплоёмкость и дискретный шаг температуры.",
    formulaIds: ["geom_volume", "thermal_balance", "thermal_balance_room", "rc_lumped"],
  },
  {
    id: "ventilation",
    title: "Вентиляция и инфильтрация",
    description: "ACH, расход воздуха и чувствительные теплопотери на приток наружного воздуха.",
    formulaIds: ["envelope_infiltration", "ventilation_loss"],
  },
  {
    id: "gains",
    title: "Внутренние теплопоступления",
    description: "Люди, оборудование, освещение и расписания эксплуатации как входы RC-модели.",
    formulaIds: ["internal_gains", "thermal_balance"],
  },
  {
    id: "heating",
    title: "Отопительное оборудование",
    description: "Идеализированная мощность отопления и связь оборудования с балансом помещения.",
    formulaIds: ["thermal_peak_load", "thermal_balance", "radiator_heat_output", "coolant_flow_rate"],
  },
  {
    id: "climate",
    title: "Климатический сценарий",
    description: "Синусоидальный профиль наружной температуры и период моделирования.",
    formulaIds: ["weather_sinusoid", "rc_lumped"],
  },
  {
    id: "uncertainty",
    title: "Вероятностный анализ / Monte Carlo",
    description: "Распределения входов, число испытаний, перцентили и риск превышения.",
    formulaIds: ["uncertainty_mc", "uncertainty_std"],
  },
  {
    id: "metrics",
    title: "Энергетические показатели",
    description: "Суммарная энергия, пиковая нагрузка, средние и перцентильные значения.",
    formulaIds: ["thermal_peak_load", "calibration_rmse", "calibration_mape"],
  },
];

const calculationContours = [
  {
    id: "rc",
    title: "RC-модель помещения",
    description:
      "Основной зональный расчёт во времени: температура по зонам, идеальный догрев до уставки, KPI, графики и основной Monte Carlo поверх RC.",
  },
  {
    id: "engineering",
    title: "Инженерный квазистационарный баланс",
    description:
      "Разложение потерь через ограждения, вентиляцию и инфильтрацию, инженерные диагностики и интерпретация тепловой нагрузки.",
  },
  {
    id: "sp50",
    title: "Проверка по СП 50",
    description:
      "Отдельный нормативный контур для сопротивления теплопередаче и отчетности по СП 50. Не смешивается с RC-результатами.",
  },
  {
    id: "transient1d",
    title: "1D transient расчёт конструкции",
    description:
      "Отдельный нестационарный расчёт по слоям конструкции. Базовые свойства слоёв связаны с этой страницей, но контур считается отдельно.",
  },
  {
    id: "legacy",
    title: "Legacy report / legacy Monte Carlo path",
    description:
      "Устаревший отчётный контур по данным Twin API. Нуждается в синхронизации с основным расчётом конструктора и помечается отдельно.",
  },
] as const;

const formulaStatusLegend: Array<{ status: FormulaUsageStatus; note: string }> = [
  {
    status: "используется в RC-модели",
    note: "Основной зональный расчёт во времени и его результаты.",
  },
  {
    status: "используется в инженерном балансе",
    note: "Квазистационарная инженерная интерпретация теплопотерь и нагрузок.",
  },
  {
    status: "используется в инженерной оценке оборудования",
    note: "Derived hydronic metrics и проверка доступной мощности без прямого влияния на базовый RC solver.",
  },
  {
    status: "используется в hydronic mode",
    note: "Формула участвует в отдельном режиме ограничения мощности отопления по теплоносителю.",
  },
  {
    status: "используется в проверке СП 50",
    note: "Нормативная проверка ограждающих конструкций отдельным модулем.",
  },
  {
    status: "используется в 1D transient",
    note: "Отдельный нестационарный расчёт конструкции по слоям.",
  },
  {
    status: "используется только в legacy path",
    note: "Старый отчётный или калибровочный контур, не основной расчёт конструктора.",
  },
  {
    status: "справочная / пока не участвует в основном расчёте",
    note: "Показывается как инженерная ориентирующая формула следующего этапа модели.",
  },
];

const formulaUsageStatus: Record<string, FormulaUsageStatus> = {
  layer_resistance: "используется в инженерном балансе",
  total_resistance: "используется в проверке СП 50",
  envelope_heat_loss: "используется в инженерном балансе",
  transmission_loss: "используется в инженерном балансе",
  envelope_infiltration: "используется в RC-модели",
  ventilation_loss: "используется в инженерном балансе",
  internal_gains: "используется в RC-модели",
  thermal_balance: "используется в RC-модели",
  thermal_balance_room: "используется в инженерном балансе",
  rc_lumped: "используется в RC-модели",
  weather_sinusoid: "используется в RC-модели",
  thermal_peak_load: "используется в RC-модели",
  uncertainty_mc: "используется в RC-модели",
  uncertainty_std: "используется в RC-модели",
  calibration_rmse: "используется только в legacy path",
  calibration_mape: "используется только в legacy path",
  radiator_heat_output: "используется в инженерной оценке оборудования",
  coolant_flow_rate: "используется в инженерной оценке оборудования",
};

const formulaById: Record<string, Formula> = Object.fromEntries(formulaRegistry.map((formula) => [formula.id, formula]));

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
  const scenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const setScenarioConfig = useWorkflowStore((state) => state.setScenarioConfig);

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

      <section className="ui-panel space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-[color:var(--text-base)]">Расчётные контуры проекта</h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            В приложении используются несколько расчётных контуров. Они не равнозначны и не должны смешиваться в одном выводе без пояснения.
          </p>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {calculationContours.map((contour) => (
            <article
              key={contour.id}
              className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4"
            >
              <p className="text-sm font-semibold text-[color:var(--text-base)]">{contour.title}</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">{contour.description}</p>
            </article>
          ))}
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {formulaStatusLegend.map((entry) => (
            <div
              key={entry.status}
              className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--accent-base)]">{entry.status}</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">{entry.note}</p>
            </div>
          ))}
        </div>
      </section>

      {formulaTopics.map((topic) => (
        <FormulaGroup
          key={topic.id}
          topic={topic}
          formulas={topic.formulaIds.map((id) => formulaById[id]).filter(Boolean) as Formula[]}
          context={valueContext}
        />
      ))}

      <EditableAssumptionsPanel scenarioConfig={scenarioConfig} onSave={setScenarioConfig} />
      <AssumptionsPanel items={assumptions} />
    </section>
  );
}

const FormulaGroup = ({
  topic,
  formulas,
  context,
}: {
  topic: FormulaTopic;
  formulas: Formula[];
  context: FormulaValueContext;
}) => {
  if (!formulas.length) {
    return null;
  }
  return (
    <section className="ui-panel space-y-3 p-5 sm:p-6" id={`topic-${topic.id}`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-[color:var(--text-base)]">{topic.title}</h2>
        <p className="text-sm text-[color:var(--text-soft)]">{topic.description}</p>
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
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">{formula.id}</p>
          <span className="rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent-base)]">
            {formulaUsageStatus[formula.id] ?? "справочная / пока не участвует в основном расчёте"}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-[color:var(--text-base)]">{formula.title}</h3>
        <p className="text-sm text-[color:var(--text-muted)]">{formula.description}</p>
        <p className="mt-1 text-xs text-[color:var(--text-soft)]">
          <span className="font-semibold text-[color:var(--text-muted)]">Метод:</span> {formula.methodName}
        </p>
        <p className="mt-1 text-xs text-[color:var(--text-soft)]">
          <span className="font-semibold text-[color:var(--text-muted)]">Где используется:</span> {resolveFormulaUsage(formula)}
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

const DEFAULT_SCENARIO: ScenarioConfig = {
  climate: { baseC: -2, amplitudeC: 9, seasonalOffsetC: 0 },
  setpoints: { day: 21, night: 18, dayStartHour: 6, nightStartHour: 22 },
  internalGains: { dayGain_W_m2: 5, nightGain_W_m2: 1 },
  occupancy: { dayFraction: 1, nightFraction: 0.2 },
  ventilation: { infiltrationACH: 0.5 },
};

const EditableAssumptionsPanel = ({
  scenarioConfig,
  onSave,
}: {
  scenarioConfig: ScenarioConfig | null;
  onSave: (config: ScenarioConfig) => void;
}) => {
  const initial = scenarioConfig ?? DEFAULT_SCENARIO;
  const [draft, setDraft] = React.useState<ScenarioConfig>(initial);

  React.useEffect(() => {
    setDraft(scenarioConfig ?? DEFAULT_SCENARIO);
  }, [scenarioConfig]);

  const update = (section: keyof ScenarioConfig, key: string, value: number) => {
    setDraft((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  return (
    <section id="editable-assumptions" className="ui-panel space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-2xl font-semibold text-[color:var(--text-base)]">Настройки расчётных допущений</h2>
        <p className="text-sm text-[color:var(--text-muted)]">
          Эти значения сохраняются в workflow-сценарии и используются локальным RC-расчётом и Monte Carlo через `ThermalSimulationOptions`.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <AssumptionField label="Уставка днём" unit="°C" value={draft.setpoints.day} min={10} max={30} onChange={(value) => update("setpoints", "day", value)} usage="evaluateSetpoint → solver" />
        <AssumptionField label="Уставка ночью" unit="°C" value={draft.setpoints.night} min={8} max={28} onChange={(value) => update("setpoints", "night", value)} usage="evaluateSetpoint → solver" />
        <AssumptionField label="ACH инфильтрации" unit="1/ч" value={draft.ventilation.infiltrationACH} min={0} max={5} step={0.1} onChange={(value) => update("ventilation", "infiltrationACH", value)} usage="G_inf = rho·cp·ACH·V/3600" />
        <AssumptionField label="Наружная базовая" unit="°C" value={draft.climate.baseC} min={-60} max={40} step={0.5} onChange={(value) => update("climate", "baseC", value)} usage="createSinusoidalWeatherProfile" />
        <AssumptionField label="Амплитуда улицы" unit="°C" value={draft.climate.amplitudeC} min={0} max={35} step={0.5} onChange={(value) => update("climate", "amplitudeC", value)} usage="createSinusoidalWeatherProfile" />
        <AssumptionField label="Дневные теплопоступления" unit="Вт/м²" value={draft.internalGains.dayGain_W_m2} min={0} max={50} step={0.5} onChange={(value) => update("internalGains", "dayGain_W_m2", value)} usage="evaluateInternalGains" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onSave(draft)} className="ui-btn-primary px-5 py-2 text-sm">
          Сохранить допущения
        </button>
        <button type="button" onClick={() => setDraft(DEFAULT_SCENARIO)} className="ui-btn-secondary px-5 py-2 text-sm">
          Сбросить к пресету
        </button>
      </div>
    </section>
  );
};

const AssumptionField = ({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  usage,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  usage: string;
  onChange: (value: number) => void;
}) => {
  const suspicious = value < min || value > max;
  return (
    <label className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3 text-sm">
      <span className="font-semibold text-[color:var(--text-base)]">{label}</span>
      <span className="mt-1 block text-xs text-[color:var(--text-soft)]">Используется: {usage}</span>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="ui-field w-full px-3 py-2"
        />
        <span className="w-14 text-xs text-[color:var(--text-soft)]">{unit}</span>
      </div>
      <span className="mt-1 block text-xs text-[color:var(--text-soft)]">Диапазон: {min}…{max} {unit}</span>
      {suspicious ? <span className="mt-1 block text-xs font-semibold text-[color:var(--danger-fg)]">Проверьте значение: оно вне ожидаемого диапазона.</span> : null}
    </label>
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

const resolveFormulaUsage = (formula: Formula): string => {
  const explicitUsage: Record<string, string> = {
    layer_resistance:
      "Послойный инженерный баланс ограждений; служит входом для оценки конструкций и связанных теплотехнических проверок.",
    total_resistance:
      "Проверка сопротивления теплопередаче и формирование эквивалентного U в модуле СП 50; используется и в инженерной интерпретации ограждений.",
    envelope_heat_loss:
      "Инженерный квазистационарный баланс потерь через ограждения в результатах и диагностике.",
    transmission_loss:
      "Разложение потерь через стены, окна, двери, кровлю и пол в инженерном балансе.",
    envelope_infiltration:
      "Основной RC solver через эквивалентную проводимость инфильтрации по ACH.",
    ventilation_loss:
      "Инженерный квазистационарный баланс вентиляционных и инфильтрационных потерь; не просто справочное допущение.",
    internal_gains:
      "RC-модель помещения и её сценарные входы по людям, освещению и оборудованию.",
    thermal_balance:
      "Основной RC solver и интерпретация суммарного баланса мощности по зоне.",
    thermal_balance_room:
      "Инженерный квазистационарный срез по помещению для оценки дефицита тепла.",
    rc_lumped:
      "Основной зональный RC solver, временные ряды температуры, энергии и мощности.",
    weather_sinusoid:
      "Климатический сценарий основного RC solver.",
    thermal_peak_load:
      "Пиковая нагрузка основного RC расчёта и связанный подбор требуемой мощности.",
    uncertainty_mc:
      "Панель вероятностного анализа поверх RC-модели; не норматив СП 50 и не legacy calibration report.",
    uncertainty_std:
      "Статистика разброса результатов вероятностного анализа поверх RC-модели.",
    calibration_rmse:
      "Только legacy report path и связанный калибровочный отчёт по данным Twin API.",
    calibration_mape:
      "Только legacy report path и связанный калибровочный отчёт по данным Twin API.",
    radiator_heat_output:
      "Используется в derived hydronic metrics для инженерной оценки доступной мощности оборудования; пока не управляет основным зональным отоплением.",
    coolant_flow_rate:
      "Используется в derived hydronic metrics для оценки требуемого расхода теплоносителя; прямой hydronic mode пока не включён.",
  };
  if (explicitUsage[formula.id]) {
    return explicitUsage[formula.id];
  }
  if (formula.id.includes("uncertainty")) {
    return "Monte Carlo, панель рисков, отчётные перцентили";
  }
  if (formula.id.includes("calibration")) {
    return "интерпретация калибровки и качества совпадения";
  }
  if (formula.module === "Envelope") {
    return "оболочка здания, проводимости стен, теплопотери";
  }
  if (formula.module === "Thermal") {
    return "RC-решатель, тепловой баланс, результаты расчёта";
  }
  if (formula.module === "Geometry") {
    return "геометрия помещений, объём, площадь, удельные нагрузки";
  }
  return "справочный раздел и инженерные подсказки";
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
