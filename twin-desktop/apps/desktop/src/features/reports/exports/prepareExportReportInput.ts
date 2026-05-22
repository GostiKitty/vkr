import { runThermalSimulation } from "../../../core/thermal/solver";
import { isVideoDemoProjectModel } from "../../build/demoVideoProject";
import { applyScenarioToBuilding } from "../../build/thermal/applyScenarioToBuilding";
import { DEFAULT_THERMAL_OPTIONS } from "../../build/thermal/defaultThermalOptions";
import { buildThermalOptionsFromWorkflow } from "../../build/thermal/workflowThermalOptions";
import {
  applyDemoDesignDefaults,
  type AssumptionEntry,
} from "./defaults/demoHouseDesignDefaults";
import type {
  BuildReportBaseDataInput,
  ReportDynamicResultState,
} from "./data/buildReportBaseData";

export interface PreparedExportReportInput {
  input: BuildReportBaseDataInput;
  appliedAssumptions: AssumptionEntry[];
}

export function prepareExportReportInput(
  rawInput: BuildReportBaseDataInput,
  options: { applyDemoDefaults: boolean }
): PreparedExportReportInput {
  let preparedInput = rawInput;
  let appliedAssumptions: AssumptionEntry[] = [];

  if (options.applyDemoDefaults) {
    const result = applyDemoDesignDefaults(preparedInput);
    preparedInput = result.input;
    appliedAssumptions = result.appliedAssumptions;
  }

  const autoPrepared = ensureDemoThermalResult(preparedInput, options.applyDemoDefaults);
  return {
    input: {
      ...autoPrepared.input,
      appliedAssumptions,
      dynamicResultState: autoPrepared.dynamicResultState,
    },
    appliedAssumptions,
  };
}

function ensureDemoThermalResult(
  input: BuildReportBaseDataInput,
  applyDemoDefaults: boolean
): { input: BuildReportBaseDataInput; dynamicResultState: ReportDynamicResultState } {
  if (input.thermalResult) {
    return { input, dynamicResultState: "provided" };
  }
  if (!applyDemoDefaults || !isDemoProject(input)) {
    return { input, dynamicResultState: "missing" };
  }

  try {
    const scenario =
      input.scenarioConfig ??
      applyDemoDesignDefaults(input).input.scenarioConfig ??
      null;
    const modelForSimulation = applyScenarioToBuilding(input.model, scenario);
    const thermalOptions = buildThermalOptionsFromWorkflow(
      scenario,
      DEFAULT_THERMAL_OPTIONS
    );
    const thermalResult = runThermalSimulation(modelForSimulation, thermalOptions);
    if (!thermalResult || !thermalResult.timeline?.length) {
      return { input, dynamicResultState: "failed-auto-demo" };
    }
    return {
      input: {
        ...input,
        model: modelForSimulation,
        scenarioConfig: scenario,
        thermalResult,
      },
      dynamicResultState: "auto-demo",
    };
  } catch (error) {
    console.warn("Не удалось автоматически выполнить RC-расчёт для демо-выгрузки", error);
    return { input, dynamicResultState: "failed-auto-demo" };
  }
}

function isDemoProject(input: BuildReportBaseDataInput): boolean {
  return (
    isVideoDemoProjectModel(input.model) ||
    (typeof input.projectId === "string" && input.projectId.startsWith("local:demo"))
  );
}
