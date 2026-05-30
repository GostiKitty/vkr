import type { BuildingModel } from "../../entities/geometry/types";
import type { ExpertiseReportInputs } from "../reports/exports/store/expertiseInputs.store";
import { DEMO_HOUSE_DESIGN_DEFAULTS } from "../reports/exports/defaults/demoHouseDesignDefaults";
import { gsop } from "../../core/thermal/formulas";
import type { ScenarioConfig } from "../../entities/workflow/workflow.store";
import { resolveScenarioConfig } from "../../entities/workflow/workflow.store";
import {
  buildDemoHouseModel,
  buildDemoScenarioConfig,
  buildDemoThermalResult,
} from "../../demo/demoHouse";
import {
  DEMO_PROJECT_ID as CANONICAL_DEMO_PROJECT_ID,
  DEMO_PROJECT_NAME as CANONICAL_DEMO_PROJECT_NAME,
  DEMO_PROJECT_SOURCE as CANONICAL_DEMO_PROJECT_SOURCE,
  isCanonicalDemoProjectModel,
} from "../../shared/utils/demoProject";
import {
  resolveModelDoorU_W_m2K,
  resolveModelWindowU_W_m2K,
  TYPICAL_PVC_WINDOW_G_VALUE,
} from "../../shared/utils/openingThermalData";

export const DEMO_PROJECT_ID = CANONICAL_DEMO_PROJECT_ID;
export const DEMO_PROJECT_NAME = CANONICAL_DEMO_PROJECT_NAME;
export const DEMO_PROJECT_SOURCE = CANONICAL_DEMO_PROJECT_SOURCE;

export interface DemoPreparedProject {
  model: BuildingModel;
  scenarioConfig: ScenarioConfig;
  thermalResult: ReturnType<typeof buildDemoThermalResult>;
  reportInputs: ExpertiseReportInputs;
}

export function buildDemoProjectModel(): BuildingModel {
  const model = buildDemoHouseModel();
  model.meta = {
    ...(model.meta ?? {}),
    name: DEMO_PROJECT_NAME,
    demoScenarioId: "video-demo",
    projectSource: DEMO_PROJECT_SOURCE,
    sourceProjectId: DEMO_PROJECT_ID,
    sourceProjectName: DEMO_PROJECT_NAME,
  };
  return model;
}

export function buildDemoProjectScenarioConfig(model?: BuildingModel): ScenarioConfig {
  const base = buildDemoScenarioConfig();
  if (!model) {
    return base;
  }
  const windowU = resolveModelWindowU_W_m2K(model) ?? base.materials?.windowUValue_W_m2K ?? null;
  const doorU = resolveModelDoorU_W_m2K(model) ?? base.materials?.doorUValue_W_m2K ?? null;
  return {
    ...base,
    materials: {
      ...base.materials,
      windowUValue_W_m2K: windowU,
      doorUValue_W_m2K: doorU,
      windowGValue: base.materials?.windowGValue ?? TYPICAL_PVC_WINDOW_G_VALUE,
    },
  };
}

