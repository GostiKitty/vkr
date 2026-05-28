import { useEffect, useMemo, useState } from "react";
import { navigate } from "../../app/router";
import { useProjectStore } from "../../entities/project/project.store";
import { createEmptyBuildingModel } from "../../entities/geometry/types";
import { useTwinStore } from "../../entities/twin/twin.store";
import {
  createDefaultScenarioConfig,
  resolveScenarioConfig,
  useWorkflowStore,
  type ScenarioConfig,
  type ScenarioValidationPoint,
} from "../../entities/workflow/workflow.store";
import {
  ActionBar,
  Badge,
  EmptyWorkspaceState,
  EngineeringCallout,
  SectionShell,
  WorkspacePageHeader,
} from "../../shared/ui";
import { formatNumber } from "../../shared/utils/format";
import { isCanonicalDemoProjectModel } from "../../shared/utils/demoProject";
import {
  setModelBridgeConductance,
  setModelOpeningUValues,
  setModelOpticalFactors,
} from "../../shared/utils/openingThermalData";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { useBuildStore } from "../build/build.store";
import { doesBuildModelMatchProject, hasBuildGeometry } from "../project/projectSummary";
import {
  buildSourceDataWorkspaceReport,
  type SourceDataField,
  type SourceDataOrigin,
  type SourceDataSummaryCard,
} from "../../core/thermal/derived/sourceDataWorkspace";
// `EXPERTISE_INPUT_SECTIONS` временно не используется в UI: соответствующая подсказка
// о «полном комплекте полей отчёта» скрыта вместе с разделом проектной документации
// (Temporarily hidden from UI. Will be restored after project documentation export redesign).
import {
  useExpertiseInputsStore,
} from "../reports/exports/store/expertiseInputs.store";

const NO_DATA = "нет данных";

const SECTION_TITLES = {
  geometry: "Геометрия",
  materials: "Материалы и конструкции",
  climate: "Климат",
  operation: "Эксплуатация",
  airExchange: "Воздухообмен",
  humidity: "Влажность и комфорт",
  engineeringNetworks: "Инженерные сети",
  ecology: "Экология",
  economy: "Экономика",
  validation: "Валидация",
  reports: "Данные для отчётов",
} as const;

const SECTION_NAV_ITEMS = [
  { id: "geometry", anchor: "data-section-geometry", label: SECTION_TITLES.geometry },
  { id: "materials", anchor: "data-section-materials", label: "Материалы" },
  { id: "climate", anchor: "data-section-climate", label: SECTION_TITLES.climate },
  { id: "operation", anchor: "data-section-operation", label: SECTION_TITLES.operation },
  { id: "airExchange", anchor: "data-section-air", label: SECTION_TITLES.airExchange },
  { id: "humidity", anchor: "data-section-humidity", label: SECTION_TITLES.humidity },
  { id: "engineeringNetworks", anchor: "data-section-engineering", label: SECTION_TITLES.engineeringNetworks },
  { id: "ecology", anchor: "data-section-ecology", label: SECTION_TITLES.ecology },
  { id: "economy", anchor: "data-section-economy", label: SECTION_TITLES.economy },
  { id: "validation", anchor: "data-section-validation", label: SECTION_TITLES.validation },
  { id: "reports", anchor: "data-section-reports", label: SECTION_TITLES.reports },
] as const;

const FIELD_DISPLAY_META: Record<string, { title: string; caption?: string }> = {
  "geometry.envelope-area": { title: "Площадь наружной оболочки", caption: "A_env" },
  "geometry.wwr": { title: "Доля остекления фасада", caption: "WWR = A_win / A_facade" },
  "geometry.compactness": { title: "Коэффициент компактности здания", caption: "K_compact = A_env / V_h" },
  "materials.window-u": { title: "Коэффициент теплопередачи окна", caption: "U окна" },
  "materials.door-u": { title: "Коэффициент теплопередачи двери", caption: "U двери" },
  "materials.window-g": { title: "Солнечный фактор окна", caption: "g-value" },
  "materials.shading-factor": { title: "Коэффициент затенения", caption: "Shading factor" },
  "materials.u-eq": { title: "Эквивалентный коэффициент теплопередачи Uэкв", caption: "U_eq" },
  "materials.h-tr": { title: "Коэффициент теплопотерь через ограждения Htr", caption: "H_tr" },
  "materials.h-total": { title: "Суммарный коэффициент теплопотерь", caption: "H_total" },
  "materials.q-tr": { title: "Теплопотери через ограждения при расчётной ΔT", caption: "Q_tr" },
  "materials.h-psi": { title: "Линейные мостики холода", caption: "H_psi" },
  "materials.h-chi": { title: "Точечные мостики холода", caption: "H_chi" },
  "materials.q-bridges": { title: "Потери через мостики холода", caption: "Q_thermal_bridges" },
  "operation.peak-load": { title: "Пиковая нагрузка отопления", caption: "peakLoadKW" },
  "operation.total-energy": { title: "Энергопотребление за расчётный период", caption: "totalEnergyKWh" },
  "operation.degree-hours-underheat": { title: "Градусо-часы недотопа", caption: "DH_underheat" },
  "operation.degree-hours-overheat": { title: "Градусо-часы перегрева", caption: "DH_overheat" },
  "operation.underheating-hours": { title: "Часы недотопа", caption: "underheatingHours" },
  "operation.overheating-hours": { title: "Часы перегрева", caption: "overheatingHours" },
  "operation.total-discomfort-hours": { title: "Суммарные часы дискомфорта", caption: "totalDiscomfortHours" },
  "climate.gsop": { title: "ГСОП", caption: "GSOP = (T_in - T_ot.avg) * z_ot" },
  "climate.deltaT": { title: "Расчётная разность температур", caption: "ΔT = T_in - T_out" },
  "air.infiltration-mode": { title: "Режим инфильтрации", caption: "manual / envelope / pressure" },
  "air.infiltration-source": { title: "Источник ACH", caption: "manual / calculated / fallback" },
  "air.infiltration-ach": { title: "Инфильтрация", caption: "ACH_inf" },
  "air.ventilation-ach": { title: "Механическая вентиляция", caption: "ACH_vent" },
  "air.infiltration-flow": { title: "Расход инфильтрации", caption: "L_inf" },
  "air.ventilation-flow": { title: "Расход вентиляции", caption: "L_vent" },
  "air.pressure-wind": { title: "Ветровой перепад давления", caption: "ΔP_wind" },
  "air.pressure-stack": { title: "Stack effect", caption: "ΔP_stack" },
  "air.pressure-total": { title: "Суммарный перепад давления", caption: "ΔP_total" },
  "air.q-inf": { title: "Теплопотери на инфильтрацию", caption: "Q_inf" },
  "air.q-vent-before": { title: "Теплопотери вентиляции без рекуперации", caption: "Q_vent" },
  "air.q-vent-after": { title: "Теплопотери вентиляции с рекуперацией", caption: "Q_vent,eff" },
  "air.saved-by-recovery": { title: "Снижение потерь за счёт рекуперации", caption: "savedByRecovery" },
  "air.h-inf": { title: "Коэффициент теплопотерь инфильтрации", caption: "H_inf" },
  "air.h-vent": { title: "Коэффициент теплопотерь вентиляции", caption: "H_ve" },
  "air.h-total": { title: "Суммарный коэффициент теплопотерь воздухообмена", caption: "H_total" },
  "humidity.f-rsi": { title: "Температурный фактор внутренней поверхности", caption: "f_Rsi" },
  "humidity.mrt": { title: "Средняя радиационная температура", caption: "MRT / T_mrt" },
  "humidity.t-op": { title: "Оперативная температура", caption: "T_op" },
  "engineering.hydronic-capacity": { title: "Гидравлическая мощность отопления", caption: "Q_hyd" },
  "engineering.required-mass-flow": { title: "Требуемый массовый расход теплоносителя", caption: "requiredMassFlow" },
  "engineering.required-volume-flow": { title: "Требуемый объёмный расход теплоносителя", caption: "requiredVolumeFlow" },
  "engineering.peak-unmet-load": { title: "Непокрытая пиковая нагрузка", caption: "peakUnmetLoadKW" },
  "engineering.unmet-energy": { title: "Непокрытая энергия", caption: "unmetEnergyKWh" },
  "ecology.ef": { title: "Удельный коэффициент выбросов CO₂", caption: "emissionFactorKgPerKWh" },
  "validation.room": { title: "Помещение датчика", caption: "roomId" },
  "validation.period": { title: "Период измерений", caption: "timestamp range" },
};

function getFieldDisplayMeta(field: SourceDataField): { title: string; caption?: string } {
  const meta = FIELD_DISPLAY_META[field.key];
  if (!meta) {
    return { title: field.label, caption: field.notes[0] || undefined };
  }
  return {
    title: meta.title,
    caption: field.notes[0] || meta.caption,
  };
}

