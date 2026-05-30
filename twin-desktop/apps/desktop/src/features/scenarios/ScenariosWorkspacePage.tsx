import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  AutoCalculatedSourceIcon,
  AUTO_CALCULATED_SOURCE_LABEL,
  Badge,
  EngineeringCallout,
  isAutoCalculatedDataSource,
  isModelDataSource,
  FormulaTooltip,
  ModelSourceIcon,
  MODEL_SOURCE_LABEL,
  SectionShell,
  SelectDropdown,
  type SelectDropdownOption,
  WorkspacePageHeader,
} from "../../shared/ui";
import { getSourceFieldFormulaInfo } from "./sourceFieldFormulaInfo";
import { formatNumber } from "../../shared/utils/format";
import { aggregateEnvelopeBridgeConductances } from "../../demo/deriveExteriorWallThermalBridges";
import { isCanonicalDemoProjectModel } from "../../shared/utils/demoProject";
import {
  applyDefaultOpeningEnvelopeToModel,
  setModelBridgeConductance,
  setModelOpeningUValues,
  setModelOpticalFactors,
} from "../../shared/utils/openingThermalData";
import { getResultSyncState } from "../../shared/utils/modelSync";
import { useBuildStore } from "../build/build.store";
import { doesBuildModelMatchProject, hasBuildGeometry } from "../project/projectSummary";
import {
  applySp131ClimateToModel,
  inferSp131CityIdFromClimate,
} from "../../core/thermal/climate/ensureModelClimate";
import { getSp131CityClimate, sp131CitySelectOptions } from "../../norms/sp131_2025/climate";
import {
  resolveScenarioEnvelopeLeakageInputs,
  type ResolvedLeakageScalar,
} from "../../core/thermal/ventilation/resolveScenarioEnvelopeLeakage";
import {
  resolveScenarioVentilationInputs,
  type VentilationInputSource,
} from "../../core/thermal/ventilation/resolveScenarioVentilation";
import {
  resolveScenarioEngineeringInputs,
  type EngineeringInputSource,
} from "../../core/thermal/engineering/resolveScenarioEngineering";
import { calculateRequiredHydronicMassFlow } from "../../core/thermal/formulas";
import {
  buildSourceDataWorkspaceReport,
  prepareModelForSourceData,
  type SourceDataField,
  type SourceDataOrigin,
} from "../../core/thermal/derived/sourceDataWorkspace";
import {
  applyOccupancyPresetToConfig,
  isOccupancyControlledByPreset,
  markOccupancyAsCustom,
  occupancyPresetFromBuildingCategory,
  OCCUPANCY_PRESET_OPTIONS,
  resolveOccupancyPresetSelection,
  type OccupancyPresetId,
} from "../../core/thermal/occupancyPresets";
import {
  applyModelIndoorSetpointsToConfig,
  modelIndoorDesignTemperatureC,
  resolveDaySetpointScalar,
  resolveNightSetpointScalar,
  suggestedNightSetpointC,
} from "../../core/thermal/resolveScenarioSetpoints";
import { BUILDING_CATEGORIES } from "../../norms/sp50_2024/buildingCategories";
import {
  resolveScenarioEcologyEmissionFactor,
  syncEcologyEmissionFactorOnEnergySourceChange,
  type EcologyEmissionFactorSource,
} from "../../core/economics/resolveScenarioEcologyEmission";
import {
  resolvedEconomyDisplayValue,
  resolveScenarioEconomy,
  type EconomyFieldSource,
} from "../../core/economics/resolveScenarioEconomy";
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
  { id: "engineeringNetworks", anchor: "data-section-engineering", label: SECTION_TITLES.engineeringNetworks },
  { id: "ecology", anchor: "data-section-ecology", label: SECTION_TITLES.ecology },
  { id: "economy", anchor: "data-section-economy", label: SECTION_TITLES.economy },
  { id: "validation", anchor: "data-section-validation", label: SECTION_TITLES.validation },
  { id: "reports", anchor: "data-section-reports", label: SECTION_TITLES.reports },
] as const;

type ScenarioSectionId = (typeof SECTION_NAV_ITEMS)[number]["id"];

