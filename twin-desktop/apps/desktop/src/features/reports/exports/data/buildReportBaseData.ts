/**
 * Общая база данных для всех типов выгрузки.
 *
 * Этот модуль агрегирует уже существующие источники истины
 * (BuildingModel, CalculationPassportData, Sp50ComplianceReport, ScenarioConfig)
 * и формирует унифицированный пакет данных. Он НЕ запускает новых расчётов
 * и НЕ модифицирует BuildingModel.
 */

import type { BuildingModel } from "../../../../entities/geometry/types";
import type { ScenarioConfig } from "../../../../entities/workflow/workflow.store";
import type { ThermalSimulationResult } from "../../../../core/thermal/solver";
import type { ThermalMonteCarloResult } from "../../../../core/uncertainty/thermalMonteCarlo";
import type { Sp50ComplianceReport } from "../../../../core/thermal/sp50/types";
import {
  buildCalculationPassportData,
  type CalculationPassportData,
} from "../../calculationPassportData";
import type { ReportMeta } from "../../../build/reports/reportMetaPersistence";
import { firstDisplayText, sanitizeDisplayText } from "../../../../shared/utils/displayText";
import type { ReportExportDocumentMeta } from "../types";
import type { AssumptionEntry } from "../defaults/demoHouseDesignDefaults";
import { SOLAR_GAIN_METHODOLOGY_ASSUMPTION } from "../defaults/demoHouseDesignDefaults";
import {
  buildExpertiseContext,
  type ExpertiseContext,
} from "./buildExpertiseContext";
import type { ExpertiseReportInputs } from "../store/expertiseInputs.store";

const NOT_SET = "не задано";

export type ReportDynamicResultState =
  | "provided"
  | "auto-demo"
  | "missing"
  | "failed-auto-demo";

export interface ReportBaseData {
  passport: CalculationPassportData;
  sp50Report: Sp50ComplianceReport | null;
  meta: ReportExportDocumentMeta;
  expertise: ExpertiseContext;
  /**
   * Список применённых проектных допущений. Заполняется, если до построения
   * `ReportBaseData` входные данные были пропущены через
   * `applyDemoDesignDefaults`. Если допущений нет, массив пуст.
   */
  appliedAssumptions: AssumptionEntry[];
  /** Полные исходные данные на случай специфической логики */
  source: {
    model: BuildingModel;
    projectId: string | null;
    scenarioConfig: ScenarioConfig | null;
    thermalResult: ThermalSimulationResult | null;
    monteCarloResult: ThermalMonteCarloResult | null;
    reportMeta: ReportMeta;
    generatedAt: Date;
    dynamicResultState: ReportDynamicResultState;
    expertiseInputs: ExpertiseReportInputs;
  };
}

export interface BuildReportBaseDataInput {
  model: BuildingModel;
  projectId: string | null;
  scenarioConfig: ScenarioConfig | null;
  thermalResult: ThermalSimulationResult | null;
  monteCarloResult: ThermalMonteCarloResult | null;
  reportMeta: ReportMeta;
  generatedAt: Date;
  /** Уже применённые проектные допущения (если есть). */
  appliedAssumptions?: AssumptionEntry[];
  dynamicResultState?: ReportDynamicResultState;
  expertiseInputs?: ExpertiseReportInputs;
}

export function buildReportBaseData(input: BuildReportBaseDataInput): ReportBaseData {
  const passport = buildCalculationPassportData({
    model: input.model,
    projectId: input.projectId,
    scenarioConfig: input.scenarioConfig,
    thermalResult: input.thermalResult,
    monteCarloResult: input.monteCarloResult,
  });
  const draftMeta = buildReportMeta({
    passport,
    reportMeta: input.reportMeta,
    model: input.model,
    projectId: input.projectId,
    generatedAt: input.generatedAt,
  });

  const appliedAssumptions = mergeAssumptions(
    input.appliedAssumptions ?? [],
    detectAutoAssumptions(passport.sp50Report)
  );
  const dynamicResultState =
    input.dynamicResultState ?? (input.thermalResult ? "provided" : "missing");
  const expertise = buildExpertiseContext({
    passport,
    draftMeta,
    reportMeta: input.reportMeta,
    inputs: input.expertiseInputs,
    scenarioConfig: input.scenarioConfig,
    appliedAssumptions,
  });
  const meta: ReportExportDocumentMeta = {
    ...draftMeta,
    ...expertise.documentMetaOverrides,
    modelVersion: resolveModelVersion(expertise, passport, draftMeta),
  };

  return {
    passport,
    sp50Report: passport.sp50Report,
    meta,
    expertise,
    appliedAssumptions,
    source: {
      model: input.model,
      projectId: input.projectId,
      scenarioConfig: input.scenarioConfig,
      thermalResult: input.thermalResult,
      monteCarloResult: input.monteCarloResult,
      reportMeta: input.reportMeta,
      generatedAt: input.generatedAt,
      dynamicResultState,
      expertiseInputs: expertise.inputs,
    },
  };
}

/**
 * Авто-определяемые допущения, которые добавляются без участия профиля demo:
 * например, когда qrad по СП 50 не получается посчитать корректно и поле
 * показывается как «требует уточнения методики».
 */