function getMissingFieldExplanation(field: SourceDataField): string | null {
  if (!field.missing) {
    return null;
  }
  if (field.key.startsWith("reports.")) {
    return "На основной RC-solver не влияет. Заполните реквизиты, чтобы данные попали в отчёты и экспорт.";
  }
  if (field.key.startsWith("validation.")) {
    return "На основной RC-solver не влияет. Нужны roomId, метки времени и измеренный ряд для расчёта метрик валидации.";
  }
  if (field.key.startsWith("economy.")) {
    return "На основной RC-solver не влияет. Заполните тарифы и затраты, чтобы появились показатели экономики.";
  }
  if (field.key.startsWith("ecology.")) {
    return "На основной RC-solver не влияет. Укажите источник энергии и коэффициент выбросов, чтобы появился расчёт CO₂.";
  }
  if (
    field.key.startsWith("operation.") ||
    field.key.startsWith("air.") ||
    field.key.startsWith("humidity.") ||
    field.key.startsWith("engineering.")
  ) {
    return "Показатель появится после запуска расчёта или после ввода недостающих исходных данных.";
  }
  if (field.key.startsWith("materials.")) {
    return "Показатель зависит от конструкций и теплотехнических исходных данных. Назначьте материалы или U-значения окна/двери.";
  }
  if (field.key.startsWith("climate.")) {
    return "Выберите город РФ или задайте климатические параметры вручную, чтобы показатель появился.";
  }
  return "Нужно уточнить исходные данные, чтобы показатель появился.";
}

function scenarioFieldSource(
  hasExplicitValue: boolean,
  explicitSource: SourceDataOrigin = "user",
  fallbackSource: SourceDataOrigin = "fallback"
): SourceDataOrigin {
  return hasExplicitValue ? explicitSource : fallbackSource;
}

function sourceTone(origin: SourceDataOrigin): "neutral" | "info" | "success" | "warning" | "accent" {
  switch (origin) {
    case "model":
    case "result":
    case "sp50":
    case "sp131":
      return "info";
    case "user":
    case "scenario":
      return "success";
    case "calculated":
      return "accent";
    case "fallback":
      return "warning";
    default:
      return "neutral";
  }
}

function sourceLabel(origin: SourceDataOrigin, demoMode = false): string {
  switch (origin) {
    case "model":
      return "из модели";
    case "user":
    case "scenario":
      return "задано пользователем";
    case "calculated":
    case "result":
      return "рассчитано автоматически";
    case "sp50":
      return "из СП 50";
    case "sp131":
      return "из СП 131";
    case "fallback":
      return demoMode ? "демо-значение, можно заменить" : "демо-значение, можно заменить";
    default:
      return "нет данных";
  }
}

function translateEnumValue(value: string | number | boolean | null): string {
  if (typeof value !== "string") {
    if (typeof value === "boolean") {
      return value ? "Да" : "Нет";
    }
    return value == null ? NO_DATA : String(value);
  }
  switch (value) {
    case "wall":
      return "ограждающая стена";
    case "roof":
      return "кровля";
    case "slab":
      return "пол / плита";
    case "window":
      return "окно";
    case "door":
      return "дверь";
    case "ground":
      return "грунт";
    case "basement":
      return "подвал";
    case "outdoor":
      return "наружный воздух";
    case "interfloor":
      return "межэтажное перекрытие";
    case "attic":
      return "чердак";
    case "technical":
      return "техэтаж";
    case "disabled":
      return "не учитывать";
    case "homogeneityCoefficient":
      return "коэффициент однородности r";
    case "explicitPsiChi":
      return "линейные/точечные мостики ψ/χ";
    case "ideal":
      return "идеальный режим";
    case "capacityLimited":
      return "ограниченная мощность";
    case "water":
      return "вода";
    case "glycol":
      return "водно-гликолевая смесь";
    case "other":
      return "другой теплоноситель";
    case "normal":
      return "норма";
    case "cold_surface":
      return "холодная поверхность";
    case "condensation_risk":
      return "риск конденсации";
    case "sufficient":
      return "достаточно";
    case "partial":
      return "частично";
    case "missing":
      return "нет данных";
    case "unavailable":
      return "недоступно";
    case "synthetic":
      return "demo/synthetic";
    default:
      return value;
  }
}

function formatFieldValue(field: SourceDataField): string {
  const { value, unit } = field;
  if (value === null || value === "") {
    return NO_DATA;
  }
  if (typeof value === "number") {
    const digits =
      Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 100 ? 1 : Math.abs(value) >= 10 ? 2 : 3;
    const formatted = formatNumber(value, { maximumFractionDigits: digits });
    return unit ? `${formatted} ${unit}` : formatted;
  }
  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }
  const translated = translateEnumValue(value);
  return unit && translated !== NO_DATA ? `${translated} ${unit}` : translated;
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValidationSeries(series: ScenarioValidationPoint[] | null | undefined): string {
  return (series ?? [])
    .map((entry) => `${entry.timestamp}, ${entry.valueC}`)
    .join("\n");
}

function parseValidationSeries(
  value: string
): { points: ScenarioValidationPoint[]; invalidLines: number } {
  const lines = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const points: ScenarioValidationPoint[] = [];
  let invalidLines = 0;
  lines.forEach((line) => {
    const match = line.split(/[;,]/).map((item) => item.trim());
    if (match.length < 2) {
      invalidLines += 1;
      return;
    }
    const timestamp = match[0];
    const numeric = Number(match[1].replace(",", "."));
    if (!timestamp || !Number.isFinite(numeric)) {
      invalidLines += 1;
      return;
    }
    points.push({ timestamp, valueC: numeric });
  });
  return { points, invalidLines };
}

function resolveConstructionPreviewWallId(
  model: ReturnType<typeof useBuildStore.getState>["model"],
  constructionId: string
): string | null {
  if (constructionId === "video-ext-walls") {
    return model.walls.find((wall) => wall.wallAssemblyId === "video-exterior-wall")?.id ?? model.walls[0]?.id ?? null;
  }
  if (constructionId === "video-windows") {
    return model.windows[0]?.anchor.wallId ?? model.walls[0]?.id ?? null;
  }
  if (constructionId === "video-door-entry") {
    return model.doors[0]?.anchor.wallId ?? model.walls[0]?.id ?? null;
  }
  if (constructionId === "video-roof" || constructionId === "video-floor-ground") {
    return model.walls.find((wall) => wall.wallAssemblyId === "video-exterior-wall")?.id ?? model.walls[0]?.id ?? null;
  }
  return model.walls.find((wall) => wall.id === constructionId)?.id ?? null;
}

function statusMeta(status: SourceDataSummaryCard["status"]): {
  label: string;
  tone: "success" | "warning" | "neutral";
} {
  switch (status) {
    case "sufficient":
      return { label: "готово", tone: "success" };
    case "partial":
      return { label: "нужно уточнить", tone: "warning" };
    default:
      return { label: "нет данных", tone: "neutral" };
  }
}

function DataCompletenessCard({ card }: { card: SourceDataSummaryCard }) {
  const meta = statusMeta(card.status);
  return (
    <article className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 shadow-[var(--shadow-control)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">{card.label}</p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--text-base)]">
        {card.completionPercent}%
      </p>
    </article>
  );
}

function SourceBadge({ origin, demoMode = false }: { origin: SourceDataOrigin; demoMode?: boolean }) {
  return <Badge tone={sourceTone(origin)}>{sourceLabel(origin, demoMode)}</Badge>;
}

function FieldHelp({
  field,
  demoMode = false,
}: {
  field: SourceDataField;
  demoMode?: boolean;
}) {
  const note = field.warnings[0] ?? getMissingFieldExplanation(field);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <SourceBadge origin={field.source} demoMode={demoMode} />
      {note ? <span className="text-xs text-[color:var(--warning-fg)]">{note}</span> : null}
    </div>
  );
}

function ReadOnlyFieldCard({
  field,
  demoMode = false,
  showSourceBadge = true,
}: {
  field: SourceDataField;
  demoMode?: boolean;
  showSourceBadge?: boolean;
}) {
  const display = getFieldDisplayMeta(field);
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">{display.title}</p>
          {display.caption ? (
            <p className="text-xs text-[color:var(--text-soft)]">{display.caption}</p>
          ) : null}
        </div>
        {showSourceBadge ? <SourceBadge origin={field.source} demoMode={demoMode} /> : null}
      </div>
      <p className="mt-4 text-lg font-semibold text-[color:var(--text-base)]">
        {formatFieldValue(field)}
      </p>
      {field.warnings[0] || field.missing ? (
        <p className="mt-2 text-xs text-[color:var(--warning-fg)]">{field.warnings[0] ?? getMissingFieldExplanation(field)}</p>
      ) : null}
    </div>
  );
}