export function buildDemoReportInputs(
  model: BuildingModel = buildDemoProjectModel(),
  scenarioConfig: ScenarioConfig = buildDemoProjectScenarioConfig()
): ExpertiseReportInputs {
  const defaults = DEMO_HOUSE_DESIGN_DEFAULTS;
  const scenario = resolveScenarioConfig(scenarioConfig);
  const climate = model.thermalProtection?.climate;
  const heatedAreaM2 = model.thermalProtection?.heatedAreaM2;
  const heatedVolumeM3 = model.thermalProtection?.heatedVolumeM3;
  const gsopValue =
    climate?.indoorTemperatureC != null &&
    climate.outdoorHeatingPeriodAverageC != null &&
    climate.heatingPeriodDurationDays != null
      ? gsop(
          climate.indoorTemperatureC,
          climate.outdoorHeatingPeriodAverageC,
          climate.heatingPeriodDurationDays
        )
      : null;

  return {
    projectName: DEMO_PROJECT_NAME,
    objectAddress: String(model.meta?.demoProjectAddress ?? defaults.buildingAddress),
    projectCipher: defaults.projectCode,
    documentStage: defaults.stage,
    issueCity: defaults.city,
    issueYear: String(new Date().getFullYear()),
    customerOrg: defaults.customerOrg,
    developerOrg: defaults.organization,
    developedBy: defaults.developedBy,
    checkedBy: defaults.checkedBy,
    normControl: defaults.normControl,
    chiefEngineer: defaults.chiefEngineer,
    designBasis: "СП 50.13330.2024; СП 131.13330.2020; локальные нормативные справочники приложения.",
    contractNumber: "demo-assumption",
    buildingPurpose: "Жилой дом",
    functionalClass: "Ф1.4",
    floorsCount: String(model.levels.length),
    heatedArea: heatedAreaM2 != null ? heatedAreaM2.toFixed(1) : "",
    heatedVolume: heatedVolumeM3 != null ? heatedVolumeM3.toFixed(1) : "",
    operationMode: "постоянное проживание, демонстрационный расчетный сценарий",
    roomsCount: String(model.rooms.length),
    modelNote:
      "Демонстрационная инженерно заполненная модель. Все derived-показатели считаются автоматически из BuildingModel и core diagnostics.",
    modelVersion: "demo-house",
    climateCity: climate?.city ?? defaults.city,
    outdoorDesignTemperatureC:
      climate?.outdoorDesignTemperatureC != null ? String(climate.outdoorDesignTemperatureC) : "",
    outdoorHeatingAverageC:
      climate?.outdoorHeatingPeriodAverageC != null ? String(climate.outdoorHeatingPeriodAverageC) : "",
    heatingDurationDays:
      climate?.heatingPeriodDurationDays != null ? String(climate.heatingPeriodDurationDays) : "",
    gsop: gsopValue != null ? gsopValue.toFixed(0) : "",
    humidityZone:
      climate?.humidityZone === "dry"
        ? "сухая"
        : climate?.humidityZone === "wet"
          ? "влажная"
          : "нормальная",
    operationCondition: model.thermalProtection?.operationCondition ?? defaults.operationCondition,
    indoorDesignTemperatureC:
      climate?.indoorTemperatureC != null ? String(climate.indoorTemperatureC) : String(defaults.indoorDesignTemperatureC),
    indoorRelativeHumidityPercent:
      climate?.indoorRelativeHumidityPercent != null
        ? String(climate.indoorRelativeHumidityPercent)
        : String(defaults.indoorRelativeHumidityPercent),
    ventilationAch: String(scenario.ventilation.ventilationACH),
    infiltrationAch: String(scenario.ventilation.infiltrationACH),
    mechanicalVentilation: scenario.ventilation.mechanicalVentilationEnabled ? "yes" : "no",
    heatRecoveryEfficiencyPercent: String(Math.round(scenario.ventilation.heatRecoveryFactor * 100)),
    daySetpointC: String(scenario.setpoints.day),
    nightSetpointC: String(scenario.setpoints.night),
    calculationScenario: "Базовый RC-сценарий зимних суток для Москвы (демо-проект).",
    internalGains: `${scenario.internalGains.dayGain_W_m2} / ${scenario.internalGains.nightGain_W_m2} Вт/м²`,
    solarGainsMode: "omit",
    solarGainsManualValue: "",
    operationOrg: "демонстрационный объект",
    journalName: "нет данных",
    inspectionFrequency: "типовое значение: ежеквартально",
    temperatureControlRule: "Поддержание 21 °C днем и 18 °C ночью, solver mode = ideal.",
    operationResponsible: "нет данных",
    operationNotes:
      "Часть эксплуатационных реквизитов и экономических параметров заданы как demo assumptions и должны уточняться на проектной стадии.",
    exportMode: "demo",
    showAssumptionsBlock: true,
    showTechnicalIdsInAppendix: true,
    showIncompleteFields: true,
    handleMissingDataMode: "clarify",
  };
}

export function buildPreparedDemoProject(): DemoPreparedProject {
  const model = buildDemoProjectModel();
  const scenarioConfig = buildDemoProjectScenarioConfig(model);
  return {
    model,
    scenarioConfig,
    thermalResult: buildDemoThermalResult(model, scenarioConfig),
    reportInputs: buildDemoReportInputs(model, scenarioConfig),
  };
}

export function buildDemoSourceDataPreset(): DemoPreparedProject {
  return buildPreparedDemoProject();
}

export function applyDemoSourceDataPreset(
  model: BuildingModel,
  scenarioConfig: ScenarioConfig
): DemoPreparedProject {
  const nextModel = {
    ...buildDemoProjectModel(),
    ...model,
    meta: {
      ...buildDemoProjectModel().meta,
      ...(model.meta ?? {}),
    },
  };
  const nextScenario = {
    ...buildDemoProjectScenarioConfig(nextModel),
    ...scenarioConfig,
  };
  return {
    model: nextModel,
    scenarioConfig: nextScenario,
    thermalResult: buildDemoThermalResult(nextModel, nextScenario),
    reportInputs: buildDemoReportInputs(nextModel, nextScenario),
  };
}

export function isDemoProjectModel(model: BuildingModel | null | undefined): boolean {
  return isCanonicalDemoProjectModel(model);
}

/** @deprecated Use `DemoPreparedProject`. */
export type VideoDemoPreparedProject = DemoPreparedProject;
/** @deprecated Use `DEMO_PROJECT_ID`. */
export const VIDEO_DEMO_PROJECT_ID = DEMO_PROJECT_ID;
/** @deprecated Use `DEMO_PROJECT_SOURCE`. */
export const VIDEO_DEMO_PROJECT_SOURCE = DEMO_PROJECT_SOURCE;
/** @deprecated Use `DEMO_PROJECT_NAME`. */
export const VIDEO_DEMO_PROJECT_NAME = DEMO_PROJECT_NAME;
/** @deprecated Use `buildDemoProjectModel`. */
export const buildVideoDemoProjectModel = buildDemoProjectModel;
/** @deprecated Use `buildDemoProjectScenarioConfig`. */
export const buildVideoDemoProjectScenarioConfig = buildDemoProjectScenarioConfig;
/** @deprecated Use `buildDemoReportInputs`. */
export const buildVideoDemoReportInputs = buildDemoReportInputs;
/** @deprecated Use `buildPreparedDemoProject`. */
export const buildPreparedVideoDemoProject = buildPreparedDemoProject;
/** @deprecated Use `isDemoProjectModel`. */
export const isVideoDemoProjectModel = isDemoProjectModel;