function detectAutoAssumptions(
  sp50Report: Sp50ComplianceReport | null
): AssumptionEntry[] {
  const result: AssumptionEntry[] = [];
  // Авто-допущение про qrad добавляем ТОЛЬКО когда расчёт по СП 50
  // действительно состоялся (есть конструкции и расчёт энергетики), и при
  // этом значение qrad нельзя предъявить как расчётное. На пустой модели
  // конструкций нет и расчёт энергетики бессмысленен — никаких авто-допущений
  // не добавляем.
  const hasConstructions = (sp50Report?.constructions?.length ?? 0) > 0;
  if (hasConstructions && sp50Report?.energy) {
    const solar = sp50Report.energy.solarGainCharacteristic_W_m3K ?? null;
    const formatted =
      solar !== null && Number.isFinite(solar)
        ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(solar)
        : null;
    const isZeroOrMissing =
      solar === null ||
      !Number.isFinite(solar) ||
      (formatted !== null && /^[−\-]?0([.,]0+)?$/.test(formatted.trim()));
    if (isZeroOrMissing) {
      result.push(SOLAR_GAIN_METHODOLOGY_ASSUMPTION);
    }
  }
  return result;
}

function mergeAssumptions(
  base: AssumptionEntry[],
  extras: AssumptionEntry[]
): AssumptionEntry[] {
  const seen = new Set(base.map((entry) => entry.key));
  const result = [...base];
  for (const entry of extras) {
    if (!seen.has(entry.key)) {
      seen.add(entry.key);
      result.push(entry);
    }
  }
  return result;
}

function buildReportMeta(input: {
  passport: CalculationPassportData;
  reportMeta: ReportMeta;
  model: BuildingModel;
  projectId: string | null;
  generatedAt: Date;
}): ReportExportDocumentMeta {
  const { passport, reportMeta, model, generatedAt } = input;
  const cityFromMeta = sanitizeDisplayText(reportMeta.documentCity, "", { allowInternalId: false });
  const cityFromClimate = passport.climate.city ?? "";
  const fallbackCity = cityFromMeta || cityFromClimate || "—";

  return {
    organization: textOrNotSet(reportMeta.developerOrg),
    customer: textOrNotSet(reportMeta.customerOrg),
    objectName: textOrNotSet(passport.projectName),
    address: textOrNotSet(reportMeta.buildingAddress),
    documentCode: resolveDocumentCode(model, reportMeta),
    documentStage: resolveStageLabel(reportMeta.documentStage),
    documentCity: fallbackCity,
    year: String(generatedAt.getFullYear()),
    generatedAtLabel: formatGeneratedAt(generatedAt),
    developedBy: resolveResponsiblePerson(model, ["developedBy", "author", "developer"]),
    checkedBy: resolveResponsiblePerson(model, ["checkedBy", "reviewer", "checker"]),
    normControl: resolveResponsiblePerson(model, ["normControl", "normokontrol", "normController"]),
    chiefEngineer: resolveResponsiblePerson(model, ["gip", "chiefEngineer", "projectEngineer"]),
    modelVersion: passport.modelVersion ?? NOT_SET,
  };
}

function textOrNotSet(value: string | null | undefined): string {
  const sanitized = sanitizeDisplayText(value, "", { allowInternalId: false });
  return sanitized || NOT_SET;
}

function resolveDocumentCode(model: BuildingModel, reportMeta: ReportMeta): string {
  const meta = model.meta ?? {};
  const fromModel = firstDisplayText(
    [meta["documentCode"], meta["designation"], meta["cipher"], meta["projectCipher"]],
    "",
    { allowInternalId: true }
  );
  const sanitized = sanitizeDisplayText(fromModel || reportMeta.projectCipher, "", {
    allowInternalId: true,
  });
  return sanitized || "б/н";
}

function resolveStageLabel(stageValue: string | null | undefined): string {
  const normalized = sanitizeDisplayText(stageValue, "", { allowInternalId: true }).toLowerCase();
  if (!normalized) {
    return "Проектная документация";
  }
  if (normalized === "п" || normalized.includes("проект")) {
    return "Проектная документация";
  }
  if (normalized === "р" || normalized.includes("рабоч")) {
    return "Рабочая документация";
  }
  return sanitizeDisplayText(stageValue, "Проектная документация", { allowInternalId: true });
}

function resolveResponsiblePerson(model: BuildingModel, keys: string[]): string {
  const meta = model.meta ?? {};
  const values = keys.map((key) => meta[key]);
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed === "—" || trimmed === "-") {
      return "—";
    }
    const resolved = sanitizeDisplayText(trimmed, "", { allowInternalId: false });
    if (resolved) {
      return resolved;
    }
  }
  return NOT_SET;
}

function formatGeneratedAt(value: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function resolveModelVersion(
  expertise: ReturnType<typeof buildExpertiseContext>,
  passport: CalculationPassportData,
  draftMeta: ReportExportDocumentMeta
): string {
  const field = expertise.fieldMap.modelVersion;
  if (field?.source === "user-input" && field.rawValue) {
    return field.value;
  }
  if (passport.modelVersion) {
    return passport.modelVersion;
  }
  if (expertise.exportMode === "strict-expertise") {
    return draftMeta.modelVersion;
  }
  return "сформирована автоматически";
}