function NumberInputField({
  label,
  value,
  unit,
  source,
  warning,
  onChange,
  placeholder,
  min,
  step,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  source: SourceDataOrigin;
  warning?: string | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  min?: number;
  step?: number;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--text-base)]">{label}</span>
        <SourceBadge origin={source} />
      </div>
      <div className="relative">
        <input
          type="number"
          value={value ?? ""}
          min={min}
          step={step ?? 0.1}
          placeholder={placeholder}
          onChange={(event) => onChange(parseOptionalNumber(event.target.value))}
          className="ui-field w-full px-3 py-2 text-sm"
        />
        {unit ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--text-soft)]">
            {unit}
          </span>
        ) : null}
      </div>
      {warning ? <p className="text-xs text-[color:var(--warning-fg)]">{warning}</p> : null}
    </label>
  );
}

function TextInputField({
  label,
  value,
  source,
  warning,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null | undefined;
  source: SourceDataOrigin;
  warning?: string | null;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--text-base)]">{label}</span>
        <SourceBadge origin={source} />
      </div>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="ui-field w-full px-3 py-2 text-sm"
      />
      {warning ? <p className="text-xs text-[color:var(--warning-fg)]">{warning}</p> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  source,
  warning,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  source: SourceDataOrigin;
  warning?: string | null;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--text-base)]">{label}</span>
        <SourceBadge origin={source} />
      </div>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="ui-field w-full px-3 py-2 text-sm"
      />
      {warning ? <p className="text-xs text-[color:var(--warning-fg)]">{warning}</p> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  source,
  warning,
  options,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  source: SourceDataOrigin;
  warning?: string | null;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string | null) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--text-base)]">{label}</span>
        <SourceBadge origin={source} />
      </div>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value ? event.target.value : null)}
        className="ui-field w-full px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {warning ? <p className="text-xs text-[color:var(--warning-fg)]">{warning}</p> : null}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  source,
  warning,
  onChange,
}: {
  label: string;
  checked: boolean;
  source: SourceDataOrigin;
  warning?: string | null;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[color:var(--text-base)]">{label}</p>
        {warning ? <p className="text-xs text-[color:var(--warning-fg)]">{warning}</p> : null}
        <SourceBadge origin={source} />
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4"
      />
    </label>
  );
}

function SectionWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) {
    return null;
  }
  return (
    <EngineeringCallout variant="attention" title="Предупреждения">
      <ul>
        {warnings.slice(0, 4).map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </EngineeringCallout>
  );
}