type ScenarioSectionShellProps = {
  sectionId: ScenarioSectionId;
  expandedSections: Set<ScenarioSectionId>;
  onSectionExpandedChange: (sectionId: ScenarioSectionId, expanded: boolean) => void;
  title: string;
  description?: string;
  kicker?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

function ScenarioSectionShell({
  sectionId,
  expandedSections,
  onSectionExpandedChange,
  ...props
}: ScenarioSectionShellProps) {
  return (
    <SectionShell
      {...props}
      collapsible
      open={expandedSections.has(sectionId)}
      onOpenChange={(open) => onSectionExpandedChange(sectionId, open)}
    />
  );
}

const FIELD_DISPLAY_META: Record<string, { title: string; caption?: string }> = {
  "geometry.envelope-area": { title: "Площадь наружной оболочки", caption: "A_env" },
  "geometry.wwr": { title: "Доля остекления фасада", caption: "WWR = A_win / A_facade" },
  "geometry.compactness": { title: "Коэффициент компактности здания", caption: "K_compact = A_env / V_h" },
  "materials.window-u": { title: "Коэффициент теплопередачи окна" },
  "materials.door-u": { title: "Коэффициент теплопередачи двери" },
  "materials.window-g": { title: "Солнечный фактор окна" },
  "materials.shading-factor": { title: "Коэффициент затенения" },
  "materials.homogeneity-coefficient": { title: "Коэффициент однородности r" },
  "materials.u-eq": { title: "Эквивалентный коэффициент теплопередачи Uэкв" },
  "materials.h-tr": { title: "Коэффициент теплопотерь через ограждения Htr" },
  "materials.h-total": { title: "Суммарный коэффициент теплопотерь" },
  "materials.q-tr": { title: "Теплопотери через ограждения при расчётной ΔT" },
  "materials.h-psi": { title: "Линейные мостики холода" },
  "materials.h-chi": { title: "Точечные мостики холода" },
  "materials.q-bridges": { title: "Потери через мостики холода" },
  "operation.peak-load": { title: "Пиковая нагрузка отопления", caption: "peakLoadKW" },
  "operation.total-energy": { title: "Энергопотребление за расчётный период", caption: "totalEnergyKWh" },
  "operation.degree-hours-underheat": { title: "Градусо-часы недотопа", caption: "DH_underheat" },
  "operation.degree-hours-overheat": { title: "Градусо-часы перегрева", caption: "DH_overheat" },
  "operation.underheating-hours": { title: "Часы недотопа", caption: "underheatingHours" },
  "operation.overheating-hours": { title: "Часы перегрева", caption: "overheatingHours" },
  "operation.total-discomfort-hours": { title: "Суммарные часы дискомфорта", caption: "totalDiscomfortHours" },
  "climate.gsop": { title: "ГСОП", caption: "GSOP = (T_in - T_ot.avg) * z_ot" },
  "climate.deltaT": { title: "Расчётная разность температур", caption: "ΔT = T_in - T_out" },
  "air.total-volume": { title: "Отапливаемый объём" },
  "air.envelope-opaque-area": { title: "Площадь непрозрачного ограждения" },
  "air.window-perimeter": { title: "Периметр окон" },
  "air.door-perimeter": { title: "Периметр дверей" },
  "air.stack-height": { title: "Высота для теплового напора" },
  "air.g-envelope": { title: "Воздухопроницаемость ограждений G_air" },
  "air.g-window": { title: "Воздухопроницаемость окон G_air" },
  "air.g-door": { title: "Воздухопроницаемость дверей G_air" },
  "air.pressure-exponent": { title: "Показатель степени n" },
  "air.heat-recovery": { title: "КПД рекуперации" },
  "air.infiltration-mode": { title: "Режим инфильтрации" },
  "air.infiltration-source": { title: "Источник кратности инфильтрации" },
  "air.infiltration-ach": { title: "Кратность инфильтрации" },
  "air.ventilation-ach": { title: "Кратность механической вентиляции" },
  "air.infiltration-flow": { title: "Расход инфильтрации" },
  "air.ventilation-flow": { title: "Расход механической вентиляции" },
  "air.pressure-wind": { title: "Ветровой перепад давления" },
  "air.pressure-stack": { title: "Перепад давления от теплового напора" },
  "air.pressure-total": { title: "Суммарный перепад давления" },
  "air.q-inf": { title: "Теплопотери на инфильтрацию" },
  "air.q-vent-before": { title: "Теплопотери вентиляции до рекуперации" },
  "air.q-vent-after": { title: "Теплопотери вентиляции после рекуперации" },
  "air.saved-by-recovery": { title: "Экономия за счёт рекуперации" },
  "air.h-inf": { title: "Коэффициент теплопотерь инфильтрации" },
  "air.h-vent-before": { title: "Коэффициент теплопотерь вентиляции до рекуперации" },
  "air.h-vent": { title: "Коэффициент теплопотерь вентиляции" },
  "air.h-total": { title: "Суммарный коэффициент теплопотерь воздухообмена" },
  "humidity.rh": { title: "Относительная влажность" },
  "humidity.dew-point": { title: "Точка росы" },
  "humidity.surface-temp": { title: "Минимальная температура внутренней поверхности" },
  "humidity.f-rsi": { title: "Температурный фактор внутренней поверхности" },
  "humidity.condensation-margin": { title: "Запас до точки росы" },
  "humidity.condensation-status": { title: "Статус поверхности" },
  "humidity.comfort-min": { title: "Минимально допустимая температура" },
  "humidity.comfort-max": { title: "Максимально допустимая температура" },
  "humidity.mrt": { title: "Средняя радиационная температура" },
  "humidity.t-op": { title: "Оперативная температура" },
  "engineering.delta-t": { title: "ΔT теплоносителя" },
  "engineering.hydronic-capacity": { title: "Гидравлическая мощность отопления" },
  "engineering.required-mass-flow": { title: "Требуемый массовый расход теплоносителя" },
  "engineering.required-volume-flow": { title: "Требуемый объёмный расход теплоносителя" },
  "engineering.pipe-count": { title: "Количество трубных участков" },
  "engineering.pipe-total-length": { title: "Суммарная длина труб" },
  "engineering.pipe-diameter": { title: "Диаметры труб в модели" },
  "engineering.pipe-insulation": { title: "Теплоизоляция труб" },
  "engineering.peak-unmet-load": { title: "Непокрытая пиковая нагрузка" },
  "engineering.unmet-energy": { title: "Непокрытая энергия" },
  "ecology.ef": { title: "Удельный коэффициент выбросов CO₂", caption: "emissionFactorKgPerKWh" },
  "validation.room": { title: "Помещение датчика", caption: "roomId" },
  "validation.period": { title: "Период измерений", caption: "timestamp range" },
};

function getFieldDisplayMeta(field: SourceDataField): { title: string; caption?: string } {
  const meta = FIELD_DISPLAY_META[field.key];
  if (!meta) {
    return { title: field.label };
  }
  return {
    title: meta.title,
    caption: meta.caption,
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

function occupancyOperationFieldSource(
  rawScenarioConfig: ScenarioConfig | null | undefined,
  hasExplicitScalar: boolean
): SourceDataOrigin {
  if (isOccupancyControlledByPreset(rawScenarioConfig)) {
    return "sp50";
  }
  return scenarioFieldSource(hasExplicitScalar, "scenario");
}

function ventilationInputSourceToOrigin(source: VentilationInputSource): SourceDataOrigin {
  switch (source) {
    case "user":
      return "scenario";
    case "model":
      return "model";
    case "calculated":
      return "calculated";
    default:
      return "fallback";
  }
}

function engineeringInputSourceToOrigin(source: EngineeringInputSource): SourceDataOrigin {
  switch (source) {
    case "user":
      return "scenario";
    case "model":
      return "model";
    case "result":
      return "result";
    case "calculated":
      return "calculated";
    default:
      return "fallback";
  }
}

function ecologyEmissionSourceToOrigin(source: EcologyEmissionFactorSource): SourceDataOrigin {
  switch (source) {
    case "user":
      return "scenario";
    case "norm":
      return "calculated";
    default:
      return "missing";
  }
}

function economyFieldSourceToOrigin(source: EconomyFieldSource, hasCity: boolean): SourceDataOrigin {
  switch (source) {
    case "user":
      return "scenario";
    case "norm":
      return hasCity ? "sp131" : "fallback";
    case "estimated":
      return "calculated";
    default:
      return "missing";
  }
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
      return MODEL_SOURCE_LABEL;
    case "user":
    case "scenario":
      return "задано пользователем";
    case "calculated":
    case "result":
      return AUTO_CALCULATED_SOURCE_LABEL;
    case "sp50":
      return "из СП 50";
    case "sp131":
      return "из СП 131";
    case "fallback":
      return "типовое значение";
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
    case "manualAch":
      return "Ручной ввод";
    case "envelopeLeakage":
      return "По воздухопроницаемости ограждений";
    case "pressureBased":
      return "По перепаду давления";
    case "manual":
      return "Задано вручную";
    case "calculated":
      return "Расчёт по модели";
    case "fallback":
      return "Резервное значение";
    default:
      return value;
  }
}

const AIR_COMPUTED_FIELD_ORDER = [
  "air.total-volume",
  "air.envelope-opaque-area",
  "air.window-perimeter",
  "air.door-perimeter",
  "air.stack-height",
  "air.g-envelope",
  "air.g-window",
      "air.g-door",
      "air.pressure-exponent",
      "air.heat-recovery",
      "air.infiltration-source",
  "air.infiltration-ach",
  "air.infiltration-flow",
  "air.pressure-wind",
  "air.pressure-stack",
  "air.pressure-total",
  "air.q-inf",
  "air.h-inf",
  "air.ventilation-flow",
  "air.q-vent-before",
  "air.q-vent-after",
  "air.saved-by-recovery",
  "air.h-vent-before",
  "air.h-vent",
  "air.h-total",
] as const;

function formatFieldValue(field: SourceDataField): string {
  const { value, unit } = field;
  if (value === null || value === "") {
    return NO_DATA;
  }
  if (typeof value === "number") {
    const abs = Math.abs(value);
    const formatted =
      abs > 0 && abs < 0.01
        ? formatNumber(value, { maximumSignificantDigits: 3 })
        : abs >= 1000
          ? formatNumber(value, { maximumFractionDigits: 0 })
          : abs >= 100
            ? formatNumber(value, { maximumFractionDigits: 1 })
            : abs >= 10
              ? formatNumber(value, { maximumFractionDigits: 2 })
              : formatNumber(value, { maximumFractionDigits: 3 });
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

function SourceBadge({
  origin,
  demoMode = false,
  formulaFieldKey,
}: {
  origin: SourceDataOrigin;
  demoMode?: boolean;
  formulaFieldKey?: string;
}) {
  const label = sourceLabel(origin, demoMode);
  const formulaInfo =
    formulaFieldKey &&
    (isAutoCalculatedDataSource(origin) || isModelDataSource(origin))
      ? getSourceFieldFormulaInfo(formulaFieldKey)
      : undefined;

  const wrapWithFormulaTooltip = (badge: ReactNode) => {
    if (!formulaInfo) {
      return badge;
    }
    return (
      <FormulaTooltip
        title={formulaInfo.title}
        meaning={formulaInfo.meaning}
        formula={formulaInfo.formula}
        inputs={formulaInfo.inputs}
        notes={formulaInfo.notes}
        linkedFormulaIds={formulaInfo.linkedFormulaIds}
        className="inline-flex shrink-0"
      >
        {badge}
      </FormulaTooltip>
    );
  };

  if (isAutoCalculatedDataSource(origin)) {
    return wrapWithFormulaTooltip(
      <Badge
        tone={sourceTone(origin)}
        className="ui-build-badge--icon-only"
        title={formulaInfo ? undefined : label}
      >
        <AutoCalculatedSourceIcon size={20} />
      </Badge>
    );
  }
  if (isModelDataSource(origin)) {
    return wrapWithFormulaTooltip(
      <Badge tone={sourceTone(origin)} className="ui-build-badge--icon-only" title={formulaInfo ? undefined : label}>
        <ModelSourceIcon size={20} />
      </Badge>
    );
  }
  return <Badge tone={sourceTone(origin)}>{label}</Badge>;
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
      <SourceBadge origin={field.source} demoMode={demoMode} formulaFieldKey={field.key} />
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
        </div>
        {showSourceBadge ? (
          <SourceBadge origin={field.source} demoMode={demoMode} formulaFieldKey={field.key} />
        ) : null}
      </div>
      <p className="mt-4 text-lg font-semibold text-[color:var(--text-base)]">
        {formatFieldValue(field)}
      </p>
    </div>
  );
}

function ResolvedLeakageField({
  label,
  unit,
  scalar,
  formulaFieldKey,
  demoMode,
  computedField,
  onChange,
}: {
  label: string;
  unit?: string;
  scalar: ResolvedLeakageScalar;
  formulaFieldKey?: string;
  demoMode: boolean;
  computedField?: SourceDataField;
  onChange: (next: number | null) => void;
}) {
  if (!scalar.explicit && computedField) {
    return <ReadOnlyFieldCard field={computedField} demoMode={demoMode} />;
  }
  const permeabilityStep = unit?.includes("м³/(с·м") ? 0.000001 : undefined;
  return (
    <NumberInputField
      label={label}
      value={scalar.value}
      unit={unit}
      step={permeabilityStep}
      source={ventilationInputSourceToOrigin(scalar.source)}
      formulaFieldKey={formulaFieldKey}
      onChange={onChange}
    />
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
  showSourceBadge = true,
  formulaFieldKey,
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
  showSourceBadge?: boolean;
  formulaFieldKey?: string;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--text-base)]">{label}</span>
        {showSourceBadge ? <SourceBadge origin={source} formulaFieldKey={formulaFieldKey} /> : null}
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
  showSourceBadge = true,
}: {
  label: string;
  value: string | null | undefined;
  source: SourceDataOrigin;
  warning?: string | null;
  onChange: (next: string) => void;
  placeholder?: string;
  showSourceBadge?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--text-base)]">{label}</span>
        {showSourceBadge ? <SourceBadge origin={source} /> : null}
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

const INFILTRATION_MODE_OPTIONS: SelectDropdownOption[] = [
  {
    value: "manualAch",
    label: "Ручной ввод",
    description: "Кратность воздухообмена задаётся вручную",
  },
  {
    value: "envelopeLeakage",
    label: "По воздухопроницаемости ограждений",
    description: "Расчёт по характеристикам утечек ограждающих конструкций",
  },
  {
    value: "pressureBased",
    label: "По перепаду давления",
    description: "Ветер, тепловой напор и суммарный ΔP",
  },
];

function SelectField({
  label,
  value,
  source,
  warning,
  options,
  onChange,
  showSourceBadge = true,
  formulaFieldKey,
}: {
  label: string;
  value: string | null | undefined;
  source: SourceDataOrigin;
  warning?: string | null;
  options: SelectDropdownOption[];
  onChange: (next: string | null) => void;
  showSourceBadge?: boolean;
  formulaFieldKey?: string;
}) {
  return (
    <div className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--text-base)]">{label}</span>
        {showSourceBadge ? <SourceBadge origin={source} formulaFieldKey={formulaFieldKey} /> : null}
      </div>
      <SelectDropdown
        value={value ?? ""}
        options={options}
        onChange={(next) => onChange(next || null)}
      />
      {warning ? <p className="text-xs text-[color:var(--warning-fg)]">{warning}</p> : null}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  source,
  warning,
  onChange,
  showSourceBadge = true,
}: {
  label: string;
  checked: boolean;
  source: SourceDataOrigin;
  warning?: string | null;
  onChange: (next: boolean) => void;
  showSourceBadge?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-4 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[color:var(--text-base)]">{label}</p>
        {warning ? <p className="text-xs text-[color:var(--warning-fg)]">{warning}</p> : null}
        {showSourceBadge ? <SourceBadge origin={source} /> : null}
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
  const solarTime = useBuildStore((state) => state.solarTime);
  const projectKey = useBuildStore((state) => state.projectKey);
  const modelRevision = useBuildStore((state) => state.modelRevision);
  const setBuildSelection = useBuildStore((state) => state.setSelection);
  const loadModelSnapshot = useBuildStore((state) => state.loadModelSnapshot);
  const lastThermalResult = useTwinStore((state) => state.lastThermalResult);
  const lastThermalResultBinding = useTwinStore((state) => state.lastThermalResultBinding);
  const rawScenarioConfig = useWorkflowStore((state) => state.scenarioConfig);
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
  const [expandedSections, setExpandedSections] = useState<Set<ScenarioSectionId>>(
    () => new Set(SECTION_NAV_ITEMS.map((item) => item.id))
  );

  const handleSectionExpandedChange = (sectionId: ScenarioSectionId, expanded: boolean) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (expanded) {
        next.add(sectionId);
      } else {
        next.delete(sectionId);
      }
      return next;
    });
  };

  const sectionShellProps = {
    expandedSections,
    onSectionExpandedChange: handleSectionExpandedChange,
  };

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
  const strictModelForData = useMemo(() => {
    const prepared = prepareModelForSourceData(strictModel, rawScenarioConfig);
    return applyDefaultOpeningEnvelopeToModel(prepared);
  }, [rawScenarioConfig, strictModel]);
  const occupancyPresetSelection = useMemo(
    () => resolveOccupancyPresetSelection(rawScenarioConfig, scenario),
    [rawScenarioConfig, scenario]
  );
  const modelBuildingCategory = strictModelForData.thermalProtection?.buildingCategory ?? null;
  const suggestedOccupancyPreset = occupancyPresetFromBuildingCategory(modelBuildingCategory);
  const modelIndoorDesignC = modelIndoorDesignTemperatureC(strictModelForData);
  const daySetpointScalar = useMemo(
    () => resolveDaySetpointScalar(rawScenarioConfig, scenario, strictModelForData),
    [rawScenarioConfig, scenario, strictModelForData]
  );
  const nightSetpointScalar = useMemo(
    () => resolveNightSetpointScalar(rawScenarioConfig, scenario, strictModelForData),
    [rawScenarioConfig, scenario, strictModelForData]
  );
  const setpointsMatchModelIndoor =
    modelIndoorDesignC != null &&
    (Math.abs(scenario.setpoints.day - modelIndoorDesignC) > 1e-4 ||
      Math.abs(scenario.setpoints.night - suggestedNightSetpointC(modelIndoorDesignC)) > 1e-4);

  const currentThermalResult = thermalResultState === "current" ? lastThermalResult : null;
  const reportInputSnapshot = useMemo(
    () => reportInputs ?? getReportInputs(projectKey),
    [getReportInputs, projectKey, reportInputs]
  );
  const dataReportResult = useMemo(() => {
    try {
      return {
        ok: true as const,
        report: buildSourceDataWorkspaceReport({
          model: strictModelForData,
          scenarioConfig: rawScenarioConfig,
          thermalResult: currentThermalResult,
          reportInputs: reportInputSnapshot,
          solarTime,
        }),
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[source-data] buildSourceDataWorkspaceReport failed", error);
      }
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : "Не удалось собрать данные для расчёта.",
      };
    }
  }, [currentThermalResult, rawScenarioConfig, reportInputSnapshot, solarTime, strictModelForData]);

  const hasModel = strictModel.rooms.length > 0 || strictModel.walls.length > 0;
  const isDemoProject = isCanonicalDemoProjectModel(strictModel);
  const scrollToSection = (anchor: string) => {
    if (typeof document === "undefined") {
      return;
    }
    const navItem = SECTION_NAV_ITEMS.find((item) => item.anchor === anchor);
    if (navItem) {
      handleSectionExpandedChange(navItem.id, true);
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
  const rawEngineering = rawScenarioConfig?.engineeringSystems;
  const rawEcology = rawScenarioConfig?.ecology;
  const resolvedEcologyEmission = useMemo(
    () => resolveScenarioEcologyEmissionFactor(rawScenarioConfig),
    [rawScenarioConfig]
  );
  const resolvedEconomy = useMemo(
    () => resolveScenarioEconomy(rawScenarioConfig, strictModelForData),
    [rawScenarioConfig, strictModelForData]
  );
  const rawEconomy = rawScenarioConfig?.economy;
  const rawValidation = rawScenarioConfig?.validation;
  const envelopeBridgePreview = useMemo(
    () => aggregateEnvelopeBridgeConductances(strictModelForData),
    [strictModelForData]
  );
  const resolvedVentilation = useMemo(
    () => resolveScenarioVentilationInputs(rawScenarioConfig, scenario, strictModelForData, { dayOfYear: solarTime?.dayOfYear }),
    [rawScenarioConfig, scenario, strictModelForData, solarTime?.dayOfYear]
  );
  const resolvedLeakage = useMemo(
    () => resolveScenarioEnvelopeLeakageInputs(rawScenarioConfig, scenario, strictModelForData),
    [rawScenarioConfig, scenario, strictModelForData]
  );
  const defaultVentilation = useMemo(() => createDefaultScenarioConfig().ventilation, []);
  const infiltrationMode = scenario.ventilation.infiltrationMode ?? defaultVentilation.infiltrationMode ?? "envelopeLeakage";
  const resolvedEngineering = useMemo(() => {
    const requiredPowerW =
      currentThermalResult?.summary.peakLoadKW != null ? currentThermalResult.summary.peakLoadKW * 1000 : null;
    const provisionalDeltaT =
      scenario.engineeringSystems?.supplyTemperatureC != null &&
      scenario.engineeringSystems?.returnTemperatureC != null
        ? scenario.engineeringSystems.supplyTemperatureC - scenario.engineeringSystems.returnTemperatureC
        : 20;
    const provisionalRequiredMassFlowKgS =
      requiredPowerW != null && provisionalDeltaT > 0
        ? calculateRequiredHydronicMassFlow(requiredPowerW, provisionalDeltaT, 4186)
        : null;
    return resolveScenarioEngineeringInputs(
      rawScenarioConfig,
      scenario,
      strictModelForData,
      currentThermalResult,
      provisionalRequiredMassFlowKgS
    );
  }, [currentThermalResult, rawScenarioConfig, scenario, strictModelForData]);

  if (!dataReportResult.ok) {
    return (
      <section className="w-full space-y-5 ui-page-enter">
        <WorkspacePageHeader title="Данные для расчёта" />
        <p className="text-sm text-[color:var(--text-muted)]">Ошибка</p>
      </section>
    );
  }

  const dataReport = dataReportResult.report;
  const matComputedFields = dataReport.sections.materials.computedFields;
  const modelWindowUField = matComputedFields.find((f) => f.key === "materials.window-u");
  const modelDoorUField = matComputedFields.find((f) => f.key === "materials.door-u");
  const modelWindowGField = matComputedFields.find((f) => f.key === "materials.window-g");
  const modelShadingField = matComputedFields.find((f) => f.key === "materials.shading-factor");
  const modelHomogeneityField = matComputedFields.find((f) => f.key === "materials.homogeneity-coefficient");
  const modelHpsiField = matComputedFields.find((f) => f.key === "materials.h-psi");
  const modelHchiField = matComputedFields.find((f) => f.key === "materials.h-chi");
  const bridgeModeField = matComputedFields.find((f) => f.key === "materials.bridge-mode");
  const effectiveBridgeMode =
    typeof bridgeModeField?.value === "string" ? bridgeModeField.value : "disabled";
  const bridgesInEnergyBalance = effectiveBridgeMode === "explicitPsiChi";
  const modelHpsi =
    envelopeBridgePreview.H_psi ??
    (typeof modelHpsiField?.value === "number" ? modelHpsiField.value : null);
  const modelHchi =
    envelopeBridgePreview.H_chi ??
    (typeof modelHchiField?.value === "number" ? modelHchiField.value : null);
  // Поля, которые уже отображаются выше как редактируемые — не дублируем в нижней сетке
  const economyTariffField = dataReport.sections.economy.computedFields.find((field) => field.key === "economy.tariff");
  const economyHeatingSourceField = dataReport.sections.economy.computedFields.find(
    (field) => field.key === "economy.heating-source"
  );
  const EDITABLE_MAT_KEYS = new Set([
    "materials.bridge-mode",
    "materials.window-u",
    "materials.door-u",
    "materials.window-g",
    "materials.shading-factor",
    "materials.h-psi",
    "materials.h-chi",
  ]);
  const climateComputedFields = dataReport.sections.climate.computedFields;
  const climateDesignField = climateComputedFields.find((field) => field.key === "climate.design-outdoor");
  const climateAverageField = climateComputedFields.find((field) => field.key === "climate.heating-average");
  const climateDurationField = climateComputedFields.find((field) => field.key === "climate.heating-duration");
  const airSection = dataReport.sections.airExchange;
  const airFieldByKey = new Map(airSection.computedFields.map((field) => [field.key, field]));
  const airComputedFields = (() => {
    const skipKeys = new Set<string>([
      "air.infiltration-mode",
      "air.ventilation-ach",
      "air.g-envelope",
      "air.g-window",
      "air.g-door",
      "air.pressure-exponent",
      "air.heat-recovery",
      "air.wind-speed",
      "air.wind-cp",
      "air.stack-height",
      "air.mechanical-pressure",
    ]);
    if (infiltrationMode === "envelopeLeakage") {
      skipKeys.add("air.pressure-wind");
      skipKeys.add("air.pressure-stack");
    } else if (infiltrationMode === "manualAch") {
      skipKeys.add("air.pressure-wind");
      skipKeys.add("air.pressure-stack");
      skipKeys.add("air.pressure-total");
    }
    const byKey = new Map(airSection.computedFields.map((field) => [field.key, field]));
    const ordered = AIR_COMPUTED_FIELD_ORDER.filter((key) => !skipKeys.has(key))
      .map((key) => byKey.get(key))
      .filter((field): field is SourceDataField => field != null);
    const orderedKeys = new Set<string>(AIR_COMPUTED_FIELD_ORDER);
    const rest = airSection.computedFields.filter((field) => !orderedKeys.has(field.key) && !skipKeys.has(field.key));
    return [...ordered, ...rest];
  })();
  const infiltrationUsesFallback =
    infiltrationMode === "manualAch" ||
    airSection.computedFields.find((field) => field.key === "air.infiltration-source")?.value === "Резервное значение";
  const engineeringSection = dataReport.sections.engineeringNetworks;
  const engineeringReadonlyKeys = new Set([
    "engineering.heating-enabled",
    "engineering.heating-mode",
    "engineering.supply-temp",
    "engineering.return-temp",
    "engineering.mass-flow",
    "engineering.heat-carrier",
    "engineering.installed-capacity",
  ]);
  const engineeringComputedFields = engineeringSection.computedFields.filter(
    (field) => !engineeringReadonlyKeys.has(field.key)
  );
  const modelClimateCityId = inferSp131CityIdFromClimate(strictModelForData.thermalProtection?.climate);
  const resolvedClimateCityId = rawClimateCityId || modelClimateCityId || "moscow";
  const selectedCityClimate = getSp131CityClimate(resolvedClimateCityId);
  const modelClimate = strictModelForData.thermalProtection?.climate;
  const modelDesignOutdoorC =
    modelClimate?.outdoorDesignTemperatureC ??
    (typeof climateDesignField?.value === "number" ? climateDesignField.value : selectedCityClimate?.outdoorDesignTemperatureC ?? null);
  const modelHeatingAverageC =
    modelClimate?.outdoorHeatingPeriodAverageC ??
    (typeof climateAverageField?.value === "number" ? climateAverageField.value : selectedCityClimate?.outdoorHeatingPeriodAverageC ?? null);
  const modelHeatingDurationDays =
    modelClimate?.heatingPeriodDurationDays ??
    (typeof climateDurationField?.value === "number" ? climateDurationField.value : selectedCityClimate?.heatingPeriodDurationDays ?? null);
  const displayDesignOutdoorC = climateManual?.outdoorDesignTemperatureC ?? modelDesignOutdoorC;
  const displayHeatingAverageC = climateManual?.outdoorHeatingAverageC ?? modelHeatingAverageC;
  const displayHeatingDurationDays = climateManual?.heatingDurationDays ?? modelHeatingDurationDays;
  const EDITABLE_CLIMATE_KEYS = new Set([
    "climate.city",
    "climate.source",
    "climate.design-outdoor",
    "climate.heating-average",
    "climate.heating-duration",
  ]);

  return (
    <section className="w-full space-y-5 ui-page-enter">
      <WorkspacePageHeader title="Данные для расчёта" />

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
      <ScenarioSectionShell
        {...sectionShellProps}
        sectionId="geometry"
        title={SECTION_TITLES.geometry}
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
        ) : null}
      </ScenarioSectionShell>
      </div>

      <div id="data-section-materials" className="scroll-mt-24">
      <ScenarioSectionShell
        {...sectionShellProps}
        sectionId="materials"
        title={SECTION_TITLES.materials}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label="Учёт неоднородностей"
              value={rawMaterials?.bridgeAccountingMode ?? "auto"}
              source={
                rawMaterials?.bridgeAccountingMode != null
                  ? "user"
                  : (dataReport.sections.materials.computedFields.find((f) => f.key === "materials.bridge-mode")
                      ?.source ?? "calculated")
              }
              formulaFieldKey="materials.bridge-mode"
              options={[
                { value: "auto", label: "автоматически (точнее по данным)" },
                { value: "disabled", label: "не учитывать" },
                { value: "homogeneityCoefficient", label: "коэффициент однородности r" },
                { value: "explicitPsiChi", label: "линейные/точечные мостики ψ/χ" },
              ]}
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.materials = draft.materials ?? {};
                  if (next == null || next === "auto") {
                    delete draft.materials.bridgeAccountingMode;
                  } else {
                    draft.materials.bridgeAccountingMode = next as
                      | "disabled"
                      | "homogeneityCoefficient"
                      | "explicitPsiChi";
                  }
                })
              }
            />
            <NumberInputField
              label="Коэффициент однородности r"
              value={
                rawMaterials?.homogeneityCoefficient ??
                (typeof modelHomogeneityField?.value === "number" ? modelHomogeneityField.value : null)
              }
              source={
                rawMaterials?.homogeneityCoefficient != null
                  ? "user"
                  : (modelHomogeneityField?.source ?? "missing")
              }
              formulaFieldKey="materials.homogeneity-coefficient"
              onChange={(next) =>
                updateScenario((draft) => {
                  draft.materials = draft.materials ?? {};
                  draft.materials.homogeneityCoefficient = next;
                })
              }
            />
            <NumberInputField
              label="U окна"
              value={
                rawMaterials?.windowUValue_W_m2K ??
                (typeof modelWindowUField?.value === "number" ? modelWindowUField.value : null)
              }
              unit="Вт/(м²·К)"
              source={rawMaterials?.windowUValue_W_m2K != null ? "user" : (modelWindowUField?.source ?? "fallback")}
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
              value={
                rawMaterials?.doorUValue_W_m2K ??
                (typeof modelDoorUField?.value === "number" ? modelDoorUField.value : null)
              }
              unit="Вт/(м²·К)"
              source={rawMaterials?.doorUValue_W_m2K != null ? "user" : (modelDoorUField?.source ?? "fallback")}
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
              value={
                rawMaterials?.windowGValue ??
                (typeof modelWindowGField?.value === "number" ? modelWindowGField.value : null)
              }
              source={rawMaterials?.windowGValue != null ? "user" : (modelWindowGField?.source ?? "fallback")}
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
              value={
                rawMaterials?.shadingFactor ??
                (typeof modelShadingField?.value === "number" ? modelShadingField.value : null)
              }
              source={
                rawMaterials?.shadingFactor != null
                  ? "user"
                  : (modelShadingField?.source ?? "missing")
              }
              formulaFieldKey="materials.shading-factor"
              warning={modelShadingField?.notes[0] ?? null}
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
              source={
                modelHpsi != null
                  ? envelopeBridgePreview.hasLinear
                    ? "sp50"
                    : "calculated"
                  : "missing"
              }
              formulaFieldKey="materials.h-psi"
              showSourceBadge={bridgesInEnergyBalance && modelHpsi != null}
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
              source={
                modelHchi != null
                  ? envelopeBridgePreview.hasPoint
                    ? "sp50"
                    : "calculated"
                  : "missing"
              }
              formulaFieldKey="materials.h-chi"
              showSourceBadge={bridgesInEnergyBalance && modelHchi != null}
              onChange={(next) =>
                updateModel((model) =>
                  setModelBridgeConductance(model, {
                    H_psi_W_K: modelHpsi,
                    H_chi_W_K: next,
                  })
                )
              }
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {dataReport.sections.materials.computedFields
              .filter((field) => !EDITABLE_MAT_KEYS.has(field.key))
              .map((field) => (
                <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
              ))}
          </div>
          {dataReport.constructions.length ? (
            <details
              className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]"
              open={false}
            >
              <summary className="cursor-pointer select-none list-none px-4 py-4 [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-base)]">Конструкции ограждения</p>
                  <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                    {dataReport.constructions.length} шт.
                  </p>
                </div>
              </summary>
              <div className="space-y-3 border-t border-[color:var(--border-soft)] px-4 pb-4 pt-4">
              {dataReport.constructions.map((construction) => (
                <details
                  key={construction.id}
                  className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)]"
                  open={false}
                >
                  <summary className="cursor-pointer select-none list-none px-3 py-3 [&::-webkit-details-marker]:hidden">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-base)]">{construction.label}</p>
                        <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                          {translateEnumValue(construction.kind)} · {formatFieldValue(construction.areaM2)}
                        </p>
                      </div>
                    </div>
                  </summary>
                  <div className="space-y-4 border-t border-[color:var(--border-soft)] px-3 pb-3 pt-3">
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
              ))}
              </div>
            </details>
            ) : null}
        </div>
      </ScenarioSectionShell>
      </div>

      <div id="data-section-climate" className="scroll-mt-24">
      <ScenarioSectionShell {...sectionShellProps} sectionId="climate" title={SECTION_TITLES.climate}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label="Город / климатический профиль"
              value={resolvedClimateCityId}
              source={
                rawClimateCityId
                  ? "user"
                  : modelClimateCityId
                    ? "model"
                    : climateDesignField?.source === "model"
                      ? "model"
                      : "sp131"
              }
              showSourceBadge
              options={sp131CitySelectOptions()}
              onChange={(next) => {
                const cityId = next || "moscow";
                updateScenario((draft) => {
                  draft.climateCityId = cityId;
                  draft.climate.manual = {
                    ...(draft.climate.manual ?? {}),
                    outdoorDesignTemperatureC: null,
                    outdoorHeatingAverageC: null,
                    heatingDurationDays: null,
                  };
                });
                updateModel((model) => applySp131ClimateToModel(model, cityId));
              }}
            />
            <NumberInputField
              label="Расчётная наружная температура"
              value={displayDesignOutdoorC}
              unit="°C"
              source={
                climateManual?.outdoorDesignTemperatureC != null
                  ? "user"
                  : (climateDesignField?.source ?? "missing")
              }
              showSourceBadge
              onChange={(next) => {
                updateScenario((draft) => {
                  draft.climate.manual = draft.climate.manual ?? {};
                  draft.climate.manual.outdoorDesignTemperatureC = next;
                });
                updateModel((model) => ({
                  ...model,
                  thermalProtection: {
                    ...(model.thermalProtection ?? {}),
                    climate: {
                      ...(model.thermalProtection?.climate ?? {}),
                      outdoorDesignTemperatureC: next,
                    },
                  },
                }));
              }}
            />
            <NumberInputField
              label="Средняя температура отопительного периода"
              value={displayHeatingAverageC}
              unit="°C"
              source={
                climateManual?.outdoorHeatingAverageC != null
                  ? "user"
                  : (climateAverageField?.source ?? "missing")
              }
              showSourceBadge
              onChange={(next) => {
                updateScenario((draft) => {
                  draft.climate.manual = draft.climate.manual ?? {};
                  draft.climate.manual.outdoorHeatingAverageC = next;
                });
                updateModel((model) => ({
                  ...model,
                  thermalProtection: {
                    ...(model.thermalProtection ?? {}),
                    climate: {
                      ...(model.thermalProtection?.climate ?? {}),
                      outdoorHeatingPeriodAverageC: next,
                    },
                  },
                }));
              }}
            />
            <NumberInputField
              label="Длительность отопительного периода"
              value={displayHeatingDurationDays}
              unit="сут"
              source={
                climateManual?.heatingDurationDays != null
                  ? "user"
                  : (climateDurationField?.source ?? "missing")
              }
              showSourceBadge
              onChange={(next) => {
                updateScenario((draft) => {
                  draft.climate.manual = draft.climate.manual ?? {};
                  draft.climate.manual.heatingDurationDays = next;
                });
                updateModel((model) => ({
                  ...model,
                  thermalProtection: {
                    ...(model.thermalProtection ?? {}),
                    climate: {
                      ...(model.thermalProtection?.climate ?? {}),
                      heatingPeriodDurationDays: next,
                    },
                  },
                }));
              }}
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {climateComputedFields
              .filter((field) => !EDITABLE_CLIMATE_KEYS.has(field.key))
              .map((field) => (
                <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
              ))}
          </div>
        </div>
      </ScenarioSectionShell>
      </div>

      <div id="data-section-operation" className="scroll-mt-24">
      <ScenarioSectionShell {...sectionShellProps} sectionId="operation" title={SECTION_TITLES.operation}>
        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <SelectField
              label="Режим занятости"
              value={occupancyPresetSelection}
              source="fallback"
              showSourceBadge={false}
              options={OCCUPANCY_PRESET_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(next) =>
                updateScenario((draft) => {
                  if (!next || next === "custom") {
                    markOccupancyAsCustom(draft);
                    return;
                  }
                  applyOccupancyPresetToConfig(draft, next as OccupancyPresetId);
                })
              }
            />
            {suggestedOccupancyPreset &&
            occupancyPresetSelection !== suggestedOccupancyPreset &&
            modelBuildingCategory ? (
              <button
                type="button"
                className="ui-btn-secondary px-3 py-1.5 text-xs"
                onClick={() =>
                  updateScenario((draft) => {
                    applyOccupancyPresetToConfig(draft, suggestedOccupancyPreset);
                  })
                }
              >
                Подставить по категории здания:{" "}
                {BUILDING_CATEGORIES[modelBuildingCategory]?.label ?? modelBuildingCategory}
              </button>
            ) : null}
            {modelIndoorDesignC != null && setpointsMatchModelIndoor ? (
              <button
                type="button"
                className="ui-btn-secondary px-3 py-1.5 text-xs"
                onClick={() =>
                  updateScenario((draft) => {
                    applyModelIndoorSetpointsToConfig(draft, strictModelForData);
                  })
                }
              >
                Подставить уставки из модели: {formatNumber(modelIndoorDesignC, { maximumFractionDigits: 1 })} /{" "}
                {formatNumber(suggestedNightSetpointC(modelIndoorDesignC), { maximumFractionDigits: 1 })} °C
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <NumberInputField
              label="Дневная уставка"
              value={scenario.setpoints.day}
              unit="°C"
              source={daySetpointScalar.source}
              onChange={(next) => updateScenario((draft) => { draft.setpoints.day = next ?? draft.setpoints.day; })}
            />
            <NumberInputField
              label="Ночная уставка"
              value={scenario.setpoints.night}
              unit="°C"
              source={nightSetpointScalar.source}
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
              source={occupancyOperationFieldSource(rawScenarioConfig, rawScenarioConfig?.internalGains?.dayGain_W_m2 != null)}
              onChange={(next) =>
                updateScenario((draft) => {
                  markOccupancyAsCustom(draft);
                  draft.internalGains.dayGain_W_m2 = next ?? draft.internalGains.dayGain_W_m2;
                })
              }
            />
            <NumberInputField
              label="Теплопоступления ночью"
              value={scenario.internalGains.nightGain_W_m2}
              unit="Вт/м²"
              source={occupancyOperationFieldSource(rawScenarioConfig, rawScenarioConfig?.internalGains?.nightGain_W_m2 != null)}
              onChange={(next) =>
                updateScenario((draft) => {
                  markOccupancyAsCustom(draft);
                  draft.internalGains.nightGain_W_m2 = next ?? draft.internalGains.nightGain_W_m2;
                })
              }
            />
            <NumberInputField
              label="Занятость днём"
              value={scenario.occupancy.dayFraction}
              source={occupancyOperationFieldSource(rawScenarioConfig, rawScenarioConfig?.occupancy?.dayFraction != null)}
              onChange={(next) =>
                updateScenario((draft) => {
                  markOccupancyAsCustom(draft);
                  draft.occupancy.dayFraction = Math.max(0, Math.min(1, next ?? draft.occupancy.dayFraction));
                })
              }
            />
            <NumberInputField
              label="Занятость ночью"
              value={scenario.occupancy.nightFraction}
              source={occupancyOperationFieldSource(rawScenarioConfig, rawScenarioConfig?.occupancy?.nightFraction != null)}
              onChange={(next) =>
                updateScenario((draft) => {
                  markOccupancyAsCustom(draft);
                  draft.occupancy.nightFraction = Math.max(0, Math.min(1, next ?? draft.occupancy.nightFraction));
                })
              }
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
        </div>
      </ScenarioSectionShell>
      </div>

      <div id="data-section-air" className="scroll-mt-24">
      <ScenarioSectionShell {...sectionShellProps} sectionId="airExchange" title={SECTION_TITLES.airExchange}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label="Режим инфильтрации"
              value={infiltrationMode}
              source={scenarioFieldSource(rawScenarioConfig?.ventilation?.infiltrationMode != null, "scenario")}
              options={INFILTRATION_MODE_OPTIONS}
              onChange={(next) => updateScenario((draft) => {
                draft.ventilation.infiltrationMode =
                  (next as "manualAch" | "envelopeLeakage" | "pressureBased" | null) ??
                  defaultVentilation.infiltrationMode ??
                  "envelopeLeakage";
              })}
            />
            {infiltrationMode === "manualAch" ? (
              <NumberInputField
                label="Кратность инфильтрации"
                value={resolvedVentilation.infiltrationACH.value}
                unit="1/ч"
                source={ventilationInputSourceToOrigin(resolvedVentilation.infiltrationACH.source)}
                formulaFieldKey="scenario.ventilation.infiltration-ach"
                onChange={(next) => updateScenario((draft) => { draft.ventilation.infiltrationACH = Math.max(0, next ?? draft.ventilation.infiltrationACH); })}
              />
            ) : null}
            <ResolvedLeakageField
              label="Кратность механической вентиляции"
              unit="1/ч"
              scalar={resolvedVentilation.ventilationACH}
              formulaFieldKey="scenario.ventilation.ventilation-ach"
              demoMode={isDemoProject}
              computedField={airFieldByKey.get("air.ventilation-ach")}
              onChange={(next) => updateScenario((draft) => { draft.ventilation.ventilationACH = Math.max(0, next ?? draft.ventilation.ventilationACH); })}
            />
            <ToggleField
              label="Механическая вентиляция"
              checked={resolvedVentilation.mechanicalVentilationEnabled.value}
              source={ventilationInputSourceToOrigin(resolvedVentilation.mechanicalVentilationEnabled.source)}
              onChange={(next) => updateScenario((draft) => { draft.ventilation.mechanicalVentilationEnabled = next; })}
            />
            <ResolvedLeakageField
              label="КПД рекуперации"
              scalar={resolvedVentilation.heatRecoveryFactor}
              formulaFieldKey="scenario.ventilation.heat-recovery"
              demoMode={isDemoProject}
              computedField={airFieldByKey.get("air.heat-recovery")}
              onChange={(next) => updateScenario((draft) => {
                draft.ventilation.heatRecoveryFactor = Math.max(0, Math.min(1, next ?? draft.ventilation.heatRecoveryFactor));
              })}
            />
            {infiltrationMode !== "manualAch" ? (
              <>
                <ResolvedLeakageField
                  label="G_air ограждений @10 Па"
                  unit="м³/(с·м²)"
                  scalar={resolvedLeakage.envelopeAirPermeabilityM3sM2At10Pa}
                  formulaFieldKey="scenario.ventilation.envelope-g-air"
                  demoMode={isDemoProject}
                  computedField={airFieldByKey.get("air.g-envelope")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.envelopeLeakage = draft.ventilation.envelopeLeakage ?? {};
                    draft.ventilation.envelopeLeakage.envelopeAirPermeabilityM3sM2At10Pa = next == null ? null : Math.max(0, next);
                  })}
                />
                <ResolvedLeakageField
                  label="G_air окон @10 Па"
                  unit="м³/(с·м)"
                  scalar={resolvedLeakage.windowAirPermeabilityM3sMAt10Pa}
                  demoMode={isDemoProject}
                  computedField={airFieldByKey.get("air.g-window")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.envelopeLeakage = draft.ventilation.envelopeLeakage ?? {};
                    draft.ventilation.envelopeLeakage.windowAirPermeabilityM3sMAt10Pa = next == null ? null : Math.max(0, next);
                  })}
                />
                <ResolvedLeakageField
                  label="G_air дверей @10 Па"
                  unit="м³/(с·м)"
                  scalar={resolvedLeakage.doorAirPermeabilityM3sMAt10Pa}
                  demoMode={isDemoProject}
                  computedField={airFieldByKey.get("air.g-door")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.envelopeLeakage = draft.ventilation.envelopeLeakage ?? {};
                    draft.ventilation.envelopeLeakage.doorAirPermeabilityM3sMAt10Pa = next == null ? null : Math.max(0, next);
                  })}
                />
                <ResolvedLeakageField
                  label="Показатель степени n"
                  scalar={resolvedLeakage.pressureExponent}
                  demoMode={isDemoProject}
                  computedField={airFieldByKey.get("air.pressure-exponent")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.envelopeLeakage = draft.ventilation.envelopeLeakage ?? {};
                    draft.ventilation.envelopeLeakage.pressureExponent = next == null ? null : Math.max(0.1, next);
                  })}
                />
              </>
            ) : null}
            {infiltrationMode === "pressureBased" ? (
              <>
                <ResolvedLeakageField
                  label="Скорость ветра"
                  unit="м/с"
                  scalar={resolvedVentilation.windSpeedMps}
                  demoMode={isDemoProject}
                  computedField={airFieldByKey.get("air.wind-speed")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.pressureBased = draft.ventilation.pressureBased ?? {};
                    draft.ventilation.pressureBased.windSpeedMps = next == null ? null : Math.max(0, next);
                  })}
                />
                <ResolvedLeakageField
                  label="Коэффициент давления Cp"
                  scalar={resolvedVentilation.windPressureCoefficient}
                  formulaFieldKey="scenario.ventilation.wind-cp"
                  demoMode={isDemoProject}
                  computedField={airFieldByKey.get("air.wind-cp")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.pressureBased = draft.ventilation.pressureBased ?? {};
                    draft.ventilation.pressureBased.windPressureCoefficient = next == null ? null : Math.max(0.1, next);
                  })}
                />
                <ResolvedLeakageField
                  label="Высота для теплового напора"
                  unit="м"
                  scalar={resolvedVentilation.stackHeightM}
                  formulaFieldKey="scenario.ventilation.stack-height"
                  demoMode={isDemoProject}
                  computedField={airFieldByKey.get("air.stack-height")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.pressureBased = draft.ventilation.pressureBased ?? {};
                    draft.ventilation.pressureBased.stackHeightM = next == null ? null : Math.max(0.5, next);
                  })}
                />
                <ResolvedLeakageField
                  label="ΔP мех. вентиляции"
                  unit="Па"
                  scalar={resolvedVentilation.mechanicalPressurePa}
                  demoMode={isDemoProject}
                  computedField={airFieldByKey.get("air.mechanical-pressure")}
                  onChange={(next) => updateScenario((draft) => {
                    draft.ventilation.pressureBased = draft.ventilation.pressureBased ?? {};
                    draft.ventilation.pressureBased.mechanicalPressurePa = next == null ? null : Math.max(0, next);
                  })}
                />
              </>
            ) : null}
            {infiltrationUsesFallback ? (
              <NumberInputField
                label="Резервная кратность инфильтрации"
                value={resolvedVentilation.infiltrationACH.value}
                unit="1/ч"
                source={ventilationInputSourceToOrigin(resolvedVentilation.infiltrationACH.source)}
                formulaFieldKey="scenario.ventilation.infiltration-ach"
                onChange={(next) => updateScenario((draft) => { draft.ventilation.infiltrationACH = Math.max(0, next ?? draft.ventilation.infiltrationACH); })}
              />
            ) : null}
            {airComputedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} />
            ))}
          </div>
        </div>
      </ScenarioSectionShell>
      </div>

      <div id="data-section-engineering" className="scroll-mt-24">
      <ScenarioSectionShell
        {...sectionShellProps}
        sectionId="engineeringNetworks"
        title={SECTION_TITLES.engineeringNetworks}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ToggleField
              label="Система отопления активна"
              checked={scenario.engineeringSystems?.heatingEnabled ?? true}
              source={scenarioFieldSource(rawEngineering?.heatingEnabled != null)}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.heatingEnabled = next;
              })}
            />
            <SelectField
              label="Режим отопления"
              value={scenario.engineeringSystems?.heatingMode ?? "ideal"}
              source={scenarioFieldSource(Boolean(rawEngineering?.heatingMode))}
              showSourceBadge={false}
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
              value={resolvedEngineering.supplyTemperatureC.value}
              unit="°C"
              source={engineeringInputSourceToOrigin(resolvedEngineering.supplyTemperatureC.source)}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.supplyTemperatureC = next;
              })}
            />
            <NumberInputField
              label="Температура обратки"
              value={resolvedEngineering.returnTemperatureC.value}
              unit="°C"
              source={engineeringInputSourceToOrigin(resolvedEngineering.returnTemperatureC.source)}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.returnTemperatureC = next;
              })}
            />
            <NumberInputField
              label="Массовый расход теплоносителя"
              value={resolvedEngineering.massFlowKgS.value}
              unit="кг/с"
              source={engineeringInputSourceToOrigin(resolvedEngineering.massFlowKgS.source)}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.massFlowKgS = next;
              })}
            />
            <SelectField
              label="Тип теплоносителя"
              value={resolvedEngineering.fluidType}
              source={engineeringInputSourceToOrigin(resolvedEngineering.fluidTypeSource)}
              showSourceBadge={false}
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
              value={resolvedEngineering.installedCapacityW.value}
              unit="Вт"
              source={engineeringInputSourceToOrigin(resolvedEngineering.installedCapacityW.source)}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.installedCapacityW = next;
              })}
            />
            <NumberInputField
              label="Диаметр трубы"
              value={resolvedEngineering.pipeDiameterMm?.value ?? null}
              unit="мм"
              source={
                resolvedEngineering.pipeDiameterMm
                  ? engineeringInputSourceToOrigin(resolvedEngineering.pipeDiameterMm.source)
                  : "missing"
              }
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.pipeDiameterMm = next;
              })}
            />
            <NumberInputField
              label="Длина трубы"
              value={resolvedEngineering.pipeLengthM?.value ?? null}
              unit="м"
              source={
                resolvedEngineering.pipeLengthM
                  ? engineeringInputSourceToOrigin(resolvedEngineering.pipeLengthM.source)
                  : "missing"
              }
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.pipeLengthM = next;
              })}
            />
            <ToggleField
              label="Труба изолирована"
              checked={resolvedEngineering.pipeInsulated.value}
              source={engineeringInputSourceToOrigin(resolvedEngineering.pipeInsulated.source)}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.pipeInsulated = next;
              })}
            />
            <NumberInputField
              label="Температура теплоносителя в трубе"
              value={resolvedEngineering.pipeFluidTemperatureC.value}
              unit="°C"
              source={engineeringInputSourceToOrigin(resolvedEngineering.pipeFluidTemperatureC.source)}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.engineeringSystems = draft.engineeringSystems ?? {};
                draft.engineeringSystems.pipeFluidTemperatureC = next;
              })}
            />
            {engineeringComputedFields.map((field) => (
              <ReadOnlyFieldCard key={field.key} field={field} demoMode={isDemoProject} showSourceBadge={false} />
            ))}
          </div>
        </div>
      </ScenarioSectionShell>
      </div>

      <div id="data-section-ecology" className="scroll-mt-24">
      <ScenarioSectionShell {...sectionShellProps} sectionId="ecology" title={SECTION_TITLES.ecology}>
        <div className="space-y-4">
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
                const previousEnergySource = draft.ecology.energySource ?? null;
                draft.ecology.energySource = next || null;
                syncEcologyEmissionFactorOnEnergySourceChange(
                  draft.ecology,
                  previousEnergySource,
                  draft.ecology.energySource
                );
              })}
            />
            <NumberInputField
              label="Удельный коэффициент выбросов CO₂"
              value={resolvedEcologyEmission.value}
              unit="кг CO₂/кВт·ч"
              source={ecologyEmissionSourceToOrigin(resolvedEcologyEmission.source)}
              formulaFieldKey="ecology.ef"
              warning={
                resolvedEcologyEmission.source === "norm" && resolvedEcologyEmission.normNote
                  ? `Типовое значение: ${resolvedEcologyEmission.normNote}`
                  : null
              }
              onChange={(next) => updateScenario((draft) => {
                draft.ecology = draft.ecology ?? {};
                draft.ecology.emissionFactorKgPerKWh = next;
              })}
            />
          </div>
        </div>
      </ScenarioSectionShell>
      </div>

      <div id="data-section-economy" className="scroll-mt-24">
      <ScenarioSectionShell {...sectionShellProps} sectionId="economy" title={SECTION_TITLES.economy}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {economyHeatingSourceField ? (
              <ReadOnlyFieldCard field={economyHeatingSourceField} demoMode={isDemoProject} showSourceBadge={false} />
            ) : null}
            {economyTariffField ? (
              <ReadOnlyFieldCard field={economyTariffField} demoMode={isDemoProject} showSourceBadge={false} />
            ) : null}
            <NumberInputField
              label="CAPEX мероприятий"
              value={resolvedEconomyDisplayValue(rawEconomy?.capexRub, resolvedEconomy.capexRub)}
              unit="руб"
              source={economyFieldSourceToOrigin(resolvedEconomy.capexRub.source, Boolean(rawClimateCityId))}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.capexRub = next;
              })}
            />
            <NumberInputField
              label="Период анализа"
              value={resolvedEconomyDisplayValue(rawEconomy?.analysisPeriodYears, resolvedEconomy.analysisPeriodYears)}
              unit="лет"
              source={economyFieldSourceToOrigin(resolvedEconomy.analysisPeriodYears.source, Boolean(rawClimateCityId))}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.analysisPeriodYears = next;
              })}
            />
            <NumberInputField
              label="Ставка дисконтирования"
              value={resolvedEconomyDisplayValue(rawEconomy?.discountRatePercent, resolvedEconomy.discountRatePercent)}
              unit="%"
              source={economyFieldSourceToOrigin(resolvedEconomy.discountRatePercent.source, Boolean(rawClimateCityId))}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.discountRatePercent = next;
              })}
            />
            <NumberInputField
              label="Рост тарифа"
              value={resolvedEconomyDisplayValue(rawEconomy?.annualTariffGrowthPercent, resolvedEconomy.annualTariffGrowthPercent)}
              unit="%"
              source={economyFieldSourceToOrigin(resolvedEconomy.annualTariffGrowthPercent.source, Boolean(rawClimateCityId))}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.annualTariffGrowthPercent = next;
              })}
            />
            <NumberInputField
              label="Стоимость обслуживания"
              value={resolvedEconomyDisplayValue(rawEconomy?.annualMaintenanceCostRub, resolvedEconomy.annualMaintenanceCostRub)}
              unit="руб/год"
              source={economyFieldSourceToOrigin(resolvedEconomy.annualMaintenanceCostRub.source, Boolean(rawClimateCityId))}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.annualMaintenanceCostRub = next;
              })}
            />
            <NumberInputField
              label="Стоимость утепления"
              value={resolvedEconomyDisplayValue(rawEconomy?.insulationCostRub, resolvedEconomy.insulationCostRub)}
              unit="руб"
              source={economyFieldSourceToOrigin(resolvedEconomy.insulationCostRub.source, Boolean(rawClimateCityId))}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.insulationCostRub = next;
              })}
            />
            <NumberInputField
              label="Стоимость окон"
              value={resolvedEconomyDisplayValue(rawEconomy?.windowsCostRub, resolvedEconomy.windowsCostRub)}
              unit="руб"
              source={economyFieldSourceToOrigin(resolvedEconomy.windowsCostRub.source, Boolean(rawClimateCityId))}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.windowsCostRub = next;
              })}
            />
            <NumberInputField
              label="Стоимость оборудования"
              value={resolvedEconomyDisplayValue(rawEconomy?.equipmentCostRub, resolvedEconomy.equipmentCostRub)}
              unit="руб"
              source={economyFieldSourceToOrigin(resolvedEconomy.equipmentCostRub.source, Boolean(rawClimateCityId))}
              showSourceBadge={false}
              onChange={(next) => updateScenario((draft) => {
                draft.economy = draft.economy ?? {};
                draft.economy.equipmentCostRub = next;
              })}
            />
          </div>
        </div>
      </ScenarioSectionShell>
      </div>

      <div id="data-section-validation" className="scroll-mt-24">
      <ScenarioSectionShell {...sectionShellProps} sectionId="validation" title={SECTION_TITLES.validation}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        </div>
      </ScenarioSectionShell>
      </div>

      <div id="data-section-reports" className="scroll-mt-24">
      <ScenarioSectionShell {...sectionShellProps} sectionId="reports" title={SECTION_TITLES.reports}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
      </ScenarioSectionShell>
      </div>
    </section>
  );
}

export default ScenariosWorkspacePage;