export function ScenariosWorkspacePage() {
  const projectId = useProjectStore((state) => state.projectId);
  const projectKind = useProjectStore((state) => state.projectKind);
  const buildModel = useBuildStore((state) => state.model);
  const projectKey = useBuildStore((state) => state.projectKey);
  const modelRevision = useBuildStore((state) => state.modelRevision);
  const setBuildSelection = useBuildStore((state) => state.setSelection);
  const loadModelSnapshot = useBuildStore((state) => state.loadModelSnapshot);
  const lastThermalResult = useTwinStore((state) => state.lastThermalResult);
  const lastThermalResultBinding = useTwinStore((state) => state.lastThermalResultBinding);
  const rawScenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
  const solveCompleted = useWorkflowStore((state) => state.solveCompleted);
  const setScenarioConfig = useWorkflowStore((state) => state.setScenarioConfig);
  const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
  const hydrateReportInputs = useExpertiseInputsStore((state) => state.hydrateProject);
  const reportInputs = useExpertiseInputsStore((state) => state.inputsByProject[projectKey] ?? null);
  const getReportInputs = useExpertiseInputsStore((state) => state.getInputs);
  const setReportField = useExpertiseInputsStore((state) => state.setField);

  const scenario = useMemo(() => resolveScenarioConfig(rawScenarioConfig), [rawScenarioConfig]);
  const [validationSeriesText, setValidationSeriesText] = useState(
    formatValidationSeries(scenario.validation?.measuredSeries)
  );
  const [validationSeriesErrors, setValidationSeriesErrors] = useState(0);

  useEffect(() => {
    setCurrentStep("scenario");
  }, [setCurrentStep]);

  useEffect(() => {
    hydrateReportInputs(projectKey);
  }, [hydrateReportInputs, projectKey]);

  useEffect(() => {
    setValidationSeriesText(formatValidationSeries(scenario.validation?.measuredSeries));
  }, [scenario.validation?.measuredSeries]);

  const thermalResultState = getResultSyncState(
    Boolean(lastThermalResult),
    lastThermalResultBinding,
    projectKey,
    modelRevision
  );
  const buildModelMatchesProject = doesBuildModelMatchProject(buildModel, projectId, projectKind);
  const hasBuildGeometryForProject = hasBuildGeometry(buildModel) && buildModelMatchesProject;
  const strictModel = useMemo(
    () => (hasBuildGeometryForProject ? buildModel : createEmptyBuildingModel()),
    [buildModel, hasBuildGeometryForProject]
  );
  const currentThermalResult =
    thermalResultState === "current" && solveCompleted ? lastThermalResult : null;
  const reportInputSnapshot = reportInputs ?? getReportInputs(projectKey);
  const dataReport = useMemo(
    () =>
      buildSourceDataWorkspaceReport({
        model: strictModel,
        scenarioConfig: rawScenarioConfig,
        thermalResult: currentThermalResult,
        reportInputs: reportInputSnapshot,
      }),
    [currentThermalResult, rawScenarioConfig, reportInputSnapshot, strictModel]
  );

  const hasModel = strictModel.rooms.length > 0 || strictModel.walls.length > 0;
  const isDemoProject = isCanonicalDemoProjectModel(strictModel);
  const humidityWarnings = dataReport.sections.humidity.warnings.filter(
    (warning) => !warning.includes("MRT не задана.")
  );
  const summaryCards = dataReport.summaryCards.filter(
    (card) => card.id !== "humidity" && card.id !== "economy"
  );
  const scrollToSection = (anchor: string) => {
    if (typeof document === "undefined") {
      return;
    }
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const openConstructionInModel = (constructionId: string) => {
    const wallId = resolveConstructionPreviewWallId(strictModel, constructionId);
    if (wallId && hasBuildGeometryForProject) {
      setBuildSelection({ kind: "wall", id: wallId });
    }
    navigate("/model");
  };

  const updateScenario = (mutator: (next: ScenarioConfig) => void) => {
    const next = rawScenarioConfig
      ? resolveScenarioConfig(rawScenarioConfig)
      : createDefaultScenarioConfig();
    mutator(next);
    setScenarioConfig(next);
  };
  const updateModel = (mutator: (model: typeof buildModel) => typeof buildModel) => {
    if (!hasBuildGeometryForProject) {
      return;
    }
    loadModelSnapshot(mutator(buildModel));
  };

  const rawClimateCityId = rawScenarioConfig?.climateCityId ?? null;
  const climateManual = rawScenarioConfig?.climate?.manual;
  const rawMaterials = rawScenarioConfig?.materials;
  const rawOperation = rawScenarioConfig?.operation;
  const rawComfort = rawScenarioConfig?.comfort;
  const rawEngineering = rawScenarioConfig?.engineeringSystems;
  const rawEcology = rawScenarioConfig?.ecology;
  const rawEconomy = rawScenarioConfig?.economy;
  const rawValidation = rawScenarioConfig?.validation;
  const modelHpsi =
    (typeof dataReport.sections.materials.computedFields.find((f) => f.key === "materials.h-psi")?.value === "number"
      ? (dataReport.sections.materials.computedFields.find((f) => f.key === "materials.h-psi")?.value as number)
      : null) ?? null;
  const modelHchi =
    (typeof dataReport.sections.materials.computedFields.find((f) => f.key === "materials.h-chi")?.value === "number"
      ? (dataReport.sections.materials.computedFields.find((f) => f.key === "materials.h-chi")?.value as number)
      : null) ?? null;
  const climateDesignPlaceholder = dataReport.sections.climate.computedFields.find((field) => field.key === "climate.design-outdoor")?.value;
  const climateAveragePlaceholder = dataReport.sections.climate.computedFields.find((field) => field.key === "climate.heating-average")?.value;
  const climateDurationPlaceholder = dataReport.sections.climate.computedFields.find((field) => field.key === "climate.heating-duration")?.value;
  const missingGeometryMessage = buildModelMatchesProject
    ? "Для расчёта используется только локальная 2D/build-модель текущего проекта. Сначала соберите или импортируйте её в конструкторе."
    : "В build-store сейчас нет локальной модели для текущего проекта. Расчёт по данным другого проекта отключён.";

  return (
    <section className="w-full space-y-5 ui-page-enter">
      <WorkspacePageHeader title="Данные для расчёта" />

      {!hasBuildGeometryForProject ? (
        <EmptyWorkspaceState
          title="Нет локальной модели для расчёта"
          message={missingGeometryMessage}
          actions={
            <>
              <button
                type="button"
                onClick={() => navigate("/build")}
                className="ui-btn-primary px-4 py-2 text-sm"
              >
                Открыть конструктор
              </button>
              <button
                type="button"
                onClick={() => navigate("/studio")}
                className="ui-btn-secondary px-4 py-2 text-sm"
              >
                Открыть модель проекта
              </button>
            </>
          }
        />
      ) : null}

      {!hasBuildGeometryForProject ? null : (
        <>
      {dataReport.reportWarnings.length ? (
        <EngineeringCallout variant="assumption" title="Источники и допущения">
          <ul>
            {dataReport.reportWarnings.slice(0, 5).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </EngineeringCallout>
      ) : null}

      <SectionShell title="Сводка">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => (
            <DataCompletenessCard key={card.id} card={card} />
          ))}
        </div>
      </SectionShell>

      <div className="sticky top-2 z-10 overflow-x-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-3 shadow-[var(--shadow-control)]">
        <div className="flex min-w-max gap-2">
          {SECTION_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.anchor)}
              className="ui-btn-secondary whitespace-nowrap px-3 py-1.5 text-xs"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div id="data-section-geometry" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.geometry}
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => scrollToSection("data-section-materials")} className="ui-btn-secondary px-3 py-2 text-sm">
              К материалам
            </button>
            <button type="button" onClick={() => navigate("/model")} className="ui-btn-secondary px-3 py-2 text-sm">
              Показать на модели
            </button>
          </div>
        }
      >
        <SectionWarnings warnings={dataReport.sections.geometry.warnings} />
        {hasModel ? (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              {dataReport.sections.geometry.computedFields.map((field) => (
                <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
              ))}
            </div>
            <details className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]" open={false}>
              <summary className="cursor-pointer select-none px-3 py-3 text-sm font-semibold text-[color:var(--text-base)]">
                Таблица помещений
              </summary>
              <div className="overflow-x-auto rounded-b-2xl">
                <table className="min-w-[72rem] text-sm">
                  <thead className="bg-[color:var(--surface-base)] text-left text-[color:var(--text-muted)]">
                    <tr>
                      <th className="sticky left-0 z-10 bg-[color:var(--surface-base)] px-3 py-2 font-semibold">Помещение</th>
                      <th className="px-3 py-2 font-semibold">Площадь</th>
                      <th className="px-3 py-2 font-semibold">Объём</th>
                      <th className="px-3 py-2 font-semibold">Высота</th>
                      <th className="px-3 py-2 font-semibold">Отапливаемое</th>
                      <th className="px-3 py-2 font-semibold">Контакт пола</th>
                      <th className="px-3 py-2 font-semibold">Контакт кровли / перекрытия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataReport.geometryRooms.map((room) => (
                      <tr key={room.roomId} className="border-t border-[color:var(--border-soft)] align-top">
                        <td className="sticky left-0 bg-[color:var(--surface-elevated)] px-3 py-3">
                          <div className="space-y-1">
                            <p className="font-medium text-[color:var(--text-base)]">{room.roomName}</p>
                            <p className="text-xs text-[color:var(--text-soft)]">
                              {formatFieldValue(room.areaM2)} · {formatFieldValue(room.volumeM3)}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-2">
                            <p>{formatFieldValue(room.areaM2)}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-2">
                            <p>{formatFieldValue(room.volumeM3)}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 min-w-[10rem]">
                          <div className="space-y-2">
                            <p>{formatFieldValue(room.heightM)}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 min-w-[11rem]">
                          <div className="space-y-2">
                            <p>{formatFieldValue(room.heated)}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 min-w-[12rem]">
                          <div className="space-y-2">
                            <p>{formatFieldValue(room.floorContactType)}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 min-w-[12rem]">
                          <div className="space-y-2">
                            <p>{formatFieldValue(room.roofContactType)}</p>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <EmptyWorkspaceState
            title="Геометрия модели не подготовлена"
            message="Площадь помещений, объёмы и оболочка считаются автоматически из BuildingModel. Сначала соберите модель."
            actions={
              <button type="button" onClick={() => navigate("/model")} className="ui-btn-primary px-4 py-2 text-sm">
                Перейти к модели
              </button>
            }
          />
        )}
      </SectionShell>
      </div>

      <div id="data-section-materials" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.materials}
        action={
          <button type="button" onClick={() => navigate("/model")} className="ui-btn-secondary px-3 py-2 text-sm">
            Открыть конструктор
          </button>
        }
      >
        <SectionWarnings warnings={dataReport.sections.materials.warnings} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="space-y-4">
            {dataReport.constructions.length ? (
              dataReport.constructions.map((construction) => (
                <details
                  key={construction.id}
                  className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]"
                  open={false}
                >
                  <summary className="cursor-pointer select-none list-none px-4 py-4 [&::-webkit-details-marker]:hidden">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-base)]">{construction.label}</p>
                        <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                          {translateEnumValue(construction.kind)} · {formatFieldValue(construction.areaM2)}
                        </p>
                      </div>
                    </div>
                  </summary>
                  <div className="space-y-4 border-t border-[color:var(--border-soft)] px-4 pb-4 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openConstructionInModel(construction.id)}
                        className="ui-btn-secondary px-3 py-1.5 text-xs"
                      >
                        Показать на модели
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <ReadOnlyFieldCard field={construction.layerCount} demoMode={isDemoProject} showSourceBadge={false} />
                      <ReadOnlyFieldCard field={construction.resistanceR0_m2K_W} demoMode={isDemoProject} showSourceBadge={false} />
                      <ReadOnlyFieldCard field={construction.reducedResistance_m2K_W} demoMode={isDemoProject} showSourceBadge={false} />
                      <ReadOnlyFieldCard field={construction.uValue_W_m2K} demoMode={isDemoProject} showSourceBadge={false} />
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-soft)]">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[color:var(--surface-base)] text-left text-[color:var(--text-muted)]">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Материал</th>
                            <th className="px-3 py-2 font-semibold">d</th>
                            <th className="px-3 py-2 font-semibold">λ</th>
                            <th className="px-3 py-2 font-semibold">ρ</th>
                            <th className="px-3 py-2 font-semibold">c</th>
                            <th className="px-3 py-2 font-semibold">R слоя</th>
                          </tr>
                        </thead>
                        <tbody>
                          {construction.layers.map((layer) => (
                            <tr key={`${construction.id}-${layer.materialId}-${layer.materialLabel}`} className="border-t border-[color:var(--border-soft)]">
                              <td className="px-3 py-2">{layer.materialLabel}</td>
                              <td className="px-3 py-2">{formatFieldValue(layer.thicknessM)}</td>
                              <td className="px-3 py-2">{formatFieldValue(layer.lambda_W_mK)}</td>
                              <td className="px-3 py-2">{formatFieldValue(layer.densityKgM3)}</td>
                              <td className="px-3 py-2">{formatFieldValue(layer.heatCapacity_J_kgK)}</td>
                              <td className="px-3 py-2">{formatFieldValue(layer.resistance_m2K_W)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {construction.warnings[0] ? (
                      <p className="text-xs text-[color:var(--warning-fg)]">{construction.warnings[0]}</p>
                    ) : null}
                  </div>
                </details>
              ))
            ) : (
              <EmptyWorkspaceState
                title="Материалы и конструкции пока не назначены"
                message="Назначьте слои конструкций в модели, чтобы получить R, U и сводку теплотехнических свойств."
                actions={
                  <button type="button" onClick={() => navigate("/model")} className="ui-btn-primary px-4 py-2 text-sm">
                    Перейти к модели
                  </button>
                }
              />
            )}
          </div>
          <div className="space-y-4">
            <SelectField
              label="Учёт неоднородностей"
              value={scenario.materials?.bridgeAccountingMode ?? "disabled"}
              source={scenarioFieldSource(Boolean(rawMaterials?.bridgeAccountingMode))}
              warning={dataReport.sections.materials.warnings[0] ?? null}
              options={[
                { value: "disabled", label: "не учитывать" },
                { value: "homogeneityCoefficient", label: "коэффициент однородности r" },
                { value: "explicitPsiChi", label: "линейные/точечные мостики ψ/χ" },
              ]}
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.materials = draft.materials ?? {};
                  draft.materials.bridgeAccountingMode =
                    (next ?? "disabled") as "disabled" | "homogeneityCoefficient" | "explicitPsiChi";
                })
              }
            />
            <NumberInputField
              label="Коэффициент однородности r"
              value={scenario.materials?.homogeneityCoefficient ?? null}
              source={scenarioFieldSource(rawMaterials?.homogeneityCoefficient != null)}
              warning={
                scenario.materials?.bridgeAccountingMode === "explicitPsiChi"
                  ? "При explicit ψ/χ коэффициент однородности не должен дополнительно ухудшать R."
                  : null
              }
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.materials = draft.materials ?? {};
                  draft.materials.homogeneityCoefficient = next;
                })
              }
            />
            <NumberInputField
              label="U окна"
              value={scenario.materials?.windowUValue_W_m2K ?? null}
              unit="Вт/(м²·К)"
              source={scenarioFieldSource(rawMaterials?.windowUValue_W_m2K != null)}
              onChange={(next) => {
                updateScenario((draft) => {
                  draft.materials = draft.materials ?? {};
                  draft.materials.windowUValue_W_m2K = next;
                });
                updateModel((model) =>
                  setModelOpeningUValues(model, {
                    windowU_W_m2K: next,
                    doorU_W_m2K: scenario.materials?.doorUValue_W_m2K ?? null,
                  })
                );
              }}
            />
            <NumberInputField
              label="U двери"
              value={scenario.materials?.doorUValue_W_m2K ?? null}
              unit="Вт/(м²·К)"
              source={scenarioFieldSource(rawMaterials?.doorUValue_W_m2K != null)}
              onChange={(next) => {
                updateScenario((draft) => {
                  draft.materials = draft.materials ?? {};
                  draft.materials.doorUValue_W_m2K = next;
                });
                updateModel((model) =>
                  setModelOpeningUValues(model, {
                    windowU_W_m2K: scenario.materials?.windowUValue_W_m2K ?? null,
                    doorU_W_m2K: next,
                  })
                );
              }}
            />
            <NumberInputField
              label="Солнечный фактор окна"
              value={scenario.materials?.windowGValue ?? null}
              source={scenarioFieldSource(rawMaterials?.windowGValue != null)}
              onChange={(next) => {
                updateScenario((draft) => {
                  draft.materials = draft.materials ?? {};
                  draft.materials.windowGValue = next;
                });
                updateModel((model) =>
                  setModelOpticalFactors(model, {
                    windowGValue: next,
                    shadingFactor: scenario.materials?.shadingFactor ?? null,
                  })
                );
              }}
            />
            <NumberInputField
              label="Коэффициент затенения"
              value={scenario.materials?.shadingFactor ?? null}
              source={scenarioFieldSource(rawMaterials?.shadingFactor != null)}
              onChange={(next) => {
                updateScenario((draft) => {
                  draft.materials = draft.materials ?? {};
                  draft.materials.shadingFactor = next;
                });
                updateModel((model) =>
                  setModelOpticalFactors(model, {
                    windowGValue: scenario.materials?.windowGValue ?? null,
                    shadingFactor: next,
                  })
                );
              }}
            />
            <NumberInputField
              label="H_psi (линейные мостики)"
              value={modelHpsi}
              unit="Вт/К"
              source="model"
              onChange={(next) =>
                updateModel((model) =>
                  setModelBridgeConductance(model, {
                    H_psi_W_K: next,
                    H_chi_W_K: modelHchi,
                  })
                )
              }
            />
            <NumberInputField
              label="H_chi (точечные мостики)"
              value={modelHchi}
              unit="Вт/К"
              source="model"
              onChange={(next) =>
                updateModel((model) =>
                  setModelBridgeConductance(model, {
                    H_psi_W_K: modelHpsi,
                    H_chi_W_K: next,
                  })
                )
              }
            />
            <div className="grid gap-3">
              {dataReport.sections.materials.computedFields.map((field) => (
                <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
              ))}
            </div>
          </div>
        </div>
      </SectionShell>
      </div>

      <div id="data-section-climate" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.climate}
        description="Пользователь задаёт климатический профиль или ручные климатические параметры. GSOP, ΔT и статус источника считаются в core."
      >
        <SectionWarnings warnings={dataReport.sections.climate.warnings} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Город / климатический профиль"
              value={scenario.climateCityId ?? null}
              source={rawClimateCityId ? "sp131" : "fallback"}
              warning={!rawClimateCityId ? "Если город не выбран вручную, используется профиль по умолчанию." : null}
              options={[
                { value: "", label: "не выбран" },
                { value: "moscow", label: "Москва" },
                { value: "spb", label: "Санкт-Петербург" },
                { value: "ekb", label: "Екатеринбург" },
                { value: "novosibirsk", label: "Новосибирск" },
                { value: "krasnodar", label: "Краснодар" },
              ]}
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.climateCityId = next;
                })
              }
            />
            <NumberInputField
              label="Расчётная наружная температура"
              value={scenario.climate.manual?.outdoorDesignTemperatureC ?? null}
              unit="°C"
              source={scenarioFieldSource(climateManual?.outdoorDesignTemperatureC != null)}
              placeholder={typeof climateDesignPlaceholder === "number" ? climateDesignPlaceholder.toFixed(1) : undefined}
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.climate.manual = draft.climate.manual ?? {};
                  draft.climate.manual.outdoorDesignTemperatureC = next;
                })
              }
            />
            <NumberInputField
              label="Средняя температура отопительного периода"
              value={scenario.climate.manual?.outdoorHeatingAverageC ?? null}
              unit="°C"
              source={scenarioFieldSource(climateManual?.outdoorHeatingAverageC != null)}
              placeholder={typeof climateAveragePlaceholder === "number" ? climateAveragePlaceholder.toFixed(1) : undefined}
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.climate.manual = draft.climate.manual ?? {};
                  draft.climate.manual.outdoorHeatingAverageC = next;
                })
              }
            />
            <NumberInputField
              label="Длительность отопительного периода"
              value={scenario.climate.manual?.heatingDurationDays ?? null}
              unit="сут"
              source={scenarioFieldSource(climateManual?.heatingDurationDays != null)}
              placeholder={typeof climateDurationPlaceholder === "number" ? climateDurationPlaceholder.toFixed(0) : undefined}
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.climate.manual = draft.climate.manual ?? {};
                  draft.climate.manual.heatingDurationDays = next;
                })
              }
            />
            <NumberInputField
              label="Базовая температура сценария"
              value={scenario.climate.baseC}
              unit="°C"
              source={scenarioFieldSource(rawScenarioConfig?.climate?.baseC != null, "scenario")}
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.climate.baseC = next ?? draft.climate.baseC;
                })
              }
            />
            <NumberInputField
              label="Амплитуда наружной температуры"
              value={scenario.climate.amplitudeC}
              unit="°C"
              source={scenarioFieldSource(rawScenarioConfig?.climate?.amplitudeC != null, "scenario")}
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.climate.amplitudeC = next ?? draft.climate.amplitudeC;
                })
              }
            />
            <NumberInputField
              label="Смещение графика"
              value={scenario.climate.seasonalOffsetC}
              unit="°C"
              source={scenarioFieldSource(rawScenarioConfig?.climate?.seasonalOffsetC != null, "scenario")}
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.climate.seasonalOffsetC = next ?? draft.climate.seasonalOffsetC;
                })
              }
            />
          </div>
          <div className="grid gap-3">
            {dataReport.sections.climate.computedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </SectionShell>
      </div>

      <div id="data-section-operation" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.operation}
        description="Расписание уставок, внутренние теплопоступления, занятость, длительность сценария и шаг расчёта."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberInputField
              label="Дневная уставка"
              value={scenario.setpoints.day}
              unit="°C"
              source={scenarioFieldSource(rawScenarioConfig?.setpoints?.day != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.setpoints.day = next ?? draft.setpoints.day; })}
            />
            <NumberInputField
              label="Ночная уставка"
              value={scenario.setpoints.night}
              unit="°C"
              source={scenarioFieldSource(rawScenarioConfig?.setpoints?.night != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.setpoints.night = next ?? draft.setpoints.night; })}
            />
            <NumberInputField
              label="Начало дневного режима"
              value={scenario.setpoints.dayStartHour}
              unit="ч"
              step={1}
              source={scenarioFieldSource(rawScenarioConfig?.setpoints?.dayStartHour != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.setpoints.dayStartHour = Math.max(0, Math.min(23, Math.round(next ?? draft.setpoints.dayStartHour))); })}
            />
            <NumberInputField
              label="Начало ночного режима"
              value={scenario.setpoints.nightStartHour}
              unit="ч"
              step={1}
              source={scenarioFieldSource(rawScenarioConfig?.setpoints?.nightStartHour != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.setpoints.nightStartHour = Math.max(0, Math.min(23, Math.round(next ?? draft.setpoints.nightStartHour))); })}
            />
            <NumberInputField
              label="Теплопоступления днём"
              value={scenario.internalGains.dayGain_W_m2}
              unit="Вт/м²"
              source={scenarioFieldSource(rawScenarioConfig?.internalGains?.dayGain_W_m2 != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.internalGains.dayGain_W_m2 = next ?? draft.internalGains.dayGain_W_m2; })}
            />
            <NumberInputField
              label="Теплопоступления ночью"
              value={scenario.internalGains.nightGain_W_m2}
              unit="Вт/м²"
              source={scenarioFieldSource(rawScenarioConfig?.internalGains?.nightGain_W_m2 != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.internalGains.nightGain_W_m2 = next ?? draft.internalGains.nightGain_W_m2; })}
            />
            <NumberInputField
              label="Занятость днём"
              value={scenario.occupancy.dayFraction}
              source={scenarioFieldSource(rawScenarioConfig?.occupancy?.dayFraction != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.occupancy.dayFraction = Math.max(0, Math.min(1, next ?? draft.occupancy.dayFraction)); })}
            />
            <NumberInputField
              label="Занятость ночью"
              value={scenario.occupancy.nightFraction}
              source={scenarioFieldSource(rawScenarioConfig?.occupancy?.nightFraction != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.occupancy.nightFraction = Math.max(0, Math.min(1, next ?? draft.occupancy.nightFraction)); })}
            />
            <SelectField
              label="Длительность расчёта"
              value={scenario.operation?.duration ?? "24h"}
              source={scenarioFieldSource(Boolean(rawOperation?.duration))}
              options={[
                { value: "24h", label: "24 часа" },
                { value: "7d", label: "7 суток" },
              ]}
              onChange={(next) => updateScenario((draft) => {
                draft.operation = draft.operation ?? {};
                draft.operation.duration = (next ?? "24h") as "24h" | "7d";
              })}
            />
            <NumberInputField
              label="Шаг расчёта"
              value={scenario.operation?.timestepMinutes ?? 10}
              unit="мин"
              step={1}
              min={1}
              source={scenarioFieldSource(rawOperation?.timestepMinutes != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.operation = draft.operation ?? {};
                draft.operation.timestepMinutes = next == null ? null : Math.max(1, Math.round(next));
              })}
            />
          </div>
          <div className="grid gap-3">
            {dataReport.sections.operation.computedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </SectionShell>
      </div>

      <div id="data-section-air" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.airExchange}
        description="Инфильтрация и вентиляция учитываются раздельно. Рекуперация применяется только к механической вентиляции."
      >
        <SectionWarnings warnings={dataReport.sections.airExchange.warnings} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Режим инфильтрации"
              value={scenario.ventilation.infiltrationMode ?? "manualAch"}
              source={scenarioFieldSource(rawScenarioConfig?.ventilation?.infiltrationMode != null, "scenario")}
              options={[
                { value: "manualAch", label: "manualAch · ACH задаётся вручную" },
                { value: "envelopeLeakage", label: "envelopeLeakage · по воздухопроницаемости ограждений" },
                { value: "pressureBased", label: "pressureBased · по ветру, stack effect и ΔP" },
              ]}
              onChange={(next) => updateScenario((draft) => {
                draft.ventilation.infiltrationMode = (next as "manualAch" | "envelopeLeakage" | "pressureBased" | null) ?? "manualAch";
              })}
            />
            <NumberInputField
              label="Инфильтрация / fallback ACH"
              value={scenario.ventilation.infiltrationACH}
              unit="1/ч"
              source={scenarioFieldSource(rawScenarioConfig?.ventilation?.infiltrationACH != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.ventilation.infiltrationACH = Math.max(0, next ?? draft.ventilation.infiltrationACH); })}
            />
            <NumberInputField
              label="Механическая вентиляция"
              value={scenario.ventilation.ventilationACH}
              unit="1/ч"
              source={scenarioFieldSource(rawScenarioConfig?.ventilation?.ventilationACH != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.ventilation.ventilationACH = Math.max(0, next ?? draft.ventilation.ventilationACH); })}
            />
            <ToggleField
              label="Механическая вентиляция"
              checked={scenario.ventilation.mechanicalVentilationEnabled}
              source={scenarioFieldSource(rawScenarioConfig?.ventilation?.mechanicalVentilationEnabled != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.ventilation.mechanicalVentilationEnabled = next; })}
            />
            <NumberInputField
              label="КПД рекуперации"
              value={scenario.ventilation.heatRecoveryFactor}
              source={scenarioFieldSource(rawScenarioConfig?.ventilation?.heatRecoveryFactor != null, "scenario")}
              onChange={(next) => updateScenario((draft) => { draft.ventilation.heatRecoveryFactor = Math.max(0, Math.min(1, next ?? draft.ventilation.heatRecoveryFactor)); })}
            />
            {scenario.ventilation.infiltrationMode !== "manualAch" ? (
              <>
                <NumberInputField
                  label="G_air ограждений @10 Па"
                  value={scenario.ventilation.envelopeLeakage?.envelopeAirPermeabilityM3sM2At10Pa ?? null}
                  unit="м³/(с·м²)"
                  source={scenarioFieldSource(rawScenarioConfig?.ventilation?.envelopeLeakage?.envelopeAirPermeabilityM3sM2At10Pa != null, "scenario")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.envelopeLeakage = draft.ventilation.envelopeLeakage ?? {};
                    draft.ventilation.envelopeLeakage.envelopeAirPermeabilityM3sM2At10Pa = next == null ? null : Math.max(0, next);
                  })}
                />
                <NumberInputField
                  label="G_air окон @10 Па"
                  value={scenario.ventilation.envelopeLeakage?.windowAirPermeabilityM3sMAt10Pa ?? null}
                  unit="м³/(с·м)"
                  source={scenarioFieldSource(rawScenarioConfig?.ventilation?.envelopeLeakage?.windowAirPermeabilityM3sMAt10Pa != null, "scenario")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.envelopeLeakage = draft.ventilation.envelopeLeakage ?? {};
                    draft.ventilation.envelopeLeakage.windowAirPermeabilityM3sMAt10Pa = next == null ? null : Math.max(0, next);
                  })}
                />
                <NumberInputField
                  label="G_air дверей @10 Па"
                  value={scenario.ventilation.envelopeLeakage?.doorAirPermeabilityM3sMAt10Pa ?? null}
                  unit="м³/(с·м)"
                  source={scenarioFieldSource(rawScenarioConfig?.ventilation?.envelopeLeakage?.doorAirPermeabilityM3sMAt10Pa != null, "scenario")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.envelopeLeakage = draft.ventilation.envelopeLeakage ?? {};
                    draft.ventilation.envelopeLeakage.doorAirPermeabilityM3sMAt10Pa = next == null ? null : Math.max(0, next);
                  })}
                />
                <NumberInputField
                  label="Показатель степени n"
                  value={scenario.ventilation.envelopeLeakage?.pressureExponent ?? null}
                  source={scenarioFieldSource(rawScenarioConfig?.ventilation?.envelopeLeakage?.pressureExponent != null, "scenario")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.envelopeLeakage = draft.ventilation.envelopeLeakage ?? {};
                    draft.ventilation.envelopeLeakage.pressureExponent = next == null ? null : Math.max(0.1, next);
                  })}
                />
              </>
            ) : null}
            {scenario.ventilation.infiltrationMode === "pressureBased" ? (
              <>
                <NumberInputField
                  label="Скорость ветра"
                  value={scenario.ventilation.pressureBased?.windSpeedMps ?? null}
                  unit="м/с"
                  source={scenarioFieldSource(rawScenarioConfig?.ventilation?.pressureBased?.windSpeedMps != null, "scenario")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.pressureBased = draft.ventilation.pressureBased ?? {};
                    draft.ventilation.pressureBased.windSpeedMps = next == null ? null : Math.max(0, next);
                  })}
                />
                <NumberInputField
                  label="Коэффициент давления Cp"
                  value={scenario.ventilation.pressureBased?.windPressureCoefficient ?? null}
                  source={scenarioFieldSource(rawScenarioConfig?.ventilation?.pressureBased?.windPressureCoefficient != null, "scenario")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.pressureBased = draft.ventilation.pressureBased ?? {};
                    draft.ventilation.pressureBased.windPressureCoefficient = next == null ? null : Math.max(0.1, next);
                  })}
                />
                <NumberInputField
                  label="Высота stack effect"
                  value={scenario.ventilation.pressureBased?.stackHeightM ?? null}
                  unit="м"
                  source={scenarioFieldSource(rawScenarioConfig?.ventilation?.pressureBased?.stackHeightM != null, "scenario")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.pressureBased = draft.ventilation.pressureBased ?? {};
                    draft.ventilation.pressureBased.stackHeightM = next == null ? null : Math.max(0.5, next);
                  })}
                />
                <NumberInputField
                  label="ΔP мех. вентиляции"
                  value={scenario.ventilation.pressureBased?.mechanicalPressurePa ?? null}
                  unit="Па"
                  source={scenarioFieldSource(rawScenarioConfig?.ventilation?.pressureBased?.mechanicalPressurePa != null, "scenario")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.pressureBased = draft.ventilation.pressureBased ?? {};
                    draft.ventilation.pressureBased.mechanicalPressurePa = next == null ? null : Math.max(0, next);
                  })}
                />
              </>
            ) : null}
          </div>
          <div className="grid gap-3">
            {dataReport.sections.airExchange.computedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </SectionShell>
      </div>

      <div id="data-section-humidity" className="scroll-mt-24">
      <SectionShell title={SECTION_TITLES.humidity}>
        <SectionWarnings warnings={humidityWarnings} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberInputField
              label="Относительная влажность"
              value={scenario.comfort?.relativeHumidityPercent ?? null}
              unit="%"
              source={scenarioFieldSource(rawComfort?.relativeHumidityPercent != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.comfort = draft.comfort ?? {};
                draft.comfort.relativeHumidityPercent = next;
              })}
            />
            <NumberInputField
              label="Минимально допустимая температура"
              value={scenario.comfort?.comfortMinC ?? null}
              unit="°C"
              source={scenarioFieldSource(rawComfort?.comfortMinC != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.comfort = draft.comfort ?? {};
                draft.comfort.comfortMinC = next;
              })}
            />
            <NumberInputField
              label="Максимально допустимая температура"
              value={scenario.comfort?.comfortMaxC ?? null}
              unit="°C"
              source={scenarioFieldSource(rawComfort?.comfortMaxC != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.comfort = draft.comfort ?? {};
                draft.comfort.comfortMaxC = next;
              })}
            />
            <TextInputField
              label="Категория комфорта"
              value={scenario.comfort?.comfortCategory ?? ""}
              source={scenarioFieldSource(Boolean(rawComfort?.comfortCategory))}
              onChange={(next) => updateScenario((draft) => {
                draft.comfort = draft.comfort ?? {};
                draft.comfort.comfortCategory = next.trim() || null;
              })}
            />
            <NumberInputField
              label="Измеренная MRT"
              value={scenario.comfort?.measuredMrtC ?? null}
              unit="°C"
              source={scenarioFieldSource(rawComfort?.measuredMrtC != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.comfort = draft.comfort ?? {};
                draft.comfort.measuredMrtC = next;
              })}
            />
            <NumberInputField
              label="Измеренная температура поверхности"
              value={scenario.comfort?.measuredSurfaceTemperatureC ?? null}
              unit="°C"
              source={scenarioFieldSource(rawComfort?.measuredSurfaceTemperatureC != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.comfort = draft.comfort ?? {};
                draft.comfort.measuredSurfaceTemperatureC = next;
              })}
            />
          </div>
          <div className="grid gap-3">
            {dataReport.sections.humidity.computedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </SectionShell>
      </div>

      <div id="data-section-engineering" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.engineeringNetworks}
        description="Идеальный режим solver остаётся default. Ограничение мощности и гидравлика задаются явно и считаются как отдельные derived-показатели."
      >
        <SectionWarnings warnings={dataReport.sections.engineeringNetworks.warnings} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <ToggleField
              label="Система отопления активна"
              checked={scenario.engineeringSystems?.heatingEnabled ?? true}
              source={scenarioFieldSource(rawEngineering?.heatingEnabled != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.heatingEnabled = next;
              })}
            />
            <SelectField
              label="Режим отопления"
              value={scenario.engineeringSystems?.heatingMode ?? "ideal"}
              source={scenarioFieldSource(Boolean(rawEngineering?.heatingMode))}
              warning={
                scenario.engineeringSystems?.heatingMode === "ideal"
                  ? "Мощность отопления в solver не ограничивается; гидравлические показатели справочные."
                  : "Используется режим с ограниченной доступной мощностью и расчётом непокрытой нагрузки."
              }
              options={[
                { value: "ideal", label: "Идеальный режим" },
                { value: "capacityLimited", label: "Ограниченная мощность" },
              ]}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.heatingMode = (next ?? "ideal") as "ideal" | "capacityLimited";
              })}
            />
            <NumberInputField
              label="Температура подачи"
              value={scenario.engineeringSystems?.supplyTemperatureC ?? null}
              unit="°C"
              source={scenarioFieldSource(rawEngineering?.supplyTemperatureC != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.supplyTemperatureC = next;
              })}
            />
            <NumberInputField
              label="Температура обратки"
              value={scenario.engineeringSystems?.returnTemperatureC ?? null}
              unit="°C"
              source={scenarioFieldSource(rawEngineering?.returnTemperatureC != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.returnTemperatureC = next;
              })}
            />
            <NumberInputField
              label="Массовый расход теплоносителя"
              value={scenario.engineeringSystems?.massFlowKgS ?? null}
              unit="кг/с"
              source={scenarioFieldSource(rawEngineering?.massFlowKgS != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.massFlowKgS = next;
              })}
            />
            <SelectField
              label="Тип теплоносителя"
              value={scenario.engineeringSystems?.fluidType ?? "water"}
              source={scenarioFieldSource(Boolean(rawEngineering?.fluidType))}
              options={[
                { value: "water", label: "вода" },
                { value: "glycol", label: "водно-гликолевая смесь" },
                { value: "other", label: "другой" },
              ]}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.fluidType = (next ?? "water") as "water" | "glycol" | "other";
              })}
            />
            <NumberInputField
              label="Установленная мощность"
              value={scenario.engineeringSystems?.installedCapacityW ?? null}
              unit="Вт"
              source={scenarioFieldSource(rawEngineering?.installedCapacityW != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.installedCapacityW = next;
              })}
            />
            <TextInputField
              label="Тип прибора"
              value={scenario.engineeringSystems?.emitterType ?? ""}
              source={scenarioFieldSource(Boolean(rawEngineering?.emitterType))}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.emitterType = next.trim() || null;
              })}
            />
            <NumberInputField
              label="Диаметр трубы"
              value={scenario.engineeringSystems?.pipeDiameterMm ?? null}
              unit="мм"
              source={scenarioFieldSource(rawEngineering?.pipeDiameterMm != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.pipeDiameterMm = next;
              })}
            />
            <NumberInputField
              label="Длина трубы"
              value={scenario.engineeringSystems?.pipeLengthM ?? null}
              unit="м"
              source={scenarioFieldSource(rawEngineering?.pipeLengthM != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.pipeLengthM = next;
              })}
            />
            <ToggleField
              label="Труба изолирована"
              checked={scenario.engineeringSystems?.pipeInsulated ?? false}
              source={scenarioFieldSource(rawEngineering?.pipeInsulated != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.pipeInsulated = next;
              })}
            />
            <NumberInputField
              label="Температура теплоносителя в трубе"
              value={scenario.engineeringSystems?.pipeFluidTemperatureC ?? null}
              unit="°C"
              source={scenarioFieldSource(rawEngineering?.pipeFluidTemperatureC != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.pipeFluidTemperatureC = next;
              })}
            />
          </div>
          <div className="grid gap-3">
            {dataReport.sections.engineeringNetworks.computedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </SectionShell>
      </div>

      <div id="data-section-ecology" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.ecology}
        description="Пользователь задаёт источник энергии и коэффициент выбросов. CO₂ считается автоматически только если есть валидный EF и результат расчёта."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Источник энергии"
              value={scenario.ecology?.energySource ?? null}
              source={scenarioFieldSource(Boolean(rawEcology?.energySource))}
              options={[
                { value: "", label: "не выбран" },
                { value: "electricity", label: "Электроэнергия" },
                { value: "централизованное теплоснабжение", label: "Централизованное теплоснабжение" },
                { value: "natural_gas", label: "Природный газ" },
              ]}
              onChange={(next) => updateScenario((draft) => {
                draft.ecology = draft.ecology ?? {};
                draft.ecology.energySource = next;
              })}
            />
            <NumberInputField
              label="Удельный коэффициент выбросов CO₂"
              value={scenario.ecology?.emissionFactorKgPerKWh ?? null}
              unit="кг CO₂/кВт·ч"
              source={scenarioFieldSource(rawEcology?.emissionFactorKgPerKWh != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.ecology = draft.ecology ?? {};
                draft.ecology.emissionFactorKgPerKWh = next;
              })}
            />
          </div>
          <div className="grid gap-3">
            {dataReport.sections.ecology.computedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </SectionShell>
      </div>

      <div id="data-section-economy" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.economy}
        description="Вкладка хранит исходные экономические параметры. Derived preview не подменяет отдельный контур экономики и явно помечен как оценочный."
      >
        <SectionWarnings warnings={dataReport.sections.economy.warnings} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <NumberInputField
              label="Тариф"
              value={scenario.economy?.tariffRubPerKWh ?? null}
              unit="руб/кВт·ч"
              source={scenarioFieldSource(rawEconomy?.tariffRubPerKWh != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.tariffRubPerKWh = next;
              })}
            />
            <NumberInputField
              label="CAPEX мероприятий"
              value={scenario.economy?.capexRub ?? null}
              unit="руб"
              source={scenarioFieldSource(rawEconomy?.capexRub != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.capexRub = next;
              })}
            />
            <NumberInputField
              label="Период анализа"
              value={scenario.economy?.analysisPeriodYears ?? null}
              unit="лет"
              source={scenarioFieldSource(rawEconomy?.analysisPeriodYears != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.analysisPeriodYears = next;
              })}
            />
            <NumberInputField
              label="Ставка дисконтирования"
              value={scenario.economy?.discountRatePercent ?? null}
              unit="%"
              source={scenarioFieldSource(rawEconomy?.discountRatePercent != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.discountRatePercent = next;
              })}
            />
            <NumberInputField
              label="Рост тарифа"
              value={scenario.economy?.annualTariffGrowthPercent ?? null}
              unit="%"
              source={scenarioFieldSource(rawEconomy?.annualTariffGrowthPercent != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.annualTariffGrowthPercent = next;
              })}
            />
            <NumberInputField
              label="Стоимость обслуживания"
              value={scenario.economy?.annualMaintenanceCostRub ?? null}
              unit="руб/год"
              source={scenarioFieldSource(rawEconomy?.annualMaintenanceCostRub != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.annualMaintenanceCostRub = next;
              })}
            />
            <NumberInputField
              label="Стоимость утепления"
              value={scenario.economy?.insulationCostRub ?? null}
              unit="руб"
              source={scenarioFieldSource(rawEconomy?.insulationCostRub != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.insulationCostRub = next;
              })}
            />
            <NumberInputField
              label="Стоимость окон"
              value={scenario.economy?.windowsCostRub ?? null}
              unit="руб"
              source={scenarioFieldSource(rawEconomy?.windowsCostRub != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.windowsCostRub = next;
              })}
            />
            <NumberInputField
              label="Стоимость оборудования"
              value={scenario.economy?.equipmentCostRub ?? null}
              unit="руб"
              source={scenarioFieldSource(rawEconomy?.equipmentCostRub != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.equipmentCostRub = next;
              })}
            />
          </div>
          <div className="grid gap-3">
            {dataReport.sections.economy.computedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </SectionShell>
      </div>

      <div id="data-section-validation" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.validation}
        description="Валидация требует корректную связку помещения датчика и меток времени. Без неё метрики MBE/CVRMSE/RMSE_T не рассчитываются."
      >
        <SectionWarnings warnings={dataReport.sections.validation.warnings} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Помещение датчика"
              value={scenario.validation?.roomId ?? null}
              source={scenarioFieldSource(Boolean(rawValidation?.roomId))}
              options={[
                { value: "", label: "не выбран" },
                ...buildModel.rooms.map((room) => ({ value: room.id, label: room.name })),
              ]}
              onChange={(next) => updateScenario((draft) => {
                draft.validation = draft.validation ?? { measuredSeries: [] };
                draft.validation.roomId = next;
              })}
            />
            <TextInputField
              label="Период измерений"
              value={scenario.validation?.periodLabel ?? ""}
              source={scenarioFieldSource(Boolean(rawValidation?.periodLabel))}
              onChange={(next) => updateScenario((draft) => {
                draft.validation = draft.validation ?? { measuredSeries: [] };
                draft.validation.periodLabel = next.trim() || null;
              })}
            />
            <NumberInputField
              label="Фактическое потребление энергии"
              value={scenario.validation?.measuredEnergyKWh ?? null}
              unit="кВт·ч"
              source={scenarioFieldSource(rawValidation?.measuredEnergyKWh != null)}
              onChange={(next) => updateScenario((draft) => {
                draft.validation = draft.validation ?? { measuredSeries: [] };
                draft.validation.measuredEnergyKWh = next;
              })}
            />
            <TextAreaField
              label="История температуры: метка времени, значение"
              value={validationSeriesText}
              rows={8}
              source={scenarioFieldSource(Boolean(rawValidation?.measuredSeries?.length))}
              warning={
                validationSeriesErrors > 0
                  ? `Не распознано строк: ${validationSeriesErrors}. Ожидается формат "2026-01-15T06:00:00Z, 21.4".`
                  : null
              }
              placeholder="2026-01-15T06:00:00Z, 21.4"
              onChange={(next) => {
                setValidationSeriesText(next);
                const parsed = parseValidationSeries(next);
                setValidationSeriesErrors(parsed.invalidLines);
                updateScenario((draft) => {
                  draft.validation = draft.validation ?? { measuredSeries: [] };
                  draft.validation.measuredSeries = parsed.points;
                });
              }}
            />
          </div>
          <div className="grid gap-3">
            {dataReport.sections.validation.computedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </SectionShell>
      </div>

      <div id="data-section-reports" className="scroll-mt-24">
      <SectionShell
        title={SECTION_TITLES.reports}
        description="Реквизиты проекта для существующего экспортного и экспертного контура. Эти поля не меняют solver, но участвуют в полноте документов."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),24rem]">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInputField
              label="Название объекта"
              value={reportInputSnapshot.projectName}
              source={reportInputSnapshot.projectName ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "projectName", next)}
            />
            <TextInputField
              label="Адрес"
              value={reportInputSnapshot.objectAddress}
              source={reportInputSnapshot.objectAddress ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "objectAddress", next)}
            />
            <TextInputField
              label="Заказчик"
              value={reportInputSnapshot.customerOrg}
              source={reportInputSnapshot.customerOrg ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "customerOrg", next)}
            />
            <TextInputField
              label="Проектировщик"
              value={reportInputSnapshot.developerOrg}
              source={reportInputSnapshot.developerOrg ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "developerOrg", next)}
            />
            <TextInputField
              label="Стадия"
              value={reportInputSnapshot.documentStage}
              source={reportInputSnapshot.documentStage ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "documentStage", next)}
            />
            <TextInputField
              label="Год"
              value={reportInputSnapshot.issueYear}
              source={reportInputSnapshot.issueYear ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "issueYear", next)}
            />
            <TextInputField
              label="Нормативная база / основание"
              value={reportInputSnapshot.designBasis}
              source={reportInputSnapshot.designBasis ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "designBasis", next)}
            />
            <TextInputField
              label="Разработал"
              value={reportInputSnapshot.developedBy}
              source={reportInputSnapshot.developedBy ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "developedBy", next)}
            />
            <TextInputField
              label="Проверил"
              value={reportInputSnapshot.checkedBy}
              source={reportInputSnapshot.checkedBy ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "checkedBy", next)}
            />
            <TextInputField
              label="ГИП"
              value={reportInputSnapshot.chiefEngineer}
              source={reportInputSnapshot.chiefEngineer ? "user" : "missing"}
              onChange={(next) => setReportField(projectKey, "chiefEngineer", next)}
            />
            <TextAreaField
              label="Пояснения / допущения"
              value={reportInputSnapshot.modelNote}
              source={reportInputSnapshot.modelNote ? "user" : "missing"}
              rows={5}
              onChange={(next) => setReportField(projectKey, "modelNote", next)}
            />
            {/* Temporarily hidden from UI. Will be restored after project documentation export redesign. */}
            {/* {EXPERTISE_INPUT_SECTIONS.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4 md:col-span-2">
                <p className="text-sm font-semibold text-[color:var(--text-base)]">Полный комплект полей отчёта</p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Остальные реквизиты доступны в существующем контуре документов; здесь выведены основные поля инженерной полноты.
                </p>
              </div>
            ) : null} */}
          </div>
          <div className="grid gap-3">
            {dataReport.sections.reports.computedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </SectionShell>
      </div>

      <ActionBar>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Дальше: расчёт</p>
          <p className="text-sm text-[color:var(--text-muted)]">
            После заполнения исходных данных переходите к расчёту. Все автоматически вычисляемые показатели останутся read-only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate("/model")} className="ui-btn-secondary px-4 py-2 text-sm">
            Открыть модель
          </button>
          <button type="button" onClick={() => navigate("/calculation")} className="ui-btn-primary px-4 py-2 text-sm">
            Перейти к расчёту
          </button>
        </div>
      </ActionBar>
        </>
      )}
    </section>
  );
}

export default ScenariosWorkspacePage;
